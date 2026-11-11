# Simplify — Tasks

Scope: M2 F1. Keep it simple (Lead decision, 2026-11-11): remove stale detection and skill version checks from the app, and add one standalone option to the planning skills. Specyard invokes the skills as they are (FR63).

## 1. Remove stale detection [serial]
- [x] 1.1 Delete `src/stale.ts`, `src/staleApi.ts`, `src/oldVersion.ts`, `src/hashes.ts` and their tests; remove `GET /api/stale` and `POST /api/stale/not-affected` from `src/server.ts`.
- [x] 1.2 `src/model.ts`: remove `stale`, `staleCount`, `Feature.stale`, `Feature.staleFiles`. `src/readProject.ts`: context files no longer carry a hash; remove the hash cache. Update the model and readProject tests.
- [x] 1.3 UI: delete `ui/src/views/StalePage.tsx`, the `stale` route, `StaleBadge`, the header stale chip, the stale marks in the sidebar and the feature page banner. Keep `ui/src/diffRows.ts` and `diff` (the run view reuses them). Delete `e2e/stale.spec.ts`.
- [x] 1.4 Check: `grep -rni stale src ui/src test e2e` finds nothing but unrelated words; all tests pass.

## 2. Presence-only skill check [serial]
- [x] 2.1 `src/checks.ts` `checkSkills(home)`: a skill is OK when `~/.claude/skills/<name>/SKILL.md` exists; missing gives a fail line with "install the workflow skills into ~/.claude/skills" (FR4). No version reading. `src/expectedSkills.ts` becomes the list of the 8 names. Update the tests.

## 3. Batch questions when asked (skills repo) [parallel]
- [x] 3.1 In `~/workplace/skills/skills/dev/` `to-brd`, `to-design`, `to-tasks` (the planning skills that ask questions; `to-milestones` has none): the "ask one question at a time" step gets one sentence: "If the user asks for batched questions, ask all independent questions of this step together, each in the question template; then the ones that depend on the answers." Nothing else changes; no mention of Specyard (FR62).
- [x] 3.2 Ships as its own PR in `mAzurkovic/skills`.

## Dependencies
- 1 and 2 run in order in the Specyard repo; 3 runs in parallel in the skills repo.
