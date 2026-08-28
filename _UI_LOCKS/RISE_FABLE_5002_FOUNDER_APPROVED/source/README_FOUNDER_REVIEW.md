# P1-RISE-5002 — RISE Next-Gen Founder Shell

**Open this file in Chrome:** `RISE_NEXTGEN_FABLE_FOUNDER_SHELL.html` (double-click; fully offline, one file, no install, no network).

This is the working interactive shell of the RISE architecture from P1-RISE-5001, built by the same model that designed it. Everything is clickable; nothing spends money, calls Parallel, writes a database, or touches WordPress/Matrix/Supabase. Session state (saves, notes, campaigns) lives in memory and resets on reload — intentional for a founder shell.

## The 10-minute review path

1. **Home.** Read the page cold. The test: is it obvious in seconds? One input ("Tell me about…"), your fit (Gold/Silver), your programs, four doors, freshness strip.
2. **Type `brookdale`** in the big box → Enter. The **Program File** opens over the page (94% viewport). Walk the six tabs. Close with Escape — you land exactly where you were.
3. **Type `Does SUNY Upstate sponsor H-1B?`** → Enter. A **fact card** answers with the five-state glyph and the program's exact published wording — not a chatbot.
4. **Try asking → "Which New York programs fit me?"** → Find Programs opens filtered to NY, profile mode, sorted by fit.
5. **Find Programs.** List-first. Toggle Grid. Open **More filters** (every filter carries its evidence caveat). Save a few programs (★), add two to **Compare**, open Compare from the header tray.
6. **Open `SUNY Upstate`** — the real gold dossier. Fit tab: real requirements vs the demo profile, quoted program wording, prior-cycle flags, visa "listed ≠ sponsorship". Residents/People/Fellowships are locked → click a lock → **"Preview as member"** and re-read them: real roster examples, Viren Kaul "Residency here: YES", ten in-house fellowships, fellows' origins with no fabricated retention. Open **ⓘ Sources & freshness**.
7. **Home → SOAP 2026 Openings** door. 26 real NRMP-joined programs; Categorical / Preliminary / Primary Care segments; the evidence caveat everywhere.
8. **My Programs** — advance a state chip (saved → applied → …), write a note. **Rank List** and **My Profile** show the RankList IQ and Matrix seams.
9. **Admin preview** (bottom of the rail). Click the chip **"Update all current resident rosters in New Jersey"** → confirm the drafted scope → **Run research** → watch the Queue simulate task states → **Review** (accept the real SUNY Upstate surname conflict; try the leadership-change card) → **Coverage** (click a cell to pre-fill a campaign).
10. **Theme** button (header): Midnight Depth → Graphite Motion → Soft Daylight. Then narrow the window to phone width.

## What is real vs representative
Short version: 150 SOL56 programs, ABIM rates, SOAP 2026 joins, and everything inside SUNY Upstate are **real research**. Brookdale's depth and the Gold/Silver chips marked with a small violet dot are **representative previews**, labeled in the UI. Full accounting in `DATA_PROVENANCE.md`.

## Files
- `RISE_NEXTGEN_FABLE_FOUNDER_SHELL.html` — the deliverable
- `DESIGN_IMPLEMENTATION_NOTES.md` — how 5001 → pixels, and deliberate deviations
- `DATA_PROVENANCE.md` — real vs demo, field by field
- `FOUNDER_REVIEW_CHECKLIST.md` — the judgment sheet, mapped to your ticket
- `VALIDATION_REPORT.md` — browser QA evidence + self-critique passes
- `CHECKSUMS.txt` · `qa/` — 36 screenshots from the QA run
