# Domain Completion Model

| State | Meaning | Counts as attempted | Deep-compatible |
|---|---|---:|---:|
| VERIFIED | Current evidence supports the domain | Yes | Yes |
| PARTIALLY_VERIFIED | Useful evidence exists but material residue remains | Yes | Weighted/threshold dependent |
| RESEARCHED_NOT_FOUND | Meaningful search found no supportable published answer | Yes | Yes |
| EVIDENCE_FOUND_REVIEW_PENDING | Evidence exists but cannot yet be promoted | Yes | No while critical |
| CONFLICT | Credible sources disagree | Yes | No for identity-critical ambiguity |
| UNAVAILABLE | Source is technically/publicly unavailable after a meaningful attempt | Yes | Yes |
| NOT_APPLICABLE | Domain does not apply | Yes | Yes |
| NOT_RESEARCHED | No meaningful attempt | No | No |

Weighted completion includes resolved researched-not-found outcomes and does not reward unsupported facts. Holdout B scored `0.9295`, but the identity/structure conflict and five partially verified domains kept the dossier `PARTIAL`.
