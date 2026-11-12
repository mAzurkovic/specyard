import type { Options, SDKMessage, SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { RunEvent } from "../../src/runs/events.js";
import { RunManager, type QueryFn } from "../../src/runs/RunManager.js";
import { tempDir } from "../helpers.js";

const msg = (m: object) => m as unknown as SDKMessage;
const say = (text: string) => msg({ type: "assistant", parent_tool_use_id: null, session_id: "sess-1", message: { content: [{ type: "text", text }] } });
const end = msg({ type: "result", subtype: "success", is_error: false, session_id: "sess-1" });

/** A stand-in for the SDK: records the options and every user message, and plays one scripted turn per message. */
function fakeQuery(turns: SDKMessage[][]) {
  const seen: { options?: Options; messages: string[] } = { messages: [] };
  const run: QueryFn = ({ prompt, options }) => {
    seen.options = options;
    return (async function* () {
      let turn = 0;
      for await (const user of prompt as AsyncIterable<SDKUserMessage>) {
        seen.messages.push(String(user.message.content));
        for (const m of turns[turn++] ?? []) yield m;
      }
    })();
  };
  return { run, seen };
}

function setup(turns: SDKMessage[][], context: string[] = [], specs = new Map<string, string>()) {
  const repo = tempDir("runs");
  const projectDir = join(repo, "specs", "ledger");
  const fake = fakeQuery(turns);
  const manager = new RunManager({ repoRoot: repo, projectDir, contextFiles: () => context, readSpecs: async () => new Map(specs), runQuery: fake.run });
  const events: { runId: string; event: RunEvent }[] = [];
  manager.subscribe((runId, event) => events.push({ runId, event }));
  return { manager, fake, projectDir, repo, events };
}

const settle = () => new Promise((r) => setTimeout(r, 30));

describe("RunManager.start", () => {
  it("sends the skill command as a user would type it, with context files and the batching hint", async () => {
    const { manager, fake, repo } = setup([[say("Done."), end]], ["specs/ledger/context/hld.md"]);
    await manager.start({ kind: "to-tasks", target: "M2·F1" });
    await settle();
    expect(fake.seen.messages[0]).toBe("/to-tasks M2 F1\n\nContext files: specs/ledger/context/hld.md\nAsk batched questions.");
    expect(fake.seen.options).toMatchObject({ cwd: repo, settingSources: ["user", "project", "local"] });
  });

  it("adds the comment and leaves out the target for a project-level skill", async () => {
    const { manager, fake } = setup([[end]]);
    await manager.start({ kind: "to-milestones", comment: "Keep it to 3 milestones." });
    await settle();
    expect(fake.seen.messages[0]).toBe("/to-milestones\n\nAsk batched questions.\n\nKeep it to 3 milestones.");
  });

  it("streams events to subscribers and finishes a run whose turn ends without a question", async () => {
    const { manager, events } = setup([[say("[read] tasks.md: 2 parents."), end]]);
    const run = await manager.start({ kind: "to-tasks", target: "M2·F1" });
    await settle();
    expect(events.map((e) => [e.runId, e.event.kind])).toEqual([
      [run.id, "progress"],
      [run.id, "end"],
    ]);
    expect(manager.get(run.id)).toMatchObject({ state: "done", sessionId: "sess-1", kind: "to-tasks", target: "M2·F1" });
  });

  it("waits with needs-you when the turn ends on a question, and continues on a reply", async () => {
    const question = "Q: Store keys hashed?\nRecommend: Yes, SHA-256.\nWhy: a leak shows hashes, not keys.";
    const { manager, fake } = setup([[say(question), end], [say("Writing tasks.md."), end]]);
    const run = await manager.start({ kind: "to-design", target: "M2·F3" });
    await settle();
    expect(manager.get(run.id)?.state).toBe("needs-you");
    manager.reply(run.id, "Yes");
    await settle();
    expect(fake.seen.messages[1]).toBe("Yes");
    expect(manager.get(run.id)?.state).toBe("done");
  });

  it("tells subscribers the run's new state together with the event that ends the turn", async () => {
    const question = "Q: Store keys hashed?\nRecommend: Yes.\nWhy: safer.";
    const { manager } = setup([[say(question), end]]);
    const seen: string[] = [];
    manager.subscribe((id, e) => e.kind === "end" && seen.push(manager.get(id)!.state));
    await manager.start({ kind: "to-design", target: "M2·F3" });
    await settle();
    expect(seen).toEqual(["needs-you"]);
  });

  it("marks a run failed when its turn ends with an error", async () => {
    const { manager } = setup([[msg({ type: "result", subtype: "error_during_execution", is_error: true, session_id: "s" })]]);
    const run = await manager.start({ kind: "to-tasks", target: "M1·F1" });
    await settle();
    expect(manager.get(run.id)?.state).toBe("failed");
  });

  it("marks a run failed, with the reason as text, when the SDK throws", async () => {
    const repo = tempDir("runs");
    const failing: QueryFn = () =>
      (async function* () {
        yield say("[read] starting");
        throw new Error("Claude Code process exited with code 1");
      })();
    const manager = new RunManager({ repoRoot: repo, projectDir: join(repo, "specs", "p"), contextFiles: () => [], readSpecs: async () => new Map(), runQuery: failing });
    const events: RunEvent[] = [];
    manager.subscribe((_id, e) => events.push(e));
    const run = await manager.start({ kind: "to-tasks", target: "M1·F1" });
    await settle();
    expect(manager.get(run.id)?.state).toBe("failed");
    expect(events.map((e) => e.kind)).toEqual(["progress", "text", "end"]);
    expect(events[1]).toMatchObject({ kind: "text", text: "Run stopped: Claude Code process exited with code 1" });
  });

  it("fails a run whose stream ends without a result, and tells subscribers", async () => {
    const repo = tempDir("runs");
    const cutShort: QueryFn = () =>
      (async function* () {
        yield say("[read] starting");
      })();
    const manager = new RunManager({ repoRoot: repo, projectDir: join(repo, "specs", "p"), contextFiles: () => [], readSpecs: async () => new Map(), runQuery: cutShort });
    const states: string[] = [];
    manager.subscribe((id, e) => e.kind === "end" && states.push(manager.get(id)!.state));
    const run = await manager.start({ kind: "to-tasks", target: "M1·F1" });
    await settle();
    expect(states).toEqual(["failed"]);
    expect(manager.get(run.id)?.state).toBe("failed");
  });

  it("keeps an ended run's changes as they were when it ended, not what later runs wrote", async () => {
    const specs = new Map([["m1-a/f1-b/tasks.md", "# T old\n"]]);
    const { manager, projectDir } = setup([[end]], [], specs);
    const run = await manager.start({ kind: "to-tasks", target: "M1·F1" });
    specs.set("m1-a/f1-b/tasks.md", "# T by this run\n");
    await settle();
    specs.set("m1-a/f2-c/design.md", "# D by a later run\n");
    const expected = [{ path: "m1-a/f1-b/tasks.md", before: "# T old\n", after: "# T by this run\n" }];
    expect(await manager.changes(run.id)).toEqual(expected);
    const reopened = new RunManager({ repoRoot: tempDir("runs"), projectDir, contextFiles: () => [], readSpecs: async () => new Map(specs) });
    expect(await reopened.changes(run.id)).toEqual(expected);
  });

  it("marks the run failed and passes on the error when the spec files cannot be read", async () => {
    const repo = tempDir("runs");
    const manager = new RunManager({ repoRoot: repo, projectDir: join(repo, "specs", "p"), contextFiles: () => [], readSpecs: () => Promise.reject(new Error("EACCES")), runQuery: fakeQuery([]).run });
    await expect(manager.start({ kind: "to-tasks", target: "M1·F1" })).rejects.toThrow("EACCES");
    expect(manager.list()[0]?.state).toBe("failed");
  });

  it("refuses a reply to a run that is not waiting for one", async () => {
    const { manager } = setup([[say("Done."), end]]);
    const run = await manager.start({ kind: "to-tasks", target: "M1·F1" });
    await settle();
    expect(manager.reply(run.id, "Yes")).toBe(false);
    expect(manager.reply("no-such-run", "Yes")).toBe(false);
  });

  it("keeps the run log in a gitignored folder of the project", async () => {
    const { manager, projectDir } = setup([[say("[read] x"), end]]);
    const run = await manager.start({ kind: "to-tasks", target: "M1·F1" });
    await settle();
    const dir = join(projectDir, ".specyard", "runs", run.id);
    expect(readFileSync(join(projectDir, ".specyard", ".gitignore"), "utf8")).toBe("*\n");
    expect(JSON.parse(readFileSync(join(dir, "run.json"), "utf8"))).toMatchObject({ id: run.id, state: "done", sessionId: "sess-1" });
    expect(readFileSync(join(dir, "events.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l).kind)).toEqual(["progress", "end"]);
  });

  it("reports the spec files a run changed, added or removed, with their text before and after", async () => {
    const specs = new Map([["design.md", "# D\n"], ["m1-a/f1-b/tasks.md", "# T old\n"], ["notes.md", "# gone\n"]]);
    const { manager } = setup([[end]], [], specs);
    const run = await manager.start({ kind: "to-tasks", target: "M1·F1" });
    specs.set("m1-a/f1-b/tasks.md", "# T new\n");
    specs.set("m1-a/f2-c/tasks.md", "# T added\n");
    specs.delete("notes.md");
    await settle();
    expect(await manager.changes(run.id)).toEqual([
      { path: "m1-a/f1-b/tasks.md", before: "# T old\n", after: "# T new\n" },
      { path: "m1-a/f2-c/tasks.md", before: null, after: "# T added\n" },
      { path: "notes.md", before: "# gone\n", after: null },
    ]);
  });

  it("keeps a copy of each spec file in the run's before/ folder", async () => {
    const specs = new Map([["design.md", "# D\n"], ["m1-a/f1-b/tasks.md", "# T old\n"]]);
    const { manager, projectDir } = setup([[end]], [], specs);
    const run = await manager.start({ kind: "to-tasks", target: "M1·F1" });
    await settle();
    const before = join(projectDir, ".specyard", "runs", run.id, "before");
    expect(readFileSync(join(before, "design.md"), "utf8")).toBe("# D\n");
    expect(readFileSync(join(before, "m1-a", "f1-b", "tasks.md"), "utf8")).toBe("# T old\n");
  });

  it("reopens earlier runs and their events after a restart; a run cut off by the restart shows as failed", async () => {
    const question = "Q: Store keys hashed?\nRecommend: Yes.\nWhy: safer.";
    const { manager, projectDir, repo } = setup([[say("[read] x"), end]]);
    const done = await manager.start({ kind: "to-tasks", target: "M1·F1" });
    await settle();
    const waiting = new RunManager({ repoRoot: repo, projectDir, contextFiles: () => [], readSpecs: async () => new Map(), runQuery: fakeQuery([[say(question), end]]).run });
    const cut = await waiting.start({ kind: "to-design", target: "M1·F2" });
    await settle();
    const reopened = new RunManager({ repoRoot: repo, projectDir, contextFiles: () => [], readSpecs: async () => new Map(), runQuery: fakeQuery([]).run });
    expect(reopened.get(done.id)).toMatchObject({ state: "done", kind: "to-tasks", sessionId: "sess-1" });
    expect((await reopened.events(done.id)).map((e) => e.kind)).toEqual(["progress", "end"]);
    expect(reopened.get(cut.id)?.state).toBe("failed");
    expect(reopened.list().map((r) => r.id).sort()).toEqual([done.id, cut.id].sort());
  });

  it("skips a damaged run log at restart and still loads the others", async () => {
    const { manager, projectDir, repo } = setup([[end]]);
    const done = await manager.start({ kind: "to-tasks", target: "M1·F1" });
    await settle();
    mkdirSync(join(projectDir, ".specyard", "runs", "broken"), { recursive: true });
    writeFileSync(join(projectDir, ".specyard", "runs", "broken", "run.json"), '{"id": "bro');
    const reopened = new RunManager({ repoRoot: repo, projectDir, contextFiles: () => [], readSpecs: async () => new Map() });
    expect(reopened.list().map((r) => r.id)).toEqual([done.id]);
  });

  it("lists runs, newest first, filtered by target", async () => {
    const { manager } = setup([[end]]);
    const a = await manager.start({ kind: "to-tasks", target: "M1·F1" });
    await settle();
    const b = await manager.start({ kind: "expert-review", target: "M1·F1" });
    await settle();
    await manager.start({ kind: "to-tasks", target: "M1·F2" });
    await settle();
    expect(manager.list("M1·F1").map((r) => r.id)).toEqual([b.id, a.id]);
  });
});
