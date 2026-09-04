# MR-WEB-0904C Rollback

Rollback readiness: **PASS**

## Recovery points

- Kinsta Live manual backup at September 4, 2026, 9:10 AM EDT, labeled `MR-WEB-0904B pre-production P0 entitlement + launchBack`.
- Kinsta Live manual backup at September 4, 2026, 1:19 PM EDT, labeled `pre mission res update`.
- Both show a provider-native **Restore to** action and remain available until September 18, 2026.
- Existing encrypted local recovery set remains protected and untracked.

Prefer the bounded rollback below over a full environment restore.

## Route rollback

Use [mr-web-0904c-route.php](evidence-scripts/mr-web-0904c-route.php) in `rollback` mode through `wp eval-file`. It restores the exact preimage at `/www/theresidencyacademy_209/private/mr-web-0904c/route-options-preimage.json` and disables/reverts the live P0 route options as recorded.

## Product rollback

Use [mr-web-0904c-products.php](evidence-scripts/mr-web-0904c-products.php) in `rollback` mode through `wp eval-file`. It restores the exact preimage at `/www/theresidencyacademy_209/private/mr-web-0904c/woo-product-truth-preimage.json`, including product names, status, visibility, prices, stock, descriptions, discount-exclusion metadata, and course mappings.

## File rollback

Exact prior MU plugin and asset copies are stored outside the web root at `/www/theresidencyacademy_209/private/mr-web-0904c/file-preimage/`, including the original release files and the incremental preimages before homepage and link corrections. Restore files with no-clobber verification against the selected preimage, then verify SHA-256.

## Post-rollback checks

1. Run both controller verifiers.
2. Purge Autoptimize, object, Kinsta site/page, and CDN caches.
3. Re-run the no-auth raw and rendered route sweeps.
4. If rollback is due to entitlement failure, disable automated checkout immediately and use the provider restore only if the bounded rollback cannot return the site to a coherent state.

Do not overwrite production with a staging database, delete products, or change product IDs during rollback.
