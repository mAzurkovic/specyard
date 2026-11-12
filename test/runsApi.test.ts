import type { SDKMessage, SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { QueryFn } from "../src/runs/RunManager.js";
import { startServer, type RunningServer } from "../src/server.js";
import { tempDir } from "./helpers.js";

const msg = (m: object) => m as unknown as SDKMessage;
let server: RunningServer | undefined;
afterEach(async () => server?.close());

/** Plays one scripted turn per user message; `hold` keeps the run open until released. */
function fakeSdk(turn: SDKMessage[]) {
  const prompts: string[] = [];
  let release = () => {};
  const held = new Promise<void>((r) => (release = r));
  const run: QueryFn = ({ prompt }) =>
    (async function* () {
      for await (const user of prompt as AsyncIterable<SDKUserMessage>) {
        prompts.push(String(user.message.content));
        await held;
        for (const m of turn) yield m;
      }
    })();
  return { run, prompts, release };
}

async function start(sdk: ReturnType<typeof fakeSdk>) {
  const repo = tempDir("api");
  const dir = join(repo, "specs", "ledger");
  mkdirSync(join(dir, "context"), { recursive: true });
  writeFileSync(join(dir, "requirements.md"), "# R\n");
  writeFileSync(join(dir, "design.md"), "# D\n");
  writeFileSync(join(dir, "context", "hld.md"), "# HLD\n");
  writeFileSync(join(dir, "milestones.md"), "# M\n\n## M1. Core\n- Features:\n  - F1. Base: x. Docs: tasks. Needs: none. Status: not started.\n");
  const ui = tempDir("ui");
  writeFileSync(join(ui, "index.html"), "<!doctype html>");
  const project = { name: "ledger", dir };
  server = await startServer({ port: 0, projects: [project], current: project, uiDir: ui, repoRoot: repo, runQuery: sdk.run });
  return server;
}

const api = (s: RunningServer, path: string, init: RequestInit = {}) =>
  fetch(`${s.url}${path}`, { ...init, headers: { "X-Specyard-Token": s.token, ...init.headers } });
const settle = () => new Promise((r) => setTimeout(r, 50));

describe("runs api", () => {
  it("starts a skill run on a feature with the repo's context file paths", async () => {
    const sdk = fakeSdk([msg({ type: "result", subtype: "success", is_error: false, session_id: "s" })]);
    const s = await start(sdk);
    const res = await api(s, "/api/runs", { method: "POST", body: JSON.stringify({ kind: "to-tasks", target: "M1·F1" }) });
    expect(res.status).toBe(201);
    const { runId } = await res.json();
    await settle();
    expect(sdk.prompts[0]).toBe("/to-tasks M1 F1\n\nContext files: specs/ledger/context/hld.md\nAsk batched questions.");
    sdk.release();
    await settle();
    expect((await (await api(s, `/api/runs/${runId}`)).json()).run).toMatchObject({ id: runId, state: "done" });
  });

  it("shows the feature as running while its run goes, then lists the run", async () => {
    const sdk = fakeSdk([msg({ type: "result", subtype: "success", is_error: false, session_id: "s" })]);
    const s = await start(sdk);
    await api(s, "/api/runs", { method: "POST", body: JSON.stringify({ kind: "to-tasks", target: "M1·F1" }) });
    await api(s, "/api/runs", { method: "POST", body: JSON.stringify({ kind: "to-design", target: "M1" }) });
    await settle();
    const during = (await (await api(s, "/api/project")).json()).model;
    expect(during.features[0].stage).toBe("running");
    expect(during.runningRuns).toBe(2);
    sdk.release();
    await settle();
    const after = (await (await api(s, "/api/project")).json()).model;
    expect(after.features[0].stage).toBe("needs-tasks");
    expect(after.runningRuns).toBe(0);
    const runs = await (await api(s, "/api/runs?target=M1%C2%B7F1")).json();
    expect(runs).toHaveLength(1);
  });

  it("returns a run's events from its log", async () => {
    const sdk = fakeSdk([
      msg({ type: "assistant", parent_tool_use_id: null, session_id: "s", message: { content: [{ type: "text", text: "[read] tasks.md" }] } }),
      msg({ type: "result", subtype: "success", is_error: false, session_id: "s" }),
    ]);
    sdk.release();
    const s = await start(sdk);
    const { runId } = await (await api(s, "/api/runs", { method: "POST", body: JSON.stringify({ kind: "to-tasks", target: "M1·F1" }) })).json();
    await settle();
    const body = await (await api(s, `/api/runs/${runId}`)).json();
    expect(body.events.map((e: { kind: string }) => e.kind)).toEqual(["progress", "end"]);
  });

  it.each([
    ["an unknown skill", { kind: "rm-rf", target: "M1·F1" }],
    ["an unknown target", { kind: "to-tasks", target: "M9·F9" }],
    ["no body", undefined],
  ])("answers 400 for %s", async (_label, body) => {
    const s = await start(fakeSdk([]));
    expect((await api(s, "/api/runs", { method: "POST", body: body === undefined ? "" : JSON.stringify(body) })).status).toBe(400);
  });

  it("answers 500 and keeps serving when a run cannot start", async () => {
    const broken: QueryFn = () => {
      throw new Error("Claude Code not found");
    };
    const s = await start({ ...fakeSdk([]), run: broken });
    expect((await api(s, "/api/runs", { method: "POST", body: JSON.stringify({ kind: "to-tasks", target: "M1·F1" }) })).status).toBe(500);
    const [run] = await (await api(s, "/api/runs")).json();
    expect(run.state).toBe("failed");
  });

  it("answers 404 for an unknown run", async () => {
    const s = await start(fakeSdk([]));
    expect((await api(s, "/api/runs/nope")).status).toBe(404);
  });
});
