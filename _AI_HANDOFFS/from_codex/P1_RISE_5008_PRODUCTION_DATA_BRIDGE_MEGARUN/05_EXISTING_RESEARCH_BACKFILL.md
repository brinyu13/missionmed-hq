# Existing Research Backfill

Read-only factory audit found 811 completed input files. After removing 270 exact duplicate Claude/Opus inputs, 541 unique ingests remained: 271 Parallel and 270 Claude/Opus. They normalized to 3,040 review-required claims.

Real PostgreSQL rehearsal first pass: 541 inserted runs and 3,040 inserted claims. Exact replay: 0 inserted runs, 541 replayed runs, and 0 inserted claims. Database readback contained 542 total runs including SOAP, 3,965 claims including 925 SOAP claims, and total new spend `0.0000`.

The complete first pass was repeated successfully on the PostgreSQL 18 restored production preimage: 541 research runs, 3,040 research claims, 925 SOAP claims, 886 identities, and zero spend.

Production backfill was not run because migration 007 lacks the mandatory independent database/security approval.
