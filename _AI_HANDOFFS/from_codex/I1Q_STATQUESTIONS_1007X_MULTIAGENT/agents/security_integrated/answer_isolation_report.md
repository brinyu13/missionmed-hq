# I1Q-1007X Integrated Answer Isolation Report

## Current Scope

This report examines ordinary reads, pre-answer output, post-answer finalization, database answer storage, restricted source storage, channel artifact creation, and feature-gate enforcement.

## Evidence

Positive local evidence:

- `item_revisions` is answer-free in the timestamped SQL.
- Answer, explanation, rationale, teaching, and voice-note fields are stored in `item_revision_answers`.
- The answer table and restricted source table have no direct select policy.
- Generic application responses recursively remove answer and rationale aliases.
- Class A generation uses closed-world schemas and a recursive key and value scanner.
- Post-answer access requires a WeakSet-bound trusted finalization context tied to actor, session, release, and channel.
- Synthetic tests reject caller phase strings, nonparticipants, nested answer aliases, and generic artifact reads.

## Findings

### ASI-001 Revoked reviewer retains SQL answer access

Severity: P1.

The assignment path in `i1q.read_item_revision_answers` accepts an `accepted` or `completed` assignment with the matching actor, review type, and revision hash. It does not call `i1q.has_active_role(assignment.required_role)`. A reviewer whose role membership was revoked or expired can therefore continue to read answers while the identity remains valid. Medical answer access also does not require the reviewer credential to remain current.

### ASI-002 Consumer flags do not gate application delivery

Severity: P1.

`artifactForPhase` enforces phase roles and finalization but does not check `stat_adapter_enabled` or `drills_adapter_enabled`. The independent synthetic probe returned a `stat_pre_answer` artifact while every release-restricted flag was false.

### ASI-003 SQL artifact creation permits security-label confusion

Severity: P1.

`i1q.create_channel_artifact` checks that a referenced policy exists and is active, but it does not bind the policy channel to the requested channel, phase, or data class. It stores arbitrary JSON without a Class A leak validator. A release manager or system path could create an answer-bearing payload labeled `pre_answer` and `A`.

### ASI-004 Runtime datastore isolation is not connected

Severity: P1.

The HTTP service constructs a `MemoryRepository` and never wires the PostgreSQL adapter. The strong SQL separation therefore cannot protect the current service process.

### ASI-005 Source metadata is not assignment scoped in memory

Severity: P1.

An unassigned `read_only` actor received a source record in the synthetic probe. Private storage fields were removed, which is positive, but the cross-record metadata exposure still disproves assignment-scoped isolation.

### ASI-006 Release validation does not prove leak tests

Severity: P1.

Both application and SQL validation paths accept any nonempty list whose caller labels as passing. They do not require the official leak-test identifiers, one result per artifact, or a stored result set bound to the evidence hash. Independent-actor and manifest checks therefore do not prove answer isolation.

## Changes

None. No artifact, answer, source, application, test, SQL, or feature-flag state was changed.

## Tests

The current focused integrated suite passed 112, failed 6, and skipped one database case. The independent attack probe reproduced the consumer flag and cross-record read failures. No real answer or transcript text was used.

## Risks And Blockers

Answer isolation is not cleared for staging or production. Required repairs are active-role and credential checks in the SQL answer reader, exact channel-policy binding with Class A validation, official stored validation checks, consumer-flag enforcement at the server and database boundaries, and wiring to the approved RLS repository.

## Confidence

High, `0.98`, for the local positive and negative findings. Database runtime behavior remains unknown.

## Paths

- `i1q-question-platform/src/platform.mjs`
- `i1q-question-platform/src/auth.mjs`
- `i1q-question-platform/src/exports.mjs`
- `i1q-question-platform/src/adapters/stat-v1.mjs`
- `i1q-question-platform/db/migrations/20260715122434_i1q_1007x_question_platform.sql`
- `i1q-question-platform/tests/security-regressions.test.mjs`
- `i1q-question-platform/tests/adapters.test.mjs`

## Root Handoff

Do not enable any consumer or student flag and do not claim no-answer-leak production proof. Repair ASI-001 through ASI-005, add revoked-role and mislabeled-payload tests, and repeat the test against the final database and HTTP deployment.
