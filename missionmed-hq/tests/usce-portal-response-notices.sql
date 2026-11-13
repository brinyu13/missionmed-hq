-- Isolated PostgreSQL acceptance fixture. Run against a synthetic rehearsal database.
-- All identities and records are created here and rolled back on success or failure.
BEGIN;
DO $test$
DECLARE
  intake uuid := gen_random_uuid();
  offer uuid;
  action text;
  h text;
  meta jsonb := '{"source":"usce_offer_portal"}';
  reply jsonb;
  replay jsonb;
  claim jsonb;
  bound jsonb;
  event_id uuid;
  attempts uuid;
  dispatch uuid;
  n int;
  c command_center.usce_comms%ROWTYPE;
  j command_center.usce_outbox%ROWTYPE;
BEGIN
  ASSERT NOT EXISTS (SELECT 1 FROM command_center.usce_public_intake_requests), 'Requires empty isolated fixture';
  ASSERT NOT has_function_privilege('authenticated','public.usce_mail_dispatch(text,uuid,uuid,jsonb)','EXECUTE');
  ASSERT NOT has_function_privilege('service_role','command_center.usce_queue_portal_response_notice(uuid,uuid)','EXECUTE');
  INSERT INTO command_center.usce_public_intake_requests(id,student_name,email,consent,preferred_specialties,preferred_locations,preferred_months_or_dates)
    VALUES (intake,'Synthetic Person','synthetic@example.invalid',true,'["Medicine"]','["Chicago"]','["2027-01"]');
  FOREACH action IN ARRAY ARRAY['accept','decline','request_alternate','decline_notify_future','decline_no_notify'] LOOP
    offer := gen_random_uuid();
    h := encode(sha256(convert_to(offer::text,'UTF8')),'hex');
    INSERT INTO command_center.usce_offer_drafts(id,intake_request_id,status,expires_at,offer_token_expires_at,offer_token_hash)
      VALUES (offer,intake,'sent',now()+interval '1 day',now()+interval '1 day',h);
    IF action IN ('decline_notify_future','decline_no_notify') THEN
      reply := public.respond_usce_offer_by_token_hash(h,'decline_pending',NULL,true,meta);
      ASSERT (reply->>'ok')::boolean;
      ASSERT NOT EXISTS (SELECT 1 FROM command_center.usce_outbox WHERE entity_id=(reply->>'comms_id')::uuid);
    END IF;
    reply := public.respond_usce_offer_by_token_hash(h,action,'Private fixture note',true,meta);
    ASSERT (reply->>'ok')::boolean, reply::text;
    event_id := (reply->>'comms_id')::uuid;
    SELECT * INTO STRICT j FROM command_center.usce_outbox WHERE entity_id=event_id;
    ASSERT j.dispatch_state='pending' AND j.payload ? 'portal_response';
    ASSERT j.idempotency_key='usce-portal-response:'||event_id;
    ASSERT NOT command_center.usce_queue_portal_response_notice(offer,event_id);
    IF action NOT IN ('decline_notify_future','decline_no_notify') THEN
      replay := public.respond_usce_offer_by_token_hash(h,action,'Private fixture note',true,meta);
      ASSERT (replay->>'idempotent')::boolean;
    END IF;
    SELECT count(*) INTO n FROM command_center.usce_outbox WHERE entity_id=event_id;
    ASSERT n=1;
    SELECT * INTO STRICT c FROM command_center.usce_comms WHERE id=event_id;
    ASSERT command_center.usce_notification_eligible(c,j) IS TRUE;
    IF action='request_alternate' THEN
      j.idempotency_key := 'unrelated';
      ASSERT command_center.usce_notification_eligible(c,j) IS NOT TRUE;
      BEGIN
        PERFORM command_center.usce_queue_portal_response_notice(gen_random_uuid(), event_id);
        RAISE EXCEPTION 'mismatched offer accepted';
      EXCEPTION WHEN NO_DATA_FOUND THEN NULL;
      END;
    END IF;
  END LOOP;
  FOR n IN 1..5 LOOP
    claim := public.usce_mail_dispatch('claim_notification');
    ASSERT (claim->>'claimed')::boolean;
    dispatch := (claim#>>'{dispatch,id}')::uuid;
    attempts := (claim#>>'{dispatch,attempt_id}')::uuid;
    event_id := (claim#>>'{dispatch,entity_id}')::uuid;
    ASSERT (claim#>>'{dispatch,retry_count}')::integer=1;
    bound := public.usce_mail_dispatch('bind_notification',dispatch,attempts,
      jsonb_build_object('from_email','clinicals@missionmedinstitute.com','to_email','philaperri@gmail.com',
                         'subject','Private fixture name','body_text','Private fixture note'));
    ASSERT (bound->>'ok')::boolean;
    ASSERT bound#>>'{dispatch,payload,subject}'='A student responded to a clinical rotation Offer';
    ASSERT bound#>>'{dispatch,payload,to_email}'='philaperri@gmail.com';
    ASSERT bound#>>'{dispatch,payload,body_text}' LIKE '%/usce-admin/?conversation='||event_id;
    ASSERT (bound#>'{dispatch,payload}')::text NOT LIKE '%Private fixture%';
    ASSERT bound#>>'{dispatch,payload,text_sha256}'=encode(sha256(convert_to(bound#>>'{dispatch,payload,body_text}','UTF8')),'hex');
    ASSERT NOT (public.usce_mail_dispatch('retry',dispatch)->>'ok')::boolean;
    IF n=2 THEN
      PERFORM public.usce_mail_dispatch('finish',dispatch,attempts,'{"outcome":"ambiguous","attempted":true}');
      ASSERT NOT (public.usce_mail_dispatch('retry',dispatch)->>'ok')::boolean;
    ELSE
      PERFORM public.usce_mail_dispatch('finish',dispatch,attempts,jsonb_build_object('outcome','provider_accepted','provider_message_id',gen_random_uuid()));
      ASSERT NOT (public.usce_mail_dispatch('retry',dispatch)->>'ok')::boolean;
    END IF;
  END LOOP;
  ASSERT NOT (public.usce_mail_dispatch('claim_notification')->>'claimed')::boolean;
  -- Existing verified incoming Gmail notifications keep their original worker payload.
  INSERT INTO command_center.usce_comms(intake_request_id,direction,from_email,association_method,raw_json)
    VALUES (intake,'IN','synthetic@example.invalid','verified_reference','{"source":"usce_v3_gmail","sender_authentication":"passed"}')
    RETURNING id INTO event_id;
  INSERT INTO command_center.usce_outbox(entity_type,entity_id,action,payload,status,idempotency_key,dispatch_state)
    VALUES ('usce_comms',event_id,'usce_v3_notify',jsonb_build_object('message_id',event_id),'pending','usce-v3-notify:'||event_id,'pending');
  claim := public.usce_mail_dispatch('claim_notification');
  ASSERT (claim#>>'{dispatch,entity_id}')::uuid=event_id;
  bound := public.usce_mail_dispatch('bind_notification',(claim#>>'{dispatch,id}')::uuid,(claim#>>'{dispatch,attempt_id}')::uuid,
    '{"from_email":"clinicals@missionmedinstitute.com","to_email":"philaperri@gmail.com","subject":"Original inbound notice"}');
  ASSERT bound#>>'{dispatch,payload,subject}'='Original inbound notice';
  ASSERT NOT EXISTS(SELECT 1 FROM command_center.usce_comms WHERE direction='OUT');
END;
$test$;
ROLLBACK;
