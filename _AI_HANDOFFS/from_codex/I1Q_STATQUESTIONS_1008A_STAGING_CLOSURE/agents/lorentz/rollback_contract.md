# I1Q Rollback Contract

Contract ID: `I1Q-ROLLBACK-v1`

Status: `FORWARD COMPENSATION VERIFIED LOCALLY, PREVIEW EXECUTION OPEN`

## Fixed Compensation Candidate

| Field | Observed value |
| --- | --- |
| File | `i1q-question-platform/db/rollback/20260715122435_i1q_1007x_compensating_disable.sql` |
| SHA-256 | `25e317428ca75c8cce29269e19c7002ea69860080aac7f59496312bbed34446a` |
| Compensation ID | `20260715122435` |
| Behavior | disables all six I1Q feature flags |
| Data behavior | preserves all rows and immutable history |
| Repeat behavior | one compensation record and one audit event per compensation ID |
| Destructive SQL | none observed |
| Preview or staging execution count | 0 |

## Authority Ruling

DR-006 requires a reviewed forward compensating migration, preservation of audit, source hashes, immutable revisions, and release evidence, and no migration-history rewrite. MR-078A prohibits false history repair. Production rollback is outside Lorentz scope and I1Q-1008A production migration is prohibited.

## Important Acceptance Conflict

The 1008A ticket also asks rollback verification to show that the schema returns to the exact prior state with no I1Q objects. The authorized candidate does not do that. It disables behavior while retaining the additive schema and all data.

`OPEN`: Root must resolve which rollback acceptance statement governs State B evidence.

`PROPOSED DEFAULT`: follow DR-006 and treat rollback as behavior disable plus application artifact rollback, with schema and history preserved. Do not invent a destructive schema-removal migration.

Until Root records that interpretation, no execution may be labeled a complete rollback rehearsal for State B.

## Observed In-Flight 1008A Compensation Set

`OBSERVED IN-FLIGHT`: the shared worktree now contains a follow-on compensation that revokes `i1q_runtime` from Supabase `authenticated`, records the compensation, and preserves the schema and data. A paired reapply candidate restores only that role membership and keeps every I1Q feature flag false.

`OPEN`: neither file is owner-ratified, canonical, applied, or rehearsed. The files do not resolve the exact-prior-schema conflict, and restoring the identity capability is not the same as restoring application behavior.

## Rollback Layers

These layers are separate and require separate evidence:

| Layer | Action | Authority |
| --- | --- | --- |
| Traffic | stop new I1Q requests or keep internal flags off | deployment owner and Root |
| Application | restore last known-good authenticated I1Q artifact through canonical GitHub deployment | deployment owner and Root |
| Database behavior | apply the fixed forward compensation through the canonical migration workflow | RANKLISTIQ owner and Root |
| Data | preserve all I1Q tables, immutable revisions, review evidence, audit chains, hashes, and migration history | DR-006 |
| Consumers | keep student, STAT, and Drills flags false | DR-006 and product passport |

A database compensation does not prove application rollback. An application rollback does not prove database compensation.

## Preconditions

Every precondition must pass before preview execution:

- exact non-production target and database fingerprint recorded
- primary migration and compensation are present in canonical history with matching hashes
- backup or restore point identity recorded
- before-state schema, grants, policies, row counts, feature flags, audit head, and migration history checksummed
- current app artifact and last known-good app artifact identified by immutable digest
- rollback operator and incident owner assigned
- monitoring and stop criteria active
- no protected dependent system mutation is part of the run
- acceptance conflict above resolved by Root
- no secret value enters evidence

## Forward Compensation Execution

Root invokes only the canonical GitHub migration workflow. The compensation runs with migration or rollback operator authority and no application actor UUID.

The runtime role cannot execute `i1q.disable_i1q_behavior`.

Any target mismatch, unexpected history, changed checksum, non-null user actor, duplicate unexpected record, SQL error, or unrelated drift stops the operation.

## Post-Compensation Proof

Required results:

- all six I1Q feature flags are false
- one `compensation_records` row exists for compensation ID `20260715122435`
- one authoritative `i1q_behavior_compensated` audit event exists for that ID
- every I1Q table still exists when forward-preserving semantics are used
- immutable row counts and content hashes are unchanged
- audit chain continuity is unchanged except the one expected event
- migration history is append-only and includes the compensation version
- `PUBLIC`, `anon`, and `authenticated` remain denied
- runtime role privileges are no broader
- application health reflects disabled behavior without leaking internals
- dependent STAT, Arena, Drills, Daily Rounds, Matrix, HQ, and WordPress behavior is unchanged or honestly untested

Applying the same compensation again must keep flags false and must not create a second compensation row or audit event for the same ID.

## Reapplication And Recovery

The fixed 1007X primary migration is idempotent, but reapplying it after compensation does not enable feature flags because existing flag rows are preserved. Therefore reapplying the primary file alone is not functional recovery.

The in-flight 1008A reapply candidate supplies a source-level path for restoring only the proposed authenticated identity capability. It deliberately leaves all feature flags false. It is not yet an authorized forward re-enable mechanism and cannot establish full application recovery.

`OPEN`: no authority-ratified forward recovery mechanism exists.

`PROPOSED DEFAULT`: recovery requires all of the following, each separately approved:

1. deploy the corrected application artifact through GitHub
2. rerun migration, RLS, auth, security, and dependent-system gates
3. create a new forward migration or authority-approved control action for only the internal flags that may be enabled
4. keep student, STAT, and Drills consumer flags false
5. record a new audit and release decision

No operator updates feature flags manually in production or preview SQL.

## Closed Rollback Manifest

The future execution manifest contains exactly:

```text
schema_version
ticket
environment
project_id
preview_target_id
database_fingerprint
primary_migration_version
primary_migration_sha256
compensation_version
compensation_sha256
before_state_sha256
backup_id
application_before_digest
application_rollback_digest
workflow_run_id
operator
started_at
finished_at
result
flags_after
schema_after_sha256
history_after_sha256
audit_event_id
compensation_record_id
dependent_checks
recovery_authority
evidence_sha256
```

Rules:

- `schema_version` is `i1q.rollback-manifest.v1`.
- `environment` is `preview` or `staging`.
- `result` is one of `passed`, `failed`, or `aborted`.
- `flags_after` contains all six exact flag names and every value is false.
- `dependent_checks` uses only `passed`, `failed`, `blocked`, or `not_run`, each with an evidence reference.
- `recovery_authority` is null until a forward re-enable path is ratified.
- unknown keys fail validation.
- secrets, tokens, cookies, raw student data, raw source material, and answers are forbidden.

## Failure Handling

- Do not retry a failed migration command without root-cause analysis.
- Do not edit or repair migration history.
- Do not drop schema, tables, columns, policies, or functions.
- Do not delete compensation or audit rows.
- Do not force push, use manual production SQL, or use an ad hoc provider command.
- If the compensation partially applies, stop traffic and escalate under MR-078A. Do not loop.
- If the application artifact rollback fails, keep database behavior disabled and report the environment unavailable.

## Open Authority Gaps

| ID | OPEN gap | Proposed default, not policy |
| --- | --- | --- |
| `RB-OPEN-01` | Preview target and canonical workflow | RANKLISTIQ owner provides both. |
| `RB-OPEN-02` | Rollback acceptance conflict | Behavior-disable and history-preserving compensation governs under DR-006. |
| `RB-OPEN-03` | Last known-good staging artifact | First successful staging release records an immutable artifact digest before canary. |
| `RB-OPEN-04` | Forward re-enable mechanism | New reviewed migration or authority-approved flag service, never manual SQL. |
| `RB-OPEN-05` | Monitoring and operator runbook | Register alerts, owner, stop criteria, and evidence capture before rehearsal. |
| `RB-OPEN-06` | In-flight runtime reapply candidate | Ratify or reject it with the runtime-role model; treat it only as identity-capability recovery while flags remain false. |

## Current Verdict

`STATIC_COMPENSATION_ACCEPTABLE_FOR_OWNER_REVIEW`

`PREVIEW_ROLLBACK_NOT_EXECUTED`

`FUNCTIONAL_REENABLE_PATH_OPEN`

`IN_FLIGHT_RUNTIME_REAPPLY_NOT_RATIFIED`
