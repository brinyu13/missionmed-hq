# 05 — Medical Content Classification

## Status and authority boundary

This report describes the accessible observed corpus processed by I1Q-1008E. Its claim class is `C1_OBSERVED`: 105 observed sources include 97 transcript-available sources and 99 Nodes-available sources, with 2 Nodes-only records reconciled and 6 sources unresolved because neither validated artifact was available. The 8 records outside the transcript consumer projection keep historical-universe completeness open. Nothing here claims discovery of every historical source.

The transcript corpus is the primary content authority for extraction and provisional concept formation. Nodes provide secondary recovery and reconciliation support. The 845-row legacy inventory is also secondary: its comparison remains preliminary, non-promoting, and unresolved rather than a substitute for transcript evidence.

## Observed classification results

The 97 processed transcript artifacts produced 117,893 occurrence records. Of those, 58,317 are classified as medically relevant or requiring medical review. The remaining 59,576 carry the `NONMEDICAL` extraction class. Extraction class and lifecycle are different dimensions: the lifecycle ledger records 59,574 `REJECTED_NONMEDICAL` rows, while quarantine precedence governs the remainder.

The medical and assessment inventory remains intentionally broad:

| Extraction class | Occurrences |
|---|---:|
| Exact explicit question | 27,918 |
| Incomplete question | 11,091 |
| Testable teaching statement | 11,600 |
| Teaching pivot | 2,590 |
| Management prompt | 2,809 |
| Interpretation prompt | 696 |
| Implied question | 689 |
| Diagnosis prompt | 271 |
| Mechanism prompt | 215 |
| Differential prompt | 141 |
| Next-best-step prompt | 94 |
| Recall prompt | 84 |
| Clinical-reasoning prompt | 71 |
| Ambiguous medical occurrence | 29 |
| Rapid-fire prompt | 19 |
| Nonmedical | 59,576 |

The broader named explicit-prompt group contains 32,299 occurrences. The implicit-question class group contains 11,799, while the set union of that group with reconstructed forms contains 12,021. Teaching pivots and testable teaching statements together account for 14,190 occurrences. These groups overlap by their documented definitions and must not be added together as independent totals.

## Review and quarantine posture

All 117,893 occurrences remain `REVIEW_REQUIRED` for medical review and assessment suitability. The current lifecycle histogram includes:

- 32,109 medically quarantined occurrences;
- 16,825 speaker-quarantined occurrences;
- 2 privacy-quarantined occurrences;
- 9,383 additional review-required occurrences; and
- 59,574 rejected-nonmedical occurrences.

Rights review is required for every occurrence, and release is prohibited for every occurrence. Approved, released, and final four-choice MCQ counts are all zero. No classification in this report is physician approval, final governance approval, release eligibility, or a final question-writing decision.

The independent assessment-science review covered all 97 packets and found no false physician or final-governance approval claims. Its corrected-contract rebind root is `0de9a94243878c8cd0389d422e8d6dd59b90a9543f1278ef462f27b8301562c1`. Its `VERIFIED_WITH_FINDINGS` disposition means the bounded review was performed and risks were preserved; it does not approve medical content or release. The finalizer integrated the complete four-role denominator of 194 specialist cells and 388 role reviews.

## Legacy comparison limitation

The preliminary legacy comparison reports 845 legacy rows, zero promoted legacy rows, and 58,533 unresolved comparisons. The recorded `likely_overlap_count` of zero is not proof of no semantic overlap because the comparison is explicitly preliminary and unresolved. Transcript-derived evidence remains primary; legacy rows remain secondary context for I1Q-1008F adjudication.

## Evidence

- `../evidence/extraction-run-manifest.json`
- `../evidence/processing-roster-safe.json`
- `../evidence/candidate-inventory-safe-summary.json`
- `../evidence/quarantine-summary.json`
- `../evidence/coverage-receipt.json`
- `../evidence/legacy-comparison-safe-summary.json`
- `../evidence/provenance-invariant-results.json`
