# I1Q-1007X Integrated RLS Test Matrix

## Current Scope

This matrix reviews the offline timestamped migration, compensating migration, and PostgreSQL repository. It does not claim that any SQL was applied.

## Matrix

| ID | Database attack | Expected | Current evidence | Result |
| --- | --- | --- | --- | --- |
| RLS-001 | PUBLIC reads schema or table | Permission denied | Explicit revokes | PASS static |
| RLS-002 | `anon` reads or writes | Permission denied | Conditional all-object revokes | PASS static |
| RLS-003 | `authenticated` reads or writes | Permission denied | Conditional all-object revokes | PASS static |
| RLS-004 | Caller sets old `app.actor_id` or `app.actor_roles` | No authority gained | No such GUC path; `auth.uid()` plus membership rows | PASS static |
| RLS-005 | Every table has enabled and forced RLS | All 51 tables protected | Exact inventory tests | PASS static |
| RLS-006 | Read-only user sees unapproved revision | No row | Policy requires approved state | PASS static, NOT RUN in PostgreSQL |
| RLS-007 | Reviewer sees another assignment | No row | Assignment-scoped policy | PASS static, NOT RUN in PostgreSQL |
| RLS-008 | Author reads another author's answer | Deny | Purpose-scoped function checks author ID | PASS static, NOT RUN in PostgreSQL |
| RLS-009 | Revoked reviewer reads assigned answer | Deny | Assignment branch omits active-role and credential checks | FAIL static |
| RLS-010 | Ordinary admin reads answer table directly | No row or deny | No direct policy | PASS static, NOT RUN in PostgreSQL |
| RLS-011 | Privacy officer reads restricted source through approved RPC | Allow and audit | Active role and purpose checks | PASS static, NOT RUN in PostgreSQL |
| RLS-012 | Non-privacy actor reads restricted source | Deny | Active role and purpose checks | PASS static, NOT RUN in PostgreSQL |
| RLS-013 | Runtime role calls audit append directly | Deny | Runtime grant is absent; future test role revokes function | PASS design, runtime role unresolved |
| RLS-014 | Runtime role calls compensation directly | Deny | Runtime grant is absent; future test role revokes function | PASS design, runtime role unresolved |
| RLS-015 | Table owner or `BYPASSRLS` serves application traffic | Impossible | Runtime role not defined | NOT PROVEN |
| RLS-016 | Pooled connection carries prior actor | No identity bleed | `auth.uid()` checked per transaction, but no provider test | NOT RUN |
| RLS-017 | Concurrent review writes | One exact event and valid assignment transition | Locks and unique constraints present | NOT RUN |
| RLS-018 | Concurrent promotion writes | One valid promotion sequence | Unique constraint exists, behavior untested | NOT RUN |
| RLS-019 | Artifact policy mismatch | Reject channel, phase, class, or policy mismatch | Creation function does not bind these fields | FAIL static |
| RLS-020 | Pre-answer payload includes answer material | Reject before storage | SQL artifact function has no Class A validator | FAIL static |
| RLS-021 | Publish with student content flag off | Deny | SQL checks only student release flag | FAIL static |
| RLS-022 | Apply, exact reapply, compensate twice, reapply | Preserve state and stay disabled | Test exists but was skipped | NOT RUN |
| RLS-023 | Validate release with one arbitrary check ID | Deny unless every official leak check is bound to stored results | Any nonempty passing list is accepted | FAIL static |
| RLS-024 | Assemble with expired rights record | Deny | `expires_at` is not checked | FAIL static |
| RLS-025 | Author or reviewer reads unrelated metadata | Deny outside own lineage or assignment | Shared metadata policy is table-wide | FAIL static |
| RLS-026 | Two concurrent compensations use one ID | One audit event | No unique key protects the check-then-append sequence | NOT PROVEN, static race present |
| RLS-027 | Update Source Record, Privacy Redaction Record, or Extraction Run | Deny as immutable | Tables are absent from immutable trigger inventory | FAIL static invariant |

## Findings

The migration is materially safer than the historical candidate. Identity is grounded in `auth.uid()`, role membership is database-owned, all tables are forced-RLS, direct client grants are absent, and answer and raw-source tables have no direct read policy.

Three security defects remain in the SQL contract:

1. An accepted or completed reviewer assignment authorizes answer access without confirming that the reviewer still has the active required role or a current medical credential.
2. Artifact creation does not bind the chosen security policy to channel, phase, or data class and does not validate Class A payloads.
3. Publication does not require `student_content_enabled` in addition to `student_release_enabled`.

Additional release defects remain: arbitrary validation check IDs can authorize a pass, expired rights are not rejected, metadata reads are broader than the binding role sketch, compensation audit idempotence is not concurrency safe, and several architecture-immutable records lack table-level immutable triggers.

The stronger application actor-separation checks also are not fully mirrored in SQL ratification and publication.

## Changes

None. SQL, repository, and tests were read-only.

## Tests

Migration and repository checks passed in isolation. The current integrated focused run has six application review-workflow failures and one skipped PostgreSQL case. A fake-client repository suite cannot prove RLS.

## Risks And Blockers

No canonical unprivileged runtime role, grant manifest, project-pinned migration path, preview database, ownership proof, or rollback execution exists. Static success is insufficient for State C.

## Confidence

High, `0.96`, for the static findings. No confidence claim is made for PostgreSQL execution or provider configuration.

## Paths

- `i1q-question-platform/db/migrations/20260715122434_i1q_1007x_question_platform.sql`
- `i1q-question-platform/db/rollback/20260715122435_i1q_1007x_compensating_disable.sql`
- `i1q-question-platform/src/postgres-repository.mjs`
- `i1q-question-platform/tests/migration-1007x.test.mjs`
- `i1q-question-platform/tests/postgres-migration.test.mjs`
- `i1q-question-platform/tests/postgres-repository.test.mjs`

## Root Handoff

Root should repair RLS-009 and RLS-019 through RLS-027 in the generator or authoritative migration source, add negative and concurrency tests, and only then run the full role matrix on an owner-approved disposable RANKLISTIQ-compatible PostgreSQL target.
