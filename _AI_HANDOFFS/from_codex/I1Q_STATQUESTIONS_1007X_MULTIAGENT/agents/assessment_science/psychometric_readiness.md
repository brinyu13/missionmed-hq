# I1Q-1007X Psychometric Readiness

Date: 2026-07-15

Status: `NOT_READY, CONTRACT_SCAFFOLD_ONLY, NO_EMPIRICAL_DATA`

Medical approval: NOT ISSUED

## Scope Completed

This audit compares the binding Architecture 1004C psychometric contract with the current schema, service, tests, release evidence, and available attempt denominators. It evaluates future measurement readiness only. No student data, attempt row, source content, identity, medical item content, or empirical model output was inspected.

## Evidence Inspected

- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_fable/I1Q_STATQUESTIONS_1004C_ARCHITECTURE_AMENDMENT/I1Q_1004C_PSYCHOMETRIC_AND_QUALITY_GOVERNANCE.md`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_fable/I1Q_STATQUESTIONS_1004C_ARCHITECTURE_AMENDMENT/I1Q_1004C_COMBINED_HANDOFF.md`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/i1q-question-platform/db/migrations/0001_i1q_question_platform.sql`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/i1q-question-platform/src/contracts.mjs`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/i1q-question-platform/src/platform.mjs`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/i1q-question-platform/tests/platform.test.mjs`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/i1q-question-platform/tests/evidence-validator.test.mjs`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/i1q-question-platform/evidence/candidate_counts.json`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/i1q-question-platform/evidence/release_manifest.json`

## Findings

### Current Evidence State

- Real candidates: 0.
- Physician-approved revisions: 0.
- Release-eligible revisions: 0.
- Published revisions: 0.
- Real scored attempts, presentations, repeat pairs, and fixed-form completions: no evidence available.
- The current release manifest is explicitly a non-clinical contract fixture, not a release.

No percent correct, discrimination, distractor selection, omission, timeout, response-time, exposure, repeat-exposure, reliability, fairness, or calibration value may be reported.

### Contract Comparison

| Required capability | Current support | Readiness finding |
| --- | --- | --- |
| Immutable snapshot by Item Revision, release, channel, and window | SQL stores Item Revision and window only | BLOCKED. Release ID and channel are absent and no required uniqueness contract is present. |
| Percent correct with scored-attempt denominator | Generic `difficulty` field | BLOCKED. Metric meaning and denominator are not explicit. |
| Point-biserial discrimination | Generic `discrimination` field | PARTIAL SCHEMA ONLY. No form-total event contract, floor enforcement, or scorer exists. |
| Distractor selection shares | Generic JSON field | PARTIAL SCHEMA ONLY. Choice denominators, dead-option rule, and over-attractive rule are not enforced. |
| Omission and timeout rates | Not represented | NOT IMPLEMENTED. |
| Median and interquartile response time | Not represented | NOT IMPLEMENTED. |
| Exposure share | Not represented | NOT IMPLEMENTED. |
| Repeated-exposure effect | Not represented | NOT IMPLEMENTED. |
| One authoring and empirical flag queue | Candidate quality flag table exists | NOT WIRED. No service path connects snapshots to Item Revision re-review. |
| Volume-floor enforcement | Not represented | NOT IMPLEMENTED. |
| Fixed-form reliability | Not represented | NOT IMPLEMENTED. |
| STAT-specific non-reliability diagnostics | Not represented | NOT IMPLEMENTED. |
| Fairness preconditions and k floor | Not represented | NOT IMPLEMENTED. |
| Human-only retirement decision | Release and review workflows are human-gated | PARTIAL. No psychometric flag workflow proves the rule end to end. |

### Required Denominators

- Percent correct: correct scored attempts divided by scored attempts, minimum 100.
- Point-biserial: valid item scores paired with total score on the same assembled set, minimum 200.
- Distractor selection: selections of each distractor divided by non-omitted responses to that item, minimum 200. Also report omissions separately.
- Omission rate: skipped presentations divided by all valid presentations, minimum 100.
- Timeout rate: timed-out presentations divided by all valid presentations, minimum 100.
- Response time: median and interquartile range over valid response times, minimum 100, with exclusion rules frozen before computation.
- Exposure: distinct eligible active channel users presented the item divided by distinct eligible active channel users in the window. MVP is report-only.
- Repeated-exposure effect: within-student accuracy difference across qualifying first and repeat presentations, minimum 100 repeat pairs. The pairing and cooldown rules must be frozen.
- Fixed-form KR-20 or coefficient alpha: completed comparable forms, minimum 200 per exact form.
- Fairness comparison: only consented and lawful dimensions, comparable contexts, at least 50 per group, and privacy reporting at k at least 10.

Every snapshot must retain raw numerator and denominator counts, metric version, exclusion counts, window, release, channel, Item Revision hash, and computation hash. Point estimates without these fields are insufficient evidence.

## Changes Proposed Or Made

No application, migration, attempt data, or feature flag was changed. Proposed work is a versioned attempt-event contract, an Architecture 1004C-complete immutable snapshot schema, metric-specific numerator and denominator fields, volume-floor and validity validators, a unified re-review flag queue, fixed-form identity, privacy-safe repeat-pair support, and direct tests for invalid analyses.

## Tests Performed

- Read-only schema-to-architecture trace of every required metric and validity condition.
- Static search of current source and tests for psychometric metrics, exposure, reliability, fairness, Variant Group cooldowns, and flag-queue wiring.
- No attempt query, student-data access, empirical computation, reliability estimate, fairness analysis, or medical item review was performed.
- Post-write validation passed: exact six-file set, required report sections, zero forbidden Unicode dash characters, and zero trailing-whitespace lines. Both JSON companion reports parsed successfully with every required key.

## Risks

- A generic `difficulty` field may conflate authored difficulty with empirical percent correct.
- Missing release and channel identity can mix incomparable administrations.
- Missing floors can produce unstable or misleading flags.
- Classical reliability on short paired STAT packs would be invalid.
- Repeat-pair and fairness analytics can create privacy risk without purpose limitation and k-floor enforcement.
- Automatic retirement based on metrics would violate Architecture 1004C.

## Blockers

- No real released Item Revisions or attempts.
- Snapshot schema does not match the binding identity contract.
- Required metrics and denominators are incomplete.
- No computation service, floor validator, or immutable report path exists.
- No unified quality flag workflow exists.
- No consented fairness dimensions or valid group denominators exist.
- Assessment-science thresholds remain report-only until ratified.

## Confidence

High confidence in the readiness gap analysis. Empirical psychometric confidence is not applicable because no valid data or computed metrics exist.

## Exact Paths

- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/agents/assessment_science/psychometric_readiness.md`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/i1q-question-platform/db/migrations/0001_i1q_question_platform.sql`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_fable/I1Q_STATQUESTIONS_1004C_ARCHITECTURE_AMENDMENT/I1Q_1004C_PSYCHOMETRIC_AND_QUALITY_GOVERNANCE.md`

## Handoff

Root Supervisor should classify psychometrics as a future report-only capability, not a present release gate pass. Before any empirical claim, implement the complete identity and denominator contract, prove valid event capture, meet the volume floors, and route flags to human re-review without automatic retirement.
