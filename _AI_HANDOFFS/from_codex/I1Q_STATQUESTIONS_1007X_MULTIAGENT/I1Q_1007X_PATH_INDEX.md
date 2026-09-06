# I1Q-1007X Path Index

## Package Root

`/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT`

All paths below are relative to that root unless an absolute path is shown.

## Root Reports

| Sequence | Path | Purpose |
| ---: | --- | --- |
| 1 | `I1Q_1007X_BASELINE.md` | Source integrity and starting state |
| 2 | `I1Q_1007X_EXECUTION_PLAN.md` | Ordered gates and state rules |
| 3 | `I1Q_1007X_AGENT_CHARTERS.md` | Specialist duties and restrictions |
| 4 | `I1Q_1007X_AGENT_OWNERSHIP_MATRIX.md` | Disjoint write scopes and status |
| 5 | `I1Q_1007X_MISSIONMED_OS_RECOVERY.md` | Preserved dirty state and recovery |
| 6 | `I1Q_1007X_REGISTRATION.md` | Canonical I1Q registration |
| 7 | `I1Q_1007X_AUTHORITY_DECISION.md` | DR-006 authority and protected boundaries |
| 8 | `I1Q_1007X_ECOSYSTEM_DEPENDENCIES.md` | Auth, datastore, deploy, media, and consumer map |
| 9 | `I1Q_1007X_PROTECTED_SYSTEM_COMPARISON.md` | Read-only runtime comparison and checksum divergence |
| 10 | `I1Q_1007X_FOUNDATION_REPRODUCTION.md` | Foundation reproduction and repairs |
| 11 | `I1Q_1007X_AUTH.md` | Local auth contract and canonical gap |
| 12 | `I1Q_1007X_DATASTORE.md` | Offline PostgreSQL candidate and proof |
| 13 | `I1Q_1007X_RLS.md` | Forced RLS design and remaining runtime gap |
| 14 | `I1Q_1007X_ROLLBACK.md` | Preserving compensation and operational gap |
| 15 | `I1Q_1007X_INTERNAL_APP.md` | Local internal review application |
| 16 | `I1Q_1007X_CORPUS_INVENTORY.md` | Point-in-time aggregate real source inventory |
| 17 | `I1Q_1007X_PRIVACY_NORMALIZATION.md` | Privacy model and blocked normalization |
| 18 | `I1Q_1007X_PILOT.md` | Pilot thresholds and no-run verdict |
| 19 | `I1Q_1007X_BATCH_EXTRACTION.md` | Batch gate and zero-candidate result |
| 20 | `I1Q_1007X_LEGACY_V4.md` | Static 845-row reconciliation |
| 21 | `I1Q_1007X_STAT_ADAPTER.md` | Frozen STAT projection and answer isolation |
| 22 | `I1Q_1007X_DRILLS_ADAPTER.md` | Explicit Drills source projection |
| 23 | `I1Q_1007X_SECURITY.md` | Integrated local security verdict |
| 24 | `I1Q_1007X_PERFORMANCE.md` | Local synthetic performance boundary |
| 25 | `I1Q_1007X_ACCESSIBILITY.md` | Local mechanics and missing real validation |
| 26 | `I1Q_1007X_UI_UX.md` | Pre-repair simulated score and current unknown score |
| 27 | `I1Q_1007X_RED_TEAM.md` | Fresh final-wave adversarial verdict |
| 28 | `I1Q_1007X_STAGING_CERTIFICATION.md` | Staging gate decision |
| 29 | `I1Q_1007X_PRODUCTION_DEPLOYMENT.md` | Production deployment truth |
| 30 | `I1Q_1007X_PRODUCTION_SMOKE.md` | Production smoke truth |
| 31 | `I1Q_1007X_MONITORING.md` | Monitoring plan and runtime gap |
| 32 | `I1Q_1007X_DEPENDENT_PRODUCTS.md` | Protected consumer impact |
| 33 | `I1Q_1007X_OPEN_HUMAN_ACTIONS.md` | Named owner actions |
| 34 | `I1Q_1007X_TRUE_BLOCKERS.md` | External hard stops and resolutions |
| 35 | `I1Q_1007X_PATH_INDEX.md` | This index |
| 36 | `I1Q_1007X_REPORT.md` | Final supervisor synthesis |
| 37 | `I1Q_1007X_COMBINED_HANDOFF.md` | Exact Markdown concatenation for Mission Control |

## Specialist Reports

| Directory | Scope |
| --- | --- |
| `agents/ecosystem_mapper/` | Repository and protected dependency map |
| `agents/avicenna_diagnostics/` | Reproduction, root causes, and regression record |
| `agents/darwin/` | Maintainability and local performance report |
| `agents/lorentz_security/` | Boundary contracts, adapters, and initial security work |
| `agents/medical_content/` | Non-approval medical safety audit |
| `agents/privacy_rights/` | Privacy, rights, and source access veto |
| `agents/security_integrated/` | Point-in-time integrated security attack report |
| `agents/assessment_science/` | Assessment quality and pilot requirements |
| `agents/ux_accessibility/` | Baseline UX and accessibility audit |
| `agents/ux_current/` | Pre-repair current-state UX audit and 5.87 score |
| `agents/release_reliability/` | Deployment, rollback, monitoring, and release veto |
| `agents/independent_red_team/` | Initial audit, iterative repair reruns, the failed `65bb52c` audit, and exact final `ba17e22` adversarial review |
| `agents/red_team/` | Final exact-object verification of `ba17e22`, including preserved IRT-009-H4 reproduction and closure |

Specialist reports are immutable point-in-time evidence. Some record defects that later root commits repaired. Final current-state rulings are in the root reports, evidence validator, independent Red Team, and supervisor report.

## Machine Evidence

`evidence/` contains the handoff-side JSON evidence. The identical validator inputs are under:

`/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/i1q-question-platform/evidence/`

The primary evidence commands are:

- `node scripts/generate_evidence.mjs`
- `node scripts/build_combined_handoff.mjs`
- `npm run validate`

## Implementation Candidate

| Path | Purpose |
| --- | --- |
| `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/i1q-question-platform/` | Dedicated local application candidate |
| `i1q-question-platform/db/migrations/20260715122434_i1q_1007x_question_platform.sql` | Offline forward migration candidate |
| `i1q-question-platform/db/rollback/20260715122435_i1q_1007x_compensating_disable.sql` | Preserving compensation candidate |
| `i1q-question-platform/openapi.json` | Local API contract |
| `i1q-question-platform/tests/` | Characterization, adversarial, and migration tests |

## Canonical External Authority

- MissionMed OS: `/Users/brianb/MissionMed_OS`
- Architecture: `_AI_HANDOFFS/from_fable/I1Q_STATQUESTIONS_1004C_ARCHITECTURE_AMENDMENT/I1Q_1004C_COMBINED_HANDOFF.md`
- Foundation: `_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1005_FOUNDATION_SLICE/I1Q_1005_COMBINED_HANDOFF.md`
- Prior build: `_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1006_ULTRA_BUILD/I1Q_1006_COMBINED_HANDOFF.md`
- STAT authority: `_SYSTEM/STAT_CANON_SPEC.md`

Historical untracked handoff directories outside the 1007X package remain excluded from this run's commits and combined handoff.
