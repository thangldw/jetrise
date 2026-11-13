# JETRISE PoC interaction contract

Primary source: user request for a new interactive PoC based on design/reference.png. Gameplay is a small synthetic simulation, not full Playrion parity.

| Capability | Owner | Behavior |
|---|---|---|
| Game state | game.js / transition | One wallet, fleet, inventory, day and weekly schedule. Pure atomic transitions, no backend. |
| Navigation | App / workspace-navigation.js | Five local workspaces retain aircraft/route selection and last selected subarea. No fake destinations. |
| Schedule | engine.js | 168-hour repeat, quarter-hour times, collision/range/wear guards, overnight blocks across two days. Each block is a round trip. |
| Demand/fare | engine.js demand/evaluate | Three finite fare-sensitive pools shared across all aircraft on a route/day. Fare simulation never commits or charges. Price commit costs $5,000 once per route/day. |
| Cabin | game.js cabin transition | Nonnegative integer Y/J/F counts, weighted 1/1.8/4.2 space, nonempty and within model capacity. Free configuration in PoC. |
| Settlement | game.js advance | Explicit 24-hour step; whole-day affordability guard; automatic fuel/CO2 top-ups, weighted prepaid inventory costs, history cap28. No real-time or offline earnings. |
| Fleet/routes | game.js | Fictional purchases, cap8, maintenance $60k; 3 starting routes plus 2 purchasable routes. |
| Select/Listbox | Native select | Platform-owned popup and keyboard behavior are accepted. |
| Fields | native input/select + shared Field | Labels, inline live errors, aria-invalid, first-error focus. Draft preserved during unrelated game updates. |
| Feedback | App status region | One polite toast and persistent inline errors; report dialog for day results. |
| Dialog | shared native Dialog | Named title, inert background, Escape, initial focus and restore connected opener or active nav. Reset requires confirmation, cancel focused first. |
| Persistence | SAVE_KEY / restoreGame | Isolated browser-local save; malformed data recovery warning; visible blocked-storage state. No cross-device or multi-tab synchronization promised. |
| Data lists | Fleet / history / WeeklyGrid | Finite catalog and rows; 28-day history; no paging or remote states needed. |
| Scroll/motion/audio | styles.css / App | Shared scrollbar baseline; document scroll on narrow/short screens; reduced motion and opt-in sound. |

The geographic illustration is not a navigation-grade map. Apparent 3D is prerendered art; only routes/UI are interactive. Prices, demand, wear and operating economics are synthetic. No real payments, login, online rivals or cloud saves.

## Canonical UI Map

| Capability | Canonical owner | Source of truth | Allowed variants | Verification |
|---|---|---|---|---|
| Select/Listbox | Native select | App.jsx / this contract | Aircraft, route, weekday | Live desktop and phone browser |
| Date | Native time select | AddForm / engine.slotError | Quarter-hour times | Live collision and success flows |
| Form | Field and named native FormData | game.js / this contract | Cabin, prices, schedule | Domain tests and live browser |
| Toast | App polite status region | App.jsx | Success and error | Live action feedback |
| CRUD | transition | game.js | Fleet, routes, weekly slots | Domain tests and live purchase/save/reload |
| Scrollbar | Global styles.css | DESIGN.md | Internal schedule/inspector overflow | Live desktop and phone |

## Numeric control update
RangeControl owns cabin and fare inputs: native range keyboard/touch support, associated label, live numeric output, bounded one-step ± buttons. Cabin maximum updates from remaining 1/1.8/4.2 weighted space; no automatic removal of other classes. Empty cabins cannot save. Fares retain integer $20–$10,000 bounds; preview stays nonmutating and clears on draft changes. Native time select exposes all 96 quarter-hour options; submit still reads named FormData. No typed numeric inputs remain.

## Cabin visualization
CabinDiagram renders exactly Y+J+F seat marks, including partial rows. Zero-seat classes show an empty section. Editing a slider updates the draft schematic immediately; closing without save discards the draft. Successful save updates the inspector schematic and persists through the existing state path. Geometry is owned by cabin-layout.js.

Cabin Studio retains exact per-seat marks using a generated sprite atlas. Zoom toggles 2x horizontal overflow; keyboard-focusable viewport permits scrolling. Save stays pinned within the cabin dialog. Closing still discards draft edits.

AircraftMarket owns the finite13-model catalog, manufacturer native select, ascending in-game price, affordability reason and existing fleet-cap guard. All purchases use the existing transition; saved model keys remain compatible. Sprite rectangles and centers are owned by cabin-layout.js and used without additional renderer offsets.

## Management game contract (current)
- hq.js owns hub/hangar, staffing, training, loans, service, marketing, stock and research actions; game.transition is the only commit boundary.
- Hub ownership opens its included regional starter routes; separately priced intercontinental routes still need purchase. Aircraft base must match route origin. Transfers cost$25k and remove that plane's schedules; unavailable aircraft cannot transfer.
- game.forecast adds daily payroll/agency/hub/rent/interest; loan principal is cash-only. First-day lease rent is prepaid, expensed once at day close and never charged twice. All commits reject nonfinite wallet/report values.
- fleet.js owns cosmetics, options, age, maintenance and lease lifecycle. Normal maintenance lasts1 day, faults2;40h periodic interval and25-year life are fictional game rules. Maintenance blocks overlapping flights; original weekly slots remain.
- New purchases pay upfront and enter orders, delivered at day+2 or+4. Used aircraft and leases arrive immediately. Fleet plus pending orders cap8. Lease term14 days, refundable5% deposit, daily rent0.15% model price; first rent paid immediately. Expiry removes plane and its slots. At least one owned aircraft is retained on sale.
- Existing schema1 saves migrate HQ, aircraft fields and route fare arrays; invalid state is rejected.
- planner.js proposes positive marginal operating profit/hour flights while retaining manual slots, capped80 additions/480 total. This is a heuristic at current prices, projecting accumulated hours/wear, booked maintenance, lease expiry and campaign expiry, not a global optimum or incident forecast. The UI previews then recomputes on application.
- ScheduleOffice provides company/plane/route filters and edit actions. Existing AddForm handles add/edit with named FormData. Engine.slotError prevents overlap, hub/range/maintenance/lease conflicts and week overflow.
- Routes may exceed24h; weekly chart displays continuation segments and correct midnight day. One block is a round trip, credited on departure day in this PoC, not per-leg arrival settlement.
- Route targets are planning targets only; they do not create market demand. Actual offered seats and finite shared demand remain engine-owned.

## Route intelligence (2026-10-19)
- Engine.modelDuration owns model-sensitive duration, used by the chart, collision guards, settlement, planner, Finder and reference model selector. Calibrated route cycles include one turnaround hour at800km/h; model speeds are synthetic game parameters. Every catalog speed is at least800, so new durations never exceed legacy quarter-hour durations. Old departure times and valid adjacent schedules remain valid; future fuel and hours reflect updated durations.
- opportunities.js owns read-only scheduleGaps, findOpportunities and fareWeek. Finder filters actual base, range, duration band, gap boundaries, maintenance, lease and schedule cap. It scans legal quarter-hour departures within the selected gap, including midnight. Rank by marginal operating profit/hour over the next7days with finite shared demand and projected wear/hours. Route purchase cost is separate and deducted in the first-week comparison; existing fixed overhead is excluded.
- Unowned route: explicitly buy first, then add the previewed flight. Both use transition and revalidate current state. No combined implicit purchase or auto-scheduling. Recompute opportunities after each commit; preserve aircraft/filter choice and use the next existing gap when the old gap changes. Weekly schedule maximum480 is guarded before add.
- PriceForm previews the actual route schedule across all aircraft for7days. Show Y/J/F demand and remaining demand, passengers and operating profit before/after, and aggregate delta after the existing$5k change fee. No schedule means zero flight profit. Projections share planner.projectedWeekReports, include booked maintenance/hours/lease expiry, use current resource prices and omit unknown future incidents. Neither preview changes cash, fares or schedule.
- The finite13-route Finder renders all matching cards; ephemeral aircraft, interval and duration filters live only for this modal session, matching the local-only app architecture. Tables retain internal horizontal overflow. Shared native select, Button, RangeControl and polite inline status remain canonical.

## Aircraft illustration accuracy correction
Fleet cards and FleetStudio must not render the generic livery atlas: it incorrectly presented one widebody silhouette as different aircraft models. Use the existing model name and current paint-design text. Keep existing paint selection, pricing, transition, persistence and all aircraft operations unchanged. Aircraft artwork may return only with verified model-specific assets. Cabin seat-count diagrams remain functional cabin illustrations; the cinematic scene is background art, not an individual model preview.

## Airline founding and custom airport network (2026-10-19)
Business evidence: user requests for destinations outside the original catalog, custom routes, airport name (IATA) labels, and first-run country/airport/name/logo/color selection. Airport name and coordinate provenance: src/data/airports-source.json and the frozen OurAirports snapshot. Existing virtual-money conventions, transition settlement and persistence continue to apply.

- network.js owns airport identity, labels, great-circle distance, immutable route quotes, brand presets and validation. Snapshot has4008scheduled-service IATA airports. Scenario airports are explicitly user-provided and limited30; custom routes100; owned hubs30. Custom destinations need not be hubs. Starting hubs must be catalog airports.
- game.routesFor appends derived custom routes after the original13entries, keeping legacy indices stable. Save only custom route endpoint identities; the bundled source snapshot is frozen and must not be changed without a compatibility review. Derived distance, economics and fare rows are domain-owned; action-supplied price/demand/distance never overrides them. Existing seed economics remain unchanged. Route purchase is explicit, does not add a flight and rejects duplicates, same endpoint, distance below50km, insufficient money, missing origin hub or range beyond the catalog.
- AirportPicker is the canonical shared local selector: one ARIA 1.2 combobox (accent-insensitive name/IATA/country search, popup listbox; initial country only seeds the empty-query list). Render at most60options ranked by exact IATA, label prefix, word prefix, substring; show the committed selection as the input text and pin it only while browsing, never while searching. Keys: ArrowUp/Down move and wrap, Enter chooses (and does not submit the form while the list is open), Escape closes and restores the selection without closing a dialog, Tab leaves and restores. Search clear restores focus. Filter state is ephemeral to the modal/setup form in this browser-local application and is not URL persisted. All regular labels use airportLabel/routeLabel; dense schedule/map marks use compact IATA with full accessible labels/title.
- RouteBuilder owns new-route and scenario-airport forms inside existing RouteOffice. Existing routes redirect to manage/open rather than duplicate. Quote shows distance, synthetic demand, virtual route fee, models within range and aircraft at the hub within range (not a guarantee of maintenance readiness). Range, base, downtime and collision guards remain at scheduling time. Coordinate entry reuses RangeControl with decimal precision and keyboard ± support.
- New careers have setupComplete=false; the app renders Onboarding before gameplay. Successful setup validates brand, grants exactly $500 million once, two different random medium-haul aircraft, and one hub/hangar level1. No routes or flights are opened automatically. Existing saved careers missing setupComplete migrate to true with default VANTIS identity, preserving balances and schedules. Restart is still an explicit app-owned confirmation and then reopens onboarding.
- Initial hub is included, while daily HQ/hangar costs remain chargeable. New purchases, used purchases, leases and pending deliveries default to the airline's owned starting hub; the delivery hub is retained in the order. Further hubs can be bought from AirportPicker; transfer and hangar behavior is shared with existing HQ actions.
- Theme and logo are local airline identity only: no external payment, account or logo-generation service. Primary color and company name update the main header, title and operational brand labels. GeoNetwork is a schematic connection view for global/custom networks, not a navigation chart. Legacy cinematic art remains on untouched legacy careers.

## Random founding flow (2026-10-20)
Three logo choices are sampled from16 concepts; six generated colors have white-text contrast at least4.5. Rerolls are free and unlimited. Founding grants $500 million exactly once and two distinct models from A223/A320/A321/B738/B38M. Airline initials prefix registrations101 onward; pending new orders reserve IDs and returned/sold aircraft IDs are never reused. Legacy registrations, balances, fleets and schedules remain compatible. Incident seeding reads the trailing registration number consistently across formats.

Persisted stages are fleet preparation, route selection and completed. Cabin edits use the existing sliders/diagram; amenities and paint use existing paid fleet actions. Suggestions contain two domestic slots and one international slot with compatible aircraft and actual forecast estimates. Countries lacking domestic candidates show an honest missing slot. Players may use the shared custom RouteBuilder instead. Route fees apply; finishing requires one opened route, and flight assignment remains explicit.

QA:52 domain tests passed. Browser verified rerolls, Aurora Air AA-101/102 and $500m grant, cabin edit, Wi-Fi purchase, decoration, reload persistence, compatible suggestions and route purchase. The mobile380px content has no horizontal overflow and completes into the operational dashboard. Evidence: design/founding-fleet.jpg and design/founding-routes.jpg. Physical touch and Safari were not tested.

## Scheduling route visibility (2026-10-20)
The add/edit flight route selector and ScheduleOffice route filter show only opened routes, preserving original route indices. Unopened routes remain in route discovery/purchase, never as disabled schedule choices. With no opened routes, show an explicit empty choice and disable flight submission. Automatic allocation already iterates openedRoutes only.

## Configuration preview ownership
ConfigurationPreview owns brand/paint samples and amenity illustrations; AirlineMark owns the existing Phosphor mark mapping. Onboarding draft values drive an inline sample. FleetStudio paint draft and selected amenity drive previews; only the existing paint/option actions commit or charge. Closing discards preview choices without changing installed equipment. Saved configurations and existing option effects remain unchanged.
Browser QA: changing paint to Aurora updates only the sample; choosing USB-C updates the illustration and exact $0.65/passenger margin while treasury stays unchanged. Mobile founding logo/color/name changes update the inline sample with no horizontal overflow at380px. Evidence: design/amenity-preview.jpg, design/brand-preview.jpg.26 founding/management tests passed; no live economic rules changed.

## Aircraft preview (2026-10-20)
Founding and paint previews now show selected identity on a shared generic aircraft canvas: tail emblem, airline name, registration, lower fuselage stripe and special patterns. The illustration is explicitly not manufacturer-specific. Draft/purchase behavior is unchanged. Browser QA verified mobile founding name/logo/color updates and desktop Tết paint preview; evidence: design/aircraft-paint-preview.jpg.

## Operations v2 contract
Booking and settlement must not let any round-trip finish above40 service hours. Future scheduling projects already-booked flights and resets hours only once after each booked service event. Unknown incidents are not predicted. Restoring a legacy schedule does not delete newly infeasible slots; forecast and close show the reason.

Reverse-direction routes share an unordered airport-pair market. Base demand/ideal fare come from the stable first catalog entry; published fares are averaged by class seat offer for the operating day. Capacity aggregates both orientations. Fuel-derived CO2 uses the explicit synthetic3160kg/t conversion even when no passengers board.

MaintenancePaid is a backward-compatible HQ expense accumulator, already cash-paid before closing; it contributes to day P&L exactly once and is added back in the P&L-to-cash bridge. First-flight guidance previews and applies the existing optimizer only on explicit action. Personal7-day goals require actual operated days, not idle-day clicks, and grant no money. Monetary opening terms and saved history are unchanged.

Validation:66 tests passed, including10 new service-limit/market/CO2/cash/map regressions. Browser verified unchanged legacy career cash on reload, local map framing, explicit planner preview→apply, day-close cash reconciliation, HQ goals and finance coverage. Mobile inspector has358px client/scroll width with no horizontal overflow. Evidence: design/operations-upgrade.jpg and design/cash-reconciliation.jpg. Physical touch, Safari and a complete screen-reader audit remain untested.

Economy replay: scripts/economy-check.mjs writes design/economy-upgrade-results.json;30 deterministic28-day scenarios across10 starting pairs and3 policies. Managed28-day economic profit now ranges$3.311m–$4.028m, averaging$3.712m after maintenance. The39h probe executes0 additional hours and cancels8 legs rather than reaching60h. Starting grant, aircraft prices, inventory and the8-aircraft limit are intentionally unchanged; this is a correctness/decision-feedback upgrade, not a claim of final commercial-economy balance.

## Livery catalog expansion
18 append-only themes,5 categories. Filtering selects the first matching theme when the current draft is outside the chosen category, without applying it. Preview palette and motifs come from the same catalog entry as name/price. Selecting a design never spends money; the existing paint action commits at the catalog price and is rejected if already installed. Old0–2 IDs and names remain valid. Browser verified Sakura/Ocean previews, category filtering and Ocean Flow persistence after purchase/reload. Evidence: design/livery-catalog.jpg.

## Weekly schedule repair (2026-10-20)
- AddForm: one/multiple weekday choices at a shared quarter-hour departure time, preview return weekday/time, weekly recurrence. Editing changes exactly one stored round.
- add-weekly validates unique integer weekdays0–6 and time0–23.75; all selected rounds commit or none do. Existing engine guards enforce collisions, range, route ownership, maintenance, lease and168h boundary. Each new round revalidates against the final batch. Stored numeric slots and schema1 remain compatible.
- ScheduleOffice: whole-airline/aircraft/open-route scopes share one weekly matrix and expandable detail list. Overnight continuation cards keep the same slot ID and direct edit path; warnings describe next-occurrence feasibility. An empty cell means no assigned round, not aircraft availability. No hardcoded airport timezone: this PoC uses one shared game clock.
- Inspector: intrinsic section heights, non-overlaying actions and scroll reset on page navigation. WeeklyGrid uses a fixed day scale with scrolling, preserving exact fractional segment height; tiny segments expose their route/time through accessible name/title.
- Verification:71 Node tests including four new batch/edit/atomicity/validation tests; desktop add Fri/Sun08:00 and edit Sunday09:30; phone380px document/form no horizontal overflow, matrix scroll contained. Existing save, inventory and route indices retained. Physical touch/Safari not tested.

## Weekly maintenance v3 (supersedes40h contracts above)
- maintenance.js is the shared owner of downtime windows, weekly deadline, suggestions and hangar collision checks. Five-hour recurring light checks are separate from prepaid24h major /48h emergency jobs. They reset wear and the operational-hours metric; only major/emergency jobs clear faults. Completion renews serviceDueAt by168h, independent of cumulative flying hours.
- MaintenanceOffice in FleetStudio owns create/read/update/remove. Native weekday, quarter-hour time and preference selectors preserve canonical styling. Suggestions are read-only; Save commits atomically, rejects flight/hangar overlap and does not move or delete any flight. No slot found gives an actionable error. Active recurring jobs cannot be edited or removed; show their completion time. Expired service grounds flights until a check completes.
- WeeklyGrid and ScheduleOffice use the same windows, including midnight and Sunday continuation. Route gaps and the existing flight allocator exclude reserved downtime. Company cells sort flights and maintenance chronologically. A major job suppresses overlapping light occurrences. Hub capacity is1+hangar level. A transfer removes the old recurring plan and flight schedule; due time remains.
- Existing SAVE_KEY/schema1, money, stored slots and legacy day-based jobs are retained. Missing service fields migrate once to seven-day grace from the saved current day, without fees or automatic job creation. Invalid new plan/deadline data is rejected. Daily settlement is still explicit; no real-time/offline service or revenue.
- Weekly fees are35% of repairCost and recorded only on start day. Forecast exposes maintenancePrepaid / maintenanceCash / maintenanceCost; only prepaid is added back in the cash bridge. Insufficient cash prevents the entire day settlement. Major jobs retain upfront expense recognition. Forecast and seven-day planning use shared completion state; current-day flights after a check keep their own wear/hours rather than being erased at day close.
- Verification:85 Node tests, including14 new migration/deadline/cross-week/fee/hangar/active-job/optimizer cases. Browser verified night-gap preview→save, split blocks on company schedule, actual fee on start day, and mobile380px form without horizontal overflow. Physical iOS/Safari not tested.

## Route catalog and weekly editing (2026-10-21)
Unopened legacy demo routes are retired from route lists, map discovery and Finder. Keep internal indices and owned/custom routes intact for schema1 saves. Buying a hub never grants preset routes. RouteBuilder can still explicitly purchase any valid airport pair.
Weekly edits default to one flight; the all-days scope matches the original aircraft, route and departure clock. Preserve each weekday and slot ID; do not create missing days or touch other departure times. Validate the full resulting schedule and reject the whole batch on any conflict, maintenance, range or week-boundary failure.
Airport labels use City · Airport (IATA) from the existing municipality snapshot, with Vietnamese labels for HAN/SGN/DAD; omit duplicate city/name and fall back to Airport (IATA) when city is missing. Keep compact IATA map/grid marks with full accessible labels. Search includes both municipality and localized label. Custom airports accept an optional city up to80 characters; old saves without city remain valid.

## PoC hardening v3 (2026-10-21)
The user approved all six review items: save recovery, cross-week flights, economic progression, heterogeneous demand, stronger optimization, and tab conflicts. Preserve the existing visual system, native dialogs/selects and save key/schema1.

save-store.js owns validated compare-and-write persistence, previous valid backup and exact damaged-byte archive. No autosave on mount or fallback-new-career overwrite. Explicit recovery restores a validated backup; without one, an explicit fresh-career action first archives damaged data. All mutations persist before React commits. withSaveLock serializes critical sections with Web Locks, or an IndexedDB read/write transaction for insecure previews where Web Locks is unavailable. Stale raw revisions and storage events stop an old tab; Reload latest is explicit. Do not use localStorage lease timers or silent last-writer-wins. Unsupported/denied storage blocks writes; no cloud-save guarantee.

week-time.js owns cyclic overlap and flight continuation segments; each departure stays in0–167.75 with duration<168. Sunday arrivals can extend into the next week. Restore, manual/bulk edits, allocator, Finder gaps, charts and company matrix share these rules. Continuation clicks edit the original slot. Actual departures persist airborneUntilAt so deleting a recurring slot cannot free an underway aircraft; maintenance, transfers, sale and early lease return must wait for landing. Whole-round revenue/resources are still recognized on departure day, with no duplicate revenue on continuation days.

Economy version2 is assigned only on new founding: retain the$500m grant and two free medium aircraft. Price future aircraft at12x the legacy catalog, hub acquisition at20x, hangar upgrades at12x, route fee$4m+$2,500/km; daily lease is0.025% of scaled price and5% deposit. Legacy careers migrate to version1 and retain balances, future legacy prices and stored lease terms. economy.js defines deterministic symmetric airport-pair profiles using airport size, domestic/international distance, synthetic business/leisure tags and stable variation; class mix and weekday pattern vary. These are game assumptions, never real traffic data. Preset/custom routes, forecast, fares and suggested routes use the same profile.

Planner retains manual schedules and compares three deterministic greedy strategies: capacity-first, small-first and late departures. Select the best projected seven-day operating profit; explicitly label the lack of a global-optimum guarantee. ScheduleOffice runs the shared planner in a module Worker, exposes pending/error states, terminates on close/state change and shows alternatives/incremental profit. Apply passes the exact preview with a full input basis; the transition rejects stale/tampered proposals and revalidates every addition atomically. No automatic application.

QA-only qa-save.html is a root Vite entry, not a production build input. It replaces only disposable preview-browser progress for corruption/cross-week tests. scripts/economy-v3-check.mjs records30 deterministic28-day scenarios in design/economy-v3-results.json; results are a baseline replay, not commercial balance validation.

V3 verification:105 Node tests passed. Browser covered funded founding/route purchase, Worker pending→three alternatives→apply, two-tab stale-write blocking/reload, corrupt-save backup recovery retaining Jet Review day3/$493,451,755, Sunday23:00→Monday04:45 segments and original-slot edit, plus380px dialog with334px client/scroll width. Synthetic30-scenario replay measured managed28-day cash gains$5.854m–$7.373m; no-maintenance$1.189m–$1.588m; idle loses$89.6k–$94.08k. Web Locks serialization is unit-tested; the insecure preview exercised the IndexedDB fallback. Real-device Safari/touch and commercial retention balance remain unverified.

## Night network and aircraft/cabin visuals v4 (2026-10-21)
The user rejected the flat global map, the simplistic editable aircraft illustration, and the tiny capsule-like cabin. Keep JETRISE navigation, operational economics and all existing save formats.
GeoNetwork now uses a cinematic navy night treatment with continuous land lighting, restrained real-airport light points, haloed endpoint labels, gold selected arcs and a moving canonical Phosphor aircraft. Natural Earth paths and frameNetwork remain the geographic source; only owned/selected route controls are interactive. Background lights are illustrative airport points, not owned routes, real-time operations or a population heatmap. Reduce-motion hides animated aircraft and stops beacons. Mobile keeps the370px scene row and a compact route readout so the inspector cannot overlap its footer; do not change the global app viewport.
AircraftPaintPreview uses public/assets/aircraft-premium-v1.png, a generated neutral transparent studio render. Existing airline name/logo/color/livery props still own alpha-masked tail and fuselage overlays. Preserve all18 paint IDs, no cost on preview, explicit commit only. The render is generic and explicitly labeled; never imply that it is the exact selected Airbus/Boeing geometry. Asset provenance and built-in generation prompt: design/visual-assets-v4.md.
CabinDiagram retains one existing sprite per actual seat, unchanged cabinLayout and counts. Add carpet, warm bulkheads, overhead bins, row numbers, rear lavatory details and soft seat shadows. Class cards select a close-up of the leading section, with an explicit caption about partial coverage and a return to whole-cabin view. Zoom remains available; empty classes get an explicit message. These are visual props, not new capacity deductions or certified manufacturer plans. Color or layout draft updates must never change saved configuration until Save.
QA:105 Node tests passed. Browser verified the new map, responsive370px scene with footer contained, Ocean Flow preview on the render, class close-up, and decrement146→145 producing exactly145 seat marks without committing the draft. Evidence: design/jetrise-night-map-v4.jpg, design/jetrise-aircraft-v4.jpg, design/jetrise-cabin-v4.jpg. No physical-device/Safari or screen-reader certification is claimed.

## Weekly aircraft utilization (2026-10-21)
Show scheduled aircraft utilization as a percentage, progress meter and assigned hours / 168 weekly calendar hours in FleetInspector, FleetStudio details, WeeklyGrid, ScheduleInspector and each ScheduleOffice aircraft row. Show the weighted whole-fleet aggregate in FleetInspector and ScheduleOffice. Reuse Engine.utilization; each scheduled round trip contributes its complete block duration including turnaround once, even across Sunday/Monday. Maintenance is excluded from assigned hours and is not subtracted from the 168-hour denominator. Current delivered owned and leased aircraft count; pending orders do not. Empty schedules show zero. This is planned calendar occupancy, not actual flown hours. Unassigned calendar hours are not guaranteed operational availability. Route filters do not change the aircraft's full-week utilization; the aggregate always covers the current entire fleet. Read-only derived UI; preserve save state and game economics.

## Hourly schedule grid (2026-10-21)
WeeklyGrid displays all25 time boundaries from00:00 to24:00 with24 one-hour cells per day. The800px chart reserves32px per hour below the32px day header; its existing scroller owns both axes, with keyboard focus and an accessible scroll hint. Day headers remain sticky while scrolling. Six-hour boundaries are stronger orientation lines only. Preserve exact quarter-hour departures, proportional flight/maintenance positions, cross-week continuation behavior, stored schedules and the surrounding panel geometry. No snapping or automatic schedule changes.

## Per-aircraft forecast operating margin (2026-10-21)
Show seven-day forward operating margin, revenue, flight cost and operating profit/loss in fleet cards, FleetStudio and the selected-aircraft schedule inspector. aircraft-economics.js reuses projectedWeekReports with the complete fleet, preserving shared demand, service deadlines, existing faults, wear and lease expiry. Sum each aircraft's rows before dividing profit by revenue; never average percentages. Zero revenue has no defined margin (em dash), while any flight loss still displays. Costs include flight nonfuel costs, fuel and CO2; explicitly exclude lease fees, maintenance and company overhead. These are conditional projections under the current planner model, not realized profit, net margin or return on aircraft capital. Current immutable game snapshots cache one fleet-wide calculation in AircraftProfitability; no new saved state or economic transitions.

## Strategic gameplay contract (2026-10-21)
Authoritative brief: user requested a complete gameplay list and sequential implementation of the previously proposed contracts, forecast market events, disruption recovery and campaign systems. GAMEPLAY-CHECKLIST.md is the maintained implementation inventory. Existing browser-local scope remains; no real payments, external contracts or online players are implied.

| Capability | Canonical owner | Behavior |
|---|---|---|
| New progression | gameplay.js / game.transition | Schema1 receives gameplay.version1 with counters starting at migration day; no retroactive rewards or asset reset. |
| Contracts | gameplay.js + engine.evaluate | Additional Y passenger groups occupy actual seats before public demand; only transported fares accrue. Up to3 active, seven-day fulfillment window,90% success, one deadline bonus/penalty. Preview ten days, explicit commit. |
| Market events | gameplay.js | Deterministic tourism/fuel/low-season windows. Unresearched future projections use midpoint; actual day uses event factor. Research costs$5k once. No real market feed. |
| Dated recovery | recovery.js / tycoon.exceptions | One override per slot/day in next7days. Swap, same-day delay,3-day premium replacement lease or cancel with$15/seat compensation. Absolute collisions and availability checked before commit. Weekly template retained; overrides expire after close. |
| Replacement lease | fleet.js lifecycle |3days,1% deposit,4x ordinary daily rent. First rent paid immediately and added back in cash bridge; daily expense once; expiry refund once. Fleet+orders cap8. |
| Campaign | gameplay.js / campaign-claim | Six sequential goals based on settled operating results; one explicit cash reward each, no operating revenue classification. |
| Feedback | GameplayOffice / Report | Native modal, shared Button/status, loading lock and preserved inline errors. Read-only comparisons are bound to exact game snapshot. Invalid actions leave game unchanged. Daily reports retain compact actual aircraft rollups, contract outcomes and event effects. |

New buttons use existing transition -> validated persistence -> React commit. Research and acceptance do not advance time. Optional dated overrides can be removed explicitly; paid lease remains active until returned. Existing schedule edits validate collisions against overrides. Known faults may still make an accepted future override infeasible; forecasts show cancellation and allow repair or removal, without blocking unrelated actions. New incidents are not predicted.

Contract/public demand share capacity, but public market pools never include contract passengers; this prevents double ticket revenue. The optimizer and pricing previews propagate contract progress between projected days, consume existing inventory and project market prices. Flight-row margins exclude terminal bonuses/penalties; whole-company daily P&L includes them. Research spends and campaign grants remain cash-ledger decisions, outside daily operating profit.

## Competitive strategy workflow
Source: AGENTS.md optional competition release, strategy.js domain rules and GAMEPLAY-CHECKLIST.md section12. StrategyOffice uses GameplayOffice's pending guard, inline error focus, canonical Button/RangeControl/native select and game.transition persistence. Activation presents a before/after forecast and explicit confirmation naming its persistent economic effect. Trial prices never write; Save invokes the existing fee and daily change limit. Mutations remain persist-before-React and stale-tab guarded. Forecast totals are labeled separately from actual history; AI is labeled simulated. The existing modal owns scrolling; route selection and slider drafts remain local ephemeral state. A completed challenge freezes its result and never deletes or resets the airline.

### New-route recommendations
- Show up to three affordable, fleet-compatible alternatives after the hub selector, with explicit empty/loading/retry states.
- Recompute in the existing planner worker when the game snapshot or hub changes; terminate stale work on cleanup.
- Selecting a destination focuses its quote and resets stale airport filters; purchase remains separate.
- Preserve full airport names and manual/custom airport access. Use one column on narrow screens and no new input primitives.

## Task workspace migration (2026-10-21, current)
Current request authorizes moving major management flows from dialogs to peer workspaces. This section supersedes earlier layout-only descriptions, while current domain/persistence rules above remain unchanged.

| Capability | Canonical owner | Behavior |
|---|---|---|
| Primary destinations | App / WORKSPACE_DEFAULTS | Headquarters overview, Fleet, Network map, Aircraft schedule, Strategy. Five peer destinations with aria-current; mobile bottom navigation. |
| Deep action destinations | workspaceDestination | Existing hq/routes/planner/gameplay/fleet-studio/market callers resolve to the owning workspace and requested section/aircraft. Founding keeps its existing dialogs. |
| Working context | App sections/visited | Previously visited primary workspaces remain mounted but hidden/inert to accessibility. Local draft/search state survives primary navigation during this session; refresh reloads canonical saved career and starts at overview. No new persistence or routing library. |
| Subarea controls | Existing management-tabs/native buttons | Optional controlled section props extend existing offices. Preserve their existing explicit local save and tab-switch behavior. |
| Scroll | Document + bounded charts | Natural document scrolling for workspaces and forms; chart/table owns horizontal overflow. Fixed mobile navigation has reserved bottom/safe-area space. |
| Transactions | Existing Modal / act | Cabin, fares, schedule add/edit, destructive confirmation and reports remain named native dialogs. Existing persist-before-React, mutationPending and stale-tab guards are unchanged. |
| Daily check | DayBrief / operationsOutlook | Read-only forecast, known cancellations, cash requirement and cash-after close. Confirmation invokes existing advance exactly once through act; cancellation leaves state unchanged. |
| Keyboard | App / Modal | Primary navigation focuses page heading, selected destination is marked, skip link reaches main, dialogs restore connected opener or active nav. |

Headquarters now begins with real-time operating priorities and forecast numbers, with actual history shown separately. Fleet cards expose registration, model, hub, availability, wear, utilization and forecast margin. Network keeps its map and canonical route creation/recommendations. Schedule offers the full hourly aircraft chart or full-airline matrix/optimizer. Strategy retains competition, contracts, market, recovery, campaign and journal. The first-run founder flow preserves all grants and previews and now exposes the same three-stage vocabulary from its first screen.

## Cabin, amenities and destination selection v5
Sources: current user seat-plan reference and explicit amenity/default-destination feedback; AGENTS.md cabin/amenities v5; amenities.js and game.transition.
- CabinDiagram/cabin-layout.js remain the canonical visualization; the model prop selects aisle/block geometry at every call site. All seats remain in the document, even outside the scroll viewport. Class shortcuts scroll; slider drafts never persist until Save. Empty sections expose explanatory status, and zero total seats cannot save.
- AmenityOffice reuses Button, native selects, the existing inline status and persist-before-React option action. Catalog/filter/preview are ephemeral and free; committing changes only the selected aircraft and wallet. No remove/refund action is claimed. Pending installation is guarded locally as well as at the canonical transaction boundary. Existing installed IDs remain valid.
- The amenities catalog is finite 16 items; render matching items, count, installed markers and a no-results instruction. Preview economics separate upfront investment, per-passenger income/cost and a conditional seven-day company flight-profit delta. It uses the complete fleet forecast, accounting for competing aircraft, existing downtime and current schedules; no flight means no passenger fees. The equipment comfort score has a 100 point cap and only affects allocation in optional competitive mode.
- AirportPicker accepts an allowEmpty route-destination variant and excluded origins. Changing country retains a compatible explicit destination or clears it, never silently chooses one. New RouteBuilder instances start empty; choosing a recommendation still focuses the real quote and leaves purchase explicit. Existing founding/HQ flows retain their canonical default behavior.


## Strategic gameplay v8 (2026-10-22; current scope)
User explicitly requests playable mechanics in the PoC, not only a Codex backlog. Preserve opt-in reserve aircraft, paid family support, same-day connecting tickets, hourly hub slot contracts and bounded AI leasing. `handoff/CURRENT_STATE.md` defines the delivered boundaries; earlier statements that connections or AI fleet growth are entirely unavailable are superseded. Overnight ticket reservations, compensation and independent AI network growth remain future work.

`network-economy.js` allocates residual Y seats after direct/contract demand; one through fare is apportioned across two legs, and passenger totals count boardings. Both source cycles must finish in the day, direct purchased ODs are excluded, fare-sensitive directed demand is capped at40 and detour at1.8. Explicit program fees must flow into forecast, cash bridge, per-plane contribution and reporting without duplication.

`airport-slots.js` counts both movements and week wrap. Opt-in uniform hourly capacity is a synthetic hub challenge with disclosed signing/daily costs and seven-day commitment, not a shared global slot market. Manual/automatic/recovery edits must fail atomically before charging when overbooked. AI leases are limited to two per rival, serve its current route, and spend/refund only rival cash. Never label bots as online players.

UI reuses Button, RangeControl, native selectors, existing cards/tables and strategy navigation. Paid actions disclose prices, current vs draft state and commitment; forecasts do not save. Timing/slot studies remain explicitly read-only and distinct from live controls. Preserve current saves, identity, route indices, registrations and the coral/ivory/navy visual language.

## Automatic schedule maintenance readiness (2026-10-23)
User request: fix the production-stabilization planner/maintenance P2 without changing existing schedules or legacy saves. `planner.js` previews both appended flights and any new five-hour recurring checks; `maintenance.js` remains the owner of weekly overlap, deadlines and hangar capacity. Existing service plans stay unchanged. An aircraft with no legal timely gap receives no added flights and a visible reason. ScheduleOffice shows start/end, recurrence, per-check fee and seven-day before/after fees before explicit combined apply. `game.transition(optimize)` revalidates and commits the whole fleet/schedule change atomically through existing persistence; preview never writes or charges, and recurring fees remain payable on check start. Old previews must be recalculated; old save bytes/schema/key are unchanged.

## Shared slot acquisition (2026-10-25)
`slot-market.js` owns the live acquisition ceiling; `slotMarketRows.purchaseLimit` feeds SlotMarketOffice's existing RangeControl. New acquisitions cannot raise per-hour ownership above one. Higher existing ownership remains valid, charged at existing terms and releasable under existing commitment/flight guards. First activation preserves the full committed schedule. No stored schema or save key changes. Expanded AI ranks affordable legal clocks by signing plus seven days' upkeep, using the same implementation in forecasts and settlement. Known idle-right spreading behavior remains accepted for this release; no silent reclaim occurs.

## Conditional slot trial
- Existing shared-slot careers stay on their current contract until a separate consent checkbox and explicit backup-and-enable action succeed through the canonical save store.
- The new section discloses no signing refund, return triggers, grandfathered rights and the current production reader incompatibility before enabling. New purchases may be planned before the next close; read-only forecast may preview their return.
- The active section opens the existing Save Manager, where recovery replaces the whole career and archives current progress. Do not imply that post-opt-in progress can be merged into pre-opt-in terms.
- Keep recurring scheduled needs and dated pending/committed legs protected. A failed scheduling action must preserve all rights and raw save bytes.

## Actual-use slot trial
- Enroll only rights purchased after a second explicit opt-in; existing permanent and schedule-only conditional rights retain their terms.
- Disclose fourteen idle closed days, physical receipt qualification, protected committed legs, nonrefundable signing, retained but canceled missing-right templates and seven-day return/rebuy rules before activation.
- Show a selected right's last-use/review or expiry/reacquisition day; forecasts never commit a return.
- Write and verify the pre-utilization backup before replacing the main save. Whole-career restore returns to the previous local contract. Production requires the earlier pre-conditional backup.

## Actual-results explanation (2026-10-31)
`profit-review.js` derives equal contiguous 1/7-day comparisons from immutable tycoon.history only. `ProfitReview` is owned by Headquarters Finance and linked from the overview's latest results. Native select and details/summary own period/disclosure interaction; shared Button opens canonical schedule, recovery and maintenance destinations. No forecast, current timetable reconstruction, migration, mutation or persistence occurs. Missing optional historical breakdowns remain explicitly unknown; aircraft and route comparisons include removed historical IDs. Routes require stored legEvents; older reports without them cannot receive invented route attribution. Profit and close-day cash bridges expose residuals and distinguish management cash flows outside settlement.

## Operational alerts (2026-10-31)
`operation-alerts.js` derives maintenance/deadline reminders, shared/legacy slot deficits, sold pending-journey refund risks and upcoming lease expiry from current commitments and canonical projectedWeekReports. `OperationAlerts` is the single bell/overview/day-brief destination. Forecast failure is visible and cannot yield an all-clear claim. Historical missed-connection outcomes are informational, linking to the original report, rather than unresolved urgent tasks. Weekly maintenance on time and active heavy repairs do not become overdue reminders. Native category select is ephemeral; actions open existing aircraft maintenance/details, network-study slot controls or recovery workspaces. No automatic fixes, financial charges, schedule edits, persistence, opt-ins, migration or production deployment.

## Decision comparison (2026-10-31)
`decision-comparison.js` executes only bounded fare/frequency/lease/route specs through canonical transitions on cloned careers, including a seven-day conditional replay. `DecisionOffice` uses the existing planner Worker and terminates stale work. Every option is independent against the same exact serialized game snapshot; no comparison persists. Incomplete replay periods have no comparable deltas and cannot be applied from this flow. The `decision-apply` transition rebuilds and replays the selected option, rejects changed basis or proposal fields, then returns only the immediate canonical action state for one existing save-store commit. Frequency preserves retained IDs and other clock groups; failed multi-action preparation cannot spend money or return rights in the real career. New leases include an explicit weekly check; new routes include explicit weekly flights. Seven-day cash includes immediate fees/deposits, while operating profit excludes acquisition cash; lease obligations beyond the horizon and deferred revenue remain disclosed. No save schema/key, automatic opt-in or economic parameter change.

## Weekly recap and coaching goals (2026-10-31)
`weekly-review.js` owns fixed game weeks, strict day coverage, summed actual denominators and optional coaching metadata. `WeeklyOffice` reuses Headquarters navigation, native selects, report-ledger and existing operational destinations. History is authoritative; duplicate/missing days, missing optional fields, mixed leg/round recognition and the 28-day retention boundary remain visible. Goals are measured only from actual reports and certified only after a complete seven-day week. Margin10%, executed14/95%, and completed connections20/profit-positive are synthetic coaching thresholds without reward/buff or pricing/positioning/customer-program effects. Saving/switching/clearing one optional gameplay.weeklyGoal uses an exact basis and canonical transition/save-store, never changes past reports, cash, schedules or economic parameters. Old saves receive no field until explicit selection. Only the current game week can be selected; choosing midweek includes that week's already-closed days. One goal is tracked at a time; old results are derived while their source reports remain in the bounded 28-day history, not stored as permanent achievements.

## Redesign v2 (2026-11-04, current)
Supersedes the 2026-10-21 rail layout and the coral primary action. Primary destinations, deep destinations, DayBrief, dialogs, native selects and persistence rules above are unchanged.

| Capability | Canonical owner | Behavior |
|---|---|---|
| Primary navigation | App top bar `.workspace-nav` | Same five destinations and aria-current; wraps below 1240px; bottom navigation at 760px. |
| Daily check | App top bar run-day Button | Opens existing DayBrief; disabled while busy. Page headings no longer own it. |
| Save status | App `.top-save` role=status | Healthy status visually hidden but announced; failure shown as visible warning strip. |
| Primary action colour | styles.css `--cta` | Independent of airline colour; airline colour only marks identity and selection. |
| Airport selection | AirportPicker | One combobox (city/airport/IATA/country) with popup listbox. |
| First-run guidance | CommandOverview checklist | Derived from game state; one next action; no persistence; hidden after the first settled day. |
| Schedule default | WORKSPACE_DEFAULTS.schedule='company' | Whole-fleet matrix first; hourly per-aircraft chart remains available. |
