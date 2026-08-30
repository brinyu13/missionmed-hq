# Y1-Y2-CAM-V6-3492 — FINAL DESIGN SYSTEM
## MISSIONMED PERFORMANCE ENGINE (IV Prep On-Call)

STATUS: `FROZEN except two Founder decisions (see COMPONENT LEDGER)`
Reference implementation: `Y1-Y2-CAM-V6-3492_IVPREP_FINAL_NORTHSTAR.html` (normative for geometry, motion, and tokens).

## 1. Identity

StoryForge sibling, more technologically advanced room: StoryForge = creation studio; IV Prep = live performance + simulation + telemetry + replay + coaching. Same universe (near-black navy, orange→gold, oversized italics, chamfered geometry, angular selected states), different energy (equipment housings, recessed telemetry glass, mechanical locks, media-editor tracks).

## 2. Tokens (normative)

Color: `--bg #070B15` · surfaces `#0D1324 / #111A31 / #152040 / #1B2A52` · lines `#222E52`, edges `#31406F` · ink `#FFFFFF`, ink2 `#CBD5EE`, dim `#7E8AAC` · brand `#FF8A1E → #FFC24B` (gradient 92°) · cream chip `#F7EFD8` · ok `#2FBF63` · warn `#FFA928` · bad `#E5484D` · info `#4D7CFE` · violet `#8B7CF7`. Success is confirmed with **gold lock + mechanical snap**, not green flood; green is reserved for in-corridor states and marks.

Type: Archivo (900 italic uppercase for display/verdicts/nav; 800 italic for labels; 700 for body), Space Grotesk for numerics. Microcaps: 9.5px / .16em tracking. Verdict scale: ≥24px live corrections, 40px+ hero verdicts. System-font fallback permitted offline.

Materials: housing gradient `#141D38→#0C1224` with bevel (`inset 0 1px 0 #FFFFFF1C, inset 0 -2px 0 #00000066, 0 24px 60px #000A`); recessed screens `#0A0E1E` with `inset 0 6px 24px #000C`; chamfer clip-path 12px (8px small); skewX(−8°) controls with counter-skewed labels; ID plates skewX(−10°) gold gradient with hard drop.

## 3. Component grammar (locked)

- **Nav (SHELL-A):** left rail, brand logotype, gold `+ NEW SESSION` plate, group headers, angular gold selected item (right-edge slant clip), role switcher (STUDENT/MENTOR/ADMIN), BACK TO MATRIX, identity lower-left.
- **Instrument housing:** accent slash → ID plate + literal title + state readout → recessed screen with faint grid → correction plate (skewed, bordered by state color, snap animation on lock).
- **Correction plate states:** warn (amber border), ok (green), gold (LOCKED/READY, with `lockSnap` scale-settle animation). One plate per live surface, ever.
- **Toast:** gold gradient skewed chip, 2.6s in/out (`GESTURE CAPTURED · …`). Max one concurrent.
- **Channel strip (mixer):** chamfered housing, fader with gold target zone, physical knob (light top, hard shadow), value numeral, LIMITING = amber outline + glow. CORE mode shows 🔒; TRAIN mode shows ⇄ and opens the radial loadout.
- **Radial loadout:** 8 metric options on a 122px ring, gold-bordered chamfered chips, swap triggers `chanSwap` flip.
- **Tracks (recorder):** 196px GarageBand-style head (👁 eye, S solo, name), group rows collapsible (▾/▸), hatched `UNAVAILABLE` bands, gold/amber/green chip classes (event/opportunity/mark), white playhead with glow.
- **Fail-closed grammar:** hatched amber blocks + `— UNAVAILABLE` label everywhere (pitch, lost hand, coverage lane). Never silent.
- **Video stages:** radial navy vignette, skewed tag plates, REC dot; Dr Kelly panel carries state plate (colored dot + word) and `LEMONSLICE STREAM MOUNTS HERE` watermark until the real track exists.

## 4. Motion (normative timings)

Needle/marker ease 100–200ms; window/target slide 400–500ms (the slide IS the phase lesson); bracket/fader 220–300ms; lock snap 450ms scale 1.22→0.97→1 with brightness flash; HUD plate expand `flex .35s cubic-bezier(.2,.8,.2,1)`; screen transitions 280ms fade+rise; channel swap 350ms rotateX; toast 2.6s. No particles, no bloom, no glow inflation; motion communicates state only.

## 5. Density & mode law (binding, unchanged)

LIVE TRAINING = one correction (adaptive rail HUD-C); SIMULATION = zero HUD; POST = explain why (worked/fix + SAF(e) cards, separate); FILM ROOM = evidence (every claim clickable to a timestamp); MENTOR = full analytics, private render target. LAB density adds numerics/thresholds; SIMPLE strips them.

## 6. Claim safety & science (binding, unchanged from 3471C/3472)

Cap-by-weakest(+15 [CALIBRATE]), buckets of 5, visible contributors, coverage denominators, `PITCH — UNAVAILABLE` standard, `-CUE PROFILE` suffixes, no deception/credibility inference, gesture events labeled CANDIDATES, opportunities ≤4 and never "MISSED", semitones never Hz, personal baseline over population norms, self-adaptors never live/never red/never contributing.
