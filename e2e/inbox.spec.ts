import type { CanUseTool, SDKMessage, SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";
import { expect, test } from "@playwright/test";
import { join } from "node:path";
import type { QueryFn } from "../src/runs/RunManager.js";
import { startServer, type RunningServer } from "../src/server.js";
import { repoWithFiles, uiDist } from "./fixtures.js";

const msg = (m: object) => m as unknown as SDKMessage;
const say = (text: string) => msg({ type: "assistant", parent_tool_use_id: null, session_id: "s", message: { content: [{ type: "text", text }] } });
const end = msg({ type: "result", subtype: "success", is_error: false, session_id: "s" });

const batch = [
  "Batch 1 of 1: three independent questions.",
  "",
  "Q: How do clients authenticate?",
  "Recommend: An API key per client.",
  "Why: all callers are internal services.",
  "",
  "Q: Where are the keys stored?",
  "Recommend: A SHA-256 hash in the accounts table.",
  "",
  "Q: How does rotation work?",
  "Recommend: Two active keys per client.",
  "Why: clients rotate with no downtime.",
].join("\n");

const files = {
  "requirements.md": "# R\n",
  "design.md": "# D\n",
  "milestones.md": "# M\n\n## M1. Core\n- Features:\n  - F1. Auth: API keys. Docs: design, tasks. Needs: none. Status: not started.\n",
};

let server: RunningServer | undefined;
test.afterEach(async () => server?.close());

test("a batch of three questions shows as one inbox item; accept all and submit resumes the run with the three answers", async ({ page }) => {
  const prompts: string[] = [];
  const runQuery: QueryFn = ({ prompt }) =>
    (async function* () {
      for await (const user of prompt as AsyncIterable<SDKUserMessage>) {
        prompts.push(String(user.message.content));
        yield say(prompts.length === 1 ? batch : "[read] answers: 3. Writing design.md.");
        yield end;
      }
    })();
  const repo = repoWithFiles(files);
  const project = { name: "ledger", dir: join(repo, "specs", "ledger") };
  server = await startServer({ port: 0, projects: [project], current: project, uiDir: uiDist, repoRoot: repo, runQuery });
  await page.goto(`${server.url}/?t=${server.token}#/m/M1`);
  await page.getByRole("button", { name: "Run /to-design" }).click();

  await expect(page.locator('[data-count="needs-you"]')).toHaveText("1 need you");
  await expect(page).toHaveTitle("(1) specyard");
  await page.locator('[data-count="needs-you"]').click();
  await expect(page.locator("[data-inbox-item]")).toHaveCount(1);
  await expect(page.locator("[data-inbox-item]")).toContainText("3 questions");
  await expect(page.locator("[data-question]")).toHaveCount(3);
  await expect(page.locator("[data-question]").first()).toContainText("Why: all callers are internal services.");

  const submit = page.getByRole("button", { name: "Submit and resume" });
  await page.getByLabel("Your answer to: Where are the keys stored?").fill("In the secrets manager.");
  await expect(page.locator("[data-answered]")).toHaveText("1 of 3 answered");
  await expect(submit).toBeDisabled();
  await page.getByRole("button", { name: "Accept all recommendations" }).click();
  await expect(page.locator("[data-answered]")).toHaveText("3 of 3 answered");
  await submit.click();

  await expect.poll(() => prompts[1]).toBe(
    "How do clients authenticate? An API key per client.\nWhere are the keys stored? In the secrets manager.\nHow does rotation work? Two active keys per client.",
  );
  await expect(page.getByText("Nothing waits for you.")).toBeVisible();
  await expect(page).toHaveTitle("specyard");
});

test("a tool call that needs permission waits in the inbox until it is approved", async ({ page }) => {
  const results: string[] = [];
  const runQuery: QueryFn = ({ prompt, options }) =>
    (async function* () {
      for await (const _ of prompt as AsyncIterable<SDKUserMessage>) {
        const result = await (options.canUseTool as CanUseTool)("Bash", { command: "npm test" }, { signal: new AbortController().signal, title: "Claude wants to run npm test", toolUseID: "t" } as Parameters<CanUseTool>[2]);
        results.push(result!.behavior);
        yield end;
      }
    })();
  const repo = repoWithFiles(files);
  const project = { name: "ledger", dir: join(repo, "specs", "ledger") };
  server = await startServer({ port: 0, projects: [project], current: project, uiDir: uiDist, repoRoot: repo, runQuery });
  await page.goto(`${server.url}/?t=${server.token}#/m/M1`);
  await page.getByRole("button", { name: "Run /to-design" }).click();
  await expect(page.getByRole("link", { name: "Answer in the inbox" })).toBeVisible();
  await page.getByRole("link", { name: "Answer in the inbox" }).click();
  await expect(page.locator("[data-approval]")).toHaveText("Claude wants to run npm test");
  await page.getByRole("button", { name: "Approve" }).click();
  await expect.poll(() => results).toEqual(["allow"]);
  await expect(page.locator('[data-count="needs-you"]')).toHaveText("0 need you");
});
