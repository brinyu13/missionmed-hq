# I1Q-1007X Pilot Measurement Plan

Date: 2026-07-15

Status: `PROTOCOL_READY_FOR_RATIFICATION, REAL_PILOT_NOT_RUN`

Medical approval: NOT ISSUED

## Scope Completed

This plan defines a real, stratified extraction and item-development pilot, exact measurement units and denominators, confidence reporting, quality review, duplicate controls, and later post-release psychometric floors. It does not select sources, read source content, process student data, approve medical content, or claim observed performance.

## Evidence Inspected

- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_fable/I1Q_STATQUESTIONS_1004C_ARCHITECTURE_AMENDMENT/I1Q_1004C_TRANSCRIPT_PRIVACY_RIGHTS_AND_EXTRACTION_GATES.md`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_fable/I1Q_STATQUESTIONS_1004C_ARCHITECTURE_AMENDMENT/I1Q_1004C_PSYCHOMETRIC_AND_QUALITY_GOVERNANCE.md`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/I1Q_1007X_CORPUS_INVENTORY.md`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/I1Q_1007X_PRIVACY_NORMALIZATION.md`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/I1Q_1007X_PILOT.md`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/agents/privacy_rights/privacy_recall_precision.md`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/i1q-question-platform/src/privacy.mjs`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/i1q-question-platform/evidence/extraction_metrics.json`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/i1q-question-platform/evidence/candidate_counts.json`

## Findings

- The real inventory contains 97 sources, all multi-speaker, with 97 transcript artifacts and 97 nodes artifacts.
- No compliant working-redacted transcript exists and all 97 sources remain blocked before extraction.
- The technical pilot has selected 0 sources and produced 0 real candidates.
- The architecture requires 8 to 12 pilot recordings, at least three specialties, and coverage of both poles for transcript quality, speaker count, teaching style, age, and length.
- The observed inventory contains no single-speaker source. The single versus multi-speaker stratum cannot be satisfied from the current observed corpus. Root must expand authorized inventory or obtain a ratified protocol exception before selection. This condition must not be silently relabeled as passed.
- Medical-answer agreement and approval yield are not scorable until a credentialed physician reviews exact immutable revisions.

## Measurement Design

### Stage 0: Freeze The Protocol

Before source selection, freeze and hash the sampling frame, strata definitions, source eligibility query, annotation guide, adjudication rules, overlap rule, timestamp rule, scoring code, metric names, thresholds, exclusion reasons, and report schema. Record all later changes as new protocol versions.

### Stage 1: Privacy Gate

The privacy pilot is a prerequisite and is separate from the 8 to 12 source technical pilot. It must cover all 97 sources and every required privacy class using the minimum denominators and exact one-sided 95 percent lower-bound rules in the privacy specialist plan. No aggregate average may compensate for a missing class, a denominator shortfall, a non-Dr J leak, or a source-metadata leak.

### Stage 2: Stratified Source Selection

Select 8 minimum, target 10 to 12, privacy-cleared sources. Cover at least three specialties and both defined poles of transcript quality, teaching style, recording age, and duration. Resolve the unavailable single-speaker pole before selection. Publish only opaque source IDs, stratum flags, hashes, and counts in evidence artifacts.

### Stage 3: Gold Standard

For every selected source, independent editorial and credentialed physician labelers mark every genuine medical question, answer presence and span, speaker class, source boundaries, and redaction targets. They also adjudicate one tested concept, answer provenance, and whether a candidate is scorable. Store text and identities only in the restricted zone. Freeze adjudicated labels before the scored run.

### Stage 4: Technical Extraction Metrics

| Metric | Numerator | Denominator | Threshold and reporting rule |
| --- | --- | --- | --- |
| Question detection precision | System detections adjudicated as genuine medical questions | All system question detections, including rhetorical and logistical false positives | Provisional threshold at least 0.90. Report count and exact 95 percent interval. Denominator must be greater than 0. |
| Question detection recall | Gold genuine medical questions detected by the system under the frozen match rule | All adjudicated gold genuine medical questions | Provisional threshold at least 0.80. Report count and exact 95 percent interval. |
| Question-answer pairing accuracy | Detected questions with the correct gold answer-presence state and correct answer-span linkage | All detected gold-matched questions for which the system emits a pairing decision | Provisional threshold at least 0.85. Also report pairing coverage over all gold questions with an answer span. Do not drop unresolved decisions from the denominator. |
| Speaker attribution accuracy | Gold segments assigned the correct `verified_drj`, `likely_drj`, or `unknown` class | All gold segments receiving an attribution decision | Provisional threshold at least 0.95. Report a confusion matrix and per-class recall. Zero retained non-Dr J speech remains a separate hard privacy gate. |
| Timestamp accuracy | Matched question and answer spans whose start and end boundaries each fall within 2 seconds of gold | All matched spans with a gold boundary and a system boundary | Provisional threshold at least 0.90. Report question and answer spans separately plus pooled counts. Missing system spans fail the unit. |
| Medical-answer agreement | Scorable extracted answers that agree with credentialed physician verification on the exact concept and context | All extracted answers submitted for physician verification and adjudicated scorable | Provisional threshold at least 0.90. Report uncertain and conflicted cases separately and do not exclude them from pipeline yield. Not scorable until credentialed review exists. |
| Candidate approval yield | Exact Item Revisions approved after editorial and credentialed physician review | All unique candidate revisions that enter editorial review under the frozen pilot protocol | Measure, with provisional viability floor 0.30. Superseded revisions remain in the denominator once entered. Not scorable if medical review is unavailable. |
| Reviewer minutes per approved item | Total active editorial plus physician review minutes for pilot candidates | Approved exact Item Revisions | Measure, with provisional viability ceiling 20. If approved count is 0, report undefined plus total minutes, never 0. |

Report every metric overall, per source, and by predeclared stratum when the subgroup denominator is nonzero. Small-stratum values are descriptive only. Do not claim between-stratum differences without adequate volume.

### Stage 5: Authoring Quality Metrics

Every candidate entering review receives the ratified nine-dimension rubric. Report the count scored, missing-dimension count, dimension distributions, gate failures, disposition counts, and double-review agreement. Use raw exact agreement and weighted kappa only when at least two independent reviewers score the same ordinal dimension. Do not compute the weighted composite until the weights are ratified. Physician-only medical quality remains separate from editorial and assessment-science scores.

### Stage 6: Duplicate And Variant Controls

Before review and again before pilot release assembly, report:

- exact duplicate composite IDs divided by candidate revisions checked;
- exact content-hash duplicates divided by candidate revisions checked;
- adjudicated semantic sibling pairs divided by proposed pairs;
- candidates assigned to a Variant Group divided by candidates entering review;
- release sibling collisions divided by assembled pilot releases, with a required value of 0.

Semantic thresholds must be tuned only on a development set. Final precision and recall require a separate adjudicated duplicate gold set with explicit pair denominators.

### Stage 7: Post-Release Measurement

The extraction pilot does not create empirical student psychometrics. After a separately authorized release and real attempt collection, use immutable snapshots by Item Revision, release, channel, and window. Minimum floors are 100 scored attempts for percent correct, 200 for point-biserial discrimination and distractor selection, 100 presentations for omission, timeout, and response-time summaries, 100 repeat pairs for repeated-exposure effect, and 200 completed fixed forms for KR-20 or coefficient alpha. STAT duel packs receive difficulty balance and score-spread diagnostics, not a classical reliability coefficient.

## Changes Proposed Or Made

No code, source, data, or pilot selection was changed. Proposed additions are a frozen protocol artifact, restricted annotation schema, aggregate scorer, denominator-completeness validator, rubric result schema, duplicate gold set, reviewer timing events, and post-release attempt event contract.

## Tests Performed

- Read-only consistency check against the Architecture 1004C pilot definitions, privacy denominator plan, current inventory aggregates, and current zero-candidate evidence.
- Denominator audit for all required technical, quality, duplicate, and future psychometric measures.
- No real pilot, annotation exercise, medical review, source-content inspection, or empirical computation was performed.
- Post-write validation passed: exact six-file set, required report sections, zero forbidden Unicode dash characters, and zero trailing-whitespace lines. Both JSON companion reports parsed successfully with every required key.

## Risks

- Selecting only easy, recent, or clean recordings would inflate apparent performance.
- Treating unresolved pairings as exclusions would inflate pairing accuracy.
- Pooling privacy classes would hide catastrophic misses.
- Tuning and scoring on the same gold set would invalidate performance claims.
- Reporting point estimates without denominators and intervals would overstate certainty.
- Computing classical reliability for short paired STAT packs would be invalid.

## Blockers

- Privacy pilot and working-copy gate have not passed.
- The observed corpus lacks the required single-speaker stratum.
- Medical governance is unassigned.
- No credentialed physician gold labels or approvals exist.
- No real candidate, attempt, exposure, or reviewer-time data exists.
- Numeric pilot thresholds remain provisional pending ratification.

## Confidence

High confidence that the plan defines truthful units and denominators and that the pilot is currently blocked. No empirical confidence is claimed for pipeline performance, item quality, or psychometrics.

## Exact Paths

- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/agents/assessment_science/pilot_measurement_plan.md`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/I1Q_1007X_PILOT.md`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/agents/privacy_rights/privacy_recall_precision.md`

## Handoff

Root Supervisor should ratify or revise this protocol before source selection, resolve the missing single-speaker stratum, and require a frozen privacy pass before any technical extraction run. A pilot report must show every numerator, denominator, interval, threshold verdict, and not-scorable state.
