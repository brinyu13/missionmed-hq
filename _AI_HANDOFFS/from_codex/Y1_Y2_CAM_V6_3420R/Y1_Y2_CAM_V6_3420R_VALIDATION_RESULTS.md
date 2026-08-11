# Y1-Y2-CAM-V6-3420R validation and acceptance report

## Classification

**MULTIMODAL ANALYTICS FOUNDER ACCEPTED — READY FOR 3440**

**GUIDED REAL-DEVICE TECHNICAL PASS — READY FOR UNIFIED INTEGRATION**

**TORSO/POSTURE NOT EXERCISED UNDER REPRESENTATIVE POSTURE — DEFER TO NORMAL
ADMIN CANARY HARDENING**

Accepted implementation donor commit:
`e24a68bc5e90b126c2c08ab30011aa2cf6fab7a9` on
`codex/y1-y2-cam-v6-3420r-communication-analytics-aaa`.

Earlier short-diagnostic commit:
`4c92d299a186ce0c7825b4054a9a8ecc3b9e79aa`.

## Independent automated evidence

Executed from `ivprep-v6` against the pushed candidate on 2026-08-11:

| Check | Result |
| --- | --- |
| `npm run check` | PASS; 30 analytics modules syntax-checked |
| `npm test` | PASS; 217/217 total tests |
| `npm run analytics:validate` | PASS; 150/150 analytics checks |
| Fixture execution | PASS; 5/5 sealed files and 25/25 cases consumed |
| Student projection allowlist | PASS; exactly 3 sealed student-safe event types |
| Fixture manifest SHA-256 | `5b4ef2c8666382eb36b92428fe2e1162586f95e71fb2e56aff3f8eba7b63a765` |
| Captured-level maximum absolute error | 0 dB on the sealed synthetic grid |
| Digital-clipping precision / recall | 1.0 / 1.0 on the sealed synthetic grid |
| Clock/media-alignment maximum error | 0 ms on the sealed synthetic grid |
| `npm run analytics:privacy` | PASS; static source/persistence boundary |
| `npm run analytics:performance` | PASS; 900-second synthetic compact-geometry workload |
| Synthetic performance | 7,200 frames; 89 events; 70,065-byte envelope; 26 ms injected inference p95 |
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
  runtime release, and protected 3410 navigation literals;
- local admin master and student permission, role/surface-specific boolean
  preferences, independent face/body layer masks, and browser-storage failure;
- live overlay mirror/layer/safety invalidation, playback exact-frame joins,
  no-geometry responses, at-most-4-FPS sampling, source/seek/layer epochs,
  bounded recovery, display-only worker/canvas faults, same-ID video
  replacement, stale-capture ownership, and deterministic cleanup.

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

## Earlier short Chrome real-device diagnostic

A short diagnostic-only run was performed in Chrome against predecessor commit
`4c92d299a186ce0c7825b4054a9a8ecc3b9e79aa`.
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

## Founder-accepted Chrome real-device guided run

Founder completed the 2:05 guided sequence in Chrome against accepted donor
`e24a68bc5e90b126c2c08ab30011aa2cf6fab7a9`. Local replay, face overlay, and
body/hands overlay were enabled. The browser report recorded:

| Observation | Accepted evidence |
| --- | --- |
| Duration | 125.003 seconds; guided functional sequence complete |
| Evidence catalog | 43 events: exact 3 student-safe plus 40 Founder Experimental |
| Microphone | 100.0% coverage; 2,501 frames; -50.88 dBFS; 0.00% clipping |
| Camera | 97.5% coverage; 975 analyzable frames |
| Person guard | 97.0% exactly-one-person coverage; 970 safe samples |
| Face/head | 99.8% safe-frame face presence; 94.2% camera-facing proxy |
| Brief absence and recovery | one 777 ms face-absence interval; safe recovery; zero multi-face intervals |
| Hands | 29.5% safe-frame presence; two right-hand movement episodes; 1.13 s union duration |
| Head/facial movement | four head-turn episodes / 4.76 s; one facial-movement episode / 379 ms |
| Audio activity | 46.2% level-activity estimate; 21 silence episodes / 54.1 s; 27.37 dB energy IQR |
| Full visual pipeline p95 | 74.9 ms, including local inference/rendering |
| Cockpit p95 | overlay blit 0 ms; audio 0.75 ms; timeline 0.25 ms; full frame 1.5 ms |
| Privacy | raw analytics audio/frames/landmarks retained `NO`; 2 external attempts blocked; external analytics calls `NO` |
| Replay seek | `Watch 0:49` reached 49.975559 s; ready state 4; no media error; exact tab-local Blob |
| Layer controls | face OFF/body ON; face ON/body OFF; face ON/body ON all exercised successfully |
| Cleanup | completed-run receipt: camera, microphone, and local WASM workers released |

The Founder explicitly accepted microphone coverage, camera coverage,
one-person detection, face visibility, camera-facing proxy, recovery after
brief face absence, hand-motion detection, audio capture, replay, timestamp
seeking, live overlay, playback overlay, independent Face and Body/Hands
ON/OFF, cleanup, and privacy behavior.

Torso presence was 0.0% and no usable posture episode was emitted because the
Founder performed the test lying down/outside normal seated interview posture.
This result is **NOT EXERCISED UNDER REPRESENTATIVE POSTURE — DEFER TO NORMAL
ADMIN CANARY HARDENING**. It is not a verified signal and not a 3420R blocker.
No screenshot containing the Founder's face is committed or included.

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

## Founder acceptance disposition

Founder decision is:

`GUIDED REAL-DEVICE TECHNICAL PASS — READY FOR UNIFIED INTEGRATION`.

The current implementation is accepted as the 3420R donor for unified IV Prep
On-Call. This disposition closes the isolated product implementation lane; it
does not promote Founder Experimental metrics, prove broad-student readiness,
authorize integration by itself, or authorize deployment/production.

## Deferred real-WASM endurance protocol

For normal admin-canary/3440 hardening—not as a new 3420R acceptance gate—choose
the 10:00 or 15:00 endurance mode and keep the tab visible while speaking and
moving naturally. A complete receipt requires:

- the selected session-clock target;
- zero recorded instrumentation interruptions;
- first analyzable visual frame within 10 seconds;
- last analyzable visual frame within one second of the target boundary;
- at least 590 analyzable frames for 10 minutes or 890 for 15 minutes;
- successful automatic cleanup.

Record real FPS, full visual-pipeline and cockpit latency, CPU, browser heap,
long tasks, audio continuity/drops, thermal behavior, external network activity,
cleanup, and any Continuous Conversation latency effect. DR-035 defines no
numeric CPU/heap/thermal ceiling, so those observations remain `MEASURED` and
product thresholds remain `UNRESOLVED`; this does not reopen 3420R.

## Accepted deferrals and 3440 hardening

- Representative seated torso/posture behavior: not exercised.
- Controlled second-person suppression remains deterministic-test evidence,
  not a human canary observation.
- Uninterrupted 10--15 minute real-camera/WASM performance, privacy, continuity,
  thermal, and cleanup evidence.
- Safari and responsive viewport review.
- Keyboard, screen-reader, zoom, contrast, and broader accessibility acceptance.

Founder directed that these do not hold 3420R open. They remain normal admin
canary or 3440 hardening and must not be relabeled as completed. No production
deployment, canonical merge, ordinary-student activation, or registry
promotion is authorized by this validation report.
