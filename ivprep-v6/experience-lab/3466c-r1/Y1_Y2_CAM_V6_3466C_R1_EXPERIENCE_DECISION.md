# Y1-Y2-CAM-V6-3466C-R1 Experience Decision

Status: **HUMAN TEST READY — physical webcam/microphone acceptance is not yet claimed**  
Authority: DR-063 + DR-064 under `PRODUCT:IV-PREP-ON-CALL`  
Prototype: `Y1_Y2_CAM_V6_3466C_R1_PROTOTYPE.html`

## Decision

Select **Runway → Live Stage → Film Room** as the focused IV Prep On-Call interaction architecture.

The experience opens with one choice, becomes a full-height interview stage with the real camera as the dominant surface, and turns the completed answer into a seekable teaching room. Student and Dr Brian are projections of the same session; Coach and Telemetry are projections of the same evidence; original media and derived overlays remain separate layers.

This deliberately rejects sidebar navigation, KPI grids, persistent charts, tiny controls, and an always-visible analytics cockpit. Analytics should alter the experience at the moment it helps, then get out of the way.

## Three materially different architectures considered

| Architecture | Core interaction | Strength | Why selected or rejected |
|---|---|---|---|
| **Runway → Live Stage → Film Room** | A short launch runway leads into one cinematic video stage; evidence becomes a spatial replay after the answer. | Five-second comprehension, mobile fit, and a natural teaching sequence. | **Selected.** It makes camera presence primary while keeping advanced evidence one gesture away. |
| **Orbit Room** | Question, coaching, and evidence orbit the student as spatial rings around the video. | Memorable and highly adaptive. | Rejected for R1. Motion and radial targeting add learning cost, make screen sharing less legible, and compete with the speaker's face. |
| **Split Broadcast** | Student and mentor surfaces remain side-by-side with a broadcast control strip and replay queue. | Strong live-teaching metaphor. | Rejected for R1. It encourages a second capture truth, collapses poorly on mobile, and looks like a production switcher instead of interview practice. |

## Experience grammar

### 1. Runway

- Student: “Walk in ready. Leave knowing why.”
- Dr Brian: “Teach the moment. Not the dashboard.”
- One primary action: **Connect camera + mic**.
- Simulation and Live Coaching are large, mutually exclusive choices.
- Replay is explicit, optional, tab-memory-only consent.
- SAMPLE film-room exploration is clearly labeled and never appears as a live result.

### 2. Live Stage

- The Founder's actual video fills the stage after explicit Chrome permission.
- Simulation hides coaching; Live Coaching permits one current correction.
- The tuner metaphor uses a single phrase and spatial needle. It is not a score.
- FACE and BODY + HANDS are independently visible and independently toggleable.
- Coach translates evidence; Telemetry exposes the richer signal state. Switching either projection does not call `getUserMedia`, rebuild the pipeline, or change the session clock.
- Dr Brian can mark the current instant with one button or `M`; `1`, `2`, and `3` add teaching tags.
- Mobile live view is fixed to the viewport and does not require page scrolling.

### 3. Film Room

- Hierarchy is **WHOLE INTERVIEW → QUESTION → PHASE → EXACT MOMENT**.
- A bounded flight recorder aligns Question, Phase, Speech, Silence, Pause, Level, Face, Hands, Head, Posture/Framing, Coaching, Mentor Marker, and System state to one monotonic session clock.
- “Moments that matter” gives a short teaching queue; the recorder retains the full evidence map.
- Spotlight mode removes chrome and makes the shared screen teach from the selected instant.
- Replay media exists only after explicit consent and remains distinct from regenerated derived overlays.
- **End + erase lab** releases media, workers, audio, object URLs, and local evidence.

## Coaching Director decision

R1 provides a local natural-language compiler that turns a prompt into a structured Analytics Focus Profile and requires explicit confirmation. The compiler is intentionally deterministic and offline in this prototype; it does not masquerade as an AI service.

The profile can activate only supported targets:

- Audibility — REAL NOW
- Framing — EXPERIMENTAL
- Hand visibility — EXPERIMENTAL
- Silence/pause — EXPERIMENTAL
- Pace/WPM — NOT ACTIVE; transcript required

A future AI interpreter may propose the profile, but deterministic analytics must remain the measuring/enforcement authority and the Founder must confirm the structure before it changes coaching.

## Evidence truth

| Classification | What the prototype says |
|---|---|
| **REAL NOW** | Actual browser camera/microphone capture; answer/session duration; captured microphone dBFS envelope; peak amplitude; digital clipping; local runtime/worker health; local overlay rendering; explicit mentor markers. |
| **REAL DETECTOR, EXPERIMENTAL INTERPRETATION** | Face count guard and the worker's real detector result. |
| **EXPERIMENTAL** | Detected speech activity, silence/pause, face presence, torso presence, left/right hand visibility, head yaw/pitch/roll proxies, framing center proxy, and their derived episodes. These are real calculations from live input but are not student-safe scores. |
| **SAMPLE / DEMO** | The optional 92-second product-story replay and sample phase strategy. It is watermarked and cannot be mistaken for a live measurement. |
| **NOT AVAILABLE** | Pitch/F0, WPM without a transcript, smile/emotion, eye contact, posture score, semantic gesture meaning, and coaching purpose inference. |

## Accessibility and interaction law

- Semantic landmarks, visible focus, polite status, keyboard shortcuts, reduced-motion behavior, and forced-colors states are included.
- Mobile primary and secondary controls meet a 44 px tap baseline; dense flight-recorder events retain a 24 px minimum target and a redundant moments list.
- Color is not the only maturity cue; every signal has a text maturity label.
- Errors keep both devices off or release partial acquisition. Nothing starts on page load.
- The design never grades a student from Founder-experimental evidence.

## Acceptance boundary

The artifact is automated-test green and prepared for the bounded Founder device test. BAKE-OFF READY is withheld until Chrome permission, physical video/audio response, tracking, layer toggles, shared-session projections, and stop cleanup are personally observed in the supported localhost context.
