# 3528C Rollback

## Railway rehearsal — PASS

The public Railway GraphQL `deploymentRollback` mutation was used; no source rebuild or database destruction was involved.

1. Current pre-rehearsal deployment: `a07830da-cce2-4dd6-8333-fc08fa711554`, image `sha256:dba943d20...`.
2. Rolled back to known-good deployment `89cc9ba6-58f7-4b57-be60-bbddf12d32eb`, image `sha256:be571da5...`.
3. Railway created rollback deployment `06d5c9b3-019c-4940-bff0-f156a4830949`; state reached `SUCCESS`; `/health` returned `200`.
4. Reapplied the exact current artifact by rolling back to `a07830da...`.
5. Railway created `646ac336-9afd-4db5-9ac1-cdaa20ab12a3`; state reached `SUCCESS`; `/health` returned `200`; anonymous IV Prep access returned canonical `401`.

No production rows or recordings were dropped. The additive migration remains in place by design.

## Matrix rollback readiness

The exact preimages are stored in the two guarded backup directories listed in `3528C_MATRIX_DEPLOYMENT.md`, and deployed bytes match the recorded approved hashes. A Matrix restore/reapply was not executed after the live click-through passed; doing so would add production shell risk without changing the isolated CDN blocker. Recovery is exact-file copy from the guarded backup followed by hash verification and no broad cache purge.

## Data rollback rule

Do not drop the six additive tables during ordinary code rollback. Preserve sessions/results/recording metadata. A schema reversal requires a separate data-retention decision record.
