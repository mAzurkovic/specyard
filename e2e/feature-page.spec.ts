import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { startServer, type RunningServer } from "../src/server.js";
import { uiDist } from "./fixtures.js";

const MILESTONES = `# Ledger — Milestones

## M1. Ledger core
- Delivers: double-entry \`postings\`.
- Exit criteria:
  - Every write posts two entries.
  - A replayed write posts nothing.
- Needs: none.
- Features:
  - F1. Postings: two entries per write. Docs: tasks. Needs: none. Status: done.
  - F2. Idempotent writes: same key, same result. Docs: design, tasks. Needs: F1. Status: not started.
`;

const TASKS = `# Postings — Tasks

Status: draft

## 1. Write path [serial]
- [x] 1.1 Post both entries.
- [ ] 1.2 Reject <script>window.injected = true</script> input.
`;

const FULL = {
  "requirements.md": "# Ledger — Requirements\n",
  "design.md": "# Ledger — Design\n",
  "milestones.md": MILESTONES,
  "m1-ledger-core/f1-postings/tasks.md": TASKS,
  "context/hld.md": "# HLD\n",
};

let server: RunningServer | undefined;
test.afterEach(async () => server?.close());

/** Starts the server on a temp `specs/ledger` holding `files`, opens the UI at `hash`, and returns the project folder. */
async function open(page: Page, files: Record<string, string>, hash = ""): Promise<string> {
  const dir = join(mkdtempSync(join(tmpdir(), "specyard-e2e-")), "specs", "ledger");
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), text);
  }
  const project = { name: "ledger", dir };
  server = await startServer({ port: 0, projects: [project], current: project, uiDir: uiDist });
  await page.goto(`${server.url}/?t=${server.token}${hash}`);
  return dir;
}

test("opens a feature from the sidebar and renders its spec files in tabs", async ({ page }) => {
  const dir = await open(page, FULL);
  await page.locator("nav.side").getByRole("link", { name: "F1 Postings" }).click();

  await expect(page.locator("main .crumb")).toContainText("ledger › M1 Ledger core › m1-ledger-core/f1-postings/");
  await expect(page.locator("main > h2, main > .row > h2")).toHaveText("F1 Postings");
  await expect(page.locator("main .badge")).toHaveText("done");
  await expect(page.locator("main .steps .done")).toHaveCount(5);
  await expect(page.getByRole("tab")).toHaveText(["Requirements", "Design", "Tasks", "Run", "Evidence"]);

  const body = page.locator("main .md");
  await expect(body.locator("h1")).toHaveText("Postings — Tasks");
  await expect(body.locator("input[type=checkbox]")).toHaveCount(2);
  await expect(body).toContainText("Reject <script>window.injected = true</script> input.");
  expect(await page.evaluate(() => (window as { injected?: boolean }).injected)).toBeUndefined();

  writeFileSync(join(dir, "m1-ledger-core/f1-postings/tasks.md"), TASKS.replace("Post both entries.", "Post both entries in one transaction."));
  await expect(body).toContainText("Post both entries in one transaction.");

  for (const [tab, text] of [["Requirements", "Not needed"], ["Design", "Not needed"], ["Run", "No runs yet"], ["Evidence", "No runs yet"]]) {
    await page.getByRole("tab", { name: tab }).click();
    await expect(page.getByRole("tab", { name: tab })).toHaveAttribute("aria-selected", "true");
    await expect(page.locator("main .tab-body")).toHaveText(text!);
  }
});

test("a tab for a file the feature lists but does not have says how to write it", async ({ page }) => {
  await open(page, FULL, "#/f/M1·F2/design");
  await expect(page.locator("main .badge")).toHaveText("needs design");
  await expect(page.locator("main .steps .now")).toHaveText("● Design");
  await expect(page.locator("main .tab-body")).toContainText("Not written yet: run /to-design M1 F2");
  await expect(page.locator("main .tab-body").getByRole("button", { name: "Run" })).toBeVisible();
  await page.getByRole("tab", { name: "Tasks" }).click();
  await expect(page.locator("main .tab-body")).toContainText("Not written yet: run /to-tasks M1 F2");
  await page.getByRole("tab", { name: "Requirements" }).click();
  await expect(page.locator("main .tab-body")).toHaveText("Not needed");
});

test("a milestone page shows what it delivers, its exit criteria and its features with stages", async ({ page }) => {
  await open(page, FULL);
  await page.locator("nav.side").getByRole("link", { name: "M1 Ledger core" }).click();
  await expect(page.locator("main > h2, main > .row > h2")).toHaveText("M1 Ledger core");
  await expect(page.locator("main .delivers")).toHaveText("double-entry postings.");
  await expect(page.locator("main .delivers code")).toHaveText("postings");
  await expect(page.locator("main .exit li")).toHaveText(["Every write posts two entries.", "A replayed write posts nothing."]);
  const rows = page.locator("main tbody tr");
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText("F1 Postings");
  await expect(rows.nth(0).locator(".badge")).toHaveText("done");
  await expect(rows.nth(1).locator(".badge")).toHaveText("needs design");
  await rows.nth(1).getByRole("link", { name: "F2 Idempotent writes" }).click();
  await expect(page.locator("main > h2, main > .row > h2")).toHaveText("F2 Idempotent writes");
});

test("an unknown feature or milestone says so", async ({ page }) => {
  await open(page, FULL, "#/f/M9·F9");
  await expect(page.locator("main")).toContainText("No feature M9·F9");
  await page.goto(`${server!.url}/?t=${server!.token}#/m/M9`);
  await expect(page.locator("main")).toContainText("No milestone M9");
});

// A missing required file or a missing milestones.md makes the project page the start page.
for (const { label, files, hash, command, other } of [
  { label: "no requirements.md, at the start page", files: { "design.md": "# D\n" }, hash: "", command: "/to-brd", other: undefined },
  { label: "no design.md, at the start page", files: { "requirements.md": "# R\n" }, hash: "", command: "/to-design", other: undefined },
  { label: "no design.md, milestones.md already there, at the start page", files: { "requirements.md": "# R\n", "milestones.md": MILESTONES }, hash: "", command: "/to-design", other: undefined },
  { label: "no milestones.md, at the start page", files: { "requirements.md": "# R\n", "design.md": "# D\n" }, hash: "", command: "/to-milestones", other: "/to-tasks" },
]) {
  test(`${label}: the next step is ${command}`, async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await open(page, files, hash);
    const next = page.locator("main .next");
    await expect(next.locator("code")).toHaveText(other ? [command, other] : [command]);
    if (other) await expect(next).toContainText("one task list with /to-tasks");
    for (const later of ["/to-milestones", "/to-tasks", "/implement-feature"].filter((c) => c !== command && c !== other)) {
      await expect(page.locator("main")).not.toContainText(later);
    }
    await next.getByRole("button", { name: `Copy ${command}` }).click();
    await expect(next.getByRole("button", { name: `Copy ${command}` })).toHaveText("Copied");
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(command);
  });
}

test("the project page groups the required, plan and context files", async ({ page }) => {
  await open(page, { "requirements.md": "# R\n", "design.md": "# D\n", "context/hld.md": "# HLD\n", "mocks/01.html": "<p>x</p>" }, "#/project");
  const rows = page.locator("main .files tr");
  await expect(rows).toHaveText([
    "Required",
    /requirements\.md\s*found/,
    /design\.md\s*found/,
    /Plan/,
    /milestones\.md\s*not found/,
    /Context/,
    /context\/hld\.md\s*6 B/,
    /mocks\/01\.html\s*8 B/,
  ]);
});

test("with every project file present the start page is not the project page", async ({ page }) => {
  await open(page, FULL);
  await expect(page.locator("header .proj")).toContainText("ledger");
  await expect(page.locator("main .files")).toHaveCount(0);
  await page.locator("nav.side").getByRole("link", { name: "requirements.md" }).click();
  await expect(page.locator("main .files")).toBeVisible();
  await expect(page.locator("main .next")).toHaveCount(0);
});

test("adding a context file lists it, and a refused file says why", async ({ page }) => {
  await open(page, FULL, "#/project");
  const input = page.locator("main input[type=file]");
  await input.setInputFiles({ name: "notes.md", mimeType: "text/markdown", buffer: Buffer.from("# Notes\n") });
  await expect(page.locator("main .files")).toContainText("context/notes.md");
  await expect(page.locator("nav.side")).toContainText("context/notes.md");

  await input.setInputFiles({ name: "notes.md", mimeType: "text/markdown", buffer: Buffer.from("# Again\n") });
  await expect(page.locator("main [role=alert]")).toHaveText("context/notes.md already exists");
  await input.setInputFiles({ name: "run.sh", mimeType: "text/x-sh", buffer: Buffer.from("echo\n") });
  await expect(page.locator("main [role=alert]")).toHaveText("run.sh: only Markdown, PDF and images can be added");

  await page.locator("nav.side input[type=file]").setInputFiles({ name: "flow.png", mimeType: "image/png", buffer: Buffer.from([0x89, 0x50]) });
  await expect(page.locator("nav.side")).toContainText("context/flow.png");
  await expect(page.locator("nav.side [role=alert]")).toHaveCount(0);
});

test("the add context file control works from the keyboard", async ({ page }) => {
  await open(page, { "requirements.md": "# R\n", "design.md": "# D\n" }, "#/project");
  const add = page.locator("main").getByRole("button", { name: "+ Add context file" });
  await add.focus();
  const chooser = page.waitForEvent("filechooser");
  await page.keyboard.press("Enter");
  expect((await chooser).isMultiple()).toBe(false);
});
