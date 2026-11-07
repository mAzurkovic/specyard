# Specyard — Milestones

Source: `design.md`, `requirements.md`. Tracking document: update `Status` as work progresses (`not started`, `in progress`, `done`).

Build order: M1, then M2, then M3. Each milestone is usable on its own: M1 shows any spec tree, M2 plans from the UI, M3 builds and merges from the UI.

## M1. Read-only view
- Delivers: `specyard` starts in a repo, checks its setup, and serves a live graph, list and feature pages of the spec tree, with stale flags. No skill runs.
- Builds: `cli.ts` (start command, `--path`, `--version`), `checks.ts`, `server.ts` (static UI, `GET /api/project`, `GET /api/file`, `GET /api/events`, `POST /api/context`, token and Origin check), `parser/` (all 4 modules), `model.ts` (stages from files, dependency graph, critical path, can-start-now, stale flags), `watch.ts` (project folder), `hashes.ts` (hashes, sources line write), `git.ts` (default branch, file history), `ui/` (shell, graph, list, feature pages, stale page, Blueprint light).
- Covers: FR1, FR2, FR3, FR4, FR5, FR6, FR7, FR8, FR9, FR10 (list), FR11, FR14, FR15, FR16 (file-derived stages), FR17, FR18, FR19, FR20, FR21, FR22, FR45 (stale count), FR46, FR47, FR48, FR49, FR51, NFR1, NFR3, NFR4, NFR6, NFR7, NFR8, NFR9, NFR10.
- Exit criteria:
  - `specyard` in `~/workplace/loremaster` shows its milestones, their features, dependency edges and task states.
  - Claude Code logged out: no UI starts, fix command printed (FR3).
  - A spec file edit shows in the UI within 2 s (NFR1).
  - Graph and list load in under 1 s on a generated tree of 20 milestones, 200 features, 2,000 tasks (NFR3).
  - Start to UI ready under 3 s (NFR4).
  - Request without the token or from another Origin: 403 (NFR7). Server not reachable on a non-loopback address (NFR6).
  - A broken tasks.md shows an error badge with its line; the rest of the project still renders (FR20).
  - Changing a source file flags the generated file and every file built from it; "Mark as not affected" clears the flag and changes only the sources line (FR46, FR51).
- Needs: none.
- Features:
  - F1. Start and serve: CLI, start checks, project picker and `--path`, server on 127.0.0.1 with token and Origin check, SSE, UI header shell. Docs: tasks. Needs: none. Status: done.
  - F2. Spec tree model: parsers with parse errors, model build (stages, dependencies, critical path, can-start-now), watcher pushes the model over SSE. Docs: tasks. Needs: F1. Status: done.
  - F3. Graph and list views: milestone lanes and SVG edges, task tree with state icons, header counts, Blueprint light style. Docs: tasks. Needs: F2. Status: done.
  - F4. Feature pages and context: spec tabs, required and missing file states, context list, Add context file. Docs: tasks. Needs: F2. Status: done.
  - F5. Stale detection: hashes, stale flags passed down, stale page with git-history diff, Mark as not affected. Docs: tasks. Needs: F2, F3. Status: in progress.

## M2. Planning runs and inbox
- Delivers: plan a project from the UI. Run `/to-brd`, `/to-design`, `/to-milestones`, `/to-tasks` and `/expert-review`, answer question batches and approvals in the inbox, review diffs, approve tasks, act on stale files. Ships the changed skills and `specyard skills install`.
- Builds: `skills.ts` and bundled `skills/` (all skill changes), `runs/RunManager.ts` (planning runs: start, events, logs), `runs/events.ts`, `inbox.ts`, `notify.ts`, `hashes.ts` (blobs), `server.ts` (`POST /api/runs`, `GET /api/runs/:id`, `POST /api/inbox/:waitId`, `POST /api/features/:id/approve`), `model.ts` (run-derived stages: running, needs you), `ui/` (run view, inbox, diff, approve and re-run, stale actions).
- Covers: FR12, FR13, FR23, FR24, FR25, FR26, FR36 (planning runs), FR37, FR38, FR40, FR41, FR42, FR43, FR44, FR45 (inbox count), FR50, FR58, FR59, FR60, FR61, FR62, FR63, FR64, FR65, FR66, FR67, NFR2.
- Exit criteria:
  - `/to-tasks` on a feature runs from the UI, its question batch is answered in the inbox, and the new tasks.md shows as a diff with `Status: draft` and a sources line (FR24, FR42, FR65, FR66).
  - A run event shows in the UI within 1 s (NFR2).
  - A tool call that prompts in the CLI becomes an inbox approval; Approve and Skip both resume the run (FR37, FR43).
  - Submit stays disabled until every question in a batch has an answer; "Accept all" fills only unanswered ones (FR42).
  - Approving tasks writes `Status: approved <hash>`; editing a task afterwards sets the feature back to "tasks in review" (FR26).
  - `specyard skills install` on an empty `~/.claude/skills` installs every workflow skill; a symlinked or locally changed skill is not overwritten (FR12, FR13).
  - Run logs land in `specs/<project>/.specyard/` and `git status` shows nothing new (FR60).
- Needs: M1.
- Features:
  - F1. Skill changes and install: `version` frontmatter, batched questions, sources lines, `Status: draft`, `X<n>` fix tasks, progress line grammar, context reading, `specyard skills install`. Docs: tasks. Needs: none. Status: not started.
  - F2. Run a planning skill: RunManager on the SDK, events from the stream and progress lines, run logs, before and after diff, Re-run with comment. Docs: tasks. Needs: F1. Status: not started.
  - F3. Inbox: question batches and tool approvals through `canUseTool`, Submit and Accept all, OS notifications and tab title. Docs: tasks. Needs: F2. Status: not started.
  - F4. Approve and stale actions: approval line and its invalidation, re-run downstream skills from the stale page. Docs: tasks. Needs: F2. Status: not started.

## M3. Implement loop
- Delivers: build a feature from the UI through to merge. Implement in a worktree, watch the run live, stop, resume, survive the usage limit, merge from the evidence page.
- Builds: `runs/RunManager.ts` (implement runs, stop, resume, pause), `git.ts` (worktree add and remove, ancestry check), `prs.ts`, `watch.ts` (active worktrees), `cli.ts` (Ctrl-C prompt), `model.ts` (PR-derived stages, readiness, Implement gates), `server.ts` (`POST /api/runs/:id/stop`, `POST /api/runs/:id/resume`, `POST /api/prs/:n/merge`), `ui/` (live run view, evidence page).
- Covers: FR16 (PR and run stages), FR27, FR28, FR29, FR30, FR31, FR32, FR33, FR34, FR35, FR36 (implement runs), FR39, FR45 (running count), FR52, FR53, FR54, FR55, FR56, FR57, NFR5.
- Exit criteria:
  - Implement on a ready feature creates `../<repo>-m<n>-f<k>`, runs `/implement-feature`, and shows phases, subagents and time per phase live (FR28, FR31).
  - Two features implement at once in separate worktrees (FR29).
  - Closing the browser does not stop a run (FR32). Stop ends the run with progress.md intact; Resume continues from it (FR33, FR34).
  - Ctrl-C with a run going asks first; Yes stops the runs cleanly (FR35).
  - A simulated `rate_limit_event` with `status: rejected` pauses the run until `resetsAt`, then it resumes (FR39).
  - A PR merged on GitHub shows as done within 60 s, its worktree is removed when clean, and newly ready dependents notify (FR30, FR57, NFR5).
  - Evidence page lists open items first; Merge merges through `gh` after confirmation (FR53, FR54, FR56).
- Needs: M2.
- Features:
  - F1. Implement in a worktree: Implement gates, worktree add, implement run, live run view, stale warning on a running run. Docs: tasks. Needs: none. Status: not started.
  - F2. Stop, resume, quit, usage limit: stop by message then interrupt, Resume, Ctrl-C prompt, pause and auto-resume. Docs: tasks. Needs: F1. Status: not started.
  - F3. PRs and merge: `gh` polling, PR open and done stages, Merge, worktree removal, ready notifications. Docs: tasks. Needs: F1. Status: not started.
  - F4. Evidence page: open items first, done gate, coverage, verify, review, proof, PR. Docs: tasks. Needs: F1. Status: not started.

## Coverage
| Requirement or component | Milestones |
|---|---|
| FR1 to FR11 | M1 (FR10 run paths in M2) |
| FR12, FR13 | M2 |
| FR14, FR15, FR17 to FR22 | M1 |
| FR16 | M1, M2, M3 |
| FR23 to FR26 | M2 |
| FR27 to FR35 | M3 |
| FR36 | M2, M3 |
| FR37, FR38, FR40 to FR44 | M2 |
| FR39 | M3 |
| FR45 | M1, M2, M3 |
| FR46 to FR49, FR51 | M1 |
| FR50 | M2 |
| FR52 to FR57 | M3 |
| FR58 to FR67 | M2 |
| NFR1, NFR3, NFR4, NFR6 to NFR10 | M1 |
| NFR2 | M2 |
| NFR5 | M3 |
| `cli.ts` | M1, M3 |
| `checks.ts`, `parser/`, `watch.ts` | M1 (worktrees in M3) |
| `skills.ts`, `runs/events.ts`, `inbox.ts`, `notify.ts` | M2 |
| `model.ts`, `server.ts`, `ui/` | M1, M2, M3 |
| `hashes.ts` | M1, M2 |
| `git.ts` | M1, M3 |
| `runs/RunManager.ts` | M2, M3 |
| `prs.ts` | M3 |

## Open Questions
- OQ1. Is the npm name `specyard` free at publish time? Owner: Lead, before the first release.
- OQ2. Without `gh`, squash merges do not show as merged. Accepted limit (design OQ2).
