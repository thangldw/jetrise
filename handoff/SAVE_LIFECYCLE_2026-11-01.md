# Save lifecycle hardening — 2026-11-01

## Boundary
Synthetic data only. No player save, production storage, backend, credentials, GitHub App or deployment was changed. Production remains artifact commit `03b1f2f01c66fb2dc5f82af28bca4ed2e80834d9`; the published private source baseline is `ccefb8f5c2903708e595a377ee6e7b1f952888ef`.

## Defect and minimal repair
Ordinary `persistGame` wrote the rolling backup without the read-after-write verification already used for immutable snapshots, replacement backups and the main save. Fault injection reproduced a silent dropped backup write allowing the next main revision to commit. The new owner-boundary regression failed before the fix with `Missing expected exception: backup/silent must reject`.

Repair: reuse `writeVerified` for the ordinary rolling-backup write before writing `SAVE_KEY`. One production line changes. No schema, keys, migration, economics, lock implementation or UI changes. Throwing/dropped/truncated backup writes now reject while the active revision remains exact. The test also covers throwing/dropped main writes. A fault can leave a partial backup/archive; this is not a multi-key atomic transaction. The active career remains the commit boundary for the tested failure modes.

## Executed coverage

| Contract | Evidence |
| --- | --- |
| Version update with an old tab open | Served the previously released `index-CyboUKMK.js` and candidate `index-XZjmU_7T.js` on disposable localhost origin `127.0.0.1:5240`; kept old assets. Candidate mount/export preserved exact raw save bytes. Selected weekly goal changed only its metadata. |
| Stale writer and draft lifecycle | Old tab had an uncommitted 120% fare draft. A real storage event from the new tab blocked the old tab. Explicit Reload latest discarded the draft (returned to 110% default), retaining exact new raw save. No fare action was applied or charged. |
| Prior reader / code rollback | Old bundle loaded the new goal save, performed an actual day close, and retained metadata. Its resulting game matched the candidate's canonical transition exactly. Restoring the old local index and opening it again preserved exact save bytes. This covers that specific predecessor, not arbitrary older save readers. |
| Damaged main save | Injected damaged bytes only on the synthetic localhost origin, with a valid rolling backup. Mount showed recovery instead of overwriting. Downloaded damaged bytes matched exactly; explicit recovery restored the original career byte-for-byte. |
| Restart and restore | Actual Save Manager restart archived the career; explicit archive restore returned exact money, fleet, schedules, tickets, slot rights and weekly goal. |
| Failed backup at the real UI boundary | One-shot browser Storage fault dropped a backup write. Candidate blocked the session; Reload latest and raw download proved no main-save or goal commit. The temporary Storage override restored itself. |
| Weekly goals and retained history | Four complete 42-day careers: frozen pre-JET legacy, all-JET economy1 holding its first goal, all-JET economy2 rotating the three goals, and economy1 with both slot opt-ins plus switch/clear/reselect. Three careers tracked goals; legacy stayed opt-out. All daily goal/control reports and non-goal game states matched exactly. |
| Accounting and portable continuation | Independent dated-manifest auditor ran for 168 closes. Daily restores, 24 exports/imports with actual continuation on imported Storage, 24 restart/archive restores, 24 damaged-main recoveries and 90 feature rollback/restore forks passed. Immutable migration bytes stayed unchanged. |
| New slot terms | Paid player rights were unchanged throughout the opt-in career. Both pre-reservation and pre-utilization whole-career backups were restored exactly in additional forks, archiving the live branch first. |
| History expiry in browser | Imported the actual day43 package into a second clean localhost origin `127.0.0.1:5241`. Week6 remained complete; the original week1 goal displayed unknown/missing data, with no reconstructed past success and no automatic rollover. |

Local static-server cache initially reused the old index; the version-change drill deliberately requested a fresh index URL on the same origin. No cache/settings change was made to production. The browser smoke test does not certify CDN/browser cache eviction behavior.

## Checks and reproducibility
- `node --test tests/save-manager.test.mjs tests/weekly-review.test.mjs`: 29 passed.
- `npm run test:pages`: 406 passed, zero failures.
- `npm run build:pages` and `npm run verify:pages`: passed. Existing Vite large-chunk warning remains.
- `node scripts/save-lifecycle-check.mjs`: four careers × 42 days = 168 actual/control pairs. The manual harness fingerprints all runtime JS/JSX, its own code, auditor and relevant fixtures. It is intentionally not an extra scheduled/automatic CI workload.
- Results, exact downloaded synthetic saves, fault-injection regression and screenshots: `design/save-lifecycle-20261101/`.
- Browser console warnings/errors observed: none. Native Web Locks was available on the tested secure localhost origin; the IndexedDB fallback was not forced.

The 42-day replay uses synchronous in-memory Storage. Injected write failures are deliberate simulations, not measured real browser quota exhaustion, OS power loss or crash-durability guarantees. Safari, physical devices, real storage eviction and arbitrary older readers remain outside this run. Existing Save Manager tests exercise denied access, malformed/future packages, archive/snapshot/rolling/main failure stages and interrupted-import retry.

## Delivery state
Local-only implementation and evidence, ready for review. No push or production deployment is authorized or performed in this task. Keep the current production assets and old saves unchanged until a separate release instruction.
