-- Local isolated rehearsal only. The enclosing rollback preserves the sealed baseline.
begin;
update missionaccounts.financial_operating_gate set founder_operations=true;
do $$ declare p uuid:='00000000-0000-4000-8000-000000000001'; o uuid; r jsonb; x jsonb; before_balance bigint;
begin
 select id into strict o from missionaccounts.financial_obligation_state
  where agreement_id=(select id from missionaccounts.financial_agreement where subject_key='match360:ruqayyah') and remaining_cents>0;
 select balance_cents into before_balance from missionaccounts.financial_balance where subject_key='match360:ruqayyah';
 x:=jsonb_build_object('confirmed',true,'authority_ref','DR-fixture','evidence_sha256',repeat('a',64),'expected_revision',null,
  'installments',jsonb_build_array(jsonb_build_object('key','one','obligation_id',o,'amount_cents',100000,'due_on',null),jsonb_build_object('key','two','obligation_id',o,'amount_cents',74950,'due_on','2026-11-05')));
 r:=missionaccounts.api_financial_operate(p,1,'match360:ruqayyah','SAVE_SCHEDULE',x,'fixture-schedule-1');
 if r->>'duplicate'<>'false' then raise exception 'Initial schedule did not persist';end if;
 if (select balance_cents from missionaccounts.financial_balance where subject_key='match360:ruqayyah')<>before_balance then raise exception 'Schedule created duplicate debt';end if;
 if (select count(*) from missionaccounts.financial_active_schedule where subject_key='match360:ruqayyah')<>2 then raise exception 'Schedule projection mismatch';end if;
 if missionaccounts.financial_operational_due('match360:ruqayyah')->>'currently_due_cents' is not null then raise exception 'Unknown date became due';end if;
 begin perform missionaccounts.api_financial_operate(p,1,'match360:ruqayyah','ADJUST_OBLIGATION',jsonb_build_object('confirmed',true,'authority_ref','DR-fixture','evidence_sha256',repeat('a',64),'obligation_id',o,'amount_cents',1,'kind','CREDIT'),'fixture-overallocated-credit');raise exception 'Schedule exceeded adjusted balance';exception when raise_exception then if SQLERRM='Schedule exceeded adjusted balance' then raise;end if;end;
 if (missionaccounts.api_financial_operate(p,1,'match360:ruqayyah','SAVE_SCHEDULE',x,'fixture-schedule-1')->>'duplicate')<>'true' then raise exception 'Schedule retry duplicated';end if;
 begin
  perform missionaccounts.api_financial_operate(p,1,'match360:ruqayyah','SAVE_SCHEDULE',x||jsonb_build_object('authority_ref','DIFFERENT'),'fixture-schedule-1');
  raise exception 'Idempotency conflict was accepted';
 exception when raise_exception then if SQLERRM='Idempotency conflict was accepted' then raise;end if;end;
 begin
  perform missionaccounts.api_financial_operate(p,2,'match360:ruqayyah','SAVE_SCHEDULE',x,'fixture-schedule-denied');
  raise exception 'Generic admin was accepted';
 exception when insufficient_privilege then null;end;
 begin
  perform missionaccounts.api_financial_operate(p,1,'match360:afthab','CREATE_OBLIGATION',jsonb_build_object('confirmed',true,'authority_ref','DR-fixture','evidence_sha256',repeat('a',64)),'fixture-held-denied');
  raise exception 'Held debt was accepted';
 exception when raise_exception then if SQLERRM='Held debt was accepted' then raise;end if;end;
 perform missionaccounts.api_financial_operate(p,1,'match360:afthab','SET_ONBOARDING_ELIGIBILITY',jsonb_build_object('confirmed',true,'authority_ref','DR-fixture','evidence_sha256',repeat('a',64),'required',true,'card_required',true,'reason','Founder explicit onboarding independent of hold'),'fixture-afthab-eligibility');
 if (missionaccounts.financial_operating_snapshot('match360:afthab')->'eligibility'->>'required')<>'true' then raise exception 'Afthab eligibility lost';end if;
 begin
  perform missionaccounts.api_financial_operate(p,1,'match360:monica','SET_ONBOARDING_ELIGIBILITY',jsonb_build_object('confirmed',true,'authority_ref','DR-fixture','evidence_sha256',repeat('a',64),'required',true,'card_required',true,'reason','Invalid forced card'),'fixture-pif-denied');
  raise exception 'Paid in full forced card';
 exception when raise_exception then if SQLERRM='Paid in full forced card' then raise;end if;end;
 begin
  update missionaccounts.financial_operating_event set after_state='{}'::jsonb where request_id='fixture-schedule-1';
  raise exception 'Audit history rewritten';
 exception when raise_exception then if SQLERRM='Audit history rewritten' then raise;end if;end;
end $$;
do $$ begin
 begin
  insert into missionaccounts.financial_runtime_binding(subject_key,principal_id,wp_user_id,authority_ref,evidence_sha256)
  values('match360:afthab','00000000-0000-4000-8000-000000000099',999999,'DR-fixture',repeat('a',64));
  raise exception 'Wrong financial beneficiary binding accepted';
 exception when insufficient_privilege then null;end;
end $$;
set local role authenticated;
do $$ begin
 begin perform 1 from missionaccounts.financial_runtime_binding;raise exception 'Browser private binding access';exception when insufficient_privilege then null;end;
 begin perform missionaccounts.api_financial_operating_command('00000000-0000-4000-8000-000000000001',1);raise exception 'Browser service RPC access';exception when insufficient_privilege then null;end;
end $$;
reset role;
rollback;

-- Provider calls are simulated; all new canonical events roll back.
begin;
update missionaccounts.financial_operating_gate set founder_operations=true,student_onboarding=true,student_publication=true,card_dispatch=true,stripe_account='acct_MR',charge_terms_version='fixture-specific-v1';
do $$ declare founder uuid:='00000000-0000-4000-8000-000000000001'; own uuid:='00000000-0000-4000-8000-000000000077'; provider uuid:='00000000-0000-4000-8000-000000000088'; wp bigint; o uuid; q uuid; q2 uuid; st uuid; method uuid; auth uuid; attempt uuid; r jsonb; e jsonb; s jsonb; before_balance bigint; installment uuid; app_id uuid; second_installment uuid;
begin
 insert into missionaccounts.financial_provider_binding values(provider,'phase1-local-rehearsal','DR-fixture',repeat('a',64));
 select substring(wp_subject from 4)::bigint into strict wp from missionaccounts.financial_subject where subject_key='match360:ruqayyah';
 insert into missionaccounts.financial_runtime_binding(subject_key,principal_id,wp_user_id,authority_ref,evidence_sha256) values('match360:ruqayyah',own,wp,'DR-fixture',repeat('a',64));
 perform missionaccounts.api_financial_operate(founder,1,'match360:ruqayyah','SET_ONBOARDING_ELIGIBILITY',jsonb_build_object('confirmed',true,'authority_ref','DR-fixture','evidence_sha256',repeat('a',64),'required',true,'card_required',true,'reason','Current certified arrangement'),'adapter-eligibility');
 perform missionaccounts.api_save_financial_onboarding(own,wp,jsonb_build_object('email','fixture@example.invalid','phone','111','contact_confirmed',true,'arrangement_acknowledged',true,'save_method_acknowledged',true),'adapter-profile-one');
 perform missionaccounts.api_save_financial_onboarding(own,wp,jsonb_build_object('email','fixture@example.invalid','phone','222','contact_confirmed',true,'arrangement_acknowledged',true,'save_method_acknowledged',true),'adapter-profile-two');
 if missionaccounts.api_financial_own_onboarding(own,wp)->'profile'->>'phone'<>'222' then raise exception 'Latest state sequence failed';end if;
 begin perform missionaccounts.api_financial_setup_context(own,wp+1,'adapter-setup-one');raise exception 'Wrong WP own account allowed';exception when insufficient_privilege then null;end;
 perform missionaccounts.api_financial_setup_context(own,wp,'adapter-setup-one');
 if missionaccounts.api_financial_own_onboarding(own,wp)->'pending_setup'->>'request_id'<>'adapter-setup-one' then raise exception 'Unlocated setup reservation could not be recovered';end if;
 r:=missionaccounts.api_financial_register_setup(own,wp,'adapter-setup-one','acct_MR','cus_MR','seti_MR');st:=(r->>'id')::uuid;
 if (missionaccounts.api_financial_register_setup(own,wp,'adapter-setup-one','acct_MR','cus_MR','seti_MR')->>'duplicate')<>'true' then raise exception 'Setup duplicated';end if;
 r:=missionaccounts.api_financial_confirm_setup(own,wp,'adapter-setup-one',jsonb_build_object('intent_ref','seti_MR','provider_account','acct_MR','customer_ref','cus_MR','payment_method_ref','pm_MR','brand','visa','last4','4242','exp_month',10,'exp_year',2030));method:=(r->>'id')::uuid;
 if missionaccounts.api_financial_provider_context('phase1-local-rehearsal','setup','seti_MR','adapter-setup-one')->>'principal'<>provider::text then raise exception 'Provider setup owner not resolved';end if;
 if missionaccounts.api_financial_confirm_setup(provider,0,'adapter-setup-one',jsonb_build_object('intent_ref','seti_MR','provider_account','acct_MR','customer_ref','cus_MR','payment_method_ref','pm_MR'))->>'duplicate'<>'true' then raise exception 'Provider setup replay duplicated';end if;
 if missionaccounts.api_financial_own_onboarding(own,wp)->'method'->>'last4'<>'4242' then raise exception 'Payment ready did not persist';end if;
 if missionaccounts.api_financial_own_account(own,wp)->'agreement'->>'tuition_cents' is null then raise exception 'Own certified projection failed';end if;
 select id,remaining_cents into strict o,before_balance from missionaccounts.financial_obligation_state where agreement_id=(select id from missionaccounts.financial_agreement where subject_key='match360:ruqayyah') and remaining_cents>0;
 r:=missionaccounts.api_financial_operate(founder,1,'match360:ruqayyah','SAVE_SCHEDULE',jsonb_build_object('confirmed',true,'authority_ref','DR-fixture','evidence_sha256',repeat('b',64),'expected_revision',null,'installments',jsonb_build_array(jsonb_build_object('key','first','obligation_id',o,'amount_cents',1000,'due_on',current_date),jsonb_build_object('key','second','obligation_id',o,'amount_cents',before_balance-1000,'due_on',current_date+30))),'adapter-schedule');
 if (missionaccounts.api_financial_own_account(own,wp)->'operational_due'->>'currently_due_cents')::bigint<>1000 then raise exception 'Active schedule due amount not derived';end if;
 select id into strict installment from missionaccounts.financial_schedule_installment where revision_id=(r->'result'->>'revision_id')::uuid and installment_key='first';
 select id into strict second_installment from missionaccounts.financial_schedule_installment where revision_id=(r->'result'->>'revision_id')::uuid and installment_key='second';
 begin perform missionaccounts.api_financial_operate(founder,1,'match360:ruqayyah','REQUEST_PAYMENT',jsonb_build_object('confirmed',true,'authority_ref','DR-fixture','evidence_sha256',repeat('b',64),'obligation_id',o,'amount_cents',1000,'description','Unallocated invalid request','methods',jsonb_build_array('CARD')),'adapter-unscheduled-denied');raise exception 'Scheduled principal requested without allocation';exception when raise_exception then if SQLERRM='Scheduled principal requested without allocation' then raise;end if;end;
 e:=jsonb_build_object('confirmed',true,'authority_ref','DR-fixture','evidence_sha256',repeat('b',64),'installment_id',installment,'obligation_id',o,'amount_cents',1000,'description','Fixture partial settlement','methods',jsonb_build_array('CARD','ZELLE'),'expires_at',null);
 r:=missionaccounts.api_financial_operate(founder,1,'match360:ruqayyah','REQUEST_PAYMENT',e,'adapter-request-one');q:=(r->'result'->>'request_id')::uuid;
 r:=missionaccounts.api_financial_operate(founder,1,'match360:ruqayyah','REQUEST_PAYMENT',e,'adapter-request-two');q2:=(r->'result'->>'request_id')::uuid;
 r:=missionaccounts.api_financial_authorize_charge(own,wp,q,method,'fixture-specific-v1','adapter-consent-one',true);auth:=(r->>'id')::uuid;
 r:=missionaccounts.api_financial_prepare_card(founder,1,q,'adapter-attempt-one','acct_MR',auth,true);attempt:=(r->>'id')::uuid;
 begin perform missionaccounts.api_financial_prepare_card(own,wp,q2,'adapter-attempt-two','acct_MR',null,true);raise exception 'Competing request overcommitted residual';exception when raise_exception then if SQLERRM='Competing request overcommitted residual' then raise;end if;end;
 begin perform missionaccounts.api_financial_operate(founder,1,'match360:ruqayyah','ADJUST_OBLIGATION',jsonb_build_object('confirmed',true,'authority_ref','DR-fixture','evidence_sha256',repeat('e',64),'obligation_id',o,'kind','WAIVER','amount_cents',1),'adapter-reserved-waiver');raise exception 'Reserved principal was waived';exception when raise_exception then if SQLERRM='Reserved principal was waived' then raise;end if;end;
 perform missionaccounts.api_financial_card_result(founder,1,attempt,null,'AMBIGUOUS',null,'phase1-local-rehearsal');
 if (select state from missionaccounts.financial_card_attempt where id=attempt)<>'AMBIGUOUS' then raise exception 'Ambiguous payment not held';end if;
 if (select balance_cents from missionaccounts.financial_balance where subject_key='match360:ruqayyah')<>before_balance then raise exception 'Ambiguous result marked paid';end if;
 begin perform missionaccounts.api_financial_prepare_card(own,wp,q2,'adapter-attempt-three','acct_MR',null,true);raise exception 'Ambiguous reservation lost';exception when raise_exception then if SQLERRM='Ambiguous reservation lost' then raise;end if;end;
 s:=jsonb_build_object('subject_key','match360:ruqayyah','provider','Stripe','provider_account','acct_MR','provider_identity','pi_MR','method','CARD','gross_cents',1000,'payer','Fixture','received_at','2026-10-05T00:00:00Z','received_precision','EXACT','verification_state','VERIFIED','request_id','adapter-settle-one','evidence',jsonb_build_array(jsonb_build_object('type','STRIPE_PAYMENT_INTENT','reference','pi_MR','fingerprint',repeat('c',64),'metadata','{}'::jsonb),jsonb_build_object('type','STRIPE_CHARGE','reference','ch_MR','fingerprint',repeat('d',64),'metadata','{}'::jsonb)));
 perform missionaccounts.api_financial_card_result(founder,1,attempt,'pi_MR','SUBMITTED',null,'phase1-local-rehearsal');
 perform missionaccounts.api_financial_card_result(own,wp,attempt,'pi_MR','REQUIRES_ACTION',null,'phase1-local-rehearsal');
 perform missionaccounts.api_financial_card_result(founder,1,attempt,'pi_MR','SUBMITTED',null,'phase1-local-rehearsal');
 r:=missionaccounts.api_financial_card_result(provider,0,attempt,'pi_MR','SUCCEEDED',s,'phase1-local-rehearsal');
 select id into strict app_id from missionaccounts.financial_payment_application where payment_id=(r->>'payment_id')::uuid;
 begin insert into missionaccounts.financial_schedule_application values(second_installment,app_id,1);raise exception 'Allocation exceeded canonical application';exception when raise_exception then if SQLERRM='Allocation exceeded canonical application' then raise;end if;end;
 if (select applied_cents from missionaccounts.financial_active_schedule where id=installment)<>1000 then raise exception 'Installment application missing';end if;
 if (missionaccounts.api_financial_own_account(own,wp)->'operational_due'->>'currently_due_cents')::bigint<>0 then raise exception 'Settled installment still currently due';end if;
 if r->>'state'<>'SUCCEEDED' or (select balance_cents from missionaccounts.financial_balance where subject_key='match360:ruqayyah')<>before_balance-1000 then raise exception 'Canonical settlement/application failed';end if;
 if (missionaccounts.api_financial_card_result(founder,1,attempt,'pi_MR','SUCCEEDED',s,'phase1-local-rehearsal')->>'duplicate')<>'true' then raise exception 'Card success duplicate not protected';end if;
 if (select count(*) from missionaccounts.financial_payment where provider_identity='pi_MR')<>1 then raise exception 'Provider receipt duplicated';end if;
 begin perform missionaccounts.api_financial_report_zelle(own,wp,q,'adapter-zelle-paid');raise exception 'Settled card allowed Zelle claim';exception when raise_exception then if SQLERRM='Settled card allowed Zelle claim' then raise;end if;end;
end $$;
rollback;

begin;
update missionaccounts.financial_operating_gate set founder_operations=true,student_onboarding=true,student_publication=true,card_dispatch=true,stripe_account='acct_MR';
do $$ declare founder uuid:='00000000-0000-4000-8000-000000000001'; own uuid:='00000000-0000-4000-8000-000000000077'; wp bigint; o uuid; amount bigint; r jsonb; q uuid; q2 uuid;
begin
 select substring(wp_subject from 4)::bigint into strict wp from missionaccounts.financial_subject where subject_key='match360:ruqayyah';
 insert into missionaccounts.financial_runtime_binding(subject_key,principal_id,wp_user_id,authority_ref,evidence_sha256) values('match360:ruqayyah',own,wp,'DR-fixture',repeat('a',64));
 insert into missionaccounts.financial_card_binding(subject_key,provider_account,customer_ref) values('match360:ruqayyah','acct_MR','cus_MR');
 select id,remaining_cents into strict o,amount from missionaccounts.financial_obligation_state where agreement_id=(select id from missionaccounts.financial_agreement where subject_key='match360:ruqayyah') and remaining_cents>0;
 perform missionaccounts.api_financial_operate(founder,1,'match360:ruqayyah','SAVE_SCHEDULE',jsonb_build_object('confirmed',true,'authority_ref','DR-fixture','evidence_sha256',repeat('b',64),'installments',jsonb_build_array(jsonb_build_object('key','scheduled','obligation_id',o,'amount_cents',amount-1000,'due_on',null))),'unscheduled-plan');
 r:=missionaccounts.api_financial_operate(founder,1,'match360:ruqayyah','REQUEST_PAYMENT',jsonb_build_object('confirmed',true,'authority_ref','DR-fixture','evidence_sha256',repeat('b',64),'obligation_id',o,'amount_cents',1000,'description','Unscheduled portion one','methods',jsonb_build_array('CARD')),'unscheduled-request-one');q:=(r->'result'->>'request_id')::uuid;
 r:=missionaccounts.api_financial_operate(founder,1,'match360:ruqayyah','REQUEST_PAYMENT',jsonb_build_object('confirmed',true,'authority_ref','DR-fixture','evidence_sha256',repeat('b',64),'obligation_id',o,'amount_cents',1000,'description','Unscheduled portion two','methods',jsonb_build_array('CARD')),'unscheduled-request-two');q2:=(r->'result'->>'request_id')::uuid;
 perform missionaccounts.api_financial_prepare_card(own,wp,q,'unscheduled-attempt-one','acct_MR',null,true);
 begin perform missionaccounts.api_financial_prepare_card(own,wp,q2,'unscheduled-attempt-two','acct_MR',null,true);raise exception 'Unscheduled reservations consumed scheduled principal';exception when raise_exception then if SQLERRM='Unscheduled reservations consumed scheduled principal' then raise;end if;end;
end $$;
rollback;

begin;
update missionaccounts.financial_operating_gate set founder_operations=true,zelle_matcher=true;
do $$ declare p uuid:='00000000-0000-4000-8000-000000000001'; o uuid; r jsonb; proof jsonb; payer text; q uuid; n bigint;
begin
 select id into strict o from missionaccounts.financial_obligation_state where agreement_id=(select id from missionaccounts.financial_agreement where subject_key='match360:ruqayyah') and remaining_cents>0;
 select a.payer into strict payer from missionaccounts.financial_payer_alias a where a.subject_key='match360:ruqayyah' limit 1;
 select count(*) into n from missionaccounts.financial_payment;
 proof:=jsonb_build_object('reference','999999990005','fingerprint',repeat('f',64),'provider_account','ChaseFixture','amount_cents',1000,'payer',payer,'received_at','2026-10-05T00:00:00Z','authenticity_verified',true,'global_claim_verified',true,'commerce_consumed',false);
 begin perform missionaccounts.api_financial_reconcile_chase(p,1,'phase1-local-rehearsal',proof||jsonb_build_object('authenticity_verified',false));raise exception 'Unverified Chase proof accepted';exception when raise_exception then if SQLERRM='Unverified Chase proof accepted' then raise;end if;end;
 if missionaccounts.api_financial_reconcile_chase(p,1,'phase1-local-rehearsal',proof)->>'state'<>'REVIEW_REQUIRED' then raise exception 'Zero match guessed';end if;
 if (select count(*) from missionaccounts.financial_payment)<>n then raise exception 'Unmatched evidence settled';end if;
 r:=missionaccounts.api_financial_operate(p,1,'match360:ruqayyah','REQUEST_PAYMENT',jsonb_build_object('confirmed',true,'authority_ref','DR-fixture','evidence_sha256',repeat('a',64),'obligation_id',o,'amount_cents',1000,'description','Verified Chase fixture','methods',jsonb_build_array('ZELLE')),'zelle-fixture-request');
 q:=(r->'result'->>'request_id')::uuid;
 r:=missionaccounts.api_financial_reconcile_chase(p,1,'phase1-local-rehearsal',proof);
 if r->>'state'<>'SETTLED' or (select count(*) from missionaccounts.financial_payment)<>n+1 then raise exception 'Unique authenticated Chase settlement failed';end if;
 if (missionaccounts.api_financial_reconcile_chase(p,1,'phase1-local-rehearsal',proof)->>'duplicate')<>'true' then raise exception 'Chase replay duplicated';end if;
 begin perform missionaccounts.api_financial_reconcile_chase(p,1,'phase1-local-rehearsal',proof||jsonb_build_object('amount_cents',1001));raise exception 'Changed Chase proof replay accepted';exception when raise_exception then if SQLERRM='Changed Chase proof replay accepted' then raise;end if;end;
 r:=missionaccounts.api_financial_operate(p,1,'match360:ruqayyah','REQUEST_PAYMENT',jsonb_build_object('confirmed',true,'authority_ref','DR-fixture','evidence_sha256',repeat('b',64),'obligation_id',o,'amount_cents',1000,'description','Duplicate amount candidate one','methods',jsonb_build_array('ZELLE')),'zelle-fixture-two');
 r:=missionaccounts.api_financial_operate(p,1,'match360:ruqayyah','REQUEST_PAYMENT',jsonb_build_object('confirmed',true,'authority_ref','DR-fixture','evidence_sha256',repeat('b',64),'obligation_id',o,'amount_cents',1000,'description','Duplicate amount candidate two','methods',jsonb_build_array('ZELLE')),'zelle-fixture-three');
 proof:=proof||jsonb_build_object('reference','999999990006','fingerprint',repeat('0',64));
 r:=missionaccounts.api_financial_reconcile_chase(p,1,'phase1-local-rehearsal',proof);
 if r->>'state'<>'REVIEW_REQUIRED' or (r->>'candidate_count')::integer<>2 then raise exception 'Multiple matches guessed';end if;
end $$;
rollback;
