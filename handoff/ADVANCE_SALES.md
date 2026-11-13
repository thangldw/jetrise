# JET-209 — advance direct sales

Status: implemented on `feature/advance-sales` (not released). Owner decisions (2026-11-04): 6-day horizon with 40% cumulative cap; full refund shown before confirmation for player-caused changes; no early-booking discount. Closes the open JET-201/202 item "sales before the first departure day".

## Player promise
Tickets for a scheduled direct flight go on sale before its departure day. The player sees cash arrive earlier, seats fill over several days, and fares locked at the moment of sale. Changing the schedule after sales have started has a visible refund cost instead of being free.

## Activation and persistence
- Separate explicit opt-in in Strategy → Sổ theo chặng, requiring active JET-201 (`legEconomy`). Legacy and new careers stay opt-out.
- Adds only `legEconomy.advance` v1: `{version, migrationId, enabledDay, horizon, stopped, basis[], bookings[], liabilityCents}`. A booking is one dated occurrence of a weekly template (`day:slot`) holding fare-locked lots `{soldDay, passengers[3], fares[3]}`. Root schema1, SAVE_KEY, economy versions, route indices and registrations are unchanged.
- Immutable pre-activation backup at `SAVE_KEY + ':advance:' + migrationId`, written and read-verified by `save-store.persistGame` before the main save, exactly like JET-201/202. Download and whole-career rollback use the existing archive-then-restore path.
- Activation is free and does not sell anything retroactively; the first advance sales happen at the next day close.

## Demand ownership (no new demand)
- Basis: the actual public passengers (excluding contract and connecting seats) of the most recent operated flight on the same route at the nearest departure hour (exact hour first; schedules from the optimizer vary hours by weekday), stored in `basis[]`. Flights without a basis are not sold until one operates. No second demand model is introduced. (A first version used the chained canonical projection; it made each forecast ~6× slower in a full career, so it was replaced. Measured: 806 ms → 870 ms per forecast in the stage-206 long-run fixture.)
- Booking curve: for a round departing on day D, at the close of day D−k the cumulative target is `curve(k)` × basis per class, capped by bookable seats (cabin × 2 minus reserved contract/connecting Y). Proposed curve for horizon 6: k=6..1 → 4%, 5%, 6%, 7%, 8%, 10%.
- On the departure day the existing allocation runs unchanged on demand **minus** passengers already sold in advance, against capacity **minus** advance-held seats. Contracts keep priority over new sales; held contract seats are never sold in advance.
- If actual departure-day demand turns out lower than what was sold in advance, those tickets still fly. This is the only way passengers can exceed the day-of result. It is bounded by the 40% cap and disclosed in the UI as forecast error, not a demand bonus.
- AI competition: the day's advance passengers are removed from the shared market potential and their seats from the booked offer's capacity before rivals and the player compete for the remaining demand; the reported market potential is therefore net of advance passengers.

## Money and events (integer cents)
- At sale: collect the ticket cash, record a deferred liability per dated leg, lock the fare per class. No cost is prepaid at sale; operating costs keep JET-201 timing (prepaid at round departure).
- At the round's departure day: advance passengers are merged into the dated leg manifests with their locked fares. Their ticket cents move from the advance liability into the normal per-leg deferred balance; recognition stays at arrival, once.
- Cash bridge gains `advanceSalesDelta` and `advanceRefunds`; reports separate tickets sold, cash received, revenue recognized and boardings.
- Validation: every booking references an existing template slot, a future departure ≤ horizon, capacity within model limits and integer cents. Strict reconciliation: advance liability = sum of unflown advance bookings.

## Changes, cancellation and refunds
- Price changes apply only to new sales. Sold fares are immutable.
- Removing or editing a template, shrinking a cabin, selling or transferring the aircraft, or a recovery move that invalidates a sold booking must show the refund amount first. Confirmation refunds the full ticket cash in the same atomic transition; cancellation leaves state unchanged. This reuses the JET-202 `guardJourneyChanges` / explicit-refund pattern.
- A round that unexpectedly fails to operate (fault, wear, disruption cancel) refunds its advance bookings once at settlement. A player action that makes a sold round unoperable (including a newly planned maintenance window, lease end or aircraft removal) goes through the refund confirmation instead.
- The 40% cap is bounded by the dated flight's own bookable seats, not by the basis flight, so a smaller aircraft on the same route never sells above 40% of its seats.
- Reported unearned ticket balance (`report.deferredRevenue`, decision comparison) includes the advance liability; the per-leg `deferredCents` and the advance book still reconcile separately.
- Customer fare-value ratings (JET-205) use each passenger's locked fare, so a later price change does not re-rate advance passengers.
- "Stop advance sales" keeps existing bookings and stops new ones.

## UI
- Strategy → Sổ theo chặng: opt-in card with before/after forecast (earlier cash, unchanged 7-day recognized profit), horizon setting (1–7 days), stop-sales toggle, backup download and rollback.
- Schedule matrix and route inspector show `sold in advance / capacity` per dated round.
- Day brief shows advance cash collected today and the outstanding advance liability.

## Verification plan
- Unit tests: activation/backup/rollback failure modes; booking curve and 40% cap; contract priority; departure-day merge without double counting; price change after sale; refund on template delete, cabin shrink, aircraft sale and failed operation; Sunday/Monday and midnight boundaries; corrupted-save rejection.
- Add `advance-v1` to the JET-208 long-run matrix (90/180 days) with independent cent reconciliation.
- Browser QA via the existing in-memory QA page; never production storage.

## Implementation map
- `src/advance-sales.js`: enable/stop/resume, validation, departure-day merge (`applyAdvanceSales`), per-leg split (`splitAdvance`), day-close sales (`sellAdvanceSales`) and the refund guard.
- `src/engine.js`: deducts today's advance passengers from the market pool and caps the booked slot's day-of sales at capacity minus held seats (`advanceReservations`); merges after competition and before same-day connections and JET-201 snapshots; sells after all other settlement. `src/strategy.js` applies the same reservation to competition offers and market potential.
- `src/live-leg-economy.js`: legs carry `advance {passengers, cents}`; ticket cents and validation include locked fares; departure cash excludes already-collected advance cents.
- `src/game.js`: actions, guard after every non-advance transition (error carries `advanceRefund`), restore validation, `dayCashRequired` includes refunds.
- `src/save-store.js`: `advance-sales` migration backup, read/rollback, Save Manager references.
- UI: Strategy → Sổ theo chặng card; global refund confirmation dialog in App; DayBrief line.
- Verification: `tests/advance-sales.test.mjs`; long-run scenario `advance-v1` (90 days) with the audit extended to the advance liability.

## Known limits
- Basis lags price changes: a fare increase after the basis day can oversell up to the 40% cap; those passengers still fly (bounded forecast error, disclosed in UI).
- Contract growth after sale can bump advance seats; bumped tickets are refunded once at departure (`advanceBumped`).
- Recovery/disrupted (`timing`) occurrences are not sold in advance.
