-- DR-387 / MR-FINANCIAL-ACCOUNTS-PHASE3. Source candidate; not deployment authority.
-- Target: isolated missionaccounts dwwsahpzblgrgducxtzw.
-- Original certified financial tables remain immutable. Schedules allocate existing residuals.
-- Feature release, account binding and provider grants require separate verified custody.
begin;
create table missionaccounts.financial_operating_gate (
 id integer primary key check(id=1), founder_operations boolean not null default false,
 student_onboarding boolean not null default false, student_publication boolean not null default false,
 card_dispatch boolean not null default false, zelle_matcher boolean not null default false,
 authority_ref text not null, updated_at timestamptz not null default now()
);
insert into missionaccounts.financial_operating_gate(id,authority_ref) values(1,'DR-387:SOURCE_ONLY');
create table missionaccounts.financial_runtime_binding (
 subject_key text primary key references missionaccounts.financial_subject,
 principal_id uuid not null unique, wp_user_id bigint not null unique check(wp_user_id>1),
 authority_ref text not null, evidence_sha256 text not null check(evidence_sha256 ~ '^[a-f0-9]{64}$'),
 active boolean not null default true, created_at timestamptz not null default now()
);
create function missionaccounts.financial_guard_runtime_binding()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from missionaccounts.financial_subject where subject_key=new.subject_key and wp_subject='wp:'||new.wp_user_id::text) then
  raise exception 'Financial binding must match the established WordPress beneficiary' using errcode='42501';
 end if;
 return new;
end $$;
create trigger financial_runtime_binding_owner before insert on missionaccounts.financial_runtime_binding
 for each row execute function missionaccounts.financial_guard_runtime_binding();
create table missionaccounts.financial_operating_event (
 id uuid primary key default gen_random_uuid(), subject_key text not null references missionaccounts.financial_subject,
 actor_id uuid not null, actor_wp_user_id bigint not null, operation text not null,
 before_state jsonb not null, after_state jsonb not null, request_id text not null unique,
 request_digest text not null check(request_digest ~ '^[a-f0-9]{64}$'),
 authority_ref text not null, evidence_sha256 text not null check(evidence_sha256 ~ '^[a-f0-9]{64}$'),
 created_at timestamptz not null default clock_timestamp(), sequence_no bigint generated always as identity unique
);
create table missionaccounts.financial_onboarding_eligibility (
 event_id uuid primary key references missionaccounts.financial_operating_event deferrable initially deferred,
 subject_key text not null references missionaccounts.financial_subject,
 required boolean not null, card_required boolean not null, reason text not null,
 check(not card_required or required)
);
create table missionaccounts.financial_payment_profile (
 event_id uuid primary key references missionaccounts.financial_operating_event deferrable initially deferred,
 subject_key text not null references missionaccounts.financial_subject,
 email text not null check(length(email) between 3 and 254), phone text not null check(length(phone) between 3 and 80),
 contact_confirmed boolean not null, arrangement_acknowledged boolean not null,
 save_method_acknowledged boolean not null
);
create table missionaccounts.financial_schedule_revision (
 id uuid primary key default gen_random_uuid(), subject_key text not null references missionaccounts.financial_subject,
 event_id uuid not null unique references missionaccounts.financial_operating_event deferrable initially deferred,
 supersedes uuid unique references missionaccounts.financial_schedule_revision,
 created_at timestamptz not null default now()
);
create table missionaccounts.financial_schedule_installment (
 id uuid primary key default gen_random_uuid(), revision_id uuid not null references missionaccounts.financial_schedule_revision,
 installment_key text not null, obligation_id uuid not null references missionaccounts.financial_obligation,
 amount_cents bigint not null check(amount_cents>0), due_on date, due_precision text not null check(due_precision in ('EXACT','UNKNOWN')),
 unique(revision_id,installment_key), check((due_precision='EXACT')=(due_on is not null))
);
create table missionaccounts.financial_schedule_application (
 installment_id uuid not null references missionaccounts.financial_schedule_installment,
 payment_application_id uuid not null references missionaccounts.financial_payment_application,
 amount_cents bigint not null check(amount_cents>0), primary key(installment_id,payment_application_id)
);
create function missionaccounts.financial_guard_schedule_application()
returns trigger language plpgsql security definer set search_path='' as $$
declare i missionaccounts.financial_schedule_installment; a missionaccounts.financial_payment_application; owner text;
begin
 select * into strict i from missionaccounts.financial_schedule_installment where id=new.installment_id for update;
 select * into strict a from missionaccounts.financial_payment_application where id=new.payment_application_id for update;
 select subject_key into strict owner from missionaccounts.financial_schedule_revision where id=i.revision_id;
 if a.obligation_id<>i.obligation_id or owner<>(select subject_key from missionaccounts.financial_payment where id=a.payment_id) then raise exception 'Schedule allocation ownership mismatch';end if;
 if new.amount_cents+(select coalesce(sum(amount_cents),0) from missionaccounts.financial_schedule_application where payment_application_id=a.id)>a.amount_cents then raise exception 'Schedule allocation exceeds canonical application';end if;
 if new.amount_cents+(select coalesce(sum(amount_cents),0) from missionaccounts.financial_schedule_application where installment_id=i.id)>i.amount_cents then raise exception 'Schedule allocation exceeds installment';end if;
 return new;
end $$;
create trigger financial_schedule_application_guard before insert on missionaccounts.financial_schedule_application
 for each row execute function missionaccounts.financial_guard_schedule_application();
create table missionaccounts.financial_payment_request (
 id uuid primary key default gen_random_uuid(), subject_key text not null references missionaccounts.financial_subject,
 obligation_id uuid not null references missionaccounts.financial_obligation,
 installment_id uuid references missionaccounts.financial_schedule_installment,
 event_id uuid not null unique references missionaccounts.financial_operating_event deferrable initially deferred,
 amount_cents bigint not null check(amount_cents>0), description text not null check(length(description) between 1 and 300),
 methods text[] not null check(cardinality(methods)>0 and methods <@ array['CARD','ZELLE']::text[]),
 expires_at timestamptz, created_at timestamptz not null default now()
);
create table missionaccounts.financial_request_result (
 request_id uuid not null references missionaccounts.financial_payment_request,
 event_id uuid primary key references missionaccounts.financial_operating_event deferrable initially deferred,
 state text not null check(state in ('REPORTED','CANCELLED','SETTLED','REVIEW_REQUIRED')),
 payment_id uuid references missionaccounts.financial_payment
);
create table missionaccounts.financial_card_binding (
 subject_key text primary key references missionaccounts.financial_subject,
 provider_account text not null check(provider_account ~ '^acct_[A-Za-z0-9]+$'),
 customer_ref text not null check(customer_ref ~ '^cus_[A-Za-z0-9]+$'),
 created_at timestamptz not null default now(), unique(provider_account,customer_ref)
);
create table missionaccounts.financial_card_setup (
 id uuid primary key default gen_random_uuid(), subject_key text not null references missionaccounts.financial_card_binding,
 request_id text not null unique, intent_ref text unique check(intent_ref ~ '^seti_[A-Za-z0-9]+$'),
 created_at timestamptz not null default now()
);
create table missionaccounts.financial_card_method (
 id uuid primary key default gen_random_uuid(), subject_key text not null references missionaccounts.financial_card_binding,
 setup_id uuid not null unique references missionaccounts.financial_card_setup,
 provider_pm_ref text not null check(provider_pm_ref ~ '^pm_[A-Za-z0-9]+$'),
 brand text not null, last4 text not null check(last4 ~ '^\d{4}$'),
 exp_month integer not null check(exp_month between 1 and 12), exp_year integer not null,
 verified_at timestamptz not null default now()
);
create table missionaccounts.financial_specific_authorization (
 id uuid primary key default gen_random_uuid(), request_id uuid not null references missionaccounts.financial_payment_request,
 subject_key text not null references missionaccounts.financial_runtime_binding,
 method_id uuid not null references missionaccounts.financial_card_method,
 amount_cents bigint not null check(amount_cents>0), terms_version text not null,
 event_id uuid not null unique references missionaccounts.financial_operating_event deferrable initially deferred,
 accepted_at timestamptz not null default now(), expires_at timestamptz not null,
 check(expires_at>accepted_at)
);
create table missionaccounts.financial_card_attempt (
 id uuid primary key default gen_random_uuid(), request_id uuid not null references missionaccounts.financial_payment_request,
 subject_key text not null references missionaccounts.financial_subject,
 amount_cents bigint not null check(amount_cents>0), provider_account text not null,
 intent_ref text unique check(intent_ref ~ '^pi_[A-Za-z0-9]+$'),
 state text not null check(state in ('PREPARED','SUBMITTED','REQUIRES_ACTION','DECLINED','AMBIGUOUS','SUCCEEDED','CANCELLED')),
 request_identity text not null unique, request_digest text not null,
 actor_id uuid not null, authorization_id uuid references missionaccounts.financial_specific_authorization,
 payment_id uuid references missionaccounts.financial_payment,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index financial_one_unresolved_card_attempt on missionaccounts.financial_card_attempt(request_id)
 where state in ('PREPARED','SUBMITTED','REQUIRES_ACTION','AMBIGUOUS','SUCCEEDED');
create index financial_operating_event_subject on missionaccounts.financial_operating_event(subject_key,sequence_no);
create index financial_request_subject on missionaccounts.financial_payment_request(subject_key);
create index financial_installment_obligation on missionaccounts.financial_schedule_installment(obligation_id);

create view missionaccounts.financial_active_schedule with(security_invoker=true) as
 select i.*,r.subject_key,coalesce(sum(a.amount_cents),0)::bigint applied_cents,
 case when exists(select 1 from missionaccounts.financial_schedule_revision n where n.supersedes=r.id) then 0 else (i.amount_cents-coalesce(sum(a.amount_cents),0))::bigint end remaining_cents
 from missionaccounts.financial_schedule_installment i join missionaccounts.financial_schedule_revision r on r.id=i.revision_id
 left join missionaccounts.financial_schedule_application a on a.installment_id=i.id
 where not exists(select 1 from missionaccounts.financial_schedule_revision n where n.supersedes=r.id)
 or exists(select 1 from missionaccounts.financial_schedule_application p where p.installment_id=i.id)
 group by i.id,r.id,r.subject_key;

create function missionaccounts.financial_require_founder(p_principal uuid,p_wp_user_id bigint)
returns void language plpgsql security definer set search_path='' as $$
begin
 if p_wp_user_id<>1 or not missionaccounts.api_financial_read_access(p_principal,p_wp_user_id) then
  raise exception 'Explicit Founder finance authority required' using errcode='42501';
 end if;
 if not exists(select 1 from missionaccounts.financial_operating_gate where id=1 and founder_operations) then
  raise exception 'Financial operating release is disabled' using errcode='42501';
 end if;
end $$;
create function missionaccounts.financial_own_subject(p_principal uuid,p_wp_user_id bigint)
returns text language plpgsql stable security definer set search_path='' as $$
declare k text;
begin
 if not exists(select 1 from missionaccounts.financial_operating_gate where id=1 and student_onboarding) then
  raise exception 'Student payment onboarding release is disabled' using errcode='42501';
 end if;
 select subject_key into k from missionaccounts.financial_runtime_binding where principal_id=p_principal and wp_user_id=p_wp_user_id and active;
 if k is null then raise exception 'Verified own financial account required' using errcode='42501'; end if;
 return k;
end $$;

create function missionaccounts.financial_operating_snapshot(p_subject text)
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('subject_key',p_subject,'certification_state',(select certification_state from missionaccounts.financial_subject where subject_key=p_subject),
  'eligibility',(select to_jsonb(x)-'event_id' from missionaccounts.financial_onboarding_eligibility x join missionaccounts.financial_operating_event e on e.id=x.event_id where x.subject_key=p_subject order by e.sequence_no desc limit 1),
  'profile',(select to_jsonb(x)-'event_id' from missionaccounts.financial_payment_profile x join missionaccounts.financial_operating_event e on e.id=x.event_id where x.subject_key=p_subject order by e.sequence_no desc limit 1),
  'method',(select jsonb_build_object('id',m.id,'subject_key',m.subject_key,'state',case when make_date(m.exp_year,m.exp_month,1)+interval '1 month'>current_date then 'READY' else 'EXPIRED' end,'brand',m.brand,'last4',m.last4,'exp_month',m.exp_month,'exp_year',m.exp_year) from missionaccounts.financial_card_method m where m.subject_key=p_subject order by verified_at desc,id desc limit 1),
  'pending_setup',(select jsonb_build_object('request_id',regexp_replace(e.request_id,':reserved$','')) from missionaccounts.financial_operating_event e where e.subject_key=p_subject and e.operation='PAYMENT_SETUP_RESERVED' and not exists(select 1 from missionaccounts.financial_card_setup s join missionaccounts.financial_card_method m on m.setup_id=s.id where s.request_id=regexp_replace(e.request_id,':reserved$','')) order by e.sequence_no desc limit 1),
  'schedule',coalesce((select jsonb_agg(to_jsonb(i) order by due_on nulls last,id) from missionaccounts.financial_active_schedule i where i.subject_key=p_subject),'[]'::jsonb),
  'requests',coalesce((select jsonb_agg(to_jsonb(r)||jsonb_build_object('state',coalesce((select x.state from missionaccounts.financial_request_result x join missionaccounts.financial_operating_event e on e.id=x.event_id where x.request_id=r.id order by e.sequence_no desc limit 1),'OPEN'),'authority_ref',e.authority_ref,'evidence_sha256',e.evidence_sha256) order by r.created_at,r.id) from missionaccounts.financial_payment_request r join missionaccounts.financial_operating_event e on e.id=r.event_id where r.subject_key=p_subject),'[]'::jsonb),
  'authorizations',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'request_id',c.request_id,'method_id',c.method_id,'amount_cents',c.amount_cents,'terms_version',c.terms_version,'accepted_at',c.accepted_at,'expires_at',c.expires_at,'brand',m.brand,'last4',m.last4) order by c.accepted_at,c.id) from missionaccounts.financial_specific_authorization c join missionaccounts.financial_card_method m on m.id=c.method_id where c.subject_key=p_subject),'[]'::jsonb),
  'attempts',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'request_id',a.request_id,'amount_cents',a.amount_cents,'state',a.state,'created_at',a.created_at,'payment_id',a.payment_id) order by a.created_at,a.id) from missionaccounts.financial_card_attempt a where a.subject_key=p_subject),'[]'::jsonb),
  'events',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'at',e.created_at,'operation',e.operation,'actor_wp_user_id',e.actor_wp_user_id,'authority_ref',e.authority_ref,'result',e.after_state) order by e.sequence_no) from missionaccounts.financial_operating_event e where e.subject_key=p_subject),'[]'::jsonb))
$$;
create function missionaccounts.api_financial_operating_command(p_principal uuid,p_wp_user_id bigint)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if p_wp_user_id<>1 or not missionaccounts.api_financial_read_access(p_principal,p_wp_user_id) then raise exception 'Founder financial authorization required' using errcode='42501';end if;
 return jsonb_build_object('gates',(select to_jsonb(g)-'id' from missionaccounts.financial_operating_gate g where id=1),
  'accounts',(select coalesce(jsonb_agg(missionaccounts.financial_operating_snapshot(subject_key) order by subject_key),'[]'::jsonb) from missionaccounts.financial_subject));
end $$;
create function missionaccounts.api_financial_student_access(p_principal uuid,p_wp_user_id bigint)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from missionaccounts.financial_runtime_binding b,missionaccounts.financial_operating_gate g where g.id=1 and g.student_onboarding and b.active and b.principal_id=p_principal and b.wp_user_id=p_wp_user_id);
$$;
create function missionaccounts.api_financial_own_onboarding(p_principal uuid,p_wp_user_id bigint)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare k text; s missionaccounts.financial_subject;
begin
 k:=missionaccounts.financial_own_subject(p_principal,p_wp_user_id);select * into strict s from missionaccounts.financial_subject where subject_key=k;
 return missionaccounts.financial_operating_snapshot(k)-'events'-'schedule'-'requests'-'authorizations'-'attempts'||jsonb_build_object('certification_state',s.certification_state);
end $$;
create function missionaccounts.api_save_financial_onboarding(p_principal uuid,p_wp_user_id bigint,p_profile jsonb,p_request_id text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare k text; dg text; ev uuid; old missionaccounts.financial_operating_event; prior jsonb;
begin
 k:=missionaccounts.financial_own_subject(p_principal,p_wp_user_id);
 if p_request_id !~ '^[A-Za-z0-9._:-]{8,160}$' or p_profile->>'email' !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Valid profile request required';end if;
 dg:=encode(extensions.digest(jsonb_build_array(p_principal,p_wp_user_id,k,p_profile)::text,'sha256'),'hex');
 perform pg_advisory_xact_lock(hashtextextended('financial-operation:'||p_request_id,0));
 select * into old from missionaccounts.financial_operating_event where request_id=p_request_id;
 if found then if old.request_digest<>dg then raise exception 'Profile request identity conflict';end if;return missionaccounts.api_financial_own_onboarding(p_principal,p_wp_user_id);end if;
 perform 1 from missionaccounts.financial_subject where subject_key=k for update;
 if (missionaccounts.financial_operating_snapshot(k)->'eligibility'->>'required')::boolean is distinct from true then raise exception 'Payment onboarding is not required';end if;
 prior:=missionaccounts.financial_operating_snapshot(k)->'profile';ev:=gen_random_uuid();
 insert into missionaccounts.financial_operating_event values(ev,k,p_principal,p_wp_user_id,'SAVE_PAYMENT_ONBOARDING',coalesce(prior,'{}'::jsonb),jsonb_build_object('saved',true),p_request_id,dg,'DR-387:OWN_ACCOUNT',dg,now());
 insert into missionaccounts.financial_payment_profile values(ev,k,p_profile->>'email',p_profile->>'phone',coalesce((p_profile->>'contact_confirmed')::boolean,false),coalesce((p_profile->>'arrangement_acknowledged')::boolean,false),coalesce((p_profile->>'save_method_acknowledged')::boolean,false));
 insert into missionaccounts.audit_event(actor_id,actor_role,kind,text,to_val,reason,request_id)
  values(p_principal::text,'student','mr_payment_onboarding','Saved own payment onboarding',jsonb_build_object('subject',k,'saved',true),'Own authenticated account',p_request_id);
 return missionaccounts.api_financial_own_onboarding(p_principal,p_wp_user_id);
end $$;

create function missionaccounts.api_financial_operate(p_principal uuid,p_wp_user_id bigint,p_subject text,p_operation text,p_payload jsonb,p_request_id text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare old missionaccounts.financial_operating_event; ev uuid; dg text; result jsonb; s missionaccounts.financial_subject;
 g missionaccounts.financial_agreement; o missionaccounts.financial_obligation_state; revision uuid; previous uuid;
 row jsonb; total bigint; amount bigint; item uuid; request uuid; before_value jsonb;
begin
 perform missionaccounts.financial_require_founder(p_principal,p_wp_user_id);
 if p_request_id !~ '^[A-Za-z0-9._:-]{8,160}$' or p_payload->>'authority_ref' is null or coalesce(p_payload->>'evidence_sha256','') !~ '^[a-f0-9]{64}$'
 or p_payload->'confirmed' is distinct from 'true'::jsonb then raise exception 'Explicit confirmation, authority and evidence required'; end if;
 dg:=encode(extensions.digest(jsonb_build_array(p_principal,p_wp_user_id,p_subject,p_operation,p_payload)::text,'sha256'),'hex');
 perform pg_advisory_xact_lock(hashtextextended('financial-operation:'||p_request_id,0));
 select * into old from missionaccounts.financial_operating_event where request_id=p_request_id;
 if found then
  if old.request_digest<>dg then raise exception 'Financial request identity conflict';end if;
  return jsonb_build_object('duplicate',true,'event_id',old.id,'result',old.after_state);
 end if;
 select * into strict s from missionaccounts.financial_subject where subject_key=p_subject for update;
 select * into g from missionaccounts.financial_agreement where subject_key=p_subject for update;
 if p_operation<>'SET_ONBOARDING_ELIGIBILITY' and s.certification_state<>'CERTIFIED' then raise exception 'Held account is not collectible';end if;
 ev:=gen_random_uuid();
 before_value:=jsonb_build_object('balance',case when g.id is not null then (select to_jsonb(b) from missionaccounts.financial_balance b where b.agreement_id=g.id) else null end);
 if p_operation='SET_ONBOARDING_ELIGIBILITY' then
  if coalesce((p_payload->>'required')::boolean,false) and s.certification_state='CERTIFIED' and
   (select balance_cents from missionaccounts.financial_balance where agreement_id=g.id)=0 then raise exception 'Paid-in-full account does not require a card';end if;
  insert into missionaccounts.financial_onboarding_eligibility values(ev,p_subject,(p_payload->>'required')::boolean,(p_payload->>'card_required')::boolean,p_payload->>'reason');
  result:=jsonb_build_object('required',(p_payload->>'required')::boolean);
 elsif p_operation='CREATE_OBLIGATION' then
  insert into missionaccounts.financial_obligation(agreement_id,obligation_key,component,original_cents,due_on,due_precision)
   values(g.id,p_payload->>'key',p_payload->>'component',(p_payload->>'amount_cents')::bigint,(p_payload->>'due_on')::date,
    case when p_payload->>'due_on' is null then 'UNKNOWN' else 'EXACT' end) returning id into item;
  result:=jsonb_build_object('obligation_id',item);
 elsif p_operation='SAVE_SCHEDULE' then
  if jsonb_typeof(p_payload->'installments')<>'array' or jsonb_array_length(p_payload->'installments') not between 1 and 60 then raise exception 'Bounded schedule required';end if;
  select r.id into previous from missionaccounts.financial_schedule_revision r where r.subject_key=p_subject
   and not exists(select 1 from missionaccounts.financial_schedule_revision n where n.supersedes=r.id) for update;
  if exists(select 1 from missionaccounts.financial_card_attempt a where a.subject_key=p_subject and a.state in ('PREPARED','SUBMITTED','REQUIRES_ACTION','AMBIGUOUS','DECLINED')) or
   exists(select 1 from missionaccounts.financial_payment_request q where q.subject_key=p_subject and q.installment_id is not null and
    (select rr.state from missionaccounts.financial_request_result rr join missionaccounts.financial_operating_event e on e.id=rr.event_id where rr.request_id=q.id order by e.sequence_no desc limit 1)='REPORTED') then raise exception 'Reconcile pending payments before schedule revision';end if;
  if coalesce(p_payload->>'expected_revision','')<>coalesce(previous::text,'') then raise exception 'Schedule changed; reload before editing';end if;
  revision:=gen_random_uuid();insert into missionaccounts.financial_schedule_revision values(revision,p_subject,ev,previous,now());
  for row in select value from jsonb_array_elements(p_payload->'installments') loop
   select * into strict o from missionaccounts.financial_obligation_state where id=(row->>'obligation_id')::uuid and agreement_id=g.id;
   perform 1 from missionaccounts.financial_obligation where id=o.id for update;
   amount:=(row->>'amount_cents')::bigint;
   if amount<=0 then raise exception 'Positive installment required';end if;
   select coalesce(sum(amount_cents),0) into total from missionaccounts.financial_schedule_installment where revision_id=revision and obligation_id=o.id;
   if amount+total>o.remaining_cents then raise exception 'Schedule exceeds certified residual';end if;
   if exists(select 1 from missionaccounts.financial_active_schedule a where a.subject_key=p_subject and a.installment_key=row->>'key' and a.applied_cents>0) then raise exception 'Settled schedule history may not be rewritten';end if;
   insert into missionaccounts.financial_schedule_installment(revision_id,installment_key,obligation_id,amount_cents,due_on,due_precision)
    values(revision,row->>'key',o.id,amount,(row->>'due_on')::date,case when row->>'due_on' is null then 'UNKNOWN' else 'EXACT' end);
  end loop;
  result:=jsonb_build_object('revision_id',revision);
 elsif p_operation='ADJUST_OBLIGATION' then
  if exists(select 1 from missionaccounts.financial_card_attempt a where a.subject_key=p_subject and a.state in ('PREPARED','SUBMITTED','REQUIRES_ACTION','AMBIGUOUS','DECLINED')) then raise exception 'Reconcile reserved payments before adjustment';end if;
  select * into strict o from missionaccounts.financial_obligation_state where id=(p_payload->>'obligation_id')::uuid and agreement_id=g.id;
  amount:=(p_payload->>'amount_cents')::bigint;
  if amount<=0 or amount>o.remaining_cents or p_payload->>'kind' not in ('WAIVER','CREDIT') then raise exception 'Adjustment exceeds unsettled obligation';end if;
  if (select coalesce(sum(i.remaining_cents),0) from missionaccounts.financial_active_schedule i where i.obligation_id=o.id)>o.remaining_cents-amount then raise exception 'Revise the future schedule before reducing its parent obligation';end if;
  insert into missionaccounts.financial_adjustment(obligation_id,kind,amount_cents,authority_ref,evidence_fingerprint)
   values(o.id,p_payload->>'kind',amount,p_payload->>'authority_ref',p_payload->>'evidence_sha256') returning id into item;
  result:=jsonb_build_object('adjustment_id',item);
 elsif p_operation='REQUEST_PAYMENT' then
  select * into strict o from missionaccounts.financial_obligation_state where id=(p_payload->>'obligation_id')::uuid and agreement_id=g.id;
  amount:=(p_payload->>'amount_cents')::bigint;
  if amount<=0 or amount>o.remaining_cents then raise exception 'Request exceeds certified obligation';end if;
  item:=nullif(p_payload->>'installment_id','')::uuid;
  if item is not null and not exists(select 1 from missionaccounts.financial_active_schedule a where a.id=item and a.subject_key=p_subject and a.obligation_id=o.id and a.remaining_cents>=amount) then raise exception 'Installment ownership/amount mismatch';end if;
  if item is null and amount>o.remaining_cents-(select coalesce(sum(a.remaining_cents),0) from missionaccounts.financial_active_schedule a where a.obligation_id=o.id) then raise exception 'Choose an active installment; this amount is already scheduled';end if;
  insert into missionaccounts.financial_payment_request(subject_key,obligation_id,installment_id,event_id,amount_cents,description,methods,expires_at)
   values(p_subject,o.id,item,ev,amount,p_payload->>'description',array(select jsonb_array_elements_text(p_payload->'methods')),(p_payload->>'expires_at')::timestamptz) returning id into request;
  result:=jsonb_build_object('request_id',request,'notification_sent',false);
 else raise exception 'Unsupported financial operation';end if;
 insert into missionaccounts.financial_operating_event values(ev,p_subject,p_principal,p_wp_user_id,p_operation,before_value,result,p_request_id,dg,p_payload->>'authority_ref',p_payload->>'evidence_sha256',now());
 insert into missionaccounts.audit_event(actor_id,actor_role,kind,text,from_val,to_val,reason,request_id)
  values(p_principal::text,'founder','mr_financial_operation',p_operation,jsonb_build_object('subject',p_subject),result,p_payload->>'authority_ref',p_request_id);
 return jsonb_build_object('duplicate',false,'event_id',ev,'result',result);
end $$;

do $$ declare t text; f record; begin
 foreach t in array array['financial_operating_gate','financial_runtime_binding','financial_operating_event','financial_onboarding_eligibility','financial_payment_profile','financial_schedule_revision','financial_schedule_installment','financial_schedule_application','financial_payment_request','financial_request_result','financial_card_binding','financial_card_setup','financial_card_method','financial_specific_authorization','financial_card_attempt'] loop
  execute format('alter table missionaccounts.%I enable row level security',t);
  execute format('alter table missionaccounts.%I force row level security',t);
  execute format('revoke all on missionaccounts.%I from public,anon,authenticated,service_role',t);
  execute format('grant select on missionaccounts.%I to service_role',t);
  if t not in ('financial_operating_gate','financial_card_setup','financial_card_attempt') then
   execute format('create trigger %I before update or delete on missionaccounts.%I for each row execute function missionaccounts.reject_immutable_change()',t||'_immutable',t);
  end if;
 end loop;
 for f in select p.oid::regprocedure sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='missionaccounts' and (p.proname in ('financial_guard_runtime_binding','financial_guard_schedule_application','financial_require_founder','financial_own_subject','api_financial_operate','financial_operating_snapshot','api_financial_operating_command','api_financial_student_access','api_financial_own_onboarding','api_save_financial_onboarding')) loop
  execute format('revoke execute on function %s from public,anon,authenticated,service_role',f.sig);
 end loop;
end $$;
revoke all on missionaccounts.financial_active_schedule from public,anon,authenticated,service_role;
grant select on missionaccounts.financial_active_schedule to service_role;
grant execute on function missionaccounts.api_financial_operate(uuid,bigint,text,text,jsonb,text) to service_role;
grant execute on function missionaccounts.api_financial_operating_command(uuid,bigint),missionaccounts.api_financial_student_access(uuid,bigint),missionaccounts.api_financial_own_onboarding(uuid,bigint),missionaccounts.api_save_financial_onboarding(uuid,bigint,jsonb,text) to service_role;
commit;
