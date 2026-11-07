import { describe, expect, it } from "vitest";
import type { Feature, Parent } from "../src/model.js";
import { fixTaskIcon, taskIcon } from "../ui/src/taskState.js";

const parent = (id: string, needs: string[], tasks: [string, boolean, number][]): Parent => ({
  id,
  title: id,
  mode: "serial",
  needs,
  flags: [],
  tasks: tasks.map(([tid, done, attempts]) => ({ id: tid, text: tid, done, attempts })),
});
const feature = (parents: Parent[]) => ({ parents }) as Pick<Feature, "parents">;

describe("taskIcon", () => {
  const f = feature([
    parent("1", [], [["1.1", true, 1], ["1.2", false, 0]]),
    parent("2", ["1"], [["2.1", false, 0]]),
    parent("3", ["1.1"], [["3.1", false, 0]]),
    parent("4", [], [["4.1", false, 3]]),
  ]);
  const icon = (pid: number, tid: number) => taskIcon(f.parents[pid]!.tasks[tid]!, f.parents[pid]!, f);

  it.each([
    ["done task", 0, 0, "done"],
    ["open task with no blocker", 0, 1, "todo"],
    ["task under a parent that needs an unfinished parent", 1, 0, "wait"],
    ["task under a parent that needs a finished subtask", 2, 0, "todo"],
    ["open task after 3 attempts", 3, 0, "failed"],
  ])("%s", (_label, pid, tid, expected) => {
    expect(icon(pid, tid)).toBe(expected);
  });
});

describe("fixTaskIcon", () => {
  it.each([
    [{ id: "X1", status: "done", attempts: 1, lastFailure: "" }, "fix"],
    [{ id: "X2", status: "todo", attempts: 0, lastFailure: "" }, "todo"],
    [{ id: "X3", status: "fail", attempts: 3, lastFailure: "boom" }, "failed"],
  ])("%o gives %s", (fix, expected) => {
    expect(fixTaskIcon(fix)).toBe(expected);
  });
});
