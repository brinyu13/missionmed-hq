# Y1-Y2-CAM-V6-3521 Metric Support Matrix

Audit date: 2026-08-21

Runtime: IV Prep On-Call Live Analytics

Route: `/iv-prep-on-call/live-analytics/`

## Release truth

- Normal live mode uses the local camera/microphone pipeline. It does not generate deterministic values.
- Deterministic values exist only at the visibly labelled localhost QA route: `?testInput=deterministic-local-signals`.
- Physical speaking speed/WPM is **UNAVAILABLE** because normal mode has no validated observed word-timing producer.
- The projector fails WPM closed to `NO_TRUSTWORTHY_TRANSCRIPT_TIMING`; it does not estimate WPM from RMS, pitch, timers, or fixture data.
- The physical human camera/microphone acceptance exercise has **NOT RUN**. Automated and deterministic-fixture results are not physical acceptance evidence.
- No raw frames, PCM, landmarks, blendshape arrays, transcript text, embeddings, or biometric identity data are persisted by this runtime.
- There is no external analytics/provider egress path. The live document has `connect-src 'self'`; workers restrict fetch/XHR to same origin for vendored models/WASM.
- Analytics/media evidence is not persisted. Local storage contains only versioned, allowlisted presentation visibility IDs.
- Provider sessions: **0**.

## Maturity vocabulary

| Maturity | Meaning |
|---|---|
| MEASURED | Directly derived from the indicated local sensor signal with a bounded algorithm. |
| OBSERVABLE PROXY | Derived from observable geometry or face channels; it must not be interpreted as emotion, intent, attention, diagnosis, or quality. |
| UNAVAILABLE | No validated normal-live producer/detector exists; the UI must show an unavailable state. |
| DETERMINISTIC QA ONLY | Synthetic, visibly labelled localhost test input used to exercise production projectors and presentation code. |

## Per-metric matrix

| Visibility ID / metric | Engine | Normal-live source | Update rate | Maturity | Current boundary / notes |
|---|---|---|---|---|---|
| `head-face.region-status` | MediaPipe Holistic worker + FaceFamily cartridges + compact projector | Local camera; transient face landmarks/blendshape channels | Accepted vision frames; target 8 fps | OBSERVABLE PROXY | Center face mesh is a transient worker-rendered bitmap. The left scan is explicitly labelled `COMPACT GEOMETRY PROXY`; it is not a literal landmark map or identity signal. |
| `head-face.smile-pattern` | FaceFamily `FACE.SMILE` and periocular observable channels | Local camera face channels | Accepted vision frames; target 8 fps | OBSERVABLE PROXY | Reports observable mouth-corner elevation/periocular contraction only. Genuine-smile, affect, and emotion classification remain unavailable. |
| `head-face.smile-events` | FaceFamily bounded event summary | Local camera face channels | Accepted vision frames; summary advances on events | OBSERVABLE PROXY | Counts observable smile-pattern events. It is not a “genuine smile” count. |
| `head-face.camera-facing-balance` | Camera-relative gaze dwell + face orientation proxies | Local camera compact geometry/face channels | Accepted vision frames; target 8 fps | OBSERVABLE PROXY | Camera-facing/off-camera balance only. It does not prove eye contact, attention, or a gaze target. |
| `head-face.blink-rate` | FaceFamily `FACE.BLINK` event summary | Local camera face channels | Accepted vision frames; rolling event/minute summary | OBSERVABLE PROXY | Requires at least one second of observed history; not a clinical measure. |
| `head-face.speaking-pace` | LiveMetricProjector transcript-timing gate | No normal-live producer | None in physical mode | UNAVAILABLE | Mirrors speaking-speed/WPM when trustworthy timing exists. Deterministic QA supplies labelled aggregate windows every approximately 2 seconds after warm-up; that is not physical evidence. |
| `head-face.head-nods` | No validated detector | None | None | UNAVAILABLE | UI reason: `NO_VALIDATED_HEAD_NOD_DETECTOR`. Orientation movement must not be relabelled as nods. |
| `head-face.geometry-trend` | Bounded face movement-variability history | Local camera compact face geometry | Accepted vision frames; target 8 fps | OBSERVABLE PROXY | Bounded derived-scalar history only; no landmark retention. |
| `body-posture.wireframe` | MediaPipe Holistic worker + compact body projector | Local camera pose/hand landmarks | Accepted vision frames; target 8 fps | OBSERVABLE PROXY | Center pose/hands overlay is transient and person-following. The left diagram is explicitly a compact-geometry proxy, not stored raw landmarks. |
| `body-posture.alignment` | Compact pose geometry | Local camera body center, shoulder width, lateral-lean proxy | Accepted vision frames; target 8 fps | OBSERVABLE PROXY | Describes geometric centering/lateral lean; it is not a posture score or medical assessment. |
| `body-posture.in-frame` | Holistic presence geometry under primary-person lock | Local camera torso/hand presence | Accepted vision frames; target 8 fps | MEASURED | Observable presence only. It fails closed during primary-lock ambiguity, occlusion, or camera loss. |
| `body-posture.hands-visible` | Holistic hand-landmark presence | Local camera left/right hand geometry | Accepted vision frames; target 8 fps | MEASURED | Reports left/right/both observed. It does not infer what the hands are doing. |
| `body-posture.gesture-activity` | Hand-region activity tracker | Local camera compact hand geometry over time | Accepted vision frames; target 8 fps | OBSERVABLE PROXY | Reports observed left/right/both hand-region activity and bounded event count; no gesture meaning or intent classification. |
| `body-posture.movement-level` | Compact geometry temporal delta | Local camera pose/hand deltas | Accepted vision frames; target 8 fps | OBSERVABLE PROXY | Normalized motion proxy only; not “fidgeting.” |
| `body-posture.repetitive-movement` | No validated classifier | None | None | UNAVAILABLE | `fidgetClassification` remains unsupported. No percentage or behavioral interpretation is synthesized. |
| `body-posture.notes-detection` | No validated detector/proxy | None | None | UNAVAILABLE | Note-taking classification is not inferred from downward gaze or hand motion. |
| `body-posture.movement-trend` | Bounded compact-geometry delta history | Local camera pose/hand deltas | Accepted vision frames; target 8 fps | OBSERVABLE PROXY | Stores bounded derived scalar history only. |
| `body-posture.notes-confidence` | No validated notes detector | None | None | UNAVAILABLE | UI must state no validated proxy; no confidence value is generated. |
| `voice-delivery.volume` | Web Audio analyser + `measurePcmFrame` + LiveMetricProjector | Local microphone PCM frame, converted to RMS/dBFS | Every 50 ms while microphone/AudioContext are live | MEASURED | Genuine captured level. Fails closed on mute, ended track, suspended audio graph, or missing RMS. |
| `voice-delivery.speaking-speed` | LiveMetricProjector trusted timing entrance | No normal-live observed word-timing producer | None in physical mode | UNAVAILABLE | **Sole known implementation blocker.** Deterministic QA produces visibly labelled 120 WPM test timing; it cannot be cited as physical WPM. |
| `voice-delivery.volume-modulation` | Bounded RMS envelope history | Local microphone RMS history | Every 50 ms after sufficient history | MEASURED | Vocal-energy variation, not decorative raw waveform. Requires at least 12 valid RMS frames. |
| `voice-delivery.pitch` | Periodicity-based `estimateF0` + rolling `PitchTrack` | Same local microphone PCM frame used for RMS | Every 50 ms; only voiced/clear frames contribute | MEASURED | Speaker-relative semitone register against the speaker's rolling median. No universal “good pitch” target. |

## Shared runtime safeguards

- Person-derived vision metrics are released only while the anonymous session-local primary lock is `PRIMARY_LOCKED`; ambiguity, bystanders, occlusion, and loss fail closed.
- Camera mute/end retains a bounded recovery poll. The first accepted recovered frame closes the observation gap; camera switching preserves the active pipeline/session clock and reselects the primary person.
- Face, hands, body, and framing overlays have four independent worker gates. Legacy face/body-hands instrumentation remains compatible.
- Overlay bitmaps are transient, cover-fitted to the student video, cleared on unavailable/hidden/finish/destroy states, and closed after consumption.
- Presentation visibility never controls capture, inference, counters, or bounded metric histories.

## Evidence snapshot

Worktree HEAD: `6857fb48e5f7c7408d747bd1cae212e69b6dfee1` with scoped uncommitted 3521 changes.

Key audited SHA-256 values:

- `public/live-analytics/live-analytics.mjs`: `aa66d5b8db93c4b43fc7c95405884e3c5065700dcf7baf6f393036343ef94f48`
- `public/live-analytics/media-bridge.mjs`: `9ca97534356bdc5bb422212380349d7114f20f98f9c43ac746e59e7e65c19c81`
- `public/live-analytics/live-metric-projector.mjs`: `b3f6b08740acf283cd128f85361310ed4ef34ade239bc39d88b611a7994f728d`
- `public/analytics/browser-pipeline.mjs`: `778a5418ceca2fb970997daad5f03734defff79be7e6c7ff226510282dd4baf0`
- `public/analytics/holistic-worker.mjs`: `e5f16fb200ea5ae3c534a389e53391eea3cf3f9591e889fc058ff27852e84ffd`
- `public/live-analytics/hud-renderers.mjs`: `b97f9e9f8eabe7037bb17fd4113232469848458eb5058ab883385cfced773009`
