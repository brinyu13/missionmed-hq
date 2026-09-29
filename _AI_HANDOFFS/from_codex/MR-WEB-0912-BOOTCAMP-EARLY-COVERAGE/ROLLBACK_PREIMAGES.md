# MR-WEB-0912 Bootcamp + Early-Coverage Rollback / Preimages

## Recovery gates

- MyKinsta Live daily backup: **Sep 28, 2026, 9:28 AM ET**.
- Class: Daily; retention shown by MyKinsta: **14 days**.
- Restore control: visible (`Restore to`).
- Custom note/label: none shown for the daily backup.
- No backup was created, deleted, renamed, or restored by this run.

## Exact scoped preimage package

Server-only package:

`/www/theresidencyacademy_209/private-backups/MR-WEB-0912-BOOTCAMP-20260928T235400Z`

- Permissions: `drwx------` (`theresidencyacademy:www-data`).
- Manifest: `SHA256SUMS`.
- Manifest SHA-256: `b7a8876727fdf2797b83c868cc7d68b1ea394a4a1dcb75066c921b5589710a80`.
- `sha256sum -c SHA256SUMS`: every entry **OK** on final readback.

The package contains exact preimages for the eight deployed source files and JSON post/meta snapshots for Woo objects `3576`, `5865`, `5504`, `5867`, `5513`, and `5873`.

The first manifest-generation attempt accidentally included the manifest itself and therefore produced one self-reference mismatch. The manifest was immediately regenerated without self-inclusion; its final hash is the one above and every listed payload verifies.

## Rollback boundary

Rollback is limited to:

1. restoring the eight source preimages to their original absolute paths;
2. restoring only the title/excerpt/content fields changed for Woo objects `5504`, `5867`, `3576`, and `5513` from the package JSON;
3. clearing MyKinsta caches;
4. rerunning the same logged-out responsive/readback checks.

Rollback must not change product/variation IDs, slugs, prices, stock, orders, users, LearnDash mappings, historical orders, analytics identity, or unrelated files.

## Source hashes after deployment

```text
a5b31a4db1aa109140bdd7ac1c0691fe30eb7f2f677d6cf5142e339cdb744b5b  missionmed-mr-p0.php
97ee646a66e16ed3ae52af82557f0cf30ad5ab095d43a0fe3786ea63304f41ed  campaign-state.json
a5cd519b2c7535ff8f86cdab2ba15f0fe4a34ea16b59d5b23fda8bdefb10fb09  mr-0912.js
2ec612b0481a0c331ca33102b339560cc53af859f8fe1cd7137a031a50682ccb  offer.html
f935daa237683d15bc1c0d2ca4af9061e4298a691190426bbc7cc629f599ba00  b-immersive/index.html
332959816fa2676ef9bb697ea50f9be42e61daaab2f62ac5215d37d648498c7b  guarantee.html
77984099cd2f5c3a6b1f558801977f8352f6ab55819d74adb7aa8f8ae4be9964  site.css
2f061f6d9a8312565c21a091d1bb75a2d74e02f15c2d0f330debe8db1af35a87  site.js
```

These hashes matched the committed local files and the live server readback.

The scoped preimage package predates both the base deployment and the one-line modal fix, so the same bounded rollback restores the original site.js as well as the rest of the release.
