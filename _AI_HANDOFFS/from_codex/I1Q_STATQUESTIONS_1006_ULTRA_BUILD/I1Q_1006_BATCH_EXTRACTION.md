# I1Q 1006 Batch Extraction

## Status

BLOCKED: No authorized Dr. J source corpus was available, so no real batch extraction ran.

VERIFIED: Real sources processed: 0.

VERIFIED: Real candidate questions generated: 0.

VERIFIED: Physician-approved revisions generated: 0.

VERIFIED: Release-eligible revisions generated: 0.

VERIFIED: Published revisions generated: 0.

## Implemented batch controls

- VERIFIED: Deterministic batch IDs are derived from sorted unique source IDs.
- VERIFIED: Completed source IDs are excluded from a resumed plan.
- VERIFIED: Each batch emits a checkpoint cursor.
- VERIFIED: Candidate data model includes source segment, extraction run, candidate hash, lineage, confidence, warnings, and quarantine state.
- VERIFIED: Job data model includes attempt count, maximum attempts, next retry time, dead-letter state, and error code.
- VERIFIED: No auto-approval state exists in candidate validation.

## Required future reconciliation

For every authorized extraction-ready source, Run 1007 or a later authorized execution must record:

- processed or blocked status
- source and working hashes
- candidate and rejection counts
- duplicate family
- specialty, organ system, concept, and form
- confidence and review status
- unresolved and quarantine reasons
- checkpoint and rerun identity

## Gate 8 result

BLOCKED: The source denominator is unknown, so completeness cannot be measured.

VERIFIED: `evidence/candidate_counts.json` explicitly separates one synthetic UI fixture from zero real candidates.
