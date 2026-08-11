\set ON_ERROR_STOP on

-- Migration: B1-514 Request a Story and bounded guest contributions.
-- Authority: DR-042 / DR-043; B1-513R/R2 guest and Postmark contracts.
-- Depends on: 20260810210000_b1_514_v2_r3_inspiration.sql

BEGIN;
SELECT pg_advisory_xact_lock(hashtextextended('b1-514-v2-ra-requests-guest', 0));

CREATE TABLE public.sf_contributor_prompts (
  id uuid PRIMARY KEY,
  library_key text NOT NULL UNIQUE CHECK (library_key ~ '^c-[0-9]{3}$'),
  relationship_ids text[] NOT NULL CHECK (cardinality(relationship_ids) BETWEEN 1 AND 13),
  text text NOT NULL CHECK (length(trim(text)) BETWEEN 10 AND 2000),
  hint text NOT NULL CHECK (length(trim(hint)) BETWEEN 3 AND 1000),
  state text NOT NULL DEFAULT 'active' CHECK (state IN ('active', 'retired')),
  sort_order integer NOT NULL CHECK (sort_order BETWEEN 1 AND 100000),
  row_version bigint NOT NULL DEFAULT 0 CHECK (row_version >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.sf_story_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.sf_users(id) ON DELETE RESTRICT,
  contributor_first_name text NOT NULL CHECK (length(trim(contributor_first_name)) BETWEEN 1 AND 100),
  relationship_id text NOT NULL CHECK (relationship_id ~ '^[a-z][a-z0-9_]{0,63}$'),
  email text NOT NULL CHECK (length(email) BETWEEN 3 AND 320),
  token_hash text UNIQUE CHECK (token_hash IS NULL OR token_hash ~ '^[a-f0-9]{64}$'),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft','sent','delivered','link_visited','started','story_shared','expired','revoked','bounced'
  )),
  personal_message text NOT NULL DEFAULT '' CHECK (length(personal_message) <= 2000),
  video_greeting_media_id uuid REFERENCES public.sf_story_media(id) ON DELETE RESTRICT,
  disclosure_version text NOT NULL CHECK (disclosure_version ~ '^[a-z0-9._-]{1,64}$'),
  provider_message_id text UNIQUE,
  bounce_reason text,
  reminders_sent integer NOT NULL DEFAULT 0 CHECK (reminders_sent BETWEEN 0 AND 2),
  row_version bigint NOT NULL DEFAULT 0 CHECK (row_version >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  delivered_at timestamptz,
  opened_at timestamptz,
  link_visited_at timestamptz,
  started_at timestamptz,
  contributed_at timestamptz,
  revoked_at timestamptz,
  bounced_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.sf_story_invitation_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  invitation_id uuid NOT NULL REFERENCES public.sf_story_invitations(id) ON DELETE RESTRICT,
  event_type text NOT NULL CHECK (event_type IN (
    'created','updated','sent','delivered','opened_approximate','link_visited','started',
    'story_shared','reminded','revoked','bounced','expired'
  )),
  provider_event_id text UNIQUE,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (
    jsonb_typeof(detail) = 'object'
    AND NOT (detail ?| ARRAY['email','token','transcript','body','message'])
  ),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.sf_story_contributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invitation_id uuid NOT NULL REFERENCES public.sf_story_invitations(id) ON DELETE RESTRICT,
  kind text NOT NULL CHECK (kind IN ('text','voice')),
  transcript text NOT NULL CHECK (length(trim(transcript)) BETWEEN 1 AND 20000),
  prompt_id uuid REFERENCES public.sf_contributor_prompts(id) ON DELETE RESTRICT,
  prompt_text_snapshot text NOT NULL CHECK (length(trim(prompt_text_snapshot)) BETWEEN 3 AND 2000),
  state text NOT NULL DEFAULT 'new' CHECK (state IN ('new','favorite','archived','promoted')),
  promoted_story_id uuid REFERENCES public.sf_stories(id) ON DELETE RESTRICT,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  promoted_at timestamptz,
  CHECK ((state = 'promoted') = (promoted_story_id IS NOT NULL))
);

CREATE TABLE public.sf_contribution_audio_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contribution_id uuid NOT NULL UNIQUE REFERENCES public.sf_story_contributions(id) ON DELETE RESTRICT,
  invitation_id uuid NOT NULL REFERENCES public.sf_story_invitations(id) ON DELETE RESTRICT,
  object_key text NOT NULL UNIQUE,
  content_type text NOT NULL CHECK (content_type IN ('audio/webm','audio/mp4','audio/ogg','audio/wav')),
  byte_size bigint NOT NULL CHECK (byte_size BETWEEN 1 AND 31457280),
  duration_ms integer NOT NULL CHECK (duration_ms BETWEEN 1 AND 1800000),
  checksum_sha256 text CHECK (checksum_sha256 IS NULL OR checksum_sha256 ~ '^[a-f0-9]{64}$'),
  state text NOT NULL DEFAULT 'verified' CHECK (state IN ('pending','verified','retired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  verified_at timestamptz,
  retired_at timestamptz
);

CREATE TABLE public.sf_guest_rate_limits (
  scope_hash text NOT NULL CHECK (scope_hash ~ '^[a-f0-9]{64}$'),
  bucket_started_at timestamptz NOT NULL,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (scope_hash, bucket_started_at)
);

CREATE INDEX sf_story_invitations_student_idx
  ON public.sf_story_invitations (student_id, created_at DESC, id DESC);
CREATE INDEX sf_story_invitations_token_idx
  ON public.sf_story_invitations (token_hash) WHERE token_hash IS NOT NULL;
CREATE INDEX sf_story_contributions_invitation_idx
  ON public.sf_story_contributions (invitation_id, submitted_at, id);

ALTER TABLE public.sf_contributor_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sf_contributor_prompts FORCE ROW LEVEL SECURITY;
ALTER TABLE public.sf_story_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sf_story_invitations FORCE ROW LEVEL SECURITY;
ALTER TABLE public.sf_story_invitation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sf_story_invitation_events FORCE ROW LEVEL SECURITY;
ALTER TABLE public.sf_story_contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sf_story_contributions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.sf_contribution_audio_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sf_contribution_audio_assets FORCE ROW LEVEL SECURITY;
ALTER TABLE public.sf_guest_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sf_guest_rate_limits FORCE ROW LEVEL SECURITY;

CREATE POLICY sf_contributor_prompts_service_read ON public.sf_contributor_prompts
FOR SELECT TO storyforge_app USING (state = 'active');
CREATE POLICY sf_contributor_prompts_student_read ON public.sf_contributor_prompts
FOR SELECT TO authenticated USING (
  state = 'active' AND public.sf_story_feature_enabled('request_a_story', ARRAY['student'])
);

CREATE POLICY sf_story_invitations_owner ON public.sf_story_invitations
FOR SELECT TO authenticated
USING (
  student_id = public.sf_actor_id()
  AND public.sf_story_feature_enabled('request_a_story', ARRAY['student'])
);
CREATE POLICY sf_story_invitations_service ON public.sf_story_invitations
FOR SELECT TO storyforge_app USING (true);

CREATE POLICY sf_story_invitation_events_owner_read ON public.sf_story_invitation_events
FOR SELECT TO authenticated USING (EXISTS (
  SELECT 1 FROM public.sf_story_invitations invitation
  WHERE invitation.id=invitation_id AND invitation.student_id=public.sf_actor_id()
));
CREATE POLICY sf_story_invitation_events_service_read ON public.sf_story_invitation_events
FOR SELECT TO storyforge_app USING (true);

CREATE POLICY sf_story_contributions_owner ON public.sf_story_contributions
FOR SELECT TO authenticated USING (EXISTS (
  SELECT 1 FROM public.sf_story_invitations invitation
  WHERE invitation.id=invitation_id AND invitation.student_id=public.sf_actor_id()
));
CREATE POLICY sf_story_contributions_service_read ON public.sf_story_contributions
FOR SELECT TO storyforge_app USING (true);

CREATE POLICY sf_contribution_audio_owner_read ON public.sf_contribution_audio_assets
FOR SELECT TO authenticated USING (EXISTS (
  SELECT 1 FROM public.sf_story_invitations invitation
  WHERE invitation.id=invitation_id AND invitation.student_id=public.sf_actor_id()
));
CREATE POLICY sf_contribution_audio_service_read ON public.sf_contribution_audio_assets
FOR SELECT TO storyforge_app USING (true);

REVOKE ALL ON public.sf_contributor_prompts FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.sf_story_invitations FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.sf_story_invitation_events FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.sf_story_contributions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.sf_contribution_audio_assets FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.sf_guest_rate_limits FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.sf_contributor_prompts TO authenticated, storyforge_app;
GRANT SELECT ON public.sf_story_invitations TO authenticated;
GRANT SELECT ON public.sf_story_invitation_events TO authenticated;
GRANT SELECT ON public.sf_story_contributions TO authenticated;
GRANT SELECT ON public.sf_contribution_audio_assets TO authenticated;
GRANT SELECT ON public.sf_story_invitations, public.sf_story_invitation_events,
  public.sf_story_contributions, public.sf_contribution_audio_assets,
  public.sf_guest_rate_limits TO storyforge_app;

CREATE OR REPLACE FUNCTION public.sf_request_assert_student()
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_actor uuid:=public.sf_actor_id();
BEGIN
  IF v_actor IS NULL OR public.sf_actor_role()<>'student'
     OR NOT public.sf_story_feature_enabled('request_a_story',ARRAY['student']) THEN
    RAISE EXCEPTION 'request a story disabled' USING ERRCODE='42501';
  END IF;
  RETURN v_actor;
END $$;

CREATE OR REPLACE FUNCTION public.sf_request_create(p_first text,p_relationship text,p_email text,p_message text,p_disclosure text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_actor uuid:=public.sf_request_assert_student(); v_row public.sf_story_invitations;
BEGIN
  INSERT INTO public.sf_story_invitations(student_id,contributor_first_name,relationship_id,email,personal_message,disclosure_version)
  VALUES(v_actor,p_first,p_relationship,p_email,p_message,p_disclosure) RETURNING * INTO v_row;
  INSERT INTO public.sf_story_invitation_events(invitation_id,event_type) VALUES(v_row.id,'created');
  RETURN to_jsonb(v_row);
END $$;

CREATE OR REPLACE FUNCTION public.sf_request_mark_sent(p_id uuid,p_expected bigint,p_token_hash text,p_provider_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_actor uuid:=public.sf_request_assert_student(); v_row public.sf_story_invitations;
BEGIN
  UPDATE public.sf_story_invitations SET token_hash=p_token_hash,status='sent',provider_message_id=p_provider_id,
    sent_at=now(),row_version=row_version+1,updated_at=now()
  WHERE id=p_id AND student_id=v_actor AND status='draft' AND row_version=p_expected RETURNING * INTO v_row;
  IF NOT FOUND THEN RAISE EXCEPTION 'invitation conflict' USING ERRCODE='40001'; END IF;
  INSERT INTO public.sf_story_invitation_events(invitation_id,event_type) VALUES(v_row.id,'sent');
  RETURN to_jsonb(v_row);
END $$;

CREATE OR REPLACE FUNCTION public.sf_request_revoke(p_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_actor uuid:=public.sf_request_assert_student(); v_row public.sf_story_invitations;
BEGIN
  UPDATE public.sf_story_invitations SET status='revoked',revoked_at=now(),token_hash=NULL,
    row_version=row_version+1,updated_at=now() WHERE id=p_id AND student_id=v_actor AND revoked_at IS NULL RETURNING * INTO v_row;
  IF NOT FOUND THEN RAISE EXCEPTION 'invitation not found' USING ERRCODE='P0002'; END IF;
  INSERT INTO public.sf_story_invitation_events(invitation_id,event_type) VALUES(v_row.id,'revoked');
  RETURN to_jsonb(v_row);
END $$;

CREATE OR REPLACE FUNCTION public.sf_request_set_contribution_state(p_id uuid,p_state text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_actor uuid:=public.sf_request_assert_student(); v_row public.sf_story_contributions;
BEGIN
  UPDATE public.sf_story_contributions c SET state=p_state,updated_at=now() FROM public.sf_story_invitations i
  WHERE c.id=p_id AND i.id=c.invitation_id AND i.student_id=v_actor AND c.state<>'promoted' RETURNING c.* INTO v_row;
  IF NOT FOUND THEN RAISE EXCEPTION 'contribution not found' USING ERRCODE='P0002'; END IF;
  RETURN jsonb_build_object('id',v_row.id,'state',v_row.state);
END $$;

CREATE OR REPLACE FUNCTION public.sf_request_promote(p_id uuid,p_title text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_actor uuid:=public.sf_request_assert_student(); v_contribution record; v_story record;
BEGIN
  SELECT c.*,i.contributor_first_name,i.relationship_id INTO v_contribution FROM public.sf_story_contributions c
  JOIN public.sf_story_invitations i ON i.id=c.invitation_id WHERE c.id=p_id AND i.student_id=v_actor FOR UPDATE OF c;
  IF NOT FOUND THEN RAISE EXCEPTION 'contribution not found' USING ERRCODE='P0002'; END IF;
  IF v_contribution.state='promoted' THEN RETURN jsonb_build_object('storyId',v_contribution.promoted_story_id,'existing',true); END IF;
  SELECT * INTO v_story FROM public.sf_create_story_v5(jsonb_build_object('title',p_title,'text',v_contribution.transcript,'captureType','imported','prefixEnabled',false),'library');
  UPDATE public.sf_stories SET visibility='private',visibility_changed_at=NULL,
    origin=jsonb_build_object('type','contribution','contributionId',v_contribution.id::text,'relationship',v_contribution.relationship_id,'contributorFirstName',v_contribution.contributor_first_name),updated_at=now() WHERE id=v_story.id;
  UPDATE public.sf_story_contributions SET state='promoted',promoted_story_id=v_story.id,promoted_at=now(),updated_at=now() WHERE id=v_contribution.id;
  INSERT INTO public.sf_authored_segments(story_id,source_role,source_entity_type,source_entity_id,body_hash,author_id)
  VALUES(v_story.id,'guest_contributor','contribution',v_contribution.id,encode(digest(convert_to(v_contribution.transcript,'UTF8'),'sha256'),'hex'),v_actor);
  RETURN jsonb_build_object('storyId',v_story.id,'existing',false,'visibility','private');
END $$;

CREATE OR REPLACE FUNCTION public.sf_guest_rate_hit(p_scope_hash text,p_bucket timestamptz)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_attempts integer;
BEGIN
  INSERT INTO public.sf_guest_rate_limits(scope_hash,bucket_started_at,attempts) VALUES(p_scope_hash,p_bucket,1)
  ON CONFLICT(scope_hash,bucket_started_at) DO UPDATE SET attempts=sf_guest_rate_limits.attempts+1,updated_at=now() RETURNING attempts INTO v_attempts;
  RETURN v_attempts;
END $$;

CREATE OR REPLACE FUNCTION public.sf_guest_mark_visited(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  UPDATE public.sf_story_invitations SET link_visited_at=coalesce(link_visited_at,now()),status=CASE WHEN status IN('sent','delivered') THEN 'link_visited' ELSE status END,updated_at=now() WHERE id=p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'invitation not found' USING ERRCODE='P0002'; END IF;
  INSERT INTO public.sf_story_invitation_events(invitation_id,event_type) SELECT p_id,'link_visited'
  WHERE NOT EXISTS(SELECT 1 FROM public.sf_story_invitation_events WHERE invitation_id=p_id AND event_type='link_visited');
END $$;

CREATE OR REPLACE FUNCTION public.sf_guest_contribute(p_invitation uuid,p_kind text,p_transcript text,p_prompt uuid,p_snapshot text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_row public.sf_story_contributions;
BEGIN
  IF (SELECT count(*) FROM public.sf_story_contributions WHERE invitation_id=p_invitation)>=3 THEN RAISE EXCEPTION 'invitation complete' USING ERRCODE='P0003'; END IF;
  INSERT INTO public.sf_story_contributions(invitation_id,kind,transcript,prompt_id,prompt_text_snapshot)
  VALUES(p_invitation,p_kind,p_transcript,p_prompt,p_snapshot) RETURNING * INTO v_row;
  UPDATE public.sf_story_invitations SET status='story_shared',started_at=coalesce(started_at,now()),contributed_at=now(),updated_at=now() WHERE id=p_invitation;
  INSERT INTO public.sf_story_invitation_events(invitation_id,event_type) VALUES(p_invitation,'story_shared');
  RETURN jsonb_build_object('id',v_row.id,'kind',v_row.kind,'state',v_row.state,'submitted_at',v_row.submitted_at);
END $$;

CREATE OR REPLACE FUNCTION public.sf_request_provider_event(p_message_id text,p_type text,p_event_id text,p_occurred timestamptz,p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_invitation public.sf_story_invitations; v_inserted bigint;
BEGIN
  SELECT * INTO v_invitation FROM public.sf_story_invitations WHERE provider_message_id=p_message_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('accepted',true); END IF;
  INSERT INTO public.sf_story_invitation_events(invitation_id,event_type,provider_event_id,detail,created_at)
  VALUES(v_invitation.id,p_type,p_event_id,'{}',p_occurred) ON CONFLICT(provider_event_id) DO NOTHING RETURNING id INTO v_inserted;
  IF v_inserted IS NULL THEN RETURN jsonb_build_object('accepted',true,'duplicate',true); END IF;
  IF p_type='delivered' THEN UPDATE public.sf_story_invitations SET delivered_at=coalesce(delivered_at,p_occurred),status=CASE WHEN status='sent' THEN 'delivered' ELSE status END,updated_at=now() WHERE id=v_invitation.id;
  ELSIF p_type='opened_approximate' THEN UPDATE public.sf_story_invitations SET opened_at=coalesce(opened_at,p_occurred),updated_at=now() WHERE id=v_invitation.id;
  ELSE UPDATE public.sf_story_invitations SET bounced_at=coalesce(bounced_at,p_occurred),bounce_reason=coalesce(bounce_reason,p_reason),status=CASE WHEN status IN('sent','delivered') THEN 'bounced' ELSE status END,updated_at=now() WHERE id=v_invitation.id; END IF;
  RETURN jsonb_build_object('accepted',true);
END $$;

REVOKE ALL ON FUNCTION public.sf_request_assert_student() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sf_request_create(text,text,text,text,text), public.sf_request_mark_sent(uuid,bigint,text,text), public.sf_request_revoke(uuid), public.sf_request_set_contribution_state(uuid,text), public.sf_request_promote(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sf_request_create(text,text,text,text,text), public.sf_request_mark_sent(uuid,bigint,text,text), public.sf_request_revoke(uuid), public.sf_request_set_contribution_state(uuid,text), public.sf_request_promote(uuid,text) TO authenticated;
REVOKE ALL ON FUNCTION public.sf_guest_rate_hit(text,timestamptz), public.sf_guest_mark_visited(uuid), public.sf_guest_contribute(uuid,text,text,uuid,text), public.sf_request_provider_event(text,text,text,timestamptz,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sf_guest_rate_hit(text,timestamptz), public.sf_guest_mark_visited(uuid), public.sf_guest_contribute(uuid,text,text,uuid,text), public.sf_request_provider_event(text,text,text,timestamptz,text) TO storyforge_app;

INSERT INTO public.sf_feature_flags (key, scope, allowlist, cohorts, updated_by)
SELECT feature.key, 'off', ARRAY[]::uuid[], ARRAY[]::text[], founder.updated_by
FROM (VALUES ('request_a_story'), ('guest_contributions')) AS feature(key)
CROSS JOIN (SELECT updated_by FROM public.sf_feature_flags WHERE key='admin_console') founder;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.sf_story_invitations)
    OR EXISTS (SELECT 1 FROM public.sf_story_contributions)
    OR EXISTS (SELECT 1 FROM public.sf_contribution_audio_assets) THEN
    RAISE EXCEPTION 'B1-514 Request-a-Story private tables must begin empty';
  END IF;
END
$$;

COMMIT;
