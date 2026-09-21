# MR-WEB-0912 Foreman preimage ledger

Captured before production mutation on 2026-09-21.

## Recovery and custody

- Existing mission recovery gate: PASS. The current-day MyKinsta recovery point with restore control had already been accepted for this continuing mission. A later browser readback redirected to login, so this report does not invent a second provider-UI verification.
- Exact private backup: `/www/theresidencyacademy_209/private-backups/MR-WEB-0912-FOREMAN-20260921T0805Z`
- Woo/object preimage: `evidence/wp-preimage.json`, SHA-256 `278d9699f5bc0e1d7fbe11a1067c7e6f9c4b42231e1fbba55f75190bb4853480`
- Preimage source hashes are in `evidence/source-sha256.txt` inside the same private backup.
- A prior incomplete `...T0804Z` capture is not a rollback source; it stopped after a WP CLI error and was not used.

## Exact preimage source hashes

| Production object | Preimage SHA-256 |
|---|---|
| `missionmed-mr-p0.php` | `4e481e2e0d62f386dad2e45ad9ef94fdd0e0b52782439f55bf37a8f6956c4d70` |
| `campaign-state.json` | `9f8e628f11856aea21e4fb1dcd71c0d2878b690a3921e65f3c9bb3b09224133b` |
| `mr-0912.js` | `c6279d11f49e639abdf985403240416cbf3a985e6f2b50c465d922dac80592f2` |
| `mr-0912.css` | `43b15e28c354c7eba2ee87657bff8af59b32a08fac03c3492bb59c9cbf33233a` |
| B `site.js` | `51f56fd05ccaba2d21c72a8076ddee060102f1e0e477c17d128277d7a30457c8` |
| B `site.css` | `32187a77b50a76d2ebc557edf041cb62cf4a2ee9641921947f250b9167cd6617` at Git pre-work HEAD `c2dbc21c8cc83d82751739c03ac9d279017fc24b` |

## Woo/object scope captured

- Product parents `3576`, `5504`, `5513`
- Variations `5865`, `5867`, `5873`
- Start-date attribute term `66`
- Acceptance and Zelle options used by the release
- Current product names, content, prices, sale dates, stock/purchasability, mappings, and option values

No order, payment, customer, historical entitlement, or unrelated product was included in the mutation set.
