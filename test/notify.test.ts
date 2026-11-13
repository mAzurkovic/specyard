import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { notify } from "../src/notify.js";
import { tempDir } from "./helpers.js";

const path = process.env.PATH;
afterEach(() => {
  process.env.PATH = path;
});

/** Puts a stand-in for `name` on PATH that records its arguments, one per line. */
function stub(name: string): string {
  const dir = tempDir("bin");
  const log = join(dir, "args");
  writeFileSync(join(dir, name), `#!/bin/sh\nfor a in "$@"; do echo "$a" >> "${log}"; done\n`);
  chmodSync(join(dir, name), 0o755);
  process.env.PATH = `${dir}:/usr/bin:/bin`;
  return log;
}

describe("notify", () => {
  it("shows a macOS notification, with quotes in the text escaped", async () => {
    const log = stub("osascript");
    await notify("specyard", 'M1·F1 /to-design: "2 questions"', "darwin");
    expect(readFileSync(log, "utf8")).toBe('-e\ndisplay notification "M1·F1 /to-design: \\"2 questions\\"" with title "specyard"\n');
  });

  it("uses notify-send on Linux", async () => {
    const log = stub("notify-send");
    await notify("specyard", "M1·F1 /to-tasks: Claude wants to run npm test", "linux");
    expect(readFileSync(log, "utf8")).toBe("specyard\nM1·F1 /to-tasks: Claude wants to run npm test\n");
  });

  it("logs a notifier that fails instead of throwing", async () => {
    const dir = tempDir("bin");
    writeFileSync(join(dir, "osascript"), "#!/bin/sh\nexit 1\n");
    chmodSync(join(dir, "osascript"), 0o755);
    process.env.PATH = `${dir}:/usr/bin:/bin`;
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(notify("specyard", "x", "darwin")).resolves.toBeUndefined();
    expect(logged).toHaveBeenCalledWith(expect.stringContaining("cannot show a notification"));
    logged.mockRestore();
  });

  it("does nothing on Linux without notify-send, or on other systems", async () => {
    process.env.PATH = tempDir("empty");
    await expect(notify("specyard", "x", "linux")).resolves.toBeUndefined();
    const log = stub("osascript");
    await notify("specyard", "x", "win32");
    expect(existsSync(log)).toBe(false);
  });
});
