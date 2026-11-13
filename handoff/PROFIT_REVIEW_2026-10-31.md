# Actual-results profit review

Status: verified release candidate. Publication evidence is recorded in RELEASE_2026-10-31.md.

Headquarters → Finance now explains actual profit changes over one complete day or seven complete consecutive days versus the preceding equal period. The overview's latest-results shortcut opens Finance. The report separates revenue, nonfuel costs, fuel/CO2 costs and available expense details, highlights the largest accounting drivers and ranks historical aircraft/routes by absolute contribution change. It includes removed historical IDs, never reconstructs results from current schedules, and exposes missing periods/fields explicitly.

Daily profit-to-close-cash bridges show residuals rather than forcing reconciliation. Management transactions between settlements are excluded and disclosed. Route ranking requires stored legEvents; aircraft ranking requires stored aircraft rollups. No causal decomposition of price, demand, competition or hypothetical canceled-flight revenue is claimed. Navigation uses the canonical planner, recovery and maintenance destinations.

No changes to game transition, forecast, save-store, SAVE_KEY, schema1, balances, rights or schedules. No migrations, new persistence, backend, dependencies or production changes.

## Verification

- `node --test tests/profit-review.test.mjs`: 3/3 passed, including 14 canonical settlements each for legacy and all-JET careers, exact accounting bridge tolerances, missing/duplicate/gapped history, incomplete fields, residual detection, and removed aircraft/routes.
- `npm run build:pages`: passed; existing large-bundle warning remains.
- `npm run verify:pages`: passed; QA fixture is excluded from production artifacts.
- `npm run test:pages`: 390/390 passed.
- Browser: daily and weekly results, expense disclosure, integrated Headquarters Finance, native popup/keyboard selection, legacy missing-route detail, empty history and 380px document width=viewport width. Fresh-load console errors: none. All QA uses synthetic in-memory careers and never reads/writes localStorage.
- Strict UI audit: eight pre-existing actionless-button findings in older QA wrappers; none in changed/new files. See design/profit-review-20261031/ui-audit.json.
- Initial `npm test` after Pages build failed the Sites packaging test (missing dist/server/index.js). Full `npm run build` confirmed the imported checkout lacks .openai/hosting.json, an existing Sites input requirement. No Sites files/configuration were altered; the intended Pages release gate above passes. Sites packaging is not verified by this change.
- During live QA source edits, Vite HMR emitted duplicate createRoot warnings in the standalone QA entry. A fresh document load had no console errors.

Evidence: design/profit-review-20261031/{build-pages.log,tests-pages.log,browser.json,ui-audit.json,desktop.png,mobile.png}.

Preview: http://127.0.0.1:5231/qa-profit-review.html (storage-free synthetic cases).
Game: http://127.0.0.1:5231/ → Headquarters → Finance.
