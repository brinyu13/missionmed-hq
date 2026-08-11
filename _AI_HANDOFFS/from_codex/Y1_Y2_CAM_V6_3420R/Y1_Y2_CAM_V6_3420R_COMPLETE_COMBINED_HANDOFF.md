# Y1-Y2-CAM-V6-3420R complete combined handoff

## Current disposition

**MULTIMODAL ANALYTICS FOUNDER ACCEPTED — READY FOR 3440**

Founder accepted the current 3420R implementation as the integration donor for
unified IV Prep On-Call after a complete 2:05 real-device Chrome run. The
implementation, live ground-truth cockpit, live and playback overlays,
deterministic validation, bounded student projection, privacy guard, and
packaging are pushed and verified.

This is `GUIDED REAL-DEVICE TECHNICAL PASS — READY FOR UNIFIED INTEGRATION`.
It does not claim production, deployment, broad-student activation,
cross-browser acceptance, or uninterrupted 10--15 minute real-WASM endurance.
Founder directed that those hardening items not hold 3420R open.

Torso/posture is **NOT EXERCISED UNDER REPRESENTATIVE POSTURE — DEFER TO NORMAL
ADMIN CANARY HARDENING** because the Founder was lying down/outside normal
seated interview posture. It is not verified.

## Authority, baseline, and immutable source identity

- Mission: `Y1-Y2-CAM-V6-3420R`
- Decision: `DR-035`
- MR-079 routing: `DR-035#Exact-MR-079-command-classes`
- Canonical authority commit:
  `d291b53d958862ee66cc8e4a0722b4cd3e6662ed`
- Product baseline: `89685d03e275adb2980e8f5f1ced9ef90153668f`
- Founder-accepted implementation donor commit:
  `e24a68bc5e90b126c2c08ab30011aa2cf6fab7a9`
- Earlier cockpit diagnostic commit:
  `4c92d299a186ce0c7825b4054a9a8ecc3b9e79aa`
- Worktree:
  `/Users/brianb/MissionMed_worktrees/Y1-Y2-CAM-V6-3420R`
- Branch: `codex/y1-y2-cam-v6-3420r-communication-analytics-aaa`
- Exact path/protected hash record: `ivprep-v6/ALLOWED_PATHS_3420R.txt`
- Immutable donor locator:
  `https://github.com/brinyu13/missionmed-hq.git` commit
  `e24a68bc5e90b126c2c08ab30011aa2cf6fab7a9`, subtree `ivprep-v6/**`
- Convenience checkout only, not immutable copy evidence:
  `/Users/brianb/MissionMed_worktrees/Y1-Y2-CAM-V6-3420R/ivprep-v6`

The text-only closeout commit containing these handoffs is reported externally
after commit; this document does not pretend a commit can embed its own
resulting hash.

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
  currently authorized transient display consumer and is closed immediately
  after drawing.

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

### Live and playback overlay display

- Local-alpha Admin master and student-permission booleans default fail-closed.
- Authorized role/surface preferences independently control Face and
  Body/Hands display without changing analytics collection or results.
- The live controller stays registered to the student camera element and
  follows its mirror/layout transform.
- Supported in-app playback runs same-origin local workers at no more than
  4 FPS, returns no geometry to the main thread, and draws only transient
  derived bitmaps.
- Source, seek, layer, visibility, safety, frame, epoch, and lifecycle changes
  clear stale pixels and invalidate old work. Worker rendering and canvas blit
  faults are display-only and never suppress valid analytics geometry.
- Overlay frames, raw coordinates, landmarks, and biometric/media payloads are
  never added to events or persistence.

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

Accepted donor `e24a68bc5e90b126c2c08ab30011aa2cf6fab7a9` passed:

- `npm run check`: 30 analytics modules.
- `npm test`: 217/217 total tests.
- `npm run analytics:validate`: 150/150 analytics checks.
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
70,065-byte envelope, and 26 ms injected visual-inference p95. This proves
bounded deterministic processing, not real camera/WASM performance.

## Browser and device evidence

### Runtime privacy initialization

The fresh pushed-candidate same-origin MediaPipe privacy probe held both
isolated runtimes across the package telemetry boundary for 66 seconds.
Holistic and FaceDetector were ready with no initialization errors, both worker
egress attempts were blocked, and page observation recorded zero external
resource requests. This is not a full endurance network trace.

### Earlier short Chrome diagnostic on predecessor commit

This diagnostic ran on
`4c92d299a186ce0c7825b4054a9a8ecc3b9e79aa`:

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

### Founder-accepted full guided Chrome run

The Founder completed the full 125.003-second guided sequence on accepted
donor `e24a68bc5e90b126c2c08ab30011aa2cf6fab7a9` with local replay, Face, and
Body/Hands display enabled.

- Result: 43 timestamped events; exact 3 student-safe and 40 Founder
  Experimental.
- Microphone: 100.0% coverage / 2,501 frames; -50.88 dBFS captured level;
  0.00% digital clipping.
- Camera/person safety: 97.5% camera coverage / 975 frames; 97.0%
  exactly-one-person coverage / 970 safe samples.
- Face/head: 99.8% safe-frame face presence; 94.2% camera-facing proxy; four
  head-turn episodes totaling 4.76 seconds; one 379 ms facial-movement episode.
- Brief absence: one 777 ms face-absence interval (0.6%) with safe recovery;
  zero multi-face intervals and zero safety triggers.
- Hands: 29.5% safe-frame presence and two right-hand motion episodes totaling
  1.13 seconds.
- Audio experimental observations: 46.2% level activity, 21 silence episodes
  totaling 54.1 seconds, and 27.37 dB captured-energy IQR. No pause purpose,
  intent, WPM, or F0 conclusion was made.
- Performance: 74.9 ms full visual-pipeline p95; run-wide cockpit p95
  0/0.75/0.25/1.5 ms for overlay blit/audio/timeline/full frame.
- Privacy: raw analytics audio/frames/landmarks retained `NO`; optional replay
  tab-memory only; two attempts blocked; external analytics calls `NO`.
- Replay: `Watch 0:49` landed at 49.975559 seconds with ready state 4, exact
  Blob media, and no error. Face OFF/body ON, face ON/body OFF, and both ON
  were exercised and restored.
- Cleanup: completion receipt confirmed camera, microphone, and local WASM
  workers released.

Founder accepted microphone and camera coverage, one-person detection, face
visibility, camera-facing proxy, recovery after brief absence, hand-motion
detection, audio capture, replay, timestamp seeking, live and playback overlay,
independent Face and Body/Hands visibility, cleanup, and privacy behavior.
No screenshot containing the Founder's face is committed.

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

These verdicts and the Founder decision support the accepted integration donor.
They do not convert deferred endurance/cross-browser/accessibility work into
completed evidence or authorize deployment.

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

Exact overlay donor modules inside `public/analytics/**` include:

- `overlay-policy.mjs`
- `overlay-ui.mjs`
- `playback-overlay.mjs`

The exact product/test delta from predecessor `4c92d299…` to accepted donor
`e24a68b…`, excluding the four handoff documents, is the 15-path list in
`Y1_Y2_CAM_V6_3420R_INTEGRATION_CONTRACT.md`. That list—not the current dirty
checkout—is the reconciliation inventory.

Bounded modified seams:

- `ivprep-v6/public/index.html`
- `ivprep-v6/server/serve.mjs`
- `ivprep-v6/package.json`
- `ivprep-v6/package-lock.json`
- `ivprep-v6/README.md`
- `ivprep-v6/ALLOWED_PATHS_3420R.txt` (authority/path record)

For unified reconciliation, take isolated families first, then deliberately
re-express the required behavior in 3440's current AAA host. At committed 3440
baseline `fb2c99d084b746e38a011e7c9551b502a53e9710`, the primary analytics/video
integration touchpoints are `ivprep-v6/public/aaa/index.html`,
`ivprep-v6/public/aaa/app.mjs`,
`ivprep-v6/public/aaa/styles.css`, `ivprep-v6/public/aaa/api-client.mjs`, and
`ivprep-v6/server/hq-mount.mjs`. The donor's `ivprep-v6/public/index.html` and
`ivprep-v6/server/serve.mjs` are behavioral references, not direct 3440 copy
targets. This is not an exhaustive AAA runtime inventory; existing modules such
as `ivprep-v6/public/aaa/fixtures.mjs` remain 3440-owned and must be preserved.
Preserve canonical 3410A/3430 logic, re-resolve authority, and rerun every gate.
Do not promote an experimental registry entry without a new authority-backed
held-out validation package.

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

## Founder acceptance decision

Founder disposition is final for this donor:

`GUIDED REAL-DEVICE TECHNICAL PASS — READY FOR UNIFIED INTEGRATION`.

Torso/posture is deliberately not included in verified behavior. It is
`NOT EXERCISED UNDER REPRESENTATIVE POSTURE — DEFER TO NORMAL ADMIN CANARY
HARDENING` and does not hold 3420R open.

## Real-WASM endurance protocol

For normal admin-canary/3440 hardening—not as a new 3420R acceptance gate—select
10:00 or 15:00 endurance and keep the tab visible while speaking/moving
naturally. A complete receipt requires:

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
product thresholds as `UNRESOLVED`. This does not reopen 3420R.

## Rollback

Rollback is commit-level reversion of the 3420R commits, or removal of the new
isolated families plus restoration of the six bounded seams from the
reconciliation baseline. No analytics migration, alpha-store record, remote
service, deployment, or production state must be reversed. Existing saved reps
without 3420R fields remain compatible.

## Required 3440 product contract

### Authenticated overlay policy

The browser-local alpha booleans are not the final product architecture. 3440
must provide authenticated, server-authoritative application policy so Admin
can globally enable/disable overlays and allow/prohibit student use. When
allowed, an authorized student can show/hide overlays during their own live
interview and their own supported playback. Face and Body/Hands remain
independent. Missing/invalid policy or media ownership fails closed. Do not
persist unnecessary raw biometric/media data merely to render overlays.

Current 3440 database/durable-state and ordinary-student authority are closed.
Any interim authenticated process-memory canary policy must be fail-closed and
labeled reset-on-restart, never durable shared production policy.

### Conversation and voice findings

Founder reported unacceptable interviewer response latency and a robotic
audible voice. The visible five-second silence rule contributes materially;
Continuous Conversation entered High-Intelligence Voice fallback, adding
latency. The exact provider error, rail/voice ID, and acoustic cause were not
captured. These are Founder product findings, not 3420R analytics defects.

After 3440's mutation gate reopens, capture safe rail errors and answer-end to
first-audible timing, then run repeated analytics-on/off and voice-preset A/B
tests before changing VAD eagerness, silence completion, observer ordering,
speech buffering, or voice selection.

### Video priority and swap

MissionMed-native interview mode must default to student video as the large
primary surface and interviewer as the smaller inset. Provide an obvious,
accessible `SWAP` control so either can be primary. Explicit Zoom, Webex, or
Microsoft Teams simulation preserves its corresponding simulated layout. The
analytics overlay must remain correctly registered to student video in either
priority state. `SWAP` changes layout only; it must not exchange participant
identity, `srcObject`, analytics source, or overlay ownership. Pass the student
camera element explicitly to analytics instead of inferring it from whichever
tile is visually primary.

The current 3440 AAA room is voice-only with a synthetic student preview. This
is a required integration contract, not a claim that 3440 video, swap,
authenticated overlay policy, or playback is already implemented.

## Accepted deferrals and exact terminal action

Deferred without holding 3420R open:

- representative seated torso/posture canary;
- controlled second-person human canary;
- uninterrupted 10/15-minute real-camera/WASM CPU, heap, thermal, network,
  FPS/latency, continuity, cleanup, and conversation-impact evidence;
- Safari, responsive, keyboard, screen-reader, zoom, contrast, and broader
  accessibility acceptance.

Current 3440 custody names predecessor donor `4c92d299…`, not accepted donor
`e24a68b…`. Before copying any exact new donor bytes, 3440 must obtain an
additive accepted-source/integration record naming `e24a68b…` and the exact
15-path delta. Independently authored 3440 reconciliation code may proceed only
under a fresh 3440 gate; it is not donor-byte equality and cannot bypass
accepted-source authority.

**Exact terminal action:** commit and push this text-only closeout, then stop
3420R product implementation. The implementation donor remains immutable at
`e24a68bc5e90b126c2c08ab30011aa2cf6fab7a9`. The containing handoff commit is
reported in the final custody response because a Git commit cannot embed its
own resulting hash.

Do not merge, deploy, touch 3410/3410A, 3430, 3440, 3451, canonical V6, or
production, and do not promote Founder-experimental metrics under this handoff.
