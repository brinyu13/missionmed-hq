# Interview Ready — final state delta (Fable → Codex), 2026-10-06 20:50 ET

## LIVE NOW (verified)
- Route: https://missionmedinstitute.com/interview-ready/ · host `missionmed-kinsta`, webroot `/www/theresidencyacademy_209/public`
- `current` → `releases/9511a1d281571c20d305cc20a312647459675fecd86c9c84c1554c5d87caf561` (Option 5 + exact product imagery + Founder logos)
- Source commit `f23a60a28d17d3298cee998fb351eff6cc456f57` on `codex/ir-interview-ready-0002-storyforge` — **pushed** (origin now f23a60a). HEAD == f23a60a.
- Gateway unchanged `819dd734…`; 15 shared Matrix files hash-checked before/after both deploys; Kinsta cache refreshed (IR route + home, 200) — live fetch confirmed `x-kinsta-cache: MISS→HIT` serving the new build.
- Deploy receipts: `release-f23a60a/deploy-receipt.json` (PASS, 20:43:54–58 ET) and `release-9445445/deploy-receipt.json` (PASS, 19:16 ET, the intermediate Option 5 release c5604978).

## Rollback (preserved, untouched)
- `.previous-635f64ba1cfb7c84-to-30fa9d48bcf6f983` → `releases/c5604978…` (Option 5 without logos)
- `.previous-3621ddb7cbb26de0-to-635f64ba1cfb7c84` → `releases/d4439bb8…` (pre-Option-5 commerce release)
- Restore = `renameat2(EXCHANGE)` of the chosen `.previous-*` symlink with `current`, then the two cache POSTs (see `release-*/deploy_release.py` remote block). Stage dirs `.candidate-635f64ba1cfb7c84`, `.candidate-30fa9d48bcf6f983` still present (archive + emptied payload) — safe to leave.

## Live verification run against the production URL (headless Chromium, 20:46 ET)
- Branding: header + guide masthead use the MissionMed Institute shield; Option 5 lower band shows MissionMed Institute (133×52) + Mission Residency (124×36) logos; `mountain-mark` references in live HTML: 0.
- Option 5 intact: webcam/mic/light each 3 featured cards (Brio / Facecam MK.2 / Canon R50 kit · Q2U / MV7+ / MV7+ chain · Litra Glow / Key Light / Key Light two-light plan), all with real product images, zero glyphs; Also-in thumbs all load.
- View as featured: Brio → EMEET S600 (`online:webcam:bc:B0CYQ5P6T7`), Reset → Brio. Save to kit on the swapped product stores exactly `["online:webcam:bc:B0CYQ5P6T7"]`; #kit route shows EMEET S600.
- Compare tray: 2 image thumbs, Compare now enabled; detailed comparison renders (23 rows, image vs image, 0 fallbacks); Back to shopping works.
- Amazon links without `tag=missionmatch-20`: 0. No price/rating strings.
- Mobile 390×844: tray fixed above the mobile nav, first card visible, no horizontal overflow.
- Page errors: 0. Failed/4xx requests: 0. Console errors: only pre-existing CSP refusals for `mu-plugins/missionmed-site-icon-assets/*favicon*` (site-level icon plugin vs the IR gateway's CSP — **not introduced by this release**, cosmetic; separate ticket).
- Founder's Chrome: live route opened in tab "Online Interview Gear · Interview Ready · MissionMed"; extension screenshot timed out (window state), console clean.

## Not done / for Codex
1. Registry/DR: no lease taken, no DR filed for 9445445→f23a60a. Reconcile via registrar (needs Keychain) using `CURATION_20261006/REGISTRY_RECONCILIATION_DRAFT.md` + extend admitted paths with `img/brand-*.webp`, `sources/brand-*-src.png`, `evidence/brand-logos-2026-10-06.json`, `evidence/image-audit-2026-10-06.json`, `evidence/manufacturer-images-2026-10-06.json`, `production-assets.json`, `phase1.js`, `qa-images.py`, `hydrate_manufacturer_images.py`. Record the two production pointer moves (d4439bb8→c5604978→9511a1d2) as DR-375/376 annex entries.
2. Commit nothing-yet: this file and the two `deploy-receipt.json`/`deploy-console.log` files are untracked (release folders are untracked except the two handoff docs). Decide whether receipts are committed (they contain no secrets; push stderr is the GitHub URL only). `interview-ready/dist/account-gate.html`, `dist/matrix-entry.js` untracked build outputs — pre-existing, leave or ignore.
3. Favicon CSP console noise (above) — site-icon mu-plugin vs IR gateway CSP `img-src`; not a release regression.
4. Follow-ups unchanged: Creators API adapter once ≥10 qualifying sales/30 d; Associates tax info; Founder sign-off on the 10 curated ASINs; B07L755X9G listing vs MK.2 copy; Elgato/Corsair press-kit permission email (optional); C920x / NEEWER holds lift automatically when an authorized image exists.

## Constraints honored
No features added, no redesign, no broad audit, no credentials in files/logs, charity OFF, numeric Amazon facts OFF, missionmatch-20 preserved, shared Matrix bytes untouched, rollback preimages retained.

TERMINAL STATE: INTERVIEW READY OPTION 5 + EXACT PRODUCT IMAGERY + CORRECT MISSIONMED BRANDING — LIVE + VERIFIED.
