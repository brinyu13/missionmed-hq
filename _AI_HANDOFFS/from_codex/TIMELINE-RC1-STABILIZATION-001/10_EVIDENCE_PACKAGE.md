# Timeline RC1 Evidence Package

Evidence root: `_AI_HANDOFFS/from_codex/TIMELINE-RC1-STABILIZATION-001/`.

Primary receipts:

- Final source commits: `635b7d1e761538294976a2ba3a9a980f19d7171e`, `f4e9b0907c8686257180565514263c61b6bfb19f`, `e685e948fd338199a3b47c4305021dde08979a1c`.
- Live URL: `https://missionmedinstitute.com/timeline/`.
- Static release: `timeline-c9eda9eeb7d6cf98`.
- WordPress runtime: `timeline-wp-7230b1b928fcbad2`.
- WordPress payload SHA-256: `6d6542c13f6dfd34ec9cda8c4b3b4788e704e87833a35db84d2735aaff0def90`.
- Railway deployment: `075cf61c-a91b-4bb7-ba41-69bebdbb3d17`.
- Railway image: `sha256:69068dd247f20f0aec0914acae4bc653e7bc267b0588fc1937243bff7dcea259`.
- Private bucket: `missionmed-timeline-media-prod`.
- Production health: `200`, ready, schema `d1-timeline-db-500.1`.
- Direct API: `403 GATEWAY_REQUIRED`.
- Tests: `636/636`, browser `39/39`, release `62/62`, package `23/23`.
- Current preview: `evidence/RC1_CURRENT_PREVIEW.png`.
- Backup: `/www/theresidencyacademy_209/private/timeline-rc1-backups/20260805T204718Z`.
- Final package checksums: `PACKAGE_MANIFEST.sha256`.

Credential hygiene:

- No password, JWT, gateway secret, R2 access key, R2 secret, signed URL, session cookie, or database credential is included.
- The first provider token was revoked after an unexpected UI exposure; only the replacement was installed.

The package manifest must be validated with `shasum -a 256 -c PACKAGE_MANIFEST.sha256` after the last content change.
