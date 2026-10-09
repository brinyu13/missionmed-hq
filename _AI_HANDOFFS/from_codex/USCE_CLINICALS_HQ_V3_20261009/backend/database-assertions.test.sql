\set ON_ERROR_STOP on
DO $$
DECLARE w uuid:=gen_random_uuid();g bigint;r jsonb;m jsonb;first_id uuid;d jsonb;dispatch_id uuid;attempt uuid;student uuid:=gen_random_uuid();student2 uuid:=gen_random_uuid();rfc text:='<reference-1@example.invalid>';assertions int:=0;
BEGIN
 IF has_function_privilege('anon','public.usce_mail_read(text,jsonb)','EXECUTE') OR has_function_privilege('authenticated','public.usce_mail_ingest(uuid,bigint,jsonb,text)','EXECUTE') THEN RAISE EXCEPTION 'public RPC exposed';END IF;assertions:=assertions+1;
 IF NOT has_function_privilege('service_role','public.usce_mail_read(text,jsonb)','EXECUTE') THEN RAISE EXCEPTION 'service RPC missing';END IF;assertions:=assertions+1;
 INSERT INTO command_center.usce_public_intake_requests VALUES(student,'Synthetic Student','qa@example.invalid'),(student2,'Other Synthetic Student','qa@example.invalid');
 r:=public.usce_mail_sync('claim',w);g:=(r->'state'->>'generation')::bigint;
 IF NOT(r->>'claimed')::boolean THEN RAISE EXCEPTION 'claim failed';END IF;assertions:=assertions+1;
 r:=public.usce_mail_sync('claim',gen_random_uuid());IF (r->>'claimed')::boolean THEN RAISE EXCEPTION 'concurrent claim allowed';END IF;assertions:=assertions+1;
 r:=public.usce_mail_sync('initialize',w,g,'{"history_id":"100"}');
 INSERT INTO command_center.usce_comms(intake_request_id,direction,from_email,to_email,rfc_message_id,mailbox) VALUES(student,'OUT','clinicals@missionmedinstitute.com','qa@example.invalid',rfc,'clinicals@missionmedinstitute.com');
 m:=jsonb_build_object('gmail_message_id','abc001','gmail_thread_id','abb001','from_email','qa@example.invalid','to_email','clinicals@missionmedinstitute.com','subject','Synthetic reply','body_text',E'Line one\nLine two','received_at','2000-01-01T00:00:00Z','rfc_message_id','<incoming-1@example.invalid>','in_reply_to',rfc,'references_ids',jsonb_build_array(rfc),'automatic',false);
 r:=public.usce_mail_ingest(w,g,m,'backfill');first_id:=(r->>'message_id')::uuid;
 IF NOT(r->>'inserted')::boolean OR (r->>'notification_enqueued')::boolean OR (SELECT intake_request_id FROM command_center.usce_comms WHERE id=first_id)<>student THEN RAISE EXCEPTION 'historical association/notification failed';END IF;assertions:=assertions+1;
 IF (SELECT body_text FROM command_center.usce_comms WHERE id=first_id)<>E'Line one\nLine two' THEN RAISE EXCEPTION 'body corrupted';END IF;assertions:=assertions+1;
 m:=m||jsonb_build_object('gmail_message_id','abc002','rfc_message_id','<incoming-2@example.invalid>','received_at',now()+interval '1 second');
 r:=public.usce_mail_ingest(w,g,m,'backfill');IF (r->>'notification_enqueued')::boolean THEN RAISE EXCEPTION 'backfill sent notification';END IF;assertions:=assertions+1;
 r:=public.usce_mail_ingest(w,g,m,'history');IF NOT(r->>'notification_enqueued')::boolean OR (r->>'inserted')::boolean THEN RAISE EXCEPTION 'backfill/history overlap lost notice';END IF;assertions:=assertions+1;
 r:=public.usce_mail_ingest(w,g,m,'history');IF (r->>'notification_enqueued')::boolean OR (SELECT count(*) FROM command_center.usce_comms WHERE gmail_message_id='abc002')<>1 THEN RAISE EXCEPTION 'duplicate persisted/notified';END IF;assertions:=assertions+1;
 INSERT INTO command_center.usce_comms(intake_request_id,direction,rfc_message_id) VALUES(student2,'OUT','<reference-2@example.invalid>');
 m:=m||jsonb_build_object('gmail_message_id','abc003','rfc_message_id','<incoming-3@example.invalid>','references_ids',jsonb_build_array(rfc,'<reference-2@example.invalid>'));
 r:=public.usce_mail_ingest(w,g,m,'history');first_id:=(r->>'message_id')::uuid;
 IF (SELECT intake_request_id IS NOT NULL OR NOT needs_triage FROM command_center.usce_comms WHERE id=first_id) THEN RAISE EXCEPTION 'conflicting association guessed';END IF;assertions:=assertions+1;
 r:=public.usce_mail_edit('assign',jsonb_build_object('id',first_id,'revision',0,'intake_request_id',student));IF NOT(r->>'ok')::boolean THEN RAISE EXCEPTION 'review assign failed';END IF;assertions:=assertions+1;
 r:=public.usce_mail_edit('assign',jsonb_build_object('id',first_id,'revision',1,'intake_request_id',student2));IF (r->>'ok')::boolean THEN RAISE EXCEPTION 'silently reassigned verified message';END IF;assertions:=assertions+1;
 m:=m||jsonb_build_object('gmail_message_id','abc004','rfc_message_id','<incoming-4@example.invalid>','in_reply_to',NULL,'references_ids','[]'::jsonb);
 r:=public.usce_mail_ingest(w,g,m,'history');IF (SELECT intake_request_id IS NOT NULL FROM command_center.usce_comms WHERE id=(r->>'message_id')::uuid) THEN RAISE EXCEPTION 'email-only association guessed';END IF;assertions:=assertions+1;
 r:=public.usce_mail_edit('draft',jsonb_build_object('intake_request_id',student,'subject','Synthetic draft','body_text','Synthetic body'));d:=r->'item';
 IF d->>'to_email'<>'qa@example.invalid' OR d->>'state'<>'draft' THEN RAISE EXCEPTION 'draft not bounded to student';END IF;assertions:=assertions+1;
 r:=public.usce_mail_edit('draft',jsonb_build_object('id',d->>'id','revision',0,'intake_request_id',student,'subject','Wrong stale save','body_text','Wrong'));
 IF r->>'error'<>'stale_revision' THEN RAISE EXCEPTION 'stale draft accepted';END IF;assertions:=assertions+1;
 r:=public.usce_mail_claim_send((d->>'id')::uuid,1,jsonb_build_object('to_email','wrong@example.invalid','from_email','clinicals@missionmedinstitute.com','reply_to','clinicals@missionmedinstitute.com','subject','Synthetic draft','body_text','Synthetic body','rfc_message_id','<usce-mail-test@example.invalid>'),'test-idem-001');
 IF r->>'error'<>'message_mismatch' THEN RAISE EXCEPTION 'wrong recipient accepted';END IF;assertions:=assertions+1;
 m:=jsonb_build_object('to_email','qa@example.invalid','from_email','clinicals@missionmedinstitute.com','reply_to','clinicals@missionmedinstitute.com','subject','Synthetic draft','body_text','Synthetic body','rfc_message_id','<usce-mail-test@example.invalid>');
 r:=public.usce_mail_claim_send((d->>'id')::uuid,1,m,'test-idem-001');dispatch_id:=(r->'dispatch'->>'id')::uuid;attempt:=(r->'dispatch'->>'attempt_id')::uuid;
 IF NOT(r->>'claimed')::boolean THEN RAISE EXCEPTION 'send claim failed';END IF;assertions:=assertions+1;
 r:=public.usce_mail_claim_send((d->>'id')::uuid,1,m,'test-idem-001');IF (r->>'claimed')::boolean THEN RAISE EXCEPTION 'duplicate provider attempt permitted';END IF;assertions:=assertions+1;
 r:=public.usce_mail_dispatch('finish',dispatch_id,attempt,'{"outcome":"ambiguous"}');
 r:=public.usce_mail_dispatch('finish',dispatch_id,attempt,'{"outcome":"failed"}');IF r->>'error'<>'reconciliation_required' THEN RAISE EXCEPTION 'ambiguous retry became ordinary failure';END IF;assertions:=assertions+1;
 r:=public.usce_mail_dispatch('finish',dispatch_id,attempt,jsonb_build_object('outcome','provider_accepted','provider_message_id',gen_random_uuid(),'evidence_source','postmark_authenticated_readback'));IF NOT(r->>'ok')::boolean THEN RAISE EXCEPTION 'readback reconciliation failed';END IF;assertions:=assertions+1;
 r:=public.usce_mail_read('list','{"folder":"inbox"}');IF r::text LIKE '%Synthetic body%' OR r::text LIKE '%raw_json%' THEN RAISE EXCEPTION 'list exposes full raw/body';END IF;assertions:=assertions+1;
 r:=public.usce_mail_sync('release',w,g);r:=public.usce_mail_ingest(w,g,m,'history');IF r->>'error'<>'sync_fence_lost' THEN RAISE EXCEPTION 'released lease could ingest';END IF;assertions:=assertions+1;
 RAISE NOTICE 'PASS % database contract assertions',assertions;
END $$;

DO $$ DECLARE cid uuid:=gen_random_uuid();mid text:=gen_random_uuid()::text;comm uuid;r jsonb;BEGIN
 INSERT INTO command_center.usce_send_claims(id,state,mode,payload) VALUES(cid,'claimed','live',jsonb_build_object('rendered_email',jsonb_build_object('from_email','clinicals@missionmedinstitute.com','reply_to','clinicals@missionmedinstitute.com','to_email','qa@example.invalid','subject','Approved offer','text_body',E'Complete\nApproved message')));
 r:=public.usce_mail_bind_offer(cid,mid);IF r->>'error'<>'offer_transport_not_instrumented' THEN RAISE EXCEPTION 'old/unmarked claim bound';END IF;
 r:=public.usce_mail_prepare_offer(cid);IF r->>'rfc_message_id'<>'<usce-offer-'||cid||'@missionmedinstitute.com>' THEN RAISE EXCEPTION 'identity not durable';END IF;
 r:=public.usce_mail_bind_offer(cid,mid);IF r->>'error'<>'offer_provider_evidence_mismatch' THEN RAISE EXCEPTION 'unaccepted claim bound';END IF;
 UPDATE command_center.usce_send_claims SET state='provider_accepted',postmark_message_id=mid WHERE id=cid;
 INSERT INTO command_center.usce_comms(direction,postmark_message_id,raw_json) VALUES('OUT',mid,jsonb_build_object('claim_id',cid)) RETURNING id INTO comm;
 r:=public.usce_mail_bind_offer(cid,'wrong');IF r->>'error'<>'offer_provider_evidence_mismatch' THEN RAISE EXCEPTION 'wrong provider bound';END IF;
 r:=public.usce_mail_bind_offer(cid,mid);IF NOT(r->>'ok')::boolean OR (r->>'message_id')::uuid<>comm THEN RAISE EXCEPTION 'accepted canonical row not bound';END IF;
 IF (SELECT body_text FROM command_center.usce_comms WHERE id=comm)<>E'Complete\nApproved message' THEN RAISE EXCEPTION 'full reviewed body not retained';END IF;
 IF (SELECT count(*) FROM command_center.usce_comms WHERE raw_json->>'claim_id'=cid::text)<>1 THEN RAISE EXCEPTION 'duplicate Offer message created';END IF;
 RAISE NOTICE 'PASS 7 Offer transport binding assertions';
END $$;

DO $$ DECLARE sid uuid:=gen_random_uuid();r jsonb;draft uuid;legacy uuid;sent uuid;BEGIN
 INSERT INTO command_center.usce_public_intake_requests VALUES(sid,'Privacy Synthetic','privacy@example.invalid');
 INSERT INTO command_center.usce_comms(intake_request_id,direction,mail_state,subject,body_text) VALUES(sid,'OUT','draft','Internal draft','Unsent private body') RETURNING id INTO draft;
 INSERT INTO command_center.usce_comms(intake_request_id,direction,mail_state) VALUES(sid,'SYS',NULL) RETURNING id INTO legacy;
 INSERT INTO command_center.usce_comms(intake_request_id,direction,mail_state) VALUES(sid,'OUT','sent') RETURNING id INTO sent;
 r:=public.list_usce_student_status_comms_summaries(ARRAY[sid]);
 IF r::text LIKE '%'||draft::text||'%' OR r::text LIKE '%Unsent private body%' THEN RAISE EXCEPTION 'student status exposes draft';END IF;
 IF jsonb_array_length(r->'items')<>2 OR r::text NOT LIKE '%'||legacy::text||'%' OR r::text NOT LIKE '%'||sent::text||'%' THEN RAISE EXCEPTION 'student status loses legitimate history';END IF;
 INSERT INTO command_center.usce_comms(intake_request_id,direction,subject) SELECT sid,'IN','Pagination row '||i FROM generate_series(1,55)i;
 r:=public.usce_mail_read('list',jsonb_build_object('folder','inbox','intake_request_id',sid,'limit',50));
 IF jsonb_array_length(r->'items')<>50 OR NOT(r->>'has_more')::boolean OR r->'next_cursor' IS NULL THEN RAISE EXCEPTION 'first page broken';END IF;
 r:=public.usce_mail_read('list',jsonb_build_object('folder','inbox','intake_request_id',sid,'limit',50,'before',r->'next_cursor'->>'before','before_id',r->'next_cursor'->>'before_id'));
 IF jsonb_array_length(r->'items')<>5 OR (r->>'has_more')::boolean THEN RAISE EXCEPTION 'keyset pagination skipped or repeated equal timestamps';END IF;
 RAISE NOTICE 'PASS 4 student privacy and pagination assertions';
END $$;

DO $$ DECLARE oid uuid:=gen_random_uuid();cid uuid:=gen_random_uuid();old_attempt uuid:=gen_random_uuid();new_attempt uuid;r jsonb;BEGIN
 INSERT INTO command_center.usce_outbox(id,entity_type,entity_id,action,payload,status,idempotency_key,dispatch_state,claimed_at,attempt_id,retry_count)
 VALUES(oid,'usce_comms',cid,'usce_v3_notify',jsonb_build_object('message_id',cid,'student_name','Synthetic','received_at',now()),'pending','recovery-test-notice','claimed',now()-interval '130 seconds',old_attempt,1);
 r:=public.usce_mail_dispatch('list');IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(r->'items')x WHERE x->>'id'=oid::text AND (x->>'can_retry')::boolean AND NOT(x->>'can_reconcile')::boolean) THEN RAISE EXCEPTION 'unbound held notice recovery invisible';END IF;
 r:=public.usce_mail_dispatch('retry',oid);new_attempt:=(r->'dispatch'->>'attempt_id')::uuid;IF NOT(r->>'claimed')::boolean OR new_attempt=old_attempt THEN RAISE EXCEPTION 'retry did not fence old attempt';END IF;
 r:=public.usce_mail_dispatch('bind_notification',oid,old_attempt,jsonb_build_object('to_email','philaperri@gmail.com','from_email','clinicals@missionmedinstitute.com'));IF r->>'error'<>'dispatch_locked' THEN RAISE EXCEPTION 'old worker could bind after retry';END IF;
 r:=public.usce_mail_dispatch('bind_notification',oid,new_attempt,jsonb_build_object('to_email','philaperri@gmail.com','from_email','clinicals@missionmedinstitute.com','body_text','PRIVATE_NOTIFICATION_BODY'));IF NOT(r->>'ok')::boolean THEN RAISE EXCEPTION 'new notification attempt cannot bind';END IF;
 r:=public.usce_mail_dispatch('retry',oid);IF r->>'error'<>'retry_requires_proven_unsent' THEN RAISE EXCEPTION 'bound claimed dispatch retried';END IF;
 r:=public.usce_mail_dispatch('finish',oid,new_attempt,'{"outcome":"failed","attempted":true,"http_status":422,"proven_unsent":true}');
 r:=public.usce_mail_dispatch('list');IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(r->'items')x WHERE x->>'id'=oid::text AND (x->>'can_retry')::boolean) OR r::text LIKE '%PRIVATE_NOTIFICATION_BODY%' THEN RAISE EXCEPTION 'definite-unsent retry hidden or content exposed';END IF;
 r:=public.usce_mail_dispatch('retry',oid);new_attempt:=(r->'dispatch'->>'attempt_id')::uuid;IF NOT(r->>'claimed')::boolean THEN RAISE EXCEPTION 'definite failed notification not retryable';END IF;
 r:=public.usce_mail_dispatch('finish',oid,new_attempt,'{"outcome":"ambiguous","attempted":true,"proven_unsent":false}');r:=public.usce_mail_dispatch('retry',oid);IF r->>'error'<>'retry_requires_proven_unsent' THEN RAISE EXCEPTION 'ambiguous retry allowed';END IF;
 RAISE NOTICE 'PASS 8 dispatch recovery and privacy assertions';
END $$;

DO $$ DECLARE sid uuid:=gen_random_uuid();cid uuid;oid uuid;attempt uuid;r jsonb;BEGIN
 INSERT INTO command_center.usce_public_intake_requests VALUES(sid,'Retry Synthetic','retry@example.invalid');
 INSERT INTO command_center.usce_comms(intake_request_id,direction,mail_state,message_status) VALUES(sid,'OUT','failed','failed') RETURNING id INTO cid;
 INSERT INTO command_center.usce_outbox(entity_type,entity_id,action,payload,status,idempotency_key,dispatch_state,dispatch_evidence,retry_count)
 VALUES('usce_comms',cid,'usce_v3_correspondence','{}','failed','retry-success-test','failed','{"proven_unsent":true}',1) RETURNING id INTO oid;
 r:=public.usce_mail_dispatch('retry',oid);attempt:=(r->'dispatch'->>'attempt_id')::uuid;IF NOT(r->>'claimed')::boolean THEN RAISE EXCEPTION 'known failure retry denied';END IF;
 r:=public.usce_mail_dispatch('finish',oid,attempt,jsonb_build_object('outcome','provider_accepted','provider_message_id',gen_random_uuid()));
 IF (SELECT mail_state<>'sent' OR message_status<>'sent' FROM command_center.usce_comms WHERE id=cid) THEN RAISE EXCEPTION 'successful retry retained false failure';END IF;
 r:=public.list_usce_student_status_comms_summaries(ARRAY[sid]);IF r->'items'->0->>'message_status'<>'sent' THEN RAISE EXCEPTION 'student summary misreports successful retry';END IF;
 RAISE NOTICE 'PASS 3 successful retry truth assertions';
END $$;
