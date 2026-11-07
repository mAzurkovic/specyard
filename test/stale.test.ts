import { describe, expect, it } from "vitest";
import { hashText } from "../src/hashes.js";
import { findStale } from "../src/stale.js";

const req = "# R\n\n- FR1. x\n";
const design = (reqHash: string) => `# D\n\n<!-- sources: requirements.md ${reqHash} -->\n`;
const tasks = (designHash: string, hldHash: string) => `# T\n\n<!-- sources: ../../design.md ${designHash}, ../../context/hld.md ${hldHash} -->\nStatus: draft\n`;
const hld = { path: "context/hld.md", size: 5, mtime: 0, hash: hashText("# HLD\n") };

function tree(over: Record<string, string> = {}) {
  const d = design(hashText(req));
  return new Map(Object.entries({
    "requirements.md": req,
    "design.md": d,
    "m1-core/f1-base/tasks.md": tasks(hashText(d), hld.hash),
    ...over,
  }));
}

describe("findStale", () => {
  it("finds nothing when every recorded hash matches", () => {
    expect(findStale(tree(), [hld])).toEqual([]);
  });

  it("flags a generated file whose source changed, and every file built from it", () => {
    const files = tree({ "requirements.md": "# R\n\n- FR1. changed\n" });
    expect(findStale(files, [hld])).toEqual([
      { file: "design.md", reasons: [{ source: "requirements.md", recorded: hashText(req), current: hashText("# R\n\n- FR1. changed\n"), via: false }] },
      { file: "m1-core/f1-base/tasks.md", reasons: [{ source: "design.md", recorded: hashText(files.get("design.md")!), current: hashText(files.get("design.md")!), via: true }] },
    ]);
  });

  it("flags a file whose context source changed", () => {
    const stale = findStale(tree(), [{ ...hld, hash: hashText("# HLD v2\n") }]);
    expect(stale).toEqual([
      { file: "m1-core/f1-base/tasks.md", reasons: [{ source: "context/hld.md", recorded: hld.hash, current: hashText("# HLD v2\n"), via: false }] },
    ]);
  });

  it("flags a file whose source is gone, with no current hash", () => {
    const files = tree();
    files.delete("requirements.md");
    expect(findStale(files, [hld])[0]).toMatchObject({ file: "design.md", reasons: [{ source: "requirements.md", current: null, via: false }] });
  });

  it("does not flag a generated file that was edited itself", () => {
    const files = tree();
    files.set("m1-core/f1-base/tasks.md", files.get("m1-core/f1-base/tasks.md") + "\n## 9. Added by hand [serial]\n");
    expect(findStale(files, [hld])).toEqual([]);
  });

  it("ignores files with no sources line", () => {
    expect(findStale(new Map([["design.md", "# D\n"], ["requirements.md", "# R\n"]]), [])).toEqual([]);
  });
});
