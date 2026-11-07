import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import { readMtimes, readProject } from "../src/readProject.js";
import { tempDir } from "./helpers.js";

it("reads the project files and each feature folder's spec files, nothing else", async () => {
  const dir = tempDir("project");
  const put = (path: string, text = `# ${path}\n`) => {
    mkdirSync(join(dir, path, ".."), { recursive: true });
    writeFileSync(join(dir, path), text);
  };
  put("requirements.md");
  put("design.md");
  put("milestones.md");
  put("user-stories.md");
  put("m1-core/f1-base/tasks.md");
  put("m1-core/f1-base/progress.md");
  put("m1-core/f2-writes/design.md");
  put("m1-core/f2-writes/verify/cases.md");
  put("m1-core/notes.md");
  put(".specyard/runs/x.md");

  const files = await readProject(dir);
  expect([...files.keys()].sort()).toEqual([
    "design.md",
    "m1-core/f1-base/progress.md",
    "m1-core/f1-base/tasks.md",
    "m1-core/f2-writes/design.md",
    "milestones.md",
    "requirements.md",
  ]);
  expect(files.get("m1-core/f1-base/tasks.md")).toBe("# m1-core/f1-base/tasks.md\n");
});

it("reads an empty folder as no files", async () => {
  expect((await readProject(tempDir("empty"))).size).toBe(0);
});

it("reads the modified time of each given file, skipping missing ones", async () => {
  const dir = tempDir("times");
  writeFileSync(join(dir, "design.md"), "# d\n");
  const times = await readMtimes(dir, ["design.md", "missing.md"]);
  expect([...times.keys()]).toEqual(["design.md"]);
  expect(Math.abs(times.get("design.md")! - Date.now())).toBeLessThan(60_000);
});
