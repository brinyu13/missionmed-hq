import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const QA_FINANCE_MIGRATIONS = Object.freeze([
 '20261005024948_mission_residency_financial_backend.sql',
 '20261005135949_mission_residency_finance_admin_read.sql',
 '20261005153041_mission_residency_financial_operations.sql',
 '20261005154928_mission_residency_financial_payment_adapters.sql',
 '20261005170049_mission_residency_financial_provider_events.sql',
 '20261005183000_mission_residency_financial_receipts_refunds.sql',
 '20261005185000_mission_residency_financial_chase_bridge.sql',
]);
const preamble = `-- DR-389 source candidate: isolated synthetic finance only. No shared user/account tables.
-- Generated with qa-migration.mjs; exact source hashes below. Do not hand-edit generated composition.
begin;
create schema missionaccounts_finance_qa;
revoke all on schema missionaccounts_finance_qa from public,anon,authenticated;
grant usage on schema missionaccounts_finance_qa to service_role;
create table missionaccounts_finance_qa.student(id uuid primary key);
create table missionaccounts_finance_qa.source_artifact (
 id uuid primary key default gen_random_uuid(), source_kind text not null, source_path text not null,
 sha256 text not null check(sha256 ~ '^[0-9a-f]{64}$'), byte_count bigint not null check(byte_count>=0),
 observed_at timestamptz not null, imported_at timestamptz not null default now(), unique(source_kind,sha256));
create table missionaccounts_finance_qa.import_run (
 id uuid primary key default gen_random_uuid(), artifact_id uuid not null references missionaccounts_finance_qa.source_artifact,
 request_id text not null unique, state text not null check(state in ('pending','validated','applied','failed')),
 source_controls jsonb not null default '{}', result_controls jsonb not null default '{}',
 started_at timestamptz not null default now(), finished_at timestamptz, error text);
create table missionaccounts_finance_qa.audit_event (
 id uuid primary key default gen_random_uuid(), actor_id text, actor_role text not null,
 subject_student_id uuid references missionaccounts_finance_qa.student, kind text not null, text text not null,
 from_val jsonb,to_val jsonb,reason text,request_id text not null,created_at timestamptz not null default now(),unique(request_id,kind));
create function missionaccounts_finance_qa.reject_immutable_change() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'immutable synthetic QA financial history'; end $$;
`;
const suffix = `
-- Only explicit synthetic subjects can inhabit this isolated schema.
alter table missionaccounts_finance_qa.financial_subject add constraint qa_synthetic_subject
 check(subject_key='match360:phase3_qa_brinyu2');
create table missionaccounts_finance_qa.qa_identity (
 kind text primary key check(kind in ('founder','qa_subject')), principal_id uuid not null unique,
 wp_user_id bigint not null unique, username text not null unique,
 subject_key text not null default 'match360:phase3_qa_brinyu2' references missionaccounts_finance_qa.financial_subject,
 evidence_sha256 text not null check(evidence_sha256 ~ '^[0-9a-f]{64}$'),
 check((kind='founder' and wp_user_id=1 and username='brinyu') or
       (kind='qa_subject' and wp_user_id>1 and username='brinyu2')));
create trigger qa_identity_immutable before update or delete on missionaccounts_finance_qa.qa_identity
 for each row execute function missionaccounts_finance_qa.reject_immutable_change();
create function missionaccounts_finance_qa.api_financial_qa_identity(p_principal uuid,p_wp_user_id bigint)
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('kind',kind,'username',username,'subject_key',subject_key)
 from missionaccounts_finance_qa.qa_identity where principal_id=p_principal and wp_user_id=p_wp_user_id;
$$;
-- Privileged bootstrap is called only after independent real identity/account custody checks.
-- It has no browser endpoint. It never copies any canonical student/account data.
create function missionaccounts_finance_qa.api_financial_qa_bootstrap(p_founder uuid,p_qa uuid,p_qa_wp bigint,p_account text,p_evidence text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare artifact uuid; agreement uuid; ev uuid; existing jsonb;
begin
 perform pg_advisory_xact_lock(389,20261005);
 if p_founder is null or p_qa is null or p_founder=p_qa or p_qa_wp is null or p_qa_wp<=1 or
    p_account is null or p_account !~ '^acct_[A-Za-z0-9]+$' or p_evidence is null or p_evidence !~ '^[0-9a-f]{64}$'
 then raise exception 'Exact verified Founder/QA/provider custody required';end if;
 if exists(select 1 from missionaccounts_finance_qa.qa_identity) then
  if not exists(select 1 from missionaccounts_finance_qa.qa_identity where kind='founder' and principal_id=p_founder and evidence_sha256=p_evidence) or
     not exists(select 1 from missionaccounts_finance_qa.qa_identity where kind='qa_subject' and principal_id=p_qa and wp_user_id=p_qa_wp and evidence_sha256=p_evidence) or
     not exists(select 1 from missionaccounts_finance_qa.financial_operating_gate where id=1 and stripe_account=p_account)
  then raise exception 'QA custody replay conflict';end if;
  return jsonb_build_object('duplicate',true,'subject_key','match360:phase3_qa_brinyu2');
 end if;
 insert into missionaccounts_finance_qa.source_artifact(source_kind,source_path,sha256,byte_count,observed_at)
 values('synthetic_qa','DR-389:TECHNICAL-QA-ONLY',p_evidence,0,clock_timestamp()) returning id into artifact;
 insert into missionaccounts_finance_qa.student values(p_qa);
 insert into missionaccounts_finance_qa.financial_subject(subject_key,program_key,wp_subject,student_id,binding_state,certification_state,artifact_id)
 values('match360:phase3_qa_brinyu2','mission_residency','wp:'||p_qa_wp,p_qa,'VERIFIED','CERTIFIED',artifact);
 insert into missionaccounts_finance_qa.qa_identity(kind,principal_id,wp_user_id,username,evidence_sha256) values
 ('founder',p_founder,1,'brinyu',p_evidence),('qa_subject',p_qa,p_qa_wp,'brinyu2',p_evidence);
 insert into missionaccounts_finance_qa.financial_principal(actor_id,authority_ref,capabilities) values
 ('mr-finance-qa-founder','DR-389:QA-ONLY',array['read']),('mr-finance-qa-settlement','DR-389:QA-TEST-ONLY',array['settle']);
 insert into missionaccounts_finance_qa.financial_read_binding(principal_id,wp_user_id,actor_id,authority_ref)
 values(p_founder,1,'mr-finance-qa-founder','DR-389:VERIFIED-FOUNDER');
 insert into missionaccounts_finance_qa.financial_provider_binding(actor_id,actor_name,authority_ref,evidence_sha256)
 values('00000000-0389-4000-8000-000000000001','mr-finance-qa-settlement','DR-389:TEST-ONLY',p_evidence);
 insert into missionaccounts_finance_qa.financial_runtime_binding(subject_key,principal_id,wp_user_id,authority_ref,evidence_sha256)
 values('match360:phase3_qa_brinyu2',p_qa,p_qa_wp,'DR-389:VERIFIED-QA',p_evidence);
 insert into missionaccounts_finance_qa.financial_display_directory values('match360:phase3_qa_brinyu2','Synthetic QA - brinyu2','Mission Residency Technical QA',p_evidence,'DR-389:QA-ONLY');
 insert into missionaccounts_finance_qa.financial_agreement(subject_key,version,currency,program,accepted_tuition_cents,accepted_fees_cents,effective_precision,plan,discount_provenance,agreement_evidence,certification_status,certified_at,artifact_id)
 values('match360:phase3_qa_brinyu2','DR-389:QA-v1','USD','Synthetic technical QA',100,0,'UNKNOWN','{"synthetic":true,"test_only":true}','{}','{"technical_qa_only":true}','CERTIFIED_ACTIVE_PLAN',clock_timestamp(),artifact) returning id into agreement;
 insert into missionaccounts_finance_qa.financial_obligation(agreement_id,obligation_key,component,original_cents,due_precision)
 values(agreement,'qa-test-payment','TUITION_PRINCIPAL',100,'UNKNOWN');
 update missionaccounts_finance_qa.financial_operating_gate set founder_operations=true,student_onboarding=true,
 student_publication=true,card_dispatch=true,zelle_matcher=false,stripe_account=p_account,
 charge_terms_version='DR-389:TEST-ONLY-EXACT-REQUEST-v1',authority_ref='DR-389:SYNTHETIC-TEST-ONLY' where id=1;
 ev:=missionaccounts_finance_qa.financial_append_operation(p_founder,1,'match360:phase3_qa_brinyu2','SET_ONBOARDING_ELIGIBILITY','{}',
 '{"required":true,"card_required":true,"synthetic":true}', 'qa-bootstrap:eligibility:v1','DR-389:TECHNICAL-QA',p_evidence);
 insert into missionaccounts_finance_qa.financial_onboarding_eligibility values(ev,'match360:phase3_qa_brinyu2',true,true,'Founder-controlled technical QA only');
 return jsonb_build_object('duplicate',false,'subject_key','match360:phase3_qa_brinyu2','synthetic',true,'test_only',true);
end $$;
-- No anon/authenticated schema, table or RPC access. Service can execute API functions only.
-- SECURITY DEFINER functions retain the same private-principal checks as the finance domain.
do $$ declare t record; f record; begin
 for t in select tablename from pg_tables where schemaname='missionaccounts_finance_qa' loop
  execute format('alter table missionaccounts_finance_qa.%I enable row level security',t.tablename);
  execute format('alter table missionaccounts_finance_qa.%I force row level security',t.tablename);
 end loop;
 for f in select p.oid::regprocedure sig,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='missionaccounts_finance_qa' loop
  execute format('revoke all on function %s from public,anon,authenticated,service_role',f.sig);
  if f.proname like 'api_%' and f.proname<>'api_stage_certified_financial_bundle' then execute format('grant execute on function %s to service_role',f.sig);end if;
 end loop;
end $$;
revoke all on all tables in schema missionaccounts_finance_qa from public,anon,authenticated,service_role;
revoke all on all sequences in schema missionaccounts_finance_qa from public,anon,authenticated,service_role;
commit;
`;
export function composeFinancialQaMigration(directory = fileURLToPath(new URL('../../supabase/migrations/', import.meta.url))) {
 const sections = QA_FINANCE_MIGRATIONS.map(name => {
  const text = readFileSync(`${directory}/${name}`, 'utf8');
  const hash = createHash('sha256').update(text).digest('hex');
  const namespaced = text.replace(/\bmissionaccounts\b/g, 'missionaccounts_finance_qa')
    .replace(/^begin;\s*$/gmi, '').replace(/^commit;\s*$/gmi, '');
  return `\n-- Finance source ${name} SHA256 ${hash}\n${namespaced}`;
 });
 const result = preamble + sections.join('\n') + suffix;
 if (/\bmissionaccounts\./.test(result) || /\bmissionaccounts_finance_qa\.users\b/.test(result)) throw new Error('QA composition cannot reference shared accounts');
 return result;
}
