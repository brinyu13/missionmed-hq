# Exact section rollback

Baseline source: b4fb762a9861ef3221c77f0805546fd97ee4dbb2. Restores the previous Matrix section while preserving the accepted human-proof and live Match Day video release.

Fresh production archive: `/www/theresidencyacademy_209/private/mr-matrix-ecosystem-0930/preimage/`.

Under a fresh exact-path lease, drift-check the current page/CSS against `qa/deployment.json`, then atomically restore only:

- `page.php`: SHA256 `5bd1094fa1e4584088165b09d16f503a3825a703de2f3ba261eaad7ecaa7af66`
- `alternate.css`: SHA256 `625608f3bd2964104a299c1b149672a5558c82323052405b6a8bac1bbddd5da7`

Runtime directory: `/www/theresidencyacademy_209/public/wp-content/mu-plugins/missionmed-mr-alternate-assets/`.

The six newly added `media/ecosystem-*` WebP derivatives become unused; they may remain safely unreferenced. Do not delete unrelated media or restore a database. Purge existing Kinsta site cache, verify anonymous page/asset hashes, legacy redirect and both existing product links. Release lease and read back provider-clear.

Provider backup read back September 30: MissionMed Live manual backup Sep 29, 2026 8:35 PM, note `Pre premium hero release 2026-09-29`, expiration Oct 13, 2026 8:35 PM, Restore to control available. No backup mutation. The fresh exact file archive, not a broad database/site restore, is the rollback for this change.

Scope excludes pricing, Woo, Zelle, Stripe, orders, entitlements, Matrix/On-Call product source, routing, homepage and USCE.
