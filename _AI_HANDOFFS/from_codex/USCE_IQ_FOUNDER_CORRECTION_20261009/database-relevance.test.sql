\set ON_ERROR_STOP on
BEGIN;
CREATE FUNCTION public.iq_assert(ok boolean,label text) RETURNS void LANGUAGE plpgsql AS $$ BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: %',label; END IF; RAISE NOTICE 'PASS: %',label; END $$;
DO $$
DECLARE case_id uuid:=gen_random_uuid(); student_id uuid; noise_id uuid; review_id uuid; auth_id uuid; snapshot text; result jsonb; worker uuid:=gen_random_uuid(); generation bigint; request jsonb;
BEGIN
 INSERT INTO command_center.usce_public_intake_requests VALUES(case_id,'Synthetic QA','student@example.invalid');
 INSERT INTO command_center.usce_comms(intake_request_id,direction,from_email,to_email,subject,body_text,association_method,rfc_message_id,raw_json)
 VALUES(case_id,'OUT','clinicals@missionmedinstitute.com','student@example.invalid','QA parent','controlled','approved_offer_claim','<qa-parent@example.invalid>','{}');
 INSERT INTO command_center.usce_comms(intake_request_id,direction,from_email,to_email,subject,body_text,association_method,raw_json)
 VALUES(case_id,'IN','student@example.invalid','clinicals@missionmedinstitute.com','Legacy student reply','controlled','verified_reference','{}') RETURNING id INTO student_id;
 INSERT INTO command_center.usce_comms(direction,from_email,to_email,subject,body_text,needs_triage,raw_json)
 VALUES('IN','reports@example.invalid','clinicals@missionmedinstitute.com','Report Domain: missionmedinstitute.com Submitter: provider Report-ID: 123','aggregate',true,'{"attachment_count":1}') RETURNING id INTO noise_id;
 INSERT INTO command_center.usce_comms(direction,from_email,to_email,subject,body_text,needs_triage,raw_json)
 VALUES('IN','inquiry@example.invalid','clinicals@missionmedinstitute.com','Clinical rotation inquiry','I am interested in a clinical rotation.',true,'{"sender_authentication":"passed"}') RETURNING id INTO review_id;
 INSERT INTO command_center.usce_comms(intake_request_id,direction,from_email,to_email,subject,body_text,association_method,raw_json)
 VALUES(case_id,'IN','student@example.invalid','clinicals@missionmedinstitute.com','Spoofed reply','I am interested in a clinical rotation.','verified_reference','{"sender_authentication":"failed"}') RETURNING id INTO auth_id;
 INSERT INTO command_center.usce_comms(direction,from_email,to_email,subject,body_text,needs_triage,raw_json)
 VALUES('IN','noreply@example.invalid','clinicals@missionmedinstitute.com','Security alert','Verify your account',true,'{}'),
 ('IN','newsletter@example.invalid','clinicals@missionmedinstitute.com','Clinical rotation newsletter','I am interested',true,'{"automatic":true,"automation_reason":"mailing_list"}'),
 ('IN','unrelated@example.invalid','clinicals@missionmedinstitute.com','Lunch tomorrow?','Hello',true,'{}');
 SELECT md5(string_agg(to_jsonb(c)::text,'' ORDER BY id)) INTO snapshot FROM command_center.usce_comms c;
 result:=public.usce_mail_read('list','{"folder":"inbox"}');
 PERFORM public.iq_assert(jsonb_array_length(result->'items')=1 AND result#>>'{items,0,id}'=student_id::text,'Inbox contains verified student only, no DMARC/system/unrelated/spoof');
 PERFORM public.iq_assert(result#>>'{counts,inbox}'='1' AND result#>>'{counts,unread}'='1' AND result#>>'{counts,unassigned}'='1','Counts share exact relevance projection');
 result:=public.usce_mail_read('list','{"folder":"unassigned"}');
 PERFORM public.iq_assert(jsonb_array_length(result->'items')=1 AND result#>>'{items,0,id}'=review_id::text AND result#>>'{items,0,intake_request_id}' IS NULL,'Needs Review contains genuine inquiry without guessed association');
 result:=public.usce_mail_read('list',jsonb_build_object('folder','all','intake_request_id',case_id));
 PERFORM public.iq_assert(jsonb_array_length(result->'items')=2,'Student history retains approved outgoing and genuine inbound, excludes spoof');
 PERFORM public.iq_assert(jsonb_array_length(public.list_usce_student_status_comms_summaries(ARRAY[case_id])->'items')=2,'Applicant summary shares student relevance, excludes failed auth');
 result:=public.usce_mail_read('thread',jsonb_build_object('id',student_id));
 PERFORM public.iq_assert(jsonb_array_length(result->'items')=2,'Thread uses same relevance rule');
 PERFORM public.iq_assert(snapshot=(SELECT md5(string_agg(to_jsonb(c)::text,'' ORDER BY id)) FROM command_center.usce_comms c),'Filtering does not modify or delete underlying mail');
 PERFORM public.iq_assert((public.usce_mail_read('message',jsonb_build_object('id',noise_id)))->>'ok'='true','Authorized direct diagnostics retain raw report access');
 PERFORM public.iq_assert(NOT has_function_privilege('anon','command_center.usce_mail_relevance(command_center.usce_comms)','EXECUTE') AND NOT has_function_privilege('authenticated','command_center.usce_mail_relevance(command_center.usce_comms)','EXECUTE'),'Relevance helper is service-only');
 INSERT INTO command_center.usce_outbox(entity_type,entity_id,action,payload,idempotency_key,dispatch_state)
 VALUES('usce_comms',noise_id,'usce_v3_notify','{}','qa-noise','pending'),('usce_comms',student_id,'usce_v3_notify','{}','qa-student','pending');
 result:=public.usce_mail_dispatch('claim_notification');
 PERFORM public.iq_assert(result#>>'{dispatch,entity_id}'=student_id::text,'Existing pending noise cannot be claimed for personal notification');
 PERFORM public.iq_assert(public.usce_mail_dispatch('claim_notification')->>'claimed'='false','Noise outbox preserved but never sent');
 result:=public.usce_mail_sync('claim',worker);
 generation:=(result#>>'{state,generation}')::bigint;
 PERFORM public.usce_mail_sync('initialize',worker,generation,'{"history_id":"123"}');
 request:=jsonb_build_object('gmail_message_id','abcdef01','gmail_thread_id','abcdef02','from_email','student@example.invalid','to_email','clinicals@missionmedinstitute.com','subject','Synthetic reply','body_text','Controlled','received_at',now(),'rfc_message_id','<qa-reply@example.invalid>','references_ids',jsonb_build_array('<qa-parent@example.invalid>'),'sender_authentication','passed','automatic',false);
 result:=public.usce_mail_ingest(worker,generation,request,'history');
 PERFORM public.iq_assert(result->>'association'='verified_reference' AND result->>'notification_enqueued'='true','Authenticated exact-reference reply associates and notifies');
 result:=public.usce_mail_ingest(worker,generation,request,'history');
 PERFORM public.iq_assert(result->>'notification_enqueued'='false','Provider history retry produces no duplicate notification');
 request:=request||jsonb_build_object('gmail_message_id','abcdef03','rfc_message_id','<qa-noise2@example.invalid>','automatic',true,'automation_reason','dmarc_report');
 PERFORM public.iq_assert(public.usce_mail_ingest(worker,generation,request,'history')->>'notification_enqueued'='false','Machine report cannot notify even with matching references');
 request:=request||jsonb_build_object('gmail_message_id','abcdef04','rfc_message_id','<qa-unknown@example.invalid>','automatic',false,'automation_reason','','sender_authentication','unknown','body_text','Yes, April works','subject','Re: QA');
 result:=public.usce_mail_ingest(worker,generation,request,'history');
 PERFORM public.iq_assert(result->>'notification_enqueued'='false','Unverified new sender auth cannot notify by matching references alone');
 PERFORM public.iq_assert(result->>'association'='unverified_reference','Unverified reference retained as reviewable candidate without case association');
 PERFORM public.iq_assert((SELECT c.needs_triage AND c.intake_request_id IS NULL AND command_center.usce_mail_relevance(c)='review' FROM command_center.usce_comms c WHERE c.id=(result->>'message_id')::uuid),'Short reply appears in Needs Review with assignment enabled');
 PERFORM public.iq_assert(public.usce_mail_edit('assign',jsonb_build_object('id',result->>'message_id','revision',0,'intake_request_id',case_id),'{"wp_user_id":42}')->>'ok'='true','Existing supervised assignment accepts short reply');
 PERFORM public.iq_assert((SELECT command_center.usce_mail_relevance(c)='student' FROM command_center.usce_comms c WHERE c.id=(result->>'message_id')::uuid),'Authorized review promotes existing canonical row to student history');
END $$;
ROLLBACK;
