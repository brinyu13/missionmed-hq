# Rollback

Primary rollback target: Railway deployment `7343c8cc-476a-4c0a-a6c9-675a43a03348`.

Rollback identity:

- Build ID: `rise_web_47e0a18a492a`
- Asset manifest: `96ac32b0c25d8643cde60a8ea294e6c60ded2b08536c4d902471eef97e3d69fa`
- Image: `sha256:c838fc98fa1534e865a9aec4536702ab78e35ea74d587a349843f7636dd60512`

Application rollback is a Railway redeploy of that exact prior successful image/configuration, followed by direct health readback and normal `/rise/` browser QA. Migration 010 is intentionally additive and its checked-in down migration refuses destructive evidence deletion. A runtime rollback may stop consuming the new projection while retaining review events, promotion lineage, and canonical evidence for later recovery.

If database restoration were ever required for disaster recovery, the pre-migration dump is checksum-pinned in the deployment receipt. It is not the normal rollback path because destructive database reversal would discard durable evidence custody.
