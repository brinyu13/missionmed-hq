# Rollback

Production pre-migration backup:

- path: `/Users/brianb/MissionMed_AI_Sandbox/_ACTIVITY_LOGS/CODEX/P1_RISE_5008_PRODUCTION_DATA_BRIDGE_MEGARUN/production-backup-20260830/rise-production-pre-006-007.dump`
- SHA-256: `7d3888a891b34935191f476e5e8426f622220f6bff8a1bd887f21ccfb2fa4b91`
- bytes: 16,793
- mode: owner read/write only

PostgreSQL 18 isolated restore passed after recreating the declared NOLOGIN runtime role. Readback: five RISE runtime tables, one active release, 26 registry programs, one source authorization, and migration 006 absent.

Migration 007 recovery revokes old-runtime access while preserving one source, 925 SOAP claims, 886 identities, and one ingest receipt in the focused rehearsal. Application rollback selects prior Railway deployment `b0301470-ec0a-4e03-9340-2b06fda4befb`; applied migrations remain forward history.

On the PostgreSQL 18 restored production preimage, the same recovery preserved all 542 sources, 3,965 claims, 886 identities, and 542 ingest receipts while revoking runtime access.
