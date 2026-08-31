# Migrations 006 and 007 Production Status

Fresh pre-migration backup `rise-production-pre-006-007-20260831T0514Z.dump` was captured with mode 0600, size 16,854 bytes, SHA-256 `3bca4312b0a0acdab2b5c35bd85f9c1eeae3c6c1c8da559926fca0976cfd1d2c`; PostgreSQL 18 `pg_restore --list` passed.

Migration 006 SHA-256 `0de4f62a5c7db17d3d5bd1919bb8cf280289c001e0dcb1fcc8fa70bc3736a260` and migration 007 SHA-256 `cabd229e98679ef5bd0b5d4a0e23c3177dfa11b3613fa6a15aa2ebfc2a44f771` were applied successfully.

Provider readback proved all seven Student Intel tables use enabled and forced RLS. The five canonical evidence tables also use enabled and forced RLS, with nine policies, least-privilege grants, and public access denied. Applied migrations remain forward history after the application rollback.

