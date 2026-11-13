# Operational alert center

Status: verified release candidate. Publication evidence is recorded in RELEASE_OPERATION_ALERTS_2026-10-31.md.

## Contract

The bell, Headquarters overview and pre-close DayBrief open the same OperationAlerts component. It derives reminders from current aircraft/service commitments, canonical slotRequirements/slotUsage and seven-day projectedWeekReports. Filters are ephemeral. Actions open existing per-aircraft maintenance/details, network-study slot controls, recovery or the original historical report. There are no automatic repairs, schedule edits, purchases, refunds, new opt-ins or save fields.

Maintenance reminders use a 72-hour due window and distinguish timely planned checks from active heavy service. Lease reminders cover seven days and use paidDay + term, including cross-boundary planned rounds. Shared-slot deficits preserve grandfathered/new-right ownership and show airport/week-hour needs; opt-out careers receive no hypothetical uniform-capacity warnings. Connection risk applies only to currently sold pending journeys projected to receive refunds. Already-settled missed-connection counts remain informational; hypothetical future ticket sales are not called existing passenger obligations. This does not forecast unknown future incidents or guarantee connection safety. Forecast exceptions are visible and cannot be presented as an all-clear.

## Verification

- Five focused domain tests pass: legacy maintenance/grace and service status, canonical pending-journey refunds versus resolved outcomes, real lease expiry/return, actual new-right reclamation with untouched old rights/save bytes, and forecast failure without mutation.
- `npm run test:pages`: 395/395 passed.
- `npm run build:pages` and `npm run verify:pages`: passed. Existing bundle-size warning remains; QA entry is excluded from production artifacts. Sites packaging was not requested or changed.
- Browser: all four groups, empty group, no-alert state, forecast failure, recovery destination, native category popup/keyboard, bell and overview integration in the compiled artifact app.
- At 380px, document width equals viewport width; no horizontal overflow. Responsive override was cleared after verification.
- An existing disposable all-JET career on the local artifact origin retained exact raw bytes after opening the new modal/filter and exporting via Save Manager. No production browser/save was touched.
- Eleven engine, maintenance, economic, persistence and dependency files are byte-identical to production source 67cc9fe; contract-verification.json records hashes.
- Strict UI audit reports eight pre-existing actionless-button findings in older QA wrappers, none in changed/new files. An earlier Vite HMR edit produced a standalone QA createRoot warning; compiled artifact app console has no captured errors.

Evidence: design/operation-alerts-20261031/ (focused-tests.log, tests.log, build.log, artifact.log, ui-audit.json, contract-verification.json, save-verification.json, browser-verification.json, screenshots and synthetic QA cases).

Preview: http://127.0.0.1:5233/qa-operation-alerts.html (storage-free simulated cases).
Game: http://127.0.0.1:5233/ → bell / Headquarters overview → View alerts.
