# Y1-Y2-CAM-V6-3490 — CLAUDE CODE BUILD CONTRACT

SCOPE: implement the selected IV Prep On-Call frontend against the existing system. **No backend redesign. No deployment. No provider session initiation. No LemonSlice calls — human-Founder-gated only.**

## 0. Inputs

1. `Y1-Y2-CAM-V6-3490_FABLE_FINAL_PRODUCT_ARCHITECTURE.md` — binding architecture.
2. `Y1-Y2-CAM-V6-3490_SHOWROOM_SELECTIONS.md` — after Founder dispositions (until then, build to FABLE NORTH STAR).
3. `Y1-Y2-CAM-V6-3490_IVPREP_AAA_SHOWROOM.html` — reference implementation of instruments, arbitration, composite math, scenarios, and design tokens. Lift mechanics, not the showroom chrome.
4. 3472 §15/§16 — normative instrument interface + adapter contract (below).
5. 3471C §1–§2 — interpretation boundary + evidence law (binding at string level).

## 1. Non-negotiable laws (lint-enforceable)

- Color tokens exactly: `--ok:#2FA84F --warn:#F5A623 --bad:#D93B3B --info:#2E6BE6 --neutral:#8A94A6 --ink:#FFF --ink2:#D7DEE8 --bg:#0B0E13`. No neon/glow/bloom. Literal metric titles.
- Instrument interface (3472 §15.0): `mount(el)` `update(frame)` `setDensity(d)` `setMode(m)` `destroy()` `getCorrection() → {text,severity,correctability,kind}|null`. Instruments never draw their own correction banner live; the shell arbiter decides.
- Frame object shape: `{t, phase(OPEN|ENUMERATE|PROVE_STORY|CLOSE), targetRef, density, mode, coverage(OK|LOW|UNAVAILABLE), confidence, value{...}, target{lo,hi}, baseline}`.
- Arbiter: setup pre-empts → severity×correctability (level 1.0, pace .8, gesture space .5, cadence .3) → 4s min dwell → 2s min gap → suppress on LOW → suppress PATTERN until window fills (`MEASURING · Ns/6s`) → suppress first 3s → one correction max, all live modes.
- Composite law: `master = min(weighted_mean, weakest + 15[CALIBRATE])`; contributors always visible; weakest flagged `LIMITING`; coverage ring + `N OF M CONTRIBUTORS`; buckets of 5; UNAVAILABLE leaves the denominator (never zero, never silent renormalize); scores never flow down.
- Fail-closed: UNAVAILABLE / SUPPRESSED / WARMING UP / hatched lanes. No interpolation, no stale carry-forward. Raw audio/frames/landmarks never persisted.
- Claim safety: 3472 §13 prohibited-word list enforced by a string-lint over UI strings, telemetry keys, logs, exports (incl. CSV headers). `-CUE PROFILE` suffixes never shortened. "confidence" only as detector confidence, LAB/Mentor only.
- Separations: SAF(e) qualitative, never numeric, never fused with Delivery Intelligence (they meet only in AR1). Self-adaptors: detected, Film-Room-only, neutral color, contribute to no composite. Opportunities: post-only, ≤4/answer, `GESTURE OPPORTUNITY` never `MISSED`. Simulation: zero HUD, hard-coded. Mentor-private lanes: separate render target, not hidden CSS. LAB never leaks into SIMPLE.
- Semitones for pitch, never Hz. `PITCH — UNAVAILABLE` chip everywhere F0 is absent.

## 2. Build order

**WAVE 0 (accepted primitives only):** app shell NAV2 + HOME1 + MODE2 + BTN1 tokens · WIZ2 + CHK1 (FF dock as check) · PREP2 · STAGE2/STAGE4 + CTRL1 + SELF2 · KELLY2 frame with TEXT + PRE-GEN tiers + ERR1 states · HUD chassis (NO/MIN/STD/COACH) + arbiter + COACH1 · instruments: VVLOCK corridor+VD1 bracket, FFLOCK dock, GZLOCK field (presence/centers) · AR1 post-answer card · RES1 · VLT1 entries · density/role switching · fail-closed states · scenario harness (S1–S6 synthetic driver from the showroom) as the QA fixture.
**WAVE 1 (derivation):** VC pace w/ confidence gating · GH3/GH6 film lenses · GS2/GS5 co-occurrence · TM1 Film Room lanes + coverage lane + seek contract (click → t−2s; hover → detector/value/confidence/phase; lane toggles persist; export PNG+CSV) · PB1/BEST1-2 storage · MEN1 studio + markers + teach-this-moment packaging · PRG2 · micro-missions.
**WAVE 2 (new engineering):** F0 stack → VPLOCK + vocal phrase map · VRLOCK cadence + CM3 · phase contract (manual→assisted) · composites GELOCK/CW4/CC4/CB1/WX1/CD with ADM2 inspector + ADM3 tuner and human-validation loop · NG fingerprint (STEP 1–5 workflow, 45s min coverage, 90-day expiry, consent step) · GO opportunity engine (ASR WER gate) · NLS1 · HUD5 full adaptive logic.
**WAVE P (human-gated):** Dr Kelly QA loop UI (READY → human START → STOP/timeout → cleanup → TEST AGAIN), natural-initiation fix, fallback ladder verification. Never autonomous.

## 3. Acceptance

Scenarios S1–S6 (3472 §12) pass criteria verbatim, plus ticket scenarios B/C/D/E on the composite surfaces (all already animated in the showroom as reference behavior). Two-foot test with numerics hidden on every live instrument. String-lint passes. A build that renders beautifully but fails S4 (loud monotone) fails outright.

## 4. Adapter seam

All telemetry flows through one adapter (`attachSource(source)`); the synthetic scenario generator and the future live pipeline are interchangeable sources. "All that remains is wiring real telemetry/provider/data into the selected frontend" must be literally true at the end of Wave 0.
