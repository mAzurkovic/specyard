# Spec tree model — Tasks

Status: draft

Scope: M1 F2. Parse the spec files into a `ProjectModel`, keep it current with a file watcher, and serve it through `GET /api/project` and the SSE stream from F1. No views (F3), no stale flags (F5).

## 1. Parse milestones.md [parallel]
- [x] 1.1 `src/parser/milestones.ts` `parseMilestones(text)`: `## M<n>. <Name>` headings and `- Needs: none.` / `- Needs: M1, M2.`. Returns `{ ok: true, milestones }` or `{ ok: false, line, expected }`. Unit tests on a fixture copied from the loremaster layout.
- [x] 1.2 Feature lines `F<k>. <name>: <line>. Docs: <list>. Needs: <ids>. Status: <s>.` with `Needs` forms `none`, `F1`, `F1, F3`, `M2 F3`. Unit tests for each form.
- [x] 1.3 A feature line with no `Needs:` parses with `needs: []` and `warning: 'no dependency list'` (FR21). A broken heading or feature line gives the line number and what was expected (FR20). Unit tests.

## 2. Parse tasks.md, progress.md and file headers [parallel]
- [x] 2.1 `src/parser/header.ts` `parseHeader(text)`: `<!-- sources: <path> <hash>, ... -->` and `Status: draft` / `Status: approved <hash>` under the title. Both optional. Unit tests.
- [x] 2.2 `src/parser/tasks.ts` `parseTasks(text)`: parents `## <n>. <title> [parallel]`, `[serial]`, `[parallel, needs 1]`, `[serial, needs 2, 3]`; checkboxes `- [ ] 1.1 ...` / `- [x] 1.1 ...` with ids. Unit tests, including a parent with no tag.
- [x] 2.3 `src/parser/progress.ts` `parseProgress(text)`: the `| Task | Status | Attempts | Last failure |` table, `Round:`, changed tests and rejected findings. Fix task ids `X<n>`; `F<n>` read as `X<n>` (FR67). Unit tests.
- [x] 2.4 Parse errors in all three return `{ ok: false, line, expected }` and never throw (FR20). Unit tests with broken input.

## 3. Build the ProjectModel [serial, needs 1, 2]
- [x] 3.1 `src/model.ts` types `ProjectModel`, `Milestone`, `Feature`, `Task`, `Stage`, `ParseIssue`, from `design.md` Data Model. Feature id shown as `M<n>·F<k>` (FR19).
- [x] 3.2 `src/readProject.ts` `readProject(projectDir)`: reads `requirements.md`, `design.md`, `milestones.md`, and each `m<n>-*/f<k>-*/` folder's `requirements.md`, `design.md`, `tasks.md`, `progress.md`. Matches folders to features by `m<n>` and `f<k>`. Returns raw texts by path. Unit test on a fixture tree.
- [x] 3.3 `buildModel(files)`: stages from files only. Docs lists design and no `design.md`: `needs-design`. No `tasks.md`: `needs-tasks`. `Status: draft` or no Status line: `tasks-in-review`. Approved and a dependency not done: `waits-on-deps`. Approved and all done: `ready`. milestones.md `Status: done`: `done` (FR16). Table tests.
- [x] 3.4 Dependency edges from feature `Needs` (same milestone and `M<n> F<k>`), critical path as the longest chain of features that are not done, and `canStartNow` with the next action per feature (FR17). Unit tests on a 3-milestone fixture.
- [x] 3.5 Parse issues attach to their file and feature. A feature with a `tasks.md` that does not parse gets `implementable: false`. The rest of the model still builds (FR20). Unit test.

## 4. Keep the model live [serial, needs 3]
- [x] 4.1 `src/watch.ts` `watchProject(dir, onChange)`: `fs.watch(dir, { recursive: true })`, ignores `.specyard/`, 150 ms debounce. Unit test with a temp dir.
- [x] 4.2 On change: `readProject` + `buildModel`, then send an SSE `project` event with the model. `GET /api/project` includes `model` for the current project. Test: write a file, the event arrives within 2 s (FR18, NFR1).
- [x] 4.3 `scripts/genFixture.ts`: generates a tree of 20 milestones, 200 features, 2,000 tasks. Test: `readProject` + `buildModel` on it takes under 300 ms, leaving room for the 1 s load target (NFR3).

## Dependencies
- 1 and 2 run in parallel.
- 3 needs 1 and 2.
- 4 needs 3.
