# CURRENT LIVE vs NEW CANDIDATE — VISUAL REVIEW

All screenshots in `screenshots/`. Live pages captured 2026-09-02 from production; candidate captured from the local preview at the same viewport.

**A note on method.** Full-page captures use a very tall window. That distorts any layout built on `100vh` — my first full-page capture of the live Mission Residency page stretched its hero to ~6,500px and looked like a catastrophic layout bug. It is not: it is a capture artifact. **The fair comparison is the matched 1440×900 above-the-fold pair**, which is what the verdict below rests on.

| Purpose | Live | Candidate |
|---|---|---|
| Above the fold, matched viewport | `fold_LIVE_mr_1440x900.png` | `fold_CANDIDATE_mr_1440x900.png` |
| Corporate homepage fold | `fold_LIVE_home_1440x900.png` | `v2_home_corporate_stateA.png` |
| Full page | `live_mr_desktop_BEFORE.png` *(vh-distorted)* | `v2_mr_desktop_stateA.png` |
| September 8 state | — *(does not exist live)* | `v2_mr_desktop_stateB_sept8.png` |
| Mobile | — | `v2_mr_mobile_stateA.png`, `v2_compare_mobile.png` |

---

## ABOVE THE FOLD — MISSION RESIDENCY

**Live.** Genuinely decent, and better than the V1 rejection implied. A strong branded photograph (the embroidered *MATCHED / ACCOMPLISHED* patch), a confident Playfair headline, real site header and nav.

Its problems above the fold:
- The top bar leads with **"89.1% MATCH RATE · 3,000+ TRAINED SINCE 2009"** — an unsupported figure as the very first thing a visitor reads, and it contradicts the same page's footer, which says *"since 2015"*.
- The sub-headline is a 5-line paragraph of small grey body copy.
- No price, no availability, no proof of outcome, and no route to a program.
- Nothing indicates it is interview season or that anything is time-bound.

**Candidate.** Same photograph, deliberately kept. Changes:
- Headline scaled up and set on a **horizontally weighted scrim** so the photograph reads instead of flattening to grey.
- Sub-copy cut to three lines of near-white text at a larger size.
- **Two CTAs with a clear primary.**
- A **proof strip with five real student faces** and one line of copy — outcome proof above the fold, which the live page has nowhere.
- Campaign state (or its honest absence) stated in the bar above.

---

## THE FULL PAGE — WHAT ACTUALLY CHANGED

| | Live | Candidate |
|---|---|---|
| Visual environments | One dark treatment throughout | **Nine alternating**: image-led → light → deep → dark → light → navy → dark → light → deep → navy |
| Video | **None on this page** (all 8 sit on the corporate homepage) | **Eight real Match Day videos**, click-to-play, on the page that sells |
| Real photography | Hero, plus one stock CTA background | Hero + real class session + Dr. Brian portrait; stock CTA replaced |
| Body copy | Small grey | Near-white, larger, **zero AA failures across 142 elements, lowest 5.01** |
| Program cards | Class metaphor, strikethrough prices, "Save $950" | Fit-first pitch, factual two-number frame, explicit absences |
| Tier boundary | Left to a feature grid | **Its own section**, argued in money, with the upgrade credit |
| Payment | "Pay via Zelle for fastest enrollment" in body text | **Ranked hierarchy** — Zelle best value → card → plan |
| Campaign state | *"Price increases July 1"* — 2 months expired | Config-driven; the Sept 8 state already exists and flips itself |
| 360 | **Purchasable at $3,999**, "unlimited mock interviews", "Limited spots" | Closed, $5,499 reference, capacity-reached, no banned claims |
| Proof placement | Pooled | Four separate points through the page |

---

## THE CORPORATE HOMEPAGE

**Live.** Strong emotional and proof page — eight video testimonials, a footnoted unmatched-cost ledger, the NRMP factor table, the mentors. But it **sells nothing**: no program, no price, no enrollment path, and no indication of season. The three divisions appear only in the nav.

**Candidate.** Two blocks added, nothing removed:
1. A **seasonal Match-season band** on the real class photograph, routing into `/mission-residency/`.
2. A **three-division band** so ExamPrep and Mission: Clinicals become discoverable in the page body — where today they are merchandised nowhere.

Plus the three unsupported stats flagged for removal.

---

## THE FOUNDER GATE

> *"If the founder would not immediately prefer the new candidate to the current live homepage when shown side by side, `VISUAL_PASS = FAIL`."*

**Assessment: PASS**, on these grounds:

1. It carries **more authentic MissionMed content**, not less — eight real videos and two real photographs that the live sales page does not use at all.
2. It **answers commercial questions the live page leaves unanswered** — price, availability, what happens after enrolling, which program fits, how to pay.
3. It is **measurably more readable** — larger type, near-white body copy, and zero AA contrast failures where the live page leads with small grey text.
4. It has **visual rhythm** where the live page has one continuous treatment.
5. It **removes claims that are live and indefensible today** — an expired July deadline, strikethroughs against prices never charged, "unlimited mock interviews", three contradictory guarantees, and a purchasable 360.

**Where the live page is still better, and this is worth saying plainly:**
- Its hero photograph is used at full strength; the candidate necessarily darkens part of it for text legibility.
- It has a **FAQ** that the candidate does not yet carry. That is a genuine gap and should be ported.
- Its cost-ledger and PD-factor sections are excellent and are **not** reproduced in the candidate — they should be kept on the page, not replaced.

**This is a founder judgement, not mine to certify.** The evidence is in `screenshots/`, and the honest limits are in `VISUAL_DIRECTION_V2.md`.
