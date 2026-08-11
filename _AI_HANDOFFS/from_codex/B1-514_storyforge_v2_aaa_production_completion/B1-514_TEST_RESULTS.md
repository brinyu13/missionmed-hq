# B1-514 Test and Verification Results

Verdict: **LOCAL RELEASE CANDIDATE PASS; EXTERNAL PRODUCTION GATES OPEN**

| Gate | Result |
| --- | --- |
| Unit | `399/399 PASS` at final HEAD |
| PostgreSQL Node integration | `27/27 PASS` at final HEAD |
| PostgreSQL low-level/RLS/survival | `136/136 PASS` at final HEAD |
| SQL authorization/conformance matrices | PASS |
| Survival focused unit | `11/11 PASS` |
| Survival PostgreSQL 18 CLI | `6/6 PASS` |
| Browser E2E | `61/61` unaffected full run plus `11/11` final voice block; `72/72` scenarios passed in aggregate |
| Conformance/accessibility/responsive | `72/72 PASS` |
| Deterministic release build | PASS; `v-206e7e944a5e8cf5` |
| API-only build | PASS |
| Secret scan | PASS |
| `npm audit` | `0 vulnerabilities` in `storyforge-v5` |
| `git diff --check` | PASS |
| Critical Systems enforced gate | PASS with zero failures; one expected browser-journey warning |
| Docker WordPress integration | EXTERNAL BLOCKER: local Docker/OrbStack socket unavailable; no destructive runtime troubleshooting attempted |

The final verifier-only commit does not change frontend, API, gateway, migration, or release bytes. The release build after that commit reproduced the same release ID and asset hashes.

## Fresh production read-only evidence

- Railway project/environment/application/database IDs exactly match DR-043.
- Current Railway application deployment `d0756a3d-2284-46bc-ba1c-e2f75b3cd41c` is `SUCCESS`.
- Production PostgreSQL: version `18.4`, system identifier `7667256745042145332`, `441` users, `48` stories, `13` ledger rows ending `20260806190000`, `8` story-audio assets, `20` recording sessions, `1` mentor note, and `1` mentor-note media row.
- Live public hashes exactly match the accepted B1-512C manifest: index `e720fca...`, app `cbe2999f...`, styles `5e183150...`, and logo `f091d62a...`.

## Fresh PG18 recovery rehearsal

- Custom dump: `574468` bytes, mode `0600`, SHA-256 `97be5226f07e5712f3634a0f5fd946851e1e173ca6c20d5b39e9492ab5224f82`.
- Dumped by PostgreSQL `18.4`; `pg_restore --list` passed.
- Isolated PostgreSQL `18.4` restore completed with empty stderr and matched `441|48|13|8|20|1|1|0` for users, stories, ledger, audio, recordings, mentor notes, mentor media, and pending mentor-media deletion intents.
- The complete nine-migration train applied atomically to a second isolated restored database.
- Post-rehearsal vector: `441 users | 48 stories | 22 ledger rows | 81 Inspiration prompts | 48 contributor prompts | 0 historical visibility values | 0 generated story versions | 0 invitations | 0 contributions`.
- The isolated server was stopped after verification.

## Live PRE survival evidence

- Artifact is private (`0600`) and outside the repository/web root.
- SHA-256: `bad1f7557bf4152c175c32b50d06304f5377b2ba4ad8ade62758ae68eafe2a69`.
- Full-table authority: PASS.
- Database-system binding: PASS.
- Stories: `48/48` inventoried.
- Permanent object HEAD verification: `9/9 PASS` (`8` StoryForge audio plus `1` mentor audio).
- Candidate migration-train binding: `9c960a15...`.
- Guarded production migration preflight: PASS, `pending=9`.
- No production migration or POST manifest was executed.

