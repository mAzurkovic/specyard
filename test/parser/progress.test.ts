import { describe, expect, it } from "vitest";
import { parseProgress } from "../../src/parser/progress.js";

const doc = `# Progress

## First PR
Round: 1

| Task | Status | Attempts | Last failure |
|------|--------|----------|--------------|
| 1.1 | done | 1 | |
| 1.2 | fail | 2 | POST /orders gives 500 |

## Second PR
Round: 3

| Task | Status | Attempts | Last failure |
|------|--------|----------|--------------|
| 1.2 | done | 3 | |
| F1 | done | 1 | verify #2: missing id |
| X2 | todo | 0 | review #3 |

Changed tests:
- test_total: expected 110, spec says 108.

Rejected findings:
- review #5 "use a dataclass": repo uses TypedDict.
- review #6 "rename": style only.
`;

describe("parseProgress", () => {
  it("reads every table, the last row of a task wins, and the last round", () => {
    const result = parseProgress(doc);
    if (!result.ok) throw new Error(result.expected);
    expect(result.value.round).toBe(3);
    expect(result.value.tasks).toEqual([
      { id: "1.1", status: "done", attempts: 1, lastFailure: "" },
      { id: "1.2", status: "done", attempts: 3, lastFailure: "" },
      { id: "X1", status: "done", attempts: 1, lastFailure: "verify #2: missing id" },
      { id: "X2", status: "todo", attempts: 0, lastFailure: "review #3" },
    ]);
  });

  it("reads changed tests and rejected findings", () => {
    const result = parseProgress(doc);
    if (!result.ok) throw new Error(result.expected);
    expect(result.value.changedTests).toEqual(["test_total: expected 110, spec says 108."]);
    expect(result.value.rejectedFindings).toEqual(['review #5 "use a dataclass": repo uses TypedDict.', 'review #6 "rename": style only.']);
  });

  it("does not throw on a line named like an object property", () => {
    expect(parseProgress("toString\n- x\nconstructor\n").ok).toBe(true);
  });

  it("reads an empty file as no progress", () => {
    expect(parseProgress("")).toEqual({ ok: true, value: { round: 0, tasks: [], changedTests: [], rejectedFindings: [] }, warnings: [] });
  });

  it("reports a row whose attempts is not a number", () => {
    const text = "| Task | Status | Attempts | Last failure |\n|---|---|---|---|\n| 1.1 | done | many | |\n";
    expect(parseProgress(text)).toMatchObject({ ok: false, line: 3, expected: "attempts as a whole number" });
  });

  it("reports a row with too few cells", () => {
    const text = "| Task | Status | Attempts | Last failure |\n|---|---|---|---|\n| 1.1 | done |\n";
    expect(parseProgress(text)).toMatchObject({ ok: false, line: 3 });
  });
});
