import { describe, expect, it } from "vitest";
import type { Issue } from "../src/model.js";
import { issueLocation, issuesByFeature, sortIssues } from "../ui/src/issues.js";

const issue = (file: string, kind: Issue["kind"], line = 1): Issue => ({ file, line, kind, message: "x" });

describe("issuesByFeature", () => {
  it("groups issues by their feature and leaves out project issues", () => {
    const map = issuesByFeature([
      { ...issue("m1-core/f1-base/tasks.md", "error"), feature: "M1·F1" },
      { ...issue("m1-core/f1-base/progress.md", "warning"), feature: "M1·F1" },
      { ...issue("milestones.md", "warning"), feature: "M1·F2" },
      issue("milestones.md", "warning", 0),
    ]);
    expect([...map.keys()]).toEqual(["M1·F1", "M1·F2"]);
    expect(map.get("M1·F1")?.map((i) => i.file)).toEqual(["m1-core/f1-base/tasks.md", "m1-core/f1-base/progress.md"]);
  });
});

describe("sortIssues", () => {
  it("puts errors first, then by file and line", () => {
    const sorted = sortIssues([issue("b.md", "warning", 2), issue("b.md", "error", 9), issue("a.md", "warning", 5), issue("a.md", "error", 3)]);
    expect(sorted.map((i) => `${i.kind} ${i.file}:${i.line}`)).toEqual(["error a.md:3", "error b.md:9", "warning a.md:5", "warning b.md:2"]);
  });
});

describe("issueLocation", () => {
  it("shows the line only when there is one", () => {
    expect(issueLocation(issue("tasks.md", "error", 9))).toBe("tasks.md:9");
    expect(issueLocation(issue("milestones.md", "warning", 0))).toBe("milestones.md");
  });
});
