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
