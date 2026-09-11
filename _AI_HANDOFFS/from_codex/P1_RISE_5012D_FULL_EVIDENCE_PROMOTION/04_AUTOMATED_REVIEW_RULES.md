# Automated Review Rules

Rule version and thresholds are checked into `rise/config/research-review.v1.json`; execution is implemented in `rise/src/research-review.mjs` and `rise/tools/review-promote-research.mjs`.

1. Resolve the canonical ACGME/program-specialty identity. Unresolved identities fail closed.
2. Group comparable claims by canonical subject and normalized field.
3. Preserve source URL, provider, provider run, retrieved time, and original claim bytes.
4. Normalize only field-safe structured values. Unknown remains unknown.
5. Classify explicit researched-but-not-found results separately from unresearched gaps.
6. Approve a current winner only when evidence quality and recency satisfy the field contract.
7. Preserve supported historical facts as `APPROVED_HISTORICAL` rather than current truth.
8. Mark weaker or duplicate variants `SUPERSEDED`; link every approved contributor through immutable promotion lineage.
9. Send materially conflicting supported values to `CONFLICT_REQUIRES_REVIEW` and weak evidence to `INSUFFICIENT_EVIDENCE`.
10. Do not auto-publish resident names or leadership names. Student projection uses safe structured aggregates and public professional fields only.
11. Reject both protected canary IDs before promotion.
12. Re-running the same reviewed corpus is idempotent and costs `$0.00`.

Append-only review events and promotion lineage are forced-RLS admin surfaces. Student APIs consume only approved canonical projections.
