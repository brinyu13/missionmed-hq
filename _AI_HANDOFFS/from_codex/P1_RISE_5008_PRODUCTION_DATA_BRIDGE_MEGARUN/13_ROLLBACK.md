# Rollback

Fresh production backup:

- Path: `/Users/brianb/MissionMed_AI_Sandbox/_ACTIVITY_LOGS/CODEX/P1_RISE_5008_PRODUCTION_DATA_BRIDGE_MEGARUN/production-backup-20260830/rise-production-pre-006-007-20260831T0514Z.dump`
- SHA-256: `3bca4312b0a0acdab2b5c35bd85f9c1eeae3c6c1c8da559926fca0976cfd1d2c`
- Bytes: 16,854
- Mode: 0600
- PostgreSQL 18 `pg_restore --list`: pass

The required rollback was executed after eligible live QA failed:

1. Shared HQ was restored provider-native to deployment `b109b297-73da-476b-9424-e420bddef87b`, exact prior image `sha256:12d7c914a504241c04899eab74a4aa3b95e4b5ade57cd08b0bbda03f60f02d7d`. Health endpoints returned 200 and the 144-key config fingerprints remained exact.
2. The database active-release pointer was restored transactionally to `rise_rights_safe_hrsa_20260828_716fceb7d0ac` with 26 programs. Migrations 006/007 and canonical data were intentionally preserved; readback remained 542 runs, 3,965 claims, and 886 identities.
3. The isolated RISE service config was restored exactly to its original 40-key names/value fingerprints.
4. The isolated RISE service was restored provider-native to deployment `0580e425-7462-4eb2-9901-f5f5c7cfd03b`, exact prior image `sha256:87ff26522b3cdde1459ad35351c38b436e33749a20da3a1b701f7f16e3c77d2c`.
5. Post-rollback health returned 200 with release `rise_rights_safe_hrsa_20260828_716fceb7d0ac` and build `rise_web_08a83ea8553d`; session, catalog, and SOAP endpoints returned 401 anonymous; no error-level deployment logs were present.

All rollback leases were released normally with provider-confirmed receipts. No shared or product lease remains held by this transaction.
