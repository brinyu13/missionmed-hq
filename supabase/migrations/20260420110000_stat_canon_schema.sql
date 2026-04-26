-- =============================================================================
-- 20260420_stat_canon_schema.sql
-- Phase 1 of MR-702 STAT Async Duel V1 server-authoritative pivot.
-- Authority: MR-702 (v1.1 corrected via MR-703). Prompt ID: (B3)-STAT-PH1-CLAUDE-HIGH-001.
-- Depends on: 20260415120000_tournamed_qstat_core_async.sql
-- =============================================================================
-- Scope (this migration ONLY):
--   TASK A1 : add canonical pack columns to duel_challenges
--   TASK A2 : reconcile duel_challenges.state to canonical 4-value enum
--   TASK B  : harden duel_attempts
--   TASK C  : create dataset_registry
--   TASK D  : monotonic state-transition trigger
-- -----------------------------------------------------------------------------
-- NOT in scope (explicitly excluded per prompt):
--   * No modification of create_duel, create_bot_duel, submit_attempt,
--     accept_duel RPCs. Phase 2 rewrites those.
--   * No modification of the legacy `matches` table (not present in migrations
--     per Phase 0 audit; left untouched regardless).
--   * No column drops.
--   * submit_attempt RPC signature preserved verbatim per Phase 0:
--     (p_duel_id uuid, p_answers jsonb, p_total_time_ms integer, p_idempotency_key text)
-- -----------------------------------------------------------------------------
-- Idempotency: every DDL uses IF NOT EXISTS / IF EXISTS; CHECK constraints are
-- dropped (by dynamic name lookup on the state column) before being re-added;
-- the trigger function uses CREATE OR REPLACE and the trigger itself is
-- DROP-IF-EXISTS-then-CREATE. Safe to re-run.
-- -----------------------------------------------------------------------------
-- RLS: the new pack columns on duel_challenges inherit all existing
-- table-level RLS policies (PostgreSQL applies row policies regardless of
-- column projection). No column-level policies existed in prior migrations,
-- so no policy rewrites are required here.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- TASK A1: Canonical pack columns on duel_challenges
-- -----------------------------------------------------------------------------
-- These columns capture the sealed, deterministic question pack for a duel so
-- both players replay the same ordered content against the same answer map.
--   question_ids      : ordered list of dataset question IDs in play order
--   choices_order     : jsonb map { question_id: [choice_key_order] }
--   answer_map        : jsonb map { question_id: correct_choice_key }
--   dataset_version   : FK-in-spirit to dataset_registry.dataset_version
--   content_hash      : deterministic hash of (dataset_version + question_ids
--                       + choices_order), used to dedupe seals + verify replay
--   sealed_at         : timestamp at which the pack was finalized (write-once
--                       at seal time; Phase 2 RPCs will populate)

alter table public.duel_challenges
  add column if not exists question_ids text[];
alter table public.duel_challenges
  add column if not exists choices_order jsonb;
alter table public.duel_challenges
  add column if not exists answer_map jsonb;
alter table public.duel_challenges
  add column if not exists dataset_version text;
alter table public.duel_challenges
  add column if not exists content_hash text;
alter table public.duel_challenges
  add column if not exists sealed_at timestamptz;
-- Partial unique index: duplicate seals (same content_hash) must fail fast.
-- Partial so that unsealed rows (content_hash IS NULL) do not collide.
create unique index if not exists duel_challenges_content_hash_uk
  on public.duel_challenges (content_hash)
  where content_hash is not null;
comment on column public.duel_challenges.question_ids is
  'Ordered dataset_questions IDs that make up the sealed duel pack. Write-once at seal. MR-702 Phase 1.';
comment on column public.duel_challenges.choices_order is
  'jsonb map question_id -> ordered array of choice keys (e.g. ["B","D","A","C"]). MR-702 Phase 1.';
comment on column public.duel_challenges.answer_map is
  'jsonb map question_id -> correct choice key. Server-side only; never sent to clients. MR-702 Phase 1.';
comment on column public.duel_challenges.dataset_version is
  'References dataset_registry.dataset_version at seal time. MR-702 Phase 1.';
comment on column public.duel_challenges.content_hash is
  'Deterministic hash over (dataset_version || question_ids || choices_order). MR-702 Phase 1.';
comment on column public.duel_challenges.sealed_at is
  'Timestamp at which the pack columns became write-once. MR-702 Phase 1.';
-- -----------------------------------------------------------------------------
-- TASK A2: Reconcile duel_challenges.state to canonical 4-value enum
-- -----------------------------------------------------------------------------
-- Phase 0 audit (prompt (B3)-STAT-PH0-CLAUDE-MED-001, 2026-04-20T15:36Z)
-- confirmed the column currently accepts 8 values via an inline CHECK at
-- 20260415120000_tournamed_qstat_core_async.sql line 75:
--   'created','pending','accepted','player1_complete','player2_complete',
--   'completed','expired','settled'
--
-- Canonical 4-value target enum (per MR-702 v1.1): pending, active, finalized, void.
--
-- Mapping applied (derived from prompt rules 1-4 + explicit extensions for
-- three Phase-0 values not covered by rules 1-4; extensions preserve semantic
-- meaning rather than falling to the "all others -> void" catch-all):
--
--   Phase-0 value        -> Canonical   | Source
--   -------------------- -------------- ----------------------------------
--   'created'            -> pending     | prompt rule 1 (matches 'created')
--   'pending'            -> pending     | already canonical (no-op)
--   'accepted'           -> active      | prompt rule 2 (matches 'accepted')
--   'player1_complete'   -> active      | EXTENSION: intermediate gameplay
--                                        | state; one participant submitted
--                                        | but duel is still open
--   'player2_complete'   -> active      | EXTENSION: intermediate gameplay
--                                        | state; mirror of player1_complete
--   'completed'          -> finalized   | prompt rule 3 (matches 'completed')
--   'expired'            -> void        | prompt rule 4 (matches 'expired')
--   'settled'            -> finalized   | EXTENSION: terminal post-settlement
--                                        | state; settlement is an accounting
--                                        | step after finalization, not a
--                                        | separate enum value in canonical
--   <any unknown future> -> void        | prompt catch-all
--
-- If this mapping is incorrect for 'player1_complete' / 'player2_complete' /
-- 'settled', override before applying migration.
--
-- Order inside this section is load-bearing:
--   1. Drop the pre-existing CHECK on the state column (dynamic name lookup
--      because the inline CHECK in the prior migration used an auto-generated
--      constraint name).
--   2. Backfill rows to canonical values (no CHECK in effect, so transient
--      non-canonical states are allowed during this step).
--   3. Re-add the canonical CHECK under a stable name.
--   4. Set the default to 'pending'.
-- The state-transition trigger (TASK D) is installed LAST so that backfill
-- UPDATEs above do not trip it.

do $reconcile$
declare
  v_state_attnum int2;
  v_constraint_name text;
begin
  select attnum
    into v_state_attnum
  from pg_attribute
  where attrelid = 'public.duel_challenges'::regclass
    and attname = 'state'
    and not attisdropped;

  if v_state_attnum is null then
    raise exception 'duel_challenges.state column not found; prior migration 20260415120000 must have run first';
  end if;

  -- Drop every CHECK constraint whose key is exactly the single state column.
  -- This cleanly removes the inline enum CHECK from the prior migration AND
  -- our own canonical CHECK if this migration is being re-run.
  for v_constraint_name in
    select conname
    from pg_constraint
    where conrelid = 'public.duel_challenges'::regclass
      and contype = 'c'
      and conkey = array[v_state_attnum]::int2[]
  loop
    execute format(
      'alter table public.duel_challenges drop constraint if exists %I',
      v_constraint_name
    );
  end loop;
end;
$reconcile$;
-- Backfill existing rows. Each UPDATE targets a disjoint source set, so
-- ordering between the four mapping statements is not semantically important,
-- but the catch-all MUST run last so it only touches genuinely-unknown values.

update public.duel_challenges
   set state = 'pending'
 where state in ('open','waiting','queued','created');
update public.duel_challenges
   set state = 'active'
 where state in ('accepted','in_progress','playing','live','player1_complete','player2_complete');
update public.duel_challenges
   set state = 'finalized'
 where state in ('completed','done','closed','settled');
update public.duel_challenges
   set state = 'void'
 where state in ('cancelled','canceled','expired','void','abandoned');
-- Safety catch-all: any value not already canonical -> 'void'. This guards
-- against future rows written with states we did not anticipate.
update public.duel_challenges
   set state = 'void'
 where state not in ('pending','active','finalized','void');
-- Re-add the canonical CHECK under a stable, operator-facing name.
alter table public.duel_challenges
  add constraint duel_challenges_state_canonical_ck
  check (state in ('pending','active','finalized','void'));
-- Default.
alter table public.duel_challenges
  alter column state set default 'pending';
-- -----------------------------------------------------------------------------
-- TASK B: Harden duel_attempts
-- -----------------------------------------------------------------------------
-- NOTE: prior migration 20260415120000 already declared submit_idempotency_key
-- as NOT NULL with a compound UNIQUE (player_id, submit_idempotency_key).
-- The ADD COLUMN IF NOT EXISTS below is a no-op on the existing schema but
-- keeps this migration self-contained (safe on a fresh DB that somehow
-- skipped the prior file).
alter table public.duel_attempts
  add column if not exists submit_idempotency_key text;
-- GLOBAL unique index on the key (stronger than the compound unique above).
-- The existing (player_id, submit_idempotency_key) constraint stays in place;
-- both apply.
create unique index if not exists duel_attempts_idem_uk
  on public.duel_attempts (submit_idempotency_key)
  where submit_idempotency_key is not null;
-- Answer-count vs question-count alignment:
-- Not added as a table-level CHECK here. PostgreSQL CHECK constraints cannot
-- be deferred, and a non-deferred check against duel_challenges.question_set
-- would be an expensive cross-table lookup on every insert. Alignment is
-- already enforced at app layer inside private_score_answers() (called by
-- submit_attempt; prior migration line 1499) which computes per-answer
-- correctness against the duel's question_set and refuses malformed arrays.
-- Phase 2 RPCs will add a named error 'answer_count_mismatch' for this path.


-- -----------------------------------------------------------------------------
-- TASK C: dataset_registry
-- -----------------------------------------------------------------------------
-- Single-source-of-truth table for which dataset the server is serving. Each
-- seal on duel_challenges references a dataset_version that must be present
-- here. Phase 1.2 populates the first row after the dataset_questions table
-- is materialized from universal_questions_v4.json.

create table if not exists public.dataset_registry (
  dataset_version   text        primary key,
  content_root_hash text        not null,
  question_count    integer     not null check (question_count > 0),
  registered_at     timestamptz not null default now(),
  source_path       text,
  notes             text
);
comment on table public.dataset_registry is
  'Registry of question dataset versions currently valid for sealing duels. MR-702 Phase 1.';
grant select on public.dataset_registry to authenticated;
grant select on public.dataset_registry to anon;
-- -----------------------------------------------------------------------------
-- TASK D: Monotonic state-transition trigger
-- -----------------------------------------------------------------------------
-- Allowed transitions:
--   pending -> active
--   pending -> void
--   active  -> finalized
--   active  -> void
-- Any other change of the state column raises. Same-value UPDATEs are
-- permitted (no actual transition; supports upserts / touch-updates).
--
-- The trigger is BEFORE UPDATE OF state so it only fires when a query's SET
-- clause explicitly names the state column. UPDATEs that don't touch state
-- (e.g. setting accepted_at, updated_at, match_expires_at alone) are not
-- affected.

create or replace function public.duel_state_monotonic_fn()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  -- No-op UPDATEs are always allowed.
  if new.state is not distinct from old.state then
    return new;
  end if;

  -- Valid forward transitions.
  if old.state = 'pending' and new.state in ('active','void') then
    return new;
  end if;
  if old.state = 'active' and new.state in ('finalized','void') then
    return new;
  end if;

  -- All other transitions (including anything out of 'finalized' or 'void',
  -- and any backward move such as 'active' -> 'pending') are rejected.
  raise exception 'invalid_duel_state_transition: % -> %', old.state, new.state
    using errcode = 'check_violation';
end;
$fn$;
comment on function public.duel_state_monotonic_fn() is
  'Enforces canonical duel state transitions: pending->active|void; active->finalized|void. MR-702 Phase 1.';
drop trigger if exists trg_duel_state_monotonic on public.duel_challenges;
create trigger trg_duel_state_monotonic
  before update of state on public.duel_challenges
  for each row
  execute function public.duel_state_monotonic_fn();
-- =============================================================================
-- End of 20260420_stat_canon_schema.sql
-- =============================================================================;
