# Y1-Y2-CAM-V6-3420R complete combined handoff

## Current disposition

**FOUNDER MULTIMODAL ANALYTICS TEST READY --- HARDENING REMAINS**

The implementation, Founder live ground-truth cockpit, deterministic validation,
bounded student projection, privacy guard, and packaging are pushed and
independently verified. A short real-device Chrome diagnostic exercised the
local camera/microphone path and cleanup. It is not a substitute for human
Founder usefulness acceptance or uninterrupted 10--15 minute real-WASM
endurance. Safari, responsive, and accessibility acceptance also remain open.

This package is a clean Founder-test candidate for the isolated 3420R lane. It
does not claim AAA completion, canonical V6 integration, or production
deployment.

## Authority, baseline, and immutable source identity

- Mission: `Y1-Y2-CAM-V6-3420R`
- Decision: `DR-035`
- MR-079 routing: `DR-035#Exact-MR-079-command-classes`
- Canonical authority commit:
  `d291b53d958862ee66cc8e4a0722b4cd3e6662ed`
- Product baseline: `89685d03e275adb2980e8f5f1ced9ef90153668f`
- Pushed Founder-test implementation commit:
  `4c92d299a186ce0c7825b4054a9a8ecc3b9e79aa`
- Worktree:
  `/Users/brianb/MissionMed_worktrees/Y1-Y2-CAM-V6-3420R`
- Branch: `codex/y1-y2-cam-v6-3420r-communication-analytics-aaa`
- Exact path/protected hash record: `ivprep-v6/ALLOWED_PATHS_3420R.txt`

Any later commit that records human acceptance/endurance evidence must name its
own immutable hash separately; this document does not pretend a commit can
embed its own resulting hash.

## Delivered scope

### Voice and purposeful-pause boundary

- 50 ms PCM windows calculate capture RMS, peak, and
  consecutive-sample-aware digital clipping from the existing V6 audio path.
- Adaptive startup noise floor plus hysteretic voice activity produces bounded,
  timestamped between-speech silence episodes and explicit sampling gaps.
- Founder-only instruments show waveform, RMS/peak/clipping, voice activity,
  in-progress pauses, response-start timing, and energy IQR.
- Existing interview transcripts may support Founder-only WPM and filler
  observations. The standalone guided test does not silently start speech
  recognition, so WPM remains visibly unavailable there.
- Silence is never labeled purposeful and no intent is inferred.

### Body, hands, head, framing, and facial movement

- MediaPipe Holistic produces compact torso visibility, lateral lean, body
  sway, anatomical left/right/both hand movement and gesture zones, bounded
  head yaw/pitch/roll proxies, head-position camera-facing proxy, framing
  center, and label-aligned facial movement rate/episodes.
- Camera-facing means head position only, never gaze or eye contact. Facial
  movement measures temporal change only, never emotion.
- A separate FaceDetector supplies its per-frame detected-face count. Unknown,
  zero, or multiple detections suppress person-specific analytics and the
  overlay.
- Raw visual geometry is rendered only inside the Holistic worker to a
  transient `OffscreenCanvas`; only a derived overlay `ImageBitmap` reaches the
  Founder consumer and is closed immediately after drawing.

### Synchronization, evidence, and replay

- One monotonic session/answer clock, per-answer epochs, vision epochs, frame
  IDs, and exact FaceDetector/Holistic joins prevent cross-answer evidence.
- Numeric evidence timestamps always exist on the monotonic session/answer
  clock. A replay-addressable media ID and media timeline exist only after a
  non-empty exact-take replay Blob exists.
- Audio/vision availability and coverage gaps are explicit timestamped events.
  Hidden/device loss, worker failure, timeout, stale reply, and answer changes
  close current state instead of leaving frozen evidence.
- Optional replay is off by default, tab-local only, and revoked on clear, page
  hide, deletion, reset, stale completion, and unsaved-run replacement.

## Runtime architecture

### Computer vision

- `@mediapipe/tasks-vision` exactly `1.0.1`, Apache-2.0.
- Separate same-origin browser module workers for BlazeFace short-range float16
  FaceDetector and Holistic Landmarker float16 v1.
- Both workers install Fetch/XHR egress guards before importing MediaPipe.
- CPU-only inference, local assets, maximum one visual frame in flight, default
  8 FPS with adaptive reduction to 2 FPS, and cadence-aware gaps.
- FaceDetector joins person count to the exact frame before Holistic inference;
  startup is fail-closed and its bounded initialization timeout is visible.
- Holistic has a guarded frame watchdog. Watchdog-expired and epoch/frame-
  mismatched replies are rejected and cannot emit evidence or paint the
  overlay. A current reply that returns within the watchdog may contribute to
  bounded final analysis even when it exceeds the Founder's one-second live
  freshness limit; in that case the UI suppresses its overlay, live timeline,
  and endurance credit.
- Input frames are bounded within 480 x 270 while preserving source aspect;
  overlay drawing uses the same contain-fit preview transform for 16:9, 4:3,
  and portrait sources.

### Privacy and ownership

- Analytics reuses caller-owned `MediaStream`, `AudioContext`, analyser,
  recorder, transcript, and replay. It opens no second capture, never stops
  shared tracks directly, and never closes the caller's AudioContext.
- Raw frames, PCM, landmarks, blendshape vectors, embeddings, and biometric
  templates never enter analytics events or persistence.
- Holistic raw coordinates and prior label-aligned blendshape state remain
  worker-local.
- Same-origin worker guards, CSP, exact local assets, bounded envelopes,
  exactly-one-person suppression, and explicit device/worker/media cleanup are
  layered defenses.

## Founder live instrumentation and run modes

MissionMed Ops -> Test Communication Analytics provides:

- visible preview plus real current-frame mesh/pose/hand overlay;
- FaceDetector status, face count, and exactly-one-person guard state;
- bounded head, posture, hand, gesture, framing, and face-movement gauges;
- live audio waveform, level, peak, clipping, voice activity, pause, and energy
  instruments;
- synchronized timestamped evidence over a 30-second timeline;
- explicit audio/vision unavailable rows and stale-overlay clearing;
- bounded raw diagnostic text and performance receipts;
- overlay/gauge/audio/timeline toggles;
- denial/failure recovery, Clear, and explicit device release.

The timeline retains 640 level samples and 4,800 transitions with per-state
anchors. Cockpit p95 values are full-run, fixed-memory 0.25 ms histograms.
Visual-pipeline p95 includes FaceDetector, Holistic, and worker rendering;
overlay p95 is labeled separately as main-thread overlay blit.

Run modes are:

- Guided functional sequence -- 2:05 across seven prompted body, face,
  gesture, pause, speech, pacing, and volume steps.
- Real-WASM endurance hold -- 10:00.
- Real-WASM endurance hold -- 15:00.

Endurance mode locks the instruments on, disables replay, and auto-finishes only
at the selected session-clock target. A passing receipt additionally requires
zero instrumentation interruptions, first analyzable visual frame within 10
seconds, final frame within one second of target, at least 590 frames for 10
minutes or 890 for 15 minutes, and cleanup. Every early, interrupted, sparse,
stale, or camera-less result is labeled incomplete with reasons.

## Metric maturity and student boundary

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

Founder-experimental events and cockpit diagnostics stay tab-memory only and
never enter `persistence/alpha-store.mjs`. Student Your Results can render only
the exact three sealed event types; the UI caps displayed evidence at nine
events, creates no score, and offers an exact matching local replay seek only
when available.

### Rejected or prohibited

Zero-crossing pitch, eye contact, gaze, emotion, confidence, competence, accent
quality, personality, professionalism, readiness, intelligence,
deception/honesty, demographic/identity inference, program fit/match, semantic
gesture meaning, and every communication score are rejected. Raw PCM, pixels,
frames, images, landmarks, blendshape vectors, embeddings, typed arrays, Blobs,
coordinate arrays, and encoded binary payloads are rejected from events.

Explicitly omitted rather than fabricated: no-hands/no-gesture and gesture
repetition episodes, forward/back lean, distance/headroom/lighting, and rolling
pacing-change analysis.

## Independent automated verification

The pushed candidate passed:

- `npm run check`: 27 analytics modules.
- `npm test`: 166/166 total tests.
- `npm run analytics:validate`: 99/99 analytics checks.
- Fixture execution: 5/5 sealed files and 25/25 cases.
- Exact student-safe allowlist: three event types.
- Manifest SHA-256:
  `5b4ef2c8666382eb36b92428fe2e1162586f95e71fb2e56aff3f8eba7b63a765`.
- Maximum sealed captured-level error: 0 dB.
- Sealed clipping precision/recall: 1.0/1.0.
- Maximum sealed clock/media error: 0 ms.
- Privacy boundary: PASS.
- All 9/9 vendored runtime/model assets: exact size and SHA-256 PASS.
- `npm ls --depth=0`: exact MediaPipe 1.0.1; existing LiveKit/ws clean.
- Protected path/hash matrix: 32/32 clean.
- `git diff --check`: PASS before handoff refresh.

Synthetic 900-second performance passed with 7,200 frames, 89 events, a
70,005-byte envelope, and 26 ms injected visual-inference p95. This proves
bounded deterministic processing, not real camera/WASM performance.

## Browser and device evidence

### Runtime privacy initialization

The fresh pushed-candidate same-origin MediaPipe privacy probe held both
isolated runtimes across the package telemetry boundary for 66 seconds.
Holistic and FaceDetector were ready with no initialization errors, both worker
egress attempts were blocked, and page observation recorded zero external
resource requests. This is not a full endurance network trace.

### Short Chrome diagnostic on the pushed commit

- Real camera, microphone, FaceDetector, and Holistic initialized.
- `FACE COUNT 1`; exactly-one-person guard ready.
- Mesh overlay plus head, audio, energy, and timeline instruments were live.
- The run intentionally finished early at 25.037 seconds.
- Result contained 13 events: the three student-safe types and ten Founder-only
  events.
- Founder energy IQR: 7.95 dB.
- Full visual-pipeline p95: 78.4 ms.
- Founder run-wide p95: overlay blit 0 ms, audio 1 ms, timeline 0.25 ms, full
  cockpit frame 2 ms.
- Replay remained off.
- External analytics egress remained blocked by worker policy and CSP.
- Page-level evaluation confirmed every video `srcObject` was `null` after
  finish/clear.

This is evidence of real local pipeline operation and cleanup for a short
diagnostic. It is not human movement/speech accuracy or usefulness acceptance,
multi-face acceptance, replay acceptance, or real endurance evidence.

## Specialist and independent verdicts

- Authority/seam review: fresh DR-035 routing resolved; frozen and protected
  boundaries preserved.
- CV/privacy review: separate FaceDetector/Holistic workers, exact frame join,
  worker-local raw landmarks, transient overlay bitmap, and active same-origin
  egress guards satisfy the authorized privacy architecture.
- Core red-team review: after startup, hidden/device race, timeout, stale
  result, availability, overlay alignment/freshness, timeline, meter, and
  fixed-memory performance repairs, no remaining P0/P1 defect was identified.
- Independent final matrix: automated validation, dependency, vendor custody,
  and 32/32 protected checks passed.

These verdicts support a pushed Founder-test candidate only. They do not
replace the unresolved human and endurance gates.

## 3410A/3430 overlap contract

No diff exists in `public/v6-integration.mjs`, `public/conversation-rail.mjs`,
providers, config, `persistence/alpha-store.mjs`, frozen baseline, or
pre-existing tests. The analytics adapter:

- preserves the fallback rail default and literal 3410 navigation cancellation;
- does not touch MicController, Realtime provider state, avatar media, provider
  credentials, model/voice selection, or LiveAvatar/Dexter lifecycle;
- uses separate Founder and ordinary-interview pipelines;
- never stops shared tracks or closes the caller-owned AudioContext;
- strips only unvalidated 3420R legacy pause count/longest-pause context before
  protected provider consumption.

No 3410/3410A, 3430, canonical V6, production, or deployment surface is
authorized for mutation by this package.

## Files and reconciliation contract

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
- `ivprep-v6/ALLOWED_PATHS_3420R.txt` (authority/path record)

For unified reconciliation, take isolated families first, then deliberately
reconcile the host/server/package seams. Preserve canonical 3410A/3430 logic,
re-resolve authority, and rerun every gate. Do not promote an experimental
registry entry without a new authority-backed held-out validation package.

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
or fetch a missing declared asset. The remaining commands verify the source and
assets already present.

Local Founder surface:

```sh
HOST=127.0.0.1 PORT=8420 npm start
```

Open `http://127.0.0.1:8420/`, then MissionMed Ops -> Test Communication
Analytics.

## Human functional acceptance protocol

Use the immutable pushed candidate and record observed mismatches rather than
inferring success:

1. Select Guided functional sequence -- 2:05.
2. Complete baseline; natural speech; sentence, 3--5 second silence, resume;
   left, right, and both-hand gestures; gentle lean, upright, head left/right,
   center; smile, relax, brows; and slow/fast plus quiet/normal delivery.
3. Confirm each live instrument and timestamp reacts and recovers as expected,
   with no score, gaze, emotion, or intentional-pause claim.
4. Introduce one additional consenting person; verify visible multi-face
   status, suppression of person-specific analytics/overlay, and recovery when
   the person leaves.
5. Test one run with replay off and one with replay on. Verify exact-take
   playback/seek and full Clear/device release.
6. Record an explicit Founder useful/not-useful disposition and all failures.

## Real-WASM endurance protocol

Only after functional acceptance, select 10:00 or 15:00 endurance and keep the
tab visible while speaking/moving naturally. A complete receipt requires:

- session-clock target reached;
- no instrumentation interruption;
- first analyzable visual frame within 10 seconds;
- final analyzable visual frame within one second of target;
- at least 590 frames for 10 minutes or 890 for 15 minutes;
- camera, microphone, and local WASM workers released afterward.

Capture CPU, browser heap, FPS and full-pipeline/cockpit latency, main-thread
long tasks, audio drops/continuity, thermal behavior, external network activity,
cleanup, and Continuous Conversation latency. DR-035 provides no numeric
CPU/heap/thermal ceiling; report observed values as `MEASURED` and preserve
acceptability as `UNRESOLVED` until explicit Founder judgment.

## Rollback

Rollback is commit-level reversion of the 3420R commits, or removal of the new
isolated families plus restoration of the six bounded seams from the
reconciliation baseline. No analytics migration, alpha-store record, remote
service, deployment, or production state must be reversed. Existing saved reps
without 3420R fields remain compatible.

## Unresolved limitations and exact next action

Unresolved:

- full seven-step human movement/speech ground truth and usefulness signoff;
- controlled multi-face suppression/recovery;
- replay-on exact-take playback and seek;
- uninterrupted real 10--15 minute camera/WASM CPU, heap, thermal, network,
  FPS/latency, continuity, cleanup, and 3410-impact evidence;
- Safari, responsive, keyboard, screen-reader, zoom, contrast, and broader
  accessibility acceptance.

**Exact next action:** keep the pushed commit immutable, perform and record the
human functional protocol, then run one uninterrupted 10:00 or 15:00 endurance
mode and record its receipt and system observations. Repair only an observed
in-scope 3420R failure, rerun the complete automated matrix, and append truthful
evidence to these four handoffs for the later unified V6 reconciliation ticket.

Do not merge, deploy, touch protected lanes, or promote Founder-experimental
metrics under this handoff.
