# I1Q-1007X Rollback Results

Date: 2026-07-15

Result: `NOT RUN. NOT PROVEN.`

## Scope Completed

Audited available rollback artifacts and prior claims using read-only local inspection. No rollback, compensation, reapply, database connection, runtime action, or flag change was performed.

## Evidence Inspected

- DR-006 rollback clause.
- 1006 combined handoff rollback sections.
- Current deployment route map and protected runtime comparison.
- `i1q-question-platform/db/rollback/0001_compensating_disable.sql`.
- `i1q-question-platform/evidence/rollback_manifest.json`.
- `i1q-question-platform/db/migrations/20260715122434_i1q_1007x_question_platform.sql`.

## Findings

| Check | Result |
| --- | --- |
| Offline flag-disable SQL exists | YES, design only |
| Evidence manifest truthfully labels execution | YES, `DESIGNED_NOT_EXECUTED` |
| New migration references forward compensation | YES |
| Referenced `20260715122435` compensation file exists | NO |
| Canonical GitHub rollback workflow exists | NOT PROVEN |
| Last known-good I1Q deployed artifact exists | NO |
| Preview rollback executed | NO |
| Staging rollback executed | NO |
| Production rollback executed | NO |
| Reapply executed | NO |
| Post-rollback RLS and auth tests executed | NO |
| Post-rollback protected-product tests executed | NO |
| Monitoring during rollback proven | NO |

The old rollback SQL and manifest cannot be promoted as executed proof. The newer offline migration candidate is incomplete as a pair because its named forward compensation file is absent.

## What Was Not Run

No backup, feature-disable action, SQL, migration, artifact redeploy, protected runtime rollback, health check against a deployed I1Q service, dependent-product smoke, monitoring check, or reapply was run.

## Changes Proposed Or Made

Made only this results report. Proposed no execution while State C is vetoed. The missing compensation file and route belong to the Architecture/Data and Root owners, not this report scope.

## Tests Performed

- Local application suite: FAIL, 134 of 144 pass.
- Focused suite: FAIL, 107 of 114 pass.
- Evidence validation: FAIL, 13 errors.
- Rollback execution tests: NONE.

## Risks

A static disable script could be mistaken for a tested rollback. Manual application would violate the required GitHub and migration controls. Reusing tracked protected consumer files could regress live behavior because their hashes diverge.

## Blockers

No canonical route, no deployed I1Q artifact, no complete current compensation pair, no database target proof, no executed rollback, no reapply, and no post-rollback dependent baseline.

## Confidence

High, `0.99`, that rollback has not been executed or proven.

## Exact Paths

- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/i1q-question-platform/db/rollback/0001_compensating_disable.sql`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/i1q-question-platform/evidence/rollback_manifest.json`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/i1q-question-platform/db/migrations/20260715122434_i1q_1007x_question_platform.sql`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/agents/ecosystem_mapper/deployment_route_map.md`

## Root Handoff

Root must report rollback status as `DESIGNED_NOT_EXECUTED`, not green. Preserve all flags off and schedule no drill until the canonical route and complete compensation pair are approved.
