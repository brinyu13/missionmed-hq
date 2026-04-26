-- =============================================================================
-- 20260423223000_e3_stat_beta_rls.sql
-- E3 STAT Performance Intelligence Layer - RLS Policies
-- Authority: MR-0004 (ULTIMATE_PERFORMANCE_LAYER_PLAN v4.0.0)
-- Prompt ID: (E3)-STAT-PH1-CLAUDE-HIGH-003
-- Depends on: 20260423220000_e3_stat_beta_tables.sql
-- =============================================================================
-- Scope:
--   ENABLE + FORCE RLS on study_sessions, match_attempts, question_attempts
--   SELECT-only policies scoped to auth.uid() = user_id
--   No INSERT/UPDATE/DELETE policies (writes via SECURITY DEFINER RPCs)
-- =============================================================================
-- RLS Principles (MR-0004):
--   1. No direct client INSERT/UPDATE/DELETE on canonical write tables
--   2. Writes ONLY through SECURITY DEFINER RPCs with auth.uid() enforcement
--   3. SELECT scoped by auth.uid() where applicable
--   4. service_role bypasses RLS by default (Supabase behavior)
-- =============================================================================
-- Idempotency: ENABLE/FORCE are idempotent. Policies use DROP IF EXISTS
-- before CREATE. Safe to re-run.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- TABLE 1: public.study_sessions
-- ---------------------------------------------------------------------------
ALTER TABLE public.study_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_sessions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own study_sessions" ON public.study_sessions;
CREATE POLICY "Users read own study_sessions"
  ON public.study_sessions
  FOR SELECT
  USING (auth.uid() = user_id);
-- ---------------------------------------------------------------------------
-- TABLE 2: public.match_attempts
-- ---------------------------------------------------------------------------
ALTER TABLE public.match_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_attempts FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own match_attempts" ON public.match_attempts;
CREATE POLICY "Users read own match_attempts"
  ON public.match_attempts
  FOR SELECT
  USING (auth.uid() = user_id);
-- ---------------------------------------------------------------------------
-- TABLE 3: public.question_attempts
-- ---------------------------------------------------------------------------
ALTER TABLE public.question_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_attempts FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own question_attempts" ON public.question_attempts;
CREATE POLICY "Users read own question_attempts"
  ON public.question_attempts
  FOR SELECT
  USING (auth.uid() = user_id);
-- ===========================================================================
-- ROLLBACK (commented out)
-- ===========================================================================
-- DROP POLICY IF EXISTS "Users read own question_attempts" ON public.question_attempts;
-- DROP POLICY IF EXISTS "Users read own match_attempts" ON public.match_attempts;
-- DROP POLICY IF EXISTS "Users read own study_sessions" ON public.study_sessions;
-- ALTER TABLE public.question_attempts NO FORCE ROW LEVEL SECURITY;
-- ALTER TABLE public.match_attempts NO FORCE ROW LEVEL SECURITY;
-- ALTER TABLE public.study_sessions NO FORCE ROW LEVEL SECURITY;;
