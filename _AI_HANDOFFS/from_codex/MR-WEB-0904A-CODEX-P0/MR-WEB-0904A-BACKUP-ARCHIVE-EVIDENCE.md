# MR-WEB-0904A backup and archive evidence

Verification timestamp: 2026-09-04T11:22Z

## Gate result

`LOCAL_ENCRYPTED_RECOVERY_SET = PASS`

`ELEMENTOR_OFFSERVER_EXPORT = PASS`

`PROVIDER_NATIVE_SNAPSHOT = FAIL`

`DR-180 BACKUP GATE = FAIL`

No production mutation was performed. A current, encrypted, independently stream-restored local recovery set now exists, but the strict production gate also requires a verifiable MyKinsta snapshot. The MyKinsta browser session was logged out, so no snapshot ID, timestamp, or restore-to-staging readback could be obtained.

## Verified recovery set

Protected local directory (mode 0700):

`_AI_HANDOFFS/from_codex/MR-WEB-0904A-CODEX-P0/protected-backup/20260904T104042Z/`

Active ciphertext files are mode 0600, AES-256-CBC salted, PBKDF2 with 600,000 iterations. The passphrase is derived in process from the protected Kinsta SSH private-key SHA-256 plus the literal backup context; it was not persisted.

| Artifact | Bytes | Ciphertext SHA-256 | Restore check |
|---|---:|---|---|
| `database.sql.gz.enc` | 34,370,672 | `2cee239555e34cfe0ac3f99a4d5c93c3d96837c0a0c9f8d2b00c6a64b59eb0ee` | PASS: 132 tables and dump completion marker |
| `public-root.tar.gz.enc` | 1,988,450,976 | `0325540b1ceb78d750be4c05a89e905c0ca92dbc5d56263c450f4a98c7905a88` | PASS: 72,885 archive members, including `wp-config.php` and `wp-content/` |
| `public-root-files.sha256.enc` | 9,891,344 | `f6865add316a19567e76595faf74482ba454eefd0836108d64e7b977f0e17e4f` | PASS: 61,213 valid per-file SHA-256 records |
| `elementor-pages.json.gz.enc` | 18,300,976 | `0b5035f35f28718697ab080f493a9a150b01f1a1a0378d0519a86b52b6b0de6c` | PASS: pages 3305 and 5686 plus 288 revisions |
| `commerce-config.json.gz.enc` | 466,368 | `6f0e978401ad9abfa4a8c984bc0d8fa6c7479742f25a65790542132d4393e9a1` | PASS: selected products/variations/courses, 109 settings, membership/coupon records, and 87 snippets |

All restore checks decrypted to a pipeline only; no plaintext backup was written to disk. Exact metadata and the restore-key contract are in `backup-manifest.json` and `BACKUP-RESTORE-VERIFICATION.md` inside the protected directory.

An initial ciphertext set whose restore-key derivation could not be reproduced was retained under `unverified-key-artifacts/` and excluded from every recovery claim. The active set above was recreated with the documented derivation and then restored as streams.

## What the local set does not prove

- It is not provider-native or atomic.
- It does not prove MyKinsta redirects, Nginx settings, DNS, account configuration, or provider restoreability.
- It does not replace the required private/draft page copies and named `LEGACY_...` Elementor templates immediately before a production edit.
- No current staging clone or restore rehearsal was available.

## Remaining backup gate

Before a production attempt, authenticate to MyKinsta, create a manual backup, record its provider ID and timestamp, and preferably restore it to a non-production environment. Then create the private/draft full-page archives and named legacy module templates under the same bounded mutation tranche.

## Browser evidence inventory

All captures are pre-mutation evidence. They were taken in clean, isolated browser contexts; no authenticated or private browser content is present.

| File | URL / purpose | UTC capture | Pixels | SHA-256 |
|---|---|---|---:|---|
| `screenshots/live-home-before.png` | `https://missionmedinstitute.com/` | 2026-09-04T11:15:25Z | 1440×1200 | `e726c403a80e0206375fa52bd2c2c1367af95bc5d89fbae7bef55032d9dba8f4` |
| `screenshots/live-mr-before.png` | `https://missionmedinstitute.com/mission-residency/` | 2026-09-04T11:15:27Z | 1440×1200 | `92abf8fd2ebdf9a9c759039fd5bc8437411eca0d3e0448a6b97bfe453c8d439f` |
| `screenshots/local-mr-desktop.png` | local Mission Residency, explicitly simulated State A | 2026-09-04T11:30:29Z | 1440×1200 | `98f5b2e1784de5dc6e98d3b4ec89e5c49780686b8779be46e2847366d8c93d44` |
| `screenshots/local-mr-mobile.png` | local Mission Residency, explicitly simulated State A | 2026-09-04T11:30:29Z | 390×844 | `b4738f875c4c93fa9c36cfa6167f2ebb670760d1c1bfd8195a12e68cdea84483` |
| `screenshots/local-complete-mobile.png` | local Complete, explicitly simulated State A | 2026-09-04T11:30:29Z | 390×844 | `6a5a415433d5d4f2735efe4b797972a62ce9e3f92cabb9e661dc8bee938e359b` |
| `screenshots/local-essentials-mobile.png` | local Essentials, explicitly simulated State A | 2026-09-04T11:30:29Z | 390×844 | `34a508e7791b16d20aa3976dbac0641f9d93815b10c2620f64996f3935ed8062` |

Three earlier captures accidentally contained a private ChatGPT project and were invalid. The remote branch carrying them was immediately deleted. The files above replace them, and the published branch is rebuilt from the clean base so those images are absent from its reachable history.
