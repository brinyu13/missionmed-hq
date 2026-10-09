-- Migration: 20261009105221_dr_410_usce_offer_options.sql
-- Authority: DR-410; USCE-CLINICALS-HQ-V3-20261009
-- Date: 2026-10-09
-- Depends on: 20261009090305_usce_v3_communications.sql
-- Description: Canonical alternatives within one revision-bound Offer and validated applicant selection.
-- Idempotent: YES
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
LOCK TABLE command_center.usce_offer_drafts IN ACCESS EXCLUSIVE MODE;
DO $$ BEGIN
 PERFORM set_config('usce.options_preimage', (SELECT md5(coalesce(jsonb_agg(to_jsonb(o)-'options'-'selected_option_id'-'selected_option' ORDER BY id),'[]'::jsonb)::text) FROM command_center.usce_offer_drafts o),true);
END $$;
ALTER TABLE command_center.usce_offer_drafts
 ADD COLUMN IF NOT EXISTS options jsonb NOT NULL DEFAULT '[]',
 ADD COLUMN IF NOT EXISTS selected_option_id uuid,
 ADD COLUMN IF NOT EXISTS selected_option jsonb;

CREATE OR REPLACE FUNCTION command_center.usce_normalize_offer_options(p_options jsonb)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
DECLARE v jsonb; result jsonb := '[]'; ids uuid[] := '{}'; option_id uuid; k text; limit_length int; start_date date; end_date date;
BEGIN
 IF jsonb_typeof(p_options) IS DISTINCT FROM 'array' OR jsonb_array_length(p_options)>5 THEN
  RAISE EXCEPTION 'invalid_offer_options' USING ERRCODE='22023';
 END IF;
 FOR v IN SELECT value FROM jsonb_array_elements(p_options) LOOP
  IF jsonb_typeof(v) IS DISTINCT FROM 'object' OR coalesce(v->>'id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
   RAISE EXCEPTION 'invalid_offer_options' USING ERRCODE='22023';
  END IF;
  option_id := (v->>'id')::uuid;
  IF option_id=ANY(ids) THEN RAISE EXCEPTION 'invalid_offer_options' USING ERRCODE='22023'; END IF;
  ids := array_append(ids,option_id);
  FOREACH k IN ARRAY ARRAY['program_type','specialty','location','month_label'] LOOP
   limit_length := CASE WHEN k IN ('program_type','specialty') THEN 160 ELSE 180 END;
   IF jsonb_typeof(v->k) IS DISTINCT FROM 'string' OR length(trim(v->>k)) NOT BETWEEN 1 AND limit_length OR v->>k ~ '[[:cntrl:]]' THEN
    RAISE EXCEPTION 'invalid_offer_options' USING ERRCODE='22023';
   END IF;
  END LOOP;
  IF jsonb_typeof(v->'duration_weeks') IS DISTINCT FROM 'number' OR (v->>'duration_weeks') !~ '^[0-9]+$'
     OR (v->>'duration_weeks')::numeric NOT BETWEEN 1 AND 24 THEN
   RAISE EXCEPTION 'invalid_offer_options' USING ERRCODE='22023';
  END IF;
  start_date := NULL; end_date := NULL;
  IF nullif(v->>'date_window_start','') IS NOT NULL THEN
   IF v->>'date_window_start' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN RAISE EXCEPTION 'invalid_offer_options' USING ERRCODE='22023'; END IF;
   start_date := (v->>'date_window_start')::date;
  END IF;
  IF nullif(v->>'date_window_end','') IS NOT NULL THEN
   IF v->>'date_window_end' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN RAISE EXCEPTION 'invalid_offer_options' USING ERRCODE='22023'; END IF;
   end_date := (v->>'date_window_end')::date;
   IF start_date IS NULL OR end_date<start_date THEN RAISE EXCEPTION 'invalid_offer_options' USING ERRCODE='22023'; END IF;
  END IF;
  result := result || jsonb_build_array(jsonb_build_object('id',option_id,'program_type',trim(v->>'program_type'),
    'specialty',trim(v->>'specialty'),'location',trim(v->>'location'),'month_label',trim(v->>'month_label'),
    'duration_weeks',(v->>'duration_weeks')::int,'date_window_start',start_date,'date_window_end',end_date));
 END LOOP;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION command_center.usce_normalize_offer_options(jsonb) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION command_center.usce_revision_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 NEW.options := command_center.usce_normalize_offer_options(NEW.options);
 IF jsonb_array_length(NEW.options)>0 THEN
  NEW.specialty := NEW.options->0->>'specialty'; NEW.location := NEW.options->0->>'location';
  NEW.timing := NEW.options->0->>'month_label'; NEW.format := NEW.options->0->>'program_type';
  NEW.duration_weeks := (NEW.options->0->>'duration_weeks')::int;
 END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.selected_option_id IS NOT NULL OR NEW.selected_option IS NOT NULL THEN RAISE EXCEPTION 'selection_requires_response' USING ERRCODE='22023'; END IF;
  RETURN NEW;
 END IF;
 IF ROW(NEW.selected_option_id,NEW.selected_option) IS DISTINCT FROM ROW(OLD.selected_option_id,OLD.selected_option) THEN
  IF OLD.status NOT IN ('ready','sent','viewed') OR NEW.status <> 'accepted'
    OR OLD.selected_option_id IS NOT NULL OR NEW.selected_option_id IS NULL
    OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(OLD.options) x WHERE x->>'id'=NEW.selected_option_id::text AND x=NEW.selected_option) THEN
   RAISE EXCEPTION 'invalid_option_selection' USING ERRCODE='40001';
  END IF;
 END IF;
 IF ROW(NEW.options,NEW.specialty,NEW.location,NEW.timing,NEW.duration_weeks,NEW.format,NEW.expires_at,NEW.admin_message,NEW.payment_url,NEW.offer_token_hash,NEW.offer_token_expires_at)
    IS DISTINCT FROM ROW(OLD.options,OLD.specialty,OLD.location,OLD.timing,OLD.duration_weeks,OLD.format,OLD.expires_at,OLD.admin_message,OLD.payment_url,OLD.offer_token_hash,OLD.offer_token_expires_at) THEN
  IF OLD.status IN ('accepted','declined','alternate_requested','decline_pending','declined_notify_future','declined_no_notify','expired','archived') THEN
   RAISE EXCEPTION 'Responded or closed USCE terms cannot be revised' USING ERRCODE='40001';
  END IF;
  IF EXISTS (SELECT 1 FROM command_center.usce_send_claims c WHERE c.offer_id=OLD.id AND c.state IN ('claimed','ambiguous')) THEN
   RAISE EXCEPTION 'USCE send requires reconciliation before revision' USING ERRCODE='40001';
  END IF;
  NEW.revision := OLD.revision+1;
  NEW.preview_hash := NULL; NEW.preview_revision := NULL; NEW.preview_payload := NULL;
  NEW.message_previewed_at := NULL;
  -- Rotating the token is intentional; changing terms revokes the prior token.
  IF NEW.offer_token_hash IS NOT DISTINCT FROM OLD.offer_token_hash THEN
   NEW.offer_token_hash := NULL; NEW.offer_token_expires_at := NULL;
  END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION command_center.usce_revision_guard() FROM PUBLIC,anon,authenticated;

DROP TRIGGER IF EXISTS usce_revision_guard ON command_center.usce_offer_drafts;
CREATE TRIGGER usce_revision_guard BEFORE INSERT OR UPDATE ON command_center.usce_offer_drafts FOR EACH ROW EXECUTE FUNCTION command_center.usce_revision_guard();

CREATE OR REPLACE FUNCTION public.respond_usce_offer_by_token_hash(p_token_hash text, p_action text, p_note text DEFAULT NULL::text, p_consent boolean DEFAULT false, p_metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'command_center', 'public', 'pg_temp'
AS $function$
DECLARE
  v_offer command_center.usce_offer_drafts%ROWTYPE;
  v_action text := lower(trim(coalesce(p_action, '')));
  v_target_status text;
  v_event_type text;
  v_event_subject text;
  v_default_body text;
  v_response_note text := left(regexp_replace(coalesce(p_note, ''), '[[:cntrl:]]+', ' ', 'g'), 1000);
  v_metadata jsonb := coalesce(p_metadata, '{}'::jsonb);
  v_notify_future_rotations boolean;
  v_comm_id uuid;
  v_selected jsonb;
  v_selection_id uuid;
BEGIN
  IF v_action NOT IN (
    'accept',
    'decline',
    'request_alternate',
    'decline_pending',
    'decline_notify_future',
    'decline_no_notify'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_action');
  END IF;

  SELECT * INTO v_offer
  FROM command_center.usce_offer_drafts
  WHERE offer_token_hash = p_token_hash
  FOR UPDATE;

  IF NOT FOUND OR v_offer.status IN ('draft', 'archived') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_token');
  END IF;

  -- A pending decline cannot become acceptance or alternate selection.
  IF v_offer.status = 'decline_pending' AND v_action NOT IN ('decline_pending','decline_notify_future','decline_no_notify') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_responded');
  END IF;
  -- Response deadline and token lifetime are independent. Completed responses remain canonical.
  IF v_offer.status IN ('ready','sent','viewed') AND (v_offer.expires_at IS NULL OR v_offer.expires_at <= now()) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'expired');
  END IF;

  IF v_offer.offer_token_expires_at IS NULL OR v_offer.offer_token_expires_at <= now() THEN
    UPDATE command_center.usce_offer_drafts
    SET status = 'expired'
    WHERE id = v_offer.id
      AND status NOT IN (
        'accepted',
        'declined',
        'alternate_requested',
        'declined_notify_future',
        'declined_no_notify',
        'archived'
      );
    RETURN jsonb_build_object('ok', false, 'error', 'expired');
  END IF;

  v_target_status := CASE v_action
    WHEN 'accept' THEN 'accepted'
    WHEN 'decline' THEN 'declined'
    WHEN 'request_alternate' THEN 'alternate_requested'
    WHEN 'decline_pending' THEN 'decline_pending'
    WHEN 'decline_notify_future' THEN 'declined_notify_future'
    ELSE 'declined_no_notify'
  END;

  v_notify_future_rotations := CASE v_action
    WHEN 'decline_notify_future' THEN true
    WHEN 'decline_no_notify' THEN false
    ELSE NULL
  END;

  IF v_action='accept' AND jsonb_array_length(v_offer.options)>0 THEN
    IF coalesce(v_metadata->>'expected_revision','') !~ '^[0-9]{1,16}$' THEN
      RETURN jsonb_build_object('ok',false,'error','stale_revision');
    END IF;
    IF (v_metadata->>'expected_revision')::bigint IS DISTINCT FROM v_offer.revision THEN
      RETURN jsonb_build_object('ok',false,'error','stale_revision');
    END IF;
    IF coalesce(v_metadata->>'selected_option_id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
      RETURN jsonb_build_object('ok',false,'error','invalid_option_selection');
    END IF;
    v_selection_id := (v_metadata->>'selected_option_id')::uuid;
    SELECT value INTO v_selected FROM jsonb_array_elements(v_offer.options) WHERE value->>'id'=v_selection_id::text;
    IF v_selected IS NULL THEN RETURN jsonb_build_object('ok',false,'error','invalid_option_selection'); END IF;
    IF v_offer.status='accepted' AND v_offer.selected_option_id IS DISTINCT FROM v_selection_id THEN
      RETURN jsonb_build_object('ok',false,'error','option_selection_conflict');
    END IF;
  ELSIF v_action='accept' AND nullif(v_metadata->>'selected_option_id','') IS NOT NULL THEN
    RETURN jsonb_build_object('ok',false,'error','invalid_option_selection');
  END IF;

  IF v_offer.status = v_target_status THEN
    RETURN jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'offer', public.usce_offer_student_json(v_offer.id, v_target_status = 'accepted')
    );
  END IF;

  IF v_offer.status IN (
    'accepted',
    'declined',
    'alternate_requested',
    'declined_notify_future',
    'declined_no_notify'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_responded');
  END IF;

  IF v_action IN ('decline_notify_future', 'decline_no_notify')
     AND v_offer.status <> 'decline_pending' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_state');
  END IF;

  IF v_offer.status NOT IN ('ready', 'sent', 'viewed', 'decline_pending') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_state');
  END IF;

  UPDATE command_center.usce_offer_drafts
  SET status = v_target_status,
      selected_option_id = CASE WHEN v_action='accept' THEN v_selection_id ELSE selected_option_id END,
      selected_option = CASE WHEN v_action='accept' THEN v_selected ELSE selected_option END,
      accepted_at = CASE WHEN v_action = 'accept' THEN now() ELSE accepted_at END,
      declined_at = CASE WHEN v_action IN ('decline', 'decline_notify_future', 'decline_no_notify') THEN now() ELSE declined_at END,
      alternate_requested_at = CASE WHEN v_action = 'request_alternate' THEN now() ELSE alternate_requested_at END,
      payment_status = CASE WHEN v_action = 'accept' THEN 'handoff_shown' ELSE payment_status END,
      payment_checked_at = CASE WHEN v_action = 'accept' THEN now() ELSE payment_checked_at END,
      student_response_note = v_response_note,
      metadata = metadata
        || jsonb_build_object(
          'last_student_response', jsonb_build_object(
            'action', v_action,
            'target_status', v_target_status,
            'consent', coalesce(p_consent, false),
            'metadata', v_metadata,
            'notify_future_rotations', v_notify_future_rotations,
            'recorded_at', now()
          )
        )
        || CASE
          WHEN v_action IN ('decline_notify_future', 'decline_no_notify') THEN
            jsonb_build_object(
              'decline_confirmation', jsonb_build_object(
                'notify_future_rotations', v_notify_future_rotations,
                'recorded_at', now()
              )
            )
          ELSE '{}'::jsonb
        END
  WHERE id = v_offer.id
  RETURNING * INTO v_offer;

  v_event_type := CASE v_action
    WHEN 'accept' THEN 'student_accepted_offer'
    WHEN 'decline' THEN 'student_declined_offer'
    WHEN 'request_alternate' THEN 'student_requested_alternate'
    WHEN 'decline_pending' THEN 'student_decline_pending'
    WHEN 'decline_notify_future' THEN 'student_declined_offer_notify_future'
    ELSE 'student_declined_offer_no_notify'
  END;

  v_event_subject := CASE v_action
    WHEN 'accept' THEN 'Student accepted USCE offer'
    WHEN 'decline' THEN 'Student declined USCE offer'
    WHEN 'request_alternate' THEN 'Student requested alternate USCE option'
    WHEN 'decline_pending' THEN 'Student opened decline confirmation'
    WHEN 'decline_notify_future' THEN 'Student declined USCE offer and wants future rotation notifications'
    ELSE 'Student declined USCE offer and does not want future rotation notifications'
  END;

  v_default_body := CASE v_action
    WHEN 'decline_pending' THEN 'Student opened the decline confirmation page. Final notify preference is still required.'
    WHEN 'decline_notify_future' THEN 'Student declined and asked to be notified about future rotations.'
    WHEN 'decline_no_notify' THEN 'Student declined and does not want future rotation notifications.'
    ELSE 'Student response recorded through tokenized offer portal.'
  END;

  v_comm_id := command_center.usce_log_offer_engine_comm(
    v_offer.id,
    v_offer.intake_request_id,
    v_event_type,
    'SYS',
    v_event_subject,
    coalesce(nullif(v_response_note, ''), v_default_body),
    jsonb_build_object(
      'action', v_action,
      'target_status', v_target_status,
      'notify_future_rotations', v_notify_future_rotations,
      'metadata', v_metadata
    ),
    NULL,
    false,
    NULL,
    NULL
  );

  IF v_action = 'accept' THEN
    PERFORM command_center.usce_log_offer_engine_comm(
      v_offer.id,
      v_offer.intake_request_id,
      'payment_handoff_shown',
      'SYS',
      'WooCommerce payment handoff shown',
      'Canonical MissionMed USCE Clinical Rotations payment handoff was returned after acceptance. No order or payment was created by MissionMed HQ.',
      jsonb_build_object(
        'payment_url', v_offer.payment_url,
        'payment_status', v_offer.payment_status,
        'student_response_comms_id', v_comm_id
      ),
      NULL,
      false,
      NULL,
      NULL
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'offer', public.usce_offer_student_json(v_offer.id, v_target_status = 'accepted'),
    'comms_id', v_comm_id
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.save_usce_offer_draft(p_intake_request_id uuid, p_offer jsonb, p_admin_identity jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'command_center', 'public', 'pg_temp'
AS $function$
DECLARE
  v_offer command_center.usce_offer_drafts%ROWTYPE;
  v_admin text := left(coalesce(p_admin_identity->>'login', p_admin_identity->>'wp_id', 'unknown'), 160);
  v_duration integer;
  v_existing_id uuid;
  v_expires_at timestamptz;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM command_center.usce_public_intake_requests
    WHERE id = p_intake_request_id
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'intake_not_found');
  END IF;

  SELECT id INTO v_existing_id FROM command_center.usce_offer_drafts WHERE intake_request_id=p_intake_request_id FOR UPDATE;
  IF FOUND THEN RETURN public.update_usce_offer_draft(v_existing_id,p_offer,p_admin_identity); END IF;

  IF coalesce(p_offer->>'duration_weeks', '') ~ '^[0-9]+$' THEN
    v_duration := (p_offer->>'duration_weeks')::integer;
  END IF;

  IF nullif(p_offer->>'expires_at', '') IS NOT NULL THEN
    v_expires_at := (p_offer->>'expires_at')::timestamptz;
  ELSE
    v_expires_at := now() + interval '14 days';
  END IF;

  INSERT INTO command_center.usce_offer_drafts (
    intake_request_id,
    created_by,
    updated_by,
    status,
    specialty,
    location,
    timing,
    duration_weeks,
    format,
    expires_at,
    admin_message,
    payment_url,
    metadata,
    options
  )
  VALUES (
    p_intake_request_id,
    v_admin,
    v_admin,
    coalesce(nullif(p_offer->>'status', ''), 'draft'),
    nullif(p_offer->>'specialty', ''),
    nullif(p_offer->>'location', ''),
    nullif(p_offer->>'timing', ''),
    v_duration,
    coalesce(nullif(p_offer->>'format', ''), 'In-person clinical exposure'),
    v_expires_at,
    nullif(p_offer->>'admin_message', ''),
    'https://missionmedinstitute.com/product/usce-clinical-rotations/',
    jsonb_build_object(
      'source', 'CX-OFFER-315',
      'admin_identity', p_admin_identity,
      'draft_metadata', coalesce(p_offer->'metadata', '{}'::jsonb)
    ),
    coalesce(p_offer->'options','[]'::jsonb)
  )
  ON CONFLICT (intake_request_id) DO NOTHING
  RETURNING * INTO v_offer;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','stale_revision'); END IF;

  RETURN jsonb_build_object('ok', true, 'item', public.usce_offer_draft_admin_json(v_offer.id));
END;
$function$;


CREATE OR REPLACE FUNCTION public.update_usce_offer_draft(p_offer_id uuid, p_offer jsonb, p_admin_identity jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'command_center', 'public', 'pg_temp'
AS $function$
DECLARE
  v_offer command_center.usce_offer_drafts%ROWTYPE;
  v_existing command_center.usce_offer_drafts%ROWTYPE;
  v_admin text := left(coalesce(p_admin_identity->>'login', p_admin_identity->>'wp_id', 'unknown'), 160);
  v_duration integer;
  v_expires_at timestamptz;
  v_status text := nullif(p_offer->>'status', '');
BEGIN
  SELECT * INTO v_existing
  FROM command_center.usce_offer_drafts
  WHERE id = p_offer_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  IF v_existing.status IN ('accepted', 'declined', 'alternate_requested', 'expired', 'archived', 'decline_pending', 'declined_notify_future', 'declined_no_notify') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_state');
  END IF;

  IF (p_offer->>'expected_revision')::bigint IS DISTINCT FROM v_existing.revision THEN
    RETURN jsonb_build_object('ok', false, 'error', 'stale_revision');
  END IF;
  IF coalesce(p_offer->>'duration_weeks', '') ~ '^[0-9]+$' THEN
    v_duration := (p_offer->>'duration_weeks')::integer;
  ELSE
    v_duration := v_existing.duration_weeks;
  END IF;

  IF nullif(p_offer->>'expires_at', '') IS NOT NULL THEN
    v_expires_at := (p_offer->>'expires_at')::timestamptz;
  ELSE
    v_expires_at := v_existing.expires_at;
  END IF;

  UPDATE command_center.usce_offer_drafts
  SET options = CASE WHEN p_offer ? 'options' THEN p_offer->'options' ELSE options END,
      updated_by = v_admin,
      status = coalesce(v_status, status),
      specialty = coalesce(nullif(p_offer->>'specialty', ''), specialty),
      location = coalesce(nullif(p_offer->>'location', ''), location),
      timing = coalesce(nullif(p_offer->>'timing', ''), timing),
      duration_weeks = v_duration,
      format = coalesce(nullif(p_offer->>'format', ''), format),
      expires_at = v_expires_at,
      admin_message = CASE WHEN p_offer ? 'admin_message' THEN nullif(p_offer->>'admin_message','') ELSE admin_message END,
      metadata = metadata || jsonb_build_object(
        'last_admin_update', p_admin_identity,
        'draft_metadata', coalesce(p_offer->'metadata', '{}'::jsonb)
      )
  WHERE id = p_offer_id
  RETURNING * INTO v_offer;

  RETURN jsonb_build_object('ok', true, 'item', public.usce_offer_draft_admin_json(v_offer.id));
END;
$function$;


CREATE OR REPLACE FUNCTION public.usce_offer_student_json(p_offer_id uuid, p_include_payment boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'command_center', 'public', 'pg_temp'
AS $function$
  SELECT jsonb_build_object(
    'id', o.id,
    'options', o.options,
    'selected_option_id', o.selected_option_id,
    'selected_option', o.selected_option,
    'offer_id', o.id,
    'revision', o.revision,
    'status', o.status,
    'specialty', coalesce(o.specialty, 'To be confirmed'),
    'location', coalesce(o.location, 'To be confirmed'),
    'timing', coalesce(o.timing, 'To be confirmed'),
    'duration', CASE WHEN o.duration_weeks IS NULL THEN 'To be confirmed' ELSE o.duration_weeks::text || ' weeks' END,
    'format', coalesce(o.format, 'In-person clinical exposure'),
    'reference', 'USCE-' || upper(left(replace(o.id::text, '-', ''), 8)),
    'deadlineLabel', CASE
      WHEN o.expires_at IS NULL THEN 'Response deadline will be confirmed by your coordinator.'
      ELSE 'Please respond before ' || to_char(o.expires_at AT TIME ZONE 'America/New_York', 'Mon DD, YYYY HH12:MI AM') || ' ET.'
    END,
    'deadlineDetail', 'After the deadline this offer expires automatically and a new option may be prepared.',
    'message', coalesce(o.admin_message, o.message_body, 'Thank you for your USCE rotation request. Please review the option above and choose accept, decline, or request an alternate.'),
    'expiresAt', o.expires_at,
    'payment_url', CASE WHEN p_include_payment THEN 'https://missionmedinstitute.com/product/us-clinical-rotations/' ELSE NULL END,
    'payment_status', o.payment_status,
    'paperwork_status', o.paperwork_status,
    'learndash_status', o.learndash_status,
    'next_steps', jsonb_build_object(
      'payment', CASE WHEN p_include_payment THEN 'Payment handoff is available after acceptance.' ELSE 'Payment is only shown after acceptance.' END,
      'paperwork', 'Onboarding paperwork follows coordinator confirmation and payment readiness.',
      'course_access', 'Course access is enabled only after downstream MissionMed approval gates.'
    )
  )
  FROM command_center.usce_offer_drafts o
  WHERE o.id = p_offer_id;
$function$;


CREATE OR REPLACE FUNCTION public.usce_offer_draft_admin_json(p_offer_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'command_center', 'public', 'pg_temp'
AS $function$
  SELECT jsonb_build_object(
    'id', o.id,
    'options', o.options,
    'selected_option_id', o.selected_option_id,
    'selected_option', o.selected_option,
    'revision', o.revision,
    'intake_request_id', o.intake_request_id,
    'created_at', o.created_at,
    'updated_at', o.updated_at,
    'status', o.status,
    'specialty', o.specialty,
    'location', o.location,
    'timing', o.timing,
    'duration_weeks', o.duration_weeks,
    'format', o.format,
    'expires_at', o.expires_at,
    'admin_message', o.admin_message,
    'payment_url', o.payment_url,
    'has_token', o.offer_token_hash IS NOT NULL,
    'offer_token_expires_at', o.offer_token_expires_at,
    'accepted_at', o.accepted_at,
    'declined_at', o.declined_at,
    'alternate_requested_at', o.alternate_requested_at,
    'student_response_note', o.student_response_note,
    'message_category', o.message_category,
    'message_variant', o.message_variant,
    'message_subject', o.message_subject,
    'message_body', o.message_body,
    'message_previewed_at', o.message_previewed_at,
    'message_sent_at', o.message_sent_at,
    'postmark_status', o.postmark_status,
    'payment_status', o.payment_status,
    'payment_reference', o.payment_reference,
    'payment_checked_at', o.payment_checked_at,
    'paperwork_status', o.paperwork_status,
    'paperwork_updated_at', o.paperwork_updated_at,
    'learndash_status', o.learndash_status,
    'learndash_updated_at', o.learndash_updated_at,
    'metadata', o.metadata,
    'intake', jsonb_build_object(
      'student_name', r.student_name,
      'email', r.email,
      'status', r.status,
      'preferred_specialties', r.preferred_specialties,
      'preferred_locations', r.preferred_locations,
      'preferred_months_or_dates', r.preferred_months_or_dates,
      'duration_weeks', r.duration_weeks
    )
  )
  FROM command_center.usce_offer_drafts o
  JOIN command_center.usce_public_intake_requests r ON r.id = o.intake_request_id
  WHERE o.id = p_offer_id;
$function$;


CREATE OR REPLACE FUNCTION public.list_usce_public_intake_requests(p_limit integer DEFAULT 50, p_offset integer DEFAULT 0, p_status text DEFAULT NULL::text, p_search text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'command_center', 'public', 'pg_temp'
AS $function$
DECLARE
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100);
  v_offset integer := GREATEST(COALESCE(p_offset, 0), 0);
  v_status text := NULLIF(LOWER(TRIM(COALESCE(p_status, ''))), '');
  v_search text := NULLIF(LOWER(TRIM(COALESCE(p_search, ''))), '');
BEGIN
  RETURN (
    WITH hydrated AS (
      SELECT
        r.*,
        offer.latest_offer,
        CASE
          WHEN offer.latest_offer IS NULL THEN LOWER(COALESCE(r.status, 'new'))
          WHEN offer.latest_offer->>'accepted_at' IS NOT NULL
            OR LOWER(COALESCE(offer.latest_offer->>'status', '')) IN ('accepted', 'offer_accepted')
            THEN 'offer_accepted'
          WHEN LOWER(COALESCE(offer.latest_offer->>'status', '')) IN ('decline_pending', 'offer_decline_pending')
            THEN 'offer_decline_pending'
          WHEN LOWER(COALESCE(offer.latest_offer->>'status', '')) IN ('declined_notify_future', 'offer_declined_notify_future')
            THEN 'offer_declined_notify_future'
          WHEN LOWER(COALESCE(offer.latest_offer->>'status', '')) IN ('declined_no_notify', 'offer_declined_no_notify', 'declined')
            THEN 'offer_declined_no_notify'
          WHEN offer.latest_offer->>'declined_at' IS NOT NULL
            AND LOWER(COALESCE(offer.latest_offer #>> '{metadata,notify_future_rotations}', '')) IN ('true', '1', 'yes')
            THEN 'offer_declined_notify_future'
          WHEN offer.latest_offer->>'declined_at' IS NOT NULL
            THEN 'offer_declined_no_notify'
          WHEN offer.latest_offer->>'message_sent_at' IS NOT NULL
            OR LOWER(COALESCE(offer.latest_offer->>'status', '')) IN ('sent', 'offer_sent', 'viewed')
            OR LOWER(COALESCE(offer.latest_offer->>'postmark_status', '')) IN ('dry_run', 'queued', 'sent', 'delivered')
            THEN 'offer_sent'
          ELSE LOWER(COALESCE(r.status, 'new'))
        END AS effective_status
      FROM command_center.usce_public_intake_requests r
      LEFT JOIN LATERAL (
        SELECT jsonb_strip_nulls(jsonb_build_object(
          'id', o.id,
          'revision', o.revision,
          'options', o.options,
          'selected_option_id', o.selected_option_id,
          'selected_option', o.selected_option,
          'intake_request_id', o.intake_request_id,
          'status', o.status,
          'specialty', o.specialty,
          'location', o.location,
          'timing', o.timing,
          'duration_weeks', o.duration_weeks,
          'format', o.format,
          'expires_at', o.expires_at,
          'payment_url', o.payment_url,
          'has_token', (o.offer_token_hash IS NOT NULL),
          'offer_token_expires_at', o.offer_token_expires_at,
          'accepted_at', o.accepted_at,
          'declined_at', o.declined_at,
          'alternate_requested_at', o.alternate_requested_at,
          'postmark_status', o.postmark_status,
          'message_previewed_at', o.message_previewed_at,
          'message_sent_at', o.message_sent_at,
          'payment_status', o.payment_status,
          'paperwork_status', o.paperwork_status,
          'learndash_status', o.learndash_status,
          'metadata', o.metadata
        )) AS latest_offer
        FROM command_center.usce_offer_drafts o
        WHERE o.intake_request_id = r.id
        ORDER BY COALESCE(o.message_sent_at, o.updated_at, o.created_at) DESC NULLS LAST
        LIMIT 1
      ) offer ON TRUE
    ),
    filtered AS (
      SELECT *
      FROM hydrated
      WHERE (
          v_status IS NULL
          OR LOWER(COALESCE(status, '')) = v_status
          OR effective_status = v_status
          OR (v_status = 'offer_ready' AND effective_status = 'offer_sent')
        )
        AND (
          v_search IS NULL
          OR LOWER(student_name) LIKE '%' || v_search || '%'
          OR LOWER(email) LIKE '%' || v_search || '%'
          OR LOWER(COALESCE(phone, '')) LIKE '%' || v_search || '%'
        )
    ),
    page AS (
      SELECT *
      FROM filtered
      ORDER BY created_at DESC
      LIMIT v_limit
      OFFSET v_offset
    )
    SELECT jsonb_build_object(
      'items', COALESCE((
        SELECT jsonb_agg(
          jsonb_strip_nulls(jsonb_build_object(
            'id', page.id,
            'created_at', page.created_at,
            'updated_at', page.updated_at,
            'status', page.status,
            'effective_status', page.effective_status,
            'student_name', page.student_name,
            'email', page.email,
            'phone', page.phone,
            'training_level_or_school', page.training_level_or_school,
            'preferred_specialties', page.preferred_specialties,
            'preferred_locations', page.preferred_locations,
            'preferred_months_or_dates', page.preferred_months_or_dates,
            'duration_weeks', page.duration_weeks,
            'flexibility', page.flexibility,
            'notes', page.notes,
            'source', page.source,
            'source_url', page.source_url,
            'promoted_usce_request_id', page.promoted_usce_request_id,
            'promoted_at', page.promoted_at,
            'admin_notes', page.admin_notes,
            'metadata', page.metadata,
            'latest_offer', page.latest_offer
          ))
          ORDER BY page.created_at DESC
        )
        FROM page
      ), '[]'::jsonb),
      'count', (SELECT COUNT(*) FROM filtered),
      'limit', v_limit,
      'offset', v_offset
    )
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.usce_bind_message_preview(p_offer_id uuid, p_message jsonb, p_admin_identity jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE o command_center.usce_offer_drafts%ROWTYPE; recipient text;
BEGIN
 SELECT * INTO o FROM command_center.usce_offer_drafts WHERE id=p_offer_id FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','not_found'); END IF;
 IF EXISTS(SELECT 1 FROM command_center.usce_send_claims WHERE offer_id=o.id AND state IN ('claimed','ambiguous')) THEN RETURN jsonb_build_object('ok',false,'error','send_requires_reconciliation'); END IF;
 IF o.status IN ('archived','expired') THEN RETURN jsonb_build_object('ok',false,'error','invalid_state'); END IF;
 IF (p_message->>'revision')::bigint IS DISTINCT FROM o.revision THEN RETURN jsonb_build_object('ok',false,'error','stale_revision'); END IF;
 IF jsonb_array_length(o.options)>0 AND (p_message#>'{rendered_email,offer_options}') IS DISTINCT FROM o.options THEN
  RETURN jsonb_build_object('ok',false,'error','options_preview_required');
 END IF;
 SELECT lower(email) INTO recipient FROM command_center.usce_public_intake_requests WHERE id=o.intake_request_id;
 IF recipient IS DISTINCT FROM lower(p_message->>'to_email') THEN RETURN jsonb_build_object('ok',false,'error','recipient_mismatch'); END IF;
 IF p_message->>'category' IS NULL OR p_message->>'category' NOT IN ('request_received','availability_confirmed','alternate_option_recommended','offer_ready','offer_reminder','accepted_offer_next_steps','declined_response','alternate_requested_response','payment_reminder') THEN
  RETURN jsonb_build_object('ok',false,'error','invalid_message_category');
 END IF;
 IF coalesce(p_message->>'preview_hash','') !~ '^[a-f0-9]{64}$' THEN RETURN jsonb_build_object('ok',false,'error','invalid_preview'); END IF;
 IF p_message->>'category' IN ('offer_ready','offer_reminder','alternate_option_recommended','availability_confirmed') THEN
  IF o.status IN ('accepted','declined','alternate_requested','decline_pending','declined_notify_future','declined_no_notify')
   OR o.offer_token_hash IS NULL OR o.offer_token_hash IS DISTINCT FROM p_message->>'link_token_hash'
   OR o.offer_token_expires_at IS NULL OR o.expires_at IS NULL OR o.offer_token_expires_at<=now() OR o.expires_at<=now() THEN
   RETURN jsonb_build_object('ok',false,'error','current_offer_link_required');
  END IF;
 END IF;
 UPDATE command_center.usce_offer_drafts SET preview_hash=p_message->>'preview_hash',preview_revision=o.revision,
 preview_payload=p_message-'link_token_hash',message_previewed_at=now(),
 message_category=p_message->>'category',message_variant=p_message->>'variant',
 message_subject=p_message->>'subject',message_body=p_message->>'body',
 updated_by=left(coalesce(p_admin_identity->>'login','unknown'),160)
 WHERE id=o.id;
 RETURN jsonb_build_object('ok',true,'item',public.usce_offer_draft_admin_json(o.id),
 'data',jsonb_build_object('preview_hash',p_message->>'preview_hash','revision',o.revision,'rendered_email',p_message->'rendered_email'));
END $function$;

CREATE OR REPLACE FUNCTION public.usce_claim_send(p_offer_id uuid, p_preview_hash text, p_revision bigint, p_idempotency_key text, p_mode text, p_admin_identity jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE o command_center.usce_offer_drafts%ROWTYPE; c command_center.usce_send_claims%ROWTYPE; recipient text;
BEGIN
 SELECT * INTO o FROM command_center.usce_offer_drafts WHERE id=p_offer_id FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','not_found'); END IF;
 SELECT * INTO c FROM command_center.usce_send_claims WHERE offer_id=o.id AND idempotency_key=p_idempotency_key;
 IF FOUND THEN
  IF c.preview_hash IS DISTINCT FROM p_preview_hash OR c.revision IS DISTINCT FROM p_revision OR c.mode IS DISTINCT FROM p_mode THEN
   RETURN jsonb_build_object('ok',false,'error','idempotency_conflict');
  END IF;
  RETURN jsonb_build_object('ok',true,'data',jsonb_build_object('claimed',false,'claim',to_jsonb(c)-'payload','item',public.usce_offer_draft_admin_json(o.id)));
 END IF;
 IF p_mode NOT IN ('live','dry_run') OR length(coalesce(p_idempotency_key,'')) NOT BETWEEN 1 AND 160 THEN RETURN jsonb_build_object('ok',false,'error','invalid_claim'); END IF;
 IF o.status IN ('archived','expired') OR o.revision IS DISTINCT FROM p_revision OR o.preview_revision IS DISTINCT FROM p_revision OR o.preview_hash IS DISTINCT FROM p_preview_hash OR o.preview_payload IS NULL THEN
  RETURN jsonb_build_object('ok',false,'error','stale_preview');
 END IF;
 IF jsonb_array_length(o.options)>0 AND (o.preview_payload#>'{rendered_email,offer_options}') IS DISTINCT FROM o.options THEN
  RETURN jsonb_build_object('ok',false,'error','options_preview_required');
 END IF;
 SELECT lower(email) INTO recipient FROM command_center.usce_public_intake_requests WHERE id=o.intake_request_id;
 IF recipient IS DISTINCT FROM lower(o.preview_payload->>'to_email') THEN RETURN jsonb_build_object('ok',false,'error','recipient_mismatch'); END IF;
 IF o.preview_payload->>'category' IN ('offer_ready','offer_reminder','alternate_option_recommended','availability_confirmed') AND
 (o.status IN ('accepted','declined','alternate_requested','decline_pending','declined_notify_future','declined_no_notify') OR o.offer_token_hash IS NULL OR o.offer_token_expires_at IS NULL OR o.expires_at IS NULL OR o.offer_token_expires_at<=now() OR o.expires_at<=now()) THEN
  RETURN jsonb_build_object('ok',false,'error','current_offer_link_required');
 END IF;
 IF EXISTS(SELECT 1 FROM command_center.usce_send_claims WHERE offer_id=o.id AND state IN ('claimed','ambiguous')) THEN
  RETURN jsonb_build_object('ok',false,'error','send_requires_reconciliation');
 END IF;
 INSERT INTO command_center.usce_send_claims(offer_id,revision,preview_hash,idempotency_key,mode,actor,payload)
 VALUES(o.id,o.revision,p_preview_hash,p_idempotency_key,p_mode,p_admin_identity,o.preview_payload)
 ON CONFLICT(offer_id,revision,preview_hash,mode) DO NOTHING RETURNING * INTO c;
 IF NOT FOUND THEN
  SELECT * INTO c FROM command_center.usce_send_claims WHERE offer_id=o.id AND revision=p_revision AND preview_hash=p_preview_hash AND mode=p_mode;
  RETURN jsonb_build_object('ok',true,'data',jsonb_build_object('claimed',false,'claim',to_jsonb(c)-'payload','item',public.usce_offer_draft_admin_json(o.id)));
 END IF;
 RETURN jsonb_build_object('ok',true,'data',jsonb_build_object('claimed',true,'claim',to_jsonb(c)-'payload','preview',c.payload));
END $function$;

CREATE OR REPLACE FUNCTION public.list_usce_student_status_offer_summaries(p_request_ids uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'command_center', 'public', 'pg_temp'
AS $function$
  BEGIN
    IF p_request_ids IS NULL OR array_length(p_request_ids, 1) IS NULL THEN
        RETURN jsonb_build_object('items', '[]'::jsonb);
          END IF;

            RETURN jsonb_build_object(
                'items',
                    COALESCE((
                          SELECT jsonb_agg(
                                  jsonb_build_object(
                                            'id', o.id,
                                                      'intake_request_id', o.intake_request_id,
                                                                'created_at', o.created_at,
                                                                          'updated_at', o.updated_at,
                                                                                    'status', o.status,
                                                                                              'specialty', CASE WHEN o.status='accepted' THEN coalesce(o.selected_option->>'specialty',o.specialty) ELSE o.specialty END,
                                                                                                        'location', CASE WHEN o.status='accepted' THEN coalesce(o.selected_option->>'location',o.location) ELSE o.location END,
                                                                                                                  'timing', CASE WHEN o.status='accepted' THEN coalesce(o.selected_option->>'month_label',o.timing) ELSE o.timing END,
                                                                                                                            'duration_weeks', CASE WHEN o.status='accepted' THEN coalesce((o.selected_option->>'duration_weeks')::integer,o.duration_weeks) ELSE o.duration_weeks END,
                                                                                                                                      'format', CASE WHEN o.status='accepted' THEN coalesce(o.selected_option->>'program_type',o.format) ELSE o.format END,
                                                                                                                                                'expires_at', o.expires_at,
                                                                                                                                                          'payment_url', o.payment_url,
                                                                                                                                                                    'offer_token_expires_at', o.offer_token_expires_at,
                                                                                                                                                                              'accepted_at', o.accepted_at,
                                                                                                                                                                                        'declined_at', o.declined_at,
                                                                                                                                                                                                  'alternate_requested_at', o.alternate_requested_at,
                                                                                                                                                                                                            'postmark_status', o.postmark_status,
                                                                                                                                                                                                                      'message_previewed_at', o.message_previewed_at,
                                                                                                                                                                                                                                'message_sent_at', o.message_sent_at,
                                                                                                                                                                                                                                          'payment_status', o.payment_status,
                                                                                                                                                                                                                                                    'payment_checked_at', o.payment_checked_at,
                                                                                                                                                                                                                                                              'paperwork_status', o.paperwork_status,
                                                                                                                                                                                                                                                                        'paperwork_updated_at', o.paperwork_updated_at,
                                                                                                                                                                                                                                                                                  'learndash_status', o.learndash_status,
                                                                                                                                                                                                                                                                                            'learndash_updated_at', o.learndash_updated_at
                                                                                                                                                                                                                                                                                                    )
                                                                                                                                                                                                                                                                                                            ORDER BY o.updated_at DESC
                                                                                                                                                                                                                                                                                                                  )
                                                                                                                                                                                                                                                                                                                        FROM command_center.usce_offer_drafts o
                                                                                                                                                                                                                                                                                                                              WHERE o.intake_request_id = ANY(p_request_ids)
                                                                                                                                                                                                                                                                                                                                  ), '[]'::jsonb)
                                                                                                                                                                                                                                                                                                                                    );
                                                                                                                                                                                                                                                                                                                                    END;
                                                                                                                                                                                                                                                                                                                                    $function$;

DO $$ BEGIN
 IF current_setting('usce.options_preimage') IS DISTINCT FROM (SELECT md5(coalesce(jsonb_agg(to_jsonb(o)-'options'-'selected_option_id'-'selected_option' ORDER BY id),'[]'::jsonb)::text) FROM command_center.usce_offer_drafts o) THEN
  RAISE EXCEPTION 'Existing Offer data changed during additive migration';
 END IF;
END $$;
COMMIT;
