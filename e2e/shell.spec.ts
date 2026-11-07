import { expect, test } from "@playwright/test";
import { resolveProject } from "../src/projects.js";
import { startServer, type RunningServer } from "../src/server.js";
import { repoWithProjects, uiDist } from "./fixtures.js";

let server: RunningServer | undefined;
test.afterEach(async () => server?.close());

async function open(page: import("@playwright/test").Page, names: string[]) {
  const choice = resolveProject(repoWithProjects(names), undefined);
  if (choice.kind === "error") throw new Error(choice.message);
  server = await startServer({
    port: 0,
    projects: choice.projects,
    current: choice.kind === "selected" ? choice.project : null,
    uiDir: uiDist,
  });
  await page.goto(`${server.url}/?t=${server.token}`);
}

test("one project shows its name in the header", async ({ page }) => {
  await open(page, ["ledger"]);
  await expect(page.locator("header .proj")).toContainText("ledger");
});

test("several projects show a picker that selects one", async ({ page }) => {
  await open(page, ["api", "ledger"]);
  await expect(page.getByText("Pick a project")).toBeVisible();
  await page.getByRole("button", { name: "api" }).click();
  await expect(page.locator("header .proj")).toContainText("api");
});

test("no project shows the empty state", async ({ page }) => {
  await open(page, []);
  await expect(page.getByText("No project in specs/")).toBeVisible();
  await expect(page.getByText("/to-brd")).toBeVisible();
});
