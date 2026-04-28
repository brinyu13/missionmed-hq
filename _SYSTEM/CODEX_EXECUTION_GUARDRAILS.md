# CODEX EXECUTION GUARDRAILS -- HARD SAFETY SYSTEM

**Authority:** MR-079
**Version:** 1.0
**Date:** 2026-04-24
**Risk Level:** HIGH
**Status:** LOCKED -- NON-NEGOTIABLE
**Depends On:** MR-078A (Migration Protocol), MR-078B (Data Flow Contract), MM-AUTH-ARCH-001

This document governs ALL Codex execution within the MissionMed system. Every Codex prompt MUST include this document or a reference to it. Codex is treated as a powerful but untrusted executor. These rules are not suggestions. They are hard constraints.

---

## COPY-PASTE PREAMBLE (include in every Codex prompt)

```
CODEX SAFETY RULES (MR-079):
Before executing ANY command, you MUST:
1. Read _SYSTEM/CODEX_EXECUTION_GUARDRAILS.md
2. Read _SYSTEM/SUPABASE_MIGRATION_PROTOCOL.md (if touching migrations)
3. Read _SYSTEM/DATA_FLOW_CONTRACT.md (if touching data layer)
4. Classify your task risk level (LOW / MEDIUM / HIGH)
5. Run pre-execution checks for your risk level
6. Execute ONLY whitelisted commands
7. Run post-execution validation
8. STOP on any unexpected output

You are NOT authorized to:
- Run migration repair commands
- Modify schema_migrations
- Modify applied migrations
- Drop tables or columns without explicit approval
- Bypass RLS policies
- Access answer_map pre-finalization
- Modify auth endpoints
- Execute commands not on the whitelist
```

---

## 1. GLOBAL CODEX RULESET

### 1.1 Absolute Rules (NEVER Violate)

| # | Rule | Consequence of Violation |
|---|------|-------------------------|
| G-1 | NEVER run a command you have not verified is on the whitelist (Section 5) | STOP. Report. Do not continue. |
| G-2 | NEVER modify a file without reading it first | STOP. Read first. Then modify. |
| G-3 | NEVER assume a previous command succeeded without checking output | Read output. Verify. Then proceed. |
| G-4 | NEVER chain destructive commands (DROP, DELETE, TRUNCATE, repair) | One destructive command per execution cycle. Verify after each. |
| G-5 | NEVER modify production data without explicit backup confirmation | Backup first. Verify backup. Then modify. |
| G-6 | NEVER run the same failing command twice without understanding why it failed | If it failed once, STOP. Analyze. Report. |
| G-7 | NEVER create migration files with timestamps shorter than 14 digits | Use `supabase migration new` or validate programmatically. |
| G-8 | NEVER modify `supabase_migrations.schema_migrations` directly | This table is managed by CLI only. |
| G-9 | NEVER use `supabase migration repair --status reverted` | Permanently banned. See MR-078A. |
| G-10 | NEVER access `answer_map` in any query for non-finalized duels | Anti-cheat invariant. See MR-078B INV-1. |
| G-11 | NEVER create RLS policies with `USING (true)` on authenticated-role tables containing user data | Identity isolation invariant. See MR-078B INV-5. |
| G-12 | NEVER call `supabase.auth.signUp()` from frontend code | WordPress is identity provider. See MR-078B INV-7. |
| G-13 | NEVER embed service_role keys in frontend code | Security boundary. Service role is server-only. |
| G-14 | NEVER modify the duel state machine trigger (`duel_state_monotonic_fn`) | State integrity invariant. See MR-078B INV-3. |
| G-15 | NEVER trust client-submitted scores | Server-authoritative scoring. See MR-078B INV-2. |

### 1.2 Commands That Are ALWAYS Forbidden

```
# PERMANENTLY BANNED -- DO NOT RUN UNDER ANY CIRCUMSTANCES

supabase migration repair --status reverted *
supabase db reset                              # on production projects
DROP DATABASE *
TRUNCATE supabase_migrations.schema_migrations
INSERT INTO supabase_migrations.schema_migrations *
UPDATE supabase_migrations.schema_migrations *
DELETE FROM supabase_migrations.schema_migrations *
supabase migration squash                      # on production history
DROP SCHEMA public CASCADE
DROP SCHEMA command_center CASCADE
ALTER TABLE dataset_questions *                # dataset is immutable
DELETE FROM dataset_questions *
UPDATE dataset_questions *
INSERT INTO dataset_questions *                # runtime; migration-only
rm -rf supabase/migrations/*
```

### 1.3 Commands That Require Explicit Approval

These commands are allowed ONLY when the prompt explicitly authorizes them AND pre-execution checks pass:

| Command | Required Authorization |
|---------|----------------------|
| `supabase migration repair --status applied <version>` | Prompt must say "REPAIR AUTHORIZED for version <X>". Pre-verify the migration was fully applied. One version at a time only. |
| `DROP TABLE <name>` | Prompt must say "DROP AUTHORIZED for <table>". Must confirm no FK references. Must confirm table is empty or data is backed up. |
| `DROP FUNCTION <name>` | Prompt must say "DROP AUTHORIZED for <function>". Must confirm no callers reference it. |
| `ALTER TABLE ... DROP COLUMN` | Prompt must say "COLUMN DROP AUTHORIZED". Must confirm no queries reference the column. |
| `DELETE FROM <table> WHERE ...` | Prompt must say "DELETE AUTHORIZED". Must confirm the WHERE clause is scoped (no unqualified DELETE). |
| `supabase db push` | Pre-deploy checklist (MR-078A Section 4) must pass. |

---

## 2. MIGRATION-SPECIFIC GUARDRAILS

### 2.1 Allowed Migration Operations

| Operation | Command | Conditions |
|-----------|---------|------------|
| Create new migration | `supabase migration new <name>` | Name follows `<ticket>_<descriptor>` convention. |
| Write migration SQL | File edit in `supabase/migrations/` | NEW files only. 14-digit timestamp. Header block. BEGIN/COMMIT. See MR-078A. |
| Preview changes | `supabase db diff` | Read-only. No side effects. |
| List migrations | `supabase migration list` | Read-only. |
| Lint schema | `supabase db lint` | Read-only. |
| Apply migrations | `supabase db push` | ONLY after full pre-deploy checklist passes. |
| Pull remote schema | `supabase db pull` | Creates local file. Review before use. |

### 2.2 Forbidden Migration Operations

| Operation | Why |
|-----------|-----|
| Edit applied migration file | Creates CLI/DB desync. The DB has the old SQL. The file has new SQL. They will never match. |
| Rename migration file | Changes the version. CLI loses track of it. |
| Change migration timestamp | Same as rename. Breaks ordering. |
| Delete migration file | CLI sees "applied version with no local file" = error state. |
| Run `migration repair` in a loop | If repair did not fix it on attempt #1, STOP. Something deeper is wrong. Looping makes it worse. |
| Manually edit `schema_migrations` | CLI is the only authorized writer of this table. |
| Use `supabase db reset` on production | Drops all data. This is not a migration operation. |
| Create migration targeting wrong project | RANKLISTIQ vs GROWTH ENGINE. Verify project before push. See MR-078B Section 0. |

### 2.3 Required Validation Before ANY Migration Command

```
BEFORE creating a migration:
  [ ] List all existing migrations: ls supabase/migrations/*.sql | sort
  [ ] Extract latest timestamp
  [ ] Confirm new timestamp > latest by at least 60 seconds
  [ ] Confirm timestamp is exactly 14 digits
  [ ] Confirm no duplicate timestamp exists
  [ ] Confirm file has header block + BEGIN/COMMIT

BEFORE running db push:
  [ ] Run full MR-078A pre-deploy checklist (6 items)
  [ ] Confirm target project is correct (RANKLISTIQ vs GROWTH ENGINE)
  [ ] Review supabase db diff output

BEFORE running db pull:
  [ ] Confirm this will not overwrite local migration files
  [ ] Know which project you are pulling from
```

---

## 3. PRE-EXECUTION CHECK SYSTEM

### 3.1 Before Running ANY Command

Every Codex execution cycle begins with this check:

```
STEP 1: CLASSIFY RISK
  - READ-ONLY (ls, cat, SELECT, diff, lint, list) --> LOW
  - NEW FILE CREATION (new migration, new function) --> MEDIUM
  - MODIFY EXISTING (ALTER, UPDATE, db push, DROP) --> HIGH

STEP 2: LOW RISK
  - Verify command is on whitelist (Section 5)
  - Execute
  - Read output

STEP 3: MEDIUM RISK
  - Verify command is on whitelist
  - Verify target file/table exists
  - Verify no naming convention violations
  - Execute
  - Read output
  - Verify expected result

STEP 4: HIGH RISK
  - Verify command is on whitelist OR has explicit authorization
  - Verify target file/table exists
  - Take backup or snapshot of affected state
  - State what you expect the output to be BEFORE executing
  - Execute
  - Compare actual output to expected output
  - If mismatch: STOP. Report. Do not continue.
  - Run post-execution validation (Section 4)
```

### 3.2 Required Confirmations

| Action | Confirmation Required |
|--------|----------------------|
| Creating a new table | State the table name, columns, and which project it targets |
| Creating a new RPC | State the RPC name, parameters, return type, and whether it is SECURITY DEFINER |
| Creating an RLS policy | State the table, role, operation, and USING clause |
| Modifying an existing RPC | State what changes and why the existing callers are unaffected |
| Running db push | State which project, how many new migrations, and what they do |
| Any DELETE/DROP/TRUNCATE | State exactly what will be removed and confirm it is safe |

---

## 4. POST-EXECUTION VALIDATION

### 4.1 After Schema Changes (migrations, DDL)

```
REQUIRED CHECKS:
  [ ] supabase migration list -- confirm new migration shows "applied"
  [ ] supabase db diff -- confirm no unexpected schema drift
  [ ] SELECT count(*) FROM <new_table> -- confirm table exists (if created)
  [ ] SELECT proname FROM pg_proc WHERE proname = '<function>' -- confirm RPC exists (if created)
  [ ] Test the RPC with a minimal call -- confirm it does not error
  [ ] If RLS policy was added: test with both authorized and unauthorized user context
```

### 4.2 After Data Modifications

```
REQUIRED CHECKS:
  [ ] SELECT count(*) FROM <table> -- confirm row count is as expected
  [ ] SELECT * FROM <table> WHERE <modified_condition> LIMIT 5 -- spot check
  [ ] If DELETE was run: confirm only intended rows were removed
  [ ] If UPDATE was run: confirm values are correct
```

### 4.3 After Frontend Changes

```
REQUIRED CHECKS:
  [ ] File renders without syntax errors
  [ ] No new references to answer_map pre-finalization
  [ ] No new supabase.auth.signUp() calls
  [ ] No service_role key exposure
  [ ] Idempotency keys present on all new write RPC calls
  [ ] Error handling present for all new RPC calls
```

### 4.4 Pass/Fail Criteria

| Check | PASS | FAIL |
|-------|------|------|
| Migration applied | Shows in `migration list` with correct version | Missing or wrong version |
| Schema diff clean | `db diff` shows only expected changes | Unexpected objects created/missing |
| RPC callable | Returns expected result or expected error | Unhandled exception or wrong return type |
| RLS enforced | Unauthorized query returns 0 rows or permission error | Unauthorized query returns data |
| No regression | Existing functionality unchanged | Existing test/query produces different result |

---

## 5. SAFE COMMAND WHITELIST

### 5.1 Always Allowed (No Authorization Needed)

```
# FILE OPERATIONS (read-only)
cat <file>
ls <directory>
head / tail <file>
grep / rg <pattern> <file>
wc -l <file>
diff <file1> <file2>

# SUPABASE CLI (read-only)
supabase migration list
supabase db diff
supabase db lint
supabase status

# SQL (read-only)
SELECT ... FROM ... (no INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE)

# GIT (read-only)
git status
git log
git diff
git show
git branch
```

### 5.2 Allowed With Standard Checks

```
# FILE OPERATIONS (write)
echo "..." > supabase/migrations/<new_file>.sql    # NEW files only
vim / nano / edit supabase/migrations/<new_file>.sql # NEW files only

# SUPABASE CLI (write)
supabase migration new <name>
supabase db push                    # ONLY after MR-078A checklist passes
supabase db pull                    # review output before use

# SQL (write, via migration)
CREATE TABLE ...
CREATE OR REPLACE FUNCTION ...
CREATE POLICY ...
ALTER TABLE ... ADD COLUMN ...
CREATE INDEX ...
GRANT ... ON ... TO ...
INSERT INTO ... (non-system tables, runtime-writable tables only)
```

### 5.3 Allowed With Explicit Authorization Only

```
# See Section 1.3 for authorization requirements
supabase migration repair --status applied <version>
DROP TABLE <name>
DROP FUNCTION <name>
ALTER TABLE ... DROP COLUMN ...
DELETE FROM <table> WHERE ...
UPDATE <table> SET ... WHERE ...     # on non-trivial tables
TRUNCATE <table>                     # non-system tables only
```

---

## 6. DANGEROUS COMMAND BLACKLIST

| Command | Risk | Reason | Alternative |
|---------|------|--------|-------------|
| `supabase migration repair --status reverted` | CRITICAL | Creates phantom state. Objects exist but history says they do not. Primary cause of 2026-04-22 failure. | NEVER use. If migration needs reverting, write a new migration that undoes the changes. |
| `supabase db reset` (production) | CRITICAL | Drops all tables and data. Irreversible. | Never on production. Use only for local dev with `--local` flag. |
| `DROP DATABASE` | CRITICAL | Destroys entire database. | Never. |
| `TRUNCATE schema_migrations` | CRITICAL | Wipes migration history. CLI becomes unable to track state. | Never. |
| `INSERT/UPDATE/DELETE schema_migrations` | CRITICAL | Manual history manipulation. Guaranteed desync. | Use `supabase migration repair --status applied` with authorization. |
| `DROP SCHEMA ... CASCADE` | CRITICAL | Drops all objects in schema. Cascading destruction. | Drop individual objects one at a time with verification. |
| `supabase migration squash` | HIGH | Replaces multiple migration files with one. Breaks environments that already applied the originals. | Never on production history. |
| `ALTER TABLE dataset_questions` | HIGH | Dataset is immutable (MR-078B INV-6). | Create a new dataset version in a new table/migration. |
| `DELETE FROM dataset_questions` | HIGH | Same as above. | Never. |
| `UPDATE player_profiles SET ... WHERE player_id != auth.uid()` | HIGH | Cross-user data modification (MR-078B INV-5). | All player writes must be scoped to `auth.uid()`. |
| `SELECT answer_map FROM duel_challenges WHERE state != 'finalized'` | HIGH | Anti-cheat violation (MR-078B INV-1). | Never query answer_map for active duels. |
| `rm -rf supabase/migrations/` | HIGH | Deletes all migration files. CLI/DB desync. | Never. |
| `supabase.auth.signUp()` in frontend | HIGH | Bypasses WordPress identity provider (MR-078B INV-7). | Use `/api/auth/exchange` + `/api/auth/bootstrap` flow. |

---

## 7. FAILURE HANDLING PROTOCOL

### 7.1 Decision Tree: When to STOP vs Continue

```
COMMAND FAILED
  |
  +-- Is the error a SYNTAX ERROR in your SQL/code?
  |     +-- YES --> Fix syntax. Retry ONCE. If still fails, STOP.
  |     +-- NO  --> Continue diagnosis.
  |
  +-- Is the error "already exists" (table, function, constraint)?
  |     +-- YES --> The object exists. Do NOT drop and recreate.
  |     |          Check if the existing object matches your intent.
  |     |          If yes: skip this step.
  |     |          If no: write a new migration to ALTER it.
  |     +-- NO  --> Continue diagnosis.
  |
  +-- Is the error a PERMISSION / RLS error?
  |     +-- YES --> Check you are using the correct role.
  |     |          Do NOT weaken RLS to "fix" it.
  |     |          STOP if you cannot resolve with correct role.
  |     +-- NO  --> Continue diagnosis.
  |
  +-- Is the error a MIGRATION VERSION conflict?
  |     +-- YES --> STOP IMMEDIATELY.
  |     |          Do NOT run repair.
  |     |          Do NOT retry db push.
  |     |          Report the exact error message.
  |     +-- NO  --> Continue diagnosis.
  |
  +-- Is the error a FOREIGN KEY / CONSTRAINT violation?
  |     +-- YES --> Check your data dependencies.
  |     |          Do NOT drop constraints to "fix" it.
  |     |          Ensure parent records exist first.
  |     +-- NO  --> Continue diagnosis.
  |
  +-- Is the error UNKNOWN or UNEXPECTED?
        +-- STOP.
        +-- Report the full error message.
        +-- Do NOT guess and retry.
```

### 7.2 The STOP Protocol

When Codex encounters a situation requiring STOP:

```
1. DO NOT run any more commands
2. DO NOT attempt to fix the issue with another command
3. Report:
   a. The command that was run
   b. The expected output
   c. The actual output (full error message)
   d. What state the system is now in
   e. Whether any partial changes were made
4. Wait for human instruction
```

### 7.3 Error Severity Classification

| Severity | Examples | Action |
|----------|----------|--------|
| FATAL | Migration version conflict, schema_migrations corruption, DROP on wrong table | STOP. Do not continue under any circumstances. Report immediately. |
| HIGH | RLS violation, FK constraint failure, RPC returns unexpected error | STOP. Diagnose. May continue only if root cause is understood AND fix is on whitelist. |
| MEDIUM | "Already exists" errors, syntax errors, type mismatches | Fix and retry ONCE. If fails again, STOP. |
| LOW | Warning messages, deprecation notices, performance warnings | Log and continue. |

---

## 8. "NO-TOUCH" SYSTEM BOUNDARIES

### 8.1 Files Codex Must NEVER Modify

| File/Path | Reason |
|-----------|--------|
| `_SYSTEM/PRIMER_CORE.md` | Workflow OS core. Authority changes require MR- ticket. |
| `_SYSTEM/SUPABASE_MIGRATION_PROTOCOL.md` | Migration protocol. Locked under MR-078A. |
| `_SYSTEM/DATA_FLOW_CONTRACT.md` | Data contract. Locked under MR-078B. |
| `_SYSTEM/CODEX_EXECUTION_GUARDRAILS.md` | This document. Locked under MR-079. |
| `_SYSTEM/RULES_ENGINE.md` | Rules engine. Changes require MR- ticket. |
| `_SYSTEM/NAMING_CANON.md` | Naming canon. Changes require MR- ticket. |
| `08_AI_SYSTEM/MissionMed_AI_Brain/MM-AUTH-ARCH-001.md` | Auth architecture spec. Locked. |
| Any file in `_SYSTEM_LOGS/` (except appending) | Logs are append-only. Never overwrite. |
| Any applied migration file | Applied migrations are immutable. Write new ones. |

### 8.2 Tables Codex Must NEVER Modify at Runtime

| Table | Project | Reason |
|-------|---------|--------|
| `supabase_migrations.schema_migrations` | Both | Migration history. CLI-managed only. |
| `dataset_questions` | RANKLISTIQ | Write-once via migration seed. Immutable at runtime. |
| `dataset_registry` | RANKLISTIQ | Write-once via migration seed. Immutable at runtime. |
| `auth.users` (direct) | Both | Managed by Supabase Auth API via Railway. Never direct SQL. |
| `auth.sessions` | Both | Managed by Supabase Auth. Never direct SQL. |

### 8.3 Systems Codex Must NEVER Modify

| System | Reason |
|--------|--------|
| WordPress database tables | Identity provider. Out of scope for Codex. |
| Railway environment variables | Auth secrets. Manual management only. |
| Supabase project settings (auth config, storage config) | Infrastructure. Dashboard management only. |
| DNS / domain configuration | Infrastructure. Manual management only. |
| Cloudflare configuration | Infrastructure. Manual management only. |

### 8.4 Code Patterns Codex Must NEVER Introduce

| Pattern | Reason |
|---------|--------|
| `supabase.auth.signUp()` in frontend | WordPress is identity provider |
| `createClient(url, SERVICE_ROLE_KEY)` in frontend | Service role is server-only |
| `USING (true)` on user-data RLS policies | Breaks identity isolation |
| `SELECT answer_map` without `state = 'finalized'` check | Anti-cheat |
| Client-side score computation sent to server | Server-authoritative scoring |
| `localStorage.setItem('answer_map', ...)` | Answer data must never be cached |
| `ON CONFLICT DO NOTHING` without idempotency_key | Silently swallows failures |
| `CASCADE` in DROP statements without justification | Uncontrolled destruction |

---

## VERIFICATION SCRIPT

Run this after every Codex task to verify no guardrails were violated:

```bash
#!/bin/bash
# MR-079 Post-Task Verification
# Run from MissionMed project root

ERRORS=0
echo "=== MR-079 GUARDRAIL VERIFICATION ==="

# Check 1: No migration files with short timestamps
for f in supabase/migrations/*.sql 2>/dev/null; do
  ts=$(basename "$f" | grep -oP '^\d+')
  if [ ${#ts} -ne 14 ]; then
    echo "FAIL: Short timestamp in $(basename "$f")"
    ERRORS=$((ERRORS + 1))
  fi
done

# Check 2: No duplicate timestamps
dupes=$(ls supabase/migrations/*.sql 2>/dev/null | xargs -I{} basename {} | \
  grep -oP '^\d{14}' | sort | uniq -d)
if [ -n "$dupes" ]; then
  echo "FAIL: Duplicate timestamps: $dupes"
  ERRORS=$((ERRORS + 1))
fi

# Check 3: No service_role key in frontend files
if grep -rl "service_role" arena_v1.html "STAT MAIN folder/stat_latest.html" 2>/dev/null; then
  echo "FAIL: service_role key found in frontend file"
  ERRORS=$((ERRORS + 1))
fi

# Check 4: No signUp in frontend files
if grep -rl "auth.signUp" arena_v1.html "STAT MAIN folder/stat_latest.html" 2>/dev/null; then
  echo "FAIL: auth.signUp() found in frontend file"
  ERRORS=$((ERRORS + 1))
fi

# Check 5: No unguarded answer_map queries in migrations
for f in supabase/migrations/*.sql; do
  if grep -qi "select.*answer_map" "$f" 2>/dev/null; then
    if ! grep -qi "finalized" "$f" 2>/dev/null; then
      echo "WARN: answer_map SELECT without finalized check in $(basename "$f")"
    fi
  fi
done

if [ $ERRORS -eq 0 ]; then
  echo "PASS: All guardrail checks passed"
else
  echo "ABORT: $ERRORS guardrail violations detected"
  exit 1
fi
```

---

## ENFORCEMENT

This guardrail system is LOCKED under MR-079 authority. Changes require:
1. A new MR- ticket with explicit justification
2. Impact analysis against MR-078A and MR-078B
3. Updated version number and date

Every Codex prompt that touches the MissionMed system MUST reference this document. Failure to include guardrails = unauthorized execution = INVALID status.

---

## REFERENCED DOCUMENTS

| Document | Authority | Location |
|----------|-----------|----------|
| SUPABASE_MIGRATION_PROTOCOL | MR-078A | `_SYSTEM/SUPABASE_MIGRATION_PROTOCOL.md` |
| DATA_FLOW_CONTRACT | MR-078B | `_SYSTEM/DATA_FLOW_CONTRACT.md` |
| MM-AUTH-ARCH-001 | Auth spec | `08_AI_SYSTEM/MissionMed_AI_Brain/MM-AUTH-ARCH-001.md` |
| PRIMER_CORE | Workflow OS | `_SYSTEM/PRIMER_CORE.md` |

---

END OF CODEX EXECUTION GUARDRAILS

---

## 8. GIT WORKSPACE HYGIENE (MR-G8)

These rules are mandatory for MissionMed Git safety and apply to every Codex execution.

### 8.1 Pre-Edit Command Preamble (always run first)

Before any file edits, print and verify:

```bash
pwd
git branch --show-current
bash _SYSTEM/scripts/mm-preflight.sh
```

### 8.2 Hard Refusals

Codex must refuse edits when any condition below is true:

- Current branch is `main`
- Current path is `/Users/brianb/MissionMed`
- Git status is dirty (tracked or untracked non-ignored files)
- Task mixes unrelated workstreams without explicit scope

### 8.3 Scope Declaration Before Editing

Before editing, state exact target files and task scope.
If requested edits expand beyond scope, stop and re-confirm scope.

### 8.4 Production Runtime Safety

Do not edit production runtime files unless explicitly scoped by prompt:

- `LIVE/`
- `wp-content/mu-plugins/`
- `missionmed-hq/server.mjs`
- `supabase/migrations/`

### 8.5 Demo/Scratch Output Location

Store demos, reports, screenshots, and scratch output outside repo root:

- `/Users/brianb/MissionMed_AI_Sandbox/`

When relevant, also copy latest deliverables to:

- `/Users/brianb/MissionMed_AI_Sandbox/_RECENT_AI_OUTPUTS/`

### 8.6 No Workstream Mixing

Do not combine unrelated projects (USCE, Arena, STAT, Dashboard, IV, WordPress runtime) in one edit cycle unless prompt explicitly requires coordinated changes.
