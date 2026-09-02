# IVOC-CTX-6002 Live Context Build and Deploy Handoff

Date: 2026-09-02
Lane: IV Prep On-Call Master Product / Context Intelligence
Status: COMPLETE — live gated candidate and hosted provider path accepted

## Executive result

The production-shaped Context Intelligence V1 candidate is deployed at:

https://missionmed-hq-production.up.railway.app/iv-prep-analytics/#/context-lab

Railway deployment c322eee1-4ca2-456c-a9f4-09f6705eb16b is SUCCESS and both health endpoints return 200. Anonymous UI and API requests return 401. An authenticated, currently entitled IV Prep 360 student reached the real CORE-01 question, granted the real camera and microphone path, recorded a bounded real hardware-path test answer, sealed the private recording, saved Analytics, received a real OpenAI transcript, received evidence-cited Context analysis, and received exactly one allowed coaching cue.

This is not a local prototype. The source, provider adapters, routes, access gate, and UI are the deployed runtime. An earlier deliberately overlong browser-control artifact also proved the fail-closed path: it returned transcript UNAVAILABLE and NO_CUE rather than presenting a fake transcript.

## Authority and custody

- Accepted IV Prep source base: a74e9a6fe62cf44fba505e0b5a8af361cd7e6cbd.
- Worktree: /Users/brianb/MissionMed_worktrees/ivoc-context-6002
- Branch: codex/ivoc-context-6002-live-context
- Deployed source commit: c3d6c9cd12d4838fed6bb699fe9d574956ab15e7
- Source commits: 4500238, 5a5f48c, c3d6c9c.
- c3d6c9c merges the already-live Scheduler repair a41007c without rewriting or discarding either lane.
- Canonical MissionMed OS authority commit: b3cb3fdecb9a01109feebe0a1780e6bf8a757af4.
- Decisions: DR-168 and DR-169.
- Founder authorization used: IV Prep answer audio may be sent securely to OpenAI.
- Lease V2: exact PRODUCT and PATH leases were acquired, renewed during the long upload, and released after each mutation tranche.
- No Analytics-lane worktree was mutated.
- No database migration or DDL was applied.

The accepted IV Prep lineage remains separate from canonical main. This ticket does not silently merge or reconcile that historical divergence.

## Runtime delivered

### Question

- Real server-side 193-question corpus.
- Candidate question: CORE-01, revision 1, founder_core.
- Rendered text: Tell me about yourself.

### Transcription

- Server-only provider interface.
- Default provider/model: OpenAI audio transcription, whisper-1.
- Configurable with IVOC_TRANSCRIPTION_MODEL.
- Secret resolves only on the server from MMHQ_OPENAI_API_KEY or OPENAI_API_KEY.
- Browser code receives neither credential nor provider request.
- Mock-prefixed transcript text is rejected.
- Timeout, provider failure, oversized media, and invalid response fail closed to UNAVAILABLE.
- Transcript and segments are request-memory only in 6002.

### Context Intelligence

- Server-only OpenAI Responses adapter.
- Default model: gpt-5.6-terra, configurable with IVOC_CONTEXT_MODEL.
- Strict JSON schema and exact transcript-segment evidence references.
- store is false.
- Transcript is explicitly untrusted data.
- Unsupported emotion, affect, hidden traits, diagnoses, and semantic-gesture claims are rejected.
- Context interpretation is separate from immutable Analytics events.

### Analytics boundary

Master consumes only the frozen student-safe event projection:

- answer_duration_ms
- captured_level_dbfs
- digital_clipping_fraction

Pace is derived above Analytics from transcript word count divided by answer duration and labeled MASTER_DERIVED. Master does not write back into Analytics and does not consume projector internals. Analytics detector, timing, gesture, event-contract, registry, and session files were not edited.

### Behavior registry and one-cue arbiter

- Registry version: 2026-09-02.1.
- Declarative configuration only; no executable detector code.
- Live cue allowlist: SLOW_DOWN, PICK_UP_PACE, SPEAK_UP, EASE_VOLUME, NO_CUE.
- One dominant command only.
- Evidence references preserve Analytics event IDs, transcript segment IDs, Context analysis ID, registry version, score, coverage, timestamps, TTL, refractory period, and provenance.
- Gesture meaning and dramatic pause remain UNMEASURABLE_CURRENTLY in this tranche.

### Persistence

Existing private recording and Analytics-result persistence remain unchanged. The following are not persisted in 6002:

- transcript text or segments
- model prompt/input
- Context analysis
- behavior assignment
- CoachCommand

## Verification evidence

### Automated

- Context contract: 6 of 6 pass.
- Context provider and route: 8 of 8 pass.
- Existing IVOC routes: 11 of 11 pass.
- Combined HQ IVOC tests: 19 of 19 pass.
- Full 3528C focused suite: 48 of 48 pass.
- Scheduler cancellation regression after merge: 2 of 2 pass.
- Full missionmed-hq regression: 1,083 pass, 0 fail, 15 skip, plus private-mount validator 1 of 1 pass.
- Syntax checks and git diff --check pass.
- Local provider preflight used synthesized spoken audio and the production provider code: whisper-1 returned 16 words; gpt-5.6-terra returned 3 evidence-bound observations; cue PICK_UP_PACE; persistence false.
- The ivprep-v6 umbrella runner has a pre-existing hang in test/3440/logout-revocation.test.mjs. At interruption it had 17 pass, 0 fail, 88 canceled. The ticket-owned 3528C suite is green.

### Hosted

- Deployment: c322eee1-4ca2-456c-a9f4-09f6705eb16b, SUCCESS.
- /health: 200.
- /health/lor-studio: 200.
- Anonymous GET /iv-prep-analytics/: 401 ivprep_authentication_required.
- Anonymous GET and POST /api/ivoc/v1/context: 401 ivprep_authentication_required.
- Authenticated 360 identity: Ignacio Anzola De Goiricelaya, STUDENT, ENTITLED IV PREP 360.
- Candidate prepare state: CORE-01 revision 1, transcript SERVER_CONFIGURED.
- Camera/microphone: real devices opened; real live video was visible.
- Recording and Analytics: live; recording ba01270b-cbc7-4ee8-a231-4e914be52d4c sealed and saved; Analytics result saved.
- First hosted test artifact: 464,428 ms and 60,594,376 bytes because browser-control delays left capture active. It exceeded the intentional 25 MB OpenAI boundary, producing 409 context_recording_unavailable.
- Fail-closed UI response: transcript UNAVAILABLE, Context unavailable, one command NO_CUE, registry 2026-09-02.1. No fake result was shown.
- Successful bounded recording: bee93404-7d8c-47ea-924e-ae39239ddb00, session d4b6da3d-ef5c-4626-a63e-4a3ef64ac446, saved, 6,604,437 bytes, 22,249 ms media duration.
- Successful answer envelope: 27,242 ms; answer_duration_ms, captured_level_dbfs, and digital_clipping_fraction each high reliability and 100 percent coverage.
- Hosted provider result: transcript REAL; OpenAI whisper-1 transcription; OpenAI gpt-5.6-terra Context with eight cited segments; explicit limitations because captured ambient speech did not answer the question.
- MASTER_DERIVED pace: 79.3 WPM.
- One command: PICK_UP_PACE, registry 2026-09-02.1.
- Railway request evidence: recording seal 200, Analytics results save 200, Context analyze 200 in 12,446 ms.

The successful hosted rerun proves the real primary provider path. The overlong run independently proves the truthful fail-closed path.

## Feature flags and rollback

Production flags:

- IVOC_CONTEXT_CANDIDATE_ENABLED=true
- IVOC_CONTEXT_TRANSCRIPT_ENABLED=true

The OpenAI credential is present only as a Railway service variable and was set through standard input without printing its value.

Rollback preimage:

- Deployment c0dba19f-a0a0-4c45-bd06-86a211e66574.
- Source commit a41007cdd7be3857138415b3e6fc44b68ffca4ec.
- It contains the live Scheduler cancellation repair.

Rollback procedure: set both IVOC flags false, redeploy the preserved a41007c preimage, and verify health and Scheduler cancellation behavior. No database or object deletion is required.

## Collisions and open risks

1. Shared-service deployment collisions remain possible if another task deploys missionmed-hq. Fresh deployment readback and leases are required before any later release.
2. Admin access is proven by the inherited gate and automated tests; this physical run used an entitled 360 student identity.
3. Authenticated non-entitled physical denial was not witnessed because no separate non-entitled account was used. Automated gate tests cover it.
4. The current Context Lab UI is intentionally functional, not a Fable-quality final experience.
5. The ivprep-v6 umbrella runner hang is pre-existing and should be repaired separately.
6. The successful microphone capture contained ambient speech rather than the intended synthesized test phrase. Context handled the mismatch truthfully; Founder testing should use a deliberate answer in a quiet setting.

## Required next action

Founder tests the live candidate, then route the Fable 5 AAA ideation/architecture/design prompt using IVOC-CTX-6002_FABLE_AAA_INPUT.md.
