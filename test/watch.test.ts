import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { watchProject } from "../src/watch.js";
import { tempDir } from "./helpers.js";

let stop: (() => void) | undefined;
afterEach(() => stop?.());

const settle = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Starts watching, waits out events the OS still reports from before the watch began, and counts callbacks from then on. */
async function changes(dir: string): Promise<() => number> {
  let count = 0;
  stop = watchProject(dir, () => count++, 50);
  await settle(300);
  const baseline = count;
  return () => count - baseline;
}

it("calls back once for a burst of changes", async () => {
  const dir = tempDir("watch");
  const count = await changes(dir);
  for (let i = 0; i < 5; i++) writeFileSync(join(dir, "design.md"), `# v${i}\n`);
  await settle(400);
  expect(count()).toBe(1);
});

it("sees changes in nested feature folders", async () => {
  const dir = tempDir("watch");
  mkdirSync(join(dir, "m1-core", "f1-base"), { recursive: true });
  const count = await changes(dir);
  writeFileSync(join(dir, "m1-core", "f1-base", "tasks.md"), "# T\n");
  await settle(400);
  expect(count()).toBe(1);
});

it("ignores its own run folder", async () => {
  const dir = tempDir("watch");
  mkdirSync(join(dir, ".specyard"));
  const count = await changes(dir);
  writeFileSync(join(dir, ".specyard", "run.json"), "{}");
  await settle(400);
  expect(count()).toBe(0);
});
