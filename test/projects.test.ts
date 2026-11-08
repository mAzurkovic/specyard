import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { findProjects, findRepoRoot, projectCheck, resolveProject } from "../src/projects.js";
import { tempDir } from "./helpers.js";

function repoWith(folders: Record<string, string[]>): string {
  const repo = tempDir("repo");
  for (const [name, files] of Object.entries(folders)) {
    mkdirSync(join(repo, "specs", name), { recursive: true });
    for (const file of files) writeFileSync(join(repo, "specs", name, file), "# x\n");
  }
  return repo;
}

describe("findProjects", () => {
  it("finds folders that hold requirements.md or design.md, sorted by name", () => {
    const repo = repoWith({ ledger: ["design.md"], api: ["requirements.md"], notes: ["ideas.md"] });
    expect(findProjects(repo).map((p) => p.name)).toEqual(["api", "ledger"]);
  });

  it("returns none when there is no specs folder", () => {
    expect(findProjects(tempDir("bare"))).toEqual([]);
  });
});

describe("resolveProject", () => {
  it("selects the only project", () => {
    const repo = repoWith({ ledger: ["design.md"] });
    expect(resolveProject(repo, undefined)).toMatchObject({ kind: "selected", project: { name: "ledger" } });
  });

  it("asks for a pick when there are several", () => {
    const repo = repoWith({ a: ["design.md"], b: ["design.md"] });
    expect(resolveProject(repo, undefined)).toMatchObject({ kind: "pick" });
  });

  it("reports none when there are no projects", () => {
    expect(resolveProject(repoWith({}), undefined)).toEqual({ kind: "none", projects: [] });
  });

  it("selects the --path project even when there are several", () => {
    const repo = repoWith({ a: ["design.md"], b: ["design.md"] });
    expect(resolveProject(repo, "specs/b")).toMatchObject({ kind: "selected", project: { name: "b" } });
  });

  it("rejects a --path folder that is not a project", () => {
    const repo = repoWith({ notes: ["ideas.md"] });
    expect(resolveProject(repo, "specs/notes")).toMatchObject({ kind: "error" });
  });
});

describe("projectCheck", () => {
  const ledger = { name: "ledger", dir: "/repo/specs/ledger" };

  it("passes with the selected project's folder", () => {
    expect(projectCheck({ kind: "selected", project: ledger, projects: [ledger] }, "/repo")).toEqual({
      name: "Project",
      status: "ok",
      detail: "specs/ledger",
    });
  });

  it("warns when several projects need a pick", () => {
    const result = projectCheck({ kind: "pick", projects: [ledger, { name: "api", dir: "/repo/specs/api" }] }, "/repo");
    expect(result).toMatchObject({ status: "warn", detail: "2 found, pick one in the UI" });
  });

  it("warns with the next step when there is none", () => {
    expect(projectCheck({ kind: "none", projects: [] }, "/repo")).toMatchObject({ status: "warn", fix: "/to-brd" });
  });

  it("fails with the reason for a bad --path", () => {
    expect(projectCheck({ kind: "error", message: "specs/x has no requirements.md or design.md" }, "/repo")).toMatchObject({
      status: "fail",
      detail: "specs/x has no requirements.md or design.md",
    });
  });
});

describe("findRepoRoot", () => {
  function gitRepo(): string {
    const root = tempDir("walk");
    mkdirSync(join(root, ".git"));
    mkdirSync(join(root, "specs", "ledger"), { recursive: true });
    mkdirSync(join(root, "src", "deep"), { recursive: true });
    return root;
  }

  it("returns the folder itself when it has specs/", () => {
    const root = gitRepo();
    expect(findRepoRoot(root)).toBe(root);
  });

  it("walks up from a subfolder to the folder with specs/", () => {
    const root = gitRepo();
    expect(findRepoRoot(join(root, "src", "deep"))).toBe(root);
  });

  it("stops at the git root and returns the start folder when no specs/ is found", () => {
    const root = tempDir("nospecs");
    mkdirSync(join(root, ".git"));
    mkdirSync(join(root, "src"));
    expect(findRepoRoot(join(root, "src"))).toBe(join(root, "src"));
  });

  it("does not walk past the git root to a parent's specs/", () => {
    const outer = tempDir("outer");
    mkdirSync(join(outer, "specs"));
    const inner = join(outer, "inner");
    mkdirSync(join(inner, ".git"), { recursive: true });
    mkdirSync(join(inner, "src"));
    expect(findRepoRoot(join(inner, "src"))).toBe(join(inner, "src"));
  });
});
