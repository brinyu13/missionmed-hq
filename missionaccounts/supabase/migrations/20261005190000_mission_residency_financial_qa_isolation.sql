-- DR-389 source candidate: isolated synthetic finance only. No shared user/account tables.
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

-- Finance source 20261005024948_mission_residency_financial_backend.sql SHA256 e9da944ba250ae63661cc3eca067e401da45c708b56df1cc172770b2718298d6
-- Migration: 20261005024948_mission_residency_financial_backend.sql
-- Date: 2026-10-05 UTC
-- Authority: DR-379 / MR-FINANCIAL-ACCOUNTS-PHASE1
-- Target: isolated missionaccounts_finance_qa-production / dwwsahpzblgrgducxtzw
-- Depends on: missionaccounts_initial_schema (source_artifact, import_run, audit_event, student)
-- Description: Private canonical agreements/receipts/applications and atomic sealed staging.
-- Idempotent: NO (schema); staging and settlement RPCs are exact-payload idempotent.
-- Rollback: all migration/import statements transactional; retain immutable history after commit.
-- Feature gates: student publication FALSE; collections FALSE; no provider dispatch.
-- Source-only until independent exact migration, recovery, target and lease gates PASS.
-- DR-379: private Mission Residency accounting only. No provider dispatch or UI.

create table missionaccounts_finance_qa.financial_principal (
 actor_id text primary key, authority_ref text not null,
 stage_bundle_digest text check(stage_bundle_digest ~ '^[0-9a-f]{64}$'),
 capabilities text[] not null check (capabilities <@ array['read','stage','settle']::text[]),
 created_at timestamptz not null default now()
);
create table missionaccounts_finance_qa.financial_subject (
 subject_key text primary key, program_key text not null check(program_key='mission_residency'),
 wp_subject text unique check(wp_subject ~ '^wp:[0-9]+$'),
 student_id uuid unique references missionaccounts_finance_qa.student(id),
 binding_state text not null check(binding_state in ('UNRESOLVED','VERIFIED')),
 certification_state text not null check(certification_state in ('CERTIFIED','HELD')),
 artifact_id uuid not null references missionaccounts_finance_qa.source_artifact(id),
 student_visible boolean not null default false check(not student_visible),
 collections_enabled boolean not null default false check(not collections_enabled),
 check ((binding_state='VERIFIED')=(student_id is not null)),
 check (certification_state='HELD' or wp_subject is not null),
 created_at timestamptz not null default now()
);
-- Financial enrollment is agreement membership, not the existing TTL course-access projection.
create table missionaccounts_finance_qa.financial_agreement (
 id uuid primary key default gen_random_uuid(), subject_key text not null references missionaccounts_finance_qa.financial_subject,
 version text not null, currency text not null check(currency='USD'), program text not null, tier text,
 accepted_tuition_cents bigint not null check(accepted_tuition_cents>=0),
 accepted_fees_cents bigint not null check(accepted_fees_cents>=0), deposit_cents bigint check(deposit_cents>=0),
 effective_on date, effective_precision text not null check(effective_precision in ('EXACT','UNKNOWN')),
 plan jsonb not null, discount_provenance jsonb not null, agreement_evidence jsonb not null,
 certification_status text not null check(certification_status in ('CERTIFIED_PAID_IN_FULL','CERTIFIED_BALANCE_DUE','CERTIFIED_ACTIVE_PLAN')),
 certified_at timestamptz not null, artifact_id uuid not null references missionaccounts_finance_qa.source_artifact,
 unique(subject_key,version), check((effective_precision='EXACT')=(effective_on is not null))
);
create table missionaccounts_finance_qa.financial_obligation (
 id uuid primary key default gen_random_uuid(), agreement_id uuid not null references missionaccounts_finance_qa.financial_agreement,
 obligation_key text not null,
 component text not null check(component in ('DEPOSIT','TUITION_PRINCIPAL','INSTALLMENT','ADMIN_PROCESSING_FEE','OTHER_AUTHORIZED_FEE')),
 original_cents bigint not null check(original_cents>0), due_on date,
 due_precision text not null default 'UNKNOWN' check(due_precision in ('EXACT','UNKNOWN')),
 unique(agreement_id,obligation_key), check((due_precision='EXACT')=(due_on is not null))
);
create table missionaccounts_finance_qa.financial_payment (
 id uuid primary key default gen_random_uuid(), subject_key text not null references missionaccounts_finance_qa.financial_subject,
 provider text not null check(provider in ('Chase','Stripe','Bank')),
 provider_account text not null, provider_identity text not null,
 method text not null check(method in ('ZELLE','CARD','WIRE')), currency text not null check(currency='USD'),
 gross_cents bigint not null check(gross_cents>0), payer text not null,
 received_at timestamptz not null, received_precision text not null,
 verified_at timestamptz not null default now(), verification_state text not null check(verification_state='VERIFIED'),
 request_id text not null unique, request_digest text not null,
 artifact_id uuid not null references missionaccounts_finance_qa.source_artifact,
 unique(provider,provider_account,provider_identity)
);
create table missionaccounts_finance_qa.financial_payment_evidence (
 fingerprint text primary key check(fingerprint ~ '^[0-9a-f]{64}$'),
 payment_id uuid not null references missionaccounts_finance_qa.financial_payment,
 evidence_type text not null, provider text not null, provider_reference text not null,
 artifact_id uuid not null references missionaccounts_finance_qa.source_artifact,
 metadata jsonb not null, verified boolean not null check(verified),
 unique(provider,provider_reference,evidence_type)
);
create table missionaccounts_finance_qa.financial_payment_application (
 id uuid primary key default gen_random_uuid(), payment_id uuid not null references missionaccounts_finance_qa.financial_payment,
 obligation_id uuid not null references missionaccounts_finance_qa.financial_obligation,
 amount_cents bigint not null check(amount_cents>0), unique(payment_id,obligation_id),
 created_at timestamptz not null default now()
);
create table missionaccounts_finance_qa.financial_adjustment (
 id uuid primary key default gen_random_uuid(), obligation_id uuid references missionaccounts_finance_qa.financial_obligation,
 payment_id uuid references missionaccounts_finance_qa.financial_payment,
 kind text not null check(kind in ('WAIVER','CREDIT','REFUND')),
 amount_cents bigint not null check(amount_cents>0), authority_ref text not null,
 evidence_fingerprint text not null check(evidence_fingerprint ~ '^[0-9a-f]{64}$'),
 created_at timestamptz not null default now(),
 check((kind='REFUND' and payment_id is not null and obligation_id is null)
    or (kind<>'REFUND' and obligation_id is not null and payment_id is null))
);
create table missionaccounts_finance_qa.financial_payer_alias (
 id uuid primary key default gen_random_uuid(), subject_key text not null references missionaccounts_finance_qa.financial_subject,
 payer text not null, relationship text not null check(relationship in ('EXPLICIT_FAMILY','VERIFIED_BENEFICIARY_RELATIONSHIP_UNKNOWN')),
 provenance jsonb not null, auto_settle boolean not null default false check(not auto_settle),
 artifact_id uuid not null references missionaccounts_finance_qa.source_artifact, unique(subject_key,payer)
);
create table missionaccounts_finance_qa.financial_reconciliation_case (
 id uuid primary key default gen_random_uuid(), subject_key text not null references missionaccounts_finance_qa.financial_subject,
 hold_class text not null, reason text not null, artifact_id uuid not null references missionaccounts_finance_qa.source_artifact,
 unique(subject_key,artifact_id)
);
create index financial_agreement_subject_idx on missionaccounts_finance_qa.financial_agreement(subject_key);
create unique index financial_chase_global_reference_idx on missionaccounts_finance_qa.financial_payment(provider_identity) where provider='Chase';
create index financial_payment_subject_idx on missionaccounts_finance_qa.financial_payment(subject_key);
create index financial_application_obligation_idx on missionaccounts_finance_qa.financial_payment_application(obligation_id);
create index financial_evidence_payment_idx on missionaccounts_finance_qa.financial_payment_evidence(payment_id);
create index financial_adjustment_obligation_idx on missionaccounts_finance_qa.financial_adjustment(obligation_id);
create index financial_adjustment_payment_idx on missionaccounts_finance_qa.financial_adjustment(payment_id);

create function missionaccounts_finance_qa.financial_require_principal(p_actor text,p_capability text)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from missionaccounts_finance_qa.financial_principal where actor_id=p_actor and p_capability=any(capabilities)) then
  raise exception 'financial principal capability denied' using errcode='42501';
 end if;
end $$;

create function missionaccounts_finance_qa.financial_guard_owner()
returns trigger language plpgsql security definer set search_path='' as $$
declare k text; state text; g missionaccounts_finance_qa.financial_agreement; total bigint; cap bigint;
begin
 if TG_TABLE_NAME='financial_agreement' then k:=new.subject_key;
 elsif TG_TABLE_NAME='financial_obligation' then
  select * into strict g from missionaccounts_finance_qa.financial_agreement where id=new.agreement_id for update; k:=g.subject_key;
  if new.component in ('DEPOSIT','TUITION_PRINCIPAL','INSTALLMENT') then
   cap:=g.accepted_tuition_cents;
   select coalesce(sum(original_cents),0) into total from missionaccounts_finance_qa.financial_obligation where agreement_id=g.id and component in ('DEPOSIT','TUITION_PRINCIPAL','INSTALLMENT');
  else
   cap:=g.accepted_fees_cents;
   select coalesce(sum(original_cents),0) into total from missionaccounts_finance_qa.financial_obligation where agreement_id=g.id and component in ('ADMIN_PROCESSING_FEE','OTHER_AUTHORIZED_FEE');
  end if;
  if new.original_cents+total>cap then raise exception 'obligations exceed certified agreement component'; end if;
 elsif TG_TABLE_NAME='financial_payment' then k:=new.subject_key;
 end if;
 select certification_state into state from missionaccounts_finance_qa.financial_subject where subject_key=k;
 if state is distinct from 'CERTIFIED' then raise exception 'held financial subject has no financial responsibility'; end if;
 return new;
end $$;
create trigger financial_agreement_certified before insert on missionaccounts_finance_qa.financial_agreement for each row execute function missionaccounts_finance_qa.financial_guard_owner();
create trigger financial_obligation_certified before insert on missionaccounts_finance_qa.financial_obligation for each row execute function missionaccounts_finance_qa.financial_guard_owner();
create trigger financial_payment_certified before insert on missionaccounts_finance_qa.financial_payment for each row execute function missionaccounts_finance_qa.financial_guard_owner();

create function missionaccounts_finance_qa.financial_guard_application()
returns trigger language plpgsql security definer set search_path='' as $$
declare p missionaccounts_finance_qa.financial_payment; o missionaccounts_finance_qa.financial_obligation; owner_key text; applied bigint; adjusted bigint;
begin
 select * into strict p from missionaccounts_finance_qa.financial_payment where id=new.payment_id for update;
 select * into strict o from missionaccounts_finance_qa.financial_obligation where id=new.obligation_id for update;
 select subject_key into strict owner_key from missionaccounts_finance_qa.financial_agreement where id=o.agreement_id;
 if p.subject_key<>owner_key then raise exception 'cross-subject application denied'; end if;
 select coalesce(sum(amount_cents),0) into applied from missionaccounts_finance_qa.financial_payment_application where payment_id=p.id;
 select coalesce(sum(amount_cents),0) into adjusted from missionaccounts_finance_qa.financial_adjustment where payment_id=p.id and kind='REFUND';
 if applied+new.amount_cents>p.gross_cents-adjusted then raise exception 'payment overapplication denied'; end if;
 select coalesce(sum(amount_cents),0) into applied from missionaccounts_finance_qa.financial_payment_application where obligation_id=o.id;
 select coalesce(sum(amount_cents),0) into adjusted from missionaccounts_finance_qa.financial_adjustment where obligation_id=o.id;
 if applied+adjusted+new.amount_cents>o.original_cents then raise exception 'obligation overapplication denied'; end if;
 return new;
end $$;
create trigger financial_application_cap before insert on missionaccounts_finance_qa.financial_payment_application for each row execute function missionaccounts_finance_qa.financial_guard_application();

create function missionaccounts_finance_qa.financial_guard_adjustment()
returns trigger language plpgsql security definer set search_path='' as $$
declare available bigint; consumed bigint;
begin
 if new.kind='REFUND' then
  select gross_cents into strict available from missionaccounts_finance_qa.financial_payment where id=new.payment_id for update;
  select coalesce(sum(amount_cents),0) into consumed from missionaccounts_finance_qa.financial_payment_application where payment_id=new.payment_id;
  consumed:=consumed+(select coalesce(sum(amount_cents),0) from missionaccounts_finance_qa.financial_adjustment where payment_id=new.payment_id);
 else
  select original_cents into strict available from missionaccounts_finance_qa.financial_obligation where id=new.obligation_id for update;
  select coalesce(sum(amount_cents),0) into consumed from missionaccounts_finance_qa.financial_payment_application where obligation_id=new.obligation_id;
  consumed:=consumed+(select coalesce(sum(amount_cents),0) from missionaccounts_finance_qa.financial_adjustment where obligation_id=new.obligation_id);
 end if;
 if new.amount_cents+consumed>available then raise exception 'adjustment exceeds unapplied available amount'; end if;
 return new;
end $$;
create trigger financial_adjustment_cap before insert on missionaccounts_finance_qa.financial_adjustment for each row execute function missionaccounts_finance_qa.financial_guard_adjustment();

create view missionaccounts_finance_qa.financial_obligation_state with(security_invoker=true) as
 select o.*, greatest(o.original_cents-coalesce(a.applied,0)-coalesce(c.adjusted,0),0)::bigint remaining_cents,
 case when o.original_cents=coalesce(a.applied,0)+coalesce(c.adjusted,0) then 'SETTLED'
      when o.due_precision='UNKNOWN' then 'BALANCE_DUE_DATE_UNKNOWN'
      when o.due_on<current_date then 'OVERDUE' else 'OPEN' end status
 from missionaccounts_finance_qa.financial_obligation o
 left join (select obligation_id,sum(amount_cents) applied from missionaccounts_finance_qa.financial_payment_application group by obligation_id) a on a.obligation_id=o.id
 left join (select obligation_id,sum(amount_cents) adjusted from missionaccounts_finance_qa.financial_adjustment where obligation_id is not null group by obligation_id) c on c.obligation_id=o.id;
create view missionaccounts_finance_qa.financial_balance with(security_invoker=true) as
 select g.subject_key,g.id agreement_id,g.accepted_tuition_cents,g.accepted_fees_cents,
 coalesce(sum(o.remaining_cents),0)::bigint balance_cents,
 case when bool_or(o.remaining_cents>0 and o.due_precision='UNKNOWN') then null
      else coalesce(sum(o.remaining_cents) filter(where o.due_on<=current_date),0)::bigint end currently_due_cents,
 case when bool_or(o.remaining_cents>0 and o.due_precision='UNKNOWN') then null
      else coalesce(sum(o.remaining_cents) filter(where o.due_on<current_date),0)::bigint end overdue_cents,
 false student_visible,false payable
 from missionaccounts_finance_qa.financial_agreement g left join missionaccounts_finance_qa.financial_obligation_state o on o.agreement_id=g.id
 group by g.id;
create view missionaccounts_finance_qa.financial_unapplied_credit with(security_invoker=true) as
 select p.id payment_id,p.subject_key,(p.gross_cents-coalesce(a.applied,0)-coalesce(r.refunded,0))::bigint credit_cents
 from missionaccounts_finance_qa.financial_payment p
 left join(select payment_id,sum(amount_cents) applied from missionaccounts_finance_qa.financial_payment_application group by payment_id) a on a.payment_id=p.id
 left join(select payment_id,sum(amount_cents) refunded from missionaccounts_finance_qa.financial_adjustment where kind='REFUND' group by payment_id) r on r.payment_id=p.id;

-- One transaction used by both provider adapters. Exact retries succeed; changed/cross-subject retries fail.
create function missionaccounts_finance_qa.api_record_verified_financial_payment(p_actor text,p_payment jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare existing missionaccounts_finance_qa.financial_payment; pid uuid; x jsonb; oid uuid; applied bigint:=0; digest text;
begin
 perform missionaccounts_finance_qa.financial_require_principal(p_actor,'settle');
 digest:=encode(extensions.digest(p_payment::text,'sha256'),'hex');
 perform pg_advisory_xact_lock(hashtextextended('financial-payment:'||(p_payment->>'provider')||':'||(p_payment->>'provider_identity'),0));
 select * into existing from missionaccounts_finance_qa.financial_payment where request_id=p_payment->>'request_id'
  or (provider=p_payment->>'provider' and provider_account=p_payment->>'provider_account' and provider_identity=p_payment->>'provider_identity');
 if found then
  if existing.request_digest<>digest then raise exception 'payment replay payload or owner conflict'; end if;
  return jsonb_build_object('payment_id',existing.id,'duplicate',true);
 end if;
 if jsonb_typeof(p_payment->'evidence') is distinct from 'array' or jsonb_typeof(p_payment->'applications') is distinct from 'array' or jsonb_array_length(p_payment->'evidence')<1 then raise exception 'verified payment evidence required'; end if;
 if p_payment->>'provider'='Chase' then
  if (p_payment->>'provider_identity') !~ '^[0-9]+$' or p_payment->>'method'<>'ZELLE'
    or jsonb_array_length(p_payment->'evidence')<>1
    or p_payment->'evidence'->0->>'type'<>'CHASE_REFERENCE'
    or p_payment->'evidence'->0->>'reference'<>p_payment->>'provider_identity' then raise exception 'canonical Chase evidence namespace required'; end if;
 elsif p_payment->>'provider'='Stripe' then
  if (p_payment->>'provider_identity') !~ '^pi_[A-Za-z0-9]+$' or p_payment->>'method'<>'CARD'
   or jsonb_array_length(p_payment->'evidence')<>2
   or (select count(*) from jsonb_array_elements(p_payment->'evidence') e where e->>'type'='STRIPE_PAYMENT_INTENT' and e->>'reference'=p_payment->>'provider_identity')<>1
   or (select count(*) from jsonb_array_elements(p_payment->'evidence') e where e->>'type'='STRIPE_CHARGE' and e->>'reference' ~ '^ch_[A-Za-z0-9]+$')<>1
   then raise exception 'canonical Stripe intent and charge evidence required'; end if;
 elsif p_payment->>'provider'='Bank' then
  if p_payment->>'method'<>'WIRE' or jsonb_array_length(p_payment->'evidence')<>1 or p_payment->'evidence'->0->>'type'<>'BANK_REFERENCE' or p_payment->'evidence'->0->>'reference'<>p_payment->>'provider_identity' then raise exception 'canonical bank evidence required'; end if;
 else raise exception 'unsupported financial provider';
 end if;
 if p_payment->>'verification_state' is distinct from 'VERIFIED' then raise exception 'unverified payment denied'; end if;
 -- Lock the beneficiary agreement first: consistent lock order across settlement and import.
 perform 1 from missionaccounts_finance_qa.financial_agreement where subject_key=p_payment->>'subject_key' for update;
 if not found then raise exception 'certified agreement required'; end if;
 insert into missionaccounts_finance_qa.financial_payment(subject_key,provider,provider_account,provider_identity,method,currency,gross_cents,payer,received_at,received_precision,verification_state,request_id,request_digest,artifact_id)
 values(p_payment->>'subject_key',p_payment->>'provider',p_payment->>'provider_account',p_payment->>'provider_identity',p_payment->>'method','USD',(p_payment->>'gross_cents')::bigint,p_payment->>'payer',(p_payment->>'received_at')::timestamptz,p_payment->>'received_precision','VERIFIED',p_payment->>'request_id',digest,(p_payment->>'artifact_id')::uuid) returning id into pid;
 for x in select value from jsonb_array_elements(p_payment->'evidence') loop
  insert into missionaccounts_finance_qa.financial_payment_evidence(fingerprint,payment_id,evidence_type,provider,provider_reference,artifact_id,metadata,verified)
  values(x->>'fingerprint',pid,x->>'type',p_payment->>'provider',x->>'reference',(p_payment->>'artifact_id')::uuid,x->'metadata',true);
 end loop;
 for x in select value from jsonb_array_elements(p_payment->'applications') loop
  select o.id into strict oid from missionaccounts_finance_qa.financial_obligation o join missionaccounts_finance_qa.financial_agreement g on g.id=o.agreement_id
   where g.subject_key=p_payment->>'subject_key' and g.version=p_payment->>'agreement_version' and o.obligation_key=x->>'obligation_key' and o.component=x->>'component';
  insert into missionaccounts_finance_qa.financial_payment_application(payment_id,obligation_id,amount_cents) values(pid,oid,(x->>'amount_cents')::bigint);
  applied:=applied+(x->>'amount_cents')::bigint;
 end loop;
 insert into missionaccounts_finance_qa.audit_event(actor_id,actor_role,kind,text,to_val,reason,request_id)
 values(p_actor,'financial_service','financial.payment_recorded','Verified private financial payment and applications',jsonb_build_object('subject_key',p_payment->>'subject_key','payment_id',pid,'gross_cents',p_payment->'gross_cents','applied_cents',applied),'Certified evidence; no dispatch',p_payment->>'request_id');
 return jsonb_build_object('payment_id',pid,'duplicate',false,'applied_cents',applied,'credit_cents',(p_payment->>'gross_cents')::bigint-applied);
end $$;

-- Stage a fully validated sealed-input bundle atomically, including all held cases but no held debt.
create function missionaccounts_finance_qa.api_stage_certified_financial_bundle(p_actor text,p_bundle jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare artifact uuid; run_id uuid; s jsonb; p jsonb; x jsonb; aid uuid; prior missionaccounts_finance_qa.import_run; digest text; rid text;
begin
 perform missionaccounts_finance_qa.financial_require_principal(p_actor,'stage');
 perform missionaccounts_finance_qa.financial_require_principal(p_actor,'settle');
 rid:=p_bundle->>'request_id';digest:=encode(extensions.digest(p_bundle::text,'sha256'),'hex');
 if not exists(select 1 from missionaccounts_finance_qa.financial_principal where actor_id=p_actor and stage_bundle_digest=digest) then raise exception 'exact approved staging bundle digest required'; end if;
 if p_bundle->>'source_sha256' is distinct from '2f27f12314d43f7f36834164ff210b4f208697c7f64458d7aaa2ce0696121006'
  or jsonb_typeof(p_bundle->'certified') is distinct from 'array' or jsonb_typeof(p_bundle->'held') is distinct from 'array' or jsonb_typeof(p_bundle->'payments') is distinct from 'array'
  then raise exception 'sealed source contract required'; end if;
 perform pg_advisory_xact_lock(hashtextextended('financial-import:'||rid,0));
 select * into prior from missionaccounts_finance_qa.import_run where request_id=rid;
 if found then
  if prior.source_controls->>'bundle_digest'<>digest or prior.state<>'applied' then raise exception 'import replay conflict'; end if;
  return jsonb_build_object('duplicate',true,'import_run_id',prior.id);
 end if;
 if p_bundle->>'version' is distinct from 'match360-phase0c-v1' or jsonb_array_length(p_bundle->'certified')<>11 or jsonb_array_length(p_bundle->'held')<>6 then raise exception 'sealed tranche contract mismatch'; end if;
 insert into missionaccounts_finance_qa.source_artifact(source_kind,source_path,sha256,byte_count,observed_at)
 values('match360_phase0c',p_bundle->>'source_ref',p_bundle->>'source_sha256',(p_bundle->>'byte_count')::bigint,(p_bundle->>'certified_at')::timestamptz)
 on conflict(source_kind,sha256) do nothing;
 select id into strict artifact from missionaccounts_finance_qa.source_artifact where source_kind='match360_phase0c' and sha256=p_bundle->>'source_sha256';
 insert into missionaccounts_finance_qa.import_run(artifact_id,request_id,state,source_controls) values(artifact,rid,'pending',jsonb_build_object('bundle_digest',digest,'version',p_bundle->>'version')) returning id into run_id;
 for s in select value from jsonb_array_elements(p_bundle->'certified') loop
  insert into missionaccounts_finance_qa.financial_subject(subject_key,program_key,wp_subject,student_id,binding_state,certification_state,artifact_id)
  values(s->>'subject_key','mission_residency',s->>'wp_subject',null,'UNRESOLVED','CERTIFIED',artifact);
  insert into missionaccounts_finance_qa.financial_agreement(subject_key,version,currency,program,tier,accepted_tuition_cents,accepted_fees_cents,deposit_cents,effective_precision,plan,discount_provenance,agreement_evidence,certification_status,certified_at,artifact_id)
  values(s->>'subject_key',p_bundle->>'version','USD',s->>'program',s->>'tier',(s->>'tuition_cents')::bigint,(s->>'fees_cents')::bigint,(s->>'deposit_cents')::bigint,'UNKNOWN',s->'plan',s->'discount_provenance',s->'agreement_evidence',s->>'certification_status',(p_bundle->>'certified_at')::timestamptz,artifact) returning id into aid;
  if (s->>'tuition_cents')::bigint>0 then insert into missionaccounts_finance_qa.financial_obligation(agreement_id,obligation_key,component,original_cents) values(aid,'tuition-principal','TUITION_PRINCIPAL',(s->>'tuition_cents')::bigint); end if;
  if (s->>'fees_cents')::bigint>0 then insert into missionaccounts_finance_qa.financial_obligation(agreement_id,obligation_key,component,original_cents) values(aid,'admin-processing-fee','ADMIN_PROCESSING_FEE',(s->>'fees_cents')::bigint); end if;
  for x in select value from jsonb_array_elements(s->'payer_aliases') loop
   insert into missionaccounts_finance_qa.financial_payer_alias(subject_key,payer,relationship,provenance,artifact_id) values(s->>'subject_key',x->>'payer',x->>'relationship',x->'provenance',artifact);
  end loop;
 end loop;
 for s in select value from jsonb_array_elements(p_bundle->'held') loop
  insert into missionaccounts_finance_qa.financial_subject(subject_key,program_key,wp_subject,binding_state,certification_state,artifact_id) values(s->>'subject_key','mission_residency',s->>'wp_subject','UNRESOLVED','HELD',artifact);
  insert into missionaccounts_finance_qa.financial_reconciliation_case(subject_key,hold_class,reason,artifact_id) values(s->>'subject_key',s->>'hold_class',s->>'reason',artifact);
 end loop;
 for p in select value from jsonb_array_elements(p_bundle->'payments') loop
  perform missionaccounts_finance_qa.api_record_verified_financial_payment(p_actor,p||jsonb_build_object('artifact_id',artifact,'agreement_version',p_bundle->>'version'));
 end loop;
 update missionaccounts_finance_qa.import_run set state='applied',finished_at=now(),result_controls=jsonb_build_object('certified',jsonb_array_length(p_bundle->'certified'),'held',jsonb_array_length(p_bundle->'held'),'payments',jsonb_array_length(p_bundle->'payments')) where id=run_id;
 insert into missionaccounts_finance_qa.audit_event(actor_id,actor_role,kind,text,to_val,reason,request_id)
 values(p_actor,'financial_service','financial.bundle_staged','Sealed private accounting tranche staged',jsonb_build_object('artifact_id',artifact,'import_run_id',run_id,'student_visible',false,'dispatch',false),'No student publication or collection',rid);
 return jsonb_build_object('duplicate',false,'import_run_id',run_id);
end $$;

-- Preserve reused source-artifact provenance only for this domain's referenced rows.
create function missionaccounts_finance_qa.financial_guard_artifact()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from missionaccounts_finance_qa.financial_subject where artifact_id=old.id)
  or exists(select 1 from missionaccounts_finance_qa.financial_agreement where artifact_id=old.id)
  or exists(select 1 from missionaccounts_finance_qa.financial_payment where artifact_id=old.id)
  or exists(select 1 from missionaccounts_finance_qa.financial_payment_evidence where artifact_id=old.id)
  or exists(select 1 from missionaccounts_finance_qa.financial_payer_alias where artifact_id=old.id)
  or exists(select 1 from missionaccounts_finance_qa.financial_reconciliation_case where artifact_id=old.id) then
  raise exception 'sealed financial source artifact is immutable';
 end if;
 if TG_OP='DELETE' then return old; end if; return new;
end $$;
create trigger financial_artifact_immutable before update or delete on missionaccounts_finance_qa.source_artifact
 for each row execute function missionaccounts_finance_qa.financial_guard_artifact();

create function missionaccounts_finance_qa.api_read_financial_accounts(p_actor text)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform missionaccounts_finance_qa.financial_require_principal(p_actor,'read');
 return (select coalesce(jsonb_agg(to_jsonb(b) order by subject_key),'[]'::jsonb) from missionaccounts_finance_qa.financial_balance b);
end $$;

-- Explicit service-only API. No student grants/policies, no generic WordPress admin mapping.
do $$ declare t text; f record; begin
 foreach t in array array['financial_principal','financial_subject','financial_agreement','financial_obligation','financial_payment','financial_payment_evidence','financial_payment_application','financial_adjustment','financial_payer_alias','financial_reconciliation_case'] loop
  execute format('alter table missionaccounts_finance_qa.%I enable row level security',t);
  execute format('alter table missionaccounts_finance_qa.%I force row level security',t);
  execute format('revoke all on missionaccounts_finance_qa.%I from public,anon,authenticated,service_role',t);
  execute format('grant select on missionaccounts_finance_qa.%I to service_role',t);
  execute format('create trigger %I before update or delete on missionaccounts_finance_qa.%I for each row execute function missionaccounts_finance_qa.reject_immutable_change()',t||'_immutable',t);
 end loop;
 for f in select p.oid::regprocedure sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='missionaccounts_finance_qa' and (p.proname like 'financial_%' or p.proname in ('api_record_verified_financial_payment','api_stage_certified_financial_bundle','api_read_financial_accounts')) loop
  execute format('revoke execute on function %s from public,anon,authenticated,service_role',f.sig);
 end loop;
end $$;
revoke all on missionaccounts_finance_qa.financial_obligation_state,missionaccounts_finance_qa.financial_balance,missionaccounts_finance_qa.financial_unapplied_credit from public,anon,authenticated,service_role;
grant select on missionaccounts_finance_qa.financial_obligation_state,missionaccounts_finance_qa.financial_balance,missionaccounts_finance_qa.financial_unapplied_credit to service_role;
grant execute on function missionaccounts_finance_qa.api_record_verified_financial_payment(text,jsonb),missionaccounts_finance_qa.api_stage_certified_financial_bundle(text,jsonb),missionaccounts_finance_qa.api_read_financial_accounts(text) to service_role;
-- No principal grant in schema migration: exact staging custody authorizes a separate bounded grant.


-- Finance source 20261005135949_mission_residency_finance_admin_read.sql SHA256 2b19ca639a3dc5b8c6a72319051598f26b01232d442d455fdc8abf45d022304d
-- DR-384 / MR-FINANCIAL-ACCOUNTS-PHASE2. Private Founder read projection only.
-- Target dwwsahpzblgrgducxtzw; depends on the sealed Phase 1 financial domain.
-- No agreement, payment, application, balance, entitlement or provider mutation.

create table missionaccounts_finance_qa.financial_read_binding (
 principal_id uuid not null, wp_user_id bigint not null check(wp_user_id>0),
 actor_id text not null references missionaccounts_finance_qa.financial_principal,
 authority_ref text not null, active boolean not null default true,
 primary key(principal_id,wp_user_id), unique(actor_id)
);
create table missionaccounts_finance_qa.financial_display_directory (
 subject_key text primary key references missionaccounts_finance_qa.financial_subject,
 display_name text not null check(length(display_name) between 1 and 200),
 program text not null, source_sha256 text not null check(source_sha256 ~ '^[0-9a-f]{64}$'),
 authority_ref text not null
);
do $$ declare t text; begin
 foreach t in array array['financial_read_binding','financial_display_directory'] loop
  execute format('alter table missionaccounts_finance_qa.%I enable row level security',t);
  execute format('alter table missionaccounts_finance_qa.%I force row level security',t);
  execute format('revoke all on missionaccounts_finance_qa.%I from public,anon,authenticated,service_role',t);
  execute format('grant select on missionaccounts_finance_qa.%I to service_role',t);
  execute format('create trigger %I before update or delete on missionaccounts_finance_qa.%I for each row execute function missionaccounts_finance_qa.reject_immutable_change()',t||'_immutable',t);
 end loop;
end $$;

create function missionaccounts_finance_qa.api_financial_read_access(p_principal uuid,p_wp_user_id bigint)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from missionaccounts_finance_qa.financial_read_binding b
 join missionaccounts_finance_qa.financial_principal p on p.actor_id=b.actor_id
 where b.principal_id=p_principal and b.wp_user_id=p_wp_user_id and b.active
 and 'read'=any(p.capabilities));
$$;

create function missionaccounts_finance_qa.api_read_financial_command(p_principal uuid,p_wp_user_id bigint)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not missionaccounts_finance_qa.api_financial_read_access(p_principal,p_wp_user_id) then
  raise exception 'Explicit Founder financial authorization required' using errcode='42501';
 end if;
 return jsonb_build_object('observed_at',now(),'accounts',(
 select coalesce(jsonb_agg(jsonb_build_object(
  'subject_key',s.subject_key,'name',coalesce(d.display_name,s.subject_key),
  'program',coalesce(g.program,d.program),'tier',g.tier,'state',s.certification_state,
  'binding_state',s.binding_state,'student_visible',s.student_visible,'collections_enabled',s.collections_enabled,
  'created_at',s.created_at,
  'agreement',case when g.id is null then null else jsonb_build_object(
   'id',g.id,'version',g.version,'currency',g.currency,'tuition_cents',g.accepted_tuition_cents,
   'fees_cents',g.accepted_fees_cents,'deposit_cents',g.deposit_cents,'effective_on',g.effective_on,
   'effective_precision',g.effective_precision,'plan',g.plan,'discount_provenance',g.discount_provenance,
   'evidence',g.agreement_evidence,'certification_status',g.certification_status,'certified_at',g.certified_at) end,
  'balance',case when b.agreement_id is null then null else jsonb_build_object(
   'balance_cents',b.balance_cents,'currently_due_cents',b.currently_due_cents,'overdue_cents',b.overdue_cents) end,
  'obligations',coalesce((select jsonb_agg(to_jsonb(o) order by o.obligation_key) from missionaccounts_finance_qa.financial_obligation_state o where o.agreement_id=g.id),'[]'::jsonb),
  'payments',coalesce((select jsonb_agg(jsonb_build_object(
   'id',p.id,'date',p.received_at,'date_precision',p.received_precision,'amount_cents',p.gross_cents,
   'method',p.method,'payer',p.payer,'provider',p.provider,'verification_state',p.verification_state,
   'verified_at',p.verified_at,
   'applied_cents',coalesce((select sum(a.amount_cents) from missionaccounts_finance_qa.financial_payment_application a where a.payment_id=p.id),0),
   'unapplied_cents',(select c.credit_cents from missionaccounts_finance_qa.financial_unapplied_credit c where c.payment_id=p.id),
   'evidence',coalesce((select jsonb_agg(jsonb_build_object('type',e.evidence_type,'provider',e.provider,
    'reference',e.provider_reference,'fingerprint',e.fingerprint,'verified',e.verified)) from missionaccounts_finance_qa.financial_payment_evidence e where e.payment_id=p.id),'[]'::jsonb)
  ) order by p.received_at,p.id) from missionaccounts_finance_qa.financial_payment p where p.subject_key=s.subject_key),'[]'::jsonb),
  'applications',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'payment_id',a.payment_id,
   'obligation_id',a.obligation_id,'obligation',o.obligation_key,'component',o.component,
   'amount_cents',a.amount_cents,'recorded_at',a.created_at) order by a.created_at,a.id)
   from missionaccounts_finance_qa.financial_payment_application a join missionaccounts_finance_qa.financial_obligation o on o.id=a.obligation_id where o.agreement_id=g.id),'[]'::jsonb),
  'adjustments',coalesce((select jsonb_agg(jsonb_build_object('kind',a.kind,'amount_cents',a.amount_cents,'authority_ref',a.authority_ref,'evidence_fingerprint',a.evidence_fingerprint,'created_at',a.created_at))
   from missionaccounts_finance_qa.financial_adjustment a left join missionaccounts_finance_qa.financial_obligation o on o.id=a.obligation_id
   left join missionaccounts_finance_qa.financial_payment p on p.id=a.payment_id where o.agreement_id=g.id or p.subject_key=s.subject_key),'[]'::jsonb),
  'payers',coalesce((select jsonb_agg(jsonb_build_object('payer',p.payer,'relationship',p.relationship,'provenance',p.provenance) order by p.payer) from missionaccounts_finance_qa.financial_payer_alias p where p.subject_key=s.subject_key),'[]'::jsonb),
  'cases',coalesce((select jsonb_agg(jsonb_build_object('type',c.hold_class,'reason',c.reason)) from missionaccounts_finance_qa.financial_reconciliation_case c where c.subject_key=s.subject_key),'[]'::jsonb),
  'source',jsonb_build_object('kind',a.source_kind,'sha256',a.sha256,'observed_at',a.observed_at,
    'display_sha256',d.source_sha256,'display_authority',d.authority_ref)
 ) order by coalesce(d.display_name,s.subject_key)),'[]'::jsonb)
 from missionaccounts_finance_qa.financial_subject s
 left join missionaccounts_finance_qa.financial_display_directory d on d.subject_key=s.subject_key
 left join missionaccounts_finance_qa.financial_agreement g on g.subject_key=s.subject_key
 left join missionaccounts_finance_qa.financial_balance b on b.agreement_id=g.id
 join missionaccounts_finance_qa.source_artifact a on a.id=s.artifact_id));
end $$;
revoke all on function missionaccounts_finance_qa.api_financial_read_access(uuid,bigint),missionaccounts_finance_qa.api_read_financial_command(uuid,bigint) from public,anon,authenticated,service_role;
grant execute on function missionaccounts_finance_qa.api_financial_read_access(uuid,bigint),missionaccounts_finance_qa.api_read_financial_command(uuid,bigint) to service_role;


-- Finance source 20261005153041_mission_residency_financial_operations.sql SHA256 5a78b3d7d0ce1bef1cacd2aa611e04ebaa0c5d38286eae99b5266f5813cb60cb
-- DR-387 / MR-FINANCIAL-ACCOUNTS-PHASE3. Source candidate; not deployment authority.
-- Target: isolated missionaccounts_finance_qa dwwsahpzblgrgducxtzw.
-- Original certified financial tables remain immutable. Schedules allocate existing residuals.
-- Feature release, account binding and provider grants require separate verified custody.

create table missionaccounts_finance_qa.financial_operating_gate (
 id integer primary key check(id=1), founder_operations boolean not null default false,
 student_onboarding boolean not null default false, student_publication boolean not null default false,
 card_dispatch boolean not null default false, zelle_matcher boolean not null default false,
 authority_ref text not null, updated_at timestamptz not null default now()
);
insert into missionaccounts_finance_qa.financial_operating_gate(id,authority_ref) values(1,'DR-387:SOURCE_ONLY');
create table missionaccounts_finance_qa.financial_runtime_binding (
 subject_key text primary key references missionaccounts_finance_qa.financial_subject,
 principal_id uuid not null unique, wp_user_id bigint not null unique check(wp_user_id>1),
 authority_ref text not null, evidence_sha256 text not null check(evidence_sha256 ~ '^[a-f0-9]{64}$'),
 active boolean not null default true, created_at timestamptz not null default now()
);
create function missionaccounts_finance_qa.financial_guard_runtime_binding()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from missionaccounts_finance_qa.financial_subject where subject_key=new.subject_key and wp_subject='wp:'||new.wp_user_id::text) then
  raise exception 'Financial binding must match the established WordPress beneficiary' using errcode='42501';
 end if;
 return new;
end $$;
create trigger financial_runtime_binding_owner before insert on missionaccounts_finance_qa.financial_runtime_binding
 for each row execute function missionaccounts_finance_qa.financial_guard_runtime_binding();
create table missionaccounts_finance_qa.financial_operating_event (
 id uuid primary key default gen_random_uuid(), subject_key text not null references missionaccounts_finance_qa.financial_subject,
 actor_id uuid not null, actor_wp_user_id bigint not null, operation text not null,
 before_state jsonb not null, after_state jsonb not null, request_id text not null unique,
 request_digest text not null check(request_digest ~ '^[a-f0-9]{64}$'),
 authority_ref text not null, evidence_sha256 text not null check(evidence_sha256 ~ '^[a-f0-9]{64}$'),
 created_at timestamptz not null default clock_timestamp(), sequence_no bigint generated always as identity unique
);
create table missionaccounts_finance_qa.financial_onboarding_eligibility (
 event_id uuid primary key references missionaccounts_finance_qa.financial_operating_event deferrable initially deferred,
 subject_key text not null references missionaccounts_finance_qa.financial_subject,
 required boolean not null, card_required boolean not null, reason text not null,
 check(not card_required or required)
);
create table missionaccounts_finance_qa.financial_payment_profile (
 event_id uuid primary key references missionaccounts_finance_qa.financial_operating_event deferrable initially deferred,
 subject_key text not null references missionaccounts_finance_qa.financial_subject,
 email text not null check(length(email) between 3 and 254), phone text not null check(length(phone) between 3 and 80),
 contact_confirmed boolean not null, arrangement_acknowledged boolean not null,
 save_method_acknowledged boolean not null
);
create table missionaccounts_finance_qa.financial_schedule_revision (
 id uuid primary key default gen_random_uuid(), subject_key text not null references missionaccounts_finance_qa.financial_subject,
 event_id uuid not null unique references missionaccounts_finance_qa.financial_operating_event deferrable initially deferred,
 supersedes uuid unique references missionaccounts_finance_qa.financial_schedule_revision,
 created_at timestamptz not null default now()
);
create table missionaccounts_finance_qa.financial_schedule_installment (
 id uuid primary key default gen_random_uuid(), revision_id uuid not null references missionaccounts_finance_qa.financial_schedule_revision,
 installment_key text not null, obligation_id uuid not null references missionaccounts_finance_qa.financial_obligation,
 amount_cents bigint not null check(amount_cents>0), due_on date, due_precision text not null check(due_precision in ('EXACT','UNKNOWN')),
 unique(revision_id,installment_key), check((due_precision='EXACT')=(due_on is not null))
);
create table missionaccounts_finance_qa.financial_schedule_application (
 installment_id uuid not null references missionaccounts_finance_qa.financial_schedule_installment,
 payment_application_id uuid not null references missionaccounts_finance_qa.financial_payment_application,
 amount_cents bigint not null check(amount_cents>0), primary key(installment_id,payment_application_id)
);
create function missionaccounts_finance_qa.financial_guard_schedule_application()
returns trigger language plpgsql security definer set search_path='' as $$
declare i missionaccounts_finance_qa.financial_schedule_installment; a missionaccounts_finance_qa.financial_payment_application; owner text;
begin
 select * into strict i from missionaccounts_finance_qa.financial_schedule_installment where id=new.installment_id for update;
 select * into strict a from missionaccounts_finance_qa.financial_payment_application where id=new.payment_application_id for update;
 select subject_key into strict owner from missionaccounts_finance_qa.financial_schedule_revision where id=i.revision_id;
 if a.obligation_id<>i.obligation_id or owner<>(select subject_key from missionaccounts_finance_qa.financial_payment where id=a.payment_id) then raise exception 'Schedule allocation ownership mismatch';end if;
 if new.amount_cents+(select coalesce(sum(amount_cents),0) from missionaccounts_finance_qa.financial_schedule_application where payment_application_id=a.id)>a.amount_cents then raise exception 'Schedule allocation exceeds canonical application';end if;
 if new.amount_cents+(select coalesce(sum(amount_cents),0) from missionaccounts_finance_qa.financial_schedule_application where installment_id=i.id)>i.amount_cents then raise exception 'Schedule allocation exceeds installment';end if;
 return new;
end $$;
create trigger financial_schedule_application_guard before insert on missionaccounts_finance_qa.financial_schedule_application
 for each row execute function missionaccounts_finance_qa.financial_guard_schedule_application();
create table missionaccounts_finance_qa.financial_payment_request (
 id uuid primary key default gen_random_uuid(), subject_key text not null references missionaccounts_finance_qa.financial_subject,
 obligation_id uuid not null references missionaccounts_finance_qa.financial_obligation,
 installment_id uuid references missionaccounts_finance_qa.financial_schedule_installment,
 event_id uuid not null unique references missionaccounts_finance_qa.financial_operating_event deferrable initially deferred,
 amount_cents bigint not null check(amount_cents>0), description text not null check(length(description) between 1 and 300),
 methods text[] not null check(cardinality(methods)>0 and methods <@ array['CARD','ZELLE']::text[]),
 expires_at timestamptz, created_at timestamptz not null default now()
);
create table missionaccounts_finance_qa.financial_request_result (
 request_id uuid not null references missionaccounts_finance_qa.financial_payment_request,
 event_id uuid primary key references missionaccounts_finance_qa.financial_operating_event deferrable initially deferred,
 state text not null check(state in ('REPORTED','CANCELLED','SETTLED','REVIEW_REQUIRED')),
 payment_id uuid references missionaccounts_finance_qa.financial_payment
);
create table missionaccounts_finance_qa.financial_card_binding (
 subject_key text primary key references missionaccounts_finance_qa.financial_subject,
 provider_account text not null check(provider_account ~ '^acct_[A-Za-z0-9]+$'),
 customer_ref text not null check(customer_ref ~ '^cus_[A-Za-z0-9]+$'),
 created_at timestamptz not null default now(), unique(provider_account,customer_ref)
);
create table missionaccounts_finance_qa.financial_card_setup (
 id uuid primary key default gen_random_uuid(), subject_key text not null references missionaccounts_finance_qa.financial_card_binding,
 request_id text not null unique, intent_ref text unique check(intent_ref ~ '^seti_[A-Za-z0-9]+$'),
 created_at timestamptz not null default now()
);
create table missionaccounts_finance_qa.financial_card_method (
 id uuid primary key default gen_random_uuid(), subject_key text not null references missionaccounts_finance_qa.financial_card_binding,
 setup_id uuid not null unique references missionaccounts_finance_qa.financial_card_setup,
 provider_pm_ref text not null check(provider_pm_ref ~ '^pm_[A-Za-z0-9]+$'),
 brand text not null, last4 text not null check(last4 ~ '^\d{4}$'),
 exp_month integer not null check(exp_month between 1 and 12), exp_year integer not null,
 verified_at timestamptz not null default now()
);
create table missionaccounts_finance_qa.financial_specific_authorization (
 id uuid primary key default gen_random_uuid(), request_id uuid not null references missionaccounts_finance_qa.financial_payment_request,
 subject_key text not null references missionaccounts_finance_qa.financial_runtime_binding,
 method_id uuid not null references missionaccounts_finance_qa.financial_card_method,
 amount_cents bigint not null check(amount_cents>0), terms_version text not null,
 event_id uuid not null unique references missionaccounts_finance_qa.financial_operating_event deferrable initially deferred,
 accepted_at timestamptz not null default now(), expires_at timestamptz not null,
 check(expires_at>accepted_at)
);
create table missionaccounts_finance_qa.financial_card_attempt (
 id uuid primary key default gen_random_uuid(), request_id uuid not null references missionaccounts_finance_qa.financial_payment_request,
 subject_key text not null references missionaccounts_finance_qa.financial_subject,
 amount_cents bigint not null check(amount_cents>0), provider_account text not null,
 intent_ref text unique check(intent_ref ~ '^pi_[A-Za-z0-9]+$'),
 state text not null check(state in ('PREPARED','SUBMITTED','REQUIRES_ACTION','DECLINED','AMBIGUOUS','SUCCEEDED','CANCELLED')),
 request_identity text not null unique, request_digest text not null,
 actor_id uuid not null, authorization_id uuid references missionaccounts_finance_qa.financial_specific_authorization,
 payment_id uuid references missionaccounts_finance_qa.financial_payment,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index financial_one_unresolved_card_attempt on missionaccounts_finance_qa.financial_card_attempt(request_id)
 where state in ('PREPARED','SUBMITTED','REQUIRES_ACTION','AMBIGUOUS','SUCCEEDED');
create index financial_operating_event_subject on missionaccounts_finance_qa.financial_operating_event(subject_key,sequence_no);
create index financial_request_subject on missionaccounts_finance_qa.financial_payment_request(subject_key);
create index financial_installment_obligation on missionaccounts_finance_qa.financial_schedule_installment(obligation_id);

create view missionaccounts_finance_qa.financial_active_schedule with(security_invoker=true) as
 select i.*,r.subject_key,coalesce(sum(a.amount_cents),0)::bigint applied_cents,
 case when exists(select 1 from missionaccounts_finance_qa.financial_schedule_revision n where n.supersedes=r.id) then 0 else (i.amount_cents-coalesce(sum(a.amount_cents),0))::bigint end remaining_cents
 from missionaccounts_finance_qa.financial_schedule_installment i join missionaccounts_finance_qa.financial_schedule_revision r on r.id=i.revision_id
 left join missionaccounts_finance_qa.financial_schedule_application a on a.installment_id=i.id
 where not exists(select 1 from missionaccounts_finance_qa.financial_schedule_revision n where n.supersedes=r.id)
 or exists(select 1 from missionaccounts_finance_qa.financial_schedule_application p where p.installment_id=i.id)
 group by i.id,r.id,r.subject_key;

create function missionaccounts_finance_qa.financial_require_founder(p_principal uuid,p_wp_user_id bigint)
returns void language plpgsql security definer set search_path='' as $$
begin
 if p_wp_user_id<>1 or not missionaccounts_finance_qa.api_financial_read_access(p_principal,p_wp_user_id) then
  raise exception 'Explicit Founder finance authority required' using errcode='42501';
 end if;
 if not exists(select 1 from missionaccounts_finance_qa.financial_operating_gate where id=1 and founder_operations) then
  raise exception 'Financial operating release is disabled' using errcode='42501';
 end if;
end $$;
create function missionaccounts_finance_qa.financial_own_subject(p_principal uuid,p_wp_user_id bigint)
returns text language plpgsql stable security definer set search_path='' as $$
declare k text;
begin
 if not exists(select 1 from missionaccounts_finance_qa.financial_operating_gate where id=1 and student_onboarding) then
  raise exception 'Student payment onboarding release is disabled' using errcode='42501';
 end if;
 select subject_key into k from missionaccounts_finance_qa.financial_runtime_binding where principal_id=p_principal and wp_user_id=p_wp_user_id and active;
 if k is null then raise exception 'Verified own financial account required' using errcode='42501'; end if;
 return k;
end $$;

create function missionaccounts_finance_qa.financial_operating_snapshot(p_subject text)
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('subject_key',p_subject,'certification_state',(select certification_state from missionaccounts_finance_qa.financial_subject where subject_key=p_subject),
  'eligibility',(select to_jsonb(x)-'event_id' from missionaccounts_finance_qa.financial_onboarding_eligibility x join missionaccounts_finance_qa.financial_operating_event e on e.id=x.event_id where x.subject_key=p_subject order by e.sequence_no desc limit 1),
  'profile',(select to_jsonb(x)-'event_id' from missionaccounts_finance_qa.financial_payment_profile x join missionaccounts_finance_qa.financial_operating_event e on e.id=x.event_id where x.subject_key=p_subject order by e.sequence_no desc limit 1),
  'method',(select jsonb_build_object('id',m.id,'subject_key',m.subject_key,'state',case when make_date(m.exp_year,m.exp_month,1)+interval '1 month'>current_date then 'READY' else 'EXPIRED' end,'brand',m.brand,'last4',m.last4,'exp_month',m.exp_month,'exp_year',m.exp_year) from missionaccounts_finance_qa.financial_card_method m where m.subject_key=p_subject order by verified_at desc,id desc limit 1),
  'pending_setup',(select jsonb_build_object('request_id',regexp_replace(e.request_id,':reserved$','')) from missionaccounts_finance_qa.financial_operating_event e where e.subject_key=p_subject and e.operation='PAYMENT_SETUP_RESERVED' and not exists(select 1 from missionaccounts_finance_qa.financial_card_setup s join missionaccounts_finance_qa.financial_card_method m on m.setup_id=s.id where s.request_id=regexp_replace(e.request_id,':reserved$','')) order by e.sequence_no desc limit 1),
  'schedule',coalesce((select jsonb_agg(to_jsonb(i) order by due_on nulls last,id) from missionaccounts_finance_qa.financial_active_schedule i where i.subject_key=p_subject),'[]'::jsonb),
  'requests',coalesce((select jsonb_agg(to_jsonb(r)||jsonb_build_object('state',coalesce((select x.state from missionaccounts_finance_qa.financial_request_result x join missionaccounts_finance_qa.financial_operating_event e on e.id=x.event_id where x.request_id=r.id order by e.sequence_no desc limit 1),'OPEN'),'authority_ref',e.authority_ref,'evidence_sha256',e.evidence_sha256) order by r.created_at,r.id) from missionaccounts_finance_qa.financial_payment_request r join missionaccounts_finance_qa.financial_operating_event e on e.id=r.event_id where r.subject_key=p_subject),'[]'::jsonb),
  'authorizations',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'request_id',c.request_id,'method_id',c.method_id,'amount_cents',c.amount_cents,'terms_version',c.terms_version,'accepted_at',c.accepted_at,'expires_at',c.expires_at,'brand',m.brand,'last4',m.last4) order by c.accepted_at,c.id) from missionaccounts_finance_qa.financial_specific_authorization c join missionaccounts_finance_qa.financial_card_method m on m.id=c.method_id where c.subject_key=p_subject),'[]'::jsonb),
  'attempts',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'request_id',a.request_id,'amount_cents',a.amount_cents,'state',a.state,'created_at',a.created_at,'payment_id',a.payment_id) order by a.created_at,a.id) from missionaccounts_finance_qa.financial_card_attempt a where a.subject_key=p_subject),'[]'::jsonb),
  'events',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'at',e.created_at,'operation',e.operation,'actor_wp_user_id',e.actor_wp_user_id,'authority_ref',e.authority_ref,'result',e.after_state) order by e.sequence_no) from missionaccounts_finance_qa.financial_operating_event e where e.subject_key=p_subject),'[]'::jsonb))
$$;
create function missionaccounts_finance_qa.api_financial_operating_command(p_principal uuid,p_wp_user_id bigint)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if p_wp_user_id<>1 or not missionaccounts_finance_qa.api_financial_read_access(p_principal,p_wp_user_id) then raise exception 'Founder financial authorization required' using errcode='42501';end if;
 return jsonb_build_object('gates',(select to_jsonb(g)-'id' from missionaccounts_finance_qa.financial_operating_gate g where id=1),
  'accounts',(select coalesce(jsonb_agg(missionaccounts_finance_qa.financial_operating_snapshot(subject_key) order by subject_key),'[]'::jsonb) from missionaccounts_finance_qa.financial_subject));
end $$;
create function missionaccounts_finance_qa.api_financial_student_access(p_principal uuid,p_wp_user_id bigint)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from missionaccounts_finance_qa.financial_runtime_binding b,missionaccounts_finance_qa.financial_operating_gate g where g.id=1 and g.student_onboarding and b.active and b.principal_id=p_principal and b.wp_user_id=p_wp_user_id);
$$;
create function missionaccounts_finance_qa.api_financial_own_onboarding(p_principal uuid,p_wp_user_id bigint)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare k text; s missionaccounts_finance_qa.financial_subject;
begin
 k:=missionaccounts_finance_qa.financial_own_subject(p_principal,p_wp_user_id);select * into strict s from missionaccounts_finance_qa.financial_subject where subject_key=k;
 return missionaccounts_finance_qa.financial_operating_snapshot(k)-'events'-'schedule'-'requests'-'authorizations'-'attempts'||jsonb_build_object('certification_state',s.certification_state);
end $$;
create function missionaccounts_finance_qa.api_save_financial_onboarding(p_principal uuid,p_wp_user_id bigint,p_profile jsonb,p_request_id text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare k text; dg text; ev uuid; old missionaccounts_finance_qa.financial_operating_event; prior jsonb;
begin
 k:=missionaccounts_finance_qa.financial_own_subject(p_principal,p_wp_user_id);
 if p_request_id !~ '^[A-Za-z0-9._:-]{8,160}$' or p_profile->>'email' !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Valid profile request required';end if;
 dg:=encode(extensions.digest(jsonb_build_array(p_principal,p_wp_user_id,k,p_profile)::text,'sha256'),'hex');
 perform pg_advisory_xact_lock(hashtextextended('financial-operation:'||p_request_id,0));
 select * into old from missionaccounts_finance_qa.financial_operating_event where request_id=p_request_id;
 if found then if old.request_digest<>dg then raise exception 'Profile request identity conflict';end if;return missionaccounts_finance_qa.api_financial_own_onboarding(p_principal,p_wp_user_id);end if;
 perform 1 from missionaccounts_finance_qa.financial_subject where subject_key=k for update;
 if (missionaccounts_finance_qa.financial_operating_snapshot(k)->'eligibility'->>'required')::boolean is distinct from true then raise exception 'Payment onboarding is not required';end if;
 prior:=missionaccounts_finance_qa.financial_operating_snapshot(k)->'profile';ev:=gen_random_uuid();
 insert into missionaccounts_finance_qa.financial_operating_event values(ev,k,p_principal,p_wp_user_id,'SAVE_PAYMENT_ONBOARDING',coalesce(prior,'{}'::jsonb),jsonb_build_object('saved',true),p_request_id,dg,'DR-387:OWN_ACCOUNT',dg,now());
 insert into missionaccounts_finance_qa.financial_payment_profile values(ev,k,p_profile->>'email',p_profile->>'phone',coalesce((p_profile->>'contact_confirmed')::boolean,false),coalesce((p_profile->>'arrangement_acknowledged')::boolean,false),coalesce((p_profile->>'save_method_acknowledged')::boolean,false));
 insert into missionaccounts_finance_qa.audit_event(actor_id,actor_role,kind,text,to_val,reason,request_id)
  values(p_principal::text,'student','mr_payment_onboarding','Saved own payment onboarding',jsonb_build_object('subject',k,'saved',true),'Own authenticated account',p_request_id);
 return missionaccounts_finance_qa.api_financial_own_onboarding(p_principal,p_wp_user_id);
end $$;

create function missionaccounts_finance_qa.api_financial_operate(p_principal uuid,p_wp_user_id bigint,p_subject text,p_operation text,p_payload jsonb,p_request_id text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare old missionaccounts_finance_qa.financial_operating_event; ev uuid; dg text; result jsonb; s missionaccounts_finance_qa.financial_subject;
 g missionaccounts_finance_qa.financial_agreement; o missionaccounts_finance_qa.financial_obligation_state; revision uuid; previous uuid;
 row jsonb; total bigint; amount bigint; item uuid; request uuid; before_value jsonb;
begin
 perform missionaccounts_finance_qa.financial_require_founder(p_principal,p_wp_user_id);
 if p_request_id !~ '^[A-Za-z0-9._:-]{8,160}$' or p_payload->>'authority_ref' is null or coalesce(p_payload->>'evidence_sha256','') !~ '^[a-f0-9]{64}$'
 or p_payload->'confirmed' is distinct from 'true'::jsonb then raise exception 'Explicit confirmation, authority and evidence required'; end if;
 dg:=encode(extensions.digest(jsonb_build_array(p_principal,p_wp_user_id,p_subject,p_operation,p_payload)::text,'sha256'),'hex');
 perform pg_advisory_xact_lock(hashtextextended('financial-operation:'||p_request_id,0));
 select * into old from missionaccounts_finance_qa.financial_operating_event where request_id=p_request_id;
 if found then
  if old.request_digest<>dg then raise exception 'Financial request identity conflict';end if;
  return jsonb_build_object('duplicate',true,'event_id',old.id,'result',old.after_state);
 end if;
 select * into strict s from missionaccounts_finance_qa.financial_subject where subject_key=p_subject for update;
 select * into g from missionaccounts_finance_qa.financial_agreement where subject_key=p_subject for update;
 if p_operation<>'SET_ONBOARDING_ELIGIBILITY' and s.certification_state<>'CERTIFIED' then raise exception 'Held account is not collectible';end if;
 ev:=gen_random_uuid();
 before_value:=jsonb_build_object('balance',case when g.id is not null then (select to_jsonb(b) from missionaccounts_finance_qa.financial_balance b where b.agreement_id=g.id) else null end);
 if p_operation='SET_ONBOARDING_ELIGIBILITY' then
  if coalesce((p_payload->>'required')::boolean,false) and s.certification_state='CERTIFIED' and
   (select balance_cents from missionaccounts_finance_qa.financial_balance where agreement_id=g.id)=0 then raise exception 'Paid-in-full account does not require a card';end if;
  insert into missionaccounts_finance_qa.financial_onboarding_eligibility values(ev,p_subject,(p_payload->>'required')::boolean,(p_payload->>'card_required')::boolean,p_payload->>'reason');
  result:=jsonb_build_object('required',(p_payload->>'required')::boolean);
 elsif p_operation='CREATE_OBLIGATION' then
  insert into missionaccounts_finance_qa.financial_obligation(agreement_id,obligation_key,component,original_cents,due_on,due_precision)
   values(g.id,p_payload->>'key',p_payload->>'component',(p_payload->>'amount_cents')::bigint,(p_payload->>'due_on')::date,
    case when p_payload->>'due_on' is null then 'UNKNOWN' else 'EXACT' end) returning id into item;
  result:=jsonb_build_object('obligation_id',item);
 elsif p_operation='SAVE_SCHEDULE' then
  if jsonb_typeof(p_payload->'installments')<>'array' or jsonb_array_length(p_payload->'installments') not between 1 and 60 then raise exception 'Bounded schedule required';end if;
  select r.id into previous from missionaccounts_finance_qa.financial_schedule_revision r where r.subject_key=p_subject
   and not exists(select 1 from missionaccounts_finance_qa.financial_schedule_revision n where n.supersedes=r.id) for update;
  if exists(select 1 from missionaccounts_finance_qa.financial_card_attempt a where a.subject_key=p_subject and a.state in ('PREPARED','SUBMITTED','REQUIRES_ACTION','AMBIGUOUS','DECLINED')) or
   exists(select 1 from missionaccounts_finance_qa.financial_payment_request q where q.subject_key=p_subject and q.installment_id is not null and
    (select rr.state from missionaccounts_finance_qa.financial_request_result rr join missionaccounts_finance_qa.financial_operating_event e on e.id=rr.event_id where rr.request_id=q.id order by e.sequence_no desc limit 1)='REPORTED') then raise exception 'Reconcile pending payments before schedule revision';end if;
  if coalesce(p_payload->>'expected_revision','')<>coalesce(previous::text,'') then raise exception 'Schedule changed; reload before editing';end if;
  revision:=gen_random_uuid();insert into missionaccounts_finance_qa.financial_schedule_revision values(revision,p_subject,ev,previous,now());
  for row in select value from jsonb_array_elements(p_payload->'installments') loop
   select * into strict o from missionaccounts_finance_qa.financial_obligation_state where id=(row->>'obligation_id')::uuid and agreement_id=g.id;
   perform 1 from missionaccounts_finance_qa.financial_obligation where id=o.id for update;
   amount:=(row->>'amount_cents')::bigint;
   if amount<=0 then raise exception 'Positive installment required';end if;
   select coalesce(sum(amount_cents),0) into total from missionaccounts_finance_qa.financial_schedule_installment where revision_id=revision and obligation_id=o.id;
   if amount+total>o.remaining_cents then raise exception 'Schedule exceeds certified residual';end if;
   if exists(select 1 from missionaccounts_finance_qa.financial_active_schedule a where a.subject_key=p_subject and a.installment_key=row->>'key' and a.applied_cents>0) then raise exception 'Settled schedule history may not be rewritten';end if;
   insert into missionaccounts_finance_qa.financial_schedule_installment(revision_id,installment_key,obligation_id,amount_cents,due_on,due_precision)
    values(revision,row->>'key',o.id,amount,(row->>'due_on')::date,case when row->>'due_on' is null then 'UNKNOWN' else 'EXACT' end);
  end loop;
  result:=jsonb_build_object('revision_id',revision);
 elsif p_operation='ADJUST_OBLIGATION' then
  if exists(select 1 from missionaccounts_finance_qa.financial_card_attempt a where a.subject_key=p_subject and a.state in ('PREPARED','SUBMITTED','REQUIRES_ACTION','AMBIGUOUS','DECLINED')) then raise exception 'Reconcile reserved payments before adjustment';end if;
  select * into strict o from missionaccounts_finance_qa.financial_obligation_state where id=(p_payload->>'obligation_id')::uuid and agreement_id=g.id;
  amount:=(p_payload->>'amount_cents')::bigint;
  if amount<=0 or amount>o.remaining_cents or p_payload->>'kind' not in ('WAIVER','CREDIT') then raise exception 'Adjustment exceeds unsettled obligation';end if;
  if (select coalesce(sum(i.remaining_cents),0) from missionaccounts_finance_qa.financial_active_schedule i where i.obligation_id=o.id)>o.remaining_cents-amount then raise exception 'Revise the future schedule before reducing its parent obligation';end if;
  insert into missionaccounts_finance_qa.financial_adjustment(obligation_id,kind,amount_cents,authority_ref,evidence_fingerprint)
   values(o.id,p_payload->>'kind',amount,p_payload->>'authority_ref',p_payload->>'evidence_sha256') returning id into item;
  result:=jsonb_build_object('adjustment_id',item);
 elsif p_operation='REQUEST_PAYMENT' then
  select * into strict o from missionaccounts_finance_qa.financial_obligation_state where id=(p_payload->>'obligation_id')::uuid and agreement_id=g.id;
  amount:=(p_payload->>'amount_cents')::bigint;
  if amount<=0 or amount>o.remaining_cents then raise exception 'Request exceeds certified obligation';end if;
  item:=nullif(p_payload->>'installment_id','')::uuid;
  if item is not null and not exists(select 1 from missionaccounts_finance_qa.financial_active_schedule a where a.id=item and a.subject_key=p_subject and a.obligation_id=o.id and a.remaining_cents>=amount) then raise exception 'Installment ownership/amount mismatch';end if;
  if item is null and amount>o.remaining_cents-(select coalesce(sum(a.remaining_cents),0) from missionaccounts_finance_qa.financial_active_schedule a where a.obligation_id=o.id) then raise exception 'Choose an active installment; this amount is already scheduled';end if;
  insert into missionaccounts_finance_qa.financial_payment_request(subject_key,obligation_id,installment_id,event_id,amount_cents,description,methods,expires_at)
   values(p_subject,o.id,item,ev,amount,p_payload->>'description',array(select jsonb_array_elements_text(p_payload->'methods')),(p_payload->>'expires_at')::timestamptz) returning id into request;
  result:=jsonb_build_object('request_id',request,'notification_sent',false);
 else raise exception 'Unsupported financial operation';end if;
 insert into missionaccounts_finance_qa.financial_operating_event values(ev,p_subject,p_principal,p_wp_user_id,p_operation,before_value,result,p_request_id,dg,p_payload->>'authority_ref',p_payload->>'evidence_sha256',now());
 insert into missionaccounts_finance_qa.audit_event(actor_id,actor_role,kind,text,from_val,to_val,reason,request_id)
  values(p_principal::text,'founder','mr_financial_operation',p_operation,jsonb_build_object('subject',p_subject),result,p_payload->>'authority_ref',p_request_id);
 return jsonb_build_object('duplicate',false,'event_id',ev,'result',result);
end $$;

do $$ declare t text; f record; begin
 foreach t in array array['financial_operating_gate','financial_runtime_binding','financial_operating_event','financial_onboarding_eligibility','financial_payment_profile','financial_schedule_revision','financial_schedule_installment','financial_schedule_application','financial_payment_request','financial_request_result','financial_card_binding','financial_card_setup','financial_card_method','financial_specific_authorization','financial_card_attempt'] loop
  execute format('alter table missionaccounts_finance_qa.%I enable row level security',t);
  execute format('alter table missionaccounts_finance_qa.%I force row level security',t);
  execute format('revoke all on missionaccounts_finance_qa.%I from public,anon,authenticated,service_role',t);
  execute format('grant select on missionaccounts_finance_qa.%I to service_role',t);
  if t not in ('financial_operating_gate','financial_card_setup','financial_card_attempt') then
   execute format('create trigger %I before update or delete on missionaccounts_finance_qa.%I for each row execute function missionaccounts_finance_qa.reject_immutable_change()',t||'_immutable',t);
  end if;
 end loop;
 for f in select p.oid::regprocedure sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='missionaccounts_finance_qa' and (p.proname in ('financial_guard_runtime_binding','financial_guard_schedule_application','financial_require_founder','financial_own_subject','api_financial_operate','financial_operating_snapshot','api_financial_operating_command','api_financial_student_access','api_financial_own_onboarding','api_save_financial_onboarding')) loop
  execute format('revoke execute on function %s from public,anon,authenticated,service_role',f.sig);
 end loop;
end $$;
revoke all on missionaccounts_finance_qa.financial_active_schedule from public,anon,authenticated,service_role;
grant select on missionaccounts_finance_qa.financial_active_schedule to service_role;
grant execute on function missionaccounts_finance_qa.api_financial_operate(uuid,bigint,text,text,jsonb,text) to service_role;
grant execute on function missionaccounts_finance_qa.api_financial_operating_command(uuid,bigint),missionaccounts_finance_qa.api_financial_student_access(uuid,bigint),missionaccounts_finance_qa.api_financial_own_onboarding(uuid,bigint),missionaccounts_finance_qa.api_save_financial_onboarding(uuid,bigint,jsonb,text) to service_role;


-- Finance source 20261005154928_mission_residency_financial_payment_adapters.sql SHA256 eebc0d7a9816dc77c7237d830fa183327c68d5a914b3b1331a9b22018515e6d7
-- DR-387 source-only adapters. No grants to a new settlement principal or release activation.

alter table missionaccounts_finance_qa.financial_operating_gate add column stripe_account text check(stripe_account ~ '^acct_[A-Za-z0-9]+$');
alter table missionaccounts_finance_qa.financial_operating_gate add column charge_terms_version text;
alter table missionaccounts_finance_qa.financial_card_attempt add column transition_no bigint not null default 0;
create unique index financial_one_reserved_card_request on missionaccounts_finance_qa.financial_card_attempt(request_id)
 where state in ('PREPARED','SUBMITTED','REQUIRES_ACTION','AMBIGUOUS','DECLINED','SUCCEEDED');
create function missionaccounts_finance_qa.financial_actor_subject(p_principal uuid,p_wp_user_id bigint,p_subject text)
returns void language plpgsql security definer set search_path='' as $$
begin
 if p_wp_user_id=1 then perform missionaccounts_finance_qa.financial_require_founder(p_principal,p_wp_user_id);
 elsif missionaccounts_finance_qa.financial_own_subject(p_principal,p_wp_user_id)<>p_subject then raise exception 'Own financial account required' using errcode='42501';end if;
end $$;
create function missionaccounts_finance_qa.financial_append_operation(p_actor uuid,p_wp bigint,p_subject text,p_operation text,p_before jsonb,p_after jsonb,p_request text,p_authority text,p_digest text)
returns uuid language plpgsql security definer set search_path='' as $$
declare e uuid;
begin
 insert into missionaccounts_finance_qa.financial_operating_event(subject_key,actor_id,actor_wp_user_id,operation,before_state,after_state,request_id,request_digest,authority_ref,evidence_sha256)
 values(p_subject,p_actor,p_wp,p_operation,p_before,p_after,p_request,p_digest,p_authority,p_digest) returning id into e;
 insert into missionaccounts_finance_qa.audit_event(actor_id,actor_role,kind,text,from_val,to_val,reason,request_id)
 values(p_actor::text,case when p_wp=1 then 'founder' else 'student' end,'mr_financial_operation',p_operation,p_before,p_after,p_authority,p_request);
 return e;
end $$;
create function missionaccounts_finance_qa.api_financial_setup_context(p_principal uuid,p_wp_user_id bigint,p_request_id text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare k text; b missionaccounts_finance_qa.financial_card_binding; s missionaccounts_finance_qa.financial_card_setup; g missionaccounts_finance_qa.financial_operating_gate; snap jsonb; reservation missionaccounts_finance_qa.financial_operating_event; dg text;
begin
 k:=missionaccounts_finance_qa.financial_own_subject(p_principal,p_wp_user_id);select * into strict g from missionaccounts_finance_qa.financial_operating_gate where id=1;
 if g.stripe_account is null then raise exception 'Mission Residency provider is not approved';end if;
 snap:=missionaccounts_finance_qa.financial_operating_snapshot(k);
 if (snap->'eligibility'->>'card_required')::boolean is distinct from true or (snap->'profile'->>'save_method_acknowledged')::boolean is distinct from true then raise exception 'Payment setup eligibility and acknowledgment required';end if;
 if p_request_id !~ '^[A-Za-z0-9._:-]{8,160}$' then raise exception 'Stable setup identity required';end if;
 perform 1 from missionaccounts_finance_qa.financial_subject where subject_key=k for update;
 dg:=encode(extensions.digest(jsonb_build_array(k,p_request_id)::text,'sha256'),'hex');
 select * into reservation from missionaccounts_finance_qa.financial_operating_event where request_id=p_request_id||':reserved';
 if found then if reservation.subject_key<>k or reservation.request_digest<>dg or reservation.operation<>'PAYMENT_SETUP_RESERVED' then raise exception 'Setup reservation replay conflict';end if;
 else
  perform missionaccounts_finance_qa.financial_append_operation(p_principal,p_wp_user_id,k,'PAYMENT_SETUP_RESERVED','{}','{}',p_request_id||':reserved','DR-387:OWN_SETUP',dg);
  select * into strict reservation from missionaccounts_finance_qa.financial_operating_event where request_id=p_request_id||':reserved';
 end if;
 select * into b from missionaccounts_finance_qa.financial_card_binding where subject_key=k;
 if b.subject_key is not null and b.provider_account<>g.stripe_account then raise exception 'Payment provider account conflict';end if;
 select * into s from missionaccounts_finance_qa.financial_card_setup where request_id=p_request_id;
 if s.id is not null and s.subject_key<>k then raise exception 'Setup identity owner conflict';end if;
 return jsonb_build_object('subject_key',k,'provider_account',g.stripe_account,'binding',to_jsonb(b),'setup',to_jsonb(s),'reserved_at',reservation.created_at);
end $$;
create function missionaccounts_finance_qa.api_financial_register_setup(p_principal uuid,p_wp_user_id bigint,p_request_id text,p_account text,p_customer text,p_intent text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare c jsonb; k text; b missionaccounts_finance_qa.financial_card_binding; s missionaccounts_finance_qa.financial_card_setup; dg text;
begin
 c:=missionaccounts_finance_qa.api_financial_setup_context(p_principal,p_wp_user_id,p_request_id);k:=c->>'subject_key';
 perform 1 from missionaccounts_finance_qa.financial_subject where subject_key=k for update;
 if p_account<>c->>'provider_account' then raise exception 'Provider account mismatch';end if;
 select * into b from missionaccounts_finance_qa.financial_card_binding where subject_key=k;
 if found then if b.provider_account<>p_account or b.customer_ref<>p_customer then raise exception 'Customer binding conflict';end if;
 else insert into missionaccounts_finance_qa.financial_card_binding(subject_key,provider_account,customer_ref) values(k,p_account,p_customer);end if;
 select * into s from missionaccounts_finance_qa.financial_card_setup where request_id=p_request_id;
 if found then if s.subject_key<>k or s.intent_ref<>p_intent then raise exception 'Setup replay conflict';end if;return jsonb_build_object('id',s.id,'duplicate',true);end if;
 insert into missionaccounts_finance_qa.financial_card_setup(subject_key,request_id,intent_ref) values(k,p_request_id,p_intent) returning * into s;
 dg:=encode(extensions.digest(jsonb_build_array(k,p_account,p_customer,p_intent)::text,'sha256'),'hex');
 perform missionaccounts_finance_qa.financial_append_operation(p_principal,p_wp_user_id,k,'PAYMENT_SETUP_STARTED','{}',jsonb_build_object('setup_id',s.id),p_request_id||':registered','DR-387:OWN_SETUP',dg);
 return jsonb_build_object('id',s.id,'duplicate',false);
end $$;
create function missionaccounts_finance_qa.api_financial_confirm_setup(p_principal uuid,p_wp_user_id bigint,p_request_id text,p_proof jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare c jsonb; s missionaccounts_finance_qa.financial_card_setup; m missionaccounts_finance_qa.financial_card_method; dg text;
begin
 c:=missionaccounts_finance_qa.api_financial_setup_context(p_principal,p_wp_user_id,p_request_id);
 select * into strict s from missionaccounts_finance_qa.financial_card_setup where request_id=p_request_id for update;
 if s.subject_key<>c->>'subject_key' or s.intent_ref<>p_proof->>'intent_ref' or p_proof->>'provider_account'<>c->>'provider_account' or p_proof->>'customer_ref'<>c->'binding'->>'customer_ref' then raise exception 'Setup proof owner conflict';end if;
 select * into m from missionaccounts_finance_qa.financial_card_method where setup_id=s.id;
 if found then if m.provider_pm_ref<>p_proof->>'payment_method_ref' then raise exception 'Saved method replay conflict';end if;return jsonb_build_object('id',m.id,'duplicate',true);end if;
 insert into missionaccounts_finance_qa.financial_card_method(subject_key,setup_id,provider_pm_ref,brand,last4,exp_month,exp_year)
 values(s.subject_key,s.id,p_proof->>'payment_method_ref',p_proof->>'brand',p_proof->>'last4',(p_proof->>'exp_month')::integer,(p_proof->>'exp_year')::integer) returning * into m;
 dg:=encode(extensions.digest(p_proof::text,'sha256'),'hex');
 perform missionaccounts_finance_qa.financial_append_operation(p_principal,p_wp_user_id,s.subject_key,'PAYMENT_METHOD_VERIFIED','{}',jsonb_build_object('method_id',m.id,'last4',m.last4),p_request_id||':verified','DR-387:STRIPE_SETUP',dg);
 return jsonb_build_object('id',m.id,'duplicate',false);
end $$;
-- Shared lock order is subject -> agreement -> request. Reservations persist on ambiguous/declined results.
-- A declined intent must be provider-cancelled before its reservation can be released.
create function missionaccounts_finance_qa.financial_payable_request(p_id uuid,p_method text)
returns missionaccounts_finance_qa.financial_payment_request language plpgsql security definer set search_path='' as $$
declare r missionaccounts_finance_qa.financial_payment_request; o missionaccounts_finance_qa.financial_obligation_state; s missionaccounts_finance_qa.financial_subject; st text;
begin
 select * into strict r from missionaccounts_finance_qa.financial_payment_request where id=p_id;
 select * into strict s from missionaccounts_finance_qa.financial_subject where subject_key=r.subject_key for update;
 perform 1 from missionaccounts_finance_qa.financial_agreement where subject_key=s.subject_key for update;
 select * into strict r from missionaccounts_finance_qa.financial_payment_request where id=p_id for update;
 if s.certification_state<>'CERTIFIED' or not(p_method=any(r.methods)) or r.expires_at<=now() then raise exception 'Request is not payable';end if;
 select x.state into st from missionaccounts_finance_qa.financial_request_result x join missionaccounts_finance_qa.financial_operating_event e on e.id=x.event_id where x.request_id=r.id order by e.sequence_no desc limit 1;
 if st is not null then raise exception 'Request is not open';end if;
 select * into strict o from missionaccounts_finance_qa.financial_obligation_state where id=r.obligation_id;
 if r.amount_cents>o.remaining_cents then raise exception 'Payment exceeds certified remaining obligation';end if;
 if r.installment_id is not null and not exists(select 1 from missionaccounts_finance_qa.financial_active_schedule i join missionaccounts_finance_qa.financial_schedule_revision v on v.id=i.revision_id where i.id=r.installment_id and i.remaining_cents>=r.amount_cents and not exists(select 1 from missionaccounts_finance_qa.financial_schedule_revision n where n.supersedes=v.id)) then raise exception 'Payment schedule is superseded or exhausted';end if;
 if r.installment_id is null and r.amount_cents>o.remaining_cents-(select coalesce(sum(i.remaining_cents),0) from missionaccounts_finance_qa.financial_active_schedule i where i.obligation_id=o.id) then raise exception 'Payment must identify its active scheduled installment';end if;
 return r;
end $$;
create function missionaccounts_finance_qa.api_financial_authorize_charge(p_principal uuid,p_wp_user_id bigint,p_request uuid,p_method uuid,p_terms text,p_request_id text,p_confirmed boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare k text; r missionaccounts_finance_qa.financial_payment_request; m missionaccounts_finance_qa.financial_card_method; a missionaccounts_finance_qa.financial_specific_authorization; e uuid; dg text; v text;
begin
 k:=missionaccounts_finance_qa.financial_own_subject(p_principal,p_wp_user_id);
 if p_confirmed is distinct from true or p_request_id !~ '^[A-Za-z0-9._:-]{8,150}$' then raise exception 'Explicit specific charge authorization required';end if;
 r:=missionaccounts_finance_qa.financial_payable_request(p_request,'CARD');
 if r.subject_key<>k then raise exception 'Own payment request required' using errcode='42501';end if;
 if not exists(select 1 from missionaccounts_finance_qa.financial_operating_gate where id=1 and student_publication) then raise exception 'Specific charge authorization is not released' using errcode='42501';end if;
 select charge_terms_version into v from missionaccounts_finance_qa.financial_operating_gate where id=1;
 if v is null or v is distinct from p_terms then raise exception 'Approved current charge terms required';end if;
 select * into strict m from missionaccounts_finance_qa.financial_card_method where id=p_method and subject_key=k;
 if make_date(m.exp_year,m.exp_month,1)+interval '1 month'<=current_date then raise exception 'A current saved payment method is required';end if;
 dg:=encode(extensions.digest(jsonb_build_array(k,p_request,p_method,r.amount_cents,p_terms)::text,'sha256'),'hex');
 select a2.* into a from missionaccounts_finance_qa.financial_specific_authorization a2 join missionaccounts_finance_qa.financial_operating_event e2 on e2.id=a2.event_id where e2.request_id=p_request_id;
 if found then if (select request_digest from missionaccounts_finance_qa.financial_operating_event where id=a.event_id)<>dg then raise exception 'Charge consent replay conflict';end if;return jsonb_build_object('id',a.id,'duplicate',true);end if;
 e:=missionaccounts_finance_qa.financial_append_operation(p_principal,p_wp_user_id,k,'AUTHORIZE_SPECIFIC_CHARGE','{}',jsonb_build_object('request_id',r.id,'amount_cents',r.amount_cents,'method_id',m.id,'terms_version',v),p_request_id,'DR-387:SPECIFIC_CHARGE',dg);
 insert into missionaccounts_finance_qa.financial_specific_authorization(request_id,subject_key,method_id,amount_cents,terms_version,event_id,expires_at)
 values(r.id,k,m.id,r.amount_cents,v,e,clock_timestamp()+interval '30 days') returning * into a;
 return jsonb_build_object('id',a.id,'duplicate',false);
end $$;
create function missionaccounts_finance_qa.api_financial_prepare_card(p_principal uuid,p_wp_user_id bigint,p_request uuid,p_request_id text,p_account text,p_authorization uuid,p_confirmed boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r missionaccounts_finance_qa.financial_payment_request; a missionaccounts_finance_qa.financial_card_attempt; b missionaccounts_finance_qa.financial_card_binding; c missionaccounts_finance_qa.financial_specific_authorization; m missionaccounts_finance_qa.financial_card_method; reserved bigint; residual bigint; dg text; e uuid;
begin
 if p_wp_user_id<=0 then raise exception 'A signed student or Founder initiator is required' using errcode='42501';end if;
 if p_request_id !~ '^[A-Za-z0-9._:-]{8,150}$' or p_confirmed is distinct from true then raise exception 'Confirmed stable payment request required';end if;
 select * into strict r from missionaccounts_finance_qa.financial_payment_request where id=p_request;
 perform missionaccounts_finance_qa.financial_actor_subject(p_principal,p_wp_user_id,r.subject_key);
 if not exists(select 1 from missionaccounts_finance_qa.financial_operating_gate where id=1 and card_dispatch and stripe_account=p_account) then raise exception 'Card dispatch is disabled' using errcode='42501';end if;
 if p_wp_user_id<>1 and not exists(select 1 from missionaccounts_finance_qa.financial_operating_gate where id=1 and student_publication) then raise exception 'Student financial publication disabled' using errcode='42501';end if;
 dg:=encode(extensions.digest(jsonb_build_array(p_principal,p_wp_user_id,p_request,p_account,p_authorization)::text,'sha256'),'hex');
 perform pg_advisory_xact_lock(hashtextextended('mr-card-attempt:'||p_request_id,0));
 select * into a from missionaccounts_finance_qa.financial_card_attempt where request_identity=p_request_id;
 if found then if a.request_digest<>dg then raise exception 'Card attempt identity conflict';end if;
  if a.intent_ref is null then
   r:=missionaccounts_finance_qa.financial_payable_request(p_request,'CARD');
   if a.authorization_id is not null and not exists(select 1 from missionaccounts_finance_qa.financial_specific_authorization c2 join missionaccounts_finance_qa.financial_operating_gate g2 on g2.id=1 where c2.id=a.authorization_id and c2.expires_at>now() and c2.terms_version=g2.charge_terms_version and exists(select 1 from missionaccounts_finance_qa.financial_card_method m2 where m2.id=c2.method_id and make_date(m2.exp_year,m2.exp_month,1)+interval '1 month'>current_date)) then raise exception 'Specific charge authorization expired';end if;
   select remaining_cents into strict residual from missionaccounts_finance_qa.financial_obligation_state where id=r.obligation_id;
   select coalesce(sum(x.amount_cents),0) into reserved from missionaccounts_finance_qa.financial_card_attempt x join missionaccounts_finance_qa.financial_payment_request q on q.id=x.request_id where q.obligation_id=r.obligation_id and x.id<>a.id and x.state in ('PREPARED','SUBMITTED','REQUIRES_ACTION','AMBIGUOUS','DECLINED');
   if a.amount_cents+reserved>residual then raise exception 'Reserved payment no longer collectible';end if;
   if r.installment_id is null and a.amount_cents+(select coalesce(sum(x.amount_cents),0) from missionaccounts_finance_qa.financial_card_attempt x join missionaccounts_finance_qa.financial_payment_request q on q.id=x.request_id where q.obligation_id=r.obligation_id and q.installment_id is null and x.id<>a.id and x.state in ('PREPARED','SUBMITTED','REQUIRES_ACTION','AMBIGUOUS','DECLINED'))>residual-(select coalesce(sum(i.remaining_cents),0) from missionaccounts_finance_qa.financial_active_schedule i where i.obligation_id=r.obligation_id) then raise exception 'Unscheduled residual is reserved by another payment';end if;
   if r.installment_id is not null and a.amount_cents+(select coalesce(sum(x.amount_cents),0) from missionaccounts_finance_qa.financial_card_attempt x join missionaccounts_finance_qa.financial_payment_request q on q.id=x.request_id where q.installment_id=r.installment_id and x.id<>a.id and x.state in ('PREPARED','SUBMITTED','REQUIRES_ACTION','AMBIGUOUS','DECLINED'))>(select remaining_cents from missionaccounts_finance_qa.financial_active_schedule where id=r.installment_id) then raise exception 'Installment is reserved by another payment';end if;
  end if;
  select * into strict b from missionaccounts_finance_qa.financial_card_binding where subject_key=a.subject_key;
  select * into m from missionaccounts_finance_qa.financial_card_method where id=(select method_id from missionaccounts_finance_qa.financial_specific_authorization where id=a.authorization_id);
  return to_jsonb(a)||jsonb_build_object('customer_ref',b.customer_ref,'payment_method_ref',m.provider_pm_ref,'duplicate',true);end if;
 r:=missionaccounts_finance_qa.financial_payable_request(p_request,'CARD');
 select coalesce(sum(x.amount_cents),0) into reserved from missionaccounts_finance_qa.financial_card_attempt x join missionaccounts_finance_qa.financial_payment_request q on q.id=x.request_id where q.obligation_id=r.obligation_id and x.state in ('PREPARED','SUBMITTED','REQUIRES_ACTION','AMBIGUOUS','DECLINED');
 select remaining_cents into strict residual from missionaccounts_finance_qa.financial_obligation_state where id=r.obligation_id;
 if r.amount_cents+reserved>residual then raise exception 'Remaining obligation is reserved by another payment attempt';end if;
 if r.installment_id is null and r.amount_cents+(select coalesce(sum(x.amount_cents),0) from missionaccounts_finance_qa.financial_card_attempt x join missionaccounts_finance_qa.financial_payment_request q on q.id=x.request_id where q.obligation_id=r.obligation_id and q.installment_id is null and x.state in ('PREPARED','SUBMITTED','REQUIRES_ACTION','AMBIGUOUS','DECLINED'))>residual-(select coalesce(sum(i.remaining_cents),0) from missionaccounts_finance_qa.financial_active_schedule i where i.obligation_id=r.obligation_id) then raise exception 'Unscheduled residual is reserved by another payment';end if;
 if r.installment_id is not null and r.amount_cents+(select coalesce(sum(x.amount_cents),0) from missionaccounts_finance_qa.financial_card_attempt x join missionaccounts_finance_qa.financial_payment_request q on q.id=x.request_id where q.installment_id=r.installment_id and x.state in ('PREPARED','SUBMITTED','REQUIRES_ACTION','AMBIGUOUS','DECLINED'))>(select remaining_cents from missionaccounts_finance_qa.financial_active_schedule where id=r.installment_id) then raise exception 'Installment is reserved by another payment';end if;
 select * into strict b from missionaccounts_finance_qa.financial_card_binding where subject_key=r.subject_key and provider_account=p_account;
 if p_wp_user_id=1 then
  select * into strict c from missionaccounts_finance_qa.financial_specific_authorization where id=p_authorization and request_id=r.id and subject_key=r.subject_key and amount_cents=r.amount_cents and expires_at>now();
  if c.terms_version is distinct from (select charge_terms_version from missionaccounts_finance_qa.financial_operating_gate where id=1) then raise exception 'Charge authorization terms expired';end if;
  select * into strict m from missionaccounts_finance_qa.financial_card_method where id=c.method_id and subject_key=r.subject_key;
  if make_date(m.exp_year,m.exp_month,1)+interval '1 month'<=current_date then raise exception 'Authorized saved card has expired';end if;
 elsif p_authorization is not null then raise exception 'Student pay-now cannot use Founder charge authority';end if;
 insert into missionaccounts_finance_qa.financial_card_attempt(request_id,subject_key,amount_cents,provider_account,state,request_identity,request_digest,actor_id,authorization_id)
 values(r.id,r.subject_key,r.amount_cents,p_account,'PREPARED',p_request_id,dg,p_principal,p_authorization) returning * into a;
 e:=missionaccounts_finance_qa.financial_append_operation(p_principal,p_wp_user_id,r.subject_key,'CARD_ATTEMPT_PREPARED','{}',jsonb_build_object('attempt_id',a.id,'request_id',r.id,'amount_cents',r.amount_cents),p_request_id||':prepared','DR-387:CARD_REQUEST',dg);
 return to_jsonb(a)||jsonb_build_object('customer_ref',b.customer_ref,'payment_method_ref',m.provider_pm_ref,'duplicate',false);
end $$;
create function missionaccounts_finance_qa.api_financial_card_result(p_principal uuid,p_wp_user_id bigint,p_attempt uuid,p_intent text,p_state text,p_payment jsonb,p_settlement_actor text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare a missionaccounts_finance_qa.financial_card_attempt; r missionaccounts_finance_qa.financial_payment_request; g missionaccounts_finance_qa.financial_agreement; o missionaccounts_finance_qa.financial_obligation; paid jsonb; application uuid; ev uuid; dg text; artifact uuid; receipt_sha text;
begin
 select * into strict a from missionaccounts_finance_qa.financial_card_attempt where id=p_attempt;
 perform missionaccounts_finance_qa.financial_actor_subject(p_principal,p_wp_user_id,a.subject_key);
 perform 1 from missionaccounts_finance_qa.financial_subject where subject_key=a.subject_key for update;
 select * into strict g from missionaccounts_finance_qa.financial_agreement where subject_key=a.subject_key for update;
 select * into strict a from missionaccounts_finance_qa.financial_card_attempt where id=p_attempt for update;
 -- An authenticated beneficiary may complete SCA/reconcile a Founder-initiated attempt.
 -- The service verifies the exact existing provider intent and authorized method before settlement.
 if p_state not in ('SUBMITTED','REQUIRES_ACTION','DECLINED','AMBIGUOUS','SUCCEEDED','CANCELLED') or p_intent is null and p_state<>'AMBIGUOUS' then raise exception 'Invalid provider result';end if;
 if a.intent_ref is not null and a.intent_ref is distinct from p_intent then raise exception 'PaymentIntent replay conflict';end if;
 if a.state='SUCCEEDED' then return jsonb_build_object('state','SUCCEEDED','payment_id',a.payment_id,'duplicate',true);end if;
 if a.state='CANCELLED' then return jsonb_build_object('state','CANCELLED','duplicate',true);end if;
 if not exists(select 1 from missionaccounts_finance_qa.financial_operating_gate where id=1 and stripe_account=a.provider_account) then raise exception 'Provider account conflict';end if;
 select * into strict r from missionaccounts_finance_qa.financial_payment_request where id=a.request_id;
 select * into strict o from missionaccounts_finance_qa.financial_obligation where id=r.obligation_id;
 dg:=encode(extensions.digest(jsonb_build_array(p_attempt,p_intent,p_state,p_payment)::text,'sha256'),'hex');
 if p_state='SUCCEEDED' then
  if p_payment->>'provider' is distinct from 'Stripe' or p_payment->>'provider_account' is distinct from a.provider_account or p_payment->>'provider_identity' is distinct from p_intent or p_payment->>'subject_key' is distinct from a.subject_key or (p_payment->>'gross_cents')::bigint is distinct from a.amount_cents then raise exception 'Verified receipt owner or amount conflict';end if;
  receipt_sha:=encode(extensions.digest(p_payment::text,'sha256'),'hex');
  insert into missionaccounts_finance_qa.source_artifact(source_kind,source_path,sha256,byte_count,observed_at)
   values('mr_stripe_receipt','stripe:'||a.provider_account||':'||p_intent,receipt_sha,octet_length(p_payment::text),clock_timestamp()) returning id into artifact;
  paid:=missionaccounts_finance_qa.api_record_verified_financial_payment(p_settlement_actor,p_payment||jsonb_build_object('artifact_id',artifact,'agreement_version',g.version,'applications',jsonb_build_array(jsonb_build_object('obligation_key',o.obligation_key,'component',o.component,'amount_cents',a.amount_cents))));
  if r.installment_id is not null then
   select id into strict application from missionaccounts_finance_qa.financial_payment_application where payment_id=(paid->>'payment_id')::uuid and obligation_id=o.id;
   insert into missionaccounts_finance_qa.financial_schedule_application values(r.installment_id,application,a.amount_cents);
  end if;
  ev:=missionaccounts_finance_qa.financial_append_operation(p_principal,p_wp_user_id,a.subject_key,'CARD_PAYMENT_SETTLED',jsonb_build_object('state',a.state),jsonb_build_object('state',p_state,'payment_id',paid->>'payment_id','amount_cents',a.amount_cents),a.request_identity||':settled','DR-387:STRIPE_VERIFIED',dg);
  insert into missionaccounts_finance_qa.financial_request_result values(r.id,ev,'SETTLED',(paid->>'payment_id')::uuid);
 else
  if a.intent_ref is not distinct from p_intent and a.state=p_state then return jsonb_build_object('state',p_state,'duplicate',true);end if;
  perform missionaccounts_finance_qa.financial_append_operation(p_principal,p_wp_user_id,a.subject_key,'CARD_'||p_state,jsonb_build_object('state',a.state),jsonb_build_object('state',p_state,'attempt_id',a.id),a.request_identity||':transition:'||(a.transition_no+1)::text,'DR-387:STRIPE_RESULT',dg);
 end if;
 update missionaccounts_finance_qa.financial_card_attempt set transition_no=transition_no+1,state=p_state,intent_ref=p_intent,payment_id=case when paid is not null then (paid->>'payment_id')::uuid else payment_id end,updated_at=clock_timestamp() where id=a.id;
 return jsonb_build_object('state',p_state,'payment_id',paid->>'payment_id','duplicate',false);
end $$;
create function missionaccounts_finance_qa.api_financial_card_attempt(p_principal uuid,p_wp_user_id bigint,p_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare a missionaccounts_finance_qa.financial_card_attempt; b missionaccounts_finance_qa.financial_card_binding;
begin
 select * into strict a from missionaccounts_finance_qa.financial_card_attempt where id=p_id;
 perform missionaccounts_finance_qa.financial_actor_subject(p_principal,p_wp_user_id,a.subject_key);
 select * into strict b from missionaccounts_finance_qa.financial_card_binding where subject_key=a.subject_key;
 return to_jsonb(a)||jsonb_build_object('customer_ref',b.customer_ref,'payment_method_ref',(select m.provider_pm_ref from missionaccounts_finance_qa.financial_specific_authorization c join missionaccounts_finance_qa.financial_card_method m on m.id=c.method_id where c.id=a.authorization_id));
end $$;
-- Student-reported Zelle is never a receipt or settlement.
create function missionaccounts_finance_qa.api_financial_report_zelle(p_principal uuid,p_wp_user_id bigint,p_request uuid,p_request_id text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare k text; r missionaccounts_finance_qa.financial_payment_request; dg text; ev uuid;
begin
 k:=missionaccounts_finance_qa.financial_own_subject(p_principal,p_wp_user_id);
 if not exists(select 1 from missionaccounts_finance_qa.financial_operating_gate where id=1 and student_publication) then raise exception 'Financial publication disabled' using errcode='42501';end if;
 if p_request_id !~ '^[A-Za-z0-9._:-]{8,150}$' then raise exception 'Stable claim identity required';end if;
 select e.id into ev from missionaccounts_finance_qa.financial_operating_event e where e.request_id=p_request_id and e.subject_key=k and e.operation='ZELLE_PAYMENT_REPORTED' and e.after_state->>'request_id'=p_request::text;
 if found then return jsonb_build_object('state','AWAITING_CONFIRMATION','duplicate',true);end if;
 r:=missionaccounts_finance_qa.financial_payable_request(p_request,'ZELLE');
 if r.subject_key<>k then raise exception 'Own request required' using errcode='42501';end if;
 if exists(select 1 from missionaccounts_finance_qa.financial_card_attempt x where x.request_id=r.id and x.state in ('PREPARED','SUBMITTED','REQUIRES_ACTION','AMBIGUOUS','DECLINED')) then raise exception 'Card result must be reconciled before Zelle claim';end if;
 dg:=encode(extensions.digest(jsonb_build_array(k,p_request)::text,'sha256'),'hex');
 ev:=missionaccounts_finance_qa.financial_append_operation(p_principal,p_wp_user_id,k,'ZELLE_PAYMENT_REPORTED','{}',jsonb_build_object('request_id',r.id,'state','AWAITING_CONFIRMATION'),p_request_id,'DR-387:OWN_CLAIM',dg);
 insert into missionaccounts_finance_qa.financial_request_result values(r.id,ev,'REPORTED',null);
 return jsonb_build_object('state','AWAITING_CONFIRMATION','duplicate',false);
end $$;
-- Own projection derives safe data only. It never returns private cases, payer contacts or evidence paths.
create function missionaccounts_finance_qa.financial_operational_due(p_subject text)
returns jsonb language sql stable security definer set search_path='' as $$
 with parent as (
  select o.* from missionaccounts_finance_qa.financial_obligation_state o join missionaccounts_finance_qa.financial_agreement g on g.id=o.agreement_id where g.subject_key=p_subject
 ), dates as (
  select i.remaining_cents,i.due_on from missionaccounts_finance_qa.financial_active_schedule i where i.subject_key=p_subject and i.remaining_cents>0
  union all
  select greatest(o.remaining_cents-coalesce((select sum(i.remaining_cents) from missionaccounts_finance_qa.financial_active_schedule i where i.obligation_id=o.id),0),0),o.due_on from parent o
 ), totals as (
  select coalesce(sum(remaining_cents) filter(where due_on<=current_date),0) due,
   coalesce(sum(remaining_cents) filter(where due_on<current_date),0) overdue,
   coalesce(sum(remaining_cents) filter(where due_on is null),0) unknown,
   min(due_on) filter(where remaining_cents>0 and due_on>current_date) next_date from dates where remaining_cents>0
 ) select jsonb_build_object('currently_due_cents',case when unknown=0 then due else null end,'known_due_cents',due,
  'overdue_cents',case when unknown=0 then overdue else null end,'unknown_date_cents',unknown,'next_due_on',next_date,
  'next_amount_cents',(select coalesce(sum(d.remaining_cents),0) from dates d where d.due_on=t.next_date)) from totals t
$$;
create or replace function missionaccounts_finance_qa.api_financial_operating_command(p_principal uuid,p_wp_user_id bigint)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 perform missionaccounts_finance_qa.financial_require_founder(p_principal,p_wp_user_id);
 return jsonb_build_object('gates',(select to_jsonb(g)-'id' from missionaccounts_finance_qa.financial_operating_gate g where id=1),
  'accounts',(select coalesce(jsonb_agg(missionaccounts_finance_qa.financial_operating_snapshot(subject_key)||
   jsonb_build_object('operational_due',case when certification_state='CERTIFIED' then missionaccounts_finance_qa.financial_operational_due(subject_key) else null end) order by subject_key),'[]'::jsonb) from missionaccounts_finance_qa.financial_subject));
end $$;
create function missionaccounts_finance_qa.api_financial_own_account(p_principal uuid,p_wp_user_id bigint)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare k text; s missionaccounts_finance_qa.financial_subject; g missionaccounts_finance_qa.financial_agreement;
begin
 k:=missionaccounts_finance_qa.financial_own_subject(p_principal,p_wp_user_id);
 if not exists(select 1 from missionaccounts_finance_qa.financial_operating_gate where id=1 and student_publication) then raise exception 'Student financial publication disabled' using errcode='42501';end if;
 select * into strict s from missionaccounts_finance_qa.financial_subject where subject_key=k;
 if s.certification_state='HELD' then return jsonb_build_object('state','ACCOUNT_REVIEW','program','Mission Residency','payments','[]'::jsonb,'requests','[]'::jsonb,'balance',null);end if;
 select * into strict g from missionaccounts_finance_qa.financial_agreement where subject_key=k;
 return jsonb_build_object('state',case when (select balance_cents from missionaccounts_finance_qa.financial_balance where subject_key=k)=0 then 'PAID_IN_FULL' else 'BALANCE_REMAINING' end,'program',g.program,
  'authorization_terms_version',(select charge_terms_version from missionaccounts_finance_qa.financial_operating_gate where id=1),
  'attempts',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'request_id',a.request_id,'state',a.state)) from missionaccounts_finance_qa.financial_card_attempt a where a.subject_key=k),'[]'::jsonb),
  'agreement',jsonb_build_object('tuition_cents',g.accepted_tuition_cents,'fees_cents',g.accepted_fees_cents,'plan',g.plan),
  'balance',(select to_jsonb(b)-'subject_key'-'agreement_id' from missionaccounts_finance_qa.financial_balance b where b.subject_key=k),
  'operational_due',missionaccounts_finance_qa.financial_operational_due(k),
  'credit_cents',(select coalesce(sum(credit_cents),0) from missionaccounts_finance_qa.financial_unapplied_credit where subject_key=k),
  'schedule',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'amount_cents',i.amount_cents,'applied_cents',i.applied_cents,'remaining_cents',i.remaining_cents,'due_on',i.due_on,'due_precision',i.due_precision) order by i.due_on nulls last,i.id) from missionaccounts_finance_qa.financial_active_schedule i where i.subject_key=k),'[]'::jsonb),
  'payments',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'amount_cents',p.gross_cents,'method',p.method,'date',p.received_at,'receipt_available',p.verification_state='VERIFIED') order by p.received_at,p.id) from missionaccounts_finance_qa.financial_payment p where p.subject_key=k),'[]'::jsonb),
  'requests',coalesce((select jsonb_agg(jsonb_build_object('id',q.id,'amount_cents',q.amount_cents,'description',q.description,'methods',q.methods,'expires_at',q.expires_at,'state',coalesce((select rr.state from missionaccounts_finance_qa.financial_request_result rr join missionaccounts_finance_qa.financial_operating_event e on e.id=rr.event_id where rr.request_id=q.id order by e.sequence_no desc limit 1),'OPEN')) order by q.created_at,q.id) from missionaccounts_finance_qa.financial_payment_request q where q.subject_key=k),'[]'::jsonb));
end $$;
-- The existing Chase authenticity/global-claim adapter must verify proof before this RPC.
-- A browser claim cannot invoke it, supply raw evidence, or override deterministic matching.
create table missionaccounts_finance_qa.financial_zelle_review (
 fingerprint text primary key check(fingerprint ~ '^[a-f0-9]{64}$'),
 chase_reference text not null unique check(chase_reference ~ '^[0-9]+$'),
 amount_cents bigint not null check(amount_cents>0), payer text not null,
 reason text not null, evidence_sha256 text not null check(evidence_sha256 ~ '^[a-f0-9]{64}$'),
 created_at timestamptz not null default clock_timestamp()
);
alter table missionaccounts_finance_qa.financial_zelle_review enable row level security;
alter table missionaccounts_finance_qa.financial_zelle_review force row level security;
revoke all on missionaccounts_finance_qa.financial_zelle_review from public,anon,authenticated,service_role;
grant select on missionaccounts_finance_qa.financial_zelle_review to service_role;
create trigger financial_zelle_review_immutable before update or delete on missionaccounts_finance_qa.financial_zelle_review for each row execute function missionaccounts_finance_qa.reject_immutable_change();
create function missionaccounts_finance_qa.api_financial_reconcile_chase(p_principal uuid,p_wp_user_id bigint,p_settlement_actor text,p_receipt jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r missionaccounts_finance_qa.financial_payment_request; g missionaccounts_finance_qa.financial_agreement; o missionaccounts_finance_qa.financial_obligation; n integer; paid jsonb; artifact uuid; ev uuid; dg text; application uuid; existing missionaccounts_finance_qa.financial_payment;
begin
 perform missionaccounts_finance_qa.financial_require_founder(p_principal,p_wp_user_id);
 perform missionaccounts_finance_qa.financial_require_principal(p_settlement_actor,'settle');
 if not exists(select 1 from missionaccounts_finance_qa.financial_operating_gate where id=1 and zelle_matcher) then raise exception 'Chase reconciliation adapter is not released' using errcode='42501';end if;
 if p_receipt->'authenticity_verified' is distinct from 'true'::jsonb or p_receipt->'global_claim_verified' is distinct from 'true'::jsonb or p_receipt->'commerce_consumed' is distinct from 'false'::jsonb or coalesce(p_receipt->>'reference','') !~ '^[0-9]+$' or coalesce(p_receipt->>'fingerprint','') !~ '^[a-f0-9]{64}$' or (p_receipt->>'amount_cents')::bigint<=0 then raise exception 'Authenticated unconsumed Chase proof required';end if;
 dg:=encode(extensions.digest(p_receipt::text,'sha256'),'hex');
 perform pg_advisory_xact_lock(hashtextextended('financial-payment:Chase:'||(p_receipt->>'reference'),0));
 select * into existing from missionaccounts_finance_qa.financial_payment where provider='Chase' and provider_identity=p_receipt->>'reference';
 if found then
  if existing.request_id<>'mr-chase:'||(p_receipt->>'fingerprint') then raise exception 'Chase evidence belongs to an existing payment';end if;
  if not exists(select 1 from missionaccounts_finance_qa.financial_operating_event e where e.request_id=existing.request_id and e.request_digest=dg and e.operation='CHASE_PAYMENT_SETTLED') then raise exception 'Chase proof replay conflict';end if;
  return jsonb_build_object('state','SETTLED','payment_id',existing.id,'duplicate',true);
 end if;
 -- Serialize requests and competing card reservations across the bounded population.
 perform 1 from missionaccounts_finance_qa.financial_subject order by subject_key for update;
 perform 1 from missionaccounts_finance_qa.financial_agreement order by subject_key for update;
 select count(*) into n from missionaccounts_finance_qa.financial_payment_request q join missionaccounts_finance_qa.financial_subject s on s.subject_key=q.subject_key
 join missionaccounts_finance_qa.financial_obligation_state os on os.id=q.obligation_id
 where s.certification_state='CERTIFIED' and 'ZELLE'=any(q.methods) and q.amount_cents=(p_receipt->>'amount_cents')::bigint and q.amount_cents<=os.remaining_cents and (q.expires_at is null or q.expires_at>now())
 and coalesce((select rr.state from missionaccounts_finance_qa.financial_request_result rr join missionaccounts_finance_qa.financial_operating_event e on e.id=rr.event_id where rr.request_id=q.id order by e.sequence_no desc limit 1),'OPEN') in ('OPEN','REPORTED')
 and exists(select 1 from missionaccounts_finance_qa.financial_payer_alias a where a.subject_key=q.subject_key and lower(regexp_replace(trim(a.payer),'[[:space:]]+',' ','g'))=lower(regexp_replace(trim(p_receipt->>'payer'),'[[:space:]]+',' ','g')))
 and (q.installment_id is null or exists(select 1 from missionaccounts_finance_qa.financial_active_schedule i join missionaccounts_finance_qa.financial_schedule_revision v on v.id=i.revision_id where i.id=q.installment_id and i.remaining_cents>=q.amount_cents and not exists(select 1 from missionaccounts_finance_qa.financial_schedule_revision sn where sn.supersedes=v.id)))
 and (q.installment_id is not null or q.amount_cents<=os.remaining_cents-(select coalesce(sum(i.remaining_cents),0) from missionaccounts_finance_qa.financial_active_schedule i where i.obligation_id=q.obligation_id))
 and not exists(select 1 from missionaccounts_finance_qa.financial_card_attempt a join missionaccounts_finance_qa.financial_payment_request cr on cr.id=a.request_id where cr.obligation_id=q.obligation_id and a.state in ('PREPARED','SUBMITTED','REQUIRES_ACTION','AMBIGUOUS','DECLINED'));
 if n<>1 then
  insert into missionaccounts_finance_qa.financial_zelle_review values(p_receipt->>'fingerprint',p_receipt->>'reference',(p_receipt->>'amount_cents')::bigint,p_receipt->>'payer',case when n=0 then 'NO_UNIQUE_ELIGIBLE_OBLIGATION' else 'MULTIPLE_MATCHES' end,dg,clock_timestamp()) on conflict do nothing;
  return jsonb_build_object('state','REVIEW_REQUIRED','candidate_count',n);
 end if;
 select q.* into strict r from missionaccounts_finance_qa.financial_payment_request q join missionaccounts_finance_qa.financial_subject s on s.subject_key=q.subject_key
 join missionaccounts_finance_qa.financial_obligation_state os on os.id=q.obligation_id
 where s.certification_state='CERTIFIED' and 'ZELLE'=any(q.methods) and q.amount_cents=(p_receipt->>'amount_cents')::bigint and q.amount_cents<=os.remaining_cents and (q.expires_at is null or q.expires_at>now())
 and coalesce((select rr.state from missionaccounts_finance_qa.financial_request_result rr join missionaccounts_finance_qa.financial_operating_event e on e.id=rr.event_id where rr.request_id=q.id order by e.sequence_no desc limit 1),'OPEN') in ('OPEN','REPORTED')
 and exists(select 1 from missionaccounts_finance_qa.financial_payer_alias a where a.subject_key=q.subject_key and lower(regexp_replace(trim(a.payer),'[[:space:]]+',' ','g'))=lower(regexp_replace(trim(p_receipt->>'payer'),'[[:space:]]+',' ','g')))
 and (q.installment_id is null or exists(select 1 from missionaccounts_finance_qa.financial_active_schedule i join missionaccounts_finance_qa.financial_schedule_revision v on v.id=i.revision_id where i.id=q.installment_id and i.remaining_cents>=q.amount_cents and not exists(select 1 from missionaccounts_finance_qa.financial_schedule_revision sn where sn.supersedes=v.id)))
 and (q.installment_id is not null or q.amount_cents<=os.remaining_cents-(select coalesce(sum(i.remaining_cents),0) from missionaccounts_finance_qa.financial_active_schedule i where i.obligation_id=q.obligation_id))
 and not exists(select 1 from missionaccounts_finance_qa.financial_card_attempt a join missionaccounts_finance_qa.financial_payment_request cr on cr.id=a.request_id where cr.obligation_id=q.obligation_id and a.state in ('PREPARED','SUBMITTED','REQUIRES_ACTION','AMBIGUOUS','DECLINED'));
 select * into strict g from missionaccounts_finance_qa.financial_agreement where subject_key=r.subject_key;
 select * into strict o from missionaccounts_finance_qa.financial_obligation where id=r.obligation_id;
 insert into missionaccounts_finance_qa.source_artifact(source_kind,source_path,sha256,byte_count,observed_at) values('mr_chase_receipt','chase:'||(p_receipt->>'reference'),dg,octet_length(p_receipt::text),clock_timestamp()) returning id into artifact;
 paid:=missionaccounts_finance_qa.api_record_verified_financial_payment(p_settlement_actor,jsonb_build_object('subject_key',r.subject_key,'agreement_version',g.version,'provider','Chase','provider_account',p_receipt->>'provider_account','provider_identity',p_receipt->>'reference','method','ZELLE','gross_cents',(p_receipt->>'amount_cents')::bigint,'payer',p_receipt->>'payer','received_at',p_receipt->>'received_at','received_precision','EXACT','verification_state','VERIFIED','request_id','mr-chase:'||(p_receipt->>'fingerprint'),'artifact_id',artifact,'evidence',jsonb_build_array(jsonb_build_object('type','CHASE_REFERENCE','reference',p_receipt->>'reference','fingerprint',p_receipt->>'fingerprint','metadata',jsonb_build_object('authenticity_verified',true))),'applications',jsonb_build_array(jsonb_build_object('obligation_key',o.obligation_key,'component',o.component,'amount_cents',r.amount_cents))));
 if r.installment_id is not null then
  select id into strict application from missionaccounts_finance_qa.financial_payment_application where payment_id=(paid->>'payment_id')::uuid and obligation_id=o.id;
  insert into missionaccounts_finance_qa.financial_schedule_application values(r.installment_id,application,r.amount_cents);
 end if;
 ev:=missionaccounts_finance_qa.financial_append_operation(p_principal,p_wp_user_id,r.subject_key,'CHASE_PAYMENT_SETTLED','{}',jsonb_build_object('request_id',r.id,'payment_id',paid->>'payment_id','amount_cents',r.amount_cents),'mr-chase:'||(p_receipt->>'fingerprint'),'DR-387:CHASE_VERIFIED',dg);
 insert into missionaccounts_finance_qa.financial_request_result values(r.id,ev,'SETTLED',(paid->>'payment_id')::uuid);
 return jsonb_build_object('state','SETTLED','payment_id',paid->>'payment_id','duplicate',false);
end $$;
-- Only server service-role may invoke the identity-checked adapters; private helpers are not RPCs.
do $$ declare f record; begin
 for f in select p.oid::regprocedure sig,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='missionaccounts_finance_qa' and p.proname in ('financial_operational_due','financial_actor_subject','financial_append_operation','financial_payable_request','api_financial_setup_context','api_financial_register_setup','api_financial_confirm_setup','api_financial_authorize_charge','api_financial_prepare_card','api_financial_card_result','api_financial_card_attempt','api_financial_report_zelle','api_financial_own_account','api_financial_reconcile_chase') loop
  execute format('revoke execute on function %s from public,anon,authenticated,service_role',f.sig);
  if f.proname like 'api_%' then execute format('grant execute on function %s to service_role',f.sig);end if;
 end loop;
end $$;


-- Finance source 20261005170049_mission_residency_financial_provider_events.sql SHA256 12cfbe4f624bc12966f8f99a79fe4e8187aab0572c1614cb5ae6047fd7f37fca
-- DR-387 source only. Empty provider binding means webhooks fail closed until separately released.

create table missionaccounts_finance_qa.financial_provider_binding (
 actor_id uuid primary key, actor_name text not null unique references missionaccounts_finance_qa.financial_principal(actor_id),
 authority_ref text not null, evidence_sha256 text not null check(evidence_sha256 ~ '^[a-f0-9]{64}$')
);
alter table missionaccounts_finance_qa.financial_provider_binding enable row level security;
alter table missionaccounts_finance_qa.financial_provider_binding force row level security;
revoke all on missionaccounts_finance_qa.financial_provider_binding from public,anon,authenticated,service_role;
create trigger financial_provider_binding_immutable before update or delete on missionaccounts_finance_qa.financial_provider_binding for each row execute function missionaccounts_finance_qa.reject_immutable_change();
create function missionaccounts_finance_qa.financial_provider_actor(p_actor text)
returns uuid language plpgsql stable security definer set search_path='' as $$
declare a uuid;
begin
 perform missionaccounts_finance_qa.financial_require_principal(p_actor,'settle');
 select actor_id into strict a from missionaccounts_finance_qa.financial_provider_binding where actor_name=p_actor;
 return a;
end $$;
create or replace function missionaccounts_finance_qa.financial_actor_subject(p_principal uuid,p_wp_user_id bigint,p_subject text)
returns void language plpgsql security definer set search_path='' as $$
declare name text;
begin
 if p_wp_user_id=0 then
  select actor_name into strict name from missionaccounts_finance_qa.financial_provider_binding where actor_id=p_principal;
  perform missionaccounts_finance_qa.financial_require_principal(name,'settle');
 elsif p_wp_user_id=1 then perform missionaccounts_finance_qa.financial_require_founder(p_principal,p_wp_user_id);
 elsif missionaccounts_finance_qa.financial_own_subject(p_principal,p_wp_user_id)<>p_subject then raise exception 'Own financial account required' using errcode='42501';end if;
end $$;
create or replace function missionaccounts_finance_qa.financial_append_operation(p_actor uuid,p_wp bigint,p_subject text,p_operation text,p_before jsonb,p_after jsonb,p_request text,p_authority text,p_digest text)
returns uuid language plpgsql security definer set search_path='' as $$
declare e uuid;
begin
 insert into missionaccounts_finance_qa.financial_operating_event(subject_key,actor_id,actor_wp_user_id,operation,before_state,after_state,request_id,request_digest,authority_ref,evidence_sha256)
 values(p_subject,p_actor,p_wp,p_operation,p_before,p_after,p_request,p_digest,p_authority,p_digest) returning id into e;
 insert into missionaccounts_finance_qa.audit_event(actor_id,actor_role,kind,text,from_val,to_val,reason,request_id)
 values(p_actor::text,case when p_wp=0 then 'provider' when p_wp=1 then 'founder' else 'student' end,'mr_financial_operation',p_operation,p_before,p_after,p_authority,p_request);
 return e;
end $$;
create function missionaccounts_finance_qa.api_financial_provider_context(p_actor text,p_kind text,p_reference text,p_request_id text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid; a missionaccounts_finance_qa.financial_card_attempt; s missionaccounts_finance_qa.financial_card_setup; b missionaccounts_finance_qa.financial_card_binding;
begin
 actor:=missionaccounts_finance_qa.financial_provider_actor(p_actor);
 if p_kind='payment' then
  select * into strict a from missionaccounts_finance_qa.financial_card_attempt where id=p_request_id::uuid;
  if a.intent_ref is not null and a.intent_ref<>p_reference then raise exception 'Provider reference conflict';end if;
  select * into strict b from missionaccounts_finance_qa.financial_card_binding where subject_key=a.subject_key;
  return jsonb_build_object('principal',actor,'wp_user_id',0,'attempt_id',a.id,'subject_key',a.subject_key);
 elsif p_kind='setup' then
  select * into strict s from missionaccounts_finance_qa.financial_card_setup where request_id=p_request_id and intent_ref=p_reference;
  select * into strict b from missionaccounts_finance_qa.financial_card_binding where subject_key=s.subject_key;
  if not exists(select 1 from missionaccounts_finance_qa.financial_operating_gate g where g.id=1 and g.stripe_account=b.provider_account) then raise exception 'Provider account conflict';end if;
  return jsonb_build_object('principal',actor,'wp_user_id',0,'subject_key',s.subject_key,'customer_ref',b.customer_ref,'request_id',s.request_id,'intent_ref',s.intent_ref);
 end if;
 raise exception 'Unsupported provider context';
end $$;
create or replace function missionaccounts_finance_qa.api_financial_confirm_setup(p_principal uuid,p_wp_user_id bigint,p_request_id text,p_proof jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare c jsonb; s missionaccounts_finance_qa.financial_card_setup; m missionaccounts_finance_qa.financial_card_method; dg text; name text;
begin
 if p_wp_user_id=0 then
  select actor_name into strict name from missionaccounts_finance_qa.financial_provider_binding where actor_id=p_principal;
  c:=missionaccounts_finance_qa.api_financial_provider_context(name,'setup',p_proof->>'intent_ref',p_request_id);
  c:=c||jsonb_build_object('provider_account',(select provider_account from missionaccounts_finance_qa.financial_card_binding where subject_key=c->>'subject_key'),
   'binding',jsonb_build_object('customer_ref',c->>'customer_ref'));
 else c:=missionaccounts_finance_qa.api_financial_setup_context(p_principal,p_wp_user_id,p_request_id);end if;
 select * into strict s from missionaccounts_finance_qa.financial_card_setup where request_id=p_request_id for update;
 if s.subject_key is distinct from c->>'subject_key' or s.intent_ref is distinct from p_proof->>'intent_ref' or p_proof->>'provider_account' is distinct from c->>'provider_account' or p_proof->>'customer_ref' is distinct from c->'binding'->>'customer_ref' then raise exception 'Setup proof owner conflict';end if;
 select * into m from missionaccounts_finance_qa.financial_card_method where setup_id=s.id;
 if found then if m.provider_pm_ref is distinct from p_proof->>'payment_method_ref' then raise exception 'Saved method replay conflict';end if;return jsonb_build_object('id',m.id,'duplicate',true);end if;
 insert into missionaccounts_finance_qa.financial_card_method(subject_key,setup_id,provider_pm_ref,brand,last4,exp_month,exp_year)
 values(s.subject_key,s.id,p_proof->>'payment_method_ref',p_proof->>'brand',p_proof->>'last4',(p_proof->>'exp_month')::integer,(p_proof->>'exp_year')::integer) returning * into m;
 dg:=encode(extensions.digest(p_proof::text,'sha256'),'hex');
 perform missionaccounts_finance_qa.financial_append_operation(p_principal,p_wp_user_id,s.subject_key,'PAYMENT_METHOD_VERIFIED','{}',jsonb_build_object('method_id',m.id,'last4',m.last4),p_request_id||':verified','DR-387:STRIPE_SETUP',dg);
 return jsonb_build_object('id',m.id,'duplicate',false);
end $$;
revoke execute on function missionaccounts_finance_qa.financial_provider_actor(text) from public,anon,authenticated,service_role;
revoke execute on function missionaccounts_finance_qa.api_financial_provider_context(text,text,text,text) from public,anon,authenticated,service_role;
grant execute on function missionaccounts_finance_qa.api_financial_provider_context(text,text,text,text) to service_role;


-- Finance source 20261005183000_mission_residency_financial_receipts_refunds.sql SHA256 3a20b04a5c111e6b62d66e10591109ac099f18e534692d13845f82f37a76836a
-- DR-389/DR-387: source-only canonical refund readback and private safe receipts.
-- No dispatch, publication, provider mutation, certification or gate activation.

create table missionaccounts_finance_qa.financial_refund (
 id uuid primary key, payment_id uuid not null references missionaccounts_finance_qa.financial_payment,
 adjustment_id uuid not null unique references missionaccounts_finance_qa.financial_adjustment deferrable initially deferred,
 provider text not null check(provider in ('Stripe','Chase','Bank')), provider_account text not null,
 refund_reference text not null check(refund_reference ~ '^[A-Za-z0-9._:-]{1,160}$'),
 amount_cents bigint not null check(amount_cents>0), confirmed_at timestamptz not null,
 actor_id uuid not null, request_id text not null unique, request_digest text not null,
 authority_ref text not null, evidence_sha256 text not null check(evidence_sha256 ~ '^[a-f0-9]{64}$'),
 created_at timestamptz not null default now(), unique(provider,provider_account,refund_reference)
);
create table missionaccounts_finance_qa.financial_application_reversal (
 refund_id uuid not null references missionaccounts_finance_qa.financial_refund,
 application_id uuid not null references missionaccounts_finance_qa.financial_payment_application,
 amount_cents bigint not null check(amount_cents>0), primary key(refund_id,application_id)
);
create table missionaccounts_finance_qa.financial_schedule_reversal (
 refund_id uuid not null, application_id uuid not null, installment_id uuid not null,
 amount_cents bigint not null check(amount_cents>0), primary key(refund_id,application_id,installment_id),
 foreign key(refund_id,application_id) references missionaccounts_finance_qa.financial_application_reversal(refund_id,application_id),
 foreign key(installment_id,application_id) references missionaccounts_finance_qa.financial_schedule_application(installment_id,payment_application_id)
);
create view missionaccounts_finance_qa.financial_net_application with(security_invoker=true) as
 select a.*, (a.amount_cents-coalesce(r.amount_cents,0))::bigint net_cents
 from missionaccounts_finance_qa.financial_payment_application a left join
 (select application_id,sum(amount_cents) amount_cents from missionaccounts_finance_qa.financial_application_reversal group by application_id) r on r.application_id=a.id;
create view missionaccounts_finance_qa.financial_net_schedule_application with(security_invoker=true) as
 select a.*, (a.amount_cents-coalesce(r.amount_cents,0))::bigint net_cents
 from missionaccounts_finance_qa.financial_schedule_application a left join
 (select application_id,installment_id,sum(amount_cents) amount_cents from missionaccounts_finance_qa.financial_schedule_reversal group by application_id,installment_id) r
 on r.application_id=a.payment_application_id and r.installment_id=a.installment_id;

-- Replacement guards preserve original immutable applications and use net audited allocations.
create or replace function missionaccounts_finance_qa.financial_guard_application()
returns trigger language plpgsql security definer set search_path='' as $$
declare p missionaccounts_finance_qa.financial_payment; o missionaccounts_finance_qa.financial_obligation; owner_key text; applied bigint; adjusted bigint;
begin
 select * into strict p from missionaccounts_finance_qa.financial_payment where id=new.payment_id for update;
 select * into strict o from missionaccounts_finance_qa.financial_obligation where id=new.obligation_id for update;
 select subject_key into strict owner_key from missionaccounts_finance_qa.financial_agreement where id=o.agreement_id;
 if p.subject_key<>owner_key then raise exception 'cross-subject application denied';end if;
 select coalesce(sum(net_cents),0) into applied from missionaccounts_finance_qa.financial_net_application where payment_id=p.id;
 select coalesce(sum(amount_cents),0) into adjusted from missionaccounts_finance_qa.financial_adjustment where payment_id=p.id and kind='REFUND';
 if applied+new.amount_cents>p.gross_cents-adjusted then raise exception 'payment overapplication denied';end if;
 select coalesce(sum(net_cents),0) into applied from missionaccounts_finance_qa.financial_net_application where obligation_id=o.id;
 select coalesce(sum(amount_cents),0) into adjusted from missionaccounts_finance_qa.financial_adjustment where obligation_id=o.id;
 if applied+adjusted+new.amount_cents>o.original_cents then raise exception 'obligation overapplication denied';end if;
 return new;
end $$;
create or replace function missionaccounts_finance_qa.financial_guard_adjustment()
returns trigger language plpgsql security definer set search_path='' as $$
declare available bigint; consumed bigint;
begin
 if new.kind='REFUND' then
  select gross_cents into strict available from missionaccounts_finance_qa.financial_payment where id=new.payment_id for update;
  select coalesce(sum(net_cents),0) into consumed from missionaccounts_finance_qa.financial_net_application where payment_id=new.payment_id;
  consumed:=consumed+(select coalesce(sum(amount_cents),0) from missionaccounts_finance_qa.financial_adjustment where payment_id=new.payment_id);
 else
  select original_cents into strict available from missionaccounts_finance_qa.financial_obligation where id=new.obligation_id for update;
  select coalesce(sum(net_cents),0) into consumed from missionaccounts_finance_qa.financial_net_application where obligation_id=new.obligation_id;
  consumed:=consumed+(select coalesce(sum(amount_cents),0) from missionaccounts_finance_qa.financial_adjustment where obligation_id=new.obligation_id);
 end if;
 if new.amount_cents+consumed>available then raise exception 'adjustment exceeds unapplied available amount';end if;
 return new;
end $$;
create or replace function missionaccounts_finance_qa.financial_guard_schedule_application()
returns trigger language plpgsql security definer set search_path='' as $$
declare i missionaccounts_finance_qa.financial_schedule_installment; a missionaccounts_finance_qa.financial_net_application; owner text;
begin
 select * into strict i from missionaccounts_finance_qa.financial_schedule_installment where id=new.installment_id for update;
 -- Lock canonical original; net view is an aggregate read and cannot be row locked.
 perform 1 from missionaccounts_finance_qa.financial_payment_application where id=new.payment_application_id for update;
 select * into strict a from missionaccounts_finance_qa.financial_net_application where id=new.payment_application_id;
 select subject_key into strict owner from missionaccounts_finance_qa.financial_schedule_revision where id=i.revision_id;
 if a.obligation_id<>i.obligation_id or owner<>(select subject_key from missionaccounts_finance_qa.financial_payment where id=a.payment_id) then raise exception 'Schedule allocation ownership mismatch';end if;
 if new.amount_cents+(select coalesce(sum(net_cents),0) from missionaccounts_finance_qa.financial_net_schedule_application where payment_application_id=a.id)>a.net_cents then raise exception 'Schedule allocation exceeds canonical application';end if;
 if new.amount_cents+(select coalesce(sum(net_cents),0) from missionaccounts_finance_qa.financial_net_schedule_application where installment_id=i.id)>i.amount_cents then raise exception 'Schedule allocation exceeds installment';end if;
 return new;
end $$;
create or replace view missionaccounts_finance_qa.financial_obligation_state with(security_invoker=true) as
 select o.*,greatest(o.original_cents-coalesce(a.applied,0)-coalesce(c.adjusted,0),0)::bigint remaining_cents,
 case when o.original_cents=coalesce(a.applied,0)+coalesce(c.adjusted,0) then 'SETTLED'
 when o.due_precision='UNKNOWN' then 'BALANCE_DUE_DATE_UNKNOWN'
 when o.due_on<current_date then 'OVERDUE' else 'OPEN' end status
 from missionaccounts_finance_qa.financial_obligation o
 left join (select obligation_id,sum(net_cents) applied from missionaccounts_finance_qa.financial_net_application group by obligation_id) a on a.obligation_id=o.id
 left join (select obligation_id,sum(amount_cents) adjusted from missionaccounts_finance_qa.financial_adjustment where obligation_id is not null group by obligation_id) c on c.obligation_id=o.id;
create or replace view missionaccounts_finance_qa.financial_unapplied_credit with(security_invoker=true) as
 select p.id payment_id,p.subject_key,(p.gross_cents-coalesce(a.applied,0)-coalesce(r.refunded,0))::bigint credit_cents
 from missionaccounts_finance_qa.financial_payment p
 left join(select payment_id,sum(net_cents) applied from missionaccounts_finance_qa.financial_net_application group by payment_id) a on a.payment_id=p.id
 left join(select payment_id,sum(amount_cents) refunded from missionaccounts_finance_qa.financial_adjustment where kind='REFUND' group by payment_id) r on r.payment_id=p.id;
create or replace view missionaccounts_finance_qa.financial_active_schedule with(security_invoker=true) as
 select i.*,r.subject_key,coalesce(sum(a.net_cents),0)::bigint applied_cents,
 case when exists(select 1 from missionaccounts_finance_qa.financial_schedule_revision n where n.supersedes=r.id) then 0 else (i.amount_cents-coalesce(sum(a.net_cents),0))::bigint end remaining_cents
 from missionaccounts_finance_qa.financial_schedule_installment i join missionaccounts_finance_qa.financial_schedule_revision r on r.id=i.revision_id
 left join missionaccounts_finance_qa.financial_net_schedule_application a on a.installment_id=i.id
 where not exists(select 1 from missionaccounts_finance_qa.financial_schedule_revision n where n.supersedes=r.id)
 or exists(select 1 from missionaccounts_finance_qa.financial_schedule_application p where p.installment_id=i.id)
 group by i.id,r.id,r.subject_key;

create function missionaccounts_finance_qa.api_financial_refund_context(p_principal uuid,p_wp_user_id bigint,p_payment uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare p missionaccounts_finance_qa.financial_payment;
begin
 perform missionaccounts_finance_qa.financial_require_founder(p_principal,p_wp_user_id);
 select * into strict p from missionaccounts_finance_qa.financial_payment where id=p_payment;
 if (select certification_state from missionaccounts_finance_qa.financial_subject where subject_key=p.subject_key)<>'CERTIFIED' then raise exception 'Held financial account remains quarantined';end if;
 return jsonb_build_object('provider',p.provider,'provider_account',p.provider_account,'provider_identity',p.provider_identity,'gross_cents',p.gross_cents);
end $$;
create function missionaccounts_finance_qa.api_financial_record_refund(p_principal uuid,p_wp_user_id bigint,p_payment uuid,p_payload jsonb,p_request_id text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare p missionaccounts_finance_qa.financial_payment; old missionaccounts_finance_qa.financial_refund; a missionaccounts_finance_qa.financial_net_application;
 x jsonb; sa record; amount bigint; reversed bigint:=0; take bigint; left_to_reverse bigint;
 rid uuid:=gen_random_uuid(); adj uuid:=gen_random_uuid(); dg text; before_val jsonb; result jsonb; seen uuid[]:=array[]::uuid[];
begin
 perform missionaccounts_finance_qa.financial_require_founder(p_principal,p_wp_user_id);
 if p_request_id is null or p_request_id !~ '^[A-Za-z0-9._:-]{8,160}$' or p_payload->'confirmed' is distinct from 'true'::jsonb
 or p_payload->>'authority_ref' is null or p_payload->>'authority_ref' !~ '^[A-Za-z0-9._:-]{3,160}$'
 or p_payload->>'evidence_sha256' is null or p_payload->>'evidence_sha256' !~ '^[a-f0-9]{64}$'
 or jsonb_typeof(p_payload->'reversals') is distinct from 'array' then raise exception 'Confirmed accounting authority and bounded evidence required';end if;
 if jsonb_array_length(p_payload->'reversals')>100 then raise exception 'Bounded reversals required';end if;
 amount:=(p_payload->>'amount_cents')::bigint;
 if amount is null or amount<=0 or amount>9007199254740991 then raise exception 'Positive whole cents required';end if;
 dg:=encode(extensions.digest(jsonb_build_array(p_principal,p_wp_user_id,p_payment,p_payload)::text,'sha256'),'hex');
 perform pg_advisory_xact_lock(hashtextextended('mr-refund:'||p_request_id,0));
 select * into old from missionaccounts_finance_qa.financial_refund where request_id=p_request_id;
 if found then
  if old.request_digest<>dg then raise exception 'Refund request identity conflict';end if;
  return jsonb_build_object('refund_id',old.id,'payment_id',old.payment_id,'amount_cents',old.amount_cents,'duplicate',true);
 end if;
 select * into strict p from missionaccounts_finance_qa.financial_payment where id=p_payment for update;
 if (select certification_state from missionaccounts_finance_qa.financial_subject where subject_key=p.subject_key) is distinct from 'CERTIFIED' then raise exception 'Held financial account remains quarantined';end if;
 if p_payload->'proof'->'confirmed' is distinct from 'true'::jsonb or (p_payload->'proof'->>'amount_cents')::bigint is distinct from amount
 or p_payload->'proof'->>'provider' is distinct from p.provider
 or p_payload->'proof'->>'provider_account' is distinct from p.provider_account
 or p_payload->'proof'->>'provider_identity' is distinct from p.provider_identity
 or p_payload->'proof'->>'refund_reference' is null or p_payload->'proof'->>'refund_reference' !~ '^[A-Za-z0-9._:-]{1,160}$'
 or p_payload->'proof'->>'confirmed_at' is null
 or (p.provider='Stripe' and p_payload->'proof'->>'refund_reference' !~ '^re_[A-Za-z0-9]+$')
 or (p.provider<>'Stripe' and p_payload->'proof'->'authenticity_verified' is distinct from 'true'::jsonb) then raise exception 'Verified exact provider refund proof required';end if;
 if amount+(select coalesce(sum(amount_cents),0) from missionaccounts_finance_qa.financial_adjustment where payment_id=p.id and kind='REFUND')>p.gross_cents then raise exception 'Refund exceeds original receipt';end if;
 before_val:=jsonb_build_object('balance',(select balance_cents from missionaccounts_finance_qa.financial_balance where subject_key=p.subject_key),'credit',(select credit_cents from missionaccounts_finance_qa.financial_unapplied_credit where payment_id=p.id));
 insert into missionaccounts_finance_qa.financial_refund values(rid,p.id,adj,p.provider,p.provider_account,p_payload->'proof'->>'refund_reference',amount,(p_payload->'proof'->>'confirmed_at')::timestamptz,p_principal,p_request_id,dg,p_payload->>'authority_ref',p_payload->>'evidence_sha256',now());
 for x in select value from jsonb_array_elements(p_payload->'reversals') order by value->>'application_id' loop
  perform 1 from missionaccounts_finance_qa.financial_payment_application where id=(x->>'application_id')::uuid for update;
  select * into strict a from missionaccounts_finance_qa.financial_net_application where id=(x->>'application_id')::uuid;
  take:=(x->>'amount_cents')::bigint;
  if a.payment_id<>p.id or a.id=any(seen) or take is null or take<=0 or take>a.net_cents then raise exception 'Refund application ownership or cap mismatch';end if;
  seen:=array_append(seen,a.id);reversed:=reversed+take;
  if reversed>amount then raise exception 'Reversals exceed confirmed refund';end if;
  perform 1 from missionaccounts_finance_qa.financial_obligation where id=a.obligation_id for update;
  insert into missionaccounts_finance_qa.financial_application_reversal values(rid,a.id,take);
  -- Remove schedule allocations deterministically first; any unallocated canonical portion follows.
  left_to_reverse:=take;
  for sa in select * from missionaccounts_finance_qa.financial_net_schedule_application where payment_application_id=a.id order by installment_id loop
   perform 1 from missionaccounts_finance_qa.financial_schedule_installment where id=sa.installment_id for update;
   if left_to_reverse>0 and sa.net_cents>0 then
    insert into missionaccounts_finance_qa.financial_schedule_reversal values(rid,a.id,sa.installment_id,least(left_to_reverse,sa.net_cents));
    left_to_reverse:=left_to_reverse-least(left_to_reverse,sa.net_cents);
   end if;
  end loop;
 end loop;
 -- Existing canonical adjustment guard enforces net applications + cumulative refunds <= gross.
 insert into missionaccounts_finance_qa.financial_adjustment(id,payment_id,kind,amount_cents,authority_ref,evidence_fingerprint)
 values(adj,p.id,'REFUND',amount,p_payload->>'authority_ref',p_payload->>'evidence_sha256');
 result:=jsonb_build_object('refund_id',rid,'payment_id',p.id,'amount_cents',amount,'reversed_application_cents',reversed,
 'reversals',coalesce((select jsonb_agg(jsonb_build_object('application_id',v.application_id,'obligation_id',ap.obligation_id,'amount_cents',v.amount_cents) order by v.application_id) from missionaccounts_finance_qa.financial_application_reversal v join missionaccounts_finance_qa.financial_payment_application ap on ap.id=v.application_id where v.refund_id=rid),'[]'::jsonb),
 'balance',(select balance_cents from missionaccounts_finance_qa.financial_balance where subject_key=p.subject_key),
 'credit',(select credit_cents from missionaccounts_finance_qa.financial_unapplied_credit where payment_id=p.id),'duplicate',false);
 insert into missionaccounts_finance_qa.audit_event(actor_id,actor_role,kind,text,from_val,to_val,reason,request_id)
 values(p_principal::text,'founder','mr_financial_refund','Provider-confirmed canonical refund; original receipt preserved',before_val,
 result||jsonb_build_object('subject_key',p.subject_key,'provider',p.provider,'provider_reference',p_payload->'proof'->>'refund_reference','evidence_sha256',p_payload->>'evidence_sha256'),p_payload->>'authority_ref',p_request_id);
 return result;
end $$;

-- Allowlist only. No payer/contact, raw provider objects, Gmail, evidence URLs or card secrets.
create function missionaccounts_finance_qa.financial_safe_history(p_subject text)
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('payments',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'received_at',p.received_at,'verified_at',p.verified_at,
 'amount_cents',p.gross_cents,'currency',p.currency,'method',p.method,'provider',p.provider,'receipt_available',true,
 'net_applied_cents',(select coalesce(sum(net_cents),0) from missionaccounts_finance_qa.financial_net_application where payment_id=p.id),
 'refunded_cents',(select coalesce(sum(amount_cents),0) from missionaccounts_finance_qa.financial_adjustment where payment_id=p.id and kind='REFUND'),
 'applications',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'obligation_id',a.obligation_id,'original_cents',a.amount_cents,'net_cents',a.net_cents) order by a.created_at,a.id) from missionaccounts_finance_qa.financial_net_application a where a.payment_id=p.id),'[]'::jsonb),
 'refunds',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'amount_cents',r.amount_cents,'confirmed_at',r.confirmed_at,'recorded_at',r.created_at) order by r.confirmed_at,r.id) from missionaccounts_finance_qa.financial_refund r where r.payment_id=p.id),'[]'::jsonb)) order by p.received_at,p.id)
 from missionaccounts_finance_qa.financial_payment p where p.subject_key=p_subject),'[]'::jsonb))
$$;
create function missionaccounts_finance_qa.api_financial_founder_history(p_principal uuid,p_wp_user_id bigint,p_subject text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 perform missionaccounts_finance_qa.financial_require_founder(p_principal,p_wp_user_id);
 if (select certification_state from missionaccounts_finance_qa.financial_subject where subject_key=p_subject) is distinct from 'CERTIFIED' then return jsonb_build_object('state','ACCOUNT_REVIEW','payments','[]'::jsonb);end if;
 return missionaccounts_finance_qa.financial_safe_history(p_subject);
end $$;
create function missionaccounts_finance_qa.api_financial_own_history(p_principal uuid,p_wp_user_id bigint)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare k text;
begin
 k:=missionaccounts_finance_qa.financial_own_subject(p_principal,p_wp_user_id);
 if not exists(select 1 from missionaccounts_finance_qa.financial_operating_gate where id=1 and student_publication) then raise exception 'Student financial publication disabled' using errcode='42501';end if;
 if (select certification_state from missionaccounts_finance_qa.financial_subject where subject_key=k) is distinct from 'CERTIFIED' then return jsonb_build_object('state','ACCOUNT_REVIEW','payments','[]'::jsonb);end if;
 return missionaccounts_finance_qa.financial_safe_history(k);
end $$;
do $$declare t text; f record;
begin
 foreach t in array array['financial_refund','financial_application_reversal','financial_schedule_reversal'] loop
 execute format('alter table missionaccounts_finance_qa.%I enable row level security',t);
 execute format('revoke all on missionaccounts_finance_qa.%I from public,anon,authenticated,service_role',t);
 execute format('grant select on missionaccounts_finance_qa.%I to service_role',t);
 execute format('create trigger %I before update or delete on missionaccounts_finance_qa.%I for each row execute function missionaccounts_finance_qa.reject_immutable_change()',t||'_immutable',t);
 end loop;
 for f in select p.oid::regprocedure sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='missionaccounts_finance_qa' and p.proname in
 ('api_financial_refund_context','api_financial_record_refund','financial_safe_history','api_financial_founder_history','api_financial_own_history') loop
 execute format('revoke all on function %s from public,anon,authenticated,service_role',f.sig);
 end loop;
end $$;
revoke all on missionaccounts_finance_qa.financial_net_application,missionaccounts_finance_qa.financial_net_schedule_application from public,anon,authenticated,service_role;
grant select on missionaccounts_finance_qa.financial_net_application,missionaccounts_finance_qa.financial_net_schedule_application to service_role;
grant execute on function missionaccounts_finance_qa.api_financial_refund_context(uuid,bigint,uuid),missionaccounts_finance_qa.api_financial_record_refund(uuid,bigint,uuid,jsonb,text),
 missionaccounts_finance_qa.api_financial_founder_history(uuid,bigint,text),missionaccounts_finance_qa.api_financial_own_history(uuid,bigint) to service_role;

-- Current Founder sums use net applications; immutable originals remain explicit.
create or replace function missionaccounts_finance_qa.api_read_financial_command(p_principal uuid,p_wp_user_id bigint)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not missionaccounts_finance_qa.api_financial_read_access(p_principal,p_wp_user_id) then
  raise exception 'Explicit Founder financial authorization required' using errcode='42501';
 end if;
 return jsonb_build_object('observed_at',now(),'accounts',(
 select coalesce(jsonb_agg(jsonb_build_object(
  'subject_key',s.subject_key,'name',coalesce(d.display_name,s.subject_key),
  'program',coalesce(g.program,d.program),'tier',g.tier,'state',s.certification_state,
  'binding_state',s.binding_state,'student_visible',s.student_visible,'collections_enabled',s.collections_enabled,
  'created_at',s.created_at,
  'agreement',case when g.id is null then null else jsonb_build_object(
   'id',g.id,'version',g.version,'currency',g.currency,'tuition_cents',g.accepted_tuition_cents,
   'fees_cents',g.accepted_fees_cents,'deposit_cents',g.deposit_cents,'effective_on',g.effective_on,
   'effective_precision',g.effective_precision,'plan',g.plan,'discount_provenance',g.discount_provenance,
   'evidence',g.agreement_evidence,'certification_status',g.certification_status,'certified_at',g.certified_at) end,
  'balance',case when b.agreement_id is null then null else jsonb_build_object(
   'balance_cents',b.balance_cents,'currently_due_cents',b.currently_due_cents,'overdue_cents',b.overdue_cents) end,
  'obligations',coalesce((select jsonb_agg(to_jsonb(o) order by o.obligation_key) from missionaccounts_finance_qa.financial_obligation_state o where o.agreement_id=g.id),'[]'::jsonb),
  'payments',coalesce((select jsonb_agg(jsonb_build_object(
   'id',p.id,'date',p.received_at,'date_precision',p.received_precision,'amount_cents',p.gross_cents,
   'method',p.method,'payer',p.payer,'provider',p.provider,'verification_state',p.verification_state,
   'verified_at',p.verified_at,
   'applied_cents',coalesce((select sum(a.net_cents) from missionaccounts_finance_qa.financial_net_application a where a.payment_id=p.id),0),
   'unapplied_cents',(select c.credit_cents from missionaccounts_finance_qa.financial_unapplied_credit c where c.payment_id=p.id),
   'evidence',coalesce((select jsonb_agg(jsonb_build_object('type',e.evidence_type,'provider',e.provider,
    'reference',e.provider_reference,'fingerprint',e.fingerprint,'verified',e.verified)) from missionaccounts_finance_qa.financial_payment_evidence e where e.payment_id=p.id),'[]'::jsonb)
  ) order by p.received_at,p.id) from missionaccounts_finance_qa.financial_payment p where p.subject_key=s.subject_key),'[]'::jsonb),
  'applications',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'payment_id',a.payment_id,
   'obligation_id',a.obligation_id,'obligation',o.obligation_key,'component',o.component,
   'amount_cents',a.amount_cents,'net_cents',a.net_cents,'reversed_cents',a.amount_cents-a.net_cents,'recorded_at',a.created_at) order by a.created_at,a.id)
   from missionaccounts_finance_qa.financial_net_application a join missionaccounts_finance_qa.financial_obligation o on o.id=a.obligation_id where o.agreement_id=g.id),'[]'::jsonb),
  'adjustments',coalesce((select jsonb_agg(jsonb_build_object('kind',a.kind,'amount_cents',a.amount_cents,'authority_ref',a.authority_ref,'evidence_fingerprint',a.evidence_fingerprint,'created_at',a.created_at))
   from missionaccounts_finance_qa.financial_adjustment a left join missionaccounts_finance_qa.financial_obligation o on o.id=a.obligation_id
   left join missionaccounts_finance_qa.financial_payment p on p.id=a.payment_id where o.agreement_id=g.id or p.subject_key=s.subject_key),'[]'::jsonb),
  'payers',coalesce((select jsonb_agg(jsonb_build_object('payer',p.payer,'relationship',p.relationship,'provenance',p.provenance) order by p.payer) from missionaccounts_finance_qa.financial_payer_alias p where p.subject_key=s.subject_key),'[]'::jsonb),
  'cases',coalesce((select jsonb_agg(jsonb_build_object('type',c.hold_class,'reason',c.reason)) from missionaccounts_finance_qa.financial_reconciliation_case c where c.subject_key=s.subject_key),'[]'::jsonb),
  'source',jsonb_build_object('kind',a.source_kind,'sha256',a.sha256,'observed_at',a.observed_at,
    'display_sha256',d.source_sha256,'display_authority',d.authority_ref)
 ) order by coalesce(d.display_name,s.subject_key)),'[]'::jsonb)
 from missionaccounts_finance_qa.financial_subject s
 left join missionaccounts_finance_qa.financial_display_directory d on d.subject_key=s.subject_key
 left join missionaccounts_finance_qa.financial_agreement g on g.subject_key=s.subject_key
 left join missionaccounts_finance_qa.financial_balance b on b.agreement_id=g.id
 join missionaccounts_finance_qa.source_artifact a on a.id=s.artifact_id));
end $$;


-- Finance source 20261005185000_mission_residency_financial_chase_bridge.sql SHA256 5c97335cafffd8a6b90fb9d2ccda4af9f524950d0e4c618c68b04cea5682341d
-- DR-389 / DR-387: source-only current Chase donor bridge. No runtime/provider/gate changes.
-- Future activation requires reciprocal Woo/private ambiguity and cross-system race verification.
-- Preserve historic numeric Chase identities; new evidence retains the accepted 64hex fingerprint.

create or replace function missionaccounts_finance_qa.api_record_verified_financial_payment(p_actor text,p_payment jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare existing missionaccounts_finance_qa.financial_payment; pid uuid; x jsonb; oid uuid; applied bigint:=0; digest text;
begin
 perform missionaccounts_finance_qa.financial_require_principal(p_actor,'settle');
 digest:=encode(extensions.digest(p_payment::text,'sha256'),'hex');
 perform pg_advisory_xact_lock(hashtextextended('financial-payment:'||(p_payment->>'provider')||':'||(p_payment->>'provider_identity'),0));
 select * into existing from missionaccounts_finance_qa.financial_payment where request_id=p_payment->>'request_id'
  or (provider=p_payment->>'provider' and provider_account=p_payment->>'provider_account' and provider_identity=p_payment->>'provider_identity');
 if found then
  if existing.request_digest<>digest then raise exception 'payment replay payload or owner conflict'; end if;
  return jsonb_build_object('payment_id',existing.id,'duplicate',true);
 end if;
 if jsonb_typeof(p_payment->'evidence') is distinct from 'array' or jsonb_typeof(p_payment->'applications') is distinct from 'array' or jsonb_array_length(p_payment->'evidence')<1 then raise exception 'verified payment evidence required'; end if;
 if p_payment->>'provider'='Chase' then
  if p_payment->>'method' is distinct from 'ZELLE' or jsonb_array_length(p_payment->'evidence')<>1
    or p_payment->'evidence'->0->>'reference' is distinct from p_payment->>'provider_identity'
    or (
      ((p_payment->>'provider_identity') ~ '^[0-9]+$' and p_payment->'evidence'->0->>'type'='CHASE_REFERENCE')
      or ((p_payment->>'provider_identity') ~ '^[a-f0-9]{64}$'
        and p_payment->'evidence'->0->>'type'='CHASE_TRANSACTION_V2_FINGERPRINT'
        and p_payment->'evidence'->0->>'fingerprint'=p_payment->>'provider_identity'
        and p_payment->>'provider_account'='info@missionmedinstitute.com'
        and p_payment->'evidence'->0->'metadata'->'authenticity_verified'='true'::jsonb
        and p_payment->'evidence'->0->'metadata'->'global_claim_verified'='true'::jsonb
        and coalesce(p_payment->'evidence'->0->'metadata'->>'match_binding','') ~ '^[a-f0-9]{64}$')
    ) is distinct from true then raise exception 'canonical Chase evidence namespace required'; end if;
 elsif p_payment->>'provider'='Stripe' then
  if (p_payment->>'provider_identity') !~ '^pi_[A-Za-z0-9]+$' or p_payment->>'method'<>'CARD'
   or jsonb_array_length(p_payment->'evidence')<>2
   or (select count(*) from jsonb_array_elements(p_payment->'evidence') e where e->>'type'='STRIPE_PAYMENT_INTENT' and e->>'reference'=p_payment->>'provider_identity')<>1
   or (select count(*) from jsonb_array_elements(p_payment->'evidence') e where e->>'type'='STRIPE_CHARGE' and e->>'reference' ~ '^ch_[A-Za-z0-9]+$')<>1
   then raise exception 'canonical Stripe intent and charge evidence required'; end if;
 elsif p_payment->>'provider'='Bank' then
  if p_payment->>'method'<>'WIRE' or jsonb_array_length(p_payment->'evidence')<>1 or p_payment->'evidence'->0->>'type'<>'BANK_REFERENCE' or p_payment->'evidence'->0->>'reference'<>p_payment->>'provider_identity' then raise exception 'canonical bank evidence required'; end if;
 else raise exception 'unsupported financial provider';
 end if;
 if p_payment->>'verification_state' is distinct from 'VERIFIED' then raise exception 'unverified payment denied'; end if;
 -- Lock the beneficiary agreement first: consistent lock order across settlement and import.
 perform 1 from missionaccounts_finance_qa.financial_agreement where subject_key=p_payment->>'subject_key' for update;
 if not found then raise exception 'certified agreement required'; end if;
 insert into missionaccounts_finance_qa.financial_payment(subject_key,provider,provider_account,provider_identity,method,currency,gross_cents,payer,received_at,received_precision,verification_state,request_id,request_digest,artifact_id)
 values(p_payment->>'subject_key',p_payment->>'provider',p_payment->>'provider_account',p_payment->>'provider_identity',p_payment->>'method','USD',(p_payment->>'gross_cents')::bigint,p_payment->>'payer',(p_payment->>'received_at')::timestamptz,p_payment->>'received_precision','VERIFIED',p_payment->>'request_id',digest,(p_payment->>'artifact_id')::uuid) returning id into pid;
 for x in select value from jsonb_array_elements(p_payment->'evidence') loop
  insert into missionaccounts_finance_qa.financial_payment_evidence(fingerprint,payment_id,evidence_type,provider,provider_reference,artifact_id,metadata,verified)
  values(x->>'fingerprint',pid,x->>'type',p_payment->>'provider',x->>'reference',(p_payment->>'artifact_id')::uuid,x->'metadata',true);
 end loop;
 for x in select value from jsonb_array_elements(p_payment->'applications') loop
  select o.id into strict oid from missionaccounts_finance_qa.financial_obligation o join missionaccounts_finance_qa.financial_agreement g on g.id=o.agreement_id
   where g.subject_key=p_payment->>'subject_key' and g.version=p_payment->>'agreement_version' and o.obligation_key=x->>'obligation_key' and o.component=x->>'component';
  insert into missionaccounts_finance_qa.financial_payment_application(payment_id,obligation_id,amount_cents) values(pid,oid,(x->>'amount_cents')::bigint);
  applied:=applied+(x->>'amount_cents')::bigint;
 end loop;
 insert into missionaccounts_finance_qa.audit_event(actor_id,actor_role,kind,text,to_val,reason,request_id)
 values(p_actor,'financial_service','financial.payment_recorded','Verified private financial payment and applications',jsonb_build_object('subject_key',p_payment->>'subject_key','payment_id',pid,'gross_cents',p_payment->'gross_cents','applied_cents',applied),'Certified evidence; no dispatch',p_payment->>'request_id');
 return jsonb_build_object('payment_id',pid,'duplicate',false,'applied_cents',applied,'credit_cents',(p_payment->>'gross_cents')::bigint-applied);
end $$;

create function missionaccounts_finance_qa.financial_chase_normalize_payer(p_payer text)
returns text language sql immutable set search_path='' as $$
 select lower(regexp_replace(trim(normalize(p_payer,NFKC)),'[[:space:]]+',' ','g'))
$$;
create function missionaccounts_finance_qa.financial_chase_binding(p_request uuid,p_account uuid,p_amount bigint,p_payer text,p_created bigint)
returns text language sql immutable set search_path='' as $$
 select encode(extensions.digest(concat_ws(E'\n','financial-chase-match/v1',p_request::text,p_account::text,p_amount::text,p_payer,p_created::text,'1'),'sha256'),'hex')
$$;
-- Count the full current population. Exact payer matching, no fuzzy identity selection.
create function missionaccounts_finance_qa.financial_chase_candidates(p_amount bigint,p_payer text)
returns setof missionaccounts_finance_qa.financial_payment_request language sql security definer set search_path='' as $$
 select q.* from missionaccounts_finance_qa.financial_payment_request q
 join missionaccounts_finance_qa.financial_subject s on s.subject_key=q.subject_key
 join missionaccounts_finance_qa.financial_obligation_state os on os.id=q.obligation_id
 where s.certification_state='CERTIFIED' and s.binding_state='VERIFIED'
 and exists(select 1 from missionaccounts_finance_qa.financial_runtime_binding b where b.subject_key=s.subject_key and b.active)
 and 'ZELLE'=any(q.methods) and q.amount_cents=p_amount and q.amount_cents<=os.remaining_cents
 and (q.expires_at is null or q.expires_at>now())
 and coalesce((select rr.state from missionaccounts_finance_qa.financial_request_result rr join missionaccounts_finance_qa.financial_operating_event e on e.id=rr.event_id where rr.request_id=q.id order by e.sequence_no desc limit 1),'OPEN') in ('OPEN','REPORTED')
 and exists(select 1 from missionaccounts_finance_qa.financial_payer_alias a where a.subject_key=q.subject_key and missionaccounts_finance_qa.financial_chase_normalize_payer(a.payer)=p_payer)
 and (q.installment_id is null or exists(select 1 from missionaccounts_finance_qa.financial_active_schedule i join missionaccounts_finance_qa.financial_schedule_revision v on v.id=i.revision_id where i.id=q.installment_id and i.remaining_cents>=q.amount_cents and not exists(select 1 from missionaccounts_finance_qa.financial_schedule_revision sn where sn.supersedes=v.id)))
 and (q.installment_id is not null or q.amount_cents<=os.remaining_cents-(select coalesce(sum(i.remaining_cents),0) from missionaccounts_finance_qa.financial_active_schedule i where i.obligation_id=q.obligation_id))
 and not exists(select 1 from missionaccounts_finance_qa.financial_card_attempt a join missionaccounts_finance_qa.financial_payment_request cr on cr.id=a.request_id where cr.obligation_id=q.obligation_id and a.state in ('PREPARED','SUBMITTED','REQUIRES_ACTION','AMBIGUOUS','DECLINED'))
$$;
create function missionaccounts_finance_qa.api_financial_chase_context(p_principal uuid,p_wp_user_id bigint,p_request uuid,p_settlement_actor text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r missionaccounts_finance_qa.financial_payment_request; account uuid; payer text; n integer; epoch bigint; existing uuid;
begin
 perform missionaccounts_finance_qa.financial_require_founder(p_principal,p_wp_user_id);
 perform missionaccounts_finance_qa.financial_require_principal(p_settlement_actor,'settle');
 if not exists(select 1 from missionaccounts_finance_qa.financial_operating_gate where id=1 and founder_operations and zelle_matcher) then raise exception 'Chase adapter is not released' using errcode='42501';end if;
 if (select count(*) from missionaccounts_finance_qa.financial_subject)>100 or (select count(*) from missionaccounts_finance_qa.financial_payment_request)>1000 then raise exception 'Private candidate population exceeds reviewed bound';end if;
 -- Shared subject/agreement lock order also fences competing private card/app allocations.
 perform 1 from missionaccounts_finance_qa.financial_subject order by subject_key for update;
 perform 1 from missionaccounts_finance_qa.financial_agreement order by subject_key for update;
 select * into strict r from missionaccounts_finance_qa.financial_payment_request where id=p_request for update;
 select rr.payment_id into existing from missionaccounts_finance_qa.financial_request_result rr join missionaccounts_finance_qa.financial_operating_event e on e.id=rr.event_id
 where rr.request_id=r.id and rr.state='SETTLED' order by e.sequence_no desc limit 1;
 if found then return jsonb_build_object('state','SETTLED','payment_id',existing);end if;
 select count(distinct missionaccounts_finance_qa.financial_chase_normalize_payer(a.payer)),min(missionaccounts_finance_qa.financial_chase_normalize_payer(a.payer)) into n,payer
 from missionaccounts_finance_qa.financial_payer_alias a where a.subject_key=r.subject_key;
 if n<>1 or length(payer)<2 or length(payer)>120 then raise exception 'One verified private payer alias is required';end if;
 select count(*) into n from missionaccounts_finance_qa.financial_chase_candidates(r.amount_cents,payer);
 if n<>1 or not exists(select 1 from missionaccounts_finance_qa.financial_chase_candidates(r.amount_cents,payer) c where c.id=r.id) then raise exception 'No unique currently eligible private Chase request';end if;
 select g.id into strict account from missionaccounts_finance_qa.financial_agreement g join missionaccounts_finance_qa.financial_obligation o on o.agreement_id=g.id where o.id=r.obligation_id and g.subject_key=r.subject_key;
 epoch:=floor(extract(epoch from r.created_at))::bigint;
 return jsonb_build_object('state','OPEN','request_id',r.id,'account_id',account,'amount_cents',r.amount_cents,
   'payer_name',payer,'created_epoch',epoch,'match_slot',1,'eligible_match_count',n,
   'match_binding',missionaccounts_finance_qa.financial_chase_binding(r.id,account,r.amount_cents,payer,epoch));
end $$;
create function missionaccounts_finance_qa.api_financial_settle_chase_request(p_principal uuid,p_wp_user_id bigint,p_request uuid,p_settlement_actor text,p_receipt jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare ctx jsonb; r missionaccounts_finance_qa.financial_payment_request; g missionaccounts_finance_qa.financial_agreement; o missionaccounts_finance_qa.financial_obligation;
 paid jsonb; artifact uuid; ev uuid; dg text; application uuid; fp text; existing missionaccounts_finance_qa.financial_payment;
begin
 perform missionaccounts_finance_qa.financial_require_founder(p_principal,p_wp_user_id);
 perform missionaccounts_finance_qa.financial_require_principal(p_settlement_actor,'settle');
 if not exists(select 1 from missionaccounts_finance_qa.financial_operating_gate where id=1 and founder_operations and zelle_matcher) then raise exception 'Chase adapter is not released' using errcode='42501';end if;
 fp:=p_receipt->>'provider_identity';
 if coalesce(fp,'') !~ '^[a-f0-9]{64}$' or p_receipt->>'provider' is distinct from 'Chase'
   or p_receipt->>'provider_account' is distinct from 'info@missionmedinstitute.com'
   or p_receipt->'authenticity_verified' is distinct from 'true'::jsonb
   or p_receipt->'global_claim_verified' is distinct from 'true'::jsonb
   or p_receipt->'reservation_verified' is distinct from 'true'::jsonb
   or coalesce(p_receipt->>'match_binding','') !~ '^[a-f0-9]{64}$'
   or coalesce(p_receipt->>'message_fingerprint','') !~ '^[a-f0-9]{64}$'
   or p_receipt->'money_moved' is distinct from 'false'::jsonb then raise exception 'Authenticated globally reserved current Chase proof required';end if;
 dg:=encode(extensions.digest(p_receipt::text,'sha256'),'hex');
 perform pg_advisory_xact_lock(hashtextextended('financial-payment:Chase:'||fp,0));
 select * into existing from missionaccounts_finance_qa.financial_payment where provider='Chase' and provider_identity=fp;
 if found then
  if not exists(select 1 from missionaccounts_finance_qa.financial_operating_event e where e.request_id='mr-chase-v2:'||fp and e.operation='CHASE_PAYMENT_SETTLED' and e.request_digest=dg and e.after_state->>'request_id'=p_request::text and e.after_state->>'payment_id'=existing.id::text) then raise exception 'Chase proof replay owner or payload conflict';end if;
  return jsonb_build_object('state','SETTLED','payment_id',existing.id,'duplicate',true);
 end if;
 ctx:=missionaccounts_finance_qa.api_financial_chase_context(p_principal,p_wp_user_id,p_request,p_settlement_actor);
 if ctx->>'state'<>'OPEN' or ctx->>'match_binding' is distinct from p_receipt->>'match_binding'
   or (ctx->>'amount_cents')::bigint is distinct from (p_receipt->>'amount_cents')::bigint
   or (p_receipt->>'received_at')::timestamptz < to_timestamp((ctx->>'created_epoch')::bigint)
   or (p_receipt->>'received_at')::timestamptz > clock_timestamp()+interval '300 seconds'
   or p_receipt->>'received_at' is null then raise exception 'Current private request or authenticated receipt binding changed';end if;
 select * into strict r from missionaccounts_finance_qa.financial_payment_request where id=p_request for update;
 select * into strict o from missionaccounts_finance_qa.financial_obligation where id=r.obligation_id;
 select * into strict g from missionaccounts_finance_qa.financial_agreement where id=o.agreement_id;
 insert into missionaccounts_finance_qa.source_artifact(source_kind,source_path,sha256,byte_count,observed_at)
 values('mr_chase_v2_receipt','chase-zelle-v2:'||fp,dg,octet_length(p_receipt::text),clock_timestamp()) returning id into artifact;
 paid:=missionaccounts_finance_qa.api_record_verified_financial_payment(p_settlement_actor,jsonb_build_object(
 'subject_key',r.subject_key,'agreement_version',g.version,'provider','Chase','provider_account',p_receipt->>'provider_account',
 'provider_identity',fp,'method','ZELLE','gross_cents',r.amount_cents,'payer',ctx->>'payer_name','received_at',p_receipt->>'received_at',
 'received_precision','EXACT','verification_state','VERIFIED','request_id','mr-chase-v2:'||fp,'artifact_id',artifact,
 'evidence',jsonb_build_array(jsonb_build_object('type','CHASE_TRANSACTION_V2_FINGERPRINT','reference',fp,'fingerprint',fp,
 'metadata',jsonb_build_object('authenticity_verified',true,'global_claim_verified',true,'match_binding',ctx->>'match_binding','message_fingerprint',p_receipt->>'message_fingerprint'))),
 'applications',jsonb_build_array(jsonb_build_object('obligation_key',o.obligation_key,'component',o.component,'amount_cents',r.amount_cents))));
 if r.installment_id is not null then
  select id into strict application from missionaccounts_finance_qa.financial_payment_application where payment_id=(paid->>'payment_id')::uuid and obligation_id=o.id;
  insert into missionaccounts_finance_qa.financial_schedule_application values(r.installment_id,application,r.amount_cents);
 end if;
 ev:=missionaccounts_finance_qa.financial_append_operation(p_principal,p_wp_user_id,r.subject_key,'CHASE_PAYMENT_SETTLED','{}',
 jsonb_build_object('request_id',r.id,'payment_id',paid->>'payment_id','amount_cents',r.amount_cents),'mr-chase-v2:'||fp,'DR-389:CHASE_V2_RESERVED',dg);
 insert into missionaccounts_finance_qa.financial_request_result values(r.id,ev,'SETTLED',(paid->>'payment_id')::uuid);
 return jsonb_build_object('state','SETTLED','payment_id',paid->>'payment_id','duplicate',false);
end $$;
revoke execute on function missionaccounts_finance_qa.financial_chase_normalize_payer(text),missionaccounts_finance_qa.financial_chase_binding(uuid,uuid,bigint,text,bigint),missionaccounts_finance_qa.financial_chase_candidates(bigint,text),missionaccounts_finance_qa.api_financial_chase_context(uuid,bigint,uuid,text),missionaccounts_finance_qa.api_financial_settle_chase_request(uuid,bigint,uuid,text,jsonb) from public,anon,authenticated,service_role;
grant execute on function missionaccounts_finance_qa.api_financial_chase_context(uuid,bigint,uuid,text),missionaccounts_finance_qa.api_financial_settle_chase_request(uuid,bigint,uuid,text,jsonb) to service_role;
-- Existing writer permissions and all gates are preserved; no principal or provider config is granted.

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
