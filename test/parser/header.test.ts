import { describe, expect, it } from "vitest";
import { parseHeader } from "../../src/parser/header.js";

describe("parseHeader", () => {
  it("reads the sources line and an approved status", () => {
    const text = "# Transfers — Tasks\n\n<!-- sources: ../../design.md 9c03de51aa48, ../../context/hld.md 77e01b2c9d40 -->\nStatus: approved a41f09c2e7b1\n\n## 1. x\n";
    expect(parseHeader(text)).toEqual({
      ok: true,
      value: {
        sources: [
          { path: "../../design.md", hash: "9c03de51aa48" },
          { path: "../../context/hld.md", hash: "77e01b2c9d40" },
        ],
        status: { kind: "approved", hash: "a41f09c2e7b1" },
      },
      warnings: [],
    });
  });

  it("reads a draft status with no sources line", () => {
    expect(parseHeader("# T\n\nStatus: draft\n")).toMatchObject({ ok: true, value: { sources: [], status: { kind: "draft" } } });
  });

  it("returns neither when the file has no header lines", () => {
    expect(parseHeader("# T\n\n## 1. x\n")).toMatchObject({ ok: true, value: { sources: [], status: undefined } });
  });

  it.each([
    ["<!-- sources: ../../design.md -->", 1],
    ["<!-- sources: ../../design.md XYZ -->", 1],
    ["Status: approved", 1],
    ["Status: shipped", 1],
  ])("reports a broken header line: %s", (line, at) => {
    expect(parseHeader(`${line}\n`)).toMatchObject({ ok: false, line: at });
  });
});
