# SEV1-005 Rollback Status

**Date:** 2026-06-15
**Rollback readiness:** READY

## Production Changes

1. Woo product `3577` catalog visibility changed from `visible` to `hidden`.
2. Production mu-plugin updated to exclude product `3577` from public Woo Store API product collection/search responses.

No pricing, checkout, payments, users, orders, LearnDash, Matrix, Scheduler, Arena backend, or product status/title/slug change was made.

## Backup Folder

- `/www/theresidencyacademy_209/missionmed_deploy_backups/MM-LAUNCH-SEV1-005-20260615T210909Z/`

## Backup Files

- `product-3577-post.before.json`
- `product-3577-postmeta.before.json`
- `product-3577-terms.before.json`
- `product-3577-post.after.json`
- `product-3577-postmeta.after.json`
- `product-3577-terms.after.json`
- `missionmed-launch-sev1-fixes.before-store-api-filter.php`

## Rollback Options

### Option A: Roll Back Store API Collection Filter Only

Use this if product `3577` should remain hidden in Woo catalog/search but should reappear in default Store API collection/search responses.

```bash
ssh missionmed-kinsta 'cp /www/theresidencyacademy_209/missionmed_deploy_backups/MM-LAUNCH-SEV1-005-20260615T210909Z/missionmed-launch-sev1-fixes.before-store-api-filter.php /www/theresidencyacademy_209/public/wp-content/mu-plugins/missionmed-launch-sev1-fixes.php && php -l /www/theresidencyacademy_209/public/wp-content/mu-plugins/missionmed-launch-sev1-fixes.php'
```

### Option B: Roll Back Woo Catalog Visibility Only

Use this if product `3577` should become catalog/search visible again while keeping the SEV1-005 mu-plugin code.

```bash
ssh missionmed-kinsta 'cd /www/theresidencyacademy_209/public && wp eval '\''$p = wc_get_product(3577); $p->set_catalog_visibility("visible"); $p->save(); if ( function_exists("wc_delete_product_transients") ) { wc_delete_product_transients(3577); } clean_post_cache(3577); echo "product_3577_visibility_visible\n";'\'''
```

### Option C: Full SEV1-005 Rollback

Run Option A, then Option B, then clear caches.

```bash
ssh missionmed-kinsta 'cd /www/theresidencyacademy_209/public && wp cache flush || true'
```

After any rollback, revalidate:

- `/product/interview-prep-foundation/`
- `/wp-json/wc/store/v1/products?search=Interview%20Prep%20Foundation&per_page=20`
- `/wp-json/wc/store/v1/products?per_page=100`
- `/wp-json/wc/store/v1/products/3577`
- main product Store API prices for `5504`, `3576`, `3575`

## Rollback Trigger Review

| Trigger | Observed? | Notes |
|---|---:|---|
| Fatal error / white screen | No | Product page, courses page, Store API, and `/wp-admin/` returned nonfatal responses |
| Price changed unexpectedly | No | Main prices and product `3577` price unchanged |
| Checkout/payment/order impact | No | No checkout/payment/order commands were run |
| Product direct access lost | No | Direct product URL and direct Store API by ID remain 200 |
| LearnDash impact | No | Linked course metadata inspected only |

## Current Status

Rollback is not required. SEV1-005 validation passed.

