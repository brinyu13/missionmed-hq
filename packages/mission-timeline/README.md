# Mission Timeline Builder 412

This is the repo-backed, non-production D1-412 implementation package. It preserves the exact D1-410 release-candidate web application under `web/` and adds production-facing contracts for Matrix hosting, identity, authorization, API behavior, Postgres/RLS, hybrid local/cloud persistence, private object storage, advisor review, export orchestration, FileVault adapters, security, telemetry, and release controls.

Nothing in this directory is imported by the live Matrix, WordPress, FileVault, Supabase migration root, R2, authentication, or `missionmed-hq` runtime. Production activation requires a separate guarded staging integration.

## Source authority

- D1-410 application source: `/Users/brianb/MissionMed_AI_Sandbox/D1_TIMELINE_ENGINE/release_candidate_410/application/`
- D1-410 entry SHA256: `d93f31663946b4284397c87a6ae367e4d12942f69d2638265db7e1074602b1ef`
- D1-410 content-map SHA256: `c2623e552b9a10b8049f7d9342b33da8bc5ee77717e8232362b9c39e7690a8f6`
- D1-411 architecture: `/Users/brianb/MissionMed_AI_Sandbox/D1_TIMELINE_ENGINE/D1_411_COMBINED_HANDOFF.md`

## Commands

```bash
npm --prefix packages/mission-timeline run typecheck
npm --prefix packages/mission-timeline test
npm --prefix packages/mission-timeline run test:web
npm --prefix packages/mission-timeline run verify
npm --prefix packages/mission-timeline run evidence
npm --prefix packages/mission-timeline run handoff
npm --prefix packages/mission-timeline run serve
```

The local server is for verification only. It performs no production calls and uses in-memory API/storage adapters.

## Production boundaries

- Matrix owns login and session validation.
- Timeline API owns editable `TimelineDocument` records, versions, review, approval, artifacts, and audit.
- IndexedDB remains the immediate local cache and recovery layer.
- Private R2 is the proposed byte store; this package includes only a contract and deterministic in-memory implementation.
- FileVault receives immutable artifacts asynchronously through adapters. It is not the draft database.
- The Mac Pro remains the official v1 rendering authority until web equivalence is approved.
