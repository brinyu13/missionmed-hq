\set ON_ERROR_STOP on

-- Migration: B1-514 Request-a-Story durable delivery attempts.
-- Authority: DR-042 / DR-043 and the accepted B1-513R2 Postmark contract.
-- The raw invitation token is never persisted. Its SHA-256 hash is committed
-- before the provider boundary so an accepted message remains usable even if
-- provider acceptance cannot be finalized in the same request.

BEGIN;
SELECT pg_advisory_xact_lock(hashtextextended('b1-514-request-delivery-attempts', 0));

CREATE TABLE public.sf_story_invitation_delivery_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invitation_id uuid NOT NULL
    REFERENCES public.sf_story_invitations(id) ON DELETE RESTRICT,
  purpose text NOT NULL CHECK (purpose IN ('initial', 'reminder')),
  ordinal smallint NOT NULL CHECK (ordinal BETWEEN 0 AND 2),
  base_row_version bigint NOT NULL CHECK (base_row_version >= 0),
  token_hash text NOT NULL CHECK (token_hash ~ '^[a-f0-9]{64}$'),
  state text NOT NULL DEFAULT 'reserved' CHECK (state IN (
    'reserved','dispatching','ambiguous','accepted','delivered','bounced',
    'complained','definitive_failure','abandoned'
  )),
  acceptance_source text CHECK (
    acceptance_source IS NULL OR acceptance_source IN ('provider_response','provider_webhook','guest_link')
  ),
  provider_message_id text UNIQUE CHECK (
    provider_message_id IS NULL OR length(provider_message_id) BETWEEN 1 AND 200
  ),
  failure_reason text CHECK (
    failure_reason IS NULL OR failure_reason IN (
      'dispatch_not_started','provider_rejected','operator_proven_absent',
      'provider_bounce','spam_complaint','revoked','expired'
    )
  ),
  resolution_evidence_id text CHECK (
    resolution_evidence_id IS NULL OR resolution_evidence_id ~ '^[A-Za-z0-9._:-]{1,200}$'
  ),
  reserved_at timestamptz NOT NULL DEFAULT now(),
  dispatch_started_at timestamptz,
  accepted_at timestamptz,
  resolved_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((purpose = 'initial' AND ordinal = 0) OR (purpose = 'reminder' AND ordinal BETWEEN 1 AND 2)),
  CHECK ((state IN ('accepted','delivered','bounced','complained')) = (accepted_at IS NOT NULL)),
  CHECK ((state IN ('definitive_failure','abandoned')) = (resolved_at IS NOT NULL)),
  CHECK ((state IN ('definitive_failure','abandoned')) = (failure_reason IS NOT NULL))
);

CREATE UNIQUE INDEX sf_story_invitation_delivery_attempts_one_active_idx
  ON public.sf_story_invitation_delivery_attempts (invitation_id)
  WHERE state IN ('reserved','dispatching','ambiguous');
CREATE UNIQUE INDEX sf_story_invitation_delivery_attempts_one_accepted_ordinal_idx
  ON public.sf_story_invitation_delivery_attempts (invitation_id, purpose, ordinal)
  WHERE state IN ('accepted','delivered','bounced','complained');
CREATE INDEX sf_story_invitation_delivery_attempts_provider_idx
  ON public.sf_story_invitation_delivery_attempts (provider_message_id)
  WHERE provider_message_id IS NOT NULL;

ALTER TABLE public.sf_story_invitations
  ADD COLUMN active_delivery_attempt_id uuid
    REFERENCES public.sf_story_invitation_delivery_attempts(id) ON DELETE RESTRICT,
  ADD COLUMN delivery_state text CHECK (
    delivery_state IS NULL OR delivery_state IN ('reserved','dispatching','ambiguous')
  ),
  ADD CONSTRAINT sf_story_invitations_delivery_pair CHECK (
    (active_delivery_attempt_id IS NULL) = (delivery_state IS NULL)
  );

ALTER TABLE public.sf_story_invitation_provider_messages
  ADD COLUMN delivery_attempt_id uuid UNIQUE
    REFERENCES public.sf_story_invitation_delivery_attempts(id) ON DELETE RESTRICT;

ALTER TABLE public.sf_story_invitation_events
  ADD COLUMN delivery_attempt_id uuid UNIQUE
    REFERENCES public.sf_story_invitation_delivery_attempts(id) ON DELETE RESTRICT;

ALTER TABLE public.sf_story_invitation_delivery_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sf_story_invitation_delivery_attempts FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.sf_story_invitation_delivery_attempts
  FROM PUBLIC, anon, authenticated, storyforge_app;

CREATE OR REPLACE FUNCTION public.sf_request_reserve_delivery(
  p_id uuid,
  p_expected bigint,
  p_purpose text,
  p_token_hash text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid := public.sf_request_assert_student();
  v_invitation public.sf_story_invitations;
  v_attempt public.sf_story_invitation_delivery_attempts;
  v_ordinal smallint;
BEGIN
  IF p_purpose NOT IN ('initial','reminder') OR p_token_hash !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'invalid delivery reservation' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_invitation
  FROM public.sf_story_invitations invitation
  WHERE invitation.id = p_id AND invitation.student_id = v_actor
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'invitation not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_invitation.active_delivery_attempt_id IS NOT NULL THEN
    SELECT * INTO STRICT v_attempt
    FROM public.sf_story_invitation_delivery_attempts
    WHERE id = v_invitation.active_delivery_attempt_id;
    IF v_attempt.purpose <> p_purpose
       OR p_expected NOT IN (v_attempt.base_row_version, v_invitation.row_version) THEN
      RAISE EXCEPTION 'invitation conflict' USING ERRCODE = '40001';
    END IF;
    RETURN to_jsonb(v_invitation) || jsonb_build_object(
      'delivery_attempt_id', v_attempt.id,
      'delivery_created', false,
      'delivery_purpose', v_attempt.purpose,
      'delivery_ordinal', v_attempt.ordinal
    );
  END IF;

  IF v_invitation.row_version <> p_expected OR v_invitation.suppressed_at IS NOT NULL THEN
    RAISE EXCEPTION 'invitation conflict' USING ERRCODE = '40001';
  END IF;

  IF p_purpose = 'initial' THEN
    IF v_invitation.status <> 'draft'
       OR v_invitation.previewed_at IS NULL
       OR v_invitation.previewed_row_version <> v_invitation.row_version THEN
      RAISE EXCEPTION 'invitation must be previewed before send' USING ERRCODE = '40001';
    END IF;
    v_ordinal := 0;
  ELSE
    IF v_invitation.status NOT IN ('sent','delivered','link_visited','started')
       OR v_invitation.reminders_sent >= 2
       OR v_invitation.expires_at <= now() THEN
      RAISE EXCEPTION 'invitation cannot be reminded' USING ERRCODE = '40001';
    END IF;
    v_ordinal := (v_invitation.reminders_sent + 1)::smallint;
  END IF;

  INSERT INTO public.sf_story_invitation_delivery_attempts (
    invitation_id, purpose, ordinal, base_row_version, token_hash
  ) VALUES (
    v_invitation.id, p_purpose, v_ordinal, p_expected, p_token_hash
  ) RETURNING * INTO v_attempt;

  UPDATE public.sf_story_invitations
  SET token_hash = p_token_hash,
      active_delivery_attempt_id = v_attempt.id,
      delivery_state = 'reserved',
      row_version = row_version + 1,
      updated_at = now()
  WHERE id = v_invitation.id
  RETURNING * INTO v_invitation;

  RETURN to_jsonb(v_invitation) || jsonb_build_object(
    'delivery_attempt_id', v_attempt.id,
    'delivery_created', true,
    'delivery_purpose', v_attempt.purpose,
    'delivery_ordinal', v_attempt.ordinal
  );
END
$$;

CREATE OR REPLACE FUNCTION public.sf_request_claim_delivery_attempt(p_attempt uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_attempt public.sf_story_invitation_delivery_attempts;
  v_invitation public.sf_story_invitations;
BEGIN
  UPDATE public.sf_story_invitation_delivery_attempts
  SET state = 'dispatching', dispatch_started_at = now(), updated_at = now()
  WHERE id = p_attempt AND state = 'reserved'
  RETURNING * INTO v_attempt;
  IF NOT FOUND THEN
    SELECT * INTO v_attempt FROM public.sf_story_invitation_delivery_attempts WHERE id = p_attempt;
    IF NOT FOUND THEN RAISE EXCEPTION 'delivery attempt not found' USING ERRCODE = 'P0002'; END IF;
    RETURN jsonb_build_object('claimed', false, 'state', v_attempt.state);
  END IF;
  UPDATE public.sf_story_invitations
  SET delivery_state = 'dispatching', updated_at = now()
  WHERE id = v_attempt.invitation_id AND active_delivery_attempt_id = v_attempt.id
  RETURNING * INTO v_invitation;
  IF NOT FOUND THEN RAISE EXCEPTION 'delivery reservation conflict' USING ERRCODE = '40001'; END IF;
  RETURN jsonb_build_object('claimed', true, 'state', v_attempt.state);
END
$$;

CREATE OR REPLACE FUNCTION public.sf_request_accept_delivery(
  p_attempt uuid,
  p_provider_id text,
  p_source text DEFAULT 'provider_response'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_attempt public.sf_story_invitation_delivery_attempts;
  v_invitation public.sf_story_invitations;
  v_mapping public.sf_story_invitation_provider_messages;
  v_first_accept boolean;
BEGIN
  IF p_source NOT IN ('provider_response','provider_webhook')
     OR p_provider_id IS NULL OR length(p_provider_id) NOT BETWEEN 1 AND 200 THEN
    RAISE EXCEPTION 'invalid provider acceptance' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_attempt
  FROM public.sf_story_invitation_delivery_attempts
  WHERE id = p_attempt
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'delivery attempt not found' USING ERRCODE = 'P0002'; END IF;
  IF v_attempt.state IN ('definitive_failure','abandoned') THEN
    RAISE EXCEPTION 'delivery attempt is closed' USING ERRCODE = '40001';
  END IF;
  IF v_attempt.provider_message_id IS NOT NULL AND v_attempt.provider_message_id <> p_provider_id THEN
    RAISE EXCEPTION 'provider message conflict' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.sf_story_invitation_provider_messages (
    provider_message_id, invitation_id, purpose, delivery_attempt_id
  ) VALUES (
    p_provider_id, v_attempt.invitation_id, v_attempt.purpose, v_attempt.id
  )
  ON CONFLICT (provider_message_id) DO NOTHING;
  SELECT * INTO v_mapping
  FROM public.sf_story_invitation_provider_messages
  WHERE provider_message_id = p_provider_id;
  IF v_mapping.invitation_id <> v_attempt.invitation_id
     OR (v_mapping.delivery_attempt_id IS NOT NULL AND v_mapping.delivery_attempt_id <> v_attempt.id) THEN
    RAISE EXCEPTION 'provider message conflict' USING ERRCODE = '42501';
  END IF;
  IF v_mapping.delivery_attempt_id IS NULL THEN
    UPDATE public.sf_story_invitation_provider_messages
    SET delivery_attempt_id = v_attempt.id
    WHERE provider_message_id = p_provider_id;
  END IF;

  v_first_accept := v_attempt.state IN ('reserved','dispatching','ambiguous');
  IF v_first_accept THEN
    SELECT * INTO v_invitation
    FROM public.sf_story_invitations
    WHERE id = v_attempt.invitation_id
    FOR UPDATE;
    IF v_invitation.active_delivery_attempt_id <> v_attempt.id THEN
      RAISE EXCEPTION 'delivery reservation conflict' USING ERRCODE = '40001';
    END IF;

    IF v_attempt.purpose = 'initial' THEN
      UPDATE public.sf_story_invitations
      SET status = CASE WHEN status = 'draft' THEN 'sent' ELSE status END,
          sent_at = coalesce(sent_at, now()),
          provider_message_id = p_provider_id,
          active_delivery_attempt_id = NULL,
          delivery_state = NULL,
          row_version = row_version + 1,
          updated_at = now()
      WHERE id = v_attempt.invitation_id
      RETURNING * INTO v_invitation;
      INSERT INTO public.sf_story_invitation_events (
        invitation_id, event_type, delivery_attempt_id
      ) VALUES (v_invitation.id, 'sent', v_attempt.id);
    ELSE
      IF v_invitation.reminders_sent <> v_attempt.ordinal - 1 THEN
        RAISE EXCEPTION 'reminder sequence conflict' USING ERRCODE = '40001';
      END IF;
      UPDATE public.sf_story_invitations
      SET reminders_sent = v_attempt.ordinal,
          last_reminded_at = coalesce(last_reminded_at, now()),
          provider_message_id = p_provider_id,
          active_delivery_attempt_id = NULL,
          delivery_state = NULL,
          row_version = row_version + 1,
          updated_at = now()
      WHERE id = v_attempt.invitation_id
      RETURNING * INTO v_invitation;
      INSERT INTO public.sf_story_invitation_events (
        invitation_id, event_type, delivery_attempt_id, detail
      ) VALUES (
        v_invitation.id, 'reminded', v_attempt.id,
        jsonb_build_object('reminder_number', v_attempt.ordinal)
      );
    END IF;
  ELSE
    SELECT * INTO v_invitation
    FROM public.sf_story_invitations
    WHERE id = v_attempt.invitation_id;
  END IF;

  UPDATE public.sf_story_invitation_delivery_attempts
  SET state = CASE WHEN state IN ('delivered','bounced','complained') THEN state ELSE 'accepted' END,
      acceptance_source = coalesce(acceptance_source, p_source),
      provider_message_id = p_provider_id,
      accepted_at = coalesce(accepted_at, now()),
      updated_at = now()
  WHERE id = v_attempt.id;

  RETURN to_jsonb(v_invitation) || jsonb_build_object(
    'delivery_attempt_id', v_attempt.id,
    'delivery_created', false,
    'delivery_purpose', v_attempt.purpose,
    'delivery_ordinal', v_attempt.ordinal
  );
END
$$;

CREATE OR REPLACE FUNCTION public.sf_request_mark_delivery_ambiguous(p_attempt uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_attempt public.sf_story_invitation_delivery_attempts;
BEGIN
  UPDATE public.sf_story_invitation_delivery_attempts
  SET state = 'ambiguous', updated_at = now()
  WHERE id = p_attempt AND state IN ('reserved','dispatching')
  RETURNING * INTO v_attempt;
  IF NOT FOUND THEN
    SELECT * INTO v_attempt FROM public.sf_story_invitation_delivery_attempts WHERE id = p_attempt;
    IF NOT FOUND THEN RAISE EXCEPTION 'delivery attempt not found' USING ERRCODE = 'P0002'; END IF;
  END IF;
  IF v_attempt.state = 'ambiguous' THEN
    UPDATE public.sf_story_invitations
    SET delivery_state = 'ambiguous', updated_at = now()
    WHERE id = v_attempt.invitation_id AND active_delivery_attempt_id = v_attempt.id;
  END IF;
  RETURN jsonb_build_object('state', v_attempt.state);
END
$$;

CREATE OR REPLACE FUNCTION public.sf_request_fail_delivery(
  p_attempt uuid,
  p_reason text,
  p_evidence_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_attempt public.sf_story_invitation_delivery_attempts;
BEGIN
  IF p_reason NOT IN ('dispatch_not_started','provider_rejected','operator_proven_absent')
     OR (p_evidence_id IS NOT NULL AND p_evidence_id !~ '^[A-Za-z0-9._:-]{1,200}$') THEN
    RAISE EXCEPTION 'invalid delivery failure' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_attempt
  FROM public.sf_story_invitation_delivery_attempts
  WHERE id = p_attempt
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'delivery attempt not found' USING ERRCODE = 'P0002'; END IF;
  IF v_attempt.state NOT IN ('reserved','dispatching','ambiguous','definitive_failure') THEN
    RAISE EXCEPTION 'delivery attempt is closed' USING ERRCODE = '40001';
  END IF;
  IF v_attempt.state <> 'definitive_failure' THEN
    UPDATE public.sf_story_invitation_delivery_attempts
    SET state = 'definitive_failure', failure_reason = p_reason,
        resolution_evidence_id = p_evidence_id, resolved_at = now(), updated_at = now()
    WHERE id = v_attempt.id;
    UPDATE public.sf_story_invitations
    SET token_hash = NULL, active_delivery_attempt_id = NULL, delivery_state = NULL,
        row_version = row_version + 1, updated_at = now()
    WHERE id = v_attempt.invitation_id AND active_delivery_attempt_id = v_attempt.id;
  END IF;
  RETURN jsonb_build_object('state', 'definitive_failure');
END
$$;

-- A pending provider boundary freezes mutable send inputs. Existing accepted
-- invitations continue using the prior functions without behavioral changes.
CREATE OR REPLACE FUNCTION public.sf_request_update(
  p_id uuid, p_expected bigint, p_first text, p_relationship text,
  p_email text, p_message text
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
    'childhood_friend','medschool_friend','faculty','mentor','coworker',
    'supervisor','teammate'
  ) THEN RAISE EXCEPTION 'invalid invitation relationship' USING ERRCODE = '22023'; END IF;
  IF public.sf_request_email_is_suppressed(v_email) THEN
    RAISE EXCEPTION 'recipient address is suppressed' USING ERRCODE = '42501';
  END IF;
  UPDATE public.sf_story_invitations
  SET contributor_first_name = p_first, relationship_id = p_relationship,
      email = v_email, personal_message = p_message, previewed_at = NULL,
      previewed_row_version = NULL, row_version = row_version + 1, updated_at = now()
  WHERE id = p_id AND student_id = v_actor AND status = 'draft'
    AND row_version = p_expected AND suppressed_at IS NULL
    AND active_delivery_attempt_id IS NULL
  RETURNING * INTO v_row;
  IF NOT FOUND THEN RAISE EXCEPTION 'invitation conflict' USING ERRCODE = '40001'; END IF;
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
  SELECT * INTO v_row FROM public.sf_story_invitations invitation
  WHERE invitation.id = p_id AND invitation.student_id = v_actor
    AND invitation.status = 'draft' AND invitation.row_version = p_expected
    AND invitation.suppressed_at IS NULL AND invitation.active_delivery_attempt_id IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'invitation conflict' USING ERRCODE = '40001'; END IF;
  UPDATE public.sf_story_invitations
  SET previewed_at = now(), previewed_row_version = row_version, updated_at = now()
  WHERE id = v_row.id RETURNING * INTO v_row;
  INSERT INTO public.sf_story_invitation_events (invitation_id, event_type, detail)
  VALUES (v_row.id, 'previewed', jsonb_build_object('row_version', v_row.row_version))
  RETURNING id INTO v_event_id;
  RETURN to_jsonb(v_row) || jsonb_build_object('preview_event_id', v_event_id::text);
END
$$;

CREATE OR REPLACE FUNCTION public.sf_request_revoke(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid := public.sf_request_assert_student();
  v_row public.sf_story_invitations;
BEGIN
  SELECT * INTO v_row FROM public.sf_story_invitations
  WHERE id = p_id AND student_id = v_actor AND revoked_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'invitation not found' USING ERRCODE = 'P0002'; END IF;
  IF v_row.active_delivery_attempt_id IS NOT NULL THEN
    UPDATE public.sf_story_invitation_delivery_attempts
    SET state = 'abandoned', failure_reason = 'revoked', resolved_at = now(), updated_at = now()
    WHERE id = v_row.active_delivery_attempt_id AND state IN ('reserved','dispatching','ambiguous');
  END IF;
  UPDATE public.sf_story_invitations
  SET status = 'revoked', revoked_at = now(), token_hash = NULL,
      active_delivery_attempt_id = NULL, delivery_state = NULL,
      row_version = row_version + 1, updated_at = now()
  WHERE id = v_row.id RETURNING * INTO v_row;
  INSERT INTO public.sf_story_invitation_events (invitation_id, event_type)
  VALUES (v_row.id, 'revoked');
  RETURN to_jsonb(v_row);
END
$$;

CREATE OR REPLACE FUNCTION public.sf_guest_mark_visited(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_invitation public.sf_story_invitations;
  v_attempt public.sf_story_invitation_delivery_attempts;
BEGIN
  SELECT * INTO v_invitation FROM public.sf_story_invitations WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'invitation not found' USING ERRCODE = 'P0002'; END IF;
  IF v_invitation.expires_at <= now() OR v_invitation.revoked_at IS NOT NULL
     OR v_invitation.suppressed_at IS NOT NULL
     OR v_invitation.status IN ('expired','revoked','bounced') THEN
    RAISE EXCEPTION 'invitation not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_invitation.active_delivery_attempt_id IS NOT NULL THEN
    SELECT * INTO v_attempt FROM public.sf_story_invitation_delivery_attempts
    WHERE id = v_invitation.active_delivery_attempt_id FOR UPDATE;
    IF v_attempt.state IN ('reserved','dispatching','ambiguous') THEN
      UPDATE public.sf_story_invitation_delivery_attempts
      SET state = 'accepted', acceptance_source = 'guest_link', accepted_at = now(), updated_at = now()
      WHERE id = v_attempt.id;
      UPDATE public.sf_story_invitations
      SET status = CASE WHEN status IN ('draft','sent','delivered') THEN 'link_visited' ELSE status END,
          sent_at = CASE WHEN v_attempt.purpose = 'initial' THEN coalesce(sent_at, now()) ELSE sent_at END,
          reminders_sent = CASE WHEN v_attempt.purpose = 'reminder' THEN v_attempt.ordinal ELSE reminders_sent END,
          last_reminded_at = CASE WHEN v_attempt.purpose = 'reminder' THEN coalesce(last_reminded_at, now()) ELSE last_reminded_at END,
          link_visited_at = coalesce(link_visited_at, now()),
          active_delivery_attempt_id = NULL, delivery_state = NULL,
          row_version = row_version + 1, updated_at = now()
      WHERE id = v_invitation.id RETURNING * INTO v_invitation;
      INSERT INTO public.sf_story_invitation_events (
        invitation_id, event_type, delivery_attempt_id, detail
      ) VALUES (
        v_invitation.id,
        CASE WHEN v_attempt.purpose = 'initial' THEN 'sent' ELSE 'reminded' END,
        v_attempt.id,
        CASE WHEN v_attempt.purpose = 'reminder'
          THEN jsonb_build_object('reminder_number', v_attempt.ordinal)
          ELSE '{}'::jsonb END
      );
    END IF;
  END IF;
  UPDATE public.sf_story_invitations
  SET link_visited_at = coalesce(link_visited_at, now()),
      status = CASE WHEN status IN ('sent','delivered') THEN 'link_visited' ELSE status END,
      updated_at = now()
  WHERE id = p_id;
  INSERT INTO public.sf_story_invitation_events (invitation_id, event_type)
  SELECT p_id, 'link_visited'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.sf_story_invitation_events
    WHERE invitation_id = p_id AND event_type = 'link_visited'
  );
END
$$;

CREATE OR REPLACE FUNCTION public.sf_guest_mark_started(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_row public.sf_story_invitations;
BEGIN
  PERFORM public.sf_guest_mark_visited(p_id);
  UPDATE public.sf_story_invitations
  SET started_at = coalesce(started_at, now()),
      status = CASE WHEN status IN ('sent','delivered','link_visited') THEN 'started' ELSE status END,
      updated_at = now()
  WHERE id = p_id AND status IN ('sent','delivered','link_visited','started','story_shared')
    AND expires_at > now() AND revoked_at IS NULL AND suppressed_at IS NULL
  RETURNING * INTO v_row;
  IF NOT FOUND THEN RAISE EXCEPTION 'invitation not found' USING ERRCODE = 'P0002'; END IF;
  INSERT INTO public.sf_story_invitation_events (invitation_id, event_type)
  SELECT v_row.id, 'started'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.sf_story_invitation_events
    WHERE invitation_id = v_row.id AND event_type = 'started'
  );
  RETURN jsonb_build_object('accepted', true, 'status', v_row.status, 'startedAt', v_row.started_at);
END
$$;

CREATE OR REPLACE FUNCTION public.sf_guest_expire_if_due(p_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_row public.sf_story_invitations; v_expired boolean := false;
BEGIN
  SELECT * INTO v_row FROM public.sf_story_invitations WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR v_row.expires_at > now() THEN RETURN false; END IF;
  IF v_row.active_delivery_attempt_id IS NOT NULL THEN
    UPDATE public.sf_story_invitation_delivery_attempts
    SET state = 'abandoned', failure_reason = 'expired', resolved_at = now(), updated_at = now()
    WHERE id = v_row.active_delivery_attempt_id AND state IN ('reserved','dispatching','ambiguous');
  END IF;
  UPDATE public.sf_story_invitations
  SET status = 'expired', token_hash = NULL, active_delivery_attempt_id = NULL,
      delivery_state = NULL, row_version = row_version + 1, updated_at = now()
  WHERE id = p_id AND (
    status IN ('sent','delivered','link_visited','started')
    OR (status = 'draft' AND active_delivery_attempt_id IS NOT NULL)
  ) RETURNING true INTO v_expired;
  IF coalesce(v_expired, false) THEN
    INSERT INTO public.sf_story_invitation_events (invitation_id, event_type) VALUES (p_id, 'expired');
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
DECLARE v_id uuid; v_count integer := 0;
BEGIN
  IF p_limit < 1 OR p_limit > 500 THEN
    RAISE EXCEPTION 'invalid expiry batch limit' USING ERRCODE = '22023';
  END IF;
  FOR v_id IN
    SELECT invitation.id FROM public.sf_story_invitations invitation
    WHERE invitation.expires_at <= now() AND (
      invitation.status IN ('sent','delivered','link_visited','started')
      OR (invitation.status = 'draft' AND invitation.active_delivery_attempt_id IS NOT NULL)
    )
    ORDER BY invitation.expires_at, invitation.id LIMIT p_limit FOR UPDATE SKIP LOCKED
  LOOP
    IF public.sf_guest_expire_if_due(v_id) THEN v_count := v_count + 1; END IF;
  END LOOP;
  RETURN v_count;
END
$$;

CREATE OR REPLACE FUNCTION public.sf_request_provider_event_resolve(
  p_message_id text,
  p_type text,
  p_event_id text,
  p_occurred timestamptz,
  p_reason text,
  p_attempt_id uuid,
  p_invitation_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_attempt public.sf_story_invitation_delivery_attempts;
  v_invitation public.sf_story_invitations;
  v_inserted bigint;
  v_attempt_id uuid := p_attempt_id;
  v_legacy_result jsonb;
BEGIN
  IF p_type NOT IN ('delivered','opened_approximate','bounced','complained') THEN
    RAISE EXCEPTION 'unsupported provider lifecycle event' USING ERRCODE = '22023';
  END IF;
  IF v_attempt_id IS NULL THEN
    SELECT delivery_attempt_id INTO v_attempt_id
    FROM public.sf_story_invitation_provider_messages
    WHERE provider_message_id = p_message_id;
  END IF;
  IF v_attempt_id IS NULL THEN
    v_legacy_result := public.sf_request_provider_event(p_message_id,p_type,p_event_id,p_occurred,p_reason);
    IF p_type IN ('bounced','complained') THEN
      SELECT invitation.* INTO v_invitation
      FROM public.sf_story_invitation_provider_messages message
      JOIN public.sf_story_invitations invitation ON invitation.id = message.invitation_id
      WHERE message.provider_message_id = p_message_id
      FOR UPDATE;
      IF FOUND AND v_invitation.active_delivery_attempt_id IS NOT NULL THEN
        UPDATE public.sf_story_invitation_delivery_attempts
        SET state = 'abandoned',
            failure_reason = CASE WHEN p_type = 'bounced' THEN 'provider_bounce' ELSE 'spam_complaint' END,
            resolved_at = now(), updated_at = now()
        WHERE id = v_invitation.active_delivery_attempt_id
          AND state IN ('reserved','dispatching','ambiguous');
        UPDATE public.sf_story_invitations
        SET token_hash = NULL, active_delivery_attempt_id = NULL, delivery_state = NULL,
            row_version = row_version + 1, updated_at = now()
        WHERE id = v_invitation.id;
      END IF;
    END IF;
    RETURN v_legacy_result;
  END IF;

  SELECT * INTO v_attempt FROM public.sf_story_invitation_delivery_attempts
  WHERE id = v_attempt_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'delivery attempt not found' USING ERRCODE = 'P0002'; END IF;
  IF p_invitation_id IS NOT NULL AND p_invitation_id <> v_attempt.invitation_id THEN
    RAISE EXCEPTION 'provider metadata conflict' USING ERRCODE = '42501';
  END IF;

  PERFORM public.sf_request_accept_delivery(v_attempt.id, p_message_id, 'provider_webhook');
  SELECT * INTO v_invitation FROM public.sf_story_invitations
  WHERE id = v_attempt.invitation_id FOR UPDATE;

  INSERT INTO public.sf_story_invitation_events (
    invitation_id, event_type, provider_event_id, detail, created_at
  ) VALUES (
    v_invitation.id, p_type, p_event_id, '{}'::jsonb, p_occurred
  ) ON CONFLICT (provider_event_id) DO NOTHING RETURNING id INTO v_inserted;
  IF v_inserted IS NULL THEN
    RETURN jsonb_build_object('accepted', true, 'duplicate', true);
  END IF;

  IF p_type = 'delivered' THEN
    UPDATE public.sf_story_invitations
    SET delivered_at = coalesce(delivered_at, p_occurred),
        status = CASE WHEN status IN ('draft','sent') THEN 'delivered' ELSE status END,
        updated_at = now()
    WHERE id = v_invitation.id;
    UPDATE public.sf_story_invitation_delivery_attempts SET state = 'delivered', updated_at = now()
    WHERE id = v_attempt.id AND state = 'accepted';
  ELSIF p_type = 'opened_approximate' THEN
    UPDATE public.sf_story_invitations
    SET opened_at = coalesce(opened_at, p_occurred), updated_at = now()
    WHERE id = v_invitation.id;
  ELSIF p_type = 'bounced' THEN
    IF v_invitation.active_delivery_attempt_id IS NOT NULL
       AND v_invitation.active_delivery_attempt_id <> v_attempt.id THEN
      UPDATE public.sf_story_invitation_delivery_attempts
      SET state = 'abandoned', failure_reason = 'provider_bounce',
          resolved_at = now(), updated_at = now()
      WHERE id = v_invitation.active_delivery_attempt_id
        AND state IN ('reserved','dispatching','ambiguous');
    END IF;
    UPDATE public.sf_story_invitations
    SET bounced_at = coalesce(bounced_at, p_occurred),
        bounce_reason = coalesce(bounce_reason, left(p_reason, 500)),
        status = CASE WHEN status IN ('draft','sent','delivered','link_visited','started') THEN 'bounced' ELSE status END,
        token_hash = NULL, active_delivery_attempt_id = NULL, delivery_state = NULL,
        row_version = row_version + 1, updated_at = now()
    WHERE id = v_invitation.id;
    UPDATE public.sf_story_invitation_delivery_attempts SET state = 'bounced', updated_at = now()
    WHERE id = v_attempt.id AND state IN ('accepted','delivered');
  ELSE
    IF v_invitation.active_delivery_attempt_id IS NOT NULL
       AND v_invitation.active_delivery_attempt_id <> v_attempt.id THEN
      UPDATE public.sf_story_invitation_delivery_attempts
      SET state = 'abandoned', failure_reason = 'spam_complaint',
          resolved_at = now(), updated_at = now()
      WHERE id = v_invitation.active_delivery_attempt_id
        AND state IN ('reserved','dispatching','ambiguous');
    END IF;
    INSERT INTO public.sf_story_invitation_suppressions (
      email_hash, reason, source_invitation_id, provider_event_id, suppressed_at
    ) VALUES (
      encode(digest(convert_to(lower(btrim(v_invitation.email)), 'UTF8'), 'sha256'), 'hex'),
      'spam_complaint', v_invitation.id, p_event_id, p_occurred
    ) ON CONFLICT (email_hash) DO NOTHING;
    UPDATE public.sf_story_invitations
    SET suppressed_at = coalesce(suppressed_at, p_occurred),
        suppression_reason = 'spam_complaint', token_hash = NULL,
        active_delivery_attempt_id = NULL, delivery_state = NULL,
        row_version = row_version + 1, updated_at = now()
    WHERE id = v_invitation.id;
    UPDATE public.sf_story_invitation_delivery_attempts SET state = 'complained', updated_at = now()
    WHERE id = v_attempt.id AND state IN ('accepted','delivered');
  END IF;
  RETURN jsonb_build_object('accepted', true);
END
$$;

-- The read-only prepare functions remain available to the authenticated dry-run
-- preview path. The unsafe post-provider mutation functions are retired.
REVOKE ALL ON FUNCTION public.sf_request_prepare_send(uuid,bigint)
  FROM PUBLIC, anon, storyforge_app;
REVOKE ALL ON FUNCTION public.sf_request_prepare_reminder(uuid,bigint)
  FROM PUBLIC, anon, storyforge_app;
GRANT EXECUTE ON FUNCTION public.sf_request_prepare_send(uuid,bigint),
  public.sf_request_prepare_reminder(uuid,bigint) TO authenticated;
REVOKE ALL ON FUNCTION public.sf_request_mark_sent(uuid,bigint,text,text)
  FROM PUBLIC, anon, authenticated, storyforge_app;
REVOKE ALL ON FUNCTION public.sf_request_mark_reminded(uuid,bigint,text,text)
  FROM PUBLIC, anon, authenticated, storyforge_app;

REVOKE ALL ON FUNCTION public.sf_request_reserve_delivery(uuid,bigint,text,text)
  FROM PUBLIC, anon, storyforge_app;
GRANT EXECUTE ON FUNCTION public.sf_request_reserve_delivery(uuid,bigint,text,text)
  TO authenticated;

REVOKE ALL ON FUNCTION public.sf_request_claim_delivery_attempt(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sf_request_accept_delivery(uuid,text,text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sf_request_mark_delivery_ambiguous(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sf_request_fail_delivery(uuid,text,text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sf_request_provider_event_resolve(text,text,text,timestamptz,text,uuid,uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sf_request_claim_delivery_attempt(uuid),
  public.sf_request_accept_delivery(uuid,text,text),
  public.sf_request_mark_delivery_ambiguous(uuid),
  public.sf_request_fail_delivery(uuid,text,text),
  public.sf_request_provider_event_resolve(text,text,text,timestamptz,text,uuid,uuid)
  TO storyforge_app;

COMMIT;
