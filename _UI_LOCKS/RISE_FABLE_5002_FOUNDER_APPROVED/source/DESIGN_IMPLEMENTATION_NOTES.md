# Design Implementation Notes — P1-RISE-5002

How the P1-RISE-5001 architecture became this shell, what was inherited from StoryForge B1-517, and where the build deliberately deviates.

## 1. Chassis (doc 04)
- **Rail:** 232px, single skewed ember CTA **"Tell me about…"**, five destinations (Home · Find Programs · My Programs · Rank List · My Profile), parallelogram tabs with rendered icons at 15px Rajdhani, admin group appears only in Admin preview, footer = Back to Matrix · role chip · role switch · identity. Collapses to a 76px icon rail ≤1180px and a bottom tab bar ≤860px.
- **Header:** 64px, brand "MissionMed**//RISE** · Residency Intelligence · Mission:Residency Division" (StoryForge brand treatment), founder chip, Compare tray, Theme, and the "/" Lookup — the **same component** as the hero and the rail CTA. One search system.
- **Ambient:** three aurora blobs + vignette, `glowPulse` idle on the hero, reduced-motion kills all of it.
- **Overlay mechanics:** the Program File is StoryForge's `#room` pattern **plus routing** — `#/program/:id/:tab`, Escape/backdrop/back all return to an untouched list (scroll + filters + focus preserved; `inert` on the page behind).

## 2. Home (doc 06)
Band order exactly as specified: greeting → sub-line → hero lookup (prefix **Tell me about**, placeholder "…a program, a hospital, a city", **Open File**) → three "Try asking" chips → grid (Your fit 1.55fr | My programs + Your profile 1fr) → four doors → Updated-this-week strip. "Dr Brian's read" renders inside the fit panel (B1-517 Recommends visual, program payload). The fit legend is always present and not dismissible.

## 3. Lookup intents (doc 06 §6.3)
Closed set, no chat: program autocomplete (aliases included — try `saint agnes`… not in corpus, honest empty state; `upstate`, `brookdale` work), `fit_in_place` ("Which New York programs fit me?"), `program_fact` (visa/exams/deadline → fact card with glyph + quoted wording + source path), `similar`, `soap`. Unrecognized input gets the "I looked for programs matching…" line.

## 4. Find Programs (doc 07)
List default, grid toggle, three modes (criteria / profile / CV), primary filter row of 5, More-filters drawer with caveats and removable pills, honest coverage banner, eight-item rows (★ · IM tag · name · sub-line · fit line · IMG/DO · visa · SOAP · freshness · actions), tier stripe on the left edge, cap-4 Compare with the exact 4001 toast, "Best fit for me" sort placing unknowns between silver and issues.

## 5. Program File (docs 08–09)
Five-second header: initials tile · specialty/track eyebrow · name · identity line · **For you** card (tier + fit line + two reasons) · three text signals · Save/Compare/Ask · freshness pill · Sources ⓘ. Six tabs; Sources & Freshness is a slide-in utility panel reachable from the header and every ⓘ. Five-state glyph system throughout (Meets ✓ / Check ! / Issue ✕ / Not published ○ dashed / Conflicting ◐), denominator gates, law banners, per-tab Unknown footers using the 4105BC strings, premium regions as real-summary + skeleton + one Unlock sheet ("Preview as member" included for your review).

## 6. Admin (doc 12)
Campaigns stepper (Scope → Fields with live coverage counts → Preview with visible cost math → RUN), NL bar that drafts-then-confirms (your four example sentences all parse; the H-1B hearsay becomes a labeled hypothesis), simulated task state machine (QUEUED → RUNNING → RETURNED → NORMALIZED → QA → INGESTED/PARTIAL/NEEDS_REVIEW), roster privacy holds honored, Review queue with the five-action change card, Coverage matrix with click-to-scope, budget caps. Students see only Updating / Verified recently.

## 7. Deliberate deviations from the 5001 spec (all founder-shell pragmatics)
1. **Quick Look omitted** — Compare + the File cover the review path; Quick Look is Phase-1 backlog, not a design change.
2. **"Preview as member" button** added to the Unlock sheet — exists only so you can judge both sides of every lock; not a product feature.
3. **Representative fit preview** for Tier-A programs (violet-dot chips) — the corpus has verified requirements for only 2 programs, and a Your-fit panel with two rows can't be judged. Every preview is labeled, and SUNY Upstate's fit is genuinely computed.
4. **In-memory state only** (no persistence) — a founder shell should reset clean.
5. **Freshness dates** for SOL56 rows use the wave dates (2026-08-10 / 2026-07-14) at program level; assertion-level dates arrive with the real ingest.
6. **Specialty select** lists only IM (+FM disabled note) — the shell refuses to fake 31 specialties.

## 8. What was explicitly rejected from 4001 (per the failure condition)
No Command homepage, no Command/Explorer/Compare/ACTN/Queue rail, no MM-Fit ring or number, no "IMG 5/5", no card-first Explorer, no System panel, no CONFIDENCE/INTENSITY chip soup, no 8–12px micro-type (floors: 18/16/14, labels ≥11 non-essential). 4001 contributed content depth only (Brookdale demo record, MissionMed Notes box, interview-intel seam).

## 9. Codebase shape (for the Phase-1 builder)
Single self-contained HTML (~340KB): tokens/CSS (~1,050 lines) + `RISE_DATA` JSON (152 programs) + four JS modules (core/shell/lookup/home · find/my/rank/profile · file/tabs/sources · admin). No framework, no external requests, system-font fallbacks (Archivo/Rajdhani/Lora load if installed; the geometry works without them — production self-hosts the woff2s per doc 14). The source modules are the working styleguide; the production build (P1-RISE-5001 doc 16) still owns stack decisions.
