# Manual Pages publication (no GitHub Actions)

Validation and publication are done locally. Source lives on `main` of thangldw/jetrise; the built site lives on the `gh-pages` branch of the same repository (served by legacy GitHub Pages).

## Validate (run before every publication)
```
npm ci
npm run build:pages     # vite build --base=/jetrise/
npm run verify:pages    # rejects source paths, source maps and unexpected files
npm run test:pages      # all game/save tests except the legacy Sites output test
npm run test:long-run   # optional: full 90–180 day save and accounting matrix
```
Publish only from an up-to-date `main`.

## Publish
Only `dist/client` goes to `gh-pages`, as a new commit on top of the existing history (never force-push):
```
git fetch origin gh-pages
git worktree add ../jetrise-pages origin/gh-pages
cd ../jetrise-pages && git rm -rq . && cp -R ../jetrise/dist/client/. . && touch .nojekyll
git add -A && git commit -m "Publish <feature> from <source sha>"
git push origin HEAD:gh-pages
cd ../jetrise && git worktree remove ../jetrise-pages
```
Then compare `https://thangldw.github.io/jetrise/` with `dist/client/index.html` (a few seconds to a minute for Pages to rebuild).

## Rollback
Revert the publication commit on `gh-pages` (`git revert <sha>` then push). Switching frontend commits does not restore a mutated save; restore game archives only through Save Manager.

## Boundaries
Domain/path, schema1, SAVE_KEY, legacy opt-out and canonical migration paths are unchanged. Never put tokens, source maps or player data in the repository, and keep `gh-pages` limited to the validated build output. Cloudflare Worker deployment is separate from Pages.
