# Conditional new slot rights — local opt-in trial

Status: local implementation and validation. No production deployment, private-source push, GitHub App, or backend change is authorized for this trial.

## Contract

The existing shared market remains version 1 until the player explicitly accepts the separate new-right terms. Activation is free and requires `acceptTerms: true`. It preserves every held right, quantity, signing/upkeep terms, unlock date, cash balance, flight, aircraft, fare, and sold journey. All currently held rights are grandfathered, including idle rights bought before activation. Voluntarily relinquished rights are not guaranteed reacquisition.

Only rights bought after opt-in are conditional. After a successful timetable/fleet/recovery mutation, and before daily settlement or AI expansion decisions, reconcile them against canonical weekly movement requirements and dated pending/committed legs. Return newly bought rights with no remaining requirement. Do not refund signing charges; stop future upkeep on returned rights. Buying rights does not itself trigger immediate reclamation, so a player can buy then schedule. Day-close forecast previews the return without writing storage. A rejected mutation cannot release rights.

A removed weekly template does not release rights still needed by an airborne return. Once the dated commitment completes, a later reconciliation may return them. Cancellation of one occurrence retains rights needed by the rest of the recurring timetable. This is a schedule/commitment condition, not a rolling actual-utilization threshold or a claim to prevent every possible reservation attack. A perpetually nonoperating but still scheduled service is outside this experiment's anti-hoarding guarantee.

## Save and recovery boundary

The top-level schema1 and SAVE_KEY stay unchanged. Opt-in advances only the slot-market subversion to 2, preventing an older reader from silently treating conditional rights as permanent. Production source `9f4a3c1e7fc0d66f22210c6ea1597ea857f5e53a` accepts the legacy fixture and rejects the opt-in fixture. Consequently, an opted-in local save must not be imported into the current production version.

`save-store.js` verifies and writes the exact pre-opt-in raw snapshot before replacing the main save. The snapshot joins the existing portable package graph; a fully opted-in career has six migration snapshots. Existing migration backups remain immutable. Denied/quota writes preserve the previous main save. Ordinary persistence cannot strip or alter the policy provenance.

Save Manager can restore the whole pre-opt-in career, archiving current progress first. This is a full rollback, not a merge of new progress with old terms. The real local app was exercised through import, explicit opt-in, Save Manager navigation, original-data export and whole-career recovery. Downloaded restored raw bytes equal the selected pre-opt-in backup exactly; the production reader accepts the restored save. See `../design/slot-conditional-optin-20261025/old-reader-check.json` and the local UI screenshots.

## Verification and paired protocol

- Seven targeted conditional-right/save tests passed.
- Production regression: 382 tests passed, zero failed.
- Pages build and artifact allowlist passed.
- Paired matrix completion is recorded in the study results and summary, not inferred from the regression suite.

The matrix covers HAN/DAD/NRT, SGN/DAD/SIN and LHR/EDI/CDG, economy version 2, reference fares and doubled fares, at days 90 and 180. Each cell has five real action policies (required rights, peak purchases, all-hour purchases, temporary add/cancel, edit/revert) with opt-in off/on, plus a post-purchase activation control. All schedules, fleets, cabins, fares and base snapshots are matched. There are 66 intended 180-day trajectories, with independent leg/cash/seat/slot audit and portable-save checks at days 7, 45, 90 and 180.

Old ownership is deliberately protected. Therefore, an exploit using already purchased idle rights may remain profitable after activation. Report this compatibility exception separately from the effects on new purchases. Synthetic deterministic runs are not human playtest evidence or real airline economics.

## Completed matrix result

The accepted study completed all 66 trajectories / 11,880 days, 264 portable checkpoints and 132 reconciled horizon rows. Sixty opt-out save hashes match the archived prior study exactly. All 60 opt-in horizon rows retain the matched control's AI leg count; no unused conditional rights remain, incremental upkeep is zero and cash differs only by sunk signing charges.

The six edit/revert opt-in cells return 12 rights after three real edits and restoration of the original timetable, losing $6,000 at both horizons with zero AI leg delta. LHR/doubled fares without opt-in reproduces +$78,596 / +$119,749 at days 90/180 and −12 AI legs; with opt-in it becomes −$6,000 / −$6,000 and zero AI leg delta. All six post-purchase activation controls preserve the former cash and AI paths at both horizons, with no returns. This compatibility exception is intentional.

Twelve initial stack/cancel setups stopped because their harness accepted only the historical English cap rejection. The exact Vietnamese one-per-hour rejection is now accepted as an expected atomic refusal. Initial failures and old harness are archived under `initial-attempt/`; only those 12 cases were rerun. The manifest records both harness hashes, unchanged runtime fingerprint and all 54 reused successful case hashes. All 12 corrected cases passed. The runtime and policy were unchanged throughout the correction.

Full table and method: `../design/slot-conditional-optin-20261025/summary.md`; machine-readable results, comparisons, verification, browser checks and retained test/build logs are in the same directory. Reproduce with a fresh output directory using `node scripts/slot-conditional-study.mjs --out <fresh-directory>`, then `node scripts/slot-conditional-report.mjs <fresh-directory>`.
