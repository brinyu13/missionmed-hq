-- Migration: 20260805190000_b1_511_workflow_taxonomy_mentor_notes.sql
-- Authority: DR-021 / B1-511
-- Date: 2026-08-05
-- Depends on: 20260801190000_b1_510i_admin_console.sql
-- Description: Additive StoryForge-owned taxonomy, inline priority, and mentor-note contracts.
-- Idempotent: NO

BEGIN;

SELECT pg_advisory_xact_lock(hashtextextended('b1-511-workflow-taxonomy-mentor-notes', 0));

ALTER TABLE public.sf_stories
  ADD COLUMN categories text[] NOT NULL DEFAULT ARRAY[]::text[];

ALTER TABLE public.sf_stories
  ADD CONSTRAINT sf_stories_categories_check
  CHECK (categories <@ ARRAY[
    'clinical', 'personal', 'research', 'leadership', 'teaching',
    'volunteer_service', 'adversity_challenge', 'teamwork', 'communication',
    'ethics_professionalism', 'other'
  ]::text[]) NOT VALID;

ALTER TABLE public.sf_stories
  DROP CONSTRAINT sf_stories_uses_check;

ALTER TABLE public.sf_stories
  ADD CONSTRAINT sf_stories_uses_check
  CHECK (uses <@ ARRAY[
    'ps', 'iv', 'letter', 'myeras_experiences',
    'myeras_most_impactful', 'later'
  ]::text[]) NOT VALID;

ALTER TABLE public.sf_stories VALIDATE CONSTRAINT sf_stories_categories_check;
ALTER TABLE public.sf_stories VALIDATE CONSTRAINT sf_stories_uses_check;

ALTER TABLE public.sf_use_suggestions
  DROP CONSTRAINT sf_use_suggestions_use_key_check;
ALTER TABLE public.sf_use_suggestions
  ADD CONSTRAINT sf_use_suggestions_use_key_check
  CHECK (use_key IN (
    'ps', 'iv', 'letter', 'myeras_experiences',
    'myeras_most_impactful', 'later'
  )) NOT VALID;
ALTER TABLE public.sf_use_suggestions
  VALIDATE CONSTRAINT sf_use_suggestions_use_key_check;

CREATE INDEX sf_stories_categories_gin_idx
  ON public.sf_stories USING gin (categories);
CREATE INDEX sf_stories_uses_gin_idx
  ON public.sf_stories USING gin (uses);

INSERT INTO public.sf_feature_flags (key, scope, allowlist, cohorts, updated_by)
SELECT feature.key, 'off', ARRAY[]::uuid[], ARRAY[]::text[], founder.updated_by
FROM (
  VALUES
    ('story_workflow'),
    ('story_taxonomy'),
    ('inline_priority'),
    ('story_search'),
    ('mentor_notes')
) AS feature(key)
CROSS JOIN (
  SELECT updated_by
  FROM public.sf_feature_flags
  WHERE key = 'admin_console'
) AS founder;

CREATE OR REPLACE FUNCTION public.sf_story_feature_enabled(
  p_key text,
  p_roles text[] DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.sf_has_live_identity(p_roles)
    AND EXISTS (
      SELECT 1
      FROM public.sf_feature_flags flag
      JOIN public.sf_users actor ON actor.id = public.sf_actor_id()
      WHERE flag.key = p_key
        AND (
          flag.scope = 'eligible_all'
          OR (flag.scope = 'allowlist' AND actor.id = ANY(flag.allowlist))
          OR (
            flag.scope = 'cohort'
            AND actor.cohort IS NOT NULL
            AND actor.cohort = ANY(flag.cohorts)
          )
        )
    )
$$;

CREATE OR REPLACE FUNCTION public.sf_submit_story(
  p_story_id uuid,
  p_surface text DEFAULT 'workspace'
)
RETURNS public.sf_stories
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_before public.sf_stories;
  v_story public.sf_stories;
  v_resubmit boolean;
  v_b1_511_workflow boolean;
BEGIN
  IF NOT public.sf_has_live_identity(ARRAY['student']) THEN
    RAISE EXCEPTION 'eligible student identity required' USING ERRCODE = '42501';
  END IF;
  IF p_surface NOT IN ('library', 'quick', 'workspace') THEN
    RAISE EXCEPTION 'invalid surface' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_before
  FROM public.sf_stories
  WHERE id = p_story_id
    AND student_id = public.sf_actor_id()
    AND archived_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'story not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_before.status NOT IN ('private', 'changes') THEN
    RAISE EXCEPTION 'cannot submit from status %', v_before.status USING ERRCODE = '23514';
  END IF;
  IF length(trim(v_before.current_text)) < 3 THEN
    RAISE EXCEPTION 'story text is required' USING ERRCODE = '23514';
  END IF;

  v_b1_511_workflow := public.sf_story_feature_enabled(
    'story_workflow', ARRAY['student']
  );
  IF NOT v_b1_511_workflow AND NOT EXISTS (
    SELECT 1
    FROM public.sf_mentor_assignments assignment
    WHERE assignment.student_id = v_before.student_id
      AND assignment.active
  ) THEN
    RAISE EXCEPTION 'An active mentor assignment is required before submission.'
      USING ERRCODE = '42501';
  END IF;

  v_resubmit := v_before.status = 'changes';
  UPDATE public.sf_stories
  SET status = 'awaiting',
      revised = v_resubmit,
      submitted_at = coalesce(submitted_at, now()),
      last_submitted_at = now(),
      student_responded_at = CASE WHEN v_resubmit THEN now() ELSE student_responded_at END,
      status_changed_at = now(),
      student_updated_at = now(),
      row_version = row_version + 1,
      updated_at = now()
  WHERE id = p_story_id
  RETURNING * INTO v_story;

  INSERT INTO public.sf_story_revisions (
    story_id, revision_no, text_snapshot, title_snapshot, actor_id, reason
  ) VALUES (
    v_story.id, v_story.revision_no, v_story.current_text, v_story.title,
    public.sf_actor_id(), CASE WHEN v_resubmit THEN 'resubmit' ELSE 'submit' END
  );

  PERFORM public.sf_append_audit(
    CASE WHEN v_resubmit THEN 'story.resubmitted' ELSE 'story.submitted' END,
    'story', v_story.id, p_surface, v_story.student_id, v_story.id, NULL,
    jsonb_build_object('status', v_before.status, 'revised', v_before.revised),
    jsonb_build_object(
      'status', v_story.status,
      'revised', v_story.revised,
      'assignment_independent', v_b1_511_workflow,
      'row_version', v_story.row_version
    )
  );
  RETURN v_story;
END
$$;

CREATE OR REPLACE FUNCTION public.sf_withdraw_story(
  p_story_id uuid,
  p_expected_version bigint,
  p_surface text DEFAULT 'workspace'
)
RETURNS public.sf_stories
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_before public.sf_stories;
  v_story public.sf_stories;
BEGIN
  IF NOT public.sf_story_feature_enabled('story_workflow', ARRAY['student']) THEN
    RAISE EXCEPTION 'story withdrawal is unavailable' USING ERRCODE = '42501';
  END IF;
  IF p_surface NOT IN ('library', 'quick', 'workspace') THEN
    RAISE EXCEPTION 'invalid surface' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_before
  FROM public.sf_stories
  WHERE id = p_story_id
    AND student_id = public.sf_actor_id()
    AND archived_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'story not found' USING ERRCODE = 'P0002';
  END IF;
  IF p_expected_version IS NULL OR p_expected_version <> v_before.row_version THEN
    RAISE EXCEPTION 'story version conflict' USING ERRCODE = '40001';
  END IF;
  IF v_before.status <> 'awaiting' THEN
    RAISE EXCEPTION 'only an awaiting story may be withdrawn' USING ERRCODE = '23514';
  END IF;

  UPDATE public.sf_stories
  SET status = 'private',
      last_submitted_at = NULL,
      opened_at = NULL,
      status_changed_at = now(),
      student_updated_at = now(),
      row_version = row_version + 1,
      updated_at = now()
  WHERE id = p_story_id
  RETURNING * INTO v_story;

  PERFORM public.sf_append_audit(
    'story.withdrawn', 'story', v_story.id, p_surface,
    v_story.student_id, v_story.id, NULL,
    jsonb_build_object(
      'status', v_before.status,
      'row_version', v_before.row_version,
      'submitted_at', v_before.submitted_at
    ),
    jsonb_build_object(
      'status', v_story.status,
      'row_version', v_story.row_version,
      'submitted_at', v_story.submitted_at
    ),
    NULL, 'both'
  );
  RETURN v_story;
END
$$;

CREATE OR REPLACE FUNCTION public.sf_update_story_taxonomy(
  p_story_id uuid,
  p_expected_version bigint,
  p_categories text[],
  p_uses text[],
  p_surface text DEFAULT 'library'
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
BEGIN
  IF NOT public.sf_story_feature_enabled('story_taxonomy', ARRAY['student']) THEN
    RAISE EXCEPTION 'story taxonomy is unavailable' USING ERRCODE = '42501';
  END IF;
  IF p_surface NOT IN ('library', 'workspace') THEN
    RAISE EXCEPTION 'invalid story taxonomy surface' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_before
  FROM public.sf_stories
  WHERE id = p_story_id
    AND student_id = public.sf_actor_id()
    AND archived_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'story not found' USING ERRCODE = 'P0002';
  END IF;
  IF p_expected_version IS NULL OR p_expected_version <> v_before.row_version THEN
    RAISE EXCEPTION 'story version conflict' USING ERRCODE = '40001';
  END IF;

  SELECT coalesce(array_agg(value ORDER BY value), ARRAY[]::text[])
  INTO v_categories
  FROM (
    SELECT DISTINCT lower(trim(value)) AS value
    FROM unnest(coalesce(p_categories, ARRAY[]::text[])) value
  ) normalized
  WHERE value <> '';
  SELECT coalesce(array_agg(value ORDER BY value), ARRAY[]::text[])
  INTO v_uses
  FROM (
    SELECT DISTINCT lower(trim(value)) AS value
    FROM unnest(coalesce(p_uses, ARRAY[]::text[])) value
  ) normalized
  WHERE value <> '';

  IF EXISTS (
    SELECT 1 FROM unnest(v_categories) value
    WHERE value <> ALL(ARRAY[
      'clinical', 'personal', 'research', 'leadership', 'teaching',
      'volunteer_service', 'adversity_challenge', 'teamwork', 'communication',
      'ethics_professionalism', 'other'
    ]::text[])
  ) THEN
    RAISE EXCEPTION 'invalid StoryForge category' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM unnest(v_uses) value
    WHERE value <> ALL(ARRAY[
      'ps', 'iv', 'letter', 'myeras_experiences',
      'myeras_most_impactful', 'later'
    ]::text[])
  ) THEN
    RAISE EXCEPTION 'invalid StoryForge intended use' USING ERRCODE = '22023';
  END IF;

  UPDATE public.sf_stories
  SET categories = v_categories,
      uses = v_uses,
      row_version = row_version + 1,
      student_updated_at = now(),
      updated_at = now()
  WHERE id = p_story_id
  RETURNING * INTO v_after;

  PERFORM public.sf_append_audit(
    'story.taxonomy_updated', 'story', p_story_id, p_surface,
    v_before.student_id, p_story_id, NULL,
    jsonb_build_object('categories', v_before.categories, 'uses', v_before.uses,
      'row_version', v_before.row_version),
    jsonb_build_object('categories', v_after.categories, 'uses', v_after.uses,
      'row_version', v_after.row_version),
    NULL, 'both'
  );

  RETURN jsonb_build_object(
    'id', v_after.id,
    'categories', to_jsonb(v_after.categories),
    'uses', to_jsonb(v_after.uses),
    'rowVersion', v_after.row_version,
    'updatedAt', v_after.updated_at
  );
END
$$;

CREATE OR REPLACE FUNCTION public.sf_update_story_priority(
  p_story_id uuid,
  p_expected_version bigint,
  p_priority smallint,
  p_surface text DEFAULT 'library'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_before public.sf_stories;
  v_after public.sf_stories;
BEGIN
  IF NOT public.sf_story_feature_enabled('inline_priority', ARRAY['student']) THEN
    RAISE EXCEPTION 'inline story priority is unavailable' USING ERRCODE = '42501';
  END IF;
  IF p_surface <> 'library' THEN
    RAISE EXCEPTION 'invalid story priority surface' USING ERRCODE = '22023';
  END IF;
  IF p_priority IS NOT NULL AND p_priority NOT BETWEEN 1 AND 5 THEN
    RAISE EXCEPTION 'student priority must be between 1 and 5' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_before
  FROM public.sf_stories
  WHERE id = p_story_id
    AND student_id = public.sf_actor_id()
    AND archived_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'story not found' USING ERRCODE = 'P0002';
  END IF;
  IF p_expected_version IS NULL OR p_expected_version <> v_before.row_version THEN
    RAISE EXCEPTION 'story version conflict' USING ERRCODE = '40001';
  END IF;

  UPDATE public.sf_stories
  SET student_score = p_priority,
      row_version = row_version + 1,
      student_updated_at = now(),
      updated_at = now()
  WHERE id = p_story_id
  RETURNING * INTO v_after;

  PERFORM public.sf_append_audit(
    'story.student_priority_updated', 'story', p_story_id, p_surface,
    v_before.student_id, p_story_id, NULL,
    jsonb_build_object('student_score', v_before.student_score,
      'row_version', v_before.row_version),
    jsonb_build_object('student_score', v_after.student_score,
      'row_version', v_after.row_version),
    NULL, 'both'
  );

  RETURN jsonb_build_object(
    'id', v_after.id,
    'priority', v_after.student_score,
    'rowVersion', v_after.row_version,
    'updatedAt', v_after.updated_at
  );
END
$$;

CREATE OR REPLACE FUNCTION public.sf_admin_update_story_taxonomy(
  p_story_id uuid,
  p_expected_version bigint,
  p_categories text[],
  p_uses text[],
  p_surface text DEFAULT 'workspace'
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
BEGIN
  PERFORM public.sf_admin_assert_enabled();
  IF NOT public.sf_story_feature_enabled('story_taxonomy', ARRAY['admin']) THEN
    RAISE EXCEPTION 'story taxonomy is unavailable' USING ERRCODE = '42501';
  END IF;
  IF p_surface NOT IN ('workspace', 'quick') THEN
    RAISE EXCEPTION 'invalid administrator taxonomy surface' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_before
  FROM public.sf_stories
  WHERE id = p_story_id AND status <> 'private' AND archived_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'story not found' USING ERRCODE = 'P0002';
  END IF;
  IF p_expected_version IS NULL OR p_expected_version <> v_before.row_version THEN
    RAISE EXCEPTION 'story version conflict' USING ERRCODE = '40001';
  END IF;

  SELECT coalesce(array_agg(value ORDER BY value), ARRAY[]::text[])
  INTO v_categories
  FROM (
    SELECT DISTINCT lower(trim(value)) AS value
    FROM unnest(coalesce(p_categories, ARRAY[]::text[])) value
  ) normalized
  WHERE value <> '';
  SELECT coalesce(array_agg(value ORDER BY value), ARRAY[]::text[])
  INTO v_uses
  FROM (
    SELECT DISTINCT lower(trim(value)) AS value
    FROM unnest(coalesce(p_uses, ARRAY[]::text[])) value
  ) normalized
  WHERE value <> '';

  IF EXISTS (
    SELECT 1 FROM unnest(v_categories) value
    WHERE value <> ALL(ARRAY[
      'clinical', 'personal', 'research', 'leadership', 'teaching',
      'volunteer_service', 'adversity_challenge', 'teamwork', 'communication',
      'ethics_professionalism', 'other'
    ]::text[])
  ) OR EXISTS (
    SELECT 1 FROM unnest(v_uses) value
    WHERE value <> ALL(ARRAY[
      'ps', 'iv', 'letter', 'myeras_experiences',
      'myeras_most_impactful', 'later'
    ]::text[])
  ) THEN
    RAISE EXCEPTION 'invalid StoryForge taxonomy value' USING ERRCODE = '22023';
  END IF;

  UPDATE public.sf_stories
  SET categories = v_categories,
      uses = v_uses,
      row_version = row_version + 1,
      updated_at = now()
  WHERE id = p_story_id
  RETURNING * INTO v_after;

  PERFORM public.sf_append_audit(
    'admin.story_taxonomy_updated', 'story', p_story_id, p_surface,
    v_before.student_id, p_story_id, NULL,
    jsonb_build_object('categories', v_before.categories, 'uses', v_before.uses,
      'row_version', v_before.row_version),
    jsonb_build_object('categories', v_after.categories, 'uses', v_after.uses,
      'row_version', v_after.row_version),
    NULL, 'both'
  );

  RETURN jsonb_build_object(
    'id', v_after.id,
    'categories', to_jsonb(v_after.categories),
    'uses', to_jsonb(v_after.uses),
    'rowVersion', v_after.row_version,
    'updatedAt', v_after.updated_at
  );
END
$$;

CREATE TABLE public.sf_mentor_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id uuid NOT NULL REFERENCES public.sf_stories(id) ON DELETE RESTRICT,
  student_id uuid NOT NULL REFERENCES public.sf_users(id) ON DELETE RESTRICT,
  author_id uuid NOT NULL REFERENCES public.sf_users(id) ON DELETE RESTRICT,
  body text NOT NULL DEFAULT '' CHECK (length(body) <= 20000),
  internal_only boolean NOT NULL DEFAULT false,
  state text NOT NULL DEFAULT 'draft'
    CHECK (state IN ('draft', 'published', 'superseded', 'archived')),
  row_version bigint NOT NULL DEFAULT 0 CHECK (row_version >= 0),
  published_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, author_id),
  CHECK (
    (state = 'draft' AND published_at IS NULL AND archived_at IS NULL)
    OR (state IN ('published', 'superseded') AND published_at IS NOT NULL AND archived_at IS NULL)
    OR (state = 'archived' AND archived_at IS NOT NULL)
  )
);

CREATE INDEX sf_mentor_notes_story_state_idx
  ON public.sf_mentor_notes (story_id, state, created_at DESC, id DESC);
CREATE INDEX sf_mentor_notes_author_idx
  ON public.sf_mentor_notes (author_id, updated_at DESC, id DESC);

CREATE TABLE public.sf_mentor_note_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id uuid NOT NULL,
  author_id uuid NOT NULL,
  student_id uuid NOT NULL REFERENCES public.sf_users(id) ON DELETE RESTRICT,
  story_id uuid NOT NULL REFERENCES public.sf_stories(id) ON DELETE RESTRICT,
  object_key text NOT NULL UNIQUE,
  content_type text NOT NULL
    CHECK (content_type IN ('audio/webm', 'audio/mp4', 'audio/ogg', 'audio/wav')),
  byte_size bigint NOT NULL CHECK (byte_size BETWEEN 1 AND 5242880),
  checksum_sha256 text CHECK (checksum_sha256 IS NULL OR checksum_sha256 ~ '^[a-f0-9]{64}$'),
  transcript text,
  provider_id text,
  model_id text,
  state text NOT NULL DEFAULT 'pending'
    CHECK (state IN ('pending', 'uploaded', 'verified', 'failed', 'retired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  verified_at timestamptz,
  retired_at timestamptz,
  UNIQUE (note_id),
  FOREIGN KEY (note_id, author_id)
    REFERENCES public.sf_mentor_notes(id, author_id) ON DELETE RESTRICT,
  CHECK (
    object_key LIKE
      'storyforge-mentor-notes/' || author_id::text || '/' || student_id::text
      || '/' || story_id::text || '/' || note_id::text || '/%'
    AND substring(
      object_key FROM length(
        'storyforge-mentor-notes/' || author_id::text || '/' || student_id::text
        || '/' || story_id::text || '/' || note_id::text || '/'
      ) + 1
    ) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(webm|m4a|ogg|wav)$'
  )
);

CREATE INDEX sf_mentor_note_media_story_idx
  ON public.sf_mentor_note_media (story_id, state, created_at DESC);

CREATE TABLE public.sf_mentor_note_audio_deletion_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id uuid NOT NULL REFERENCES public.sf_mentor_notes(id) ON DELETE RESTRICT,
  object_key text NOT NULL,
  requested_by uuid NOT NULL REFERENCES public.sf_users(id) ON DELETE RESTRICT,
  state text NOT NULL DEFAULT 'pending'
    CHECK (state IN ('pending', 'deleted', 'failed')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE UNIQUE INDEX sf_mentor_note_audio_delete_pending_uidx
  ON public.sf_mentor_note_audio_deletion_intents (object_key)
  WHERE state = 'pending';

CREATE OR REPLACE FUNCTION public.sf_forbid_mentor_note_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'StoryForge mentor notes are retained history' USING ERRCODE = '42501';
END
$$;

CREATE TRIGGER sf_mentor_notes_no_delete
BEFORE DELETE ON public.sf_mentor_notes
FOR EACH ROW EXECUTE FUNCTION public.sf_forbid_mentor_note_delete();

CREATE OR REPLACE FUNCTION public.sf_mentor_notes_enabled()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.sf_story_feature_enabled(
      'mentor_notes', ARRAY['student', 'mentor', 'admin']
    )
    AND (
      public.sf_actor_role() <> 'admin'
      OR public.sf_admin_console_enabled()
    )
$$;

CREATE OR REPLACE FUNCTION public.sf_b1_511_capabilities()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role text := public.sf_actor_role();
  v_live boolean := public.sf_has_live_identity();
  v_reviewer_notes boolean := false;
  v_student_notes boolean := false;
BEGIN
  IF v_live AND v_role = 'student' THEN
    v_student_notes := public.sf_story_feature_enabled(
      'mentor_notes', ARRAY['student']
    );
  END IF;

  IF v_live AND public.sf_story_feature_enabled(
    'mentor_notes', ARRAY['mentor', 'admin']
  ) THEN
    v_reviewer_notes := (
      v_role = 'mentor'
      AND EXISTS (
        SELECT 1
        FROM public.sf_mentor_assignments assignment
        WHERE assignment.mentor_id = public.sf_actor_id()
          AND assignment.active
      )
    ) OR (
      v_role = 'admin' AND public.sf_admin_console_enabled()
    );
  END IF;

  RETURN jsonb_build_object(
    'submissionReview', v_live AND v_role = 'student'
      AND public.sf_story_feature_enabled('story_workflow', ARRAY['student']),
    'taxonomy', v_live AND (
      (v_role = 'student'
        AND public.sf_story_feature_enabled('story_taxonomy', ARRAY['student']))
      OR (v_role = 'admin'
        AND public.sf_admin_console_enabled()
        AND public.sf_story_feature_enabled('story_taxonomy', ARRAY['admin']))
    ),
    'inlinePriority', v_live AND v_role = 'student'
      AND public.sf_story_feature_enabled('inline_priority', ARRAY['student']),
    'storySearch', v_live AND v_role = 'student'
      AND public.sf_story_feature_enabled('story_search', ARRAY['student']),
    'mentorNotes', v_reviewer_notes,
    'mentorNotesRead', v_student_notes OR v_reviewer_notes
  );
END
$$;

CREATE OR REPLACE FUNCTION public.sf_can_review_submitted_story(p_story_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.sf_mentor_notes_enabled()
    AND EXISTS (
      SELECT 1
      FROM public.sf_stories story
      WHERE story.id = p_story_id
        AND story.status <> 'private'
        AND story.archived_at IS NULL
        AND (
          (
            public.sf_actor_role() = 'mentor'
            AND public.sf_is_assigned(story.student_id)
          )
          OR public.sf_actor_role() = 'admin'
        )
    )
$$;

ALTER TABLE public.sf_mentor_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sf_mentor_notes FORCE ROW LEVEL SECURITY;
ALTER TABLE public.sf_mentor_note_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sf_mentor_note_media FORCE ROW LEVEL SECURITY;
ALTER TABLE public.sf_mentor_note_audio_deletion_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sf_mentor_note_audio_deletion_intents FORCE ROW LEVEL SECURITY;

CREATE POLICY sf_mentor_notes_read
ON public.sf_mentor_notes
FOR SELECT TO authenticated
USING (
  public.sf_mentor_notes_enabled()
  AND EXISTS (
    SELECT 1
    FROM public.sf_stories story
    WHERE story.id = sf_mentor_notes.story_id
      AND story.student_id = sf_mentor_notes.student_id
      AND story.status <> 'private'
      AND story.archived_at IS NULL
      AND (
        (
          public.sf_actor_role() = 'student'
          AND story.student_id = public.sf_actor_id()
          AND sf_mentor_notes.state = 'published'
          AND NOT sf_mentor_notes.internal_only
        )
        OR (
          public.sf_actor_role() = 'mentor'
          AND sf_mentor_notes.author_id = public.sf_actor_id()
          AND public.sf_is_assigned(story.student_id)
        )
        OR public.sf_actor_role() = 'admin'
      )
  )
);

CREATE POLICY sf_mentor_note_media_read
ON public.sf_mentor_note_media
FOR SELECT TO authenticated
USING (
  public.sf_mentor_notes_enabled()
  AND EXISTS (
    SELECT 1
    FROM public.sf_mentor_notes note
    JOIN public.sf_stories story ON story.id = note.story_id
    WHERE note.id = sf_mentor_note_media.note_id
      AND note.author_id = sf_mentor_note_media.author_id
      AND story.student_id = sf_mentor_note_media.student_id
      AND story.status <> 'private'
      AND story.archived_at IS NULL
      AND sf_mentor_note_media.state = 'verified'
      AND (
        (
          public.sf_actor_role() = 'student'
          AND story.student_id = public.sf_actor_id()
          AND note.state = 'published'
          AND NOT note.internal_only
        )
        OR (
          public.sf_actor_role() = 'mentor'
          AND note.author_id = public.sf_actor_id()
          AND public.sf_is_assigned(story.student_id)
        )
        OR public.sf_actor_role() = 'admin'
      )
  )
);

REVOKE ALL ON public.sf_mentor_notes, public.sf_mentor_note_media,
  public.sf_mentor_note_audio_deletion_intents
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.sf_mentor_notes TO authenticated;

CREATE OR REPLACE FUNCTION public.sf_create_mentor_note(
  p_story_id uuid,
  p_body text,
  p_internal_only boolean,
  p_surface text DEFAULT 'workspace'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_story public.sf_stories;
  v_note public.sf_mentor_notes;
  v_body text := trim(coalesce(p_body, ''));
BEGIN
  IF NOT public.sf_can_review_submitted_story(p_story_id) THEN
    RAISE EXCEPTION 'submitted story not found' USING ERRCODE = 'P0002';
  END IF;
  IF p_surface NOT IN ('workspace', 'quick') THEN
    RAISE EXCEPTION 'invalid mentor note surface' USING ERRCODE = '22023';
  END IF;
  IF length(v_body) > 20000 THEN
    RAISE EXCEPTION 'mentor note text is invalid' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO STRICT v_story
  FROM public.sf_stories WHERE id = p_story_id;
  INSERT INTO public.sf_mentor_notes (
    story_id, student_id, author_id, body, internal_only, state, published_at
  ) VALUES (
    p_story_id, v_story.student_id, public.sf_actor_id(), v_body,
    coalesce(p_internal_only, false), 'draft', NULL
  ) RETURNING * INTO v_note;

  PERFORM public.sf_append_audit(
    'mentor_note.created',
    'mentor_note', v_note.id, p_surface, v_note.student_id, p_story_id, NULL,
    NULL,
    jsonb_build_object('state', v_note.state, 'has_text', v_note.body <> '',
      'internal_only', v_note.internal_only, 'row_version', v_note.row_version),
    NULL, 'mentor_only'
  );

  RETURN jsonb_build_object(
    'id', v_note.id, 'storyId', v_note.story_id, 'studentId', v_note.student_id,
    'authorId', v_note.author_id, 'body', v_note.body, 'state', v_note.state,
    'internalOnly', v_note.internal_only,
    'rowVersion', v_note.row_version, 'publishedAt', v_note.published_at,
    'createdAt', v_note.created_at, 'updatedAt', v_note.updated_at
  );
END
$$;

CREATE OR REPLACE FUNCTION public.sf_update_mentor_note(
  p_note_id uuid,
  p_expected_version bigint,
  p_body text,
  p_surface text DEFAULT 'workspace'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_note public.sf_mentor_notes;
  v_body text := trim(coalesce(p_body, ''));
BEGIN
  IF NOT public.sf_mentor_notes_enabled()
     OR public.sf_actor_role() NOT IN ('mentor', 'admin') THEN
    RAISE EXCEPTION 'mentor notes are unavailable' USING ERRCODE = '42501';
  END IF;
  IF p_surface NOT IN ('workspace', 'quick') OR length(v_body) > 20000 THEN
    RAISE EXCEPTION 'invalid mentor note update' USING ERRCODE = '22023';
  END IF;

  SELECT note.* INTO v_note
  FROM public.sf_mentor_notes note
  WHERE note.id = p_note_id
    AND note.author_id = public.sf_actor_id()
    AND note.state = 'draft'
    AND public.sf_can_review_submitted_story(note.story_id)
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'mentor note not found' USING ERRCODE = 'P0002';
  END IF;
  IF p_expected_version IS NULL OR p_expected_version <> v_note.row_version THEN
    RAISE EXCEPTION 'mentor note version conflict' USING ERRCODE = '40001';
  END IF;

  UPDATE public.sf_mentor_notes
  SET body = v_body, row_version = row_version + 1, updated_at = now()
  WHERE id = p_note_id
  RETURNING * INTO v_note;

  PERFORM public.sf_append_audit(
    'mentor_note.updated', 'mentor_note', v_note.id, p_surface,
    v_note.student_id, v_note.story_id, NULL, NULL,
    jsonb_build_object('state', v_note.state, 'has_text', v_note.body <> '',
      'row_version', v_note.row_version), NULL, 'mentor_only'
  );
  RETURN jsonb_build_object(
    'id', v_note.id, 'storyId', v_note.story_id, 'body', v_note.body,
    'state', v_note.state, 'rowVersion', v_note.row_version,
    'updatedAt', v_note.updated_at
  );
END
$$;

CREATE OR REPLACE FUNCTION public.sf_publish_mentor_note(
  p_note_id uuid,
  p_expected_version bigint,
  p_surface text DEFAULT 'workspace'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_note public.sf_mentor_notes;
BEGIN
  IF NOT public.sf_mentor_notes_enabled()
     OR public.sf_actor_role() NOT IN ('mentor', 'admin') THEN
    RAISE EXCEPTION 'mentor notes are unavailable' USING ERRCODE = '42501';
  END IF;
  IF p_surface NOT IN ('workspace', 'quick') THEN
    RAISE EXCEPTION 'invalid mentor note surface' USING ERRCODE = '22023';
  END IF;
  SELECT note.* INTO v_note
  FROM public.sf_mentor_notes note
  WHERE note.id = p_note_id
    AND note.author_id = public.sf_actor_id()
    AND note.state = 'draft'
    AND public.sf_can_review_submitted_story(note.story_id)
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'mentor note not found' USING ERRCODE = 'P0002';
  END IF;
  IF p_expected_version IS NULL OR p_expected_version <> v_note.row_version THEN
    RAISE EXCEPTION 'mentor note version conflict' USING ERRCODE = '40001';
  END IF;
  IF length(trim(v_note.body)) < 1 THEN
    RAISE EXCEPTION 'mentor note text is required before publication' USING ERRCODE = '22023';
  END IF;
  IF v_note.internal_only THEN
    RAISE EXCEPTION 'internal mentor notes cannot be published to a student'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.sf_mentor_notes
  SET state = 'published', published_at = now(),
      row_version = row_version + 1, updated_at = now()
  WHERE id = p_note_id RETURNING * INTO v_note;

  PERFORM public.sf_append_audit(
    'mentor_note.published', 'mentor_note', v_note.id, p_surface,
    v_note.student_id, v_note.story_id, NULL,
    jsonb_build_object('state', 'draft'),
    jsonb_build_object('state', v_note.state, 'row_version', v_note.row_version),
    NULL, 'both'
  );
  RETURN jsonb_build_object(
    'id', v_note.id, 'storyId', v_note.story_id, 'body', v_note.body,
    'state', v_note.state, 'rowVersion', v_note.row_version,
    'publishedAt', v_note.published_at, 'updatedAt', v_note.updated_at
  );
END
$$;

CREATE OR REPLACE FUNCTION public.sf_archive_mentor_note(
  p_note_id uuid,
  p_expected_version bigint,
  p_surface text DEFAULT 'workspace'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_note public.sf_mentor_notes;
BEGIN
  IF NOT public.sf_mentor_notes_enabled()
     OR public.sf_actor_role() NOT IN ('mentor', 'admin') THEN
    RAISE EXCEPTION 'mentor notes are unavailable' USING ERRCODE = '42501';
  END IF;
  IF p_surface NOT IN ('workspace', 'quick') THEN
    RAISE EXCEPTION 'invalid mentor note surface' USING ERRCODE = '22023';
  END IF;
  SELECT note.* INTO v_note
  FROM public.sf_mentor_notes note
  WHERE note.id = p_note_id
    AND note.author_id = public.sf_actor_id()
    AND note.state <> 'archived'
    AND public.sf_can_review_submitted_story(note.story_id)
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'mentor note not found' USING ERRCODE = 'P0002';
  END IF;
  IF p_expected_version IS NULL OR p_expected_version <> v_note.row_version THEN
    RAISE EXCEPTION 'mentor note version conflict' USING ERRCODE = '40001';
  END IF;

  UPDATE public.sf_mentor_notes
  SET state = 'archived', archived_at = now(),
      row_version = row_version + 1, updated_at = now()
  WHERE id = p_note_id RETURNING * INTO v_note;

  PERFORM public.sf_append_audit(
    'mentor_note.archived', 'mentor_note', v_note.id, p_surface,
    v_note.student_id, v_note.story_id, NULL, NULL,
    jsonb_build_object('state', v_note.state, 'row_version', v_note.row_version),
    NULL, 'mentor_only'
  );
  RETURN jsonb_build_object(
    'id', v_note.id, 'storyId', v_note.story_id, 'state', v_note.state,
    'rowVersion', v_note.row_version, 'archivedAt', v_note.archived_at
  );
END
$$;

CREATE OR REPLACE FUNCTION public.sf_list_mentor_notes(p_story_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_story public.sf_stories;
  v_result jsonb;
BEGIN
  IF NOT public.sf_mentor_notes_enabled() THEN
    RAISE EXCEPTION 'mentor notes are unavailable' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_story
  FROM public.sf_stories story
  WHERE story.id = p_story_id
    AND story.status <> 'private'
    AND story.archived_at IS NULL
    AND (
      (public.sf_actor_role() = 'student' AND story.student_id = public.sf_actor_id())
      OR (
        public.sf_actor_role() = 'mentor'
        AND public.sf_is_assigned(story.student_id)
      )
      OR (public.sf_actor_role() = 'admin' AND public.sf_admin_console_enabled())
    );
  IF NOT FOUND THEN
    RAISE EXCEPTION 'submitted story not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
    'id', note.id,
    'storyId', note.story_id,
    'authorId', note.author_id,
    'authorName', author.display_name,
    'body', note.body,
    'state', note.state,
    'internalOnly', CASE
      WHEN public.sf_actor_role() <> 'student' THEN note.internal_only
    END,
    'rowVersion', note.row_version,
    'hasAudio', media.id IS NOT NULL AND media.state = 'verified',
    'publishedAt', note.published_at,
    'createdAt', note.created_at,
    'updatedAt', note.updated_at
  )) ORDER BY note.created_at, note.id), '[]'::jsonb)
  INTO v_result
  FROM public.sf_mentor_notes note
  JOIN public.sf_users author ON author.id = note.author_id
  LEFT JOIN public.sf_mentor_note_media media ON media.note_id = note.id
  WHERE note.story_id = p_story_id
    AND (
      (
        public.sf_actor_role() = 'student'
        AND note.state = 'published'
        AND NOT note.internal_only
      )
      OR (public.sf_actor_role() = 'mentor' AND note.author_id = public.sf_actor_id())
      OR public.sf_actor_role() = 'admin'
    );

  PERFORM public.sf_append_audit(
    'mentor_note.list_viewed', 'story', p_story_id, 'workspace',
    v_story.student_id, p_story_id, NULL, NULL,
    jsonb_build_object('result_count', jsonb_array_length(v_result)), NULL,
    CASE WHEN public.sf_actor_role() = 'student' THEN 'both' ELSE 'mentor_only' END
  );
  RETURN v_result;
END
$$;

CREATE OR REPLACE FUNCTION public.sf_prepare_mentor_note_audio(
  p_note_id uuid,
  p_expected_version bigint,
  p_mime_type text,
  p_byte_size bigint,
  p_surface text DEFAULT 'workspace'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_note public.sf_mentor_notes;
BEGIN
  IF NOT public.sf_mentor_notes_enabled()
     OR public.sf_actor_role() NOT IN ('mentor', 'admin') THEN
    RAISE EXCEPTION 'mentor notes are unavailable' USING ERRCODE = '42501';
  END IF;
  IF p_surface NOT IN ('workspace', 'quick')
     OR p_mime_type NOT IN ('audio/webm', 'audio/mp4', 'audio/ogg', 'audio/wav')
     OR p_byte_size NOT BETWEEN 1 AND 5242880 THEN
    RAISE EXCEPTION 'invalid mentor audio metadata' USING ERRCODE = '22023';
  END IF;
  SELECT note.* INTO v_note
  FROM public.sf_mentor_notes note
  WHERE note.id = p_note_id
    AND note.author_id = public.sf_actor_id()
    AND note.state = 'draft'
    AND public.sf_can_review_submitted_story(note.story_id);
  IF NOT FOUND THEN
    RAISE EXCEPTION 'mentor note not found' USING ERRCODE = 'P0002';
  END IF;
  IF p_expected_version IS NULL OR p_expected_version <> v_note.row_version THEN
    RAISE EXCEPTION 'mentor note version conflict' USING ERRCODE = '40001';
  END IF;

  RETURN jsonb_build_object(
    'authorId', v_note.author_id,
    'studentId', v_note.student_id,
    'storyId', v_note.story_id,
    'nextVersion', v_note.row_version + 1
  );
END
$$;

CREATE OR REPLACE FUNCTION public.sf_begin_mentor_note_audio(
  p_note_id uuid,
  p_expected_version bigint,
  p_object_key text,
  p_mime_type text,
  p_byte_size bigint,
  p_surface text DEFAULT 'workspace'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_note public.sf_mentor_notes;
  v_media public.sf_mentor_note_media;
  v_prefix text;
BEGIN
  IF NOT public.sf_mentor_notes_enabled()
     OR public.sf_actor_role() NOT IN ('mentor', 'admin') THEN
    RAISE EXCEPTION 'mentor notes are unavailable' USING ERRCODE = '42501';
  END IF;
  IF p_surface NOT IN ('workspace', 'quick')
     OR p_mime_type NOT IN ('audio/webm', 'audio/mp4', 'audio/ogg', 'audio/wav')
     OR p_byte_size NOT BETWEEN 1 AND 5242880 THEN
    RAISE EXCEPTION 'invalid mentor audio metadata' USING ERRCODE = '22023';
  END IF;
  SELECT note.* INTO v_note
  FROM public.sf_mentor_notes note
  WHERE note.id = p_note_id
    AND note.author_id = public.sf_actor_id()
    AND note.state = 'draft'
    AND public.sf_can_review_submitted_story(note.story_id)
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'mentor note not found' USING ERRCODE = 'P0002';
  END IF;
  IF p_expected_version IS NULL OR p_expected_version <> v_note.row_version THEN
    RAISE EXCEPTION 'mentor note version conflict' USING ERRCODE = '40001';
  END IF;
  v_prefix := 'storyforge-mentor-notes/' || v_note.author_id::text || '/'
    || v_note.student_id::text || '/' || v_note.story_id::text || '/'
    || v_note.id::text || '/';
  IF p_object_key NOT LIKE v_prefix || '%'
     OR substring(p_object_key from length(v_prefix) + 1)
       !~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(webm|m4a|ogg|wav)$' THEN
    RAISE EXCEPTION 'invalid mentor audio object namespace' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.sf_mentor_note_media (
    note_id, author_id, student_id, story_id, object_key, content_type, byte_size
  ) VALUES (
    v_note.id, v_note.author_id, v_note.student_id, v_note.story_id,
    p_object_key, p_mime_type, p_byte_size
  ) RETURNING * INTO v_media;
  UPDATE public.sf_mentor_notes
  SET row_version = row_version + 1, updated_at = now()
  WHERE id = p_note_id RETURNING * INTO v_note;

  PERFORM public.sf_append_audit(
    'mentor_note.audio_started', 'mentor_note', v_note.id, p_surface,
    v_note.student_id, v_note.story_id, NULL, NULL,
    jsonb_build_object('has_audio', true, 'audio_state', v_media.state,
      'row_version', v_note.row_version), NULL, 'mentor_only'
  );
  RETURN jsonb_build_object(
    'noteId', v_note.id, 'objectKey', v_media.object_key,
    'state', v_media.state, 'rowVersion', v_note.row_version
  );
END
$$;

CREATE OR REPLACE FUNCTION public.sf_complete_mentor_note_audio(
  p_note_id uuid,
  p_expected_version bigint,
  p_object_key text,
  p_transcript text,
  p_provider_id text,
  p_model_id text,
  p_surface text DEFAULT 'workspace'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_note public.sf_mentor_notes;
  v_media public.sf_mentor_note_media;
  v_transcript text := trim(coalesce(p_transcript, ''));
BEGIN
  IF NOT public.sf_mentor_notes_enabled()
     OR public.sf_actor_role() NOT IN ('mentor', 'admin') THEN
    RAISE EXCEPTION 'mentor notes are unavailable' USING ERRCODE = '42501';
  END IF;
  IF p_surface NOT IN ('workspace', 'quick')
     OR length(v_transcript) NOT BETWEEN 1 AND 20000
     OR length(trim(coalesce(p_provider_id, ''))) NOT BETWEEN 1 AND 120
     OR length(trim(coalesce(p_model_id, ''))) NOT BETWEEN 1 AND 120 THEN
    RAISE EXCEPTION 'invalid mentor audio completion' USING ERRCODE = '22023';
  END IF;
  SELECT note.* INTO v_note
  FROM public.sf_mentor_notes note
  WHERE note.id = p_note_id
    AND note.author_id = public.sf_actor_id()
    AND note.state = 'draft'
    AND public.sf_can_review_submitted_story(note.story_id)
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'mentor note not found' USING ERRCODE = 'P0002';
  END IF;
  IF p_expected_version IS NULL OR p_expected_version <> v_note.row_version THEN
    RAISE EXCEPTION 'mentor note version conflict' USING ERRCODE = '40001';
  END IF;
  SELECT * INTO v_media
  FROM public.sf_mentor_note_media
  WHERE note_id = p_note_id AND object_key = p_object_key AND state IN ('pending', 'uploaded')
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'mentor audio asset not found' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.sf_mentor_note_media
  SET transcript = v_transcript,
      provider_id = trim(p_provider_id), model_id = trim(p_model_id),
      state = 'verified', verified_at = now()
  WHERE id = v_media.id RETURNING * INTO v_media;
  UPDATE public.sf_mentor_notes
  SET body = v_transcript, row_version = row_version + 1, updated_at = now()
  WHERE id = p_note_id RETURNING * INTO v_note;

  PERFORM public.sf_append_audit(
    'mentor_note.audio_completed', 'mentor_note', v_note.id, p_surface,
    v_note.student_id, v_note.story_id, NULL, NULL,
    jsonb_build_object('has_audio', true, 'audio_state', v_media.state,
      'has_transcript', true, 'row_version', v_note.row_version),
    NULL, 'mentor_only'
  );
  RETURN jsonb_build_object(
    'noteId', v_note.id, 'body', v_note.body,
    'audioState', v_media.state, 'rowVersion', v_note.row_version
  );
END
$$;

CREATE OR REPLACE FUNCTION public.sf_fail_mentor_note_audio(
  p_note_id uuid,
  p_object_key text,
  p_error_category text,
  p_surface text DEFAULT 'workspace'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_note public.sf_mentor_notes;
  v_media public.sf_mentor_note_media;
BEGIN
  IF NOT public.sf_mentor_notes_enabled()
     OR public.sf_actor_role() NOT IN ('mentor', 'admin') THEN
    RAISE EXCEPTION 'mentor notes are unavailable' USING ERRCODE = '42501';
  END IF;
  IF p_surface NOT IN ('workspace', 'quick')
     OR length(trim(coalesce(p_error_category, ''))) NOT BETWEEN 1 AND 120 THEN
    RAISE EXCEPTION 'invalid mentor audio failure' USING ERRCODE = '22023';
  END IF;
  SELECT note.* INTO v_note
  FROM public.sf_mentor_notes note
  WHERE note.id = p_note_id
    AND note.author_id = public.sf_actor_id()
    AND note.state = 'draft'
    AND public.sf_can_review_submitted_story(note.story_id)
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'mentor note not found' USING ERRCODE = 'P0002';
  END IF;
  UPDATE public.sf_mentor_note_media
  SET state = 'failed'
  WHERE note_id = p_note_id AND object_key = p_object_key
    AND state IN ('pending', 'uploaded')
  RETURNING * INTO v_media;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'mentor audio asset not found' USING ERRCODE = 'P0002';
  END IF;
  INSERT INTO public.sf_mentor_note_audio_deletion_intents (
    note_id, object_key, requested_by
  ) VALUES (v_note.id, v_media.object_key, public.sf_actor_id())
  ON CONFLICT (object_key) WHERE state = 'pending' DO NOTHING;
  UPDATE public.sf_mentor_notes
  SET row_version = row_version + 1, updated_at = now()
  WHERE id = p_note_id RETURNING * INTO v_note;

  PERFORM public.sf_append_audit(
    'mentor_note.audio_failed', 'mentor_note', v_note.id, p_surface,
    v_note.student_id, v_note.story_id, NULL, NULL,
    jsonb_build_object('has_audio', true, 'audio_state', 'failed',
      'audio_delete_intended', true,
      'error_category', left(trim(p_error_category), 120),
      'row_version', v_note.row_version), NULL, 'mentor_only'
  );
  RETURN jsonb_build_object(
    'noteId', v_note.id, 'objectKey', v_media.object_key,
    'audioState', v_media.state,
    'rowVersion', v_note.row_version
  );
END
$$;

CREATE OR REPLACE FUNCTION public.sf_get_mentor_note_audio(p_note_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_note public.sf_mentor_notes;
  v_media public.sf_mentor_note_media;
BEGIN
  IF NOT public.sf_mentor_notes_enabled() THEN
    RAISE EXCEPTION 'mentor notes are unavailable' USING ERRCODE = '42501';
  END IF;
  SELECT note.* INTO v_note
  FROM public.sf_mentor_notes note
  JOIN public.sf_stories story ON story.id = note.story_id
  WHERE note.id = p_note_id
    AND story.status <> 'private'
    AND story.archived_at IS NULL
    AND (
      (
        public.sf_actor_role() = 'student'
        AND story.student_id = public.sf_actor_id()
        AND note.state = 'published'
        AND NOT note.internal_only
      )
      OR (
        public.sf_actor_role() = 'mentor'
        AND note.author_id = public.sf_actor_id()
        AND public.sf_is_assigned(story.student_id)
      )
      OR (public.sf_actor_role() = 'admin' AND public.sf_admin_console_enabled())
    );
  IF NOT FOUND THEN
    RAISE EXCEPTION 'mentor note audio not found' USING ERRCODE = 'P0002';
  END IF;
  SELECT * INTO v_media
  FROM public.sf_mentor_note_media
  WHERE note_id = p_note_id AND state = 'verified';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'mentor note audio not found' USING ERRCODE = 'P0002';
  END IF;

  PERFORM public.sf_append_audit(
    'mentor_note.audio_requested', 'mentor_note', v_note.id, 'workspace',
    v_note.student_id, v_note.story_id, NULL, NULL,
    jsonb_build_object('audio_state', v_media.state), NULL,
    CASE WHEN public.sf_actor_role() = 'student' THEN 'both' ELSE 'mentor_only' END
  );
  RETURN jsonb_build_object(
    'noteId', v_note.id, 'objectKey', v_media.object_key,
    'contentType', v_media.content_type, 'byteSize', v_media.byte_size
  );
END
$$;

CREATE OR REPLACE FUNCTION public.sf_discard_mentor_note(
  p_note_id uuid,
  p_expected_version bigint,
  p_surface text DEFAULT 'workspace'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_note public.sf_mentor_notes;
  v_media public.sf_mentor_note_media;
BEGIN
  IF NOT public.sf_mentor_notes_enabled()
     OR public.sf_actor_role() NOT IN ('mentor', 'admin') THEN
    RAISE EXCEPTION 'mentor notes are unavailable' USING ERRCODE = '42501';
  END IF;
  IF p_surface NOT IN ('workspace', 'quick') THEN
    RAISE EXCEPTION 'invalid mentor note surface' USING ERRCODE = '22023';
  END IF;
  SELECT note.* INTO v_note
  FROM public.sf_mentor_notes note
  WHERE note.id = p_note_id
    AND note.author_id = public.sf_actor_id()
    AND note.state = 'draft'
    AND public.sf_can_review_submitted_story(note.story_id)
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'mentor note not found' USING ERRCODE = 'P0002';
  END IF;
  IF p_expected_version IS NULL OR p_expected_version <> v_note.row_version THEN
    RAISE EXCEPTION 'mentor note version conflict' USING ERRCODE = '40001';
  END IF;
  SELECT * INTO v_media
  FROM public.sf_mentor_note_media WHERE note_id = p_note_id FOR UPDATE;

  IF v_media.id IS NOT NULL THEN
    INSERT INTO public.sf_mentor_note_audio_deletion_intents (
      note_id, object_key, requested_by
    ) VALUES (v_note.id, v_media.object_key, public.sf_actor_id())
    ON CONFLICT (object_key) WHERE state = 'pending' DO NOTHING;
    UPDATE public.sf_mentor_note_media
    SET state = 'retired', retired_at = now()
    WHERE id = v_media.id;
  END IF;
  UPDATE public.sf_mentor_notes
  SET state = 'archived', archived_at = now(),
      row_version = row_version + 1, updated_at = now()
  WHERE id = p_note_id RETURNING * INTO v_note;

  PERFORM public.sf_append_audit(
    'mentor_note.discarded', 'mentor_note', v_note.id, p_surface,
    v_note.student_id, v_note.story_id, NULL, NULL,
    jsonb_build_object('state', v_note.state, 'audio_delete_intended', v_media.id IS NOT NULL,
      'row_version', v_note.row_version), NULL, 'mentor_only'
  );
  RETURN jsonb_build_object(
    'noteId', v_note.id, 'state', v_note.state,
    'objectKey', v_media.object_key, 'rowVersion', v_note.row_version
  );
END
$$;

CREATE OR REPLACE FUNCTION public.sf_complete_mentor_note_audio_delete(
  p_note_id uuid,
  p_object_key text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.sf_has_live_identity(ARRAY['mentor', 'admin'])
     OR NOT EXISTS (
       SELECT 1
       FROM public.sf_mentor_note_audio_deletion_intents intent
       JOIN public.sf_mentor_notes note ON note.id = intent.note_id
       WHERE intent.note_id = p_note_id
         AND intent.object_key = p_object_key
         AND intent.state = 'pending'
         AND intent.requested_by = public.sf_actor_id()
         AND note.author_id = public.sf_actor_id()
     ) THEN
    RAISE EXCEPTION 'mentor audio deletion intent not found' USING ERRCODE = '42501';
  END IF;
  UPDATE public.sf_mentor_note_audio_deletion_intents
  SET state = 'deleted', attempts = attempts + 1,
      resolved_at = now(), updated_at = now()
  WHERE note_id = p_note_id AND object_key = p_object_key AND state = 'pending';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'mentor audio deletion intent not found' USING ERRCODE = 'P0002';
  END IF;
END
$$;

REVOKE ALL ON FUNCTION public.sf_story_feature_enabled(text, text[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sf_submit_story(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sf_withdraw_story(uuid, bigint, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sf_update_story_taxonomy(uuid, bigint, text[], text[], text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sf_update_story_priority(uuid, bigint, smallint, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sf_admin_update_story_taxonomy(uuid, bigint, text[], text[], text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sf_forbid_mentor_note_delete() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sf_mentor_notes_enabled() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sf_b1_511_capabilities() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sf_can_review_submitted_story(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sf_create_mentor_note(uuid, text, boolean, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sf_update_mentor_note(uuid, bigint, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sf_publish_mentor_note(uuid, bigint, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sf_archive_mentor_note(uuid, bigint, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sf_list_mentor_notes(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sf_prepare_mentor_note_audio(uuid, bigint, text, bigint, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sf_begin_mentor_note_audio(uuid, bigint, text, text, bigint, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sf_complete_mentor_note_audio(uuid, bigint, text, text, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sf_fail_mentor_note_audio(uuid, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sf_get_mentor_note_audio(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sf_discard_mentor_note(uuid, bigint, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sf_complete_mentor_note_audio_delete(uuid, text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.sf_story_feature_enabled(text, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sf_submit_story(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sf_withdraw_story(uuid, bigint, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sf_update_story_taxonomy(uuid, bigint, text[], text[], text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sf_update_story_priority(uuid, bigint, smallint, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sf_admin_update_story_taxonomy(uuid, bigint, text[], text[], text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sf_mentor_notes_enabled() TO authenticated;
GRANT EXECUTE ON FUNCTION public.sf_b1_511_capabilities() TO authenticated;
GRANT EXECUTE ON FUNCTION public.sf_create_mentor_note(uuid, text, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sf_update_mentor_note(uuid, bigint, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sf_publish_mentor_note(uuid, bigint, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sf_archive_mentor_note(uuid, bigint, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sf_list_mentor_notes(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sf_prepare_mentor_note_audio(uuid, bigint, text, bigint, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sf_begin_mentor_note_audio(uuid, bigint, text, text, bigint, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sf_complete_mentor_note_audio(uuid, bigint, text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sf_fail_mentor_note_audio(uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sf_get_mentor_note_audio(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sf_discard_mentor_note(uuid, bigint, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sf_complete_mentor_note_audio_delete(uuid, text) TO authenticated;

DO $$
DECLARE
  v_expected text[] := ARRAY[
    'inline_priority', 'mentor_notes', 'story_search',
    'story_taxonomy', 'story_workflow'
  ];
BEGIN
  IF (
    SELECT array_agg(key ORDER BY key)
    FROM public.sf_feature_flags
    WHERE key = ANY(v_expected)
  ) IS DISTINCT FROM v_expected THEN
    RAISE EXCEPTION 'B1-511 feature flags were not seeded exactly once';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.sf_feature_flags
    WHERE key = ANY(v_expected)
      AND (
        scope <> 'off'
        OR cardinality(allowlist) <> 0
        OR cardinality(cohorts) <> 0
      )
  ) THEN
    RAISE EXCEPTION 'B1-511 feature flags must be independently default off';
  END IF;
END
$$;

COMMIT;
