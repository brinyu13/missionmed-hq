# Additive alternate rollback - do not roll back primary

Target prior state: `/missionresidency/` absent/404. `/mission-residency/` stays at its current refined montage implementation. USCE and commerce stay unchanged.

1. Re-read current MissionMed BOOT and acquire the narrow alternate-path lease. Confirm no newer owner/release replaced these files.
2. Verify runtime `wp-content/mu-plugins/missionmed-mr-alternate.php` SHA256 is `290ccda21873122c17447ce17cd4d43c6220c3f5445b8d949406c4fddeba8756`. If it differs, stop and inspect current authority; do not overwrite another release.
3. Preserve the active handler and assets in a new, uniquely named directory beneath `/www/theresidencyacademy_209/private/mr-usce-alternate/`. Move only the exact handler outside `mu-plugins`; do not delete it. Retain the assets/source for diagnosis. No database changes are needed.
4. Purge only `/missionresidency/` and `/missionresidency` through the existing Kinsta exact-URL purge mechanism. Do not purge primary/global cache.
5. Verify alternate prior 404, primary 200 with unchanged montage/source hashes, USCE 200, existing card/Zelle product links still load. No money movement.
6. Record moved file path/hash, current exact-state delta, release scoped lease and verify provider readback.

Known custody: `/www/theresidencyacademy_209/private/mr-usce-alternate/842dd85/`, initial source archive/candidate, `alternate-pre-c57cd22.js` and final `alternate-c57cd22.js`. The JS-only fix can be rolled back to its captured preimage if that is the specifically approved recovery target; hash-guard the current JS (`f269f59fb75ea9f3240611dafa6cd3e822164f47f5d236ed958c4af4d27fb176`) first and preserve current source.

Do not restore the provider's older whole-site backup to remove this additive release. It predates the protected primary refinement. Never touch orders, payments, entitlements, products, USCE, primary files or unrelated dirty repositories during this rollback.
