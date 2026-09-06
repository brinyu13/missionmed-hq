# Y1-Y2-CAM-V6-3522 — CODEX IMPLEMENTATION HANDOFF

**Mission:** Y1-Y2-CAM-V6-3522 → consumed by the next Codex ticket(s) in worktree `Y1-Y2-CAM-V6-3521`
**Date:** 2026-08-24 · **Status:** IMPLEMENTATION CONTRACT (no production code in this document)
**Authority:** the Behavior Intelligence Spec (§n references), the Metric Ontology (row IDs A1…K7), the Composite Indices document. The standalone HTML and the 3521 runtime are implementation evidence, not requirements.
**Non-negotiables carried forward from 3521:** MEASURED ≠ VISIBLE; fail closed; no raw media/landmark/PCM/transcript persistence in the runtime; self-only CSP; primary-person lock; visibility never controls measurement; the Founder-approved three-column composition and scanner plates are preserved as the Delivery Training density.

---

## 0. How to use this handoff

1. Read §1 (architecture deltas) and §2 (state-machine interface) first — every P0 item depends on them.
2. Implement the P0 contracts (§3) in the order listed; each has an acceptance test that must be added to `test/3521/` (or a new `test/3522/`) and must pass in the deterministic fixture **and** be exercised in the physical human acceptance matrix, which has **never been run** for 3521 and remains the release gate.
3. Treat every number marked **[CALIBRATE]** as a config value in one place (`analytics/coaching-config.mjs` or equivalent), never a literal in a detector.
4. The disposition in §7 tells you what to do with every existing module. Nothing in §7 is optional.
5. Do not add Web Speech, a cloud transcript or any provider to make a metric "available"; the tier ladder in P0-08 is the only path.

---

## 1. Architecture deltas to the 3521 module graph

| Module | Keep | Gains | Loses |
|---|---|---|---|
| `media-bridge.mjs` | as-is | requests the measurement track with `{echoCancellation:false, autoGainControl:false, noiseSuppression:false, channelCount:1}`, reads back `getSettings()`, publishes `audioProcessingState`; optionally opens a second default-processed track for ASR; starts the pipeline at *connect* (READY state) | nothing |
| `browser-pipeline.mjs` | orchestration, epochs, watchdogs, recovery | AudioWorklet capture path with `currentFrame` stamping (replaces the analyser 2048-sample 50-ms tick for measurement; analyser may remain for the fixture); VAD lane; state-machine input events; per-answer windows keyed by question id; raises vision target fps to 15 when CPU budget allows (nod detector) | the pinned 8-fps assumption as a hard constant |
| `audio-signal.mjs` | `measurePcmFrame` | K-weighting filter + momentary/short-term loudness; clipping runs already there | `AudioSignalAnalyzer` level-VAD becomes fallback-only |
| new `vad-silero.mjs` (worker) | — | Silero v5 via `@ricky0123/vad-web`, 16 kHz, hysteresis per spec §4.4 | — |
| new `conversation-state.mjs` | — | the state machine (§2) | — |
| `pitch-f0.mjs` | MPM/NSDF | VAD gate, median filter, octave-jump guard, calibration-median reference, 10–20-s semitone SD, P10–P90 | rolling-median-as-reference by default (kept as fallback with `ROLLING` flag) |
| `face-family.mjs` | cartridge/claim-safety design | baseline percentiles from calibration; windowed (not cumulative) summaries; state tags on events; smile-event definition per P0-09; bounded sample buffers | unbounded `samples[]`; per-frame `summary()` recomputation; cumulative dwell ratios |
| `vision-geometry.mjs` | box/hand/torso primitives | head pose from the facial transformation matrix; movement energy in shoulder-width units | linear yaw/pitch proxies as the primary pose source |
| `episode-detectors.mjs` | hysteresis trackers | gesture-unit detector (rest clusters, onset thresholds), speaking-state gating, hands-visible conditioning | nothing (existing trackers remain the coarse activity flag) |
| `holistic-worker.mjs` | privacy guards, ROI inference, overlays | emits transformation-matrix Euler angles; stops rendering overlay bitmaps when all layers are hidden | nothing |
| `live-metric-projector.mjs` | fail-closed discipline, provenance gate | state-tagged windows; confidence vocabulary; corridor/personalization inputs; new metric objects (loudness, orientation, facial activity, gesture units, latency, pauses) | hard-coded windows (160 frames/120 samples); cumulative blink rate; unit-mixing movement level; universal corridors |
| `local-transcript-timing.mjs` | provenance contract pattern, generation fencing | Tier B per-word timestamps on the session clock (§P0-08); VAD-gated windows | the fixed 6-s MediaRecorder window as the only producer |
| new `word-timing-tier-a.mjs` (worker) | — | in-browser timestamped Whisper (Transformers.js v3) with LocalAgreement-2 | — |
| new `syllable-rate.mjs` | — | Tier D estimator (ESTIMATED) | — |
| new `coaching-config.mjs` + `baseline-store.mjs` | — | global defaults, corridors, safety envelopes, per-student baselines (versioned, STALE logic), device profiles | — |
| new `cue-arbiter.mjs` | — | the whisper-cue arbitration engine (§P0-13) | — |
| `visibility-state.mjs` | allowlisted persistence pattern | new ID set (versioned migration), modes SIMULATION / TRAINING / DRILL, densities SIMPLE / STANDARD / LAB | the 22-ID set as a fixed contract (migrate) |
| `hud-renderers.mjs` | canvas discipline | instruments per §7 dispositions; corridor inputs from config; provenance/confidence chips | hard-coded −32…−16 dBFS and 110–160 WPM corridors; four duplicate body rows |
| `live-analytics.mjs` | lifecycle, device switching, QA hook | READY-state pipeline start; mode switching; post-answer card; state-machine wiring; aspect-locked stage | fixture-specific HUD mapping strings |
| `analytics-session.mjs` / `event-contract.mjs` / `signal-registry.mjs` | envelope pattern | per-answer envelopes (keyed by question id) retained in session memory for the card and export; new metrics registered with maturity; prohibited-term list updated so `competence-cue`/`composure-cue` profile *names* are permitted while trait adjectives remain banned | envelope-computed-then-discarded behaviour |
| `index.html` / `live-analytics.css` | composition, scanner plates | live interviewer prompt bound to question-engine events; whisper-cue line adjacent to the interviewer video; aspect-locked stage; visible overlay toggles; post-answer card region | static "Dr. Maya Chen" prompt; hidden `#live-coaching-cue` |

Engineering invariants added: (i) every metric window carries `{state, startMs, endMs, confidence, provenance}`; (ii) no metric is computed outside its ontology states; (iii) corridors/bands/weights live only in `coaching-config.mjs`; (iv) display never mutates baselines or measurements; (v) a hidden overlay layer is not rendered in the worker.

---

## 2. Conversational-state machine — interface contract

### 2.1 Input events (all on the session clock, `atMs`)

```
interviewer.turn.started   {atMs, questionId?, source: 'TTS'|'AVATAR'|'REMOTE_VAD'|'MENTOR_MANUAL'}
interviewer.turn.ended     {atMs, questionId?}
question.boundary          {atMs, questionId, category: 'OPENING'|'TRADITIONAL'|'BEHAVIORAL'|'CV'|'CLOSING'|'SMALL_TALK'|'ANY_QUESTIONS', phase?: 'OPENING'|'MAIN'|'CLOSING'}
student.vad                {atMs, speaking: boolean, prob}          // from vad-silero.mjs after hysteresis
notes.activity             {atMs, kind: 'keydown'|'paste'|'scroll'}  // Tier 0 notes pane (P1); absent in P0
session.started / session.finished
```

### 2.2 States and transitions (spec §4.2)

`SETUP → READY → {INTERVIEWER_TURN | TRANSITION | STUDENT_TURN.{SPEAKING, PAUSE_SHORT, PAUSE_LONG} | OVERLAP.{BACKCHANNEL, TALKOVER}} → FINISHED`, with `NOTES` as an overlay flag and `PHASE` (OPENING/MAIN/CLOSING) as a session-level tag. Transition constants **[CALIBRATE]**: interviewer offset debounce 300 ms; student speech onset 3 VAD frames ≥ 0.5 (~96 ms) after 10 pre-speech frames; speech end 8 frames < 0.35 (~256 ms); PAUSE_SHORT 250–1,000 ms; PAUSE_LONG > 1,000 ms; backchannel ≤ 1,000 ms of student speech inside INTERVIEWER_TURN; TALKOVER ≥ 1,000 ms; TRANSITION ends at student onset or at the next interviewer onset.

### 2.3 Output

```
state.changed {atMs, from, to, questionId, phase}
window.closed {questionId, state, startMs, endMs}        // consumers compute metrics per closed window
```

### 2.4 Degradation

No interviewer channel → two-state model (`STUDENT_SPEAKING` / `STUDENT_SILENT`); every LISTEN/TRANS-dependent metric reports `UNAVAILABLE · NO_INTERVIEWER_CHANNEL`. VAD worker failure → fall back to `AudioSignalAnalyzer` with confidence capped at MODERATE and a `LEVEL_VAD` provenance flag.

### 2.5 Acceptance (deterministic)

Fixture emits a scripted timeline (interviewer on 0–8 s, off; student speech 9.2–40 s with a 1.4-s pause at 20 s and a 0.6-s backchannel at 4 s). Assert: TRANSITION 8.3–9.2 s with latency 0.9 s; PAUSE_LONG at 20–21.4 s; BACKCHANNEL at 4 s; no SPEAKING window overlaps INTERVIEWER_TURN; every closed window carries a state tag; with interviewer events removed, listening metrics are UNAVAILABLE with the reason code.

---

## 3. P0 contracts

Each contract: **Definition · Source signals · State dependencies · Formula · Target behaviour · Unavailable behaviour · UI output · Personalization · Acceptance test.**

### P0-01 Conversational state machine v1 (A8)

*Definition:* §2 above. *Source signals:* first-party interviewer events (the product's TTS/avatar/LiveKit layer must emit them; in the isolated 3521 route a scripted interviewer track in the fixture and a manual "interviewer speaking" toggle for physical tests), Silero VAD, question-engine boundaries. *State dependencies:* none (root). *Formula:* §2.2. *Target behaviour:* every metric consumer subscribes to `window.closed`. *Unavailable:* §2.4. *UI:* the Film Room state ribbon (P1); in P0 the LAB density shows the current state chip. *Personalization:* none. *Acceptance:* §2.5 plus a physical test where the tester reads an interviewer line aloud with the toggle on, then answers; the recorded timeline must show the four states in order.

### P0-02 AudioWorklet capture + Silero VAD + pause/latency metrics (A4, B2, B3, E9, E10)

*Definition:* contiguous 128-frame blocks stamped with `currentFrame`, mapped to the session clock via `getOutputTimestamp()` regression (spec R8 §4.2); VAD at 16 kHz; pauses = VAD silence ≥ 250 ms inside a student turn; long pause ≥ 1.0 s; response latency = `interviewer.turn.ended` → first sustained student onset. *Source signals:* mic track (unprocessed). *State:* pauses in TURN; latency in TRANSITION. *Formula:* counts per minute of turn; mean/P90/longest; latency in ms. *Target:* latency bands ≤ 1.0 s unremarkable / 1–2 s acceptable if bridged / > 2.0 s → post-answer bridge tip **[CALIBRATE]**; no live use except the opt-in BRIDGE cue at > 2.5 s. *Unavailable:* VAD failure → level-VAD fallback (MODERATE); no interviewer events → latency UNAVAILABLE. *UI:* post-answer card items; LAB chips. *Personalization:* bands editable by mentor within 0.5–4 s. *Acceptance:* fixture with known silence layout reproduces pause counts ±0; physical: tester pauses 2 s mid-answer twice → two PAUSE_LONG events; ScriptProcessorNode must not appear in the capture path (grep test).

### P0-03 SETUP audio-signal gate + device check + processing read-back (A4, C7, C8)

*Definition:* before READY→interview, the selected microphone must show ≥ 3 s of VAD speech with momentary loudness ≥ noise floor + 10 dB in a "say a sentence" prompt; clipping runs > 1 % raise `CHECK MIC`; `getSettings()` is read after track acquisition and `{echoCancellation, autoGainControl, noiseSuppression}` are stored in the session record; a flat-envelope check on the calibration passage (short-term loudness SD < 1.5 LU across soft/normal/loud cue lines **[CALIBRATE]**) sets `PROCESSED`. *Target:* the 24 Aug failure mode (−96 dBFS for a full session on "NDI Audio (Virtual)") becomes impossible. *Unavailable:* Safari/unknown AGC → `PROCESSED` badge and relative-dynamics mode. *UI:* setup checklist with pass/fail; Volume instrument badge `PROCESSED` when applicable. *Personalization:* none. *Acceptance:* silent-device fixture blocks Start with reason `NO_AUDIO_SIGNAL`; fake `getSettings()` returning AGC true yields `PROCESSED`; physical: select a virtual device and confirm the gate.

### P0-04 SETUP framing dock + tile-placement guidance (H6, I13)

*Definition:* the 3490 FF1 dock: target box for face size (face height 22–35 % of frame **[CALIBRATE]**), centre (x 0.4–0.6, y 0.3–0.5), headroom; camera-height proxy from head pitch median at rest (|pitch| ≤ 8°); an explainer to place the interviewer's tile directly under the webcam and shrink it, and to raise the laptop to eye level (spec §8.3). *Source:* face box + head pose in READY. *State:* SETUP/READY; live cue only via the arbiter (RE-CENTRE / MOVE BACK, dwell 5–8 s). *Unavailable:* no face → dock shows "face not found." *UI:* dock with corner brackets and priority corrections; replaces the four duplicate "centered" rows and the centering-keyed alignment gauge. *Personalization:* none. *Acceptance:* fixture face box outside tolerance → dock correction text; inside → `CAMERA READY`; physical: lean out of frame → `RE-CENTRE` after dwell, not before.

### P0-05 Calibration session + baseline store v1 (spec §18)

*Definition:* on first use and on `{deviceId,label}` change: (a) 45–60 s read passage with soft/normal/emphasised lines → loudness P10/P50/P90 (LUFS-K, speech-only), F0 median + semitone SD, articulation/syllable rate, blendshape resting percentiles (smile P5–P10, brow, squint), face-box size, head-pose median, noise floor; (b) 2-minute casual storytelling answer → natural fingerprint (facial activity, pitch SD, gesture units/min and space, pause style); (c) coverage measures. Stored as a versioned baseline `{version, createdAt, device, values, coverage}`; STALE after 90 days or on device change; never contains raw audio/landmarks. *Target:* corridors derive from baselines (P0-06/07/08). *Unavailable:* no baseline → global bands with `NO BASELINE` badge; X and S withheld. *UI:* calibration flow; "Calibrate" prompt when STALE. *Personalization:* this *is* the personalization root. *Acceptance:* baseline JSON schema validated; STALE logic unit-tested; corridor derivation reproducible from a fixture baseline; storage contains no key matching `/pcm|audio|landmark|blendshape.*array|frame/i`.

### P0-06 Loudness pipeline (C2–C5); remove universal dBFS corridor

*Definition:* K-weighting (BS.1770-5 coefficients re-derived for the actual sample rate) → mean-square → momentary (400 ms, 75 % overlap) and short-term (3 s) loudness on VAD speech frames; absolute gate −70 LUFS. Corridor = baseline P50 ± 6 LU **[CALIBRATE]**, evaluated as out-of-corridor duration fraction over rolling 10 s; dynamic range = P90 − P10 per answer. *State:* SPEAK only (listening frames excluded). *Formula:* per EBU Tech 3341. *Target:* LOUDER cue via arbiter when below corridor for the dwell; PQ shows range. *Unavailable:* `PROCESSED` → relative dynamics only; SNR < 15 LU → LOW. *UI:* Volume instrument shows LU vs baseline with corridor and chevrons (3490 VVLOCK); raw dBFS moves to LAB; the −32…−16 dBFS corridor and its blue/green/red zones are deleted. *Personalization:* corridor ±3…±10 LU by student/mentor. *Acceptance:* a −20 dBFS 1-kHz tone vs a −26 dBFS tone differ by 6 LU ± 0.2; speech frames only (silence does not lower the P50); corridor drawn from baseline, not constants (grep test for `-32`/`-16`).

### P0-07 Pitch upgrades (D1–D4)

*Definition:* keep MPM/NSDF; voicing = clarity ≥ 0.45 (raise to 0.85 for register decisions **[CALIBRATE]**) ∧ VAD speech ∧ level ≥ floor + 10 dB; 5-frame median; reject > 7 st jumps unless sustained 3 frames; search band baseline median ± 1 octave after calibration; reference = calibration median (fallback rolling median flagged `ROLLING`); variability = SD of semitones over the last 10–20 s of voiced frames (≥ 50 voiced frames); P10–P90 per answer. *State:* SPEAK. *Target:* bands 2.0/3.0 st **[CALIBRATE]**; VARY drill cue only in DRILL mode. *Unavailable:* < 50 voiced frames → `ESTABLISHING`. *UI:* register ladder unchanged; add variability readout and per-answer range in PQ; never a Hz target. *Personalization:* bands relative to baseline SD. *Acceptance:* synthetic F0 sweep gives SD within 0.1 st of ground truth; octave-halved frames are rejected; reference stays fixed across a 5-minute fixture (drift < 0.2 st).

### P0-08 Word-timing producer ladder, WPM, Delivery Speed, syllable-rate fallback (E1–E5, A5)

*Definition (spec §11.3, R8):* Tier A worker — Transformers.js v3, `onnx-community/whisper-base_timestamped`, `return_timestamps:'word'`, WebGPU→WASM by a load-time benchmark (5-s warm-up decode ≤ 1.5 s), VAD utterances ≤ 10 s, forced decode every 5 s with 1-s overlap, LocalAgreement-2 confirmation, no 30-s rolling re-transcription; word times = `segmentCaptureStart + word.start` on the session clock. Tier B — the existing sidecar upgraded to return `{words:[{start,end,prob}]}` relative to the worklet frame index (never server receive time) with `word_timestamps=True`, `condition_on_previous_text=false`, VAD `min_silence_duration_ms≈500`, `hallucination_silence_threshold≈2`; keep the existing provenance gate shape (`providerSessions:0`, `rawAudioPersisted:false`, `rawTextReturned:false` unless P3 consent). Tier D — de Jong & Wempe nuclei on 10-ms intensity with voicing; label ESTIMATED; never WPM. Tier E — VAD-only. *Filters:* VAD gating, overlap ≥ 50 %, rate plausibility (> 7 words/s sustained; > 30 % words < 40 ms), 3-gram loops, silence deny-list, Whisper thresholds. *Formula:* WPM_wall = 60·N/W (W = 10 s live, 30 s trend, answer); articulation WPM = 60·N/speech-time; minimum N ≥ 8, speech ≥ 3 s, coverage ≥ 70 %; Delivery Speed g(wpm) piecewise-linear with corridor → 70–80, `hi_cap = hi + 60`; global corridor 140–180, personalised `baseline_P50 × [0.92, 1.10]` clamped to 110–210 **[CALIBRATE]**; L2 cap +10 %. *State:* SPEAK. *Target:* SLOWER cue via arbiter above corridor sustained. *Unavailable:* tier demotion rules (decode P95 > 8 s over 5 segments; coverage < 70 % ×3; plausibility rejects > 20 %); tiles show "collecting…" then ESTIMATED then UNAVAILABLE; "as of ~3 s ago" label; grey after 8 s. *UI:* Speaking Speed dial with five zones; provenance chip; LAB shows tier/engine. *Personalization:* corridor within envelope. *Acceptance:* hand-timed reference clip (≥ 2 min, IMG speaker, laptop mic): word-count error ≤ 5 % per 10-s window and median word-time error ≤ 150 ms for Tier A/B before either is labelled MEASURED; silent audio produces zero words (hallucination filter test); a fixture with 6 words in 3 s cannot show WPM (minimum-evidence rule) — the current fixture's constant 120 WPM must be changed to satisfy the ≥ 8-word rule; Tier D output never contains the string "WPM" without "ESTIMATED".

### P0-09 Smile-pattern event redefinition (F1, F2)

*Definition (spec §7.1):* `s(t)` median-filtered 100–150 ms; baseline `b` = P5–P10 of calibration + first 60 s; onset `s−b ≥ θ_on` (raw ≈ 0.30 default), offset `s−b < 0.6·θ_on` for ≥ 0.3 s; minimum 0.5 s; refractory 0.5 s; rise-time 10→90 %; sustained flag > 4–5 s or > 50–60 % of a 60-s window; eye/cheek sub-label at LOW confidence; state tag; quality gates (face conf < 0.5, |yaw|/|pitch| > 30°, face height < 15 %). *State:* ALL, tagged. *Outputs:* events/min by state, % time, mean duration, rise-time distribution, sustained flags. *Unavailable:* channels absent → existing `NO_MOUTH_CORNER_CHANNELS`. *UI:* remove the live counter and the arc gauge from Simulation; in Training show "smile pattern active · N s" only; counts to PQ (one line) and Film Room. `genuineSmileClassification: UNSUPPORTED_INFERENCE` unchanged. *Personalization:* baseline-relative only. *Acceptance:* fixture with 0.2-s flickers produces 0 events; a 2-s plateau produces 1 event; two plateaus 0.3 s apart merge (refractory); the same plateau during INTERVIEWER_TURN is tagged listening; no output string contains "genuine"/"Duchenne".

### P0-10 Facial activity index, blink demotion, head pose (F7, F9, F10)

*Definition:* F7 = rolling 10-s mean of `facialMovementRate` + count of baseline-exceeding activations (mouth, brow, cheek/eye, jaw), expressed as a ratio to the calibration baseline, computed separately for SPEAK and LISTEN; bands 0.5× / 2× **[CALIBRATE]**; no red ceiling; copy never says "flat." F9 blink: keep detection (fix: event ≥ 0.5 for 70–400 ms; merge < 100 ms; per-state rate over rolling 60 s, not session elapsed time) but remove the tile from the HUD (LAB only). F10: worker emits Euler angles from the facial transformation matrix; linear proxies become fallback. *Unavailable:* face gates. *UI:* the "Expression / geometry trend" card becomes "Facial activity vs your baseline" (Training only); its buffer label must match its length (today 120 samples ≈ 15 s labelled "Last 60 s"). *Personalization:* baseline ratio. *Acceptance:* a static face yields ratio ≈ 0; a fixture with periodic brow/mouth activity yields ratio > 1; the blink tile is absent from every preset; head-pose yaw from the matrix matches a synthetic rotated mesh within 3°.

### P0-11 Orientation states (H1–H3)

*Definition (spec §8.1):* fuse F10 head pose with eyeLook blendshapes/iris offset over ≥ 1-s windows into `TOWARD_SCREEN | DOWN | AWAY | UNKNOWN` with confidence; triggers pitch ±8°/yaw ±10° (toward), pitch ≤ −12…−15° or strong iris-down ≥ 1.5–2 s (down), yaw ≥ 15–20° ≥ 1 s (away) **[CALIBRATE]**; time-share per conversational state over rolling 60 s and per answer; down episodes during own speaking (count, mean duration); thinking-gaze episodes in TRANSITION recorded and never cued. *Unavailable:* glasses-glare/low confidence → UNKNOWN (never AWAY); "my eyes may not track" flag → head-pose only. *UI:* replaces "Camera-facing balance" (cumulative, eye-look-only) with an orientation state chip (Training) and per-state shares (PQ); the LOOK UP cue fires only in SPEAK, never in TRANSITION/NOTES. *Personalization:* listening-share flag threshold (default 50 %) mentor-editable. *Acceptance:* fixture head pitch −20° for 3 s during SPEAK → one DOWN episode; the same during TRANSITION → thinking-gaze, no cue; low-confidence frames → UNKNOWN; the three legacy "facing" definitions (projector |yaw| < 18°, episode |yaw| ≤ 20 ∧ |pitch| ≤ 15, blendshape offCentre < 0.28) are removed or routed through the single fused classifier (grep test).

### P0-12 Gesture-unit detector + hands-visible conditioning + movement energy (I2, I3, I4, I10)

*Definition (spec §9.2):* rest clusters (< 0.05 sw/s, ≥ 1 s dwell); onset > max(3× noise floor, 0.15 sw/s) ≥ 100 ms leaving rest; unit 150 ms–6 s; offset on rest or < threshold ≥ 500 ms; excludes face-contact/off-frame; **SPEAK only**; rate per speaking minute conditioned on hands-visible ≥ 60 %; proportion of speaking time out of rest; movement energy in shoulder-widths/s (fix the degree/coordinate mix). Existing episode trackers remain as the coarse "hand-region activity" flag. *Unavailable:* hands < 60 % visible → rates UNAVAILABLE, not zero. *UI:* Training shows the activity flag; counts to PI/Film Room; never a target; "absence" copy only when hands were visible. *Personalization:* natural-fingerprint ratio. *Acceptance:* fixture hands static → 0 units; a 0.6-s excursion from rest → 1 unit; the same excursion during INTERVIEWER_TURN → 0 units (listening-phase movement counted separately); hands absent → `UNAVAILABLE` with reason; movement energy unit test uses a 1-shoulder-width displacement per second.

### P0-13 Whisper-cue arbitration engine + NO HUD default + modes/densities

*Definition (spec §19.2):* `cue-arbiter.mjs` with the candidate table (CHECK MIC / CHECK CAMERA → RE-CENTRE / MOVE BACK → LOUDER → SLOWER → LOOK UP → BRIDGE (opt-in) → VARY (drill)); rules: one cue on screen; onset dwell (3 s faults; 5–8 s framing/orientation; 10–20 s loudness/rate, deviation-graded); hysteresis clear thresholds; 3-s display; ≥ 30 s refractory per cue; ≤ 1 cue per 20–30 s and ≤ 3 per answer; suppressed in TRANSITION, the first 3 s of each answer, NOTES, and on LOW coverage; placement adjacent to the interviewer video; one word, never a number. Modes: SIMULATION (NO HUD; rails collapsed; self-view thumbnail; whisper line off by default, student may enable one cue), TRAINING (SIMPLE/STANDARD/LAB densities = today's rails), DRILL (one instrument). *Unavailable:* a cue whose source metric is LOW/UNAVAILABLE cannot fire. *UI:* the top-bar "Full Coaching / Interview Only" buttons become mode controls with the same visual language; the status chip stays honest ("MEASURING · HIDDEN"). *Personalization:* student chooses the enabled cue; mentor recommends; admin tunes dwell/hysteresis in config. *Acceptance:* two simultaneous conditions show only the higher priority; a condition shorter than dwell never shows; a cue never re-fires within its refractory; no cue during TRANSITION; a metric marked LOW cannot fire; SIMULATION renders zero `.telemetry-card` elements and no overlay bitmaps are produced by the worker while all layers are hidden.

### P0-14 Stage geometry, overlays pre-interview, visible overlay controls, self-view policy

*Definition:* `.meeting-stage { aspect-ratio: 16/9 }` with max-height and centring so the feed crop is identical in every mode (today ≈ 1.25:1 vs ≈ 2.38:1 boxes with `object-fit: cover` zoom ×1.34 and 12.6 % top/bottom crop); the vision pipeline starts at *Start live capture* so face/hands/body/framing overlays are visible in READY; the on-stage overlay toggles hidden by the V2 CSS become visible in TRAINING; hiding all layers sets `overlayEnabled:false` in the worker; self-view is a thumbnail or hidden in SIMULATION with a framing glyph that appears only when framing is off; "practice with self-view" is an opt-in drill. *Acceptance:* `getBoundingClientRect()` of the stage has the same aspect in both modes at 1626×968, 1440×900 and 1920×1080; overlays paint within 2 s of READY on the fixture; with all layers off the worker posts no bitmaps (message count test); the Founder-approved 1626×968 composition of the TRAINING density still passes the existing visual-conformance gate.

### P0-15 Post-answer card v1 + per-answer evidence retention (in-session) + export

*Definition (spec §19.6):* on each `question.boundary`, close the answer window, compute PQ metrics (latency, WPM/articulation rate with provenance, fillers if available, pause structure, pitch variability and range, loudness range, one delivery note from the arbiter's history, one structure placeholder until P3), render a 10–20 s card with ≤ 2 items in a 2-positive : 1-corrective shape and one next-answer goal; keep per-answer envelopes in session memory (no persistence in this ticket) and offer a JSON export of derived metrics only (schema-validated against the raw-payload guard). *Unavailable:* windows below minimum evidence produce a card with "collecting" items only. *Personalization:* student picks the tracked item; mentor template (P1). *Acceptance:* the card appears only between questions; never more than two items; never an index or a trait word (prohibited-term test on card copy); the export contains no raw payload keys; the existing `endAnswer` envelope is no longer discarded (assertion on retained envelope count = number of questions).

### P0-16 Coverage, confidence and provenance surface (A1, A5, A9; spec §24)

*Definition:* every projected metric object gains `confidence ∈ {HIGH, MODERATE, LOW, UNAVAILABLE}`, `provenance ∈ {MEASURED…, ESTIMATED…, UNAVAILABLE}`, `state`, `windowMs`; the failure table in spec §24 is implemented as reason codes with human fixes; a coverage lane/glyph shows only when something is wrong; unavailable lanes read `UNAVAILABLE · CONTRIBUTES NOTHING`. *Acceptance:* every metric object in the fixture snapshot passes a schema test requiring the four fields; every reason code in §24 has a fixture that triggers it; no metric ever renders a numeric value while `confidence === 'UNAVAILABLE'`.

---

## 4. P1 – P4 backlog (summary; definitions in the Ontology and Spec)

**P1:** G1 nod detector (LISTEN/TRANS only; ≥ 15 fps) → B7–B9 acknowledgment-given-opportunity and longest unacknowledged stretch; I12 Tier 0 notes pane + NOTES state; F3 rise-time, F4 sustained flag, F5 eye/cheek sub-label, F8 brow emphasis; I7 self-touch (never live, never red); I9 posture summaries; C6 trail-off; E7 filler estimate (KWS) — never live; E12 phrase length; B5/B6 talk-over and backchannels; baseline store v2 with fingerprint ageing; mentor targets and card templates; Film Room timeline v1 with the state ribbon and mandatory coverage lane; opening-window report.
**P2:** I6 co-occurrence (≥ 25 fps; research lens); I8 repetitive motion (opt-in, neutral wording); E13 cadence regularity; D6 terminal contours; K1–K6 profiles/gauge/index with contributor rails and coverage rings (post-session only); Personal Best / last-5; mannerism clips; I12 Tiers 1–3; F6 responsive smiles; H4/H5; E6 rate variability.
**P3 (transcript under explicit consent; on-device preferred; retention-limited):** J1–J9, B4, B10, E8, E11, K7, STUDENT_QUESTION and answer-phase states, congruence engine (≤ 4 notes, never "incongruent").
**P4 (research only):** D7 fry and D8 uptalk awareness modules; G3 bobble detector; diegetic interviewer back-channels driven by delivery metrics (legal review + trial); synchrony quality scoring; faculty-rater validation study; live-vs-post-answer-vs-post-session randomised trial with a no-feedback retention mock.

---

## 5. Acceptance-test matrix (release gates)

| Gate | Content | Status today |
|---|---|---|
| Automated 3521/3522 suites | every P0 acceptance test above + existing 67 3521 tests | to be extended |
| Deterministic fixture | scripted conversational timeline; ≥ 8-word windows; state scenarios | fixture must be extended (today: one state, constant 120 WPM from 6 words/3 s) |
| Physical human matrix | face L/R/U/D; hands L/R/both; lean/centre; quiet/normal/loud; monotone/varied; voiced pitch; slow/fast speech (WPM now testable); hide/restore while capturing; device selectors; camera mute/switch recovery; **new:** interviewer-toggle timeline; thinking pause with gaze down (no cue); smile plateau vs flicker; hands-absent gesture withholding; AGC on/off loudness comparison; silent-device gate | **NEVER RUN** — remains the release blocker |
| Visual conformance | TRAINING density still passes the Founder 1626×968 gate; SIMULATION renders no telemetry cards | to be re-run |
| Privacy lifecycle | no raw payload in envelopes/exports/baseline store; egress guard; CSP self-only; worker posts no bitmaps when layers hidden | extend existing |
| Claim safety | prohibited-term scan over every UI string, card copy and export label (emotion, genuine, honest, nervous, confident-as-trait, eye contact %, hirability); provenance/confidence fields present on every metric | new |
| Fairness pre-launch | coverage parity (face/hands by skin tone × lighting × glasses/head covering), ASR WER by accent, availability parity, feedback parity, ICC — per spec §23 | new; requires the in-house webcam corpus |

---

## 6. Data-handling rules (binding on every ticket)

DH1 Face geometry and voice features are treated as biometric identifiers (BIPA): written release before capture, public retention/destruction schedule, deletion on request ≤ 30 days, ≤ 3-year destruction. DH2 Landmarks, meshes, blendshape arrays, PCM and frames never leave worker/session memory; persisted artefacts are derived per-window scalars and (P3, consent) transcripts with their own retention. DH3 Baselines contain only derived values and a device profile. DH4 Transcript text enters the runtime only under explicit, layered consent, processed locally where possible, never sent to institutions. DH5 Outputs are visible only to the student and coaches the student invites; contractually excluded from any institutional evaluation (EU AI Act guidelines: role-play carve-out; institution-required apps are prohibited). DH6 A published system card lists models, versions, thresholds, evaluation sets, known failure modes and audit results. DH7 No emotion, trait, honesty or hirability inference anywhere in code, copy or export; the existing `UNSUPPORTED_LIVE_CLAIMS` and `FORBIDDEN_FACE_CLAIMS` lists are extended, not relaxed.

---

## CURRENT STANDALONE HTML DISPOSITION

*(Section 7 of this handoff; referenced elsewhere as §7.)*

Every major module in `IV_PREP_ON_CALL_LIVE_ANALYTICS_STANDALONE.html` (deterministic build of the 3521 runtime, source SHA `9143d2af…`) is classified below. Vocabulary: **KEEP AS-IS** · **KEEP ENGINE / CHANGE INTERPRETATION** · **KEEP ENGINE / REDESIGN PRESENTATION** · **MODIFY** · **MOVE TO POST-SESSION** · **REPLACE** · **REMOVE** · **FUTURE / RESEARCH ONLY**. The objective is not to preserve sunk cost; the engines that are sound are kept because they are sound.

| # | Module (as seen in the specimen) | Disposition | Why |
|---|---|---|---|
| 1 | Three-column shell, rail collapse tabs, responsive reflow | **KEEP AS-IS** (as the TRAINING density) | The composition is Founder-approved and passes conformance; the evidence changes *when* it is shown (not in Simulation), not how it is built |
| 2 | Visibility registry (22 IDs), presets Full/Custom/Minimal/Interview, localStorage persistence, customizer drawer, per-metric eye buttons | **MODIFY** | The allowlisted-persistence pattern and "hiding never stops measurement" law are exactly right; the ID set changes (versioned migration) and presets become modes/densities (SIMULATION / TRAINING SIMPLE-STANDARD-LAB / DRILL) with Simulation = no cards |
| 3 | Top bar: Full Coaching / Interview Only buttons, status chip, session clock | **MODIFY** | Same visual language; buttons become mode controls; default for an interview is Interview Only (NO HUD); add the whisper-cue toggle; the honesty chip ("MEASURING · HIDDEN") is kept verbatim |
| 4 | Centre stage video (mirrored, `object-fit: cover`), on-stage stream-quality label ("CAMERA IDLE …"), capture indicator dot, and the `Lock to me` primary-reselect chip | **MODIFY** (stage) / **KEEP AS-IS** (quality label, indicator, reselect chip) | Aspect-lock the stage so Interview Only does not zoom ×1.34 and crop the forehead; keep mirroring and cover mapping for overlays. The quality label, indicator and reselect chip are honest coverage affordances and become the source of the coverage glyph (P0-16); the reselect chip must stay reachable in every mode because the 24 Aug screenshots show PRIMARY-PERSON SELECTION REQUIRED surfacing in Interview Only |
| 5 | Interviewer prompt bar ("Dr. Maya Chen … Tell me about a time…") and hidden `#live-coaching-cue` | **REPLACE** | Dead DOM that implies conversational awareness that does not exist; becomes the live prompt bound to question-engine events plus the whisper-cue line placed adjacent to the interviewer video |
| 6 | Device controls (camera/mic selects, refresh, start capture, stop, start interview, finish) | **KEEP AS-IS** + setup gate | Battle-tested lifecycle; add the SETUP audio-signal gate and processing read-back before Start interview |
| 7 | Measurement status line ("MEASURING · VISIBLE …") + hide-all / restore-all | **KEEP AS-IS** | The MEASURED ≠ VISIBLE law made visible; keep wording |
| 8 | Worker overlays (face mesh, hands, body, framing) with independent gates; on-stage toggles hidden by V2 CSS | **MODIFY** | Engine and gates are right; make toggles visible in Training, show overlays from READY (pipeline starts at connect), stop rendering when all layers are off, keep off in Simulation |
| 9 | Head/Face scanner plate (static PNG + cropped worker bitmap) + facial region status list | **KEEP ENGINE / REDESIGN PRESENTATION** | Founder plate stays; the plate shows *region state and activity* (tracked / active / limited / unavailable; smile, brow, periocular activity as heat) instead of duplicating the live mesh crop |
| 10 | Smile-pattern activity arc gauge (raw bilateral value, ACTIVE/IDLE) | **KEEP ENGINE / CHANGE INTERPRETATION** | The blendshape cartridge and hysteresis are sound; a live gauge of raw smile intensity is a self-focusing cue with no coaching value; becomes "smile pattern active · N s" in Training only, driven by the redefined event |
| 11 | Smile-pattern events counter | **MOVE TO POST-SESSION** (after MODIFY) | Counts every mouth-corner crossing with no minimum duration, baseline, refractory or state; redefined per P0-09 and shown post-answer (one line) and in the Film Room; never a live counter |
| 12 | Camera-facing balance bar (Facing %/Away %, cumulative, eye-look blendshapes only) | **KEEP ENGINE / CHANGE INTERPRETATION** | Eye-look channels are useful inputs but the card is mislabelled and cumulative and ignores head pose; replaced by the fused four-state orientation model over rolling windows, per conversational state; live only as the LOOK UP cue in speaking state |
| 13 | Blink rate tile (events/min, cumulative, session-elapsed denominator) | **REMOVE** from HUD (detector kept, LAB diagnostic) | Norms are wide and task-driven; no coaching use; observers over-read it; the denominator is wrong |
| 14 | Speaking pace mini tile inside the face card (WPM mirror) | **REMOVE** | Duplicate of the Speaking Speed instrument |
| 15 | Head nods tile ("Detector unavailable") | **REPLACE** | A permanently unavailable slot; replaced by the listening-state nod detector feeding acknowledgment-given-opportunity (P1), post-session only; no nods/min live tile ever |
| 16 | Expression / geometry trend chart ("Last 60 s", autoscaled, session-σ mean) | **KEEP ENGINE / CHANGE INTERPRETATION** | Concept is right; the value is a slowly varying session statistic autoscaled per repaint in a 15-s buffer labelled 60 s; becomes the rolling, state-split, baseline-relative facial activity index (Training only; no "flat" language) |
| 17 | Body/Posture scanner plate + wireframe | **KEEP ENGINE / REDESIGN PRESENTATION** | Founder plate stays; shows teaching feedback (framing dock state, hands visible, posture share) rather than raw pose geometry |
| 18 | Framing/alignment proxy gauge + Torso framing / Shoulder line / Body center / Centered-in-frame rows | **REPLACE** | Four rows print the same string and the gauge colour is keyed to centering, not lean; replaced by the SETUP framing dock and a single live RE-CENTRE / MOVE BACK cue; lateral lean becomes a post-session posture summary |
| 19 | In-frame status tile | **MODIFY** | Fold into the framing dock and the coverage glyph |
| 20 | Hands visible tile (L+R observed) | **KEEP AS-IS** | Correct as a coverage precondition; reword to make clear it is not a gesture metric |
| 21 | Gesture activity tile (hand-region episodes ≥ 1.4 sw/s) | **KEEP ENGINE / CHANGE INTERPRETATION** | Trackers are a sound coarse activity flag; add the gesture-unit detector, speaking-state gating and hands-visible conditioning; counts and rates go post-session; no target |
| 22 | Movement level tile (ACTIVE/LOW) + Movement-over-time chart (ceiling 0.04) | **MODIFY** | Unit mixing (normalised coordinates averaged with degrees); label reflects episode trackers not the delta; fix units (shoulder-widths/s), keep as a Training/LAB lane |
| 23 | Repetitive motion tile ("UNAVAILABLE") | **FUTURE / RESEARCH ONLY** (remove the slot) | Detector is P2 and opt-in with neutral wording; a permanent UNAVAILABLE tile has no value and implies a deficit metric |
| 24 | Notes detection + Notes confidence tiles ("UNAVAILABLE / NO VALIDATED PROXY") | **REPLACE** | Note-taking is a product-design problem first: the Tier 0 notes pane (P1) makes it first-party; inference tiers follow (P2); count only, never good/bad; remove both tiles until Tier 0 exists |
| 25 | Volume instrument (16-segment bar, universal −32…−16 dBFS corridor, "LIVE LEVEL" cue, "no calibrated target" caption) | **KEEP ENGINE / CHANGE INTERPRETATION** | RMS/dBFS and clipping are correct measurements; the universal corridor contradicts its own caption and device reality (AGC, virtual devices, −96 dBFS sessions); becomes LUFS-K speech-only with a personal corridor and a PROCESSED badge |
| 26 | Speaking Speed dial (28 segments, 110–160 WPM universal corridor, "OBSERVED WORD TIMING") | **MODIFY** | Keep the dial and the honest provenance label; feed it from the tier ladder; personalised corridor mapped to 70–80 on a 0–100 Delivery Speed scale; five zones; "as of ~3 s ago"; ESTIMATED fallback never shown as WPM |
| 27 | Vocal Variation three-trace chart (volume dBFS, pitch st, speed WPM; toggles; Hide all) | **KEEP ENGINE / REDESIGN PRESENTATION** | Genuine histories with honest gaps are valuable; default becomes a single Vocal Variety band (pitch SD + loudness range, speech-only, baseline-relative) with the three raw traces on demand; gate traces on speaking state so volume does not dip to the floor while listening |
| 28 | Pitch register ladder (±2 semitone buckets vs rolling median) | **MODIFY** | Speaker-relative design is correct; reference becomes the calibration median (rolling median as flagged fallback); add the 10–20-s SD readout; never coach level |
| 29 | Founder diagnostics drawer (raw values, provenance strings) | **KEEP AS-IS** (LAB density) | This is the LAB density the 3490 law asks for; add confidence/provenance fields as they land |
| 30 | Deterministic fixture + standalone build/verify scripts | **KEEP AS-IS** + extend | Valuable zero-permission QA path; extend with the scripted conversational timeline, ≥ 8-word transcript windows, state scenarios, silent-device and AGC cases |
| 31 | Engine core: media bridge, browser pipeline, holistic + face-detector workers, primary-person lock, session clock, privacy guards, egress blocking, compact-geometry budget | **KEEP AS-IS** (with the additive changes in §1) | The strongest part of the implementation: fail-closed, private, deterministic; every recommendation here builds on it. Note: the 24 Aug physical session showed "LOCAL PRIVACY GUARD BLOCKED …" in the top bar — verify that vendored model/WASM paths never trigger the guard on legitimate loads |
| 32 | Local transcript timing producer (6-s MediaRecorder windows → aggregate `wordCount/firstWordStartMs/lastWordEndMs`; sidecar probe; projector provenance gate) | **MODIFY** | The provenance-gate pattern and generation fencing are exactly right and are reused; the producer becomes Tier B with per-word timestamps on the worklet frame index and VAD-gated windows; the aggregate-only contract is a transitional shape, not the target |
| 33 | `AudioSignalAnalyzer` level-based VAD + `AnalyticsSession` per-answer evidence envelope (computed at Finish, then discarded) | **REPLACE** (VAD) / **MODIFY** (envelope) | Level VAD with startup-calibrated fixed thresholds is unvalidated and cannot separate an interviewer on the same speakers; Silero VAD replaces it (level VAD stays as fallback). The evidence envelope is a good pattern that is currently thrown away; it becomes per-answer and is retained for the post-answer card and export |

**Cross-cutting observations from the specimen and the 24 Aug screenshots** (for the physical acceptance run): the whole session ran with the microphone at −96.0 dBFS ("NDI Audio (Virtual)") while face metrics were live — the setup gate in P0-03 exists for this; the top bar reported `PRIMARY-PERSON SELECTION REQUIRED` during Interview Only at 26–27 minutes — check whether a very large/close face (after the ×1.34 zoom the user may have moved closer) exceeds the lock's continuity area ratios (0.42–2.4) and whether the strike zone needs to scale with face size; `LOCAL PRIVACY GUARD BLOCKED …` appeared at 01:08 — identify the blocked URL; the Smile-pattern events counter reached 5 in 68 s during normal speech — consistent with the over-counting analysis; "Blink rate 16 / min" at 01:08 and "2 / min" at 00:38 illustrate the cumulative-denominator problem.

---

## 8. Definition of done for the next Codex ticket

1. All 16 P0 contracts implemented behind config, with their acceptance tests green in the deterministic fixture.
2. The physical human acceptance matrix (§5) executed at a user-controlled checkpoint and recorded, including the new rows.
3. The visual-conformance gate re-run for the TRAINING density; SIMULATION screenshot showing no telemetry cards and an aspect-locked stage.
4. Privacy-lifecycle and claim-safety scans green; no raw payloads in baselines or exports.
5. Handoff records under `_AI_HANDOFFS/from_codex/Y1-Y2-CAM-V6-3522_*` with the metric support matrix updated to the new ontology IDs and the release truth stated in the same form as 3521's ("AUTOMATION / DETERMINISTIC / PHYSICAL / WPM / RELEASE").

— END OF HANDOFF —
