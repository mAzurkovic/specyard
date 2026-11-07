import type { Parsed } from "./result.js";

export type TaskProgress = { id: string; status: string; attempts: number; lastFailure: string };
export type Progress = { round: number; tasks: TaskProgress[]; changedTests: string[]; rejectedFindings: string[] };

const TABLE_HEADER = /^\|\s*Task\s*\|\s*Status\s*\|\s*Attempts\s*\|\s*Last failure\s*\|$/;
const DIVIDER = /^\|[\s|:-]+\|$/;
const ROUND = /^Round: (\d+)$/;
const LISTS = { "Changed tests:": "changedTests", "Rejected findings:": "rejectedFindings" } as const;

export function parseProgress(text: string): Parsed<Progress> {
  let round = 0;
  const tasks = new Map<string, TaskProgress>();
  const lists: Pick<Progress, "changedTests" | "rejectedFindings"> = { changedTests: [], rejectedFindings: [] };
  let inTable = false;
  let list: keyof typeof lists | undefined;

  for (const [index, raw] of text.split("\n").entries()) {
    const line = raw.trim();
    if (TABLE_HEADER.test(line)) {
      inTable = true;
      continue;
    }
    if (inTable && line.startsWith("|")) {
      if (DIVIDER.test(line)) continue;
      const cells = line.slice(1, -1).split("|").map((c) => c.trim());
      if (cells.length < 4) return { ok: false, line: index + 1, expected: "a row with Task, Status, Attempts and Last failure" };
      const [id, status, attempts, ...failure] = cells;
      if (!/^\d+$/.test(attempts!)) return { ok: false, line: index + 1, expected: "attempts as a whole number" };
      // Older loops named fix tasks F<n>; they are X<n> now.
      const taskId = id!.replace(/^F(\d+)$/, "X$1");
      tasks.set(taskId, { id: taskId, status: status!, attempts: Number(attempts), lastFailure: failure.join("|") });
      continue;
    }
    inTable = false;

    const roundMatch = ROUND.exec(line);
    if (roundMatch) round = Number(roundMatch[1]);
    if (line in LISTS) list = LISTS[line as keyof typeof LISTS];
    else if (list && line.startsWith("- ")) lists[list].push(line.slice(2));
    else if (line === "" || !line.startsWith("- ")) list = undefined;
  }
  return { ok: true, value: { round, tasks: [...tasks.values()], ...lists }, warnings: [] };
}
