============================================================
FILE: agents/assessment_science/assessment_release_verdict.md
============================================================
# I1Q-1007X Assessment Release Verdict

Date: 2026-07-15

Verdict: `BLOCK_REAL_CANDIDATE_BANK_AND_ALL_STUDENT_OR_CONSUMER_CONTENT_RELEASE`

Internal synthetic engineering: `MAY_CONTINUE, NOT A CONTENT RELEASE`

Medical approval: NOT ISSUED

## Scope Completed

This verdict integrates item-writing quality, workflow support, real-pilot measurement readiness, aggregate duplicate and variant evidence, aggregate legacy v4 ranking feasibility, and psychometric readiness. It does not authorize production, deploy a system, activate a consumer, approve medical content, or inspect restricted content or student data.

## Evidence Inspected

- `/Users/brianb/.codex/attachments/48525e5d-91dd-4533-ba64-9492e6c33bf1/pasted-text-1.txt`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1006_ULTRA_BUILD/I1Q_1006_COMBINED_HANDOFF.md`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_fable/I1Q_STATQUESTIONS_1004C_ARCHITECTURE_AMENDMENT/I1Q_1004C_COMBINED_HANDOFF.md`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/I1Q_1007X_CORPUS_INVENTORY.md`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/I1Q_1007X_PRIVACY_NORMALIZATION.md`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/I1Q_1007X_PILOT.md`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/I1Q_1007X_LEGACY_V4.md`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/I1Q_1007X_STAT_ADAPTER.md`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/I1Q_1007X_DRILLS_ADAPTER.md`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/agents/privacy_rights/privacy_release_verdict.md`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/agents/medical_content/medical_candidate_audit.md`
- Current source, migration, tests, and compact JSON evidence under `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/i1q-question-platform/`.

## Findings

1. Current evidence contains one non-clinical synthetic fixture candidate and zero real candidates.
2. No real item has received editorial review, credentialed physician review, release eligibility, publication, or empirical exposure.
3. All 97 real sources remain blocked before extraction because compliant working-redacted copies and a passing privacy pilot do not exist.
4. The real stratified pilot has not run, and the observed corpus cannot currently satisfy the required single-speaker stratum.
5. Medical governance remains unassigned. Medical-answer agreement and candidate approval yield are not scorable.
6. The application enforces useful basic completeness and exact-hash review controls, but the full Agent 8 rubric is not a closed workflow or release gate.
7. Variant Group storage exists, but semantic sibling detection, release sibling exclusion, and repeated-exposure controls are not implemented.
8. Aggregate legacy evidence supports queue sizing only. It cannot support an item-level quality or exposure ranking.
9. The psychometric table is a scaffold that does not satisfy the Architecture 1004C snapshot identity, metrics, denominator, validity, and flag-queue contract.
10. Current root STAT and Drills reports state local adapter contract passes with consumer integration off. Earlier specialist snapshots report missing adapter behavior. Current source contains the versioned adapters, so the root reports are the better current local-code evidence. This does not clear protected integration, privacy, content, or consumer-release gates.

## Release Decision

Assessment science blocks:

- `REAL_CANDIDATE_BANK_READY`
- any claim of validated medical item quality
- any legacy v4 quality or exposure ranking
- any empirical psychometric claim
- any student-facing publication
- STAT consumer activation
- Drills consumer activation

Assessment science does not object to continued restricted engineering with the non-clinical synthetic fixture, provided it remains explicitly synthetic, no production or medical claim is made, no real source bypasses privacy, and all consumer flags remain off. This is not an overall internal-production approval. Security, privacy, accessibility, deployment, authority, and independent red-team gates remain separately controlling.

## Changes Proposed Or Made

No application code, source data, migration, test, feature flag, deployment, or protected consumer was changed. Six assessment-science artifacts were created in the assigned handoff directory. Proposed product changes are the closed item-quality rubric contract, complete distractor contract, real pilot scorer, release-time Variant Group dedup, privacy-safe exposure controls, legacy aggregate feature export, and Architecture 1004C-complete psychometric snapshots.

## Tests Performed

- Read-only review of current app contracts, migration schema, test coverage, root reports, specialist reports, and compact aggregate JSON evidence.
- Cross-check of synthetic, real-corpus, legacy, STAT, Drills, privacy, pilot, and psychometric states.
- No medical review, raw transcript read, source-content review, student-data query, item-level legacy inspection, real pilot, or empirical psychometric analysis was performed.
- Post-write validation passed: exact six-file set, required report sections, zero forbidden Unicode dash characters, and zero trailing-whitespace lines. Both JSON companion reports parsed successfully with every required key.

## Risks

- Internal synthetic readiness may be misrepresented as real content readiness.
- A free-form review object may allow incomplete quality review.
- Missing sibling exclusion can cause cueing, redundancy, and overexposure.
- Legacy queue counts may be misrepresented as an ordered ranking.
- Generic psychometric fields may encourage invalid metrics without valid denominators.
- Conflicting snapshot-era reports can obscure the current adapter state unless current source and root evidence are given precedence.

## Blockers

- Privacy release verdict is BLOCK for all 97 sources.
- Privacy-safe working transcripts: 0.
- Real candidates: 0.
- Credentialed physician-approved revisions: 0.
- Medical governance lead: unassigned.
- Real pilot: not run.
- Full Agent 8 rubric workflow: incomplete.
- Candidate-bank duplicate and Variant Group controls: incomplete.
- Legacy item-level quality and exposure evidence: absent.
- Empirical attempt data and compliant psychometric pipeline: absent.

## Confidence

High confidence in the block verdict for real content and empirical claims. High confidence that restricted synthetic engineering is a distinct, lower state. No confidence is claimed for medical accuracy, real item quality, candidate yield, or psychometric performance.

## Exact Paths

- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/agents/assessment_science/item_quality_rubric_results.md`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/agents/assessment_science/pilot_measurement_plan.md`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/agents/assessment_science/duplicate_and_variant_report.json`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/agents/assessment_science/legacy_quality_ranking.json`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/agents/assessment_science/psychometric_readiness.md`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/agents/assessment_science/assessment_release_verdict.md`

## Handoff

Root Supervisor should preserve this assessment block in the integrated verdict, continue only synthetic and restricted internal engineering, and schedule re-review after privacy passes, the stratified pilot runs with exact denominators, the Agent 8 rubric is enforced, a real duplicate audit exists, and credentialed physician review is available. Independent release review remains mandatory before any production claim.

============================================================
FILE: agents/assessment_science/item_quality_rubric_results.md
============================================================
# I1Q-1007X Item Quality Rubric Results

Date: 2026-07-15

Status: `SYNTHETIC_FIXTURE_ONLY, REAL_ITEM_QUALITY_NOT_ASSESSABLE`

Medical approval: NOT ISSUED

## Scope Completed

Assessment-science review covered the Agent 8 charter, the ratified nine-dimension authoring rubric, current item and review workflow support, one current non-clinical synthetic fixture, and the availability of duplicate, variant, difficulty, exposure, and psychometric controls. No raw transcript, source title, identity, student record, legacy question row, or medical question content was read or reproduced.

## Evidence Inspected

- `/Users/brianb/.codex/attachments/48525e5d-91dd-4533-ba64-9492e6c33bf1/pasted-text-1.txt`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1006_ULTRA_BUILD/I1Q_1006_COMBINED_HANDOFF.md`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_fable/I1Q_STATQUESTIONS_1004C_ARCHITECTURE_AMENDMENT/I1Q_1004C_COMBINED_HANDOFF.md`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_fable/I1Q_STATQUESTIONS_1004C_ARCHITECTURE_AMENDMENT/I1Q_1004C_PSYCHOMETRIC_AND_QUALITY_GOVERNANCE.md`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1004_MEGARUN/I1Q_1004_SECTION_F_QUESTION_QUALITY_RUBRIC.md`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/i1q-question-platform/src/contracts.mjs`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/i1q-question-platform/src/platform.mjs`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/i1q-question-platform/src/pipeline.mjs`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/i1q-question-platform/db/migrations/0001_i1q_question_platform.sql`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/i1q-question-platform/tests/platform.test.mjs`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/i1q-question-platform/tests/adapters-security.test.mjs`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/i1q-question-platform/evidence/candidate_counts.json`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/agents/medical_content/distractor_quality_report.md`

## Findings

### Evidence Boundary

The evidence reports one non-clinical synthetic fixture candidate, zero real candidates, zero physician-approved revisions, zero release-eligible revisions, and zero published revisions. Therefore no real item-writing quality, medical accuracy, board realism, empirical difficulty, discrimination, distractor performance, or exposure effect is measurable.

### Current Synthetic Fixture Audit

These judgments apply only to the single non-clinical synthetic local-demo item. They are not medical review and are not empirical psychometrics.

| Agent 8 criterion | Fixture result | Workflow support result |
| --- | --- | --- |
| One clear tested concept | PASS for fixture | PARTIAL. One concept ID is required, but no validator confirms conceptual singularity. |
| Stem and lead-in alignment | PASS for fixture | PARTIAL. A prompt is required, but stem and lead-in are not separately represented or scored. |
| Exactly one defensible answer | PASS against the synthetic key only | PARTIAL. One answer key is required, but defensibility and accidental correctness require human review. |
| Homogeneous option class | PASS for fixture | NOT ENFORCED. |
| Parallel option construction | PASS for fixture | NOT ENFORCED. |
| No clueing | PASS on static fixture inspection | NOT ENFORCED. |
| No gratuitous trick wording | PASS on static fixture inspection | NOT ENFORCED. |
| No overlapping choices | PASS for exact text distinctness only | PARTIAL. Exact duplicate choice text is rejected, but semantic overlap is not assessed. |
| Misconception value of distractors | PARTIAL | PARTIAL. Each distractor requires a misconception ID plus why tempting and why wrong, but trap type, provenance, abstraction class, and diagnostic value are absent. |
| Explanation teaching value | PARTIAL | PARTIAL. Explanation and correct rationale are required, but teaching point, durable-learning value, and non-restatement checks are absent. |
| Board realism | NOT ASSESSABLE on a non-clinical fixture | NOT ENFORCED. |
| Source sufficiency | PASS for fixture mechanics only | PARTIAL. Source and evidence claim IDs are required, but quality and sufficiency are not rubric-scored. |
| Variant-group dedup | NOT ASSESSABLE with one item | NOT ENFORCED at release assembly. |
| Repeated-exposure risk | NOT ASSESSABLE with no attempts | NOT IMPLEMENTED. |

No nine-dimension composite score is reported. Medical quality and board realism are not scorable on this fixture, the rubric weights remain proposed defaults, and the export gates require credentialed physician review.

### Workflow Strengths

- Exactly four keyed choices are required and exact duplicate choice text is rejected.
- Each distractor requires `misconception_id`, `why_tempting`, and `why_wrong`.
- A prompt, explanation, correct-answer rationale, concept, sources, and evidence claims are required.
- Item Revisions are immutable, carry exact content hashes, and use separate editorial and medical review events.
- Medical approval requires a verified, current credential, exact-revision assignment, editorial-first sequencing, and an assigned medical governance lead.
- Release assembly rejects duplicate Item Revision IDs and requires exact medical approval, current claims, rights, and privacy clearance.
- The data model names Variant Groups, candidate quality flags, and psychometric snapshots.

### Workflow Gaps

- The ratified nine-dimension rubric has no closed schema, required review form, score validator, disposition validator, or release gate.
- `structured_findings` accepts any object, so a review can omit lead-in clarity, option homogeneity, parallelism, clueing, trick wording, overlap, misconception value, teaching value, board realism, and source sufficiency.
- Revision data lacks a distinct lead-in, teaching point, authored difficulty, trap type, distractor provenance, abstraction class, mutual-exclusivity verdict, accidental-correctness verdict, and physician distractor attestation.
- Variant Group membership exists, but release assembly does not prevent sibling items from appearing together and no semantic sibling detector is evidenced.
- Candidate quality flags exist only as a storage concept. No current service workflow or tests show creation, resolution, or a unified authoring and psychometric flag queue.
- No item-level exposure, cooldown, repeat-pair, or overexposure control is implemented.
- No assessment-science tests directly exercise the full charter criteria.

## Changes Proposed Or Made

No application, migration, fixture, or test code was changed. Proposed next changes are a versioned rubric-result contract, a closed findings schema, fail-closed required dimensions before medical review, explicit distractor and difficulty fields, release-time Variant Group dedup, a unified quality flag queue, and direct tests for every Agent 8 criterion.

## Tests Performed

- Read-only static inspection of the current source, migration, test names, architecture, handoffs, and aggregate JSON evidence.
- Synthetic fixture structure was reviewed without reproducing its prompt, options, answer, or explanation.
- No real item scoring, medical review, student-data analysis, or empirical psychometric computation was performed.
- Post-write validation passed: exact six-file set, required report sections, zero forbidden Unicode dash characters, and zero trailing-whitespace lines. Both JSON companion reports parsed successfully with every required key.

## Risks

- Basic field completeness can be mistaken for item quality.
- Free-form findings permit nominal review completion without the ratified rubric.
- Sibling items can be assembled together, inflating construct redundancy and exposure.
- Missing trap type and misconception-vocabulary pinning weaken remediation value.
- A generic psychometric row may encourage invalid metrics below volume floors or outside valid assessment contexts.

## Blockers

- Real candidates: 0.
- Privacy-cleared working transcripts: 0.
- Real pilot: not run.
- Credentialed physician-reviewed revisions: 0.
- Medical governance lead: unassigned.
- Full item-quality workflow contract: incomplete.
- Empirical attempt and exposure data: absent.

## Confidence

High confidence in the workflow-support audit and synthetic fixture structure. No confidence statement is possible for real medical item quality or empirical item performance because the required evidence does not exist.

## Exact Paths

- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/agents/assessment_science/item_quality_rubric_results.md`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/i1q-question-platform/src/platform.mjs`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/i1q-question-platform/db/migrations/0001_i1q_question_platform.sql`

## Handoff

Root Supervisor should treat the current fixture as a workflow smoke fixture only. Before any real candidate enters medical review, add a closed Agent 8 rubric contract and validators, preserve separate assessment and medical judgments, and keep all student, STAT, and Drills release flags off.

============================================================
FILE: agents/assessment_science/pilot_measurement_plan.md
============================================================
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

============================================================
FILE: agents/assessment_science/psychometric_readiness.md
============================================================
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

============================================================
FILE: agents/avicenna_diagnostics/diagnostics_log.md
============================================================
# Avicenna Diagnostics Log

## Scope

Read-only diagnosis of the integrated I1Q Question Platform application, tests, evidence validator, and the untracked 1007X PostgreSQL migration pair. Avicenna made no changes to application code, migrations, tests, evidence, feature flags, Git state, protected systems, or provider state. Writes were limited to the five files in this diagnostics directory.

## Snapshot

- Observed at: `2026-07-15T13:40:06Z`
- Worktree: `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000`
- Branch: `i1q-question-platform-ultra-1007x-ma`
- HEAD: `04f1c7ac5221b1b5232ec6ac7966776fd5bb8644`
- Application: `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/i1q-question-platform`
- Migration candidate: `i1q-question-platform/db/migrations/20260715122434_i1q_1007x_question_platform.sql`
- Compensation candidate: `i1q-question-platform/db/rollback/20260715122435_i1q_1007x_compensating_disable.sql`

The migration, compensation, PostgreSQL repository, and three associated test files were untracked at the final snapshot. Concurrent file arrivals changed earlier test counts, so only the final stable run below is authoritative.

## Tests Performed

### Complete local application suite

Command: `npm test` from `i1q-question-platform`

Result:

- Exit code: `0`
- Tests: `195`
- Passed: `194`
- Failed: `0`
- Skipped: `1`
- Duration reported by Node: `731.915792 ms`

The skipped test is `ephemeral PostgreSQL apply, reapply, role attacks, compensation, and reapply proof`. The skip reason is that `I1Q_POSTGRES_TEST_URL` is not configured. `/opt/homebrew/bin/psql` is present, but no disposable database target was authorized or supplied.

### Evidence validator

Command: `node src/validate-evidence.mjs` from `i1q-question-platform`

Result, reproduced twice against the final snapshot:

- Exit code: `1`
- Claimed state: `BLOCKED`
- Evidence files expected, present, and parsed: `20`, `20`, `20`
- Errors: `19`

Error groups:

1. Two required feature flags are absent from the generated deployment manifest.
2. The rollback manifest lists only four of the six current I1Q flags.
3. Twelve listed application artifacts have stale hashes or byte counts.
4. The checksum inventory lists 26 files while the current application estate has 43 files outside `evidence`.
5. The recorded test inventory is stale and omits the validator regression suite.
6. The rollback contract fails because its generated manifest does not cover every current flag.

### Syntax checks

All exited `0`:

- `node --check scripts/generate_evidence.mjs`
- `node --check src/postgres-repository.mjs`
- `node --check src/validate-evidence.mjs`
- `node --check public/app.js`

## Evidence Inspected

- All 12 current `tests/*.test.mjs` files
- `src/validate-evidence.mjs`
- `scripts/generate_evidence.mjs`
- All 20 current evidence JSON files
- The complete 2,561-line 1007X migration
- The complete compensating migration
- `src/postgres-repository.mjs`
- Architecture 1002.1 channel, review, immutability, rights, and release rulings

## Findings

The integrated in-memory application, UI, security, privacy, adapter, validator regression, static migration, and fake-driver repository suites are green. This does not prove the new migration can apply, reapply, enforce RLS, survive attacks, compensate, or reapply on PostgreSQL because that one execution test did not run.

The evidence validator is functioning as a fail-closed detector. Its failure is primarily a stale generated-evidence condition, but the evidence generator still targets the old `0001` migration pair and carries stale deployment blockers. A blind regeneration would therefore not certify the new 1007X pair truthfully.

Static review also found migration and application contract gaps that the green regex and fake-driver tests do not exercise. These are detailed in `failure_root_causes.md`.

## Changes

No repair was made by Avicenna. No test was added by Avicenna. The diagnostics packet is the only output.

## Risks And Blockers

- No PostgreSQL execution proof exists for the new migration pair.
- The current generated evidence estate is invalid.
- The SQL artifact path does not enforce the binding class and phase policy against payload content.
- Release validation accepts caller-named passing checks without proving all six official leak tests.
- The application still uses `MemoryRepository`; the new PostgreSQL repository is not wired into the server.

## Confidence

High for the observed local test and validator results. High for the cited static contradictions. No confidence claim is made for live PostgreSQL behavior, staging, production, or protected consumers.

## Root Handoff

Root should treat the local suite as green but incomplete, not as staging certification. Repair the static contract gaps, add focused regressions, run the migration test on an authorized disposable PostgreSQL instance, update the evidence generator to the accepted 1007X pair and current blockers, regenerate once, and rerun the fail-closed validator.

============================================================
FILE: agents/avicenna_diagnostics/regression_tests_added.md
============================================================
# Regression Tests Added

## Scope

Avicenna operated read-only and added no code or tests. This file records the current test estate and the regressions Root still needs.

## Changes

Tests added by Avicenna: `0`.

The final snapshot contains 12 local test files. Three untracked datastore suites are present:

- `tests/migration-1007x.test.mjs`
- `tests/postgres-migration.test.mjs`
- `tests/postgres-repository.test.mjs`

## Current Test Result

Command: `npm test`

- Total: `195`
- Passed: `194`
- Failed: `0`
- Skipped: `1`

## Existing Coverage That Passed

- STAT and Drills adapter contracts
- Class A closed-world and answer-leak scans in application adapters
- API and auth boundaries
- Evidence validator negative fixtures
- Static migration shape, forced RLS inventory, grants, and immutable table checks
- In-memory workflow and release mechanics
- Privacy and speaker-normalization gates
- PostgreSQL repository input and transaction behavior with a fake driver
- UI workflow, accessibility, and bootstrap checks

## Missing Regression Tests

Root should add or strengthen the following before migration certification:

1. Execute the full PostgreSQL migration test on an authorized disposable database and require zero skips.
2. Call `i1q.create_channel_artifact` with answer-bearing and class D payloads labelled class A and `pre_answer`; require rejection.
3. Prove artifact channel, phase, and class match the exact referenced Channel Security Policy and its closed-world `field_rules`.
4. Attempt release validation with arbitrary or incomplete check IDs; require all six official leak tests for every artifact.
5. Prove an expired `rights_records.expires_at` blocks release even when status remains `cleared_for`.
6. Prove medical assignment cannot be created or accepted before editorial passage and that every review event completes exactly one assignment.
7. Prove draft revision editing works only before candidate freeze, then prove source, redaction, and extraction records reject update and delete.
8. Prove revision supersession and retirement have an append-only representation.
9. Run the positive and negative RLS matrix for author-own, reviewer-assigned, governance, analytics, answer, source, incident, and psychometric scope.
10. Run two concurrent compensation calls and require one compensation audit record.
11. Prove the compensation function remains unexecutable by the future runtime role.
12. Prove the evidence generator selects the accepted 1007X migration pair, emits all six flags, records all current test files, and reports current blockers rather than obsolete ones.

## Risks And Blockers

Regex assertions can prove text is present but cannot prove PostgreSQL behavior. Fake-driver tests can prove bound SQL construction but cannot prove RLS, trigger, transaction, or concurrency semantics.

## Paths

- Migration tests: `i1q-question-platform/tests/migration-1007x.test.mjs`, `tests/postgres-migration.test.mjs`
- Repository tests: `i1q-question-platform/tests/postgres-repository.test.mjs`
- Evidence tests: `i1q-question-platform/tests/evidence-validator.test.mjs`
- Security tests: `i1q-question-platform/tests/security-regressions.test.mjs`
- Current SQL: `i1q-question-platform/db/migrations/20260715122434_i1q_1007x_question_platform.sql`

## Confidence

High that the listed gaps are absent from the final executed coverage. No claim is made that this list replaces a full staging test plan.

## Root Handoff

Add the focused tests after repairing the underlying contracts, then rerun the complete suite and the disposable PostgreSQL proof. Do not count a skipped database test as a passing migration gate.

============================================================
FILE: agents/avicenna_diagnostics/repaired_failures.md
============================================================
# Repaired Failures

## Scope

Record of repairs already present in the final integrated snapshot. Avicenna did not implement or modify these repairs.

## Verified Repaired Areas

### Privacy mechanics

The final suite passes the closed eight-class privacy taxonomy, source-complete pilot mechanics, exact-binomial lower-bound gates, deterministic normalization, Dr. J-only working-field allowlist, speaker mapping checks, identifying-anecdote suppression, and public excerpt and media denial. The focused and integrated privacy tests are green.

### Authentication and API boundaries

The final suite passes fresh-session checks, fail-closed resolver outage behavior, CSRF and trusted-Origin enforcement, static path containment, normalized production-mode demo denial, workflow-managed resource protection, answer isolation, restricted-source isolation, and sensitive mass-assignment rejection.

### UI bootstrap and workflow shell

The dashboard boot regression and all seventeen required internal workflow declarations pass. Accessibility landmarks, named controls, focus rules, reduced-motion behavior, responsive rules, and native keyboard activation pass static and JSDOM tests.

### Feature-flag contract

The current validator now requires all six flags:

- `internal_platform_enabled`
- `internal_review_enabled`
- `student_content_enabled`
- `student_release_enabled`
- `stat_adapter_enabled`
- `drills_adapter_enabled`

This repair is why the old four-flag evidence estate now fails closed instead of silently passing.

### Local datastore adapter mechanics

The untracked PostgreSQL repository passes fake-driver tests for dedicated transactions, actor verification, fixed parameterized RPCs, rollback paths, connection release, input allowlists, hash validation, duplicate identity rejection, and closed transaction handles.

## Changes Made By Avicenna

None outside this diagnostics packet.

## Tests

- Full local suite: `194` passed, `0` failed, `1` skipped.
- Evidence validator: reproducible failure with `19` errors.
- Syntax checks: `4` passed.

## Not Repaired

- Generated evidence has not been reconciled or regenerated.
- The generator still targets the old `0001` migration pair.
- The 1007X migration has not run against PostgreSQL.
- SQL channel policy enforcement and official leak-test binding are absent.
- Application and SQL review-assignment behavior still diverge.
- No canonical datastore or authentication adapter is wired into the server.

## Risks And Blockers

A green local suite proves that current assertions pass. It does not convert skipped database execution or uncovered contract gaps into repaired behavior.

## Paths

- Privacy: `i1q-question-platform/src/privacy.mjs`, `src/pipeline.mjs`, `tests/privacy-regressions.test.mjs`
- Security: `src/auth.mjs`, `src/server.mjs`, `tests/security-regressions.test.mjs`
- UI: `public/app.js`, `public/index.html`, `tests/ui.test.mjs`
- Datastore candidate: `src/postgres-repository.mjs`, `tests/postgres-repository.test.mjs`
- Validator: `src/validate-evidence.mjs`, `tests/evidence-validator.test.mjs`

## Confidence

High for local mechanics covered by the final suite. No production or medical-content confidence is asserted.

## Root Handoff

Preserve these green repairs while fixing the uncovered migration and evidence gaps. Do not weaken the validator to make stale evidence pass.

============================================================
FILE: agents/avicenna_diagnostics/unresolved_external_failures.md
============================================================
# Unresolved External Failures

## Scope

External or authority-dependent conditions that Avicenna could not prove in a read-only local diagnostic run.

## Current External Blockers

### Disposable PostgreSQL target

`psql` is installed, but `I1Q_POSTGRES_TEST_URL` is not configured. No authorized isolated database was supplied. Therefore no apply, reapply, role attack, RLS, compensation, concurrency, query-plan, or reapply-under-history proof was executed.

### Canonical datastore route

The 1007X migration and PostgreSQL repository are local untracked candidates. No evidence proves an approved RANKLISTIQ migration workflow, preview project, runtime role, connection adapter, backup, or rollback operator has accepted this exact state.

### Canonical authentication adapter

The application tests use local synthetic actors or injected resolvers. No evidence in this diagnostic run proves the MissionMed HQ identity and session adapter is wired to the Question Platform in staging or production.

### Staging and production

No staging URL, production URL, deployment record, browser smoke, monitoring signal, backup proof, or rollback execution was available or attempted. Current evidence truthfully claims `BLOCKED`, but the generated deployment manifest itself is stale.

### Medical and publication authority

Medical governance remains unassigned in the routed authority. No credentialed physician approval record was inspected. No student release is eligible. All six I1Q flags are expected to remain off.

### Real corpus release gates

The local privacy mechanics are synthetic. No source-complete human gold pilot, real-corpus privacy metric estate, real candidate extraction, or credentialed medical review was executed in this diagnostic task.

## Evidence Failure Versus External Failure

The 19 validator errors are local generated-evidence failures and can be repaired locally after the generator is corrected. They must not be mislabelled as proof that staging or production failed, because neither environment was exercised.

The skipped PostgreSQL test is an external test-environment dependency. It is also a required migration gate, so the migration remains uncertified.

## Changes

None. No provider, database, feature flag, deployment, auth system, protected consumer, or Git state was touched.

## Tests

- Local suite: `194` passed, `0` failed, `1` skipped.
- Evidence validator: `19` errors, reproduced.
- External runtime tests: not run.

## Risks

- Static SQL behavior may differ from PostgreSQL execution.
- A future runtime grant could activate currently dormant SQL authorization gaps.
- Regenerating evidence before correcting its authority inputs could replace stale evidence with newly generated but still inaccurate evidence.

## Paths

- Migration: `i1q-question-platform/db/migrations/20260715122434_i1q_1007x_question_platform.sql`
- Compensation: `i1q-question-platform/db/rollback/20260715122435_i1q_1007x_compensating_disable.sql`
- Evidence generator: `i1q-question-platform/scripts/generate_evidence.mjs`
- Generated evidence: `i1q-question-platform/evidence/`

## Confidence

High for the absence of local configuration and the observed skipped gate. No confidence claim is made about environments that were not accessed.

## Root Handoff

Keep deployment and all consumer flags blocked. After local contract repairs, use the canonical approved route to provision an isolated preview database, run the full PostgreSQL and RLS matrix with zero skips, execute compensation and reapply, then regenerate and validate evidence before considering staging.

============================================================
FILE: agents/darwin/behavioral_parity_report.md
============================================================
# I1Q-1007X Darwin Behavioral Parity Report

## Verdict

`VERIFIED: PASS_LOCAL_PARITY. BLOCK_EXTERNAL RELEASE CLAIMS.`

VERIFIED: Darwin made no application edits, so this pass introduced no behavioral change. Exact integrated commit `6ac62c5a0503981680f161fe5119d5e5e2fa031a` satisfies the executed package and evidence-validator suites.

UNKNOWN: These results do not certify staging, production, privacy clearance, medical correctness, browser behavior, accessibility, or human workflows.

## Candidate Identity

- VERIFIED: Branch is `i1q-question-platform-ultra-1007x-ma`.
- VERIFIED: HEAD is `6ac62c5a0503981680f161fe5119d5e5e2fa031a`.
- VERIFIED: Application, evidence, validator, OpenAPI, and API-test bytes are integrated at that exact checkpoint.
- VERIFIED: `src/platform.mjs` SHA-256 is `b232f577c7c5acc793c723228b20ad6c519807ef24055e7a298c380e953936dd`.
- VERIFIED: `src/server.mjs` SHA-256 is `a956dab618a354b2170e45ff63562a2a8bc8157672e07c4bd5c9ac03b82e9c90`.
- VERIFIED: Migration SHA-256 is `c7e93e8d4c540ddf07951ac9fd909ed1fb49fdd962d31003e934cb186967c127`.

VERIFIED: These hashes identify inspected engineering bytes and do not imply release approval.

## Independent Local Evidence

| Class | Check | Result |
| --- | --- | --- |
| VERIFIED | Full package suite | 206 discovered, 205 pass, 0 fail, 1 gated skip |
| VERIFIED | Evidence validator | 20 of 20 pass, 0 errors, claimed `STATE_A` |
| VERIFIED | Disposable PostgreSQL in package run | Gated skip because no isolated URL was supplied to Darwin |
| VERIFIED | Root-supplied disposable PostgreSQL proof | 12 of 12 pass, not independently rerun by Darwin |
| VERIFIED | 20,000-row workload, POINT_IN_TIME | Repository first-page median 9.627 ms and p95 22.375 ms |
| VERIFIED | 10,000-row workload, POINT_IN_TIME | Median 129.960 ms and p95 134.658 ms |
| VERIFIED | 1,000-item release export, POINT_IN_TIME | Median 28.172 ms and p95 30.292 ms |

## Preserved Behavior Matrix

### STAT and answer isolation

`VERIFIED`

- Server dataset projection remains exactly: `dataset_version`, `question_id`, `prompt`, `choice_a`, `choice_b`, `choice_c`, `choice_d`, `answer`, `explanation`.
- Pre-answer artifacts omit answers, explanations, rationales, and equivalent nested aliases.
- Caller-supplied phase text cannot unlock post-answer data.
- Post-answer debrief requires trusted finalization and participant proof.
- Composite question identity remains dataset version plus question ID.

### Drills projection

`VERIFIED`

- Playback and nodes are required available.
- Transcript and VTT absence is explicit rather than silently accepted.
- Rights, privacy, source hash, working hash, and timestamp linkage are required.
- No Drills consumer activation was performed.

### Authentication and request integrity

`VERIFIED`

- Production mode without a resolver fails closed.
- Expired, revoked, stale, missing, unvalidated, and outage identity contexts fail closed.
- Mutations require session-bound CSRF and trusted Origin when resolver-backed.
- Local demo is rejected in production and under forwarded ambiguity.

`UNKNOWN`

- The canonical MissionMed identity resolver and session adapter are not wired or tested in staging.

### Resource visibility

`VERIFIED`

- Generic resource reads are answer-free.
- Read-only actors cannot browse unapproved revisions.
- Revision and source visibility follows author, assignment, governance, or approved-read scope.
- Restricted source fields and normalized transcript wording are removed from unauthorized projections.

### Authoring and review lifecycle

`VERIFIED`

- Draft edits use an explicit guarded route and optimistic hash matching.
- Candidate submission freezes the draft path.
- Editorial and medical review require exact assignments and explicit acceptance.
- Self-review, delegated conflict, actor swap, review-type swap, and revision-hash swap fail.
- Medical assignment and review require current verified MD or DO credentials.
- Unassigned medical governance blocks exact medical approval and release ratification.

### Release lifecycle

`VERIFIED`

- Release membership binds exact immutable revision IDs, numbers, hashes, dataset versions, and question IDs.
- Official validation checks and artifact evidence are bound to a deterministic hash.
- Assembler, validator, medical ratifier, and publisher separation is enforced in covered paths.
- Both student flags and the exact adapter flag are required before consumer delivery.
- All feature flags remain expected off.

### Datastore contract

`VERIFIED`

- Candidate SQL uses `auth.uid()` and database-owned memberships.
- Forced RLS, deny-by-default grants, answer isolation, restricted source isolation, immutable history, rights expiry, exact validation, and preserving compensation are covered by local tests.
- Root reports one independent disposable PostgreSQL run with all 12 checks passing.

`UNKNOWN`

- Canonical project routing, runtime grants, connection pooling, query plans, backups, promotion, and rollback are not proven.

### UI and accessibility mechanics

`VERIFIED`

- Seventeen workflows remain declared.
- Native controls, landmarks, live regions, focus rules, responsive selectors, reduced motion, and source-lineage regression checks pass locally.
- Selected source context does not fall back across the three-source synthetic regression fixture.

`UNKNOWN`

- No real browser, accessibility tree, keyboard journey, screen reader, zoom, mobile viewport, or human task board ran in this pass.

### Privacy and medical content

`BLOCKED`

- Privacy mechanics pass synthetic local tests.
- All 97 real sources remain blocked.
- Compliant privacy-safe working transcripts: 0.
- Real extracted candidates: 0.
- Credentialed physician-approved real revisions: 0.
- Medical governance lead: unassigned.

BLOCKED: No medical accuracy, medical approval, or content-quality claim is made.

## Current Parity Status

VERIFIED: No Darwin behavioral delta exists because no application code was changed.

VERIFIED: The evidence packet is currently contract-consistent for the executed validator: 20 of 20 files pass with zero errors and claimed `STATE_A`.

VERIFIED: Negative validator coverage remains in the 205 passing package tests, including malformed JSON, duplicate keys, stale checksums, privacy thresholds, answer leakage, source leakage, unsupported state claims, release hashes, and combined-handoff checks.

UNKNOWN: Local passing tests do not establish canonical provider, datastore, browser, staging, production, or human parity.

## Production And Release Blockers

- BLOCKED: No canonical MissionMed auth integration.
- BLOCKED: No canonical unprivileged PostgreSQL runtime wiring or approved grant manifest.
- BLOCKED: No approved preview, staging, or production deployment evidence.
- BLOCKED: No monitoring, backup, production smoke, or rollback rehearsal.
- BLOCKED: No real browser or assistive-technology certification.
- BLOCKED: No completed human validation.
- PROTECTED: No real-corpus extraction or privacy-clearance claim.
- BLOCKED: No assigned medical governance lead or physician-approved real revision.

## State Ruling

- VERIFIED: `STATE_A` is the current evidence-validator claim.
- BLOCKED: State B is not achieved because governed privacy-safe real extraction has not occurred.
- BLOCKED: State C is not achieved because auth, datastore, staging, deployment, browser, security, accessibility, monitoring, and rollback gates are incomplete.
- BLOCKED: State D is prohibited without genuine credentialed physician approval and authorized publication ratification.

## Darwin Conclusion

VERIFIED: Exact checkpoint `6ac62c5a0503981680f161fe5119d5e5e2fa031a` preserves the intended local contracts covered by 205 passing tests and the 20 of 20 evidence validation.

INFERENCE: Point-in-time measurements show no local latency regression signal, while server-side query completeness remains the warranted pre-scale refactor.

BLOCKED: Release, deployment, consumer activation, privacy clearance, and medical approval vetoes remain fully in force.

============================================================
FILE: agents/darwin/maintainability_report.md
============================================================
# I1Q-1007X Darwin Maintainability Report

## Verdict

`INFERENCE: CONDITIONALLY MAINTAINABLE FOR LOCAL ENGINEERING. REFACTOR QUERY CONTRACTS BEFORE SCALE.`

VERIFIED: Exact integrated commit `6ac62c5a0503981680f161fe5119d5e5e2fa031a` has deterministic direct and dependent tests plus explicit fail-closed contracts.

INFERENCE: Its primary maintainability risks are incomplete server-side list contracts and responsibility concentration. Future extraction should stay behind existing interfaces.

## Evidence Reviewed

- VERIFIED: Exact integrated source at `6ac62c5a0503981680f161fe5119d5e5e2fa031a` on branch `i1q-question-platform-ultra-1007x-ma`.
- VERIFIED: Full package proof is 206 discovered, 205 pass, 0 fail, and 1 gated skip.
- VERIFIED: Evidence validation passes 20 of 20 files with zero errors and claims `STATE_A`.
- VERIFIED: Root supplies a separate disposable PostgreSQL result of 12 of 12 pass; Darwin did not rerun it.
- VERIFIED: The migration, compensation, runtime adapters, synthetic fixtures, validator, and relevant specialist reports were inspected.
- VERIFIED: Local measurements in `performance_before_after.json` are explicitly point-in-time.

## Size And Concentration

| Class | Surface | Current size | Maintainability observation |
| --- | --- | ---: | --- |
| VERIFIED | `src/platform.mjs` | 1,450 lines | Domain facade also owns authorization, lifecycle, release, governance, and fixture assembly |
| VERIFIED | `public/app.js` | 1,902 lines | Transport, state, 17 renderers, commands, focus, and scenarios share one module |
| VERIFIED | `src/validate-evidence.mjs` | 2,087 lines | Schema, parsing, math, checksum, release, handoff, and CLI responsibilities are combined |
| VERIFIED | 1007X migration | 3,299 lines | The file defines 52 tables and has a large security-definer and policy review surface |

## Findings

### MNT-01 P1: Operational lists are first-page bounded

VERIFIED: `public/app.js` requests at most 200 rows and applies available search, filter, sort, and paging to that local subset. `MemoryRepository.list` materializes, filters, and sorts the full collection on each request.

VERIFIED: In the point-in-time 20,000-row synthetic probe, a target at row 20,000 was present in the complete data set and absent from the first 200 rows.

INFERENCE: Add allowlisted server-side cursor, filter, sort, and exact-join contracts before 10,000-plus operational use. Keep the memory repository as a deterministic fixture adapter.

### MNT-02 P1: Cross-language release-hash logic needs frozen vectors

VERIFIED: JavaScript and PostgreSQL independently encode release validation.

INFERENCE: Independence is useful but creates drift risk around field order, sorting, NFC normalization, UTF-8 byte lengths, and delimiters. Make versioned synthetic vectors the parity authority without replacing both implementations with one self-validating path.

### MNT-03 P1: Cursor and PostgreSQL queue contracts are incomplete

VERIFIED: Unknown memory cursors silently restart page one. `PostgresRepository.listMyReviewAssignments` has no cursor or limit contract, and no PostgreSQL candidate-queue method mirrors the measured memory path.

INFERENCE: Define explicit invalid-cursor behavior, stable keyset tie-breakers, bounded assignment queries, and equivalent memory and PostgreSQL tests.

UNKNOWN: PostgreSQL plans, locks, and RLS overhead at representative synthetic cardinality remain unmeasured.

### MNT-04 P1: Domain responsibilities are concentrated in one facade

VERIFIED: `QuestionPlatform` exposes one useful boundary, but authorization, redaction, authoring, review, release, governance, and fixture concerns change in the same 1,450-line module.

INFERENCE: Future changes therefore have a broad review surface and can couple visibility rules to lifecycle rules.

INFERENCE: Retain the facade and extract internal services one domain at a time with unchanged error codes and characterization tests.

### MNT-05 P1: Client workflow concentration raises regression cost

VERIFIED: Source context, evidence gating, assignment acceptance, status continuity, responsive behavior, 17 workflow renderers, and command handlers share one client module.

INFERENCE: A small workflow change can affect global state, focus, source selection, or session behavior.

INFERENCE: Separate transport, selected-record context, renderers, and commands using native modules while centralizing source-context resolution and keeping answer-bearing content out of browser persistence.

### MNT-06 P2: The evidence validator should be modular but independent

VERIFIED: The current validator passes 20 of 20 files and the package suite preserves negative evidence tests. It duplicates selected runtime constants and hashing logic in a 2,087-line file.

INFERENCE: Split by concern without weakening independent verification. Mark each duplicate as intentionally frozen or authority-generated and preserve deterministic issue order and CLI behavior.

### MNT-07 P2: Migration maintenance must change after first apply

VERIFIED: Darwin did not apply the migration to any datastore.

PROTECTED: After first authorized canonical application, the migration must not be edited, renamed, or replaced.

INFERENCE: Record the accepted hash, use only forward migrations and preserving compensation, and generate table, function, policy, trigger, grant, and forced-RLS inventories.

### MNT-08 P2: Synthetic fixture construction is mixed with runtime domain code

VERIFIED: Local fixture assembly is explicit and synthetic non-clinical, but remains in the main platform domain module.

INFERENCE: Move fixture construction behind a test-only or local-demo factory while retaining production-mode rejection tests.

## Strengths To Preserve

- VERIFIED: Exact STAT projection and composite identity tests.
- VERIFIED: Closed-world Class A answer-leak checks.
- VERIFIED: Fail-closed auth, Origin, CSRF, role, assignment, and credential tests.
- VERIFIED: Deterministic privacy normalization and closed taxonomy.
- VERIFIED: Immutable audit-chain and release evidence tests.
- VERIFIED: Parameterized PostgreSQL repository methods with stable validation errors.
- VERIFIED: Disposable PostgreSQL adversarial test path.
- PROTECTED: Explicit six-flag off posture.
- PROTECTED: Synthetic non-clinical fixtures and no invented medical content.

## External Blocker Register

| Class | Area | Current truth |
| --- | --- | --- |
| BLOCKED | Production | No authorized deployment, smoke, monitoring, backup, or rollback proof |
| BLOCKED | Authentication | Canonical MissionMed identity and session integration is not certified |
| BLOCKED | Datastore | No canonical unprivileged runtime route, grant manifest, or promotion route is proven |
| BLOCKED | Browser | No real browser, responsive, accessibility-tree, or end-to-end session certification |
| BLOCKED | Human validation | No authorized physician, editor, novice operator, incident responder, or assistive-technology board |
| PROTECTED | Privacy | Real corpus remains inventory-only and extraction-blocked |
| BLOCKED | Medical governance | Lead remains unassigned and no medical approval is claimed |
| VERIFIED | Release evidence | Validator passes 20 of 20 and claims `STATE_A`; this does not establish State B, C, or D |

## Recommended Order

1. INFERENCE: Preserve exact checkpoint `6ac62c5a0503981680f161fe5119d5e5e2fa031a` and its negative validator coverage.
2. INFERENCE: Add server-side scale contracts and approved PostgreSQL query-plan proof.
3. INFERENCE: Create cross-language release vectors.
4. INFERENCE: Extract platform and client modules behind unchanged interfaces.
5. INFERENCE: Expand deterministic performance coverage to 10,001 and 20,000 rows.
6. BLOCKED: Run browser, assistive-technology, human, security, staging, and release verification only through authorized routes.

## Confidence

VERIFIED: Confidence is high in exact-head local test evidence, static concentration metrics, query-contract observations, and point-in-time synthetic measurements.

INFERENCE: Confidence is medium in refactor priority because canonical PostgreSQL and browser performance are unavailable.

UNKNOWN: No confidence is asserted for production behavior, medical correctness, privacy clearance, accessibility certification, or human usability.

============================================================
FILE: agents/darwin/refactor_plan.md
============================================================
# I1Q-1007X Darwin Refactor Plan

## Snapshot

- VERIFIED: The integrated Git commit inspected is `6ac62c5a0503981680f161fe5119d5e5e2fa031a` on branch `i1q-question-platform-ultra-1007x-ma`.
- VERIFIED: The application, evidence, validator, OpenAPI, and API-test bytes inspected are integrated at that exact commit. Unrelated shared handoff changes remain outside Darwin ownership.
- VERIFIED: A stable current run of `npm run validate` passed 20 of 20 evidence files with zero errors and claimed `STATE_A`.
- VERIFIED: A current run of `env -u I1Q_POSTGRES_TEST_URL npm test` discovered 206 tests, passed 205, failed 0, and intentionally skipped 1 disposable PostgreSQL test.
- VERIFIED: The runtime files used by the preserved benchmark retain the exact SHA-256 values recorded at measurement time.
- VERIFIED: Darwin performed no application, SQL, migration, test, evidence, package, feature-flag, provider, or Git refactor.
- PROTECTED: No production or staging system, canonical identity provider, real transcript, medical content, or student data was accessed.

## Decision

- VERIFIED: No behavior-preserving code refactor was performed because Darwin's write authority is report-only.
- INFERENCE: No latency-only refactor is warranted now for the local in-memory implementation. The point-in-time 20,000-row benchmark had repository page p95 values below 23 ms and HTTP warm-page p95 below 17 ms on the measured machine.
- INFERENCE: A behavior-defining query-contract refactor is warranted before a 10,000-plus candidate queue is treated as operationally complete. The current API accepts only cursor and limit for generic lists, while the client fetches at most 200 rows and applies search, filter, sort, and paging locally.
- UNKNOWN: Production query latency, RLS cost, lock behavior, browser render cost, and concurrency remain unknown because no approved preview or production route was available.

## Protected Invariants

1. PROTECTED: STAT `dataset_questions` remains exactly nine fields in frozen order.
2. PROTECTED: Composite identity remains `dataset_version` plus `question_id`.
3. PROTECTED: Class A and other pre-answer artifacts contain no answer, correctness, explanation, rationale, or equivalent nested material.
4. PROTECTED: Answer-bearing data remains server-only until trusted finalization and participant authorization.
5. PROTECTED: Drills transcript, VTT, nodes, and playback availability remain explicit and fail closed.
6. PROTECTED: Review access remains role-scoped, assignment-scoped, credential-scoped, and exact-revision-hash-bound.
7. PROTECTED: Draft mutation stops when a revision leaves draft state.
8. PROTECTED: Review, audit, release, and source history remains immutable where the architecture requires it.
9. PROTECTED: Release validation remains bound to exact official checks, artifacts, membership, and evidence hashes.
10. PROTECTED: Assembly, validation, medical ratification, and publication preserve actor separation.
11. PROTECTED: Both student flags and the exact consumer flag remain required for release delivery.
12. PROTECTED: Medical governance remains unassigned until an authorized, credentialed physician is explicitly appointed.
13. PROTECTED: Real sources remain extraction-blocked until governed source-complete privacy evidence passes.
14. PROTECTED: All six feature flags remain off unless a separately authorized release gate changes them.

## Future Refactors

### R1. Add Complete Server-Side List Contracts

- VERIFIED: `src/server.mjs` reads `cursor` and `limit` for generic list requests but does not read state, search, or sort parameters.
- VERIFIED: `public/app.js` requests at most 200 rows and then applies local filtering and sorting.
- VERIFIED: In the point-in-time 20,000-row synthetic check, a target at row 20,000 was found with the complete data set and omitted from the first 200 rows.
- INFERENCE: Define allowlisted filter and sort parameters for each operational resource, plus a stable keyset cursor with deterministic tie-breakers.
- INFERENCE: Return explicit invalid-cursor errors or an explicitly versioned restart contract. Add direct tests for both valid continuity and rejected stale cursors.
- UNKNOWN: Root must choose the externally visible invalid-cursor behavior. The current memory adapter silently restarts page one for an unknown cursor.
- INFERENCE: Acceptance requires complete results across more than 10,000 synthetic rows, no duplicate or omitted rows across pages, and equivalent memory and PostgreSQL behavior.

### R2. Add Bounded PostgreSQL Queue Methods

- VERIFIED: `PostgresRepository.listMyReviewAssignments` has no cursor or limit contract.
- VERIFIED: The repository does not expose a candidate-queue method equivalent to the measured memory list path.
- INFERENCE: Add purpose-scoped candidate and assignment queries with keyset pagination, explicit maximum limits, stable tie-breakers, and unprivileged role tests.
- UNKNOWN: Query plans and RLS overhead require an approved disposable or preview PostgreSQL environment with representative synthetic cardinality.

### R3. Decompose Concentrated Runtime Modules

- VERIFIED: `src/platform.mjs` is 1,450 lines and `public/app.js` is 1,902 lines at the inspected snapshot.
- INFERENCE: Preserve `QuestionPlatform` as the public facade while extracting resource visibility, revision, review, release, and governance services behind unchanged contracts.
- INFERENCE: Split the buildless client into native modules for transport and session state, selected-record context, renderers, and command handlers.
- INFERENCE: Characterization tests must pass unchanged before any new service-level tests are accepted.

### R4. Modularize Independent Evidence Validation

- VERIFIED: `src/validate-evidence.mjs` is 2,087 lines and the current stable validator run passes 20 of 20 files.
- VERIFIED: The package suite retains negative checks for missing, malformed, duplicate-key, stale-checksum, privacy, answer-leak, source-leak, release, and combined-handoff evidence failures.
- INFERENCE: Extract schemas, filesystem safety, privacy mathematics, release validation, and reporting into internal modules while preserving deterministic issue order and CLI exit semantics.
- INFERENCE: Keep intentionally independent authority constants independent, and bind cross-language behavior with frozen synthetic vectors rather than one self-validating implementation.

### R5. Preserve Migration Immutability

- VERIFIED: The candidate migration is 3,299 lines, defines 52 tables, and has not been applied by Darwin.
- PROTECTED: After the first authorized canonical application, the migration must not be edited, renamed, or replaced.
- INFERENCE: Later schema refactors should use forward migrations and preserving compensation with generated inventories for tables, functions, indexes, policies, triggers, grants, and forced RLS.

### R6. Strengthen Performance Regression Coverage

- VERIFIED: The existing performance test covers 5,000 sequential synthetic inserts and one bounded page with a 4,000 ms ceiling.
- INFERENCE: Add deterministic 10,001-row and 20,000-row cases covering first, middle, final, filtered, sorted, valid-cursor, and invalid-cursor behavior.
- INFERENCE: Record p50, p95, p99, heap delta, runtime version, machine class, and input hashes in an opt-in benchmark command separate from correctness tests.

## Blockers And Deferrals

- BLOCKED: Canonical MissionMed identity resolver and runtime session integration are not authorized or certified.
- BLOCKED: Canonical unprivileged PostgreSQL runtime wiring, grant manifest, promotion route, and rollback route are not proven.
- BLOCKED: Browser, assistive-technology, human workflow, staging, monitoring, backup, and production evidence are incomplete.
- BLOCKED: Real corpus extraction remains prohibited; no raw transcript or student-data benchmark is authorized.
- BLOCKED: Medical governance is unassigned, so no medical approval claim is permitted.
- BLOCKED: `performance_before_after.json` is ignored by the repository's broad `_AI_HANDOFFS/**` rule. Root must intentionally include it without changing ignore policy if the report is to enter a commit.

## Handoff To Root

- VERIFIED: Current local validation is green for the stable working snapshot, and no Darwin refactor needs acceptance.
- INFERENCE: Root should preserve exact commit `6ac62c5a0503981680f161fe5119d5e5e2fa031a` as the engineering checkpoint, intentionally include the ignored JSON report, and prioritize R1 before operational use at 10,000-plus queue depth.
- UNKNOWN: R2 performance acceptance remains open until an approved PostgreSQL route supports representative synthetic query-plan measurement.

============================================================
FILE: agents/darwin/refactors_completed.md
============================================================
# I1Q-1007X Darwin Refactors Completed

## Scope Completed

- VERIFIED: Darwin inspected exact integrated commit `6ac62c5a0503981680f161fe5119d5e5e2fa031a`, its application, evidence estate, validator, migration candidate, architecture handoff, and delegated authority.
- VERIFIED: Darwin measured local synthetic queue, pagination, filter, sort, HTTP, UI-algorithm, export, and test-duration behavior without production data.
- PROTECTED: No raw transcript text, student data, medical content, secrets, credentials, provider, staging, or production system was accessed.

## Evidence Inspected

- VERIFIED: Authority prompt lines 323 through 373 and 1629 through 1670 and `I1Q_1004C_COMBINED_HANDOFF.md` were inspected.
- VERIFIED: Runtime list paths, PostgreSQL repository methods, client list behavior, migration SQL, package scripts, performance tests, validator, and integrated evidence were inspected.
- VERIFIED: Current runtime hashes match the runtime files used by the preserved point-in-time benchmark.

## Findings

- VERIFIED: Exact-head package proof is 206 discovered, 205 pass, 0 fail, and 1 intentionally gated PostgreSQL skip.
- VERIFIED: Exact-head evidence validation passes 20 of 20 files with zero errors and claims `STATE_A`.
- VERIFIED: Root reports a separate disposable PostgreSQL result of 12 pass, 0 fail, and 0 skip.
- VERIFIED: Point-in-time 20,000-row local latency was low, but the browser client fetched only 200 rows and local filtering could not find a synthetic target at row 20,000.
- INFERENCE: Queue completeness and production datastore contracts are higher-priority risks than current in-memory latency.
- INFERENCE: Server-side allowlisted filters, stable sorting, keyset pagination, and bounded PostgreSQL methods are warranted before 10,000-plus operational use.

## Changes Made

- VERIFIED: Darwin refreshed only the five authorized report outputs.
- VERIFIED: No behavior-preserving application code refactor was performed.
- VERIFIED: Darwin did not modify application code, SQL, migrations, tests, evidence, packages, shared reports, authority files, feature flags, external systems, or Git state.

## Tests Performed

- VERIFIED: `npm run validate` passed 20 of 20 evidence files with 0 errors and claimed `STATE_A` at exact head `6ac62c5a0503981680f161fe5119d5e5e2fa031a`.
- VERIFIED: `env -u I1Q_POSTGRES_TEST_URL npm test` discovered 206 tests, passed 205, failed 0, and skipped 1 at the same exact head.
- VERIFIED: The skipped test is the intentionally gated disposable PostgreSQL apply, attack, compensation, and reapply proof.
- VERIFIED: Root separately supplied the 12 of 12 disposable PostgreSQL pass result; Darwin did not independently rerun it.
- VERIFIED: Earlier benchmark timings in `performance_before_after.json` are labeled `POINT_IN_TIME` and are not represented as current reruns.

## Risks

- VERIFIED: Client-side search, filter, sort, and paging operate on at most the first 200 fetched rows.
- VERIFIED: An unknown memory cursor silently restarts at page one.
- VERIFIED: PostgreSQL assignment listing is unbounded and no candidate-queue query plan was measured.
- VERIFIED: `src/platform.mjs`, `public/app.js`, `src/validate-evidence.mjs`, and the migration remain concentrated review surfaces.
- UNKNOWN: Production latency, RLS overhead, browser memory, concurrency, and transport behavior are not established.

## Blockers

- BLOCKED: No authorized canonical identity, preview, staging, production, monitoring, backup, or rollback route is proven.
- BLOCKED: Real-corpus extraction remains prohibited and all student and consumer flags remain off.
- BLOCKED: Medical governance is unassigned; no medical approval is claimed.
- BLOCKED: `performance_before_after.json` is ignored by the broad `_AI_HANDOFFS/**` Git rule and requires intentional Root inclusion if it belongs in a commit.

## Confidence

- VERIFIED: Confidence is high for exact-head local validation, package parity, static list-contract findings, point-in-time synthetic measurements, and the no-code-change statement.
- INFERENCE: Confidence is medium that query-contract work is the highest-value scale refactor because approved PostgreSQL and browser performance environments remain unavailable.
- UNKNOWN: No confidence is asserted for production behavior, medical correctness, privacy clearance, accessibility certification, or human usability.

## Exact Paths

- VERIFIED: `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/agents/darwin/refactor_plan.md`
- VERIFIED: `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/agents/darwin/refactors_completed.md`
- VERIFIED: `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/agents/darwin/performance_before_after.json`
- VERIFIED: `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/agents/darwin/maintainability_report.md`
- VERIFIED: `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/agents/darwin/behavioral_parity_report.md`

## Handoff To Root

- VERIFIED: There is no Darwin application refactor to accept, reject, deploy, or roll back.
- INFERENCE: Root should preserve exact engineering checkpoint `6ac62c5a0503981680f161fe5119d5e5e2fa031a`, intentionally include the ignored JSON report, and carry server-side query completeness as a pre-scale requirement.
- BLOCKED: Release, deployment, privacy, consumer activation, and medical approval vetoes remain unchanged by these local engineering proofs.

============================================================
FILE: agents/datastore_contracts/datastore_contract_review.md
============================================================
# I1Q-1007X Datastore Contract Review

## Verdict

VERIFIED: The offline static migration checks and fake-client repository checks pass in the current worktree.

UNKNOWN: No PostgreSQL instance was used. This packet does not prove migration application, database-enforced RLS behavior, role behavior, ownership behavior, or rollback execution.

## Scope

VERIFIED: This worker inspected but did not modify:

- `i1q-question-platform/db/migrations/20260715122434_i1q_1007x_question_platform.sql`
- `i1q-question-platform/db/rollback/20260715122435_i1q_1007x_compensating_disable.sql`
- `i1q-question-platform/db/migrations/0001_i1q_question_platform.sql`
- `i1q-question-platform/src/postgres-repository.mjs`

VERIFIED: This worker created or modified only the assigned tests and this three-file report directory.

## Test Evidence

VERIFIED: Initial focused run:

- Command: `node --test tests/migration-1007x.test.mjs tests/postgres-repository.test.mjs`
- Tests: 33
- Passed: 29
- Failed: 4
- Skipped: 0

VERIFIED: One initial failure was a test inventory omission. The migration correctly included `psychometric_snapshots` in its immutable table array, while the expected test list omitted it. The expected list was corrected before the stop instruction arrived.

VERIFIED: Three initial failures exposed repository behavior:

1. An invalid dedicated client with a usable release hook was rejected without invoking that release hook.
2. Null object input to purpose-scoped reader methods escaped as native `TypeError` before stable repository validation.
3. An explicitly undefined required channel payload reached the query boundary because `JSON.stringify(undefined)` did not throw.

VERIFIED: The repository implementation changed concurrently outside this worker's write scope. The preserved regression cases then passed without further test edits.

VERIFIED: Final focused run:

- Tests: 33
- Passed: 33
- Failed: 0
- Skipped: 0

VERIFIED: Final full local application suite:

- Command: `npm test`
- Tests: 195
- Passed: 194
- Failed: 0
- Skipped: 1

VERIFIED: The skipped test is the ephemeral PostgreSQL apply, reapply, role-attack, compensation, and reapply proof. It requires `I1Q_POSTGRES_TEST_URL` pointing to an isolated disposable local database.

## Covered Contracts

VERIFIED: Static migration tests cover:

- fail-closed grants and revocations
- complete forced RLS inventory
- immutable history and release records
- all six feature flags seeded off
- `auth.uid()` actor identity and database-owned role memberships
- answer-bearing data isolation
- restricted source reference isolation
- release evidence and identity binding
- forward-only preserving compensation
- static idempotency guards

VERIFIED: Fake-client repository tests cover:

- successful commit and release
- rollback on actor, setup, callback, driver, and commit failures
- aggregate preservation of transaction and rollback errors
- closed transaction handles
- read-only and isolation-level SQL
- purpose-scoped answer and restricted-source reads
- input shape, enum, hash, duplicate, and JSON validation
- malformed driver results

## Limitations

UNKNOWN: Static SQL inspection cannot prove PostgreSQL parser acceptance or behavior under the eventual canonical runtime role.

UNKNOWN: No provider, Supabase, staging, production, secret, environment value, network, or student data was accessed.

DO NOT TOUCH: No runtime grants, deployment, migration application, feature-flag change, production write, or protected runtime mutation was performed.

============================================================
FILE: agents/datastore_contracts/migration_static_verdict.md
============================================================
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

============================================================
FILE: agents/datastore_contracts/repository_adapter_verdict.md
============================================================
# I1Q-1007X Repository Adapter Verdict

## Verdict

VERIFIED: PASS for the current deterministic fake-client contract suite.

UNKNOWN: NOT PROVEN against PostgreSQL or a canonical MissionMed identity adapter.

## Current Evidence

VERIFIED: The 20 repository-specific tests pass.

VERIFIED: The tests use an in-memory fake dedicated client only. They require no PostgreSQL, network, secret, environment value, provider, or student data.

VERIFIED: Successful transactions issue:

1. `BEGIN`
2. An allowlisted isolation level with explicit read-only or read-write mode
3. `SELECT i1q.current_actor_id() AS actor_id`
4. Work queries
5. `COMMIT`
6. One client release

VERIFIED: A null actor prevents callback execution and causes rollback and release.

VERIFIED: Setup, callback, malformed driver, and commit failures cause rollback and release after `BEGIN` succeeds.

VERIFIED: A rollback failure produces an `AggregateError` retaining both the original and rollback errors, then releases the client.

VERIFIED: Transaction handles close after success and failure, preventing later queries.

VERIFIED: Answer and restricted-source reads call only the purpose-scoped database functions, with bound parameters.

VERIFIED: Shape, forbidden-field, enum, stable-string, lowercase hash, duplicate release identity, and JSON serialization checks occur before their work query in the covered cases.

## Observed Regressions And Current Resolution

VERIFIED: The initial focused run exposed three repository failures:

1. Invalid client cleanup did not call an available release hook.
2. Null reader input produced native `TypeError` instead of `PostgresRepositoryError` with `repository_input_object_required`.
3. Undefined required channel payload was not rejected before query execution.

VERIFIED: Concurrent implementation changes outside this worker's scope added invalid-client release, validation before destructuring for the three purpose-scoped readers, and a string-result check after JSON serialization. The unchanged regression cases now pass.

## Review Note

INFERENCE: `listMyReviewAssignments` still destructures its optional object parameter in the function signature. A null argument would fail closed before SQL but may surface a native `TypeError` rather than the stable repository error taxonomy. The stop instruction arrived before an additional regression case was added. Root should decide whether uniform null normalization is required.

## Residual Proof Gaps

UNKNOWN: The suite does not prove PostgreSQL type coercion, transaction isolation behavior, pool behavior, network interruption behavior, database policy enforcement, security-definer execution, runtime role grants, or production integration.

UNKNOWN: The adapter has no canonical provider connection or MissionMed identity resolver in this test packet.

DO NOT TOUCH: This verdict does not authorize PostgreSQL connection, Supabase access, migration application, deployment, production traffic, or feature activation.

============================================================
FILE: agents/ecosystem_mapper/auth_and_bootstrap_map.md
============================================================
# I1Q-1007X Authentication And Bootstrap Map

## Authority And Ownership

| Layer | Owner | Governing authority | Protected |
| --- | --- | --- | --- |
| Canonical user identity | WordPress | MR-078B Data Flow Contract | Yes |
| WordPress signed handoff | WordPress/HQ | DR-006 and existing HQ handoff contract | Yes |
| First-party auth proxy | WordPress/HQ | Critical Systems Contract | Yes |
| Encrypted application session | HQ Railway runtime | Critical Systems Manifest and HQ passport | Yes |
| Supabase Auth bootstrap | HQ to RANKLISTIQ | MR-078B and DR-006 | Yes |
| I1Q actor and assignment roles | Question Platform | DR-006 and 1004C | New app-owned mapping required |
| Shared auth edits and environment | Root Supervisor | Ownership matrix | Root-only |

Assignment-time authority label: DR-006 REVIEWED CANDIDATE, CANONICAL MERGE PENDING. A clean merge into MissionMed OS main 93c0404 was later observed. This map does not independently certify or exercise production auth authority.

## Active Runtime Owner

Railway starts:

    node missionmed-hq/server.mjs

Active source:

    /Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/missionmed-hq/server.mjs

Inactive lookalike:

    app/api/**

At the exact 5ae58b0 source baseline, the I1Q candidate starts its own local Node server, but non-demo API requests cannot authenticate because identityResolver is null. Its public health response reports AUTH_ADAPTER_REQUIRED, and protected APIs return production_identity_adapter_required. During validation, concurrent uncommitted repairs appeared in auth.mjs and server.mjs; they were inspected only as in-flight work and did not establish a fixed, integrated, independently certified auth baseline.

## Canonical Flow

### Redirect And Handoff Flow

1. Browser opens Arena, STAT, Daily, or a future dedicated I1Q route.
2. Browser calls GET /api/auth/start or the consumer attempts POST /api/auth/exchange.
3. WordPress or HQ redirects the user to the WordPress login/account route when needed.
4. WordPress admin-post action mmac_hq_auth_redirect verifies a logged-in WordPress user.
5. WordPress signs a short-lived handoff containing WordPress user ID, email, username, display name, roles, issue time, expiry, and nonce.
6. The signed token is redirected to HQ GET /api/auth/session with an allowlisted final URL.
7. HQ verifies the handoff, creates an encrypted session, bootstraps Supabase, sets an HttpOnly session cookie, and redirects to the final first-party route.

Source:

    /Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/wp-content/mu-plugins/missionmed-hq-auth-handoff.php

Observed handoff controls:

| Control | Current behavior |
| --- | --- |
| Handoff lifetime | 60 seconds |
| Signature | HMAC SHA-256 over a base64url payload |
| Return hosts | HQ Railway plus the WordPress host |
| Final hosts | WordPress hosts only |
| Logged-out behavior | Redirect to WordPress account login |
| Missing shared handoff secret | 503 hard failure |

### First-Party Proxy Flow

WordPress captures /api/auth/* before normal templates and proxies the request to the HQ Railway origin. It forwards method, body, cookies, and non-hop-by-hop headers, then relays status, response headers, Set-Cookie, and body.

Source:

    /Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/wp-content/mu-plugins/missionmed-hq-proxy.php

Safest I1Q use: keep the browser on the WordPress origin for the handoff and use a dedicated final I1Q route that Root explicitly allowlists. Do not add a parallel login, frontend signup, or token exchange.

### Session And Bootstrap Routes

| Route | Method | Current role | I1Q treatment |
| --- | --- | --- | --- |
| /api/auth/start | GET | Builds HQ session entry and WordPress auth redirect | Reuse unchanged |
| /api/auth/session | GET | Reads current session or exchanges signed handoff; may bootstrap Supabase | Reuse for browser entry; fix expiry first |
| /api/auth/validate-wp | POST | Resolves WordPress cookie or assertion to canonical identity and applies allowed-role gate | Root-only; do not globally widen roles for I1Q |
| /api/auth/exchange | POST | Exchanges WordPress auth for encrypted HQ session and cookie | Existing first-party consumer route |
| /api/auth/bootstrap | POST | Uses HQ session to ensure/provision RANKLISTIQ Supabase Auth and return session tokens | Existing Arena/STAT path; app adapter must not expose service credentials |
| /api/auth/logout | POST | Requires CSRF for an existing session, clears cookie | Reuse; test revocation and post-logout denial |

The browser consumers call Supabase setSession with bootstrap tokens and verify identity through supabase.auth.getUser. Arena, STAT, and Daily are pinned to RANKLISTIQ.

## I1Q Role Boundary

Current I1Q application roles:

| I1Q role |
| --- |
| platform_admin |
| content_operator |
| author |
| editorial_reviewer |
| physician_reviewer |
| release_manager |
| privacy_officer |
| incident_owner |
| read_only |
| system |

These are not WordPress roles and must not be inferred directly from a WordPress role string. The safest mapping is:

1. Canonical HQ identity yields stable actor ID wp:<wordpress_user_id>, verified email, and session provenance.
2. I1Q looks up app-specific roles and active review assignments in the i1q schema.
3. The server begins a database transaction.
4. The server sets transaction-local actor and role context from its own mapping.
5. Queries execute through an I1Q repository; the browser never sets database role context.
6. The transaction is committed or rolled back and connection context is cleared by transaction scope.
7. Sensitive source and answer records require explicit privacy, assignment, phase, and finalization checks beyond a broad role.

Do not:

- Accept actor ID or app roles from request JSON or headers.
- Derive physician credentials from a WordPress role, title, or name.
- Add I1Q roles to MMHQ_ALLOWED_WP_ROLES as a shortcut.
- Share a Supabase service-role credential with the browser.
- Add public grants to the i1q schema.
- Reuse the HQ session secret in another service without a separate reviewed decision.

## Safest Adapter Choice

Preferred architecture:

| Component | Ownership | Behavior |
| --- | --- | --- |
| Dedicated I1Q service | Question Platform | Hosts I1Q UI/API only |
| Canonical session validation | Root/HQ | Narrow server-to-server introspection or signed app assertion after shared-auth repair |
| Role mapping | I1Q | App-owned role and assignment records |
| Database session | I1Q server | RANKLISTIQ server connection; transaction-local trusted actor/roles |
| Browser | I1Q | Receives only app-safe API payloads; never raw database credentials |

Fallback architecture: mount an isolated I1Q route module in HQ and add one protected dispatch point. This lowers cross-service session sharing but touches missionmed-hq/server.mjs, a protected active runtime, and therefore requires a separate decision, Root ownership, critical-system gates, and all HQ dependent-product tests.

The mapper does not recommend copying HQ encryption logic or its secret into the I1Q repository. A duplicated session implementation would create a parallel security boundary and complicate expiry, rotation, revocation, and rollback.

## Confirmed Shared-Auth Risks

| ID | Finding | Evidence | Impact | Owner | Required baseline |
| --- | --- | --- | --- | --- | --- |
| AUTH-01 | readEncryptedSession warns for missing, invalid, or expired expiresAt but returns the payload. | missionmed-hq/server.mjs lines 1026-1037 | Expired encrypted cookie or bearer sessions can remain accepted. Release-blocking for I1Q and shared consumers. | Root plus HQ/Auth Security | Unit and integration tests proving expired/missing dates return unauthenticated; Arena/STAT/HQ regression |
| AUTH-02 | SESSION_SECRET always falls back to random bytes, while startup, exchange, persistence, and health checks test SESSION_SECRET instead of CONFIGURED_SESSION_SECRET. | missionmed-hq/server.mjs lines 79-83, 577-579, 612-614, 751-753, 2231-2238 | Missing required environment secret can look configured; sessions rotate on restart and exchange is not actually disabled as messages claim. | Root plus HQ/Auth Security | Production startup hard fail on absent configured secret; restart persistence; no secret output |
| AUTH-03 | buildCorsHeaders reflects request Origin when MMHQ_ALLOWED_ORIGIN is blank and allows credentials. | missionmed-hq/server.mjs lines 3058-3070 | A future I1Q origin could accidentally broaden credentialed CORS instead of using a fixed allowlist. | Root plus HQ/Auth Security | Allowed WordPress/CDN/I1Q origins; hostile Origin denied; preflight and credential tests |
| AUTH-04 | At 5ae58b0 the I1Q candidate has no identityResolver implementation, no canonical role mapping, and no session revocation/CSRF proof. Later auth/server repair was observed in flight but not certified on one fixed commit. | i1q-question-platform/src/server.mjs and auth.mjs | No inspected baseline can yet be exposed to an authenticated audience. | Auth and Release Security Implementer for I1Q; Root for HQ bridge | Freeze the repair, integrate the Root-approved HQ bridge, and complete the auth matrix before preview |
| AUTH-05 | Candidate SQL trusts app.actor_id and app.actor_roles GUC values, while no trusted server repository or connection-pool isolation exists. | i1q-question-platform/db/migrations/0001_i1q_question_platform.sql | Caller or pooled-connection role confusion could bypass RLS if the adapter is wrong. | Architecture/Data and Auth Security | GUC spoof, pool reuse, transaction rollback, cross-assignment denial |
| AUTH-06 | Ordinary read roles can traverse broad generic application reads; independent security audit found answer/source and phase authorization failures. | I1Q source and Auth/Security audit packet | Authentication alone does not establish authorization or answer isolation. | Auth and Release Security Implementer | Closed-world response schemas and negative authorization tests |

## Required Auth Test Matrix

| Area | Tests required before preview |
| --- | --- |
| WordPress handoff | Valid, expired, malformed, wrong signature, replayed nonce, wrong return host, wrong final host, logged-out |
| HQ encrypted session | Valid cookie, valid bearer, malformed token, missing expiry, invalid expiry, expired, clock boundary, restart, rotated secret, revoked user |
| Cookie | Secure, HttpOnly, SameSite, path/domain, cross-origin behavior, logout clearing |
| CSRF | Missing, wrong, stale, cross-session, valid; every mutating app route |
| CORS | Each allowlisted origin, hostile origin, missing Origin, OPTIONS, credentials |
| Supabase bootstrap | Valid RANKLISTIQ project, provisioning idempotency, user mismatch, outage, token expiry/refresh, no key leakage |
| I1Q mapping | No roles, unknown role, read-only, each reviewer role, assignment scope, physician credential evidence, disabled actor |
| Database context | Actor and roles set locally inside transaction, spoof attempts ignored, pooled connection does not retain context |
| Error/logging | No handoff, cookie, bearer, refresh token, secret, source text, or answer in errors/logs |
| Dependent consumers | Arena, STAT, Daily auth entry and logout; HQ protected APIs; WordPress proxy |

## Tests Performed By Mapper

| Test | Result |
| --- | --- |
| Read-only route and code trace | Complete |
| Candidate BOOT/CURRENT read | Pass |
| Static Arena/STAT/Daily auth endpoint and RANKLISTIQ pin validation | Pass through VALIDATION/validate_deploy.sh |
| I1Q non-demo tests at the initial snapshot | Existing suite pass, 30 of 30; this does not clear the independent security veto |
| Concurrent auth/server repair | Observed uncommitted during validation; mapper did not execute it as a fixed auth candidate |
| Authenticated live session test | Not performed |
| Secret/environment inspection | Not performed; names only were read |
| Shared auth mutation | None |

## Blockers

- AUTH-01 and AUTH-02 require protected HQ repair before I1Q depends on the session.
- Root must choose and authorize the canonical app-specific session validation mechanism.
- The 5ae58b0 baseline lacks I1Q role and assignment mapping; later in-flight repair is not integrated or certified.
- No fixed inspected commit proves trusted transactional database context.
- CSRF, revocation, fixation, outage, and credentialed CORS evidence is absent.
- Independent security re-certification is required on one fixed integrated commit.

## Root Handoff

Keep missionmed-hq/server.mjs, WordPress relay/proxy files, shared environment, and allowed origins root-only. Assign only I1Q-owned auth and authorization repairs to the application implementer. After shared-auth defects are fixed independently, Root should publish a narrow adapter contract with input identity fields, expiry semantics, audience, error codes, role-mapping responsibility, logging rules, and rollback behavior before any app integration begins.

============================================================
FILE: agents/ecosystem_mapper/collision_risk_register.md
============================================================
# I1Q-1007X Collision Risk Register

## Reading Rule

This register is source-level pre-mutation evidence. `OBSERVED` means the condition is present in tracked or current working-tree files. `RUNTIME UNKNOWN` means this mapper did not query production application, database, environment, or deployment state. No finding authorizes a protected-system edit.

Authority baseline: MissionMed OS `93c0404794fe105235b80514c75fffc3177f140b`, current DR-006, MR-078A, MR-078B, MR-079, Critical Systems Contract/Manifest, Matrix Runtime Lock, STAT Canon, and Architecture 1002.1.

## P0 Stop-The-Line Risks

| ID | Collision | Evidence | Runtime state | Impact | Owner and disposition |
| --- | --- | --- | --- | --- | --- |
| CR-001 | A tracked `bootstrap_match` RPC returns answer-equivalent fields, including answer, explanation, and correct index, before finalization and describes client-side grading. This conflicts with DR-006 class A isolation, MR-078B server-authoritative scoring, and the STAT sealed-pack contract. | `supabase/migrations/20260424121038_create_bootstrap_match_rpc.sql` | UNKNOWN whether applied/current | Pre-answer disclosure and scoring bypass | STAT/Data owner must establish production truth and retire or replace only through a new forward migration; I1Q must never depend on this RPC |
| CR-002 | Encrypted HQ sessions warn on missing, invalid, or expired `expiresAt` and still return the payload. | `missionmed-hq/server.mjs`, `readEncryptedSession` | OBSERVED in source; production parity UNKNOWN | Expired cookie or bearer session acceptance across shared consumers | HQ/Auth owner; fail closed, then independently regress Arena, STAT, HQ, Daily, and logout |
| CR-003 | HQ creates a random session secret when the configured secret is absent, while startup, exchange, persistence, and health checks test the always-present fallback. This conflicts with the Critical Systems Contract hard stop. | `missionmed-hq/server.mjs`, `CONFIGURED_SESSION_SECRET`, `SESSION_SECRET`, startup and exchange checks | OBSERVED in source; environment not inspected | Missing production configuration can look healthy; restart invalidates sessions | HQ/Auth owner; hard fail on absent configured secret and prove restart persistence without exposing values |
| CR-004 | Three backup `.php` route files are tracked directly in the auto-loaded mu-plugin root. The Critical Systems Contract explicitly stops deployment when a backup or duplicate PHP file sits there. | `wp-content/mu-plugins/arena-route-proxy_BACKUP_20260427_101948_A7-ARENA_ECO_FINETUNE-codex-high-2000-i.php`; `arena-route-proxy_BACKUP_20260427_102810_A7-ARENA_ECO_FINETUNE-2000-i-sync.php`; `stat-route-proxy_BACKUP_20260427_102810_A7-ARENA_ECO_FINETUNE-2000-i-sync.php` | OBSERVED in tracked source; Kinsta parity UNKNOWN | Duplicate hook/function loading, route collision, fatal redeclaration, or stale behavior | WordPress/Root owner; remove from auto-load root only under protected deployment procedure, then run full gate |
| CR-005 | Critical deploy baseline is incomplete: the manifest requires `.railwayignore`, which is absent; current HQ source differs from the known-good manifest pin. | `/Users/brianb/MissionMed/_SYSTEM/CRITICAL_SYSTEMS_MANIFEST.json`; missing worktree `.railwayignore`; diff of `missionmed-hq/server.mjs` from pinned commit | OBSERVED locally; production parity UNKNOWN | Railway bundle contamination or deployment from an unapproved baseline | Root/Release owner; reconcile manifest, ignore file, source commit, production hash, imports, and rollback before any deploy |
| CR-006 | Root Railway configuration always starts MissionMed HQ; there is no dedicated I1Q service declaration or local GitHub workflow. An attempted repository deployment could redeploy HQ rather than launch I1Q. | root `package.json`, `railway.json`, absent `.github/workflows/`, `i1q-question-platform/package.json` | OBSERVED | Protected-runtime replacement or silent non-deployment of I1Q | Root/Release owner; register a dedicated service/build context and pin its source/branch/rollback |
| CR-007 | The I1Q SQL is a design file named `0001_i1q_question_platform.sql`, lacks the required MR-078A header, and has no verified RANKLISTIQ promotion route. Root migrations are declared to target Growth Engine. | `i1q-question-platform/db/migrations/0001_i1q_question_platform.sql`; MR-078A/B | OBSERVED; SQL never applied by this mapper | Wrong-project migration, history desynchronization, or untested forced-RLS behavior | Architecture/Data designs; Root selects canonical path and applies preview-first; never copy into the Growth Engine route by convenience |

## P1 Integration Risks

| ID | Collision | Evidence | Runtime state | Required resolution |
| --- | --- | --- | --- | --- |
| CR-008 | Candidate RLS trusts `app.actor_id` and comma-separated `app.actor_roles` settings, while no proven server transaction/pool boundary sets and clears them. Generic reads allow any non-null actor. | I1Q candidate SQL session helpers and generated policies | Design-only | Build a server-owned repository; use transaction-local context; test GUC spoofing, pool reuse, rollback, cross-role, and cross-assignment denial |
| CR-009 | STAT Canon requires `get_duel_pack` to return exactly seven envelope fields. Tracked RPC source returns `{status, duel, questions}`, and the private duel object contains additional fields. | `_SYSTEM/STAT_CANON_SPEC.md`; `supabase/migrations/20260420113000_stat_canon_rpcs.sql`; `LIVE/stat.html` normalization | Source collision; active DB definition UNKNOWN | STAT owner ruling and production introspection before any adapter or dataset release |
| CR-010 | STAT Canon requires client hash recomputation; MR-078B says `content_hash` exists only server-side and is never recomputed client-side. | STAT Canon section 1/4; MR-078B source-of-truth rule | Authority conflict remains unresolved | STAT owner and authority maintainer must publish one precedence ruling; I1Q preserves the frozen test vector meanwhile |
| CR-011 | DR-006 requires question metadata identity to be `(dataset_version, question_id)`. Tracked `public.question_metadata` uses `question_id` alone as primary key and defaults version to `1.0`. | `supabase/migrations/20260426170000_mmos_arena_intel_question_metadata.sql` | Source collision; active DB state UNKNOWN | Additive composite-compatible design plus historical-join migration after owner review; never rewrite attempts or v4 rows |
| CR-012 | Drill ownership is split across authorities and runtime: MR-078B assigns `drill_registry` to Growth Engine; Arena/Daily use RANKLISTIQ controls; current `/api/drills` is an MMVS Railway registry. | MR-078B; `LIVE/arena.html`; `LIVE/daily.html`; `mmvs-drills-proxy.php` | OBSERVED | Drills/Data/Root must pin project, schema, table/API, ingestion owner, and stable key before certification |
| CR-013 | HQ CORS reflects the request Origin with credentials when the configured allowlist is blank. | `missionmed-hq/server.mjs`, `buildCorsHeaders` | Source observed; environment UNKNOWN | Require a fixed allowlist and deny hostile/missing origins as appropriate; test WordPress, CDN, and any dedicated I1Q origin |
| CR-014 | WordPress signs a nonce into each 60-second handoff, but the HQ parser validates signature/time and no nonce-consumption or replay store was observed. | `missionmed-hq-auth-handoff.php`; `missionmed-hq/server.mjs`, `parseWordPressHandoffToken` | Static absence observed; external mitigation UNKNOWN | HQ/Auth owner must prove one-time semantics or explicitly accept bounded replay risk; test same-token reuse |
| CR-015 | The Critical Systems Manifest omits `/api/auth/validate-wp` and `/api/auth/logout` from `auth_core.critical_routes` and does not list the WordPress handoff/proxy files as protected paths. I1Q is unregistered. | `/Users/brianb/MissionMed/_SYSTEM/CRITICAL_SYSTEMS_MANIFEST.json` | OBSERVED | Root must register every protected route/file, smoke expectation, owner, and rollback before extending auth |
| CR-016 | `MM-AUTH-ARCH-001` is referenced by MR-078B/MR-079 but absent. Product index entries for HQ, Arena, Matrix, and USCE point to passport paths absent at OS commit `93c0404`. | canonical file search; `products_index.json`; `PRODUCT_PASSPORTS/` | OBSERVED authority gap | Authority maintainer must file or remove stale references; until then runtime-backed contracts are evidence, not a substitute architecture ruling |
| CR-017 | DR-006 defines a separate authorized-internal-candidate-review flag. Candidate SQL implements only internal platform, STAT, Drills, and student booleans. | DR-006 Feature Flags; I1Q candidate SQL and `platform.mjs` | Design-only; no runtime flags exist | Add the missing independently controlled flag in the reviewed schema/API, default false, with audit and rollback behavior |
| CR-018 | Daily requires a nonempty transcript URL, while Drills allows explicit transcript absence. The new I1Q sidecar represents transcript availability explicitly but is not wired to either consumer. | `LIVE/daily.html`; `LIVE/drills.html`; `src/adapters/drills-v1.mjs` | Adapter exists locally; consumer flags off | Drills/Daily owner must approve a backward-compatible sidecar rule; do not weaken Daily silently or fabricate a URL |
| CR-019 | The HTML deployment primer names legacy local source paths and direct upload semantics, while current manifest/script use `LIVE/*`, a Git gate, R2 STAGING-to-LIVE promotion, and wrapper checks. | `_SYSTEM/PRIMER_EXT_HTML_DEPLOY.md`; `_SYSTEM/DEPLOY_MANIFEST.json`; `_SYSTEM/deploy.sh` | OBSERVED documentation drift | Runtime/manifest wins; authority owner must reconcile prose before adding I1Q mappings |
| CR-020 | Historical v4 seed SQL uses `ON CONFLICT ... DO UPDATE`, while current authority treats `dataset_questions` as immutable after seed. | `supabase/migrations/20260420111000_stat_dataset_ingest.sql`; MR-078B INV-6; DR-006 | Historical source observed; applied state not queried | Never rerun or edit the applied artifact as an I1Q mechanism; publish a new additive dataset version through the owner route |
| CR-021 | MR-078A first labels `migration repair --status applied` banned, then permits it under strict reconciliation conditions. MR-079 and DR-006 are stricter for this mission. | MR-078A sections 3.2, 3.3, and 5.4; MR-079; DR-006 | Documentation conflict | I1Q rule is unambiguous: no repair, no history rewrite, forward migrations and reviewed forward compensation only |

## P1 Current Build Risk

| ID | Observation | Evidence | Disposition |
| --- | --- | --- | --- |
| CR-022 | The concurrent I1Q working snapshot is not green: 76 tests ran, 66 passed, and 10 failed. Six failures were localhost bind `EPERM` in this sandbox; four were implementation regressions involving release fixture identity and role behavior. | `npm test` in `i1q-question-platform` during this mapping run | Do not infer production readiness. The owning agents must repair the four real regressions and rerun API tests in an environment that permits localhost binding on one fixed commit |
| CR-023 | The worktree changed during mapping as other agents committed adapter work and modified auth. Any hash or test result is a point-in-time snapshot. | Git HEAD/status observations during the run | Root must freeze one integration commit before security, UX, RLS, consumer, and release certification |

## Standing Release Gates

| Gate | Current state |
| --- | --- |
| Internal authenticated platform | OFF by DR-006 until release certification |
| Authorized internal candidate review | OFF by DR-006; separate candidate implementation flag absent |
| Raw transcript access | Restricted |
| Physician approval | Unavailable; credentialed medical governance lead unassigned |
| Student content | OFF |
| STAT consumer | OFF |
| Drills consumer | OFF |
| Preview/staging/internal production | Not proven |
| Rollback/reapply and monitoring | Not proven |

## Resolved During Mapping

The inherited draft reported four root dependency advisories. The current lock resolves the cited package versions, and `npm audit --offline --json` returned zero known vulnerabilities. This removes that stale draft finding only; it does not clear the application, auth, datastore, deployment, or consumer gates above.

## Verdict

`BLOCK`. Read-only inventory and privacy-safe engineering may continue. No shared mutation, migration, protected deployment, consumer activation, or student publication is supportable from the current baseline.

============================================================
FILE: agents/ecosystem_mapper/deployment_route_map.md
============================================================
# I1Q-1007X Deployment Route Map

## Authority Snapshot

| Evidence | Verified state |
| --- | --- |
| MissionMed OS | Clean `main` at `93c0404794fe105235b80514c75fffc3177f140b`; local `origin/main` points to the same commit |
| Current mission | `I1Q-1006` is active; its next action is execution of `I1Q-1007X-MA` with student, STAT, and Drills consumer flags off |
| Integration authority | DR-006 is merged and indexed as `I1Q_DR_006`; SHA-256 `8126c24b1d8f2b36439aad13d82e63b3f0cc5b3666abe29eb2f794ee5e068dae` |
| Missing authority | `MM-AUTH-ARCH-001` is referenced by MR-078B and MR-079 but no matching authority file exists in the canonical local trees |
| Production rule | Runtime truth wins; manifest pins determine deploy readiness; protected deployment requires the Critical Systems Contract gate |

No deployment, migration, feature-flag change, cache operation, or live probe was performed by this mapper.

## Route Summary

| Surface | Current source | Control plane | Runtime destination | Current I1Q status |
| --- | --- | --- | --- | --- |
| MissionMed HQ | `missionmed-hq/server.mjs` | External GitHub-to-Railway binding is implied by the protected runtime, but its branch/service configuration is not stored here | Railway, start command `node missionmed-hq/server.mjs` | Protected dependency only; not an I1Q deployment target |
| WordPress auth and wrappers | `wp-content/mu-plugins/*.php` | Kinsta/WordPress deployment mechanism is not represented in this worktree | WordPress first-party routes and auth relay | Protected dependency; no I1Q route registered |
| Arena/STAT/Drills/Daily HTML | `LIVE/{arena,stat,drills,daily}.html` | `_SYSTEM/deploy.sh` with Git upstream gate, validation, R2 staging, promotion, cache handling, and runtime checks | R2/CDN `html-system/STAGING/*` then `html-system/LIVE/*`; WordPress proxies preserve first-party routes | Existing consumers only; I1Q must not use this path without a new manifest mapping and approval |
| RANKLISTIQ data | Separate protected migration route required by MR-078B/DR-006 | Canonical GitHub preview/staging process; exact workflow not found locally | RANKLISTIQ additive `i1q` schema | Authorized target, but no apply-ready migration or route evidence exists |
| Growth Engine data | Root `supabase/migrations/` per MR-078B | MR-078A-governed migration process | Growth Engine project | Not the I1Q datastore target |
| I1Q service | `i1q-question-platform/` | No workflow, Railway service declaration, host registration, or production manifest entry found | Dedicated authenticated internal app required by DR-006 | Not deployed |

## HQ Production Route

The verified repository route is:

```text
reviewed Git commit
  -> externally configured Railway source binding (branch and trigger UNKNOWN)
  -> Nixpacks build from repository root
  -> railway.json deploy.startCommand
  -> node missionmed-hq/server.mjs
  -> HQ health/auth/bootstrap/media/API routes
```

Verified files:

- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/package.json`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/railway.json`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/missionmed-hq/server.mjs`
- `/Users/brianb/MissionMed/_SYSTEM/CRITICAL_SYSTEMS_CONTRACT.md`
- `/Users/brianb/MissionMed/_SYSTEM/CRITICAL_SYSTEMS_MANIFEST.json`

`app/api/**` is an inactive lookalike for current Railway production. It must not be edited to repair HQ.

Deploy-readiness blockers:

- The Critical Systems Manifest pins known-good commit `3f0c27aac55dbf82748b3eaba360006d4041b539`; current `missionmed-hq/server.mjs` differs from that pin. Production parity was not queried.
- The manifest requires `.railwayignore`, but no such file exists in this worktree.
- The repository has no `.github/workflows/` directory, so the DR-006 canonical GitHub promotion route is not auditable from local files.
- Root `railway.json` always starts HQ. Deploying the repository as-is does not start the I1Q package.
- The exact Railway project, production branch, automatic-deploy trigger, environment binding, and rollback selector are external configuration and remain UNKNOWN.

## WordPress And CDN Routes

| First-party route | Runtime source | Verified proxy |
| --- | --- | --- |
| `/arena` | `html-system/LIVE/arena.html` | `wp-content/mu-plugins/arena-route-proxy.php` |
| `/stat` | `html-system/LIVE/stat.html` | `wp-content/mu-plugins/stat-route-proxy.php` |
| `/drills` | Drills or Daily artifact selected from request state | `wp-content/mu-plugins/drills-route-proxy.php` |
| `/daily` | `html-system/LIVE/daily.html` | `wp-content/mu-plugins/drills-route-proxy.php` |
| `/api/drills` | MMVS Railway registry | `wp-content/mu-plugins/mmvs-drills-proxy.php`; GET only |
| `/api/auth/*` | MissionMed HQ Railway | `wp-content/mu-plugins/missionmed-hq-proxy.php` |

The current HTML promotion implementation is:

```text
LIVE source files
  -> VALIDATION/validate_deploy.sh
  -> Git HEAD/upstream equality gate
  -> local rollback snapshot
  -> R2 STAGING upload
  -> VALIDATION/validate_runtime.sh --env STAGING
  -> R2 server-side copy to LIVE
  -> cache purge or cache-busted verification fallback
  -> VALIDATION/validate_runtime.sh --env LIVE
  -> CDN checksum and WordPress wrapper probes
```

The older `_SYSTEM/PRIMER_EXT_HTML_DEPLOY.md` names legacy local source paths and describes direct upload. Current `LIVE/*`, `_SYSTEM/DEPLOY_MANIFEST.json`, `_SYSTEM/deploy.sh`, and runtime behavior take precedence. The documentation drift requires owner reconciliation before extending the route.

## Supabase Promotion Boundary

DR-006 requires a new additive `i1q` schema in RANKLISTIQ, preview/staging first, through the canonical GitHub route. It prohibits manual production SQL, migration-history rewrites, and destructive rollback.

Current local state:

- `i1q-question-platform/db/migrations/0001_i1q_question_platform.sql` is a design artifact. Its filename and missing MR-078A header make it non-apply-ready.
- The design uses forced RLS and default-off flags, but it has not been run against preview, staging, or production Postgres.
- Root `supabase/migrations/` is declared by MR-078B to target Growth Engine even though it also contains historical STAT/RANKLISTIQ artifacts. It is not a safe location for an I1Q migration without an explicit route decision.
- No local workflow pins the RANKLISTIQ project, migration set, preview environment, approval gate, or promotion evidence.
- Growth Engine migration history is documented as desynchronized. No I1Q action may attempt to repair or reuse that history.

Required route before any database claim:

```text
reviewed, correctly named forward migration
  -> explicit RANKLISTIQ project/schema/object pin
  -> isolated preview apply and lint
  -> forced-RLS denial matrix and pooled-context tests
  -> forward compensating disable and reapply proof
  -> protected Arena/STAT regression baseline
  -> reviewed staging promotion
  -> internal production promotion with consumer flags off
```

## Required I1Q Route

No current route satisfies this sequence. Root must register one before deployment:

1. Pin one reviewed source commit and a dedicated I1Q build context.
2. Run unit, adapter, auth, privacy, accessibility, dependency, and evidence validation.
3. Apply only the reviewed RANKLISTIQ migration in preview; preserve migration history.
4. Validate canonical WordPress/HQ identity, app-owned role assignments, transaction-local database context, forced RLS, and negative authorization.
5. Deploy a dedicated internal service or a separately authorized HQ module; never silently replace HQ.
6. Run staging browser journeys and protected-consumer tests with internal platform, internal review, STAT, Drills, and student flags off.
7. Exercise feature-flag disable, known-good application rollback, forward database compensation, and post-rollback tests.
8. Promote only authenticated internal access after independent release review. Consumer and student activation remain separate decisions.

## Rollback Route

DR-006 defines the controlling rollback behavior:

- Disable internal platform and consumer flags.
- Redeploy the last known-good application artifact through the canonical GitHub route.
- Use only a reviewed forward compensating migration for datastore disablement.
- Preserve audit events, source hashes, immutable revisions, release evidence, sealed packs, and historical joins.
- Never rewrite migration history, mutate frozen STAT datasets, force-push, use `railway up`, replace runtime files directly, or make undocumented cache changes.

The candidate compensating SQL exists at `i1q-question-platform/db/rollback/0001_compensating_disable.sql`, but execution has not been proven on an authorized database.

## Deployment Verdict

`BLOCKED_FOR_I1Q_DEPLOYMENT`. Authority exists for a gated internal path, but the local repository does not contain a complete I1Q GitHub workflow, dedicated runtime registration, apply-ready RANKLISTIQ migration route, protected manifest coverage, or rollback/reapply evidence. Existing HQ, WordPress, Supabase, and CDN routes remain protected and unchanged.

============================================================
FILE: agents/ecosystem_mapper/ecosystem_dependency_graph.md
============================================================
# I1Q-1007X Ecosystem Dependency Graph

## Scope Completed

Read-only mapping is complete for MissionMed OS boot, mission/product registries, the Question Platform passport and DR-006; canonical WordPress, Railway HQ, and Supabase authentication; RANKLISTIQ and Growth Engine ownership; Matrix, Arena, STAT, Drills, and Daily Rounds; MMVS, CIE, Stream, R2/CDN, transcript, VTT, nodes, and Drive source paths; legacy v4 identity; and the GitHub, Railway, Supabase, WordPress, and CDN deployment routes.

The worktree changed during mapping as other agents committed I1Q-owned adapter work and modified I1Q implementation files. Those repairs are preserved and recorded as in-flight, not release-certified. No protected consumer, shared auth runtime, shared migration, MissionMed OS, feature flag, or deployment file was changed by this mapper. A frozen integration commit is required before certification.

## Authority Snapshot

| Evidence | Current observation |
| --- | --- |
| MissionMed OS `main` | `93c0404794fe105235b80514c75fffc3177f140b` |
| Local `origin/main` | Same commit; OS worktree clean |
| Mission registry | `I1Q-1006` active; `I1Q-1007X-MA` is the current next action |
| DR-006 | Merged, indexed as `I1Q_DR_006`, SHA-256 `8126c24b1d8f2b36439aad13d82e63b3f0cc5b3666abe29eb2f794ee5e068dae` |
| Product passport | `PRODUCT_PASSPORTS/question-platform.md`; internal build authorized and student release blocked |
| Auth architecture gap | `MM-AUTH-ARCH-001` is referenced by MR-078B/MR-079 but absent from both canonical local trees |
| Protected passport gap | Product index paths for HQ, Arena, Matrix, and USCE are absent at this OS commit |

DR-006 is current authority, not a pending candidate. This mapper did not exercise migration, deployment, feature-flag, or consumer-activation authority.

## Ecosystem Shape

    MissionMed OS BOOT / CURRENT / registry / passport / DR-006
                                  |
                                  v
                  Dedicated I1Q internal application
                    |             |              |
          identity adapter   DB repository   source adapters
                    |             |              |
                    v             v              v
    WordPress -> HQ Railway -> RANKLISTIQ   MMVS / CIE / Stream / R2
       identity    session      i1q schema    transcript / VTT / nodes
                       |
                       v
              Supabase Auth bootstrap
                 |            |
                 v            v
               Arena -------> STAT
                 |
                 +----------> Daily Rounds -----> Drills

    Matrix shares the protected WordPress estate but has no authorized
    direct I1Q integration in this wave.

## Dependency Findings

| Boundary | Owner | Authority | Coupling | Protected status | Safest adapter | Required baseline |
| --- | --- | --- | --- | --- | --- | --- |
| MissionMed OS | Root Supervisor and Brian | BOOT, authority index, DR-006, Question Platform passport | Selects all downstream authority | Root-only | No adapter; append-only authority procedure | BOOT, CURRENT freshness, registry resolution, clean main |
| I1Q app | Question Platform; Root integrates | DR-006, 1004C, passport | Internal authoring/review/release | Isolated candidate | Dedicated app with narrow auth and DB adapters | Existing 30 tests plus negative security and DB tests |
| WordPress identity | WordPress and HQ | MR-078B, DR-006 | Identity and signed handoff | Protected | Reuse handoff; app-owned role mapping | Expiry, signature, host allowlist, role denial |
| HQ Railway session | HQ | Critical Systems Contract and Manifest, DR-006 | Cookie/bearer session and Supabase bootstrap | Protected active runtime | Root-owned introspection or isolated app route after security repair | Expiry, revocation, CSRF, secret, CORS, outage |
| RANKLISTIQ | Arena/STAT data plane; Root migrates | MR-078B, DR-006 | Auth, STAT, future i1q schema | Protected shared project | Additive schema with server transaction context | Preview migration, forced RLS, pooling, rollback, consumer smokes |
| Growth Engine | HQ/Growth data plane | MR-078A/B | CRM, media, contract-listed drill registry | Protected and history-desynchronized | Existing owner APIs only | Project pin and migration-history reconciliation |
| Matrix | Matrix | Delegated Matrix lock | Shared estate only | Protected active | No I1Q adapter | Guard, hashes, all App Mode routes |
| Arena | Arena | Critical Systems Manifest and MR-078B; indexed passport file is absent | Routes STAT and Daily; shared auth | Legacy protected | No Arena edit | Auth entry, project pin, route and avatar smokes |
| STAT | STAT | STAT Canon, MR-078B, DR-006 | Exact nine-field dataset and sealed packs | Frozen protected contract | New dataset release projection only | Nine fields, hash vector, answer isolation, joins |
| Drills | Drills/MMVS ingestion owner | DR-006, deployment lock | Playback, required nodes, optional transcript | Ingestion protected | I1Q-owned read-only availability sidecar exists locally; consumer wiring remains prohibited | Registry, nodes, transcript, VTT, playback, launch; owner certification absent |
| Daily Rounds | Daily surface with Drills/Arena | DR-006, Arena route contract | Five-field registry rows and control table | Protected shared runtime | Reuse Drills sidecar; no source write | Required fields, active filter, launch route |
| MMVS registry | MMVS/Drills ingestion owner | DR-006 read-only | Canonical current Drills and Daily source | Read-only for I1Q | Hash and inventory only | GET-only, schema, duplicate, reachability |
| CIE media routes | HQ Media/CIE | HQ runtime, DR-006 | Optional authenticated media metadata and chunks | Protected | Read-only owner endpoint | Auth gate, health, detail, no mutation |
| Stream/R2/CDN | Media owner and Root deploy owner | DR-006, HTML lock | Playback, source objects, runtime HTML | Protected | Metadata/object reads; GitHub-only runtime writes | Host, MIME, hash, CDN and wrapper checks |
| Transcript/VTT/nodes | Media/Drills plus Privacy Owner | DR-006, 1004C | Restricted extraction sources | Restricted | Redact before extraction; persist only safe segments | Speaker, identity, patient, timestamp, no-raw-log tests |
| Drive | MissionMed file owner plus Privacy Owner | DR-006 | Optional authorized corpus | Read-only if allowlisted | File-ID allowlist and hashes | Rights, owner, MIME, privacy |
| Legacy v4 | STAT | DR-006, STAT Canon | Read-only reconciliation and old joins | Immutable | Static hashed export and composite mapping | Counts, hash, duplicates, historical joins |
| GitHub delivery | Root and Release/Reliability | DR-006, critical contract, MR-078A | Preview through internal production | Root-only | Commit-pinned workflow with rollback | CI, staging, consumers, rollback, monitoring |

## Supabase Ownership

| Project | Authority domain | I1Q treatment |
| --- | --- | --- |
| RANKLISTIQ, fglyvdykwgbuivikqoah | Arena, STAT, dataset questions, duel state, telemetry, Supabase Auth | Authorized target for the additive i1q schema |
| Growth Engine, plgndqcplokwiuimwhzh | HQ CRM, media tables, Data Flow contract drill catalog | Not the I1Q datastore target |
| Scheduler staging, avpdetdkpwmqqxtvomix | Scheduler staging | No I1Q dependency |

The root supabase/migrations directory is declared to target Growth Engine, while STAT migrations use a separate RANKLISTIQ route. The candidate file i1q-question-platform/db/migrations/0001_i1q_question_platform.sql is therefore a design artifact, not an apply-ready migration.

## Current State

| Capability | State |
| --- | --- |
| Mission/product registration and DR-006 | Canonical and current at OS commit `93c0404`; release certification remains separate |
| I1Q runtime | Local synthetic or auth-adapter-required server |
| Persistence | `MemoryRepository` only; no RANKLISTIQ repository proven |
| Canonical identity adapter | Absent; I1Q auth hardening is not a canonical HQ resolver |
| RANKLISTIQ repository | Absent |
| Candidate SQL | Unapplied and MR-078A filename/header/route noncompliant |
| Real corpus | State A inventory evidence: 97 of 97 rows have playback, transcript, and nodes |
| Privacy-safe corpus | Privacy owner accepts all 97 as source-level verified_drj; 96 may support a future segment allowlist, one is zero-retention; all remain extraction-blocked |
| STAT channel | Baseline exact projection plus a committed adapter repair at 4724a24; direct tests pass; consumer flag off and owner certification absent |
| Drills channel | Explicit-availability adapter exists locally; integration and consumer-owner certification absent; flag off |
| Legacy v4 | Sanitized evidence hashes 845 static v4 rows and a 3,961-row CDN runtime collection; zero ID overlap, no import, and no production DB read |
| Daily, Arena, other channels | Contract-only; no I1Q activation |
| Internal platform/review flags | Off |
| Student flag | Off |
| Preview/staging/internal production | Not proven or deployed |
| Rollback/monitoring | Not executed or proven |
| Security | Not certified; current shared-auth and application-test findings remain release-blocking |
| UX/accessibility | Independent certification is not current on one frozen integrated commit |

## Dependency Audit

The offline audit result is not release evidence because the local advisory cache did not contain the current records. A current online `npm audit --json` reported four advisories across three vulnerable packages: high severity for `form-data`, moderate and high severity for `ws`, and low severity for transitive `esbuild`. No critical advisory was reported. Root must perform an isolated compatible dependency update and rerun repository tests before dependency clearance. This remains separate from auth, datastore, deployment, consumer, privacy, and application-test gates.

## Proposed File Ownership

| Owner | Exclusive scope |
| --- | --- |
| Ecosystem Mapper | agents/ecosystem_mapper only |
| Adapter and Identity Implementer | contracts.mjs, exports.mjs, new src/adapters files, new adapters-security test |
| Auth and Release Security Implementer | auth.mjs, server.mjs, platform.mjs, new security-regressions test |
| Privacy Normalization Implementer | privacy.mjs, pipeline.mjs, new privacy-regressions test |
| Evidence Validator Implementer | new validate-evidence.mjs, new validator test and fixtures |
| Architecture and Data | New I1Q repository design and new canonical migration candidate; Root chooses canonical path and applies it |
| Consumer owners | Tests and explicit approval for their own protected products; no I1Q agent edits protected consumer files |
| Root Supervisor | MissionMed OS, HQ/WordPress auth, shared migrations, protected runtimes, GitHub workflows, Railway, R2/CDN, flags, secrets, deployment, rollback, monitoring |

## Tests Performed

| Test | Result |
| --- | --- |
| Candidate BOOT and CURRENT read | Pass; no blocked mission or stale marker observed |
| Candidate/main DR-006 SHA-256 and routed file diff | Pass; identical |
| Initial source protected/application diff from 5ae58b0 | Pass at initial trace |
| Validation snapshot refresh | I1Q adapter commit and in-flight I1Q repairs observed; protected/shared paths still unchanged |
| I1Q npm test before concurrent repairs | Historical pass, 30 of 30 |
| Direct adapter repair suite at 4724a24 | Historical pass, 34 of 34; consumer-owner certification still absent |
| Current full I1Q snapshot | Not certified by this mapper. A 76-test, 66-pass, 10-fail run occurred while concurrent implementation edits were incomplete and is retained only as transient diagnostic evidence. Root must certify the final frozen integration commit. |
| Local protected-consumer validation | Pass; VALIDATION/validate_deploy.sh |
| I1Q npm run validate | Expected fail; src/validate-evidence.mjs is missing |
| npm audit online | Four advisories across `form-data`, `ws`, and transitive `esbuild`; dependency gate remains open |

No live browser, authenticated production, database, migration, network deployment, feature-flag, rollback, or monitoring test was performed by this mapper.

## Handoff To Root Supervisor

1. Accept this graph as the pre-mutation protected-consumer baseline.
2. Preserve all consumer flags off.
3. Treat `collision_risk_register.md` P0 findings as stop-the-line before any shared mutation or deploy.
4. Assign shared HQ expiry, configured-secret, CORS, nonce-replay, manifest-coverage, and mu-plugin findings to the protected-system owners.
5. Require Architecture/Data to produce a new canonical RANKLISTIQ migration candidate, then have Root run preview RLS and rollback/reapply evidence.
6. Obtain a STAT owner ruling on the frozen seven-field pack specification, tracked wrapper/client shape, answer-equivalent `bootstrap_match` response, and Data Flow client-hash contradiction.
7. Require Drills/Daily owner approval and protected-consumer tests for the local read-only explicit-availability sidecar.
8. Do not enter staging until security, UX, privacy, deployment-route, application tests, and protected-consumer gates are green on one fixed commit.

============================================================
FILE: agents/ecosystem_mapper/media_source_map.md
============================================================
# I1Q-1007X Media Source Map

## Authority Boundary

DR-006 authorizes read-only inventory and privacy-safe internal derivation from MissionMed-owned Dr. J sources. Authorized classes include current media, Drills and Daily Rounds registries, Stream, R2/CDN metadata, transcript, VTT, nodes, transcript JSON, nodes JSON, authorized transcript chunks, authorized static exports, and authorized MissionMed Drive corpus files.

Source mutation is prohibited. Raw sources remain restricted. Student speech, patient identifiers, and third-party identities are removed by default. Only privacy-safe working transcripts may enter extraction.

Assignment-time label: DR-006 REVIEWED CANDIDATE, CANONICAL MERGE PENDING. A clean unchanged merge into main was later observed; Root retains final authority acceptance.

## Source Zones

| Zone | Permitted content | Permitted operation | I1Q destination |
| --- | --- | --- | --- |
| Z0 restricted source | Registry metadata, playback references, raw transcript/VTT/nodes, transcript chunks, source objects | Read, hash, classify, redact in restricted process | Only source hash, rights, privacy state, availability, and lineage |
| Z1 privacy-safe working | Redacted text with student, patient, and third-party identity removed; speaker policy applied | Normalize, segment, concept extraction | i1q.normalized_transcript_segments and derived lineage |
| Z2 candidate quarantine | Source-linked candidate questions and evidence | Internal generation and review only | I1Q candidate and review records |
| Z3 release artifact | Approved immutable revisions | Server-safe channel projection | STAT/Drills adapters while flags remain owner-controlled |
| Z4 public/student | Physician-approved, rights/privacy-cleared release | Not authorized in this wave | Student release remains off |

## Current Registry Route

| Layer | Route/source | Owner | Access | Consumers |
| --- | --- | --- | --- | --- |
| WordPress first-party proxy | https://missionmedinstitute.com/api/drills | WordPress plus Drills/MMVS | GET only | Browser and authorized inventory |
| Proxy implementation | /Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/wp-content/mu-plugins/mmvs-drills-proxy.php | WordPress/Drills | Proxies only exact /api/drills | Daily, external first-party path |
| Upstream registry | https://mmvs-backend-production.up.railway.app/api/drills | MMVS/Drills ingestion owner | GET | Arena, Daily, Drills |
| Daily source | LIVE/daily.html | Daily/Drills | Direct GET with credentials omitted | Daily Rounds |
| Drills source | LIVE/drills.html | Drills | GET with credentials included | Drills runtime |

The named human owner for MMVS ingestion was not found in the inspected authority set. System ownership is clear: Drills/MMVS ingestion remains unchanged. Root must obtain the current human owner before adapter certification.

## Real Corpus Evidence

Sanitized evidence:

    /Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/I1Q_1007X_CORPUS_INVENTORY.md

    /Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/evidence/corpus_inventory_summary.json

    /Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/agents/privacy_rights/privacy_release_verdict.md

| Measure | Observation |
| --- | ---: |
| Registry rows | 97 |
| DRJ_DRILLS rows | 97 |
| Rows with playback | 97 |
| Rows with nodes | 97 |
| Rows with transcript | 97 |
| Rows with all three | 97 |
| Empty video IDs | 0 |
| Duplicate video ID groups | 0 |
| Transcript requests / HTTP 200 | 97 / 97 |
| Nodes requests / HTTP 200 | 97 / 97 |
| Transcript records | 81,604 |
| Nodes records | 81,604 |
| Multi-speaker sources | 97 |
| Explicit Dr. J label | 96 |
| Generic-only Dr. J evidence | 1 |
| Source-level verified_drj classification | 97 |
| Potential restricted exact-match segment allowlist after all privacy gates | 96 |
| Generic source requiring zero segment retention | 1 |
| Sources with potential identity labels | 97 |
| Privacy-safe working transcripts | 0 |
| Extraction-ready sources | 0 |

All observed transcript and nodes artifacts were application/json. Transcript records expose segment_id, speaker, start_time, end_time, and text. Nodes add node_id. No source text, title, filename, URL, or personal name was retained in the sanitized inventory.

The Privacy Owner classified all 97 sources as source-level verified_drj because the authoritative registry category satisfies DR-006. That does not classify individual speakers. Ninety-six sources are only potential restricted exact-match allowlist candidates after all privacy controls pass; the generic source must retain zero segments until authoritative speaker mapping exists.

Current state: REAL_CORPUS_INVENTORIED; PRIVACY VERDICT BLOCKS ALL 97 FROM EXTRACTION, CANDIDATE GENERATION, AND DOWNSTREAM CONTENT USE.

## Consumer Field Contracts

### Daily Rounds

Daily rejects rows missing any of:

| Required field |
| --- |
| video_id |
| title |
| playback_url |
| nodes_url |
| transcript_url |

Daily also derives or accepts stream_id, reads public.drill_registry_control for active state, and launches /drills?video_id=<id>. The current direct Supabase client is pinned to RANKLISTIQ.

Sources:

    /Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/LIVE/daily.html
    /Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/wp-content/mu-plugins/drills-route-proxy.php

### Drills

Drills requires:

- playback_url or stream_id
- nodes_url

Drills treats a missing transcript_url as explicit and non-blocking. An invalid supplied transcript URL produces a warning. Supported nodes shapes include a flat array, drill_nodes, drillNodes, and nodes. Raw nodes segments are normalized and merged into turns for pause behavior.

Supported transcript collections include arrays and wrappers named nodes, segments, transcript_chunks, chunks, transcript, and nested data variants.

Sources:

    /Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/LIVE/drills.html
    /Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/wp-content/mu-plugins/drills-route-proxy.php

### Exact 5ae58b0 I1Q Drills Artifact

The exact source-target baseline artifact contains only:

- item_revision_id
- prompt
- concept_id
- source_ids
- review_status

It does not expose video_id, playback, transcript, VTT, or nodes availability and is not compatible with either protected consumer.

Source:

    /Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/i1q-question-platform/src/exports.mjs

Post-baseline observation: commit 4724a24 added src/adapters/drills-v1.mjs plus contract/export changes. It represents playback, nodes, transcript, and VTT independently, requires playback and nodes, carries source and working hashes, and directly validates the five-field Daily row. The tracked test set passed 34 of 34 at that snapshot. This is repair evidence only: no protected runtime integration, real-corpus projection, Drills/Daily owner certification, fixed integrated security/privacy candidate, or flag decision was observed. Both consumer flags must remain off.

## VTT Map

| Evidence | Result |
| --- | --- |
| DR-006 | VTT is an authorized read-only source class |
| Legacy root drill registry schema | public.drill_registry contains vtt_path and nodes_path |
| Seed evidence | One historical seeded row references a transcript VTT and nodes JSON |
| Current 97-row MMVS inventory | Registry exposes transcript_url and nodes_url; fetched artifacts were JSON |
| Local I1Q inventory evidence | local_vtt_files = 0 |
| Drive search | Zero VTT filename matches |

Conclusion: VTT support is authorized and must be represented explicitly by an adapter, but no separate VTT artifact was observed in the current real 97-row inventory. transcript_available does not prove vtt_available. The adapter must represent each availability independently and must not infer VTT from transcript JSON.

## Nodes And Transcript Source Paths

| Artifact | Current source | Shape | Required privacy treatment |
| --- | --- | --- | --- |
| Transcript JSON | transcript_url in MMVS row | Array of timestamped speaker text records | Restricted fetch, speaker classification, redaction |
| Nodes JSON | nodes_url in MMVS row | Timestamped speaker text records with node_id | Same; do not treat nodes as already privacy-safe |
| VTT | Legacy vtt_path or a future explicit URL | Not observed in current inventory | Same; parse cues through structured parser |
| Supabase transcript chunks | Growth Engine media_transcript_chunks through HQ/CIE | chunk_text, start_time, end_time | Owner-approved authenticated read only |
| Playback | playback_url or Stream stream_id | Cloudflare Stream iframe, HLS, or direct hosted reference | Metadata only for extraction unless clip rights exist |

## HQ Media And CIE Path

HQ exposes authenticated routes after the shared session gate:

| Route | Operation | I1Q treatment |
| --- | --- | --- |
| /api/media/health | CIE health | Read-only diagnostic |
| /api/media/search | Search | Optional read-only owner adapter |
| /api/media/unified | List | Optional read-only owner adapter |
| /api/media/unified/<id> | Detail plus transcript backfill | Optional restricted read |
| /api/media/list | List alias | Optional restricted read |

Mutation routes for favorite, rating, tags, playlists, clips, and upload are outside I1Q corpus authority and must not be called.

HQ configuration names read for routing only:

- MMHQ_CIE_BASE
- MMHQ_MEDIA_UPLOAD_BASE
- MMHQ_MEDIA_SEMANTIC_RPC
- MMHQ_STUDIO_BASE

No values, secrets, tokens, or keys were read or recorded.

Source:

    /Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/missionmed-hq/server.mjs
    /Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/supabase/migrations/20260402021500_vrs9d_media_system_schema.sql

## Stream And R2/CDN

| System | Current role | I1Q permission | Safest adapter |
| --- | --- | --- | --- |
| Cloudflare Stream | Video playback via stream_id/playback_url | Metadata and read-only playback reference | Preserve owner URL; never change object or settings |
| Cloudflare R2 | Static objects and protected runtime HTML | Read objects and metadata for corpus; deployment only through Root route | GET/head/hash for corpus |
| CDN | Serves LIVE arena, stat, drills, daily and source artifacts | Read and verify | No cache purge or replacement during corpus processing |
| WordPress | Routes/wraps protected CDN HTML | Read route behavior | No HTML/media upload target |

Runtime HTML is delivered from:

| WordPress route | CDN target |
| --- | --- |
| /arena | /html-system/LIVE/arena.html |
| /stat | /html-system/LIVE/stat.html |
| /drills | /html-system/LIVE/drills.html |
| /daily or /drills?entry=daily_rounds | /html-system/LIVE/daily.html |

I1Q has no CDN key, runtime route, deployment URL, or authorized ad hoc upload.

## Drive

The current connected Drive inventory reported no filename matches for VTT, transcript, drill, Dr. J, or Daily Rounds and no additional corpus source. This does not prove absence because indexing, access scope, naming, and shared-drive boundaries may differ.

Safest future Drive adapter:

1. Root and source owner approve exact file IDs.
2. Record Drive file ID, owner, rights status, MIME, length, modified time, and SHA-256.
3. Fetch read-only into the restricted privacy process.
4. Persist no raw text or path in general repository evidence.
5. Promote only privacy-safe normalized segments.

## Ownership And Safest Adapters

| Boundary | Proposed owner | Adapter file ownership |
| --- | --- | --- |
| MMVS/Drills read adapter | Adapter and Identity Implementer after Drills owner contract | New i1q-question-platform/src/adapters files only |
| Availability projection | Adapter and Identity Implementer | contracts.mjs, exports.mjs, adapter tests |
| Privacy normalization | Privacy Normalization Implementer | privacy.mjs, pipeline.mjs, privacy tests |
| Restricted source policy | Privacy and Rights owner plus Root | Reports/policy only; no runtime source mutation |
| Media owner endpoint | Root plus HQ/Media owner | Shared HQ paths remain root-only |
| Registry ingestion | Existing Drills/MMVS owner | No I1Q writes |
| Stream/R2/CDN | Existing media/deployment owner | Root-only |
| Drive allowlist | Root plus file owner | Root authority/evidence only |

## Baseline Tests

| Test family | Required result |
| --- | --- |
| Registry | Stable video IDs, no duplicates, fields explicit, GET only |
| Artifacts | Allowed hosts, HTTP success, MIME, length, SHA-256, shape, timestamps |
| Availability | playback, transcript, VTT, nodes represented independently |
| Speaker | 0.95 or better attribution accuracy under DR-006 threshold |
| Privacy | patient recall at least 0.995; student-name recall at least 0.99 |
| Rights | Internal derivation allowed; public excerpt/clip disabled unless explicit current record |
| Provenance | Source hash and exact timestamp range on every derived claim |
| Consumer | Drills and Daily contract tests against read-only sidecar |
| Mutation | No POST, PUT, PATCH, DELETE, SQL write, upload, cache purge, or registry change |

## Blockers

- All 97 real sources contain multiple speakers and potential identity labels.
- All sources are source-level verified_drj, but the generic source lacks authoritative segment-level Dr. J mapping and must remain zero-retention.
- No privacy-safe working transcript has been created.
- Student speech, patient identifiers, and third-party identities have not been removed from the real corpus.
- No real source is extraction-ready.
- VTT is not observed for the real inventory and must not be inferred.
- MMVS human ownership and the Supabase project ownership of drill tables need Root confirmation.
- The 5ae58b0 Drills projection is incompatible; the 4724a24 adapter repair remains unintegrated and uncertified by Drills/Daily owners.
- Public quotation, excerpt, clip, and student publication rights remain closed.

============================================================
FILE: agents/ecosystem_mapper/protected_consumers_matrix.md
============================================================
# I1Q-1007X Protected Consumers Matrix

## Baseline Rule

This is a pre-mutation matrix. No protected consumer was edited, deployed, migrated, or activated. DR-006 is recorded as REVIEWED CANDIDATE, CANONICAL MERGE PENDING at assignment time. MissionMed OS main 93c0404 later showed the candidate merged unchanged; Root acceptance and all release certification remain outside this mapper's authority.

## Consumer Matrix

| Consumer | System owner | Runtime/data authority | Current coupling to I1Q | Protected status | Safest backward-compatible adapter | Minimum baseline before shared mutation | Current verdict |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Matrix | Matrix; delegated runtime lock | Matrix Runtime Lock Protocol and Manifest; Matrix passport | No direct I1Q consumer. Shares WordPress identity, Kinsta estate, and global release risk only. | Protected active delegated lock | None in this wave. Any future link requires a separate Matrix decision and manifest registration. | Guard preflight; exact asset hashes; dashboard, calendar, scheduler, filevault, messages, storyforge App Mode smokes; Return to Matrix Dashboard; rollback hash proof | UNTOUCHED; no adapter authorized |
| Arena | Arena | Arena passport; Critical Systems Manifest; MR-078B | Authenticates through HQ/RANKLISTIQ; routes to STAT and Daily; reads drill controls. | Legacy protected | Do not edit Arena for I1Q. Publish only an additive STAT dataset release or read-only Drills sidecar after each owner certifies it. | Static deploy validator; authenticated entry; RANKLISTIQ pin; no signUp/service-role exposure; avatar/profile hydration; /stat and /drills?entry=daily_rounds; browser console; rollback | ACTIVE AND UNCHANGED |
| STAT | STAT | STAT_CANON_SPEC; MR-078B; DR-006 | Future consumer of exact I1Q nine-field dataset rows. Existing sealed duel and telemetry runtime remains separate. | Frozen protected contract | New server-side dataset version and release projection. No active v4 mutation, pack rewrite, answer_map exposure, client fallback, or historical-attempt rewrite. | Exact nine fields; fixed SHA-256 vector; exact pack owner ruling; choice order; participant gate; pre-answer answer/explanation absence; post-finalization answer only; old-attempt and metadata joins; Arena route; rollback | FLAG OFF; owner ruling required before integration |
| Drills | Drills and existing MMVS ingestion owner | DR-006; Drills current API contract; HTML Deployment Lock | Future sidecar consumer. Current runtime loads playback or stream ID, required nodes, and optional transcript from /api/drills. | Ingestion ownership protected | Add I1Q-owned read-only projection keyed by stable video_id and explicit playback, transcript, VTT, and nodes availability. Never alter registry ingestion. | GET array contract; duplicate IDs; host allowlist; playback adapter; required nodes; explicit optional transcript; flat/wrapped node normalization; transcript wrapper normalization; launch and return; no source mutation | FLAG OFF; 5ae58b0 artifact incompatible; 4724a24 adapter repair passed direct tests but lacks integration and owner certification |
| Daily Rounds | Daily surface with Drills/Arena integration ownership; distinct human owner not found | DR-006; Arena route contract; HTML Deployment Lock | Reads MMVS registry and RANKLISTIQ drill_registry_control; requires video_id, title, playback_url, nodes_url, transcript_url; launches Drills. | Protected shared runtime | Reuse the Drills owner sidecar and existing launch contract. Do not add an I1Q write path or duplicate registry rows. | Five required fields; active filter; credentials/cross-origin behavior; selected drill payload; /drills?video_id launch; /drills?entry=daily_rounds entry; Arena return; rollback | NO I1Q CHANNEL ACTIVE |
| MissionMed HQ | HQ | Critical Systems Contract and Manifest; HQ passport | Required canonical session and identity bootstrap for the dedicated internal app. | Protected active Railway runtime | Root-owned app-specific session introspection or isolated route after shared auth repair; app-owned role/assignment mapping. | Missing-secret hard fail; expiry/revocation/fixation; cookie/bearer parity; CSRF; CORS allowlist; WordPress outage; Supabase outage; logout; logs contain no tokens | REQUIRED DEPENDENCY; not ready for I1Q |
| WordPress auth relay | WordPress and HQ | MR-078B; DR-006 | Signed 60-second handoff and first-party /api/auth proxy. | Protected | Reuse unchanged. Add app audience/final route only through Root review; do not widen global accepted roles. | Logged-out redirect; signature tamper; expiry; nonce replay; return/final host allowlist; cookie forwarding; Set-Cookie forwarding | ACTIVE SHARED DEPENDENCY |
| RANKLISTIQ | Arena/STAT data plane; Root migration owner | MR-078B; Critical Manifest; DR-006 | Authorized home of additive i1q schema and canonical Supabase Auth identity. | Protected shared datastore | New MR-078A-compliant migration plus server repository with trusted transaction-local actor and assignment roles. | Preview migration; project pin; forced RLS; anonymous, cross-role, cross-assignment, GUC-spoof, pooled-connection tests; immutable records; rollback/reapply; Arena/STAT regression | TARGET AUTHORIZED; route and implementation absent |
| Growth Engine | HQ/Growth data owner | MR-078A/B | Owns CRM/media and contract-listed drill tables; root migration directory targets it. It is not the I1Q schema target. | Protected and migration-history desynchronized | Existing owner read APIs only. Never route I1Q SQL here because the local directory happens to exist. | Project pin; migration list/history reconciliation; no RANKLISTIQ object assumptions | NO I1Q WRITES |
| MMVS drill API | MMVS/Drills ingestion owner; named human owner not found | DR-006 read-only source authority | Canonical current source for Drills and Daily. | Read-only source for I1Q | Inventory, hash, and fetch only; persist derived lineage in i1q. | GET-only; content schema; duplicate/empty IDs; hash; URL reachability; no PUT/PATCH/DELETE | 97 real rows inventoried |
| CIE/HQ Media | HQ Media Engine and CIE | HQ runtime; MR-078B media ownership; DR-006 | Optional authenticated media metadata and transcript chunk route. | Protected | Owner-provided read endpoint or static export; never use mutation routes. | Auth gate; health/list/detail; transcript chunk authorization; no favorite/rate/tag/playlist/clip/upload calls | PATH EXISTS; not wired to I1Q |
| Stream and R2/CDN source objects | Media owner; Root controls runtime deployment | DR-006; HTML Deployment Lock | Playback and source artifact delivery; CDN also serves protected runtime HTML. | Protected | Source metadata and GET only during corpus work. Runtime upload only via canonical GitHub route. | Host, MIME, length, hash, no mutation; for deploy: staging checksum, wrapper smoke, cache and rollback proof | NO I1Q DEPLOYMENT |
| Transcript, VTT, nodes | Media/Drills owner; Privacy Owner processes | DR-006; 1004C privacy gates | Restricted source for privacy-safe derivation. | Restricted | Restricted fetch -> hash -> speaker classification -> redaction -> privacy-safe normalized working transcript. | Student-name recall, patient recall, third-party removal, speaker attribution, timestamp coverage, no raw logs, rights state | 97 transcript JSON and 97 nodes JSON available; all 97 source-level verified_drj; 96 only potentially eligible after every privacy gate; one generic source is zero-retention; VTT not observed; zero privacy-safe working transcripts |
| MissionMed Drive | File owner and Privacy Owner | DR-006 for authorized MissionMed corpus files | Optional source only. | Read-only if explicitly allowlisted | File-ID allowlist with owner, rights, MIME, and hash evidence. | Access scope; ownership; rights; MIME/hash; privacy normalization | No additional corpus found; absence not proven |
| Legacy v4 and attempt joins | STAT | DR-006; STAT Canon; MR-078B | Read-only hashed reconciliation, duplicate mapping, replacement, and retirement planning. | Immutable | Reconcile owner-approved static and CDN exports as separate immutable collections, then map with composite dataset_version plus question_id. Never silently join on question_id alone. | Row count/hash; no source write; collision map; old attempts; sealed packs; question_metadata version identity | Sanitized evidence: 845 static v4 rows and 3,961 CDN runtime IDs, zero overlap; no import or production DB access; historical attempt-join proof still absent |

## Shared Baseline Commands And Evidence

| Baseline | Existing path or command | Mapper result |
| --- | --- | --- |
| I1Q unit/API/static suite at 5ae58b0-era snapshot | npm test in i1q-question-platform | PASS, 30 of 30 |
| Adapter/security direct suite after 4724a24 | node --test with the tracked test set | PASS, 34 of 34; this is not protected-consumer or integrated release certification |
| Protected HTML static contract | bash VALIDATION/validate_deploy.sh | PASS |
| Evidence validator | npm run validate in i1q-question-platform | FAIL, target file missing |
| Matrix guard | /Users/brianb/MissionMed/_SYSTEM/tools/matrix_runtime_guard.py | Not run because no Matrix path was touched |
| Critical systems gate | /Users/brianb/MissionMed/_SYSTEM/tools/critical_systems_gate.py | Not run because no protected path was touched |
| Live consumer smokes | VALIDATION/validate_runtime.sh plus browser journeys | Not run |
| Supabase RLS/migration | Preview RANKLISTIQ environment | Not run; no canonical migration route |
| Rollback/reapply | Canonical GitHub route | Not run |

## Contract Collisions Requiring Owner Ruling

| ID | Collision | Required owner |
| --- | --- | --- |
| PC-01 | STAT Canon requires exactly seven get_duel_pack fields, while the tracked SQL returns status, a broad duel object, and questions; current client normalizes additional fields. | STAT owner and Root architect |
| PC-02 | STAT Canon requires client hash recomputation, while MR-078B says content_hash is never recomputed client-side. | STAT owner and authority maintainer |
| PC-03 | DR-006 requires exact nine-field dataset rows and composite metadata identity, while current public.question_metadata uses question_id alone as primary key. | STAT/Data owner |
| PC-04 | MR-078B assigns drill_registry to Growth Engine, while current Arena/Daily are pinned to RANKLISTIQ and the current MMVS /api/drills path is a separate Railway source. | Drills ingestion owner, Data owner, Root |
| PC-05 | 1004C deferred Daily Rounds, while later DR-006 recognizes a future Daily channel. | Question Platform architect and Daily owner |

## Proposed File Ownership

| Change class | Proposed owner | Files |
| --- | --- | --- |
| I1Q projection adapters | Adapter and Identity Implementer | i1q-question-platform/src/contracts.mjs, exports.mjs, new adapters files, new adapter tests |
| I1Q auth/release controls | Auth and Release Security Implementer | i1q-question-platform/src/auth.mjs, server.mjs, platform.mjs, new security tests |
| Privacy normalization | Privacy Normalization Implementer | privacy.mjs, pipeline.mjs, new privacy tests |
| Evidence validator | Evidence Validator Implementer | new validate-evidence.mjs and new validator tests/fixtures |
| Canonical repository and SQL design | Architecture and Data | New I1Q-owned repository files and a new migration candidate |
| MissionMed OS, HQ, WordPress, shared SQL, protected consumers, workflows, deployment, flags | Root Supervisor with each system owner | Root-only; no implementation agent writes these paths without a new decision and ownership row |

## Release Position

No protected consumer can be activated from this baseline. Internal engineering and privacy-safe inventory may continue. Security, UX, auth, datastore, privacy, dependency, staging, rollback, monitoring, and dependent-product evidence must converge on one fixed commit before Root requests consumer-owner certification.

The worktree was concurrently advancing during this map. Commit 4724a24 added adapter files and direct tests, while auth, server, privacy, and pipeline repairs were later observed in flight. Those changes were inspected read-only and are not promoted by this report.

============================================================
FILE: agents/independent_red_team/independent_red_team.md
============================================================
# I1Q-1007X Independent Red Team

Ticket: `I1Q-1007X-MA`
Agent: `Agent 11, fresh-context Independent Red Team`
Initial audited engineering checkpoint: `6ac62c5a0503981680f161fe5119d5e5e2fa031a`
First post-repair checkpoint: `aebc98795f28fdfc2b130e118be762a30f536259`
Final post-repair checkpoint: `2d28d0b271b637f68358fd4aae414aa2f708c63f`
Final iterative-isolation checkpoint: `65bb52c4bd14d6d20145e666e3b95b6109dfef83`
Final SQL case-folding checkpoint: `ba17e22b0fe8a48a7397557ef95d2ceb454970d4`
Date: `2026-07-15`
State C verdict: `RELEASE VETO`
State A verdict: `SUPPORTED WITH EVIDENCE QUALIFICATION`

The initial audit and every prior rerun below are preserved. The current disposition is in `Final SQL Case-Folding Rerun: 2026-07-15`.

State C is not cleared. The latest checkpoint has strong local contract proof, but it is not an authenticated internal production system. Canonical auth, the unprivileged runtime role and grants, HTTP-to-Postgres wiring, staging, browser and accessibility proof, monitoring, operational rollback, and protected-consumer certification do not exist. The original Class D projection, reviewer-content defect, and IRT-009 SQL encoding bypass are now closed in local exact-checkpoint scope. No external or operational clearance follows.

State A is supported as a dated, aggregate, point-in-time corpus inventory attestation. The reported 97 registry rows, 97 transcript JSON references, 97 nodes references, 0 VTT references, 97 privacy-blocked sources, 0 working-redacted sources, 0 extraction-ready sources, 0 real candidates, and 0 physician approvals are internally consistent with the current reports. The exact 97-source and zero-candidate totals cannot be independently recomputed from a retained aggregate row manifest because the generator hard-codes the totals and digests.

## 1. Scope Completed

Completed a fresh-context, read-only review of MissionMed OS boot and current-state authority, the Question Platform passport, DR-006, architecture 1002.1 and amendment 1004C, Git history and diff through exact checkpoint `6ac62c5`, application and UI source, OpenAPI, primary SQL migration, compensating migration, repository adapter, tests, evidence validator, all current evidence files, root reports, and specialist reports for security, datastore, privacy, medical content, assessment science, UX, accessibility, release reliability, and ecosystem dependencies.

No production system, protected runtime, secret, configured environment value, source object, raw transcript, student data, Stream, R2, CDN object, Supabase, Railway, WordPress, or external datastore was accessed. No deployment, flag change, provider mutation, Git commit, or push was performed.

## 2. Evidence Inspected

Primary authority:

- `/Users/brianb/MissionMed_OS/BOOT.md`
- `/Users/brianb/MissionMed_OS/CURRENT.md`
- `/Users/brianb/MissionMed_OS/PRODUCT_PASSPORTS/question-platform.md`
- `/Users/brianb/MissionMed_OS/decisions/DR-006_i1q_question_platform_internal_integration.md`
- `/Users/brianb/MissionMed/_SYSTEM/CRITICAL_SYSTEMS_CONTRACT.md`
- `/Users/brianb/MissionMed/_SYSTEM/DATA_FLOW_CONTRACT.md`
- `/Users/brianb/MissionMed/_SYSTEM/SUPABASE_MIGRATION_PROTOCOL.md`
- `/Users/brianb/MissionMed/_SYSTEM/CODEX_EXECUTION_GUARDRAILS.md`

Binding architecture:

- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_fable/I1Q_STATQUESTIONS_1004C_ARCHITECTURE_AMENDMENT/I1Q_1004C_CHANNEL_SECURITY_AND_ANSWER_ISOLATION.md`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_fable/I1Q_STATQUESTIONS_1004C_ARCHITECTURE_AMENDMENT/I1Q_1004C_REVISED_ENTITY_AND_RELATIONSHIP_MODEL.md`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_fable/I1Q_STATQUESTIONS_1004C_ARCHITECTURE_AMENDMENT/I1Q_1004C_REVIEW_OPERATIONS_AND_GOVERNANCE.md`

Engineering and evidence:

- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/i1q-question-platform/src/`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/i1q-question-platform/public/`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/i1q-question-platform/tests/`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/i1q-question-platform/evidence/`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/i1q-question-platform/db/migrations/20260715122434_i1q_1007x_question_platform.sql`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/i1q-question-platform/db/rollback/20260715122435_i1q_1007x_compensating_disable.sql`

Root and specialist evidence included the corpus, privacy, auth, RLS, security, datastore, rollback, monitoring, staging, production, smoke, protected-system, dependent-product, UI, accessibility, pilot, batch, blockers, and human-action reports under `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/`.

## 3. Findings

### Evidence Classification

| Classification | Determination |
| --- | --- |
| Verified current fact | Git HEAD is exactly `6ac62c5a0503981680f161fe5119d5e5e2fa031a`. |
| Verified current fact | Package tests pass `205`, fail `0`, and intentionally skip `1` environment-gated PostgreSQL case. |
| Verified current fact | A fresh disposable PostgreSQL 16 run passes `12`, fails `0`, and skips `0`; it covers apply, exact reapply, role attacks, compensation twice, retained history, and reapply. |
| Verified current fact | Evidence validation passes `20/20` and claims only `STATE_A`; root `npm audit` reports `0` vulnerabilities. |
| Verified current fact | The committed evidence declares no deployment URL and all six flags false. This is file evidence, not a runtime query. |
| Verified current fact | No canonical identity resolver, runtime grant manifest, HTTP-to-Postgres wiring, staging URL, production URL, browser evidence, monitoring target, or operational rollback proof exists in the inspected checkpoint and packet. |
| Verified current fact | The generated Class C `stat_post_answer_debrief` contains the key `misconception_id`, which binding architecture classifies as Class D. |
| Verified current fact | Generic revision reads strip answer and rationale data for every role, while the UI has no purpose-scoped answer endpoint. Review screens can submit verdicts without displaying the required protected content. |
| Verified current fact | Repository evidence contains no real transcript, nodes, VTT, or real-candidate artifact. The only transcript fixture found is explicitly synthetic. |
| Point-in-time report | A 2026-07-15 read-only production inventory reports 97 registry rows, 97 transcript JSON responses, 97 nodes responses, 0 local VTT files, and 97 privacy-blocked sources. |
| Point-in-time report | Current root and specialist reports state 0 working-redacted sources, 0 extraction-ready sources, 0 real candidates, and 0 physician approvals. |
| Point-in-time report | Protected-runtime comparison reports four tracked-to-deployed hash divergences and no authenticated consumer smoke. This Red Team did not repeat that protected-runtime access. |
| Inference | State A is the highest supportable classification because authority exists, a detailed aggregate inventory report exists, all higher-state gates remain closed, and no real extraction or candidate artifacts exist. |
| Inference | No current student leak is occurring through I1Q because no I1Q deployment exists and all consumer and student flags are recorded off. This does not clear the release code. |
| Unverified claim | The external corpus still contains exactly 97 rows at the time this report is read. No current production query was permitted. |
| Unverified claim | A real runtime would preserve auth, RLS, answer isolation, source isolation, session revocation, and pool transaction isolation. |
| Unverified claim | The repaired UI meets the required score, WCAG 2.2 AA, responsive behavior, or human usability gates. |
| Unverified claim | Protected consumers have no regression, operational rollback is safe, monitoring works, or no answer or source leak exists in a future deployed runtime. |

### IRT-001: State C integration and operations do not exist

Severity: `CRITICAL`
Disposition: `STATE C RELEASE VETO`

Evidence:

- The migration labels itself an offline app-owned candidate and records unresolved auth, grants, preview, staging, and canonical migration routing at `i1q-question-platform/db/migrations/20260715122434_i1q_1007x_question_platform.sql:4-11`.
- The server accepts an injected resolver but the executable start path supplies none and starts in auth-required mode at `i1q-question-platform/src/server.mjs:132-170` and `i1q-question-platform/src/server.mjs:383-390`.
- The deployment record is `BLOCKED_NOT_DEPLOYED`, has no URL, records all flags false, and lists the missing auth, runtime role, staging, browser, and rollback gates at `i1q-question-platform/evidence/deployment_manifest.json:3-22`.
- Monitoring is a plan with no target or alert route. Rollback evidence is `DESIGNED_NOT_EXECUTED`.

Reproduction:

```sh
git rev-parse HEAD
nl -ba i1q-question-platform/src/server.mjs | sed -n '132,170p;383,390p'
nl -ba i1q-question-platform/evidence/deployment_manifest.json
```

Exact remediation:

1. Obtain the owner-approved canonical MissionMed identity resolver, including fresh session validation, revocation, logout, CSRF, trusted origins, role derivation, timeout, and outage behavior.
2. Add a reviewed least-privilege runtime grant migration for a named non-owner, non-superuser, non-`BYPASSRLS` role.
3. Wire the HTTP service to `PostgresRepository` with one dedicated transaction connection per actor context. Remove `MemoryRepository` from every non-synthetic start path.
4. Register the exact GitHub preview, staging, internal-production, rollback, and monitoring workflows and destinations.
5. Execute auth, RLS, pool-reuse, browser, accessibility, rollback, reapply, monitoring, and protected-consumer tests on one immutable commit.
6. For State C, prove `internal_platform_enabled=true` and `internal_review_enabled=true` while the four student and consumer flags remain false.

### IRT-002: Class D metadata leaks into the Class C student debrief

Severity: `HIGH`
Disposition: `BLOCK CONSUMER OR STUDENT RELEASE`; material release-validator defect

Evidence:

- Binding architecture says Class D never appears in a student artifact, classifies misconception IDs as D, and makes LT-5 a blocking test at `I1Q_1004C_CHANNEL_SECURITY_AND_ANSWER_ISOLATION.md:12-15`, `:31-37`, and `:68-74`.
- `projectStatDebrief` emits `misconception_id` in the Class C debrief at `i1q-question-platform/src/exports.mjs:72-86`.
- `buildReleaseArtifacts` labels that payload `stat_post_answer_debrief`, Class C at `i1q-question-platform/src/exports.mjs:119-146`.
- Release validation verifies caller-supplied official check labels and artifact metadata hashes, but does not execute LT-5 against the exact payload at `i1q-question-platform/src/exports.mjs:183-223` and `i1q-question-platform/src/platform.mjs:1109-1156`.

Reproduction:

```sh
cd i1q-question-platform
node --input-type=module -e "import { projectStatDebrief } from './src/exports.mjs'; const row={dataset_version:'d',question_id:'q',answer:'A',explanation:'x'}; const revision={answer:'A',correct_answer_rationale:'x',choices:[{key:'A'},{key:'B',why_tempting:'x',why_wrong:'x',misconception_id:'internal_tag'}]}; console.log(JSON.stringify(Object.keys(projectStatDebrief(row,revision).distractor_rationales[0]).sort()));"
```

Observed key set: `["choice_key","misconception_id","why_tempting","why_wrong"]`.

Exact remediation:

1. Remove `misconception_id` and every Class D field from the student debrief projection. Keep only permitted rationale prose.
2. Define a closed-world field policy for every Class C student channel, not only Class A.
3. Execute LT-1 through LT-6 against the exact serialized payloads before validation can be recorded.
4. Bind each test result, validator version, artifact hash, and immutable payload hash into validation evidence. Do not accept status labels as proof of execution.
5. Add a regression that fails whenever `misconception_id`, item IDs, claim IDs, reviewer IDs, source IDs, or psychometrics appear in any student-channel artifact.

### IRT-003: Assigned reviewers cannot inspect the answer and rationale content they attest

Severity: `HIGH`
Disposition: `STATE C INTERNAL REVIEW BLOCKER`

Evidence:

- Binding RBAC requires assigned editorial and physician reviewers to read Class B for their item, and UX-1 requires stem, choices, rationales, claims, source anchors, events, and flags in one screen at `I1Q_1004C_CHANNEL_SECURITY_AND_ANSWER_ISOLATION.md:61-64`, `:76-85`, and `I1Q_1004C_REVIEW_OPERATIONS_AND_GOVERNANCE.md:84-97`.
- Generic `item_revisions` sanitization strips choice rationale fields and recursively removes answer fields for every actor at `i1q-question-platform/src/platform.mjs:716-750`.
- SQL and the repository provide a purpose-scoped audited answer reader at `i1q-question-platform/db/migrations/20260715122434_i1q_1007x_question_platform.sql:1671-1768` and `i1q-question-platform/src/postgres-repository.mjs:116-126`.
- The HTTP route table exposes no answer-reader endpoint at `i1q-question-platform/src/server.mjs:294-370`.
- Distractor review explicitly reports that the answer key is withheld and no route exists at `i1q-question-platform/public/app.js:958-992`. Editorial and physician screens show rubrics and verdict controls but no answer, explanation, correct rationale, or distractor rationales at `i1q-question-platform/public/app.js:1060-1223`.

Reproduction:

```sh
rg -n "readItemRevisionAnswers|revision-answers|answer-access" i1q-question-platform/src/server.mjs i1q-question-platform/public/app.js i1q-question-platform/openapi.json
nl -ba i1q-question-platform/src/platform.mjs | sed -n '716,750p'
nl -ba i1q-question-platform/public/app.js | sed -n '958,992p;1060,1223p'
```

Exact remediation:

1. Add a purpose-scoped endpoint backed only by `PostgresRepository.readItemRevisionAnswers`.
2. Require an accepted assignment, active exact role, current credential for medical review, exact immutable revision hash, CSRF and origin validation, and a canonical identity context.
3. Audit every successful and denied protected-answer access without logging payload values.
4. Render stem, choices, answer, explanation, rationales, current claims, source anchors, flags, and prior review events in the required one-screen review view.
5. Prevent protected content from entering browser persistence, analytics, errors, logs, or generic resource caches.
6. Add negative tests for unassigned, open, completed, revoked-role, expired-credential, wrong-purpose, wrong-hash, and read-only actors.

### IRT-004: State A counts are internally consistent but not independently reproducible

Severity: `HIGH` evidence-integrity gap
Disposition: `STATE A SUPPORTED WITH QUALIFICATION`

Evidence:

- The generator hard-codes the two inventory digests and all 97-source totals at `i1q-question-platform/scripts/generate_evidence.mjs:170-209`. It hard-codes zero real candidates and approvals at `:220-228`.
- The validator checks that real-inventory digests look like hashes and that the classification and totals object exist, but it cannot recompute either digest or count at `i1q-question-platform/src/validate-evidence.mjs:1871-1877`.
- State A validation only requires `REAL_CORPUS_INVENTORIED` at `i1q-question-platform/src/validate-evidence.mjs:1906-1910`.
- The detailed point-in-time inventory attests 97 rows and 97 successful transcript and nodes probes at `I1Q_1007X_CORPUS_INVENTORY.md:13-56`, while also confirming 0 working transcripts and all 97 blocked at `:101-124`.

Reproduction:

```sh
nl -ba i1q-question-platform/scripts/generate_evidence.mjs | sed -n '170,228p'
nl -ba i1q-question-platform/src/validate-evidence.mjs | sed -n '1871,1910p'
rg -l "d78910d22ed3b428fd38129ec60140b70673a804a31ae3119e465d75b53631a1" .
```

Exact remediation:

1. Retain a privacy-safe aggregate manifest with one opaque, non-reversible source identity per authorized registry row.
2. For each row, retain only source digest, transcript status and digest, nodes status and digest, VTT status, speaker-evidence class, privacy status, extraction status, and probe timestamp. Retain no title, URL, path, speaker string, or source text.
3. Derive every count and aggregate digest from that manifest during evidence generation.
4. Make the validator recompute row counts, duplicate counts, status totals, and Merkle or canonical manifest digests.
5. Derive candidate and approval totals from an equivalent aggregate-only candidate-state manifest or a signed datastore query result. Do not use literals as release evidence.

### IRT-005: RLS is strong offline but unproven for the intended runtime

Severity: `HIGH`
Disposition: `RLS CLEARANCE WITHHELD FOR STATE C`

Evidence:

- Local PostgreSQL proof passed all 12 tests, including denial, active-role and credential checks, policy binding, compensation, and reapply.
- The migration derives identity from `auth.uid()` and current database memberships at `i1q-question-platform/db/migrations/20260715122434_i1q_1007x_question_platform.sql:934-980`.
- It revokes PUBLIC and built-in client access and explicitly says runtime grants are absent at `:3231-3255`.
- The default server constructs `QuestionPlatform`, whose default repository is `MemoryRepository`, at `i1q-question-platform/src/server.mjs:148` and `i1q-question-platform/src/platform.mjs:371-376`.

Reproduction:

```sh
rg -n "new QuestionPlatform|PostgresRepository|MemoryRepository" i1q-question-platform/src/server.mjs i1q-question-platform/src/platform.mjs
nl -ba i1q-question-platform/db/migrations/20260715122434_i1q_1007x_question_platform.sql | sed -n '3231,3255p'
```

Exact remediation:

1. Create the approved least-privilege runtime role and exact grants through the canonical migration workflow.
2. Prove the role is not owner, superuser, or `BYPASSRLS`, and cannot call compensation, audit append, unrestricted answer, or raw-source functions.
3. Wire the repository and test pooled connection reuse, transaction-local `auth.uid()`, logout and revocation, cross-user and cross-assignment denial, concurrent writes, and query plans in preview and staging.
4. Repeat the 12-test matrix using the exact deployed migration bytes and runtime role.

### IRT-006: No-leak claims are local only

Severity: `HIGH`
Disposition: `NO GLOBAL ANSWER-LEAK OR SOURCE-LEAK CLEARANCE`

Evidence:

- The local suite proves closed-world Class A pre-answer behavior and trusted post-answer finalization mechanics.
- Evidence validation reports no source-content leak in the 20 checked files, and repository inspection found no real transcript or real candidate artifact.
- The Class D debrief finding disproves complete student-channel leak enforcement.
- No canonical auth session, deployed browser network trace, production log scan, runtime artifact scan, cache test, or monitor probe exists.

Reproduction:

```sh
npm test
npm run validate
find i1q-question-platform -type f \( -iname '*.vtt' -o -iname '*transcript*.json' -o -iname '*nodes*.json' \) -print
```

Exact remediation:

1. Fix IRT-002 and IRT-003.
2. On authenticated staging, capture and scan response bodies, headers, browser storage, service logs, error traces, telemetry, generated artifacts, and cache paths for Class B, Class D, restricted-source, student, patient, and private-reference fields and values.
3. Run every role and phase, including failed auth, failed review, finalization, release validation, rollback, and reapply.
4. Store only privacy-safe test metadata, hashes, and counts as evidence, then obtain fresh independent clearance.

### IRT-007: Rollback, monitoring, and protected-consumer safety are not operationally proven

Severity: `HIGH`
Disposition: `STATE C OPERATIONS BLOCKER`

Evidence:

- The compensating migration is preserving and idempotent locally at `i1q-question-platform/db/rollback/20260715122435_i1q_1007x_compensating_disable.sql:1-20`.
- The evidence record still says `DESIGNED_NOT_EXECUTED` at `i1q-question-platform/evidence/rollback_manifest.json:3-14`.
- The protected comparison reports four tracked-to-deployed hash divergences and says the tracked files cannot be deployment or rollback truth at `I1Q_1007X_PROTECTED_SYSTEM_COMPARISON.md:21-53`.
- The dependent-product report explicitly distinguishes unchanged from tested green at `I1Q_1007X_DEPENDENT_PRODUCTS.md:19-25`.
- No monitor destination, probe, alert delivery, runbook execution, or alert-to-rollback drill exists.

Reproduction:

```sh
nl -ba i1q-question-platform/evidence/rollback_manifest.json
nl -ba _AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/I1Q_1007X_PROTECTED_SYSTEM_COMPARISON.md | sed -n '21,76p'
```

Exact remediation:

1. Reconcile each protected deployed hash to an owner-approved source and preserve the deployed bytes as rollback artifacts.
2. Execute the canonical staging migration, app deploy, compensation, prior-artifact redeploy, post-rollback auth and RLS checks, protected-consumer checks, and exact reapply.
3. Record operator, commit, artifact and migration hashes, timings, backup identity, feature states, and test results.
4. Configure privacy-safe health, auth, RLS, answer/source leak, audit-chain, flag, dependency, and hash-drift monitors.
5. Prove one alert delivery and one alert-triggered staging rollback before State C review.

### IRT-008: UI, accessibility, and required UX score are not proven

Severity: `HIGH`
Disposition: `STATE C UX AND ACCESSIBILITY BLOCKER`

Evidence:

- Browser evidence is `BLOCKED_NOT_RUN`, with zero viewport checks and zero screenshots at `i1q-question-platform/evidence/browser_results.json:3-27`.
- Accessibility evidence is `BLOCKED_NOT_RUN` and explicitly excludes browser, assistive technology, zoom, reflow, and human validation at `i1q-question-platform/evidence/accessibility_results.json:3-17`.
- The current scorecard preserves only a pre-repair simulated baseline, with category scores below the required floor and no post-repair rescore at `i1q-question-platform/evidence/ux_scorecard.json:3-20` and its final disclaimer.
- Binding architecture makes UX-1 through UX-10 and WCAG 2.2 AA release gates at `I1Q_1004C_REVIEW_OPERATIONS_AND_GOVERNANCE.md:84-102`.

Reproduction:

```sh
nl -ba i1q-question-platform/evidence/browser_results.json
nl -ba i1q-question-platform/evidence/accessibility_results.json
nl -ba i1q-question-platform/evidence/ux_scorecard.json | sed -n '1,45p'
```

Exact remediation:

1. Fix the protected reviewer-content workflow in IRT-003 and every currently open critical or high UX issue.
2. Run authenticated browser journeys for all 17 workflows and required failure states at 320, 390, 760, 768, 1024, 1280, 1440, and 1920 CSS pixels.
3. Run complete keyboard, VoiceOver, NVDA or equivalent, accessibility-tree, 200 percent zoom, 400 percent reflow, text-spacing, target-size, contrast, focus, and live-region tests.
4. Execute the human validation protocol with required personas.
5. Obtain a fresh independent score of at least `9.0` aggregate and at least `8.5` in every category on the exact State C candidate.

## 4. Changes Proposed Or Made

Made only the three report files owned by Agent 11. No application, migration, rollback, test, evidence, root report, specialist report, authority, protected file, feature flag, runtime, or Git state was changed.

Proposed changes are the exact remediation steps in IRT-001 through IRT-008. No remediation was implemented because this agent has report-only ownership.

## 5. Tests Performed

| Test | Result |
| --- | --- |
| `npm test` in `i1q-question-platform` | PASS: 205 pass, 0 fail, 1 intentional PostgreSQL skip |
| Fresh PostgreSQL 16 cluster plus `node --test tests/postgres-migration.test.mjs` | PASS: 12 pass, 0 fail, 0 skip |
| `npm run validate` | PASS: 20/20 files, 0 errors, claimed State A |
| Root `npm audit --omit=dev --audit-level=low` | PASS: 0 vulnerabilities |
| Synthetic key-only Class C debrief probe | FAIL contract: emitted `misconception_id` |
| Authenticated browser, accessibility, staging, production, monitoring, protected consumer, and operational rollback tests | NOT RUN |

The PostgreSQL cluster was created under `/tmp`, used only for the local disposable proof, stopped, and removed. No configured database URL or external datastore was used.

## 6. Risks

- Enabling internal review before the canonical auth and datastore wiring exists could either fail closed or expose memory-backed behavior that is not protected by SQL RLS.
- Reviewers can currently attest medical and editorial criteria without seeing the answer and rationale material.
- A future student debrief would expose an internal misconception identifier unless the projection and LT-5 execution are fixed.
- Literals and unattached digests can make evidence internally green while preventing independent count reproduction.
- Static compensation can be mistaken for operational rollback.
- Unchanged protected products can be mistaken for regression-tested products.
- Source and answer isolation can regress in browser, logs, telemetry, caches, and runtime integration even when local object tests pass.

## 7. Blockers

State C blockers are IRT-001, IRT-003, IRT-005, IRT-006, IRT-007, and IRT-008. IRT-002 blocks every consumer or student release. IRT-004 prevents unqualified independent certification of the exact corpus and candidate totals.

All six flags must remain off. No staging, internal production, consumer activation, student activation, or medical approval is authorized by this report.

## 8. Confidence

Confidence in the State C veto: `0.995`.

Confidence that State A is the highest supportable point-in-time state: `0.90`.

Confidence in the exact 97-source external count as independently reproducible: `0.55`. The detailed reports are credible and mutually consistent, but the retained evidence does not permit row-level aggregate recomputation.

Confidence in the repository-level zero real-candidate count: `0.98`. Confidence in an external datastore count is `0.00` because no canonical datastore exists or was queried.

Confidence in a global no-answer-leak, no-source-leak, RLS, auth, rollback, monitoring, regression, UI, or accessibility clearance is `0.00` until the missing runtime evidence exists.

## 9. Exact File Paths

Owned outputs:

- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/agents/independent_red_team/independent_red_team.md`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/agents/independent_red_team/red_team_findings.json`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/agents/independent_red_team/release_veto_or_clearance.md`

Primary engineering evidence paths are listed in Section 2 and in each finding. The root handoff is `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/`.

## 10. Handoff To Root Supervisor

Root Supervisor must retain a State C release veto and describe State A as supported only by a dated aggregate inventory attestation. Do not convert local SQL, local auth mechanics, a green evidence validator, or all-flags-off file evidence into staging or production certification.

Before a fresh independent review, Root must close IRT-001 through IRT-008 on one immutable commit, preserve all six flags off during engineering, provide a recomputable privacy-safe count manifest, run exact Class C and LT-5 validation, make assigned review content actually reviewable, and attach canonical staging, auth, RLS, browser, accessibility, rollback, monitoring, and protected-consumer evidence.

## Post-Repair Rerun: 2026-07-15

Audit target: `aebc98795f28fdfc2b130e118be762a30f536259`
Branch: `i1q-question-platform-ultra-1007x-ma`
Repair lineage: `b9bb26a` application repair, `9eadd0e` generated repaired-candidate evidence, `aebc987` aggregate-evidence qualification contract
Current State C verdict: `RELEASE VETO`
Current State A verdict: `SUPPORTED WITH POINT-IN-TIME AGGREGATE QUALIFICATION`

The exact pushed target was read from Git objects. During the audit, the shared worktree advanced to local commit `6dc408fcf432b727e0d7bee20c5eef83ea479bf3`, one commit ahead of origin. That later commit changes generated evidence only and is outside this verdict. Repair source and tests in the worktree were byte-identical to `aebc987`, proven by `git diff --exit-code` before execution. No later evidence was credited to `aebc987`.

### 1. Scope Completed

Extended the independent audit through exact pushed commit `aebc987`. Re-inspected all 11 `b9bb26a` repair files, all three `aebc987` contract files, the 20 committed evidence records, exact Git-object checksums, inventory and candidate evidence, State C deployment evidence, Class C projection and validation, purpose-scoped reviewer access, UI review rendering, auth and feature gates, and focused and package tests. Reproduced the initial IRT-002 and IRT-003 conditions against current code and challenged IRT-004's machine-readable qualification.

No production, staging, provider, source object, raw transcript, student data, secret, configured environment value, external datastore, or protected runtime was accessed. No deployment, flag, migration, application, evidence, authority, root report, or shared file was mutated.

### 2. Evidence Inspected

Exact repair and qualification changes:

- `b9bb26a`: `i1q-question-platform/openapi.json`, `public/app.js`, `public/styles.css`, `src/exports.mjs`, `src/platform.mjs`, `src/server.mjs`, `tests/api.test.mjs`, `tests/exports-class-c.test.mjs`, `tests/platform.test.mjs`, `tests/security-regressions.test.mjs`, and `tests/ui.test.mjs`.
- `9eadd0e`: all 20 generated evidence records and `artifact_checksums.json`.
- `aebc987`: `scripts/generate_evidence.mjs`, `src/validate-evidence.mjs`, and `tests/evidence-validator.test.mjs`.

High-signal code and evidence locations:

- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/i1q-question-platform/src/exports.mjs:47` defines the closed-world Class C keys; `:81` validates types and keys; `:153` copies rationale strings; `:193` applies only that validator; `:264` hashes caller-supplied LT check labels and artifact metadata.
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/i1q-question-platform/src/platform.mjs:926` implements exact-assignment review content authorization; `:1184` records release validation from check IDs and statuses.
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/i1q-question-platform/src/server.mjs:136` validates a closed-world review-content adapter response; `:215` requires an identity-bound resolver; `:298` gates review routes; `:399` serves the purpose-scoped endpoint and fails closed without an adapter.
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/i1q-question-platform/public/app.js:1068` renders protected answer and rationale content; `:1143` and `:1235` block editorial and physician verdicts until that content is available.
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/i1q-question-platform/scripts/generate_evidence.mjs:170` declares the intended `POINT_IN_TIME_AGGREGATE` qualification.
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/i1q-question-platform/src/validate-evidence.mjs:569` defines the qualification schema; `:1879` accepts either a qualified point-in-time declaration or three self-asserted recomputable values.
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/i1q-question-platform/tests/evidence-validator.test.mjs:638` covers missing point-in-time qualification and contradictory booleans, but does not require or recompute a row manifest.
- Exact `aebc987:i1q-question-platform/evidence/inventory_report.json` lacks `evidence_scope`, `row_manifest_retained`, `independently_recomputable_from_git`, and `qualification`.
- Exact `aebc987:i1q-question-platform/evidence/artifact_checksums.json` contains 44 entries, of which 3 are stale.
- Exact `aebc987:i1q-question-platform/evidence/deployment_manifest.json` says `BLOCKED_NOT_DEPLOYED`, has 0 deployment URLs, claims only `STATE_A`, and records all 6 flags false.

The primary authority, architecture, SQL, compensating migration, auth and RLS boundaries, root reports, specialist reports, and external-evidence limitations listed in the initial audit remain applicable. No repair commit adds canonical auth, runtime role grants, HTTP-to-Postgres composition, staging, browser or human validation, monitoring, operational rollback, or protected-consumer certification.

### 3. Findings

#### Initial Versus Current Status

| ID | Initial status | Current status at `aebc987` | Basis |
| --- | --- | --- | --- |
| IRT-001 | Open, Critical | `OPEN` | No external integration or operational evidence was added. State C remains vetoed. |
| IRT-002 | Open, High | `PARTIALLY RESOLVED, OVERALL OPEN` | The direct `misconception_id` key was removed, but Class D identifier values in permitted prose still pass and ship. See IRT-009. |
| IRT-003 | Open, High | `RESOLVED IN LOCAL APPLICATION SCOPE` | Exact-assignment answer and rationale access now exists, is fail-closed, and has positive and negative tests. Runtime integration remains unverified under IRT-001 and IRT-005. |
| IRT-004 | Open, High | `OPEN, QUALIFICATION CONTRACT INCOMPLETE` | The intended point-in-time declaration is machine-readable in generator code, but absent from exact committed evidence. No row manifest exists, and recomputable mode is not bound to one. |
| IRT-005 | Open, High | `OPEN` | Local RLS proof remains local; no canonical runtime identity, grants, pool composition, preview, or staging proof exists. |
| IRT-006 | Open, High | `OPEN` | Local answer controls improved, but IRT-009 defeats complete Class D value isolation and no runtime scan exists. |
| IRT-007 | Open, High | `OPEN` | Rollback remains designed but not operationally executed; monitoring and protected-consumer proof remain absent. |
| IRT-008 | Open, High | `OPEN` | UI code improved, but browser, screen-reader, human, responsive, and score gates remain not run. |
| IRT-009 | Not present | `NEW OPEN, HIGH` | Class D identifier values can be serialized through allowed Class C prose fields. |
| IRT-010 | Not present | `NEW OPEN, HIGH` | Exact `aebc987` evidence is internally stale and does not satisfy its own new inventory schema. |

#### IRT-002 Current Disposition

The initial direct-field defect is fixed. `projectStatDebrief` now emits only `choice_key`, `why_tempting`, and `why_wrong`, and the validator rejects unknown keys at both levels. IRT-002 is not fully resolved because the binding rule is about Class D information appearing in a student artifact, not only Class D key names. The validator accepts arbitrary nonempty strings and never compares them with actual internal identifiers.

#### IRT-003 Current Disposition

IRT-003 is resolved in the local application scope. `readAssignedReviewContent` requires read and write authorization, exact editorial or medical purpose, an accepted assignment, matching revision, actor, review type, role, hash, workflow state, conflict clearance, and current physician credential where applicable. The HTTP endpoint requires the internal platform and review flags, fails closed with `503` when no canonical resolver exists, validates a closed-world response, and sends `Cache-Control: no-store`. The UI disables verdicts unless protected content is loaded and does not use `localStorage` or `sessionStorage`. Focused tests cover successful editorial access, wrong actor, wrong purpose, open assignment, feature gates, missing adapter, malformed adapter output, exact answer content, and browser-persistence absence.

This local closure does not prove the absent canonical resolver, Postgres wiring, deployed auth, runtime RLS, or staging behavior. Those remain separate State C blockers.

#### IRT-004 Current Disposition

The repair correctly introduces an explicit point-in-time vocabulary in generator and validator code. For the intended current branch, the truthful values are `POINT_IN_TIME_AGGREGATE`, `row_manifest_retained=false`, and `independently_recomputable_from_git=false` with a nonempty qualification.

Two defects keep IRT-004 open:

1. Exact `aebc987` evidence was generated at `9eadd0e` before the schema change. Its committed `inventory_report.json` has none of the four required qualification fields.
2. The alternative `RECOMPUTABLE_AGGREGATE_MANIFEST` branch checks only the enum and two booleans. The schema has no manifest path, manifest hash, schema version, row count, privacy allowlist, or recomputation output. Exact-tree search found no privacy-safe row manifest. A declaration can therefore claim recomputability without evidence.

The 97-source and zero-candidate figures remain point-in-time aggregate reports. They are not promoted to independently recomputable facts.

#### IRT-009: Class D Values Bypass Class C Validation

Severity: `HIGH`
Disposition: `OPEN, BLOCK CONSUMER OR STUDENT RELEASE`

Evidence:

- `src/exports.mjs:109-110` requires only nonempty rationale strings.
- `src/exports.mjs:159-166` copies those strings verbatim into the Class C artifact.
- `src/exports.mjs:193-197` performs only the closed-world key and type validation.
- `tests/exports-class-c.test.mjs` injects a nested object into prose and proves a type failure. It does not inject valid string values equal to item, revision, source, claim, reviewer, misconception, or psychometric identifiers.
- A full `buildReleaseArtifacts` probe succeeded with `why_wrong` equal to the revision's internal `source_ids[0]`; the exact Class D value appeared in the serialized student artifact and the validator returned `[]`.
- `releaseValidationEvidenceHash` and `recordReleaseValidation` bind artifact metadata and caller-supplied LT IDs and statuses. They do not execute LT-5 against serialized values.

Exact minimal reproduction:

```sh
cd /Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/i1q-question-platform
node --input-type=module - <<'NODE'
import { projectStatDebrief, validateClassCStatDebriefArtifact } from './src/exports.mjs';
const revision = {
  answer: 'A',
  correct_answer_rationale: 'Synthetic permitted rationale.',
  choices: [
    { key: 'A' },
    { key: 'B', why_tempting: 'Synthetic lure B.', why_wrong: 'internal_source_123', misconception_id: 'miscon_b' },
    { key: 'C', why_tempting: 'Synthetic lure C.', why_wrong: 'Synthetic mismatch C.', misconception_id: 'miscon_c' },
    { key: 'D', why_tempting: 'Synthetic lure D.', why_wrong: 'Synthetic mismatch D.', misconception_id: 'miscon_d' },
  ],
};
const row = { dataset_version: 'synthetic_v1', question_id: 'SYNTHETIC-Q', answer: 'A', explanation: 'Synthetic explanation.' };
const payload = [projectStatDebrief(row, revision)];
console.log(JSON.stringify({
  misconception_key_present: Object.hasOwn(payload[0].distractor_rationales[0], 'misconception_id'),
  class_d_identifier_value_present: JSON.stringify(payload).includes('internal_source_123'),
  validator_findings: validateClassCStatDebriefArtifact(payload),
}));
NODE
```

Observed: `{"misconception_key_present":false,"class_d_identifier_value_present":true,"validator_findings":[]}`. A second probe through complete `buildReleaseArtifacts` observed `{"build_succeeded":true,"class_d_identifier_value_present":true,"validator_findings":[]}`.

Exact remediation:

1. Before hashing or release validation, derive the set of Class D values from each internal revision, including item and revision IDs, source and claim IDs, reviewer IDs, misconception IDs, and psychometric identifiers.
2. Canonically normalize and scan every string in the exact serialized Class C artifact against that set. Reject matches and encoded structured-field markers.
3. Execute LT-5 on the exact serialized payload and bind validator version, findings, execution result, artifact hash, and immutable payload hash into release-validation evidence.
4. Add negative tests for every identifier family in `explanation`, `correct_answer_rationale`, `why_tempting`, and `why_wrong`. Use valid strings, not only wrong-typed nested objects.

#### IRT-010: Exact Pushed Evidence Estate Is Stale

Severity: `HIGH`
Disposition: `OPEN, EXACT-COMMIT EVIDENCE CLEARANCE BLOCKED`

Exact Git-object comparison checked all 44 paths in `aebc987:i1q-question-platform/evidence/artifact_checksums.json`. Three entries do not match the same commit:

- Index 13: `i1q-question-platform/scripts/generate_evidence.mjs`
- Index 27: `i1q-question-platform/src/validate-evidence.mjs`
- Index 30: `i1q-question-platform/tests/evidence-validator.test.mjs`

The same exact commit's `inventory_report.json` lacks fields that its cross-file validator contract requires for real inventory. Consequently, a `20/20` validator result from `9eadd0e` or a later unpushed regeneration is not evidence that exact `aebc987` passes.

Exact checksum reproduction:

```sh
cd /Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000
node --input-type=module - <<'NODE'
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const commit = 'aebc98795f28fdfc2b130e118be762a30f536259';
const show = (path) => execFileSync('git', ['show', `${commit}:${path}`]);
const manifest = JSON.parse(show('i1q-question-platform/evidence/artifact_checksums.json').toString('utf8'));
const entries = manifest.artifacts ?? manifest.files ?? manifest.entries ?? manifest;
const stale = [];
for (let index = 0; index < entries.length; index += 1) {
  const entry = entries[index];
  const path = entry.path ?? entry.file ?? entry.artifact;
  const expected = entry.sha256 ?? entry.checksum ?? entry.hash;
  const actual = createHash('sha256').update(show(path)).digest('hex');
  if (expected !== actual) stale.push({ index, path });
}
console.log(JSON.stringify({ commit, checked: entries.length, stale_count: stale.length, stale }, null, 2));
NODE
```

Observed: `44` checked, `3` stale. The missing qualification fields were independently read with `git show aebc987:i1q-question-platform/evidence/inventory_report.json`. Applying the exact `aebc987` cross-file predicate to that Git blob returned `point_in_time_contract_satisfied=false`, `recomputable_contract_satisfied=false`, and `e_real_inventory_qualification_would_be_issued=true`.

Exact remediation:

1. From a clean immutable candidate containing the final generator, validator, tests, and intended point-in-time qualification, regenerate all evidence through the canonical generator.
2. Ensure `inventory_report.json` explicitly records point-in-time aggregate scope, false row-manifest retention, false Git recomputability, and a nonempty qualification. Do not claim recomputability without an actual privacy-safe manifest.
3. Recompute all 44 or more checksum entries after every source and test change, and verify every path, byte count, and SHA-256 against that same commit.
4. Run the package, focused, disposable PostgreSQL, dependency, and exact `npm run validate` gates from the clean candidate. Commit and push code and evidence as one new immutable checkpoint, then request another independent rerun.

### 4. Changes Proposed Or Made

Made changes only to the three Agent 11 report outputs. No application, test, SQL, evidence, root, authority, or shared file was edited. Proposed remediation is recorded under IRT-004, IRT-009, and IRT-010 and the unchanged initial findings.

### 5. Tests Performed

Commands and results:

```sh
git diff --exit-code aebc98795f28fdfc2b130e118be762a30f536259 -- i1q-question-platform/openapi.json i1q-question-platform/public/app.js i1q-question-platform/public/styles.css i1q-question-platform/src/exports.mjs i1q-question-platform/src/platform.mjs i1q-question-platform/src/server.mjs i1q-question-platform/src/validate-evidence.mjs i1q-question-platform/scripts/generate_evidence.mjs i1q-question-platform/tests/api.test.mjs i1q-question-platform/tests/exports-class-c.test.mjs i1q-question-platform/tests/platform.test.mjs i1q-question-platform/tests/security-regressions.test.mjs i1q-question-platform/tests/ui.test.mjs i1q-question-platform/tests/evidence-validator.test.mjs
```

Result: pass with no diff. This pins executed source and tests to `aebc987` despite shared HEAD movement.

```sh
cd /Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/i1q-question-platform
node --test tests/exports-class-c.test.mjs tests/platform.test.mjs tests/security-regressions.test.mjs tests/ui.test.mjs tests/api.test.mjs
node --test tests/evidence-validator.test.mjs
npm test
```

Results: focused repair suite `61` pass, `0` fail, `0` skip; evidence-validator suite `30` pass, `0` fail, `0` skip; full package `215` pass, `0` fail, `1` intentionally gated PostgreSQL skip out of `216` tests.

```sh
cd /Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000
npm audit --omit=dev --audit-level=low
git diff --check 6ac62c5a0503981680f161fe5119d5e5e2fa031a..aebc98795f28fdfc2b130e118be762a30f536259
git ls-tree -r --name-only aebc98795f28fdfc2b130e118be762a30f536259 -- i1q-question-platform | rg -i 'row.*manifest|manifest.*row|inventory.*rows|candidate.*rows|aggregate.*manifest'
git grep -n -E 'row_manifest|RECOMPUTABLE_AGGREGATE_MANIFEST|independently_recomputable' aebc98795f28fdfc2b130e118be762a30f536259 -- i1q-question-platform
```

Results: dependency audit `0 vulnerabilities`; diff check passed; row-manifest path search returned no matches; all recomputability references are declarations, schema booleans, predicate checks, or tests, with no manifest artifact or binding.

The initial independent disposable PostgreSQL result remains `12` pass, `0` fail, `0` skip. It was not repeated because no SQL, repository, grant, RLS, or compensation file changed from that audited proof through `aebc987`. No external, browser, staging, production, monitoring, protected-consumer, or operational rollback test was run.

An exact-checkout `npm run validate` was not run because the shared worktree had advanced and this agent was forbidden to materialize or replace files outside the three report outputs. Read-only exact Git-object checks independently establish three `E_ARTIFACT_STALE` conditions and the `E_REAL_INVENTORY_QUALIFICATION` condition at `aebc987`. A later-worktree validation result is not substituted for the target commit.

### 6. Risks

- A valid student debrief can disclose an internal Class D identifier through permitted teaching prose.
- Test wording claims identifiers hidden in prose are rejected, while the test covers a wrong-typed object and misses valid identifier strings.
- The exact pushed evidence packet can be mistaken for a green 20 of 20 estate even though three checksums are stale and required qualification fields are absent.
- A future evidence record can self-assert recomputable-manifest mode without naming, hashing, or recomputing any manifest.
- Local review-content success can be mistaken for deployed auth, RLS, and repository safety.
- All initial runtime, rollback, monitoring, protected-consumer, UI, accessibility, and human-validation risks remain.

### 7. Blockers

State C remains vetoed by IRT-001, IRT-005, IRT-006, IRT-007, and IRT-008. IRT-003 is locally resolved but supplies no missing external evidence. IRT-009 blocks every consumer or student release. IRT-004 prevents unqualified count certification. IRT-010 blocks exact-commit evidence clearance.

All six flags must remain off. No State C, consumer, student, staging, internal-production, medical-approval, or evidence-integrity clearance is issued.

### 8. Confidence

Confidence in State C veto: `0.998`.
Confidence that IRT-003 is resolved in local application scope: `0.98`.
Confidence that IRT-002 remains open through IRT-009: `0.995`.
Confidence that exact `aebc987` evidence is stale: `1.00`.
Confidence that State A is the highest supportable point-in-time state: `0.92`.
Confidence that exact 97-source and zero-candidate totals are independently recomputable: `0.00` absent a retained manifest.
Confidence in global auth, RLS, no-leak, rollback, monitoring, regression, UX, or accessibility clearance: `0.00`.

### 9. Exact File Paths

Owned outputs:

- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/agents/independent_red_team/independent_red_team.md`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/agents/independent_red_team/red_team_findings.json`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/agents/independent_red_team/release_veto_or_clearance.md`

Exact engineering paths and line references are listed in Section 2 and each current finding. Every exact-commit assertion in this rerun is anchored to Git object `aebc98795f28fdfc2b130e118be762a30f536259`.

### 10. Handoff To Root Supervisor

Carry `STATE C RELEASE VETO` and `STATE A SUPPORTED WITH POINT-IN-TIME AGGREGATE QUALIFICATION`. Record IRT-003 as locally resolved. Record IRT-002 as only partially resolved and still open through IRT-009. Do not claim exact `aebc987` evidence validation passed, because the committed estate has 3 stale checksums and omits its newly required inventory qualification fields.

Root should require a new immutable pushed checkpoint that closes the Class D value scan, binds LT-5 execution to exact artifacts, regenerates the evidence estate after the final contract code, and truthfully declares point-in-time aggregate scope. State C must also receive the unchanged canonical auth, runtime grants and Postgres composition, staging, browser, accessibility, rollback, monitoring, and protected-consumer evidence before another clearance review.

## Final Post-Repair Rerun: 2026-07-15

Audit target: `2d28d0b271b637f68358fd4aae414aa2f708c63f`
Branch: `i1q-question-platform-ultra-1007x-ma`
Target relationship: exact `HEAD` and exact `origin/i1q-question-platform-ultra-1007x-ma` when inspected
Current State C verdict: `RELEASE VETO`
Current State A verdict: `SUPPORTED ONLY AS A DATED POINT-IN-TIME AGGREGATE`

### 1. Scope Completed

Inspected exact Git objects and the complete repair lineage from `aebc987` through `78e194e`, `7faf05a`, `8e3f96b`, `4a14ad8`, and `2d28d0b`. Re-reviewed JavaScript Class C value isolation, platform release-linked identifier collection, SQL release-artifact value isolation, ordering before hashing and insertion, exact evidence checksums, inventory qualification, frozen STAT projection, opaque public question identity, and local reviewer access. Ran focused tests, the full package suite, evidence validation, root dependency audit, an independent JavaScript adversarial matrix, and exact Git-object evidence checks.

No product, migration, test, evidence, root, authority, deployment, flag, external datastore, or protected system was changed. A fresh disposable PostgreSQL execution was attempted but could not start because `/tmp` repeatedly returned `no space left on device`. The package therefore retained its intentional PostgreSQL skip.

### 2. Evidence Inspected

- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/i1q-question-platform/src/exports.mjs:62` through `:161` normalizes and scans Class D markers and values; `:183` applies the scan; `:289` hashes artifacts; `:301` validates before hashing; `:308` builds releases.
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/i1q-question-platform/src/platform.mjs:1157` collects release-linked review, psychometric, source, rights, privacy, and claim records before artifact construction; `:1194` inserts only after construction returns.
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/i1q-question-platform/db/migrations/20260715122434_i1q_1007x_question_platform.sql:2866` normalizes SQL security text; `:2945` gathers actual release-linked item, revision, source, claim, reviewer, misconception, and psychometric identifiers; `:3016` scans values; `:3068` validates artifacts; `:3187` hashes only after the checks; `:3188` and `:3212` insert metadata and payload afterward.
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/i1q-question-platform/tests/exports-class-c.test.mjs:215` through `:385` covers direct values, supported encodings, markers, public question identity, all four prose fields, and linked reviewer identifiers.
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/i1q-question-platform/tests/postgres-migration.test.mjs:202` and `:312` contain static SQL assertions and the environment-gated disposable PostgreSQL proof.
- Exact `2d28d0b:i1q-question-platform/evidence/artifact_checksums.json`, `inventory_report.json`, `candidate_counts.json`, `deployment_manifest.json`, and `test_results.json`.

All authority, architecture, external integration, auth, RLS, rollback, monitoring, protected-consumer, browser, UX, and accessibility evidence from the preserved audits remains applicable.

### 3. Findings

#### Current Dispositions

| ID | Final status at `2d28d0b` | Basis |
| --- | --- | --- |
| IRT-001 | `OPEN, CRITICAL` | No canonical State C integration or operational evidence was added. |
| IRT-002 | `PARTIALLY RESOLVED, OVERALL OPEN` | Direct Class D keys and direct values are blocked, but IRT-009 retains an encoded-value bypass. |
| IRT-003 | `RESOLVED IN LOCAL APPLICATION SCOPE` | Purpose-scoped exact-assignment review content remains available and fail-closed in focused tests. No runtime certification follows. |
| IRT-004 | `TRUTHFULLY QUALIFIED, NOT RECOMPUTABLE` | Exact evidence now declares `POINT_IN_TIME_AGGREGATE`, no retained row manifest, and no Git recomputability. Unqualified count certification remains blocked. |
| IRT-005 | `OPEN` | Runtime auth, role, grants, repository composition, and RLS remain unproven externally. |
| IRT-006 | `OPEN` | IRT-009 prevents complete local leak clearance, and no deployed global scan exists. |
| IRT-007 | `OPEN` | Operational rollback, monitoring, and protected-consumer proof remain absent. |
| IRT-008 | `OPEN` | Browser, assistive-technology, human, responsive, and score gates remain absent. |
| IRT-009 | `OPEN, HIGH` | Double URL encoding bypasses JavaScript Class D value and marker isolation before hashing. |
| IRT-010 | `CLOSED` | All 44 exact checkpoint checksum records match Git-object bytes and hashes, and required inventory qualification fields exist. |

#### IRT-009 Final Disposition

The repair materially improves isolation. An independent matrix injected actual release-linked item, revision, source, claim, reviewer, misconception, and psychometric identifier values into `explanation`, `correct_answer_rationale`, `why_tempting`, and `why_wrong`.

- Direct matrix: `28/28` denied.
- Encoded identifier matrix: `172/196` denied.
- Encoded marker matrix: `20/24` denied.
- Bypasses: `28`, consisting of double URL-encoded separators for item, revision, source, claim, reviewer, and misconception values across all four prose fields, plus double URL-encoded `source_id` markers across all four fields.
- A targeted source-value bypass returned `build_succeeded=true`, retained the encoded value in the Class C payload, and produced both a 64-character artifact hash and a 64-character manifest hash.
- Psychometric double-encoding cases were denied because the marker expression separately detects the psychometric term.
- The opaque public composite question ID was preserved.
- The STAT server projection remained exactly nine columns in frozen order: `dataset_version`, `question_id`, `prompt`, `choice_a`, `choice_b`, `choice_c`, `choice_d`, `answer`, `explanation`.

The cause is one-pass JavaScript percent decoding at `src/exports.mjs:72` through `:84`. `%255F` becomes `%5F` but is not decoded again before comparison. Existing tests cover `%5F`, Unicode escapes, HTML entities, zero-width characters, Base64, and Base64URL, but not iterative URL encoding.

Exact remediation:

1. Decode security text repeatedly until stable with a strict maximum depth and length bound, applying Unicode normalization and zero-width removal at every step.
2. Generate and compare bounded recursive encoding variants for every release-linked Class D value and marker.
3. Add double and triple URL-encoding tests for all seven identifier families in all four prose fields in JavaScript and disposable PostgreSQL.
4. Prove rejection occurs before JavaScript artifact hashing and before SQL metadata or payload insertion, and assert that denied IDs leave no artifact row.

SQL inspection confirms direct checks and supported decoding occur before hash and insertion. Fresh independent execution of the changed SQL was not completed because local storage prevented creation of the disposable cluster. No SQL runtime clearance is claimed.

#### IRT-010 Final Disposition

IRT-010 is closed for exact `2d28d0b`:

- Declared checksum records: `44`.
- Exact Git-object records checked: `44`.
- Matching bytes and SHA-256 records: `44`.
- Stale or missing records: `0`.
- `inventory_report.json` contains `evidence_scope=POINT_IN_TIME_AGGREGATE`, `row_manifest_retained=false`, `independently_recomputable_from_git=false`, and a nonempty dated qualification.

This closes exact-checkpoint evidence staleness only. It does not clear State C or make aggregate counts independently recomputable.

#### IRT-004 Final Qualification

Exact evidence reports 97 authorized sources, 97 registry rows, 97 transcript references, 97 nodes references, 0 VTT references, 97 privacy-blocked sources, 0 working-redacted sources, 0 extraction-ready sources, 0 real candidates, and 0 physician approvals. These remain dated point-in-time aggregate reports. Exact-tree search found no privacy-safe row manifest. State A remains supportable only with that qualification, and no State B, C, or D claim is supported.

### 4. Changes Proposed Or Made

Changed only the three Independent Red Team report outputs. No other path was edited. Proposed changes are limited to iterative encoding normalization and tests for IRT-009, plus the unchanged external evidence required for State C.

### 5. Tests Performed

```sh
node --test tests/exports-class-c.test.mjs tests/migration-1007x.test.mjs tests/platform.test.mjs tests/security-regressions.test.mjs tests/api.test.mjs tests/ui.test.mjs
npm test
npm run validate
npm audit --omit=dev --audit-level=low
git ls-tree -r --name-only 2d28d0b271b637f68358fd4aae414aa2f708c63f -- i1q-question-platform
```

Results:

- Focused suite: `84` pass, `0` fail, `0` skip.
- Full package: `223` pass, `0` fail, `1` intentionally gated PostgreSQL skip, `224` total.
- Evidence validator: `20/20` present and parsed, `0` errors, claimed state `STATE_A`.
- Root dependency audit: `0 vulnerabilities`.
- Exact checksum comparison: `44/44` match, `0` stale.
- Independent JavaScript matrix: `248` total identifier and marker attempts, `220` denied, `28` bypassed.
- Targeted bypass: payload, artifact hash, and manifest hash created.
- Fresh disposable PostgreSQL: not run; two creation attempts failed with `no space left on device` before a cluster started.

### 6. Risks

- Iteratively encoded Class D values can enter a JavaScript-built student debrief and be hashed as release material.
- Existing green tests can be mistaken for complete encoding coverage.
- Changed SQL has static and committed test coverage but lacks this rerun's fresh disposable execution.
- Point-in-time counts can still be misstated as independently recomputable if the qualification is omitted in downstream summaries.
- Every preserved external State C risk remains.

### 7. Blockers

IRT-009 blocks consumer and student release. IRT-001, IRT-005, IRT-006, IRT-007, and IRT-008 continue to veto State C. IRT-004 blocks unqualified corpus and candidate count certification. The missing fresh PostgreSQL execution prevents independent runtime closure of the changed SQL. IRT-010 is no longer a blocker.

All six flags must remain off. No State B, C, or D clearance is issued.

### 8. Confidence

State C veto: `0.999`.
State A as the highest supportable dated point-in-time state: `0.95`.
IRT-009 remains open in JavaScript: `1.00`.
IRT-010 exact-checkpoint closure: `1.00`.
IRT-003 local application closure: `0.98`.
Exact corpus and candidate recomputability: `0.00`.
Independent runtime confidence for the changed SQL in this rerun: `0.00` because the disposable cluster did not start.

### 9. Exact File Paths

- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/agents/independent_red_team/independent_red_team.md`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/agents/independent_red_team/red_team_findings.json`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/agents/independent_red_team/release_veto_or_clearance.md`

### 10. Handoff To Root Supervisor

Carry `STATE C RELEASE VETO` and `STATE A SUPPORTED ONLY AS A DATED POINT-IN-TIME AGGREGATE`. Mark IRT-009 open and IRT-010 closed at exact `2d28d0b`. Keep IRT-004's explicit non-recomputability qualification. Do not claim State B, C, D, global leak safety, SQL runtime clearance, or consumer release.

Request another independent rerun only after iterative encoding is rejected in JavaScript and SQL, the changed SQL passes a fresh disposable PostgreSQL matrix, evidence is regenerated on the same immutable checkpoint, and all preserved external State C evidence exists.

## Final Iterative-Isolation Rerun: 2026-07-15

Audit target: `65bb52c4bd14d6d20145e666e3b95b6109dfef83`
Branch: `i1q-question-platform-ultra-1007x-ma`
Target relationship: exact local `HEAD` and exact tracked origin when inspected
Current State C verdict: `RELEASE VETO`
Current State A verdict: `SUPPORTED ONLY AS A DATED POINT-IN-TIME AGGREGATE`
IRT-009: `OPEN, HIGH`
IRT-010: `CLOSED FOR EXACT-CHECKPOINT EVIDENCE INTEGRITY`

### 1. Scope Completed

Inspected exact Git objects at `65bb52c`, the repair lineage from `2d28d0b`, JavaScript and PostgreSQL Class D canonicalization, all seven release-linked identifier families, all four permitted Class C prose fields, validation order, hashing and insertion order, the public composite question ID, frozen STAT projection, migration and compensation tests, all 44 checksum records, inventory qualification, candidate evidence, evidence validation, package tests, dependency audit, and a fresh disposable PostgreSQL 16 execution.

Ran independent adversarial matrices without accessing production, source content, credentials, environment values, students, Stream, R2, CDN objects, Supabase, Railway, WordPress, or any protected system. No product, migration, test, evidence, authority, root report, shared file, deployment, feature flag, commit, or remote branch was changed.

### 2. Evidence Inspected

- Exact Git object `65bb52c:i1q-question-platform/src/exports.mjs:64-65,74-105,129-138,173-193,268-281,321-337,340-381`.
- Exact Git object `65bb52c:i1q-question-platform/db/migrations/20260715122434_i1q_1007x_question_platform.sql:2866-2955,3001-3146,3237-3254,3267-3293`.
- Exact Git object `65bb52c:i1q-question-platform/tests/exports-class-c.test.mjs:301-463`.
- Exact Git object `65bb52c:i1q-question-platform/tests/postgres-migration.test.mjs:568-713,816-980`.
- Exact Git objects under `65bb52c:i1q-question-platform/evidence/`, especially `artifact_checksums.json`, `inventory_report.json`, `candidate_counts.json`, `deployment_manifest.json`, and `health_check_results.json`.
- The preserved authority, architecture, auth, RLS, rollback, monitoring, protected-consumer, privacy, UI, UX, and accessibility evidence listed in the initial audit and prior reruns.

### 3. Findings

#### Current Dispositions

| ID | Status at `65bb52c` | Basis |
| --- | --- | --- |
| IRT-001 | `OPEN, CRITICAL` | Canonical integration and operational State C evidence remain absent. |
| IRT-002 | `PARTIALLY RESOLVED, OVERALL OPEN` | Direct Class D projection is repaired, but IRT-009 remains a release-path counterexample. |
| IRT-003 | `RESOLVED IN LOCAL APPLICATION SCOPE` | Focused and full tests retain exact-assignment protected review content and fail-closed controls. No external runtime certification follows. |
| IRT-004 | `TRUTHFULLY QUALIFIED, NOT RECOMPUTABLE` | Evidence declares a dated point-in-time aggregate and explicitly declares no retained row manifest or Git recomputability. |
| IRT-005 | `OPEN` | Canonical runtime auth, grants, repository composition, and staging RLS proof remain absent. |
| IRT-006 | `OPEN` | The PostgreSQL IRT-009 counterexample prevents local no-leak clearance, and no deployed global proof exists. |
| IRT-007 | `OPEN` | Operational rollback, monitoring, and protected-consumer certification remain absent. |
| IRT-008 | `OPEN` | Browser, assistive-technology, human, responsive, and required UX-score proof remain absent. |
| IRT-009 | `OPEN, HIGH` | PostgreSQL accepts full printable-ASCII double and triple URL encoding of an actual mixed-case release-linked source identifier. |
| IRT-010 | `CLOSED` | All 44 exact checkpoint checksum records match Git objects and inventory qualification is present. |

#### IRT-009: PostgreSQL Full-ASCII Mixed-Case Bypass

JavaScript passed the independent cross-product. Seven actual synthetic release-linked identifier families were injected into four permitted prose fields under seven variants: direct, Base64, Base64URL, separator-only URL depth 2 and 3, and full printable-ASCII URL depth 2 and 3. Result: `196/196` rejected with `422`. Depth 9 and `65,537` bytes failed closed. A clean payload retained the opaque public question ID and the exact frozen nine-field STAT projection.

PostgreSQL did not pass the same policy. A direct scanner matrix checked `49` family and variant pairs. It detected `47` and missed `2`: full printable-ASCII depth 2 and depth 3 for the actual mixed-case source fixture. The scalar scan is field-independent. Dynamic artifact creation across four fields and both depths used eight disposable releases and persisted `8` artifact rows and `8` payload rows. Therefore rejection did not occur before hashing or insertion, and the required zero-row result failed.

The root cause is exact and local. `normalize_security_text` lowercases at migration line `2916`, then lines `2917-2929` decode printable ASCII. Encoded uppercase bytes are restored after the only lowercase operation. The function returns that mixed-case result at line `2954`. `contains_release_class_d_identifier` compares it with the lowercase direct identifier at line `3120`, so the direct variant is missed. JavaScript lowercases after iterative decoding and is not affected.

Severity is `HIGH`. Consumer and student release remain vetoed. The existing unique `(release_id, channel)` constraint masked the first expanded probe because a safe debrief already existed, but a fresh release proved real metadata and payload persistence. This is not a theoretical or test-only mismatch.

Exact remediation:

1. Apply case folding after every SQL decode pass and again after the final decode, before residual-encoding checks and comparisons.
2. Preserve canonical mixed-case variants for Base64 and Base64URL while using the fully decoded and case-folded value for direct comparison.
3. Add actual mixed-case fixtures for all seven families, not only source, and inject every required variant into all four prose fields.
4. Assert `42501` for leak denials, `54000` for depth and size limits, and zero matching rows in both `channel_artifacts` and `channel_artifact_payloads`.
5. Regenerate evidence and all checksums only after the repair and rerun on a new immutable checkpoint.

#### IRT-010: Exact Evidence Integrity

IRT-010 remains closed for exact `65bb52c`. The independent script loaded `artifact_checksums.json` from the Git object, loaded each of its 44 paths from the same Git object, and recomputed bytes and SHA-256. Result: `44/44` matched and `0` were stale or missing.

This is evidence-integrity closure only. It does not cure IRT-009, prove the aggregate inventory, or clear State C.

#### IRT-004: Point-In-Time Aggregate Only

Exact inventory evidence declares `evidence_scope=POINT_IN_TIME_AGGREGATE`, `row_manifest_retained=false`, `independently_recomputable_from_git=false`, and a dated qualification that no privacy-safe row manifest was retained. It reports 97 registry rows, 97 transcript references, 97 nodes references, 0 working-redacted sources, and 0 extraction-ready sources. The point-in-time corpus packet reports 0 VTT matches and all 97 real sources privacy-blocked. Candidate evidence reports 0 real candidates and 0 physician approvals.

These are point-in-time reports, not independently recomputable current facts. No State B, C, or D claim is supported.

#### Evidence Classification

| Classification | Current statement |
| --- | --- |
| Verified current fact | `HEAD` and tracked origin resolved to exact `65bb52c4bd14d6d20145e666e3b95b6109dfef83`. |
| Verified current fact | JavaScript denied `196/196` requested identifier, field, and encoding combinations and failed closed at depth 9 and 65,537 bytes. |
| Verified current fact | PostgreSQL scanner missed 2 of 49 family and variant pairs, and eight dynamic field and depth probes persisted 8 artifacts and 8 payloads. |
| Verified current fact | Focused tests passed 88, package tests passed 227 with 0 failures and 1 gated skip, fresh PostgreSQL passed 13, evidence validation passed 20/20 as State A, and root audit found 0 vulnerabilities. |
| Verified current fact | All 44 checksum records match exact Git-object bytes and hashes. |
| Verified current fact | Deployment evidence has 0 URLs and all 6 feature flags false. |
| Point-in-time report | The dated corpus packet reports the 97-source aggregate and privacy blocks. |
| Point-in-time report | Candidate evidence reports 0 real candidates and 0 physician approvals. |
| Inference | State A remains the highest supportable state only with the dated aggregate qualification. |
| Unverified claim | The external estate still has exactly those corpus and candidate totals now. |
| Unverified claim | Runtime auth, RLS, rollback, monitoring, protected consumers, browser UX, accessibility, or a deployed no-leak boundary works. |

### 4. Changes Proposed Or Made

Changed only the three Independent Red Team reports. Proposed the SQL normalization and regression-test remediation above. No product, evidence, shared, authority, root, Git, or protected-system mutation was made.

### 5. Tests Performed

```sh
git status --short --branch
git rev-parse HEAD
git rev-parse origin/i1q-question-platform-ultra-1007x-ma
node --test tests/exports-class-c.test.mjs tests/migration-1007x.test.mjs tests/security-regressions.test.mjs tests/api.test.mjs tests/platform.test.mjs tests/ui.test.mjs
npm test
npm run validate
npm audit --omit=dev --audit-level=low
I1Q_POSTGRES_TEST_URL="<disposable-local-database-url>" node --test tests/postgres-migration.test.mjs
```

Additional exact local commands were memory-only `node --input-type=module` and `psql -X -v ON_ERROR_STOP=1` heredocs. The JavaScript heredoc used 7 families, 4 fields, and 7 variants. The PostgreSQL heredocs created fresh local clusters with `initdb -U postgres -A trust --no-locale -E UTF8`, ran the committed suite, queried all 49 family and variant pairs, and created eight isolated releases for the failing field and depth cross-product.

Results:

- Focused suite: `88` pass, `0` fail, `0` skip.
- Full package: `228` total, `227` pass, `0` fail, `1` intentionally gated PostgreSQL skip.
- Evidence validator: `20/20` files, `0` errors, claimed `STATE_A`.
- Root audit: `0 vulnerabilities`.
- Fresh disposable PostgreSQL 16: `13` pass, `0` fail, `0` skip.
- Committed PostgreSQL iterative probes: `56` separator identifiers, `56` full-ASCII identifiers, `8` separator markers, `8` full-ASCII markers, plus depth and size fail-closed probes.
- Independent JavaScript matrix: `196/196` rejected; depth and size bounds passed; opaque ID and 9 fields passed.
- Independent PostgreSQL scanner matrix: `47/49` detected, `2/49` bypassed.
- Independent PostgreSQL persistence matrix: `8` attempted bypasses, `8` artifact rows persisted, `8` payload rows persisted across `8` disposable releases.
- Exact Git-object checksums: `44/44` match, `0` stale.

Two harness setup attempts failed before the relevant test body: the first `initdb` used the OS account instead of `postgres`, and one multi-release seed reused a unique manifest hash. Both disposable clusters were removed by traps, corrected, and rerun successfully. They are not product findings.

### 6. Risks

- A mixed-case internal identifier can be encoded into Class C prose and persisted by PostgreSQL.
- The green 13-test PostgreSQL suite omits the failing mixed-case full-ASCII cross-product and can be mistaken for complete IRT-009 closure.
- Evidence can be internally checksum-correct while documenting a release-blocking implementation defect.
- Aggregate corpus and candidate counts may be overstated as recomputable or current.
- All preserved external State C risks remain.

### 7. Blockers

IRT-009 blocks consumer and student release. IRT-001, IRT-005, IRT-006, IRT-007, and IRT-008 continue to veto State C. IRT-004 blocks unqualified corpus and candidate count certification. IRT-010 is closed only for exact-checkpoint evidence integrity.

All six flags must remain off. No State B, C, or D clearance, global leak clearance, or PostgreSQL Class D isolation clearance is issued.

### 8. Confidence

State C veto: `1.00`.
State A as the highest supportable dated point-in-time state: `0.95`.
IRT-009 open at exact `65bb52c`: `1.00`.
IRT-010 exact-checkpoint closure: `1.00`.
IRT-003 local application closure: `0.98`.
Independent corpus and candidate recomputability: `0.00`.
PostgreSQL no-leak clearance: `0.00` because persistence was reproduced.

### 9. Exact File Paths

- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/agents/independent_red_team/independent_red_team.md`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/agents/independent_red_team/red_team_findings.json`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/agents/independent_red_team/release_veto_or_clearance.md`

### 10. Handoff To Root Supervisor

Carry `STATE C RELEASE VETO` and `STATE A SUPPORTED ONLY AS A DATED POINT-IN-TIME AGGREGATE`. Mark IRT-009 `OPEN, HIGH` and IRT-010 `CLOSED FOR EXACT-CHECKPOINT EVIDENCE INTEGRITY` at `65bb52c`. Preserve IRT-004's explicit non-recomputability qualification and IRT-003's local-only closure.

Do not claim State B, C, D, consumer release, student release, global no-leak safety, or PostgreSQL Class D isolation. Require a new pushed immutable checkpoint that case-folds after SQL decoding, adds the exact mixed-case all-family and all-field matrix, proves zero persistence, regenerates matching evidence, and then undergoes another independent rerun. The unchanged canonical auth, runtime grants, staging, browser, accessibility, rollback, monitoring, and protected-consumer evidence is still required before any State C review.

## Final SQL Case-Folding Rerun: 2026-07-15

Audit target: `ba17e22b0fe8a48a7397557ef95d2ceb454970d4`
Branch: `i1q-question-platform-ultra-1007x-ma`
Target relationship: exact local `HEAD` and exact tracked origin when inspected
Current State C verdict: `RELEASE VETO`
Current State A verdict: `SUPPORTED ONLY AS A DATED POINT-IN-TIME AGGREGATE`
IRT-009: `CLOSED IN LOCAL EXACT-CHECKPOINT SCOPE`
IRT-010: `CLOSED FOR EXACT-CHECKPOINT EVIDENCE INTEGRITY`

### 1. Scope Completed

Inspected exact Git objects at `ba17e22`, the two-commit repair lineage from `65bb52c` through `e9e807c`, SQL normalization and Class D scanning order, the expanded mixed-case relational fixture, all seven release-linked identifier families, all four Class C prose fields, all seven required variants, encoded markers, bounded depth and size behavior, SQLSTATE assertions, zero-row assertions, JavaScript construction, the frozen STAT projection, the opaque public question ID, package and focused tests, fresh disposable PostgreSQL 16, all 44 evidence checksums, inventory qualification, candidate counts, deployment blockers, evidence validation, and root dependency audit.

No production, protected runtime, source content, transcript, student data, secret, configured environment value, Stream, R2, CDN object, Supabase, Railway, WordPress, or external datastore was accessed. No product, migration, test, evidence, root, authority, shared, deployment, flag, Git, or remote mutation was made.

### 2. Evidence Inspected

- Exact Git object `ba17e22:i1q-question-platform/db/migrations/20260715122434_i1q_1007x_question_platform.sql:2896-2955,3073-3147,3238-3294`.
- Exact Git object `ba17e22:i1q-question-platform/tests/postgres-migration.test.mjs:398-563,609-753,884-1064`.
- Exact Git object `ba17e22:i1q-question-platform/tests/migration-1007x.test.mjs:238-300`.
- Exact Git object `ba17e22:i1q-question-platform/src/exports.mjs:64-65,74-105,129-138,173-193,268-281,321-337`.
- Exact Git object `ba17e22:i1q-question-platform/tests/exports-class-c.test.mjs:301-463`.
- Exact Git objects under `ba17e22:i1q-question-platform/evidence/`, especially `artifact_checksums.json`, `inventory_report.json`, `candidate_counts.json`, `deployment_manifest.json`, `test_results.json`, and `migration_validation.json`.
- All preserved authority, architecture, auth, RLS, rollback, monitoring, protected-consumer, privacy, UI, UX, and accessibility evidence from the prior sections.

### 3. Findings

#### Current Dispositions

| ID | Status at `ba17e22` | Basis |
| --- | --- | --- |
| IRT-001 | `OPEN, CRITICAL` | Canonical integration and operational State C evidence remain absent. |
| IRT-002 | `RESOLVED IN LOCAL APPLICATION SCOPE` | Closed-world Class C projection and release-linked value scanning now pass the requested local matrices. |
| IRT-003 | `RESOLVED IN LOCAL APPLICATION SCOPE` | Exact-assignment review content remains available under focused and full tests. External runtime behavior is unverified. |
| IRT-004 | `TRUTHFULLY QUALIFIED, NOT RECOMPUTABLE` | Evidence remains a dated point-in-time aggregate with no retained privacy-safe row manifest. |
| IRT-005 | `OPEN` | Canonical runtime auth, grants, repository composition, and staging RLS proof remain absent. |
| IRT-006 | `OPEN, EXTERNAL SCOPE` | No local counterexample remains in the requested matrix, but no deployed global answer or source leak proof exists. |
| IRT-007 | `OPEN` | Operational rollback, monitoring, and protected-consumer certification remain absent. |
| IRT-008 | `OPEN` | Browser, assistive-technology, human, responsive, and required UX-score proof remain absent. |
| IRT-009 | `CLOSED IN LOCAL EXACT-CHECKPOINT SCOPE` | JavaScript and fresh PostgreSQL independently reject the complete requested matrix before hashing or insertion. |
| IRT-010 | `CLOSED` | All 44 exact checkpoint checksum records match Git objects and inventory qualification is present. |

#### IRT-009 Closure

The `65bb52c` finding is preserved immediately above and remains historically valid for that checkpoint. At `ba17e22`, migration line `2928` applies lowercase folding after every URL decode pass, and line `2949` applies lowercase folding after final NFKC normalization. The scalar leak checks remain at lines `3238-3254`, before hashing at line `3268`, artifact insertion at line `3269`, and payload insertion at line `3293`.

The expanded disposable fixture links actual mixed-case values for item, revision, source, claim, reviewer, misconception, and psychometric families into the tested release. Its committed matrix asserts `28` direct, `28` Base64, `28` Base64URL, `56` separator-encoded, and `56` full printable-ASCII identifier denials. Total identifier probes: `196`. It also asserts `16` encoded-marker denials, depth 9 and 65,537-byte `54000` failures, `42501` for all leak denials, and zero matching artifact and payload rows.

Independent JavaScript replay result: `196/196` identifier combinations denied, depth and size bounds passed, the opaque public question ID remained valid, and the STAT projection retained exactly nine frozen fields.

Independent PostgreSQL replay used separate temporary helpers and probe IDs after a fresh apply, exact reapply, role attack, compensation, and reapply run. Result: `196/196` identifier denials across 7 families, 4 fields, and 7 variants; `16/16` marker denials; `2/2` limit probes returned `54000`; `0` artifact rows and `0` payload rows persisted. Any scanner fall-through would have produced an uncaught uniqueness or insertion error instead of the required `42501`, so the result establishes pre-hash and pre-insert rejection for the tested matrix.

No new actionable local high-severity defect was found in the repair delta. IRT-009 is closed only for the exact local code and tested encoding contract. It is not a global deployed no-leak certification.

#### IRT-010 Closure

The exact Git-object replay loaded each of the 44 records from `artifact_checksums.json`, then independently loaded and hashed the named object at `ba17e22`. Result: `44/44` byte and SHA-256 matches, `0` stale, and `0` missing. IRT-010 remains closed for exact-checkpoint evidence integrity only.

#### IRT-004 Qualification

Exact evidence declares `evidence_scope=POINT_IN_TIME_AGGREGATE`, `row_manifest_retained=false`, `independently_recomputable_from_git=false`, and a dated statement that no privacy-safe row manifest was retained. Exact-tree search found no row manifest.

The evidence reports 97 registry rows, 97 transcript references, 97 nodes references, 0 local VTT files, 0 working-redacted sources, 0 extraction-ready sources, 0 real candidates, and 0 physician approvals. The 97 privacy-blocked total follows from the dated 97-source inventory and its `all_sources_privacy_blocked` status. These are point-in-time reports, not independently recomputable current facts. No State B, C, or D claim is supported.

#### Evidence Classification

| Classification | Current statement |
| --- | --- |
| Verified current fact | `HEAD`, tracked origin, and the audit target resolve to exact `ba17e22b0fe8a48a7397557ef95d2ceb454970d4`. |
| Verified current fact | JavaScript denied `196/196` requested identifier combinations and preserved the opaque ID and frozen nine-field STAT shape. |
| Verified current fact | Independent PostgreSQL denied `196/196` identifiers and `16/16` markers, returned `54000` for both limits, and persisted zero probe rows. |
| Verified current fact | Focused tests passed 88, package tests passed 227 with 0 failures and 1 gated skip, fresh PostgreSQL passed 13, validator passed 20/20 as State A, and root audit found 0 vulnerabilities. |
| Verified current fact | All 44 exact checksum records match Git objects. |
| Verified current fact | Deployment evidence has 0 URLs, a null canonical route, and all 6 feature flags false. |
| Point-in-time report | The dated corpus packet reports the 97-source aggregate, no working redactions, and no extraction-ready sources. |
| Point-in-time report | Candidate evidence reports 0 real candidates and 0 physician approvals. |
| Inference | State A remains the highest supportable state only with the dated aggregate qualification. |
| Unverified claim | The external estate still has exactly the reported corpus and candidate totals now. |
| Unverified claim | Runtime auth, RLS, rollback, monitoring, protected consumers, browser UX, accessibility, or a deployed no-leak boundary works. |

### 4. Changes Proposed Or Made

Changed only the three Independent Red Team report outputs. No product or shared change is proposed for IRT-009 at this checkpoint. The unchanged external evidence must still be supplied before any State C review.

### 5. Tests Performed

```sh
git status --short --branch
git rev-parse HEAD
git rev-parse origin/i1q-question-platform-ultra-1007x-ma
git diff --check 65bb52c4bd14d6d20145e666e3b95b6109dfef83..ba17e22b0fe8a48a7397557ef95d2ceb454970d4
node --test tests/exports-class-c.test.mjs tests/migration-1007x.test.mjs tests/security-regressions.test.mjs tests/api.test.mjs tests/platform.test.mjs tests/ui.test.mjs
npm test
npm run validate
npm audit --omit=dev --audit-level=low
I1Q_POSTGRES_TEST_URL="<disposable-local-database-url>" node --test tests/postgres-migration.test.mjs
```

Fresh PostgreSQL clusters were created with `initdb -D "$BASE/data" -U postgres -A trust --no-locale -E UTF8`, started with `pg_ctl`, and removed by shell traps. The independent SQL cross-product was executed through `psql -X -v ON_ERROR_STOP=1` as a memory-only heredoc. The checksum replay used `git show ba17e22:<path>` and Node SHA-256 for all 44 records.

Results:

- Focused suite: `88` pass, `0` fail, `0` skip.
- Full package: `228` total, `227` pass, `0` fail, `1` intentionally gated PostgreSQL skip.
- Evidence validator: `20/20` files, `0` errors, claimed `STATE_A`.
- Root audit: `0 vulnerabilities`.
- Fresh disposable PostgreSQL 16: `13` pass, `0` fail, `0` skip.
- Independent JavaScript matrix: `196/196` identifier denials; both bounds passed; opaque ID and 9 fields passed.
- Independent PostgreSQL matrix: `196/196` identifier denials, `16/16` marker denials, `2/2` fail-closed limits, `0` persisted artifacts, `0` persisted payloads.
- Exact Git-object checksums: `44/44` match, `0` stale.
- Exact-tree row-manifest search: `0` matches.
- Repair diff check: pass.

### 6. Risks

- Local closure can be overstated as deployed or global no-leak clearance.
- The encoding defense is bounded to its explicit eight-pass, 64 KiB contract; inputs beyond the bounds fail closed rather than receive release clearance.
- Aggregate corpus and candidate counts can still be misstated as recomputable or current.
- Exact evidence integrity does not supply canonical auth, RLS composition, staging, rollback, monitoring, protected-consumer, browser, accessibility, or human evidence.
- All preserved external State C risks remain.

### 7. Blockers

IRT-009 and IRT-010 are closed at exact `ba17e22`. State C remains vetoed by IRT-001, IRT-005, IRT-006 in external scope, IRT-007, and IRT-008. IRT-004 continues to block unqualified corpus and candidate count certification.

All six flags must remain off. No State B, C, or D clearance, production release, consumer release, student release, or global deployed no-leak clearance is issued.

### 8. Confidence

State C veto: `1.00`.
State A as the highest supportable dated point-in-time state: `0.95`.
IRT-009 local exact-checkpoint closure: `0.995`.
IRT-010 exact-checkpoint closure: `1.00`.
IRT-003 local application closure: `0.98`.
Independent corpus and candidate recomputability: `0.00`.
Global deployed no-leak clearance: `0.00` absent a deployed runtime.

### 9. Exact File Paths

- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/agents/independent_red_team/independent_red_team.md`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/agents/independent_red_team/red_team_findings.json`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/agents/independent_red_team/release_veto_or_clearance.md`

### 10. Handoff To Root Supervisor

Carry `STATE C RELEASE VETO` and `STATE A SUPPORTED ONLY AS A DATED POINT-IN-TIME AGGREGATE`. At exact `ba17e22`, mark IRT-009 `CLOSED IN LOCAL EXACT-CHECKPOINT SCOPE` and IRT-010 `CLOSED FOR EXACT-CHECKPOINT EVIDENCE INTEGRITY`. Preserve the full `65bb52c` IRT-009 finding as historical audit evidence, IRT-004's non-recomputability qualification, and IRT-003's local-only closure.

Do not claim State B, C, D, production release, consumer release, student release, or global deployed leak safety. State C still requires canonical auth, exact runtime grants and Postgres composition, preview and staging, browser and accessibility evidence, human validation, operational rollback, monitoring, and protected-consumer certification on one immutable checkpoint.

============================================================
FILE: agents/independent_red_team/release_veto_or_clearance.md
============================================================
# I1Q-1007X Release Veto Or Clearance

Ticket: `I1Q-1007X-MA`
Initial audited checkpoint: `6ac62c5a0503981680f161fe5119d5e5e2fa031a`
First post-repair checkpoint: `aebc98795f28fdfc2b130e118be762a30f536259`
Final post-repair checkpoint: `2d28d0b271b637f68358fd4aae414aa2f708c63f`
Final iterative-isolation checkpoint: `65bb52c4bd14d6d20145e666e3b95b6109dfef83`
Final SQL case-folding checkpoint: `ba17e22b0fe8a48a7397557ef95d2ceb454970d4`

The initial release decision and every prior rerun below are preserved. The current decision is in `Final SQL Case-Folding Rerun: 2026-07-15`.

## Verdict

`STATE C RELEASE VETO`

`STATE A SUPPORTED WITH EVIDENCE QUALIFICATION`

The local engineering checkpoint is green and materially useful, but it is not State C. No canonical auth adapter, runtime role or grant manifest, HTTP-to-Postgres wiring, staging or production URL, browser or accessibility proof, monitoring target, operational rollback, or protected-consumer certification exists. All six flags must remain off.

State A is supported as a dated aggregate inventory attestation. The reported 97 authorized sources, 97 transcript JSON references, 97 nodes references, 0 VTT references, 97 privacy blocks, 0 working-redacted sources, 0 extraction-ready sources, 0 real candidates, and 0 physician approvals are mutually consistent. Exact totals are not independently recomputable from retained row-level aggregate evidence because the generator stores literals and unattached digests.

## 1. Scope Completed

Independently inspected authority, architecture, exact Git checkpoint and history, application and UI code, SQL and compensation, repository adapter, tests, evidence, root and specialist reports, auth, RLS, privacy, answer isolation, source isolation, release artifacts, rollback, monitoring, protected consumers, corpus counts, candidate counts, UX, and accessibility.

No protected, production, provider, secret, source-content, transcript, student-data, or external datastore access occurred. No deployment, flag, Git, application, migration, or shared-file mutation occurred.

## 2. Evidence Inspected

Inspected the Question Platform passport, DR-006, MissionMed critical contracts, architecture 1002.1 and 1004C, all source and evidence under `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/i1q-question-platform/`, and root and specialist reports under `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/`.

Key evidence paths:

- `/Users/brianb/MissionMed_OS/PRODUCT_PASSPORTS/question-platform.md`
- `/Users/brianb/MissionMed_OS/decisions/DR-006_i1q_question_platform_internal_integration.md`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/i1q-question-platform/src/exports.mjs`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/i1q-question-platform/src/platform.mjs`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/i1q-question-platform/src/server.mjs`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/i1q-question-platform/db/migrations/20260715122434_i1q_1007x_question_platform.sql`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/i1q-question-platform/db/rollback/20260715122435_i1q_1007x_compensating_disable.sql`

## 3. Findings

| ID | Severity | Finding | Release effect |
| --- | --- | --- | --- |
| IRT-001 | Critical | Canonical State C integration and operations do not exist | State C veto |
| IRT-002 | High | Class D `misconception_id` is emitted in the Class C student debrief | Consumer and student release veto |
| IRT-003 | High | Assigned reviewers cannot retrieve answer and rationale content | State C internal-review blocker |
| IRT-004 | High | Corpus and candidate counts are literals backed by point-in-time reports, not a recomputable aggregate manifest | State A qualification |
| IRT-005 | High | RLS passes locally but no canonical runtime role, grants, repository wiring, pool proof, preview, or staging proof exists | State C RLS clearance withheld |
| IRT-006 | High | No-answer-leak and no-source-leak evidence is local only | No global leak clearance |
| IRT-007 | High | Rollback, monitoring, and protected-consumer regression safety are not operationally proven | State C operations blocker |
| IRT-008 | High | Browser, accessibility, human validation, and required UX score are not proven | State C UX blocker |

Verified current facts include the exact HEAD, green local tests, offline PostgreSQL proof, all-flags-off file evidence, missing runtime integration, the Class D projection, and the blind review workflow. The 97-source and zero-candidate statements are point-in-time reports. State A is an inference supported by those reports and the absence of higher-state evidence. Runtime auth, RLS, no-leak, rollback, monitoring, regression, UI, and accessibility claims remain unverified.

## 4. Changes Proposed Or Made

Made only the three Agent 11 report files. Proposed exact remediation in `independent_red_team.md` and `red_team_findings.json`. No product or shared artifact was changed.

## 5. Tests Performed

- `npm test`: 205 pass, 0 fail, 1 intentional PostgreSQL skip.
- Fresh disposable PostgreSQL 16 migration proof: 12 pass, 0 fail, 0 skip.
- `npm run validate`: 20/20 pass, claimed State A.
- Root `npm audit --omit=dev --audit-level=low`: 0 vulnerabilities.
- Key-only Class C debrief probe: reproduced `misconception_id` in the student payload.
- Browser, accessibility, staging, production, monitoring, protected-consumer, and operational rollback tests: not run.

## 6. Risks

Primary risks are invalid State C certification, reviewer attestation without protected review content, Class D student metadata exposure, evidence counts that cannot be independently recomputed, runtime auth or RLS drift, silent failures without monitoring, untested rollback, and protected-runtime regression from unresolved source hashes.

## 7. Blockers

State C remains blocked until IRT-001, IRT-003, IRT-005, IRT-006, IRT-007, and IRT-008 are closed on one immutable checkpoint. Consumer or student release remains blocked until IRT-002 is closed and exact LT-1 through LT-6 execution is proven. Unqualified count certification remains blocked until IRT-004 is closed.

## 8. Confidence

State C veto confidence: `0.995`.

State A as the highest supportable point-in-time state: `0.90`.

Exact 97-source count independently reproducible from retained evidence: `0.55`.

Runtime no-leak, auth, RLS, rollback, monitoring, regression, UX, and accessibility clearance: `0.00`.

## 9. Exact File Paths

- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/agents/independent_red_team/independent_red_team.md`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/agents/independent_red_team/red_team_findings.json`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/agents/independent_red_team/release_veto_or_clearance.md`

## 10. Handoff To Root Supervisor

Carry `STATE C RELEASE VETO` and `STATE A SUPPORTED WITH EVIDENCE QUALIFICATION` into the root verdict. Keep every flag off. Do not claim global no answer leak, no source leak, RLS safety, auth safety, rollback safety, no regression, WCAG conformance, a passing UX score, or independently reproduced corpus and candidate counts.

Request a new independent Red Team only after all eight findings are remediated and the exact immutable candidate has canonical staging, runtime, browser, accessibility, rollback, monitoring, protected-consumer, and recomputable aggregate evidence.

## Post-Repair Rerun: 2026-07-15

Audited pushed Git object: `aebc98795f28fdfc2b130e118be762a30f536259`
Branch: `i1q-question-platform-ultra-1007x-ma`

`STATE C RELEASE VETO`

`STATE A SUPPORTED WITH POINT-IN-TIME AGGREGATE QUALIFICATION`

The shared worktree later advanced to local `6dc408f`, but this verdict credits only exact `aebc987` Git objects. All application and test files executed were proven byte-identical to the audit target.

### 1. Scope Completed

Re-inspected the `b9bb26a` application repairs, `9eadd0e` generated evidence, and `aebc987` aggregate-evidence contract. Independently reran IRT-002 and IRT-003 probes, reviewed IRT-004's schema and cross-file checks, compared all committed checksums to exact Git blobs, reran focused and full local tests, and searched for a retained privacy-safe row manifest and new local high-severity defects.

No external or protected system was accessed or mutated. No application, migration, evidence, authority, root, specialist, Git, deployment, or flag change was made.

### 2. Evidence Inspected

- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/i1q-question-platform/src/exports.mjs:47`, `:81`, `:153`, `:193`, and `:264`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/i1q-question-platform/src/platform.mjs:926` and `:1184`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/i1q-question-platform/src/server.mjs:136`, `:215`, `:298`, and `:399`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/i1q-question-platform/public/app.js:1068`, `:1143`, and `:1235`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/i1q-question-platform/scripts/generate_evidence.mjs:170`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/i1q-question-platform/src/validate-evidence.mjs:569` and `:1879`
- Exact `aebc987` evidence files `inventory_report.json`, `candidate_counts.json`, `deployment_manifest.json`, `artifact_checksums.json`, `browser_results.json`, `accessibility_results.json`, `rollback_manifest.json`, `test_results.json`, and `ux_scorecard.json`
- Initial authority, architecture, SQL, rollback, RLS, auth, root, and specialist evidence listed above and in `independent_red_team.md`

### 3. Findings

| ID | Current status | Release effect |
| --- | --- | --- |
| IRT-001 | Open, unchanged | State C veto |
| IRT-002 | Partially resolved, overall open | Direct key fixed; consumer and student veto remains through IRT-009 |
| IRT-003 | Resolved in local application scope | Original local review-content blocker closed; runtime remains unverified under other findings |
| IRT-004 | Open | Point-in-time vocabulary added, but exact evidence lacks it and no bound row manifest exists |
| IRT-005 | Open, unchanged | Runtime auth and RLS clearance withheld |
| IRT-006 | Open | No global leak clearance; IRT-009 is a local counterexample |
| IRT-007 | Open, unchanged | Operational release blocker |
| IRT-008 | Open, unchanged | UX and accessibility clearance withheld |
| IRT-009 | New High, open | A Class D identifier value passes through permitted Class C prose |
| IRT-010 | New High, open | Exact `aebc987` has 3 stale checksum entries and omits required qualification fields |

IRT-002 reproduction returned `{"misconception_key_present":false,"class_d_identifier_value_present":true,"validator_findings":[]}`. A complete `buildReleaseArtifacts` probe also succeeded with the internal source ID in `why_wrong`.

IRT-003 repair tests prove accepted exact-assignment reviewers receive answer and rationale content, while wrong purpose, actor, assignment state, hash, role, credential, feature flag, or adapter state fails closed. The UI blocks verdicts if content is unavailable and stores none in browser storage.

IRT-004 inspection found no privacy-safe row manifest. Exact `aebc987` inventory evidence lacks `evidence_scope`, `row_manifest_retained`, `independently_recomputable_from_git`, and `qualification`. The validator's recomputable branch checks only an enum and two booleans and does not name, hash, load, or recompute a manifest.

Exact checksum comparison checked `44` entries and found `3` stale: `scripts/generate_evidence.mjs`, `src/validate-evidence.mjs`, and `tests/evidence-validator.test.mjs`.

Verified current facts are the exact code behavior, local test results, exact committed evidence contents, no manifest path in the exact tree, 3 stale checksum entries, 0 deployment URLs, and all 6 file-recorded flags false. The 97-source and zero-candidate totals are point-in-time reports. State A is an inference supported by those reports and the absence of any higher-state evidence. Runtime auth, RLS, no-leak, rollback, monitoring, regression, UI, and accessibility claims remain unverified.

### 4. Changes Proposed Or Made

Changed only the three Agent 11 reports. Proposed remediation:

1. Scan exact serialized Class C strings against every Class D value from the internal revision and bind real LT-5 execution to artifact hashes.
2. Keep IRT-004 explicitly point-in-time unless a privacy-safe manifest with path, hash, schema, allowlist, row count, and independently recomputed totals exists.
3. Regenerate all evidence after final code, verify all checksums against one clean immutable commit, and rerun independent review.
4. Supply the unchanged external State C evidence before any State C clearance request.

### 5. Tests Performed

```sh
node --test tests/exports-class-c.test.mjs tests/platform.test.mjs tests/security-regressions.test.mjs tests/ui.test.mjs tests/api.test.mjs
node --test tests/evidence-validator.test.mjs
npm test
npm audit --omit=dev --audit-level=low
git diff --check 6ac62c5a0503981680f161fe5119d5e5e2fa031a..aebc98795f28fdfc2b130e118be762a30f536259
git ls-tree -r --name-only aebc98795f28fdfc2b130e118be762a30f536259 -- i1q-question-platform | rg -i 'row.*manifest|manifest.*row|inventory.*rows|candidate.*rows|aggregate.*manifest'
```

Results: focused `61` pass and `0` fail; evidence validator `30` pass and `0` fail; package `215` pass, `0` fail, `1` gated PostgreSQL skip; audit `0 vulnerabilities`; diff check pass; row-manifest search no match. Exact Git-object checksum probe: `44` checked and `3` stale. Exact Class D value probe: leak reproduced.

Initial disposable PostgreSQL proof remains historical at `12` pass, `0` fail, `0` skip; SQL did not change. No external, browser, staging, production, monitoring, protected-consumer, or operational rollback test was run.

An exact-checkout `npm run validate` was not run because the shared worktree had advanced and this agent could not materialize or replace files outside the three report outputs. Exact Git-object checks establish three `E_ARTIFACT_STALE` conditions and `E_REAL_INVENTORY_QUALIFICATION` at `aebc987`; no later-worktree result is credited.

### 6. Risks

Current risks are Class D value disclosure through student prose, overstated leak-test coverage, a stale exact-commit evidence packet, self-asserted recomputability without a manifest, and mistaken promotion of local review and SQL mechanics into runtime certification. All initial external and operational risks remain.

### 7. Blockers

State C remains blocked by IRT-001, IRT-005, IRT-006, IRT-007, and IRT-008. IRT-009 blocks consumer and student release. IRT-004 blocks unqualified count certification. IRT-010 blocks exact-commit evidence clearance. All six flags must remain off.

### 8. Confidence

State C veto: `0.998`.
IRT-003 local resolution: `0.98`.
IRT-002 overall remains open: `0.995`.
Exact `aebc987` evidence staleness: `1.00`.
State A as highest supportable point-in-time state: `0.92`.
Independent recomputability of exact corpus and candidate totals: `0.00` without a retained manifest.

### 9. Exact File Paths

- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/agents/independent_red_team/independent_red_team.md`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/agents/independent_red_team/red_team_findings.json`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/agents/independent_red_team/release_veto_or_clearance.md`

### 10. Handoff To Root Supervisor

Carry `STATE C RELEASE VETO` and `STATE A SUPPORTED WITH POINT-IN-TIME AGGREGATE QUALIFICATION`. Mark IRT-003 locally resolved, IRT-002 partially resolved but open, IRT-004 open, IRT-009 open, and IRT-010 open. Do not report exact `aebc987` as evidence-validator green. Request another independent review only after one new pushed immutable checkpoint contains the final code and regenerated matching evidence, and only consider State C after all missing external integration and operational proof exists.

## Final Post-Repair Rerun: 2026-07-15

Audited pushed checkpoint: `2d28d0b271b637f68358fd4aae414aa2f708c63f`
Branch: `i1q-question-platform-ultra-1007x-ma`

`STATE C RELEASE VETO`

`STATE A SUPPORTED ONLY AS A DATED POINT-IN-TIME AGGREGATE`

### 1. Scope Completed

Independently inspected exact Git objects, JavaScript and SQL Class D isolation, release-linked identifier families, validation ordering, frozen STAT projection, public question identity, reviewer access, all 44 checksum records, inventory qualification, evidence validation, and current tests. No non-report path or protected system was changed.

### 2. Evidence Inspected

Key paths are `src/exports.mjs:62-161,183-218,289-344`, `src/platform.mjs:1157-1206`, migration `20260715122434_i1q_1007x_question_platform.sql:2866-3213`, `tests/exports-class-c.test.mjs:215-385`, `tests/postgres-migration.test.mjs:202,312`, and exact `2d28d0b` evidence under `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/i1q-question-platform/evidence/`.

### 3. Findings

| Finding | Final disposition |
| --- | --- |
| IRT-009 | `OPEN, HIGH`. Direct isolation passes, but double URL-encoded Class D values and markers bypass JavaScript before artifact and manifest hashing. |
| IRT-010 | `CLOSED`. All `44/44` checksum entries match exact Git-object bytes and hashes; qualification fields exist. |
| IRT-004 | `TRUTHFULLY QUALIFIED, NOT RECOMPUTABLE`. No privacy-safe row manifest exists. |
| IRT-003 | `RESOLVED IN LOCAL APPLICATION SCOPE`. External runtime behavior remains unverified. |
| State C blockers | `OPEN`. Canonical integration and operational evidence remain absent. |

IRT-009 matrix results: `28/28` direct identifier and field combinations denied, `172/196` encoded identifier combinations denied, and `20/24` encoded marker combinations denied. The `28` bypasses are double URL-encoded cases. A targeted bypass remained in the Class C payload and produced both artifact and manifest hashes. The opaque public composite question ID remained valid, and the frozen nine-column STAT projection remained exact.

SQL source places value and marker checks before hashing and insertion and gathers all seven requested release-linked identifier families. A fresh independent PostgreSQL run was not completed because local storage prevented disposable-cluster creation. No SQL runtime clearance is claimed.

### 4. Changes Proposed Or Made

Changed only the three Independent Red Team reports. Exact remediation is bounded iterative decoding until stable, double and triple encoding tests for every family and field in JavaScript and PostgreSQL, and proof that denied payloads leave no hash or inserted artifact.

### 5. Tests Performed

- Focused: `84` pass, `0` fail, `0` skip.
- Full package: `223` pass, `0` fail, `1` gated PostgreSQL skip, `224` total.
- Evidence validator: `20/20`, `0` errors, claimed `STATE_A`.
- Root audit: `0 vulnerabilities`.
- Exact checksum comparison: `44/44`, `0` stale.
- Independent JavaScript matrix: `248` attempts, `220` denied, `28` bypasses.
- Disposable PostgreSQL: not run because `/tmp` returned `no space left on device` before startup.

Commands included `node --test` on the six focused files, `npm test`, `npm run validate`, `npm audit --omit=dev --audit-level=low`, exact `git show` checksum comparison, exact-tree manifest search, and a memory-only `buildReleaseArtifacts` encoding matrix.

### 6. Risks

Iteratively encoded internal identifiers can be hashed into JavaScript release artifacts. Green committed tests omit this encoding depth. Changed SQL lacks a fresh independent runtime execution. Point-in-time counts may be overstated downstream. All external State C risks remain.

### 7. Blockers

IRT-009 blocks student and consumer release. IRT-001, IRT-005, IRT-006, IRT-007, and IRT-008 veto State C. IRT-004 blocks unqualified count certification. IRT-010 is closed. All six flags must remain off, and no State B, C, or D clearance is issued.

### 8. Confidence

State C veto: `0.999`.
State A point-in-time support: `0.95`.
IRT-009 open: `1.00`.
IRT-010 closed: `1.00`.
IRT-003 locally resolved: `0.98`.
Independent count recomputability: `0.00`.

### 9. Exact File Paths

- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/agents/independent_red_team/independent_red_team.md`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/agents/independent_red_team/red_team_findings.json`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/agents/independent_red_team/release_veto_or_clearance.md`

### 10. Handoff To Root Supervisor

Carry State C veto and State A only as a dated point-in-time aggregate. Mark IRT-009 open, IRT-010 closed, IRT-004 explicitly non-recomputable, and IRT-003 locally resolved only. Do not claim State B, C, D, consumer release, global leak safety, or SQL runtime clearance.

## Final Iterative-Isolation Rerun: 2026-07-15

Audited pushed checkpoint: `65bb52c4bd14d6d20145e666e3b95b6109dfef83`
Branch: `i1q-question-platform-ultra-1007x-ma`

`STATE C RELEASE VETO`

`STATE A SUPPORTED ONLY AS A DATED POINT-IN-TIME AGGREGATE`

`IRT-009 OPEN, HIGH`

`IRT-010 CLOSED FOR EXACT-CHECKPOINT EVIDENCE INTEGRITY`

### 1. Scope Completed

Independently inspected exact Git objects, repair history, JavaScript and PostgreSQL Class D normalization and isolation, all seven identifier families, all four Class C prose fields, required encodings, validation order, hash and insert order, bounded depth and size behavior, zero-row expectations, frozen STAT projection, public question identity, all 44 checksum records, inventory qualification, validator, package tests, root audit, and fresh disposable PostgreSQL 16 behavior.

No product, evidence, authority, root, shared, external, production, protected-system, deployment, flag, commit, or push mutation occurred.

### 2. Evidence Inspected

- `65bb52c:i1q-question-platform/src/exports.mjs:64-65,74-105,129-138,173-193,268-281,321-337`.
- `65bb52c:i1q-question-platform/db/migrations/20260715122434_i1q_1007x_question_platform.sql:2866-2955,3001-3146,3237-3293`.
- `65bb52c:i1q-question-platform/tests/exports-class-c.test.mjs:301-463`.
- `65bb52c:i1q-question-platform/tests/postgres-migration.test.mjs:568-713,816-980`.
- Exact evidence objects `artifact_checksums.json`, `inventory_report.json`, `candidate_counts.json`, `deployment_manifest.json`, and `health_check_results.json`.
- All preserved external integration, auth, RLS, rollback, monitoring, consumer, browser, UX, and accessibility evidence.

### 3. Findings

| Finding | Current disposition |
| --- | --- |
| IRT-009 | `OPEN, HIGH`. JavaScript passes the requested matrix. PostgreSQL permits mixed-case source identifiers under full printable-ASCII double and triple URL encoding. |
| IRT-010 | `CLOSED`. All `44/44` checksum records match exact Git objects and inventory qualification fields exist. |
| IRT-004 | `TRUTHFULLY QUALIFIED, NOT RECOMPUTABLE`. No privacy-safe row manifest was retained. |
| IRT-003 | `RESOLVED IN LOCAL APPLICATION SCOPE`. External runtime behavior remains unverified. |
| State C blockers | `OPEN`. Canonical auth, runtime grants and composition, staging, browser, accessibility, rollback, monitoring, and protected-consumer evidence remain absent. |

JavaScript denied `196/196` combinations: 7 release-linked identifier families, 4 prose fields, and 7 direct or encoding variants. It also failed closed at URL depth 9 and 65,537 bytes. The opaque public question ID remained valid and the STAT projection remained exactly nine fields.

PostgreSQL's direct scanner detected `47/49` family and variant pairs. It missed full printable-ASCII depth 2 and depth 3 for the actual mixed-case release-linked source fixture. Eight dynamic probes across both depths and all four fields persisted `8` artifact rows and `8` payload rows in `8` fresh disposable releases. Checks therefore did not run successfully before hashing and insertion. The required zero-persistence assertion fails.

Root cause: SQL lowercases before iterative URL decoding at migration line `2916`. Printable-ASCII decoding at lines `2917-2929` restores uppercase bytes after that case fold, and the value is returned without another lower operation. Direct comparison at line `3120` then misses the lowercase release identifier.

Exact remediation:

1. Case-fold after every SQL decode pass and immediately before comparison.
2. Add mixed-case actual identifiers for all seven families and every required variant and prose field.
3. Assert `42501` leak denials, `54000` depth and size denials, and zero artifact and payload rows.
4. Regenerate the evidence packet and checksums after the code and test repair.

IRT-010 remains closed only for exact evidence integrity. State A remains a dated report: 97 registry rows, 97 transcript references, 97 nodes references, 0 VTT references, 97 privacy-blocked sources, 0 working-redacted sources, 0 extraction-ready sources, 0 real candidates, and 0 physician approvals. Exact evidence explicitly says `POINT_IN_TIME_AGGREGATE`, no row manifest, and no independent Git recomputability.

### 4. Changes Proposed Or Made

Changed only the three Independent Red Team reports. No other path was edited. Proposed only the IRT-009 SQL and regression-test repair plus the unchanged external State C evidence requirements.

### 5. Tests Performed

```sh
git rev-parse HEAD
git rev-parse origin/i1q-question-platform-ultra-1007x-ma
node --test tests/exports-class-c.test.mjs tests/migration-1007x.test.mjs tests/security-regressions.test.mjs tests/api.test.mjs tests/platform.test.mjs tests/ui.test.mjs
npm test
npm run validate
npm audit --omit=dev --audit-level=low
I1Q_POSTGRES_TEST_URL="<disposable-local-database-url>" node --test tests/postgres-migration.test.mjs
```

Results:

- Exact `HEAD` and tracked origin: `65bb52c4bd14d6d20145e666e3b95b6109dfef83`.
- Focused: `88` pass, `0` fail, `0` skip.
- Package: `227` pass, `0` fail, `1` gated skip, `228` total.
- Evidence validator: `20/20`, `0` errors, claimed `STATE_A`.
- Root audit: `0 vulnerabilities`.
- Fresh PostgreSQL: `13` pass, `0` fail, `0` skip.
- JavaScript adversarial matrix: `196/196` denied, bounds passed, opaque ID valid, 9 fields exact.
- PostgreSQL scanner matrix: `47/49` detected, `2/49` bypassed.
- PostgreSQL persistence matrix: `8/8` bypasses persisted artifacts and payloads.
- Exact checksum comparison: `44/44`, `0` stale.

The additional independent matrices were executed as memory-only `node --input-type=module` and `psql -X -v ON_ERROR_STOP=1` heredocs against fresh disposable clusters. No repository fixture or test was altered.

### 6. Risks

- PostgreSQL can persist an encoded mixed-case Class D identifier in student-facing Class C prose.
- The green committed PostgreSQL suite does not cover the failing mixed-case full-ASCII cross-product.
- Checksum-perfect evidence may be misread as release clearance.
- Point-in-time aggregate counts may be misreported as recomputable or current.
- Every preserved external State C risk remains.

### 7. Blockers

IRT-009 blocks consumer and student release. IRT-001, IRT-005, IRT-006, IRT-007, and IRT-008 veto State C. IRT-004 blocks unqualified count certification. IRT-010 is not a current evidence-integrity blocker.

All six flags must remain off. No State B, C, or D clearance is issued.

### 8. Confidence

State C veto: `1.00`.
State A point-in-time support: `0.95`.
IRT-009 open: `1.00`.
IRT-010 closed: `1.00`.
IRT-003 local closure: `0.98`.
Independent count recomputability: `0.00`.
PostgreSQL Class D isolation clearance: `0.00`.

### 9. Exact File Paths

- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/agents/independent_red_team/independent_red_team.md`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/agents/independent_red_team/red_team_findings.json`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/agents/independent_red_team/release_veto_or_clearance.md`

### 10. Handoff To Root Supervisor

Carry `STATE C RELEASE VETO` and `STATE A SUPPORTED ONLY AS A DATED POINT-IN-TIME AGGREGATE`. At exact `65bb52c`, mark IRT-009 open and IRT-010 closed. Preserve IRT-004's non-recomputability qualification and IRT-003's local-only closure.

Do not claim State B, C, D, consumer release, student release, global no-leak safety, or PostgreSQL isolation. Require a new pushed immutable repair checkpoint, zero-persistence proof for the exact matrix, regenerated checksum-matching evidence, and another independent rerun. State C additionally requires every unchanged external integration and operational artifact.

## Final SQL Case-Folding Rerun: 2026-07-15

Audited pushed checkpoint: `ba17e22b0fe8a48a7397557ef95d2ceb454970d4`
Branch: `i1q-question-platform-ultra-1007x-ma`

`STATE C RELEASE VETO`

`STATE A SUPPORTED ONLY AS A DATED POINT-IN-TIME AGGREGATE`

`IRT-009 CLOSED IN LOCAL EXACT-CHECKPOINT SCOPE`

`IRT-010 CLOSED FOR EXACT-CHECKPOINT EVIDENCE INTEGRITY`

### 1. Scope Completed

Independently inspected exact Git objects, the SQL case-folding repair, mixed-case relational fixtures for all seven identifier families, all required field and encoding variants, marker and limit probes, SQLSTATE and zero-row assertions, validation order, JavaScript release construction, frozen STAT projection, public question identity, all 44 checksums, inventory qualification, package and focused tests, validator, root audit, and fresh disposable PostgreSQL 16 behavior.

Only the three Independent Red Team reports were changed. No product, test, evidence, authority, root, shared, external, protected, deployment, flag, Git, or remote mutation occurred.

### 2. Evidence Inspected

- `ba17e22:i1q-question-platform/db/migrations/20260715122434_i1q_1007x_question_platform.sql:2896-2955,3073-3147,3238-3294`.
- `ba17e22:i1q-question-platform/tests/postgres-migration.test.mjs:398-563,609-753,884-1064`.
- `ba17e22:i1q-question-platform/tests/migration-1007x.test.mjs:238-300`.
- `ba17e22:i1q-question-platform/src/exports.mjs:64-65,74-105,129-138,173-193,268-281,321-337`.
- `ba17e22:i1q-question-platform/tests/exports-class-c.test.mjs:301-463`.
- Exact evidence objects `artifact_checksums.json`, `inventory_report.json`, `candidate_counts.json`, `deployment_manifest.json`, `test_results.json`, and `migration_validation.json`.
- All prior external integration, auth, RLS, rollback, monitoring, consumer, browser, UX, and accessibility evidence.

### 3. Findings

| Finding | Current disposition |
| --- | --- |
| IRT-009 | `CLOSED IN LOCAL EXACT-CHECKPOINT SCOPE`. JavaScript and fresh PostgreSQL independently deny the complete requested matrix before hashing or insertion. |
| IRT-010 | `CLOSED`. All `44/44` checksum records match exact Git objects and inventory qualification fields exist. |
| IRT-004 | `TRUTHFULLY QUALIFIED, NOT RECOMPUTABLE`. No privacy-safe row manifest was retained. |
| IRT-003 | `RESOLVED IN LOCAL APPLICATION SCOPE`. External runtime behavior remains unverified. |
| State C blockers | `OPEN`. Canonical auth, runtime grants and composition, staging, browser, accessibility, rollback, monitoring, and protected-consumer evidence remain absent. |

The full `65bb52c` mixed-case SQL finding remains preserved above. At `ba17e22`, SQL lowercases after every URL decode pass and after final normalization. Independent JavaScript denied `196/196` identifier probes. Independent PostgreSQL denied `196/196` identifiers plus `16/16` markers, returned `54000` for depth 9 and 65,537-byte limits, and persisted `0` artifact and `0` payload rows. All leak denials used `42501`. The opaque public question ID remained valid and the STAT projection remained exactly nine frozen fields.

The Class D checks occur at migration lines `3238-3254`, before hashing at `3268`, artifact insertion at `3269`, and payload insertion at `3293`. Any bypass in the independent harness would have surfaced as an uncaught uniqueness or insertion error, so the observed `42501` results establish rejection before those operations for the tested contract.

IRT-010 remains closed with `44/44` exact Git-object matches and `0` stale records. State A remains only a dated report: 97 registry rows, 97 transcript references, 97 nodes references, 0 local VTT files, 97 privacy-blocked sources, 0 working-redacted sources, 0 extraction-ready sources, 0 real candidates, and 0 physician approvals. Exact evidence explicitly declares `POINT_IN_TIME_AGGREGATE`, no retained row manifest, and no independent Git recomputability.

### 4. Changes Proposed Or Made

Changed only the three Independent Red Team reports. No further local IRT-009 change is proposed at this checkpoint. All external State C evidence remains required.

### 5. Tests Performed

```sh
git rev-parse HEAD
git rev-parse origin/i1q-question-platform-ultra-1007x-ma
git diff --check 65bb52c4bd14d6d20145e666e3b95b6109dfef83..ba17e22b0fe8a48a7397557ef95d2ceb454970d4
node --test tests/exports-class-c.test.mjs tests/migration-1007x.test.mjs tests/security-regressions.test.mjs tests/api.test.mjs tests/platform.test.mjs tests/ui.test.mjs
npm test
npm run validate
npm audit --omit=dev --audit-level=low
I1Q_POSTGRES_TEST_URL="<disposable-local-database-url>" node --test tests/postgres-migration.test.mjs
```

Results:

- Exact `HEAD` and tracked origin: `ba17e22b0fe8a48a7397557ef95d2ceb454970d4`.
- Focused: `88` pass, `0` fail, `0` skip.
- Package: `227` pass, `0` fail, `1` gated skip, `228` total.
- Evidence validator: `20/20`, `0` errors, claimed `STATE_A`.
- Root audit: `0 vulnerabilities`.
- Fresh PostgreSQL: `13` pass, `0` fail, `0` skip.
- JavaScript matrix: `196/196` denied, limits passed, opaque ID valid, 9 fields exact.
- Independent PostgreSQL matrix: `196/196` identifiers and `16/16` markers denied, `2/2` limits fail closed, `0` persisted artifacts, `0` persisted payloads.
- Exact checksum replay: `44/44`, `0` stale.
- Exact-tree row-manifest search: `0` matches.

Fresh clusters used `initdb -U postgres -A trust --no-locale -E UTF8`, `pg_ctl`, and automatic cleanup traps. Independent JavaScript and SQL matrices were memory-only heredocs and did not alter repository files.

### 6. Risks

- Local exact-checkpoint closure may be overstated as deployed no-leak certification.
- The normalization contract is intentionally bounded; over-depth and over-size inputs fail closed.
- Point-in-time aggregate counts may be misreported as independently recomputable or current.
- Checksum-perfect evidence does not prove external integration or operations.
- Every preserved external State C risk remains.

### 7. Blockers

IRT-009 and IRT-010 are closed at `ba17e22`. IRT-001, IRT-005, IRT-006 in external scope, IRT-007, and IRT-008 continue to veto State C. IRT-004 blocks unqualified count certification.

All six flags must remain off. No State B, C, or D clearance, production release, consumer release, student release, or global deployed leak clearance is issued.

### 8. Confidence

State C veto: `1.00`.
State A point-in-time support: `0.95`.
IRT-009 local exact-checkpoint closure: `0.995`.
IRT-010 closure: `1.00`.
IRT-003 local closure: `0.98`.
Independent count recomputability: `0.00`.
Global deployed no-leak clearance: `0.00`.

### 9. Exact File Paths

- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/agents/independent_red_team/independent_red_team.md`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/agents/independent_red_team/red_team_findings.json`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/agents/independent_red_team/release_veto_or_clearance.md`

### 10. Handoff To Root Supervisor

Carry `STATE C RELEASE VETO` and `STATE A SUPPORTED ONLY AS A DATED POINT-IN-TIME AGGREGATE`. Mark IRT-009 and IRT-010 closed at exact `ba17e22`, while preserving the `65bb52c` finding and all earlier history. Preserve IRT-004's non-recomputability qualification and IRT-003's local-only closure.

Do not claim State B, C, D, production release, consumer release, student release, or global deployed no-leak safety. State C still requires canonical auth, runtime grants and Postgres composition, preview and staging, browser and accessibility proof, human validation, operational rollback, monitoring, and protected-consumer certification on one immutable checkpoint.

============================================================
FILE: agents/lorentz_security/answer_isolation_report.md
============================================================
# I1Q-1007X Answer Isolation Report

Verdict: FAIL, SECURITY VETO

Date: 2026-07-15

## Authority Context

DR-006 and MissionMed OS PR #12 now settle the protected integration boundary: exact nine-field server storage, class A pre-answer output, server-only `answer_map`, unchanged sealed packs, and no reveal before finalization. The first audit's authority blockers were snapshot-time root-recovery findings. The answer-disclosure defects below remain current.

## Data Classes

| Class | Examples | Delivery rule |
| --- | --- | --- |
| A | Prompt, projected opaque ID, sealed choice text/order, approved rendering metadata | Pre-answer allowed by channel policy |
| B | Answer, correct key, `answer_map`, `is_correct`, correctness aliases, scoring internals | Server-only before authorized reveal |
| C | Explanation, correct and wrong rationales, teaching point, approved remediation | Post-answer only at channel reveal point |
| D | Internal IDs, source/evidence/reviewer records, assignments, policies, psychometrics | Internal/server-only by RBAC |

Unknown fields fail closed. A field's placement in the nine-column server table does not make it client-safe.

## Candidate Channel Review

| Channel | Declared phase | Intended content | Assessment |
| --- | --- | --- | --- |
| `stat_dataset_questions` | server-only | Exact nine-field rows | Shape PASS; storage/RLS unproved |
| `stat_pre_answer` | pre-answer | Dataset version, question ID, prompt, choices | Generated fixture is answer-free; validator incomplete |
| `stat_post_answer_debrief` | post-answer | Answer, explanation, rationales | Authorization FAIL; caller controls phase |
| `stat_indexes` / `stat_lookup` | pre-answer | Lookup/index data | Bare-ID collision and class policy gaps |
| `question_metadata` | server-only | Composite metadata and internal links | Version field present; mapping incomplete |
| Generic `item_revisions` resource | internal | Full revision | P0 answer disclosure to read-only roles |
| Generic channel artifact endpoint | mixed | Artifact payload | P0 post-answer reveal bypass |

## Confirmed P0 Findings

### AIR-001: generic revision disclosure

`QuestionPlatform.list` and `get` accept every read role for `item_revisions`. `#sanitizeResource` removes some private source fields but not answer-bearing revision fields. A synthetic probe confirmed that `read_only` receives both answer and explanation.

### AIR-002: caller-authorized reveal

The API forwards a query parameter to `artifactForPhase`. The service treats the literal string `post_answer_finalized` as sufficient authorization. No duel state or participant is checked.

### AIR-003: leak scanner omissions

The scanner catches several aliases but omits the architecture-mandated `answer_map` and `is_correct`. A probe confirmed both aliases pass undetected. The scanner also lacks:

- Closed-world channel field membership.
- Answer-value scans inside strings and metadata.
- Choice-order correlation/shuffle invariance.
- Class D field detection.
- Log, error, cache, and filename scans.

## `answer_map` Assessment

Candidate code does not query live `answer_map`; this is a narrow pass. It does not prove isolation because:

- The scanner fails to recognize the field name.
- Full Item Revisions expose equivalent answers directly.
- The post-answer endpoint lacks finalization and participant authorization.
- Candidate SQL broadly exposes channel artifacts and Item Revisions to any asserted actor.

The canonical Data Flow rule remains: `answer_map` is returned only by the existing authorized result path after server finalization and participant verification.

## Required Isolation Architecture

1. Separate answer-bearing storage or use an equivalent base-table boundary that ordinary roles cannot select.
2. Remove generic answer-bearing resource access.
3. Add explicit purpose-scoped answer endpoints for assigned author/reviewer/release workflows.
4. Audit every answer read with actor, purpose, exact revision, and release/duel context.
5. Derive reveal authorization from authoritative server state and participant identity.
6. Generate every channel from one immutable release membership set.
7. Enforce a versioned closed-world Channel Security Policy.
8. Scan names, values, nested strings, ordering correlations, D metadata, logs, errors, caches, and filenames.
9. Deny base answer-table grants to browser-facing roles.
10. Test old attempts and sealed-pack scoring to prove no behavior change.

## Required Negative Tests

- Read-only list/get of Item Revisions.
- Author reading an unassigned revision.
- Reviewer reading another reviewer's assignment.
- Release manager reading without a recorded purpose.
- `answer_map`, `is_correct`, `correct`, `solution`, answer values, and nested aliases in pre-answer data.
- Active, pending, void, and nonexistent duel reveal attempts.
- Finalized duel requested by nonparticipant.
- Direct base-table and artifact-table SELECT.
- Error, log, cache, source map, and static-bundle secret scan.
- Choice shuffle and identifier-correlation tests.

## Final Assessment

The pre-answer fixture happens to omit answers, but the application does not enforce answer isolation as a system invariant. All answer-bearing API and RLS paths remain release blockers.

============================================================
FILE: agents/lorentz_security/auth_test_matrix.md
============================================================
# I1Q-1007X Authentication and Authorization Test Matrix

Status: BASELINE; CANONICAL ADAPTER NOT IMPLEMENTED

Verdict: BLOCK

## Authority Context

DR-006 and MissionMed OS PR #12 now authorize reuse of the canonical MissionMed internal authentication/session chain. The original authority gap was a snapshot-time root-recovery finding. This matrix remains mandatory because authorization, expiry, revocation, CSRF, IDOR, and reviewer binding are not repaired.

## Identity Adapter Contract

The adapter must return a server-derived immutable actor containing a canonical subject and an explicitly mapped I1Q role set. The request may not supply actor ID, reviewer ID authority, credentials, or roles. Database context must be created from that actor for one transaction and then cleared.

## Session and Boundary Cases

| ID | Case | Expected result | Candidate status | Evidence / gap |
| --- | --- | --- | --- | --- |
| AUTH-001 | Public health request | `200`, no protected data | PASS LOCAL | `/api/health` is public |
| AUTH-002 | Protected API without identity adapter | `401` | PASS LOCAL | Candidate fails closed |
| AUTH-003 | Valid canonical session, mapped read-only role | Only answer-free authorized resources | FAIL | Generic item revision read exposes answer fields |
| AUTH-004 | Valid session, unknown WordPress role | `403`, no role fallback | NOT IMPLEMENTED | No canonical role mapper |
| AUTH-005 | Actor ID supplied by request header/body/query | Ignored and rejected where ambiguous | NOT IMPLEMENTED | Resolver contract undefined |
| AUTH-006 | Expired session | `401`; cookie cleared where canonical flow requires | BLOCKED | No adapter test; inspected HQ source warns and accepts expiry |
| AUTH-007 | Revoked session | `401` | NOT TESTED | Revocation contract absent |
| AUTH-008 | Logout followed by API request | `401` | NOT TESTED | Canonical logout integration absent |
| AUTH-009 | Session fixation / pre-login cookie reuse | Session identifier and CSRF rotate | NOT TESTED | Adapter absent |
| AUTH-010 | Auth service outage | `503` or controlled `401`; no demo/admin fallback | NOT TESTED | Failure contract absent |
| AUTH-011 | Direct URL to internal UI | Authentication gate before protected data | NOT TESTED | No canonical host integration |
| AUTH-012 | Direct API resource enumeration | Per-entity authorization and IDOR protection | FAIL | Generic list/get accepts any read role |
| AUTH-013 | Cookie mutation without CSRF header | `403` | FAIL | I1Q server has no CSRF validation |
| AUTH-014 | Invalid CSRF token | `403` | FAIL | I1Q server has no CSRF validation |
| AUTH-015 | Cross-origin mutation | Rejected by origin/CSRF policy | NOT IMPLEMENTED | Restrictive CORS does not itself prove CSRF protection |
| AUTH-016 | Role escalation by body payload | `403`; payload cannot grant authority | FAIL | Reviewer registration accepts credential/role payload from admin |
| AUTH-017 | Admin acts as another reviewer | `403` | FAIL CONFIRMED | Admin bypasses reviewer actor equality |
| AUTH-018 | Medical event on editorial assignment | `422` or `403` | FAIL CONFIRMED | Assignment review type is not compared |
| AUTH-019 | Self-review and delegated self-review | Rejected | PARTIAL | Application checks direct/delegated author equality; DB/RLS proof absent |
| AUTH-020 | Local demo in deployed environment | Startup failure | NOT IMPLEMENTED | Loopback proxy can appear local |
| AUTH-021 | Canonical actor reused on pooled DB connection | No identity bleed | NOT TESTED | Transactional adapter absent |
| AUTH-022 | Service-role credential in browser/client | Impossible; secret scan clean | NOT TESTED END-TO-END | No deployed bundle or secret scan evidence |

## Endpoint Authorization Target

| Endpoint class | Allowed actor | Required context | Answer-bearing |
| --- | --- | --- | --- |
| Dashboard summaries | Authenticated internal role | Aggregate, privacy-safe | No |
| Candidate authoring | Assigned author/content operator | Exact candidate and source-safe view | Only explicit author workflow |
| Editorial review | Assigned editorial reviewer | Accepted assignment, exact revision | Yes, purpose-audited |
| Medical review | Assigned credentialed physician | Accepted medical assignment, exact revision | Yes, purpose-audited |
| Rights/privacy decisions | Assigned owner workflow | Exact source and authority record | No answer requirement |
| Release assembly | Assigned release manager | Eligible exact revisions | Server-only answer set, purpose-audited |
| Release attestation | Assigned medical-governance lead | Validation evidence and medical chain | Server-only |
| Publication ratification | Brian authority | Ratified evidence bundle | No generic endpoint |
| STAT pre-answer | Authenticated participant through existing STAT RPC | Sealed duel | No |
| STAT post-answer | Authenticated participant | Server-finalized duel | Yes, scoped to duel |
| Generic resource API | Remove or explicit allowlist only | Per-entity DTO | Never answer-bearing |

## Required Evidence

- Canonical adapter unit and integration tests.
- Protected HQ/WordPress/Arena/Matrix regression baseline.
- Expired, revoked, logout, fixation, outage, wrong-role, direct URL, direct API, and CSRF tests.
- Role-mapping fixture approved by Root and Security.
- Browser and raw HTTP tests against preview.
- Database context isolation across pooled concurrent requests.
- No demo mode, actor headers, client role claims, or service credentials in deploy artifact.

## Exit Rule

All rows marked FAIL, BLOCKED, NOT IMPLEMENTED, or NOT TESTED must pass before staging certification. Expiry acceptance in the inspected HQ source must be reconciled through the Critical Systems gate without weakening shared auth.

============================================================
FILE: agents/lorentz_security/boundary_contracts.md
============================================================
# I1Q-1007X Lorentz and Security Boundary Contracts

Status: BASELINE AUDIT, APPLICATION REPAIRS REQUIRED

Date: 2026-07-15

Scope: I1Q-1006 and I1Q-1007X-MA, read-only analysis of commit `0d6f78f2a2036731ec592398ce5fd845beb54333`

## Authority Context

The MissionMed OS authority blockers reported by the initial audit were snapshot-time findings during root recovery. `DR-006` and MissionMed OS PR #12 now address mission registration, product ownership, datastore routing, source-read authority, composite metadata identity, explicit Drills availability, staging, rollback ownership, and the canonical GitHub route.

Those authority repairs do not repair the candidate application. The P0 and P1 application findings in this baseline remain current until code is changed and independently retested.

Authoritative records:

- `/Users/brianb/MissionMed_OS/decisions/DR-006_i1q_question_platform_internal_integration.md`
- `/Users/brianb/MissionMed_OS/PRODUCT_PASSPORTS/question-platform.md`
- `/Users/brianb/MissionMed_OS/missions.json`, mission `I1Q-1006`
- MissionMed OS PR #12: `https://github.com/brinyu13/missionmed-os/pull/12`

## Non-Negotiable Contracts

### Identity and authentication

1. WordPress and the canonical MissionMed session chain remain the identity authority.
2. I1Q may consume a verified canonical actor; it may not create a parallel identity system.
3. Role claims must be mapped server-side to I1Q roles and must not be accepted from request headers, request bodies, query strings, or caller-set database settings.
4. Cookie-authenticated mutations require the canonical CSRF control and origin policy.
5. Expired, revoked, logged-out, fixed, or unverified sessions fail closed.
6. Local synthetic-demo identity must be impossible in a deployed process, including behind a loopback reverse proxy.

### Datastore and RLS

1. The datastore is an additive `i1q` schema in the RANKLISTIQ Supabase project selected by DR-006.
2. Migrations are forward-only, timestamped, previewed first, and applied only through the canonical GitHub process.
3. RLS is forced and deny-by-default. There are no broad anonymous or authenticated authoring grants.
4. Database actor and role context must be derived from the canonical authenticated actor and set transaction-locally through a trusted adapter.
5. Review data is scoped to the exact assignment and immutable revision. Administrative access is explicit and audited.
6. Base answer-bearing tables are never directly readable by student clients or general internal read roles.

### STAT

1. The server dataset projection contains exactly, and in this order: `dataset_version`, `question_id`, `prompt`, `choice_a`, `choice_b`, `choice_c`, `choice_d`, `answer`, `explanation`.
2. The nine-field dataset row is a server-side storage/export contract. It is not the STAT duel-pack envelope.
3. The frozen duel-pack envelope remains exactly seven fields under `STAT_CANON_SPEC.md`.
4. Class A pre-answer artifacts contain no answer, explanation, `answer_map`, `is_correct`, correct-choice alias, answer-correlated ordering, or class D metadata.
5. `answer_map` remains server-only until the duel is finalized and the authenticated caller is a participant.
6. Choice order, server-authoritative scoring, sealed identifiers, historical attempts, and dataset semantics remain unchanged.

### Identity and historical joins

1. Internal identity is the immutable tuple `(item_id, itemrev_id, revision_number, content_hash)`.
2. Projected identity is at least `(dataset_version, question_id)` and is linked to the exact internal tuple.
3. Historical legacy identity is `(dataset_version, question_id, content_hash)`.
4. Projected IDs are opaque, unique within a dataset version, stable for that release, and persisted in a mapping record. Array position is not identity.
5. `question_metadata` compatibility uses composite `dataset_version` plus `question_id` semantics without silently changing protected legacy ownership.

### Drills and Daily Rounds

1. I1Q emits versioned read-only adapter artifacts. It does not mutate Drills ingestion or source registries.
2. `video_id`, title, playback availability, nodes availability, transcript availability, and VTT availability are explicit.
3. Missing, restricted, invalid, and unknown source artifacts are represented explicitly and never treated as silently available.
4. Current Drills requires a playable source and nodes; transcript absence is non-blocking only when explicitly represented.
5. Current Daily/Arena registry consumers require the complete five-field URL contract, including a non-empty transcript URL. Daily Rounds remains a separate adapter/consumer decision.
6. Timestamp remediation is released only with source lineage, rights clearance, privacy clearance, and an eligible approved Item Revision.

### Review and release

1. Every review is tied to an accepted assignment of the same review type, exact reviewer, and exact immutable revision.
2. The authenticated actor must equal the reviewer actor. Administrative impersonation is prohibited.
3. Rights, privacy, evidence, reviewer credentials, governance slots, release states, and audit events use dedicated authoritative workflows, not generic mass-assignment endpoints.
4. Release manager assembly, validation evidence, medical-governance attestation, and Brian publication ratification are separate recorded authorities.
5. Medical governance remains unassigned. Medical approval, approved release eligibility, student publication, and consumer activation remain unavailable.
6. Student, STAT consumer, and Drills consumer flags remain OFF.

### Privacy and source isolation

1. Raw transcripts and media remain restricted. Downstream extraction reads only privacy-safe working artifacts.
2. Student speech, student names, patient-identifying information, third-party identities, and identifying clinical anecdotes are covered by the privacy policy.
3. Required recall thresholds are enforced numerically, not inferred from the presence of a denominator.
4. Raw text, private object references, answer material, and restricted source wording are excluded from ordinary responses, logs, errors, caches, and generated class A/C artifacts.
5. Every internal answer-key read and restricted-source read is purpose-bound and appended to the immutable audit trail.

## Candidate Conformance Snapshot

| Boundary | Status | Evidence |
| --- | --- | --- |
| Exact nine-field STAT row | PASS | `i1q-question-platform/src/exports.mjs:14-30`; local test passes |
| Frozen STAT hash vector | PASS | `i1q-question-platform/src/hash.mjs`; local test passes |
| No live `answer_map` query | PASS, NARROW | Candidate code contains no live query; scanner coverage is incomplete |
| Generic answer read isolation | FAIL, P0 | `platform.mjs:114-185`; reproduced with `read_only` actor |
| Post-answer authorization | FAIL, P0 | `platform.mjs:360-377`; caller controls phase label |
| Review and publication authority | FAIL, P0 | `platform.mjs:146-173,240-281,333-357`; reproduced |
| Trusted RLS identity | FAIL, P1 | Migration trusts caller-set `app.actor_id` and `app.actor_roles` |
| Assignment-scoped RLS | FAIL, P1 | Broad actor-present SELECT policy on nearly every table |
| Canonical auth and CSRF | FAIL, P1 | Resolver interface only; mutations have no CSRF gate |
| Privacy threshold enforcement | FAIL, P1 | Zero recall can report aggregate `pass`; reproduced |
| Migration protocol | FAIL, P1 | Candidate filename/header/idempotency do not satisfy MR-078A |
| Rollback and reapply proof | FAIL, P1 | Static flag SQL only; no staging execution or application coupling |
| Composite projected identity | PARTIAL, P1 | Metadata carries version, but lookup and fallback IDs are unsafe |
| Drills source contract | FAIL, P1 | Candidate artifact omits required source and availability fields |
| Canonical authority and route | RESOLVED BY ROOT | DR-006 and PR #12; application gates still apply |

## Baseline Verdict

The boundary design is authorized, but the candidate implementation is not release-safe. Security vetoes migration application, staging deployment, internal production exposure, and consumer activation until every P0 is repaired and all P1 controls have executable preview evidence.

============================================================
FILE: agents/lorentz_security/drills_projection_verification.md
============================================================
# I1Q-1007X Drills Projection Verification

Verdict: BLOCKED, ADAPTER CONTRACT NOT IMPLEMENTED

Date: 2026-07-15

## Authority Context

DR-006 resolves the earlier policy question: I1Q may emit read-only Drills adapter artifacts, must represent transcript, VTT, and nodes availability explicitly, and must not mutate Drills ingestion. The original authority uncertainty was a root-recovery snapshot finding addressed by DR-006 and MissionMed OS PR #12.

## Current Consumer Contracts

| Consumer | Required today | Transcript behavior | Evidence |
| --- | --- | --- | --- |
| Daily Rounds | `video_id`, `title`, `playback_url`, `nodes_url`, `transcript_url` | Non-empty HTTPS or local URL required | `LIVE/daily.html:2511-2543` |
| Arena drill registry | Same five fields | Non-empty HTTPS URL required | `LIVE/arena.html:10560-10622` |
| Drills player | `video_id`, playback URL or stream ID, and `nodes_url` | Missing transcript is non-blocking; invalid supplied URL warns | `LIVE/drills.html:6638-6682`, `9535-9565` |

Daily/Arena and the Drills player therefore do not share one transcript requirement. A single ambiguous nullable URL cannot safely represent both contracts.

## Candidate Artifact

The candidate emits only:

- `item_revision_id`
- `prompt`
- `concept_id`
- `source_ids`
- `review_status`

Evidence: `i1q-question-platform/src/exports.mjs:120-126`.

It omits every runtime delivery field and all explicit source-availability, timestamp, rights, privacy, and source-hash state. It cannot be consumed by current Drills, Daily, or Arena.

## Proposed Versioned Drills Adapter

A proposed `i1q.drills.adapter.v1` record should include:

| Field | Purpose |
| --- | --- |
| `contract_version` | Pins adapter semantics |
| `release_id` | Immutable release source |
| `item_revision_id` | Exact internal question revision |
| `video_id` | Canonical source video identity |
| `title` | Consumer display title |
| `playback` | `{availability, url, stream_id}` |
| `nodes` | `{availability, url, source_hash}` |
| `transcript` | `{availability, url, source_hash}` |
| `vtt` | `{availability, url, source_hash}` |
| `remediation` | `{start_seconds, end_seconds}` |
| `rights_status` | Must permit intended internal use |
| `privacy_status` | Must pass the working-artifact gate |
| `source_record_id` | Internal lineage; never student-visible |

Proposed availability values are `available`, `missing`, `restricted`, `invalid`, and `unknown`. An `available` value requires a validated location and matching source hash. A null URL without a status is invalid.

## Consumer-Specific Projection Rules

### Drills

- Playback must be available through URL or stream ID.
- Nodes must be available and parse to a non-empty supported payload.
- Transcript and VTT may be explicitly unavailable without blocking the player.
- Timestamp remediation must be suppressed when the referenced source is unavailable, restricted, or hash-mismatched.

### Daily/Arena

- Do not route the proposed adapter directly into current registry functions.
- Their existing five-field URL contract rejects missing transcript URLs.
- Any relaxation requires a separately approved, backwards-compatible consumer adapter and protected regression suite.

## Rights and Privacy Gates

No adapter row is eligible when:

- Rights are unverified, restricted for the intended use, or expired.
- Privacy is blocked or the source lacks a passing redaction record.
- The source is raw rather than a privacy-safe working artifact.
- Dr. J identity is only likely but the UI would present it as verified.
- A timestamp or URL points outside the approved source lineage.

## Required Tests

- Drills success with playback and nodes available and transcript explicitly missing.
- Drills rejection for missing, invalid, empty, or hash-mismatched nodes.
- Daily/Arena rejection for absent transcript under the current contract.
- Flat nodes arrays and supported `drill_nodes`, `drillNodes`, and `nodes` wrappers.
- Supported transcript segment/chunk wrappers and aliases.
- Invalid URL schemes, cross-boundary URLs, and open redirects.
- Restricted rights, failed privacy, raw source, and stale hash rejection.
- Read-only proof against every source system.
- Drills ingestion state unchanged before and after the adapter test.
- Drills and student consumer flags remain OFF.

## Final Assessment

The Drills artifact is a placeholder internal question list, not a compatibility adapter. No Drills or Daily staging claim is supportable until the versioned availability contract and its protected consumer tests exist.

============================================================
FILE: agents/lorentz_security/hash_and_identity_report.md
============================================================
# I1Q-1007X Hash and Identity Report

Verdict: HASH PRIMITIVES PASS LOCALLY, IDENTITY MODEL INCOMPLETE

Date: 2026-07-15

## Authority Context

DR-006 and MissionMed OS PR #12 address the root-recovery authority questions by fixing the RANKLISTIQ datastore, composite metadata semantics, legacy-v4 read authority, and sealed-pack preservation. The candidate's P1 identity and release-membership defects remain current.

## Distinct Hash Domains

### Item Revision hash

An Item Revision hash identifies immutable semantic content. The candidate canonical JSON implementation normalizes strings to NFC, recursively sorts object keys, preserves array order, encodes UTF-8, and emits lowercase SHA-256 hex.

This hash must include every content field whose change creates a new revision and must exclude mutable workflow metadata. The final preimage needs one versioned schema contract before database integration.

### STAT pack hash

The pack hash is not the Item Revision hash. It uses the frozen STAT preimage:

`dataset_version=<ds>|question_ids=<qids>|choices_order=<groups>`

The candidate reproduces the fixed vector `9253830103fdf96a341797f34f42fa98427be4089e4fa1483402141b6386575f`.

### Artifact and manifest hashes

Each channel artifact is hashed from canonical JSON. A release manifest hashes the ordered artifact inventory and previous-manifest reference. The manifest must additionally bind exact release-membership tuples so an artifact cannot be detached from its Item Revisions.

### Source and working hashes

Raw source hashes identify restricted source bytes. Working hashes identify privacy-safe derived text. They are not interchangeable. Every derivation must retain both lineage references without copying raw content into working rows.

## Identity Domains

| Domain | Canonical identity |
| --- | --- |
| Semantic item | `item_id` |
| Immutable content | `(item_id,itemrev_id,revision_number,content_hash)` |
| Projected question | `(dataset_version,question_id)` |
| Historical source row | `(dataset_version,question_id,content_hash)` |
| Release membership | `(release_id,item_id,itemrev_id,revision_number,content_hash,projected_question_id)` |
| Duel pack | `duel_id` plus sealed seven-field envelope |
| Source artifact | source authority, canonical source ID, and source hash |

No domain may substitute array position, display title, mutable status, or a bare cross-version `question_id` for canonical identity.

## Candidate Passes

- Canonical JSON is deterministic for tested Unicode and key-order variants.
- STAT fixed vector passes byte-for-byte.
- Nine-field output order is frozen in code and test.
- Release artifacts derive from one in-memory release operation.

## Candidate Defects

### Ordinal projected IDs

`buildReleaseArtifacts` falls back to `I1Q-000001`, `I1Q-000002`, and so on based on sorted array position. This is unstable under insertion, deletion, and some replacement operations.

### Duplicate overwrite

`Object.fromEntries` builds lookup data by bare `question_id`. Duplicate IDs overwrite silently rather than fail.

### Incomplete release pin

Release snapshots store item-revision IDs but not complete architecture tuples or persistent projected mappings.

### Unbounded dataset-version semantics

Release assembly accepts arbitrary dataset-version strings and has no authoritative registry compatibility check.

### Application-to-SQL hash mismatch risk

The in-memory repository hashes arbitrary payload objects, while SQL requires separately named hash columns. No database adapter proves that both sides hash the same preimage or preserve the same identity.

## Canonical Documentation Note

The Data Flow Contract says clients never recompute `content_hash`, while the frozen STAT canon requires client parity recomputation of the pack hash. For I1Q, Architecture 1002.1 and DR-006 preserve the frozen sealed-pack behavior. This is now a documentation-reconciliation item, not permission to change the pack or client behavior.

## Required Proof

- Published preimage schema for each hash domain.
- Cross-language vectors for JavaScript and Postgres.
- Duplicate, normalization, delimiter, null, array-order, and Unicode adversarial cases.
- Persistent projected mapping independent of input order.
- Composite metadata and old-attempt joins across versions.
- Exact release membership and artifact-manifest binding.
- Rollback and re-promotion preserve all hashes and identities.
- Reapply produces the same schema, mappings, and vectors.

## Final Assessment

The local hash primitives are suitable foundations. Identity generation, database translation, release pinning, duplicate rejection, and historical-join proof must be repaired before migration or adapter certification.

============================================================
FILE: agents/lorentz_security/legacy_v4_mapping_report.md
============================================================
# I1Q-1007X Legacy v4 Mapping Report

Status: AUTHORIZED DESIGN, STATIC EXPORT NOT INSPECTED IN THIS AUDIT

Date: 2026-07-15

## Authority Context

DR-006 authorizes a read-only hashed static export of canonical legacy v4 questions and necessary non-student aggregate exposure metadata. It also resolves `question_metadata` compatibility in favor of composite `dataset_version` plus `question_id` semantics. These were snapshot-time authority blockers during root recovery and are now addressed by DR-006 and MissionMed OS PR #12.

No v4 export rows or production student attempts were read for this baseline. No count, quality, medical accuracy, duplicate rate, or migration-completeness claim is made here.

## Immutable Source Identity

Every imported source row must retain:

`(dataset_version, question_id, content_hash)`

For v4, `dataset_version` remains `v4`. The canonical source row is never edited, renumbered, corrected in place, or republished under a changed meaning.

## Required Internal Mapping

A versioned import map should record at least:

| Field | Requirement |
| --- | --- |
| `import_type` | Fixed legacy-v4 identifier |
| `source_dataset_version` | `v4` |
| `source_question_id` | Original question identity |
| `source_content_hash` | Hash of the authorized static row under the approved v4 hashing rule |
| `item_id` | New stable semantic item identity |
| `itemrev_id` | Immutable imported revision identity |
| `revision_number` | Starts at 1 for the exact import |
| `item_content_hash` | Canonical I1Q revision hash |
| `legacy_import` | `true` |
| `lineage_status` | Complete, partial, or incomplete; never fabricated |
| `disposition` | Quarantined, retro-review, replacement candidate, retired, or rejected |
| `created_at` | Immutable import timestamp |

The import map itself is immutable. A correction creates a new Item Revision or replacement relationship.

## `question_metadata` Compatibility

The current legacy table was reported to key only on `question_id`, which can collide across dataset versions. I1Q must not silently rewrite that protected table.

The approved compatibility boundary is:

- I1Q projection identity: `(dataset_version, question_id)`.
- I1Q historical identity: `(dataset_version, question_id, content_hash)`.
- A versioned adapter or sidecar mapping translates for each consumer.
- Any legacy consumer that can accept only `question_id` must receive an explicit collision analysis and migration decision before cutover.

## Old Attempt Compatibility

A successful mapping must prove that an old attempt continues to resolve to the exact question content that existed when the attempt was recorded. The join must not select a newer revision merely because it shares an item or question ID.

Required staging cases:

- Same `question_id` in two dataset versions resolves to two distinct records.
- Same source identity and hash is idempotent.
- Same source identity with a different hash is a blocking conflict, not an overwrite.
- Replacement and retirement preserve old attempt display.
- Corrective release does not mutate the original attempt's content join.
- Missing or ambiguous mapping fails closed and emits an internal incident finding.

## Release Eligibility

Import does not create medical truth or approval. Every legacy revision remains ineligible for a new release until it has:

- Current Evidence Claims.
- Editorial review.
- Exact credentialed physician review.
- No unresolved conflict or safety flag.
- Rights and privacy clearance.
- Complete release validation.

Medical governance is unassigned, so approved release eligibility remains blocked.

## Candidate Gaps

- The candidate does not execute an authorized v4 import.
- `buildReleaseArtifacts` can synthesize ordinal projected IDs rather than use a persistent mapping.
- The lookup object keys only on `question_id` and can overwrite duplicates.
- Release snapshots do not pin complete internal identity tuples.
- Historical attempt joins have not run against preview or staging.

## Verdict

The mapping design is now authorized, but legacy-v4 reconciliation remains unexecuted and unverified. No legacy content may enter an I1Q release based on the current candidate alone.

============================================================
FILE: agents/lorentz_security/rls_test_matrix.md
============================================================
# I1Q-1007X RLS Test Matrix

Status: DESIGN BASELINE; NO POSTGRES EXECUTION PERFORMED

Verdict: BLOCK

## Authority Context

DR-006 now selects the additive RANKLISTIQ `i1q` schema and requires forced RLS, deny-by-default access, transaction-local canonical actor context, assignment-scoped reviews, immutable audit, and no broad grants. The earlier routing blocker was a snapshot-time root-recovery finding addressed by DR-006 and MissionMed OS PR #12. Candidate RLS remains unsafe and untested.

## Candidate Findings

- `i1q.session_actor_id()` trusts `current_setting('app.actor_id')`.
- `i1q.session_has_role()` trusts comma-separated `current_setting('app.actor_roles')`.
- Nearly every table permits SELECT when actor ID is merely non-null.
- Only `source_records` and `transcript_artifacts` receive a narrower read policy; normalized working text, answer-bearing revisions, review data, and channel artifacts remain broad.
- Insert and update policy generation treats all tables alike and recognizes only asserted admin/system roles.
- No assignment, reviewer, author, release, source, or purpose predicate exists.
- No client grants are made, which prevents present direct exposure but also means operational behavior is unproved.
- No database repository maps application records to SQL or proves transaction-local context.

## Identity Attack Cases

| ID | Actor/context | Operation | Expected | Candidate assessment |
| --- | --- | --- | --- | --- |
| RLS-001 | Anonymous, no context | SELECT any `i1q` table | Zero rows or permission denied | Likely deny; not executed |
| RLS-002 | Authenticated actor, no I1Q role | SELECT internal table | Zero rows or denied | Candidate actor-present policy would allow if actor setting exists |
| RLS-003 | Caller sets `app.actor_id` | SELECT answer revision | Denied | Candidate policy would allow if caller can set context |
| RLS-004 | Caller sets `app.actor_roles=platform_admin` | INSERT/update protected record | Denied | Candidate policy trusts asserted role |
| RLS-005 | Context omitted after pooled prior request | SELECT prior actor data | Denied; no identity bleed | Adapter absent, not tested |
| RLS-006 | Forged reviewer ID with valid actor | INSERT review event | Denied | No row-scoped policy proof |
| RLS-007 | Platform service role accidentally used by client | Any base-table operation | Impossible by architecture | Deployment/bundle proof absent |
| RLS-008 | Table owner under FORCE RLS | SELECT/UPDATE | Policy applies unless authorized bypass role | Not executed |
| RLS-009 | `BYPASSRLS` connection | Application request | Connection prohibited | Connection role design absent |

## Table Access Matrix

Legend: `D` deny, `S` scoped, `A` explicit administrative workflow, `I` internal service only.

| Table class | Anonymous | Read-only | Author | Assigned editor | Assigned physician | Privacy owner | Release manager | System |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Taxonomy/blueprint published view | D | S read | S read | S read | S read | S read | S read | I/A |
| Draft concepts/items | D | D | S own/assigned | S assigned | S assigned | D | S release | I/A |
| Answer-free revision view | D | S approved internal subset | S own/assigned | S assigned | S assigned | D | S release | I |
| Answer-bearing revision store | D | D | S purpose endpoint | S purpose endpoint | S purpose endpoint | D | S purpose endpoint | I |
| Review assignments | D | D | S own where needed | S reviewer | S reviewer | D | S queue admin | I/A |
| Review events | D | D | S authored history | S assigned insert/read | S assigned insert/read | D | S release read | I/A |
| Rights/privacy records | D | D | S read status only | S read status only | S read status only | A | S release read | I/A |
| Raw source refs/transcripts | D | D | D | D | D except explicit purpose | A restricted | D | I restricted |
| Working transcript segments | D | D | S assigned source | S assigned source | S assigned source | A | D | I |
| Releases/manifests | D | S non-answer metadata | S read | S read | S read | S read | A | I/A |
| Channel class A artifacts | D except approved consumer RPC | S internal where approved | S | S | S | S | A | I |
| Channel class B artifacts | D | D | D except purpose | D except purpose | D except purpose | D | A purpose-audited | I |
| Audit events | D | D | S own limited view if needed | S own limited view | S own limited view | S owned domain | S release domain | I/A append-only |
| Feature flags | D | S read allowed state | S read | S read | S read | S read | A per authority | I/A |

## Required Preview SQL Tests

1. Confirm every table has RLS enabled and forced.
2. Confirm no policy uses unconditional `true` for authenticated access.
3. Confirm anonymous and ordinary authenticated roles have no base-table grants beyond approved views/RPCs.
4. Attempt to forge actor and role context from every application database role.
5. Test every matrix cell with two actors, two assignments, two revisions, and two releases.
6. Prove an assigned reviewer cannot read or write another reviewer's assignment.
7. Prove an administrator cannot impersonate a reviewer through review-event insertion.
8. Prove answer-bearing tables and artifacts cannot be selected by read-only, author without purpose, or student paths.
9. Prove raw source references and transcript objects remain restricted.
10. Prove transaction rollback and pooled-connection reuse clear actor context.
11. Prove immutable tables reject update and delete through every role, including owner where expected.
12. Prove audit events cannot be updated, deleted, inserted with a broken predecessor, or reordered.
13. Run EXPLAIN and index checks for assignment queues, release joins, and composite projected identity.
14. Execute compensating rollback, verify policies and flags, then reapply and rerun all cases.

## Evidence Requirements

- Exact project ref and preview database identity recorded by Root without exposing credentials.
- Migration list/diff/lint before and after.
- Machine-readable pass/fail results for every test ID.
- SQLSTATE and row-count assertions, not screenshots alone.
- No service-role token or environment value in test artifacts.
- Independent rerun against the fixed commit.

## Exit Rule

Static claims such as `FORCE ROW LEVEL SECURITY` are insufficient. Staging remains blocked until the trusted context design exists and every RLS attack case passes on the authorized preview database.

============================================================
FILE: agents/lorentz_security/schema_and_adapter_changes.md
============================================================
# I1Q-1007X Proposed Schema and Adapter Changes

Status: PROPOSAL ONLY, NOT IMPLEMENTED

This document translates the baseline findings into bounded change requirements. It does not authorize editing shared systems, applying SQL, deploying, or changing flags.

## Authority Update

MissionMed OS registration and routing concerns in the initial audit were snapshot-time findings during root recovery. DR-006 and MissionMed OS PR #12 now establish the dedicated authenticated app, RANKLISTIQ `i1q` datastore, composite metadata identity, explicit Drills availability, and GitHub-only staging route. The application defects below remain current.

## Candidate Migration Disposition

`i1q-question-platform/db/migrations/0001_i1q_question_platform.sql` must remain an offline candidate and must not be copied or applied as-is.

A deployable migration must be newly generated in the Root-approved canonical migration tree and must satisfy all of the following:

- 14-digit UTC timestamp and MR-078A filename.
- Required authority, dependency, description, and idempotency header.
- `BEGIN` and `COMMIT` transaction wrapper.
- Explicit extension dependencies or no extension dependency.
- Repeat-safe creation or an explicit non-idempotent declaration.
- Preview migration list, diff, lint, schema verification, RLS attack suite, rollback, and reapply evidence.
- No migration history repair, manual production SQL, destructive mutation of frozen STAT data, or broad grants.

## Required Schema Changes

### Trusted actor context

Replace unrestricted trust in `current_setting('app.actor_id')` and comma-separated caller roles with a trusted database adapter contract:

- Authenticate the canonical MissionMed session server-side.
- Resolve actor and I1Q roles from authoritative server data.
- Begin a transaction and set actor context locally for that transaction only.
- Prevent application callers from selecting arbitrary actors or roles.
- Clear context automatically on commit, rollback, timeout, and pooled-connection reuse.
- Verify forged context, missing context, stale context, and service-role misuse in preview.

### Answer-bearing storage

Structurally separate answer-bearing fields from ordinary internal reads. Acceptable implementations may use a separately protected answer table or a deny-by-default answer-safe view/RPC boundary, provided that:

- General resource list/get never returns `answer`, `explanation`, rationales, `answer_map`, or correctness flags.
- Authors and assigned reviewers receive answer fields only through explicit purpose-scoped endpoints.
- Every answer-bearing read records actor, purpose, exact revision, release or duel context, and timestamp.
- Student clients cannot receive base-table grants.
- Duel result access proves server-side finalization and participant membership.

### Review integrity

Add database and service invariants for:

- `review_event.review_type = review_assignment.review_type`.
- Event reviewer equals assignment reviewer.
- Authenticated actor equals reviewer actor; no administrator impersonation path.
- Assignment state is accepted at event creation and becomes completed atomically with the event.
- Exact revision hash is current and immutable.
- Required role, credential state, specialty exception, calibration, and self-review restrictions are checked from authoritative records.
- Rights, privacy, evidence, credentials, and governance cannot be written through generic entity endpoints.

### Release integrity

Introduce immutable release membership rows that pin:

`(release_id, item_id, itemrev_id, revision_number, content_hash, dataset_version, projected_question_id)`

Promotion records must include authority type, actor, evidence hashes, prior state, next state, sequence, and manifest hash. Required independent steps are:

1. Assembly by release manager.
2. Validation with complete validator and leak-test evidence.
3. Medical attestation by the assigned credentialed medical-governance lead.
4. Brian ratification for student-facing publication.

Medical attestation and publication remain unavailable while medical governance is unassigned.

### Composite projection identity

Create a versioned mapping owned by I1Q rather than silently changing the protected legacy `question_metadata` primary key. The mapping must enforce:

- Unique `(dataset_version, projected_question_id)`.
- Unique release membership for each exact Item Revision.
- Preserved `(dataset_version, question_id, content_hash)` historical joins.
- Persistent opaque projected IDs, never ordinal fallbacks.
- Explicit supersession and replacement lineage without rewriting old mappings.

### Privacy and source records

- Raw content is represented only by restricted object references and hashes.
- Working transcript rows contain only privacy-safe text.
- DRJ transcript sources require a passing redaction record and rights record before downstream extraction.
- Privacy metrics include student speech, student names, patient identifiers, third parties, and identifying clinical anecdotes.
- Threshold checks enforce patient recall `>= 0.995` and student-name recall `>= 0.99` where the benchmark gate applies.
- Missing benchmark classes and zero recall fail closed.

### Audit integrity

The audit chain must be append-only and continuous across application events, rollback events, and release promotions. A compensating migration must not create an event with an arbitrary null predecessor. Audit writes require a single authoritative chain operation with concurrency protection and verification.

## Required Adapter Changes

### STAT adapter v1

The versioned adapter must:

- Emit the exact nine-field server row in frozen order.
- Reject unknown dataset versions, duplicate projected IDs, missing mappings, extra fields, and non-four-choice revisions.
- Persist the exact mapping to the release membership tuple.
- Generate class A pre-answer, class C post-answer, server-only dataset, indexes, lookup, and composite metadata from one immutable release snapshot.
- Gate post-answer reads with server state and actor participation, not a caller phase string.
- Use a closed-world leak validator that detects field names, nested aliases, answer values, deterministic order correlations, and class D metadata.

### Drills adapter v1

The versioned adapter must emit explicit availability for playback, nodes, transcript, and VTT, plus source lineage, remediation timestamps, rights state, and privacy state. It must not write to Drills, Daily, media, Stream, R2, CDN, transcript, VTT, or nodes registries.

Current consumer rules must remain distinct:

- Drills: playable source and nodes required; transcript may be explicitly unavailable.
- Daily/Arena registry: the current five URL fields, including transcript URL, are required until a separately approved consumer adapter changes that contract.

## Application-to-SQL Translation Gaps

The current in-memory service and candidate SQL do not share an executable record contract. Examples include `choices[]` versus SQL choice columns, `source_ids` versus `source_record_ids`, nested manifest hashes versus required top-level SQL columns, and synthetic records that omit SQL-required ownership/version fields.

A database repository must therefore define explicit typed translations and transactions. It must not spread arbitrary object keys into SQL columns or rely on the in-memory repository as proof of datastore behavior.

## Rollback and Reapply

Rollback is a forward compensating operation:

- Disable internal and consumer flags through the authoritative flag store.
- Deploy the last known-good app through GitHub.
- Re-promote the prior good immutable release where content rollback is required.
- Preserve audit, source hashes, revisions, releases, and migration history.
- Verify application behavior after rollback.
- Reapply the candidate migration and app artifact in preview and rerun the complete suite.

The existing `db/rollback/0001_compensating_disable.sql` is design material only and is not rollback proof.

============================================================
FILE: agents/lorentz_security/security_release_verdict.md
============================================================
# I1Q-1007X Lorentz and Security Release Verdict

## Verdict

`SECURITY VETO: NO-GO FOR MIGRATION, STAGING, INTERNAL PRODUCTION, OR CONSUMER ACTIVATION`

Date: 2026-07-15

Candidate commit audited: `0d6f78f2a2036731ec592398ce5fd845beb54333`

## Authority Status

The MissionMed OS authority blockers in the initial audit were snapshot-time findings during root recovery. DR-006 and MissionMed OS PR #12 now address mission registration, product ownership, protected integration authority, RANKLISTIQ routing, read-only source access, composite identity, explicit Drills availability, staging, rollback ownership, and the canonical GitHub route.

That recovery changes the authority verdict from unresolved to authorized-with-gates. It does not change the application verdict. All confirmed P0/P1 findings remain current until repaired and independently retested.

## Passing Baseline Evidence

- Exact frozen nine-field STAT projection passes locally.
- Frozen STAT pack hash vector passes locally.
- Candidate code contains no live `answer_map` query.
- Existing local suite passes 30 of 30 tests.
- Candidate SQL defaults all feature flags off and makes no client grants.
- No migration, deployment, source mutation, student-data access, or flag change occurred in this audit.

## P0 Release Blockers

1. `read_only` can retrieve answer-bearing Item Revisions.
2. Caller-controlled phase text unlocks post-answer debrief without finalization or participant proof.
3. Leak validation misses `answer_map` and `is_correct` and is not closed-world.
4. Generic writes permit rights/privacy/evidence/source eligibility forgery.
5. Admin can fabricate/impersonate a physician reviewer and approve on the wrong assignment type.
6. One admin can self-assign governance and publish without independent validation, medical attestation, or Brian ratification evidence.

## P1 Release Blockers

1. RLS identity and roles are caller-asserted; policies are broad and not assignment-scoped.
2. Canonical auth, role mapping, CSRF, expiry, revocation, logout, fixation, outage, and connection-pool isolation are unproved.
3. Privacy aggregate can pass at zero recall, required privacy classes are incomplete, and raw text survives downstream normalization.
4. Candidate migration violates MR-078A promotion requirements and has never run in Postgres.
5. Application records are not proven compatible with SQL and no transactional database repository exists.
6. Rollback is not coupled to the running app or release re-promotion, can break audit continuity, and has no reapply proof.
7. Projected IDs can shift or collide, release membership omits exact tuples, and old-attempt joins are unproved.
8. Drills artifact is not compatible with current Drills/Daily consumers and lacks explicit source availability and gates.
9. Full dependency, secret, injection, rate, log, error, and deployed-artifact attacks remain incomplete.

## Permitted Next Work

- Root may assign bounded implementation repairs listed in `security_repairs.md`.
- Agents may add synthetic regression tests and prepare a new canonical migration for Root review.
- Authorized read-only source inventory and privacy-safe candidate engineering may continue within DR-006, provided no raw source crosses the restricted boundary.
- Consumer and student flags remain OFF.

## Prohibited Until Re-Certification

- Applying any candidate migration.
- Deploying preview, staging, canary, or internal production application code.
- Exposing the current API to an authenticated audience.
- Enabling internal review, student content, STAT consumer, or Drills consumer flags.
- Claiming RLS, rollback, old-attempt, sealed-pack, Drills, privacy, or canonical-auth proof.

## Re-Certification Gate

A fixed commit must contain all P0 repairs, all P1 implementations, new negative tests, canonical auth integration, preview migration and RLS evidence, rollback/reapply proof, composite historical joins, STAT sealed-pack regression, Drills/Daily contract evidence, privacy thresholds, dependency/security scans, and dependent-product smokes. A fresh independent red team must verify that exact commit.

## Handoff to Root Supervisor

Preserve the exact STAT projection and hash primitive. Treat the current delivery, authorization, datastore, source, and release layers as unsafe. Assign the repair register without overlapping ownership, keep every flag off, and do not enter staging until this veto is replaced by a fresh written approval against one fixed commit.

============================================================
FILE: agents/lorentz_security/security_repairs.md
============================================================
# I1Q-1007X Security Repair Register

Status: OPEN PROPOSALS, NO FIXES IMPLEMENTED

Date: 2026-07-15

## Authority Context

DR-006 and MissionMed OS PR #12 address the snapshot-time MissionMed OS authority blockers encountered during root recovery. They do not accept or repair any finding below. Student, STAT, and Drills flags remain OFF.

## Repair Queue

| ID | Severity | Required change | Proposed implementation owner | Acceptance evidence |
| --- | --- | --- | --- | --- |
| SEC-001 | P0 | Remove generic answer-bearing Item Revision reads; introduce answer-free DTO/view and purpose-scoped answer endpoints | Internal App + Security | Read-only/IDOR negatives, answer-read audit |
| SEC-002 | P0 | Remove caller phase authorization; verify finalization and participant server-side | Adapter + Security | Active/pending/void/nonparticipant failures; finalized participant pass |
| SEC-003 | P0 | Replace generic writes for rights, privacy, evidence, source, and governance with dedicated schema-validated owner workflows | Internal App + Architecture/Data | Mass-assignment suite and immutable authority records |
| SEC-004 | P0 | Bind review actor, reviewer, assignment type, role, credential, state, and exact hash atomically | Internal App + Security | Impersonation/type/self-review/stale-hash negatives |
| SEC-005 | P0 | Enforce independent release authority chain and evidence; make Brian ratification explicit | Internal App + Architecture/Data | Single-actor publish fails; missing evidence fails; governance-unassigned fails |
| SEC-006 | P1 | Replace caller-set GUC trust with canonical transaction-local context and assignment-scoped forced RLS | Architecture/Data + Security | Full preview RLS matrix, pool-isolation and forged-context attacks |
| SEC-007 | P1 | Implement canonical auth adapter, role mapping, CSRF/origin, expiry, revocation, logout, fixation, and outage behavior | Auth/Security under Root protected gate | Auth matrix and dependent auth regressions |
| SEC-008 | P1 | Remove raw text from downstream objects; add full privacy classes and numeric threshold enforcement | Privacy/Rights + Internal App | Zero-recall failure, raw/log/error leak tests, benchmark thresholds |
| SEC-009 | P1 | Persist opaque composite projected mappings and exact release membership; reject duplicates | Adapter + Architecture/Data | Reorder stability, duplicate rejection, historical join suite |
| SEC-010 | P1 | Replace rollback script with authoritative flag coupling, prior-release re-promotion, continuous audit, and reapply proof | Release/Reliability + Architecture/Data | Preview rollback/reapply and audit-chain verification |
| SEC-011 | P1 | Generate a new MR-078A canonical migration and transactional database repository; align application/SQL types | Architecture/Data | Migration list/diff/lint, schema contract, SQL integration tests |
| SEC-012 | P0 | Implement closed-world channel validator with aliases, values, correlation, class D, logs/errors/caches | Adapter + Security | LT-1 through LT-6 plus adversarial vectors |
| SEC-013 | P1 | Make demo mode a build/startup-time prohibited condition in any deploy artifact and remove proxy trust ambiguity | Internal App + Release/Reliability | Deployed manifest scan and proxy tests |
| SEC-014 | P1 | Implement versioned Drills adapter with explicit playback/nodes/transcript/VTT availability, lineage, rights, privacy, and hashes | Adapter + Privacy/Rights | Drills/Daily contract suite and read-only proof |
| SEC-015 | P1 | Complete dependency, secret, injection, XSS, SSRF, rate-limit, log, error, and deployed-artifact attack suites | Security + Release/Reliability | Machine-readable clean reports against fixed commit |

## Repair Constraints

- Do not change the exact nine-field STAT projection.
- Do not change the seven-field sealed-pack contract, choice ordering, scoring, or historical attempts.
- Do not modify Drills ingestion ownership.
- Do not mutate frozen v4 rows or migration history.
- Do not weaken shared HQ, WordPress, Railway, Arena, Matrix, or Supabase auth.
- Do not use manual production SQL, `railway up`, force push, ad hoc uploads, or direct runtime replacement.
- Do not assign or infer a medical-governance lead or physician credential.
- Do not expose raw source text or secrets in test evidence.
- Do not enable internal, student, STAT, or Drills flags during repair development.

## Recommended Order

1. SEC-001, SEC-002, SEC-003, SEC-004, SEC-005, and SEC-012.
2. SEC-007 and protected auth regression.
3. SEC-006, SEC-009, and SEC-011 in an authorized preview migration.
4. SEC-008 and privacy/source benchmark gates.
5. SEC-014 adapter implementation with consumer flags off.
6. SEC-010 rollback and reapply.
7. SEC-013 and SEC-015 deploy-artifact and full attack convergence.
8. Fresh independent red-team review of one fixed commit.

## Completion Rule

A repair is complete only when its code, direct regression, negative attacks, dependent-product tests, and machine-readable evidence are present on the same fixed commit. Passing the original 30 tests is necessary but not sufficient.

============================================================
FILE: agents/lorentz_security/stat_projection_verification.md
============================================================
# I1Q-1007X STAT Projection Verification

Verdict: PROJECTION PASS, DELIVERY BLOCKED

Date: 2026-07-15

## Authority Context

DR-006 now ratifies the RANKLISTIQ target, exact nine-field projection, composite metadata semantics, sealed-pack preservation, server-only `answer_map`, and GitHub-only staging. The earlier authority blockers were snapshot-time findings during root recovery and are addressed by DR-006 and MissionMed OS PR #12. The delivery defects below remain current.

## Exact Nine-Field Projection

`projectStatDatasetQuestion` emits exactly this ordered key list:

1. `dataset_version`
2. `question_id`
3. `prompt`
4. `choice_a`
5. `choice_b`
6. `choice_c`
7. `choice_d`
8. `answer`
9. `explanation`

Evidence:

- `i1q-question-platform/src/contracts.mjs:122-132`
- `i1q-question-platform/src/exports.mjs:14-30`
- `i1q-question-platform/tests/platform.test.mjs:125-130`
- Local `npm test`: 30 tests passed, including exact field order.

No tenth field is permitted. Metadata, quality tier, lineage, internal IDs, and hashes belong in separately governed server-side channels.

## Seven-Field Pack Is Separate

The frozen STAT duel-pack response remains exactly:

1. `duel_id`
2. `dataset_version`
3. `question_ids`
4. `choices_order`
5. `content_hash`
6. `sealed_at`
7. `finalized_at`

The nine-field `dataset_questions` projection is server storage/export. It must never be sent as the pre-answer pack.

## Hash Compatibility

The candidate reproduces the frozen pack vector:

- Preimage: `dataset_version=v4|question_ids=Q1,Q2,Q3|choices_order=A,B,C,D;A,B,C,D;A,B,C,D`
- SHA-256: `9253830103fdf96a341797f34f42fa98427be4089e4fa1483402141b6386575f`

This is a local compatibility pass. It is not evidence that a staging RPC, sealed duel, old attempt, or client has consumed an I1Q release.

## Current Delivery Defects

### P0: direct revision answers

Generic resource reads expose `item_revisions` to every read role. `#sanitizeResource` does not remove `answer`, `explanation`, correct-answer rationale, or distractor rationale. A targeted probe confirmed that a `read_only` actor receives answer-bearing fields.

### P0: caller-controlled reveal

`artifactForPhase` accepts the caller's string `post_answer_finalized` as authorization for the debrief. It does not load a duel, prove server finalization, or prove participant membership.

### P0: incomplete leak scanner

`scanForAnswerLeak` does not detect `answer_map` or `is_correct`, despite the architecture's explicit LT-2 aliases. It also lacks closed-world field-policy validation and answer-value correlation testing.

### P1: projected ID instability

When `export_question_id` is absent, the candidate derives IDs from sorted array position. Adding or removing an earlier revision can change later IDs. The mapping is not persisted and duplicate IDs are not rejected before `Object.fromEntries` overwrites a lookup entry.

### P1: dataset semantics are not validated

`assembleRelease` accepts arbitrary dataset-version text. There is no registry check, current-version rule, release collision proof, or staging compatibility test.

### P1: release membership is incomplete

The release snapshot stores item-revision IDs, but does not persist the architecture-required tuple `(item_id,itemrev_id,revision_number,content_hash)` beside the projected ID.

## Required Acceptance Tests

- Exact nine fields and order, including extra-field rejection.
- Exact seven-field pack and fixed hash vector.
- Duplicate `(dataset_version, question_id)` rejection.
- Stable persistent projected mapping across reordered release input.
- Old-attempt joins across v4 and a new version.
- Class A closed-world scan for names, nested aliases, values, ordering, logs, and errors.
- Finalized participant debrief success.
- Active duel, pending duel, void duel, nonparticipant, expired session, and direct-table read failures.
- Server-authoritative scoring unchanged.
- Consumer flags remain OFF throughout validation.

## Final Assessment

The transformation function itself is fit to preserve as a frozen primitive. The current API, identity mapping, release membership, and channel authorization around it are not safe for staging or production.

============================================================
FILE: agents/lorentz_security/threat_model.md
============================================================
# I1Q-1007X Threat Model

Status: CURRENT BASELINE, SECURITY REPAIRS REQUIRED

Method: STRIDE-informed boundary review plus local exploit probes

Date: 2026-07-15

## Authority Context

MissionMed OS authority blockers in the first audit were snapshot-time findings during root recovery. DR-006 and MissionMed OS PR #12 now authorize the dedicated internal application, RANKLISTIQ `i1q` schema, read-only source work, preview/staging path, rollback ownership, and GitHub-only deployment. The P0/P1 application threats below remain current until repaired and independently retested.

## Protected Assets

1. Answer-bearing Item Revisions and release answer sets.
2. STAT `answer_map`, sealed pack, choice order, attempts, scoring, and historical joins.
3. Raw transcripts, source object references, student speech, patient identifiers, third-party identities, and clinical anecdotes.
4. Canonical MissionMed sessions, actor identity, role mapping, and reviewer credentials.
5. Review assignments, exact-revision approvals, governance slots, and publication ratification.
6. Immutable Item Revisions, releases, promotions, source hashes, manifests, and audit chain.
7. RANKLISTIQ project routing, migrations, RLS policies, database credentials, and deployment workflow.
8. Protected Drills, Daily, Arena, HQ, WordPress, Railway, Matrix, CDN, R2, and source registries.

## Trust Boundaries

| Boundary | Trusted input | Required control |
| --- | --- | --- |
| Browser to I1Q app | Canonical cookie/session and CSRF token | Session validation, CSRF, origin, role authorization, bounded schemas |
| I1Q app to HQ/auth | Verified canonical actor and session state | Expiry, revocation, logout, outage, and role-map handling |
| I1Q app to RANKLISTIQ | Server-derived actor context | Transaction-local context, forced RLS, least privilege, no client base-table grants |
| I1Q review workflow | Assignment and immutable revision | Exact reviewer/actor/type/hash checks, self-review prevention |
| I1Q release workflow | Validator and authority evidence | Independent promotion chain and immutable records |
| Restricted source to working corpus | Authorized read-only bytes | Redaction, rights, source/working hashes, no raw downstream text |
| I1Q to STAT | Immutable release artifacts | Nine-field server row, class A pre-answer, finalization/participant reveal |
| I1Q to Drills | Versioned read-only adapter | Explicit availability, lineage, rights/privacy, no registry mutation |
| GitHub to staging/production | Reviewed fixed commit | Canonical workflow, preview, backup, RLS/security/rollback gates |

## Threat Register

| ID | STRIDE | Severity | Threat | Current evidence | Required repair |
| --- | --- | --- | --- | --- | --- |
| TH-001 | Information disclosure | P0 | General internal reader retrieves answers and explanations through generic revision API | Reproduced with `read_only` actor | SEC-001 |
| TH-002 | Spoofing / disclosure | P0 | Caller supplies `post_answer_finalized` and unlocks debrief without server state or participant proof | Reproduced | SEC-002 |
| TH-003 | Tampering / elevation | P0 | Any write role can forge rights, privacy, evidence, or source eligibility | Reproduced with unassigned physician role | SEC-003 |
| TH-004 | Spoofing / elevation | P0 | Admin registers fabricated physician credentials and impersonates reviewer | Reproduced | SEC-004 |
| TH-005 | Tampering | P0 | Medical event is accepted on an editorial assignment | Reproduced | SEC-004 |
| TH-006 | Elevation / repudiation | P0 | One admin self-assigns governance and publishes without independent evidence or Brian ratification | Reproduced | SEC-005 |
| TH-007 | Spoofing | P1 | Database trusts caller-set actor and comma-separated roles | Static SQL review | SEC-006 |
| TH-008 | Information disclosure / IDOR | P1 | Actor-present RLS exposes most tables without ownership or assignment scope | Static SQL review | SEC-006 |
| TH-009 | Spoofing / CSRF | P1 | Cookie-backed mutations have no CSRF or origin validation in I1Q | Static API review | SEC-007 |
| TH-010 | Spoofing | P1 | Expired or revoked canonical session behavior is not proven; inspected HQ source accepts expired payloads after warnings | Static protected-source review; live parity unverified | SEC-007 |
| TH-011 | Information disclosure | P1 | Raw transcript text survives in normalized in-memory objects and can reach downstream logs or accidental writes | Static pipeline review | SEC-008 |
| TH-012 | Tampering / disclosure | P1 | Privacy aggregate passes with zero recall when class denominators exist | Reproduced | SEC-008 |
| TH-013 | Tampering | P1 | Ordinal projected IDs and bare-question lookup can remap or overwrite identity | Static transformation review | SEC-009 |
| TH-014 | Tampering / repudiation | P1 | Rollback inserts an audit event with null predecessor and does not control the running in-memory app | Static SQL/app review | SEC-010 |
| TH-015 | Tampering / denial | P1 | Candidate migration violates naming/header/repeatability protocol and has no Postgres proof | Static migration review | SEC-011 |
| TH-016 | Tampering / denial | P1 | Application records do not match SQL record requirements and no transactional repository exists | Static cross-contract review | SEC-011 |
| TH-017 | Information disclosure | P1 | Leak scanner omits `answer_map` and `is_correct` and is not closed-world | Reproduced | SEC-012 |
| TH-018 | Spoofing / elevation | P1 | Local demo grants admin based on loopback socket and can misidentify proxied traffic | Static auth review | SEC-013 |
| TH-019 | Tampering / disclosure | P1 | Placeholder Drills artifact omits source availability, rights, privacy, and hashes | Static consumer review | SEC-014 |
| TH-020 | Denial / supply chain | P1 | Dependency, secret, log, error, and deployed-route attack suites are incomplete | Not executed | SEC-015 |

## Abuse Cases

### Answer harvesting

An authenticated low-privilege user enumerates `/api/v1/resources/item_revisions` and collects every answer and explanation. No duel, assignment, purpose, or answer-read audit is required.

### Premature reveal

An authenticated user requests a post-answer channel with the query phase `post_answer_finalized`. The service accepts the label rather than authoritative server state.

### Governance fabrication

A platform administrator creates a reviewer with self-declared physician credentials, assigns governance slots, submits review as that reviewer, turns on release state, and completes all promotions alone.

### RLS role injection

A database caller sets custom actor/role settings before querying. Because policies trust those settings, the caller can claim an administrative role unless the future adapter and database privileges prevent it.

### Source leakage

A pipeline error, debug log, or generic resource response serializes an in-memory segment containing both raw and redacted text. Restricted source content crosses into ordinary application observability.

### Identity collision

Two releases reuse a question ID or an earlier revision is inserted, changing ordinal IDs. Lookup generation silently overwrites or remaps an old attempt to different content.

## Existing Defensive Evidence

- No current live `answer_map` query exists in candidate source.
- Exact nine-field projection and STAT fixed vector pass locally.
- Feature flags default off in candidate SQL.
- No client grants are created by candidate SQL.
- Candidate HTTP responses set restrictive CSP, frame, MIME, referrer, permissions, cache, and body-size controls.
- Local tests reject malformed JSON and traversal attempts.
- No migration, deployment, consumer activation, or source mutation occurred in this audit.

These controls reduce immediate exposure but do not offset any P0 finding.

## Release Criteria

Every P0 must be repaired and regression-tested. Every P1 must either pass an executable preview/staging test or have an explicit, time-bounded accepted-risk decision that does not weaken answer, identity, privacy, migration, or release invariants. DR-006 does not accept these application risks.

## Threat Verdict

SECURITY VETO. The current candidate must not receive a migration, staging route, internal production audience, or consumer activation.

============================================================
FILE: agents/medical_content/distractor_quality_report.md
============================================================
# I1Q-1007X Distractor Quality Report

Date: 2026-07-15
Status: MODEL_DEFINED_NO_REAL_DISTRACTORS_AUDITED
Medical approval: NOT ISSUED
Path: /Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/agents/medical_content/distractor_quality_report.md

No real question, answer, option, rationale, or reference was inspected. Real distractors reviewed: 0.

## Mandatory Gate

Each distractor and the four-option set receive PASS, FAIL, or BLOCKED_NOT_ASSESSABLE on every dimension. Any FAIL or BLOCKED_NOT_ASSESSABLE blocks promotion. Medical uncertainty maps to BLOCKED_UNCERTAIN. Known evidence disagreement maps to MEDICAL_REFERENCE_CONFLICT. Every set remains PHYSICIAN_REVIEW_REQUIRED.

| Dimension | PASS requirement | Blocking condition |
|---|---|---|
| Plausibility | The option represents a documented learner misconception, with misconception_id, trap_type, provenance, and a concise why_tempting. | Implausible filler, no misconception value, or unsupported plausibility. |
| Accidental correctness | The option is safely wrong under the full stem, population, timing, qualifiers, and current evidence. | It is correct or defensible under any reasonable reading or current authority. |
| Abstraction consistency | Stem ask and all options operate at one level, such as diagnosis, next step, or mechanism. | Mixed categories, levels, or answer forms. |
| Mutual exclusivity | Exactly one option is defensible and option truth conditions do not overlap. | Synonyms, subset relations, overlapping conditions, or more than one defensible answer. |
| Misconception value | Selecting the option exposes a specific remediable reasoning error. | Pure trivia, arbitrary proximity, wording trick, or no useful diagnostic signal. |
| Explanation sufficiency | The correct rationale and every why_wrong and why_tempting are claim-consistent and explain the distinction without adding unsupported claims. | Missing rationale, circular explanation, transcript-only authority, or unsupported new claim. |

## Required Per-Distractor Contract

- choice slot
- misconception_id from the pinned vocabulary version
- trap_type
- distractor_provenance: transcript_mentioned, vocabulary_derived, reviewer_authored, or ai_generated
- abstraction_class
- plausibility_verdict and reason code
- accidental_correctness_verdict
- mutual_exclusivity_verdict
- why_tempting and why_wrong
- linked Evidence Claim identifiers
- guideline_sensitivity
- physician_attestation_status

The correct option must not use distractor-only fields. The set-level record carries exactly_one_defensible, abstraction_consistent, and exact_revision_hash.

## Evidence And Guideline Rules

- Transcript mention establishes provenance only, never current correctness or safe wrongness.
- MEDICAL_REFERENCE_SUPPORTED is required for the scored assertion and for any distractor rationale that makes a medical claim.
- A guideline-sensitive option requires a current versioned claim. Stale, conflicting, or context-mismatched authority blocks the entire set.
- AI-generated distractors require complete editorial inspection and credentialed physician review. AI never attests plausibility or safe wrongness.
- Post-release selection behavior may flag dead or over-attractive distractors, but no empirical threshold or performance claim exists before real exposure.

## Current Contract Findings

Implemented: exactly four distinct options; why_tempting, why_wrong, and misconception_id for each distractor; exact-hash medical review; release claim checks.

Missing or incomplete: trap_type, distractor_provenance, abstraction class, mutual exclusivity, accidental-correctness verdict, physician distractor attestation, guideline sensitivity, and closed structured review findings.

## Tests, Blockers, Confidence

Transient concurrent privacy diagnostic: 56 tests, 53 passed, 3 failed while privacy code and tests were under correction. This is not final integrated evidence. STAT, class-A leak, Drills, and exact medical review checks passed only within that transient run.

Blockers: zero real candidates, privacy veto on all 97 sources, no credentialed medical review, incomplete distractor schema, and no empirical selection data.

Confidence: HIGH for the rubric and contract gap audit; NOT_ASSESSABLE for real distractor quality.

## Root Handoff

Root should implement these as fail-closed structured fields and validators before any real candidate enters physician review. No distractor set may be described as medically plausible, safely wrong, or approved from this report.

============================================================
FILE: agents/medical_content/evidence_conflict_report.md
============================================================
# I1Q-1007X Evidence Conflict Report

Date: 2026-07-15
Status: ZERO_REAL_CONFLICTS_EVALUATED
Medical approval: NOT ISSUED
Path: /Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/agents/medical_content/evidence_conflict_report.md

Real Evidence Claims reviewed: 0. Real conflict entries: 0. No medical reference, assertion, transcript wording, or item content was inspected.

## Evidence Classes

Architecture 1002.1 permits major_guideline, standard_reference, landmark_evidence, and physician_attested.

MEDICAL_REFERENCE_SUPPORTED requires an atomic claim, appropriate authority class, public citation metadata and locator, context match, evidence review date, review-by date, current status, no unresolved conflict, and credentialed physician verification. physician_attested is limited to standard practice without a suitable single reference and still requires verified credentials and dates. Transcript provenance is never an evidence class.

## Conflict Decision Table

| Condition | Required status | Action |
|---|---|---|
| Transcript teaching differs from current evidence | MEDICAL_REFERENCE_CONFLICT | Preserve source history, annotate conflict, suppress conflicting voice display, and block export. |
| Current authorities disagree materially | MEDICAL_REFERENCE_CONFLICT | Block and route credentialed adjudication with second review. |
| Reference is stale, withdrawn, or guideline version is uncertain | BLOCKED_UNCERTAIN | Do not infer currency; obtain current authority or reject. |
| Candidate answer is not entailed by the cited claim | BLOCKED_UNCERTAIN | Reject or create a new evidence-supported draft; never repair silently. |
| Population, timing, setting, or qualifier does not match | BLOCKED_UNCERTAIN | Block until context is resolved on a new exact revision. |
| More than one answer remains defensible | BLOCKED_UNCERTAIN | Rewrite as a new draft or reject. |
| Reviewer disagreement affects correctness or safe wrongness | MEDICAL_REFERENCE_CONFLICT | Escalate to medical governance; unresolved conflict blocks release. |
| Current evidence supports the exact assertion | MEDICAL_REFERENCE_SUPPORTED | Keep PHYSICIAN_REVIEW_REQUIRED until an exact-hash credentialed pass. |

## Guideline Sensitivity And Currency

- Every claim records stable, standard, or volatile currency class and a review-by date.
- Architecture windows remain OPEN governance defaults. This specialist does not ratify them.
- Guideline publication, withdrawal, safety notice, or material update creates an evidence event.
- Affected claims become conflicted or superseded; dependent revisions are flagged and blocked from new releases.
- Reaffirmation requires credentialed re-verification. Changed truth requires a new claim and new Item Revision. Published snapshots are not edited in place.

## Contract Findings

The current SQL Evidence Claim includes authority_class, status, reviewed_at, expires_at, and source links. It lacks explicit verified_by, authority_refs, currency_class, and review_by_date. Release assembly accepts only verified, unexpired claims but does not directly check revision-level open_conflict or active safety flags. These are release blockers before real content.

## Tests, Blockers, Confidence

Transient concurrent privacy diagnostic: 56 tests, 53 passed, 3 failed while privacy code and tests were under correction. This is not final integrated evidence, and no medical evidence check used real claims.

Blockers: no privacy-cleared candidate, no real claim, unassigned medical governance, no credentialed adjudication, and incomplete claim schema.

Confidence: HIGH for conflict routing and contract findings; NOT_ASSESSABLE for medical truth or conflict prevalence.

## Root Handoff

Root must preserve the provenance-versus-truth split, add missing evidence fields and fail-closed conflict checks, and keep medical-answer agreement null until credentialed review exists.

============================================================
FILE: agents/medical_content/legacy_v4_medical_risk_triage.md
============================================================
# I1Q-1007X Legacy v4 Medical Risk Triage

Date: 2026-07-15
Status: AGGREGATE_SYSTEM_RISK_ONLY
Medical approval: NOT ISSUED
Path: /Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/agents/medical_content/legacy_v4_medical_risk_triage.md

No legacy row, prompt, option, answer, explanation, title, source JSON, protected QBank directory, or current CDN item was inspected.

## Dataset Boundary

| Dataset | Aggregate size | Disposition |
|---|---:|---|
| Static legacy v4 aggregate | 845 rows | System-risk triage only; zero content review. |
| Current CDN mirror | 3,961 items | Separate dataset; not inspected and not reconciled here. |

The two datasets must not be conflated, subtracted, merged, or used as each other's denominator.

## Aggregate Risk Findings

| Fact | System risk | Permitted conclusion |
|---|---|---|
| All-answer-A source property | Key provenance, choice-order, positional-bias, and shuffle-contract risk. | Requires structural reconciliation. It does not prove any item answer is medically wrong. |
| 517 base rows and 328 vignette rows | Row-type transformation, reconciliation, and denominator risk. | These are row counts within the 845-row static dataset, not pair relationships. |
| 11 duplicate-prompt groups | Duplicate exposure, variant leakage, and conflicting-revision risk. | Group membership is not a medical equivalence finding. |
| Source JSON missing | Lineage, source-hash, and exact-row reconciliation are blocked. | Migration provenance alone cannot establish original source completeness. |
| Zero content review | Medical correctness, distractor safety, explanation quality, and evidence currency are unknown for every row. | No legacy row is medically validated or release eligible. |
| Exposure metadata unavailable | P1 versus P3 queue priority cannot be assigned honestly. | No item-level exposure claim or ordering is permitted. |

## Future Fail-Closed Triage

1. Obtain the authorized static export and source provenance without entering protected legacy directories.
2. Reconcile exactly 845 rows using dataset_version, question_id, and content_hash.
3. Audit answer-key provenance, choice ordering, shuffle behavior, and the all-answer-A transformation before interpreting content.
4. Reconcile the 517 base rows, 328 vignette rows, and 11 duplicate-prompt groups without assuming medical equivalence.
5. Join non-student aggregate exposure metadata, then assign P1 or P3. Any actual safety incident becomes P0.
6. Have credentialed physicians screen all 845 under the Architecture 1002.1 T1 through T4 process.
7. Create current Evidence Claims during retro-review, never at import by fabrication.
8. Permit a new release only after exact revision review, current claims, no conflict or safety flag, privacy and rights clearance, release validation, and publication ratification.

The source property and duplicate structure may prioritize system checks. They cannot substitute for item-level credentialed review.

## Metrics, Tests, Blockers, Confidence

Content reviewed: 0 of 845. Medical error rate, medical-answer agreement, approval yield, and exposure-ranked risk are NOT_SCORABLE.

Committed aggregate evidence confirms 845 expected rows and zero approved or release-eligible legacy revisions in the prior engineering baseline. This audit did not inspect content or the separate 3,961-item mirror.

Blockers: missing source JSON, zero content review, unavailable exposure metadata, no item-level physician queue, and no current Evidence Claims.

Confidence: HIGH for the supplied aggregate facts and system-risk conclusions; NOT_ASSESSABLE for item-level medical risk.

## Root Handoff

Root must keep the 845-row static aggregate separate from the 3,961-item CDN mirror, preserve the zero-content-review statement, avoid item-level medical claims, and route structural reconciliation before credentialed T1 through T4 review.

============================================================
FILE: agents/medical_content/medical_candidate_audit.md
============================================================
# I1Q-1007X Medical Candidate Audit

Date: 2026-07-15
Status: BLOCKED_NO_REAL_MEDICAL_CANDIDATES
Medical approval: NOT ISSUED
Scope: Aggregate and contract audit only
Path: /Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/agents/medical_content/medical_candidate_audit.md

This report was prepared by a non-credentialed medical content safety specialist. It is not a medical review or approval.

## Current Determination

- Real sources: 97.
- Source-level attribution: 97 verified_drj.
- Privacy-blocked sources: 97.
- Compliant working transcripts: 0.
- Real candidates: 0.
- Physician-reviewed or physician-approved real revisions: 0.
- Release-eligible and published real revisions: 0.
- No source wording, title, speaker label, question row, answer, distractor, reference, or medical claim was inspected.
- All future real candidates must retain AI_DRAFT_NOT_MEDICALLY_VALIDATED lineage. Approval, if later earned, belongs to a separate exact-hash Item Revision review event and never rewrites candidate lineage.
- Medical-answer agreement and candidate approval yield are NOT_SCORABLE, not zero, until credentialed physician review supplies valid denominators.

## Authority Reconciliation

| Authority or contract | Binding medical-safety effect |
|---|---|
| Architecture 1002.1 | Separates immutable transcript provenance from current medical truth; requires current Evidence Claims and credentialed physician review. |
| DR-006 | Authorizes internal engineering and privacy-safe derivation but leaves medical governance unassigned and student publication closed. |
| Privacy veto | No extraction or candidate generation may consume a raw or privacy-blocked transcript. All 97 sources stop before candidate creation. |
| STAT contract | Preserves the exact nine-field server projection and keeps answer secrets server-only until finalization. Only approved exact revisions may enter a release. |
| Drills contract | Requires explicit asset availability, rights and privacy clearance, source hashes, and timestamp linkage. Drills consumer activation remains off. |
| Product passport | Requires editorial review, credentialed physician review, current non-conflicted claims, no active safety flag, privacy and rights clearance, release validation, and Brian publication ratification. |

DR-006 resolves the older 1006 registration and internal-integration authority gaps. It does not clear the 97-source privacy veto, assign medical governance, validate an answer, or enable any consumer flag.

## Exact Future-Candidate Decision Model

Every materialized real candidate has four independent fields. Combining them into one status is prohibited.

| Field | Required value and meaning |
|---|---|
| lineage | AI_DRAFT_NOT_MEDICALLY_VALIDATED for every future real candidate, permanently. |
| answer_provenance_status | Exactly one of TRANSCRIPT_EXPLICIT_ANSWER, TRANSCRIPT_INFERRED_ANSWER, or AI_PROPOSED_ANSWER. |
| medical_evidence_status | Exactly one of MEDICAL_REFERENCE_SUPPORTED, MEDICAL_REFERENCE_CONFLICT, or BLOCKED_UNCERTAIN. |
| review_gate_status | PHYSICIAN_REVIEW_REQUIRED until a credentialed review event passes on the exact immutable revision hash. |

Status meanings:

- TRANSCRIPT_EXPLICIT_ANSWER: A privacy-cleared answer span directly answers the source question. The redacted source wording and hashes remain immutable. This status says nothing about current correctness.
- TRANSCRIPT_INFERRED_ANSWER: The answer is inferred from privacy-cleared context rather than directly stated. The inference basis is recorded separately and may not be presented as a quote.
- AI_PROPOSED_ANSWER: The answer is proposed by AI or concept derivation and may not be attributed to the transcript or to Dr. J.
- MEDICAL_REFERENCE_SUPPORTED: A current atomic Evidence Claim supports the proposed scored assertion with authority class, locator, review date, review-by date, and no unresolved conflict. This is evidence support, not approval.
- MEDICAL_REFERENCE_CONFLICT: Transcript teaching, references, guidelines, reviewers, or answer interpretations conflict. Provenance remains unchanged and release eligibility stops.
- PHYSICIAN_REVIEW_REQUIRED: Mandatory for every real candidate regardless of provenance or evidence support. AI cannot clear this gate.
- BLOCKED_UNCERTAIN: Evidence is missing, stale, context-mismatched, ambiguous, or leaves more than one defensible answer. The candidate is blocked or rejected, never auto-repaired.

Decision rules:

1. Privacy or rights failure prevents candidate materialization.
2. Preserve privacy-cleared source wording and current-answer wording in separate fields and hashes.
3. Assign exactly one answer provenance status.
4. Evaluate an atomic current-truth claim. Transcript provenance is never evidence authority.
5. Any known conflict produces MEDICAL_REFERENCE_CONFLICT. Inability to decide produces BLOCKED_UNCERTAIN.
6. MEDICAL_REFERENCE_SUPPORTED still requires PHYSICIAN_REVIEW_REQUIRED.
7. A physician pass must bind reviewer credential evidence, assignment, exact revision hash, claim set, distractor findings, and review event.
8. A passed Item Revision may become approved only through the architecture workflow. The source candidate remains AI_DRAFT_NOT_MEDICALLY_VALIDATED.
9. Claim expiry, guideline change, new conflict, or safety flag reopens review and blocks new releases.

## Current Contract Audit

Implemented safeguards:

- Candidate creation requires privacy pass and verified_drj segment attribution.
- Candidate lineage is constrained to AI_DRAFT_NOT_MEDICALLY_VALIDATED and auto-approval is rejected.
- Four choices, distinct choice text, answer rationale, and per-distractor why_tempting, why_wrong, and misconception_id are required.
- Medical assignments and review events bind exact revision hashes and verified, unexpired MD or DO credential evidence.
- Editorial review must precede medical approval; an unassigned medical governance lead blocks approval.
- Release assembly requires an exact credentialed medical pass, verified unexpired claims, rights clearance, privacy clearance, and answer-isolation checks.

Contract gaps requiring remediation before real medical review:

1. The seven mandatory provenance, evidence, review, and uncertainty statuses are not centrally enumerated or schema-enforced. extraction_candidates.answer_source_type is unconstrained.
2. The Evidence Claim SQL contract lacks explicit verified_by, authority_refs, currency_class, and review_by_date fields required by Architecture 1002.1.
3. Review Assignment storage and service contracts do not fully encode priority tier, required specialty, second-review requirement, or queue reason codes.
4. Distractor contracts omit trap_type, distractor_provenance, abstraction-level attestation, mutual-exclusivity attestation, accidental-correctness verdict, and physician plausibility attestation.
5. Revision-level active safety flags and open conflict are not modeled as release-gate checks. Claim conflict is blocked indirectly because only verified claims assemble.
6. The SQL verdict enum uses needs_revision while the current service checks changes_requested. Canonical Architecture 1002.1 uses needs_revision.
7. The OpenAPI ItemRevisionDraft schema does not expose the full evidence, status, distractor, or review contract.

## Transient Concurrent Privacy Diagnostic

Command run:

    node --test i1q-question-platform/tests/adapters-security.test.mjs i1q-question-platform/tests/api.test.mjs i1q-question-platform/tests/platform.test.mjs

Observed result: 56 tests, 53 passed, 3 failed while privacy code and tests were under concurrent correction. This run is diagnostic only and is not final integrated evidence.

- STAT, class-A leak, Drills adapter, exact-hash review, credential, and release-gate checks passed within this transient run only.
- Two privacy aggregate tests expected pass or fail but the concurrent working tree returned INCOMPLETE.
- One privacy redaction test expected an older reason-code token than the concurrent implementation returned.
- The mismatches identify concurrent privacy contract and test drift. Final integrated privacy evidence requires a fresh run after correction.

## Blockers And Confidence

Blockers: 97 privacy-blocked sources, zero compliant working transcripts, unassigned medical governance lead, no credentialed real review, incomplete status and evidence contracts, final integrated privacy evidence pending, and all student, STAT, and Drills consumer flags closed.

Confidence: HIGH for aggregate state, authority reconciliation, and contract findings. NO MEDICAL-ACCURACY CONFIDENCE is possible because no medical content was examined.

## Root Handoff

Root must carry the four-field decision model into schema and validator remediation, preserve the privacy veto, keep all future candidates AI_DRAFT_NOT_MEDICALLY_VALIDATED, leave all consumer flags off, and avoid any claim of medical agreement, approval yield, physician validation, or release eligibility.

============================================================
FILE: agents/medical_content/physician_review_queue.md
============================================================
# I1Q-1007X Physician Review Queue

Date: 2026-07-15
Queue state: EMPTY_BLOCKED
Real queue entries: 0
Medical approval: NOT ISSUED
Path: /Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/agents/medical_content/physician_review_queue.md

No physician or reviewer identity is assigned or presumed. The 97 privacy-blocked sources are not queue entries. The 845 legacy rows are not item-level queue entries because content review and exposure prioritization have not occurred.

## Queue Entry Schema

The durable queue record contains references and gates, not source text, titles, prompts, options, answers, or rationale text.

| Field | Contract |
|---|---|
| queue_entry_id | Stable opaque identifier. |
| candidate_id and item_revision_id | Internal identifiers; item_revision_id required before medical verdict. |
| exact_revision_hash | Required and immutable for assignment and verdict. |
| lineage | Always AI_DRAFT_NOT_MEDICALLY_VALIDATED for a future real candidate. |
| answer_provenance_status | Exactly one mandatory transcript or AI provenance status. |
| medical_evidence_status | MEDICAL_REFERENCE_SUPPORTED, MEDICAL_REFERENCE_CONFLICT, or BLOCKED_UNCERTAIN. |
| review_gate_status | PHYSICIAN_REVIEW_REQUIRED until exact-hash completion. |
| claim_ids and claim_currency | Current claim references and dates, with no text copied into the queue. |
| privacy_rights_attribution | Passing privacy, required rights, and source-level attribution gates. |
| distractor_gate_summary | Six fail-closed dimension results. |
| uncertainty_codes | Structured reason codes only. |
| priority and priority_reasons | P0 through P3 with deterministic reasons. |
| required_specialty | Routing requirement; nullable only with logged governance exception and second review. |
| assignment | State, reviewer_id, verified credential evidence, calibration state, due_at, and second-review flag. |
| review_event_id | Required on completion and bound to exact_revision_hash. |

Queue entries array for this audit:

    []

## Priority Plan

- P0: safety concern, disputed answer, or live incident scope. Immediate.
- P1: high-exposure legacy, flagged published content, guideline change, or resolved conflict requiring second review.
- P2: privacy-cleared pilot and new-content candidates.
- P3: low-exposure legacy background review.

Exposure metadata is unavailable, so the 845 legacy rows cannot truthfully be divided between P1 and P3. The all-answer-A property, 517 base rows, 328 vignette rows, and 11 duplicate-prompt groups justify urgent system reconciliation but do not create item-level medical findings.

## Assignment And Verdict Gates

- Medical governance lead must be assigned.
- Reviewer must be active, independently credential-verified, unexpired, calibrated, and free of self-review conflict.
- Specialty matching is required by default; a mismatch needs logged governance acceptance or a second physician review.
- Canonical structured verdicts are pass, needs_revision, and fail. The current service value changes_requested conflicts with the SQL and architecture needs_revision value.
- Pass requires MEDICAL_REFERENCE_SUPPORTED, no conflict, no active safety flag, all distractor gates passed, explanation sufficiency, and exact-hash review.
- A pass approves only the Item Revision through its Review Event. Candidate lineage remains AI_DRAFT_NOT_MEDICALLY_VALIDATED.
- P0, P1, conflict resolutions, uncalibrated reviewer work, and specialty exceptions require second review.

## Metrics, Tests, Blockers, Confidence

Medical-answer agreement and approval yield: NOT_SCORABLE before credentialed review.

Transient concurrent privacy diagnostic: 56 tests, 53 passed, 3 failed while privacy code and tests were under correction. This is not final integrated evidence. Exact-hash assignment, credential, and approval-order checks passed only within that transient run.

Blockers: zero real candidates, all 97 sources privacy-blocked, medical governance unassigned, no credentialed real reviewer assignment, incomplete priority and specialty contract, and exposure metadata unavailable.

Confidence: HIGH for schema and priority design; NOT_ASSESSABLE for queue yield or reviewer agreement.

## Root Handoff

Root should create no real queue entries until privacy clearance produces a candidate and credential governance is operational. Implement the schema, canonical needs_revision verdict, deterministic priority reasons, and second-review gates before queue activation.

============================================================
FILE: agents/privacy_rights/blocked_sources.md
============================================================
# Blocked Sources Register

Status: 97 OF 97 BLOCKED FROM EXTRACTION
Date: 2026-07-15
Artifact zone: evidence-only

## Aggregate Disposition

| Cohort | Count | Source attribution | Segment attribution | Extraction status |
|---|---:|---|---|---|
| Explicit speaker evidence | 96 | `verified_drj` | Potentially resolvable through restricted exact-match mapping | `BLOCKED` |
| Generic-only speaker evidence | 1 | `verified_drj` | Unresolved; zero segments may be retained | `BLOCKED` |
| **Total** | **97** | **Source-level verified** | **Multi-speaker filtering required** | **BLOCKED** |

The 97-source total is exhaustive for the authorized registry export identified by its recorded digest. No source title, URL, filename, path, original ID, or speaker label is reproduced in this register.

## Blocking Conditions

| Blocker | Applies to | Condition |
|---|---:|---|
| `PRIV-001_RAW_COEXPOSURE` | 97 | Candidate code returns raw text beside redacted text; the output contract is unsafe |
| `PRIV-002_CLASS_OMISSIONS` | 97 | Student speech and identifying clinical anecdotes are not required removal classes in the candidate implementation |
| `PRIV-003_AGGREGATE_MASKING` | 97 | A required class can have zero recall while an aggregate still passes |
| `PRIV-004_NO_WORKING_COPY` | 97 | No compliant working-redacted copy is evidenced |
| `PRIV-005_PILOT_NOT_RUN` | 97 | No frozen, class-complete, gold-label pilot has passed |
| `PRIV-006_PER_SOURCE_VALIDATION` | 97 | Forbidden-field, metadata-leak, deterministic-rerun, and per-source checks have not passed |
| `ATTR-001_GENERIC_ONLY_MAPPING` | 1 | No authoritative Dr J segment mapping exists; every segment remains removed by default |
| `RIGHTS-001_PUBLIC_USE` | 97 | Public excerpts, quotations, and media clips lack evidenced current Rights Records |

`RIGHTS-001_PUBLIC_USE` does not revoke Brian's DR-006 internal-derivation authorization. It independently blocks public source expression and student-facing publication.

## Unblock Requirements

For the 96 explicit-evidence sources, extraction eligibility requires a compliant Dr J-only working copy, all per-source controls, and the global privacy pilot to pass. For the generic-only source, those gates are necessary but not sufficient: an authoritative source-owner attestation or equivalent reliable MissionMed speaker mapping must also be recorded in the restricted zone.

No cohort may be partially declared passed through an aggregate score. A source remains blocked whenever its own validation is missing or failing, even after a global pilot passes.

============================================================
FILE: agents/privacy_rights/privacy_recall_precision.md
============================================================
# Privacy Recall and Precision Pilot

Status: REQUIRED; NOT YET RUN
Artifact zone: evidence-only
Date: 2026-07-15

## Gate Principle

The privacy pilot is fail-closed and class-gated. Micro, macro, weighted, or overall scores are reporting aids only; none can compensate for a failing, missing, skipped, or zero-denominator required class. A targeted zero-recall class always fails the release gate.

## Gold Standard

The frozen test set must satisfy all of the following before the first scored run:

- Include every one of the 97 sources, with at least 20 adjudicated segments per source and at least 10 non-Dr J segments per source.
- Oversample speaker transitions, overlap, ambiguous labels, rare clinical facts, and multi-segment anecdotes.
- Include an untouched, class-balanced challenge cohort sufficient to meet every positive denominator below. Authorized synthetic examples may supplement scarce classes, but synthetic results must be reported separately and cannot cure a miss in the corpus cohort.
- Use two trained annotators who did not build or tune the redaction pipeline. Resolve disagreements through documented adjudication by the interim privacy owner or a delegated privacy reviewer.
- Freeze and hash the segment selection, annotations, adjudications, class ontology, and scoring code before execution. Store all text and labels in the restricted zone; file only aggregate evidence.
- Keep development, tuning, and gold sets disjoint. Any tuning after a failed run requires a newly frozen untouched gold set.

If source coverage, class coverage, reviewer independence, or a minimum denominator is absent, the pilot status is `INCOMPLETE`, not `PASS`.

## Scoring Units

- Span classes use an adjudicated identity-bearing span as one positive unit. Overlapping predictions count as a true positive only under the frozen overlap rule.
- `NON_DRJ_SPEECH` uses a complete speaker segment as one positive removal unit.
- `IDENTIFYING_CLINICAL_ANECDOTE` uses the adjudicated linked anecdote window as one positive unit; token-only removal does not count when the window remains identifying.
- `SOURCE_METADATA` uses each independently identifying metadata occurrence as one positive unit.

For each class:

`recall = TP / (TP + FN)`

`precision = TP / (TP + FP)`

The report must include `TP`, `FP`, `FN`, both denominators, point estimates, and the one-sided 95% exact-binomial lower confidence bound for recall. Precision denominator `TP + FP` must be nonzero.

## Required Denominators and Thresholds

| Required class | Minimum gold positives (`TP + FN`) | Recall gate | Recall lower-bound gate | Precision gate |
|---|---:|---:|---:|---:|
| `NON_DRJ_SPEECH` | 970 and at least 10 from each source | 1.000 and zero retained non-Dr J segments | zero-tolerance rule | 0.90 |
| `STUDENT_NAME` | 300 | 0.990 | 0.990 | 0.90 |
| `STUDENT_OTHER_IDENTIFIER` | 300 | 0.990 | 0.990 | 0.90 |
| `PATIENT_DIRECT_IDENTIFIER` | 600 | 0.995 | 0.995 | 0.90 |
| `PATIENT_QUASI_IDENTIFIER` | 600 | 0.995 | 0.995 | 0.90 |
| `THIRD_PARTY_IDENTITY` | 300 | 0.990 | 0.990 | 0.90 |
| `IDENTIFYING_CLINICAL_ANECDOTE` | 600 | 0.995 | 0.995 | 0.90 |
| `SOURCE_METADATA` | 300 | 1.000 and zero leaked occurrences | zero-tolerance rule | 0.90 |

The patient-privacy aggregate across direct identifiers, quasi-identifiers, and identifying clinical anecdotes must also have recall at least `0.995` and a one-sided 95% lower bound at least `0.995`. `STUDENT_NAME` must independently meet `0.990`; it may not be merged with other identity classes.

The minimums of 600 and 300 allow a zero-miss pilot to establish, rather than merely assert, the corresponding 95% lower-bound target. Larger denominators are allowed and may be necessary after any miss.

## Speaker Controls

The DR-006 speaker-attribution accuracy gate of at least `0.95` is required in addition to the privacy class gates. Privacy release also requires:

- zero non-Dr J segments in retained output;
- no retention based on generic, unknown, fuzzy-matched, or inferred labels;
- separate reporting for the generic-only source; and
- zero extracted segments from that source until its authoritative Dr J label mapping is resolved.

An accuracy average cannot override a non-Dr J leak.

## Pass Algorithm

Set `PASS` only when every required class has a sufficient denominator, nonzero precision denominator, passing point recall, passing lower bound where applicable, passing precision, and no zero-tolerance event. Then require speaker attribution, forbidden-field schema validation, serialized-output scanning, deterministic rerun equality, and per-source checks to pass.

Any null, NaN, omitted class, excluded source, denominator shortfall, reviewer disagreement left unresolved, forbidden field, nondeterministic rerun, or privacy leak sets the result to `FAIL` and keeps all affected sources quarantined.

## Present Result

No conforming gold set, scored run, or per-class metric bundle is evidenced. Current pilot status is `NOT_RUN`; it cannot authorize working-copy extraction.

============================================================
FILE: agents/privacy_rights/privacy_release_verdict.md
============================================================
# Privacy Release Verdict

## Verdict: BLOCK

**Scope:** All 97 governed sources are blocked from concept extraction, candidate generation, and downstream content use. Read-only inventory and restricted privacy engineering remain authorized under DR-006.

**Confidence:** High (`0.98`) that the present evidence requires a block. This confidence reflects matched evidence digests, complete aggregate source coverage, explicit known defects, and the absence of a governed working-copy run or privacy pilot. It is not confidence that the underlying content is privacy-safe.

## Determinations

- All 97 sources may be classified `verified_drj` at the source level because the authoritative registry category satisfies DR-006.
- Source classification does not identify the speaking person in each segment. Every source is multi-speaker.
- Ninety-six sources have explicit speaker evidence suitable for a restricted exact-match allowlist after the privacy controls pass.
- The generic-only source remains source-verified but segment-unresolved. It must retain zero segments until an authoritative mapping is recorded.
- Brian's authority covers internal inventory and derivation only. It does not publicly clear source excerpts, quotations, or media clips.

## Release Blockers

1. The candidate implementation exposes raw and redacted text together.
2. Non-Dr J speech, student speech, and identifying clinical anecdotes are not all enforced as required fail-closed classes.
3. Aggregate scoring can mask zero recall for a required class.
4. No compliant working-redacted copy exists for any source.
5. No frozen, source-complete, class-complete gold pilot has met patient recall `>= 0.995`, student-name recall `>= 0.99`, every per-class threshold, and the required confidence bounds.
6. No per-source forbidden-field scan, metadata-leak scan, deterministic-rerun proof, or output-schema proof is filed.
7. One source lacks authoritative segment-level Dr J mapping.
8. Public-use Rights Records are not evidenced.

## Conditions for Re-review

Re-review requires a new evidence bundle showing: a construct-from-allowlist output schema with no raw sibling fields; deterministic non-Dr J removal; complete required-class handling; restricted and adjudicated gold labels; all denominators and per-class metrics; a passing patient and student-name gate; byte-identical rerun evidence; 97 per-source validation results; and resolution or continued zero-retention treatment of the generic-only source.

Passing privacy would authorize only the DR-006 internal workflow. Student-facing publication would still require rights clearance, medical governance, review, release validation, and Brian ratification under the passport and DR-006.

============================================================
FILE: agents/privacy_rights/privacy_source_model.md
============================================================
# I1Q-1007X-MA Privacy and Source Model

Status: CONTROL DEFINED; EXTRACTION BLOCKED
Artifact zone: evidence-only
Date: 2026-07-15
Authority: MissionMed OS commit `93c0404794fe105235b80514c75fffc3177f140b`, mission `I1Q-1006`, Question Platform passport, and `DR-006`

## Governing Determinations

1. The authoritative registry classifies all 97 records in the governed corpus category. Under DR-006, authoritative registry metadata is sufficient to classify all 97 sources as `verified_drj` at the **source level** for internal use.
2. Source-level corpus classification is not speaker-segment attribution. All 97 sources are multi-speaker, so no source may be retained wholesale.
3. Ninety-six sources have explicit source-specific speaker evidence that can support a deterministic restricted-zone allowlist. This evidence is not copied into working or evidence outputs.
4. One source has only generic-role evidence. It remains `verified_drj` at source level, but its Dr J segment mapping is unresolved. Its default retained-segment count is zero until a source-owner attestation or equally authoritative MissionMed mapping is recorded by the interim privacy owner.
5. `verified_drj` is an attribution classification, not public rights clearance, credential verification, medical approval, or permission to publish quotations, transcript excerpts, or media.

## Four-Zone Model

| Zone | Permitted contents | Permitted operations | Promotion rule |
|---|---|---|---|
| **Raw** | Authoritative source-system objects and metadata in their original systems | Read-only inventory and authorized fetch | Raw objects never promote directly to extraction |
| **Restricted** | Minimal fetched copies, original text, original labels, source metadata, source-to-opaque-ID map, gold labels, and redaction diagnostics | Least-privilege processing, annotation, adjudication, and deletion under audit | Only an allowlisted, validated transform may emit a working copy |
| **Working-redacted** | Dr J-only redacted text, opaque nonsemantic references, timestamps, typed redaction markers, and pipeline provenance | Privacy-safe extraction and quarantined candidate generation after the pilot gate passes | No promotion while any source or global privacy gate is open |
| **Evidence-only** | Aggregate counts, digests, thresholds, statuses, and non-reversible run evidence | Git filing, audit, and release review | Must contain no raw text, source metadata strings, original labels, names, or unredacted identifiers |

Raw and restricted zones are both restricted-access, but they have different ownership. The raw zone remains the immutable source-system truth. The restricted zone is a controlled processing boundary and must never become a second source of record.

## Required Removal Classes

| Class | Required action |
|---|---|
| `NON_DRJ_SPEECH` | Remove the entire segment, including student, unknown, generic-role, third-party, overlapping, and ambiguously attributed speech |
| `STUDENT_NAME` | Remove the span; suppress the segment when surrounding context remains identifying |
| `STUDENT_OTHER_IDENTIFIER` | Remove direct and linkable student identifiers, affiliations, handles, contact details, and cohort details |
| `PATIENT_DIRECT_IDENTIFIER` | Remove direct patient identifiers and linked identifiers |
| `PATIENT_QUASI_IDENTIFIER` | Remove dates, locations, demographics, relationships, rare attributes, and combinations that can identify a patient |
| `THIRD_PARTY_IDENTITY` | Remove identities and linkable descriptors of clinicians, staff, relatives, institutions, and other persons |
| `IDENTIFYING_CLINICAL_ANECDOTE` | Suppress the complete anecdote window when span redaction cannot reliably break re-identification linkage |
| `SOURCE_METADATA` | Remove source titles, URLs, paths, filenames, original IDs, original speaker labels, and metadata-derived strings |

The classes are a union. A segment matching more than one class receives every applicable removal action; no detector or class can vote another class back into the output.

## Deterministic Transform

1. **Admit the source.** Require a `verified_drj` source-level decision, exact artifact digest, expected JSON type, expected record-key allowlist, and complete timestamp, speaker, and text fields. Reject malformed or changed input.
2. **Create an opaque mapping.** Assign random, nonsemantic working source and segment references. Keep the source mapping only in the restricted zone.
3. **Apply the speaker allowlist first.** Retain a segment only when its original label exactly matches the source-specific authoritative Dr J mapping. Fuzzy label matching, title inference, voice inference, and majority-speaker inference are prohibited. Unknown, mixed, overlapping, or ambiguous segments are removed.
4. **Run the fixed redaction ensemble.** Use pinned detector, ruleset, dictionary, and normalization versions with deterministic settings. The output is the union of all detected removal classes.
5. **Suppress context, not only tokens.** Evaluate the full anecdote window across adjacent segments. If rare facts or combined quasi-identifiers can still single out a person, suppress the complete linked window.
6. **Construct a new object from an allowlist.** Never clone the input and edit fields in place. The only working fields are opaque references, millisecond timestamps, normalized `DRJ` role, `redacted_text`, applied class codes, and pipeline version.
7. **Reject forbidden fields.** Schema validation fails on unknown fields and specifically forbids raw text, original speaker labels, source metadata, reversible source IDs, and parallel raw/redacted values.
8. **Scan the serialized output.** Run identity, metadata, high-entropy, path, URL, email, telephone, account, and forbidden-key checks over the final bytes. Any hit quarantines the whole source.
9. **Seal evidence.** Record input bundle digest, pipeline digest, gold-set digest, output digest, counts, and pass/fail only. Per-source mappings and diagnostic snippets remain restricted.

The same pinned input and pipeline must produce byte-identical working output. Uncertainty always resolves to removal or quarantine, never retention.

## Working-Copy Contract

A compliant working copy:

- contains only positively mapped Dr J segments;
- contains no original or non-Dr J speaker labels;
- exposes `redacted_text` only, never a raw-text sibling field;
- uses non-linkable typed placeholders or whole-window suppression;
- carries no title, URL, path, filename, source-system ID, or person name;
- is unavailable to extraction until both per-source validation and the global gold-label pilot pass; and
- remains internal and restricted from public quotation, excerpt, or clip use.

## Current Disposition

No governed working-redacted copy or passing privacy pilot is evidenced. The existing candidate privacy implementation is rejected because it returns raw text with redacted text, omits required classes, and can pass an aggregate despite zero recall for a required class. Therefore all 97 sources remain blocked from extraction. The generic-only source has the additional unresolved segment-attribution block.

============================================================
FILE: agents/privacy_rights/source_access_audit.md
============================================================
# Source Access Audit

Status: READ-ONLY EVIDENCE REVIEW COMPLETE; EXTRACTION NOT AUTHORIZED
Date: 2026-07-15
Artifact zone: evidence-only

## Scope and Method

This specialist reviewed the pinned authority and three local evidence artifacts only. No source system, registry, media object, transcript endpoint, notes service, Drive file, application, database, production data, feature flag, or deployment target was mutated. Source strings were not copied into these outputs.

## Evidence Integrity

| Evidence class | SHA-256 | Safe observations |
|---|---|---|
| Authorized registry export | `d78910d22ed3b428fd38129ec60140b70673a804a31ae3119e465d75b53631a1` | 97 records; one authoritative corpus category; playback, nodes, and transcript available for every record; no empty or duplicate media IDs; bounded creation-date range |
| Sanitized artifact probes | `ede9cc62aee72868cb4e2c96a9125bbc7be3403dbb7f3afe6b77c493bb79dae0` | 97 transcript and 97 node responses; all successful JSON; complete timestamp, speaker, and text fields |
| Hashed speaker probes | `f7d1edb339d7a2821007439f97bb70d74c2d213c8596ed43dec5b30187b87db4` | 97 multi-speaker sources; 96 explicit Dr J-label sources; one generic-only source; 146 distinct label hashes; potential identity labels in every source |

Both supplied evidence digests matched the local artifacts. The hashed-speaker evidence digest was computed during this audit and is recorded above.

## Artifact Probe Results

The sanitized evidence records a prior read-only probe, not a new network access by this specialist:

- 194 total GET observations: 97 transcript and 97 node artifacts.
- Every response was HTTP 200 with `application/json` content.
- Each artifact contained 603 to 1,331 records.
- Transcript artifacts totaled 81,604 records; node artifacts separately totaled 81,604 records.
- Every record in both families had timestamps, a speaker label, and text.
- Transcript records had one stable five-key schema; node records had the same logical fields plus a node identifier.
- There were 97 distinct transcript hashes and 97 distinct node hashes. No transcript/node pair was byte-identical.

Availability and schema completeness do not establish privacy safety, correct speaker attribution, or extraction eligibility.

## Supplemental Discovery

Restricted notes metadata was observed for 46 registry records with 651 topic entries. Its strings were not reviewed or reproduced here, and it is excluded from extraction pending the same restricted-zone handling and privacy gates.

Read-only Drive discovery observed no additional relevant corpus source. The filename query produced no relevant candidate and the content results were unrelated handoff material. This is recorded only as **no additional corpus sources observed**; it is not proof that none exist.

## Access-Control Findings

1. DR-006 authorizes read-only internal inventory and derivation from the governed MissionMed corpus.
2. Raw sources remain restricted and may not flow directly into extraction, logs, Git, evidence artifacts, or public outputs.
3. Existing candidate privacy code is not an accepted control: it co-exposes raw and redacted text, omits required classes, and permits aggregate masking of zero recall.
4. All 97 sources must remain quarantined from extraction until a compliant working copy and fail-closed pilot pass.
5. Public transcript excerpts, quotations, and media clips remain disabled without a current Rights Record.

## Audit Outcome

Read-only source availability is evidenced with high confidence. Privacy-safe source access for extraction is not evidenced. Access verdict: `BLOCK` for extraction; `ALLOW` only for continued least-privilege inventory and restricted privacy engineering under DR-006.

============================================================
FILE: agents/red_team/independent_red_team.md
============================================================
# I1Q-1007X Final Independent Red-Team Verification

Verdict: `STATE A CLEAR QUALIFIED ONLY`; `STATE B VETO`; `STATE C VETO`; `STATE D VETO`.

Final exact checkpoint: `ba17e22b0fe8a48a7397557ef95d2ceb454970d4`
Repair checkpoint: `e9e807c4803bf4483c90125ace91793489596b81`
Remote branch: `i1q-question-platform-ultra-1007x-ma` at the same final object
Final diff-only range: `65bb52c4bd14d6d20145e666e3b95b6109dfef83..ba17e22b0fe8a48a7397557ef95d2ceb454970d4`
Historical High checkpoints: `8e3f96b826923d394f19735b87725aceacaeff7c`, `2d28d0b271b637f68358fd4aae414aa2f708c63f`, `65bb52c4bd14d6d20145e666e3b95b6109dfef83`
Date: `2026-07-15`

Both `65bb52c` and `ba17e22` were exported with `git archive` and tested outside the working tree. This audit makes no deployment, auth, browser, accessibility, monitoring, or protected-consumer claim.

## Finding Dispositions

| Finding | Severity | Final disposition at `ba17e22` | Basis |
| --- | --- | --- | --- |
| IRT-002 | `HIGH` | `CLOSED` | Class C remains closed-world and omits `misconception_id`; focused adapters plus Class C pass `48/48`. |
| IRT-003 | `HIGH` | `CLOSED` | `src/platform.mjs` is unchanged; the exact package suite retains protected-review positive and denied-path coverage. |
| IRT-004 | `HIGH` | `QUALIFIED` accepted residual | The 97-source State A evidence remains a point-in-time aggregate with no row manifest and no independent Git recomputability. |
| IRT-009 | `HIGH` | `CLOSED` | All four preserved historical Class D-in-Class C bypasses fail closed in the final exact bytes before hashing or insertion. |
| IRT-010 | `HIGH` | `CLOSED` | All `44/44` checksum records match exact final Git-object paths, byte counts, and SHA-256 values. |

No new `CRITICAL` or `HIGH` finding exists at `ba17e22`. All historical findings retain `HIGH` severity; none was downgraded.

## Historical IRT-009 Highs

1. `IRT-009-H1` at `8e3f96b`: mixed-case source-ID base64/base64url bypassed Node isolation in all four prose families (`8/24` accepted).
2. `IRT-009-H2` at `8e3f96b`: SQL accepted an identifier embedded in prose and missed an embedded percent-encoded Class D marker.
3. `IRT-009-H3` at `2d28d0b`: double URL encoding bypassed one-pass Node decoding (`28` total identifier/marker bypasses); a targeted payload received artifact and manifest hashes.
4. `IRT-009-H4` at `65bb52c`: SQL lowercased only before percent decoding. `%53ource_%4Dixed%43ase` decoded to `Source_MixedCase`, while the release identifier comparator remained `source_mixedcase`. Independent artifact attacks were accepted and hashed in `explanation`, `correct_answer_rationale`, `why_tempting`, and `why_wrong`: `4/4` metadata rows and `4/4` payload rows persisted. The checkpoint's then-current PostgreSQL suite still passed `13/13` because it lacked this vector.

These are preserved at severity `HIGH` and marked closed only by final exact-object results.

## Final Closure

The Node release-linked derivation, canonical/lowercase raw/percent/base64/base64url variants, all four prose families, structured markers, bounded iterative decoding, pre-hash validation, and non-echoing `422` behavior are unchanged from the prior closure. Exact final package and focused suites remain green.

`e9e807c` changes only `normalize_security_text`: it lowercases after every percent-decoding round and again after final NFKC. At `ba17e22`, the historical vector normalizes to `source_mixedcase`. Artifact-level replay blocks all four prose-family attacks with non-echoing SQLSTATE `42501` (`channel_artifact_class_d_value_leak`) and persists zero metadata or payload rows.

Independent PostgreSQL 16.13 closure matrix against the exact final archive:

- Mixed-case direct identifiers, seven families by four fields: `28/28` detected.
- Mixed-case base64: `28/28` detected; mixed-case base64url: `28/28` detected.
- Iterative identifiers: `112/112` detected; iterative markers: `16/16` detected (`128/128` combined).
- Depth 8 normalizes to lowercase and is detected; depth 9 raises SQLSTATE `54000`; 65,537 bytes raises SQLSTATE `54000`.
- Denied matrix persistence: `0` metadata rows and `0` payload rows.

The Class A/C scan remains before `calculated_hash` and both artifact inserts. The SQL diff has only three normalization-line changes and no grant, revoke, RLS, policy, feature-flag, gate-predicate, or release-policy change. Forced-RLS, deny-by-default, disabled-gate, apply/reapply, compensation, and retained-history tests pass.

## Exact Results

- `git ls-remote origin refs/heads/i1q-question-platform-ultra-1007x-ma`: `ba17e22b0fe8a48a7397557ef95d2ceb454970d4`.
- `git diff --name-status 65bb52c ba17e22`: 22 modified paths, limited to candidate SQL, two migration tests, and refreshed evidence.
- `env -u I1Q_POSTGRES_TEST_URL npm test`: `228` discovered, `227` pass, `0` fail, `1` intentional PostgreSQL-gated skip.
- `node --test tests/adapters-security.test.mjs tests/exports-class-c.test.mjs`: `48` pass, `0` fail, `0` skip.
- Fresh UTF-8 PostgreSQL 16.13 `tests/postgres-migration.test.mjs`: `13` pass, `0` fail, `0` skip.
- `npm run validate`: `20/20` files, `0` errors, claimed state `STATE_A`.
- Exact Git-object checksum audit: `44/44` unique path/byte/hash matches, `0` stale or missing.
- `jq empty red_team_findings.json`: valid JSON.

## IRT-004 Qualification

`inventory_report.json` still declares `POINT_IN_TIME_AGGREGATE`, `row_manifest_retained=false`, and `independently_recomputable_from_git=false`, with a nonempty dated qualification. It reports 97 authorized sources and 97 registry rows, but no row manifest exists in Git. State A is therefore clear only with this accepted residual.

## State Verdict

| State | Verdict |
| --- | --- |
| State A | `CLEAR QUALIFIED ONLY` |
| State B | `VETO` |
| State C | `VETO` |
| State D | `VETO` |

Final decision: `STATE A CLEAR QUALIFIED ONLY; STATE B VETO; STATE C VETO; STATE D VETO`.

============================================================
FILE: agents/red_team/release_veto_or_clearance.md
============================================================
# I1Q-1007X Release Veto Or Clearance

Final exact checkpoint: `ba17e22b0fe8a48a7397557ef95d2ceb454970d4`
Repair checkpoint: `e9e807c4803bf4483c90125ace91793489596b81`
Final diff-only range: `65bb52c4bd14d6d20145e666e3b95b6109dfef83..ba17e22b0fe8a48a7397557ef95d2ceb454970d4`

## Verdict

`STATE A CLEAR QUALIFIED ONLY`

`STATE B VETO`

`STATE C VETO`

`STATE D VETO`

IRT-002 is `CLOSED` at preserved severity `HIGH`. IRT-003 is `CLOSED` at preserved severity `HIGH`. IRT-004 remains `QUALIFIED` accepted residual at preserved severity `HIGH`: the 97-source State A evidence is a witnessed point-in-time aggregate with no retained row manifest and no independent Git recomputability.

IRT-009 is `CLOSED` only at final exact checkpoint `ba17e22`, preserved severity `HIGH`. The three prior historical Highs remain recorded. New historical `IRT-009-H4` at `65bb52c` is also preserved: `%53ource_%4Dixed%43ase` decoded to mixed case after the one-time lowercase step and evaded the lowercase comparator. Independent replay accepted and hashed the value in all four prose families, persisting `4/4` metadata and `4/4` payload rows.

At `ba17e22`, the same vector is lowercased after each decode round and final NFKC, blocked `4/4` with SQLSTATE `42501`, and persists zero rows. Fresh PostgreSQL 16.13 verifies mixed-case direct `28/28`, base64 `28/28`, base64url `28/28`, and iterative identifier/marker `128/128`; depth 9 and oversize inputs fail closed with SQLSTATE `54000`. The SQL diff changes no grant, RLS, policy, flag, gate predicate, or release policy.

IRT-010 is `CLOSED` at preserved severity `HIGH`: exact final Git-object comparison matches `44/44` paths, byte counts, and SHA-256 values with zero stale or missing records.

Exact verification: package `228/227/0/1`; focused adapters plus Class C `48/48`; fresh UTF-8 PostgreSQL 16.13 `13/13`; evidence validator `20/20` State A; report JSON valid. All disposable PostgreSQL and archive resources were cleaned.

No new `CRITICAL` or `HIGH` finding exists at `ba17e22`. Historical findings retain `HIGH` severity and are closed only by the final exact bytes.

This report makes no deployment, auth, browser, accessibility, monitoring, or protected-consumer claim. No commit or push was performed.

Final decision: `STATE A CLEAR QUALIFIED ONLY; STATE B VETO; STATE C VETO; STATE D VETO`.

============================================================
FILE: agents/release_reliability/dependent_product_regression.md
============================================================
# I1Q-1007X Dependent Product Regression

Date: 2026-07-15

Verdict: `BASELINE INCOMPLETE. NO DEPENDENT PRODUCT CERTIFIED.`

## Scope Completed

Assembled the protected dependent-product baseline, preserved the four runtime hash divergences, identified owner actions, and separated unchanged-by-I1Q from tested-green. No protected product was modified or exercised by this agent.

## Evidence Inspected

Protected consumer matrix, ecosystem graph, auth map, deployment map, collision register, protected system comparison, STAT and Drills adapter reports, DR-006, Critical Systems Contract, Matrix Runtime Lock, and current I1Q tests.

## Findings

No dependent product has a complete before, after, rollback, and reapply certification for I1Q. Existing routes were not modified by this agent, but unchanged is not equivalent to tested green. The four protected source-to-CDN hash divergences prevent tracked runtime files from serving as authoritative baselines.

## Protected Baseline

| Product | Current evidence | Regression verdict | Required owner action |
| --- | --- | --- | --- |
| Matrix | No Matrix path touched; no current workflow smoke | UNCHANGED, NOT TESTED | Matrix owner runs guard preflight and required App Mode journeys on the certified commit |
| Arena | Runtime markers reachable; tracked and deployed hashes differ | ACTIVE, SOURCE AUTHORITY UNRESOLVED | Arena owner identifies deployed source commit, registers hash, preserves rollback bytes, and runs authenticated browser smoke |
| STAT | Runtime markers reachable; tracked and deployed hashes differ; I1Q flag off | ACTIVE, NOT I1Q-CERTIFIED | STAT owner resolves source hash and canon collisions, then runs sealed-pack, answer secrecy, choice order, old-attempt, and Arena-entry tests |
| Drills | Runtime markers reachable; tracked and deployed hashes differ; I1Q flag off | ACTIVE, NOT I1Q-CERTIFIED | Drills owner resolves source and ingestion authority, then runs registry, launch, return, source-availability, and no-mutation tests |
| Daily Rounds | Runtime markers reachable; tracked and deployed hashes differ | ACTIVE, NOT I1Q-CERTIFIED | Daily owner certifies the five-field contract, Drills launch and return, and current source hash |
| WordPress auth | Wrapper and unauthenticated endpoint reachable; authenticated flow not run | ACTIVE, AUTH BASELINE INCOMPLETE | WordPress and HQ owners run login, handoff, replay, expiry, logout, proxy, and failure tests |
| MissionMed HQ | Source risks and manifest drift remain; no I1Q integration | PROTECTED, NOT CERTIFIED | HQ/Auth owner resolves expiry, configured-secret, CORS, manifest, and rollback gates through the Critical Systems process |
| RANKLISTIQ | Authorized target; no I1Q migration or RLS execution | NOT TESTED | Data owner supplies project-pinned workflow and executes preview RLS, migration, rollback, reapply, Arena, and STAT tests |

## Four Protected Hash Divergences

| Surface | Tracked SHA-256 | Deployed SHA-256 |
| --- | --- | --- |
| Arena | `2b881db56490a3fe10f950bab2e3b744a7d00960a515797c91c53b190440750a` | `7bb0ad1cf1cf9e3d1fbaa021606d98fbd0000b2b0cac3898bce6c73225a37705` |
| STAT | `350108cc24edd44c885061aa084763e7613102cf3c41eb8e8d8c324242c08d75` | `77303e6352d2bffa8ec0e7ce3ec1709fa559e0b13201188b59fdca29af885425` |
| Drills | `cd79a2f1c822214643f58347fe8abd0fe5cfc0342caa39523a56fb81fb2ad91d` | `c480c014d405a65d6b1b4ff47e613d476383de8aba018a654375e25a07b261cc` |
| Daily | `aa7b7ff42f51f85c8af6b8953eac26c65f75c223818706fb08818a47df49e5af` | `409a89d01f072f8412f0259ea9b870bc62800b96f30cfd5580a3b223253ec6b7` |

Runtime truth wins. The tracked files are not a valid rollback baseline until each owner reconciles the deployed artifact to authoritative source.

## Required Before-And-After Evidence

Each owner must record a pre-deploy baseline on the exact protected runtime, rerun it after staging deployment, after staging rollback, after reapply, after production promotion, and after any production rollback. Results must name the I1Q commit, artifact hashes, migration hashes, consumer source hash, and test outcomes.

## Changes Proposed Or Made

Made only this regression report. Proposed owner actions above. No dependent source, route, cache, datastore, workflow, or flag was changed.

## What Was Not Run

No authenticated dependent-product journey, browser workflow, Matrix guard, RLS test, sealed-pack regression, old-attempt join, Drills launch, Daily return, WordPress login, HQ auth flow, protected rollback, or post-rollback check was run by this agent.

## Tests Performed

No dependent-product test was performed by this agent. The Root protected comparison previously performed static validation and read-only route and marker checks, but authenticated workflows, browser journeys, answer isolation, source parity, rollback, and post-rollback tests were not run.

## Risks

Calling unchanged products green would conceal missing regression evidence. Deploying tracked protected bytes could overwrite newer runtime-only behavior. Shared auth or datastore changes could affect all consumers.

## Blockers

Four source hash divergences, missing named owners for some boundaries, auth defects, no fixed I1Q commit, no staging route, no rollback execution, and no post-change baseline.

## Confidence

High, `0.99`, in the reported hash divergence and incomplete certification. No claim is made about current runtime behavior beyond the recorded Root comparison.

## Exact Paths

- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/I1Q_1007X_PROTECTED_SYSTEM_COMPARISON.md`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/agents/ecosystem_mapper/protected_consumers_matrix.md`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/agents/ecosystem_mapper/collision_risk_register.md`
- `/Users/brianb/MissionMed/_SYSTEM/KNOWN_GOOD/MATRIX_RUNTIME_LOCK_PROTOCOL.md`

## Root Handoff

Root must keep every consumer flag off, obtain owner-certified source hashes and baselines, and require the complete before, after, rollback, and reapply matrix before any dependent-product green claim.

============================================================
FILE: agents/release_reliability/deployment_plan.md
============================================================
# I1Q-1007X Deployment Plan

Date: 2026-07-15

Status: `FUTURE PLAN ONLY. NOT AUTHORIZED FOR EXECUTION.`

## Scope Completed

Defined the exact future GitHub-controlled promotion sequence allowed by DR-006 without inventing a host, provider state, workflow name, project reference, credential, environment value, or URL. No deployment or Git action was performed.

## Evidence Inspected

DR-006, the Question Platform passport, MR-078A, MR-078B, MR-079, the Critical Systems Contract, the 1006 staging and canary section, the 1007X deployment route map, protected comparison, collision register, current migration candidates, rollback design, application package, and evidence manifests.

## Findings

No current route meets DR-006. The repository has no auditable I1Q GitHub workflow, dedicated runtime binding, canonical host, approved identity resolver, project-pinned RANKLISTIQ promotion path, monitoring target, or rollback selector. The worktree is not a clean green release candidate.

## Required Preconditions And Evidence

1. Root freezes one clean reviewed release commit after every local test and the evidence validator pass.
2. The I1Q owner registers a dedicated build context and internal destination. The root HQ start command must not be reused accidentally.
3. The auth owner supplies a canonical identity-resolver contract and clears shared HQ expiry, configured-secret, CORS, revocation, CSRF, and outage gates.
4. The Data owner supplies the exact RANKLISTIQ project and migration route through a protected GitHub workflow. No project value belongs in this report.
5. The migration set includes a correctly named forward migration and any reviewed forward compensating migration. Every byte is tracked and reviewable.
6. Preview evidence proves migration history alignment, backup, apply, lint, diff, RLS, transaction-local identity, pool isolation, audit immutability, and repeatability.
7. Protected owners reconcile the four deployed CDN hashes to authoritative source commits and preserve rollback artifacts.
8. Staging proves authenticated workflows, negative auth, answer and source isolation, privacy, accessibility, performance, dependent products, rollback, reapply, and monitoring.
9. A fresh independent red team clears the exact commit and artifacts.
10. Root records final approval. Student, STAT, Drills, internal platform, and internal review flags remain off in this blocked cycle.

## Exact Future Canonical GitHub Sequence

The sequence below is exact. Workflow file names, GitHub environment names, service identifiers, provider project identifiers, hostnames, and URLs must be supplied and approved by their owners before step 1 can execute.

1. Open a pull request containing only the frozen I1Q release commit, canonical workflow registration, service registration, migration files, monitoring declaration, rollback declaration, tests, and evidence schema changes.
2. GitHub CI checks out the exact pull-request SHA and records it.
3. CI verifies clean dependency resolution, source and artifact checksums, secret-pattern absence, migration naming and history rules, unit tests, security regressions, privacy regressions, adapter tests, UI tests, accessibility checks, and evidence validation.
4. A protected GitHub preview job records the approved RANKLISTIQ target identity without exposing values, captures migration history and backup evidence, and applies only the reviewed forward migration.
5. The preview job runs schema, forced-RLS, role, assignment, IDOR, GUC-spoof, pooled-context, audit, immutability, answer-isolation, source-isolation, and query-plan tests.
6. The preview job executes the reviewed forward compensation, verifies every flag is false and protected records remain intact, reapplies the intended migration sequence, and reruns the preview tests.
7. After required review approval, merge the pull request without force push or history rewrite.
8. A protected GitHub staging promotion uses the same build artifact and commit SHA, applies the already-reviewed migration sequence, deploys the dedicated I1Q service, and records artifact checksums.
9. Staging runs authenticated end-to-end role journeys, failure states, browser and accessibility checks, answer and source leak attacks, audit verification, and dependent-product smokes.
10. Staging executes application rollback plus forward database compensation when required, verifies health and dependent products, reapplies the exact intended artifact and migration chain, and reruns all staging checks.
11. A fresh independent release review signs the exact staging commit, migration hashes, artifact hashes, rollback evidence, monitoring evidence, and smoke results.
12. A separately approved protected GitHub production promotion captures backups and rollback identities, applies the reviewed forward migration, and promotes the same staging-certified artifact.
13. Production checksum, health, canonical auth, roles, answer isolation, source isolation, audit, and dependent-product smokes run with all flags false.
14. Monitoring delivery is proven. Any failure invokes the rollback plan. No cache change is permitted unless the registered workflow documents and verifies it.
15. Root files the deploy manifest. State C and any flag enablement require a later explicit verdict, not this plan.

## What Was Not Run

No pull request, GitHub workflow, preview job, staging promotion, production promotion, backup, migration, deploy, smoke, rollback, reapply, monitor, cache action, or flag action was run. No deployment URL exists in inspected evidence.

## Changes Proposed Or Made

Made only this plan. Proposed future owner registration and the sequence above. No workflow or runtime file was created.

## Tests Performed

Local test execution failed at 134 of 144 passing. The focused set failed at 107 of 114 passing. Evidence validation failed with 13 errors. These failures stop the sequence before GitHub CI.

## Risks

The current repository lacks a workflow and dedicated service binding. Root Railway configuration starts HQ, and protected consumer source hashes diverge from runtime. A guessed route could redeploy a protected service or use the wrong datastore.

## Blockers

No canonical host, workflow, auth resolver, RANKLISTIQ route, monitoring destination, rollback selector, or clean green release commit is proven.

## Confidence

High, `0.98`, that the sequence conforms to the inspected authority. Confidence is `0.00` that any unspecified external binding currently exists.

## Exact Paths

- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/agents/ecosystem_mapper/deployment_route_map.md`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/railway.json`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/i1q-question-platform/package.json`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/i1q-question-platform/db/migrations/20260715122434_i1q_1007x_question_platform.sql`

## Root Handoff

Root's exact operator action now is `HOLD`. Do not create or trigger a deployment. Obtain owner-supplied route records, freeze a green commit, and begin the future sequence only through the registered GitHub workflow.

============================================================
FILE: agents/release_reliability/monitoring_plan.md
============================================================
# I1Q-1007X Monitoring Plan

Date: 2026-07-15

Status: `DESIGN REQUIRED. TARGET AND ALERT ROUTE NOT PROVEN.`

## Scope Completed

Defined the minimum future monitoring evidence for preview, staging, rollback, and internal production without naming an unproven provider, host, URL, account, channel, or environment value. No monitor was configured or queried.

## Evidence Inspected

DR-006, the Question Platform passport, 1006 health and deployment evidence, current deployment map, ecosystem graph, auth map, security and privacy verdicts, protected runtime comparison, and application health behavior.

## Findings

No I1Q monitoring destination, probe identity, alert route, runbook, retention decision, staging baseline, threshold set, or alert-delivery proof is present. The local synthetic health artifact is not operational monitoring evidence.

## Required Monitoring Signals

| Domain | Required signal | Fail-closed action |
| --- | --- | --- |
| Availability | Health response, service identity, version, commit, artifact hash | Stop promotion or invoke rollback |
| Authentication | Success, unauthenticated denial, expired and revoked denial, logout denial, adapter outage | Disable I1Q and page auth owner |
| Authorization | Wrong-role, cross-assignment, IDOR, CSRF, hostile-origin denial | Disable I1Q and invoke security incident |
| Datastore | Migration version, schema identity, connection errors, RLS denials, pool-context isolation | Stop promotion; compensate only through GitHub |
| Answer isolation | Pre-answer answer-alias and answer-value probes | Immediate disable and security incident |
| Source isolation | Raw transcript, private reference, student, patient, and third-party leak probes | Immediate disable and privacy incident |
| Audit integrity | Chain continuity, rejected update/delete, release evidence identity | Stop writes and investigate |
| Feature flags | Exact state of all six flags | Any unexpected true value blocks release |
| Queues | Depth, oldest age, retry, dead-letter, duplicate, checkpoint progress | Pause extraction and investigate |
| Performance | Request latency, error count, database latency, queue throughput | Thresholds must be based on staging evidence |
| Dependencies | Canonical auth, RANKLISTIQ, Matrix, Arena, STAT, Drills, Daily, WordPress, HQ | Stop promotion on failed owner baseline |
| Drift | Deployed artifact hash, workflow SHA, migration hash, protected consumer hash | Stop promotion and preserve runtime truth |

## Required Alert Evidence

- Named monitoring owner and incident owner.
- Registered monitor destination and authenticated probe identity.
- No secrets or source content in labels, payloads, logs, or screenshots.
- Alert rules versioned with the deployment workflow.
- One synthetic alert delivered and acknowledged in staging.
- One rollback-trigger alert delivered during the staging drill.
- Runbook links recorded in the release manifest.
- Retention and access rules approved for auth, source, answer, and audit telemetry.

Rate and latency thresholds are intentionally not invented. Root must derive and approve them from representative staging observations. Binary invariants, including health failure, hash drift, answer leakage, source leakage, audit break, and any unexpected enabled flag, are immediate failures.

## All-Flags-Off Check

The required current state is:

- `internal_platform_enabled = false`
- `internal_review_enabled = false`
- `student_content_enabled = false`
- `student_release_enabled = false`
- `stat_adapter_enabled = false`
- `drills_adapter_enabled = false`

No runtime target was queried, so runtime flag state is not claimed. No flag was changed.

## What Was Not Run

No monitor creation, health polling of an I1Q staging or production service, alert delivery, log query, dashboard query, telemetry join, paging test, incident drill, or rollback observation was run.

## Changes Proposed Or Made

Made only this plan. Proposed owner registration of monitoring as part of the canonical GitHub workflow before staging.

## Tests Performed

The current local health evidence is a 1006 synthetic demo result and does not prove monitoring. Current local tests and evidence validation fail. No deployed monitoring test was performed.

## Risks

Without a destination and alert route, deployment could fail silently. Logging raw source, answer, session, or credential material would create a separate privacy or security incident.

## Blockers

No canonical host, monitoring target, probe identity, alert destination, retention decision, runbook, thresholds, or delivery proof exists.

## Confidence

High, `0.97`, that these are the minimum monitoring domains. Confidence is `0.00` that monitoring is operational.

## Exact Paths

- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/i1q-question-platform/evidence/health_check_results.json`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/i1q-question-platform/evidence/deployment_manifest.json`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/agents/ecosystem_mapper/ecosystem_dependency_graph.md`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/agents/ecosystem_mapper/auth_and_bootstrap_map.md`

## Root Handoff

Root must treat monitoring as blocked, assign an owner, register the real target through the protected workflow, prove alert delivery in staging, and attach the result before requesting release certification.

============================================================
FILE: agents/release_reliability/production_smoke_results.md
============================================================
# I1Q-1007X Production Smoke Results

Date: 2026-07-15

Result: `NOT RUN. NO I1Q PRODUCTION TARGET PROVEN.`

## Scope Completed

Reviewed available local, historical, and protected-runtime evidence and classified which checks were actually performed. No production read or write was performed by this agent.

## Evidence Inspected

1006 health, browser, security, deployment, and rollback evidence; current protected system comparison; deployment and auth maps; application server source; tests; evidence validator output; and current Git status.

## Findings

| Production smoke | Result |
| --- | --- |
| I1Q production URL | NOT PROVEN |
| I1Q deployed artifact and checksum | NOT PROVEN |
| I1Q health | NOT RUN |
| Canonical authenticated entry | NOT RUN |
| Expired and revoked session denial | NOT RUN |
| Role matrix | NOT RUN |
| CSRF and hostile-origin denial | NOT RUN |
| Answer-leak attack | NOT RUN |
| Source and transcript leak attack | NOT RUN |
| Audit append and immutability | NOT RUN |
| RLS and direct API denial | NOT RUN |
| Feature flags | NOT QUERIED; required false |
| Rollback and reapply | NOT RUN |
| Monitoring and alert delivery | NOT RUN |
| Dependent-product post-deploy smoke | NOT RUN |

The recorded `200` health result in `health_check_results.json` is a local synthetic 1006 demo with mode `LOCAL_SYNTHETIC_DEMO`. It is not staging or production evidence. The protected comparison reached existing Arena, STAT, Drills, Daily, WordPress wrappers, and an unauthenticated auth endpoint, but it did not exercise an I1Q production service or authenticated workflow.

## Protected Runtime Observation

The existing protected routes were reachable at the time of the Root comparison and runtime markers passed. All four tracked-to-CDN hashes failed parity. This is baseline evidence only, not an I1Q production smoke pass.

## What Was Not Run

No URL was opened, no provider was queried, no credential was used, no environment value was read, no API was called, no production database was queried, no feature flag was read or changed, and no deployment or rollback occurred in this release review.

## Changes Proposed Or Made

Made only this results report. Proposed that future production smokes execute only after staging certification and through the registered GitHub workflow against the exact promoted artifact.

## Tests Performed

- Local full suite: FAIL, 134 of 144 pass.
- Focused suite: FAIL, 107 of 114 pass.
- Evidence validator: FAIL, 13 errors.
- Production smoke tests: NONE.

## Risks

Treating local synthetic health or protected route reachability as I1Q production proof would create a false State C claim. Running against a guessed host or provider would violate the no-invention and protected-route gates.

## Blockers

No certified commit, deployed artifact, canonical host, auth resolver, migration proof, monitoring target, or rollback route exists. Current local validation is red.

## Confidence

High, `0.99`, that no I1Q production smoke evidence exists in the inspected packet.

## Exact Paths

- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/i1q-question-platform/evidence/health_check_results.json`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/i1q-question-platform/evidence/deployment_manifest.json`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/I1Q_1007X_PROTECTED_SYSTEM_COMPARISON.md`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/i1q-question-platform/src/server.mjs`

## Root Handoff

Root must report production smoke as `NOT RUN`, provide no staging or production URL, keep State C vetoed, and keep every flag off.

============================================================
FILE: agents/release_reliability/release_verdict.md
============================================================
# I1Q-1007X Release Verdict

Date: 2026-07-15

Verdict: `BLOCK. STATE C INTERNAL_PRODUCTION_LIVE REMAINS VETOED.`

Highest proven state: `STATE A REAL_CORPUS_INVENTORIED`.

## Scope Completed

Completed the release, reliability, deployment, rollback, monitoring, production-smoke, and dependent-product gate review using read-only local evidence. Created only the eight assigned release-reliability reports. No Git, network deployment, production read or write, secrets or environment read, SQL application, feature change, runtime change, cache change, or flag change was performed.

## Evidence Inspected

The full task prompt; BOOT-routed I1Q mission and product authority; DR-006; Question Platform passport; MR-078A, MR-078B, MR-079, Critical Systems Contract, Matrix Runtime Lock; 1006 combined handoff; current Root 1007X reports; ecosystem mapper reports; security, privacy, UX, and accessibility verdicts; protected comparison; current I1Q source, migrations, rollback, tests, evidence; and point-in-time Git status.

## Findings

- Mission registration and DR-006 are filed, but their release gates are not satisfied.
- The real corpus inventory supports State A only. Privacy normalization, real pilot, batch extraction, and physician approval are not complete.
- The worktree is not a clean release commit and changed during inspection as other agents worked.
- Current local tests fail: 134 of 144 pass.
- The focused security, privacy, adapter, and validator set fails: 107 of 114 pass.
- Evidence validation fails with 13 stale or incomplete evidence errors.
- The newer untracked offline migration candidate has not run and references a compensation file that is absent.
- No canonical I1Q host, auth resolver, RANKLISTIQ workflow, GitHub staging or production workflow, monitoring target, or executable rollback route is proven.
- No preview migration, RLS test, staging E2E, rollback, reapply, production deployment, production smoke, or monitoring delivery occurred.
- Arena, STAT, Drills, and Daily tracked source hashes all diverge from deployed CDN hashes.
- Protected dependent products are unchanged by this agent, not certified green.
- Security, privacy, UX, and accessibility vetoes have not been superseded by fresh fixed-commit approvals.

## State Ruling

| State | Result | Reason |
| --- | --- | --- |
| State A, real corpus inventoried | ACHIEVED by Root evidence | 97 source rows and referenced transcript and nodes artifacts inventoried read-only |
| State B, real candidate bank ready | NOT ACHIEVED | Privacy working copies, pilot thresholds, and batch extraction not complete |
| State C, internal production live | VETOED | No certified route, auth, datastore, staging, rollback, monitoring, or smoke evidence |
| State D, approved content production live | PROHIBITED | Medical governance unassigned and zero credentialed physician-approved real revisions |

## Required Flag State

All flags remain off:

- `internal_platform_enabled = false`
- `internal_review_enabled = false`
- `student_content_enabled = false`
- `student_release_enabled = false`
- `stat_adapter_enabled = false`
- `drills_adapter_enabled = false`

These are required values, not a claim that an unproven runtime was queried. No flag was changed.

## Exact Operator Actions

1. Hold deployment and all flag activation.
2. Freeze one clean integrated commit only after the local suite and evidence validator pass.
3. Have the protected product owners reconcile the four deployed hashes to authoritative source commits and preserve current deployed bytes as rollback artifacts.
4. Have the HQ/Auth owner provide and certify the canonical resolver after shared auth defects are closed.
5. Have the Data owner provide the canonical project-pinned RANKLISTIQ GitHub migration route and complete forward compensation pair.
6. Have the Release owner register the dedicated I1Q destination, protected GitHub staging and production workflow, monitoring target, alert route, and rollback selector.
7. Execute preview migration, RLS, rollback, reapply, and dependent baselines through that workflow.
8. Execute staging E2E, privacy, security, accessibility, UX, performance, monitoring, and dependent-product gates on the exact commit.
9. Obtain fresh independent red-team and release clearance.
10. Return to Root for a new verdict. Do not infer or invent any URL or provider state.

## What Was Not Run

No network deployment, production read or write, secrets or environment read, SQL application, feature change, runtime change, cache operation, Git action, staging deployment, production deployment, rollback, reapply, monitor query, production smoke, authenticated consumer smoke, or physician review was run by this agent.

## Changes Proposed Or Made

Made exactly these eight reports under the assigned directory. Proposed the future gated sequences in this packet. No application, migration, test, evidence, authority, protected, or Git state was modified by this agent.

## Tests Performed

- `npm test`: FAIL, 144 total, 134 pass, 10 fail.
- Focused local test command: FAIL, 114 total, 107 pass, 7 fail.
- `npm run validate`: FAIL, 13 errors.
- Release execution tests: NONE.

## Risks

Highest risks are false production certification, wrong-service deployment, wrong-project migration, unproven auth, answer or source disclosure, stale evidence, invalid rollback assumptions, protected-runtime regression, and silent failure without monitoring.

## Blockers

The blockers are current local failures, incomplete evidence, absent canonical routes, unresolved protected hashes, unexecuted datastore and rollback proof, missing monitoring, incomplete privacy and UX gates, and absent independent clearance.

## Confidence

High, `0.99`, in the `BLOCK` verdict and State A ceiling. Reservations are limited to external runtime and provider state that was intentionally not queried.

## Exact Paths

- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/agents/release_reliability/`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/I1Q_1007X_TRUE_BLOCKERS.md`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/I1Q_1007X_PROTECTED_SYSTEM_COMPARISON.md`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/agents/ecosystem_mapper/deployment_route_map.md`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/i1q-question-platform/`

## Root Handoff

Root Supervisor must carry forward `BLOCK`, State A as the highest proven state, State C vetoed, State D prohibited, no URLs, no deployment manifest claim, rollback `NOT RUN`, monitoring `NOT PROVEN`, dependent products `NOT CERTIFIED`, and every flag off.

============================================================
FILE: agents/release_reliability/rollback_plan.md
============================================================
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

============================================================
FILE: agents/release_reliability/rollback_results.md
============================================================
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

============================================================
FILE: agents/release_reliability/staging_certification.md
============================================================
# I1Q-1007X Staging Certification

Date: 2026-07-15

Verdict: `NOT CERTIFIED. STATE C VETOED.`

## Scope Completed

Performed a read-only release gate review of the current I1Q worktree, MissionMed OS authority, the 1006 combined handoff, current 1007X Root reports, ecosystem maps, specialist verdicts, protected runtime comparison, application source, migrations, tests, evidence, and Git status. No staging, production, datastore, protected runtime, cache, feature flag, or Git action was performed.

## Evidence Inspected

- MissionMed OS BOOT, CURRENT, mission record, Question Platform passport, DR-006, MR-078A, MR-078B, MR-079, Critical Systems Contract, and Matrix Runtime Lock authority.
- 1006 combined handoff with verified SHA-256 `ad311340c8ecbe7abf4f077fa92dc1ef32760d65bbac4ab9a70b76b4fe379572`.
- Current 1007X baseline, registration, authority, ecosystem, protected comparison, corpus, privacy, pilot, adapter, blockers, and owner-action reports.
- Ecosystem deployment, auth, protected-consumer, and collision reports.
- Security, RLS, answer-isolation, privacy, UX, accessibility, and responsive verdicts.
- Current application source, two migration candidates, rollback design, tests, evidence manifests, and point-in-time Git status.

## Findings

| Required gate | Result | Evidence required to pass |
| --- | --- | --- |
| Clean release commit | FAIL | One frozen reviewed commit with a clean worktree and all required files tracked |
| Canonical GitHub staging route | FAIL | Owner-approved workflow, protected environment, build root, artifact identity, and promotion record |
| Canonical I1Q host | FAIL | Registered dedicated internal destination and route ownership |
| Canonical auth resolver | FAIL | Root-approved resolver contract plus expiry, revocation, logout, CSRF, CORS, outage, and role tests |
| RANKLISTIQ migration route | FAIL | Explicit project pin, migration history proof, preview apply, diff, lint, and approval evidence |
| Migration proof | FAIL | Successful preview and staging apply on the exact migration bytes |
| RLS proof | FAIL | Executed deny, cross-role, cross-assignment, spoof, pool-reuse, immutability, and audit tests |
| Security proof | FAIL | Fresh independent approval on the fixed integrated commit |
| Privacy proof | FAIL | Governed working-copy run and passing per-class pilot for all 97 sources |
| Accessibility and UX proof | FAIL | Reproducible WCAG 2.2 AA, responsive, keyboard, assistive-technology, and board evidence |
| Dependent-system baseline | FAIL | Owner-certified protected hashes and authenticated baseline tests |
| Rollback and reapply | FAIL | Executed staging disable, artifact rollback, forward compensation where needed, reapply, and post-tests |
| Monitoring target | FAIL | Named owner, destination, checks, alerts, runbook, and alert-delivery proof |
| Staging E2E | NOT RUN | Authenticated role journeys, leak tests, audit checks, and failure-state journeys |
| Feature flags | HOLD OFF | All flags must remain false; no runtime flag state was queried or changed |

The four protected LIVE source-to-CDN hashes diverge for Arena, STAT, Drills, and Daily. Tracked `LIVE/` bytes cannot be used as staging, deployment, or rollback truth.

## Changes Proposed Or Made

Made only this certification report. Proposed that Root freeze one integrated commit only after the local suite and evidence validator are green, then obtain the missing owner-supplied workflow, auth, datastore, protected-baseline, rollback, and monitoring records before requesting certification again.

## What Was Not Run

No authenticated browser journey, preview or staging database action, RLS execution, GitHub workflow, deployment, rollback, reapply, production smoke, dependent-product workflow, monitoring query, cache action, or feature-flag action was run.

## Tests Performed

- `npm test`: FAIL, 144 tests, 134 pass, 10 fail.
- Focused adapter, security, privacy, and evidence-validator tests: FAIL, 114 tests, 107 pass, 7 fail.
- `npm run validate`: FAIL with 13 stale or incomplete evidence errors.
- No authenticated browser, Postgres, RLS, staging, deployment, rollback, reapply, production, or monitoring test was run.

## Risks

- A deployment from the root Railway configuration could start HQ instead of I1Q.
- An unproven auth bridge could accept invalid identity or broaden shared auth behavior.
- A wrong-project or untracked migration could damage protected migration history.
- Tracked protected consumer files are older or otherwise different from runtime truth.
- Stale evidence could falsely report green status for changed code.

## Blockers

The canonical host, identity resolver, GitHub staging and production workflow, RANKLISTIQ promotion route, monitoring target, and executable rollback route are unproven. Current local tests and evidence validation also fail. Security, privacy, UX, and accessibility vetoes have not been replaced by fresh approvals.

## Confidence

High, `0.99`, that staging is not certifiable from the inspected evidence. No confidence is assigned to provider or runtime state that was not inspected.

## Exact Paths

- `/Users/brianb/MissionMed_OS/decisions/DR-006_i1q_question_platform_internal_integration.md`
- `/Users/brianb/MissionMed_OS/PRODUCT_PASSPORTS/question-platform.md`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/I1Q_1007X_PROTECTED_SYSTEM_COMPARISON.md`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/agents/ecosystem_mapper/deployment_route_map.md`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/i1q-question-platform/`

## Root Handoff

Root must retain the State C veto, keep every flag off, prevent staging promotion, and request a new certification only after all gate evidence above is attached to one clean fixed commit.

============================================================
FILE: agents/security_integrated/answer_isolation_report.md
============================================================
# I1Q-1007X Integrated Answer Isolation Report

## Current Scope

This report examines ordinary reads, pre-answer output, post-answer finalization, database answer storage, restricted source storage, channel artifact creation, and feature-gate enforcement.

## Evidence

Positive local evidence:

- `item_revisions` is answer-free in the timestamped SQL.
- Answer, explanation, rationale, teaching, and voice-note fields are stored in `item_revision_answers`.
- The answer table and restricted source table have no direct select policy.
- Generic application responses recursively remove answer and rationale aliases.
- Class A generation uses closed-world schemas and a recursive key and value scanner.
- Post-answer access requires a WeakSet-bound trusted finalization context tied to actor, session, release, and channel.
- Synthetic tests reject caller phase strings, nonparticipants, nested answer aliases, and generic artifact reads.

## Findings

### ASI-001 Revoked reviewer retains SQL answer access

Severity: P1.

The assignment path in `i1q.read_item_revision_answers` accepts an `accepted` or `completed` assignment with the matching actor, review type, and revision hash. It does not call `i1q.has_active_role(assignment.required_role)`. A reviewer whose role membership was revoked or expired can therefore continue to read answers while the identity remains valid. Medical answer access also does not require the reviewer credential to remain current.

### ASI-002 Consumer flags do not gate application delivery

Severity: P1.

`artifactForPhase` enforces phase roles and finalization but does not check `stat_adapter_enabled` or `drills_adapter_enabled`. The independent synthetic probe returned a `stat_pre_answer` artifact while every release-restricted flag was false.

### ASI-003 SQL artifact creation permits security-label confusion

Severity: P1.

`i1q.create_channel_artifact` checks that a referenced policy exists and is active, but it does not bind the policy channel to the requested channel, phase, or data class. It stores arbitrary JSON without a Class A leak validator. A release manager or system path could create an answer-bearing payload labeled `pre_answer` and `A`.

### ASI-004 Runtime datastore isolation is not connected

Severity: P1.

The HTTP service constructs a `MemoryRepository` and never wires the PostgreSQL adapter. The strong SQL separation therefore cannot protect the current service process.

### ASI-005 Source metadata is not assignment scoped in memory

Severity: P1.

An unassigned `read_only` actor received a source record in the synthetic probe. Private storage fields were removed, which is positive, but the cross-record metadata exposure still disproves assignment-scoped isolation.

### ASI-006 Release validation does not prove leak tests

Severity: P1.

Both application and SQL validation paths accept any nonempty list whose caller labels as passing. They do not require the official leak-test identifiers, one result per artifact, or a stored result set bound to the evidence hash. Independent-actor and manifest checks therefore do not prove answer isolation.

## Changes

None. No artifact, answer, source, application, test, SQL, or feature-flag state was changed.

## Tests

The current focused integrated suite passed 112, failed 6, and skipped one database case. The independent attack probe reproduced the consumer flag and cross-record read failures. No real answer or transcript text was used.

## Risks And Blockers

Answer isolation is not cleared for staging or production. Required repairs are active-role and credential checks in the SQL answer reader, exact channel-policy binding with Class A validation, official stored validation checks, consumer-flag enforcement at the server and database boundaries, and wiring to the approved RLS repository.

## Confidence

High, `0.98`, for the local positive and negative findings. Database runtime behavior remains unknown.

## Paths

- `i1q-question-platform/src/platform.mjs`
- `i1q-question-platform/src/auth.mjs`
- `i1q-question-platform/src/exports.mjs`
- `i1q-question-platform/src/adapters/stat-v1.mjs`
- `i1q-question-platform/db/migrations/20260715122434_i1q_1007x_question_platform.sql`
- `i1q-question-platform/tests/security-regressions.test.mjs`
- `i1q-question-platform/tests/adapters.test.mjs`

## Root Handoff

Do not enable any consumer or student flag and do not claim no-answer-leak production proof. Repair ASI-001 through ASI-005, add revoked-role and mislabeled-payload tests, and repeat the test against the final database and HTTP deployment.

============================================================
FILE: agents/security_integrated/auth_test_matrix.md
============================================================
# I1Q-1007X Integrated Auth Test Matrix

## Current Scope

This matrix evaluates the HTTP and platform authorization mechanics at commit `4b154e8` and separates local synthetic proof from unavailable canonical-session proof.

## Matrix

| ID | Attack or condition | Expected | Evidence | Result |
| --- | --- | --- | --- | --- |
| AUTH-001 | No identity resolver | All protected APIs deny | Health test plus server source | PASS, 401 default |
| AUTH-002 | Resolver outage | Deny without internal detail | Security regression test | PASS |
| AUTH-003 | Resolver returns unvalidated context | Deny | Security regression test | PASS |
| AUTH-004 | Missing session object | Deny | Security regression test | PASS |
| AUTH-005 | Expired session | Deny | Security regression test | PASS |
| AUTH-006 | Revoked session | Deny | Security regression test | PASS |
| AUTH-007 | Stale validation timestamp | Deny | Security regression test | PASS |
| AUTH-008 | Future validation beyond skew | Deny | Source inspection | PASS by condition, not an independent request test |
| AUTH-009 | Unknown or empty roles | Deny | `normalizeActor` inspection and tests | PASS |
| AUTH-010 | Wrong application role | Deny workflow command | Platform tests | PASS for covered commands |
| AUTH-011 | Forged reviewer or actor ID | Deny | Security regression test | PASS |
| AUTH-012 | Assignment type swap | Deny | Security regression test | PASS |
| AUTH-013 | Exact revision hash swap | Deny | Security regression test | PASS |
| AUTH-014 | Direct self-review | Deny | Application and SQL inspection | PASS statically and in application tests |
| AUTH-015 | Direct delegated self-review | Deny | Application and SQL inspection | PASS for one delegation edge |
| AUTH-016 | Missing CSRF token | Deny mutation | Security regression test | PASS |
| AUTH-017 | Wrong CSRF token | Deny mutation | Security regression test | PASS |
| AUTH-018 | Missing, null, malformed, or untrusted Origin | Deny mutation | Security regression test and source inspection | PASS |
| AUTH-019 | Local demo in production | Deny | Security regression test | PASS |
| AUTH-020 | Local demo behind forwarded headers | Deny | Security regression test | PASS |
| AUTH-021 | Caller-supplied artifact phase | Cannot unlock post-answer | Security regression and adapter tests | PASS |
| AUTH-022 | Forged participant finalization | Deny | WeakSet-bound trusted context tests | PASS locally |
| AUTH-023 | Generic write mass assignment | Deny unknown fields without echo | Security regression test | PASS |
| AUTH-024 | Unassigned read-only actor requests draft revision | Deny by assignment or approved state | Independent attack probe | FAIL, draft returned |
| AUTH-025 | Internal API request while both internal flags are off | Deny | Independent attack probe | FAIL, dashboard HTTP 200 |
| AUTH-026 | Canonical WordPress and HQ session | Fresh actor and roles | No adapter or staging path | NOT RUN |
| AUTH-027 | Canonical logout and revocation | Immediate denial | No adapter or staging path | NOT RUN |
| AUTH-028 | Shared auth cookie, CORS, and session fixation | Secure under browser | No staging browser path | NOT RUN |

## Findings

The injected adapter boundary is intentionally strict, but the executable main entrypoint never supplies that adapter. Once a resolver is supplied, generic reads are not assignment scoped and internal flags do not gate the service. The safe no-resolver 401 behavior therefore cannot be used as evidence that an integrated service is authorized correctly.

The resolver is also the authority for I1Q roles, CSRF token, trusted origins, and participant finalization. No canonical implementation proves that these values are derived server-side from current MissionMed and I1Q records.

## Changes

None. The application and tests were read-only.

## Tests

The current integrated focused run passed 112 cases, failed 6 review-workflow cases, and skipped one database execution case. The core identity and CSRF cases remained green. The independent attack probe reproduced AUTH-024 and AUTH-025 with synthetic, non-medical data.

## Risks And Blockers

State C remains blocked by AUTH-024 through AUTH-028. The shared HQ defects already recorded by ecosystem mapping also require their own protected authority and regression process. This packet does not authorize shared-auth changes.

## Confidence

High, `0.98`, for the local auth results. Low for live auth because no canonical adapter, URL, session, or browser was available.

## Paths

- `i1q-question-platform/src/auth.mjs`
- `i1q-question-platform/src/server.mjs`
- `i1q-question-platform/src/platform.mjs`
- `i1q-question-platform/tests/security-regressions.test.mjs`
- `i1q-question-platform/tests/app.test.mjs`

## Root Handoff

Root should require an app-owned assignment filter for generic reads, an actual server feature-gate middleware, and a canonical resolver contract before any authenticated deployment attempt. Then rerun this matrix with real expiry, revocation, logout, CORS, and CSRF behavior on staging.

============================================================
FILE: agents/security_integrated/rls_test_matrix.md
============================================================
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

============================================================
FILE: agents/security_integrated/security_release_verdict.md
============================================================
# I1Q-1007X Integrated Security Release Verdict

## Verdict

`BLOCK`

Security does not clear staging, authenticated internal production, State C, any consumer enablement, or student publication. The highest security statement supported is `LOCAL_SYNTHETIC_MECHANICS_ONLY`.

## Current Scope

Reviewed commit: `ccb8b73899c81ba0d028638be0d79b6a351f0ceb`, plus the current uncommitted review-workflow delta with `platform.mjs` SHA-256 `121f4ac1ed0a13a6044b6c4e1370d76c6c7bf44afa8e2e1add9346ae190a828a`.

Reviewed offline datastore hashes:

- Migration: `9ccf9b29b402fb271e449be26d6b11deb496e834d3b7caa7ec875ba582749ca8`
- Compensation: `25e317428ca75c8cce29269e19c7002ea69860080aac7f59496312bbed34446a`
- Repository: `f4c5f6e3acffc0925c9c36a027471f5d02ec6606ea65ca7e48abfb701f7edee3`

No protected or production state was accessed or changed.

## Evidence

- Current focused integrated suite: 112 passed, 6 failed, 1 skipped out of 119.
- Prior committed full local suite before the current review-workflow delta: 194 passed, 0 failed, 1 skipped out of 195. This is not current green proof.
- Dependency audit: 0 vulnerabilities.
- Relevant secret-pattern scan: no findings.
- Independent synthetic attack probe: three release claims disproved.

## Findings

Release-blocking findings:

1. Unassigned read-only users can read unapproved revision and source metadata through generic memory-backed routes.
2. Internal platform and review flags do not gate the HTTP service.
3. STAT and Drills consumer flags do not gate artifact delivery.
4. The SQL answer reader does not revoke assignment-based answer access when the required role or medical credential ceases to be current.
5. SQL channel artifact creation does not bind the policy to channel, phase, data class, or Class A payload rules.
6. SQL publication checks only one of the two student flags.
7. The HTTP service is not wired to a canonical identity resolver or the RLS repository.
8. The migration, RLS, compensation, rollback, and reapply suite has not run against PostgreSQL.
9. No canonical unprivileged runtime role, grant manifest, migration route, staging URL, browser run, monitor, or rollback rehearsal exists.
10. Release validation accepts arbitrary caller-named checks rather than the complete official leak-test evidence.
11. Expired rights can remain release eligible, and shared metadata RLS is broader than the binding role sketch.
12. Compensation audit idempotence is not concurrency safe and several architecture-immutable record classes lack immutable triggers.
13. The current uncommitted open-assignment repair leaves six focused review tests failing.

Positive but insufficient findings:

- Expired, revoked, stale, missing, and outage identity contexts fail closed in local tests.
- CSRF and trusted-Origin mutation checks pass locally.
- Local demo is blocked in production and behind forwarded ambiguity.
- Self-review, reviewer impersonation, assignment swaps, and exact revision hash swaps are rejected in covered paths.
- Generic responses are answer-free and post-answer access requires trusted server finalization.
- The offline SQL uses `auth.uid()`, database-owned role membership, forced RLS, deny-by-default grants, immutable records, and preserving compensation.

## Changes

This specialist made no product, test, migration, evidence, flag, Git, provider, or production change. Exactly seven reports were created under `agents/security_integrated/`.

## Tests

The current focused run is red. Five platform review cases and one security review-swap case fail because assignments now begin open and are not accepted by the existing tests. The sole skipped case is also the only test that could exercise apply, reapply, role attacks, compensation, and reapply on PostgreSQL. Both conditions must be resolved before any RLS or rollback clearance.

## Risks And Blockers

The current safe 401 default is not an internal production application. Conversely, injecting an identity resolver into the current memory-backed service would expose the reproduced IDOR and flag bypasses. Neither state satisfies State C.

## Confidence

`97 percent` confidence in the BLOCK verdict. Reservation remains for behavior that could only be measured on the unavailable canonical database, identity, and staging routes.

## Paths

The complete evidence and repair paths are enumerated in `threat_model.md`, `auth_test_matrix.md`, `rls_test_matrix.md`, `security_attack_results.json`, `answer_isolation_report.md`, and `security_repairs.md` in this directory.

## Root Handoff

Root must preserve State A truthfulness, keep all flags off, implement every P1 repair, run the non-skipped database and browser matrices, and request a fresh independent security review on the exact commit proposed for staging. Security veto remains in force until then.

============================================================
FILE: agents/security_integrated/security_repairs.md
============================================================
# I1Q-1007X Integrated Security Repairs

## Current Scope

This is a repair specification only. The specialist was read-only outside this report directory and made no product change.

## Required Repairs

| ID | Priority | Repair | Required regression proof |
| --- | --- | --- | --- |
| REP-001 | P1 | Apply assignment-scoped filters to generic `list` and `get`, matching the SQL policies for revisions, sources, review records, candidates, and restricted operational records | Unassigned read-only, author, reviewer, and cross-assignment IDOR matrix |
| REP-002 | P1 | Add server middleware that denies operational routes unless `internal_platform_enabled` is true and denies review mutations unless `internal_review_enabled` is true | Flag-off HTTP 403 tests, ordered enablement tests, direct URL and direct API tests |
| REP-003 | P1 | Gate each STAT and Drills artifact route with its exact consumer flag in addition to phase and role | Flag-off artifact denial for every channel and phase |
| REP-004 | P1 | Require `has_active_role(assignment.required_role)` in SQL reviewer answer access; require current medical credential for medical review access; decide and encode whether completed assignments retain access | Revoked, expired, reassigned, completed, and credential-expired database attacks |
| REP-005 | P1 | Bind `channel_security_policies.channel` and immutable policy rules to requested channel, phase, and data class; validate Class A payload before insert | Mismatched policy and answer-bearing pre-answer SQL tests |
| REP-006 | P1 | Require both `student_content_enabled` and `student_release_enabled` for publication in application and SQL | One-flag-only negative tests at both layers |
| REP-007 | P1 | Mirror exact assembler, validator, medical ratifier, and publisher actor-separation rules in SQL | Same-actor promotion attacks for every transition |
| REP-008 | P1 | Implement and wire the canonical MissionMed identity resolver, credential verifier, publication ratification verifier, and participant finalization resolver | Live expiry, revocation, logout, outage, role, CSRF, Origin, and finalization matrix |
| REP-009 | P1 | Wire the application to the approved `PostgresRepository` through an unprivileged `NOBYPASSRLS` role and an owner-reviewed explicit grant manifest | Proof that HTTP requests exercise RLS, not memory-only authorization |
| REP-010 | P1 | Run migration apply, exact reapply, negative role attacks, compensation twice, rollback verification, and intended reapply on an isolated approved database | Complete non-skipped PostgreSQL suite and preserved logs |
| REP-011 | P2 | Add transitive delegation and conflict-graph checks or explicitly document a bounded one-edge policy | Multi-hop self-review attacks |
| REP-012 | P2 | Add real browser XSS, CORS, cookie, cache, path, CSP, zoom, and session tests on staging | Browser evidence tied to exact commit and URL |
| REP-013 | P1 | Require the complete official leak-test set, stored per-artifact results, and exact evidence-hash binding before validation can pass | Missing, duplicate, caller-invented, stale, and cross-release validation attacks |
| REP-014 | P1 | Reject expired rights in both application and SQL release assembly | Expired clearance with otherwise valid status must fail |
| REP-015 | P1 | Replace shared table-wide metadata RLS with own-lineage, assignment, governance, analytics, and incident scopes | Positive and negative role matrix for every metadata table |
| REP-016 | P2 | Make compensation audit idempotence concurrency safe with a database uniqueness or lock invariant | Two simultaneous compensation calls yield one exact event |
| REP-017 | P2 | Encode immutable Source Record, Privacy Redaction Record, and Extraction Run semantics and the approved revision lifecycle | Update, delete, retirement, supersession, and draft-freeze tests |
| REP-018 | P1 | Complete the current open-assignment application repair and update direct tests to accept assignments before review | Current focused and full suites return to zero failures |

## Evidence

REP-001 through REP-007 and REP-013 through REP-018 derive from direct source inspection, reproduced synthetic attacks, and the current failing test run. REP-008 through REP-010 derive from missing canonical integration and the skipped disposable PostgreSQL test. REP-011 and REP-012 are residual defense-in-depth and certification gaps.

## Findings

The candidate has strong local defensive primitives. The remaining defects are integration and policy-enforcement gaps, not reasons to weaken auth, RLS, immutable history, or protected consumer contracts.

## Changes

No repairs were implemented in this specialist pass.

## Tests

Every repair must add a direct negative regression test and then rerun the full application, adapter, privacy, evidence, migration, repository, protected-consumer, and independent red-team suites. Static tests alone cannot clear REP-008 through REP-010.

## Risks And Blockers

Root must coordinate REP-008 through REP-010 with the named identity, data, and deployment owners. Manual SQL, broad grants, service-role application traffic, direct production changes, and shared-auth weakening are prohibited shortcuts.

## Confidence

High, `0.97`, that the listed repairs cover every release-blocking security finding identified in this pass.

## Paths

The primary repair surface is app-owned: `i1q-question-platform/src/server.mjs`, `src/platform.mjs`, `src/postgres-repository.mjs`, and the timestamped migration plus tests. Shared systems require separate authority and are not part of this patch surface.

## Root Handoff

Implement REP-001 through REP-007 and REP-013 through REP-018 locally before requesting external integration. Keep all flags off. After owner-provided canonical routes exist, execute REP-008 through REP-012 and request a fresh independent security verdict.

============================================================
FILE: agents/security_integrated/threat_model.md
============================================================
# I1Q-1007X Integrated Threat Model

## Current Scope

This review covers commit `ccb8b73899c81ba0d028638be0d79b6a351f0ceb` plus the current uncommitted review-workflow delta. The current `platform.mjs` hash is `121f4ac1ed0a13a6044b6c4e1370d76c6c7bf44afa8e2e1add9346ae190a828a`. The datastore candidate is identified by these hashes:

- Forward migration: `9ccf9b29b402fb271e449be26d6b11deb496e834d3b7caa7ec875ba582749ca8`
- Compensating migration: `25e317428ca75c8cce29269e19c7002ea69860080aac7f59496312bbed34446a`
- PostgreSQL repository: `f4c5f6e3acffc0925c9c36a027471f5d02ec6606ea65ca7e48abfb701f7edee3`

The review was read-only outside this report directory. No application, test, migration, evidence, feature flag, Git, provider, secret, environment, or production state was changed.

## Protected Assets

1. Canonical MissionMed identity and session state.
2. I1Q role memberships, review assignments, and credential evidence.
3. Exact immutable Item Revisions and their review history.
4. Answer keys, explanations, rationales, and post-answer artifacts.
5. Restricted source references and privacy-safe working transcript data.
6. Release manifests, validation evidence, promotion chains, and feature flags.
7. Audit events and chain heads.
8. STAT sealed-pack secrecy and Drills source ownership.

## Trust Boundaries

| Boundary | Trusted input required | Current state | Security result |
| --- | --- | --- | --- |
| Browser to I1Q HTTP service | Fresh canonical session, server-derived roles, trusted Origin, session-bound CSRF | Resolver interface exists, canonical resolver does not | Fail closed but not deployable |
| I1Q service to datastore | Canonical actor, unprivileged role, forced RLS, fixed RPC grants | Offline SQL and adapter only | Not runtime proven |
| Review workflow | Assignment, reviewer, actor, role, credential, and exact revision hash | Strong application and SQL checks | Mechanically strong, live identity absent |
| Answer access | Purpose, actor, active role, assignment, revision, finalization | App isolation tests pass; SQL assignment branch omits active-role check | Release blocker |
| Source access | Privacy or system role, restricted purpose, audit | SQL reader is role and purpose scoped | Static only |
| Release artifact creation | Exact policy, channel, phase, data class, payload validation, flags | SQL does not bind policy to artifact fields or scan Class A payload | Release blocker |
| Consumer delivery | Correct phase plus enabled exact consumer flag | Application artifact route ignores consumer flags | Release blocker |
| Publication | Both student flags, exact evidence, independent actors, Brian ratification | Application locks both flags; SQL checks only `student_release_enabled` | Contract drift blocker |
| Rollback | Canonical migration owner and fixed compensating command | Preserving compensation exists | Not executed |

## Threat Findings

| ID | Threat | Severity | Evidence | Result |
| --- | --- | --- | --- | --- |
| SEC-INT-001 | Cross-record read and IDOR | P1 | `QuestionPlatform.list` and `get` require only a generic read role for most entities | Reproduced: unassigned `read_only` actor received one draft revision and one source record |
| SEC-INT-002 | Internal feature-gate bypass | P1 | Server routes do not check `internal_platform_enabled` or `internal_review_enabled` | Reproduced: dashboard returned HTTP 200 with no enabled internal flags |
| SEC-INT-003 | Consumer feature-gate bypass | P1 | `artifactForPhase` does not check STAT or Drills flags | Reproduced: STAT pre-answer artifact returned with every restricted flag off |
| SEC-INT-004 | Revoked reviewer answer access | P1 | SQL assignment branch in `read_item_revision_answers` omits `has_active_role` and current credential checks | Statically disproved fail-closed revocation semantics |
| SEC-INT-005 | Artifact policy and Class A confusion | P1 | `create_channel_artifact` accepts independent policy, channel, phase, data class, and arbitrary JSON | Static attack path exists for mislabeled answer-bearing payload |
| SEC-INT-006 | Student publication gate mismatch | P1 | SQL publication checks `student_release_enabled` but not `student_content_enabled` | Static contract mismatch |
| SEC-INT-007 | Runtime authorization bypass by repository choice | P1 | Main server constructs `QuestionPlatform` with `MemoryRepository`; `PostgresRepository` is not wired | RLS cannot protect the current HTTP service |
| SEC-INT-008 | Missing canonical identity | P1 | Main server supplies no `identityResolver` | Safe 401 default, State C unavailable |
| SEC-INT-009 | Unproven RLS and rollback | P1 | Disposable PostgreSQL test skipped; no canonical project-pinned route | No database security clearance |
| SEC-INT-010 | Release actor-separation drift | P2 | SQL ratification and publication do not match stronger application actor separation | Static mismatch |
| SEC-INT-011 | Browser-only attack coverage gap | P2 | No authenticated staging URL or in-app Browser run | XSS, cookie, CORS, and live session behavior remain unproven |
| SEC-INT-012 | Arbitrary release validation evidence | P1 | App and SQL accept any nonempty caller-named passing check list | Required leak checks and stored results are not enforced |
| SEC-INT-013 | Expired rights bypass | P1 | Release assembly checks rights status but not `expires_at` | Expired clearance can remain eligible |
| SEC-INT-014 | Broad metadata RLS | P1 | Shared metadata policy grants table-wide reads to authors and reviewers | Binding own-lineage and assignment scope is not encoded |
| SEC-INT-015 | Compensation audit race | P2 | `IF NOT EXISTS` followed by append has no unique compensation key | Concurrent calls can append duplicates |
| SEC-INT-016 | Incomplete immutable lifecycle | P2 | Source, redaction, and extraction records lack immutable triggers; draft revisions cannot be edited | Architecture lifecycle is not fully represented |
| SEC-INT-017 | Current review patch is not green | P1 | Assignments now start open but tests do not accept them | Current focused run has six failures |

## Evidence And Tests

- Current focused security, platform, privacy, migration, and repository run: 112 passed, 6 failed, 1 skipped out of 119.
- Prior committed local full suite observed before the uncommitted review-workflow delta: 194 passed, 0 failed, 1 skipped out of 195. It is historical evidence, not the current verdict.
- Skipped case: disposable PostgreSQL apply, reapply, RLS role attacks, compensation, and reapply.
- Root dependency audit: 0 vulnerabilities.
- Relevant secret-pattern scan: no findings.
- Independent synthetic attack probe: three security claims disproved as listed above.

## Changes

No product change was made. This specialist created only the seven files in `agents/security_integrated/`.

## Risks And Blockers

The local estate proves useful mechanics but the current worktree is not green. Security vetoes State C until the six review failures, IDOR and feature-gate bypasses, release validation, rights, artifact, RLS, and compensation defects are repaired, the canonical resolver and unprivileged database role are wired, and the complete PostgreSQL attack and rollback matrix passes on an authorized isolated target.

## Confidence

High, `0.97`, for the local findings and release veto. No confidence claim is made for live RLS, auth, or rollback because those paths were not available.

## Paths

Primary evidence paths are `i1q-question-platform/src/auth.mjs`, `src/server.mjs`, `src/platform.mjs`, `src/privacy.mjs`, `src/pipeline.mjs`, `src/postgres-repository.mjs`, the two timestamped SQL files, and their focused tests.

## Root Handoff

Root should treat this packet as a security release veto, not as a request to weaken any protected system. Repair the app-owned boundaries first, then obtain the canonical identity, database, and deployment routes and rerun an independent security review on the exact frozen commit.

============================================================
FILE: agents/ux_accessibility/accessibility_audit.md
============================================================
# I1Q-1007X Accessibility Baseline Audit

## Verdict

**WCAG 2.2 AA NOT PROVEN for the I1Q-1006 candidate.** The source contains several useful accessibility foundations, but the supplied result is a hard-coded heuristic summary rather than criterion-level conformance evidence.

This is a release-blocking evidence verdict for the 1006 candidate, not a claim that every untested success criterion fails.

## Snapshot Boundary

Authority and MissionMed OS observations from the initial audit predated the Root Supervisor's later recovery and registration. They are not current accessibility blockers and must not be carried forward as such. This audit's live veto is based only on verified UI and evidence defects in the 1006 candidate.

## Positive Foundations Observed

- Language, viewport, navigation, main, heading, and skip-link structures exist.
- Form labels or accessible names are present for the inspected static controls.
- A global `:focus-visible` rule exists.
- Polite and assertive live regions exist.
- Status badges include text and a shape rather than color alone.
- A reduced-motion media rule exists.
- The three reported contrast samples exceed 4.5:1.
- No drag operation or timed review behavior exists in the current UI.

These are implementation clues, not a WCAG conformance statement.

## Evidence Provenance Failure

`scripts/generate_evidence.mjs` writes the browser and accessibility result values directly. It does not consume a browser trace, accessibility engine, accessibility tree, contrast analyzer, screen-reader log, keyboard transcript, or raw test result for those claims.

`tests/ui.test.mjs` checks source strings and markup patterns. It does not execute the rendered workflows, tab order, focus state, live-region behavior, target size, zoom, reflow, or assistive-technology output.

Consequently, `pass_automated_and_browser_heuristics` cannot be accepted as WCAG 2.2 AA evidence.

## WCAG Evidence Matrix

| Required area | Evidence status | Audit result |
| --- | --- | --- |
| Complete keyboard operation | Navigation Enter/Space source pattern only | Not proven; complete workflow operation and no-trap testing are absent. |
| Visible focus | CSS rule and focused navigation screenshots | Partial; every control, scroll region, modal/state, and high-contrast context is untested. |
| Contrast | Three selected ratios | Partial; all text, badges, disabled explanations, focus indicators, form boundaries, and non-text states are not inventoried. |
| Accessible names | Static shell heuristic | Partial; dynamic states and complete accessibility-tree names/descriptions are untested. |
| Announced status changes | Live-region markup | Partial; loading, save, errors, retries, conflicts, and repeated messages lack screen-reader evidence. |
| Target sizing | No measurement | Not proven against WCAG 2.2 SC 2.5.8. |
| Zoom and reflow | No 200% or 400% run | Not proven against SC 1.4.4 and 1.4.10. |
| Reduced motion | Stylesheet rule | Partial; computed behavior is not verified. |
| No keyboard traps | No test | Not proven against SC 2.1.2. |
| No inaccessible drag-only action | No drag UI currently present | Not applicable to the current scaffold; must be retested after feature completion. |
| No timed review trap | No timer currently present | Not applicable to the current scaffold; future session and review expiry behavior requires testing. |
| Focus not obscured | No test | Not proven against WCAG 2.2 SC 2.4.11. |
| Accessible authentication | Canonical auth is absent from 1006 | Not testable against WCAG 2.2 SC 3.3.8. |

## Findings

### A11Y-01: Conformance claim has no reproducible source

Severity: Blocker.

The evidence generator manufactures a pass summary from constants. A release gate needs raw executable results, environment identity, commit identity, criterion mapping, and manual evidence.

### A11Y-02: Complete keyboard workflows are unavailable

Severity: High. Related criteria: 2.1.1, 2.1.2, 2.4.3.

Several visible commands have no behavior for any input method. Navigation changes content but retains focus on the navigation button, with no validated focus transfer to the new view. Queue, review, release, and incident tasks cannot be completed keyboard-only.

### A11Y-03: Reflow and zoom are not proven

Severity: High. Related criteria: 1.4.4, 1.4.10, 1.4.12.

The mobile navigation requires horizontal scrolling while the page also scrolls vertically. Supplied mobile and tablet captures visibly truncate headings or right-side content in several views. There is no 320 CSS-pixel, 200%, 400%, or text-spacing test.

### A11Y-04: Dynamic focus and status behavior is unverified

Severity: High. Related criteria: 2.4.3, 2.4.11, 4.1.3.

Loading regions are inserted and replaced rapidly; repeated announcements are not tested. Save status, retries, navigation, and future conflict messages need focus and announcement rules validated with actual assistive technologies.

### A11Y-05: Source metadata uses invalid list semantics

Severity: Medium. Related criterion: 1.3.1.

The transcript template places `li` children directly under `dl`. Use valid `dt`/`dd` group structure and verify the accessibility tree.

### A11Y-06: Disabled safety controls lack robust descriptions

Severity: Medium. Related criteria: 1.3.1, 3.3.2.

Disabled physician and release controls cannot receive focus, and their blocker explanation is not consistently linked through `aria-describedby` or an equivalent operable disclosure.

### A11Y-07: Contrast and target-size coverage is incomplete

Severity: Medium. Related criteria: 1.4.3, 1.4.11, 2.5.8.

Three selected contrast values and CSS dimensions are insufficient. The complete component/state inventory needs computed contrast and target geometry evidence.

## Required Verification

- Automated semantic scan on every workflow and required state, with raw machine output.
- Manual keyboard transcript for every primary task, including errors and recovery.
- VoiceOver plus Safari, NVDA plus Firefox or Chrome, and JAWS plus Chrome or Edge coverage.
- 200% zoom, 400% reflow, 320 CSS-pixel width, and text-spacing override coverage.
- Focus order, focus visibility, focus not obscured, and scroll-region operation checks.
- Target-size and complete contrast inventory.
- Live-region announcement transcript for loading, saved, error, conflict, queued, running, failed, and resumed states.
- Retest after canonical authentication is integrated.

## Gate Result

Accessibility remains red for the 1006 release candidate. It may move to green only after criterion-level automated and manual evidence passes, all critical/high findings are closed, representative assistive-technology users validate the workflows, and an independent verifier reviews the raw evidence.

============================================================
FILE: agents/ux_accessibility/human_validation_protocol.md
============================================================
# I1Q-1007X Human Validation Protocol

## Status

**PROPOSED, NOT EXECUTED.** This protocol defines the genuine-human validation needed after the internal application is feature-complete on canonical staging. It does not certify the 1006 candidate and does not constitute medical-content approval.

## Snapshot Boundary

Initial MMOS and registration observations predated the Root Supervisor's later recovery and registration and are not current blockers here. Entry into this protocol depends on the Root Supervisor's current staging certification, not the earlier snapshot.

## Objectives

- Validate that representative users can complete safety-critical review and release-support tasks.
- Detect workflow, comprehension, accessibility, trust, and recovery failures not found by automation.
- Validate assistive-technology operation against WCAG 2.2 AA expectations.
- Measure task completion and error prevention without claiming empirical psychometrics or medical approval.

## Entry Criteria

- All 17 required workflows and 16 required states are implemented on canonical staging.
- Canonical auth, roles, datastore, audit, concurrency, and recovery behavior are operational.
- Automated UI, security, accessibility, and responsive suites are green.
- Only synthetic or explicitly authorized redacted content is used.
- No raw transcript, student speech, patient identifier, credential, or secret may enter recordings, notes, or exports.
- A rollback identity and incident contact exist for the staging session.
- No known critical or high accessibility, privacy, security, or data-integrity finding remains open.

## Participants

| Cohort | Minimum | Eligibility |
| --- | ---: | --- |
| Credentialed physician reviewers | 5 | Credential verified for study eligibility; participation is usability review, not content approval. |
| Editorial or medical-education reviewers | 5 | Performs real editorial, curriculum, or assessment-content review work. |
| First-time internal operators | 5 | No prior use of the Question Platform and no coaching beyond normal onboarding. |
| Assistive-technology users | 6 | Mix of screen reader, keyboard-only, low-vision zoom, and motor-access users. |
| Release managers or incident responders | 3 | Responsible for internal release or operational response workflows. |

Participants may satisfy more than one cohort only when results remain separately attributable. Do not replace assistive-technology users with accessibility specialists acting as proxies.

## Assistive-Technology Matrix

- VoiceOver with current Safari on macOS
- VoiceOver with current Safari on iOS
- NVDA with current Firefox or Chrome on Windows
- JAWS with current Chrome or Edge on Windows
- Keyboard-only operation at desktop and mobile-responsive widths
- 200% zoom and 400% reflow for low-vision workflows
- At least one switch-control, voice-control, or equivalent motor-access workflow where available

Record exact OS, browser, assistive-technology version, viewport, zoom, and input method for every session.

## Core Tasks

### Physician Reviewer

1. Enter through canonical authentication and identify role and assignment.
2. Open an assigned item and identify source, immutable revision, evidence currency, and review history.
3. Inspect every option, distractor rationale, correct rationale, and evidence claim.
4. Detect and resolve an expired-evidence block.
5. Reject or request revision with a required note.
6. Attempt approval after a concurrent revision and recover without approving stale content.

### Editorial And Assessment Reviewer

1. Triage and assign a candidate.
2. Edit stem and choices, including all three distractor rationales.
3. Inspect duplicate/variant context and source traceability.
4. Complete the editorial rubric and request revision.
5. Compare revisions and verify that changes address the request.
6. Recover from a stale edit without losing work.

### Privacy Officer

1. Open source detail and redaction evidence.
2. Identify a privacy-blocked source and its exact failed class.
3. Confirm that raw source content is unavailable to the role.
4. Record a block or clearance decision with an audit entry.

### First-Time Operator

1. Find a queued extraction run and explain its status.
2. Resume a resumable failure and verify progress.
3. Search for an item, open its source, and identify its current review state.
4. Find the correct remedy for a rights block.
5. Open an incident and locate the audit trail.

### Release Manager Or Incident Responder

1. Assemble an eligible internal release from approved fixtures.
2. Identify manifest, checksum, approvals, feature flags, and rollback identity.
3. Refuse release when one required gate is expired or missing.
4. Open an incident, disable the internal flag in the simulated drill, and verify audit evidence.
5. Inspect rollback and reapply results without enabling student, STAT, or Drills consumers.

### Assistive-Technology User

Assistive-technology participants execute the tasks appropriate to their work role, including navigation, long transcript inspection, table operation, editing, status/error recovery, revision comparison, and blocked-action explanation.

## Measures

- Unassisted task completion
- Completion with one neutral prompt
- Failure or unsafe completion
- Critical errors, near misses, and recovery path
- Time on task, excluding system latency where separately measurable
- Single Ease Question after each task, 1 through 7
- Confidence that the selected source, revision, and action are correct, 1 through 5
- Navigation or focus losses
- Screen-reader announcement accuracy and verbosity
- Evidence/source traceability comprehension
- Post-session usability and trust interview

## Severity

- Critical: enables wrong-revision approval, privacy/source leak, answer leak, release bypass, unrecoverable data loss, or complete task exclusion.
- High: prevents a required workflow, causes a repeated serious error, creates inaccessible recovery, or materially obscures source/evidence identity.
- Medium: significant delay, confusion, or workaround with a reliable safe path.
- Low: polish or efficiency issue without meaningful task or safety impact.

## Passing Thresholds

- Zero critical errors or near misses on approval, privacy, release, incident, and stale-revision tasks.
- 100% completion of safety-critical tasks, with no more than one neutral prompt and no unsafe workaround.
- At least 90% unassisted completion across noncritical tasks in each cohort.
- Median Single Ease Question at least 5.5 of 7 for each required task family.
- Median source/revision/action confidence at least 4 of 5 without evidence misunderstanding.
- 100% keyboard completion for every required task.
- No critical or high assistive-technology defect.
- All status, error, conflict, and save announcements understandable without visual context.
- All critical/high findings repaired and retested by affected cohorts.

These thresholds are usability gates only. They do not approve medical content or establish psychometric validity.

## Session Controls

- Obtain informed consent for observation and any recording.
- Use participant IDs, not names, in exported evidence.
- Disable recording when any unauthorized content could appear.
- Store notes and recordings only in the approved restricted evidence location.
- Moderators use a fixed script and may give only predefined neutral prompts.
- Preserve raw observations; summaries must link to session and task IDs.
- Separate product defects from training, auth, latency, and content defects.

## Required Artifacts

- Recruitment and eligibility log
- Consent record
- Environment and assistive-technology matrix
- Task script and synthetic/authorized fixture hashes
- Per-task result table
- Redacted observation notes
- Issue register with severity and owner
- Metrics summary with denominators
- Repair and retest evidence
- Final human-validation verdict signed by UX and accessibility owners

## Exit Rule

Human validation is green only when thresholds pass, every critical/high issue is closed and retested, raw evidence is preserved, and an independent verifier confirms that the summary matches the observations. A separate exact-revision physician approval remains mandatory for any medical content release and is outside this protocol.

============================================================
FILE: agents/ux_accessibility/responsive_audit.md
============================================================
# I1Q-1007X Responsive Baseline Audit

## Verdict

**BLOCK for responsive certification of the I1Q-1006 candidate.** The stylesheet includes desktop, tablet, and mobile rules, but the supplied evidence does not reproducibly prove reflow, non-overlap, or complete workflow usability.

## Snapshot Boundary

Initial authority and MMOS observations occurred before later Root Supervisor recovery and registration. They are historical only and are not current responsive-release blockers. This verdict concerns the 1006 UI and its evidence.

## Evidence Set

- Claimed viewport widths: 390, 1024, and 1440 pixels.
- Claimed checks: 12 workflows across three widths, zero page overflow, zero console warnings/errors.
- Supplied captures: 12 desktop, 3 tablet, and 4 mobile images.
- CSS breakpoints: 1100 and 760 pixels.
- No committed browser runner, raw viewport log, DOM geometry report, browser/version identity, zoom identity, or screenshot checksum manifest.

The claimed viewport results are written as constants by `scripts/generate_evidence.mjs`; they are not derived from a checked-in run artifact.

## Visual Findings

### RESP-01: Mobile navigation requires undisclosed horizontal scrolling

At widths below 760 pixels, all 12 navigation buttons are placed in one horizontally scrolling row. The supplied captures often show partial labels at both edges and do not consistently expose the active destination. There is no scroll affordance, previous/next control, menu alternative, or proof that the active item is brought into view.

Impact: discoverability, keyboard operation, reflow, and novice task orientation.

### RESP-02: Supplied captures show right-edge truncation

Several mobile and tablet captures visibly cut headings, blocker text, transcript text, fields, or table content at the right edge. Desktop release, diff, and incident captures also omit material right-side content. Whether this arose from viewport overflow, zoom, capture configuration, or scroll position, it prevents a responsive pass.

Impact: evidence is insufficient to support the stated zero-overflow result.

### RESP-03: Screenshot provenance is incomplete

Sampled files with `.png` names contain JPEG bytes. The screenshots are not listed in `evidence/artifact_checksums.json`, and the evidence does not record browser, device scale, page zoom, scroll position, full-page versus viewport capture, or command identity.

Impact: visual evidence cannot be tied reproducibly to the release candidate.

### RESP-04: Coverage omits critical widths and zoom modes

No evidence covers 320 CSS pixels, 360 pixels, landscape mobile, 768 pixels, 1280 pixels, 200% zoom, 400% reflow, or text-spacing overrides. Only four mobile and three tablet screenshots exist for 12 workflows.

Impact: the majority of required workflows have no narrow-layout visual evidence.

### RESP-05: Dense content relies on local horizontal scrolling

Tables use horizontal overflow containers, which may be appropriate for genuinely two-dimensional data. The evidence does not test keyboard access to those regions, sticky context, row/column comprehension, or whether non-tabular controls also overflow.

Impact: power-user and assistive-technology workflows are unverified.

### RESP-06: Long and dynamic content is absent

The app uses one short synthetic source, one candidate, short labels, and a short transcript. It does not test long medical stems, long choices, long citations, hashes, multilingual names, large queues, numerous blockers, conflict messages, or real transcript lengths.

Impact: layout stability under representative content is unknown.

## Required Retest Matrix

| Mode | Minimum widths or settings | Required coverage |
| --- | --- | --- |
| Mobile portrait | 320, 360, 390 | All workflows and all required states |
| Mobile landscape | 568, 667, 844 | Navigation, authoring, review, diff, release, incidents |
| Tablet | 768, 820, 1024 | All workflows; split and collapsed layouts |
| Desktop | 1280, 1440, 1920 | All workflows; long-content and large-queue fixtures |
| Zoom | 200% | All workflows without clipped controls or inaccessible navigation |
| Reflow | 400% at 1280-equivalent viewport | 320 CSS-pixel acceptance, except essential two-dimensional data |
| Text spacing | WCAG override values | No clipping, overlap, or loss of controls |
| Reduced motion | OS preference enabled | No required information depends on motion |

## Acceptance Criteria

- No body-level horizontal scrolling at any required width or zoom.
- Horizontal scrolling is limited to essential two-dimensional data regions and is keyboard operable.
- Active navigation is visible, named, and reachable without pointer-only gestures.
- No heading, banner, label, field, button, status, hash, or error message is clipped or overlapped.
- Focus remains visible and unobscured after scrolling and responsive transitions.
- Dynamic content does not resize fixed controls or shift critical actions unexpectedly.
- Long representative content wraps or truncates only with an accessible full-value mechanism.
- Screenshot files use truthful extensions, have SHA-256 entries, and carry run metadata.
- Geometry and console results are generated from the browser run, not written as constants.

## Gate Result

The 1006 responsive result cannot support State C. A new reproducible matrix must pass after workflow completion and responsive repairs, followed by independent visual inspection of every required width and state.

============================================================
FILE: agents/ux_accessibility/ui_repairs.md
============================================================
# I1Q-1007X Proposed UI Repairs

## Scope

This is a read-only repair backlog for the I1Q-1006 candidate. No application code, migration, runtime, or deployment change was made by this analyst.

Authority and MMOS observations from the initial snapshot predated the Root Supervisor's later recovery and registration. They are not current blockers in this backlog. The priorities below arise from verified candidate UI and evidence defects.

## P0: Release Evidence Integrity

### UI-001 Replace hard-coded browser and accessibility evidence

Owner: UI QA and accessibility engineering.

Change:

- Generate browser, responsive, console, keyboard, and accessibility results from executable tests.
- Preserve raw results, browser/tool versions, operating system, commit SHA, viewport, zoom, reduced-motion state, and command identity.
- Fail evidence generation when a source run is missing or failed.

Acceptance:

- No pass field is assigned from an unconditional constant.
- Every summarized claim points to raw evidence.
- Re-running the documented command reproduces the summary or fails closed.

### UI-002 Repair the evidence validation entrypoint

Owner: Candidate maintainer.

Change:

- Implement the advertised `src/validate-evidence.mjs` contract or update the package script to a real validator.
- Validate required files, schemas, source hashes, screenshot hashes, MIME/extension agreement, commit identity, and stale evidence.

Acceptance:

- `npm run validate` exists, exits zero only for complete current evidence, and exits nonzero for missing or hard-coded inputs.

### UI-003 Rebuild visual evidence provenance

Owner: UI QA.

Change:

- Store screenshots using truthful file extensions.
- Add every screenshot to the artifact checksum manifest.
- Record full-page/viewport mode, scroll position, browser, viewport, scale, and zoom.

Acceptance:

- MIME, extension, dimensions, metadata, SHA-256, and release commit agree for every capture.

## P0: Workflow Completion

### UI-004 Implement the five missing workflows

Owner: Product UI engineering.

Required workflows:

- Source detail
- Privacy status and redaction evidence
- Extraction run queue/detail/retry/resume
- Dedicated distractor review
- Immutable audit trail inspection

Acceptance:

- Each workflow has a routable entry, selected-record context, loading/empty/error/blocked states, keyboard completion, and API-backed behavior.

### UI-005 Make presented commands functional

Owner: Product UI and API integration.

Change:

- Wire save, submit, add claim, editorial decisions, search/filter/sort, preview, incident creation, assignment, quarantine, and recovery.
- Remove or clearly mark controls that are not available in the current release.
- Do not report `Saved` until persistence is acknowledged and identity/version is confirmed.

Acceptance:

- Every enabled control has an observable, authorized result and error path.
- Reload proves persistence where persistence is claimed.

### UI-006 Implement all required states

Owner: Product UI engineering.

Change:

- Add partial source, privacy blocked, rights blocked, expired evidence, review conflict, stale edit, concurrent edit, and extraction queued/running/failed/resumable states.
- Provide exact remedy, ownership, retry/resume behavior, and safe navigation for each state.

Acceptance:

- Each of the 16 required states has a deterministic fixture, visual assertion, keyboard path, accessibility assertion, and recovery test.

## P1: Accessibility

### UI-007 Add deterministic focus management

Owner: UI accessibility engineering.

Change:

- Move focus predictably after navigation, errors, retries, dialogs, saves, review decisions, and conflict recovery.
- Keep focus visible and unobscured at every viewport and zoom.

Acceptance:

- Manual and automated focus transcripts match the documented rules.

### UI-008 Correct semantics and blocker descriptions

Owner: UI accessibility engineering.

Change:

- Replace invalid `dl`/`li` structure with valid term/description groups.
- Associate blocked-action explanations programmatically.
- Validate headings, table headers, regions, names, descriptions, errors, and live regions from the accessibility tree.

Acceptance:

- Automated semantic scans have no serious findings and manual screen-reader output is understandable without visual context.

### UI-009 Complete WCAG 2.2 AA verification

Owner: Accessibility lead and independent verifier.

Change:

- Add criterion-level automated and manual coverage for keyboard, traps, focus, contrast, non-text contrast, status, target size, zoom, reflow, text spacing, reduced motion, and authentication.

Acceptance:

- No critical/high defect remains and every applicable AA criterion has evidence and owner sign-off.

## P1: Responsive UX

### UI-010 Replace the mobile navigation overflow pattern

Owner: Product design and UI engineering.

Change:

- Provide a compact navigation control that exposes all destinations, current location, and keyboard operation without an undisclosed horizontal strip.

Acceptance:

- Current and adjacent destinations remain discoverable at 320 CSS pixels and 400% reflow.

### UI-011 Repair clipping and representative-content behavior

Owner: UI engineering.

Change:

- Constrain flexible children correctly and allow headings, banners, status text, hashes, fields, and actions to wrap.
- Test long stems, choices, citations, blockers, identities, transcript segments, and queues.

Acceptance:

- No body-level horizontal overflow, overlap, or clipped information across the responsive matrix.

## P1: Review Safety And Recovery

### UI-012 Make revision identity continuously visible

Owner: Product design.

Change:

- Show item ID, immutable revision ID/hash, source identity, assignment, current role, evidence currency, and conflict state at every review decision.

Acceptance:

- A reviewer can state exactly which immutable revision and evidence set a decision affects before activation.

### UI-013 Add concurrency and stale-evidence recovery

Owner: UI and datastore integration.

Change:

- Detect stale edits, concurrent decisions, expired claims, and withdrawn rights.
- Preserve unsaved work, show field-level differences, and require a deliberate refresh/merge/re-review choice.

Acceptance:

- Tests prove that no stale revision can be approved or silently overwrite current state.

## P2: Usability Board And Human Validation

### UI-014 Re-run the exact simulated board

Owner: UX lead independent of the implementer.

Acceptance:

- All 10 required personas and 15 required categories are scored from documented observations.
- Aggregate is at least 9.0 and no category is below 8.5.
- Every score links to evidence, issue disposition, and retest result.

### UI-015 Execute the human validation protocol

Owner: UX research and accessibility lead.

Acceptance:

- The protocol in `human_validation_protocol.md` is completed on staging.
- Critical safety tasks have no critical errors.
- Critical/high findings are repaired and retested before State C certification.

## Required Regression Scope

- All 17 workflows and 16 states
- Keyboard-only and screen-reader task runs
- 320 through 1920 pixel responsive matrix
- 200% zoom and 400% reflow
- Canonical auth roles and failures
- Stale/concurrent revisions and expired evidence
- Large queues and long transcript/content fixtures
- Release, rollback identity, incident, and audit workflows
- Dependent product smoke checks after any shared integration

## Exit Rule

The 1006 UI veto can be lifted only after P0 and P1 repairs pass reproducible tests, the board threshold passes with valid methodology, human validation is complete, and a fresh independent verifier accepts the raw evidence.

============================================================
FILE: agents/ux_accessibility/ux_release_verdict.md
============================================================
# I1Q-1007X UX, Accessibility, And Responsive Release Verdict

## Verdict

**BLOCK / RELEASE VETO FOR THE I1Q-1006 CANDIDATE.**

The 1006 candidate must not be used as evidence that the Question Platform has passed UX, WCAG 2.2 AA, responsive, or simulated-board gates for `INTERNAL_PRODUCTION_LIVE`.

## Candidate Identity

- Source ticket: `I1Q-1006`
- Commit: `0d6f78f2a2036731ec592398ce5fd845beb54333`
- Combined handoff SHA-256: `ad311340c8ecbe7abf4f077fa92dc1ef32760d65bbac4ab9a70b76b4fe379572`
- Application: `i1q-question-platform/`
- Audit mode: read-only baseline

## Snapshot-Time Authority Note

The initial audit reported MMOS dirty-state, currency, and registration observations that existed before the Root Supervisor's later recovery and registration. Those observations are now historical snapshot evidence only. They **must not be repeated as current blockers**, and this verdict makes no claim about the Root Supervisor's current authority state.

The veto remains valid because its active grounds are independent defects verified in the 1006 application and evidence.

## Active Veto Grounds

1. Only 12 named surfaces represent 17 required workflows; source detail, privacy status, extraction runs, distractor review, and audit trail are not independently operable.
2. Eleven required domain states are absent: partial source, privacy blocked, rights blocked, expired evidence, review conflict, stale edit, concurrent edit, and extraction queued/running/failed/resumable.
3. Multiple visible commands are inert, including material authoring, evidence, review, release, and incident actions.
4. Browser, accessibility, and UX pass values are written as constants rather than derived from reproducible runs.
5. The advertised evidence validator does not exist at its package-script target.
6. WCAG 2.2 AA lacks criterion-level automated, keyboard, screen-reader, zoom/reflow, target-size, focus, and contrast evidence.
7. The prior simulated board uses substituted personas, only 10 of 15 required categories, no aggregate, and arithmetic scores without observation traceability.
8. Supplied responsive captures show truncation or incomplete content and lack trustworthy run provenance and checksum coverage.
9. No genuine-human protocol was executed for physicians, editors, first-time operators, or assistive-technology users.

## State C Gate Effect

For the 1006 evidence set:

- Accessibility green: **NO**
- Simulated UX threshold green: **NO, score invalid**
- Staging E2E workflow coverage green: **NO**
- Responsive/browser matrix green: **NO**
- Human validation complete: **NO**
- Independent final-wave UX clearance: **NO**

Other State C gates, including current authority, auth, datastore, security, privacy, deployment, rollback, monitoring, and dependent systems, belong to their current owners and evidence. This report neither clears nor re-blocks them.

## Conditions To Lift This Veto

- Complete all 17 workflows and 16 required states with authorized, API-backed behavior.
- Close the P0 and P1 items in `ui_repairs.md`.
- Replace hard-coded summaries with reproducible raw browser and accessibility evidence.
- Pass WCAG 2.2 AA automated and manual testing, including representative assistive-technology users.
- Pass the responsive matrix from 320 through 1920 pixels, 200% zoom, 400% reflow, and representative long content.
- Re-run the exact 10-persona by 15-category simulated board with aggregate at least 9.0 and no category below 8.5.
- Execute `human_validation_protocol.md`, close all critical/high findings, and preserve denominators and raw evidence.
- Obtain a fresh independent final-wave review after the integrated candidate is complete.

## Tests And Checks Performed

- Verified source commit and required 1006 commits.
- Verified the 1006 combined handoff SHA-256.
- Inspected the complete 1006 handoff, current UI source, UI tests, evidence generator, machine evidence, and 19 screenshots.
- Started and stopped the local synthetic server without deployment or runtime mutation.
- Confirmed the advertised evidence-validator target is absent.
- Confirmed sampled screenshot MIME/extension mismatch and absence from the screenshot checksum inventory.
- Live browser interaction was unavailable in the audit session; prior browser claims were inspected but not accepted as independently reproduced.

## Changes Made

Only the seven assigned durable audit artifacts under `agents/ux_accessibility/` were created. No application code, authority file, migration, configuration, feature flag, runtime, or deployment surface was changed.

## Confidence

- 0.99 that the 1006 candidate cannot clear the UX/accessibility State C gates.
- 0.93 in detailed interaction findings pending live browser and human assistive-technology retest.

## Handoff To Root Supervisor

Treat this packet as the durable baseline for the 1006 candidate. Preserve the release veto until a changed integrated candidate satisfies every lift condition and receives a fresh independent review. Use later Root Supervisor evidence, not this audit's historical authority snapshot, for current MMOS and registration status.

============================================================
FILE: agents/ux_accessibility/ux_workflow_audit.md
============================================================
# I1Q-1007X UX Workflow Baseline Audit

## Verdict

**BLOCK for the I1Q-1006 candidate.** The isolated application is a useful synthetic UI scaffold, but it does not provide complete, operable coverage of the workflows and states required for `INTERNAL_PRODUCTION_LIVE`.

This verdict is limited to the 1006 candidate at commit `0d6f78f2a2036731ec592398ce5fd845beb54333`, using the 1006 combined handoff with SHA-256 `ad311340c8ecbe7abf4f077fa92dc1ef32760d65bbac4ab9a70b76b4fe379572`.

## Snapshot Boundary

The initial audit observed a dirty and lagging MissionMed OS checkout and missing I1Q registration. Those observations were made before the Root Supervisor's later recovery and registration work. They are historical snapshot facts only and **must not be repeated as current blockers**. Current authority and registration status belongs to the Root Supervisor's later evidence.

The release veto in this report remains active against the 1006 candidate because it is based on UI implementation, workflow coverage, and evidence defects directly verified in the candidate.

## Evidence Inspected

- `i1q-question-platform/public/index.html`
- `i1q-question-platform/public/app.js`
- `i1q-question-platform/public/styles.css`
- `i1q-question-platform/tests/ui.test.mjs`
- `i1q-question-platform/scripts/generate_evidence.mjs`
- `_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1006_ULTRA_BUILD/I1Q_1006_COMBINED_HANDOFF.md`
- `_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1006_ULTRA_BUILD/evidence/browser_results.json`
- `_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1006_ULTRA_BUILD/evidence/accessibility_results.json`
- `_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1006_ULTRA_BUILD/evidence/ux_scorecard.json`
- Nineteen supplied desktop, tablet, and mobile screenshots

## Required Workflow Coverage

| Required workflow | 1006 coverage | Finding |
| --- | --- | --- |
| Dashboard | Partial | Metrics and blockers render, but the data is synthetic and the displayed foundation status is stale relative to the completed handoff. |
| Corpus inventory | Partial | One synthetic source row renders. Filtering is not wired and refresh is disabled. |
| Source detail | Missing | Static metadata beside the transcript is not a selectable, navigable source-detail workflow. |
| Privacy status | Partial | A single `Pass` badge is shown. There is no redaction record, class result, operator decision, or blocked-state workflow. |
| Transcript evidence | Partial | A fixed synthetic transcript renders without source selection, long-transcript behavior, partial-source recovery, or evidence navigation. |
| Extraction runs | Missing | The dashboard count is not a queue, run-detail, retry, checkpoint, failure, or resume workflow. |
| Candidate triage | Partial | One selectable row renders. Assignment, quarantine, rejection, bulk action, and candidate opening are unavailable. |
| Question authoring | Partial | Fields render and a local timer changes save text, but there is no persisted save, validation result, submission, or recovery. |
| Distractor review | Partial | Distractor rationale fields and one editorial checkbox exist, but there is no dedicated plausibility, accidental-correctness, misconception, or option-class review. |
| Evidence claims | Partial | A static claim renders. `Add claim`, currency review, and durable checklist behavior are not wired. |
| Editorial review | Partial | Rubric and decision buttons render, but decisions, notes, assignment identity, revision creation, and conflicts are not implemented in the UI. |
| Physician review | Partial, correctly blocked | The unassigned-governance block is visible, but the exact-revision, credential, conflict, and signed-decision workflow is not demonstrated. |
| Revision comparison | Partial | One static three-row comparison renders without revision loading, complete field diff, decision context, or navigation. |
| Search and filters | Partial | Controls render with fixed values; no search, filtering, sorting, pagination, or result navigation is wired. |
| Release assembly | Partial, correctly blocked | A static checklist renders. Preview, assembly, manifest review, promotion, and rollback identity are not operable. |
| Incidents | Partial | An empty state renders, while `Open incident` has no behavior and there is no triage, containment, or resolution flow. |
| Audit trail | Missing | No audit-event view, filtering, hash-chain status, actor history, or immutable-record inspection exists. |

Result: 12 named navigation surfaces are present for 17 required workflows. Five required workflows have no independently operable surface, and the remaining surfaces are mostly static demonstrations rather than end-to-end tasks.

## Required State Coverage

| Required state | 1006 coverage | Finding |
| --- | --- | --- |
| Loading | Partial | Generic loading markup exists; latency, cancellation, and repeated announcement were not tested. |
| Empty | Partial | Incident empty state exists; empty inventory, search, review, extraction, and release states do not. |
| Blocked | Partial | A global governance banner and disabled actions exist; blocked reasons are not consistently associated with controls. |
| Unauthorized | Partial | Boot converts any initial API error into `Authentication required`, conflating authorization, outage, and server failures. |
| Error | Partial | Generic view error and retry exist, but initial boot lacks equivalent retry and no domain errors are represented. |
| Partial source | Missing | No state. |
| Privacy blocked | Missing | No state. |
| Rights blocked | Missing | No state. |
| Expired evidence | Missing | No state. |
| Review conflict | Missing | No state. |
| Stale edit | Missing | No UI state despite service-level optimistic-lock concepts. |
| Concurrent edit | Missing | No state. |
| Extraction queued | Missing | No state. |
| Extraction running | Missing | No state. |
| Extraction failed | Missing | No state. |
| Extraction resumable | Missing | No state. |

Result: at most five generic states are represented, while all eleven domain-specific failure, concurrency, privacy, rights, evidence, and extraction states are absent.

## Interaction Findings

- Screen behavior is bound only for navigation, refresh, editor save-text timing, and generic retry.
- `Save draft`, `Add claim`, editorial decisions, release preview, and `Open incident` have no handlers.
- The editor says `Saved locally` without demonstrating persistence or a reload round trip.
- Search and filter controls do not change results.
- Navigation changes screen content without moving focus to the new heading or workspace.
- Disabled safety actions are visually explained nearby but lack consistent programmatic descriptions.
- No deep link, back/forward history, selected-record context, or unsaved-navigation warning is demonstrated.

## Persona Impact

- Physician reviewer: cannot perform or recover an exact-revision decision.
- Medical educator and editorial reviewer: cannot persist rubric outcomes or request a revision.
- Assessment scientist: cannot inspect distractor quality, variants, duplicate families, or item-quality evidence.
- Privacy officer: cannot inspect redaction evidence or resolve privacy blocks.
- Novice operator: sees controls that look active but do nothing, reducing trust and recoverability.
- Power operator: lacks bulk action, keyboard queue operation, pagination, sorting, and durable filters.
- Assistive-technology user: receives no validated focus transition or complete task evidence.
- Release manager and incident responder: cannot execute release or incident workflows.

## Gate Result

The 1006 candidate does not satisfy Phase 7 workflow/state coverage, Phase 14 browser and concurrency coverage, Phase 15 UX convergence, or the UI portions of Phase 16 staging certification. Re-audit is required after the repairs in `ui_repairs.md` are implemented and reproducibly tested.

============================================================
FILE: agents/ux_current/accessibility_audit.md
============================================================
# I1Q-1007X Current Accessibility Audit

## Current Scope

This read-only audit evaluates the current local synthetic shell at repository commit `ccb8b73899c81ba0d028638be0d79b6a351f0ceb` against the requested WCAG 2.2 AA areas. The reviewed UI bytes last changed at `4b154e8deb60ddf9a002f8a01a8fec90518b8966`.

Verdict: `WCAG 2.2 AA NOT PROVEN`. This is an evidence verdict, not a claim that every untested success criterion fails.

No browser, accessibility tree, VoiceOver, NVDA, JAWS, switch control, or real user session was available. No standalone Playwright or Computer Use substitute was used.

## Evidence

- Static HTML, CSS, client, server shell, and UI test inspection at the absolute paths listed in `ux_workflow_audit.md`.
- UI suite: 6 of 6 passed.
- Full local suite: 196 passed, 0 failed, 1 skipped.
- Deterministic JSDOM rendering of 17 workflows and 16 state fixtures.
- Deterministic semantic scan of rendered local synthetic workflows.
- Computed WCAG contrast ratios for declared CSS color pairs.
- Current evidence validator result: 19 errors and nonzero exit.

## Positive Findings

- `html` has a language, title, viewport, and light color-scheme declaration.
- The shell uses navigation and main landmarks, one page heading, and a functional skip-link target.
- Navigation destinations are native buttons with accessible text and `aria-current` management.
- The refresh icon has an accessible name and tooltip text.
- Forms use wrapping labels, fieldsets, legends, native inputs, selects, textareas, and checkboxes.
- Dynamic tables use scoped row and column headers and named keyboard-scroll regions.
- Polite and assertive live regions exist.
- Navigation, error, and scenario rendering include programmatic focus targets.
- All 16 scenario fixtures expose a state identity, owner, recovery, and synthetic-only boundary.
- Status badges use text plus a shape, not color alone.
- Reduced-motion CSS disables motion durations.
- No drag-only action or timed review interaction was found.
- DOM simulation found no unnamed controls, duplicate IDs, or broken accessible-reference IDs.

## WCAG Evidence Matrix

| Required area | Current evidence | Verdict |
| --- | --- | --- |
| Complete keyboard operation | Native controls and DOM click simulation | Not proven in a real browser across complete tasks |
| Visible focus | Global 3-pixel focus outline | Partial; sidebar contrast is below 3 to 1 and no browser run exists |
| Accessible names | Static plus DOM semantic scan | Strong local evidence, not an accessibility-tree certification |
| Announced status changes | Live regions and announcement functions | Partial; duplicate announcements and rerender clearing are likely |
| Target sizing | Declared 36 to 38 pixel controls and labeled checkbox rows | Partial; unstyled nav toggle and computed geometry are unverified |
| Contrast | Declared color calculations | Partial; focus indicator fails on dark sidebar and computed styles are untested |
| Zoom and reflow | Responsive CSS only | Not proven at 200 percent or 400 percent |
| Reduced motion | Media query exists | Partial; computed browser behavior unverified |
| No keyboard traps | No modal widget or drag surface | Not proven by a complete browser tab-order run |
| No drag-only actions | No drag action found | Pass for current source scope only |
| No timed review trap | No timed action found | Pass for current source scope only |
| Focus not obscured | No sticky overlay found | Not proven in browser, zoom, or mobile navigation |
| Accessible authentication | Local synthetic mode only | Not testable until canonical auth is integrated |

## Contrast Evidence

Declared pairs calculated with the WCAG relative luminance formula:

| Pair | Ratio | Source-level result |
| --- | ---: | --- |
| Ink on white | 16.48:1 | Pass |
| Muted on white | 5.80:1 | Pass for normal text |
| Muted on subtle surface | 5.44:1 | Pass for normal text |
| White on primary green | 7.26:1 | Pass |
| Warning text on warning surface | 8.98:1 | Pass |
| Red status pair | 6.35:1 | Pass |
| Blue status pair | 5.99:1 | Pass |
| Sidebar text on sidebar | 11.62:1 | Pass |
| Active navigation text | 10.05:1 | Pass |
| Focus outline on white | 5.16:1 | Pass non-text contrast |
| Focus outline on dark sidebar | 2.92:1 | Fail the 3:1 non-text threshold |

Disabled text measured 3.20:1, but inactive controls are exempt from normal text contrast. The unstyled classes and actual computed browser colors remain unverified.

## Findings

### A11Y-CUR-001: Focus and success feedback can disappear during rerender

Severity: High.

`showActionStatus` may focus the live status, then queue, resume, editorial, and release actions immediately call `renderScreen`. `renderScreen` calls `clearActionStatus` before replacing the focused subtree. Internal detail actions and filter submissions also rerender without a destination focus rule.

Impact: keyboard and screen-reader users can lose their position and miss the result of a material action.

### A11Y-CUR-002: Two live regions can announce one action

Severity: Medium.

`action-status` is itself a polite live region, while `showActionStatus` also writes the same message through the separate polite or assertive announcer. Errors can be announced once politely and again assertively.

Impact: duplicate or out-of-order speech can reduce trust and obscure the next task.

### A11Y-CUR-003: Mobile navigation state is not represented by CSS

Severity: High.

The client toggles `aria-expanded` and `#primary-nav.is-open`, but the stylesheet has no `.nav-toggle`, `.brand-row`, or `.is-open` rule. At the mobile breakpoint, the navigation remains a visible horizontal strip even when `aria-expanded` is `false`.

Impact: visual state and programmatic state can disagree. Keyboard and screen-reader users receive an inaccurate collapse state.

### A11Y-CUR-004: Focus indicator contrast misses the declared threshold on the sidebar

Severity: Medium.

The focus color `#0c6fc2` against sidebar `#202825` computes to 2.92:1.

Impact: focused workflow buttons can be difficult to identify and do not meet the 3:1 non-text contrast expectation.

### A11Y-CUR-005: Editorial block text can contradict operable controls

Severity: High.

Expired evidence produces a blocking notice, but the `canReview` expression does not include `!expired`. This is also an error-prevention and trust defect.

Impact: a reviewer may attempt an invalid verdict while the page simultaneously says the verdict is blocked.

### A11Y-CUR-006: Current CSS omits many rendered component classes

Severity: High for certification.

Source comparison found no selectors for core classes including `detail-list`, `record-context`, `state-notice`, `scenario-state`, `action-status`, `disabled-command`, `layout-run`, `pagination`, `review-criteria`, `transcript-list`, `transcript-meta`, `nav-toggle`, and state tone classes.

Impact: information hierarchy, focus context, state salience, mobile operation, wrapping, and target geometry cannot be trusted from source alone.

### A11Y-CUR-007: Current automated coverage is too narrow for conformance

Severity: Release blocker.

The UI suite boots Dashboard and navigates to Inventory. It does not execute complete keyboard tasks, live-region speech, visual focus, all 17 workflows, all 16 state recovery paths, zoom, text spacing, reduced motion, target geometry, or real authentication.

## Changes

No product or test change was made. This file records findings only.

## Tests

- UI tests passed 6 of 6.
- Full package tests passed 196 with 1 skipped disposable database test.
- JSDOM semantic scan found zero unnamed controls, duplicate IDs, and broken ARIA references in the synthetic render.
- Sixteen state fixtures matched requested state, expected `status` or `alert` role, focused heading, recovery command, and synthetic boundary.
- No visual browser or assistive-technology execution occurred.

## Risks

- DOM semantics can pass while computed styles, focus visibility, clipping, announcements, and keyboard order fail in real browsers.
- Source lineage mismatch can make an accessible label describe the wrong underlying record.
- A synthetic scenario picker demonstrates states but does not prove natural API failures are announced correctly.
- Canonical authentication may introduce focus, timeout, reauthentication, and error behavior not represented here.

## Blockers

- Close A11Y-CUR-001 through A11Y-CUR-006.
- Run the browser and assistive-technology matrix in `human_validation_protocol.md`.
- Produce criterion-level raw evidence for applicable WCAG 2.2 AA requirements.
- Pass 200 percent zoom, 400 percent reflow, text-spacing, target-size, and complete contrast checks.
- Obtain independent accessibility verification after repairs.

## Confidence

- 0.96 in semantic source and deterministic DOM findings.
- 0.94 in focus, live-region, and mobile-state defects.
- 0.80 in responsive and visual severity pending browser execution.
- 0.00 as a claim of WCAG 2.2 AA conformance.

## Paths

See the absolute evidence paths and hashes in `ux_workflow_audit.md`. The current report path is:

`/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/agents/ux_current/accessibility_audit.md`

## Root Handoff

Accessibility remains red for State C. Root should not translate passing source or JSDOM checks into a WCAG claim. The next valid step is repair, real browser evidence, real assistive-technology testing, human validation, and independent re-audit.

============================================================
FILE: agents/ux_current/human_validation_protocol.md
============================================================
# I1Q-1007X Genuine Human Validation Protocol

## Current Scope

Status: `PROPOSED, NOT EXECUTED`.

This protocol validates usability, accessibility, workflow safety, evidence traceability, and recovery on a future canonical staging build. It does not approve medical content, establish psychometric validity, assign medical governance, or authorize student release.

All sessions must use synthetic content or explicitly authorized privacy-safe content. No raw transcript, student speech, patient identifier, third-party identity, credential, secret, token, or production student data may enter session recordings or exported notes.

## Evidence

The current machine baseline is documented in `ux_workflow_audit.md`, `accessibility_audit.md`, and `responsive_audit.md`. Those artifacts define the entry-state findings only. The participant, browser, assistive-technology, task, and observation evidence required to complete this protocol does not yet exist.

## Findings

- Real human validation is not started.
- The required cohorts, task families, state paths, environment matrix, measures, and safety thresholds are defined below.
- Machine and simulated evidence cannot substitute for observed participant results.

## Entry Criteria

- P0 items in `ui_repairs.md` are closed and independently retested.
- All 17 workflows and 16 natural state paths pass deterministic staging tests.
- Canonical authentication, role resolution, datastore, audit, concurrency, and rollback are operational.
- Browser, responsive, keyboard, and automated accessibility suites are green.
- Evidence validation passes for the exact candidate.
- Student content, STAT consumer, and Drills consumer flags remain off.
- Medical governance may remain unassigned, but physician approval controls must remain unavailable.
- No critical or high security, privacy, source-lineage, accessibility, or data-integrity issue is open.

## Participants

| Cohort | Minimum | Eligibility |
| --- | ---: | --- |
| Credentialed physician reviewers | 5 | Credential verified for study eligibility; participation is usability review, not item approval |
| Medical educators or editorial reviewers | 5 | Performs real content, curriculum, or assessment review work |
| Assessment scientists | 3 | Experienced with item quality, variants, and pilot interpretation |
| Privacy officers or privacy-trained operators | 3 | Experienced with redaction and rights decisions |
| First-time internal operators | 5 | No prior use of the Question Platform |
| Assistive-technology users | 6 | Mix of screen reader, keyboard-only, low-vision zoom, and motor-access users |
| Release managers or incident responders | 3 | Responsible for release or operational response |

Participants may qualify for more than one cohort only when each cohort result remains separately attributable. Accessibility specialists may not replace actual assistive-technology users.

## Environment Matrix

- VoiceOver with current Safari on macOS.
- VoiceOver with current Safari on iOS.
- NVDA with current Firefox and Chrome on Windows.
- JAWS with current Chrome or Edge on Windows.
- Keyboard-only operation at desktop and responsive widths.
- 200 percent browser zoom.
- 400 percent reflow at 320 CSS pixels.
- Reduced-motion mode.
- WCAG text-spacing override.
- At least one switch-control, voice-control, or equivalent motor-access workflow where available.

Record operating system, browser, assistive-technology version, viewport, zoom, input method, candidate commit, deployment identity, and fixture hashes for every session.

## Workflow Tasks

### Sources And Privacy

1. Find one inventory source by ID and availability.
2. Open Source detail and verify title, canonical ID, hash, rights, and privacy identity.
3. Open Transcript evidence and confirm every segment belongs to the selected source.
4. Identify a partial source and explain what is absent without inferring content.
5. Identify privacy-blocked and rights-blocked sources and state the named owner and remedy.
6. Confirm that raw source content is unavailable to an unauthorized role.

### Extraction And Triage

1. Find queued, running, failed, and resumable runs.
2. Retry a failed synthetic run as a new run.
3. Resume from a verified checkpoint.
4. Confirm that partial output is not presented as complete.
5. Inspect a sanitized candidate without seeing protected answer or raw source wording.

### Authoring And Assessment Review

1. Open an exact immutable revision and identify item ID, revision ID, hash, source, and evidence.
2. Edit the stem and four choices with three distractor rationales and misconception IDs.
3. Save a new immutable draft.
4. Recover from a newer revision without overwriting it or losing protected content.
5. Review distractor plausibility, accidental correctness, option class, and safety.
6. Find an item through Search and filters, then compare two revisions.

### Editorial And Physician Review

1. Confirm the assigned reviewer, role, conflict state, evidence currency, and exact revision hash.
2. Attempt an editorial pass with an incomplete rubric and explain the block.
3. Request revision with a required note.
4. Encounter expired evidence and verify that no decision control can submit.
5. Encounter a reviewer conflict and recover through reassignment.
6. Open Physician review and verify that unassigned governance and absent credential block approval without implying a physician identity.

### Release, Incidents, And Audit

1. Inspect release gates and identify why the current release is blocked.
2. Assemble an eligible synthetic internal release when the staging fixture permits it.
3. Confirm student, STAT, and Drills flags remain off.
4. Inspect only answer-free pre-answer metadata.
5. Find an incident record and identify owner, state, and created time.
6. Trace a material action through the immutable audit trail.
7. Detect a deliberately broken sequence link in a synthetic fixture.

## Required State Tasks

Each participant cohort executes relevant natural paths for:

- loading
- empty
- blocked
- unauthorized
- error
- partial source
- privacy blocked
- rights blocked
- expired evidence
- review conflict
- stale edit
- concurrent edit
- extraction queued
- extraction running
- extraction failed
- extraction resumable

For every state, record whether the participant can identify what happened, what remained unchanged, the owner, the recovery path, and the next safe action.

## Measures

- Unassisted task completion.
- Completion with one predefined neutral prompt.
- Failure or unsafe completion.
- Critical error, near miss, and recovery path.
- Time on task, with system latency recorded separately.
- Single Ease Question from 1 through 7 after each task.
- Confidence in selected source, revision, and action from 1 through 5.
- Navigation errors and excessive tab travel.
- Focus loss and announcement accuracy.
- Source-lineage comprehension.
- Evidence and blocker comprehension.
- Post-session usability and trust interview.

## Severity

- Critical: enables wrong-source or wrong-revision action, privacy or answer leak, release bypass, unrecoverable data loss, or complete exclusion.
- High: prevents a required workflow, makes recovery inaccessible, causes repeated serious error, or materially obscures evidence identity.
- Medium: causes significant delay or confusion with a reliable safe workaround.
- Low: polish or efficiency issue without safety impact.

## Passing Thresholds

- Zero critical errors or near misses on source identity, approval, privacy, release, incident, and stale-revision tasks.
- 100 percent completion of safety-critical tasks with no more than one neutral prompt and no unsafe workaround.
- At least 90 percent unassisted completion across noncritical tasks in each cohort.
- Median Single Ease Question at least 5.5 of 7 for every required task family.
- Median source, revision, and action confidence at least 4 of 5 without evidence misunderstanding.
- 100 percent keyboard completion for every required task.
- No critical or high assistive-technology defect.
- Every status, error, conflict, save, queue, and resume announcement is understandable without visual context.
- Simulated expert board aggregate at least 9.0 with no category below 8.5 after observed defects are closed.
- Every critical and high finding is repaired and retested by an affected cohort.

These are usability gates only. They do not approve medical content.

## Session Controls

- Obtain consent for observation and any recording.
- Use participant IDs, not names, in exported evidence.
- Disable recording whenever unauthorized information could appear.
- Store notes only in the approved restricted evidence location.
- Use a fixed moderator script and predefined neutral prompts.
- Preserve raw observations with task and session identifiers.
- Separate product defects from training, content, auth, and latency issues.
- Never place participant identities, credentials, or raw content in Git.

## Required Evidence

- Recruitment and eligibility log.
- Consent record.
- Environment and assistive-technology matrix.
- Candidate commit, deployment identity, and fixture hashes.
- Per-task results with denominators.
- Redacted observation notes.
- Issue register with severity and owner.
- Metrics summary.
- Repair and retest evidence.
- Signed UX and accessibility verdict.
- Independent verification that summaries match raw observations.

## Changes

No session was run and no participant data was created. This protocol is documentation only.

## Tests

Current machine evidence is listed in `ux_workflow_audit.md`. It is an entry prerequisite, not a substitute for this protocol.

## Risks

- Recruiting only expert staff can hide first-time operator failures.
- Proxy accessibility review can miss real assistive-technology barriers.
- Using real medical or transcript material can create privacy and rights risk.
- Combining cohorts without separate denominators can hide subgroup exclusion.

## Blockers

The protocol cannot begin until the entry criteria pass on canonical staging and an approved human-research owner authorizes participant handling.

## Confidence

- 0.94 that this protocol covers the required personas, workflows, states, safety tasks, and accessibility modes.
- 0.00 as a claim that human validation has occurred.

## Paths

Protocol path:

`/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/agents/ux_current/human_validation_protocol.md`

## Root Handoff

Root should keep real human validation `NOT STARTED`. Execute this protocol only after staging entry gates pass, preserve privacy-safe raw evidence outside Git, and commission independent verification before any UX or accessibility green claim.

============================================================
FILE: agents/ux_current/responsive_audit.md
============================================================
# I1Q-1007X Current Responsive Audit

## Current Scope

This is a source-based and deterministic-DOM responsive review at repository commit `ccb8b73899c81ba0d028638be0d79b6a351f0ceb`. The reviewed UI bytes last changed at `4b154e8deb60ddf9a002f8a01a8fec90518b8966`.

Browser viewport execution, screenshots, device testing, 200 percent zoom, 400 percent reflow, text-spacing overrides, and touch testing were unavailable. No standalone Playwright or Computer Use substitute was used. Responsive certification is therefore not proven.

## Evidence

- `public/index.html` defines a responsive viewport and a 320-pixel minimum body width.
- `public/styles.css` has breakpoints at 1100 and 760 CSS pixels.
- The 760-pixel breakpoint collapses the shell to one column, reduces padding, hides the identity label, stacks metrics and filters, and makes tables independently scrollable.
- A reduced-motion media query is present.
- Deterministic DOM simulation proved that all 17 workflow renderers complete, but it did not calculate layout or paint pixels.
- A source-to-selector comparison identified core rendered classes with no matching CSS selector.

## Findings

### RESP-CUR-001: Mobile navigation has contradictory state

Severity: High.

The script toggles `aria-expanded` and an `is-open` class. The stylesheet has no rule for `.nav-toggle`, `.brand-row`, or `#primary-nav.is-open`. At 760 pixels and below, `#primary-nav` is always a horizontally scrollable flex row.

Result: the navigation can be visible while the toggle says it is collapsed. All 17 destinations require horizontal discovery.

### RESP-CUR-002: Core responsive component styles are missing

Severity: High.

Rendered classes without source-level style coverage include:

- `action-status`
- `brand-row`
- `choice-editor`
- `command-stack`
- `context-list`
- `control-reason`
- `detail-list`
- `disabled-command`
- `layout-run`
- `nav-toggle`
- `pagination`
- `record-context`
- `review-criteria`
- `scenario-control`
- `scenario-state`
- `state-notice`
- `status-list`
- `transcript-list`
- `transcript-meta`
- state and action tone classes

Result: the current CSS cannot prove stable hierarchy, wrapping, spacing, or target geometry for the actual rendered application.

### RESP-CUR-003: Transcript responsive rules target unused markup

Severity: Medium.

The stylesheet defines `.transcript-line`, while the client renders `.transcript-list` and `.transcript-meta`. The 760-pixel transcript grid rule does not apply to the current transcript workflow.

### RESP-CUR-004: Topbar width is not bounded for the synthetic control

Severity: High pending browser verification.

The topbar is a non-wrapping flex row. Local synthetic mode reveals a labeled state select plus refresh control. `.scenario-control` has no CSS and all selects have `width: 100%`. At 320 CSS pixels and zoomed widths, title and controls may overflow or compress unpredictably.

### RESP-CUR-005: Long-content behavior is unverified

Severity: High for certification.

No real browser run covers long source titles, hashes, clinical stems, choices, evidence claims, reviewer identities, blocker explanations, transcript segments, 10,000-plus queues, or translated text. Table-level horizontal scrolling is present, but body-level overflow and text clipping are not measured.

### RESP-CUR-006: Zoom and text-spacing compliance are unknown

Severity: Release blocker.

The stylesheet has no browser evidence at 200 percent zoom, 400 percent reflow, 320 CSS pixels, or the WCAG text-spacing override. Source rules alone do not prove reflow.

## Responsive Matrix Result

| Width or mode | Source expectation | Evidence status | Verdict |
| --- | --- | --- | --- |
| 1920 desktop | 236-pixel sidebar plus workspace | No browser capture | Not proven |
| 1440 desktop | Same desktop shell | No browser capture | Not proven |
| 1280 desktop | Same desktop shell | No browser capture | Not proven |
| 1100 threshold | Metrics and filters reduce, two-column views stack | CSS only | Partial |
| 1024 tablet | Stacked content with desktop sidebar | CSS only | Partial |
| 768 tablet | Just above mobile breakpoint | No browser capture | Not proven |
| 760 mobile threshold | Single-column shell and horizontal navigation | CSS only, state conflict | Blocked |
| 390 phone | Mobile rules should apply | No browser capture | Not proven |
| 320 minimum | Body minimum and mobile rules | No browser capture | Not proven |
| 200 percent zoom | Effective narrow viewport expected | Not executed | Blocked |
| 400 percent reflow | 320 CSS-pixel task flow expected | Not executed | Blocked |
| Reduced motion | Motion durations reduced | CSS only | Partial |
| Text spacing override | Unknown | Not executed | Blocked |

## Changes

No CSS, HTML, JavaScript, test, screenshot, or runtime change was made.

## Tests

- Static responsive source test passed.
- DOM simulation rendered all workflows and states without duplicate IDs or broken ARIA references.
- No browser layout, screenshot, pixel, touch, hover, computed-style, or visual regression test was run.

## Risks

- Controls may overlap or leave the viewport at narrow widths.
- A user may not discover destinations hidden beyond the horizontal navigation strip.
- Long hashes and evidence identifiers may force body-level overflow because `hash-text` has no style.
- Default fieldset and list styles may increase overflow in authoring and review views.
- The lack of visual evidence prevents a MissionMed premium design-language claim.

## Blockers

1. Implement coherent mobile navigation with CSS and state parity.
2. Add complete styles for every rendered component and state.
3. Align transcript markup and responsive selectors.
4. Run 320, 390, 760, 768, 1024, 1280, 1440, and 1920 browser checks.
5. Run 200 percent zoom, 400 percent reflow, text-spacing, reduced-motion, and long-content checks.
6. Preserve raw screenshots, viewport metadata, browser versions, and hashes.

## Confidence

- 0.98 in source-level selector and state findings.
- 0.82 in predicted overflow risk.
- 0.00 as a responsive or visual certification claim.

## Paths

Evidence paths and hashes are listed in `ux_workflow_audit.md`. This report is located at:

`/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/agents/ux_current/responsive_audit.md`

## Root Handoff

Root should keep responsiveness and visual quality red. The current CSS is a useful base, but browser matrices and a complete component stylesheet are prerequisites for staging certification.

============================================================
FILE: agents/ux_current/ui_repairs.md
============================================================
# I1Q-1007X Current UI Repair Backlog

## Current Scope

This is a proposed repair backlog for the current local build at repository commit `ccb8b73899c81ba0d028638be0d79b6a351f0ceb`. The reviewed UI bytes last changed at `4b154e8deb60ddf9a002f8a01a8fec90518b8966`. It is documentation only. No product code, test, migration, evidence, flag, or provider state was changed.

The repairs preserve all protected-answer, privacy, rights, immutable-revision, and consumer-flag boundaries.

## Evidence

The backlog derives from the source paths, hashes, tests, DOM simulations, contrast calculations, and evidence-validator result recorded in the other six files in this directory.

## Findings

The current repair order is driven by four release-safety defects: selected source context can drift, expired evidence can contradict active editorial controls, responsive component styling is incomplete, and action feedback can lose focus during rerender. Browser, assistive-technology, large-queue, canonical-auth, and human evidence remain additional certification gaps.

## P0 Repairs

### UI-CUR-001 Bind one selected source context across every source workflow

Owner: Question Platform UI and datastore adapter.

Finding:

- Inventory passes `inventory_sources.id` into state.
- Source detail searches `source_records.id`, then falls back to the first source.
- Source detail always uses the first inventory row.
- Transcript evidence always uses the first inventory row and every segment.
- Privacy selection depends on the mismatched source state.

Change:

- Store distinct `selectedInventorySourceId`, `selectedSourceRecordId`, and `selectedTranscriptArtifactId` values.
- Resolve their authoritative joins through stable canonical identifiers.
- Filter transcript artifacts by selected inventory source.
- Filter normalized segments by selected transcript artifact.
- Bind rights and privacy records to the same source context.
- Fail closed with a visible lineage error when any link is missing or ambiguous.

Acceptance:

- A fixture with at least three sources proves that no title, ID, hash, rights record, privacy record, artifact, or segment can cross source boundaries.
- Deep navigation from Inventory through Source, Privacy, Transcript, Candidate, Item, and Audit preserves one displayed context.
- Tests fail if a renderer falls back to the first unrelated row.

### UI-CUR-002 Make evidence currency a decision gate

Owner: Review UI and review service.

Finding:

The editorial view displays an expired-evidence block but computes `canReview` without `!expired`.

Change:

- Include evidence currency in control eligibility.
- Keep server enforcement authoritative.
- Return an exact, safe reason when evidence expires between render and submission.
- Require fresh exact-revision review after evidence replacement.

Acceptance:

- Expired, aging beyond policy, retracted, conflicted, superseded, and missing claims cannot produce an editorial pass.
- Controls, accessible descriptions, API response, audit event, and recovery copy agree.

### UI-CUR-003 Complete the component stylesheet and mobile-navigation contract

Owner: UI engineering and product design.

Change:

- Add stable styles for every rendered class, especially record context, details, notices, scenarios, action status, blocked commands, run layout, review criteria, transcript list, pagination, hashes, and navigation toggle.
- Make `aria-expanded`, visual visibility, and `is-open` agree.
- Group 17 workflows for novice discovery without hiding current location from keyboard and screen-reader users.
- Preserve the restrained MissionMed operational design language.

Acceptance:

- No rendered component class lacks an intentional style or documented native-style decision.
- Mobile navigation is visible only when programmatic state says it is open.
- No overlap, clipping, body-level overflow, or inaccessible off-screen control occurs at the required matrix.

### UI-CUR-004 Preserve focus and status across rerenders

Owner: UI accessibility engineering.

Change:

- Define a focus destination for navigation, filtering, selection, save, decision, queue, retry, resume, release assembly, errors, and conflicts.
- Do not focus a status node that is immediately hidden.
- Preserve success and error feedback until acknowledged or until a later action supersedes it.
- Use one live announcement path per event.

Acceptance:

- Keyboard focus remains visible, valid, and predictable after every action.
- VoiceOver, NVDA, and JAWS announce one understandable status in the intended priority.
- Automated tests fail on detached focus, duplicate announcements, or cleared feedback.

### UI-CUR-005 Replace fixture-only coverage with natural state-path tests

Owner: UI QA and API integration.

Change:

- Keep deterministic state fixtures for design review.
- Add API-backed tests that naturally produce all 16 states.
- Test role denial, source absence, rights and privacy blocks, evidence expiry, reviewer conflict, stale and concurrent revisions, and extraction retry or resume.

Acceptance:

- Every state has route input, expected status, visible remedy, focus result, live announcement, and recovery assertion.
- State fixtures cannot be counted as production-path proof.

## P1 Repairs

### UI-CUR-006 Add server-side large-list contracts

Owner: API and UI engineering.

Change:

- Replace first-200 client filtering with cursor-backed server search, filters, sorting, and pagination.
- Preserve selected item and filter state without browser-stored protected content.

Acceptance:

- Inventory, candidates, revisions, review queues, incidents, and audit events remain responsive and accurate with 10,000-plus records.
- Query-plan and interaction evidence includes worst-case filters and rapid paging.

### UI-CUR-007 Integrate canonical actor and role context

Owner: MissionMed HQ auth adapter and Question Platform UI.

Change:

- Replace local actor assumptions with a server-supplied safe actor and role summary.
- Do not expose credentials, tokens, or unrestricted role material.
- Keep physician controls unavailable until assignment, credential, governance, conflict, evidence, and exact-hash gates all pass.

Acceptance:

- Positive and negative role matrices match server authorization.
- Expired, revoked, stale, or unavailable sessions fail closed with usable reauthentication guidance.

### UI-CUR-008 Improve authoring recovery without storing protected content unsafely

Owner: Authoring UI, security, and privacy.

Change:

- Provide a governed draft-recovery design that never leaks answer material into unsafe browser storage.
- Show field-level changes when a newer immutable revision exists.
- Require deliberate reapply or discard.

Acceptance:

- A refresh, session interruption, stale edit, and concurrent revision cannot silently lose work or overwrite a newer revision.
- Security review confirms no protected answer or source payload persists outside approved storage.

### UI-CUR-009 Raise focus-indicator contrast

Owner: Design system.

Change:

- Use a focus treatment with at least 3:1 contrast against both light and dark adjacent colors.
- Preserve at least a 2-pixel equivalent indicator and unobscured outline.

Acceptance:

- Computed contrast and browser screenshots pass for every interactive component and state.

### UI-CUR-010 Expand UI regression coverage

Owner: UI QA independent of the implementer.

Change:

- Execute all 17 workflows, all 16 states, every enabled command, blocked-command reason, form validation, focus transition, live region, and source-lineage invariant.
- Add responsive browser tests only when the approved browser environment is available.

Acceptance:

- Current source-pattern checks remain supporting checks, not the primary release evidence.
- Raw results identify commit, environment, browser, viewport, zoom, reduced motion, and fixture hashes.

## P2 Repairs

### UI-CUR-011 Improve navigation efficiency

Owner: Product design.

Change:

- Group the 17 workflows by Sources, Extraction, Authoring, Review, Release, and Operations.
- Provide current-work context, recent records, and safe shortcuts.
- Do not hide destinations behind icon-only controls.

Acceptance:

- First-time and power-user tasks meet the human protocol without navigation error or excessive tab travel.

### UI-CUR-012 Run the genuine board and human protocol

Owner: UX lead and independent accessibility verifier.

Acceptance:

- The 10 required personas and 15 categories are evaluated from observed tasks.
- Aggregate reaches at least 9.0 and no category is below 8.5.
- Every critical or high finding is repaired and retested.

## Changes

No repair was implemented in this audit. This file is the complete change proposal.

## Tests

Current evidence before repair:

- UI: 6 passed, 0 failed.
- Full local package: 196 passed, 0 failed, 1 skipped.
- Workflow DOM simulation: 17 of 17 rendered.
- State DOM simulation: 16 of 16 rendered.
- Evidence validation: failed with 19 errors.
- Browser and assistive-technology execution: unavailable.

## Risks

- Repairing source joins can affect privacy and rights visibility, so tests must use only synthetic or privacy-safe data.
- Adding canonical auth must not weaken current fail-closed server behavior.
- Draft recovery must not put answers, explanations, raw source content, or private references into unsafe client storage.
- Styling repairs must not turn safety states into color-only distinctions.

## Blockers

P0 items UI-CUR-001 through UI-CUR-005 block UX, accessibility, staging, and State C certification.

## Confidence

- 0.97 that the P0 items are required before staging certification.
- 0.83 in the P1 and P2 ordering pending integrated browser and performance evidence.

## Paths

Repair targets are under:

`/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/i1q-question-platform/`

This backlog is under:

`/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/agents/ux_current/ui_repairs.md`

## Root Handoff

Root should schedule P0 work before any browser certification, then run P1 scale and auth integration, then commission the independent P2 board and human validation. Keep student, STAT, and Drills flags off throughout.

============================================================
FILE: agents/ux_current/ux_release_verdict.md
============================================================
# I1Q-1007X Current UX Release Verdict

## Verdict

`BLOCK` for UX, UI, accessibility, responsive, and human-validation certification.

The current build is materially stronger than the 1006 baseline. It now exposes and deterministically renders all 17 required workflows and all 16 required state fixtures. That improvement is real local synthetic engineering evidence.

It is not enough for State C. The current candidate has unresolved source-lineage and decision-gating defects, incomplete styling, unverified focus and announcement behavior, no real browser or assistive-technology run, no human validation, and a failing evidence package.

## Current Scope

- Repository commit at validation: `ccb8b73899c81ba0d028638be0d79b6a351f0ceb`.
- Last UI-changing commit: `4b154e8deb60ddf9a002f8a01a8fec90518b8966`.
- Mode reviewed: local synthetic internal application.
- Browser status: unavailable.
- Assistive-technology status: not executed.
- Human-validation status: not executed.
- Medical content status: no medical approval reviewed or claimed.
- Student, STAT, and Drills release status: must remain off.

## Evidence

- Five current source files and hashes recorded in `ux_workflow_audit.md`.
- UI tests: 6 passed, 0 failed.
- Full local package tests: 196 passed, 0 failed, 1 skipped.
- Workflow DOM simulation: 17 of 17 rendered.
- State DOM simulation: 16 of 16 rendered.
- Rendered semantic scan: no unnamed controls, duplicate IDs, or broken accessible-reference IDs.
- Evidence validator: failed with 19 errors.
- Browser screenshots, computed layout, accessibility tree, and AT speech: absent.

## Findings

Release-veto grounds:

1. Inventory selection, source-record selection, privacy selection, transcript-artifact selection, and transcript segments are not joined to one authoritative selected context.
2. Editorial eligibility omits expired evidence while the UI states that expired evidence blocks verdicts.
3. Core rendered classes and mobile navigation state have no corresponding CSS contract.
4. Action feedback and keyboard focus can be removed by immediate rerender.
5. Focus outline contrast is 2.92:1 on the dark sidebar, below 3:1.
6. Search and queue behavior reads only a bounded first page and does not prove 10,000-plus operation.
7. Current UI automation exercises only Dashboard and Inventory end to end.
8. `npm run validate` fails closed with 19 current evidence errors.
9. WCAG 2.2 AA, responsive behavior, visual quality, and complete keyboard operation are not proven in a real browser.
10. Genuine physicians, editors, first-time operators, assistive-technology users, release managers, and incident responders have not validated the experience.

## Simulated Score

- Method: simulated expert review only.
- Aggregate: `5.87 / 10`.
- Minimum category: `source_traceability`, `4.3 / 10`.
- Required aggregate: at least `9.0 / 10`.
- Required category floor: at least `8.5 / 10`.
- Result: `FAIL`.

The complete category evidence is in `usability_scorecard.json`. These values are not human observations and must not be represented as empirical UX results.

## Changes

Exactly seven report artifacts were created under `agents/ux_current/`. No application asset, code, test, server, migration, evidence file, Git state, flag, protected runtime, or provider state was modified by this specialist.

## Tests

Passed deterministic checks are useful for continued local engineering. They do not lift the release veto because they lack browser, staging, canonical-auth, real-data, AT, and human scope.

## Risks

- A reviewer could reason from the wrong source context.
- A control can invite a decision that visible evidence says is blocked.
- Responsive and accessibility failures may remain invisible to source and JSDOM tests.
- Synthetic fixture success can be mistaken for real integration readiness.
- A stale evidence estate can support false release conclusions unless validation remains fail closed.

## Blockers

- Complete P0 items UI-CUR-001 through UI-CUR-005.
- Pass current evidence validation.
- Pass canonical staging browser and responsive matrices.
- Pass complete keyboard and assistive-technology testing.
- Execute `human_validation_protocol.md` and close every critical or high finding.
- Obtain fresh independent UX and accessibility verification.

## Confidence

- 0.99 that the current candidate cannot clear UX and accessibility release gates.
- 0.97 in the source-lineage and expired-evidence findings.
- 0.80 in visual and responsive severity pending browser execution.
- 0.00 as a claim of human validation, WCAG conformance, staging, production, or State C.

## Paths

Current report directory:

`/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/agents/ux_current/`

Expected files:

- `ux_workflow_audit.md`
- `accessibility_audit.md`
- `responsive_audit.md`
- `usability_scorecard.json`
- `ui_repairs.md`
- `human_validation_protocol.md`
- `ux_release_verdict.md`

## Root Handoff

Root should record the current UX verdict as `BLOCK`, the simulated score as `5.87`, accessibility as `NOT PROVEN`, and human validation as `NOT STARTED`. Preserve all release flags off, route the P0 repairs, rerun evidence validation, then commission browser, AT, human, and independent final-wave review. Do not claim State C from the current packet.

============================================================
FILE: agents/ux_current/ux_workflow_audit.md
============================================================
# I1Q-1007X Current UX Workflow Audit

## Current Scope

This is a read-only expert review of the current local Question Platform build at repository commit `ccb8b73899c81ba0d028638be0d79b6a351f0ceb`. The reviewed UI bytes last changed at commit `4b154e8deb60ddf9a002f8a01a8fec90518b8966`; the later repository commit added offline datastore candidate files without changing any reviewed UI, server-shell, or UI-test hash.

The reviewed surface is the local synthetic internal application. This report does not certify staging, production, medical content, canonical authentication, real corpus use, or student release.

Browser execution was unavailable. No standalone Playwright or Computer Use substitute was used. Interaction findings come from source inspection, the repository test suite, and deterministic JSDOM simulation. Visual and assistive-technology findings remain unverified until genuine browser and human testing occurs.

## Evidence

Reviewed paths:

- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/i1q-question-platform/public/index.html`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/i1q-question-platform/public/styles.css`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/i1q-question-platform/public/app.js`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/i1q-question-platform/src/server.mjs`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/i1q-question-platform/tests/ui.test.mjs`

Reviewed file hashes:

| Path | SHA-256 |
| --- | --- |
| `public/app.js` | `21205e3c1d85293a4eb5e4e9a80ccf0623188e936d6ce594bb142daaa29e340c` |
| `public/index.html` | `664b5e7661ee1b8dbea8005097c6b6c8c10c336a97b2bc10c2393c4070227a49` |
| `public/styles.css` | `d1ebbb9cdf5c6c5cdb14af1e101a0f6b79d217507acee02e4a4096f6cca14cb8` |
| `src/server.mjs` | `eacdedd01ac4c3ca52becabbaad208109f677da3acdf08878d1a3fedc0bb094d` |
| `tests/ui.test.mjs` | `c8d60fb5c3127b795ab121c422bfdd69d63ea3e486bf4512e90767e9f2a540b4` |

## Findings

All required workflows and state fixtures now have deterministic local rendering coverage. Release remains blocked because selected source context is not reliably joined across workflows, expired evidence is omitted from editorial control eligibility, key responsive component styles are absent, focus and status continuity need repair, and no real browser or human validation exists.

## Workflow Findings

`DOM PASS` means the workflow rendered in deterministic JSDOM against the local synthetic API. It does not mean browser, visual, human, or production acceptance.

| Required workflow | Current result | Finding |
| --- | --- | --- |
| Dashboard | DOM PASS, partial | Counts, governance blockers, all six feature flags, and consumer guardrails render. The source is local synthetic data and no canonical session was exercised. |
| Corpus inventory | DOM PASS, unsafe handoff | Search and availability filters render, but `Open details` stores an inventory ID while Source detail expects a source-record ID. The selected record can drift. |
| Source detail | DOM PASS, blocked for traceability | Source, inventory, rights, and privacy data render, but the source is selected independently while inventory is always the first row at `app.js:552-553`. Multi-source evidence can be mislabeled. |
| Privacy status | DOM PASS, partial | All eight required privacy classes render and write controls are correctly blocked. Selection depends on the mismatched source identifier, so the displayed record is not reliably bound to the inventory choice. |
| Transcript evidence | DOM PASS, blocked for traceability | Safe segments and explicit availability render. The workflow uses the first inventory row and every returned segment at `app.js:666-667`, without binding artifact and segment rows to the selected source. |
| Extraction runs | DOM PASS, synthetic only | Queue, queued, running, failed, retry, checkpoint, and resume fixtures work in memory. They are labeled non-clinical and do not prove a persisted extraction service. |
| Candidate triage | DOM PASS, read-only | Sanitized metadata renders. Assignment, quarantine, and rejection remain blocked because no governed write route is exposed. |
| Question authoring | DOM PASS, partial | The explicit save route creates an immutable revision and checks current hash plus newest revision. Protected values are not prefilled. There is no durable draft recovery, and rerendered success feedback can lose focus. |
| Distractor review | DOM PASS, read-only | Four sanitized choices and review criteria render, while answer-aware review and durable review recording remain unavailable. |
| Evidence claims | DOM PASS, read-only | Claim text, authority, status, and expiry render. Governed evidence creation is intentionally unavailable. |
| Editorial review | DOM PASS, unsafe edge | Exact revision and assignment context render and a verdict can be submitted. `canReview` at `app.js:1019` omits the computed expired-evidence condition even though the page says expired evidence blocks verdict controls. |
| Physician review | DOM PASS, correctly blocked | The local role and unassigned medical governance keep approval controls unavailable. Canonical credential and actor integration were not exercised. |
| Revision comparison | DOM PASS, partial | The current fixture has one revision, so the empty state is reached. Static inspection shows a field table for two revisions, but no real-browser comparison task was executed. |
| Search and filters | DOM PASS, scale-limited | Query, status, sorting, and client pagination render. Only the first 200 revisions are requested, so the 10,000-plus queue requirement is not met. |
| Release assembly | DOM PASS, correctly blocked | Exact revision, medical approval, evidence currency, and consumer flags render. Promotion is unavailable and no staging release was assembled. |
| Incidents | DOM PASS, read-only | Immutable incident records and an empty state render. Incident creation is intentionally blocked because no governed route is exposed. |
| Audit trail | DOM PASS, partial | Filters, immutable event details, hashes, and sequence-link continuity render. The UI correctly disclaims cryptographic verification. Large-volume behavior is untested. |

## State Findings

All 16 required state fixtures rendered with the requested `data-state`, a recovery command, a synthetic-only boundary, and focused state heading in deterministic DOM simulation.

| Required state | DOM fixture | Natural workflow evidence | Current result |
| --- | --- | --- | --- |
| Loading | Yes, `status` | Initial and per-view loading markup | Partial, no latency or AT run |
| Empty | Yes, `status` | Inventory, triage, evidence, diff, search, incidents | Partial, no browser run |
| Blocked | Yes, `status` | Governance and release blocks | Partial, API paths not exhaustive |
| Unauthorized | Yes, `alert` | Physician role and API errors | Partial, canonical auth absent |
| Error | Yes, `alert` | Safe retry renderer | Partial, outage recovery untested |
| Partial source | Yes, `status` | Source and transcript availability | Partial, source binding defective |
| Privacy blocked | Yes, `status` | Source and privacy notices | Partial, governed resolution unavailable |
| Rights blocked | Yes, `status` | Source notice | Partial, governed resolution unavailable |
| Expired evidence | Yes, `status` | Evidence and review notices | Unsafe, editorial controls can remain active |
| Review conflict | Yes, `status` | Editorial conflict check | Partial, role matrix untested in browser |
| Stale edit | Yes, `status` | Newer-revision check before save | Partial, durable recovery absent |
| Concurrent edit | Yes, `status` | Revision and assignment hash checks | Partial, editor API conflict gets generic status |
| Extraction queued | Yes, `status` | In-memory fixture | Synthetic only |
| Extraction running | Yes, `status` | In-memory fixture | Synthetic only |
| Extraction failed | Yes, `status` | In-memory fixture | Synthetic only |
| Extraction resumable | Yes, `status` | In-memory fixture | Synthetic only |

## Persona Findings

- Physician reviewer: exact-revision identity is visible, but approval is correctly unavailable and real credentialed operation is untested.
- Medical educator and editorial reviewer: core forms exist, but expired evidence can contradict enabled controls and saved-feedback focus is unstable.
- Assessment scientist: distractor criteria are visible, but no answer-aware review or quality evidence can be recorded.
- Privacy officer: all eight classes are visible, but the selected source can map to the wrong privacy record.
- Novice operator: named navigation is comprehensive, while 17 destinations and partially available commands impose a high learning burden.
- Power operator: filters exist, but no shortcuts, bulk actions, durable views, or server-side large-queue navigation exist.
- Assistive-technology user: semantic foundations are useful, but focus continuity and status announcement behavior need real AT testing.
- Release manager: release gates are legible and fail closed, but no staging workflow or manifest inspection run is proven.
- Incident responder: audit inspection is present, but incident creation and operational containment are not available.

## Changes

No application, test, server, migration, evidence, feature-flag, or provider change was made. This report is the only change represented by this file.

## Tests

- `node --check public/app.js`: passed.
- `node --test tests/ui.test.mjs`: 6 of 6 passed.
- `npm test`: 196 passed, 0 failed, 1 skipped disposable-PostgreSQL test.
- Deterministic JSDOM workflow simulation: 17 of 17 workflows rendered without an error state, except Physician review intentionally included an unauthorized notice.
- Deterministic JSDOM state simulation: 16 of 16 state fixtures matched requested identity, role, focus, recovery command, and synthetic boundary.
- Semantic DOM scan: no unnamed controls, duplicate IDs, or broken `aria-describedby` and `aria-labelledby` references in the local synthetic render.
- `npm run validate`: failed closed with 19 current evidence errors.

## Risks

- A wrong source, inventory record, transcript segment set, privacy record, or rights record can appear under one selected context.
- Editorial reviewers can receive a visual expired-evidence block while decision controls remain enabled.
- Local synthetic interactions can appear more complete than the unavailable real datastore and canonical-auth experience.
- Client-only list loading cannot support the required large corpus safely or efficiently.
- The code-level semantic checks do not expose visual overflow, contrast, browser focus, or assistive-technology behavior.

## Blockers

1. Repair selected-record lineage across inventory, source, privacy, transcript artifact, and transcript segment views.
2. Include evidence currency in editorial decision eligibility and verify the server rejects stale evidence.
3. Complete current CSS and responsive behavior, then run real browser matrices.
4. Repair focus and live-status continuity after rerendering actions.
5. Pass genuine keyboard, screen-reader, zoom, reduced-motion, contrast, and target-size validation.
6. Complete the real human protocol before any UX or accessibility green claim.

## Confidence

- 0.98 in workflow and state source coverage findings.
- 0.97 in the source-selection and expired-evidence defects.
- 0.78 in visual and responsive risk severity because browser rendering was unavailable.
- 0.00 as a claim of real human validation or WCAG 2.2 AA conformance.

## Paths

Application root:

`/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/i1q-question-platform/`

Current audit directory:

`/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/agents/ux_current/`

## Root Handoff

Root should preserve the UX release veto, treat the DOM passes as local synthetic engineering evidence only, and route the P0 repairs in `ui_repairs.md` before staging certification. Do not use this report to claim State C, medical approval, or student release.

============================================================
FILE: I1Q_1007X_ACCESSIBILITY.md
============================================================
# I1Q-1007X Accessibility

## Verdict

`WCAG 2.2 AA NOT PROVEN`

## Local Improvements

The shell uses navigation and main landmarks, one page heading, native controls, labels, fieldsets, table headers, live status, a skip link, reduced-motion rules, named buttons, non-color status cues, and deterministic focus targets.

The current repair wave added a real mobile navigation contract, a high-contrast sidebar focus override, styles for previously unstyled operational components, one live announcement path for action feedback, and status persistence across rerenders. Automated DOM tests cover all 17 workflows, required state labels, accessible shell primitives, and selected-source lineage.

## Missing Evidence

No real browser, accessibility tree, VoiceOver, NVDA, JAWS, switch control, keyboard-only task run, 200 percent zoom, 400 percent reflow, text-spacing, target-size, or focus-obscuration test occurred. No independent accessibility specialist verified the repaired candidate.

Source and JSDOM evidence cannot establish WCAG conformance. Accessibility remains a State C veto until the staged authenticated build passes the documented protocol.

============================================================
FILE: I1Q_1007X_AGENT_CHARTERS.md
============================================================
# I1Q-1007X Agent Charters

## Shared Charter

Every agent is one contributor in a shared worktree. Agents must preserve concurrent work, stay within assigned paths, report exact evidence, and stop before touching another owner's files. No agent may change MissionMed OS authority, apply a migration, deploy, access secrets, read student data, or weaken a protected system. The root supervisor resolves conflicts and integrates work.

## Root Supervisor

Owns source integrity, MissionMed OS recovery, authority, branch and commit control, shared-system baselines, migration application, staging and production actions, convergence, final claims, activity logs, and the complete combined handoff.

## Ecosystem Mapper

Maps all consumers and contracts for MissionMed HQ auth, STAT datasets and sealed packs, Drills and Daily Rounds registries, Supabase boundaries, GitHub deployment, WordPress relays, and historical joins. Read-only until the root records a baseline and security approves an additive boundary.

## Privacy and Rights Agent

Owns source-eligibility, student/patient/third-party redaction rules, raw-versus-working access, Rights Record interpretation, likely versus verified Dr. J classification, privacy benchmark design, and privacy evidence. May not expose raw restricted text in reports.

## Medical Knowledge Agent

Owns medical claim/evidence design, medical-review gates, source adequacy, uncertainty, conflict handling, and physician-review requirements. May not invent medical content, approvals, credentials, or quotations.

## Assessment Science Agent

Owns item quality, answerability, distractor rationale standards, explanation quality, difficulty and taxonomy compatibility, pairing benchmarks, and candidate-yield interpretation. Candidate generation remains quarantined and unapproved.

## Architecture and Data Agent

Owns review of the additive `i1q` schema, immutability, lineage, review events, exports, answer-key separation, compatibility projections, migration ordering, and rollback design. The root alone applies migrations.

## Auth and Security Agent

Owns threat modeling, canonical auth adapter verification, deny-by-default roles, transaction-local context, forced RLS, answer leakage, audit integrity, dependency and secret scanning, and release security criteria. May issue a veto.

## Internal App Agent

Owns bounded application changes for the authorized internal workflows and states. Must reuse the approved auth boundary and cannot add a parallel identity system or student-facing path.

## UX and Accessibility Agent

Owns workflow completeness, operator usability, WCAG 2.2 AA evidence, responsive behavior, keyboard and screen-reader validation, error and recovery states, and simulated-board protocol. Synthetic markup checks are not browser evidence.

## Corpus and Extraction Agent

Owns read-only source inventory, explicit transcript/VTT/nodes availability, privacy-safe normalization, provisional benchmark execution, extraction lineage, and quarantined candidate generation. Source systems are immutable.

## Adapter Agent

Owns static legacy v4 reconciliation, the exact STAT nine-column projection, composite metadata identity, Class A pre-answer behavior, server-only answer maps, and read-only Drills compatibility. Consumer flags stay off during validation.

## Release and Reliability Agent

Owns staging evidence, backup identity, migration rehearsal, rollback and re-apply evidence, monitoring, health checks, performance, dependent-product smoke tests, and deploy manifests. The root performs release actions.

## Independent Red Team

Receives a fixed final candidate after integration. Independently verifies authority, privacy, auth, RLS, answer secrecy, workflows, accessibility, rollback, monitoring, and claim truthfulness. A veto blocks deployment or State C declaration.

============================================================
FILE: I1Q_1007X_AGENT_OWNERSHIP_MATRIX.md
============================================================
# I1Q-1007X Agent Ownership Matrix

## Ownership Rules

- One writer per path at a time.
- Shared authority and deployment files are root-only.
- Agents may inspect outside their write scope only when authorized and privacy-safe.
- Existing changes by other workers must be preserved.
- No subagent may apply migrations, deploy, merge, or alter feature flags.

## Current Assignments

| Owner | Write scope | Read scope | Status |
| --- | --- | --- | --- |
| Root Supervisor | All root reports; MissionMed OS registration and decision; integration commits; migration/deploy manifests | All authorized project and authority inputs | FINAL INTEGRATION COMPLETE |
| Ecosystem Mapper | `agents/ecosystem_mapper/` only | Shared consumers and contracts, read-only | COMPLETE |
| Privacy and Rights | `agents/privacy_rights/` only | Authorized corpus metadata and privacy-safe samples | COMPLETE, PRIVACY VETO RETAINED |
| Medical Knowledge | `agents/medical_content/` only | Architecture, schemas, review requirements, privacy-safe fixtures | COMPLETE, NO MEDICAL APPROVAL |
| Assessment Science | `agents/assessment_science/` only | Schemas, validators, privacy-safe fixtures | COMPLETE, RELEASE VETO RETAINED |
| Architecture and Data | `agents/datastore_contracts/` only | `i1q-question-platform/`, migrations, export contracts | COMPLETE |
| Auth and Security | `agents/lorentz_security/` and `agents/security_integrated/` | Auth, RLS, migrations, dependency and deployment surfaces | COMPLETE, ACTIONABLE LOCAL DEFECTS REPAIRED |
| Internal App | Root-integrated application paths | `i1q-question-platform/` | LOCAL SYNTHETIC BUILD COMPLETE |
| UX and Accessibility | `agents/ux_accessibility/` and `agents/ux_current/` | UI, tests, evidence and screenshots | COMPLETE, RELEASE VETO RETAINED |
| Corpus and Extraction | Root-integrated reports only | Authorized registries and corpus, read-only | INVENTORY COMPLETE, EXTRACTION BLOCKED |
| Adapter | Root-integrated adapter paths | STAT and Drills contracts, read-only | LOCAL CONTRACTS COMPLETE, FLAGS OFF |
| Release and Reliability | `agents/release_reliability/` only | CI, staging, monitoring, backup and rollback evidence | COMPLETE, DEPLOYMENT BLOCKED |
| Darwin | `agents/darwin/` only | Current integrated code and tests | COMPLETE, LOCAL PARITY PASS, EXTERNAL RELEASE BLOCKED |
| Independent Red Team | `agents/independent_red_team/` only | Initial audit, iterative reruns, failed `65bb52c`, and exact final `ba17e22` candidate | COMPLETE, IRT-009 AND IRT-010 CLOSED LOCALLY, STATE C VETO RETAINED |
| Final Exact Red-Team Verifier | `agents/red_team/` only | Historical counterexamples through IRT-009-H4 and exact pushed checkpoint `ba17e22` | COMPLETE, STATE A CLEAR QUALIFIED ONLY, STATES B C D VETOED |

## Repair Wave 1 Assignments

These scopes apply after the baseline audit commits and are intentionally disjoint.

| Owner | Exclusive application write scope | Test scope | Prohibited overlap |
| --- | --- | --- | --- |
| Adapter and Identity Implementer | `i1q-question-platform/src/contracts.mjs`, `i1q-question-platform/src/exports.mjs`, `i1q-question-platform/src/adapters/**` | new `i1q-question-platform/tests/adapters-security.test.mjs` | auth, server, platform, privacy, pipeline, store, SQL, UI |
| Auth and Release Security Implementer | `i1q-question-platform/src/auth.mjs`, `i1q-question-platform/src/server.mjs`, `i1q-question-platform/src/platform.mjs` | new `i1q-question-platform/tests/security-regressions.test.mjs` | contracts, exports, adapters, privacy, pipeline, store, SQL, UI |
| Privacy Normalization Implementer | `i1q-question-platform/src/privacy.mjs`, `i1q-question-platform/src/pipeline.mjs` | new `i1q-question-platform/tests/privacy-regressions.test.mjs` | contracts, exports, adapters, auth, server, platform, store, SQL, UI |
| Evidence Validator Implementer | new `i1q-question-platform/src/validate-evidence.mjs` and new validator-only fixtures | new `i1q-question-platform/tests/evidence-validator.test.mjs` | existing evidence generator, app modules, SQL, UI |

Every implementer must run the existing 30-test suite plus its direct tests. No implementer may alter existing test files to make a failure disappear. Cross-scope integration and any necessary conflict repair belong to the root supervisor after all workers return.

## Root-Only Paths and Actions

- `/Users/brianb/MissionMed_OS/**`
- Shared MissionMed HQ auth and bootstrap files
- Shared runtime, global grants, and environment configuration
- Production and staging migration application
- GitHub branch merge and deployment actions
- Feature-flag changes
- Production monitoring and rollback actions
- Final combined handoff generation
- State A, B, C, or D claims

## Historical Untracked Material

The pre-existing untracked handoff directories visible at baseline have no agent owner in this run. They must not be staged, modified, deleted, or used as release evidence unless the root explicitly inventories and adopts an individual artifact.

============================================================
FILE: I1Q_1007X_AUTH.md
============================================================
# I1Q-1007X Authentication

## Verdict

`LOCAL CONTRACT PASS, CANONICAL INTEGRATION BLOCKED`

## Implemented Boundary

The internal service accepts a resolver-supplied identity context, validates session state, derives the actor and roles from that trusted context, and rejects missing, expired, revoked, stale, unvalidated, or unavailable sessions. Unsafe requests require a session-bound CSRF token and trusted Origin. Local synthetic mode is restricted to loopback and refuses normalized production environments or ambiguous forwarded-host input.

The browser shell obtains its actor summary and CSRF token from `GET /api/v1/session`. It does not create a second identity store, expose a sign-up path, or accept caller-provided roles.

Answer-bearing reviewer content uses a separate injected resolver. Production mode refuses the route when that adapter is absent. The adapter receives the trusted identity context and must return a closed-world payload bound to the accepted assignment, exact immutable revision, reviewer role, and editorial or medical purpose. Direct reader, wrong actor, wrong role, wrong purpose, open assignment, completed assignment, and wrong-hash attempts fail closed.

## Negative Evidence

Direct tests cover:

- missing and unavailable identity resolvers
- expired, revoked, stale, and unvalidated sessions
- missing or incorrect CSRF tokens
- untrusted Origin values
- local-demo attempts in production
- forwarded-proxy ambiguity
- actor, reviewer, assignment, role, credential, and revision-hash substitution
- missing or malformed protected-review adapters and wrong-purpose protected reads

All current local auth and security tests pass.

## External Gate

No canonical MissionMed HQ identity resolver has been wired to an I1Q host. No authenticated staging session, WordPress relay journey, Railway session, production timeout, reauthentication, or logout path was executed. The service therefore remains fail closed outside local synthetic mode.

## Release Rule

`internal_platform_enabled` and `internal_review_enabled` remain off. Authentication is not certified for State C until the canonical adapter is owner-provided, wired to the unprivileged datastore role, and proven in staging.

============================================================
FILE: I1Q_1007X_AUTHORITY_DECISION.md
============================================================
# I1Q-1007X Authority Decision

## Verdict

`CANONICALLY FILED AND EFFECTIVE`

Authority commit:

`b3d8089 docs(i1q): ratify protected internal integration`

Canonical candidate decision:

`/Users/brianb/MissionMed_OS/decisions/DR-006_i1q_question_platform_internal_integration.md`

The same commit updates `authority_index.json`, the Question Platform passport, `missions.json`, generated `CURRENT.md`, and the append-only MissionMed activity log.

## Ratified Boundary

`DR-006` records Brian's explicit authorization for:

- Dedicated authenticated internal Question Platform
- Canonical MissionMed HQ and WordPress-to-Railway-to-Supabase auth/session reuse
- No parallel identity, frontend sign-up, or global auth weakening
- New additive `i1q` schema in the RANKLISTIQ Supabase project
- Forward-only migrations through preview/staging and canonical GitHub delivery
- Forced RLS, deny-by-default roles, transaction-local actor and role context, immutable audit, assignment scope, and answer/source isolation
- Read-only inventory of authorized MissionMed-owned Dr. J, Drills, Daily Rounds, Stream, R2/CDN metadata, transcript, VTT, nodes, static registry, and MissionMed Drive sources
- Privacy-safe internal derivation with raw sources restricted
- Default removal of student speech, patient-identifying information, and third-party identities
- `likely_drj` versus `verified_drj` classification with authoritative evidence required for verification
- Read-only hashed legacy v4 export and non-student aggregate exposure metadata
- Composite `dataset_version` plus `question_id` compatibility identity
- Exact frozen STAT nine-field server projection
- Class A pre-answer artifacts without answers or explanations
- Server-only `answer_map` unavailable before finalization
- Explicit transcript, VTT, and nodes availability in Drills adapters
- Staging and authenticated internal production only after all gates pass

## Governance

Brian is interim privacy owner, editorial lead, taxonomy owner, misconception-vocabulary owner, release manager, incident owner, assessment-science owner, and rollback operator.

Medical governance lead remains `UNASSIGNED`. No credential is inferred from a title or name, and Dr. J is not automatically assigned. This blocks medical approval, approved release eligibility, and student-facing publication. It does not block engineering, inventory, privacy-safe extraction, quarantined candidate generation, or authenticated internal review.

## Pilot Thresholds

| Measure | Threshold |
| --- | --- |
| Medical-question detection precision | at least 0.90 |
| Medical-question detection recall | at least 0.80 |
| Question-answer pairing | at least 0.85 |
| Speaker attribution accuracy | at least 0.95 |
| Timestamp accuracy within two seconds | at least 0.90 |
| Privacy recall for patient-identifying information | at least 0.995 |
| Privacy recall for student names | at least 0.99 |

AI benchmarking may authorize only quarantined candidate generation. It cannot authorize student publication.

## Closed Actions

- Manual production SQL
- `railway up`
- Force push or history rewrite
- Ad hoc upload or direct runtime replacement
- Broad anonymous or authenticated datastore grants
- Mutation of source registries or media objects
- Mutation of the legacy v4 dataset
- Exposure of answers or explanations before finalization
- Student, STAT-consumer, or Drills-consumer enablement before the exact release gates pass

## Student Release Gate

Every student-facing revision requires an exact immutable Item Revision, completed editorial review, genuine credentialed physician review, current Evidence Claim, no conflict, no active safety flag, rights and privacy clearance, release validation, and Brian publication ratification.

This run must not claim State D without those real records.

## Canonical Filing

The authority branch passed independent verification and merged through MissionMed OS PR #12 at exact head `b3d8089dbc436bad6ec48de95e1d57b6985b7444`. The I1Q merge commit is `93c0404794fe105235b80514c75fffc3177f140b`. At the final read-only recheck, canonical `main` was clean and synchronized with `origin/main` at later separately owned RISE commit `0e47d39d79edd9891896eb41e65183e855573cc1`; `CURRENT.md` still listed I1Q-1006 active and DR-006 remained tracked. The protected integration decision is effective for the bounded internal implementation described here.

============================================================
FILE: I1Q_1007X_BASELINE.md
============================================================
# I1Q-1007X Baseline

Recorded: 2026-07-15, America/New_York

## Scope

This baseline opens ticket `I1Q-1007X-MA` for the MissionMed Question Platform. The authorized target is an authenticated internal application with student-facing publication disabled. State D is outside this run unless genuine credentialed physician approval records exist.

## Source Integrity

| Check | Result |
| --- | --- |
| Worktree | `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000` |
| Source branch | `i1q-question-platform-ultra-1006` |
| Target branch | `i1q-question-platform-ultra-1007x-ma` |
| Baseline HEAD | `0d6f78f2a2036731ec592398ce5fd845beb54333` |
| Required ancestor `0a05b4d` | PASS |
| Required ancestor `0d6f78f` | PASS |
| 1006 handoff SHA-256 | `ad311340c8ecbe7abf4f077fa92dc1ef32760d65bbac4ab9a70b76b4fe379572` |
| Expected handoff SHA-256 | MATCH |
| Remote | `origin https://github.com/brinyu13/missionmed-hq.git` |

The worktree contained pre-existing untracked historical handoff directories when this run began. They were not reset, cleaned, staged, or altered. No tracked source diff existed at branch creation.

## MissionMed OS Baseline

The MissionMed OS checkout initially had four modified tracked paths and 52 untracked paths while local `main` was 11 commits behind `origin/main`. No active Git operation existed, and the historical `.git/index.lock` was absent at inspection time.

Before recovery, the complete state was preserved externally at:

`/Users/brianb/MissionMed_AI_Sandbox/_RECENT_AI_OUTPUTS/I1Q-1007X-MMOS-PRESERVATION-20260715T112333Z`

The package contains status, refs, worktrees, remotes, reflog, binary diffs, tracked and untracked archives, per-file hashes and metadata, and a verified all-refs Git bundle. The exact preserved state was committed and pushed on:

| Field | Value |
| --- | --- |
| Recovery branch | `codex/i1q-1007x-mmos-preexisting-recovery` |
| Recovery commit | `91a680b1a2e5befd4fbe16b47f6e36f70fdaf419` |
| Canonical starting commit | `7144435` |
| Registration branch | `codex/i1q-1007x-registration` |
| Registration commit | `e88b12c` |
| Authority commit | `b3d8089` |
| Review | `brinyu13/missionmed-os#12` |

MissionMed OS lint, 33 state-feed unit tests, adapter and renderer contracts, the full read-only validation suite, JSON uniqueness checks, and a secret-pattern scan passed on the registration branch. GitHub checks for the review were green when this baseline was written. Independent review remains required before merge.

## Authority Baseline

The registration branch adds mission `I1Q-1006`, product `question-platform`, its product passport, authority entries, and decision record `DR-006`. Brian is recorded only in the authorized interim governance roles. Medical governance remains `UNASSIGNED` and blocks medical approval, approved release eligibility, and student-facing publication.

The following remain protected and unchanged at baseline:

- Live STAT and sealed-pack behavior
- Live Drills and Daily Rounds ingestion
- Matrix and Arena runtime
- WordPress auth relay and route proxies
- Shared service-role flows and environment values
- Production Supabase data and production migrations
- Stream, R2, CDN, and source registry objects
- Student production data

## Known Baseline Defects

1. `_SYSTEM/scripts/mm-preflight.sh` exits on an unbound empty `tracked_files` array when no tracked dirty files exist.
2. The 1006 UI evidence generator hard-codes portions of browser and accessibility evidence.
3. `npm run validate` points to a missing `src/validate-evidence.mjs` entrypoint.
4. Several screenshot files use a `.png` extension but contain JPEG bytes and are absent from the artifact checksum manifest.
5. Real corpus inventory, real datastore execution, staging, production, rollback, monitoring, and independent final-wave clearance were not established by 1006.

These are inputs to this run, not proof of release readiness.

## Initial Release Verdict

`NOT RELEASE READY` at baseline. Highest demonstrated baseline state is below State A because no authorized real corpus inventory was yet completed. Student-content, STAT-consumer, and Drills-consumer flags must remain off.

============================================================
FILE: I1Q_1007X_BATCH_EXTRACTION.md
============================================================
# I1Q-1007X Full-Corpus Batch Extraction

## Verdict

`NOT_STARTED, PILOT GATE CLOSED`

Full-corpus extraction did not run. No real transcript text or medical candidate content was written to the repository, application datastore, evidence bundle, or handoff.

## Gate Accounting

| Measure | Result |
| --- | ---: |
| Authorized inventoried sources | 97 |
| Extraction-ready sources | 0 |
| Sources processed | 0 |
| Sources completed | 0 |
| Questions detected | 0 |
| Non-questions rejected | 0 |
| Answer candidates | 0 |
| Four-choice eligible candidates | 0 |
| Unresolved candidates | 0 |
| Privacy-blocked sources | 97 |
| Rights-blocked for public excerpts or media | 97 |
| Duplicate clusters generated | 0 |

The privacy block applies before question detection, so zero detected questions is an execution count, not a claim that the sources contain no questions.

## Required Batch Contract

After a passing real pilot, the production batch path must use immutable source hashes, deterministic candidate identities, idempotent jobs, checkpoints, bounded retries, dead letters, per-source progress accounting, duplicate detection, and restart proof. A source-hash change must create a new lineage event and must not silently overwrite prior candidates.

Each output must retain opaque source linkage, timestamps, attribution confidence, answer-source class, exactly three distractors when eligible, misconception and rationale structure, taxonomy, warnings, model and prompt lineage, and the status `AI_DRAFT_NOT_MEDICALLY_VALIDATED`.

## Safety State

Candidate review may be engineered and tested with non-clinical fixtures. Real batch extraction remains off until privacy and pilot gates pass. STAT, Drills, and student-content consumer flags remain off.

============================================================
FILE: I1Q_1007X_CORPUS_INVENTORY.md
============================================================
# I1Q-1007X Corpus Inventory

## Verdict

`REAL_CORPUS_INVENTORIED AS A POINT-IN-TIME AGGREGATE, EXTRACTION BLOCKED PENDING PRIVACY NORMALIZATION`

The authorized production Drills registry and its referenced transcript and nodes artifacts were read without mutation on 2026-07-15. No raw transcript text, title, filename, URL, personal name, or source object is stored in this report or the repository evidence.

QUALIFICATION: the retained evidence is aggregate-only. It preserves registry and probe hashes plus totals, but it does not preserve a privacy-safe row-level source manifest. The 97-row result therefore describes the witnessed 2026-07-15 inventory and cannot be independently recomputed row by row from Git alone.

## Authority

MissionMed OS decision `DR-006` authorizes read-only inventory and internal privacy-safe derivation from MissionMed-owned Dr. J drill sources. It does not authorize source mutation, public excerpts, public quotations, public clips, student-speech reuse, patient-identifying content, or student-facing publication.

## Registry Observation

Source route: canonical production Drills read API used by Daily Rounds. The endpoint address is intentionally omitted from repository evidence because its authority and consumer path are already recorded in the ecosystem map.

| Measure | Observed |
| --- | ---: |
| Registry rows | 97 |
| Registry SHA-256 | `d78910d22ed3b428fd38129ec60140b70673a804a31ae3119e465d75b53631a1` |
| Response bytes | 125,354 |
| Rows categorized `DRJ_DRILLS` | 97 |
| Rows with playback | 97 |
| Rows with nodes | 97 |
| Rows with transcript | 97 |
| Rows with all three | 97 |
| Empty video IDs | 0 |
| Duplicate video-ID groups | 0 |
| Earliest registry creation time | 2026-04-09T09:26:40Z |
| Latest registry creation time | 2026-07-06T17:31:20Z |

VERIFIED: the response was an array with the canonical consumer fields `video_id`, `title`, `playback_url`, `nodes_url`, `transcript_url`, `stream_id`, `subcategory`, `created_at`, Zoom timing fields, and metadata.

## Artifact Probe

Each transcript and nodes reference was fetched read-only. Only status, media type, byte count, hash, JSON shape, record count, record keys, timestamp coverage, and speaker-label coverage were retained.

| Measure | Transcripts | Nodes |
| --- | ---: | ---: |
| Requests | 97 | 97 |
| HTTP 200 | 97 | 97 |
| Failures | 0 | 0 |
| `application/json` | 97 | 97 |
| Distinct content hashes | 97 | 97 |
| Total bytes | 34,939,049 | 20,305,542 |
| Total records | 81,604 | 81,604 |
| Minimum records per source | 603 | 603 |
| Maximum records per source | 1,331 | 1,331 |
| Records with timestamp fields | 81,604 | 81,604 |
| Records with speaker labels | 81,604 | 81,604 |
| Records with text fields | 81,604 | 81,604 |
| Transcript/nodes pairs with identical file hash | 0 | 0 |

Transcript records expose `segment_id`, `speaker`, `start_time`, `end_time`, and `text`. Nodes records expose the same fields plus `node_id`.

The sanitized probe manifest SHA-256 is `ede9cc62aee72868cb4e2c96a9125bbc7be3403dbb7f3afe6b77c493bb79dae0`.

## Speaker Evidence

Speaker strings were evaluated in memory and retained only as truncated hashes and aggregate classes.

| Measure | Observed |
| --- | ---: |
| Multi-speaker sources | 97 |
| Single-speaker sources | 0 |
| Sources with explicit Dr. J speaker label | 96 |
| Sources with only generic Dr. J role evidence | 1 |
| Sources containing potential identity labels | 97 |
| Distinct speaker-label hashes | 146 |

VERIFIED: all sources require speaker-aware privacy processing before extraction.

VERIFIED: the interim privacy owner accepted authoritative `DRJ_DRILLS` registry metadata as sufficient for source-level `verified_drj` classification under `DR-006`. This is not segment-level attribution, medical credential verification, public-rights clearance, or permission to publish quotations.

VERIFIED: 96 sources have explicit speaker evidence that may support a restricted exact-match Dr. J segment allowlist after privacy gates pass. The one generic-only source retains zero segments unless an authoritative source-owner mapping is recorded.

## Enrichment Coverage

Forty-six registry records contain Zoom AI notes metadata with 651 topic entries and subject labels. They split evenly between Step 1 and Step 2 plus Step 3 designations, 23 each. Those metadata may help stratify the pilot, but titles, paths, note text, and source labels remain restricted until privacy normalization.

UNKNOWN: the remaining 51 sources have no observed Zoom AI notes metadata in this registry response. This does not imply the absence of other authorized metadata.

## Drive Discovery

The connected MissionMed Google Drive was searched read-only using both keyword and exact filename filters.

| Search | Filename matches |
| --- | ---: |
| `.vtt` | 0 |
| `transcript` | 0 |
| `drill` | 0 |
| `Dr. J` | 0 |
| `Daily Rounds` | 0 |

Keyword content search returned unrelated handoffs and operating artifacts, not corpus media or transcript files.

VERIFIED: no additional Drive corpus source was observed by these searches.

UNKNOWN: this is not proof that no Drive corpus exists. Search indexing, access scope, naming, and shared-drive boundaries may limit discovery.

## Classification and Readiness

| Gate | Current state |
| --- | --- |
| Real registry inventory | PASS |
| Transcript availability | PASS, 97 of 97 |
| Nodes availability | PASS, 97 of 97 |
| Source hash coverage | PASS, 97 of 97 for both artifact classes |
| Duplicate-ID check | PASS |
| Source-level Dr. J classification | PASS, 97 of 97 `verified_drj` |
| Segment-level Dr. J attribution | 96 potentially resolvable; 1 zero-retention; all blocked pending privacy gates |
| Working redacted transcripts | NOT CREATED |
| Student-speech removal | NOT RUN |
| Patient and third-party redaction | NOT RUN |
| Privacy gold pilot | NOT RUN |
| Extraction suitability | BLOCKED for all 97 |
| Public rights | NOT CLEARED |
| Internal derivation rights | AUTHORIZED by `DR-006` after privacy gates |

## State Result

State A `REAL_CORPUS_INVENTORIED` is supported as a dated point-in-time aggregate by canonical registration, an effective protected integration decision, the witnessed 97-row real registry inventory, and full referenced-artifact availability totals.

INFERENCE: calling the aggregate inventory complete is reasonable for the observed source response because the response hash, row count, duplicate count, request totals, distinct content hashes, and failure totals agree. It is not a claim that a later operator can reconstruct the same 97 source rows from retained evidence.

OPEN: a future authorized inventory run should retain a privacy-safe row manifest containing only opaque source identifiers or salted stable identifiers, source-level availability states, content hashes, classification state, and probe outcome. It must exclude title, URL, path, speaker wording, transcript text, and personal identifiers.

This report does not claim State B. No privacy-safe working transcript or real candidate has been generated or stored.

============================================================
FILE: I1Q_1007X_DATASTORE.md
============================================================
# I1Q-1007X Datastore

## Verdict

`OFFLINE POSTGRES CONTRACT PASS, PREVIEW AND STAGING NOT RUN`

## Candidate

The additive candidate is:

`i1q-question-platform/db/migrations/20260715122434_i1q_1007x_question_platform.sql`

It is a standalone, forward-only, transaction-wrapped migration for PostgreSQL 15 or later. It creates the additive `i1q` schema, 52 architecture and operational tables, immutable lineage, guarded draft mutation, answer isolation, source-reference isolation, review lifecycle functions, release membership, channel artifacts, validation evidence, audit history, feature flags, and compensation tracking.

The application also contains a transaction-scoped Postgres repository contract. It requires a dedicated connection, rejects invalid actor or transaction input before SQL, sets trusted actor context inside the transaction, and releases or rolls back on every tested failure path.

## Validation

Static migration tests prove table coverage, object naming, transaction headers, idempotent guards, immutable records, exact projections, answer separation, release controls, compensation, and absence of broad grants or destructive statements.

A disposable local PostgreSQL database passed all 13 migration-contract tests, including:

- first apply and exact reapply
- anonymous and role boundary attacks
- revoked-reviewer answer denial
- channel-policy confusion denial
- Class A answer leak denial
- Class A and Class C release-scoped Class D key and value denial
- 196 actual mixed-case identifier probes across seven identifier families, four Class C prose fields, and seven direct or encoded variants
- 16 separator-only and full printable-ASCII marker probes at URL depths 2 and 3
- bounded eight-pass decoding, 64 KiB scalar rejection, and zero persisted artifact or payload rows for every denied probe
- official validation evidence binding
- compensation applied twice
- retained history and forced RLS
- exact reapply after compensation

## Unresolved Integration

The HTTP service still uses the in-memory repository in local synthetic mode. No canonical RANKLISTIQ project-pinned migration directory, preview target, staging target, runtime grant manifest, or unprivileged I1Q runtime role was available. No production or staging migration was applied.

The migration remains an app-owned candidate and must not be copied into a shared migration history by hand.

============================================================
FILE: I1Q_1007X_DEPENDENT_PRODUCTS.md
============================================================
# I1Q-1007X Dependent Products

## Verdict

`CONTRACT TESTS PASS, PROTECTED CONSUMERS UNCHANGED AND DISABLED`

## STAT

The local projection preserves the frozen nine fields in order: `dataset_version`, `question_id`, `prompt`, `choice_a`, `choice_b`, `choice_c`, `choice_d`, `answer`, and `explanation`. Metadata uses composite `dataset_version` plus `question_id`. Class A pre-answer artifacts exclude answers and explanations. Answer maps remain server-only and require finalized server state and participant proof.

STAT sealed packs and live runtime were not modified. `stat_adapter_enabled` is false. Existing contract and deployed-runtime authority collisions remain owner decisions before activation.

## Drills And Daily Rounds

The Drills adapter records playback, transcript, VTT, and nodes availability explicitly, requires playback and nodes, and preserves source, timing, rights, privacy, and hash linkage. The current Daily registry compatibility validator remains unchanged. Drills and Daily source registries were read only.

`drills_adapter_enabled` is false. Live Drills and Daily ingestion were not modified.

## Arena, Matrix, WordPress, And MissionMed HQ

No Arena or Matrix runtime path, WordPress route proxy, auth relay, MissionMed HQ server, CDN object, R2 object, Stream object, or shared service-role flow was changed. No I1Q production dependency regression can be claimed without staging integration.

## Future Consumers

Daily Rounds, TournaMed, future Arena modes, custom tests, and mentor or faculty modes remain contract-only channels in the single manifest. No consumer publication occurred.

============================================================
FILE: I1Q_1007X_DRILLS_ADAPTER.md
============================================================
# I1Q-1007X Drills Adapter

## Verdict

`LOCAL_CONTRACT_PASS, CONSUMER INTEGRATION OFF`

The versioned Drills adapter now represents playback, nodes, transcript, and VTT availability independently and fails closed on rights, privacy, source lineage, or timestamp defects. It does not modify the Drills registry, Daily Rounds registry, ingestion pipeline, media objects, or protected runtime.

## Adapter Contract

Each projected row requires:

- contract version and release ID
- immutable Item Revision ID
- stable video and source-record IDs
- internal title, prompt, and concept ID
- playback availability plus URL or Stream ID when available
- nodes availability plus URL when available
- transcript availability plus URL only when available
- VTT availability plus URL only when available
- timestamp start and end
- cleared internal rights state
- passing privacy state
- source and working SHA-256 hashes

Availability values are explicit: `available`, `missing`, `restricted`, `invalid`, or `unknown`. A missing transcript or VTT may be represented explicitly. Playback and nodes are required for the current Drills remediation projection. An unavailable artifact may not hide a location.

## Consumer Compatibility

The existing Daily Rounds registry contract still requires nonempty `video_id`, `title`, `playback_url`, `nodes_url`, and `transcript_url`. The adapter validates that current five-field source contract separately.

The protected Drills runtime permits explicit transcript absence while requiring playback and nodes. This difference is preserved rather than silently normalized away. I1Q may eventually publish a read-only sidecar or versioned projection after the Drills owner resolves the canonical registry path.

No source availability is inferred. In particular, transcript JSON does not imply a VTT. The real inventory observed 97 transcript JSON files and 97 nodes JSON files, but zero separately verified VTT artifacts.

## Verification

The 34-test adapter suite includes:

- explicit missing transcript and unknown VTT success
- absent transcript or VTT state failure
- hidden location on unavailable asset failure
- unavailable playback failure
- unavailable nodes failure
- rights and privacy failure
- invalid source or working hash failure
- timestamp linkage checks
- current Daily required-field checks

All 34 tests passed, including every Drills transformation vector.

## Current Real-Corpus Gate

All 97 sources remain blocked from extraction. The adapter requires a privacy-safe working hash and passing privacy record, neither of which exists for the real corpus. Public excerpt and clip rights remain closed.

The adapter therefore cannot be used to move raw transcript data or unreviewed candidates into Drills.

## Protected Runtime Gates

| Gate | Status |
| --- | --- |
| Adapter contract tests | PASS |
| Explicit availability semantics | PASS |
| Source mutation | NONE |
| Drills ingestion mutation | NONE |
| Drills owner path ruling | OPEN |
| Real privacy-safe working source | NONE |
| Protected Drills checksum parity | BLOCKED, tracked and deployed sources diverge |
| Daily Rounds end-to-end contract | NOT RUN |
| Drills owner certification | NOT OBTAINED |
| `drills_adapter_enabled` | OFF |

## Files

- `i1q-question-platform/src/adapters/drills-v1.mjs`
- `i1q-question-platform/src/contracts.mjs`
- `i1q-question-platform/src/exports.mjs`
- `i1q-question-platform/tests/adapters-security.test.mjs`

## Conclusion

The local Drills boundary is explicit and fail-closed. Consumer activation remains prohibited until privacy, source ownership, runtime parity, and end-to-end protected-system gates pass.

============================================================
FILE: I1Q_1007X_ECOSYSTEM_DEPENDENCIES.md
============================================================
# I1Q-1007X Ecosystem Dependencies

## Verdict

`MAPPED, SHARED INTEGRATION BLOCKED`

The I1Q application has a safe isolated engineering boundary, but no canonical authenticated host, RANKLISTIQ migration workflow, staging environment, or deployment route was found. The protected consumer and shared-auth dependencies are mapped and remain unchanged.

## Canonical Ownership

| Boundary | Owner | I1Q rule |
| --- | --- | --- |
| Identity provider | WordPress | Reuse signed handoff; no parallel identity |
| Encrypted session and bootstrap | MissionMed HQ on Railway | Reuse only after expiry, secret, CORS, revocation, and outage proof |
| App roles and assignments | I1Q | Resolve from app-owned records; never infer physician status from title, name, or WordPress role |
| I1Q datastore | RANKLISTIQ Supabase | Additive `i1q` schema through a new MR-078A route |
| STAT runtime | STAT owner | Exact versioned server projection; no sealed-pack change |
| Drills and Daily ingestion | Existing Drills/MMVS owner | Read-only source and sidecar adapter; no ingestion mutation |
| Stream, R2, and CDN | Existing media and deployment owners | Read-only source work; GitHub-only runtime deployment |
| Raw transcript processing | Privacy owner | Restricted zone only; no raw text in Git, logs, or handoffs |
| Production deployment and flags | Root Supervisor plus owners | Same certified hashes; all flags off until gates pass |

## Authentication Topology

The observed browser path is WordPress login, signed 60-second handoff, HQ session exchange, encrypted HttpOnly cookie, and RANKLISTIQ Supabase bootstrap. Arena, STAT, and Daily already use this route.

The dedicated I1Q service currently has no canonical `identityResolver`. I1Q roles are not WordPress roles. A safe adapter must obtain a verified canonical actor, resolve I1Q roles and current assignments server-side, enforce expiry and revocation, apply CSRF and origin checks, and establish a trusted database context without exposing credentials.

Shared HQ source review found three release blockers:

- expired, missing-expiry, or invalid-expiry encrypted sessions are warned about but returned
- the session-secret fallback makes configured-secret checks appear true even when the environment secret is absent
- credentialed CORS can reflect an arbitrary request origin when no fixed origin is configured

No shared HQ or WordPress file was changed in this run.

## Datastore Topology

DR-006 routes the additive schema to RANKLISTIQ. The root `supabase/migrations/` path is documented as Growth Engine ownership and has a migration-history desynchronization. It is not a safe I1Q target.

No tracked GitHub workflow or canonical RANKLISTIQ migration directory was found. The app-local `20260715122434` migration is a validated standalone MR-078A candidate and passed disposable PostgreSQL apply, reapply, RLS, compensation, and reapply tests. It still cannot enter preview or staging until an owner-provided project-pinned workflow exists.

## Consumer Boundaries

### STAT

I1Q may publish only a new immutable versioned dataset through the exact nine-field server projection. The sealed pack, answer map, scoring, active datasets, historical attempts, and protected runtime are no-touch.

Two authority collisions require STAT-owner resolution before activation: the documented seven-field `get_duel_pack` contract differs from tracked SQL and runtime envelopes, and client hash recomputation requirements conflict across current authority documents.

### Drills And Daily

The current MMVS API is the observed 97-row source. Drills requires playback or Stream ID and nodes, while transcript absence can be explicit. Daily currently requires video ID, title, playback, nodes, and transcript URLs. I1Q must preserve those differences with a versioned read-only adapter.

The canonical ownership split among MMVS, RANKLISTIQ drill controls, and Growth Engine registry declarations requires a named Drills and Data owner ruling. I1Q must not duplicate or mutate ingestion.

### Protected Runtime

Arena, STAT, Drills, Daily, and WordPress wrapper routes are reachable and current runtime markers pass. All four deployed CDN files differ materially from tracked `LIVE/` checksums. Deployed bytes therefore remain runtime truth, and the tracked files cannot serve as a deployment or rollback baseline.

## Media Sources

The real inventory observed 97 playback references, 97 transcript JSON artifacts, and 97 nodes JSON artifacts. No separate VTT artifact was verified. Stream, transcript, nodes, and any future VTT availability must be represented independently.

No additional Drive corpus source was observed. HQ and CIE media routes exist but were not wired into I1Q. All source access remains read-only and all real sources remain privacy-blocked.

## Deployment Topology

The existing `railway.json` starts MissionMed HQ and must not be overloaded. The local R2 and CDN deploy scripts belong to protected consumer HTML and are not an authorized I1Q route. No I1Q URL, preview environment, staging environment, production runtime, workflow, monitor, or rollback rehearsal was found.

A future route must pin:

- exact GitHub commit and application build root
- dedicated internal host and health and API routes
- canonical session adapter and fixed allowed origins
- RANKLISTIQ schema and migration project pin
- preview, staging, backup, rollback, reapply, and monitoring steps
- all consumer and student flags off by default

## Dependency Risk

The repository lockfile was updated to fixed versions. The current root `npm audit --audit-level=low` result is zero vulnerabilities.

## Baselines

| Baseline | Result |
| --- | --- |
| MissionMed OS registration and DR-006 | PASS, canonical main merge verified |
| Protected static deploy validator | PASS |
| Protected LIVE route reachability and markers | PASS |
| Protected source and runtime checksums | FAIL, four of four diverge |
| I1Q current local suite | PASS, 228 discovered, 227 passed, 0 failed, and 1 disposable-database skip |
| STAT, Drills, and Class C adapter suite | PASS, 48 of 48 |
| Evidence validator | PASS, 20 of 20 files and State A |
| Live authenticated session journey | NOT RUN |
| Browser journey | BLOCKED, in-app browser unavailable |
| Disposable local migration and RLS | PASS, 13 of 13; preview still not run |
| Staging, rollback, and monitoring | NOT AVAILABLE |

## Current Release Position

Engineering may continue inside `i1q-question-platform/` with synthetic, non-medical fixtures. Real extraction, shared-auth coupling, protected consumer integration, migration application, staging, and deployment remain blocked until their named gates have owner-certified evidence.

============================================================
FILE: I1Q_1007X_EXECUTION_PLAN.md
============================================================
# I1Q-1007X Execution Plan

## Operating Rule

The root supervisor owns authority changes, shared-system edits, migration application, deployment, convergence, and final claims. Agents receive disjoint read or write scopes and may not deploy, apply migrations, edit shared authority, or publish content.

## Ordered Gates

1. Preserve and reconcile MissionMed OS state.
2. Register I1Q and file the protected integration decision through canonical review.
3. Map every consumer of shared auth, STAT data, Drills metadata, deployment, and datastore boundaries.
4. Reproduce the 1006 candidate and repair evidence tooling without broad shared changes.
5. Add the canonical authentication adapter and deny-by-default role resolution.
6. Finalize additive `i1q` migrations, RLS, transaction-local context, rollback, and audit design.
7. Complete the internal application workflows and required states.
8. Inventory authorized real corpus sources read-only and normalize privacy-safe working data.
9. Run the provisional benchmark and generate only quarantined, unapproved candidates if gates pass.
10. Export and reconcile legacy v4 read-only, then verify STAT and Drills adapters.
11. Run security, performance, accessibility, UX, dependent-product, and rollback validation.
12. Deploy staging only through the canonical GitHub route and verify it independently.
13. Obtain fresh final-wave Red Team clearance.
14. Deploy authenticated internal production only if every State C gate passes.
15. Produce all reports, exact combined handoff, checksums, commits, and completion audit.

## Stop Conditions

- A protected path is about to change without an effective decision record.
- An authority conflict remains unresolved.
- Current-state authority becomes stale for an action that depends on it.
- Secrets, credentials, tokens, keys, environment values, or student data would enter files or logs.
- A command changes the risk model unexpectedly.
- Privacy pilot thresholds fail.
- A migration cannot be reproduced, rolled back with a compensating migration, or re-applied in preview/staging.
- Authentication or RLS permits unintended access.
- STAT answers or explanations are exposed before finalization.
- Final Red Team issues a release veto.

## Evidence Standard

Every gate requires reproducible command or connector evidence tied to a commit, environment, timestamp, and expected result. Generated claims are not accepted as runtime proof. Browser and accessibility evidence must come from actual interactive runs. Production claims require a URL, deployed commit, manifest, smoke results, monitoring evidence, and tested rollback identity.

## State Rules

| State | Minimum evidence |
| --- | --- |
| A | Canonical registration and authority, plus real authorized corpus inventory |
| B | State A plus privacy-safe real candidate bank with lineage and all candidates unapproved |
| C | State B plus authenticated internal production, datastore/RLS/audit, operational review flows, backups, monitoring, tested rollback, and flags off |
| D | State C plus genuine credentialed physician-approved revisions released through an approved consumer |

State D must not be inferred or simulated.

## Commit Boundaries

Use separate intentional commits for preservation, registration, authority, foundation repair, auth, datastore and migrations, internal app, extraction, adapters, security and quality, and production release. Do not stage unrelated historical handoffs.

============================================================
FILE: I1Q_1007X_FOUNDATION_REPRODUCTION.md
============================================================
# I1Q-1007X Foundation Reproduction

## Verdict

`HISTORICAL FOUNDATION PASS, 1007X LOCAL REPAIR COMPLETE`

## 1005 Exact-Byte Reproduction

The complete 1005 foundation and the 1006 audit harness were copied to an OS-temporary directory. The copied validator was executed there, and the historical source directory was not run or modified.

| Evidence | Result |
| --- | --- |
| Source estate files | 86 |
| Source estate SHA-256 before | `2767262ab169c88d6c9fcfe4a2a76199782ca29a443cdb86e7ef329c30f34d90` |
| Source estate SHA-256 after | `2767262ab169c88d6c9fcfe4a2a76199782ca29a443cdb86e7ef329c30f34d90` |
| Source estate unchanged | PASS |
| Validator SHA-256 | `edca04a0e1f8c5160c21cc4814d819f0f03f0eb32c65dead771e6128e2db9bcb` |
| Copied validator exact-byte match | PASS |
| V1 through V20 | 20 PASS |
| LT-1 through LT-6 | 6 PASS |
| N-001 through N-030 | 30 PASS |
| N-031 through N-080 adversarial mutations | 50 PASS |
| Superseding privacy contract assertions | 5 PASS |
| Total assertions | 111 PASS |

Generated reproduction evidence hashes:

| Result | SHA-256 |
| --- | --- |
| Official 1005 suite | `5da6cf13ffb74b784b340678483273f1086e01998bf035c1afe334551f14f99b` |
| Adversarial audit | `ad3f8cee97bda6f7795fe683b9d3ce3197fef2c0aadee9c0f9c25d89e424e701` |
| Audit summary | `e64b6ae221eb87a3cd129677ae7d78b741a809168c593c6813b526e484d8a7dc` |

## Privacy Interpretation

The historical 1005 source redaction fixture has an intentional known defect: a synthetic patient identifier is mislabeled as `student_name`, leaving the required `patient_identifier` class without gold examples. The superseding evaluator correctly fails that source fixture with recall `0` for the missing class.

The 111-assertion PASS means the harness detected the expected defect and its in-memory corrected synthetic control passed. It does not mean the old source fixture or the 1006 application privacy logic is production safe.

## 1006 Application Reproduction

`npm test` completed with 30 of 30 tests passing. These tests cover the synthetic HTTP shell, bounded pagination, malformed requests, static migration characteristics, in-memory load, hashing, the exact nine-field STAT projection, answer-free pre-answer generation, immutable records, synthetic review gates, pipeline lineage, and static UI markers.

`npm run validate` failed with exit code 1 because `src/validate-evidence.mjs` does not exist. The checked-in validation command is therefore nonfunctional.

## Historical Reproduced Blocking Defects

The following defects were verified in the 1006 baseline. They are retained as historical reproduction evidence and were addressed by the 1007X local repair series unless an external gate is stated.

1. Read roles can retrieve answer-bearing `item_revisions`; sanitization leaves `answer` and `explanation` intact.
2. The post-answer artifact route trusts a caller-controlled phase query without server-authoritative finalization evidence.
3. Leak detection omits aliases including `answer_map` and `is_correct`.
4. Generic write paths permit unsafe rights, privacy, evidence, and source mutation.
5. A platform administrator can fabricate reviewer credentials, impersonate review actors, combine governance roles, and publish without independent validation or Brian ratification.
6. SQL actor and role context is self-asserted and not bound to canonical identity, assignments, or class-specific access.
7. Mutations have no proven CSRF or Origin enforcement.
8. Runtime uses only `MemoryRepository`; no tested transaction-bound database repository exists.
9. Transcript normalization returns raw `text` beside redacted text.
10. Required privacy classes omit student speech and identifying clinical anecdotes, and zero recall can aggregate to pass in the 1006 application scorer.
11. Migration naming, headers, repeatability, executable Postgres proof, rollback chain, and re-apply proof are absent.
12. Composite question identity, release membership tuples, historical joins, and complete Drills availability are not preserved by the current adapter.

## Browser Reproduction

The local synthetic server started successfully at its loopback demo address and was stopped cleanly after the test. The explicitly requested in-app browser backend reported no available browser type after the documented troubleshooting check. Visual interaction, real accessibility inspection, and browser screenshots remain externally blocked in this session. No other browser surface was substituted.

## Dependency Audit

The repository lockfile was upgraded to fixed dependency versions. The current root audit reports zero vulnerabilities.

## 1007X Convergence

The final repair package suite discovers 228 tests, passes 227, fails 0, and has one environment-gated disposable-database skip. A separate fresh disposable PostgreSQL run passes all 13 apply, reapply, RLS, iterative Class D artifact isolation, validation, compensation, and reapply tests. The Class D regressions cover mixed-case Base64 and Base64URL values, separator-only and full printable-ASCII double and triple URL encodings across seven identifier families and four teaching-prose fields, bounded decode depth, a 64 KiB scalar limit, and zero persisted rows after denial. The evidence validator claims only State A and passes all 20 files with the current 44-artifact checksum set.

Local repairs cover answer-free generic reads, server-derived post-answer authorization, exhaustive Class A and closed-world Class C validation, purpose-scoped exact-assignment reviewer content, workflow-owned mutations, reviewer and publication separation, canonical identity adapter requirements, CSRF and Origin checks, transaction-scoped repository behavior, privacy-safe working-segment construction, the full required privacy-class model, MR-078A migration structure, composite release identity, and explicit Drills availability.

Canonical auth wiring, runtime grants, preview, staging, browser, accessibility, human validation, monitoring, and deployment remain external gates.

## Current Gate

Foundation reproduction and local repair are complete. Application engineering may continue locally. Preview, staging, or deployment must not proceed until the named canonical integration and certification gates pass.

============================================================
FILE: I1Q_1007X_INTERNAL_APP.md
============================================================
# I1Q-1007X Internal Application

## Verdict

`LOCAL SYNTHETIC APPLICATION OPERATIONAL, INTERNAL DEPLOYMENT BLOCKED`

## Implemented Workflows

The local shell exposes 17 internal workflows: dashboard, corpus inventory, source detail, privacy status, transcript evidence, extraction runs, candidate triage, question authoring, distractor review, evidence claims, editorial review, physician review, revision comparison, search and filters, release assembly, incidents, and audit trail.

Sixteen deterministic operational states are available in local synthetic mode. The UI uses API-backed rendering, exact revision hashes, explicit assignment acceptance, actor-scoped review controls, current evidence checks, credential and governance gates, protected answer fields, and disabled release commands.

## Integrated Repairs

The current candidate adds:

- session and CSRF bootstrap
- internal platform and review feature gates
- explicit draft save and candidate submission routes
- actor-scoped revision, source, evidence, reviewer, and review reads
- purpose-scoped answer and rationale retrieval for an accepted reviewer of one exact immutable revision
- closed-world response validation, denial and success audit events, no-store HTTP caching, and disabled verdicts when protected review content is unavailable
- source lineage bound across inventory, source record, privacy record, transcript artifact, and sanitized segment
- fail-closed ambiguous lineage behavior
- expired-evidence decision gating
- persistent single-path action feedback
- mobile navigation state and stronger focus contrast
- complete styles for core state, context, review, pagination, and transcript components

A three-source DOM regression proves that selecting the second inventory source cannot display the first source or first transcript segment. A separate DOM regression proves that an accepted editorial reviewer can inspect the exact answer, choice rationales, explanation, source anchors, and evidence claims without browser storage persistence.

## Safety Boundary

Local mode uses only non-clinical synthetic fixtures. It is blocked in production. No real candidate, medical approval, raw transcript, student data, answer map, or consumer activation is present.

## External Gate

The application lacks canonical auth, a wired Postgres repository, an approved host, GitHub deployment workflow, staging browser proof, assistive-technology proof, and human validation. Both internal flags and all student and consumer flags remain off.

============================================================
FILE: I1Q_1007X_LEGACY_V4.md
============================================================
# I1Q-1007X Legacy v4 Reconciliation

## Verdict

`STATIC_V4_RECONCILED, IMPORT AND MEDICAL APPROVAL NOT PERFORMED`

The canonical static v4 migration contains exactly 845 question rows. A separate current STAT CDN mirror contains 3,961 runtime items. The two collections use disjoint identifiers and must not be conflated.

No production database was read or changed. No legacy content was imported, approved, retired, replaced, or published.

## Authority And Method

Brian authorized a read-only hashed export of the canonical v4 dataset and non-student aggregate exposure metadata. The source used here was the repository migration:

`supabase/migrations/20260420111000_stat_dataset_ingest.sql`

The migration was executed only in a temporary local PostgreSQL cluster with minimal local roles and a local `dataset_registry` dependency. The cluster contained no production credentials or student data. Aggregate queries and a restricted temporary NDJSON export were used for reconciliation. The export contains medical content and was not committed, printed, or included in a handoff.

## Static v4 Result

| Measure | Observed |
| --- | ---: |
| Migration SHA-256 | `9bbd46e329933f1ebe5642e48238f9e0ac9f29bd772ad40675123e1d2c313f0e` |
| Inserted rows | 845 |
| Distinct question IDs | 845 |
| Dataset versions | 1 |
| Dataset version | `v4` |
| Required-field nulls | 0 |
| Missing explanations | 0 |
| Base items | 517 |
| Vignette-suffix items | 328 |
| Vignettes with a base sibling | 328 |
| Bases with a vignette sibling | 328 |
| Duplicate-prompt groups | 11 |
| Duplicate full-content groups | 0 |
| Rows with duplicate choices | 0 |
| Minimum prompt length | 29 |
| Maximum prompt length | 263 |
| Minimum explanation length | 49 |
| Maximum explanation length | 238 |
| Canonical dataset registry hash | `eae68f7c33948b8a2df53315d0b533fa2e24683c068d4bcac3aea7d2c8fd1b15` |
| Restricted NDJSON rows | 845 |
| Restricted NDJSON bytes | 459,647 |
| Restricted NDJSON SHA-256 | `066df25d6c46e2e04904ab13ea2aab2c8b5631c6ff76551a0e6d24d4664008cb` |

All 845 static rows store `answer = A`. This is a verified source property. It is not, by itself, proof of student-facing answer-position bias because STAT sealed-pack choice permutation may transform presentation order. The adapter must preserve the frozen choice-order contract and prove that answer mapping remains server-only.

The migration references `universal_questions_v4.json`, but that source file was not present in the worktree or the canonical `/Users/brianb/MissionMed` checkout. The migration is therefore the currently observed canonical static source for this reconciliation.

## Current CDN STAT Mirror

The current read-only CDN mirror is structurally different from the static 845-row v4 dataset.

| Artifact | Count | SHA-256 |
| --- | ---: | --- |
| Runtime array | 3,961 | `b38297a6bad8fdf30bc4e4ac326664132e2e55a14c81a01b2ae0238a6ac2ef7c` |
| Lookup object | 3,961 | `7e3783c0ffffb4f468581fe892cd6dc749ab76e5b5e3c334f9ae0976fce2198d` |
| Index groups | 4 | `b87aba6404dd56a8c399753d0988bcf036a7dfef6046325f3869fe0dbea76ca3` |

Runtime records expose exactly these observed keys:

`choices`, `correct_answer`, `difficulty_score`, `id`, `question`, `step`, `subject`, `tier`, `type`

Additional verified aggregates:

| Measure | Observed |
| --- | ---: |
| Distinct runtime IDs | 3,961 |
| Duplicate runtime-ID groups | 0 |
| Four-choice records with keys A through D | 3,961 |
| Records containing `correct_answer` | 3,961 |
| Correct-answer values matching a choice key | 3,961 |
| Records with `correct_answer = A` | 3,961 |
| Subjects | 21 |
| Question types | 10 |
| Step levels | 2 |
| Tiers | 3 |
| Lookup keys matching runtime IDs | 3,961 of 3,961 |
| Static v4 IDs intersecting runtime IDs | 0 |

The index artifact groups identifiers by `question_type`, `step_level`, `subject`, and `tier`. The lookup artifact contains metadata only and contains no observed `correct_answer` or `explanation` fields.

PROTECTED: the answer-bearing runtime artifact is part of the current STAT estate. This run did not modify it. Its exposure and sealed-pack role require independent security validation before any I1Q adapter can be enabled.

The all-`A` source property is therefore present in both observed collections. This is a mandatory adapter and assessment-science audit queue, but it is not proof that students see a fixed answer position because sealed-pack generation may permute choices and maintain a separate server-only answer map.

## Identity And Mapping Ruling

The I1Q compatibility boundary must use composite `dataset_version + question_id` identity. For the static dataset, the initial lineage identity is `v4 + question_id` and the immutable source hash is derived from the exact nine-field row.

Each future mapping must preserve:

- original dataset version and question ID
- exact nine-field source projection
- source and content hashes
- historical-attempt join identity
- base and vignette sibling relationship
- duplicate-family membership
- import and review event history
- retirement or replacement lineage without destructive mutation

No Item, Item Revision, Concept, or Variant Group identity was written in this run. Those records require the additive I1Q datastore and versioned import adapter.

## Review Queues

The 845 rows are legacy content, not approved I1Q revisions. They require independent editorial and credentialed physician review on exact immutable revisions before I1Q release eligibility.

The following deterministic queues can be generated after import:

- all-answer-A transformation audit
- eleven duplicate-prompt groups
- 328 base and vignette sibling pairs
- answer and medical-safety review
- dated or guideline-sensitive claim review
- explanation quality review
- distractor quality review
- exposure-priority review using authorized aggregate telemetry
- lineage repair where a historical source cannot be recovered
- retirement and replacement candidates

No medical-risk or quality ranking is claimed here because no credentialed medical review and no authorized aggregate exposure export were available in this run.

## Gates

| Gate | Status |
| --- | --- |
| Canonical static count | PASS, 845 |
| Static source hash | PASS |
| Required nine fields | PASS |
| Unique composite identity | PASS for the observed static source |
| Current CDN mirror distinguished | PASS |
| Historical join mapping | SPECIFIED, not persisted |
| Medical review | NOT RUN |
| Assessment-quality review | NOT RUN |
| I1Q import | NOT RUN |
| STAT consumer enablement | OFF |
| Student publication | BLOCKED |

## Conclusion

The actual static legacy v4 count is 845. The 3,961-item current CDN mirror is a separate dataset and cannot be used as a replacement count or silently joined by identifier. Both remain unchanged.

============================================================
FILE: I1Q_1007X_MISSIONMED_OS_RECOVERY.md
============================================================
# I1Q-1007X MissionMed OS Recovery

## Verdict

`COMPLETE AND PRESERVED`

The pre-existing MissionMed OS collision was recovered without deleting, overwriting, or silently adopting unrelated work.

## Initial Condition

At first inspection, `/Users/brianb/MissionMed_OS` was on local `main` at `72b48e5`, 11 commits behind `origin/main` at `7144435`. Four tracked files were modified and 52 files were untracked. The historical `.git/index.lock` referenced by the prompt was absent; `lsof` and `stat` found no lock, and Git operation metadata showed no active operation.

Modified tracked paths:

- `CURRENT.md`
- `logs/MM_ACTIVITY_LOG.md`
- `missions.json`
- `tools/mmos_status.py`

The untracked set included decision, handoff, registry, release, shell, test, tool, and generated Python-cache material. It was treated as pre-existing work with unknown ownership.

## Preservation Package

Complete forensic preservation was written outside the repository at:

`/Users/brianb/MissionMed_AI_Sandbox/_RECENT_AI_OUTPUTS/I1Q-1007X-MMOS-PRESERVATION-20260715T112333Z`

It includes:

- Branch, status, remotes, refs, reflog, log, and worktree records
- Tracked and untracked path lists
- Binary working-tree diff and empty staged diff
- Compressed tracked and untracked archives
- SHA-256 and stat metadata for all 56 paths
- Git operation metadata and explicit absent-lock evidence
- A complete verified all-refs Git bundle

Key hashes:

| Artifact | SHA-256 |
| --- | --- |
| Tracked archive | `37aac52a...` |
| Untracked archive | `d8c905a7...` |
| Binary patch | `20f1dc81...` |
| Staged diff | `e3b0c442...` |
| All-refs bundle | `5a9d0903...` |

The preservation audit confirmed four tracked paths, 52 untracked paths, 56 hash entries, matching archive counts, and a valid complete-history bundle.

## Durable Recovery Branch

The exact preserved working state was committed on a dedicated branch and pushed:

| Field | Value |
| --- | --- |
| Branch | `codex/i1q-1007x-mmos-preexisting-recovery` |
| Commit | `91a680b1a2e5befd4fbe16b47f6e36f70fdaf419` |
| Commit message | `chore(recovery): preserve pre-I1Q MissionMed OS working state` |
| Files | 56 |
| Exact path comparison | PASS |
| Remote push | PASS |

This recovery branch is intentionally not part of the I1Q registration change. It exists to preserve provenance and permit later owner-led reconciliation.

## Canonical Recovery

After preservation, the MissionMed OS checkout returned to clean `main` and advanced only with `git pull --ff-only` to `7144435`. The resulting checkout matched `origin/main`, had no lock, and had no remaining dirty state.

Before I1Q registration, a second canonical snapshot was copied to:

`/Users/brianb/MissionMed_AI_Sandbox/_RECENT_AI_OUTPUTS/I1Q-1007X-MMOS-PRESERVATION-20260715T112333Z/canonical-pre-i1q-7144435`

Its `CURRENT.md`, mission registry, product registry, authority registry, and hashes were verified.

## Safety Conclusion

No reset, clean, force update, history rewrite, or destructive checkout was used. The old lock was not removed because it no longer existed. Unrelated work is recoverable both as exact files and full Git history.

## Final Concurrent Status

At the final read-only recheck, MissionMed OS was on canonical `main` at `0e47d39d79edd9891896eb41e65183e855573cc1`, exactly matching `origin/main`, with a clean working tree. Commit `0e47d39` contains separately owned RISE activity-log corrections after the I1Q merge. `CURRENT.md` lists I1Q-1006 as active with no MissionMed OS blocker, and both the Question Platform passport and DR-006 remain tracked. Active RISE processes were still observable, so this is a point-in-time status and Root made no MissionMed OS change.

============================================================
FILE: I1Q_1007X_MONITORING.md
============================================================
# I1Q-1007X Monitoring

## Verdict

`PLAN READY, RUNTIME MONITORING NOT CONFIGURED`

## Required Signals

The future internal service must report health, deployment commit, migration version, repository availability, auth-adapter state, RLS denial anomalies, audit-chain verification, review queue depth and age, extraction checkpoint age, dead letters, source privacy blocks, release-validation failures, feature-flag changes, answer-access attempts, and rollback status.

Alerts must preserve privacy. They may include opaque IDs, hashes, counts, safe error codes, and environment identity. They must not contain raw transcript text, student or patient identifiers, answer maps, credentials, tokens, private URLs, or service-role material.

## Current State

Local health and evidence validation run successfully. No canonical log sink, metric backend, alert owner route, dashboard, uptime check, staging signal, production signal, backup monitor, or incident drill exists for I1Q.

Brian remains interim incident owner and rollback operator, but operational readiness requires an actual monitored deployment and an independent alert-to-rollback exercise.

============================================================
FILE: I1Q_1007X_OPEN_HUMAN_ACTIONS.md
============================================================
# I1Q-1007X Open Human Actions

## Purpose

This record lists decisions and attestations that require a named human owner. It does not transfer ordinary engineering work to Brian.

## Required Actions

| Priority | Owner needed | Action | Exact evidence required | Blocks |
| --- | --- | --- | --- | --- |
| P0 | MissionMed identity owner | Approve and provide the canonical I1Q identity resolver contract, including current session validation, revocation, logout, role resolution, trusted origins, and CSRF binding | Versioned adapter contract, test identity, expiry and revocation behavior, fixed origin list, rollback owner | Authenticated staging and internal production |
| P0 | RANKLISTIQ data owner | Designate the canonical project-pinned migration directory and GitHub workflow for MR-078A | Repository path, workflow path, project reference by authority record, preview target, backup and rollback operator | Preview migration, RLS proof, staging, production |
| P0 | Deployment owner | Register the dedicated I1Q staging and internal production hosts and canonical GitHub deployment workflow | Staging URL, production URL, workflow identity, health route, monitoring destination, rollback route | State C |
| P0 | STAT owner | Reconcile the documented sealed-pack contract with the tracked and deployed response envelopes, and rule on the client hash authority conflict | Signed contract ruling and fixed baseline hashes | STAT consumer activation |
| P0 | Arena, STAT, Drills, and Daily owners | Reconcile deployed CDN bytes with authoritative source commits for all four protected runtimes | Source commit or archived source artifact for each deployed SHA-256, owner attestation, rollback artifact identity | Protected consumer certification and State C |
| P0 | Drills and Data owners | Confirm the read-only I1Q sidecar boundary and the ownership split among MMVS, RANKLISTIQ drill controls, and Growth Engine declarations | Versioned adapter approval and no-write contract | Drills consumer integration |
| P1 | Privacy owner, Brian interim | Commission a labeled privacy gold set using the accepted eight-class taxonomy and minimum denominators | Restricted gold labels, explicit evaluated counts, source-owner speaker mapping hash, independent score report | Privacy-safe working corpus and State B |
| P1 | Assessment-science owner, Brian interim | Ratify the provisional pilot metric policy after the privacy gold set exists | Dated threshold decision and pilot sampling record | Full-corpus extraction |
| P1 | Credentialed physician | Accept the medical governance role only after credential verification through an authoritative registry | Current MD or DO verification record, actor binding, expiry, specialties, conflict disclosure | Medical approval and any student-facing release |
| P2 | Real physician, editorial, novice, and assistive-technology participants | Execute the human validation protocol against an authenticated staging build | Signed session results with task completion, errors, accessibility observations, and severity | UX and accessibility production certification |

## Brian Publication Rule

Brian publication ratification is required for an exact immutable student-facing release during the MVP. It cannot be supplied in advance and cannot ratify a mutable candidate, an AI draft, an expired evidence chain, or content without a credentialed physician approval.

## Actions Not Required From Brian

Codex retains responsibility for local code repair, synthetic tests, offline migration validation, documentation, adapter tests, dependency remediation, evidence validation, and truthful release reporting. None of those tasks is converted into a human blocker merely because production is unavailable.

## Current Student Status

Student release remains disabled. No physician-approved revision exists, and no request to enable a student or consumer flag is appropriate in this run.

============================================================
FILE: I1Q_1007X_PATH_INDEX.md
============================================================
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

============================================================
FILE: I1Q_1007X_PERFORMANCE.md
============================================================
# I1Q-1007X Performance

## Verdict

`LOCAL SYNTHETIC MECHANICS PASS, STAGING CAPACITY UNKNOWN`

## Evidence

The full local package suite completes in approximately 1.4 seconds on the current workstation. A bounded in-memory benchmark inserts 10,000 synthetic extraction candidates and reads a 200-row page within the generator's 8-second safety budget. The latest generated result is recorded in `i1q-question-platform/evidence/load_results.json`.

The HTTP and UI contracts cap individual list requests at 200 records. Migration indexes cover source identity, transcript timing, revision-source joins, release membership, and other primary access paths. The disposable PostgreSQL contract run completes in under one second, but it is a correctness rehearsal, not a load test.

## Known Limits

The browser shell still performs some filtering within one bounded page. Cursor-backed server search, stable sorting, queue pagination, and 10,000-record operator journeys are not implemented end to end. No staging query plan, connection-pool saturation, concurrency, extraction throughput, retry pressure, network latency, cold start, memory, or production capacity evidence exists.

## Gate

Performance is adequate for continued local engineering only. State C requires staging load evidence against the actual unprivileged repository and deployment topology.

============================================================
FILE: I1Q_1007X_PILOT.md
============================================================
# I1Q-1007X Stratified Real Pilot

## Verdict

`NOT_RUN, PRIVACY GATE BLOCKED`

No real recording was selected for extraction and no real medical question, answer candidate, distractor, rationale, explanation, or taxonomy record was generated. This report contains no medical content.

## Preconditions

The pilot requires 8 to 12 privacy-cleared recordings spanning at least three specialties, transcript quality, speaker complexity, teaching style, age, and duration. At present, extraction-ready sources equal zero because the privacy working-copy and gold-pilot gates have not passed.

The privacy evaluation must be source-complete and class-gated. Every required class needs a sufficient adjudicated denominator, a nonzero precision denominator, a passing point estimate, the required lower confidence bound, and no zero-tolerance event. Aggregate scores cannot compensate for a missing or failing class.

## Provisional Technical Thresholds

| Measure | Threshold | Current result |
| --- | ---: | --- |
| Medical-question detection precision | at least 0.90 | NOT RUN |
| Medical-question detection recall | at least 0.80 | NOT RUN |
| Question-answer pairing | at least 0.85 | NOT RUN |
| Speaker attribution accuracy | at least 0.95 | NOT RUN |
| Timestamp accuracy within two seconds | at least 0.90 | NOT RUN |
| Patient privacy recall | at least 0.995 plus class gates | NOT RUN |
| Student-name privacy recall | at least 0.99 | NOT RUN |

A provisional AI benchmark may authorize quarantined candidate generation after privacy passes. It cannot authorize medical approval or student publication.

## Medical Governance

Medical governance remains unassigned. Medical-answer agreement and approval yield cannot be established as physician-reviewed measures. Any future real candidate must remain `AI_DRAFT_NOT_MEDICALLY_VALIDATED` until a credentialed physician reviews the exact immutable revision.

## Current Counts

| Measure | Result |
| --- | ---: |
| Pilot sources selected | 0 |
| Real medical questions detected | 0 |
| Eligible four-choice candidates | 0 |
| Quarantined real candidates | 0 |
| Physician-approved revisions | 0 |

## Unblock Route

Create and independently adjudicate the restricted gold privacy set, prove the working-copy contract on every selected source, freeze and hash the pilot protocol, then run the technical pilot. Any failure requires a versioned repair and a newly untouched gold set when tuning used the failed evidence.

============================================================
FILE: I1Q_1007X_PRIVACY_NORMALIZATION.md
============================================================
# I1Q-1007X Privacy Normalization

## Verdict

`BLOCKED_BEFORE_WORKING_COPY`

Read-only inventory is complete, but no real transcript has been promoted into a working-redacted extraction copy. No raw transcript text, source title, URL, original speaker label, or identity-bearing diagnostic is stored in Git or this handoff.

## Governed Corpus

| Measure | Result |
| --- | ---: |
| Authorized sources | 97 |
| Source-level `verified_drj` | 97 |
| Multi-speaker sources | 97 |
| Sources with explicit speaker evidence | 96 |
| Sources with generic-only speaker evidence | 1 |
| Compliant working-redacted copies | 0 |
| Extraction-ready sources | 0 |

Source-level classification does not prove segment-level speaker attribution. The generic-only source must retain zero segments until an authoritative source-owner attestation or equivalent restricted mapping is recorded.

## Required Boundary

The accepted privacy design has four zones:

1. Raw source-system truth, read only and restricted.
2. Restricted processing copies, mappings, gold labels, and diagnostics.
3. Working-redacted copies containing only positively mapped Dr. J segments, opaque references, timestamps, redacted text, reason codes, and pipeline provenance.
4. Evidence-only aggregates and hashes suitable for Git.

A working copy must be constructed from an allowlist. It may not be produced by cloning a raw object and editing selected fields. Original text, original speaker labels, source metadata, reversible source IDs, and raw/redacted sibling fields are forbidden.

## Required Removal Classes

- non-Dr. J speech, including student, unknown, mixed, overlapping, and ambiguously attributed segments
- student names and other student identifiers
- patient direct identifiers
- patient quasi-identifiers
- third-party identities
- complete identifying clinical anecdote windows when span removal is insufficient
- source titles, URLs, paths, filenames, original IDs, and original speaker labels

Uncertainty resolves to complete removal or source quarantine.

## Local Contract Repair

The 1007X repair replaces the unsafe 1006 normalization shape with an allowlist constructor. It emits newly constructed working segments, uses only opaque source linkage and approved Dr. J fields, models all eight required privacy classes, suppresses ambiguous and identifying anecdote windows, keeps public excerpt and media permissions off, and rejects raw-text aliases and original source metadata keys.

The local suite proves deterministic output, exact source mapping, complete class coverage, zero-denominator failure, per-class minimums, exact lower-bound gates, and zero-tolerance failures using non-clinical fixtures. These tests close the local contract defect. They do not create a real working transcript or substitute for a restricted, source-complete human-adjudicated gold evaluation.

## Unblock Evidence

Normalization can promote a source only after all of the following exist:

- exact source and pipeline digests
- authoritative source-specific Dr. J speaker mapping
- class-complete deterministic redaction
- no raw sibling fields or source metadata in output
- serialized-output forbidden-field and metadata scans
- byte-identical rerun evidence
- a passing per-source validation result
- a passing source-complete global privacy pilot

## Release State

The local privacy contract passes engineering tests. Real promotion remains blocked because no restricted gold set or passing source-complete evaluation exists. Real extraction, candidate generation, public excerpts, media clips, and student publication remain disabled.

============================================================
FILE: I1Q_1007X_PRODUCTION_DEPLOYMENT.md
============================================================
# I1Q-1007X Production Deployment

## Verdict

`NOT DEPLOYED`

No preview, staging, canary, internal production, student production, STAT consumer, or Drills consumer deployment occurred.

There is no approved I1Q GitHub deployment workflow, runtime host, canonical session adapter, runtime database role, staging certificate, backup identity, monitoring target, or rollback rehearsal. The root therefore did not use manual SQL, `railway up`, direct runtime replacement, ad hoc upload, or any protected consumer deploy script.

The deployment manifest truthfully records `BLOCKED_NOT_DEPLOYED` and highest achieved `STATE_A`. `internal_platform_enabled`, `internal_review_enabled`, `student_content_enabled`, `student_release_enabled`, `stat_adapter_enabled`, and `drills_adapter_enabled` are all false.

No production release commit exists because the release gates did not pass.

============================================================
FILE: I1Q_1007X_PRODUCTION_SMOKE.md
============================================================
# I1Q-1007X Production Smoke

## Verdict

`NOT RUN, NO I1Q PRODUCTION DEPLOYMENT`

The local synthetic health route returns the expected service identity and security headers. That result is recorded as local evidence only.

No production URL exists for I1Q, so the following were not run:

- canonical login, session, timeout, logout, and reauthentication
- role-specific dashboard and review access
- datastore and RLS queries
- source inventory and candidate queue
- answer isolation before and after finalization
- incident, audit, release, and rollback journeys
- monitoring, alerting, and backup checks
- responsive browser and accessibility smoke

Protected Matrix, Arena, current STAT, current Drills, and WordPress routes were not changed by this candidate. Prior runtime observations remain comparison evidence, not an I1Q production smoke result.

============================================================
FILE: I1Q_1007X_PROTECTED_SYSTEM_COMPARISON.md
============================================================
# I1Q-1007X Protected System Comparison

## Verdict

`PROTECTED_RUNTIME_REACHABLE, SOURCE CHECKSUM BASELINE DIVERGED`

No protected runtime, route, source file, deployment object, cache, datastore, or feature flag was changed by this comparison.

## Authority And Method

The comparison used the existing read-only `VALIDATION/validate_runtime.sh` LIVE path and independent hash, byte-count, line-count, and diff-stat checks. Runtime files were downloaded to a temporary directory. No content was copied into Git or this report.

The canonical runtime URL and WordPress wrapper routes were treated as runtime truth. The tracked `LIVE/` files in this branch were treated only as the source candidate under comparison.

## Static Source Baseline

`bash VALIDATION/validate_deploy.sh` passed before this runtime comparison. It verified the tracked Arena, STAT, Drills, and Daily documents, their route and MMOS markers, the RANKLISTIQ project pin, absence of the deprecated project ID, absence of frontend `signUp`, and absence of a service-role string.

This static result does not prove parity with production.

## LIVE Runtime Result

`bash VALIDATION/validate_runtime.sh --env LIVE` reached all four CDN artifacts, all five WordPress wrapper routes, and the auth-exchange endpoint. Runtime contract markers passed. The command failed only its four local-to-CDN checksum comparisons.

| Surface | Tracked SHA-256 | Deployed SHA-256 | Tracked bytes | Deployed bytes | Tracked lines | Deployed lines | Diff additions | Diff deletions |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Arena | `2b881db56490a3fe10f950bab2e3b744a7d00960a515797c91c53b190440750a` | `7bb0ad1cf1cf9e3d1fbaa021606d98fbd0000b2b0cac3898bce6c73225a37705` | 765,627 | 975,417 | 19,594 | 25,151 | 9,827 | 4,270 |
| STAT | `350108cc24edd44c885061aa084763e7613102cf3c41eb8e8d8c324242c08d75` | `77303e6352d2bffa8ec0e7ce3ec1709fa559e0b13201188b59fdca29af885425` | 344,178 | 466,902 | 10,110 | 13,148 | 3,368 | 330 |
| Drills | `cd79a2f1c822214643f58347fe8abd0fe5cfc0342caa39523a56fb81fb2ad91d` | `c480c014d405a65d6b1b4ff47e613d476383de8aba018a654375e25a07b261cc` | 432,092 | 474,965 | 10,539 | 11,437 | 1,032 | 134 |
| Daily | `aa7b7ff42f51f85c8af6b8953eac26c65f75c223818706fb08818a47df49e5af` | `409a89d01f072f8412f0259ea9b870bc62800b96f30cfd5580a3b223253ec6b7` | 150,069 | 167,700 | 3,619 | 3,935 | 427 | 111 |

## Runtime Contract Checks

The following deployed markers passed:

- CDN HTTP reachability for Arena, STAT, Drills, and Daily
- MMOS presence and mode registration where required
- Arena route to `/stat`
- Arena route to Daily Rounds
- Daily selected-drill payload and launch route
- Drills contract guard and query-video path
- auth exchange and bootstrap markers in Arena, STAT, and Daily
- no deprecated Supabase project marker in any runtime
- WordPress wrappers for Arena, STAT, Drills, Daily, and Daily Rounds
- auth exchange endpoint reachable with expected unauthenticated status 400

These checks do not prove authenticated workflows, answer isolation, browser behavior, or source parity.

## Risk Ruling

The mismatch is material and changes the release risk. The tracked `LIVE/` files cannot be used as a deploy or rollback baseline for current production. Any attempt to deploy them could regress functionality that exists only in the deployed runtime.

PROTECTED: no I1Q task may overwrite, promote, roll back, or certify Arena, STAT, Drills, or Daily from this branch until the consumer owners reconcile deployed bytes with an authoritative source commit and register the resulting hashes.

DO NOT TOUCH: cache purge, R2/CDN upload, WordPress wrapper changes, direct runtime replacement, and local-script promotion remain prohibited.

## Dependent Product Status

| Product | Current evidence | I1Q regression verdict |
| --- | --- | --- |
| Matrix | No Matrix path touched; live workflow not exercised | UNCHANGED, not independently smoke-tested |
| Arena | Runtime reachable and contract markers pass; checksum diverges | ACTIVE, source authority unresolved |
| STAT | Runtime reachable and contract markers pass; checksum diverges | ACTIVE, no I1Q consumer enabled |
| Drills | Runtime reachable and contract markers pass; checksum diverges | ACTIVE, no I1Q consumer enabled |
| Daily Rounds | Runtime reachable and contract markers pass; checksum diverges | ACTIVE, no I1Q consumer enabled |
| WordPress auth proxy | Endpoint reachable; authenticated flow not exercised | ACTIVE, shared auth defects remain open |

## Required Resolution

1. Identify the exact commits or external source artifacts that produced the four deployed hashes.
2. Obtain owner confirmation for each protected product.
3. Preserve current deployed bytes as rollback artifacts through the canonical process.
4. Reconcile or regenerate tracked source without overwriting deployed truth.
5. Rerun static, runtime, authenticated, browser, answer-isolation, and rollback tests on the reconciled fixed commit.

Until then, protected consumer flags remain off and this mismatch is a release blocker for State C.

============================================================
FILE: I1Q_1007X_RED_TEAM.md
============================================================
# I1Q-1007X Independent Red Team

## Verdict

`STATE C VETO RETAINED, STATE A SUPPORTED ONLY AS A DATED POINT-IN-TIME AGGREGATE`

At exact pushed checkpoint `ba17e22b0fe8a48a7397557ef95d2ceb454970d4`, IRT-009 is closed in local exact-checkpoint scope and IRT-010 is closed for evidence integrity. No global deployed no-leak clearance is claimed.

## Audit Sequence

1. The first independent audit at `6ac62c5` found a Class D key in the Class C debrief and no purpose-scoped protected-content reader for assigned reviewers.
2. Commit `b9bb26a` repaired those findings. Commit `aebc987` made the inventory qualification explicit and machine-readable.
3. A report-only check at `6dc408f` closed the first two findings but was superseded because later audits found deeper encoding paths.
4. The audit at `2d28d0b` reproduced 28 double URL-encoding bypasses and required bounded iterative normalization.
5. Audits at `65bb52c` found that SQL lowercased before decoding, then restored uppercase bytes. A broader matrix persisted eight of eight full-byte mixed-case probes, and the final verifier independently persisted the named IRT-009-H4 vector in all four prose families.
6. Commit `e9e807c` case-folded after every SQL decode pass and final normalization, and expanded the relational matrix. Commit `ba17e22` refreshed the exact evidence.
7. The final independent audit at `ba17e22` reproduced all requested attacks and closed the local defect without clearing any external State C gate.

## Finding Ledger

| Finding | Final disposition |
| --- | --- |
| IRT-001, State C integration and operations absent | OPEN CRITICAL. Canonical identity, runtime repository, staging, deployment, monitoring, backup, and operational rollback proof do not exist. |
| IRT-002, Class D key in Class C debrief | RESOLVED IN LOCAL APPLICATION SCOPE. Closed-world Class C projection and value scanning pass. |
| IRT-003, assigned reviewers cannot inspect protected content | RESOLVED IN LOCAL APPLICATION SCOPE. Exact-assignment audited access passes; external runtime behavior is unverified. |
| IRT-004, exact corpus counts not independently reproducible | TRUTHFULLY QUALIFIED. The inventory is a dated point-in-time aggregate with no retained privacy-safe row manifest. |
| IRT-005, intended runtime RLS unproven | OPEN EXTERNAL. Disposable PostgreSQL passes, but canonical grants, pool, repository composition, and staging RLS proof are absent. |
| IRT-006, global no-leak claim unproven | OPEN EXTERNAL. No requested local counterexample remains, but no deployed response, browser, log, telemetry, cache, or storage proof exists. |
| IRT-007, rollback, monitoring, and protected consumers unproven | OPEN EXTERNAL. No canonical operational route or owner-reconciled runtime baseline exists. |
| IRT-008, browser, accessibility, human, and UX gates unproven | OPEN EXTERNAL. Browser was unavailable, no staging host exists, and the last simulated UX score predates the final repairs. |
| IRT-009, Class D encoding and SQL persistence bypasses | CLOSED IN LOCAL EXACT-CHECKPOINT SCOPE at `ba17e22`. All four historical High counterexamples, including IRT-009-H4 at `65bb52c`, are preserved. Every requested final JavaScript and PostgreSQL probe failed closed before hashing or insertion. |
| IRT-010, exact-checkpoint evidence integrity | CLOSED at `ba17e22`. All 44 artifact records match exact Git-object bytes and hashes. |

## Final Independent Proof

- Exact local and tracked origin commit: `ba17e22b0fe8a48a7397557ef95d2ceb454970d4`
- JavaScript matrix: 196 of 196 identifier combinations denied
- PostgreSQL matrix: 196 of 196 identifier combinations and 16 of 16 marker combinations denied
- Limit probes: depth 9 and 65,537 bytes both returned fail-closed SQLSTATE `54000`
- Persistence proof: 0 artifact rows and 0 payload rows for denied probes
- Focused STAT and Drills adapters plus Class C suite: 48 passed, 0 failed, 0 skipped
- Package suite: 228 discovered, 227 passed, 0 failed, 1 intentionally gated PostgreSQL skip
- Fresh disposable PostgreSQL 16: 13 passed, 0 failed, 0 skipped
- Evidence validator: 20 of 20 files, 0 errors, claimed State A
- Exact artifact checksums: 44 of 44 matched, 0 stale
- Root dependency audit: 0 vulnerabilities
- Opaque public question identity: preserved
- STAT server projection: exactly nine frozen fields
- Student and consumer flags: all six flags off
- Real candidates: 0
- Credentialed physician approvals: 0

## State Ruling

State A is the highest supported state. The 97-source inventory is a dated aggregate attestation backed by witnessed response and probe hashes plus internally consistent totals. It is not independently reproducible row by row from Git.

State B is not achieved because no privacy-safe working transcript, accepted real privacy pilot, extraction-ready source, or real candidate exists.

State C is vetoed because canonical auth, runtime datastore wiring, preview, staging, production deployment, browser, accessibility, human, monitoring, backup, rollback, and protected-consumer evidence are absent.

State D is prohibited because medical governance remains unassigned and no credentialed physician-approved immutable revision exists.

## Scope Boundary

The final local Class D encoding contract is clear only for exact checkpoint `ba17e22` and its explicit eight-pass, 64 KiB fail-closed boundary. It is not a deployed global leak certification. All six flags must remain off, and no production, consumer, student, State B, State C, or State D activation is authorized.

============================================================
FILE: I1Q_1007X_REGISTRATION.md
============================================================
# I1Q-1007X Registration

## Verdict

`CANONICALLY REGISTERED`

## Registration Record

The MissionMed OS registration branch is:

`codex/i1q-1007x-registration`

Registration commit:

`e88b12c chore(i1q): register MissionMed Question Platform`

The commit adds or updates:

- `missions.json`
- `products_index.json`
- `PRODUCT_PASSPORTS/question-platform.md`
- generated `CURRENT.md`

Registered identifiers:

| Field | Value |
| --- | --- |
| Mission ID | `I1Q-1006` |
| Product name | `MissionMed Question Platform` |
| Product slug | `question-platform` |
| Product status | `internal_build_authorized_student_release_blocked` |
| Mission state | `active` |
| Track | `local` |
| Demo | `false` |
| Source branch | `i1q-question-platform-ultra-1007x-ma` |

The registration is additive. Uniqueness checks for mission, product, and authority identifiers passed. The passport records the authenticated internal application boundary, canonical identity reuse, additive `i1q` datastore, protected consumers, read-only source access, and disabled student and consumer flags.

## Validation

- Registry JSON parsing: PASS
- Unique mission and product IDs: PASS
- MissionMed OS lint: PASS, with only pre-existing long-token warnings
- State-feed unit suite: 33 tests PASS
- Adapter contract: PASS
- Renderer contract: PASS
- Full read-only validation suite: PASS
- Secret-pattern scan: no matches
- Generated test cache removed after validation

## Canonical Review

The branch was pushed and opened as draft review:

[MissionMed OS PR #12](https://github.com/brinyu13/missionmed-os/pull/12)

Both MissionMed GitHub workflows and the published-page check passed. A fresh independent agent verified exact range `714443573c41e7a04e4241e67244c334787e1bed..b3d8089dbc436bad6ec48de95e1d57b6985b7444`, reran lint, 33 state-feed tests, the full read-only regression suite, adapter, renderer, secret, manifest, canon-hash, and local-serve checks, and issued `PASS / SAFE TO MERGE` with no defect.

PR #12 was promoted from draft and merged only at verified head `b3d8089dbc436bad6ec48de95e1d57b6985b7444`. Canonical MissionMed OS `main` was clean at merge commit `93c0404794fe105235b80514c75fffc3177f140b`. At the final read-only recheck, `main` and `origin/main` both pointed to `0e47d39d79edd9891896eb41e65183e855573cc1`, the tree was clean, `CURRENT.md` listed I1Q-1006 active with no blocker, and the passport plus DR-006 remained tracked. The later RISE commit is separately owned and was not modified by I1Q.

============================================================
FILE: I1Q_1007X_REPORT.md
============================================================
# I1Q-1007X Supervisor Report

## Result

`PARTIAL AGAINST THE STATE C TARGET, COMPLETE FOR THE HIGHEST SAFELY ATTAINABLE STATE`

Highest achieved state: `STATE A: REAL_CORPUS_INVENTORIED`, supported as a dated point-in-time aggregate.

State B was not attempted because every real source remains privacy blocked. State C was not attempted because canonical identity, runtime datastore wiring, staging, deployment, browser, human, monitoring, backup, and operational rollback gates are unavailable. State D is prohibited because medical governance is unassigned and there are zero credentialed physician-approved real revisions.

## Source And Authority

| Field | Result |
| --- | --- |
| Source worktree | `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000` |
| Source branch | `i1q-question-platform-ultra-1006` |
| Source commit | `0d6f78f2a2036731ec592398ce5fd845beb54333` |
| Target branch | `i1q-question-platform-ultra-1007x-ma` |
| Frozen engineering checkpoint | `ba17e22`, pushed exact code, SQL, tests, and evidence checkpoint |
| Final local repairs | `b9bb26a` closes direct Class C key and assigned-reviewer access findings; `78e194e` and `4a14ad8` add application and SQL release-linked value isolation; `4cdef98` closes mixed-case Base64 and Base64URL bypasses; `f5244a2` adds bounded iterative decoding; `64d7631` aligns SQL to eight full printable-ASCII passes; `e9e807c` closes post-decode mixed-case SQL persistence; `ba17e22` refreshes exact evidence |
| Required source commits | `0a05b4d` and `0d6f78f`, both verified |
| 1006 combined handoff | SHA-256 matched `ad311340c8ecbe7abf4f077fa92dc1ef32760d65bbac4ab9a70b76b4fe379572` |
| MissionMed OS registration | Canonical through PR 12 |
| MissionMed OS authority | DR-006 effective |
| I1Q MissionMed OS merge commit | `93c0404794fe105235b80514c75fffc3177f140b` |
| Current canonical MissionMed OS commit | `0e47d39d79edd9891896eb41e65183e855573cc1`, clean and synchronized with `origin/main` at final read-only recheck |
| Prior dirty work | Preserved on recovery commit `91a680b1a2e5befd4fbe16b47f6e36f70fdaf419` and external forensic package |

MissionMed OS `main` remains synchronized with `origin/main`. The later RISE commit is separately owned. `CURRENT.md` lists I1Q-1006 active with no MissionMed OS blocker, and the passport plus DR-006 remain tracked. Root inspected this state read only and made no MissionMed OS change.

## State Ledger

| State | Verdict | Evidence |
| --- | --- | --- |
| State A, real corpus inventoried | CLEAR WITH POINT-IN-TIME AGGREGATE QUALIFICATION | Witnessed 97-row registry response, 97 transcript JSON probes, 97 nodes JSON probes, 97 source-level verified Dr. J classifications, and aggregate hashes and totals; no privacy-safe row manifest retained |
| State B, real candidate bank ready | NOT ACHIEVED | 0 privacy-safe working transcripts, 0 extraction-ready sources, 0 real candidates |
| State C, internal production live | NOT ACHIEVED | no canonical auth resolver, runtime role, repository wiring, staging host, production host, deployment workflow, browser proof, human proof, monitor, backup, or operational rollback |
| State D, approved content production live | PROHIBITED | medical governance unassigned, 0 credentialed physician approvals, 0 Brian-ratified immutable releases |

## Real Corpus And Legacy

| Measure | Count |
| --- | ---: |
| Unique videos | 97 |
| Transcript JSON artifacts available | 97 |
| Separately verified VTT artifacts | 0 |
| Nodes JSON artifacts available | 97 |
| Source-level verified Dr. J sources | 97 |
| Multi-speaker or potential-identity sources | 97 |
| Privacy-safe working transcripts | 0 |
| Extraction-ready sources | 0 |
| Real medical questions detected | 0, pipeline not run |
| Eligible four-choice candidates | 0 |
| Quarantined real candidates | 0 |
| Credentialed physician-approved revisions | 0 |
| Static legacy v4 rows reconciled | 845 |

The zero question and candidate counts are execution counts. They do not claim that the source recordings contain no medical questions.

The corpus totals are point-in-time aggregate evidence from the authorized 2026-07-15 read. They cannot be independently recomputed row by row from Git because the privacy-safe row manifest was not retained.

The static v4 source is reconciled at exactly 845 rows without a production database read or write. The current 3,961-item STAT CDN mirror is a distinct collection with zero observed identifier intersection and is not substituted for the v4 count.

## Local Candidate

The dedicated local application implements 17 internal workflows, a fail-closed resolver boundary, session-bound CSRF and Origin checks, actor-scoped reads, explicit review assignment acceptance, immutable review and release history, answer and source isolation, exact release validation, all six feature gates, the frozen STAT projection, explicit Drills availability, and an additive 52-table PostgreSQL migration candidate with preserving compensation.

The local privacy contract now uses newly constructed allowlisted working segments, the complete eight-class privacy taxonomy, fail-closed ambiguity handling, deterministic output, and no public excerpt or media permission. Real promotion still requires a restricted source-complete gold evaluation.

All six flags remain false:

- `internal_platform_enabled`
- `internal_review_enabled`
- `student_content_enabled`
- `student_release_enabled`
- `stat_adapter_enabled`
- `drills_adapter_enabled`

## Verification

| Check | Result |
| --- | --- |
| Application package suite | PASS, 228 tests, 227 passed, 0 failed, 1 intentionally environment-gated skip |
| Disposable PostgreSQL suite | PASS, 13 passed, 0 failed, 0 skipped |
| Evidence validator | PASS, 20 of 20 files, 0 errors, claimed State A |
| STAT and Drills adapter plus Class C isolation suite | PASS, 48 of 48 |
| Root dependency audit | PASS, 0 vulnerabilities |
| Application dependency audit | NOT APPLICABLE, isolated package declares zero dependencies and has no lockfile |
| Root test command | PASS with 0 discovered tests; not counted as substantive coverage |
| OpenAPI and live local route parity | PASS |
| Static security and privacy regressions | PASS locally |
| Browser and accessibility certification | NOT RUN |
| Authenticated staging and production tests | NOT RUN |
| Production writes or protected runtime changes | NONE |

Darwin's point-in-time reports certify the `6ac62c5` checkpoint with 205 passing tests and 20 valid evidence files. The first independent red team then found a direct Class D key in the Class C debrief and missing purpose-scoped reviewer content. Commit `b9bb26a` repairs both. A report-only check at `6dc408f` closed those two findings but was later superseded because it did not find the deeper value-encoding problem. Subsequent commits derive release-linked values, scan them before hashing and insertion, and close direct, embedded-prose, and mixed-case Base64 and Base64URL bypasses. The independent rerun at `2d28d0b` reproduced 28 double URL-encoding bypasses. Commits `f5244a2` and `64d7631` added bounded iterative normalization, but exact `65bb52c` audits then proved that SQL restored uppercase bytes after its only case fold: a broader matrix persisted eight of eight full-byte mixed-case probes, and the final verifier independently persisted the named IRT-009-H4 percent vector in all four prose families. Commit `e9e807c` case-folds after decoding and expands the fresh PostgreSQL proof to 196 actual mixed-case release-linked identifier probes, 16 marker probes, depth and size denials, and zero-row assertions. Commit `ba17e22` refreshes all machine evidence; all 44 checksums match its exact bytes. Darwin's external release veto remains valid.

## Specialist Verdicts

- Ecosystem: authority and dependency graph mapped; protected source-runtime divergence remains owner-blocked.
- Privacy: real-source promotion veto retained; local privacy mechanics repaired and passing.
- Medical: no medical approval and no credential inference.
- Assessment science: no real-candidate quality claim; pilot and release veto retained.
- Auth and security: local contract pass; canonical integration and environment attack proof blocked.
- Datastore: offline migration, forced RLS, and compensation pass; canonical runtime grants and preview blocked.
- UX and accessibility: last independent simulated score 5.87 of 10 before repairs; repaired candidate has no browser, assistive-technology, or human rescore.
- Performance: local synthetic mechanics pass; staging capacity unknown.
- Release reliability: no staging or production route, monitor, backup, or operational rollback proof.
- First independent red team on `6ac62c5`: State C veto; two local high findings repaired in `b9bb26a`; count-reproducibility qualification and external vetoes retained.
- Independent exact-object audits on `65bb52c`: IRT-009 remained open after mixed-case SQL bypasses persisted, including the named IRT-009-H4 vector in all four prose families; IRT-010 closed; State C veto retained.
- Independent exact-object audits on `ba17e22`: IRT-009 and IRT-010 closed in local exact-checkpoint scope; JavaScript denied 196 of 196; PostgreSQL denied 196 of 196 identifiers and 16 of 16 markers with zero persistence; the exact H4 replay denied all four prose-family attacks; State C veto retained for external gates.

## Consumer Safety

STAT, Drills, Daily Rounds, Arena, Matrix, WordPress auth, MissionMed HQ auth, Stream, R2, CDN objects, production Supabase data, source registries, and student data were not modified. STAT and Drills adapters remain local versioned contracts with their consumer flags off. The deployed bytes for four protected consumer runtimes differ from tracked `LIVE/` sources, so owners must reconcile authoritative commits and rollback artifacts before integration.

## Deployment Truth

Staging URL: none.

Production URL: none.

No preview migration, staging migration, canary, internal production deployment, production smoke, cache purge, runtime replacement, or feature-flag activation occurred. The deployment manifest is `BLOCKED_NOT_DEPLOYED` and claims only State A.

## Human And External Actions

The exact owner actions are recorded in `I1Q_1007X_OPEN_HUMAN_ACTIONS.md`. The critical sequence is:

1. Identity owner supplies and certifies the canonical I1Q session resolver.
2. RANKLISTIQ data owner registers the project-pinned MR-078A preview and GitHub migration route plus the unprivileged runtime role.
3. Deployment owner registers dedicated staging and internal production hosts, monitoring, backup, and rollback routes.
4. Protected product owners reconcile deployed Arena, STAT, Drills, and Daily bytes to authoritative source and rollback artifacts.
5. Brian, as interim privacy owner, commissions the restricted eight-class gold set and source-complete evaluation.
6. After privacy passes, run the frozen stratified pilot and only then consider quarantined real extraction.
7. Run authenticated staging security, RLS, browser, accessibility, human, load, monitoring, and rollback protocols.
8. Assign and verify a credentialed physician before any medical approval; obtain Brian ratification only for an exact immutable student release.

## Final Ruling

All independently executable engineering, inventory, repair, validation, and documentation work is complete. State A is supported with the explicit point-in-time aggregate qualification. State B, State C, and State D remain truthfully blocked by unmet gates rather than by unfinished local code repair.

============================================================
FILE: I1Q_1007X_RLS.md
============================================================
# I1Q-1007X Row Level Security

## Verdict

`FORCED RLS CONTRACT PASS LOCALLY, RUNTIME ROLE CERTIFICATION BLOCKED`

## Controls

Every table created by the 1007X migration enables and forces RLS. The candidate revokes schema and table access from `PUBLIC`, `anon`, and `authenticated`. It intentionally does not create a broad runtime grant.

Actor identity is grounded in `auth.uid()` and database membership. Historical caller-asserted role GUC semantics are not accepted. Purpose-scoped functions protect answer-bearing data, restricted source references, review writes, release assembly, validation, promotion, and compensation.

## Adversarial Proof

The disposable PostgreSQL run proved denial for anonymous access, ordinary read-only answer access, revoked reviewer access, assignment and role mismatches, channel-policy mismatches, pre-answer answer fields, release-scoped Class D keys and values in Class A and Class C artifacts, invented validation checks, and incorrect validation evidence hashes. It also executed 196 actual mixed-case release-linked identifier probes across seven families, four Class C prose fields, and seven direct or encoded variants, plus 16 encoded-marker probes and depth and 64 KiB size fail-closed cases. Every denied probe left zero rows in both artifact tables. Safe Class A and Class C artifacts and the exact official validation set succeeded.

## Remaining Risk

No canonical unprivileged runtime role exists yet, and no runtime grant manifest was supplied. The Postgres repository is not wired to the HTTP service. Staging connection pooling, transaction-local actor propagation, role revocation latency, query plans, and production policy behavior are untested.

The absence of runtime grants is deliberate fail-closed behavior, not State C readiness.

============================================================
FILE: I1Q_1007X_ROLLBACK.md
============================================================
# I1Q-1007X Rollback

## Verdict

`COMPENSATING CONTRACT PASS LOCALLY, STAGING AND PRODUCTION NOT EXECUTED`

## Artifact

The forward-only compensation is:

`i1q-question-platform/db/rollback/20260715122435_i1q_1007x_compensating_disable.sql`

It disables all six I1Q flags, preserves every table and immutable history record, records one authoritative compensation identity, and is safe to reapply. It does not drop, truncate, delete, or rewrite source, review, release, or audit data.

## Local Proof

The disposable PostgreSQL test applied the primary migration, reapplied it, exercised adversarial role, release, and iterative Class D artifact-isolation cases, applied compensation twice, verified retained history and disabled flags, then reapplied the primary file. The isolation proof included 196 actual mixed-case release-linked identifier probes, 16 encoded-marker probes, depth and size limits, and zero persisted denied rows. All 13 assertions passed.

## Operational Boundary

No staging or production rollback was executed. No deployed application artifact, prior release image, backup snapshot, restore point, monitor alert, operator timing, or production re-promotion path exists for I1Q.

The correct operator action remains to run this compensation only through the future canonical GitHub migration workflow after backup identity and environment ownership are recorded. Manual SQL is prohibited.

============================================================
FILE: I1Q_1007X_SECURITY.md
============================================================
# I1Q-1007X Security

## Verdict

`LOCAL SECURITY CONTRACT PASS, RELEASE CLEARANCE BLOCKED`

## Independent Findings And Repairs

The integrated security audit initially issued a veto for draft-read IDOR, missing internal feature gates, consumer artifact access without an adapter flag, revoked-reviewer answer access, channel-policy confusion, arbitrary release validation checks, expired-rights handling, and an incomplete current review lifecycle.

The root repair waves closed those actionable local defects with direct regression tests. The final waves removed Class D misconception keys from the Class C debrief, added closed-world Class C projection validation, rejected release-linked Class D values and encoded markers in every permitted prose field before hashing, and added a purpose-scoped reader for accepted reviewers of one exact immutable revision. Both JavaScript and candidate SQL now use bounded iterative normalization with a 64 KiB scalar ceiling. The regression matrix covers mixed-case Base64 and Base64URL values plus separator-only and full printable-ASCII double and triple URL encoding for every release-linked identifier family and all four permitted teaching-prose fields. The database proof also verifies that every denial occurs before artifact or payload persistence. The production reader remains adapter-required, the payload is closed-world validated, access is audited, failures do not echo protected content, and the browser receives `Cache-Control: no-store`.

The current candidate enforces actor-scoped reads, internal platform and review flags, exact consumer flags, explicit assignment acceptance, current reviewer role and credential checks, expired rights rejection, policy-bound channel artifacts, the official LT-1 through LT-6 validation set, artifact-bound evidence hashing, independent validation, ratification, and publication actors, and both student flags before publication.

## Verification

- Complete package suite: 228 discovered, 227 passed, 0 failed, 1 disposable-database skip
- Separate disposable PostgreSQL suite: 13 passed, 0 failed, 0 skipped
- PostgreSQL identifier matrix: 196 actual mixed-case release-linked probes across seven families, four prose fields, and seven direct or encoded variants
- PostgreSQL marker matrix: 16 double and triple encoding probes plus depth and size fail-closed cases, with zero persisted artifact or payload rows
- Root dependency audit: 0 vulnerabilities
- Syntax and whitespace validation: pass
- Evidence validator: 20 of 20 files, 0 errors, claimed State A

## Remaining Veto Grounds

Canonical identity, runtime role grants, service-to-Postgres wiring, staging IDOR and CSRF tests, production rate limits, browser behavior, accessibility, human review, monitoring, and rollback operations are not proven. These remain release veto grounds even after the local Class C key, value-isolation, and reviewer-content repairs.

No answer map is exposed before finalization. No raw source text appears in repository evidence. All six flags remain off.

============================================================
FILE: I1Q_1007X_STAGING_CERTIFICATION.md
============================================================
# I1Q-1007X Staging Certification

## Verdict

`NOT CERTIFIED, NO CANONICAL STAGING ENVIRONMENT`

## Passed Inputs

- MissionMed OS registration and DR-006 authority are canonical.
- The dated aggregate real-corpus inventory supports State A with an explicit no-row-manifest qualification.
- Local application, adapters, evidence validator, migration, RLS, and compensation tests pass.
- Dependency audit reports zero vulnerabilities.
- No medical approval, candidate count, browser result, or deployment state is invented.
- All six feature flags are off.

## Failed Or Missing Gates

- canonical MissionMed HQ identity adapter wired to I1Q
- canonical unprivileged runtime role and repository wiring
- project-pinned preview and staging migration workflow
- staging URL and GitHub deployment workflow
- staging RLS and auth matrix
- real privacy-normalized pilot
- browser, responsive, keyboard, accessibility, and human protocol
- staging backup, rollback, reapply, monitoring, and incident exercise
- final Red Team State C clearance

## Decision

No staging migration or deployment was attempted. The local disposable PostgreSQL proof is not relabeled as preview or staging. Staging certification remains blocked.

============================================================
FILE: I1Q_1007X_STAT_ADAPTER.md
============================================================
# I1Q-1007X STAT Adapter

## Verdict

`LOCAL_CONTRACT_PASS, CONSUMER INTEGRATION OFF`

The versioned local STAT adapter now enforces the frozen nine-field server projection, composite identity, stable export IDs, exact release membership, fixed artifact classes, and closed-world Class A and Class C validation. It has not been installed in, connected to, or enabled for the protected STAT runtime.

## Implemented Boundary

| Contract | Result |
| --- | --- |
| `dataset_questions` fields | Exactly `dataset_version`, `question_id`, `prompt`, `choice_a`, `choice_b`, `choice_c`, `choice_d`, `answer`, `explanation` |
| Field order | Enforced |
| Projection identity | Composite `dataset_version + question_id` |
| Export question ID | Explicit stable value required; ordinal fallback prohibited |
| Duplicate identity | Rejected before artifacts are built |
| Release membership | Exact `item_id`, `item_revision_id`, `revision_number`, `content_hash`, `dataset_version`, `question_id` tuple |
| Historical identity | Dataset version, question ID, and content hash preserved |
| Server dataset | Class `server_only` |
| Pre-answer artifact | Class A, answer-free |
| Post-answer debrief | Class C |
| Question metadata | Class D, server-only, composite identity |
| Hash chain | Single manifest with previous-manifest link and artifact hashes |

## Answer Isolation

Class A validation is closed-world for pre-answer questions, indexes, and lookup data. It rejects unknown fields plus recursive answer, answer-map, correctness, explanation, solution, and rationale aliases. It also detects common serialized answer disclosures in string values.

Class C validation is closed-world for each debrief row and distractor rationale. It permits only dataset identity, answer, explanation, correct-answer rationale, and three prose distractor rationales. Internal misconception, item, revision, source, claim, reviewer, and psychometric keys and exact values are rejected and are not projected. The pre-hash scan covers all permitted prose fields plus encoded structured-field markers and release-linked internal records. Its bounded iterative normalization rejects mixed-case Base64 and Base64URL values, separator-only and full printable-ASCII double and triple URL encodings, excessive decode depth, and scalars above 64 KiB.

The post-answer contract accepts only server state `finalized` and a true server-derived participant result. A caller-provided phase string is not authorization. Final platform wiring is owned by the security integration slice and remains a release gate.

The protected `answer_map` remains outside this adapter and must remain server-only and unavailable before finalization.

## Deterministic Verification

Direct adapter suite:

- 48 tests passed
- 0 failed
- all 14 durable transformation vectors passed
- exact nine-field key order passed
- fixed STAT pack SHA-256 remained `9253830103fdf96a341797f34f42fa98427be4089e4fa1483402141b6386575f`
- reordering input revisions produced byte-equivalent artifacts and the same manifest hash
- duplicate IDs and absent stable IDs failed closed
- exhaustive recursive answer aliases failed closed
- 14 dedicated Class C projection, unknown-field, valid-string identifier, iterative encoding, size, depth, encoded-marker, and linked-record regressions passed

## Legacy Compatibility

The static v4 import identity is `v4 + question_id`. No legacy row, attempt, sealed pack, or active dataset was changed. The adapter exposes a versioned historical-join identity and preserves source hashes, but no production attempt join was executed.

The current 3,961-item CDN runtime mirror is not the static 845-row v4 dataset and has zero identifier intersection with it. The two sources must remain separately versioned.

## Protected Runtime Gates

| Gate | Status |
| --- | --- |
| Adapter unit and adversarial tests | PASS |
| Platform release integration | PASS in local synthetic service |
| Stable ID persistence in datastore | SPECIFIED and locally tested |
| Server-authoritative finalization and participant lookup | NOT PROVEN end to end |
| RLS answer isolation | PASS in disposable PostgreSQL |
| Deployed answer-leak test | NOT RUN |
| Historical attempt join | NOT RUN |
| Protected STAT checksum parity | BLOCKED, tracked and deployed sources diverge |
| STAT owner certification | NOT OBTAINED |
| `stat_adapter_enabled` | OFF |

## Files

- `i1q-question-platform/src/adapters/stat-v1.mjs`
- `i1q-question-platform/src/adapters/class-a.mjs`
- `i1q-question-platform/src/contracts.mjs`
- `i1q-question-platform/src/exports.mjs`
- `i1q-question-platform/tests/adapters-security.test.mjs`
- `i1q-question-platform/tests/exports-class-c.test.mjs`

## Conclusion

The local transformation contract is ready for integrated application and datastore testing. It is not authorized for protected STAT activation.

============================================================
FILE: I1Q_1007X_TRUE_BLOCKERS.md
============================================================
# I1Q-1007X True Blockers

## Highest Supported State

`STATE A: REAL_CORPUS_INVENTORIED AS A POINT-IN-TIME AGGREGATE`

The 97-row inventory is supported by witnessed source and probe hashes plus aggregate totals. It is not independently recomputable row by row because no privacy-safe row manifest was retained.

State B is blocked by privacy evidence. State C is blocked by canonical identity, datastore, deployment, protected-runtime, and certification dependencies. State D is intentionally unavailable without exact credentialed physician approvals and Brian publication ratification.

## External Blockers

### TB-01 Canonical Identity Resolver Unavailable

No canonical I1Q adapter currently resolves a fresh, non-revoked MissionMed session into I1Q-owned roles. The shared HQ implementation also has unresolved expiry, configured-secret, and CORS defects. The isolated I1Q boundary fails closed when no resolver is injected.

Exact resolution: the identity owner must provide a versioned resolver contract and test environment. Shared HQ changes require a separate protected decision, consumer baseline, security review, rollback, and dependent-product verification.

### TB-02 Canonical RANKLISTIQ Migration Route Unavailable

DR-006 names RANKLISTIQ as the datastore authority, but this repository has no owner-approved, project-pinned RANKLISTIQ migration path or GitHub workflow. Root `supabase/migrations/` is Growth Engine territory and its history is desynchronized.

Exact resolution: the data owner must register an MR-078A path and preview workflow. Only then may Root apply the offline candidate to preview, execute RLS attacks, rollback, reapply, and certify the exact migration hash.

### TB-03 I1Q Staging And Production Route Unavailable

No canonical I1Q host, staging environment, production environment, monitor, canary route, or rollback workflow was found. The existing Railway and CDN paths belong to protected products and are not an I1Q deployment route.

Exact resolution: the deployment owner must register dedicated I1Q hosts and a canonical GitHub workflow tied to the approved datastore and identity contract.

### TB-04 Protected Runtime Source Authority Diverged

The deployed Arena, STAT, Drills, and Daily bytes differ from every corresponding tracked `LIVE/` file. Runtime markers and reachability pass, but tracked source cannot be used as deployment or rollback truth.

Exact resolution: each consumer owner must map the deployed SHA-256 to an authoritative commit or archived source artifact, preserve rollback bytes, and certify the reconciled baseline.

### TB-05 Real Corpus Privacy Gate Not Evaluated

All 97 real sources contain multiple speaker labels or potential identity labels. No restricted privacy-safe working transcript, human-labeled gold set, or accepted eight-class recall and precision result exists. Every real source therefore remains extraction-blocked.

Exact resolution: the interim privacy owner must commission a restricted gold evaluation with explicit evaluated counts and the accepted denominators. The one-sided exact 95 percent lower-bound gates and zero-tolerance classes must pass before any source is extraction-ready.

### TB-06 Medical Governance Unassigned

No verified credentialed physician is assigned as medical governance lead. This does not block engineering, inventory, privacy evaluation, quarantined extraction, or internal review deployment. It blocks medical approval, release attestation, and student-facing publication.

Exact resolution: bind a current authoritative MD or DO credential record to a named reviewer and governance assignment. A title, name, AI judgment, or source authorship is not credential evidence.

### TB-07 Browser And Real Human Certification Unavailable

The in-app Browser was unavailable in this task, and no authenticated staging URL exists. A static automated UI audit cannot establish real browser, screen-reader, physician, editor, or novice-operator acceptance.

Exact resolution: provide the registered staging URL and execute the preserved human validation and browser protocols on the frozen candidate commit.

## Local Gate Status

Integrated tests, disposable PostgreSQL migration and RLS validation, dependency advisory repair, local performance testing, integrated security repair, final independent verification, and evidence validation are complete. The generated combined-handoff validation packaged with this report closes the documentation assembly gate. None of these local completions converts the external State B or State C blockers into a pass.

## No Shortcut Ruling

Manual production SQL, direct CDN or R2 upload, `railway up`, shared-auth weakening, untracked migration commands, source mutation, force push, or flag activation would not resolve these blockers. Each would bypass the authority and rollback evidence required for State C.

============================================================
FILE: I1Q_1007X_UI_UX.md
============================================================
# I1Q-1007X UI And UX

## Verdict

`SIMULATED GATE FAIL, HUMAN VALIDATION NOT STARTED`

## Audit Result

The independent current-state UX audit rendered all 17 workflows and all 16 operational states. Its simulated expert score was `5.87 / 10`, with a minimum category of `4.3 / 10` for source traceability. The required aggregate is at least 9.0 and every category must be at least 8.5.

That score predates the final root repair wave. The repaired candidate now binds source lineage, blocks expired-evidence decisions, completes core styling, preserves action feedback, improves focus contrast, and represents mobile navigation state correctly. The three-source regression passes.

## Honest Limit

The repaired UI has not received a fresh independent score, browser matrix, assistive-technology run, or genuine human protocol. The previous 5.87 score must therefore remain the last independent simulated result and cannot be silently upgraded.

Large-list server search, durable safe draft recovery, complete natural-state API journeys, and novice navigation efficiency remain open product work. No physician, editor, first-time operator, release manager, incident responder, or assistive-technology user tested the staged application because no staged application exists.

## Release Rule

UX and accessibility remain red for State C. Passing source and DOM tests support engineering confidence but do not authorize deployment.
