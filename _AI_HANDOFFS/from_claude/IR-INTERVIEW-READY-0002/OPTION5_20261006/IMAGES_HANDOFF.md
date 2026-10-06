# Interview Ready — product image hard requirement (2026-10-06)

Branch `codex/ir-interview-ready-0002-storyforge`, worktree `/Users/brianb/MissionMed_worktrees/IR-INTERVIEW-READY-0002`.
**Implementation SHA: `94454455b610515562ac8be1609830dff5f8c17c`** (chain: `062fe9d` hydration → `138bf3a` comparison caption → `9445445` review conditions). Local only: not pushed, not deployed, no lease, no OS change.
Candidate build `candidate-build/interview-ready.html` SHA256 `c5604978213fab6313e88f1fc3ec7d135ffd7cc60fee9be792fd1f6b0f7d143f` (2.17 MB, production asset profile, local).

## Amazon Creators API — inspected in the signed-in account (2026-10-06 15:50 ET)

Founder signed in; read-only inspection of `affiliate-program.amazon.com/creatorsapi` and the dashboard (StoreID `missionmatch-20`).

| Question | Answer |
| --- | --- |
| A. Account accepted? | Active Associates account with a working dashboard; the home page flags that the **primary account holder still has to submit tax information** (a payment blocker, not an API blocker). |
| B. Creators API available? | Yes, the Creators API console is open to the account ("Create App"). |
| C. Application exists? | No — zero applications. |
| D. Credentials provisioned? | No. |
| E. Can the account create one? | Yes (up to two apps, two credential pairs each; needs Full-access login). |
| F. Eligibility blocker? | **Yes, and it is decisive today:** product-data access (PA-API through Creators API) requires ≥10 qualifying sales in the past 30 days; the dashboard shows **0 clicks, 0 ordered items, 0 shipped** in the last 30 days. Credentials created now would return `AssociateNotEligible` (Amazon reviews eligibility for up to 48 h, then denies). |

Decision taken: **no application or credentials created** — nothing to gain until the sales threshold is met, and a one-time-shown secret would otherwise sit unused. The manufacturer-image path above is therefore the production authority for this release. The server-side Creators API adapter (§3) stays a bounded follow-up, to be built once the account records ≥10 qualifying sales in a trailing 30-day window (and the tax information is submitted so earnings can be paid).

## What was done — manufacturer imagery (§6), exact product only

| Product | ASIN | Source (public) | Note |
| --- | --- | --- | --- |
| Elgato Facecam MK.2 / Facecam 4K / Wave:3 MK.2 / Key Light / Stream Deck Neo / MK.2 / + / Wave Mic Arm LP / Cam Link 4K | — | Corsair **Keystone public press kits** (`keystone.corsair.com/en/<product>/press-kit/`) | For eight of these the kit publishes the **listing's own `ASIN.Main` image**; Facecam 4K, Key Light Air MK.2 and Key Light Neo use the kit's device render of the exact model |
| Elgato Key Light Neo (no-mount listing) | B0FHQSVPVL | Keystone Neo kit, light-only front render | kit indexes the clamp SKU; render shows the light alone |
| Elgato Key Light | B07L755X9G | Keystone **Key Light MK.2** kit publishes `B07L755X9G.main` | the listing's own main image; see open point below |
| Logitech Brio Ultra 4K, Litra Glow | B09NBWWP79, B097QZGRCQ | Logitech galleries (retained 2026-10-04 captures) | Litra gallery URL now serves a placeholder GIF; provenance cites the capture record |
| Logitech MX Brio (Graphite) | B0BFJ4CRKD | logitech.com gallery | colourway matches listing |
| Blue Yeti (Blackout) | B00N1YPXW2 | logitechg.com gallery | colourway matches listing |
| Shure MV7+ (black) | B0CTJ7PVN1 | Shure product database main image (variant MV7+-K) | |
| Samson Q2U | B07FKG8PGZ | samsontech.com | |
| Sony α7S III body | B08DP4NKGN | Sony global image server (`sony.scene7.com … ILCE-7SM3`) | |
| EMEET SmartCam S600 | B0CYQ5P6T7 | emeet.com product page | hold lifted after review |
| Anker A8313 | B08CK9X9Z8 | anker.com | |
| DJI Osmo Pocket 3 (alternative) | B0CG19QXWD | dji.com | |
| Canon EOS R50 kit | B0BTTV6CT1 | existing CC BY-SA photo (unchanged; credit caption retained) | |

Originals in `sources/*-mfg.*` (force-added for custody), derivatives in `img/*-mfg.webp` (≤640 px, WebP), provenance + SHA-256 of original and derivative in `evidence/manufacturer-images-2026-10-06.json`, derivatives admitted in `production-assets.json` (default-deny list; the unreferenced CC Stream Deck + derivative was removed from the allowlist, file and ledger kept).

**Held — IMAGE_NOT_PRODUCTION_READY (§7A, removed from active cards, listed under "Why some familiar products are absent" in student wording):**
- Logitech C920x (B085TFF7M1): Logitech only publishes C920s imagery (a different SKU with a privacy shutter). Returns automatically when an Amazon-authorized image exists.
- NEEWER 700W softbox kit (B017D7W57S): no manufacturer page or image located.

**Legal note for you:** Keystone press kits are published `access_mode: public` for media/retail use, and the brand product pages are public, but neither Corsair nor the other brands print an explicit licence line on those pages. Your directive names manufacturer media as the second-choice authority; provenance is recorded per image. If you want belt-and-braces, a one-line permission email to Corsair/Elgato PR is the cheapest confirmation.

**Open product-data point (not imagery):** Corsair files B07L755X9G's main image under its *Key Light MK.2* kit, while the Amazon title still reads "Elgato Key Light, Professional 2800 Lumens". The image is the listing's own; if Amazon has rolled the ASIN to MK.2, the catalog name/copy should follow. Confirm on the listing.

## Option 5 image treatment (§8–§11)
Featured cards: 128×116 ivory image box, object-fit contain, no stretching; Also-in strips 52×44 thumbs; compare tray 48×40 thumbs; detailed comparison image vs image via the existing engine (attribution caption only on CC photos); Prime Day cards and Expert Reviews posters use the product images (posters now contain on an ivory box instead of cover-cropping). Glyphs remain only on the six no-purchase "plan" rows (not products).

## QA (§17)
`qa-images.py` → `evidence/image-audit-2026-10-06.json`: product / ASIN / image source / URL / status; fails on PLACEHOLDER, GLYPH, WRONG_MODEL (ledger ASIN mismatch, and Keystone `ASIN.Main` URLs must name the item's ASIN), BROKEN_IMAGE (missing / not allowlisted / hash mismatch), MISSING_CREDIT. **Result: 24 OK · 2 held · 1 archived (SM7B) · 6 plans · 0 failures.** `qa-production-assets.py` passes. Headless Chromium: zero errors; no glyph on any purchasable card, thumb, tray slot or comparison cell; all Amazon links tagged; no price/rating strings; kit save on a swapped product stores exactly its key.
Independent non-builder review of `062fe9d`+`138bf3a`: APPROVE WITH CONDITIONS; all five conditions closed in `9445445` (student-facing hold copy, Litra provenance, experts crop, EMEET record corrected and hydrated, dead asset). Recommended-not-blocking items done: counts, double period, audit hardening. Not done: swapping the Key Light Neo render to the alpha version (cosmetic; the current render is the light alone, which matches the no-mount listing).

## Screenshot acceptance (§18) — `founder-review/`, all from build c5604978
0 side-by-side vs authority · 1 desktop (webcam, mic, light) · 2 mobile · 3 alternative swapped (EMEET S600 as featured Business Class, exactly the directive's example) · 4 two products in tray · 5 detailed comparison image vs image · 6 Prime Day · 7 Expert Reviews.

## Transfer note
The device bridge re-encodes image files in transit, which would have broken hash custody; images were moved as base64 text and decoded on the Mac, then verified byte-for-byte against the ledger (`transfer/` holds the archives; safe to delete).

## Next, on your credentialed terminal
Push the branch (`bdff125 … 9445445`, fast-forward); registrar reconciliation + decision draft (`CURATION_20261006/REGISTRY_RECONCILIATION_DRAFT.md`, extend the admitted paths with `img/*-mfg.webp`, `sources/*-mfg.*`, `production-assets.json`, `phase1.js`, `evidence/*`, `qa-images.py`, `hydrate_manufacturer_images.py`); then the DR-375/376 release ladder from full ref `94454455b610515562ac8be1609830dff5f8c17c`. Nothing glyph-heavy is in line to ship.
