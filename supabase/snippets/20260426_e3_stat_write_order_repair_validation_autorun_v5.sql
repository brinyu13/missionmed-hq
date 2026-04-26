-- =============================================================================
-- 20260426_e3_stat_write_order_repair_validation_autorun_v5.sql
-- E3 write-order validation harness (v5)
-- Prompt ID: MR-E3-IDEMPOTENCY-CHECK-015
-- Target project: fglyvdykwgbuivikqoah
-- =============================================================================
-- Purpose:
--   Validate backend write ordering after 20260426123000 repair migration.
--   This harness avoids hard dependency on existing public.duels rows.
--
-- Safety:
--   - Single transaction
--   - Test fixture only
--   - Full ROLLBACK at end (no persistent writes)
-- =============================================================================

BEGIN;

DO $$
DECLARE
  v_test_user uuid;
  v_match_parent_raw text;
  v_question_parent_raw text;
  v_match_parent text;
  v_question_parent text;
  v_match_id uuid := gen_random_uuid();
  v_q_index integer := 0;

  v_dataset_version text := 'e3_validation_dataset';
  v_content_hash text;
  v_pack_question_count integer := 1;

  v_session jsonb;
  v_presented jsonb;
  v_answered jsonb;
  v_completed jsonb;
  v_state jsonb;

  v_presented_dup_same_event jsonb;
  v_presented_dup_new_event jsonb;
  v_answered_dup_same_event jsonb;
  v_answered_dup_new_event jsonb;
  v_completed_dup jsonb;

  v_presented_event_id uuid := gen_random_uuid();
  v_answered_event_id uuid := gen_random_uuid();

  v_match_exists boolean;
  v_order_ok boolean;
  v_match_created_at timestamptz;
  v_question_created_at timestamptz;
  v_presented_before record;
  v_presented_after record;
  v_presented_row_count_before integer;
  v_presented_row_count_after integer;
  v_presented_row_count_after_new integer;
  v_presented_dup_returned_id uuid;

  v_duel_challenge record;
BEGIN
  -- ---------------------------------------------------------------------------
  -- 0) Resolve candidate auth user (do NOT assume public.duels has data)
  -- ---------------------------------------------------------------------------
  IF to_regclass('auth.users') IS NOT NULL THEN
    BEGIN
      SELECT u.id
        INTO v_test_user
        FROM auth.users u
       ORDER BY u.created_at DESC
       LIMIT 1;
    EXCEPTION WHEN OTHERS THEN
      v_test_user := NULL;
    END;
  END IF;

  IF v_test_user IS NULL AND to_regclass('public.match_attempts') IS NOT NULL THEN
    SELECT ma.user_id INTO v_test_user
      FROM public.match_attempts ma
     WHERE ma.user_id IS NOT NULL
     ORDER BY ma.created_at DESC
     LIMIT 1;
  END IF;

  IF v_test_user IS NULL AND to_regclass('public.study_sessions') IS NOT NULL THEN
    SELECT ss.user_id INTO v_test_user
      FROM public.study_sessions ss
     WHERE ss.user_id IS NOT NULL
     ORDER BY ss.started_at DESC
     LIMIT 1;
  END IF;

  IF v_test_user IS NULL AND to_regclass('public.question_attempts') IS NOT NULL THEN
    SELECT qa.user_id INTO v_test_user
      FROM public.question_attempts qa
     WHERE qa.user_id IS NOT NULL
     ORDER BY qa.created_at DESC
     LIMIT 1;
  END IF;

  IF v_test_user IS NULL AND to_regclass('public.duel_attempts') IS NOT NULL THEN
    SELECT da.player_id INTO v_test_user
      FROM public.duel_attempts da
     WHERE da.player_id IS NOT NULL
     ORDER BY da.submitted_at DESC NULLS LAST
     LIMIT 1;
  END IF;

  IF v_test_user IS NULL AND to_regclass('public.player_profiles') IS NOT NULL THEN
    SELECT pp.user_id INTO v_test_user
      FROM public.player_profiles pp
     WHERE pp.user_id IS NOT NULL
     ORDER BY pp.created_at DESC
     LIMIT 1;
  END IF;

  IF v_test_user IS NULL THEN
    RAISE EXCEPTION 'VALIDATION_ABORT: no candidate auth user found (auth.users + telemetry tables empty/unavailable)';
  END IF;

  -- ---------------------------------------------------------------------------
  -- 1) Discover canonical parent of telemetry match FK(s)
  -- ---------------------------------------------------------------------------
  SELECT c.confrelid::regclass::text
    INTO v_match_parent_raw
    FROM pg_constraint c
   WHERE c.conname = 'match_attempts_match_id_fkey'
     AND c.conrelid = 'public.match_attempts'::regclass
   ORDER BY c.oid DESC
   LIMIT 1;

  IF v_match_parent_raw IS NULL THEN
    RAISE EXCEPTION 'VALIDATION_ABORT: could not resolve match_attempts_match_id_fkey parent table';
  END IF;

  v_match_parent := lower(
    regexp_replace(
      replace(v_match_parent_raw, '"', ''),
      '^.*\.',
      ''
    )
  );

  SELECT c.confrelid::regclass::text
    INTO v_question_parent_raw
    FROM pg_constraint c
   WHERE c.conname = 'question_attempts_match_id_fkey'
     AND c.conrelid = 'public.question_attempts'::regclass
   ORDER BY c.oid DESC
   LIMIT 1;

  IF v_question_parent_raw IS NULL THEN
    RAISE EXCEPTION 'VALIDATION_ABORT: could not resolve question_attempts_match_id_fkey parent table';
  END IF;

  v_question_parent := lower(
    regexp_replace(
      replace(v_question_parent_raw, '"', ''),
      '^.*\.',
      ''
    )
  );

  IF v_question_parent <> v_match_parent THEN
    RAISE EXCEPTION
      'VALIDATION_ABORT: FK parent mismatch (match_attempts %, question_attempts %)',
      v_match_parent_raw, v_question_parent_raw;
  END IF;

  -- ---------------------------------------------------------------------------
  -- 2) Build isolated/safe match fixture based on canonical FK parent
  -- ---------------------------------------------------------------------------
  IF v_match_parent = 'duels' THEN
    INSERT INTO public.duels (id, creator_id, opponent_id, status)
    VALUES (v_match_id, v_test_user, NULL, 'pending');

  ELSIF v_match_parent = 'duel_challenges' THEN
    -- Fallback path for environments where telemetry points at duel_challenges.
    -- First try selected user; if no row is safe, choose a safe participant row.
    -- Use to_jsonb(row) so optional columns can be read by key safely.
    SELECT
      d.id,
      to_jsonb(d) AS duel_json,
      v_test_user AS participant_user
    INTO v_duel_challenge
    FROM public.duel_challenges d
    WHERE (d.challenger_id = v_test_user OR d.opponent_id = v_test_user)
      AND NOT EXISTS (
        SELECT 1
        FROM public.match_attempts ma
        WHERE ma.match_id = d.id
          AND ma.user_id = v_test_user
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.question_attempts qa
        WHERE qa.match_id = d.id
          AND qa.user_id = v_test_user
      )
    ORDER BY d.created_at DESC NULLS LAST
    LIMIT 1;

    IF NOT FOUND THEN
      SELECT
        d.id,
        to_jsonb(d) AS duel_json,
        p.user_id AS participant_user
      INTO v_duel_challenge
      FROM public.duel_challenges d
      CROSS JOIN LATERAL (
        SELECT cand.user_id
        FROM (VALUES (d.challenger_id), (d.opponent_id)) AS cand(user_id)
        WHERE cand.user_id IS NOT NULL
          AND NOT EXISTS (
            SELECT 1
            FROM public.match_attempts ma
            WHERE ma.match_id = d.id
              AND ma.user_id = cand.user_id
          )
          AND NOT EXISTS (
            SELECT 1
            FROM public.question_attempts qa
            WHERE qa.match_id = d.id
              AND qa.user_id = cand.user_id
          )
        LIMIT 1
      ) p
      ORDER BY d.created_at DESC NULLS LAST
      LIMIT 1;
    END IF;

    IF NOT FOUND THEN
      RAISE EXCEPTION
        'VALIDATION_ABORT: parent is duel_challenges but no safe participant row found';
    END IF;

    v_test_user := v_duel_challenge.participant_user;
    v_match_id := v_duel_challenge.id;
    v_dataset_version := COALESCE(
      NULLIF(BTRIM(COALESCE(v_duel_challenge.duel_json->>'dataset_version', '')), ''),
      v_dataset_version
    );
    v_content_hash := COALESCE(
      NULLIF(BTRIM(COALESCE(v_duel_challenge.duel_json->>'content_hash', '')), ''),
      md5(v_match_id::text || ':canon')
    );
    v_pack_question_count := GREATEST(
      COALESCE(
        CASE
          WHEN COALESCE(v_duel_challenge.duel_json->>'pack_question_count', '') ~ '^[0-9]+$'
            THEN (v_duel_challenge.duel_json->>'pack_question_count')::integer
          WHEN jsonb_typeof(v_duel_challenge.duel_json->'question_ids') = 'array'
            THEN jsonb_array_length(v_duel_challenge.duel_json->'question_ids')
          ELSE NULL
        END,
        v_pack_question_count,
        1
      ),
      1
    );

  ELSE
    RAISE EXCEPTION 'VALIDATION_ABORT: unsupported match_attempts parent % (normalized: %)', v_match_parent_raw, v_match_parent;
  END IF;

  v_content_hash := COALESCE(v_content_hash, md5(v_match_id::text || ':canon'));

  -- ---------------------------------------------------------------------------
  -- 3) Impersonate authenticated context for auth.uid()-gated RPCs
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', v_test_user::text, true);

  -- ---------------------------------------------------------------------------
  -- 4) start_study_session
  -- ---------------------------------------------------------------------------
  v_session := public.start_study_session();
  IF COALESCE(v_session->>'status', '') NOT IN ('created','existing') THEN
    RAISE EXCEPTION 'VALIDATION_FAIL[1]: start_study_session bad status: %', v_session;
  END IF;

  -- ---------------------------------------------------------------------------
  -- 5) log_question_presented (first write)
  -- ---------------------------------------------------------------------------
  v_presented := public.log_question_presented(
    jsonb_build_object(
      'match_id', v_match_id::text,
      'question_id', 'e3_validation_q1',
      'q_index', v_q_index,
      'displayed_choices_order', jsonb_build_array('A','B','C','D'),
      'dataset_version', v_dataset_version,
      'content_hash', v_content_hash,
      'pack_question_count', v_pack_question_count,
      'question_started_at', now(),
      'client_event_id', v_presented_event_id::text
    )
  );

  IF COALESCE(v_presented->>'status', '') NOT IN ('created','re_presented','duplicate_event') THEN
    RAISE EXCEPTION 'VALIDATION_FAIL[3]: log_question_presented bad status: %', v_presented;
  END IF;

  -- ---------------------------------------------------------------------------
  -- 6) match_attempt exists before/equal question_attempt timestamp
  -- ---------------------------------------------------------------------------
  SELECT EXISTS (
           SELECT 1
             FROM public.match_attempts ma
            WHERE ma.match_id = v_match_id
              AND ma.user_id = v_test_user
         )
    INTO v_match_exists;

  IF NOT v_match_exists THEN
    RAISE EXCEPTION 'VALIDATION_FAIL[2]: match_attempt missing after first question write';
  END IF;

  SELECT ma.created_at, qa.created_at
    INTO v_match_created_at, v_question_created_at
    FROM public.match_attempts ma
    JOIN public.question_attempts qa
      ON qa.match_id = ma.match_id
     AND qa.user_id = ma.user_id
     AND qa.q_index = v_q_index
   WHERE ma.match_id = v_match_id
     AND ma.user_id = v_test_user
   ORDER BY qa.created_at DESC
   LIMIT 1;

  v_order_ok := (
    v_match_created_at IS NOT NULL
    AND v_question_created_at IS NOT NULL
    AND v_match_created_at <= v_question_created_at
  );

  IF NOT v_order_ok THEN
    RAISE EXCEPTION 'VALIDATION_FAIL[2]: write order mismatch (match_created_at %, question_created_at %)',
      v_match_created_at, v_question_created_at;
  END IF;

  -- ---------------------------------------------------------------------------
  -- 7) log_question_answered
  -- ---------------------------------------------------------------------------
  v_answered := public.log_question_answered(
    jsonb_build_object(
      'match_id', v_match_id::text,
      'q_index', v_q_index,
      'selected_index', 0,
      'question_answered_at', now(),
      'question_id', 'e3_validation_q1',
      'dataset_version', v_dataset_version,
      'content_hash', v_content_hash,
      'displayed_choices_order', jsonb_build_array('A','B','C','D'),
      'client_event_id', v_answered_event_id::text
    )
  );

  IF COALESCE(v_answered->>'status', '') NOT IN ('answered','already_terminal','duplicate_event','out_of_order_merged') THEN
    RAISE EXCEPTION 'VALIDATION_FAIL[4]: log_question_answered bad status: %', v_answered;
  END IF;

  -- ---------------------------------------------------------------------------
  -- 8) complete_match + get_match_state coherence
  -- ---------------------------------------------------------------------------
  v_completed := public.complete_match(v_match_id, v_test_user);
  IF COALESCE(v_completed->>'status', '') NOT IN ('completed','already_completed') THEN
    RAISE EXCEPTION 'VALIDATION_FAIL[5]: complete_match bad status: %', v_completed;
  END IF;

  v_state := public.get_match_state(v_match_id);
  IF (v_state ? 'match_attempt') IS FALSE
     OR COALESCE((v_state->>'question_count')::integer, 0) < 1 THEN
    RAISE EXCEPTION 'VALIDATION_FAIL[6]: get_match_state incoherent payload: %', v_state;
  END IF;

  -- ---------------------------------------------------------------------------
  -- 9) idempotency checks
  -- ---------------------------------------------------------------------------
  -- Snapshot the answered row before duplicate presented checks.
  SELECT id, result_state, selected_index, correct, server_sequence_index, question_answered_at
    INTO v_presented_before
    FROM public.question_attempts
   WHERE match_id = v_match_id
     AND user_id = v_test_user
     AND q_index = v_q_index
   ORDER BY created_at DESC
   LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'VALIDATION_FAIL[7]: could not snapshot baseline question_attempt row';
  END IF;

  SELECT COUNT(*)
    INTO v_presented_row_count_before
    FROM public.question_attempts
   WHERE match_id = v_match_id
     AND user_id = v_test_user
     AND q_index = v_q_index;

  v_presented_dup_same_event := public.log_question_presented(
    jsonb_build_object(
      'match_id', v_match_id::text,
      'question_id', 'e3_validation_q1',
      'q_index', v_q_index,
      'displayed_choices_order', jsonb_build_array('A','B','C','D'),
      'dataset_version', v_dataset_version,
      'content_hash', v_content_hash,
      'client_event_id', v_presented_event_id::text
    )
  );

  IF COALESCE(v_presented_dup_same_event->>'status', '') NOT IN ('duplicate_event', 're_presented') THEN
    RAISE EXCEPTION 'VALIDATION_FAIL[7]: presented duplicate same-event status invalid: %', v_presented_dup_same_event;
  END IF;

  BEGIN
    v_presented_dup_returned_id := NULLIF(v_presented_dup_same_event#>>'{question_attempt,id}', '')::uuid;
  EXCEPTION WHEN OTHERS THEN
    v_presented_dup_returned_id := NULL;
  END;

  IF v_presented_dup_returned_id IS DISTINCT FROM v_presented_before.id THEN
    RAISE EXCEPTION
      'VALIDATION_FAIL[7]: presented duplicate did not return same question_attempt id (expected %, got %)',
      v_presented_before.id, v_presented_dup_returned_id;
  END IF;

  SELECT COUNT(*)
    INTO v_presented_row_count_after
    FROM public.question_attempts
   WHERE match_id = v_match_id
     AND user_id = v_test_user
     AND q_index = v_q_index;

  IF v_presented_row_count_after <> v_presented_row_count_before THEN
    RAISE EXCEPTION
      'VALIDATION_FAIL[7]: presented duplicate created/removed rows (before %, after %)',
      v_presented_row_count_before, v_presented_row_count_after;
  END IF;

  SELECT id, result_state, selected_index, correct, server_sequence_index, question_answered_at
    INTO v_presented_after
    FROM public.question_attempts
   WHERE id = v_presented_before.id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'VALIDATION_FAIL[7]: baseline question_attempt row disappeared after duplicate presented';
  END IF;

  IF v_presented_after.result_state IS DISTINCT FROM v_presented_before.result_state
     OR v_presented_after.selected_index IS DISTINCT FROM v_presented_before.selected_index
     OR v_presented_after.correct IS DISTINCT FROM v_presented_before.correct
     OR v_presented_after.server_sequence_index IS DISTINCT FROM v_presented_before.server_sequence_index
     OR v_presented_after.question_answered_at IS DISTINCT FROM v_presented_before.question_answered_at THEN
    RAISE EXCEPTION
      'VALIDATION_FAIL[7]: presented duplicate mutated answered row (before %, after %)',
      row_to_json(v_presented_before), row_to_json(v_presented_after);
  END IF;

  v_presented_dup_new_event := public.log_question_presented(
    jsonb_build_object(
      'match_id', v_match_id::text,
      'question_id', 'e3_validation_q1',
      'q_index', v_q_index,
      'displayed_choices_order', jsonb_build_array('A','B','C','D'),
      'dataset_version', v_dataset_version,
      'content_hash', v_content_hash,
      'client_event_id', gen_random_uuid()::text
    )
  );

  IF COALESCE(v_presented_dup_new_event->>'status', '') NOT IN ('re_presented','duplicate_event') THEN
    RAISE EXCEPTION 'VALIDATION_FAIL[7]: presented re_presented check failed: %', v_presented_dup_new_event;
  END IF;

  SELECT COUNT(*)
    INTO v_presented_row_count_after_new
    FROM public.question_attempts
   WHERE match_id = v_match_id
     AND user_id = v_test_user
     AND q_index = v_q_index;

  IF v_presented_row_count_after_new <> v_presented_row_count_before THEN
    RAISE EXCEPTION
      'VALIDATION_FAIL[7]: presented new-event duplicate created/removed rows (before %, after %)',
      v_presented_row_count_before, v_presented_row_count_after_new;
  END IF;

  v_answered_dup_same_event := public.log_question_answered(
    jsonb_build_object(
      'match_id', v_match_id::text,
      'q_index', v_q_index,
      'selected_index', 0,
      'question_answered_at', now(),
      'question_id', 'e3_validation_q1',
      'dataset_version', v_dataset_version,
      'content_hash', v_content_hash,
      'displayed_choices_order', jsonb_build_array('A','B','C','D'),
      'client_event_id', v_answered_event_id::text
    )
  );

  IF COALESCE(v_answered_dup_same_event->>'status', '') <> 'duplicate_event' THEN
    RAISE EXCEPTION 'VALIDATION_FAIL[7]: answered duplicate_event check failed: %', v_answered_dup_same_event;
  END IF;

  v_answered_dup_new_event := public.log_question_answered(
    jsonb_build_object(
      'match_id', v_match_id::text,
      'q_index', v_q_index,
      'selected_index', 0,
      'question_answered_at', now(),
      'question_id', 'e3_validation_q1',
      'dataset_version', v_dataset_version,
      'content_hash', v_content_hash,
      'displayed_choices_order', jsonb_build_array('A','B','C','D'),
      'client_event_id', gen_random_uuid()::text
    )
  );

  IF COALESCE(v_answered_dup_new_event->>'status', '') NOT IN ('already_terminal','duplicate_event','answered') THEN
    RAISE EXCEPTION 'VALIDATION_FAIL[7]: answered terminal/idempotent guard failed: %', v_answered_dup_new_event;
  END IF;

  v_completed_dup := public.complete_match(v_match_id, v_test_user);
  IF COALESCE(v_completed_dup->>'status', '') <> 'already_completed' THEN
    RAISE EXCEPTION 'VALIDATION_FAIL[7]: complete_match idempotency failed: %', v_completed_dup;
  END IF;

  RAISE NOTICE 'VALIDATION_PASS: E3 write-order checks passed. parent_raw=%, parent_norm=%, match_id=%, user_id=%',
    v_match_parent_raw, v_match_parent, v_match_id, v_test_user;
END;
$$;

-- Explicit success marker row (visible before rollback)
SELECT 'VALIDATION_PASS_IF_NO_EXCEPTION' AS validation_marker;

-- 8) rollback/isolation check (all writes discarded)
ROLLBACK;
