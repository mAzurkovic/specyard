import type { Parsed } from "./result.js";

export type TasksStatus = { kind: "draft" } | { kind: "approved"; hash: string };
export type Header = { status: TasksStatus | undefined };

const STATUS = /^Status: (draft|approved ([0-9a-f]{12}))$/;

/** The `Status:` line of a task list; no line means the tasks are still in review. */
export function parseHeader(text: string): Parsed<Header> {
  let status: TasksStatus | undefined;
  for (const [index, line] of text.split("\n").entries()) {
    if (!line.startsWith("Status:")) continue;
    const match = STATUS.exec(line);
    if (!match) return { ok: false, line: index + 1, expected: "`Status: draft` or `Status: approved <12-char hash>`" };
    status = match[2] ? { kind: "approved", hash: match[2] } : { kind: "draft" };
  }
  return { ok: true, value: { status }, warnings: [] };
}
