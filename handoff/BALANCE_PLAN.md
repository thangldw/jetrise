# Balance and playtest plan

## Current hypotheses, not validated retention claims
- Reserve aircraft should exchange foregone scheduled profit for fewer disruption losses; its value depends on incident frequency, maintenance pressure and capital cost.
- A support contract should be unattractive for a small lightly flown mixed fleet, and potentially attractive for a sufficiently active concentrated fleet.
- Connections should make some feeders valuable at network level without manufacturing unlimited passengers.
- Slots should create distinct viable choices among frequency, larger aircraft, alternate airports and lower-demand hours.
- AI expansion should respond to public economics without making every campaign converge to one strategy.

## Executable diagnostic
`node scripts/strategy-balance-check.mjs` writes `design/strategy-foundation-v7/support-balance.json` for deterministic synthetic support-contract comparisons. Each pair keeps fleet, cabin, routes and schedule identical and changes only the support policy. Results include changed flight profit, seven-day support fee, setup fee and net delta. It is a rule diagnostic, not evidence of retention or real airline economics.

## Add after the leg ledger
Use fixed seeds and identical starting capital for budget, premium and hub policies. Cross small/large airports, domestic/international routes, high/low fuel, demand downturns, disruption rates and heterogeneous fleet composition. Measure cash minimum, company profit, capital committed, served OD passengers, seat occupancy, misconnects/refunds, reserve hours used, route contribution, slot utilization and opponent solvency. Keep old- and new-economy results separate.

Accounting tests must pass before optimizing outcomes. Report variance across scenarios and failures, not only the best campaign. Do not claim a universal optimum from the current greedy planner.

## JET-208 baseline

JET-208 now supplies the bounded long-run baseline in `LONG_RUN.md` and `design/long-run-208/summary.md`. Seventeen90/180-day scenarios compare staged migrations, old/new economy controls, fare multipliers, connecting sales, shared slot scarcity, maintenance neglect and actual disruptions. Company cash/profit, passenger traffic, refunds, AI lifecycle, save sizes and accounting invariants are recorded. Current runtime parameters are retained; this matrix does not close the wider geography/fuel/fleet and human-playtest items above.

The executed scarcity pair identifies a concrete follow-up hypothesis: buying every recurring hub movement yields an additional$3,297,703 of180-day ending cash after extra signing and upkeep while preventing all AI legs. Test this advantage across multiple networks before choosing a price/commitment or AI hub-access change. Any later tuning must preserve already purchased rights and old-career terms through an explicit compatibility design. Connecting sales are also network-dependent: the matched v2 sales-on run ends$158,665 below sales off; gross through revenue alone is not a success metric.

## Human playtest
Run a compact first-session scenario: establish airline; choose two routes and a schedule; compare support/no-support; mark an optional reserve; handle a known disruption; review the result. Observe decision comprehension, time to first successful operating day, ability to explain forecast vs actual, unintended clicks, reasons for replay and whether alternatives felt viable.

Instrument only with explicit authorization and a privacy-aware plan. For now use manual observations and local simulation artifacts. Do not silently add analytics or collect player saves. No purchased-attention mechanics, forced return timers, offline punishment or pay-to-win parameters are needed for this validation.

## Production stabilization follow-up (2026-10-23)

`PRODUCTION_STABILITY.md` records a ten-day real-UI career walkthrough, legacy artifact-reload/reset/recovery checks and nine additional matched new-economy slot campaigns across HAN, SGN and LHR (810 days, 27 portable checkpoints). The executable runner is `node scripts/production-stability.mjs`; raw results are in `design/production-stability/slot-results.json`. All-hour hub hoarding lost $1.27m–$1.44m against required rights over ninety days under these default-fare policies, while blocking every AI leg. This differs from the earlier legacy/high-fare 180-day result and supports further matched fare/horizon comparisons before repricing. Runtime slot terms and old saves are unchanged. The UI walkthrough also identified the documented first-week planner/maintenance gap; no retention or universal balance claim is made.

## Matched slot expansion (2026-10-24)

The completed study in `../design/slot-balance-matched-20261024/summary.md` runs 46 trajectories for 8,280 simulated days, with 60 paired comparisons at days 90/180 and 184 exact portable-save checks. Primary controls hold each base snapshot, fleet/cabin, schedule and fares fixed while changing purchased rights. Three networks, both economy versions and 1x/2x reference fares are crossed; fleet-package bridges and day-8 intervention controls explain the earlier study differences. All audits and 377 Pages tests pass.

At day 180, all-hour ownership loses $2.26m–$2.81m at reference fares but gains $2.44m–$5.05m at doubled fares. Peak-hour ownership loses in every primary cell at both horizons. The original legacy scenario reproduces exactly (+$3,297,703); changing only its initial model/default-cabin package reduces that uplift to +$2,066,366. Buying remaining rights on day 8 leaves AI with 620 actual legs rather than zero. These results identify fare-dependent foreclosure and first-mover access as separate balance concerns, not a universal need to raise fees.

Keep runtime terms and existing rights unchanged. A next candidate should target excessive unused ownership/access, then undergo closed-loop paired simulation at both fare levels and an explicit old-rights compatibility review. Fixed-trajectory fee break-even values in the raw results are accounting sensitivity only. No production deployment, backend work or GitHub App setup is included.

## Slot access admission candidate (2026-10-24)

The isolated experiment in `../design/slot-access-experiment-20261024/summary.md` limits new acquisitions to scheduled/committed need plus one spare and reserves one of four rights for the combined AI pool. Existing ownership is grandfathered while held; prices, commitment dates, schedules and save schema are unchanged. This is implemented in a temporary engine copy, not production `src/`.

The completed matrix executes 52 trajectories / 9,360 days with 208 portable-save checks, 12 exact stock replays and four exact grandfathered full-hour replays at both horizons. Required-rights controls remain identical. Attempted all-hour ownership at doubled fares changes from +$2.44m–$5.05m to −$0.49m–$0.69m at day 180. However, LHR/economy2/doubled fares with peak-hour purchases still gains $31,367 and reduces AI by 24 legs. A diagnostic replay isolates the difference to Aurelia's expansion decision at day 29 and 12 operating days with one fewer aircraft through day 41. All 72 CSV rows reconcile with JSON and cash decomposition; 378 Pages tests and the Pages build pass.

Do not treat this as full foreclosure prevention or a production release candidate without further work. The admission rule preserves actual AI leg counts in 43/48 non-control horizon comparisons, but access capacity is not identical AI expansion. Follow up on the residual case and adaptive schedule/cancellation behavior. Old all-hour owners can still exclude AI by design; removing that exception would require a separately approved compatibility change. No production deployment, new saved flag, automatic reclaim, GitHub App or backend work is included.

## LHR and adaptive scheduling follow-up (2026-10-24)

The isolated combined candidate in `../design/slot-adaptive-experiment-20261024/summary.md` caps new per-hour ownership independently of scheduled demand and lets AI choose the lowest signing-plus-seven-day-upkeep legal clock. A cap-only pilot was rejected: LHR still lost 24 AI legs. Candidate effects use newly executed same-engine controls because AI timing changes both sides.

The accepted study contains 64 complete trajectories / 11,520 days and 256 portable-save checks, including four exact grandfathered careers. Four SGN edit/revert setup failures were retained and all four affected engine/fare cells were rerun using legal quarter-hour offsets; this protocol correction has separate fingerprints. All 120 accepted CSV rows reconcile with JSON and the cash decomposition. Pages regression: 380 passed; Pages build passed. Production source remains unchanged.

The original normal LHR/high-fare/peak case no longer loses AI legs: day-90 delta is zero and day-180 delta is +10. It still gains $134,283 at day 180. More seriously, the actual edit/revert attack retains 12 unused paid rights and gains $78,596/$119,749 at days 90/180 while reducing AI by 12 legs. Temporary add/remove cannot raise the new acquisition cap, but spreading reservations across hours remains a viable workaround.

Reject this candidate for production adoption. Do not hide the remaining exploit or seize/reprice old ownership. A future design must distinguish existing permanent rights from new idle reservations and review their utilization, expiry or sharing terms explicitly, with a separate compatibility decision and matched validation. The current one-per-hour cap also restricts player frequency and can force quarter-hour offsets, so it is not a neutral UX/economic change. No production deploy, save migration, GitHub App or backend work occurred.

## Conditional new-right opt-in follow-up (2026-10-25, local only)

`SLOT_CONDITIONAL_TERMS.md` records the implemented local trial and save boundary. A separate explicit opt-in protects all currently held rights, writes an exact immutable backup and applies scheduled/committed-need reclamation only to later purchases. New unused rights return after successful timetable changes or before AI/day settlement, without signing refunds or future upkeep. Pending returns and promised travel remain protected. The top-level save schema/key stay unchanged; market subversion 2 makes old readers fail closed. A whole-career pre-opt-in recovery restores exact version-1 bytes, losing subsequent progress rather than merging it.

The completed paired study in `../design/slot-conditional-optin-20261025/summary.md` contains 66 trajectories / 11,880 days, 264 portable checks and 132 reconciled rows across three networks, both reference and doubled fares, at days 90/180. All 60 no-opt-in save hashes reproduce the previous study exactly. Every opt-in horizon row preserves the matched required-right control's AI leg count; extra cost is signing only. Edit/revert returns all 12 newly purchased idle rights and loses $6,000 in all six network/fare cells. LHR/doubled fares changes from +$78,596 / +$119,749 and −12 AI legs to −$6,000 at both horizons with zero AI leg loss. All six post-purchase activation controls retain the old cash/AI effect; existing paid rights are deliberately not confiscated.

Twelve initial setup failures were caused by an English-only expected-rejection matcher; the exact current Vietnamese cap message was added. Initial evidence is retained, only affected cases reran, engine fingerprint stayed fixed and hashes of 54 reused passed cases are recorded. Regression: 382/382 Pages tests, seven focused tests, build and artifact gate passed. Real UI checks cover consent, free activation, return after day close, exact-byte whole-career recovery and 380px layout.

This trial addresses the tested change/cancel and unused-purchase paths, not rolling actual utilization. A recurring but repeatedly nonoperating service remains outside its guarantee. Do not claim all hoarding strategies are solved or deploy without a separate release request. No production deployment, GitHub App or backend work occurred.

## Actual-use new-right follow-up (2026-10-25, local only)

`SLOT_UTILIZATION_TERMS.md` specifies a second free opt-in: track only later purchases; reclaim after fourteen closed idle days using actual movement receipts; protect pending returns and sold journeys; retain stored templates and cancel their missing-right departures. A per-hour clock survives timetable replacement and early return/rebuy. Seven days without ownership allow a new window; actual nonuse reclamation imposes a seven-day reacquisition wait. Existing rights retain their contracts. The market subversion becomes 3 with an exact immutable pre-utilization backup and seven-snapshot portable packages; older local readers fail closed.

The completed study in `../design/slot-utilization-optin-20261025/summary.md` runs 54 trajectories / 9,720 days, 216 portable checks and 108 cash/CSV comparisons at days 90/180 across three networks and reference/doubled fares. All twelve cancellation/churn cells return four new rights; healthy-flight and prior-purchase activation controls retain exact cash/AI behavior. Twelve old-policy control save hashes reproduce the earlier study exactly. Pages regression: 387/387; five focused boundary tests, build, artifact gate and real UI exact-byte recovery/mobile checks pass.

All tested new-term cancellation/churn cases lose money relative to ordinary required-right controls and do not reduce AI legs against that comparator. Do not conflate that result with the effect against the old cancellation policy: HAN/doubled fares has −12 AI legs at day 180, SGN has +70. A separate exact 180-day HAN replay ties the difference to Swift's day-162 lease decision and six operating days, followed by an offsetting Aurelia acquisition on day 169. Rights had already returned on day 15. Profit-based AI reactions are path-dependent rather than monotonically increasing leg counts as capacity becomes available.

Keep this as a local opt-in trial. High-volume placeholder schedules, alternative grace periods, further adaptive timing and AI acquisition sensitivity remain separate studies. No production deployment, GitHub App or backend work occurred.
