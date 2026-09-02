# 01 — CURRENT COMMERCIAL SYSTEM MAP

**Ticket:** MR-WEB-0902-FALL-COMMERCIAL-REBUILD-001
**Captured:** 2026-09-02, 08:07–08:25 ET, from live production (`missionmedinstitute.com`)
**Method:** direct HTTP capture of rendered pages + WooCommerce Store API + sitemaps, corroborated against on-disk backups of live mu-plugins and WPCode snippets.
**Nothing in production was modified.**

---

## 0. THE STACK (verified, not assumed)

| Layer | Actual |
|---|---|
| Host / CDN | Kinsta origin behind Cloudflare (`x-kinsta-cache`, `cf-cache-status`, `s-maxage=86400`) |
| Theme | **Astra 4.12.6** |
| Builder | **Elementor + Elementor Pro**, global kit `elementor-kit-3372` |
| Commerce | **WooCommerce** + **WooCommerce Subscriptions** + **WooCommerce Memberships** |
| LMS / entitlement | **LearnDash (`sfwd-lms`)** + `learndash-propanel` + `learndash-achievements` |
| Card gateways | **`woocommerce-gateway-stripe`** *and* **`woocommerce-payments`** (both installed) |
| Stripe routing | **Stripe Connect direct charges**, one connected account per PaymentIntent, keyed on `_mmi_instructor_id` product meta (`mmi-mixed-cart-guard.php`) |
| Zelle | **No plugin.** Manual/offline workflow + a WPCode snippet applying a card fee that Zelle waives (see §4) |
| Affirm / BNPL | **Not installed.** No Affirm, Klarna, or Afterpay anywhere |
| Analytics | **Google Site Kit** (GA4). No `gtag`/`dataLayer` calls found in the Mission Residency page body |
| Forms | Formidable |
| Scheduling | Simply Schedule Appointments |
| Other | The Events Calendar, Autoptimize, EWWW |

**Elementor global palette (kit 3372)** — the brand, verbatim:
`--e-global-color-primary:#0f2a44` · `--e-global-color-secondary:#1b2f4a` · `--e-global-color-accent:#b23a3a`

---

## 1. PAGE / SURFACE MAP

| Surface | URL | Page ID | Template | Commercial role | State found |
|---|---|---|---|---|---|
| Homepage | `/` | **3305** | `elementor_header_footer` | Proof + emotion | **Sells nothing.** No program, no price, no enrollment CTA anywhere |
| Mission Residency | `/mission-residency/` | **5686** | `elementor_canvas` | Primary commercial page | Live, sells all 3 tiers, **heavily stale** |
| MR courses | `/mission-residency-courses/` | — | — | Secondary | Stale July banner + corrupted CTA labels |
| MR waitlist | `/mission-residency-waitlist/` | — | — | Lead capture | Live, Formidable, shows `$1,000` |
| 360 detail | `/360-match-mentorship/` | — | — | Product detail | Live |
| Compare programs | `/compare-programs/` | — | — | Comparison | Prices conflict with `/course-comparison/`; all CTAs dump to `/contact/` |
| Course comparison | `/course-comparison/` | — | — | Comparison | **Different prices for the same three tiers** |
| Pricing | `/pricing/` | — | — | — | **Unreplaced demo content: $5 / $50 / $150** |
| ExamPrep | `/examprep/` | 5674 | — | Division | No prices, no commerce URLs |
| USCE | `/usce/` | — | — | Division | No prices; does **not** link its own live `$650` product |
| Shop | `/shop/` | — | Woo | Catalog | 15 products over 2 pages |
| Cart / Checkout | `/cart/`, `/checkout/` | — | Woo | Commerce | Functional; `/checkout/` → `/cart/` when empty (normal) |
| Premium dark page | — | **6249** | — | Unknown | Bespoke dark/gold page; 172 CSS rules injected **sitewide** |

**Homepage sections (page 3305), by CSS namespace:** `mm-id-*` (hero) · `ity-*` (This Is For You) · `hpv-*` (video testimonials) · `mm-ledger-*` (unmatched-cost calculator) · `f2-*` (PD survey factors, Gate 1/Gate 2) · `mm-mentor-*` (mentors) · `hpt-*` (alumni stat band) · `mm-footer-*`.

**Mission Residency (page 5686)** has its own sticky nav (`.mr1503d-nav`) with anchors `#programs #pdf #cost #brian #faq` and a "Read Reviews" CTA — **no enrollment CTA in the nav.**

---

## 2. WOOCOMMERCE PRODUCT MAP (live, Store API, 19 products)

### Mission Residency (`product_cat: mission-residency`)

| ID | Live name | Type | Live price | Purchasable | LearnDash course | Target under this ticket |
|---|---|---|---|---|---|---|
| **3575** | 360 Match Mentorship | variable | **$3,999** | **YES** | `/courses/mission-residency-360-match-mentorship/` | **CLOSE.** Display-only at $5,499 reference |
| **3576** | Match Prep Pro | variable | **$2,799** | YES | `/courses/match-prep-pro/` | **→ IV Prep Complete.** $2,799 week / $3,299 card standard |
| **5504** | IV Prep Complete Masterclass | variable | **$1,499** | YES | `/courses/iv-prep-masterclass/` | **→ IV Prep Essentials.** $1,199 week / $1,399 standard |
| **3577** | Interview Prep Foundation | simple | **$499** | YES | course **3646** (`_related_course`) | **The legacy $499 checkout.** Decide: retire or reposition |
| 5511 | 360 — 6 Month Payment Plan | var-sub | $666.50 ×6 = $3,999 | YES | — | **CLOSE with 3575** |
| 5512 | Match Prep Pro — 6 Month Plan | var-sub | $466.50 ×6 = $2,799 | YES | — | Rename + reprice with 3576 |
| 5513 | IV Prep Masterclass — 6 Month Plan | var-sub | $249.83 ×6 = $1,499 | YES | — | Rename + reprice with 5504 |

Variations on 3575/3576/5504 are **Start Date** only (`session-a`…`session-d`), IDs 5862–5873.

### Everything else

| ID | Name | Type | Price | Purchasable | Note |
|---|---|---|---|---|---|
| 3520 | Essential Membership | sub | $49 | YES | |
| 3522 | Arena Advanced (`prime-membership`) | sub | $299 | YES | |
| 3525 | Arena Pro (`elite-membership`) | sub | $499 | YES | |
| 5734 | Arena Core (`arena-membership`) | sub | $99 | **NO** | Catalog-visible but unbuyable |
| 4241 | Basic Membership | simple | $0 | **NO** | Catalog-visible but unbuyable |
| 3651 | Team Drilling Sessions | var-sub | $300 | YES | |
| 3652 | 1-on-1 Tutoring: Master Level | simple | $75 | YES | |
| 3784 | US Clinical Rotations | variable | $650–$900 | YES | Not linked from `/usce/` |
| 6360 | Dr J, Drills On-Call | sub | $24.99 | YES | |
| **6319** | **Mission Residency – $1 Test** | simple | **$1** | **YES** | **Test SKU public** |
| **6321** | **ExamPrep – $1 Test** | simple | **$1** | **YES** | **Test SKU public** |
| **6323** | **Mission Clinicals – $1 Test** | simple | **$1** | **YES** | **Test SKU public** |

**Add-to-cart pattern:** `/shop/?add-to-cart=<id>`. Variable products route to the product page.

**Legacy slugs still hardcoded in CTAs sitewide** (all 301 correctly, so nothing is broken, but the buttons are mislabelled relative to their destinations):
`/product/iv-prep-complete/` → 3576 (Match Prep Pro) · `/product/interview-emergency-prep/` → 5504 (IV Prep Masterclass), plus their `-payment-plan` variants.

---

## 3. WHAT THE MISSION RESIDENCY PAGE SAYS TODAY (verbatim, live)

Three cards under *"Pick the version of Mission Residency that fits your situation."* — framed *"Named like airline class so the difference is obvious."*

| | IV Prep Essentials | Match Prep Pro | 360 Match Mentorship |
|---|---|---|---|
| Class | Business Class · Emergency | First Class · Full Season | Private Jet · Full Match Year |
| Shown price | ~~$1,699~~ **$1,499** "Save $200" | ~~$3,749~~ **$2,799** "Save $950" | ~~$5,499~~ **$3,999** "Save $1,500" |
| Deadline copy | *"Price increases July 1."* | *"Price increases July 1."* | *"Price increases July 1."* |
| Mocks | 3 mock interviews | **7 mock interviews** | **Unlimited mock interviews** |
| Guarantee | *"No Match Guarantee"* | *"Match Guarantee (with attendance terms)"* | *"'Forever' Match Guarantee"* |

Also live on that page:
- *"Pay full, or use **MatchFirst™** deferred payment (deposit now, pay the rest only after you match)."*
- *"**MatchFirst™** (50% down, 50% after Match)"*
- *"Pay via **Zelle** for fastest enrollment. Payment plans and MatchFirst™ also available."*
- *"Currently training the 2026–2027 Match cohort · Limited spots"*
- A cart-collision modal: *"You currently have another MissionMed training in your cart… enrollments must be completed one program at a time."* **(Good UX — preserve.)**

The struck-through numbers ($1,699 / $3,749 / $5,499) are rendered by the live mu-plugin `missionmed-launch-sev1-fixes.php`, which contains these exact price-presentation blocks.

---

## 4. PAYMENT PATH (as actually implemented)

```
product page → add-to-cart → /cart/ → /checkout/
    → mmi-mixed-cart-guard.php enforces ONE connected account per PaymentIntent
    → Stripe Connect direct charge, routed by _mmi_instructor_id on the product
    → order → LearnDash enrollment via _related_course → Memberships role
```

**Zelle, as it actually works today:** WPCode snippet **#71** (`AHP-019`) adds a **2.9% card fee at checkout which is waived for Zelle**. A separate `$300 off any course` Zelle discount is documented in `MISSIONMED_MASTER_KNOWLEDGE.md`. So the founder's "Zelle must be economically advantaged" requirement **is already implemented** — but as a *percentage fee*, which is precisely the mechanism the board ruling says must never be used (never a %, never called a "fee"). See `02_RISK_AND_CONFLICT_LEDGER.md` R-07.

**Payment plans, as they actually work today:** real WooCommerce Subscriptions products at **0% — the plan total equals the PIF total exactly** ($466.50 × 6 = $2,799). The founder's ~6-month term already exists. Only the *higher total* does not. That makes this a pure compliance decision, not an engineering one.

**Affirm:** absent. Correctly not advertised anywhere.

---

## 5. ENTITLEMENT PATH

| Product | → LearnDash course | Proven? |
|---|---|---|
| 3575 360 | `/courses/mission-residency-360-match-mentorship/` | Link exists; **end-to-end purchase NOT tested** |
| 3576 Match Prep Pro | `/courses/match-prep-pro/` | Link exists; **NOT tested** |
| 5504 IV Prep Masterclass | `/courses/iv-prep-masterclass/` | Link exists; **NOT tested** |
| 3577 Interview Prep Foundation | course **3646** via `_related_course` | Link exists; **NOT tested** |

**This is the launch gate.** No test purchase was performed by this ticket (correctly — no production mutation is authorized). Until one clears end-to-end, `verified_live_at` stays null and the candidate refuses to show Fall Access pricing. See `06_PAYMENT_AND_ENTITLEMENT_MAP.md`.

---

## 6. STALE / CONFLICTING CONTENT FOUND (summary — full ledger in 08)

| Where | What | Severity |
|---|---|---|
| `/mission-residency/` ×3 | *"Price increases July 1"* + "Early Enrollment" | **P1** — 2 months expired |
| `/mission-residency/` ×3 | Strikethrough against never-charged reference prices | **P1** — 16 CFR 233.1 |
| `/mission-residency/`, product 3575 | *"Unlimited mock interviews"* | **P0** — banned claim, live |
| `/mission-residency/`, product 3575 | *"Match Guarantee"* / *"Forever Match Guarantee"* / *"No Match Guarantee"* | **P0** — undefined + self-contradictory |
| Woo 3575 | 360 **purchasable at $3,999** while canon says 2026-27 closed | **P0** |
| Homepage 3305 | `89.1% Match Rate`, `191 Lowest Step 1`, `24 yrs Longest Gap` | **P1** — unsupported |
| `/pricing/` | `$5 / $50 / $150` demo content | **P1** |
| `/course-comparison/` vs `/compare-programs/` | Same tiers, different prices | **P1** |
| `/mission-residency-courses/` | *"Book a Read What Alumni Said →"* — clobbered CTA labels/hrefs | **P2** |
| Shop | Three `$1 Test` SKUs publicly purchasable | **P2** |
| Woo 5734, 4241 | Catalog-visible but unbuyable | **P2** |
| Sitewide | Naming drift: Woo "IV Prep Complete Masterclass" vs page "IV Prep Essentials" | **P1** |

---

## 7. PROPOSED ACTION PER SURFACE

| Surface | Action |
|---|---|
| Homepage 3305 | **PRESERVE** all existing sections. **INSERT** 4 commercial blocks (see `03`). Quarantine the 3 unsupported stats. |
| Mission Residency 5686 | **MODIFY** in place: rename, reprice, remove July/early-enrollment/strikethrough, close 360, replace mock claims, quarantine guarantee + MatchFirst language pending definition. |
| Woo 3576 | Rename → IV Prep Complete. Keep $2,799 for the week; $3,299 card / $3,199 bank from Sept 8. |
| Woo 5504 | Rename → IV Prep Essentials. $1,199 week / $1,399 standard. |
| Woo 3575 + 5511 | Set not-purchasable. Keep page presence at $5,499 reference. |
| Woo 3577 | Founder decision: retire the $499 tier or reposition it. |
| Woo 6319/6321/6323 | Hide from catalog; restrict to a private/known URL. |
| `/pricing/` | Redirect to `/mission-residency/` or replace. It contradicts every real price. |
| `/course-comparison/` | Consolidate into one comparison surface fed by `campaign-state.json`. |
