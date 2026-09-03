# 3528C Real Analytics Acceptance

## Architecture under the frozen HUD

`app/real-runtime.mjs` requests the real camera/microphone through `media-bridge.mjs`, starts the production analytics pipeline, feeds `LiveMetricProjector`, `BehaviorIntelligenceRuntime`, and `LocalTranscriptTimingProducer`, and projects only observed/derived values into the frozen 3528B displays. Unavailable input remains unavailable.

| Signal | Real source | Deployment state | Acceptance |
|---|---|---|---|
| Pace/WPM | Local Sherpa streaming recognizer, timestamped words, rolling projector | `LOCAL_SHERPA_WORD_TIMING_LIVE` observed after packaging fix | Engine PASS; human slow/normal/fast comparison PENDING |
| Volume | Web Audio microphone diagnostics; speech-gated loudness | Real microphone track and changing stimulus observed | Device/source PASS; human quiet/normal/loud matrix PENDING |
| Pitch/F0 | Real voiced-frame F0 from audio pipeline | Real implementation deployed; unvoiced gaps retained | Final human voiced/unvoiced acceptance PENDING |
| Vocal Variety | Speaker-relative modulation derived from real pitch/loudness history | Real derived path deployed | Human monotone/normal/exaggerated comparison PENDING |
| Vocal Variation graph | Time-aligned real Volume/Pitch/Pace history with null gaps | Deployed | Source/renderer PASS; full human trace QA PENDING |
| Head/face | MediaPipe/browser face detector and face-family diagnostics | Deployed and camera track acquired | Human movement acceptance PENDING |
| Smile events | Observable mouth/cheek/periocular pattern logic, not emotion | Deployed | Physical pattern acceptance PENDING |
| Listening nods | Behavior-state-aware head-nod events | Deployed | Physical listening/speaking comparison PENDING |
| Body/hands | MediaPipe pose/hands diagnostics | Deployed | Human one/both/hidden/gesture acceptance PENDING |
| Gestures | Derived observable gesture units with event counts/rate | Deployed | Physical low/effective/excessive comparison PENDING |
| Conversation state | Behavior Intelligence runtime consuming audio/vision/timing evidence | Deployed | Automated contract PASS; human state sequence PENDING |
| Coaching/corridors | Deterministic score/cue mapping over persisted calibration | Deployed; coaching toggle presentation-only | Contract PASS; human usefulness PENDING |

## WPM root-cause closure

The recognizer itself was not the final production defect. The Railway upload builder omitted the tracked `tokens.txt` because the repository root ignores `*token*`. The model container therefore lacked the vocabulary file and could not start. Commit `7d7ff104` renamed that tracked artifact to `vocabulary.txt` and updated the worker plus vendor manifest. Container/browser verification then reported `LOCAL_SHERPA_WORD_TIMING_LIVE`.

Synthetic system speech did not yield a defensible final WPM reading through the laptop microphone. No number was fabricated. A person must still speak slow, normal, and fast phrases into the deployed runtime to accept the semantic speedometer behavior.

## Evidence

- `LOCAL_REAL_CAMERA_MIC_LIVE.png`: local real device acquisition candidate.
- `PRODUCTION_ADMIN_HOME.png`: authenticated production Admin shell.
- `PRODUCTION_FINAL_REAPPLY_HOME.png`: authenticated production UI after rollback/reapply.

## Verdict

Real engines are integrated and deployed. Final physical acceptance remains pending because no human remained available for the required actions and the camera view did not contain a visible subject during unattended verification.
