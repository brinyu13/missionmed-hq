# Y1-Y2-CAM-V6-3420R validation report

## Classification

**IMPLEMENTATION AND DETERMINISTIC VALIDATION PASS**

**BROWSER RUNTIME INITIALIZATION PRIVACY PROBE PASS**

**REAL CAMERA/MICROPHONE HUMAN ACCEPTANCE AND REAL WASM ENDURANCE UNRESOLVED**

## Automated evidence

Executed from `ivprep-v6` on 2026-08-10:

| Check | Result |
| --- | --- |
| `npm run check` | PASS; 26 analytics modules syntax-checked |
| `npm test` | PASS; 123/123 total tests |
| `npm run analytics:validate` | PASS; 56/56 analytics tests |
| Fixture execution | PASS; 5/5 sealed files and 25/25 cases consumed |
| Fixture manifest SHA-256 | `5b4ef2c8666382eb36b92428fe2e1162586f95e71fb2e56aff3f8eba7b63a765` |
| Captured-level maximum absolute error | 0 dB on the sealed synthetic grid |
| Digital-clipping precision / recall | 1.0 / 1.0 on the sealed synthetic grid |
| Clock/media-alignment maximum error | 0 ms on the sealed synthetic grid |
| `npm run analytics:privacy` | PASS; static source/persistence boundary |
| `npm run analytics:performance` | PASS; 900-second synthetic compact-geometry workload |
| Synthetic performance | 7,200 frames; 89 events; 70,005-byte envelope; 26 ms injected inference p95 |
| `npm run analytics:assets` | PASS; all 9 runtime/model assets match size and SHA-256 |
| `npm ls --depth=0` | PASS; exact MediaPipe 1.0.1 plus unchanged LiveKit/ws dependencies |
| `git diff --check` | PASS |

The validation score script loads and executes every declared fixture case. A
manifest/file hash seal alone is not treated as measured validation.

## Deterministic regression coverage

Coverage includes:

- event immutability, schema/range/unit checks, raw-payload adversarial keys,
  encoded payloads, prohibited inference names, and envelope byte bounds;
- monotonic answer clocks, exact answer/media bounds, stale answer epochs, and
  cross-answer rejection;
- PCM RMS/peak/clipping, mixed loud/quiet capture aggregation, immediate speech,
  steady noise, bounded pause timelines, automatic cadence gaps, startup and
  trailing gaps, and 15-minute audio churn;
- compact geometry, multi-face fail-closed behavior, posture/head/hand episode
  hysteresis, anatomical left/right/both gestures, static-face rejection,
  label-aligned facial change, adaptive 2 FPS cadence, tracking gaps, and
  15-minute visual churn;
- exact student projection, forged envelope rejection, tiny clipping copy,
  minimum duration/coverage, and sealed persistence projection;
- optional integration failure, recorder/object-URL lifecycle source contracts,
  worker egress counts, worker epochs, runtime release, and protected 3410
  navigation literals.

## In-app Browser evidence

The same-origin app was served on isolated verification port 8345; the protected
3410 processes on their existing ports were not stopped or replaced.

The live MediaPipe browser privacy page was held across the package telemetry
boundary and reported:

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

The current MissionMed Ops → Test Communication Analytics view loaded with all
guided steps, privacy copy, optional replay off, correct disabled controls, and
no Browser console warnings/errors. Default-viewport visual inspection passed.
An earlier 390 × 844 inspection in this run passed before the final
lifecycle-only patches; no analytics CSS changed afterward.

## Truthful limitations

The in-app Browser did not provide a usable camera/microphone permission path,
so no claim is made for a consenting real-person run. The 900-second probe uses
fabricated compact geometry and injected inference durations; it does not run
real camera frames through WASM or measure actual CPU, browser heap, thermal
behavior, main-thread long tasks, audio drops, or 3410 conversation latency.

Founder WPM is intentionally unavailable unless an existing interview
transcript is supplied. The Founder guided test does not silently start browser
speech recognition. Pause/VAD and every visual measure remain Founder-only
until a later consented, held-out, independently rated validation package and
explicit registry promotion exist.

The current lane also omits, rather than fabricates, explicit
no-hands/no-gesture and repetition episodes, forward/back lean,
distance/headroom/lighting analysis, and rolling pacing-change analysis.

## Remaining human acceptance

On a Mac with camera/microphone access:

1. Run `HOST=127.0.0.1 PORT=8420 npm start`.
2. Open `http://127.0.0.1:8420/`.
3. Choose MissionMed Ops → Test Communication Analytics.
4. Grant camera and microphone, run the seven guided steps, and optionally
   enable local replay.
5. Confirm device release after Clear and after navigation.
6. Repeat for 10–15 minutes while observing real FPS, CPU, heap, long tasks,
   audio continuity, thermal behavior, and Continuous Conversation latency.

Until that run is captured, the correct status is Founder-test ready with
real-device hardening remaining—not production AAA complete.
