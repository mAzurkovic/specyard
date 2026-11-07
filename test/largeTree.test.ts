import { expect, it } from "vitest";
import { writeLargeTree } from "../scripts/genFixture.js";
import { buildModel } from "../src/model.js";
import { readProject } from "../src/readProject.js";
import { tempDir } from "./helpers.js";

it("reads and models 20 milestones, 200 features and 2,000 tasks in under 300 ms", async () => {
  const dir = tempDir("large");
  writeLargeTree(dir);
  const started = performance.now();
  const model = buildModel("large", await readProject(dir));
  const elapsed = performance.now() - started;
  expect([model.milestones.length, model.features.length, model.features.flatMap((f) => f.parents.flatMap((p) => p.tasks)).length]).toEqual([20, 200, 2000]);
  expect(model.issues).toEqual([]);
  expect(model.criticalPath).toHaveLength(200);
  expect(elapsed).toBeLessThan(300);
});
