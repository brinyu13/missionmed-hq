# Rollback

## Provider backups

Primary enrollment deployment:

`/www/theresidencyacademy_209/private/codex-backups/DRJ-EXAMPREP-0921C/20260921-091955-enrollment`

Purchase-success deployment:

`/www/theresidencyacademy_209/private/codex-backups/DRJ-EXAMPREP-0921C/20260921-085244`

Scoped mobile-warning polish preimages:

`/www/theresidencyacademy_209/private/codex-backups/DRJ-EXAMPREP-0921C/20260921-095145-mobile-overlay`

Incremental commerce preimages:

- `missionmed-drj-examprep-commerce-pre-anon-bundle-fix.php`
- `missionmed-drj-examprep-commerce-pre-bundle-context-fix.php`
- `missionmed-drj-examprep-commerce-pre-wcs-cache-fix.php`
- `missionmed-drj-examprep-commerce-pre-live-product-bridge.php`
- `missionmed-drj-examprep-commerce-pre-live-selector-fix.php`

## Safe rollback order

1. Acquire the same protected production path lease.
2. Confirm the current live SHA before replacing any file.
3. Restore only the affected MU plugin from its immediate preimage.
4. Restore the product metadata JSON from the enrollment backup only if the product mutation itself must be reverted.
5. Flush WordPress/object/page caches.
6. Re-run read-only cart, entitlement, schedule, and family-routing acceptance.

Do not delete or refund order `9148` as part of a code rollback. Do not reactivate subscription `9149`, subscription `9144`, or `DRJFOUNDER1` unless the Founder explicitly requests that separate commerce action.
