-- Migration: 20260801190000_b1_510i_admin_console.sql
-- Authority: B1-510I Phase B
-- Date: 2026-08-01
-- Depends on: 20260730000100_b1_507b_reconciliation_state.sql
-- Description: Bounded, feature-gated administrator review workspace.
-- Idempotent: NO

BEGIN;

SELECT pg_advisory_xact_lock(hashtextextended('b1-510i-admin-console', 0));

SELECT set_config(
  'storyforge.admin_console_founder_user_id',
  :'admin_console_founder_user_id',
  true
);

DO $$
DECLARE
  v_founder uuid := current_setting('storyforge.admin_console_founder_user_id')::uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.sf_users
    WHERE id = v_founder AND role = 'admin' AND eligible
  ) THEN
    RAISE EXCEPTION 'pinned admin console founder must be an eligible StoryForge administrator';
  END IF;
END
$$;

ALTER TABLE public.sf_stories
  ADD COLUMN review_suitability text,
  ADD COLUMN suitability_reviewed_by uuid REFERENCES public.sf_users(id) ON DELETE RESTRICT,
  ADD COLUMN suitability_reviewed_at timestamptz;

ALTER TABLE public.sf_stories
  ADD CONSTRAINT sf_stories_review_suitability_check
  CHECK (review_suitability IS NULL OR review_suitability IN (
    'ps_only', 'interview_only', 'both', 'neither'
  ));

ALTER TABLE public.sf_audit_events
  DROP CONSTRAINT IF EXISTS sf_audit_events_visibility_check;
ALTER TABLE public.sf_audit_events
  ADD CONSTRAINT sf_audit_events_visibility_check
  CHECK (visibility IN ('both', 'mentor_only', 'admin_only'));

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
  IF p_visibility NOT IN ('both', 'mentor_only', 'admin_only') THEN
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

CREATE TABLE public.sf_story_internal_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id uuid NOT NULL REFERENCES public.sf_stories(id) ON DELETE RESTRICT,
  admin_id uuid NOT NULL REFERENCES public.sf_users(id) ON DELETE RESTRICT,
  body text NOT NULL CHECK (length(trim(body)) BETWEEN 1 AND 10000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX sf_story_internal_notes_story_created_idx
  ON public.sf_story_internal_notes (story_id, created_at DESC, id DESC);

CREATE OR REPLACE FUNCTION public.sf_forbid_internal_note_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'StoryForge administrator notes are append-only' USING ERRCODE = '42501';
END
$$;

CREATE TRIGGER sf_story_internal_notes_append_only
BEFORE UPDATE OR DELETE ON public.sf_story_internal_notes
FOR EACH ROW EXECUTE FUNCTION public.sf_forbid_internal_note_mutation();

ALTER TABLE public.sf_story_internal_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sf_story_internal_notes FORCE ROW LEVEL SECURITY;

INSERT INTO public.sf_feature_flags (key, scope, allowlist, cohorts, updated_by)
VALUES (
  'admin_console', 'off', '{}'::uuid[], '{}'::text[],
  current_setting('storyforge.admin_console_founder_user_id')::uuid
);

CREATE OR REPLACE FUNCTION public.sf_admin_console_enabled()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.sf_has_live_identity(ARRAY['admin'])
    AND EXISTS (
      SELECT 1
      FROM public.sf_feature_flags flag
      WHERE flag.key = 'admin_console'
        AND (
          flag.scope = 'eligible_all'
          OR (
            flag.scope = 'allowlist'
            AND public.sf_actor_id() = ANY(flag.allowlist)
          )
        )
    )
$$;

CREATE OR REPLACE FUNCTION public.sf_admin_set_console_flag(
  p_scope text,
  p_allowlist uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_before public.sf_feature_flags;
  v_after public.sf_feature_flags;
BEGIN
  IF NOT public.sf_has_live_identity(ARRAY['admin']) THEN
    RAISE EXCEPTION 'eligible administrator identity required' USING ERRCODE = '42501';
  END IF;
  IF p_scope NOT IN ('off', 'allowlist') THEN
    RAISE EXCEPTION 'invalid administrator console scope' USING ERRCODE = '22023';
  END IF;
  p_allowlist := coalesce(p_allowlist, '{}'::uuid[]);
  IF cardinality(p_allowlist) > 10
     OR (p_scope = 'off' AND cardinality(p_allowlist) <> 0)
     OR (p_scope = 'allowlist' AND cardinality(p_allowlist) = 0) THEN
    RAISE EXCEPTION 'invalid administrator console allowlist' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO STRICT v_before
  FROM public.sf_feature_flags
  WHERE key = 'admin_console'
  FOR UPDATE;

  UPDATE public.sf_feature_flags
  SET scope = p_scope,
      allowlist = ARRAY(SELECT DISTINCT value FROM unnest(p_allowlist) value ORDER BY value),
      cohorts = '{}'::text[],
      updated_by = public.sf_actor_id(),
      updated_at = now()
  WHERE key = 'admin_console'
  RETURNING * INTO v_after;

  PERFORM public.sf_append_audit(
    'admin.feature_scope_changed', 'feature_flag', NULL, 'system',
    NULL, NULL, NULL,
    jsonb_build_object('scope', v_before.scope, 'allowlist_count', cardinality(v_before.allowlist)),
    jsonb_build_object('scope', v_after.scope, 'allowlist_count', cardinality(v_after.allowlist)),
    NULL, 'admin_only'
  );

  RETURN jsonb_build_object(
    'key', v_after.key,
    'scope', v_after.scope,
    'allowlist', to_jsonb(v_after.allowlist),
    'cohorts', '[]'::jsonb,
    'updatedBy', v_after.updated_by,
    'updatedAt', v_after.updated_at
  );
END
$$;

CREATE POLICY sf_story_internal_notes_admin_read
ON public.sf_story_internal_notes
FOR SELECT TO authenticated
USING (public.sf_admin_console_enabled());

REVOKE ALL ON public.sf_story_internal_notes FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.sf_story_internal_notes TO authenticated;

DROP POLICY IF EXISTS sf_audit_read ON public.sf_audit_events;
CREATE POLICY sf_audit_read ON public.sf_audit_events
FOR SELECT TO authenticated
USING (
  public.sf_has_live_identity()
  AND (
    (
      public.sf_actor_role() = 'student'
      AND visibility = 'both'
      AND (
        student_id = public.sf_actor_id()
        OR (
          student_id IS NULL AND story_id IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM public.sf_stories story
            WHERE story.id = sf_audit_events.story_id
              AND story.student_id = public.sf_actor_id()
          )
        )
        OR (
          student_id IS NULL AND story_id IS NULL
          AND actor_id = public.sf_actor_id()
        )
      )
    )
    OR (
      public.sf_actor_role() = 'mentor'
      AND visibility IN ('both', 'mentor_only')
      AND (
        (student_id IS NOT NULL AND public.sf_is_assigned(student_id))
        OR (
          student_id IS NULL AND story_id IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM public.sf_stories story
            WHERE story.id = sf_audit_events.story_id
              AND public.sf_is_assigned(story.student_id)
          )
        )
        OR (
          student_id IS NULL AND story_id IS NULL
          AND actor_id = public.sf_actor_id()
        )
      )
    )
    OR (
      public.sf_actor_role() = 'admin'
      AND (
        (
          visibility = 'admin_only'
          AND public.sf_admin_console_enabled()
        )
        OR (
          student_id IS NULL AND story_id IS NULL
          AND actor_id = public.sf_actor_id()
        )
      )
    )
  )
);

CREATE OR REPLACE FUNCTION public.sf_admin_assert_enabled()
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.sf_admin_console_enabled() THEN
    RAISE EXCEPTION 'administrator console is unavailable' USING ERRCODE = '42501';
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.sf_admin_home(p_limit integer DEFAULT 8)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_result jsonb;
  v_count integer;
BEGIN
  PERFORM public.sf_admin_assert_enabled();
  IF p_limit < 1 OR p_limit > 25 THEN
    RAISE EXCEPTION 'invalid administrator page limit' USING ERRCODE = '22023';
  END IF;

  SELECT count(*)::integer INTO v_count
  FROM public.sf_stories
  WHERE status <> 'private' AND archived_at IS NULL;

  SELECT jsonb_build_object(
    'metrics', jsonb_build_object(
      'submittedStories', v_count,
      'awaitingReview', count(*) FILTER (WHERE status = 'awaiting'),
      'inReview', count(*) FILTER (WHERE status = 'in_review'),
      'changesRequested', count(*) FILTER (WHERE status = 'changes'),
      'reviewed', count(*) FILTER (WHERE status = 'reviewed'),
      'approved', count(*) FILTER (WHERE status = 'approved'),
      'unscored', count(*) FILTER (WHERE mentor_score IS NULL)
    ),
    'recent', coalesce((
      SELECT jsonb_agg(item ORDER BY item->>'updatedAt' DESC)
      FROM (
        SELECT jsonb_build_object(
          'id', story.id,
          'title', story.title,
          'studentId', story.student_id,
          'studentName', student.display_name,
          'status', story.status,
          'mentorScore', story.mentor_score,
          'reviewSuitability', story.review_suitability,
          'rowVersion', story.row_version,
          'updatedAt', story.updated_at
        ) AS item
        FROM public.sf_stories story
        JOIN public.sf_users student ON student.id = story.student_id
        WHERE story.status <> 'private' AND story.archived_at IS NULL
        ORDER BY story.updated_at DESC, story.id DESC
        LIMIT p_limit
      ) recent_rows
    ), '[]'::jsonb)
  ) INTO v_result
  FROM public.sf_stories
  WHERE status <> 'private' AND archived_at IS NULL;

  PERFORM public.sf_append_audit(
    'admin.home_viewed', 'admin_console', NULL, 'system', NULL, NULL, NULL,
    NULL, jsonb_build_object('result_count', v_count), NULL, 'admin_only'
  );
  RETURN v_result;
END
$$;

CREATE OR REPLACE FUNCTION public.sf_admin_search_students(
  p_query text DEFAULT '',
  p_review_status text DEFAULT NULL,
  p_after_name text DEFAULT NULL,
  p_after_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 25
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_query text := left(trim(coalesce(p_query, '')), 120);
  v_result jsonb;
  v_result_count integer;
BEGIN
  PERFORM public.sf_admin_assert_enabled();
  IF p_limit < 1 OR p_limit > 50 THEN
    RAISE EXCEPTION 'invalid administrator page limit' USING ERRCODE = '22023';
  END IF;
  IF p_review_status IS NOT NULL AND p_review_status NOT IN (
    'awaiting', 'in_review', 'changes', 'reviewed', 'approved', 'unscored'
  ) THEN
    RAISE EXCEPTION 'invalid review status filter' USING ERRCODE = '22023';
  END IF;
  IF (p_after_name IS NULL) <> (p_after_id IS NULL) THEN
    RAISE EXCEPTION 'administrator cursor is incomplete' USING ERRCODE = '22023';
  END IF;

  WITH candidates AS (
    SELECT
      student.id, student.wp_user_id, student.display_name, student.first_name,
      student.cohort, student.academic_year, student.specialty,
      student.application_cycle,
      count(story.id)::integer AS story_count,
      count(story.id) FILTER (WHERE story.status = 'awaiting')::integer AS awaiting_review,
      count(story.id) FILTER (WHERE story.status = 'changes')::integer AS changes_requested,
      count(story.id) FILTER (WHERE story.mentor_score IS NULL)::integer AS unscored,
      max(story.updated_at) AS last_story_at
    FROM public.sf_users student
    JOIN public.sf_stories story
      ON story.student_id = student.id
     AND story.status <> 'private'
     AND story.archived_at IS NULL
    WHERE student.role = 'student' AND student.eligible
      AND (
        v_query = ''
        OR student.display_name ILIKE '%' || v_query || '%'
        OR coalesce(student.first_name, '') ILIKE '%' || v_query || '%'
        OR student.wp_user_id::text = v_query
        OR coalesce(student.cohort, '') ILIKE '%' || v_query || '%'
      )
      AND (
        p_after_name IS NULL
        OR (lower(student.display_name), student.id) > (lower(p_after_name), p_after_id)
      )
    GROUP BY student.id
    HAVING p_review_status IS NULL
      OR bool_or(story.status = p_review_status)
      OR (p_review_status = 'unscored' AND bool_or(story.mentor_score IS NULL))
    ORDER BY lower(student.display_name), student.id
    LIMIT p_limit + 1
  ), page AS (
    SELECT * FROM candidates
    ORDER BY lower(display_name), id
    LIMIT p_limit
  )
  SELECT jsonb_build_object(
    'students', coalesce(jsonb_agg(jsonb_build_object(
      'id', id,
      'wpUserId', wp_user_id,
      'displayName', display_name,
      'firstName', first_name,
      'cohort', cohort,
      'academicYear', academic_year,
      'specialty', specialty,
      'applicationCycle', application_cycle,
      'storyCount', story_count,
      'awaitingReview', awaiting_review,
      'changesRequested', changes_requested,
      'unscored', unscored,
      'lastStoryAt', last_story_at
    ) ORDER BY lower(display_name), id), '[]'::jsonb),
    'nextCursor', CASE WHEN (SELECT count(*) FROM candidates) > p_limit THEN (
      SELECT jsonb_build_object('name', display_name, 'id', id)
      FROM page ORDER BY lower(display_name) DESC, id DESC LIMIT 1
    ) ELSE NULL END
  ) INTO v_result
  FROM page;

  v_result_count := jsonb_array_length(v_result->'students');
  PERFORM public.sf_append_audit(
    'admin.student_search', 'admin_console', NULL, 'system', NULL, NULL, NULL,
    NULL, jsonb_build_object(
      'query_present', v_query <> '',
      'filter_present', p_review_status IS NOT NULL,
      'cursor_present', p_after_id IS NOT NULL,
      'result_count', v_result_count
    ), NULL, 'admin_only'
  );
  RETURN v_result;
END
$$;

CREATE OR REPLACE FUNCTION public.sf_admin_student_detail(
  p_student_id uuid,
  p_after_updated_at timestamptz DEFAULT NULL,
  p_after_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 25
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_result jsonb;
BEGIN
  PERFORM public.sf_admin_assert_enabled();
  IF p_limit < 1 OR p_limit > 50 THEN
    RAISE EXCEPTION 'invalid administrator page limit' USING ERRCODE = '22023';
  END IF;
  IF (p_after_updated_at IS NULL) <> (p_after_id IS NULL) THEN
    RAISE EXCEPTION 'administrator cursor is incomplete' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.sf_users
    WHERE id = p_student_id AND role = 'student' AND eligible
  ) THEN
    RAISE EXCEPTION 'student not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT jsonb_build_object(
    'student', jsonb_build_object(
      'id', student.id,
      'wpUserId', student.wp_user_id,
      'displayName', student.display_name,
      'firstName', student.first_name,
      'cohort', student.cohort,
      'academicYear', student.academic_year,
      'specialty', student.specialty,
      'applicationCycle', student.application_cycle
    ),
    'stories', coalesce((
      SELECT jsonb_agg(item ORDER BY item->>'updatedAt' DESC)
      FROM (
        SELECT jsonb_build_object(
          'id', story.id,
          'title', story.title,
          'status', story.status,
          'mentorScore', story.mentor_score,
          'reviewSuitability', story.review_suitability,
          'rowVersion', story.row_version,
          'revised', story.revised,
          'updatedAt', story.updated_at,
          'reviewedAt', story.reviewed_at
        ) AS item
        FROM public.sf_stories story
        WHERE story.student_id = p_student_id
          AND story.status <> 'private'
          AND story.archived_at IS NULL
          AND (
            p_after_updated_at IS NULL
            OR (story.updated_at, story.id) < (p_after_updated_at, p_after_id)
          )
        ORDER BY story.updated_at DESC, story.id DESC
        LIMIT p_limit
      ) story_rows
    ), '[]'::jsonb)
  ) INTO v_result
  FROM public.sf_users student
  WHERE student.id = p_student_id;

  PERFORM public.sf_append_audit(
    'admin.student_viewed', 'student', p_student_id, 'system', p_student_id,
    NULL, NULL, NULL, jsonb_build_object('cursor_present', p_after_id IS NOT NULL),
    NULL, 'admin_only'
  );
  RETURN v_result;
END
$$;

CREATE OR REPLACE FUNCTION public.sf_admin_review_queue(
  p_status text DEFAULT NULL,
  p_student_id uuid DEFAULT NULL,
  p_after_at timestamptz DEFAULT NULL,
  p_after_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 25
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_result jsonb;
BEGIN
  PERFORM public.sf_admin_assert_enabled();
  IF p_limit < 1 OR p_limit > 50 THEN
    RAISE EXCEPTION 'invalid administrator page limit' USING ERRCODE = '22023';
  END IF;
  IF p_status IS NOT NULL AND p_status NOT IN (
    'awaiting', 'in_review', 'changes', 'reviewed', 'approved', 'unscored'
  ) THEN
    RAISE EXCEPTION 'invalid review status filter' USING ERRCODE = '22023';
  END IF;
  IF (p_after_at IS NULL) <> (p_after_id IS NULL) THEN
    RAISE EXCEPTION 'administrator cursor is incomplete' USING ERRCODE = '22023';
  END IF;

  WITH candidates AS (
    SELECT story.*, student.display_name AS student_name,
      student.cohort AS student_cohort
    FROM public.sf_stories story
    JOIN public.sf_users student ON student.id = story.student_id
    WHERE story.status <> 'private' AND story.archived_at IS NULL
      AND (p_student_id IS NULL OR story.student_id = p_student_id)
      AND (
        p_status IS NULL
        OR story.status = p_status
        OR (p_status = 'unscored' AND story.mentor_score IS NULL)
      )
      AND (
        p_after_at IS NULL
        OR (coalesce(story.last_submitted_at, story.updated_at), story.id)
          < (p_after_at, p_after_id)
      )
    ORDER BY coalesce(story.last_submitted_at, story.updated_at) DESC, story.id DESC
    LIMIT p_limit + 1
  ), page AS (
    SELECT * FROM candidates
    ORDER BY coalesce(last_submitted_at, updated_at) DESC, id DESC
    LIMIT p_limit
  )
  SELECT jsonb_build_object(
    'stories', coalesce(jsonb_agg(jsonb_build_object(
      'id', id,
      'title', title,
      'studentId', student_id,
      'studentName', student_name,
      'cohort', student_cohort,
      'status', status,
      'mentorScore', mentor_score,
      'reviewSuitability', review_suitability,
      'rowVersion', row_version,
      'revised', revised,
      'updatedAt', updated_at,
      'submittedAt', coalesce(last_submitted_at, submitted_at)
    ) ORDER BY coalesce(last_submitted_at, updated_at) DESC, id DESC), '[]'::jsonb),
    'nextCursor', CASE WHEN (SELECT count(*) FROM candidates) > p_limit THEN (
      SELECT jsonb_build_object(
        'at', coalesce(last_submitted_at, updated_at), 'id', id
      ) FROM page ORDER BY coalesce(last_submitted_at, updated_at), id LIMIT 1
    ) ELSE NULL END
  ) INTO v_result
  FROM page;

  PERFORM public.sf_append_audit(
    'admin.queue_viewed', 'admin_console', NULL, 'system', p_student_id,
    NULL, NULL, NULL, jsonb_build_object(
      'filter_present', p_status IS NOT NULL,
      'student_filter_present', p_student_id IS NOT NULL,
      'cursor_present', p_after_id IS NOT NULL,
      'result_count', jsonb_array_length(v_result->'stories')
    ), NULL, 'admin_only'
  );
  RETURN v_result;
END
$$;

CREATE OR REPLACE FUNCTION public.sf_admin_story_detail(p_story_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_story public.sf_stories;
  v_result jsonb;
BEGIN
  PERFORM public.sf_admin_assert_enabled();
  SELECT * INTO v_story
  FROM public.sf_stories
  WHERE id = p_story_id AND status <> 'private' AND archived_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'story not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT jsonb_build_object(
    'story', jsonb_build_object(
      'id', story.id,
      'studentId', story.student_id,
      'studentName', student.display_name,
      'title', story.title,
      'originalTitle', coalesce(revision0.title_snapshot, story.title),
      'originalText', coalesce(original.original_transcript, story.original_text),
      'text', story.current_text,
      'lesson', story.lesson,
      'status', story.status,
      'studentScore', story.student_score,
      'mentorScore', story.mentor_score,
      'reviewSuitability', story.review_suitability,
      'birds', story.birds,
      'positions', story.positions,
      'themes', story.themes,
      'uses', story.uses,
      'revised', story.revised,
      'rowVersion', story.row_version,
      'createdAt', story.created_at,
      'updatedAt', story.updated_at,
      'submittedAt', story.submitted_at,
      'reviewedAt', story.reviewed_at,
      'reviewedByName', reviewer.display_name,
      'reviewedByRole', reviewer.role
    ),
    'feedback', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', feedback.id,
        'body', feedback.body,
        'disposition', feedback.disposition,
        'createdAt', feedback.created_at,
        'reviewerName', actor.display_name,
        'reviewerRole', actor.role
      ) ORDER BY feedback.created_at, feedback.id)
      FROM public.sf_feedback feedback
      JOIN public.sf_users actor ON actor.id = feedback.mentor_id
      WHERE feedback.story_id = story.id
    ), '[]'::jsonb),
    'revisions', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', revision.id,
        'revisionNo', revision.revision_no,
        'title', revision.title_snapshot,
        'text', revision.text_snapshot,
        'reason', revision.reason,
        'actorName', actor.display_name,
        'actorRole', actor.role,
        'createdAt', revision.created_at
      ) ORDER BY revision.created_at, revision.id)
      FROM public.sf_story_revisions revision
      JOIN public.sf_users actor ON actor.id = revision.actor_id
      WHERE revision.story_id = story.id
    ), '[]'::jsonb),
    'reflections', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', reflection.id,
        'prompt', reflection.prompt,
        'answer', reflection.answer,
        'fromMentor', reflection.from_mentor,
        'createdAt', reflection.created_at,
        'answeredAt', reflection.answered_at
      ) ORDER BY reflection.created_at, reflection.id)
      FROM public.sf_story_reflections reflection
      WHERE reflection.story_id = story.id
    ), '[]'::jsonb),
    'craft', (
      SELECT to_jsonb(craft) - 'scored_by'
      FROM public.sf_story_craft craft
      WHERE craft.story_id = story.id
    ),
    'internalNotes', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', note.id,
        'body', note.body,
        'adminName', admin_user.display_name,
        'createdAt', note.created_at
      ) ORDER BY note.created_at, note.id)
      FROM public.sf_story_internal_notes note
      JOIN public.sf_users admin_user ON admin_user.id = note.admin_id
      WHERE note.story_id = story.id
    ), '[]'::jsonb)
  ) INTO v_result
  FROM public.sf_stories story
  JOIN public.sf_users student ON student.id = story.student_id
  LEFT JOIN public.sf_users reviewer ON reviewer.id = story.reviewed_by
  LEFT JOIN public.sf_story_originals original ON original.story_id = story.id
  LEFT JOIN LATERAL (
    SELECT revision.title_snapshot
    FROM public.sf_story_revisions revision
    WHERE revision.story_id = story.id
    ORDER BY revision.created_at, revision.id
    LIMIT 1
  ) revision0 ON true
  WHERE story.id = p_story_id;

  PERFORM public.sf_append_audit(
    'admin.story_viewed', 'story', p_story_id, 'system', v_story.student_id,
    p_story_id, NULL, NULL, NULL, NULL, 'admin_only'
  );
  RETURN v_result;
END
$$;

CREATE OR REPLACE FUNCTION public.sf_admin_review_story(
  p_story_id uuid,
  p_expected_version bigint,
  p_patch jsonb,
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
  v_actor_name text;
  v_status text;
  v_score smallint;
  v_suitability text;
  v_feedback text;
  v_internal_note text;
  v_feedback_id uuid;
  v_note_id uuid;
  v_story_mutation boolean := false;
  v_unknown text[];
BEGIN
  PERFORM public.sf_admin_assert_enabled();
  IF p_surface NOT IN ('workspace', 'quick') THEN
    RAISE EXCEPTION 'invalid administrator review surface' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(p_patch) <> 'object' OR p_patch = '{}'::jsonb THEN
    RAISE EXCEPTION 'administrator review patch is required' USING ERRCODE = '22023';
  END IF;
  SELECT array_agg(key) INTO v_unknown
  FROM jsonb_object_keys(p_patch) key
  WHERE key NOT IN ('status', 'mentorScore', 'suitability', 'studentFeedback', 'internalNote');
  IF v_unknown IS NOT NULL THEN
    RAISE EXCEPTION 'administrator review patch contains unknown fields' USING ERRCODE = '22023';
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

  IF p_patch ? 'status' THEN
    v_status := p_patch->>'status';
    IF v_status NOT IN ('in_review', 'changes', 'reviewed', 'approved') THEN
      RAISE EXCEPTION 'invalid administrator review status' USING ERRCODE = '22023';
    END IF;
    v_story_mutation := v_story_mutation OR v_status IS DISTINCT FROM v_before.status;
  ELSE
    v_status := v_before.status;
  END IF;

  IF p_patch ? 'mentorScore' THEN
    IF p_patch->'mentorScore' = 'null'::jsonb THEN
      v_score := NULL;
    ELSE
      v_score := (p_patch->>'mentorScore')::smallint;
      IF v_score < 1 OR v_score > 5 THEN
        RAISE EXCEPTION 'invalid administrator mentor score' USING ERRCODE = '22023';
      END IF;
    END IF;
    v_story_mutation := v_story_mutation OR v_score IS DISTINCT FROM v_before.mentor_score;
  ELSE
    v_score := v_before.mentor_score;
  END IF;

  IF p_patch ? 'suitability' THEN
    IF p_patch->'suitability' = 'null'::jsonb THEN
      v_suitability := NULL;
    ELSE
      v_suitability := p_patch->>'suitability';
      IF v_suitability NOT IN ('ps_only', 'interview_only', 'both', 'neither') THEN
        RAISE EXCEPTION 'invalid administrator suitability' USING ERRCODE = '22023';
      END IF;
    END IF;
    v_story_mutation := v_story_mutation OR v_suitability IS DISTINCT FROM v_before.review_suitability;
  ELSE
    v_suitability := v_before.review_suitability;
  END IF;

  IF p_patch ? 'studentFeedback' THEN
    v_feedback := trim(p_patch->>'studentFeedback');
    IF length(v_feedback) < 1 OR length(v_feedback) > 10000 THEN
      RAISE EXCEPTION 'student-visible feedback must be between 1 and 10000 characters' USING ERRCODE = '22023';
    END IF;
    v_story_mutation := true;
  END IF;
  IF p_patch ? 'internalNote' THEN
    v_internal_note := trim(p_patch->>'internalNote');
    IF length(v_internal_note) < 1 OR length(v_internal_note) > 10000 THEN
      RAISE EXCEPTION 'internal administrator note must be between 1 and 10000 characters' USING ERRCODE = '22023';
    END IF;
  END IF;
  IF NOT v_story_mutation AND v_internal_note IS NULL THEN
    RAISE EXCEPTION 'administrator review patch makes no change' USING ERRCODE = '22023';
  END IF;

  SELECT display_name INTO v_actor_name
  FROM public.sf_users WHERE id = public.sf_actor_id();

  IF v_story_mutation THEN
    UPDATE public.sf_stories
    SET status = v_status,
        mentor_score = v_score,
        review_suitability = v_suitability,
        suitability_reviewed_by = CASE
          WHEN p_patch ? 'suitability' THEN public.sf_actor_id()
          ELSE suitability_reviewed_by
        END,
        suitability_reviewed_at = CASE
          WHEN p_patch ? 'suitability' THEN now()
          ELSE suitability_reviewed_at
        END,
        reviewed_by = public.sf_actor_id(),
        reviewed_at = now(),
        feedback_sent_at = CASE
          WHEN v_feedback IS NOT NULL THEN now()
          ELSE feedback_sent_at
        END,
        status_changed_at = CASE
          WHEN p_patch ? 'status' AND v_status IS DISTINCT FROM v_before.status THEN now()
          ELSE status_changed_at
        END,
        approved_at = CASE
          WHEN p_patch ? 'status' AND v_status = 'approved' THEN now()
          WHEN p_patch ? 'status' THEN NULL
          ELSE approved_at
        END,
        revised = CASE
          WHEN p_patch ? 'status' THEN false
          ELSE revised
        END,
        row_version = row_version + 1,
        updated_at = now()
    WHERE id = p_story_id
    RETURNING * INTO v_after;
  ELSE
    v_after := v_before;
  END IF;

  IF v_feedback IS NOT NULL THEN
    INSERT INTO public.sf_feedback (story_id, mentor_id, body, disposition)
    VALUES (p_story_id, public.sf_actor_id(), v_feedback, 'feedback')
    RETURNING id INTO v_feedback_id;
    PERFORM public.sf_append_audit(
      'story.feedback_added', 'feedback', v_feedback_id, p_surface,
      v_before.student_id, p_story_id, NULL, NULL,
      jsonb_build_object('reviewer_role', 'admin'), left(v_feedback, 240), 'both'
    );
    PERFORM public.sf_emit_notification(
      v_before.student_id, public.sf_actor_id(), p_story_id, NULL,
      'story.feedback', 'feedback', 'New StoryForge feedback',
      v_actor_name || ' left feedback on “' || v_before.title || '”.',
      '/library?story=' || p_story_id::text
    );
  END IF;

  IF v_internal_note IS NOT NULL THEN
    INSERT INTO public.sf_story_internal_notes (story_id, admin_id, body)
    VALUES (p_story_id, public.sf_actor_id(), v_internal_note)
    RETURNING id INTO v_note_id;
    PERFORM public.sf_append_audit(
      'admin.internal_note_added', 'internal_note', v_note_id, p_surface,
      v_before.student_id, p_story_id, NULL, NULL,
      jsonb_build_object('note_added', true), NULL, 'admin_only'
    );
  END IF;

  IF p_patch ? 'status' AND v_status IS DISTINCT FROM v_before.status THEN
    PERFORM public.sf_append_audit(
      'story.status_changed', 'story', p_story_id, p_surface,
      v_before.student_id, p_story_id, NULL,
      jsonb_build_object('status', v_before.status),
      jsonb_build_object('status', v_status, 'reviewer_role', 'admin'),
      NULL, 'both'
    );
    PERFORM public.sf_emit_notification(
      v_before.student_id, public.sf_actor_id(), p_story_id, NULL,
      'story.' || v_status, 'status', 'Story review updated',
      'The review status for “' || v_before.title || '” is now ' || replace(v_status, '_', ' ') || '.',
      '/library?story=' || p_story_id::text
    );
  END IF;

  IF p_patch ? 'mentorScore' OR p_patch ? 'suitability' THEN
    PERFORM public.sf_append_audit(
      'story.evaluation_updated', 'story', p_story_id, p_surface,
      v_before.student_id, p_story_id, NULL,
      jsonb_build_object(
        'mentor_score', v_before.mentor_score,
        'review_suitability', v_before.review_suitability
      ),
      jsonb_build_object(
        'mentor_score', v_after.mentor_score,
        'review_suitability', v_after.review_suitability,
        'reviewer_role', 'admin'
      ), NULL, 'both'
    );
    PERFORM public.sf_emit_notification(
      v_before.student_id, public.sf_actor_id(), p_story_id, NULL,
      'story.admin_evaluation', 'classification', 'Story review updated',
      'A StoryForge administrator updated the review for “' || v_before.title || '”.',
      '/library?story=' || p_story_id::text
    );
  END IF;

  PERFORM public.sf_append_audit(
    'admin.story_reviewed', 'story', p_story_id, p_surface,
    v_before.student_id, p_story_id, NULL,
    jsonb_build_object('row_version', v_before.row_version),
    jsonb_build_object(
      'row_version', v_after.row_version,
      'status_changed', p_patch ? 'status',
      'score_changed', p_patch ? 'mentorScore',
      'suitability_changed', p_patch ? 'suitability',
      'feedback_added', v_feedback_id IS NOT NULL,
      'internal_note_added', v_note_id IS NOT NULL
    ), NULL, 'admin_only'
  );

  RETURN public.sf_admin_story_detail(p_story_id);
END
$$;

REVOKE ALL ON FUNCTION public.sf_admin_console_enabled() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sf_admin_set_console_flag(text, uuid[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sf_admin_assert_enabled() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sf_admin_home(integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sf_admin_search_students(text, text, text, uuid, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sf_admin_student_detail(uuid, timestamptz, uuid, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sf_admin_review_queue(text, uuid, timestamptz, uuid, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sf_admin_story_detail(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sf_admin_review_story(uuid, bigint, jsonb, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.sf_admin_console_enabled() TO authenticated;
GRANT EXECUTE ON FUNCTION public.sf_admin_set_console_flag(text, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sf_admin_assert_enabled() TO authenticated;
GRANT EXECUTE ON FUNCTION public.sf_admin_home(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sf_admin_search_students(text, text, text, uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sf_admin_student_detail(uuid, timestamptz, uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sf_admin_review_queue(text, uuid, timestamptz, uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sf_admin_story_detail(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sf_admin_review_story(uuid, bigint, jsonb, text) TO authenticated;

DO $$
BEGIN
  IF (SELECT count(*) FROM public.sf_feature_flags WHERE key = 'admin_console') <> 1 THEN
    RAISE EXCEPTION 'admin_console flag was not seeded exactly once';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.sf_feature_flags
    WHERE key = 'admin_console'
      AND (
        scope <> 'off'
        OR cardinality(allowlist) <> 0
        OR cardinality(cohorts) <> 0
        OR updated_by <> current_setting('storyforge.admin_console_founder_user_id')::uuid
      )
  ) THEN
    RAISE EXCEPTION 'admin_console flag must be founder-attributed and default off';
  END IF;
END
$$;

COMMIT;
