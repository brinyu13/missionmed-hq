# 04 — IMPLEMENTATION CHANGELOG

**Branch:** `claude/mr-web-0902-fall-conversion-upgrade`
**Worktree:** `/Users/brianb/MissionMed_worktrees/mr-web-0902-fall-commercial-rebuild`
**Production changes: NONE.** No WordPress page, WooCommerce product, price, plugin, or setting was modified.

---

## Files created

All under `_AI_HANDOFFS/from_claude_code/MR-WEB-0902-FALL-COMMERCIAL-REBUILD-001/`.

### Candidate (the thing Codex productionizes)

| File | Purpose |
|---|---|
| `candidate/config/campaign-state.json` | **Single source of truth.** Every price, name, date, availability state, claim status, analytics event. Carries founder-canon rationale inline. |
| `candidate/js/campaign-state.js` | State resolver. Two gates (truth gate, no-flip floor), price/visibility resolution, banned-term auditor. |
| `candidate/js/mm-render.js` | Component renderer — campaign bar, price blocks, program cards, payment hierarchy, journey, need-router. Emits the analytics contract. |
| `candidate/js/mm-boot.js` | Config loader + preview state time-travel. **Preview chrome is dropped at productionization.** |
| `candidate/css/mm-commercial.css` | Styling built on tokens lifted verbatim from live page 5686. |
| `candidate/pages/index.html` | Founder preview hub. |
| `candidate/pages/mission-residency.html` | Rebuilt commercial hierarchy. |
| `candidate/pages/compare.html` | Comparison, desktop table → mobile cards. |
| `candidate/pages/checkout-boundary.html` | Labeled staging boundary. |
| `candidate/pages/home-commercial.html` | The 4 blocks to insert into homepage 3305. |
| `candidate/.preview/serve.py` | Local static server on :8790. |

### Documentation

`01_CURRENT_COMMERCIAL_SYSTEM_MAP.md` · `02_RISK_AND_CONFLICT_LEDGER.md` · `03_TARGET_COMMERCIAL_ARCHITECTURE.md` · `04` (this) · `05_WOOCOMMERCE_PRODUCT_MAP.md` · `06_PAYMENT_AND_ENTITLEMENT_MAP.md` · `07_CAMPAIGN_STATE_MAP.md` · `08_CLAIMS_CLEANUP_LEDGER.md` · `09_DESKTOP_MOBILE_QA.md` · `10_FOUNDER_REVIEW_GUIDE.md` · `CODEX_PRODUCTION_HANDOFF.md`

### Evidence

`evidence/live_home_20260902_cfcache.html` · `evidence/css/*` (incl. `page6249_premium.css`, `mr_page5686_inline.css`) · `screenshots/*.png` (9)

---

## Defects found and fixed during build

| # | Defect | Fix |
|---|---|---|
| 1 | Primary CTA rendered light-on-gold. `.mmc a { color: inherit }` (0,1,1) beat `.mmc-btn--primary` (0,1,0) | Qualified the variant selectors; comment left so it is not undone |
| 2 | 360 card showed no reference tuition — `priceFor()` returns null for a display-only product, so `priceBlock()` bailed before the reference branch | Moved the `VISIBLE_BUT_CLOSED` branch above the null bail-out |
| 3 | 360 card had an empty gap where features belong, undercutting it as premium anchor | Added truthful feature list containing no banned claims |
| 4 | Comparison `<caption>` collapsed to a ~50px sliver on mobile (`display:block` on the table makes it an anonymous shrink-wrapped block) | Pinned to `display:block; width:100%` in the mobile query |
| 5 | The banned-term auditor reported `clean: false` on `index.html` — the founder-review notes quoted `"unlimited mock interviews"` verbatim while describing the live 360 defect | Rephrased the note to describe the claim instead of reproducing it. The guard was **not** exempted or weakened — a check that false-alarms on its own commentary is one people learn to ignore |

## Non-defects investigated and dismissed

- **Apparent horizontal clipping in mobile PNGs** — measured in-browser at 375px: `scrollWidth === clientWidth === 375`, zero overflowing elements. A headless-capture artifact, not a layout bug. No change made.
- **Apparent contrast failures** — first pass reported ratios near 1.0. The measurement was wrong: it treated `rgba(255,255,255,0.035)` and gradient backgrounds as opaque white. Re-measured with proper alpha compositing: **55 elements, zero failures.** No change made.
- **Homepage section CSS appearing scoped to `page-id-6249`** — verified the homepage's own section rules are unscoped and apply correctly. 6249 is a separate dark/gold premium page. No live bug.


---

# V2 — VISUAL CORRECTION (MR-WEB-0902B / 0902C)

V1's audit, commerce, entitlement, campaign-state and claims work is **unchanged and preserved**. `campaign-state.json` and `campaign-state.js` were not touched — the data layer is identical. What changed is the visual system and the surface split.

## Added
| File | Purpose |
|---|---|
| `candidate/css/mm-visual.css` | V2 visual system — alternating environments, display type scale, media treatments, motion |
| `candidate/js/mm-visual.js` | V2 renderer — inline SVG icons, Match Day video wall, scroll reveals, parallax |
| `candidate/pages/home-corporate.html` | Corporate homepage **seasonal layer** (Surface A) |
| `VISUAL_ASSET_INVENTORY.md` · `VISUAL_DIRECTION_V2.md` · `CRO_STUDENT_JOURNEY_V2.md` · `PRODUCTION_PREVIEW_PARITY_PROOF.md` · `CURRENT_VS_CANDIDATE_VISUAL_REVIEW.md` · `CORPORATE_VS_MISSION_RESIDENCY_SURFACE_MAP.md` | Correction deliverables |

## Rebuilt
`pages/mission-residency.html` (ten sections, real media), `pages/index.html`, `pages/compare.html`, `pages/checkout-boundary.html`.

## Removed
`pages/home-commercial.html` — it treated the corporate homepage as a Mission Residency selling surface, which the 0902C clarification explicitly forbids. Replaced by `home-corporate.html`.

`css/mm-commercial.css` and `js/mm-render.js` remain in the tree as the V1 reference but are **no longer loaded by any page**.

## Corrections made to my own earlier documentation
| What I had written | What is actually true |
|---|---|
| "The Mission Residency page is illustrated almost entirely with generic stock and one AI-generated image" | **Wrong.** Three pexels files and the Gemini image are scoped to `body.page-id-3503`, a different page. Only `pexels-photo-4225920.jpeg` renders on 5686. Its hero is a strong branded asset — the embroidered *MATCHED / ACCOMPLISHED* patch |
| "`elementor_canvas` — no theme header/footer" | The body class says canvas, but the **rendered** page shows the site header and nav. Verified from a live 1440×900 render |
| 89.1% located in "the homepage stat band" | It is also in the **sitewide top bar**, as an animated counter on 5686, and in the 5686 footer |
| — | **New:** the top bar says *"TRAINED SINCE 2009"* while the 5686 footer says *"IMGs since 2015"* — a six-year contradiction, both live on one page |

## Defects found and fixed in the V2 pass
See `09_DESKTOP_MOBILE_QA.md` items 6–12. The three that mattered: headings invisible on light sections, the 360 card's CTA rendering white-on-white at 1.04:1, and a mobile horizontal overflow (`scrollWidth` 408 vs 375) caused by a bare `minmax(380px, 1fr)`.


---

# V3 — PREVIEW RECOVERY (MR-WEB-0902D)

The founder's complaint was routing, not the candidate: the URL supplied opened the internal QA hub. Inspecting the actual customer page first (as instructed) showed it was **partially, not wholly, failed** — the hero, video wall and environments were strong; the missing chrome, thin-outline cards and absent FAQ were not. So the strong parts were kept and the weak parts rebuilt.

## Routing
- `.preview/serve.py` rewritten with a redirect table. **`/` now opens the Mission Residency customer page.**
- QA hub moved `pages/index.html` → **`review/index.html`**, and is excluded from the deployment payload.
- Short URLs for all ten surfaces (`/complete`, `/ps`, `/payment`, `/sept8`, `/truth`, …) — see `PREVIEW_MAP.md`.

## Added
| File | Purpose |
|---|---|
| `pages/program-complete.html` · `-essentials` · `-360` · `-ps` | The four program surfaces, from one config-driven renderer |
| `pages/payment.html` | Standalone ways-to-pay surface |
| `PREVIEW_MAP.md` | Direct URLs, customer-first |
| `siteHeader()` / `siteFooter()` / `mountChrome()` | Real site chrome — the missing header was the main reason the candidate read as a demo |
| `faq()` + `config.faq` | The live FAQ, ported and canon-corrected |
| `programPage()` + `PROGRAM_COPY` | Program page renderer |

## FAQ port
Seven live questions audited. Three carried over close to intact; four could not be published as written — stale pricing with an expired July deadline, the unsupported 191 / 24-year / 102-testimonial red-flag stats, MatchFirst™ deferred payment, and the conflicting "Forever guarantee". Two new questions added ("do I need a program to work on my statement", "what happens after I enrol"). **MatchFirst and the guarantee are recorded in `config.faq.withheld_pending_founder_decision` — withheld, not deleted.**

## Six defects fixed
See `09_DESKTOP_MOBILE_QA.md` items 13–18. The two that mattered most: no site chrome anywhere, and the payment block rendering gold-on-cream at ~1.3:1 on the program pages.

## Known gap, not fixed — needs a founder decision
**During Fall Access Week, bank transfer and card are both $2,799** — there is no Zelle advantage, because the Fall Access price is single-rail in config. Founder canon says Zelle should be economically advantaged. In standard mode the spread does exist ($3,199 vs $3,299). I have not invented a Fall Access spread; the UI states an honest non-price benefit that week instead. **A founder ruling sets the Fall Access bank price.**
