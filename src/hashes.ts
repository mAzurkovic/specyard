import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const HASH_LENGTH = 12;
const SOURCES_LINE = /^<!-- sources: (.*) -->$/m;

/** First 12 hex characters of the SHA-256 of the bytes, the form recorded on a sources line. */
export function hashBytes(bytes: Buffer | string): string {
  return createHash("sha256").update(bytes).digest("hex").slice(0, HASH_LENGTH);
}

export const hashText = (text: string) => hashBytes(Buffer.from(text, "utf8"));

export async function hashFile(path: string): Promise<string> {
  return hashBytes(await readFile(path));
}

/**
 * Replaces the recorded hash of each listed source on the sources line; every other byte stays the same.
 * Splits like the parser (on "," with any spacing) and edits only each `<path> <hash>` token.
 */
export function rewriteSources(text: string, hashes: Map<string, string>): string {
  return text.replace(SOURCES_LINE, (line, list: string) => {
    const start = line.indexOf(list);
    const updated = list
      .split(",")
      .map((part) => part.replace(/(\S+) ([0-9a-f]{12})/, (token, path: string) => (hashes.has(path) ? `${path} ${hashes.get(path)}` : token)))
      .join(",");
    return line.slice(0, start) + updated + line.slice(start + list.length);
  });
}
