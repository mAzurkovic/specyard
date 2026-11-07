# Start and serve — Tasks

Status: draft

Scope: M1 F1. `specyard` installs, checks its setup, finds the project, and serves a UI shell on 127.0.0.1 with a token. No spec parsing (F2), no views (F3).

## 1. Install the CLI and print its version [serial]
- [x] 1.1 `package.json`: name `specyard`, `type: module`, `engines.node >=22`, `bin.specyard = dist/cli.js`, `files: [dist, ui/dist]`, scripts `build`, `typecheck`, `test`, `coverage`, `e2e`; deps `@anthropic-ai/claude-agent-sdk`, `preact`; dev deps `typescript`, `vitest`, `@vitest/coverage-v8`, `@playwright/test`, `vite`, `@preact/preset-vite`. `npm install` passes.
- [x] 1.2 `tsconfig.json` (strict, NodeNext, `src` to `dist`) and `vitest.config.ts` (v8 coverage over `src/**`). `npm run typecheck` and `npm test` pass on an empty suite.
- [x] 1.3 `src/args.ts` `parseArgs(argv)`: `--version`, `--path <dir>`, unknown flag gives an error with usage, built on `node:util` `parseArgs`. Unit tests for each flag and the error.
- [x] 1.4 `src/cli.ts` with `#!/usr/bin/env node`: `--version` prints the version from `package.json` and exits 0. Test: `npm pack`, `npm install -g` the tarball into a temp prefix, `specyard --version` prints the version (FR1).

## 2. Check the setup and find the project [serial, needs 1]
- [x] 2.1 `src/checks.ts` `checkClaude()`: runs `claude auth status --json` with `execFile`. Not found: fail "Claude Code not found" with the install link. `loggedIn: false`: fail with `claude auth login`. Unit tests with a stub `claude` on `PATH` for found and logged in, logged out, and missing (FR2, FR3).
- [x] 2.2 `src/checks.ts` `checkSkills(home)`: for `to-brd`, `to-design`, `to-milestones`, `to-tasks`, `implement-feature`, `verify`, `expert-review`, `pr`, read `version` from `<home>/.claude/skills/<name>/SKILL.md` frontmatter and compare with `src/expectedSkills.ts`. Missing: fail line with the name and `specyard skills install`. Older or no version: warning. Unit tests with a temp home (FR4).
- [x] 2.3 `src/projects.ts` `findProjects(repoRoot)`: folders in `<repoRoot>/specs/` that hold `requirements.md` or `design.md`, sorted by name. `resolveProject(projects, pathArg)`: `--path` wins, else the only project, else none (picker), else empty. `--path` to a folder that is not a project: error. Unit tests for 0, 1, 2 projects and `--path` (FR5, FR6).
- [x] 2.4 `src/report.ts` `printChecks(results)`: one line per check with `✓`, `!` or `✗` and the fix. Any Claude `✗`: exit 1 and start nothing. Unit test on the printed lines and the exit decision (FR2, FR3).

## 3. Serve the API on 127.0.0.1 with a token [parallel, needs 1]
- [x] 3.1 `src/server.ts` `startServer({ port: 4317 })`: `node:http` on `127.0.0.1` only, the next free port when 4317 is taken, a token from `crypto.randomBytes(16)` per start. Returns `{ url, token, close }`. Tests: bound address is 127.0.0.1, port fallback works (NFR6).
- [x] 3.2 `src/auth.ts` `authorize(req, token, origin)`: `/api/*` needs `?t=` or `X-Specyard-Token` equal to the token, and an `Origin` header, when present, equal to the server origin. Else 403. Static paths pass. Table tests: no token, wrong token, header token, foreign Origin, no Origin, static path (NFR7).
- [x] 3.3 `GET /api/project` returns `{ projects: [{ name, path }], current: { name, path } | null }`. `POST /api/project { name }` selects one of `projects`, else 400. Tests through `fetch`.
- [x] 3.4 `GET /api/events` (SSE): sends a `project` event with the `/api/project` body on connect and after each selection, plus a `:` comment every 15 s. Test reads the first event and the event after `POST /api/project`.
- [x] 3.5 Static serving of `ui/dist` with `index.html` fallback and correct `Content-Type`. Path outside `ui/dist` (`/../`): 404. Tests.

## 4. UI shell: header, picker, empty state [parallel, needs 3]
- [x] 4.1 `ui/vite.config.ts`, `ui/index.html`, `ui/src/main.tsx` with Preact; `ui/src/styles.css` from `specs/specyard/mocks/styles.css` with the Blueprint light tokens as the default. `npm run build` writes `ui/dist`.
- [x] 4.2 `ui/src/api.ts`: reads the token from `?t=` once, sends it as `X-Specyard-Token` on `fetch`, opens `EventSource('/api/events?t=…')`, and exposes the current project state.
- [x] 4.3 `ui/src/App.tsx`: header with logo, project name and path; picker list when `current` is null and there are projects (click posts `POST /api/project`); empty state "No project in specs/. Run /to-brd" when there are none (FR5, FR6).
- [x] 4.4 `e2e/shell.spec.ts` (headless Playwright): server on fixture repos with 1, 2 and 0 projects. Header shows the name; picker selects and the header updates; empty state text shows.

## 5. `specyard` starts end to end [serial, needs 2, 3, 4]
- [x] 5.1 `src/cli.ts` start: run checks, resolve the project, start the server, print the URL with the token, open the browser (`open` on macOS, `xdg-open` on Linux, print only when neither exists). Ctrl-C closes the server and exits 0 (FR7, NFR9).
- [x] 5.2 `e2e/start.spec.ts`: spawn `specyard --path specs/<fixture>` with stub `claude` and a stub `open` on `PATH`. The printed URL loads the header within 3 s of spawn (FR7, NFR4).
- [x] 5.3 `e2e/start.spec.ts`: stub `claude` reports `loggedIn: false`. `specyard` exits 1, prints `claude auth login`, and nothing listens on 4317 (FR3).

## Dependencies
- 1 blocks 2 and 3.
- 3 blocks 4.
- 5 needs 2, 3 and 4.
