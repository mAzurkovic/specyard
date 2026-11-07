import { mkdirSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import { hashText } from "../src/hashes.js";
import { readContextFiles, readMtimes, readProject } from "../src/readProject.js";
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

it("lists every file under context/ and mocks/ with its size and change time, nothing else", async () => {
  const dir = tempDir("context");
  const put = (path: string, text: string) => {
    mkdirSync(join(dir, path, ".."), { recursive: true });
    writeFileSync(join(dir, path), text);
  };
  put("context/hld.md", "# HLD\n");
  put("context/adr/001-sse.md", "# ADR\n");
  put("mocks/01-start.html", "<p>x</p>");
  put("design.md", "# D\n");
  put("m1-core/context/not-context.md", "# no\n");
  const changed = new Date("2026-11-01T10:00:00Z");
  utimesSync(join(dir, "context/hld.md"), changed, changed);

  const files = await readContextFiles(dir);
  expect(files.map((f) => [f.path, f.size])).toEqual([
    ["context/adr/001-sse.md", 6],
    ["context/hld.md", 6],
    ["mocks/01-start.html", 8],
  ]);
  expect(files.find((f) => f.path === "context/hld.md")?.mtime).toBe(changed.getTime());
  expect(files.find((f) => f.path === "context/hld.md")?.hash).toBe(hashText("# HLD\n"));
});

it("lists no context files when context/ and mocks/ do not exist", async () => {
  expect(await readContextFiles(tempDir("bare"))).toEqual([]);
});

it("skips dot files such as .DS_Store and editor swap files in context/", async () => {
  const dir = tempDir("dots");
  mkdirSync(join(dir, "context"), { recursive: true });
  writeFileSync(join(dir, "context", "hld.md"), "# HLD\n");
  writeFileSync(join(dir, "context", ".DS_Store"), "x");
  writeFileSync(join(dir, "context", ".hld.md.swp"), "x");
  expect((await readContextFiles(dir)).map((f) => f.path)).toEqual(["context/hld.md"]);
});

it("treats a context folder it cannot read as empty and still lists the other", async () => {
  const dir = tempDir("notdir");
  mkdirSync(join(dir, "context"), { recursive: true });
  writeFileSync(join(dir, "context", "hld.md"), "# HLD\n");
  writeFileSync(join(dir, "mocks"), "a plain file named mocks");
  expect((await readContextFiles(dir)).map((f) => f.path)).toEqual(["context/hld.md"]);
});

it("reuses a context file's hash while its size and mtime are unchanged", async () => {
  const dir = tempDir("cache");
  mkdirSync(join(dir, "context"), { recursive: true });
  const file = join(dir, "context", "hld.md");
  writeFileSync(file, "# HLD v1\n");
  const when = new Date("2026-11-01T10:00:00Z");
  utimesSync(file, when, when);
  const first = (await readContextFiles(dir))[0]!.hash;
  writeFileSync(file, "# HLD v2\n");
  utimesSync(file, when, when);
  expect((await readContextFiles(dir))[0]!.hash).toBe(first);
  utimesSync(file, new Date("2026-11-02T10:00:00Z"), new Date("2026-11-02T10:00:00Z"));
  expect((await readContextFiles(dir))[0]!.hash).toBe(hashText("# HLD v2\n"));
});
