import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { hashFile, hashText, rewriteSources } from "../src/hashes.js";
import { tempDir } from "./helpers.js";

describe("hashFile", () => {
  it("is the first 12 hex characters of the SHA-256 of the file's bytes", async () => {
    const file = join(tempDir("hash"), "design.md");
    writeFileSync(file, "# Design\n\nÜmlaut and emoji 🙂\n");
    const expected = execFileSync("shasum", ["-a", "256", file], { encoding: "utf8" }).slice(0, 12);
    expect(await hashFile(file)).toBe(expected);
    expect(hashText("# Design\n\nÜmlaut and emoji 🙂\n")).toBe(expected);
  });
});

describe("rewriteSources", () => {
  const text = "# Tasks\n\n<!-- sources: ../../design.md 9c03de51aa48, ../../context/hld.md 77e01b2c9d40 -->\nStatus: draft\n\n## 1. A [serial]\n";

  it("changes only the hashes on the sources line", () => {
    const next = rewriteSources(text, new Map([["../../design.md", "aaaaaaaaaaaa"], ["../../context/hld.md", "bbbbbbbbbbbb"]]));
    expect(next).toBe(text.replace("9c03de51aa48", "aaaaaaaaaaaa").replace("77e01b2c9d40", "bbbbbbbbbbbb"));
  });

  it("keeps a source's hash when no new hash is given for it", () => {
    const next = rewriteSources(text, new Map([["../../design.md", "aaaaaaaaaaaa"]]));
    expect(next).toContain("../../context/hld.md 77e01b2c9d40");
  });

  it("keeps every source when the list has no space after a comma", () => {
    const tight = "<!-- sources: design.md 9c03de51aa48,context/hld.md 77e01b2c9d40 -->\n";
    expect(rewriteSources(tight, new Map([["design.md", "aaaaaaaaaaaa"]]))).toBe("<!-- sources: design.md aaaaaaaaaaaa,context/hld.md 77e01b2c9d40 -->\n");
  });

  it("treats $ in a path as plain text", () => {
    const odd = "<!-- sources: a$&b.md 9c03de51aa48 -->\n";
    expect(rewriteSources(odd, new Map([["a$&b.md", "aaaaaaaaaaaa"]]))).toBe("<!-- sources: a$&b.md aaaaaaaaaaaa -->\n");
  });

  it("returns the text unchanged when there is no sources line", () => {
    expect(rewriteSources("# T\n", new Map([["x", "aaaaaaaaaaaa"]]))).toBe("# T\n");
  });
});
