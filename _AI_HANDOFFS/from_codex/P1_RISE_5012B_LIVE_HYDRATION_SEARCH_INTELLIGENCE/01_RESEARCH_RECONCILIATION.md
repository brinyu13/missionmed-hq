# Research Reconciliation

## Canonical convergence

All existing provider outputs now enter the provider-neutral rise_research_sources / rise_research_claims evidence path using canonical ACGME identity reconciliation. Provider and run identifiers, source references, retrieval times, publication state, review state, and conflict state are retained.

| Provider | Source rows | Unique programs | Claims | Publication state |
|---|---:|---:|---:|---|
| Claude Sonnet Phase A | 695 | 695 | 2,116 | REVIEW_REQUIRED |
| Parallel | 271 | 271 | 2,063 | REVIEW_REQUIRED or legacy pending-rights-review |
| Claude Opus | 270 | 270 | 977 | REVIEW_REQUIRED or legacy pending-rights-review |
| Provider union | 1,236 | 1,077 | 5,156 | Not student-visible until approved |

Program overlap: Sonnet-only 536; Sonnet + Parallel 159; Parallel-only 112; Opus-only 270.

The 5012C instruction changed priority, not truth controls: provenance is preserved but is no longer treated as a primary blocking workstream. The real current blocker for provider facts is evidence review/promotion state, not provider origin.

Detailed row custody is in 02_PHASE_A_695_RECONCILIATION.csv, 03_PARALLEL_RECONCILIATION.csv, and 17_OPUS_RECONCILIATION.csv.
