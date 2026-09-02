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
