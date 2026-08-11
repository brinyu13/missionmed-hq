# Y1-Y2-CAM-V6-3420R validation and acceptance report

## Classification

**PUSHED FOUNDER-TEST CANDIDATE --- AUTOMATED INDEPENDENT PASS**

**SHORT REAL-DEVICE CHROME DIAGNOSTIC PASS --- NOT HUMAN ACCEPTANCE**

**FULL FOUNDER USEFULNESS AND REAL 10--15 MINUTE WASM ENDURANCE UNRESOLVED**

Candidate commit:
`4c92d299a186ce0c7825b4054a9a8ecc3b9e79aa` on
`codex/y1-y2-cam-v6-3420r-communication-analytics-aaa`.

## Independent automated evidence

Executed from `ivprep-v6` against the pushed candidate on 2026-08-11:

| Check | Result |
| --- | --- |
| `npm run check` | PASS; 27 analytics modules syntax-checked |
| `npm test` | PASS; 166/166 total tests |
| `npm run analytics:validate` | PASS; 99/99 analytics checks |
| Fixture execution | PASS; 5/5 sealed files and 25/25 cases consumed |
| Student projection allowlist | PASS; exactly 3 sealed student-safe event types |
| Fixture manifest SHA-256 | `5b4ef2c8666382eb36b92428fe2e1162586f95e71fb2e56aff3f8eba7b63a765` |
| Captured-level maximum absolute error | 0 dB on the sealed synthetic grid |
| Digital-clipping precision / recall | 1.0 / 1.0 on the sealed synthetic grid |
| Clock/media-alignment maximum error | 0 ms on the sealed synthetic grid |
| `npm run analytics:privacy` | PASS; static source/persistence boundary |
| `npm run analytics:performance` | PASS; 900-second synthetic compact-geometry workload |
| Synthetic performance | 7,200 frames; 89 events; 70,005-byte envelope; 26 ms injected inference p95 |
| `npm run analytics:assets` | PASS; 9/9 runtime/model assets match size and SHA-256 |
| `npm ls --depth=0` | PASS; exact MediaPipe 1.0.1 plus unchanged LiveKit/ws dependencies |
| Protected path/hash matrix | PASS; 32/32 protected records clean |
| `git diff --check` | PASS |

The validation score script loads and executes every declared fixture case. A
manifest/file hash seal alone is not treated as measured validation. The
900-second result is an injected compact-geometry workload, not real camera or
WASM endurance evidence.

## Deterministic regression coverage

Coverage includes:

- event immutability, schema/range/unit checks, raw-payload adversarial keys,
  encoded payloads, prohibited inference names, and envelope byte bounds;
- monotonic answer clocks, exact answer/media bounds, stale answer/vision
  epochs, cross-answer rejection, hidden/device races, and late-result cleanup;
- PCM RMS/peak/clipping, mixed loud/quiet capture aggregation, explicit audio
  unavailability, immediate speech, steady noise, bounded/backdated pause
  timelines, automatic cadence gaps, and 15-minute audio churn;
- separate FaceDetector/Holistic worker initialization, exact same-frame joins,
  fail-closed startup and timeout, guarded Holistic watchdog, stale overlay
  expiry, and dynamic 16:9/4:3/portrait overlay alignment;
- compact geometry, unknown/zero/multiple-face suppression, posture/head/hand
  episode hysteresis, anatomical left/right/both gestures, static-face
  rejection, label-aligned facial change, adaptive 2 FPS cadence, tracking
  gaps, and 15-minute visual churn;
- a 30-second synchronized Founder timeline, bounded histories, unavailable
  modality rows, actual out-of-range gauge labels, invalid audio fail-closed,
  raw-diagnostic freshness, and fixed-memory run-wide p95 accumulators;
- 2:05 guided and 10:00/15:00 endurance run plans, session-clock auto-finish,
  590/890 minimum visual-frame gates, startup/end freshness, interruption
  detection, incomplete receipts, and automatic cleanup;
- exact student projection, forged envelope rejection, tiny clipping copy,
  minimum duration/coverage, and sealed persistence projection;
- optional integration failure, recorder/object-URL lifecycle, worker egress,
  runtime release, and protected 3410 navigation literals.

## Runtime privacy probe

The same-origin app was served on an isolated verification port; protected 3410
processes were not stopped or replaced. The MediaPipe initialization privacy
probe was held across the package telemetry boundary and reported:

```json
{
  "status": "PASS",
  "holisticRuntimeReady": true,
  "faceDetectorRuntimeReady": true,
  "initErrors": [],
  "observedExternalResourceRequests": 0,
  "blockedWorkerEgressAttempts": 2,
  "heldAcrossTelemetryBoundarySeconds": 66
}
```

This fresh pushed-candidate run proves initialization of both isolated
runtimes, interception of both package telemetry attempts, and no page-observed
external request during that boundary. It does not substitute for a full
real-device endurance network trace.

## Short Chrome real-device diagnostic

A short diagnostic-only run was performed in Chrome against the pushed commit.
It is deliberately classified below human acceptance.

| Observation | Evidence |
| --- | --- |
| Device/runtime initialization | Camera, microphone, FaceDetector, and Holistic initialized |
| Person guard | `FACE COUNT 1`; exactly-one-person guard ready |
| Visual instruments | Real mesh overlay plus head and framing state live; torso posture was unavailable in this diagnostic |
| Audio instruments | Waveform, level/clipping, speaking/pause, and energy variation live |
| Duration/result | Intentionally early finish at 25.037 seconds |
| Evidence events | 13 total: all 3 student-safe types plus 10 Founder-only events |
| Founder energy variation | 7.95 dB IQR |
| Full visual pipeline p95 | 78.4 ms, including FaceDetector, Holistic, and worker rendering |
| Founder cockpit run-wide p95 | overlay blit 0 ms; audio 1 ms; timeline 0.25 ms; full frame 2 ms |
| Replay | Off |
| Egress policy | External analytics egress blocked by same-origin worker guard and CSP |
| Cleanup | Page evaluation confirmed every video `srcObject` was `null` after finish/clear |

This observation proves a working local pipeline, synchronized evidence, and
device release for one short path. It does not prove the complete seven-step
ground-truth sequence, the accuracy or usefulness of its reactions, controlled
second-person suppression, replay seek, sustained performance, or cross-browser
behavior.

## Student-result boundary

The exact `VALIDATED_STUDENT_SAFE` allowlist remains:

- `answer_duration_ms`
- `captured_level_dbfs`
- `digital_clipping_fraction`

Pause/VAD, transcript, gesture, pose, head, framing, facial movement, and energy
IQR remain Founder-only. Founder WPM is intentionally unavailable unless an
existing interview transcript is supplied. No communication score or inferred
purpose, intent, emotion, gaze, identity, confidence, competence, accent
quality, personality, professionalism, or program fit may render.

## Required human functional acceptance

On the immutable pushed candidate at `http://127.0.0.1:8420/`:

1. Open MissionMed Ops -> Test Communication Analytics and choose the 2:05
   guided functional sequence.
2. Grant camera/microphone and complete all seven prompted steps: baseline,
   natural speech, a 3--5 second pause, left/right/both-hand gestures, gentle
   posture lean plus head left/right/center, smile/relax/brow movement, and
   slow/fast plus quiet/normal delivery contrast.
3. Confirm timestamps and instruments move when expected, recover when the
   action stops, and never imply gaze, emotion, intent, or a score.
4. Introduce one additional consenting person and confirm the face count is
   visible while person-specific analytics and overlay fail closed; confirm
   recovery after the second person leaves.
5. Complete one run with replay off and one with replay on; verify exact-take
   playback and timestamp seek, then Clear and confirm device/media release.
6. Record the Founder's explicit useful/not-useful disposition and every
   mismatch. Do not infer acceptance from the diagnostic or automated tests.

## Required real-WASM endurance acceptance

After functional usefulness is accepted, choose the 10:00 or 15:00 endurance
mode and keep the tab visible while speaking and moving naturally. A complete
receipt requires:

- the selected session-clock target;
- zero recorded instrumentation interruptions;
- first analyzable visual frame within 10 seconds;
- last analyzable visual frame within one second of the target boundary;
- at least 590 analyzable frames for 10 minutes or 890 for 15 minutes;
- successful automatic cleanup.

Record real FPS, full visual-pipeline and cockpit latency, CPU, browser heap,
long tasks, audio continuity/drops, thermal behavior, external network activity,
cleanup, and any Continuous Conversation latency effect. DR-035 defines no
numeric CPU/heap/thermal ceiling, so measurements remain `MEASURED` and their
acceptability remains `UNRESOLVED` until the Founder explicitly accepts them.

## Truthful unresolved items

- Human-rated body/face/gesture/pause/voice usefulness and mismatch log.
- Controlled multi-face suppression and recovery.
- Replay-on exact-take playback and seek behavior.
- Uninterrupted 10--15 minute real-camera/WASM performance, privacy, continuity,
  thermal, and cleanup evidence.
- Safari and responsive viewport review.
- Keyboard, screen-reader, zoom, contrast, and broader accessibility acceptance.

Until these are captured, the correct status remains Founder-test ready with
hardening remaining. No production deployment, canonical merge, or registry
promotion is authorized.
