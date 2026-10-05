-- Migration: 20261005024948_mission_residency_financial_backend.sql
-- Date: 2026-10-05 UTC
-- Authority: DR-379 / MR-FINANCIAL-ACCOUNTS-PHASE1
-- Target: isolated missionaccounts-production / dwwsahpzblgrgducxtzw
-- Depends on: missionaccounts_initial_schema (source_artifact, import_run, audit_event, student)
-- Description: Private canonical agreements/receipts/applications and atomic sealed staging.
-- Idempotent: NO (schema); staging and settlement RPCs are exact-payload idempotent.
-- Rollback: all migration/import statements transactional; retain immutable history after commit.
-- Feature gates: student publication FALSE; collections FALSE; no provider dispatch.
-- Source-only until independent exact migration, recovery, target and lease gates PASS.
-- DR-379: private Mission Residency accounting only. No provider dispatch or UI.
begin;
create table missionaccounts.financial_principal (
 actor_id text primary key, authority_ref text not null,
 stage_bundle_digest text check(stage_bundle_digest ~ '^[0-9a-f]{64}$'),
 capabilities text[] not null check (capabilities <@ array['read','stage','settle']::text[]),
 created_at timestamptz not null default now()
);
create table missionaccounts.financial_subject (
 subject_key text primary key, program_key text not null check(program_key='mission_residency'),
 wp_subject text unique check(wp_subject ~ '^wp:[0-9]+$'),
 student_id uuid unique references missionaccounts.student(id),
 binding_state text not null check(binding_state in ('UNRESOLVED','VERIFIED')),
 certification_state text not null check(certification_state in ('CERTIFIED','HELD')),
 artifact_id uuid not null references missionaccounts.source_artifact(id),
 student_visible boolean not null default false check(not student_visible),
 collections_enabled boolean not null default false check(not collections_enabled),
 check ((binding_state='VERIFIED')=(student_id is not null)),
 check (certification_state='HELD' or wp_subject is not null),
 created_at timestamptz not null default now()
);
-- Financial enrollment is agreement membership, not the existing TTL course-access projection.
create table missionaccounts.financial_agreement (
 id uuid primary key default gen_random_uuid(), subject_key text not null references missionaccounts.financial_subject,
 version text not null, currency text not null check(currency='USD'), program text not null, tier text,
 accepted_tuition_cents bigint not null check(accepted_tuition_cents>=0),
 accepted_fees_cents bigint not null check(accepted_fees_cents>=0), deposit_cents bigint check(deposit_cents>=0),
 effective_on date, effective_precision text not null check(effective_precision in ('EXACT','UNKNOWN')),
 plan jsonb not null, discount_provenance jsonb not null, agreement_evidence jsonb not null,
 certification_status text not null check(certification_status in ('CERTIFIED_PAID_IN_FULL','CERTIFIED_BALANCE_DUE','CERTIFIED_ACTIVE_PLAN')),
 certified_at timestamptz not null, artifact_id uuid not null references missionaccounts.source_artifact,
 unique(subject_key,version), check((effective_precision='EXACT')=(effective_on is not null))
);
create table missionaccounts.financial_obligation (
 id uuid primary key default gen_random_uuid(), agreement_id uuid not null references missionaccounts.financial_agreement,
 obligation_key text not null,
 component text not null check(component in ('DEPOSIT','TUITION_PRINCIPAL','INSTALLMENT','ADMIN_PROCESSING_FEE','OTHER_AUTHORIZED_FEE')),
 original_cents bigint not null check(original_cents>0), due_on date,
 due_precision text not null default 'UNKNOWN' check(due_precision in ('EXACT','UNKNOWN')),
 unique(agreement_id,obligation_key), check((due_precision='EXACT')=(due_on is not null))
);
create table missionaccounts.financial_payment (
 id uuid primary key default gen_random_uuid(), subject_key text not null references missionaccounts.financial_subject,
 provider text not null check(provider in ('Chase','Stripe','Bank')),
 provider_account text not null, provider_identity text not null,
 method text not null check(method in ('ZELLE','CARD','WIRE')), currency text not null check(currency='USD'),
 gross_cents bigint not null check(gross_cents>0), payer text not null,
 received_at timestamptz not null, received_precision text not null,
 verified_at timestamptz not null default now(), verification_state text not null check(verification_state='VERIFIED'),
 request_id text not null unique, request_digest text not null,
 artifact_id uuid not null references missionaccounts.source_artifact,
 unique(provider,provider_account,provider_identity)
);
create table missionaccounts.financial_payment_evidence (
 fingerprint text primary key check(fingerprint ~ '^[0-9a-f]{64}$'),
 payment_id uuid not null references missionaccounts.financial_payment,
 evidence_type text not null, provider text not null, provider_reference text not null,
 artifact_id uuid not null references missionaccounts.source_artifact,
 metadata jsonb not null, verified boolean not null check(verified),
 unique(provider,provider_reference,evidence_type)
);
create table missionaccounts.financial_payment_application (
 id uuid primary key default gen_random_uuid(), payment_id uuid not null references missionaccounts.financial_payment,
 obligation_id uuid not null references missionaccounts.financial_obligation,
 amount_cents bigint not null check(amount_cents>0), unique(payment_id,obligation_id),
 created_at timestamptz not null default now()
);
create table missionaccounts.financial_adjustment (
 id uuid primary key default gen_random_uuid(), obligation_id uuid references missionaccounts.financial_obligation,
 payment_id uuid references missionaccounts.financial_payment,
 kind text not null check(kind in ('WAIVER','CREDIT','REFUND')),
 amount_cents bigint not null check(amount_cents>0), authority_ref text not null,
 evidence_fingerprint text not null check(evidence_fingerprint ~ '^[0-9a-f]{64}$'),
 created_at timestamptz not null default now(),
 check((kind='REFUND' and payment_id is not null and obligation_id is null)
    or (kind<>'REFUND' and obligation_id is not null and payment_id is null))
);
create table missionaccounts.financial_payer_alias (
 id uuid primary key default gen_random_uuid(), subject_key text not null references missionaccounts.financial_subject,
 payer text not null, relationship text not null check(relationship in ('EXPLICIT_FAMILY','VERIFIED_BENEFICIARY_RELATIONSHIP_UNKNOWN')),
 provenance jsonb not null, auto_settle boolean not null default false check(not auto_settle),
 artifact_id uuid not null references missionaccounts.source_artifact, unique(subject_key,payer)
);
create table missionaccounts.financial_reconciliation_case (
 id uuid primary key default gen_random_uuid(), subject_key text not null references missionaccounts.financial_subject,
 hold_class text not null, reason text not null, artifact_id uuid not null references missionaccounts.source_artifact,
 unique(subject_key,artifact_id)
);
create index financial_agreement_subject_idx on missionaccounts.financial_agreement(subject_key);
create unique index financial_chase_global_reference_idx on missionaccounts.financial_payment(provider_identity) where provider='Chase';
create index financial_payment_subject_idx on missionaccounts.financial_payment(subject_key);
create index financial_application_obligation_idx on missionaccounts.financial_payment_application(obligation_id);
create index financial_evidence_payment_idx on missionaccounts.financial_payment_evidence(payment_id);
create index financial_adjustment_obligation_idx on missionaccounts.financial_adjustment(obligation_id);
create index financial_adjustment_payment_idx on missionaccounts.financial_adjustment(payment_id);

create function missionaccounts.financial_require_principal(p_actor text,p_capability text)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from missionaccounts.financial_principal where actor_id=p_actor and p_capability=any(capabilities)) then
  raise exception 'financial principal capability denied' using errcode='42501';
 end if;
end $$;

create function missionaccounts.financial_guard_owner()
returns trigger language plpgsql security definer set search_path='' as $$
declare k text; state text; g missionaccounts.financial_agreement; total bigint; cap bigint;
begin
 if TG_TABLE_NAME='financial_agreement' then k:=new.subject_key;
 elsif TG_TABLE_NAME='financial_obligation' then
  select * into strict g from missionaccounts.financial_agreement where id=new.agreement_id for update; k:=g.subject_key;
  if new.component in ('DEPOSIT','TUITION_PRINCIPAL','INSTALLMENT') then
   cap:=g.accepted_tuition_cents;
   select coalesce(sum(original_cents),0) into total from missionaccounts.financial_obligation where agreement_id=g.id and component in ('DEPOSIT','TUITION_PRINCIPAL','INSTALLMENT');
  else
   cap:=g.accepted_fees_cents;
   select coalesce(sum(original_cents),0) into total from missionaccounts.financial_obligation where agreement_id=g.id and component in ('ADMIN_PROCESSING_FEE','OTHER_AUTHORIZED_FEE');
  end if;
  if new.original_cents+total>cap then raise exception 'obligations exceed certified agreement component'; end if;
 elsif TG_TABLE_NAME='financial_payment' then k:=new.subject_key;
 end if;
 select certification_state into state from missionaccounts.financial_subject where subject_key=k;
 if state is distinct from 'CERTIFIED' then raise exception 'held financial subject has no financial responsibility'; end if;
 return new;
end $$;
create trigger financial_agreement_certified before insert on missionaccounts.financial_agreement for each row execute function missionaccounts.financial_guard_owner();
create trigger financial_obligation_certified before insert on missionaccounts.financial_obligation for each row execute function missionaccounts.financial_guard_owner();
create trigger financial_payment_certified before insert on missionaccounts.financial_payment for each row execute function missionaccounts.financial_guard_owner();

create function missionaccounts.financial_guard_application()
returns trigger language plpgsql security definer set search_path='' as $$
declare p missionaccounts.financial_payment; o missionaccounts.financial_obligation; owner_key text; applied bigint; adjusted bigint;
begin
 select * into strict p from missionaccounts.financial_payment where id=new.payment_id for update;
 select * into strict o from missionaccounts.financial_obligation where id=new.obligation_id for update;
 select subject_key into strict owner_key from missionaccounts.financial_agreement where id=o.agreement_id;
 if p.subject_key<>owner_key then raise exception 'cross-subject application denied'; end if;
 select coalesce(sum(amount_cents),0) into applied from missionaccounts.financial_payment_application where payment_id=p.id;
 select coalesce(sum(amount_cents),0) into adjusted from missionaccounts.financial_adjustment where payment_id=p.id and kind='REFUND';
 if applied+new.amount_cents>p.gross_cents-adjusted then raise exception 'payment overapplication denied'; end if;
 select coalesce(sum(amount_cents),0) into applied from missionaccounts.financial_payment_application where obligation_id=o.id;
 select coalesce(sum(amount_cents),0) into adjusted from missionaccounts.financial_adjustment where obligation_id=o.id;
 if applied+adjusted+new.amount_cents>o.original_cents then raise exception 'obligation overapplication denied'; end if;
 return new;
end $$;
create trigger financial_application_cap before insert on missionaccounts.financial_payment_application for each row execute function missionaccounts.financial_guard_application();

create function missionaccounts.financial_guard_adjustment()
returns trigger language plpgsql security definer set search_path='' as $$
declare available bigint; consumed bigint;
begin
 if new.kind='REFUND' then
  select gross_cents into strict available from missionaccounts.financial_payment where id=new.payment_id for update;
  select coalesce(sum(amount_cents),0) into consumed from missionaccounts.financial_payment_application where payment_id=new.payment_id;
  consumed:=consumed+(select coalesce(sum(amount_cents),0) from missionaccounts.financial_adjustment where payment_id=new.payment_id);
 else
  select original_cents into strict available from missionaccounts.financial_obligation where id=new.obligation_id for update;
  select coalesce(sum(amount_cents),0) into consumed from missionaccounts.financial_payment_application where obligation_id=new.obligation_id;
  consumed:=consumed+(select coalesce(sum(amount_cents),0) from missionaccounts.financial_adjustment where obligation_id=new.obligation_id);
 end if;
 if new.amount_cents+consumed>available then raise exception 'adjustment exceeds unapplied available amount'; end if;
 return new;
end $$;
create trigger financial_adjustment_cap before insert on missionaccounts.financial_adjustment for each row execute function missionaccounts.financial_guard_adjustment();

create view missionaccounts.financial_obligation_state with(security_invoker=true) as
 select o.*, greatest(o.original_cents-coalesce(a.applied,0)-coalesce(c.adjusted,0),0)::bigint remaining_cents,
 case when o.original_cents=coalesce(a.applied,0)+coalesce(c.adjusted,0) then 'SETTLED'
      when o.due_precision='UNKNOWN' then 'BALANCE_DUE_DATE_UNKNOWN'
      when o.due_on<current_date then 'OVERDUE' else 'OPEN' end status
 from missionaccounts.financial_obligation o
 left join (select obligation_id,sum(amount_cents) applied from missionaccounts.financial_payment_application group by obligation_id) a on a.obligation_id=o.id
 left join (select obligation_id,sum(amount_cents) adjusted from missionaccounts.financial_adjustment where obligation_id is not null group by obligation_id) c on c.obligation_id=o.id;
create view missionaccounts.financial_balance with(security_invoker=true) as
 select g.subject_key,g.id agreement_id,g.accepted_tuition_cents,g.accepted_fees_cents,
 coalesce(sum(o.remaining_cents),0)::bigint balance_cents,
 case when bool_or(o.remaining_cents>0 and o.due_precision='UNKNOWN') then null
      else coalesce(sum(o.remaining_cents) filter(where o.due_on<=current_date),0)::bigint end currently_due_cents,
 case when bool_or(o.remaining_cents>0 and o.due_precision='UNKNOWN') then null
      else coalesce(sum(o.remaining_cents) filter(where o.due_on<current_date),0)::bigint end overdue_cents,
 false student_visible,false payable
 from missionaccounts.financial_agreement g left join missionaccounts.financial_obligation_state o on o.agreement_id=g.id
 group by g.id;
create view missionaccounts.financial_unapplied_credit with(security_invoker=true) as
 select p.id payment_id,p.subject_key,(p.gross_cents-coalesce(a.applied,0)-coalesce(r.refunded,0))::bigint credit_cents
 from missionaccounts.financial_payment p
 left join(select payment_id,sum(amount_cents) applied from missionaccounts.financial_payment_application group by payment_id) a on a.payment_id=p.id
 left join(select payment_id,sum(amount_cents) refunded from missionaccounts.financial_adjustment where kind='REFUND' group by payment_id) r on r.payment_id=p.id;

-- One transaction used by both provider adapters. Exact retries succeed; changed/cross-subject retries fail.
create function missionaccounts.api_record_verified_financial_payment(p_actor text,p_payment jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare existing missionaccounts.financial_payment; pid uuid; x jsonb; oid uuid; applied bigint:=0; digest text;
begin
 perform missionaccounts.financial_require_principal(p_actor,'settle');
 digest:=encode(extensions.digest(p_payment::text,'sha256'),'hex');
 perform pg_advisory_xact_lock(hashtextextended('financial-payment:'||(p_payment->>'provider')||':'||(p_payment->>'provider_identity'),0));
 select * into existing from missionaccounts.financial_payment where request_id=p_payment->>'request_id'
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
 perform 1 from missionaccounts.financial_agreement where subject_key=p_payment->>'subject_key' for update;
 if not found then raise exception 'certified agreement required'; end if;
 insert into missionaccounts.financial_payment(subject_key,provider,provider_account,provider_identity,method,currency,gross_cents,payer,received_at,received_precision,verification_state,request_id,request_digest,artifact_id)
 values(p_payment->>'subject_key',p_payment->>'provider',p_payment->>'provider_account',p_payment->>'provider_identity',p_payment->>'method','USD',(p_payment->>'gross_cents')::bigint,p_payment->>'payer',(p_payment->>'received_at')::timestamptz,p_payment->>'received_precision','VERIFIED',p_payment->>'request_id',digest,(p_payment->>'artifact_id')::uuid) returning id into pid;
 for x in select value from jsonb_array_elements(p_payment->'evidence') loop
  insert into missionaccounts.financial_payment_evidence(fingerprint,payment_id,evidence_type,provider,provider_reference,artifact_id,metadata,verified)
  values(x->>'fingerprint',pid,x->>'type',p_payment->>'provider',x->>'reference',(p_payment->>'artifact_id')::uuid,x->'metadata',true);
 end loop;
 for x in select value from jsonb_array_elements(p_payment->'applications') loop
  select o.id into strict oid from missionaccounts.financial_obligation o join missionaccounts.financial_agreement g on g.id=o.agreement_id
   where g.subject_key=p_payment->>'subject_key' and g.version=p_payment->>'agreement_version' and o.obligation_key=x->>'obligation_key' and o.component=x->>'component';
  insert into missionaccounts.financial_payment_application(payment_id,obligation_id,amount_cents) values(pid,oid,(x->>'amount_cents')::bigint);
  applied:=applied+(x->>'amount_cents')::bigint;
 end loop;
 insert into missionaccounts.audit_event(actor_id,actor_role,kind,text,to_val,reason,request_id)
 values(p_actor,'financial_service','financial.payment_recorded','Verified private financial payment and applications',jsonb_build_object('subject_key',p_payment->>'subject_key','payment_id',pid,'gross_cents',p_payment->'gross_cents','applied_cents',applied),'Certified evidence; no dispatch',p_payment->>'request_id');
 return jsonb_build_object('payment_id',pid,'duplicate',false,'applied_cents',applied,'credit_cents',(p_payment->>'gross_cents')::bigint-applied);
end $$;

-- Stage a fully validated sealed-input bundle atomically, including all held cases but no held debt.
create function missionaccounts.api_stage_certified_financial_bundle(p_actor text,p_bundle jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare artifact uuid; run_id uuid; s jsonb; p jsonb; x jsonb; aid uuid; prior missionaccounts.import_run; digest text; rid text;
begin
 perform missionaccounts.financial_require_principal(p_actor,'stage');
 perform missionaccounts.financial_require_principal(p_actor,'settle');
 rid:=p_bundle->>'request_id';digest:=encode(extensions.digest(p_bundle::text,'sha256'),'hex');
 if not exists(select 1 from missionaccounts.financial_principal where actor_id=p_actor and stage_bundle_digest=digest) then raise exception 'exact approved staging bundle digest required'; end if;
 if p_bundle->>'source_sha256' is distinct from '2f27f12314d43f7f36834164ff210b4f208697c7f64458d7aaa2ce0696121006'
  or jsonb_typeof(p_bundle->'certified') is distinct from 'array' or jsonb_typeof(p_bundle->'held') is distinct from 'array' or jsonb_typeof(p_bundle->'payments') is distinct from 'array'
  then raise exception 'sealed source contract required'; end if;
 perform pg_advisory_xact_lock(hashtextextended('financial-import:'||rid,0));
 select * into prior from missionaccounts.import_run where request_id=rid;
 if found then
  if prior.source_controls->>'bundle_digest'<>digest or prior.state<>'applied' then raise exception 'import replay conflict'; end if;
  return jsonb_build_object('duplicate',true,'import_run_id',prior.id);
 end if;
 if p_bundle->>'version' is distinct from 'match360-phase0c-v1' or jsonb_array_length(p_bundle->'certified')<>11 or jsonb_array_length(p_bundle->'held')<>6 then raise exception 'sealed tranche contract mismatch'; end if;
 insert into missionaccounts.source_artifact(source_kind,source_path,sha256,byte_count,observed_at)
 values('match360_phase0c',p_bundle->>'source_ref',p_bundle->>'source_sha256',(p_bundle->>'byte_count')::bigint,(p_bundle->>'certified_at')::timestamptz)
 on conflict(source_kind,sha256) do nothing;
 select id into strict artifact from missionaccounts.source_artifact where source_kind='match360_phase0c' and sha256=p_bundle->>'source_sha256';
 insert into missionaccounts.import_run(artifact_id,request_id,state,source_controls) values(artifact,rid,'pending',jsonb_build_object('bundle_digest',digest,'version',p_bundle->>'version')) returning id into run_id;
 for s in select value from jsonb_array_elements(p_bundle->'certified') loop
  insert into missionaccounts.financial_subject(subject_key,program_key,wp_subject,student_id,binding_state,certification_state,artifact_id)
  values(s->>'subject_key','mission_residency',s->>'wp_subject',null,'UNRESOLVED','CERTIFIED',artifact);
  insert into missionaccounts.financial_agreement(subject_key,version,currency,program,tier,accepted_tuition_cents,accepted_fees_cents,deposit_cents,effective_precision,plan,discount_provenance,agreement_evidence,certification_status,certified_at,artifact_id)
  values(s->>'subject_key',p_bundle->>'version','USD',s->>'program',s->>'tier',(s->>'tuition_cents')::bigint,(s->>'fees_cents')::bigint,(s->>'deposit_cents')::bigint,'UNKNOWN',s->'plan',s->'discount_provenance',s->'agreement_evidence',s->>'certification_status',(p_bundle->>'certified_at')::timestamptz,artifact) returning id into aid;
  if (s->>'tuition_cents')::bigint>0 then insert into missionaccounts.financial_obligation(agreement_id,obligation_key,component,original_cents) values(aid,'tuition-principal','TUITION_PRINCIPAL',(s->>'tuition_cents')::bigint); end if;
  if (s->>'fees_cents')::bigint>0 then insert into missionaccounts.financial_obligation(agreement_id,obligation_key,component,original_cents) values(aid,'admin-processing-fee','ADMIN_PROCESSING_FEE',(s->>'fees_cents')::bigint); end if;
  for x in select value from jsonb_array_elements(s->'payer_aliases') loop
   insert into missionaccounts.financial_payer_alias(subject_key,payer,relationship,provenance,artifact_id) values(s->>'subject_key',x->>'payer',x->>'relationship',x->'provenance',artifact);
  end loop;
 end loop;
 for s in select value from jsonb_array_elements(p_bundle->'held') loop
  insert into missionaccounts.financial_subject(subject_key,program_key,wp_subject,binding_state,certification_state,artifact_id) values(s->>'subject_key','mission_residency',s->>'wp_subject','UNRESOLVED','HELD',artifact);
  insert into missionaccounts.financial_reconciliation_case(subject_key,hold_class,reason,artifact_id) values(s->>'subject_key',s->>'hold_class',s->>'reason',artifact);
 end loop;
 for p in select value from jsonb_array_elements(p_bundle->'payments') loop
  perform missionaccounts.api_record_verified_financial_payment(p_actor,p||jsonb_build_object('artifact_id',artifact,'agreement_version',p_bundle->>'version'));
 end loop;
 update missionaccounts.import_run set state='applied',finished_at=now(),result_controls=jsonb_build_object('certified',jsonb_array_length(p_bundle->'certified'),'held',jsonb_array_length(p_bundle->'held'),'payments',jsonb_array_length(p_bundle->'payments')) where id=run_id;
 insert into missionaccounts.audit_event(actor_id,actor_role,kind,text,to_val,reason,request_id)
 values(p_actor,'financial_service','financial.bundle_staged','Sealed private accounting tranche staged',jsonb_build_object('artifact_id',artifact,'import_run_id',run_id,'student_visible',false,'dispatch',false),'No student publication or collection',rid);
 return jsonb_build_object('duplicate',false,'import_run_id',run_id);
end $$;

-- Preserve reused source-artifact provenance only for this domain's referenced rows.
create function missionaccounts.financial_guard_artifact()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from missionaccounts.financial_subject where artifact_id=old.id)
  or exists(select 1 from missionaccounts.financial_agreement where artifact_id=old.id)
  or exists(select 1 from missionaccounts.financial_payment where artifact_id=old.id)
  or exists(select 1 from missionaccounts.financial_payment_evidence where artifact_id=old.id)
  or exists(select 1 from missionaccounts.financial_payer_alias where artifact_id=old.id)
  or exists(select 1 from missionaccounts.financial_reconciliation_case where artifact_id=old.id) then
  raise exception 'sealed financial source artifact is immutable';
 end if;
 if TG_OP='DELETE' then return old; end if; return new;
end $$;
create trigger financial_artifact_immutable before update or delete on missionaccounts.source_artifact
 for each row execute function missionaccounts.financial_guard_artifact();

create function missionaccounts.api_read_financial_accounts(p_actor text)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform missionaccounts.financial_require_principal(p_actor,'read');
 return (select coalesce(jsonb_agg(to_jsonb(b) order by subject_key),'[]'::jsonb) from missionaccounts.financial_balance b);
end $$;

-- Explicit service-only API. No student grants/policies, no generic WordPress admin mapping.
do $$ declare t text; f record; begin
 foreach t in array array['financial_principal','financial_subject','financial_agreement','financial_obligation','financial_payment','financial_payment_evidence','financial_payment_application','financial_adjustment','financial_payer_alias','financial_reconciliation_case'] loop
  execute format('alter table missionaccounts.%I enable row level security',t);
  execute format('alter table missionaccounts.%I force row level security',t);
  execute format('revoke all on missionaccounts.%I from public,anon,authenticated,service_role',t);
  execute format('grant select on missionaccounts.%I to service_role',t);
  execute format('create trigger %I before update or delete on missionaccounts.%I for each row execute function missionaccounts.reject_immutable_change()',t||'_immutable',t);
 end loop;
 for f in select p.oid::regprocedure sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='missionaccounts' and (p.proname like 'financial_%' or p.proname in ('api_record_verified_financial_payment','api_stage_certified_financial_bundle','api_read_financial_accounts')) loop
  execute format('revoke execute on function %s from public,anon,authenticated,service_role',f.sig);
 end loop;
end $$;
revoke all on missionaccounts.financial_obligation_state,missionaccounts.financial_balance,missionaccounts.financial_unapplied_credit from public,anon,authenticated,service_role;
grant select on missionaccounts.financial_obligation_state,missionaccounts.financial_balance,missionaccounts.financial_unapplied_credit to service_role;
grant execute on function missionaccounts.api_record_verified_financial_payment(text,jsonb),missionaccounts.api_stage_certified_financial_bundle(text,jsonb),missionaccounts.api_read_financial_accounts(text) to service_role;
-- No principal grant in schema migration: exact staging custody authorizes a separate bounded grant.
commit;
