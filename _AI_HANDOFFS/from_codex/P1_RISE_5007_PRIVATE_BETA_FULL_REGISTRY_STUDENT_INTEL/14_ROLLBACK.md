# 5007 Rollback

No 5007 production mutation occurred, so the immediate rollback action is **none**. Production is already on the prior verified 5006 release.

For a future authorized 5007 deployment:

1. Capture current WordPress/HQ/RISE deployment IDs, image hashes, variables, schema version, and database backup before change.
2. If a mandatory smoke fails, restore the prior WordPress RISE plugin and HQ deployment, then redeploy the prior isolated RISE image/build.
3. Do not delete Student Intel tables or rows. Apply `rise/sql/006_student_intel.down.sql` only to revoke runtime privileges while preserving submissions, identities, sources, audits, corroborations, verification history, and promotion candidates.
4. Do not roll back migration 005 or restore the database volume unless independent corruption is confirmed and an explicit incident decision authorizes destructive restore.
5. Re-run anonymous/authenticated route, health, unrelated-product, database, and row-preservation checks.

Current 5006 rollback authority remains:

- `_AI_HANDOFFS/from_codex/P1_RISE_5006_RELEASE_CONDITIONS_REMEDIATION/09_ROLLBACK.md`
- locked database backup `b950cadf-124c-4d64-84a9-02c28fefc7bc`
- pre-5006 shared HQ deployment `98bf0bda-5d96-4c1f-a243-e2a692210e66`
- pre-5006 RISE deployment `4d66f58f-b7e8-406c-bae8-2e7e621f462d`

Disposable rehearsal proved that the 006 down migration leaves both a submission and its private identity row intact.

ROLLBACK_READY = YES
