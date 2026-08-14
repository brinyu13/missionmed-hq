# Y1-Y2-CAM-V6-3471C Signal Contract and Founder Selection Sheet

Date: 2026-08-14

Mission: Y1-Y2-CAM-V6-3471C

Artifact status: Independent Round 1 design bakeoff; local, simulated, provider-free

Design authority: DR-089 / DR-090

Capability donor: accepted 3420R analytics implementation at `e24a68bc5e90b126c2c08ab30011aa2cf6fab7a9`, closeout `70352b0a0f47ebe20793a583d4f734a5328f8ee6`

## 1. Truth boundary

This packet designs coaching instruments. It does not certify a scoring model or production implementation.

- The engine may observe audio samples, timestamps, compact face/head/pose/hand geometry, availability, and synchronized events.
- MissionMed may configure coaching interpretations and target envelopes from those observables.
- The system does not directly observe thought, intent, honesty, deception, emotion, confidence, personality, identity, demographics, psychometrics, diagnosis, actual warmth, actual competence, trustworthiness, program fit, or content quality.
- Every higher-order construct must display its observable contributors, calibration reference, maturity, availability, and configurable-coaching status.
- No unavailable channel contributes silently. Missing or unsafe evidence fails closed.
- Every visual in the Design Lab uses simulated design-lab data. No camera, microphone, provider, external network, raw media, landmark persistence, or student data is used.

## 2. Accepted 3420R capability envelope

### Validated student-safe signals

| Signal | Accepted input | Current transformation | Boundary |
|---|---|---|---|
| `answer_duration_ms` | Monotonic session clock | Answer start/end difference | Time only; no quality inference |
| `captured_level_dbfs` | Local Web Audio PCM | Median captured digital level | Device capture, not calibrated acoustic loudness |
| `digital_clipping_fraction` | Local Web Audio PCM | Sustained/fractional near-full-scale samples | Digital clipping only |

Student-safe projection additionally requires the accepted validation record, correct engine/source identity, at least 0.8 coverage, at least 1,000 ms duration, medium/high reliability, and no unavailable quality state.

### Founder-experimental observables

| Family | Accepted observable evidence | Current limitations |
|---|---|---|
| Audio timing | Speech-active estimate, response-start estimate, silence-between-speech episodes | VAD ground truth is not validated; quiet speech/startup noise can be ambiguous |
| Audio variation | Energy interquartile range | Captured energy only; not prosody or calibrated loudness |
| Transcript-derived | Word rate, filler-token count | Existing browser transcript is not verbatim validated |
| Hands | L/R presence, compact wrist/hand center, chest/above-shoulder/below-chest zone, L/R/both motion episodes | No semantic meaning; identity continuity is not established across unsafe intervals |
| Body | Torso presence, lateral lean proxy, repeated direction-change/body-sway episode | Visibility dependent; thresholds are coaching hypotheses |
| Face/head | Face presence, compact face box, yaw/pitch/roll proxies, sustained turn, observable facial-movement episode | Head orientation is not gaze or eye contact; facial motion is not emotion |
| Framing | Face center and size proxy, centered fraction | Distance/headroom remain image-geometry proxies until calibration |
| Safety/system | Face count, multiple-face suppression, observation gaps, coverage, sample counts, inference timing | Person-specific analytics are withheld unless exactly one safe face is observable |

### Explicitly rejected or unavailable as current truth

- Legacy zero-crossing pitch.
- Eye contact.
- Emotion.
- Semantic gesture meaning.
- Any hidden-trait or hiring/clinical inference.
- Prosodic contour/F0, cadence-regularity model, answer-phase detector, gesture vocabulary classifier, and composite coaching model are not accepted current 3420R signals.

### Synchronization and privacy properties

- One monotonic `SessionClock` timestamps answer, audio, visual, system-gap, and evidence events.
- Current audio sampling is nominally 50 ms; current browser-local holistic visual target is adaptive up to 8 FPS.
- The event contract records provenance, reliability, coverage, sample count, limitations, source engine/input, maturity, and bounded evidence references.
- Raw audio, frames, landmarks, and external analytics calls are recorded as false in accepted envelopes.
- Compact geometry is bounded and rejects raw landmarks, blendshapes, embeddings, pixels, images, and bitmaps.
- Multi-face, face-absence, tracking-gap, hidden-document, disconnected-media, and worker-failure intervals become explicit unavailable/gap evidence.

## 3. Support-class law

| Class | Meaning in this bakeoff |
|---|---|
| `CURRENTLY SUPPORTABLE` | The essential instrument state can be driven directly by accepted current observables. Product validation may still be required before live student coaching. |
| `SUPPORTABLE WITH DERIVATION` | Required input exists, but a new bounded transform, window, normalization, target, or UI event must be implemented and validated. |
| `NEW ENGINEERING` | At least one essential signal, real-time event seam, calibration procedure, classifier, or configurable coaching model does not yet exist. |
| `NOT DEFENSIBLE` | The proposed claim cannot be supported by the available observables or violates the hidden-trait boundary. It must not be built as sensor truth. |

## 4. Calibration contract

Every targetable option accepts one visible reference:

1. `MISSIONMED STANDARD` — coaching envelope authored by MissionMed; not a universal human norm.
2. `PERSONAL BASELINE` — consented observable range from the same student.
3. `PERSONAL BEST` — synchronized observable window explicitly marked by Mentor/Founder.
4. `SESSION TARGET` — temporary target selected for the current drill.
5. `QUESTION-SPECIFIC TARGET` — target bound to a question family.
6. `ANSWER-PHASE TARGET` — target bound to `OPEN`, `ENUMERATE`, `PROVE/STORY`, or `CLOSE`.

When references disagree, the active session/phase target wins visually and the provenance remains available in Standard/Lab. Calibration configures a controller; it does not establish a diagnosis or personal trait.

## 5. Instrument option contracts

### Family 01 — Voice as terrain

#### V1 — Soundline Corridor

- Behavior taught: move captured voice energy into a target lane and avoid digital clipping.
- Live grammar: waveform below lane → `MORE VOICE`; waveform through lane → `VOICE LOCKED`; clipped edge → `BACK OFF`; no safe signal → `MIC SIGNAL UNAVAILABLE`.
- Observable inputs: `captured_level_dbfs`, `digital_clipping_fraction`; optional experimental `energy_variation_db` and `pause_episode`.
- Visual transform: rolling level window controls waveform displacement; clipping breaks/colors the outer edge; selected calibration supplies the target envelope.
- Unavailable behavior: freeze motion, desaturate the lane, label the audio gap, and exclude the interval.
- Coaching interpretation: captured level relative to the chosen reference. Never call it acoustic loudness, authority, confidence, or vocal quality.
- Reference: personal baseline/best, MissionMed standard, session target, phase target.
- Support: `CURRENTLY SUPPORTABLE` for level/clipping core; pause/variation overlays are `SUPPORTABLE WITH DERIVATION`.
- Two-second Action Test: PASS.

#### V2 — Phrase Runway

- Behavior taught: vary pace, place pauses, separate emphasis events, and land the close.
- Live grammar: regular identical strides → `BREAK THE METRONOME`; missing target pause → `TAKE THE PAUSE`; good phase-specific variation → `VARIATION — HOLD`.
- Observable inputs: speech-active estimates, pause episodes, transcript word rate, energy peaks, answer/phase timing.
- Visual transform: speech bursts become strides, silence becomes runway gaps, energy peaks become tall emphasis beats, phase changes replace the target spacing.
- Unavailable behavior: remove cadence coaching whenever VAD, transcript, or audio coverage is unavailable/low.
- Coaching interpretation: observable timing regularity and energy variation only. It does not prove memorization or intentional recitation.
- Reference: personal baseline/best, question/phase target.
- Support: `SUPPORTABLE WITH DERIVATION`; production-grade cadence/emphasis requires validation.
- Two-second Action Test: PASS for slow/fast/pause cue; detailed rhythm analysis belongs in Replay/Lab.

#### V3 — Voice Forge — FORTNITE DESIGN-LANGUAGE STUDY

- Behavior taught: coordinate level, pace, pitch/prosodic range, cadence variation, and emphasis into one readable vocal mechanic.
- Live grammar: one undercharged sector becomes `VARY THE PITCH`, `TAKE THE PAUSE`, or `MORE VOICE`; all target sectors create `CORE CHARGED`.
- Observable inputs: accepted level/clipping plus future robust F0/prosodic contour, cadence model, emphasis events, phase targets, coverage.
- Visual transform: contributor states charge clearly labeled radial sectors; the weakest actionable contributor supplies the correction.
- Unavailable behavior: unsupported sectors remain visibly offline and cannot improve the core.
- Coaching interpretation: configurable vocal-shape rubric, not naturalness, warmth, confidence, or character.
- Reference: personal best, MissionMed rubric, phase target.
- Support: `NEW ENGINEERING`.
- Two-second Action Test: PASS for the correction/lock grammar.

### Family 02 — Hands as spatial control

#### G1 — Gesture Field

- Behavior taught: keep hands observable in a useful operating area, vary spatial range, avoid below-frame loss/face-zone intrusion, and review where hands lived.
- Live grammar: low density → `HANDS UP`; narrow density → `EXPAND`; target spread → `GOOD RANGE — HOLD`.
- Observable inputs: anatomical L/R presence, compact centers/zones, shoulder scale, L/R motion episodes, coverage and gap events.
- Visual transform: ephemeral compact centers become decaying colored live trails; post-answer bounded spatial bins become a left/right density heatmap; target field comes from calibration.
- Unavailable behavior: clear live trails during unsafe face count/tracking gaps; show missing-side availability; never interpolate across gaps.
- Coaching interpretation: spatial occupation and movement only; no semantic gesture meaning.
- Reference: personal baseline/best, session/phase target.
- Support: `SUPPORTABLE WITH DERIVATION`.
- Two-second Action Test: PASS live; density/repetition analysis is Replay/Lab.

#### G2 — Dual Hand Lanes

- Behavior taught: preserve L/R availability, operating height, and flexible bilateral use without demanding symmetry.
- Live grammar: missing/low side → `USE THE OTHER HAND` or `HANDS IN FRAME`; both available in target range → `BOTH HANDS AVAILABLE`.
- Observable inputs: per-side presence, vertical center/zone, motion onset/duration, phase target.
- Visual transform: normalized per-side height becomes lane position; recent availability becomes the balance bridge; enumeration may temporarily prefer one-hand/finger behavior.
- Unavailable behavior: absent or unsafe side becomes neutral/unavailable rather than low-scoring.
- Coaching interpretation: side-specific availability and range; no preference for ambidexterity or forced symmetry.
- Reference: personal baseline/best, phase target.
- Support: `SUPPORTABLE WITH DERIVATION`.
- Two-second Action Test: PASS.

#### G3 — Handstorm Arena — FORTNITE DESIGN-LANGUAGE STUDY

- Behavior taught: coordinate visible hand emphasis with vocal emphasis and phase.
- Live grammar: hand enters target during vocal hit → `IMPACT LOCK`; voice hit without gesture → `HIT WITH HANDS`; no safe hand channel → `ARENA OFFLINE`.
- Observable inputs: hand motion onset, zones, future validated vocal-emphasis events, answer phase, shared clock, coverage.
- Visual transform: bounded temporal overlap acquires two spatial targets and emits an impact pulse.
- Unavailable behavior: withhold the lock if either channel is unavailable or low coverage.
- Coaching interpretation: observable co-occurrence, not meaning, confidence, enthusiasm, or authenticity.
- Reference: personal best and phase target.
- Support: `NEW ENGINEERING` for reliable vocal emphasis and live event bridge.
- Two-second Action Test: PASS.

### Family 03 — Camera relationship

#### F1 — Camera Dock

- Behavior taught: center, move closer/farther, preserve headroom, and keep camera-facing head position in a realistic interview tile.
- Live grammar: error vector becomes `CENTER`, `MOVE BACK`, `MOVE CLOSER`, or `CLEAR THE HEADROOM`; aligned geometry becomes `CAMERA READY`.
- Observable inputs: compact face box, face/framing presence, head-orientation proxies, safe face count.
- Visual transform: box center/size/bounds align to a target dock; spatial arrow points in the physical correction direction.
- Unavailable behavior: dashed neutral dock for face absence, multiple faces, protection unavailable, or tracking gap.
- Coaching interpretation: image geometry and head orientation proxy only; never eye contact or engagement.
- Reference: personal frame calibration, MissionMed video-conference standard, session target.
- Support: `CURRENTLY SUPPORTABLE` core; explicit distance/headroom labels are `SUPPORTABLE WITH DERIVATION`.
- Two-second Action Test: PASS.

#### F2 — Gravity Frame

- Behavior taught: make continuous framing correction through a low-reading magnetic-field metaphor.
- Live grammar: displaced tile visibly moves opposite the required student correction; text confirms `DOWN + LEFT`, `BACK TO CENTER`, or `STABLE — HOLD`.
- Observable inputs: face box center/size, torso presence, head orientation, selected target.
- Visual transform: normalized geometry error becomes tile offset, rotation, and field tension.
- Unavailable behavior: tile fades and the field pauses; no stale position is treated as live.
- Coaching interpretation: camera-geometry correction only.
- Reference: personal frame calibration, session target.
- Support: `SUPPORTABLE WITH DERIVATION`.
- Two-second Action Test: PASS.

#### F3 — Squad Ready Frame — FORTNITE DESIGN-LANGUAGE STUDY

- Behavior taught: acquire and hold a complete interview-ready framing state.
- Live grammar: the four chunky corners lock only when required face, torso, box, orientation, and coverage conditions are available/in target.
- Observable inputs: face/torso presence, box bounds, head orientation proxies, safe-face state, coverage.
- Visual transform: explicit Boolean contributor states control each corner; all required corners create one lock event.
- Unavailable behavior: `NO SAFE TARGET`; lock is impossible during unsafe person-specific coverage.
- Coaching interpretation: frame readiness under a configured rubric, not professional readiness or confidence.
- Reference: MissionMed frame standard, personal calibration.
- Support: `SUPPORTABLE WITH DERIVATION`.
- Two-second Action Test: PASS.

### Family 04 — One clock, many channels

#### C1 — Convergence Rings

- Behavior taught: add the observable channel missing from an otherwise coordinated moment.
- Live grammar: channel events arrive as peripheral rings; simultaneous arrival creates `CHANNELS CONNECTED`; missing hand activity creates `ADD THE HANDS`.
- Observable inputs: shared-clock energy peaks, hand/head/body/facial-movement episodes, phase boundary, coverage.
- Visual transform: channel-specific bounded event windows produce inward rings; overlap produces a center impact.
- Unavailable behavior: unavailable channel disappears and prevents any complete-convergence claim.
- Coaching interpretation: co-occurrence of observable changes, not congruence of intent or emotion.
- Reference: personal best, MissionMed configurable timing window, phase target.
- Support: `SUPPORTABLE WITH DERIVATION`; energy-peak and live event seams need implementation/validation.
- Two-second Action Test: PASS.

#### C2 — Threadline Replay

- Behavior taught: understand what changed together at an exact Film Room moment.
- Live grammar: none. This design is intentionally restricted to Replay/Lab.
- Observable inputs: evidence events on the accepted monotonic clock; future Mentor markers and answer-phase events.
- Visual transform: interval events become aligned lanes; a selected instant creates a vertical connection thread and exact teaching caption.
- Unavailable behavior: observation gaps are explicit and never bridged; truncated timelines remain marked.
- Coaching interpretation: synchronized evidence navigation.
- Reference: session clock, Mentor marker, Personal Best window.
- Support: `SUPPORTABLE WITH DERIVATION`.
- Two-second Action Test: FAIL for live student use; ACCEPT for Replay/Lab.

#### C3 — Combo Chain — FORTNITE DESIGN-LANGUAGE STUDY

- Behavior taught: build a readable chain across voice, face/head, body, and L/R hands.
- Live grammar: observed hits create labeled links; a broken link becomes `FINISH WITH RIGHT HAND` or `CONNECT VOICE + GESTURE`.
- Observable inputs: stable channel-event bus, temporal windows, phase target, coverage and availability.
- Visual transform: each observable event earns only its named link; no black-box sync percentage exists.
- Unavailable behavior: unavailable signals are visibly absent and cannot earn combo credit.
- Coaching interpretation: configured coordination challenge, not naturalness or interpersonal impact.
- Reference: personal best and mission target.
- Support: `NEW ENGINEERING`.
- Two-second Action Test: PASS.

### Family 05 — Contributors become coaching

#### A1 — Signal Loom

- Behavior taught: identify which contributor is dragging a selected composite coaching construct.
- Live grammar: one slack ribbon names one action; all target ribbons create `FLOW LOCKED`.
- Observable inputs: normalized component states, coverage, active calibration, configurable MissionMed weights.
- Visual transform: each contributor remains visible as a ribbon; target deviation controls tension; aggregate state is explicitly labeled `MissionMed coaching construct`.
- Unavailable behavior: a required unavailable contributor breaks the weave; aggregate is withheld or visibly partial.
- Coaching interpretation: selectable Expressive Energy, Natural-Delivery Pattern, Warmth-Presentation Cues, Controlled Delivery, or Delivery Impact rubric.
- Reference: personal baseline/best, MissionMed rubric, phase target.
- Support: `NEW ENGINEERING`.
- Two-second Action Test: PASS when exactly one ribbon owns the correction.

#### A2 — Mission Vector

- Behavior taught: take one prioritized physical/vocal action while retaining inspectable contributors.
- Live grammar: contributor deviations determine one vector cue such as `SLOW THE LANDING`, `LIFT YOUR HANDS`, or `RESET — ONE BREATH`.
- Observable inputs: component deviations, availability, priority rules, phase target.
- Visual transform: priority logic selects the highest-value correctable observable; the vector indicates direction instead of displaying a weighted score.
- Unavailable behavior: unavailable contributors cannot be selected; if none are defensible, the vector withholds.
- Coaching interpretation: action prioritization, not person ranking.
- Reference: session mission, phase target, personal best.
- Support: `SUPPORTABLE WITH DERIVATION` for currently observable contributors; full library is `NEW ENGINEERING`.
- Two-second Action Test: PASS.

#### A3 — Impact Core — FORTNITE DESIGN-LANGUAGE STUDY

- Behavior taught: understand the contributors to a bold Delivery Impact coaching state and fix the weak shard.
- Live grammar: charged shards create `IMPACT LOCK`; weakest shard becomes an oversized quest cue.
- Observable inputs: future validated/derivable contributor states, configurable weights, coverage, active target.
- Visual transform: labeled contributor shards charge the central coaching core.
- Unavailable behavior: unsupported shard remains concept-only; core is partial/withheld.
- Coaching interpretation: Delivery Impact excludes content/story quality and is not actual social, hiring, or clinical impact.
- Reference: personal best, MissionMed configured rubric, question/phase target.
- Support: `NEW ENGINEERING`.
- Two-second Action Test: PASS.

## 6. Composite construct contracts

These are configurable coaching views, not direct measurements or universal scores.

| Construct | Candidate observable contributors | Status | Defensible wording | Prohibited wording |
|---|---|---|---|---|
| Expressive Energy | Captured-energy variation, speech/pause pattern, facial/head/hand/body activation, cross-channel timing | `NEW ENGINEERING` aggregate; some inputs current/derivable | “Observable energy and movement cues are below this phase target.” | “You lack energy/confidence.” |
| Natural-Delivery Pattern | Cadence variability, pause variability, prosodic range, gesture variability, Personal-Best similarity, coordination | `NEW ENGINEERING` and requires research/validation | “Delivery is unusually repetitive relative to your marked natural-storytelling window.” | “This answer is memorized.” |
| Warmth-Presentation Cues | MissionMed-selected observable vocal/facial/head/gesture cues with explicit provenance | `NEW ENGINEERING` plus research-validation | “Observable cues in the warmth-presentation rubric are below target.” | “You are cold/unlikable/not warm.” |
| Controlled vs Chaotic Delivery | Phase-aware pace, pause, energy/motion variability, framing stability, recovery/reset pattern | `NEW ENGINEERING` aggregate; component derivations possible | “Several delivery channels are outside the configured control envelope.” | “You are chaotic/anxious.” |
| Delivery Impact | Voice shape, timing, framing, visible gesture range, coordination, phase execution; content excluded | `NEW ENGINEERING` | “Observable delivery contributors produced a strong configured impact pattern.” | “You are impressive/competent/trustworthy.” |

No fixed weights are asserted in Round 1. Any future weights must be configurable, provenance-visible, target-specific, versioned, and separately validated.

## 7. Failure and unavailable-state contract

| Failure | Required visual behavior | Forbidden behavior |
|---|---|---|
| Microphone/audio context disconnected | Freeze audio instruments; show `MIC SIGNAL UNAVAILABLE`; record/expose gap | Carry forward last level or score silence as poor delivery |
| Audio sampling gap/low coverage | Mark exact interval unavailable; withhold derived cadence/pause/emphasis | Interpolate or issue a coaching correction from low-quality evidence |
| Camera/vision disconnected | Remove person-specific target; show neutral paused state | Treat absence as poor framing/gesture |
| Face count is zero or above one | Suppress person-specific visual analytics for exact affected interval | Guess, select a bystander, or score the student |
| Multi-face protection unavailable | Withhold person-specific visual instruments | Continue with ambiguous full-frame geometry |
| Tracking/document-hidden gap | Break temporal continuity and show explicit gap | Bridge motion trajectories across the gap |
| Worker error | Keep unaffected modality available; mark failed modality partial/unavailable | Collapse all coaching or show stale motion |
| Target/calibration absent | Show observable state without target judgment, or request calibration | Invent a target or apply an invisible population norm |
| Essential contributor unavailable | Withhold/partial-label composite and name unavailable contributor | Renormalize silently and show a falsely complete aggregate |

## 8. Live information-density contract

- `SIMPLE`: one peripheral instrument state and one action phrase; no raw numbers.
- `STANDARD`: action phrase plus selected target/baseline context and the contributor causing the correction.
- `LAB`: input metric, transform, target, provenance, reliability, coverage, limitations, maturity, and unavailable reason.
- Raw telemetry never becomes the primary live student grammar.
- Mentor-private intelligence is a distinct surface and must never leak into a shared/student view.

## 9. Integrated live composition decision

The proposed composition uses:

- realistic student/interviewer video-conference tiles;
- a left-edge Soundline voice rail;
- a student-tile Camera Dock reticle;
- two Gesture Field hand orbs;
- a low-opacity Convergence pulse;
- a phase label; and
- one dominant correction command.

Only the highest-priority correctable observable becomes text. Other instruments remain peripheral. In `UNAVAILABLE`, stale cues disappear and the command becomes `COACH PAUSED`.

## 10. Founder selection sheet

Use only: `LOCK`, `KEEP AS BASE`, `REFINE`, `REJECT`, `COMBINE`, `SHOW MORE LIKE`.

| ID | Option | Support | Founder disposition | Combine/refine note |
|---|---|---|---|---|
| V1 | Soundline Corridor | Currently supportable core |  |  |
| V2 | Phrase Runway | Supportable with derivation |  |  |
| V3 | Voice Forge — Fortnite study | New engineering |  |  |
| G1 | Gesture Field | Supportable with derivation |  |  |
| G2 | Dual Hand Lanes | Supportable with derivation |  |  |
| G3 | Handstorm Arena — Fortnite study | New engineering |  |  |
| F1 | Camera Dock | Currently supportable core |  |  |
| F2 | Gravity Frame | Supportable with derivation |  |  |
| F3 | Squad Ready Frame — Fortnite study | Supportable with derivation |  |  |
| C1 | Convergence Rings | Supportable with derivation |  |  |
| C2 | Threadline Replay | Supportable with derivation; Replay/Lab only |  |  |
| C3 | Combo Chain — Fortnite study | New engineering |  |  |
| A1 | Signal Loom | New engineering |  |  |
| A2 | Mission Vector | Supportable with derivation / new engineering expansion |  |  |
| A3 | Impact Core — Fortnite study | New engineering |  |  |

### Suggested Frankenstein prompts

- `COMBINE V1 Soundline Corridor + V2 pause gate + V3 lock feedback`.
- `COMBINE G1 Gesture Field + G2 side-specific availability + G3 emphasis impact`.
- `COMBINE F1 Camera Dock + F2 low-reading gravity motion + F3 corner lock`.
- `COMBINE C1 live pulse + C2 Film Room evidence + C3 combo feedback`.
- `COMBINE A1 contributor transparency + A2 one-action prioritization + A3 high-energy lock state`.

## 11. Stop line

Founder selection is the terminal gate for this mission. Selection does not authorize product implementation, source integration, merge, provider use, camera/microphone capture, research claims, database work, deployment, production, student access, or any other external-system action.
