# I1Q-1008A Rollback Execution

Owner: Release and Reliability

Product candidate: `fd7ddcd7688a0fc89cc4fc1320806220221046ae`

Status: `EXTERNAL ROLLBACK NOT_RUN`

This is the canonical execution record and runbook for the first staging rollback rehearsal. It is not authorization to run it.

## Rollback Semantics

The authorized datastore rollback model is forward compensation, not destructive reversal.

Rollback has separate layers:

| Layer | Canonical action | Preserved state |
| --- | --- | --- |
| Traffic | Stop new I1Q staging traffic or keep the service unavailable | Evidence and logs |
| Application | Redeploy the immutable last-known-good I1Q artifact through the canonical GitHub route | Deployment history |
| Database capability | Apply a new forward compensation through the canonical migration workflow | Schema, data, audit, and migration history |
| Identity capability | Remove browser inheritance of the caller-scoped identity profile | Role objects and records |
| Application runtime | Keep the application-runtime role deny-all and unassigned | No runtime capability exists to retain |
| Feature controls | Prove every I1Q feature control false | Flag history and audit evidence |
| Consumers | Keep student, public, STAT, Drills, extraction, physician enablement, and publication closed | Protected consumer state |

The expected compensated state intentionally retains the additive `i1q` schema and immutable records. It must not be described as an exact return to a schema-absent state.

## Current Candidate

The current first-cycle compensation candidate:

- revokes the identity-profile capability from the built-in authenticated role;
- removes I1Q schema, table, sequence, and function privileges from both I1Q capability roles;
- validates the resulting closed role graph;
- invokes the data-preserving disable function;
- appends one compensation version while preserving history;
- performs no drop, truncate, deletion, history repair, or feature enablement.

Existing reports describe successful repeated execution against disposable local PostgreSQL. Hosted compensation, provider restore, application rollback, and staging smoke are all `NOT_RUN`.

The hardened workflow now statically binds compensation to its exact operation, commit, SQL and workflow hashes, expected prehistory digest, and closed committed approval record. Its history gates require the base and identity versions, reject an already-applied compensation or reapplication, and prevent a later stage from collapsing into the compensation run. Evidence upload is permitted only after redaction succeeds. Focused tests and YAML/JSON parsing pass.

These controls reduce execution risk but are not rollback evidence. Real target prehistory capture, project-pinned schema diff review, provider backup verification, restore exercise, compensation, and disabled-state observation are all `NOT_RUN`.

For the exact candidate above, the corrected local estate passes 285 of 287 full-suite tests with 0 failures and 2 intentional database-target skips, 19 of 19 UI tests, 9 of 9 focused migration/workflow tests, and 20 of 20 evidence-validator files with claimed state `BLOCKED`. The local UX matrix reports zero root overflow across all reported workflow, state, mobile, and width-equivalent reflow cells. These results validate local candidate behavior only; they are not rollback execution evidence.

## Trigger Conditions

The release manager declares rollback for any of these conditions:

- authentication or authorization bypass;
- answer-bearing or restricted-source exposure;
- wrong-actor, wrong-assignment, or pooled actor-context leakage;
- unexpected migration history, schema, policy, role, or grant drift;
- any protected feature control enabled unexpectedly;
- audit append or chain failure;
- sustained readiness, database, or deployment failure during the release window;
- secret or protected-data exposure in application or evidence logs;
- failed security, accessibility, or dependent-system gate;
- inability to identify the exact deployed artifact or target;
- release manager or incident owner stop decision.

Security exposure, audit failure, migration drift, and rollback uncertainty are immediate triggers. No error-budget wait applies.

## Preconditions

Do not begin until all items pass:

1. The exact staging target, commit, application artifact, migration history, schema fingerprint, role graph, feature-control state, and audit head are recorded by digest.
2. The current deployment and last-known-good deployment are immutable and independently verified.
3. The first-cycle compensation file and workflow are part of the exact approved commit.
4. The compensation version is not already applied.
5. The provider backup and tested restore reference remain valid.
6. The canonical workflow, target protections, monitoring, and alert routing are operational.
7. Root, database owner, deployment owner, rollback operator, incident owner, security verifier, and Release and Reliability are present.
8. No secret, token, cookie, connection value, answer, source content, student data, or patient data appears in the execution record.

If the compensation version is already in history, stop. After a reapplication, another rollback requires a new reviewed forward compensation version. Reusing an applied file is not a new rollback.

## Execution Procedure

### R0 - Declare And Contain

- Incident owner records the trigger and start time using safe identifiers only.
- Deployment owner removes or blocks staging traffic through the approved route.
- Root freezes deployment, migration, and feature-control changes.
- Monitoring owner captures the pre-rollback dashboard and alert state.
- Release and Reliability confirms the target and evidence window.

Stop if containment changes any protected shared route or production system.

### R1 - Capture Before State

Capture and independently checksum:

- deployed artifact and configuration-version identifiers;
- migration list and append-only history;
- schema, object, policy, role, membership, ownership, and effective-grant inventories;
- all feature-control values;
- immutable-table row counts and content-hash summaries;
- audit head and compensation record count;
- application readiness and synthetic session result;
- dependent-system baseline;
- provider backup and restore-test references.

Any mismatch with the approved release baseline stops execution. Do not repair or normalize it during rollback.

### R2 - Application Rollback

- Deployment owner selects the immutable last-known-good application artifact.
- Root dispatches the canonical application rollback workflow.
- The provider promotes the existing artifact without rebuilding.
- Verify artifact digest, process startup, liveness, readiness, and safe unavailable or disabled behavior.

If application rollback fails, keep traffic contained and proceed to database compensation only when the incident owner and database owner agree that it reduces risk.

### R3 - Forward Database Compensation

- Database owner confirms the exact target, prehistory, backup, and compensation version.
- Root dispatches the canonical compensation operation.
- Migration owner executes only that forward operation through the protected workflow.
- No manual SQL, force, reset, repair, destructive reversal, or retry loop is allowed.
- Release and Reliability observes the run and records immutable identifiers and digests.

If the command or post-check fails, stop. Do not rerun until root cause and partial state are known.

### R4 - Post-Compensation Assertions

All assertions are mandatory:

- compensation version appears exactly once in append-only history;
- the compensation record and expected audit event each exist exactly once;
- every feature control is false;
- the authenticated role no longer inherits the identity-profile capability;
- both I1Q capability roles have no ownership or unexpected direct/effective privilege;
- application-runtime remains deny-all and browser-inaccessible;
- every I1Q table remains present with enabled and forced RLS;
- immutable data counts and content hashes match the before state;
- audit continuity is preserved with only expected appended events;
- answer and restricted-source direct reads remain denied;
- application readiness reports disabled or unavailable behavior truthfully;
- no protected dependent system changed.

The schema fingerprint is expected to change only for approved append-only history, audit, compensation, and grant-state effects. A semantic comparison, not naive byte equality, is required.

### R5 - Restore Exercise

Provider restore proof is separate from forward compensation:

- restore the approved backup only to the authorized disposable restore target;
- verify target identity before restore;
- compare migration history, schema, immutable data summaries, role graph, and audit head to the recorded backup state;
- destroy or quarantine the disposable restore target through the provider owner process after evidence capture.

Do not restore over staging as part of a normal successful compensation rehearsal. A real staging restore requires a separate incident decision.

### R6 - Post-Rollback Smoke And Closure

- Run the disabled-state subset of SM-01 through SM-22 in `staging_smoke_results.md`.
- Confirm unauthenticated and authenticated requests cannot reach governed workflows.
- Confirm monitoring, alerts, redaction, and dependent checks are healthy.
- Keep traffic contained until Security, database owner, and Release and Reliability sign the result.
- Record whether reapplication is authorized, blocked, or not requested.

## Failure Handling

- Never edit or repair migration history.
- Never drop the schema or protected records.
- Never reuse an applied compensation version for a later rollback.
- Never weaken RLS, grants, auth, or feature controls to make rollback pass.
- Never retry an unknown or partially applied operation.
- Preserve the complete redacted failure evidence and escalate to the database owner and incident owner.
- If redaction fails, do not upload the rejected artifact.

## Required Execution Record

| Field | Current value |
| --- | --- |
| Target class | `NONE` |
| Trigger | `NONE` |
| Application artifact before | `NONE` |
| Last-known-good artifact | `NONE` |
| Workflow run | `NONE` |
| Compensation applied | `NO` |
| Provider restore exercised | `NO` |
| Disabled state observed | `NO` |
| Post-rollback smoke | `NOT_RUN` |
| Independent signoff | `NONE` |

## Current Result

`ROLLBACK EXECUTION: NOT_RUN / BLOCKED`

Only source inspection and agent-reported disposable local proof exist. No result in this file supports a real preview or staging rollback claim.
