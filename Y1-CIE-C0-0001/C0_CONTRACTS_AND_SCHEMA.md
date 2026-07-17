# Y1-CIE-C0-0001 Contracts and Schema

## Version Vocabulary

- `contract_version` identifies the object/API contract.
- `payload_schema_version` identifies a typed payload.
- `item_revision` is the append-only artifact revision.
- `row_version` is optimistic-concurrency state.
- `skill_version` is the semantic curriculum version.
- `publication_seq` orders curriculum publications.
- `content_hash` is SHA-256 over canonical JSON.

The semantic state decoder rejects unknown stored contract versions even when an attacker recomputes the content hash.

## Session Clock

`cie.session-clock.v1` is one segmented monotonic timeline per CIE session. Every segment binds one external rep and media revision to equal-duration local and global half-open ranges. Segments must be ordered, non-overlapping, positive, and internally consistent. Gaps must be in bounds and explicit.

## Track Items

Stored track revisions use `cie.track-item.v1` and include stable identity, revision chain, session event sequence, segment/media binding, point or span range, typed payload, author, visibility, consent references, Ladder provenance, and canonical hash. Revisions are append-only and contiguous.

## Moments

Moments are watchable single-segment ranges. Student Moments are self-authored. Mentor Moments require an exact active grant to a covering student Moment and preserve that source reference. Deep links contain opaque object IDs only and are reauthorized server-side.

## Skill Snapshots and Priorities

Skill snapshots preserve the complete authoritative 32-field card JSON and a render subset. Identity binds owner, skill ID, semantic version, publication sequence, and content hash. Historical rows are immutable.

An active priority set requires exactly one Spotlight snapshot and exactly one distinct Supporting snapshot. The lifecycle is `ACTIVE_SPOTLIGHT` plus `CONSOLIDATING`. Priority activation is atomic and versioned.

## Consent and Visibility

Consent is append-only and purpose-specific for evidence storage, mentor sharing, showcase sharing, and physiology storage. Policy version/hash, authority session, retention reference, and timestamp are server-owned.

Visibility is classification. Authorization requires an exact live artifact grant. Session-wide grants are rejected. Revocation is one-way.

## Ladder of Claims

Claim rung, evidence tier, simulation truth, method status, units, algorithm/version, limitations, evidence references, and author are distinct fields. L2-L4 claims cannot carry numeric scores. L4 doctrine is restricted to the integration-authored priority boundary. Unvalidated methods remain inactive regardless of badge.

## Opportunities

C0 accepts only `mentor-manual` Opportunities. Each is range-bound, source-Moment-bound, snapshot-bound, within the active 1+1 set, replay-evidenced at L1, and human-interpreted at L3. Student visibility remains false in C0.

## Replay Synchronization

Replay manifests bind session, clock hash, Moment/evidence hashes, media revisions, and authorized ranges. Sync controls coordination only; each member still requires its own playback capability. Concurrent play is single-flight, and close/revocation invalidates in-flight operations.

## Inactive Future Registry

The following entries exist as typed, non-writable boundaries only: transcript generation, StoryForge linkage, Polar ingestion, mode packs, WordPress skill sync, AI Opportunity sources, and voice/persona providers. They have no route, worker, provider import, implementation reference, or teaser UI.

## PostgreSQL Integrity

Fourteen CIE tables use FORCE RLS. Public, anonymous, and authenticated direct table DML and internal deletion commands are denied. Internal deletion work is divided between a verifier role and an executor role, with no direct table grants.
