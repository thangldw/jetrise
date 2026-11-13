# Automatic planner maintenance fix — implementation verification

## Contract

New automatic proposals reserve a legal recurring five-hour maintenance gap before searching for additional flights. They reuse maintenance.js validation for aircraft availability, weekly wrap, deadlines and shared hangar capacity. Existing service plans and every existing flight entry remain unchanged. If a valid timely gap cannot be found, the aircraft is excluded from additions and the preview explains why. This is a bounded earliest-gap/three-greedy-strategy heuristic, not a globally optimal joint maintenance/flight optimizer.

The preview explicitly lists new vs retained service checks, absolute first start/end, weekly recurrence, fee per check and total checks payable within seven days. The planner score subtracts recurring-check fees; company overhead and already-paid major maintenance remain outside this comparative flight score. Under live leg settlement the existing cohort-tail accounting remains in force. No aircraft/economic parameters changed.

The combined apply uses the original basis, rechecks proposals against current slots, flights, deadlines, hangars and protected journeys/recoveries, and returns the complete updated fleet and schedule to one optimize transition. It rejects missing, duplicate, conflicting, stale or unused maintenance entries. Persistence still writes before React commits. Checks incur no immediate payment; normal day settlement charges when a check starts. No save schema/key change, silent migration, rescheduling, backend or deployment.

## Regression evidence

The new owning regression first failed against the old code with `missing weekly maintenance preview`. After the fix it checks explicit plan/apply, preservation of a manually entered flight, portable reload, fourteen conditional projected days without cancellations, and actual first-day fees/cash bridge. Future random incidents are deliberately not treated as planner guarantees.

Additional owner-boundary cases cover the frozen pre-JET schema1 career, a completely occupied legacy aircraft retained unchanged while another aircraft expands, retained service plans, shared hangar capacity, a Sunday 21:00 to Monday 02:00 check, and atomic rejection of malformed/conflicting/stale proposals. Existing planner tests were adapted to its complete fleet/schedule apply result and maintenance-inclusive score.

Run: `node --test tests/planner-maintenance.test.mjs tests/poc-hardening.test.mjs tests/maintenance-week.test.mjs tests/live-leg-economy.test.mjs` and `npm run test:pages`.

## Browser evidence

An isolated local origin on port 5200 used a real newly founded Planner Review career (B38M/A320), HAN–DAD/BKK, real Worker preview and explicit combined apply. The preview showed two Monday 00:00–05:00 checks at $16,800 each and $33,600 seven-day fees. It applied 61 rounds, kept cash at $487,942,000 until day-close, and reload retained the recurring checks. Day 1 flew fourteen legs and charged the expected $33,600 once. A subsequent no-additions preview retained the checks and disabled apply with an explanatory message. At 380px the document width and scroll width were both 380px.

Screenshots and day-close text are in `design/planner-maintenance-p2/`. This is agent functional verification, not a human retention or physical-device/Safari certification.

## Boundaries

At initial verification, the source was local and undeployed. Production and real player saves were not accessed or altered during that verification. Previous stabilization/balance artifacts describe the earlier source fingerprint and were not overwritten or presented as fresh measurements after this change.

## Final checks

- Five new planner/maintenance tests passed within `npm run test:pages`: **373/373**, exit 0. The focused four-file run before adding the integrated case passed **53/53**.
- Fresh `npm run build:pages`: passed; inherited Vite large-chunk warning remains. `npm run verify:pages`: passed; artifact contains only allowed assets/index without source-map references.
- Real UI also imported the prior synthetic day-11 Stability Air package. Its full SA-101 schedule received an explicit no-gap reason and no additions; the proposal retained SA-102's existing check and offered five extra rounds only for it. That preview was left unapplied.
- 380px document/client width matched, keyboard Tab reached the next action, and no browser console errors were captured.
- Strict premium static audit reports eight existing `affordance.actionless-button` detections in QA Button wrappers forwarding `{...props}`. These wrappers pass handlers through and are unchanged; no finding points to the touched runtime UI. This is a static-analysis limitation, not a clean whole-project audit claim. Raw output is retained in `static-audit.json`.
- No full Sites packaging or physical-device/Safari certification is claimed. No production deploy occurred.
