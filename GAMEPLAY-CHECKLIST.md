# JETRISE — Gameplay implementation checklist

Scope: the existing browser-local single-player PoC, expanded with four integrated strategic gameplay systems. Checked items are implemented. Online services listed separately are not implemented or simulated as real multiplayer.

## Core loop

Establish airline → acquire/configure aircraft → open routes → plan flights and maintenance → compare decisions → operate one day → inspect actual results → reinvest and progress.

## 1. Airline founding
- [x] Choose country, initial airport/hub, airline name and registration prefix.
- [x] Reroll three logo concepts and six primary colors, with live branded aircraft illustration.
- [x] Grant $500 million and two distinct random medium aircraft exactly once.
- [x] Configure cabin, amenities and paint before the first flight.
- [x] Recommend two domestic routes and one international route when available; support custom destinations.

## 2. Aircraft ownership and fleet
- [x] Thirteen Airbus, Boeing and Embraer models with operating profiles, capacity, speed, range and game costs.
- [x] New orders with two-/four-day delivery; immediate used purchases priced by age and wear.
- [x] Standard 14-day lease, daily rent, refundable deposit, early return and expiry.
- [x] Fleet cap of eight including pending deliveries; persistent unique aircraft registrations.
- [x] Sales, hub transfers and operational lifespan.
- [x] Cabin Y/J/F sliders with weighted capacity and exact seat-count visualization.
- [x] Eighteen liveries, live paint preview, Wi-Fi, screens, comfort seats and charging options.
- [x] Weekly planned utilization and seven-day per-aircraft operating margin.

## 3. Hubs and route network
- [x] Buy additional hubs and upgrade hangars.
- [x] Search airports by city, name, country and IATA; create scenario airports.
- [x] Explicitly purchase routes without automatically adding flights.
- [x] Enforce origin hub and aircraft range, including long-haul routes.
- [x] Shared finite passenger markets across both orientations and multiple aircraft.
- [x] Market profiles by airport pair, class and weekday; fares and capacity targets.
- [x] Geographic network map, local/global framing and route discovery by free aircraft interval.

## 4. Flight planning
- [x] Weekly 168-hour repeating template; hour grid and 15-minute departure controls.
- [x] Aircraft, route and company scopes; overnight and cross-week continuations.
- [x] Edit one flight or matching departures on all weekdays atomically.
- [x] Enforce collision, range, hub, maintenance and lease limits.
- [x] Compare three automatic allocation strategies; preview and explicitly apply the best heuristic proposal.
- [x] Dated recovery overrides shown separately from the unchanged weekly template.

## 5. Maintenance and reliability
- [x] Wear, accumulated service hours, named technical faults and grounding.
- [x] Five-hour recurring weekly checks; night/weekend gap suggestions.
- [x] Major 24-hour and emergency 48-hour maintenance, hangar capacity and downtime.
- [x] Actual airborne reservations prevent selling, moving or repairing an aircraft before landing.
- [x] Paid maintenance and recurring fees reconcile once with daily accounts.

## 6. Finance, people and services
- [x] One authoritative wallet and explicit daily close, with affordability guard.
- [x] Fuel and CO2 stocks, weighted purchase basis and automatic replenishment for actual flights.
- [x] Hub fees, payroll, temporary staffing, training, ground service and onboard service.
- [x] Loans, interest and principal; financial report separates profit from cash flow.
- [x] Loan terms of 14/28/56 operating days with fixed daily rates, exact payment tables, liquidity previews and explicit partial prepayment; existing loans retain their terms.
- [x] Marketing and R&D with operational effects.
- [x] New-career expansion prices and synthetic market balance; legacy financial terms retained.

## 7. Operating contracts — added in this release
- [x] Up to three offers per seven-day cycle, on owned routes; two-day acceptance window.
- [x] Standard or negotiated terms: +12% fare in exchange for +25% passengers and +50% penalty.
- [x] Read-only ten-day before/after economic comparison and predicted contract completion.
- [x] Accept/decline, three concurrent contracts, persistent deadlines and progress.
- [x] Contract passengers consume actual Economy seats before ordinary passengers; no double booking or duplicate ticket income.
- [x] Transport flexible groups within a seven-day window, across aircraft and both market orientations.
- [x] Earn fare only on transported passengers; one bonus at >=90% completion or one fixed penalty at deadline.

## 8. Market opportunities and risk — added in this release
- [x] Announced tourism, fuel and low-season events on a deterministic weekly cycle.
- [x] Four-day effects on ordinary demand or fuel purchase price; prepaid inventory cost is preserved.
- [x] Unresearched future forecasts use the center of the published range.
- [x] Optional $5,000 research reveals the fixed simulated event factor; no repeat charge.
- [x] Forecasts, route economics, optimizer and actual settlement share the event model.
- [x] Actual event effects appear in day-close reports.

## 9. Disruption recovery — added in this release
- [x] Review forecast cancellations over the next seven days with actual fault names.
- [x] Swap a single dated departure to a compatible aircraft at the same hub.
- [x] Delay within the same day after a maintenance window, using 15-minute selectors.
- [x] Lease a replacement aircraft for three days, with 1% deposit and premium daily rent; existing lifecycle handles charges and return.
- [x] Cancel one dated round trip with $15 compensation per scheduled passenger seat.
- [x] Compare affected passengers, cancellations, operating profit, upfront cash and new lease cost before committing.
- [x] Validate absolute-time collisions, cross-day occupancy, range, hub, maintenance and lease expiry.
- [x] Keep weekly template intact; remove a dated override explicitly without refunding already-paid rental.
- [x] Prevent later weekly edits from colliding with saved recovery plans.

## 10. Campaign and decision feedback — added in this release
- [x] Six sequential chapters: first flight, profitable route, 1,000 passengers, successful contract, profitable operating week, two active hubs.
- [x] Progress comes from actual operated results; reward claims are explicit and one-time.
- [x] Rewards total $450,000, separate from operating P&L; no daily attendance or offline penalties.
- [x] Legacy careers start campaign counters on upgrade without rewriting old history or granting retroactive money.
- [x] Forty-entry decision log and seven-day review.
- [x] Actual per-aircraft revenue/profit/passenger rollups in daily reports, with clear exclusions from aircraft margin.

## 11. Player controls and saved progress
- [x] Touch-first sliders, discrete time selectors, native dialogs and visible errors.
- [x] Desktop and narrow-screen strategy interface using the existing visual system.
- [x] Opt-in sound, reduced-motion support and keyboard-native controls.
- [x] Save validation, previous valid backup, damaged-save preservation and stale-tab protection.
- [x] New gameplay fields migrate without resetting the airline, cash, fleet or routes.

## Separate online/commercial roadmap — not in this browser-local release
- [ ] Server-authoritative economy, account identity and cloud saves.
- [ ] Real-player competition by country/route, alliances and shared aircraft market.
- [ ] Live-operations content management and telemetry-based retention/balance tuning.
- [ ] Real-money cosmetics/season pass, purchase validation and payment infrastructure.

Do not label bots as real players or local persistence as cloud saves. Multiplayer and monetization require an explicit server/service implementation project and production validation.

## Balance and verification boundaries

All economics are virtual gameplay assumptions. Daily flight revenue is recognized on round-trip departure, not each arrival. Routes are round trips returning to the departure hub. Aircraft utilization measures planned weekly calendar occupancy. Aircraft operating margin excludes company overhead, maintenance, lease and contract bonuses/penalties; company reports include those amounts as applicable. Campaign rewards and optional research purchases appear in the cash ledger outside operating P&L.

The deterministic model has no real-world traffic or price feed. Market research reveals a simulated event factor, not real financial forecasts. Future unresearched events and new technical incidents can change outcomes. Unit simulations establish accounting/invariant correctness; retention, difficulty and monetization need human playtests.

## 12. Competitive strategy — optional single-player upgrade
- [x] Explicit activation with before/after forecast and confirmation; old careers remain unchanged until activation.
- [x] Budget, business and leisure preferences across Y/J/F; fare, departure time, installed amenities and completion reliability affect customer choice.
- [x] Finite market allocation across operable player seats, two local AI rivals and a no-flight option; contracts consume seats first.
- [x] Each rival has one owned A320neo and $5m operating cash, one round/day, origin/range/duration constraints, a weekly maintenance day and daily cash/cost accounting.
- [x] Weekly AI fare reactions based on completed load factors; loss-making rivals can select a higher-potential eligible route at their original hub.
- [x] Fare slider and quick trials compare today's whole-company profit, cash after the existing change fee, passengers and projected market allocation. Saving uses the existing once-per-day prices action.
- [x] Actual allocation and gradual completion reliability persist after daily settlement; forecast and actual share competition rules.
- [x] 42-day challenge: positive cumulative operating profit,21 profitable days and10,000 passengers. One frozen outcome, no cash reward, and continued play after completion.
- [x] Legacy wallet, aircraft and schedules preserved. Activated competition cannot be toggled to alternate economic models.

AI fleets and costs are bounded abstractions, not autonomous versions of every player subsystem. Only eligible opened routes at the first hub are contested. The later JET-202/203 sections deliver connecting journeys and recovery; bounded rival leasing is also delivered. JET-206 below adds independent AI network expansion; real PvP remains unimplemented. Challenge thresholds require human playtesting.

- [x] New-route opening advice: up to three routes shortlisted from the airport catalog using current hub, range, cash and a feasible seven-day departure. Compare marginal operating flight profit per hour, passenger estimate and opening fee. Selecting only previews the quote; purchasing and scheduling remain separate. Bounded search, not guaranteed global optimization.

- [x] Five task workspaces, direct Strategy navigation, dedicated aircraft/whole-airline schedule views, operating priorities and a forecast-before-day-close flow. Existing management components and game transitions are reused; original career progress is retained.


### Cabin and equipment catalog upgrade (2026-10-21)
- [x] Vertical model-aware two/three-block cabin plan, exact live seat counts, row/seat labels, class navigation and mobile scrolling.
- [x] 16 amenity packages in connectivity, entertainment, cabin/seat comfort and onboard service groups; original four purchases remain compatible.
- [x] Read-only amenity preview with upfront/per-passenger economics and canonical seven-day marginal company forecast; explicit one-time installation.
- [x] Bounded comfort score feeds optional competitive passenger choice; actual flight passengers drive income and service costs.
- [x] New-route destination starts unselected; manual or recommended selection precedes quotation and purchase.


## Strategic gameplay v8 (2026-10-22; current scope)
User explicitly requests playable mechanics in the PoC, not only a Codex backlog. Preserve opt-in reserve aircraft, paid family support, same-day connecting tickets, hourly hub slot contracts and bounded AI leasing. `handoff/CURRENT_STATE.md` defines the delivered boundaries; earlier statements that connections or AI fleet growth are entirely unavailable are superseded. The JET-202/203 sections below supersede the original overnight/rescue exclusions. JET-206 below supersedes the original independent-network exclusion.

`network-economy.js` allocates residual Y seats after direct/contract demand; one through fare is apportioned across two legs, and passenger totals count boardings. Both source cycles must finish in the day, direct purchased ODs are excluded, fare-sensitive directed demand is capped at40 and detour at1.8. Explicit program fees must flow into forecast, cash bridge, per-plane contribution and reporting without duplication.

`airport-slots.js` counts both movements and week wrap. Opt-in uniform hourly capacity is a synthetic hub challenge with disclosed signing/daily costs and seven-day commitment, not a shared global slot market. Manual/automatic/recovery edits must fail atomically before charging when overbooked. AI leases are limited to two per rival, serve its current route, and spend/refund only rival cash. Never label bots as online players.

UI reuses Button, RangeControl, native selectors, existing cards/tables and strategy navigation. Paid actions disclose prices, current vs draft state and commitment; forecasts do not save. Timing/slot studies remain explicitly read-only and distinct from live controls. Preserve current saves, identity, route indices, registrations and the coral/ivory/navy visual language.

## JET-201 live per-leg economics (2026-10-22)
- [x] Explicit opt-in in Strategy → Sổ theo chặng; legacy and new careers remain opt-out. Wallet, assets, schedules and history unchanged on activation.
- [x] Verified immutable migration backup, download and explicit whole-career rollback after archiving the live branch; existing tab conflict protection.
- [x] Bounded dated manifests and cent accounting; ticket cash and round payments at departure, per-leg expenses/deferred revenue, reload and Sunday/Monday continuity.
- [x] Pending contract reservations, arrival-based delivery/deadline, same-day connection seat/fare preservation and dated return slot protection.
- [x] Shared actual/forecast accounting, P&L/cash bridge, aircraft margins and cohort-tail planner/route/Finder score.
- [x] Existing pre-activation shadow comparison, worker loading/error states and local table scrolling.
- [x] JET-202: separate opt-in with exact pre-migration backup, download and whole-career rollback; root schema1 and old saves retained.
- [x] Real one-stop journeys across midnight/week boundaries; both dated Y seats held at first departure-day sale; one fare with exact per-leg attribution.
- [x] Shared directed OD demand after direct/contract allocation, including conserved AI outside-choice customers; bounded lookahead and no hidden demand multiplier.
- [x] Sold fares/costs remain locked; stop-sales honors reservations; destructive itinerary/capacity edits require explicit partial refund first.
- [x] Unexpected downstream cancellation refunds the unflown share and unused handling once; financial rows, aircraft contribution, planner cohort score and cash bridge reconcile.
- [x] Full itinerary UI with dates, wait, per-leg seats/revenue/cost, predictions, pending tickets and actual settlement summary.
- [x] Sales before first departure day: JET-209 opt-in advance direct sales (6-day horizon, 40% cap, fare-locked lots, explicit full refunds). See handoff/ADVANCE_SALES.md.

See `handoff/LEG_LEDGER.md` for rules and `handoff/VERIFICATION.md` for executed checks and packaging limits.


## Airline positioning and branched R&D (2026-10-22)
- [x] Three explicit service positions with segment-specific advantages/disadvantages, signing fees, daily overhead, actual per-passenger economics and seven-day change/end commitment; existing ground packages retained.
- [x] Conserved AI market/seat allocation; addressable route demand when AI is off; no new physical capacity.
- [x] Three legacy research foundations retained, plus six sequential branch projects with prerequisites, one active project, three/five game-day duration and paid cancellation without refund.
- [x] Actual fuel/CO2, wear, service-cost and targeted preference effects; canonical forecast, day close and fixed-fee reporting; immutable already-sold itineraries.
- [x] Optional schema1 fields, strict validation, canonical serialized save-store, seven-day read-only comparisons and desktop/mobile controls.
- [x] JET-205 opt-in aggregate customer loyalty by segment, actual budget/business/hub goals, frozen ticket experience, recovery-aware terminal outcomes, paid commitments, same-capital replay and migration backup/rollback. Research retains its independent fixed preference effect.
- [ ] Individual customer histories, empirical commercial balance and retention validation.


## JET-203 disruption and connecting recovery (2026-10-22)
- [x] Explicit reproducible weather/technical scenario in Strategy → Cứu chuyến; compare before committing, no automatic incidents or save migration.
- [x] Actual dated leg delays and forward aircraft/connection propagation, keeping weekly templates and already settled events unchanged.
- [x] Wait, rebook onto an eligible own-network leg, refund missed onward shares, cancel an unstarted rotation or explicitly dispatch a designated reserve.
- [x] Rebooking of sold tickets from a known faulty onward rotation, without collecting the fare twice or displacing direct/contract/held seats.
- [x] Atomic capacity, continuity, hub/range, maintenance, lease, slot, funding and stale/tampered-preview validation.
- [x] Disclosed synthetic delay/compensation/rebooking/reserve costs, canonical seven-day profit comparison, immediate cash payment, once-only expense and cash bridge.
- [x] Separate punctuality and completion/cancellation outcomes, protected dated operations, strict restore and existing rolling/immutable-backup compatibility.
- [x] Desktop/mobile controls with full airport names, actual before/after itineraries and storage-free QA fixture.
- [ ] Automatic weather/airport closure generation, moving first departure to a different day, multi-stop or rival-airline rebooking and empirical balance validation.

See `handoff/DISRUPTION_RECOVERY.md` for the implemented bounds.


## JET-204 shared airport rights (2026-10-23)
- [x] Separate opt-in after JET-201 and AI, three selected network airports, four shared synthetic movements/hour.
- [x] Purchase recurring weekday/hour rights, visible free/player/AI ownership, minimum commitment, ongoing upkeep and explicit surplus release. No automatic expiry of recurring rights.
- [x] AI pays signing/upkeep from its own cash, moves to another legal hour, reduces rotations or stops when constrained; legacy same-route fleet, extended to per-plane independent routes by JET-206.
- [x] Dated arrivals/departures, Sunday returns, deleted templates, cancellations, held overnight tickets and JET-203 timing use the shared checks without free capacity or duplicate charges.
- [x] Canonical forecast, planner invalidation, actual movement reporting, cumulative costs, strict restore, exact immutable activation backup and whole-career rollback.
- [ ] Slot auctions, term-dated rights/expiry and external traffic datasets. JET-206 below adds independent rival network growth.

See `handoff/SLOT_MARKET.md` for delivered terms and `handoff/VERIFICATION.md` for executed checks. This supersedes the earlier statement that all slot capacity is separate from AI.


## JET-206 autonomous rival fleet and routes (2026-10-23)
- [x] Explicit opt-in after JET-201, competition and JET-204; preserve current rival capital, owned aircraft, paid legacy leases and all player progress.
- [x] Public fixed shortlist, weekly canonical profit comparison after route/slot/fixed costs, cash reserve and legal-flight gate; up to two additional leases and four routes per rival.
- [x] Actual route/deposit/rent/maintenance/overhead payments; grounded service days, early loss/insolvency returns, term expiry and once-only refunds.
- [x] Independent per-aircraft routes outside player inventory, one common airport-pair passenger pool and capacity-constrained allocation; no player route-index changes.
- [x] Shared dated leg recognition with integer cents, stable IDs, actual per-plane/leg/cash reports and JET-204 finite slot rights.
- [x] JET-202 residual OD reservations, JET-203 protected rebooking and JET-205 terminal experience remain integrated.
- [x] Current versus projected UI, explained review, exact-byte migration backup, strict restore, serialized persistence and archived whole-career rollback.
- [ ] Additional owned-aircraft purchases, new AI hubs, overnight/connecting AI itineraries, global slot markets and online rivals.

See `handoff/RIVAL_NETWORK.md` and `handoff/VERIFICATION.md`. Local synthetic gameplay, not validated real airline economics.


## JET-207 Save Manager (2026-10-23)
- [x] Settings, onboarding, founding and recovery access; summary and raw/package download.
- [x] Read-only file preview, explicit import confirmation, legacy schema1 compatibility and missing-backup warnings.
- [x] Portable current/previous saves plus validated reachable JET-201/202/204/205/206 migration snapshots; JET-203 travels in the live ledger.
- [x] Restart preserves a uniquely archived whole career before returning to founding; old save restore remains possible.
- [x] Snapshot collision, malformed data, size, quota/readback and stale-tab protection through the canonical save-store/lock.
- [x] Explicit archive-only deletion, no automatic pruning or deletion of main/migration backups.
- [x] Integrated migration, cross-week settlement, rollback/reactivation and AI lease restoration tests; browser export/import/reset/recovery/reload and width checks.
- [ ] Cloud sync, authenticated/encrypted backup packages and conflict merging (separate infrastructure scope).

Rules and executed evidence: `handoff/SAVE_MANAGER.md`, `handoff/VERIFICATION.md`.

## JET-208 long-run validation (2026-10-23)
- [x] Reproducible17-scenario90/180-day matrix using canonical transition, forecast, persistence and daily reload.
- [x] Independent direct/connecting/AI leg, cash, deferred/prepaid, seat/demand, customer and shared-slot reconciliation.
- [x] Frozen old-format thirteen-schedule fixture; staged opt-ins and full combined JET-201–207 careers.
- [x] Periodic actual export/import continuation, archived restart/restore, migration rollback and quota/stale/unfunded rejection.
- [x] Same-start fare sweep, connecting-sales control, scarce-slot control and maintained/unmaintained economic diagnostics.
- [x] Source-fingerprinted JSON, human-readable report and storage-free standalone HTML; no runtime repricing or schema change.
- [ ] Wider airport/fuel/fleet/difficulty sampling and human playtests; universal balance, retention and deployment are not claimed.

Rules: `handoff/LONG_RUN.md`. Executed results: `handoff/VERIFICATION.md` and `design/long-run-208/summary.md`.

## Production slot acquisition update (2026-10-25)
- New per-weekday/hour acquisition cap: one player movement; higher already-owned quantities remain grandfathered.
- Expanded AI compares legal affordable clock costs in forecast and actual settlement.
- Existing ownership, prices, commitments, schedules, saved tickets and schema1 remain intact.
- Known balance limitation: edit/revert can retain paid idle rights across hours. This is not complete foreclosure prevention.

## Actual-results profit explanation (2026-10-31)
- Headquarters → Finance compares the last settled day with the preceding day, or seven complete consecutive days with the preceding seven.
- Shows accounting contributions to profit change, available expense details, actual aircraft/route flight-profit contributors, and per-day profit-to-close-cash reconciliation including unexplained residuals.
- Missing historical fields and incomplete periods remain explicit; old reports without legEvents do not receive reconstructed route results. No causal fare/demand attribution or lost-revenue estimate is claimed.
- Read-only; no migration, save format, balance, schedule or purchased-right change. Deployed and verified; see handoff/RELEASE_2026-10-31.md.

## Operational alert center (2026-10-31)
- Bell, Headquarters overview and pre-close DayBrief open one operational alert center.
- Maintenance: faults/high wear, missing timely weekly checks within 72 hours, and already-booked heavy service status.
- Slots: actual shared-right or legacy-package deficits from canonical requirements; no invented capacity limits for opt-out careers.
- Connections: canonical seven-day refund forecasts for currently sold pending journeys; recent already-settled missed-connection outcomes are informational.
- Lease: expiry within seven days, exact return day and affected planned rounds; opens the corresponding aircraft contract.
- Native category filtering, explicit priorities, missing forecast coverage and existing operational destinations. Read-only; no save changes or automatic actions. Deployed and verified; see handoff/RELEASE_OPERATION_ALERTS_2026-10-31.md.

## Decision comparison (2026-10-31)
- Headquarters compares four independent fare/frequency/lease/route alternatives with one unchanged baseline snapshot, using a module Worker and canonical seven-day conditional settlement replay.
- Immediate spending, operating profit, cash, reserves, cancellations and remaining lease obligations are separated. Incomplete simulations cannot be applied or compared as full weeks.
- One explicit preview/apply transaction revalidates snapshot and full option, commits only its immediate canonical actions and never advances seven real days. New leases reserve a timely weekly check; failed packages never partially spend or alter schedules/rights.
- Save schema/key and economic parameters are unchanged. Deployed and verified; see handoff/RELEASE_DECISION_COMPARISON_2026-10-31.md.

## Weekly recap and coaching goals (2026-10-31)
- Headquarters → Weekly recap aggregates retained actual daily reports into fixed game weeks (1–7, 8–14, …), with weighted financial/operation ratios, complete-week comparison and accounting-mode warnings.
- One optional weekly goal: positive 10% margin, at least 14 executed legs with 95% execution, or 20 completed connecting passengers with positive company profit. These are synthetic coaching thresholds, without rewards or economic modifiers.
- Explicit save/switch/clear uses the authoritative transition and existing serialized save store. Old careers receive no automatic goal metadata. Incomplete/missing/duplicate or aged-out reports cannot certify success; history remains bounded to 28 days, without permanent achievement storage.
