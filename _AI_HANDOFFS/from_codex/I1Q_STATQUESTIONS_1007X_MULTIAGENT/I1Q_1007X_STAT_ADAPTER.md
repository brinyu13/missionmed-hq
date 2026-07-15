# I1Q-1007X STAT Adapter

## Verdict

`LOCAL_CONTRACT_PASS, CONSUMER INTEGRATION OFF`

The versioned local STAT adapter now enforces the frozen nine-field server projection, composite identity, stable export IDs, exact release membership, fixed artifact classes, and closed-world Class A validation. It has not been installed in, connected to, or enabled for the protected STAT runtime.

## Implemented Boundary

| Contract | Result |
| --- | --- |
| `dataset_questions` fields | Exactly `dataset_version`, `question_id`, `prompt`, `choice_a`, `choice_b`, `choice_c`, `choice_d`, `answer`, `explanation` |
| Field order | Enforced |
| Projection identity | Composite `dataset_version + question_id` |
| Export question ID | Explicit stable value required; ordinal fallback prohibited |
| Duplicate identity | Rejected before artifacts are built |
| Release membership | Exact `item_id`, `item_revision_id`, `revision_number`, `content_hash`, `dataset_version`, `question_id` tuple |
| Historical identity | Dataset version, question ID, and content hash preserved |
| Server dataset | Class `server_only` |
| Pre-answer artifact | Class A, answer-free |
| Post-answer debrief | Class C |
| Question metadata | Class D, server-only, composite identity |
| Hash chain | Single manifest with previous-manifest link and artifact hashes |

## Answer Isolation

Class A validation is closed-world for pre-answer questions, indexes, and lookup data. It rejects unknown fields plus recursive answer, answer-map, correctness, explanation, solution, and rationale aliases. It also detects common serialized answer disclosures in string values.

The post-answer contract accepts only server state `finalized` and a true server-derived participant result. A caller-provided phase string is not authorization. Final platform wiring is owned by the security integration slice and remains a release gate.

The protected `answer_map` remains outside this adapter and must remain server-only and unavailable before finalization.

## Deterministic Verification

Direct adapter suite:

- 34 tests passed
- 0 failed
- all 14 durable transformation vectors passed
- exact nine-field key order passed
- fixed STAT pack SHA-256 remained `9253830103fdf96a341797f34f42fa98427be4089e4fa1483402141b6386575f`
- reordering input revisions produced byte-equivalent artifacts and the same manifest hash
- duplicate IDs and absent stable IDs failed closed
- exhaustive recursive answer aliases failed closed

## Legacy Compatibility

The static v4 import identity is `v4 + question_id`. No legacy row, attempt, sealed pack, or active dataset was changed. The adapter exposes a versioned historical-join identity and preserves source hashes, but no production attempt join was executed.

The current 3,961-item CDN runtime mirror is not the static 845-row v4 dataset and has zero identifier intersection with it. The two sources must remain separately versioned.

## Protected Runtime Gates

| Gate | Status |
| --- | --- |
| Adapter unit and adversarial tests | PASS |
| Platform release integration | IN PROGRESS |
| Stable ID persistence in datastore | NOT PROVEN |
| Server-authoritative finalization and participant lookup | NOT PROVEN end to end |
| RLS answer isolation | NOT RUN |
| Deployed answer-leak test | NOT RUN |
| Historical attempt join | NOT RUN |
| Protected STAT checksum parity | BLOCKED, tracked and deployed sources diverge |
| STAT owner certification | NOT OBTAINED |
| `stat_adapter_enabled` | OFF |

## Files

- `i1q-question-platform/src/adapters/stat-v1.mjs`
- `i1q-question-platform/src/adapters/class-a.mjs`
- `i1q-question-platform/src/contracts.mjs`
- `i1q-question-platform/src/exports.mjs`
- `i1q-question-platform/tests/adapters-security.test.mjs`

## Conclusion

The local transformation contract is ready for integrated application and datastore testing. It is not authorized for protected STAT activation.
