# Y1-Y2-CAM-V6-3522 — LIVE INTERVIEW BEHAVIOR INTELLIGENCE SPECIFICATION

**Product:** MissionMed IV Prep On-Call · Interview Delivery Intelligence Engine
**Mission:** Y1-Y2-CAM-V6-3522 (Fable 5 strategy / research / specification run)
**Date:** 2026-08-24
**Status:** SPECIFICATION — research complete; no code written; no production, 3521 or 3440 files modified
**Consumer:** Codex (see `Y1-Y2-CAM-V6-3522_CODEX_IMPLEMENTATION_HANDOFF.md`)
**Companion documents:** `_METRIC_ONTOLOGY.md` (every metric, 15 columns) · `_COMPOSITE_COACHING_INDICES.md` (index formulas) · `_EVIDENCE_REGISTER.md` (605 located sources; 58 carry UNVERIFIED flags on specific figures) · `_CODEX_IMPLEMENTATION_HANDOFF.md` (P0–P4 contracts and the CURRENT STANDALONE HTML DISPOSITION)

## Boot and authority note

`~/MissionMed_OS/BOOT.md` and `authority_index.json` were not reachable from this run (the `brinyu13/missionmed-os` repository is private and the folder is not a connected location). The mission ID was taken from the task prompt. Under `_SYSTEM/PRIMER_CORE.md` §6 this is a CONTENT / AUDIT / STRATEGY task (risk LOW); no protected path, runtime asset, secret, or production surface is touched; the deliverables are written only to `_AI_HANDOFFS/from_fable/`. Authority order used: (1) the 3522 task prompt, (2) 3521 runtime code and Codex handoff records as *implementation evidence*, (3) 3490/3492/3494 Fable architecture documents as *prior design law where still defensible*, (4) 3440 donor code and showrooms as *concept research only*. The standalone HTML was treated, per instruction, as a working specimen and not as requirements authority.

## How to read this document

Every substantive recommendation carries an evidence grade in the scale the prompt defined — **A** strong empirical support · **B** moderate evidence · **C** plausible coaching heuristic · **D** expert opinion · **E** speculative or unsupported — and a citation in Author-Year form that resolves in the Evidence Register. Numbers marked **[CALIBRATE]** are starting values to be tuned on MissionMed's own data; they are engineering choices, not findings. Four signal levels are used throughout and must never be blurred in UI copy or documentation: **L1** direct measurement · **L2** derived observable · **L3** coaching interpretation · **L4** composite coaching index.

---

## 1. Executive Product Thesis

The question this run was asked to answer is not "what analytics fit on the screen" but "what would the best communication scientists, interview coaches, speech researchers, medical educators, game-UX designers and AI engineers measure, how would they interpret it, and what would they actually show the student." After a ten-domain evidence review (605 verified sources) and a full read of the 3521 runtime, the answer has eight parts. They are stated bluntly because several of them contradict the direction the current HUD implies.

**1. The learning happens after the answer, not during it.** The only randomised evidence that an automated interview coach improves blind expert ratings comes from post-session, video-synchronised feedback (MACH; Hoque et al. 2013, n = 90, p = .010 vs plain video replay). The only controlled comparison of a live performance gauge found it *worse than no feedback* (Chollet et al. 2015: expert-rated improvement 0.35 control, 0.05 gauge, 0.60 embodied audience). Live cues are tolerated only when sparse, single-word and transient (Rhema: one word for 3 s every 20 s preferred by 11/13; continuous bars "broke speech flow"). Motor-learning's guidance hypothesis (concurrent feedback helps practice, hurts retention; Schmidt & Wulf 1997; Sigrist et al. 2013) and feedback-intervention theory (about a third of feedback interventions reduce performance, chiefly those that turn attention to the self; Kluger & DeNisi 1996) explain why. *Grade A/B.* Therefore: the engine measures everything continuously; the live surface shows at most one actionable cue, off by default in simulation; the post-answer card and the Film Room are the coaching product.

**2. Voice and words carry more of the rating variance than the face.** Vocal cues outpredict visual cues for interviewer judgements (r = .32 vs .21) and for later performance (DeGroot & Motowidlo 1999); hearing a candidate raises perceived intellect while adding video adds nothing over audio (Schroeder & Epley 2015); in 62 real interviews visual features alone were non-predictive and fluency dominated (Nguyen et al. 2014); fusing face/body into hirability models "only marginally improves accuracy at the cost of increasing bias" (Booth et al. 2021); HireVue dropped facial analysis in 2021. *Grade A/B.* Therefore: fluency, prosody, pause structure and answer content are the primary coaching levers; face and body metrics are descriptive Film Room lenses and capped minority contributors, never the core of a score.

**3. Nothing means anything without conversational state.** A nod while listening is an acknowledgment; the same head movement while speaking tracks pitch and amplitude (Munhall et al. 2004). Looking away while thinking improves answer accuracy (Glenberg et al. 1998; Doherty-Sneddon & Phelps 2005) and is normal in 72–88 % of thinking time; looking away while listening is not. A silence after a hard question reads as thoughtful; the same silence mid-clause reads as searching. The 3521 runtime has no state model: it computes and displays every instrument identically whether the student is speaking, listening or thinking, and its interviewer prompt is dead DOM. *Grade A.* Therefore: an interview conversational-state machine is the foundation, and it is cheap because MissionMed controls the interviewer channel — interviewer speech onset/offset and question boundaries are first-party events, not inferences.

**4. There are no universal targets; the primary metric is within-person change.** Nod rates span 3–17/min across studies and 2× across cultures; gesture rates 0–19 per 100 words within one sample (Chu et al. 2014); face-directed gaze 20–80 % between individuals; speaking rate 150–210 wpm by genre and dialect. Within-person variance is 2–4× group variance for psychological measures (Fisher et al. 2018). *Grade A.* Therefore: GLOBAL DEFAULTS → STUDENT BASELINE → PERSONALIZED CORRIDORS, with broad coaching bands that are labelled heuristics, and mentor/admin control over targets but never over measurement.

**5. Claim safety is now a legal boundary, not only a scientific one.** EU AI Act Article 5(1)(f) prohibits inferring emotions in workplaces and education institutions (in force 2 Feb 2025); the Commission's guidelines draw exactly the line this product needs: "the observation that a person is smiling is not emotion recognition… concluding that a person is happy is." Illinois BIPA treats a scan of face geometry and a voiceprint as biometric identifiers regardless of purpose. The scientific literature draws the same line: facial configurations do not reliably index emotion (Barrett et al. 2019; Durán & Fernández-Dols 2021), and 71 % of people can produce a "Duchenne" smile on request (Gunnery et al. 2013). *Grade A.* Therefore: describe behaviours, never emotions or traits; persist no landmarks; label every proxy as a proxy; "unavailable rather than wrong."

**6. The composite architecture is two-dimensional, not four numbers.** Social perception organises around warmth/communion and competence/agency (Fiske, Cuddy & Glick 2007; Abele & Wojciszke 2007); charisma's validated inventory has exactly two factors, affability and influence (Tskhay et al. 2018); and the two dimensions trade off — broad smiles raise warmth but lower competence, and competence dominates in serious contexts (Wang et al. 2017; Judd et al. 2005). *Grade A/B.* Therefore: Likability, Credibility, Charisma and Competence are presented as **coaching lenses over a Warmth-Cue × Competence-Cue profile plus an Expressiveness gauge and a Composure index**, computed continuously, shown post-answer and post-session, never as four live numbers. This is consistent with the 3490 law (WARMTH-CUE / COMPETENCE-CUE profiles, CREDIBILITY as a LAB lens, CHARISMA-CUE BALANCE as the only 0–100 headline).

**7. Half of the current HUD measures the right signal and interprets it wrongly; a quarter measures nothing.** The 3521 engines (media bridge, primary-person lock, MediaPipe workers, MPM pitch, FACE cartridges, episode trackers, fail-closed projector, visibility law) are sound and are kept. But smile events count every mouth-corner flicker with no minimum duration; "camera-facing" is eye-look blendshapes with no head-pose fusion and three competing "facing" definitions; blink rate and camera-facing ratio are cumulative session averages; the expression trend is a slowly-varying session σ autoscaled per repaint; movement level averages normalised coordinates with degrees; the volume corridor is drawn universally (−32…−16 dBFS) under a label that says no calibrated target exists; and four body rows print the same string. Head nods, repetitive motion and note-taking occupy HUD slots while permanently unavailable. The full disposition is in the Codex handoff.

**8. Real WPM is achievable locally.** Word timestamps are the non-negotiable input; the Web Speech API exposes none and sends audio to Google. In-browser Whisper with the `_timestamped` export gives per-word times with no egress (Tier A), the existing faster-whisper sidecar becomes Tier B once it returns per-word timestamps on the session clock, and an ASR-free syllable-nucleus rate is a labelled ESTIMATE fallback that is never shown as WPM. Loudness must move from raw dBFS to K-weighted speech-only loudness against a personal baseline because browser AGC/noise suppression are on by default and cannot always be disabled.

### 1.1 Design principle restated for the HUD

DEFAULT = MINIMAL COGNITIVE LOAD is not only a UX preference; it is what the learning evidence requires. The live surface in a simulated interview is the interview. A single "next useful correction" line exists, is off until the student opts in, and is governed by an arbitration engine with dwell, hysteresis, refractory periods and a precision floor. The full instrument rails are a **Delivery Training** density, not the interview default. Self-view is hidden or thumbnail during answers (Horn & Behrend 2017; Bailenson 2021; Fejfar & Hoyle 2000). This is the 3490 mode-isolation law (SIMULATION forces NO HUD; DELIVERY TRAINING is the only instrumented mode) applied with the evidence behind it.

### 1.2 What changes for the student

Before the interview: a 90-second setup that fixes what actually moves ratings on video — camera at eye level, interviewer tile placed directly under the lens, lighting, an audio check that catches a silent microphone (the 24 Aug screenshots show −96.0 dBFS "LIVE LEVEL" for a whole session because a virtual audio device was selected), and a 45–60 s baseline passage that personalises every corridor. During the interview: a clean interview, optionally one whispered cue. Between questions: a 10–20 s card — one thing that worked, one thing to try, one goal for the next answer. After the interview: the Film Room, where the synchronised tracks, the opening-answer highlight, and mentor comments anchored to moments do the teaching.

---

## 2. Communication Science Review

This section states what the literature supports, domain by domain, at the resolution needed to design metrics. The Evidence Register carries every citation with URL, evidence type and limitations.

### 2.1 Facial behaviour

*Duchenne and "genuine" smiles.* AU6 + AU12 co-occurrence is associated with enjoyment at group level (Ekman, Davidson & Friesen 1990; Frank et al. 1993) but cannot certify an individual's state: 71 % of 96 students produced a Duchenne marker on request (Gunnery, Hall & Ruben 2013); posed and spontaneous conditions produce similar Duchenne rates (Krumhuber & Manstead 2009); a 2022 review judged the emotion-indicator evidence "mostly inconclusive" (Krumhuber & Kappas 2022). The defensible claim is perceptual: observers rate eye-involved smiles as warmer and more trustworthy (meta-analysis, Gunnery & Ruben 2016; larger for video than photographs). **Grade A for the negative claim; A for the perception effect.**

*Smile timing beats smile morphology.* Spontaneous onsets take 0.49–0.93 s; abrupt (~0.2 s) onsets and over-long apexes read as deliberate; 1.0-s offsets are rated more authentic than 0.2–0.6 s (Krumhuber & Kappas 2005; Horic-Asselin et al. 2020; Namba et al. 2022). Conversational smiles last ~2–4 s (amused 4.07 s, polite 2.02 s; Ambadar, Cohn & Reed 2009). Asymmetry is not a usable authenticity cue (Schmidt et al. 2006, 2009). **Grade B.**

*Smiling in interviews is curvilinear and job-dependent.* Hiring was maximised when applicants smiled less mid-interview than at the start and end, and smiling was negatively related to hiring for a serious job (Ruben, Hall & Schmid Mast 2015); broad smiles raise warmth but cut competence, and the competence loss dominates in high-stakes contexts (Wang et al. 2017). Facial expressiveness in general, however, is a stable trait that is socially advantageous with no documented ceiling, including over video calls (Kavanagh, Whitehouse & Waller 2024, N = 52 + 1,315; Renier et al. 2024, 823 raters). **Grade B.** No residency-specific study exists.

*Blink.* Norms: rest 17/min, conversation 26/min, reading 4.5/min (Bentivoglio et al. 1997); conversational reference range 10.5–32.5/min (Doughty 2001). Blink rate is moved by speech formulation, attention, load, screen use and dopamine; observers do read high rates as nervous (small Japanese samples). **Grade A for norms; E for coaching use.** Blink rate is a diagnostic-only signal.

*Brows and head pitch.* 84.6 % of brow raises begin within 0.33 s of a pitch accent (Flecha-García 2010) — they are emphasis punctuation, coachable as "facial punctuation" at most. Downward head pitch increases perceived dominance (N = 1,517; Witkower & Tracy 2019); lateral tilt → warmth has no located controlled evidence. **Grade B / E.**

*Sensor reality.* OpenFace AU12 intensity r = 0.85 but AU6 only r = 0.59 (Baltrušaitis et al. 2018); the MediaPipe Blendshape V2 model card reports no accuracy against FACS, a fairness check on 511 lab samples that ignores activations ≤ 0.25, and states the model is "not intended for human life-critical decisions"; landmark error 2.49–2.90 % of inter-ocular distance across skin tones, degrading beyond 80° yaw, < 50 % visibility, poor light or occlusion. **Grade B for smile-event detection; C for eye/cheek involvement; E for treating blendshape values as calibrated intensities.**

### 2.2 Listening, nods and backchannels

Listener responses are of two kinds — generic (nods, "mhm") and specific (a wince, a laugh at the right moment) — and the specific kind carries the value; distracted listeners produce fewer of both and narrators then perform worse (Bavelas, Coates & Johnson 2000, 63 dyads). Backchannels are cued by the speaker — low pitch ≥ 110 ms late in an utterance predicts a backchannel ~700 ms later (Ward & Tsukahara 2000); rising terminals and longer inter-pausal units raise the probability quadratically (Gravano & Hirschberg 2011); 83 % fall inside the speaker's gaze windows (Bavelas et al. 2002). Rates vary from ~5/min (American English) to ~11/min (Japanese) with dyad-specific consistency (Ward & Tsukahara 2000; Sbranna et al. 2022) and 3-fold individual differences facing the same speaker (Blomsma et al. 2024). Listener nods average ~6° peak-to-peak (3.3–9.7°), 42 % single-cycle, 95 % ≤ 5 cycles (Mori, Den & Jokinen 2025, 9,223 nods); there is a separate listener-specific fast-nodding regime at 2.6–6.5 Hz (Hale et al. 2020). Nodding figures are rated ~30 % more likable and ~40 % more approachable (Osugi & Kawahara 2018), but an interviewer nodding at ≈14/min produced no rapport gain (Deeb et al. 2024, N = 150). Verbal listening (paraphrase, follow-up questions) outperforms nonverbal acknowledgment on every tested outcome (Weger et al. 2014; Bodie et al. 2015: ~15 % vs ~4.5 % relative importance). **Grade A that rates vary; E for any nods-per-minute target; A that verbal uptake beats nods.**

### 2.3 Gaze and camera behaviour

Face-to-face, people look at a partner ~75 % while listening and ~41 % while speaking, with individual spread 20–80 % (Argyle & Cook 1976; Ho, Foulsham & Kingstone 2015); speakers look away when starting a turn and return by its end (Kendon 1967). True eye-to-eye contact is ~12 % of conversation in 0.36-s bursts, while participants believe it is ~70 % (Rogers et al. 2018) — "eye contact" is a perception, not a measurable event. Gaze aversion rises with question difficulty, is cognitive-load management rather than social discomfort, and improves accuracy (Glenberg et al. 1998; Doherty-Sneddon & Phelps 2005; Phelps et al. 2006). Preferred mutual gaze is ~3.3 s (2–5 s) and continuous gaze lowers liking (Binetti et al. 2016; Argyle et al. 1974). Eye contact has meta-analytic ρ = .45 with interview ratings across 63 studies, not moderated by modality (Martín-Raugh et al. 2023), but it is always bundled with smiling, nodding and posture and predicts ratings more than performance. Video is different: observers detect non-contact at ~2.7° horizontal / ~5.4° vertical (Kushner 2021); best perceived eye contact is ~2° *below* the lens and 0–3° below still reads as contact (Gao et al. 2025); the interviewer's tile in the top 3–4 cm of a laptop screen is inside that band, the default speaker-view position (7–9°) is not, and notes on the desk (≥ 13–20°) are unambiguous. Webcam gaze estimation is ~4° at best (Papoutsaki et al. 2016; Semmelmann & Weigelt 2018), MediaPipe Iris "does not infer where people are looking," and the MIT interview dataset could not predict rater-judged eye contact from head pose (r ≈ 0.33–0.40; Naim et al. 2018). **Grade A for baselines and limits; C for any threshold.** Consequence: the system can honestly distinguish *toward screen/camera*, *down/notes*, *away* and *unknown*; it cannot and must not report "eye contact %".

### 2.4 Voice and prosody

Conversational American English articulates at ~5.1 syl/s excluding pauses, with dialect (±12 %), sex and age effects (Jacewicz et al. 2009); in words per minute including pauses, interviews run ~190, conversation ~210, radio ~160, TED ~165–170, lectures ~145–155 (Tauroza & Allison 1990; Yuan, Liberman & Cieri 2006; Wingrove 2017). Slow speech reliably hurts perceived competence and persuasion; faster speech helps up to ~190–200 wpm; 214–220 wpm suppresses message processing (Miller et al. 1976; Apple et al. 1979; Smith & Shaffer 1991/1995). Pitch variability is the strongest acoustic correlate of "lively" and "charismatic": PVQ = SD(F0)/mean(F0) over 10-s windows correlated r = 0.83 with liveliness and windows below ≈ 0.15 (≈ 2.6 semitones SD) were heard as monotone (Hincks 2005); F0 range correlated r = .61 with "good speaker" and "monotonous" r = −.91 (Strangert & Gustafson 2008); an 80-percentile F0 range predicts charisma (r = .52) where min–max range does not (Niebuhr & Skarnitzl 2019); real-time semitone-SD feedback raised variation by > 2.5 st and the gain persisted (Hincks & Edlund 2009, n = 14). Confidence is *decoded* from lower mean F0, shorter/faster utterances, falling terminals and louder, more variable volume (Jiang & Pell 2017; Guyer et al. 2019, N ≈ 1,200; Van Zant & Berger 2020; Brennan & Williams 1995). Fillers run ~2.6 uh/um per 100 words in conversation (Bortfeld et al. 2001) and interview raters penalise them (r = 0.36 with overall rating; Naim et al. 2018). Gaps < 250 ms feel "connected" (Templeton et al. 2022), ≥ 700 ms reads as reluctance (Kendrick & Torreira 2015), 600/1,200 ms lower ratings cross-linguistically (Roberts et al. 2011) — but the same dyads move from 135 ms face-to-face to 487 ms on Zoom (Boland et al. 2022), so face-to-face latency norms must not be applied to video. Vocal fry penalties are small (partial η² ≈ 1 %), gender-linked and context-dependent (Anderson et al. 2014; Parker & Borrie 2018); uptalk rises per se do not signal uncertainty experimentally (Tomlinson & Fox Tree 2011). **Grade A for rate/pitch-variability perception; B for fillers; E for coaching fry/uptalk or pitch level.**

### 2.5 Interview science

Content comes first, fluency second, composure third; nonverbals rank below all three in 338 real campus interviews (Hollandsworth et al. 1979). Self-presentation correlates with ratings at r ≈ .40–.53 but with job performance at only .14–.23, and the effects collapse under structure (Barrick, Shaffer & DeGrassi 2009). Among discrete cues, professional appearance (ρ = .62), eye contact (.45) and head movement (.43) lead (Martín-Raugh et al. 2023). Initial impressions in the rapport phase predict final ratings (r = .42) and offers (r = .22) and are partly valid competence judgements (Barrick, Swider & Stewart 2010). Technology-mediated interviews run d = −.41 on ratings (Blacksmith et al. 2016), carried by reduced social presence and perceived eye contact (Basch et al. 2021); AV quality biases hirability even when raters are told to ignore it (Fiechter et al. 2018). Residency: NRMP 2024 PD Survey (N = 1,150) — interpersonal skills 89 % (4.8/5) and interactions during interviews 87 % are the top ranking factors; NRMP 2022 — 94 % of programmes fully virtual and 60 % rate virtual assessment of interpersonal skills a disadvantage; structured interviews predict PGY-1 ICS milestones r = .22 (Marcus-Blank et al. 2019). Interview anxiety lowers ratings (r = −.19; Powell et al. 2018), is inferred by observers from very few cues with speech rate as the mediator and *assertiveness and warmth impressions* carrying the effect (Feiler & Powell 2016), and does not predict job performance (Schneider et al. 2019) — which is the ethical basis for coaching it. Only 23 % of past-behaviour answers are real stories, and stories raise recommendations while self-descriptions lower them (Bangerter et al. 2014). Accent lowers perceived truthfulness and employability (Lev-Ari & Keysar 2010; Hosoda & Stone-Romero 2010; Spence et al. 2024 meta-analysis d = 0.47, not moderated by comprehensibility). **Grade A.**

### 2.6 Composite constructs

Warmth and competence are the organising dimensions (Fiske et al. 2007; Abele & Wojciszke 2007; Fiske 2018), warmth is judged first (Cuddy, Glick & Beninger 2011), and the two compensate (Judd et al. 2005; Kervyn et al. 2010). Charisma = affability + influence (Tskhay et al. 2018); charisma is trainable through 12 codable tactics, nine verbal and three nonverbal (Antonakis, Fenley & Liechti 2011, mean d ≈ .62, 85 % coder agreement). Expressiveness is the most robust nonverbal predictor of liking (Friedman, Riggio & Casella 1988; Back, Schmukle & Egloff 2010). Powerful speech (few hedges/hesitations) raises credibility (Erickson et al. 1978; Hosman 1989; Blankenship & Holtgraves 2005); calibration beats confidence (Tenney et al. 2007). Expansive posture's *perception* effect holds (Vacharkulksemsuk et al. 2016) while the hormonal power-posing claims did not replicate (Ranehill et al. 2015; Simmons & Simonsohn 2017); the meta-analytic effect is about *avoiding contraction* (contractive vs neutral g = 0.45; expansive vs neutral g = 0.06; Elkjær et al. 2020). Only illustrator gestures raise clarity/competence; raw motion does not (Cascio Rizzo, Berger & Zhou 2026, 2,184 TED talks; Maricchiolo et al. 2009). Static face morphology predicts trust judgements consensually but must be excluded on fairness grounds (Oosterhof & Todorov 2008). **Grade A/B.**

### 2.7 Human–computer interaction

Summarised in §1: post-session synced feedback beats replay (MACH); a live gauge underperforms no feedback (Chollet 2015); sparse single-word live cues are tolerable (Rhema; Logue); one-cue-at-a-time is the design of every system reporting learning (Presentation Trainer); accurate charts are not helpful charts — moment-anchored comments beat graphs (ROC Speak); video review teaches only when structured and expert-guided (Hammoud et al. 2012; Fukkink et al. 2011, d = 0.40, structured form ES 0.55 vs 0.21); clinical alarm science supplies the alerting parameters (14–19 s onset delay removes 50–67 % of nuisance alarms, Görges et al. 2009; deviation-graded delay cuts false alarms 73.5 %, Schmid et al. 2017); self-view raises cognitive load without helping (Horn & Behrend 2017). **Grade A/B.**

### 2.8 Fairness

Delivery "targets" largely encode rater biases (accent d = 0.47; women-smile expectation d = 0.41; attractiveness d = 0.37; lower pitch preferred for leaders). MediaPipe hand tracking is worst on Fitzpatrick 6 (7.25 % vs 4.88 % MNAE), untested in low light and "not appropriate" with jewellery, tattoos or henna; BlazePose Lite spans 7.3 points by tone against Google's own 7.5-point "unfair" threshold; Whisper WER is 19.7 % on accented conversational English vs ~2.7 % clean, worst for Indian, Jamaican and Nigerian English (Sanabria et al. 2023) and highest for tone-language L1 speakers (Graham & Roll 2024); consumer ASR cuts off people who stutter (Lea et al. 2023). Autistic adults find eye contact aversive, produce fewer but not less intense expressions (g = −0.48; Trevisan et al. 2018) and differ in prosody (d ≈ 0.4–0.5); ADHD movement supports working memory; Parkinson's, facial palsy, depression and social anxiety all move the coached behaviours. 4.6 % of US MD students disclose a disability. **Grade A.** Every one of these is a reason for personal baselines, per-metric opt-outs, self-declared contexts, coverage-parity audits and "unavailable rather than wrong."

---

## 3. Expert Framework Comparison

The prompt asked that Vanessa Van Edwards / Science of People be treated as one source family and compared with the academic literature. The comparison below is the basis for what the product may borrow and what it must not.

| Framework | What it gets right (and the academic counterpart) | Where it over-reaches | Product use |
|---|---|---|---|
| **Van Edwards, *Cues* (2022) / *Captivate* (2017)** | Warmth vs competence as the top-level frame (Fiske et al. 2007; Tskhay et al. 2018); nodding raises liking (Osugi & Kawahara 2018); illustrative gestures help (Cascio Rizzo et al. 2026; Maricchiolo et al. 2009); downward inflection reads as confident (Guyer et al. 2019); expansive posture as perception (Vacharkulksemsuk et al. 2016); vocal fry penalty exists (Anderson et al. 2014) | Signature numbers (465 vs 272 TED gestures; "7 seconds"; "14 s of smiling → intelligence"; "30.5 % more vocal variety") are from a non-peer-reviewed volunteer rating study with popularity confounds (**E**). Steeple, palm flash, "flexed lid," slow triple nod, "hidden hands = distrust," lateral head tilt = warmth have no peer-reviewed support (**D/E**); the evidence on head tilt runs the other way (downward tilt = dominance) | Borrow the frame and the directional cues; use none of the numbers; never use steeple/palm/lid/hands-hidden cues |
| **Antonakis charismatic leadership tactics** (2011, 2016) | 12 codable tactics (stories, contrasts, three-part lists, rhetorical questions, moral conviction, confidence goals; animated voice, facial expression, gestures); training d ≈ .62; 85 % coder agreement | Leadership speeches, not interviews; single research group | The verbal tactics are directly extractable from transcripts (P3) and give Charisma a content lever without any affect inference |
| **Fiske / Cuddy / Abele–Wojciszke warmth–competence** | Consensus two-dimensional structure; warmth primacy; compensation effect | Group-perception origin; primacy less tested on interview video | The composite core (§13–§16) |
| **Tickle-Degnen & Rosenthal rapport** (attentiveness, positivity, coordination) | Validated construct; judged best from video (Grahe & Bernieri 1999) | Coordination/mimicry need both bodies; one camera cannot measure rapport | Measure components (acknowledgment, positivity), never "rapport" |
| **Calgary–Cambridge / Kalamazoo / SEGUE / Four Habits / E.M.P.A.T.H.Y.** | Observable, teachable behaviours; E.M.P.A.T.H.Y. training raised patient-rated empathy (Riess et al. 2012, RCT) | Frameworks are consensus (D); patient encounters, not interviews | Vocabulary for coaching copy; the ACGME ICS1 milestone wording ("uses language and non-verbal behavior to demonstrate respect and establish rapport") is the residency anchor |
| **Motivational interviewing (OARS)** | Reflective listening, open questions | Clinical | Verbal-uptake coaching at turn starts (paraphrase before answering) |
| **Cuddy *Presence*, Hewlett *Executive Presence*, Cabane *Charisma Myth*** | Useful labels | Practitioner opinion (D); power-posing physiology failed replication | Labels only, over evidence-backed components |
| **Toastmasters Ah-Counter** | Fillers are coachable | No numeric target | Filler rate per 100 words with heuristic bands |
| **3490/3492 Fable prior architecture** (Guitar-Tuner Law, five-grammar instruments, cap-by-weakest composites, coverage rings, mode isolation, evidence recorder) | Almost all of it survives contact with the evidence: mode isolation and NO HUD in simulation are exactly what Chollet/Rhema/K&D imply; cap-by-weakest prevents a loud monotone reading all-green; coverage rings are the "unavailable rather than wrong" principle | Live "one correction" needs stricter alerting rules than 4 s dwell (see §19); some instrument concepts (gesture heatmaps live) were already retired | Retained as design law where cited; superseded values are called out explicitly |

---

## 4. Interview Conversation State Machine

### 4.1 Why the state machine is first-party

In IV Prep On-Call the interviewer is either the AI interviewer (Dr Kelly / avatar or text-to-speech) or a human mentor on a LiveKit track. In both cases the product *knows* when the interviewer is speaking and when a question ends: TTS/avatar playback emits onset/offset; the question engine emits question boundaries; a remote track has its own VAD. The student side is a local VAD on the student microphone. Note-taking is a first-party event if the app provides a notes pane. This makes the state machine deterministic where automated systems normally guess (Morency et al. 2007 lifted nod recognition from 81 % to 93 % simply by adding dialogue context).

### 4.2 States

| State | Entry condition | Exit condition | What it gates |
|---|---|---|---|
| **SETUP** | page loaded, media not yet requested | Start live capture | framing dock, device checks, audio-signal check, calibration passage |
| **READY** | media live, interview not started | Start interview | overlays visible, histories not yet counted |
| **INTERVIEWER_TURN** (student = LISTENING) | interviewer channel active (first-party onset) | interviewer offset + 300 ms **[CALIBRATE]** | listening metrics (acknowledgment, orientation, stillness); speaking metrics suppressed |
| **TRANSITION** | interviewer turn ended, question boundary emitted | student VAD onset ≥ 300 ms sustained | response latency; thinking-gaze episodes (never penalised); verbal-bridge detection |
| **STUDENT_TURN.SPEAKING** | student VAD on | VAD off | all speaking metrics; gesture units; speech-accompanying head motion (not nods) |
| **STUDENT_TURN.PAUSE_SHORT** | VAD off 250–1,000 ms inside turn | VAD on / > 1,000 ms | pause count; not a cue |
| **STUDENT_TURN.PAUSE_LONG** | VAD off > 1,000 ms inside turn, turn not yielded | VAD on / interviewer onset | long-pause events; candidate live cue only if > 2.5 s **[CALIBRATE]** and mid-phrase (P3) |
| **STUDENT_TURN.SEARCHING** (L3 inference, post-session only) | ≥ 2 long pauses + filler cluster + restart within 8 s **[CALIBRATE]** | — | never live; Film Room marker "searching stretch" |
| **OVERLAP.BACKCHANNEL** | student vocalisation ≤ 1.0 s during INTERVIEWER_TURN | — | vocal acknowledgment |
| **OVERLAP.TALKOVER** | student VAD ≥ 1.0 s while interviewer active | either party stops | overlap events (count only; video latency makes accidental overlap common) |
| **STUDENT_QUESTION** | student turn classified as a question (P3 transcript; P1 heuristic: student turn immediately after interviewer "any questions" boundary) | — | separate expectations (rate/gaze) |
| **NOTES** (overlay state) | notes pane keystroke/scroll events (Tier 0) or Tier 1 inference | 2 s without events | suppresses gaze-down/hands-down interpretation; counts note-taking events |
| **PHASE.OPENING / SMALL_TALK / CLOSING** (session phase) | question engine metadata (question category = rapport / closing) | next question | opening-window analytics (first 60–90 s) reported separately |
| **ANSWER_PHASE.OPEN / ENUMERATE / PROVE-STORY / CLOSE** (3490 SAF(e)) | transcript-based (P3) or mentor markers | — | phase-shaped expectations (e.g., pre-CLOSE pause is good) |

Every metric window carries a state tag; every metric definition in the ontology names the state(s) in which it is valid. A metric computed outside its valid state is not "wrong-state data" — it is not computed.

### 4.3 How meaning changes with state (design table)

| Behaviour | INTERVIEWER_TURN (listening) | TRANSITION (thinking) | STUDENT_TURN (answering) |
|---|---|---|---|
| Head nod | acknowledgment event (valid nod detector state) | assertoric nod = bridge signal | speech-accompanying motion; not a nod; reported as "animation" |
| Gaze away | worth noting if > 50 % of a long interviewer turn (C) | expected; never penalised (A) | expected at turn start; "return by last sentence" heuristic (C) |
| Gaze down | notes? (needs NOTES state) | thinking (cultural: down for some groups) | reading notes; report frequency/duration only |
| Smile | responsive smile within 1.5 s of interviewer cue = specific response (B) | — | content-dependent; sustained > 4–5 s flagged descriptively (C) |
| Silence | — | response latency (video bands: ≤ 1.0 s unremarkable; 1–2 s fine if bridged; > 2 s unbridged coach a verbal bridge) | pause structure (clause boundary vs mid-phrase, P3) |
| Hand movement | adaptor/fidget candidate (listening) | — | gesture units (speaking only) |
| Volume/pitch | not computed (interviewer audio on same mic risk) | — | computed on speech-only frames |
| Facial activity | listening expressiveness (responsiveness) | — | speaking expressiveness |

### 4.4 Signals the state machine consumes

Student VAD (Silero v5 in an AudioWorklet; onset 3 frames ≥ 0.5, offset 8 frames < 0.35; ≈ 300 ms end-of-utterance latency), interviewer activity (first-party events; fallback remote-track VAD), question-engine events (`prompt.started`, `prompt.ended`, `question.category`, `interview.phase`), notes-pane events, session clock. The level-based `AudioSignalAnalyzer` VAD in 3521 (startup-calibrated fixed thresholds, marked unvalidated) is the fallback only.

### 4.5 Failure behaviour

If the interviewer channel is unavailable (e.g., mentor audio on the same device), the machine degrades to a two-state model (student speaking / not speaking) and all listening-state metrics are UNAVAILABLE with reason `NO_INTERVIEWER_CHANNEL`; nothing is inferred from silence alone.

---

## 5. Listening Intelligence

**What the evidence supports measuring while the interviewer speaks:** acknowledgment given an opportunity; the longest unacknowledged stretch; orientation toward the screen; stillness vs restless movement; responsive smiles/brow raises as "specific responses"; and, above all, *verbal uptake at the next turn start* (referencing or paraphrasing the interviewer's words), which is the behaviour with the strongest outcome evidence (Weger et al. 2014; Bodie et al. 2015).

**What it does not support:** a nods-per-minute target (rates 3–17/min, 2× cultural variation, cued by the speaker, no rapport gain from heavy nodding — Deeb et al. 2024); "over-nodding is sycophantic" (no direct evidence; nodding is more frequent from women and toward higher-status addressees, so advising more nodding is not neutral — Helweg-Larsen et al. 2004); rapport, synchrony or mimicry scores (dyadic; one camera cannot measure them); "engaged/attentive/interested" labels (mental-state inference).

**Metrics (all P1, post-answer/Film Room; none live):**

- *Nod event* (L2): ≥ 1 head-pitch cycle, peak-to-peak ≥ 4° (≈ 1.5× the 2.6–3.2° pose error), cycle duration 0.25–1.2 s, yaw excursion smaller than pitch excursion, pitch returning within ~2° of baseline within 1.5 s; consecutive cycles < 0.5 s apart merge into one event. Valid only in INTERVIEWER_TURN and TRANSITION. Feasibility **B**, thresholds **C**. Requires head pitch from the MediaPipe facial transformation matrix at ≥ 8 fps minimum, ≥ 15 fps preferred (the 3521 vision cadence is pinned at 8 fps; nod cycles of 0.25 s need ≥ 8 samples/cycle to be reliable — raise vision fps for this detector or accept detection only of cycles ≥ 0.5 s).
- *Micro-nodding* (2.6–6.5 Hz, < 3–4°): logged, never counted, never labelled jitter or anxiety.
- *Lateral head movement* (bobble): logged as acknowledgment-candidate, never as "no"; a pitch-axis-only counter is invalid for South Asian users (R9).
- *Vocal backchannel*: student vocalisation ≤ 1.0 s during interviewer speech.
- *Acknowledgment opportunity (AO)*: end of an interviewer inter-pausal unit (silence ≥ 300–500 ms) or turn-final cue. *Acknowledgment rate* = share of AOs followed within 1.5 s by a nod, vocal backchannel, or visible specific response. Reported as "you acknowledged 7 of 9 points," compared to the student's own prior sessions. **C.**
- *Longest unacknowledged stretch*: heuristic flag at > 30 s **[CALIBRATE]**, phrased as an observation ("no visible or audible response during a 45-s explanation").
- *Orientation while listening*: share of INTERVIEWER_TURN in the *toward screen/camera* state; a whole-session share < 50 % **[CALIBRATE]** yields a post-answer suggestion to orient toward the interviewer's tile.
- *Stillness*: proportion of listening with no nod, micro-nod, smile or backchannel; describe, do not diagnose.

**Coaching copy law:** report behaviour ("3 nods, 1 'mm-hm' during the interviewer's 40-s question"), never state; offer verbal alternatives ("reference something the interviewer said before you answer"); make nonverbal listening coaching opt-in; no over-nodding warnings.

---

## 6. Speaking Intelligence

The speaking-state metric set, ranked by strength of evidence linking it to interviewer ratings (R5 §3.1), is: (1) answer content and structure — story vs self-description, specificity (P3); (2) speech fluency — rate, pauses, filled pauses, restarts; (3) composure as raters actually infer it — not depressed rate, few restarts, assertive phrasing; (4) vocal variety and vocal confidence — pitch variability, loudness variability, falling terminals; (5) appearance and the visual frame; (6) camera orientation; (7) head movement/listening signals; (8) honest self-promotion (P3); (9) facial expressiveness; (10) programme-specific interest (P3); (11) posture and gesture; (12) the opening minutes.

Consequences for the engine: fluency and prosody are computed with the highest fidelity and receive the highest composite weights; the *first answer* is analysed as its own window (thin-slice evidence: first-question performance correlates most with overall rating, Naim et al. 2018; initial impressions r = .42 with final ratings, Barrick et al. 2010); and the live cue candidates are drawn only from the fluency/loudness/orientation/framing set (§19).

Detailed definitions for rate, pauses, fillers, pitch and loudness are in §11; for face, gaze and body in §7–§9; for content in §12.

**Turn-level metrics (P0/P1):** answer duration; speaking-time ratio within the turn; response latency (video bands: ≤ 1.0 s unremarkable; 1–2 s acceptable when bridged by a nod or a verbal placeholder; > 2.0 s unbridged → coach a bridge, not speed — **C**, derived from face-to-face 600–800 ms thresholds plus the observed Zoom offset); talk-over events (count and seconds only; intent never inferred); end-of-answer signal (return toward screen on the last sentence; falling terminal contour — P2).

**Head movement while speaking:** reported as "animation" magnitude, no target; never as nods.

**Semantic-delivery congruence** is a speaking-state capability and is specified in §12.

---

## 7. Facial / Expression Intelligence

### 7.1 The smile-pattern event — claim-safe operational definition

The current 3521 detector records an event every time the mean of `mouthSmileLeft/Right` crosses 0.32 and later falls below 0.20, with no minimum duration, no baseline, no refractory period and no state tag; during speech it over-counts articulation flicker. The definition below replaces it. Items marked **[evidence]** have empirical support; items marked **[heuristic]** are engineering choices and must be documented as such.

1. **Signal** `s(t) = mean(mouthSmileLeft, mouthSmileRight)`, median-filtered over ~100–150 ms **[heuristic; the model card warns of jitter]**. Do not use left–right difference as an authenticity cue **[evidence: Schmidt et al. 2006, 2009 found no diagnostic asymmetry]**.
2. **Personal baseline** `b` = 5th–10th percentile of `s(t)` over the calibration passage and the first 60 s of the session (OpenFace-style person-specific bias correction; Baltrušaitis et al. 2018). Blendshape coefficients are not calibrated intensities and were evaluated by Google only above 0.25 activation, so absolute thresholds must not be compared across users **[evidence: model card]**.
3. **Onset with hysteresis:** event starts when `s(t) − b ≥ θ_on` (default θ_on such that raw ≈ 0.30 for a typical baseline **[heuristic]**) and ends when `s(t) − b < 0.6·θ_on` for ≥ 0.3 s **[heuristic]**.
4. **Minimum duration ≥ 0.5 s** to count as an event **[evidence for the order of magnitude: spontaneous onsets alone take 0.49–0.93 s; conversational smiles average 2–4 s; exact cut-off heuristic]**.
5. **Refractory period 0.5 s** after offset **[heuristic; suppresses lip-corner flutter around speech]**.
6. **Onset rise-time** (10 %→90 % of event peak) reported descriptively; rise-times < ~0.2 s are the abrupt onsets observers tend to read as deliberate **[evidence B]**; the UI says "quick-onset," never "fake."
7. **Sustained-smile flag**: single event > 4–5 s or smile present > 50–60 % of a 60-s window **[heuristic, motivated by the 4-s observational upper bound and the "less is more" interview finding]**; copy: "sustained smiling may read as less serious to some interviewers," never a fault.
8. **Eye/cheek-involvement sub-label**: `mean(cheekSquint)` or `mean(eyeSquint)` above its own baseline for ≥ 50 % of the event → "smile pattern with eye/cheek involvement," shown at LOW confidence (AU6-type detection r = 0.59 even in OpenFace; confounded by screen-squinting and glasses) and never as a genuineness verdict. The projector's `duchenneOrGenuineSmile: UNSUPPORTED_INFERENCE` stays exactly as it is.
9. **State tag** on every event (listening / transition / speaking); **responsive-smile** sub-type when onset falls within 1.5 s of an interviewer turn end or a first-party humour/positive-content marker (P2).
10. **Quality gating**: suppress when face confidence < 0.5, |yaw| or |pitch| > 30° **[heuristic, stricter than the 80° model-card limit because AU accuracy degrades earlier]**, face box < 15 % of frame height, or the lighting warning fires.

Outputs: events per minute of *speaking* and of *listening* separately; % time; mean duration; rise-time distribution; sustained flags; responsive-smile count. Live: none (a smile counter is the archetypal self-focusing cue). Post-answer: at most one line ("you smiled when you mentioned the rotation you loved — that read as warm"). Film Room: smile-presence track.

### 7.2 Facial activity index (replaces "expression / geometry trend")

Concept kept: a live line that distinguishes low observable facial change from healthy variation. Definition changed. The current value is the mean over cartridges of the standard deviation of *all* samples since session start (slowly varying, then autoscaled per repaint, which visually amplifies noise), in a 120-sample buffer labelled "Last 60 s" that actually holds ≈ 15 s at 8 fps.

Replacement (L2): over a rolling 10-s window **[CALIBRATE]**, the mean absolute frame-to-frame change of the non-gaze blendshape vector (the existing `facialMovementRate`), plus the count of distinct baseline-exceeding activations (mouth, brow, cheek/eye, jaw), expressed relative to the student's calibration baseline as a ratio; computed separately for speaking and listening. Display bands **[heuristic]**: < 0.5× baseline "low observable facial movement," 0.5–2× "in your usual range," > 2× "high"; colours only in Delivery Training density; never the word "flat" (deficit framing; autism, Parkinson's, facial palsy, depression all lower it — R9). Evidence that expressiveness is socially advantageous with no ceiling (Kavanagh et al. 2024) means the index has no "too high" red zone; the only documented cost is smile-specific and is handled in 7.1.

### 7.3 Brow emphasis movements

`browInnerUp`/`browOuterUp` above baseline for ≥ 0.15–0.2 s **[heuristic]** during SPEAKING, counted per minute of own speech; near-zero over long answers can be surfaced post-session as low facial punctuation (**C**); a high rate is never penalised.

### 7.4 Blink

Diagnostic only. Detect with `eyeBlink ≥ 0.5` for 70–400 ms (or EAR < 0.2), merge closures < 100 ms apart; report per minute *by state* against the conversational reference range 10.5–32.5/min. Never a target; never on the HUD; Film Room LAB lens only; suppressed for glasses glare. The 3521 blink rate (cumulative session average, denominator = elapsed clock including face-absent periods) is removed from the HUD.

### 7.5 Head pose

Replace the linear landmark proxies (`yaw = (nose.x − eyeCenter.x)/eyeDistance × 35`, uncalibrated) with the MediaPipe facial transformation matrix (Euler angles). Sustained downward pitch (> 10° below session median for > 5 s **[heuristic]**) is a descriptive Film Room note ("head lowered — reads more dominant or withdrawn depending on gaze"; Witkower & Tracy 2019). Lateral tilt is not rewarded.

### 7.6 What the face rail must not say

No emotion words, no "genuine/authentic," no asymmetry judgements, no cross-user comparison of raw blendshape values, no claim of equal accuracy across skin tones/glasses/facial hair/lighting, no universal smile target, no claim that more smiling improves residency outcomes.

---

## 8. Eye / Camera Intelligence

### 8.1 What can be honestly labelled

Four coarse states from head pose fused with iris/eye-look direction over ≥ 1-s windows, each with confidence:

| Label | Meaning | Rough trigger **[heuristic; tune on pilot data]** | Evidence status |
|---|---|---|---|
| **Toward screen/camera** | head roughly frontal, eyes in the upper-screen zone (lens *and* interviewer tile — not separable) | pitch within ±8°, yaw within ±10°, iris not strongly down | boundaries C; inseparability of lens vs tile A |
| **Down / notes** | sustained eye + head pitch toward desk or lower screen | pitch ≤ −12…−15° or iris strongly down ≥ 1.5–2 s | angular separation A; cut-off C |
| **Away (side/up)** | yaw or eye direction off-screen laterally or upward | yaw ≥ 15–20° or upward offset with head tilt ≥ 1 s | detectable B; cut-off C |
| **Unknown** | occlusion, glare, partial face, low confidence | landmark confidence low | required by vendor limits A |

Never emit "eye contact," "eye contact %," "gaze avoidance" or "engagement." The current HUD card is labelled "Camera-facing balance" but measures eye-look blendshapes only, with no head-pose compensation, as a *cumulative* ratio since session start; three different "facing" definitions coexist in the code. Replace with the fused four-state model over rolling windows, reported per conversational state.

### 8.2 State-dependent expectations

| State | Face-to-face pattern | Video adjustment | What the coach may say | Grade |
|---|---|---|---|---|
| Listening | ~75 % face-directed; look more while being asked than answering (Freeth et al. 2013; holds on video) | interviewer expects visible attention | if toward-screen < ~50 % of listening across the session, suggest orienting to the tile | B / C flag |
| Speaking, routine | ~41 %, look away at turn start, return at end | reads as "down" if tile is mid-screen — fix tile placement | do not flag turn-start aversion; note answers that end without returning | B / C |
| Thinking pause | aversion is the norm (72–88 %) and improves accuracy; direction cultural | unchanged | **never penalise**; at most coach a verbal bridge for > several seconds, and returning to the screen to deliver the answer | A / C |
| Serious answer | more aversion while composing; gaze is not a truth cue (liars show *more* deliberate contact — Mann et al. 2012) | continuous gaze lowers liking | "return to the screen for the key sentence"; no honesty wording | B |
| Note-taking | down state is unambiguous (≥ 13–20°) | discouraged while answering (D) | report frequency/duration of down episodes in own turns; suggest bullet notes near the top of the screen | D advice / A detectable |
| Small talk | face-gaze bouts ~2.2 s; preferred 3.3 s | speaker-view faces simulate intimate distance | optionally note continuous facing > 10 s while listening | C |

### 8.3 The intervention that matters is setup

Because perception thresholds (≈ 2.7° / 5.4°; best contact ≈ 2° below the lens) and laptop geometry put the interviewer tile 3–5° below the lens when dragged to the top of the screen but 7–12° at default position, the single most evidence-consistent coaching action is **"drag the interviewer's tile directly under the webcam and shrink it; raise the laptop to eye level"** (Horstmann & Linke 2022; Gao et al. 2025; Baranowski & Hecht 2018). This belongs in SETUP, with a one-time in-product explainer, and it removes most of the need for live gaze coaching.

### 8.4 Fairness controls

"Gaze feedback off" setting; in-product note that looking away while thinking is normal and helps accuracy; a one-tap "my eyes may not track" flag (strabismus, nystagmus, prosthesis, thick glasses) that suppresses eye-direction features and keeps head pose only; within-person change only; low-confidence frames are *unknown*, never *away*.

---

## 9. Gesture / Body Intelligence

### 9.1 What is defensible

*Raw (L1):* hand visibility fraction; wrist/index-tip speed normalised by shoulder width; hand height band and lateral zone (McNeill's gesture space mapped to the body); hand–face proximity; torso lean, shoulder tilt; motion-energy spectra 0–8 Hz.

*Derived (L2), display as counts/durations, never scores:* gesture units per **speaking** minute, conditioned on hands-visible time; proportion of speaking time with hands out of rest (Rauscher et al. 1996's metric); amplitude/space distribution; bimanual share; self-touch events by state; repetitive-motion episodes; posture summaries (share of time contracted vs neutral/open; forward lean); gesture–speech co-occurrence (research lens).

*Interpretive (L3), heavily hedged or not at all:* "leaned in during answers 3 and 5" (observation) — yes; "composed" from low adaptor rate — only as "fewer self-touches than last session"; nervous/anxious/confident/dominant/honest/trustworthy/interested/"power"/hormones/note-taking intent — never.

### 9.2 Operational definitions

**Rest position.** Per session, cluster low-speed (< 0.05 shoulder-widths/s) hand positions with ≥ 1 s dwell; dominant clusters are rest poses; recompute on posture change; hands out of frame are *unobserved*, never *at rest*.

**Gesture unit / event** (Kendon 2004; Kita et al. 1998; Pouw & Dixon 2019): onset when smoothed wrist speed exceeds max(3× session low-speed noise floor, 0.15 shoulder-widths/s) for ≥ 100 ms *and* the hand leaves the rest cluster; stroke = the peak-velocity/deceleration segment (typical event 0.3–1.5 s; mean 758 ms, SD 431); offset when the hand returns to rest or speed stays below threshold ≥ 500 ms (holds allowed); minimum unit 150 ms; units > 6 s split at velocity minima; exclude hand–face contact, below-frame-edge, and non-speaking events (counted separately as listening-phase movement). The 3521 episode tracker (speed ≥ 1.4 shoulder-widths/s, min 300 ms, release 250 ms) is a reasonable *coarse* motion detector but its threshold is ~10× the onset level above and it fires on posture shifts; it is kept as the "hand-region activity" flag and the unit detector is added.

**Gesture space / amplitude.** centre-centre (chin to sternum, ~1 shoulder-width), centre (waist to chin), periphery, extreme periphery; amplitude = stroke path length in shoulder-widths; saliency = size × height ordinal (Chu et al. 2014).

**Self-touch (adaptor) event.** Any hand landmark inside the face box expanded 15 %, or within 0.6 inter-ocular distances of hair/neck/ear landmarks, sustained ≥ 300 ms; merge gaps < 500 ms; sub-label region for display, never affect. Expected passive baseline ~23 touches/hour (Kwok et al. 2015); interview rates unknown — build the norm from MissionMed's corpus. Per 3490 law, self-adaptors are never surfaced live, never red, and contribute to no composite.

**Repetitive motion.** 6-s sliding windows; autocorrelation/spectral peak of each tracked point's speed; periodic if a single dominant peak at 0.5–4 Hz with ≥ 3 cycles and low spectral flatness (Cutler & Davis 2000; Mahmoud et al. 2013); distinguish from beats (co-speech, larger, non-stationary); leg bouncing leaks as 1–3 Hz shoulder/head oscillation → "rhythmic upper-body movement." **OFF by default; opt-in with neutral wording** (ADHD movement supports working memory; stimming is self-regulatory; tic suppression is effortful — R9).

**Gesture–speech co-occurrence.** Fraction of hand-speed peaks within ±250 ms of an audio-energy/F0 peak (window from Pouw & Dixon 2019: beat lag M = 7 ms, SD 230; 29.97-fps video recovers peak timing at r > .75 vs 240 Hz mocap). Report "n of m movement peaks coincided with vocal emphasis"; no quality score until validated; requires ≥ 25–30 fps sustained and known A/V offset, so it is a Film Room/research lens, not a live metric at the current 8 fps.

**Posture.** Mean lean; share of time in a contracted configuration (shoulders forward + arms close to torso + head down) vs neutral/open; postural drift. The actionable evidence is about *avoiding contraction* (g = 0.45) rather than expanding (g = 0.06) (Elkjær et al. 2020); fast/expansive motion reads as aggressive and less trustworthy (Koppensteiner et al. 2017) — so velocity, not count, is the risk factor.

### 9.3 Is there a gestures-per-minute target? No.

Published rates span ~5–70 hand movements per speaking minute depending on task, coder and person (Chu et al. 2014: 6.05 representational gestures/100 words, SD 4.48, range 0–19; Shattuck-Hufnagel & Ren 2018: ~67 strokes/min in lecture). Recommended approach: normalise by speaking time; use the student's own first session as baseline; surface only extremes as "consider" prompts — (a) hands visible ≥ 60 % of speaking time but zero gesture units for a whole answer, (b) sustained motion above the corpus 95th percentile or space consistently in the extreme periphery, (c) adaptor duration > ~10 % of an answer **[all heuristic]**; corpus percentiles only after several hundred sessions with the same framing, and only for hands-visible time. Never advise "keep your hands still" — restricting gesture reduces fluency (Rauscher et al. 1996). "Visible hands increase trust" has no located peer-reviewed support (**E**); hands-in-frame is a *precondition for measurement*, nothing more.

### 9.4 Framing

Camera at eye level maximises trust (Baranowski & Hecht 2018); head-and-shoulders with room for hands at chest height so illustrators can be seen; expect lower baseline ratings on video than in person (d = −0.41) and do not import in-person norms. Framing is a SETUP instrument (the 3490 FF1 dock with corner brackets and priority corrections) and a single live cue ("re-centre" / "move back"), not four HUD rows that print the same word.

---

## 10. Note-Taking Intelligence

**Behavioural viability.** There is no empirical study of applicant note-taking in interviews; etiquette guidance converges (brief handwritten notes, ideally announced, never while answering, keep eyes up; Yale OCS advises against typing because keyboard sounds distract) — **Grade D**. Notes are also a legitimate accommodation (ADHD, memory, anxiety, non-native speakers using prompts), so the count is neutral, as the prompt already stipulates.

**Technical viability.** Typing leaks into upper-body motion even with hands off-frame (Sabra et al. 2021) and keystrokes are acoustically distinctive (Asonov & Agrawal 2004; Harrison et al. 2023); writing/phone/head-bowing are confusable in image datasets (SCB-Dataset3). Inference can therefore reach moderate confidence but never certainty about *what* the hands are doing.

**Recommendation — make note-taking first-party (Tier 0) and treat inference as a fallback:**

| Tier | Definition | Confidence | Use |
|---|---|---|---|
| **0 — in-app notes pane** | keystroke/paste/scroll events from a notes panel inside the interview surface | ground truth | NOTES state; suppresses gaze-down/hands-down interpretation; timeline of when notes were taken relative to questions; clean labels for any future detector |
| 1 — inferred, high | head pitch ≥ 20° below the student's speaking baseline for ≥ 1.5 s **and** (a) visible hand in writing/typing pose with small-amplitude 2–6 Hz wrist/finger motion, or (b) acoustic keystroke transients (detection only, never content) | moderate-high | "possible note-taking" event |
| 2 — inferred, moderate | head-down as above **and** shoulder/upper-arm micro-motion consistent with typing while hands are out of frame | moderate | "possible note-taking" |
| 3 — low | head-down only | low | "looked down for N s" — not note-taking |

Outputs: count of note-taking events per interview and per question; durations; state at which they occurred (during interviewer turn = etiquette-consistent; during own answer = surfaced as observation). Distinguish from fidgeting (periodic, not head-down), phone use (hand near lap, head down, no writing pose — reported as "looked down"), scratching/face touch (self-touch detector). Priority: Tier 0 is P1 product integration; Tier 1–3 detector P2. The current HUD slots "Notes detection: UNAVAILABLE / Notes confidence: NO VALIDATED PROXY" are removed until Tier 0 exists.

---

## 11. Voice / Prosody Intelligence

### 11.1 Architecture

Three independent lanes on one session clock: (a) an AudioWorklet capture path stamping every 128-frame block with `currentFrame`, resampled to 16 kHz for VAD/ASR while keeping the native rate for loudness and F0; (b) a VAD lane (Silero v5) that gates everything; (c) a word-timing lane (Tier A–E, §11.3). The analyser-based 2048-sample, non-contiguous 50-ms tick in 3521 is replaced by contiguous worklet frames; the 20-Hz `measurePcmFrame` (RMS/peak/clip) survives as the raw driver.

### 11.2 Volume — personal calibration

*Measurement (L1, unchanged in meaning):* RMS/dBFS per frame, clipping runs, noise floor.
*Coaching layer (L2/L3):* ITU-R BS.1770-5 K-weighted **momentary loudness (0.4 s)** and **short-term loudness (3 s)** per EBU Tech 3341, computed on VAD speech frames only, expressed in LU relative to the student's baseline P50. Corridor = baseline P50 ± 6 LU **[CALIBRATE]**; out-of-corridor reported as duration fraction, not instantaneous flicker; dynamic range = P90 − P10 per answer (louder and more variable volume is decoded as confident — Van Zant & Berger 2020, Ko et al. 2015; no absolute target); trail-off event = last 1 s of an answer ≥ 6 dB below the answer P50 **[C]**.
*Calibration:* 45–60 s baseline passage with normal/soft/emphasised cue lines at session start on each new `{deviceId, label}`; rolling P10/P50/P90 on speech frames; device profile keyed by `{deviceId, label, sampleRate, AGC/NS/EC settings, userAgent}`; re-calibrate when `getSettings()` changes or lighting/device changes.
*AGC reality (A, from source code):* Chromium enables AGC/NS by default tied to echo cancellation; Firefox defaults AEC + high NS + AGC2 + HPF and uses macOS platform voice processing by default; Safari exposes only echoCancellation. Request `{echoCancellation:false, autoGainControl:false, noiseSuppression:false, channelCount:1}` on the measurement track, read back `getSettings()`, and if AGC persists label absolute-level metrics `PROCESSED` and coach only relative dynamics; add a flat-envelope AGC detector on the calibration passage.
*The universal −32…−16 dBFS corridor drawn by the current HUD is removed.* Absolute dBFS keeps two jobs: clipping and "no signal" detection. The 24 Aug screenshots (−96.0 dBFS "LIVE LEVEL" for a whole session on a virtual audio device) show why a SETUP audio-signal gate is P0: no measurement session may start without ≥ 3 s of speech above noise floor + 10 dB on the selected device.
*Do not destroy raw data:* raw dBFS, LUFS and corridor deviations are all persisted per window with provenance.

### 11.3 Speaking speed — real WPM

*Internal truth:* word events `{text?, tStart, tEnd, prob, producer}` on the session clock; **speaking rate** (wall-clock WPM, 60·N/W over 10-s live and 30-s trend windows) and **articulation rate** (60·N/speech-time) both retained and labelled distinctly (they differ by 30–60 % in presentations); minimum evidence N ≥ 8 words, ≥ 3 s speech, ASR coverage ≥ 70 % of speech time; provenance `MEASURED (local | server | cloud ASR)`, `ESTIMATED (syllable rate)`, `UNAVAILABLE`; live tile shows "as of ~3 s ago" and greys after 8 s.

*Producer ladder (R8):*

| Tier | Producer | Label | Egress | Latency (P50/P95) |
|---|---|---|---|---|
| A | In-browser Whisper (`onnx-community/whisper-base_timestamped`, `return_timestamps:"word"`, Transformers.js v3, WebGPU→WASM by load-time benchmark), Silero-VAD segmentation ≤ 10 s, forced decode every 5 s with 1-s overlap, LocalAgreement-2 confirmation | MEASURED (local ASR) | none | 3.5 s / 6 s |
| A′ | sherpa-onnx streaming Zipformer (WASM; native token timestamps) — bake-off on IMG-accent corpus; current EN models are LibriSpeech-2023 | MEASURED (local ASR, streaming) | none | 0.8 s / 1.5 s |
| B | First-party server: sherpa-onnx + NVIDIA Parakeet-TDT-0.6b-v3 int8 (6.34 % avg WER, word timestamps, CC-BY-4.0, CPU RTF ≈ 0.09) or the existing faster-whisper sidecar with `word_timestamps=True` | MEASURED (server ASR) | first-party, authorised | 1.5 s / 3 s |
| C | AssemblyAI Universal-Streaming / Deepgram Nova-3 | MEASURED (cloud ASR) | third-party, separately authorised | 0.5 s / 1.5 s |
| D | Syllable-nucleus rate (de Jong & Wempe 2009) on VAD speech frames | ESTIMATED (syl/s) — never WPM; a WPM-equivalent *range* only after the student's own words-per-syllable ratio is learned from ≥ 3 MEASURED sessions | none | ≤ 100 ms |
| E | VAD-only | UNAVAILABLE (WPM) + pauses/latency/speaking time | none | ≤ 100 ms |

Web Speech API is rejected as a WPM source (no word timing in the IDL; cloud default; the Chrome 139 on-device mode still has no timestamps). Honesty controls: VAD gating before decode (the single most effective hallucination mitigation), overlap check (drop words with < 50 % overlap with VAD speech), rate plausibility (> 7 words/s sustained, > 30 % words < 40 ms), 3-gram loop detection, a silence-artefact phrase deny-list, Whisper thresholds (compression ratio 2.4, logprob −1.0, no-speech 0.6), `condition_on_previous_text=false`. Fillers: Whisper omits most fillers; verbatim models are non-commercial (CrisperWhisper CC-BY-NC) or AGPL (whisper-timestamped); filler counts are therefore `ESTIMATED` via an in-browser keyword-spotter unless a licensed verbatim model ships. The 3521 producer contract (6-s MediaRecorder windows, aggregate counts, no text) is the transitional Tier B shape and is kept until per-word timestamps are validated against a hand-timed reference set.

*Coaching layer — the game-like speedometer:* internal WPM → **Delivery Speed 0–100** by a piecewise-linear map anchored so that the personalised corridor `[lo, hi]` maps to gauge 70–80: `g = 70·(wpm/lo)` for wpm < lo; `70 + 10·(wpm−lo)/(hi−lo)` inside; `80 + 20·(wpm−hi)/(hi_cap−hi)` above, where `hi_cap = hi + 60` **[CALIBRATE]**. Zones (3490 VCLOCK naming): PAUSE / SLOW / CRUISE (70–80) / ENERGIZE / TOO FAST. Global default corridor 140–180 wpm wall-clock (heuristic **C** from interview ≈ 190, TED ≈ 165–170, lectures ≈ 150); after calibration corridor = baseline P50 × [0.92, 1.10] **[CALIBRATE]**, clamped to the safety envelope 110–210 so the system never coaches toward extremes; L2 speakers: never an absolute target, coach pause pruning and run length first, cap the target at ≤ +10 % over baseline (Munro & Derwing 2001 curvilinear). Admin/student may edit the corridor; they may not edit the measurement. Flag only sustained deviations (dwell ≥ 10–20 s).

### 11.4 Pitch and prosody

*Measurement:* keep the MPM/NSDF estimator (clarity 0.45, 55–500 Hz, silence floor) with three additions — voicing = clarity ∧ VAD speech ∧ level ≥ noise floor + 10 dB; 5-frame median filter and octave-jump rejection (> 7 st between adjacent voiced frames unless sustained 3 frames); search band narrowed to baseline median ± 1 octave after calibration.
*Reference:* baseline median F0 from the calibration passage (stable), not the drifting 1,800-voiced-frame rolling median; rolling median retained as a fallback with a `ROLLING` provenance flag.
*Teaching abstraction:* speaker-relative register (semitones from baseline median; the existing ±2 ladder) is correct; add **pitch variability = SD of semitones over the last 10–20 s of voiced frames** (Hincks & Edlund 2009's exact operationalisation) and **per-answer P10–P90 span** (Niebuhr & Skarnitzl 2019). Bands **[heuristic B/C]**: 10-s SD < 2.0 st "narrow," 2.0–3.0 "moderate," > 3.0 "wide"; coach toward ≥ +1 st over baseline, cap encouragement at +3 st (sing-song risk; naturalness was judged by only two raters in the training study). The prompt's "average pitch over one-minute windows" is not the right abstraction: a one-minute mean hides everything that matters, and pitch *level* must never be coached (sex-linked; lower-pitch preference is a documented bias — Klofstad et al. 2012). Terminal contour on declaratives (falling vs rising) needs ASR sentence segmentation (P2/P3) and is awareness-only. Fry and uptalk: opt-in awareness modules with explicit bias disclosure, never scored (§23).

### 11.5 Pause / silence / cadence

Silent pause = VAD silence ≥ 250 ms inside a turn; long pause ≥ 1.0 s; response latency = interviewer end → first speech onset (§6 bands); pause count/min, mean and P90 length, longest pause; pause *placement* (clause boundary vs mid-phrase) needs ASR + syntax (P3). Pauses stay on VAD, never on ASR word times (Whisper DTW timestamps are decision-time estimates). Cadence regularity (3490 VR "phrase rail vs ghost grid": over-even phrase spacing) is a P2 Film Room lane; the evidence for an "over-regular" penalty is C (monotony perception literature), so it is a lens, not a corridor.

### 11.6 Vocal Variation display

Keep the engine and the three-trace history; change the default. Default (SIMPLE density): a single **Vocal Variety band** = pitch variability SD (10 s) with the loudness dynamic range as a second thin bar, both speech-only and relative to baseline; the three raw traces (volume, pitch, speed) remain available on demand (STANDARD/LAB) with independent toggles as today. Add pause density as an optional fourth trace. Gate all traces on speaking state so the volume trace does not dip to the floor during listening (currently silence frames are included). Composite law applies: a loud monotone can never read all-green (cap-by-weakest).

---

## 12. Semantic Delivery Congruence

### 12.1 Scope and claim boundary

The engine compares **observable delivery** with the **stated content type** of what the student is saying. It does not read emotion. The permitted sentence is "your delivery was flatter than your own baseline while you were describing something you said you loved"; the prohibited sentence is "you seemed unenthusiastic." Under the Commission guidelines this is observation of movement and prosody, not emotion recognition, provided no state is attributed to the person. Requires transcript text, which the 3521 runtime deliberately never receives; enabling it is a governed change (consent, on-device processing preferred, retention limits — §23/§24). Priority P3.

### 12.2 Design

1. **Segment the transcript** into content units (sentence/clause) aligned to the session clock via ASR word times.
2. **Tag each unit** with a content type from a small closed set — *positive experience* ("I loved my rotation there"), *hardship / loss / failure*, *technical / factual*, *values / motivation*, *programme-specific*, *question to interviewer*, *small talk* — and a polarity, using an LLM classifier constrained to those labels (no free-text emotion).
3. **Compute delivery features per unit** relative to the student's baseline: pitch variability, loudness dynamic range, articulation rate, smile-pattern presence, facial activity index, gesture units per minute.
4. **Congruence rule set (L3):** flag a *candidate* only when a unit's content type has a strong expectation and the delivery deviates from baseline in the opposite direction — e.g., *positive experience* + (pitch SD and facial activity both < 0.5× baseline) → "delivery flatter than your baseline while describing something positive"; *hardship* + (smile-pattern present > 50 % of the unit with high intensity) → "sustained smiling while describing a serious event may read as incongruent"; *technical* + (broad sustained smile) → competence trade-off note (Wang et al. 2017). Neutral content types generate nothing.
5. **Surface** post-session only, ≤ 4 candidates per interview (3490 opportunity law), labelled `CONGRUENCE NOTE`, never `INCONGRUENT`, with the clip link and the two contrasting numbers.

Evidence: expressiveness is socially advantageous (B); smile intensity trades warmth for competence in serious contexts (B); congruence-specific interview outcome evidence does not exist (**E** for outcome claims) — hence post-session, candidate-only, research-labelled until validated.

### 12.3 Programme / interviewer semantic coaching (P3)

From transcript + session metadata (programme name, city, specialty, interviewer name/role): mentions of programme name and city, appropriate interviewer-name use (very low weight; the name-use evidence is consumer-setting B−), programme-specific references, specificity vs generic answers (story vs self-description classification — Bangerter et al. 2014), hedge density, "we/I" balance, three-part lists / contrasts / rhetorical questions (Antonakis verbal CLTs, 85 % coder agreement), answer structure elements (situation / action / result; SAF(e) phases). These are content levers with A/B-grade evidence and require no face/voice inference; they belong in the post-answer structure note and the Film Room, and they feed the Competence-Cue profile's verbal contributors.

---

## 13–16. The Composite Coaching Indices — architecture decision

The prompt asked for Likability, Credibility, Charisma and Competence and explicitly asked whether they belong live, post-question, post-interview, Film Room, mentor view or a combination, and whether they should be four giant live numbers. The decision, with its reasons:

**Decision 1 — Two core profiles, one gauge, one index; four lenses over them.** The evidence organises social perception into warmth/communion and competence/agency, with a documented trade-off between them. A single blended "likability" or "charisma" number would tell a student to do things that raise one and lower the other (broader smiles: +warmth, −competence). Therefore the engine computes:

- **WARMTH-CUE PROFILE** (W) — the observable cues raters use for warmth/affability;
- **COMPETENCE-CUE PROFILE** (K) — the cues raters use for competence/credibility ("powerful speech," fluency, structure);
- **EXPRESSIVENESS gauge** (X) — magnitude of vocal/facial/gestural animation (Antonakis's three nonverbal tactics; Friedman/Riggio expressivity);
- **COMPOSURE index** (S) — the fluency/rate/assertiveness cues from which raters infer the *absence* of anxiety (Feiler & Powell 2016);
- **CLARITY / STRUCTURE** (Cl, P3) — verbal structure and phrase-level delivery.

and presents the four requested constructs as *lenses*: **Likability → W (+ responsiveness components)**; **Competence → K (+ Cl)**; **Credibility → K's trustworthiness sub-view plus calibration (no overclaiming) — mentor LAB lens, per 3490 law**; **Charisma → the W × K quadrant position plus X** (Tskhay et al.'s affability + influence), with the optional CHARISMA-CUE BALANCE 0–100 headline (3490 CB1) as the only single number, post-session and PERFORMANCE mode only.

**Decision 2 — Where they appear.** Engine: computed continuously per answer window. **LIVE HUD: never.** Post-answer card: one contributor-level sentence at most (never the index). Post-interview summary: the W × K quadrant, the X gauge, S, with contributor rails and coverage rings. Film Room: full contributor trees with moment links. Mentor: the same plus the Credibility/Authority lens and raw weights. Admin: weights, thresholds, audits.

**Decision 3 — Verbal-first, nonverbal-capped.** Composites are built primarily from vocal, fluency and (P3) verbal features; face and body contributors are admitted only as (a) high-reliability behaviours, (b) with a combined weight cap of 25 % **[CALIBRATE]** per index, (c) individually excluded when confidence is low, and (d) subject to the availability-parity audit — any contributor with disparate availability by skin tone, lighting or accent is demoted to a descriptive lens. This follows Booth et al. 2021 (fusion adds bias for little accuracy), DeGroot & Motowidlo 1999 (vocal > visual), and the model-card fairness gaps.

**Decision 4 — Composite law (3490, retained).** `master = min(weighted_mean, weakest_contributor + 15)` **[CALIBRATE]**; buckets of 5; coverage ring `N OF M CONTRIBUTORS` with a visible denominator; no silent renormalisation; contributors always visible; the weakest is flagged `LIMITING: …` and sources the single post-answer correction; scores never flow down to live surfaces.

**Decision 5 — Withholding.** No index on < 60 s of student speech or < 100 words in the window; none when face coverage < 70 % of the window for a face-dependent contributor (the contributor drops out; the index survives with a reduced denominator); none when ASR coverage < 70 % for a transcript-dependent contributor; none on the first session for any contributor that needs a within-speaker baseline (pitch variability, loudness dynamics, gesture rate); Charisma is withheld whenever W or K is withheld; all indices are suppressed when the student sets a speech-difference or neurodivergence flag that removes fluency contributors, in which case only structure/verbal features are reported.

The full component lists, weighting philosophy, confidence and state adjustment, missing-data handling and baseline adjustment are in `Y1-Y2-CAM-V6-3522_COMPOSITE_COACHING_INDICES.md`. The four sections below state, for each requested index, what the research supports, what its components are, and what it must not claim.

## 13. Likability Coaching Index (lens over WARMTH-CUE)

*Research basis.* Warmth is judged first and carries liking (Cuddy et al. 2011; Abele & Wojciszke 2007); interviewer liking correlated r = .64 with overall evaluation (Anderson & Shackleton 1990); expressiveness predicts being liked at first meeting (Friedman et al. 1988; Back et al. 2010); nodding raises likability ~30 % (Osugi & Kawahara 2018); responsiveness — follow-up questions, acknowledgments — raises liking (Huang et al. 2017; Reis et al. 2011); slow-onset smiles are read as more trustworthy (Krumhuber et al. 2007); forward lean and frontal orientation are immediacy cues (Mehrabian 1968); ingratiation raises fit perceptions in the field (Higgins & Judge 2004). Mimicry/synchrony (Chartrand & Bargh 1999) are real but require the interviewer's body and are excluded.

*Components.* Vocal: pitch variability and loudness variability (expressiveness), positive-affect prosody proxy (P2), moderate rate. Nonverbal (capped): smile-pattern presence and onset rise-time (not peak intensity), responsive smiles, acknowledgment rate while listening, orientation toward screen while listening, forward lean/frontal orientation, listening-state facial activity. Verbal (P3): acknowledgments and verbal uptake at turn start, follow-up questions to the interviewer, gratitude and inclusive language, warm lexical register, interviewer-name use (very low weight).

*Contextual modifiers.* Listening-state components are computed only in INTERVIEWER_TURN; smile presence is capped in *technical/serious* content units (Wang et al. 2017 trade-off); cultural setting note in copy.

*Must not claim.* "Likable" as a trait; rapport/synchrony; that the interviewer liked the student; a universal smile or nod target.

*Grade of the composite:* B.

## 14. Credibility Coaching Index (lens over COMPETENCE-CUE, mentor LAB by default)

*Research basis.* Credibility = competence + trustworthiness + goodwill (McCroskey & Teven 1999); nonfluencies lower competence and dynamism but not trustworthiness (Miller & Hewgill 1964); hedges, hesitations and tag questions lower authoritativeness and persuasion (Erickson et al. 1978; Hosman 1989; Blankenship & Holtgraves 2005); falling terminal intonation and moderate-fast rate raise perceived confidence and persuasion (Guyer et al. 2019; Vaughan-Johnston et al. 2024); louder, more variable volume signals confidence (Van Zant & Berger 2020); calibrated confidence beats overclaiming (Tenney et al. 2007/2008); specific, verifiable examples and honest impression management raise ratings (Bourdage et al. 2018; Bangerter et al. 2014); accent lowers perceived truthfulness through a listener-side effect (Lev-Ari & Keysar 2010) — a bias, not a coaching target.

*Components.* Vocal: filled-pause and restart rate (low), rate in the moderate-fast band, falling terminal contours on declaratives (P2), stable loudness with purposeful variation, low mid-phrase long-pause rate. Verbal (P3): hedge density, specificity (situation/action/result elements, numbers, names), calibrated certainty (absence of overclaiming markers), directness (answer-first ordering). Nonverbal (capped): steady head/posture, orientation toward screen during the key sentence, low self-adaptor duration (minor).

*Why mentor LAB by default.* 3490 law: deception/credibility inference is an absolute prohibition; the lens is a *cue profile* named "CREDIBILITY CUES," never "87 % credible." It is shown to mentors and, after human validation, optionally to students in PERFORMANCE mode.

*Must not claim.* Honesty, trustworthiness as a trait, deception, accent as a defect.

*Grade:* A/B for the fluency and powerful-speech components; the composite B.

## 15. Charisma Coaching Index (profile, not a number)

*Research basis.* Charisma is "values-, symbolic- and emotion-laden signalling" and "ill-defined and ill-measured" as a single construct (Antonakis et al. 2016); its validated inventory has two factors, affability and influence (Tskhay et al. 2018), which map onto warmth and competence; it is trainable through 12 codable tactics (Antonakis et al. 2011); acoustically it correlates with F0 variability, intensity variability and rate (Rosenberg & Hirschberg 2009; Niebuhr & Skarnitzl 2019: 80-percentile F0 range r = .52); expressive positive affect is contagious (Bono & Ilies 2006); Van Edwards' "charisma = warmth + competence" is the same structure with blog-grade numbers attached.

*Representation.* A quadrant (W × K position with confidence ellipse) plus the EXPRESSIVENESS gauge; a "charisma zone" = high W + high K + adequate X. The verbal CLT count from the transcript (stories, contrasts, three-part lists, rhetorical questions, moral conviction, confidence statements — P3) is shown as the *content lever*. The optional CHARISMA-CUE BALANCE headline (0–100, 3490 CB1) = balance of W and K under the cap-by-weakest law, post-session only, PERFORMANCE mode only, never live.

*Why not one score.* The compensation effect guarantees that some delivery changes move W and K in opposite directions; a weighted sum would coach against itself. A quadrant makes the trade-off visible and lets the mentor say "you are sending fewer competence cues than warmth cues on technical questions."

*Must not claim.* A validated "charisma score"; "charismatic" as a trait; any of the SoP numbers.

*Grade:* B for the structure; E for any single validated number.

## 16. Competence Coaching Index (lens over COMPETENCE-CUE + CLARITY)

*Research basis.* Perceived competence is formed early and is partly valid (Barrick et al. 2010); voice carries intellect (Schroeder & Epley 2015); speech fluency and composure are the second and third discriminators of hiring decisions after content (Hollandsworth et al. 1979); rate raises competence up to ~190–200 wpm (Miller et al. 1976; Smith et al. 1975); illustrator gestures raise perceived competence via ease of understanding (Cascio Rizzo et al. 2026; Maricchiolo et al. 2009); an open, non-contracted upper body is read more favourably (Elkjær et al. 2020); overconfidence yields a behavioural signature that reads as competence (Anderson et al. 2012) but is punished when wrong (Tenney et al. 2007).

*Separation of content from delivery.* **CONTENT COMPETENCE** (is the answer appropriate, specific, structured — SAF(e) qualitative, P3; never a 1–100 grade per 3490) is scored and displayed separately from **DELIVERY OF COMPETENCE** (the cue profile). The post-answer card carries one structure note and one delivery note (3490 per-answer loop).

*Components (delivery).* Vocal: fluency (fillers, restarts, mid-phrase long pauses), rate in band, falling terminals, loudness stability. Verbal (P3): signposting, three-part lists, contrasts, answer-first ordering, concision (phrase length tendency 1.2–1.6 s from the Jobs analysis — C), low filler lexis, calibrated certainty. Nonverbal (capped): illustrator-proportion during explanations (when hands visible), non-contracted upper body, stable head.

*Must not claim.* That the answer is correct; that the student is competent; residency-specific weights (none exist).

*Grade:* A/B.

## 17. Additional Recommended Composite Dimensions

The prompt authorised more than four dimensions and warned against score proliferation. Two additions are recommended and several rejected.

**Recommended: EXPRESSIVENESS (X).** A magnitude gauge (pitch range, intensity range, rate variation, facial activity index, gesture rate during speech, laughter presence) relative to baseline. Justification: the most robust nonverbal predictor of liking and perceived charisma, with no documented ceiling (Kavanagh et al. 2024) except the smile-specific competence trade-off, which lives in W/K. It is also the dimension most affected by neurodivergence and depression, so it is baseline-relative and opt-out. **Grade B.**

**Recommended: COMPOSURE (S).** Built from what raters actually use to infer anxiety — speech rate not depressed vs own baseline, low restart/filled-pause rate, stable F0 (no tremor/creak surge), adequate loudness, assertive phrasing — never from tic counts (Feiler & Powell 2016; Powell et al. 2018). Ethically justified because interview anxiety lowers ratings but does not predict job performance (Schneider et al. 2019). Label: "Composure cues," never "you seemed nervous." **Grade B.**

**Conditionally recommended (P3): CLARITY / STRUCTURE.** Verbal signposting, lists, contrasts, answer-first, phrase length, pauses at clause boundaries; illustrators aligned with content. Feeds Competence. **Grade C/B.**

**Rejected as separate scores:** *Engagement* (mental state; use acknowledgment and orientation behaviours), *Confidence* (a display, not a state; the vocal-confidence cues are inside K and S), *Authenticity* (no validated observable marker; qualitative flags only — e.g., "unusually flat F0 and zero disfluency on every answer may read as recited"), *Presence / Executive presence* (D-grade umbrella labels over S + K + X), *Rapport* (dyadic; unmeasurable from one camera), *Enthusiasm* (folded into X + positive-affect prosody), *Conversationality* (folded into turn-taking metrics and responsiveness). Static-face trustworthiness is excluded entirely (morphology; unfair; untrainable).

---

## 18. Personalization Model

**Three layers, strictly ordered.**

1. **GLOBAL DEFAULTS** — wide coaching bands from the literature, every one labelled heuristic: speaking rate 140–180 wpm (safety envelope 110–210); pitch variability 10-s SD 2.0–3.0 st "moderate"; fillers ≤ 3/100 words green, > 5 amber/red; response latency ≤ 1.0 s unremarkable, > 2.0 s unbridged coach a bridge; loudness corridor ±6 LU; smile sustained flag > 4–5 s; listening orientation < 50 % flag; gesture extremes only. No global default exists for nods/min, gestures/min, smile count, gaze %, blink, facial activity.
2. **STUDENT BASELINE** — captured in a **calibration session** on first use and on device change: (a) 45–60 s read passage with soft/normal/emphasised cue lines → loudness P10/P50/P90 (LUFS-K, speech-only), F0 median and semitone SD, articulation rate, habitual filler rate, blendshape resting percentiles (smile, brow, squint), face-box size, head-pose median; (b) a 2-minute casual storytelling answer ("tell me about a place you love") → the **Natural Fingerprint** (3490): natural gesture rate/space/L-R balance, facial activity, pitch variability, pause style; (c) coverage measurements (face-presence rate, landmark jitter, iris confidence, hand-detection rate, ASR confidence). Baselines are versioned; a baseline older than 90 days or from a different device is `STALE` and blocks silent use (3490 law).
3. **PERSONALIZED TARGET CORRIDORS** — for each corridor metric, corridor = f(baseline) blended with the global band and clamped to the safety envelope; the *natural-vs-interview* comparison ("significantly more restrained than your natural baseline," never "17 % fewer gestures") is the primary framing for expressiveness, gesture and facial activity; within-person deltas are the primary metric everywhere (Fisher et al. 2018).

**Who can change what.** Student: corridor position within the safety envelope, which live cue (if any) is active, per-metric opt-outs, self-declared contexts (glasses, notes, wheelchair, stutter, autistic/ADHD, facial asymmetry, "no facial feedback"). Mentor: assignment-specific targets, coaching focus, which metrics appear on the post-answer card, reference session selection. Admin: global defaults, threshold sensitivity, index weights (exposed, per 3490 ADM2 profile inspector), audit views. **Nobody can change a measurement, a unit, a provenance label or a confidence value.** Corridor edits are logged with the editor's role.

**Fairness defaults (from R9's matrix):** personal-baseline/diagnostic-only defaults for smile, nod, gaze, expressiveness, gesture, posture, WPM, pitch variation, fillers, pauses/latency, volume (technical audibility check + baseline); OFF by default (opt-in, neutral wording) for fidget/repetitive motion, fry and uptalk; blink dropped from the HUD.

---

## 19. Real-Time HUD Recommendations

### 19.1 Densities and modes (3490 law, evidence-confirmed)

| Mode | Live surface | Why |
|---|---|---|
| **SIMULATION (default interview)** | NO HUD. Clean video-meeting geometry. Self-view hidden or thumbnail. Optional single **whisper cue** line, off until the student turns it on. Rails collapsed (42 px tabs). | Chollet 2015 (gauge < control); Kluger & DeNisi (self-focus harms); Horn & Behrend (self-view adds load); mode isolation |
| **DELIVERY TRAINING** | Rails available: SIMPLE (one big instrument, no raw numbers) → STANDARD (instrument + contributors + state) → LAB (raw telemetry, confidence, provenance). The current "Full Coaching" composition is the STANDARD/LAB density of this mode. | Concurrent feedback can help early learning of complex skills and should fade with skill (Sigrist et al. 2013; Wulf & Shea 2002) |
| **QUICK REP / DRILL** | One instrument for one target (e.g., pace only), the guitar-tuner grammar | Hincks & Edlund 2009 (single-meter pitch-variation training worked) |

### 19.2 The whisper cue — arbitration engine

Only cues that pass all four tests may go live: (1) actionable within seconds by a simple motor response; (2) readily apparent and non-inferential (Recital 18 / Commission guidelines: volume, rate, silence, face-in-frame, orientation, posture — not "nervous," "engaged," "confident"); (3) precision ≥ 80 % on webcam data across lighting, glasses, skin tones and accents; (4) requires no number or trend to read.

**Candidate cues and priority (setup pre-empts everything; then severity × correctability):**

| Priority | Condition | Cue word | Dwell **[CALIBRATE]** | Clear (hysteresis) | Refractory |
|---|---|---|---|---|---|
| 1 | Mic silent / clipping / camera lost | `CHECK MIC` / `CHECK CAMERA` | 3 s | signal restored | 30 s |
| 2 | Face out of frame / too close / far off-centre | `RE-CENTRE` / `MOVE BACK` | 5–8 s | inside dock tolerance | 30 s |
| 3 | Loudness below corridor sustained while speaking | `LOUDER` | 10–20 s (deviation-graded: extreme sooner) | above lo + 2 LU | 30 s |
| 4 | Speaking rate above corridor sustained | `SLOWER` | 10–20 s | below hi − 10 wpm | 30 s |
| 5 | Orientation *away/down* while speaking, sustained (not TRANSITION, not NOTES) | `LOOK UP` | 5–8 s | toward-screen 2 s | 30 s |
| 6 | Long unbridged silence in own turn (> 2.5 s, not TRANSITION) | `BRIDGE` (opt-in only) | immediate | speech resumes | 45 s |
| 7 | Pitch variability far below baseline over 20 s (opt-in "variety" drill) | `VARY` | 20 s | SD ≥ baseline − 0.5 st | 45 s |

Rules: one cue on screen ever; 3-s display then blank; ≤ 1 cue per 20–30 s and ≤ 3 per answer, else defer to the post-answer card; suppress the first 3 s of every answer and the entire TRANSITION state; suppress on LOW coverage; placement adjacent to the interviewer video (not in a far rail — split-attention); one word or glyph, task-focused, never a number or an evaluation; default OFF for the baseline session, then at most one student-chosen cue, fading across sessions; anxious students may keep it off. Lock states ("GOOD — HOLD," "LOCKED") appear only in Delivery Training instruments, never as whisper cues. Numbers: Rhema's 20-s window; clinical alarm evidence that 14–19 s delays remove 50–67 % of nuisance alarms and deviation-graded delay cuts false alarms 73.5 %.

### 19.3 What is ALWAYS VISIBLE / OPTIONAL LIVE / HIDDEN BY DEFAULT

*Always visible (all modes):* session clock; measurement chip ("MEASURING · HIDDEN" honesty line — keep as is); coverage/quality glyph (mic, camera, lock) that appears only when something is wrong.
*Optional live (Delivery Training):* Volume corridor; Delivery Speed dial; Vocal Variety band; camera orientation state; framing dock; hands-visible; facial activity index vs baseline; gesture activity flag; overlays (face/hands/body/framing, independently switchable, visible pre-interview).
*Hidden by default, revealable in LAB:* raw dBFS, F0 Hz, blendshape values, pose angles, VAD state, ASR coverage, provenance, per-frame confidences.
*Never live:* smile counts, blink rate, nod counts, self-touch, repetitive motion, any composite, any content/semantic output, emotion or trait language.

### 19.4 Stage geometry

Interview-only mode must preserve realistic video-meeting geometry. Today the stage box changes from ≈ 1.25:1 to ≈ 2.38:1 at fixed height with `object-fit: cover`, which zooms the feed ×1.34 and crops ≈ 12.6 % top and bottom — not distortion, but the head grows by a third and the forehead is cut (visible in the 24 Aug screenshots). Fix: aspect-lock the stage (`aspect-ratio: 16/9`, max-height bound, centred) so the feed's crop is identical in every mode; overlays keep the same cover mapping. Face and body overlays appear in READY state (pipeline starts at connect; histories reset at Start); the on-stage overlay toggles that the V2 CSS hides become visible controls.

### 19.5 Self-view

Hidden or thumbnail by default during answers; replaced by the framing glyph that appears only when framing is off; an opt-in "practice with self-view" drill for habituation; large with overlays in the Film Room.

### 19.6 Post-answer card (between questions)

10–20 s; ≤ 2 items in a 2-positive : 1-corrective shape (Saga et al. 2023); task/process level ("clear opening and one concrete example; 9 'like' in 90 s — try one deliberate pause instead"); one goal for the next answer (feed-forward); a replay chip; a structure note (SAF(e), qualitative) and a delivery note; richer on first sessions, fading with skill; student can choose which item to track (self-controlled feedback).

---

## 20. Post-Interview / Film Room Recommendations

The Film Room is the learning engine (MACH; Fukkink et al. 2011; Hammoud et al. 2012). Required contents, each with its evidence:

1. **Synchronised self-video with tracks** — conversational state ribbon (the first lane), speech/silence, response latency markers, loudness (LU vs baseline), pitch variability, Delivery Speed, fillers (estimate), smile-pattern presence, orientation state, gesture units, self-touch, note-taking events, coverage lane (mandatory; 3490 EVD1) — post-session synced overlays beat raw replay (MACH).
2. **Opening-answer highlight** — the first 60–90 s analysed and shown first (Naim et al. 2018; Barrick et al. 2010; Murphy et al. 2019).
3. **Structured observation form** mirroring the residency rubric (ICS/professionalism language) — structured forms double the video-feedback effect (ES 0.55 vs 0.21).
4. **Moment-anchored comments** by mentor/peer/AI-coach — comments beat charts (ROC Speak); "Ask the session" NL moment search (3490 NLS1).
5. **W × K quadrant, X gauge, S index** with contributor rails, `LIMITING:` flag, coverage rings, and the CLT/verbal levers (P3).
6. **Congruence notes and gesture opportunities** (≤ 4 each, never "MISSED"; P3).
7. **Mannerism clips** (repetitive motion, if opted in) — awareness is a post-session product (AutoManner).
8. **Before/after and Personal-Best shadow** (3490 PB1/BEST1), natural-vs-interview overlay from the fingerprint.
9. **Dialogic follow-up** — the student can ask why and rehearse a better answer (Conversate); the 2:1 positive-to-corrective dose.
10. **Honest fallback cards** for every unavailable lane with the technical reason and fix.

Classification of every metric into LIVE HUD / LIVE ADVANCED / POST-QUESTION / POST-INTERVIEW / FILM ROOM ONLY / MENTOR ONLY / ADMIN ONLY / DO NOT SURFACE is in the Metric Ontology ("Default visibility" column). The short version: live = the whisper-cue set; live advanced = the corridor instruments and coverage; post-question = fluency, latency, pace, variety, one structure and one delivery note; post-interview = profiles, opening window, trends; Film Room only = smile/gesture/self-touch/orientation tracks, co-occurrence, repetitive motion, congruence; mentor only = credibility/authority lens, raw weights, anxiety-related composure detail; admin only = thresholds, audits; do not surface = emotion, genuineness, trustworthiness from face, static-morphology anything, blink on the HUD, fry/uptalk unless opted in.

---

## 21. Mentor / Admin Configuration

**Separate MEASUREMENT from COACHING TARGET.** Measurement (units, algorithms, provenance, confidence) is immutable by any user. Coaching targets (corridors, bands, cue selection, focus) are configurable within safety envelopes.

| Parameter | Student | Mentor | Admin | Envelope / rule |
|---|---|---|---|---|
| Delivery Speed corridor | move within envelope | set per assignment | set global default and envelope | 110–210 wpm; L2 cap ≤ +10 % over baseline |
| Loudness corridor | ±2 LU shift | set per assignment | default ±6 LU | ±3…±10 LU |
| Pitch-variability band | — | set per assignment | default | never coach pitch *level* |
| Active whisper cue | choose 0–1 | recommend | enable/disable cues | one at a time; precision floor per cue |
| Post-answer card items | choose tracked item | choose 2 items and the focus | template | 2:1 shape; ≤ 2 items |
| Live metrics visible (Training) | preset/custom | recommend preset | preset library | never in Simulation |
| Threshold sensitivity (dwell, hysteresis) | — | — | tune with audit view | within R2–R6 rules |
| Index weights | — | view | tune (profile inspector) | cap-by-weakest fixed; nonverbal cap ≤ 25 % |
| Reference session | pick | pick "mentor reference" | — | must be same device class |
| Per-metric opt-out / self-declared contexts | full control | view (with consent) | policy | session-scoped unless student opts in |
| Data retention | delete own sessions | — | retention schedule | BIPA/AIVIA template (§23) |

Admin audit views: coverage parity, WER by accent group, availability parity, feedback parity, test–retest ICC per metric, complaint log (R9 §4.2).

---

## 22. Longitudinal Student Modeling

Reference set per student: **baseline** (calibration + natural fingerprint), **current session**, **best session** (Personal Best per metric, mentor-validated), **last 5** (rolling mean and trend), **mentor-selected reference**. Every report shows the current value against the student's own baseline first and the global band second. Improvement trajectory = within-person delta with a reliability gate: a metric shows a trend only when its test–retest ICC across two calibration runs is ≥ 0.7 (else diagnostic-only), and a delta is called "change" only when it exceeds the metric's within-person noise band **[CALIBRATE]**. Cross-session expressivity is stable over months (r = 0.59–0.82; Kavanagh et al. 2024), so a per-user facial-activity profile can be carried across sessions; loudness profiles are device-bound and expire on device change; baselines expire at 90 days (STALE). Progression-engine hooks (3494A): PB deltas and DI corridor-dwell gains are the only delivery inputs; repetition without delta earns minimal XP (anti-grind law). The retention test the guidance hypothesis demands — a final no-feedback mock — is part of every programme so that improvement is measured without the cue on.

---

## 23. Fairness / Accessibility

**Findings that constrain design (all Grade A unless noted):** population-norm targets encode rater biases (accent d = 0.47, women-smile d = 0.41, attractiveness d = 0.37, pitch-level preference); nonverbal norms are cultural (smiling read as less intelligent in low-uncertainty-avoidance cultures; direct gaze read as angrier in Japan; Japanese look down while thinking; Indian head-bobble means acknowledgment; aizuchi doubles nod rates); MediaPipe gaps are demographically patterned and thinly sampled (hand tracking worst on Fitzpatrick 6 and "not appropriate" with henna/jewellery; blendshapes lab-tested on 511 samples); ASR bias corrupts every transcript metric (WER 19.7 % accented vs 2.7 % clean; cut-offs for stutterers); neurodivergent and disabled users are mis-scored by every deficit-framed metric (autistic gaze aversion; g = −0.48 expression frequency; ADHD movement; Parkinson's mask; facial palsy; depression; social anxiety); 4.6 % of US MD students disclose a disability.

**Design rules adopted:** (1) within-person change is the primary metric; (2) calibration per device/environment with coverage measurement; (3) confidence gating → "unavailable," never zero; (4) no emotion inference — measure movement, describe behaviour; (5) accent, pitch level, fry, uptalk and rate are never coached as flaws, and any rater-bias awareness module states that the bias is the listener's; (6) cultural-context framing in every nonverbal tip ("many US interviewers read camera-facing as attentiveness"), never universal virtues; (7) self-declared contexts with per-metric toggles, session-scoped; (8) biometric minimisation and consent (no landmark/mesh persistence; per-session aggregates only; written release, public retention schedule, deletion ≤ 30 days on request); (9) strengths-based language — never "monotone," "flat," "nervous," "fidgety," "poor eye contact"; (10) a content-and-structure-only coaching mode of equal quality plus human review on request; (11) a published system card.

**Metrics requiring the most caution:** gaze/camera-facing, smile, nod, expressiveness, fidget, fry, uptalk, WPM/fillers for accented speakers, pitch level (excluded), blink (dropped).

**Required audits** (pre-launch and after every model/threshold change): face and hand coverage parity by Monk skin tone × lighting × glasses/head covering/facial hair (max gap ≤ 3 pts; no group < 90 %); landmark accuracy on an internal *webcam* set; ASR WER by accent group (≤ 25 % or transcript metrics withheld; hallucination < 0.5 %); metric-availability parity (gap ≤ 5 pts); feedback parity (no group > 1.25× the negative-framed suggestions of the reference group); within-person reliability (ICC ≥ 0.7 or demote); user-harm monitoring; legal/consent audit (counsel sign-off).

**Legal perimeter to design against (verified texts):** EU AI Act Art. 5(1)(f) (in force 2 Feb 2025; the Commission guidelines' role-play carve-out applies only if results cannot affect evaluation or certification, and an institution-required app is prohibited — so outputs stay student-only, contractually excluded from institutional assessment, adoption optional); Illinois BIPA (face geometry and voiceprint are biometric identifiers; written release; ≤ 3-year destruction; $1,000/$5,000); Illinois AIVIA (notice/consent/30-day deletion template); NYC LL144 (bias-audit vocabulary); Colorado SB24-205 (duty-of-care vocabulary from 30 June 2026); GDPR Art. 9 explicit consent for EU-resident students; ADA/UK Equality Act accommodation. EEOC's 2023 AI guidance pages now return 404 — Title VII/ADA still apply to any future B2B use.

---

## 24. Metric Confidence / Failure States

**Confidence vocabulary (every derived signal):** HIGH · MODERATE · LOW · UNAVAILABLE, with a machine reason code and a human fix. Confidence flows up: a composite's coverage ring counts only HIGH/MODERATE contributors; a LOW contributor is shown but excluded; UNAVAILABLE leaves the denominator.

**Degradation table (extends the 3521 fail-closed set, which is kept in full):**

| Condition | Effect | User-facing state |
|---|---|---|
| No primary lock / ambiguity / bystander | all person-derived vision UNAVAILABLE (existing) | "Lock to me" control; scanner plates stay visible |
| Face confidence < 0.5, |yaw|/|pitch| > 30°, face < 15 % frame height, low light | face metrics UNAVAILABLE; head pose LOW | "Face metrics paused — lighting/angle" |
| Glasses glare / "my eyes may not track" flag | eye-direction features off; head pose only | orientation state LOW confidence |
| Hands out of frame | gesture metrics *unobserved* (not zero) | "Hands not visible" |
| Hand-detection rate < 70 % of speaking time | gesture rates UNAVAILABLE | reason shown |
| Mic silent (no speech > floor + 10 dB in 3 s) at SETUP | session cannot start measurement | `CHECK MIC` gate |
| AGC/NS/EC on after request | absolute loudness `PROCESSED`; relative dynamics only | badge on Volume |
| SNR < 15 LU | loudness LOW; ASR Tier A auto-promotion disabled | reason shown |
| Clipping fraction > 1 % | loudness LOW; `CHECK MIC` | cue |
| ASR coverage < 70 % / window < 8 words / < 3 s speech | WPM "collecting…"; falls to Tier D (ESTIMATED) or E (UNAVAILABLE) | provenance badge |
| ASR decode P95 > 8 s over 5 segments; plausibility rejects > 20 % | demote tier; new window starts | logged |
| Transcript stale > 5 s (existing) | WPM UNAVAILABLE `STALE_TRANSCRIPT_TIMING` | greyed tile |
| No interviewer channel | listening-state metrics UNAVAILABLE `NO_INTERVIEWER_CHANNEL`; two-state model | reason shown |
| Vision fps < 6 sustained or dropped frames > 10 % | nod detector and co-occurrence UNAVAILABLE; trends LOW | coverage lane |
| Document hidden / device switch (existing gaps) | observation gap recorded; histories continue | coverage lane |
| Baseline missing or STALE | corridor metrics show global band only with `NO BASELINE` badge; composites withheld for baseline-dependent contributors | "Calibrate" prompt |
| Speech-difference / neurodivergence flag set | fluency contributors suppressed; structure/verbal only | badge |
| < 60 s speech or < 100 words in window | composites withheld | "insufficient signal" |

**Never fabricate continuity:** gaps are drawn as gaps; a hidden or unavailable lane reads `UNAVAILABLE · CONTRIBUTES NOTHING` (the 3490 "PITCH — UNAVAILABLE" standard); trends never interpolate across gaps; windows that straddle a tier change or a gap are discarded, not stitched.

---

## 25. Complete Metric Ontology

The full table — every current and newly recommended metric with the fifteen required columns (metric, category, signal source, conversation state, raw/derived/interpretive/composite level, live usefulness, post-session usefulness, reliability, evidence strength, personalizable, default visibility, claim-safety notes, implementation difficulty, dependencies, recommended priority) — is `Y1-Y2-CAM-V6-3522_METRIC_ONTOLOGY.md`. It contains **99 metrics** in eleven families: System/Coverage 9 · Conversation/Turn 10 · Voice–loudness 8 · Voice–pitch/prosody 8 · Rate/Fluency 13 · Face 11 · Listening/Head 5 · Gaze/Camera 6 · Body/Gesture 13 · Verbal/Semantic 9 · Composite 7. Twelve exist in 3521 and are kept as measured, thirteen exist and are reinterpreted, seventy-four are new. By priority: P0 47 · P1 20 · P2 15 · P3 14 · P4 3. The default-visibility outcome:

| Default visibility | Count | Examples |
|---|---|---|
| LIVE (whisper-cue eligible or setup gate) | 6 | mic/camera fault, primary-lock control, framing dock, loudness corridor cue, clipping |
| LIVE ADVANCED (Delivery Training rails) | 17 | coverage, hands visible, loudness corridor, Delivery Speed dial, pitch register/variability, orientation state, facial activity vs baseline, gesture activity flag |
| LAB (raw-telemetry density) | 9 | dBFS, F0, blendshape values, head pose, hand kinematics, rest clusters, cadence diagnostics |
| POST-QUESTION | 12 | response latency, WPM/articulation rate, fillers (estimate), pause structure, pitch range, loudness range, structure note |
| POST-INTERVIEW | 27 | W × K profile, X gauge, S index, acknowledgment rate, talk-over, orientation summaries, gesture summaries, posture, note-taking counts, verbal levers |
| FILM ROOM ONLY | 19 | state ribbon, gaps, smile tracks and rise-time, brow emphasis, stillness, thinking-gaze, co-occurrence, self-touch, congruence notes |
| MENTOR ONLY | 1 (+ mentor detail on Composure) | credibility/authority-cue lens |
| INTERNAL (building blocks) | 2 | acknowledgment opportunities, content-type tags |
| DO NOT SURFACE (opt-in awareness where stated) | 6 | blink on the HUD, micro-nodding, bobble log, repetitive motion (opt-in), fry (opt-in), uptalk (opt-in) |

Excluded by design and therefore absent from the table: emotion or affect labels, "genuine smile," trustworthiness or any judgement from static face morphology, eye-contact percentage, a nods-per-minute or gestures-per-minute target, hirability or match prediction.

---

## 26. Evidence Register

`Y1-Y2-CAM-V6-3522_EVIDENCE_REGISTER.md` lists 605 unique sources consolidated from the ten domain reviews, each with source, authors, publication, year, URL, evidence type, what it supports (per domain), limitations and grade; every entry was located online during this run or is explicitly marked UNVERIFIED (from memory). The register opens with a "key claims → evidence" map for the 40 recommendations that most shape this specification, so that a reviewer can check any load-bearing statement in under a minute. Blog and practitioner sources (Science of People, Toastmasters, career-centre guidance, vendor model cards) are labelled as such.

---

## 27. P0 / P1 / P2 / P3 / P4 Roadmap

| Priority | Scope | Items |
|---|---|---|
| **P0 — implement in the 3521 runtime now** | Foundations that every later capability depends on, and the corrections that stop the current HUD from being conceptually wrong | Conversational state machine v1 (first-party interviewer events + Silero VAD + question boundaries); SETUP framing dock + audio-signal gate + calibration passage; loudness pipeline (LUFS-K, speech-only, AGC read-back, personal corridor; universal dBFS corridor removed); pitch upgrades (calibration median, 10-s SD, P10–P90, octave guard); WPM producer ladder (Tier A in-browser timestamped Whisper or Tier B per-word sidecar; Tier D syllable rate as ESTIMATED; provenance labels; Delivery Speed 0–100 mapping); smile-pattern event redefinition with state tags; fused orientation states over rolling windows; facial activity index (rolling, state-split, baseline-relative); gesture-unit detector with hands-visible conditioning and speaking-state gating; live-cue arbitration engine with NO HUD default in Simulation; overlays visible pre-interview with visible independent controls; aspect-locked stage; post-answer card v1; per-answer evidence retained in session for the card and export |
| **P1 — next** | Listening intelligence and product integrations | Nod detector (listening state only) + acknowledgment-given-opportunity + longest unacknowledged stretch; notes pane (Tier 0) and NOTES state; brow emphasis events; self-touch events; posture summaries; trail-off detector; filler estimate (keyword spotter); baseline/fingerprint store with STALE logic; mentor targets and card configuration; Film Room timeline v1 with coverage lane; opening-window report |
| **P2 — Film Room / post-session** | Lenses that need validation or higher fps | Gesture–speech co-occurrence; repetitive-motion (opt-in); cadence regularity; terminal contours; W × K profile, X gauge, S index with contributor rails and coverage rings; Personal Best / last-5 trends; mannerism clips; note-taking inference Tiers 1–3; responsive-smile timing |
| **P3 — semantic intelligence** | Requires transcript text under consent | Answer structure (SAF(e) phases, story vs self-description), hedges, "we/I," lexical richness, verbal CLTs, programme/city/name mentions, specificity; semantic–delivery congruence engine; STUDENT_QUESTION and answer-phase states; Clarity/Structure index |
| **P4 — future research** | Not to be implemented until studied | Fry/uptalk awareness modules; diegetic interviewer back-channels driven by delivery metrics (legal review + trial); synchrony *quality* scoring; lateral head-bobble acknowledgment detector; residency-specific validation study with blinded faculty raters; live-vs-post-answer-vs-post-session randomised trial with a no-feedback retention test; cross-cultural calibration policy for IMGs |

The per-item implementation contracts (definition, source signals, state dependencies, formula, target behaviour, unavailable behaviour, UI output, personalization, acceptance test) for every P0 item are in the Codex handoff.

---

## 28. Codex Implementation Contract

`Y1-Y2-CAM-V6-3522_CODEX_IMPLEMENTATION_HANDOFF.md` is the executable contract. It contains: the architecture deltas to the 3521 module graph (what each existing module keeps, gains or loses); the state-machine interface and event schema; the 16 P0 contracts; the P1–P4 backlog; the acceptance-test matrix; the data-handling rules; and the section **CURRENT STANDALONE HTML DISPOSITION**, which classifies each of the 33 major modules in the specimen as KEEP AS-IS / KEEP ENGINE – CHANGE INTERPRETATION / KEEP ENGINE – REDESIGN PRESENTATION / MODIFY / MOVE TO POST-SESSION / REPLACE / REMOVE / FUTURE-RESEARCH ONLY, with the reason for each.

---

## Appendix A — Expert answers to the nineteen current issues

| # | Issue | Answer |
|---|---|---|
| 1 | Wireframe overlays before interview start | Yes. Start the vision pipeline at *Start live capture* (READY state), not at *Start interview*; counters and histories reset at Start. The framing dock needs it anyway. |
| 2 | Face and body overlays independently hideable | Already true in the worker (four gates); the on-stage controls are hidden by the V2 CSS. Make them visible (face / hands / body / framing), remember choices per student, and keep rendering off when all are hidden (today the worker keeps drawing hidden bitmaps). |
| 3 | Left facial scanner duplicating the mesh | Correct instinct. The scanner plate shows **region state/activity** (tracked / active / limited / unavailable per region, with the smile-pattern, brow and periocular activity as heat on the plate), not the cropped live mesh. The transient mesh belongs on the stage overlay only. |
| 4 | Duchenne-type smile event | Defined in §7.1: baseline-corrected `mouthSmile` with hysteresis, ≥ 0.5 s minimum, 0.5 s refractory, rise-time reported descriptively, sustained flag > 4–5 s, eye/cheek-involvement sub-label at LOW confidence, state-tagged, quality-gated. Never labelled genuine. |
| 5 | Head nods contextualised, listening-only rate | Implement the detector only in INTERVIEWER_TURN/TRANSITION (§5). Do **not** show a nods-per-minute rate or target; show acknowledgment-given-opportunity and the longest unacknowledged stretch, post-answer, against the student's own prior sessions. |
| 6 | Separate listening and speaking interpretation | The state machine (§4) is P0; every metric is state-tagged and invalid states are not computed. |
| 7 | Thinking pauses / gaze aversion | Never penalised (Grade A). TRANSITION and long-pause states suppress orientation cues; the only coaching is a verbal bridge for long unbridged silences and "return to the screen for the key sentence." |
| 8 | Expression trend — low vs healthy variation | Facial activity index (§7.2): rolling 10-s window, state-split, baseline-relative bands (< 0.5×, 0.5–2×, > 2×); no "too high" red zone; never the word "flat." |
| 9 | Body scanner as teaching feedback | Setup framing dock + coverage + posture share + hands-visible + gesture activity; remove the four duplicate "centered" rows and the alignment gauge keyed to centering. |
| 10 | Gesture event/rate definitions | §9.2: rest clusters, onset thresholds, unit bounds 150 ms–6 s, speaking-only, hands-visible-conditioned; rates per speaking minute vs own baseline; no target. |
| 11 | Note-taking operational definition | §10: Tier 0 first-party notes pane is the recommendation; Tiers 1–3 inference with confidence shown; count only. |
| 12 | Real WPM | §11.3 tier ladder; Tier A in-browser timestamped Whisper (no egress) or Tier B per-word sidecar; syllable rate as ESTIMATED never WPM; provenance on every window. |
| 13 | Personalised volume calibration | §11.2: LUFS-K speech-only, baseline P50 ± 6 LU corridor, device profile, AGC read-back and `PROCESSED` label; universal dBFS corridor removed. |
| 14 | WPM internal, game-like normalised HUD | §11.3: Delivery Speed 0–100 with the corridor mapped to 70–80; five zones; personalised corridor within a safety envelope. |
| 15 | Real-time pitch relative to own baseline | Already speaker-relative; use the calibration median instead of the drifting rolling median; add 10-s semitone SD and P10–P90; never coach pitch level. |
| 16 | Vocal Variation combining meaningful traces | §11.6: default a single Vocal Variety band (pitch SD + loudness range, speech-only, baseline-relative); three raw traces on demand; optional pause-density trace; cap-by-weakest. |
| 17 | Side-rail and metric controls visually obvious | Keep the mechanics; make the rail tabs, per-metric eyes and overlay toggles first-class in Delivery Training; in Simulation the only control is the whisper-cue toggle. |
| 18 | Interview-only geometry | Aspect-lock the stage (§19.4); identical crop in all modes; self-view thumbnail. |
| 19 | Semantic delivery congruence | §12: P3, transcript under consent, closed content-type set, candidate notes only, post-session, ≤ 4 per interview. |

## Appendix B — Critique of the current thinking (what to stop believing)

1. *"More analytics on screen is more coaching."* The controlled evidence says a live gauge can be worse than nothing and that self-focusing feedback harms performance. The rails are a training instrument; the interview is the interview.
2. *"Nods per minute in listening windows is a useful metric."* The unit of value is acknowledgment given an opportunity, and verbal uptake beats nonverbal acknowledgment; there is no defensible rate target and a documented status/gender confound.
3. *"Camera-facing % is eye contact."* It is not measurable, not separable from looking at the interviewer's tile, and not a truth cue; the effective intervention is tile placement and camera height at setup.
4. *"Smile events = every mouth-corner movement."* Without duration, baseline, refractory and state, the counter measures articulation.
5. *"A one-minute average pitch tells the student something."* It hides the only prosodic feature with strong evidence — variability — and invites pitch-level coaching, which is a bias.
6. *"Raw dBFS with a universal corridor."* Uncalibrated, device- and AGC-dependent; the corridor must be personal and speech-only.
7. *"Framing/alignment as a primary teaching metric."* It is a setup instrument and a single live cue.
8. *"Four big live scores."* Two profiles, one gauge, one index; post-session; lenses over them.
9. *"Blink rate belongs on the HUD."* Diagnostic only.
10. *"Fidgeting and repetitive motion should be flagged."* Off by default, neutral wording; anxiety is not inferred from tics.
11. *"Vocal fry and uptalk are faults."* Small, contested, gendered effects; awareness modules only, with bias disclosure.
12. *"Face and body features should drive composites."* Verbal-first; nonverbal contributors capped and audited.
13. *"Interview-only mode is just hiding rails."* It changes the crop by a third; geometry must be locked.
14. *"Note-taking is a computer-vision problem."* It is a product-design problem first (notes pane), a CV problem second.
15. *"The current HUD is close to done."* The engines are close; the interpretation layer is largely to be rebuilt, and the physical acceptance gate has never been run.

## Appendix C — Validation programme (what the product should measure about itself)

1. **In-house webcam validity corpus**: 2–3 h of consented mock interviews (IMG-heavy, laptop mics, varied lighting/skin tone/glasses/head coverings), hand-timed words (Praat/MFA), FACS-lite smile/brow coding, nod/gesture annotation — the reference set for every precision floor and every tier promotion.
2. **Faculty-rater study**: blinded residency faculty rate recorded mock interviews; correlate the W/K/X/S contributors and the whisper-cue set with ratings to replace transferred weights with local ones (the single most valuable next dataset; no residency-specific cue study exists).
3. **Feedback-timing trial**: randomise students to no live cue / one whisper cue / Delivery Training rails, all with post-answer cards and Film Room, with a no-feedback retention mock — the trial the literature has not run.
4. **Fairness audits** (§23) before launch and after every model or threshold change.
5. **Self-view A/B**: log self-view state per answer; compare rated performance and self-reported load.
6. **Over-coaching watch**: track recited-delivery flags and overclaiming markers over sessions to detect coaching that produces scripted delivery (raters penalise it).

— END OF SPECIFICATION —
