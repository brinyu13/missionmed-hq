# MR-WEB-0912 Foreman rollback

Rollback is scoped and ready. Do not restore the entire database.

1. Re-run Universal and MR-WEB-0912 BOOT, verify authority, and obtain a fresh exact PATH lease.
2. Assert the current production hashes listed in `STATE_DELTA.md`; stop on drift.
3. Restore the five captured source preimages from `/www/theresidencyacademy_209/private-backups/MR-WEB-0912-FOREMAN-20260921T0805Z/source/`.
4. Restore B `site.css` from Git object `c2dbc21c8cc83d82751739c03ac9d279017fc24b:wp-content/mu-plugins/missionmed-mr-0912-assets/b-immersive/styles/site.css`; expected SHA-256 `32187a77b50a76d2ebc557edf041cb62cf4a2ee9641921947f250b9167cd6617`.
5. Restore only the Woo/object preimages for parents `3576/5504/5513`, variations `5865/5867/5873`, term `66`, and the two release options using `evidence/wp-preimage.json`.
6. Purge Kinsta cache, re-read exact hashes/runtime, release the lease, and verify provider clear.

Do not touch orders, payments, customers, unrelated products, historical entitlements, or unrelated dirty work. The final-email date patch is outside Git and can be rolled back from its separately retained predecessor only if Founder direction requires it.
