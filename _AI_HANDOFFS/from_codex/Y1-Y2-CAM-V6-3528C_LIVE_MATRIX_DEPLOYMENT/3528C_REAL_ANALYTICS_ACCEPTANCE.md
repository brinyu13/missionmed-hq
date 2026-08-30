# 3528C Real Analytics Acceptance

## Architecture under the frozen HUD

`app/real-runtime.mjs` requests the real camera/microphone through `media-bridge.mjs`, starts the production analytics pipeline, feeds `LiveMetricProjector`, `BehaviorIntelligenceRuntime`, and `LocalTranscriptTimingProducer`, and projects only observed/derived values into the frozen 3528B displays. Unavailable input remains unavailable.

| Signal | Real source | Production evidence | Acceptance |
|---|---|---|---|
| Pace/WPM | Local Sherpa streaming recognizer, timestamped words, rolling projector | `LOCAL_SHERPA_WORD_TIMING_LIVE` observed | Engine PASS; human slow/normal/fast PENDING |
| Volume | Web Audio microphone diagnostics; speech-gated loudness | Real microphone track acquired | Device/source PASS; human quiet/normal/loud PENDING |
| Pitch/F0 | Real voiced-frame F0 from audio pipeline | Real implementation deployed; unvoiced gaps retained | Human voiced/unvoiced PENDING |
| Vocal Variety | Speaker-relative modulation from real pitch/loudness history | Derived path deployed | Human monotone/normal/exaggerated PENDING |
| Vocal Variation graph | Time-aligned Volume/Pitch/Pace history with null gaps | Source/renderer deployed | Full human trace QA PENDING |
| Head/face | MediaPipe/browser face detector and face-family diagnostics | Camera track acquired | Human movement PENDING |
| Smile events | Observable mouth/cheek/periocular pattern logic, not emotion | Deployed | Human pattern PENDING |
| Listening nods | Behavior-state-aware head-nod events | Deployed | Human listening/speaking comparison PENDING |
| Body/hands | MediaPipe pose/hands diagnostics | Deployed | Human one/both/hidden/gesture PENDING |
| Gestures | Derived observable gesture units with counts/rate | Deployed | Human low/effective/excessive PENDING |
| Conversation state | Behavior Intelligence consuming audio/vision/timing evidence | Automated contract PASS | Human state sequence PENDING |
| Coaching/corridors | Deterministic mapping over persisted calibration | Contract PASS | Human usefulness PENDING |

## WPM production state

The Railway vocabulary packaging defect is closed: the tracked Sherpa vocabulary is packaged and the production worker reports live readiness. In the final physical session the user was asked to speak slow and fast phrases, but no speech was observed by the runtime, so no comparative WPM result was claimed. The unresolved gate is human signal observation/acceptance, not a fabricated fallback or placeholder producer.

## Evidence

- `LOCAL_REAL_CAMERA_MIC_LIVE.png`: earlier local real-device acquisition candidate.
- `PRODUCTION_ADMIN_HOME.png`: authenticated production Admin shell.
- `PRODUCTION_FINAL_REAPPLY_HOME.png`: authenticated production UI after the earlier rollback/reapply rehearsal.

## Verdict

Real engines are integrated and deployed. Real camera/microphone acquisition and production recording are accepted. Semantic human response for voice and CV metrics remains pending.
