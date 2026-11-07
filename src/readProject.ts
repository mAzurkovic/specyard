import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import { hashBytes } from "./hashes.js";
import type { ContextFile, ProjectFiles } from "./model.js";

const PROJECT_FILES = ["requirements.md", "design.md", "milestones.md"];
const FEATURE_FILES = ["requirements.md", "design.md", "tasks.md", "progress.md"];
const CONTEXT_DIRS = ["context", "mocks"];
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

/** Modified time in ms of each path that exists. */
export async function readMtimes(projectDir: string, paths: Iterable<string>): Promise<Map<string, number>> {
  const times = new Map<string, number>();
  await Promise.all(
    [...paths].map(async (path) => {
      const info = await stat(join(projectDir, path)).catch(missingAsUndefined);
      if (info) times.set(path, info.mtimeMs);
    }),
  );
  return times;
}

/** Hash of each context file by path, kept while its size and mtime stay the same. Known limit: a rewrite within the same millisecond at the same size keeps the old hash until the next change. */
const hashCache = new Map<string, { size: number; mtime: number; hash: string }>();

/** Every file under the project's `context/` and `mocks/` folders, sorted by path; dot files are left out. */
export async function readContextFiles(projectDir: string): Promise<ContextFile[]> {
  const found = await Promise.all(
    CONTEXT_DIRS.map(async (dir) => {
      try {
        const entries = await readdir(join(projectDir, dir), { recursive: true, withFileTypes: true });
        return entries.filter((e) => e.isFile() && !e.name.startsWith(".")).map((e) => join(e.parentPath, e.name));
      } catch (error) {
        // Missing is normal; any other error (a plain file named mocks, no permission) must not hide the project.
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") console.error(`specyard: cannot list ${dir}/: ${(error as Error).message}`);
        return [];
      }
    }),
  );
  const files: ContextFile[] = [];
  await Promise.all(
    found.flat().map(async (file) => {
      // A file removed since the listing is simply not there any more.
      const info = await stat(file).catch(missingAsUndefined);
      if (!info) return;
      const mtime = Math.round(info.mtimeMs);
      const cached = hashCache.get(file);
      let hash = cached && cached.size === info.size && cached.mtime === mtime ? cached.hash : undefined;
      if (hash === undefined) {
        const bytes = await readFile(file).catch(missingAsUndefined);
        if (!bytes) return;
        hash = hashBytes(bytes);
        hashCache.set(file, { size: info.size, mtime, hash });
      }
      files.push({ path: relative(projectDir, file), size: info.size, mtime, hash });
    }),
  );
  return files.sort((a, b) => a.path.localeCompare(b.path));
}

async function subdirs(dir: string, pattern: RegExp): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  return entries.filter((e) => e.isDirectory() && pattern.test(e.name)).map((e) => e.name);
}

function missingAsUndefined(error: NodeJS.ErrnoException): undefined {
  if (error.code === "ENOENT") return undefined;
  throw error;
}
