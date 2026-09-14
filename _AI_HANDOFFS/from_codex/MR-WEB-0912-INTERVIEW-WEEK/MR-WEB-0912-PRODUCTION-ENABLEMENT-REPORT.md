# MR-WEB-0912 Production Enablement Report

Current through: 2026-09-14 12:48 UTC

Status: **MR-WEB-0912 PRODUCTION = DEPLOYED AND ACTIVATED WITH FOUNDER FINANCIAL-TEST WAIVER**

`LIVE STRIPE FINANCIAL ACCEPTANCE = WAIVED BY FOUNDER / NOT EXECUTED`

No live MR-WEB-0912 order, payment, charge, or refund was created. This report
does not record the waived financial lifecycle as PASS.

## 1. Authority and BOOT

- DR-246 and DR-247 required live financial acceptance and did not themselves
  authorize a waiver.
- The Founder made a release-specific risk decision. Canonical DR-251 records
  that decision for MR-WEB-0912 only; it does not weaken global MissionMed
  policy.
- Waiver record:
  `decisions/DR-251_mr_web_0912_founder_live_financial_acceptance_waiver.md`.
- Waiver receipt:
  `handoffs/from_codex/MR_WEB_0912_FOUNDER_FINANCIAL_WAIVER/MR_WEB_0912_FOUNDER_FINANCIAL_WAIVER_RECEIPT.md`.
- MissionMed OS current origin/main: `e9dd89023fc7a9d6daa9611723ccfcef9345ec5f`.
- MissionMed HQ origin/main: `e71b3902f40e82e4d27813cc54aa836bc13d2c35`.
- Fresh universal BOOT: PASS.
- Fresh MR-WEB-0912 profile BOOT: PASS.
- Canonical MR-079 SHA-256:
  `9638e67841e98b278244c0d4f9ecd0ccbdc7a9e17c50a67dd45d1d31895a0357`.

## 2. Git and source custody

- Worktree: `/Users/brianb/MissionMed_worktrees/mr-web-0912-interview-week`.
- Branch: `codex/mr-web-0912-interview-week`.
- Preserved reviewed candidate:
  `7d25221fe1136c7dfceefc49663cbe930df24094`.
- Bounded source descendant at final activation QA: `58a3f17`.
- No redesign or new Fable CRO program was introduced. Descendant changes are
  activation controls, truthful customer-facing corrections, evidence, and a
  bounded fixes for empty-variation add-to-cart input and single-seat quantity
  enforcement.
- Live plugin SHA-256:
  `49becfe0224d354b7f999bb4f5f466cf7dd0b0126aac84ae557f1fdce6b38448`.
- Live campaign-state SHA-256:
  `e02c8e26362699a78fc4d2e14c685ba2acee4a24e647eacf6809c86538ad3983`.
- Live JavaScript SHA-256:
  `969ea690f698b5c8cad5e1050f283d3583eea88b15af2c702711f374fac2ed19`.
- Live CSS SHA-256:
  `743c70b75968e30c251bcdd1619cb2cb21fd8835bbbcd9b52cb85c1ca47b93e2`.
- Live offer shell SHA-256:
  `9aaabfa8a0db5c5af663282b4b78410444fa9802f6d875362bfd0ac565be5216`.

## 3. Recovery point and exact preimage

MyKinsta MissionMed Live contains the mission-appropriate recovery point:

- label/note: `pre fall update`;
- created: 2026-09-13 3:43 PM EDT;
- expiration: 2026-09-27 3:43 PM EDT;
- visible retention: 14 days;
- restore action: available.

Codex did not create, delete, rename, or restore a provider backup.

- Object preimage:
  `/www/theresidencyacademy_209/private/mr-web-0912/20260913T154300-0400-pre-fall-update/object-preimage.json`.
- Mode: `0600`.
- SHA-256:
  `a13f6001117fd42b71ed7c00c0d165c292cdb9bb9768760e6749d6afe8e54f35`.
- Exact prior source copies are adjacent under `source-preimage/`.
- The ledger covers the two target parents and variations, 360 reference
  objects, courses, mappings, options, acceptance pairs, sanitized gateways,
  coupons, Calendar/Webex inventory, and source manifests.

## 4. Course-3646 title reconciliation

The discrepancy was a stale filtered-runtime/reporting artifact, not a new
untracked production rename. Current raw and filtered production truth agrees:

- course 3646: `IV Prep Essentials: Interview Week`;
- Woo 5504 / 5867 maps exactly to LearnDash `[3646]`;
- course 5227: `IV Prep Complete`;
- Woo 3576 / 5865 maps exactly to LearnDash `[5227]`.

The current `IV Prep Essentials: Interview Week` identity is therefore correct
for MR-WEB-0912.

## 5. Activated offers and inventory

| Offer | Woo parent / variation | Public price | LearnDash | Production state |
|---|---|---:|---:|---|
| IV Prep Essentials: Interview Week | 5504 / 5867 | $500 | 3646 | published, in stock, sold individually, purchasable, Stripe/card checkout active |
| IV Prep Complete early card PIF | 3576 / 5865 | $3,099 through Sep 23 | 5227 | published, in stock, sold individually, purchasable, Stripe/card checkout active |
| IV Prep Complete standard anchor | 3576 / 5865 | $3,499 regular | 5227 | displayed regular-price anchor; sale expires 2026-09-23 11:59:59 PM EDT |

Both offer-specific acceptance bindings were re-issued after the bounded
single-seat correction at `2026-09-14T12:03:20Z`. They bind exact product,
variation, price, course,
mapping, authority `DR-251`, and the non-PASS financial status. Complete copy
states that Interview Week is included and never adds a separate $500 charge.

The 360 reference parent 3575 and variations 5862/5863 remain out of stock and
outside MR-WEB-0912 activation.

## 6. Exact fail-closed paths

- Zelle/manual/BACS: unavailable and not rendered as an approved offer.
- Installments: unavailable; no cadence or implementation was invented.
- Dr J additional $100 coupon: unavailable; no coupon/stacking claim was
  activated.
- $500 Interview Week to standard-Complete credit: unavailable; no retroactive
  early-price credit mechanism was activated.
- Unverified mock counts, capacities, exact evening times, replay rules,
  guarantees, or refund claims: not published.
- The banned `142 alumni matched` claim and stale MatchFirst/old-price copy are
  not published.

Woo may have other globally configured gateways, but whenever an MR-WEB-0912
product is in the cart the available-gateway list is reduced to `stripe` only.

## 7. Production acceptance

### State and entitlement evidence

- Release harness: 81/81 PASS.
- Waiver-aware activation controller: 16/16 PASS at
  2026-09-14 12:03:20 UTC.
- Product/course/source readback: 13/13 PASS at
  2026-09-14 12:06:04 UTC after the bounded single-seat correction.
- Non-payment Woo to LearnDash simulation: 22/22 PASS for exact grant,
  unrelated-course exclusion, refund simulation, revocation, unrelated access
  preservation, and reorder behavior.
- Prior Mission Residency P0 history proves Stripe to Woo to LearnDash to
  refund/revocation behavior on the same production stack; it is supporting
  stack evidence, not a substitute MR-WEB-0912 transaction.
- `LIVE STRIPE FINANCIAL ACCEPTANCE = WAIVED BY FOUNDER / NOT EXECUTED`.

### Fresh logged-out rendered QA

The final production sweep completed at 2026-09-14 12:08:58 UTC after the
single-seat correction:

- viewports: 1440 desktop, 1024 tablet, and 390 mobile;
- routes: homepage, Mission Residency, two comparison aliases, both current and
  legacy product aliases, cart, checkout, legacy waitlist, terms, refund, and
  privacy;
- public route/viewport checks: 45/45 PASS;
- real checkout render cases: 6/6 PASS;
- combined result: 51/51 PASS.

Both real checkout pages displayed the correct item and amount, one payment
method (`stripe`), Stripe Elements, Place order control, account creation, and
terms/refund/privacy links. The verifier did not click Place order.

The funnel contains no internal QA/governance copy, activation-placeholder
copy, OUT OF STOCK leakage, scoped mobile desktop-warning banner, `142 alumni`
claim, MatchFirst language, stale price, or horizontal overflow. The homepage
CTA no longer targets the stale waitlist. The legacy waitlist route redirects
to `/mission-residency/?from=legacy-waitlist`.

### Direct, stale, and mixed-cart guards

Final guard sweep at 2026-09-14 12:04:13 UTC: 8/8 PASS.

- Missing variations and cross-wired parent/variation pairs fail closed with
  `This enrollment selection is not valid.` and an empty cart.
- Interview Week then Complete retains only Interview Week and rejects
  Complete.
- Complete then Interview Week retains only Complete and rejects Interview
  Week.
- Both mixed-cart notices state that Complete already includes Interview Week.
- Direct quantity-two requests for both offers fail closed with
  `Enrollment is limited to one seat per account.` and an empty cart.

An initial missing-variation test exposed a strict PHP argument-type error. The
bounded fix accepts Woo's empty string, casts it to the expected integer, and
preserves the same fail-closed decision. The full state/readback/render/guard
suite passed again after deployment.

The first independent review then identified a separate same-offer quantity-two
path that could reach Complete checkout at $6,198. Production was corrected by
setting both parents and both target variations to sold-individually, rejecting
non-unit add-to-cart requests, treating stale non-unit carts as unsafe, and
removing payment gateways from an unsafe stale cart. No order or payment was
submitted. All source, activation, readback, guard, and rendered suites above
were rerun after that correction.

### Analytics

- Google tag loader observed: `GT-PJ7SPCWF`.
- GA4 collection observed: `G-B4B4E26HMW`.
- Network requests were observed on homepage, Mission Residency, and both real
  checkout render paths, including mobile.

## 8. Independent acceptance

Independent non-financial production acceptance: **ACCEPTED**.

The verifier was explicitly told and recorded:

`LIVE FINANCIAL TRANSACTION TEST = FOUNDER-WAIVED / NOT PERFORMED`

The verifier did not relabel the waived lifecycle as PASS and created no order
or payment. Independent evidence included:

- universal and MR-WEB-0912 BOOT PASS;
- exact pushed source `58a3f1747421e53715b39d064446886b25daaf6b`
  and live plugin hash match;
- 81-assertion release validator PASS, 16/16 activation PASS, and fresh 13/13
  live readback at 2026-09-14 12:10:17 UTC;
- both bindings at 2026-09-14 12:03:20 UTC, exact product/variation/price/course
  mappings, inventory, account-required checkout, and sold-individually state;
- the original stale Complete quantity-two session now showing the cart-issue
  hard stop, zero payment gateways, and no Place Order control;
- fresh cookie-free quantity-two requests for both offers returning the
  one-seat rejection, empty cart, and no checkout link;
- independent 390px pricing/copy/overflow review, GT/GA network proof, optional
  rail closure, redirects/policies, and rollback readiness.

The provider coordination readback at 2026-09-14 12:48:30 UTC found zero
active registry leases, zero active MR-WEB-0912 path conflicts, and zero
pending registry waiters.

## 9. Rollback readiness

- The waiver activation controller has a bounded `disable` path that clears
  both MR-WEB-0912 acceptance pairs and waiver options and returns both target
  parents/variations to out-of-stock.
- Per-offer containment may instead clear only the affected binding/timestamp
  and close only that offer.
- Exact object and source preimages are available before any restoration.
- The provider recovery point is available through Sep 27; provider restore
  remains a separately authorized last resort.
- No financial object exists to refund, reconcile, or preserve for this
  release.

## 10. Production URLs

- Homepage: https://missionmedinstitute.com/
- Mission Residency: https://missionmedinstitute.com/mission-residency/
- Offer comparison: https://missionmedinstitute.com/mission-residency-courses/
- Interview Week canonical product route:
  https://missionmedinstitute.com/product/iv-prep-masterclass/
- Interview Week customer alias:
  https://missionmedinstitute.com/product/iv-prep-essentials/
- Complete canonical product route:
  https://missionmedinstitute.com/product/match-prep-pro/
- Complete customer alias:
  https://missionmedinstitute.com/product/iv-prep-complete/
- Cart: https://missionmedinstitute.com/cart/
- Checkout: https://missionmedinstitute.com/checkout/
- Terms: https://missionmedinstitute.com/terms-of-agreement/
- Refund/cancellation:
  https://missionmedinstitute.com/refund-cancellation-policy/
- Privacy: https://missionmedinstitute.com/privacy-policy/

## 11. State delta

| Surface | Pre-mission production truth | Final production truth |
|---|---|---|
| Authority | DR-246/247; no waiver path | scoped DR-251 Founder waiver canonically filed and BOOT-routed |
| Backup | no fresh mission point at first stop | fresh `pre fall update` recovery point verified |
| Preimage | incomplete | full mode-0600 object/source ledger |
| Course 3646 | raw/filter/report discrepancy | raw and filtered `IV Prep Essentials: Interview Week`; exact mapping verified |
| Interview Week | old $1,199 presentation and no MR-WEB-0912 binding | 5504/5867 at $500, in stock, bound, card checkout active |
| Complete | prior $2,799 presentation and no MR-WEB-0912 binding | 3576/5865 at $3,099 early / $3,499 regular, in stock, bound, card checkout active |
| Complete inclusion | potentially ambiguous | Interview Week explicitly included; mixed-cart second charge blocked |
| Optional rails | requested but unproved | Zelle, installments, Dr J coupon, and upgrade credit explicitly fail-closed |
| Onboarding | absent/incomplete | bounded 3646 and 5227 course bodies present |
| Source | candidate not deployed | preserved candidate plus bounded activation corrections deployed/hash-matched |
| Homepage | stale waitlist routing/copy risk | current Mission Residency CTA and scoped customer-safe copy |
| Mobile funnel | desktop-warning leakage risk | warning absent on campaign/cart/checkout; 390 QA PASS |
| Cart guards | mixed/stale protections incomplete | cross-wire, missing-variation, quantity-two, unsafe stale-cart payment, and both mixed directions fail closed; all target objects sold individually |
| Analytics | required verification open | tag loader and GA4 collect observed on required funnel surfaces |
| Entitlement | exact MR-WEB-0912 proof absent | non-payment simulation 22/22 PASS |
| Live financial lifecycle | not run | waived by Founder; not executed; not PASS |
| Independent acceptance | initial quantity-two blocker | blocker corrected and independently retested; non-financial production acceptance ACCEPTED |
| Activation | both core offers closed | both verified core card offers activated; optional rails remain closed |

## 12. Remaining risks and blockers

There is no remaining non-waived activation blocker in the evidence above.

Residual risks accepted or intentionally deferred:

1. The actual MR-WEB-0912 live Stripe payment, paid-order, entitlement,
   immediate-refund, and revocation lifecycle was not executed. This is the
   explicit Founder-accepted release risk.
2. Zelle/manual, installments, Dr J coupon/stacking, and the $500 standard-price
   upgrade credit have no approved end-to-end mechanism and remain unavailable.
3. No exact evening time or Calendar/Webex object exists; the funnel does not
   invent one.
4. Production WP-CLI emits pre-existing plugin translation notices and may exit
   255 after successful cache work; exact source hashes and browser readback,
   not that unstable exit code alone, are the deployment truth.
5. The dedicated Fable CRO closure/re-audit remains separate and begins only
   after this activation mission is sealed.
