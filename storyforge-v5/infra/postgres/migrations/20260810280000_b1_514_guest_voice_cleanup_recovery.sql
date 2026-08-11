\set ON_ERROR_STOP on
BEGIN;

ALTER TABLE public.sf_guest_voice_sessions
  ADD COLUMN finish_contribution_id uuid,
  ADD COLUMN finish_asset_id uuid,
  ADD COLUMN finish_object_key text,
  ADD CONSTRAINT sf_guest_voice_finish_identity_complete CHECK (
    (finish_contribution_id IS NULL AND finish_asset_id IS NULL AND finish_object_key IS NULL)
    OR (finish_contribution_id IS NOT NULL AND finish_asset_id IS NOT NULL AND finish_object_key IS NOT NULL)
  );

CREATE UNIQUE INDEX sf_guest_voice_finish_contribution_idx
  ON public.sf_guest_voice_sessions(finish_contribution_id)
  WHERE finish_contribution_id IS NOT NULL;
CREATE UNIQUE INDEX sf_guest_voice_finish_asset_idx
  ON public.sf_guest_voice_sessions(finish_asset_id)
  WHERE finish_asset_id IS NOT NULL;
CREATE UNIQUE INDEX sf_guest_voice_finish_object_idx
  ON public.sf_guest_voice_sessions(finish_object_key)
  WHERE finish_object_key IS NOT NULL;

CREATE TABLE public.sf_guest_voice_cleanup_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.sf_guest_voice_sessions(id) ON DELETE RESTRICT,
  cleanup_kind text NOT NULL CHECK (cleanup_kind IN ('transient_prefix','permanent_object')),
  object_locator text NOT NULL,
  state text NOT NULL DEFAULT 'intended' CHECK (state IN ('intended','claimed','resolved','failed')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5),
  claimed_at timestamptz,
  last_error_category text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  UNIQUE(session_id,cleanup_kind),
  CHECK (
    (cleanup_kind='transient_prefix' AND object_locator ~ '^storyforge-rec/[a-f0-9-]{36}/[a-f0-9-]{36}/$')
    OR
    (cleanup_kind='permanent_object' AND object_locator ~ '^storyforge-contribution-audio/[a-f0-9-]{36}/[a-f0-9-]{36}/[a-f0-9-]{36}/[a-f0-9-]{36}\.(webm|m4a|ogg|wav)$')
  ),
  CHECK (
    (state IN ('intended','claimed') AND resolved_at IS NULL)
    OR (state IN ('resolved','failed') AND resolved_at IS NOT NULL)
  )
);

ALTER TABLE public.sf_guest_voice_cleanup_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sf_guest_voice_cleanup_intents FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.sf_guest_voice_cleanup_intents FROM PUBLIC,anon,authenticated,storyforge_app;

CREATE OR REPLACE FUNCTION public.sf_guest_view(p_token_hash text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_row record;
BEGIN
  IF p_token_hash !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'invitation not found' USING ERRCODE='P0002';
  END IF;
  SELECT invitation.id,invitation.contributor_first_name,invitation.relationship_id,
    invitation.status,invitation.personal_message,invitation.disclosure_version,
    invitation.expires_at,invitation.revoked_at,invitation.suppressed_at,
    student.first_name,student.display_name
  INTO v_row
  FROM public.sf_story_invitations invitation
  JOIN public.sf_users student ON student.id=invitation.student_id
  WHERE invitation.token_hash=p_token_hash;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'invitation not found' USING ERRCODE='P0002';
  END IF;
  RETURN jsonb_build_object(
    'id',v_row.id,'contributor_first_name',v_row.contributor_first_name,
    'relationship_id',v_row.relationship_id,'status',v_row.status,
    'personal_message',v_row.personal_message,'disclosure_version',v_row.disclosure_version,
    'expires_at',v_row.expires_at,'revoked_at',v_row.revoked_at,
    'suppressed_at',v_row.suppressed_at,'first_name',v_row.first_name,
    'display_name',v_row.display_name
  );
END $$;

CREATE OR REPLACE FUNCTION public.sf_guest_voice_enqueue_cleanup(
  p_session_id uuid,p_cleanup_kind text,p_object_locator text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  INSERT INTO public.sf_guest_voice_cleanup_intents(session_id,cleanup_kind,object_locator)
  VALUES(p_session_id,p_cleanup_kind,p_object_locator)
  ON CONFLICT(session_id,cleanup_kind) DO UPDATE
  SET object_locator=EXCLUDED.object_locator,
      state=CASE WHEN sf_guest_voice_cleanup_intents.state='resolved' THEN 'resolved' ELSE 'intended' END,
      claimed_at=NULL,
      updated_at=now(),
      resolved_at=CASE WHEN sf_guest_voice_cleanup_intents.state='resolved'
        THEN sf_guest_voice_cleanup_intents.resolved_at ELSE NULL END;
END
$$;

CREATE OR REPLACE FUNCTION public.sf_guest_voice_prepare_finish(
  p_token_hash text,p_session_id uuid,p_prompt_id uuid
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
  v_invitation public.sf_story_invitations;
  v_session public.sf_guest_voice_sessions;
  v_prompt public.sf_contributor_prompts;
  v_transcript text;
  v_contribution public.sf_story_contributions;
  v_audio public.sf_contribution_audio_assets;
  v_extension text;
  v_finish_contribution_id uuid;
  v_finish_asset_id uuid;
  v_finish_object_key text;
BEGIN
  v_invitation:=public.sf_guest_voice_assert_invitation(p_token_hash);
  SELECT * INTO v_session FROM public.sf_guest_voice_sessions
  WHERE id=p_session_id AND invitation_id=v_invitation.id
    AND state IN ('recording','finishing','contributed') FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'recording not found' USING ERRCODE='P0002'; END IF;

  IF v_session.state='contributed' THEN
    IF v_session.prompt_id IS DISTINCT FROM p_prompt_id THEN
      RAISE EXCEPTION 'recording prompt conflict' USING ERRCODE='40001';
    END IF;
    SELECT * INTO v_contribution FROM public.sf_story_contributions
    WHERE id=v_session.contribution_id AND invitation_id=v_invitation.id;
    SELECT * INTO v_audio FROM public.sf_contribution_audio_assets
    WHERE contribution_id=v_contribution.id AND state='verified';
    IF NOT FOUND THEN RAISE EXCEPTION 'voice contribution is invalid' USING ERRCODE='55000'; END IF;
    RETURN jsonb_build_object(
      'recordingId',v_session.id,'invitationId',v_session.invitation_id,
      'studentId',v_session.student_id,'mimeType',v_session.mime_type,
      'durationMs',v_session.total_duration_ms,'byteSize',v_session.total_byte_size,
      'segmentCount',v_session.segment_count,'providerTranscript',v_session.provider_transcript,
      'promptId',v_session.prompt_id,'promptTextSnapshot',v_session.prompt_text_snapshot,
      'contributionId',v_contribution.id,'assetId',v_audio.id,'objectKey',v_audio.object_key,
      'transcript',v_contribution.transcript,'kind','voice','state',v_contribution.state,
      'existing',true
    );
  END IF;

  IF v_session.segment_count<1 OR EXISTS(
    SELECT 1 FROM public.sf_guest_voice_segments WHERE session_id=v_session.id
      AND transcribe_state<>'transcribed'
  ) THEN RAISE EXCEPTION 'recording is still being prepared' USING ERRCODE='55000'; END IF;
  SELECT string_agg(trim(segment.transcript),' ' ORDER BY segment.seq) INTO v_transcript
  FROM public.sf_guest_voice_segments segment WHERE session_id=v_session.id;
  v_transcript:=trim(coalesce(v_transcript,''));
  IF length(v_transcript) NOT BETWEEN 1 AND 20000 THEN
    RAISE EXCEPTION 'voice contribution transcript is invalid' USING ERRCODE='22023';
  END IF;
  SELECT * INTO v_prompt FROM public.sf_contributor_prompts
  WHERE id=p_prompt_id AND state='active' AND v_invitation.relationship_id=ANY(relationship_ids);
  IF NOT FOUND THEN RAISE EXCEPTION 'prompt not found' USING ERRCODE='P0002'; END IF;
  IF (SELECT count(*) FROM public.sf_story_contributions WHERE invitation_id=v_invitation.id)>=3 THEN
    RAISE EXCEPTION 'invitation complete' USING ERRCODE='P0003';
  END IF;
  IF v_session.state='finishing' AND v_session.prompt_id IS DISTINCT FROM p_prompt_id THEN
    RAISE EXCEPTION 'recording prompt conflict' USING ERRCODE='40001';
  END IF;
  v_extension:=CASE v_session.mime_type WHEN 'audio/webm' THEN 'webm'
    WHEN 'audio/mp4' THEN 'm4a' WHEN 'audio/ogg' THEN 'ogg' WHEN 'audio/wav' THEN 'wav' END;
  v_finish_contribution_id:=coalesce(v_session.finish_contribution_id,gen_random_uuid());
  v_finish_asset_id:=coalesce(v_session.finish_asset_id,gen_random_uuid());
  v_finish_object_key:=coalesce(v_session.finish_object_key,
    'storyforge-contribution-audio/'||v_session.student_id||'/'||v_session.invitation_id||'/'||
    v_finish_contribution_id||'/'||v_finish_asset_id||'.'||v_extension);
  UPDATE public.sf_guest_voice_sessions
  SET state='finishing',prompt_id=v_prompt.id,prompt_text_snapshot=v_prompt.text,
      provider_transcript=v_transcript,
      finish_contribution_id=v_finish_contribution_id,
      finish_asset_id=v_finish_asset_id,finish_object_key=v_finish_object_key,updated_at=now()
  WHERE id=v_session.id RETURNING * INTO v_session;
  PERFORM public.sf_guest_voice_enqueue_cleanup(
    v_session.id,'permanent_object',v_session.finish_object_key
  );
  RETURN jsonb_build_object(
    'recordingId',v_session.id,'invitationId',v_session.invitation_id,
    'studentId',v_session.student_id,'mimeType',v_session.mime_type,
    'durationMs',v_session.total_duration_ms,'byteSize',v_session.total_byte_size,
    'segmentCount',v_session.segment_count,'providerTranscript',v_session.provider_transcript,
    'promptId',v_session.prompt_id,'promptTextSnapshot',v_session.prompt_text_snapshot,
    'contributionId',v_session.finish_contribution_id,'assetId',v_session.finish_asset_id,
    'objectKey',v_session.finish_object_key,'existing',false
  );
END $$;

CREATE OR REPLACE FUNCTION public.sf_guest_voice_complete(
  p_token_hash text,p_session_id uuid,p_contribution_id uuid,p_asset_id uuid,
  p_transcript text,p_object_key text,p_content_type text,p_byte_size bigint,
  p_duration_ms integer,p_checksum_sha256 text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
  v_invitation public.sf_story_invitations;
  v_session public.sf_guest_voice_sessions;
  v_contribution public.sf_story_contributions;
  v_submission_hash text;
  v_transient_prefix text;
BEGIN
  v_invitation:=public.sf_guest_voice_assert_invitation(p_token_hash);
  SELECT invitation.* INTO v_invitation FROM public.sf_story_invitations invitation
  WHERE invitation.id=v_invitation.id AND invitation.token_hash=p_token_hash
    AND invitation.status IN ('sent','delivered','link_visited','started','story_shared')
    AND invitation.expires_at>now() AND invitation.revoked_at IS NULL
    AND invitation.suppressed_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'invitation not found' USING ERRCODE='P0002'; END IF;
  SELECT * INTO v_session FROM public.sf_guest_voice_sessions
  WHERE id=p_session_id AND invitation_id=v_invitation.id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'recording not found' USING ERRCODE='P0002'; END IF;
  IF v_session.state='contributed' THEN
    SELECT * INTO v_contribution FROM public.sf_story_contributions
    WHERE id=v_session.contribution_id AND invitation_id=v_invitation.id;
    RETURN jsonb_build_object(
      'contributionId',v_contribution.id,'assetId',v_session.finish_asset_id,
      'kind','voice','state',v_contribution.state,'existing',true
    );
  END IF;
  IF v_session.state<>'finishing'
    OR p_contribution_id IS DISTINCT FROM v_session.finish_contribution_id
    OR p_asset_id IS DISTINCT FROM v_session.finish_asset_id
    OR p_object_key IS DISTINCT FROM v_session.finish_object_key
    OR length(trim(coalesce(p_transcript,''))) NOT BETWEEN 1 AND 20000
    OR p_content_type IS DISTINCT FROM v_session.mime_type
    OR p_byte_size NOT BETWEEN 1 AND 31457280
    OR p_duration_ms<>v_session.total_duration_ms
    OR p_checksum_sha256 !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'voice contribution is invalid' USING ERRCODE='22023';
  END IF;
  v_submission_hash:=encode(digest(convert_to(jsonb_build_array(
    'voice',v_session.id,p_transcript,v_session.prompt_id
  )::text,'UTF8'),'sha256'),'hex');
  IF (SELECT count(*) FROM public.sf_story_contributions
      WHERE invitation_id=v_session.invitation_id)>=3 THEN
    RAISE EXCEPTION 'invitation complete' USING ERRCODE='P0003';
  END IF;
  INSERT INTO public.sf_story_contributions(
    id,invitation_id,kind,transcript,prompt_id,prompt_text_snapshot,submission_hash
  ) VALUES(p_contribution_id,v_session.invitation_id,'voice',trim(p_transcript),
    v_session.prompt_id,v_session.prompt_text_snapshot,v_submission_hash)
  RETURNING * INTO v_contribution;
  INSERT INTO public.sf_contribution_audio_assets(
    id,contribution_id,invitation_id,object_key,content_type,byte_size,
    duration_ms,checksum_sha256,state,verified_at
  ) VALUES(p_asset_id,v_contribution.id,v_session.invitation_id,p_object_key,p_content_type,
    p_byte_size,p_duration_ms,p_checksum_sha256,'verified',now());
  UPDATE public.sf_guest_voice_sessions SET state='contributed',contribution_id=v_contribution.id,
    finished_at=now(),updated_at=now() WHERE id=v_session.id;
  UPDATE public.sf_story_invitations SET status='story_shared',started_at=coalesce(started_at,now()),
    contributed_at=now(),updated_at=now() WHERE id=v_session.invitation_id;
  INSERT INTO public.sf_story_invitation_events(invitation_id,event_type)
  VALUES(v_session.invitation_id,'story_shared');
  INSERT INTO public.sf_guest_voice_events(session_id,event_type)
  VALUES(v_session.id,'recording_finished');
  UPDATE public.sf_guest_voice_cleanup_intents
  SET state='resolved',claimed_at=NULL,resolved_at=now(),updated_at=now(),last_error_category=NULL
  WHERE session_id=v_session.id AND cleanup_kind='permanent_object' AND state IN ('intended','claimed');
  v_transient_prefix:='storyforge-rec/'||v_session.student_id||'/'||v_session.id||'/';
  PERFORM public.sf_guest_voice_enqueue_cleanup(v_session.id,'transient_prefix',v_transient_prefix);
  RETURN jsonb_build_object(
    'contributionId',v_contribution.id,'assetId',p_asset_id,'kind','voice',
    'state',v_contribution.state,'existing',false
  );
END $$;

CREATE OR REPLACE FUNCTION public.sf_guest_voice_cancel(p_token_hash text,p_session_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_invitation public.sf_story_invitations; v_session public.sf_guest_voice_sessions;
BEGIN
  v_invitation:=public.sf_guest_voice_assert_invitation(p_token_hash);
  UPDATE public.sf_guest_voice_sessions SET state='cancelled',updated_at=now()
  WHERE id=p_session_id AND invitation_id=v_invitation.id AND state IN ('recording','finishing')
  RETURNING * INTO v_session;
  IF NOT FOUND THEN RAISE EXCEPTION 'recording not found' USING ERRCODE='P0002'; END IF;
  INSERT INTO public.sf_guest_voice_events(session_id,event_type)
  VALUES(v_session.id,'recording_cancelled');
  PERFORM public.sf_guest_voice_enqueue_cleanup(
    v_session.id,'transient_prefix','storyforge-rec/'||v_session.student_id||'/'||v_session.id||'/'
  );
  RETURN jsonb_build_object('recordingId',v_session.id,'studentId',v_session.student_id,
    'state',v_session.state);
END $$;

CREATE OR REPLACE FUNCTION public.sf_claim_guest_voice_cleanup(p_limit integer DEFAULT 20)
RETURNS TABLE(intent_id uuid,session_id uuid,cleanup_kind text,object_locator text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_limit integer:=greatest(1,least(coalesce(p_limit,20),100)); candidate record;
BEGIN
  FOR candidate IN
    SELECT session.id,session.student_id,session.state,
      invitation.revoked_at,invitation.suppressed_at,invitation.expires_at,session.updated_at
    FROM public.sf_guest_voice_sessions session
    JOIN public.sf_story_invitations invitation ON invitation.id=session.invitation_id
    WHERE session.state IN ('recording','finishing')
      AND (invitation.revoked_at IS NOT NULL OR invitation.suppressed_at IS NOT NULL
        OR invitation.expires_at<=now() OR session.updated_at<now()-interval '24 hours')
    ORDER BY session.updated_at,session.id
    FOR UPDATE OF session SKIP LOCKED
    LIMIT v_limit
  LOOP
    UPDATE public.sf_guest_voice_sessions SET state='failed',updated_at=now()
    WHERE id=candidate.id;
    INSERT INTO public.sf_guest_voice_events(session_id,event_type,detail)
    VALUES(candidate.id,'recording_cancelled',jsonb_build_object('reason','expired_or_abandoned'));
    PERFORM public.sf_guest_voice_enqueue_cleanup(
      candidate.id,'transient_prefix','storyforge-rec/'||candidate.student_id||'/'||candidate.id||'/'
    );
  END LOOP;

  UPDATE public.sf_guest_voice_cleanup_intents intent
  SET state='resolved',claimed_at=NULL,resolved_at=now(),updated_at=now(),last_error_category=NULL
  WHERE intent.cleanup_kind='permanent_object' AND intent.state IN ('intended','claimed')
    AND EXISTS(SELECT 1 FROM public.sf_contribution_audio_assets audio
      WHERE audio.object_key=intent.object_locator AND audio.state='verified');

  FOR candidate IN
    SELECT intent.* FROM public.sf_guest_voice_cleanup_intents intent
    JOIN public.sf_guest_voice_sessions session ON session.id=intent.session_id
    WHERE (
        intent.state='intended'
        OR (intent.state='claimed' AND intent.claimed_at<now()-interval '15 minutes')
      )
      AND intent.attempts<5
      AND (
        intent.cleanup_kind='transient_prefix'
        OR session.state IN ('cancelled','failed')
        OR session.updated_at<now()-interval '24 hours'
      )
    ORDER BY intent.created_at,intent.id
    FOR UPDATE OF intent SKIP LOCKED
    LIMIT v_limit
  LOOP
    UPDATE public.sf_guest_voice_cleanup_intents
    SET state='claimed',attempts=attempts+1,claimed_at=now(),updated_at=now()
    WHERE id=candidate.id;
    intent_id:=candidate.id;
    session_id:=candidate.session_id;
    cleanup_kind:=candidate.cleanup_kind;
    object_locator:=candidate.object_locator;
    RETURN NEXT;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.sf_complete_guest_voice_cleanup(
  p_intent_id uuid,p_succeeded boolean,p_error_category text DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_intent public.sf_guest_voice_cleanup_intents;
BEGIN
  IF p_error_category IS NOT NULL AND p_error_category !~ '^[a-z_]{1,48}$' THEN
    RAISE EXCEPTION 'invalid cleanup error category' USING ERRCODE='22023';
  END IF;
  UPDATE public.sf_guest_voice_cleanup_intents
  SET state=CASE WHEN p_succeeded THEN 'resolved' WHEN attempts>=5 THEN 'failed' ELSE 'intended' END,
      claimed_at=NULL,
      last_error_category=CASE WHEN p_succeeded THEN NULL ELSE coalesce(p_error_category,'object_delete_failed') END,
      resolved_at=CASE WHEN p_succeeded OR attempts>=5 THEN now() ELSE NULL END,
      updated_at=now()
  WHERE id=p_intent_id AND state='claimed' RETURNING * INTO v_intent;
  IF NOT FOUND THEN RAISE EXCEPTION 'cleanup intent not found' USING ERRCODE='P0002'; END IF;
  IF p_succeeded AND v_intent.cleanup_kind='transient_prefix' THEN
    UPDATE public.sf_guest_voice_sessions SET purged_at=coalesce(purged_at,now()),updated_at=now()
    WHERE id=v_intent.session_id;
    INSERT INTO public.sf_guest_voice_events(session_id,event_type)
    SELECT v_intent.session_id,'storage_purged'
    WHERE NOT EXISTS(SELECT 1 FROM public.sf_guest_voice_events
      WHERE session_id=v_intent.session_id AND event_type='storage_purged');
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.sf_request_revoke(p_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
  v_actor uuid:=public.sf_request_assert_student();
  v_row public.sf_story_invitations;
  v_session public.sf_guest_voice_sessions;
BEGIN
  SELECT * INTO v_row FROM public.sf_story_invitations
  WHERE id=p_id AND student_id=v_actor AND revoked_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'invitation not found' USING ERRCODE='P0002'; END IF;
  IF v_row.active_delivery_attempt_id IS NOT NULL THEN
    UPDATE public.sf_story_invitation_delivery_attempts
    SET state='abandoned',failure_reason='revoked',resolved_at=now(),updated_at=now()
    WHERE id=v_row.active_delivery_attempt_id AND state IN ('reserved','dispatching','ambiguous');
  END IF;
  FOR v_session IN SELECT * FROM public.sf_guest_voice_sessions
    WHERE invitation_id=v_row.id AND state IN ('recording','finishing') FOR UPDATE
  LOOP
    UPDATE public.sf_guest_voice_sessions SET state='cancelled',updated_at=now()
    WHERE id=v_session.id;
    INSERT INTO public.sf_guest_voice_events(session_id,event_type,detail)
    VALUES(v_session.id,'recording_cancelled',jsonb_build_object('reason','invitation_revoked'));
    PERFORM public.sf_guest_voice_enqueue_cleanup(
      v_session.id,'transient_prefix','storyforge-rec/'||v_session.student_id||'/'||v_session.id||'/'
    );
  END LOOP;
  UPDATE public.sf_story_invitations
  SET status='revoked',revoked_at=now(),token_hash=NULL,active_delivery_attempt_id=NULL,
      delivery_state=NULL,row_version=row_version+1,updated_at=now()
  WHERE id=v_row.id RETURNING * INTO v_row;
  INSERT INTO public.sf_story_invitation_events(invitation_id,event_type)
  VALUES(v_row.id,'revoked');
  RETURN to_jsonb(v_row);
END $$;

REVOKE ALL ON FUNCTION public.sf_guest_voice_enqueue_cleanup(uuid,text,text) FROM PUBLIC,anon,authenticated,storyforge_app;
REVOKE ALL ON FUNCTION public.sf_guest_view(text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.sf_claim_guest_voice_cleanup(integer) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.sf_complete_guest_voice_cleanup(uuid,boolean,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sf_guest_view(text) TO storyforge_app;
GRANT EXECUTE ON FUNCTION public.sf_claim_guest_voice_cleanup(integer) TO storyforge_app;
GRANT EXECUTE ON FUNCTION public.sf_complete_guest_voice_cleanup(uuid,boolean,text) TO storyforge_app;

COMMIT;
