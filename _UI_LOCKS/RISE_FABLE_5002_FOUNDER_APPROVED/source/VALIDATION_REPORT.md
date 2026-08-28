# Validation Report — P1-RISE-5002

**Build:** `RISE_NEXTGEN_FABLE_FOUNDER_SHELL.html` · 341,018 bytes · single file, offline · SHA-256 in `CHECKSUMS.txt`
**Browser:** Chromium 1194 (Playwright) headless, 1440×900 / 820×900 / 390×800 · **Console/page errors: 0** across two full runs.

## Automated click-through (scripted, screenshots in `qa/`)
| # | Surface | Result |
|---|---|---|
| 1 | Boot → Home (greeting, hero, fit panel, doors, strip) | ✅ `01_home`, `01b_home_doors` |
| 2 | Autocomplete "brookdale" → Enter → File opens, hash `#/program/demo-brookdale/overview` | ✅ `02`, `03` |
| 3 | All six tabs on Brookdale | ✅ `04` |
| 4 | Escape → returns to origin route | ✅ |
| 5 | Fact card: "Does SUNY Upstate sponsor H-1B?" → glyph + quoted wording + Open File → Fit | ✅ `05` (fixed in pass 1: intent entity cleaning; stacking context) |
| 6 | Find: 50 virtual rows of 152; header lookup opens Upstate over the list | ✅ `06`, `07` |
| 7 | Upstate Fit tab (real requirements table, 6/1/0/3/0 strip) | ✅ `08` |
| 8 | Locked Residents → Unlock sheet → Preview as member → roster/People/Fellowships unlocked | ✅ `09`–`13` |
| 9 | Sources & freshness panel (families, conflicts, unresolved, ledger) | ✅ `14` |
| 10 | Save + Compare from the File; back to identical list state | ✅ |
| 11 | Grid toggle · More-filters drawer | ✅ `15`, `16` |
| 12 | SOAP door → 26 rows, track segments, caveat | ✅ `17` |
| 13 | My Programs (state chips, notes) · Compare overlay (crown suppressed, legend) | ✅ `18`, `19` |
| 14 | Rank List seam · Profile · CV picker → extraction confirm sheet | ✅ `20`–`23` |
| 15 | Admin: builder, NL chip → draft (12 programs · 24 tasks · $7.20) → RUN → queue simulates to completion → freshness flips | ✅ `24`–`27` |
| 16 | Review queue: accept decision recorded; badge decrements | ✅ `28`, `29` |
| 17 | Coverage matrix + click-to-scope | ✅ `30` |
| 18 | Themes Graphite/Daylight · 820px · 390px bottom-tab layout | ✅ `31`–`35` |

## Self-critique pass 1 (vs 5001 / A–G mockup / B1-517) — defects found & fixed
1. Fact-card intent failed on natural phrasing ("Does X sponsor H-1B?") → entity-cleaning rewritten; verified.
2. Fact card painted beneath the "Try asking" chips (finished-animation stacking context) → `heroWrap` given its own stacking context; verified.
3. Upstate "Application deadline" showed **Meets** with You "—" → reclassified as Policy (ⓘ) so a program fact never reads as an applicant pass.
4. Representative-preview reason string overflowed row sub-lines → shortened; chips keep the violet dot + tooltip.
5. Admin Preview showed "0 programs · Skips: 151" before any family was chosen → replaced with "Pick at least one field family."
6. Lock icons on the tab strip survived "Preview as member" while the File stayed open → File re-renders on entitlement change.
7. Programmatic focus ring on the File title read as a selection box → suppressed (focus still lands there for SRs).
8. Home doors fell fully below the fold at 900px → hero padding tightened, Gold list capped at 3; doors now crest the fold.
9. Mobile ≤640px: three-line brand sub wrapped the header → hidden at that width.

## Self-critique pass 2 (as a first-time IMG applicant) — judgments
- Five-second test: greeting + one box + one button; nav is five words; nothing reads enterprise. **Pass.**
- Cognitive load: rows carry 8 items but only name + fit are high-contrast; deep data stays behind the File. **Pass.**
- Honesty affordances survive styling: "not match odds" legend renders 4 places; UNKNOWN is a grey dashed circle everywhere; SOAP caveat on door, filter, and tab. **Pass.**
- Premium frustration: with zero membership every tab still teaches something real; exactly one lock per tab. **Pass.**
- Residual (accepted for founder shell, listed for Phase 1): Quick Look absent; keyboard row-to-row arrows not implemented (Tab works); Your-fit panel leans on labeled representative chips until real requirements land; in-memory state resets on reload.

## Verdict
`SAFE_FOR_FOUNDER_REVIEW = YES` — visual/UX judgment only; not production, not wired, not deployed.
