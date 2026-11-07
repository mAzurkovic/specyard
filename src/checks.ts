import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import { expectedSkills } from "./expectedSkills.js";

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

const INSTALL = "specyard skills install";

export function checkSkills(home: string): CheckResult[] {
  return Object.entries(expectedSkills).map(([name, expected]) => {
    let text: string;
    try {
      text = readFileSync(join(home, ".claude", "skills", name, "SKILL.md"), "utf8");
    } catch {
      return { name, status: "fail", detail: "not installed", fix: INSTALL };
    }
    const version = frontmatterVersion(text);
    if (version === undefined) return { name, status: "warn", detail: `no version, expected ${expected} or newer`, fix: INSTALL };
    if (compareVersions(version, expected) < 0) {
      return { name, status: "warn", detail: `${version} is older than ${expected}`, fix: INSTALL };
    }
    return { name, status: "ok", detail: version };
  });
}

/** YAML allows the value quoted and the file in CRLF; both read as the bare version. */
function frontmatterVersion(text: string): string | undefined {
  const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text)?.[1] ?? "";
  return /^version:\s*["']?([^"'\s]+)["']?\s*$/m.exec(frontmatter)?.[1];
}

/** Numeric compare of an installed version against an expected one; an unreadable part counts as older. */
function compareVersions(installed: string, expected: string): number {
  const pa = installed.split(".").map(Number);
  const pb = expected.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (Number.isNaN(x)) return -1;
    if (x !== y) return x - y;
  }
  return 0;
}
