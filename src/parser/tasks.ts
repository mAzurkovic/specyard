import type { Parsed } from "./result.js";

export type TaskEntry = { id: string; text: string; done: boolean; line: number };
export type ParentEntry = {
  id: string;
  title: string;
  mode: "serial" | "parallel";
  needs: string[];
  /** Extra tags such as `approval` (needs the user's approval to verify) or `manual`. */
  flags: string[];
  line: number;
  tasks: TaskEntry[];
};

const PARENT = /^## (\d+)\. (.+?)((?: \[[^\]]*\])*)\s*$/;
const TAG = /^(serial|parallel)(?:, needs (\d+(?:\.\d+)?(?:(?:, | and )\d+(?:\.\d+)?)*))?$/;
const FLAGS = new Set(["approval", "manual"]);
const CHECKBOX = /^- \[( |x)\] /;
const TASK = /^- \[( |x)\] (\d+\.\d+) (.+)$/;

export function parseTasks(text: string): Parsed<ParentEntry[]> {
  const parents: ParentEntry[] = [];
  let current: ParentEntry | undefined;
  for (const [index, raw] of text.split("\n").entries()) {
    const line = index + 1;
    if (raw.startsWith("## ")) {
      const parent = PARENT.exec(raw);
      if (!parent) {
        current = undefined;
        continue;
      }
      let tag: RegExpExecArray | undefined;
      const flags: string[] = [];
      for (const [, inner] of parent[3]!.matchAll(/\[([^\]]*)\]/g)) {
        const mode = TAG.exec(inner!);
        if (mode && !tag) tag = mode;
        else if (FLAGS.has(inner!)) flags.push(inner!);
        else return { ok: false, line, expected: "a tag like `[serial]` or `[parallel, needs 1, 2.3]`" };
      }
      current = {
        id: parent[1]!,
        title: parent[2]!,
        mode: tag?.[1] === "parallel" ? "parallel" : "serial",
        needs: tag?.[2]?.split(/, | and /) ?? [],
        flags,
        line,
        tasks: [],
      };
      parents.push(current);
    } else if (CHECKBOX.test(raw)) {
      const task = TASK.exec(raw);
      if (!task) return { ok: false, line, expected: "a task like `- [ ] 1.1 <text>`" };
      if (!current) return { ok: false, line, expected: "a task under a heading like `## 1. <title> [serial]`" };
      current.tasks.push({ id: task[2]!, text: task[3]!, done: task[1] === "x", line });
    }
  }
  return { ok: true, value: parents, warnings: [] };
}
