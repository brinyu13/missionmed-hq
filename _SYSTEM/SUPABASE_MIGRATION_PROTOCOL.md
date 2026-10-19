# SUPABASE MIGRATION PROTOCOL -- PERMANENT HARDENING

**Authority:** MR-078A
**Version:** 1.3
**Date:** 2026-10-18
**Risk Level:** HIGH
**Status:** LOCKED -- NON-NEGOTIABLE

This document governs ALL Supabase migration activity for MissionMed projects. No migration may be created, modified, applied, or repaired without following this protocol. Violations produce INVALID status.

---

## 1. ROOT CAUSE ANALYSIS

### 1.1 What Happened

On 2026-04-22, the MissionMed Growth Engine project (`plgndqcplokwiuimwhzh`) experienced a full migration system failure. The `supabase_migrations.schema_migrations` table is now empty (zero rows) despite 30+ local migration SQL files existing in `/supabase/migrations/`. This means the CLI and DB are fully desynchronized.

### 1.2 Exact Failure Chain

```
1. A migration file was created with a shortened timestamp "20260422"
   (8 digits instead of the required 14-digit YYYYMMDDHHmmss format)

2. Supabase CLI attempted to register this version in schema_migrations

3. The CLI's version-comparison logic treats timestamps as lexicographic strings.
   "20260422" sorts BEFORE "20260324190000" (first migration) because it is
   shorter, creating an impossible ordering conflict

4. db push failed with version mismatch error

5. Operator ran `supabase migration repair` in a loop attempting to fix it

6. Each repair pass either:
   - Deleted the phantom row but left orphan state
   - Re-inserted it with "reverted" status, creating a new conflict

7. Eventually the entire schema_migrations table was emptied
   (either by repeated repairs or manual truncation)

8. With zero rows in schema_migrations, CLI now believes
   NO migrations have ever been applied, but the actual database
   objects (tables, functions, RLS policies) all exist

9. db push / db pull both fail because:
   - push: tries to re-apply all 30+ migrations, hits "already exists" errors
   - pull: generates a diff against an empty history, producing garbage
```

### 1.3 Five Failure Modes in Supabase Migrations

**MODE 1: PHANTOM VERSION**
A migration file timestamp does not match the 14-digit `YYYYMMDDHHmmss` format. The CLI registers a malformed version string. All subsequent comparisons break.

**MODE 2: DUPLICATE TIMESTAMP**
Two migration files share the same timestamp. The CLI picks one arbitrarily or fails. The second file is either silently skipped or double-applied.

**MODE 3: CLI/DB DESYNC**
Local migration files exist that have no corresponding row in `schema_migrations`, OR rows exist in `schema_migrations` with no corresponding local file. Push and pull both fail.

**MODE 4: HISTORY CORRUPTION**
The `schema_migrations` table contains rows with `reverted` status from `migration repair` that were never actually reverted in the database. The schema is applied but the history says it is not.

**MODE 5: OUT-OF-ORDER APPLICATION**
A migration with a timestamp EARLIER than the last applied migration is added after the fact. The CLI may skip it entirely or apply it in the wrong position, breaking dependency chains.

---

## 2. MIGRATION RULE SYSTEM (NON-NEGOTIABLE)

### 2.1 Naming Convention

**Format:** `YYYYMMDDHHmmss_<ticket_id>_<descriptor>.sql`

```
VALID:   20260424150000_mr_078a_migration_hardening.sql
VALID:   20260424150100_vdrl_084_drill_scoring.sql
INVALID: 20260424_fix.sql              (timestamp too short)
INVALID: migration_v2.sql              (no timestamp)
INVALID: 20260424150000.sql            (no descriptor)
INVALID: 20260424150000_fix things.sql (spaces in name)
```

**Rules:**
- Timestamp MUST be exactly 14 digits: `YYYYMMDDHHmmss`
- Timestamp MUST be in UTC
- Ticket ID MUST reference a valid MR- or system task ID
- Descriptor MUST use snake_case, no spaces, no special characters
- Extension MUST be `.sql`

### 2.2 Timestamp Rules

- Timestamp MUST be generated at file creation time, not backdated
- Timestamp MUST be STRICTLY GREATER THAN the latest existing migration timestamp
- Minimum gap between consecutive migrations: 60 seconds (prevents collision on rapid creation)
- NEVER manually edit a timestamp after the file is created
- NEVER rename a migration file after it has been committed or applied

### 2.3 Sequencing Rules

- Migrations MUST be applied in strict ascending timestamp order
- A migration MAY NOT reference objects created by a migration with a later timestamp
- Dependencies MUST be satisfied by earlier migrations, never by "it already exists in prod"
- If migration B depends on migration A, B's timestamp MUST be greater than A's

### 2.4 File Structure Rules

Every migration file MUST begin with this header block:

```sql
-- Migration: <filename>
-- Authority: <ticket_id>
-- Date: <YYYY-MM-DD>
-- Depends on: <previous_migration_filename or "none">
-- Description: <one-line summary>
-- Idempotent: YES or NO

BEGIN;

-- migration body here

COMMIT;
```

**Rules:**
- Every migration MUST be wrapped in `BEGIN; ... COMMIT;`
- Every migration SHOULD be idempotent where possible (use `IF NOT EXISTS`, `CREATE OR REPLACE`, `DROP ... IF EXISTS` before `CREATE`)
- Non-idempotent migrations MUST be marked `Idempotent: NO` in the header
- Never use `CASCADE` in DROP statements unless explicitly justified in the header
- Never modify `supabase_migrations.schema_migrations` directly in a migration file

---

## 3. OPERATOR SAFETY RULES

### 3.1 ALLOWED Commands

| Command | When | Notes |
|---------|------|-------|
| `supabase db push` | After pre-deploy checklist passes | Standard deployment path |
| `supabase db pull` | To capture remote-only changes | Creates `remote_schema.sql` |
| `supabase db diff` | To preview changes before creating a migration | Review-only, does not apply |
| `supabase migration new <name>` | To create a new empty migration file | Generates correct timestamp |
| `supabase migration list` | To audit current state | Read-only |
| `supabase db lint` | To check for schema issues | Read-only |

### 3.2 BANNED Commands (NEVER USE)

| Command | Why |
|---------|-----|
| `supabase migration repair --status reverted <version>` | Marks a migration as reverted WITHOUT actually reverting the SQL. Creates phantom state where objects exist but history says they do not. This is the PRIMARY cause of the 2026-04-22 failure. |
| `supabase migration repair --status applied <version>` | Inserts a fake "applied" row for a migration that may not have actually run. If the SQL was partial or different, the DB and history diverge silently. |
| `supabase db reset` (on production) | Drops and recreates the entire database. Destroys all data. Only valid for local dev. |
| Direct `INSERT`/`UPDATE`/`DELETE` on `supabase_migrations.schema_migrations` | Manual history manipulation. Guaranteed to create CLI/DB desync. |
| `supabase migration squash` (on production history) | Replaces multiple migration files with a single combined one. Breaks any environment that already applied the originals. |

### 3.3 When Repair is Allowed

**ONLY** when ALL of the following are true:

1. You have a complete backup of the `schema_migrations` table contents
2. You have verified every object the migration creates/modifies actually exists (or does not exist) in the live database
3. You have documented the exact repair action and justification in the activity log BEFORE executing it
4. The repair is `--status applied` for a migration you have VERIFIED was fully applied by inspecting every object it creates
5. You are repairing exactly ONE migration at a time, verifying after each

**Repair is FORBIDDEN** when:
- You are in a loop (if repair did not fix it on the first try, STOP)
- You are unsure whether the migration was fully applied
- You are using `--status reverted` (this command is permanently banned)

---

## 4. PRE-DEPLOY CHECKLIST

Run this checklist BEFORE every `supabase db push`. Every item must PASS. Any FAIL = ABORT.

```
PRE-DEPLOY CHECKLIST -- MR-078A

[ ] 1. TIMESTAMP VALIDATION
    - Every file in supabase/migrations/ has a 14-digit timestamp prefix
    - No duplicate timestamps exist
    - Files are in strict ascending timestamp order
    - No timestamp is in the future

[ ] 2. HISTORY SYNC CHECK
    - Run: supabase migration list
    - Every "applied" migration in the DB has a matching local file
    - Every local file that should be applied IS applied
    - No "reverted" status entries exist (if they do, STOP)

[ ] 3. FILE INTEGRITY
    - Every .sql file has the required header block
    - Every .sql file is wrapped in BEGIN/COMMIT
    - No file contains direct manipulation of schema_migrations
    - No file uses CASCADE drops without documented justification

[ ] 4. DEPENDENCY ORDER
    - Each migration's "Depends on" header points to a migration
      with an earlier timestamp
    - No circular dependencies exist

[ ] 5. DIFF REVIEW
    - Run: supabase db diff
    - Review the output to confirm it matches expected changes
    - No unexpected object creation/deletion

[ ] 6. BACKUP
    - Export current schema_migrations table contents:
      SELECT version, name FROM supabase_migrations.schema_migrations
      ORDER BY version;
    - Save output to _SYSTEM_LOGS/migration_history_backup_<date>.txt
```

---

## 5. FAILURE RECOVERY PLAYBOOK

### 5.1 Decision Tree

```
MIGRATION FAILURE DETECTED
  |
  +-- Can you identify the EXACT failing migration?
  |     |
  |     +-- YES --> Is it the LATEST (most recent) migration only?
  |     |     |
  |     |     +-- YES --> Was it partially applied?
  |     |     |     |
  |     |     |     +-- YES --> Go to RECOVERY PATH A (Manual Rollback)
  |     |     |     +-- NO  --> Go to RECOVERY PATH B (Safe Retry)
  |     |     |
  |     |     +-- NO --> STOP. Do NOT attempt multi-migration repair.
  |     |               Go to RECOVERY PATH C (Full Reconciliation)
  |     |
  |     +-- NO --> STOP. Go to RECOVERY PATH C (Full Reconciliation)
```

### 5.2 RECOVERY PATH A: Manual Rollback (Latest Migration Partially Applied)

```
1. Identify every object the migration attempted to create/modify
2. For each object:
   a. Check if it exists: \d <object_name>
   b. If it exists and should not: DROP it manually
   c. If it was altered incorrectly: ALTER it back
3. Delete the migration's row from schema_migrations:
   DELETE FROM supabase_migrations.schema_migrations
   WHERE version = '<timestamp>';
4. Fix the migration SQL file
5. Re-run: supabase db push
6. Verify: supabase migration list
```

### 5.3 RECOVERY PATH B: Safe Retry (Latest Migration Not Applied)

```
1. Confirm the migration has NO row in schema_migrations
2. Confirm no objects from the migration exist in the database
3. Fix the migration SQL file if needed
4. Run: supabase db push
5. Verify: supabase migration list
```

### 5.4 RECOVERY PATH C: Full Reconciliation (Multiple Migrations or Unknown State)

This is the nuclear option. Use ONLY when the history is irrecoverably corrupted.

```
1. FREEZE: No one touches the database or migration files

2. SNAPSHOT CURRENT STATE:
   a. Export full schema: supabase db pull (save output separately)
   b. Export schema_migrations:
      SELECT * FROM supabase_migrations.schema_migrations ORDER BY version;
   c. List local migration files with timestamps
   d. Save all three outputs to _SYSTEM_LOGS/

3. BUILD RECONCILIATION MAP:
   For each local migration file:
   +-- Check if its objects exist in the live database
   +-- Check if it has a row in schema_migrations
   +-- Classify as: APPLIED / NOT_APPLIED / PARTIAL / UNKNOWN

4. REPAIR (one at a time, in timestamp order):
   For each migration classified as APPLIED but missing from schema_migrations:
   a. VERIFY every object it creates actually exists
   b. Run: supabase migration repair --status applied <version>
   c. Run: supabase migration list
   d. Confirm the row appeared correctly

   For each migration classified as PARTIAL:
   a. Manually complete or rollback the partial objects
   b. Then treat as APPLIED or NOT_APPLIED accordingly

5. VALIDATE:
   a. supabase migration list shows correct state
   b. supabase db diff shows no unexpected changes
   c. supabase db push succeeds with "no new migrations"

6. DOCUMENT everything in _SYSTEM_LOGS/MM_ACTIVITY_LOG.md
```

### 5.5 What We Did on 2026-04-22 (Post-Mortem Reference)

The schema_migrations table was fully emptied. The database objects remain intact. The correct recovery path was PATH C. The state as of 2026-04-24:

- Local files: 30+ migrations in `/supabase/migrations/`
- DB history: 0 rows in `schema_migrations`
- DB objects: All tables, functions, policies exist
- Required action: Full reconciliation (PATH C) to re-register all applied migrations

---

## 6. CODEX / AI AGENT INTEGRATION RULES

These rules apply to ANY AI agent (Claude, Codex, or other) that touches migration files.

### 6.1 Before Creating a Migration

```
REQUIRED VALIDATION:
1. List all existing migration files and extract their timestamps
2. Confirm the new timestamp is:
   a. Exactly 14 digits
   b. In UTC
   c. Strictly greater than the highest existing timestamp
   d. At least 60 seconds after the highest existing timestamp
3. Confirm the filename follows: YYYYMMDDHHmmss_<ticket>_<descriptor>.sql
4. Confirm no other migration file has the same timestamp
5. Include the required header block
6. Wrap all SQL in BEGIN/COMMIT
```

### 6.2 Before Modifying a Migration

```
RULES:
- NEVER modify a migration that has been applied (has a row in schema_migrations)
- NEVER rename a migration file
- NEVER change a migration's timestamp
- If a correction is needed, create a NEW migration that fixes the issue
- The only exception: a migration that has NEVER been applied AND
  has NEVER been committed to version control may be edited in place
```

### 6.3 Before Running db push

```
REQUIRED:
1. Run the full PRE-DEPLOY CHECKLIST (Section 4)
2. If ANY check fails, STOP and report
3. Never run db push with --force or equivalent flags
4. Never run db push to fix a db push failure (creates loops)
```

### 6.4 After Any Migration Action

```
REQUIRED VALIDATION:
1. Run: supabase migration list
2. Confirm the new migration appears with status "applied"
3. Run: supabase db diff
4. Confirm no unexpected schema drift
5. If ANYTHING is unexpected, STOP and report
6. Log the action in MM_ACTIVITY_LOG.md
```

### 6.5 Forbidden AI Agent Actions

| Action | Reason |
|--------|--------|
| Running `supabase migration repair` | Banned per Section 3.2 (repair loops are the #1 cause of corruption) |
| Creating migrations with short timestamps | Phantom version creator |
| Modifying applied migrations | Creates CLI/DB desync |
| Running `supabase db reset` on production | Data destruction |
| Inserting rows into `schema_migrations` | Manual history manipulation |
| Generating timestamps by hand without validation | Error-prone, use `supabase migration new` or validate programmatically |

### 6.6 AI Agent Pre-Flight Script

Before ANY migration work, the agent MUST run this validation:

```bash
#!/bin/bash
# Migration pre-flight validation
# Run from project root

MIGRATION_DIR="supabase/migrations"
ERRORS=0

echo "=== MIGRATION PRE-FLIGHT CHECK ==="

# Check 1: All files have 14-digit timestamps
for f in "$MIGRATION_DIR"/*.sql; do
  basename=$(basename "$f")
  ts=$(echo "$basename" | grep -oP '^\d+')
  if [ ${#ts} -ne 14 ]; then
    echo "FAIL: Invalid timestamp length (${#ts}) in $basename"
    ERRORS=$((ERRORS + 1))
  fi
done

# Check 2: No duplicate timestamps
dupes=$(ls "$MIGRATION_DIR"/*.sql | xargs -I{} basename {} | \
  grep -oP '^\d{14}' | sort | uniq -d)
if [ -n "$dupes" ]; then
  echo "FAIL: Duplicate timestamps found: $dupes"
  ERRORS=$((ERRORS + 1))
fi

# Check 3: Ascending order
prev=""
for f in $(ls "$MIGRATION_DIR"/*.sql | sort); do
  ts=$(basename "$f" | grep -oP '^\d{14}')
  if [ -n "$prev" ] && [ "$ts" \< "$prev" ]; then
    echo "FAIL: Out-of-order timestamp: $ts after $prev"
    ERRORS=$((ERRORS + 1))
  fi
  prev="$ts"
done

if [ $ERRORS -eq 0 ]; then
  echo "PASS: All pre-flight checks passed"
else
  echo "ABORT: $ERRORS errors found. Do NOT proceed with migration."
  exit 1
fi
```

---

## ENFORCEMENT

This protocol is LOCKED under MR-078A authority. Changes require:
1. A new MR- ticket with explicit justification
2. Root cause analysis of why the change is needed
3. Updated version number and date in this document

Any migration action that violates this protocol produces STATUS = INVALID.

---

## 7. EXACT IVOC G2 EXECUTOR ADAPTER - MR-IVOC-8200-G2-MIGRATION-PROTOCOL

This narrowly scoped amendment applies only to IVOC-CONVERGE-8001 and the already committed file `supabase/migrations/20261015174803_ivoc_native_voice_admission_ledger.sql`, SHA-256 `972213128023be285ab2202040f4667977828aaf6c9debff20e6ddb4c24ed442`, from source commit `40b1c62dc2951cc19380baa874ced58d994aa049`. It changes no other migration rule or project authority. Its exact canonical decision, independent review, production executor, tested recovery and native custody must be filed before application. This document alone grants no production execution.

Root cause: this source-only safeguards migration was committed without the section2.4 header/explicit transaction block; correcting it in place would violate section6.2. The exposed Management API does not bind a caller-selected migration version or document body/history atomicity. A blind explicit COMMIT wrapper can separate migration body from the CLI's appended history insertion. Rewriting earlier history or source filenames is not an acceptable repair.

For this exact file only, preserve its committed bytes and filename. Satisfy header provenance through a separately immutable execution manifest containing filename, this MR ticket and canonical decision, date, verified actual predecessor history, description, and `Idempotent: NO`. Satisfy transactional execution through the pinned official Supabase CLI v2.75.0 implementation (upstream commit `e07c7ea15b842e9bb45c79518a5f20cea84fc753`): its migration ExecBatch sends the body and filename-derived history insertion in one implicit transaction. Do not add BEGIN, COMMIT, ROLLBACK or an alternative SQL body.

Use a private external execution workspace containing the actual complete remote migration history reconstructed by official migration fetch, plus only this unchanged file as the sole pending migration. Verify actual statement content and complete history equality, not placeholder files; current expected prior history is18 rows, latest20261009001803. Any changed/incomplete history, unexpected pending file, existing candidate history/object, different source/executor, credential or fence uncertainty stops before application. No --include-all, broad push, source rename, manual history writes, repair or automatic retry.

The CLI's history-table bootstrap prelude is permitted only when independently verified existing schema/table/columns make every IF NOT EXISTS/ADD COLUMN IF NOT EXISTS operation structurally inert; empty vault and no-seed settings are mandatory. Exact installed binary/config/cache/workspace/target, memory-only credentials, bounded timeouts and owned-process cleanup, current native database fencing, at most one candidate application attempt, tested recovery and independent pre/post catalog/history checks require a dedicated canonical production grant. This amendment is not that grant and does not arm any provider grant or permit a paid session.

All other sections, prohibitions, predeploy checks and unrelated project requirements remain in force. Eligibility remains blocked while independent gates are missing. This exception expires when its single admitted application reaches a confirmed terminal outcome or on Founder revocation; any material drift stops the affected operation for renewed review. An uncertain outcome is preserved for read-only diagnosis; it supplies no retry permission.

### 7.1 Exact supported migration API alternative - MR-IVOC-8200-G2-SUPPORTED-MIGRATION-API

This alternative applies only to the same source commit, filename and SHA256972213128023be285ab2202040f4667977828aaf6c9debff20e6ddb4c24ed442 in section7 and production project bscnrgqlwsyygyfrbhfn. Its dedicated canonical production grant must select this route explicitly; this protocol amendment is not execution permission. The CLI route remains separately gated, never an automatic fallback.

Root cause and new evidence: the earlier API reference lacked transactional detail, while the subsequently located official Supabase for Platforms guide, Make database changes, documents that POST /v1/projects/{ref}/database/migrations automatically records and runs a migration and rolls changes back on schema-migration failure. Reference https://supabase.com/docs/guides/integrations/supabase-for-platforms#make-database-changes; pinned official source7425d4930528931400fb3e656e860b1094cb224e, apps/docs/content/guides/integrations/supabase-for-platforms.mdx SHA256e2f84a8746d92da2a4558fea5c215786cae74d2dabe372e81b59c590e9059795. This supported contract permits a less disruptive credential route without SSL/JIT/restart. It does not establish proprietary implementation details, history-insert-error body rollback, exactly-once transport or post-commit disaster restoration. Do not describe it as the tested CLI body/history transaction.

For this exact alternative, an independently reviewed invocation of the supported Supabase MCP apply_migration(name, project_id, query), verified to call that POST endpoint, may replace the CLI executor. Use name ivoc_native_voice_admission_ledger, exact project above and unchanged source SQL as query. Retain immutable external header provenance and Idempotent: NO. No explicit transaction wrapper, alternate SQL, rollback body, manual history DML, repair, source edit/rename, include-all or bulk push. Raw SQL Editor Run, execute_sql for the migration body, and a separate history-registration call are not substitutes. Existing connector authentication requires no new password, role, JIT mapping or settings grant.

The provider-generated actual migration version is permitted to differ from source timestamp20261015174803. Independently bind the actual new row/version/name/statements to the immutable source filename/commit/hash and exact request in a durable mapping; never rename source or rewrite history to manufacture equality. A reviewed deterministic nonlossy representation must prove the recorded statements correspond to the submitted body. Preserve every actual predecessor row and statement. Future CLI custody must honor this mapping and must not reapply the original source timestamp; no broad history-reconciliation authority is implied.

Before the single application, require the dedicated grant's complete actual history/catalog preimage, no candidate history/objects, exact private-RLS/INVOKER/service-grant expectations, native database custody and competing-writer controls, durable once marker, exact invocation review and fresh GO. Existing local SQL/ACL and CLI recovery evidence remains valid only for its tested scope, not proof of API backend or production PG17 failure behavior. No new test attempt is created here. The CLI-only workspace/fetch/bootstrap/vault conditions apply when CLI is selected; the API alternative instead binds its complete authoritative history/catalog reads and supported endpoint behavior. No separate bootstrap, vault or seed mutation is authorized.

Success requires independent readback of unchanged predecessors, exactly one correctly mapped new history entry, the exact expected catalog/ACL/RLS and empty unarmed ledger. Tool success alone is insufficient. Schema failure uses the documented rollback contract but rollback confirmation requires readback; even confirmed rollback creates no retry permission. Lost response, timeout, malformed result, partial/mismatched history or objects stops downstream mutations. The request may still be running remotely: immediate absence, local cancellation and closed transport do not establish terminal rollback. Preserve UNKNOWN and use only the dedicated grant's finite exact read-only reconciliation; no replay, repair, compensating SQL, deletion or deployment.

MR079's exact companion exception is mandatory. This section supersedes only section7's CLI-only executor, filename-derived remote-version equality and CLI-specific preparation for the selected API alternative. All unrelated MR078A/MR078B safeguards, independent gates and separate release/provider permissions remain unchanged.

---

END OF SUPABASE MIGRATION PROTOCOL

### 7.2 Exact supervised risk-acceptance forward migration API adapter - MR-IVOC-8200-RISK-ACCEPTED-ONE-TEST-API

This adapter applies only to mission IVOC-CONVERGE-8001, approval IVOC-8200-RISK-ACCEPTED-ONE-TEST-20261018, production project bscnrgqlwsyygyfrbhfn, and the new forward file `supabase/migrations/20261018215958_ivoc_supervised_risk_acceptance.sql`, SHA-256 `c23261e6a7dded5f6922103fe6677e0d0e923dcc4e1c70fd9e7b993d12d0a8db`, in independently published source commit `bc1427315ff576c0d3ae60f29c7915535ccfbf39`. Founder receipt SHA-256 b4ea2e2197cd7838b888ca2675b07fb70f9df36d71032ae0f65bf1e9bcc8b9b0 and operator terms SHA-256 cb863c68de753a629c647a7eeec342918ef3720a72bedc12129d073f967c37d9 bind the one-test purpose. These exact amendments and canonical dependency closure must precede the dedicated production phase. This document grants no execution, arming or paid Start by itself.

Root cause: the prior G2 adapter is restricted to its old SQL972213/source40b1 and cannot authorize this new forward change. The old ledger truthfully requires provider-guaranteed hard-ceiling proof; the Founder now explicitly accepts documented reasonable residual exposure for one supervised native test. The new file adds an explicit risk mode without fabricating hard proof, preserves the old hard mode and consumed accounting, and supplies only approval-specific service-role arm/disarm/status controls plus atomic owned first-Start binding. Applied migration bytes and historical rows must remain unchanged. This is a new migration ticket, not reuse of a consumed G2 application allowance.

Select only the same supported POST /v1/projects/{ref}/database/migrations-backed Supabase MCP apply_migration(name, project_id, query) route documented in section7.1. Use name `ivoc_supervised_risk_acceptance`, the exact project above and the complete unchanged final published file as query. The official source/endpoint evidence and honest transactional limits in section7.1 are retained: documented schema-failure rollback is not proof of history-insert-error atomicity, exactly-once transport, remote termination or post-commit restoration. Do not add an executor SQL wrapper or alternative body. Preserve the candidate's independently reviewed transaction structure; no SQL Editor/execute_sql body, separate history insertion, CLI fallback, repair, broad push, source rename or history rewrite.

Before ONE production application attempt, bind the exact final source commit/file/digest, new ticket/canonical decision, date, purpose, actual predecessor history and `Idempotent: NO` in an immutable execution manifest. Require independently reviewed local SQL/ACL/race evidence, complete authoritative history/catalog preimage, no candidate history/objects, exact expected private RLS/role grants and mandatory immutability trigger, fresh native database custody/competing-writer proof, durable once marker, fixed invocation review and fresh phase GO. Final commit/digest slots may be resolved only from the separately independently accepted candidate under the dedicated decision's exact three source paths and bounded repair counts; no other amendment text or scope may change. HQ publication and OS dependency closure must then bind the resolved bytes; both BOOT checks must PASS before any migration application. Until then this adapter is not production-ready.

Success requires independent readback of every unchanged predecessor row/statement, exactly ONE new provider-version/name/body mapping to this final source, and the exact expected catalog/ACL/RLS with no armed grant/reservation introduced by migration. The provider's actual remote version may differ from source timestamp; use the same deterministic nonlossy body mapping as section7.1 and never reapply the source timestamp. Preserve all existing ledger consumption, attempts, reservations, quarantine, admin QA OFF accounting and historical UNKNOWNs. No accounting reset, broader role grant, public INSERT, secret publication or unrelated data mutation.

A lost/timeout/malformed response, mismatch, partial catalog/history or uncertain body outcome stops downstream mutations. Absence, cancellation and closed local transport do not establish rollback. Preserve UNKNOWN; use only the dedicated decision's finite exact read-only reconciliation, without replay, compensating SQL, automatic retry or deployment. A confirmed rollback does not restore the single production attempt. MR079's exact companion and MR078B/privacy/identity invariants remain mandatory. All other safeguards remain unchanged; expiry/revocation of the fixed approval closes unused execution.
