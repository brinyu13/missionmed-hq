# 3528C Rollback

## Railway mechanism rehearsal — PASS

The public Railway `deploymentRollback` mutation was previously used without source rebuild or database destruction:

1. The prior 3528C artifact was rolled back to known-good deployment `89cc9ba6-58f7-4b57-be60-bbddf12d32eb`, image `sha256:be571da5...`.
2. Railway created `06d5c9b3-019c-4940-bff0-f156a4830949`; it reached `SUCCESS`; `/health` returned `200`.
3. The exact then-current artifact was reapplied as `646ac336-9afd-4db5-9ac1-cdaa20ab12a3`; `/health` returned `200`; anonymous IV Prep access returned canonical `401`.

The private R2 repair is now deployed separately as `33ed7dcd-41cb-410d-a309-29e3d019065c`, image `sha256:8fb93c570ed5fef6c98115851466be2cf86ae7981000bc1b40d9a4f5d62159d6`. Health, anonymous denial, real storage, Library, and replay pass. This exact new artifact was not rolled back/reapplied again; the Railway rollback mechanism is rehearsed, while artifact-specific re-rehearsal remains pending if required.

No production rows or recordings were dropped. The additive migration remains in place by design.

## Matrix rollback readiness

The exact preimages are stored in the two guarded backup directories listed in `3528C_MATRIX_DEPLOYMENT.md`, and deployed bytes match the recorded hashes. A Matrix restore/reapply was not executed after live click-through. Recovery is exact-file copy from the guarded backup followed by hash verification and no broad cache purge.

## Data rollback rule

Do not drop the six additive tables during ordinary code rollback. Preserve sessions, results, and recording metadata. A schema reversal requires a separate data-retention decision record.
