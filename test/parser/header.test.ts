import { describe, expect, it } from "vitest";
import { parseHeader } from "../../src/parser/header.js";

describe("parseHeader", () => {
  it("reads an approved status", () => {
    expect(parseHeader("# Transfers — Tasks\n\nStatus: approved a41f09c2e7b1\n\n## 1. x\n")).toEqual({
      ok: true,
      value: { status: { kind: "approved", hash: "a41f09c2e7b1" } },
      warnings: [],
    });
  });

  it("reads a draft status", () => {
    expect(parseHeader("# T\n\nStatus: draft\n")).toMatchObject({ ok: true, value: { status: { kind: "draft" } } });
  });

  it("returns no status when the file has no Status line", () => {
    expect(parseHeader("# T\n\n## 1. x\n")).toMatchObject({ ok: true, value: { status: undefined } });
  });

  it("ignores an HTML comment such as an old sources line, even a malformed one", () => {
    expect(parseHeader("# T\n\n<!-- sources: ../../design.md -->\nStatus: draft\n")).toMatchObject({ ok: true, value: { status: { kind: "draft" } } });
  });

  it.each([["Status: approved"], ["Status: shipped"]])("reports a broken Status line: %s", (line) => {
    expect(parseHeader(`${line}\n`)).toMatchObject({ ok: false, line: 1 });
  });
});
