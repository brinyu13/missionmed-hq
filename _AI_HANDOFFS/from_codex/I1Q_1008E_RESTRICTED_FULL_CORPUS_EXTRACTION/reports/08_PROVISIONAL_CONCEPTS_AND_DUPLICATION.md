# 08 — Provisional Concepts and Duplication

## Outcome

I1Q-1008E formed 57,688 provisional concepts from 58,317 medically relevant or review-required occurrence memberships. These are non-canonical working concepts for later adjudication. The final canonical concept count is zero, destructive deduplication was not performed, and duplicate-relationship final adjudication was not performed.

The corpus boundary is `C1_OBSERVED`, not a historical-universe claim. Transcript-derived concepts are primary. Nodes support recovery and reconciliation, while the legacy inventory is secondary and non-promoting.

## Concept inventory

| Metric | Count |
|---|---:|
| Provisional concepts | 57,688 |
| Occurrence memberships | 58,317 |
| Multi-occurrence concepts | 417 |
| Provisional duplicate clusters | 417 |
| Quarantined concepts | 48,934 |
| Review-required concepts | 8,754 |
| Final canonical concepts | 0 |

The independent assessment-science review recomputed membership coverage across all 97 packets: every one of the 58,317 medically relevant or review-required occurrences belongs to exactly one provisional concept; zero were missing and zero belonged to multiple concepts. This verifies membership integrity, not concept correctness or canonicality. The corrected-contract review batch root is `0de9a94243878c8cd0389d422e8d6dd59b90a9543f1278ef462f27b8301562c1`, and the finalizer integrated the complete 194-cell/388-role denominator.

All 57,688 concepts remain candidates for I1Q-1008F only under the explicit qualification that the set includes quarantined items and requires adjudication. No concept is an approved medical fact, release-ready item, or final MCQ.

## Duplicate relationship inventory

The provisional comparison graph contains 178,341 relationship records:

| Relationship type | Count |
|---|---:|
| `NOT_DUPLICATE` | 175,495 |
| `SAME_TOPIC_DIFFERENT_CONCEPT` | 1,781 |
| `EXACT_TEXT_DUPLICATE` | 969 |
| `NEAR_TEXT_DUPLICATE` | 96 |
| `POSSIBLE_DUPLICATE` | 0 |
| `REPEATED_TEACHING_OCCURRENCE` | 0 |
| `SAME_CONCEPT_DIFFERENT_FORM` | 0 |
| `SAME_CONCEPT_SAME_TARGET` | 0 |

Relationship counts are graph edges, not distinct concepts or merge decisions. They must not be used to subtract from the concept count, infer a final deduplicated count, or authorize destructive merging. The 417 multi-occurrence concepts and 417 provisional clusters are review queues, not adjudicated canonical groups.

## Legacy comparison

The secondary legacy comparison contains 845 rows and is qualified as preliminary and non-promoting for I1Q-1008F. It records:

- 57,688 transcript concepts not established as legacy overlaps;
- 845 legacy rows without established transcript support;
- 58,533 unresolved comparisons;
- 0 legacy promotions; and
- 0 destructive merges.

The zero likely-overlap count is not proof of no semantic overlap. The unresolved count and preliminary qualification prevent that interpretation. Transcript evidence remains primary, and legacy evidence may inform later review only after explicit adjudication.

## Governance and next gate

All occurrence-level assessment and medical reviews remain required, and all release states remain prohibited. Rights, privacy, speaker authority, medical ambiguity, assessment form, and duplicate relationships must be adjudicated before any concept can become canonical or support a final item revision. I1Q-1008F may consume the provisional inventory, but it must preserve quarantine, provenance, and non-destructive lineage.

## Evidence

- `../evidence/provisional-concept-summary.json`
- `../evidence/candidate-inventory-safe-summary.json`
- `../evidence/legacy-comparison-safe-summary.json`
- `../evidence/processing-roster-safe.json`
- `../evidence/extraction-run-manifest.json`
- `../evidence/quarantine-summary.json`
- `../evidence/provenance-invariant-results.json`
- corrected-contract `ASSESSMENT_SCIENCE` batch root: `0de9a94243878c8cd0389d422e8d6dd59b90a9543f1278ef462f27b8301562c1`
