import { expect, test } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { connect } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { repoWithProjects } from "./fixtures.js";

const cli = join(import.meta.dirname, "..", "dist", "cli.js");

/** A PATH holding node, a stub `claude` with the given login state, and stub `open`/`xdg-open` that record their call. */
function stubPath(loggedIn: boolean, withOpener = true): { path: string; openedFile: string } {
  const bin = mkdtempSync(join(tmpdir(), "specyard-bin-"));
  const openedFile = join(bin, "opened");
  const script = (name: string, body: string) => {
    writeFileSync(join(bin, name), `#!/bin/sh\n${body}\n`);
    chmodSync(join(bin, name), 0o755);
  };
  script("claude", `echo '{"loggedIn":${loggedIn}}'; exit ${loggedIn ? 0 : 1}`);
  if (withOpener) {
    script("open", `echo "$1" > ${openedFile}`);
    script("xdg-open", `echo "$1" > ${openedFile}`);
  }
  return { path: `${bin}:${dirname(process.execPath)}`, openedFile };
}

function run(cwd: string, args: string[], path: string): ChildProcess {
  const home = mkdtempSync(join(tmpdir(), "specyard-home-"));
  return spawn(process.execPath, [cli, ...args], { cwd, env: { PATH: path, HOME: home } });
}

// Both tests touch the default port, so they must not overlap.
test.describe.configure({ mode: "serial" });

let child: ChildProcess | undefined;
test.afterEach(async () => {
  if (child && child.exitCode === null) {
    const exited = new Promise((resolve) => child!.once("exit", resolve));
    child.kill("SIGINT");
    await exited;
  }
});

test("starts, prints the URL and serves the header within 3 s", async ({ page }) => {
  const repo = repoWithProjects(["api", "ledger"]);
  const { path, openedFile } = stubPath(true);
  const started = Date.now();
  child = run(repo, ["--path", "specs/ledger"], path);
  const url = await new Promise<string>((resolve, reject) => {
    let out = "";
    child!.stdout!.on("data", (chunk: Buffer) => {
      out += chunk.toString();
      const match = /→ UI at (\S+)/.exec(out);
      if (match?.[1]) resolve(match[1]);
    });
    child!.on("exit", (code) => reject(new Error(`exited ${code}: ${out}`)));
  });
  await page.goto(url);
  await expect(page.locator("header .proj")).toContainText("ledger");
  expect(Date.now() - started).toBeLessThan(3000);
  await expect.poll(() => existsSync(openedFile)).toBe(true);
});

function outputUntil(proc: ChildProcess, pattern: RegExp): Promise<string> {
  return new Promise((resolve, reject) => {
    let out = "";
    const onData = (chunk: Buffer) => {
      out += chunk.toString();
      if (pattern.test(out)) resolve(out);
    };
    proc.stdout!.on("data", onData);
    proc.stderr!.on("data", onData);
    proc.on("exit", () => (pattern.test(out) ? resolve(out) : reject(new Error(out))));
  });
}

test("no browser opener: prints the URL to open by hand", async () => {
  const { path } = stubPath(true, false);
  child = run(repoWithProjects(["ledger"]), [], path);
  expect(await outputUntil(child, /Open the URL in your browser/)).toMatch(/→ UI at http:\/\/127\.0\.0\.1:\d+\/\?t=[0-9a-f]{32}/);
});

test("--path to a folder that is not a project: exits 2 with the reason", async () => {
  const { path } = stubPath(true);
  child = run(repoWithProjects(["ledger"]), ["--path", "specs/missing"], path);
  const out = await outputUntil(child, /has no requirements\.md or design\.md/);
  const code = child.exitCode ?? (await new Promise<number | null>((resolve) => child!.on("exit", resolve)));
  expect(code).toBe(2);
  expect(out).not.toContain("UI at");
});

test("Ctrl-C right after the URL is printed exits 0", async () => {
  const { path } = stubPath(true);
  const repo = repoWithProjects(["ledger"]);
  for (let i = 0; i < 15; i++) {
    const proc = run(repo, [], path);
    await outputUntil(proc, /→ UI at /);
    const exit = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve) =>
      proc.on("exit", (code, signal) => resolve({ code, signal })),
    );
    proc.kill("SIGINT");
    expect(await exit).toEqual({ code: 0, signal: null });
  }
});

test("run from a subfolder of the repo: finds the project in the repo's specs/", async () => {
  const { path } = stubPath(true);
  const repo = repoWithProjects(["ledger"]);
  mkdirSync(join(repo, ".git"));
  mkdirSync(join(repo, "src", "deep"), { recursive: true });
  child = run(join(repo, "src", "deep"), [], path);
  expect(await outputUntil(child, /→ UI at /)).toContain("✓ Project: specs/ledger");
});

test("logged out: exits 1 with the login command and serves nothing", async () => {
  const { path } = stubPath(false);
  child = run(repoWithProjects(["ledger"]), [], path);
  let out = "";
  child.stdout!.on("data", (chunk: Buffer) => (out += chunk.toString()));
  const code = await new Promise<number | null>((resolve) => child!.on("exit", resolve));
  expect(code).toBe(1);
  expect(out).toContain("claude auth login");
  expect(out).not.toContain("UI at");
  const listening = await new Promise<boolean>((resolve) => {
    const socket = connect(4317, "127.0.0.1", () => {
      socket.destroy();
      resolve(true);
    });
    socket.on("error", () => resolve(false));
  });
  expect(listening).toBe(false);
});
