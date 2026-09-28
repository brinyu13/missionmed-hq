# MR Zero-Enrollment Recovery — Preimage and Rollback

## Recovery points

### Provider-native

- Environment: MissionMed Institute — Live.
- Backup type: Daily.
- Created: September 28, 2026 at 9:28 AM as displayed by MyKinsta.
- Retention: 14 days.
- Restore: control present and available.
- Label/note: no custom label is shown for the automatic Daily entry.

### Scoped private package

Path: `/www/theresidencyacademy_209/private-backups/MR-WEB-0912-RECOVERY-20260928T1645Z`

- Directory mode: `drwx------`.
- Database export: 162,092,821 bytes.
- Database SHA-256: `d674b1bb8f90bd63cff9c45ed9a9b6438bbea2bc68afe4f561084f31fb2d43bb`.
- Object preimage: `object-preimage.json`, 119,821 bytes.
- Manifest: `SHA256SUMS`; every entry verified `OK` after deployment.

Preimage source hashes:

| Path | Preimage SHA-256 |
|---|---|
| `wp-content/mu-plugins/missionmed-mr-p0.php` | `7a60cad77fb3407b97cf56d3fe1a08d7db17776549b2f2bff8487f3fcb3650ad` |
| `wp-content/mu-plugins/missionmed-mr-0912-assets/config/campaign-state.json` | `e067c5fc7b91d109009a26ed3fd37c73a266e2b56f623b5bc52b9a9f4c4f2e01` |
| `wp-content/mu-plugins/missionmed-mr-0912-assets/js/mr-0912.js` | `ba63d371f5070ec4439c4cfe6f46ade1c9bbf3a7f738321515341673b0979ad5` |
| `wp-content/mu-plugins/missionmed-mr-0912-assets/b-immersive/scripts/site.js` | `019216ebd82d5146e304fa34f99714c1a9de1734986e022c2311e56dd7b244c3` |

The object ledger includes posts `3576`, `5865`, `5504`, `5867`, `5513`, `5873`, start-date term `66`, and relevant acceptance/config options.

## Preferred scoped rollback

1. Acquire a fresh write lease covering only the four deployed source paths and the six Woo objects, term 66, and affected options.
2. Reconfirm no intervening order/payment/product mutation makes the saved object preimage stale.
3. Restore the four source files from the private package with exact modes.
4. Restore only the fields recorded for posts/variations 3576, 5865, 5504, 5867, 5513, and 5873; term 66; and the exact acceptance/config options from `object-preimage.json`.
5. Flush product transients and purge MyKinsta cache.
6. Verify preimage hashes, product mappings, inventory, and rendered prior funnel.
7. Release the lease and record provider readback.

Do not use a full database import for a normal rollback. It would overwrite unrelated orders, payments, users, entitlements, and concurrent production changes.

## Disaster rollback

Use the MyKinsta provider-native restore only when a scoped source/object rollback is insufficient and Founder/incident authority explicitly accepts the broad blast radius. The restore was not exercised in this run.
