import { posix } from "node:path";
import { hashText } from "./hashes.js";
import type { ContextFile, ProjectFiles } from "./model.js";
import { parseHeader } from "./parser/header.js";

/** `via`: the source matches its recorded hash but is itself stale, so this file is stale through it. */
export type StaleReason = { source: string; recorded: string; current: string | null; via: boolean };
export type StaleFile = { file: string; reasons: StaleReason[] };

/**
 * A generated file is stale when a source's hash no longer matches the one recorded on its sources line,
 * or when a source is itself a stale generated file. Edits to the generated file itself never make it stale.
 */
export function findStale(files: ProjectFiles, contextFiles: Pick<ContextFile, "path" | "hash">[]): StaleFile[] {
  const contextHashes = new Map(contextFiles.map((f) => [f.path, f.hash]));
  const currentHash = (path: string) => {
    const text = files.get(path);
    return text === undefined ? (contextHashes.get(path) ?? null) : hashText(text);
  };
  const sources = new Map<string, { path: string; recorded: string }[]>();
  for (const [file, text] of files) {
    const header = parseHeader(text);
    if (!header.ok || header.value.sources.length === 0) continue;
    const dir = posix.dirname(file);
    sources.set(file, header.value.sources.map((s) => ({ path: posix.normalize(posix.join(dir, s.path)), recorded: s.hash })));
  }

  const memo = new Map<string, StaleReason[]>();
  const reasonsFor = (file: string, seen: Set<string>): StaleReason[] => {
    const known = memo.get(file);
    if (known) return known;
    if (seen.has(file)) return [];
    seen.add(file);
    const reasons: StaleReason[] = [];
    for (const { path, recorded } of sources.get(file) ?? []) {
      const current = currentHash(path);
      if (current !== recorded) reasons.push({ source: path, recorded, current, via: false });
      else if (reasonsFor(path, seen).length > 0) reasons.push({ source: path, recorded, current, via: true });
    }
    memo.set(file, reasons);
    return reasons;
  };

  return [...sources.keys()]
    .sort()
    .map((file) => ({ file, reasons: reasonsFor(file, new Set()) }))
    .filter((s) => s.reasons.length > 0);
}
