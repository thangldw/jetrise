# Frozen compatibility fixture

`pre-jet-schema1.json` is a synthetic reproduction of the original built-in career,
frozen on 2026-10-23 for JET-208. It is not a user's private or historical export.
It omits economyVersion, setupComplete, the aircraft sequence and weekly-service/
airborne fields to exercise their established legacy defaults, while retaining
the original cash, three registrations and thirteen weekly schedules.

SHA-256: `02301213fe38fc8b2a69c70ceb71c81715b958fce4de0c9c0d987a49471528c5`.

Do not regenerate it to make a failing restore test pass. New historical cases
must be appended as distinct fixtures with their own provenance and expected
state. Replay always uses disposable in-memory Storage and preserves these bytes.
