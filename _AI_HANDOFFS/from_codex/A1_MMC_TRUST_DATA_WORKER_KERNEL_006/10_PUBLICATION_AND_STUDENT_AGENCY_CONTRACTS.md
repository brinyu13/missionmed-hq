# 10 Publication and Student Agency Contracts

RESULT: `PUBLICATION_PROJECTION_LOCALLY_VERIFIED_RESPONSE_STREAM_NOT_YET_DURABLE`

## Separate publication plane

Student-visible data is an immutable, versioned projection, never a direct view of mentor-private evidence or canonical tables. The local contract has seven exact item kinds: `TASK`, `MILESTONE`, `PLAN_UPDATE`, `SESSION_SUMMARY`, `FEEDBACK`, `CORRECTION`, and `WITHDRAWAL_NOTICE`. Each discriminator has an exact field schema; unknown fields or a source kind that does not match the item kind fail closed.

Limits are contract data, not UI suggestions: at most 100 items, 160 UTF-8 bytes per title, 4,096 bytes for body/description/criteria/corrected text, 2,048 bytes for summaries/next steps/student messages, and 128 bytes for opaque identifiers. Canonical normalization uses NFC and normalized line endings before hashing and serialization. The shared RFC 3339 parser validates real calendar dates/leap days without JavaScript `Date` rollover and permits no offset greater than `14:00`; accepted 1–9 fractional digits remain byte-preserved rather than being silently truncated or normalized.

## Version and predecessor law

- Version 1 requires all predecessor fields to be null.
- Every later version binds a different predecessor publication ID, exactly `version - 1`, and the predecessor's projection digest.
- Persisted authority must confirm this publication is the current subject head.
- A corrected publication must have a predecessor and at least one `CORRECTION` item.
- Every correction names an item that the persisted predecessor attestation proves actually existed; self-predecessors and unrelated replacement IDs fail closed.
- Every durable publication-item update preserves its creation time and advances exactly one object version; an active exact-version lineage edge must be invalidated before that item can advance.

This explicit lineage prevents a caller from fabricating “version 999,” correcting an unrelated item, or reading a superseded projection as current student truth.

## Exact source authority

Every item embeds one bounded source attestation: source ID/kind/version/version digest plus tenant, environment, subject, assignment, review decision, reviewer, review time, origin, visibility, sensitivity, and publication eligibility. Sources are unique by `(sourceId, sourceVersion)` within a projection. The persisted verifier must return the exact same set and must prove the reviewer is the assignment mentor. Mentor-private, sensitive, unreviewed, direct AI-proposal, future-dated, cross-scope, duplicate, drifted, or caller-invented source attestations are rejected.

`createPublicationAuthorityVerifier` loads persisted publication, current-head, predecessor, identity, assignment, policy, approval, and source state. It issues an opaque, single-use, short-lived operation grant whose binding lives in module-private weak maps. Preview, readback, and response authorization recompute the projection digest and reject forged, replayed, expired, future, withdrawn, wrong-principal, wrong-operation, or drifted grants.

Mentor preview/new approval requires a current assignment. Student readback/respond requires proof that the assignment was active at approval, but a later assignment expiry or mentor revocation does not silently erase an already-published student projection. Identity revocation, approval revocation, withdrawal/expiry, wrong student, or digest drift still denies.

## Content and byte-equivalence safety

Preview and readback use one payload builder and are byte-equivalent for the same version. Internal source, assignment, policy, reviewer, and mentor-private fields are omitted. HTML, URLs/domains, credential/JWT/Bearer/key shapes, private paths, bidi overrides, control characters, unsafe normalization, and byte overflow are rejected. A `NOT_MET` milestone remains `NOT_MET`; publication cannot cosmetically rewrite reviewed truth.

## Student agency: exact current boundary

The shared vocabulary is `ACKNOWLEDGEMENT`, `AGREEMENT`, `CLARIFICATION_REQUEST`, `DISPUTE`, `SELF_REPORTED_COMPLETE`, and `BLOCKER_REPORT`. Acknowledgement/agreement prohibit a message; the other four require bounded student text. A response is separately authored by the exact student, binds the exact publication version and item, uses server-authorized time, and never mutates source truth, mentor verification, task status, or publication bytes.

The important scope limit is explicit: 006 validates only a local response contract at `schemaVersion: 1`, `version: 1`, with `supersedesResponseId: null`. Any response update/supersession fails with `MMC_STUDENT_RESPONSE_DURABLE_STREAM_REQUIRED`. Although `student.respond` is a typed command and the additive schema reserves response storage, no owning command handler, authenticated student route, durable append RPC, or student application is enabled. This is not a live response system.

## Alternatives, tradeoff, and future impact

Directly exposing canonical objects was rejected because private context and later edits could leak or silently alter student truth. Arbitrary JSON publication bodies were rejected because they weaken byte equivalence and make policy review non-deterministic. The exact discriminated projection is more verbose and requires explicit mapping adapters, but it makes privacy, provenance, versioning, accessibility copy limits, and correction behavior testable.

MegaRun 008 — Student Authentication, Publication, and Agency — owns durable source-to-item publication mapping, publication command ownership, append-only response streams with optimistic concurrency, exact student authentication/entitlement, and the separate accessible student application. MegaRun 007 — Mentor CAM v2 Experience and Operations — remains local mentor-plane only and must keep student publication/response disabled. Rollback before any published v2 write is feature-plane disablement; once published, correction/withdrawal and forward repair preserve history rather than rewriting it. No student data was published, no student portal was deployed, and no production state changed.
