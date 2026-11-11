import { describe, expect, it } from "vitest";
import type { CheckResult } from "../src/checks.js";
import { formatChecks } from "../src/report.js";

const ok: CheckResult = { name: "Claude Code", status: "ok", detail: "logged in" };

describe("formatChecks", () => {
  it("prints one line per check with its mark and fix", () => {
    const { lines } = formatChecks([
      ok,
      { name: "verify", status: "fail", detail: "not installed", fix: "install the workflow skills into ~/.claude/skills" },
    ]);
    expect(lines).toEqual([
      "✓ Claude Code: logged in",
      "✗ verify: not installed. Fix: install the workflow skills into ~/.claude/skills",
    ]);
  });

  it("starts when only skill checks fail", () => {
    expect(formatChecks([ok, { name: "pr", status: "fail", detail: "not installed" }]).start).toBe(true);
  });

  it("does not start when the Claude Code check fails", () => {
    expect(formatChecks([{ name: "Claude Code", status: "fail", detail: "not logged in" }]).start).toBe(false);
  });
});
