# Follow-ups — Tasks

Status: draft

Scope: M1 F6. The open review findings and follow-ups that F1 to F5 recorded in their progress.md files and PRs, plus one decision by the Lead: find the project from a repo subfolder. No new features.

## 1. Start and package [parallel]
- [x] 1.1 `src/projects.ts` `findRepoRoot(cwd)`: walk up from `cwd` to the first folder that has `specs/`, stopping at the git root (a folder with `.git`). `src/cli.ts` uses it before `resolveProject`. `--path` still resolves from `cwd`. Unit tests: from the repo root, from a subfolder, with no `specs/` up to the git root.
- [x] 1.2 `package.json` `prepack`: runs `npm run build`, so a published package always holds `dist/` and `ui/dist/`. The install test stops building by hand and relies on it.
- [x] 1.3 `src/server.ts` returns the real bound address from `server.address()`; the test asserts on it, not on a constant.
- [x] 1.4 `src/checks.ts` frontmatter `version`: accepts a quoted value (`"1.0.0"`, `'1.0.0'`) and CRLF line endings. Unit tests.

## 2. Parsers and model [parallel]
- [x] 2.1 `src/model.ts`: a `tasks.md` whose header (Status or sources line) does not parse makes the feature not implementable, like a broken body. Unit test.
- [x] 2.2 `src/parser/progress.ts`: list headings checked with `Object.hasOwn`, so a line such as `toString` cannot throw. Unit test.
- [x] 2.3 `src/parser/tasks.ts`: an uppercase `- [X]` task counts as done. Unit test.
- [x] 2.4 `Issue` gains `feature?: string`, set for issues from a feature's files and for feature lines in milestones.md. The UI error badge uses it instead of matching folders. Unit tests.

## 3. Files and watcher [parallel]
- [x] 3.1 `src/readProject.ts` `readContextFiles`: skip names that start with `.` (`.DS_Store`, editor swap files). Unit test.
- [x] 3.2 `readContextFiles`: a folder that cannot be read (not a folder, no permission) is logged and counts as empty; the rest of the project still loads. Unit test with a file named `mocks`.
- [x] 3.3 `readContextFiles`: reuse a file's last hash when its size and mtime are unchanged, so a rebuild does not re-read every context file. Unit test that an unchanged file is not read again.
- [x] 3.4 `src/watch.ts`: listen for the watcher's `error` event (Linux sends one when the watched folder is deleted), log it and stop watching instead of crashing. Unit test with an emitted error.
- [x] 3.5 `test/watch.test.ts` burst test: count callbacks after the burst settles with a longer debounce in the test, so a busy machine cannot split one burst into two. Server test that two quick project switches leave one open watcher (wrap `watchProject` and count open minus closed).

## 4. Graph, feature and stale pages [parallel]
- [x] 4.1 `ui/src/graph/layout.ts`: lane-skipping edges get their own tracks (column offset by source row, channel offset by target lane, inside the free gaps). Unit test: no two edges with a different source and a different target share a segment.
- [x] 4.2 Graph node: `aria-pressed` for the selected node; the hint says "Click or press Space to see its details. Double-click or press Enter to open it." Issues panel: show `:line` only when the line is above 0.
- [x] 4.3 `ui/src/views/Steps.tsx`: hold the stepper at Requirements only while no later file (design.md, tasks.md) exists. Unit test for a ready feature with no requirements.md.
- [x] 4.4 Stale page: a file stale only through another file hides "Mark as not affected" and links "Resolve <source> first"; `POST /api/stale/not-affected` on such a file answers 409. Server test.
- [x] 4.5 Stale page: reload when the file's stale reasons change, and ignore a response that arrives after a newer one. The diff shows hunks with three lines of context and `@@` headers (jsdiff `structuredPatch`), as in mock 08. e2e: edit the source again with the page open, the diff updates.
- [x] 4.6 Small code fixes: `markNotAffected` hashes text the same way as `findStale` (a non-UTF-8 source no longer stays stale forever); `Feature.staleFiles` replaces the repeated folder match in the feature page; merge the two `node:path` imports in `src/staleApi.ts`; put the `useProjectState` doc comment back on it; `rewriteSources` rebuilds the line directly; one name for the shadowed `input` in `AddContextFile`.

## Dependencies
- 1, 2, 3 and 4 run in parallel.
- 2.4 before the badge part of 4.2 if both touch the Issues panel; otherwise none.
