# Y1-Y2-CAM-V6-3522 — METRIC ONTOLOGY

**Mission:** Y1-Y2-CAM-V6-3522 · **Date:** 2026-08-24 · **Status:** SPECIFICATION (research complete; no code)
**Companion to:** `Y1-Y2-CAM-V6-3522_LIVE_INTERVIEW_BEHAVIOR_INTELLIGENCE_SPEC.md` (sections cited as §n)

This is the complete table of every recommended metric — the ones the 3521 runtime already computes (marked ● in the ID column), the ones it computes but must reinterpret (◐), and the ones newly recommended (○). Each row carries the fifteen columns the mission required. Nothing here is a requirement to build everything: the **Priority** column is the build order and **P4** rows are research only.

## Legend

| Column | Codes |
|---|---|
| **Level** | L1 direct measurement · L2 derived observable · L3 coaching interpretation · L4 composite coaching index |
| **State** | SETUP · READY · LISTEN (INTERVIEWER_TURN) · TRANS (TRANSITION) · SPEAK (STUDENT_TURN.SPEAKING) · TURN (whole student turn incl. pauses) · OVERLAP · NOTES · ALL (state-tagged) — a metric is not computed outside its listed states |
| **Live / Post** (usefulness) | H high · M moderate · L low · — none / must not be live |
| **Reliability** (today, webcam/laptop) | H · M · L · U (no validated producer yet) |
| **Evidence** | A strong · B moderate · C plausible coaching heuristic · D expert opinion · E speculative; "x/y" = evidence for the phenomenon / evidence for using it as a coaching target |
| **Personal.** | Y personalizable (baseline-relative or user-set corridor) · N not personalizable (system/coverage or research) · B baseline-relative *only* (no user-set target) |
| **Visibility** (default) | LIVE (whisper-cue eligible or setup gate) · ADV (Delivery Training rails; LAB = raw-telemetry density) · PQ post-question card · PI post-interview summary · FR Film Room only · MENTOR mentor only · INTERNAL building block, not surfaced · NO do not surface (opt-in awareness where stated) |
| **Diff.** | implementation difficulty 0 (exists) – 5 (research-grade) |
| **Priority** | P0 now (3521) · P1 next · P2 Film Room/post-session · P3 semantic · P4 research |

Row IDs: ● exists in 3521 and is kept as measured · ◐ exists but interpretation/definition changes · ○ new.

---

## A. System / Coverage (9)

| ID | Metric | Signal source | State | Level | Live | Post | Rel. | Evid. | Personal. | Visibility | Claim-safety notes | Diff. | Dependencies | Priority |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A1 ◐ | Face coverage fraction (usable-face frames / expected frames, rolling + per answer) | face landmarker + primary lock | ALL | L2 | H (glyph only when low) | H (coverage lane) | H | A (model card limits) | N | ADV | Describes the sensor, not the person; demographically patterned failures → report, never impute | 1 | primary lock, vision cadence | P0 |
| A2 ● | Hand visibility fraction (L/R, per state) | hand landmarks presence | LISTEN·SPEAK | L2 | M | H | H | A | N | ADV | Precondition for gesture metrics; absence ≠ no gesture; worst on Fitzpatrick 6, henna/jewellery | 1 | holistic worker | P0 |
| A3 ● | Upper-body / torso presence | pose 11/12 (23/24) visibility | ALL | L2 | M | H | H | A | N | ADV | Seated/wheelchair framings often lack hips → posture metrics withheld, not zero | 0 | — | P0 |
| A4 ○ | Audio signal quality: noise floor, SNR, clipping runs, processing state | AudioWorklet frames + `getSettings()` | ALL (gate at SETUP) | L1/L2 | H (setup gate; CHECK MIC cue) | H | H | A (standards, browser source) | N | LIVE | The 24 Aug session ran at −96 dBFS on a virtual device — a session may not start measurement without ≥3 s speech above floor+10 dB | 2 | worklet capture | P0 |
| A5 ○ | ASR coverage & confidence (speech-time covered, mean word prob, rejected segments) | word-timing producer | SPEAK | L2 | M (provenance badge) | H | M | B | N | ADV/LAB | Accent-dependent WER → withhold transcript metrics below 70 % coverage | 3 | ASR tier | P0 |
| A6 ● | Primary-lock state, bystander count, withheld intervals | `PrimaryIntervieweeLock` | ALL | L2 | H ("Lock to me" control) | H | H | A | N | LIVE (control) | Fails closed; keep exactly as implemented | 0 | face worker | P0 |
| A7 ● | Vision cadence, inference ms, dropped frames | pipeline diagnostics | ALL | L1 | L | H | H | A | N | LAB | Gates nod detector (needs ≥15 fps) and co-occurrence (≥25 fps) | 0 | — | P0 |
| A8 ○ | Conversational-state timeline (SETUP … CLOSE, with sub-states) | state machine: interviewer first-party events + Silero VAD + question engine + notes pane | ALL | L2 | H (gates every metric) | H (Film Room ribbon, first lane) | H (first-party) / M (VAD-only) | A (design necessity: Munhall 2004; Doherty-Sneddon 2005; Morency 2007) | N | FR | First-party events, not inference; two-state fallback when no interviewer channel | 3 | VAD, interviewer channel, question events | P0 |
| A9 ● | Observation gaps (audio/vision, reasons) | pipeline | ALL | L2 | M | H | H | A | N | FR (coverage lane) | Never interpolate across gaps | 0 | — | P0 |

## B. Conversation / Turn (10)

| ID | Metric | Signal source | State | Level | Live | Post | Rel. | Evid. | Personal. | Visibility | Claim-safety notes | Diff. | Dependencies | Priority |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| B1 ● | Answer duration | session clock per question | TURN | L1 | L | H | H | A | N | PQ | — | 0 | question boundaries | P0 |
| B2 ○ | Speaking-time ratio within own turn | VAD | TURN | L2 | L | H | H | A (Nguyen 2014: speaking time r = .53 with ratings) | Y | PQ | Descriptive; no target | 1 | VAD | P0 |
| B3 ○ | Response latency (question end → first speech onset) | interviewer offset + VAD onset | TRANS | L2 | — (never live) | H | H | A (norms) / C (video bands) | Y | PQ | Video bands (≤1.0 s unremarkable; 1–2 s fine if bridged; >2 s unbridged → coach a bridge), never the 200–250 ms conversational norm; thinking never penalised | 2 | state machine | P0 |
| B4 ○ | Verbal bridge during latency ("let me think…") | VAD burst + transcript | TRANS | L2 | — | M | M | C | N | PI | — | 3 | ASR text | P3 |
| B5 ○ | Talk-over events (count, seconds; excludes backchannels) | student VAD ≥1.0 s during interviewer activity | OVERLAP | L2 | — | M | M | B (Boland 2022: Zoom latency causes accidental overlap) | N | PI | Intent (cooperative vs intrusive) never inferred | 2 | interviewer channel | P1 |
| B6 ○ | Vocal backchannel events (≤1.0 s vocalisations during interviewer turn) | VAD | LISTEN | L2 | — | M | M | B | Y | PI | — | 2 | interviewer channel | P1 |
| B7 ○ | Acknowledgment opportunities (interviewer IPU ends ≥300–500 ms silence / turn-final cues) | interviewer VAD or TTS phrase boundaries | LISTEN | L2 | — | M | M | C (audio-only proxy for gaze windows) | N | INTERNAL | — | 2 | interviewer channel | P1 |
| B8 ○ | Acknowledgment-given-opportunity rate (nod / vocal / visible specific response within 1.5 s of an AO) | B7 + G1 + B6 + F6/F8 | LISTEN | L3 | — | H | M | C (Ward 2000; Bavelas 2002; Blomsma 2024) | Y | PI | "You acknowledged 7 of 9 points" vs own prior sessions; **no nods/min target (E)**; opt-in nonverbal coaching | 3 | nod detector | P1 |
| B9 ○ | Longest unacknowledged interviewer stretch | B8 | LISTEN | L3 | — | M | M | C | Y | PI | Observation only ("no visible or audible response during a 45-s explanation"); flag >30 s [CALIBRATE] | 2 | B8 | P1 |
| B10 ○ | Verbal uptake at turn start (references/paraphrases the interviewer) | transcript + LLM | TURN start | L3 | — | H | M | A (behaviour value: Weger 2014; Bodie 2015) / C (detector) | N | PQ/PI | The strongest-evidence listening lever; coach this over nods | 4 | ASR text | P3 |

## C. Voice — loudness (8)

| ID | Metric | Signal source | State | Level | Live | Post | Rel. | Evid. | Personal. | Visibility | Claim-safety notes | Diff. | Dependencies | Priority |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| C1 ● | RMS / dBFS / peak per frame | `measurePcmFrame` on worklet frames | ALL | L1 | (driver) | LAB | H | A | N | LAB | Device-relative; no absolute loudness claims ("you spoke at 65 dB" is prohibited) | 0 | — | P0 |
| C2 ○ | Momentary loudness, K-weighted (400 ms), speech-only | BS.1770-5 K-filter + VAD mask | SPEAK | L1 | H (corridor driver) | H | H if AGC off / M if PROCESSED | A (standard) | Y | ADV | Expressed in LU relative to baseline P50, never absolute LUFS as a target | 2 | worklet, VAD | P0 |
| C3 ○ | Short-term loudness (3 s), speech-only | as C2 | SPEAK | L1 | M | H | H/M | A | Y | ADV | — | 1 | C2 | P0 |
| C4 ◐ | Loudness corridor deviation (baseline P50 ± 6 LU; out-of-corridor duration fraction) | C2 + calibration | SPEAK | L3 | H (LOUDER cue; dwell 10–20 s) | H | M | C (corridor) / A (soft speech hurts: Miller 1976; Van Zant & Berger 2020) | Y (corridor ±3…±10 LU) | LIVE/ADV | Replaces the universal −32…−16 dBFS corridor; reported as fraction, not flicker | 2 | calibration passage | P0 |
| C5 ○ | Loudness dynamic range (P90 − P10 per answer) | C2 | SPEAK | L2 | — | H | M | A (variable volume decoded as confident) | B | PQ | No absolute target; celebrate ≥6 LU range [C] | 1 | C2 | P0 |
| C6 ○ | Trail-off events (last 1 s of answer ≥6 dB below answer P50) | C2 + turn end | end of TURN | L2 | — | M | M | C | Y | PI | — | 2 | turn boundaries | P1 |
| C7 ● | Clipping fraction | worklet | ALL | L1 | H (CHECK MIC) | M | H | A | N | LIVE (fault) | — | 0 | — | P0 |
| C8 ○ | AGC / NS / EC processing state + flat-envelope AGC detector | `getSettings()` + calibration variance | ALL | L2 | H (PROCESSED badge) | H | M | A (browser source) / C (detector) | N | ADV | If AGC persists, absolute-level metrics are labelled PROCESSED and only relative dynamics are coached | 2 | calibration | P0 |

## D. Voice — pitch / prosody (8)

| ID | Metric | Signal source | State | Level | Live | Post | Rel. | Evid. | Personal. | Visibility | Claim-safety notes | Diff. | Dependencies | Priority |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| D1 ◐ | F0 per voiced frame | MPM/NSDF (existing) + VAD gate + 5-frame median + octave-jump guard + baseline band | SPEAK | L1 | (driver) | LAB | M–H (1–5 % gross errors in clean speech) | A (method) | N | LAB | Never a Hz target; silence never renders as pitch (existing law kept) | 1 | worklet, VAD | P0 |
| D2 ◐ | Speaker-relative register (semitones from **calibration** median; rolling median as fallback flagged ROLLING) | D1 + baseline | SPEAK | L2 | M (ladder, Training) | M | M | B | B | ADV | **Never coach pitch level** (Klofstad 2012 = bias) | 1 | calibration | P0 |
| D3 ○ | Pitch variability (SD of semitones over last 10–20 s of voiced frames) | D1 | SPEAK | L2 | M (VARY drill, opt-in) | H | M | A (perception: Hincks 2005; Strangert 2008) / B (trainable: Hincks & Edlund 2009) | Y | ADV/PQ | Bands <2.0 / 2.0–3.0 / >3.0 st are heuristics; coach toward ≥+1 st over baseline, cap +3 st | 1 | D1 | P0 |
| D4 ○ | Pitch range P10–P90 per answer | D1 | SPEAK | L2 | — | H | M | B (Niebuhr & Skarnitzl 2019: 80-percentile range r = .52; min–max r = .04) | B | PQ | Use percentile range, never min–max | 1 | D1 | P0 |
| D5 ● | Voiced ratio | D1 | SPEAK | L1 | — | L | H | A | N | LAB | Diagnostic | 0 | — | P0 |
| D6 ○ | Terminal contour on declarative sentences (falling / rising) | D1 + ASR sentence boundaries | SPEAK | L2 | — | M | L–M | A (perception: Guyer 2019; Vaughan-Johnston 2024) / C (detector) | N | PI (awareness) | Never a fault; list intonation and question-form answers confound | 4 | ASR text | P2/P3 |
| D7 ○ | Creak / fry proportion at phrase ends | creak detector on raw stream (Kane 2013; Drugman 2014) | SPEAK | L2 | — | L | L (AGC/compression degrade) | B (penalty exists, tiny effect) / E (coaching benefit) | Y | NO (opt-in awareness with bias disclosure) | Women penalised more; low-pitched men false-positive; never scored | 4 | raw audio | P4 |
| D8 ○ | Uptalk proportion (rises ≥3 st over last 250–300 ms of declaratives) | D6 | SPEAK | L2 | — | L | L | B (production) / E (fault framing) | Y | NO (opt-in) | Rises alone do not signal uncertainty (Tomlinson & Fox Tree 2011) | 4 | D6 | P4 |

## E. Rate / Fluency (13)

| ID | Metric | Signal source | State | Level | Live | Post | Rel. | Evid. | Personal. | Visibility | Claim-safety notes | Diff. | Dependencies | Priority |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| E1 ○ | Word events `{tStart, tEnd, prob, producer}` on the session clock | ASR Tier A (browser Whisper timestamped) / A′ (sherpa-onnx streaming) / B (server Parakeet or per-word sidecar) / C (cloud, authorised) | SPEAK | L1 | (driver) | H | M (accent-dependent; count-preserving under substitutions) | A (method) | N | LAB | Provenance label mandatory (MEASURED local/server/cloud); no text retained unless P3 consent | 4 | VAD, ASR | P0 |
| E2 ◐ | Speaking rate — wall-clock WPM (10 s live / 30 s trend / answer) | E1 | SPEAK | L2 | H (dial; "as of ~3 s ago") | H | M | A (norms) / C (band 140–180) | Y (corridor within 110–210) | ADV/PQ | Minimum evidence ≥8 words, ≥3 s speech, ≥70 % coverage; never back-filled | 2 | E1 | P0 |
| E3 ○ | Articulation rate — speech-time WPM | E1 + VAD | SPEAK | L2 | M | H | M | A (Jacewicz 2009 ~5.1 syl/s) | Y | PQ | Headline "pace" number; labelled distinctly from E2 (30–60 % apart) | 2 | E1, VAD | P0 |
| E4 ○ | Syllable-rate estimate (nuclei/s, Tier D) | intensity peaks + voicing (de Jong & Wempe 2009) | SPEAK | L2 | M (fallback) | M | M (r ≈ 0.75 vs manual) | B | Y | ADV with ESTIMATED badge | **Never displayed as WPM**; WPM-equivalent range only after the student's own words/syllable ratio is learned from ≥3 MEASURED sessions | 3 | VAD, D1 voicing | P0 |
| E5 ○ | Delivery Speed 0–100 (corridor → 70–80; zones PAUSE/SLOW/CRUISE/ENERGIZE/TOO FAST) | E2 + corridor | SPEAK | L3 | H (dial) | M | M | C (UI metaphor) | Y | ADV | Internally WPM; mapping documented; L2 speakers capped at ≤+10 % over baseline | 1 | corridor | P0 |
| E6 ○ | Rate variability (pace variation across windows) | E2 | SPEAK | L2 | — | M | M | B (tempo variation predicted hirability: Frauendorfer 2014) | B | FR/LAB | Feeds Expressiveness | 1 | E2 | P2 |
| E7 ○ | Filler rate per 100 words (uh/um/er; optionally like/you know) | verbatim ASR (licensed) or in-browser keyword spotter | SPEAK | L2 | — (never live: self-focusing) | H | L–M | B (Naim 2018 r = .36; Bortfeld 2001 norms) | Y | PQ | Labelled ESTIMATED unless verbatim model; bands ≤3 green / 3–5 amber / >5 red are heuristics; L2 and stutter caution | 4 | ASR/KWS | P1 |
| E8 ○ | Restarts / repairs per 100 words | ASR text | SPEAK | L2 | — | M | L | B | Y | PI | — | 4 | ASR text | P3 |
| E9 ○ | Silent pauses per minute (VAD silence ≥250 ms inside turn) | VAD | TURN | L2 | — | H | H | A | Y | PQ | Pauses stay on VAD, never on ASR word times | 1 | VAD | P0 |
| E10 ○ | Pause length mean / P90 / longest; long pauses ≥1.0 s | VAD | TURN | L2 | L (BRIDGE cue, opt-in, >2.5 s) | H | H | A (perception thresholds) / C (interview extrapolation) | Y | PQ | — | 1 | VAD | P0 |
| E11 ○ | Long mid-phrase pauses (>2 s not at clause boundary) | VAD + syntax | TURN | L3 | — | M | L | C | Y | PI | Placement needs ASR + parsing | 4 | ASR text | P3 |
| E12 ○ | Mean length of runs (phrase length between pauses) | VAD | SPEAK | L2 | — | M | H | B (Hincks 2005; Niebuhr 2016: 1.25–1.39 s phrases) | Y | FR | Descriptive | 1 | VAD | P1 |
| E13 ○ | Cadence regularity (over-even phrase spacing vs ghost grid; 3490 VR) | E12 sequence | SPEAK | L3 | — | M | M | C | Y | FR | Lens, not a corridor | 3 | E12 | P2 |

## F. Face (11)

| ID | Metric | Signal source | State | Level | Live | Post | Rel. | Evid. | Personal. | Visibility | Claim-safety notes | Diff. | Dependencies | Priority |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| F1 ● | Mouth-corner elevation value (mean of mouthSmileL/R), median-filtered | blendshapes | ALL | L1 | (driver) | LAB | M (no FACS validation of MediaPipe blendshapes) | B | B (baseline percentile) | LAB | Raw values never compared across users | 0 | — | P0 |
| F2 ◐ | Smile-pattern event — count/min **by state**, % time, mean duration (baseline-corrected hysteresis; ≥0.5 s; 0.5 s refractory; quality-gated) | F1 + §7.1 definition | ALL (state-tagged) | L2 | — (never live) | H | M | B (Ambadar 2009; Ekman & Friesen 1982; Ruben 2015) | B | FR (one PQ line max) | Never "genuine"; the existing `duchenneOrGenuineSmile: UNSUPPORTED_INFERENCE` stays | 2 | state machine, baseline | P0 |
| F3 ○ | Smile onset rise-time (10→90 %) | F2 | ALL | L2 | — | M | L–M (8 fps ⇒ 125 ms resolution) | B (Horic-Asselin 2020; Namba 2022) | N | FR | "Quick-onset," never "fake"; prefer ≥15 fps | 2 | A7 | P1 |
| F4 ○ | Sustained-smile flag (>4–5 s single event; >50–60 % of a 60-s window) | F2 | SPEAK | L3 | — | M | M | C (from 4-s observational bound; Ruben 2015) | Y | PI | "May read as less serious to some interviewers," never a fault; capped in technical units (Wang 2017) | 1 | F2 | P1 |
| F5 ○ | Eye/cheek-involvement sub-label during a smile event | cheekSquint / eyeSquint above baseline ≥50 % of event | during F2 | L2 | — | L | L (AU6-type r = 0.59 even in OpenFace; glasses, screen squint) | C | B | FR (LOW confidence) | Never a genuineness verdict; perception effect only (Gunnery & Ruben 2016) | 2 | F2 | P1 |
| F6 ○ | Responsive smile (onset ≤1.5 s after interviewer turn end / humour marker) | F2 + interviewer events | LISTEN·TRANS | L2 | — | M | M | B (specific responses: Bavelas 2000; timing on video: Boland 2022) | N | PI | — | 3 | state machine | P2 |
| F7 ◐ | Facial activity index (rolling 10 s: mean absolute frame-to-frame change of the non-gaze blendshape vector + count of baseline-exceeding activations; ratio to baseline; by state) | `facialMovementRate` (existing) + activations | ALL | L2 | M (Training line only) | H | M | B (expressiveness advantageous: Kavanagh 2024; Renier 2024) | B | ADV/PI | Bands <0.5× / 0.5–2× / >2× baseline are heuristics; never "flat"; **no red ceiling**; autism/PD/depression caution | 2 | baseline | P0 |
| F8 ○ | Brow emphasis events per speaking minute (browInner/OuterUp above baseline ≥0.15–0.2 s) | brow blendshapes | SPEAK | L2 | — | L–M | M | B (Flecha-García 2010) / C (coaching) | B | FR | High rate never penalised | 1 | baseline | P1 |
| F9 ◐ | Blink rate **by state** (≥0.5 for 70–400 ms; merge <100 ms) | eyeBlink blendshapes | ALL | L2 | — | L | M (glasses glare) | A (norms) / E (coaching) | B | NO (LAB diagnostic only; **removed from HUD**) | Never a target; "within the typical conversational range" is the only permitted sentence | 1 | — | P0 |
| F10 ◐ | Head pose yaw/pitch/roll from the facial transformation matrix (replaces linear landmark proxies) | face landmarker matrix | ALL | L1 | (driver) | LAB | M–H | A | N | LAB | — | 2 | worker change | P0 |
| F11 ○ | Sustained downward head pitch (>10° below session median >5 s) | F10 | SPEAK | L3 | — | L | M | B (Witkower & Tracy 2019) | B | FR | "Reads more dominant or withdrawn depending on gaze"; lateral tilt never rewarded | 1 | F10 | P2 |

## G. Listening / Head (5)

| ID | Metric | Signal source | State | Level | Live | Post | Rel. | Evid. | Personal. | Visibility | Claim-safety notes | Diff. | Dependencies | Priority |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| G1 ○ | Nod event (≥1 pitch cycle ≥4° p-p, 0.25–1.2 s, yaw < pitch excursion, returns to baseline; merge <0.5 s) — **listening state only** | F10 at ≥15 fps | LISTEN·TRANS | L2 | — | H | M (78–93 % in lab; webcam unknown) | B (feasibility) / C (thresholds) / E (any rate target) | B | PI/FR | Counted for B8 only; never a nods/min target; bobble and aizuchi caution; women/status confound | 3 | A7 ≥15 fps | P1 |
| G2 ○ | Micro-nodding (2.6–6.5 Hz, <3–4°) | F10 | LISTEN | L2 | — | L | L | B (Hale 2020) | N | NO (log only) | Never "jitter," "anxiety," "fidgeting" | 2 | F10 | P1 |
| G3 ○ | Lateral head movement (bobble) acknowledgment candidate | F10 yaw/roll oscillation | LISTEN | L2 | — | L | L | D | N | NO (log) | Acknowledgment in South Asia; never "no" | 2 | F10 | P4 |
| G4 ○ | Stillness proportion while listening (no nod, micro-nod, smile, backchannel) | G1, G2, F2, B6 | LISTEN | L3 | — | M | M | C (Osugi 2018: static < nodding on likability) | B | FR | Describe, do not diagnose; autism produces fewer listener responses | 1 | G1 | P1 |
| G5 ○ | Speech-accompanying head animation (amplitude/rate while speaking) | F10 | SPEAK | L2 | — | L | M | A (Munhall 2004) | B | FR | Not nods; no target | 1 | F10 | P1 |

## H. Gaze / Camera (6)

| ID | Metric | Signal source | State | Level | Live | Post | Rel. | Evid. | Personal. | Visibility | Claim-safety notes | Diff. | Dependencies | Priority |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| H1 ◐ | Orientation state time-share — toward screen/camera · down/notes · away · unknown — per conversational state, rolling 60 s + per answer | F10 head pose fused with eyeLook blendshapes / iris offset over ≥1-s windows | ALL | L2 | M (LOOK UP cue, SPEAK only, dwell 5–8 s) | H | M (webcam gaze ≈4°; lens vs tile inseparable) | A (limits) / C (boundaries) | Y | ADV/PQ | **Never "eye contact %"**; replaces the cumulative eye-look-only "camera-facing balance" and unifies the three competing "facing" definitions | 3 | F10 | P0 |
| H2 ○ | Down episodes during own speaking (count, mean duration) | H1 | SPEAK | L2 | — | H | M | A (detectable ≥13–20°) / D (advice) | Y | PI | "If those were notes, place bullets near the top of the screen" | 1 | H1 | P0 |
| H3 ○ | Thinking-gaze episodes (away/down during TRANS and long pauses) | H1 | TRANS | L2 | — | L | M | A (Glenberg 1998; Doherty-Sneddon 2005) | N | FR (informational) | **Never penalised**; direction is cultural | 1 | H1 | P0 |
| H4 ○ | End-of-answer return toward screen (last sentence) | H1 + turn end | end of TURN | L3 | — | M | M | C (Kendon 1967; Ho 2015 turn-yield gaze) | N | PI | Heuristic | 2 | H1 | P2 |
| H5 ○ | Continuous-facing run >10 s while listening | H1 | LISTEN | L3 | — | L | M | C (Binetti 2016: preferred ~3.3 s bouts; Argyle 1974) | B | FR (optional note) | Optional; video "intimate distance" caveat | 1 | H1 | P2 |
| H6 ○ | Framing setup quality — camera-height proxy, face size/position, tile-placement guidance | face box + F10 at SETUP | SETUP | L2/L3 | H (framing dock) | M | H | B (Baranowski & Hecht 2018; Horstmann & Linke 2022; Gao 2025) | N | LIVE (setup) | The highest-leverage gaze intervention is tile placement + camera height, not lens-staring | 2 | — | P0 |

## I. Body / Gesture (13)

| ID | Metric | Signal source | State | Level | Live | Post | Rel. | Evid. | Personal. | Visibility | Claim-safety notes | Diff. | Dependencies | Priority |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| I1 ● | Hand speed / position, shoulder-width normalised; height band and lateral zone | hand landmarks + pose | ALL | L1 | (driver) | LAB | M (tone gaps) | A | N | LAB | — | 1 | holistic | P0 |
| I2 ○ | Rest-position clusters (low-speed dwell ≥1 s) | I1 | ALL | L2 | — | M | M | C (Kendon 2004 gesture units) | Y | LAB | Hands out of frame are *unobserved*, never at rest | 2 | I1 | P0 |
| I3 ○ | Gesture-unit events per **speaking** minute, hands-visible-conditioned (onset > max(3× noise floor, 0.15 sw/s) ≥100 ms leaving rest; 150 ms–6 s; excludes face contact / off-frame / non-speaking) | I1, I2 | SPEAK | L2 | L (activity flag in Training) | H | M | A (variability: Chu 2014) / B (illustrators help: Cascio Rizzo 2026; Maricchiolo 2009) | B | ADV (flag) / PI | **No gestures/min target**; absence never penalised; never "keep hands still" (Rauscher 1996) | 3 | state machine, A2 | P0 |
| I4 ○ | Proportion of speaking time with hands out of rest | I3 | SPEAK | L2 | — | H | M | A (Rauscher 1996 metric) | B | PI | Natural-vs-interview framing ("more restrained than your natural baseline") | 1 | I3 | P0 |
| I5 ○ | Gesture space / amplitude distribution; bimanual share | I1 | SPEAK | L2 | — | M | M | B (Koppensteiner 2017: fast/expansive reads aggressive) | B | FR | Velocity, not count, is the risk factor | 2 | I3 | P1 |
| I6 ○ | Gesture–speech co-occurrence (hand-speed peaks within ±250 ms of energy/F0 peaks) | I1 peaks + C2/D1 peaks | SPEAK | L2 | — | M | L (needs ≥25–30 fps; 8 fps today) | A (measurable: Pouw 2019/2020) / E (quality claim) | N | FR (research lens) | "n of m movement peaks coincided with vocal emphasis"; no quality score | 4 | ≥25 fps, A/V offset | P2 |
| I7 ○ | Self-touch (adaptor) events — count, duration, region, by state (hand in face box +15 % ≥300 ms; merge <500 ms) | hand–face proximity | ALL | L2 | — (never live) | M | M | B (Maricchiolo 2009 composure) / C (anxiety inference rejected: Feiler & Powell 2016) | B | FR | Never red; never in a composite; "hand-to-face contact: n," never "nervous" | 2 | I1, face box | P1 |
| I8 ○ | Repetitive-motion episodes (autocorrelation peak 0.5–4 Hz, ≥3 cycles, 6-s windows; head/shoulders/hands) | I1, pose | ALL (listening clearer) | L2 | — | M | M | C (Cutler & Davis 2000; Mahmoud 2013) | Y | NO (opt-in FR, neutral wording) | ADHD/stimming/tics/tremor — never "fidgety" or "nervous" | 3 | pose | P2 |
| I9 ◐ | Posture summaries — lateral lean, contracted-configuration share, forward lean (immediacy), drift | pose 11/12/23/24 | ALL | L2 | — | M | M (hips often out of frame) | A (contraction penalty: Elkjær 2020) / B (immediacy: Mehrabian 1968) | B | PI/FR | Descriptive ("you leaned in during answers 3 and 5"); wheelchair/seated contexts withhold | 2 | A3 | P1 |
| I10 ◐ | Movement energy (pose/hand deltas in shoulder-width units per second; fixes the current degree/normalised-coordinate mix) | pose, hands | ALL | L2 | L | M | M | C | B | ADV/FR | Not "fidgeting" | 1 | — | P0 |
| I11 ● | Hand-region activity flag (existing episode trackers ≥1.4 sw/s, 300 ms/250 ms) | episode detectors | SPEAK | L2 | M (Training) | L | M | C | N | ADV | Coarse motion, not gesture; kept as the live activity flag | 0 | — | P0 |
| I12 ○ | Note-taking events — Tier 0 (in-app notes pane keystroke/scroll), Tier 1–3 inferred (head pitch ≥20° below baseline ≥1.5 s + writing-pose micro-motion or keystroke acoustics / shoulder micro-motion / head-down only) | notes pane; F10; I1; mic transients | LISTEN mostly (also SPEAK, surfaced) | L2 (T0) / L3 (T1–3) | — | H | H (T0) / L–M (T1–3) | A (T0 by construction) / C (inference) / D (etiquette) | N | PI (count only; tier shown) | Never good/bad; never content; Tier 0 removes inference; Tier 3 = "looked down for N s" | 2 (T0) / 4 (T1–3) | product notes pane | P1 (T0) / P2 (T1–3) |
| I13 ◐ | Framing-dock deviations (face size, centre, headroom; RE-CENTRE / MOVE BACK) | face box | SETUP + live | L2 | H (cue, dwell 5–8 s) | L | H | B | N | LIVE | Replaces four duplicate "centered" HUD rows and the centering-keyed alignment gauge | 1 | — | P0 |

## J. Verbal / Semantic (9) — transcript text under explicit consent; P3

| ID | Metric | Signal source | State | Level | Live | Post | Rel. | Evid. | Personal. | Visibility | Claim-safety notes | Diff. | Dependencies | Priority |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| J1 ○ | Answer structure elements (situation / action / result; SAF(e) phases OPEN·ENUMERATE·PROVE-STORY·CLOSE) | LLM over aligned transcript | TURN | L3 | — | H | M | B (Bangerter 2014; Levashina 2014) | N | PQ (structure note) | Qualitative forever, never 1–100 (3490 law) | 4 | ASR text | P3 |
| J2 ○ | Story vs self-description classification | LLM | TURN | L3 | — | H | M | B (stories ↑, self-descriptions ↓) | N | PQ | — | 4 | ASR text | P3 |
| J3 ○ | Hedge / hesitation density ("kind of," "I guess," tag questions) | lexicon | SPEAK | L2 | — | H | M | A (Erickson 1978; Hosman 1989; Blankenship 2005) | Y | PI | L2 caution; calibrated certainty, not blanket confidence (Tenney 2007) | 3 | ASR text | P3 |
| J4 ○ | Inclusive language balance ("we"/"I") | lexicon | SPEAK | L2 | — | M | H | B (Naim 2018; Rosenberg & Hirschberg 2009) | Y | PI | — | 2 | ASR text | P3 |
| J5 ○ | Lexical richness (unique-word ratio) | transcript | SPEAK | L2 | — | M | H | B (Naim 2018) | Y | FR | L2 caution | 2 | ASR text | P3 |
| J6 ○ | Verbal charismatic tactics (stories, contrasts, three-part lists, rhetorical questions, moral conviction, confidence statements) | LLM classifier | TURN | L3 | — | H | M (85 % human coder agreement) | B (Antonakis 2011) | N | PI (content lever) | No affect inference required | 4 | ASR text | P3 |
| J7 ○ | Programme / city / interviewer-name mentions; specificity vs generic | NER vs session metadata | TURN | L2 | — | H | H | A (specificity) / B− (name use) | N | PI | Name use very low weight | 3 | metadata, ASR text | P3 |
| J8 ○ | Content-type tags per unit (positive experience · hardship · technical · values · programme-specific · question · small talk) + polarity | LLM closed label set | TURN | L2 | — | M | M | (design) | N | INTERNAL | Closed set; no free-text emotion; feeds J9 and W/K modifiers | 4 | ASR text | P3 |
| J9 ○ | Semantic–delivery congruence candidates (content type × delivery-vs-baseline deviation) | J8 + D3, C5, E3, F2, F7, I3 | TURN | L3 | — | M | L | B (components) / E (outcome claims) | Y | FR (≤4 `CONGRUENCE NOTE`s) | Never "incongruent" as verdict; never emotion; observable delivery vs stated content only | 5 | J8 + delivery lanes | P3 |

## K. Composite coaching indices (7)

| ID | Metric | Signal source | State | Level | Live | Post | Rel. | Evid. | Personal. | Visibility | Claim-safety notes | Diff. | Dependencies | Priority |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| K1 ○ | WARMTH-CUE PROFILE (Likability lens) | vocal expressiveness + capped nonverbal (smile presence/onset, responsive smiles, acknowledgment rate, listening orientation, lean) + verbal (uptake, questions, inclusive language) | ALL (state-gated) | L4 | — | H | M | B | Y | PI/FR | Perception language ("cues raters read as warm"); never a trait | 4 | contributors; coverage | P2 |
| K2 ○ | COMPETENCE-CUE PROFILE (Competence lens) | fluency (E7, E8, E11), rate band (E2/E3), falling terminals (D6), loudness stability (C2), verbal structure (J1–J6), capped nonverbal (illustrator proportion, non-contracted posture, stable head) | SPEAK | L4 | — | H | M | A/B | Y | PI/FR | Never "competent"; content competence scored separately and qualitatively | 4 | contributors | P2 |
| K3 ○ | EXPRESSIVENESS gauge | D3, D4, C5, E6, F7, I3, laughter | ALL | L4 | — (VARY drill uses D3 alone) | H | M | B (Friedman 1988; Back 2010; Kavanagh 2024) | B | PI | Baseline-relative; opt-out; no red ceiling | 3 | contributors | P2 |
| K4 ○ | COMPOSURE index | rate vs baseline, E7/E8, F0 stability, C2 adequacy, J3 | SPEAK | L4 | — | H | M | B (Feiler & Powell 2016; Powell 2018; Schneider 2019) | B | PI (detail MENTOR) | "Composure cues," never "nervous"; built from rater-used cues, not tics | 3 | contributors | P2 |
| K5 ○ | CREDIBILITY / AUTHORITY-CUE lens | K2 sub-view + calibration markers (no overclaiming) + specificity | SPEAK | L4 | — | M | M | B | Y | MENTOR (LAB) | "CREDIBILITY CUES," never "credible %"; deception inference prohibited | 3 | K2, J3, J7 | P2 |
| K6 ○ | CHARISMA profile — W × K quadrant + X gauge; optional CHARISMA-CUE BALANCE 0–100 headline (cap-by-weakest) | K1, K2, K3 | ALL | L4 | — | H | M | B (structure: Tskhay 2018; Antonakis 2011) / E (single validated number) | Y | PI (PERFORMANCE mode only) | Never a trait; the only 0–100 headline; withheld when W or K withheld | 2 | K1–K3 | P2 |
| K7 ○ | CLARITY / STRUCTURE | J1, J6, E12, E11, I3 illustrators | SPEAK | L4 | — | H | M | C/B | Y | PI | — | 4 | J-family | P3 |

---

## Summary counts

Generated from this table (see the spec §25): **99 metrics** — A 9 · B 10 · C 8 · D 8 · E 13 · F 11 · G 5 · H 6 · I 13 · J 9 · K 7. Of these, 12 exist in 3521 and are kept as measured (●), 13 exist and are reinterpreted (◐), 74 are new (○). By priority: P0 47 · P1 20 · P2 15 · P3 14 · P4 3. By default visibility (counting the first-listed placement where a cell names two, e.g. "ADV/PQ" counts as ADV): LIVE 6 · ADV 17 · LAB 9 · PQ 12 · PI 27 · FR 19 · MENTOR 1 · INTERNAL 2 · NO (do not surface; opt-in awareness where stated) 6.

## Reading rules for Codex

1. A metric's **State** column is a hard gate: outside those states the metric is not computed and its lane shows a gap, not a value.
2. **Visibility** is the *default* placement; a student may reveal ADV metrics in Delivery Training and may never reveal NO/INTERNAL metrics; a mentor may reveal MENTOR metrics; nothing marked "— (never live)" may be routed to the whisper cue.
3. **Personal. = B** means the metric is expressed relative to the student's baseline and has no user-editable target; **Y** means a corridor or band may be edited within its safety envelope by student/mentor/admin per spec §21; **N** means no personalization applies.
4. Every displayed value carries provenance (MEASURED / ESTIMATED / UNAVAILABLE), confidence (HIGH / MODERATE / LOW) and the state tag of its window.
5. The claim-safety note is part of the metric's definition: UI copy that contradicts it is a defect.
