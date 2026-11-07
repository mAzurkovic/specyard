# Feature pages and context — Tasks

Status: draft

Scope: M1 F4. Feature and milestone pages with rendered spec tabs, the project's required and missing file states with the next step, and context files from `mocks/05-feature-drilldown.html` and `mocks/02-detect-no-milestones.html`. Skill buttons come in M2; here the next step shows as the command to run.

## 1. Serve spec files safely [serial]
- [x] 1.1 `GET /api/file?path=` in `src/server.ts`: returns the text of a file inside the project folder only. A path that resolves outside it (`..`, symlink): 403. Missing: 404. Tests.
- [x] 1.2 `src/model.ts` adds `contextFiles`: every file under `context/` and `mocks/` with path, size and mtime (FR10). Unit test on a fixture.

## 2. Feature and milestone pages [parallel, needs 1]
- [x] 2.1 `ui/src/views/FeaturePage.tsx` at `#/f/<id>`: breadcrumb, stage stepper, tabs Requirements, Design, Tasks, Run, Evidence (FR22). Run and Evidence show "No runs yet".
- [x] 2.2 `ui/src/markdown.tsx`: renders a spec file with `marked`, HTML in the Markdown escaped. Unit test that a `<script>` in Markdown renders as text.
- [x] 2.3 Tabs for files the feature does not have show why, from `Docs` in milestones.md: "Not needed" or "Not written yet: run /to-design M<n> F<k>".
- [x] 2.4 `ui/src/views/MilestonePage.tsx` at `#/m/<id>`: milestone entry (Delivers, Exit criteria) and its features with stages.

## 3. Required files and next step [parallel, needs 1]
- [x] 3.1 `ui/src/views/ProjectPage.tsx` at `#/project`: Required (`requirements.md`, `design.md`), Plan (`milestones.md`) and Context groups, as in mock 02.
- [x] 3.2 Next step: no `requirements.md` gives `/to-brd`, no `design.md` gives `/to-design`, both and no `milestones.md` gives `/to-milestones` with "one task list with /to-tasks" as the other choice. Later steps are not offered before both required files exist (FR8, FR9). Shown as the command with a copy button. Component tests for each state.
- [x] 3.3 The project page is the start page while a required file or `milestones.md` is missing.

## 4. Add a context file [serial, needs 1]
- [x] 4.1 `POST /api/context` in `src/server.ts`: one file from a multipart body, copied into `context/`. Markdown, PDF and images only; other types 415; a name that exists 409; over 20 MB 413 (FR11). Tests.
- [x] 4.2 "+ Add context file" button in the sidebar and the project page, with a file picker; the new file shows in the list through the watcher.
- [x] 4.3 `e2e/feature-page.spec.ts` (headless): open a feature, the tabs render its files; on a fixture without `milestones.md`, the next step is `/to-milestones`; adding a context file lists it.

## Dependencies
- 1 blocks 2, 3 and 4.
- 2 and 3 run in parallel.
