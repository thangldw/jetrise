# Vietnamese, English and Japanese interface

JETRISE now exposes VI / EN / JA in founding, recovery and the game header. Switching language updates the current view without resetting form input, navigation, dialogs or an unapplied planner proposal. The `jetrise.language` preference is separate from career storage. A valid saved preference wins over the browser language; unsupported browser languages fall back to Vietnamese. Blocked preference storage does not prevent switching in the current session.

## Presentation contract

- `src/i18n.jsx` supplies the React context, selector and locale-aware presentation helpers. No new package dependency is required.
- `src/locales.js` combines the EN/JA source-message catalogs. Explicit parameters preserve quantities and allow word order to vary. The six language tests check preference behavior, career-key isolation, blocked storage, parameter parity, data preservation and canonical message matching.
- Engine messages remain in their canonical form in worker responses and saves. `src/language.js` translates their known templates only at presentation time. Unknown messages remain visible in their source language rather than disappearing.
- Airline names, user input, aircraft identifiers and airport/route names are data. They are not translated. Shared Button and Modal wrappers do not translate already-localized children again.
- Select controls retain canonical option values; translated text never becomes an action identifier. Weekday/time presentation uses the existing game clock, without changing time-zone or economic rules.
- Existing engine modules, save code, schema, keys, opt-ins, worker code and package manifests are unchanged.

## Verification

Required Pages checks remain `npm run build:pages`, `npm run verify:pages` and `npm run test:pages`. The canonical long-run replay/report interfaces remain unchanged.

Local review covered 160 EN/JA server renders across fresh and progressed full-feature careers and a legacy career, checking for crashes, untranslated interface text and state mutation. Proper airport/city names remain untranslated. Browser verification used a synthetic local career at desktop and 390px mobile widths: validation errors, founding, route selection, livery filters, keyboard focus return, language persistence, and a real planner Worker proposal. Production player careers were not used for QA.

The browser bundle includes both translated catalogs. Vite's existing large-chunk warning remains; translations have not received an external native-speaker review. Publishing still uses compiled Pages artifacts only, with no source maps or private source files.
