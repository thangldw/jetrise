# JETRISE airport presentation catalog

This directory contains a sparse, sourced presentation catalog for the existing 4,008-airport JETRISE dataset. IATA identifiers, coordinates, airport identities, route calculations, saved careers, and player-defined names remain canonical.

## Integration artifacts

- `src/data/airport-display-names.js`: `{ "IATA": { "en"?: { "city"?, "name"? }, "ja"?: { "city"?, "name"? } }`.
- `airport-name-provenance.json`: one source record for every translated field, including GeoNames alternate-name IDs or Wikidata entity IDs when used.
- `airport-names-metadata.json`: licenses, source downloads/hashes, selection rules and coverage.
- Missing Japanese fields intentionally use Latin fallback.
- `airport-names-metadata.json` and `validation.json`: measured coverage and validation result.

Use `ja.field ?? en.field ?? canonical.field`, with sparse English overrides restoring the ten manually localized/shortened names and the Latin municipality for HAN/SGN/DAD. CXR and UIH also have reviewed presentation-only city corrections. Vietnamese mode should retain its established labels. Do not use this catalog to translate custom/user-defined airport or airline names. Search should include current localized, English and canonical name/city aliases plus IATA; route/city identity must continue using codes.

## Measured coverage

- 4,008 canonical airports, 233 countries, 3,941 nonempty canonical municipality values.
- 2,591 sparse catalog entries.
- English: 10 airport names and 5 city overrides.
- Japanese: 1,588 airport names, 2,004 city labels; 1,001 airports have both, 2,591 have at least one.
- Japanese fallback: 2,420 airport-name fields, 2,004 city fields (including 67 empty canonical cities), 1,417 airports have neither Japanese field.
- Japan: all 83 airport names; 64 city fields.
- Vietnam: all 22 airport names; 17 city fields. The five city fallbacks are PQC `Phu Quoc Island`, VCL `Tam Nghĩa`, VCS `Con Dao`, VDH `Dong Hoi`, VDO `Van Don`.

These counts are sourced-label coverage, not a claim that every name was independently confirmed by an airport operator. GeoNames and Wikidata are community-maintained datasets. Ambiguity is resolved conservatively; fallback is intentional.

## Identity and label rules

1. Airport matching requires an exact IATA alias, feature `S.AIRP`/`S.AIRF`/`S.AIRB`, the same ISO country, a distance at most 5 km from the canonical game coordinates, and no conflicting ICAO code where both sources contain one. This yielded 3,903 unique candidates; one airport was ambiguous and 104 did not meet the filter. The candidate count is distinct from usable Japanese-label coverage.
2. Japanese airport names must contain a recognizable airport term. City-only aliases and a Chinese name mislabeled as Japanese were rejected rather than automatically adding `空港`.
3. City matches must be within 100 km in the same country and match the canonical municipality against the current GeoNames primary name, ASCII name, or an explicit English alternate label. An arbitrary multilingual alias is insufficient. This excludes real false matches such as Yakushima→Koseda, Kikai→Akaren and Okinoshima→Nishida.
4. Historic, colloquial, ended and future-dated selected GeoNames alternate labels are excluded. Preferred Japanese labels win; a sole label is accepted. Equivalent city variants differing only by administrative suffix are permitted; materially different unpreferred names remain unresolved. Japanese kana readings are excluded when an unambiguous kanji variant exists. City-hall labels are excluded.
5. Canonical parenthetical qualifiers are preserved literally when only the primary city has a sourced Japanese label: `Hanoi (Soc Son)` → `ハノイ (Soc Son)` and `Sydney (Mascot)` → `シドニー (Mascot)`.
6. Never use Wikidata `P931` (place served) as the municipality. NRT remains Narita (`成田`), not Tokyo.
7. A bounded Wikidata supplement resolves JP/VN omissions and airport-name aliases using exact IATA, ICAO, country and at-most-5-km coordinate checks. A few reviewed labels use airport/operator/government sources. London is Q84, not the City of London; New York is Q60, not Manhattan.

## Reviewed exceptions

- English restoration applies only BKK, DAD, HAN, HND, LAX, LHR, NRT, SGN, SIN and SYD. The current OurAirports CSV also changed CJJ and MBD names, but those unrelated renames are deliberately not applied to English or the canonical dataset.
- CXR's malformed canonical municipality `Nha Trang/nha Trang aiurportCam Ranh` is displayed as `Cam Ranh` / `カムラン`, supported by the airport's published address and Air Seoul's Japanese airport location. Raw canonical data is unchanged.
- UIH's canonical `Quy Nohn` is displayed as `Quy Nhon` / `クイニョン`; the official Vietnam Airlines Japanese airport/city pair supports the intended city. Raw canonical data is unchanged.
- GeoNames KKJ's stale `小倉空港` is overridden by identity-verified Wikidata `北九州空港`, also confirmed by Japan MLIT's current airport list.
- HND uses the operator-facing `羽田空港` rather than selecting one of two GeoNames aliases arbitrarily. KMJ uses the operator-facing `阿蘇くまもと空港`.
- The failed PXU Wikidata supplement mapped to an entity without IATA/ICAO/JA label; it was rejected. `プレイク空港` comes from Vietnam Airlines' official Japanese airport list instead.

## Provenance and reuse

GeoNames data is under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Credit [GeoNames](https://www.geonames.org/) and indicate that names were selected/adapted. The license and format are documented at https://download.geonames.org/export/dump/readme.txt. All source dumps were retrieved on 2026-11-05 UTC (2026-11-06 Japan); exact timestamps, byte lengths and SHA-256 values are in metadata. No remote translation service was used.

OurAirports data is public domain: https://ourairports.com/data/. The game snapshot date is 2026-10-19; the newer public CSV was used only to verify identities and restore the ten original display names. Runtime still uses the existing canonical dataset.

Wikidata structured data is CC0: https://www.wikidata.org/wiki/Wikidata:Data_access. API response snapshots are retained in the local QA archive; retrieval URLs and SHA-256 values are recorded in metadata. WDQS was unavailable/rate-limited during this audit, so no complete Wikidata coverage claim is made; the bounded `wbgetentities` API succeeded.

Other primary sources used for factual names/spot checks:

- https://tokyo-haneda.com/
- https://www.narita-airport.jp/en/ and https://www.narita-airport.jp/ja/
- https://www.kumamoto-airport.co.jp/
- https://www.mlit.go.jp/koku/15_bf_000310.html
- https://www.vietnamairlines.com/jp/ja/travel-information/check-in/online-check-in/airports-allow-online-check-in
- https://thunghiem.vietnamairport.vn/camranhairport/en/contact
- https://flyairseoul.com/CW/ja/destinations_infor.do

The last Air Seoul page was available through the indexed official-page text but direct retrieval returned 403. The old `www.vietnamairport.vn/camranhairport/en/contact` URL redirects to ACV's main site; the `thunghiem.vietnamairport.vn` contact page retains the published Cam Ranh address. CXR is a geographic display correction, not an assertion about current administrative-boundary law.

## UI integration and verification

`src/airport-display.js` provides language-aware presentation helpers through `useI18n`. Production JSX uses these helpers for picker/search aliases, maps, routes, schedules, alerts and decision previews. Engine-owned message fields are matched as complete canonical labels before presentation; custom airport names and player airline names remain opaque. Neither the canonical airport/network modules nor the engine, planner worker, persisted schema or save keys are changed. Source attribution is visible on founding and in Settings.

The final catalog passed an independent review and 18 focused helper/render tests. The Pages regression suite passed 466 tests, the production build and artifact allowlist passed, and 160 EN/JA screen renders completed with no crashes or state mutation. Detector matches were Latin proper names with diacritics, not untranslated Vietnamese UI copy. Browser checks covered same-mount language switching, Japanese/English/IATA search, no-result recovery, keyboard focus, unchanged player names and selected IATA, network labels, visible attribution, and a 390px viewport without horizontal overflow.
