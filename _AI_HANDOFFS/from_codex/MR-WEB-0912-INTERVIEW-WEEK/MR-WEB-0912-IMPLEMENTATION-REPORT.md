# MR-WEB-0912 Implementation Report

Current through: 2026-09-14 12:48 UTC

Status: **DEPLOYED AND CORE CARD OFFERS ACTIVATED UNDER DR-251**

`LIVE STRIPE FINANCIAL ACCEPTANCE = WAIVED BY FOUNDER / NOT EXECUTED`

## Scope completed

The preserved candidate
`7d25221fe1136c7dfceefc49663cbe930df24094` was resumed rather than rebuilt.
Only bounded activation, customer-safety, evidence, and direct-cart corrections
were added. No broad Fable CRO redesign was performed.

The final implementation:

- activates Interview Week 5504/5867 at $500 with course 3646;
- activates Complete 3576/5865 at $3,099 early card PIF with the $3,499 regular
  anchor and course 5227;
- makes Complete inclusion of Interview Week explicit and blocks a second
  mixed-cart charge;
- binds each offer to exact runtime product, variation, price, mapping, DR-251,
  and the truthful non-PASS financial status;
- limits MR-WEB-0912 checkout to the official `stripe` gateway;
- keeps Zelle/manual, installments, Dr J coupon, and upgrade credit closed;
- replaces internal verification language with customer-facing copy;
- removes stale waitlist, OUT OF STOCK, mobile desktop-warning, banned alumni,
  MatchFirst, and old-price leakage from the scoped funnel;
- preserves Google tag and GA4 collection;
- rejects missing, cross-wired, stale, and mixed enrollment selections
  server-side;
- enforces one seat per offer/account at the product, add-to-cart, stale-cart,
  and payment-gateway boundaries.

## Authority and current source

- DR-246 and DR-247: original commercial/execution authority.
- DR-251: MR-WEB-0912-only Founder live-financial-test waiver.
- Universal and MR-WEB-0912 BOOT: PASS against OS origin/main `e9dd890` and HQ
  origin/main `e71b390`.
- Worktree: `/Users/brianb/MissionMed_worktrees/mr-web-0912-interview-week`.
- Branch: `codex/mr-web-0912-interview-week`.
- Bounded source descendant at final activation QA: `58a3f17`.
- Live plugin SHA-256:
  `49becfe0224d354b7f999bb4f5f466cf7dd0b0126aac84ae557f1fdce6b38448`.
- Campaign-state SHA-256:
  `e02c8e26362699a78fc4d2e14c685ba2acee4a24e647eacf6809c86538ad3983`.
- JavaScript SHA-256:
  `969ea690f698b5c8cad5e1050f283d3583eea88b15af2c702711f374fac2ed19`.
- CSS SHA-256:
  `743c70b75968e30c251bcdd1619cb2cb21fd8835bbbcd9b52cb85c1ca47b93e2`.
- Offer-shell SHA-256:
  `9aaabfa8a0db5c5af663282b4b78410444fa9802f6d875362bfd0ac565be5216`.

Exact PATH Lease V2 grants governed protected commits and deployment. Supabase
was used only for coordination; no application data was changed.

## Production data and mappings

| Object | Final value |
|---|---|
| Course 3646 | raw/filtered `IV Prep Essentials: Interview Week`; onboarding present |
| Product 5504 / variation 5867 | published, in stock, sold individually, $500, exact mapping `[3646]` |
| Course 5227 | raw/filtered `IV Prep Complete`; onboarding present |
| Product 3576 / variation 5865 | published, in stock, sold individually, $3,099 sale / $3,499 regular, exact mapping `[5227]` |
| Complete sale end | 2026-09-23 11:59:59 PM EDT |
| Offer acceptance time | 2026-09-14 12:03:20 UTC for each offer after single-seat rebinding |
| 360 reference objects | remain out of stock |
| Calendar/Webex matching objects | zero; no evening time invented |

Course 3646's prior mismatch was a stale filter/reporting artifact. Current raw
and filtered truth is the approved Interview Week identity.

## Recovery and verification

- MyKinsta `pre fall update`: Sep 13 3:43 PM EDT, expires Sep 27 3:43 PM,
  restore available.
- Private object preimage:
  `/www/theresidencyacademy_209/private/mr-web-0912/20260913T154300-0400-pre-fall-update/object-preimage.json`.
- Mode `0600`; SHA-256
  `a13f6001117fd42b71ed7c00c0d165c292cdb9bb9768760e6749d6afe8e54f35`.
- Release validation: 81/81 PASS.
- Activation state: 16/16 PASS.
- Product/course/source readback: 13/13 PASS.
- Entitlement/refund simulation: 22/22 PASS.
- Final logged-out rendered and checkout QA: 51/51 PASS.
- Direct/stale/mixed/quantity cart guards: 8/8 PASS.
- Independent non-financial production acceptance: ACCEPTED after the verifier
  retested the original stale quantity-two session and fresh quantity-two
  requests for both offers. See the production enablement report's receipt.

No live charge was submitted. The low-dollar controller remains historical
evidence only and was not prepared or executed after the Founder waiver.

## Deferred scope

Zelle/manual payment, installments, Dr J coupon/stacking, the $500 standard-
price upgrade credit, exact evening times, capacities, replay rules, mock
counts, and unverified refund claims remain unavailable. They were not allowed
to block the two verified core card offers and were not represented as complete.

The full outcome, state delta, production URLs, residual risks, and rollback
proof are in `MR-WEB-0912-PRODUCTION-ENABLEMENT-REPORT.md`.
