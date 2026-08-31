# SOAP Rollback

Fresh production backup `rise-production-pre-006-007-20260831T0514Z.dump` is 16,854 bytes, mode 0600, SHA-256 `3bca4312b0a0acdab2b5c35bd85f9c1eeae3c6c1c8da559926fca0976cfd1d2c`; PostgreSQL 18 `pg_restore --list` passed.

The live QA failure triggered the specified rollback:

- Shared HQ restored to exact prior image `sha256:12d7c914a504241c04899eab74a4aa3b95e4b5ade57cd08b0bbda03f60f02d7d`.
- RISE database active-release pointer restored transactionally to the prior 26-program release.
- Isolated RISE config restored to the exact original 40-key names/value fingerprints.
- Isolated RISE app restored to exact prior image `sha256:87ff26522b3cdde1459ad35351c38b436e33749a20da3a1b701f7f16e3c77d2c`.
- Post-rollback health returned 200; protected endpoints returned 401 anonymous; no error-level deployment logs were present.

Migrations 006/007 and all canonical evidence were intentionally preserved as forward history. Provider readback remained 542 runs, 3,965 claims, and 886 identities, including the 925 SOAP claims. No WordPress file was changed. All rollback leases were normally released.
