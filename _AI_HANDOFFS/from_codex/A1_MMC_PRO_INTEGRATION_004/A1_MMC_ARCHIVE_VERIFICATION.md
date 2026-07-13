# A1 MMC Archive Verification

RESULT: VERIFIED_QUARANTINE_EXTRACTION_COMPLETE_WITH_NONCRITICAL_MANIFEST_DEFECT

## Outer archive

- Incoming archive: /Users/brianb/MissionMed_Migration/Incoming/A1_MMC_OLD_LAPTOP_EXPORT_003_20260710.tar.gz.
- Bytes / entries / SHA-256: 2335757222 / 330 / 58eb5962a1ce6cfdbb5f50763a8cea041b68d7e99cc87f8039ead9766e14e049.
- Tar safety: one top-level directory, 56 directories, 274 regular files, no symlinks, no absolute paths, and no parent-traversal paths.
- Extraction destination: /Users/brianb/MissionMed_Migration/Quarantine/A1_MMC_OLD_LAPTOP_EXPORT_003.
- The original user download and Incoming archive remain untouched.

## Internal verification

- Final Git bundle SHA-256: 6b1453f344b3debcd7ac8ebe34bba2f96ca448e3f70cfc09e312cd5fccf8d95b — PASS.
- Four per-worktree manifests: 221/221 rows pass (2 + 2 + 215 + 2).
- Package-wide manifest: 273/274 rows pass. The only failure is the manifest's self-referential checksum line: recorded 05fb1ad4… versus actual manifest SHA-256 7acb6d05…. Every non-self payload row passes.
- checksums/archive.sha256 preserves stale pre-transfer archive hash b7d6e7… and an old absolute source path.
- A1_MMC_GIT_BUNDLE_VALIDATION.md preserves pre-finalization bundle hash 0288d809…, while README_FIRST.md and the package manifest correctly record the final 6b1453f3… bundle.
- Secret scan state: PASS_WITH_EXCLUSIONS_RECORDED. Three secret-bearing tests were intentionally excluded and were not reconstructed.

The self-checksum and stale-receipt discrepancies are provenance-generation defects, not payload corruption. They are preserved and disclosed rather than rewritten.
