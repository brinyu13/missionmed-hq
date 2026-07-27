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
2. delete only `missionmed-storyforge-v5`, removing the exact and wildcard
   StoryForge routes;
3. deactivate and remove only `missionmed-storyforge-sso`;
4. take the isolated Railway application service/domain offline;
5. restore the isolated database only if corruption requires it;
6. reverify Matrix login, WordPress admin, member dashboard, legacy StoryForge,
   unrelated routes, and protected hashes.

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

The exact production rollback status, any command execution, restored revision,
and post-rollback health checks are appended after deployment validation.
