# 06 — PAYMENT AND ENTITLEMENT MAP

**Captured 2026-09-02 from live production.** No credentials were read, no secrets are reproduced, no routing was changed.

---

## 1. PAYMENT STACK (as built)

| Component | State |
|---|---|
| `woocommerce-gateway-stripe` | **Installed** |
| `woocommerce-payments` (WooPayments) | **Installed** |
| Routing | **Stripe Connect direct charges.** `mmi-mixed-cart-guard.php` enforces **one connected account per PaymentIntent**, selected from `_mmi_instructor_id` product meta |
| Cart guard | Enforced: *"MissionMed enrollments must be completed one program at a time."* Live modal offers Cancel / Replace Cart & Continue |
| WooCommerce Subscriptions | **Installed** — powers the existing 6-month plans |
| Zelle | **No plugin.** Manual workflow + WPCode snippet **#71** (`AHP-019`) applying a **2.9% card fee waived for Zelle** |
| Affirm / Klarna / Afterpay | **Not installed.** Correctly not advertised |

> **UNRESOLVED — Codex must confirm:** two card gateways are installed. Which one actually processes Mission Residency orders, and does the other need disabling? **Do not change Stripe routing without explicit deployment authority** (ticket §"Audit payments").

### 1a. The Zelle mechanism conflict (R-07)

- **Today:** a *percentage* card fee (2.9%) waived for Zelle. A separate `$300 off any course` Zelle discount is documented in `MISSIONMED_MASTER_KNOWLEDGE.md` — matching neither the fee model nor the target model.
- **Target:** **two posted prices** — $3,299 card / $3,199 bank transfer. Never a percentage, never the word "fee".
- **Why it matters:** a percentage card surcharge carries card-brand surcharging rules and state-level surcharge bans; a lower posted cash/bank price is the conventional, lower-risk construction of the same economics.
- **Instruction:** do not simply delete snippet #71 — it is what makes Zelle advantaged today. Replace it deliberately, and reconcile the $300 figure.

### 1b. Payment plans (as built)

Real WooCommerce Subscriptions products, **0% — plan total equals PIF total exactly**:

| ID | Plan | Instalment | × | Total |
|---|---|---|---|---|
| 5511 | 360 | $666.50 | 6 | $3,999 |
| 5512 | Match Prep Pro | $466.50 | 6 | $2,799 |
| 5513 | IV Prep Masterclass | $249.83 | 6 | $1,499 |

**The founder's ~6-month term already exists.** Only the higher total does not. Changing the total is a config change on an existing subscription product — **the blocker is compliance, not engineering.** See `02_RISK_AND_CONFLICT_LEDGER.md` R-01.

### 1c. MatchFirst™ (P0-4)

Live and prominent on `/mission-residency/`: *"deposit now, pay the rest only after you match"*, *"50% down, 50% after Match"*. Present on 20 captured pages. **Undefined in this ticket and in the board ruling.** Deferring 50% of tuition until an uncertain future event is a credit product in substance. **Founder decision required.** The candidate neither reproduces nor removes it.

---

## 2. ENTITLEMENT PATH (as built)

```
add-to-cart → /cart/ → /checkout/
  → mmi-mixed-cart-guard.php  (single connected account per PaymentIntent)
  → Stripe Connect direct charge  (routed by _mmi_instructor_id)
  → WooCommerce order
  → LearnDash enrolment via _related_course
  → WooCommerce Memberships role
  → confirmation email
```

| Product | ID | LearnDash target | Verified end-to-end? |
|---|---|---|---|
| 360 Match Mentorship | 3575 | `/courses/mission-residency-360-match-mentorship/` | **NO** |
| Match Prep Pro → IV Prep Complete | 3576 | `/courses/match-prep-pro/` | **NO** |
| IV Prep Masterclass → IV Prep Essentials | 5504 | `/courses/iv-prep-masterclass/` | **NO** |
| Interview Prep Foundation | 3577 | course **3646** (`_related_course`) | **NO** |

**The links exist in configuration. Delivery has not been proven.** No test purchase was run, because no production mutation is authorized by this ticket.

---

## 3. LAUNCH GATE — P0-3

Fall Access Week must not be advertised until this passes **for each open product**:

1. Purchase via the `$1 Test` SKU or a real transaction.
2. Order reaches the correct status.
3. **Correct** LearnDash course is granted (not a neighbouring one).
4. Correct membership/role applied.
5. Matrix / member access resolves.
6. Confirmation email sends with correct content.
7. Refund path verified.

Then, and only then, a human sets:

```json
"go_live_gate": {
  "verified_live_at": "2026-09-0XT12:00:00-04:00",
  "verified_by": "<name>",
  "verification_evidence": "<order id / screenshot path>"
}
```

**This is enforced in code, not by memory.** `campaign-state.js` GATE 1 returns `STATE_PRELAUNCH` with standard pricing while `verified_live_at` is null — the Fall Access banner and prices are unreachable until someone proves the purchase. GATE 2 additionally forces pre-launch if verification lands after the 2026-09-05T17:00 no-flip floor.

---

## 4. PS INTENSIVE — DEPOSIT PATH (new)

| | Priority | Emergency |
|---|---|---|
| Tuition | $999 | $1,499 |
| Deposit | $250 | $500 |
| Turnaround | first developed draft ≤ 7 days | first developed draft 24–48 h |
| Cap | 2 | **1 per week** (founder overrides board's 2) |
| Sales close | Sept 8 | Sept 16 |
| Discounts | week price *is* $999 | **never discounted, excluded from every code** |
| Clock starts | session done + materials in + payment condition met | **+ availability confirmed in writing first** |

**No Woo products exist for these yet.** Codex must create them, or route to the existing manual Admissions/deposit path. Balance due before the strategy session under final terms. The candidate renders the full customer-facing flow to the staging boundary.
