# Graph and list views — Tasks

Status: draft

Scope: M1 F3. Show the F2 `ProjectModel` as the graph and list views from `mocks/03-project-graph.html` and `mocks/04-project-list.html`, in the Blueprint light style. No runs, no stale flags (F5).

## 1. Lay out the graph [parallel]
- [x] 1.1 `ui/src/graph/layout.ts` `layoutGraph(model)`: one lane per milestone in build order, nodes in rows by dependency depth inside the lane, fixed node size from the mock. Pure. Unit tests: positions for a 3-milestone fixture, no overlapping nodes.
- [x] 1.2 Edge paths: cubic curves from the right middle of a node to the left middle of a node in the next lane; straight down to the next row inside a lane; edges that skip rows or lanes go around nodes through the free margins and gaps, never behind a node they do not join. Critical path edges flagged. Unit tests on path endpoints and on no crossing.

## 2. Graph view [serial, needs 1]
- [x] 2.1 `ui/src/views/GraphView.tsx`: lanes, nodes with stage badge and stage colour, SVG edges with arrowheads, critical path in the `--crit` colour, legend (FR14, FR17).
- [x] 2.2 Click selects a node and shows the selection panel (stage, next action, what it unblocks). Double-click opens `#/f/<id>`.
- [x] 2.3 "Can start now" panel from `model.canStartNow`, each with its next action as text (the run buttons come in M2).

## 3. List view [parallel]
- [x] 3.1 `ui/src/views/ListView.tsx`: tree milestone, feature, task with stage, needs, task count and last activity columns (FR15).
- [x] 3.2 `ui/src/icons.tsx`: the task state icons from `mocks/04-project-list.html` (done, running, failed, needs you, to do, waits on a task, fix task) as SVG symbols, and a legend under the table.
- [x] 3.3 Expand and collapse per milestone and feature; attempts from `progress.md` on each task row.

## 4. App shell and routes [serial, needs 2, 3]
- [x] 4.1 `ui/src/App.tsx` hash routes `#/graph` (default) and `#/list`, the Graph and List toggle, and a sidebar with project files and the milestone list with done counts.
- [x] 4.2 `ui/src/styles.css`: Blueprint light tokens from `mocks/styles.css` as the default, the other mock styles removed (NFR10).
- [x] 4.3 `e2e/views.spec.ts` (headless): on the loremaster-style fixture, the graph shows every feature node and edge, the list shows every task with its icon, and the toggle switches views.
- [x] 4.4 `e2e/perf.spec.ts`: on the generated 20/200/2,000 fixture, graph and list each render in under 1 s from navigation (NFR3).
- [x] 4.5 Parse issues in the UI: a feature with an error issue gets an error badge on its graph node and list row; an Issues panel lists every issue with file, line and message, errors first (FR20). e2e on a fixture with a broken tasks.md.

## Dependencies
- 1 and 3 run in parallel.
- 2 needs 1.
- 4 needs 2 and 3.
