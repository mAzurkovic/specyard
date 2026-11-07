import { describe, expect, it } from "vitest";
import type { Feature, Issue } from "../src/model.js";
import { issuesByFeature, sortIssues } from "../ui/src/issues.js";

const feature = (id: string, dir: string | undefined) => ({ id, dir }) as Pick<Feature, "id" | "dir">;
const issue = (file: string, kind: Issue["kind"], line = 1): Issue => ({ file, line, kind, message: "x" });

describe("issuesByFeature", () => {
  it("gives each feature the issues of the files in its folder", () => {
    const map = issuesByFeature(
      [feature("M1·F1", "m1-core/f1-base"), feature("M1·F2", "m1-core/f2-writes"), feature("M1·F3", undefined)],
      [issue("m1-core/f1-base/tasks.md", "error"), issue("m1-core/f1-base/progress.md", "warning"), issue("milestones.md", "warning")],
    );
    expect(map.get("M1·F1")?.map((i) => i.file)).toEqual(["m1-core/f1-base/tasks.md", "m1-core/f1-base/progress.md"]);
    expect(map.has("M1·F2")).toBe(false);
    expect(map.has("M1·F3")).toBe(false);
  });

  it("does not match a folder that only shares a prefix", () => {
    const map = issuesByFeature([feature("M1·F1", "m1-core/f1-base")], [issue("m1-core/f1-base-old/tasks.md", "error")]);
    expect(map.size).toBe(0);
  });
});

describe("sortIssues", () => {
  it("puts errors first, then by file and line", () => {
    const sorted = sortIssues([issue("b.md", "warning", 2), issue("b.md", "error", 9), issue("a.md", "warning", 5), issue("a.md", "error", 3)]);
    expect(sorted.map((i) => `${i.kind} ${i.file}:${i.line}`)).toEqual(["error a.md:3", "error b.md:9", "warning a.md:5", "warning b.md:2"]);
  });
});
