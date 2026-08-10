# Y1-Y2-CAM-V6-3420R implementation report

## Status

**FOUNDER MULTIMODAL ANALYTICS TEST READY --- HARDENING REMAINS**

This lane is implemented, deterministic validation is green, the bounded
student projection is fail-closed, and the local Founder test surface is ready.
It is not represented as production-deployed or as complete real-device AAA
evidence. A consenting camera/microphone run and real 10–15 minute browser
endurance pass remain required before that stronger claim.

## Authority and source

- Mission: `Y1-Y2-CAM-V6-3420R`
- Decision: `DR-035`
- Canonical authority commit:
  `d291b53d958862ee66cc8e4a0722b4cd3e6662ed`
- Product baseline: `89685d03e275adb2980e8f5f1ced9ef90153668f`
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
- Synchronized evidence: one monotonic session/answer clock, media-relative
  evidence offsets only when a real replay exists, per-answer epochs, and exact
  audio/visual coverage-gap events.
- Founder test: a first-class MissionMed Ops view with guided steps, visible
  camera preview, diagnostics, maturity labels, replay seek controls, privacy
  receipt, denial/failure recovery, and explicit device release.
- Student results: only sealed `VALIDATED_STUDENT_SAFE` events can render. The
  current allowlist is answer duration, captured microphone level, and digital
  clipping. No communication score is created.

## Architecture and boundaries

- Pure contracts/reducers are mirrored through `ivprep-v6/analytics/**` for
  deterministic Node tests.
- Browser runtime lives in `ivprep-v6/public/analytics/**`.
- One module worker owns MediaPipe Holistic + Face Detector execution.
- The worker returns compact geometry only; raw frames, PCM, landmarks,
  blendshape vectors, embeddings, and biometric templates never enter events.
- MediaPipe 1.0.1 runtime, WASM, Holistic model, and BlazeFace model are pinned
  same-origin under `ivprep-v6/public/vendor/mediapipe/**` with complete hashes,
  notice, and Apache-2.0 license text.
- The worker installs same-origin Fetch/XHR guards before importing MediaPipe;
  server CSP supplies defense in depth.
- Saved demo-local rep metadata receives a revalidated persistence projection
  containing only sealed student-safe events. Founder-experimental timelines
  stay in tab memory and never enter the alpha-session store.
- Optional raw replay is off by default, remains a tab-local object URL, and is
  revoked on clear, page hide, deletion, reset, stale completion, and unsaved
  run replacement.

## Preserved lanes

No implementation diff exists in the protected Continuous Conversation,
LiveAvatar/Dexter, provider, configuration, persistence-store, frozen baseline,
or pre-existing test files. The only host adapter is the bounded
`public/index.html` seam; it treats analytics as optional and fail-soft.

The 3420R adapter also strips unvalidated legacy pause count/longest-pause
heuristics from provider context for 3420R-attempted turns without editing the
3410 provider module. The fallback conversation rail and avatar behavior remain
unchanged.

## Product-law boundary

All pause, VAD, transcript, gesture, pose, head, framing, and facial signals
remain `FOUNDER_EXPERIMENTAL`. Zero-crossing pitch, eye contact, emotion,
confidence/competence, accent quality, personality, professionalism, program
fit, and semantic gesture meaning are rejected by contract and cannot be
created as analytics metrics.

No production route, deployment, registry promotion, or unified-V6 merge is
authorized by this package.

Explicitly omitted rather than simulated: no-hands/no-gesture and gesture
repetition episodes, forward/back lean, camera distance/headroom/lighting, and
rolling pacing-change analysis. Founder WPM requires an existing transcript
and is unavailable in the standalone guided test.
