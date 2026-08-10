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
FOR ALL TO authenticated
USING (
  student_id = public.sf_actor_id()
  AND public.sf_story_feature_enabled('request_a_story', ARRAY['student'])
)
WITH CHECK (
  student_id = public.sf_actor_id()
  AND public.sf_story_feature_enabled('request_a_story', ARRAY['student'])
);
CREATE POLICY sf_story_invitations_service ON public.sf_story_invitations
FOR SELECT TO storyforge_app USING (true);
CREATE POLICY sf_story_invitations_service_update ON public.sf_story_invitations
FOR UPDATE TO storyforge_app USING (true) WITH CHECK (true);

CREATE POLICY sf_story_invitation_events_owner_read ON public.sf_story_invitation_events
FOR SELECT TO authenticated USING (EXISTS (
  SELECT 1 FROM public.sf_story_invitations invitation
  WHERE invitation.id=invitation_id AND invitation.student_id=public.sf_actor_id()
));
CREATE POLICY sf_story_invitation_events_owner_insert ON public.sf_story_invitation_events
FOR INSERT TO authenticated WITH CHECK (EXISTS (
  SELECT 1 FROM public.sf_story_invitations invitation
  WHERE invitation.id=invitation_id AND invitation.student_id=public.sf_actor_id()
));
CREATE POLICY sf_story_invitation_events_service ON public.sf_story_invitation_events
FOR ALL TO storyforge_app USING (true) WITH CHECK (true);

CREATE POLICY sf_story_contributions_owner ON public.sf_story_contributions
FOR SELECT TO authenticated USING (EXISTS (
  SELECT 1 FROM public.sf_story_invitations invitation
  WHERE invitation.id=invitation_id AND invitation.student_id=public.sf_actor_id()
));
CREATE POLICY sf_story_contributions_owner_update ON public.sf_story_contributions
FOR UPDATE TO authenticated USING (EXISTS (
  SELECT 1 FROM public.sf_story_invitations invitation
  WHERE invitation.id=invitation_id AND invitation.student_id=public.sf_actor_id()
)) WITH CHECK (EXISTS (
  SELECT 1 FROM public.sf_story_invitations invitation
  WHERE invitation.id=invitation_id AND invitation.student_id=public.sf_actor_id()
));
CREATE POLICY sf_story_contributions_service ON public.sf_story_contributions
FOR ALL TO storyforge_app USING (true) WITH CHECK (true);

CREATE POLICY sf_contribution_audio_owner_read ON public.sf_contribution_audio_assets
FOR SELECT TO authenticated USING (EXISTS (
  SELECT 1 FROM public.sf_story_invitations invitation
  WHERE invitation.id=invitation_id AND invitation.student_id=public.sf_actor_id()
));
CREATE POLICY sf_contribution_audio_service ON public.sf_contribution_audio_assets
FOR ALL TO storyforge_app USING (true) WITH CHECK (true);
CREATE POLICY sf_guest_rate_service ON public.sf_guest_rate_limits
FOR ALL TO storyforge_app USING (true) WITH CHECK (true);

REVOKE ALL ON public.sf_contributor_prompts FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.sf_story_invitations FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.sf_story_invitation_events FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.sf_story_contributions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.sf_contribution_audio_assets FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.sf_guest_rate_limits FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.sf_contributor_prompts TO authenticated, storyforge_app;
GRANT SELECT, INSERT, UPDATE ON public.sf_story_invitations TO authenticated;
GRANT SELECT, INSERT ON public.sf_story_invitation_events TO authenticated;
GRANT SELECT, UPDATE ON public.sf_story_contributions TO authenticated;
GRANT SELECT ON public.sf_contribution_audio_assets TO authenticated;
GRANT SELECT, UPDATE ON public.sf_story_invitations TO storyforge_app;
GRANT SELECT, INSERT ON public.sf_story_invitation_events TO storyforge_app;
GRANT SELECT, INSERT, UPDATE ON public.sf_story_contributions TO storyforge_app;
GRANT SELECT, INSERT, UPDATE ON public.sf_contribution_audio_assets TO storyforge_app;
GRANT SELECT, INSERT, UPDATE ON public.sf_guest_rate_limits TO storyforge_app;

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
