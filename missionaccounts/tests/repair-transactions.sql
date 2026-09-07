-- Executable 5401R regressions. Synthetic records only, rolled back together.
begin;
set local role service_role;
do $$
declare
 a uuid; b uuid; c uuid; er uuid; day_a uuid; day_b uuid;
 first_receipt jsonb; replay jsonb; reversed jsonb; control_rows jsonb; items jsonb;
 decision_id uuid; next_decision uuid; n integer;
begin
 insert into missionaccounts.student(display_name,email,identity_state,joined_at) values ('5401 Fixture A','fixture-a@example.invalid','verified','2026-09-10') returning id into a;
 insert into missionaccounts.student(display_name,email,identity_state) values ('5401 Fixture B','fixture-b@example.invalid','verified') returning id into b;
 insert into missionaccounts.student(display_name,email,identity_state) values ('5401 Fixture C','fixture-c@example.invalid','verified') returning id into c;
 -- Null joined-on is an input, not the denormalized effective joined date.
 first_receipt:=missionaccounts.api_set_comp_allowance(a,0,null,'Explicit zero override',false,'fixture:admin','missionaccounts_admin','repair-comp-null-0001');
 replay:=missionaccounts.api_set_comp_allowance(a,0,null,'Explicit zero override',false,'fixture:admin','missionaccounts_admin','repair-comp-null-0001');
 assert replay->>'duplicate'='true' and replay->>'change_id'=first_receipt->>'change_id','null joined-on replay changed receipt';
 begin
  perform missionaccounts.api_set_comp_allowance(a,0,null,'Explicit zero override',false,'fixture:admin','student','repair-comp-student-0001');
  raise exception 'student comp mutation was accepted';
 exception when insufficient_privilege then null; end;
 begin
  perform missionaccounts.api_set_comp_allowance(a,0,'2026-09-10','Explicit zero override',false,'fixture:admin','missionaccounts_admin','repair-comp-null-0001');
  raise exception 'changed comp request was accepted';
 exception when unique_violation then null; end;
 perform missionaccounts.api_link_student_account(a,gen_random_uuid()::text,null,'2026-09-11','Test linkage preserves explicit zero','fixture:admin','missionaccounts_admin','repair-comp-link-0001');
 assert (select comp_days_allowance=0 from missionaccounts.student where id=a),'account linkage replaced explicit zero with default five';

 insert into missionaccounts.engine_run(engine_version,source_digest,state) values ('5401-test',repeat('1',64),'succeeded') returning id into er;
 insert into missionaccounts.attendance_day(engine_run_id,student_id,cycle_key,day,kind,engine_version,source_digest)
 values (er,a,'2026-cycle-1','2026-06-20','billable','5401-test',repeat('1',64)) returning id into day_a;
 insert into missionaccounts.attendance_day(engine_run_id,student_id,cycle_key,day,kind,engine_version,source_digest)
 values (er,b,'2026-cycle-1','2026-06-20','billable','5401-test',repeat('1',64)) returning id into day_b;
 insert into missionaccounts.attendance_day(engine_run_id,student_id,cycle_key,day,kind,engine_version,source_digest)
 values (er,c,'2026-cycle-1','2026-06-20','billable','5401-test',repeat('1',64));
 control_rows:=missionaccounts.api_billing_batch_controls('2026-cycle-1',array[a,b],'missionaccounts_admin');
 select jsonb_agg(value || jsonb_build_object('expected_amount_cents',case when (value->>'student_id')::uuid=a then 2500 else 9999 end))
 into items from jsonb_array_elements(control_rows->'items');
 first_receipt:=missionaccounts.api_approve_billing_batch('2026-cycle-1',items,'Displayed group','fixture:admin','missionaccounts_admin','repair-batch-0001');
 assert first_receipt->>'partial'='true' and first_receipt->>'approved_count'='1' and first_receipt->>'rejected_count'='1', 'batch failed per-item rollback';
 assert not exists(select 1 from missionaccounts.invoice where student_id=b), 'rejected amount left invoice behind';
 assert not exists(select 1 from missionaccounts.billing_decision where student_id=b), 'rejected amount left approval behind';
 select id into decision_id from missionaccounts.billing_decision where student_id=a and superseded_by_id is null;
 assert decision_id is not null,'accepted item missing';
 select count(*) into n from missionaccounts.audit_event;
 select jsonb_agg(value order by value->>'student_id' desc) into items from jsonb_array_elements(items);
 replay:=missionaccounts.api_approve_billing_batch('2026-cycle-1',items,'Displayed group','fixture:admin','missionaccounts_admin','repair-batch-0001');
 assert replay->>'batch_id'=first_receipt->>'batch_id' and replay->>'duplicate'='true','batch replay changed receipt';
 assert (select count(*)=n from missionaccounts.audit_event),'batch replay added audit';
 begin
  perform missionaccounts.api_approve_billing_batch('2026-cycle-1',items,'Changed reason','fixture:admin','missionaccounts_admin','repair-batch-0001');
  raise exception 'changed batch request accepted';
 exception when unique_violation then null; end;
 begin
  update missionaccounts.billing_batch set result_controls='{}' where id=(first_receipt->>'batch_id')::uuid;
  raise exception 'completed batch receipt mutable';
 exception when check_violation then null; end;
 reversed:=missionaccounts.api_reverse_billing_batch((first_receipt->>'batch_id')::uuid,'Undo displayed group','fixture:admin','missionaccounts_admin','repair-batch-undo-0001');
 assert reversed->>'reversed_count'='1' and reversed->>'rejected_count'='0','batch reversal failed';
 assert (select state='cleared' and amount_cents=0 from missionaccounts.billing_decision where student_id=a and superseded_by_id is null),'clear marker missing';
 assert (select bool_and(state='void') from missionaccounts.invoice where student_id=a),'uncollected invoice not void';
 replay:=missionaccounts.api_reverse_billing_batch((first_receipt->>'batch_id')::uuid,'Undo displayed group','fixture:admin','missionaccounts_admin','repair-batch-undo-0001');
 assert replay->>'duplicate'='true' and replay->>'batch_id'=reversed->>'batch_id','batch undo replay changed result';
 replay:=missionaccounts.api_reverse_billing_decision(decision_id,'Old button','fixture:admin','missionaccounts_admin','repair-old-decision-0001');
 assert replay->>'accepted'='false' and replay->>'reason'='current_billing_decision_required','old target reversed a newer marker';
 first_receipt:=missionaccounts.api_approve_billing_decision(a,'2026-cycle-1','ucc',null,'Valid no-charge fixture','fixture:admin','missionaccounts_admin','repair-ucc-0001');
 assert first_receipt->>'accepted'='true','reapproval after clear failed';
 next_decision:=(first_receipt#>>'{decision,id}')::uuid;
 reversed:=missionaccounts.api_reverse_billing_decision(next_decision,'Undo no-charge fixture','fixture:admin','missionaccounts_admin','repair-ucc-undo-0001');
 assert reversed->>'accepted'='true','no-charge reversal failed';
 first_receipt:=missionaccounts.api_approve_billing_decision(c,'2026-cycle-1','confirm',null,null,'fixture:admin','missionaccounts_admin','repair-provider-hold-0001');
 next_decision:=(first_receipt#>>'{decision,id}')::uuid;
 update missionaccounts.invoice set provider_ref='in_fixture5401',state='sent' where student_id=c;
 reversed:=missionaccounts.api_reverse_billing_decision(next_decision,'Must hold','fixture:admin','missionaccounts_admin','repair-provider-undo-0001');
 assert reversed->>'accepted'='false' and reversed->>'reason'='billing_reversal_requires_financial_review','provider invoice reversal was allowed';
 assert (select state='approved' from missionaccounts.billing_decision where id=next_decision),'rejected reversal mutated approval';
 replay:=missionaccounts.api_approve_billing_decision(c,'2026-cycle-1','ucc',null,'Must preserve provider custody','fixture:admin','missionaccounts_admin','repair-provider-approve-0002');
 assert replay->>'accepted'='false' and replay->>'reason'='billing_change_requires_financial_review','ordinary approval bypassed custody';
 begin
  perform missionaccounts.api_set_cycle_policy('2026-cycle-1','pending','Must preserve provider custody','fixture:admin','missionaccounts_admin','repair-provider-policy-0001');
  raise exception 'policy clear bypassed custody';
 exception when check_violation then assert SQLERRM='billing_policy_requires_financial_review'; end;
 assert (select state='approved' from missionaccounts.billing_decision where id=next_decision),'custody rejection changed decision';
 -- Policy clear is an appended pending interpretation, never deletion.
 first_receipt:=missionaccounts.api_set_cycle_policy('2026-cycle-2','cap','Fixture cap','fixture:admin','missionaccounts_admin','repair-policy-0001');
 reversed:=missionaccounts.api_set_cycle_policy('2026-cycle-2','pending','Reopen policy','fixture:admin','missionaccounts_admin','repair-policy-0002');
 assert (select value->>'decision'='pending' from missionaccounts.cycle_policy where cycle_key='2026-cycle-2' and superseded_by_id is null),'policy clear not pending';
 replay:=missionaccounts.api_set_cycle_policy('2026-cycle-2','pending','Reopen policy','fixture:admin','missionaccounts_admin','repair-policy-0002');
 assert replay->>'duplicate'='true','policy replay not idempotent';
end;
$$;
DO $$
DECLARE dispatch_state text; fixture_cycle text; sid uuid; erid uuid; did uuid; iid uuid; policy_id uuid; r jsonb; before_rows jsonb;
BEGIN
 FOREACH dispatch_state IN ARRAY ARRAY['prepared','failed'] LOOP
  fixture_cycle := 'repair-5401-custody-' || dispatch_state;
  INSERT INTO missionaccounts.cycle(key,label,starts_on,ends_on) VALUES(fixture_cycle,'5401 custody fixture','2026-09-01','2026-09-30');
  INSERT INTO missionaccounts.student(display_name,email,identity_state) VALUES('5401 '||dispatch_state,'fixture@example.invalid','verified') RETURNING id INTO sid;
  INSERT INTO missionaccounts.engine_run(engine_version,source_digest,state) VALUES('5401-custody-test',repeat('4',64),'succeeded') RETURNING id INTO erid;
  INSERT INTO missionaccounts.attendance_day(engine_run_id,student_id,cycle_key,day,kind,engine_version,source_digest) VALUES(erid,sid,fixture_cycle,'2026-09-20','billable','5401-custody-test',repeat('4',64));
  r := missionaccounts.api_set_cycle_policy(fixture_cycle,'cap','Fixture policy','fixture:admin','missionaccounts_admin',fixture_cycle||'-policy'); policy_id := (r#>>'{policy,id}')::uuid;
  r := missionaccounts.api_approve_billing_decision(sid,fixture_cycle,'confirm',NULL,NULL,'fixture:admin','missionaccounts_admin',fixture_cycle||'-approve'); ASSERT r->>'accepted'='true';
  did := (r#>>'{decision,id}')::uuid; iid := (r#>>'{invoice,id}')::uuid;
  UPDATE missionaccounts.invoice SET state='ready' WHERE id=iid;
  INSERT INTO missionaccounts.stripe_invoice_dispatch(invoice_id,action,request_id,request_controls,state) VALUES(iid,'send',fixture_cycle||'-dispatch',jsonb_build_object('fixture',true),dispatch_state);
  SELECT jsonb_build_object('decision',to_jsonb(d),'invoice',to_jsonb(i)) INTO before_rows FROM missionaccounts.billing_decision d JOIN missionaccounts.invoice i ON i.decision_id=d.id WHERE d.id=did AND i.id=iid;
  ASSERT missionaccounts.billing_has_financial_custody(sid,fixture_cycle);
  r := missionaccounts.api_reverse_billing_decision(did,'Must preserve attempt','fixture:admin','missionaccounts_admin',fixture_cycle||'-reverse'); ASSERT r->>'accepted'='false' AND r->>'reason'='billing_reversal_requires_financial_review';
  r := missionaccounts.api_approve_billing_decision(sid,fixture_cycle,'ucc',NULL,'Must preserve attempt','fixture:admin','missionaccounts_admin',fixture_cycle||'-reapprove'); ASSERT r->>'accepted'='false' AND r->>'reason'='billing_change_requires_financial_review';
  BEGIN
   PERFORM missionaccounts.api_set_cycle_policy(fixture_cycle,'pending','Must preserve attempt','fixture:admin','missionaccounts_admin',fixture_cycle||'-clear'); RAISE EXCEPTION 'custody policy clear incorrectly accepted';
  EXCEPTION WHEN check_violation THEN ASSERT SQLERRM='billing_policy_requires_financial_review'; END;
  ASSERT (SELECT jsonb_build_object('decision',to_jsonb(d),'invoice',to_jsonb(i))=before_rows FROM missionaccounts.billing_decision d JOIN missionaccounts.invoice i ON i.decision_id=d.id WHERE d.id=did AND i.id=iid),'custody hold changed financial rows';
  ASSERT (SELECT id=policy_id FROM missionaccounts.cycle_policy WHERE cycle_key=fixture_cycle AND superseded_by_id IS NULL),'custody hold replaced policy';
  ASSERT (SELECT state=dispatch_state FROM missionaccounts.stripe_invoice_dispatch WHERE invoice_id=iid),'custody hold changed dispatch';
  PERFORM missionaccounts.recompute_student_attendance(sid,'5401-provider-preservation-fixture');
  ASSERT (SELECT state='ready' FROM missionaccounts.invoice WHERE id=iid),'attendance recompute voided provider attempt';
 END LOOP;
END $$;

rollback;
