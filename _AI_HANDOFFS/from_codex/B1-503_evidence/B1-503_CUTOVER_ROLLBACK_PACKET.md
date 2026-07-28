# B1-503 Cutover and Rollback Packet

Status: **PREPARED AND LOCALLY REHEARSED — NOT YET EXECUTED IN PRODUCTION**

This is the executable safety packet for the guarded B1-503 production
cutover. It records root/SQL-agent evidence supplied to this worktree and the
exact fail-closed command contracts added by the B1-503 safety closure. The
author of this packet did not create the provider backups and did not run any
SSH, Kinsta, Railway, PostgreSQL production, deployment, feature-flag, cache, or
production rollback command while preparing it.

## 1. Pinned recovery evidence

The narrative backup receipt is:

`_AI_HANDOFFS/from_codex/B1-503_evidence/B1-503_BACKUP_RECEIPT.md`

The machine-checked database receipt is:

`_AI_HANDOFFS/from_codex/B1-503_evidence/B1-503_DB_BACKUP_RECEIPT.md`

Its SHA-256 is:

`f7cfa559b651d5cd115c7a0651815fbed2d5730b5bccfb6bcb03dbfa7572a0aa`

Root/SQL-agent supplied evidence:

| Recovery boundary | Exact identity |
|---|---|
| MyKinsta manual backup note | `B1-503 pre product recovery 2026-07-28T08:03:10Z` |
| Private Kinsta restore point | `B1-503-RP-KINSTA-PRE-20260728T080310Z` |
| PostgreSQL logical restore point | `B1-503-RP-PG-PRE-20260728T080310Z` |
| PostgreSQL 18 dump SHA-256 | `18d737fba373c0a5da0cd43874601a0cecd2a81a9c1c9ad40d55febdd9ccea6c` |
| PostgreSQL 18 restore rehearsal | `PASS` |
| Railway provider backup | `59a491f8-ecb2-4fc8-b5b3-da43ccada133` |
| Railway provider backup state | locked `true`; `expiresAt=null`; created `2026-07-28T08:07:44.233Z` |
| Railway project | `875e7c17-d06f-4301-a4bb-e61016f153cf` |
| Railway environment | `bcef8734-e42b-44df-8488-c2a3de68213f` |
| Railway PostgreSQL service | `a4a66362-c3ba-475a-ae21-2aa46624bafe` |
| Railway volume instance | `8d4a7b7f-7d55-4a1d-81eb-07221b4a7bf5` |
| PostgreSQL host/port | `sakura.proxy.rlwy.net:10257` |
| PostgreSQL database/user | `railway` / `postgres` |
| PostgreSQL system identifier | `7667256745042145332` |

The MyKinsta backup is time-limited by the provider. Its supplied expiry is
August 11, 2026 at 4:03 AM in the provider UI. The locked Railway backup has no
expiry. Revalidate every receipt immediately before mutation.

## 2. Pinned before and candidate runtime identities

Previous production state:

| Field | Exact value |
|---|---|
| `current` target | `releases/4bd956b6ea222d20428c41415236a73b93576447` |
| previous release ID | `v-963b8f5eb4d8c727` |
| previous route SHA-256 | `23ca6d28268a780c46c27083a726dab18c3e6125a46a6fda600fd9c03eee2d88` |
| previous route size | `30528` |
| previous `release.php` SHA-256 | `845289a4c646b0ea496fa864186a0b9f534425ff8aad8b40e0e3993ebf05a3f1` |
| previous `release.php` size | `409055` |

B1-503 candidate:

| Field | Exact value |
|---|---|
| release ID | `v-0912286e7dfc2327` |
| route SHA-256 | `1cf024fc47f8130f980a79af6090c9f214148ac82c397fb8b94a8b7945c67f61` |
| route size | `30530` |
| `release.php` SHA-256 | `3215eed4837d9a9d712706003e352ead3423e399bea76c20818270d93fcb199e` |
| `release.php` size | `741148` |

The commit-named release directory must use the final clean, pushed cutover
commit that contains this safety tooling and the already-generated artifacts.
Do not substitute source commit `36e823d...` or artifact-generation commit
`5141939...` after a later safety commit exists. Resolve the full final commit
once, then use the same value for the source/archive gate, migration ledger,
Railway deployment receipt, Kinsta release directory, and `current` pointer.

## 3. Mandatory cutover order

1. Verify the exact final commit is clean, pushed, and byte-identical to the
   source or Git archive used for every command.
2. Revalidate the MyKinsta, private Kinsta, PostgreSQL 18, and locked Railway
   receipts above.
3. Resolve and record the absolute Kinsta `wp` and `php` executable paths, the
   canonical WordPress root, the exact Unix owner, and private staging paths.
4. Stage the two Kinsta scripts, route, and release bundle outside the public
   WordPress root; verify their hashes before use.
5. Run the Kinsta install script in `preflight` mode. It is read-only.
6. Force `storyforge_enabled=false`, verify allowlist/override counts did not
   drift, wait at least 65 seconds (one 60-second token TTL plus margin), and
   reverify feature-off.
7. Run the migration script in `preflight` mode from PostgreSQL 18 tooling in
   the exact Railway project/environment/database-service context.
8. Run the migration script once in confirmed `apply` mode. It must report
   exactly two pending B1-503 migrations before the transaction and exactly
   five known ledger rows afterward.
9. Deploy only the API-only `storyforge-v5/` package from the same final
   commit. Prove direct Railway `/` remains denied and the redacted health/API
   checks pass.
10. Rerun Kinsta `preflight`, then run confirmed `install`. Record the emitted
    sealed rollback receipt path and SHA-256 outside the host session.
11. While feature-off, validate route aliases, raw/direct-path denial,
    candidate hashes, cache behavior, API, database counts, protected Matrix
    hashes, Matrix login, WordPress REST/admin, legacy StoryForge, and unrelated
    routes.
12. Only after every feature-off gate passes, re-enable the exact one-Founder
    student pilot and perform authenticated production validation without fake
    saved student data.

The install script verifies feature-off but cannot prove the required TTL wait.
The operator must preserve the feature-off timestamp and post-wait verification
as separate evidence.

## 4. Migration runner contract

Executable:

`storyforge-v5/scripts/apply-production-migrations.sh`

Run `preflight` first and `apply` only after it passes. Required values are:

```text
STORYFORGE_RAILWAY_PROJECT_ID=875e7c17-d06f-4301-a4bb-e61016f153cf
STORYFORGE_RAILWAY_ENVIRONMENT_ID=bcef8734-e42b-44df-8488-c2a3de68213f
STORYFORGE_RAILWAY_DATABASE_SERVICE_ID=a4a66362-c3ba-475a-ae21-2aa46624bafe
STORYFORGE_DB_BACKUP_ID=59a491f8-ecb2-4fc8-b5b3-da43ccada133
STORYFORGE_DB_BACKUP_RECEIPT=<absolute path to B1-503_DB_BACKUP_RECEIPT.md>
STORYFORGE_DB_BACKUP_RECEIPT_SHA256=f7cfa559b651d5cd115c7a0651815fbed2d5730b5bccfb6bcb03dbfa7572a0aa
STORYFORGE_DEPLOY_GIT_COMMIT=<FINAL_CLEAN_PUSHED_CUTOVER_COMMIT>
STORYFORGE_SOURCE_MODE=git
STORYFORGE_APP_DB_PASSWORD=<single-line secret of at least 32 characters>
STORYFORGE_EXPECTED_PGHOST=sakura.proxy.rlwy.net
STORYFORGE_EXPECTED_PGPORT=10257
STORYFORGE_EXPECTED_PGUSER=postgres
STORYFORGE_EXPECTED_PGDATABASE=railway
STORYFORGE_EXPECTED_DB_SYSTEM_IDENTIFIER=7667256745042145332
STORYFORGE_EXPECTED_USER_COUNT=1
STORYFORGE_EXPECTED_ACTIVE_ASSIGNMENT_COUNT=0
PGHOST=sakura.proxy.rlwy.net
PGPORT=10257
PGUSER=postgres
PGPASSWORD=<privileged migration credential>
PGDATABASE=railway
PGSSLMODE=require
```

`RAILWAY_PROJECT_ID`, `RAILWAY_ENVIRONMENT_ID`, and `RAILWAY_SERVICE_ID` must
come from the pinned Railway execution context and must equal the three ticket
pins. Do not bypass that check by inventing different IDs. The runner also
requires PostgreSQL 18 `psql`, proves the connected database system identifier
and SSL session, verifies the exact three-row pre-ledger and counts, and accepts
only the exact two B1-503 migration files/checksums.

For an uncompressed `git archive` rather than a clean checkout, use
`STORYFORGE_SOURCE_MODE=archive` and also provide:

```text
STORYFORGE_SOURCE_ARCHIVE=<absolute regular .tar created by git archive>
STORYFORGE_SOURCE_ARCHIVE_SHA256=<exact SHA-256>
STORYFORGE_SOURCE_ARCHIVE_PREFIX=<optional safe archive prefix ending in />
```

The archive's embedded Git commit and every migration/bootstrap/runner byte are
verified before any database read.

Apply confirmation:

```text
STORYFORGE_MIGRATION_CONFIRM=B1-503-APPLY-TWO-MIGRATIONS
```

The two migrations, ledger inserts, SCRAM password assignment, and
least-privilege `LOGIN` transition share one transaction protected by a
transaction advisory lock. The password is imported through psql `\getenv`; it
is not placed in command arguments or generated SQL.

## 5. Kinsta install contract

Executable:

`storyforge-v5/scripts/install-b1-503-kinsta-release.sh`

The script runs on the Kinsta host; it never opens SSH itself. Replace only the
angle-bracketed values below after resolving them read-only:

```text
bash install-b1-503-kinsta-release.sh preflight \
  --remote-root /www/theresidencyacademy_209/public \
  --release-commit <FINAL_CLEAN_PUSHED_CUTOVER_COMMIT> \
  --route-source <ABSOLUTE_PRIVATE_STAGED_ROUTE> \
  --release-source <ABSOLUTE_PRIVATE_STAGED_RELEASE_PHP> \
  --route-sha256 1cf024fc47f8130f980a79af6090c9f214148ac82c397fb8b94a8b7945c67f61 \
  --route-size 30530 \
  --release-sha256 3215eed4837d9a9d712706003e352ead3423e399bea76c20818270d93fcb199e \
  --release-size 741148 \
  --release-id v-0912286e7dfc2327 \
  --expected-owner theresidencyacademy:www-data \
  --expected-current-target releases/4bd956b6ea222d20428c41415236a73b93576447 \
  --expected-route-sha256 23ca6d28268a780c46c27083a726dab18c3e6125a46a6fda600fd9c03eee2d88 \
  --rollback-dir <ABSOLUTE_NEW_PRIVATE_ROLLBACK_DIRECTORY> \
  --wp-cli <ABSOLUTE_WP_CLI> \
  --php-cli <ABSOLUTE_PHP_CLI>
```

Run `install` with the identical arguments plus:

```text
--confirm B1-503-INSTALL
```

The script:

- refuses a symlinked/noncanonical root, runtime tree, or staged artifact;
- refuses any existing `releases/<final-commit>` path;
- requires private staging outside the public WordPress root;
- verifies artifact hashes, sizes, PHP syntax, release ID, route pins, owner,
  exact prior pointer, exact prior route hash, and feature-off;
- shares one private cutover lock with the rollback script and rechecks the
  mutation-sensitive prestate after acquiring it;
- seals the prior pointer and route in `rollback.tsv` before activation;
- publishes a real `0555` commit directory containing regular `0444`
  `release.php`;
- uses only the exact relative pointer
  `releases/<final-commit>` and an atomic pointer replacement;
- atomically replaces only `missionmed-storyforge-route.php`;
- purges only `wp --path=<root> kinsta cache purge --site` and then `--cdn`;
- leaves every earlier release directory untouched.

If any step fails after the new release directory is published, do not remove
or overwrite that directory to make a retry pass. Contain feature-off, preserve
the receipt/output, and use the rollback contract.

## 6. Kinsta rollback contract

Executable:

`storyforge-v5/scripts/rollback-b1-503-kinsta-release.sh`

The install command emits:

```text
rollback_receipt=<absolute path>/rollback.tsv
rollback_receipt_sha256=<64-lowercase-hex>
```

Record both outside the deployment shell. Preflight:

```text
bash rollback-b1-503-kinsta-release.sh preflight \
  --remote-root /www/theresidencyacademy_209/public \
  --receipt <EXACT_EMITTED_ROLLBACK_RECEIPT> \
  --receipt-sha256 <EXACT_EMITTED_RECEIPT_SHA256> \
  --wp-cli <ABSOLUTE_WP_CLI>
```

Rollback uses the identical arguments plus:

```text
--confirm B1-503-ROLLBACK
```

The rollback sequence is fixed:

1. Force and reverify `storyforge_enabled=false`.
2. Validate the receipt hash, installed immutable release, current pointer, and
   route as either the installed state, the sealed prior state, or a known
   partial combination of those two states.
3. Acquire the shared private cutover lock, recheck the observed route/pointer,
   and preserve them beside the sealed receipt.
4. Restore the exact prior relative pointer from the receipt.
5. Restore the exact prior route bytes/mode, or exact route absence, from the
   receipt.
6. Purge only Kinsta site cache and CDN cache.
7. Reverify feature-off and the restored pointer/route.
8. Prove both old and new immutable release directories still exist.

The script never removes or modifies a release directory. It never runs
`--all`, `--object`, or `purge_complete_caches(true)`.

## 7. Database and service containment after migration

After the B1-503 migrations, the B1-502 runtime must remain feature-off. It
must not be re-enabled against the B1-503 schema.

Normal containment is:

1. force feature-off;
2. restore/disable only the isolated Kinsta pointer and route through the
   sealed receipt;
3. perform only scoped site/CDN purges;
4. prove `/storyforge*` is contained while Matrix, WordPress, protected assets,
   legacy StoryForge, and unrelated routes remain healthy;
5. take the isolated Railway API domain/service offline if necessary;
6. leave PostgreSQL dormant.

Restore PostgreSQL only for verified schema/data corruption, using the exact
PostgreSQL 18 logical restore point above and its rehearsed process. A full
old-product restoration requires both that database restore and the prior
runtime pointer. It is not a normal pointer-only rollback.

## 8. Local safety verification

The local cutover unit fixture performs:

- read-only install preflight;
- confirmed install into a disposable WordPress-shaped filesystem;
- receipt creation and hash verification;
- atomic relative pointer and isolated route activation;
- read-only rollback preflight;
- confirmed rollback to exact prior route/pointer;
- proof that the new immutable release remains byte-identical;
- proof that only `--site` and `--cdn` cache commands were issued;
- existing-release refusal and tampered-receipt refusal;
- migration preflight/apply simulation with exact source, backup, provider,
  database, TLS, three-row pre-ledger, two-pending, five-row post-ledger,
  advisory-lock, and password non-disclosure checks.

This local rehearsal is candidate evidence. It is not a production deployment
or production rollback result.
