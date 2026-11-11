# Specyard — Requirements

Keywords MUST, MUST NOT, SHOULD, MAY per RFC 2119.

Specyard is a local web UI and CLI over the spec-driven skill workflow (`/to-brd`, `/to-design`, `/to-milestones`, `/to-tasks`, `/implement-feature`, `/verify`, `/expert-review`, `/pr`). The files in `specs/` are the source of truth. Actors: **Lead** (owns the project, runs Specyard) and **Adopter** (another engineer who installs it). User stories: `user-stories.md` (US1 to US28). Mocks: `mocks/`.

Terms:
- **Project:** a folder `specs/<project>/` that holds `requirements.md` or `design.md`.
- **Context files:** files in `<project>/context/` and `<project>/mocks/`.
- **Ready (dependency):** the dependency's PR is merged into the default branch.

## Functional Requirements

### Install and start
- FR1. `npm install -g specyard`: system MUST install the CLI with no other setup step. `specyard --version` prints the version.
- FR2. `specyard` run in a repo: system MUST check that Claude Code is installed and logged in, that each workflow skill is installed, and MUST find the project. It prints one line per check.
- FR3. Claude Code missing or not logged in: system MUST print the fix command and MUST NOT start the UI.
- FR4. Workflow skill missing (no `SKILL.md` in `~/.claude/skills/<name>/`): system MUST print its name and how to install the workflow skills. Skills carry no version; presence is the only check.
- FR5. One project in `specs/`: system MUST open it. More than one: the UI MUST show a picker. `--path <dir>` MUST open that project with no picker.
- FR6. No project in `specs/`: the UI MUST show an empty state with "Run /to-brd" as the main action.
- FR7. Checks pass: system MUST start the server, open the default browser at the UI URL, and print the URL.
- FR8. `requirements.md` or `design.md` missing: the main action MUST be `/to-brd` or `/to-design`. The UI MUST NOT offer `/to-milestones`, `/to-tasks` or Implement until both exist.
- FR9. Both exist and `milestones.md` does not: the main action MUST be `/to-milestones`, with "one task list with /to-tasks" as the other choice.
- FR10. Context files: the UI MUST list them, and every skill run MUST get their paths.
- FR11. "Add context file": system MUST copy the chosen file (Markdown, PDF, image) into `context/`.

### Skill install (removed)
- FR12. Removed 2026-11-11 (keep it simple): Specyard does not bundle or install skills.
- FR13. Removed 2026-11-11 (keep it simple): see FR12.

### Project views
- FR14. Graph view: system MUST show one lane per milestone, one node per feature, and one edge per dependency from `milestones.md` and `tasks.md`.
- FR15. List view: system MUST show the tree milestone, feature, task. Each task MUST show a state icon (done, running, failed 3 attempts, needs you, to do, waits on a task, fix task) and its attempt count from `progress.md`. Each feature MUST show its dependencies.
- FR16. Each feature MUST show one stage, derived from files, runs and PRs only: needs design, needs tasks, tasks in review, waits on dependencies, ready, running, needs you, paused, stopped, PR open, done (PR merged).
- FR17. Graph view MUST mark the critical path (the longest chain of features that are not done) and list the features that can start now, with the action for each. A planning step (`/to-design`, `/to-tasks`, review tasks) can start whatever the state of the dependencies. `/implement-feature` can start only when the feature is ready (FR30).
- FR18. Spec file changed outside Specyard: the UI MUST show the change with no page reload.
- FR19. The UI MUST show feature ids as `M<n>·F<k>` and fix tasks as `Fix X<n>`.
- FR20. Spec file that does not parse: the UI MUST show an error badge on it with the line and what was expected, and the rest of the project MUST keep working. A feature with a `tasks.md` that does not parse MUST NOT be implementable.
- FR21. Feature with no dependency list: system MUST treat it as having no dependencies and show a warning.

### Plan a feature
- FR22. Milestone or feature page: system MUST render its requirements, design and tasks files, and show Run and Evidence tabs.
- FR23. From that page, the user MUST be able to run `/to-design`, `/to-tasks` or `/expert-review` on that milestone or feature only.
- FR24. Skill run rewrote a generated file: the page MUST show the diff against the version before the run.
- FR25. "Re-run with comment": system MUST run the same skill again with the comment as input.
- FR26. "Approve tasks": system MUST write an approval line into `tasks.md` that holds the hash of the task content. Task content changed after approval: the feature MUST go back to "tasks in review".
- FR27. Implement MUST be enabled only when the tasks are approved, every dependency is ready, and `tasks.md` parses. Disabled: the UI MUST list each reason.

### Implement runs
- FR28. Implement: system MUST run `/implement-feature` on the feature in its own git worktree, on a branch made from the default branch.
- FR29. System MUST allow any number of implement runs at once. Two implement runs MUST NOT share a working tree.
- FR30. A feature becomes ready (all dependencies ready, tasks approved): system MUST set its stage to "ready", send a notification, and list it under "can start now". System MUST NOT start the run.
- FR31. Run view: system MUST show the phase and round, each subagent (skill, start time, duration, result), the progress lines, and the time per phase.
- FR32. Browser closed: runs MUST continue.
- FR33. "Stop run": system MUST ask for confirmation, then stop the run so that the skill's cleanup runs and `progress.md` keeps the state. The feature stage becomes "stopped".
- FR34. Stopped feature: "Resume" MUST start `/implement-feature` again, continuing from `progress.md`.
- FR35. Ctrl-C on `specyard` with runs going: system MUST ask "Stop N runs and quit?". Yes: stop each run as in FR33, then quit. No: keep running.
- FR36. Each run's log MUST stay available to reopen until the feature folder is deleted.
- FR37. Runs MUST use the user's Claude Code permission settings for the repo. A tool call that prompts in the CLI MUST become an approval item in the inbox, and the run MUST wait for the answer.
- FR38. System MUST NOT turn on bypass-permissions mode on its own. The user MAY turn it on for one run with an explicit toggle.
- FR39. Run hits the Claude usage limit: system MUST show "paused: usage limit, resets <time>" in the graph, run view and inbox, and MUST resume the run at the reset time.

### Inbox
- FR40. The inbox MUST hold every item that waits for the user, from every run: questions, tool approvals, deploy and paid-call approvals, BLOCKED verdicts, "Stop and ask" blocks, and PRs ready to merge. Each item MUST name its feature and skill.
- FR41. Question batch: each question MUST show its options, the recommended option, the reason, and a free-text field.
- FR42. Submit MUST be enabled only when every question in the batch has an answer. "Accept all recommendations" MUST fill only the unanswered questions. Submit MUST resume the paused run with the answers.
- FR43. Approval, BLOCKED and "Stop and ask" items MUST offer Approve, Skip and Reply. The answer MUST resume the run.
- FR44. New inbox item: system MUST send an OS notification and show the inbox count in the browser tab title.
- FR45. Every page MUST show the inbox count and the running count in the header.

### Stale specs (removed)
- FR46. Removed 2026-11-11 (keep it simple): no stale detection.
- FR47. Removed 2026-11-11 (keep it simple): no stale detection.
- FR48. Removed 2026-11-11 (keep it simple): no stale detection.
- FR49. Removed 2026-11-11 (keep it simple): no stale detection.
- FR50. Removed 2026-11-11 (keep it simple): no stale detection.
- FR51. Removed 2026-11-11 (keep it simple): no stale detection.
- FR52. Removed 2026-11-11 (keep it simple): no stale detection.

### Evidence
- FR53. Evidence page: system MUST show the done gate result, coverage of changed code, the verify table, the review findings with their outcome (fixed, follow-up, rejected with reason), the proof, and the PR link and status.
- FR54. The open items (not verified cases, follow-ups, open findings) MUST be first on the page.
- FR55. Feature with no Specyard run log: the page MUST show what `progress.md` and the PR give, and mark the rest "no run log".
- FR56. "Merge PR": system MUST ask for confirmation, then merge with the repo's default merge method through `gh`. No `gh` or no GitHub remote: the button MUST be hidden.
- FR57. System MUST detect PRs merged outside Specyard. Without `gh`: a feature branch that the default branch contains counts as merged.

### File ownership
- FR58. Specyard MUST write only: the approval line in `tasks.md`, new files in `context/`, and its own run logs and settings.
- FR59. Specyard MUST NOT edit any other spec file or code file. Every other change MUST go through a skill run.
- FR60. Run logs and settings MUST live in a folder that git ignores, without changes to the repo's `.gitignore`.

### Skills
- FR61. Removed 2026-11-11 (keep it simple): skills carry no version.
- FR62. Each planning skill that asks questions (`/to-brd`, `/to-design`, `/to-tasks`) MUST ask one question at a time by default, and MUST ask all independent questions of a step together when the user asks for batched questions. This MUST hold in the plain CLI too, and the skills MUST NOT refer to Specyard.
- FR63. Specyard MUST invoke a skill the way a user does (its slash command and arguments, plus the context file paths and any comment in the same prompt) and MUST read the skill's normal output and files. Skills MUST NOT change for Specyard beyond FR62.
- FR64. Removed 2026-11-11 (keep it simple): skills stay as they are (FR63).
- FR65. Removed 2026-11-11 (keep it simple): skills stay as they are (FR63).
- FR66. Removed 2026-11-11 (keep it simple): skills stay as they are (FR63).
- FR67. Removed 2026-11-11 (keep it simple): skills stay as they are (FR63).

## Non-Functional Requirements
- NFR1. Performance: a spec file change MUST show in the UI within 2 s.
- NFR2. Performance: a run event MUST show in the UI within 1 s.
- NFR3. Performance: graph and list views MUST load in under 1 s for 20 milestones, 200 features and 2,000 tasks.
- NFR4. Performance: from `specyard` to UI ready MUST take under 3 s, browser launch excluded.
- NFR5. Performance: a PR merged outside Specyard MUST show as merged within 60 s.
- NFR6. Security: the server MUST listen on 127.0.0.1 only.
- NFR7. Security: the UI URL MUST hold a random token made at each start. The server MUST reject requests without the token or from another Origin.
- NFR8. Source of truth: deleting Specyard's run log and settings folder MUST lose only run logs and settings. Every stage, status and dependency MUST be derivable from spec files, git and PRs.
- NFR9. Platforms: system MUST run on macOS and Linux.
- NFR10. Look: the UI MUST use the Blueprint light style (`mocks/03-project-graph.html`) by default.

## Out of Scope
- Stale detection, and recording which files a spec was made from.
- Bundling, installing or versioning the workflow skills.
- Windows.
- Multi-user use, remote access, cloud runners.
- Starting runs without the user (autopilot), and scheduling around the usage window.
- Runs that continue after `specyard` quits.
- Starting a feature from an unmerged dependency branch (stacked PRs).
- Merging through a forge other than GitHub.
- Turning review follow-ups into fix tasks from the UI.

## Open Questions
- OQ1. Is the npm name `specyard` free at publish time? Owner: Lead, before the first release.
