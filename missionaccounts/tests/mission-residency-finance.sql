\set ON_ERROR_STOP on
create function pg_temp.expect_failure(command text) returns void language plpgsql as $$
begin
 begin execute command; exception when others then return; end;
 raise exception 'negative test unexpectedly succeeded: %',command;
end $$;
create function pg_temp.assert(ok boolean,label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'assertion failed: %',label; end if; end $$;
select pg_temp.assert((select count(*)=11 from missionaccounts.financial_subject where certification_state='CERTIFIED'),'11 certified');
select pg_temp.assert((select count(*)=6 from missionaccounts.financial_reconciliation_case),'6 held cases');
select pg_temp.assert((select count(*)=9 from missionaccounts.financial_balance where balance_cents=0),'9 paid in full');
select pg_temp.assert((select count(*)=2 from missionaccounts.financial_balance where balance_cents>0 and currently_due_cents is null and overdue_cents is null),'2 balances; due/overdue unknown');
select pg_temp.assert((select sum(credit_cents)=200 from missionaccounts.financial_unapplied_credit),'unapplied credits');
select pg_temp.assert(not exists(select 1 from missionaccounts.financial_subject where student_visible or collections_enabled),'publication/collection hard OFF');
select pg_temp.assert(not exists(select 1 from missionaccounts.financial_subject s join missionaccounts.financial_agreement a using(subject_key) where s.certification_state='HELD'),'no held debt');
select pg_temp.assert(not exists(select 1 from missionaccounts.financial_payer_alias where auto_settle),'aliases not automatic settlement');
select pg_temp.assert(exists(select 1 from missionaccounts.financial_payer_alias where relationship='EXPLICIT_FAMILY'),'explicit family retained');
select pg_temp.assert(exists(select 1 from missionaccounts.financial_payer_alias where relationship='VERIFIED_BENEFICIARY_RELATIONSHIP_UNKNOWN'),'unknown kinship retained');
select pg_temp.assert((select count(*)=1 from missionaccounts.financial_payment where provider='Stripe'),'one successful Stripe receipt only');
select pg_temp.assert((select count(*)=20 from missionaccounts.financial_payment where provider='Chase'),'20 certified Chase receipts');
select pg_temp.assert((select count(*)=21 from missionaccounts.financial_payment_evidence where evidence_type in ('CHASE_REFERENCE','STRIPE_PAYMENT_INTENT')),'provider evidence');
select pg_temp.assert(not has_table_privilege('anon','missionaccounts.financial_payment','select'),'anonymous denied');
select pg_temp.assert(not has_table_privilege('authenticated','missionaccounts.financial_payment','select'),'student/cross student denied');
select pg_temp.assert(not has_table_privilege('service_role','missionaccounts.financial_payment','insert'),'server cannot bypass settlement');
select pg_temp.assert(not has_function_privilege('authenticated','missionaccounts.api_read_financial_accounts(text)','execute'),'student RPC denied');
select pg_temp.assert(not has_function_privilege('anon','missionaccounts.api_stage_certified_financial_bundle(text,jsonb)','execute'),'anonymous import denied');
select pg_temp.assert((select bool_and(c.relrowsecurity and c.relforcerowsecurity) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='missionaccounts' and c.relname like 'financial_%' and c.relkind='r'),'forced RLS');
select pg_temp.expect_failure($q$select missionaccounts.api_read_financial_accounts('wp:generic-admin')$q$);
select pg_temp.expect_failure($q$update missionaccounts.financial_agreement set accepted_tuition_cents=1$q$);
select pg_temp.expect_failure($q$update missionaccounts.financial_subject set student_visible=true$q$);
select pg_temp.expect_failure($q$delete from missionaccounts.financial_payment$q$);
select pg_temp.expect_failure($q$insert into missionaccounts.financial_agreement(subject_key,version,currency,program,accepted_tuition_cents,accepted_fees_cents,effective_precision,plan,discount_provenance,agreement_evidence,certification_status,certified_at,artifact_id)
 select s.subject_key,'bad','USD','bad',1,0,'UNKNOWN','{}','{}','{}','CERTIFIED_BALANCE_DUE',now(),s.artifact_id from missionaccounts.financial_subject s where certification_state='HELD' limit 1$q$);
select pg_temp.expect_failure($q$insert into missionaccounts.financial_payment_application(payment_id,obligation_id,amount_cents)
 select p.id,o.id,p.gross_cents+1 from missionaccounts.financial_payment p join missionaccounts.financial_agreement a using(subject_key) join missionaccounts.financial_obligation o on o.agreement_id=a.id limit 1$q$);
select pg_temp.expect_failure($q$insert into missionaccounts.financial_payment_application(payment_id,obligation_id,amount_cents)
 select p.id,o.id,1 from missionaccounts.financial_payment p cross join missionaccounts.financial_obligation o join missionaccounts.financial_agreement a on a.id=o.agreement_id where p.subject_key<>a.subject_key limit 1$q$);
select pg_temp.expect_failure($q$insert into missionaccounts.financial_payment_evidence select fingerprint,payment_id,evidence_type,provider,provider_reference,artifact_id,metadata,verified from missionaccounts.financial_payment_evidence limit 1$q$);
select pg_temp.expect_failure($q$insert into missionaccounts.financial_adjustment(payment_id,kind,amount_cents,authority_ref,evidence_fingerprint) select id,'REFUND',gross_cents+1,'fixture',repeat('a',64) from missionaccounts.financial_payment limit 1$q$);
select pg_temp.assert((select count(*)=0 from missionaccounts.charge),'no charges');
select pg_temp.assert((select count(*)=0 from missionaccounts.invoice),'no invoices');
select pg_temp.assert((select count(*)=0 from missionaccounts.notification_outbox),'no messages');
select pg_temp.assert((select count(*)=0 from missionaccounts.auto_charge_dispatch),'no dispatch');

select pg_temp.expect_failure($q$update missionaccounts.source_artifact set sha256=repeat('f',64) where source_kind='match360_phase0c'$q$);
