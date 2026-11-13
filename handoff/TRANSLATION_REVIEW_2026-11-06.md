# English and Japanese translation review

The first localization pass translated isolated Vietnamese fragments. This could preserve Vietnamese word order in Japanese, leave unaccented labels such as `Doanh thu` unchanged, and expose Vietnamese labels inside canonical engine messages. The review reads every original catalog entry in context, corrects financial/operational meaning and rewrites composed interface text as complete sentences.

## Changes

- Review all 2,974 entries in the three main catalogs and the existing override catalogs. Standardize flight recovery, aircraft families, slot rights, positioning, maintenance deadlines and deferred ticket revenue. Preserve amounts, deadlines, commitment terms and the distinction between cash and profit.
- Use complete templates for plain text and `LocalizedText` for sentences with emphasized React values. Translations control word order while values retain their formatting. No action payloads or control values change.
- Translate explicitly declared system-label captures inside canonical engine messages. Names, aircraft IDs and airport/route data remain verbatim. Match complete appended refund/released-slot acknowledgements, localize embedded game-clock dates and reject ambiguous adjacent-placeholder templates and overly broad fragment matching.
- Historical ledger descriptions are already truncated at 120 characters in existing saves. The view translates a recognized complete prefix with an ellipsis, or shows a neutral shortened-description label; it does not reconstruct lost text or reinterpret cash movements.
- Add Japanese copies for 112 validation errors with confirmed paths to import/restore/action UI. Internal-only diagnostics and proper names are excluded. Locale-aware UI number formatting replaces the remaining fixed Vietnamese formatting.

## Boundaries and verification

Engine, save modules, worker, schema1, SAVE_KEY and package dependencies are unchanged. Language remains a separate browser preference. Source publication is private; Pages receives compiled artifacts only.

Validation includes catalog completeness/placeholder checks, regression cases for nested messages, names, dates, quantities and truncated historical descriptions, static comparison of existing UI event handlers and control values, and full Pages tests. The existing long-run replay/report remains the release gate.

The render review covers 160 EN/JA views across fresh/progressed and legacy fixtures, plus 80 Vietnamese comparison views. The only intended Vietnamese prose change in the compared views clarifies the purchase/maintenance fee label; values remain identical. A separate audit samples 120 variants of 111 canonical engine template expressions. Compiled-build browser review uses a synthetic local career, covers both languages, daily settlement/reload, financial copy and 1280px/390px layouts. It does not use production careers.

This is an agent-led contextual language review, not external native-speaker certification. Unknown future messages still fall back visibly to source text. The existing Vite large-chunk warning remains.

## Startup regression found during live verification

The first reviewed build passed the existing engine/save suites and the 160-view render audit, but fresh onboarding failed with `ReferenceError: LocalizedText is not defined`. The same missing import existed in the first-route cards and the interaction-triggered fare preview. The initial render audit loaded the founding modules without rendering them; compiled browser QA had started from an already founded synthetic career. The public artifact commit was reverted before preparing the repair. No game data or save migration was involved.

Import `LocalizedText` in Onboarding, LaunchOffice and App. Add an AST scope check for all production JSX component references and actual VI/EN/JA renders of fresh onboarding, initial fleet and first routes. Compiled browser verification now also completes the full founding flow and opens the EN/JA seven-day fare forecast. Count labels use wording that remains grammatical with one route or one aisle.
