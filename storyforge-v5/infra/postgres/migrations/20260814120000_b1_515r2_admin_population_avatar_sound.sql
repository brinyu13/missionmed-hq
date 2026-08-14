\set ON_ERROR_STOP on

-- B1-515R2: current 360 population projection, fail-closed Administrator
-- subject scope, canonical Arena avatar snapshot, and opening-sound preference.
-- Canonical enrollment remains WordPress/LearnDash `mmhq_cam_build_entitlement`.
-- This migration stores only the last complete operator projection; it does not
-- create or reinterpret entitlement, enrollment, course, product, or avatar truth.

BEGIN;
SELECT pg_advisory_xact_lock(hashtextextended('b1-515r2-admin-population-avatar-sound', 0));

CREATE TABLE public.sf_account_preferences (
  user_id uuid PRIMARY KEY REFERENCES public.sf_users(id) ON DELETE CASCADE,
  opening_sound_enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.sf_admin_population_settings (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  selected_population_keys text[] NOT NULL DEFAULT ARRAY['match_mentorship_360']::text[],
  updated_by uuid NOT NULL REFERENCES public.sf_users(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sf_admin_population_settings_keys_check CHECK (
    selected_population_keys = ARRAY[]::text[]
    OR selected_population_keys = ARRAY['match_mentorship_360']::text[]
  )
);

CREATE TABLE public.sf_entitlement_population_projection (
  population_key text NOT NULL CHECK (population_key = 'match_mentorship_360'),
  student_id uuid NOT NULL REFERENCES public.sf_users(id) ON DELETE CASCADE,
  wp_user_id bigint NOT NULL CHECK (wp_user_id > 0),
  generation_id uuid NOT NULL,
  authority text NOT NULL CHECK (authority = 'mmhq_cam_build_entitlement'),
  course_id bigint NOT NULL CHECK (course_id = 3893),
  observed_at timestamptz NOT NULL,
  synced_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (population_key, student_id),
  UNIQUE (population_key, wp_user_id)
);

CREATE TABLE public.sf_entitlement_population_sync_state (
  population_key text PRIMARY KEY CHECK (population_key = 'match_mentorship_360'),
  generation_id uuid NOT NULL UNIQUE,
  authority text NOT NULL CHECK (authority = 'mmhq_cam_build_entitlement'),
  course_id bigint NOT NULL CHECK (course_id = 3893),
  observed_at timestamptz NOT NULL,
  synced_at timestamptz NOT NULL DEFAULT now(),
  member_count integer NOT NULL CHECK (member_count >= 0),
  avatar_authority_available boolean NOT NULL
);

ALTER TABLE public.sf_admin_population_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sf_admin_population_settings FORCE ROW LEVEL SECURITY;
ALTER TABLE public.sf_account_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sf_account_preferences FORCE ROW LEVEL SECURITY;
ALTER TABLE public.sf_entitlement_population_projection ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sf_entitlement_population_projection FORCE ROW LEVEL SECURITY;
ALTER TABLE public.sf_entitlement_population_sync_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sf_entitlement_population_sync_state FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.sf_account_preferences,
  public.sf_admin_population_settings,
  public.sf_entitlement_population_projection,
  public.sf_entitlement_population_sync_state
  FROM PUBLIC, anon, authenticated, storyforge_app;

CREATE OR REPLACE FUNCTION public.sf_opening_sound_preference()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT CASE WHEN public.sf_has_live_identity() THEN coalesce((
    SELECT preference.opening_sound_enabled
    FROM public.sf_account_preferences preference
    WHERE preference.user_id = public.sf_actor_id()
  ), false) ELSE false END
$$;

CREATE OR REPLACE FUNCTION public.sf_set_opening_sound_preference(p_enabled boolean)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE v_enabled boolean;
BEGIN
  IF NOT public.sf_has_live_identity() OR p_enabled IS NULL THEN
    RAISE EXCEPTION 'eligible StoryForge identity and a boolean preference are required'
      USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.sf_account_preferences(user_id, opening_sound_enabled)
  VALUES (public.sf_actor_id(), p_enabled)
  ON CONFLICT (user_id) DO UPDATE SET
    opening_sound_enabled = EXCLUDED.opening_sound_enabled,
    updated_at = CASE
      WHEN sf_account_preferences.opening_sound_enabled IS DISTINCT FROM EXCLUDED.opening_sound_enabled
      THEN now() ELSE sf_account_preferences.updated_at END
  RETURNING opening_sound_enabled INTO v_enabled;
  RETURN v_enabled;
END
$$;

CREATE OR REPLACE FUNCTION public.sf_admin_directory(
  p_query text DEFAULT '',
  p_filter text DEFAULT 'all',
  p_session text DEFAULT '',
  p_sort text DEFAULT 'attention',
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 25
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE v_payload jsonb;
BEGIN
  IF NOT public.sf_b1_514_admin_feature_enabled('admin_directory') THEN
    RAISE EXCEPTION 'administrator directory is disabled' USING ERRCODE='42501';
  END IF;
  IF p_filter NOT IN (
    'all','awaiting','needs_review','never_active','never_started','needs_nudge',
    'progressing','changes','warnings','inactive_7','inactive_30'
  ) OR p_sort NOT IN ('attention','name','recent','quiet','stories')
    OR p_page < 1 OR p_page > 1000000 OR p_page_size < 1 OR p_page_size > 50
    OR length(p_query) > 120 OR length(p_session) > 80 THEN
    RAISE EXCEPTION 'invalid administrator directory query' USING ERRCODE='22023';
  END IF;

  WITH population AS (
    SELECT student.id,student.wp_user_id,student.display_name,student.first_name,
      student.cohort,student.academic_year,student.specialty,student.application_cycle,
      count(story.id) FILTER (
        WHERE story.status<>'private' AND story.visibility IS DISTINCT FROM 'private'
      )::integer AS story_count,
      count(story.id) FILTER (
        WHERE story.status='private' OR story.visibility='private'
      )::integer AS private_count,
      count(story.id) FILTER (
        WHERE story.status<>'private' AND story.visibility='mentor_visible'
      )::integer AS mentor_visible_count,
      count(story.id) FILTER (
        WHERE story.status='awaiting' AND story.visibility IS DISTINCT FROM 'private'
      )::integer AS awaiting_count,
      count(story.id) FILTER (
        WHERE story.status='in_review' AND story.visibility IS DISTINCT FROM 'private'
      )::integer AS in_review_count,
      count(story.id) FILTER (
        WHERE story.status='changes' AND story.visibility IS DISTINCT FROM 'private'
      )::integer AS changes_count,
      count(story.id) FILTER (
        WHERE story.status='reviewed' AND story.visibility IS DISTINCT FROM 'private'
      )::integer AS reviewed_count,
      count(story.id) FILTER (
        WHERE story.status='approved' AND story.visibility IS DISTINCT FROM 'private'
      )::integer AS approved_count,
      max(story.updated_at) FILTER (
        WHERE story.status<>'private' AND story.visibility IS DISTINCT FROM 'private'
      ) AS last_story_at,
      (SELECT max(session.last_beat_at) FROM public.sf_activity_sessions session
        WHERE session.user_id=student.id) AS last_activity_at,
      (SELECT max(checks.sent_at) FROM public.sf_review_checks checks
        WHERE checks.student_id=student.id) AS last_review_check_at
    FROM public.sf_users student
    LEFT JOIN public.sf_stories story
      ON story.student_id=student.id AND story.archived_at IS NULL
    WHERE public.sf_admin_subject_in_scope(student.id)
      AND (p_query='' OR student.display_name ILIKE '%'||p_query||'%'
        OR coalesce(student.first_name,'') ILIKE '%'||p_query||'%'
        OR student.wp_user_id::text=p_query)
      AND (p_session='' OR coalesce(student.cohort,'')=p_session)
    GROUP BY student.id
  ), filtered AS (
    SELECT * FROM population
    WHERE p_filter='all'
      OR (p_filter IN ('awaiting','needs_review') AND awaiting_count>0)
      OR (p_filter IN ('never_active','never_started') AND last_activity_at IS NULL AND story_count=0)
      OR (p_filter='needs_nudge' AND coalesce(last_activity_at,last_story_at) < now()-interval '7 days')
      OR (p_filter='progressing' AND coalesce(last_activity_at,last_story_at) >= now()-interval '7 days')
      OR (p_filter='changes' AND changes_count>0)
      OR (p_filter='warnings' AND (story_count=0 OR coalesce(last_activity_at,last_story_at) < now()-interval '30 days'))
      OR (p_filter='inactive_7' AND coalesce(last_activity_at,last_story_at) < now()-interval '7 days')
      OR (p_filter='inactive_30' AND coalesce(last_activity_at,last_story_at) < now()-interval '30 days')
  ), ranked AS (
    SELECT *,count(*) OVER()::integer AS total
    FROM filtered
    ORDER BY
      CASE WHEN p_sort='attention' THEN awaiting_count+changes_count END DESC,
      CASE WHEN p_sort='name' THEN lower(display_name) END ASC,
      CASE WHEN p_sort='recent' THEN coalesce(last_activity_at,last_story_at) END DESC NULLS LAST,
      CASE WHEN p_sort='quiet' THEN coalesce(last_activity_at,last_story_at) END ASC NULLS FIRST,
      CASE WHEN p_sort='stories' THEN story_count END DESC,
      lower(display_name),id
    OFFSET (p_page-1)*p_page_size LIMIT p_page_size
  )
  SELECT jsonb_build_object(
    'students',coalesce(jsonb_agg(jsonb_build_object(
      'id',id,'wpUserId',wp_user_id,'displayName',display_name,'firstName',first_name,
      'cohort',cohort,'academicYear',academic_year,'specialty',specialty,
      'applicationCycle',application_cycle,'storyCount',story_count,
      'privateCount',private_count,'mentorVisibleCount',mentor_visible_count,
      'awaitingReview',awaiting_count,'inReview',in_review_count,
      'changesRequested',changes_count,'reviewed',reviewed_count,'approved',approved_count,
      'lastStoryAt',last_story_at,'lastActivityAt',last_activity_at,
      'lastReviewCheckAt',last_review_check_at
    )), '[]'::jsonb),
    'total',coalesce(max(total),0),'page',p_page,'pageSize',p_page_size,
    'boundaries',jsonb_build_object(
      'activityFrom',(SELECT activated_at FROM public.sf_activity_config WHERE key='activity_tracking')
    )
  ) INTO v_payload FROM ranked;
  RETURN v_payload || jsonb_build_object('population', public.sf_admin_population_context());
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
SET search_path = pg_catalog, public, pg_temp
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
    SELECT student.id,student.wp_user_id,student.display_name,student.first_name,
      student.cohort,student.academic_year,student.specialty,student.application_cycle,
      count(story.id)::integer AS story_count,
      count(story.id) FILTER (WHERE story.status='awaiting')::integer AS awaiting_review,
      count(story.id) FILTER (WHERE story.status='changes')::integer AS changes_requested,
      count(story.id) FILTER (WHERE story.mentor_score IS NULL)::integer AS unscored,
      max(story.updated_at) AS last_story_at
    FROM public.sf_users student
    JOIN public.sf_stories story
      ON story.student_id=student.id
     AND story.status<>'private'
     AND story.visibility IS DISTINCT FROM 'private'
     AND story.archived_at IS NULL
    WHERE public.sf_admin_subject_in_scope(student.id)
      AND (
        v_query='' OR student.display_name ILIKE '%'||v_query||'%'
        OR coalesce(student.first_name,'') ILIKE '%'||v_query||'%'
        OR student.wp_user_id::text=v_query OR coalesce(student.cohort,'') ILIKE '%'||v_query||'%'
      )
      AND (p_after_name IS NULL OR (lower(student.display_name),student.id)>(lower(p_after_name),p_after_id))
    GROUP BY student.id
    HAVING p_review_status IS NULL OR bool_or(story.status=p_review_status)
      OR (p_review_status='unscored' AND bool_or(story.mentor_score IS NULL))
    ORDER BY lower(student.display_name),student.id
    LIMIT p_limit+1
  ), page AS (
    SELECT * FROM candidates ORDER BY lower(display_name),id LIMIT p_limit
  )
  SELECT jsonb_build_object(
    'students',coalesce(jsonb_agg(jsonb_build_object(
      'id',id,'wpUserId',wp_user_id,'displayName',display_name,'firstName',first_name,
      'cohort',cohort,'academicYear',academic_year,'specialty',specialty,
      'applicationCycle',application_cycle,'storyCount',story_count,
      'awaitingReview',awaiting_review,'changesRequested',changes_requested,
      'unscored',unscored,'lastStoryAt',last_story_at
    ) ORDER BY lower(display_name),id),'[]'::jsonb),
    'nextCursor',CASE WHEN (SELECT count(*) FROM candidates)>p_limit THEN (
      SELECT jsonb_build_object('name',display_name,'id',id)
      FROM page ORDER BY lower(display_name) DESC,id DESC LIMIT 1
    ) ELSE NULL END,
    'population',public.sf_admin_population_context()
  ) INTO v_result FROM page;

  v_result_count:=jsonb_array_length(v_result->'students');
  PERFORM public.sf_append_audit(
    'admin.student_search','admin_console',NULL,'system',NULL,NULL,NULL,NULL,
    jsonb_build_object(
      'query_present',v_query<>'','filter_present',p_review_status IS NOT NULL,
      'cursor_present',p_after_id IS NOT NULL,'result_count',v_result_count
    ),NULL,'admin_only'
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
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE v_result jsonb;
BEGIN
  PERFORM public.sf_admin_assert_enabled();
  IF p_limit<1 OR p_limit>50 THEN
    RAISE EXCEPTION 'invalid administrator page limit' USING ERRCODE='22023';
  END IF;
  IF p_status IS NOT NULL AND p_status NOT IN (
    'awaiting','in_review','changes','reviewed','approved','unscored'
  ) THEN RAISE EXCEPTION 'invalid review status filter' USING ERRCODE='22023'; END IF;
  IF (p_after_at IS NULL)<>(p_after_id IS NULL) THEN
    RAISE EXCEPTION 'administrator cursor is incomplete' USING ERRCODE='22023';
  END IF;
  IF p_student_id IS NOT NULL AND NOT public.sf_admin_subject_in_scope(p_student_id) THEN
    RAISE EXCEPTION 'student not found' USING ERRCODE='P0002';
  END IF;

  WITH candidates AS (
    SELECT story.*,student.display_name AS student_name,student.cohort AS student_cohort
    FROM public.sf_stories story
    JOIN public.sf_users student ON student.id=story.student_id
    WHERE public.sf_admin_subject_story_observable(story.student_id,story.id)
      AND (p_student_id IS NULL OR story.student_id=p_student_id)
      AND (p_status IS NULL OR story.status=p_status
        OR (p_status='unscored' AND story.mentor_score IS NULL))
      AND (p_after_at IS NULL OR (coalesce(story.last_submitted_at,story.updated_at),story.id)<(p_after_at,p_after_id))
    ORDER BY coalesce(story.last_submitted_at,story.updated_at) DESC,story.id DESC
    LIMIT p_limit+1
  ), page AS (
    SELECT * FROM candidates
    ORDER BY coalesce(last_submitted_at,updated_at) DESC,id DESC LIMIT p_limit
  )
  SELECT jsonb_build_object(
    'stories',coalesce(jsonb_agg(jsonb_build_object(
      'id',id,'title',title,'studentId',student_id,'studentName',student_name,
      'cohort',student_cohort,'status',status,'mentorScore',mentor_score,
      'reviewSuitability',review_suitability,'rowVersion',row_version,'revised',revised,
      'updatedAt',updated_at,'submittedAt',coalesce(last_submitted_at,submitted_at)
    ) ORDER BY coalesce(last_submitted_at,updated_at) DESC,id DESC),'[]'::jsonb),
    'nextCursor',CASE WHEN (SELECT count(*) FROM candidates)>p_limit THEN (
      SELECT jsonb_build_object('at',coalesce(last_submitted_at,updated_at),'id',id)
      FROM page ORDER BY coalesce(last_submitted_at,updated_at),id LIMIT 1
    ) ELSE NULL END
  ) INTO v_result FROM page;
  PERFORM public.sf_append_audit(
    'admin.queue_viewed','admin_console',NULL,'system',p_student_id,NULL,NULL,NULL,
    jsonb_build_object(
      'filter_present',p_status IS NOT NULL,'student_filter_present',p_student_id IS NOT NULL,
      'cursor_present',p_after_id IS NOT NULL,'result_count',jsonb_array_length(v_result->'stories')
    ),NULL,'admin_only'
  );
  RETURN v_result;
END
$$;

CREATE OR REPLACE FUNCTION public.sf_admin_review_queue_scaled(
  p_query text,p_status text,p_session text,p_sort text,p_page integer,p_page_size integer
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE v_payload jsonb;
BEGIN
  PERFORM public.sf_admin_assert_enabled();
  IF p_sort NOT IN ('oldest','newest','updated','student') OR p_page<1
    OR p_page_size<1 OR p_page_size>50 OR length(p_query)>120 OR length(p_session)>80
    OR (p_status IS NOT NULL AND p_status<>'' AND p_status NOT IN (
      'awaiting','in_review','changes','reviewed','approved','unscored'
    )) THEN
    RAISE EXCEPTION 'invalid scaled queue query' USING ERRCODE='22023';
  END IF;

  IF p_sort='student' THEN
    WITH matching_students AS (
      SELECT student.id AS student_id,student.display_name AS student_name,
        student.cohort AS student_cohort
      FROM public.sf_stories story
      JOIN public.sf_users student ON student.id=story.student_id
      WHERE public.sf_admin_subject_story_observable(story.student_id,story.id)
        AND (coalesce(p_query,'')='' OR story.title ILIKE '%'||p_query||'%'
          OR student.display_name ILIKE '%'||p_query||'%')
        AND (p_status IS NULL OR p_status='' OR story.status=p_status
          OR (p_status='unscored' AND story.mentor_score IS NULL))
        AND (coalesce(p_session,'')='' OR coalesce(student.cohort,'')=p_session)
      GROUP BY student.id,student.display_name,student.cohort
    ), selected_students AS (
      SELECT * FROM matching_students
      ORDER BY lower(student_name),student_id
      OFFSET (p_page-1)*p_page_size LIMIT p_page_size
    ), items AS (
      SELECT story.*,selected.student_name,selected.student_cohort,
        jsonb_build_object(
          'id',story.id,'title',story.title,'studentId',story.student_id,
          'studentName',selected.student_name,'cohort',selected.student_cohort,
          'status',story.status,'mentorScore',story.mentor_score,
          'reviewSuitability',story.review_suitability,'rowVersion',story.row_version,
          'revised',story.revised,'updatedAt',story.updated_at,
          'submittedAt',coalesce(story.last_submitted_at,story.submitted_at)
        ) AS item
      FROM public.sf_stories story
      JOIN selected_students selected ON selected.student_id=story.student_id
      WHERE public.sf_admin_subject_story_observable(story.student_id,story.id)
        AND (coalesce(p_query,'')='' OR story.title ILIKE '%'||p_query||'%'
          OR selected.student_name ILIKE '%'||p_query||'%')
        AND (p_status IS NULL OR p_status='' OR story.status=p_status
          OR (p_status='unscored' AND story.mentor_score IS NULL))
        AND (coalesce(p_session,'')='' OR coalesce(selected.student_cohort,'')=p_session)
    ), groups AS (
      SELECT student_id,student_name,student_cohort,
        count(*)::integer AS story_count,
        count(*) FILTER (WHERE status IN ('awaiting','in_review'))::integer AS waiting_count,
        min(coalesce(last_submitted_at,submitted_at,updated_at))
          FILTER (WHERE status IN ('awaiting','in_review')) AS oldest_waiting_at,
        jsonb_agg(item ORDER BY coalesce(last_submitted_at,submitted_at,updated_at),id) AS stories
      FROM items GROUP BY student_id,student_name,student_cohort
    )
    SELECT jsonb_build_object(
      'stories',coalesce((SELECT jsonb_agg(item ORDER BY lower(student_name),student_id,
        coalesce(last_submitted_at,submitted_at,updated_at),id) FROM items),'[]'::jsonb),
      'studentGroups',coalesce((SELECT jsonb_agg(jsonb_build_object(
        'studentId',student_id,'studentName',student_name,'session',student_cohort,
        'storyCount',story_count,'waitingCount',waiting_count,
        'oldestWaitingAt',oldest_waiting_at,'stories',stories
      ) ORDER BY lower(student_name),student_id) FROM groups),'[]'::jsonb),
      'groupedBy','student',
      'total',(SELECT count(*)::integer FROM matching_students),
      'page',p_page,'pageSize',p_page_size
    ) INTO v_payload;
    RETURN v_payload;
  END IF;

  WITH matching AS (
    SELECT story.*,student.display_name AS student_name,student.cohort AS student_cohort,
      count(*) OVER()::integer AS total
    FROM public.sf_stories story
    JOIN public.sf_users student ON student.id=story.student_id
    WHERE public.sf_admin_subject_story_observable(story.student_id,story.id)
      AND (coalesce(p_query,'')='' OR story.title ILIKE '%'||p_query||'%'
        OR student.display_name ILIKE '%'||p_query||'%')
      AND (p_status IS NULL OR p_status='' OR story.status=p_status
        OR (p_status='unscored' AND story.mentor_score IS NULL))
      AND (coalesce(p_session,'')='' OR coalesce(student.cohort,'')=p_session)
    ORDER BY
      CASE WHEN p_sort='oldest' THEN coalesce(story.last_submitted_at,story.updated_at) END ASC,
      CASE WHEN p_sort='newest' THEN coalesce(story.last_submitted_at,story.updated_at) END DESC,
      CASE WHEN p_sort='updated' THEN story.updated_at END DESC,
      story.id
    OFFSET (p_page-1)*p_page_size LIMIT p_page_size
  )
  SELECT jsonb_build_object(
    'stories',coalesce(jsonb_agg(jsonb_build_object(
      'id',id,'title',title,'studentId',student_id,'studentName',student_name,
      'cohort',student_cohort,'status',status,'mentorScore',mentor_score,
      'reviewSuitability',review_suitability,'rowVersion',row_version,'revised',revised,
      'updatedAt',updated_at,'submittedAt',coalesce(last_submitted_at,submitted_at)
    )),'[]'::jsonb),
    'studentGroups','[]'::jsonb,'groupedBy',NULL,
    'total',coalesce(max(total),0),
    'page',p_page,'pageSize',p_page_size
  ) INTO v_payload FROM matching;
  RETURN v_payload;
END
$$;


-- Operator-only, complete-snapshot replacement. The function validates every
-- subject against the existing WordPress-ID/StoryForge-ID mapping before it
-- changes the projection. When Arena authority is unavailable it preserves the
-- last-known-good avatar snapshot rather than treating a partial read as truth.
CREATE OR REPLACE FUNCTION public.sf_sync_admin_population_snapshot(
  p_population_key text,
  p_generation_id uuid,
  p_observed_at timestamptz,
  p_authority text,
  p_course_id bigint,
  p_entries jsonb,
  p_avatar_authority_available boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_member_count integer;
  v_avatar_count integer;
  v_previous_generation_id uuid;
  v_previous_observed_at timestamptz;
BEGIN
  IF p_population_key <> 'match_mentorship_360'
    OR p_generation_id IS NULL
    OR p_observed_at IS NULL
    OR p_observed_at < now() - interval '24 hours'
    OR p_observed_at > now() + interval '5 minutes'
    OR p_authority <> 'mmhq_cam_build_entitlement'
    OR p_course_id <> 3893
    OR p_avatar_authority_available IS NULL
    OR jsonb_typeof(p_entries) <> 'array'
    OR jsonb_array_length(p_entries) > 10000 THEN
    RAISE EXCEPTION 'invalid canonical population snapshot' USING ERRCODE = '22023';
  END IF;

  SELECT state.generation_id,state.observed_at
  INTO v_previous_generation_id,v_previous_observed_at
  FROM public.sf_entitlement_population_sync_state state
  WHERE state.population_key=p_population_key
  FOR UPDATE;
  IF FOUND AND (
    p_generation_id=v_previous_generation_id
    OR p_observed_at<=v_previous_observed_at
  ) THEN
    RAISE EXCEPTION 'stale or replayed canonical population snapshot'
      USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_entries) item
    WHERE jsonb_typeof(item) <> 'object'
      OR item - ARRAY[
        'storyforge_uuid','wp_user_id','arena_avatar_id','arena_avatar_thumbnail_url'
      ] <> '{}'::jsonb
      OR coalesce(item->>'storyforge_uuid','') !~
        '^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$'
      OR coalesce(item->>'wp_user_id','') !~ '^[1-9][0-9]*$'
      OR (
        nullif(item->>'arena_avatar_id','') IS NULL
      ) IS DISTINCT FROM (
        nullif(item->>'arena_avatar_thumbnail_url','') IS NULL
      )
      OR (
        nullif(item->>'arena_avatar_id','') IS NOT NULL
        AND (
          item->>'arena_avatar_id' !~
            '^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$'
          OR length(item->>'arena_avatar_thumbnail_url') > 2048
          OR item->>'arena_avatar_thumbnail_url' !~
            '^https://cdn\.missionmedinstitute\.com/[A-Za-z0-9._~!$&''()*+,;=:@%/-]+$'
        )
      )
  ) THEN
    RAISE EXCEPTION 'population snapshot contains an invalid identity or Arena avatar projection'
      USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    WITH parsed AS (
      SELECT (item->>'storyforge_uuid')::uuid AS student_id,
             (item->>'wp_user_id')::bigint AS wp_user_id
      FROM jsonb_array_elements(p_entries) item
    )
    SELECT 1 FROM parsed GROUP BY student_id HAVING count(*) > 1
  ) OR EXISTS (
    WITH parsed AS (
      SELECT (item->>'storyforge_uuid')::uuid AS student_id,
             (item->>'wp_user_id')::bigint AS wp_user_id
      FROM jsonb_array_elements(p_entries) item
    )
    SELECT 1 FROM parsed GROUP BY wp_user_id HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'population snapshot contains duplicate identities' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    WITH parsed AS (
      SELECT (item->>'storyforge_uuid')::uuid AS student_id,
             (item->>'wp_user_id')::bigint AS wp_user_id
      FROM jsonb_array_elements(p_entries) item
    )
    SELECT 1
    FROM parsed
    LEFT JOIN public.sf_users student
      ON student.id = parsed.student_id AND student.wp_user_id = parsed.wp_user_id
    WHERE student.id IS NULL OR student.role <> 'student' OR NOT student.eligible
  ) THEN
    RAISE EXCEPTION 'population snapshot does not match eligible StoryForge identities'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.sf_admin_population_settings(
    singleton,selected_population_keys,updated_by
  )
  SELECT true,ARRAY['match_mentorship_360']::text[],flag.updated_by
  FROM public.sf_feature_flags flag WHERE flag.key='admin_console'
  ON CONFLICT (singleton) DO NOTHING;
  IF NOT FOUND AND NOT EXISTS (
    SELECT 1 FROM public.sf_admin_population_settings WHERE singleton
  ) THEN
    RAISE EXCEPTION 'administrator population authority is unavailable'
      USING ERRCODE = 'P0002';
  END IF;

  DELETE FROM public.sf_entitlement_population_projection
  WHERE population_key = p_population_key;

  INSERT INTO public.sf_entitlement_population_projection (
    population_key, student_id, wp_user_id, generation_id,
    authority, course_id, observed_at, synced_at
  )
  SELECT p_population_key,
         (item->>'storyforge_uuid')::uuid,
         (item->>'wp_user_id')::bigint,
         p_generation_id, p_authority, p_course_id, p_observed_at, now()
  FROM jsonb_array_elements(p_entries) item;

  GET DIAGNOSTICS v_member_count = ROW_COUNT;

  IF p_avatar_authority_available THEN
    WITH parsed AS (
      SELECT (item->>'storyforge_uuid')::uuid AS student_id,
             nullif(item->>'arena_avatar_id','')::uuid AS avatar_id,
             nullif(item->>'arena_avatar_thumbnail_url','') AS thumbnail_url
      FROM jsonb_array_elements(p_entries) item
    )
    UPDATE public.sf_users student
    SET arena_avatar_id = parsed.avatar_id,
        arena_avatar_thumbnail_url = parsed.thumbnail_url,
        arena_avatar_synced_at = p_observed_at,
        updated_at = CASE
          WHEN student.arena_avatar_id IS DISTINCT FROM parsed.avatar_id
            OR student.arena_avatar_thumbnail_url IS DISTINCT FROM parsed.thumbnail_url
          THEN now() ELSE student.updated_at END
    FROM parsed
    WHERE student.id = parsed.student_id;
  END IF;

  SELECT count(*)::integer INTO v_avatar_count
  FROM public.sf_entitlement_population_projection projection
  JOIN public.sf_users student ON student.id = projection.student_id
  WHERE projection.population_key = p_population_key
    AND projection.generation_id = p_generation_id
    AND student.arena_avatar_id IS NOT NULL
    AND student.arena_avatar_thumbnail_url IS NOT NULL;

  INSERT INTO public.sf_entitlement_population_sync_state (
    population_key, generation_id, authority, course_id, observed_at,
    synced_at, member_count, avatar_authority_available
  ) VALUES (
    p_population_key, p_generation_id, p_authority, p_course_id, p_observed_at,
    now(), v_member_count, p_avatar_authority_available
  )
  ON CONFLICT (population_key) DO UPDATE SET
    generation_id = EXCLUDED.generation_id,
    authority = EXCLUDED.authority,
    course_id = EXCLUDED.course_id,
    observed_at = EXCLUDED.observed_at,
    synced_at = EXCLUDED.synced_at,
    member_count = EXCLUDED.member_count,
    avatar_authority_available = EXCLUDED.avatar_authority_available;

  RETURN jsonb_build_object(
    'populationKey', p_population_key,
    'generationId', p_generation_id,
    'memberCount', v_member_count,
    'avatarCount', v_avatar_count,
    'avatarAuthorityAvailable', p_avatar_authority_available,
    'observedAt', p_observed_at
  );
END
$$;

CREATE OR REPLACE FUNCTION public.sf_verify_admin_population_snapshot(
  p_population_key text,
  p_generation_id uuid,
  p_student_ids uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE v_count integer;
BEGIN
  IF p_population_key <> 'match_mentorship_360'
    OR p_generation_id IS NULL
    OR p_student_ids IS NULL
    OR cardinality(p_student_ids) <> cardinality(ARRAY(SELECT DISTINCT unnest(p_student_ids))) THEN
    RAISE EXCEPTION 'invalid population verification request' USING ERRCODE = '22023';
  END IF;
  SELECT count(*)::integer INTO v_count
  FROM public.sf_entitlement_population_projection projection
  WHERE projection.population_key = p_population_key
    AND projection.generation_id = p_generation_id
    AND projection.student_id = ANY(p_student_ids);
  IF v_count <> cardinality(p_student_ids)
    OR EXISTS (
      SELECT 1 FROM public.sf_entitlement_population_projection projection
      WHERE projection.population_key = p_population_key
        AND projection.generation_id = p_generation_id
        AND projection.student_id <> ALL(p_student_ids)
    )
    OR NOT EXISTS (
      SELECT 1 FROM public.sf_entitlement_population_sync_state state
      WHERE state.population_key = p_population_key
        AND state.generation_id = p_generation_id
        AND state.member_count = cardinality(p_student_ids)
    ) THEN
    RAISE EXCEPTION 'population snapshot verification failed' USING ERRCODE = 'P0002';
  END IF;
  RETURN jsonb_build_object(
    'populationKey', p_population_key,
    'generationId', p_generation_id,
    'verified', v_count
  );
END
$$;

CREATE OR REPLACE FUNCTION public.sf_admin_subject_in_scope(p_student_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT public.sf_admin_console_enabled()
    AND EXISTS (
      SELECT 1
      FROM public.sf_users student
      JOIN public.sf_entitlement_population_projection projection
        ON projection.student_id = student.id
      JOIN public.sf_entitlement_population_sync_state state
        ON state.population_key = projection.population_key
       AND state.generation_id = projection.generation_id
      CROSS JOIN public.sf_admin_population_settings settings
      JOIN public.sf_feature_flags directory_flag ON directory_flag.key = 'admin_directory'
      WHERE student.id = p_student_id
        AND student.role = 'student'
        AND student.eligible
        AND projection.population_key = ANY(settings.selected_population_keys)
        AND projection.authority = 'mmhq_cam_build_entitlement'
        AND projection.course_id = 3893
        AND state.observed_at >= now() - interval '24 hours'
        AND state.synced_at >= now() - interval '24 hours'
        AND (
          directory_flag.scope = 'eligible_all'
          OR (directory_flag.scope = 'allowlist' AND student.id = ANY(directory_flag.allowlist))
          OR (
            directory_flag.scope = 'cohort'
            AND student.cohort IS NOT NULL
            AND student.cohort = ANY(directory_flag.cohorts)
          )
        )
    )
$$;

CREATE OR REPLACE FUNCTION public.sf_admin_population_context()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_result jsonb;
  v_selected_keys text[] := ARRAY['match_mentorship_360']::text[];
  v_updated_at timestamptz;
BEGIN
  PERFORM public.sf_admin_assert_enabled();
  SELECT settings.selected_population_keys,settings.updated_at
  INTO v_selected_keys,v_updated_at
  FROM public.sf_admin_population_settings settings WHERE settings.singleton;
  SELECT jsonb_build_object(
    'selectedKeys', to_jsonb(v_selected_keys),
    'defaultKey', 'match_mentorship_360',
    'authority', 'mmhq_cam_build_entitlement',
    'observedAt', state.observed_at,
    'syncedAt', state.synced_at,
    'memberCount', coalesce(state.member_count, 0),
    'options', jsonb_build_array(
      jsonb_build_object(
        'key','match_mentorship_360','label','360 Match Mentorship',
        'available',true,'selected','match_mentorship_360'=ANY(v_selected_keys)
      ),
      jsonb_build_object(
        'key','personal_statement','label','Personal Statement students',
        'available',false,'selected',false,'reason','canonical_identifier_unverified'
      ),
      jsonb_build_object(
        'key','interview_prep_masterclass','label','Interview Prep Masterclass',
        'available',false,'selected',false,'reason','not_authorized_for_storyforge'
      ),
      jsonb_build_object(
        'key','interview_prep_essentials','label','Interview Prep Essentials',
        'available',false,'selected',false,'reason','canonical_identifier_unverified'
      ),
      jsonb_build_object(
        'key','registered_users','label','Registered users without qualifying enrollment',
        'available',false,'selected',false,'reason','not_entitled'
      )
    ),
    'updatedAt', v_updated_at
  ) INTO v_result
  FROM (SELECT 1) singleton
  LEFT JOIN public.sf_entitlement_population_sync_state state
    ON state.population_key = 'match_mentorship_360';
  RETURN v_result;
END
$$;

CREATE OR REPLACE FUNCTION public.sf_admin_set_population_scope(p_population_keys text[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_keys text[];
  v_before text[];
  v_audit_id bigint;
BEGIN
  PERFORM public.sf_admin_assert_enabled();
  IF p_population_keys IS NULL
    OR cardinality(p_population_keys) > 1
    OR EXISTS (
      SELECT 1 FROM unnest(p_population_keys) value
      WHERE value <> 'match_mentorship_360'
    ) THEN
    RAISE EXCEPTION 'administrator population scope may only narrow verified 360 entitlement'
      USING ERRCODE = '22023';
  END IF;
  v_keys := ARRAY(SELECT DISTINCT value FROM unnest(p_population_keys) value ORDER BY value);
  INSERT INTO public.sf_admin_population_settings(
    singleton,selected_population_keys,updated_by
  ) VALUES (
    true,ARRAY['match_mentorship_360']::text[],public.sf_actor_id()
  ) ON CONFLICT (singleton) DO NOTHING;
  SELECT selected_population_keys INTO STRICT v_before
  FROM public.sf_admin_population_settings WHERE singleton FOR UPDATE;
  UPDATE public.sf_admin_population_settings
  SET selected_population_keys = v_keys,
      updated_by = public.sf_actor_id(),
      updated_at = now()
  WHERE singleton;
  v_audit_id := public.sf_append_audit(
    'admin.population_scope_changed', 'admin_population', NULL, 'system',
    NULL, NULL, NULL,
    jsonb_build_object('selected_count', cardinality(v_before)),
    jsonb_build_object('selected_count', cardinality(v_keys)),
    NULL, 'admin_only'
  );
  RETURN public.sf_admin_population_context()
    || jsonb_build_object('auditId', v_audit_id::text);
END
$$;

CREATE OR REPLACE FUNCTION public.sf_admin_assert_story_population_scope(p_story_id uuid)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_student_id uuid;
  v_status text;
  v_visibility text;
BEGIN
  PERFORM public.sf_admin_assert_enabled();
  SELECT story.student_id,story.status,story.visibility
  INTO v_student_id,v_status,v_visibility
  FROM public.sf_stories story WHERE story.id = p_story_id;
  IF NOT FOUND
    OR NOT public.sf_admin_subject_in_scope(v_student_id)
    OR v_status = 'private'
    OR v_visibility = 'private' THEN
    RAISE EXCEPTION 'story not found' USING ERRCODE = 'P0002';
  END IF;
END
$$;

-- Ordinary Administrator reads and mutations additionally require the full
-- observable-story law. Collection changes deliberately use the narrower
-- assertion above so an in-scope, non-private story can be restored from
-- Archive or Trash without making it observable in any other Admin surface.
CREATE OR REPLACE FUNCTION public.sf_admin_assert_story_observable_scope(p_story_id uuid)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE v_student_id uuid;
BEGIN
  PERFORM public.sf_admin_assert_story_population_scope(p_story_id);
  SELECT story.student_id INTO v_student_id
  FROM public.sf_stories story WHERE story.id = p_story_id;
  IF NOT public.sf_admin_subject_story_observable(v_student_id,p_story_id) THEN
    RAISE EXCEPTION 'story not found' USING ERRCODE = 'P0002';
  END IF;
END
$$;

-- Make every subject-specific B1-514 Administrator capability consume the
-- same current-population predicate. Global flag reads remain unchanged.
CREATE OR REPLACE FUNCTION public.sf_b1_514_admin_feature_enabled(
  p_key text,
  p_student_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE v_enabled boolean;
BEGIN
  PERFORM public.sf_admin_assert_enabled();
  SELECT EXISTS (
    SELECT 1
    FROM public.sf_feature_flags flag
    LEFT JOIN public.sf_users student ON student.id = p_student_id
    WHERE flag.key = p_key
      AND (
        (p_student_id IS NULL AND flag.scope <> 'off')
        OR flag.scope = 'eligible_all'
        OR (flag.scope = 'allowlist' AND p_student_id = ANY(flag.allowlist))
        OR (
          flag.scope = 'cohort'
          AND student.cohort IS NOT NULL
          AND student.cohort = ANY(flag.cohorts)
        )
      )
      AND (p_student_id IS NULL OR public.sf_admin_subject_in_scope(p_student_id))
  ) INTO v_enabled;
  RETURN v_enabled;
END
$$;

-- The total story-observation predicate is the RLS source for stories and
-- their privacy-sensitive children. Its Administrator branch now requires the
-- same population predicate; Student and Mentor behavior is unchanged.
CREATE OR REPLACE FUNCTION public.sf_story_observable_to_actor(
  p_student_id uuid,
  p_status text,
  p_visibility text,
  p_archived_at timestamptz
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT public.sf_has_live_identity()
    AND (
      (p_student_id = public.sf_actor_id() AND public.sf_actor_role() = 'student')
      OR (
        p_archived_at IS NULL
        AND p_visibility IS DISTINCT FROM 'private'
        AND (
          (
            public.sf_actor_role() = 'mentor'
            AND public.sf_is_assigned(p_student_id)
          )
          OR (
            public.sf_admin_console_enabled()
            AND public.sf_admin_subject_in_scope(p_student_id)
          )
        )
        AND (
          p_status <> 'private'
          OR (
            p_visibility = 'mentor_visible'
            AND EXISTS (
              SELECT 1
              FROM public.sf_feature_flags flag
              JOIN public.sf_users student ON student.id = p_student_id
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
$$;

-- Close older SECURITY DEFINER media/note RPCs over the same centralized
-- population and visibility law. Student ownership is preserved; reviewers
-- never gain access to explicit-private stories, and Administrators additionally
-- require a current projected subject.
CREATE OR REPLACE FUNCTION public.sf_story_media_authorized(p_story_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.sf_stories story
    WHERE story.id=p_story_id AND story.archived_at IS NULL AND (
      (
        public.sf_has_live_identity(ARRAY['student'])
        AND story.student_id=public.sf_actor_id()
      )
      OR (
        story.status<>'private'
        AND story.visibility IS DISTINCT FROM 'private'
        AND public.sf_has_live_identity(ARRAY['mentor'])
        AND EXISTS (
          SELECT 1 FROM public.sf_mentor_assignments assignment
          WHERE assignment.student_id=story.student_id
            AND assignment.mentor_id=public.sf_actor_id()
            AND assignment.active
        )
      )
      OR (
        public.sf_has_live_identity(ARRAY['admin'])
        AND public.sf_admin_subject_story_observable(story.student_id,story.id)
      )
    )
  )
$$;

CREATE OR REPLACE FUNCTION public.sf_can_review_submitted_story(p_story_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT public.sf_mentor_notes_enabled()
    AND EXISTS (
      SELECT 1 FROM public.sf_stories story
      WHERE story.id=p_story_id
        AND story.archived_at IS NULL
        AND (
          (
            public.sf_actor_role()='mentor'
            AND story.status<>'private'
            AND story.visibility IS DISTINCT FROM 'private'
            AND public.sf_is_assigned(story.student_id)
          )
          OR (
            public.sf_actor_role()='admin'
            AND public.sf_admin_subject_story_observable(story.student_id,story.id)
          )
        )
    )
$$;

-- Preserve the sealed B1-515R function bodies behind uncallable baseline names,
-- then replace their public signatures with population-scoped wrappers. This
-- closes direct RPC bypasses without changing their validated mutation logic.
ALTER FUNCTION public.sf_admin_story_detail(uuid)
  RENAME TO sf_admin_story_detail_b1_515r_baseline;
ALTER FUNCTION public.sf_admin_home(integer)
  RENAME TO sf_admin_home_b1_515r_baseline;
ALTER FUNCTION public.sf_admin_student_detail(uuid,timestamptz,uuid,integer)
  RENAME TO sf_admin_student_detail_b1_515r_baseline;
ALTER FUNCTION public.sf_admin_activity_for_student(uuid)
  RENAME TO sf_admin_activity_for_student_b1_515r_baseline;
ALTER FUNCTION public.sf_record_review_check(uuid,boolean)
  RENAME TO sf_record_review_check_b1_515r_baseline;
ALTER FUNCTION public.sf_admin_review_story(uuid,bigint,jsonb,text)
  RENAME TO sf_admin_review_story_b1_515r_baseline;
ALTER FUNCTION public.sf_set_story_collection(uuid,bigint,text,text)
  RENAME TO sf_set_story_collection_b1_515r_baseline;
ALTER FUNCTION public.sf_admin_save_use_reviews(uuid,bigint,jsonb)
  RENAME TO sf_admin_save_use_reviews_b1_515r_baseline;
ALTER FUNCTION public.sf_admin_set_story_publication(uuid,bigint,text,boolean,boolean)
  RENAME TO sf_admin_set_story_publication_b1_515r_baseline;
ALTER FUNCTION public.sf_admin_set_review_status_v201(uuid,bigint,text)
  RENAME TO sf_admin_set_review_status_v201_b1_515r_baseline;
ALTER FUNCTION public.sf_update_story_taxonomy_configured(uuid,bigint,text[],text[],text,boolean)
  RENAME TO sf_update_story_taxonomy_configured_b1_515r_baseline;
ALTER FUNCTION public.sf_admin_update_story_taxonomy(uuid,bigint,text[],text[],text)
  RENAME TO sf_admin_update_story_taxonomy_b1_515r_baseline;
ALTER FUNCTION public.sf_list_mentor_notes(uuid)
  RENAME TO sf_list_mentor_notes_b1_515r_baseline;
ALTER FUNCTION public.sf_get_mentor_note_audio(uuid)
  RENAME TO sf_get_mentor_note_audio_b1_515r_baseline;

REVOKE ALL ON FUNCTION public.sf_admin_story_detail_b1_515r_baseline(uuid),
  public.sf_admin_home_b1_515r_baseline(integer),
  public.sf_admin_student_detail_b1_515r_baseline(uuid,timestamptz,uuid,integer),
  public.sf_admin_activity_for_student_b1_515r_baseline(uuid),
  public.sf_record_review_check_b1_515r_baseline(uuid,boolean),
  public.sf_admin_review_story_b1_515r_baseline(uuid,bigint,jsonb,text),
  public.sf_set_story_collection_b1_515r_baseline(uuid,bigint,text,text),
  public.sf_admin_save_use_reviews_b1_515r_baseline(uuid,bigint,jsonb),
  public.sf_admin_set_story_publication_b1_515r_baseline(uuid,bigint,text,boolean,boolean),
  public.sf_admin_set_review_status_v201_b1_515r_baseline(uuid,bigint,text),
  public.sf_update_story_taxonomy_configured_b1_515r_baseline(uuid,bigint,text[],text[],text,boolean),
  public.sf_admin_update_story_taxonomy_b1_515r_baseline(uuid,bigint,text[],text[],text),
  public.sf_list_mentor_notes_b1_515r_baseline(uuid),
  public.sf_get_mentor_note_audio_b1_515r_baseline(uuid)
  FROM PUBLIC, anon, authenticated, storyforge_app;

CREATE OR REPLACE FUNCTION public.sf_admin_story_detail(p_story_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  PERFORM public.sf_admin_assert_story_observable_scope(p_story_id);
  RETURN public.sf_admin_story_detail_b1_515r_baseline(p_story_id);
END
$$;

CREATE OR REPLACE FUNCTION public.sf_admin_home(p_limit integer DEFAULT 8)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  RETURN public.sf_admin_home_b1_515r_baseline(p_limit)
    || jsonb_build_object('population',public.sf_admin_population_context());
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
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE v_result jsonb;
BEGIN
  IF NOT public.sf_admin_subject_in_scope(p_student_id) THEN
    RAISE EXCEPTION 'student not found' USING ERRCODE = 'P0002';
  END IF;
  IF p_limit < 1 OR p_limit > 50 THEN
    RAISE EXCEPTION 'invalid administrator page limit' USING ERRCODE='22023';
  END IF;
  IF (p_after_updated_at IS NULL) <> (p_after_id IS NULL) THEN
    RAISE EXCEPTION 'administrator cursor is incomplete' USING ERRCODE='22023';
  END IF;
  SELECT jsonb_build_object(
    'student',jsonb_build_object(
      'id',student.id,'wpUserId',student.wp_user_id,'displayName',student.display_name,
      'firstName',student.first_name,'cohort',student.cohort,
      'academicYear',student.academic_year,'specialty',student.specialty,
      'applicationCycle',student.application_cycle
    ),
    'stories',coalesce((
      SELECT jsonb_agg(item ORDER BY item->>'updatedAt' DESC)
      FROM (
        SELECT jsonb_build_object(
          'id',story.id,'title',story.title,'status',story.status,
          'mentorScore',story.mentor_score,'reviewSuitability',story.review_suitability,
          'rowVersion',story.row_version,'revised',story.revised,
          'updatedAt',story.updated_at,'reviewedAt',story.reviewed_at
        ) AS item
        FROM public.sf_stories story
        WHERE story.student_id=p_student_id
          AND public.sf_admin_subject_story_observable(story.student_id,story.id)
          AND (
            p_after_updated_at IS NULL
            OR (story.updated_at,story.id)<(p_after_updated_at,p_after_id)
          )
        ORDER BY story.updated_at DESC,story.id DESC
        LIMIT p_limit
      ) story_rows
    ),'[]'::jsonb)
  ) INTO v_result
  FROM public.sf_users student WHERE student.id=p_student_id;
  PERFORM public.sf_append_audit(
    'admin.student_viewed','student',p_student_id,'system',p_student_id,
    NULL,NULL,NULL,jsonb_build_object('cursor_present',p_after_id IS NOT NULL),
    NULL,'admin_only'
  );
  RETURN v_result;
END
$$;

CREATE OR REPLACE FUNCTION public.sf_admin_directory_student(p_student_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE v_payload jsonb;
BEGIN
  IF NOT public.sf_admin_subject_in_scope(p_student_id) THEN
    RAISE EXCEPTION 'student not found' USING ERRCODE='P0002';
  END IF;
  SELECT jsonb_build_object(
    'student',jsonb_build_object(
      'id',student.id,'wpUserId',student.wp_user_id,'displayName',student.display_name,
      'firstName',student.first_name,'cohort',student.cohort,
      'academicYear',student.academic_year,'specialty',student.specialty,
      'applicationCycle',student.application_cycle
    ),
    'counts',jsonb_build_object(
      'total',(SELECT count(*) FROM public.sf_stories story
        WHERE story.student_id=student.id
          AND public.sf_admin_subject_story_observable(story.student_id,story.id)),
      'private',(SELECT count(*) FROM public.sf_stories story
        WHERE story.student_id=student.id AND story.archived_at IS NULL
          AND (story.status='private' OR story.visibility='private')),
      'mentorVisible',(SELECT count(*) FROM public.sf_stories story
        WHERE story.student_id=student.id AND story.visibility='mentor_visible'
          AND public.sf_admin_subject_story_observable(story.student_id,story.id)),
      'awaiting',(SELECT count(*) FROM public.sf_stories story
        WHERE story.student_id=student.id AND story.status='awaiting'
          AND public.sf_admin_subject_story_observable(story.student_id,story.id)),
      'approved',(SELECT count(*) FROM public.sf_stories story
        WHERE story.student_id=student.id AND story.status='approved'
          AND public.sf_admin_subject_story_observable(story.student_id,story.id))
    ),
    'stories',coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id',story.id,'title',story.title,'status',story.status,
        'visibility',story.visibility,'mentorScore',story.mentor_score,
        'reviewSuitability',story.review_suitability,'rowVersion',story.row_version,
        'updatedAt',story.updated_at
      ) ORDER BY story.updated_at DESC,story.id DESC)
      FROM public.sf_stories story
      WHERE story.student_id=student.id
        AND public.sf_admin_subject_story_observable(story.student_id,story.id)
    ),'[]'::jsonb),
    'activity',jsonb_build_object(
      'availableFrom',(SELECT activated_at FROM public.sf_activity_config WHERE key='activity_tracking'),
      'lastActivityAt',(SELECT max(last_beat_at) FROM public.sf_activity_sessions WHERE user_id=student.id)
    ),
    'reviewChecks',coalesce((SELECT jsonb_agg(jsonb_build_object(
      'id',checks.id,'body',checks.body,'sentAt',checks.sent_at,
      'notificationId',checks.notification_id,'auditEventId',checks.audit_event_id::text
    ) ORDER BY checks.sent_at DESC,checks.id DESC)
      FROM public.sf_review_checks checks WHERE checks.student_id=student.id),'[]'::jsonb)
  ) INTO v_payload FROM public.sf_users student WHERE student.id=p_student_id;
  RETURN v_payload;
END
$$;

CREATE OR REPLACE FUNCTION public.sf_admin_activity_for_student(p_student_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  IF NOT public.sf_admin_subject_in_scope(p_student_id) THEN
    RAISE EXCEPTION 'student not found' USING ERRCODE = 'P0002';
  END IF;
  RETURN public.sf_admin_activity_for_student_b1_515r_baseline(p_student_id);
END
$$;

CREATE OR REPLACE FUNCTION public.sf_record_review_check(p_student_id uuid,p_preview boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_name text;
  v_body text;
  v_notification public.sf_notifications;
  v_audit bigint;
  v_check public.sf_review_checks;
  v_stamp text;
BEGIN
  IF NOT public.sf_admin_subject_in_scope(p_student_id) THEN
    RAISE EXCEPTION 'student not found' USING ERRCODE = 'P0002';
  END IF;
  SELECT display_name INTO v_name FROM public.sf_users WHERE id=p_student_id;
  v_stamp:=to_char(now(),'Mon FMDD, YYYY at FMHH12:MI AM TZ');
  IF NOT EXISTS(
    SELECT 1 FROM public.sf_stories story
    WHERE story.student_id=p_student_id
      AND public.sf_admin_subject_story_observable(story.student_id,story.id)
  ) THEN
    v_body:='Dr Brian checked StoryForge for work to review on '||v_stamp
      ||', but no stories had been submitted. When you''re ready, submit a story so your mentor can review it.';
  ELSIF EXISTS(
    SELECT 1 FROM public.sf_stories story
    WHERE story.student_id=p_student_id AND story.status IN('reviewed','approved')
      AND public.sf_admin_subject_story_observable(story.student_id,story.id)
  ) THEN
    v_body:='Dr Brian checked StoryForge on '||v_stamp
      ||' and reviewed your submitted work. Open your stories to see the latest feedback.';
  ELSE
    v_body:='Dr Brian checked StoryForge on '||v_stamp
      ||'. Your submitted work is in the review queue — feedback will land in your notifications.';
  END IF;
  IF p_preview THEN
    RETURN jsonb_build_object(
      'preview',true,'studentId',p_student_id,'studentName',v_name,
      'body',v_body,'sent',false
    );
  END IF;
  IF EXISTS(
    SELECT 1 FROM public.sf_review_checks
    WHERE student_id=p_student_id AND sent_at>now()-interval '24 hours'
  ) THEN
    RAISE EXCEPTION 'A Review Check was already sent to this student in the last 24 hours.'
      USING ERRCODE='P0003';
  END IF;
  SELECT * INTO v_notification FROM public.sf_emit_notification(
    p_student_id,public.sf_actor_id(),NULL,NULL,'review_check','system',
    'StoryForge Review Check',v_body,'/notifications'
  );
  v_audit:=public.sf_append_audit(
    'admin.review_check_sent','student',p_student_id,'system',p_student_id,
    NULL,NULL,NULL,jsonb_build_object('notificationId',v_notification.id),
    NULL,'admin_only'
  );
  INSERT INTO public.sf_review_checks(
    student_id,sent_by,body,notification_id,audit_event_id
  ) VALUES (
    p_student_id,public.sf_actor_id(),v_body,v_notification.id,v_audit
  ) RETURNING * INTO v_check;
  RETURN jsonb_build_object(
    'id',v_check.id,'studentId',v_check.student_id,'sentAt',v_check.sent_at,
    'sentBy',v_check.sent_by,'body',v_check.body,'status','recorded',
    'notificationId',v_check.notification_id,'auditEventId',v_check.audit_event_id::text
  );
END
$$;

CREATE OR REPLACE FUNCTION public.sf_admin_review_story(
  p_story_id uuid,p_expected_version bigint,p_patch jsonb,p_surface text DEFAULT 'workspace'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  PERFORM public.sf_admin_assert_story_observable_scope(p_story_id);
  RETURN public.sf_admin_review_story_b1_515r_baseline(
    p_story_id,p_expected_version,p_patch,p_surface
  );
END
$$;

CREATE OR REPLACE FUNCTION public.sf_set_story_collection(
  p_story_id uuid,p_expected_version bigint,p_collection text,p_surface text DEFAULT 'library'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  IF public.sf_actor_role() = 'admin' THEN
    PERFORM public.sf_admin_assert_story_population_scope(p_story_id);
  END IF;
  RETURN public.sf_set_story_collection_b1_515r_baseline(
    p_story_id,p_expected_version,p_collection,p_surface
  );
END
$$;

CREATE OR REPLACE FUNCTION public.sf_admin_save_use_reviews(
  p_story_id uuid,p_expected_version bigint,p_reviews jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  PERFORM public.sf_admin_assert_story_observable_scope(p_story_id);
  RETURN public.sf_admin_save_use_reviews_b1_515r_baseline(
    p_story_id,p_expected_version,p_reviews
  );
END
$$;

CREATE OR REPLACE FUNCTION public.sf_admin_set_story_publication(
  p_story_id uuid,p_expected_version bigint,p_destination text,
  p_active boolean,p_confirm_replace boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  PERFORM public.sf_admin_assert_story_observable_scope(p_story_id);
  RETURN public.sf_admin_set_story_publication_b1_515r_baseline(
    p_story_id,p_expected_version,p_destination,p_active,p_confirm_replace
  );
END
$$;

CREATE OR REPLACE FUNCTION public.sf_admin_set_review_status_v201(
  p_story_id uuid,p_expected_version bigint,p_status text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  PERFORM public.sf_admin_assert_story_observable_scope(p_story_id);
  RETURN public.sf_admin_set_review_status_v201_b1_515r_baseline(
    p_story_id,p_expected_version,p_status
  );
END
$$;

CREATE OR REPLACE FUNCTION public.sf_update_story_taxonomy_configured(
  p_story_id uuid,p_expected_version bigint,p_categories text[],p_uses text[],
  p_surface text DEFAULT 'workspace',p_admin boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  IF p_admin THEN
    PERFORM public.sf_admin_assert_story_observable_scope(p_story_id);
  END IF;
  RETURN public.sf_update_story_taxonomy_configured_b1_515r_baseline(
    p_story_id,p_expected_version,p_categories,p_uses,p_surface,p_admin
  );
END
$$;

CREATE OR REPLACE FUNCTION public.sf_admin_update_story_taxonomy(
  p_story_id uuid,p_expected_version bigint,p_categories text[],p_uses text[],
  p_surface text DEFAULT 'workspace'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  PERFORM public.sf_admin_assert_story_observable_scope(p_story_id);
  RETURN public.sf_admin_update_story_taxonomy_b1_515r_baseline(
    p_story_id,p_expected_version,p_categories,p_uses,p_surface
  );
END
$$;

CREATE OR REPLACE FUNCTION public.sf_list_mentor_notes(p_story_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  IF public.sf_actor_role() IN ('mentor','admin')
    AND NOT public.sf_can_review_submitted_story(p_story_id) THEN
    RAISE EXCEPTION 'submitted story not found' USING ERRCODE = 'P0002';
  END IF;
  RETURN public.sf_list_mentor_notes_b1_515r_baseline(p_story_id);
END
$$;

CREATE OR REPLACE FUNCTION public.sf_get_mentor_note_audio(p_note_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE v_story_id uuid;
BEGIN
  IF public.sf_actor_role() IN ('mentor','admin') THEN
    SELECT note.story_id INTO v_story_id
    FROM public.sf_mentor_notes note WHERE note.id=p_note_id;
    IF NOT FOUND OR NOT public.sf_can_review_submitted_story(v_story_id) THEN
      RAISE EXCEPTION 'mentor note audio not found' USING ERRCODE = 'P0002';
    END IF;
  END IF;
  RETURN public.sf_get_mentor_note_audio_b1_515r_baseline(p_note_id);
END
$$;

-- Direct authenticated reads are also population-bounded. Security-definer
-- RPCs above remain the preferred surface; these policies are defense in depth.
DROP POLICY IF EXISTS sf_users_read ON public.sf_users;
CREATE POLICY sf_users_read ON public.sf_users
FOR SELECT TO authenticated
USING (
  public.sf_has_live_identity()
  AND (
    id=public.sf_actor_id()
    OR (
      public.sf_actor_role()='student' AND role='mentor'
      AND EXISTS (
        SELECT 1 FROM public.sf_mentor_assignments assignment
        WHERE assignment.student_id=public.sf_actor_id()
          AND assignment.mentor_id=sf_users.id AND assignment.active
      )
    )
    OR (
      public.sf_actor_role()='mentor' AND role='mentor'
      AND public.sf_are_coassigned(public.sf_actor_id(),sf_users.id)
    )
    OR (
      public.sf_actor_role()='mentor' AND role='student'
      AND public.sf_is_assigned(sf_users.id)
    )
    OR (
      public.sf_actor_role()='admin' AND role='student'
      AND public.sf_admin_subject_in_scope(sf_users.id)
    )
  )
);

DROP POLICY IF EXISTS sf_assignments_read ON public.sf_mentor_assignments;
CREATE POLICY sf_assignments_read ON public.sf_mentor_assignments
FOR SELECT TO authenticated
USING (
  public.sf_has_live_identity()
  AND (
    student_id=public.sf_actor_id() OR mentor_id=public.sf_actor_id()
    OR (
      public.sf_actor_role()='admin'
      AND public.sf_admin_subject_in_scope(student_id)
    )
  )
);

DROP POLICY IF EXISTS sf_story_internal_notes_admin_read ON public.sf_story_internal_notes;
CREATE POLICY sf_story_internal_notes_admin_read ON public.sf_story_internal_notes
FOR SELECT TO authenticated
USING (
  public.sf_admin_console_enabled()
  AND EXISTS (
    SELECT 1 FROM public.sf_stories story
    WHERE story.id=sf_story_internal_notes.story_id
      AND public.sf_admin_subject_in_scope(story.student_id)
      AND story.archived_at IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.sf_story_trash trash WHERE trash.story_id=story.id
      )
      AND public.sf_story_observable_to_actor(
        story.student_id,story.status,story.visibility,story.archived_at
      )
  )
);

DROP POLICY IF EXISTS sf_story_trash_admin_read ON public.sf_story_trash;
CREATE POLICY sf_story_trash_admin_read ON public.sf_story_trash
FOR SELECT TO authenticated
USING (
  public.sf_admin_console_enabled()
  AND public.sf_admin_subject_in_scope(student_id)
  AND EXISTS (
    SELECT 1 FROM public.sf_stories story
    WHERE story.id=sf_story_trash.story_id
      AND story.status<>'private'
      AND story.visibility IS DISTINCT FROM 'private'
  )
);

DROP POLICY IF EXISTS sf_mentor_notes_read ON public.sf_mentor_notes;
CREATE POLICY sf_mentor_notes_read ON public.sf_mentor_notes
FOR SELECT TO authenticated
USING (
  public.sf_mentor_notes_enabled()
  AND EXISTS (
    SELECT 1 FROM public.sf_stories story
    WHERE story.id=sf_mentor_notes.story_id
      AND story.student_id=sf_mentor_notes.student_id
      AND story.status<>'private' AND story.archived_at IS NULL
      AND (
        (
          public.sf_actor_role()='student' AND story.student_id=public.sf_actor_id()
          AND sf_mentor_notes.state='published' AND NOT sf_mentor_notes.internal_only
        )
        OR (
          public.sf_actor_role()='mentor' AND sf_mentor_notes.author_id=public.sf_actor_id()
          AND public.sf_is_assigned(story.student_id)
        )
        OR (
          public.sf_actor_role()='admin'
          AND public.sf_admin_subject_in_scope(story.student_id)
          AND story.visibility IS DISTINCT FROM 'private'
        )
      )
  )
);

DROP POLICY IF EXISTS sf_mentor_note_media_read ON public.sf_mentor_note_media;
CREATE POLICY sf_mentor_note_media_read ON public.sf_mentor_note_media
FOR SELECT TO authenticated
USING (
  public.sf_mentor_notes_enabled()
  AND EXISTS (
    SELECT 1
    FROM public.sf_mentor_notes note
    JOIN public.sf_stories story ON story.id=note.story_id
    WHERE note.id=sf_mentor_note_media.note_id
      AND note.author_id=sf_mentor_note_media.author_id
      AND story.student_id=sf_mentor_note_media.student_id
      AND story.status<>'private' AND story.archived_at IS NULL
      AND sf_mentor_note_media.state='verified'
      AND (
        (
          public.sf_actor_role()='student' AND story.student_id=public.sf_actor_id()
          AND note.state='published' AND NOT note.internal_only
        )
        OR (
          public.sf_actor_role()='mentor' AND note.author_id=public.sf_actor_id()
          AND public.sf_is_assigned(story.student_id)
        )
        OR (
          public.sf_actor_role()='admin'
          AND public.sf_admin_subject_in_scope(story.student_id)
          AND story.visibility IS DISTINCT FROM 'private'
        )
      )
  )
);

DROP POLICY IF EXISTS sf_audit_read ON public.sf_audit_events;
CREATE POLICY sf_audit_read ON public.sf_audit_events
FOR SELECT TO authenticated
USING (
  public.sf_has_live_identity()
  AND (
    (
      public.sf_actor_role()='student' AND visibility='both'
      AND (
        student_id=public.sf_actor_id()
        OR (
          student_id IS NULL AND story_id IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM public.sf_stories story
            WHERE story.id=sf_audit_events.story_id
              AND story.student_id=public.sf_actor_id()
          )
        )
        OR (student_id IS NULL AND story_id IS NULL AND actor_id=public.sf_actor_id())
      )
    )
    OR (
      public.sf_actor_role()='mentor' AND visibility IN ('both','mentor_only')
      AND (
        (student_id IS NOT NULL AND public.sf_is_assigned(student_id))
        OR (
          student_id IS NULL AND story_id IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM public.sf_stories story
            WHERE story.id=sf_audit_events.story_id
              AND public.sf_is_assigned(story.student_id)
          )
        )
        OR (student_id IS NULL AND story_id IS NULL AND actor_id=public.sf_actor_id())
      )
    )
    OR (
      public.sf_actor_role()='admin'
      AND (
        (
          visibility='admin_only'
          AND public.sf_admin_console_enabled()
          AND (
            (student_id IS NULL AND story_id IS NULL)
            OR (
              story_id IS NULL AND student_id IS NOT NULL
              AND public.sf_admin_subject_in_scope(student_id)
            )
            OR (
              story_id IS NOT NULL
              AND EXISTS (
                SELECT 1 FROM public.sf_stories story
                WHERE story.id=sf_audit_events.story_id
                  AND public.sf_admin_subject_in_scope(story.student_id)
                  AND story.status<>'private'
                  AND story.visibility IS DISTINCT FROM 'private'
              )
            )
          )
        )
        OR (student_id IS NULL AND story_id IS NULL AND actor_id=public.sf_actor_id())
      )
    )
  )
);

REVOKE ALL ON FUNCTION public.sf_opening_sound_preference(),
  public.sf_set_opening_sound_preference(boolean),
  public.sf_sync_admin_population_snapshot(text,uuid,timestamptz,text,bigint,jsonb,boolean),
  public.sf_verify_admin_population_snapshot(text,uuid,uuid[]),
  public.sf_admin_subject_in_scope(uuid),public.sf_admin_population_context(),
  public.sf_admin_set_population_scope(text[]),public.sf_admin_assert_story_population_scope(uuid),
  public.sf_admin_assert_story_observable_scope(uuid),
  public.sf_admin_story_detail(uuid),public.sf_admin_home(integer),
  public.sf_admin_student_detail(uuid,timestamptz,uuid,integer),
  public.sf_admin_activity_for_student(uuid),
  public.sf_record_review_check(uuid,boolean),
  public.sf_admin_review_story(uuid,bigint,jsonb,text),
  public.sf_set_story_collection(uuid,bigint,text,text),
  public.sf_admin_save_use_reviews(uuid,bigint,jsonb),
  public.sf_admin_set_story_publication(uuid,bigint,text,boolean,boolean),
  public.sf_admin_set_review_status_v201(uuid,bigint,text),
  public.sf_update_story_taxonomy_configured(uuid,bigint,text[],text[],text,boolean),
  public.sf_admin_update_story_taxonomy(uuid,bigint,text[],text[],text),
  public.sf_list_mentor_notes(uuid),public.sf_get_mentor_note_audio(uuid)
  FROM PUBLIC, anon, authenticated, storyforge_app;

GRANT EXECUTE ON FUNCTION public.sf_opening_sound_preference(),
  public.sf_set_opening_sound_preference(boolean),
  public.sf_admin_subject_in_scope(uuid),public.sf_admin_population_context(),
  public.sf_admin_set_population_scope(text[]),public.sf_admin_story_detail(uuid),
  public.sf_admin_home(integer),
  public.sf_admin_student_detail(uuid,timestamptz,uuid,integer),
  public.sf_admin_activity_for_student(uuid),
  public.sf_record_review_check(uuid,boolean),
  public.sf_admin_review_story(uuid,bigint,jsonb,text),
  public.sf_set_story_collection(uuid,bigint,text,text),
  public.sf_admin_save_use_reviews(uuid,bigint,jsonb),
  public.sf_admin_set_story_publication(uuid,bigint,text,boolean,boolean),
  public.sf_admin_set_review_status_v201(uuid,bigint,text),
  public.sf_update_story_taxonomy_configured(uuid,bigint,text[],text[],text,boolean),
  public.sf_admin_update_story_taxonomy(uuid,bigint,text[],text[],text),
  public.sf_list_mentor_notes(uuid),public.sf_get_mentor_note_audio(uuid)
  TO authenticated;

GRANT EXECUTE ON FUNCTION public.sf_sync_admin_population_snapshot(
  text,uuid,timestamptz,text,bigint,jsonb,boolean
), public.sf_verify_admin_population_snapshot(text,uuid,uuid[])
  TO storyforge_app;

COMMIT;
