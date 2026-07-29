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
