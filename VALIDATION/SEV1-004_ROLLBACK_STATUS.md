# SEV1-004 Rollback Status

**Date:** 2026-06-15
**Rollback readiness:** READY

## Production File Changed

- `/www/theresidencyacademy_209/public/wp-content/mu-plugins/missionmed-launch-sev1-fixes.php`

Current deployed SHA256:

- `f2830b42fb16f604f96590f31f892294484082349b188b791845c4523eb91928`

No WooCommerce product data, checkout, payments, users, LearnDash, Matrix, Scheduler, Arena backend, Railway, or database state was changed.

## Production Backups

Backup folder:

- `/www/theresidencyacademy_209/missionmed_deploy_backups/MM-LAUNCH-SEV1-004-20260615T142436Z/`
- `/www/theresidencyacademy_209/missionmed_deploy_backups/MM-LAUNCH-SEV1-004-FINAL-20260615T185828Z/`

Backups recorded:

- `missionmed-launch-sev1-fixes.before.php`
- `missionmed-launch-sev1-fixes.after-first-patch.php`
- `missionmed-launch-sev1-fixes.before-final-button-convert.php`
- `missionmed-launch-sev1-fixes.before-relative-href-fix.php`

Recommended rollback source for reverting only the final relative-href correction:

- `/www/theresidencyacademy_209/missionmed_deploy_backups/MM-LAUNCH-SEV1-004-FINAL-20260615T185828Z/missionmed-launch-sev1-fixes.before-relative-href-fix.php`

Recommended rollback source for reverting all SEV1-004 watch-item cleanup changes:

- `/www/theresidencyacademy_209/missionmed_deploy_backups/MM-LAUNCH-SEV1-004-20260615T142436Z/missionmed-launch-sev1-fixes.before-final-button-convert.php`

## Rollback Steps

1. Copy the appropriate recommended backup over the live mu-plugin. For final-patch-only rollback:

   ```bash
   cp /www/theresidencyacademy_209/missionmed_deploy_backups/MM-LAUNCH-SEV1-004-FINAL-20260615T185828Z/missionmed-launch-sev1-fixes.before-relative-href-fix.php /www/theresidencyacademy_209/public/wp-content/mu-plugins/missionmed-launch-sev1-fixes.php
   ```

   For full SEV1-004 rollback:

   ```bash
   cp /www/theresidencyacademy_209/missionmed_deploy_backups/MM-LAUNCH-SEV1-004-20260615T142436Z/missionmed-launch-sev1-fixes.before-final-button-convert.php /www/theresidencyacademy_209/public/wp-content/mu-plugins/missionmed-launch-sev1-fixes.php
   ```

2. Run PHP lint on the restored file:

   ```bash
   php -l /www/theresidencyacademy_209/public/wp-content/mu-plugins/missionmed-launch-sev1-fixes.php
   ```

3. Clear WordPress/Kinsta/Autoptimize caches.

4. Revalidate:

   - `/mission-residency/`
   - `/homepage-arena/`
   - `/arena/`
   - `/red-flag-match-stories/`
   - `/mission-residency-courses/`
   - `/what-alumni-said/`
   - legal pages

## Rollback Triggers

Rollback if any of these appear:

- Public fatal error/white screen on launch pages.
- Legal pages no longer return 200.
- Woo Store API prices change unexpectedly.
- Mission Residency or Arena CTAs break primary launch paths.

## Current Status

Rollback is not required. Live validation passed with remaining admin decision items documented.
