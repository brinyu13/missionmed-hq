# Hydration and Data Readback

## Source package

Canonical copied package:
`rise/config/research-packages/tx-fl-adult-neurology-2026-09-12.v1/`

Aggregate package SHA-256: `13623f90b0342802919d9b8bfda9ceaa47bcfcc2e83c384772c68f59f709692d`

Input inventory: 34 programs, 884 domain facts, 566 resident rows, 34 composition records, 212 leadership rows, 636 faculty rows, 34 fellowship/outcome records, 34 application-requirement records, 46 tracks, 4,032 source-manifest rows, and 477 conflict/exception rows. Six source retractions were preserved.

## Canonical production readback

Provider-native Railway PostgreSQL readback from `rise_runtime.canonical_current_facts`, source `rise_src_p1_rise_5012j_review`:

| Measure | Result |
|---|---:|
| Current projected claims | 1,462 |
| Programs | 34 |
| Projected fields | 43 |
| Programs with array rosters | 27 |
| Resident rows | 566 |
| Residents with school country | 477 |
| Leadership projections | 34 |
| Programs with Program Director | 34 |
| Terminal unknown/unavailable rosters | 7 |

The canonical evidence table retains 1,489 claims for this source because the country-recovery replay appended 27 superseding roster claims. The current view correctly resolves this to 1,462 live facts.

## Semantics preserved

- Unknown roster composition is never converted to zero.
- Official program-reported composition is visually distinct from roster-derived estimates.
- Estimates show numerator, classified denominator, total roster coverage, and a plain-language disclaimer.
- No classification derives from name, ethnicity, nationality, or visa status.
- IMG classification does not imply visa need.
- Status-over-value, conflict, stale, not-applicable, researched-not-found, and researched-not-public states are preserved.
- Sibling-program NRMP contamination remains excluded.
- Universidad Central del Este and Universidad Central del Caribe remain distinct.
- The boolean `true` Puerto Rico tie remains unverified and is not presented as a relationship.
- The UPR undergraduate association is not presented as a medical-school relationship.
- Florida's stronger adversarial-validation provenance is preserved relative to Texas.

