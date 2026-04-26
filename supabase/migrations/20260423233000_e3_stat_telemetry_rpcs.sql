-- =============================================================================
-- 20260423233000_e3_stat_telemetry_rpcs.sql
-- E3 STAT Performance Intelligence Layer - Telemetry RPCs
-- Authority: MR-0004 (ULTIMATE_PERFORMANCE_LAYER_PLAN v4.0.0)
-- Prompt ID: (E3)-STAT-PH2-CLAUDE-HIGH-002
-- Depends on: 20260423230000_e3_stat_session_match_rpcs.sql
-- =============================================================================
-- Scope:
--   RPC 4: log_question_presented(params jsonb)
--   RPC 5: log_question_answered(params jsonb)
--   RPC 6: get_match_state(p_match_id uuid)
-- =============================================================================
-- All RPCs: SECURITY DEFINER, search_path = public, pg_temp
-- =============================================================================
-- Unique constraints on question_attempts:
--   1. (match_id, user_id, q_index)        -- one row per question position
--   2. (user_id, client_event_id)           -- client-side dedup
--   3. (match_id, server_sequence_index)    -- monotonic server ordering
-- =============================================================================
-- Terminal states (immutable once set):
--   correct, incorrect, abandoned, timeout, forfeited
-- Non-terminal:
--   presented (initial on present), pending (legacy)
-- =============================================================================

-- ===========================================================================
-- RPC 4: log_question_presented
-- ===========================================================================
-- Creates a question_attempt row when a question is shown to the user.
-- Atomically assigns server_sequence_index within match scope.
-- Idempotent on client_event_id and (match, user, q_index).
-- Binds to active study session if one exists.
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.log_question_presented(params jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid             uuid;
  v_match_id        uuid;
  v_question_id     text;
  v_q_index         integer;
  v_choices_order   text[];
  v_dataset_version text;
  v_content_hash    text;
  v_client_event_id uuid;
  v_question_started_at timestamptz;
  v_session_id      uuid;
  v_seq_index       integer;
  v_existing        record;
  v_new             record;
  v_computed_correct integer;
BEGIN
  -- Auth gate
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'STAT_AUTH_REQUIRED: Authentication required'
      USING ERRCODE = 'P0001';
  END IF;

  -- Extract required params
  v_match_id        := (params->>'match_id')::uuid;
  v_question_id     := params->>'question_id';
  v_q_index         := (params->>'q_index')::integer;
  v_dataset_version := params->>'dataset_version';
  v_content_hash    := params->>'content_hash';
  v_client_event_id := (params->>'client_event_id')::uuid;
  v_question_started_at := (params->>'question_started_at')::timestamptz;

  -- Extract displayed_choices_order from jsonb array to text[]
  SELECT ARRAY(
    SELECT jsonb_array_elements_text(params->'displayed_choices_order')
  ) INTO v_choices_order;

  -- Validate required fields
  IF v_match_id IS NULL OR v_question_id IS NULL OR v_q_index IS NULL
     OR v_choices_order IS NULL OR v_dataset_version IS NULL
     OR v_content_hash IS NULL OR v_client_event_id IS NULL THEN
    RAISE EXCEPTION 'STAT_INVALID_PARAMS: Missing required fields (match_id, question_id, q_index, displayed_choices_order, dataset_version, content_hash, client_event_id)'
      USING ERRCODE = 'P0001';
  END IF;

  -- Idempotent check 1: client_event_id dedup
  SELECT id, match_id, user_id, q_index, result_state, server_sequence_index
    INTO v_existing
    FROM public.question_attempts
   WHERE user_id = v_uid
     AND client_event_id = v_client_event_id;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'status', 'duplicate_event',
      'question_attempt', jsonb_build_object(
        'id', v_existing.id,
        'match_id', v_existing.match_id,
        'q_index', v_existing.q_index,
        'result_state', v_existing.result_state,
        'server_sequence_index', v_existing.server_sequence_index
      )
    );
  END IF;

  -- Idempotent check 2: (match_id, user_id, q_index) re-present
  SELECT id, match_id, user_id, q_index, result_state, server_sequence_index
    INTO v_existing
    FROM public.question_attempts
   WHERE match_id = v_match_id
     AND user_id = v_uid
     AND q_index = v_q_index;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'status', 're_presented',
      'question_attempt', jsonb_build_object(
        'id', v_existing.id,
        'match_id', v_existing.match_id,
        'q_index', v_existing.q_index,
        'result_state', v_existing.result_state,
        'server_sequence_index', v_existing.server_sequence_index
      )
    );
  END IF;

  -- Bind to active study session
  SELECT id INTO v_session_id
    FROM public.study_sessions
   WHERE user_id = v_uid
     AND ended_at IS NULL
   LIMIT 1;

  -- Atomically assign server_sequence_index via advisory lock on match scope
  PERFORM pg_advisory_xact_lock(hashtext(v_match_id::text));
  SELECT COALESCE(MAX(server_sequence_index), -1) + 1
    INTO v_seq_index
    FROM public.question_attempts
   WHERE match_id = v_match_id
  ;

  -- Compute correct index after permutation if answer_map data available
  -- Uses the displayed_choices_order to find which index holds the correct answer
  -- This will be NULL if the answer_map lookup is not possible at this stage
  BEGIN
    SELECT idx - 1 INTO v_computed_correct
    FROM (
      SELECT ordinality AS idx, val
      FROM unnest(v_choices_order) WITH ORDINALITY AS t(val, ordinality)
    ) sub
    JOIN (
      SELECT (elem->>'answer')::text AS correct_key
      FROM jsonb_array_elements(
        answer_map_for(ARRAY[v_question_id], v_dataset_version)
      ) AS elem
      WHERE elem->>'id' = v_question_id
    ) ans ON sub.val = ans.correct_key
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    v_computed_correct := NULL;
  END;

  -- Insert the question_attempt row
  INSERT INTO public.question_attempts (
    match_id, user_id, session_id, question_id, q_index,
    displayed_choices_order, computed_correct_index_after_permutation,
    result_state, question_started_at, server_received_presented_at,
    dataset_version, content_hash, client_event_id, server_sequence_index
  ) VALUES (
    v_match_id, v_uid, v_session_id, v_question_id, v_q_index,
    v_choices_order, v_computed_correct,
    'presented', v_question_started_at, now(),
    v_dataset_version, v_content_hash, v_client_event_id, v_seq_index
  )
  RETURNING id, match_id, user_id, q_index, result_state,
            server_sequence_index, computed_correct_index_after_permutation
    INTO v_new;

  RETURN jsonb_build_object(
    'status', 'created',
    'question_attempt', jsonb_build_object(
      'id', v_new.id,
      'match_id', v_new.match_id,
      'q_index', v_new.q_index,
      'result_state', v_new.result_state,
      'server_sequence_index', v_new.server_sequence_index,
      'computed_correct_index', v_new.computed_correct_index_after_permutation
    )
  );
END;
$$;
COMMENT ON FUNCTION public.log_question_presented(jsonb) IS
  'Records question presentation event. Assigns server_sequence_index, binds to session, computes correct index. Idempotent on client_event_id and (match, user, q_index). MR-0004.';
-- ===========================================================================
-- RPC 5: log_question_answered
-- ===========================================================================
-- Updates an existing question_attempt with the user's answer.
-- Terminal rows are immutable; duplicate answer returns existing row.
-- Out-of-order support: if no presented row exists, creates the row
-- (merging presented + answered into one row using existing schema fields).
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.log_question_answered(params jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid               uuid;
  v_match_id          uuid;
  v_q_index           integer;
  v_selected_index    integer;
  v_client_event_id   uuid;
  v_question_answered_at timestamptz;
  v_existing          record;
  v_is_correct        boolean;
  v_new_result_state  text;
  v_time_to_first     integer;
  v_total_time        integer;
  v_updated           record;
  -- Out-of-order fields (optional, for merge-create)
  v_question_id       text;
  v_choices_order     text[];
  v_dataset_version   text;
  v_content_hash      text;
  v_session_id        uuid;
  v_seq_index         integer;
  v_computed_correct  integer;
  v_new               record;
BEGIN
  -- Auth gate
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'STAT_AUTH_REQUIRED: Authentication required'
      USING ERRCODE = 'P0001';
  END IF;

  -- Extract required params
  v_match_id          := (params->>'match_id')::uuid;
  v_q_index           := (params->>'q_index')::integer;
  v_selected_index    := (params->>'selected_index')::integer;
  v_client_event_id   := (params->>'client_event_id')::uuid;
  v_question_answered_at := (params->>'question_answered_at')::timestamptz;

  -- Validate required fields
  IF v_match_id IS NULL OR v_q_index IS NULL
     OR v_selected_index IS NULL OR v_client_event_id IS NULL THEN
    RAISE EXCEPTION 'STAT_INVALID_PARAMS: Missing required fields (match_id, q_index, selected_index, client_event_id)'
      USING ERRCODE = 'P0001';
  END IF;

  -- Client event dedup: check if this exact client_event_id already recorded
  SELECT id, match_id, q_index, result_state, selected_index, correct
    INTO v_existing
    FROM public.question_attempts
   WHERE user_id = v_uid
     AND client_event_id = v_client_event_id;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'status', 'duplicate_event',
      'question_attempt', jsonb_build_object(
        'id', v_existing.id,
        'match_id', v_existing.match_id,
        'q_index', v_existing.q_index,
        'result_state', v_existing.result_state,
        'selected_index', v_existing.selected_index,
        'correct', v_existing.correct
      )
    );
  END IF;

  -- Look up existing presented row
  SELECT id, match_id, user_id, q_index, result_state, selected_index, correct,
         computed_correct_index_after_permutation, question_started_at,
         displayed_choices_order
    INTO v_existing
    FROM public.question_attempts
   WHERE match_id = v_match_id
     AND user_id = v_uid
     AND q_index = v_q_index;

  IF FOUND THEN
    -- Terminal state guard: do not overwrite
    IF v_existing.result_state IN ('correct','incorrect','abandoned','timeout','forfeited') THEN
      RETURN jsonb_build_object(
        'status', 'already_terminal',
        'question_attempt', jsonb_build_object(
          'id', v_existing.id,
          'match_id', v_existing.match_id,
          'q_index', v_existing.q_index,
          'result_state', v_existing.result_state,
          'selected_index', v_existing.selected_index,
          'correct', v_existing.correct
        )
      );
    END IF;

    -- Compute correctness from computed_correct_index_after_permutation
    IF v_existing.computed_correct_index_after_permutation IS NOT NULL THEN
      v_is_correct := (v_selected_index = v_existing.computed_correct_index_after_permutation);
    ELSE
      v_is_correct := NULL;
    END IF;

    v_new_result_state := CASE
      WHEN v_is_correct = true THEN 'correct'
      WHEN v_is_correct = false THEN 'incorrect'
      ELSE 'incorrect'
    END;

    -- Compute timing
    IF v_existing.question_started_at IS NOT NULL AND v_question_answered_at IS NOT NULL THEN
      v_time_to_first := EXTRACT(EPOCH FROM (v_question_answered_at - v_existing.question_started_at))::integer * 1000;
      v_total_time := v_time_to_first;
    END IF;

    -- Update the row
    UPDATE public.question_attempts
       SET selected_index = v_selected_index,
           correct = v_is_correct,
           result_state = v_new_result_state,
           question_answered_at = v_question_answered_at,
           server_received_answered_at = now(),
           time_to_first_answer_ms = v_time_to_first,
           total_time_on_question_ms = v_total_time,
           client_event_id = v_client_event_id
     WHERE id = v_existing.id
    RETURNING id, match_id, user_id, q_index, result_state,
              selected_index, correct, time_to_first_answer_ms
      INTO v_updated;

    RETURN jsonb_build_object(
      'status', 'answered',
      'question_attempt', jsonb_build_object(
        'id', v_updated.id,
        'match_id', v_updated.match_id,
        'q_index', v_updated.q_index,
        'result_state', v_updated.result_state,
        'selected_index', v_updated.selected_index,
        'correct', v_updated.correct,
        'time_to_first_answer_ms', v_updated.time_to_first_answer_ms
      )
    );

  ELSE
    -- =====================================================================
    -- OUT-OF-ORDER: answer arrived before present event
    -- Create the row as a merged present+answer using existing schema fields.
    -- The presented event, if it arrives later, will hit the (match, user, q_index)
    -- dedup and return the existing row (re_presented path).
    -- =====================================================================

    -- Extract optional fields the client may have included for out-of-order
    v_question_id     := params->>'question_id';
    v_dataset_version := params->>'dataset_version';
    v_content_hash    := params->>'content_hash';

    IF v_question_id IS NULL OR v_dataset_version IS NULL OR v_content_hash IS NULL THEN
      RAISE EXCEPTION 'STAT_OUT_OF_ORDER_MISSING_FIELDS: Out-of-order answer requires question_id, dataset_version, content_hash'
        USING ERRCODE = 'P0001';
    END IF;

    -- Extract displayed_choices_order if provided
    IF params ? 'displayed_choices_order' THEN
      SELECT ARRAY(
        SELECT jsonb_array_elements_text(params->'displayed_choices_order')
      ) INTO v_choices_order;
    ELSE
      -- Must have choices to compute correctness
      RAISE EXCEPTION 'STAT_OUT_OF_ORDER_MISSING_FIELDS: Out-of-order answer requires displayed_choices_order'
        USING ERRCODE = 'P0001';
    END IF;

    -- Bind to active session
    SELECT id INTO v_session_id
      FROM public.study_sessions
     WHERE user_id = v_uid
       AND ended_at IS NULL
     LIMIT 1;

    -- Assign server_sequence_index
    SELECT COALESCE(MAX(server_sequence_index), -1) + 1
      INTO v_seq_index
      FROM public.question_attempts
     WHERE match_id = v_match_id
    ;

    -- Compute correct index
    BEGIN
      SELECT idx - 1 INTO v_computed_correct
      FROM (
        SELECT ordinality AS idx, val
        FROM unnest(v_choices_order) WITH ORDINALITY AS t(val, ordinality)
      ) sub
      JOIN (
        SELECT (elem->>'answer')::text AS correct_key
        FROM jsonb_array_elements(
          answer_map_for(ARRAY[v_question_id], v_dataset_version)
        ) AS elem
        WHERE elem->>'id' = v_question_id
      ) ans ON sub.val = ans.correct_key
      LIMIT 1;
    EXCEPTION WHEN OTHERS THEN
      v_computed_correct := NULL;
    END;

    -- Compute correctness
    IF v_computed_correct IS NOT NULL THEN
      v_is_correct := (v_selected_index = v_computed_correct);
    ELSE
      v_is_correct := NULL;
    END IF;

    v_new_result_state := CASE
      WHEN v_is_correct = true THEN 'correct'
      WHEN v_is_correct = false THEN 'incorrect'
      ELSE 'incorrect'
    END;

    -- Insert merged row (presented + answered in one)
    INSERT INTO public.question_attempts (
      match_id, user_id, session_id, question_id, q_index,
      displayed_choices_order, computed_correct_index_after_permutation,
      selected_index, correct, result_state,
      question_answered_at, server_received_answered_at,
      time_to_first_answer_ms, total_time_on_question_ms,
      dataset_version, content_hash, client_event_id, server_sequence_index
    ) VALUES (
      v_match_id, v_uid, v_session_id, v_question_id, v_q_index,
      v_choices_order, v_computed_correct,
      v_selected_index, v_is_correct, v_new_result_state,
      v_question_answered_at, now(),
      NULL, NULL,
      v_dataset_version, v_content_hash, v_client_event_id, v_seq_index
    )
    RETURNING id, match_id, user_id, q_index, result_state,
              selected_index, correct, server_sequence_index
      INTO v_new;

    RETURN jsonb_build_object(
      'status', 'out_of_order_merged',
      'question_attempt', jsonb_build_object(
        'id', v_new.id,
        'match_id', v_new.match_id,
        'q_index', v_new.q_index,
        'result_state', v_new.result_state,
        'selected_index', v_new.selected_index,
        'correct', v_new.correct,
        'server_sequence_index', v_new.server_sequence_index
      )
    );
  END IF;
END;
$$;
COMMENT ON FUNCTION public.log_question_answered(jsonb) IS
  'Records answer event. Updates existing presented row or creates merged row for out-of-order arrival. Terminal rows immutable. Idempotent on client_event_id. MR-0004.';
-- ===========================================================================
-- RPC 6: get_match_state
-- ===========================================================================
-- Returns the match_attempt + all question_attempts for a match,
-- ordered by server_sequence_index ASC.
-- Auth: user must be a participant (have a match_attempt row).
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.get_match_state(p_match_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid;
  v_match_attempt record;
  v_questions jsonb;
BEGIN
  -- Auth gate
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'STAT_AUTH_REQUIRED: Authentication required'
      USING ERRCODE = 'P0001';
  END IF;

  -- Fetch match_attempt with participant check
  SELECT id, match_id, user_id, session_id, mode_type,
         dataset_version, content_hash, pack_question_count,
         result_state, scoring_version, score_raw, score_normalized,
         session_sequence_index, created_at, updated_at
    INTO v_match_attempt
    FROM public.match_attempts
   WHERE match_id = p_match_id
     AND user_id = v_uid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'STAT_MATCH_NOT_FOUND: No match_attempt for match % user %',
      p_match_id, v_uid
      USING ERRCODE = 'P0001';
  END IF;

  -- Fetch question_attempts ordered by server_sequence_index ASC
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', qa.id,
      'question_id', qa.question_id,
      'q_index', qa.q_index,
      'displayed_choices_order', qa.displayed_choices_order,
      'computed_correct_index', qa.computed_correct_index_after_permutation,
      'selected_index', qa.selected_index,
      'correct', qa.correct,
      'result_state', qa.result_state,
      'question_started_at', qa.question_started_at,
      'question_answered_at', qa.question_answered_at,
      'time_to_first_answer_ms', qa.time_to_first_answer_ms,
      'total_time_on_question_ms', qa.total_time_on_question_ms,
      'server_sequence_index', qa.server_sequence_index
    ) ORDER BY qa.server_sequence_index ASC
  ), '[]'::jsonb)
    INTO v_questions
    FROM public.question_attempts qa
   WHERE qa.match_id = p_match_id
     AND qa.user_id = v_uid;

  RETURN jsonb_build_object(
    'match_attempt', jsonb_build_object(
      'id', v_match_attempt.id,
      'match_id', v_match_attempt.match_id,
      'user_id', v_match_attempt.user_id,
      'session_id', v_match_attempt.session_id,
      'mode_type', v_match_attempt.mode_type,
      'dataset_version', v_match_attempt.dataset_version,
      'content_hash', v_match_attempt.content_hash,
      'pack_question_count', v_match_attempt.pack_question_count,
      'result_state', v_match_attempt.result_state,
      'scoring_version', v_match_attempt.scoring_version,
      'score_raw', v_match_attempt.score_raw,
      'score_normalized', v_match_attempt.score_normalized,
      'created_at', v_match_attempt.created_at,
      'updated_at', v_match_attempt.updated_at
    ),
    'question_attempts', v_questions,
    'question_count', jsonb_array_length(v_questions)
  );
END;
$$;
COMMENT ON FUNCTION public.get_match_state(uuid) IS
  'Returns match_attempt + question_attempts ordered by server_sequence_index ASC. Auth-gated to participant. MR-0004.';
-- ===========================================================================
-- ROLLBACK (commented out)
-- ===========================================================================
-- DROP FUNCTION IF EXISTS public.get_match_state(uuid);
-- DROP FUNCTION IF EXISTS public.log_question_answered(jsonb);
-- DROP FUNCTION IF EXISTS public.log_question_presented(jsonb);;
