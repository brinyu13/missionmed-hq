# B1-502M Rollback Evidence

Recorded: 2026-07-27

## Local rollback proof

The serialized WordPress/PostgreSQL/browser integration suite verifies:

- activation and reactivation force `storyforge_enabled=false`;
- feature-off access returns `storyforge_disabled`;
- removing StoryForge route ownership returns the request to WordPress 404;
- plugin deactivation forces the flag false;
- a second administrator, nonallowlisted student, and mentor receive no
  navigation or token authority;
- logout/session destruction locks the open StoryForge session;
- eligibility revocation prevents new authority within the bounded token TTL;
- mentor reconciliation remains clean at `0/0`.

Receipt:
`evidence/local-integration/rollback-local-verification.txt`

## Database interruption proof

The guarded production runner was exercised against disposable PostgreSQL 18:

- forced SQL failure left the migration ledger, StoryForge schema, and all
  three roles absent;
- an independently forced ledger conflict rolled back;
- a clean run followed by an idempotent rerun preserved the expected state;
- the application login remained least privilege and used only
  `SET ROLE authenticated`.

Because the application role remains `NOLOGIN` until the complete schema
transaction commits, an interrupted schema run cannot expose a partially
migrated database through the application.

## Production rollback order

1. set the WordPress flag false;
2. atomically restore or disable only
   `wp-content/mu-plugins/missionmed-storyforge-runtime/current`;
3. move only `missionmed-storyforge-route.php` out of the auto-loaded
   `mu-plugins` directory when route absence is required;
4. purge Kinsta site and CDN caches and prove `/storyforge*` returns the
   recorded WordPress 404;
5. deactivate and remove only `missionmed-storyforge-sso` if the SSO seam
   itself must also be removed;
6. take the isolated Railway application service/domain offline;
7. restore the isolated database only if corruption requires it;
8. reverify Matrix login, WordPress admin, member dashboard, legacy StoryForge,
   unrelated routes, and protected hashes.

The sibling private 14-file release remains immutable evidence only and is not
deleted, overwritten, repointed, or treated as runtime during rollback.

The two inert Cloudflare route bindings and isolated Worker are removed after
the Kinsta gateway is proven. They are not a live rollback owner.

Restore details and RTOs:
`07_RESTORE_POINTS.md`

## Mandatory triggers

Immediate rollback is required for:

- Matrix login or member-dashboard regression;
- route shadowing or unrelated route change;
- indefinite opening state;
- incorrect founder entitlement or any other-user access;
- mentor access;
- private-story or demo-data exposure;
- secret exposure;
- broken logout/revocation;
- database corruption;
- mismatched static assets;
- major shared Matrix performance or behavior regression.

## Production execution

### First feature-off Kinsta gateway attempt

Attempted gateway revision:
`94504372c710372ea121a0b62ad7094e893e026b`.

The feature flag remained false, the founder allowlist remained empty, and no
founder or other user was enabled. Production validation found:

- `release_unavailable` because Kinsta PHP-FPM could not access the sibling
  private release, even with required traversal and read permissions present;
- Kinsta Nginx 404 for extension-bearing `/storyforge/assets/*` paths before
  WordPress dispatch.

The attempt therefore failed closed. The Supervisor physically removed the
active pointer and MU route file, purged Kinsta caches, and independently
reverified the restored state:

- StoryForge routes: prior 404;
- WordPress root: 200;
- anonymous member dashboard: 302 login handoff;
- WordPress REST: 200;
- protected `missionmed-hub` and legacy StoryForge hashes: unchanged;
- SSO plugin: installed but feature-off, with empty allowlist and role
  overrides.

The initial install and rollback purge calls used
`purge_complete_caches(true)`, which invalidates object, site, and CDN caches.
That over-broad cache scope is a recorded execution defect; it did not conceal a
health failure. Subsequent shared-site checks passed, and the DR-013 deployment
must use only the separate site-cache and CDN-cache purge methods.

Read-only filesystem verification after rollback found owner
`theresidencyacademy:www-data`; `/private` at `0755`;
`private/b1-502m` at `0700`; runtime, `storyforge-v5`, `releases`, and the
`94504372...` release directory at `0755`; all 14 evidence files at `0644`; the
retained rollback directory at `0700`; retained gateway staging directory at
`0750`; and the failed-installed gateway file retained outside active MU
loading at `0644`. The evidence release contains three directories at `0755`
and 14 files at `0644`, and every file SHA-256 matches the committed
`94504372c710372ea121a0b62ad7094e893e026b` release.

Outcome: **SAFE PRODUCTION ROUTE ABSENCE RESTORED.**

### DR-013 correction

MissionMed OS commit
`d49fffbd1cd92854bd1390fb5f4dbf68be95796d` authorizes the narrower nested
execution-private `release.php`, atomic runtime pointer, and extensionless
non-index alias mechanism. Its exact product commit, fresh Sentinel approval,
feature-off deployment, pointer rollback rehearsal, and production validation
remain pending. The successful rollback above must not be represented as proof
that the DR-013 candidate is deployed or founder-ready.
