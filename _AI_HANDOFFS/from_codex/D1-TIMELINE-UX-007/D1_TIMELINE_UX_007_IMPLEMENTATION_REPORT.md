# D1 Timeline UX-007 — Implementation Report

- Commit: `bdb5beced707687ab450ba4a73dc12e94dbd87bb` (pushed).
- Scope: 40 files; 2,790 insertions and 102 deletions.
- Editor: unified live overlay, media presentation/crop, shared layers, real groups, text containers, marquee, cached snapping, keyboard commands, persistent last-good render, viewport zoom/pan.
- CV: private source custody, strict server AI provider/schema/service/post-validation, quality assistant, API/client integration, semantic fallback corrections.
- File Vault: Timeline-owned read-only metadata gateway and authenticated client adapter.
- Documentation/tests: OpenAPI, security model, PHP harness, unit/integration/browser journeys.
- No schema migration, protected D1-409H edit, Matrix mutation, File Vault mutation, shared provider mutation, or student-data rewrite.

Immutable candidate:

- Static release: `timeline-ea605f39719b1f57` (63/63 hashes verified).
- WordPress release: `timeline-wp-77d5940be11cd434`.
- WordPress payload SHA-256: `3dcc7d8bfd6704999c0e90712285ede846826118fe32fa2d4ae8414e0dd9f15e`.
- API bundle SHA-256: `5364c525eda2250f8b20c512c125ab7366cc1240d182db7e9c9f7d076819a93f`.
- App asset: `app.a1c9f7b531dd.js`, SHA-256 `a1c9f7b531dd5b9fc3a6ff7519cc0a9d33baaf52554c3e016bbedd1e7af7c939`.

Production cutover has not occurred because the fresh provider-native Kinsta backup and live-browser authentication gate are unresolved.
