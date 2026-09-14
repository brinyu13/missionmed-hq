# MR-WEB-0912 Production Enablement Report

Current through: 2026-09-14 02:39 UTC

Status: **MR-WEB-0912 PRODUCTION = BLOCKED**

This report supersedes the earlier Tranche 0 stop report. The fresh-backup and
course-title blockers were resolved, the approved fail-closed production
tranches were executed, and the remaining card gate was redesigned as two
minimum-value live transactions. No financial transaction has been initiated
because the Founder has not authorized the exact $1.00 aggregate amount.

## 1. Authority, BOOT, and Git identity

- Worktree: `/Users/brianb/MissionMed_worktrees/mr-web-0912-interview-week`
- Branch: `codex/mr-web-0912-interview-week`
- Preserved production-source candidate:
  `7d25221fe1136c7dfceefc49663cbe930df24094`
- Current committed harness-safety descendant:
  `3b2888276a5b7cd62ef551544676dfb0dfe7f0e9`
- Current local HEAD matches origin and the worktree is clean.
- Production plugin and MR-WEB-0912 assets remain byte-identical to the
  preserved candidate; the descendant changes only acceptance tooling.
- Universal and MR-WEB-0912 BOOT: PASS at MissionMed HQ tip
  `e71b3902f40e82e4d27813cc54aa836bc13d2c35`.
- Canonical authority: DR-246 and DR-247.
- Canonical MR-079 SHA-256:
  `9638e67841e98b278244c0d4f9ecd0ccbdc7a9e17c50a67dd45d1d31895a0357`.

## 2. Provider recovery point

MissionMed Institute / Live contains the required manual recovery point:

- label: `pre fall update`;
- created: 2026-09-13 3:43 PM EDT;
- expiration: 2026-09-27 3:43 PM EDT;
- visible retention: 14 days;
- restore action: available.

Codex did not create, delete, rename, or restore any backup.

## 3. Course-3646 reconciliation

The discrepancy was a filtered-runtime artifact, not an untracked production
rename. Before correction, the database title was `IV Prep Complete
Masterclass`, while the old live filter returned `IV Prep Essentials`.
Current authoritative raw and filtered identities agree:

- course 3646: `IV Prep Essentials: Interview Week`;
- product 5504 / variation 5867 mapping: exactly `[3646]`;
- course 5227: `IV Prep Complete`;
- product 3576 / variation 5865 mapping: exactly `[5227]`.

## 4. Preimage and rollback custody

- Private preimage:
  `/www/theresidencyacademy_209/private/mr-web-0912/20260913T154300-0400-pre-fall-update/object-preimage.json`
- Mode: `0600`
- SHA-256:
  `a13f6001117fd42b71ed7c00c0d165c292cdb9bb9768760e6749d6afe8e54f35`
- Exact source copies: adjacent `source-preimage/` directory.

The ledger covers target and 360-reference products, courses, options,
acceptances, sanitized gateways, coupons, Calendar/Webex inventory, and source
hashes.

## 5. Current Woo and LearnDash state

| Offer | Product / variation | Price | Course | Inventory |
|---|---|---:|---:|---|
| Interview Week | 5504 / 5867 | $500 | 3646 | out of stock |
| Complete early card PIF | 3576 / 5865 | $3,099 | 5227 | out of stock |
| Complete standard anchor | 3576 | $3,499 regular | 5227 | out of stock |
| 360 reference | 3575 / 5862 / 5863 | $5,499 | 3893 | out of stock |

The Complete sale window is configured through 2026-09-23 11:59:59 PM EDT.
Courses 3646 and 5227 have bounded onboarding bodies. No invented evening time,
Calendar event, or Webex object was added; matching Calendar/Webex count is 0.

## 6. Rails and commercial controls

- Official Woo Stripe gateway: enabled, live mode, card-only.
- Live Stripe account: US/USD, charges enabled, card-payments active.
- Guest checkout: disabled; checkout account/login flow: enabled.
- Woo taxes: disabled, supporting an exact $0.50 controlled total.
- BACS/Zelle and WooPayments: disabled and fail-closed.
- Installments: unavailable; no approved cadence/mechanism exists.
- Dr J alumni discount: unavailable; the old draft coupon is not a safe,
  verified MR-WEB-0912 coupon and was not activated.
- $500 Interview Week to standard-Complete credit: unavailable pending a
  deterministic, order-derived, single-use, refund-safe mechanism.
- Banned `142 alumni matched` claim: not published.

## 7. Source deployment and runtime proof

The fail-closed candidate is deployed. Current MR-WEB-0912 hashes:

- plugin: `04ab7d2bbffbd692bec386ac401bf3c24eba4abb8b4289f9938273801e661235`
- config: `ee1db70bdfda3ec0e5141e83456cc3cd1cf09adf5c3650b8e36d3a6e4eea099d`
- CSS: `743c70b75968e30c251bcdd1619cb2cb21fd8835bbbcd9b52cb85c1ca47b93e2`
- JavaScript: `64b36ab289d0e2fe355ac91b5a1a2c4369148a1346a47b8ab53bd8eadad5e1d0`
- offer page: `9aaabfa8a0db5c5af663282b4b78410444fa9802f6d875362bfd0ac565be5216`

Release validation passed 64/64. Offer-specific acceptance timestamps and
bindings are absent, so both checkout paths remain fail-closed.

## 8. Existing acceptance evidence

- Non-payment Woo-to-LearnDash harness: 22/22 PASS for both exact identities,
  including grant, exclusion, refund, revocation, and reorder behavior.
- Logged-out rendered production sweep: 36/36 PASS at 1440, 1024, and 390
  pixels across corporate, Mission Residency, compare/product aliases, 360,
  cart, and checkout surfaces.
- These results do not substitute for controlled live financial acceptance.

## 9. Minimum-charge acceptance design

Stripe documents $0.50 USD as the minimum supported charge. Live account and
Woo readback confirmed that the current account/currency/card configuration
supports that amount.

The controller creates real Woo orders for the actual variations. Each order
line records the public subtotal ($500 or $3,099), while only its private line
total is $0.50. It creates no product-price mutation, coupon, public route, or
public filter.

Per offer, the flow verifies exact product, variation, account, and line values;
uses a fresh subscriber and a 256-bit temporary credential held only in the
private mode-0600 manifest; performs a real live Stripe card charge; reads back
Stripe, Woo, and LearnDash state; immediately issues an idempotent Stripe
refund; creates the native Woo refund; verifies revocation; and removes login
metadata, sessions, URLs, and Woo payment tokens.

Refund containment is independent of acceptance success: entitlement or login
failure is recorded as FAIL but cannot prevent refund. The state machine resumes
safely after a Stripe-refunded / Woo-unrefunded interruption. Overall success
requires both paid acceptance and post-refund containment.

- Controller: `evidence-scripts/mr-web-0912-live-card-lifecycle.php`
- SHA-256:
  `3ee54ba3417efb26cf7d413861fa3b4c5aa8c4a1d45c48556cc996b25be89c0d`
- PHP syntax and `git diff --check`: PASS
- Independent source/design review: PASS
- Latest committed live read-only preflight: 14/14 PASS at
  2026-09-14 02:37:14 UTC.

No controlled order, subscriber, live-card manifest, or charge exists.

## 10. Authorization boundary

Required authorization: **$1.00 total**, consisting only of two sequential
$0.50 live card charges, each immediately refunded.

The Founder must explicitly authorize that exact total before `prepare` or any
payment action. Required wording:

> I authorize two $0.50 live Stripe charges, totaling $1.00, followed by
> immediate refunds.

`execute prompt` is not financial authorization because it does not name the
specific authorized total.

## 11. Remaining execution gates

1. explicit Founder authorization for the exact $1.00 total;
2. Interview Week live charge, entitlement, refund, and revocation lifecycle;
3. Complete live charge, entitlement, refund, and revocation lifecycle;
4. proof that the temporary mechanism is inactive and credentials/sessions/
   tokens are removed;
5. non-financial rendered price, direct-cart, and checkout proof at $500 and
   $3,099;
6. activation only for each offer whose lifecycle passes;
7. post-activation rendered QA and independent production acceptance.

Zelle, installments, Dr J coupon/stacking, upgrade credit, and session logistics
remain independently blocked and must stay fail-closed. DR-246/247 may permit a
proven card offer to activate without those optional rails.

## 12. State delta

| Surface | Prior Tranche 0 report | Current authoritative state |
|---|---|---|
| Backup | no fresh point | fresh `pre fall update` point verified |
| Course 3646 | unresolved drift | raw/filtered title reconciled |
| Preimage | incomplete | full private mode-0600 ledger present |
| Interview Week | $1,199, in stock | $500, mapped to 3646, fail-closed |
| Complete | $2,799, in stock | $3,099 early / $3,499 standard, mapped to 5227, fail-closed |
| Onboarding | absent | bounded course bodies present |
| Candidate source | not deployed | deployed fail-closed and hash-verified |
| Rendered QA | not run | logged-out 36/36 PASS |
| Entitlement simulation | not run | 22/22 PASS |
| Live payment | not run | still not run; $1.00 authorization pending |
| Activation | absent | still absent by design |

No production acceptance or activation is claimed until all applicable gates
pass.
