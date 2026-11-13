# JETRISE

JETRISE is a browser airline-management game. Play it on [GitHub Pages](https://thangldw.github.io/jetrise/).

The game runs entirely in the browser: there is no backend, account or telemetry. Careers are saved in browser storage, and the route planner runs in a Web Worker.

## Development

Requires Node 22.

```
npm ci
npm run dev          # local dev server
npm run test:pages   # all game and save tests
```

`design/` is a git-ignored output directory for locally generated study and QA evidence (for example `npm run test:long-run`). Documents under `handoff/` are historical release records; the evidence files and private CI runs they cite are not published.

## Release

`main` holds the source; the `gh-pages` branch holds only the built site (`index.html`, `assets/`, `.nojekyll`). See [handoff/CI_CD.md](handoff/CI_CD.md) for validation and publication steps. To roll back the frontend, revert the publication commit on `gh-pages`.

`infra/` contains an optional, standalone health/version Worker. The game does not call it.

## Save compatibility

Saves stay in browser storage. Preserve `SAVE_KEY` and `schema1`. Players move a career between origins through an explicit Save Manager export and import.

## License and credits

Code is released under the [MIT License](LICENSE).

Airport data comes from [OurAirports](https://ourairports.com/data/) (public domain) and [GeoNames](https://www.geonames.org/) ([CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)); the world outline comes from [Natural Earth](https://www.naturalearthdata.com/) (public domain). Per-field provenance for localized airport names is in [handoff/airport-display-names/](handoff/airport-display-names/).
