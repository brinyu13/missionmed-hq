# MR-WEB-0912 Rollback and Containment

Current through: 2026-09-14 02:39 UTC

Current state: **fail-closed source and data deployment present; no
MR-WEB-0912 activation, controlled live order, or live charge exists.**

This procedure is scoped to MR-WEB-0912. Do not reset, rebase, clean, stash,
force-push, overwrite unrelated production state, or use a whole-database
restore for a narrow failure.

## Recovery custody

- MyKinsta Live manual recovery point: `pre fall update`.
- Created: 2026-09-13 3:43 PM EDT.
- Expires: 2026-09-27 3:43 PM EDT.
- Restore control: available.
- Exact private object preimage:
  `/www/theresidencyacademy_209/private/mr-web-0912/20260913T154300-0400-pre-fall-update/object-preimage.json`
- Preimage mode: `0600`.
- Preimage SHA-256:
  `a13f6001117fd42b71ed7c00c0d165c292cdb9bb9768760e6749d6afe8e54f35`.
- Exact prior source copies: adjacent `source-preimage/` directory.

Do not create, delete, rename, or restore provider backups during ordinary
containment. Do not replace the production database wholesale.

## Immediate fail-closed containment

If a runtime, payment, entitlement, price, or rendering check fails:

1. clear only the affected offer's MR-WEB-0912 acceptance timestamp and binding;
2. set its parent and variation out of stock;
3. verify its checkout CTA and direct/stale cart paths are closed;
4. leave the other offer unchanged unless its own evidence fails;
5. preserve all failing order, account, Stripe, Woo, LearnDash, and browser
   evidence without exposing secrets or student data.

The four offer-specific options are:

- `mmed_mr_0912_interview_week_verified_live_at`;
- `mmed_mr_0912_interview_week_acceptance_binding_sha256`;
- `mmed_mr_0912_complete_verified_live_at`;
- `mmed_mr_0912_complete_acceptance_binding_sha256`.

The legacy September 4 `mmed_mr_p0_verified_live_at` value is not MR-WEB-0912
acceptance and must not reopen either offer.

## Controlled $0.50 order containment

The live-card controller is:
`evidence-scripts/mr-web-0912-live-card-lifecycle.php`.

Its reviewed SHA-256 is
`3ee54ba3417efb26cf7d413861fa3b4c5aa8c4a1d45c48556cc996b25be89c0d`.

For a prepared but uncharged order, use its manifest-bound `cancel` mode. It
must verify the exact order, confirm no transaction/payment evidence, cancel
the order, remove temporary-login metadata, destroy all WordPress sessions,
delete any controlled-user Woo payment token, and scrub private URLs.

For any order with a verified live charge, do not cancel or abandon it. Run the
manifest-bound `refund` mode even when paid acceptance failed. The controller:

1. verifies exact manifest, offer, user, order, variation, amount, currency,
   and Stripe charge identity;
2. records paid acceptance PASS/FAIL without using it as a refund gate;
3. immediately issues or verifies the idempotent full Stripe refund;
4. creates or reconciles the native Woo full refund;
5. verifies entitlement revocation and unrelated-course preservation;
6. destroys sessions and removes temporary credentials, private URLs, and Woo
   payment tokens;
7. returns overall FAIL unless both paid acceptance and post-refund containment
   pass.

The state machine supports safe rerun when Stripe is already fully refunded but
Woo has not yet recorded the refund. Any partial Stripe amount, partial Woo
amount, product/order identity mismatch, or unknown charge identity is a hard
stop for manual containment. Never create a second refund or replacement order
to hide an unresolved partial state.

## Scoped source restoration

Only if the fail-closed source itself is defective:

1. clear both offer-specific acceptance pairs and close both product variations;
2. restore `wp-content/mu-plugins/missionmed-mr-p0.php` from the exact private
   source preimage;
3. restore or remove only the MR-WEB-0912 asset files according to the recorded
   preimage;
4. verify byte hashes before and after the atomic source switch;
5. purge only affected Mission Residency/product/cart/checkout caches;
6. repeat the logged-out route and direct-cart denial sweep.

The currently deployed MR-WEB-0912 source hashes are:

- plugin: `04ab7d2bbffbd692bec386ac401bf3c24eba4abb8b4289f9938273801e661235`;
- config: `ee1db70bdfda3ec0e5141e83456cc3cd1cf09adf5c3650b8e36d3a6e4eea099d`;
- CSS: `743c70b75968e30c251bcdd1619cb2cb21fd8835bbbcd9b52cb85c1ca47b93e2`;
- JavaScript: `64b36ab289d0e2fe355ac91b5a1a2c4369148a1346a47b8ab53bd8eadad5e1d0`;
- offer page: `9aaabfa8a0db5c5af663282b4b78410444fa9802f6d875362bfd0ac565be5216`.

## Scoped production-data restoration

Restore only affected objects from the mode-0600 object preimage:

1. product/variation 5504 and 5867;
2. product/variation 3576 and 5865;
3. course 3646 and 5227 title/content/mapping values;
4. only MR-WEB-0912 route and activation options;
5. any future approved coupon, payment-plan, credit, onboarding, Calendar, or
   Webex object actually created by a later tranche.

Do not touch 360 objects except to verify they remain closed. Re-read titles,
prices, stock, parent IDs, exact mappings, option values, and hashes after
restoration.

## Provider restore boundary

Use the provider-native recovery point only if exact source/object restoration
cannot recover production safely. Before any provider restore, preserve and
reconcile every order, refund, account, entitlement, and unrelated production
change created after the snapshot. A provider restore requires separate
explicit authority and must not silently erase commerce or student state.

## Post-containment acceptance

After containment or rollback:

1. prove both affected offers are closed unless separately reaccepted;
2. verify public product data and direct/stale cart denial;
3. run the complete logged-out route/viewport sweep;
4. verify unrelated student access and 360 closure;
5. verify no coupon, credit, Zelle, or installment path became available;
6. obtain fresh independent production verification;
7. commit a forward-history rollback receipt with exact state deltas and hashes.
