import type { Parsed } from "./result.js";

export type SourceHash = { path: string; hash: string };
export type TasksStatus = { kind: "draft" } | { kind: "approved"; hash: string };
export type Header = { sources: SourceHash[]; status: TasksStatus | undefined };

const SOURCES = /^<!-- sources: (.*) -->$/;
const SOURCE = /^(\S+) ([0-9a-f]{12})$/;
const STATUS = /^Status: (draft|approved ([0-9a-f]{12}))$/;

export function parseHeader(text: string): Parsed<Header> {
  let sources: SourceHash[] = [];
  let status: TasksStatus | undefined;
  for (const [index, line] of text.split("\n").entries()) {
    if (line.startsWith("<!-- sources:")) {
      const parts = SOURCES.exec(line)?.[1]?.split(",").map((part) => SOURCE.exec(part.trim()));
      if (!parts || parts.some((p) => p === null)) {
        return { ok: false, line: index + 1, expected: "a sources line like `<!-- sources: ../../design.md 9c03de51aa48 -->`" };
      }
      sources = parts.map((p) => ({ path: p![1]!, hash: p![2]! }));
    } else if (line.startsWith("Status:")) {
      const match = STATUS.exec(line);
      if (!match) return { ok: false, line: index + 1, expected: "`Status: draft` or `Status: approved <12-char hash>`" };
      status = match[2] ? { kind: "approved", hash: match[2] } : { kind: "draft" };
    }
  }
  return { ok: true, value: { sources, status }, warnings: [] };
}
