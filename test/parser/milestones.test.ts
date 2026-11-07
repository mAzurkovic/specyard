import { describe, expect, it } from "vitest";
import { parseMilestones } from "../../src/parser/milestones.js";

const doc = `# Ledger — Milestones

Build order: M1, then M2.

## M1. Ledger core
- Delivers: postings.
- Needs: none.
- Features:
  - F1. Double-entry postings: every write posts two entries. Docs: tasks. Needs: none. Status: done.
  - F2. Idempotent writes: same key, same result. Docs: design, tasks. Needs: F1. Status: in progress.
    - Verify: a nested bullet that is not a feature.

## M2. Accounts API
- Needs: M1 to start. M3 for the last exit check.
- Features:
  - F1. Create account: POST /accounts. Docs: requirements, design, tasks. Needs: M1 F2. Status: not started.
  - F2. Transfers: move money: both sides. Docs: tasks. Needs: F1, M1 F1. Status: not started.

## M3. Reports
- Needs: M1, M2.
- Features: none. Built as one PR before features were used.
`;

describe("parseMilestones", () => {
  it("reads milestones with their names and needs", () => {
    const result = parseMilestones(doc);
    if (!result.ok) throw new Error(result.expected);
    expect(result.value.map((m) => [m.id, m.name, m.needs])).toEqual([
      ["M1", "Ledger core", []],
      ["M2", "Accounts API", ["M1"]],
      ["M3", "Reports", ["M1", "M2"]],
    ]);
  });

  it("reads feature lines with docs, needs and status", () => {
    const result = parseMilestones(doc);
    if (!result.ok) throw new Error(result.expected);
    const [m1, m2, m3] = result.value;
    expect(m1?.features).toEqual([
      { id: "F1", name: "Double-entry postings", summary: "every write posts two entries", docs: ["tasks"], needs: [], status: "done", line: 9 },
      { id: "F2", name: "Idempotent writes", summary: "same key, same result", docs: ["design", "tasks"], needs: [{ milestone: "M1", feature: "F1" }], status: "in progress", line: 10 },
    ]);
    expect(m2?.features.map((f) => f.needs)).toEqual([
      [{ milestone: "M1", feature: "F2" }],
      [{ milestone: "M2", feature: "F1" }, { milestone: "M1", feature: "F1" }],
    ]);
    expect(m2?.features[1]?.summary).toBe("move money: both sides");
    expect(m3?.features).toEqual([]);
  });

  it("reads what a milestone delivers and its exit criteria", () => {
    const result = parseMilestones(`## M1. Core
- Delivers: \`specyard\` starts in a repo.
- Builds: cli.ts.
- Exit criteria:
  - Start to UI ready under 3 s.
  - A request without the token: 403.
- Needs: none.
- Features:
  - F1. Base: x. Docs: tasks. Needs: none. Status: done.

## M2. Next
- Needs: M1.
`);
    if (!result.ok) throw new Error(result.expected);
    const [m1, m2] = result.value;
    expect(m1?.delivers).toBe("`specyard` starts in a repo.");
    expect(m1?.exitCriteria).toEqual(["Start to UI ready under 3 s.", "A request without the token: 403."]);
    expect(m1?.features.map((f) => f.id)).toEqual(["F1"]);
    expect([m2?.delivers, m2?.exitCriteria]).toEqual(["", []]);
  });

  it("treats a feature with no Needs as having no dependencies, with a warning", () => {
    const result = parseMilestones("## M1. Core\n- Needs: none.\n- Features:\n  - F1. Thing: does it. Docs: tasks. Status: not started.\n");
    if (!result.ok) throw new Error(result.expected);
    expect(result.value[0]?.features[0]?.needs).toEqual([]);
    expect(result.warnings).toEqual([{ line: 4, kind: "warning", message: "M1 F1 has no dependency list; treated as none" }]);
  });

  it("reports a feature line it cannot read as an error on its line, and keeps the rest", () => {
    const result = parseMilestones("## M1. Core\n- Features:\n  - F1 missing the dot and colon\n  - F2. Good: x. Docs: tasks. Needs: none. Status: done.\n");
    if (!result.ok) throw new Error(result.expected);
    expect(result.value[0]?.features.map((f) => f.id)).toEqual(["F2"]);
    expect(result.warnings).toEqual([
      { line: 3, kind: "error", message: "expected a feature line like `F1. <name>: <summary>. Docs: tasks. Needs: none. Status: not started.`" },
    ]);
  });

  it("keeps the feature ids of a dependency list and warns on items that are not ids", () => {
    const result = parseMilestones("## M1. Core\n- Features:\n  - F1. Thing: x. Docs: tasks. Needs: F4, OQ1. Status: done.\n");
    if (!result.ok) throw new Error(result.expected);
    expect(result.value[0]?.features[0]?.needs).toEqual([{ milestone: "M1", feature: "F4" }]);
    expect(result.warnings).toEqual([{ line: 3, kind: "warning", message: 'M1 F1 needs "OQ1", which is not a feature id; ignored' }]);
  });

  it("reports a broken milestone heading as an error, skips its section and keeps the other milestones", () => {
    const result = parseMilestones("## M1 Core\n- Features:\n  - F1. A: x. Docs: tasks. Needs: none. Status: done.\n## M2. Next\n- Needs: none.\n");
    if (!result.ok) throw new Error(result.expected);
    expect(result.value.map((m) => m.id)).toEqual(["M2"]);
    expect(result.warnings).toEqual([{ line: 1, kind: "error", message: "expected a heading like `## M1. <name>`" }]);
  });

  it("ignores other headings such as notes before the first milestone", () => {
    const result = parseMilestones("## How features are verified\n- Local: x.\n\n## M1. Core\n- Needs: none.\n");
    expect(result.ok && result.value.map((m) => m.id)).toEqual(["M1"]);
  });

  it("ignores the Deferred, Coverage and Open Questions sections", () => {
    const result = parseMilestones("## M1. Core\n- Needs: none.\n\n## Deferred\n- FR9. later\n\n## Coverage\n| a | b |\n\n## Open Questions\n- OQ1. x\n");
    expect(result.ok && result.value.map((m) => m.id)).toEqual(["M1"]);
  });
});
