# Approve tasks — Tasks

Scope: M2 F4. Approve a feature's tasks, and notice when approved tasks change (FR26, FR58, FR59). Stale actions are removed with stale detection (Lead decision, 2026-11-11).

## 1. Approve tasks [serial]
- [ ] 1.1 `src/approve.ts` `approveTasks(projectDir, file)`: writes `Status: approved <hash>` under the title, the hash (first 12 hex of SHA-256) covering tasks.md without the Status line; nothing else in the file changes (FR26, FR58). Unit test: every other byte unchanged.
- [ ] 1.2 Model: `Status: approved <hash>` whose hash no longer matches the content gives `tasks-in-review` again, with a warning issue "tasks changed after approval" (FR26). Unit tests.
- [ ] 1.3 `POST /api/features/:id/approve`: 409 when tasks.md does not parse or is missing. "Approve tasks" button on the feature page's Tasks tab, as in mock 05. Server test and e2e.

## 2. Only these writes [serial, needs 1]
- [ ] 2.1 Test that lists every file write in `src/` and checks it is the approval line, a new file in `context/`, or under `.specyard/` (FR58, FR59).

## Dependencies
- 1 then 2.
