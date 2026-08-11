\set ON_ERROR_STOP on

-- Migration: B1-514 StoryForge V2 purposeful versions and durable authorship provenance.
-- Authority: DR-042 / DR-043; B1-513 Multi-Version Story Contract.
-- Depends on: 20260810190000_b1_514_v2_r1_visibility_consent_ops.sql
-- Historical Original and Full Story bytes remain in their existing tables.

BEGIN;

SELECT pg_advisory_xact_lock(hashtextextended('b1-514-v2-r2-story-versions', 0));

CREATE TABLE public.sf_story_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id uuid NOT NULL REFERENCES public.sf_stories(id) ON DELETE RESTRICT,
  version_key text NOT NULL CHECK (version_key IN ('thirty_second', 'nnq_setup')),
  body text NOT NULL DEFAULT '' CHECK (length(body) <= 20000),
  source text NOT NULL DEFAULT 'typed' CHECK (source IN ('typed', 'voice')),
  recording_id uuid REFERENCES public.sf_recording_sessions(id) ON DELETE RESTRICT,
  audio_asset_id uuid REFERENCES public.sf_audio_assets(id) ON DELETE RESTRICT,
  row_version bigint NOT NULL DEFAULT 0 CHECK (row_version >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (story_id, version_key),
  UNIQUE (id, story_id)
);

CREATE TABLE public.sf_story_version_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id uuid NOT NULL REFERENCES public.sf_story_versions(id) ON DELETE RESTRICT,
  story_id uuid NOT NULL REFERENCES public.sf_stories(id) ON DELETE RESTRICT,
  body text NOT NULL CHECK (length(body) <= 20000),
  source text NOT NULL CHECK (source IN ('typed', 'voice')),
  recording_id uuid REFERENCES public.sf_recording_sessions(id) ON DELETE RESTRICT,
  audio_asset_id uuid REFERENCES public.sf_audio_assets(id) ON DELETE RESTRICT,
  saved_at timestamptz NOT NULL,
  actor_user_id uuid NOT NULL REFERENCES public.sf_users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (version_id, story_id)
    REFERENCES public.sf_story_versions(id, story_id) ON DELETE RESTRICT
);

CREATE TABLE public.sf_authored_segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id uuid NOT NULL REFERENCES public.sf_stories(id) ON DELETE RESTRICT,
  story_version_id uuid REFERENCES public.sf_story_versions(id) ON DELETE RESTRICT,
  source_role text NOT NULL CHECK (source_role IN (
    'student_spoken', 'student_typed', 'mentor_content', 'guest_contributor', 'ai_question'
  )),
  source_entity_type text NOT NULL CHECK (source_entity_type IN (
    'story', 'story_version', 'mentor_note', 'contribution', 'reserved'
  )),
  source_entity_id uuid,
  body_hash text NOT NULL CHECK (body_hash ~ '^[a-f0-9]{64}$'),
  recording_id uuid REFERENCES public.sf_recording_sessions(id) ON DELETE RESTRICT,
  audio_asset_id uuid REFERENCES public.sf_audio_assets(id) ON DELETE RESTRICT,
  author_id uuid REFERENCES public.sf_users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (story_version_id IS NULL AND source_entity_type <> 'story_version')
    OR (story_version_id IS NOT NULL AND source_entity_type = 'story_version')
  )
);

CREATE OR REPLACE FUNCTION public.sf_forbid_story_version_history_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'story version history is append-only' USING ERRCODE='42501';
END $$;

CREATE TRIGGER sf_story_version_revisions_append_only
BEFORE UPDATE OR DELETE ON public.sf_story_version_revisions
FOR EACH ROW EXECUTE FUNCTION public.sf_forbid_story_version_history_mutation();

CREATE TRIGGER sf_authored_segments_append_only
BEFORE UPDATE OR DELETE ON public.sf_authored_segments
FOR EACH ROW EXECUTE FUNCTION public.sf_forbid_story_version_history_mutation();

CREATE INDEX sf_story_versions_story_idx
  ON public.sf_story_versions (story_id, version_key);
CREATE INDEX sf_story_version_revisions_version_idx
  ON public.sf_story_version_revisions (version_id, created_at DESC, id DESC);
CREATE INDEX sf_authored_segments_story_idx
  ON public.sf_authored_segments (story_id, created_at, id);

ALTER TABLE public.sf_story_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sf_story_versions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.sf_story_version_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sf_story_version_revisions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.sf_authored_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sf_authored_segments FORCE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.sf_story_versions_enabled()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.sf_story_feature_enabled('story_versions', ARRAY['student', 'mentor', 'admin'])
$$;

CREATE OR REPLACE FUNCTION public.sf_can_read_story_versions(p_story_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.sf_story_versions_enabled()
    AND EXISTS (
      SELECT 1
      FROM public.sf_stories story
      WHERE story.id = p_story_id
        AND (
          story.student_id = public.sf_actor_id()
          OR (
            public.sf_actor_role() = 'mentor'
            AND story.archived_at IS NULL
            AND EXISTS (
              SELECT 1 FROM public.sf_mentor_assignments assignment
              WHERE assignment.student_id = story.student_id
                AND assignment.mentor_id = public.sf_actor_id()
                AND assignment.active
            )
            AND (
              story.status <> 'private'
              OR (
                coalesce(story.visibility, 'private') = 'mentor_visible'
                AND EXISTS (
                  SELECT 1
                  FROM public.sf_feature_flags flag
                  JOIN public.sf_users student ON student.id = story.student_id
                  WHERE flag.key = 'visibility_consent'
                    AND student.role = 'student'
                    AND student.eligible
                    AND (
                      flag.scope = 'eligible_all'
                      OR (flag.scope = 'allowlist' AND student.id = ANY(flag.allowlist))
                      OR (
                        flag.scope = 'cohort'
                        AND student.cohort IS NOT NULL
                        AND student.cohort = ANY(flag.cohorts)
                      )
                    )
                )
              )
            )
          )
          OR (
            public.sf_actor_role() = 'admin'
            AND public.sf_actor_admin_mode()
            AND story.archived_at IS NULL
            AND (
              story.status <> 'private'
              OR (
                coalesce(story.visibility, 'private') = 'mentor_visible'
                AND EXISTS (
                  SELECT 1
                  FROM public.sf_feature_flags flag
                  JOIN public.sf_users student ON student.id = story.student_id
                  WHERE flag.key = 'visibility_consent'
                    AND student.role = 'student'
                    AND student.eligible
                    AND (
                      flag.scope = 'eligible_all'
                      OR (flag.scope = 'allowlist' AND student.id = ANY(flag.allowlist))
                      OR (
                        flag.scope = 'cohort'
                        AND student.cohort IS NOT NULL
                        AND student.cohort = ANY(flag.cohorts)
                      )
                    )
                )
              )
            )
          )
        )
    )
$$;

CREATE POLICY sf_story_versions_read ON public.sf_story_versions
FOR SELECT TO authenticated
USING (public.sf_can_read_story_versions(story_id));

CREATE POLICY sf_story_version_revisions_read ON public.sf_story_version_revisions
FOR SELECT TO authenticated
USING (public.sf_can_read_story_versions(story_id));

CREATE POLICY sf_authored_segments_read ON public.sf_authored_segments
FOR SELECT TO authenticated
USING (public.sf_can_read_story_versions(story_id));

REVOKE ALL ON public.sf_story_versions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.sf_story_version_revisions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.sf_authored_segments FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.sf_story_versions TO authenticated;
GRANT SELECT ON public.sf_story_version_revisions TO authenticated;
GRANT SELECT ON public.sf_authored_segments TO authenticated;

-- Purposeful-version voice uses the proven recorder/assembly/storage pipeline,
-- but must not call sf_attach_recording: that older RPC owns the immutable
-- first-audio-original transition. This bounded sink associates one assembled
-- recording with an existing owned story without changing capture_type,
-- sf_story_originals, story text, visibility, submission, or row_version.
CREATE OR REPLACE FUNCTION public.sf_attach_version_recording(
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
  IF NOT public.sf_story_versions_enabled()
    OR NOT public.sf_has_live_identity(ARRAY['student']) THEN
    RAISE EXCEPTION 'story versions are unavailable' USING ERRCODE='42501';
  END IF;
  IF p_content_type NOT IN ('audio/webm','audio/mp4','audio/ogg','audio/wav') THEN
    RAISE EXCEPTION 'audio content type not permitted' USING ERRCODE='22023';
  END IF;

  SELECT * INTO v_story
  FROM public.sf_stories story
  WHERE story.id=p_story_id
    AND story.student_id=public.sf_actor_id()
    AND story.archived_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'story not found' USING ERRCODE='P0002'; END IF;

  SELECT * INTO v_session
  FROM public.sf_recording_sessions session
  WHERE session.id=p_session_id AND session.student_id=public.sf_actor_id()
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'recording session not found' USING ERRCODE='P0002'; END IF;

  IF v_session.state='attached' THEN
    IF v_session.story_id=p_story_id AND v_session.assembled_asset_id IS NOT NULL THEN
      SELECT object_key INTO v_existing_key
      FROM public.sf_audio_assets
      WHERE id=v_session.assembled_asset_id
        AND story_id=p_story_id
        AND student_id=public.sf_actor_id()
        AND state IN ('pending','uploaded','verified');
      IF v_existing_key IS NULL THEN
        RAISE EXCEPTION 'recording attachment is unavailable' USING ERRCODE='P0002';
      END IF;
      RETURN QUERY SELECT v_session.assembled_asset_id,v_existing_key;
      RETURN;
    END IF;
    RAISE EXCEPTION 'recording already attached elsewhere' USING ERRCODE='42501';
  END IF;
  IF v_session.state<>'assembled' OR v_session.story_id IS NOT NULL OR v_session.assembled_asset_id IS NOT NULL THEN
    RAISE EXCEPTION 'recording is not ready to attach' USING ERRCODE='23514';
  END IF;

  v_key := 'storyforge-audio/' || v_story.student_id || '/' || v_story.id || '/' || v_asset_id;
  INSERT INTO public.sf_audio_assets(id,story_id,student_id,object_key,content_type,state)
  VALUES(v_asset_id,p_story_id,v_story.student_id,v_key,p_content_type,'pending');
  UPDATE public.sf_recording_sessions
  SET state='attached',story_id=p_story_id,assembled_asset_id=v_asset_id,updated_at=now()
  WHERE id=p_session_id;
  PERFORM public.sf_append_voice_audit(
    'audio_attached','recording_session',p_session_id,'quick',
    public.sf_actor_id(),p_story_id,
    jsonb_build_object('state','assembled'),
    jsonb_build_object('state','attached')
  );
  RETURN QUERY SELECT v_asset_id,v_key;
END
$$;

REVOKE ALL ON FUNCTION public.sf_attach_version_recording(uuid,uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sf_attach_version_recording(uuid,uuid,text) TO authenticated;

-- A verified purposeful-version asset may be retired only before any current
-- version, immutable revision, or authored-segment provenance references it.
-- This closes the ambiguous-save race without weakening the student's ability
-- to discard an attached-but-unsaved recording.
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
    RAISE EXCEPTION 'eligible student identity required' USING ERRCODE='42501';
  END IF;
  SELECT * INTO v_asset
  FROM public.sf_audio_assets asset
  WHERE asset.id=p_asset_id AND asset.student_id=public.sf_actor_id()
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'audio asset not found' USING ERRCODE='P0002'; END IF;
  IF v_asset.state='retired' THEN
    RETURN QUERY SELECT v_asset.object_key,v_asset.story_id,false;
    RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM public.sf_story_originals WHERE audio_asset_id=p_asset_id)
    OR EXISTS (SELECT 1 FROM public.sf_story_versions WHERE audio_asset_id=p_asset_id)
    OR EXISTS (SELECT 1 FROM public.sf_story_version_revisions WHERE audio_asset_id=p_asset_id)
    OR EXISTS (SELECT 1 FROM public.sf_authored_segments WHERE audio_asset_id=p_asset_id) THEN
    RAISE EXCEPTION 'audio asset is preserved by story version history' USING ERRCODE='23503';
  END IF;
  PERFORM public.sf_append_voice_audit(
    'audio_deleted','audio_asset',p_asset_id,'library',
    public.sf_actor_id(),v_asset.story_id,
    jsonb_build_object('state',v_asset.state),
    jsonb_build_object('state','retired')
  );
  UPDATE public.sf_audio_assets SET state='retired' WHERE id=p_asset_id;
  DELETE FROM public.sf_recording_segments segment
  USING public.sf_recording_sessions session
  WHERE session.assembled_asset_id=p_asset_id AND segment.session_id=session.id;
  UPDATE public.sf_recording_sessions
  SET segment_count=0,updated_at=now()
  WHERE assembled_asset_id=p_asset_id;
  RETURN QUERY SELECT v_asset.object_key,v_asset.story_id,true;
END
$$;

-- Purposeful-version audio is finalized before the version body is committed.
-- A durable, service-only intent closes the narrow crash window without ever
-- retiring audio that became referenced by an Original, version, revision, or
-- authored provenance segment. Claiming first retires the unreferenced asset,
-- so a concurrent late save cannot create a dangling reference after deletion.
CREATE TABLE public.sf_version_audio_cleanup_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL UNIQUE REFERENCES public.sf_audio_assets(id) ON DELETE RESTRICT,
  object_key text NOT NULL,
  state text NOT NULL DEFAULT 'intended'
    CHECK (state IN ('intended','resolved','failed')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 3),
  last_error_category text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  CHECK (
    (state='intended' AND resolved_at IS NULL)
    OR (state IN ('resolved','failed') AND resolved_at IS NOT NULL)
  )
);

ALTER TABLE public.sf_version_audio_cleanup_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sf_version_audio_cleanup_intents FORCE ROW LEVEL SECURITY;
CREATE POLICY sf_version_audio_cleanup_service
ON public.sf_version_audio_cleanup_intents
FOR ALL TO storyforge_app USING (true) WITH CHECK (true);
REVOKE ALL ON public.sf_version_audio_cleanup_intents FROM PUBLIC, anon, authenticated, storyforge_app;

CREATE OR REPLACE FUNCTION public.sf_claim_version_audio_cleanup(p_limit integer DEFAULT 20)
RETURNS TABLE (
  intent_id uuid,
  asset_id uuid,
  object_key text,
  content_type text,
  segment_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_limit integer := greatest(1, least(coalesce(p_limit,20),100));
  v_claimed integer := 0;
  candidate record;
BEGIN
  -- Retry durable intents first. Their assets were already made unavailable
  -- before the original object deletion attempt.
  FOR candidate IN
    SELECT intent.id AS intent_id, asset.id AS asset_id, intent.object_key,
           asset.content_type, session.segment_count
    FROM public.sf_version_audio_cleanup_intents intent
    JOIN public.sf_audio_assets asset ON asset.id=intent.asset_id
    JOIN public.sf_recording_sessions session ON session.assembled_asset_id=asset.id
    WHERE intent.state='intended' AND intent.attempts < 3
    ORDER BY intent.created_at
    FOR UPDATE OF intent SKIP LOCKED
    LIMIT v_limit
  LOOP
    UPDATE public.sf_version_audio_cleanup_intents
    SET attempts=attempts+1, updated_at=now()
    WHERE id=candidate.intent_id;
    intent_id := candidate.intent_id;
    asset_id := candidate.asset_id;
    object_key := candidate.object_key;
    content_type := candidate.content_type;
    segment_count := candidate.segment_count;
    v_claimed := v_claimed+1;
    RETURN NEXT;
  END LOOP;

  IF v_claimed >= v_limit THEN RETURN; END IF;

  FOR candidate IN
    SELECT asset.id AS asset_id, asset.object_key, asset.content_type,
           session.segment_count
    FROM public.sf_audio_assets asset
    JOIN public.sf_recording_sessions session
      ON session.assembled_asset_id=asset.id AND session.state='attached'
    WHERE asset.state='verified'
      AND asset.verified_at < now() - interval '24 hours'
      AND NOT EXISTS (SELECT 1 FROM public.sf_story_originals original WHERE original.audio_asset_id=asset.id)
      AND NOT EXISTS (SELECT 1 FROM public.sf_story_versions version WHERE version.audio_asset_id=asset.id)
      AND NOT EXISTS (SELECT 1 FROM public.sf_story_version_revisions revision WHERE revision.audio_asset_id=asset.id)
      AND NOT EXISTS (SELECT 1 FROM public.sf_authored_segments segment WHERE segment.audio_asset_id=asset.id)
      AND NOT EXISTS (SELECT 1 FROM public.sf_version_audio_cleanup_intents intent WHERE intent.asset_id=asset.id)
    ORDER BY asset.verified_at, asset.id
    FOR UPDATE OF asset SKIP LOCKED
    LIMIT (v_limit-v_claimed)
  LOOP
    INSERT INTO public.sf_version_audio_cleanup_intents(asset_id,object_key,attempts)
    VALUES(candidate.asset_id,candidate.object_key,1)
    RETURNING id INTO intent_id;
    UPDATE public.sf_audio_assets SET state='retired' WHERE id=candidate.asset_id;
    asset_id := candidate.asset_id;
    object_key := candidate.object_key;
    content_type := candidate.content_type;
    segment_count := candidate.segment_count;
    RETURN NEXT;
  END LOOP;
END
$$;

CREATE OR REPLACE FUNCTION public.sf_complete_version_audio_cleanup(
  p_intent_id uuid,
  p_succeeded boolean,
  p_error_category text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_error_category IS NOT NULL AND p_error_category !~ '^[a-z_]{1,48}$' THEN
    RAISE EXCEPTION 'invalid cleanup error category' USING ERRCODE='22023';
  END IF;
  UPDATE public.sf_version_audio_cleanup_intents
  SET state=CASE WHEN p_succeeded THEN 'resolved' WHEN attempts>=3 THEN 'failed' ELSE 'intended' END,
      last_error_category=CASE WHEN p_succeeded THEN NULL ELSE coalesce(p_error_category,'object_delete_failed') END,
      resolved_at=CASE WHEN p_succeeded OR attempts>=3 THEN now() ELSE NULL END,
      updated_at=now()
  WHERE id=p_intent_id AND state='intended';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'cleanup intent not found' USING ERRCODE='P0002';
  END IF;
END
$$;

REVOKE ALL ON FUNCTION public.sf_claim_version_audio_cleanup(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sf_complete_version_audio_cleanup(uuid,boolean,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sf_claim_version_audio_cleanup(integer) TO storyforge_app;
GRANT EXECUTE ON FUNCTION public.sf_complete_version_audio_cleanup(uuid,boolean,text) TO storyforge_app;

REVOKE ALL ON FUNCTION public.sf_retire_story_audio(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sf_retire_story_audio(uuid) TO authenticated;

INSERT INTO public.sf_feature_flags (key, scope, allowlist, cohorts, updated_by)
SELECT feature.key, 'off', ARRAY[]::uuid[], ARRAY[]::text[], founder.updated_by
FROM (VALUES ('story_versions'), ('story_followup')) AS feature(key)
CROSS JOIN (
  SELECT updated_by FROM public.sf_feature_flags WHERE key = 'admin_console'
) founder;

CREATE OR REPLACE FUNCTION public.sf_list_story_versions(p_story_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_payload jsonb;
BEGIN
  IF NOT public.sf_can_read_story_versions(p_story_id) THEN
    RAISE EXCEPTION 'story not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT jsonb_build_object(
    'versions', coalesce(jsonb_agg(jsonb_build_object(
      'id', version.id,
      'key', version.version_key,
      'body', version.body,
      'source', version.source,
      'recordingId', version.recording_id,
      'audioAssetId', version.audio_asset_id,
      'rowVersion', version.row_version,
      'createdAt', version.created_at,
      'updatedAt', version.updated_at,
      'history', (
        SELECT coalesce(jsonb_agg(jsonb_build_object(
          'id', revision.id,
          'body', revision.body,
          'source', revision.source,
          'recordingId', revision.recording_id,
          'audioAssetId', revision.audio_asset_id,
          'savedAt', revision.saved_at
        ) ORDER BY revision.created_at DESC, revision.id DESC), '[]'::jsonb)
        FROM (
          SELECT * FROM public.sf_story_version_revisions prior
          WHERE prior.version_id = version.id
          ORDER BY prior.created_at DESC, prior.id DESC
          LIMIT 50
        ) revision
      )
    ) ORDER BY version.version_key), '[]'::jsonb)
  ) INTO v_payload
  FROM public.sf_story_versions version
  WHERE version.story_id = p_story_id;
  RETURN v_payload;
END
$$;

CREATE OR REPLACE FUNCTION public.sf_save_story_version(
  p_story_id uuid,
  p_version_key text,
  p_body text,
  p_mode text,
  p_source text,
  p_expected_version bigint,
  p_recording_id uuid DEFAULT NULL,
  p_audio_asset_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_story public.sf_stories;
  v_before public.sf_story_versions;
  v_after public.sf_story_versions;
  v_audit_id bigint;
BEGIN
  IF NOT public.sf_story_versions_enabled()
    OR NOT public.sf_has_live_identity(ARRAY['student']) THEN
    RAISE EXCEPTION 'story versions are unavailable' USING ERRCODE = '42501';
  END IF;
  IF p_version_key NOT IN ('thirty_second', 'nnq_setup')
    OR p_mode NOT IN ('save', 'append', 'retell')
    OR p_source NOT IN ('typed', 'voice')
    OR p_expected_version < 0
    OR length(coalesce(p_body, '')) > 20000
    OR (p_mode <> 'retell' AND length(trim(coalesce(p_body, ''))) < 1) THEN
    RAISE EXCEPTION 'invalid story version mutation' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_story FROM public.sf_stories
  WHERE id = p_story_id AND student_id = public.sf_actor_id() AND archived_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'story not found' USING ERRCODE = 'P0002'; END IF;

  IF p_source = 'typed' AND (p_recording_id IS NOT NULL OR p_audio_asset_id IS NOT NULL) THEN
    RAISE EXCEPTION 'typed story versions cannot claim audio provenance' USING ERRCODE = '22023';
  END IF;
  IF p_source = 'voice' AND (p_recording_id IS NULL OR p_audio_asset_id IS NULL) THEN
    RAISE EXCEPTION 'voice story versions require recording and audio provenance' USING ERRCODE = '22023';
  END IF;
  IF p_source = 'voice' AND NOT EXISTS (
    SELECT 1
    FROM public.sf_recording_sessions recording
    JOIN public.sf_audio_assets audio ON audio.id = recording.assembled_asset_id
    WHERE recording.id = p_recording_id
      AND recording.student_id = v_story.student_id
      AND recording.story_id = v_story.id
      AND recording.state = 'attached'
      AND audio.id = p_audio_asset_id
      AND audio.student_id = v_story.student_id
      AND audio.story_id = v_story.id
      AND audio.state = 'verified'
  ) THEN
    RAISE EXCEPTION 'voice provenance does not belong to this story' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_before FROM public.sf_story_versions
  WHERE story_id = p_story_id AND version_key = p_version_key
  FOR UPDATE;

  IF NOT FOUND THEN
    IF p_expected_version <> 0 THEN
      RAISE EXCEPTION 'story version conflict' USING ERRCODE = '40001';
    END IF;
    INSERT INTO public.sf_story_versions (
      story_id, version_key, body, source, recording_id, audio_asset_id
    ) VALUES (
      p_story_id, p_version_key, coalesce(p_body, ''), p_source, p_recording_id, p_audio_asset_id
    ) RETURNING * INTO v_after;
  ELSE
    IF v_before.row_version <> p_expected_version THEN
      RAISE EXCEPTION 'story version conflict' USING ERRCODE = '40001';
    END IF;
    IF v_before.body IS DISTINCT FROM coalesce(p_body, '')
      OR v_before.source IS DISTINCT FROM p_source
      OR v_before.recording_id IS DISTINCT FROM p_recording_id
      OR v_before.audio_asset_id IS DISTINCT FROM p_audio_asset_id THEN
      INSERT INTO public.sf_story_version_revisions (
        version_id, story_id, body, source, recording_id, audio_asset_id,
        saved_at, actor_user_id
      ) VALUES (
        v_before.id, v_before.story_id, v_before.body, v_before.source,
        v_before.recording_id, v_before.audio_asset_id, v_before.updated_at,
        public.sf_actor_id()
      );
      UPDATE public.sf_story_versions
      SET body = coalesce(p_body, ''), source = p_source,
          recording_id = p_recording_id, audio_asset_id = p_audio_asset_id,
          row_version = row_version + 1, updated_at = now()
      WHERE id = v_before.id
      RETURNING * INTO v_after;
    ELSE
      v_after := v_before;
    END IF;
  END IF;

  IF v_before.id IS NULL OR v_before.body IS DISTINCT FROM v_after.body THEN
    INSERT INTO public.sf_authored_segments (
      story_id, story_version_id, source_role, source_entity_type,
      source_entity_id, body_hash, recording_id, audio_asset_id, author_id
    ) VALUES (
      v_after.story_id, v_after.id,
      CASE WHEN p_source = 'voice' THEN 'student_spoken' ELSE 'student_typed' END,
      'story_version', v_after.id, encode(digest(convert_to(v_after.body, 'UTF8'), 'sha256'), 'hex'),
      p_recording_id, p_audio_asset_id, public.sf_actor_id()
    );
  END IF;

  SELECT public.sf_append_audit(
    'story.version_edited', 'story_version', v_after.id, 'workspace',
    v_story.student_id, v_story.id,
    NULL,
    CASE WHEN v_before.id IS NULL THEN NULL ELSE jsonb_build_object('key', v_before.version_key, 'rowVersion', v_before.row_version) END,
    jsonb_build_object('key', v_after.version_key, 'rowVersion', v_after.row_version, 'mode', p_mode)
  ) INTO v_audit_id;

  RETURN jsonb_build_object(
    'id', v_after.id, 'key', v_after.version_key, 'body', v_after.body,
    'source', v_after.source, 'recordingId', v_after.recording_id,
    'audioAssetId', v_after.audio_asset_id, 'rowVersion', v_after.row_version,
    'createdAt', v_after.created_at, 'updatedAt', v_after.updated_at,
    'auditEventId', v_audit_id::text
  );
END
$$;

CREATE OR REPLACE FUNCTION public.sf_restore_story_version(
  p_story_id uuid,
  p_version_key text,
  p_revision_id uuid,
  p_expected_version bigint
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_story public.sf_stories;
  v_before public.sf_story_versions;
  v_restore public.sf_story_version_revisions;
  v_after public.sf_story_versions;
  v_audit_id bigint;
BEGIN
  IF NOT public.sf_story_versions_enabled()
    OR NOT public.sf_has_live_identity(ARRAY['student']) THEN
    RAISE EXCEPTION 'story versions are unavailable' USING ERRCODE = '42501';
  END IF;
  IF p_version_key NOT IN ('thirty_second', 'nnq_setup') OR p_expected_version < 0 THEN
    RAISE EXCEPTION 'invalid story version restore' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_story FROM public.sf_stories
  WHERE id = p_story_id AND student_id = public.sf_actor_id() AND archived_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'story not found' USING ERRCODE = 'P0002'; END IF;
  SELECT * INTO v_before FROM public.sf_story_versions
  WHERE story_id = p_story_id AND version_key = p_version_key
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'story version not found' USING ERRCODE = 'P0002'; END IF;
  IF v_before.row_version <> p_expected_version THEN
    RAISE EXCEPTION 'story version conflict' USING ERRCODE = '40001';
  END IF;
  SELECT * INTO v_restore FROM public.sf_story_version_revisions
  WHERE id = p_revision_id AND version_id = v_before.id AND story_id = p_story_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'earlier telling not found' USING ERRCODE = 'P0002'; END IF;

  INSERT INTO public.sf_story_version_revisions (
    version_id, story_id, body, source, recording_id, audio_asset_id,
    saved_at, actor_user_id
  ) VALUES (
    v_before.id, v_before.story_id, v_before.body, v_before.source,
    v_before.recording_id, v_before.audio_asset_id, v_before.updated_at,
    public.sf_actor_id()
  );
  UPDATE public.sf_story_versions
  SET body = v_restore.body, source = v_restore.source,
      recording_id = v_restore.recording_id, audio_asset_id = v_restore.audio_asset_id,
      row_version = row_version + 1, updated_at = now()
  WHERE id = v_before.id
  RETURNING * INTO v_after;

  INSERT INTO public.sf_authored_segments (
    story_id, story_version_id, source_role, source_entity_type,
    source_entity_id, body_hash, recording_id, audio_asset_id, author_id
  ) VALUES (
    v_after.story_id, v_after.id,
    CASE WHEN v_after.source='voice' THEN 'student_spoken' ELSE 'student_typed' END,
    'story_version', p_revision_id,
    encode(digest(convert_to(v_after.body,'UTF8'),'sha256'),'hex'),
    v_after.recording_id, v_after.audio_asset_id, public.sf_actor_id()
  );

  SELECT public.sf_append_audit(
    'story.version_restored', 'story_version', v_after.id, 'workspace',
    v_story.student_id, v_story.id,
    NULL,
    jsonb_build_object('key', v_before.version_key, 'rowVersion', v_before.row_version),
    jsonb_build_object('key', v_after.version_key, 'rowVersion', v_after.row_version, 'revisionId', p_revision_id)
  ) INTO v_audit_id;
  RETURN jsonb_build_object(
    'id', v_after.id, 'key', v_after.version_key, 'body', v_after.body,
    'source', v_after.source, 'recordingId', v_after.recording_id,
    'audioAssetId', v_after.audio_asset_id, 'rowVersion', v_after.row_version,
    'createdAt', v_after.created_at, 'updatedAt', v_after.updated_at,
    'auditEventId', v_audit_id::text
  );
END
$$;

REVOKE ALL ON FUNCTION public.sf_story_versions_enabled() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sf_forbid_story_version_history_mutation() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sf_can_read_story_versions(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sf_list_story_versions(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sf_save_story_version(uuid, text, text, text, text, bigint, uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sf_restore_story_version(uuid, text, uuid, bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sf_story_versions_enabled() TO authenticated;
GRANT EXECUTE ON FUNCTION public.sf_can_read_story_versions(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sf_list_story_versions(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sf_save_story_version(uuid, text, text, text, text, bigint, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sf_restore_story_version(uuid, text, uuid, bigint) TO authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.sf_story_versions)
    OR EXISTS (SELECT 1 FROM public.sf_story_version_revisions)
    OR EXISTS (SELECT 1 FROM public.sf_authored_segments) THEN
    RAISE EXCEPTION 'B1-514 R2 additive tables must begin empty';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.sf_stories
    WHERE visibility IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'B1-514 R2 refuses historical visibility widening';
  END IF;
END
$$;

COMMIT;
