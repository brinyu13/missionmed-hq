-- DR-389/DR-387: source-only canonical refund readback and private safe receipts.
-- No dispatch, publication, provider mutation, certification or gate activation.
begin;
create table missionaccounts.financial_refund (
 id uuid primary key, payment_id uuid not null references missionaccounts.financial_payment,
 adjustment_id uuid not null unique references missionaccounts.financial_adjustment deferrable initially deferred,
 provider text not null check(provider in ('Stripe','Chase','Bank')), provider_account text not null,
 refund_reference text not null check(refund_reference ~ '^[A-Za-z0-9._:-]{1,160}$'),
 amount_cents bigint not null check(amount_cents>0), confirmed_at timestamptz not null,
 actor_id uuid not null, request_id text not null unique, request_digest text not null,
 authority_ref text not null, evidence_sha256 text not null check(evidence_sha256 ~ '^[a-f0-9]{64}$'),
 created_at timestamptz not null default now(), unique(provider,provider_account,refund_reference)
);
create table missionaccounts.financial_application_reversal (
 refund_id uuid not null references missionaccounts.financial_refund,
 application_id uuid not null references missionaccounts.financial_payment_application,
 amount_cents bigint not null check(amount_cents>0), primary key(refund_id,application_id)
);
create table missionaccounts.financial_schedule_reversal (
 refund_id uuid not null, application_id uuid not null, installment_id uuid not null,
 amount_cents bigint not null check(amount_cents>0), primary key(refund_id,application_id,installment_id),
 foreign key(refund_id,application_id) references missionaccounts.financial_application_reversal(refund_id,application_id),
 foreign key(installment_id,application_id) references missionaccounts.financial_schedule_application(installment_id,payment_application_id)
);
create view missionaccounts.financial_net_application with(security_invoker=true) as
 select a.*, (a.amount_cents-coalesce(r.amount_cents,0))::bigint net_cents
 from missionaccounts.financial_payment_application a left join
 (select application_id,sum(amount_cents) amount_cents from missionaccounts.financial_application_reversal group by application_id) r on r.application_id=a.id;
create view missionaccounts.financial_net_schedule_application with(security_invoker=true) as
 select a.*, (a.amount_cents-coalesce(r.amount_cents,0))::bigint net_cents
 from missionaccounts.financial_schedule_application a left join
 (select application_id,installment_id,sum(amount_cents) amount_cents from missionaccounts.financial_schedule_reversal group by application_id,installment_id) r
 on r.application_id=a.payment_application_id and r.installment_id=a.installment_id;

-- Replacement guards preserve original immutable applications and use net audited allocations.
create or replace function missionaccounts.financial_guard_application()
returns trigger language plpgsql security definer set search_path='' as $$
declare p missionaccounts.financial_payment; o missionaccounts.financial_obligation; owner_key text; applied bigint; adjusted bigint;
begin
 select * into strict p from missionaccounts.financial_payment where id=new.payment_id for update;
 select * into strict o from missionaccounts.financial_obligation where id=new.obligation_id for update;
 select subject_key into strict owner_key from missionaccounts.financial_agreement where id=o.agreement_id;
 if p.subject_key<>owner_key then raise exception 'cross-subject application denied';end if;
 select coalesce(sum(net_cents),0) into applied from missionaccounts.financial_net_application where payment_id=p.id;
 select coalesce(sum(amount_cents),0) into adjusted from missionaccounts.financial_adjustment where payment_id=p.id and kind='REFUND';
 if applied+new.amount_cents>p.gross_cents-adjusted then raise exception 'payment overapplication denied';end if;
 select coalesce(sum(net_cents),0) into applied from missionaccounts.financial_net_application where obligation_id=o.id;
 select coalesce(sum(amount_cents),0) into adjusted from missionaccounts.financial_adjustment where obligation_id=o.id;
 if applied+adjusted+new.amount_cents>o.original_cents then raise exception 'obligation overapplication denied';end if;
 return new;
end $$;
create or replace function missionaccounts.financial_guard_adjustment()
returns trigger language plpgsql security definer set search_path='' as $$
declare available bigint; consumed bigint;
begin
 if new.kind='REFUND' then
  select gross_cents into strict available from missionaccounts.financial_payment where id=new.payment_id for update;
  select coalesce(sum(net_cents),0) into consumed from missionaccounts.financial_net_application where payment_id=new.payment_id;
  consumed:=consumed+(select coalesce(sum(amount_cents),0) from missionaccounts.financial_adjustment where payment_id=new.payment_id);
 else
  select original_cents into strict available from missionaccounts.financial_obligation where id=new.obligation_id for update;
  select coalesce(sum(net_cents),0) into consumed from missionaccounts.financial_net_application where obligation_id=new.obligation_id;
  consumed:=consumed+(select coalesce(sum(amount_cents),0) from missionaccounts.financial_adjustment where obligation_id=new.obligation_id);
 end if;
 if new.amount_cents+consumed>available then raise exception 'adjustment exceeds unapplied available amount';end if;
 return new;
end $$;
create or replace function missionaccounts.financial_guard_schedule_application()
returns trigger language plpgsql security definer set search_path='' as $$
declare i missionaccounts.financial_schedule_installment; a missionaccounts.financial_net_application; owner text;
begin
 select * into strict i from missionaccounts.financial_schedule_installment where id=new.installment_id for update;
 -- Lock canonical original; net view is an aggregate read and cannot be row locked.
 perform 1 from missionaccounts.financial_payment_application where id=new.payment_application_id for update;
 select * into strict a from missionaccounts.financial_net_application where id=new.payment_application_id;
 select subject_key into strict owner from missionaccounts.financial_schedule_revision where id=i.revision_id;
 if a.obligation_id<>i.obligation_id or owner<>(select subject_key from missionaccounts.financial_payment where id=a.payment_id) then raise exception 'Schedule allocation ownership mismatch';end if;
 if new.amount_cents+(select coalesce(sum(net_cents),0) from missionaccounts.financial_net_schedule_application where payment_application_id=a.id)>a.net_cents then raise exception 'Schedule allocation exceeds canonical application';end if;
 if new.amount_cents+(select coalesce(sum(net_cents),0) from missionaccounts.financial_net_schedule_application where installment_id=i.id)>i.amount_cents then raise exception 'Schedule allocation exceeds installment';end if;
 return new;
end $$;
create or replace view missionaccounts.financial_obligation_state with(security_invoker=true) as
 select o.*,greatest(o.original_cents-coalesce(a.applied,0)-coalesce(c.adjusted,0),0)::bigint remaining_cents,
 case when o.original_cents=coalesce(a.applied,0)+coalesce(c.adjusted,0) then 'SETTLED'
 when o.due_precision='UNKNOWN' then 'BALANCE_DUE_DATE_UNKNOWN'
 when o.due_on<current_date then 'OVERDUE' else 'OPEN' end status
 from missionaccounts.financial_obligation o
 left join (select obligation_id,sum(net_cents) applied from missionaccounts.financial_net_application group by obligation_id) a on a.obligation_id=o.id
 left join (select obligation_id,sum(amount_cents) adjusted from missionaccounts.financial_adjustment where obligation_id is not null group by obligation_id) c on c.obligation_id=o.id;
create or replace view missionaccounts.financial_unapplied_credit with(security_invoker=true) as
 select p.id payment_id,p.subject_key,(p.gross_cents-coalesce(a.applied,0)-coalesce(r.refunded,0))::bigint credit_cents
 from missionaccounts.financial_payment p
 left join(select payment_id,sum(net_cents) applied from missionaccounts.financial_net_application group by payment_id) a on a.payment_id=p.id
 left join(select payment_id,sum(amount_cents) refunded from missionaccounts.financial_adjustment where kind='REFUND' group by payment_id) r on r.payment_id=p.id;
create or replace view missionaccounts.financial_active_schedule with(security_invoker=true) as
 select i.*,r.subject_key,coalesce(sum(a.net_cents),0)::bigint applied_cents,
 case when exists(select 1 from missionaccounts.financial_schedule_revision n where n.supersedes=r.id) then 0 else (i.amount_cents-coalesce(sum(a.net_cents),0))::bigint end remaining_cents
 from missionaccounts.financial_schedule_installment i join missionaccounts.financial_schedule_revision r on r.id=i.revision_id
 left join missionaccounts.financial_net_schedule_application a on a.installment_id=i.id
 where not exists(select 1 from missionaccounts.financial_schedule_revision n where n.supersedes=r.id)
 or exists(select 1 from missionaccounts.financial_schedule_application p where p.installment_id=i.id)
 group by i.id,r.id,r.subject_key;

create function missionaccounts.api_financial_refund_context(p_principal uuid,p_wp_user_id bigint,p_payment uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare p missionaccounts.financial_payment;
begin
 perform missionaccounts.financial_require_founder(p_principal,p_wp_user_id);
 select * into strict p from missionaccounts.financial_payment where id=p_payment;
 if (select certification_state from missionaccounts.financial_subject where subject_key=p.subject_key)<>'CERTIFIED' then raise exception 'Held financial account remains quarantined';end if;
 return jsonb_build_object('provider',p.provider,'provider_account',p.provider_account,'provider_identity',p.provider_identity,'gross_cents',p.gross_cents);
end $$;
create function missionaccounts.api_financial_record_refund(p_principal uuid,p_wp_user_id bigint,p_payment uuid,p_payload jsonb,p_request_id text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare p missionaccounts.financial_payment; old missionaccounts.financial_refund; a missionaccounts.financial_net_application;
 x jsonb; sa record; amount bigint; reversed bigint:=0; take bigint; left_to_reverse bigint;
 rid uuid:=gen_random_uuid(); adj uuid:=gen_random_uuid(); dg text; before_val jsonb; result jsonb; seen uuid[]:=array[]::uuid[];
begin
 perform missionaccounts.financial_require_founder(p_principal,p_wp_user_id);
 if p_request_id is null or p_request_id !~ '^[A-Za-z0-9._:-]{8,160}$' or p_payload->'confirmed' is distinct from 'true'::jsonb
 or p_payload->>'authority_ref' is null or p_payload->>'authority_ref' !~ '^[A-Za-z0-9._:-]{3,160}$'
 or p_payload->>'evidence_sha256' is null or p_payload->>'evidence_sha256' !~ '^[a-f0-9]{64}$'
 or jsonb_typeof(p_payload->'reversals') is distinct from 'array' then raise exception 'Confirmed accounting authority and bounded evidence required';end if;
 if jsonb_array_length(p_payload->'reversals')>100 then raise exception 'Bounded reversals required';end if;
 amount:=(p_payload->>'amount_cents')::bigint;
 if amount is null or amount<=0 or amount>9007199254740991 then raise exception 'Positive whole cents required';end if;
 dg:=encode(extensions.digest(jsonb_build_array(p_principal,p_wp_user_id,p_payment,p_payload)::text,'sha256'),'hex');
 perform pg_advisory_xact_lock(hashtextextended('mr-refund:'||p_request_id,0));
 select * into old from missionaccounts.financial_refund where request_id=p_request_id;
 if found then
  if old.request_digest<>dg then raise exception 'Refund request identity conflict';end if;
  return jsonb_build_object('refund_id',old.id,'payment_id',old.payment_id,'amount_cents',old.amount_cents,'duplicate',true);
 end if;
 select * into strict p from missionaccounts.financial_payment where id=p_payment for update;
 if (select certification_state from missionaccounts.financial_subject where subject_key=p.subject_key) is distinct from 'CERTIFIED' then raise exception 'Held financial account remains quarantined';end if;
 if p_payload->'proof'->'confirmed' is distinct from 'true'::jsonb or (p_payload->'proof'->>'amount_cents')::bigint is distinct from amount
 or p_payload->'proof'->>'provider' is distinct from p.provider
 or p_payload->'proof'->>'provider_account' is distinct from p.provider_account
 or p_payload->'proof'->>'provider_identity' is distinct from p.provider_identity
 or p_payload->'proof'->>'refund_reference' is null or p_payload->'proof'->>'refund_reference' !~ '^[A-Za-z0-9._:-]{1,160}$'
 or p_payload->'proof'->>'confirmed_at' is null
 or (p.provider='Stripe' and p_payload->'proof'->>'refund_reference' !~ '^re_[A-Za-z0-9]+$')
 or (p.provider<>'Stripe' and p_payload->'proof'->'authenticity_verified' is distinct from 'true'::jsonb) then raise exception 'Verified exact provider refund proof required';end if;
 if amount+(select coalesce(sum(amount_cents),0) from missionaccounts.financial_adjustment where payment_id=p.id and kind='REFUND')>p.gross_cents then raise exception 'Refund exceeds original receipt';end if;
 before_val:=jsonb_build_object('balance',(select balance_cents from missionaccounts.financial_balance where subject_key=p.subject_key),'credit',(select credit_cents from missionaccounts.financial_unapplied_credit where payment_id=p.id));
 insert into missionaccounts.financial_refund values(rid,p.id,adj,p.provider,p.provider_account,p_payload->'proof'->>'refund_reference',amount,(p_payload->'proof'->>'confirmed_at')::timestamptz,p_principal,p_request_id,dg,p_payload->>'authority_ref',p_payload->>'evidence_sha256',now());
 for x in select value from jsonb_array_elements(p_payload->'reversals') order by value->>'application_id' loop
  perform 1 from missionaccounts.financial_payment_application where id=(x->>'application_id')::uuid for update;
  select * into strict a from missionaccounts.financial_net_application where id=(x->>'application_id')::uuid;
  take:=(x->>'amount_cents')::bigint;
  if a.payment_id<>p.id or a.id=any(seen) or take is null or take<=0 or take>a.net_cents then raise exception 'Refund application ownership or cap mismatch';end if;
  seen:=array_append(seen,a.id);reversed:=reversed+take;
  if reversed>amount then raise exception 'Reversals exceed confirmed refund';end if;
  perform 1 from missionaccounts.financial_obligation where id=a.obligation_id for update;
  insert into missionaccounts.financial_application_reversal values(rid,a.id,take);
  -- Remove schedule allocations deterministically first; any unallocated canonical portion follows.
  left_to_reverse:=take;
  for sa in select * from missionaccounts.financial_net_schedule_application where payment_application_id=a.id order by installment_id loop
   perform 1 from missionaccounts.financial_schedule_installment where id=sa.installment_id for update;
   if left_to_reverse>0 and sa.net_cents>0 then
    insert into missionaccounts.financial_schedule_reversal values(rid,a.id,sa.installment_id,least(left_to_reverse,sa.net_cents));
    left_to_reverse:=left_to_reverse-least(left_to_reverse,sa.net_cents);
   end if;
  end loop;
 end loop;
 -- Existing canonical adjustment guard enforces net applications + cumulative refunds <= gross.
 insert into missionaccounts.financial_adjustment(id,payment_id,kind,amount_cents,authority_ref,evidence_fingerprint)
 values(adj,p.id,'REFUND',amount,p_payload->>'authority_ref',p_payload->>'evidence_sha256');
 result:=jsonb_build_object('refund_id',rid,'payment_id',p.id,'amount_cents',amount,'reversed_application_cents',reversed,
 'reversals',coalesce((select jsonb_agg(jsonb_build_object('application_id',v.application_id,'obligation_id',ap.obligation_id,'amount_cents',v.amount_cents) order by v.application_id) from missionaccounts.financial_application_reversal v join missionaccounts.financial_payment_application ap on ap.id=v.application_id where v.refund_id=rid),'[]'::jsonb),
 'balance',(select balance_cents from missionaccounts.financial_balance where subject_key=p.subject_key),
 'credit',(select credit_cents from missionaccounts.financial_unapplied_credit where payment_id=p.id),'duplicate',false);
 insert into missionaccounts.audit_event(actor_id,actor_role,kind,text,from_val,to_val,reason,request_id)
 values(p_principal::text,'founder','mr_financial_refund','Provider-confirmed canonical refund; original receipt preserved',before_val,
 result||jsonb_build_object('subject_key',p.subject_key,'provider',p.provider,'provider_reference',p_payload->'proof'->>'refund_reference','evidence_sha256',p_payload->>'evidence_sha256'),p_payload->>'authority_ref',p_request_id);
 return result;
end $$;

-- Allowlist only. No payer/contact, raw provider objects, Gmail, evidence URLs or card secrets.
create function missionaccounts.financial_safe_history(p_subject text)
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('payments',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'received_at',p.received_at,'verified_at',p.verified_at,
 'amount_cents',p.gross_cents,'currency',p.currency,'method',p.method,'provider',p.provider,'receipt_available',true,
 'net_applied_cents',(select coalesce(sum(net_cents),0) from missionaccounts.financial_net_application where payment_id=p.id),
 'refunded_cents',(select coalesce(sum(amount_cents),0) from missionaccounts.financial_adjustment where payment_id=p.id and kind='REFUND'),
 'applications',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'obligation_id',a.obligation_id,'original_cents',a.amount_cents,'net_cents',a.net_cents) order by a.created_at,a.id) from missionaccounts.financial_net_application a where a.payment_id=p.id),'[]'::jsonb),
 'refunds',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'amount_cents',r.amount_cents,'confirmed_at',r.confirmed_at,'recorded_at',r.created_at) order by r.confirmed_at,r.id) from missionaccounts.financial_refund r where r.payment_id=p.id),'[]'::jsonb)) order by p.received_at,p.id)
 from missionaccounts.financial_payment p where p.subject_key=p_subject),'[]'::jsonb))
$$;
create function missionaccounts.api_financial_founder_history(p_principal uuid,p_wp_user_id bigint,p_subject text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 perform missionaccounts.financial_require_founder(p_principal,p_wp_user_id);
 if (select certification_state from missionaccounts.financial_subject where subject_key=p_subject) is distinct from 'CERTIFIED' then return jsonb_build_object('state','ACCOUNT_REVIEW','payments','[]'::jsonb);end if;
 return missionaccounts.financial_safe_history(p_subject);
end $$;
create function missionaccounts.api_financial_own_history(p_principal uuid,p_wp_user_id bigint)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare k text;
begin
 k:=missionaccounts.financial_own_subject(p_principal,p_wp_user_id);
 if not exists(select 1 from missionaccounts.financial_operating_gate where id=1 and student_publication) then raise exception 'Student financial publication disabled' using errcode='42501';end if;
 if (select certification_state from missionaccounts.financial_subject where subject_key=k) is distinct from 'CERTIFIED' then return jsonb_build_object('state','ACCOUNT_REVIEW','payments','[]'::jsonb);end if;
 return missionaccounts.financial_safe_history(k);
end $$;
do $$declare t text; f record;
begin
 foreach t in array array['financial_refund','financial_application_reversal','financial_schedule_reversal'] loop
 execute format('alter table missionaccounts.%I enable row level security',t);
 execute format('revoke all on missionaccounts.%I from public,anon,authenticated,service_role',t);
 execute format('grant select on missionaccounts.%I to service_role',t);
 execute format('create trigger %I before update or delete on missionaccounts.%I for each row execute function missionaccounts.reject_immutable_change()',t||'_immutable',t);
 end loop;
 for f in select p.oid::regprocedure sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='missionaccounts' and p.proname in
 ('api_financial_refund_context','api_financial_record_refund','financial_safe_history','api_financial_founder_history','api_financial_own_history') loop
 execute format('revoke all on function %s from public,anon,authenticated,service_role',f.sig);
 end loop;
end $$;
revoke all on missionaccounts.financial_net_application,missionaccounts.financial_net_schedule_application from public,anon,authenticated,service_role;
grant select on missionaccounts.financial_net_application,missionaccounts.financial_net_schedule_application to service_role;
grant execute on function missionaccounts.api_financial_refund_context(uuid,bigint,uuid),missionaccounts.api_financial_record_refund(uuid,bigint,uuid,jsonb,text),
 missionaccounts.api_financial_founder_history(uuid,bigint,text),missionaccounts.api_financial_own_history(uuid,bigint) to service_role;

-- Current Founder sums use net applications; immutable originals remain explicit.
create or replace function missionaccounts.api_read_financial_command(p_principal uuid,p_wp_user_id bigint)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not missionaccounts.api_financial_read_access(p_principal,p_wp_user_id) then
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
  'obligations',coalesce((select jsonb_agg(to_jsonb(o) order by o.obligation_key) from missionaccounts.financial_obligation_state o where o.agreement_id=g.id),'[]'::jsonb),
  'payments',coalesce((select jsonb_agg(jsonb_build_object(
   'id',p.id,'date',p.received_at,'date_precision',p.received_precision,'amount_cents',p.gross_cents,
   'method',p.method,'payer',p.payer,'provider',p.provider,'verification_state',p.verification_state,
   'verified_at',p.verified_at,
   'applied_cents',coalesce((select sum(a.net_cents) from missionaccounts.financial_net_application a where a.payment_id=p.id),0),
   'unapplied_cents',(select c.credit_cents from missionaccounts.financial_unapplied_credit c where c.payment_id=p.id),
   'evidence',coalesce((select jsonb_agg(jsonb_build_object('type',e.evidence_type,'provider',e.provider,
    'reference',e.provider_reference,'fingerprint',e.fingerprint,'verified',e.verified)) from missionaccounts.financial_payment_evidence e where e.payment_id=p.id),'[]'::jsonb)
  ) order by p.received_at,p.id) from missionaccounts.financial_payment p where p.subject_key=s.subject_key),'[]'::jsonb),
  'applications',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'payment_id',a.payment_id,
   'obligation_id',a.obligation_id,'obligation',o.obligation_key,'component',o.component,
   'amount_cents',a.amount_cents,'net_cents',a.net_cents,'reversed_cents',a.amount_cents-a.net_cents,'recorded_at',a.created_at) order by a.created_at,a.id)
   from missionaccounts.financial_net_application a join missionaccounts.financial_obligation o on o.id=a.obligation_id where o.agreement_id=g.id),'[]'::jsonb),
  'adjustments',coalesce((select jsonb_agg(jsonb_build_object('kind',a.kind,'amount_cents',a.amount_cents,'authority_ref',a.authority_ref,'evidence_fingerprint',a.evidence_fingerprint,'created_at',a.created_at))
   from missionaccounts.financial_adjustment a left join missionaccounts.financial_obligation o on o.id=a.obligation_id
   left join missionaccounts.financial_payment p on p.id=a.payment_id where o.agreement_id=g.id or p.subject_key=s.subject_key),'[]'::jsonb),
  'payers',coalesce((select jsonb_agg(jsonb_build_object('payer',p.payer,'relationship',p.relationship,'provenance',p.provenance) order by p.payer) from missionaccounts.financial_payer_alias p where p.subject_key=s.subject_key),'[]'::jsonb),
  'cases',coalesce((select jsonb_agg(jsonb_build_object('type',c.hold_class,'reason',c.reason)) from missionaccounts.financial_reconciliation_case c where c.subject_key=s.subject_key),'[]'::jsonb),
  'source',jsonb_build_object('kind',a.source_kind,'sha256',a.sha256,'observed_at',a.observed_at,
    'display_sha256',d.source_sha256,'display_authority',d.authority_ref)
 ) order by coalesce(d.display_name,s.subject_key)),'[]'::jsonb)
 from missionaccounts.financial_subject s
 left join missionaccounts.financial_display_directory d on d.subject_key=s.subject_key
 left join missionaccounts.financial_agreement g on g.subject_key=s.subject_key
 left join missionaccounts.financial_balance b on b.agreement_id=g.id
 join missionaccounts.source_artifact a on a.id=s.artifact_id));
end $$;
commit;
