# 03 — Archive Verification

RESULT: `ARCHIVE_EXACT_SAFE_QUARANTINE_VERIFIED`

## Outer archive

| Check | Verified result |
| --- | --- |
| Incoming file | `/Users/brianb/MissionMed_Migration/Incoming/A1_MMC_OLD_LAPTOP_EXPORT_003_20260710.tar.gz` |
| Exact size | `2,335,757,222` bytes |
| SHA-256 | `58eb5962a1ce6cfdbb5f50763a8cea041b68d7e99cc87f8039ead9766e14e049` — exact expected match |
| Gzip/tar integrity | PASS |
| Top-level layout | One package root |
| Unsafe paths | 0 absolute paths; 0 parent-traversal paths |
| Unsafe types | 0 symlinks, hard links, devices, or FIFOs |
| Source archive treatment | Retained unchanged; never overwritten or deleted |

Raw and logical counts must not be conflated:

- Python tar inspection sees **332 raw headers**: 56 directory headers and 276 regular-file headers. Two of the regular headers are AppleDouble `._` metadata sidecars.
- bsdtar exposes **330 logical members**: 56 directories and 274 logical regular files.
- Fresh extraction contains the 56 archive directories and 274 logical files; the quarantine wrapper directory is additional.

The earlier Prompt 004 value of 330 was therefore a valid logical-member count but not a complete raw-header count.

## Fresh quarantine

The archive was extracted only to:

`/Users/brianb/MissionMed_Migration/Quarantine/A1_MMC_OLD_LAPTOP_EXPORT_003_20260710_quarantine_20260714T161223Z`

The quarantine root is mode `0700`, and no extracted path grants group/other access. Extraction did not target the canonical repository or active worktree.

The 274 logical files comprise five top-level guidance/handoff documents plus these package groups:

| Package group | Logical files |
| --- | ---: |
| `worktree_exports` | 237 |
| `reports_and_handoffs` | 15 |
| `git` | 9 |
| `validation_evidence` | 2 |
| `checksums` | 2 |
| `secret_exclusions` | 2 |
| `non_git_assets` | 1 |
| `restore_and_compare` | 1 |
| Top-level package documents | 5 |
| Total | 274 |

## Bundle and manifest integrity

- Git bundle: `git/missionmed-old-laptop-complete.bundle`.
- Bundle SHA-256: `6b1453f344b3debcd7ac8ebe34bba2f96ca448e3f70cfc09e312cd5fccf8d95b`.
- `git bundle verify`: PASS, complete history.
- Advertised refs: 324 total, including 168 heads. Prompt 004 mapped those 168 heads to isolated `old-laptop/*` refs and verified 168/168 exact destination SHAs.
- Four per-worktree manifests: 221/221 payload rows pass.
- Package-wide manifest: 273/274 rows pass. The only failing row is the manifest's self-referential checksum; every non-self payload row passes.
- The internal `archive.sha256` and one bundle-validation narrative preserve pre-finalization hashes/paths. The verified outer archive hash and final bundle hash above govern. These are provenance-generation defects, not payload corruption.

## Secret and privacy boundary

Independent loose-file scanning covered 271 text artifacts totaling 3,894,728 bytes. It found zero high-confidence credential candidates and zero sensitive filenames. The exporter separately recorded three source tests excluded for credential assignments; they remain absent and were not reconstructed.

The multi-gigabyte Git bundle is opaque historical evidence and is not certified globally secret-free merely because its loose companion files passed scanning. It remains local in owner-only quarantine and is never copied into the public repository or merged wholesale.

For durable public-safe provenance, `historical_macbook_air/HISTORICAL_CORPUS_MANIFEST.sha256` records 188 SHA-256/archive-relative-path rows: 178 selected MMC product-history documents and 10 export-provenance documents. Raw bodies remain local because 46 product-history documents contain one or more private/operational metadata signals. The sanitized manifest contains none of those values and has SHA-256 `cd970a9f93dcec814da97b491522a7f3402af895e9340c8ddc5492c14db068bd`.

## Verification conclusion

The incoming archive is the exact expected payload, is structurally safe, is preserved unchanged, and has a fresh owner-only quarantine extraction. Its implementation files may be used only through reviewed selective reconciliation. The archive and bundle remain historical evidence, never a wholesale replacement package.
