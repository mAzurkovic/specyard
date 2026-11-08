#!/usr/bin/env node
import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { parseCliArgs } from "./args.js";
import { checkClaude, checkSkills } from "./checks.js";
import { findRepoRoot, projectCheck, resolveProject } from "./projects.js";
import { formatChecks } from "./report.js";
import { startServer } from "./server.js";

const DEFAULT_PORT = 4317;
const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string };

const args = parseCliArgs(process.argv.slice(2));
if (!args.ok) {
  console.error(args.error);
  process.exit(2);
}
if (args.command === "version") {
  console.log(pkg.version);
} else {
  await start(args.path);
}

async function start(pathArg: string | undefined): Promise<void> {
  console.log(`specyard ${pkg.version}`);
  // `--path` is relative to where the user typed it; without it, look up from there to the repo's specs/.
  const root = pathArg === undefined ? findRepoRoot(process.cwd()) : process.cwd();
  const choice = resolveProject(root, pathArg);
  const { lines, start: ok } = formatChecks([await checkClaude(), ...checkSkills(homedir()), projectCheck(choice, root)]);
  lines.forEach((line) => console.log(line));
  if (!ok) process.exit(1);
  if (choice.kind === "error") process.exit(2);
  const server = await startServer({
    port: DEFAULT_PORT,
    projects: choice.projects,
    current: choice.kind === "selected" ? choice.project : null,
    uiDir: fileURLToPath(new URL("../ui/dist", import.meta.url)),
  });
  // Registered before the URL is printed, so a Ctrl-C right after it still exits cleanly.
  process.once("SIGINT", () => void server.close().then(() => process.exit(0)));
  const url = `${server.url}/?t=${server.token}`;
  console.log(`→ UI at ${url}`);
  openBrowser(url);
}

function openBrowser(url: string): void {
  const opener = process.platform === "darwin" ? "open" : "xdg-open";
  execFile(opener, [url], (error) => {
    if (error) console.log(`  Open the URL in your browser (${opener}: ${error.message})`);
  });
}
