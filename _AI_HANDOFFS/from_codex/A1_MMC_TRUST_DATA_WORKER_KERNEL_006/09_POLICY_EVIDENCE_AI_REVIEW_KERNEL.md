# 09 Policy, Evidence, AI, and Review Kernel

RESULT: `EVIDENCE_LINEAGE_AND_REVIEW_LOCALLY_VERIFIED`

## Policy registry

Policy IDs are tenant/environment scoped, immutable by version, separately activated, and strict typed strings; policy/principal identifiers are never accepted through numeric coercion. Register/activate actions append immutable audit records. The same opaque policy ID can exist in another tenant without collision.

## Evidence chain

Transcript registration validates exact UTF-8 content hash, bounded segments, active authority, tenant/environment/subject/assignment, and immutable ID. Transcript, span, proposal, canonical, and judgment maps are scope-keyed. Exact byte spans bind quote, speaker, and time range to the source segment.

AI proposals require worker analysis-result authority, active grants, one exact assignment, active spans, policy version, model/prompt/run provenance, and bounded numeric confidence; string confidence is rejected instead of coerced. The exact proposal kinds are `FACT`, `RECOMMENDATION`, `OPEN_LOOP`, and `TASK_CANDIDATE`. `RISK_SIGNAL` is rejected: risk/attention must be a separately governed deterministic product projection, not a free-form AI fact category. A factual proposal must exactly equal supporting evidence; it is never operational or publication eligible before human review.

## Concurrency and immutability

- One hundred conflicting same-ID transcript creates: one winner, 99 conflicts, no overwrite.
- One hundred conflicting same-ID proposal creates: one winner, 99 conflicts, one lineage edge.
- Concurrent ACCEPT/REJECT reviews: one terminal winner, one deterministic conflict, one review record, one canonical.
- Assignment authority is checked before waiting and again inside the proposal lock immediately before commit.
- A failed first review plus authority revocation while a second waits produces zero review/canonical commits.

## Human judgment and revocation

Human professional judgment remains explicitly human, records rationale/uncertainty, and cannot masquerade as evidence. Canonical inputs emit `CANONICAL_TO_JUDGMENT` lineage. Span revocation performs exact-scope, cycle-safe recursive traversal: proposals become revoked and every downstream AI canonical or human judgment becomes `REASSESSMENT_REQUIRED` and non-operational.

Lineage edges store tenant/environment plus exact typed endpoint IDs and versions; they do not duplicate subject or assignment columns. On insert, the resolver locks both exact endpoint versions, derives their subject/assignment scopes, requires one exact subject and compatible non-null assignments, and intentionally treats a student statement's assignment as null. While an edge remains active, either governed endpoint is forbidden from advancing beyond the recorded version until that edge is invalidated. An identical opaque transcript/span/proposal ID in a second tenant remains unchanged when the first tenant revokes evidence.

## Publication boundary

Reviewed canonical objects remain `publicationEligible: false`; publication requires a separate persisted approval and projection contract.
