import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const uiDist = join(import.meta.dirname, "..", "ui", "dist");

/** A temp repo whose specs/ holds one folder per name, each a project. */
export function repoWithProjects(names: string[]): string {
  const repo = mkdtempSync(join(tmpdir(), "specyard-e2e-"));
  mkdirSync(join(repo, "specs"));
  for (const name of names) {
    mkdirSync(join(repo, "specs", name));
    writeFileSync(join(repo, "specs", name, "requirements.md"), `# ${name}\n`);
  }
  return repo;
}

/** A temp repo with one project `specs/ledger` holding the given files (paths relative to the project). */
export function repoWithFiles(files: Record<string, string>): string {
  const repo = mkdtempSync(join(tmpdir(), "specyard-e2e-"));
  for (const [path, text] of Object.entries(files)) {
    const full = join(repo, "specs", "ledger", path);
    mkdirSync(join(full, ".."), { recursive: true });
    writeFileSync(full, text);
  }
  return repo;
}
