# SUPABASE MIGRATION PROTOCOL -- PERMANENT HARDENING

**Authority:** MR-078A
**Version:** 1.0
**Date:** 2026-04-24
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

END OF SUPABASE MIGRATION PROTOCOL
