-- DR-413: projection-only filtering; raw mail and prior association/audit are retained.
CREATE OR REPLACE FUNCTION command_center.usce_mail_relevance(c command_center.usce_comms)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE sender text:=lower(coalesce(c.from_email,'')); subject text:=lower(coalesce(c.subject,''));
 content text:=lower(coalesce(c.subject,'')||' '||left(coalesce(c.body_text,''),4000));
 recipient text:=lower(coalesce(c.to_email,'')); machine boolean; verified boolean;
BEGIN
 machine:=coalesce(c.raw_json->>'automatic','false')='true'
  OR coalesce(c.raw_json->>'automation_reason','')<>''
  OR (subject ~ 'report domain:.*submitter:.*report.?id:' AND
      (sender ~ '(^|[._-])(dmarc|postmaster|noreply|no-reply|mailer-daemon)[._@-]' OR CASE WHEN jsonb_typeof(c.raw_json->'attachment_count')='number' THEN (c.raw_json->>'attachment_count')::numeric>0 ELSE false END))
  OR (sender ~ '^(mailer-daemon|postmaster|noreply|no-reply|notifications?|alerts?)@' AND
      content ~ '(delivery status|delivery failure|undeliverable|security alert|verify your|verification code|newsletter|unsubscribe|password reset|dmarc|aggregate report)');
 IF c.direction='IN' AND machine THEN RETURN 'diagnostic'; END IF;
 verified:=c.intake_request_id IS NOT NULL AND (
  (c.direction<>'IN' AND (c.is_internal_note OR sender='clinicals@missionmedinstitute.com' OR c.direction='SYS'))
  OR (c.direction='IN' AND EXISTS(SELECT 1 FROM command_center.usce_public_intake_requests r
      WHERE r.id=c.intake_request_id AND lower(r.email)=sender)
      AND (c.association_method IN ('verified_reference','admin_review') OR
           (c.association_method IS NULL AND coalesce(c.raw_json->>'source','')<>'usce_v3_gmail'))
      AND (coalesce(c.raw_json->>'sender_authentication','legacy') IN ('passed','legacy') OR (c.association_method='admin_review' AND coalesce(c.raw_json->>'sender_authentication','legacy')<>'failed'))));
 IF verified THEN RETURN 'student'; END IF;
 -- Known reference plus unverified authentication needs a human; even a short reply must remain reviewable.
 IF c.direction='IN' AND NOT machine AND c.association_method='unverified_reference' AND c.needs_triage AND coalesce(c.raw_json->>'sender_authentication','unknown')='unknown' THEN RETURN 'review'; END IF;
 -- Needs Review is a candidate intake, never an automatic case association or notification.
 IF c.direction='IN' AND NOT machine AND recipient='clinicals@missionmedinstitute.com'
  AND sender ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
  AND coalesce(c.raw_json->>'sender_authentication','legacy')<>'failed'
  AND content ~ '(clinical rotation|observership|externship|usce|clinical elective)'
  AND content ~ '(i am|i.m |i would|i want|interested|applying|apply for|request|availability|my rotation|my application)'
 THEN RETURN 'review'; END IF;
 RETURN 'diagnostic';
END $$;
REVOKE ALL ON FUNCTION command_center.usce_mail_relevance(command_center.usce_comms) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION command_center.usce_mail_relevance(command_center.usce_comms) TO service_role;

CREATE OR REPLACE FUNCTION public.usce_mail_ingest(p_worker_id uuid, p_generation bigint, p_message jsonb, p_phase text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE s command_center.usce_mail_sync_state%ROWTYPE; c command_center.usce_comms%ROWTYPE;
 v_ids uuid[]; v_intake uuid; v_conversation uuid; v_refs text[]; v_from text; v_to text; v_direction text;
 v_method text:='unassigned'; v_inserted boolean:=false; v_notice integer:=0; v_received timestamptz; v_name text;
BEGIN
 SELECT * INTO s FROM command_center.usce_mail_sync_state WHERE mailbox='clinicals@missionmedinstitute.com' FOR UPDATE;
 IF p_worker_id IS NULL OR s.worker_id IS DISTINCT FROM p_worker_id OR s.generation IS DISTINCT FROM p_generation OR s.lease_until IS NULL OR s.lease_until<=now() THEN RETURN jsonb_build_object('ok',false,'error','sync_fence_lost'); END IF;
 IF p_phase NOT IN ('backfill','history') OR coalesce(p_message->>'gmail_message_id','') !~ '^[a-fA-F0-9]{1,40}$' THEN RETURN jsonb_build_object('ok',false,'error','invalid_message'); END IF;
 v_from:=lower(p_message->>'from_email');v_to:=lower(p_message->>'to_email');
 v_direction:=CASE WHEN v_from=s.mailbox THEN 'OUT' ELSE 'IN' END;
 v_received:=(p_message->>'received_at')::timestamptz;
 IF v_received IS NULL THEN RETURN jsonb_build_object('ok',false,'error','invalid_received_at'); END IF;
 SELECT coalesce(array_agg(x),'{}') INTO v_refs FROM jsonb_array_elements_text(coalesce(p_message->'references_ids','[]')) x;
 v_refs:=array_append(v_refs,p_message->>'in_reply_to');
 SELECT * INTO c FROM command_center.usce_comms WHERE mailbox=s.mailbox AND gmail_message_id=p_message->>'gmail_message_id' FOR UPDATE;
 IF NOT FOUND AND nullif(p_message->>'rfc_message_id','') IS NOT NULL THEN
  -- Merge the Gmail copy of a recorded outbound message, never an unrelated duplicate subject.
  SELECT * INTO c FROM command_center.usce_comms WHERE rfc_message_id=p_message->>'rfc_message_id' AND direction=v_direction AND lower(from_email)=v_from AND gmail_message_id IS NULL ORDER BY created_at LIMIT 1 FOR UPDATE;
 END IF;
 IF c.id IS NULL THEN
  SELECT array_agg(DISTINCT intake_request_id) FILTER(WHERE intake_request_id IS NOT NULL) INTO v_ids FROM command_center.usce_comms
   WHERE rfc_message_id=ANY(v_refs) AND (mailbox=s.mailbox OR mailbox IS NULL);
  IF cardinality(v_ids)=1 AND EXISTS(SELECT 1 FROM command_center.usce_public_intake_requests WHERE id=v_ids[1] AND lower(email)=CASE WHEN v_direction='IN' THEN v_from ELSE v_to END) AND (v_direction='OUT' OR (NOT coalesce((p_message->>'automatic')::boolean,false) AND coalesce(p_message->>'sender_authentication','legacy') IN ('passed','legacy'))) THEN
   v_intake:=v_ids[1];v_method:='verified_reference';
   SELECT coalesce(conversation_id,id) INTO v_conversation FROM command_center.usce_comms WHERE rfc_message_id=ANY(v_refs) AND intake_request_id=v_intake ORDER BY created_at LIMIT 1;
  ELSE
   -- No automatic email-only association: one student can have multiple requests.
   v_intake:=NULL;v_method:=CASE WHEN cardinality(v_ids)>1 THEN 'conflicting_references' WHEN cardinality(v_ids)=1 AND v_direction='IN' AND coalesce(p_message->>'sender_authentication','unknown')='unknown' AND NOT coalesce((p_message->>'automatic')::boolean,false) AND EXISTS(SELECT 1 FROM command_center.usce_public_intake_requests WHERE id=v_ids[1] AND lower(email)=v_from) THEN 'unverified_reference' ELSE 'unassigned' END;
  END IF;
  INSERT INTO command_center.usce_comms(intake_request_id,direction,message_status,from_email,to_email,subject,body_text,
   mailbox,gmail_message_id,gmail_thread_id,rfc_message_id,in_reply_to,references_ids,received_at,created_at,read_at,
   mail_state,conversation_id,association_method,needs_triage,raw_json)
  VALUES(v_intake,v_direction,CASE WHEN v_direction='IN' THEN 'replied' ELSE 'sent' END,v_from,v_to,left(p_message->>'subject',500),left(p_message->>'body_text',100000),
   s.mailbox,p_message->>'gmail_message_id',p_message->>'gmail_thread_id',nullif(p_message->>'rfc_message_id',''),nullif(p_message->>'in_reply_to',''),v_refs,v_received,v_received,
   CASE WHEN v_direction='OUT' OR p_phase='backfill' THEN now() ELSE NULL END,
   CASE WHEN v_direction='IN' THEN 'received' ELSE 'sent' END,v_conversation,v_method,v_intake IS NULL,
   jsonb_build_object('source','usce_v3_gmail','attachment_count',coalesce(p_message->'attachment_count','0'::jsonb),'body_truncated',coalesce(p_message->'body_truncated','false'::jsonb),'body_unavailable',coalesce(p_message->'body_unavailable','false'::jsonb),'automatic',coalesce(p_message->'automatic','false'::jsonb),'automation_reason',coalesce(p_message->>'automation_reason',''),'sender_authentication',coalesce(p_message->>'sender_authentication','legacy'))) RETURNING * INTO c;
  UPDATE command_center.usce_comms SET conversation_id=coalesce(conversation_id,id) WHERE id=c.id RETURNING * INTO c;
  v_inserted:=true;
 ELSE
  UPDATE command_center.usce_comms SET gmail_message_id=p_message->>'gmail_message_id',gmail_thread_id=p_message->>'gmail_thread_id',mailbox=s.mailbox WHERE id=c.id RETURNING * INTO c;
 END IF;
 -- History replay can encounter a new message already seen during backfill. Outbox uniqueness, not insert-only logic, prevents loss/duplication.
 IF v_direction='IN' AND v_received>=s.baseline_at AND NOT coalesce((p_message->>'automatic')::boolean,false)
  AND command_center.usce_mail_relevance(c)='student' AND (p_phase='history' OR s.recovering) THEN
  UPDATE command_center.usce_comms SET read_at=CASE WHEN NOT EXISTS(SELECT 1 FROM command_center.usce_outbox WHERE idempotency_key='usce-v3-notify:'||c.id) THEN NULL ELSE read_at END WHERE id=c.id;
  SELECT student_name INTO v_name FROM command_center.usce_public_intake_requests WHERE id=c.intake_request_id;
  INSERT INTO command_center.usce_outbox(entity_type,entity_id,action,payload,status,idempotency_key,dispatch_state)
  VALUES('usce_comms',c.id,'usce_v3_notify',jsonb_build_object('message_id',c.id,'student_name',v_name,'received_at',v_received),
   'pending','usce-v3-notify:'||c.id,'pending') ON CONFLICT(idempotency_key) DO NOTHING;
  GET DIAGNOSTICS v_notice=ROW_COUNT;
 END IF;
 UPDATE command_center.usce_mail_sync_state SET lease_until=now()+interval '120 seconds' WHERE mailbox=s.mailbox;
 RETURN jsonb_build_object('ok',true,'inserted',v_inserted,'message_id',c.id,'association',c.association_method,'notification_enqueued',v_notice=1);
END $function$
;
CREATE OR REPLACE FUNCTION public.usce_mail_read(p_action text, p_params jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_items jsonb;v_item command_center.usce_comms%ROWTYPE;v_limit integer:=least(greatest(coalesce((p_params->>'limit')::integer,50),1),100);v_sync jsonb;v_counts jsonb;v_more boolean;v_next jsonb;
BEGIN
 SELECT jsonb_build_object('backfill_complete',backfill_complete,'recovering',recovering,'last_success_at',last_success_at,'last_error_code',last_error_code,'retry_after',retry_after) INTO v_sync FROM command_center.usce_mail_sync_state WHERE mailbox='clinicals@missionmedinstitute.com';
 IF p_action='status' THEN RETURN jsonb_build_object('ok',true,'sync',v_sync); END IF;
 IF p_action='message' THEN
  SELECT * INTO v_item FROM command_center.usce_comms WHERE id=(p_params->>'id')::uuid;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','not_found'); END IF;
  RETURN jsonb_build_object('ok',true,'item',command_center.usce_mail_json(v_item,true));
 ELSIF p_action='thread' THEN
  SELECT * INTO v_item FROM command_center.usce_comms WHERE id=(p_params->>'id')::uuid;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','not_found'); END IF;
  SELECT coalesce(jsonb_agg(item ORDER BY at DESC,id DESC),'[]') INTO v_items FROM (
   SELECT command_center.usce_mail_json(c,true) item,c.created_at at,c.id FROM command_center.usce_comms c
   WHERE command_center.usce_mail_relevance(c) IN ('student','review') AND ((v_item.intake_request_id IS NOT NULL AND c.intake_request_id=v_item.intake_request_id) OR (v_item.intake_request_id IS NULL AND (c.id=v_item.id OR c.conversation_id=coalesce(v_item.conversation_id,v_item.id))))
    AND (NOT(p_params ? 'before') OR (c.created_at,c.id)<((p_params->>'before')::timestamptz,(p_params->>'before_id')::uuid)) ORDER BY c.created_at DESC,c.id DESC LIMIT v_limit+1) x;
 ELSE
  IF p_action<>'list' THEN RETURN jsonb_build_object('ok',false,'error','invalid_action'); END IF;
  SELECT coalesce(jsonb_agg(item ORDER BY at DESC,id DESC),'[]') INTO v_items FROM (
   SELECT command_center.usce_mail_json(c,false) || jsonb_build_object('student_name',r.student_name) item,c.created_at at,c.id
   FROM command_center.usce_comms c LEFT JOIN command_center.usce_public_intake_requests r ON r.id=c.intake_request_id
   WHERE (nullif(p_params->>'intake_request_id','') IS NULL OR c.intake_request_id=(p_params->>'intake_request_id')::uuid)
    AND (CASE coalesce(p_params->>'folder','inbox') WHEN 'inbox' THEN c.direction='IN' AND command_center.usce_mail_relevance(c)='student' WHEN 'sent' THEN c.direction='OUT' AND command_center.usce_mail_relevance(c)='student' AND coalesce(c.mail_state,c.message_status) NOT IN ('draft','queued','ambiguous','failed') WHEN 'drafts' THEN c.mail_state='draft' AND command_center.usce_mail_relevance(c)='student' WHEN 'unread' THEN c.direction='IN' AND c.read_at IS NULL AND command_center.usce_mail_relevance(c)='student' WHEN 'unassigned' THEN command_center.usce_mail_relevance(c)='review' WHEN 'all' THEN command_center.usce_mail_relevance(c)='student' ELSE false END)
    AND (coalesce(p_params->>'search','')='' OR strpos(lower(coalesce(c.subject,'')||' '||coalesce(c.from_email,'')||' '||coalesce(c.to_email,'')||' '||coalesce(r.student_name,'')),lower(p_params->>'search'))>0)
    AND (NOT(p_params ? 'before') OR (c.created_at,c.id)<((p_params->>'before')::timestamptz,(p_params->>'before_id')::uuid))
   ORDER BY c.created_at DESC,c.id DESC LIMIT v_limit+1) x;
 END IF;
 SELECT jsonb_build_object('inbox',count(*) FILTER(WHERE c.direction='IN' AND command_center.usce_mail_relevance(c)='student'),'unread',count(*) FILTER(WHERE c.direction='IN' AND c.read_at IS NULL AND command_center.usce_mail_relevance(c)='student'),'drafts',count(*) FILTER(WHERE c.mail_state='draft' AND command_center.usce_mail_relevance(c)='student'),'unassigned',count(*) FILTER(WHERE command_center.usce_mail_relevance(c)='review'),'sent',count(*) FILTER(WHERE c.direction='OUT' AND command_center.usce_mail_relevance(c)='student' AND coalesce(c.mail_state,c.message_status) NOT IN ('draft','queued','ambiguous','failed'))) INTO v_counts FROM command_center.usce_comms c;
 v_more:=jsonb_array_length(v_items)>v_limit;
 SELECT coalesce(jsonb_agg(value ORDER BY ord),'[]') INTO v_items FROM jsonb_array_elements(v_items) WITH ORDINALITY e(value,ord) WHERE ord<=v_limit;
 IF v_more THEN v_next:=jsonb_build_object('before',v_items->(v_limit-1)->>'created_at','before_id',v_items->(v_limit-1)->>'id'); END IF;
 RETURN jsonb_build_object('ok',true,'items',v_items,'limit',v_limit,'has_more',v_more,'next_cursor',v_next,'sync',v_sync,'counts',v_counts);
END $function$
;
CREATE OR REPLACE FUNCTION public.usce_mail_dispatch(p_action text, p_id uuid DEFAULT NULL::uuid, p_attempt_id uuid DEFAULT NULL::uuid, p_data jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE o command_center.usce_outbox%ROWTYPE;v_outcome text:=p_data->>'outcome';v_items jsonb;v_count integer;
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
  SELECT * INTO o FROM command_center.usce_outbox WHERE action='usce_v3_notify' AND EXISTS(SELECT 1 FROM command_center.usce_comms c WHERE c.id=entity_id AND c.direction='IN' AND command_center.usce_mail_relevance(c)='student') AND dispatch_state='pending' AND (next_attempt_at IS NULL OR next_attempt_at<=now()) ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',true,'claimed',false); END IF;
  UPDATE command_center.usce_outbox SET dispatch_state='claimed',claimed_at=now(),attempt_id=gen_random_uuid(),retry_count=retry_count+1 WHERE id=o.id RETURNING * INTO o;
  RETURN jsonb_build_object('ok',true,'claimed',true,'dispatch',to_jsonb(o));
 END IF;
 SELECT * INTO o FROM command_center.usce_outbox WHERE id=p_id AND action IN ('usce_v3_notify','usce_v3_correspondence') FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','not_found'); END IF;
 IF p_action IN ('retry','bind_notification') AND o.action='usce_v3_notify' AND NOT EXISTS(SELECT 1 FROM command_center.usce_comms c WHERE c.id=o.entity_id AND c.direction='IN' AND command_center.usce_mail_relevance(c)='student') THEN RETURN jsonb_build_object('ok',false,'error','notification_not_student'); END IF;
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
  UPDATE command_center.usce_outbox SET payload=payload||p_data WHERE id=o.id RETURNING * INTO o;
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
END $function$
;

CREATE OR REPLACE FUNCTION public.list_usce_student_status_comms_summaries(p_request_ids uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
 IF p_request_ids IS NULL OR array_length(p_request_ids,1) IS NULL THEN RETURN jsonb_build_object('items','[]'::jsonb); END IF;
 RETURN jsonb_build_object('items',coalesce((SELECT jsonb_agg(jsonb_build_object('id',c.id,'created_at',c.created_at,'intake_request_id',c.intake_request_id,'direction',c.direction,'message_status',c.message_status,'postmark_message_id',c.postmark_message_id,'raw_json',jsonb_build_object('event_type',c.raw_json->>'event_type')) ORDER BY c.created_at DESC)
 FROM command_center.usce_comms c WHERE c.intake_request_id=ANY(p_request_ids) AND command_center.usce_mail_relevance(c)='student' AND (c.mail_state IS NULL OR c.mail_state IN ('sent','received'))),'[]'::jsonb));
END $function$
;
