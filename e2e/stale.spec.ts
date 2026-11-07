import { expect, test, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { hashText } from "../src/hashes.js";
import { startServer, type RunningServer } from "../src/server.js";
import { uiDist } from "./fixtures.js";

const designV1 = "# Ledger — Design\n\nStatement period: calendar month, server time zone.\n";
const designV2 = "# Ledger — Design\n\nStatement period: calendar month in the account's time zone.\n";
const milestones = `# Ledger — Milestones

## M1. Statements
- Needs: none.
- Features:
  - F1. Monthly statement: one per account. Docs: tasks. Needs: none. Status: not started.
  - F2. PDF export: a file per statement. Docs: tasks. Needs: F1. Status: not started.
`;

/** A git repo whose committed design built both task lists; then the design changes without a commit. */
function staleRepo(milestonesFromDesign = false): string {
  const root = mkdtempSync(join(tmpdir(), "specyard-stale-"));
  const dir = join(root, "specs", "ledger");
  const write = (path: string, text: string) => {
    mkdirSync(join(dir, path, ".."), { recursive: true });
    writeFileSync(join(dir, path), text);
  };
  write("requirements.md", "# Ledger — Requirements\n");
  write("design.md", designV1);
  write("milestones.md", milestonesFromDesign ? milestones.replace("# Ledger — Milestones\n", `# Ledger — Milestones\n\n<!-- sources: design.md ${hashText(designV1)} -->\n`) : milestones);
  write("m1-statements/f1-monthly-statement/tasks.md", `# Monthly statement — Tasks\n\n<!-- sources: ../../design.md ${hashText(designV1)} -->\nStatus: draft\n\n## 1. Build it [serial]\n- [ ] 1.1 Do it.\n`);
  const git = (...args: string[]) => execFileSync("git", ["-C", root, ...args], { stdio: "pipe" });
  git("init", "-q");
  git("-c", "user.email=t@example.com", "-c", "user.name=t", "add", ".");
  git("-c", "user.email=t@example.com", "-c", "user.name=t", "commit", "-q", "-m", "specs");
  write("design.md", designV2);
  return dir;
}

let server: RunningServer | undefined;
test.afterEach(async () => server?.close());

async function open(page: Page, hash = "", milestonesFromDesign = false) {
  const dir = staleRepo(milestonesFromDesign);
  const project = { name: "ledger", dir };
  server = await startServer({ port: 0, projects: [project], current: project, uiDir: uiDist });
  await page.goto(`${server.url}/?t=${server.token}${hash}`);
}

test("a feature built from a changed design shows stale in the graph, the list and the header", async ({ page }) => {
  await open(page);
  await expect(page.locator('[data-feature="M1·F1"] [data-stale]')).toBeVisible();
  await expect(page.locator('[data-feature="M1·F2"] [data-stale]')).toHaveCount(0);
  await expect(page.locator("header [data-count=stale]")).toHaveText("1 stale");
  await page.locator(".seg a", { hasText: "List" }).click();
  await expect(page.locator('[data-feature-row="M1·F1"] [data-stale]')).toBeVisible();
});

test("the stale page shows the design change from git history, and mark as not affected clears it", async ({ page }) => {
  await open(page);
  await page.locator("header [data-count=stale]").click();
  await expect(page.locator("main h2")).toContainText("m1-statements/f1-monthly-statement/tasks.md");
  await expect(page.locator('[data-diff="del"]')).toContainText("server time zone");
  await expect(page.locator('[data-diff="add"]')).toContainText("the account's time zone");
  await page.getByRole("button", { name: "Mark as not affected" }).click();
  await expect(page.locator("header [data-count=stale]")).toHaveText("0 stale");
  await expect(page.getByText("not stale")).toBeVisible();
});

test("the feature page links its stale file to the stale page", async ({ page }) => {
  await open(page, `#/f/${encodeURIComponent("M1·F1")}`);
  await page.getByRole("link", { name: /Review the change/ }).click();
  await expect(page).toHaveURL(/#\/stale\//);
});

test("the sidebar marks a stale feature and links a stale project file to its stale page", async ({ page }) => {
  await open(page, `#/f/${encodeURIComponent("M1·F2")}`, true);
  await expect(page.locator(".side a.sub", { hasText: "F1 Monthly statement" }).locator(".dot.stale")).toHaveCount(1);
  await expect(page.locator(".side a.sub", { hasText: "F2 PDF export" }).locator(".dot.stale")).toHaveCount(0);
  await expect(page.locator(".side a", { hasText: "milestones.md" })).toHaveAttribute("href", "#/stale/milestones.md");
  await expect(page.locator(".side a", { hasText: "design.md" })).toHaveAttribute("href", "#/project");
});
