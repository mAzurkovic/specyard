import { readFile, writeFile } from "node:fs/promises";
import { join, posix } from "node:path";
import { hashFile, hashText, rewriteSources } from "./hashes.js";
import { readInside, resolveInside } from "./inside.js";
import type { ProjectModel } from "./model.js";
import { findOldVersion } from "./oldVersion.js";
import { parseHeader } from "./parser/header.js";
import type { StaleReason } from "./stale.js";

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

export type MarkResult = "marked" | "not-stale" | "through-another";

/**
 * Writes the current hash of each source into the file's sources line. A file stale only through another
 * stale file has nothing to rewrite: that other file is resolved first.
 */
export async function markNotAffected(projectDir: string, model: ProjectModel, file: string): Promise<MarkResult> {
  const entry = model.stale.find((s) => s.file === file);
  if (!entry) return "not-stale";
  if (entry.reasons.every((r) => r.via)) return "through-another";
  const path = join(projectDir, file);
  const text = await readFile(path, "utf8");
  const header = parseHeader(text);
  if (!header.ok) return "not-stale";
  const dir = posix.dirname(file);
  const hashes = new Map<string, string>();
  for (const source of header.value.sources) {
    const hash = await currentHash(projectDir, posix.normalize(posix.join(dir, source.path)));
    // A missing or outside source keeps its recorded hash, so the file stays flagged for it.
    if (hash !== null) hashes.set(source.path, hash);
  }
  await writeFile(path, rewriteSources(text, hashes));
  return "marked";
}

/** Hashes a source the way the stale check does: context and mock files by bytes, spec files by their text. */
async function currentHash(projectDir: string, path: string): Promise<string | null> {
  if (path.startsWith("context/") || path.startsWith("mocks/")) {
    const real = await resolveInside(projectDir, path);
    return typeof real === "string" ? hashFile(real) : null;
  }
  const text = await readInside(projectDir, path);
  return typeof text === "string" ? hashText(text) : null;
}
