import { structuredPatch } from "diff";

export type DiffRow = { kind: "header" | "same" | "add" | "del"; text: string };

const KIND: Record<string, DiffRow["kind"]> = { "+": "add", "-": "del", " ": "same" };

/** Changed hunks with three lines of context, as `git diff` shows them. jsdiff's "\ No newline" markers are dropped. */
export function diffRows(before: string, after: string): DiffRow[] {
  return structuredPatch("", "", before, after, "", "", { context: 3 }).hunks.flatMap((h) => [
    { kind: "header" as const, text: `@@ -${h.oldStart},${h.oldLines} +${h.newStart},${h.newLines} @@` },
    ...h.lines.filter((line) => line[0] !== "\\").map((line) => ({ kind: KIND[line[0]!] ?? "same", text: line.slice(1) })),
  ]);
}
