-- Offline fixture for 20261115161811_usce_phil_case_mail.sql.
-- Run only on a disposable local PostgreSQL snapshot after the migration is applied.
-- This file writes synthetic rows inside one transaction and rolls all of them back.
BEGIN;
SELECT set_config('request.jwt.claim.role','service_role',true);

DO $test$
DECLARE
  cid uuid:=gen_random_uuid(); cid2 uuid:=gen_random_uuid(); self_cid uuid:=gen_random_uuid();
  parent_id uuid:=gen_random_uuid(); parent_out_id uuid:=gen_random_uuid();
  triage_id uuid:=gen_random_uuid(); ambig_id2 uuid:=gen_random_uuid();
  outbox_id uuid:=gen_random_uuid(); pmid uuid:=gen_random_uuid();
  clinical_worker uuid:=gen_random_uuid();
  lease uuid; lease2 uuid; got uuid; newmsg uuid; outmsg uuid;
  student text:='fixture.student@example.invalid';
  parent_rfc text:='<fixture-parent-'||gen_random_uuid()::text||'@example.invalid>';
  hq_out_rfc text:='<fixture-hq-sent-'||gen_random_uuid()::text||'@example.invalid>';
  triage_rfc text:='<fixture-triage-'||gen_random_uuid()::text||'@example.invalid>';
  ambig_rfc text:='<fixture-ambig-'||gen_random_uuid()::text||'@example.invalid>';
  cross_rfc text:='<fixture-cross-case-'||gen_random_uuid()::text||'@example.invalid>';
  valid jsonb; wrong jsonb; result jsonb; result2 jsonb; before_cutoff timestamptz;
  in_id uuid; out_id uuid; listed jsonb; cnt integer;
BEGIN
  ASSERT NOT has_function_privilege('anon','public.usce_phil_case_mail(text,jsonb)','execute');
  ASSERT NOT has_table_privilege('service_role','command_center.usce_phil_mailbox_state','select');
  ASSERT NOT has_table_privilege('service_role','command_center.usce_phil_case_mail_cursor','select');

  result:=public.usce_phil_case_mail('claim','{}');
  ASSERT (result->>'ok')::boolean AND (result->>'claimed')::boolean=false
    AND (result->>'pending')::boolean=true,result::text;
  ASSERT NOT EXISTS(SELECT 1 FROM command_center.usce_phil_case_mail_cursor);

  INSERT INTO command_center.usce_public_intake_requests(id,student_name,email)
    VALUES(cid,'Synthetic Phil Mail Fixture',student),(cid2,'Synthetic Conflict Fixture','other.fixture@example.invalid'),
      (self_cid,'Synthetic Self Case','philaperri@gmail.com');
  INSERT INTO command_center.usce_comms(id,intake_request_id,direction,message_status,mail_state,
      from_email,to_email,mailbox,subject,body_text,gmail_message_id,gmail_thread_id,rfc_message_id,
      received_at,created_at,conversation_id,association_method,needs_triage,raw_json)
    VALUES(parent_id,cid,'IN','replied','received',student,'clinicals@missionmedinstitute.com',
      'clinicals@missionmedinstitute.com','fixture parent','synthetic only','a001','b001',parent_rfc,
      now()-interval '2 minutes',now()-interval '2 minutes',parent_id,'verified_reference',false,
      jsonb_build_object('source','usce_v3_gmail','sender_authentication','passed'));
  INSERT INTO command_center.usce_comms(id,intake_request_id,direction,message_status,mail_state,
      from_email,to_email,mailbox,subject,body_text,postmark_message_id,rfc_message_id,
      received_at,created_at,association_method,needs_triage,raw_json)
    VALUES(parent_out_id,cid,'OUT','sent','sent','clinicals@missionmedinstitute.com',student,
      'clinicals@missionmedinstitute.com','fixture HQ sent','synthetic only',pmid::text,hq_out_rfc,
      now()-interval '1 minute',now()-interval '1 minute',NULL,false,'{}');
  INSERT INTO command_center.usce_outbox(id,entity_type,entity_id,action,payload,status,idempotency_key,
      dispatch_state,provider_message_id,completed_at)
    VALUES(outbox_id,'usce_comms',parent_out_id,'usce_v3_correspondence',
      jsonb_build_object('fixture',true),'completed','phil-fixture:'||outbox_id::text,
      'provider_accepted',pmid::text,now()-interval '1 minute');
  INSERT INTO command_center.usce_comms(id,intake_request_id,direction,message_status,mail_state,
      from_email,to_email,mailbox,subject,body_text,rfc_message_id,received_at,created_at,
      association_method,needs_triage,raw_json)
    VALUES(triage_id,cid,'IN','replied','received',student,'clinicals@missionmedinstitute.com',
      'clinicals@missionmedinstitute.com','fixture triage','synthetic only',triage_rfc,
      now()-interval '30 seconds',now()-interval '30 seconds','unverified_reference',true,
      jsonb_build_object('source','usce_v3_gmail','sender_authentication','unknown'));
  INSERT INTO command_center.usce_comms(id,intake_request_id,direction,message_status,mail_state,
      from_email,to_email,mailbox,subject,body_text,rfc_message_id,received_at,created_at,
      association_method,needs_triage,raw_json)
    VALUES(ambig_id2,cid,'IN','replied','received',student,'clinicals@missionmedinstitute.com',
      'clinicals@missionmedinstitute.com','fixture duplicate RFC','synthetic only',ambig_rfc,
      now()-interval '20 seconds',now()-interval '20 seconds','verified_reference',false,
      jsonb_build_object('source','usce_v3_gmail','sender_authentication','passed'));
  INSERT INTO command_center.usce_comms(id,intake_request_id,direction,message_status,mail_state,
      from_email,to_email,mailbox,subject,body_text,rfc_message_id,received_at,created_at,
      association_method,needs_triage,raw_json)
    VALUES(gen_random_uuid(),cid,'IN','replied','received',student,'clinicals@missionmedinstitute.com',
      'clinicals@missionmedinstitute.com','fixture duplicate RFC second row','synthetic only',ambig_rfc,
      now()-interval '10 seconds',now()-interval '10 seconds','verified_reference',false,
      jsonb_build_object('source','usce_v3_gmail','sender_authentication','passed'));
  INSERT INTO command_center.usce_comms(id,intake_request_id,direction,message_status,mail_state,
      from_email,to_email,mailbox,subject,body_text,rfc_message_id,received_at,created_at,
      association_method,needs_triage,raw_json)
    VALUES(gen_random_uuid(),cid2,'IN','replied','received','other.fixture@example.invalid',
      'clinicals@missionmedinstitute.com','clinicals@missionmedinstitute.com','fixture cross-case RFC',
      'synthetic only',cross_rfc,now(),now(),'verified_reference',false,
      jsonb_build_object('source','usce_v3_gmail','sender_authentication','passed'));

  -- Keep unrelated snapshot cases ineligible for this synthetic fair-queue check.
  INSERT INTO command_center.usce_phil_case_mail_cursor(case_id)
    SELECT id FROM command_center.usce_public_intake_requests
      WHERE lower(btrim(email))<>'philaperri@gmail.com' ON CONFLICT DO NOTHING;
  UPDATE command_center.usce_phil_case_mail_cursor SET retry_after='2099-01-01T00:00:00Z'
    WHERE case_id<>cid;
  UPDATE command_center.usce_phil_case_mail_cursor SET retry_after=NULL,page_token=NULL WHERE case_id=cid;

  result:=public.usce_phil_case_mail('bind',jsonb_build_object('account','philaperri@gmail.com',
    'scope','https://www.googleapis.com/auth/gmail.readonly','encrypted_grant','v1.dGVzdGJhc2U2NDAx.c2VjcmV0c2VjcmV0c2VjcmV0.aXYxMjM0NTY3ODkw'));
  ASSERT (result->>'ok')::boolean,result::text;
  ASSERT NOT EXISTS(SELECT 1 FROM command_center.usce_phil_case_mail_cursor WHERE case_id=self_cid);
  before_cutoff:=(result->>'connected_at')::timestamptz;
  UPDATE command_center.usce_phil_mailbox_state SET consent_at=before_cutoff-interval '1 day',
    cutoff_at=before_cutoff-interval '1 day' WHERE singleton;
  result:=public.usce_phil_case_mail('claim','{}');
  ASSERT (result->>'claimed')::boolean AND (result->>'case_id')::uuid=cid,result::text;
  ASSERT result->>'case_ref'='USCE-'||upper(left(cid::text,8)),result::text;
  lease:=(result->>'lease_id')::uuid;
  ASSERT jsonb_array_length(result->'anchors')=2,result->'anchors'::text;
  ASSERT (result->'anchors') @> jsonb_build_array(parent_rfc,hq_out_rfc),result->'anchors'::text;

  valid:=jsonb_build_object('lease_id',lease,'case_id',cid,'gmail_id','a101','thread_id','b101',
    'rfc_message_id','<fixture-in-'||gen_random_uuid()::text||'@example.invalid>',
    'in_reply_to',parent_rfc,'references_ids',jsonb_build_array(parent_rfc,hq_out_rfc),
    'from_email',student,'to_email','philaperri@gmail.com','received_at',to_char(now()+interval '2 seconds','YYYY-MM-DD"T"HH24:MI:SS.USOF'),
    'direction','IN','authenticated',true);
  wrong:=valid||jsonb_build_object('subject','USCE-'||upper(left(cid::text,8)),'references_ids','[]'::jsonb,'in_reply_to',NULL);
  result:=public.usce_phil_case_mail('preflight',wrong);
  ASSERT NOT coalesce((result->>'eligible')::boolean,false),result::text;
  ASSERT NOT EXISTS(SELECT 1 FROM command_center.usce_comms WHERE gmail_message_id='a101');
  wrong:=valid-ARRAY['direction'];
  result:=public.usce_phil_case_mail('preflight',wrong);
  ASSERT NOT coalesce((result->>'eligible')::boolean,false),result::text;
  wrong:=valid||jsonb_build_object('references_ids',jsonb_build_array('not-an-rfc-id'));
  result:=public.usce_phil_case_mail('preflight',wrong);
  ASSERT NOT coalesce((result->>'eligible')::boolean,false),result::text;

  result:=public.usce_phil_case_mail('preflight',valid);
  ASSERT (result->>'eligible')::boolean,result::text;
  result:=public.usce_phil_case_mail('ingest',valid||jsonb_build_object('subject','fixture inbound',
    'body_text','synthetic fixture only'));
  ASSERT (result->>'inserted')::boolean,result::text;
  in_id:=(result->>'message_id')::uuid;
  result2:=public.usce_phil_case_mail('ingest',valid||jsonb_build_object('subject','fixture inbound',
    'body_text','synthetic fixture only'));
  ASSERT NOT coalesce((result2->>'inserted')::boolean,false) AND (result2->>'duplicate')::boolean,result2::text;
  SELECT count(*) INTO cnt FROM command_center.usce_comms WHERE mailbox='philaperri@gmail.com'
    AND gmail_message_id='a101';
  ASSERT cnt=1,cnt::text;

  wrong:=valid||jsonb_build_object('gmail_id','a102','thread_id','b102',
    'rfc_message_id','<fixture-triage-reply@example.invalid>','in_reply_to',triage_rfc,
    'references_ids',jsonb_build_array(triage_rfc));
  result:=public.usce_phil_case_mail('preflight',wrong);
  ASSERT NOT coalesce((result->>'eligible')::boolean,false),result::text;
  wrong:=valid||jsonb_build_object('gmail_id','a103','thread_id','b103',
    'rfc_message_id','<fixture-ambiguous-reply@example.invalid>','in_reply_to',ambig_rfc,
    'references_ids',jsonb_build_array(ambig_rfc));
  result:=public.usce_phil_case_mail('preflight',wrong);
  ASSERT NOT coalesce((result->>'eligible')::boolean,false),result::text;
  wrong:=valid||jsonb_build_object('gmail_id','a104','thread_id','b104',
    'rfc_message_id','<fixture-cross-case-reply@example.invalid>','in_reply_to',parent_rfc,
    'references_ids',jsonb_build_array(parent_rfc,cross_rfc));
  result:=public.usce_phil_case_mail('preflight',wrong);
  ASSERT NOT coalesce((result->>'eligible')::boolean,false),result::text;
  wrong:=valid||jsonb_build_object('gmail_id','a105','thread_id','b105',
    'rfc_message_id','<fixture-unauthenticated@example.invalid>','authenticated',false);
  result:=public.usce_phil_case_mail('preflight',wrong);
  ASSERT NOT coalesce((result->>'eligible')::boolean,false),result::text;
  wrong:=valid||jsonb_build_object('gmail_id','a106','thread_id','b106',
    'rfc_message_id','<fixture-wrong-address@example.invalid>','from_email','other.fixture@example.invalid');
  result:=public.usce_phil_case_mail('preflight',wrong);
  ASSERT NOT coalesce((result->>'eligible')::boolean,false),result::text;

  -- Verified SENT is the worker gate for Phil OUT; it is projected into the same staff thread.
  valid:=jsonb_build_object('lease_id',lease,'case_id',cid,'gmail_id','a201','thread_id','b201',
    'rfc_message_id','<fixture-out-'||gen_random_uuid()::text||'@example.invalid>',
    'in_reply_to',parent_rfc,'references_ids',jsonb_build_array(parent_rfc,hq_out_rfc),
    'from_email','philaperri@gmail.com','to_email',student,'received_at',to_char(now()+interval '3 seconds','YYYY-MM-DD"T"HH24:MI:SS.USOF'),
    'direction','OUT','authenticated',true,'subject','fixture outbound','body_text','synthetic fixture only');
  result:=public.usce_phil_case_mail('preflight',valid-ARRAY['subject','body_text']);
  ASSERT (result->>'eligible')::boolean,result::text;
  result:=public.usce_phil_case_mail('ingest',valid);
  ASSERT (result->>'inserted')::boolean,result::text;
  out_id:=(result->>'message_id')::uuid;
  ASSERT command_center.usce_mail_relevance((SELECT c FROM command_center.usce_comms c WHERE c.id=out_id))='student';
  listed:=public.usce_mail_read('thread',jsonb_build_object('id',in_id,'limit',100));
  ASSERT (listed->'items') @> jsonb_build_array(jsonb_build_object('id',in_id::text),jsonb_build_object('id',out_id::text)),listed::text;
  ASSERT NOT EXISTS(SELECT 1 FROM command_center.usce_outbox WHERE entity_id IN (in_id,out_id)
    AND action='usce_v3_notify');

  -- Reverse ingestion order: a later Clinicals sync sees the identical RFC and must not add a second row.
  INSERT INTO command_center.usce_mail_sync_state(mailbox,generation,worker_id,lease_until)
    VALUES('clinicals@missionmedinstitute.com',77,clinical_worker,now()+interval '5 minutes')
    ON CONFLICT(mailbox) DO UPDATE SET generation=77,worker_id=clinical_worker,lease_until=now()+interval '5 minutes';
  result:=public.usce_mail_ingest(clinical_worker,77,jsonb_build_object(
    'gmail_message_id','c201','from_email','philaperri@gmail.com','to_email',student,
    'rfc_message_id',(valid->>'rfc_message_id'),'in_reply_to',parent_rfc,
    'references_ids',jsonb_build_array(parent_rfc),'received_at',to_char(now()+interval '3 seconds','YYYY-MM-DD"T"HH24:MI:SS.USOF'),
    'subject','fixture outbound','body_text','synthetic fixture only'),'history');
  ASSERT (result->>'ok')::boolean AND (result->>'duplicate')::boolean,result::text;
  ASSERT NOT EXISTS(SELECT 1 FROM command_center.usce_comms WHERE mailbox='clinicals@missionmedinstitute.com'
    AND gmail_message_id='c201');

  -- Reauthorization advances the cutoff, invalidates the old lease and resets pagination only.
  UPDATE command_center.usce_phil_case_mail_cursor SET page_token='resume-token' WHERE case_id=cid;
  result2:=public.usce_phil_case_mail('bind',jsonb_build_object('account','philaperri@gmail.com',
    'scope','https://www.googleapis.com/auth/gmail.readonly','encrypted_grant','v1.bmV3YXV0aG9yaXphdGlvbg.c2VjcmV0c2VjcmV0c2VjcmV0.aXYxMjM0NTY3ODkw'));
  ASSERT (result2->>'ok')::boolean AND (result2->>'connected_at')::timestamptz>before_cutoff-interval '1 day',result2::text;
  ASSERT (SELECT page_token IS NULL AND lease_id IS NULL AND last_completed_at IS NULL
    FROM command_center.usce_phil_case_mail_cursor WHERE case_id=cid);
  UPDATE command_center.usce_phil_case_mail_cursor SET retry_after='2099-01-01T00:00:00Z'
    WHERE case_id<>cid;
  result:=public.usce_phil_case_mail('checkpoint',jsonb_build_object('lease_id',lease,'case_id',cid,'page_token',NULL));
  ASSERT NOT coalesce((result->>'ok')::boolean,false) AND result->>'error'='lease_fence_lost',result::text;
  result:=public.usce_phil_case_mail('claim','{}');
  ASSERT (result->>'claimed')::boolean AND (result->>'case_id')::uuid=cid,result::text;
  lease2:=(result->>'lease_id')::uuid;
  result:=public.usce_phil_case_mail('checkpoint',jsonb_build_object('lease_id',lease2,'case_id',cid,'page_token','fixture-page-2'));
  ASSERT (result->>'ok')::boolean,result::text;
  ASSERT (SELECT page_token='fixture-page-2' AND lease_id IS NULL FROM command_center.usce_phil_case_mail_cursor WHERE case_id=cid);
  result:=public.usce_phil_case_mail('claim','{}');
  ASSERT (result->>'claimed')::boolean AND result->>'page_token'='fixture-page-2',result::text;
  lease2:=(result->>'lease_id')::uuid;
  result:=public.usce_phil_case_mail('release',jsonb_build_object('lease_id',lease2,'case_id',cid));
  ASSERT (result->>'ok')::boolean AND (SELECT failures=1 AND retry_after>now() FROM command_center.usce_phil_case_mail_cursor WHERE case_id=cid);
END
$test$;

ROLLBACK;
