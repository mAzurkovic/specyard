import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, expect, it } from "vitest";

const root = join(import.meta.dirname, "..");
const prefix = mkdtempSync(join(tmpdir(), "specyard-install-"));

beforeAll(() => {
  // prepack builds first and prints the build log; npm prints the tarball name last.
  const tarball = execFileSync("npm", ["pack", "--silent", "--pack-destination", prefix], { cwd: root, encoding: "utf8" }).trim().split("\n").at(-1)!;
  execFileSync("npm", ["install", "-g", "--silent", "--prefix", prefix, join(prefix, tarball)]);
}, 120_000);

afterAll(() => rmSync(prefix, { recursive: true, force: true }));

it("installed specyard prints its package version", () => {
  const { version } = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as { version: string };
  const out = execFileSync(join(prefix, "bin", "specyard"), ["--version"], { encoding: "utf8" });
  expect(out.trim()).toBe(version);
});
