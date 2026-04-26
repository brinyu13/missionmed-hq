-- =============================================================================
-- 20260426150000_e3_stat_write_order_schema_compat.sql
-- E3 STAT write-order helper schema compatibility patch
-- Prompt ID: MR-E3-RPC-SCHEMA-COMPAT-014
-- =============================================================================
-- Purpose:
--   Patch private_e3_ensure_match_attempt(...) so it does not statically
--   reference optional duel_challenges columns that may not exist in live DB.
--
-- Scope:
--   - Patch function: public.private_e3_ensure_match_attempt(uuid, uuid, text, text, integer, uuid)
--
-- Non-goals:
--   - No frontend changes
--   - No auth/MMOS changes
--   - No HOLD migration usage
-- =============================================================================

BEGIN;

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

  -- Resolve current FK parent shape for match_attempts.match_id.
  -- Supported normalized values: duels, duel_challenges.
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

  -- Prefer canonical provenance from duel_challenges when present and compatible.
  -- Use to_jsonb(row) so optional columns can be read by key without static refs.
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
  'Internal helper patched for schema compatibility in MR-E3-RPC-SCHEMA-COMPAT-014. Avoids static references to optional duel_challenges columns.';

REVOKE ALL ON FUNCTION public.private_e3_ensure_match_attempt(uuid, uuid, text, text, integer, uuid) FROM PUBLIC;

COMMIT;
