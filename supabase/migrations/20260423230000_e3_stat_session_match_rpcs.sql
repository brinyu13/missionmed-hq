-- =============================================================================
-- 20260423230000_e3_stat_session_match_rpcs.sql
-- E3 STAT Performance Intelligence Layer - Session + Match RPCs
-- Authority: MR-0004 (ULTIMATE_PERFORMANCE_LAYER_PLAN v4.0.0)
-- Prompt ID: (E3)-STAT-PH2-CLAUDE-HIGH-001
-- Depends on: 20260423223000_e3_stat_beta_rls.sql
-- =============================================================================
-- Scope:
--   RPC 1: start_study_session()
--   RPC 2: end_study_session(p_session_id)
--   RPC 3: complete_match(p_match_id, p_user_id)
-- =============================================================================
-- All RPCs: SECURITY DEFINER, search_path = public, pg_temp
-- All writes go through these RPCs (no direct INSERT/UPDATE policies)
-- =============================================================================
-- Terminal states for question_attempts.result_state:
--   correct, incorrect, abandoned, timeout, forfeited
-- Non-terminal: pending, presented
-- =============================================================================
-- Scoring formula (PATCH_06, scoring_version = 'v1'):
--   score_normalized = (accuracy_pct * 0.60) + (difficulty_bonus * 0.25) + (speed_bonus * 0.15)
--   accuracy_pct = (correct_count / pack_question_count) * 100
--   difficulty_bonus = default 50 (difficulty_snapshot column deferred)
--   speed_bonus = CLAMP((30000 - avg_time_to_first_answer_ms) / 30000 * 100, 0, 100)
--   SPEED_CEILING_MS = 30000
-- =============================================================================

-- ===========================================================================
-- RPC 1: start_study_session
-- ===========================================================================
-- Idempotent: returns existing open session if one exists.
-- Creates a new session only if no open session for auth.uid().
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.start_study_session()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid;
  v_existing record;
  v_new record;
BEGIN
  -- Auth gate
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'STAT_AUTH_REQUIRED: Authentication required'
      USING ERRCODE = 'P0001';
  END IF;

  -- Idempotent check: return existing open session
  SELECT id, user_id, started_at, current_sequence, last_activity_at
    INTO v_existing
    FROM public.study_sessions
   WHERE user_id = v_uid
     AND ended_at IS NULL;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'status', 'existing',
      'session', jsonb_build_object(
        'id', v_existing.id,
        'user_id', v_existing.user_id,
        'started_at', v_existing.started_at,
        'current_sequence', v_existing.current_sequence,
        'last_activity_at', v_existing.last_activity_at
      )
    );
  END IF;

  -- Create new session
  INSERT INTO public.study_sessions (user_id)
  VALUES (v_uid)
  RETURNING id, user_id, started_at, current_sequence, last_activity_at
    INTO v_new;

  RETURN jsonb_build_object(
    'status', 'created',
    'session', jsonb_build_object(
      'id', v_new.id,
      'user_id', v_new.user_id,
      'started_at', v_new.started_at,
      'current_sequence', v_new.current_sequence,
      'last_activity_at', v_new.last_activity_at
    )
  );
END;
$$;
COMMENT ON FUNCTION public.start_study_session() IS
  'Creates or returns existing open study session for auth.uid(). Idempotent. MR-0004.';
-- ===========================================================================
-- RPC 2: end_study_session
-- ===========================================================================
-- Idempotent: if session already ended, returns existing row.
-- Auth: auth.uid() must own the session.
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.end_study_session(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid;
  v_session record;
BEGIN
  -- Auth gate
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'STAT_AUTH_REQUIRED: Authentication required'
      USING ERRCODE = 'P0001';
  END IF;

  -- Fetch session with ownership check
  SELECT id, user_id, started_at, ended_at, current_sequence, last_activity_at
    INTO v_session
    FROM public.study_sessions
   WHERE id = p_session_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'STAT_SESSION_NOT_FOUND: Session % does not exist', p_session_id
      USING ERRCODE = 'P0001';
  END IF;

  IF v_session.user_id <> v_uid THEN
    RAISE EXCEPTION 'STAT_SESSION_FORBIDDEN: You do not own session %', p_session_id
      USING ERRCODE = 'P0001';
  END IF;

  -- Idempotent: already ended
  IF v_session.ended_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'status', 'already_ended',
      'session', jsonb_build_object(
        'id', v_session.id,
        'user_id', v_session.user_id,
        'started_at', v_session.started_at,
        'ended_at', v_session.ended_at,
        'current_sequence', v_session.current_sequence
      )
    );
  END IF;

  -- End the session
  UPDATE public.study_sessions
     SET ended_at = now()
   WHERE id = p_session_id
  RETURNING id, user_id, started_at, ended_at, current_sequence
    INTO v_session;

  RETURN jsonb_build_object(
    'status', 'ended',
    'session', jsonb_build_object(
      'id', v_session.id,
      'user_id', v_session.user_id,
      'started_at', v_session.started_at,
      'ended_at', v_session.ended_at,
      'current_sequence', v_session.current_sequence
    )
  );
END;
$$;
COMMENT ON FUNCTION public.end_study_session(uuid) IS
  'Ends an open study session owned by auth.uid(). Idempotent. MR-0004.';
-- ===========================================================================
-- RPC 3: complete_match
-- ===========================================================================
-- Validates all question_attempts are in terminal state before scoring.
-- Scoring formula: PATCH_06 v1
-- Idempotent: if match already completed, returns existing row.
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.complete_match(
  p_match_id uuid,
  p_user_id  uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid;
  v_target_user uuid;
  v_attempt record;
  v_total_count integer;
  v_correct_count integer;
  v_non_terminal_count integer;
  v_avg_time numeric;
  v_accuracy_pct numeric;
  v_difficulty_bonus numeric;
  v_speed_bonus numeric;
  v_score_raw integer;
  v_score_normalized numeric(7,4);
  v_updated record;
  c_speed_ceiling_ms constant integer := 30000;
BEGIN
  -- Auth gate
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'STAT_AUTH_REQUIRED: Authentication required'
      USING ERRCODE = 'P0001';
  END IF;

  -- Resolve target user
  v_target_user := COALESCE(p_user_id, v_uid);

  -- Auth: caller must be the target user
  IF v_target_user <> v_uid THEN
    RAISE EXCEPTION 'STAT_MATCH_FORBIDDEN: Cannot complete match for another user'
      USING ERRCODE = 'P0001';
  END IF;

  -- Fetch match_attempt
  SELECT id, match_id, user_id, result_state, score_raw, score_normalized,
         pack_question_count, scoring_version
    INTO v_attempt
    FROM public.match_attempts
   WHERE match_id = p_match_id
     AND user_id = v_target_user;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'STAT_MATCH_NOT_FOUND: No match_attempt for match % user %',
      p_match_id, v_target_user
      USING ERRCODE = 'P0001';
  END IF;

  -- Idempotent: already completed
  IF v_attempt.result_state = 'completed' THEN
    RETURN jsonb_build_object(
      'status', 'already_completed',
      'match_attempt', jsonb_build_object(
        'id', v_attempt.id,
        'match_id', v_attempt.match_id,
        'user_id', v_attempt.user_id,
        'result_state', v_attempt.result_state,
        'score_raw', v_attempt.score_raw,
        'score_normalized', v_attempt.score_normalized
      )
    );
  END IF;

  -- Count question_attempts and check terminal states
  -- Terminal states: correct, incorrect, abandoned, timeout, forfeited
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE correct = true),
    COUNT(*) FILTER (WHERE result_state NOT IN ('correct','incorrect','abandoned','timeout','forfeited'))
  INTO v_total_count, v_correct_count, v_non_terminal_count
  FROM public.question_attempts
  WHERE match_id = p_match_id
    AND user_id = v_target_user;

  -- Validate: must have questions
  IF v_total_count = 0 THEN
    RAISE EXCEPTION 'STAT_MATCH_NO_QUESTIONS: No question_attempts found for match %',
      p_match_id
      USING ERRCODE = 'P0001';
  END IF;

  -- Validate: all must be terminal
  IF v_non_terminal_count > 0 THEN
    RETURN jsonb_build_object(
      'status', 'error',
      'error_code', 'match_incomplete',
      'message', format('%s of %s questions still non-terminal', v_non_terminal_count, v_total_count),
      'non_terminal_count', v_non_terminal_count,
      'total_count', v_total_count
    );
  END IF;

  -- Compute avg time_to_first_answer_ms (exclude NULLs)
  SELECT COALESCE(AVG(time_to_first_answer_ms), c_speed_ceiling_ms)
    INTO v_avg_time
    FROM public.question_attempts
   WHERE match_id = p_match_id
     AND user_id = v_target_user
     AND time_to_first_answer_ms IS NOT NULL;

  -- Scoring formula (PATCH_06, scoring_version = 'v1')
  -- accuracy_pct: 0-100
  v_accuracy_pct := (v_correct_count::numeric / v_total_count) * 100.0;

  -- difficulty_bonus: default 50 (difficulty_snapshot column deferred)
  v_difficulty_bonus := 50.0;

  -- speed_bonus: CLAMP((30000 - avg_time) / 30000 * 100, 0, 100)
  v_speed_bonus := GREATEST(0.0, LEAST(100.0,
    ((c_speed_ceiling_ms - v_avg_time) / c_speed_ceiling_ms) * 100.0
  ));

  -- score_raw = correct count (simple integer)
  v_score_raw := v_correct_count;

  -- score_normalized = weighted composite
  v_score_normalized := ROUND(
    (v_accuracy_pct * 0.60) + (v_difficulty_bonus * 0.25) + (v_speed_bonus * 0.15),
    4
  );

  -- Update match_attempt
  UPDATE public.match_attempts
     SET result_state = 'completed',
         score_raw = v_score_raw,
         score_normalized = v_score_normalized,
         updated_at = now()
   WHERE id = v_attempt.id
  RETURNING id, match_id, user_id, result_state, score_raw, score_normalized,
            scoring_version, pack_question_count, updated_at
    INTO v_updated;

  RETURN jsonb_build_object(
    'status', 'completed',
    'match_attempt', jsonb_build_object(
      'id', v_updated.id,
      'match_id', v_updated.match_id,
      'user_id', v_updated.user_id,
      'result_state', v_updated.result_state,
      'score_raw', v_updated.score_raw,
      'score_normalized', v_updated.score_normalized,
      'scoring_version', v_updated.scoring_version,
      'pack_question_count', v_updated.pack_question_count,
      'updated_at', v_updated.updated_at
    ),
    'scoring_detail', jsonb_build_object(
      'accuracy_pct', ROUND(v_accuracy_pct, 2),
      'difficulty_bonus', ROUND(v_difficulty_bonus, 2),
      'speed_bonus', ROUND(v_speed_bonus, 2),
      'avg_time_ms', ROUND(v_avg_time),
      'correct_count', v_correct_count,
      'total_count', v_total_count
    )
  );
END;
$$;
COMMENT ON FUNCTION public.complete_match(uuid, uuid) IS
  'Validates all question_attempts are terminal, computes score, marks match completed. Idempotent. PATCH_06 v1 scoring. MR-0004.';
-- ===========================================================================
-- ROLLBACK (commented out)
-- ===========================================================================
-- DROP FUNCTION IF EXISTS public.complete_match(uuid, uuid);
-- DROP FUNCTION IF EXISTS public.end_study_session(uuid);
-- DROP FUNCTION IF EXISTS public.start_study_session();;
