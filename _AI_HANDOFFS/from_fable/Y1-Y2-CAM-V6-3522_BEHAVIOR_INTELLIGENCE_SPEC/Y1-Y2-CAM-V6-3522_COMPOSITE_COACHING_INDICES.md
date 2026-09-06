# Y1-Y2-CAM-V6-3522 — COMPOSITE COACHING INDICES

**Mission:** Y1-Y2-CAM-V6-3522 · **Date:** 2026-08-24 · **Status:** SPECIFICATION (conceptual formulas; all weights provisional and marked [CALIBRATE])
**Companion to:** the Behavior Intelligence Spec (§13–§17) and the Metric Ontology (contributor IDs such as D3, E7, F2 refer to ontology rows)

## 0. What these indices are and are not

They are **coaching indices of perceived delivery**: models of how raters tend to respond to observable behaviour, computed continuously by the engine, surfaced post-answer and post-session, never live. They are not measurements of who the student is. Every displayed index carries the sentence "cues that a typical rater is likely to read as …" and a confidence band. This framing is required by the science (Barrett 2019; Antonakis 2016 on charisma being "ill-defined and ill-measured"; Feiler & Powell 2016 on anxiety being inferred from few cues) and by the legal perimeter (EU AI Act 5(1)(f); Commission guidelines: describing a smile is permitted, concluding a person is happy is not).

## 1. Architecture (decision restated)

Two core profiles, one gauge, one index, four lenses:

| Engine object | Symbol | Feeds the requested construct | Default surface |
|---|---|---|---|
| WARMTH-CUE PROFILE | **W** | Likability (lens) | post-interview, Film Room |
| COMPETENCE-CUE PROFILE | **K** | Competence (lens); Credibility (mentor LAB lens **Cr**) | post-interview, Film Room |
| EXPRESSIVENESS gauge | **X** | Charisma (with W × K), Enthusiasm/Engagement (folded) | post-interview |
| COMPOSURE index | **S** | Confidence / Presence (folded) | post-interview (detail: mentor) |
| CLARITY / STRUCTURE (P3) | **Cl** | Competence (content-side lens) | post-interview |
| CHARISMA profile | **W × K quadrant + X**; optional CHARISMA-CUE BALANCE headline **CB** | Charisma | post-interview, PERFORMANCE mode only |

Reasons (from the spec §13): warmth and competence are the two organising dimensions of person perception and they trade off (Fiske et al. 2007; Judd et al. 2005; Wang et al. 2017); charisma's validated inventory has exactly those two factors (Tskhay et al. 2018); a single blended number would coach against itself; the 3490 law already names WARMTH-CUE / COMPETENCE-CUE profiles and permits one 0–100 headline only.

## 2. Common machinery

### 2.1 Windows and states

- **Index window** = one question–answer pair: the interviewer turn (for listening contributors) plus the student turn (for speaking contributors). Windows shorter than 60 s of student speech or 100 words are pooled with the next answer; if the pooled window still fails the minimum at interview end, the index is withheld ("insufficient signal").
- **Opening window** = the first 60–90 s of student speech, computed and displayed separately (Barrick et al. 2010; Murphy et al. 2019; Naim et al. 2018).
- **Session value** = median of window values (not the mean — one bad window must not drag the session).
- Every contributor consumes only windows in its valid state(s) (ontology column *State*).

### 2.2 Cue score — one function for every contributor

Each contributor `c` has a native-unit value `x_c` for the window, a **corridor** `[lo_c, hi_c]` (personalised where the ontology says Y or B), a **direction** (`inside` = corridor is best; `high` = more is better up to the corridor top; `low` = less is better), and a **band-width** `b_c` (how far outside the corridor the score reaches 0).

```
cueScore(x, lo, hi, b, direction):
  if direction == 'inside':   d = 0 if lo ≤ x ≤ hi else min(|x − lo|, |x − hi|)
  if direction == 'high':     d = 0 if x ≥ lo else lo − x          # no penalty above
  if direction == 'low':      d = 0 if x ≤ hi else x − hi          # no penalty below
  s = 100 · max(0, 1 − d / b)
  return bucket5(s)                                                  # 0,5,10,…,100
```

Corridors are the personalised corridors from spec §18; `b_c` defaults to the corridor width (so a value one full corridor-width outside scores 0) **[CALIBRATE]**. Within-person normalisation is done *before* this step: for baseline-relative contributors, `x_c` is the ratio or difference to the student's baseline and the corridor is expressed in those units (e.g., facial activity ratio corridor `[0.5, ∞)` with direction `high`).

### 2.3 Confidence and coverage

- Contributor confidence `conf_c ∈ {1.0 HIGH, 0.6 MODERATE, 0 LOW/UNAVAILABLE}` from the metric's own confidence (spec §24). LOW contributors are *shown* in the rail but excluded from the aggregate.
- Available set `A = {c : conf_c > 0}`; coverage `= |A| / M` and the ring shows `|A| OF M CONTRIBUTORS`. No silent renormalisation: the denominator is visible.
- **Core contributors**: each index names contributors that must be available; if any core contributor is missing the index is withheld with the reason ("PACE UNAVAILABLE — competence cues withheld").
- Nonverbal cap: the effective weight of the nonverbal group is `min(Σ w_nonverbal, 0.25)` **[CALIBRATE; 0.15 for K]**; if nonverbal contributors are the only available ones, the index is withheld (a face-only index is not permitted — Booth et al. 2021).

### 2.4 Aggregation — the 3490 cap-by-weakest law

```
weighted = Σ_{c∈A} w_c · conf_c · s_c / Σ_{c∈A} w_c · conf_c
weakest  = min_{c∈A, core or w_c ≥ 0.08} s_c
index    = bucket5( min(weighted, weakest + 15) )        # 15 [CALIBRATE]
LIMITING = argmin s_c (displayed; sources the single post-answer correction)
```

Proof scenario (3490 A): a loud monotone — loudness adequacy 100, loudness range 40, pitch variability 20 → Expressiveness capped at 35 with `LIMITING: PITCH VARIABILITY`; it can never read all-green.

### 2.5 Conversational-state adjustment

Contributors are computed only in their states (§2.1). Two additional adjustments: (a) **TRANSITION exclusion** — response latency and thinking-gaze never enter any index (they are post-answer descriptors only); (b) **OVERLAP handling** — windows with talk-over > 20 % of the student turn mark speaking contributors MODERATE (the VAD and F0 lanes are contaminated).

### 2.6 Missing-data handling

| Situation | Handling |
|---|---|
| Contributor UNAVAILABLE (sensor, coverage, no ASR) | excluded; denominator visible; if core → index withheld |
| Baseline missing or STALE for a baseline-relative contributor | contributor uses the global band with a `NO BASELINE` badge and `conf` capped at MODERATE; X and S are withheld entirely on the first session |
| P3 verbal contributors not yet implemented | the verbal group is simply absent; weights of the remaining groups are *not* rescaled to hide it — the ring reads e.g. `5 OF 9` and the rail shows the verbal slots as `NOT YET MEASURED` |
| Speech-difference / neurodivergence flag set | fluency contributors (E7, E8, E10/E11, rate) removed from K and S; K reported as "structure and prosody cues only"; S withheld |
| < 60 s speech / < 100 words | pooled or withheld |
| Face coverage < 70 % of window | face contributors excluded (never zero) |
| Hands visible < 60 % of speaking time | gesture contributors excluded |

### 2.7 Personal-baseline adjustment

For every contributor marked B or Y in the ontology, `x_c` is transformed to a within-person quantity before scoring: ratios to baseline for magnitude metrics (pitch SD, loudness range, facial activity, gesture rate), differences in semitones or LU for register/loudness, and rate ratios for pace. The global band remains visible as context in the rail ("your 10-s pitch SD 2.4 st — 1.3× your baseline; typical range 2–3 st"). The natural-vs-interview framing from the fingerprint session governs the language ("more restrained than your natural baseline"), never percentages of "correct" behaviour.

### 2.8 Display law

Indices are displayed only in POST-INTERVIEW and FILM ROOM (and the post-answer card may show one *contributor-level* sentence, never an index). Buckets of 5. Contributors always visible with their scores, confidences and states. The weakest is flagged `LIMITING:`. Language is cue-language ("competence cues," "warmth cues") — the `-CUE PROFILE` suffix is never shortened. No index is ever shown as a percentile against other students.

---

## 3. W — WARMTH-CUE PROFILE (Likability lens)

**Research basis.** Warmth/communion is judged first and carries liking (Abele & Wojciszke 2007; Cuddy et al. 2011); interviewer liking correlated r = .64 with overall evaluation (Anderson & Shackleton 1990); expressive behaviour predicts first-sight liking (Friedman et al. 1988; Back et al. 2010); nodding raises likability ~30 % (Osugi & Kawahara 2018); responsiveness raises liking (Huang et al. 2017; Reis et al. 2011); slow-onset smiles are read as more trustworthy (Krumhuber et al. 2007); forward lean and frontal orientation are immediacy cues (Mehrabian 1968); benevolence peaks at the speaker's natural rate (Smith et al. 1975).

**Contributors** (weights provisional, sum = 1.00; nonverbal group capped at 0.25):

| Group | Contributor (ontology) | State | Direction / corridor | w |
|---|---|---|---|---|
| Vocal | D3 pitch variability (10-s SD, ratio to baseline) | SPEAK | high; corridor lo = 0.9× baseline **[CAL]** | 0.20 |
| Vocal | C5 loudness dynamic range (P90−P10, ratio to baseline) | SPEAK | high; lo = 0.8× baseline | 0.10 |
| Vocal | E3 articulation rate (ratio to baseline) | SPEAK | inside [0.9, 1.15] | 0.10 |
| Vocal | positive-affect prosody proxy (P2; laughter presence + rising-falling contour density) | SPEAK | high | 0.05 |
| Nonverbal | F2 smile-pattern presence in appropriate units + F3 onset rise-time ≥ 0.3 s | SPEAK (non-technical units) | inside [10 %, 50 %] of speaking time **[CAL]** | 0.10 |
| Nonverbal | F6 responsive smiles (count per interviewer turn) | LISTEN·TRANS | high; lo = 1 | 0.05 |
| Nonverbal | B8 acknowledgment-given-opportunity rate | LISTEN | high; lo = student's prior-session median | 0.05 |
| Nonverbal | H1 orientation toward screen while listening | LISTEN | high; lo = 0.5 | 0.05 |
| Verbal (P3) | B10 verbal uptake at turn start | TURN start | high; lo = 1 per answer | 0.12 |
| Verbal (P3) | follow-up questions / acknowledgments to the interviewer | TURN | high | 0.08 |
| Verbal (P3) | J4 inclusive / warm register | SPEAK | inside | 0.07 |
| Verbal (P3) | J7 interviewer-name use (very low weight) | TURN | high; lo = 1 per interview | 0.03 |

**Core:** D3, plus at least one of {B8, F2, B10}.
**Contextual modifiers:** in content units tagged *technical / hardship* (P3), F2's weight is set to 0 for that unit (Wang et al. 2017 competence trade-off; incongruence with hardship content) and a `CONGRUENCE NOTE` may be raised instead; in the *opening window* W is reported separately.
**Overlap:** D3 and C5 also appear in X; W uses their *positive-affect* reading (presence relative to baseline), X their *magnitude*; the student sees one "vocal variety" tip, not two.
**Withhold when:** core missing; listening-state contributors unavailable *and* verbal group not implemented (then W is a vocal-only profile and is labelled so).
**Must not claim:** "likable," rapport, that the interviewer liked the student, a universal smile or nod target.
**Grade:** B.

---

## 4. K — COMPETENCE-CUE PROFILE (Competence lens)

**Research basis.** Fluency and composure are the second and third discriminators of hiring decisions after content (Hollandsworth et al. 1979); vocal cues outpredict visual cues (DeGroot & Motowidlo 1999); nonfluencies lower competence and dynamism (Miller & Hewgill 1964); hedges and hesitations lower authoritativeness (Erickson et al. 1978; Hosman 1989; Blankenship & Holtgraves 2005); moderate-fast rate and falling terminals raise perceived competence and confidence (Miller et al. 1976; Smith et al. 1975; Guyer et al. 2019; Vaughan-Johnston et al. 2024); reduced pitch variance lowers competence (Brown et al. 1973); illustrators raise perceived competence via understanding (Cascio Rizzo et al. 2026; Maricchiolo et al. 2009); contracted posture is read less favourably (Elkjær et al. 2020); calibration beats confidence (Tenney et al. 2007).

**Contributors** (sum = 1.00; nonverbal cap 0.15):

| Group | Contributor | State | Direction / corridor | w |
|---|---|---|---|---|
| Fluency | E7 filler rate per 100 words | SPEAK | low; hi = max(3, 1.2× baseline) **[CAL]** | 0.15 |
| Fluency | E10/E11 long mid-phrase pauses per minute | TURN | low; hi = 1/min | 0.10 |
| Fluency | E3 articulation rate (ratio to baseline; also global band) | SPEAK | inside [0.95, 1.15] ∩ safety envelope | 0.10 |
| Fluency | E8 restarts per 100 words (P3) | SPEAK | low; hi = 2 | 0.05 |
| Prosody | D6 falling terminal contours on declaratives (P2) | SPEAK | high; lo = 0.7 of sentences | 0.08 |
| Prosody | C4 loudness in corridor (fraction of speech time) + C5 range | SPEAK | high; lo = 0.7 | 0.07 |
| Prosody | D3 pitch variability (ratio to baseline) | SPEAK | high; lo = 0.7× baseline | 0.05 |
| Verbal (P3) | J1 structure elements present (situation/action/result or SAF(e) phases) | TURN | high; lo = 3 of 4 | 0.10 |
| Verbal (P3) | J3 hedge density per 100 words | SPEAK | low; hi = 2 | 0.08 |
| Verbal (P3) | J7 specificity (named entities, numbers, concrete detail per answer) | TURN | high | 0.07 |
| Nonverbal | I3/I5 illustrator proportion of gesture units during explanations (hands visible ≥ 60 %) | SPEAK | high; lo = 0.4 | 0.06 |
| Nonverbal | I9 non-contracted upper body (share of time) | ALL | high; lo = 0.8 | 0.05 |
| Nonverbal | G5 head stability while speaking (animation within baseline range) | SPEAK | inside | 0.04 |

**Core:** E3 (rate) and at least two fluency contributors.
**Separation of content from delivery:** K is *delivery of competence*. CONTENT COMPETENCE is the qualitative SAF(e) structure note (never a 1–100 grade) shown beside K, never blended into it.
**Contextual modifiers:** *STUDENT_QUESTION* turns are excluded; in the opening window K is reported separately; L2/accent flag caps the fluency group's weight at 0.25 and removes E7 from core.
**Withhold when:** rate unavailable; fewer than two fluency contributors; speech-difference flag (then "structure and prosody cues only").
**Must not claim:** "competent," correctness of the answer, residency-specific weights.
**Grade:** A/B.

---

## 5. X — EXPRESSIVENESS gauge

**Research basis.** Expressiveness predicts liking and perceived charisma (Friedman et al. 1988; Riggio & Friedman 1986; Back et al. 2010; Bono & Ilies 2006); facial expressivity is trait-like and socially advantageous with no ceiling found, including on video calls (Kavanagh et al. 2024); pitch variability and intensity variability are the acoustic core of "lively" and "charismatic" (Hincks 2005; Strangert & Gustafson 2008; Rosenberg & Hirschberg 2009); Antonakis's three nonverbal charismatic tactics are animated voice, facial expression and gesture.

**Contributors** (all baseline-relative; one-sided corridors — no red ceiling):

| Contributor | State | Direction / corridor | w |
|---|---|---|---|
| D3 pitch variability (ratio to baseline) | SPEAK | high; lo = 1.0 | 0.30 |
| D4 pitch range P10–P90 (ratio) | SPEAK | high; lo = 1.0 | 0.10 |
| C5 loudness dynamic range (ratio) | SPEAK | high; lo = 1.0 | 0.20 |
| E6 rate variability (ratio) | SPEAK | high; lo = 0.8 | 0.10 |
| F7 facial activity index (ratio, speaking + listening) | ALL | high; lo = 0.8 | 0.15 |
| I3/I4 gesture units per speaking minute (ratio; only if hands visible ≥ 60 %) | SPEAK | high; lo = 0.8 | 0.10 |
| laughter presence (P2) | ALL | high | 0.05 |

**Core:** D3 and C5.
**Why one-sided:** the documented costs of "too much" are smile-specific (handled in W/K) and velocity-specific (Koppensteiner 2017, handled as an I5 note); general expressiveness has no evidenced ceiling. The one guard: the VARY drill caps encouragement at +3 st over baseline to avoid sing-song delivery (Hincks & Edlund's naturalness check was two raters).
**Fairness:** X is the index most affected by autism, Parkinson's, depression and facial palsy; it is baseline-relative only, opt-out, and never labelled "flat."
**Withhold when:** no baseline (first session), or face coverage < 70 % *and* voiced ratio < 0.3.
**Grade:** B.

---

## 6. S — COMPOSURE index

**Research basis.** Observers infer interview anxiety from very few discrete cues; speech rate is the main mediator, and impressions of assertiveness and warmth carry the anxiety→rating effect (Feiler & Powell 2016); anxiety lowers ratings (r = −.19; Powell et al. 2018) but does not predict job performance (Schneider et al. 2019); beliefs that self-touch and hesitation signal low power exist (Carney et al. 2005) but actual behaviour–power links are weak (Hall et al. 2005).

**Contributors:**

| Contributor | State | Direction / corridor | w |
|---|---|---|---|
| E3 articulation rate — not depressed vs baseline (ratio) | SPEAK | high; lo = 0.85 | 0.25 |
| E7 filler rate | SPEAK | low; hi = max(3, 1.2× baseline) | 0.20 |
| E8 restarts (P3) | SPEAK | low; hi = 2 | 0.10 |
| D2 register stability — abrupt register jumps > 4 st inside phrases per minute (C) | SPEAK | low; hi = 2 | 0.15 |
| C2 loudness adequacy — speech time in or above corridor | SPEAK | high; lo = 0.7 | 0.15 |
| J3 hedge density (P3) | SPEAK | low; hi = 2 | 0.10 |
| I7 self-touch duration share (minor; never red; never live) | ALL | low; hi = 0.10 | 0.05 |

**Core:** E3 and one of {E7, C2}.
**Language:** "composure cues" — never "nervous," "anxious," "calm." The mentor view may show the contributor detail; the student view shows the index and the LIMITING contributor only.
**Withhold when:** speech-difference or neurodivergence flag; no baseline.
**Grade:** B.

---

## 7. Cr — CREDIBILITY / AUTHORITY-CUE lens (mentor LAB)

**Research basis.** Credibility = competence + trustworthiness + goodwill (McCroskey & Teven 1999); nonfluencies lower competence/dynamism but not trustworthiness (Miller & Hewgill 1964); powerful speech (Erickson et al. 1978); falling terminals (Vaughan-Johnston et al. 2024); confident-then-wrong sources lose more credibility than tentative ones (Tenney et al. 2007/2008); specific, verifiable examples and honest impression management raise ratings (Bourdage et al. 2018; Bangerter et al. 2014).

**Contributors (sub-view of K):** fluency block (E7, E10/E11, E8) 0.35 · D6 falling terminals 0.15 · J3 hedge density 0.20 · J7 specificity 0.15 · calibration markers — absence of overclaiming lexis ("always," "never," "definitely" density) with claims not followed by evidence (P3) 0.10 · H1 orientation toward screen during the answer's key sentence (P2; nonverbal cap) 0.05.
**Core:** fluency block + J3.
**Surface:** mentor LAB by default (3490 law: credibility/deception inference is prohibited; the lens is "CREDIBILITY CUES"); may be shown to students in PERFORMANCE mode only after the faculty-rater validation study.
**Must not claim:** honesty, trustworthiness as a trait, deception, accent as a defect.
**Grade:** B.

---

## 8. CHARISMA — profile and optional headline

**Representation.** A quadrant with the student's position `(W, K)` and a confidence ellipse (semi-axes from the contributor confidence coverage), plus the X gauge beside it, plus (P3) the verbal charismatic-tactics count as the content lever. The "charisma zone" is the region W ≥ 70 ∧ K ≥ 70 ∧ X ≥ 60 **[CALIBRATE]**. Mentor language is about *balance*: "you are sending fewer competence cues than warmth cues on technical questions."

**Optional CHARISMA-CUE BALANCE headline (3490 CB1; the only 0–100 number; PERFORMANCE mode only; post-session only):**

```
balance = min( (W + K) / 2, min(W, K) + 15 )                    # cap-by-weakest across the two profiles
CB      = bucket5( balance − max(0, 15 · (1 − X / 50)) )          # animation discount below X = 50 [CALIBRATE]
```

CB is withheld whenever W or K is withheld; it is never shown without the quadrant beneath it.

**Why not a weighted sum as the primary display.** The compensation effect (Judd et al. 2005; Wang et al. 2017) means some delivery changes move W and K in opposite directions; a sum hides the trade-off and produces contradictory coaching. The quadrant makes the trade-off the coaching object.

**Must not claim:** a validated "charisma score," "charismatic" as a trait, any of the Science of People numbers.
**Grade:** B for the structure; E for any single validated number.

---

## 9. Cl — CLARITY / STRUCTURE (P3)

Contributors: J1 structure elements 0.30 · J6 signposting/lists/contrasts 0.20 · E12 phrase length in band (1.0–2.0 s mean length of runs **[CAL]**) 0.15 · E11 pauses at clause boundaries rather than mid-phrase 0.15 · I3 illustrators during explanations (cap) 0.10 · E7 fillers 0.10. Core: J1. Surface: post-interview beside K. Grade C/B.

---

## 10. Worked example (numbers illustrative)

Answer 3, 95 s of speech, baseline available, hands visible 72 % of speaking time, face coverage 91 %, ASR coverage 84 %, verbal group not yet implemented (P3).

K contributors: E7 fillers 4.8/100 (corridor hi 3, b 3) → 40; E10/E11 long mid-phrase pauses 0.6/min → 100; E3 rate ratio 1.05 → 100; D6 (P2) unavailable; C4/C5 loudness in corridor 0.82 → 100; D3 ratio 0.6 (lo 0.7, b 0.7) → 85; I3 illustrator proportion 0.5 → 100; I9 non-contracted 0.9 → 100; G5 → 100. Available 8 OF 13 (verbal 3 and D6, E8 absent). Weighted ≈ (0.15·40 + 0.10·100 + 0.10·100 + 0.07·100 + 0.05·85 + 0.06·100 + 0.05·100 + 0.04·100) / 0.62 ≈ 84; weakest core-or-major = 40 (fillers, w 0.15 ≥ 0.08) → index = min(84, 55) = **55**, `LIMITING: FILLERS (4.8 per 100 words)`, ring `8 OF 13`. The post-answer card's corrective item is therefore about fillers, and the student is told the verbal contributors are not yet measured.

X contributors: D3 0.6 → 43 (lo 1.0, b 0.5 → 1 − 0.4/0.5 = 0.2 → 20; using b = corridor default 0.5 gives 20; with the [CAL] band-width 1.0 gives 60 — this is exactly the kind of parameter the calibration study must set); C5 ratio 1.1 → 100; E6 → 100; F7 ratio 1.3 → 100; I3 ratio 0.9 → 100. Weighted high but weakest 20–60 → X capped at 35–75 with `LIMITING: PITCH VARIABILITY`. The two indices converge on one tip — vary pitch — while the fillers tip comes from K; the card shows the K item (higher-evidence contributor) and holds the X item for the next answer.

---

## 11. Validation and weight-setting plan

1. Weights above are priors from effect sizes and prior architecture; they are **exposed in the admin profile inspector** and versioned.
2. The faculty-rater study (spec Appendix C) fits weights by constrained regression of blinded ratings on contributor cue scores, with the nonverbal cap enforced as a constraint and separate fits for W and K; weights that do not survive cross-validation are set to 0 and the contributor becomes a descriptive lens.
3. Fairness audits (spec §23) run per contributor and per index: availability parity, feedback parity, test–retest ICC ≥ 0.7; a contributor failing parity is demoted regardless of its regression weight.
4. Nothing in this document changes a measurement; only cue-score corridors, band-widths, weights, caps and withholding thresholds are tunable.
