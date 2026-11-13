# Actual-use slot terms — local new-acquisition trial

Status: local implementation; the matrix result is recorded separately after completion. No deployment, source push, backend, GitHub App or production player-save changes.

## Scope and compatibility

This is a second, separate free opt-in after the schedule-only conditional-right program. Existing version-1 permanent rights and version-2 conditional rights keep their existing contracts. The new utilization map starts empty: no currently held right is enrolled retrospectively, even if idle. Only later purchases are tracked.

The top-level schema1 and SAVE_KEY are unchanged. The market subversion becomes 3, so older local readers fail closed rather than silently ignoring the stronger contract. The immutable exact pre-utilization snapshot joins the existing Save Manager graph; a fully enabled career exports seven migration snapshots. Whole-career rollback returns exact version-2 bytes, archiving newer progress. To return to the current production version, choose the earlier pre-conditional-terms version-1 backup; restoring only the pre-utilization backup returns to the previous local trial, not production.

## Actual-use rule

A new right needs physical takeoff or landing at its own airport, weekday and hour. The authoritative shared-slot movement receipt derives from actual JET-201 manifests, including dated delays and cross-week continuations; neither a schedule entry, a cancellation, a forecast nor sold but unflown seats counts as use. An empty flight still consumes the physical movement and qualifies. Movement quantity and per-hour capacity remain unchanged.

The initial grace lasts 14 closed game days from acquisition. After actual use, return is considered only after 14 complete subsequent days without another receipt, giving the next recurring weekday its opportunity before review. This daily rule is conservative about the intraday timestamp. The clock is per airport/hour, shared across aircraft and schedule IDs. It is not reset by editing a timetable or canceling one occurrence.

Canonical pending round-trip movements and reserved/airborne through-ticket legs protect their required rights until completion or explicit refund. A forecast reconciles a cloned market before the AI decision and before billing; only successful persistence commits the return. Rejected operations and read-only projections do not write storage.

Expired rights return without signing refunds; future upkeep stops. Existing recurring templates remain stored and readable. Their departures are canceled with an explicit missing/expired-right reason until enough rights are bought again. An expiration receipt retains the exact original template signatures so adding another flight cannot treat the capacity exception as owned rights. No actual departure may exceed current player ownership.

## Return/rebuy continuity

For tracked keys, voluntary or automatic return retains the prior idle clock. Reacquisition before seven days of absence resumes that clock. At least seven complete days without holding the right allow a fresh acquisition window. A right reclaimed for actual nonuse has an explicit seven-day repurchase wait, subject to remaining shared capacity; AI can buy during that interval. This applies only to new tracked acquisitions, never older rights.

## Evidence and test ownership

The causal baseline was reproduced with real actions: add a legal flight, purchase four missing rights, cancel each occurrence and settle sixteen days. The older schedule-only contract retains all four rights while the timetable remains present. New tests exercise the same boundary with utilization enabled rather than injecting synthetic usage receipts.

Five focused tests own: repeated cancellation and old-contract preservation; actual/projected receipt renewal and the fourteen-day boundary; explicit consent/free activation, seven-snapshot portability, exact rollback and quota failure; remove/readd/rebuy clock continuity and reacquisition rejection; and an actual Sunday return spanning the initial deadline. Existing overnight tests retain sold-ticket guard coverage. No independent test-only production seam was added.

Pages regression: 387/387 passed. Pages build and artifact allowlist passed. Browser QA uses only synthetic progress on 127.0.0.1:5213. Consent/disabled state, free activation, selected backup and exact-byte whole-career recovery passed; 380px document width stayed 380px. The previous local reader accepts the pre-opt-in save and rejects market version 3; the current reader accepts it. See `../design/slot-utilization-optin-20261025/browser-check.json`.

## Paired study protocol

The study crosses HAN/DAD/NRT, SGN/DAD/SIN and LHR/EDI/CDG with economy version 2 and reference/doubled fares. Every cell runs required-right controls, one healthy additional flight, repeated cancellation, and remove/readd/rebuy churn in off/on modes. A final control buys first, then opts in, proving existing purchases retain older terms. There are 54 intended 180-day trajectories, horizons 90/180 and portable checks on days 7, 45, 90 and 180.

All actions use canonical transitions and save persistence. Cancellation refunds any future sold legs on the added flight before applying the ordinary paid occurrence cancellation. Compensation, signing, upkeep, maintenance and refunds enter the cash decomposition. The churn happens on day 8, after the ordinary seven-day commitment; it removes the original template, repurchases rights and adds a new slot ID. It must not refresh the utilization window.

Independent leg, cash, seat and physical-capacity auditing remains in `long-run-audit.mjs`. Every off/on pair shares the same base and pre-intervention hashes; every price/network required off-policy control must reproduce the previous schedule-only study's save hashes. No selective retries or fee sensitivity substitution counts as a completed trajectory.

This is a finite synthetic policy study, not evidence about human behavior or real airport regulations. It does not prohibit legitimate empty flying, prove every adaptive strategy unprofitable, or confiscate old idle holdings. Multi-airport scale, adversarial timing outside the tested paths and alternate grace periods remain distinct future studies.

## Completed study result

All 54 trajectories completed without retry or replacement: 9,720 days, 216 portable-save checkpoints and 108 reconciled cash/CSV rows. Twelve old schedule-only control save hashes match the prior study exactly. All twelve attack cells (cancel and churn across three networks and two fares) return their four new rights, retain templates and have no new held rights at days 90/180. All six healthy cells retain four rights with exactly unchanged cash and AI leg counts. All six buy-before-opt-in controls retain the older contract's rights, cash and AI trajectories.

The paid canceled-flight/churn policies lose cash against their normal required-right controls in every tested cell and horizon. On-policy AI leg counts are never below that normal comparator. Effects against the same canceled-flight policy with utilization off are not monotonic: at day 180 HAN/doubled fares has twelve fewer AI legs, whereas SGN/doubled fares has seventy more. The two comparisons must remain distinct.

HAN/doubled-fare cancellation was replayed independently for 180 days in each mode, reproducing the matrix final save hashes exactly. Swift acquires a $500,000 lease on day 162 only with utilization off, despite identical opening cash; the combined leg deficit is two per day on days 162–167. Aurelia acquires a lease on day 169 only with utilization on; subsequent daily combined totals match. The four player rights were already returned on day 15. Relative to the normal required-right control, the on-policy AI leg count is unchanged, while the old canceled-flight policy has twelve extra legs. This demonstrates sensitivity of profit-scored AI acquisition decisions to the market path, not a universal monotonic benefit from capacity release.

Full results, the method, both comparator tables and diagnostic receipts: `../design/slot-utilization-optin-20261025/summary.md`. The access mechanism passes this finite scope; no general deterrence, maximum-AI-growth or production-readiness claim follows. No production deployment occurred.
