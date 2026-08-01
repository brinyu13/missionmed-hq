# B1-510I Backup, Restore, and Rollback

## Local/private backup

Root: `/Users/brianb/MissionMed_private_backups/B1-510I/B1-510I-RP-20260801T173127Z`

The root is mode 0700 and backup files are mode 0600.

- PostgreSQL 18 custom dump SHA-256: `c8a8c792b5bae68abc97c142d1be135d574ef526dee905fe738127cb3e52a357`
- isolated restore receipt SHA-256: `237b43f330c227848e3e505648fb6489dc4bade03557e64a5f39434bf52eb560`
- production summary SHA-256: `4bce95e11e7a1856f17aa837eabf5cb22d9eb04b514c1be1bebc60e280958b7d`

The dump restored successfully into disposable PostgreSQL 18 with the required roles. Counts verified after restore: `sf_users=441`, `eligible_students=440`, `stories=6`, feature flag `allowlist:1:0`, schema integrity PASS.

## Provider backup

Kinsta backup note: `B1-510I pre Phase A voice parity 2026-08-01`, created Aug 1, 2026 at 1:30 PM EDT, expiring Aug 15, 2026 at 1:30 PM EDT.

Kinsta private pre-change root:
`/www/theresidencyacademy_209/private/b1-510i/B1-510I-RP-20260801T173127Z`

WordPress StoryForge settings were drained only for guarded rollback verification and restored with identical PHP-serialization semantics. Semantic SHA-256 before/after: `7baf01f81d08e756bee3554be838cb3933587217e622603bdf81f4a65a870701`.

## Rollback receipts

- static rollback receipt: `/www/theresidencyacademy_209/private/b1-510i/rollback/B1-510I-PHASEA-20260801T174800Z/rollback.tsv`
- receipt SHA-256: `1af260b31a26281c62dd2eb4f6e8558a5c6fdb1f1ba535077576410fa8edd5f1`
- guarded static rollback preflight: PASS after the required temporary feature drain
- feature rollback: audited `eligible_all -> allowlist`, verified `allowlist:1:0`
- database restore: not used; no corruption occurred

The Kinsta cache helper returned an unexpected response/exit 139 after publication. Independent public hashes proved the exact release bytes, so no speculative cache mutation was attempted.
