# Y1-Y2-CAM-V6-3420R complete combined handoff

## Final status

**FOUNDER MULTIMODAL ANALYTICS TEST READY --- HARDENING REMAINS**

The implementation, deterministic validation, bounded student projection,
privacy guard, packaging, and local Founder surface are ready for later unified
V6 reconciliation. Real camera/microphone human acceptance and real 10–15
minute MediaPipe/WASM browser endurance remain unresolved, so this package does
not claim AAA integration readiness or production deployment.

## Authority, baseline, and source identity

- Mission: `Y1-Y2-CAM-V6-3420R`
- Decision: `DR-035`
- MR-079 routing: `DR-035#Exact-MR-079-command-classes`
- Canonical authority commit:
  `d291b53d958862ee66cc8e4a0722b4cd3e6662ed`
- Product baseline: `89685d03e275adb2980e8f5f1ced9ef90153668f`
- Worktree:
  `/Users/brianb/MissionMed_worktrees/Y1-Y2-CAM-V6-3420R`
- Branch: `codex/y1-y2-cam-v6-3420r-communication-analytics-aaa`
- Final HEAD: the commit containing this handoff; the exact immutable hash is
  supplied by the task completion receipt because a commit cannot embed its own
  resulting hash.
- Exact path/protected hash record: `ivprep-v6/ALLOWED_PATHS_3420R.txt`

## Exact implementation stack

### Computer vision

- `@mediapipe/tasks-vision` exactly `1.0.1`, Apache-2.0.
- One browser module worker with a same-origin Fetch/XHR guard installed before
  the MediaPipe import.
- Holistic Landmarker float16 v1 for face, pose, hands, and compact
  blendshape-derived movement; GPU attempt with CPU fallback.
- BlazeFace short-range float16 Face Detector for per-frame multiple-face
  protection, with its own explicit event provenance.
- Local 480 × 270 `ImageBitmap`, maximum one frame in flight, default 8 FPS,
  adaptive reduction to 2 FPS, and cadence-aware tracking gaps.
- Raw frames and full landmarks stay inside the worker. Only bounded compact
  geometry crosses to the main thread; label-aligned prior blendshape scores
  remain worker-local temporal state and are never returned.

### Audio and synchronization

- Existing V6 `MediaStream`, `AudioContext`, analyser, recorder, transcript, and
  replay are reused; analytics opens no second capture.
- 50 ms PCM windows produce RMS, peak, and consecutive-sample-aware clipping.
- Adaptive startup noise-floor estimate, hysteretic Founder-only voice activity,
  bounded between-speech pause episodes, and explicit startup/cadence/trailing,
  hidden-tab, muted-track, disconnected-device, and suspended-context gaps.
- One monotonic session/answer clock with answer epochs, stale-worker rejection,
  media anchors, exact answer bounds, and per-answer evidence IDs.
- Media evidence IDs are emitted only after a non-empty replay Blob exists.

## Exact metrics and maturity

### `VALIDATED_STUDENT_SAFE`

- `answer_duration_ms`
- `captured_level_dbfs`
- `digital_clipping_fraction`

These require the exact sealed validation record, engine/source, payload schema,
unit/range, minimum 1,000 ms duration, minimum 0.8 coverage, and medium/high
reliability. Any mismatch fails closed.

### `FOUNDER_EXPERIMENTAL`

- Voice: `response_start_latency_ms`, `speech_active_ratio`,
  `energy_variation_db`, `low_captured_level`, `word_rate_wpm`,
  `filler_token_count`.
- Pause/system: `pause_episode`, `observation_gap`.
- Hands: `hand_presence`, `hand_motion_episode`, `gesture_zone` with stable
  anatomical left/right/both payloads.
- Body: `torso_presence`, `lateral_torso_lean`, `body_sway_episode`.
- Head/face/framing: `face_presence`, `head_orientation_proxy`,
  `camera_facing_proxy`, `sustained_head_turn_episode`,
  `facial_movement_episode`, `framing_center`, `multiple_faces_detected`.

Camera-facing means head position only, never gaze or eye contact. Facial
movement measures temporal change only, never emotion. Pause evidence never
claims purpose or intent. WPM/fillers exist only when an existing interview
transcript is supplied and never promote to the student surface.

### `REJECTED_UNRELIABLE` / contract-prohibited

Legacy zero-crossing pitch, eye contact, gaze, emotion, confidence, competence,
accent quality, personality, professionalism, readiness, intelligence,
deception/honesty, demographic/identity inference, program fit/match, semantic
gesture meaning, and any communication score are rejected. Raw PCM, pixels,
frames, images, landmarks, blendshape vectors, embeddings, typed arrays, Blobs,
coordinate arrays, and encoded binary payloads are rejected from events.

### Explicit omissions

The current Founder experiment does not simulate explicit no-hands/no-gesture
or repetition episodes, forward/back lean, distance/headroom/lighting, or
rolling pacing-change analysis. Standalone Founder WPM is visibly unavailable
because the guided test does not silently start browser speech recognition.

## Product experience

### Founder

Local URL: `http://127.0.0.1:8420/`.

MissionMed Ops → Test Communication Analytics provides a visible preview,
seven-step guided test, optional replay off by default, live engine/reliability
diagnostics, full bounded timestamped catalog, maturity/reliability/limitations,
exact-replay Watch controls, privacy receipt, denial/failure recovery, and
device/worker/media cleanup.

### Student

Your Results renders only sealed student-safe signals, one to three bounded
observable moments, no score, and replay seek only for an exact matching local
media ID. For 3420R attempts, legacy pitch, pause-intent, speaking-ratio,
frame-difference, luminance-centroid framing, story/strategy inference, ghost,
coach, and trend claims are withheld. Older seeded/non-3420R demo reps retain
their existing behavior.

Saved demo-local metadata is revalidated and reduced to the three allowed
student-safe event types. Founder-experimental timelines and diagnostics remain
tab-memory only and never enter localStorage or `persistence/alpha-store.mjs`.

## Validation statistics

- `npm run check`: PASS, 26 analytics modules.
- `npm test`: PASS, 123/123 total tests.
- `npm run analytics:validate`: PASS, 56/56 analytics tests.
- Fixture files/cases executed: 5/5 and 25/25.
- Manifest SHA-256:
  `5b4ef2c8666382eb36b92428fe2e1162586f95e71fb2e56aff3f8eba7b63a765`.
- Maximum sealed captured-level error: 0 dB.
- Sealed clipping precision/recall: 1.0/1.0.
- Maximum sealed clock/media error: 0 ms.
- Synthetic 900-second performance: 7,200 frames, 89 events, 70,005-byte
  envelope, 26 ms injected visual-inference p95.
- All 9 vendored runtime/model assets pass exact byte-size and SHA-256 checks.
- `npm ls --depth=0`: exact MediaPipe 1.0.1; existing LiveKit/ws remain clean.
- Protected hash matrix, protected baseline diff, and `git diff --check`: PASS.

The 900-second performance result is a deterministic compact-geometry workload,
not real camera/WASM performance evidence.

## Browser/privacy evidence

The in-app Browser loaded the real same-origin MediaPipe runtime and held its
initialization probe for 66 seconds:

```json
{
  "status": "PASS",
  "runtimeReady": true,
  "initError": null,
  "observedExternalResourceRequests": 0,
  "blockedWorkerEgressAttempts": 1,
  "heldAcrossTelemetryBoundarySeconds": 66
}
```

This proves runtime initialization, interception of the package telemetry
attempt, and no page-observed external request during that boundary. It does not
substitute for a real-camera worker/network trace. The current Founder page
loaded correctly with no Browser console warnings/errors; default viewport
visual inspection passed. An earlier 390 × 844 inspection passed before the
final lifecycle-only edits, with no subsequent analytics CSS change.

Privacy defenses are layered: same-origin assets, pre-import worker Fetch/XHR
guard, CSP `connect-src`/`worker-src`, no raw analytics persistence, capped
envelopes, multiple-face fail closed, tab-local replay off by default, recorder
epochs, and object-URL revocation on terminal paths.

## Specialist and independent verdicts

- Authority/seam specialist: fresh DR-035 routing resolved; bounded host seams
  identified; frozen/protected hashes recorded.
- CV/privacy specialist: one Holistic worker + separate Face Detector is the
  smallest mature same-origin stack; raw landmark output prohibited; package
  telemetry must be actively blocked.
- UX/accessibility specialist: first-class admin test, calm bounded student
  results, exact maturity labels, 44 px controls, replay truth, and no score.
- Signal/validation specialist: inherited zero-cross pitch, luminance centroid,
  frame difference, and fixed-threshold silence are not 3420R validation
  authority; deterministic registry promotion must remain narrow.
- Core red-team review: after muted-track, stable hand-schema, FaceDetector
  provenance, cadence/boundary-gap, raw-payload, projection, and lifecycle
  repairs, no remaining P0/P1 implementation defect was identified.
- Integration audit: protected 3410/3430 paths are diff-clean; package, vendor,
  server, host, and handoff boundaries are reconciliation-ready. AAA remains
  unsupported without real-device human/endurance evidence.

## 3410A/3430 overlap contract

No diff exists in `public/v6-integration.mjs`, `public/conversation-rail.mjs`,
providers, config, `persistence/alpha-store.mjs`, frozen baseline, or pre-existing
tests. The analytics adapter:

- preserves the fallback rail default and literal 3410 navigation cancellation;
- does not touch MicController, Realtime provider state, avatar media, provider
  credentials, model/voice selection, or LiveAvatar/Dexter lifecycle;
- uses separate Founder and ordinary-interview pipelines;
- never stops shared tracks or closes the caller-owned AudioContext;
- strips only unvalidated 3420R legacy pause count/longest-pause context before
  protected provider consumption.

## Files changed and integration contract

New isolated families:

- `ivprep-v6/analytics/**`
- `ivprep-v6/public/analytics/**`
- `ivprep-v6/test/analytics/**`
- `ivprep-v6/scripts/analytics/**`
- `ivprep-v6/fixtures/analytics/**`
- `ivprep-v6/public/vendor/mediapipe/**`
- `_AI_HANDOFFS/from_codex/Y1_Y2_CAM_V6_3420R/**`

Bounded modified seams:

- `ivprep-v6/public/index.html`
- `ivprep-v6/server/serve.mjs`
- `ivprep-v6/package.json`
- `ivprep-v6/package-lock.json`
- `ivprep-v6/README.md`
- `ivprep-v6/ALLOWED_PATHS_3420R.txt` (new authority/path record)

For unified reconciliation, take new isolated families first, then deliberately
reconcile the host/server/package seams. Preserve current canonical 3410A/3430
logic and rerun the complete matrix. Do not promote any experimental registry
entry without new authority and held-out consented validation.

## Rollback

Rollback is one commit-level revert of the final 3420R commit, or removal of the
new isolated families plus restoration of the six bounded seams from the
reconciliation baseline. No analytics migration, alpha-store record, remote
service, deployment, or production state must be reversed. Existing saved reps
without 3420R fields remain compatible.

## Reproduction

From `ivprep-v6`:

```sh
npm ci
npm run analytics:assets
npm run check
npm test
npm run analytics:validate
npm run analytics:privacy
npm run analytics:performance
npm ls --depth=0
git diff --check
```

`analytics:assets` is the authorized setup/materialization command and may copy
or fetch a missing declared asset; the remaining validation commands are the
verification matrix.

Local Founder run:

```sh
HOST=127.0.0.1 PORT=8420 npm start
```

Run MissionMed Ops → Test Communication Analytics, grant camera/microphone,
complete all seven steps, optionally exercise replay, verify result truth and
cleanup, then repeat for 10–15 minutes while measuring real FPS, WASM inference,
CPU, heap, long tasks, audio drops, thermal behavior, and Continuous
Conversation latency.

## Unresolved limitations and exact next action

Unresolved: no consenting real-person ground truth, no usable in-app Browser
camera/mic permission, no real-camera network trace, no real 10–15 minute WASM
performance/thermal/conversation-latency evidence, and no Founder usefulness
signoff. No deployment or canonical merge is authorized.

**Exact next action:** on a Mac with available camera/microphone, launch port
8420 and perform the one Founder run/endurance checklist above. Attach the
observed device, privacy, performance, and usefulness evidence to the later
unified V6 reconciliation ticket; do not promote visual/pause/VAD/transcript
signals from that run without a separately authorized held-out validation
package.
