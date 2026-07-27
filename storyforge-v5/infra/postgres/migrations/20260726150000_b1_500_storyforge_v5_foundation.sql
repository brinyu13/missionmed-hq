-- Migration: 20260726150000_b1_500_storyforge_v5_foundation.sql
-- Ticket: B1-500
-- Target project: UNPINNED — DO NOT APPLY OUTSIDE THE ISOLATED TEST HARNESS.
-- Purpose: Add the StoryForge V5 privacy, lifecycle, coaching, prep, and governance foundation.
-- Reversibility: additive objects; production rollback requires a founder-approved data-retention plan.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.sf_actor_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

CREATE OR REPLACE FUNCTION public.sf_actor_role()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT nullif(current_setting('request.jwt.claim.app_role', true), '')
$$;

CREATE OR REPLACE FUNCTION public.sf_actor_eligible()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT coalesce(nullif(current_setting('request.jwt.claim.storyforge_eligible', true), '')::boolean, false)
$$;

CREATE TABLE public.sf_users (
  id uuid PRIMARY KEY,
  wp_user_id bigint UNIQUE,
  display_name text NOT NULL CHECK (length(trim(display_name)) BETWEEN 1 AND 120),
  role text NOT NULL CHECK (role IN ('student', 'mentor', 'admin')),
  eligible boolean NOT NULL DEFAULT false,
  cohort text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.sf_mentor_assignments (
  student_id uuid NOT NULL REFERENCES public.sf_users(id) ON DELETE RESTRICT,
  mentor_id uuid NOT NULL REFERENCES public.sf_users(id) ON DELETE RESTRICT,
  active boolean NOT NULL DEFAULT true,
  assigned_by uuid REFERENCES public.sf_users(id) ON DELETE SET NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (student_id, mentor_id),
  CHECK (student_id <> mentor_id)
);

CREATE OR REPLACE FUNCTION public.sf_is_assigned(p_student_id uuid, p_mentor_id uuid DEFAULT public.sf_actor_id())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.sf_mentor_assignments a
    WHERE a.student_id = p_student_id
      AND a.mentor_id = p_mentor_id
      AND a.active
  )
$$;

CREATE OR REPLACE FUNCTION public.sf_are_coassigned(p_left_mentor_id uuid, p_right_mentor_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.sf_mentor_assignments left_assignment
    JOIN public.sf_mentor_assignments right_assignment
      ON right_assignment.student_id = left_assignment.student_id
    WHERE left_assignment.mentor_id = p_left_mentor_id
      AND right_assignment.mentor_id = p_right_mentor_id
      AND left_assignment.active
      AND right_assignment.active
  )
$$;

CREATE OR REPLACE FUNCTION public.sf_has_live_identity(p_roles text[] DEFAULT NULL)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.sf_users u
    WHERE u.id = public.sf_actor_id()
      AND u.eligible
      AND public.sf_actor_eligible()
      AND u.role = public.sf_actor_role()
      AND (p_roles IS NULL OR u.role = ANY(p_roles))
  )
$$;

CREATE TABLE public.sf_stories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.sf_users(id) ON DELETE RESTRICT,
  title text NOT NULL DEFAULT 'Untitled story' CHECK (length(title) <= 160),
  original_text text NOT NULL DEFAULT '',
  current_text text NOT NULL DEFAULT '',
  capture_type text NOT NULL DEFAULT 'text' CHECK (capture_type IN ('text', 'audio', 'imported')),
  status text NOT NULL DEFAULT 'private'
    CHECK (status IN ('private', 'submitted', 'opened', 'needs_revision', 'resubmitted', 'approved')),
  student_score smallint CHECK (student_score BETWEEN 1 AND 5),
  mentor_score smallint CHECK (mentor_score BETWEEN 1 AND 5),
  classification text CHECK (classification IN ('clinical', 'leadership', 'teamwork', 'challenge', 'growth', 'other')),
  starred boolean NOT NULL DEFAULT false,
  needs_followup boolean NOT NULL DEFAULT false,
  uses text[] NOT NULL DEFAULT ARRAY[]::text[],
  revision_no integer NOT NULL DEFAULT 0 CHECK (revision_no >= 0),
  submitted_at timestamptz,
  opened_at timestamptz,
  reviewed_at timestamptz,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX sf_stories_student_updated_idx ON public.sf_stories (student_id, updated_at DESC);
CREATE INDEX sf_stories_review_queue_idx ON public.sf_stories (status, submitted_at DESC)
  WHERE status <> 'private';

CREATE TABLE public.sf_story_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id uuid NOT NULL REFERENCES public.sf_stories(id) ON DELETE RESTRICT,
  revision_no integer NOT NULL CHECK (revision_no >= 0),
  text_snapshot text NOT NULL,
  title_snapshot text NOT NULL,
  actor_id uuid NOT NULL REFERENCES public.sf_users(id) ON DELETE RESTRICT,
  reason text NOT NULL CHECK (reason IN ('capture', 'student_edit', 'submit', 'mentor_review', 'resubmit')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (story_id, revision_no, reason, created_at)
);

CREATE TABLE public.sf_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id uuid NOT NULL REFERENCES public.sf_stories(id) ON DELETE RESTRICT,
  mentor_id uuid NOT NULL REFERENCES public.sf_users(id) ON DELETE RESTRICT,
  body text NOT NULL CHECK (length(trim(body)) BETWEEN 1 AND 10000),
  disposition text NOT NULL CHECK (disposition IN ('feedback', 'ask', 'encouragement')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.sf_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid NOT NULL REFERENCES public.sf_users(id) ON DELETE RESTRICT,
  actor_id uuid REFERENCES public.sf_users(id) ON DELETE RESTRICT,
  story_id uuid REFERENCES public.sf_stories(id) ON DELETE RESTRICT,
  event_key text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  deep_link text NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (deep_link LIKE '/%')
);

CREATE INDEX sf_notifications_recipient_idx
  ON public.sf_notifications (recipient_id, read_at, created_at DESC);

CREATE TABLE public.sf_audit_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id uuid REFERENCES public.sf_users(id) ON DELETE RESTRICT,
  actor_role text,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  surface text NOT NULL
    CHECK (surface IN ('library', 'quick', 'workspace', 'workshop', 'teach', 'import', 'system')),
  previous_value jsonb,
  new_value jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX sf_audit_entity_idx ON public.sf_audit_events (entity_type, entity_id, created_at DESC);

CREATE TABLE public.sf_audio_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id uuid NOT NULL REFERENCES public.sf_stories(id) ON DELETE RESTRICT,
  student_id uuid NOT NULL REFERENCES public.sf_users(id) ON DELETE RESTRICT,
  object_key text NOT NULL UNIQUE,
  content_type text NOT NULL CHECK (content_type IN ('audio/webm', 'audio/mp4', 'audio/ogg', 'audio/wav')),
  byte_size bigint CHECK (byte_size IS NULL OR byte_size BETWEEN 1 AND 52428800),
  checksum_sha256 text CHECK (checksum_sha256 IS NULL OR checksum_sha256 ~ '^[a-f0-9]{64}$'),
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'uploaded', 'verified', 'failed', 'retired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  verified_at timestamptz
);

CREATE TABLE public.sf_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  text text NOT NULL CHECK (length(trim(text)) BETWEEN 3 AND 2000),
  normalized_text text GENERATED ALWAYS AS (lower(regexp_replace(trim(text), '\s+', ' ', 'g'))) STORED,
  family text NOT NULL DEFAULT 'general',
  provenance text NOT NULL CHECK (provenance IN ('missionmed', 'mentor', 'student', 'imported', 'ai')),
  owner_student_id uuid REFERENCES public.sf_users(id) ON DELETE RESTRICT,
  import_batch_id uuid,
  governance_state text NOT NULL DEFAULT 'draft' CHECK (governance_state IN ('draft', 'review', 'approved', 'retired')),
  created_by uuid NOT NULL REFERENCES public.sf_users(id) ON DELETE RESTRICT,
  approved_by uuid REFERENCES public.sf_users(id) ON DELETE RESTRICT,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (provenance = 'student' AND owner_student_id IS NOT NULL)
    OR (provenance <> 'student')
  )
);

CREATE INDEX sf_questions_normalized_idx ON public.sf_questions (normalized_text);

CREATE TABLE public.sf_story_questions (
  story_id uuid NOT NULL REFERENCES public.sf_stories(id) ON DELETE RESTRICT,
  question_id uuid NOT NULL REFERENCES public.sf_questions(id) ON DELETE RESTRICT,
  student_strength smallint CHECK (student_strength BETWEEN 1 AND 5),
  mentor_strength smallint CHECK (mentor_strength BETWEEN 1 AND 5),
  student_proposed boolean NOT NULL DEFAULT false,
  mentor_confirmed boolean NOT NULL DEFAULT false,
  student_notes text,
  mentor_notes text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (story_id, question_id)
);

CREATE TABLE public.sf_workshops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.sf_users(id) ON DELETE RESTRICT,
  question_a_id uuid NOT NULL REFERENCES public.sf_questions(id) ON DELETE RESTRICT,
  question_b_id uuid NOT NULL REFERENCES public.sf_questions(id) ON DELETE RESTRICT,
  student_strength_a smallint CHECK (student_strength_a BETWEEN 1 AND 5),
  student_strength_b smallint CHECK (student_strength_b BETWEEN 1 AND 5),
  mentor_strength_a smallint CHECK (mentor_strength_a BETWEEN 1 AND 5),
  mentor_strength_b smallint CHECK (mentor_strength_b BETWEEN 1 AND 5),
  preferred_question_id uuid REFERENCES public.sf_questions(id) ON DELETE RESTRICT,
  student_why text,
  mentor_coaching_notes text,
  gaps text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'prepared', 'reviewed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (question_a_id <> question_b_id),
  CHECK (preferred_question_id IS NULL OR preferred_question_id IN (question_a_id, question_b_id))
);

CREATE TABLE public.sf_next_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.sf_users(id) ON DELETE RESTRICT,
  text text NOT NULL CHECK (length(trim(text)) BETWEEN 3 AND 2000),
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'mentor', 'ai')),
  prepared boolean NOT NULL DEFAULT false,
  notes text,
  created_by uuid NOT NULL REFERENCES public.sf_users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.sf_import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_name text NOT NULL,
  source_format text NOT NULL CHECK (source_format IN ('paste', 'csv', 'xlsx')),
  state text NOT NULL DEFAULT 'review' CHECK (state IN ('review', 'committed', 'rolled_back', 'failed')),
  created_by uuid NOT NULL REFERENCES public.sf_users(id) ON DELETE RESTRICT,
  row_count integer NOT NULL CHECK (row_count BETWEEN 0 AND 5000),
  committed_at timestamptz,
  rolled_back_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sf_questions
  ADD CONSTRAINT sf_questions_import_batch_fk
  FOREIGN KEY (import_batch_id) REFERENCES public.sf_import_batches(id) ON DELETE RESTRICT;

CREATE TABLE public.sf_import_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.sf_import_batches(id) ON DELETE RESTRICT,
  row_number integer NOT NULL CHECK (row_number > 0),
  raw_text text NOT NULL,
  normalized_text text,
  duplicate_question_id uuid REFERENCES public.sf_questions(id) ON DELETE SET NULL,
  selected boolean NOT NULL DEFAULT false,
  error text,
  created_question_id uuid REFERENCES public.sf_questions(id) ON DELETE SET NULL,
  UNIQUE (batch_id, row_number)
);

CREATE TABLE public.sf_ai_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.sf_users(id) ON DELETE RESTRICT,
  story_id uuid REFERENCES public.sf_stories(id) ON DELETE RESTRICT,
  requested_by uuid NOT NULL REFERENCES public.sf_users(id) ON DELETE RESTRICT,
  mode text NOT NULL CHECK (mode IN ('general', 'clinical')),
  provider text NOT NULL,
  model text NOT NULL,
  prompt_version text NOT NULL,
  redaction_version text NOT NULL,
  output jsonb NOT NULL,
  state text NOT NULL DEFAULT 'presented' CHECK (state IN ('presented', 'accepted', 'edited', 'dismissed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.sf_forbid_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'StoryForge audit events are append-only' USING ERRCODE = '42501';
END
$$;

CREATE TRIGGER sf_audit_append_only
BEFORE UPDATE OR DELETE ON public.sf_audit_events
FOR EACH ROW EXECUTE FUNCTION public.sf_forbid_audit_mutation();

CREATE OR REPLACE FUNCTION public.sf_protect_story_original()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.student_id IS DISTINCT FROM OLD.student_id
     OR NEW.original_text IS DISTINCT FROM OLD.original_text
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Story ownership and original capture are immutable' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER sf_story_original_immutable
BEFORE UPDATE ON public.sf_stories
FOR EACH ROW EXECUTE FUNCTION public.sf_protect_story_original();

ALTER TABLE public.sf_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sf_mentor_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sf_stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sf_story_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sf_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sf_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sf_audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sf_audio_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sf_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sf_story_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sf_workshops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sf_next_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sf_import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sf_import_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sf_ai_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY sf_users_read ON public.sf_users
FOR SELECT TO authenticated
USING (
  public.sf_has_live_identity()
  AND (
    id = public.sf_actor_id()
    OR (
      public.sf_actor_role() = 'student'
      AND role = 'mentor'
      AND EXISTS (
        SELECT 1 FROM public.sf_mentor_assignments a
        WHERE a.student_id = public.sf_actor_id()
          AND a.mentor_id = id
          AND a.active
      )
    )
    OR (
      public.sf_actor_role() = 'mentor'
      AND role = 'mentor'
      AND public.sf_are_coassigned(public.sf_actor_id(), id)
    )
    OR (public.sf_actor_role() = 'mentor' AND role = 'student' AND public.sf_is_assigned(id))
    OR public.sf_actor_role() = 'admin'
  )
);

CREATE POLICY sf_assignments_read ON public.sf_mentor_assignments
FOR SELECT TO authenticated
USING (
  public.sf_has_live_identity()
  AND (
    student_id = public.sf_actor_id()
    OR mentor_id = public.sf_actor_id()
    OR public.sf_actor_role() = 'admin'
  )
);

CREATE POLICY sf_stories_read ON public.sf_stories
FOR SELECT TO authenticated
USING (
  public.sf_has_live_identity()
  AND (
    student_id = public.sf_actor_id()
    OR (
      public.sf_actor_role() = 'mentor'
      AND status <> 'private'
      AND public.sf_is_assigned(student_id)
    )
  )
);

CREATE POLICY sf_revisions_read ON public.sf_story_revisions
FOR SELECT TO authenticated
USING (
  public.sf_has_live_identity()
  AND EXISTS (
    SELECT 1 FROM public.sf_stories s
    WHERE s.id = story_id
      AND (
        s.student_id = public.sf_actor_id()
        OR (
          public.sf_actor_role() = 'mentor'
          AND s.status <> 'private'
          AND public.sf_is_assigned(s.student_id)
        )
      )
  )
);

CREATE POLICY sf_feedback_read ON public.sf_feedback
FOR SELECT TO authenticated
USING (
  public.sf_has_live_identity()
  AND EXISTS (
    SELECT 1 FROM public.sf_stories s
    WHERE s.id = story_id
      AND (
        s.student_id = public.sf_actor_id()
        OR (
          public.sf_actor_role() = 'mentor'
          AND s.status <> 'private'
          AND public.sf_is_assigned(s.student_id)
        )
      )
  )
);

CREATE POLICY sf_notifications_read ON public.sf_notifications
FOR SELECT TO authenticated
USING (public.sf_has_live_identity() AND recipient_id = public.sf_actor_id());

CREATE POLICY sf_audit_read ON public.sf_audit_events
FOR SELECT TO authenticated
USING (
  public.sf_has_live_identity()
  AND (
    actor_id = public.sf_actor_id()
    OR EXISTS (
      SELECT 1 FROM public.sf_stories s
      WHERE entity_type = 'story'
        AND s.id = entity_id
        AND (
          s.student_id = public.sf_actor_id()
          OR (
            public.sf_actor_role() = 'mentor'
            AND s.status <> 'private'
            AND public.sf_is_assigned(s.student_id)
          )
        )
    )
  )
);

CREATE POLICY sf_audio_read ON public.sf_audio_assets
FOR SELECT TO authenticated
USING (
  public.sf_has_live_identity()
  AND (
    student_id = public.sf_actor_id()
    OR EXISTS (
      SELECT 1 FROM public.sf_stories s
      WHERE s.id = story_id
        AND s.status <> 'private'
        AND public.sf_actor_role() = 'mentor'
        AND public.sf_is_assigned(s.student_id)
    )
  )
);

CREATE POLICY sf_questions_read ON public.sf_questions
FOR SELECT TO authenticated
USING (
  public.sf_has_live_identity()
  AND (
    governance_state = 'approved'
    OR owner_student_id = public.sf_actor_id()
    OR (public.sf_actor_role() = 'mentor' AND (created_by = public.sf_actor_id() OR owner_student_id IN (
      SELECT student_id FROM public.sf_mentor_assignments
      WHERE mentor_id = public.sf_actor_id() AND active
    )))
    OR public.sf_actor_role() = 'admin'
  )
);

CREATE POLICY sf_story_questions_read ON public.sf_story_questions
FOR SELECT TO authenticated
USING (
  public.sf_has_live_identity()
  AND EXISTS (
    SELECT 1 FROM public.sf_stories s
    WHERE s.id = story_id
      AND (
        s.student_id = public.sf_actor_id()
        OR (
          public.sf_actor_role() = 'mentor'
          AND s.status <> 'private'
          AND public.sf_is_assigned(s.student_id)
        )
      )
  )
);

CREATE POLICY sf_workshops_read ON public.sf_workshops
FOR SELECT TO authenticated
USING (
  public.sf_has_live_identity()
  AND (
    student_id = public.sf_actor_id()
    OR (public.sf_actor_role() = 'mentor' AND public.sf_is_assigned(student_id))
  )
);

CREATE POLICY sf_next_questions_read ON public.sf_next_questions
FOR SELECT TO authenticated
USING (
  public.sf_has_live_identity()
  AND (
    student_id = public.sf_actor_id()
    OR (public.sf_actor_role() = 'mentor' AND public.sf_is_assigned(student_id))
  )
);

CREATE POLICY sf_import_batches_read ON public.sf_import_batches
FOR SELECT TO authenticated
USING (
  public.sf_has_live_identity(ARRAY['mentor', 'admin'])
  AND (created_by = public.sf_actor_id() OR public.sf_actor_role() = 'admin')
);

CREATE POLICY sf_import_rows_read ON public.sf_import_rows
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.sf_import_batches b
    WHERE b.id = batch_id
      AND public.sf_has_live_identity(ARRAY['mentor', 'admin'])
      AND (b.created_by = public.sf_actor_id() OR public.sf_actor_role() = 'admin')
  )
);

CREATE POLICY sf_ai_suggestions_read ON public.sf_ai_suggestions
FOR SELECT TO authenticated
USING (
  public.sf_has_live_identity()
  AND (
    student_id = public.sf_actor_id()
    OR (public.sf_actor_role() = 'mentor' AND public.sf_is_assigned(student_id))
  )
);

REVOKE ALL ON public.sf_users, public.sf_mentor_assignments, public.sf_stories,
  public.sf_story_revisions, public.sf_feedback, public.sf_notifications,
  public.sf_audit_events, public.sf_audio_assets, public.sf_questions,
  public.sf_story_questions, public.sf_workshops, public.sf_next_questions,
  public.sf_import_batches, public.sf_import_rows, public.sf_ai_suggestions
  FROM anon;
REVOKE ALL ON public.sf_users, public.sf_mentor_assignments, public.sf_stories,
  public.sf_story_revisions, public.sf_feedback, public.sf_notifications,
  public.sf_audit_events, public.sf_audio_assets, public.sf_questions,
  public.sf_story_questions, public.sf_workshops, public.sf_next_questions,
  public.sf_import_batches, public.sf_import_rows, public.sf_ai_suggestions
  FROM authenticated;

GRANT SELECT ON public.sf_users, public.sf_mentor_assignments, public.sf_stories,
  public.sf_story_revisions, public.sf_feedback, public.sf_notifications,
  public.sf_audit_events, public.sf_audio_assets, public.sf_questions,
  public.sf_story_questions, public.sf_workshops, public.sf_next_questions,
  public.sf_import_batches, public.sf_import_rows, public.sf_ai_suggestions
  TO authenticated;

CREATE OR REPLACE FUNCTION public.sf_create_story(
  p_title text,
  p_text text,
  p_capture_type text DEFAULT 'text',
  p_surface text DEFAULT 'quick'
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
  IF p_capture_type NOT IN ('text', 'audio', 'imported') THEN
    RAISE EXCEPTION 'invalid capture type' USING ERRCODE = '22023';
  END IF;
  IF p_surface NOT IN ('library', 'quick', 'workspace') THEN
    RAISE EXCEPTION 'invalid surface' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.sf_stories (student_id, title, original_text, current_text, capture_type)
  VALUES (
    public.sf_actor_id(),
    coalesce(nullif(trim(p_title), ''), 'Untitled story'),
    coalesce(p_text, ''),
    coalesce(p_text, ''),
    p_capture_type
  )
  RETURNING * INTO v_story;

  INSERT INTO public.sf_story_revisions
    (story_id, revision_no, text_snapshot, title_snapshot, actor_id, reason)
  VALUES (v_story.id, 0, v_story.current_text, v_story.title, public.sf_actor_id(), 'capture');

  INSERT INTO public.sf_audit_events
    (actor_id, actor_role, action, entity_type, entity_id, surface, new_value)
  VALUES (
    public.sf_actor_id(), public.sf_actor_role(), 'story.created', 'story',
    v_story.id, p_surface, jsonb_build_object('status', v_story.status, 'capture_type', v_story.capture_type)
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
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_before public.sf_stories;
  v_story public.sf_stories;
BEGIN
  IF NOT public.sf_has_live_identity(ARRAY['student']) THEN
    RAISE EXCEPTION 'eligible student identity required' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_before FROM public.sf_stories
  WHERE id = p_story_id AND student_id = public.sf_actor_id()
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'story not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_before.status NOT IN ('private', 'needs_revision') THEN
    RAISE EXCEPTION 'story is read-only in status %', v_before.status USING ERRCODE = '23514';
  END IF;
  IF p_student_score IS NOT NULL AND (p_student_score < 1 OR p_student_score > 5) THEN
    RAISE EXCEPTION 'student score must be 1..5' USING ERRCODE = '22023';
  END IF;

  UPDATE public.sf_stories
  SET title = coalesce(nullif(trim(p_title), ''), title),
      current_text = coalesce(p_text, current_text),
      student_score = p_student_score,
      uses = coalesce(p_uses, uses),
      revision_no = revision_no + 1,
      updated_at = now()
  WHERE id = p_story_id
  RETURNING * INTO v_story;

  INSERT INTO public.sf_story_revisions
    (story_id, revision_no, text_snapshot, title_snapshot, actor_id, reason)
  VALUES (v_story.id, v_story.revision_no, v_story.current_text, v_story.title, public.sf_actor_id(), 'student_edit');

  INSERT INTO public.sf_audit_events
    (actor_id, actor_role, action, entity_type, entity_id, surface, previous_value, new_value)
  VALUES (
    public.sf_actor_id(), public.sf_actor_role(), 'story.updated', 'story', v_story.id, p_surface,
    jsonb_build_object('revision_no', v_before.revision_no, 'student_score', v_before.student_score),
    jsonb_build_object('revision_no', v_story.revision_no, 'student_score', v_story.student_score)
  );
  RETURN v_story;
END
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
  v_status text;
BEGIN
  IF NOT public.sf_has_live_identity(ARRAY['student']) THEN
    RAISE EXCEPTION 'eligible student identity required' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_before FROM public.sf_stories
  WHERE id = p_story_id AND student_id = public.sf_actor_id()
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'story not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_before.status NOT IN ('private', 'needs_revision') THEN
    RAISE EXCEPTION 'cannot submit from status %', v_before.status USING ERRCODE = '23514';
  END IF;
  IF length(trim(v_before.current_text)) < 3 THEN
    RAISE EXCEPTION 'story text is required' USING ERRCODE = '23514';
  END IF;
  v_status := CASE WHEN v_before.status = 'needs_revision' THEN 'resubmitted' ELSE 'submitted' END;

  UPDATE public.sf_stories
  SET status = v_status,
      submitted_at = now(),
      updated_at = now()
  WHERE id = p_story_id
  RETURNING * INTO v_story;

  INSERT INTO public.sf_story_revisions
    (story_id, revision_no, text_snapshot, title_snapshot, actor_id, reason)
  VALUES (
    v_story.id, v_story.revision_no, v_story.current_text, v_story.title,
    public.sf_actor_id(), CASE WHEN v_status = 'resubmitted' THEN 'resubmit' ELSE 'submit' END
  );

  INSERT INTO public.sf_audit_events
    (actor_id, actor_role, action, entity_type, entity_id, surface, previous_value, new_value)
  VALUES (
    public.sf_actor_id(), public.sf_actor_role(), 'story.submitted', 'story', v_story.id, p_surface,
    jsonb_build_object('status', v_before.status),
    jsonb_build_object('status', v_story.status)
  );
  RETURN v_story;
END
$$;

CREATE OR REPLACE FUNCTION public.sf_open_story(
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
  v_before_status text;
BEGIN
  IF NOT public.sf_has_live_identity(ARRAY['mentor']) THEN
    RAISE EXCEPTION 'eligible mentor identity required' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_story FROM public.sf_stories WHERE id = p_story_id FOR UPDATE;
  IF NOT FOUND OR v_story.status = 'private' OR NOT public.sf_is_assigned(v_story.student_id) THEN
    RAISE EXCEPTION 'story not found' USING ERRCODE = 'P0002';
  END IF;
  v_before_status := v_story.status;
  IF v_story.status IN ('submitted', 'resubmitted') THEN
    UPDATE public.sf_stories
    SET status = 'opened', opened_at = coalesce(opened_at, now()), updated_at = now()
    WHERE id = p_story_id
    RETURNING * INTO v_story;

    INSERT INTO public.sf_audit_events
      (actor_id, actor_role, action, entity_type, entity_id, surface, previous_value, new_value)
    VALUES (
      public.sf_actor_id(), public.sf_actor_role(), 'story.opened', 'story', v_story.id, p_surface,
      jsonb_build_object('status', v_before_status),
      jsonb_build_object('status', v_story.status)
    );
  END IF;
  RETURN v_story;
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
  v_before public.sf_stories;
  v_story public.sf_stories;
  v_title text;
BEGIN
  IF NOT public.sf_has_live_identity(ARRAY['mentor']) THEN
    RAISE EXCEPTION 'eligible mentor identity required' USING ERRCODE = '42501';
  END IF;
  IF p_status NOT IN ('opened', 'needs_revision', 'approved') THEN
    RAISE EXCEPTION 'invalid mentor status' USING ERRCODE = '22023';
  END IF;
  IF length(trim(coalesce(p_feedback, ''))) < 1 THEN
    RAISE EXCEPTION 'real mentor feedback is required' USING ERRCODE = '23514';
  END IF;
  SELECT * INTO v_before FROM public.sf_stories WHERE id = p_story_id FOR UPDATE;
  IF NOT FOUND OR v_before.status = 'private' OR NOT public.sf_is_assigned(v_before.student_id) THEN
    RAISE EXCEPTION 'story not found' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.sf_stories
  SET status = p_status,
      mentor_score = p_mentor_score,
      needs_followup = p_needs_followup,
      classification = coalesce(p_classification, classification),
      reviewed_at = now(),
      approved_at = CASE WHEN p_status = 'approved' THEN now() ELSE approved_at END,
      updated_at = now()
  WHERE id = p_story_id
  RETURNING * INTO v_story;

  INSERT INTO public.sf_feedback (story_id, mentor_id, body, disposition)
  VALUES (
    v_story.id, public.sf_actor_id(), trim(p_feedback),
    CASE WHEN p_status = 'needs_revision' THEN 'ask' ELSE 'feedback' END
  );

  v_title := CASE
    WHEN p_status = 'approved' THEN 'Story approved'
    WHEN p_status = 'needs_revision' THEN 'Revision requested'
    ELSE 'Mentor feedback added'
  END;

  INSERT INTO public.sf_notifications
    (recipient_id, actor_id, story_id, event_key, title, body, deep_link)
  VALUES (
    v_story.student_id, public.sf_actor_id(), v_story.id,
    'story.' || p_status, v_title, trim(p_feedback),
    '/library?story=' || v_story.id::text
  );

  INSERT INTO public.sf_audit_events
    (actor_id, actor_role, action, entity_type, entity_id, surface, previous_value, new_value)
  VALUES (
    public.sf_actor_id(), public.sf_actor_role(), 'story.reviewed', 'story', v_story.id, p_surface,
    jsonb_build_object('status', v_before.status, 'mentor_score', v_before.mentor_score),
    jsonb_build_object(
      'status', v_story.status,
      'mentor_score', v_story.mentor_score,
      'needs_followup', v_story.needs_followup,
      'classification', v_story.classification
    )
  );
  RETURN v_story;
END
$$;

CREATE OR REPLACE FUNCTION public.sf_mark_notification_read(p_notification_id uuid)
RETURNS public.sf_notifications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_notification public.sf_notifications;
BEGIN
  IF NOT public.sf_has_live_identity() THEN
    RAISE EXCEPTION 'eligible identity required' USING ERRCODE = '42501';
  END IF;
  UPDATE public.sf_notifications
  SET read_at = coalesce(read_at, now())
  WHERE id = p_notification_id
    AND recipient_id = public.sf_actor_id()
  RETURNING * INTO v_notification;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'notification not found' USING ERRCODE = 'P0002';
  END IF;
  RETURN v_notification;
END
$$;

CREATE OR REPLACE FUNCTION public.sf_begin_audio_asset(
  p_story_id uuid,
  p_object_key text,
  p_content_type text,
  p_byte_size bigint
)
RETURNS public.sf_audio_assets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_story public.sf_stories;
  v_asset public.sf_audio_assets;
BEGIN
  IF NOT public.sf_has_live_identity(ARRAY['student']) THEN
    RAISE EXCEPTION 'eligible student identity required' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_story FROM public.sf_stories
  WHERE id = p_story_id
    AND student_id = public.sf_actor_id()
    AND status IN ('private', 'needs_revision');
  IF NOT FOUND THEN
    RAISE EXCEPTION 'editable story not found' USING ERRCODE = 'P0002';
  END IF;
  IF p_content_type NOT IN ('audio/webm', 'audio/mp4', 'audio/ogg', 'audio/wav')
     OR p_byte_size NOT BETWEEN 1 AND 52428800
     OR p_object_key NOT LIKE 'storyforge-audio/' || public.sf_actor_id()::text || '/' || p_story_id::text || '/%' THEN
    RAISE EXCEPTION 'invalid audio upload metadata' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.sf_audio_assets
    (story_id, student_id, object_key, content_type, byte_size)
  VALUES (p_story_id, public.sf_actor_id(), p_object_key, p_content_type, p_byte_size)
  RETURNING * INTO v_asset;
  RETURN v_asset;
END
$$;

CREATE OR REPLACE FUNCTION public.sf_add_next_question(
  p_student_id uuid,
  p_text text,
  p_notes text DEFAULT NULL,
  p_prepared boolean DEFAULT false
)
RETURNS public.sf_next_questions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row public.sf_next_questions;
BEGIN
  IF NOT public.sf_has_live_identity() THEN
    RAISE EXCEPTION 'eligible identity required' USING ERRCODE = '42501';
  END IF;
  IF NOT (
    (public.sf_actor_role() = 'student' AND p_student_id = public.sf_actor_id())
    OR (public.sf_actor_role() = 'mentor' AND public.sf_is_assigned(p_student_id))
  ) THEN
    RAISE EXCEPTION 'student scope denied' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.sf_next_questions (student_id, text, source, prepared, notes, created_by)
  VALUES (
    p_student_id, trim(p_text),
    CASE WHEN public.sf_actor_role() = 'mentor' THEN 'mentor' ELSE 'manual' END,
    p_prepared, p_notes, public.sf_actor_id()
  )
  RETURNING * INTO v_row;

  INSERT INTO public.sf_audit_events
    (actor_id, actor_role, action, entity_type, entity_id, surface, new_value)
  VALUES (
    public.sf_actor_id(), public.sf_actor_role(), 'next_question.created',
    'next_question', v_row.id, 'workshop',
    jsonb_build_object('student_id', v_row.student_id, 'source', v_row.source)
  );
  RETURN v_row;
END
$$;

CREATE OR REPLACE FUNCTION public.sf_create_workshop(
  p_student_id uuid,
  p_question_a_id uuid,
  p_question_b_id uuid
)
RETURNS public.sf_workshops
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row public.sf_workshops;
BEGIN
  IF NOT public.sf_has_live_identity() THEN
    RAISE EXCEPTION 'eligible identity required' USING ERRCODE = '42501';
  END IF;
  IF NOT (
    (public.sf_actor_role() = 'student' AND p_student_id = public.sf_actor_id())
    OR (public.sf_actor_role() = 'mentor' AND public.sf_is_assigned(p_student_id))
  ) THEN
    RAISE EXCEPTION 'student scope denied' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.sf_workshops (student_id, question_a_id, question_b_id)
  VALUES (p_student_id, p_question_a_id, p_question_b_id)
  RETURNING * INTO v_row;
  RETURN v_row;
END
$$;

CREATE OR REPLACE FUNCTION public.sf_update_workshop(
  p_workshop_id uuid,
  p_strength_a smallint,
  p_strength_b smallint,
  p_preferred_question_id uuid DEFAULT NULL,
  p_why text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_gaps text DEFAULT NULL,
  p_status text DEFAULT 'draft'
)
RETURNS public.sf_workshops
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_before public.sf_workshops;
  v_row public.sf_workshops;
BEGIN
  IF NOT public.sf_has_live_identity() THEN
    RAISE EXCEPTION 'eligible identity required' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_before FROM public.sf_workshops WHERE id = p_workshop_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'workshop not found' USING ERRCODE = 'P0002';
  END IF;

  IF public.sf_actor_role() = 'student' AND v_before.student_id = public.sf_actor_id() THEN
    UPDATE public.sf_workshops SET
      student_strength_a = p_strength_a,
      student_strength_b = p_strength_b,
      preferred_question_id = p_preferred_question_id,
      student_why = p_why,
      status = CASE WHEN p_status = 'prepared' THEN 'prepared' ELSE status END,
      updated_at = now()
    WHERE id = p_workshop_id RETURNING * INTO v_row;
  ELSIF public.sf_actor_role() = 'mentor' AND public.sf_is_assigned(v_before.student_id) THEN
    UPDATE public.sf_workshops SET
      mentor_strength_a = p_strength_a,
      mentor_strength_b = p_strength_b,
      mentor_coaching_notes = p_notes,
      gaps = p_gaps,
      status = CASE WHEN p_status = 'reviewed' THEN 'reviewed' ELSE status END,
      updated_at = now()
    WHERE id = p_workshop_id RETURNING * INTO v_row;
  ELSE
    RAISE EXCEPTION 'workshop scope denied' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.sf_audit_events
    (actor_id, actor_role, action, entity_type, entity_id, surface, previous_value, new_value)
  VALUES (
    public.sf_actor_id(), public.sf_actor_role(), 'workshop.updated',
    'workshop', v_row.id, 'workshop',
    to_jsonb(v_before), to_jsonb(v_row)
  );
  RETURN v_row;
END
$$;

CREATE OR REPLACE FUNCTION public.sf_commit_question_import(
  p_source_name text,
  p_source_format text,
  p_rows jsonb
)
RETURNS public.sf_import_batches
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_batch public.sf_import_batches;
  v_item jsonb;
  v_row_number integer := 0;
  v_text text;
  v_selected boolean;
  v_duplicate uuid;
  v_question uuid;
BEGIN
  IF NOT public.sf_has_live_identity(ARRAY['mentor', 'admin']) THEN
    RAISE EXCEPTION 'mentor or admin identity required' USING ERRCODE = '42501';
  END IF;
  IF p_source_format NOT IN ('paste', 'csv', 'xlsx') THEN
    RAISE EXCEPTION 'unsupported import format' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(p_rows) <> 'array' OR jsonb_array_length(p_rows) > 5000 THEN
    RAISE EXCEPTION 'import rows must be an array of at most 5000 items' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.sf_import_batches
    (source_name, source_format, state, created_by, row_count, committed_at)
  VALUES (
    coalesce(nullif(trim(p_source_name), ''), 'Untitled import'),
    p_source_format, 'committed', public.sf_actor_id(), jsonb_array_length(p_rows), now()
  )
  RETURNING * INTO v_batch;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_rows)
  LOOP
    v_row_number := v_row_number + 1;
    v_text := trim(coalesce(v_item->>'text', ''));
    v_selected := coalesce((v_item->>'selected')::boolean, false);
    v_duplicate := NULL;
    v_question := NULL;
    SELECT id INTO v_duplicate FROM public.sf_questions
    WHERE normalized_text = lower(regexp_replace(v_text, '\s+', ' ', 'g'))
      AND governance_state <> 'retired'
    LIMIT 1;

    IF v_selected AND length(v_text) >= 3 AND v_duplicate IS NULL THEN
      INSERT INTO public.sf_questions
        (text, family, provenance, import_batch_id, governance_state, created_by)
      VALUES (
        v_text, coalesce(nullif(v_item->>'family', ''), 'general'),
        'imported', v_batch.id, 'draft', public.sf_actor_id()
      )
      RETURNING id INTO v_question;
    END IF;

    INSERT INTO public.sf_import_rows
      (batch_id, row_number, raw_text, normalized_text, duplicate_question_id, selected, error, created_question_id)
    VALUES (
      v_batch.id, v_row_number, v_text,
      lower(regexp_replace(v_text, '\s+', ' ', 'g')),
      v_duplicate, v_selected,
      CASE
        WHEN length(v_text) < 3 THEN 'Question text is too short'
        WHEN v_duplicate IS NOT NULL THEN 'Exact duplicate'
        ELSE NULL
      END,
      v_question
    );
  END LOOP;

  INSERT INTO public.sf_audit_events
    (actor_id, actor_role, action, entity_type, entity_id, surface, new_value)
  VALUES (
    public.sf_actor_id(), public.sf_actor_role(), 'question_import.committed',
    'import_batch', v_batch.id, 'import',
    jsonb_build_object('source_format', v_batch.source_format, 'row_count', v_batch.row_count)
  );
  RETURN v_batch;
END
$$;

CREATE OR REPLACE FUNCTION public.sf_rollback_question_import(p_batch_id uuid)
RETURNS public.sf_import_batches
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_batch public.sf_import_batches;
BEGIN
  IF NOT public.sf_has_live_identity(ARRAY['mentor', 'admin']) THEN
    RAISE EXCEPTION 'mentor or admin identity required' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_batch FROM public.sf_import_batches
  WHERE id = p_batch_id
    AND (created_by = public.sf_actor_id() OR public.sf_actor_role() = 'admin')
  FOR UPDATE;
  IF NOT FOUND OR v_batch.state <> 'committed' THEN
    RAISE EXCEPTION 'committed import batch not found' USING ERRCODE = 'P0002';
  END IF;
  UPDATE public.sf_questions
  SET governance_state = 'retired'
  WHERE import_batch_id = p_batch_id AND governance_state <> 'retired';
  UPDATE public.sf_import_batches
  SET state = 'rolled_back', rolled_back_at = now()
  WHERE id = p_batch_id
  RETURNING * INTO v_batch;
  RETURN v_batch;
END
$$;

REVOKE ALL ON FUNCTION public.sf_create_story(text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sf_update_story(uuid, text, text, smallint, text[], text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sf_submit_story(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sf_open_story(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sf_review_story(uuid, text, text, smallint, boolean, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sf_mark_notification_read(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sf_begin_audio_asset(uuid, text, text, bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sf_add_next_question(uuid, text, text, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sf_create_workshop(uuid, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sf_update_workshop(uuid, smallint, smallint, uuid, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sf_commit_question_import(text, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sf_rollback_question_import(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sf_actor_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sf_actor_role() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sf_actor_eligible() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sf_is_assigned(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sf_are_coassigned(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sf_has_live_identity(text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sf_forbid_audit_mutation() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sf_protect_story_original() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.sf_create_story(text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sf_update_story(uuid, text, text, smallint, text[], text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sf_submit_story(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sf_open_story(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sf_review_story(uuid, text, text, smallint, boolean, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sf_mark_notification_read(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sf_begin_audio_asset(uuid, text, text, bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sf_add_next_question(uuid, text, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sf_create_workshop(uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sf_update_workshop(uuid, smallint, smallint, uuid, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sf_commit_question_import(text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sf_rollback_question_import(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sf_actor_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.sf_actor_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.sf_actor_eligible() TO authenticated;
GRANT EXECUTE ON FUNCTION public.sf_is_assigned(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sf_are_coassigned(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sf_has_live_identity(text[]) TO authenticated;

COMMIT;
