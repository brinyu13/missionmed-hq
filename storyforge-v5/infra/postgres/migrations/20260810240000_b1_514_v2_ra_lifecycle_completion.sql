\set ON_ERROR_STOP on

-- Migration: B1-514 Request-a-Story lifecycle completion.
-- Authority: DR-042 / DR-043 and the accepted B1-513R2 Postmark/Guest contract.
-- Additive only: existing invitations, contributions, tokens, and event rows are
-- preserved byte-for-byte. New behavior remains behind the existing default-off
-- Request-a-Story, guest, and Postmark gates.

BEGIN;
SELECT pg_advisory_xact_lock(hashtextextended('b1-514-v2-ra-lifecycle-completion', 0));

ALTER TABLE public.sf_story_invitations
  ADD COLUMN previewed_at timestamptz,
  ADD COLUMN previewed_row_version bigint CHECK (previewed_row_version IS NULL OR previewed_row_version >= 0),
  ADD COLUMN last_reminded_at timestamptz,
  ADD COLUMN reinvited_from_id uuid REFERENCES public.sf_story_invitations(id) ON DELETE RESTRICT,
  ADD COLUMN suppressed_at timestamptz,
  ADD COLUMN suppression_reason text CHECK (
    suppression_reason IS NULL OR suppression_reason IN ('spam_complaint')
  ),
  ADD CONSTRAINT sf_story_invitations_preview_pair CHECK (
    (previewed_at IS NULL) = (previewed_row_version IS NULL)
  ),
  ADD CONSTRAINT sf_story_invitations_suppression_pair CHECK (
    (suppressed_at IS NULL) = (suppression_reason IS NULL)
  );

CREATE UNIQUE INDEX sf_story_invitations_reinvite_once_idx
  ON public.sf_story_invitations (reinvited_from_id)
  WHERE reinvited_from_id IS NOT NULL;

ALTER TABLE public.sf_story_invitation_events
  DROP CONSTRAINT sf_story_invitation_events_event_type_check;
ALTER TABLE public.sf_story_invitation_events
  ADD CONSTRAINT sf_story_invitation_events_event_type_check CHECK (event_type IN (
    'created','updated','previewed','sent','delivered','opened_approximate',
    'link_visited','started','story_shared','reminded','reinvited','revoked',
    'bounced','complained','expired'
  ));

CREATE TABLE public.sf_story_invitation_suppressions (
  email_hash text PRIMARY KEY CHECK (email_hash ~ '^[a-f0-9]{64}$'),
  reason text NOT NULL CHECK (reason = 'spam_complaint'),
  source_invitation_id uuid NOT NULL
    REFERENCES public.sf_story_invitations(id) ON DELETE RESTRICT,
  provider_event_id text NOT NULL UNIQUE,
  suppressed_at timestamptz NOT NULL
);

CREATE TABLE public.sf_story_invitation_provider_messages (
  provider_message_id text PRIMARY KEY CHECK (length(provider_message_id) BETWEEN 1 AND 200),
  invitation_id uuid NOT NULL
    REFERENCES public.sf_story_invitations(id) ON DELETE RESTRICT,
  purpose text NOT NULL CHECK (purpose IN ('initial', 'reminder')),
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.sf_story_invitation_provider_messages (
  provider_message_id, invitation_id, purpose, created_at
)
SELECT provider_message_id, id, 'initial', coalesce(sent_at, created_at)
FROM public.sf_story_invitations
WHERE provider_message_id IS NOT NULL;

ALTER TABLE public.sf_story_invitation_suppressions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sf_story_invitation_suppressions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.sf_story_invitation_provider_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sf_story_invitation_provider_messages FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.sf_story_invitation_suppressions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.sf_story_invitation_provider_messages FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.sf_forbid_invitation_event_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'StoryForge invitation lifecycle events are append-only'
    USING ERRCODE = '42501';
END
$$;

CREATE TRIGGER sf_story_invitation_events_append_only
BEFORE UPDATE OR DELETE ON public.sf_story_invitation_events
FOR EACH ROW EXECUTE FUNCTION public.sf_forbid_invitation_event_mutation();

CREATE OR REPLACE FUNCTION public.sf_request_email_is_suppressed(p_email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.sf_story_invitation_suppressions suppression
    WHERE suppression.email_hash = encode(
      digest(convert_to(lower(btrim(p_email)), 'UTF8'), 'sha256'),
      'hex'
    )
  )
$$;

CREATE OR REPLACE FUNCTION public.sf_request_create(
  p_first text,
  p_relationship text,
  p_email text,
  p_message text,
  p_disclosure text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid := public.sf_request_assert_student();
  v_email text := lower(btrim(p_email));
  v_row public.sf_story_invitations;
BEGIN
  IF p_relationship NOT IN (
    'parent','sibling','spouse_partner','grandparent','cousin','best_friend',
    'childhood_friend','medical_school_friend','faculty','mentor','coworker',
    'supervisor','teammate'
  ) THEN
    RAISE EXCEPTION 'invalid invitation relationship' USING ERRCODE = '22023';
  END IF;
  IF public.sf_request_email_is_suppressed(v_email) THEN
    RAISE EXCEPTION 'recipient address is suppressed' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.sf_story_invitations (
    student_id, contributor_first_name, relationship_id, email,
    personal_message, disclosure_version
  )
  VALUES (v_actor, p_first, p_relationship, v_email, p_message, p_disclosure)
  RETURNING * INTO v_row;

  INSERT INTO public.sf_story_invitation_events (invitation_id, event_type)
  VALUES (v_row.id, 'created');
  RETURN to_jsonb(v_row);
END
$$;

CREATE OR REPLACE FUNCTION public.sf_request_update(
  p_id uuid,
  p_expected bigint,
  p_first text,
  p_relationship text,
  p_email text,
  p_message text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid := public.sf_request_assert_student();
  v_email text := lower(btrim(p_email));
  v_row public.sf_story_invitations;
BEGIN
  IF p_relationship NOT IN (
    'parent','sibling','spouse_partner','grandparent','cousin','best_friend',
    'childhood_friend','medical_school_friend','faculty','mentor','coworker',
    'supervisor','teammate'
  ) THEN
    RAISE EXCEPTION 'invalid invitation relationship' USING ERRCODE = '22023';
  END IF;
  IF public.sf_request_email_is_suppressed(v_email) THEN
    RAISE EXCEPTION 'recipient address is suppressed' USING ERRCODE = '42501';
  END IF;

  UPDATE public.sf_story_invitations
  SET contributor_first_name = p_first,
      relationship_id = p_relationship,
      email = v_email,
      personal_message = p_message,
      previewed_at = NULL,
      previewed_row_version = NULL,
      row_version = row_version + 1,
      updated_at = now()
  WHERE id = p_id
    AND student_id = v_actor
    AND status = 'draft'
    AND row_version = p_expected
    AND suppressed_at IS NULL
  RETURNING * INTO v_row;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'invitation conflict' USING ERRCODE = '40001';
  END IF;

  INSERT INTO public.sf_story_invitation_events (invitation_id, event_type)
  VALUES (v_row.id, 'updated');
  RETURN to_jsonb(v_row);
END
$$;

CREATE OR REPLACE FUNCTION public.sf_request_preview(p_id uuid, p_expected bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid := public.sf_request_assert_student();
  v_row public.sf_story_invitations;
  v_event_id bigint;
BEGIN
  SELECT * INTO v_row
  FROM public.sf_story_invitations invitation
  WHERE invitation.id = p_id
    AND invitation.student_id = v_actor
    AND invitation.status = 'draft'
    AND invitation.row_version = p_expected
    AND invitation.suppressed_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'invitation conflict' USING ERRCODE = '40001';
  END IF;

  UPDATE public.sf_story_invitations
  SET previewed_at = now(),
      previewed_row_version = row_version,
      updated_at = now()
  WHERE id = v_row.id
  RETURNING * INTO v_row;

  INSERT INTO public.sf_story_invitation_events (
    invitation_id, event_type, detail
  )
  VALUES (
    v_row.id, 'previewed', jsonb_build_object('row_version', v_row.row_version)
  )
  RETURNING id INTO v_event_id;

  RETURN to_jsonb(v_row) || jsonb_build_object('preview_event_id', v_event_id::text);
END
$$;

CREATE OR REPLACE FUNCTION public.sf_request_prepare_send(p_id uuid, p_expected bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid := public.sf_request_assert_student();
  v_row public.sf_story_invitations;
BEGIN
  SELECT * INTO v_row
  FROM public.sf_story_invitations invitation
  WHERE invitation.id = p_id
    AND invitation.student_id = v_actor
    AND invitation.status = 'draft'
    AND invitation.row_version = p_expected
    AND invitation.previewed_at IS NOT NULL
    AND invitation.previewed_row_version = invitation.row_version
    AND invitation.suppressed_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'invitation must be previewed before send' USING ERRCODE = '40001';
  END IF;
  RETURN to_jsonb(v_row);
END
$$;

CREATE OR REPLACE FUNCTION public.sf_request_mark_sent(
  p_id uuid,
  p_expected bigint,
  p_token_hash text,
  p_provider_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid := public.sf_request_assert_student();
  v_row public.sf_story_invitations;
BEGIN
  UPDATE public.sf_story_invitations
  SET token_hash = p_token_hash,
      status = 'sent',
      provider_message_id = p_provider_id,
      sent_at = now(),
      row_version = row_version + 1,
      updated_at = now()
  WHERE id = p_id
    AND student_id = v_actor
    AND status = 'draft'
    AND row_version = p_expected
    AND previewed_at IS NOT NULL
    AND previewed_row_version = row_version
    AND suppressed_at IS NULL
  RETURNING * INTO v_row;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'invitation conflict' USING ERRCODE = '40001';
  END IF;
  INSERT INTO public.sf_story_invitation_events (invitation_id, event_type)
  VALUES (v_row.id, 'sent');
  INSERT INTO public.sf_story_invitation_provider_messages (
    provider_message_id, invitation_id, purpose
  )
  VALUES (p_provider_id, v_row.id, 'initial');
  RETURN to_jsonb(v_row);
END
$$;

CREATE OR REPLACE FUNCTION public.sf_request_prepare_reminder(
  p_id uuid,
  p_expected bigint
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid := public.sf_request_assert_student();
  v_row public.sf_story_invitations;
BEGIN
  SELECT * INTO v_row
  FROM public.sf_story_invitations invitation
  WHERE invitation.id = p_id
    AND invitation.student_id = v_actor
    AND invitation.row_version = p_expected
    AND invitation.status IN ('sent','delivered','link_visited','started')
    AND invitation.reminders_sent < 2
    AND invitation.expires_at > now()
    AND invitation.suppressed_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'invitation cannot be reminded' USING ERRCODE = '40001';
  END IF;
  RETURN to_jsonb(v_row);
END
$$;

CREATE OR REPLACE FUNCTION public.sf_request_mark_reminded(
  p_id uuid,
  p_expected bigint,
  p_token_hash text,
  p_provider_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid := public.sf_request_assert_student();
  v_row public.sf_story_invitations;
BEGIN
  UPDATE public.sf_story_invitations
  SET token_hash = p_token_hash,
      reminders_sent = reminders_sent + 1,
      last_reminded_at = now(),
      provider_message_id = p_provider_id,
      row_version = row_version + 1,
      updated_at = now()
  WHERE id = p_id
    AND student_id = v_actor
    AND row_version = p_expected
    AND status IN ('sent','delivered','link_visited','started')
    AND reminders_sent < 2
    AND expires_at > now()
    AND suppressed_at IS NULL
  RETURNING * INTO v_row;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'invitation cannot be reminded' USING ERRCODE = '40001';
  END IF;
  INSERT INTO public.sf_story_invitation_events (invitation_id, event_type, detail)
  VALUES (
    v_row.id, 'reminded', jsonb_build_object('reminder_number', v_row.reminders_sent)
  );
  INSERT INTO public.sf_story_invitation_provider_messages (
    provider_message_id, invitation_id, purpose
  )
  VALUES (p_provider_id, v_row.id, 'reminder');
  RETURN to_jsonb(v_row);
END
$$;

CREATE OR REPLACE FUNCTION public.sf_request_reinvite(
  p_id uuid,
  p_expected bigint,
  p_email text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid := public.sf_request_assert_student();
  v_email text := lower(btrim(p_email));
  v_old public.sf_story_invitations;
  v_new public.sf_story_invitations;
BEGIN
  SELECT * INTO v_old
  FROM public.sf_story_invitations invitation
  WHERE invitation.id = p_id
    AND invitation.student_id = v_actor
    AND invitation.status = 'bounced'
    AND invitation.row_version = p_expected
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'invitation cannot be re-invited' USING ERRCODE = '40001';
  END IF;
  IF v_email = lower(v_old.email) OR public.sf_request_email_is_suppressed(v_email) THEN
    RAISE EXCEPTION 'a different unsuppressed address is required' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.sf_story_invitations (
    student_id, contributor_first_name, relationship_id, email,
    personal_message, disclosure_version, reinvited_from_id
  )
  VALUES (
    v_actor, v_old.contributor_first_name, v_old.relationship_id, v_email,
    v_old.personal_message, v_old.disclosure_version, v_old.id
  )
  RETURNING * INTO v_new;

  INSERT INTO public.sf_story_invitation_events (invitation_id, event_type, detail)
  VALUES
    (v_old.id, 'reinvited', jsonb_build_object('replacement_id', v_new.id)),
    (v_new.id, 'created', jsonb_build_object('reinvited_from_id', v_old.id));
  RETURN to_jsonb(v_new);
END
$$;

CREATE OR REPLACE FUNCTION public.sf_guest_mark_started(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row public.sf_story_invitations;
BEGIN
  UPDATE public.sf_story_invitations
  SET started_at = coalesce(started_at, now()),
      status = CASE
        WHEN status IN ('sent','delivered','link_visited') THEN 'started'
        ELSE status
      END,
      updated_at = now()
  WHERE id = p_id
    AND status IN ('sent','delivered','link_visited','started','story_shared')
    AND expires_at > now()
    AND revoked_at IS NULL
    AND suppressed_at IS NULL
  RETURNING * INTO v_row;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'invitation not found' USING ERRCODE = 'P0002';
  END IF;
  INSERT INTO public.sf_story_invitation_events (invitation_id, event_type)
  SELECT v_row.id, 'started'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.sf_story_invitation_events event
    WHERE event.invitation_id = v_row.id AND event.event_type = 'started'
  );
  RETURN jsonb_build_object(
    'accepted', true,
    'status', v_row.status,
    'startedAt', v_row.started_at
  );
END
$$;

CREATE OR REPLACE FUNCTION public.sf_guest_expire_if_due(p_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_expired boolean := false;
BEGIN
  UPDATE public.sf_story_invitations
  SET status = 'expired', token_hash = NULL, row_version = row_version + 1,
      updated_at = now()
  WHERE id = p_id
    AND expires_at <= now()
    AND status IN ('sent','delivered','link_visited','started')
  RETURNING true INTO v_expired;
  IF coalesce(v_expired, false) THEN
    INSERT INTO public.sf_story_invitation_events (invitation_id, event_type)
    VALUES (p_id, 'expired');
  END IF;
  RETURN coalesce(v_expired, false);
END
$$;

CREATE OR REPLACE FUNCTION public.sf_request_expire_due(p_limit integer DEFAULT 100)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id uuid;
  v_count integer := 0;
BEGIN
  IF p_limit < 1 OR p_limit > 500 THEN
    RAISE EXCEPTION 'invalid expiry batch limit' USING ERRCODE = '22023';
  END IF;
  FOR v_id IN
    SELECT invitation.id
    FROM public.sf_story_invitations invitation
    WHERE invitation.expires_at <= now()
      AND invitation.status IN ('sent','delivered','link_visited','started')
    ORDER BY invitation.expires_at, invitation.id
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  LOOP
    IF public.sf_guest_expire_if_due(v_id) THEN
      v_count := v_count + 1;
    END IF;
  END LOOP;
  RETURN v_count;
END
$$;

CREATE OR REPLACE FUNCTION public.sf_request_provider_event(
  p_message_id text,
  p_type text,
  p_event_id text,
  p_occurred timestamptz,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_invitation public.sf_story_invitations;
  v_inserted bigint;
BEGIN
  IF p_type NOT IN ('delivered','opened_approximate','bounced','complained') THEN
    RAISE EXCEPTION 'unsupported provider lifecycle event' USING ERRCODE = '22023';
  END IF;
  SELECT invitation.* INTO v_invitation
  FROM public.sf_story_invitation_provider_messages message
  JOIN public.sf_story_invitations invitation ON invitation.id = message.invitation_id
  WHERE message.provider_message_id = p_message_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('accepted', true);
  END IF;

  INSERT INTO public.sf_story_invitation_events (
    invitation_id, event_type, provider_event_id, detail, created_at
  )
  VALUES (v_invitation.id, p_type, p_event_id, '{}'::jsonb, p_occurred)
  ON CONFLICT (provider_event_id) DO NOTHING
  RETURNING id INTO v_inserted;
  IF v_inserted IS NULL THEN
    RETURN jsonb_build_object('accepted', true, 'duplicate', true);
  END IF;

  IF p_type = 'delivered' THEN
    UPDATE public.sf_story_invitations
    SET delivered_at = coalesce(delivered_at, p_occurred),
        status = CASE WHEN status = 'sent' THEN 'delivered' ELSE status END,
        updated_at = now()
    WHERE id = v_invitation.id;
  ELSIF p_type = 'opened_approximate' THEN
    UPDATE public.sf_story_invitations
    SET opened_at = coalesce(opened_at, p_occurred), updated_at = now()
    WHERE id = v_invitation.id;
  ELSIF p_type = 'bounced' THEN
    UPDATE public.sf_story_invitations
    SET bounced_at = coalesce(bounced_at, p_occurred),
        bounce_reason = coalesce(bounce_reason, left(p_reason, 500)),
        status = CASE
          WHEN status IN ('sent','delivered','link_visited','started') THEN 'bounced'
          ELSE status
        END,
        token_hash = NULL,
        row_version = row_version + 1,
        updated_at = now()
    WHERE id = v_invitation.id;
  ELSE
    INSERT INTO public.sf_story_invitation_suppressions (
      email_hash, reason, source_invitation_id, provider_event_id, suppressed_at
    )
    VALUES (
      encode(digest(convert_to(lower(btrim(v_invitation.email)), 'UTF8'), 'sha256'), 'hex'),
      'spam_complaint', v_invitation.id, p_event_id, p_occurred
    )
    ON CONFLICT (email_hash) DO NOTHING;
    UPDATE public.sf_story_invitations
    SET suppressed_at = coalesce(suppressed_at, p_occurred),
        suppression_reason = 'spam_complaint',
        token_hash = NULL,
        row_version = row_version + 1,
        updated_at = now()
    WHERE id = v_invitation.id;
  END IF;
  RETURN jsonb_build_object('accepted', true);
END
$$;

REVOKE ALL ON FUNCTION public.sf_forbid_invitation_event_mutation() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sf_request_email_is_suppressed(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sf_request_update(uuid,bigint,text,text,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sf_request_preview(uuid,bigint) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sf_request_prepare_send(uuid,bigint) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sf_request_prepare_reminder(uuid,bigint) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sf_request_mark_reminded(uuid,bigint,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sf_request_reinvite(uuid,bigint,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sf_guest_mark_started(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sf_guest_expire_if_due(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sf_request_expire_due(integer) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.sf_request_update(uuid,bigint,text,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sf_request_preview(uuid,bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sf_request_prepare_send(uuid,bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sf_request_prepare_reminder(uuid,bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sf_request_mark_reminded(uuid,bigint,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sf_request_reinvite(uuid,bigint,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sf_guest_mark_started(uuid) TO storyforge_app;
GRANT EXECUTE ON FUNCTION public.sf_guest_expire_if_due(uuid) TO storyforge_app;
GRANT EXECUTE ON FUNCTION public.sf_request_expire_due(integer) TO storyforge_app;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.sf_story_invitation_suppressions) THEN
    RAISE EXCEPTION 'Request-a-Story suppression ledger must begin empty';
  END IF;
END
$$;

COMMIT;
