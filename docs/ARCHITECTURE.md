# Architecture

JETRISE is a static single-page application built with React 19 and Vite. It has no server component: the simulation, forecasts and persistence all run in the browser.

## Layout

| Path | Contents |
| --- | --- |
| `index.html`, `src/main.jsx` | Entry point; mounts `App` inside the i18n provider |
| `src/*.jsx` | React components: the app shell, the five workspaces and their panels and dialogs |
| `src/*.js` | Game rules as plain JavaScript modules with no React or DOM dependency |
| `src/data/` | Airport catalog, localized airport names and the world outline |
| `src/styles.css` | All styling; one stylesheet with CSS custom properties |
| `public/assets/` | Static images used by the map and aircraft previews |
| `tests/` | Node test-runner suites and save fixtures |
| `scripts/` | Release validation and long-run simulation tools |

## State model

The whole career is one plain JSON-serialisable object. `src/game.js` owns it:

- `createGame()` builds a new career and `restoreGame(raw)` validates and loads a saved one.
- `transition(state, action)` is the single way state changes. It returns either a new state or an error message and never partially applies an action.
- `forecast(state)` evaluates a day without changing anything. Forecasts and actual settlement share the same rules, so a preview and its result cannot diverge by construction.

`App.jsx` holds the current state in React, sends every player action through `transition`, and writes the result to storage before updating the screen.

## Rule modules

| Area | Modules |
| --- | --- |
| Core state and daily settlement | `game.js`, `engine.js`, `economy.js`, `week-time.js` |
| Fleet, cabins, amenities, liveries | `fleet.js`, `fleet-policy.js`, `cabin-layout.js`, `amenities.js`, `liveries.js`, `registration.js`, `aircraft-economics.js` |
| Airports, routes and demand | `network.js`, `network-economy.js`, `airport-search.js`, `airport-display.js`, `route-recommendations.js`, `founding.js` |
| Scheduling and maintenance | `planner.js`, `maintenance.js`, `operations.js`, `dated-legs.js` |
| Headquarters and finance | `hq.js`, `loans.js`, `profit-review.js`, `weekly-review.js`, `decision-comparison.js`, `operation-alerts.js` |
| Strategy systems | `strategy.js`, `rival-terms.js`, `rival-network.js`, `gameplay.js`, `opportunities.js`, `positioning.js`, `research.js`, `customer-strategy.js` |
| Per-leg accounting and connections | `leg-ledger.js`, `leg-settlement.js`, `live-leg-economy.js`, `connection-core.js`, `overnight-connections.js`, `advance-sales.js` |
| Slots and disruption | `airport-slots.js`, `slot-market.js`, `disruption-recovery.js`, `recovery.js` |
| Persistence | `save-store.js` |
| Language | `language.js`, `locales.js`, `i18n.jsx` |

## Background work

Expensive calculations run in `src/planner-worker.js`, a module Web Worker: schedule proposals, route recommendations, decision comparison, customer-strategy comparison and the per-leg study. The worker receives a copy of the state and returns a result; it never writes to storage.

## Saves

Saves live in `localStorage` under keys derived from `SAVE_KEY` in `src/game.js`.

| Key | Purpose |
| --- | --- |
| `SAVE_KEY` | The current career |
| `SAVE_KEY:backup` | The previous valid save |
| `SAVE_KEY:damaged` | A save that failed validation, kept for recovery |
| `SAVE_KEY:archive:*` | Careers archived on restart or import |
| `SAVE_KEY:<system>:<id>` | Backup taken when an optional system was activated, used for rollback |
| `jetrise.language` | Interface language; independent of the career |

`src/save-store.js` is the only module that writes saves. It verifies each write by reading it back, takes a cross-tab lock, and refuses to write if another tab has changed the save since this tab loaded it. A failed write never replaces the current career.

Exported save files bundle the current save, the previous save and the reachable activation backups. Import shows a read-only preview and requires confirmation.

### Compatibility rules

Players' careers exist only in their browsers, so these must hold for every change:

- Do not change the value of `SAVE_KEY` or the root `schema: 1` marker.
- New state must be optional fields that old saves load without. Never rewrite or reinterpret existing fields.
- Do not renumber route indices or change aircraft registrations.
- Systems that change accounting must stay opt-in and keep their activation backup and rollback.
- `tests/fixtures/saves/pre-jet-schema1.json` is a frozen old-format save. It must keep loading; do not regenerate it.

## Localization

Vietnamese is the source language of the interface and of engine messages. `src/locales.js` holds the English and Japanese catalogs, and `src/language.js` translates known messages at display time. Saved data and worker responses keep the canonical form, so a save is identical regardless of the language it was played in. Airline names, registrations and other player input are never translated.

## Data

`src/data/airports.js` contains 4,008 airports with scheduled service, derived from OurAirports; `src/data/airports-source.json` records the source file, retrieval date and filter. Localized airport and city names are a separate presentation layer documented in [airport-display-names/](airport-display-names/). Game demand, fees and aircraft performance are synthetic.
