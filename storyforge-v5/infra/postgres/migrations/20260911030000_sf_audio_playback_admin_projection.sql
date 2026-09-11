-- Migration: 20260911030000_sf_audio_playback_admin_projection.sql
-- Authority: SF-AUDIO-PLAYBACK-5018
-- Date: 2026-09-11
-- Depends on: 20260908193000_sf_access_5014_canonical_admin_identity.sql
-- Description: Expose verified story audio identity and duration in bounded administrator subject detail.
-- Idempotent: YES

\set ON_ERROR_STOP on

BEGIN;

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
      'audioAssetId', verified_audio.id,
      'audioDurationMs', verified_audio.duration_ms,
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
    SELECT audio.id, audio.duration_ms
    FROM public.sf_audio_assets audio
    WHERE audio.story_id = story.id
      AND audio.student_id = story.student_id
      AND audio.state = 'verified'
    ORDER BY audio.verified_at DESC, audio.created_at DESC, audio.id DESC
    LIMIT 1
  ) verified_audio ON true
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

REVOKE ALL ON FUNCTION public.sf_admin_subject_story(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sf_admin_subject_story(uuid, uuid) TO authenticated;

COMMIT;
