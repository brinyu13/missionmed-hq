\set ON_ERROR_STOP on

-- SF-REQUEST-A-STORY-5020
-- A completed guest contribution becomes a private StoryForge story in the
-- same transaction and produces one student notification. No identity,
-- enrollment, table grant, or RLS policy is changed.

BEGIN;

SELECT pg_advisory_xact_lock(hashtextextended('sf-request-a-story-5020-delivery-hydration', 0));

CREATE OR REPLACE FUNCTION public.sf_guest_hydrate_contribution(p_contribution_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_contribution public.sf_story_contributions;
  v_invitation public.sf_story_invitations;
  v_story public.sf_stories;
  v_notification public.sf_notifications;
  v_title text;
BEGIN
  SELECT contribution.* INTO v_contribution
  FROM public.sf_story_contributions contribution
  WHERE contribution.id = p_contribution_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'contribution not found' USING ERRCODE = 'P0002';
  END IF;
  SELECT invitation.* INTO v_invitation
  FROM public.sf_story_invitations invitation
  WHERE invitation.id = v_contribution.invitation_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'contribution not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_contribution.state = 'promoted' THEN
    SELECT notification.* INTO v_notification
    FROM public.sf_notifications notification
    WHERE notification.recipient_id = v_invitation.student_id
      AND notification.story_id = v_contribution.promoted_story_id
      AND notification.event_key = 'request.story_received'
    ORDER BY notification.created_at DESC, notification.id DESC
    LIMIT 1;
    RETURN jsonb_build_object(
      'contributionId', v_contribution.id,
      'storyId', v_contribution.promoted_story_id,
      'notificationId', v_notification.id,
      'state', v_contribution.state,
      'visibility', 'private',
      'existing', true
    );
  END IF;

  IF NOT EXISTS (
      SELECT 1
      FROM public.sf_users student
      WHERE student.id = v_invitation.student_id
        AND student.role = 'student'
        AND student.eligible
    )
    OR NOT public.sf_guest_feature_enabled_for_student(
      'request_a_story', v_invitation.student_id
    )
    OR NOT public.sf_guest_feature_enabled_for_student(
      'guest_contributions', v_invitation.student_id
    ) THEN
    RAISE EXCEPTION 'invitation not found' USING ERRCODE = 'P0002';
  END IF;

  v_title := left(
    'A story from ' || coalesce(nullif(trim(v_invitation.contributor_first_name), ''), 'someone who knows you'),
    160
  );

  INSERT INTO public.sf_stories (
    student_id, title, original_text, current_text, capture_type, status,
    prefix_enabled, student_updated_at, status_changed_at, visibility,
    visibility_changed_at, origin
  ) VALUES (
    v_invitation.student_id, v_title, v_contribution.transcript,
    v_contribution.transcript, 'imported', 'private', false, now(), now(),
    'private', NULL,
    jsonb_build_object(
      'type', 'contribution',
      'contributionId', v_contribution.id::text,
      'relationship', v_invitation.relationship_id,
      'contributorFirstName', v_invitation.contributor_first_name
    )
  )
  RETURNING * INTO v_story;

  INSERT INTO public.sf_story_originals (
    story_id, original_transcript, capture_type, created_at
  ) VALUES (
    v_story.id, v_contribution.transcript, 'imported', v_story.created_at
  );

  -- The revision schema requires the owning student FK. This is structural
  -- ownership, not an authenticated actor claim; the system audit below keeps
  -- the actual guest-delivery provenance explicit.
  INSERT INTO public.sf_story_revisions (
    story_id, revision_no, text_snapshot, title_snapshot, actor_id, reason
  ) VALUES (
    v_story.id, 0, v_story.current_text, v_story.title,
    v_invitation.student_id, 'capture'
  );

  INSERT INTO public.sf_authored_segments (
    story_id, source_role, source_entity_type, source_entity_id,
    body_hash, author_id
  ) VALUES (
    v_story.id, 'guest_contributor', 'contribution', v_contribution.id,
    encode(digest(convert_to(v_contribution.transcript, 'UTF8'), 'sha256'), 'hex'),
    NULL
  );

  UPDATE public.sf_story_contributions
  SET state = 'promoted',
      promoted_story_id = v_story.id,
      promoted_at = now(),
      updated_at = now(),
      row_version = row_version + 1
  WHERE id = v_contribution.id;

  SELECT * INTO v_notification
  FROM public.sf_emit_notification(
    v_invitation.student_id,
    NULL,
    v_story.id,
    NULL,
    'request.story_received',
    'system',
    'A new story is in your library',
    'A private story from ' || v_invitation.contributor_first_name || ' is ready in your StoryForge Library.',
    '/library'
  );

  PERFORM public.sf_append_audit(
    'request.contribution_hydrated',
    'story',
    v_story.id,
    'system',
    v_invitation.student_id,
    v_story.id,
    NULL,
    NULL,
    jsonb_build_object(
      'contributionId', v_contribution.id,
      'kind', v_contribution.kind,
      'origin', 'contribution',
      'notificationId', v_notification.id,
      'visibility', 'private'
    ),
    NULL,
    'both'
  );

  RETURN jsonb_build_object(
    'contributionId', v_contribution.id,
    'storyId', v_story.id,
    'notificationId', v_notification.id,
    'state', 'promoted',
    'visibility', 'private',
    'existing', false
  );
END
$$;

CREATE OR REPLACE FUNCTION public.sf_guest_contribute(
  p_invitation uuid,
  p_kind text,
  p_transcript text,
  p_prompt uuid,
  p_snapshot text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row public.sf_story_contributions;
  v_invitation public.sf_story_invitations;
  v_prompt public.sf_contributor_prompts;
  v_submission_hash text;
  v_hydration jsonb;
BEGIN
  IF p_kind <> 'text'
    OR length(trim(coalesce(p_transcript, ''))) NOT BETWEEN 1 AND 20000 THEN
    RAISE EXCEPTION 'voice contribution requires verified audio' USING ERRCODE = '42501';
  END IF;

  SELECT invitation.* INTO v_invitation
  FROM public.sf_story_invitations invitation
  WHERE invitation.id = p_invitation
    AND invitation.status IN ('sent', 'delivered', 'link_visited', 'started', 'story_shared')
    AND invitation.token_hash IS NOT NULL
    AND invitation.expires_at > now()
    AND invitation.revoked_at IS NULL
    AND invitation.suppressed_at IS NULL
  FOR UPDATE;
  IF NOT FOUND
    OR NOT public.sf_guest_feature_enabled_for_student('request_a_story', v_invitation.student_id)
    OR NOT public.sf_guest_feature_enabled_for_student('guest_contributions', v_invitation.student_id) THEN
    RAISE EXCEPTION 'invitation not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO v_prompt
  FROM public.sf_contributor_prompts
  WHERE id = p_prompt
    AND state = 'active'
    AND v_invitation.relationship_id = ANY(relationship_ids);
  IF NOT FOUND OR p_snapshot IS DISTINCT FROM v_prompt.text THEN
    RAISE EXCEPTION 'prompt not found' USING ERRCODE = 'P0002';
  END IF;

  v_submission_hash := encode(digest(convert_to(jsonb_build_array(
    'text', trim(p_transcript), p_prompt, v_prompt.text
  )::text, 'UTF8'), 'sha256'), 'hex');

  SELECT * INTO v_row
  FROM public.sf_story_contributions
  WHERE invitation_id = p_invitation
    AND submission_hash = v_submission_hash;
  IF FOUND THEN
    v_hydration := public.sf_guest_hydrate_contribution(v_row.id);
    RETURN v_hydration || jsonb_build_object(
      'id', v_row.id,
      'kind', v_row.kind,
      'submitted_at', v_row.submitted_at,
      'existing', true
    );
  END IF;

  IF (SELECT count(*) FROM public.sf_story_contributions WHERE invitation_id = p_invitation) >= 3 THEN
    RAISE EXCEPTION 'invitation complete' USING ERRCODE = 'P0003';
  END IF;

  INSERT INTO public.sf_story_contributions (
    invitation_id, kind, transcript, prompt_id, prompt_text_snapshot, submission_hash
  ) VALUES (
    p_invitation, 'text', trim(p_transcript), p_prompt, v_prompt.text, v_submission_hash
  )
  RETURNING * INTO v_row;

  UPDATE public.sf_story_invitations
  SET status = 'story_shared',
      started_at = coalesce(started_at, now()),
      contributed_at = now(),
      updated_at = now()
  WHERE id = p_invitation;
  INSERT INTO public.sf_story_invitation_events(invitation_id, event_type)
  VALUES (p_invitation, 'story_shared');

  v_hydration := public.sf_guest_hydrate_contribution(v_row.id);
  RETURN v_hydration || jsonb_build_object(
    'id', v_row.id,
    'kind', v_row.kind,
    'submitted_at', v_row.submitted_at,
    'existing', false
  );
END
$$;

CREATE OR REPLACE FUNCTION public.sf_guest_voice_complete(
  p_token_hash text,
  p_session_id uuid,
  p_contribution_id uuid,
  p_asset_id uuid,
  p_transcript text,
  p_object_key text,
  p_content_type text,
  p_byte_size bigint,
  p_duration_ms integer,
  p_checksum_sha256 text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_invitation public.sf_story_invitations;
  v_session public.sf_guest_voice_sessions;
  v_contribution public.sf_story_contributions;
  v_submission_hash text;
  v_transient_prefix text;
  v_hydration jsonb;
BEGIN
  v_invitation := public.sf_guest_voice_assert_invitation(p_token_hash);
  SELECT invitation.* INTO v_invitation
  FROM public.sf_story_invitations invitation
  WHERE invitation.id = v_invitation.id
    AND invitation.token_hash = p_token_hash
    AND invitation.status IN ('sent', 'delivered', 'link_visited', 'started', 'story_shared')
    AND invitation.expires_at > now()
    AND invitation.revoked_at IS NULL
    AND invitation.suppressed_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'invitation not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO v_session
  FROM public.sf_guest_voice_sessions
  WHERE id = p_session_id
    AND invitation_id = v_invitation.id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'recording not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_session.state = 'contributed' THEN
    SELECT * INTO v_contribution
    FROM public.sf_story_contributions
    WHERE id = v_session.contribution_id
      AND invitation_id = v_invitation.id;
    v_hydration := public.sf_guest_hydrate_contribution(v_contribution.id);
    RETURN v_hydration || jsonb_build_object(
      'contributionId', v_contribution.id,
      'assetId', v_session.finish_asset_id,
      'kind', 'voice',
      'existing', true
    );
  END IF;

  IF v_session.state <> 'finishing'
    OR p_contribution_id IS DISTINCT FROM v_session.finish_contribution_id
    OR p_asset_id IS DISTINCT FROM v_session.finish_asset_id
    OR p_object_key IS DISTINCT FROM v_session.finish_object_key
    OR length(trim(coalesce(p_transcript, ''))) NOT BETWEEN 1 AND 20000
    OR p_content_type IS DISTINCT FROM v_session.mime_type
    OR p_byte_size NOT BETWEEN 1 AND 31457280
    OR p_duration_ms <> v_session.total_duration_ms
    OR p_checksum_sha256 !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'voice contribution is invalid' USING ERRCODE = '22023';
  END IF;

  v_submission_hash := encode(digest(convert_to(jsonb_build_array(
    'voice', v_session.id, p_transcript, v_session.prompt_id
  )::text, 'UTF8'), 'sha256'), 'hex');
  IF (SELECT count(*) FROM public.sf_story_contributions
      WHERE invitation_id = v_session.invitation_id) >= 3 THEN
    RAISE EXCEPTION 'invitation complete' USING ERRCODE = 'P0003';
  END IF;

  INSERT INTO public.sf_story_contributions (
    id, invitation_id, kind, transcript, prompt_id,
    prompt_text_snapshot, submission_hash
  ) VALUES (
    p_contribution_id, v_session.invitation_id, 'voice', trim(p_transcript),
    v_session.prompt_id, v_session.prompt_text_snapshot, v_submission_hash
  )
  RETURNING * INTO v_contribution;

  INSERT INTO public.sf_contribution_audio_assets (
    id, contribution_id, invitation_id, object_key, content_type, byte_size,
    duration_ms, checksum_sha256, state, verified_at
  ) VALUES (
    p_asset_id, v_contribution.id, v_session.invitation_id, p_object_key,
    p_content_type, p_byte_size, p_duration_ms, p_checksum_sha256,
    'verified', now()
  );

  UPDATE public.sf_guest_voice_sessions
  SET state = 'contributed',
      contribution_id = v_contribution.id,
      finished_at = now(),
      updated_at = now()
  WHERE id = v_session.id;
  UPDATE public.sf_story_invitations
  SET status = 'story_shared',
      started_at = coalesce(started_at, now()),
      contributed_at = now(),
      updated_at = now()
  WHERE id = v_session.invitation_id;
  INSERT INTO public.sf_story_invitation_events(invitation_id, event_type)
  VALUES (v_session.invitation_id, 'story_shared');
  INSERT INTO public.sf_guest_voice_events(session_id, event_type)
  VALUES (v_session.id, 'recording_finished');
  UPDATE public.sf_guest_voice_cleanup_intents
  SET state = 'resolved',
      claimed_at = NULL,
      resolved_at = now(),
      updated_at = now(),
      last_error_category = NULL
  WHERE session_id = v_session.id
    AND cleanup_kind = 'permanent_object'
    AND state IN ('intended', 'claimed');
  v_transient_prefix := 'storyforge-rec/' || v_session.student_id || '/' || v_session.id || '/';
  PERFORM public.sf_guest_voice_enqueue_cleanup(
    v_session.id, 'transient_prefix', v_transient_prefix
  );

  v_hydration := public.sf_guest_hydrate_contribution(v_contribution.id);
  RETURN v_hydration || jsonb_build_object(
    'contributionId', v_contribution.id,
    'assetId', p_asset_id,
    'kind', 'voice',
    'existing', false
  );
END
$$;

REVOKE ALL ON FUNCTION public.sf_guest_hydrate_contribution(uuid)
  FROM PUBLIC, anon, authenticated, storyforge_app;
REVOKE ALL ON FUNCTION public.sf_guest_contribute(uuid, text, text, uuid, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sf_guest_voice_complete(
  text, uuid, uuid, uuid, text, text, text, bigint, integer, text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sf_guest_contribute(uuid, text, text, uuid, text)
  TO storyforge_app;
GRANT EXECUTE ON FUNCTION public.sf_guest_voice_complete(
  text, uuid, uuid, uuid, text, text, text, bigint, integer, text
) TO storyforge_app;

COMMIT;
