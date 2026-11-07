import { expect, test } from "@playwright/test";
import { mkdtempSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeLargeTree } from "../scripts/genFixture.js";
import { startServer, type RunningServer } from "../src/server.js";
import { uiDist } from "./fixtures.js";

let server: RunningServer;
test.beforeAll(async () => {
  const dir = join(mkdtempSync(join(tmpdir(), "specyard-large-")), "specs", "large");
  mkdirSync(dir, { recursive: true });
  writeLargeTree(dir);
  const project = { name: "large", dir };
  server = await startServer({ port: 0, projects: [project], current: project, uiDir: uiDist });
});
test.afterAll(async () => server.close());

for (const [view, ready] of [["graph", "[data-feature]"], ["list", "[data-milestone]"]] as const) {
  test(`${view} of 20 milestones, 200 features and 2,000 tasks renders in under 1 s`, async ({ page }) => {
    const started = Date.now();
    await page.goto(`${server.url}/?t=${server.token}#/${view}`);
    await expect(page.locator(ready).first()).toBeVisible();
    expect(await page.locator(ready).count()).toBe(view === "graph" ? 200 : 20);
    expect(Date.now() - started).toBeLessThan(1000);
  });
}
