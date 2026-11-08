import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it, vi } from "vitest";
import type { Project } from "../src/projects.js";
import { tempDir } from "./helpers.js";

// Pass-through spy: every real watcher is still created; the test only counts which are still open.
let open = 0;
vi.mock("../src/watch.js", async (original) => {
  const real = await original<typeof import("../src/watch.js")>();
  return {
    watchProject: (...args: Parameters<typeof real.watchProject>) => {
      const stop = real.watchProject(...args);
      open++;
      let stopped = false;
      return () => {
        if (!stopped) open--;
        stopped = true;
        stop();
      };
    },
  };
});

it("two quick project switches leave exactly one watcher open, and none after close", async () => {
  const { startServer } = await import("../src/server.js");
  const projects: Project[] = ["a", "b"].map((name) => {
    const dir = join(tempDir("switch"), "specs", name);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "requirements.md"), `# ${name}\n`);
    return { name, dir };
  });
  const ui = tempDir("ui");
  writeFileSync(join(ui, "index.html"), "<!doctype html>");
  const server = await startServer({ port: 0, projects, current: projects[0]!, uiDir: ui });
  const select = (name: string) =>
    fetch(`${server.url}/api/project`, { method: "POST", headers: { "X-Specyard-Token": server.token }, body: JSON.stringify({ name }) });
  await Promise.all([select("b"), select("a")]);
  expect(open).toBe(1);
  await server.close();
  expect(open).toBe(0);
});
