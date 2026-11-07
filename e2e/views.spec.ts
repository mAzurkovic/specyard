import { expect, test, type Page } from "@playwright/test";
import { resolveProject } from "../src/projects.js";
import { startServer, type RunningServer } from "../src/server.js";
import { repoWithFiles, uiDist } from "./fixtures.js";

const milestones = `# Ledger — Milestones

## M1. Ledger core
- Needs: none.
- Features:
  - F1. Postings: two entries per write. Docs: tasks. Needs: none. Status: done.
  - F2. Idempotent writes: same key, same result. Docs: tasks. Needs: F1. Status: not started.
  - F3. CI: pipeline. Docs: tasks. Needs: none. Status: not started.

## M2. Accounts API
- Needs: M1.
- Features:
  - F1. Create account: POST /accounts. Docs: tasks. Needs: M1 F2. Status: not started.
  - F2. Transfers: move money. Docs: design, tasks. Needs: F1. Status: not started.
`;
const tasks = `# Idempotent writes — Tasks

Status: approved a41f09c2e7b1

## 1. Keyed writes [serial]
- [x] 1.1 Store the key.
- [ ] 1.2 Return the first result.

## 2. Reject a changed body [parallel, needs 1]
- [ ] 2.1 Same key, other body gives 409.
`;
const progress = `| Task | Status | Attempts | Last failure |
|---|---|---|---|
| 1.1 | done | 2 | |
| 1.2 | fail | 3 | timeout |
| X1 | done | 1 | verify #2: duplicate key gave 500 |
`;

let server: RunningServer | undefined;
test.afterEach(async () => server?.close());

async function open(page: Page, hash = "", tasksText = tasks) {
  const repo = repoWithFiles({
    "requirements.md": "# R\n",
    "design.md": "# D\n",
    "milestones.md": milestones,
    "m1-ledger-core/f2-idempotent-writes/tasks.md": tasksText,
    "m1-ledger-core/f2-idempotent-writes/progress.md": progress,
  });
  const choice = resolveProject(repo, undefined);
  if (choice.kind !== "selected") throw new Error("fixture has one project");
  server = await startServer({ port: 0, projects: choice.projects, current: choice.project, uiDir: uiDist });
  await page.goto(`${server.url}/?t=${server.token}${hash}`);
}

test("graph shows every feature, every edge and the critical path", async ({ page }) => {
  await open(page);
  await expect(page.locator("[data-feature]")).toHaveCount(5);
  for (const edge of ["M1·F1>M1·F2", "M1·F2>M2·F1", "M2·F1>M2·F2"]) await expect(page.locator(`[data-edge="${edge}"]`)).toHaveCount(1);
  await expect(page.locator("path.edges.crit")).toHaveCount(2);
  await expect(page.locator('[data-feature="M1·F1"]')).toContainText("done");
  await expect(page.locator('[data-feature="M2·F2"]')).toContainText("needs design");
});

test("clicking a node selects it and shows what it unblocks", async ({ page }) => {
  await open(page);
  await page.locator('[data-feature="M1·F2"]').click();
  await expect(page.getByText("Selected: M1·F2 Idempotent writes")).toBeVisible();
  await expect(page.getByText("Unblocks: M2·F1")).toBeVisible();
});

test("list shows tasks with their state icons, attempts and fix tasks", async ({ page }) => {
  await open(page, "#/list");
  await page.locator('[data-feature-row="M1·F2"]').click();
  const icon = (task: string) => page.locator(`[data-task="M1·F2/${task}"] [data-icon]`);
  await expect(icon("1.1")).toHaveAttribute("data-icon", "done");
  await expect(icon("1.2")).toHaveAttribute("data-icon", "failed");
  await expect(icon("2.1")).toHaveAttribute("data-icon", "wait");
  await expect(icon("X1")).toHaveAttribute("data-icon", "fix");
  await expect(page.locator('[data-task="M1·F2/1.1"]')).toContainText("2 attempts");
  await expect(page.locator('[data-milestone="M1"]')).toContainText("1 of 3 done");
});

test("the toggle switches between graph and list", async ({ page }) => {
  await open(page);
  await page.locator(".seg a", { hasText: "List" }).click();
  await expect(page.locator("[data-milestone]")).toHaveCount(2);
  await page.locator(".seg a", { hasText: "Graph" }).click();
  await expect(page.locator("[data-feature]")).toHaveCount(5);
});

test("the header shows running and needs-you counts on every view", async ({ page }) => {
  await open(page);
  await expect(page.locator("header [data-count=running]")).toHaveText("0 running");
  await expect(page.locator("header [data-count=needs-you]")).toHaveText("0 need you");
  await page.locator(".seg a", { hasText: "List" }).click();
  await expect(page.locator("header [data-count=running]")).toHaveText("0 running");
});

test("the list summary shows task totals, the graph summary shows feature totals", async ({ page }) => {
  await open(page, "#/list");
  await expect(page.locator("[data-summary]")).toHaveText("2 milestones · 5 features · 3 tasks · 1 done");
  await page.locator(".seg a", { hasText: "Graph" }).click();
  await expect(page.locator("[data-summary]")).toHaveText("2 milestones · 5 features · 1 done");
});

test("a broken tasks.md shows an error badge on its feature and a line in the issues panel", async ({ page }) => {
  await open(page, "", tasks.replace("[parallel, needs 1]", "[whenever]"));
  await expect(page.locator('[data-feature="M1·F2"] [data-error]')).toHaveText("1 error");
  await expect(page.locator('[data-feature="M1·F1"] [data-error]')).toHaveCount(0);
  const panel = page.locator("[data-issues]");
  await expect(panel).toContainText("m1-ledger-core/f2-idempotent-writes/tasks.md:9");
  await expect(panel).toContainText("expected a tag like");
  await page.locator(".seg a", { hasText: "List" }).click();
  await expect(page.locator('[data-feature-row="M1·F2"] [data-error]')).toHaveText("1 error");
});

test("no issues panel when every file parses", async ({ page }) => {
  await open(page);
  await expect(page.locator("[data-feature]").first()).toBeVisible();
  await expect(page.locator("[data-issues]")).toHaveCount(0);
});

test("keyboard: Space selects a node and Enter opens it", async ({ page }) => {
  await open(page);
  const node = page.locator('[data-feature="M1·F2"]');
  await node.focus();
  await page.keyboard.press(" ");
  await expect(page.getByText("Selected: M1·F2 Idempotent writes")).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#\/f\/M1%C2%B7F2$/);
});
