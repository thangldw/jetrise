# Roadmap

The three engine features scoped here are now built. Each changed game rules, so each shipped as an opt-in layer with its own save-format decision, activation backup and tests. What remains is listed under each feature.

## Constraints that apply to all of them

- State changes only through `transition()`; `forecast()` and settlement must share the rule so previews never diverge.
- Any new persisted field needs a `restoreGame` validator and a migration for existing saves.
- Optional layers are off in a new career and activate with a before/after forecast and a rollback backup, like the existing strategy systems.
- Settlement must stay deterministic. Pseudo-randomness has to be derived from the day and stable ids, never `Math.random`.
- Each feature needs unit tests plus a `test:long-run` comparison against the current baseline.

## 1. Weather per airport (shipped)

- Fog and storms scale route demand deterministically from a hash of airport and day (`weatherKind` in `src/gameplay.js`).
- The outlook is three days, extended to 4, 5 and 7 days by the forecasting research branch (`weatherDesk`, `weatherModels`, `weatherRadar`). Research is information only; no save change.
- In Disruption recovery each leg touching bad weather is flagged and suggests a delay (`weatherDelayHint`: 1 h fog, 3 h storm). The player still chooses and confirms the recovery, so settlement stays deterministic and previews cannot diverge.
- Open: weather that delays or cancels flights without the player starting a scenario. That would change settlement and needs its own save-format decision.

## 2. Slot auctions (shipped, opt-in)

- `slotMarket.auction` (`src/slot-auction.js`). Enabling is free and takes a rollback backup. Existing rights are grandfathered; only new acquisitions go through bids.
- Cadence: every seven days from activation, in a settlement step that runs before the day is simulated. `forecast()` applies the same step to a copy.
- Bids are escrowed at once, in steps of $50 between the $500 reserve and $5,000. A winner pays the clearing price (the reserve or the highest rival bid) and the excess is refunded; a loser is refunded in full.
- Rival bidding is a deterministic model keyed on rival, hour and closing day, scaled by AI difficulty. Rivals bid only where they operate. A rival bid never changes rival cash or rights, so rival reconciliation is untouched; being outbid just means the player does not get the right.
- Open: rivals actually taking the rights they win, which would tie auction results to rival cash.

## 3. More rival hubs (shipped, opt-in)

- `strategy.expansion.hubs` and `network.hubs` per rival. Enabling is free and takes a rollback backup.
- Eligibility: 14 days after enabling, a rival with enough cash (fee $250,000 plus its reserve and a $500,000 buffer) opens one second hub at a review. It picks the shortlist destination whose three best outbound routes yield the most, and the two rivals never share a hub.
- From the new hub the rival considers up to six more routes under the existing seven-day simulation. Demand is shared in the same finite markets.
- Slots: rights are required only at the three JET-204 airports, so a hub outside them needs none and a hub inside them competes for the same capacity.
- Rival connecting itineraries are not included; rival traffic stays point-to-point.
- Open: more than one extra hub per rival, and rival connections.
