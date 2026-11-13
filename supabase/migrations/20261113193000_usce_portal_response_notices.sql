-- DR-545. Guard the existing service-only RPCs before installing the forward change.
SET LOCAL lock_timeout = '5s';
DO $preimage$
BEGIN
  IF md5(pg_get_functiondef('public.usce_mail_dispatch(text,uuid,uuid,jsonb)'::regprocedure)) <> '4e29ad3e539d02afeb2eda963930f5a0'
    OR md5(pg_get_functiondef('public.respond_usce_offer_by_token_hash(text,text,text,boolean,jsonb)'::regprocedure)) <> 'c3008f6b5ecee38ef114715f4dbd1535'
    OR md5(pg_get_functiondef('command_center.usce_log_offer_engine_comm(uuid,uuid,text,text,text,text,jsonb,text,boolean,text,text)'::regprocedure)) <> '0b0ff70e941b342c55dacee7c4b585e7'
    OR md5(pg_get_functiondef('command_center.usce_mail_relevance(command_center.usce_comms)'::regprocedure)) <> '071a582ad16ea03bc051d0c9a5f05eee' THEN
    RAISE EXCEPTION 'USCE notification dependencies changed';
  END IF;
END
$preimage$;

-- The event is written by the student response RPC. A pending decline is a navigation
-- step; only the final decision produces a coordinator notice.
CREATE FUNCTION command_center.usce_portal_response_kind(c command_center.usce_comms)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT v.event_type
  FROM (VALUES
    ('accept', 'accepted', 'student_accepted_offer'),
    ('decline', 'declined', 'student_declined_offer'),
    ('request_alternate', 'alternate_requested', 'student_requested_alternate'),
    ('decline_notify_future', 'declined_notify_future', 'student_declined_offer_notify_future'),
    ('decline_no_notify', 'declined_no_notify', 'student_declined_offer_no_notify')
  ) AS v(action, target_status, event_type)
  WHERE c.direction = 'SYS' AND c.intake_request_id IS NOT NULL
    AND c.raw_json->>'source' = 'CX-OFFER-320'
    AND c.raw_json#>>'{metadata,source}' = 'usce_offer_portal'
    AND c.raw_json->>'action' = v.action
    AND c.raw_json->>'target_status' = v.target_status
    AND c.raw_json->>'event_type' = v.event_type;
$$;

CREATE FUNCTION command_center.usce_queue_portal_response_notice(p_offer_id uuid, p_event_id uuid)
RETURNS boolean LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  c command_center.usce_comms%ROWTYPE;
  kind text;
BEGIN
  SELECT e.* INTO STRICT c
    FROM command_center.usce_comms e
    JOIN command_center.usce_offer_drafts o ON o.id = p_offer_id AND o.intake_request_id = e.intake_request_id
    WHERE e.id = p_event_id AND e.raw_json->>'offer_draft_id' = o.id::text;
  kind := command_center.usce_portal_response_kind(c);
  IF kind IS NULL THEN RAISE EXCEPTION 'Not a completed student portal response'; END IF;
  INSERT INTO command_center.usce_outbox
    (entity_type, entity_id, action, payload, status, idempotency_key, dispatch_state)
  VALUES ('usce_comms', c.id, 'usce_v3_notify',
    jsonb_build_object('portal_response',kind,'message_id',c.id,'received_at',c.created_at),
    'pending', 'usce-portal-response:' || c.id, 'pending')
  ON CONFLICT (idempotency_key) DO NOTHING;
  RETURN FOUND;
END;
$$;

CREATE FUNCTION command_center.usce_notification_eligible(
  c command_center.usce_comms, job command_center.usce_outbox)
RETURNS boolean LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT c.id = job.entity_id AND (
    (c.direction = 'IN' AND NOT (job.payload ? 'portal_response') AND command_center.usce_mail_relevance(c) = 'student')
    OR (job.entity_type = 'usce_comms'
      AND job.idempotency_key = 'usce-portal-response:' || c.id
      AND job.payload->>'message_id' = c.id::text
      AND job.payload->>'portal_response' = command_center.usce_portal_response_kind(c))
  );
$$;

REVOKE ALL ON FUNCTION command_center.usce_portal_response_kind(command_center.usce_comms),
  command_center.usce_queue_portal_response_notice(uuid,uuid),
  command_center.usce_notification_eligible(command_center.usce_comms,command_center.usce_outbox)
  FROM PUBLIC, anon, authenticated, service_role;

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

  IF v_metadata->>'source' = 'usce_offer_portal' AND v_action <> 'decline_pending' THEN
    PERFORM command_center.usce_queue_portal_response_notice(v_offer.id, v_comm_id);
  END IF;

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

CREATE OR REPLACE FUNCTION public.usce_mail_dispatch(p_action text, p_id uuid DEFAULT NULL::uuid, p_attempt_id uuid DEFAULT NULL::uuid, p_data jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE o command_center.usce_outbox%ROWTYPE;v_outcome text:=p_data->>'outcome';v_items jsonb;v_count integer;
  event_id uuid;
  notice_body text;
  bound_payload jsonb;
BEGIN
 IF p_action='list' THEN
  SELECT coalesce(jsonb_agg(item ORDER BY at,id),'[]') INTO v_items FROM (
   SELECT x.created_at at,x.id,jsonb_build_object('id',x.id,'entity_id',x.entity_id,'action',x.action,'state',x.dispatch_state,'error',x.last_error,'created_at',x.created_at,'claimed_at',x.claimed_at,'attempts',x.retry_count,
    'can_retry',x.retry_count<3 AND ((x.dispatch_state='failed' AND coalesce((x.dispatch_evidence->>'proven_unsent')::boolean,false)) OR (x.action='usce_v3_notify' AND x.dispatch_state='claimed' AND NOT(x.payload ? 'to_email') AND x.claimed_at<now()-interval '120 seconds')),
    'can_reconcile',x.dispatch_state IN ('claimed','ambiguous') AND x.payload ? 'to_email') item
   FROM command_center.usce_outbox x WHERE x.action IN ('usce_v3_notify','usce_v3_correspondence') AND x.dispatch_state IN ('claimed','ambiguous','failed') ORDER BY x.created_at,x.id LIMIT 51) q;
  v_count:=jsonb_array_length(v_items);
  SELECT coalesce(jsonb_agg(value ORDER BY ord),'[]') INTO v_items FROM jsonb_array_elements(v_items) WITH ORDINALITY e(value,ord) WHERE ord<=50;
  RETURN jsonb_build_object('ok',true,'items',v_items,'has_more',v_count>50);
 END IF;
 IF p_action='claim_notification' THEN
  SELECT * INTO o FROM command_center.usce_outbox job WHERE action='usce_v3_notify' AND EXISTS(SELECT 1 FROM command_center.usce_comms c WHERE c.id=job.entity_id AND command_center.usce_notification_eligible(c,job)) AND dispatch_state='pending' AND (next_attempt_at IS NULL OR next_attempt_at<=now()) ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',true,'claimed',false); END IF;
  UPDATE command_center.usce_outbox SET dispatch_state='claimed',claimed_at=now(),attempt_id=gen_random_uuid(),retry_count=retry_count+1 WHERE id=o.id RETURNING * INTO o;
  RETURN jsonb_build_object('ok',true,'claimed',true,'dispatch',to_jsonb(o));
 END IF;
 SELECT * INTO o FROM command_center.usce_outbox WHERE id=p_id AND action IN ('usce_v3_notify','usce_v3_correspondence') FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','not_found'); END IF;
 IF p_action IN ('retry','bind_notification') AND o.action='usce_v3_notify' AND NOT EXISTS(SELECT 1 FROM command_center.usce_comms c WHERE c.id=o.entity_id AND command_center.usce_notification_eligible(c,o)) THEN RETURN jsonb_build_object('ok',false,'error','notification_not_student'); END IF;
 IF p_action='retry' THEN
  IF o.retry_count>=3 OR NOT((o.dispatch_state='failed' AND coalesce((o.dispatch_evidence->>'proven_unsent')::boolean,false)) OR (o.action='usce_v3_notify' AND o.dispatch_state='claimed' AND NOT(o.payload ? 'to_email') AND o.claimed_at<now()-interval '120 seconds')) THEN RETURN jsonb_build_object('ok',false,'error','retry_requires_proven_unsent'); END IF;
  UPDATE command_center.usce_outbox SET dispatch_state='claimed',status='pending',claimed_at=now(),attempt_id=gen_random_uuid(),retry_count=retry_count+1,last_error=NULL,dispatch_evidence='{}'::jsonb WHERE id=o.id RETURNING * INTO o;
  IF o.action='usce_v3_correspondence' THEN UPDATE command_center.usce_comms SET mail_state='queued' WHERE id=o.entity_id; END IF;
  RETURN jsonb_build_object('ok',true,'claimed',true,'dispatch',to_jsonb(o));
 END IF;
 IF p_action='get' THEN RETURN jsonb_build_object('ok',true,'dispatch',to_jsonb(o)); END IF;
 IF o.attempt_id IS DISTINCT FROM p_attempt_id OR o.dispatch_state NOT IN ('claimed','ambiguous') THEN RETURN jsonb_build_object('ok',false,'error','dispatch_locked'); END IF;
 IF p_action='bind_notification' THEN
  IF o.action<>'usce_v3_notify' OR o.payload ? 'to_email' OR p_data->>'to_email' IS DISTINCT FROM 'philaperri@gmail.com' OR p_data->>'from_email' IS DISTINCT FROM 'clinicals@missionmedinstitute.com' THEN RETURN jsonb_build_object('ok',false,'error','notification_locked'); END IF;
  bound_payload := p_data;
  IF o.payload ? 'portal_response' THEN
    -- The worker sends only the payload returned by this binding step. Keep student
    -- identifiers and note text out of the private-mailbox notification.
    event_id := o.entity_id;
    notice_body := 'A student responded to a clinical rotation Offer.' || chr(10) || chr(10)
      || 'Sign in to Clinicals HQ to review the response:' || chr(10)
      || 'https://missionmedinstitute.com/usce-admin/?conversation=' || event_id;
    bound_payload := jsonb_build_object(
      'message_id',event_id, 'to_email','philaperri@gmail.com',
      'from_email','clinicals@missionmedinstitute.com', 'reply_to','clinicals@missionmedinstitute.com',
      'subject','A student responded to a clinical rotation Offer', 'body_text',notice_body,
      'text_sha256',encode(sha256(convert_to(notice_body,'UTF8')),'hex'),
      'rfc_message_id','<usce-notify-' || o.id || '@missionmedinstitute.com>');
  END IF;
  UPDATE command_center.usce_outbox SET payload=payload||bound_payload WHERE id=o.id RETURNING * INTO o;
  RETURN jsonb_build_object('ok',true,'dispatch',to_jsonb(o));
 END IF;
 IF p_action<>'finish' OR v_outcome NOT IN ('provider_accepted','failed','ambiguous') OR (v_outcome='provider_accepted' AND nullif(p_data->>'provider_message_id','') IS NULL) THEN RETURN jsonb_build_object('ok',false,'error','invalid_outcome'); END IF;
 IF o.dispatch_state='ambiguous' AND (v_outcome<>'provider_accepted' OR p_data->>'evidence_source'<>'postmark_authenticated_readback') THEN RETURN jsonb_build_object('ok',false,'error','reconciliation_required'); END IF;
 UPDATE command_center.usce_outbox SET dispatch_evidence=jsonb_build_object('proven_unsent',coalesce((p_data->>'proven_unsent')::boolean,false),'attempted',p_data->'attempted','http_status',p_data->'http_status'),dispatch_state=v_outcome,provider_message_id=p_data->>'provider_message_id',last_error=left(p_data->>'error',120),updated_at=now(),
  status=CASE WHEN v_outcome='provider_accepted' THEN 'completed' WHEN v_outcome='failed' THEN 'failed' ELSE 'pending' END,
  completed_at=CASE WHEN v_outcome='provider_accepted' THEN now() ELSE NULL END WHERE id=o.id RETURNING * INTO o;
 IF o.action='usce_v3_correspondence' THEN
  UPDATE command_center.usce_comms SET mail_state=CASE WHEN v_outcome='provider_accepted' THEN 'sent' ELSE v_outcome END,
   message_status=CASE WHEN v_outcome='provider_accepted' THEN 'sent' WHEN v_outcome='failed' THEN 'failed' ELSE message_status END,postmark_message_id=o.provider_message_id WHERE id=o.entity_id;
 END IF;
 RETURN jsonb_build_object('ok',true,'dispatch',jsonb_build_object('id',o.id,'state',o.dispatch_state,'provider_message_id',o.provider_message_id));
END $function$;
