# Production release — decision comparison

Target: https://thangldw.github.io/jetrise/
Status: candidate; do not publish before private CI and full existing save compatibility replay pass.

Scope: read-only independent comparison plus explicit atomic apply for fares, recurring frequency, lease/service/flights and route/flights. Keep all existing saves, slots, identity and schedule IDs compatible. No backend, GitHub App, infrastructure, billing or dependency changes.

Previous source: 01e4d3a8d50d2f7816ad7803d4f91b5de976daac.
Previous public artifacts: 13b9545ffd25b93b672dbff4633052960946afdf.

Release source passes 400/400 tests, Pages build and artifact allowlist. Browser QA uses real Worker and normal persistence on a disposable local origin; preview bytes remain exact and one selected lease package saves exactly the canonical state without advancing the day. Publish only approved compiled assets and retain old hashes for open tabs. Verify Pages completion, canonical HTML, every served SHA-256 and read-only production load. Production player storage must not be imported, reset, advanced or exported.

This release adds no save version. Artifact rollback restores the previous HTML while retaining all assets; already-applied leases/routes/fares/flights remain ordinary compatible game state. A rollback never reverses purchased actions automatically. Existing older economic opt-in reader restrictions remain unchanged.
