# Y1-Y2-CAM-V6-3494A — PROGRESSION ENGINE SPEC

## 1. ProgressionEngine (general, configurable; example ladders are NOT product law)

Inputs (events): reps completed · distinct questions practiced · new question mastered · repeat improvement (PB delta on same question) · Personal Best set · mission completed · DI improvement (corridor dwell gains, limiting-contributor lift) · mentor-approved milestones · category completion (e.g., all CORE attempted). Outputs: XP · level · rank · badges · unlock eligibility · generated missions. All thresholds/curves in config (`progression.yaml`-class), Founder-tunable, never hardcoded.

## 2. Anti-grind law (do not reward bad practice)

Per-question XP decays after N attempts without improvement [CALIBRATE]; repetition without PB/DI delta yields minimal XP; breadth multipliers (new questions, new categories) outweigh repetition; consistency (streaks) rewards cadence, not volume; mentor validation gates the highest tiers. Canonical example: 100 bad "Tell me about yourself" reps ≠ elite — attempts accrue, XP plateaus, mastery stays sub-GOLD without structure+delivery+review criteria.

## 3. Unlock gating (conversational mode is EARNED)

Example ladder (configurable, explicitly not final): L1 CORE REP → L2 TRADITIONAL → L3 BEHAVIORAL → L4 CV-BASED → L5 FULL INTERVIEW → L6 CONVERSATIONAL INTERVIEW. `LiveConversationalStrategy` requires unlock eligibility AND provider credits (below). Admin override exists (mentor may grant early access, audited).

## 4. Mastery model (per-question, separate from XP)

`Question mastery = f(attempts, structure signal [SAF(e) qualitative met], delivery signal [DI corridor performance], mentor review ✓)` → tiers e.g. BRONZE/SILVER/GOLD [naming configurable]. Displayed in drawer stats and Library; drives NEEDS WORK collection.

## 5. Badges (meaningful, Performance Engine visual language)

CORE TEN · BEHAVIORAL READY · STORYTELLER · CONFLICT READY · CAMERA READY · VOCAL VARIETY · HANDS IN PLAY · CONSISTENCY · COMEBACK · PERSONAL BEST · FILM ROOM STUDENT · CV READY. Each badge = explicit criteria referencing engine events; chamfered plate visuals, no stickers.

## 6. Credits/economy separation (architected, not priced)

**XP/progression points** (earned, non-monetary, drive unlocks) are a DIFFERENT ledger from **LIVE INTERVIEW CREDITS** (provider-use metering: live follow-ups consume runtime; full conversational is premium). No automatic XP↔credit conversion anywhere. Pricing, grants, and top-ups are MissionMed business decisions outside this spec; the engine only exposes `credits.balance/consume/grant` with audit.
