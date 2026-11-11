# Inbox — Tasks

Scope: M2 F3. Questions and tool approvals from running skills go to one inbox; the answer resumes the run (FR37, FR38, FR40 to FR44), as in `mocks/07-inbox-batch.html`. The skills ask in text, as they already do (`Q:` / `Recommend:` / `Why:`); PRs in the inbox come with M3.

## 1. Runs wait for the inbox [serial]
- [ ] 1.1 `src/runs/questions.ts` `parseQuestions(text)`: the `Q:` / `Recommend:` / `Why:` blocks of a skill's message, one or many (batched). Unit tests on real skill output.
- [ ] 1.2 `src/inbox.ts`: open items, each `{ waitId, runId, feature, skill, kind: "questions" | "approval", ... }`. A run turn that ends with question blocks becomes one questions item; its answers go back as the next user message (`streamInput`), one line per question (FR42). Unit tests with a fake SDK.
- [ ] 1.3 `RunManager` `canUseTool`: a tool call that would prompt in the CLI becomes an approval item; it resolves to allow or deny with the reply as message (FR37). Unit tests with a fake SDK.
- [ ] 1.4 No bypass mode unless the run was started with `bypassPermissions: true` (FR38). Unit test.

## 2. Answer from the API [serial, needs 1]
- [ ] 2.1 `POST /api/inbox/:waitId { answers? , decision?, reply? }`: 409 when a question batch is not fully answered (FR42); 404 for an unknown item. The SSE stream sends `inbox` with the full list. Server tests.
- [ ] 2.2 Model: a feature with an open item has stage `needs-you`; the header count is the inbox length (FR16, FR45).

## 3. Inbox page [serial, needs 2]
- [ ] 3.1 `ui/src/views/InboxPage.tsx` at `#/inbox`: item list and the selected item, as in mock 07. Each question shows its text, the recommended answer, the reason, and a free-text field (FR41).
- [ ] 3.2 "Accept all recommendations" fills only unanswered questions; Submit is enabled only when every question has an answer (FR42). Approval items offer Approve, Skip and Reply (FR43).
- [ ] 3.3 e2e with the fake SDK: a run's message holds 3 question blocks; the inbox shows one batch; accept all, submit; the next user message carries the 3 answers and the run continues.

## 4. Notifications [serial, needs 2]
- [ ] 4.1 `src/notify.ts`: on a new item, `osascript -e 'display notification …'` on macOS, `notify-send` on Linux when found, else nothing (FR44). Unit tests with a stub on PATH.
- [ ] 4.2 The browser tab title shows the inbox count, as `(3) specyard` (FR44).

## Dependencies
- 1, 2 run in order; 3 and 4 need 2.
