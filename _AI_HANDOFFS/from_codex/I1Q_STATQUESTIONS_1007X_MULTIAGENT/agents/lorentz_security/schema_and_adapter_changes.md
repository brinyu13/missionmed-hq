# I1Q-1007X Proposed Schema and Adapter Changes

Status: PROPOSAL ONLY, NOT IMPLEMENTED

This document translates the baseline findings into bounded change requirements. It does not authorize editing shared systems, applying SQL, deploying, or changing flags.

## Authority Update

MissionMed OS registration and routing concerns in the initial audit were snapshot-time findings during root recovery. DR-006 and MissionMed OS PR #12 now establish the dedicated authenticated app, RANKLISTIQ `i1q` datastore, composite metadata identity, explicit Drills availability, and GitHub-only staging route. The application defects below remain current.

## Candidate Migration Disposition

`i1q-question-platform/db/migrations/0001_i1q_question_platform.sql` must remain an offline candidate and must not be copied or applied as-is.

A deployable migration must be newly generated in the Root-approved canonical migration tree and must satisfy all of the following:

- 14-digit UTC timestamp and MR-078A filename.
- Required authority, dependency, description, and idempotency header.
- `BEGIN` and `COMMIT` transaction wrapper.
- Explicit extension dependencies or no extension dependency.
- Repeat-safe creation or an explicit non-idempotent declaration.
- Preview migration list, diff, lint, schema verification, RLS attack suite, rollback, and reapply evidence.
- No migration history repair, manual production SQL, destructive mutation of frozen STAT data, or broad grants.

## Required Schema Changes

### Trusted actor context

Replace unrestricted trust in `current_setting('app.actor_id')` and comma-separated caller roles with a trusted database adapter contract:

- Authenticate the canonical MissionMed session server-side.
- Resolve actor and I1Q roles from authoritative server data.
- Begin a transaction and set actor context locally for that transaction only.
- Prevent application callers from selecting arbitrary actors or roles.
- Clear context automatically on commit, rollback, timeout, and pooled-connection reuse.
- Verify forged context, missing context, stale context, and service-role misuse in preview.

### Answer-bearing storage

Structurally separate answer-bearing fields from ordinary internal reads. Acceptable implementations may use a separately protected answer table or a deny-by-default answer-safe view/RPC boundary, provided that:

- General resource list/get never returns `answer`, `explanation`, rationales, `answer_map`, or correctness flags.
- Authors and assigned reviewers receive answer fields only through explicit purpose-scoped endpoints.
- Every answer-bearing read records actor, purpose, exact revision, release or duel context, and timestamp.
- Student clients cannot receive base-table grants.
- Duel result access proves server-side finalization and participant membership.

### Review integrity

Add database and service invariants for:

- `review_event.review_type = review_assignment.review_type`.
- Event reviewer equals assignment reviewer.
- Authenticated actor equals reviewer actor; no administrator impersonation path.
- Assignment state is accepted at event creation and becomes completed atomically with the event.
- Exact revision hash is current and immutable.
- Required role, credential state, specialty exception, calibration, and self-review restrictions are checked from authoritative records.
- Rights, privacy, evidence, credentials, and governance cannot be written through generic entity endpoints.

### Release integrity

Introduce immutable release membership rows that pin:

`(release_id, item_id, itemrev_id, revision_number, content_hash, dataset_version, projected_question_id)`

Promotion records must include authority type, actor, evidence hashes, prior state, next state, sequence, and manifest hash. Required independent steps are:

1. Assembly by release manager.
2. Validation with complete validator and leak-test evidence.
3. Medical attestation by the assigned credentialed medical-governance lead.
4. Brian ratification for student-facing publication.

Medical attestation and publication remain unavailable while medical governance is unassigned.

### Composite projection identity

Create a versioned mapping owned by I1Q rather than silently changing the protected legacy `question_metadata` primary key. The mapping must enforce:

- Unique `(dataset_version, projected_question_id)`.
- Unique release membership for each exact Item Revision.
- Preserved `(dataset_version, question_id, content_hash)` historical joins.
- Persistent opaque projected IDs, never ordinal fallbacks.
- Explicit supersession and replacement lineage without rewriting old mappings.

### Privacy and source records

- Raw content is represented only by restricted object references and hashes.
- Working transcript rows contain only privacy-safe text.
- DRJ transcript sources require a passing redaction record and rights record before downstream extraction.
- Privacy metrics include student speech, student names, patient identifiers, third parties, and identifying clinical anecdotes.
- Threshold checks enforce patient recall `>= 0.995` and student-name recall `>= 0.99` where the benchmark gate applies.
- Missing benchmark classes and zero recall fail closed.

### Audit integrity

The audit chain must be append-only and continuous across application events, rollback events, and release promotions. A compensating migration must not create an event with an arbitrary null predecessor. Audit writes require a single authoritative chain operation with concurrency protection and verification.

## Required Adapter Changes

### STAT adapter v1

The versioned adapter must:

- Emit the exact nine-field server row in frozen order.
- Reject unknown dataset versions, duplicate projected IDs, missing mappings, extra fields, and non-four-choice revisions.
- Persist the exact mapping to the release membership tuple.
- Generate class A pre-answer, class C post-answer, server-only dataset, indexes, lookup, and composite metadata from one immutable release snapshot.
- Gate post-answer reads with server state and actor participation, not a caller phase string.
- Use a closed-world leak validator that detects field names, nested aliases, answer values, deterministic order correlations, and class D metadata.

### Drills adapter v1

The versioned adapter must emit explicit availability for playback, nodes, transcript, and VTT, plus source lineage, remediation timestamps, rights state, and privacy state. It must not write to Drills, Daily, media, Stream, R2, CDN, transcript, VTT, or nodes registries.

Current consumer rules must remain distinct:

- Drills: playable source and nodes required; transcript may be explicitly unavailable.
- Daily/Arena registry: the current five URL fields, including transcript URL, are required until a separately approved consumer adapter changes that contract.

## Application-to-SQL Translation Gaps

The current in-memory service and candidate SQL do not share an executable record contract. Examples include `choices[]` versus SQL choice columns, `source_ids` versus `source_record_ids`, nested manifest hashes versus required top-level SQL columns, and synthetic records that omit SQL-required ownership/version fields.

A database repository must therefore define explicit typed translations and transactions. It must not spread arbitrary object keys into SQL columns or rely on the in-memory repository as proof of datastore behavior.

## Rollback and Reapply

Rollback is a forward compensating operation:

- Disable internal and consumer flags through the authoritative flag store.
- Deploy the last known-good app through GitHub.
- Re-promote the prior good immutable release where content rollback is required.
- Preserve audit, source hashes, revisions, releases, and migration history.
- Verify application behavior after rollback.
- Reapply the candidate migration and app artifact in preview and rerun the complete suite.

The existing `db/rollback/0001_compensating_disable.sql` is design material only and is not rollback proof.
