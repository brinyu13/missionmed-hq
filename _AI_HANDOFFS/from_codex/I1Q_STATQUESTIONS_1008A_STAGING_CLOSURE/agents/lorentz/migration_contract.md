# I1Q Preview Migration Contract

Contract ID: `I1Q-MIGRATION-v1`

Status: `STATIC CANDIDATE VERIFIED, PREVIEW AUTHORITY OPEN`

## Purpose

This contract defines the evidence required before Root may apply the I1Q schema to an authorized RANKLISTIQ preview or staging database. Lorentz does not apply, copy, rename, repair, or deploy a migration.

## Fixed Candidate

| Field | Observed value |
| --- | --- |
| Source file | `i1q-question-platform/db/migrations/20260715122434_i1q_1007x_question_platform.sql` |
| SHA-256 | `0c2ca0c48436c7684b97ce88d6b7d518b0780c3e336ad1b5bfd457c4fd60b5e3` |
| Target declared in file | RANKLISTIQ, additive schema `i1q` |
| Tables | 52 |
| Transaction wrapper | present |
| Forced RLS | all candidate tables |
| Default feature flags | all six false |
| Runtime grants | deliberately absent |
| Current status | offline app-owned candidate |
| Preview or staging apply count | 0 |

The candidate is not yet a canonical Supabase migration. Its timestamp must be compared with actual target history before any filing or application. It must not be copied by hand into a shared migration directory.

## Observed In-Flight Follow-On Set

The shared worktree contains three additional 1008A SQL candidates:

| Candidate | Observed purpose | Current treatment |
| --- | --- | --- |
| `20260715193625_i1q_1008a_identity_runtime_contract.sql` | add a locked-off identity RPC and `i1q_runtime` capability role | `OBSERVED IN-FLIGHT`, unratified and unapplied |
| `20260715193845_i1q_1008a_compensating_disable.sql` | revoke the runtime capability and preserve schema, data, and history | `OBSERVED IN-FLIGHT`, unratified and unexecuted |
| `20260715193955_i1q_1008a_runtime_reapply.sql` | restore only the runtime identity capability while flags remain false | `OBSERVED IN-FLIGHT`, unratified and unexecuted |

These files do not replace the fixed 1007X base candidate or become canonical because they exist. Their timestamps, hashes, dependency order, capability-role design, `SECURITY DEFINER` ownership, search path, grant graph, and idempotence must pass M0 through M4 as one ordered set before any preview apply. The current fail-closed preview-target manifest remains unassigned and does not authorize an environment.

## Authority Constraints

- MR-078A controls naming, ordering, history integrity, transaction wrapping, pre-deploy checks, post-apply checks, and repair prohibitions.
- MR-078B selects RANKLISTIQ for STAT and I1Q question data and forbids project confusion.
- DR-006 authorizes an additive `i1q` schema, preview or staging first, forced RLS, deny by default, and forward-only compensation.
- MR-079 forbids migration repair, history editing, production reset, RLS bypass, and unapproved protected-system deployment.
- I1Q-1008A does not authorize a production database migration.

## Closed Migration Manifest

The apply candidate manifest contains exactly:

```text
schema_version
ticket
authority_ids
environment
project_id
project_name
preview_target_id
project_config_path
migration_directory
migration_filename
migration_sha256
latest_remote_version
history_before_sha256
schema_before_sha256
backup_id
rollback_contract_id
runtime_role_manifest_sha256
expected_object_inventory_sha256
feature_flag_defaults
requested_by
approved_by
prepared_at
```

Validation rules:

- `schema_version` is `i1q.migration-manifest.v1`.
- `ticket` is `I1Q-1008A` for the execution evidence even though the frozen source candidate was authored under I1Q-1007X.
- `authority_ids` is exactly the applicable set including `DR-006`, `MR-078A`, `MR-078B`, and `MR-079`.
- `environment` is `preview` or `staging`.
- `project_id` and `project_name` identify RANKLISTIQ exactly.
- `preview_target_id`, `project_config_path`, `migration_directory`, `latest_remote_version`, `backup_id`, and `approved_by` must be owner-provided, not inferred.
- the candidate timestamp is exactly 14 UTC digits, unique, later than remote history, and at least 60 seconds after the latest existing version
- all SHA-256 fields are lowercase 64-character hex
- all six feature flags are present exactly once and false
- unknown keys fail validation

## Gate Sequence

### Gate M0: Source Integrity

Required proof:

- branch and source commit match the 1008A baseline
- migration file hash matches the fixed candidate
- file remains unmodified after independent validation
- dependency `auth.uid()` and `pgcrypto` are present in the exact target environment
- target is PostgreSQL 15 or later

Failure result: `MIGRATION_SOURCE_INTEGRITY_FAILED`.

### Gate M1: Canonical Route

Required proof:

- RANKLISTIQ owner identifies the project-pinned CLI configuration
- canonical migration directory is identified
- preview target ID is explicit
- canonical GitHub workflow is identified
- workflow identity and migration-owner role are identified
- no production target is selected

Current result: `OPEN`.

Failure result: `MIGRATION_ROUTE_NOT_AUTHORIZED`.

### Gate M2: History And Ordering

Required proof:

- read-only migration list captured
- every remote applied version has its matching canonical file
- no canonical file expected to be applied is missing remotely
- no reverted entry exists
- no duplicate or malformed timestamp exists
- new timestamp is strictly ordered and at least 60 seconds later
- history backup hash recorded before any action

Any mismatch stops. No repair loop is permitted.

### Gate M3: Diff And Dependency Review

Required proof:

- project-pinned diff contains only the expected additive `i1q` objects
- no object outside `i1q` changes except an explicitly ratified runtime capability role and approved dependency grants
- no existing STAT, Arena, Drills, Daily Rounds, Matrix, auth, `dataset_questions`, or migration-history object changes
- expected object inventory independently hashed
- runtime role manifest is exact and reviewed

### Gate M4: Backup And Rollback Readiness

Required proof:

- preview backup identity exists and restoration authority is known
- schema and migration-history checksums are recorded
- forward compensation hash matches `rollback_contract.md`
- application rollback artifact is identified separately
- operator and monitor contacts are assigned
- rollback acceptance semantics are resolved by Root

The current compensation preserves schema and data. It is not proof that schema can return to an absent pre-I1Q state.

### Gate M5: Preview Apply

Root alone may invoke the canonical workflow after M0 through M4 pass. The workflow must apply one reviewed migration in strict order without force, repair, reset, or manual SQL.

Required captured result:

- workflow run ID and immutable commit
- environment and non-secret database fingerprint
- applied version and filename
- migration-history checksum after apply
- schema checksum after apply
- exact object inventory after apply
- feature-flag values
- runtime grant inventory
- start, finish, and duration

### Gate M6: Post-Apply Validation

Required proof:

- migration list contains the exact applied version
- project-pinned diff has no unexpected drift
- all 52 tables exist
- every candidate table has RLS enabled and forced
- `PUBLIC` and `anon` have no I1Q privileges
- `authenticated` has no I1Q privilege unless Root ratifies the capability-role model, in which case its complete effective privilege is exactly schema `USAGE` plus `EXECUTE` on the self-profile RPC and no table or other function access
- feature flags remain false
- unprivileged runtime role has only the exact approved grants
- anonymous, role, assignment, answer, source, audit, and feature-flag attacks fail closed
- no dependent project object or data changed

Static or disposable local proof cannot satisfy M5 or M6.

## Migration Repair Rules

- No agent may use `migration repair` under this contract.
- No actor may edit `supabase_migrations.schema_migrations` directly.
- No applied migration may be renamed, edited, deleted, squashed, or backdated.
- Any unexpected history, target, object, or diff state is an immediate stop and owner escalation.
- A correction after application is a new forward migration with its own authority and evidence.

## Environment Validation

The selected environment passes only when:

- it is non-production
- project identity is RANKLISTIQ, not Growth Engine or Scheduler Staging
- the target branch is dedicated or otherwise explicitly approved for I1Q
- the migration workflow is project-pinned and GitHub-controlled
- secrets are referenced by presence and owner only, never value
- database role is not service role, owner, superuser, or RLS bypass
- source, branch, workflow, migration, role manifest, and rollback artifacts are immutable and checksummed
- no current consumer or student flag is enabled

## Open Authority Gaps

| ID | OPEN gap | Proposed default, not policy | Effect |
| --- | --- | --- | --- |
| `MIG-OPEN-01` | Canonical RANKLISTIQ migration directory | Owner supplies a project-pinned I1Q path rather than copying into Growth Engine migrations. | Blocks filing and apply. |
| `MIG-OPEN-02` | Preview branch or database target | Dedicated RANKLISTIQ preview branch with synthetic data. | Blocks M1. |
| `MIG-OPEN-03` | GitHub workflow and migration identity | MR-078A-compliant project-pinned workflow using migration-owner credentials. | Blocks M1. |
| `MIG-OPEN-04` | Current remote migration history | Capture read-only through canonical workflow. | Blocks timestamp and sync proof. |
| `MIG-OPEN-05` | Runtime role manifest | Ratify `runtime_role_contract.md` and exact signatures. | Blocks M3 and M6. |
| `MIG-OPEN-06` | Rollback acceptance conflict | Treat forward behavior compensation as authoritative unless Root obtains a new ruling that permits schema removal. | Blocks rollback certification. |
| `MIG-OPEN-07` | In-flight 1008A follow-on set | Review and ratify or reject the ordered identity, compensation, and reapply candidates as a single bounded change. | Blocks follow-on filing and apply. |

## Current Verdict

`STATIC_CANDIDATE_ACCEPTABLE_FOR_OWNER_REVIEW`

`PREVIEW_APPLY_NOT_AUTHORIZED_OR_EXECUTED`
