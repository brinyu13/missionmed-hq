
BEGIN;
DO $test$
DECLARE sid uuid; s text; result jsonb; request text;
BEGIN
  IF has_function_privilege('anon','missionaccounts.api_save_student_onboarding_v2(uuid,text,text,text,text,text,text,text,text,text,text,text[],integer,text,text,text)','execute')
     OR has_function_privilege('authenticated','missionaccounts.api_save_student_onboarding_v2(uuid,text,text,text,text,text,text,text,text,text,text,text[],integer,text,text,text)','execute') THEN
    RAISE EXCEPTION 'Private RPC exposed';
  END IF;
  INSERT INTO missionaccounts.billing_terms(version,summary,body_text,body_sha256,status,approved_by,approved_at)
    VALUES ('p0-local-terms','Local terms','Local terms',encode(extensions.digest(convert_to('Local terms','UTF8'),'sha256'),'hex'),'approved','local-founder',now());
  FOREACH s IN ARRAY ARRAY['DIRECT','UCC','MUL'] LOOP
    INSERT INTO missionaccounts.student(matrix_user_ref,display_name,email,identity_state,sponsor_type,sponsor_name,sponsor_updated_at,sponsor_updated_by,sponsor_request_id)
      VALUES ('wp:p0-'||s,'Local phone fixture','phone-'||lower(s)||'@example.test','verified',s,case when s<>'DIRECT' then s end,case when s<>'DIRECT' then now() end,case when s<>'DIRECT' then 'local-admin' end,case when s<>'DIRECT' then 'p0-sponsor-'||s end) RETURNING id INTO sid;
    INSERT INTO missionaccounts.exam_plan(student_id,step,exam_on,state,submitted_by)
      VALUES(sid,'s1','2027-01-01','pending',sid::text);
    IF s='DIRECT' THEN
      INSERT INTO missionaccounts.stripe_customer_private(student_id,provider,provider_customer_ref) VALUES(sid,'stripe','cus_local_p0');
      INSERT INTO missionaccounts.payment_method_private(student_id,provider,provider_customer_ref,provider_pm_ref,brand,last4,status)
        VALUES(sid,'stripe','cus_local_p0','pm_local_p0','visa','4242','on_file');
      INSERT INTO missionaccounts.billing_consent(student_id,terms_version,accepted_at,state,actor_id,request_id)
        VALUES(sid,'p0-local-terms',now(),'authorized',sid::text,'p0-local-consent');
    END IF;
    result := missionaccounts.api_save_student_onboarding_v2(sid,null,'QA','Medical School','email','100 Test Street',null,'City','Region','12345','US',
      ARRAY['preferred_name','school_name','best_contact_method','mailing_line1','mailing_line2','mailing_city','mailing_region','mailing_postal_code','mailing_country_code'],
      0,sid::text,'student','p0-profile-'||s);
    IF result->'onboarding'->'missing_steps' <> '["CONTACT"]'::jsonb THEN RAISE EXCEPTION 'CONTACT-only reproduction failed: %',result; END IF;
    request := 'p0-phone-'||s;
    result := missionaccounts.api_save_student_onboarding_v2(sid,'+1 (555) 555-0123',null,null,null,null,null,null,null,null,null,
      ARRAY['phone'],1,sid::text,'student',request);
    IF result->'onboarding'->>'status' <> 'COMPLETE' OR result->'onboarding'->'missing_steps' <> '[]'::jsonb THEN RAISE EXCEPTION 'Completion failed for %: %',s,result; END IF;
    IF s <> 'DIRECT' AND result->'onboarding'->>'payment_requirement' <> 'NOT_APPLICABLE' THEN RAISE EXCEPTION 'Sponsor exemption failed'; END IF;
    result := missionaccounts.api_save_student_onboarding_v2(sid,'+1 (555) 555-0123',null,null,null,null,null,null,null,null,null,ARRAY['phone'],1,sid::text,'student',request);
    IF result->>'duplicate' <> 'true' THEN RAISE EXCEPTION 'Retry is not idempotent'; END IF;
    BEGIN
      PERFORM missionaccounts.api_save_student_onboarding_v2(sid,'+15555550124',null,null,null,null,null,null,null,null,null,ARRAY['phone'],1,sid::text,'student','p0-stale-'||s);
      RAISE EXCEPTION 'Stale phone write allowed';
    EXCEPTION WHEN SQLSTATE 'PT409' THEN NULL; END;
    BEGIN
      PERFORM missionaccounts.api_save_student_onboarding_v2(sid,'+15555550124',null,null,null,null,null,null,null,null,null,ARRAY['phone'],2,gen_random_uuid()::text,'student','p0-cross-'||s);
      RAISE EXCEPTION 'Cross-principal phone write allowed';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
    BEGIN
      PERFORM missionaccounts.api_save_student_onboarding_v2(sid,'+15555550124',null,'A',null,null,null,null,null,null,null,ARRAY['phone','school_name'],2,sid::text,'student','p0-invalid-'||s);
      RAISE EXCEPTION 'Invalid profile atomically changed phone';
    EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
    IF (SELECT phone FROM missionaccounts.student WHERE id=sid) <> '+1 (555) 555-0123' THEN RAISE EXCEPTION 'Rejected write changed phone'; END IF;
    IF (SELECT revision FROM missionaccounts.student_onboarding_profile WHERE student_id=sid) <> 2 THEN RAISE EXCEPTION 'Rejected write changed revision'; END IF;
    IF missionaccounts.onboarding_state_for_student(sid)->>'status' <> 'COMPLETE' THEN RAISE EXCEPTION 'Reload completion failed'; END IF;
    IF EXISTS (SELECT 1 FROM missionaccounts.audit_event WHERE subject_student_id=sid AND to_val::text LIKE '%555-0123%') THEN RAISE EXCEPTION 'Phone value leaked into audit'; END IF;
  END LOOP;
END $test$;
ROLLBACK;
