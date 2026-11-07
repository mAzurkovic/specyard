import { describe, expect, it } from "vitest";
import { diffRows } from "../../ui/src/diffRows.js";

describe("diffRows", () => {
  it("gives a header per hunk and each line with its kind", () => {
    const before = Array.from({ length: 12 }, (_, i) => `line ${i + 1}`).join("\n") + "\n";
    const after = before.replace("line 6", "line six");
    expect(diffRows(before, after)).toEqual([
      { kind: "header", text: "@@ -3,7 +3,7 @@" },
      { kind: "same", text: "line 3" },
      { kind: "same", text: "line 4" },
      { kind: "same", text: "line 5" },
      { kind: "del", text: "line 6" },
      { kind: "add", text: "line six" },
      { kind: "same", text: "line 7" },
      { kind: "same", text: "line 8" },
      { kind: "same", text: "line 9" },
    ]);
  });

  it("drops the no-newline-at-end-of-file marker", () => {
    expect(diffRows("a\nb", "a\nc").map((r) => r.text)).toEqual(["@@ -1,2 +1,2 @@", "a", "b", "c"]);
  });
});
