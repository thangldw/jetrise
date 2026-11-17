# Roadmap: engine features not built yet

These three features change game rules, so each needs its own design, a save-format decision and long-run validation. They are written down here so they can be scoped one at a time.

## Constraints that apply to all of them

- State changes only through `transition()`; `forecast()` and settlement must share the rule so previews never diverge.
- Any new persisted field needs a `restoreGame` validator and a migration for existing saves.
- Optional layers are off in a new career and activate with a before/after forecast and a rollback backup, like the existing strategy systems.
- Settlement must stay deterministic. Pseudo-randomness has to be derived from the day and stable ids, never `Math.random`.
- Each feature needs unit tests plus a `test:long-run` comparison against the current baseline.

## 1. Weather per airport (demand effect shipped)

Fog and storms now scale route demand deterministically from a hash of airport and day (`weatherKind` in `src/gameplay.js`), with a three-day outlook in Strategy › Market. Still open: delays or cancellations driven by weather through the disruption-recovery flow, and research that reveals weather further ahead.

## 2. Slot auctions

- Today slot rights are bought at a fixed price per weekday and hour. An auction adds bids against the two rivals for the same hour.
- Needs rival bidding behaviour per difficulty level, a settlement step before the day runs, and refunds when outbid.
- Open questions: auction cadence, reserve price, and what happens to existing held rights.

## 3. More rival hubs

- Rivals currently compete only from the player's first hub. Rival network growth already leases aircraft and opens routes within fixed limits.
- Adding hubs means rival route eligibility, demand sharing and slot allocation must work for hubs the player does not use.
- Open questions: when a rival opens a second hub, how it picks it, and whether rival connecting itineraries are included.
