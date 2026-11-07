import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { ProjectFiles } from "./model.js";

const PROJECT_FILES = ["requirements.md", "design.md", "milestones.md"];
const FEATURE_FILES = ["requirements.md", "design.md", "tasks.md", "progress.md"];
const MILESTONE_DIR = /^m\d+-/;
const FEATURE_DIR = /^f\d+-/;

export async function readProject(projectDir: string): Promise<ProjectFiles> {
  const paths = [...PROJECT_FILES];
  for (const milestone of await subdirs(projectDir, MILESTONE_DIR)) {
    for (const feature of await subdirs(join(projectDir, milestone), FEATURE_DIR)) {
      paths.push(...FEATURE_FILES.map((file) => `${milestone}/${feature}/${file}`));
    }
  }
  const files: ProjectFiles = new Map();
  await Promise.all(
    paths.map(async (path) => {
      const text = await readFile(join(projectDir, path), "utf8").catch(missingAsUndefined);
      if (text !== undefined) files.set(path, text);
    }),
  );
  return files;
}

async function subdirs(dir: string, pattern: RegExp): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  return entries.filter((e) => e.isDirectory() && pattern.test(e.name)).map((e) => e.name);
}

function missingAsUndefined(error: NodeJS.ErrnoException): undefined {
  if (error.code === "ENOENT") return undefined;
  throw error;
}
