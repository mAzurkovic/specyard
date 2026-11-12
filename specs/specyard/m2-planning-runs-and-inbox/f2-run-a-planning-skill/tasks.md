# Run a planning skill — Tasks

Scope: M2 F2. Run `/to-brd`, `/to-design`, `/to-milestones`, `/to-tasks` and `/expert-review` from the UI through the Claude Agent SDK, show the run live, keep its log, and show what it changed (FR10, FR23, FR24, FR25, FR36, FR60, FR63, NFR2). Questions and approvals are F3: here a run that stops on a question shows it as "needs you" with the skill's message.

## 1. A run starts and streams events [serial]
- [x] 1.1 Add `@anthropic-ai/claude-agent-sdk` (pinned; named in design.md). `src/runs/events.ts` `toRunEvents(message)`: SDK message to `RunEvent`s (phase from progress lines with the grammar in design.md, subagent start and stop, rate limit, end). Unit tests with recorded SDK messages.
- [x] 1.2 `src/runs/RunManager.ts` `start({ kind, target, comment })`: one `query()` per run with streaming input, `cwd` the repo root, `settingSources: ["user", "project", "local"]`. The first message is what a user would type: `/<kind> <M<n> F<k>>`, plus the context file paths (FR10), "Ask batched questions." (FR62) and the comment (FR25). The skill itself is not changed (FR63). Returns the run id. Unit tests with a fake `query` (the SDK is the boundary).
- [x] 1.3 Each event goes to subscribers within 1 s (NFR2) and to `specs/<project>/.specyard/runs/<id>/events.jsonl`; `run.json` holds kind, target, session id, state, times. `.specyard/` holds a `.gitignore` of `*` (FR60). Unit tests.

## 2. Runs from the API and the UI [serial, needs 1]
- [x] 2.1 `POST /api/runs { kind, target, comment? }` → `{ runId }`; `GET /api/runs?target=` lists runs; `GET /api/runs/:id` gives run.json and events; the SSE stream sends `run` events. Unknown kind or target: 400. Server tests.
- [x] 2.2 Feature, milestone and project pages: the next-step command becomes a button that starts the run; `/expert-review` button on the feature page (FR23). The Run tab shows the live events (phase, subagents, progress lines).
- [x] 2.3 Model: a feature with a running run has stage `running`; the header running count counts runs (FR16, FR45).

## 3. What a run changed [serial, needs 2]
- [x] 3.1 Before a run, copy the files its kind may write into `.specyard/runs/<id>/before/` (FR24). Unit tests.
- [x] 3.2 Run view: after the run, a diff per changed file against `before/` (reuse `ui/src/diffRows.ts`), and "Re-run with comment" (FR25).
- [x] 3.3 e2e with the fake SDK: start `/to-tasks M1 F1` from the feature page, see live events, see the diff of the written tasks.md, re-run with a comment that reaches the first message.

## 4. A real run, once [serial, needs 3]
- [x] 4.1 Smoke run with the real SDK on a scratch copy of a small project: `/to-tasks` writes a tasks.md and the Run tab showed its events. Needs the Lead's approval before it runs (it uses the usage window).

## Dependencies
- 1, 2, 3 and 4 run in order.
