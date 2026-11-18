# Changelog

## 0.2.0

- Weather per airport is complete: legs hit by fog or storms are flagged in Disruption recovery with a suggested delay, and a forecasting research branch extends the weather outlook to 4, 5 and 7 days.
- Slot auctions (opt-in): sealed bids with escrow against the two rivals, closing every seven days before the day runs, with refunds for lost bids. Existing rights are unchanged.
- Second rival hub (opt-in): after 14 days each rival may open one extra hub from its own cash and route from it.
- Both new systems take a backup when enabled and can be rolled back from the Save Manager. Careers that do not enable them are unchanged.

## 0.1.0

- `npm test` now builds the site first, so the content-security-policy test no longer needs a manual build.
- Toasts are dismissible and sit bottom-right instead of covering page content.
- A weekly reminder to export a backup, and a request for persistent browser storage.
- Dark theme that follows the system setting.
- Installable offline app: web manifest and service worker.
- `R` opens the run-day briefing.
- A visible keyboard focus ring on every interactive control.
- Storm-season market event every seventh week (deterministic, no save change); it cuts network demand for four days and can be revealed by research like other events.
- Visual refresh: pill tabs, softer cards, system font stack, gradient top bar.
- Guided mode: Headquarters tools unlock progressively (toggle in Settings).
- Ready-made scenario presets on the founding form.
- Volume control, a profit/loss sound cue after each day and an entrance animation for the day report.
- `styles.css` split into four ordered files; the built stylesheet is byte-identical.
- `npm run typecheck`: TypeScript over a growing list of JSDoc-typed modules, run in CI.
- `docs/ROADMAP.md` scopes weather per airport, slot auctions and more rival hubs.
- Weather per airport: deterministic fog (-15% demand) and storms (-45%) for routes touching an affected airport, with a three-day outlook in Strategy › Market. No save change; forecasts and settlement share the rule.
- ESLint with a small rule set, run in CI.
