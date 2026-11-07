import { chmodSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export function tempDir(prefix: string): string {
  return mkdtempSync(join(tmpdir(), `specyard-${prefix}-`));
}

/** A folder holding an executable `claude` that prints the given auth status. */
export function stubClaude(status: { loggedIn: boolean } | "crash" | "garbage"): string {
  const dir = tempDir("bin");
  // The real CLI exits 1 when logged out, with the status JSON still on stdout.
  const body =
    status === "crash"
      ? "echo boom >&2; exit 3"
      : status === "garbage"
        ? "echo not-json"
        : `echo '${JSON.stringify(status)}'; exit ${status.loggedIn ? 0 : 1}`;
  writeFileSync(join(dir, "claude"), `#!/bin/sh\n${body}\n`);
  chmodSync(join(dir, "claude"), 0o755);
  return dir;
}
