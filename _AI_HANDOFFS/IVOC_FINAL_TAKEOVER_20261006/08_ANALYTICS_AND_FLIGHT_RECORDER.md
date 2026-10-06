# Analytics and Flight Recorder

Protect current right-rail Pace/Volume/Pitch/Variety visuals. Fix measurement/coaching underneath them. No new instrument redesign.

## Real producer map

| Signal | Producer / unit / rolling-validity | Consumer / durable boundary |
|---|---|---|
|Volume | analytics/audio-signal.mjs + worklet PCM, real-runtime/live projector; RMS→dBFS, speech LUFS-K where supported;50ms analyzer cadence, startup noise-floor calibration/speech gating | rails/reducer; personal corridor only when valid baseline; scientific units retained. Don't call normalized0–10 an acoustic unit. |
|Pace | live-analytics/local-transcript-timing.mjs + analytics/word-timing-ladder.mjs/turn-metrics.mjs; WPM from valid timed words and answer ranges | rails/trace/full review; withhold insufficient/ambiguous timing, no phrase-count substitute. |
|Pitch | analytics/pitch-f0.mjs; voiced F0Hz and semitones from speaker median; current rolling1800frames statistics and coverage use SAME retention | real-runtime rails/arbiter/trace; silence/rejected frames lower coverage. Personal corridor requires calibration. |
|Variety | real-runtime vocalVarietyProjection, measured pitch variation semitones + loudness modulation/range dB; qualified minimum voiced frames | rails/trace, normalized display score; NOT confidence/enthusiasm/emotion. |
|Face/head/facing | analytics/face-detector-worker.mjs, face-family.mjs, orientation-state.mjs; finite landmarks/orientation proxies/quality and primary identity lock | left rails/overlays/evidence; withhold ambiguity/poor pose/occlusion; no true eye-gaze. |
|Smiles | smile-pattern.mjs/facial-activity.mjs with qualifying geometry/pose/presence and quality | observed pattern/count only; no emotional interpretation, unavailable is not zero. |
|Nods | nod-detector.mjs head-pitch cycle with valid temporal/cadence support | count/time marks; motion doesn't imply agreement/personality. |
|Hands/gesture/body | behavior-intelligence-runtime.mjs, gesture-units.mjs, media bridge detector evidence | visible hand/finger/pose landmarks, visibility/movement/gesture units when supported; missing/crop/identity ambiguity explicit. |
|Framing/presence | live projector + primary-lock/media geometry | supported relative presence/facing/framing; overlay uses exact video crop/mirror coordinate conversion. |
|Conversation/question/turn | canonical native events + native-observer/interview progression | state/marks; observed/partial ≠ completed/audible. |
|Recording/hook/coaching/gaps | admitted recorder state, canonical hook evidence, CueArbiter, sampling-gap timestamps | semantic lanes/teaching; no invented continuous coverage across null gaps. |

Public paths above under ivprep-v6/public. Engine is ivoc-standalone/app/real-runtime.mjs; canonical personal BaselineStore in live-analytics/baseline-store.mjs. Fable engine-adapter reuses that engine. CalibrationResolutionStore is presentation metadata, NOT a competing baseline authority. Device/config/subject/version/freshness invalidate incompatible calibration.

Primary candidate lock must persist through another person entering. Ambiguous primary evidence withholds person-specific metrics; explicit recovery/reselect then stable lock. Do not add biometric identity storage. Physical challenge remains open.

One-correction-at-a-time coaching arbitration via live-analytics/cue-arbiter.mjs. Pitch should teach measured variation/range/flatness/emphasis only where supported, not stay generically NOT COACHED or infer psychological traits.

## Trace / recorder

studio-fable/app/model/trace-reducer.mjs maps real engine frames to nullable normalized live-display values; scientific WPM/loudness/F0 retained separately. TraceHistory cadence0.5s, retain7200, later decimation; no fake density through missing samples.

12semantic solid-band lanes: VOICE, CONVERSATION STATE, HAND VISIBILITY, FRAMING/PRESENCE, GESTURES, SMILES, HEAD NODS, COACHING, QUESTION/TURN, HOOKS, RECORDING, SIGNAL GAPS.

Live: compact, low distraction, shared session/capture clock.
Film Room: expanded, inspectable, seek synchronized to persisted media/transcript/evidence. Hook-followed and question boundaries must describe actual qualified events.

Live overlays: optional Student Coached/authorized Admin; hide/show doesn't stop measurement. Replay requires persisted timestamped landmark evidence and correct crop/time. No landmarks retained means truthful unavailable, not rerun fabricated overlay on old recording. Current moving finger/subject alignment acceptance still open.

## Additive SHOULD

Retain NOW gauge + TARGET calibrated/personal corridor; optionally add compact SO FAR distribution/density for Pace/Volume/Pitch from qualified session samples. An average hides extremes; distribution must disclose coverage/voicing/gaps. Film Room may be richer. No replacement gauges, new inference, broad refactor or delay to required gates.

Required regression: pitch-coaching.test.mjs, hook/review/film lanes, camera-frame/media bridge and calibration tests. Real physical coaching/overlay visibility is not accepted from detector output/mocks.
