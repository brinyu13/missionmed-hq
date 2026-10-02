-- Authorized QA-only recoverable archival under DR-359/360 and direct Founder cleanup authority.
-- Exact six frozen synthetic intake/offer pairs. Preserve all evidence; no deletion/DDL/provider action.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
DO $cleanup$
DECLARE n integer; r record; result jsonb; before_intakes text; after_intakes text; before_terms text; after_terms text; before_metadata text; after_metadata text; before_claims text; after_claims text;
BEGIN
 PERFORM 1 FROM command_center.usce_public_intake_requests WHERE id=ANY(ARRAY['796d4c87-1fc6-4311-9988-f83b7872e635','3bcef32b-a51b-4f12-9db9-de0ea3bc071c','f1f519aa-ad18-4827-b494-4c6a0a2c13cb','c211120c-8fbf-4440-bdbe-e9983422c588','4c783687-016d-49ae-bfa0-c0dbce58b959','f46642b1-faf9-4b26-8c42-e0cba6105687']::uuid[]) FOR UPDATE;
 PERFORM 1 FROM command_center.usce_offer_drafts WHERE intake_request_id=ANY(ARRAY['796d4c87-1fc6-4311-9988-f83b7872e635','3bcef32b-a51b-4f12-9db9-de0ea3bc071c','f1f519aa-ad18-4827-b494-4c6a0a2c13cb','c211120c-8fbf-4440-bdbe-e9983422c588','4c783687-016d-49ae-bfa0-c0dbce58b959','f46642b1-faf9-4b26-8c42-e0cba6105687']::uuid[]) FOR UPDATE;
 PERFORM 1 FROM command_center.usce_send_claims WHERE offer_id IN (SELECT id FROM command_center.usce_offer_drafts WHERE intake_request_id=ANY(ARRAY['796d4c87-1fc6-4311-9988-f83b7872e635','3bcef32b-a51b-4f12-9db9-de0ea3bc071c','f1f519aa-ad18-4827-b494-4c6a0a2c13cb','c211120c-8fbf-4440-bdbe-e9983422c588','4c783687-016d-49ae-bfa0-c0dbce58b959','f46642b1-faf9-4b26-8c42-e0cba6105687']::uuid[])) FOR UPDATE;
 IF (SELECT count(*) FROM command_center.usce_public_intake_requests
 WHERE id=ANY(ARRAY['796d4c87-1fc6-4311-9988-f83b7872e635','3bcef32b-a51b-4f12-9db9-de0ea3bc071c','f1f519aa-ad18-4827-b494-4c6a0a2c13cb','c211120c-8fbf-4440-bdbe-e9983422c588','4c783687-016d-49ae-bfa0-c0dbce58b959','f46642b1-faf9-4b26-8c42-e0cba6105687']::uuid[]) AND source='usce-qa-20261002-foreman' AND email='info+usce-qa-20261002@missionmedinstitute.com'
 AND student_name LIKE 'USCE QA TEST 20261002 %' AND status='new')<>6 THEN RAISE EXCEPTION 'Post-lock QA intake custody mismatch';END IF;
 IF (SELECT count(*) FROM command_center.usce_offer_drafts WHERE intake_request_id=ANY(ARRAY['796d4c87-1fc6-4311-9988-f83b7872e635','3bcef32b-a51b-4f12-9db9-de0ea3bc071c','f1f519aa-ad18-4827-b494-4c6a0a2c13cb','c211120c-8fbf-4440-bdbe-e9983422c588','4c783687-016d-49ae-bfa0-c0dbce58b959','f46642b1-faf9-4b26-8c42-e0cba6105687']::uuid[]))<>6 THEN RAISE EXCEPTION 'QA offer cardinality mismatch';END IF;
 IF (SELECT count(*) FROM (VALUES ('796d4c87-1fc6-4311-9988-f83b7872e635'::uuid,'85a0041e-b6b4-4ea2-b154-30c66a92fbce'::uuid,'accepted'::text,6::bigint),
('3bcef32b-a51b-4f12-9db9-de0ea3bc071c'::uuid,'4375a0d9-ebe9-4b54-b74e-2f64579144af'::uuid,'declined_no_notify'::text,2::bigint),
('f1f519aa-ad18-4827-b494-4c6a0a2c13cb'::uuid,'09082aca-83cf-488b-a3c3-fe50be48e917'::uuid,'alternate_requested'::text,2::bigint),
('c211120c-8fbf-4440-bdbe-e9983422c588'::uuid,'dbbe418c-f0a8-47a2-87f2-4cf77a4d5d16'::uuid,'ready'::text,6::bigint),
('4c783687-016d-49ae-bfa0-c0dbce58b959'::uuid,'2f3839ae-0b61-4460-94d9-960e2e60455b'::uuid,'accepted'::text,5::bigint),
('f46642b1-faf9-4b26-8c42-e0cba6105687'::uuid,'dd8e42a7-7c22-4930-8a28-b4400fec863c'::uuid,'declined_notify_future'::text,2::bigint)) expected(intake_id,offer_id,status,revision)
 JOIN command_center.usce_offer_drafts o ON o.intake_request_id=expected.intake_id AND o.id=expected.offer_id AND o.status=expected.status AND o.revision=expected.revision
 WHERE NOT (o.metadata ? 'qa_cleanup'))<>6 THEN RAISE EXCEPTION 'Post-lock exact QA offer preimage mismatch';END IF;
 IF EXISTS(SELECT 1 FROM command_center.usce_send_claims WHERE offer_id IN(SELECT id FROM command_center.usce_offer_drafts WHERE intake_request_id=ANY(ARRAY['796d4c87-1fc6-4311-9988-f83b7872e635','3bcef32b-a51b-4f12-9db9-de0ea3bc071c','f1f519aa-ad18-4827-b494-4c6a0a2c13cb','c211120c-8fbf-4440-bdbe-e9983422c588','4c783687-016d-49ae-bfa0-c0dbce58b959','f46642b1-faf9-4b26-8c42-e0cba6105687']::uuid[])) AND state IN('claimed','ambiguous')) THEN RAISE EXCEPTION 'Unsettled send blocks cleanup';END IF;
 SELECT md5(coalesce(jsonb_agg(to_jsonb(i)-ARRAY['status','updated_at'] ORDER BY i.id),'[]'::jsonb)::text) INTO before_intakes FROM command_center.usce_public_intake_requests i WHERE i.id=ANY(ARRAY['796d4c87-1fc6-4311-9988-f83b7872e635','3bcef32b-a51b-4f12-9db9-de0ea3bc071c','f1f519aa-ad18-4827-b494-4c6a0a2c13cb','c211120c-8fbf-4440-bdbe-e9983422c588','4c783687-016d-49ae-bfa0-c0dbce58b959','f46642b1-faf9-4b26-8c42-e0cba6105687']::uuid[]);
 SELECT md5(coalesce(jsonb_agg(to_jsonb(o)-ARRAY['status','updated_at','updated_by','revision','metadata'] ORDER BY o.id),'[]'::jsonb)::text),
 md5(coalesce(jsonb_agg(jsonb_build_object('id',o.id,'metadata',o.metadata-'qa_cleanup') ORDER BY o.id),'[]'::jsonb)::text)
 INTO before_terms,before_metadata FROM command_center.usce_offer_drafts o WHERE o.intake_request_id=ANY(ARRAY['796d4c87-1fc6-4311-9988-f83b7872e635','3bcef32b-a51b-4f12-9db9-de0ea3bc071c','f1f519aa-ad18-4827-b494-4c6a0a2c13cb','c211120c-8fbf-4440-bdbe-e9983422c588','4c783687-016d-49ae-bfa0-c0dbce58b959','f46642b1-faf9-4b26-8c42-e0cba6105687']::uuid[]);
 SELECT md5(coalesce(jsonb_agg(to_jsonb(c) ORDER BY c.id),'[]'::jsonb)::text) INTO before_claims FROM command_center.usce_send_claims c WHERE c.offer_id IN(SELECT id FROM command_center.usce_offer_drafts WHERE intake_request_id=ANY(ARRAY['796d4c87-1fc6-4311-9988-f83b7872e635','3bcef32b-a51b-4f12-9db9-de0ea3bc071c','f1f519aa-ad18-4827-b494-4c6a0a2c13cb','c211120c-8fbf-4440-bdbe-e9983422c588','4c783687-016d-49ae-bfa0-c0dbce58b959','f46642b1-faf9-4b26-8c42-e0cba6105687']::uuid[]));
 FOR r IN SELECT id FROM command_center.usce_public_intake_requests WHERE id=ANY(ARRAY['796d4c87-1fc6-4311-9988-f83b7872e635','3bcef32b-a51b-4f12-9db9-de0ea3bc071c','f1f519aa-ad18-4827-b494-4c6a0a2c13cb','c211120c-8fbf-4440-bdbe-e9983422c588','4c783687-016d-49ae-bfa0-c0dbce58b959','f46642b1-faf9-4b26-8c42-e0cba6105687']::uuid[]) LOOP
 result:=public.update_usce_public_intake_request_status(r.id,'archived');
 IF result->>'ok' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'QA intake archive failed';END IF;
 END LOOP;
 UPDATE command_center.usce_offer_drafts o SET
 metadata=o.metadata||jsonb_build_object('qa_cleanup',jsonb_build_object('mission','USCE-PHIL-FIRST-RENOVATION-20261002','operation','recoverable_synthetic_archive','previous_status',o.status,'previous_revision',o.revision,'previous_intake_status','new','actor','codex-usce-foreman','recorded_at',now(),'reason','Completed authorized synthetic QA; hide owned cases and deny test links. All business evidence retained.')),
 status='archived',revision=o.revision+1,updated_by='codex-usce-foreman'
 WHERE o.intake_request_id=ANY(ARRAY['796d4c87-1fc6-4311-9988-f83b7872e635','3bcef32b-a51b-4f12-9db9-de0ea3bc071c','f1f519aa-ad18-4827-b494-4c6a0a2c13cb','c211120c-8fbf-4440-bdbe-e9983422c588','4c783687-016d-49ae-bfa0-c0dbce58b959','f46642b1-faf9-4b26-8c42-e0cba6105687']::uuid[]);
 GET DIAGNOSTICS n=ROW_COUNT;IF n<>6 THEN RAISE EXCEPTION 'QA offer archive count mismatch';END IF;
 IF (SELECT count(*) FROM command_center.usce_public_intake_requests WHERE id=ANY(ARRAY['796d4c87-1fc6-4311-9988-f83b7872e635','3bcef32b-a51b-4f12-9db9-de0ea3bc071c','f1f519aa-ad18-4827-b494-4c6a0a2c13cb','c211120c-8fbf-4440-bdbe-e9983422c588','4c783687-016d-49ae-bfa0-c0dbce58b959','f46642b1-faf9-4b26-8c42-e0cba6105687']::uuid[]) AND status='archived')<>6 THEN RAISE EXCEPTION 'QA intake archive count mismatch';END IF;
 SELECT md5(coalesce(jsonb_agg(to_jsonb(i)-ARRAY['status','updated_at'] ORDER BY i.id),'[]'::jsonb)::text) INTO after_intakes FROM command_center.usce_public_intake_requests i WHERE i.id=ANY(ARRAY['796d4c87-1fc6-4311-9988-f83b7872e635','3bcef32b-a51b-4f12-9db9-de0ea3bc071c','f1f519aa-ad18-4827-b494-4c6a0a2c13cb','c211120c-8fbf-4440-bdbe-e9983422c588','4c783687-016d-49ae-bfa0-c0dbce58b959','f46642b1-faf9-4b26-8c42-e0cba6105687']::uuid[]);
 SELECT md5(coalesce(jsonb_agg(to_jsonb(o)-ARRAY['status','updated_at','updated_by','revision','metadata'] ORDER BY o.id),'[]'::jsonb)::text),
 md5(coalesce(jsonb_agg(jsonb_build_object('id',o.id,'metadata',o.metadata-'qa_cleanup') ORDER BY o.id),'[]'::jsonb)::text)
 INTO after_terms,after_metadata FROM command_center.usce_offer_drafts o WHERE o.intake_request_id=ANY(ARRAY['796d4c87-1fc6-4311-9988-f83b7872e635','3bcef32b-a51b-4f12-9db9-de0ea3bc071c','f1f519aa-ad18-4827-b494-4c6a0a2c13cb','c211120c-8fbf-4440-bdbe-e9983422c588','4c783687-016d-49ae-bfa0-c0dbce58b959','f46642b1-faf9-4b26-8c42-e0cba6105687']::uuid[]);
 SELECT md5(coalesce(jsonb_agg(to_jsonb(c) ORDER BY c.id),'[]'::jsonb)::text) INTO after_claims FROM command_center.usce_send_claims c WHERE c.offer_id IN(SELECT id FROM command_center.usce_offer_drafts WHERE intake_request_id=ANY(ARRAY['796d4c87-1fc6-4311-9988-f83b7872e635','3bcef32b-a51b-4f12-9db9-de0ea3bc071c','f1f519aa-ad18-4827-b494-4c6a0a2c13cb','c211120c-8fbf-4440-bdbe-e9983422c588','4c783687-016d-49ae-bfa0-c0dbce58b959','f46642b1-faf9-4b26-8c42-e0cba6105687']::uuid[]));
 IF before_intakes IS DISTINCT FROM after_intakes OR before_terms IS DISTINCT FROM after_terms OR before_metadata IS DISTINCT FROM after_metadata OR before_claims IS DISTINCT FROM after_claims THEN RAISE EXCEPTION 'QA preserved evidence changed';END IF;
END
$cleanup$;
COMMIT;
