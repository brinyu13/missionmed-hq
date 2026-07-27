# B1-502M Restore Points

Recorded: 2026-07-27

Status: **PREMUTATION RESTORE EVIDENCE VERIFIED**

No StoryForge application, schema, WordPress plugin, Worker, route, or feature
flag had been deployed when these restore points were recorded.

## WordPress, Matrix, and legacy StoryForge

Restore identifier:
`B1-502M-RP-KINSTA-PRE-20260727T174625Z`

Provider/location:
Kinsta production environment
`/www/theresidencyacademy_209/private/b1-502m/B1-502M-RP-KINSTA-PRE-20260727T174625Z`

Scope:

- production `wp-config.php`;
- complete active `missionmed-hub` plugin directory, including the protected
  Matrix shell and legacy StoryForge assets;
- complete WordPress database;
- explicit before-state that `missionmed-storyforge-sso` was absent;
- explicit before-state that the StoryForge option row count was zero.

Integrity:

| Artifact | SHA-256 | Size / shape |
|---|---|---|
| `wp-config.php.pre` | `21aba77333a15ae1dc432a4314f3e53ee66558a0827a629a2ceba53c3db0d3f3` | 7,500 bytes |
| `missionmed-hub.pre.tar.gz` | `306315233eb5cd55246f59855e3cef4a8020346c12054a5b4567c28deab8ff2d` | 2,737,773 bytes; 134 entries |
| `wordpress-database.pre.sql.gz` | `094d317e73308883fea53e560127692dc389965f4452ead38fee1d3ffac240f8` | 33,834,479 bytes; 129 table definitions |

Readability was re-verified with `gzip -t`, `tar -tzf`, and a direct readable
file check on 2026-07-27. The remote receipt reports `readability=PASS`.

An isolated archive restoration rehearsal also passed: the complete
`missionmed-hub` archive was extracted beneath the private B1-502M backup root,
the legacy StoryForge JS/CSS, fingerprinted Matrix shell, and Matrix PHP hashes
all matched, and the exact temporary directory was removed. The full WordPress
database import was not executed because doing so would overwrite a healthy
production database; its compressed SQL passed readability and structural
checks, and the exact guarded `wp db import` process is retained in
`evidence/provider-prestate/KINSTA_PRESTATE.md`.

Normal StoryForge rollback does not require restoring protected
`missionmed-hub`, because B1-502M must not modify it. The scoped normal rollback
is:

1. force the StoryForge option to disabled;
2. deactivate and remove only `missionmed-storyforge-sso`;
3. verify that the option and plugin directory match the recorded absent
   before-state;
4. verify the protected Matrix and legacy StoryForge hashes.

The full database or protected plugin archive is restored only if a rollback
condition proves corruption or unintended mutation. That destructive recovery
must use the private backup above, run from the verified Kinsta site root, and
be followed by Matrix login, member-dashboard, legacy StoryForge, and unrelated
module health checks.

Rollback owner: B1-502M Codex Supervisor under DR-011.

Expected restoration time:

- feature off and isolated plugin deactivation: under 5 minutes;
- protected archive restoration if required: under 10 minutes;
- full WordPress database restoration if required: approximately 15–30 minutes
  plus verification.

## StoryForge PostgreSQL

Restore identifier:
`B1-502M-RP-DB-PRE-20260727T173144Z`

Provider target:

- Railway project `875e7c17-d06f-4301-a4bb-e61016f153cf`;
- environment `bcef8734-e42b-44df-8488-c2a3de68213f`;
- PostgreSQL service `a4a66362-c3ba-475a-ae21-2aa46624bafe`.

Private local artifact:
`/Users/brianb/MissionMed_private_backups/B1-502M/B1-502M-RP-DB-PRE-20260727T173144Z.dump`

Integrity:

- SHA-256
  `8b192d3921d36feee62a48d5a99a4b6059b5ac8c090344752b9ec1fa01aa1fe2`;
- PostgreSQL 18 custom-format dump;
- 885 bytes;
- `pg_restore --list` passed;
- zero expected TOC entries and zero public tables.

The exact production prestate was:

`ledger_absent|class_objects|functions|role_collisions=1|0|0|0`

This proves a fresh database with no StoryForge schema/function objects and no
collisions for `anon`, `authenticated`, or `storyforge_app`. The production
migration runner recreates those roles deterministically and applies schema,
migrations, and ledger rows atomically.

Normal rollback leaves the isolated database dormant after feature-off, route
removal, and application shutdown. If database restoration is required, the
Supervisor restores the custom dump with PostgreSQL 18 tooling to the exact
pinned database, verifies the empty before-state, and confirms that no
StoryForge role or application connection remains active.

Rollback owner: B1-502M Codex Supervisor under DR-011.

Expected restoration time: under 15 minutes for this empty prestate, plus
post-restore verification.

## Cloudflare edge

Restore/prestate identifier:
`B1-502M-RP-CF-ABSENT-20260727T174734Z`

Verified before-state:

- Worker `missionmed-storyforge-v5` absent;
- no Worker version or deployment;
- `https://missionmedinstitute.com/storyforge` returned 404;
- `https://missionmedinstitute.com/storyforge/` returned 404;
- `https://missionmedinstitute.com/storyforge/healthz` returned 404.

The intended release owns exactly:

- `missionmedinstitute.com/storyforge`;
- `missionmedinstitute.com/storyforge/*`.

Because the Worker and both routes were absent, the exact edge restoration is
to disable the WordPress flag first and delete only
`missionmed-storyforge-v5`; deletion returns both route patterns to their
recorded origin-owned 404 before-state. No DNS record, catch-all route, shared
Worker, Pages project, or unrelated cache rule is in B1-502M scope.

Rollback owner: B1-502M Codex Supervisor under DR-011.

Expected restoration time: under 5 minutes, followed by route-isolation,
Matrix, and legacy health verification.

## Railway application

Restore/prestate identifier:
`B1-502M-RP-RWY-ABSENT-20260727T171118Z`

Verified before-state:

- isolated project and empty service records were created under B1-502M;
- application service
  `dab015bf-15ef-4698-9f16-cbf8cf23de7a` had no source deployment and no public
  domain;
- the PostgreSQL service contained no StoryForge schema, roles, or data before
  migration.

The normal rollback takes the StoryForge route offline first, then removes the
application public domain or deletes only the isolated application service if
required. The isolated database remains dormant unless a database rollback
condition requires the verified restore above.

Rollback owner: B1-502M Codex Supervisor under DR-011.

Expected restoration time: under 10 minutes, plus external route verification.

## Restore decision

All existing mutable targets have a readable backup or a verified absent-state
receipt. No restore was executed during premutation preparation.
