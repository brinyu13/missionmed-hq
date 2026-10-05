-- Frozen new intake / sent Offer revision6. Requires independent approval and Root healthy exact cleanup lease before execution.
-- Founder-authorized recoverable synthetic archive. No deletion, term/token/claim/email-content changes.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
DO $cleanup$
DECLARE i command_center.usce_public_intake_requests%ROWTYPE; o command_center.usce_offer_drafts%ROWTYPE;
 before_i text; before_o text; before_m text; before_c text; after_i text; after_o text; after_m text; after_c text; result jsonb; n integer;
BEGIN
 SELECT * INTO STRICT i FROM command_center.usce_public_intake_requests WHERE id='d7451937-8665-4716-bf9a-fcb7838807bd' FOR UPDATE;
 SELECT * INTO STRICT o FROM command_center.usce_offer_drafts WHERE id='01912feb-10f5-45ed-93ec-58a59f37b3f6' FOR UPDATE;
 PERFORM 1 FROM command_center.usce_send_claims WHERE offer_id=o.id FOR UPDATE;
 IF i.student_name IS DISTINCT FROM 'USCE QA TEST 20261004 V2 Journey' OR i.email IS DISTINCT FROM 'info+usce-qa-20261002@missionmedinstitute.com' OR i.source IS DISTINCT FROM 'usce-qa-20261004-v2-journey' OR i.status IS DISTINCT FROM 'new' THEN RAISE EXCEPTION 'Exact QA intake custody mismatch'; END IF;
 IF o.intake_request_id IS DISTINCT FROM i.id OR o.status IS DISTINCT FROM 'sent' OR o.revision<>6 OR o.metadata ? 'qa_cleanup' THEN RAISE EXCEPTION 'Exact QA offer preimage mismatch'; END IF;
 IF (SELECT count(*) FROM command_center.usce_offer_drafts WHERE intake_request_id=i.id)<>1 THEN RAISE EXCEPTION 'QA cardinality mismatch'; END IF;
 IF EXISTS(SELECT 1 FROM command_center.usce_send_claims WHERE offer_id=o.id AND state IN('claimed','ambiguous')) THEN RAISE EXCEPTION 'Unsettled send blocks cleanup'; END IF;
 before_i:=md5((to_jsonb(i)-ARRAY['status','updated_at'])::text);
 before_o:=md5((to_jsonb(o)-ARRAY['status','updated_at','updated_by','revision','metadata'])::text);
 before_m:=md5((o.metadata-'qa_cleanup')::text);
 SELECT md5(coalesce(jsonb_agg(to_jsonb(c) ORDER BY c.id),'[]'::jsonb)::text) INTO before_c FROM command_center.usce_send_claims c WHERE offer_id=o.id;
 result:=public.update_usce_public_intake_request_status(i.id,'archived');
 IF result->>'ok' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'QA intake archive failed'; END IF;
 UPDATE command_center.usce_offer_drafts SET metadata=metadata||jsonb_build_object('qa_cleanup',jsonb_build_object('mission','USCE-PHIL-FIRST-RENOVATION-20261002','operation','recoverable_synthetic_archive','previous_status',o.status,'previous_revision',o.revision,'previous_intake_status',i.status,'actor','codex-usce-foreman','recorded_at',now(),'reason','Completed authorized V2 synthetic QA; hide owned case and deny test link. Business evidence retained.')),status='archived',revision=revision+1,updated_by='codex-usce-foreman' WHERE id=o.id;
 GET DIAGNOSTICS n=ROW_COUNT; IF n<>1 THEN RAISE EXCEPTION 'QA archive cardinality'; END IF;
 SELECT md5((to_jsonb(x)-ARRAY['status','updated_at'])::text) INTO after_i FROM command_center.usce_public_intake_requests x WHERE id=i.id AND status='archived';
 SELECT md5((to_jsonb(x)-ARRAY['status','updated_at','updated_by','revision','metadata'])::text),md5((x.metadata-'qa_cleanup')::text) INTO after_o,after_m FROM command_center.usce_offer_drafts x WHERE id=o.id AND status='archived' AND revision=o.revision+1;
 SELECT md5(coalesce(jsonb_agg(to_jsonb(c) ORDER BY c.id),'[]'::jsonb)::text) INTO after_c FROM command_center.usce_send_claims c WHERE offer_id=o.id;
 IF before_i IS DISTINCT FROM after_i OR before_o IS DISTINCT FROM after_o OR before_m IS DISTINCT FROM after_m OR before_c IS DISTINCT FROM after_c THEN RAISE EXCEPTION 'Preserved QA evidence changed'; END IF;
END
$cleanup$;
COMMIT;
