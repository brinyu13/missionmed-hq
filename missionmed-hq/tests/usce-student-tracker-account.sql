-- Run against an isolated schema fixture only, in a transaction.
BEGIN;
INSERT INTO command_center.usce_public_intake_requests (id,status,student_name,email,preferred_specialties,preferred_locations,preferred_months_or_dates,consent)
VALUES ('10000000-0000-4000-8000-000000000001','new','Synthetic','student@example.test','["Medicine"]','["Chicago"]','["2027-01"]',true),
       ('10000000-0000-4000-8000-000000000002','new','Synthetic','student@example.test','["Other"]','["Other"]','["2027-02"]',true);
INSERT INTO command_center.usce_tracker_account_cases(intake_request_id,wp_user_id,confirmed_email)
VALUES ('10000000-0000-4000-8000-000000000001',123,'student@example.test');
INSERT INTO command_center.usce_offer_drafts(id,intake_request_id,status,revision,specialty,message_sent_at,postmark_status,postmark_message_id,alternate_requested_at,student_response_note)
VALUES ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','alternate_requested',2,'Medicine',now(),'sent','provider-fixture',now(),'Synthetic note');
INSERT INTO command_center.usce_send_claims(offer_id,revision,mode,state,postmark_message_id,payload)
VALUES ('20000000-0000-4000-8000-000000000001',2,'live','provider_accepted','provider-fixture','{"to_email":"student@example.test"}');
INSERT INTO command_center.usce_comms(intake_request_id,direction,is_internal_note,subject,body_text,raw_json)
VALUES ('10000000-0000-4000-8000-000000000001','SYS',false,'Alternate','Synthetic note','{"offer_draft_id":"20000000-0000-4000-8000-000000000001","source":"CX-OFFER-320","event_type":"student_requested_alternate"}');
SET LOCAL ROLE service_role;
DO $$ DECLARE p jsonb; BEGIN
p:=public.usce_student_tracker_account_v1(123,'Student@example.test',null);
IF jsonb_array_length(p->'items')<>1 OR p#>>'{items,0,offer,specialty}' IS DISTINCT FROM 'Medicine' OR p#>>'{items,0,response,note}' IS DISTINCT FROM 'Synthetic note' THEN RAISE EXCEPTION 'owner linked read failed'; END IF;
IF public.usce_student_tracker_account_v1(124,'student@example.test',null)->'items'<>'[]' OR public.usce_student_tracker_account_v1(123,'other@example.test',null)->'items'<>'[]' OR public.usce_student_tracker_account_v1(123,'student@example.test','10000000-0000-4000-8000-000000000002')->'items'<>'[]' THEN RAISE EXCEPTION 'ownership not enforced'; END IF;
IF p::text ~ '(postmark|offer_token|notes|admin_message|idempotency|payment_url|student@example)' THEN RAISE EXCEPTION 'private fields returned'; END IF;
IF has_function_privilege('anon','public.usce_student_tracker_account_v1(bigint,text,uuid)','execute') OR has_function_privilege('authenticated','public.usce_student_tracker_account_v1(bigint,text,uuid)','execute') THEN RAISE EXCEPTION 'unintended access'; END IF;
END $$;
RESET ROLE;
UPDATE command_center.usce_comms SET is_internal_note=true WHERE subject='Alternate';
DO $$ BEGIN IF public.usce_student_tracker_account_v1(123,'student@example.test',null)#>'{items,0,response}' <> 'null' THEN RAISE EXCEPTION 'internal event visible'; END IF; END $$;
UPDATE command_center.usce_offer_drafts SET revision=3,specialty='Unsent revision' WHERE id='20000000-0000-4000-8000-000000000001';
DO $$ BEGIN IF public.usce_student_tracker_account_v1(123,'student@example.test',null)#>'{items,0,offer}' <> 'null' THEN RAISE EXCEPTION 'unsent offer visible'; END IF; END $$;
ROLLBACK;
