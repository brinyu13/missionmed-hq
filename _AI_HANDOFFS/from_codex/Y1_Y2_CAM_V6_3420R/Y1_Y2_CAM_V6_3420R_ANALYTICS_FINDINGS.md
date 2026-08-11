# Y1-Y2-CAM-V6-3420R implementation and Founder hardening report

## Status

**FOUNDER MULTIMODAL ANALYTICS TEST READY --- HARDENING REMAINS**

The isolated lane is implemented and pushed, the independent automated matrix
is green, the bounded student projection fails closed, and a short Chrome
real-device diagnostic exercised the local camera/microphone pipeline. That
diagnostic is not human Founder acceptance and is not a 10--15 minute real-WASM
endurance pass. Those gates, plus Safari, responsive, and accessibility review,
remain unresolved. No production deployment, canonical merge, or AAA-complete
claim is made.

## Authority and source

- Mission: `Y1-Y2-CAM-V6-3420R`
- Decision: `DR-035`
- MR-079 routing: `DR-035#Exact-MR-079-command-classes`
- Canonical authority commit:
  `d291b53d958862ee66cc8e4a0722b4cd3e6662ed`
- Product baseline: `89685d03e275adb2980e8f5f1ced9ef90153668f`
- Pushed Founder-test candidate:
  `4c92d299a186ce0c7825b4054a9a8ecc3b9e79aa`
- Branch: `codex/y1-y2-cam-v6-3420r-communication-analytics-aaa`
- Exact path record: `ivprep-v6/ALLOWED_PATHS_3420R.txt`

## What was built

The implementation adds one browser-local analytics engine around the existing
V6 camera, microphone, recording, and replay lifecycle.

- Voice/delivery: deterministic capture level and digital clipping, plus
  Founder-only energy variation, voice-activity timing, and transcript-derived
  word-rate/filler observations when an existing transcript is available.
- Pauses: timestamped silence-between-detected-speech episodes with adaptive
  noise-floor handling, hysteresis, bounded timelines, and explicit sampling
  gaps. Silence is never labeled purposeful or interpreted as intent.
- Hands/gestures: anatomical left, right, and both-hand movement episodes and
  bounded zones from compact geometry.
- Posture/body: torso visibility, lateral lean, and body-sway episodes.
- Head/camera-facing: bounded head-orientation proxy, sustained head-turn
  episodes, camera-facing head-position proxy, and framing center. None is
  called gaze or eye contact.
- Facial movement: label-aligned frame-to-frame blendshape change rate and
  timestamped movement episodes. No emotion, identity, personality, health, or
  demographic inference exists.
- Synchronized evidence: one monotonic session/answer clock with numeric event
  timestamps, per-answer epochs, and exact audio/visual availability and
  coverage-gap events. Replay-addressable media IDs and media timelines exist
  only when a real exact-take replay exists.
- Student results: only sealed `VALIDATED_STUDENT_SAFE` events can render. The
  exact allowlist is answer duration, captured microphone level, and digital
  clipping. No communication score is created.

## Founder ground-truth cockpit

MissionMed Ops -> Test Communication Analytics now exposes a first-class,
Founder-only live instrumentation surface:

- a transient worker-rendered tracking overlay with exactly-one-person status;
- face/head, posture, hand/gesture, and framing state with bounded gauges;
- live audio waveform, RMS/peak/clipping, speaking, pause, and energy-variation
  instruments;
- a synchronized 30-second evidence timeline with timestamped transitions and
  explicit audio/vision unavailability rows;
- raw bounded diagnostic text and run-wide performance receipts;
- independent overlay, gauge, audio, and timeline toggles;
- a 2:05 seven-step guided sequence and real-WASM 10:00/15:00 endurance modes;
- optional local replay off by default, exact-take seek controls, and explicit
  clear/release behavior.

The live timeline retains 640 level samples and up to 4,800 transitions with
evicted-state anchors. Founder cockpit timing uses fixed-memory 0.25 ms
histograms over the full run, not a trailing-window sample. A silent or late
visual worker, audio loss, hidden tab, device loss, geometry rejection, or
multi-face condition becomes visible unavailability rather than frozen data.

Endurance receipts fail closed. A completed receipt requires the selected
session-clock target, no recorded instrumentation interruption, a first
analyzable visual frame within 10 seconds, a final frame within one second of
the target, and at least 590 frames for 10 minutes or 890 for 15 minutes. Early,
interrupted, stale, sparse, or camera-less runs are labeled incomplete.

## Runtime architecture and privacy boundaries

- Pure contracts/reducers are mirrored through `ivprep-v6/analytics/**` for
  deterministic Node tests; browser runtime lives in
  `ivprep-v6/public/analytics/**`.
- MediaPipe FaceDetector and Holistic run in separate module workers. This
  avoids their same-worker runtime collision and keeps the person-count guard
  independent from person-specific analytics.
- FaceDetector joins its result to the exact generation, answer, vision epoch,
  frame, and timestamp before Holistic inference. Startup is fail-closed while
  FaceDetector initializes; its bounded timeout is reported as unavailable.
- Holistic is CPU-only and has a guarded per-frame watchdog. Timed-out,
  hidden-tab, old-answer, old-generation, and epoch/frame-mismatched work cannot
  reopen evidence or paint the Founder overlay. A current within-watchdog reply
  older than the one-second Founder freshness limit may still contribute to
  bounded final analysis, but it cannot redraw the live overlay/timeline or
  receive endurance credit.
- Raw frames, PCM, landmarks, blendshape vectors, embeddings, and biometric
  templates never enter analytics events. Holistic draws raw landmarks only to
  a transient worker-local `OffscreenCanvas`; a derived `ImageBitmap` crosses
  only to the Founder overlay consumer and is closed after drawing.
- Non-16:9 camera sources preserve their source aspect in the worker and are
  contain-fitted to the preview, preventing overlay/preview drift.
- MediaPipe 1.0.1 runtime, WASM, Holistic model, and BlazeFace model are pinned
  same-origin under `ivprep-v6/public/vendor/mediapipe/**` with complete hashes,
  notice, and Apache-2.0 license text.
- Both workers install same-origin Fetch/XHR guards before importing MediaPipe;
  server CSP supplies defense in depth.
- Saved demo-local rep metadata receives a revalidated persistence projection
  containing only sealed student-safe events. Founder diagnostics and timelines
  stay in tab memory and never enter the alpha-session store.
- Optional raw replay remains a tab-local object URL and is revoked on clear,
  page hide, deletion, reset, stale completion, and unsaved-run replacement.

## Pushed-candidate evidence

Independent automated verification of
`4c92d299a186ce0c7825b4054a9a8ecc3b9e79aa` passed:

- `npm run check`: 27 analytics modules;
- `npm test`: 166/166 tests;
- `npm run analytics:validate`: 99/99 checks, all 5 sealed fixture files and
  25/25 cases, exact three-event student allowlist;
- manifest SHA-256
  `5b4ef2c8666382eb36b92428fe2e1162586f95e71fb2e56aff3f8eba7b63a765`;
- privacy probe, dependency check, all 9/9 vendored assets, and 32/32 protected
  hashes;
- synthetic 900-second workload: 7,200 frames, 89 events, 70,005-byte
  envelope, and 26 ms injected visual-inference p95.

A diagnostic-only Chrome run on the pushed commit initialized the real camera,
microphone, FaceDetector, and Holistic workers. It observed `FACE COUNT 1`, an
exactly-one-person guard-ready state, live mesh/head/audio/energy/timeline
instruments, and no replay. The intentionally early 25.037-second result held
13 events: the three student-safe types and ten Founder-only events. Founder
energy IQR was 7.95 dB. Its receipt reported 78.4 ms full visual-pipeline p95
and 0/1/0.25/2 ms run-wide p95 for overlay blit/audio/timeline/full cockpit
frame. External analytics egress remained blocked by policy, and page-level
evaluation confirmed every video `srcObject` was `null` after finish/clear.

This short run proves local pipeline operation and cleanup only. It does not
prove the full guided movement/speech sequence, usefulness, controlled
multi-face suppression, replay seek truth, or endurance behavior.

## Preserved lanes

The 32/32 protected hash matrix is clean. No implementation diff exists in the
protected Continuous Conversation 3410/3410A, LiveAvatar/Dexter 3430, provider,
configuration, persistence-store, frozen baseline, or pre-existing test files.
The bounded `public/index.html` host seam treats analytics as optional and
fail-soft.

The adapter strips unvalidated legacy pause-count/longest-pause heuristics from
provider context only for 3420R-attempted turns without editing the protected
provider module. The fallback conversation rail and avatar behavior remain
unchanged.

## Product-law boundary

All pause, VAD, transcript, gesture, pose, head, framing, and facial signals
remain `FOUNDER_EXPERIMENTAL`. Some legacy signal names, including
zero-crossing pitch, eye contact, emotion, and semantic gesture, exist only as
`REJECTED_UNRELIABLE` registry entries; the current engine never emits or
student-projects them. Confidence/competence, accent quality, personality,
professionalism, program fit, and related prohibited traits likewise never
emit or reach student results.

Explicitly omitted rather than simulated: no-hands/no-gesture and gesture
repetition episodes, forward/back lean, camera distance/headroom/lighting, and
rolling pacing-change analysis. Founder WPM requires an existing transcript
and is unavailable in the standalone guided test.

## Remaining gates and next action

Still required on the immutable pushed candidate:

1. A human Founder completes and rates the full seven-step body, face, gesture,
   pause, and delivery sequence.
2. A controlled second-person case confirms live multi-face suppression.
3. Replay is tested both off and on, including exact-take seek behavior.
4. One uninterrupted 10- or 15-minute real-WASM run records CPU, browser heap,
   thermal behavior, network/egress, FPS/latency, audio continuity, cleanup,
   and any effect on Continuous Conversation latency.
5. Safari, responsive-layout, keyboard, screen-reader, and broader
   accessibility acceptance are recorded.

Only after those observations should the evidence and final disposition be
added to this package for the later unified V6 reconciliation ticket. No merge,
deployment, registry promotion, or protected-lane edit is authorized here.
