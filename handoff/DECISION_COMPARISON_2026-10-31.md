# Decision comparison

Status: release candidate; publication tracked in RELEASE_DECISION_COMPARISON_2026-10-31.md.

Headquarters → Compare options and its overview shortcut run up to four independent alternatives against the exact same serialized career snapshot: proportional Y/J/F fares, target weekdays at one existing aircraft/route/clock group, a fourteen-day lease with explicit weekly maintenance and flights, or route acquisition with explicit flights. No package combines all four. Each option executes bounded existing canonical actions on clones. Frequency retains selected IDs and unrelated clock groups; failed preparation spends nothing in the real career. New leased aircraft must have their first five-hour check complete by the first deadline; a red regression exposed the Sunday20:00→Monday01:00 late boundary and the default now uses Sunday18:00.

The existing planner module Worker performs the comparison. Seven-day conditional replays use canonical day settlement, including deterministic game incidents, market events, maintenance, shared slots, passengers already sold, stock, leases, debt and deliveries. This is a simulated conditional replay, not a guarantee or the planner's no-new-incident forecast. Metrics expose immediate cash, operating profit after HQ, end/minimum cash, reserve peak, canceled flights and incidents. Unfinished periods have no delta and cannot be applied here. Lease deposits/remaining full-contract rent, weekly-check costs and deferred revenue are shown separately; costs outside seven days are not estimated as full lifecycle ROI.

Applying `decision-apply` checks the complete snapshot basis, recomputes the selected option and rejects altered displayed results/actions/specs. It returns only immediate canonical actions for one normal save-store write, never the seven simulated days. There are no save fields, key/schema changes, automatic opt-ins, backend or new dependencies. Existing tab locking, quota protection, backups and paid slot rules remain authoritative.

## Validation

- Five focused behavior tests: all four options versus independent canonical action/day replay; exact fees/cash; retained frequency IDs; failed lease/service/flight atomicity and late-check regression; stale/tampered/duplicate apply; incomplete horizon; legacy and all-JET restore equivalence.
- Release checkout: build:pages, verify:pages and test:pages pass (400/400).
- Real browser App/Worker/save-store on disposable localhost: all four comparisons, selected lease review, no preview save mutation, single-option apply, exact canonical saved bytes. Day stays1; $247,200 spent once, cash$8,352,800, four planes and three weekly flights; new check starts162 and ends167 before deadline168.
- 380px document=viewport width; no horizontal overflow. Runtime browser errors captured: none. Old/new save bytes are synthetic QA artifacts only.
- Strict UI audit has eight pre-existing older QA wrapper findings, none in this change. Existing bundle-size warning remains. No Sites configuration change.
- Full old-career/slot compatibility replay and CI publication evidence are recorded separately by the release receipt.

Evidence: design/decision-comparison-20261031/.
