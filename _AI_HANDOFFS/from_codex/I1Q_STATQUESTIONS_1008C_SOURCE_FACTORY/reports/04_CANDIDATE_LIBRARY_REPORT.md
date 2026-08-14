# Candidate Library Report

## Status and source role

The library contains 24 authority-derived, four-option, single-best-answer AI drafts. They are a reusable internal authoring and validation benchmark only.

They are **not transcript-derived**, are not evidence that any Dr. J question was extracted, and do not reduce the outstanding canonical corpus work. Their source bundles explicitly carry no transcript occurrence, timestamp, or answer-span claim.

Every candidate is:

- `AI_DRAFT_NOT_MEDICALLY_VALIDATED`;
- `PHYSICIAN_REVIEW_REQUIRED`;
- blocked from release;
- based on proposed public-authority links without immutable citation snapshots;
- marked as lacking learner-response psychometrics; and
- warning-labeled because distractor and Level 3 teaching claims are not fully evidence-mapped and residency-selection utility is unvalidated.

## Coverage and counts

- Authority-derived benchmark drafts: 24.
- Distinct authority benchmark concepts: 24 after current editorial concept separation.
- Transcript-derived candidates: 0.
- Four-choice MCQs across retained material: 24 benchmark drafts plus 845 secondary legacy rows; none are canonical transcript-derived MCQs.
- Proposed answer distribution in the 24-item benchmark: A/B/C/D = 6/6/6/6.
- Credentialed medical reviews: 0.
- Approved or release-eligible candidates: 0.

Specialty coverage is useful for exercising the schema, but it is not a validated content blueprint. Concept or topic proximity must be reviewed for local dependence even when candidate variant groups differ.

## Editorial structure and heuristics

The authoring layer records or checks:

- a focused question lead-in and four ordered, distinct choices;
- banned trick wording such as “all of the above,” “none of the above,” and negative `EXCEPT` constructs;
- proposed misconception categories and human-readable trap descriptions for distractors;
- why each distractor is tempting and why it is wrong;
- exact normalized cross-item answer/distractor reuse signals;
- an objective keyed-option length screen;
- bank-level answer counts plus repeated-period answer-sequence rejection; and
- a downstream form policy requiring order randomization, same-variant exclusion, topic-level local-dependence review, and removal of keys/IDs/concept metadata from learner projections.

These are editorial controls, not psychometric construction evidence. One-best-answer, homogeneity, fairness, difficulty, discrimination, distractor functioning, interview utility, and misconception diagnosis still require independent human and learner evidence.

## Explanation limits

All 24 drafts contain Level 1, Level 2 option-by-option, and Level 3 teaching containers. Structural presence does not establish superior instruction or evidence support. The keyed Level 2 explanation and Level 1 may repeat the same rationale, and Level 2/Level 3 medical assertions are not comprehensively mapped to immutable evidence snapshots.

No claim is made that the explanations exceed a commercial question bank, improve retention/transfer, or validly predict residency-interview performance.

## Review protocol

For each exact candidate hash, a credentialed physician and independent editorial reviewer must determine:

1. whether the proposed key is the unambiguously best answer under stated assumptions;
2. whether every distractor is safely wrong, plausible, homogeneous, and free of subset or surface cues;
3. whether every visible Level 1–3 medical assertion is supported by current retrieved evidence;
4. whether population, pregnancy, resistance, device, and protocol dependencies are explicit;
5. whether language, cultural, accessibility, and IMG fairness concerns remain;
6. whether the item should be revised, rejected, or advanced to cognitive interviewing; and
7. only after approval, whether a randomized, variant-separated controlled pilot supports difficulty, discrimination, distractor, timing, local-dependence, and fairness claims.

The answer-bearing Markdown and JSON are reviewer-facing internal artifacts. Their headings, IDs, answer keys, rationales, and concept metadata disclose answers and must never be used as a learner-facing projection.
