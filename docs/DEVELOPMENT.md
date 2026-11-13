# Development

## Setup

Requires Node 22.

```
npm ci
npm run dev
```

The dev server serves the game at the root path. The production build is served under `/jetrise/`.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Dev server with hot reload |
| `npm test` | Full test suite (Node test runner). `npm run test:pages` is an alias. |
| `npm run build:pages` | Production build to `dist/client` with base path `/jetrise/` |
| `npm run verify:pages` | Checks that `dist/client` contains only `index.html` and hashed assets, with no source maps |
| `npm run preview` | Serves the production build locally at `/jetrise/` |
| `npm run test:long-run` | Long-run simulation matrix and report; slow |

## Tests

Tests live in `tests/*.test.mjs` and run against the rule modules directly, without a browser. A few suites render components to static markup. There is no browser end-to-end suite; check interface changes by hand in the dev server, including a narrow viewport and all three languages.

`npm run test:long-run` replays seventeen scenarios over 90 and 180 game days, saving and reloading each day, and reconciles cash, seats and demand independently of the engine. It writes its results to `design/`, which is git-ignored.

## Changing game rules

- Put rules in the plain modules under `src/`, not in components, and change state only through `transition` in `src/game.js`.
- Forecast and settlement must keep sharing one implementation.
- Follow the save compatibility rules in [ARCHITECTURE.md](ARCHITECTURE.md#compatibility-rules). A change that makes an existing save fail to load is a bug.
- Engine messages are written in Vietnamese. When you add or change one, add its English and Japanese entries in `src/locales.js`; the language tests check that the catalogs stay in step.

## Publishing to GitHub Pages

`main` holds the source. The `gh-pages` branch holds only the built site and is what GitHub Pages serves. Publication is manual.

Validate first, from an up-to-date `main`:

```
npm ci
npm run build:pages
npm run verify:pages
npm test
```

Then commit `dist/client` on top of the existing `gh-pages` history. Never force-push that branch.

```
git fetch origin gh-pages
git worktree add ../jetrise-pages origin/gh-pages
cd ../jetrise-pages && git rm -rq . && cp -R ../jetrise/dist/client/. . && touch .nojekyll
git add -A && git commit -m "Publish <feature> from <source sha>"
git push origin HEAD:gh-pages
cd ../jetrise && git worktree remove ../jetrise-pages
```

Pages rebuilds within about a minute. Compare `https://thangldw.github.io/jetrise/` with `dist/client/index.html` to confirm.

### Rollback

Revert the publication commit on `gh-pages` and push. Rolling back the site does not roll back a player's save; a career can only be restored through the Save Manager.
