import { describe, expect, it } from "vitest";
import { ago, latest, splitCode } from "../ui/src/format.js";

describe("latest", () => {
  it("returns the newest time and ignores missing ones", () => {
    expect(latest([1000, undefined, 3000])).toBe(3000);
  });

  it.each([[[]], [[undefined, undefined]]])("returns undefined for %j", (times) => {
    expect(latest(times)).toBeUndefined();
  });
});

describe("ago", () => {
  const now = Date.UTC(2026, 10, 7, 12, 0);
  it.each([
    [undefined, ""],
    [now - 20_000, "just now"],
    [now - 5 * 60_000, "5m ago"],
    [now - 3 * 3_600_000, "3h ago"],
  ])("%s gives %s", (time, text) => {
    expect(ago(time, now)).toBe(text);
  });

  it("gives a date for anything older than a day", () => {
    expect(ago(Date.UTC(2026, 10, 2, 12, 0), now)).toMatch(/Nov\s*2|2\s*Nov/);
  });
});

describe("splitCode", () => {
  it("splits backtick spans out as code", () => {
    expect(splitCode("`loremaster login`: device flow, `dev seed` too")).toEqual([
      { code: true, text: "loremaster login" },
      { code: false, text: ": device flow, " },
      { code: true, text: "dev seed" },
      { code: false, text: " too" },
    ]);
  });

  it("keeps an unmatched backtick as text", () => {
    expect(splitCode("a ` b")).toEqual([{ code: false, text: "a ` b" }]);
  });
});
