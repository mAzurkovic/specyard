# Specyard — User Stories

A local UI over the spec-driven skill workflow (`/to-brd` → `/to-design` → `/to-milestones` → `/to-tasks` → `/implement-feature`). The files in `specs/` are the source of truth. Specyard shows them and runs the skills. It never keeps project state that is not in a file.

Mocks: `mocks/index.html`.

## Actors

- **Lead:** the lead engineer who owns the project and runs Specyard in its repo.
- **Adopter:** another engineer who uses the same skill workflow and installs Specyard.

## Install and start

- US1. As an Adopter, I want to install Specyard with one CLI command, so I can use it without cloning or building anything. (mock 01)
- US2. As an Adopter, I want Specyard to check that the workflow skills are installed and tell me which are missing or out of date, so runs do not fail halfway. (mock 01)
- US3. As a Lead, I want to start Specyard from the repo directory and have it find `specs/<project>/` on its own, so there is nothing to configure. (mock 01, 02)
- US4. As a Lead, I want Specyard to offer `/to-milestones` when a project has a design but no milestones, so I can go from design to plan in one click. (mock 02)
- US27. As a Lead, I want Specyard to require `requirements.md` and `design.md`, and to offer `/to-brd` or `/to-design` when one is missing, so every project starts from a spec. (mock 02)
- US28. As a Lead, I want to add context files (HLD, LLD, API notes, ADRs) in `context/`, and have every skill run get their paths along with `mocks/`, so the skills use all the design material I have. (mock 02, 03)

## See the project

- US5. As a Lead, I want a graph of milestones and features with their dependency edges, so I can see what blocks what. (mock 03)
- US6. As a Lead, I want a list view of the same milestones, features and tasks, so I can scan progress and task detail. (mock 04)
- US7. As a Lead, I want each feature to show its stage (needs design, needs tasks, in review, ready, running, needs you, PR open, done), derived from the files, so the status is never out of date. (mock 03, 04)
- US8. As a Lead, I want to see which features are ready to start now and the critical path, so I know what to start next. (mock 03)
- US9. As a Lead, I want changes I make to spec files in my editor to show in the UI within a few seconds, so I can edit specs where I like. (all)

## Plan one feature

- US10. As a Lead, I want to open a milestone or feature and read its requirements, design and tasks rendered, so I can review them in one place. (mock 05)
- US11. As a Lead, I want to run `/to-design` or `/to-tasks` on one milestone or feature from its page, so I can plan it without the CLI. (mock 05)
- US12. As a Lead, I want to see what changed since the last version of a generated file, and approve it or re-run it with a comment, so I control what gets built. (mock 05)
- US13. As a Lead, I want the Implement button enabled only after I approve the tasks, so no feature is built from a plan I did not review. (mock 05)

## Implement and watch

- US14. As a Lead, I want to start `/implement-feature` on a ready feature with one button, so the full build, verify, review and PR loop runs. (mock 05, 06)
- US15. As a Lead, I want to see the live run: phase, round, each subagent as it starts and ends, the progress lines, and time per phase, so I know what it is doing and where time goes. (mock 06)
- US16. As a Lead, I want to stop a run, and to close the UI without stopping it, so I am not tied to the browser. (mock 06)
- US17. As a Lead, I want to reopen a finished or running run later and see its full log, so I can review what happened. (mock 06)

## Inbox

- US18. As a Lead, I want every question, approval and stop from every run in one inbox, so nothing waits for me without my knowing. (mock 07)
- US19. As a Lead, I want the questions from one skill step to arrive as one batch, and to answer them all at once, so I am not called back for each question. (mock 07)
- US20. As a Lead, I want each question to show the recommended answer and why, and a button to accept all recommendations, so routine answers take one click. (mock 07)
- US21. As a Lead, I want deploy and paid-call approvals, BLOCKED verdicts and "Stop and ask" blocks in the inbox with Approve, Skip and Reply actions, so a run continues as soon as I answer. (mock 07)
- US22. As a Lead, I want a desktop notification when something new is in the inbox, so I can work on other things while runs go. (mock 07)

## Stale specs

- US23. As a Lead, I want a flag on every file and feature built from a spec that changed after it was generated, so I do not build from an old plan. (mock 03, 08)
- US24. As a Lead, I want to see the spec change and the features it affects, and re-run the downstream skill for the ones I pick, so I can update the plan quickly. (mock 08)

## Evidence

- US25. As a Lead, I want one evidence page for each feature with the done gate, coverage, verify table, review findings, proof and PR link, so I can decide to merge from one page. (mock 09)
- US26. As a Lead, I want the open items (not verified cases, follow-ups, open findings) at the top of the evidence page, so I see what is not proven first. (mock 09)

## Notes for /to-brd

- **Batched questions (US19).** Today `/to-brd` and `/to-design` ask one question at a time, so that a later question can depend on an earlier answer. Proposal: each step asks all its independent questions as one batch, and the questions that depend on those answers as the next batch. `AskUserQuestion` takes up to 4 questions per call, so a batch of 5 or more is 2 or more calls. This needs a change to the skills, not only to the UI.
- **Approval in files (US13).** The tasks approval must live in a file, because the files are the source of truth. Example: a `Status: approved` line in `tasks.md`, or the feature status in `milestones.md`.
- **Run logs (US15, US17).** Runs need structured events (phase, subagent start and end, question, verdict). Today the skills print progress lines as text. Store the logs gitignored, next to `progress.md`.
- **Context files (US28).** Today the skills read only the files they know by name. They need one rule: "Also read `context/` and `mocks/` in the project folder." Then context works from the CLI too, not only from Specyard.
- **Out of scope for v1:** multi-user use, cloud runners, autopilot over a whole milestone, a usage-budget scheduler.
