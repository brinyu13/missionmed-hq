# B1-512B Database Verification

Status: **PASS — current production was read only and a fresh PG18 dump restored in isolation.**

Authenticated Railway PostgreSQL access identified database `railway`, role `postgres`, and SSL `true`.

| Item | Count |
| --- | ---: |
| `sf_users` | 441 |
| `sf_stories` | 23 |
| `sf_schema_migrations` | 12 |
| `sf_audio_assets` | 7 |
| `sf_recording_sessions` | 15 |
| `sf_mentor_notes` | 1 |
| `sf_mentor_note_media` | 1 |
| pending mentor-media deletion intents | 0 |

The ledger ends at `20260806130000`. B1-512 migration `20260806190000_b1_512_concrete_configuration_media.sql` is absent, as expected because B1-512 has not been migrated.

The fresh custom-format dump restored into a disposable local PostgreSQL 18.4 database with `pg_restore --exit-on-error`. Restore stderr SHA-256 was `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`; 36 public tables and count vector `441|23|12|7|15|1|1|0` matched live readback. The instance was stopped after verification. No production schema, data, roles, or migrations changed.
