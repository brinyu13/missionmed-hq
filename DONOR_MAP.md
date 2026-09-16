# IVOC-CONVERGE-8001 F1 donor map

Base: `c3d6c9cd12d4838fed6bb699fe9d574956ab15e7`

No whole donor branch was merged, rebased, or selected. F1 code is an original
contract-led reference implementation. Existing runtime files remain
unchanged; the sources below inform contracts and later adaptation only.

| Target path | Evidence source | Use / reason |
|---|---|---|
| `ivoc/contracts/session.mjs` | Fable architecture sections 5.1, 5.3, 5.4; deployed `missionmed-hq/ivoc/repository.mjs` at `c3d6c9c` | Canonical session shape, durable states and optimistic version contract; no code copied. |
| `ivoc/contracts/timeline.mjs` | Fable section 6; `ivprep-v6/public/analytics/event-contract.mjs` at `c3d6c9c` | Versioned event envelope and media ordering; no code copied. |
| `ivoc/contracts/question-pool.mjs` | Fable sections 5.2, 8 and 9; existing question corpus at `c3d6c9c` | Immutable pool snapshot boundary; corpus data is not copied into F1 fixtures. |
| `ivoc/contracts/results.mjs` | Fable section 5.2; `ivprep-v6/public/ivoc-standalone/app/post-model.mjs` at `a74e9a6` | Result/evidence boundary for later projectors; no code copied. |
| `ivoc/contracts/conversation-turn.mjs` | Fable sections 5.2 and 6.2 | Canonical speaker, timing, question, relationship and interruption record; original contract validation. |
| `ivoc/contracts/answer-segment.mjs` | Fable section 15.2 | Deterministic M1 segmentation boundary fixed before L-M implementation; original contract validation. |
| `ivoc/contracts/projection-envelope.mjs` | Fable section 12.1 | Minimized, owner-shaped Matrix projection envelope with authorization and revocation truth; original contract validation. |
| `ivoc/contracts/index.mjs` | F1 module contract | Stable export surface; original glue. |
| `ivoc/core/event-spine.mjs` | Fable sections 6.3 and 6.4 | Append-only, per-session sequence and replay-safe reference behavior; original code. |
| `ivoc/core/session-store.mjs` | Fable sections 5.3 and 5.4 | Optimistic transitions and command idempotency; original code. |
| `ivoc/core/canonical-clock.mjs` | Fable D6 and section 6.4; `ivprep-v6/public/analytics/session-clock.mjs` at `c3d6c9c` | Capture-owner clock, pause holes and 120 ms seal gate; no code copied. |
| `ivoc/core/index.mjs` | F1 module contract | Stable reference-service export surface. |
| `ivoc/orchestrator/core/orchestrator.mjs` | Fable section 9 | Prompted Mock state/turn owner with `audio_authority=none`; original code. |
| `ivoc/orchestrator/core/teardown.mjs` | Fable section 9.4 | Ordered, idempotent, attempt-all teardown; original code. |
| `ivoc/brain/prompted/director.mjs` | Fable D11 and sections 8, 9 | Deterministic ask/close moves from one immutable pool; original code. |
| `ivoc/fixtures/session.v1.json` | Synthetic F1 session fixture | Non-deliverable actor/subject identity; no production or student data. |
| `ivoc/fixtures/question-pool.v1.json` | Synthetic F1 pool fixture | Two deterministic non-student questions for contract proof only. |
| `ivoc/fixtures/prompted-mock.v1.json` | Synthetic F1 journey fixture | Next/spacebar, zero-provider and `audio_authority=none` expectations. |
| `ivoc/fixtures/{conversation-turn,answer-segment,coaching-evidence,result-set,projection-envelope}.v1.json` | Synthetic F1 contract fixtures | Required v1 child-record and projection shapes without production, student or provider data. |
| `ivoc/contracts/v1.test.mjs` | Fable Packet 2 contract acceptance | Loads every required v1 fixture and proves fail-closed ownership, time and evidence validation. |
| `ivoc/core/canonical-clock.test.mjs` | Fable D6 and section 6.4 | Deterministic pause-hole and 120 ms drift-gate proof. |
| `ivoc/core/event-spine.test.mjs` | Fable section 6.3 | Append, replay, ordering and conflicting-replay proof. |
| `ivoc/core/session-store.test.mjs` | Fable sections 5.3 and 5.4 | State-version, transition and command-replay proof. |
| `ivoc/core/f1-acceptance.test.mjs` | DR-282 F1 acceptance | End-to-end synthetic Prompted Mock through canonical completion. |
| `ivoc/orchestrator/core/orchestrator.test.mjs` | Fable sections 9.2 through 9.4 | One clock, no provider/audio authority and attempt-all teardown proof. |
| `ivoc/brain/prompted/director.test.mjs` | Fable D11 | Deterministic Next/spacebar ask sequence and close behavior. |
| `ivoc/README_LANES.md` | DR-282 and Fable section 27 | Lane ownership and held-scope declaration. |

Later lanes may adapt exact donor files only after updating this map with the
immutable object, exact source path, target path, contract satisfied and
reason for selection. A direct port must also carry a `// donor:` header.
