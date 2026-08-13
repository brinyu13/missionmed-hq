# Y1-Y2-CAM-V6-3466C-R1 Feasibility Handoff

Status: **HUMAN TEST READY — PHYSICAL DEVICE GATE OUTSTANDING**  
No production deployment, provider credits, external analytics service, or production runtime dependency was used.

## Run the exact candidate

```sh
cd /Users/brianb/MissionMed_worktrees/Y1-Y2-CAM-V6-3466C/ivprep-v6/experience-lab/3466c-r1
python3 -m http.server 8467 --bind 127.0.0.1
```

Open in Chrome:

`http://127.0.0.1:8467/Y1_Y2_CAM_V6_3466C_R1_PROTOTYPE.html`

The localhost server is required for browser media permissions, workers, ES modules, WASM, and local model assets. `file://` is not a supported acceptance context.

## Authority and custody

- Canonical MissionMed OS registration commit: `f4a1cc8614b0b329feebdde21ed21dc65fd7dbe4`
- Mission authority: DR-063
- Bounded MR-079 execution amendment: DR-064
- Scoped writer: `PRODUCT:IV-PREP-ON-CALL`
- Product write target: `/Users/brianb/MissionMed_worktrees/Y1-Y2-CAM-V6-3466C`
- 3420R: READ-ONLY DONOR
- 3440: READ-ONLY DONOR
- StoryForge files and authority were not modified.

## Accepted analytics donor

The accepted implementation is commit `e24a68bc5e90b126c2c08ab30011aa2cf6fab7a9` (“Add Founder analytics reports and local overlay controls”) in the 3420R donor. The donor's closeout HEAD inspected for this integration was `70352b0a0f47ebe20793a583d4f734a5328f8ee6`.

All runtime bytes below were copied from `ivprep-v6/public/` in the 3420R donor and are verified byte-for-byte by `validate.mjs`.

### Analytics modules

| Destination under `3466c-r1/` | SHA-256 |
|---|---|
| `analytics/browser-pipeline.mjs` | `133e48f5d57dd7aa353d4c5049d8c82b0e3c7af75c8d52846220664c7c1f15b8` |
| `analytics/analytics-session.mjs` | `5ea6f2d8c25d2a9e95c84a471133fccd22f4046f63a2e76c807f5b532760388e` |
| `analytics/audio-signal.mjs` | `c2ee252d2b513dbddd9231169981d82a53ec0cdc5990466f7a5dda3a71cd4634` |
| `analytics/episode-detectors.mjs` | `0a5d4dc9fbf05ec8d60facb01fb19667c27c1e2c525d326f52122f207440f3d1` |
| `analytics/event-contract.mjs` | `e3ad4ce05ccf89672f1636e32a6778efc4b59f7addaff3cb9f6f91ecc780799d` |
| `analytics/session-clock.mjs` | `eb7d5387c3d2342ca14d365333b07192f6a496edbdbb7ea11d20b633afc13997` |
| `analytics/signal-registry.mjs` | `f88db0276e1fda2cafb4affff83453939db7b022d6767c65ad114223ac1454e2` |
| `analytics/vision-geometry.mjs` | `88507bf5e47e25bd5f9786c9878d8fe3540b56b3b6ce49a4121634f992d7915f` |
| `analytics/holistic-worker.mjs` | `d9b2c5ad24bd269a6079309f85f46478d6d96f808c5e9ecc5e45b1fcae4d0fcc` |
| `analytics/face-detector-worker.mjs` | `3e2b87f3173f65b8dd02262c34c164f7f835f9291eadd88376bbe25b8970b513` |
| `analytics/playback-overlay.mjs` | `75ba00417af66bcc51fc41ae30a1bb46e58364b6824801ceb51561378526d881` |

### Local MediaPipe runtime and models

| Destination under `3466c-r1/` | SHA-256 |
|---|---|
| `vendor/mediapipe/LICENSE` | `cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30` |
| `vendor/mediapipe/NOTICE.md` | `c1ff832e19891218e256c317da15a1fcd709c30fc223b7e8cbcff7ef679d9e0e` |
| `vendor/mediapipe/models/face_detector/blaze_face_short_range/float16/latest/blaze_face_short_range.tflite` | `b4578f35940bf5a1a655214a1cce5cab13eba73c1297cd78e1a04c2380b0152f` |
| `vendor/mediapipe/models/holistic_landmarker/float16/1/holistic_landmarker.task` | `e2dab61191e2dcd0a15f943d8e3ed1dce13c82dfa597b9dd39f562975a50c3f8` |
| `vendor/mediapipe/tasks-vision/1.0.1/vision_bundle.mjs` | `d885630c297c0b20b1fe86096cb06291c4c8080876f27852e724f24ac603713f` |
| `vendor/mediapipe/tasks-vision/1.0.1/wasm/vision_wasm_internal.js` | `e170ee67dd4e16c1a6fcd8840a206687e5a59b22c20e4a902bc445b095454d73` |
| `vendor/mediapipe/tasks-vision/1.0.1/wasm/vision_wasm_internal.wasm` | `8da277a733926eacd0474b8704b36742d6ec3231c57a860c5b889dff8f1df886` |
| `vendor/mediapipe/tasks-vision/1.0.1/wasm/vision_wasm_module_internal.js` | `da8934057f147b622e82cfb4c0dbd85461c598e268588b5a8ba9ca963a8ff82d` |
| `vendor/mediapipe/tasks-vision/1.0.1/wasm/vision_wasm_module_internal.wasm` | `2dabd8e23c60984628beb7bb338764c81a08e6837145273f59578684b5d53c1b` |
| `vendor/mediapipe/tasks-vision/1.0.1/wasm/vision_wasm_nosimd_internal.js` | `e81d715a3d42cc3373602eb2f7aff795d164934db680e32496b65dab537f9658` |
| `vendor/mediapipe/tasks-vision/1.0.1/wasm/vision_wasm_nosimd_internal.wasm` | `a28483cd42e74e855bf5ebdb6b40d9b66a5b49e35e95020bc97669e6822a3192` |

No donor files were edited. No 3440 bytes were copied; 3440 remained coordination/experience evidence only.

## Runtime architecture

1. One explicit `getUserMedia` call requests a real camera track and a real microphone track.
2. The same stream drives the visible video, Web Audio analyser, optional in-memory `MediaRecorder`, and accepted `BrowserAnalyticsPipeline`.
3. The pipeline owns one `AnalyticsSession` and one monotonic session clock. Coach, Telemetry, overlays, flight-recorder events, and mentor annotations project from that session.
4. Holistic and face workers consume frames locally. The accepted worker draws to an `OffscreenCanvas`; only an overlay bitmap and bounded signal/event data cross back to the UI.
5. FACE and BODY + HANDS change instrumentation on the existing pipeline. They do not recapture devices or create a second analytics truth.
6. Optional replay creates a tab-local object URL only after consent. The original recorded media stays distinct from a new local replay-overlay pass.
7. End/erase destroys live and playback workers, disconnects Web Audio, stops every track, closes the `AudioContext`, stops the recorder, revokes the object URL, clears canvases, and clears the bounded event array.

The Content Security Policy allows only local resources and local workers. No `fetch`, XHR, WebSocket, beacon, storage database, CDN, or external analytics transport exists in the artifact.

## Measurement truth table

| Signal | R1 truth | Notes |
|---|---|---|
| Webcam video + microphone audio | REAL NOW | Physical Founder acceptance still outstanding. |
| Answer/session clock | REAL NOW | Accepted monotonic analytics clock. |
| Captured RMS/dBFS, peak, digital clipping | REAL NOW | Validated student-safe where donor registry says so; no PCM is persisted. |
| Face detector/count | REAL DETECTOR | Multiple-person guard is real; person-level interpretation remains experimental. |
| Speech activity, silence, pause | EXPERIMENTAL | Real microphone-derived detector; not transcript-ground-truthed and purpose is never inferred. |
| Face/torso/left hand/right hand visibility | EXPERIMENTAL | Real model output, camera-relative, availability-sensitive. |
| Head yaw/pitch/roll and framing | EXPERIMENTAL | Camera-relative geometric proxies, not eye contact or diagnosis. |
| Gesture/head/posture episodes | EXPERIMENTAL | Bounded donor episodes, not semantic gesture or posture scores. |
| Pitch/F0, WPM, smile/emotion, eye contact, posture score | NOT AVAILABLE | UI labels these unavailable; no live claim. |
| Strategy phases and sample replay | SAMPLE/DEMO | Explicitly watermarked product-story material. |
| Coaching Director language interpretation | PROTOTYPE SIMULATION | Local deterministic parser; no remote AI model claim. |

## Automated and browser verification

Automated suite:

- `node --check` passes for `app.mjs`, `validate.mjs`, and every copied analytics module.
- `node --test --test-concurrency=1 validate.mjs`: **11/11 PASS**.
- Donor hashes, local-only CSP, fail-visible unsupported `file://` launch, explicit media start, single-pipeline projections, independent layer controls, unsupported-metric labels, cleanup coverage, responsive accessibility, recorder clock/navigation, privacy, and strict-CSP timeline geometry are covered.
- Localhost HTTP probe: **200 OK**.

Chrome browser checks before the physical gate:

- Student and Dr Brian ready states render correctly.
- Simulation and Live Coaching mode selection works.
- Coaching Director compiles a profile and requires confirmation.
- SAMPLE film room is visibly watermarked and exposes 13 synchronized tracks.
- WHOLE INTERVIEW → QUESTION → PHASE → EXACT MOMENT navigation works.
- Spotlight and mentor-marker interactions work.
- Coach/Telemetry and overlay controls are present as independent semantic controls.
- Mobile ready and film-room views have no horizontal overflow; mobile controls meet the intended target sizes.
- Strict CSP no longer collapses recorder events; sample phase/event positions resolve to distinct computed positions.
- Chrome console contains no candidate-origin errors or warnings at the final automated checkpoint.
- End + erase returns to Ready with no video `srcObject` and no replay URL.

Automated/headless evidence cannot prove the Founder's face, voice, movement, or physical device indicators. Those checks are intentionally withheld from PASS.

## Bounded Founder acceptance

After the Founder types `READY`:

1. Select Live Coaching and optionally consent to tab-memory replay.
2. Click **Connect camera + mic** and grant both Chrome permissions.
3. Confirm the Founder's real video appears.
4. Speak at quiet, normal, and louder levels; confirm captured level changes and clipping remains truthful.
5. Move head and shoulders; confirm face/body overlay follows where the donor detects them.
6. Bring left hand, right hand, and both hands into frame; confirm the overlay/availability signals follow supported landmarks.
7. Toggle FACE off/on and BODY + HANDS off/on independently.
8. Switch Coach ↔ Telemetry and confirm video, session clock, and session identity continue without restart.
9. Finish the take; if consented, verify original replay plus separately generated overlay and exact-moment seeking.
10. End + erase; confirm camera/microphone indicators turn off and the page reports cleanup.

Only after all ten observations may the candidate be called BAKE-OFF READY.

## Dr Brian / Webex coexistence recommendation

### Recommended

MissionMed should own the selected student's capture and evidence session. Dr Brian shares the MissionMed teaching surface into Webex, but Webex should not be treated as the analytics source of truth.

Best order of preference:

1. **MissionMed-native student capture + Webex screen share/audio-only teaching.** One camera/mic stream and one analytics clock; strongest evidence integrity.
2. **MissionMed student capture while Dr Brian uses Webex on a separate device or separate mentor device.** Avoids camera contention and reduces echo risk.
3. **Webex owns the live call; MissionMed receives a consented recording afterward.** Useful for retrospective teaching, but not equivalent to live synchronized analytics.

### Engineering realities

- Browsers and Webex may contend for camera/microphone access, device formats, auto-gain control, and echo cancellation. MissionMed cannot silently reuse Webex's private capture stream.
- Never issue a second `getUserMedia` call merely because the UI changes projection. Clone tracks only inside a single MissionMed-owned session when an internal consumer requires it.
- If Webex and MissionMed both render live audio on one machine, route one audible return, prefer headphones, and test echo cancellation. Muting a preview element does not mute the captured microphone track.
- Model inference competes for CPU/GPU and uplink video competes for bandwidth. Use adaptive analytics FPS, preserve call audio first, and mark observation gaps instead of inventing evidence.
- Screen-share latency and remote-call latency are not the analytics clock. Mentor annotations must bind to MissionMed's local monotonic clock and later map to media time.
- Mobile browsers may suspend background tabs and enforce stricter capture rules. The MissionMed capture tab must remain foregrounded during a live student take.
- Consent must separately cover live capture, local/remote recording, derived analytics, mentor annotations, and future Vault association.

## Production recording and Vault path

R1's tab-memory recorder is intentionally not production storage. A robust future architecture should:

1. Keep one immutable original media object and a separate versioned evidence envelope.
2. Chunk-upload encrypted media under explicit consent, with retry and gap markers; never block the live teaching path on upload.
3. Record the monotonic session clock, media start offset, question/phase boundaries, analytics engine/version, focus-profile version, and every mentor annotation.
4. Store overlays as reproducible versioned evidence or render instructions, not burned into the only media copy.
5. Associate the future Vault record with opaque student/interview/question/media/evidence IDs, consent version, strategy-pack version, model hashes, checksums, and retention policy.
6. Permit later re-analysis to create a new evidence version while preserving the original media and the prior interpretation.

An imported Webex recording should be labeled `EXTERNAL_SOURCE`, aligned with an explicit sync event or bounded offset, and never backfilled as if it carried live MissionMed timestamps.

## Remaining work after the human gate

- Production consent, identity, encrypted upload, retention, and Vault schemas.
- Real transcript integration before WPM or semantic speech metrics.
- Accuracy/calibration studies before experimental signals become student-safe.
- Primary-person lock behavior from the 3440 design when multi-person live coaching enters product scope.
- Native call architecture or a formally supported Webex operating mode.
- Real AI service integration for Coaching Director, with structured confirmation and deterministic enforcement preserved.
