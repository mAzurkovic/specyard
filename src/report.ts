import { CLAUDE_CHECK, type CheckResult } from "./checks.js";

const MARK = { ok: "✓", warn: "!", fail: "✗" } as const;

export function formatChecks(results: CheckResult[]): { lines: string[]; start: boolean } {
  return {
    lines: results.map((r) => `${MARK[r.status]} ${r.name}: ${r.detail}${r.fix ? `. Fix: ${r.fix}` : ""}`),
    start: !results.some((r) => r.name === CLAUDE_CHECK && r.status === "fail"),
  };
}
