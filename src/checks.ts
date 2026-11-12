import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import { workflowSkills } from "./expectedSkills.js";

const run = promisify(execFile);

export type CheckResult = {
  name: string;
  status: "ok" | "warn" | "fail";
  detail: string;
  fix?: string;
};

/** Without Claude Code nothing can run, so a failure here stops the start. */
export const CLAUDE_CHECK = "Claude Code";

export async function checkClaude(env: NodeJS.ProcessEnv = process.env): Promise<CheckResult> {
  const name = CLAUDE_CHECK;
  try {
    // A logged-out CLI exits 1 but still prints its status, so read stdout either way.
    const { stdout } = await run("claude", ["auth", "status", "--json"], { env }).catch((error: unknown) => {
      const err = error as NodeJS.ErrnoException & { stdout?: string };
      if (err.code === "ENOENT" || !err.stdout) throw error;
      return { stdout: err.stdout };
    });
    const { loggedIn } = JSON.parse(stdout) as { loggedIn: boolean };
    return loggedIn
      ? { name, status: "ok", detail: "logged in" }
      : { name, status: "fail", detail: "not logged in", fix: "claude auth login" };
  } catch (error) {
    const err = error as NodeJS.ErrnoException & { stderr?: string };
    if (err.code === "ENOENT") {
      return { name, status: "fail", detail: "not found", fix: "npm install -g @anthropic-ai/claude-code" };
    }
    return { name, status: "fail", detail: (err.stderr || err.message).trim() };
  }
}

const INSTALL = "install the workflow skills into ~/.claude/skills";

/** A skill counts as installed when its SKILL.md exists; skills carry no version to compare. */
export function checkSkills(home: string): CheckResult[] {
  return workflowSkills.map((name): CheckResult => {
    const installed = existsSync(join(home, ".claude", "skills", name, "SKILL.md"));
    return installed ? { name, status: "ok", detail: "installed" } : { name, status: "fail", detail: "not installed", fix: INSTALL };
  });
}
