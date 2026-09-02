# PRODUCTION PREVIEW PARITY PROOF

**Claim:** `FOUNDER_PREVIEW_PARITY = PASS` — the preview is generated from the same implementation candidate that goes to Codex, not from a separate mockup.

**How to check it yourself:** every preview page loads `../config/campaign-state.json` and `../js/campaign-state.js` at runtime. Edit a price in that JSON, reload, and the preview changes. A mockup cannot do that. There is no second copy of any number anywhere.

---

## SECTION → SOURCE MAP

Every section of the Mission Residency preview, and the exact file that produces it.

| Section | Rendered by | Data from | Preview-only shim? |
|---|---|---|---|
| Campaign bar | `mm-visual.js` → `campaignBar()` | `campaign.*`, live state resolution | none |
| Cinematic hero | `pages/mission-residency.html` markup + `.v-hero` in `mm-visual.css` | Hero image = the **live** `mission-residency-run-mr006-q100.webp` | none |
| Hero proof faces | `mm-visual.js` → `TESTIMONIALS[].poster` | **Live** poster URLs on missionmedinstitute.com | none |
| Need router | `needRouter()` | `routing.needs` | none |
| Season journey | `journey()` | `journey.stages` + `journey.coverage` | none |
| Class photograph | markup + `ASSETS.classShot` | **Live** `Mission_Class_Screenshot-1-scaled.png` | none |
| Match Day video wall | `videoWall()` | **Live** posters + **live** `cdn.missionmedinstitute.com` mp4s | none |
| Program cards | `programCard()` | `products.*` + `mock_entitlement` | none |
| All prices | `MMCampaign.priceFor()` | `products.*.pricing` | none |
| Availability / closed states | `MMCampaign.visibility()` | `products.*.available`, `.sales_close`, `.render` | none |
| Essentials→Complete delta | page script | computed from the two live prices + `upgrades.essentials_to_complete` | none |
| Payment hierarchy | `paymentHierarchy()` | `payments.hierarchy`, `.missionmed_payment_plan`, `.affirm` | none |
| PS tiers | `programCard()` | `products.ps_intensive_*` | none |
| Dr. Brian portrait | markup + `ASSETS.drBrian` | **Live** `DrBrian_Profile_2.png` | none |
| 360 closed state | page script | `products.match_mentorship_360` incl. `banned_wording` | none |
| Technology section | `home-corporate` / config | `technology.systems[].status` | none |
| Comparison table | `pages/compare.html` | same config, same resolver | none |
| Checkout boundary | `pages/checkout-boundary.html` | same config | **YES — see below** |

---

## THE PREVIEW-ONLY SHIMS — declared in full

Three, and only three. All are removed at productionization.

### 1. The striped preview bar and state time-travel
`js/mm-boot.js` — `applyPreviewOverrides()`, `previewBar()`, and the `?state=` / `?at=` query parameters.

It exists so Dr. Brian can see the September 8 state today without anyone editing config. It **simulates** `verified_live_at` for states A/B/C; it never writes to config.

`?state=P` shows the **true** current state. The bar labels which it is: *"TRUE state today"* vs *"SIMULATED for review"*.

**Codex removes:** the `.v-previewbar` CSS block, `applyPreviewOverrides`, `previewBar`, and the `FORCE`/`STATE_DATES` constants. **Keeps:** the config load, `resolveState`, the render call, and the banned-term audit.

### 2. The staging checkout boundary
`pages/checkout-boundary.html` stands in for the live WooCommerce cart. Everything **before** it behaves as production will: real prices, real payment hierarchy, real deposit rules, real analytics events.

In production the CTA goes to the real add-to-cart URL and then `/checkout/`, using the existing Stripe Connect routing and cart-collision guard. **This ticket changes none of that wiring.**

### 3. Local relative paths
The preview loads `../config/…`, `../js/…`, `../css/…` over `http://127.0.0.1:8790`. In production these become enqueued WordPress assets. **Content and logic are unchanged** — only the paths.

---

## WHAT IS NOT A SHIM

Worth being explicit, because these are the parts that usually get faked in a mockup:

- **Prices are not hard-coded anywhere.** No page file contains a number. Verified by grep across `candidate/pages/`.
- **Media is not local placeholder art.** Every image and video is a live `missionmedinstitute.com` / `cdn.missionmedinstitute.com` URL, verified reachable (HTTP 200/206) on 2026-09-02.
- **Availability logic is real.** PS Priority closes itself on 2026-09-08 through the same `sales_close` field production will use.
- **The truth gate is real.** With `verified_live_at: null` the site cannot show Fall Access pricing. That is enforced in `campaign-state.js` GATE 1 and is the same code that ships.
- **The banned-term audit is real** and runs on every page load in production too.

---

## PARITY VERDICT

**PASS.** Codex productionizes `candidate/` exactly. The three shims above are the complete list of what is dropped, and none of them touches pricing, availability, copy, layout, or commercial logic.


---

# V3 ADDITIONS (MR-WEB-0902D)

| Surface | Rendered by | Data from | Preview-only shim? |
|---|---|---|---|
| Site header + nav | `mm-visual.js` → `siteHeader()` | `NAV` constant; logo is the **live** WordPress logo asset | none — reproduces the live header |
| Site footer | `siteFooter()` | static nav + live logo | none |
| FAQ | `faq()` | **`config.faq.items`** — the pricing answer is generated from live prices | none |
| Program pages (Complete / Essentials / 360 / PS) | `programPage()` + `PROGRAM_COPY` | `products.*`, `mock_entitlement`, `journey.coverage` | none |
| Payment page | `pages/payment.html` + `paymentHierarchy()` | `payments.*` | none |

**Shims are now four, not three.** Added to the list:

### 4. Preview URL aliases default to `?state=A`
`/`, `/complete`, `/essentials`, `/360`, `/ps`, `/compare`, `/payment` and `/home` append `?state=A` so the founder sees the Fall Access customer experience rather than the "enrollment closed" pre-launch state.

**The production truth gate is unchanged.** With `verified_live_at` null, production still cannot show Fall Access pricing — that rule lives in `campaign-state.js` GATE 1 and ships as-is. `/truth` shows the real state, and the toolbar reads "Preview · simulated".

**Codex removes:** the `ALIASES` map in `.preview/serve.py` (the whole file is preview-only).

### The QA hub is NOT part of the deployment payload
`candidate/review/index.html` is internal. It must not be deployed, linked from production, or productionized. The customer surfaces are `candidate/pages/*.html` only.
