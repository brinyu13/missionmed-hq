# MR-WEB-0912 Rollback

Current status: **no production changes to roll back**

## Source-only rollback

The candidate is additive except for the bounded
`wp-content/mu-plugins/missionmed-mr-p0.php` update. Before merge, discard the
candidate by abandoning the branch. After a commit is shared, use a normal
forward `git revert <candidate-commit>`. Do not reset, rebase, clean, stash,
force-push, or copy from the unsuitable/dirty donor worktrees.

## Required preimage set before any later production apply

Capture immediately before mutation:

- fresh provider-native backup identity, timestamp, label, and visible restore control;
- live MU plugin and affected asset bytes plus SHA-256;
- `mmed_mr_p0_enabled`, old acceptance option, and the four per-offer options:
  `mmed_mr_0912_interview_week_verified_live_at`,
  `mmed_mr_0912_interview_week_acceptance_binding_sha256`,
  `mmed_mr_0912_complete_verified_live_at`, and
  `mmed_mr_0912_complete_acceptance_binding_sha256`;
- product/variation 5504, 5867, 3576, 5865 exact titles, slugs, status,
  visibility, stock, prices, attributes, descriptions, and `_related_course`;
- relevant gateway settings without secrets;
- all relevant coupon rules without exposing code text publicly;
- course 3646/5227 titles, steps, access settings, and onboarding references;
- affected Calendar/Webex object identities and hashes;
- rendered homepage, division, comparison, product, cart, and checkout preimages.

Store object preimages outside the web root with restrictive permissions. Record
hashes in the mutation ledger. Do not replace the database wholesale.

## Immediate containment

If any post-apply check fails:

1. clear all four `mmed_mr_0912_interview_week_*` and
   `mmed_mr_0912_complete_*` acceptance options;
2. disable new checkout CTAs;
3. stop new orders on the affected variations without touching existing orders;
4. preserve the failing order/account/entitlement evidence.

## Scoped restoration

Restore only affected objects from exact preimages:

1. MU plugin and the four MR-WEB-0912 asset files;
2. route and activation options;
3. the four product/variation records and exact course mappings;
4. new coupon or payment-plan objects, if a later approved tranche created them;
5. new onboarding/Calendar objects, if a later approved tranche created them.

Re-read hashes and object values after restoration. Purge only the necessary
page/CDN cache after source truth is restored.

## Provider restore boundary

Use the provider-native recovery point only if exact scoped restoration fails.
Before provider restore, reconcile and preserve every order created after the
snapshot. A provider restore must not erase or silently alter orders, refunds,
accounts, entitlements, or unrelated MissionMed work.

## Post-rollback acceptance

Run the full unauthenticated route sweep, verify checkout is closed or restored
to the exact prior offer, confirm existing student access is preserved, confirm
no new coupon/credit can apply, and obtain independent verification. Record a
new forward-history rollback receipt.
