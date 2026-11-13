# Historical slot experiment inputs

The production integration on 2026-10-25 supersedes the isolated slot admission experiments. Their original reports retain their original source fingerprints; do not describe those measurements as fresh runs of the released engine.

`design/releases/2026-10-25-slot-access/pre-release-experiment-inputs.tar.gz` preserves src, scripts, tests and package manifests from the pre-integration research workspace (runtime fingerprint 789ee22de953c002915c53e0736b0483b8acde3699d92333b74e3cc164a2d19e). It contains no Git metadata, credentials or node_modules and must remain private. Extract into a separate disposable directory to inspect/replay the historical harness, preserving its relative paths and supplying the corresponding historical result directories when verifying baselines.

The three experiment-owner test files now use `.historical.mjs` in the working project, so production regression commands do not apply pre-integration policies to the new live engine. The archived input bundle contains their original filenames. Current release verification uses the integrated production tests and canonical long-run matrix. Existing research results and failed-attempt evidence remain unchanged.
