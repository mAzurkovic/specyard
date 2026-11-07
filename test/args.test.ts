import { describe, expect, it } from "vitest";
import { parseCliArgs } from "../src/args.js";

describe("parseCliArgs", () => {
  it("returns start with no path when given no flags", () => {
    expect(parseCliArgs([])).toEqual({ ok: true, command: "start", path: undefined });
  });

  it("returns version for --version", () => {
    expect(parseCliArgs(["--version"])).toEqual({ ok: true, command: "version" });
  });

  it("returns the project path for --path", () => {
    expect(parseCliArgs(["--path", "specs/ledger"])).toEqual({ ok: true, command: "start", path: "specs/ledger" });
  });

  it("rejects an unknown flag with usage text", () => {
    const result = parseCliArgs(["--nope"]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("--nope");
      expect(result.error).toContain("Usage: specyard");
    }
  });

  it("rejects --path without a value", () => {
    expect(parseCliArgs(["--path"]).ok).toBe(false);
  });

  it("rejects a stray positional argument", () => {
    expect(parseCliArgs(["serve"]).ok).toBe(false);
  });
});
