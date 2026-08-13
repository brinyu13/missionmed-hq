-- B1-515R: bounded administrator action center and owner-only contribution review.
-- Additive and data preserving. No existing contribution text or story content is rewritten.

BEGIN;

SELECT pg_advisory_xact_lock(hashtextextended('b1-515r-action-center-contribution-review', 0));

ALTER TABLE public.sf_story_contributions
  ADD COLUMN student_score smallint NULL CHECK (student_score BETWEEN 1 AND 5),
  ADD COLUMN student_review_note text NULL CHECK (
    student_review_note IS NULL
    OR length(btrim(student_review_note)) BETWEEN 1 AND 2000
  ),
  ADD COLUMN reviewed_at timestamptz NULL,
  ADD COLUMN row_version bigint NOT NULL DEFAULT 0 CHECK (row_version >= 0);

CREATE OR REPLACE FUNCTION public.sf_request_review_contribution(
  p_id uuid,
  p_expected_version bigint,
  p_score smallint,
  p_note text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid := public.sf_request_assert_student();
  v_before public.sf_story_contributions;
  v_after public.sf_story_contributions;
  v_note text;
BEGIN
  IF p_expected_version IS NULL OR p_expected_version < 0
     OR p_score IS NULL OR p_score NOT BETWEEN 1 AND 5
     OR length(btrim(coalesce(p_note, ''))) > 2000 THEN
    RAISE EXCEPTION 'invalid contribution review' USING ERRCODE = '22023';
  END IF;
  v_note := CASE WHEN btrim(coalesce(p_note, '')) = '' THEN NULL ELSE p_note END;

  SELECT contribution.* INTO v_before
  FROM public.sf_story_contributions contribution
  JOIN public.sf_story_invitations invitation ON invitation.id = contribution.invitation_id
  WHERE contribution.id = p_id
    AND invitation.student_id = v_actor
    AND contribution.state IN ('new', 'favorite')
  FOR UPDATE OF contribution;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'contribution not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_before.row_version <> p_expected_version THEN
    RAISE EXCEPTION 'contribution changed in another session' USING ERRCODE = '40001';
  END IF;

  UPDATE public.sf_story_contributions
  SET student_score = p_score,
      student_review_note = v_note,
      reviewed_at = now(),
      updated_at = now(),
      row_version = row_version + 1
  WHERE id = v_before.id
  RETURNING * INTO v_after;

  PERFORM public.sf_append_audit(
    'request.contribution_reviewed', 'story_contribution', v_after.id, 'system',
    v_actor, NULL, NULL,
    jsonb_build_object(
      'score', v_before.student_score,
      'notePresent', v_before.student_review_note IS NOT NULL,
      'noteLength', char_length(coalesce(v_before.student_review_note, '')),
      'rowVersion', v_before.row_version
    ),
    jsonb_build_object(
      'score', v_after.student_score,
      'notePresent', v_after.student_review_note IS NOT NULL,
      'noteLength', char_length(coalesce(v_after.student_review_note, '')),
      'rowVersion', v_after.row_version
    ),
    NULL, 'both'
  );

  RETURN jsonb_build_object(
    'id', v_after.id,
    'state', v_after.state,
    'studentScore', v_after.student_score,
    'studentReviewNote', v_after.student_review_note,
    'rowVersion', v_after.row_version,
    'reviewedAt', v_after.reviewed_at
  );
END
$$;

CREATE OR REPLACE FUNCTION public.sf_request_promote(p_id uuid, p_title text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid := public.sf_request_assert_student();
  v_contribution record;
  v_story record;
BEGIN
  SELECT contribution.*, invitation.contributor_first_name, invitation.relationship_id
  INTO v_contribution
  FROM public.sf_story_contributions contribution
  JOIN public.sf_story_invitations invitation ON invitation.id = contribution.invitation_id
  WHERE contribution.id = p_id AND invitation.student_id = v_actor
  FOR UPDATE OF contribution;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'contribution not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_contribution.state = 'promoted' THEN
    RETURN jsonb_build_object('storyId', v_contribution.promoted_story_id, 'existing', true);
  END IF;

  SELECT * INTO v_story
  FROM public.sf_create_story_v5(
    jsonb_build_object(
      'title', p_title,
      'text', v_contribution.transcript,
      'captureType', 'imported',
      'prefixEnabled', false,
      'studentScore', v_contribution.student_score
    ),
    'library'
  );
  UPDATE public.sf_stories
  SET visibility = 'private',
      visibility_changed_at = NULL,
      origin = jsonb_build_object(
        'type', 'contribution',
        'contributionId', v_contribution.id::text,
        'relationship', v_contribution.relationship_id,
        'contributorFirstName', v_contribution.contributor_first_name
      ),
      updated_at = now()
  WHERE id = v_story.id;
  UPDATE public.sf_story_contributions
  SET state = 'promoted',
      promoted_story_id = v_story.id,
      promoted_at = now(),
      updated_at = now(),
      row_version = row_version + 1
  WHERE id = v_contribution.id;
  INSERT INTO public.sf_authored_segments(
    story_id, source_role, source_entity_type, source_entity_id, body_hash, author_id
  ) VALUES (
    v_story.id, 'guest_contributor', 'contribution', v_contribution.id,
    encode(digest(convert_to(v_contribution.transcript, 'UTF8'), 'sha256'), 'hex'), v_actor
  );
  RETURN jsonb_build_object('storyId', v_story.id, 'existing', false, 'visibility', 'private');
END
$$;

CREATE OR REPLACE FUNCTION public.sf_admin_home(p_limit integer DEFAULT 8)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid := public.sf_actor_id();
  v_result jsonb;
  v_count integer;
  v_last_admin_visit_at timestamptz;
  v_activity_from timestamptz;
BEGIN
  PERFORM public.sf_admin_assert_enabled();
  IF p_limit < 1 OR p_limit > 25 THEN
    RAISE EXCEPTION 'invalid administrator page limit' USING ERRCODE = '22023';
  END IF;
  SELECT max(event.created_at) INTO v_last_admin_visit_at
  FROM public.sf_audit_events event
  WHERE event.actor_id = v_actor AND event.action = 'admin.home_viewed';
  SELECT activated_at INTO v_activity_from
  FROM public.sf_activity_config WHERE key = 'activity_tracking';

  WITH observable AS (
    SELECT story.*, student.display_name AS student_name,
      coalesce(story.last_submitted_at, story.submitted_at, story.updated_at) AS submitted_order
    FROM public.sf_stories story
    JOIN public.sf_users student ON student.id = story.student_id
    WHERE public.sf_admin_subject_story_observable(story.student_id, story.id)
  ),
  story_items AS (
    SELECT observable.*,
      jsonb_build_object(
        'id', id, 'title', title, 'studentId', student_id, 'studentName', student_name,
        'status', status, 'rowVersion', row_version, 'updatedAt', updated_at,
        'submittedAt', submitted_order,
        'action', CASE WHEN status = 'awaiting' THEN 'review'
                       WHEN status = 'in_review' THEN 'continue_review'
                       ELSE 'open_story' END
      ) AS item
    FROM observable
  ),
  next_candidates AS (
    SELECT *, 1 AS priority, submitted_order AS order_at, 'review'::text AS next_action
    FROM story_items WHERE status = 'awaiting'
    UNION ALL
    SELECT *, 2, submitted_order, 'continue_review' FROM story_items WHERE status = 'in_review'
    UNION ALL
    SELECT *, 3, updated_at, 'score' FROM story_items WHERE mentor_score IS NULL
  ),
  next_ranked AS (
    SELECT *, row_number() OVER (PARTITION BY id ORDER BY priority, order_at, id) AS duplicate_rank
    FROM next_candidates
  ),
  student_activity AS (
    SELECT student.id AS student_id, student.display_name AS student_name,
      count(observable.id)::integer AS observable_story_count,
      max(observable.updated_at) AS last_story_at,
      (SELECT max(session.last_beat_at) FROM public.sf_activity_sessions session WHERE session.user_id = student.id) AS last_activity_at,
      (SELECT max(checks.sent_at) FROM public.sf_review_checks checks WHERE checks.student_id = student.id) AS last_review_check_at
    FROM public.sf_users student
    LEFT JOIN observable ON observable.student_id = student.id
    WHERE student.role = 'student' AND student.eligible
      AND public.sf_b1_514_admin_feature_enabled('admin_directory', student.id)
    GROUP BY student.id
  ),
  nudge_candidates AS (
    SELECT *, jsonb_build_object(
      'studentId', student_id, 'studentName', student_name,
      'observableStoryCount', observable_story_count,
      'lastActivityAt', last_activity_at, 'lastStoryAt', last_story_at,
      'lastReviewCheckAt', last_review_check_at, 'action', 'open_student'
    ) AS item
    FROM student_activity
    WHERE v_activity_from IS NOT NULL
      AND coalesce(last_activity_at, last_story_at) IS NOT NULL
      AND coalesce(last_activity_at, last_story_at) < now() - interval '7 days'
  )
  SELECT jsonb_build_object(
    'metrics', jsonb_build_object(
      'submittedStories', (SELECT count(*) FROM observable),
      'awaitingReview', (SELECT count(*) FROM observable WHERE status = 'awaiting'),
      'inReview', (SELECT count(*) FROM observable WHERE status = 'in_review'),
      'changesRequested', (SELECT count(*) FROM observable WHERE status = 'changes'),
      'reviewed', (SELECT count(*) FROM observable WHERE status = 'reviewed'),
      'approved', (SELECT count(*) FROM observable WHERE status = 'approved'),
      'unscored', (SELECT count(*) FROM observable WHERE mentor_score IS NULL)
    ),
    'recent', coalesce((SELECT jsonb_agg(recent.item ORDER BY recent.updated_at DESC, recent.id DESC)
      FROM (
        SELECT jsonb_build_object(
          'id', id, 'title', title, 'studentId', student_id, 'studentName', student_name,
          'status', status, 'mentorScore', mentor_score, 'reviewSuitability', review_suitability,
          'rowVersion', row_version, 'updatedAt', updated_at
        ) AS item, updated_at, id
        FROM story_items ORDER BY updated_at DESC, id DESC LIMIT p_limit
      ) recent), '[]'::jsonb),
    'actionCenter', jsonb_build_object(
      'whoNeedsMe', jsonb_build_object(
        'needsReview', jsonb_build_object(
          'count', (SELECT count(*) FROM story_items WHERE status IN ('awaiting','in_review')),
          'items', coalesce((SELECT jsonb_agg(review.item ORDER BY review.submitted_order, review.id)
            FROM (SELECT item, submitted_order, id FROM story_items WHERE status IN ('awaiting','in_review') ORDER BY submitted_order, id LIMIT p_limit) review), '[]'::jsonb)
        ),
        'needsNudge', jsonb_build_object(
          'count', (SELECT count(*) FROM nudge_candidates),
          'items', coalesce((SELECT jsonb_agg(nudge.item ORDER BY coalesce(nudge.last_activity_at,nudge.last_story_at), nudge.student_id)
            FROM (SELECT * FROM nudge_candidates ORDER BY coalesce(last_activity_at,last_story_at), student_id LIMIT p_limit) nudge), '[]'::jsonb)
        )
      ),
      'next', coalesce((SELECT jsonb_agg((ranked.item - 'action') || jsonb_build_object('action', ranked.next_action) ORDER BY ranked.priority, ranked.order_at, ranked.id)
        FROM (SELECT * FROM next_ranked WHERE duplicate_rank = 1 ORDER BY priority, order_at, id LIMIT p_limit) ranked), '[]'::jsonb),
      'changed', jsonb_build_object(
        'changesReturned', jsonb_build_object(
          'count', (SELECT count(*) FROM story_items WHERE status = 'changes'),
          'items', coalesce((SELECT jsonb_agg(changed.item ORDER BY changed.updated_at DESC, changed.id DESC)
            FROM (SELECT item, updated_at, id FROM story_items WHERE status = 'changes' ORDER BY updated_at DESC, id DESC LIMIT p_limit) changed), '[]'::jsonb)
        ),
        'newSinceLastVisit', jsonb_build_object(
          'since', v_last_admin_visit_at,
          'firstVisit', v_last_admin_visit_at IS NULL,
          'count', CASE WHEN v_last_admin_visit_at IS NULL THEN 0 ELSE (SELECT count(*) FROM story_items WHERE updated_at > v_last_admin_visit_at) END,
          'items', CASE WHEN v_last_admin_visit_at IS NULL THEN '[]'::jsonb ELSE coalesce((SELECT jsonb_agg(fresh.item ORDER BY fresh.updated_at DESC, fresh.id DESC)
            FROM (SELECT item, updated_at, id FROM story_items WHERE updated_at > v_last_admin_visit_at ORDER BY updated_at DESC, id DESC LIMIT p_limit) fresh), '[]'::jsonb) END
        )
      ),
      'boundaries', jsonb_build_object(
        'activityFrom', v_activity_from,
        'lastAdminVisitAt', v_last_admin_visit_at,
        'boundaryLimited', v_activity_from IS NULL
      )
    )
  ) INTO v_result;

  v_count := coalesce((v_result #>> '{metrics,submittedStories}')::integer, 0);
  PERFORM public.sf_append_audit(
    'admin.home_viewed', 'admin_console', NULL, 'system', NULL, NULL, NULL,
    NULL, jsonb_build_object('result_count', v_count), NULL, 'admin_only'
  );
  RETURN v_result;
END
$$;

CREATE OR REPLACE FUNCTION public.sf_admin_review_queue_scaled(
  p_query text, p_status text, p_session text, p_sort text, p_page integer, p_page_size integer
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_payload jsonb;
BEGIN
  PERFORM public.sf_admin_assert_enabled();
  IF p_sort NOT IN ('oldest','newest','updated','student') OR p_page < 1 OR p_page_size < 1 OR p_page_size > 50
     OR length(p_query) > 120 OR length(p_session) > 80 THEN
    RAISE EXCEPTION 'invalid scaled queue query' USING ERRCODE = '22023';
  END IF;
  WITH matching AS (
    SELECT story.*, student.display_name AS student_name, student.cohort AS student_cohort,
      count(*) OVER()::integer AS total
    FROM public.sf_stories story
    JOIN public.sf_users student ON student.id = story.student_id
    WHERE public.sf_admin_subject_story_observable(story.student_id, story.id)
      AND (coalesce(p_query, '') = '' OR story.title ILIKE '%'||p_query||'%' OR student.display_name ILIKE '%'||p_query||'%')
      AND (p_status IS NULL OR p_status = '' OR story.status = p_status OR (p_status = 'unscored' AND story.mentor_score IS NULL))
      AND (coalesce(p_session, '') = '' OR coalesce(student.cohort, '') = p_session)
    ORDER BY CASE WHEN p_sort='oldest' THEN coalesce(story.last_submitted_at,story.updated_at) END ASC,
      CASE WHEN p_sort='newest' THEN coalesce(story.last_submitted_at,story.updated_at) END DESC,
      CASE WHEN p_sort='updated' THEN story.updated_at END DESC,
      CASE WHEN p_sort='student' THEN lower(student.display_name) END ASC, story.id
    OFFSET (p_page-1)*p_page_size LIMIT p_page_size
  )
  SELECT jsonb_build_object(
    'stories', coalesce(jsonb_agg(jsonb_build_object(
      'id',id,'title',title,'studentId',student_id,'studentName',student_name,'cohort',student_cohort,
      'status',status,'mentorScore',mentor_score,'reviewSuitability',review_suitability,
      'rowVersion',row_version,'revised',revised,'updatedAt',updated_at,
      'submittedAt',coalesce(last_submitted_at,submitted_at)
    )), '[]'::jsonb),
    'total',coalesce(max(total),0),'page',p_page,'pageSize',p_page_size
  ) INTO v_payload FROM matching;
  RETURN v_payload;
END
$$;

REVOKE ALL ON FUNCTION public.sf_request_review_contribution(uuid,bigint,smallint,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sf_request_review_contribution(uuid,bigint,smallint,text) TO authenticated;

COMMIT;
