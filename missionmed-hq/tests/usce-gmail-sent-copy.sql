DO $$
DECLARE cid uuid:=gen_random_uuid(); parent uuid:=gen_random_uuid(); outmsg uuid:=gen_random_uuid(); disp uuid:=gen_random_uuid(); pm uuid:=gen_random_uuid(); mb text:='clinicals@missionmedinstitute.com'; stu text:='test@example.invalid'; pr text:='<p@example.invalid>'; ref text:='<usce-mail-'||outmsg||'@missionmedinstitute.com>'; args jsonb:=jsonb_build_object('pilot_id',disp,'dispatch_id',disp); j jsonb;
BEGIN
ASSERT NOT has_function_privilege('anon','public.usce_mail_sent_copy(text,jsonb)','execute');
ASSERT NOT has_table_privilege('service_role','command_center.usce_gmail_sent_copies','insert');
INSERT INTO command_center.usce_public_intake_requests VALUES(cid,'QA',stu);
INSERT INTO command_center.usce_comms(id,intake_request_id,direction,mail_state,mailbox,from_email,to_email,subject,body_text,gmail_message_id,gmail_thread_id,rfc_message_id) VALUES(parent,cid,'IN','received',mb,stu,mb,'QA','synthetic','abcd','beef',pr);
INSERT INTO command_center.usce_comms(id,intake_request_id,direction,mail_state,mailbox,from_email,to_email,subject,body_text,postmark_message_id,rfc_message_id,in_reply_to,references_ids) VALUES(outmsg,cid,'OUT','sent',mb,mb,stu,'Re: QA','ack',pm::text,ref,pr,ARRAY[pr]);
INSERT INTO command_center.usce_outbox(id,entity_type,entity_id,action,payload,status,idempotency_key,dispatch_state,provider_message_id,completed_at) VALUES(disp,'usce_comms',outmsg,'usce_v3_correspondence',jsonb_build_object('message_id',outmsg,'from_email',mb,'to_email',stu,'subject','Re: QA','body_text','ack','rfc_message_id',ref,'in_reply_to',pr,'references',pr),'completed','qa','claimed',pm::text,now());
ASSERT NOT (public.usce_mail_sent_copy('next',args) ? 'job');
UPDATE command_center.usce_outbox SET dispatch_state='provider_accepted' WHERE id=disp;
j:=public.usce_mail_sent_copy('next',args); ASSERT j#>>'{job,parent_thread_id}'='beef',j::text; ASSERT (j#>>'{job,case_id}')::uuid=cid;
ASSERT NOT (public.usce_mail_sent_copy('next',jsonb_build_object('since',now()+interval '1 hour')) ? 'job');
-- The same accepted correspondence is only eligible for automatic copying when it is a reply.
ASSERT public.usce_mail_sent_copy('next',jsonb_build_object('since',now()-interval '1 hour')) ? 'job';
UPDATE command_center.usce_comms SET in_reply_to=NULL,references_ids=ARRAY[]::text[] WHERE id=outmsg;
UPDATE command_center.usce_outbox SET payload=(payload-'in_reply_to')||jsonb_build_object('references','') WHERE id=disp;
ASSERT NOT (public.usce_mail_sent_copy('next',jsonb_build_object('since',now()-interval '1 hour')) ? 'job');
UPDATE command_center.usce_comms SET in_reply_to=pr,references_ids=ARRAY[pr] WHERE id=outmsg;
UPDATE command_center.usce_outbox SET payload=payload||jsonb_build_object('in_reply_to',pr,'references',pr) WHERE id=disp;
args:=args||jsonb_build_object('gmail_id','aabb','thread_id','beef');
ASSERT NOT (public.usce_mail_sent_copy('stored',args)->>'ok')::boolean;
ASSERT (public.usce_mail_sent_copy('reserve',args)->>'won')::boolean;
ASSERT NOT (public.usce_mail_sent_copy('reserve',args)->>'won')::boolean;
ASSERT NOT (public.usce_mail_sent_copy('stored',args||'{"thread_id":"aaaa"}')->>'ok')::boolean;
ASSERT (public.usce_mail_sent_copy('stored',args)->>'ok')::boolean;
ASSERT NOT (public.usce_mail_sent_copy('next',args) ? 'job');
ASSERT (SELECT count(*)=1 FROM command_center.usce_gmail_sent_copies WHERE stored_at IS NOT NULL AND reserved_at IS NOT NULL AND gmail_id='aabb' AND thread_id='beef');
END $$;