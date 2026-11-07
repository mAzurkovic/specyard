import { readFile, realpath } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";

/** True for `root` itself and anything below it. */
export const isInside = (root: string, path: string) => {
  const rel = relative(root, path);
  return rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
};

/** The real path of a file under `root`, or 403 when the path or its symlink target leaves `root`, or 404 when it does not exist. */
export async function resolveInside(root: string, path: string): Promise<string | 403 | 404> {
  const target = resolve(root, path);
  if (!isInside(root, target)) return 403;
  try {
    const [realRoot, real] = await Promise.all([realpath(root), realpath(target)]);
    return isInside(realRoot, real) ? real : 403;
  } catch {
    return 404;
  }
}

/** The text of a file under `root`, or 403 / 404 as for `resolveInside`; a folder or unreadable file is 404. */
export async function readInside(root: string, path: string): Promise<string | 403 | 404> {
  const real = await resolveInside(root, path);
  if (typeof real === "number") return real;
  return readFile(real, "utf8").catch(() => 404 as const);
}
