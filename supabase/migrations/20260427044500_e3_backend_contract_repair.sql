-- =============================================================================
-- 20260427044500_e3_backend_contract_repair.sql
-- Prompt ID: MR-E3-BACKEND-CONTRACT-REPAIR-025
-- Purpose:
--   1) Bridge E3 telemetry match IDs to legacy public.duels FK parent when needed.
--   2) Align submit_attempt state gate with bot duel runtime (`active` state).
-- Scope: Backend database contract only (no frontend/MMOS/auth architecture changes).
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- Patch: private_e3_ensure_match_attempt
-- Adds a safe bridge path when match_attempts/question_attempts FK parent is
-- public.duels but runtime match IDs originate from public.duel_challenges.
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
  v_latest_qa record;
  v_duel_json jsonb;
  v_dataset_version text;
  v_content_hash text;
  v_pack_question_count integer;
  v_session_id uuid;
  v_match_parent_raw text;
  v_match_parent_norm text;
  v_bridge_creator_id uuid;
  v_bridge_opponent_id uuid;
  v_bridge_status text;
BEGIN
  IF p_match_id IS NULL OR p_user_id IS NULL THEN
    RAISE EXCEPTION 'STAT_INVALID_PARAMS: match_id and user_id are required'
      USING ERRCODE = 'P0001';
  END IF;

  v_dataset_version := NULLIF(BTRIM(COALESCE(p_dataset_version, '')), '');
  v_content_hash := NULLIF(BTRIM(COALESCE(p_content_hash, '')), '');
  v_pack_question_count := NULLIF(p_pack_question_count, 0);
  v_session_id := p_session_id;

  -- Canonical step 1: ensure an active study session.
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

  -- Resolve telemetry FK parent shape for match_attempts.match_id.
  SELECT c.confrelid::regclass::text
    INTO v_match_parent_raw
    FROM pg_constraint c
   WHERE c.conname = 'match_attempts_match_id_fkey'
     AND c.conrelid = 'public.match_attempts'::regclass
   ORDER BY c.oid DESC
   LIMIT 1;

  v_match_parent_norm := lower(
    regexp_replace(
      replace(COALESCE(v_match_parent_raw, ''), '"', ''),
      '^.*\.',
      ''
    )
  );

  -- Prefer canonical provenance from duel_challenges when present.
  IF to_regclass('public.duel_challenges') IS NOT NULL
     AND v_match_parent_norm IN ('duel_challenges', 'duels', '') THEN
    SELECT to_jsonb(d)
      INTO v_duel_json
      FROM public.duel_challenges d
     WHERE d.id = p_match_id
     LIMIT 1;

    IF FOUND THEN
      v_dataset_version := COALESCE(
        v_dataset_version,
        NULLIF(BTRIM(COALESCE(v_duel_json->>'dataset_version', '')), '')
      );

      v_content_hash := COALESCE(
        v_content_hash,
        NULLIF(BTRIM(COALESCE(v_duel_json->>'content_hash', '')), '')
      );

      IF v_pack_question_count IS NULL OR v_pack_question_count < 1 THEN
        IF COALESCE(v_duel_json->>'pack_question_count', '') ~ '^[0-9]+$' THEN
          v_pack_question_count := GREATEST((v_duel_json->>'pack_question_count')::integer, 1);
        ELSIF jsonb_typeof(v_duel_json->'question_ids') = 'array' THEN
          v_pack_question_count := GREATEST(jsonb_array_length(v_duel_json->'question_ids'), 1);
        END IF;
      END IF;
    END IF;
  END IF;

  -- Bridge parent when telemetry FK points to public.duels.
  IF v_match_parent_norm = 'duels' THEN
    PERFORM 1 FROM public.duels WHERE id = p_match_id;

    IF NOT FOUND THEN
      IF v_duel_json IS NULL AND to_regclass('public.duel_challenges') IS NOT NULL THEN
        SELECT to_jsonb(d)
          INTO v_duel_json
          FROM public.duel_challenges d
         WHERE d.id = p_match_id
         LIMIT 1;
      END IF;

      v_bridge_creator_id := p_user_id;
      v_bridge_opponent_id := NULL;
      v_bridge_status := 'active';

      IF v_duel_json IS NOT NULL THEN
        BEGIN
          v_bridge_creator_id := COALESCE(NULLIF(v_duel_json->>'challenger_id', '')::uuid, p_user_id);
        EXCEPTION WHEN OTHERS THEN
          v_bridge_creator_id := p_user_id;
        END;

        BEGIN
          v_bridge_opponent_id := NULLIF(v_duel_json->>'opponent_id', '')::uuid;
        EXCEPTION WHEN OTHERS THEN
          v_bridge_opponent_id := NULL;
        END;

        CASE lower(COALESCE(v_duel_json->>'state', ''))
          WHEN 'pending' THEN v_bridge_status := 'pending';
          WHEN 'created' THEN v_bridge_status := 'pending';
          WHEN 'expired' THEN v_bridge_status := 'expired';
          WHEN 'void' THEN v_bridge_status := 'expired';
          WHEN 'completed' THEN v_bridge_status := 'completed';
          WHEN 'finalized' THEN v_bridge_status := 'completed';
          WHEN 'settled' THEN v_bridge_status := 'completed';
          ELSE v_bridge_status := 'active';
        END CASE;
      END IF;

      BEGIN
        EXECUTE
          'INSERT INTO public.duels (id, creator_id, opponent_id, status) '
          || 'VALUES ($1, $2, $3, $4::public.duel_status) '
          || 'ON CONFLICT (id) DO NOTHING'
        USING p_match_id, v_bridge_creator_id, v_bridge_opponent_id, v_bridge_status;
      EXCEPTION WHEN undefined_column THEN
        EXECUTE
          'INSERT INTO public.duels (id, created_by, opponent_id, status) '
          || 'VALUES ($1, $2, $3, $4::public.duel_status) '
          || 'ON CONFLICT (id) DO NOTHING'
        USING p_match_id, v_bridge_creator_id, v_bridge_opponent_id, v_bridge_status;
      END;
    END IF;

    PERFORM 1 FROM public.duels WHERE id = p_match_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'STAT_MATCH_PARENT_MISSING: duels parent row missing for match %', p_match_id
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  -- Fallback provenance from latest question_attempt if still missing.
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
  'E3 contract repair: bridges duel_challenges runtime IDs into legacy duels parent when telemetry FK uses public.duels.';

REVOKE ALL ON FUNCTION public.private_e3_ensure_match_attempt(uuid, uuid, text, text, integer, uuid) FROM PUBLIC;

-- -----------------------------------------------------------------------------
-- Patch: submit_attempt(duel_id, answers, total_time_ms, idempotency_key)
-- Align readiness gate with live bot-duel state progression (`active`).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_attempt(p_duel_id uuid, p_answers jsonb, p_total_time_ms integer, p_idempotency_key text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_actor uuid := auth.uid();
  v_duel public.duel_challenges%rowtype;
  v_existing_attempt public.duel_attempts%rowtype;
  v_other_attempt public.duel_attempts%rowtype;
  v_score jsonb;
  v_attempt public.duel_attempts%rowtype;
  v_answer jsonb;
  v_idx integer := 0;
  v_finalize_result jsonb;
begin
  if v_actor is null then
    raise exception 'auth_required';
  end if;

  if p_idempotency_key is null or btrim(p_idempotency_key) = '' then
    raise exception 'idempotency_key_required';
  end if;

  perform public.ensure_player_profile(v_actor);

  select * into v_duel
  from public.duel_challenges
  where id = p_duel_id
  for update;

  if not found then
    return jsonb_build_object('status', 'error', 'code', 'duel_not_found');
  end if;

  if v_duel.is_bot_match then
    if v_actor is distinct from v_duel.challenger_id then
      return jsonb_build_object('status', 'error', 'code', 'not_duel_participant');
    end if;
  else
    if v_actor is distinct from v_duel.challenger_id and v_actor is distinct from v_duel.opponent_id then
      return jsonb_build_object('status', 'error', 'code', 'not_duel_participant');
    end if;
  end if;

  -- Request-level idempotency.
  select * into v_existing_attempt
  from public.duel_attempts
  where duel_id = p_duel_id
    and player_id = v_actor
    and submit_idempotency_key = p_idempotency_key;

  if found then
    return jsonb_build_object('status', 'ok', 'idempotent', true, 'attempt', to_jsonb(v_existing_attempt));
  end if;

  -- Participant has already submitted; return existing row (retry-safe).
  select * into v_existing_attempt
  from public.duel_attempts
  where duel_id = p_duel_id
    and player_id = v_actor;

  if found then
    return jsonb_build_object('status', 'ok', 'idempotent', true, 'attempt', to_jsonb(v_existing_attempt));
  end if;

  if v_duel.state in ('completed', 'expired', 'settled') then
    return jsonb_build_object('status', 'error', 'code', 'duel_terminal_state', 'state', v_duel.state);
  end if;

  if now() > coalesce(v_duel.match_expires_at, now() - interval '1 second')
    and v_duel.state in ('active', 'accepted', 'player1_complete', 'player2_complete')
  then
    return public.private_finalize_duel_core(p_duel_id, format('%s:match-expired', p_idempotency_key));
  end if;

  if v_duel.state not in ('active', 'accepted', 'player1_complete', 'player2_complete') then
    return jsonb_build_object('status', 'error', 'code', 'duel_not_ready_for_attempt', 'state', v_duel.state);
  end if;

  v_score := public.private_score_answers(v_duel.question_set, p_answers, p_total_time_ms);

  insert into public.duel_attempts (
    duel_id,
    player_id,
    is_bot_attempt,
    attempt_status,
    answers,
    total_questions,
    correct_count,
    total_time_ms,
    started_at,
    submitted_at,
    submit_idempotency_key
  )
  values (
    p_duel_id,
    v_actor,
    false,
    'submitted',
    v_score->'answers',
    (v_score->>'total_questions')::integer,
    (v_score->>'correct_count')::integer,
    (v_score->>'total_time_ms')::integer,
    now(),
    now(),
    p_idempotency_key
  )
  returning * into v_attempt;

  -- Per-question event writes (monotonic event_seq, idempotency-safe).
  for v_answer in
    select value from jsonb_array_elements(v_score->'answers') as a(value)
  loop
    v_idx := v_idx + 1;
    perform public.private_append_duel_event(
      p_duel_id,
      'question_answered',
      format('%s:q:%s', p_idempotency_key, v_idx),
      v_actor,
      null,
      v_idx,
      (v_answer->>'is_correct')::boolean,
      (v_answer->>'time_ms')::integer,
      jsonb_build_object('question_id', v_answer->>'question_id')
    );
  end loop;

  perform public.private_append_duel_event(
    p_duel_id,
    'attempt_submitted',
    format('%s:submitted', p_idempotency_key),
    v_actor,
    null,
    null,
    null,
    null,
    jsonb_build_object(
      'correct_count', v_attempt.correct_count,
      'total_questions', v_attempt.total_questions,
      'total_time_ms', v_attempt.total_time_ms
    )
  );

  if v_duel.is_bot_match then
    select * into v_other_attempt
    from public.duel_attempts
    where duel_id = p_duel_id
      and bot_profile_id = v_duel.bot_profile_id;
  else
    select * into v_other_attempt
    from public.duel_attempts
    where duel_id = p_duel_id
      and player_id = case
        when v_actor = v_duel.challenger_id then v_duel.opponent_id
        else v_duel.challenger_id
      end;
  end if;

  if v_other_attempt.id is not null then
    update public.duel_challenges
    set state = 'completed', updated_at = now()
    where id = p_duel_id;

    v_finalize_result := public.private_finalize_duel_core(
      p_duel_id,
      format('%s:auto-finalize', p_idempotency_key)
    );

    return jsonb_build_object(
      'status', 'ok',
      'attempt', to_jsonb(v_attempt),
      'finalized', true,
      'finalize', v_finalize_result
    );
  end if;

  update public.duel_challenges
  set
    state = case
      when v_actor = v_duel.challenger_id then 'player1_complete'
      else 'player2_complete'
    end,
    updated_at = now()
  where id = p_duel_id;

  return jsonb_build_object('status', 'ok', 'attempt', to_jsonb(v_attempt), 'finalized', false);
end;
$function$;

COMMENT ON FUNCTION public.submit_attempt(uuid, jsonb, integer, text) IS
  'E3 contract repair: accepts active-state duel submissions to match bot create_duel progression while preserving idempotency and finalize flow.';

COMMIT;
