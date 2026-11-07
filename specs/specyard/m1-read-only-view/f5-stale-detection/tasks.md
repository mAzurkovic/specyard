# Stale detection — Tasks

Status: draft

Scope: M1 F5. Flag generated files whose sources changed, pass the flag down the chain, show the change on a stale page as in `mocks/08-stale-spec.html`, and "Mark as not affected". Re-running skills from the stale page comes in M2 (FR50).

## 1. Find stale files [serial]
- [ ] 1.1 `src/hashes.ts` `hashFile(path)`: SHA-256 of the file bytes, first 12 hex characters. Unit test against `shasum -a 256` output.
- [ ] 1.2 `src/stale.ts` `findStale(model, hashes)`: a generated file is stale when a source hash in its header differs from the current one. A file whose source is a stale generated file is stale too, with the chain as the reason (FR46). Unit tests for direct, chained and clean.
- [ ] 1.3 Edits to the generated file itself do not change its flag (FR47). Files with no sources line are never stale. Unit tests.
- [ ] 1.4 `buildModel` sets `stale` on each generated file and feature, and `staleCount` on the project. Unit test.

## 2. Show stale flags in every view [serial, needs 1]
- [ ] 2.1 Graph nodes and list rows of stale features get the stale badge and colour; the header shows the stale count (FR45, FR48).
- [ ] 2.2 Feature page and sidebar file list mark stale files with a link to the stale page.

## 3. Stale page [serial, needs 1]
- [ ] 3.1 `src/oldVersion.ts` `findOldVersion(path, hash)`: `.specyard/blobs/<hash>` first, then `git show <commit>:<path>` over `git log -n 50 --format=%H -- <path>` until the hash matches. Not found: `null`. Unit tests on a temp git repo.
- [ ] 3.2 `GET /api/stale?file=` returns the changed sources, their old and new text (or `null`), and the affected generated files.
- [ ] 3.3 `ui/src/views/StalePage.tsx` at `#/stale/<file>`: banner with both hashes, a diff per changed source with `diff` (jsdiff), "old version not found, no diff" when `null`, and the affected list (FR49).

## 4. Mark as not affected [serial, needs 1]
- [ ] 4.1 `POST /api/stale/not-affected { file }`: rewrites only the sources line with the current hashes. Test: every other byte of the file is unchanged (FR51).
- [ ] 4.2 Button on the stale page; the flag clears through the watcher.
- [ ] 4.3 `e2e/stale.spec.ts` (headless): change `design.md` in a fixture git repo, the feature built from it shows stale in graph and list, the stale page shows the diff, "Mark as not affected" clears it.

## Dependencies
- 1 blocks 2, 3 and 4.
- 2, 3 and 4 run in parallel.
