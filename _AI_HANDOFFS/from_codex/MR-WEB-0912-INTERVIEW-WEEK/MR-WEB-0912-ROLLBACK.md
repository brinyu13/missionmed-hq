# MR-WEB-0912 Rollback and Containment

Current through: 2026-09-14 12:48 UTC

Current state: **two core card offers active under DR-251; optional rails
fail-closed; no MR-WEB-0912 live financial transaction exists.**

This procedure is MR-WEB-0912-only. Do not reset, rebase, clean, stash,
force-push, overwrite unrelated state, or use a whole-database restore for a
narrow offer failure.

## Recovery custody

- MyKinsta Live recovery point: `pre fall update`.
- Created: 2026-09-13 3:43 PM EDT.
- Expires: 2026-09-27 3:43 PM EDT.
- Restore control: available.
- Exact object preimage:
  `/www/theresidencyacademy_209/private/mr-web-0912/20260913T154300-0400-pre-fall-update/object-preimage.json`.
- Mode: `0600`.
- SHA-256:
  `a13f6001117fd42b71ed7c00c0d165c292cdb9bb9768760e6749d6afe8e54f35`.
- Exact prior source files are adjacent under `source-preimage/`.

Do not create, delete, rename, or restore provider backups during ordinary
containment. A provider restore remains a separately authorized last resort.

## Immediate fail-closed containment

For an offer-specific price, product, mapping, entitlement, checkout, or
rendering defect:

1. clear the affected `verified_live_at` and
   `acceptance_binding_sha256` options;
2. set the affected parent and variation to out-of-stock;
3. verify its curated CTA, direct/stale add-to-cart, cart, and checkout are
   closed;
4. leave the other offer unchanged unless its own evidence fails;
5. preserve sanitized source/runtime/browser evidence.

Offer-specific options:

- `mmed_mr_0912_interview_week_verified_live_at`;
- `mmed_mr_0912_interview_week_acceptance_binding_sha256`;
- `mmed_mr_0912_complete_verified_live_at`;
- `mmed_mr_0912_complete_acceptance_binding_sha256`.

For a mission-wide MR-WEB-0912 closure, run the reviewed activation controller
in `disable` mode. It clears both acceptance pairs and the DR-251 waiver option
pair and returns parents/variations 5504/5867 and 3576/5865 to out-of-stock.
Then flush affected caches and run the logged-out closed-state sweep.

The legacy September 4 `mmed_mr_p0_verified_live_at` is not MR-WEB-0912
acceptance and cannot reopen either offer.

## Source containment

Current deployed hashes:

- plugin:
  `49becfe0224d354b7f999bb4f5f466cf7dd0b0126aac84ae557f1fdce6b38448`;
- campaign-state:
  `e02c8e26362699a78fc4d2e14c685ba2acee4a24e647eacf6809c86538ad3983`;
- JavaScript:
  `969ea690f698b5c8cad5e1050f283d3583eea88b15af2c702711f374fac2ed19`;
- CSS:
  `743c70b75968e30c251bcdd1619cb2cb21fd8835bbbcd9b52cb85c1ca47b93e2`;
- offer shell:
  `9aaabfa8a0db5c5af663282b4b78410444fa9802f6d875362bfd0ac565be5216`.

If source restoration is required:

1. close the affected offer or both offers first;
2. restore only the exact plugin/asset files recorded by the private preimage;
3. verify SHA-256 before and after an atomic source switch;
4. purge only affected Mission Residency/product/cart/checkout caches;
5. repeat source readback, controller verification, cart guards, and logged-out
   rendered acceptance;
6. obtain fresh independent production verification before reopening.

## Object restoration

Restore only affected fields from the mode-0600 preimage:

- Interview Week parent/variation 5504/5867 and course 3646;
- Complete parent/variation 3576/5865 and course 5227;
- MR-WEB-0912 activation/waiver options;
- MR-WEB-0912 route/source objects.

Do not touch 360 objects except to verify they remain closed. Do not activate or
create Zelle, installments, coupon, upgrade-credit, Calendar, or Webex objects
as part of rollback.

## Financial containment boundary

`LIVE STRIPE FINANCIAL ACCEPTANCE = WAIVED BY FOUNDER / NOT EXECUTED`

There is no controlled MR-WEB-0912 order, charge, refund, subscriber, temporary
credential, stored payment token, or private live-card manifest to contain.
The historical low-dollar controller was not prepared or executed after the
Founder waiver. If a future customer transaction creates a genuine incident,
preserve and reconcile that exact Stripe/Woo/account/entitlement object under a
separate authorized incident procedure; do not run the abandoned acceptance
workflow against it.

## Post-containment acceptance

After any containment or rollback:

1. prove the affected offer is closed;
2. re-read exact price, title, parent, mapping, inventory, and bindings;
3. run direct/stale and mixed-cart denial tests;
4. run the full 1440/1024/390 logged-out route and checkout-boundary sweep;
5. verify optional rails remain unavailable and unrelated access/state is
   unchanged;
6. obtain fresh independent acceptance;
7. file and push a forward-history rollback receipt with exact hashes and state
   delta.
