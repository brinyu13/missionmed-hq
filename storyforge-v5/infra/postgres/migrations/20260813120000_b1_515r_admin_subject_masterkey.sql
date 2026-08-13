\set ON_ERROR_STOP on

-- Migration: B1-515R bounded Administrator actor + student subject masterkey.
-- Authority: DR-071 / DR-072.
-- Safety: additive RPCs only. No story, identity, ownership, visibility, media,
--         consent, or feature-scope rows are rewritten.

BEGIN;
SELECT pg_advisory_xact_lock(hashtextextended('b1-515r-admin-subject-masterkey', 0));

-- Close the legacy contradictory-state seam at the RLS source used by stories,
-- originals, audio, questions, reflections, feedback, versions, and related
-- child tables. Owners retain their own complete record. Mentor/Admin reads are
-- active-only and explicit Private always wins over lifecycle status.
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
SET search_path = public, pg_temp
AS $$
  SELECT public.sf_has_live_identity()
    AND (
      (
        p_student_id = public.sf_actor_id()
        AND public.sf_actor_role() = 'student'
      )
      OR (
        p_archived_at IS NULL
        AND p_visibility IS DISTINCT FROM 'private'
        AND (
          (
            public.sf_actor_role() = 'mentor'
            AND public.sf_is_assigned(p_student_id)
          )
          OR public.sf_admin_console_enabled()
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

CREATE OR REPLACE FUNCTION public.sf_can_read_story_versions(p_story_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.sf_story_versions_enabled()
    AND EXISTS (
      SELECT 1 FROM public.sf_stories story
      WHERE story.id = p_story_id
        AND public.sf_story_observable_to_actor(
          story.student_id, story.status, story.visibility, story.archived_at
        )
    )
$$;

-- A signed Administrator may select only an eligible student inside the
-- independently scoped Admin Directory feature. The selected student remains
-- a subject, never the request actor.
CREATE OR REPLACE FUNCTION public.sf_admin_subject_context(p_student_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_student public.sf_users;
BEGIN
  IF NOT public.sf_b1_514_admin_feature_enabled('admin_directory', p_student_id) THEN
    RAISE EXCEPTION 'student not found' USING ERRCODE = 'P0002';
  END IF;
  SELECT * INTO v_student
  FROM public.sf_users
  WHERE id = p_student_id AND role = 'student' AND eligible;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'student not found' USING ERRCODE = 'P0002';
  END IF;
  RETURN jsonb_build_object(
    'mode', 'admin_subject',
    'actorId', public.sf_actor_id(),
    'actorRole', public.sf_actor_role(),
    'subject', jsonb_build_object(
      'id', v_student.id,
      'displayName', v_student.display_name,
      'firstName', v_student.first_name,
      'cohort', v_student.cohort,
      'academicYear', v_student.academic_year,
      'specialty', v_student.specialty,
      'applicationCycle', v_student.application_cycle
    ),
    'capabilities', jsonb_build_object(
      'studentOwnedMutations', false,
      'peerShare', false
    )
  );
END
$$;

-- One fail-closed source of truth for masterkey story observability.
-- Explicit Private wins over lifecycle status. Legacy submitted rows with a
-- NULL visibility remain observable. An unsubmitted mentor-visible row is
-- observable only while the subject's visibility-consent scope is enabled.
CREATE OR REPLACE FUNCTION public.sf_admin_subject_story_observable(
  p_student_id uuid,
  p_story_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.sf_b1_514_admin_feature_enabled('admin_directory', p_student_id)
    AND EXISTS (
      SELECT 1
      FROM public.sf_users student
      JOIN public.sf_stories story ON story.student_id = student.id
      WHERE student.id = p_student_id
        AND student.role = 'student'
        AND student.eligible
        AND story.id = p_story_id
        AND story.archived_at IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM public.sf_story_trash trash
          WHERE trash.story_id = story.id
        )
        AND public.sf_story_observable_to_actor(
          story.student_id, story.status, story.visibility, story.archived_at
        )
    )
$$;

CREATE OR REPLACE FUNCTION public.sf_admin_subject_home(p_student_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_context jsonb;
  v_result jsonb;
BEGIN
  v_context := public.sf_admin_subject_context(p_student_id);
  SELECT jsonb_build_object(
    'context', v_context,
    'metrics', jsonb_build_object(
      'observableStories', count(*)::integer,
      'awaitingReview', count(*) FILTER (WHERE story.status = 'awaiting')::integer,
      'inReview', count(*) FILTER (WHERE story.status = 'in_review')::integer,
      'changesRequested', count(*) FILTER (WHERE story.status = 'changes')::integer,
      'reviewed', count(*) FILTER (WHERE story.status = 'reviewed')::integer,
      'approved', count(*) FILTER (WHERE story.status = 'approved')::integer,
      'unscored', count(*) FILTER (WHERE story.mentor_score IS NULL)::integer,
      'mentorVisible', count(*) FILTER (WHERE story.visibility = 'mentor_visible')::integer
    ),
    'recent', coalesce((
      SELECT jsonb_agg(item ORDER BY item->>'updatedAt' DESC)
      FROM (
        SELECT jsonb_build_object(
          'id', recent.id,
          'title', recent.title,
          'status', recent.status,
          'visibility', recent.visibility,
          'source', CASE
            WHEN recent.origin->>'type' IN ('inspiration', 'contribution')
              THEN recent.origin->>'type'
            WHEN recent.capture_type = 'audio' THEN 'voice'
            WHEN recent.capture_type = 'text' THEN 'typed'
            ELSE recent.capture_type
          END,
          'captureType', recent.capture_type,
          'rowVersion', recent.row_version,
          'updatedAt', recent.updated_at,
          'submittedAt', coalesce(recent.last_submitted_at, recent.submitted_at)
        ) AS item
        FROM public.sf_stories recent
        WHERE recent.student_id = p_student_id
          AND public.sf_admin_subject_story_observable(p_student_id, recent.id)
        ORDER BY recent.updated_at DESC, recent.id DESC
        LIMIT 8
      ) rows
    ), '[]'::jsonb)
  ) INTO v_result
  FROM public.sf_stories story
  WHERE story.student_id = p_student_id
    AND public.sf_admin_subject_story_observable(p_student_id, story.id);

  PERFORM public.sf_append_audit(
    'admin.subject_home_viewed', 'student', p_student_id, 'system',
    p_student_id, NULL, NULL, NULL,
    jsonb_build_object('result_count', v_result->'metrics'->'observableStories'),
    NULL, 'admin_only'
  );
  RETURN v_result;
END
$$;

CREATE OR REPLACE FUNCTION public.sf_admin_subject_stories(
  p_student_id uuid,
  p_query text DEFAULT '',
  p_status text DEFAULT '',
  p_source text DEFAULT '',
  p_sort text DEFAULT 'recent',
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 50
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_context jsonb;
  v_query text := coalesce(p_query, '');
  v_status text := coalesce(p_status, '');
  v_source text := coalesce(p_source, '');
  v_result jsonb;
BEGIN
  v_context := public.sf_admin_subject_context(p_student_id);
  IF length(v_query) > 120
    OR v_status NOT IN ('', 'all', 'private', 'awaiting', 'in_review', 'changes', 'reviewed', 'approved')
    OR v_source NOT IN ('', 'all', 'typed', 'voice', 'text', 'audio', 'imported', 'inspiration', 'contribution')
    OR p_sort NOT IN ('recent', 'oldest', 'title', 'status')
    OR p_page < 1 OR p_page > 1000000
    OR p_page_size < 1 OR p_page_size > 100 THEN
    RAISE EXCEPTION 'invalid administrator subject library query' USING ERRCODE = '22023';
  END IF;

  WITH matching AS (
    SELECT story.*,
      CASE
        WHEN story.origin->>'type' IN ('inspiration', 'contribution')
          THEN story.origin->>'type'
        WHEN story.capture_type = 'audio' THEN 'voice'
        WHEN story.capture_type = 'text' THEN 'typed'
        ELSE story.capture_type
      END AS story_source,
      count(*) OVER()::integer AS total
    FROM public.sf_stories story
    WHERE story.student_id = p_student_id
      AND public.sf_admin_subject_story_observable(p_student_id, story.id)
      AND (v_query = '' OR story.title ILIKE '%' || v_query || '%')
      AND (v_status IN ('', 'all') OR story.status = v_status)
      AND (
        v_source IN ('', 'all')
        OR (v_source IN ('voice', 'audio') AND story.capture_type = 'audio')
        OR (v_source IN ('typed', 'text') AND story.capture_type = 'text')
        OR (v_source = 'imported' AND story.capture_type = 'imported')
        OR story.origin->>'type' = v_source
      )
    ORDER BY
      CASE WHEN p_sort = 'recent' THEN story.updated_at END DESC,
      CASE WHEN p_sort = 'oldest' THEN story.updated_at END ASC,
      CASE WHEN p_sort = 'title' THEN lower(story.title) END ASC,
      CASE WHEN p_sort = 'status' THEN story.status END ASC,
      story.id DESC
    OFFSET (p_page - 1) * p_page_size
    LIMIT p_page_size
  )
  SELECT jsonb_build_object(
    'context', v_context,
    'stories', coalesce(jsonb_agg(jsonb_build_object(
      'id', id,
      'title', title,
      'status', status,
      'visibility', visibility,
      'source', story_source,
      'captureType', capture_type,
      'lesson', lesson,
      'studentScore', student_score,
      'mentorScore', mentor_score,
      'reviewSuitability', review_suitability,
      'categories', categories,
      'themes', themes,
      'uses', uses,
      'rowVersion', row_version,
      'createdAt', created_at,
      'updatedAt', updated_at,
      'submittedAt', coalesce(last_submitted_at, submitted_at)
    )), '[]'::jsonb),
    'filters', jsonb_build_object(
      'query', v_query, 'status', v_status, 'source', v_source, 'sort', p_sort
    ),
    'pagination', jsonb_build_object(
      'page', p_page, 'pageSize', p_page_size, 'total', coalesce(max(total), 0)
    )
  ) INTO v_result
  FROM matching;

  PERFORM public.sf_append_audit(
    'admin.subject_library_viewed', 'student', p_student_id, 'system',
    p_student_id, NULL, NULL, NULL,
    jsonb_build_object(
      'query_present', v_query <> '',
      'status_filter_present', v_status NOT IN ('', 'all'),
      'source_filter_present', v_source NOT IN ('', 'all'),
      'result_count', jsonb_array_length(v_result->'stories')
    ), NULL, 'admin_only'
  );
  RETURN v_result;
END
$$;

CREATE OR REPLACE FUNCTION public.sf_admin_subject_story(
  p_student_id uuid,
  p_story_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_context jsonb;
  v_result jsonb;
BEGIN
  v_context := public.sf_admin_subject_context(p_student_id);
  IF NOT public.sf_admin_subject_story_observable(p_student_id, p_story_id) THEN
    RAISE EXCEPTION 'story not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT jsonb_build_object(
    'context', v_context,
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
      'visibility', story.visibility,
      'source', CASE
        WHEN story.origin->>'type' IN ('inspiration', 'contribution')
          THEN story.origin->>'type'
        WHEN story.capture_type = 'audio' THEN 'voice'
        WHEN story.capture_type = 'text' THEN 'typed'
        ELSE story.capture_type
      END,
      'captureType', story.capture_type,
      'studentScore', story.student_score,
      'mentorScore', story.mentor_score,
      'reviewSuitability', story.review_suitability,
      'categories', story.categories,
      'birds', story.birds,
      'positions', story.positions,
      'themes', story.themes,
      'uses', story.uses,
      'revised', story.revised,
      'rowVersion', story.row_version,
      'createdAt', story.created_at,
      'updatedAt', story.updated_at,
      'submittedAt', coalesce(story.last_submitted_at, story.submitted_at),
      'reviewedAt', story.reviewed_at,
      'reviewedByName', reviewer.display_name,
      'reviewedByRole', reviewer.role
    ),
    'feedback', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', feedback.id, 'body', feedback.body,
        'disposition', feedback.disposition, 'createdAt', feedback.created_at,
        'reviewerName', actor.display_name, 'reviewerRole', actor.role
      ) ORDER BY feedback.created_at, feedback.id)
      FROM public.sf_feedback feedback
      JOIN public.sf_users actor ON actor.id = feedback.mentor_id
      WHERE feedback.story_id = story.id
    ), '[]'::jsonb),
    'revisions', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', revision.id, 'revisionNo', revision.revision_no,
        'title', revision.title_snapshot, 'text', revision.text_snapshot,
        'reason', revision.reason, 'actorName', actor.display_name,
        'actorRole', actor.role, 'createdAt', revision.created_at
      ) ORDER BY revision.created_at, revision.id)
      FROM public.sf_story_revisions revision
      JOIN public.sf_users actor ON actor.id = revision.actor_id
      WHERE revision.story_id = story.id
    ), '[]'::jsonb),
    'reflections', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', reflection.id, 'prompt', reflection.prompt,
        'answer', reflection.answer, 'fromMentor', reflection.from_mentor,
        'createdAt', reflection.created_at, 'answeredAt', reflection.answered_at
      ) ORDER BY reflection.created_at, reflection.id)
      FROM public.sf_story_reflections reflection
      WHERE reflection.story_id = story.id
    ), '[]'::jsonb),
    'craft', (
      SELECT to_jsonb(craft) - 'scored_by'
      FROM public.sf_story_craft craft WHERE craft.story_id = story.id
    ),
    'versions', CASE
      WHEN public.sf_b1_514_admin_feature_enabled('story_versions', p_student_id)
      THEN coalesce((
        SELECT jsonb_agg(jsonb_build_object(
          'id', version.id, 'key', version.version_key,
          'body', version.body, 'source', version.source,
          'recordingId', version.recording_id,
          'audioAssetId', version.audio_asset_id,
          'rowVersion', version.row_version,
          'createdAt', version.created_at, 'updatedAt', version.updated_at,
          'history', (
            SELECT coalesce(jsonb_agg(jsonb_build_object(
              'id', prior.id, 'body', prior.body, 'source', prior.source,
              'recordingId', prior.recording_id,
              'audioAssetId', prior.audio_asset_id, 'savedAt', prior.saved_at
            ) ORDER BY prior.created_at DESC, prior.id DESC), '[]'::jsonb)
            FROM public.sf_story_version_revisions prior
            WHERE prior.version_id = version.id
          )
        ) ORDER BY version.version_key)
        FROM public.sf_story_versions version WHERE version.story_id = story.id
      ), '[]'::jsonb)
      ELSE '[]'::jsonb
    END,
    'internalNotes', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', note.id, 'body', note.body,
        'adminName', admin_user.display_name, 'createdAt', note.created_at
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
    ORDER BY revision.created_at, revision.id LIMIT 1
  ) revision0 ON true
  WHERE story.id = p_story_id AND story.student_id = p_student_id;

  PERFORM public.sf_append_audit(
    'admin.subject_story_viewed', 'story', p_story_id, 'system',
    p_student_id, p_story_id, NULL, NULL, NULL, NULL, 'admin_only'
  );
  RETURN v_result;
END
$$;

-- Preserve the existing recipient-bound peer story contract while exposing a
-- truthful capability bit. No object key or media identifier is added here;
-- the separately bounded peer audio claim remains the only media read seam.
CREATE OR REPLACE FUNCTION public.sf_peer_story_view(p_grant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_result jsonb;
BEGIN
  IF NOT public.sf_story_feature_enabled('peer_share', ARRAY['student']) THEN
    RAISE EXCEPTION 'peer grant not found' USING ERRCODE = 'P0002';
  END IF;
  SELECT jsonb_build_object(
    'grantId', grant_row.id, 'storyId', story.id,
    'ownerName', owner_user.display_name, 'title', story.title,
    'text', story.current_text, 'lesson', story.lesson,
    'hasAudio', EXISTS (
      SELECT 1 FROM public.sf_audio_assets asset
      WHERE asset.story_id = story.id
        AND asset.student_id = story.student_id
        AND asset.state = 'verified'
    ),
    'feedback', coalesce((SELECT jsonb_agg(jsonb_build_object(
      'id', feedback.id, 'body', feedback.body, 'authorName', author.display_name,
      'createdAt', feedback.created_at
    ) ORDER BY feedback.created_at, feedback.id)
      FROM public.sf_peer_feedback feedback
      JOIN public.sf_users author ON author.id = feedback.author_id
      WHERE feedback.grant_id = grant_row.id), '[]'::jsonb)
  ) INTO v_result
  FROM public.sf_peer_story_grants grant_row
  JOIN public.sf_stories story ON story.id = grant_row.story_id
  JOIN public.sf_users owner_user ON owner_user.id = grant_row.owner_id
  WHERE grant_row.id = p_grant_id
    AND grant_row.recipient_id = public.sf_actor_id()
    AND grant_row.status = 'active'
    AND story.archived_at IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.sf_story_trash trash WHERE trash.story_id = story.id
    );
  IF v_result IS NULL THEN
    RAISE EXCEPTION 'peer grant not found' USING ERRCODE = 'P0002';
  END IF;
  RETURN v_result;
END
$$;

-- Bounded administrator control for the existing peer_share kill switch. This
-- replaces the entire selected scope atomically and records counts, never raw
-- cohort labels or subject identifiers, in the audit stream.
CREATE OR REPLACE FUNCTION public.sf_admin_set_peer_share_scope(
  p_scope text,
  p_allowlist uuid[],
  p_cohorts text[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_before public.sf_feature_flags;
  v_after public.sf_feature_flags;
  v_audit_id bigint;
BEGIN
  PERFORM public.sf_admin_assert_enabled();
  IF p_scope NOT IN ('off', 'eligible_all', 'cohort', 'allowlist') THEN
    RAISE EXCEPTION 'invalid peer-share feature scope' USING ERRCODE = '22023';
  END IF;
  p_allowlist := coalesce(p_allowlist, ARRAY[]::uuid[]);
  p_cohorts := coalesce(p_cohorts, ARRAY[]::text[]);
  IF cardinality(p_allowlist) > 50 OR cardinality(p_cohorts) > 20 THEN
    RAISE EXCEPTION 'peer-share feature scope is too broad' USING ERRCODE = '22023';
  END IF;
  IF (p_scope = 'off' AND (cardinality(p_allowlist) <> 0 OR cardinality(p_cohorts) <> 0))
    OR (p_scope = 'eligible_all' AND (cardinality(p_allowlist) <> 0 OR cardinality(p_cohorts) <> 0))
    OR (p_scope = 'allowlist' AND (cardinality(p_allowlist) = 0 OR cardinality(p_cohorts) <> 0))
    OR (p_scope = 'cohort' AND (cardinality(p_cohorts) = 0 OR cardinality(p_allowlist) <> 0)) THEN
    RAISE EXCEPTION 'invalid peer-share feature scope values' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM unnest(p_allowlist) requested(id)
    LEFT JOIN public.sf_users student ON student.id = requested.id
    WHERE student.id IS NULL OR student.role <> 'student' OR NOT student.eligible
  ) THEN
    RAISE EXCEPTION 'peer-share allowlist must contain eligible students' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM unnest(p_cohorts) cohort(value)
    WHERE btrim(value) = '' OR value <> btrim(value) OR length(value) > 120
  ) THEN
    RAISE EXCEPTION 'peer-share cohorts must be normalized' USING ERRCODE = '22023';
  END IF;

  p_allowlist := ARRAY(
    SELECT DISTINCT value FROM unnest(p_allowlist) value ORDER BY value
  );
  p_cohorts := ARRAY(
    SELECT DISTINCT value FROM unnest(p_cohorts) value ORDER BY value
  );
  SELECT * INTO STRICT v_before
  FROM public.sf_feature_flags WHERE key = 'peer_share' FOR UPDATE;
  UPDATE public.sf_feature_flags
  SET scope = p_scope,
      allowlist = p_allowlist,
      cohorts = p_cohorts,
      updated_by = public.sf_actor_id(),
      updated_at = now()
  WHERE key = 'peer_share'
  RETURNING * INTO v_after;

  v_audit_id := public.sf_append_audit(
    'feature_scope_changed', 'feature_flag', NULL, 'system',
    NULL, NULL, NULL,
    jsonb_build_object(
      'key', 'peer_share', 'scope', v_before.scope,
      'allowlist_count', cardinality(v_before.allowlist),
      'cohort_count', cardinality(v_before.cohorts)
    ),
    jsonb_build_object(
      'key', 'peer_share', 'scope', v_after.scope,
      'allowlist_count', cardinality(v_after.allowlist),
      'cohort_count', cardinality(v_after.cohorts)
    ), NULL, 'admin_only'
  );
  RETURN jsonb_build_object(
    'key', 'peer_share',
    'scope', v_after.scope,
    'enabled', v_after.scope <> 'off',
    'allowlistCount', cardinality(v_after.allowlist),
    'cohortCount', cardinality(v_after.cohorts),
    'updatedAt', v_after.updated_at,
    'auditId', v_audit_id::text
  );
END
$$;

REVOKE ALL ON FUNCTION public.sf_admin_subject_context(uuid),
  public.sf_admin_subject_story_observable(uuid,uuid),
  public.sf_admin_subject_home(uuid),
  public.sf_admin_subject_stories(uuid,text,text,text,text,integer,integer),
  public.sf_admin_subject_story(uuid,uuid),
  public.sf_admin_set_peer_share_scope(text,uuid[],text[])
  FROM PUBLIC, anon, authenticated, storyforge_app;

GRANT EXECUTE ON FUNCTION public.sf_admin_subject_home(uuid),
  public.sf_admin_subject_stories(uuid,text,text,text,text,integer,integer),
  public.sf_admin_subject_story(uuid,uuid),
  public.sf_admin_set_peer_share_scope(text,uuid[],text[])
  TO authenticated;

COMMIT;
