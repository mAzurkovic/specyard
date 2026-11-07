import { describe, expect, it } from "vitest";
import { parseTasks } from "../../src/parser/tasks.js";

const doc = `# Transfers — Tasks

Status: draft

## 1. Post a transfer [serial]
- [x] 1.1 Table and entries. Migration applied.
- [ ] 1.2 POST /transfers returns 201.

## 2. Reject bad transfers [parallel, needs 1]
- [ ] 2.1 Insufficient funds gives 422.

## 3. History [parallel, needs 1.2, 2]
- [ ] 3.1 GET history pages.

## 4. Untagged parent
- [ ] 4.1 Works too.

## Dependencies
- 2 needs 1.
`;

describe("parseTasks", () => {
  it("reads parents with their tags and tasks with their state", () => {
    const result = parseTasks(doc);
    if (!result.ok) throw new Error(result.expected);
    expect(result.value).toEqual([
      { id: "1", title: "Post a transfer", mode: "serial", needs: [], flags: [], line: 5, tasks: [
        { id: "1.1", text: "Table and entries. Migration applied.", done: true, line: 6 },
        { id: "1.2", text: "POST /transfers returns 201.", done: false, line: 7 },
      ] },
      { id: "2", title: "Reject bad transfers", mode: "parallel", needs: ["1"], flags: [], line: 9, tasks: [{ id: "2.1", text: "Insufficient funds gives 422.", done: false, line: 10 }] },
      { id: "3", title: "History", mode: "parallel", needs: ["1.2", "2"], flags: [], line: 12, tasks: [{ id: "3.1", text: "GET history pages.", done: false, line: 13 }] },
      { id: "4", title: "Untagged parent", mode: "serial", needs: [], flags: [], line: 15, tasks: [{ id: "4.1", text: "Works too.", done: false, line: 16 }] },
    ]);
  });

  it("reads an extra flag tag and needs joined with and", () => {
    const result = parseTasks("## 4. Dev stack [serial, needs 2 and 3] [approval]\n- [ ] 4.1 Deploy.\n## 5. Only a flag [manual]\n");
    if (!result.ok) throw new Error(result.expected);
    expect(result.value.map((p) => [p.mode, p.needs, p.flags])).toEqual([
      ["serial", ["2", "3"], ["approval"]],
      ["serial", [], ["manual"]],
    ]);
  });

  it("reports a task with no id", () => {
    expect(parseTasks("## 1. A [serial]\n- [ ] do the thing\n")).toMatchObject({ ok: false, line: 2, expected: "a task like `- [ ] 1.1 <text>`" });
  });

  it("reports a task outside any parent", () => {
    expect(parseTasks("# T\n- [ ] 1.1 orphan\n")).toMatchObject({ ok: false, line: 2 });
  });

  it("reports a tag it cannot read", () => {
    expect(parseTasks("## 1. A [sometimes]\n")).toMatchObject({ ok: false, line: 1, expected: "a tag like `[serial]` or `[parallel, needs 1, 2.3]`" });
  });
});
