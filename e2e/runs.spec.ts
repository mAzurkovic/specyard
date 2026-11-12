import type { SDKMessage, SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";
import { expect, test } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { QueryFn } from "../src/runs/RunManager.js";
import { startServer, type RunningServer } from "../src/server.js";
import { repoWithFiles, uiDist } from "./fixtures.js";

const msg = (m: object) => m as unknown as SDKMessage;
const say = (text: string) => msg({ type: "assistant", parent_tool_use_id: null, session_id: "s", message: { content: [{ type: "text", text }] } });

/** Stands in for Claude Code running /to-tasks: prints progress, writes the task list, ends the turn. */
function fakeToTasks(projectDir: string, prompts: string[]): QueryFn {
  return ({ prompt }) =>
    (async function* () {
      for await (const user of prompt as AsyncIterable<SDKUserMessage>) {
        prompts.push(String(user.message.content));
        yield say("[read] design.md: 1 component.");
        const dir = join(projectDir, "m1-core", "f1-base");
        mkdirSync(dir, { recursive: true });
        writeFileSync(join(dir, "tasks.md"), "# Base — Tasks\n\n## 1. Build it [serial]\n- [ ] 1.1 Do the thing.\n");
        yield say("Wrote tasks.md with 1 parent and 1 task.");
        yield msg({ type: "result", subtype: "success", is_error: false, session_id: "s" });
      }
    })();
}

let server: RunningServer | undefined;
test.afterEach(async () => server?.close());

test("run /to-tasks from the feature page, see its events and the diff of the file it wrote, then re-run with a comment", async ({ page }) => {
  const repo = repoWithFiles({
    "requirements.md": "# R\n",
    "design.md": "# D\n",
    "milestones.md": "# M\n\n## M1. Core\n- Features:\n  - F1. Base: x. Docs: tasks. Needs: none. Status: not started.\n",
  });
  const projectDir = join(repo, "specs", "ledger");
  const prompts: string[] = [];
  const project = { name: "ledger", dir: projectDir };
  server = await startServer({ port: 0, projects: [project], current: project, uiDir: uiDist, repoRoot: repo, runQuery: fakeToTasks(projectDir, prompts) });
  await page.goto(`${server.url}/?t=${server.token}#/f/${encodeURIComponent("M1·F1")}/tasks`);

  await page.locator("main .tab-body").getByRole("button", { name: "Run" }).click();
  await expect(page).toHaveURL(/\/run$/);
  await expect(page.locator("[data-run-state]")).toHaveText("done");
  await expect(page.locator("[data-run-events]")).toContainText("[read] design.md: 1 component.");
  await expect(page.locator('[data-change="m1-core/f1-base/tasks.md"]')).toContainText("added");
  await expect(page.locator('[data-change="m1-core/f1-base/tasks.md"] [data-diff="add"]').first()).toContainText("# Base — Tasks");
  expect(prompts[0]).toBe("/to-tasks M1 F1\n\nAsk batched questions.");

  await page.getByLabel("Comment for the re-run").fill("Split building and testing into two parents.");
  await page.getByRole("button", { name: "Re-run /to-tasks" }).click();
  await expect.poll(() => prompts.length).toBe(2);
  expect(prompts[1]).toBe("/to-tasks M1 F1\n\nAsk batched questions.\n\nSplit building and testing into two parents.");
});

test("a milestone page runs /to-design, /to-tasks and /expert-review on that milestone", async ({ page }) => {
  const repo = repoWithFiles({
    "requirements.md": "# R\n",
    "design.md": "# D\n",
    "milestones.md": "# M\n\n## M1. Core\n- Delivers: x.\n- Features:\n  - F1. Base: x. Docs: tasks. Needs: none. Status: not started.\n",
  });
  const projectDir = join(repo, "specs", "ledger");
  const prompts: string[] = [];
  const project = { name: "ledger", dir: projectDir };
  server = await startServer({ port: 0, projects: [project], current: project, uiDir: uiDist, repoRoot: repo, runQuery: fakeToTasks(projectDir, prompts) });
  await page.goto(`${server.url}/?t=${server.token}#/m/M1`);
  for (const kind of ["to-design", "to-tasks", "expert-review"]) await expect(page.getByRole("button", { name: `Run /${kind}` })).toBeVisible();
  await page.getByRole("button", { name: "Run /to-tasks" }).click();
  await expect(page).toHaveURL(/#\/run\//);
  await expect.poll(() => prompts[0]).toBe("/to-tasks M1\n\nAsk batched questions.");
});
