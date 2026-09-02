# 02 — RISK AND CONFLICT LEDGER

**Ticket:** MR-WEB-0902-FALL-COMMERCIAL-REBUILD-001 · **Date:** 2026-09-02
**Authority order used:** (1) this ticket + founder overrides · (2) MR-REV-0901 board ruling · (3) actual production implementation.

Severity: **P0** = blocks Fall Access launch · **P1** = must fix before advertising · **P2** = fix in this pass · **INFO** = decision record.

---

## P0 — BLOCKING

### P0-1 · 360 Match Mentorship is purchasable right now at $3,999
**Found:** Woo product **3575** `is_purchasable: true`, `$3,999`; plus **5511** (6-month plan, $666.50 × 6) also purchasable. The live page markets it with *"Limited spots."*
**Conflict:** Ticket §8 requires 2026-27 360 to be **enrollment closed**, display-only, at a **$5,499** reference. Two separate defects: it is *sellable* when it must be closed, and its price is *$3,999* not $5,499.
**Risk:** A student can buy a 2026-27 seat today that the founder has stated does not exist. That is a refund, a capacity breach, and a substantiation problem in one transaction.
**Action:** Set 3575 **and** 5511 not-purchasable before any campaign traffic. Keep the page card visible at $5,499 reference (the candidate already renders exactly this).
**Owner:** Codex, pre-launch.

### P0-2 · Banned and self-contradictory claims are live on the money page
**Found, verbatim on `/mission-residency/` and in Woo 3575's short description:**
- *"Unlimited mock interviews"* — explicitly banned (§18, §26), and contradicted by the real calendar.
- *"Match Guarantee (with attendance terms)"* / *"'Forever' Match Guarantee"* / *"No Match Guarantee"* — three different guarantee states on one screen, none defined anywhere.
**Risk:** "Unlimited" and an undefined guarantee are the two most legally exposed strings on the site, and they sit on the page that takes money.
**Action:** Remove "unlimited" everywhere (product copy included). Quarantine all guarantee language until a written definition exists; do not restate it in the candidate.
**Owner:** Codex + founder (guarantee definition).

### P0-3 · Checkout → entitlement is unproven end to end
**Found:** `_related_course` links exist for 3575/3576/5504/3577 (3577 → course 3646). **No test purchase was run** — correctly, since no production mutation is authorized here.
**Risk:** Advertising enrollment before proving payment → order → correct course → correct membership → confirmation is how you sell something you cannot deliver.
**Action:** One end-to-end test purchase per open product. Until it clears, `campaign.go_live_gate.verified_live_at` stays `null` and the candidate refuses to display Fall Access pricing. **This is enforced in code, not by memory** (`campaign-state.js`, GATE 1).
**Owner:** Codex, before go-live.

### P0-4 · MatchFirst™ deferred payment is live and undefined
**Found:** `/mission-residency/` markets *"MatchFirst™ deferred payment (deposit now, pay the rest only after you match)"* and *"50% down, 50% after Match."* It appears on 20 captured pages.
**Conflict:** §26 lists "conflicting Match Guarantee / MatchFirst language" for quarantine. Nothing in the founder canon or the board ruling defines MatchFirst's current terms.
**Risk:** Payment deferred until an uncertain future event, with 50% outstanding, is a credit product in substance. It is live, prominent, and unspecified in this ticket.
**Action:** **Founder decision required.** Either (a) define and keep it with written terms, or (b) suppress it for Fall Access Week. The candidate does **not** render MatchFirst — it is neither removed from production nor reproduced here, pending that decision.
**Owner:** Founder.

---

## P1 — MUST FIX BEFORE ADVERTISING

### P1-1 · Expired July campaign, live for ~2 months
*"Price increases July 1"* and *"Early Enrollment"* appear three times on `/mission-residency/` and again on `/mission-residency-courses/`. Rendered by mu-plugin `missionmed-launch-sev1-fixes.php`.
**Action:** Remove. The campaign-state engine in the candidate is the structural fix so this cannot recur.

### P1-2 · Strikethrough pricing against never-charged reference prices
Live: ~~$1,699~~ $1,499 "Save $200" · ~~$3,749~~ $2,799 "Save $950" · ~~$5,499~~ $3,999 "Save $1,500".
**Conflict:** §10 forbids advertising against an unestablished reference price; the board cites 16 CFR 233.1 (fictitious former price).
**Action:** Replace with the factual two-number frame: *"$2,799 through September 7. Standard tuition $3,299 from September 8."* The candidate's stylesheet has **no strikethrough class at all**, so the pattern cannot be reintroduced by copy-paste.

### P1-3 · Unsupported statistics on the homepage
Live in the `hpt-stats` band: **89.1% Match Rate**, **191 Lowest Step 1 Matched**, **24 yrs Longest Grad Gap**.
**Conflict:** Approved ground truth is a **qualified 86–93%** match rate with its denominator stated; 191 / 24-yr / 142 are not supported.
**Action:** Replace 89.1% with the qualified range + denominator. Remove 191 and 24-yr. **Do not invent replacements.** `3,000+ IMGs Trained` and `17+ years` are retained pending substantiation confirmation.

### P1-4 · Naming collision — "IV Prep Complete" currently means the wrong product
Woo **5504** is literally named *"IV Prep Complete Masterclass"* at **$1,499**, while the page calls that same product *"IV Prep Essentials."* Meanwhile **3576** ("Match Prep Pro", $2,799) is the product that must **become** IV Prep Complete.
**Risk:** A naive rename produces two products called IV Prep Complete, and leaves "Complete" on a sub-$1,500 product.
**Resolved mapping (evidence-backed, from live product descriptions):**
- 3576 — *"Full interview season support… 7 mock interviews, weekly checkups, post-IV debriefs"* → **IV Prep Complete**
- 5504 — *"5-Day Foundation Workshop, 3 mock interviews… built for speed"* → **IV Prep Essentials**
- 3577 — *"1-on-1 mock + recording library. The entry point"* ($499) → **the legacy $499 tier, not Essentials**
**Action:** Rename **5504 first**, then 3576. Order matters.

### P1-5 · Mock counts contradict the approved benefit
Live: Essentials *"3 mock interviews"*, Match Prep Pro *"7 mock interviews"*, 360 *"unlimited"*. Canon: **6** ("6 Mock Interviews Included").
**Action:** Publish only the configured label. The candidate reads `mock_entitlement.public_label` from config, and `publish_exact_entitlement: false` suppresses per-month detail until the 20 published dates are validated against real capacity.

### P1-6 · `/pricing/` shows $5 / $50 / $150
Unreplaced demo-theme content that contradicts every real price on the site.
**Action:** Redirect to `/mission-residency/` or replace. Low effort, high embarrassment.

### P1-7 · Two comparison pages disagree with each other
`/course-comparison/` shows $5,199 / $3,449 / $1,199; `/compare-programs/` shows $5,499 / $3,749 / $1,499 for what appear to be the same tiers. `/compare-programs/` CTAs all dump to `/contact/`.
**Action:** Consolidate to one comparison surface driven by `campaign-state.json`.

---

## P2

| ID | Issue | Action |
|---|---|---|
| P2-1 | `$1 Test` SKUs **6319 / 6321 / 6323** publicly purchasable in `/shop/` | Hide from catalog; keep reachable by direct URL for testing |
| P2-2 | Woo **5734** ($99) and **4241** ($0) catalog-visible but not purchasable | Hide or fix |
| P2-3 | `/mission-residency-courses/`: *"Book a Read What Alumni Said →"*, *"Ask About Zelle Pricing →"* both point at `/what-alumni-said/` — clobbered by a bad find-and-replace | Restore labels + hrefs |
| P2-4 | Legacy slugs hardcoded in CTAs sitewide (`iv-prep-complete`, `interview-emergency-prep`) | All 301 correctly. Update labels so buttons match destinations; **do not create redirect chains** |
| P2-5 | `/usce/` never links its own live `$650` product (3784) | Founder call |
| P2-6 | Mission Residency sticky nav has no enrollment CTA | Added in candidate |

---

## FOUNDER-CANON vs BOARD-RULING CONFLICTS (resolved here)

### R-01 · Payment plan must cost more than PIF — **founder canon upheld, publication deferred**
- **Ticket §14 (authority 1):** internal plan total **must exceed** PIF. Never silently replace with a same-price 0% plan.
- **Board (authority 2):** a premium is a finance charge under **Reg Z 12 CFR 1026.4** whatever it is called; >4 payments can confer creditor status in states with no volume threshold. Board proposes 0%, 3 payments.
- **Ticket §14 also says:** do not invent or publish an APR or a potentially noncompliant finance charge; if it cannot be safely automated today, **build the higher-total UI architecture, route through manual Admissions, and flag it for Codex.**
- **Resolution:** The founder requirement stands and is recorded as authoritative in config (`total_is_higher_than_pif: true`). No premium number, no APR, and **no "0%" claim** is published. `premium_amount` is `null` and renders the moment it is set. The offer routes to Admissions. This is the only reading that satisfies §14's own two constraints simultaneously.
- **Note the implementation is already 90% there:** WooCommerce Subscriptions plan products exist today at 0% ($466.50 × 6 = $2,799). Changing the total is a config change. **The blocker is purely compliance, not engineering.**

### R-02 · Zelle advantage — **no real conflict**
§10 permits a lower bank/Zelle PIF "if the final commerce implementation supports it cleanly and compliantly." Candidate: **one price all rails during the week** ($2,799 — which *is* the founder's stated Zelle PIF target, and no separate week card number was ever authorized), then **$3,199 bank / $3,299 card from Sept 8**. Zelle stays visually dominant in both states. Founder intent and board mechanics both satisfied.

### R-03 · Standard tuition $3,299 vs $3,499 — **$3,299**
§10 states $3,299 explicitly. Board independently rejects $3,499. No conflict.

### R-04 · PS Emergency capacity — **founder wins: 1 per week**
§16: *"Maximum: 1 per week unless Dr. Brian explicitly increases capacity."* Board said 2. Founder is authority 1. Config: `capacity_cap_per_week: 1`.

### R-05 · 360 wording — **"Enrollment Closed", never "SOLD OUT"**
Both sources agree. "Capacity reached" is substantiable; "sold out" implies a roster count that exists in no file. `banned_wording` enforces this in code.

### R-06 · "Flex mock" — **banned, enforced**
§18 bans the customer-facing term. Added to `banned_terms` and asserted at runtime by `auditBannedTerms()`, which logs a console error if any banned string reaches the DOM.

### R-07 · Zelle mechanism — **live implementation conflicts with the target**
Live: WPCode snippet #71 applies a **2.9% card fee waived for Zelle**. Target: a **flat $100 lower bank price**, *never a percentage, never called a "fee"* (a percentage surcharge also carries card-brand and state-law surcharge exposure).
**Action:** Codex migrates from percentage-fee-waiver to two posted prices. **Do not simply delete snippet #71** — it is the live mechanism making Zelle advantaged today; replace it deliberately. Also reconcile the separately documented `$300 off any course` Zelle discount, which matches neither model.

---

## OUT-OF-SCOPE OBSERVATION (not acted on)

**Origin stall, 2026-09-02 ~08:05–08:15 ET.** During the first audit pass every uncached request timed out (>120s in curl and in a real browser) while Cloudflare served the site from cache (`cf-cache-status: HIT`, `age: 19843`). The origin recovered by 08:15 and has been healthy since (cache-busted request: 200 in 1.4s). Not caused by this ticket and not currently failing — but a ~10-minute origin stall on the morning of a launch is worth raising with Kinsta, and it is why the first pass reported the site as down.
