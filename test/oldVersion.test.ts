import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { hashText } from "../src/hashes.js";
import { findOldVersion } from "../src/oldVersion.js";
import { tempDir } from "./helpers.js";

function repo(): { project: string; commit: (text: string) => void } {
  const root = tempDir("git");
  const git = (...args: string[]) => execFileSync("git", ["-C", root, ...args], { stdio: "pipe" });
  git("init", "-q");
  git("config", "user.email", "t@example.com");
  git("config", "user.name", "t");
  const project = join(root, "specs", "p");
  mkdirSync(project, { recursive: true });
  return {
    project,
    commit: (text) => {
      writeFileSync(join(project, "design.md"), text);
      git("add", ".");
      git("commit", "-q", "-m", "x");
    },
  };
}

describe("findOldVersion", () => {
  it("finds the committed version whose hash matches", async () => {
    const { project, commit } = repo();
    commit("# D v1\n");
    commit("# D v2\n");
    writeFileSync(join(project, "design.md"), "# D v3, not committed\n");
    expect(await findOldVersion(project, "design.md", hashText("# D v1\n"))).toBe("# D v1\n");
    expect(await findOldVersion(project, "design.md", hashText("# D v2\n"))).toBe("# D v2\n");
  });

  it("prefers a saved snapshot in .specyard/blobs", async () => {
    const { project, commit } = repo();
    commit("# D v1\n");
    const hash = hashText("# D from a snapshot\n");
    mkdirSync(join(project, ".specyard", "blobs"), { recursive: true });
    writeFileSync(join(project, ".specyard", "blobs", hash), "# D from a snapshot\n");
    expect(await findOldVersion(project, "design.md", hash)).toBe("# D from a snapshot\n");
  });

  it("returns null when no version matches", async () => {
    const { project, commit } = repo();
    commit("# D v1\n");
    expect(await findOldVersion(project, "design.md", "000000000000")).toBeNull();
  });

  it("returns null outside a git repo", async () => {
    const dir = tempDir("nogit");
    writeFileSync(join(dir, "design.md"), "# D\n");
    expect(await findOldVersion(dir, "design.md", "000000000000")).toBeNull();
  });
});
