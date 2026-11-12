import { describe, expect, it } from "vitest";
import { applyRuns, buildModel, type ProjectFiles } from "../src/model.js";
import type { RunState } from "../src/runs/RunManager.js";

const milestones = (body: string) => `# P — Milestones\n\n${body}`;
const approved = "# T\n\nStatus: approved a41f09c2e7b1\n\n## 1. A [serial]\n- [x] 1.1 One.\n- [ ] 1.2 Two.\n";
const draft = "# T\n\nStatus: draft\n\n## 1. A [serial]\n- [ ] 1.1 One.\n";

function files(extra: Record<string, string>, milestonesText: string): ProjectFiles {
  return new Map(Object.entries({ "requirements.md": "# R\n", "design.md": "# D\n", "milestones.md": milestonesText, ...extra }));
}

const twoMilestones = milestones(`## M1. Core
- Needs: none.
- Features:
  - F1. Base: x. Docs: tasks. Needs: none. Status: done.
  - F2. Writes: x. Docs: design, tasks. Needs: F1. Status: not started.
  - F3. Reads: x. Docs: tasks. Needs: F1. Status: not started.

## M2. API
- Needs: M1.
- Features:
  - F1. Accounts: x. Docs: tasks. Needs: none. Status: not started.
  - F2. Transfers: x. Docs: tasks. Needs: F1, M1 F2. Status: not started.
`);

describe("buildModel stages", () => {
  it.each([
    ["done in milestones.md", "M1·F1", {}, "done"],
    ["design listed and missing", "M1·F2", {}, "needs-design"],
    ["no tasks.md", "M1·F3", {}, "needs-tasks"],
    ["draft tasks", "M1·F3", { "m1-core/f3-reads/tasks.md": draft }, "tasks-in-review"],
    ["tasks with no Status line", "M1·F3", { "m1-core/f3-reads/tasks.md": "## 1. A [serial]\n- [ ] 1.1 x\n" }, "tasks-in-review"],
    ["approved, dependencies done", "M1·F3", { "m1-core/f3-reads/tasks.md": approved }, "ready"],
    ["approved, a dependency not done", "M2·F2", { "m2-api/f2-transfers/tasks.md": approved }, "waits-on-deps"],
    ["approved, needed milestone not done", "M2·F1", { "m2-api/f1-accounts/tasks.md": approved }, "waits-on-deps"],
  ])("%s gives the right stage", (_label, id, extra, stage) => {
    const model = buildModel("p", files(extra, twoMilestones));
    expect(model.features.find((f) => f.id === id)?.stage).toBe(stage);
  });
});

describe("buildModel graph", () => {
  const model = buildModel("p", files({}, twoMilestones));

  it("has one edge per dependency, from the dependency to the feature", () => {
    expect(model.edges).toEqual([
      { from: "M1·F1", to: "M1·F2" },
      { from: "M1·F1", to: "M1·F3" },
      { from: "M2·F1", to: "M2·F2" },
      { from: "M1·F2", to: "M2·F2" },
    ]);
  });

  it("marks the longest chain of features that are not done as the critical path", () => {
    expect(model.criticalPath).toEqual(["M1·F2", "M2·F2"]);
  });

  it("lists the features that can start now with their next action", () => {
    expect(model.canStartNow).toEqual([
      { id: "M1·F2", action: "/to-design M1 F2" },
      { id: "M1·F3", action: "/to-tasks M1 F3" },
      { id: "M2·F1", action: "/to-tasks M2 F1" },
      { id: "M2·F2", action: "/to-tasks M2 F2" },
    ]);
  });

  it("shows which required files exist", () => {
    expect(buildModel("p", new Map([["design.md", "# D"]])).files).toEqual({ requirements: false, design: true, milestones: false });
  });

  it("carries each milestone's delivers line and exit criteria", () => {
    const text = milestones("## M1. Core\n- Delivers: a ledger.\n- Exit criteria:\n  - Posts balance.\n- Features:\n  - F1. A: x. Docs: tasks. Needs: none. Status: done.\n");
    expect(buildModel("p", files({}, text)).milestones).toEqual([
      { id: "M1", name: "Core", delivers: "a ledger.", exitCriteria: ["Posts balance."], needs: [], features: ["M1·F1"] },
    ]);
  });

  it("carries the context files, and none when not given", () => {
    const context = [{ path: "context/hld.md", size: 120, mtime: 1_700_000_000_000 }];
    expect(buildModel("p", new Map(), new Map(), context).contextFiles).toEqual(context);
    expect(buildModel("p", new Map()).contextFiles).toEqual([]);
  });
});

describe("buildModel tasks and issues", () => {
  it("attaches tasks with attempts from progress.md, fix tasks included", () => {
    const model = buildModel("p", files({
      "m1-core/f3-reads/tasks.md": approved,
      "m1-core/f3-reads/progress.md": "| Task | Status | Attempts | Last failure |\n|---|---|---|---|\n| 1.1 | done | 2 | |\n| F1 | done | 1 | verify #2 |\n",
    }, twoMilestones));
    const feature = model.features.find((f) => f.id === "M1·F3");
    expect(feature?.parents[0]?.tasks.map((t) => [t.id, t.done, t.attempts])).toEqual([["1.1", true, 2], ["1.2", false, 0]]);
    expect(feature?.fixTasks).toEqual([{ id: "X1", status: "done", attempts: 1, lastFailure: "verify #2" }]);
  });

  it("keeps building when a tasks.md does not parse, and marks that feature not implementable", () => {
    const model = buildModel("p", files({ "m1-core/f3-reads/tasks.md": "## 1. A [whenever]\n" }, twoMilestones));
    expect(model.issues).toContainEqual({ file: "m1-core/f3-reads/tasks.md", line: 1, kind: "error", message: "expected a tag like `[serial]` or `[parallel, needs 1, 2.3]`", feature: "M1·F3" });
    expect(model.features.find((f) => f.id === "M1·F3")?.implementable).toBe(false);
    expect(model.features.find((f) => f.id === "M1·F2")?.implementable).toBe(true);
  });

  it("keeps the milestones and features that parse when one feature line in milestones.md is broken", () => {
    const text = milestones("## M1. A\n- Features:\n  - F1. Good: x. Docs: tasks. Needs: none. Status: not started.\n\n## M2. B\n- Features:\n  - F2. Broken line with no parts\n");
    const model = buildModel("p", files({}, text));
    expect(model.features.map((f) => f.id)).toEqual(["M1·F1"]);
    expect(model.milestones.map((m) => m.id)).toEqual(["M1", "M2"]);
    expect(model.issues).toContainEqual(expect.objectContaining({ file: "milestones.md", line: 9, kind: "error" }));
  });

  it("carries parser warnings as issues", () => {
    const model = buildModel("p", files({}, milestones("## M1. C\n- Features:\n  - F1. A: x. Docs: tasks. Status: done.\n")));
    expect(model.issues).toEqual([{ file: "milestones.md", line: 5, kind: "warning", message: "M1 F1 has no dependency list; treated as none", feature: "M1·F1" }]);
  });

  it("warns on a dependency that names no feature, and draws no edge for it", () => {
    const model = buildModel("p", files({}, milestones("## M1. C\n- Features:\n  - F1. A: x. Docs: tasks. Needs: F9. Status: not started.\n")));
    expect(model.edges).toEqual([]);
    expect(model.issues).toContainEqual({ file: "milestones.md", line: 5, kind: "warning", message: "M1·F1 needs M1·F9, which does not exist", feature: "M1·F1" });
  });

  it("warns on a dependency cycle and still finds a path", () => {
    const model = buildModel("p", files({}, milestones("## M1. C\n- Features:\n  - F1. A: x. Docs: tasks. Needs: F2. Status: not started.\n  - F2. B: x. Docs: tasks. Needs: F1. Status: not started.\n")));
    expect(model.issues.some((i) => i.message.includes("cycle"))).toBe(true);
    expect(model.criticalPath.length).toBeGreaterThan(0);
  });
});

describe("buildModel activity", () => {
  it("sets each feature's last activity to its newest file time", () => {
    const text = milestones("## M1. C\n- Features:\n  - F1. A: x. Docs: tasks. Needs: none. Status: not started.\n  - F2. B: x. Docs: tasks. Needs: none. Status: not started.\n");
    const model = buildModel(
      "p",
      files({ "m1-c/f1-a/tasks.md": draft, "m1-c/f1-a/progress.md": "" }, text),
      new Map([["m1-c/f1-a/tasks.md", 1000], ["m1-c/f1-a/progress.md", 3000], ["milestones.md", 9000]]),
    );
    expect(model.features.map((f) => f.updatedAt)).toEqual([3000, undefined]);
  });
});

describe("follow-up fixes", () => {
  const text = milestones("## M1. C\n- Features:\n  - F1. A: x. Docs: tasks. Needs: none. Status: not started.\n  - F2. B: x. Docs: tasks. Status: not started.\n");

  it("a tasks.md with a broken header line is not implementable", () => {
    const model = buildModel("p", files({ "m1-c/f1-a/tasks.md": "# T\n\nStatus: approved abc\n\n## 1. A [serial]\n- [ ] 1.1 x\n" }, text));
    expect(model.features.find((f) => f.id === "M1·F1")?.implementable).toBe(false);
  });

  it("issues name the feature they belong to", () => {
    const model = buildModel("p", files({ "m1-c/f1-a/tasks.md": "## 1. A [whenever]\n" }, text));
    expect(model.issues.find((i) => i.file === "m1-c/f1-a/tasks.md")?.feature).toBe("M1·F1");
    expect(model.issues.find((i) => i.message.includes("no dependency list"))?.feature).toBe("M1·F2");
  });
});

describe("applyRuns", () => {
  const text = milestones("## M1. C\n- Features:\n  - F1. A: x. Docs: tasks. Needs: none. Status: not started.\n  - F2. B: x. Docs: tasks. Needs: none. Status: not started.\n  - F3. C: x. Docs: tasks. Needs: none. Status: not started.\n");
  const run = (target: string, state: RunState) => ({ id: target, kind: "to-tasks" as const, target, state, sessionId: undefined, startedAt: 0 });

  it("shows a feature with a running run as running, and one waiting for an answer as needs-you", () => {
    const model = applyRuns(buildModel("p", files({}, text)), [run("M1·F1", "running"), run("M1·F2", "needs-you"), run("M1·F3", "done")]);
    expect(model.features.map((f) => [f.id, f.stage])).toEqual([["M1·F1", "running"], ["M1·F2", "needs-you"], ["M1·F3", "needs-tasks"]]);
  });

  it("counts every running run, also on milestones, the project, and twice on one feature", () => {
    const model = applyRuns(buildModel("p", files({}, text)), [run("M1·F1", "running"), run("M1·F1", "running"), run("M1", "running"), { ...run("x", "running"), target: undefined }, run("M1·F2", "needs-you")]);
    expect(model.runningRuns).toBe(4);
    expect(buildModel("p", files({}, text)).runningRuns).toBe(0);
  });

  it("drops a running feature from can-start-now", () => {
    const model = applyRuns(buildModel("p", files({}, text)), [run("M1·F1", "running")]);
    expect(model.canStartNow.map((c) => c.id)).toEqual(["M1·F2", "M1·F3"]);
  });
});
