# P1 RISE 4006 Rollback And Recovery

## Current Rollback Point

No production change occurred. The exact rollback point is the existing state at base commit `9c1fa72e6b056db8b6fe0e17031fcaa688f78569`, with no RISE route, service, schema, asset, or release activation. Recovery requires no production action.

## Candidate Rollback

The candidate implementation is commit `8549c84a675a8b8a8026850330a3155bf9ed720a` on isolated review branch `codex/p1-rise-4006-production`. Removing or closing that branch has no production effect. Generated `rise/dist` and registry outputs are ignored and are not deployment state.

## Proposed Future Layered Rollback

1. Disable the WordPress RISE capability/route while preserving audit evidence.
2. Pin the prior immutable R2 web manifest.
3. Redeploy the prior RISE service image only.
4. Atomically reactivate the prior immutable registry release.
5. Disable Matrix, ACTN, CAM, or StoryForge adapters independently.
6. Restore the dedicated RISE database from its pre-migration backup only if forward recovery is unsafe.
7. Re-run RISE and ecosystem gates before re-opening access.

Both proposed schema down migrations intentionally raise an exception instead of deleting registry, consent, session, audit, or recovery history. Disposable PostgreSQL rehearsal proved atomic prior-release registry rollback and destructive-down refusal. It did not rehearse a production backup restore or service/asset rollback.

## Recovery Evidence Required Before A Future Release

- immutable prior asset and service identifiers
- pre-migration database backup and restore rehearsal
- prior registry activation pointer
- scoped WordPress capability rollback
- adapter feature flags
- deploy and rollback command receipts
- post-rollback live and ecosystem smoke results

**Rollback verdict:** `NO_OP_VERIFIED_FOR_THIS_RUN_FUTURE_PLAN_NOT_YET_REHEARSED`
