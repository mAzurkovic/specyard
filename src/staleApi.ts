import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { hashFile, rewriteSources } from "./hashes.js";
import { readInside, resolveInside } from "./inside.js";
import type { ProjectModel } from "./model.js";
import { findOldVersion } from "./oldVersion.js";
import { parseHeader } from "./parser/header.js";
import type { StaleReason } from "./stale.js";
import { posix } from "node:path";

export type StaleDetails = {
  file: string;
  reasons: (StaleReason & { oldText: string | null; newText: string | null })[];
  /** Generated files that are stale through this one, directly or further down. */
  affected: string[];
};

/** Null when the file is not stale. Sources outside the project are never read. */
export async function staleDetails(projectDir: string, model: ProjectModel, file: string): Promise<StaleDetails | null> {
  const entry = model.stale.find((s) => s.file === file);
  if (!entry) return null;
  const reasons = await Promise.all(
    entry.reasons.map(async (reason) => {
      const current = await readInside(projectDir, reason.source);
      const newText = typeof current === "string" ? current : null;
      if (newText === null) return { ...reason, oldText: null, newText };
      // A source reached `via` a stale file has not changed itself; old and new are the same text.
      const oldText = reason.via ? newText : await findOldVersion(projectDir, reason.source, reason.recorded);
      return { ...reason, oldText, newText };
    }),
  );
  return { file, reasons, affected: downstream(model, file) };
}

function downstream(model: ProjectModel, file: string): string[] {
  const found = new Set<string>();
  const visit = (source: string) => {
    for (const s of model.stale) {
      if (!found.has(s.file) && s.reasons.some((r) => r.via && r.source === source)) {
        found.add(s.file);
        visit(s.file);
      }
    }
  };
  visit(file);
  return [...found].sort();
}

/** Writes the current hash of each source into the file's sources line. False when the file is not stale. */
export async function markNotAffected(projectDir: string, model: ProjectModel, file: string): Promise<boolean> {
  if (!model.stale.some((s) => s.file === file)) return false;
  const path = join(projectDir, file);
  const text = await readFile(path, "utf8");
  const header = parseHeader(text);
  if (!header.ok) return false;
  const dir = posix.dirname(file);
  const hashes = new Map<string, string>();
  for (const source of header.value.sources) {
    const real = await resolveInside(projectDir, posix.join(dir, source.path));
    // A missing or outside source keeps its recorded hash, so the file stays flagged for it.
    if (typeof real === "string") hashes.set(source.path, await hashFile(real));
  }
  await writeFile(path, rewriteSources(text, hashes));
  return true;
}
