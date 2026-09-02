# 05 — WOOCOMMERCE PRODUCT MAP

**Source:** live Store API (`/wp-json/wc/store/products?per_page=100`), captured 2026-09-02. **19 products.**
The Store API is **publicly readable without authentication** — worth noting as an information-exposure question, though it is WooCommerce's default.

**No production mutation has been performed.** Everything under "TARGET" is a Codex instruction.

---

## A. MISSION RESIDENCY — THE RENAME

The rename is **not** a find-and-replace. "IV Prep Complete" is currently the name of the **wrong product**. Execute in this order.

### Step 1 — free the name (do this FIRST)

| | Value |
|---|---|
| Product ID | **5504** |
| Current name | `IV Prep Complete Masterclass` |
| Current slug | `iv-prep-masterclass` |
| Current price | `$1,499` (regular = sale = 149900) |
| Type | variable — variations **5866**, **5867** (Start Date: session-c, session-d) |
| Category | Mission Residency |
| LearnDash | `/courses/iv-prep-masterclass/` |
| Live description | *"Focused, intensive interview preparation… 5-Day Foundation Workshop, 3 mock interviews, and a 1-on-1 strategy session. Built for speed when interviews are imminent."* |
| **TARGET name** | **`IV Prep Essentials`** |
| **TARGET price** | **$1,199** Fall Access · **$1,399** standard (one price, all rails) |
| Slug | Keep `iv-prep-masterclass` **or** move to `interview-prep-essentials` with a single 301. **No redirect chains.** |
| Why | The page already calls this product "IV Prep Essentials"; the live mu-plugin already carries the map `IV Prep Complete Masterclass → IV Prep Essentials`. "Complete" must not sit on a sub-$1,500 product. |

Also rename **5513** `IV Prep Complete Masterclass – 6 Month Payment Plan` → `IV Prep Essentials – Payment Plan`. Currently $249.83 × 6 = $1,499.

### Step 2 — apply the name

| | Value |
|---|---|
| Product ID | **3576** |
| Current name | `Match Prep Pro` |
| Current slug | `match-prep-pro` |
| Current price | **$2,799** — already the Fall Access target |
| Type | variable — variations **5864**, **5865** |
| LearnDash | `/courses/match-prep-pro/` |
| Live description | *"Full interview season support with 7 mock interviews, weekly checkups, post-IV debriefs, and advanced communication training."* |
| **TARGET name** | **`IV Prep Complete`** |
| **TARGET price** | **$2,799** Fall Access (no change) · **$3,299** card / **$3,199** bank from Sept 8 |
| **TARGET description** | Replace **"7 mock interviews"** → the configured label **"6 Mock Interviews Included"** |
| Slug | Keep `match-prep-pro` or move to `interview-prep-complete` with a single 301. Note `/product/iv-prep-complete/` **already 301s here** — do not create a second hop. |

Also rename **5512** `Match Prep Pro – 6 Month Payment Plan` ($466.50 × 6 = $2,799) to match, and reprice per §C.

### Step 3 — close 360

| | Value |
|---|---|
| Product IDs | **3575** (variable, variations 5862/5863) and **5511** (payment plan, $666.50 × 6) |
| Current price | **$3,999** — purchasable **right now** |
| **TARGET** | **`catalog_visibility` → hidden from purchase; set NOT purchasable.** Preserve the product record and all historical orders. |
| Public display | `$5,499` **reference tuition only**, `2026-27 Mentorship Capacity Reached`, `Enrollment Closed` |
| **Description fix (P0)** | Remove **"unlimited mock interviews"** and **"Match Guarantee"** from the short description. Both are banned/undefined. |
| Banned wording | Never `SOLD OUT`, never `OPENING SOON` |

### Step 4 — the legacy $499 tier

| | Value |
|---|---|
| Product ID | **3577** `Interview Prep Foundation`, simple, **$499**, purchasable |
| LearnDash | `_related_course` → course **3646** |
| Description | *"1-on-1 mock interview and evaluation with Dr. Brian, plus the full Interview Prep recording library. The entry point."* |
| **Status** | **FOUNDER DECISION REQUIRED.** This is the "legacy $499 checkout" flagged in the ticket. It is a genuinely different product (single mock + library), not Essentials. Options: (a) retire, (b) keep as a deliberate entry SKU, (c) fold into the hidden standalone-mock inventory (a $499 single mock sits oddly against the planned $299 single / $549 private). |
| Default if no decision | Leave untouched and unadvertised. It is not referenced by the candidate. |

---

## B. TEST SKUs — REMOVE FROM PUBLIC CATALOG

| ID | Name | Price | State |
|---|---|---|---|
| 6319 | Mission Residency – $1 Test | $1 | **publicly purchasable** |
| 6321 | ExamPrep – $1 Test | $1 | **publicly purchasable** |
| 6323 | Mission Clinicals – $1 Test | $1 | **publicly purchasable** |

**TARGET:** set catalog visibility to hidden. **Keep them purchasable by direct URL** — they are exactly how the required end-to-end test transaction (P0-3) gets run without charging a real tuition.

---

## C. PRICE TABLE — OLD → NEW

| Product | ID | Live today | Fall Access (Sept 2–7) | Standard (Sept 8+) |
|---|---|---|---|---|
| IV Prep Complete (was Match Prep Pro) | 3576 | $2,799 | **$2,799** all rails | **$3,299** card · **$3,199** bank |
| — payment plan | 5512 | $466.50 × 6 | see R-01 below | see R-01 below |
| IV Prep Essentials (was IV Prep Complete Masterclass) | 5504 | $1,499 | **$1,199** all rails | **$1,399** all rails |
| — payment plan | 5513 | $249.83 × 6 | not offered | not offered |
| 360 Match Mentorship | 3575 | $3,999 **buyable** | **$5,499 display only, closed** | same |
| — payment plan | 5511 | $666.50 × 6 | **closed** | closed |
| Interview Prep Foundation | 3577 | $499 | founder decision | founder decision |

**R-01 — payment plan totals are deliberately unset.** The founder requires the plan total to exceed PIF (ticket §14). Publishing a specific premium is a finance charge under Reg Z 12 CFR 1026.4. `premium_amount` in `campaign-state.json` is `null`; the plan routes to Admissions until Codex resolves the compliant mechanism. **Do not substitute a 0% same-total plan without written founder approval** — note the *existing* products are exactly that, so leaving them as-is is itself the thing §14 forbids advertising.

---

## D. PRODUCTS NOT TOUCHED BY THIS TICKET

3520 Essential Membership $49 · 3522 Arena Advanced $299 · 3525 Arena Pro $499 · 5734 Arena Core $99 *(catalog-visible, not purchasable — fix or hide)* · 4241 Basic Membership $0 *(same)* · 3651 Team Drilling $300 · 3652 1-on-1 Tutoring $75 · 3784 US Clinical Rotations $650–900 *(not linked from /usce/)* · 6360 Dr J Drills On-Call $24.99.

---

## E. HIDDEN FUTURE INVENTORY — DO NOT CREATE YET

Architected in `campaign-state.json` under `hidden_inventory`, `visible: false`, earliest publish **2026-10-06**, requires founder authorization.

Standalone mocks: 1 = $299 · 3 = $799 · private 45-min 1:1 = $549 · **no 5-pack** · expire 2027-02-28 · cap 3/person.
Late-cycle: Recorded Edition $749 (gated) · Interview Rescue $1,199 (cap 6) · Catch-Up $1,999 (cap 4) · Strategy Session $749 · Case Review $249 · Half-Day $1,799 (cap 7, gated). Dead public name: "Emergency Interview Intervention".
