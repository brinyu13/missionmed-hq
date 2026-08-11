\set ON_ERROR_STOP on

-- Migration: B1-514 Request-a-Story guest voice capture.
-- Token-scoped, prospective-only, private by default, and bounded by the
-- existing Request-a-Story, guest-contribution, and voice feature flags.

BEGIN;
SELECT pg_advisory_xact_lock(hashtextextended('b1-514-guest-voice-contributions', 0));

ALTER TABLE public.sf_story_contributions
  ADD COLUMN submission_hash text CHECK (
    submission_hash IS NULL OR submission_hash ~ '^[a-f0-9]{64}$'
  );

CREATE UNIQUE INDEX sf_story_contributions_idempotency_idx
  ON public.sf_story_contributions (invitation_id, submission_hash)
  WHERE submission_hash IS NOT NULL;

CREATE TABLE public.sf_guest_voice_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invitation_id uuid NOT NULL REFERENCES public.sf_story_invitations(id) ON DELETE RESTRICT,
  student_id uuid NOT NULL REFERENCES public.sf_users(id) ON DELETE RESTRICT,
  state text NOT NULL DEFAULT 'recording' CHECK (state IN (
    'recording','finishing','contributed','cancelled','failed'
  )),
  mime_type text CHECK (mime_type IS NULL OR mime_type IN (
    'audio/webm','audio/mp4','audio/ogg','audio/wav'
  )),
  total_duration_ms integer NOT NULL DEFAULT 0 CHECK (total_duration_ms BETWEEN 0 AND 1800000),
  total_byte_size bigint NOT NULL DEFAULT 0 CHECK (total_byte_size BETWEEN 0 AND 31457280),
  segment_count integer NOT NULL DEFAULT 0 CHECK (segment_count BETWEEN 0 AND 200),
  prompt_id uuid REFERENCES public.sf_contributor_prompts(id) ON DELETE RESTRICT,
  prompt_text_snapshot text CHECK (
    prompt_text_snapshot IS NULL OR length(trim(prompt_text_snapshot)) BETWEEN 3 AND 2000
  ),
  provider_transcript text CHECK (
    provider_transcript IS NULL OR length(trim(provider_transcript)) BETWEEN 1 AND 20000
  ),
  contribution_id uuid UNIQUE REFERENCES public.sf_story_contributions(id) ON DELETE RESTRICT,
  purged_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  CHECK ((state = 'contributed') = (contribution_id IS NOT NULL)),
  CHECK ((state = 'contributed') = (finished_at IS NOT NULL)),
  CHECK ((prompt_id IS NULL) = (prompt_text_snapshot IS NULL)),
  CHECK ((prompt_id IS NULL) = (provider_transcript IS NULL))
);

CREATE UNIQUE INDEX sf_guest_voice_one_active_invitation_idx
  ON public.sf_guest_voice_sessions (invitation_id)
  WHERE state IN ('recording','finishing');

CREATE TABLE public.sf_guest_voice_segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.sf_guest_voice_sessions(id) ON DELETE RESTRICT,
  seq integer NOT NULL CHECK (seq BETWEEN 0 AND 199),
  object_key text NOT NULL UNIQUE CHECK (
    object_key ~ '^storyforge-rec/[a-f0-9-]{36}/[a-f0-9-]{36}/seg-[0-9]{5}\.(webm|m4a|ogg|wav)$'
  ),
  mime_type text NOT NULL CHECK (mime_type IN ('audio/webm','audio/mp4','audio/ogg','audio/wav')),
  byte_size integer NOT NULL CHECK (byte_size BETWEEN 1 AND 5242880),
  duration_ms integer NOT NULL CHECK (duration_ms BETWEEN 1 AND 60000),
  transcribe_state text NOT NULL DEFAULT 'uploading' CHECK (transcribe_state IN (
    'uploading','received','transcribing','transcribed','transcribe_failed'
  )),
  transcript text CHECK (transcript IS NULL OR length(transcript) <= 10000),
  provider_id text CHECK (provider_id IS NULL OR length(provider_id) <= 100),
  model_id text CHECK (model_id IS NULL OR length(model_id) <= 100),
  retry_count integer NOT NULL DEFAULT 0 CHECK (retry_count BETWEEN 0 AND 3),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, seq)
);

CREATE TABLE public.sf_guest_voice_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES public.sf_guest_voice_sessions(id) ON DELETE RESTRICT,
  event_type text NOT NULL CHECK (event_type IN (
    'recording_started','segment_received','segment_transcribed',
    'segment_transcribe_failed','recording_finished','recording_cancelled','storage_purged'
  )),
  seq integer CHECK (seq IS NULL OR seq BETWEEN 0 AND 199),
  detail jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (
    jsonb_typeof(detail) = 'object'
    AND NOT (detail ?| ARRAY['token','email','transcript','body','message','object_key'])
  ),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.sf_forbid_guest_voice_event_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'guest voice events are append-only' USING ERRCODE='42501';
END $$;

CREATE TRIGGER sf_guest_voice_events_append_only
BEFORE UPDATE OR DELETE ON public.sf_guest_voice_events
FOR EACH ROW EXECUTE FUNCTION public.sf_forbid_guest_voice_event_mutation();

ALTER TABLE public.sf_guest_voice_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sf_guest_voice_sessions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.sf_guest_voice_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sf_guest_voice_segments FORCE ROW LEVEL SECURITY;
ALTER TABLE public.sf_guest_voice_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sf_guest_voice_events FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.sf_guest_voice_sessions, public.sf_guest_voice_segments,
  public.sf_guest_voice_events FROM PUBLIC, anon, authenticated, storyforge_app;

CREATE OR REPLACE FUNCTION public.sf_guest_feature_enabled_for_student(
  p_key text,
  p_student_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path=public,pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.sf_feature_flags flag
    JOIN public.sf_users student ON student.id=p_student_id
    WHERE flag.key=p_key
      AND student.role='student'
      AND student.eligible
      AND (
        flag.scope='eligible_all'
        OR (flag.scope='allowlist' AND student.id=ANY(flag.allowlist))
        OR (flag.scope='cohort' AND student.cohort IS NOT NULL AND student.cohort=ANY(flag.cohorts))
      )
  )
$$;

CREATE OR REPLACE FUNCTION public.sf_guest_voice_assert_invitation(p_token_hash text)
RETURNS public.sf_story_invitations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public,pg_temp
AS $$
DECLARE v_invitation public.sf_story_invitations;
BEGIN
  IF p_token_hash !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'invitation not found' USING ERRCODE='P0002';
  END IF;
  SELECT invitation.* INTO v_invitation
  FROM public.sf_story_invitations invitation
  WHERE invitation.token_hash=p_token_hash
    AND invitation.status IN ('sent','delivered','link_visited','started','story_shared')
    AND invitation.expires_at>now()
    AND invitation.revoked_at IS NULL
    AND invitation.suppressed_at IS NULL
  FOR SHARE;
  IF NOT FOUND
    OR NOT public.sf_guest_feature_enabled_for_student('request_a_story',v_invitation.student_id)
    OR NOT public.sf_guest_feature_enabled_for_student('guest_contributions',v_invitation.student_id)
    OR NOT public.sf_guest_feature_enabled_for_student('voice_capture',v_invitation.student_id) THEN
    RAISE EXCEPTION 'invitation not found' USING ERRCODE='P0002';
  END IF;
  RETURN v_invitation;
END $$;

CREATE OR REPLACE FUNCTION public.sf_guest_voice_open(p_token_hash text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_invitation public.sf_story_invitations; v_session public.sf_guest_voice_sessions;
BEGIN
  v_invitation:=public.sf_guest_voice_assert_invitation(p_token_hash);
  SELECT invitation.* INTO v_invitation FROM public.sf_story_invitations invitation
  WHERE invitation.id=v_invitation.id AND invitation.token_hash=p_token_hash
    AND invitation.status IN ('sent','delivered','link_visited','started','story_shared')
    AND invitation.expires_at>now() AND invitation.revoked_at IS NULL
    AND invitation.suppressed_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'invitation not found' USING ERRCODE='P0002'; END IF;
  SELECT * INTO v_session FROM public.sf_guest_voice_sessions
  WHERE invitation_id=v_invitation.id AND state IN ('recording','finishing')
  ORDER BY created_at LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO public.sf_guest_voice_sessions(invitation_id,student_id)
    VALUES(v_invitation.id,v_invitation.student_id) RETURNING * INTO v_session;
    INSERT INTO public.sf_guest_voice_events(session_id,event_type)
    VALUES(v_session.id,'recording_started');
  END IF;
  PERFORM public.sf_guest_mark_started(v_invitation.id);
  RETURN jsonb_build_object(
    'recordingId',v_session.id,'invitationId',v_session.invitation_id,
    'studentId',v_session.student_id,'state',v_session.state,
    'createdAt',v_session.created_at
  );
END $$;

CREATE OR REPLACE FUNCTION public.sf_guest_voice_status(p_token_hash text,p_session_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_invitation public.sf_story_invitations; v_session public.sf_guest_voice_sessions;
BEGIN
  v_invitation:=public.sf_guest_voice_assert_invitation(p_token_hash);
  SELECT * INTO v_session FROM public.sf_guest_voice_sessions
  WHERE id=p_session_id AND invitation_id=v_invitation.id;
  IF NOT FOUND THEN RAISE EXCEPTION 'recording not found' USING ERRCODE='P0002'; END IF;
  RETURN jsonb_build_object(
    'recordingId',v_session.id,'invitationId',v_session.invitation_id,
    'studentId',v_session.student_id,'state',v_session.state,
    'mimeType',v_session.mime_type,'totalDurationMs',v_session.total_duration_ms,
    'totalByteSize',v_session.total_byte_size,'segmentCount',v_session.segment_count,
    'promptId',v_session.prompt_id,
    'providerTranscript',v_session.provider_transcript,
    'contributionId',v_session.contribution_id,
    'segments',coalesce((SELECT jsonb_agg(jsonb_build_object(
      'seq',segment.seq,'transcribeState',segment.transcribe_state,
      'transcript',coalesce(segment.transcript,''),'retryCount',segment.retry_count
    ) ORDER BY segment.seq) FROM public.sf_guest_voice_segments segment
    WHERE segment.session_id=v_session.id),'[]'::jsonb)
  );
END $$;

CREATE OR REPLACE FUNCTION public.sf_guest_voice_reserve_segment(
  p_token_hash text,p_session_id uuid,p_seq integer,p_object_key text,
  p_mime_type text,p_byte_size integer,p_duration_ms integer
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_invitation public.sf_story_invitations; v_session public.sf_guest_voice_sessions;
  v_extension text; v_expected_key text;
BEGIN
  v_invitation:=public.sf_guest_voice_assert_invitation(p_token_hash);
  SELECT * INTO v_session FROM public.sf_guest_voice_sessions
  WHERE id=p_session_id AND invitation_id=v_invitation.id AND state='recording' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'recording not found' USING ERRCODE='P0002'; END IF;
  IF p_seq<>v_session.segment_count OR p_seq NOT BETWEEN 0 AND 199
    OR p_byte_size NOT BETWEEN 1 AND 5242880
    OR p_duration_ms NOT BETWEEN 1 AND 60000
    OR p_mime_type NOT IN ('audio/webm','audio/mp4','audio/ogg','audio/wav')
    OR (v_session.mime_type IS NOT NULL AND v_session.mime_type<>p_mime_type)
    OR v_session.total_byte_size+p_byte_size>31457280
    OR v_session.total_duration_ms+p_duration_ms>1800000 THEN
    RAISE EXCEPTION 'recording segment is invalid' USING ERRCODE='22023';
  END IF;
  v_extension:=CASE p_mime_type WHEN 'audio/webm' THEN 'webm' WHEN 'audio/mp4' THEN 'm4a'
    WHEN 'audio/ogg' THEN 'ogg' WHEN 'audio/wav' THEN 'wav' END;
  v_expected_key:='storyforge-rec/'||v_session.student_id||'/'||v_session.id||'/seg-'||
    lpad(p_seq::text,5,'0')||'.'||v_extension;
  IF p_object_key<>v_expected_key THEN
    RAISE EXCEPTION 'recording object key is invalid' USING ERRCODE='22023';
  END IF;
  INSERT INTO public.sf_guest_voice_segments(
    session_id,seq,object_key,mime_type,byte_size,duration_ms
  ) VALUES(v_session.id,p_seq,p_object_key,p_mime_type,p_byte_size,p_duration_ms);
  UPDATE public.sf_guest_voice_sessions SET mime_type=coalesce(mime_type,p_mime_type),
    total_byte_size=total_byte_size+p_byte_size,total_duration_ms=total_duration_ms+p_duration_ms,
    segment_count=segment_count+1,updated_at=now() WHERE id=v_session.id;
  RETURN jsonb_build_object('recordingId',v_session.id,'seq',p_seq,'objectKey',p_object_key);
END $$;

CREATE OR REPLACE FUNCTION public.sf_guest_voice_confirm_segment(
  p_token_hash text,p_session_id uuid,p_seq integer
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_invitation public.sf_story_invitations; v_segment public.sf_guest_voice_segments;
BEGIN
  v_invitation:=public.sf_guest_voice_assert_invitation(p_token_hash);
  UPDATE public.sf_guest_voice_segments segment SET transcribe_state='received',updated_at=now()
  FROM public.sf_guest_voice_sessions session
  WHERE segment.session_id=session.id AND session.id=p_session_id
    AND session.invitation_id=v_invitation.id AND segment.seq=p_seq
    AND segment.transcribe_state='uploading' RETURNING segment.* INTO v_segment;
  IF NOT FOUND THEN RAISE EXCEPTION 'recording segment not found' USING ERRCODE='P0002'; END IF;
  INSERT INTO public.sf_guest_voice_events(session_id,event_type,seq)
  VALUES(p_session_id,'segment_received',p_seq);
  RETURN jsonb_build_object('recordingId',p_session_id,'seq',p_seq,'state','received');
END $$;

CREATE OR REPLACE FUNCTION public.sf_guest_voice_claim_transcription(
  p_token_hash text,p_session_id uuid,p_seq integer
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_invitation public.sf_story_invitations; v_segment public.sf_guest_voice_segments;
  v_session public.sf_guest_voice_sessions; v_tail text;
BEGIN
  v_invitation:=public.sf_guest_voice_assert_invitation(p_token_hash);
  SELECT * INTO v_session FROM public.sf_guest_voice_sessions
  WHERE id=p_session_id AND invitation_id=v_invitation.id AND state IN ('recording','finishing');
  IF NOT FOUND THEN RETURN NULL; END IF;
  UPDATE public.sf_guest_voice_segments SET transcribe_state='transcribing',
    retry_count=retry_count+CASE WHEN transcribe_state='transcribe_failed' THEN 1 ELSE 0 END,
    updated_at=now() WHERE session_id=p_session_id AND seq=p_seq
    AND transcribe_state IN ('received','transcribe_failed') AND retry_count<3
    RETURNING * INTO v_segment;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT transcript INTO v_tail FROM public.sf_guest_voice_segments
  WHERE session_id=p_session_id AND seq<p_seq AND transcribe_state='transcribed'
  ORDER BY seq DESC LIMIT 1;
  RETURN jsonb_build_object(
    'recordingId',p_session_id,'studentId',v_session.student_id,'seq',v_segment.seq,
    'objectKey',v_segment.object_key,'mimeType',v_segment.mime_type,
    'promptTail',coalesce(v_tail,'')
  );
END $$;

CREATE OR REPLACE FUNCTION public.sf_guest_voice_complete_transcription(
  p_token_hash text,p_session_id uuid,p_seq integer,p_transcript text,
  p_provider_id text,p_model_id text
)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_invitation public.sf_story_invitations;
BEGIN
  v_invitation:=public.sf_guest_voice_assert_invitation(p_token_hash);
  IF length(coalesce(p_transcript,''))>10000 OR length(coalesce(p_provider_id,''))>100
    OR length(coalesce(p_model_id,''))>100 THEN
    RAISE EXCEPTION 'transcription result is invalid' USING ERRCODE='22023';
  END IF;
  UPDATE public.sf_guest_voice_segments segment SET transcribe_state='transcribed',
    transcript=coalesce(p_transcript,''),provider_id=nullif(p_provider_id,''),
    model_id=nullif(p_model_id,''),updated_at=now()
  FROM public.sf_guest_voice_sessions session
  WHERE segment.session_id=session.id AND session.id=p_session_id
    AND session.invitation_id=v_invitation.id AND segment.seq=p_seq
    AND segment.transcribe_state='transcribing';
  IF NOT FOUND THEN RETURN false; END IF;
  INSERT INTO public.sf_guest_voice_events(session_id,event_type,seq)
  VALUES(p_session_id,'segment_transcribed',p_seq);
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.sf_guest_voice_fail_transcription(
  p_token_hash text,p_session_id uuid,p_seq integer,p_code text
)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_invitation public.sf_story_invitations;
BEGIN
  v_invitation:=public.sf_guest_voice_assert_invitation(p_token_hash);
  UPDATE public.sf_guest_voice_segments segment SET transcribe_state='transcribe_failed',updated_at=now()
  FROM public.sf_guest_voice_sessions session
  WHERE segment.session_id=session.id AND session.id=p_session_id
    AND session.invitation_id=v_invitation.id AND segment.seq=p_seq
    AND segment.transcribe_state='transcribing';
  IF NOT FOUND THEN RETURN false; END IF;
  INSERT INTO public.sf_guest_voice_events(session_id,event_type,seq,detail)
  VALUES(p_session_id,'segment_transcribe_failed',p_seq,
    jsonb_build_object('code',CASE WHEN p_code IN ('transcribe_unavailable','transcribe_timeout',
      'transcribe_rejected_format','transcribe_failed_permanent') THEN p_code ELSE 'transcribe_unavailable' END));
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.sf_guest_voice_prepare_finish(
  p_token_hash text,p_session_id uuid,p_prompt_id uuid
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_invitation public.sf_story_invitations; v_session public.sf_guest_voice_sessions;
  v_prompt public.sf_contributor_prompts; v_transcript text;
BEGIN
  v_invitation:=public.sf_guest_voice_assert_invitation(p_token_hash);
  SELECT * INTO v_session FROM public.sf_guest_voice_sessions
  WHERE id=p_session_id AND invitation_id=v_invitation.id AND state IN ('recording','finishing') FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'recording not found' USING ERRCODE='P0002'; END IF;
  IF v_session.segment_count<1 OR EXISTS(
    SELECT 1 FROM public.sf_guest_voice_segments WHERE session_id=v_session.id
      AND transcribe_state<>'transcribed'
  ) THEN RAISE EXCEPTION 'recording is still being prepared' USING ERRCODE='55000'; END IF;
  SELECT string_agg(trim(segment.transcript),' ' ORDER BY segment.seq) INTO v_transcript
  FROM public.sf_guest_voice_segments segment WHERE segment.session_id=v_session.id;
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
  UPDATE public.sf_guest_voice_sessions SET state='finishing',prompt_id=v_prompt.id,
    prompt_text_snapshot=v_prompt.text,provider_transcript=v_transcript,updated_at=now()
  WHERE id=v_session.id RETURNING * INTO v_session;
  RETURN jsonb_build_object(
    'recordingId',v_session.id,'invitationId',v_session.invitation_id,
    'studentId',v_session.student_id,'mimeType',v_session.mime_type,
    'durationMs',v_session.total_duration_ms,'byteSize',v_session.total_byte_size,
    'segmentCount',v_session.segment_count,'providerTranscript',v_session.provider_transcript,
    'promptId',v_session.prompt_id,'promptTextSnapshot',v_session.prompt_text_snapshot
  );
END $$;

CREATE OR REPLACE FUNCTION public.sf_guest_voice_assembly_manifest(p_session_id uuid)
RETURNS TABLE(seq integer,mime_type text,object_key text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT segment.seq,segment.mime_type,segment.object_key
  FROM public.sf_guest_voice_segments segment
  JOIN public.sf_guest_voice_sessions session ON session.id=segment.session_id
  WHERE session.id=p_session_id AND session.state='finishing'
  ORDER BY segment.seq
$$;

CREATE OR REPLACE FUNCTION public.sf_guest_voice_complete(
  p_token_hash text,p_session_id uuid,p_contribution_id uuid,p_asset_id uuid,
  p_transcript text,p_object_key text,p_content_type text,p_byte_size bigint,
  p_duration_ms integer,p_checksum_sha256 text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_invitation public.sf_story_invitations; v_session public.sf_guest_voice_sessions;
  v_contribution public.sf_story_contributions; v_expected_key text; v_extension text;
  v_submission_hash text;
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
    RETURN jsonb_build_object('contributionId',v_session.contribution_id,'existing',true);
  END IF;
  IF v_session.state<>'finishing' OR length(trim(coalesce(p_transcript,''))) NOT BETWEEN 1 AND 20000
    OR p_content_type IS DISTINCT FROM v_session.mime_type
    OR p_byte_size NOT BETWEEN 1 AND 31457280
    OR p_duration_ms<>v_session.total_duration_ms
    OR p_checksum_sha256 !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'voice contribution is invalid' USING ERRCODE='22023';
  END IF;
  v_extension:=CASE p_content_type WHEN 'audio/webm' THEN 'webm' WHEN 'audio/mp4' THEN 'm4a'
    WHEN 'audio/ogg' THEN 'ogg' WHEN 'audio/wav' THEN 'wav' END;
  v_expected_key:='storyforge-contribution-audio/'||v_session.student_id||'/'||
    v_session.invitation_id||'/'||p_contribution_id||'/'||p_asset_id||'.'||v_extension;
  IF p_object_key<>v_expected_key THEN
    RAISE EXCEPTION 'voice contribution object key is invalid' USING ERRCODE='22023';
  END IF;
  v_submission_hash:=encode(digest(convert_to(jsonb_build_array(
    'voice',v_session.id,p_transcript,v_session.prompt_id
  )::text,'UTF8'),'sha256'),'hex');
  SELECT * INTO v_contribution FROM public.sf_story_contributions
  WHERE invitation_id=v_session.invitation_id AND submission_hash=v_submission_hash;
  IF FOUND THEN
    RETURN jsonb_build_object('contributionId',v_contribution.id,'existing',true);
  END IF;
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
  RETURN jsonb_build_object('recordingId',v_session.id,'studentId',v_session.student_id,
    'state',v_session.state);
END $$;

-- Text contributions remain on the established function. A voice-shaped row
-- cannot be created without verified private audio through sf_guest_voice_complete.
CREATE OR REPLACE FUNCTION public.sf_guest_contribute(
  p_invitation uuid,p_kind text,p_transcript text,p_prompt uuid,p_snapshot text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_row public.sf_story_contributions; v_invitation public.sf_story_invitations;
  v_prompt public.sf_contributor_prompts; v_submission_hash text;
BEGIN
  IF p_kind<>'text' OR length(trim(coalesce(p_transcript,''))) NOT BETWEEN 1 AND 20000 THEN
    RAISE EXCEPTION 'voice contribution requires verified audio' USING ERRCODE='42501';
  END IF;
  SELECT invitation.* INTO v_invitation FROM public.sf_story_invitations invitation
  WHERE invitation.id=p_invitation
    AND invitation.status IN ('sent','delivered','link_visited','started','story_shared')
    AND invitation.token_hash IS NOT NULL AND invitation.expires_at>now()
    AND invitation.revoked_at IS NULL AND invitation.suppressed_at IS NULL
  FOR UPDATE;
  IF NOT FOUND
    OR NOT public.sf_guest_feature_enabled_for_student('request_a_story',v_invitation.student_id)
    OR NOT public.sf_guest_feature_enabled_for_student('guest_contributions',v_invitation.student_id) THEN
    RAISE EXCEPTION 'invitation not found' USING ERRCODE='P0002';
  END IF;
  SELECT * INTO v_prompt FROM public.sf_contributor_prompts
  WHERE id=p_prompt AND state='active'
    AND v_invitation.relationship_id=ANY(relationship_ids);
  IF NOT FOUND OR p_snapshot IS DISTINCT FROM v_prompt.text THEN
    RAISE EXCEPTION 'prompt not found' USING ERRCODE='P0002';
  END IF;
  v_submission_hash:=encode(digest(convert_to(jsonb_build_array(
    'text',trim(p_transcript),p_prompt,v_prompt.text
  )::text,'UTF8'),'sha256'),'hex');
  SELECT * INTO v_row FROM public.sf_story_contributions
  WHERE invitation_id=p_invitation AND submission_hash=v_submission_hash;
  IF FOUND THEN
    RETURN jsonb_build_object('id',v_row.id,'kind',v_row.kind,'state',v_row.state,
      'submitted_at',v_row.submitted_at,'existing',true);
  END IF;
  IF (SELECT count(*) FROM public.sf_story_contributions WHERE invitation_id=p_invitation)>=3 THEN
    RAISE EXCEPTION 'invitation complete' USING ERRCODE='P0003';
  END IF;
  INSERT INTO public.sf_story_contributions(
    invitation_id,kind,transcript,prompt_id,prompt_text_snapshot,submission_hash
  ) VALUES(p_invitation,'text',trim(p_transcript),p_prompt,v_prompt.text,v_submission_hash)
  RETURNING * INTO v_row;
  UPDATE public.sf_story_invitations SET status='story_shared',started_at=coalesce(started_at,now()),
    contributed_at=now(),updated_at=now() WHERE id=p_invitation;
  INSERT INTO public.sf_story_invitation_events(invitation_id,event_type)
  VALUES(p_invitation,'story_shared');
  RETURN jsonb_build_object('id',v_row.id,'kind',v_row.kind,'state',v_row.state,
    'submitted_at',v_row.submitted_at,'existing',false);
END $$;

CREATE OR REPLACE FUNCTION public.sf_contribution_audio_playback_claim(p_contribution_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_audio public.sf_contribution_audio_assets;
BEGIN
  IF public.sf_actor_role()<>'student' OR NOT public.sf_has_live_identity()
    OR NOT public.sf_story_feature_enabled('request_a_story',ARRAY['student']) THEN
    RAISE EXCEPTION 'contribution audio not found' USING ERRCODE='P0002';
  END IF;
  SELECT audio.* INTO v_audio
  FROM public.sf_contribution_audio_assets audio
  JOIN public.sf_story_invitations invitation ON invitation.id=audio.invitation_id
  WHERE audio.contribution_id=p_contribution_id
    AND audio.state='verified'
    AND invitation.student_id=public.sf_actor_id();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'contribution audio not found' USING ERRCODE='P0002';
  END IF;
  RETURN jsonb_build_object(
    'assetId',v_audio.id,'contributionId',v_audio.contribution_id,
    'objectKey',v_audio.object_key,'contentType',v_audio.content_type,
    'durationMs',v_audio.duration_ms,'byteSize',v_audio.byte_size
  );
END $$;

REVOKE ALL ON FUNCTION public.sf_guest_feature_enabled_for_student(text,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.sf_guest_voice_assert_invitation(text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.sf_guest_voice_open(text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.sf_guest_voice_status(text,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.sf_guest_voice_reserve_segment(text,uuid,integer,text,text,integer,integer) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.sf_guest_voice_confirm_segment(text,uuid,integer) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.sf_guest_voice_claim_transcription(text,uuid,integer) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.sf_guest_voice_complete_transcription(text,uuid,integer,text,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.sf_guest_voice_fail_transcription(text,uuid,integer,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.sf_guest_voice_prepare_finish(text,uuid,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.sf_guest_voice_assembly_manifest(uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.sf_guest_voice_complete(text,uuid,uuid,uuid,text,text,text,bigint,integer,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.sf_guest_voice_cancel(text,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.sf_contribution_audio_playback_claim(uuid) FROM PUBLIC,anon,authenticated;

GRANT EXECUTE ON FUNCTION public.sf_guest_voice_open(text),
  public.sf_guest_voice_status(text,uuid),
  public.sf_guest_voice_reserve_segment(text,uuid,integer,text,text,integer,integer),
  public.sf_guest_voice_confirm_segment(text,uuid,integer),
  public.sf_guest_voice_claim_transcription(text,uuid,integer),
  public.sf_guest_voice_complete_transcription(text,uuid,integer,text,text,text),
  public.sf_guest_voice_fail_transcription(text,uuid,integer,text),
  public.sf_guest_voice_prepare_finish(text,uuid,uuid),
  public.sf_guest_voice_assembly_manifest(uuid),
  public.sf_guest_voice_complete(text,uuid,uuid,uuid,text,text,text,bigint,integer,text),
  public.sf_guest_voice_cancel(text,uuid)
TO storyforge_app;

GRANT EXECUTE ON FUNCTION public.sf_contribution_audio_playback_claim(uuid) TO authenticated;

COMMIT;
