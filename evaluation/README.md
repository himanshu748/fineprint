# What these results measure

`npm run eval` runs the current developer-authored regression fixtures through the typed checker. Its result measures agreement with the authored labels, not independently established eligibility accuracy.

`baseline.json` is an unchanged September 20 model run on rule pack `2026-09-20.1`: 39 of 42 results matched that date's authored labels. The current engine fixtures use `2026-09-24.1`. In particular, two entries in the same path changed from `unclear` to `blocked` after the source conflict was resolved. The two totals are **not a head-to-head comparison**. `results.json` records this distinction explicitly.

The archived model result retains answers and Knowledge Base paths but not the exact retrieved text or complete request payloads. It cannot be reproduced as an exact historical replay. The exported September 20 pack is reconstructed from current definitions with historical overrides; it is not an immutable snapshot of every original input.

## A future controlled comparison

Before another model comparison, freeze and hash all 42 input dossiers, clocks, expected labels, exact source/context text, rule-pack version, prompts, model ID and settings. Keep expected labels and descriptive fixture names out of model inputs. Use the same inputs for a source-answering model and the same model with executable checks available. Preserve raw responses, failures, usage and per-case results, including unfavorable results. Repeat both arms with the same preset protocol and report all runs.

That experiment would measure the incremental contribution of executable checks on these authored fixtures. It would not establish general accuracy, retrieval quality, uniqueness or a requirement to use a particular database. Independent labels and broader held-out cases would still be needed. No new controlled model comparison is claimed here.
