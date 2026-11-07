import { execFile } from "node:child_process";
import { readFile, realpath } from "node:fs/promises";
import { join, relative } from "node:path";
import { promisify } from "node:util";
import { hashText } from "./hashes.js";

const run = promisify(execFile);
const HASH = /^[0-9a-f]{12}$/;
const HISTORY_DEPTH = 50;

/**
 * The text a source had when its hash was recorded: a snapshot in `.specyard/blobs`, else the most recent
 * of the file's last 50 commits with that hash. Null when neither has it.
 */
export async function findOldVersion(projectDir: string, path: string, hash: string): Promise<string | null> {
  if (!HASH.test(hash)) return null;
  const snapshot = await readFile(join(projectDir, ".specyard", "blobs", hash), "utf8").catch(() => undefined);
  if (snapshot !== undefined) return snapshot;
  try {
    const root = (await run("git", ["-C", projectDir, "rev-parse", "--show-toplevel"])).stdout.trim();
    // git reports the real path; resolve symlinks (macOS /var -> /private/var) before comparing.
    const inRepo = relative(root, join(await realpath(projectDir), path));
    const commits = (await run("git", ["-C", root, "log", `-n${HISTORY_DEPTH}`, "--format=%H", "--", inRepo])).stdout.split("\n").filter(Boolean);
    for (const commit of commits) {
      const text = (await run("git", ["-C", root, "show", `${commit}:${inRepo}`], { maxBuffer: 16 * 1024 * 1024 })).stdout;
      if (hashText(text) === hash) return text;
    }
  } catch {
    // Not a git repo, or git is not installed: no history to look in.
  }
  return null;
}
