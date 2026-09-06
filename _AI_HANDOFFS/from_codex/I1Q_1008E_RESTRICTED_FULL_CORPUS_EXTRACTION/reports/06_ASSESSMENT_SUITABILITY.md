# 06 — Assessment Suitability

## Outcome

The I1Q-1008E corpus is an assessment-candidate inventory, not an approved item bank. All 117,893 occurrences remain `REVIEW_REQUIRED` for assessment suitability and medical review, and all 117,893 remain `RELEASE_PROHIBITED`. The approved count, released count, and final four-choice MCQ count are each zero.

The independent `ASSESSMENT_SCIENCE` review examined all 97 protected review packets and their associated occurrence and pass shards. It produced 97 `VERIFIED_WITH_FINDINGS` packet dispositions under the no-final-approval authority scope. The corrected-contract assessment batch root is `0de9a94243878c8cd0389d422e8d6dd59b90a9543f1278ef462f27b8301562c1`.

That disposition verifies bounded review coverage and preserves findings. It is not a medical approval, assessment approval, release decision, or final MCQ claim. The deterministic specialist finalizer separately completed the engineering integration across all four roles.

## Candidate-form inventory

| Safe metric | Count |
|---|---:|
| Exact `EXPLICIT_QUESTION` class | 27,918 |
| Expanded named explicit-prompt group | 32,299 |
| Implicit-question class group | 11,799 |
| Implicit/reconstructed set union | 12,021 |
| Teaching pivots plus testable statements | 14,190 |
| Verbatim forms | 116,982 |
| Reconstructed forms | 911 |

The expanded and union metrics follow the exact definitions in `candidate-inventory-safe-summary.json`; they are not independent additive categories. Transcripts are the primary content evidence. Nodes and the preliminary legacy comparison are secondary support only.

## Independent assessment findings

The assessment review confirmed the following safe aggregate properties:

- all 58,317 medically relevant or review-required occurrences map to exactly one provisional concept membership;
- no such occurrence is missing a concept membership or mapped to multiple provisional concepts;
- all 911 reconstructed forms satisfy the controlled reconstruction-template and metadata integrity checks;
- all 117,893 occurrences preserve assessment-review-required and release-prohibited states; and
- false physician-approval or final-governance-approval claims found: 0.

The review also preserved the following overlapping risk signals:

| Review signal | Occurrence count |
|---|---:|
| Ambiguity or missing-context risk | 45,955 |
| Possible answer-cue pattern | 308 |
| Binary/yes-no opening form | 1,482 |
| Vague short-reference form | 608 |
| Explicit form without terminal question punctuation | 869 |

These are screening signals, not unique occurrence counts and not adjudicated defect totals. A single occurrence can contribute to more than one signal. Transcript punctuation, spoken teaching form, and candidate reconstruction can legitimately trigger review without making the source invalid. The correct current action is continued quarantine or human item-writing adjudication, not silent promotion or rejection.

Every packet retained four finding classes: the governance gate remains closed; ambiguity/context risks require adjudication; reconstructed forms remain non-final; and possible cueing/form risks require item-writing review. No blocker to preserving the candidate inventory was found, but no candidate was granted final suitability.

## Completed integration and scope limitation

The refreshed Git-safe coverage receipt records 194 of 194 specialist verification cells and 388 of 388 specialist role reviews integrated, specialist status `VERIFIED`, and `extraction_complete: true`. This establishes contract-bound engineering completion for the observed cohort. It does not convert conservative findings into item approval, medical approval, rights clearance, release eligibility, or historical-universe completeness.

The corpus claim remains `C1_OBSERVED`, not historical-universe complete. The 2 observed Nodes-only records and 6 neither-available records constrain completeness, while registry/CDN/R2 historical reconciliation remains out of scope.

## Evidence

- `../evidence/candidate-inventory-safe-summary.json`
- `../evidence/coverage-receipt.json`
- `../evidence/extraction-run-manifest.json`
- `../evidence/processing-roster-safe.json`
- `../evidence/quarantine-summary.json`
- `../evidence/provisional-concept-summary.json`
- corrected-contract `ASSESSMENT_SCIENCE` batch root: `0de9a94243878c8cd0389d422e8d6dd59b90a9543f1278ef462f27b8301562c1`
