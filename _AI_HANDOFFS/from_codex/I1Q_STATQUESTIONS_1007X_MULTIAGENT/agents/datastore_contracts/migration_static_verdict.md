# I1Q-1007X Migration Static Verdict

## Verdict

VERIFIED: PASS for the offline static contract.

UNKNOWN: NOT PROVEN for live or disposable PostgreSQL execution.

## Static Findings

VERIFIED: The forward migration is wrapped in `BEGIN` and `COMMIT`, records version `20260715122434`, and refuses a pre-existing unversioned `i1q` table estate.

VERIFIED: The migration declares 51 tables. Its RLS inventory contains the same 51 unique table names, with both `ENABLE ROW LEVEL SECURITY` and `FORCE ROW LEVEL SECURITY` applied through the guarded loop.

VERIFIED: No executable `GRANT` statement exists. The migration revokes schema, table, sequence, and function privileges from `PUBLIC`, revokes default privileges, and conditionally revokes all access from `anon` and `authenticated`.

VERIFIED: Actor identity is derived from `auth.uid()`. Active role resolution reads database-owned `actor_role_memberships` and checks revocation and validity windows. The timestamped migration contains no caller-controlled `current_setting`, `set_config`, `app.actor_id`, or `app.actor_roles` authority path.

VERIFIED: All six declared feature flags are seeded `false`:

- `internal_platform_enabled`
- `internal_review_enabled`
- `student_content_enabled`
- `student_release_enabled`
- `stat_adapter_enabled`
- `drills_adapter_enabled`

VERIFIED: Student publication additionally requires the exact Brian publication authority record and an enabled `student_release_enabled` flag.

VERIFIED: Answer-bearing fields are absent from `item_revisions` and stored in `item_revision_answers`. That answer table has no direct select policy. Access is routed through a purpose-scoped, audit-appending security-definer function.

VERIFIED: `restricted_source_references` has no direct select policy. Its reader requires a privacy or system role, a closed purpose enum, existence of the target, and an appended audit event.

VERIFIED: The immutable trigger inventory contains 19 records, including `psychometric_snapshots`, item revisions and answer material, review events, source references, releases, export records, channel artifacts, and audit events.

VERIFIED: Release assembly statically binds exact revision hashes, credentialed medical approval records, current evidence claims, cleared rights, applicable privacy state, stable question identity, and item identity.

VERIFIED: The compensating migration invokes only `i1q.disable_i1q_behavior` with fixed compensation ID `20260715122435`. It contains no drop, truncate, delete, alter, update, or insert statement. The called function disables enabled flags, preserves data and history, and suppresses duplicate compensation audit events by compensation ID.

## Test Result

VERIFIED: The 13 migration-specific tests pass.

VERIFIED: The initial immutable-table test failed only because its expected list omitted the migration's valid `psychometric_snapshots` entry. The test expectation was corrected and the migration file was not changed by this worker.

## Residual Proof Gaps

UNKNOWN: PostgreSQL syntax, extension availability, `auth.uid()` availability, owner and `BYPASSRLS` semantics, security-definer behavior under forced RLS, policy execution, grants to the future runtime adapter role, and compensation execution remain untested against a database.

UNKNOWN: The migration intentionally provides no runtime grant. It is therefore not an application-ready deployment contract until the canonical unprivileged role and auth bridge are authorized and tested.

DO NOT TOUCH: This verdict does not authorize migration application, Supabase access, staging, production, runtime grants, or feature activation.
