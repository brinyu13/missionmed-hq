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
