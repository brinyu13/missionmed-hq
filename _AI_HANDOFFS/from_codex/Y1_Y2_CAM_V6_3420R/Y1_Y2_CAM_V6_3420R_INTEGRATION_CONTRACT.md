# Y1-Y2-CAM-V6-3420R unified V6 integration contract

## Intended consumer and source

Later unified V6 reconciliation ticket only. This package does not authorize a
merge into canonical V6 or a deployment.

- Mission/decision: `Y1-Y2-CAM-V6-3420R` / `DR-035`
- Pushed Founder-test candidate:
  `4c92d299a186ce0c7825b4054a9a8ecc3b9e79aa`
- Branch: `codex/y1-y2-cam-v6-3420r-communication-analytics-aaa`
- Exact path/protected record: `ivprep-v6/ALLOWED_PATHS_3420R.txt`
- Current classification:
  `FOUNDER MULTIMODAL ANALYTICS TEST READY --- HARDENING REMAINS`

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
4. Reconcile bounded host seams deliberately:
   - `ivprep-v6/public/index.html`
   - `ivprep-v6/server/serve.mjs`
   - `ivprep-v6/package.json`
   - `ivprep-v6/package-lock.json`
   - `ivprep-v6/README.md`
5. Do not take any apparent change in providers, `public/v6-integration.mjs`,
   `public/conversation-rail.mjs`, configuration,
   `persistence/alpha-store.mjs`, frozen baseline, or pre-existing tests. This
   lane has no authorized diff there.
6. Run the complete reproduction matrix and human/endurance gates before
   accepting the reconciliation.

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
  transient `OffscreenCanvas` and transfer only the derived Founder-only
  overlay `ImageBitmap`; the consumer must close it after synchronous drawing.
- The worker canvas and preview overlay preserve the input aspect ratio through
  the same contain-fit geometry.
- Missing, zero, unknown, or multiple face counts suppress person-specific
  visual analytics and clear the overlay.
- Existing V6 `MediaStream`, `AudioContext`, recorder, transcript, and replay
  remain caller-owned. Analytics must not open a second capture, stop shared
  tracks directly, or close the caller's AudioContext.

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

- Automated independent PASS: 27 analytics modules, 166/166 total tests,
  99/99 analytics validation checks, 5/5 fixture files, 25/25 cases, exact
  three-event student allowlist, privacy PASS, 32/32 protected hashes, and 9/9
  vendored assets.
- Synthetic 900-second PASS: 7,200 frames, 89 events, 70,005-byte envelope,
  and 26 ms injected inference p95. This is not real-WASM endurance.
- Short Chrome diagnostic: real camera/microphone and both workers initialized;
  exactly-one guard ready; overlay/head/audio/energy/timeline live; 25.037
  seconds, 13 events, 7.95 dB energy IQR; 78.4 ms full visual p95; cockpit p95
  0/1/0.25/2 ms; replay off; all video `srcObject` values null after
  finish/clear. This is not human acceptance.

## Acceptance gate for reconciliation

Before integration acceptance, the immutable candidate still requires:

1. Human completion and usefulness rating of the complete seven-step guided
   body/face/gesture/pause/voice sequence.
2. Controlled second-person multi-face suppression and recovery.
3. Replay-off and replay-on exact-take playback/seek acceptance.
4. One uninterrupted real 10- or 15-minute camera/WASM run with the receipt
   gates above and recorded CPU, heap, FPS/latency, long-task, audio-continuity,
   thermal, network/egress, cleanup, and Continuous Conversation observations.
5. Safari, responsive, keyboard, screen-reader, zoom, contrast, and broader
   accessibility review.

The exact automated commands and detailed human protocol are in
`Y1_Y2_CAM_V6_3420R_COMPLETE_COMBINED_HANDOFF.md` and
`Y1_Y2_CAM_V6_3420R_VALIDATION_RESULTS.md`.

No protected-lane change, registry promotion, canonical merge, or deployment is
authorized by this contract.
