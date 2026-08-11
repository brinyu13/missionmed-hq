# Y1-Y2-CAM-V6-3420R unified V6 integration contract

## Intended consumer and source

Later unified V6 reconciliation ticket only. This package does not authorize a
merge into canonical V6 or a deployment.

- Mission/decision: `Y1-Y2-CAM-V6-3420R` / `DR-035`
- Founder-accepted implementation donor:
  `e24a68bc5e90b126c2c08ab30011aa2cf6fab7a9`
- Immutable donor locator:
  `https://github.com/brinyu13/missionmed-hq.git` commit
  `e24a68bc5e90b126c2c08ab30011aa2cf6fab7a9`, subtree `ivprep-v6/**`
- Convenience checkout only, not immutable copy evidence:
  `/Users/brianb/MissionMed_worktrees/Y1-Y2-CAM-V6-3420R/ivprep-v6`
- Earlier cockpit diagnostic commit:
  `4c92d299a186ce0c7825b4054a9a8ecc3b9e79aa`
- Branch: `codex/y1-y2-cam-v6-3420r-communication-analytics-aaa`
- Exact path/protected record: `ivprep-v6/ALLOWED_PATHS_3420R.txt`
- Current classification:
  `MULTIMODAL ANALYTICS FOUNDER ACCEPTED — READY FOR 3440`

This donor is accepted by the Founder for unified integration. It does not
itself authorize a copy, merge, deployment, production mutation, or student
activation. Current 3440 custody names predecessor donor `4c92d299…`; before
copying any exact new overlay/report bytes, 3440 must obtain an additive
accepted-source/integration record naming `e24a68b…` and the exact paths below.
Independently authored 3440 reconciliation code may proceed only under its own
fresh mutation gate; it is not donor-byte equality and cannot bypass accepted-
source authority.

### Exact predecessor-to-accepted-donor product/test delta

From `4c92d299…` to `e24a68b…`, excluding the four handoff documents, the exact
15 product/test paths are:

- modified `ivprep-v6/public/analytics/analytics-session.mjs`
- modified `ivprep-v6/public/analytics/analytics.css`
- modified `ivprep-v6/public/analytics/browser-pipeline.mjs`
- modified `ivprep-v6/public/analytics/episode-detectors.mjs`
- modified `ivprep-v6/public/analytics/holistic-worker.mjs`
- added `ivprep-v6/public/analytics/overlay-policy.mjs`
- added `ivprep-v6/public/analytics/overlay-ui.mjs`
- added `ivprep-v6/public/analytics/playback-overlay.mjs`
- modified `ivprep-v6/public/analytics/ui.mjs`
- modified `ivprep-v6/test/analytics/analytics-session.test.mjs`
- modified `ivprep-v6/test/analytics/founder-cockpit.test.mjs`
- added `ivprep-v6/test/analytics/overlay-policy-ui.test.mjs`
- added `ivprep-v6/test/analytics/overlay-runtime.test.mjs`
- modified `ivprep-v6/test/analytics/privacy-lifecycle.test.mjs`
- modified `ivprep-v6/test/analytics/vision.test.mjs`

## Reconciliation order

1. Verify the exact 3420R source commit, `DR-035`, and
   `ivprep-v6/ALLOWED_PATHS_3420R.txt`.
2. Preserve canonical/frozen V6 and accepted 3410/3410A and 3430 behavior.
3. Take the isolated new families first:
   - `ivprep-v6/analytics/**`
   - `ivprep-v6/public/analytics/**`
   - `ivprep-v6/test/analytics/**`
   - `ivprep-v6/scripts/analytics/**`
   - `ivprep-v6/fixtures/analytics/**`
   - `ivprep-v6/public/vendor/mediapipe/**`
   - in particular, preserve these overlay donor modules as one reviewed unit:
     - `ivprep-v6/public/analytics/overlay-policy.mjs`
     - `ivprep-v6/public/analytics/overlay-ui.mjs`
     - `ivprep-v6/public/analytics/playback-overlay.mjs`
4. Treat donor host seams as behavioral references, not 3440 copy targets:
   - donor `ivprep-v6/public/index.html`
   - donor `ivprep-v6/server/serve.mjs`
   - donor `ivprep-v6/package.json`
   - donor `ivprep-v6/package-lock.json`
   - donor `ivprep-v6/README.md`
5. Reconcile the behavior into the current 3440 AAA host only after its gate
   reopens. At committed 3440 baseline
   `fb2c99d084b746e38a011e7c9551b502a53e9710`, the primary analytics/video
   integration touchpoints are:
   - `ivprep-v6/public/aaa/index.html`
   - `ivprep-v6/public/aaa/app.mjs`
   - `ivprep-v6/public/aaa/styles.css`
   - `ivprep-v6/public/aaa/api-client.mjs`
   - `ivprep-v6/server/hq-mount.mjs`
   This is not an exhaustive AAA runtime inventory; existing modules such as
   `ivprep-v6/public/aaa/fixtures.mjs` remain 3440-owned and must be preserved.
   The legacy donor `public/index.html` simulator is not the production AAA
   shell and must not be transplanted as though it were.
6. Do not take any apparent change in providers, `public/v6-integration.mjs`,
   `public/conversation-rail.mjs`, configuration,
   `persistence/alpha-store.mjs`, frozen baseline, or pre-existing tests. This
   lane has no authorized diff there.
7. Run the complete reproduction matrix and the 3440 canary/hardening gates
   before accepting the reconciliation.

## Runtime ownership contract

- FaceDetector and Holistic are separate browser module workers with
  same-origin Fetch/XHR guards installed before MediaPipe import.
- FaceDetector owns person count. Its result must join the exact generation,
  answer epoch, vision epoch, frame ID, and timestamp before the corresponding
  image reaches Holistic.
- While FaceDetector initializes, person-specific inference fails closed. Its
  timeout and any FaceDetector failure are explicit unavailability, never an
  implied one-person result.
- Holistic is CPU-only, maximum one frame in flight, and protected by a bounded
  watchdog. Watchdog-expired, hidden-tab, old-answer, old-generation, and
  epoch/frame-mismatched results may neither emit evidence nor redraw the
  overlay. A current reply inside the watchdog may contribute to bounded final
  analysis even if it exceeds the Founder's one-second live freshness limit;
  that reply must not redraw the overlay/timeline or earn endurance credit.
- Raw camera `ImageBitmap`s and PCM remain transient in browser-local
  processing; landmarks and blendshape vectors remain worker-local. None may
  enter events or persistence. Holistic may render current-frame geometry to a
  transient `OffscreenCanvas` and transfer only the derived overlay
  `ImageBitmap`; the currently authorized transient display consumer must close
  it after synchronous drawing.
- The worker canvas and preview overlay preserve the input aspect ratio through
  the same contain-fit geometry.
- Missing, zero, unknown, or multiple face counts suppress person-specific
  visual analytics and clear the overlay.
- Existing V6 `MediaStream`, `AudioContext`, recorder, transcript, and replay
  remain caller-owned. Analytics must not open a second capture, stop shared
  tracks directly, or close the caller's AudioContext.
- Playback overlay uses its own bounded worker pair and exact generation,
  answer, vision, frame, timestamp, source, seek, and layer ownership. It
  samples supported in-app replay at at most 4 FPS, returns only a transient
  derived bitmap plus scalar safety/status metadata, exposes no geometry, and
  stops/clears on pause, seek, hidden state, source replacement, layer change,
  end, failure, destroy, and view teardown.

## Host-seam intent

### `public/index.html`

- adds the admin Founder navigation/view and results anchor;
- imports the optional analytics entry module;
- begins, seals, abandons, and releases analytics around the existing media
  lifecycle using fail-soft calls;
- maps replay and analytics evidence to the same take;
- keeps 3420R legacy heuristic coaching hidden while the bounded engine owns
  the observation path;
- projects only sealed student-safe results and persists only their revalidated
  minimum;
- revokes tab-local media URLs on every terminal path;
- strips legacy pause-count/longest-pause values from 3420R provider context
  without changing the protected provider adapter.

### `server/serve.mjs`

- adds `.wasm`, `.task`, and `.tflite` MIME types;
- adds self-only worker policy and WASM execution CSP support;
- preserves the existing same-origin plus configured LiveKit connect policy;
- uses local port 8420 for this isolated lane so it does not replace the active
  protected 3410 process.

### Package files

- pin `@mediapipe/tasks-vision` exactly to `1.0.1`;
- add analytics syntax, validation, privacy, performance, and asset commands;
- include `test/analytics/*.test.mjs` in the normal test command;
- do not change LiveKit or ws versions.

## Founder instrumentation contract

- The cockpit is Founder-only and must never enter `renderStudentAnalytics` in
  `public/analytics/ui.mjs` or the student projection in
  `public/analytics/results-projection.mjs`.
- The overlay, gauges, audio instruments, synchronized 30-second timeline, raw
  diagnostics, and run-wide performance receipts are engineering visibility,
  not coaching labels or a communication score.
- Founder diagnostics require finite non-negative analytics-session `atMs`.
  Audio/vision loss closes active timeline rows and renders unavailable state.
- The timeline is bounded to 640 level samples and 4,800 transitions with
  evicted-state anchors. Run-wide cockpit p95 uses fixed-memory 0.25 ms
  histograms.
- Guided mode is exactly 2:05. Endurance modes are exactly 10:00 and 15:00 and
  lock instrumentation on while disabling local replay.
- Endurance completion requires clock target, no interruption, first visual
  frame within 10 seconds, final visual frame within one second of target, and
  minimum analyzable frame counts of 590/890. Receipts must name every
  incomplete reason and confirm device/worker cleanup separately.

## Overlay product contract for 3440

The current donor proves a browser-local alpha display policy only. Boolean
policy/preferences may be stored locally; no raw coordinates, overlay frames,
or biometric/media payloads are persisted. Display is independent of analytics
collection and results: turning a layer off clears pixels but does not create,
remove, promote, or alter an analytics event.

Unified IV Prep must replace the local-alpha policy with authenticated,
server-authoritative shared application policy:

- Admin can globally enable or disable overlay display.
- Admin can permit or prohibit student overlay use.
- An authorized student can show/hide the overlay during their own live
  interview when allowed.
- An authorized student can show/hide the overlay while reviewing their own
  supported in-app recording when allowed.
- Face and Body/Hands remain independently toggleable on live and playback.
- Any missing/invalid policy, role, ownership, media correlation, worker
  safety, or exactly-one-person guard fails closed.

Current 3440 durable product-database and ordinary-student authority remain
closed. If 3440 first implements canary policy in authenticated process memory,
it must be server-authoritative, fail closed, and visibly labeled reset-on-
restart; it must not be described as durable shared production policy.

## Student, persistence, and privacy contract

Only these sealed event types may reach bounded student results or saved
demo-local analytics metadata:

- `answer_duration_ms`
- `captured_level_dbfs`
- `digital_clipping_fraction`

Every visual, pause, VAD, transcript, and Founder energy signal remains
`FOUNDER_EXPERIMENTAL`. Any validation seal, source engine, unit/range,
duration, coverage, event payload, replay/media correlation, or allowlist
mismatch fails closed.

Raw frames, images, PCM, landmarks, blendshape vectors, embeddings, typed
arrays, coordinate arrays, and encoded biometric/media payloads are forbidden
from events and persistence. Founder diagnostics remain tab-memory only. Replay
is off by default, exact-take only, and its object URL must be revoked on all
terminal paths.

## Protected-lane conflict rules

- Preserve the literal 3410 room-navigation cancellation sequence and fallback
  rail default.
- Never attach analytics to avatar media or provider credentials.
- Do not alter MicController, Realtime provider state, model/voice selection,
  LiveAvatar/Dexter lifecycle, configuration, or the alpha store.
- Keep Founder and ordinary-interview pipelines separate.
- Keep all worker/model assets same-origin and all egress guards in place.
- Keep every visual, VAD, pause, transcript, and Founder energy metric
  Founder-only until a new authority-backed held-out validation record promotes
  it.
- Preserve the current clean 32/32 protected hash matrix and 9/9 vendored asset
  custody; remeasure both from the reconciliation baseline.

## Evidence already attached to the candidate

- Fresh PASS: 30 analytics modules, 217/217 total tests,
  150/150 analytics validation checks, 5/5 fixture files, 25/25 cases, exact
  three-event student allowlist, privacy PASS, 32/32 protected hashes, and 9/9
  vendored assets.
- Synthetic 900-second PASS: 7,200 frames, 89 events, 70,065-byte envelope,
  and 26 ms injected inference p95. This is not real-WASM endurance.
- Historical short Chrome diagnostic on `4c92d299…`: real camera/microphone and both workers initialized;
  exactly-one guard ready; overlay/head/audio/energy/timeline live; 25.037
  seconds, 13 events, 7.95 dB energy IQR; 78.4 ms full visual p95; cockpit p95
  0/1/0.25/2 ms; replay off; all video `srcObject` values null after
  finish/clear. This remains predecessor initialization evidence.
- Founder-accepted guided Chrome run on `e24a68b…`: 125.003 seconds; 100.0%
  microphone coverage; 97.5% camera coverage; 97.0% exactly-one-person
  coverage; 99.8% safe-frame face presence; 94.2% camera-facing proxy; one
  777 ms face-absence interval with recovery; hand-motion, audio, live overlay,
  replay overlay, exact timestamp seek, independent face/body controls,
  cleanup, and privacy accepted. Full visual p95 was 74.9 ms. The report held
  43 events: exact 3 student-safe and 40 Founder Experimental.
- Torso/posture is **NOT EXERCISED UNDER REPRESENTATIVE POSTURE — DEFER TO
  NORMAL ADMIN CANARY HARDENING** because the Founder was lying down/outside
  representative seated posture. It is not verified and is not a donor blocker.

## 3440 reconciliation requirements

Founder has accepted 3420R as the integration donor. Before 3440 can accept the
integrated result, it must:

1. Reopen its mutation gate and explicitly accept `e24a68b…` plus the exact
   15-path delta above as an immutable source before copying those bytes.
2. Implement the authenticated overlay policy contract above without
   persisting unnecessary raw biometric/media data.
3. Preserve the exact three-event student-safe allowlist and Founder-only
   maturity of every pause/VAD/transcript/visual/energy signal.
4. Preserve all overlay worker privacy, frame ownership, safety, fault
   isolation, bounded recovery, cleanup, and student-video registration.
5. Keep representative seated torso/posture, controlled second-person,
   10/15-minute real-WASM CPU/heap/thermal/network/continuity, Safari,
   responsive, and accessibility work as explicit canary hardening—not as
   completed evidence.
6. Address Founder conversation/voice findings in the unified protected lane,
   not by editing this donor: unacceptable response delay, material five-second
   silence contribution, fallback latency, and robotic audible voice.
7. In MissionMed native interview mode, default student video to the large
   primary surface and interviewer to the inset; provide an accessible `SWAP`
   control; preserve explicit Zoom/Webex/Microsoft Teams simulated layouts;
   keep the overlay registered to student video in either priority state.
   `SWAP` changes layout only: it must not exchange participant identity,
   `srcObject`, analytics source, or overlay ownership. Pass the student camera
   element explicitly to analytics rather than inferring it from visual size.

The current 3440 AAA room is voice-only with a synthetic student preview. The
video, swap, authenticated overlay-policy, and playback clauses above are
required integration behavior, not claims that 3440 already implements them.

The exact automated commands and detailed human protocol are in
`Y1_Y2_CAM_V6_3420R_COMPLETE_COMBINED_HANDOFF.md` and
`Y1_Y2_CAM_V6_3420R_VALIDATION_RESULTS.md`.

No protected-lane change, registry promotion, canonical merge, 3440 mutation,
or deployment is authorized by this contract. It is a donor contract only.
