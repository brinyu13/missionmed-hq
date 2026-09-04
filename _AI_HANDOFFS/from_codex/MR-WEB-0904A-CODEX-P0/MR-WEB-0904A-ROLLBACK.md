# MR-WEB-0904A rollback plan

## Current condition

There is nothing from MR-WEB-0904A to roll back in production because no production mutation was made.

The current branch can be abandoned or reverted as a normal Git commit without affecting the live site. The unrelated `supabase/.temp/cli-latest` worktree change is outside this task and remains untouched.

A current encrypted local database/public-root recovery set and scoped Elementor/commerce exports passed streaming restore checks under backup ID `20260904T104042Z`. They improve recovery readiness but do not replace a provider-native MyKinsta snapshot or restore rehearsal.

## Required rollback preparation before a future launch attempt

1. Create and verify a provider-native Kinsta snapshot.
2. Re-read and, if production state has changed, refresh the verified encrypted database/public-root recovery set and its hashes.
3. Re-read and, if production state has changed, refresh the edit-context Elementor, WooCommerce, LearnDash, gateway, coupon, and snippet exports.
4. Record every affected ID, slug, status, price, visibility, variation, `_related_course`, membership rule, and page/template revision.
5. Create private/draft page archives and named `LEGACY_...` Elementor templates.
6. Build a mutation ledger mapping each before hash/value to its intended after value.
7. Rehearse restore in a non-production environment.

## Smallest future rollback sequence

1. Disable every newly enabled payment rail or CTA to stop new orders.
2. Restore the exact prior gateway, surcharge, coupon, product, variation, and purchasability settings from the mutation ledger.
3. Restore prior Elementor page/template revisions or the archived `_elementor_data` payloads.
4. Restore the prior enrollment bridge/mapping and verify existing-student access is unchanged.
5. Purge only the relevant WordPress/Kinsta/CDN caches.
6. Run read-only public and authenticated smoke checks.
7. If scoped restoration fails, use the verified Kinsta snapshot and then reconcile any orders created after the snapshot manually before reopening commerce.

## Rollback triggers

Rollback immediately if displayed price differs from charged price, a rail can charge without correct access, 360 or a legacy plan becomes purchasable, existing-student entitlements drift, checkout/receipt/onboarding is wrong, mobile checkout breaks, or live output differs materially from the accepted candidate.

The repository's static R2 rollback script is not a WordPress/Woo/LearnDash rollback mechanism and must not be used as proof for this launch.
