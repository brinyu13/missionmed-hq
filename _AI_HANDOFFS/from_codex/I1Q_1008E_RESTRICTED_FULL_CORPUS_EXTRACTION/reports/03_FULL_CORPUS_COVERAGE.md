# 03 — Full Corpus Coverage

## Coverage verdict

Coverage is complete for the authorized `C1_OBSERVED` cohort. It is not a claim of historical-universe completeness.

The observed roster reconciles exactly:

- 97 paired transcript + Nodes sources;
- 2 Nodes-only sources;
- 6 sources with neither validated artifact;
- 97 + 2 + 6 = 105 observed candidate sources; and
- 97 paired Nodes artifacts + 2 Nodes-only artifacts = 99 Nodes artifacts accounted.

All 97 available transcripts were processed. The 2 Nodes-only records were explicitly reconciled outside the transcript extraction denominator, and the 6 neither-available records remain explicitly unresolved. There is no silent omission in the observed roster.

## Processing denominators

| Coverage cell | Required | Complete |
|---|---:|---:|
| Automated passes: 97 × 9 | 873 | 873 |
| Specialist verification: 97 × 2 | 194 | 194 |
| Specialist role reviews: 97 × 4 | 388 | 388 |

The final coverage status is `VERIFIED`, and `extraction_complete` is true. All 97 artifact entries finished as `COMPLETE_WITH_QUARANTINE`; completion means processing and review coverage are accounted, not that content was approved or released.

## Source-content accounting

The processed transcript corpus contains 81,604 transcript segments and 34,939,049 transcript bytes. The Nodes inventory contains 82,510 records. Safe parser accounting records:

- malformed records: 0;
- repaired records: 0;
- unrecoverable records: 0;
- artifact retries: 0;
- newly recovered transcripts: 0; and
- newly recovered Nodes artifacts: 0.

The retry and failure ledger separately records zero acquisition retries, zero extraction retries, and zero failed artifacts. Controlled unavailable probes did not become retries or silent successes.

## Extracted inventory

The completed cohort produced:

- 117,893 occurrence records;
- 58,317 medically relevant or review-required occurrences;
- 57,688 provisional concepts; and
- 178,341 provisional duplicate-relationship records.

All occurrence provenance shapes remain bound in the safe invariant inventory, with zero PASS 6 Nodes-binding violations and zero release-overclaim findings. The safe provenance file retains its own independent-recomputation qualification; this report does not silently upgrade that separate audit label.

## Historical completeness limitation

The cohort is the accessible observed consumer projection, not all historically possible media. Eight observed candidates sit outside the transcript projection: 2 Nodes-only and 6 neither-available. Historical registry/CDN/R2 reconciliation and exclusion/tombstone reconciliation remain unresolved and out of scope. Therefore, “full corpus” in this report means complete processing of the authorized observed denominator only.

## Recovery continuity

The finalizer-drift generation was archived non-destructively under rotation root `9509acc7b9fa7f1373b54e1543af5056430f5c1fd6b921cf3e835948ccd80d08`; its durable completion root is `9dec3ee57bb1ebbb936303c70679a8f75a8eb2d3135c5f32ff555126a31af977`. Prior derived generations and immutable inputs were preserved before the corrected contract-bound run completed.

## Evidence

- `../evidence/processing-roster-safe.json`
- `../evidence/source-content-safe-summary.json`
- `../evidence/coverage-receipt.json`
- `../evidence/extraction-run-manifest.json`
- `../evidence/candidate-inventory-safe-summary.json`
- `../evidence/provisional-concept-summary.json`
- `../evidence/provenance-invariant-results.json`
- `../ledgers/ARTIFACT_PROCESSING_LEDGER.json`
- `../ledgers/RETRY_AND_FAILURE_LEDGER.json`
