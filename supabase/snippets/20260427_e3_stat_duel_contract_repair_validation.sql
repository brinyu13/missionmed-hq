-- =============================================================================
-- 20260427_e3_stat_duel_contract_repair_validation.sql
-- Prompt ID: MR-E3-BACKEND-CONTRACT-REPAIR-025
-- Purpose: Validate E3 duel/telemetry contract repair in a rollback-safe run.
-- Target project: fglyvdykwgbuivikqoah
-- =============================================================================

BEGIN;

DO $$
DECLARE
  v_uid uuid;
  v_session jsonb;
  v_create jsonb;
  v_submit jsonb;
  v_presented jsonb;
  v_answered jsonb;
  v_complete jsonb;

  v_presented_dup jsonb;
  v_answered_dup jsonb;

  v_duel_id uuid;
  v_duel_state text;
  v_dataset_version text;
  v_content_hash text;
  v_qid text;
  v_choices jsonb;

  v_presented_event uuid := gen_random_uuid();
  v_answered_event uuid := gen_random_uuid();

  v_match_attempt_count integer := 0;
  v_question_attempt_count integer := 0;
  v_duels_parent_count integer := 0;
BEGIN
  -- ---------------------------------------------------------------------------
  -- 0) Resolve test user and impersonate auth.uid() context
  -- ---------------------------------------------------------------------------
  IF to_regclass('auth.users') IS NOT NULL THEN
    BEGIN
      SELECT u.id INTO v_uid
      FROM auth.users u
      ORDER BY u.created_at DESC
      LIMIT 1;
    EXCEPTION WHEN OTHERS THEN
      v_uid := NULL;
    END;
  END IF;

  IF v_uid IS NULL THEN
    SELECT pp.user_id INTO v_uid
    FROM public.player_profiles pp
    WHERE pp.user_id IS NOT NULL
    ORDER BY pp.created_at DESC
    LIMIT 1;
  END IF;

  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'VALIDATION_ABORT: no candidate auth user found';
  END IF;

  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', v_uid::text, true);

  -- ---------------------------------------------------------------------------
  -- 1) start_study_session
  -- ---------------------------------------------------------------------------
  v_session := public.start_study_session();
  IF COALESCE(v_session->>'status', '') NOT IN ('created', 'existing') THEN
    RAISE EXCEPTION 'VALIDATION_FAIL[1]: start_study_session status=% payload=%',
      COALESCE(v_session->>'status','(null)'), v_session;
  END IF;

  -- ---------------------------------------------------------------------------
  -- 2) create_duel (bot path) must return usable duel id
  -- ---------------------------------------------------------------------------
  v_create := public.create_duel(
    p_opponent_id := NULL,
    p_question_set := NULL,
    p_idempotency_key := 'e3-contract-validation-create-' || gen_random_uuid()::text,
    p_is_bot_match := true,
    p_bot_profile_id := NULL,
    p_source := 'e3_contract_validation',
    p_dataset_version := NULL
  );

  v_duel_id := NULLIF(COALESCE(
    v_create #>> '{duel,id}',
    v_create #>> '{data,duel,id}',
    v_create #>> '{data,duel_id}',
    v_create #>> '{duel_id}'
  ), '')::uuid;

  IF v_duel_id IS NULL THEN
    RAISE EXCEPTION 'VALIDATION_FAIL[2]: create_duel returned no usable duel id payload=%', v_create;
  END IF;

  SELECT d.state, d.dataset_version, d.content_hash,
         COALESCE(d.question_ids[1], 'q1') AS qid,
         COALESCE(d.choices_order->0, '["A","B","C","D"]'::jsonb) AS choices
    INTO v_duel_state, v_dataset_version, v_content_hash, v_qid, v_choices
  FROM public.duel_challenges d
  WHERE d.id = v_duel_id;

  IF v_duel_state IS NULL THEN
    RAISE EXCEPTION 'VALIDATION_FAIL[2]: duel_challenges row missing for duel_id=%', v_duel_id;
  END IF;

  -- ---------------------------------------------------------------------------
  -- 3) submit_attempt must accept canonical current duel state (includes active)
  -- ---------------------------------------------------------------------------
  v_submit := public.submit_attempt(
    p_duel_id := v_duel_id,
    p_answers := '[]'::jsonb,
    p_total_time_ms := 0,
    p_idempotency_key := 'e3-contract-validation-submit-' || gen_random_uuid()::text
  );

  IF COALESCE(v_submit->>'status','') <> 'ok' THEN
    RAISE EXCEPTION 'VALIDATION_FAIL[6]: submit_attempt did not succeed in state=% payload=%',
      v_duel_state, v_submit;
  END IF;

  -- ---------------------------------------------------------------------------
  -- 4) telemetry write path: presented -> answered
  -- ---------------------------------------------------------------------------
  IF COALESCE(v_dataset_version, '') = '' OR COALESCE(v_content_hash, '') = '' THEN
    RAISE EXCEPTION 'VALIDATION_ABORT: duel canonical metadata missing dataset/content for duel_id=%', v_duel_id;
  END IF;

  IF jsonb_typeof(v_choices) <> 'array' THEN
    v_choices := '["A","B","C","D"]'::jsonb;
  END IF;

  v_presented := public.log_question_presented(
    jsonb_build_object(
      'match_id', v_duel_id::text,
      'question_id', v_qid,
      'q_index', 0,
      'displayed_choices_order', v_choices,
      'dataset_version', v_dataset_version,
      'content_hash', v_content_hash,
      'pack_question_count', 1,
      'question_started_at', now()::text,
      'client_event_id', v_presented_event::text
    )
  );

  IF COALESCE(v_presented->>'status','') NOT IN ('created','duplicate_event','re_presented') THEN
    RAISE EXCEPTION 'VALIDATION_FAIL[3]: log_question_presented status=% payload=%',
      COALESCE(v_presented->>'status','(null)'), v_presented;
  END IF;

  SELECT COUNT(*) INTO v_match_attempt_count
  FROM public.match_attempts ma
  WHERE ma.match_id = v_duel_id
    AND ma.user_id = v_uid;

  IF v_match_attempt_count < 1 THEN
    RAISE EXCEPTION 'VALIDATION_FAIL[2]: match_attempt missing after telemetry bootstrap duel_id=% user_id=%',
      v_duel_id, v_uid;
  END IF;

  -- FK parent bridge proof when telemetry FK is to public.duels
  IF EXISTS (
    SELECT 1
    FROM pg_constraint c
    WHERE c.conname = 'match_attempts_match_id_fkey'
      AND c.conrelid = 'public.match_attempts'::regclass
      AND lower(regexp_replace(replace(c.confrelid::regclass::text, '"', ''), '^.*\.', '')) = 'duels'
  ) THEN
    SELECT COUNT(*) INTO v_duels_parent_count
    FROM public.duels d
    WHERE d.id = v_duel_id;

    IF v_duels_parent_count < 1 THEN
      RAISE EXCEPTION 'VALIDATION_FAIL[2]: duels parent bridge row missing for duel_id=%', v_duel_id;
    END IF;
  END IF;

  v_answered := public.log_question_answered(
    jsonb_build_object(
      'match_id', v_duel_id::text,
      'q_index', 0,
      'selected_index', 0,
      'question_answered_at', now()::text,
      'time_to_first_answer_ms', 1000,
      'timed_out', false,
      'question_id', v_qid,
      'dataset_version', v_dataset_version,
      'content_hash', v_content_hash,
      'displayed_choices_order', v_choices,
      'client_event_id', v_answered_event::text
    )
  );

  IF COALESCE(v_answered->>'status','') NOT IN ('answered','out_of_order_merged','duplicate_event','already_terminal') THEN
    RAISE EXCEPTION 'VALIDATION_FAIL[4]: log_question_answered status=% payload=%',
      COALESCE(v_answered->>'status','(null)'), v_answered;
  END IF;

  SELECT COUNT(*) INTO v_question_attempt_count
  FROM public.question_attempts qa
  WHERE qa.match_id = v_duel_id
    AND qa.user_id = v_uid;

  IF v_question_attempt_count < 1 THEN
    RAISE EXCEPTION 'VALIDATION_FAIL[4]: question_attempt row missing for duel_id=% user_id=%',
      v_duel_id, v_uid;
  END IF;

  -- ---------------------------------------------------------------------------
  -- 5) complete_match coherence
  -- ---------------------------------------------------------------------------
  v_complete := public.complete_match(v_duel_id, v_uid);
  IF v_complete IS NULL OR jsonb_typeof(v_complete) <> 'object' THEN
    RAISE EXCEPTION 'VALIDATION_FAIL[5]: complete_match returned invalid payload=%', v_complete;
  END IF;

  -- ---------------------------------------------------------------------------
  -- 6) idempotency checks (duplicate events should not create corruption)
  -- ---------------------------------------------------------------------------
  v_presented_dup := public.log_question_presented(
    jsonb_build_object(
      'match_id', v_duel_id::text,
      'question_id', v_qid,
      'q_index', 0,
      'displayed_choices_order', v_choices,
      'dataset_version', v_dataset_version,
      'content_hash', v_content_hash,
      'pack_question_count', 1,
      'question_started_at', now()::text,
      'client_event_id', v_presented_event::text
    )
  );

  IF COALESCE(v_presented_dup->>'status','') NOT IN ('duplicate_event','re_presented') THEN
    RAISE EXCEPTION 'VALIDATION_FAIL[7]: duplicate presented status=% payload=%',
      COALESCE(v_presented_dup->>'status','(null)'), v_presented_dup;
  END IF;

  v_answered_dup := public.log_question_answered(
    jsonb_build_object(
      'match_id', v_duel_id::text,
      'q_index', 0,
      'selected_index', 0,
      'question_answered_at', now()::text,
      'time_to_first_answer_ms', 1000,
      'timed_out', false,
      'question_id', v_qid,
      'dataset_version', v_dataset_version,
      'content_hash', v_content_hash,
      'displayed_choices_order', v_choices,
      'client_event_id', v_answered_event::text
    )
  );

  IF COALESCE(v_answered_dup->>'status','') NOT IN ('duplicate_event','already_terminal','answered') THEN
    RAISE EXCEPTION 'VALIDATION_FAIL[7]: duplicate answered status=% payload=%',
      COALESCE(v_answered_dup->>'status','(null)'), v_answered_dup;
  END IF;

  RAISE NOTICE 'VALIDATION_PASS: duel_id=% user_id=% create=% submit=% presented=% answered=% complete=%',
    v_duel_id, v_uid,
    COALESCE(v_create->>'status','(null)'),
    COALESCE(v_submit->>'status','(null)'),
    COALESCE(v_presented->>'status','(null)'),
    COALESCE(v_answered->>'status','(null)'),
    COALESCE(v_complete->>'status','(null)');
END;
$$;

-- Safety requirement: no persistent test data.
ROLLBACK;
