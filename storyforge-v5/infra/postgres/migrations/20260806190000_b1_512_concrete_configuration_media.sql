\set ON_ERROR_STOP on

-- Migration: B1-512 StoryForge concrete configuration and private story media.
-- Authority: Founder B1-512 Stage 1 only.
-- Depends on: 20260806130000_b1_511a_wordpress_admin_authority.sql
-- Reversibility: forward-safe feature disable; no emergency rollback drops private data.

BEGIN;

ALTER TABLE public.sf_users
  ADD COLUMN IF NOT EXISTS reading_size_preference text NOT NULL DEFAULT 'standard';

ALTER TABLE public.sf_users
  DROP CONSTRAINT IF EXISTS sf_users_reading_size_preference_check;

ALTER TABLE public.sf_users
  ADD CONSTRAINT sf_users_reading_size_preference_check
  CHECK (reading_size_preference IN ('standard', 'large', 'extra_large'));

CREATE OR REPLACE FUNCTION public.sf_set_reading_size_preference(p_size text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_size text := lower(trim(coalesce(p_size, '')));
BEGIN
  IF NOT public.sf_has_live_identity() THEN
    RAISE EXCEPTION 'eligible StoryForge identity required' USING ERRCODE = '42501';
  END IF;
  IF v_size NOT IN ('standard', 'large', 'extra_large') THEN
    RAISE EXCEPTION 'unsupported StoryForge reading-size preference' USING ERRCODE = '22023';
  END IF;

  UPDATE public.sf_users
  SET reading_size_preference = v_size,
      updated_at = now()
  WHERE id = public.sf_actor_id()
  RETURNING reading_size_preference INTO v_size;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'StoryForge profile is unavailable' USING ERRCODE = '42501';
  END IF;
  RETURN v_size;
END
$$;

REVOKE ALL ON FUNCTION public.sf_set_reading_size_preference(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sf_set_reading_size_preference(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.sf_valid_storyforge_taxonomy_ids(p_values text[], p_maximum integer)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT cardinality(coalesce(p_values, ARRAY[]::text[])) <= p_maximum
    AND NOT EXISTS (
      SELECT 1
      FROM unnest(coalesce(p_values, ARRAY[]::text[])) value
      WHERE value !~ '^(?:[a-z][a-z0-9_]{0,63}|[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12})$'
    )
$$;

ALTER TABLE public.sf_stories DROP CONSTRAINT IF EXISTS sf_stories_categories_check;
ALTER TABLE public.sf_stories DROP CONSTRAINT IF EXISTS sf_stories_uses_check;
ALTER TABLE public.sf_stories
  ADD CONSTRAINT sf_stories_categories_check
  CHECK (public.sf_valid_storyforge_taxonomy_ids(categories, 50));
ALTER TABLE public.sf_stories
  ADD CONSTRAINT sf_stories_uses_check
  CHECK (public.sf_valid_storyforge_taxonomy_ids(uses, 30));

ALTER TABLE public.sf_use_suggestions DROP CONSTRAINT IF EXISTS sf_use_suggestions_use_key_check;
ALTER TABLE public.sf_use_suggestions
  ADD CONSTRAINT sf_use_suggestions_use_key_check
  CHECK (public.sf_valid_storyforge_taxonomy_ids(ARRAY[use_key], 1));

CREATE TABLE IF NOT EXISTS public.sf_storyforge_configuration (
  id uuid PRIMARY KEY,
  key text NOT NULL UNIQUE CHECK (key = 'content_display'),
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  row_version bigint NOT NULL DEFAULT 0 CHECK (row_version >= 0),
  updated_by uuid REFERENCES public.sf_users(id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sf_storyforge_configuration_history (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  configuration_id uuid NOT NULL REFERENCES public.sf_storyforge_configuration(id) ON DELETE RESTRICT,
  version bigint NOT NULL CHECK (version >= 0),
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  action text NOT NULL CHECK (action IN ('initial', 'publish', 'restore_default')),
  actor_id uuid REFERENCES public.sf_users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (configuration_id, version)
);

ALTER TABLE public.sf_storyforge_configuration ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sf_storyforge_configuration FORCE ROW LEVEL SECURITY;
ALTER TABLE public.sf_storyforge_configuration_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sf_storyforge_configuration_history FORCE ROW LEVEL SECURITY;

INSERT INTO public.sf_storyforge_configuration (id, key, payload, row_version)
VALUES (
  '51200000-0000-4512-8512-000000000001'::uuid,
  'content_display',
  '{
    "taxonomy": {
      "categories": [
        {"id":"clinical","label":"Clinical","sortOrder":10,"state":"active","builtin":true},
        {"id":"personal","label":"Personal","sortOrder":20,"state":"active","builtin":true},
        {"id":"research","label":"Research","sortOrder":30,"state":"active","builtin":true},
        {"id":"leadership","label":"Leadership","sortOrder":40,"state":"active","builtin":true},
        {"id":"teaching","label":"Teaching","sortOrder":50,"state":"active","builtin":true},
        {"id":"volunteer_service","label":"Volunteer / Service","sortOrder":60,"state":"active","builtin":true},
        {"id":"adversity_challenge","label":"Adversity / Challenge","sortOrder":70,"state":"active","builtin":true},
        {"id":"teamwork","label":"Teamwork","sortOrder":80,"state":"active","builtin":true},
        {"id":"communication","label":"Communication","sortOrder":90,"state":"active","builtin":true},
        {"id":"ethics_professionalism","label":"Ethics / Professionalism","sortOrder":100,"state":"active","builtin":true},
        {"id":"other","label":"Other","sortOrder":110,"state":"active","builtin":true}
      ],
      "intendedUses": [
        {"id":"ps","label":"Personal Statement","sortOrder":10,"state":"active","builtin":true},
        {"id":"iv","label":"Interview Set","sortOrder":20,"state":"active","builtin":true},
        {"id":"letter","label":"Letter of Recommendation","sortOrder":30,"state":"active","builtin":true},
        {"id":"myeras_experiences","label":"MyERAS Experiences","sortOrder":40,"state":"active","builtin":true},
        {"id":"myeras_most_impactful","label":"MyERAS Most Impactful","sortOrder":50,"state":"active","builtin":true},
        {"id":"later","label":"Someday / Fellowship","sortOrder":60,"state":"active","builtin":true}
      ]
    },
    "sections": {
      "storyCategories":{"title":"Story categories","helper":"Categories describe what happened. They stay separate from themes and intended uses.","mode":"visible_optional"},
      "intendedUses":{"title":"Where this story could be used","helper":"Choose every application context where this story may help.","mode":"visible_optional"},
      "workingVersion":{"title":"Working version","helper":"Edit freely here. The original telling stays untouched, always.","mode":"visible_optional"},
      "learningLesson":{"title":"Learning Lesson","helper":"What this story taught you — the takeaway that travels with it.","mode":"visible_optional"},
      "reviewSubmission":{"title":"Submit for review","helper":"Submitting makes this story available to an authorized reviewer.","mode":"visible_optional"}
    },
    "navigation":{"interviewPrepVisible":false}
  }'::jsonb,
  0
)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.sf_storyforge_configuration_history (
  configuration_id, version, payload, action, actor_id
)
SELECT id, row_version, payload, 'initial', updated_by
FROM public.sf_storyforge_configuration
WHERE key = 'content_display'
ON CONFLICT (configuration_id, version) DO NOTHING;

CREATE OR REPLACE FUNCTION public.sf_get_storyforge_configuration()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT public.sf_has_live_identity() THEN
    RAISE EXCEPTION 'eligible StoryForge identity required' USING ERRCODE = '42501';
  END IF;
  SELECT jsonb_build_object(
    'payload', payload,
    'rowVersion', row_version,
    'updatedAt', updated_at,
    'updatedBy', updated_by
  ) INTO v_result
  FROM public.sf_storyforge_configuration
  WHERE key = 'content_display';
  RETURN v_result;
END
$$;

CREATE OR REPLACE FUNCTION public.sf_publish_storyforge_configuration(
  p_payload jsonb,
  p_expected_version bigint,
  p_action text DEFAULT 'publish'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_before public.sf_storyforge_configuration;
  v_after public.sf_storyforge_configuration;
BEGIN
  IF NOT public.sf_has_live_identity(ARRAY['admin']) THEN
    RAISE EXCEPTION 'eligible administrator identity required' USING ERRCODE = '42501';
  END IF;
  IF p_action NOT IN ('publish', 'restore_default') THEN
    RAISE EXCEPTION 'invalid configuration action' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(p_payload) <> 'object'
     OR jsonb_typeof(p_payload->'taxonomy') <> 'object'
     OR jsonb_typeof(p_payload->'sections') <> 'object'
     OR jsonb_typeof(p_payload->'navigation') <> 'object'
     OR jsonb_typeof(p_payload#>'{navigation,interviewPrepVisible}') <> 'boolean' THEN
    RAISE EXCEPTION 'invalid StoryForge configuration payload' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_before
  FROM public.sf_storyforge_configuration
  WHERE key = 'content_display'
  FOR UPDATE;
  IF v_before.row_version <> p_expected_version THEN
    RAISE EXCEPTION 'StoryForge configuration changed' USING ERRCODE = '40001';
  END IF;

  UPDATE public.sf_storyforge_configuration
  SET payload = p_payload,
      row_version = row_version + 1,
      updated_by = public.sf_actor_id(),
      updated_at = now()
  WHERE id = v_before.id
  RETURNING * INTO v_after;

  INSERT INTO public.sf_storyforge_configuration_history (
    configuration_id, version, payload, action, actor_id
  ) VALUES (v_after.id, v_after.row_version, v_after.payload, p_action, public.sf_actor_id());

  PERFORM public.sf_append_audit(
    'configuration.' || p_action,
    'storyforge_configuration',
    v_after.id,
    'system',
    NULL, NULL, NULL,
    jsonb_build_object('version', v_before.row_version),
    jsonb_build_object('version', v_after.row_version),
    NULL,
    'admin_only'
  );

  RETURN jsonb_build_object(
    'payload', v_after.payload,
    'rowVersion', v_after.row_version,
    'updatedAt', v_after.updated_at,
    'updatedBy', v_after.updated_by
  );
END
$$;

CREATE OR REPLACE FUNCTION public.sf_restore_storyforge_configuration(p_expected_version bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_default jsonb;
BEGIN
  SELECT payload INTO v_default
  FROM public.sf_storyforge_configuration_history
  WHERE configuration_id = '51200000-0000-4512-8512-000000000001'::uuid
    AND action = 'initial'
  ORDER BY version
  LIMIT 1;
  RETURN public.sf_publish_storyforge_configuration(v_default, p_expected_version, 'restore_default');
END
$$;

CREATE OR REPLACE FUNCTION public.sf_enforce_storyforge_submission_configuration()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_sections jsonb;
BEGIN
  IF NEW.status = 'awaiting' AND OLD.status IS DISTINCT FROM NEW.status THEN
    SELECT payload->'sections' INTO v_sections
    FROM public.sf_storyforge_configuration
    WHERE key = 'content_display';

    IF v_sections#>>'{workingVersion,mode}' = 'visible_required'
       AND length(trim(NEW.current_text)) < 3 THEN
      RAISE EXCEPTION 'Working version is required for submission' USING ERRCODE = '23514';
    END IF;
    IF v_sections#>>'{learningLesson,mode}' = 'visible_required'
       AND length(trim(NEW.lesson)) < 1 THEN
      RAISE EXCEPTION 'Learning Lesson is required for submission' USING ERRCODE = '23514';
    END IF;
    IF v_sections#>>'{storyCategories,mode}' = 'visible_required'
       AND cardinality(NEW.categories) = 0 THEN
      RAISE EXCEPTION 'Story category is required for submission' USING ERRCODE = '23514';
    END IF;
    IF v_sections#>>'{intendedUses,mode}' = 'visible_required'
       AND cardinality(NEW.uses) = 0 THEN
      RAISE EXCEPTION 'Intended use is required for submission' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS sf_storyforge_submission_configuration_guard ON public.sf_stories;
CREATE TRIGGER sf_storyforge_submission_configuration_guard
BEFORE UPDATE OF status ON public.sf_stories
FOR EACH ROW
EXECUTE FUNCTION public.sf_enforce_storyforge_submission_configuration();

CREATE OR REPLACE FUNCTION public.sf_update_story_taxonomy_configured(
  p_story_id uuid,
  p_expected_version bigint,
  p_categories text[],
  p_uses text[],
  p_surface text DEFAULT 'workspace',
  p_admin boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_before public.sf_stories;
  v_after public.sf_stories;
  v_categories text[];
  v_uses text[];
  v_config jsonb;
BEGIN
  IF p_admin THEN
    PERFORM public.sf_admin_assert_enabled();
    IF NOT public.sf_story_feature_enabled('story_taxonomy', ARRAY['admin']) OR p_surface NOT IN ('workspace', 'quick') THEN
      RAISE EXCEPTION 'administrator story taxonomy is unavailable' USING ERRCODE = '42501';
    END IF;
    SELECT * INTO v_before FROM public.sf_stories
    WHERE id = p_story_id AND status <> 'private' AND archived_at IS NULL FOR UPDATE;
  ELSE
    IF NOT public.sf_story_feature_enabled('story_taxonomy', ARRAY['student']) OR p_surface NOT IN ('library', 'workspace') THEN
      RAISE EXCEPTION 'story taxonomy is unavailable' USING ERRCODE = '42501';
    END IF;
    SELECT * INTO v_before FROM public.sf_stories
    WHERE id = p_story_id AND student_id = public.sf_actor_id() AND archived_at IS NULL FOR UPDATE;
  END IF;
  IF NOT FOUND THEN RAISE EXCEPTION 'story not found' USING ERRCODE = 'P0002'; END IF;
  IF p_expected_version IS NULL OR p_expected_version <> v_before.row_version THEN
    RAISE EXCEPTION 'story version conflict' USING ERRCODE = '40001';
  END IF;
  SELECT coalesce(array_agg(value ORDER BY value), ARRAY[]::text[]) INTO v_categories
  FROM (SELECT DISTINCT lower(trim(value)) value FROM unnest(coalesce(p_categories, ARRAY[]::text[])) value) normalized WHERE value <> '';
  SELECT coalesce(array_agg(value ORDER BY value), ARRAY[]::text[]) INTO v_uses
  FROM (SELECT DISTINCT lower(trim(value)) value FROM unnest(coalesce(p_uses, ARRAY[]::text[])) value) normalized WHERE value <> '';
  SELECT payload INTO v_config FROM public.sf_storyforge_configuration WHERE key = 'content_display';
  IF EXISTS (
    SELECT 1 FROM unnest(v_categories) AS requested(value)
    WHERE requested.value <> ALL(v_before.categories)
      AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_config#>'{taxonomy,categories}') AS entry
        WHERE entry->>'id' = requested.value AND entry->>'state' = 'active')
  ) OR EXISTS (
    SELECT 1 FROM unnest(v_uses) AS requested(value)
    WHERE requested.value <> ALL(v_before.uses)
      AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_config#>'{taxonomy,intendedUses}') AS entry
        WHERE entry->>'id' = requested.value AND entry->>'state' = 'active')
  ) THEN
    RAISE EXCEPTION 'StoryForge taxonomy value is not active' USING ERRCODE = '22023';
  END IF;
  UPDATE public.sf_stories SET categories = v_categories, uses = v_uses,
    row_version = row_version + 1, updated_at = now(),
    student_updated_at = CASE WHEN p_admin THEN student_updated_at ELSE now() END
  WHERE id = p_story_id RETURNING * INTO v_after;
  PERFORM public.sf_append_audit(
    CASE WHEN p_admin THEN 'admin.story_taxonomy_updated' ELSE 'story.taxonomy_updated' END,
    'story', p_story_id, p_surface, v_before.student_id, p_story_id, NULL,
    jsonb_build_object('categories', v_before.categories, 'uses', v_before.uses, 'row_version', v_before.row_version),
    jsonb_build_object('categories', v_after.categories, 'uses', v_after.uses, 'row_version', v_after.row_version),
    NULL, 'both'
  );
  RETURN jsonb_build_object('id', v_after.id, 'categories', to_jsonb(v_after.categories),
    'uses', to_jsonb(v_after.uses), 'rowVersion', v_after.row_version, 'updatedAt', v_after.updated_at);
END
$$;

CREATE TABLE public.sf_story_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id uuid NOT NULL REFERENCES public.sf_stories(id) ON DELETE RESTRICT,
  student_id uuid NOT NULL REFERENCES public.sf_users(id) ON DELETE RESTRICT,
  media_kind text NOT NULL CHECK (media_kind IN ('photo', 'video')),
  mime_type text NOT NULL CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm')),
  byte_size bigint NOT NULL CHECK (byte_size BETWEEN 1 AND 52428800),
  duration_ms integer CHECK (duration_ms IS NULL OR duration_ms BETWEEN 1 AND 60000),
  caption text NOT NULL DEFAULT '' CHECK (length(caption) <= 240 AND caption !~ '[<>]'),
  sort_order integer NOT NULL DEFAULT 10 CHECK (sort_order BETWEEN 0 AND 10000),
  object_key text UNIQUE,
  upload_object_key text NOT NULL UNIQUE,
  etag text,
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'verified', 'delete_pending', 'deleted')),
  row_version bigint NOT NULL DEFAULT 0 CHECK (row_version >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  verified_at timestamptz,
  removed_at timestamptz,
  CHECK ((media_kind = 'photo' AND mime_type LIKE 'image/%' AND duration_ms IS NULL AND byte_size <= 5242880)
      OR (media_kind = 'video' AND mime_type LIKE 'video/%')),
  CHECK ((state = 'verified' AND object_key IS NOT NULL AND verified_at IS NOT NULL AND removed_at IS NULL)
      OR (state = 'pending' AND object_key IS NULL AND verified_at IS NULL AND removed_at IS NULL)
      OR (state IN ('delete_pending', 'deleted') AND removed_at IS NOT NULL))
);

CREATE INDEX sf_story_media_story_order_idx ON public.sf_story_media (story_id, sort_order, created_at)
  WHERE state = 'verified';
CREATE INDEX sf_story_media_pending_idx ON public.sf_story_media (created_at)
  WHERE state = 'pending';

CREATE TABLE public.sf_story_media_deletion_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  media_id uuid NOT NULL REFERENCES public.sf_story_media(id) ON DELETE RESTRICT,
  object_key text NOT NULL,
  state text NOT NULL DEFAULT 'intended' CHECK (state IN ('intended', 'resolved', 'failed')),
  attempts smallint NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 3),
  reason text NOT NULL CHECK (reason IN ('student_remove', 'abandoned_upload')),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  UNIQUE (media_id, object_key, state)
);

CREATE UNIQUE INDEX sf_story_media_open_delete_idx
  ON public.sf_story_media_deletion_intents (media_id)
  WHERE state = 'intended';

ALTER TABLE public.sf_story_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sf_story_media FORCE ROW LEVEL SECURITY;
ALTER TABLE public.sf_story_media_deletion_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sf_story_media_deletion_intents FORCE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.sf_allocate_story_media(
  p_story_id uuid,
  p_media_id uuid,
  p_mime_type text,
  p_byte_size bigint,
  p_caption text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_story public.sf_stories;
  v_kind text;
  v_extension text;
  v_upload_key text;
  v_order integer;
BEGIN
  IF NOT public.sf_has_live_identity(ARRAY['student']) THEN
    RAISE EXCEPTION 'eligible student identity required' USING ERRCODE = '42501';
  END IF;
  IF p_media_id IS NULL THEN
    RAISE EXCEPTION 'media identifier required' USING ERRCODE = '22023';
  END IF;
  IF p_mime_type IN ('image/jpeg', 'image/png', 'image/webp') THEN
    v_kind := 'photo';
    v_extension := CASE p_mime_type WHEN 'image/jpeg' THEN 'jpg' WHEN 'image/png' THEN 'png' ELSE 'webp' END;
    IF p_byte_size NOT BETWEEN 1 AND 5242880 THEN
      RAISE EXCEPTION 'photo size is invalid' USING ERRCODE = '22023';
    END IF;
  ELSIF p_mime_type IN ('video/mp4', 'video/webm') THEN
    v_kind := 'video';
    v_extension := CASE p_mime_type WHEN 'video/mp4' THEN 'mp4' ELSE 'webm' END;
    IF p_byte_size NOT BETWEEN 1 AND 52428800 THEN
      RAISE EXCEPTION 'video size is invalid' USING ERRCODE = '22023';
    END IF;
  ELSE
    RAISE EXCEPTION 'story media type is invalid' USING ERRCODE = '22023';
  END IF;
  IF length(coalesce(p_caption, '')) > 240 OR coalesce(p_caption, '') ~ '[<>]' THEN
    RAISE EXCEPTION 'story media caption is invalid' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_story FROM public.sf_stories
  WHERE id = p_story_id AND student_id = public.sf_actor_id() AND archived_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'story not found' USING ERRCODE = 'P0002'; END IF;
  IF (SELECT count(*) FROM public.sf_story_media WHERE story_id = p_story_id AND state IN ('pending', 'verified')) >= 12 THEN
    RAISE EXCEPTION 'story media limit reached' USING ERRCODE = '23514';
  END IF;

  SELECT coalesce(max(sort_order), 0) + 10 INTO v_order
  FROM public.sf_story_media WHERE story_id = p_story_id AND state = 'verified';
  v_upload_key := format('storyforge-media/pending/%s/%s/%s.%s', public.sf_actor_id(), p_story_id, p_media_id, v_extension);
  INSERT INTO public.sf_story_media (
    id, story_id, student_id, media_kind, mime_type, byte_size, caption, sort_order, upload_object_key
  ) VALUES (
    p_media_id, p_story_id, public.sf_actor_id(), v_kind, p_mime_type, p_byte_size,
    trim(coalesce(p_caption, '')), v_order, v_upload_key
  );
  PERFORM public.sf_append_audit(
    'story_media.upload_allocated', 'story', p_story_id, 'workspace',
    public.sf_actor_id(), p_story_id, NULL, NULL,
    jsonb_build_object('mediaId', p_media_id, 'kind', v_kind, 'byteSize', p_byte_size), NULL, 'both'
  );
  RETURN jsonb_build_object('id', p_media_id, 'storyId', p_story_id, 'kind', v_kind,
    'mimeType', p_mime_type, 'byteSize', p_byte_size, 'caption', trim(coalesce(p_caption, '')),
    'sortOrder', v_order, 'uploadObjectKey', v_upload_key, 'rowVersion', 0);
END
$$;

CREATE OR REPLACE FUNCTION public.sf_commit_story_media(
  p_media_id uuid,
  p_object_key text,
  p_etag text,
  p_duration_ms integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_media public.sf_story_media;
BEGIN
  IF NOT public.sf_has_live_identity(ARRAY['student']) THEN RAISE EXCEPTION 'eligible student identity required' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_media FROM public.sf_story_media
  WHERE id = p_media_id AND student_id = public.sf_actor_id() AND state = 'pending' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'pending story media not found' USING ERRCODE = 'P0002'; END IF;
  IF p_object_key !~ ('^storyforge-media/' || public.sf_actor_id() || '/' || v_media.story_id || '/' || v_media.id || '[.](jpg|png|webp|mp4|webm)$') THEN
    RAISE EXCEPTION 'story media object key is invalid' USING ERRCODE = '22023';
  END IF;
  IF v_media.media_kind = 'video' AND (p_duration_ms IS NULL OR p_duration_ms NOT BETWEEN 1 AND 60000) THEN
    RAISE EXCEPTION 'video duration is invalid' USING ERRCODE = '22023';
  END IF;
  IF v_media.media_kind = 'photo' AND p_duration_ms IS NOT NULL THEN
    RAISE EXCEPTION 'photo duration must be empty' USING ERRCODE = '22023';
  END IF;
  UPDATE public.sf_story_media SET object_key = p_object_key, etag = nullif(p_etag, ''),
    duration_ms = p_duration_ms, state = 'verified', verified_at = now(), row_version = row_version + 1
  WHERE id = p_media_id RETURNING * INTO v_media;
  PERFORM public.sf_append_audit(
    'story_media.verified', 'story', v_media.story_id, 'workspace', v_media.student_id, v_media.story_id, NULL,
    NULL, jsonb_build_object('mediaId', v_media.id, 'kind', v_media.media_kind, 'byteSize', v_media.byte_size), NULL, 'both'
  );
  RETURN jsonb_build_object('id', v_media.id, 'storyId', v_media.story_id, 'kind', v_media.media_kind,
    'mimeType', v_media.mime_type, 'byteSize', v_media.byte_size, 'durationMs', v_media.duration_ms,
    'caption', v_media.caption, 'sortOrder', v_media.sort_order, 'createdAt', v_media.created_at,
    'verifiedAt', v_media.verified_at, 'rowVersion', v_media.row_version);
END
$$;

CREATE OR REPLACE FUNCTION public.sf_pending_story_media_claim(p_media_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_media public.sf_story_media;
BEGIN
  IF NOT public.sf_has_live_identity(ARRAY['student']) THEN RAISE EXCEPTION 'eligible student identity required' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_media FROM public.sf_story_media
  WHERE id = p_media_id AND student_id = public.sf_actor_id() AND state = 'pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'pending story media not found' USING ERRCODE = 'P0002'; END IF;
  RETURN jsonb_build_object('id', v_media.id, 'storyId', v_media.story_id, 'studentId', v_media.student_id,
    'kind', v_media.media_kind, 'mimeType', v_media.mime_type, 'byteSize', v_media.byte_size,
    'uploadObjectKey', v_media.upload_object_key);
END
$$;

CREATE OR REPLACE FUNCTION public.sf_story_media_authorized(p_story_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.sf_stories story
    WHERE story.id = p_story_id AND story.archived_at IS NULL AND (
      (public.sf_has_live_identity(ARRAY['student']) AND story.student_id = public.sf_actor_id())
      OR (story.status <> 'private' AND public.sf_has_live_identity(ARRAY['mentor']) AND EXISTS (
        SELECT 1 FROM public.sf_mentor_assignments assignment
        WHERE assignment.student_id = story.student_id AND assignment.mentor_id = public.sf_actor_id() AND assignment.active
      ))
      OR (story.status <> 'private' AND public.sf_has_live_identity(ARRAY['admin']) AND public.sf_admin_console_enabled())
    )
  )
$$;

CREATE OR REPLACE FUNCTION public.sf_list_story_media(p_story_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_result jsonb;
BEGIN
  IF NOT public.sf_story_media_authorized(p_story_id) THEN RAISE EXCEPTION 'story media not found' USING ERRCODE = 'P0002'; END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', media.id, 'storyId', media.story_id, 'kind', media.media_kind, 'mimeType', media.mime_type,
    'byteSize', media.byte_size, 'durationMs', media.duration_ms, 'caption', media.caption,
    'sortOrder', media.sort_order, 'createdAt', media.created_at, 'verifiedAt', media.verified_at,
    'rowVersion', media.row_version
  ) ORDER BY media.sort_order, media.created_at), '[]'::jsonb) INTO v_result
  FROM public.sf_story_media media WHERE media.story_id = p_story_id AND media.state = 'verified';
  RETURN v_result;
END
$$;

CREATE OR REPLACE FUNCTION public.sf_story_media_playback_claim(p_media_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_media public.sf_story_media;
BEGIN
  SELECT * INTO v_media FROM public.sf_story_media WHERE id = p_media_id AND state = 'verified';
  IF NOT FOUND OR NOT public.sf_story_media_authorized(v_media.story_id) THEN RAISE EXCEPTION 'story media not found' USING ERRCODE = 'P0002'; END IF;
  RETURN jsonb_build_object('id', v_media.id, 'storyId', v_media.story_id, 'kind', v_media.media_kind,
    'mimeType', v_media.mime_type, 'objectKey', v_media.object_key);
END
$$;

CREATE OR REPLACE FUNCTION public.sf_update_story_media(
  p_media_id uuid, p_expected_version bigint, p_caption text, p_sort_order integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_media public.sf_story_media;
BEGIN
  IF NOT public.sf_has_live_identity(ARRAY['student']) THEN RAISE EXCEPTION 'eligible student identity required' USING ERRCODE = '42501'; END IF;
  IF length(coalesce(p_caption, '')) > 240 OR coalesce(p_caption, '') ~ '[<>]' OR p_sort_order NOT BETWEEN 0 AND 10000 THEN
    RAISE EXCEPTION 'story media metadata is invalid' USING ERRCODE = '22023';
  END IF;
  UPDATE public.sf_story_media SET caption = trim(coalesce(p_caption, '')), sort_order = p_sort_order,
    row_version = row_version + 1
  WHERE id = p_media_id AND student_id = public.sf_actor_id() AND state = 'verified'
    AND row_version = p_expected_version
  RETURNING * INTO v_media;
  IF NOT FOUND THEN RAISE EXCEPTION 'story media changed or was not found' USING ERRCODE = '40001'; END IF;
  PERFORM public.sf_append_audit('story_media.metadata_updated', 'story', v_media.story_id, 'workspace',
    v_media.student_id, v_media.story_id, NULL, NULL,
    jsonb_build_object('mediaId', v_media.id, 'sortOrder', v_media.sort_order), NULL, 'both');
  RETURN jsonb_build_object('id', v_media.id, 'caption', v_media.caption, 'sortOrder', v_media.sort_order, 'rowVersion', v_media.row_version);
END
$$;

CREATE OR REPLACE FUNCTION public.sf_begin_story_media_delete(p_media_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_media public.sf_story_media; v_intent uuid;
BEGIN
  IF NOT public.sf_has_live_identity(ARRAY['student']) THEN RAISE EXCEPTION 'eligible student identity required' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_media FROM public.sf_story_media
  WHERE id = p_media_id AND student_id = public.sf_actor_id() AND state IN ('pending', 'verified') FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'story media not found' USING ERRCODE = 'P0002'; END IF;
  UPDATE public.sf_story_media SET state = 'delete_pending', removed_at = now(), row_version = row_version + 1 WHERE id = p_media_id;
  INSERT INTO public.sf_story_media_deletion_intents(media_id, object_key, reason)
  VALUES (v_media.id, coalesce(v_media.object_key, v_media.upload_object_key), 'student_remove') RETURNING id INTO v_intent;
  PERFORM public.sf_append_audit('story_media.delete_intended', 'story', v_media.story_id, 'workspace',
    v_media.student_id, v_media.story_id, NULL, NULL, jsonb_build_object('mediaId', v_media.id), NULL, 'both');
  RETURN jsonb_build_object('intentId', v_intent, 'mediaId', v_media.id,
    'objectKey', coalesce(v_media.object_key, v_media.upload_object_key));
END
$$;

CREATE OR REPLACE FUNCTION public.sf_resolve_story_media_delete(p_intent_id uuid, p_deleted boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_intent public.sf_story_media_deletion_intents; v_media public.sf_story_media;
BEGIN
  IF NOT public.sf_has_live_identity(ARRAY['student']) THEN RAISE EXCEPTION 'eligible student identity required' USING ERRCODE = '42501'; END IF;
  SELECT intent.* INTO v_intent FROM public.sf_story_media_deletion_intents intent
  JOIN public.sf_story_media media ON media.id = intent.media_id
  WHERE intent.id = p_intent_id AND intent.state = 'intended' AND media.student_id = public.sf_actor_id() FOR UPDATE OF intent;
  IF NOT FOUND THEN RAISE EXCEPTION 'story media deletion intent not found' USING ERRCODE = 'P0002'; END IF;
  IF p_deleted THEN
    UPDATE public.sf_story_media_deletion_intents SET state = 'resolved', attempts = attempts + 1, resolved_at = now() WHERE id = p_intent_id;
    UPDATE public.sf_story_media SET state = 'deleted', object_key = NULL WHERE id = v_intent.media_id RETURNING * INTO v_media;
  ELSE
    UPDATE public.sf_story_media_deletion_intents SET attempts = attempts + 1,
      state = CASE WHEN attempts + 1 >= 3 THEN 'failed' ELSE 'intended' END,
      resolved_at = CASE WHEN attempts + 1 >= 3 THEN now() ELSE NULL END WHERE id = p_intent_id;
  END IF;
END
$$;

REVOKE ALL ON TABLE public.sf_storyforge_configuration FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.sf_storyforge_configuration_history FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.sf_story_media FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.sf_story_media_deletion_intents FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sf_get_storyforge_configuration() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sf_publish_storyforge_configuration(jsonb, bigint, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sf_restore_storyforge_configuration(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sf_get_storyforge_configuration() TO authenticated;
GRANT EXECUTE ON FUNCTION public.sf_publish_storyforge_configuration(jsonb, bigint, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sf_restore_storyforge_configuration(bigint) TO authenticated;
REVOKE ALL ON FUNCTION public.sf_enforce_storyforge_submission_configuration() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sf_update_story_taxonomy_configured(uuid, bigint, text[], text[], text, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sf_allocate_story_media(uuid, uuid, text, bigint, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sf_commit_story_media(uuid, text, text, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sf_pending_story_media_claim(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sf_story_media_authorized(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sf_list_story_media(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sf_story_media_playback_claim(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sf_update_story_media(uuid, bigint, text, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sf_begin_story_media_delete(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sf_resolve_story_media_delete(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sf_allocate_story_media(uuid, uuid, text, bigint, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sf_commit_story_media(uuid, text, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sf_pending_story_media_claim(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sf_list_story_media(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sf_story_media_playback_claim(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sf_update_story_media(uuid, bigint, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sf_begin_story_media_delete(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sf_resolve_story_media_delete(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sf_update_story_taxonomy_configured(uuid, bigint, text[], text[], text, boolean) TO authenticated;

COMMIT;
