-- Migration: 20260728045100_b1_503_story_domain_conformance.sql
-- Authority: B1-503
-- Date: 2026-07-28
-- Depends on: 20260727190000_b1_502_storyforge_background_preference.sql
-- Description: Canonical V5 story, original, lifecycle, notification, and audio-confirmation model.
-- Idempotent: NO

BEGIN;

SELECT pg_advisory_xact_lock(hashtextextended('b1-503-story-domain-conformance', 0));

ALTER TABLE public.sf_users
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS pronouns text,
  ADD COLUMN IF NOT EXISTS academic_year text,
  ADD COLUMN IF NOT EXISTS specialty text,
  ADD COLUMN IF NOT EXISTS application_cycle text;

ALTER TABLE public.sf_stories
  DROP CONSTRAINT IF EXISTS sf_stories_status_check;

ALTER TABLE public.sf_stories
  ADD COLUMN IF NOT EXISTS legacy_status_at_b1_503 text,
  ADD COLUMN IF NOT EXISTS prefix_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS lesson text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS themes text[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS student_star boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS mentor_star boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS birds text[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS positions text[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS revised boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES public.sf_users(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS row_version bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS student_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS status_changed_at timestamptz,
  ADD COLUMN IF NOT EXISTS feedback_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS feedback_opened_at timestamptz,
  ADD COLUMN IF NOT EXISTS student_responded_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_by uuid REFERENCES public.sf_users(id) ON DELETE RESTRICT;

UPDATE public.sf_stories
SET legacy_status_at_b1_503 = coalesce(legacy_status_at_b1_503, status),
    student_star = student_star OR starred,
    revised = revised OR status = 'resubmitted'
      OR (
        status = 'opened'
        AND EXISTS (
          SELECT 1
          FROM public.sf_story_revisions revision
          WHERE revision.story_id = sf_stories.id
            AND revision.reason = 'resubmit'
        )
      ),
    status = CASE status
      WHEN 'submitted' THEN 'awaiting'
      WHEN 'resubmitted' THEN 'awaiting'
      WHEN 'opened' THEN 'awaiting'
      WHEN 'needs_revision' THEN 'changes'
      ELSE status
    END;

UPDATE public.sf_stories story
SET last_submitted_at = coalesce(
      (
        SELECT max(revision.created_at)
        FROM public.sf_story_revisions revision
        WHERE revision.story_id = story.id
          AND revision.reason IN ('submit', 'resubmit')
      ),
      story.submitted_at
    ),
    submitted_at = coalesce(
      (
        SELECT min(revision.created_at)
        FROM public.sf_story_revisions revision
        WHERE revision.story_id = story.id
          AND revision.reason IN ('submit', 'resubmit')
      ),
      story.submitted_at
    ),
    student_updated_at = coalesce(
      (
        SELECT max(revision.created_at)
        FROM public.sf_story_revisions revision
        WHERE revision.story_id = story.id
          AND revision.reason IN ('capture', 'student_edit', 'submit', 'resubmit')
      ),
      story.created_at
    ),
    feedback_sent_at = (
      SELECT max(feedback.created_at)
      FROM public.sf_feedback feedback
      WHERE feedback.story_id = story.id
    ),
    student_responded_at = (
      SELECT max(revision.created_at)
      FROM public.sf_story_revisions revision
      WHERE revision.story_id = story.id
        AND revision.reason = 'resubmit'
    ),
    status_changed_at = coalesce(
      (
        SELECT max(event.created_at)
        FROM public.sf_audit_events event
        WHERE event.entity_type = 'story'
          AND event.entity_id = story.id
          AND (
            event.action = 'story.submitted'
            OR (
              event.action = 'story.reviewed'
              AND coalesce(event.new_value->>'status', '') <> 'opened'
            )
          )
      ),
      story.submitted_at,
      story.created_at
    ),
    reviewed_by = coalesce(
      story.reviewed_by,
      (
        SELECT feedback.mentor_id
        FROM public.sf_feedback feedback
        WHERE feedback.story_id = story.id
        ORDER BY feedback.created_at DESC, feedback.id DESC
        LIMIT 1
      )
    );

ALTER TABLE public.sf_stories
  ADD CONSTRAINT sf_stories_status_check
  CHECK (status IN ('private', 'awaiting', 'in_review', 'changes', 'reviewed', 'approved'))
  NOT VALID,
  ADD CONSTRAINT sf_stories_themes_check
  CHECK (themes <@ ARRAY[
    'mistake', 'patient', 'leader', 'conflict', 'comm',
    'team', 'resil', 'growth', 'identity', 'advoc'
  ]::text[])
  NOT VALID,
  ADD CONSTRAINT sf_stories_uses_check
  CHECK (uses <@ ARRAY['ps', 'iv', 'letter', 'later']::text[])
  NOT VALID,
  ADD CONSTRAINT sf_stories_birds_check
  CHECK (birds <@ ARRAY['peacock', 'dove', 'owl', 'eagle']::text[])
  NOT VALID,
  ADD CONSTRAINT sf_stories_positions_check
  CHECK (positions <@ ARRAY['pd', 'apd', 'faculty', 'resident', 'behaviorist']::text[])
  NOT VALID,
  ADD CONSTRAINT sf_stories_row_version_check
  CHECK (row_version >= 0)
  NOT VALID;

ALTER TABLE public.sf_stories VALIDATE CONSTRAINT sf_stories_status_check;
ALTER TABLE public.sf_stories VALIDATE CONSTRAINT sf_stories_themes_check;
ALTER TABLE public.sf_stories VALIDATE CONSTRAINT sf_stories_uses_check;
ALTER TABLE public.sf_stories VALIDATE CONSTRAINT sf_stories_birds_check;
ALTER TABLE public.sf_stories VALIDATE CONSTRAINT sf_stories_positions_check;
ALTER TABLE public.sf_stories VALIDATE CONSTRAINT sf_stories_row_version_check;

CREATE TABLE IF NOT EXISTS public.sf_story_originals (
  story_id uuid PRIMARY KEY REFERENCES public.sf_stories(id) ON DELETE RESTRICT,
  original_transcript text NOT NULL DEFAULT '',
  audio_asset_id uuid REFERENCES public.sf_audio_assets(id) ON DELETE RESTRICT,
  capture_type text NOT NULL CHECK (capture_type IN ('text', 'audio', 'imported')),
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.sf_story_originals
  (story_id, original_transcript, audio_asset_id, capture_type, created_at)
SELECT story.id, story.original_text, audio.id, story.capture_type, story.created_at
FROM public.sf_stories story
LEFT JOIN LATERAL (
  SELECT asset.id
  FROM public.sf_audio_assets asset
  WHERE asset.story_id = story.id
    AND asset.state = 'verified'
  ORDER BY asset.verified_at DESC NULLS LAST, asset.created_at DESC
  LIMIT 1
) audio ON true
WHERE story.capture_type <> 'audio' OR audio.id IS NOT NULL
ON CONFLICT (story_id) DO NOTHING;

ALTER TABLE public.sf_feedback
  ADD COLUMN IF NOT EXISTS seen_by_student_at timestamptz;

CREATE TABLE IF NOT EXISTS public.sf_story_reflections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id uuid NOT NULL REFERENCES public.sf_stories(id) ON DELETE RESTRICT,
  prompt text NOT NULL CHECK (length(trim(prompt)) BETWEEN 3 AND 2000),
  answer text,
  from_mentor boolean NOT NULL DEFAULT false,
  author_id uuid NOT NULL REFERENCES public.sf_users(id) ON DELETE RESTRICT,
  seen_by_student_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  answered_at timestamptz
);

CREATE INDEX IF NOT EXISTS sf_story_reflections_story_idx
  ON public.sf_story_reflections (story_id, created_at);

CREATE TABLE IF NOT EXISTS public.sf_use_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id uuid NOT NULL REFERENCES public.sf_stories(id) ON DELETE RESTRICT,
  use_key text NOT NULL CHECK (use_key IN ('ps', 'iv', 'letter', 'later')),
  suggested_by uuid NOT NULL REFERENCES public.sf_users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  withdrawn_at timestamptz,
  accepted_at timestamptz,
  accepted_by uuid REFERENCES public.sf_users(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS sf_use_suggestions_story_idx
  ON public.sf_use_suggestions (story_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.sf_story_drafts (
  user_id uuid PRIMARY KEY REFERENCES public.sf_users(id) ON DELETE RESTRICT,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  row_version bigint NOT NULL DEFAULT 0 CHECK (row_version >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sf_audit_events
  ADD COLUMN IF NOT EXISTS actor_display text,
  ADD COLUMN IF NOT EXISTS student_id uuid REFERENCES public.sf_users(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS story_id uuid REFERENCES public.sf_stories(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS question_id uuid REFERENCES public.sf_questions(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS detail text,
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'both'
    CHECK (visibility IN ('both', 'mentor_only'));

UPDATE public.sf_audit_events event
SET actor_display = coalesce(
  event.actor_display,
  (SELECT display_name FROM public.sf_users actor WHERE actor.id = event.actor_id),
  'StoryForge system'
),
story_id = CASE
  WHEN event.entity_type = 'story' THEN event.entity_id
  ELSE event.story_id
END;

CREATE INDEX IF NOT EXISTS sf_audit_actor_created_idx
  ON public.sf_audit_events (actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS sf_audit_story_created_idx
  ON public.sf_audit_events (story_id, created_at DESC);

ALTER TABLE public.sf_notifications
  ADD COLUMN IF NOT EXISTS question_id uuid REFERENCES public.sf_questions(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS event_category text NOT NULL DEFAULT 'system'
    CHECK (event_category IN (
      'status', 'feedback', 'ask', 'score', 'star', 'classification',
      'questions', 'coaching', 'followup', 'system'
    )),
  ADD COLUMN IF NOT EXISTS first_event_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_event_at timestamptz;

UPDATE public.sf_notifications
SET first_event_at = coalesce(first_event_at, created_at),
    last_event_at = coalesce(last_event_at, created_at),
    event_category = CASE
      WHEN event_key ~ '^story[.](in_review|changes|reviewed|approved|opened|needs_revision)$' THEN 'status'
      WHEN event_key ~ 'feedback' THEN 'feedback'
      ELSE event_category
    END;

ALTER TABLE public.sf_notifications
  ALTER COLUMN first_event_at SET DEFAULT now(),
  ALTER COLUMN last_event_at SET DEFAULT now();

ALTER TABLE public.sf_audio_assets
  ADD COLUMN IF NOT EXISTS duration_ms integer CHECK (duration_ms IS NULL OR duration_ms >= 0),
  ADD COLUMN IF NOT EXISTS transcription_status text NOT NULL DEFAULT 'none'
    CHECK (transcription_status IN ('none', 'pending', 'processing', 'complete', 'failed')),
  ADD COLUMN IF NOT EXISTS transcription_error text,
  ADD COLUMN IF NOT EXISTS immutable_at timestamptz;

CREATE OR REPLACE FUNCTION public.sf_forbid_original_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'StoryForge originals are append-only' USING ERRCODE = '42501';
END
$$;

DROP TRIGGER IF EXISTS sf_story_originals_append_only ON public.sf_story_originals;
CREATE TRIGGER sf_story_originals_append_only
BEFORE UPDATE OR DELETE ON public.sf_story_originals
FOR EACH ROW EXECUTE FUNCTION public.sf_forbid_original_mutation();

CREATE OR REPLACE FUNCTION public.sf_forbid_revision_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'StoryForge story revisions are append-only' USING ERRCODE = '42501';
END
$$;

DROP TRIGGER IF EXISTS sf_story_revisions_append_only ON public.sf_story_revisions;
CREATE TRIGGER sf_story_revisions_append_only
BEFORE UPDATE OR DELETE ON public.sf_story_revisions
FOR EACH ROW EXECUTE FUNCTION public.sf_forbid_revision_mutation();

ALTER TABLE public.sf_story_originals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sf_story_reflections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sf_use_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sf_story_drafts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sf_stories_read ON public.sf_stories;
CREATE POLICY sf_stories_read ON public.sf_stories
FOR SELECT TO authenticated
USING (
  public.sf_has_live_identity()
  AND (
    student_id = public.sf_actor_id()
    OR (
      public.sf_actor_role() = 'mentor'
      AND status <> 'private'
      AND archived_at IS NULL
      AND public.sf_is_assigned(student_id)
    )
  )
);

DROP POLICY IF EXISTS sf_revisions_read ON public.sf_story_revisions;
CREATE POLICY sf_revisions_read ON public.sf_story_revisions
FOR SELECT TO authenticated
USING (
  public.sf_has_live_identity()
  AND EXISTS (
    SELECT 1 FROM public.sf_stories story
    WHERE story.id = sf_story_revisions.story_id
      AND (
        story.student_id = public.sf_actor_id()
        OR (
          public.sf_actor_role() = 'mentor'
          AND story.status <> 'private'
          AND story.archived_at IS NULL
          AND public.sf_is_assigned(story.student_id)
        )
      )
  )
);

DROP POLICY IF EXISTS sf_feedback_read ON public.sf_feedback;
CREATE POLICY sf_feedback_read ON public.sf_feedback
FOR SELECT TO authenticated
USING (
  public.sf_has_live_identity()
  AND EXISTS (
    SELECT 1 FROM public.sf_stories story
    WHERE story.id = sf_feedback.story_id
      AND (
        story.student_id = public.sf_actor_id()
        OR (
          public.sf_actor_role() = 'mentor'
          AND story.status <> 'private'
          AND story.archived_at IS NULL
          AND public.sf_is_assigned(story.student_id)
        )
      )
  )
);

DROP POLICY IF EXISTS sf_audio_read ON public.sf_audio_assets;
CREATE POLICY sf_audio_read ON public.sf_audio_assets
FOR SELECT TO authenticated
USING (
  public.sf_has_live_identity()
  AND (
    student_id = public.sf_actor_id()
    OR EXISTS (
      SELECT 1 FROM public.sf_stories story
      WHERE story.id = sf_audio_assets.story_id
        AND story.status <> 'private'
        AND story.archived_at IS NULL
        AND public.sf_actor_role() = 'mentor'
        AND public.sf_is_assigned(story.student_id)
    )
  )
);

DROP POLICY IF EXISTS sf_story_questions_read ON public.sf_story_questions;
CREATE POLICY sf_story_questions_read ON public.sf_story_questions
FOR SELECT TO authenticated
USING (
  public.sf_has_live_identity()
  AND EXISTS (
    SELECT 1 FROM public.sf_stories story
    WHERE story.id = sf_story_questions.story_id
      AND (
        story.student_id = public.sf_actor_id()
        OR (
          public.sf_actor_role() = 'mentor'
          AND story.status <> 'private'
          AND story.archived_at IS NULL
          AND public.sf_is_assigned(story.student_id)
        )
      )
  )
);

DROP POLICY IF EXISTS sf_story_originals_read ON public.sf_story_originals;
CREATE POLICY sf_story_originals_read ON public.sf_story_originals
FOR SELECT TO authenticated
USING (
  public.sf_has_live_identity()
  AND EXISTS (
    SELECT 1
    FROM public.sf_stories story
    WHERE story.id = sf_story_originals.story_id
      AND story.archived_at IS NULL
      AND (
        story.student_id = public.sf_actor_id()
        OR (
          public.sf_actor_role() = 'mentor'
          AND story.status <> 'private'
          AND public.sf_is_assigned(story.student_id)
        )
      )
  )
);

DROP POLICY IF EXISTS sf_story_reflections_read ON public.sf_story_reflections;
CREATE POLICY sf_story_reflections_read ON public.sf_story_reflections
FOR SELECT TO authenticated
USING (
  public.sf_has_live_identity()
  AND EXISTS (
    SELECT 1
    FROM public.sf_stories story
    WHERE story.id = sf_story_reflections.story_id
      AND story.archived_at IS NULL
      AND (
        story.student_id = public.sf_actor_id()
        OR (
          public.sf_actor_role() = 'mentor'
          AND story.status <> 'private'
          AND public.sf_is_assigned(story.student_id)
        )
      )
  )
);

DROP POLICY IF EXISTS sf_use_suggestions_read ON public.sf_use_suggestions;
CREATE POLICY sf_use_suggestions_read ON public.sf_use_suggestions
FOR SELECT TO authenticated
USING (
  public.sf_has_live_identity()
  AND EXISTS (
    SELECT 1
    FROM public.sf_stories story
    WHERE story.id = sf_use_suggestions.story_id
      AND story.archived_at IS NULL
      AND (
        story.student_id = public.sf_actor_id()
        OR (
          public.sf_actor_role() = 'mentor'
          AND story.status <> 'private'
          AND public.sf_is_assigned(story.student_id)
        )
      )
  )
);

DROP POLICY IF EXISTS sf_story_drafts_read ON public.sf_story_drafts;
CREATE POLICY sf_story_drafts_read ON public.sf_story_drafts
FOR SELECT TO authenticated
USING (
  public.sf_has_live_identity(ARRAY['student'])
  AND user_id = public.sf_actor_id()
);

REVOKE ALL ON public.sf_story_originals, public.sf_story_reflections,
  public.sf_use_suggestions, public.sf_story_drafts
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.sf_story_originals, public.sf_story_reflections,
  public.sf_use_suggestions, public.sf_story_drafts
  TO authenticated;

CREATE OR REPLACE FUNCTION public.sf_append_audit(
  p_action text,
  p_entity_type text,
  p_entity_id uuid,
  p_surface text,
  p_student_id uuid DEFAULT NULL,
  p_story_id uuid DEFAULT NULL,
  p_question_id uuid DEFAULT NULL,
  p_previous_value jsonb DEFAULT NULL,
  p_new_value jsonb DEFAULT NULL,
  p_detail text DEFAULT NULL,
  p_visibility text DEFAULT 'both'
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
  IF p_surface NOT IN ('library', 'quick', 'workspace', 'workshop', 'teach', 'import', 'system') THEN
    RAISE EXCEPTION 'invalid StoryForge surface' USING ERRCODE = '22023';
  END IF;
  IF p_visibility NOT IN ('both', 'mentor_only') THEN
    RAISE EXCEPTION 'invalid audit visibility' USING ERRCODE = '22023';
  END IF;

  SELECT display_name INTO v_actor_display
  FROM public.sf_users
  WHERE id = public.sf_actor_id();

  INSERT INTO public.sf_audit_events (
    actor_id, actor_role, actor_display, action, entity_type, entity_id,
    surface, student_id, story_id, question_id, previous_value, new_value,
    detail, visibility
  )
  VALUES (
    public.sf_actor_id(), public.sf_actor_role(),
    coalesce(v_actor_display, 'StoryForge system'),
    p_action, p_entity_type, p_entity_id, p_surface, p_student_id, p_story_id,
    p_question_id, p_previous_value, p_new_value, p_detail, p_visibility
  )
  RETURNING id INTO v_event_id;

  RETURN v_event_id;
END
$$;

CREATE OR REPLACE FUNCTION public.sf_emit_notification(
  p_recipient_id uuid,
  p_actor_id uuid,
  p_story_id uuid,
  p_question_id uuid,
  p_event_key text,
  p_event_category text,
  p_title text,
  p_body text,
  p_deep_link text
)
RETURNS public.sf_notifications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_existing public.sf_notifications;
  v_notification public.sf_notifications;
BEGIN
  IF p_event_category NOT IN (
    'status', 'feedback', 'ask', 'score', 'star', 'classification',
    'questions', 'coaching', 'followup', 'system'
  ) THEN
    RAISE EXCEPTION 'invalid notification category' USING ERRCODE = '22023';
  END IF;
  IF p_deep_link NOT LIKE '/%' THEN
    RAISE EXCEPTION 'invalid StoryForge deep link' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_existing
  FROM public.sf_notifications notification
  WHERE notification.recipient_id = p_recipient_id
    AND notification.story_id = p_story_id
    AND notification.read_at IS NULL
    AND coalesce(notification.last_event_at, notification.created_at) >= now() - interval '5 minutes'
  ORDER BY coalesce(notification.last_event_at, notification.created_at) DESC,
           notification.id DESC
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    IF v_existing.event_category = 'status' AND p_event_category <> 'status' THEN
      UPDATE public.sf_notifications
      SET body = CASE
            WHEN body LIKE '%New feedback is attached.%' THEN body
            ELSE rtrim(body) || ' New feedback is attached.'
          END,
          created_at = now(),
          last_event_at = now()
      WHERE id = v_existing.id
      RETURNING * INTO v_notification;
    ELSE
      UPDATE public.sf_notifications
      SET actor_id = p_actor_id,
          question_id = p_question_id,
          event_key = p_event_key,
          event_category = p_event_category,
          title = p_title,
          body = p_body,
          deep_link = p_deep_link,
          created_at = now(),
          last_event_at = now()
      WHERE id = v_existing.id
      RETURNING * INTO v_notification;
    END IF;
  ELSE
    INSERT INTO public.sf_notifications (
      recipient_id, actor_id, story_id, question_id, event_key,
      event_category, title, body, deep_link, first_event_at, last_event_at
    )
    VALUES (
      p_recipient_id, p_actor_id, p_story_id, p_question_id, p_event_key,
      p_event_category, p_title, p_body, p_deep_link, now(), now()
    )
    RETURNING * INTO v_notification;
  END IF;

  RETURN v_notification;
END
$$;

CREATE OR REPLACE FUNCTION public.sf_create_story_v5(
  p_payload jsonb,
  p_surface text DEFAULT 'quick'
)
RETURNS public.sf_stories
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_story public.sf_stories;
  v_capture_type text := coalesce(nullif(p_payload->>'captureType', ''), 'text');
  v_title text := coalesce(nullif(trim(p_payload->>'title'), ''), 'Untitled story');
  v_text text := coalesce(p_payload->>'text', '');
  v_lesson text := coalesce(p_payload->>'lesson', '');
  v_prefix boolean := coalesce((p_payload->>'prefixEnabled')::boolean, true);
  v_score smallint := nullif(p_payload->>'studentScore', '')::smallint;
  v_draft_version bigint := nullif(p_payload->>'draftVersion', '')::bigint;
  v_draft public.sf_story_drafts;
  v_themes text[] := ARRAY[]::text[];
  v_uses text[] := ARRAY[]::text[];
BEGIN
  IF NOT public.sf_has_live_identity(ARRAY['student']) THEN
    RAISE EXCEPTION 'eligible student identity required' USING ERRCODE = '42501';
  END IF;
  IF v_capture_type NOT IN ('text', 'audio', 'imported') THEN
    RAISE EXCEPTION 'invalid capture type' USING ERRCODE = '22023';
  END IF;
  IF p_surface NOT IN ('library', 'quick', 'workspace') THEN
    RAISE EXCEPTION 'invalid surface' USING ERRCODE = '22023';
  END IF;
  IF p_payload ? 'draftVersion' THEN
    IF v_draft_version IS NULL OR v_draft_version < 0 THEN
      RAISE EXCEPTION 'a valid capture draft version is required'
        USING ERRCODE = '22023';
    END IF;
    SELECT * INTO v_draft
    FROM public.sf_story_drafts
    WHERE user_id = public.sf_actor_id()
    FOR UPDATE;
    IF FOUND AND v_draft.row_version <> v_draft_version THEN
      RAISE EXCEPTION 'draft changed in another session' USING ERRCODE = '40001';
    ELSIF NOT FOUND AND v_draft_version <> 0 THEN
      RAISE EXCEPTION 'draft changed in another session' USING ERRCODE = '40001';
    END IF;
  END IF;
  IF jsonb_typeof(p_payload->'themes') = 'array' THEN
    SELECT coalesce(array_agg(value), ARRAY[]::text[]) INTO v_themes
    FROM jsonb_array_elements_text(p_payload->'themes') item(value);
  END IF;
  IF jsonb_typeof(p_payload->'uses') = 'array' THEN
    SELECT coalesce(array_agg(value), ARRAY[]::text[]) INTO v_uses
    FROM jsonb_array_elements_text(p_payload->'uses') item(value);
  END IF;

  INSERT INTO public.sf_stories (
    student_id, title, original_text, current_text, capture_type, prefix_enabled,
    lesson, student_score, themes, uses, student_updated_at, status_changed_at
  )
  VALUES (
    public.sf_actor_id(), v_title, v_text, v_text, v_capture_type, v_prefix,
    v_lesson, v_score, v_themes, v_uses, now(), now()
  )
  RETURNING * INTO v_story;

  -- Audio originals are inserted only when a verified recording receives its
  -- final transcript. This prevents an immutable placeholder from blocking
  -- the real original. Text/imported captures are complete at creation time.
  IF v_capture_type <> 'audio' THEN
    INSERT INTO public.sf_story_originals (
      story_id, original_transcript, capture_type, created_at
    )
    VALUES (v_story.id, v_text, v_capture_type, v_story.created_at);
  END IF;

  INSERT INTO public.sf_story_revisions (
    story_id, revision_no, text_snapshot, title_snapshot, actor_id, reason
  )
  VALUES (
    v_story.id, 0, v_story.current_text, v_story.title,
    public.sf_actor_id(), 'capture'
  );

  PERFORM public.sf_append_audit(
    'story.captured', 'story', v_story.id, p_surface,
    v_story.student_id, v_story.id, NULL, NULL,
    jsonb_build_object(
      'status', v_story.status,
      'capture_type', v_story.capture_type,
      'prefix_enabled', v_story.prefix_enabled
    )
  );

  IF p_payload ? 'draftVersion' THEN
    INSERT INTO public.sf_story_drafts (user_id, payload)
    VALUES (public.sf_actor_id(), '{}'::jsonb)
    ON CONFLICT (user_id) DO UPDATE
    SET payload = '{}'::jsonb,
        row_version = sf_story_drafts.row_version + 1,
        updated_at = now()
    RETURNING * INTO v_draft;

    PERFORM public.sf_append_audit(
      'story.draft_consumed', 'story_draft', v_draft.user_id, 'quick',
      v_draft.user_id, v_story.id, NULL, NULL,
      jsonb_build_object('row_version', v_draft.row_version)
    );
  END IF;

  RETURN v_story;
END
$$;

CREATE OR REPLACE FUNCTION public.sf_create_story(
  p_title text,
  p_text text,
  p_capture_type text DEFAULT 'text',
  p_surface text DEFAULT 'quick'
)
RETURNS public.sf_stories
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT *
  FROM public.sf_create_story_v5(
    jsonb_build_object(
      'title', p_title,
      'text', p_text,
      'captureType', p_capture_type
    ),
    p_surface
  )
$$;

CREATE OR REPLACE FUNCTION public.sf_update_story_v5(
  p_story_id uuid,
  p_patch jsonb,
  p_expected_version bigint DEFAULT NULL,
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
  v_title text;
  v_text text;
  v_lesson text;
  v_prefix boolean;
  v_score smallint;
  v_star boolean;
  v_themes text[];
  v_uses text[];
  v_narrative_changed boolean;
  v_title_changed boolean;
  v_status_changed boolean := false;
  v_revision_no integer;
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
  IF p_expected_version IS NOT NULL AND p_expected_version <> v_before.row_version THEN
    RAISE EXCEPTION 'story changed in another session' USING ERRCODE = '40001';
  END IF;

  v_title := CASE
    WHEN p_patch ? 'title' THEN coalesce(nullif(trim(p_patch->>'title'), ''), v_before.title)
    ELSE v_before.title
  END;
  v_text := CASE
    WHEN p_patch ? 'text' THEN coalesce(p_patch->>'text', '')
    ELSE v_before.current_text
  END;
  v_lesson := CASE
    WHEN p_patch ? 'lesson' THEN coalesce(p_patch->>'lesson', '')
    ELSE v_before.lesson
  END;
  v_prefix := CASE
    WHEN p_patch ? 'prefixEnabled' THEN (p_patch->>'prefixEnabled')::boolean
    ELSE v_before.prefix_enabled
  END;
  v_score := CASE
    WHEN p_patch ? 'studentScore' THEN nullif(p_patch->>'studentScore', '')::smallint
    ELSE v_before.student_score
  END;
  v_star := CASE
    WHEN p_patch ? 'studentStar' THEN (p_patch->>'studentStar')::boolean
    ELSE v_before.student_star
  END;
  v_themes := v_before.themes;
  IF jsonb_typeof(p_patch->'themes') = 'array' THEN
    SELECT coalesce(array_agg(value), ARRAY[]::text[]) INTO v_themes
    FROM jsonb_array_elements_text(p_patch->'themes') item(value);
  END IF;
  v_uses := v_before.uses;
  IF jsonb_typeof(p_patch->'uses') = 'array' THEN
    SELECT coalesce(array_agg(value), ARRAY[]::text[]) INTO v_uses
    FROM jsonb_array_elements_text(p_patch->'uses') item(value);
  END IF;

  v_narrative_changed := v_text IS DISTINCT FROM v_before.current_text;
  v_title_changed := v_title IS DISTINCT FROM v_before.title;
  v_revision_no := v_before.revision_no
    + CASE WHEN v_narrative_changed OR v_title_changed THEN 1 ELSE 0 END;
  -- In the executed canonical V5 workflow, changing the Working Version after
  -- requested changes is the resubmission action.
  v_status_changed := v_narrative_changed AND v_before.status = 'changes';

  UPDATE public.sf_stories
  SET title = v_title,
      current_text = v_text,
      lesson = v_lesson,
      prefix_enabled = v_prefix,
      student_score = v_score,
      student_star = v_star,
      themes = v_themes,
      uses = v_uses,
      revision_no = v_revision_no,
      revised = CASE
        WHEN v_narrative_changed AND status <> 'private' THEN true
        ELSE revised
      END,
      status = CASE WHEN v_status_changed THEN 'awaiting' ELSE status END,
      student_responded_at = CASE
        WHEN v_narrative_changed AND status <> 'private' THEN now()
        ELSE student_responded_at
      END,
      last_submitted_at = CASE
        WHEN v_status_changed THEN now()
        ELSE last_submitted_at
      END,
      status_changed_at = CASE
        WHEN v_status_changed THEN now()
        ELSE status_changed_at
      END,
      student_updated_at = now(),
      row_version = row_version + 1,
      updated_at = now()
  WHERE id = p_story_id
  RETURNING * INTO v_story;

  UPDATE public.sf_use_suggestions
  SET accepted_at = coalesce(accepted_at, now()),
      accepted_by = coalesce(accepted_by, public.sf_actor_id())
  WHERE story_id = v_story.id
    AND withdrawn_at IS NULL
    AND accepted_at IS NULL
    AND use_key = ANY(v_story.uses);

  IF v_narrative_changed OR v_title_changed THEN
    INSERT INTO public.sf_story_revisions (
      story_id, revision_no, text_snapshot, title_snapshot, actor_id, reason
    )
    VALUES (
      v_story.id, v_story.revision_no, v_story.current_text, v_story.title,
      public.sf_actor_id(), CASE WHEN v_status_changed THEN 'resubmit' ELSE 'student_edit' END
    );
  END IF;

  PERFORM public.sf_append_audit(
    CASE
      WHEN v_status_changed THEN 'story.revised_and_resubmitted'
      WHEN v_narrative_changed THEN 'story.working_version_edited'
      WHEN v_title_changed THEN 'story.title_renamed'
      WHEN v_lesson IS DISTINCT FROM v_before.lesson THEN 'story.lesson_edited'
      WHEN v_score IS DISTINCT FROM v_before.student_score THEN 'story.student_score_updated'
      WHEN v_star IS DISTINCT FROM v_before.student_star THEN 'story.student_star_updated'
      ELSE 'story.student_fields_updated'
    END,
    'story', v_story.id, p_surface, v_story.student_id, v_story.id, NULL,
    jsonb_build_object(
      'title', v_before.title,
      'revision_no', v_before.revision_no,
      'status', v_before.status,
      'student_score', v_before.student_score,
      'student_star', v_before.student_star,
      'lesson', v_before.lesson,
      'themes', v_before.themes,
      'uses', v_before.uses
    ),
    jsonb_build_object(
      'title', v_story.title,
      'revision_no', v_story.revision_no,
      'status', v_story.status,
      'student_score', v_story.student_score,
      'student_star', v_story.student_star,
      'lesson', v_story.lesson,
      'themes', v_story.themes,
      'uses', v_story.uses
    )
  );

  RETURN v_story;
END
$$;

CREATE OR REPLACE FUNCTION public.sf_update_story(
  p_story_id uuid,
  p_title text,
  p_text text,
  p_student_score smallint DEFAULT NULL,
  p_uses text[] DEFAULT NULL,
  p_surface text DEFAULT 'workspace'
)
RETURNS public.sf_stories
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT *
  FROM public.sf_update_story_v5(
    p_story_id,
    jsonb_build_object(
      'title', p_title,
      'text', p_text,
      'studentScore', p_student_score,
      'uses', to_jsonb(p_uses)
    ),
    NULL,
    p_surface
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
  IF NOT EXISTS (
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
  )
  VALUES (
    v_story.id, v_story.revision_no, v_story.current_text, v_story.title,
    public.sf_actor_id(), CASE WHEN v_resubmit THEN 'resubmit' ELSE 'submit' END
  );

  PERFORM public.sf_append_audit(
    CASE WHEN v_resubmit THEN 'story.resubmitted' ELSE 'story.submitted' END,
    'story', v_story.id, p_surface, v_story.student_id, v_story.id, NULL,
    jsonb_build_object('status', v_before.status, 'revised', v_before.revised),
    jsonb_build_object('status', v_story.status, 'revised', v_story.revised)
  );

  RETURN v_story;
END
$$;

CREATE OR REPLACE FUNCTION public.sf_record_story_view(
  p_story_id uuid,
  p_surface text DEFAULT 'quick'
)
RETURNS public.sf_stories
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_story public.sf_stories;
  v_seen_count integer := 0;
  v_rows integer := 0;
BEGIN
  IF NOT public.sf_has_live_identity() THEN
    RAISE EXCEPTION 'eligible identity required' USING ERRCODE = '42501';
  END IF;
  IF p_surface NOT IN ('library', 'quick', 'workspace', 'workshop', 'teach') THEN
    RAISE EXCEPTION 'invalid surface' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_story
  FROM public.sf_stories
  WHERE id = p_story_id
    AND archived_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'story not found' USING ERRCODE = 'P0002';
  END IF;

  IF public.sf_actor_role() = 'mentor' THEN
    IF v_story.status = 'private' OR NOT public.sf_is_assigned(v_story.student_id) THEN
      RAISE EXCEPTION 'story not found' USING ERRCODE = 'P0002';
    END IF;
    IF v_story.opened_at IS NULL THEN
      UPDATE public.sf_stories
      SET opened_at = now()
      WHERE id = p_story_id
      RETURNING * INTO v_story;

      PERFORM public.sf_append_audit(
        'story.opened', 'story', v_story.id, p_surface,
        v_story.student_id, v_story.id, NULL, NULL,
        jsonb_build_object('status', v_story.status),
        'First mentor open; lifecycle status unchanged'
      );
    END IF;
  ELSIF public.sf_actor_role() = 'student' AND v_story.student_id = public.sf_actor_id() THEN
    UPDATE public.sf_feedback
    SET seen_by_student_at = coalesce(seen_by_student_at, now())
    WHERE story_id = p_story_id
      AND seen_by_student_at IS NULL;
    GET DIAGNOSTICS v_seen_count = ROW_COUNT;

    UPDATE public.sf_story_reflections
    SET seen_by_student_at = coalesce(seen_by_student_at, now())
    WHERE story_id = p_story_id
      AND from_mentor
      AND seen_by_student_at IS NULL;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    v_seen_count := v_seen_count + v_rows;

    UPDATE public.sf_notifications
    SET read_at = coalesce(read_at, now())
    WHERE recipient_id = public.sf_actor_id()
      AND story_id = p_story_id
      AND read_at IS NULL;

    IF v_seen_count > 0 AND v_story.feedback_sent_at IS NOT NULL THEN
      UPDATE public.sf_stories
      SET feedback_opened_at = coalesce(feedback_opened_at, now())
      WHERE id = p_story_id
      RETURNING * INTO v_story;

      PERFORM public.sf_append_audit(
        'story.feedback_opened', 'story', v_story.id, p_surface,
        v_story.student_id, v_story.id, NULL, NULL,
        jsonb_build_object('feedback_opened_at', v_story.feedback_opened_at)
      );
    END IF;
  ELSE
    RAISE EXCEPTION 'story not found' USING ERRCODE = 'P0002';
  END IF;

  RETURN v_story;
END
$$;

CREATE OR REPLACE FUNCTION public.sf_open_story(
  p_story_id uuid,
  p_surface text DEFAULT 'quick'
)
RETURNS public.sf_stories
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT * FROM public.sf_record_story_view(p_story_id, p_surface)
$$;

CREATE OR REPLACE FUNCTION public.sf_set_story_status(
  p_story_id uuid,
  p_status text,
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
  v_actor_name text;
  v_notification_title text;
  v_notification_body text;
BEGIN
  IF NOT public.sf_has_live_identity(ARRAY['mentor']) THEN
    RAISE EXCEPTION 'eligible mentor identity required' USING ERRCODE = '42501';
  END IF;
  IF p_status NOT IN ('in_review', 'changes', 'reviewed', 'approved') THEN
    RAISE EXCEPTION 'invalid mentor status' USING ERRCODE = '22023';
  END IF;
  IF p_surface NOT IN ('library', 'quick', 'workspace', 'teach') THEN
    RAISE EXCEPTION 'invalid surface' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_before
  FROM public.sf_stories
  WHERE id = p_story_id
    AND archived_at IS NULL
  FOR UPDATE;
  IF NOT FOUND OR v_before.status = 'private' OR NOT public.sf_is_assigned(v_before.student_id) THEN
    RAISE EXCEPTION 'story not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_before.status = p_status THEN
    RETURN v_before;
  END IF;

  SELECT display_name INTO v_actor_name
  FROM public.sf_users
  WHERE id = public.sf_actor_id();

  UPDATE public.sf_stories
  SET status = p_status,
      revised = CASE
        WHEN p_status IN ('changes', 'reviewed', 'approved') THEN false
        ELSE revised
      END,
      reviewed_by = CASE
        WHEN p_status IN ('changes', 'reviewed', 'approved') THEN public.sf_actor_id()
        ELSE reviewed_by
      END,
      reviewed_at = CASE
        WHEN p_status IN ('changes', 'reviewed', 'approved') THEN now()
        ELSE reviewed_at
      END,
      approved_at = CASE WHEN p_status = 'approved' THEN now() ELSE approved_at END,
      status_changed_at = now(),
      row_version = row_version + 1,
      updated_at = now()
  WHERE id = p_story_id
  RETURNING * INTO v_story;

  PERFORM public.sf_append_audit(
    'story.status_changed', 'story', v_story.id, p_surface,
    v_story.student_id, v_story.id, NULL,
    jsonb_build_object('status', v_before.status, 'reviewed_by', v_before.reviewed_by),
    jsonb_build_object('status', v_story.status, 'reviewed_by', v_story.reviewed_by)
  );

  v_notification_title := CASE p_status
    WHEN 'in_review' THEN 'Review started'
    WHEN 'changes' THEN 'Changes requested'
    WHEN 'reviewed' THEN 'Story reviewed'
    WHEN 'approved' THEN 'Story approved'
  END;
  v_notification_body := CASE p_status
    WHEN 'in_review' THEN v_actor_name || ' started reviewing “' || v_story.title || '”.'
    WHEN 'changes' THEN 'Changes requested on “' || v_story.title || '”. Review ' || v_actor_name || '’s feedback.'
    WHEN 'reviewed' THEN v_actor_name || ' reviewed “' || v_story.title || '”.'
    WHEN 'approved' THEN '“' || v_story.title || '” was approved by ' || v_actor_name || '.'
  END;

  PERFORM public.sf_emit_notification(
    v_story.student_id, public.sf_actor_id(), v_story.id, NULL,
    'story.' || p_status, 'status', v_notification_title, v_notification_body,
    '/library?story=' || v_story.id::text
  );

  RETURN v_story;
END
$$;

CREATE OR REPLACE FUNCTION public.sf_add_story_feedback(
  p_story_id uuid,
  p_body text,
  p_disposition text DEFAULT 'feedback',
  p_surface text DEFAULT 'workspace'
)
RETURNS public.sf_feedback
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_story public.sf_stories;
  v_feedback public.sf_feedback;
  v_actor_name text;
BEGIN
  IF NOT public.sf_has_live_identity(ARRAY['mentor']) THEN
    RAISE EXCEPTION 'eligible mentor identity required' USING ERRCODE = '42501';
  END IF;
  IF p_disposition NOT IN ('feedback', 'encouragement') THEN
    RAISE EXCEPTION 'invalid feedback disposition' USING ERRCODE = '22023';
  END IF;
  IF length(trim(coalesce(p_body, ''))) < 1 THEN
    RAISE EXCEPTION 'real mentor feedback is required' USING ERRCODE = '23514';
  END IF;

  SELECT * INTO v_story
  FROM public.sf_stories
  WHERE id = p_story_id
    AND archived_at IS NULL
  FOR UPDATE;
  IF NOT FOUND OR v_story.status = 'private' OR NOT public.sf_is_assigned(v_story.student_id) THEN
    RAISE EXCEPTION 'story not found' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.sf_feedback (story_id, mentor_id, body, disposition)
  VALUES (v_story.id, public.sf_actor_id(), trim(p_body), p_disposition)
  RETURNING * INTO v_feedback;

  UPDATE public.sf_stories
  SET feedback_sent_at = v_feedback.created_at,
      row_version = row_version + 1,
      updated_at = now()
  WHERE id = v_story.id;

  SELECT display_name INTO v_actor_name
  FROM public.sf_users
  WHERE id = public.sf_actor_id();

  PERFORM public.sf_append_audit(
    'story.feedback_added', 'feedback', v_feedback.id, p_surface,
    v_story.student_id, v_story.id, NULL, NULL,
    jsonb_build_object('disposition', v_feedback.disposition),
    left(trim(p_body), 240)
  );
  PERFORM public.sf_emit_notification(
    v_story.student_id, public.sf_actor_id(), v_story.id, NULL,
    'story.feedback', 'feedback', 'New mentor feedback',
    v_actor_name || ' left feedback on “' || v_story.title || '”.',
    '/library?story=' || v_story.id::text
  );

  RETURN v_feedback;
END
$$;

CREATE OR REPLACE FUNCTION public.sf_add_story_reflection(
  p_story_id uuid,
  p_prompt text,
  p_surface text DEFAULT 'workspace'
)
RETURNS public.sf_story_reflections
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_story public.sf_stories;
  v_reflection public.sf_story_reflections;
  v_from_mentor boolean;
  v_actor_name text;
BEGIN
  IF NOT public.sf_has_live_identity(ARRAY['student', 'mentor']) THEN
    RAISE EXCEPTION 'eligible student or mentor identity required' USING ERRCODE = '42501';
  END IF;
  IF length(trim(coalesce(p_prompt, ''))) < 3 THEN
    RAISE EXCEPTION 'reflection prompt is required' USING ERRCODE = '23514';
  END IF;

  SELECT * INTO v_story
  FROM public.sf_stories
  WHERE id = p_story_id
    AND archived_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'story not found' USING ERRCODE = 'P0002';
  END IF;
  v_from_mentor := public.sf_actor_role() = 'mentor';
  IF v_from_mentor THEN
    IF v_story.status = 'private' OR NOT public.sf_is_assigned(v_story.student_id) THEN
      RAISE EXCEPTION 'story not found' USING ERRCODE = 'P0002';
    END IF;
  ELSIF v_story.student_id <> public.sf_actor_id() THEN
    RAISE EXCEPTION 'story not found' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.sf_story_reflections (
    story_id, prompt, from_mentor, author_id
  )
  VALUES (
    v_story.id, trim(p_prompt), v_from_mentor, public.sf_actor_id()
  )
  RETURNING * INTO v_reflection;

  PERFORM public.sf_append_audit(
    CASE WHEN v_from_mentor THEN 'story.ask_added' ELSE 'story.reflection_prompt_added' END,
    'reflection', v_reflection.id, p_surface, v_story.student_id, v_story.id,
    NULL, NULL, jsonb_build_object('prompt', v_reflection.prompt)
  );

  IF v_from_mentor THEN
    SELECT display_name INTO v_actor_name
    FROM public.sf_users
    WHERE id = public.sf_actor_id();
    PERFORM public.sf_emit_notification(
      v_story.student_id, public.sf_actor_id(), v_story.id, NULL,
      'story.ask', 'ask', 'A question from your mentor',
      v_actor_name || ' asked you a question about “' || v_story.title || '”.',
      '/library?story=' || v_story.id::text
    );
  END IF;

  RETURN v_reflection;
END
$$;

CREATE OR REPLACE FUNCTION public.sf_answer_story_reflection(
  p_reflection_id uuid,
  p_answer text,
  p_surface text DEFAULT 'workspace'
)
RETURNS public.sf_story_reflections
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_reflection public.sf_story_reflections;
  v_before_answer text;
  v_story public.sf_stories;
  v_resubmitted boolean := false;
BEGIN
  IF NOT public.sf_has_live_identity(ARRAY['student']) THEN
    RAISE EXCEPTION 'eligible student identity required' USING ERRCODE = '42501';
  END IF;

  SELECT reflection.*
  INTO v_reflection
  FROM public.sf_story_reflections reflection
  JOIN public.sf_stories story ON story.id = reflection.story_id
  WHERE reflection.id = p_reflection_id
    AND story.student_id = public.sf_actor_id()
    AND story.archived_at IS NULL
  FOR UPDATE OF reflection, story;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'reflection not found' USING ERRCODE = 'P0002';
  END IF;
  SELECT * INTO STRICT v_story
  FROM public.sf_stories
  WHERE id = v_reflection.story_id;

  v_before_answer := v_reflection.answer;
  UPDATE public.sf_story_reflections
  SET answer = coalesce(p_answer, ''),
      answered_at = CASE
        WHEN answered_at IS NULL AND length(trim(coalesce(p_answer, ''))) > 0 THEN now()
        ELSE answered_at
      END,
      seen_by_student_at = CASE
        WHEN from_mentor THEN coalesce(seen_by_student_at, now())
        ELSE seen_by_student_at
      END
  WHERE id = p_reflection_id
  RETURNING * INTO v_reflection;

  v_resubmitted := v_reflection.from_mentor
    AND v_story.status = 'changes'
    AND length(trim(coalesce(v_reflection.answer, ''))) > 0;

  UPDATE public.sf_stories
  SET status = CASE WHEN v_resubmitted THEN 'awaiting' ELSE status END,
      revised = CASE
        WHEN v_reflection.from_mentor AND length(trim(coalesce(v_reflection.answer, ''))) > 0
          THEN true
        ELSE revised
      END,
      student_responded_at = CASE
        WHEN v_reflection.from_mentor
          AND length(trim(coalesce(v_before_answer, ''))) = 0
          AND length(trim(coalesce(v_reflection.answer, ''))) > 0
          THEN now()
        ELSE student_responded_at
      END,
      last_submitted_at = CASE
        WHEN v_resubmitted THEN now()
        ELSE last_submitted_at
      END,
      status_changed_at = CASE
        WHEN v_resubmitted THEN now()
        ELSE status_changed_at
      END,
      student_updated_at = now(),
      row_version = row_version + 1,
      updated_at = now()
  WHERE id = v_story.id;

  PERFORM public.sf_append_audit(
    CASE
      WHEN v_resubmitted THEN 'story.ask_answered_and_resubmitted'
      WHEN v_reflection.from_mentor THEN 'story.ask_answered'
      ELSE 'story.reflection_answered'
    END,
    'reflection', v_reflection.id, p_surface, v_story.student_id, v_story.id,
    NULL,
    jsonb_build_object('answer', v_before_answer, 'status', v_story.status),
    jsonb_build_object(
      'answer', v_reflection.answer,
      'status', CASE WHEN v_resubmitted THEN 'awaiting' ELSE v_story.status END
    )
  );

  RETURN v_reflection;
END
$$;

CREATE OR REPLACE FUNCTION public.sf_update_story_evaluation(
  p_story_id uuid,
  p_patch jsonb,
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
  v_role text;
  v_student_score smallint;
  v_mentor_score smallint;
  v_student_star boolean;
  v_mentor_star boolean;
  v_birds text[];
  v_positions text[];
  v_actor_name text;
BEGIN
  IF NOT public.sf_has_live_identity(ARRAY['student', 'mentor']) THEN
    RAISE EXCEPTION 'eligible student or mentor identity required' USING ERRCODE = '42501';
  END IF;
  v_role := public.sf_actor_role();

  IF p_patch IS NULL OR jsonb_typeof(p_patch) <> 'object' THEN
    RAISE EXCEPTION 'evaluation patch must be an object' USING ERRCODE = '22023';
  END IF;
  IF v_role = 'student' AND EXISTS (
    SELECT 1
    FROM jsonb_object_keys(p_patch) patch_key(key)
    WHERE patch_key.key <> ALL (
      ARRAY[
        'studentScore', 'studentStar', 'birds', 'positions', 'surface'
      ]::text[]
    )
  ) THEN
    RAISE EXCEPTION 'evaluation patch contains mentor-owned or unsupported fields'
      USING ERRCODE = '42501';
  END IF;
  IF v_role = 'mentor' AND EXISTS (
    SELECT 1
    FROM jsonb_object_keys(p_patch) patch_key(key)
    WHERE patch_key.key <> ALL (
      ARRAY[
        'mentorScore', 'mentorStar', 'birds', 'positions',
        'needsFollowup', 'classification', 'surface'
      ]::text[]
    )
  ) THEN
    RAISE EXCEPTION 'evaluation patch contains student-owned or unsupported fields'
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_before
  FROM public.sf_stories
  WHERE id = p_story_id
    AND archived_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'story not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_role = 'student' AND v_before.student_id <> public.sf_actor_id() THEN
    RAISE EXCEPTION 'story not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_role = 'mentor'
     AND (v_before.status = 'private' OR NOT public.sf_is_assigned(v_before.student_id)) THEN
    RAISE EXCEPTION 'story not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_role = 'student' AND (p_patch ? 'mentorScore' OR p_patch ? 'mentorStar') THEN
    RAISE EXCEPTION 'mentor-owned fields are not student-writable' USING ERRCODE = '42501';
  END IF;
  IF v_role = 'mentor' AND (p_patch ? 'studentScore' OR p_patch ? 'studentStar') THEN
    RAISE EXCEPTION 'student-owned fields are not mentor-writable' USING ERRCODE = '42501';
  END IF;

  v_student_score := CASE
    WHEN p_patch ? 'studentScore' THEN nullif(p_patch->>'studentScore', '')::smallint
    ELSE v_before.student_score
  END;
  v_mentor_score := CASE
    WHEN p_patch ? 'mentorScore' THEN nullif(p_patch->>'mentorScore', '')::smallint
    ELSE v_before.mentor_score
  END;
  v_student_star := CASE
    WHEN p_patch ? 'studentStar' THEN (p_patch->>'studentStar')::boolean
    ELSE v_before.student_star
  END;
  v_mentor_star := CASE
    WHEN p_patch ? 'mentorStar' THEN (p_patch->>'mentorStar')::boolean
    ELSE v_before.mentor_star
  END;
  v_birds := v_before.birds;
  IF jsonb_typeof(p_patch->'birds') = 'array' THEN
    SELECT coalesce(array_agg(value), ARRAY[]::text[]) INTO v_birds
    FROM jsonb_array_elements_text(p_patch->'birds') item(value);
  END IF;
  v_positions := v_before.positions;
  IF jsonb_typeof(p_patch->'positions') = 'array' THEN
    SELECT coalesce(array_agg(value), ARRAY[]::text[]) INTO v_positions
    FROM jsonb_array_elements_text(p_patch->'positions') item(value);
  END IF;

  UPDATE public.sf_stories
  SET student_score = v_student_score,
      mentor_score = v_mentor_score,
      student_star = v_student_star,
      mentor_star = v_mentor_star,
      birds = v_birds,
      positions = v_positions,
      needs_followup = CASE
        WHEN p_patch ? 'needsFollowup' THEN (p_patch->>'needsFollowup')::boolean
        ELSE needs_followup
      END,
      classification = CASE
        WHEN p_patch ? 'classification' THEN nullif(p_patch->>'classification', '')
        ELSE classification
      END,
      row_version = row_version + 1,
      updated_at = now()
  WHERE id = p_story_id
  RETURNING * INTO v_story;

  PERFORM public.sf_append_audit(
    'story.evaluation_updated', 'story', v_story.id, p_surface,
    v_story.student_id, v_story.id, NULL,
    jsonb_build_object(
      'student_score', v_before.student_score,
      'mentor_score', v_before.mentor_score,
      'student_star', v_before.student_star,
      'mentor_star', v_before.mentor_star,
      'birds', v_before.birds,
      'positions', v_before.positions,
      'needs_followup', v_before.needs_followup,
      'classification', v_before.classification
    ),
    jsonb_build_object(
      'student_score', v_story.student_score,
      'mentor_score', v_story.mentor_score,
      'student_star', v_story.student_star,
      'mentor_star', v_story.mentor_star,
      'birds', v_story.birds,
      'positions', v_story.positions,
      'needs_followup', v_story.needs_followup,
      'classification', v_story.classification
    )
  );

  IF v_role = 'mentor' THEN
    SELECT display_name INTO v_actor_name
    FROM public.sf_users
    WHERE id = public.sf_actor_id();

    IF v_story.mentor_score IS DISTINCT FROM v_before.mentor_score THEN
      PERFORM public.sf_emit_notification(
        v_story.student_id, public.sf_actor_id(), v_story.id, NULL,
        'story.mentor_score', 'score', 'Mentor score updated',
        v_actor_name || ' updated the score on “' || v_story.title || '”'
          || CASE WHEN v_story.mentor_score IS NULL THEN '.' ELSE ' to ' || v_story.mentor_score::text || '/5.' END,
        '/library?story=' || v_story.id::text
      );
    END IF;
    IF v_story.mentor_star IS DISTINCT FROM v_before.mentor_star THEN
      PERFORM public.sf_emit_notification(
        v_story.student_id, public.sf_actor_id(), v_story.id, NULL,
        'story.mentor_star', 'star', 'Mentor star updated',
        v_actor_name || CASE WHEN v_story.mentor_star THEN ' starred “' ELSE ' removed a star from “' END
          || v_story.title || '”.',
        '/library?story=' || v_story.id::text
      );
    END IF;
    IF v_story.birds IS DISTINCT FROM v_before.birds
       OR v_story.positions IS DISTINCT FROM v_before.positions THEN
      PERFORM public.sf_emit_notification(
        v_story.student_id, public.sf_actor_id(), v_story.id, NULL,
        'story.classifications', 'classification', 'Classifications updated',
        v_actor_name || ' updated classifications on “' || v_story.title || '”.',
        '/library?story=' || v_story.id::text
      );
    END IF;
  END IF;

  RETURN v_story;
END
$$;

CREATE OR REPLACE FUNCTION public.sf_set_use_suggestion(
  p_story_id uuid,
  p_use_key text,
  p_active boolean,
  p_surface text DEFAULT 'workspace'
)
RETURNS public.sf_use_suggestions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_story public.sf_stories;
  v_suggestion public.sf_use_suggestions;
  v_actor_name text;
BEGIN
  IF NOT public.sf_has_live_identity(ARRAY['mentor']) THEN
    RAISE EXCEPTION 'eligible mentor identity required' USING ERRCODE = '42501';
  END IF;
  IF p_use_key NOT IN ('ps', 'iv', 'letter', 'later') THEN
    RAISE EXCEPTION 'invalid story use' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_story
  FROM public.sf_stories
  WHERE id = p_story_id
    AND status <> 'private'
    AND archived_at IS NULL;
  IF NOT FOUND OR NOT public.sf_is_assigned(v_story.student_id) THEN
    RAISE EXCEPTION 'story not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO v_suggestion
  FROM public.sf_use_suggestions
  WHERE story_id = p_story_id
    AND use_key = p_use_key
    AND suggested_by = public.sf_actor_id()
    AND withdrawn_at IS NULL
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF p_active AND NOT FOUND THEN
    INSERT INTO public.sf_use_suggestions (story_id, use_key, suggested_by)
    VALUES (p_story_id, p_use_key, public.sf_actor_id())
    RETURNING * INTO v_suggestion;
  ELSIF NOT p_active AND FOUND THEN
    UPDATE public.sf_use_suggestions
    SET withdrawn_at = now()
    WHERE id = v_suggestion.id
    RETURNING * INTO v_suggestion;
  ELSIF NOT FOUND THEN
    RAISE EXCEPTION 'use suggestion not found' USING ERRCODE = 'P0002';
  END IF;

  PERFORM public.sf_append_audit(
    CASE WHEN p_active THEN 'story.use_suggested' ELSE 'story.use_suggestion_withdrawn' END,
    'use_suggestion', v_suggestion.id, p_surface,
    v_story.student_id, v_story.id, NULL, NULL,
    jsonb_build_object('use_key', p_use_key, 'active', p_active)
  );

  IF p_active THEN
    SELECT display_name INTO v_actor_name FROM public.sf_users WHERE id = public.sf_actor_id();
    PERFORM public.sf_emit_notification(
      v_story.student_id, public.sf_actor_id(), v_story.id, NULL,
      'story.use_suggestion', 'classification', 'A story use was suggested',
      v_actor_name || ' suggested another place “' || v_story.title || '” could serve.',
      '/library?story=' || v_story.id::text
    );
  END IF;
  RETURN v_suggestion;
END
$$;

CREATE OR REPLACE FUNCTION public.sf_review_story(
  p_story_id uuid,
  p_feedback text,
  p_status text,
  p_mentor_score smallint DEFAULT NULL,
  p_needs_followup boolean DEFAULT false,
  p_classification text DEFAULT NULL,
  p_surface text DEFAULT 'workspace'
)
RETURNS public.sf_stories
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_status text;
  v_story public.sf_stories;
BEGIN
  IF p_status NOT IN ('opened', 'needs_revision', 'approved', 'in_review', 'changes', 'reviewed') THEN
    RAISE EXCEPTION 'invalid mentor status' USING ERRCODE = '22023';
  END IF;
  v_status := CASE p_status
    WHEN 'opened' THEN NULL
    WHEN 'needs_revision' THEN 'changes'
    ELSE p_status
  END;

  IF v_status IS NOT NULL THEN
    PERFORM public.sf_set_story_status(p_story_id, v_status, p_surface);
  END IF;
  PERFORM public.sf_update_story_evaluation(
    p_story_id,
    jsonb_build_object(
      'mentorScore', p_mentor_score,
      'needsFollowup', p_needs_followup,
      'classification', p_classification
    ),
    p_surface
  );
  PERFORM public.sf_add_story_feedback(
    p_story_id, p_feedback,
    CASE WHEN v_status = 'changes' THEN 'feedback' ELSE 'feedback' END,
    p_surface
  );

  SELECT * INTO v_story FROM public.sf_stories WHERE id = p_story_id;
  RETURN v_story;
END
$$;

CREATE OR REPLACE FUNCTION public.sf_set_story_archived(
  p_story_id uuid,
  p_archived boolean,
  p_surface text DEFAULT 'library'
)
RETURNS public.sf_stories
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_story public.sf_stories;
BEGIN
  IF NOT public.sf_has_live_identity(ARRAY['student']) THEN
    RAISE EXCEPTION 'eligible student identity required' USING ERRCODE = '42501';
  END IF;
  UPDATE public.sf_stories
  SET archived_at = CASE WHEN p_archived THEN coalesce(archived_at, now()) ELSE NULL END,
      archived_by = CASE WHEN p_archived THEN public.sf_actor_id() ELSE NULL END,
      row_version = row_version + 1,
      updated_at = now()
  WHERE id = p_story_id
    AND student_id = public.sf_actor_id()
    AND (p_archived OR archived_at IS NOT NULL)
  RETURNING * INTO v_story;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'story not found' USING ERRCODE = 'P0002';
  END IF;

  PERFORM public.sf_append_audit(
    CASE WHEN p_archived THEN 'story.archived' ELSE 'story.restored' END,
    'story', v_story.id, p_surface, v_story.student_id, v_story.id, NULL,
    NULL, jsonb_build_object('archived_at', v_story.archived_at)
  );
  RETURN v_story;
END
$$;

CREATE OR REPLACE FUNCTION public.sf_save_story_draft(
  p_payload jsonb,
  p_expected_version bigint DEFAULT NULL
)
RETURNS public.sf_story_drafts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_before public.sf_story_drafts;
  v_draft public.sf_story_drafts;
BEGIN
  IF NOT public.sf_has_live_identity(ARRAY['student']) THEN
    RAISE EXCEPTION 'eligible student identity required' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(p_payload) <> 'object' THEN
    RAISE EXCEPTION 'draft payload must be an object' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_before
  FROM public.sf_story_drafts
  WHERE user_id = public.sf_actor_id()
  FOR UPDATE;

  IF FOUND THEN
    IF p_expected_version IS NOT NULL AND p_expected_version <> v_before.row_version THEN
      RAISE EXCEPTION 'draft changed in another session' USING ERRCODE = '40001';
    END IF;
    UPDATE public.sf_story_drafts
    SET payload = p_payload,
        row_version = row_version + 1,
        updated_at = now()
    WHERE user_id = public.sf_actor_id()
    RETURNING * INTO v_draft;
  ELSE
    IF p_expected_version IS NOT NULL AND p_expected_version <> 0 THEN
      RAISE EXCEPTION 'draft changed in another session' USING ERRCODE = '40001';
    END IF;
    INSERT INTO public.sf_story_drafts (user_id, payload)
    VALUES (public.sf_actor_id(), p_payload)
    RETURNING * INTO v_draft;
  END IF;

  PERFORM public.sf_append_audit(
    'story.draft_saved', 'story_draft', v_draft.user_id, 'quick',
    v_draft.user_id, NULL, NULL, NULL,
    jsonb_build_object('row_version', v_draft.row_version)
  );
  RETURN v_draft;
END
$$;

CREATE OR REPLACE FUNCTION public.sf_mark_all_notifications_read()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count integer;
BEGIN
  IF NOT public.sf_has_live_identity() THEN
    RAISE EXCEPTION 'eligible identity required' USING ERRCODE = '42501';
  END IF;
  UPDATE public.sf_notifications
  SET read_at = coalesce(read_at, now())
  WHERE recipient_id = public.sf_actor_id()
    AND read_at IS NULL;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END
$$;

CREATE OR REPLACE FUNCTION public.sf_confirm_audio_asset(
  p_asset_id uuid,
  p_checksum_sha256 text DEFAULT NULL,
  p_duration_ms integer DEFAULT NULL
)
RETURNS public.sf_audio_assets
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
  IF p_checksum_sha256 IS NOT NULL AND p_checksum_sha256 !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'invalid audio checksum' USING ERRCODE = '22023';
  END IF;
  IF p_duration_ms IS NOT NULL AND p_duration_ms < 0 THEN
    RAISE EXCEPTION 'invalid audio duration' USING ERRCODE = '22023';
  END IF;

  UPDATE public.sf_audio_assets
  SET state = 'verified',
      checksum_sha256 = coalesce(p_checksum_sha256, checksum_sha256),
      duration_ms = coalesce(p_duration_ms, duration_ms),
      verified_at = coalesce(verified_at, now()),
      immutable_at = coalesce(immutable_at, now())
  WHERE id = p_asset_id
    AND student_id = public.sf_actor_id()
    AND state IN ('pending', 'uploaded')
  RETURNING * INTO v_asset;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'audio asset not found' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.sf_story_originals (
    story_id, original_transcript, audio_asset_id, capture_type
  )
  VALUES (v_asset.story_id, '', v_asset.id, 'audio')
  ON CONFLICT (story_id) DO NOTHING;

  RETURN v_asset;
END
$$;

REVOKE ALL ON FUNCTION public.sf_forbid_original_mutation() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sf_forbid_revision_mutation() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sf_append_audit(text, text, uuid, text, uuid, uuid, uuid, jsonb, jsonb, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sf_emit_notification(uuid, uuid, uuid, uuid, text, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sf_create_story_v5(jsonb, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sf_update_story_v5(uuid, jsonb, bigint, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sf_record_story_view(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sf_set_story_status(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sf_add_story_feedback(uuid, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sf_add_story_reflection(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sf_answer_story_reflection(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sf_update_story_evaluation(uuid, jsonb, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sf_set_use_suggestion(uuid, text, boolean, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sf_set_story_archived(uuid, boolean, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sf_save_story_draft(jsonb, bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sf_mark_all_notifications_read() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sf_confirm_audio_asset(uuid, text, integer) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.sf_create_story_v5(jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sf_update_story_v5(uuid, jsonb, bigint, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sf_record_story_view(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sf_set_story_status(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sf_add_story_feedback(uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sf_add_story_reflection(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sf_answer_story_reflection(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sf_update_story_evaluation(uuid, jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sf_set_use_suggestion(uuid, text, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sf_set_story_archived(uuid, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sf_save_story_draft(jsonb, bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sf_mark_all_notifications_read() TO authenticated;
GRANT EXECUTE ON FUNCTION public.sf_confirm_audio_asset(uuid, text, integer) TO authenticated;

COMMIT;
