# Taxonomy and Explanation Report

## Draft taxonomy, accurately scoped

`i1q.taxonomy.v2` is a content-addressed internal draft with 18 registered primary specialties. It deliberately models a **primary-specialty registry**, not a validated hierarchy or full medical ontology.

The taxonomy declares ten required dimensions:

1. primary specialty;
2. organ system;
3. topic;
4. subtopic;
5. primary concept ID;
6. clinical task;
7. reasoning pattern;
8. difficulty tier;
9. interview competency; and
10. question mode.

Candidate records also carry cognitive level, learner stage, risk tier, AI confidence limits, difficulty-evidence status, interview-competency evidence status, misconception-inference status, and IMG-fairness review status.

For the current benchmark, “registry-backed” is structurally accurate: specialty, organ system, clinical task, reasoning pattern, difficulty, interview competency, and question mode have controlled lists, while 24 exact cross-field profiles bind specialty, organ system, topic, subtopic, and primary concept ID together. Unregistered cross-field combinations fail validation.

That is still a draft benchmark registry, not evidence of medical ontology completeness or tagging reliability. The 24 profiles were built around the 24 authority drafts, have not been medically ratified, have no operational tagging manual or inter-rater agreement study, and must be versioned/extended when canonical transcript extraction introduces new concepts.

Difficulty is deliberately `editorial_uncalibrated`. Interview competency is an intended content target, not a construct measured by an SBA response.

## Misconception vocabulary

`i1q.misconceptions.v2` defines 11 reusable editorial categories with stable category-level IDs and definitions:

- diagnostic-sequence error;
- epidemiology substitution;
- finding/disease mismatch;
- mechanism confusion;
- management-escalation error;
- management-indication error;
- near-neighbor diagnosis;
- screening/diagnostic confusion;
- severity-threshold error;
- temporal-pattern error; and
- treatment/diagnosis confusion.

Each wrong choice carries the stable `misconception.<category>` ID plus a human-readable trap description. These are author hypotheses for review, not empirically observed learner misconceptions. A selected distractor must not be interpreted as proof of a misconception until response-process evidence supports that inference.

## Explanation architecture

### Level 1 — concise proposed rationale

A brief explanation states the proposed key and decisive reasoning. It is not evidence of interview performance or medical approval.

### Level 2 — option-by-option reasoning

All four choices have explanations. Wrong-choice explanations record why the option is tempting and why it fails. The keyed explanation may duplicate Level 1, so the containers are structurally complete but not proven to provide progressively deeper instruction.

### Level 3 — teaching layer

Each draft includes clinical pearls, board relevance, educational oral-reasoning relevance, common traps, and a memory aid. These claims remain AI-authored, not fully evidence-mapped, and not credentialed-physician reviewed.

## Canonical transcript gap

This taxonomy was exercised on 24 authority-derived benchmark drafts, not on the complete Dr. J corpus. It therefore cannot be called the definitive Dr. J teaching taxonomy. Transcript-first extraction may introduce new specialties, systems, question forms, concepts, teaching pivots, and cross-domain relationships; those must be added through a versioned, medically reviewed extension rather than forced into the benchmark vocabulary.

## Future adaptive use

The fields may eventually support search, filtering, misconception remediation, spaced repetition, form assembly, and explanation-depth selection. Those are architecture possibilities only. No adaptive algorithm, learning-effect evidence, inter-rater taxonomy reliability, or learner-response psychometrics exists in this run.
