# Research Depth State Model

The state model is deterministic, mutually exclusive, and based on approved/current evidence, not raw claim volume.

| State | Count | Rule |
|---|---:|---|
| Deep Research | 0 | Highest approved major research pass and required high-value approved coverage are current. |
| Enriched Research | 0 | At least one approved meaningful enrichment pass beyond the registry profile is current. |
| Basic Profile | 6,138 | Approved core registry profile exists; no approved meaningful enrichment pass is current. |
| Research Pending | 1 | Canonical program exists and an explicit research job/review state is pending without approved enrichment. |
| Total | 6,139 | Exactly one state per program. |

Pending Parallel/Opus/Sonnet claims do not inflate research depth. When review promotes approved facts, the backend computes the next state automatically and filter counts update without a frontend program list.
