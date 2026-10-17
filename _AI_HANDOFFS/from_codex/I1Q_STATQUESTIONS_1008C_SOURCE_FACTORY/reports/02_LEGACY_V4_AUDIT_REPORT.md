# Legacy v4 Audit Report

## Verdict

The static v4 export is a **secondary historical reference estate only**. It must not define, cap, or substitute for extraction from the complete Dr. J transcript corpus.

The static v4 export is useful as historical source material and topic recall, but **0 of 845 rows satisfy the requested release standard**. This is a whole-rubric result, not a claim that every isolated medical fact is false.

Every row universally lacks:

- credentialed physician approval;
- independent medical-authority evidence;
- transcript timestamp and segment-hash linkage;
- Level 1–3 explanations;
- structured distractor-by-distractor review;
- psychometric response evidence.

All 845 rows also lack established transcript provenance in the present run. Because the canonical corpus is inaccessible, that means linkage is unestablished—not that each concept is proven absent from Dr. J teaching.

## Structural failure pattern

The original bank appears to have been assembled from note fragments rather than authored as independent one-best-answer items:

- all canonical keys are A;
- all 517 base prompts begin with “What is”;
- the 328 vignette siblings reuse the base choices exactly;
- 98.45% of base distractor occurrences are the keyed answer text from a different question;
- truncation, compatibility ligatures, malformed punctuation, and unmatched parentheses are common enough to require systematic remediation rather than spot editing.

Runtime shuffling could hide answer-position bias from a learner, but it does not repair authoring bias, reviewer leakage, or distractor quality.

## Confirmed high-risk examples

An independent targeted medical-risk review found material lead-in/key or medical failures, including:

- `UQ-09DE30834236`: Hashimoto treatment keyed to antibodies rather than treatment.
- `UQ-2BF17D444723`: Chagas drugs presented as achalasia treatment.
- `UQ-5B49619FD516`: botulism treatment keyed to an exposure clue.
- `UQ-85A71541090D_V`: x-ray keyed as initial evaluation for biliary colic.
- `UQ-A63E6C970227`: herpes encephalitis treatment keyed to symptoms.
- `UQ-ECB89F258EF6`: a 72-hour fever periodicity assigned to *P. falciparum*.

These examples are evidence for quarantine and targeted physician remediation; they are not a complete clinical adjudication of every row. The reviewed selection was not retained as a credentialed medical-review artifact, so no denominator-based medical error rate is claimed.

## Non-destructive remediation model

1. Freeze the 845 rows as immutable historical source records.
2. Use the generated row manifest to route duplicates, sibling variants, structural flags, and source locators.
3. Never edit a legacy row in place.
4. Create a new candidate revision with current independent evidence, a new key, misconception-authored distractors, and Level 1–3 explanations.
5. Resolve citation support and conflict status.
6. Obtain exact-hash editorial and credentialed physician review.
7. Collect learner-response psychometrics only after expert approval.
8. Keep the historical source relationship and every occurrence visible in lineage.

## Reproducibility

Definitions and every row-level result are retained in `i1q-question-platform/evidence/source-factory/legacy-v4-audit.json`. The parser never writes to or modifies the migration.
