import { existsSync, readdirSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import type { CheckResult } from "./checks.js";

export type Project = { name: string; dir: string };

export type ProjectChoice =
  | { kind: "selected"; project: Project; projects: Project[] }
  | { kind: "pick"; projects: Project[] }
  | { kind: "none"; projects: [] }
  | { kind: "error"; message: string };

const isProjectDir = (dir: string) => existsSync(join(dir, "requirements.md")) || existsSync(join(dir, "design.md"));

/** The nearest folder at or above `cwd` that has `specs/`, not above the git root; `cwd` when there is none. */
export function findRepoRoot(cwd: string): string {
  for (let dir = resolve(cwd); ; dir = dirname(dir)) {
    if (existsSync(join(dir, "specs"))) return dir;
    if (existsSync(join(dir, ".git")) || dirname(dir) === dir) return resolve(cwd);
  }
}

export function findProjects(repoRoot: string): Project[] {
  const specs = join(repoRoot, "specs");
  if (!existsSync(specs)) return [];
  return readdirSync(specs, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && isProjectDir(join(specs, entry.name)))
    .map((entry) => ({ name: entry.name, dir: join(specs, entry.name) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function resolveProject(repoRoot: string, pathArg: string | undefined): ProjectChoice {
  const projects = findProjects(repoRoot);
  if (pathArg !== undefined) {
    const dir = resolve(repoRoot, pathArg);
    if (!isProjectDir(dir)) return { kind: "error", message: `${pathArg} has no requirements.md or design.md` };
    return { kind: "selected", project: { name: basename(dir), dir }, projects };
  }
  const [only] = projects;
  if (projects.length === 1 && only) return { kind: "selected", project: only, projects };
  if (projects.length === 0) return { kind: "none", projects: [] };
  return { kind: "pick", projects };
}

export function projectCheck(choice: ProjectChoice, repoRoot: string): CheckResult {
  const name = "Project";
  switch (choice.kind) {
    case "selected":
      return { name, status: "ok", detail: relative(repoRoot, choice.project.dir) };
    case "pick":
      return { name, status: "warn", detail: `${choice.projects.length} found, pick one in the UI` };
    case "none":
      return { name, status: "warn", detail: "none in specs/", fix: "/to-brd" };
    case "error":
      return { name, status: "fail", detail: choice.message };
  }
}
