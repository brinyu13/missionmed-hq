# 1008E Inflation Diagnosis

I1Q-1008E correctly produced a broad, nonpromoting occurrence inventory; it did not produce a Drill Question Gold Set. Its 117,893 rows are therefore an intentionally wide secondary-evidence denominator, not a question count.

## Quantified inflation sources

The safe 1008E inventory reports:

- 59,576 `NONMEDICAL` extraction-class rows, of which 59,574 were rejected as nonmedical.
- 14,190 teaching occurrences: 2,590 teaching pivots and 11,600 testable teaching statements.
- 11,799 rows in the implicit-question class group, including 11,091 incomplete-question fragments.
- 32,299 rows in the expanded explicit-prompt class group, including 27,918 in the exact explicit-question class.
- 29 ambiguous-medical occurrences.
- 39,830 multi-speaker-unresolved rows.
- 48,936 quarantined occurrences, including 16,825 speaker-quarantined and 32,109 medical-quarantined rows.
- 969 exact-text and 96 near-text duplicate relationships, plus 1,781 same-topic/different-concept relationships. These are graph edges and are not destructive deduplication decisions or transcript/Nodes duplicate rows.

The five extraction-class groups form an exact mutually exclusive partition: 32,299 expanded explicit prompts + 11,799 implicit prompts + 14,190 teaching occurrences + 59,576 nonmedical occurrences + 29 ambiguous-medical occurrences = 117,893. Nested and cross-dimensional metrics must not be added to that partition. For example, the exact explicit-question class is contained inside the expanded explicit group, and the 12,021 implicit-or-reconstructed union overlaps its 11,799 implicit members. Lifecycle and quarantine counts are an independent dimension. In particular, 1008E normalized 117,893 restricted candidates and created 57,688 provisional concepts, but approved and released zero items. All 57,688 concepts remained quarantined or review-required.

## Root cause

1008E operated on medical mentions, prompts, fragments, statements, and both transcript and Nodes evidence. It intentionally favored recall for downstream analysis. It did not enforce the student-call state machine, did not require that Dr. J actually asked each retained item, did not reconstruct primary/follow-up roles, and did not make drill-local ordered sequence the identity anchor.

The dominant numeric expansion is clause splitting, not nine-pass multiplication: 81,604 transcript segments produced 117,893 unique clause-level occurrences; 24,961 segments emitted more than one occurrence and the maximum was 11 clauses from one segment. PASS 9 groups proposals by evidence anchor before occurrence creation. Nodes assistance also mostly corroborates rather than duplicates transcript clauses: 25,164 occurrences had PASS 6 assistance, 25,150 corroborated an existing transcript clause anchor, and only 14 were PASS 6/PASS 7-only anchors.

## Recovery disposition

1008E remains useful as secondary evidence for candidate recall, teaching enrichment, loss analysis, and transcript/Nodes reconciliation. It is not discarded or regenerated. I1Q-1008F reads the validated 97 transcript/Nodes pairs directly and uses 1008E aggregates only for comparison.

Final categories are computed after the Gold Set is frozen:

- **Canonical drill questions:** retained, transcript-grounded Dr. J prompts in ordered student-call sequences.
- **Secondary teaching occurrences:** teaching pivots and testable teaching statements; never promoted as questions.
- **Nonquestion content:** nonmedical, administrative, learner, attendance, greeting, banter, and other excluded material.
- **Ambiguous content:** retained only when an actual medical prompt is supported but its wording or boundary cannot be resolved; otherwise excluded with provenance.

The prior question-candidate projection is the disjoint union of 32,299 expanded-explicit and 11,799 implicit-class rows: 44,098 candidates. The implemented post-freeze comparison binds each predecessor occurrence to its validated source pair and transcript record, then applies record-local NFKC/case/punctuation-normalized containment against Gold question components. This comparison method matched 17,623 candidates and left 26,475 unmatched. It is a conservative recovery metric, not a one-to-one clause-identity or clinical falsehood claim. No text-global deduplication is allowed, and Nodes-only evidence can never promote an item without transcript support.

Accordingly, the reported 1008E false-positive metric is `44,098 prior question candidates minus 17,623 candidates matched to any frozen Gold question component = 26,475`. “False positive” here means rejected from this Gold projection, not medically false. Deliberately inventoried nonmedical and teaching rows are outside that candidate denominator. The actual Dr. J question metric counts 16,690 frozen Gold question IDs, not matched occurrence rows, because one question may bind multiple clauses. Exact learner-speech counts also require the exclusion/provenance join; the 39,830 multi-speaker-unresolved rows cannot be treated as learner speech by aggregate subtraction.
