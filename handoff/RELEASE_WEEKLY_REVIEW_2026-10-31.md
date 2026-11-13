# Weekly recap and strategic coaching goals — 2026-10-31

## Scope and save contract
Headquarters → Weekly recap reads actual retained daily reports for fixed calendar weeks (days 1–7, 8–14, …). It shows financial totals, weighted ratios, executed/cancelled legs, completed connecting passengers, and complete-week accounting comparisons. Missing fields/days or duplicate days remain unknown; current schedules and forecasts never reconstruct history. Accounting-mode changes are disclosed.

One optional coaching goal is selected explicitly for the current game week: financial margin, execution reliability, or connecting traffic. Goals award no cash/buffs and do not change customer positioning, flights, rights, prices or settlement. A new optional `gameplay.weeklyGoal` object is strictly validated without changing schema1/SAVE_KEY or injecting it into existing saves. Switching/clearing is free and uses the authoritative transition and existing save lock, revision checks and backups. Only seven unique consecutive actual reports can certify completion. Historical reports still retain at most 28 days; this is not a permanent achievement archive.

## Verification
- 405/405 Pages tests passed in the imported workspace, including five new behavior tests for fixed weeks, weighted denominators, incomplete/unknown outcomes, explicit goal mutations, portable saves and actual all-JET replay.
- Old production baseline: private main `5a461b510d73f9cf85da7ec5da3530782fc6b7f5`. Six scenarios (legacy, healthy, connections, lease, slots, all-JET) each replayed 14 days with exact game/report equality. Another 14 paired closes verified the old reader preserves optional goal metadata. Total: 98 paired day closes. This is a bounded compatibility drill, not another 90–180-day balance study.
- Fourteen actual all-JET reports reconciled profit/cash bridges within one cent. See `design/weekly-review-20261031/ledger-check.json`.
- Browser on disposable localhost: imported the actual 14-day fixture through Save Manager, checked complete week/current empty week, explicit save/switch/clear, reload persistence, and downloaded raw save. Exact comparison showed only `gameplay.weeklyGoal` changed on goal selection; all other career data was identical. Finance deep action opened canonical P&L. No console warnings/errors observed.
- Desktop and 380px screenshots captured. Document width equals viewport width (380px). Physical touch, Safari and screen-reader certification were not performed.
- Premium static audit has the same eight existing actionless-button warnings/errors in nonproduction QA wrappers; no new findings in this feature. It is not a clean repository-wide audit pass.

## Release procedure
Build and validate the frozen private source, pass remote CI, then publish only built assets to the public `gh-pages` branch. Retain existing hashed assets for open tabs. Verify served SHA-256 hashes and source/map exclusions, then perform a read-only production browser smoke test. Do not import, reset, advance or edit the player's production career. Backend, GitHub App and billing remain unchanged.

Production identifiers and final receipts are recorded after deployment.
