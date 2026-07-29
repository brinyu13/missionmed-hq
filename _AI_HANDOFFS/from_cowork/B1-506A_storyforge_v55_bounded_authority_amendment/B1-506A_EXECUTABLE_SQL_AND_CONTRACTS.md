# B1-506A · Executable SQL and Contracts

Literal implementation text for the six rulings. Where prose elsewhere disagrees with this document, this document governs. Migration sources keep their BEGIN/COMMIT markers; the guarded runner strips them (RP-13(e) mechanical rule, already applied by Codex).

## 1. Amended M1 (Amendment 1)

Amend `infra/postgres/migrations/20260729000100_b1_506_voice_recording_sessions.sql` in place with EXACTLY the four substitutions from `B1-506A_FABLE_AMENDMENT_REQUEST.md` lines 26 to 43 (both predicates of `sf_recording_sessions_rw` and both predicates of `sf_recording_segments_rw` gain `ARRAY['student']`). Post-amendment file SHA-256 MUST equal:

`6f6a3340bc29d1222b5f78472eb9a4897739722d090241de6d64f3e8f781c9c2`

independently reproduced by Fable this run. Replace the M1 hash at the three locations in `scripts/apply-production-migrations.sh`. Rollback file unchanged (`669f6c24...`). M2 unchanged (`8899d7d6...`).

## 2. New migration M3: `infra/postgres/migrations/20260729010000_b1_506a_voice_audit_lifecycle.sql`

```sql
BEGIN;

-- =============================================================
-- B1-506A Amendment 2: bounded voice audit writers
-- =============================================================

CREATE OR REPLACE FUNCTION public.sf_voice_audit_payload_ok(p_payload jsonb)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_key text;
  v_value jsonb;
  v_element jsonb;
  v_allowed text[] := ARRAY[
    'state','scope','allowlist','cohorts','errorCategory','code','seq',
    'recordingId','transcribeState','retryCount','segmentCount','surface',
    'reason','durationMs','byteSize','provider','model','count','objectCount',
    'latencyMs'
  ];
BEGIN
  IF p_payload IS NULL THEN RETURN true; END IF;
  IF jsonb_typeof(p_payload) <> 'object' THEN RETURN false; END IF;
  IF length(p_payload::text) > 4096 THEN RETURN false; END IF;
  -- 4096 accommodates the bounded flag payloads at their ruled maxima
  -- (50 allowlist uuids + 20 cohorts renders near 2500 characters).
  IF (SELECT count(*) FROM jsonb_object_keys(p_payload)) > 12 THEN RETURN false; END IF;
  FOR v_key, v_value IN SELECT key, value FROM jsonb_each(p_payload) LOOP
    IF NOT (v_key = ANY(v_allowed)) THEN RETURN false; END IF;
    IF jsonb_typeof(v_value) = 'array' THEN
      IF jsonb_array_length(v_value) > 64 THEN RETURN false; END IF;
      FOR v_element IN SELECT value FROM jsonb_array_elements(v_value) LOOP
        IF jsonb_typeof(v_element) NOT IN ('string','number')
           OR length(v_element::text) > 128 THEN RETURN false; END IF;
      END LOOP;
    ELSIF jsonb_typeof(v_value) IN ('object') THEN
      RETURN false;
    ELSIF length(v_value::text) > 128 THEN
      RETURN false;
    END IF;
  END LOOP;
  IF p_payload ? 'errorCategory'
     AND NOT (p_payload->>'errorCategory' = ANY(ARRAY['mic','upload','transcribe','assembly','save','auth'])) THEN
    RETURN false;
  END IF;
  IF p_payload ? 'state'
     AND NOT (p_payload->>'state' = ANY(ARRAY['recording','finishing','assembled','attached','cancelled','failed','retired','pending','uploaded','verified'])) THEN
    RETURN false;
  END IF;
  IF p_payload ? 'transcribeState'
     AND NOT (p_payload->>'transcribeState' = ANY(ARRAY['received','transcribing','transcribed','transcribe_failed'])) THEN
    RETURN false;
  END IF;
  IF p_payload ? 'scope'
     AND NOT (p_payload->>'scope' = ANY(ARRAY['off','allowlist','cohort','eligible_all'])) THEN
    RETURN false;
  END IF;
  IF p_payload ? 'reason'
     AND NOT (p_payload->>'reason' = ANY(ARRAY['abandoned_24h','save_never_completed_72h','failed_24h','story_archived'])) THEN
    RETURN false;
  END IF;
  IF p_payload ? 'code'
     AND NOT (p_payload->>'code' = ANY(ARRAY['transcribe_unavailable','transcribe_timeout','transcribe_rejected_format','transcribe_failed_permanent','transcribe_interrupted'])) THEN
    RETURN false;
  END IF;
  IF p_payload ? 'surface'
     AND NOT (p_payload->>'surface' = ANY(ARRAY['quick','library','system','features','voice_capture','voice_health'])) THEN
    RETURN false;
  END IF;
  IF p_payload ? 'provider'
     AND NOT (p_payload->>'provider' = ANY(ARRAY['openai','none'])) THEN
    RETURN false;
  END IF;
  IF p_payload ? 'model'
     AND NOT (p_payload->>'model' = ANY(ARRAY['gpt-4o-transcribe','whisper-1'])) THEN
    RETURN false;
  END IF;
  RETURN true;
END
$$;

CREATE OR REPLACE FUNCTION public.sf_append_voice_audit(
  p_action text,
  p_entity_type text,
  p_entity_id uuid,
  p_surface text,
  p_student_id uuid DEFAULT NULL,
  p_story_id uuid DEFAULT NULL,
  p_previous jsonb DEFAULT NULL,
  p_new jsonb DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_event_id bigint;
  v_actor_display text;
BEGIN
  IF p_action NOT IN (
    'recording_started','segment_received','recording_finished',
    'audio_deleted','audio_attached','unauthorized_denied','feature_scope_changed'
  ) THEN
    RAISE EXCEPTION 'voice audit action not permitted' USING ERRCODE = '22023';
  END IF;
  IF p_entity_type NOT IN ('recording_session','recording_segment','audio_asset','feature_flag') THEN
    RAISE EXCEPTION 'voice audit entity not permitted' USING ERRCODE = '22023';
  END IF;
  IF p_surface NOT IN ('quick','library','system') THEN
    RAISE EXCEPTION 'voice audit surface not permitted' USING ERRCODE = '22023';
  END IF;
  IF NOT public.sf_has_live_identity() THEN
    RAISE EXCEPTION 'live identity required' USING ERRCODE = '42501';
  END IF;
  IF p_action = 'feature_scope_changed' AND public.sf_actor_role() <> 'admin' THEN
    RAISE EXCEPTION 'administrator identity required' USING ERRCODE = '42501';
  END IF;
  IF p_action IN ('recording_started','segment_received','recording_finished','audio_deleted','audio_attached')
     AND NOT public.sf_has_live_identity(ARRAY['student']) THEN
    RAISE EXCEPTION 'student identity required' USING ERRCODE = '42501';
  END IF;
  IF p_student_id IS NOT NULL AND p_student_id <> public.sf_actor_id() THEN
    RAISE EXCEPTION 'audit target must be the acting student' USING ERRCODE = '42501';
  END IF;
  IF p_story_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.sf_stories story
    WHERE story.id = p_story_id AND story.student_id = public.sf_actor_id()
  ) THEN
    RAISE EXCEPTION 'audit story must belong to the acting student' USING ERRCODE = '42501';
  END IF;
  IF p_action IN ('recording_started','recording_finished','audio_attached')
     AND (p_entity_type <> 'recording_session' OR NOT EXISTS (
       SELECT 1 FROM public.sf_recording_sessions rs
       WHERE rs.id = p_entity_id AND rs.student_id = public.sf_actor_id())) THEN
    RAISE EXCEPTION 'audit entity must be an owned recording session' USING ERRCODE = '42501';
  END IF;
  IF p_action = 'segment_received'
     AND (p_entity_type <> 'recording_segment' OR NOT EXISTS (
       SELECT 1 FROM public.sf_recording_segments seg
       JOIN public.sf_recording_sessions rs ON rs.id = seg.session_id
       WHERE seg.id = p_entity_id AND rs.student_id = public.sf_actor_id())) THEN
    RAISE EXCEPTION 'audit entity must be an owned recording segment' USING ERRCODE = '42501';
  END IF;
  IF p_action = 'audio_deleted'
     AND (p_entity_type <> 'audio_asset' OR NOT EXISTS (
       SELECT 1 FROM public.sf_audio_assets asset
       WHERE asset.id = p_entity_id AND asset.student_id = public.sf_actor_id())) THEN
    RAISE EXCEPTION 'audit entity must be an owned audio asset' USING ERRCODE = '42501';
  END IF;
  IF p_action = 'unauthorized_denied'
     AND (p_previous IS NOT NULL
          OR coalesce(p_new, '{}'::jsonb) - 'surface' - 'errorCategory' <> '{}'::jsonb) THEN
    RAISE EXCEPTION 'denial audit payload shape not permitted' USING ERRCODE = '22023';
  END IF;
  IF NOT public.sf_voice_audit_payload_ok(p_previous)
     OR NOT public.sf_voice_audit_payload_ok(p_new) THEN
    RAISE EXCEPTION 'voice audit payload not permitted' USING ERRCODE = '22023';
  END IF;

  SELECT display_name INTO v_actor_display
  FROM public.sf_users WHERE id = public.sf_actor_id();

  INSERT INTO public.sf_audit_events (
    actor_id, actor_role, actor_display, action, entity_type, entity_id,
    surface, student_id, story_id, question_id, previous_value, new_value,
    detail, visibility
  )
  VALUES (
    public.sf_actor_id(), public.sf_actor_role(),
    coalesce(v_actor_display, 'StoryForge system'),
    p_action, p_entity_type, p_entity_id, p_surface, p_student_id, p_story_id,
    NULL, p_previous, p_new, NULL, 'both'
  )
  RETURNING id INTO v_event_id;
  RETURN v_event_id;
END
$$;

CREATE OR REPLACE FUNCTION public.sf_append_voice_audit_service(
  p_action text,
  p_entity_type text,
  p_entity_id uuid,
  p_student_id uuid DEFAULT NULL,
  p_story_id uuid DEFAULT NULL,
  p_previous jsonb DEFAULT NULL,
  p_new jsonb DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_event_id bigint;
BEGIN
  IF p_action NOT IN (
    'recording_cancelled','recording_swept','assembly_completed','assembly_failed',
    'segment_transcribed','segment_transcribe_failed','provider_failover',
    'reconciliation_deleted','object_delete_retried'
  ) THEN
    RAISE EXCEPTION 'service audit action not permitted' USING ERRCODE = '22023';
  END IF;
  IF p_entity_type NOT IN ('recording_session','recording_segment','audio_asset','feature_flag') THEN
    RAISE EXCEPTION 'service audit entity not permitted' USING ERRCODE = '22023';
  END IF;
  IF NOT public.sf_voice_audit_payload_ok(p_previous)
     OR NOT public.sf_voice_audit_payload_ok(p_new) THEN
    RAISE EXCEPTION 'service audit payload not permitted' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.sf_audit_events (
    actor_id, actor_role, actor_display, action, entity_type, entity_id,
    surface, student_id, story_id, question_id, previous_value, new_value,
    detail, visibility
  )
  VALUES (
    NULL, 'service', 'StoryForge system',
    p_action, p_entity_type, p_entity_id, 'system', p_student_id, p_story_id,
    NULL, p_previous, p_new, NULL, 'both'
  )
  RETURNING id INTO v_event_id;
  RETURN v_event_id;
END
$$;

REVOKE ALL ON FUNCTION public.sf_voice_audit_payload_ok(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sf_append_voice_audit(text, text, uuid, text, uuid, uuid, jsonb, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sf_append_voice_audit_service(text, text, uuid, uuid, uuid, jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sf_append_voice_audit(text, text, uuid, text, uuid, uuid, jsonb, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sf_append_voice_audit_service(text, text, uuid, uuid, uuid, jsonb, jsonb) TO storyforge_app;

-- =============================================================
-- B1-506A Amendment 3: bounded observability queries
-- =============================================================

CREATE OR REPLACE FUNCTION public.sf_feature_audit_tail(p_limit integer DEFAULT 20)
RETURNS TABLE (
  id bigint,
  actor_id uuid,
  action text,
  previous_value jsonb,
  new_value jsonb,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.sf_has_live_identity(ARRAY['admin']) THEN
    RAISE EXCEPTION 'administrator identity required' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT event.id, event.actor_id, event.action,
         event.previous_value, event.new_value, event.created_at
  FROM public.sf_audit_events event
  WHERE event.entity_type = 'feature_flag'
    AND event.action IN ('feature_scope_changed','unauthorized_denied')
  ORDER BY event.id DESC
  LIMIT greatest(1, least(coalesce(p_limit, 20), 50));
END
$$;

CREATE OR REPLACE FUNCTION public.sf_voice_error_summary()
RETURNS TABLE (
  error_category text,
  count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.sf_has_live_identity(ARRAY['admin']) THEN
    RAISE EXCEPTION 'administrator identity required' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT event.new_value->>'errorCategory' AS error_category,
         count(*)::integer AS count
  FROM public.sf_audit_events event
  WHERE event.created_at > now() - interval '24 hours'
    AND (event.new_value ? 'errorCategory')
    AND event.entity_type IN ('recording_session','recording_segment','audio_asset','feature_flag')
    AND event.new_value->>'errorCategory' IN ('mic','upload','transcribe','assembly','save','auth')
  GROUP BY 1
  ORDER BY 1;
END
$$;

CREATE INDEX IF NOT EXISTS sf_audit_error_category_idx
  ON public.sf_audit_events (created_at DESC)
  WHERE (new_value ? 'errorCategory');

REVOKE ALL ON FUNCTION public.sf_feature_audit_tail(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sf_voice_error_summary() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sf_feature_audit_tail(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sf_voice_error_summary() TO authenticated;

-- =============================================================
-- B1-506A Amendment 4: lifecycle and retirement
-- =============================================================

CREATE OR REPLACE FUNCTION public.sf_voice_sweep_candidates(p_limit integer DEFAULT 50)
RETURNS TABLE (
  session_id uuid,
  student_id uuid,
  state text,
  reason text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT rs.id, rs.student_id, rs.state,
    CASE
      WHEN rs.state = 'recording' THEN 'abandoned_24h'
      WHEN rs.state IN ('finishing','assembled') THEN 'save_never_completed_72h'
      ELSE 'failed_24h'
    END AS reason
  FROM public.sf_recording_sessions rs
  WHERE (
      (rs.state = 'recording'
        AND rs.last_activity_at < now() - interval '24 hours'
        AND NOT EXISTS (
          SELECT 1 FROM public.sf_story_drafts draft
          WHERE draft.user_id = rs.student_id
            AND draft.updated_at > now() - interval '24 hours'))
   OR (rs.state IN ('finishing','assembled')
        AND rs.updated_at < now() - interval '72 hours')
   OR (rs.state = 'failed'
        AND rs.updated_at < now() - interval '24 hours'
        AND EXISTS (SELECT 1 FROM public.sf_recording_segments seg
                    WHERE seg.session_id = rs.id))
  )
  ORDER BY rs.updated_at ASC
  LIMIT greatest(1, least(coalesce(p_limit, 50), 100))
$$;

CREATE OR REPLACE FUNCTION public.sf_voice_sweep_purge(p_session_id uuid, p_reason text)
RETURNS TABLE (object_key text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_session public.sf_recording_sessions;
  v_segment_count integer;
BEGIN
  IF p_reason NOT IN ('abandoned_24h','save_never_completed_72h','failed_24h','story_archived') THEN
    RAISE EXCEPTION 'sweep reason not permitted' USING ERRCODE = '22023';
  END IF;
  -- story_archived is RESERVED: no Phase 1 caller exists, because sessions gain
  -- story_id only inside sf_attach_recording, which is terminal (Amendment 4).
  IF p_reason = 'story_archived' THEN RETURN; END IF;

  SELECT * INTO v_session FROM public.sf_recording_sessions rs
  WHERE rs.id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  IF v_session.state IN ('attached','cancelled') THEN RETURN; END IF;

  -- Re-verify candidacy UNDER THE LOCK: a session the student has resumed,
  -- or whose draft was touched, is no longer a candidate and must not be purged.
  IF p_reason = 'abandoned_24h' AND NOT (
       v_session.state = 'recording'
       AND v_session.last_activity_at < now() - interval '24 hours'
       AND NOT EXISTS (
         SELECT 1 FROM public.sf_story_drafts draft
         WHERE draft.user_id = v_session.student_id
           AND draft.updated_at > now() - interval '24 hours')) THEN
    RETURN;
  END IF;
  IF p_reason = 'save_never_completed_72h' AND NOT (
       v_session.state IN ('finishing','assembled')
       AND v_session.updated_at < now() - interval '72 hours') THEN
    RETURN;
  END IF;
  IF p_reason = 'failed_24h' AND NOT (
       v_session.state = 'failed'
       AND v_session.updated_at < now() - interval '24 hours') THEN
    RETURN;
  END IF;

  SELECT count(*) INTO v_segment_count
  FROM public.sf_recording_segments seg WHERE seg.session_id = p_session_id;

  -- Already-swept idempotency: a failed session with zero segments is done;
  -- write no duplicate audit event and return no keys.
  IF v_session.state = 'failed' AND v_segment_count = 0 THEN RETURN; END IF;

  PERFORM public.sf_append_voice_audit_service(
    'recording_swept', 'recording_session', p_session_id,
    v_session.student_id, NULL,
    jsonb_build_object('state', v_session.state),
    jsonb_build_object('state', 'failed', 'reason', p_reason, 'segmentCount', v_segment_count)
  );

  RETURN QUERY
  WITH removed AS (
    DELETE FROM public.sf_recording_segments seg
    WHERE seg.session_id = p_session_id
    RETURNING seg.object_key
  )
  SELECT removed.object_key FROM removed;

  UPDATE public.sf_recording_sessions rs
  SET state = 'failed', updated_at = now()
  WHERE rs.id = p_session_id;
END
$$;

CREATE OR REPLACE FUNCTION public.sf_voice_asset_pending_candidates(p_limit integer DEFAULT 20)
RETURNS TABLE (
  asset_id uuid,
  session_id uuid,
  student_id uuid,
  story_id uuid,
  object_key text,
  content_type text,
  pending_minutes integer
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT asset.id, rs.id, asset.student_id, asset.story_id,
         asset.object_key, asset.content_type,
         floor(extract(epoch FROM (now() - asset.created_at)) / 60)::integer
  FROM public.sf_audio_assets asset
  JOIN public.sf_recording_sessions rs ON rs.assembled_asset_id = asset.id
  WHERE asset.state = 'pending'
    AND asset.created_at < now() - interval '15 minutes'
  ORDER BY asset.created_at ASC
  LIMIT greatest(1, least(coalesce(p_limit, 20), 50))
$$;

CREATE OR REPLACE FUNCTION public.sf_voice_asset_mark_verified(
  p_asset_id uuid,
  p_byte_size bigint,
  p_checksum_sha256 text
)
RETURNS TABLE (object_key text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_updated integer;
BEGIN
  UPDATE public.sf_audio_assets asset
  SET state = 'verified',
      byte_size = p_byte_size,
      checksum_sha256 = p_checksum_sha256,
      duration_ms = (SELECT rs.total_duration_ms FROM public.sf_recording_sessions rs
                     WHERE rs.assembled_asset_id = p_asset_id),
      verified_at = now()
  WHERE asset.id = p_asset_id AND asset.state = 'pending';
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated = 0 THEN RETURN; END IF;

  -- The session's segment_count is deliberately RETAINED here: under Option B
  -- it is the playback manifest (seg-00000 through seg-{segment_count-1}).
  -- Of the purge paths, only retire zeroes it (sweep and cancel leave terminal
  -- sessions whose rows are deleted; nothing reads their stale count).
  RETURN QUERY
  WITH removed AS (
    DELETE FROM public.sf_recording_segments seg
    USING public.sf_recording_sessions rs
    WHERE rs.assembled_asset_id = p_asset_id
      AND seg.session_id = rs.id
    RETURNING seg.object_key
  )
  SELECT removed.object_key FROM removed;
END
$$;

CREATE OR REPLACE FUNCTION public.sf_voice_asset_mark_failed(p_asset_id uuid)
RETURNS TABLE (object_key text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_asset public.sf_audio_assets;
BEGIN
  SELECT * INTO v_asset FROM public.sf_audio_assets asset
  WHERE asset.id = p_asset_id AND asset.state = 'pending'
  FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;

  UPDATE public.sf_audio_assets asset
  SET state = 'failed'
  WHERE asset.id = p_asset_id;

  PERFORM public.sf_append_voice_audit_service(
    'assembly_failed', 'audio_asset', p_asset_id,
    v_asset.student_id, NULL,
    jsonb_build_object('state', 'pending'),
    jsonb_build_object('state', 'failed', 'errorCategory', 'assembly')
  );

  -- The transcript already lives in the saved story text; the segment rows
  -- (transcripts, flagged terms) are purged in this same transaction so a
  -- completed-lifecycle session never retains them.
  RETURN QUERY
  WITH removed AS (
    DELETE FROM public.sf_recording_segments seg
    USING public.sf_recording_sessions rs
    WHERE rs.assembled_asset_id = p_asset_id
      AND seg.session_id = rs.id
    RETURNING seg.object_key
  )
  SELECT removed.object_key FROM removed;

  UPDATE public.sf_recording_sessions rs
  SET segment_count = 0, updated_at = now()
  WHERE rs.assembled_asset_id = p_asset_id;
END
$$;

CREATE OR REPLACE FUNCTION public.sf_voice_audio_reference_check(p_object_keys text[])
RETURNS TABLE (object_key text, referenced boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF coalesce(array_length(p_object_keys, 1), 0) > 1000 THEN
    RAISE EXCEPTION 'reference check batch exceeds 1000 keys' USING ERRCODE = '22023';
  END IF;
  RETURN QUERY
  SELECT candidate.key AS object_key,
         EXISTS (
           SELECT 1 FROM public.sf_audio_assets asset
           WHERE asset.state IN ('pending','uploaded','verified')
             AND (asset.object_key = candidate.key
                  OR candidate.key LIKE asset.object_key || '%')
         ) AS referenced
  FROM unnest(coalesce(p_object_keys, ARRAY[]::text[])) AS candidate(key);
  -- An underscore in object_key acts as a LIKE wildcard; keys are server-generated
  -- UUID paths without underscores, and a false POSITIVE (referenced=true) only
  -- delays deletion, never destroys referenced audio. Safe by direction.
END
$$;

CREATE OR REPLACE FUNCTION public.sf_retire_story_audio(p_asset_id uuid)
RETURNS TABLE (object_key text, story_id uuid, changed boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_asset public.sf_audio_assets;
BEGIN
  IF NOT public.sf_has_live_identity(ARRAY['student']) THEN
    RAISE EXCEPTION 'eligible student identity required' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_asset FROM public.sf_audio_assets asset
  WHERE asset.id = p_asset_id
    AND asset.student_id = public.sf_actor_id()
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'audio asset not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_asset.state = 'retired' THEN
    RETURN QUERY SELECT v_asset.object_key, v_asset.story_id, false;
    RETURN;
  END IF;
  PERFORM public.sf_append_voice_audit(
    'audio_deleted', 'audio_asset', p_asset_id, 'library',
    public.sf_actor_id(), v_asset.story_id,
    jsonb_build_object('state', v_asset.state),
    jsonb_build_object('state', 'retired')
  );
  UPDATE public.sf_audio_assets asset
  SET state = 'retired'
  WHERE asset.id = p_asset_id;
  -- Retire-while-pending closure: purge any residual segment rows of the
  -- linked session in this same transaction (transcripts leave the database
  -- with the student's delete). Their storyforge-rec/ objects are covered by
  -- the 7-day expiry and reconciliation backstops.
  DELETE FROM public.sf_recording_segments seg
  USING public.sf_recording_sessions rs
  WHERE rs.assembled_asset_id = p_asset_id
    AND seg.session_id = rs.id;
  UPDATE public.sf_recording_sessions rs
  SET segment_count = 0, updated_at = now()
  WHERE rs.assembled_asset_id = p_asset_id;
  RETURN QUERY SELECT v_asset.object_key, v_asset.story_id, true;
END
$$;

CREATE OR REPLACE FUNCTION public.sf_attach_recording(
  p_story_id uuid,
  p_session_id uuid,
  p_content_type text
)
RETURNS TABLE (asset_id uuid, target_object_key text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_story public.sf_stories;
  v_session public.sf_recording_sessions;
  v_existing_key text;
  v_asset_id uuid := gen_random_uuid();
  v_key text;
BEGIN
  IF NOT public.sf_has_live_identity(ARRAY['student']) THEN
    RAISE EXCEPTION 'eligible student identity required' USING ERRCODE = '42501';
  END IF;
  IF p_content_type NOT IN ('audio/webm','audio/mp4','audio/ogg','audio/wav') THEN
    RAISE EXCEPTION 'audio content type not permitted' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_story FROM public.sf_stories story
  WHERE story.id = p_story_id AND story.student_id = public.sf_actor_id()
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'story not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_story.capture_type <> 'audio' THEN
    RAISE EXCEPTION 'story capture type must be audio for attachment' USING ERRCODE = '23514';
  END IF;

  SELECT * INTO v_session FROM public.sf_recording_sessions rs
  WHERE rs.id = p_session_id AND rs.student_id = public.sf_actor_id()
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'recording session not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_session.state = 'attached' THEN
    IF v_session.story_id = p_story_id AND v_session.assembled_asset_id IS NOT NULL THEN
      SELECT asset.object_key INTO v_existing_key
      FROM public.sf_audio_assets asset
      WHERE asset.id = v_session.assembled_asset_id;
      RETURN QUERY SELECT v_session.assembled_asset_id, v_existing_key;
      RETURN;
    END IF;
    RAISE EXCEPTION 'recording already attached elsewhere' USING ERRCODE = '42501';
  END IF;
  IF v_session.state <> 'assembled' THEN
    RAISE EXCEPTION 'recording is not ready to attach' USING ERRCODE = '23514';
  END IF;

  IF EXISTS (SELECT 1 FROM public.sf_story_originals originals
             WHERE originals.story_id = p_story_id) THEN
    RAISE EXCEPTION 'story original already exists' USING ERRCODE = '23514';
  END IF;

  -- OPTION-NEUTRAL KEY (binding): the stored object_key carries NO extension and
  -- NO trailing slash. Option A's single assembled object lives at
  -- object_key || '.' || ext; Option B's per-segment objects live at
  -- object_key || '/seg-{seq:05d}.' || ext. Both shapes are therefore covered by
  -- the reference check's prefix match and by E8/story-cascade prefix deletion.
  v_key := 'storyforge-audio/' || v_story.student_id || '/' || v_story.id || '/'
           || v_asset_id;

  INSERT INTO public.sf_audio_assets (id, story_id, student_id, object_key, content_type, state)
  VALUES (v_asset_id, p_story_id, v_story.student_id, v_key, p_content_type, 'pending');

  UPDATE public.sf_recording_sessions rs
  SET state = 'attached',
      story_id = p_story_id,
      assembled_asset_id = v_asset_id,
      updated_at = now()
  WHERE rs.id = p_session_id;

  -- sf_create_story_v5 deliberately skips the originals insert for audio
  -- captures (VST comment in its body); the attach transaction inserts the
  -- immutable original exactly once, transcript and asset together.
  INSERT INTO public.sf_story_originals (
    story_id, original_transcript, audio_asset_id, capture_type, created_at
  )
  VALUES (p_story_id, v_story.original_text, v_asset_id, 'audio', v_story.created_at);

  PERFORM public.sf_append_voice_audit(
    'audio_attached', 'recording_session', p_session_id, 'quick',
    public.sf_actor_id(), p_story_id,
    jsonb_build_object('state', 'assembled'),
    jsonb_build_object('state', 'attached')
  );

  RETURN QUERY SELECT v_asset_id, v_key;
END
$$;

REVOKE ALL ON FUNCTION public.sf_voice_sweep_candidates(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sf_voice_sweep_purge(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sf_voice_asset_pending_candidates(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sf_voice_asset_mark_verified(uuid, bigint, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sf_voice_asset_mark_failed(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sf_voice_audio_reference_check(text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sf_retire_story_audio(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sf_attach_recording(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sf_voice_sweep_candidates(integer) TO storyforge_app;
GRANT EXECUTE ON FUNCTION public.sf_voice_sweep_purge(uuid, text) TO storyforge_app;
GRANT EXECUTE ON FUNCTION public.sf_voice_asset_pending_candidates(integer) TO storyforge_app;
GRANT EXECUTE ON FUNCTION public.sf_voice_asset_mark_verified(uuid, bigint, text) TO storyforge_app;
GRANT EXECUTE ON FUNCTION public.sf_voice_asset_mark_failed(uuid) TO storyforge_app;
GRANT EXECUTE ON FUNCTION public.sf_voice_audio_reference_check(text[]) TO storyforge_app;
GRANT EXECUTE ON FUNCTION public.sf_retire_story_audio(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sf_attach_recording(uuid, uuid, text) TO authenticated;

COMMIT;
```

Rollback `20260729010000_b1_506a_voice_audit_lifecycle_rollback.sql`:

```sql
BEGIN;
DROP FUNCTION IF EXISTS public.sf_attach_recording(uuid, uuid, text);
DROP FUNCTION IF EXISTS public.sf_retire_story_audio(uuid);
DROP FUNCTION IF EXISTS public.sf_voice_audio_reference_check(text[]);
DROP FUNCTION IF EXISTS public.sf_voice_asset_mark_failed(uuid);
DROP FUNCTION IF EXISTS public.sf_voice_asset_mark_verified(uuid, bigint, text);
DROP FUNCTION IF EXISTS public.sf_voice_asset_pending_candidates(integer);
DROP FUNCTION IF EXISTS public.sf_voice_sweep_purge(uuid, text);
DROP FUNCTION IF EXISTS public.sf_voice_sweep_candidates(integer);
DROP INDEX IF EXISTS public.sf_audit_error_category_idx;
DROP FUNCTION IF EXISTS public.sf_voice_error_summary();
DROP FUNCTION IF EXISTS public.sf_feature_audit_tail(integer);
DROP FUNCTION IF EXISTS public.sf_append_voice_audit_service(text, text, uuid, uuid, uuid, jsonb, jsonb);
DROP FUNCTION IF EXISTS public.sf_append_voice_audit(text, text, uuid, text, uuid, uuid, jsonb, jsonb);
DROP FUNCTION IF EXISTS public.sf_voice_audit_payload_ok(jsonb);
COMMIT;
-- Audit rows already written are append-only history and are retained.
```

Known deliberate choices Codex must NOT second-guess: the permanent object key is computed INSIDE `sf_attach_recording` from server-side values only, extension-free and option-neutral (no client-supplied key exists anywhere in the attach path); `story_archived` is a RESERVED reason with a structural no-op body, because sessions gain `story_id` only inside the terminal attach transaction, so an open session linked to a story cannot exist in Phase 1 (a test asserts that invariant; nothing is implemented for archive propagation beyond it); `cancelled` remains the label for student-initiated E5 cancels, which continue through the existing store path; the M1 state CHECK constraint already permits every transition used here; the originals insert for audio stories happens exactly once, in the attach transaction, matching the committed sf_create_story_v5 comment that audio originals wait for the final transcript; asset copy retries are TIME-BASED with no new column: attempts happen at the 10-minute sweep cadence via `sf_voice_asset_pending_candidates`, and an asset still `pending` with `pending_minutes >= 60` is marked failed (roughly three attempts, deterministic, restart-safe).

## 3. Server wiring rulings (Amendments 2, 3, 4, 6)

- `server/db.mjs`: `appendAudit` calls `public.sf_append_voice_audit` (drop the question/detail/visibility parameters from the call; keep the 42501-to-503 mapping). New export `appendServiceAudit(client, fields)` calls `public.sf_append_voice_audit_service`. Every store call site under `withIdentity` uses `appendAudit`; every call site under `withServiceTransaction` uses `appendServiceAudit` (this includes `cancelSession`, `markAssembled`, `markAssemblyFailed`, transcription workers, and sweeps). DENIAL-BOOKKEEPING EXCEPTION (binding): when a DENIAL audit write (`unauthorized_denied` and the recording denial bookkeeping) raises the writer's 'live identity required' 42501, the server DROPS that audit event and proceeds with the original denial response; an ineligible or role-drifted identity gets its clean 403/404, never a 503. Every MUTATION audit keeps strict fail-closed semantics.
- `server/flags.mjs` wiring: `readFeatureAuditTail(identity, client)` and `readVoiceErrorSummary(identity, client)` receive the ALREADY-OPEN identity client from the enclosing `withIdentity` and run `SELECT * FROM public.sf_feature_audit_tail($1)` / `SELECT * FROM public.sf_voice_error_summary()` on it (no nested `withIdentity`, no second pooled connection). The 503 seams remain for absence or failure. `validateMutation` additionally bounds `allowlist` to at most 50 entries and `cohorts` to at most 20, rejected with the existing `invalid_voice_allowlist` / `invalid_voice_cohort` VoiceFlagError codes; with the guard's 4096-character payload cap these bounds always satisfy the payload guard (a 50-uuid allowlist plus 20 cohorts renders near 2500 characters), and the boundary test at exactly 50 entries must pass.
- `server/recordings.mjs`: `sweepCandidates`/`sweepSession` implement through `sf_voice_sweep_candidates`/`sf_voice_sweep_purge`; ordering is DB-commit-first, object deletes post-commit with one immediate retry, then an `object_delete_retried` service audit (counts only) and reliance on the 7-day `storyforge-rec/` expiry plus weekly reconciliation; when purging a `finishing`/`assembled` session, `sweepSession` deletes the ENTIRE `storyforge-rec/{student}/{session}/` prefix by listing it (covering any Option A temp `assembled.{ext}` object), not only the returned segment keys; `cancelSession` adopts the same commit-first ordering (audit + row purge + state commit, then objects); `deleteAudio` routes through `sf_retire_story_audio` with post-commit prefix deletion of every object under the asset's extension-free object_key; archive propagation is a STRUCTURAL NO-OP in Phase 1 (see the deliberate-choices note; a test asserts no open session carries story_id); `markAssembled` drops its asset-id parameter (assembled means artifact-ready, `assembled_asset_id` stays NULL until attach).
- E7 flow with exact idempotency mechanism: the handler FIRST reads the owned session under identity; if state is `attached`, it returns the story at `session.story_id` with the linked asset and calls nothing else; if state is `finishing`, it returns 409 `voice_assembly_pending` with `retryAfterMs: 2000`; if state is `assembled`, it executes `sf_create_story_v5` then `sf_attach_recording` on the SAME `withIdentity` client transaction. If `sf_attach_recording` raises 'recording already attached elsewhere' (a concurrent duplicate won the race), the whole transaction rolls back, the handler re-reads the session, and returns the already-attached story. SQLSTATE-to-HTTP mapping for attach failures: P0002 -> 404 with the existing not_found codes; 23514 -> 409 `state_conflict`; 22023 -> 400 `invalid_request`; any other 42501 -> 403 `recording_access_denied`.
- Post-commit service phase after a successful attach: copy the artifact(s) to the permanent key shape (Option A: `object_key || '.' || ext`, one CopyObject; Option B: `object_key || '/seg-{seq:05d}.' || ext` per segment), where ext derives from the asset's content_type by the BINDING map audio/webm -> webm, audio/mp4 -> m4a, audio/ogg -> ogg, audio/wav -> wav, used identically at copy time and playback time. PLAYBACK KEY RULE (binding, covers legacy rows): an `object_key` ending in `.webm`, `.m4a`, `.mp4`, `.ogg`, or `.wav` is a legacy full key and is signed verbatim; any other object_key is a stem, and playback derives Option A's single key as `stem.ext` or Option B's ordered keys as `stem/seg-{seq:05d}.ext` for seq 0 through the session's RETAINED `segment_count - 1` (session joined on `assembled_asset_id`); the playback/presign module joins the files-changed list for exactly this rule. HEAD-verify every copied object, then call `sf_voice_asset_mark_verified(assetId, byteSize, checksumSha256)` in one service transaction (byte_size = the single object's size under Option A or the aggregate under Option B; `checksum_sha256` = the assembled object's SHA-256 under Option A, NULL under Option B with per-object ETags filed in evidence). The function itself purges the session's segment rows and returns their keys; the service then deletes the temp objects. Retry and terminal failure are TIME-BASED via `sf_voice_asset_pending_candidates` at the 10-minute sweep cadence: each pass re-attempts the copy for pending assets older than 15 minutes; an asset with `pending_minutes >= 60` is finalized with `sf_voice_asset_mark_failed` (audits `assembly_failed`, purges the session's segment rows in the same transaction, returns keys for temp deletion). Until `verified`, playback shows the truthful unavailable state; a `failed` asset's story keeps its transcript text and shows the truthful audio-unavailable state permanently.
- `public/app.js`: voice save polls E3 until `assembled`, then calls E7; on 409 `voice_assembly_pending` retries with 2 s backoff up to 90 s, then offers the truthful choice: keep waiting, or save the typed story via the EXISTING E5 discard confirm flow. RACE RULE (binding): if that E5 cancel returns `state_conflict` because the session reached `assembled` meanwhile, the client retries E7 ONCE, which now succeeds, and the story saves WITH audio (the student may delete the audio afterward through the normal E8 control); nothing is lost silently and no session is left trapped. New PA-immutable string for save-time assembly failure: "We couldn't attach your audio this time. Every word is safe in your story text. You can save your story now, and you can record again anytime."

## 4. Provider contract (Amendment 5)

Endpoint: `POST https://api.openai.com/v1/audio/transcriptions` (multipart/form-data). Primary driver `server/transcription/openai-gpt-4o-transcribe.mjs`; fallback driver `server/transcription/openai-whisper1.mjs`.

| Field | Primary (`gpt-4o-transcribe`) | Fallback (`whisper-1`) |
|---|---|---|
| `file` | `seg-{seq:05d}.{ext}`; webm, mp4/m4a, ogg, wav; <= 5 MB by segment cap (API limit 25 MB) | same |
| `model` | `gpt-4o-transcribe` | `whisper-1` |
| `language` | `en` unless the session carries an explicit hint (SINGULAR field; plural `languages` is struck) | same |
| `prompt` | context tail (last 200 chars of previous final text) + `Vocabulary: term1, term2, ...` from lexicon plus tokenized draft title when available; total <= 600 chars; composition order fixed; there is NO `keywords` parameter | same composition |
| `response_format` | `json` (the only supported value for gpt-4o models) | `json` |
| `include[]` | `logprobs` | not sent (unsupported) |
| `stream` | not used in Phase 1 batch path | not supported |
| `temperature` | not sent (provider default) | not sent |

Response handling: `text` verbatim. Confidence, deterministic: a SPAN is one whitespace-delimited word of the returned text; provider tokens map to words by cumulative concatenation offsets; a word's confidence is the mean logprob of its overlapping tokens; words below the driver constant `LOW_CONFIDENCE_LOGPROB = -1.2` become flaggedTerms entries in the SAME shape `flagLexiconTerms` emits, with source 'confidence'; when a lexicon flag and a confidence flag cover the same span, the lexicon flag wins. Fallback returns no confidence and lexicon-only flags apply (absent confidence never invents chips). Prompt truncation, deterministic: the combined vocabulary list is lexicon terms first, then draft-title tokens; when tail + vocabulary exceed 600 characters, items drop from the END of the combined list (so title tokens go first, then lexicon terms from the back), never truncating mid-term; the 200-character context tail always survives. `usage` recorded content-free for cost metrics. Error mapping to the fixed taxonomy: HTTP 400 unsupported format -> `transcribe_rejected_format` (adapter already routes to fallback); 401/403/404-model -> hard primary failure (adapter failover, already implemented); 408/timeout/abort -> `transcribe_timeout`; 429/5xx -> `transcribe_unavailable` (retry/failover per adapter). Timeouts and retries unchanged from the committed adapter: 30 s AbortController, one immediate retry on 5xx/timeout, E6 cap 3, backoff 2 s then 8 s, at most two in-flight provider calls per session per the Lock, with the COMMITTED single-active FIFO session queue standing as-is (it preserves previous-segment prompt context; do not widen it), `transcribed` idempotency. Both drivers report `capabilities()` as `{ keywords: true, confidence: <primary true, fallback false> }`: keywords is true because prompt-composition enrichment exists; the Lock Section 3 driver file list is superseded by the two filenames above, and `keywords.mjs` remains the composition source. No-provider behavior unchanged (`STORYFORGE_TRANSCRIBE_PROVIDER=none` truthful mode). Environment variables: `STORYFORGE_TRANSCRIBE_PROVIDER` (`none` | `openai`), `STORYFORGE_OPENAI_API_KEY` (required when `openai`), optional `STORYFORGE_TRANSCRIBE_PRIMARY_MODEL` (default `gpt-4o-transcribe`) and `STORYFORGE_TRANSCRIBE_FALLBACK_MODEL` (default `whisper-1`) accepted ONLY from this fixed pair (any other value fails validateConfig). `validateConfig` accepts exactly `none` or `openai`; production stays `none` until the runbook's activation step. `createTranscriptionAdapterForProvider('openai')` builds the adapter with both drivers; every other value except `none` keeps throwing.

Bake-off candidates (exactly three): C1 primary + full prompt composition; C2 primary + context tail only; C3 whisper-1 + full composition. The committed scorer (hashes `9b269ab0...`, `9f5b9981...`) is the binding normalization and aggregation; the Transcription Lock's thresholds and single outcome table govern unchanged; `metricsUsableForActivation` flips only on consented human corpus plus real provider runs. `gpt-4o-mini-transcribe` is recorded as available, is NOT a candidate, and adding any candidate or vendor is FG-3.

RP-7 probe: the prepared card in the Codex handoff Section 10.4 with `STORYFORGE_MODEL_IDS_CSV="gpt-4o-transcribe,whisper-1"`. Outcomes (exhaustive): both true -> drivers armed, bake-off awaits corpus; primary false, fallback true -> fallback-only posture, the Lock's accuracy rule governs and FG-3 is prepared; primary true, fallback false -> STILL BLOCKED to Fable (the Lock's wired-fallback mandate is unsatisfiable; the key's model scope goes back for review); both false -> STILL BLOCKED to Fable; HTTP 401/403 -> credential lane stop (CREDENTIAL-2). Driver implementation MAY precede the probe; activation may NOT.

## 5. E4/E7 transaction protocol (Amendment 6, option-independent)

Sequence (states per the M1 comment block, unchanged): E4 locks and moves `recording -> finishing`, triggers async assembly; assembly writes artifacts ONLY under `storyforge-rec/{student}/{session}/` (Option A: `assembled.{ext}` single object via ffmpeg stream-copy concat; Option B: no object, validation only) and moves `finishing -> assembled` with `assembled_asset_id` NULL; E7 follows the Section 3 flow exactly (idempotent pre-read; 409 on finishing; `sf_create_story_v5` + `sf_attach_recording` in ONE identity transaction, `assembled -> attached`, asset `pending`, deterministic extension-free permanent key); post-commit service phase copies to the option's key shape under the shared prefix, HEAD-verifies, and finalizes through `sf_voice_asset_mark_verified` / `sf_voice_asset_mark_failed` per Section 3 (segment rows purge inside those transactions; temp objects deleted after). Playback before `verified` shows the truthful unavailable state; a `failed` asset's story keeps its transcript with the truthful audio-unavailable state. Client E7 pending path 409/2 s/90 s, then the E5 discard choice with the Section 3 race rule (a cancel refused because assembly completed triggers ONE E7 retry, which saves the story with audio; E8 remains available). Assembly failure before attach follows `markAssemblyFailed` + the new fixed string. The 72-hour sweep remains the trap-proof backstop; idempotency = session UUID + state guards throughout; no partial story, no fake asset, no silent loss. RP-8 remains the ONLY selector between Option A and Option B; both executors are built now behind the injected boundary and only the probe outcome wires one.

## 6. Test inventory (binding names)

New: `tests/postgres/voice-audit-lifecycle.test.mjs` (writer grant matrix incl. service-cannot-call-authenticated-writer and vice versa; vocabulary, payload, impersonation, role, and entity-ownership rejections; the 50-entry allowlist boundary case; sweep candidate selection incl. draft exclusion, attached exclusion, and zero-segment-failed exclusion; purge re-verification no-op and transcript-erasure proof; asset-function grant rows plus pending-candidate selection, verify finalization with retained segment_count and populated duration_ms, fail finalization with same-transaction segment purge; retire ownership denial and retire-while-pending purge; attach atomicity, idempotency, and cross-student denial; the archive invariant assertion that no open session carries story_id; E11/E13 authorization matrix incl. mentor and service denial). New: `tests/unit/transcription-openai-drivers.test.mjs` (request-shape assertions against a local test double; the double lives in tests only and is not a production mock). Updated: `recording-rls.test.mjs` (four reds green), `recording-store-sideeffects.test.mjs`, `flags-capability.test.mjs`, `phase1-routes.test.mjs`, `voice-dock-states.spec.mjs` (red case green), plus one new e2e save-flow spec `tests/e2e/voice-save-attach.spec.mjs` runnable under the local harness with the assembly executor stubbed at the injected boundary (Option selection remains probe-gated). Unchanged and binding: the 72-surface conformance suite, the B1-503 matrices, and every currently green suite.
