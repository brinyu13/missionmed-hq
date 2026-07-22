# P1-RISE-4006 Rollback Readiness

## Verdict

**Code and release mechanics: REHEARSED**
**Production rollback readiness: PARTIAL / NO DEPLOYMENT EXISTS**

No production system changed in this run, so there is nothing to roll back in WordPress, Cloudflare, Railway, MissionMed OS, Supabase, HQ, Matrix, ACTN, CAM, StoryForge, or a production RISE database.

## Current Rollback Points

| Boundary | Rollback point |
| --- | --- |
| Candidate implementation | `7c415489bdfacf596778d54eb07b050f5c8e94b9` |
| Candidate parent | `54d0090b35340180bdc6699ff9131c9268840e22` |
| Prior core implementation | `8549c84` |
| Production deployment | None |
| Production database backup | None, because no approved RISE production database exists |
| Production asset | None |
| Production route | Unprovisioned 404 |

## Verified Release Rollback

The disposable PostgreSQL rehearsal activated release A, promoted release B, and restored release A with `rise.set_active_registry_release(..., 'rollback', ...)`. The active pointer, lifecycle state, and activation history remained consistent. The final state contained three immutable activation-history rows and release A active.

The down migrations intentionally refuse destructive schema deletion or evidence weakening. They are not a substitute for operational release rollback.

## Code Rollback Procedure

Before any future deployment, the release operator must preserve the currently deployed image and commit. If this candidate later needs to be withdrawn, create a reviewed revert of implementation commit `7c415489bdfacf596778d54eb07b050f5c8e94b9` or redeploy the previously approved immutable image. Do not move a protected branch or force-push history.

## Required Pre-Deployment Backup Set

Deployment remains blocked until an approved operator captures and verifies:

- dedicated RISE database backup with immutable reference and SHA-256;
- successful restore rehearsal with measured RPO and RTO;
- currently deployed Railway image and environment snapshot;
- current WordPress route and plugin state;
- current Cloudflare route, cache, firewall, and rollback configuration;
- current HQ auth behavior and cookie settings;
- active RISE registry release, source authorization set, validation receipt, and activation ID;
- scoped artifact-store version and manifest;
- cross-product smoke baseline.

## Required Rollback Sequence

1. Stop new RISE traffic at the scoped edge route without changing unrelated MissionMed routes.
2. Redeploy the previously approved immutable RISE image and asset manifest.
3. Atomically restore the previous registry release through the release-manager function.
4. Confirm source authorization and activation receipts still validate for the restored release.
5. Verify HQ login, public signed-out state, registry reads, and no cross-product regression.
6. Preserve audit and incident evidence; do not delete the failed release.
7. Reopen traffic only after health, browser, security, and owner checks pass.

This procedure is credible at the application layer, but it is not production-proven until the actual owners, topology, backup, and previous image exist.
