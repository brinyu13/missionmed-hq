# DATA FLOW CONTRACT -- ARENA + STAT + SUPABASE SYSTEM LOCK

**Authority:** MR-078B
**Version:** 1.0
**Date:** 2026-04-24
**Risk Level:** HIGH
**Status:** LOCKED -- NON-NEGOTIABLE
**Depends On:** MM-AUTH-ARCH-001, SUPABASE_MIGRATION_PROTOCOL.md (MR-078A)

This document defines the EXACT data contract across Arena, STAT, Supabase, and the Auth system. No system may read, write, or modify data outside the boundaries defined here.

---

## 0. SUPABASE PROJECT MAP

Two Supabase projects exist. They serve different data domains. NEVER confuse them.

| Project | ID | Name | Data Domain |
|---------|-----|------|-------------|
| **RANKLISTIQ** | `fglyvdykwgbuivikqoah` | missionmed-ranklistiq | STAT duels, player_profiles, user_avatars, match_players, dataset_questions, bot_profiles, E3 telemetry (study_sessions, match_attempts, question_attempts), RankListIQ tables |
| **GROWTH ENGINE** | `plgndqcplokwiuimwhzh` | MissionMed Growth Engine | command_center.* (CRM), drill_registry, menu_categories, media_*, rfa_submissions |

Arena and STAT frontends connect to **RANKLISTIQ** (`fglyvdykwgbuivikqoah`).
HQ backend connects to **GROWTH ENGINE** (`plgndqcplokwiuimwhzh`) for CRM and to **RANKLISTIQ** for student/player provisioning.

Local migration files in `/supabase/migrations/` target the **GROWTH ENGINE** project.
STAT/duel migrations were applied to **RANKLISTIQ** via separate deployment path.

---

## 1. SOURCE OF TRUTH MAP

### 1.1 Ownership Table

| Data Domain | Owner (Source of Truth) | Secondary Consumers | NEVER Duplicated To |
|-------------|------------------------|---------------------|---------------------|
| User identity (name, email, role) | WordPress | Railway session, Supabase auth.users | Frontend localStorage (except Bearer token for HQ) |
| User authentication state | Supabase Auth (Arena) / Railway session (HQ) | Frontend session cache | Never persisted to application tables |
| Player profile (rating, wins, losses, streaks) | Supabase `player_profiles` | STAT frontend (read cache) | Never stored in WordPress or Railway |
| Avatar data | Supabase `user_avatars` | Arena frontend (display), `match_players` (snapshot) | Never stored outside Supabase |
| Duel state (challenges, attempts, results) | Supabase `duel_challenges` + `duel_attempts` + `duel_results` | STAT frontend (read-only display) | Never cached in localStorage or cookies |
| Answer map (correct answers per duel) | Supabase `duel_challenges.answer_map` (server-only column) | `get_duel_result` RPC (post-finalization only) | NEVER sent to client before finalization |
| Question bank | Supabase `dataset_questions` + `dataset_registry` | Sealed into `duel_challenges` at creation | Never modified after seed; never client-writable |
| Drill catalog | Supabase `drill_registry` | Arena frontend (read), HQ backend (read) | Never duplicated |
| Menu structure | Supabase `menu_categories` + `menu_category_drills` | Arena frontend (read + admin write) | Never stored elsewhere |
| Student/Lead CRM data | Supabase `command_center.*` schema | HQ frontend (read via Bearer API) | Never in Arena or STAT |
| Payment records | Supabase `command_center.payments` | HQ frontend (read) | Never in WordPress |
| Email queue | Supabase `command_center.email_drafts` + `email_queue` | HQ backend (processing) | Never in frontend |
| Media metadata | Supabase `media_*` tables | HQ media player (read) | Never in Arena |
| Performance telemetry | Supabase `study_sessions` + `match_attempts` + `question_attempts` | STAT frontend (E3 dashboard) | Never in HQ or Arena |

### 1.2 What Is NEVER Duplicated

These data points exist in exactly ONE location. Creating a copy anywhere else is a contract violation:

1. `answer_map` -- exists ONLY in `duel_challenges.answer_map`. Never cached, never copied to frontend state, never logged to console.
2. `content_hash` -- exists ONLY in `duel_challenges.content_hash`. Computed server-side. Never recomputed client-side.
3. `dataset_questions` rows -- exist ONLY in the `dataset_questions` table. Sealed into duels by reference (`question_ids`), never cloned.
4. WordPress `user_pass` -- exists ONLY in WordPress. Supabase auth uses a derived password, never the original.
5. Railway session records -- exist ONLY in Railway memory/store. Never persisted to Supabase or WordPress.

---

## 2. DATA FLOW DIAGRAM

### 2.1 Auth Flow (WordPress to Supabase Session)

```
USER BROWSER
  |
  |-- [1] Visit Arena/STAT page (served from missionmedinstitute.com)
  |
  |-- [2] POST /api/auth/exchange { credentials: include }
  |         |
  |         v
  |     WORDPRESS (missionmed-hq-proxy.php)
  |         |-- Forwards to Railway with WP cookies
  |         v
  |     RAILWAY (server.mjs)
  |         |-- Validates WP token against WP REST API
  |         |-- Creates encrypted session (AES, 8h TTL)
  |         |-- Returns: { accessToken } + Set-Cookie (HttpOnly)
  |         v
  |-- [3] POST /api/auth/bootstrap { Bearer: accessToken }
  |         |
  |         v
  |     RAILWAY
  |         |-- Resolves WP user from session
  |         |-- Ensures Supabase auth.users record exists
  |         |-- Signs in Supabase user (email + derived password)
  |         |-- Returns: { access_token, refresh_token }
  |         v
  |-- [4] supabase.auth.setSession({ access_token, refresh_token })
  |-- [5] supabase.auth.getUser() --> auth.uid() now available
  |-- [6] All subsequent Supabase queries use RLS with auth.uid()
```

### 2.2 STAT Duel Flow (Create to Finalize)

```
PLAYER A (STAT Frontend)
  |
  |-- [1] rpc('create_duel', { opponent, idempotency_key, dataset_version })
  |         |
  |         v
  |     SUPABASE (SECURITY DEFINER RPC)
  |         |-- pick_questions_seeded() --> question_ids
  |         |-- shuffle_choices_seeded() --> choices_order
  |         |-- answer_map_for() --> answer_map (STORED, NEVER RETURNED)
  |         |-- content_hash_compute() --> content_hash (UNIQUE constraint)
  |         |-- INSERT duel_challenges (state=pending)
  |         |-- INSERT duel_events (duel_created)
  |         |-- Returns: duel_id (NO answer data)
  |
PLAYER B (STAT Frontend)
  |
  |-- [2] rpc('accept_duel', { duel_id, idempotency_key })
  |         |-- UPDATE state: pending --> active
  |         |-- INSERT duel_events (duel_accepted)
  |
  |-- [3] rpc('get_duel_pack', { duel_id })
  |         |-- Returns: questions + choices_order
  |         |-- NEVER returns: answer_map
  |
BOTH PLAYERS (independently)
  |
  |-- [4] rpc('submit_attempt', { duel_id, answers[], time_ms, idempotency_key })
  |         |
  |         v
  |     SUPABASE (SECURITY DEFINER RPC)
  |         |-- READ answer_map from duel_challenges (server-only)
  |         |-- Resolve choice_index --> letter via choices_order
  |         |-- Score: compare picked_letter vs answer_map[q].answer
  |         |-- INSERT duel_attempts (with server-computed correct_count)
  |         |-- IF both attempts exist --> auto-finalize
  |         |     |-- Determine winner
  |         |     |-- UPDATE state: active --> finalized
  |         |     |-- INSERT duel_results
  |         |     |-- UPDATE player_profiles (rating, wins, losses)
  |
  |-- [5] rpc('get_duel_result', { duel_id })
  |         |-- GATED: state must be 'finalized', caller must be participant
  |         |-- Returns: answer_map + both attempts + winner + rating_delta
```

### 2.3 HQ Admin Flow (CRM Operations)

```
ADMIN BROWSER (HQ app.js)
  |
  |-- Bearer: accessToken (in localStorage)
  |
  |-- [1] GET /api/students --> Railway
  |         |-- rpc('mmac_cc_list_students', { page, limit })
  |         |-- Supabase service_role key (bypasses RLS)
  |         |-- Returns: student records
  |
  |-- [2] POST /api/students --> Railway
  |         |-- rpc('mmac_cc_create_student', { payload })
  |         |-- ALSO: ensure_player_profile() for STAT integration
  |         |-- Returns: created record
  |
  |-- [3] Webhook: Stripe/Gmail/LearnDash --> Railway
  |         |-- rpc('mmac_command_center_ingest_*', { event })
  |         |-- WRITE: command_center.payments / interactions / events
```

### 2.4 Arena Frontend Flow (Drills + Avatars)

```
ARENA (arena_v1.html)
  |
  |-- [1] READ: .from('drill_registry').select() --> Drill catalog
  |-- [2] READ: .from('menu_categories').select() --> Category tabs
  |-- [3] READ: .from('menu_category_drills').select() --> Drill assignments
  |-- [4] READ: .from('player_profiles').select() --> Current user profile
  |-- [5] READ: .from('user_avatars').select() --> Avatar collection
  |
  |-- [6] WRITE: rpc('upsert_user_avatar_record') --> Save generated avatar
  |-- [7] WRITE: rpc('set_active_user_avatar') --> Switch active avatar
  |-- [8] WRITE (ADMIN): .from('menu_categories').insert/update/delete()
  |-- [9] WRITE (ADMIN): .from('menu_category_drills').insert/update/delete()
```

---

## 3. WRITE RULES

### 3.1 Write Authority Matrix

| Table/Entity | Allowed Writer | Write Mechanism | Direct Table Write Allowed? |
|-------------|----------------|-----------------|----------------------------|
| `duel_challenges` | STAT frontend (via RPC) | `create_duel`, `accept_duel`, `submit_attempt`, `finalize_duel` | NO. RPCs only. |
| `duel_attempts` | STAT frontend (via RPC) | `submit_attempt` | NO. RPC only. |
| `duel_results` | Supabase (auto-finalize in `submit_attempt`) | Internal to RPC | NO. Auto-generated. |
| `duel_events` | Supabase (internal audit) | `private_append_duel_event` | NO. Internal only. |
| `player_profiles` | STAT backend (`ensure_player_profile`), HQ backend | RPC or service_role | NO direct client writes. |
| `user_avatars` | Arena frontend (via RPC) | `upsert_user_avatar_record`, `set_active_user_avatar` | NO. RPCs only. |
| `match_players` | STAT/HQ backend (service_role) | `record_match_player_avatar_snapshot` | NO. RPC only. |
| `dataset_questions` | Backend seed migration ONLY | SQL INSERT in migration file | NO runtime writes. EVER. |
| `dataset_registry` | Backend seed migration ONLY | SQL INSERT in migration file | NO runtime writes. EVER. |
| `bot_profiles` | Backend seed / admin migration | SQL INSERT in migration file | NO runtime writes. |
| `drill_registry` | Backend seed / admin migration | SQL INSERT in migration file | Read-only at runtime. |
| `menu_categories` | Arena admin panel | Direct `.from()` writes (anon RLS) | YES (admin UI only). |
| `menu_category_drills` | Arena admin panel | Direct `.from()` writes (anon RLS) | YES (admin UI only). |
| `drill_registry_control` | Arena admin panel | Direct `.from()` writes (anon RLS) | YES (admin UI only). |
| `command_center.*` | HQ backend (service_role) | `mmac_cc_create_*`, `mmac_cc_update_*`, `mmac_command_center_ingest_*` | NO direct client writes. |
| `study_sessions` | STAT frontend (via RPC) | `start_study_session` | NO. RPC only. |
| `match_attempts` | STAT backend (via RPC) | E3 telemetry RPCs | NO direct client writes. |
| `question_attempts` | STAT backend (via RPC) | E3 telemetry RPCs | NO direct client writes. |

### 3.2 Conflict Prevention

| Conflict Type | Prevention Mechanism |
|--------------|---------------------|
| Double duel creation | UNIQUE constraint on `(challenger_id, create_idempotency_key)` |
| Double attempt submission | UNIQUE constraint on `(duel_id, player_id)` + `(player_id, submit_idempotency_key)` |
| Invalid state transition | `duel_state_monotonic_fn()` trigger rejects non-forward transitions |
| Duplicate content seal | UNIQUE constraint on `content_hash` |
| Cross-user avatar mutation | RLS: `user_id = auth.uid()` + RPC ownership check |
| Cross-user profile read | RLS: `player_id = auth.uid()` (select_self policy) |
| Concurrent finalization | `submit_attempt` uses SELECT FOR UPDATE on duel row before finalize check |

### 3.3 Write Invariants

1. ALL duel writes go through SECURITY DEFINER RPCs. No direct table access.
2. ALL scoring is server-side. Client-submitted scores are IGNORED.
3. ALL avatar writes go through RPCs with `auth.uid()` ownership enforcement.
4. ALL CRM writes go through HQ backend with service_role. No client-side CRM writes.
5. Dataset tables are WRITE-ONCE via migration. Zero runtime mutations.

---

## 4. READ RULES

### 4.1 Read Source Authority

| Data | Read Source | Reader | Caching |
|------|-----------|--------|---------|
| Player profile | `player_profiles` table | STAT frontend, Arena frontend | In-memory only. Refresh on page load. |
| Duel pack (questions) | `get_duel_pack` RPC | STAT frontend | In-memory for active duel only. Discard on navigate. |
| Duel result | `get_duel_result` RPC | STAT frontend | In-memory. Re-fetchable. |
| Leaderboard | `get_leaderboard` RPC | STAT frontend | In-memory. Refresh on view switch. |
| Avatar list | `user_avatars` table | Arena frontend | In-memory. Refresh on avatar change. |
| Drill catalog | `drill_registry` table | Arena frontend | In-memory. Refresh on page load. |
| Menu structure | `menu_categories` + `menu_category_drills` | Arena frontend | In-memory. Refresh on admin edit. |
| Student records | `mmac_cc_list_students` RPC | HQ frontend (via Railway) | No frontend cache. Always fresh from API. |
| Auth state | `supabase.auth.getUser()` | Arena, STAT | Supabase JS client manages token refresh. |

### 4.2 Caching Rules

1. **NO localStorage caching of Supabase data.** All application data lives in-memory only.
2. **Bearer token (HQ only)** is the SOLE exception stored in localStorage.
3. **Supabase JS client** manages its own auth token refresh cycle. Do not interfere.
4. **Answer map** is NEVER cached anywhere. Read once from `get_duel_result` post-finalization, displayed, discarded.
5. **Profile data** must be re-fetched on every page load. Stale profile = stale rating display.

### 4.3 Consistency Guarantees

| Guarantee | Mechanism |
|-----------|-----------|
| Duel state is always current | All reads go through RPCs that read from canonical table. No cached state. |
| Score is always server-authoritative | `submit_attempt` computes and stores `correct_count`. Frontend display reads this, never its own calculation. |
| Avatar snapshot is immutable per match | `match_players` captures `avatar_url` at match start. Subsequent avatar changes do not affect historical matches. |
| Question content is immutable | `dataset_questions` is write-once (migration seed). Content never changes at runtime. |
| Duel seal is immutable | `question_ids`, `choices_order`, `answer_map`, `content_hash` are set at `create_duel` and never modified. |

---

## 5. CRITICAL INVARIANTS

These rules must NEVER be broken. Any violation is a system integrity failure.

### INV-1: ANSWER MAP SECRECY
`duel_challenges.answer_map` is NEVER returned to the client before the duel reaches `finalized` state. The `get_duel_pack` RPC explicitly excludes it. The `get_duel_result` RPC returns it ONLY when `state = 'finalized'` AND `caller is participant`.

**Violation example:** An RPC or direct query that returns `answer_map` for an `active` duel. This would allow cheating.

### INV-2: SERVER-AUTHORITATIVE SCORING
The client submits `choice_index` values (0-3). The server resolves these against `choices_order` and `answer_map` to compute the score. The `correct_count` in `duel_attempts` is ALWAYS the server-computed value.

**Violation example:** A frontend function that computes `correct_count` locally and sends it to the server, where the server trusts it.

### INV-3: MONOTONIC STATE TRANSITIONS
Duel state can only move forward: `pending -> active -> finalized` or `pending/active -> void`. The `duel_state_monotonic_fn()` trigger enforces this. No state may ever move backward.

**Violation example:** An UPDATE that sets `state = 'pending'` on a `finalized` duel. The trigger must reject this.

### INV-4: IDEMPOTENT WRITES
Every write RPC uses an `idempotency_key` with UNIQUE constraints. Calling the same RPC with the same key is safe and returns the existing result.

**Violation example:** An RPC that creates a new `duel_attempts` row on every call regardless of key. This would allow score manipulation via repeated submissions.

### INV-5: IDENTITY ISOLATION
RLS policies enforce `auth.uid()` scoping on `player_profiles`, `user_avatars`, and E3 tables. User A cannot read or write User B's data through direct table access.

**Violation example:** A SELECT policy with `true` as the condition (allowing any authenticated user to read all profiles).

### INV-6: DATASET IMMUTABILITY
`dataset_questions` and `dataset_registry` are populated by migration seed only. No RPC, no API endpoint, no admin panel may INSERT, UPDATE, or DELETE rows at runtime.

**Violation example:** An RPC that accepts new questions from the frontend and inserts them into `dataset_questions`.

### INV-7: WORDPRESS IS IDENTITY PROVIDER
No user creation occurs outside WordPress. Supabase auth.users records are provisioned server-side by Railway (`/api/auth/bootstrap`). The frontend never calls `supabase.auth.signUp()`.

**Violation example:** STAT frontend calling `supabase.auth.signUp()` to create a new user without WordPress involvement.

### INV-8: HQ USES SERVICE ROLE, ARENA USES ANON+AUTH
HQ backend uses `supabaseServiceRoleKey` (bypasses RLS). Arena/STAT use `supabaseAnonKey` + authenticated session (subject to RLS). These two access patterns must never be mixed.

**Violation example:** Arena frontend initialized with the service role key. This would bypass all RLS.

---

## 6. FAILURE SCENARIOS

### 6.1 Auth Mismatch

| Scenario | Detection | Impact | Recovery |
|----------|-----------|--------|----------|
| WP session expired, Supabase session still valid | `getUser()` returns user but `/api/auth/exchange` fails with 401 | User sees data but cannot create duels (RPCs fail on stale token) | Frontend detects 401 on any RPC, triggers re-auth flow |
| Supabase session expired, WP session still valid | `getUser()` returns null | User appears logged out | Frontend calls `/api/auth/bootstrap` to get fresh tokens |
| WP user exists, no Supabase auth.users record | `/api/auth/bootstrap` creates one | Brief delay on first login | Automatic: Railway provisions user on first bootstrap |
| Supabase auth.users UUID mismatch with player_profiles | `ensure_player_profile` creates with current `auth.uid()` | Old profile orphaned | Manual reconciliation required. LOG IMMEDIATELY. |
| Railway down, WP proxy returns 502 | Exchange fails | No new sessions | Users with existing Supabase sessions still work. New logins fail until Railway recovers. |

### 6.2 Stale Data

| Scenario | Detection | Impact | Recovery |
|----------|-----------|--------|----------|
| Player sees old rating after duel finalization | Frontend did not re-fetch profile | Display-only, DB is correct | Refresh page or navigate to trigger profile reload |
| Leaderboard shows pre-finalization standings | Leaderboard query ran before finalization committed | Display-only, DB is correct | Leaderboard auto-refreshes on view switch |
| Avatar change not reflected in active duel | `match_players` snapshot taken at match start | By design: historical match uses historical avatar | Not a bug. Intentional snapshot behavior. |
| HQ shows student record before webhook processed | Webhook latency | Display-only, DB will be correct after webhook | Refresh after webhook processing window (typically < 5s) |

### 6.3 Race Conditions

| Scenario | Prevention | What Happens If Prevention Fails |
|----------|-----------|----------------------------------|
| Two players submit attempts simultaneously | `SELECT FOR UPDATE` on duel row in `submit_attempt` | One transaction waits, then both succeed. Auto-finalize triggers on the second commit. |
| Same player submits attempt twice | UNIQUE constraint on `(duel_id, player_id)` | Second INSERT fails with constraint violation. Frontend shows existing result. |
| Two create_duel calls with same idempotency_key | UNIQUE constraint on `(challenger_id, create_idempotency_key)` | Second INSERT fails. Frontend receives existing duel_id. |
| Accept and void race on same duel | `duel_state_monotonic_fn()` trigger | First transaction wins. Second rejected with state_invalid error. |
| Concurrent avatar upsert | RPC uses `ON CONFLICT (user_id, avatar_url) DO UPDATE` | Last write wins, both valid. |
| HQ creates student while Stripe webhook fires | `command_center.events` audit trail captures both | Both writes succeed independently. Student record updated twice (idempotent fields). |

---

## 7. CODEX / AI AGENT IMPLEMENTATION RULES

### 7.1 What Agents MAY Modify

| Layer | Allowed Modifications | Conditions |
|-------|----------------------|------------|
| Migration files (NEW) | Create new `.sql` files in `supabase/migrations/` | MUST follow MR-078A protocol. 14-digit timestamp. Header block. BEGIN/COMMIT. |
| RPCs (NEW) | Add new `CREATE OR REPLACE FUNCTION` in new migration files | MUST use SECURITY DEFINER for write RPCs. MUST enforce `auth.uid()` ownership. |
| RLS policies (NEW) | Add new `CREATE POLICY` in new migration files | MUST scope to `auth.uid()` for user-facing tables. MUST NOT use `true` for authenticated role. |
| Frontend RPC calls | Add new `supabase.rpc()` calls in Arena/STAT HTML | MUST include idempotency_key. MUST handle error codes. |
| Frontend reads | Add new `.from().select()` calls | MUST respect RLS. MUST NOT request `answer_map` pre-finalization. |

### 7.2 What Agents MUST NEVER Modify

| Target | Reason |
|--------|--------|
| `duel_challenges.answer_map` column definition | Anti-cheat invariant (INV-1) |
| `duel_state_monotonic_fn()` trigger | State machine integrity (INV-3) |
| `submit_attempt` scoring logic | Server-authority invariant (INV-2) |
| `dataset_questions` or `dataset_registry` at runtime | Dataset immutability (INV-6) |
| Any RLS policy to use `true` for `authenticated` role on player/avatar/E3 tables | Identity isolation (INV-5) |
| `supabase_migrations.schema_migrations` table | Migration protocol (MR-078A) |
| WordPress user tables or auth endpoints | Identity provider boundary (INV-7) |
| Railway session encryption or token format | Auth architecture (MM-AUTH-ARCH-001) |
| Supabase connection strings or keys in frontend code | Security boundary |
| Any existing UNIQUE constraint on idempotency columns | Idempotency invariant (INV-4) |

### 7.3 Required Validation Before Changes

Before ANY data-layer change, the agent MUST:

```
1. Identify which invariants (INV-1 through INV-8) the change touches
2. For each touched invariant:
   a. State which invariant is affected
   b. Explain why the change does NOT violate it
   c. If it DOES violate, STOP and report
3. Verify write authority: confirm the writer is authorized per Section 3.1
4. Verify read path: confirm the reader is authorized per Section 4.1
5. If adding an RPC: confirm it enforces auth.uid() ownership
6. If adding a migration: follow MR-078A protocol (Section 6)
```

### 7.4 Required Validation After Changes

After ANY data-layer change, the agent MUST:

```
1. Verify RLS enforcement:
   - New policies scope to auth.uid() where required
   - No new permissive policies on sensitive tables
2. Verify idempotency:
   - New write RPCs include idempotency_key parameter
   - UNIQUE constraints exist on idempotency columns
3. Verify answer_map secrecy:
   - No new query path returns answer_map for non-finalized duels
4. Verify state machine:
   - No new code bypasses duel_state_monotonic_fn()
5. If migration was applied:
   - Run: supabase migration list (confirm applied)
   - Run: supabase db diff (confirm no drift)
```

---

## REFERENCED DOCUMENTS

| Document | Authority | Location |
|----------|-----------|----------|
| MM-AUTH-ARCH-001 | Auth architecture spec | `08_AI_SYSTEM/MissionMed_AI_Brain/MM-AUTH-ARCH-001.md` |
| SUPABASE_MIGRATION_PROTOCOL | Migration hardening | `_SYSTEM/SUPABASE_MIGRATION_PROTOCOL.md` |
| PRIMER_CORE | Workflow OS core | `_SYSTEM/PRIMER_CORE.md` |

---

## ENFORCEMENT

This contract is LOCKED under MR-078B authority. Changes require:
1. A new MR- ticket with explicit justification
2. Invariant impact analysis (which invariants are affected and why the change is safe)
3. Updated version number and date

Any data operation that violates this contract produces STATUS = INVALID.

---

END OF DATA FLOW CONTRACT
