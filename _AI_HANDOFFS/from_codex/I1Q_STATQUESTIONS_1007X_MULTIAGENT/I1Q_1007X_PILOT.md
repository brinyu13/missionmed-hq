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
