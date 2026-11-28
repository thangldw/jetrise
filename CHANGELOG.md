# Changelog

## 0.6.0

- Headquarters overview shows the last 28 settled days as a chart: daily profit bars (gains and losses) over the revenue line, with total profit and current cash.

## 0.5.0

- The fleet ceiling grows with the network: 8 aircraft at the home hub, +4 for each additional hub and +2 for each hangar level, up to 24 including orders.
- The automatic scheduler is about five times faster (market and event lookups are cached, and a free start with no profitable route skips ahead an hour), so it stays usable with larger fleets. Proposals can differ slightly from before.

## 0.4.0

- Living network map: today's scheduled flights fly along great-circle routes in game time, under a day/night terminator that follows the clock and season, with a clock and airborne count. Reduced motion shows a still noon.
- Ready-made founding scenarios follow where the player is: Vietnam, Japan, Korea, Thailand, Australia/New Zealand, US, UK/Ireland and Europe each get four local hubs, detected from the time zone and browser locale; elsewhere gets global hubs (Singapore, Dubai, London, New York). The default hub follows the first scenario instead of always Hanoi.

## 0.3.0

- Automatic scheduling can rebuild the whole weekly schedule (new default) or keep the current one and only add flights. Rebuild keeps flights holding connecting tickets, flights with one-off adjustments and aircraft that cannot be rescheduled, and applies only if projected profit improves.
- After a deploy, the game loads the new version on the next visit instead of serving the cached page.
- Starting cash for a new airline is $100 million (was $500 million). Existing careers are unchanged. At the new economy's prices that buys about one new narrowbody, so early growth leans on leasing and route choice.

- Six new aircraft models: A220-100, E195-E2, 737-900ER, 767-300ER, A330-200 and 777-200ER.
- Founding draw now pairs one small regional jet with one mid-size narrowbody, so starting fleets are comparable.
- Day replay: after a day with flights is run, the map plays the day back with each aircraft flying its settled legs, a running ticket-revenue and passenger count, and pause, 1×/2×/4× and skip controls, then opens the report. It ends on the report's totals, changes no rules and no save data, and is skipped under reduced motion.
- The replay also shows that day's fog and storms with their demand effect, cancelled flights with their reason, rival aircraft when Competition is on, how full each airborne leg is, and the most profitable and weakest round trip when the day closes. It can be turned off in the settings.

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
