# MR-WEB-0912 Foreman rollback

Rollback is scoped and ready. Do not restore the entire database.

1. Re-run Universal and MR-WEB-0912 BOOT, verify authority, and obtain a fresh exact PATH lease.
2. Assert the current production hashes listed in `STATE_DELTA.md`; stop on drift.
3. Restore the five captured source preimages from `/www/theresidencyacademy_209/private-backups/MR-WEB-0912-FOREMAN-20260921T0805Z/source/`.
4. Restore B `site.css` from Git object `c2dbc21c8cc83d82751739c03ac9d279017fc24b:wp-content/mu-plugins/missionmed-mr-0912-assets/b-immersive/styles/site.css`; expected SHA-256 `32187a77b50a76d2ebc557edf041cb62cf4a2ee9641921947f250b9167cd6617`.
5. Restore only the Woo/object preimages for parents `3576/5504/5513`, variations `5865/5867/5873`, term `66`, and the two release options using `evidence/wp-preimage.json`.
6. Purge Kinsta cache, re-read exact hashes/runtime, release the lease, and verify provider clear.

Do not touch orders, payments, customers, unrelated products, historical entitlements, or unrelated dirty work. The final-email date patch is outside Git and can be rolled back from its separately retained predecessor only if Founder direction requires it.

## Financial-closeout and CART rollback

- Exact pre-closeout and intermediate plugin preimages are retained in `/www/theresidencyacademy_209/private/mr-web-0912/20260921-founder-reversal-live-card-v2/` with mode `0600`.
- The pre-financial-closeout plugin SHA is `6868952c3c40ad79a04c10d256089d3fcf5b153f1d370852c8f5fe3d842cfb16`; final production SHA is `7a60cad77fb3407b97cf56d3fe1a08d7db17776549b2f2bff8487f3fcb3650ad`.
- The removed bridge is retained privately only for forensic rollback. Do not redeploy it without a new exact Founder-authorized controlled test.
- The three live-acceptance options may be reverted only together with the corresponding runtime source and only if the acceptance record itself must be rolled back; the two already-refunded orders must never be reopened or recharged.
- Removing the persistent CART control requires restoring the immediately preceding plugin preimage under the exact source PATH lease, purging Kinsta cache, and re-running the 1440/1024/390 funnel checks.
