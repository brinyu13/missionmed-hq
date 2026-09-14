# MR-WEB-0912 Implementation Report

Current through: 2026-09-14 02:39 UTC

Worktree: `/Users/brianb/MissionMed_worktrees/mr-web-0912-interview-week`

Branch: `codex/mr-web-0912-interview-week`

Authority: DR-246 and DR-247

Status: **SOURCE/FAIL-CLOSED DEPLOYMENT COMPLETE; PRODUCTION ACTIVATION BLOCKED**

## Outcome

The reviewed Interview Week / Complete candidate is deployed to production in
its designed fail-closed state. Product identity/pricing, course identity and
onboarding, scoped preimages, source deployment, runtime validation,
non-payment entitlement testing, and logged-out rendered QA are complete.

Neither offer is active. Both target products remain out of stock and their
offer-specific acceptance timestamps and bindings remain absent. No live
MR-WEB-0912 payment has occurred because the Founder has not authorized the
exact $1.00 aggregate controlled acceptance amount.

## Authority and source identity

- Preserved production-source candidate:
  `7d25221fe1136c7dfceefc49663cbe930df24094`.
- The production plugin and MR-WEB-0912 asset tree remain byte-identical to
  that candidate.
- Current descendants add evidence and acceptance tooling only.
- Universal and mission BOOT passed at MissionMed HQ tip
  `e71b3902f40e82e4d27813cc54aa836bc13d2c35`.
- Canonical MR-079 SHA-256:
  `9638e67841e98b278244c0d4f9ecd0ccbdc7a9e17c50a67dd45d1d31895a0357`.
- Exact PATH Lease V2 claims governed protected changes; no Supabase
  application data was used or changed.

## Deployed source

| Path | Purpose | Production SHA-256 |
|---|---|---|
| `wp-content/mu-plugins/missionmed-mr-p0.php` | MR-WEB-0912 routing, claims, cart guards, exact object/price/mapping checks, per-offer activation | `04ab7d2bbffbd692bec386ac401bf3c24eba4abb8b4289f9938273801e661235` |
| `missionmed-mr-0912-assets/config/campaign-state.json` | Approved campaign truth with optional/unverified rails closed | `ee1db70bdfda3ec0e5141e83456cc3cd1cf09adf5c3650b8e36d3a6e4eea099d` |
| `missionmed-mr-0912-assets/pages/offer.html` | Shared accessible offer shell | `9aaabfa8a0db5c5af663282b4b78410444fa9802f6d875362bfd0ac565be5216` |
| `missionmed-mr-0912-assets/css/mr-0912.css` | Responsive visual layer | `743c70b75968e30c251bcdd1619cb2cb21fd8835bbbcd9b52cb85c1ca47b93e2` |
| `missionmed-mr-0912-assets/js/mr-0912.js` | Data-driven fail-closed views | `64b36ab289d0e2fe355ac91b5a1a2c4369148a1346a47b8ab53bd8eadad5e1d0` |

The 64-assertion release harness passes. Direct/stale add-to-cart paths,
sibling variation IDs, mixed Interview Week + Complete carts, incorrect course
mappings, and missing offer-specific acceptance all fail closed.

## Production data applied closed

- Interview Week 5504/5867:
  `IV Prep Essentials: Interview Week`, $500, exact course `[3646]`, out of
  stock.
- Complete 3576/5865:
  `IV Prep Complete`, $3,099 early card PIF, $3,499 regular anchor, exact course
  `[5227]`, out of stock.
- Complete sale end: 2026-09-23 11:59:59 PM EDT.
- Course 3646 raw/filtered title:
  `IV Prep Essentials: Interview Week`; onboarding body present.
- Course 5227 raw/filtered title:
  `IV Prep Complete`; onboarding body present.
- 360 reference objects remain out of stock.
- Calendar/Webex matching object count remains zero; no exact evening time was
  invented.

The 3646 drift was reconciled as an old title-filter artifact, not an untracked
production change.

## Recovery and preimage

- MyKinsta manual backup `pre fall update`: created 2026-09-13 3:43 PM EDT,
  expires 2026-09-27 3:43 PM EDT, restore available.
- Exact preimage:
  `/www/theresidencyacademy_209/private/mr-web-0912/20260913T154300-0400-pre-fall-update/object-preimage.json`
- Preimage mode: `0600`.
- Preimage SHA-256:
  `a13f6001117fd42b71ed7c00c0d165c292cdb9bb9768760e6749d6afe8e54f35`.

Codex did not create, delete, rename, or restore a provider backup.

## Verification completed

- PHP/JSON/JavaScript syntax and `git diff --check`: PASS.
- Release harness: 64/64 PASS.
- Non-payment Woo/LearnDash lifecycle: 22/22 PASS across both exact identities,
  including grant, exclusion, refund, revocation, and reorder behavior.
- Logged-out production rendering: 36/36 PASS across 1440, 1024, and 390 pixel
  viewports.
- Live card preflight: 14/14 PASS; Stripe live US/USD/card configuration,
  product/mapping/price truth, guest-checkout closure, tax state, manifest
  absence, and offer fail-closed state verified.

These checks do not substitute for a real live charge/refund lifecycle.

## Low-dollar live acceptance controller

The full-price $500 + $3,099 test is prohibited. The verified Stripe minimum is
$0.50 USD, so the controlled plan is two sequential $0.50 charges, immediately
refunded, totaling $1.00.

The private controller uses the actual product and variation IDs. It creates no
public price change, coupon, route, or filter. Its resumable state machine binds
every mutation to the private manifest and exact order/charge identity, records
acceptance failures without blocking refund, removes sessions and payment
tokens, and reports success only if both paid acceptance and post-refund
containment pass.

- File: `evidence-scripts/mr-web-0912-live-card-lifecycle.php`
- SHA-256:
  `3ee54ba3417efb26cf7d413861fa3b4c5aa8c4a1d45c48556cc996b25be89c0d`
- Independent source/design review: PASS.
- No controlled order, subscriber, manifest, or charge exists.

## Remaining blockers

1. explicit Founder authorization for exactly two $0.50 charges totaling $1.00;
2. Interview Week and Complete live payment/entitlement/refund/revocation runs;
3. proof that the temporary mechanism is fully removed;
4. independent non-financial public price/cart/checkout verification at $500
   and $3,099;
5. per-offer activation, rendered production QA, and independent production
   acceptance.

Zelle, installments, Dr J coupon/stacking, upgrade credit, and unapproved
session logistics remain independently fail-closed. They do not become true
merely because a card offer passes.

## State delta

| Surface | Original production baseline | Current state |
|---|---|---|
| Candidate source | local only | deployed fail-closed and hash-verified |
| Interview Week | $1,199 old identity | $500 exact identity/mapping; closed |
| Complete | $2,799 prior offer | $3,099 early / $3,499 standard; closed |
| Course titles | old raw/filter mismatch | reconciled approved raw/filtered titles |
| Onboarding | empty | bounded bodies present |
| Recovery | prior backups only | fresh mission recovery point verified |
| Preimage | incomplete | full mode-0600 ledger |
| Entitlement proof | prior bridge evidence | exact two-offer 22/22 non-payment PASS |
| Rendered QA | candidate-only | production 36/36 logged-out PASS |
| Live acceptance | absent | still absent pending $1.00 authorization |
| Activation | legacy only | MR-WEB-0912 offer-specific evidence absent |

## Required authorization wording

> I authorize two $0.50 live Stripe charges, totaling $1.00, followed by
> immediate refunds.

`execute prompt` is not sufficient because it does not name the financial
amount authorized.
