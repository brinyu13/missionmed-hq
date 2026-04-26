-- =============================================================================
-- 20260423220000_e3_stat_beta_tables.sql
-- E3 STAT Performance Intelligence Layer - Beta Tables + Constraints
-- Authority: MR-0004 (ULTIMATE_PERFORMANCE_LAYER_PLAN v4.0.0)
-- Prompt ID: (E3)-STAT-PH1-CLAUDE-HIGH-001
-- Depends on: 20260420112000_stat_canon_helpers.sql
-- =============================================================================
-- Scope:
--   TABLE 1: public.study_sessions    - session-level grouping
--   TABLE 2: public.match_attempts    - per-match header with lifecycle
--   TABLE 3: public.question_attempts - per-question event ledger (immutable)
--   TRIGGER: updated_at auto-set on all 3 tables
--   EXTENSION: pgcrypto (idempotent enable)
-- =============================================================================
-- NOT in scope:
--   * No RLS policies (deferred to Phase 1.2)
--   * No RPC functions (deferred to Phase 2)
--   * No materialized views or derived tables
-- =============================================================================
-- Idempotency: All DDL uses IF NOT EXISTS. Trigger function uses
-- CREATE OR REPLACE. Safe to re-run.
-- =============================================================================

BEGIN;
-- ---------------------------------------------------------------------------
-- EXTENSION: pgcrypto
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto;
-- ---------------------------------------------------------------------------
-- TRIGGER FUNCTION: auto-set updated_at on UPDATE
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.e3_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
COMMENT ON FUNCTION public.e3_set_updated_at() IS
  'Auto-set updated_at = now() on UPDATE. Used by study_sessions, match_attempts, question_attempts. MR-0004.';
-- ===========================================================================
-- TABLE 1: public.study_sessions
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.study_sessions (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  started_at        timestamptz NOT NULL DEFAULT now(),
  ended_at          timestamptz,
  current_sequence  integer     NOT NULL DEFAULT 0,
  last_activity_at  timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.study_sessions IS
  'Session-level grouping of match attempts. One active session per user at a time. MR-0004.';
-- Partial unique: only one active (un-ended) session per user
CREATE UNIQUE INDEX IF NOT EXISTS study_sessions_user_active_uk
  ON public.study_sessions (user_id)
  WHERE ended_at IS NULL;
-- Covering index for session lookup
CREATE INDEX IF NOT EXISTS study_sessions_user_started_idx
  ON public.study_sessions (user_id, started_at DESC);
-- Trigger: updated_at
DROP TRIGGER IF EXISTS trg_study_sessions_updated_at ON public.study_sessions;
CREATE TRIGGER trg_study_sessions_updated_at
  BEFORE UPDATE ON public.study_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.e3_set_updated_at();
-- ===========================================================================
-- TABLE 2: public.match_attempts
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.match_attempts (
  id                     uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id               uuid         NOT NULL REFERENCES public.duels(id),
  user_id                uuid         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id             uuid                  REFERENCES public.study_sessions(id),
  mode_type              text         NOT NULL DEFAULT 'async_duel',
  dataset_version        text         NOT NULL,
  content_hash           text         NOT NULL,
  pack_question_count    integer      NOT NULL,
  result_state           text         NOT NULL DEFAULT 'in_progress',
  scoring_version        text         NOT NULL DEFAULT 'v1',
  score_raw              integer,
  score_normalized       numeric(7,4),
  session_sequence_index integer,
  created_at             timestamptz  NOT NULL DEFAULT now(),
  updated_at             timestamptz  NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.match_attempts IS
  'Per-match header: one row per (match, user) pair. Tracks lifecycle, score, dataset provenance. MR-0004.';
-- Unique: one attempt per match per user
ALTER TABLE public.match_attempts
  DROP CONSTRAINT IF EXISTS match_attempts_match_user_uk;
ALTER TABLE public.match_attempts
  ADD CONSTRAINT match_attempts_match_user_uk UNIQUE (match_id, user_id);
-- Unique: sequence within a session must be unique
ALTER TABLE public.match_attempts
  DROP CONSTRAINT IF EXISTS match_attempts_session_seq_uk;
ALTER TABLE public.match_attempts
  ADD CONSTRAINT match_attempts_session_seq_uk UNIQUE (session_id, session_sequence_index);
-- Indexes
CREATE INDEX IF NOT EXISTS match_attempts_user_created_idx
  ON public.match_attempts (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS match_attempts_user_mode_created_idx
  ON public.match_attempts (user_id, mode_type, created_at DESC);
CREATE INDEX IF NOT EXISTS match_attempts_session_idx
  ON public.match_attempts (session_id);
-- Trigger: updated_at
DROP TRIGGER IF EXISTS trg_match_attempts_updated_at ON public.match_attempts;
CREATE TRIGGER trg_match_attempts_updated_at
  BEFORE UPDATE ON public.match_attempts
  FOR EACH ROW
  EXECUTE FUNCTION public.e3_set_updated_at();
-- ===========================================================================
-- TABLE 3: public.question_attempts
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.question_attempts (
  id                                        uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id                                  uuid         NOT NULL REFERENCES public.duels(id),
  user_id                                   uuid         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id                                uuid                  REFERENCES public.study_sessions(id),
  question_id                               text         NOT NULL,
  q_index                                   integer      NOT NULL,
  displayed_choices_order                   text[]       NOT NULL,
  computed_correct_index_after_permutation  integer,
  selected_index                            integer,
  correct                                   boolean,
  result_state                              text         NOT NULL DEFAULT 'presented',
  question_started_at                       timestamptz,
  question_answered_at                      timestamptz,
  server_received_presented_at              timestamptz,
  server_received_answered_at               timestamptz,
  time_to_first_answer_ms                   integer,
  total_time_on_question_ms                 integer,
  dataset_version                           text         NOT NULL,
  content_hash                              text         NOT NULL,
  client_event_id                           uuid         NOT NULL,
  server_sequence_index                     integer      NOT NULL,
  created_at                                timestamptz  NOT NULL DEFAULT now(),
  updated_at                                timestamptz  NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.question_attempts IS
  'Per-question event ledger. Canonical immutable history for replay guarantee. MR-0004.';
-- Unique: one attempt per question index per match per user
ALTER TABLE public.question_attempts
  DROP CONSTRAINT IF EXISTS question_attempts_match_user_qidx_uk;
ALTER TABLE public.question_attempts
  ADD CONSTRAINT question_attempts_match_user_qidx_uk UNIQUE (match_id, user_id, q_index);
-- Unique: client event dedup per user
ALTER TABLE public.question_attempts
  DROP CONSTRAINT IF EXISTS question_attempts_user_client_event_uk;
ALTER TABLE public.question_attempts
  ADD CONSTRAINT question_attempts_user_client_event_uk UNIQUE (user_id, client_event_id);
-- Unique: server sequence per match
ALTER TABLE public.question_attempts
  DROP CONSTRAINT IF EXISTS question_attempts_match_seq_uk;
ALTER TABLE public.question_attempts
  ADD CONSTRAINT question_attempts_match_seq_uk UNIQUE (match_id, server_sequence_index);
-- Indexes
CREATE INDEX IF NOT EXISTS question_attempts_user_created_idx
  ON public.question_attempts (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS question_attempts_match_qidx_idx
  ON public.question_attempts (match_id, q_index);
CREATE INDEX IF NOT EXISTS question_attempts_match_seq_idx
  ON public.question_attempts (match_id, server_sequence_index);
CREATE INDEX IF NOT EXISTS question_attempts_dataset_version_idx
  ON public.question_attempts (dataset_version);
CREATE INDEX IF NOT EXISTS question_attempts_result_state_partial_idx
  ON public.question_attempts (result_state)
  WHERE result_state IN ('abandoned', 'timeout');
-- Trigger: updated_at
DROP TRIGGER IF EXISTS trg_question_attempts_updated_at ON public.question_attempts;
CREATE TRIGGER trg_question_attempts_updated_at
  BEFORE UPDATE ON public.question_attempts
  FOR EACH ROW
  EXECUTE FUNCTION public.e3_set_updated_at();
COMMIT;
-- ===========================================================================
-- ROLLBACK (commented out) - reverses all changes from this migration
-- ===========================================================================
-- BEGIN;
--
-- DROP TRIGGER IF EXISTS trg_question_attempts_updated_at ON public.question_attempts;
-- DROP TRIGGER IF EXISTS trg_match_attempts_updated_at ON public.match_attempts;
-- DROP TRIGGER IF EXISTS trg_study_sessions_updated_at ON public.study_sessions;
--
-- DROP TABLE IF EXISTS public.question_attempts CASCADE;
-- DROP TABLE IF EXISTS public.match_attempts CASCADE;
-- DROP TABLE IF EXISTS public.study_sessions CASCADE;
--
-- DROP FUNCTION IF EXISTS public.e3_set_updated_at();
--
-- COMMIT;;
