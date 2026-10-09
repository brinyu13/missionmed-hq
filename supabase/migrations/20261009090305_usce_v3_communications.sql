-- Clinicals V3 additive mail workspace. Canonical messages remain usce_comms.
-- Apply only to fglyvdykwgbuivikqoah through the sanctioned release path.
BEGIN;
ALTER TABLE command_center.usce_comms
 ADD COLUMN IF NOT EXISTS mailbox text,
 ADD COLUMN IF NOT EXISTS gmail_message_id text,
 ADD COLUMN IF NOT EXISTS gmail_thread_id text,
 ADD COLUMN IF NOT EXISTS rfc_message_id text,
 ADD COLUMN IF NOT EXISTS in_reply_to text,
 ADD COLUMN IF NOT EXISTS references_ids text[] NOT NULL DEFAULT '{}',
 ADD COLUMN IF NOT EXISTS received_at timestamptz,
 ADD COLUMN IF NOT EXISTS read_at timestamptz,
 ADD COLUMN IF NOT EXISTS mail_state text,
 ADD COLUMN IF NOT EXISTS draft_revision bigint NOT NULL DEFAULT 0,
 ADD COLUMN IF NOT EXISTS conversation_id uuid,
 ADD COLUMN IF NOT EXISTS association_method text,
 ADD COLUMN IF NOT EXISTS association_reviewed_at timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS usce_comms_gmail_identity ON command_center.usce_comms(mailbox,gmail_message_id) WHERE gmail_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS usce_comms_rfc_identity ON command_center.usce_comms(rfc_message_id) WHERE rfc_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS usce_comms_mail_thread ON command_center.usce_comms(mailbox,gmail_thread_id) WHERE gmail_thread_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS usce_comms_student_mail ON command_center.usce_comms(intake_request_id,created_at DESC,id);
ALTER TABLE command_center.usce_comms ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS command_center.usce_mail_sync_state(
 mailbox text PRIMARY KEY CHECK(mailbox='clinicals@missionmedinstitute.com'),
 baseline_history_id text, history_id text, baseline_at timestamptz,
 backfill_page_token text, history_page_token text, backfill_complete boolean NOT NULL DEFAULT false, recovering boolean NOT NULL DEFAULT false,
 generation bigint NOT NULL DEFAULT 0, worker_id uuid, lease_until timestamptz,
 last_success_at timestamptz,last_error_code text,retry_after timestamptz
);
ALTER TABLE command_center.usce_mail_sync_state ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON command_center.usce_mail_sync_state FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE command_center.usce_outbox
 ADD COLUMN IF NOT EXISTS dispatch_state text,
 ADD COLUMN IF NOT EXISTS claimed_at timestamptz,
 ADD COLUMN IF NOT EXISTS attempt_id uuid,
 ADD COLUMN IF NOT EXISTS provider_message_id text,
 ADD COLUMN IF NOT EXISTS next_attempt_at timestamptz,
 ADD COLUMN IF NOT EXISTS dispatch_evidence jsonb NOT NULL DEFAULT '{}';
ALTER TABLE command_center.usce_outbox ENABLE ROW LEVEL SECURITY;

-- Never expose raw_json, provider tokens, offer links or stored dispatch payload in list views.
CREATE OR REPLACE FUNCTION command_center.usce_mail_json(c command_center.usce_comms,p_full boolean DEFAULT false)
RETURNS jsonb LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT jsonb_build_object('id',c.id,'intake_request_id',c.intake_request_id,
 'conversation_id',coalesce(c.conversation_id,c.id),'offer_draft_id',c.raw_json->>'offer_draft_id','direction',c.direction,
 'state',coalesce(c.mail_state,c.message_status),'is_internal_note',c.is_internal_note,
 'subject',c.subject,'from_email',c.from_email,'to_email',c.to_email,
 'body_text',CASE WHEN p_full THEN c.body_text ELSE NULL END,
 'in_reply_to',CASE WHEN p_full THEN c.in_reply_to ELSE NULL END,'references_ids',CASE WHEN p_full THEN to_jsonb(c.references_ids) ELSE NULL END,
 'received_at',coalesce(c.received_at,c.created_at),'created_at',c.created_at,
 'read_at',c.read_at,'unread',c.direction='IN' AND c.read_at IS NULL,
 'needs_triage',c.needs_triage,'revision',c.draft_revision,
 'attachment_count',coalesce(c.raw_json->'attachment_count','0'::jsonb),
 'body_truncated',coalesce(c.raw_json->'body_truncated','false'::jsonb),'body_unavailable',coalesce(c.raw_json->'body_unavailable','false'::jsonb),
 'association',c.association_method,'provider_accepted',c.postmark_message_id IS NOT NULL)
$$;

CREATE OR REPLACE FUNCTION public.usce_mail_sync(p_action text,p_worker_id uuid,p_generation bigint DEFAULT NULL,p_data jsonb DEFAULT '{}')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s command_center.usce_mail_sync_state%ROWTYPE;
BEGIN
 INSERT INTO command_center.usce_mail_sync_state(mailbox) VALUES('clinicals@missionmedinstitute.com') ON CONFLICT DO NOTHING;
 SELECT * INTO s FROM command_center.usce_mail_sync_state WHERE mailbox='clinicals@missionmedinstitute.com' FOR UPDATE;
 IF p_action='claim' THEN
  IF s.lease_until>now() OR s.retry_after>now() THEN RETURN jsonb_build_object('ok',true,'claimed',false); END IF;
  UPDATE command_center.usce_mail_sync_state SET worker_id=p_worker_id,generation=generation+1,lease_until=now()+interval '120 seconds' WHERE mailbox=s.mailbox RETURNING * INTO s;
  RETURN jsonb_build_object('ok',true,'claimed',true,'state',to_jsonb(s));
 END IF;
 IF p_worker_id IS NULL OR s.worker_id IS DISTINCT FROM p_worker_id OR s.generation IS DISTINCT FROM p_generation OR s.lease_until IS NULL OR s.lease_until<=now() THEN RETURN jsonb_build_object('ok',false,'error','sync_fence_lost'); END IF;
 IF p_action='initialize' THEN
  IF s.baseline_history_id IS NULL AND p_data->>'history_id' ~ '^[0-9]+$' THEN
   UPDATE command_center.usce_mail_sync_state SET baseline_history_id=p_data->>'history_id',history_id=p_data->>'history_id',baseline_at=now() WHERE mailbox=s.mailbox;
  END IF;
 ELSIF p_action='checkpoint' THEN
  IF p_data ? 'history_id' AND coalesce(p_data->>'history_id','') !~ '^[0-9]+$' THEN RETURN jsonb_build_object('ok',false,'error','invalid_cursor'); END IF;
  UPDATE command_center.usce_mail_sync_state SET
   history_id=CASE WHEN p_data ? 'history_id' THEN p_data->>'history_id' ELSE history_id END,
   backfill_page_token=CASE WHEN p_data ? 'backfill_page_token' THEN p_data->>'backfill_page_token' ELSE backfill_page_token END,
   history_page_token=CASE WHEN p_data ? 'history_page_token' THEN p_data->>'history_page_token' ELSE history_page_token END,
   backfill_complete=CASE WHEN p_data ? 'backfill_complete' THEN (p_data->>'backfill_complete')::boolean ELSE backfill_complete END,
   recovering=CASE WHEN p_data ? 'history_id' THEN false ELSE recovering END,
   last_success_at=now(),last_error_code=NULL,retry_after=NULL WHERE mailbox=s.mailbox;
 ELSIF p_action='recover' THEN
  -- A rescan preserves the original notification cutoff, known messages and the old cursor until a replacement is supplied.
  IF coalesce(p_data->>'history_id','') !~ '^[0-9]+$' THEN RETURN jsonb_build_object('ok',false,'error','invalid_cursor'); END IF;
  UPDATE command_center.usce_mail_sync_state SET history_id=p_data->>'history_id',recovering=true,backfill_complete=false,backfill_page_token=NULL,history_page_token=NULL,last_error_code='history_gap_rescan' WHERE mailbox=s.mailbox;
 ELSIF p_action='error' THEN
  UPDATE command_center.usce_mail_sync_state SET last_error_code=left(p_data->>'code',80),retry_after=now()+interval '60 seconds' WHERE mailbox=s.mailbox;
 ELSIF p_action<>'release' THEN RETURN jsonb_build_object('ok',false,'error','invalid_action'); END IF;
 UPDATE command_center.usce_mail_sync_state SET lease_until=CASE WHEN p_action IN ('release','error') THEN NULL ELSE now()+interval '120 seconds' END WHERE mailbox=s.mailbox RETURNING * INTO s;
 RETURN jsonb_build_object('ok',true,'state',to_jsonb(s));
END $$;

CREATE OR REPLACE FUNCTION public.usce_mail_ingest(p_worker_id uuid,p_generation bigint,p_message jsonb,p_phase text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
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
  IF cardinality(v_ids)=1 AND EXISTS(SELECT 1 FROM command_center.usce_public_intake_requests WHERE id=v_ids[1] AND lower(email)=CASE WHEN v_direction='IN' THEN v_from ELSE v_to END) THEN
   v_intake:=v_ids[1];v_method:='verified_reference';
   SELECT coalesce(conversation_id,id) INTO v_conversation FROM command_center.usce_comms WHERE rfc_message_id=ANY(v_refs) AND intake_request_id=v_intake ORDER BY created_at LIMIT 1;
  ELSE
   -- No automatic email-only association: one student can have multiple requests.
   v_intake:=NULL;v_method:=CASE WHEN cardinality(v_ids)>1 THEN 'conflicting_references' ELSE 'unassigned' END;
  END IF;
  INSERT INTO command_center.usce_comms(intake_request_id,direction,message_status,from_email,to_email,subject,body_text,
   mailbox,gmail_message_id,gmail_thread_id,rfc_message_id,in_reply_to,references_ids,received_at,created_at,read_at,
   mail_state,conversation_id,association_method,needs_triage,raw_json)
  VALUES(v_intake,v_direction,CASE WHEN v_direction='IN' THEN 'replied' ELSE 'sent' END,v_from,v_to,left(p_message->>'subject',500),left(p_message->>'body_text',100000),
   s.mailbox,p_message->>'gmail_message_id',p_message->>'gmail_thread_id',nullif(p_message->>'rfc_message_id',''),nullif(p_message->>'in_reply_to',''),v_refs,v_received,v_received,
   CASE WHEN v_direction='OUT' OR p_phase='backfill' THEN now() ELSE NULL END,
   CASE WHEN v_direction='IN' THEN 'received' ELSE 'sent' END,v_conversation,v_method,v_intake IS NULL,
   jsonb_build_object('source','usce_v3_gmail','attachment_count',coalesce(p_message->'attachment_count','0'::jsonb),'body_truncated',coalesce(p_message->'body_truncated','false'::jsonb),'body_unavailable',coalesce(p_message->'body_unavailable','false'::jsonb),'automatic',coalesce(p_message->'automatic','false'::jsonb))) RETURNING * INTO c;
  UPDATE command_center.usce_comms SET conversation_id=coalesce(conversation_id,id) WHERE id=c.id RETURNING * INTO c;
  v_inserted:=true;
 ELSE
  UPDATE command_center.usce_comms SET gmail_message_id=p_message->>'gmail_message_id',gmail_thread_id=p_message->>'gmail_thread_id',mailbox=s.mailbox WHERE id=c.id RETURNING * INTO c;
 END IF;
 -- History replay can encounter a new message already seen during backfill. Outbox uniqueness, not insert-only logic, prevents loss/duplication.
 IF v_direction='IN' AND v_received>=s.baseline_at AND NOT coalesce((p_message->>'automatic')::boolean,false)
  AND (p_phase='history' OR s.recovering) THEN
  UPDATE command_center.usce_comms SET read_at=CASE WHEN NOT EXISTS(SELECT 1 FROM command_center.usce_outbox WHERE idempotency_key='usce-v3-notify:'||c.id) THEN NULL ELSE read_at END WHERE id=c.id;
  SELECT student_name INTO v_name FROM command_center.usce_public_intake_requests WHERE id=c.intake_request_id;
  INSERT INTO command_center.usce_outbox(entity_type,entity_id,action,payload,status,idempotency_key,dispatch_state)
  VALUES('usce_comms',c.id,'usce_v3_notify',jsonb_build_object('message_id',c.id,'student_name',v_name,'received_at',v_received),
   'pending','usce-v3-notify:'||c.id,'pending') ON CONFLICT(idempotency_key) DO NOTHING;
  GET DIAGNOSTICS v_notice=ROW_COUNT;
 END IF;
 UPDATE command_center.usce_mail_sync_state SET lease_until=now()+interval '120 seconds' WHERE mailbox=s.mailbox;
 RETURN jsonb_build_object('ok',true,'inserted',v_inserted,'message_id',c.id,'association',c.association_method,'notification_enqueued',v_notice=1);
END $$;

CREATE OR REPLACE FUNCTION public.usce_mail_read(p_action text,p_params jsonb DEFAULT '{}')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
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
   WHERE ((v_item.intake_request_id IS NOT NULL AND c.intake_request_id=v_item.intake_request_id) OR (v_item.intake_request_id IS NULL AND (c.id=v_item.id OR c.conversation_id=coalesce(v_item.conversation_id,v_item.id))))
    AND (NOT(p_params ? 'before') OR (c.created_at,c.id)<((p_params->>'before')::timestamptz,(p_params->>'before_id')::uuid)) ORDER BY c.created_at DESC,c.id DESC LIMIT v_limit+1) x;
 ELSE
  IF p_action<>'list' THEN RETURN jsonb_build_object('ok',false,'error','invalid_action'); END IF;
  SELECT coalesce(jsonb_agg(item ORDER BY at DESC,id DESC),'[]') INTO v_items FROM (
   SELECT command_center.usce_mail_json(c,false) || jsonb_build_object('student_name',r.student_name) item,c.created_at at,c.id
   FROM command_center.usce_comms c LEFT JOIN command_center.usce_public_intake_requests r ON r.id=c.intake_request_id
   WHERE (nullif(p_params->>'intake_request_id','') IS NULL OR c.intake_request_id=(p_params->>'intake_request_id')::uuid)
    AND (CASE coalesce(p_params->>'folder','inbox') WHEN 'inbox' THEN c.direction='IN' WHEN 'sent' THEN c.direction='OUT' AND coalesce(c.mail_state,c.message_status) NOT IN ('draft','queued','ambiguous','failed') WHEN 'drafts' THEN c.mail_state='draft' WHEN 'unread' THEN c.direction='IN' AND c.read_at IS NULL WHEN 'unassigned' THEN c.needs_triage WHEN 'all' THEN true ELSE false END)
    AND (coalesce(p_params->>'search','')='' OR strpos(lower(coalesce(c.subject,'')||' '||coalesce(c.from_email,'')||' '||coalesce(c.to_email,'')||' '||coalesce(r.student_name,'')),lower(p_params->>'search'))>0)
    AND (NOT(p_params ? 'before') OR (c.created_at,c.id)<((p_params->>'before')::timestamptz,(p_params->>'before_id')::uuid))
   ORDER BY c.created_at DESC,c.id DESC LIMIT v_limit+1) x;
 END IF;
 SELECT jsonb_build_object('inbox',count(*) FILTER(WHERE direction='IN'),'unread',count(*) FILTER(WHERE direction='IN' AND read_at IS NULL),'drafts',count(*) FILTER(WHERE mail_state='draft'),'unassigned',count(*) FILTER(WHERE needs_triage),'sent',count(*) FILTER(WHERE direction='OUT' AND coalesce(mail_state,message_status) NOT IN ('draft','queued','ambiguous','failed'))) INTO v_counts FROM command_center.usce_comms;
 v_more:=jsonb_array_length(v_items)>v_limit;
 SELECT coalesce(jsonb_agg(value ORDER BY ord),'[]') INTO v_items FROM jsonb_array_elements(v_items) WITH ORDINALITY e(value,ord) WHERE ord<=v_limit;
 IF v_more THEN v_next:=jsonb_build_object('before',v_items->(v_limit-1)->>'created_at','before_id',v_items->(v_limit-1)->>'id'); END IF;
 RETURN jsonb_build_object('ok',true,'items',v_items,'limit',v_limit,'has_more',v_more,'next_cursor',v_next,'sync',v_sync,'counts',v_counts);
END $$;

CREATE OR REPLACE FUNCTION public.usce_mail_edit(p_action text,p_data jsonb,p_actor jsonb DEFAULT '{}')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c command_center.usce_comms%ROWTYPE;r command_center.usce_public_intake_requests%ROWTYPE;parent command_center.usce_comms%ROWTYPE;
BEGIN
 IF p_action='read' THEN
  UPDATE command_center.usce_comms SET read_at=now() WHERE id=(p_data->>'id')::uuid;
  RETURN jsonb_build_object('ok',FOUND);
 END IF;
 IF nullif(p_data->>'id','') IS NOT NULL THEN
  SELECT * INTO c FROM command_center.usce_comms WHERE id=(p_data->>'id')::uuid FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','not_found'); END IF;
  IF c.draft_revision IS DISTINCT FROM (p_data->>'revision')::bigint THEN RETURN jsonb_build_object('ok',false,'error','stale_revision'); END IF;
 END IF;
 IF p_action='assign' THEN
  SELECT * INTO r FROM command_center.usce_public_intake_requests WHERE id=(p_data->>'intake_request_id')::uuid;
  IF c.id IS NULL OR r.id IS NULL OR NOT c.needs_triage THEN RETURN jsonb_build_object('ok',false,'error','not_found'); END IF;
  UPDATE command_center.usce_comms SET intake_request_id=r.id,needs_triage=false,association_method='admin_review',association_reviewed_at=now(),draft_revision=draft_revision+1,
   raw_json=raw_json||jsonb_build_object('association_actor',p_actor) WHERE id=c.id RETURNING * INTO c;
 ELSIF p_action='draft' THEN
  IF c.id IS NOT NULL AND c.mail_state IS DISTINCT FROM 'draft' THEN RETURN jsonb_build_object('ok',false,'error','draft_locked'); END IF;
  SELECT * INTO r FROM command_center.usce_public_intake_requests WHERE id=(p_data->>'intake_request_id')::uuid;
  IF r.id IS NULL THEN RETURN jsonb_build_object('ok',false,'error','student_required'); END IF;
  IF length(coalesce(p_data->>'subject',''))>240 OR length(coalesce(p_data->>'body_text',''))>20000 THEN RETURN jsonb_build_object('ok',false,'error','message_too_long'); END IF;
  IF nullif(p_data->>'reply_to_message_id','') IS NOT NULL THEN
   SELECT * INTO parent FROM command_center.usce_comms WHERE id=(p_data->>'reply_to_message_id')::uuid;
   IF parent.intake_request_id IS DISTINCT FROM r.id THEN RETURN jsonb_build_object('ok',false,'error','reply_student_mismatch'); END IF;
  END IF;
  IF c.id IS NULL THEN
   INSERT INTO command_center.usce_comms(intake_request_id,direction,message_status,from_email,to_email,subject,body_text,mailbox,mail_state,draft_revision,read_at,conversation_id,in_reply_to,references_ids,raw_json)
   VALUES(r.id,'OUT','sent','clinicals@missionmedinstitute.com',lower(r.email),p_data->>'subject',p_data->>'body_text','clinicals@missionmedinstitute.com','draft',1,now(),coalesce(parent.conversation_id,parent.id),parent.rfc_message_id,CASE WHEN parent.id IS NULL THEN '{}'::text[] ELSE array_append(parent.references_ids,parent.rfc_message_id) END,jsonb_build_object('source','usce_v3_correspondence','actor',p_actor)) RETURNING * INTO c;
   UPDATE command_center.usce_comms SET conversation_id=coalesce(conversation_id,id) WHERE id=c.id RETURNING * INTO c;
  ELSE
   IF c.intake_request_id IS DISTINCT FROM r.id THEN RETURN jsonb_build_object('ok',false,'error','student_locked'); END IF;
   UPDATE command_center.usce_comms SET subject=p_data->>'subject',body_text=p_data->>'body_text',to_email=lower(r.email),draft_revision=draft_revision+1 WHERE id=c.id RETURNING * INTO c;
  END IF;
 ELSE RETURN jsonb_build_object('ok',false,'error','invalid_action'); END IF;
 RETURN jsonb_build_object('ok',true,'item',command_center.usce_mail_json(c,true));
END $$;

CREATE OR REPLACE FUNCTION public.usce_mail_claim_send(p_message_id uuid,p_revision bigint,p_payload jsonb,p_idempotency_key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c command_center.usce_comms%ROWTYPE;o command_center.usce_outbox%ROWTYPE;r command_center.usce_public_intake_requests%ROWTYPE;
BEGIN
 SELECT * INTO c FROM command_center.usce_comms WHERE id=p_message_id FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','not_found'); END IF;
 SELECT * INTO o FROM command_center.usce_outbox WHERE idempotency_key=p_idempotency_key;
 IF FOUND THEN
  IF o.entity_id<>c.id OR o.payload->>'revision' IS DISTINCT FROM p_revision::text THEN RETURN jsonb_build_object('ok',false,'error','idempotency_conflict'); END IF;
  RETURN jsonb_build_object('ok',true,'claimed',false,'dispatch',jsonb_build_object('id',o.id,'state',o.dispatch_state,'provider_message_id',o.provider_message_id));
 END IF;
 IF c.mail_state IS DISTINCT FROM 'draft' OR c.draft_revision<>p_revision THEN RETURN jsonb_build_object('ok',false,'error','stale_draft'); END IF;
 SELECT * INTO r FROM command_center.usce_public_intake_requests WHERE id=c.intake_request_id;
 IF c.subject IS NULL OR btrim(c.subject)='' OR c.body_text IS NULL OR btrim(c.body_text)='' OR r.id IS NULL OR lower(r.email)<>c.to_email
  OR p_payload->>'to_email' IS DISTINCT FROM c.to_email OR p_payload->>'subject' IS DISTINCT FROM c.subject OR p_payload->>'body_text' IS DISTINCT FROM c.body_text
  OR p_payload->>'from_email' IS DISTINCT FROM 'clinicals@missionmedinstitute.com' OR p_payload->>'reply_to' IS DISTINCT FROM 'clinicals@missionmedinstitute.com'
  OR nullif(p_payload->>'rfc_message_id','') IS NULL THEN RETURN jsonb_build_object('ok',false,'error','message_mismatch'); END IF;
 IF length(coalesce(p_idempotency_key,'')) NOT BETWEEN 8 AND 160 THEN RETURN jsonb_build_object('ok',false,'error','idempotency_required'); END IF;
 INSERT INTO command_center.usce_outbox(entity_type,entity_id,action,payload,status,idempotency_key,dispatch_state,claimed_at,attempt_id,retry_count)
 VALUES('usce_comms',c.id,'usce_v3_correspondence',p_payload||jsonb_build_object('revision',p_revision),'pending',p_idempotency_key,'claimed',now(),gen_random_uuid(),1) RETURNING * INTO o;
 UPDATE command_center.usce_comms SET mail_state='queued',rfc_message_id=p_payload->>'rfc_message_id' WHERE id=c.id;
 RETURN jsonb_build_object('ok',true,'claimed',true,'dispatch',to_jsonb(o));
END $$;

CREATE OR REPLACE FUNCTION public.usce_mail_dispatch(p_action text,p_id uuid DEFAULT NULL,p_attempt_id uuid DEFAULT NULL,p_data jsonb DEFAULT '{}')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
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
  SELECT * INTO o FROM command_center.usce_outbox WHERE action='usce_v3_notify' AND dispatch_state='pending' AND (next_attempt_at IS NULL OR next_attempt_at<=now()) ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',true,'claimed',false); END IF;
  UPDATE command_center.usce_outbox SET dispatch_state='claimed',claimed_at=now(),attempt_id=gen_random_uuid(),retry_count=retry_count+1 WHERE id=o.id RETURNING * INTO o;
  RETURN jsonb_build_object('ok',true,'claimed',true,'dispatch',to_jsonb(o));
 END IF;
 SELECT * INTO o FROM command_center.usce_outbox WHERE id=p_id AND action IN ('usce_v3_notify','usce_v3_correspondence') FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','not_found'); END IF;
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
END $$;

-- Additive transport identity only: existing approval/claim/business state transitions are untouched.
ALTER TABLE command_center.usce_send_claims ADD COLUMN IF NOT EXISTS mail_rfc_message_id text;
CREATE OR REPLACE FUNCTION public.usce_mail_prepare_offer(p_claim_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c command_center.usce_send_claims%ROWTYPE;v_rfc text;
BEGIN
 SELECT * INTO c FROM command_center.usce_send_claims WHERE id=p_claim_id FOR UPDATE;
 IF NOT FOUND OR c.state<>'claimed' OR c.mode<>'live' THEN RETURN jsonb_build_object('ok',false,'error','offer_claim_not_sendable'); END IF;
 IF c.payload->'rendered_email'->>'from_email' IS DISTINCT FROM 'clinicals@missionmedinstitute.com'
 OR c.payload->'rendered_email'->>'reply_to' IS DISTINCT FROM 'clinicals@missionmedinstitute.com' THEN RETURN jsonb_build_object('ok',false,'error','clinicals_sender_not_ready'); END IF;
 v_rfc:='<usce-offer-'||c.id||'@missionmedinstitute.com>';
 IF c.mail_rfc_message_id IS NOT NULL AND c.mail_rfc_message_id<>v_rfc THEN RETURN jsonb_build_object('ok',false,'error','transport_identity_conflict'); END IF;
 UPDATE command_center.usce_send_claims SET mail_rfc_message_id=v_rfc WHERE id=c.id;
 RETURN jsonb_build_object('ok',true,'rfc_message_id',v_rfc);
END $$;
CREATE OR REPLACE FUNCTION public.usce_mail_bind_offer(p_claim_id uuid,p_provider_message_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c command_center.usce_send_claims%ROWTYPE;v_comm_id uuid;v_count integer;mail jsonb;
BEGIN
 SELECT * INTO c FROM command_center.usce_send_claims WHERE id=p_claim_id FOR UPDATE;
 IF NOT FOUND OR c.mail_rfc_message_id IS NULL THEN RETURN jsonb_build_object('ok',false,'error','offer_transport_not_instrumented'); END IF;
 IF c.state<>'provider_accepted' OR c.mode<>'live' OR c.postmark_message_id IS DISTINCT FROM p_provider_message_id
 OR c.mail_rfc_message_id IS DISTINCT FROM '<usce-offer-'||c.id||'@missionmedinstitute.com>' THEN RETURN jsonb_build_object('ok',false,'error','offer_provider_evidence_mismatch'); END IF;
 mail:=c.payload->'rendered_email';
 SELECT count(*) INTO v_count FROM command_center.usce_comms WHERE raw_json->>'claim_id'=c.id::text AND postmark_message_id=p_provider_message_id;
 IF v_count<>1 THEN RETURN jsonb_build_object('ok',false,'error','offer_history_reconciliation_required'); END IF;
 UPDATE command_center.usce_comms SET rfc_message_id=c.mail_rfc_message_id,mailbox='clinicals@missionmedinstitute.com',
  from_email=mail->>'from_email',to_email=mail->>'to_email',subject=mail->>'subject',body_text=mail->>'text_body',mail_state='sent',
  conversation_id=coalesce(conversation_id,id),read_at=coalesce(read_at,now()),association_method='approved_offer_claim'
 WHERE raw_json->>'claim_id'=c.id::text AND postmark_message_id=p_provider_message_id RETURNING id INTO v_comm_id;
 RETURN jsonb_build_object('ok',true,'message_id',v_comm_id);
END $$;

-- Existing student status keeps its original safe projection. New unsent admin drafts must never look sent to a student.
CREATE OR REPLACE FUNCTION public.list_usce_student_status_comms_summaries(p_request_ids uuid[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF p_request_ids IS NULL OR array_length(p_request_ids,1) IS NULL THEN RETURN jsonb_build_object('items','[]'::jsonb); END IF;
 RETURN jsonb_build_object('items',coalesce((SELECT jsonb_agg(jsonb_build_object('id',c.id,'created_at',c.created_at,'intake_request_id',c.intake_request_id,'direction',c.direction,'message_status',c.message_status,'postmark_message_id',c.postmark_message_id,'raw_json',jsonb_build_object('event_type',c.raw_json->>'event_type')) ORDER BY c.created_at DESC)
 FROM command_center.usce_comms c WHERE c.intake_request_id=ANY(p_request_ids) AND (c.mail_state IS NULL OR c.mail_state IN ('sent','received'))),'[]'::jsonb));
END $$;
REVOKE ALL ON FUNCTION public.list_usce_student_status_comms_summaries(uuid[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.list_usce_student_status_comms_summaries(uuid[]) TO service_role;

DO $$ DECLARE p record; BEGIN
 FOR p IN SELECT n.nspname,p1.proname,pg_get_function_identity_arguments(p1.oid) args FROM pg_proc p1 JOIN pg_namespace n ON n.oid=p1.pronamespace
  WHERE (n.nspname='public' AND p1.proname IN ('usce_mail_sync','usce_mail_ingest','usce_mail_read','usce_mail_edit','usce_mail_claim_send','usce_mail_dispatch','usce_mail_prepare_offer','usce_mail_bind_offer')) OR (n.nspname='command_center' AND p1.proname='usce_mail_json') LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %I.%I(%s) FROM PUBLIC,anon,authenticated',p.nspname,p.proname,p.args);
  IF p.nspname='public' THEN EXECUTE format('GRANT EXECUTE ON FUNCTION %I.%I(%s) TO service_role',p.nspname,p.proname,p.args); END IF;
 END LOOP;
END $$;
COMMIT;
