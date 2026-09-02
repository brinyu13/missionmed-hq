# 07 — CAMPAIGN STATE MAP

**Single source of truth:** `candidate/config/campaign-state.json`
**Resolver:** `candidate/js/campaign-state.js`

The July-1 banner sat live for two months because a date was typed into a page. This engine exists so that cannot recur: **state is derived from the clock on every render**, and no page contains a price, a date, a program name, or an availability state.

---

## THE TWO GATES (checked before any state)

**GATE 1 — truth gate.** `campaign.go_live_gate.verified_live_at` is `null` → `STATE_PRELAUNCH`, standard prices, no banner, no enrol CTAs. A human sets that timestamp only after a real end-to-end purchase clears. *This is why the site cannot make a backdated claim.*

**GATE 2 — no-flip floor.** Verification later than `2026-09-05T17:00:00-04:00` → nothing publishes; state falls back to pre-launch.

---

## STATES

| State | Trigger | Banner | Prices | Enrol CTAs |
|---|---|---|---|---|
| `STATE_PRELAUNCH` | not verified live, **or** floor missed | no | standard | no |
| `STATE_A_FALL_ACCESS` | verified live **and** within Sept 2 12:00 → Sept 7 23:59 ET | **yes** | Fall Access | yes |
| `STATE_B_STANDARD` | window closed | no | standard | yes |
| `STATE_C_ENROLLMENT_CLOSED` | ≥ Sept 22 23:59 ET | no | standard | **no** (waitlist) |
| `STATE_D_LATE_CYCLE` | `activates` set by founder, ≥ Oct 6 | — | — | never auto-activates |
| `STATE_E_RANK_SEASON` | founder authorization | — | — | never auto-activates |
| `STATE_F_2027_28` | founder authorization | — | — | 360 applications open 2027-03-19 |

**Verified by test (all four states exercised in-browser):**

| | PRELAUNCH | FALL ACCESS | SEPT 8 | SALES CLOSED |
|---|---|---|---|---|
| Banner | ✗ | **✓** | ✗ | ✗ |
| Enrol CTAs | ✗ | ✓ | ✓ | ✗ |
| Complete | $3,299 / $3,199 | **$2,799 all rails** | $3,299 / $3,199 | $3,299 closed |
| Essentials | $1,399 | **$1,199** | $1,399 | closed |
| Bank advantage | $100 | **$0** | $100 | $100 |
| 360 | closed | closed | closed | closed |
| PS Priority | closed | **open** | **auto-closed** (past Sept 8) | closed |

The Sept 8 column is the anti-stale proof: **the flip needs no human action.** PS Priority self-closes on its own `sales_close`, independently of the global state.

---

## CHANGING THINGS WITHOUT TOUCHING A PAGE

| To change | Edit |
|---|---|
| Any price | `products.<key>.pricing` |
| The mock promise | `mock_entitlement.count` / `.public_label` / `.plain_english_structure` |
| Publish exact mock detail | `mock_entitlement.publish_exact_entitlement: true` |
| Open/close a product | `products.<key>.available` / `.sales_close` |
| Move the window | `campaign.window.opens` / `.closes` |
| Publish the plan premium | `payments.missionmed_payment_plan.premium_amount` + `premium_published` |
| Turn Affirm on | `payments.affirm.available: true` (only with written approval) |
| Reveal hidden inventory | `hidden_inventory.*.visible: true` |
| Market a software system | `technology.systems[].status` → `VERIFIED LIVE` |

---

## GUARDRAILS ENFORCED IN CODE

- **Banned terms.** `mock_entitlement.banned_terms` + `products.match_mentorship_360.banned_wording` are asserted against the rendered DOM by `auditBannedTerms()`. A leak logs a console error and is exposed at `window.__MM_AUDIT__`. Covers "flex mock", "unlimited mocks", "SOLD OUT", "OPENING SOON".
- **No strikethrough.** The stylesheet defines no strikethrough/"save"/percentage-off class. The fictitious-former-price pattern cannot be reintroduced by copy-paste.
- **No countdown.** `campaign.countdown.enabled: false`, and nothing renders one. A countdown may only exist bound to a verified coded flip.
- **Technology defaults to suppressed.** Every system is `UNVERIFIED` → `SUPPRESS` until explicitly proven. Fabricating readiness requires a deliberate edit.
