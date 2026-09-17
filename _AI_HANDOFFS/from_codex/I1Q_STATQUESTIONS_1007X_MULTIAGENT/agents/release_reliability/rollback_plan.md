# I1Q-1007X Rollback Plan

Date: 2026-07-15

Status: `OFFLINE DESIGN ONLY. NO EXECUTABLE ROLLBACK ROUTE PROVEN.`

## Scope Completed

Separated application rollback, feature-disable compensation, datastore forward compensation, protected-product preservation, and release reapplication into a future operator plan. No rollback was executed.

## Evidence Inspected

DR-006 rollback ruling, MR-078A and MR-079, the 1006 rollback and staging reports, the current deployment map, protected comparison, `0001_compensating_disable.sql`, the untracked offline 1007X migration candidate, and rollback evidence manifest.

## Findings

Rollback is an offline design only. No last known-good I1Q deployment, GitHub rollback job, complete current compensation pair, staging drill, dependent-product post-check, or release reapply is proven.

## Rollback Invariants

- Preserve audit events, source hashes, immutable revisions, release evidence, sealed packs, historical attempts, and migration history.
- Never use migration repair, manual production SQL, destructive schema reset, force push, `railway up`, direct runtime replacement, ad hoc upload, or undocumented cache changes.
- Never use tracked Arena, STAT, Drills, or Daily bytes as rollback artifacts until their divergent deployed hashes are reconciled.
- Keep `internal_platform_enabled`, `internal_review_enabled`, `student_content_enabled`, `student_release_enabled`, `stat_adapter_enabled`, and `drills_adapter_enabled` false.

## Future Operator Sequence

1. Declare the incident through the owner-approved incident route and freeze further promotions.
2. Verify the affected commit, artifact hash, migration version, feature-flag snapshot, and last known-good I1Q artifact from the deployment manifest.
3. Through the registered GitHub rollback job, disable all I1Q flags using the audited application control path. Do not issue manual SQL.
4. Verify internal I1Q behavior is unavailable or safely disabled while health, auth denial, and protected dependencies remain intact.
5. Redeploy the exact last known-good I1Q application artifact through GitHub. No last known-good I1Q production artifact currently exists, so this step cannot yet execute.
6. If schema behavior must be disabled, review and promote a new forward compensating migration through preview, staging, and production. Do not reverse migration history.
7. Run I1Q health, auth, RLS, answer-isolation, source-isolation, audit-chain, and feature-flag checks.
8. Run Matrix, Arena, STAT, Drills, Daily Rounds, WordPress auth, HQ, and RANKLISTIQ dependent-product checks against owner-certified baselines.
9. Confirm monitoring is healthy and alert delivery works.
10. After root-cause repair, reapply the intended release through the same GitHub preview, staging, and production sequence and rerun every check.
11. File rollback and reapply manifests with exact commits, artifacts, migrations, timestamps, checks, operators, and outcomes.

## Offline Compensation Versus Executed Rollback

`i1q-question-platform/db/rollback/0001_compensating_disable.sql` is a local SQL design that updates known feature flags to false and preserves data. Its evidence manifest says `DESIGNED_NOT_EXECUTED`. It is not proof of staging or production rollback and is not an approved manual SQL instruction.

The newer offline migration candidate names `20260715122435_i1q_1007x_compensating_disable.sql`, but that file was not present during inspection. Therefore the newer design does not have a complete forward compensation pair.

## Trigger Conditions

Rollback is mandatory for failed health, authentication regression, unauthorized role access, answer or source leakage, broken audit integrity, migration mismatch, RLS bypass, unexpected protected-product regression, artifact hash mismatch, or missing monitoring after promotion. Exact rate thresholds require an observed staging baseline and owner approval and are not invented here.

## Changes Proposed Or Made

Made only this plan. Proposed a future GitHub-controlled rollback and reapply path. No SQL, workflow, flag, application, cache, or runtime file was changed.

## What Was Not Run

No backup, flag disable, migration, SQL, artifact rollback, protected-product check, monitoring check, or release reapply was run.

## Tests Performed

No rollback test was performed. Local tests and evidence validation failed before rollback certification. Historical static rollback checks do not count as execution.

## Risks

- No I1Q last known-good deployed artifact exists.
- No canonical rollback job or target is registered.
- The current forward compensation file referenced by the new migration is absent.
- Protected consumer rollback source is unresolved because all four tracked-to-runtime hashes diverge.

## Blockers

Missing workflow, destination, artifact identity, monitoring target, complete compensation migration, executed staging drill, post-rollback dependent tests, and reapply proof.

## Confidence

High, `0.98`, in the rollback invariants and future ordering. Confidence is `0.00` that rollback is currently executable.

## Exact Paths

- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/i1q-question-platform/db/rollback/0001_compensating_disable.sql`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/i1q-question-platform/evidence/rollback_manifest.json`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/i1q-question-platform/db/migrations/20260715122434_i1q_1007x_question_platform.sql`
- `/Users/brianb/MissionMed_OS/decisions/DR-006_i1q_question_platform_internal_integration.md`

## Root Handoff

Root must reject any rollback claim until a complete forward compensation migration, GitHub rollback job, last known-good artifact, staging execution, dependent-product post-check, and release reapply are proven on one fixed commit.
