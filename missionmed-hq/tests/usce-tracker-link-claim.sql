BEGIN;
DO $test$
DECLARE req uuid; other uuid; key text:='mmwp1-'||repeat('a',64); proof text:=repeat('c',64); item jsonb; n integer;
BEGIN
  IF NOT public.usce_tracker_prepare(101,'one@example.test',key) THEN RAISE EXCEPTION 'prepare failed'; END IF;
  INSERT INTO command_center.usce_public_intake_requests(student_name,email,preferred_specialties,preferred_locations,preferred_months_or_dates,consent,idempotency_key)
    VALUES('QA original','one@example.test','["A"]','["B"]','["C"]',true,key) RETURNING id INTO req;
  IF NOT EXISTS(SELECT FROM command_center.usce_tracker_account_cases WHERE intake_request_id=req AND wp_user_id=101) OR NOT public.usce_tracker_prepare(101,'one@example.test',key) OR public.usce_tracker_prepare(102,'one@example.test',key) THEN RAISE EXCEPTION 'wrong owner or replay'; END IF;
  BEGIN
    INSERT INTO command_center.usce_public_intake_requests(student_name,email,preferred_specialties,preferred_locations,preferred_months_or_dates,consent,idempotency_key)
      VALUES('QA missing','two@example.test','["A"]','["B"]','["C"]',true,'mmwp1-'||repeat('b',64));
    RAISE EXCEPTION 'bad insert succeeded' USING ERRCODE='XX000';
  EXCEPTION WHEN raise_exception THEN NULL; END;
  INSERT INTO command_center.usce_public_intake_requests(student_name,email,preferred_specialties,preferred_locations,preferred_months_or_dates,consent)
    VALUES('QA guest','two@example.test','["A"]','["B"]','["C"]',true) RETURNING id INTO other;
  PERFORM public.usce_tracker_request_claim(102,'one@example.test',other);
  IF public.usce_tracker_issue(proof)<>'{}' THEN RAISE EXCEPTION 'wrong email sent'; END IF;
  PERFORM public.usce_tracker_request_claim(102,'two@example.test',other);
  PERFORM public.usce_tracker_request_claim(102,'two@example.test',other);
  SELECT count(*) INTO n FROM command_center.usce_tracker_claims; IF n<>1 THEN RAISE EXCEPTION 'duplicate'; END IF;
  item:=public.usce_tracker_issue(proof);
  IF item->>'email' IS DISTINCT FROM 'two@example.test' OR public.usce_tracker_issue(proof)<>'{}' THEN RAISE EXCEPTION 'double delivery'; END IF;
  IF public.usce_tracker_finish_claim(101,'two@example.test',other,proof) THEN RAISE EXCEPTION 'other account'; END IF;
  FOR i IN 1..5 LOOP PERFORM public.usce_tracker_finish_claim(102,'two@example.test',other,repeat('d',64)); END LOOP;
  IF public.usce_tracker_finish_claim(102,'two@example.test',other,proof) THEN RAISE EXCEPTION 'attempt budget'; END IF;
  UPDATE command_center.usce_tracker_claims SET created_at=now()-interval '4 min', expires_at=now()-interval '1 sec', failures=0;
  IF public.usce_tracker_finish_claim(102,'two@example.test',other,proof) THEN RAISE EXCEPTION 'expired code'; END IF;
  PERFORM public.usce_tracker_request_claim(102,'two@example.test',other);
  PERFORM public.usce_tracker_issue(repeat('e',64));
  IF public.usce_tracker_finish_claim(102,'two@example.test',other,proof) OR NOT public.usce_tracker_finish_claim(102,'two@example.test',other,repeat('e',64)) OR public.usce_tracker_finish_claim(102,'two@example.test',other,repeat('e',64)) THEN RAISE EXCEPTION 'rotate/consume'; END IF;
  PERFORM public.usce_tracker_request_claim(103,'two@example.test',other);
  IF public.usce_tracker_issue(proof)<>'{}' THEN RAISE EXCEPTION 'reassignment'; END IF;
END $test$;
SET LOCAL ROLE service_role;
SELECT public.usce_tracker_prepare(9001,'fixture@example.test','mmwp1-'||repeat('0',64));
RESET ROLE;
DO $$ BEGIN IF has_function_privilege('anon','public.usce_tracker_prepare(bigint,text,text)','execute') OR has_function_privilege('authenticated','public.usce_tracker_finish_claim(bigint,text,uuid,text)','execute') THEN RAISE EXCEPTION 'public grant'; END IF; END $$;
ROLLBACK;
