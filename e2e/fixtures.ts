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
