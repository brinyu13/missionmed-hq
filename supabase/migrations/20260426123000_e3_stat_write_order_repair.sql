-- =============================================================================
-- 20260426123000_e3_stat_write_order_repair.sql
-- E3 STAT telemetry write-order repair (backend only)
-- Prompt ID: MR-E3-BACKEND-WRITE-ORDER-REPAIR-009
-- =============================================================================
-- Purpose:
--   Ensure canonical write ordering for telemetry persistence by guaranteeing
--   a match_attempt row exists before any question_attempt write.
--
-- Scope (minimal):
--   1) Add private helper: private_e3_ensure_match_attempt(...)
--   2) Patch RPC: log_question_presented(jsonb)
--   3) Patch RPC: log_question_answered(jsonb)
--
-- Non-goals:
--   - No frontend changes
--   - No MMOS/auth architecture changes
--   - No _HOLD migration adoption
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- PRIVATE HELPER: ensure/create canonical match_attempt before question writes
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.private_e3_ensure_match_attempt(
  p_match_id uuid,
  p_user_id uuid,
  p_dataset_version text DEFAULT NULL,
  p_content_hash text DEFAULT NULL,
  p_pack_question_count integer DEFAULT NULL,
  p_session_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_existing record;
  v_duel record;
  v_latest_qa record;
  v_dataset_version text;
  v_content_hash text;
  v_pack_question_count integer;
  v_session_id uuid;
BEGIN
  IF p_match_id IS NULL OR p_user_id IS NULL THEN
    RAISE EXCEPTION 'STAT_INVALID_PARAMS: match_id and user_id are required'
      USING ERRCODE = 'P0001';
  END IF;

  v_dataset_version := NULLIF(BTRIM(COALESCE(p_dataset_version, '')), '');
  v_content_hash := NULLIF(BTRIM(COALESCE(p_content_hash, '')), '');
  v_pack_question_count := NULLIF(p_pack_question_count, 0);
  v_session_id := p_session_id;

  -- Confirm session first (canonical step 1).
  IF v_session_id IS NULL THEN
    SELECT id
      INTO v_session_id
      FROM public.study_sessions
     WHERE user_id = p_user_id
       AND ended_at IS NULL
     LIMIT 1;

    IF v_session_id IS NULL THEN
      BEGIN
        INSERT INTO public.study_sessions (user_id)
        VALUES (p_user_id)
        RETURNING id INTO v_session_id;
      EXCEPTION WHEN unique_violation THEN
        SELECT id
          INTO v_session_id
          FROM public.study_sessions
         WHERE user_id = p_user_id
           AND ended_at IS NULL
         LIMIT 1;
      END;
    END IF;
  END IF;

  -- Prefer canonical provenance from duel_challenges when available.
  IF to_regclass('public.duel_challenges') IS NOT NULL THEN
    SELECT
      NULLIF(BTRIM(COALESCE(d.dataset_version, '')), '') AS dataset_version,
      NULLIF(BTRIM(COALESCE(d.content_hash, '')), '') AS content_hash,
      COALESCE(NULLIF(d.pack_question_count, 0), array_length(d.question_ids, 1)) AS pack_question_count
    INTO v_duel
    FROM public.duel_challenges d
    WHERE d.id = p_match_id
    LIMIT 1;

    IF FOUND THEN
      v_dataset_version := COALESCE(v_duel.dataset_version, v_dataset_version);
      v_content_hash := COALESCE(v_duel.content_hash, v_content_hash);
      v_pack_question_count := COALESCE(v_duel.pack_question_count, v_pack_question_count);
    END IF;
  END IF;

  -- Fallback to most recent question_attempt provenance (if any).
  IF v_dataset_version IS NULL OR v_content_hash IS NULL THEN
    SELECT
      NULLIF(BTRIM(COALESCE(qa.dataset_version, '')), '') AS dataset_version,
      NULLIF(BTRIM(COALESCE(qa.content_hash, '')), '') AS content_hash
    INTO v_latest_qa
    FROM public.question_attempts qa
    WHERE qa.match_id = p_match_id
      AND qa.user_id = p_user_id
    ORDER BY qa.created_at DESC
    LIMIT 1;

    IF FOUND THEN
      v_dataset_version := COALESCE(v_dataset_version, v_latest_qa.dataset_version);
      v_content_hash := COALESCE(v_content_hash, v_latest_qa.content_hash);
    END IF;
  END IF;

  -- If no canonical pack count is available yet, clamp to a safe minimum.
  IF v_pack_question_count IS NULL OR v_pack_question_count < 1 THEN
    v_pack_question_count := 1;
  END IF;

  SELECT
    id,
    dataset_version,
    content_hash,
    pack_question_count,
    session_id
  INTO v_existing
  FROM public.match_attempts
  WHERE match_id = p_match_id
    AND user_id = p_user_id
  FOR UPDATE;

  IF FOUND THEN
    -- Guard against canonical drift.
    IF v_dataset_version IS NOT NULL
       AND v_existing.dataset_version IS NOT NULL
       AND v_existing.dataset_version <> v_dataset_version THEN
      RAISE EXCEPTION 'STAT_MATCH_CANON_MISMATCH: dataset_version mismatch for match % user %',
        p_match_id, p_user_id
        USING ERRCODE = 'P0001';
    END IF;

    IF v_content_hash IS NOT NULL
       AND v_existing.content_hash IS NOT NULL
       AND v_existing.content_hash <> v_content_hash THEN
      RAISE EXCEPTION 'STAT_MATCH_CANON_MISMATCH: content_hash mismatch for match % user %',
        p_match_id, p_user_id
        USING ERRCODE = 'P0001';
    END IF;

    UPDATE public.match_attempts
       SET session_id = COALESCE(v_existing.session_id, v_session_id),
           pack_question_count = COALESCE(NULLIF(v_existing.pack_question_count, 0), v_pack_question_count),
           updated_at = now()
     WHERE id = v_existing.id;

    RETURN;
  END IF;

  IF v_dataset_version IS NULL OR v_content_hash IS NULL THEN
    RAISE EXCEPTION 'STAT_MATCH_BOOTSTRAP_MISSING_CANON: Missing dataset/content for match %',
      p_match_id
      USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.match_attempts (
    match_id,
    user_id,
    session_id,
    mode_type,
    dataset_version,
    content_hash,
    pack_question_count,
    result_state,
    scoring_version
  ) VALUES (
    p_match_id,
    p_user_id,
    v_session_id,
    'async_duel',
    v_dataset_version,
    v_content_hash,
    v_pack_question_count,
    'in_progress',
    'v1'
  )
  ON CONFLICT (match_id, user_id)
  DO UPDATE
     SET session_id = COALESCE(public.match_attempts.session_id, EXCLUDED.session_id),
         pack_question_count = COALESCE(NULLIF(public.match_attempts.pack_question_count, 0), EXCLUDED.pack_question_count),
         updated_at = now();
END;
$$;

COMMENT ON FUNCTION public.private_e3_ensure_match_attempt(uuid, uuid, text, text, integer, uuid) IS
  'Internal helper for MR-E3-BACKEND-WRITE-ORDER-REPAIR-009: ensures a canonical match_attempt exists before telemetry question writes.';

REVOKE ALL ON FUNCTION public.private_e3_ensure_match_attempt(uuid, uuid, text, text, integer, uuid) FROM PUBLIC;

-- -----------------------------------------------------------------------------
-- PATCH RPC: log_question_presented
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_question_presented(params jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid;
  v_match_id uuid;
  v_question_id text;
  v_q_index integer;
  v_choices_order text[];
  v_dataset_version text;
  v_content_hash text;
  v_client_event_id uuid;
  v_question_started_at timestamptz;
  v_session_id uuid;
  v_session_from_params uuid;
  v_pack_question_count integer;
  v_seq_index integer;
  v_existing record;
  v_new record;
  v_computed_correct integer;
BEGIN
  -- Auth gate
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'STAT_AUTH_REQUIRED: Authentication required'
      USING ERRCODE = 'P0001';
  END IF;

  -- Extract required params
  v_match_id := (params->>'match_id')::uuid;
  v_question_id := params->>'question_id';
  v_q_index := (params->>'q_index')::integer;
  v_dataset_version := params->>'dataset_version';
  v_content_hash := params->>'content_hash';
  v_client_event_id := (params->>'client_event_id')::uuid;
  v_question_started_at := (params->>'question_started_at')::timestamptz;

  IF COALESCE(params->>'pack_question_count', '') ~ '^[0-9]+$' THEN
    v_pack_question_count := GREATEST((params->>'pack_question_count')::integer, 1);
  END IF;

  BEGIN
    v_session_from_params := NULLIF(params->>'session_id', '')::uuid;
  EXCEPTION WHEN OTHERS THEN
    v_session_from_params := NULL;
  END;

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

  v_session_id := COALESCE(v_session_from_params, v_session_id);

  -- Canonical ordering: ensure match_attempt exists BEFORE question_attempt write.
  PERFORM public.private_e3_ensure_match_attempt(
    v_match_id,
    v_uid,
    v_dataset_version,
    v_content_hash,
    v_pack_question_count,
    v_session_id
  );

  -- Atomically assign server_sequence_index via advisory lock on match scope
  PERFORM pg_advisory_xact_lock(hashtext(v_match_id::text));
  SELECT COALESCE(MAX(server_sequence_index), -1) + 1
    INTO v_seq_index
    FROM public.question_attempts
   WHERE match_id = v_match_id;

  -- Compute correct index after permutation if answer_map data available
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
  'Records question presentation event. Guarantees canonical match_attempt bootstrap before question writes. Idempotent on client_event_id and (match, user, q_index). MR-E3-BACKEND-WRITE-ORDER-REPAIR-009.';

-- -----------------------------------------------------------------------------
-- PATCH RPC: log_question_answered
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_question_answered(params jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid;
  v_match_id uuid;
  v_q_index integer;
  v_selected_index integer;
  v_client_event_id uuid;
  v_question_answered_at timestamptz;
  v_existing record;
  v_is_correct boolean;
  v_new_result_state text;
  v_time_to_first integer;
  v_total_time integer;
  v_updated record;
  -- Out-of-order fields (optional, for merge-create)
  v_question_id text;
  v_choices_order text[];
  v_dataset_version text;
  v_content_hash text;
  v_pack_question_count integer;
  v_session_id uuid;
  v_seq_index integer;
  v_computed_correct integer;
  v_new record;
BEGIN
  -- Auth gate
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'STAT_AUTH_REQUIRED: Authentication required'
      USING ERRCODE = 'P0001';
  END IF;

  -- Extract required params
  v_match_id := (params->>'match_id')::uuid;
  v_q_index := (params->>'q_index')::integer;
  v_selected_index := (params->>'selected_index')::integer;
  v_client_event_id := (params->>'client_event_id')::uuid;
  v_question_answered_at := (params->>'question_answered_at')::timestamptz;

  IF COALESCE(params->>'pack_question_count', '') ~ '^[0-9]+$' THEN
    v_pack_question_count := GREATEST((params->>'pack_question_count')::integer, 1);
  END IF;

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
         displayed_choices_order, dataset_version, content_hash, session_id
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

    -- Canonical ordering: ensure/confirm match_attempt before write.
    PERFORM public.private_e3_ensure_match_attempt(
      v_match_id,
      v_uid,
      v_existing.dataset_version,
      v_existing.content_hash,
      v_pack_question_count,
      v_existing.session_id
    );

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
    -- Out-of-order: answer arrived before present event.
    v_question_id := params->>'question_id';
    v_dataset_version := params->>'dataset_version';
    v_content_hash := params->>'content_hash';

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
      RAISE EXCEPTION 'STAT_OUT_OF_ORDER_MISSING_FIELDS: Out-of-order answer requires displayed_choices_order'
        USING ERRCODE = 'P0001';
    END IF;

    -- Bind to active session
    SELECT id INTO v_session_id
      FROM public.study_sessions
     WHERE user_id = v_uid
       AND ended_at IS NULL
     LIMIT 1;

    -- Canonical ordering: ensure match_attempt exists before write.
    PERFORM public.private_e3_ensure_match_attempt(
      v_match_id,
      v_uid,
      v_dataset_version,
      v_content_hash,
      v_pack_question_count,
      v_session_id
    );

    -- Atomically assign server_sequence_index within match scope
    PERFORM pg_advisory_xact_lock(hashtext(v_match_id::text));
    SELECT COALESCE(MAX(server_sequence_index), -1) + 1
      INTO v_seq_index
      FROM public.question_attempts
     WHERE match_id = v_match_id;

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
  'Records answer event. Ensures canonical match_attempt bootstrap before question writes. Updates existing presented row or creates merged row for out-of-order arrival. Terminal rows immutable. Idempotent on client_event_id. MR-E3-BACKEND-WRITE-ORDER-REPAIR-009.';

COMMIT;
