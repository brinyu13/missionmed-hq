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
| `ivoc/contracts/question-library.mjs` | `ivprep-v6/public/questions/mission-residency-corpus.mjs` at `c3d6c9c`; Astra candidate.2 `packs.json` SHA-256 `a3194e51153da1bcceb599ecf401d42d610578fc5ecef20ff404780488403551` | Binds all 193 canonical question ids to 20 versioned prototype-derived packs while preserving the explicit non-historical membership limit. |
| `ivoc/contracts/presentation-boundary.mjs` | Fable D9 and section 21.1 | Enforceable import rule keeps UI components behind view-model adapters and away from capability implementations. |
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
| `ivoc/fixtures/question-packs.v1.json` | Exact Astra candidate.2 `dist/client/packs.json`, SHA-256 `a3194e51153da1bcceb599ecf401d42d610578fc5ecef20ff404780488403551` | Direct data port of the 20 prototype-derived pack definitions; membership remains explicitly non-historical and every id is checked against the canonical 193-question corpus. |
| `ivoc/contracts/foundation.test.mjs` | Fable Packet 1/2 acceptance | Proves 193/20 canonical-id binding, provenance limits and the presentation capability-import boundary. |
| `ivoc/contracts/v1.test.mjs` | Fable Packet 2 contract acceptance | Loads every required v1 fixture and proves fail-closed ownership, time and evidence validation. |
| `ivoc/core/canonical-clock.test.mjs` | Fable D6 and section 6.4 | Deterministic pause-hole and 120 ms drift-gate proof. |
| `ivoc/core/event-spine.test.mjs` | Fable section 6.3 | Append, replay, ordering and conflicting-replay proof. |
| `ivoc/core/session-store.test.mjs` | Fable sections 5.3 and 5.4 | State-version, transition and command-replay proof. |
| `ivoc/core/f1-acceptance.test.mjs` | DR-282 F1 acceptance | End-to-end synthetic Prompted Mock through canonical completion. |
| `ivoc/orchestrator/core/orchestrator.test.mjs` | Fable sections 9.2 through 9.4 | One clock, no provider/audio authority and attempt-all teardown proof. |
| `ivoc/brain/prompted/director.test.mjs` | Fable D11 | Deterministic Next/spacebar ask sequence and close behavior. |
| `ivoc/README_LANES.md` | DR-282 and Fable section 27 | Lane ownership and held-scope declaration. |

## Wave 1 source map

Wave 1 source commit: `f9a593be39f6eb5b3a2e7678994e2d76e55706f3`.
No donor code was copied directly. The implementation is original code against
the accepted Fable contracts, with the existing files below used only as
read-only behavioral evidence.

| Target path | Evidence source | Use / reason |
|---|---|---|
| `ivoc/analytics/descriptors.mjs` | Fable sections 7.1-7.2; `ivprep-v6/public/analytics/metric-contract.mjs` at `c3d6c9c` | Defines the 18-signal M1 registry, reliability tiers, visible limitations and complete forbidden-inference set. |
| `ivoc/analytics/registry.mjs` | Fable sections 6-7; `ivprep-v6/public/analytics/signal-registry.mjs` at `c3d6c9c` | Original versioned registry/supervisor emitting measured timeline envelopes and explicit availability. |
| `ivoc/analytics/runtime/audio-analyzer.mjs` | Fable M1 voice signal table; `ivprep-v6/public/analytics/{audio-signal,pitch-f0,syllable-rate}.mjs` at `c3d6c9c` | Original browser-local PCM analysis for real dBFS, F0, pause state and bounded acoustic pace; PCM remains transient. |
| `ivoc/analytics/runtime/browser-runtime.mjs` | Fable sections 7.3-7.5; existing 3521 admitted-stream design | Uses one real admitted `MediaStream`; audio is measured and missing vision adapters are explicitly degraded rather than fabricated. |
| `ivoc/analytics/cues/arbiter.mjs` | Fable section 7.4; deployed 6002 `NO_CUE` law | Original dwell, show, refractory, per-answer and fault-bypass selector that owns ids, never coaching copy. |
| `ivoc/analytics/{registry,runtime/audio-analyzer,cues/arbiter}.test.mjs` | DR-288 Wave 1 acceptance | Deterministic signal truth, real PCM, forbidden-claim, cue timing and fail-closed tests. |
| `ivoc/media/chunk-manifest.mjs` | Fable sections 14.1 and 6.3 | Original byte-hashed, ordered chunk manifest and immutable seal contract. |
| `ivoc/media/recorder.mjs` | Fable section 14.1; `ivprep-v6/public/ivoc-standalone/app/recording.mjs` at `c3d6c9c` | Original `MediaRecorder` controller over the same admitted stream with chunk/seal events and no public storage behavior. |
| `ivoc/media/media.test.mjs` | DR-288 Wave 1 acceptance | Proves real-byte hashing, admitted-stream identity, event sequence and immutable seal. |
| `ivoc/transcript/canonical.mjs` | Fable section 15.1 | Original strict word-timed canonical transcript validator and speaker filter. |
| `ivoc/transcript/segmenter.mjs` | Fable section 15.2; F1 `question.*`/`turn.*` events | Sole deterministic M1 segmentation owner; refuses missing boundaries rather than guessing. |
| `ivoc/transcript/segmenter.test.mjs` | DR-288 Wave 1 acceptance | Proves media-clock Q/A segmentation and fail-closed incomplete-boundary behavior. |
| `ivoc/projectors/results.mjs` | Fable sections 5.2 and 16; F1 result contract | Original evidence-ref result projection with unavailable-signal limitations. |
| `ivoc/projectors/flight-recorder.mjs` | Fable section 14.3 | Original one-cursor projection across media, transcript, question, turn, cue and signal lanes with explicit gaps. |
| `ivoc/projectors/library.mjs` | Fable section 14.4 | Original subject-scoped, list-first search/sort projection. |
| `ivoc/projectors/projectors.test.mjs` | DR-288 Wave 1 acceptance | Proves measured-only Results, synchronized seek/gaps and subject isolation. |
| `ivoc/ui/adapters/m1-view-model.mjs` | Fable D9 and sections 21.1-21.2 | Only presentation adapter importing Wave 1 capabilities; exposes plain view state and intents. |
| `ivoc/ui/runtime.mjs` | Astra candidate.2 presentation separation; Fable section 21 | Thin component wiring through the view-model adapter only. |
| `ivoc/ui/index.html` | Astra candidate.2 visual canon; Fable D11 | Original M1 Prompted Mock cockpit shell with explicit no-provider and truth-boundary copy. |
| `ivoc/ui/runtime.css` | Astra candidate.2 visual canon | Original responsive, reduced-motion-aware presentation styling; no capability logic. |
| `ivoc/ui/ui.test.mjs` | F1 presentation-boundary contract | Proves the UI import boundary and required missing-signal/forbidden-inference copy. |

Later lanes may adapt exact donor files only after updating this map with the
immutable object, exact source path, target path, contract satisfied and
reason for selection. A direct port must also carry a `// donor:` header.
