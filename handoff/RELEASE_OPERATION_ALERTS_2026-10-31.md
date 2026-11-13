# Production release — operational alert center

Target: https://thangldw.github.io/jetrise/
Status: candidate; publish only after successful private CI.

Authorized scope: the existing bell dialog becomes one read-only center for maintenance reminders, shared/legacy slot deficits, sold-journey risks and lease expiry, with category filtering and existing operational destinations. Headquarters overview and DayBrief open that same center. No new engine rules, save fields, migration, opt-in, dependencies, backend, GitHub App or infrastructure changes.

Previous source main: 67cc9fe6fc27115aaf36df31a0be44c352fb5221.
Previous public gh-pages: 378bf8f12d23156181c4ee824b55ac4f2fe4391c.

Acceptance: build:pages, verify:pages and test:pages on the release source; exact-source private CI; artifact allowlist; retained hashed assets; Pages completion; served SHA-256 checks and read-only production browser smoke. Existing Sites packaging absence and older QA static-audit findings are documented in OPERATION_ALERTS_2026-10-31.md; they do not change the Pages target.

Eleven engine, save, economic and dependency contracts match the previous source exactly (release-preflight.json). Local browser verification includes an unchanged exact-byte all-JET save after opening the new modal/filter, legacy/opt-out behavior, actual reclaimed rights, lease expiry and resolved-versus-pending connection states.

Publish built artifacts only. Retain all previous hashes for open tabs. Rollback restores the previous index while retaining all assets and browser storage; this release introduces no new save version. Existing economic opt-ins still require a compatible reader or the matching whole-career backup if reverting to much older versions.
