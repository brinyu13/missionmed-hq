# Y1-Y2-CAM-V6-3420R implementation and Founder hardening report

## Status

**MULTIMODAL ANALYTICS FOUNDER ACCEPTED — READY FOR 3440**

Founder accepted the current 3420R implementation as the analytics integration
donor after a complete 2:05 real-device Chrome run. The bounded student
projection still fails closed, the automated matrix is green, and live plus
replay overlays were exercised with independent face/body visibility controls.
This is a guided real-device technical acceptance for unified integration, not
a production, deployment, broad-student, cross-browser, or 10--15 minute
real-WASM endurance claim.

Torso/posture was not meaningfully exercised because the Founder performed the
run while lying down/outside representative seated interview posture. It is
classified exactly as **NOT EXERCISED UNDER REPRESENTATIVE POSTURE — DEFER TO
NORMAL ADMIN CANARY HARDENING**. It is neither verified nor treated as a 3420R
closeout blocker.

## Authority and source

- Mission: `Y1-Y2-CAM-V6-3420R`
- Decision: `DR-035`
- MR-079 routing: `DR-035#Exact-MR-079-command-classes`
- Canonical authority commit:
  `d291b53d958862ee66cc8e4a0722b4cd3e6662ed`
- Product baseline: `89685d03e275adb2980e8f5f1ced9ef90153668f`
- Accepted implementation donor commit:
  `e24a68bc5e90b126c2c08ab30011aa2cf6fab7a9`
- Earlier cockpit diagnostic commit:
  `4c92d299a186ce0c7825b4054a9a8ecc3b9e79aa`
- Branch: `codex/y1-y2-cam-v6-3420r-communication-analytics-aaa`
- Exact path record: `ivprep-v6/ALLOWED_PATHS_3420R.txt`
- Immutable donor locator:
  `https://github.com/brinyu13/missionmed-hq.git` commit
  `e24a68bc5e90b126c2c08ab30011aa2cf6fab7a9`, subtree `ivprep-v6/**`
- Convenience checkout only, not immutable copy evidence:
  `/Users/brianb/MissionMed_worktrees/Y1-Y2-CAM-V6-3420R/ivprep-v6`

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
- Overlay display: local-alpha admin master and student-allow booleans gate
  independent face and body/hands layers for live and supported in-app replay.
  Display changes do not change collection, events, maturity, persistence, or
  student results. Playback re-runs the same local workers at at most 4 FPS,
  returns no geometry to the main thread, and retains no overlay frames.

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
  clear/release behavior; and
- independent face and body/hands layer controls for both live and supported
  replay surfaces, with fail-closed exact-one-person rendering.

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
  only to the currently authorized transient display consumer and is closed
  after drawing.
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

Fresh verification of accepted donor
`e24a68bc5e90b126c2c08ab30011aa2cf6fab7a9` passed:

- `npm run check`: 30 analytics modules;
- `npm test`: 217/217 tests;
- `npm run analytics:validate`: 150/150 checks, all 5 sealed fixture files and
  25/25 cases, exact three-event student allowlist;
- manifest SHA-256
  `5b4ef2c8666382eb36b92428fe2e1162586f95e71fb2e56aff3f8eba7b63a765`;
- privacy probe, dependency check, all 9/9 vendored assets, and 32/32 protected
  hashes;
- synthetic 900-second workload: 7,200 frames, 89 events, 70,065-byte
  envelope, and 26 ms injected visual-inference p95.

An earlier diagnostic-only Chrome run on predecessor commit
`4c92d299a186ce0c7825b4054a9a8ecc3b9e79aa` initialized the real camera,
microphone, FaceDetector, and Holistic workers. It observed `FACE COUNT 1`, an
exactly-one-person guard-ready state, live mesh/head/audio/energy/timeline
instruments, and no replay. The intentionally early 25.037-second result held
13 events: the three student-safe types and ten Founder-only events. Founder
energy IQR was 7.95 dB. Its receipt reported 78.4 ms full visual-pipeline p95
and 0/1/0.25/2 ms run-wide p95 for overlay blit/audio/timeline/full cockpit
frame. External analytics egress remained blocked by policy, and page-level
evaluation confirmed every video `srcObject` was `null` after finish/clear.

That short run remains historical initialization evidence only.

## Founder-accepted real-device Chrome evidence

The Founder then completed the full 125.003-second guided sequence against
accepted donor `e24a68bc5e90b126c2c08ab30011aa2cf6fab7a9` with local replay on.
The result contained 43 timestamped events: the exact 3 validated student-safe
observations and 40 Founder-only experimental observations.

- Microphone: 100.0% coverage, 2,501 analyzed frames, captured level
  -50.88 dBFS, and 0.00% digital clipping.
- Camera: 97.5% coverage, 975 analyzable frames, 97.0%
  exactly-one-person coverage, and 970 safe samples.
- Face/head: 99.8% face presence within safe frames, 94.2% camera-facing
  head-position proxy, four sustained head-turn episodes totaling 4.76
  seconds, and one facial-movement episode lasting 379 ms.
- Brief absence: one exact 777 ms face-absence interval (0.6% of the run),
  followed by safe recovery; no multiple-face interval or safety trigger was
  recorded.
- Hands: 29.5% presence within safe frames and two right-hand motion episodes
  totaling 1.13 seconds; anatomical channels and zones were reported without
  assigning gesture meaning.
- Audio/VAD: 46.2% level-activity estimate, 21 bounded silence episodes totaling
  54.1 seconds, and 27.37 dB captured-energy IQR. VAD/pause purpose remains
  Founder Experimental and no purpose, intent, WPM, or F0 was inferred.
- Performance/privacy: 74.9 ms full visual-pipeline p95; cockpit p95
  0/0.75/0.25/1.5 ms for overlay blit/audio/timeline/full frame; raw analytics
  audio, frames, and landmarks retained `NO`; replay stayed tab-memory only;
  two external attempts were blocked and no external analytics call occurred.
- Replay acceptance: `Watch 0:49` sought to 49.975559 seconds with ready state
  4, no media error, and the exact tab-local Blob. Face OFF/body ON, face
  ON/body OFF, and face ON/body ON states were each exercised successfully.
- Cleanup: the completed-run receipt confirmed camera, microphone, and local
  WASM workers released. Founder explicitly accepted device cleanup and the
  privacy behavior.

The Founder explicitly accepted microphone and camera coverage, one-person
detection, face visibility, camera-facing proxy, recovery after brief face
absence, hand-motion detection, audio capture, replay, timestamp seeking, live
overlay, playback overlay, independent face/body visibility, cleanup, and
privacy behavior. No screenshot containing the Founder's face is part of Git
or this handoff package.

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

## Founder requirements handed to 3440

The current browser-local overlay policy is a donor prototype, not the final
product architecture. Unified 3440 must provide authenticated, server-
authoritative shared application policy for global enable/disable and whether
students may use overlays. An authorized student must be able to show/hide the
overlay on their own live interview and their own supported playback. Face and
body/hands remain independently toggleable. Overlay pixels, raw landmarks, and
raw biometric/media payloads must not be persisted merely to render display.

Founder also recorded two non-analytics product findings for 3440:

1. Interviewer response latency is unacceptable. The visible five-second
   silence rule contributes materially, and Continuous Conversation falling
   into High-Intelligence Voice fallback adds further latency.
2. The audible interviewer voice sounded robotic. The exact runtime rail,
   voice ID, and acoustic root cause were not captured, so this remains direct
   Founder perception rather than a defect assigned to one provider or voice.

These findings predate/do not identify a 3420R analytics defect. 3440 must
measure safe rail errors, answer-end-to-first-audible latency, and analytics-
on/off plus voice-preset A/B evidence before altering VAD, turn completion,
observer ordering, speech buffering, or voice selection.

MissionMed-native video layout must default to student video as the large
primary surface and interviewer as the smaller inset, with an obvious
accessible `SWAP` control. Explicit Zoom, Webex, or Microsoft Teams simulation
must preserve its simulated layout. The analytics overlay must stay registered
to the student video regardless of which surface is primary.

## Accepted deferrals and terminal action

- Torso/posture: **NOT EXERCISED UNDER REPRESENTATIVE POSTURE — DEFER TO NORMAL
  ADMIN CANARY HARDENING**.
- Controlled second-person suppression, uninterrupted 10/15-minute real-WASM
  CPU/heap/thermal/network/continuity evidence, Safari, responsive, and broader
  accessibility review remain hardening items. Founder directed that they do
  not hold 3420R open.
- Current 3440 custody accepts predecessor donor `4c92d299…`, not this final
  `e24a68b…` donor. Before copying any exact new donor bytes, 3440 must obtain
  an additive accepted-source/integration record naming `e24a68b…` and the
  exact 15 product/test paths listed in the integration contract. Independently
  authored 3440 reconciliation code may proceed only under a fresh 3440 gate;
  it is not donor-byte equality and cannot bypass accepted-source authority.

Terminal status is **MULTIMODAL ANALYTICS FOUNDER ACCEPTED — READY FOR 3440**.
Stop 3420R product implementation after the text-only closeout commit. No
merge, deployment, registry promotion, production mutation, or protected-lane
edit is authorized here.
