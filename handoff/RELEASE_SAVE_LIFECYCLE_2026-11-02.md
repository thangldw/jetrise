# Save lifecycle hardening release — 2026-11-02

## Approved scope and durable checkouts
The owner authorized reconstructing the private checkout, transferring the exact local hardening patch, reviewing/testing it, and publishing production. Source checkout: `/Users/thang/Documents/ChatGPT/jetrise-release/source`. Artifact checkout: `/Users/thang/Documents/ChatGPT/jetrise-release/pages`. These are independent full clones, not shared-object or temporary `/tmp` checkouts.

Baseline private main: `ccefb8f5c2903708e595a377ee6e7b1f952888ef`; public Pages: `03b1f2f01c66fb2dc5f82af28bca4ed2e80834d9`. Repository metadata confirmed the source is private and the artifact repository public.

## Review
- Runtime delta is exactly one replacement in `persistGame`: verify the previous valid raw revision in `BACKUP_KEY` using the existing `writeVerified` helper before committing `SAVE_KEY`.
- If the backup already equals the expected bytes, a no-op write is safe. Otherwise a dropped/truncated write fails verification. A thrown storage error also prevents the main write. Already-created verified migration snapshots may remain; this is not a multi-key transaction or a physical crash-durability guarantee.
- Save schema1, SAVE_KEY, migration versions/IDs, balances, operating rules, schedules, paid rights, lock ownership and App state commit order are unchanged. No autosave or migration is added on mount.
- One owner-boundary regression covers thrown/dropped/truncated rolling-backup writes and thrown/dropped main writes. Re-executed on the published baseline, it fails for `backup/silent must reject`; with the patch it must pass. No production test seam or dependency was added.
- The manual 42-day harness exercises the canonical transition/save store, actual continuation after package transfer, independent dated-event accounting and whole-career rollback. It uses in-memory synthetic Storage only. It remains a manually invoked diagnostic, without scheduled CI/billing changes.
- All 114 recorded runtime/fixture/harness hashes from the 2026-11-01 replay match the reconstructed checkout. The earlier 4 × 42-day results are reused as matching-source evidence; this release does not claim they were rerun. See `handoff/SAVE_LIFECYCLE_2026-11-01.md` and `design/save-lifecycle-20261101/`.
- Existing protected Sites files, workflow permissions, dependencies and backend are untouched. Source/fixtures/logs remain private. Only validated built assets may reach Pages; old hashed assets are retained.

## Verification and publication
Node22 local gates, private CI, final artifact allow-list validation, synthetic local built-app smoke, served hash checks, source exclusions and a read-only production cold-load are recorded in `design/release-save-lifecycle-20261102/`. Final commit/run identifiers are appended after completion.

## Rollback and limitations
Restore the previous public index from `03b1f2f01c66fb2dc5f82af28bca4ed2e80834d9`; retain its assets. This code rollback does not replace or rewind career data. The patch creates no new save fields, so saves are readable by that exact preceding version; its weaker dropped-backup protection would return. Use explicit Save Manager whole-career recovery only when a career rollback is intended.

No production player storage is read or mutated for verification. Safari, physical devices, real storage eviction/power loss and forced IndexedDB fallback remain outside the prior lifecycle drill. The existing Vite large-chunk warning is outside this save-store patch.

## Prepublication results
Local Node22.23.2 gates passed: 29 focused tests, 406 total Pages tests, build and artifact validation. The built app (`index-XZjmU_7T.js`) imported the synthetic day43 package on a fresh localhost origin, retained missing-history semantics, blocked a deliberately dropped backup write, and preserved the exact raw career after explicit reload/export. No browser console warnings/errors were observed. Existing Vite large-chunk warning remains.
