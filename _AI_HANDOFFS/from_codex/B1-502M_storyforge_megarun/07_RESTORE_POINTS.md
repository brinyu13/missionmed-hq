# B1-502M Restore Points

Recorded: 2026-07-27

Status: **PREMUTATION RESTORE EVIDENCE VERIFIED; FIRST KINSTA GATEWAY
ATTEMPT SAFELY ROLLED BACK**

No StoryForge application, schema, WordPress plugin, Worker, route, or feature
flag had been deployed when the original restore points were recorded.
Subsequent mutations and their current rollback state are recorded below; this
opening statement is historical prestate, not current production state.

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
2. move only
   `wp-content/mu-plugins/missionmed-storyforge-route.php` outside the MU-plugin
   directory, atomically restore or disable only
   `wp-content/mu-plugins/missionmed-storyforge-runtime/current`, and purge the
   Kinsta site/CDN caches;
3. verify `/storyforge`, `/storyforge/`, `/storyforge/healthz`, and a
   `/storyforge/api/*` probe all return the recorded origin-owned 404;
4. deactivate and remove only `missionmed-storyforge-sso`;
5. verify that the option and plugin directory match the recorded absent
   before-state;
6. verify the protected Matrix and legacy StoryForge hashes.

The sibling private release is retained immutable evidence and is not removed,
repointed, or used by PHP-FPM during normal rollback.

The full database or protected plugin archive is restored only if a rollback
condition proves corruption or unintended mutation. That destructive recovery
must use the private backup above, run from the verified Kinsta site root, and
be followed by Matrix login, member-dashboard, legacy StoryForge, and unrelated
module health checks.

Rollback owner: B1-502M Codex Supervisor under DR-011.

Expected restoration time:

- feature off and isolated plugin deactivation: under 5 minutes;
- isolated MU gateway removal, release-pointer removal, and cache purge: under
  5 minutes;
- protected archive restoration if required: under 10 minutes;
- full WordPress database restoration if required: approximately 15–30 minutes
  plus verification.

## Kinsta StoryForge route gateway

The DR-013 isolated route candidate is additive and owns only these new targets:

- `wp-content/mu-plugins/missionmed-storyforge-route.php`;
- `wp-content/mu-plugins/missionmed-storyforge-runtime/releases/<exact-product-commit>/release.php`;
- `wp-content/mu-plugins/missionmed-storyforge-runtime/current`.

The earlier sibling release at
`/www/theresidencyacademy_209/private/b1-502m/runtime/storyforge-v5/releases/94504372c710372ea121a0b62ad7094e893e026b/`
is not a target of the DR-013 runtime. It remains immutable evidence only.

The protected `missionmed-hub` plugin, WordPress theme, DNS, and legacy
StoryForge files are not gateway targets. The gateway is installed
feature-off first and binds only the canonical production host plus the exact
`/storyforge` route family.

### First feature-off attempt and physical rollback

The first attempt used pushed gateway commit
`94504372c710372ea121a0b62ad7094e893e026b`. The route failed closed with
`release_unavailable` because Kinsta PHP-FPM could not read the sibling private
release, and Kinsta Nginx returned 404 before WordPress for extension-bearing
`/storyforge/assets/*` paths. The feature flag stayed false and the allowlist
stayed empty.

The active pointer and MU route file were physically removed, Kinsta caches were
purged, and StoryForge routes independently returned the prior 404. Shared-site
checks passed: root 200, anonymous member dashboard 302 to login, and WordPress
REST 200. Protected and legacy StoryForge assets remained unchanged.

The initial install and rollback purge calls used Kinsta's
`purge_complete_caches(true)` helper, which invalidates object, site, and CDN
caches. This broader-than-intended scope is recorded rather than hidden; shared
health passed afterward. All DR-013 deployment and rollback operations must use
only the separate site-cache and CDN-cache purge methods.

Live read-only filesystem verification after rollback recorded owner
`theresidencyacademy:www-data` throughout the scoped tree and these final modes:

| Scope | Final mode / shape |
|---|---|
| `/www/theresidencyacademy_209/private` | `0755` |
| `private/b1-502m` | `0700` |
| `runtime`, `runtime/storyforge-v5`, `releases`, and the `94504372...` release directory | `0755` |
| immutable evidence release contents | three directories at `0755`; 14 files at `0644` |
| retained rollback directory | `0700` |
| retained gateway staging directory | `0750` |
| failed-installed gateway file retained outside active MU loading | `0644` |

All 14 evidence files matched the exact SHA-256 values in the committed
`94504372c710372ea121a0b62ad7094e893e026b` release. Temporary access-mode
changes were therefore restored to this verified final state; no broader
permission remains as runtime authority.

### DR-013 candidate rollback

The exact gateway rollback is:

1. force the StoryForge feature option off;
2. atomically restore or disable only
   `wp-content/mu-plugins/missionmed-storyforge-runtime/current`;
3. move the single MU route PHP file out of `wp-content/mu-plugins` when route
   absence is required;
4. purge Kinsta site and CDN caches;
5. verify every `/storyforge*` probe returns the recorded 404 while Matrix,
   WordPress REST, legacy StoryForge, and unrelated modules remain healthy;
6. retain both the immutable nested release directory and the sibling private
   evidence release for forensics unless their integrity is itself the rollback
   cause.

Production rollback rehearsal must exercise the physical MU-file removal and
reinstallation plus atomic runtime-pointer disablement/restoration. The first
attempt proves physical route removal and restored 404; the exact DR-013 pointer
mechanism still requires feature-off production rehearsal. A local feature
constant or test-only route bypass is supplemental evidence, not a substitute.

Rollback owner: B1-502M Codex Supervisor under DR-011 as amended by DR-012 and
DR-013.

Expected restoration time: under 5 minutes plus cache propagation and health
verification.

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

The isolated Worker and both exact route records were later created, but live
diagnosis proved them inert: the apex DNS record is DNS-only and production
requests continue directly to Kinsta. The Worker is therefore not the active
StoryForge route owner and is pending narrow decommission after the Kinsta
gateway is proven.

The exact Cloudflare cleanup is to disable StoryForge first, remove only the
two recorded StoryForge route bindings, verify no unrelated binding changed,
and delete only `missionmed-storyforge-v5`. Removing those inert records must
not affect the Kinsta-owned route. No DNS record may be proxied, and no
catch-all route, shared Worker, Pages project, or unrelated cache rule is in
B1-502M scope.

Rollback owner: B1-502M Codex Supervisor under DR-011 as amended by DR-012.

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
