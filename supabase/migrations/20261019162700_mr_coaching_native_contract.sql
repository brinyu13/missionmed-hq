-- DR-511 additive, disabled by default. No product IDs/availability are invented.
-- Native Scheduler bodies remain unchanged. Composition must be reviewed against
-- actual installed RPCs before activation; local fixture tests are not that proof.
begin;
create schema mr_coaching;
revoke all on schema mr_coaching from public, anon, authenticated;
grant usage on schema mr_coaching to service_role;

create table mr_coaching.campaign (
  id text primary key check(id = 'MATCHREADY2026'),
  enabled boolean not null default false,
  cutoff timestamptz not null default '2026-11-01T00:00:00-04:00',
  paid_limit integer not null default 20 check(paid_limit = 20)
);
insert into mr_coaching.campaign(id) values ('MATCHREADY2026');
create table mr_coaching.offers (
  sku text primary key, product_id bigint unique check(product_id > 0),
  regular_cents integer not null, promotional_cents integer not null,
  credits jsonb not null, enabled boolean not null default false
);
insert into mr_coaching.offers(sku,regular_cents,promotional_cents,credits) values
 ('single',39900,24900,'{"mock":{"count":1,"minutes":105}}'),
 ('three',109900,74900,'{"strategy":{"count":1,"minutes":120},"mock":{"count":3,"minutes":105},"debrief":{"count":2,"minutes":45}}'),
 ('five',179900,119900,'{"strategy":{"count":1,"minutes":120},"mock":{"count":5,"minutes":105},"debrief":{"count":3,"minutes":45}}'),
 ('emergency',399900,249900,'{"intensive":{"count":1,"minutes":480},"mock":{"count":2,"minutes":105},"debrief":{"count":1,"minutes":45}}');

-- Approval authorizes a specific native rule/provider/type/service and bounded
-- date range. It does not create availability or change any existing rule.
create table mr_coaching.service_types (
 appointment_type_id uuid primary key references public.mm_appointment_types(id),
 service text not null check(service in ('strategy','mock','debrief','intensive')),
 provider_id uuid not null references public.mm_schedule_providers(id),
 donor_appointment_type_id uuid not null references public.mm_appointment_types(id),
 unique(service,provider_id,donor_appointment_type_id)
);
create table mr_coaching.availability_approvals (
 id uuid primary key default gen_random_uuid(), service text not null check(service in ('strategy','mock','debrief','intensive')),
 availability_rule_id uuid not null references public.mm_availability_rules(id),
 provider_id uuid not null references public.mm_schedule_providers(id),
 appointment_type_id uuid not null references public.mm_appointment_types(id),
 approved_from timestamptz not null, approved_until timestamptz not null,
 founder_actor_id uuid not null, approval_evidence_id text not null unique,
 created_at timestamptz not null default clock_timestamp(), revoked_at timestamptz,
 check(approved_until > approved_from)
);
create table mr_coaching.orders (
 order_id text primary key, order_item_id text not null unique,
 wp_customer_id bigint not null check(wp_customer_id > 0), customer_id uuid,
 sku text not null references mr_coaching.offers(sku), gateway text not null check(gateway in ('bacs','stripe')),
 snapshot jsonb not null, offer_snapshot jsonb not null, snapshot_digest text not null check(snapshot_digest ~ '^[a-f0-9]{64}$'),
 promotional boolean not null, original_created_at timestamptz not null,
 expires_at timestamptz, state text not null check(state in ('reserved','released','review','paid')),
 reservation_key text not null unique, payment_event_id text unique,
 paid_at timestamptz, created_at timestamptz not null default clock_timestamp()
);
create index orders_campaign_state on mr_coaching.orders(state) where promotional;
create index orders_owner on mr_coaching.orders(wp_customer_id);
create table mr_coaching.financial_evidence (
 fingerprint text primary key check(fingerprint ~ '^[a-f0-9]{64}$'),
 event_id text not null unique, order_id text not null references mr_coaching.orders(order_id),
 binding jsonb not null, payload jsonb not null, received_at timestamptz not null default clock_timestamp()
);
create table mr_coaching.financial_observations (
 fingerprint text not null references mr_coaching.financial_evidence(fingerprint),
 woo_status text not null check(woo_status in ('processing','completed')),
 observed_at timestamptz not null default clock_timestamp(), primary key(fingerprint,woo_status)
);
create table mr_coaching.services (
 id uuid primary key default gen_random_uuid(), order_id text not null references mr_coaching.orders(order_id),
 service text not null, ordinal integer not null check(ordinal > 0), minutes integer not null check(minutes > 0),
 state text not null default 'available' check(state in ('available','reserved','delivered','forfeited')),
 appointment_id uuid unique references public.mm_appointments(id),
 unique(order_id,service,ordinal)
);
create table mr_coaching.operations (
 idempotency_key text primary key, request jsonb not null, result jsonb not null,
 created_at timestamptz not null default clock_timestamp()
);
create table mr_coaching.emergency_requests (
 id uuid primary key default gen_random_uuid(), wp_customer_id bigint not null check(wp_customer_id > 0),
 request jsonb not null, created_at timestamptz not null default clock_timestamp(),
 state text not null default 'request_only' check(state='request_only')
);
create table mr_coaching.bridge_nonces (
 nonce text primary key check(nonce ~ '^[A-Za-z0-9_-]{16,128}$'),
 issuer text not null check(issuer='canonical_woo'), signed_at timestamptz not null,
 claimed_at timestamptz not null default clock_timestamp()
);
create table mr_coaching.terminal_unpaid_evidence (
 event_id text primary key, order_id text not null references mr_coaching.orders(order_id),
 payload jsonb not null, received_at timestamptz not null default clock_timestamp()
);
create table mr_coaching.mutation_context (
 transaction_id bigint not null, backend_pid integer not null,
 credit_id uuid not null references mr_coaching.services(id), action text not null,
 expected jsonb not null, primary key(transaction_id,backend_pid)
);
create table mr_coaching.activation_outbox (
 id uuid primary key default gen_random_uuid(), order_id text not null unique references mr_coaching.orders(order_id),
 event_type text not null default 'coaching_paid_package_activated',
 payload jsonb not null, status text not null default 'pending' check(status in ('pending','claimed','sent','review')),
 claim_request_id text unique, claim_token uuid unique, worker_id text,
 claimed_at timestamptz, provider_message_id text, completed_at timestamptz,
 created_at timestamptz not null default clock_timestamp()
);

do $$ declare t text; begin
 foreach t in array array['campaign','offers','service_types','availability_approvals','orders','financial_evidence','financial_observations','services','operations','emergency_requests','bridge_nonces','terminal_unpaid_evidence','mutation_context','activation_outbox'] loop
  execute format('alter table mr_coaching.%I enable row level security',t);
  execute format('revoke all on mr_coaching.%I from public, anon, authenticated',t);
  execute format('grant select, insert, update on mr_coaching.%I to service_role',t);
 end loop;
end $$;
revoke update on mr_coaching.financial_evidence,mr_coaching.financial_observations,mr_coaching.operations,mr_coaching.bridge_nonces,mr_coaching.terminal_unpaid_evidence from service_role;
grant delete on mr_coaching.mutation_context to service_role;

create function public.mm_coaching_claim_bridge_nonce(p_payload jsonb) returns boolean
language plpgsql security invoker set search_path='' as $$
declare inserted integer;
begin
 perform mr_coaching.guard();
 if p_payload->>'issuer' is distinct from 'canonical_woo' or
 abs(extract(epoch from clock_timestamp())-(p_payload->>'timestamp')::numeric)>300
 or p_payload->>'timestamp' is null then raise exception 'invalid_bridge_nonce_time'; end if;
 insert into mr_coaching.bridge_nonces(nonce,issuer,signed_at)
 values(p_payload->>'nonce','canonical_woo',to_timestamp((p_payload->>'timestamp')::double precision)) on conflict do nothing;
 get diagnostics inserted=row_count;
 return inserted=1;
end $$;

create function mr_coaching.guard() returns void language plpgsql security invoker set search_path='' as $$
begin
 if current_user <> 'service_role' then raise exception 'coaching_service_role_required' using errcode='42501'; end if;
 -- Each read after waiting for the advisory lock must see prior commits. Fail
 -- closed if a caller changes PostgREST's default transaction isolation.
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'coaching_read_committed_required'; end if;
 -- Single transaction-level order across campaign, credits and booking operations.
 perform pg_advisory_xact_lock(20261019,511);
end $$;

create function mr_coaching.snapshot(p jsonb) returns jsonb language sql immutable security invoker set search_path='' as $$
 select jsonb_build_object('order_id',p->>'order_id','order_item_id',p->>'order_item_id',
 'wp_customer_id',p->'wp_customer_id','sku',p->>'sku','product_id',p->'product_id',
 'gateway',p->>'gateway','quantity',p->'quantity','currency',p->>'currency',
 'tuition_cents',p->'tuition_cents','total_cents',p->'total_cents',
 'tax_cents',p->'tax_cents','fee_cents',p->'fee_cents','coupon',coalesce(p->>'coupon',''),
 'order_created_at',p->>'order_created_at');
$$;

create function mr_coaching.payment_binding(p jsonb) returns jsonb language sql immutable security invoker set search_path='' as $$
 select mr_coaching.snapshot(p) || jsonb_build_object('snapshot_digest',p->>'snapshot_digest',
 'event_id',p->>'event_id','financial_fingerprint',p->>'financial_fingerprint',
 'payment_verified_at',p->>'payment_verified_at','source',p->>'source','event_type',p->>'event_type','is_paid',p->'is_paid');
$$;

create function mr_coaching.expire_unpaid() returns void language plpgsql security invoker set search_path='' as $$
begin
 perform mr_coaching.guard();
 -- Unknown Stripe outcome NEVER expires on a timer. Paid/evidence remain permanent.
 update mr_coaching.orders set state='released'
 where state='reserved' and gateway='bacs' and clock_timestamp() >= expires_at;
end $$;

create function public.mm_coaching_approve_availability(p_payload jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare a mr_coaching.availability_approvals; r public.mm_availability_rules; donor public.mm_appointment_types; isolated uuid; service_minutes integer;
begin
 perform mr_coaching.guard();
 if p_payload->>'approval_source' is distinct from 'authenticated_founder' or nullif(p_payload->>'approval_evidence_id','') is null
 then raise exception 'founder_approval_required'; end if;
 select * into r from public.mm_availability_rules where id=(p_payload->>'availability_rule_id')::uuid
 and active and status='active' and deleted_at is null for share;
 if not found or r.provider_id is distinct from (p_payload->>'provider_id')::uuid
 or r.appointment_type_id is distinct from (p_payload->>'appointment_type_id')::uuid
 then raise exception 'actual_native_rule_required'; end if;
 if nullif(r.rrule,'') is not null then raise exception 'complex_native_rule_requires_review'; end if;
 select * into donor from public.mm_appointment_types where id=r.appointment_type_id and active and status='active' and deleted_at is null;
 if not found
 then raise exception 'native_type_inactive'; end if;
 if exists(select 1 from mr_coaching.service_types where appointment_type_id=donor.id)
 then raise exception 'legacy_donor_rule_required'; end if;
 if not exists(select 1 from public.mm_schedule_providers where id=r.provider_id and active and status='active' and deleted_at is null)
 or not exists(select 1 from public.mm_provider_appointment_types where provider_id=r.provider_id and appointment_type_id=donor.id and active)
 then raise exception 'actual_native_provider_eligibility_required'; end if;
 select * into a from mr_coaching.availability_approvals where approval_evidence_id=p_payload->>'approval_evidence_id';
 if found then
  if a.service is distinct from p_payload->>'service' or a.availability_rule_id<>r.id
  or a.approved_from<>(p_payload->>'approved_from')::timestamptz or a.approved_until<>(p_payload->>'approved_until')::timestamptz
  or a.founder_actor_id<>(p_payload->>'founder_actor_id')::uuid then raise exception 'approval_replay_mismatch'; end if;
  return to_jsonb(a);
 end if;
 service_minutes:=case p_payload->>'service' when 'strategy' then 120 when 'mock' then 105 when 'debrief' then 45 when 'intensive' then 480 end;
 if service_minutes is null then raise exception 'unknown_coaching_service'; end if;
 select appointment_type_id into isolated from mr_coaching.service_types where service=p_payload->>'service' and provider_id=r.provider_id and donor_appointment_type_id=donor.id;
 if isolated is null then
  isolated:=gen_random_uuid();
  insert into public.mm_appointment_types(id,slug,name,description,duration_minutes,buffer_before_minutes,buffer_after_minutes,
   min_notice_minutes,max_booking_window_days,capacity,group_enabled,meeting_mode,status,active,metadata)
  values(isolated,'mr-coaching-'||(p_payload->>'service')||'-'||isolated::text,'Private coaching: '||(p_payload->>'service'),
   case p_payload->>'service'
    when 'mock' then 'A 15-minute realistic interview simulation followed by 90 minutes of individual evaluation and coaching.'
    when 'strategy' then 'A two-hour private intake and interview strategy session before your first mock.'
    when 'debrief' then 'A 45-minute private debrief after a real residency interview.'
    when 'intensive' then 'An eight-hour private interview intensive on a date reviewed and approved by staff.'
   end,service_minutes,donor.buffer_before_minutes,donor.buffer_after_minutes,
   donor.min_notice_minutes,donor.max_booking_window_days,1,false,donor.meeting_mode,'active',true,
   jsonb_build_object('mr_coaching_service',p_payload->>'service','donor_type_id',donor.id));
  insert into public.mm_provider_appointment_types(provider_id,appointment_type_id,active) values(r.provider_id,isolated,true);
  insert into mr_coaching.service_types(appointment_type_id,service,provider_id,donor_appointment_type_id) values(isolated,p_payload->>'service',r.provider_id,donor.id);
 end if;
 insert into mr_coaching.availability_approvals(service,availability_rule_id,provider_id,appointment_type_id,approved_from,approved_until,founder_actor_id,approval_evidence_id)
 values(p_payload->>'service',r.id,r.provider_id,isolated,(p_payload->>'approved_from')::timestamptz,
 (p_payload->>'approved_until')::timestamptz,(p_payload->>'founder_actor_id')::uuid,p_payload->>'approval_evidence_id') returning * into a;
 return to_jsonb(a);
end $$;

create function public.mm_coaching_admit_order(p_payload jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare o mr_coaching.orders; f mr_coaching.offers; c mr_coaching.campaign; s jsonb; promo boolean; k text;
begin
 perform mr_coaching.guard();
 perform mr_coaching.expire_unpaid();
 s:=mr_coaching.snapshot(p_payload);
 select * into o from mr_coaching.orders where order_id=p_payload->>'order_id';
 if found then
  if o.snapshot<>s or o.snapshot_digest is distinct from p_payload->>'snapshot_digest'
  or o.reservation_key is distinct from p_payload->>'idempotency_key' then raise exception 'order_replay_mismatch'; end if;
  return jsonb_build_object('state',o.state,'order_id',o.order_id,'activation_allowed',o.state='paid','idempotency_replay',true);
 end if;
 select * into c from mr_coaching.campaign where id='MATCHREADY2026' for update;
 if not c.enabled then raise exception 'coaching_disabled'; end if;
 select * into f from mr_coaching.offers where sku=p_payload->>'sku' and enabled and product_id=(p_payload->>'product_id')::bigint;
 if not found then raise exception 'unconfigured_offer'; end if;
 -- Request-first Emergency deliberately fails closed until native reservation
 -- composition (including conflicts with existing bookings) is independently proved.
 if f.sku='emergency' then raise exception 'emergency_request_first_native_reservation_required'; end if;
 promo:=coalesce(p_payload->>'coupon','')='MATCHREADY2026';
 if coalesce(p_payload->>'coupon','') not in ('','MATCHREADY2026') then raise exception 'coupon_not_allowed'; end if;
 if (p_payload->>'quantity')::integer is distinct from 1 or p_payload->>'currency' is distinct from 'USD'
 or (p_payload->>'wp_customer_id')::bigint is null or (p_payload->>'wp_customer_id')::bigint<=0
 or (p_payload->>'tuition_cents')::integer is distinct from (case when promo then f.promotional_cents else f.regular_cents end)
 or (p_payload->>'tax_cents')::bigint is null or (p_payload->>'tax_cents')::bigint<0
 or (p_payload->>'fee_cents')::bigint is null or (p_payload->>'fee_cents')::bigint<0
 or (p_payload->>'total_cents')::bigint is distinct from (p_payload->>'tuition_cents')::bigint+(p_payload->>'tax_cents')::bigint+(p_payload->>'fee_cents')::bigint
 or nullif(p_payload->>'order_id','') is null or nullif(p_payload->>'order_item_id','') is null
 or nullif(p_payload->>'idempotency_key','') is null
 or (p_payload->>'order_created_at')::timestamptz is null or (p_payload->>'order_created_at')::timestamptz>clock_timestamp()
 then raise exception 'invalid_order_snapshot'; end if;
 if promo and (clock_timestamp()>=c.cutoff or (select count(*) from mr_coaching.orders where promotional and state in ('reserved','paid'))>=c.paid_limit)
 then raise exception 'promotion_unavailable'; end if;
 for k in select jsonb_object_keys(f.credits) loop
  if not mr_coaching.has_available_slot(k)
  then raise exception 'authorized_service_availability_required'; end if;
 end loop;
 if p_payload->>'gateway'='bacs' and clock_timestamp()>=(p_payload->>'order_created_at')::timestamptz+interval '24 hours'
 then raise exception 'unpaid_order_already_expired'; end if;
 insert into mr_coaching.orders(order_id,order_item_id,wp_customer_id,sku,gateway,snapshot,offer_snapshot,snapshot_digest,promotional,original_created_at,expires_at,state,reservation_key)
 values(p_payload->>'order_id',p_payload->>'order_item_id',(p_payload->>'wp_customer_id')::bigint,f.sku,p_payload->>'gateway',s,to_jsonb(f),p_payload->>'snapshot_digest',promo,
 (p_payload->>'order_created_at')::timestamptz,case when p_payload->>'gateway'='bacs' then (p_payload->>'order_created_at')::timestamptz+interval '24 hours' end,'reserved',p_payload->>'idempotency_key');
 return jsonb_build_object('state','reserved','order_id',p_payload->>'order_id','activation_allowed',false,'idempotency_replay',false);
end $$;

-- Observational native availability proof, never an appointment reservation.
-- Uses the current persisted rule, provider/PAT, native buffers, blackouts and
-- existing appointment ranges; no provider requests or invented window inventory.
create function mr_coaching.slot_authorized(p_approval uuid,p_start timestamptz,p_end timestamptz,p_resource uuid,p_exclude uuid default null)
returns boolean language sql volatile security invoker set search_path='' as $$
 select exists(select 1 from mr_coaching.availability_approvals a
 join mr_coaching.service_types st on st.appointment_type_id=a.appointment_type_id
 join public.mm_appointment_types t on t.id=st.appointment_type_id
 join public.mm_schedule_providers pr on pr.id=a.provider_id
 join public.mm_provider_appointment_types pat on pat.provider_id=pr.id and pat.appointment_type_id=t.id
 join public.mm_availability_rules r on r.id=a.availability_rule_id
 where a.id=p_approval and a.revoked_at is null and a.approved_from<=p_start and a.approved_until>=p_end
 and r.active and r.status='active' and r.deleted_at is null and nullif(r.rrule,'') is null
 and t.active and t.status='active' and t.deleted_at is null and pr.active and pr.status='active' and pr.deleted_at is null and pat.active
 and r.provider_id=pr.id and r.appointment_type_id=st.donor_appointment_type_id
 and p_end-p_start=t.duration_minutes*interval '1 minute'
 and p_start>=clock_timestamp()+t.min_notice_minutes*interval '1 minute'
 and p_start<=clock_timestamp()+t.max_booking_window_days*interval '1 day'
 and (cardinality(r.day_of_week)=0 or extract(dow from p_start at time zone r.timezone)::integer=any(r.day_of_week))
 and (p_start at time zone r.timezone)::date>=r.effective_start
 and (r.effective_end is null or (p_end at time zone r.timezone)::date<=r.effective_end)
 and (r.resource_id is null or r.resource_id=p_resource)
 and (p_start at time zone r.timezone)::date=(p_end at time zone r.timezone)::date
 and (p_start at time zone r.timezone)::time>=r.start_time and (p_end at time zone r.timezone)::time<=r.end_time
 and not exists(select 1 from public.mm_blackout_windows b where b.status='active' and b.deleted_at is null
  and (b.provider_id is null or b.provider_id=pr.id) and (b.resource_id is null or b.resource_id is not distinct from p_resource)
  and (b.appointment_type_id is null or b.appointment_type_id in (t.id,st.donor_appointment_type_id))
  and tstzrange(b.start_at,b.end_at,'[)') && tstzrange(p_start,p_end,'[)'))
 and not exists(select 1 from public.mm_appointments ap where ap.id is distinct from p_exclude and ap.deleted_at is null
  and ap.status in ('held','booked','confirmed') and (ap.provider_id=pr.id or (p_resource is not null and ap.resource_id=p_resource))
  and ap.blocked_range && tstzrange(p_start-t.buffer_before_minutes*interval '1 minute',p_end+t.buffer_after_minutes*interval '1 minute','[)')));
$$;

create function mr_coaching.has_available_slot(p_service text) returns boolean language sql volatile security invoker set search_path='' as $$
 select exists(select 1 from mr_coaching.availability_approvals a
 join public.mm_availability_rules r on r.id=a.availability_rule_id
 join public.mm_appointment_types t on t.id=a.appointment_type_id
 cross join lateral generate_series((clock_timestamp() at time zone r.timezone)::date::timestamp,
  (clock_timestamp() at time zone r.timezone)::date::timestamp+least(t.max_booking_window_days,60)*interval '1 day',interval '1 day') d(day)
 cross join lateral generate_series((d.day::date+r.start_time) at time zone r.timezone,
  ((d.day::date+r.end_time) at time zone r.timezone)-t.duration_minutes*interval '1 minute',interval '15 minutes') sl(slot)
 where a.service=p_service and a.revoked_at is null and a.approved_until>clock_timestamp()
 and mr_coaching.slot_authorized(a.id,sl.slot,sl.slot+t.duration_minutes*interval '1 minute',r.resource_id));
$$;

-- Private SECURITY DEFINER is necessary only for a trigger on legacy tables:
-- exposing the private classification/context to authenticated users would leak
-- ledger authority; invoker would also break all unrelated legacy writes.
-- No browser-provided GUC is authority. The private context binds this backend
-- and transaction to one checked credit; the core RPCs stay byte-for-byte intact.
create function mr_coaching.police_appointment() returns trigger language plpgsql security definer set search_path='' as $$
declare type_id uuid; ap_id uuid; ctx mr_coaching.mutation_context; credit mr_coaching.services; package mr_coaching.orders; actual jsonb;
begin
 type_id:=case when TG_OP='DELETE' then OLD.appointment_type_id else NEW.appointment_type_id end;
 ap_id:=case when TG_OP='INSERT' then NEW.id else OLD.id end;
 if not exists(select 1 from mr_coaching.service_types where appointment_type_id=type_id)
 and not exists(select 1 from mr_coaching.services where appointment_id=ap_id)
 and (TG_OP='INSERT' or not exists(select 1 from mr_coaching.service_types where appointment_type_id=OLD.appointment_type_id))
 then if TG_OP='DELETE' then return OLD; else return NEW; end if; end if;
 if TG_OP='DELETE' then raise exception 'coaching_hard_delete_forbidden'; end if;
 if auth.uid() is null and coalesce(current_setting('role',true),'')<>'service_role' then raise exception 'coaching_native_actor_required'; end if;
 select * into ctx from mr_coaching.mutation_context where transaction_id=txid_current() and backend_pid=pg_backend_pid();
 if not found then raise exception 'coaching_native_credit_context_required'; end if;
 select * into credit from mr_coaching.services where id=ctx.credit_id;
 select * into package from mr_coaching.orders where order_id=credit.order_id;
 if credit.id is null or package.state<>'paid' or NEW.student_user_id is distinct from package.customer_id
 or NEW.student_wp_user_id is distinct from package.wp_customer_id then raise exception 'coaching_context_owner_mismatch'; end if;
 actual:=jsonb_build_object('appointment_type_id',NEW.appointment_type_id,'provider_id',NEW.provider_id,'resource_id',NEW.resource_id,
  'schedule_event_id',NEW.schedule_event_id,'start_at',NEW.start_at,'end_at',NEW.end_at,'status',NEW.status,'deleted_at',NEW.deleted_at,
  'buffer_before_minutes',NEW.buffer_before_minutes,'buffer_after_minutes',NEW.buffer_after_minutes);
 if actual<>ctx.expected then raise exception 'coaching_context_mutation_mismatch'; end if;
 if TG_OP='INSERT' then
  if ctx.action<>'book' or credit.state<>'available' then raise exception 'coaching_context_credit_unavailable'; end if;
 elsif ctx.action not in ('reschedule','cancel') or credit.state<>'reserved' or credit.appointment_id<>OLD.id
 then raise exception 'coaching_context_appointment_mismatch'; end if;
 return NEW;
end $$;
create trigger mm_appointments_coaching_guard before insert or update of appointment_type_id,provider_id,resource_id,schedule_event_id,
 student_user_id,student_wp_user_id,start_at,end_at,status,deleted_at,buffer_before_minutes,buffer_after_minutes or delete on public.mm_appointments
for each row execute function mr_coaching.police_appointment();

-- Only the canonical server can attest a real canceled Stripe intent with no
-- received funds. A browser abandonment, failed attempt, requires_payment_method
-- state or Woo order status alone is not terminal financial proof.
create function public.mm_coaching_release_unpaid_order(p_payload jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare o mr_coaching.orders; prior mr_coaching.terminal_unpaid_evidence;
begin
 perform mr_coaching.guard();
 select * into o from mr_coaching.orders where order_id=p_payload->>'order_id' for update;
 if not found then raise exception 'admitted_order_required'; end if;
 if o.gateway<>'stripe' or o.snapshot<>mr_coaching.snapshot(p_payload)
 or o.snapshot_digest is distinct from p_payload->>'snapshot_digest'
 or p_payload->>'source' is distinct from 'canonical_woo_verified'
 or p_payload->>'event_type' is distinct from 'terminal_unpaid'
 or p_payload->'is_paid' is distinct from 'false'::jsonb
 or p_payload->>'financial_outcome' is distinct from 'verified_terminal_unpaid'
 or p_payload->>'provider_status' is distinct from 'canceled'
 or p_payload->'gateway_funds_received' is distinct from 'false'::jsonb
 or nullif(p_payload->>'provider_evidence_id','') is null or nullif(p_payload->>'release_event_id','') is null
 then raise exception 'trusted_terminal_unpaid_provider_evidence_required'; end if;
 if o.state='paid' or o.paid_at is not null or exists(select 1 from mr_coaching.financial_evidence where order_id=o.order_id)
 then raise exception 'financial_evidence_prevents_unpaid_release'; end if;
 select * into prior from mr_coaching.terminal_unpaid_evidence where event_id=p_payload->>'release_event_id';
 if found then
  if prior.order_id<>o.order_id or prior.payload<>p_payload then raise exception 'terminal_unpaid_replay_mismatch'; end if;
  return jsonb_build_object('state',o.state,'order_id',o.order_id,'activation_allowed',false,'idempotency_replay',true);
 end if;
 if o.state not in ('reserved','released') then raise exception 'unpaid_reservation_required'; end if;
 insert into mr_coaching.terminal_unpaid_evidence(event_id,order_id,payload)
 values(p_payload->>'release_event_id',o.order_id,p_payload);
 update mr_coaching.orders set state='released' where order_id=o.order_id;
 return jsonb_build_object('state','released','order_id',o.order_id,'activation_allowed',false,'idempotency_replay',false);
end $$;

create function public.mm_coaching_verified_payment(p_payload jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare o mr_coaching.orders; e mr_coaching.financial_evidence; k text; v jsonb; i integer;
begin
 perform mr_coaching.guard();
 select * into o from mr_coaching.orders where order_id=p_payload->>'order_id' for update;
 if not found then raise exception 'admitted_order_required'; end if;
 if p_payload->>'source' is distinct from 'canonical_woo_verified' or p_payload->>'event_type' is distinct from 'payment_complete'
 or not coalesce(p_payload->>'woo_status' in ('processing','completed'),false) or coalesce((p_payload->>'is_paid')::boolean,false) is not true
 or o.snapshot<>mr_coaching.snapshot(p_payload) or o.snapshot_digest is distinct from p_payload->>'snapshot_digest'
 or nullif(p_payload->>'event_id','') is null or coalesce(p_payload->>'financial_fingerprint','')!~'^[a-f0-9]{64}$'
 or (p_payload->>'payment_verified_at')::timestamptz is null or (p_payload->>'payment_verified_at')::timestamptz<o.original_created_at
 or (p_payload->>'payment_verified_at')::timestamptz>clock_timestamp()
 then raise exception 'canonical_verified_snapshot_required'; end if;
 select * into e from mr_coaching.financial_evidence where fingerprint=p_payload->>'financial_fingerprint' or event_id=p_payload->>'event_id';
 if found then
  if e.order_id<>o.order_id or e.binding<>mr_coaching.payment_binding(p_payload) then raise exception 'financial_replay_mismatch'; end if;
  insert into mr_coaching.financial_observations(fingerprint,woo_status) values(e.fingerprint,p_payload->>'woo_status') on conflict do nothing;
  return jsonb_build_object('state',o.state,'order_id',o.order_id,'activation_allowed',o.state='paid','idempotency_replay',true,
   'woo_status',case when exists(select 1 from mr_coaching.financial_observations where fingerprint=e.fingerprint and woo_status='completed') then 'completed' else 'processing' end);
 end if;
 if o.state='paid' then raise exception 'paid_order_conflicting_event'; end if;
 -- Financial evidence persists even when eligibility cannot be granted.
 insert into mr_coaching.financial_evidence(fingerprint,event_id,order_id,binding,payload)
 values(p_payload->>'financial_fingerprint',p_payload->>'event_id',o.order_id,mr_coaching.payment_binding(p_payload),p_payload);
 insert into mr_coaching.financial_observations(fingerprint,woo_status) values(p_payload->>'financial_fingerprint',p_payload->>'woo_status');
 if o.state<>'reserved' or (o.gateway='bacs' and clock_timestamp()>=o.expires_at) then
  update mr_coaching.orders set state='review' where order_id=o.order_id;
  return jsonb_build_object('state','review','order_id',o.order_id,'activation_allowed',false,'reason','late_or_released_payment_secure_review');
 end if;
 update mr_coaching.orders set state='paid',paid_at=(p_payload->>'payment_verified_at')::timestamptz,payment_event_id=p_payload->>'event_id' where order_id=o.order_id;
 for k,v in select key,value from jsonb_each(o.offer_snapshot->'credits') loop
  for i in 1..(v->>'count')::integer loop
   insert into mr_coaching.services(order_id,service,ordinal,minutes) values(o.order_id,k,i,(v->>'minutes')::integer);
  end loop;
 end loop;
 insert into mr_coaching.activation_outbox(order_id,payload)
 values(o.order_id,jsonb_build_object('order_id',o.order_id,'order_item_id',o.order_item_id,'wp_customer_id',o.wp_customer_id,'sku',o.sku,'snapshot_digest',o.snapshot_digest));
 return jsonb_build_object('state','paid','order_id',o.order_id,'activation_allowed',true,'idempotency_replay',false);
end $$;

-- This is a delivery contract, not a configured email sender. No automatic
-- recovery/reclaim of uncertain sends: claimed work remains claimed for review.
create function public.mm_coaching_claim_activation_outbox(p_payload jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare row mr_coaching.activation_outbox;
begin
 perform mr_coaching.guard();
 if nullif(p_payload->>'worker_id','') is null or nullif(p_payload->>'claim_request_id','') is null then raise exception 'outbox_claim_identity_required'; end if;
 select * into row from mr_coaching.activation_outbox where claim_request_id=p_payload->>'claim_request_id';
 if found then
  if row.worker_id<>p_payload->>'worker_id' then raise exception 'outbox_claim_replay_mismatch'; end if;
  return to_jsonb(row);
 end if;
 select * into row from mr_coaching.activation_outbox where status='pending' order by created_at,id for update skip locked limit 1;
 if not found then return null; end if;
 update mr_coaching.activation_outbox set status='claimed',claim_request_id=p_payload->>'claim_request_id',
 claim_token=gen_random_uuid(),worker_id=p_payload->>'worker_id',claimed_at=clock_timestamp() where id=row.id returning * into row;
 return to_jsonb(row);
end $$;

create function public.mm_coaching_ack_activation_outbox(p_payload jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare row mr_coaching.activation_outbox;
begin
 perform mr_coaching.guard();
 select * into row from mr_coaching.activation_outbox where id=(p_payload->>'id')::uuid for update;
 if not found or row.claim_token is distinct from (p_payload->>'claim_token')::uuid or row.worker_id is distinct from p_payload->>'worker_id'
 or nullif(p_payload->>'provider_message_id','') is null then raise exception 'outbox_claim_proof_required'; end if;
 if row.status='sent' then
  if row.provider_message_id<>p_payload->>'provider_message_id' then raise exception 'outbox_delivery_replay_mismatch'; end if;
  return jsonb_build_object('status','sent','id',row.id,'idempotency_replay',true);
 end if;
 if row.status<>'claimed' then raise exception 'outbox_claim_required'; end if;
 update mr_coaching.activation_outbox set status='sent',provider_message_id=p_payload->>'provider_message_id',completed_at=clock_timestamp() where id=row.id;
 return jsonb_build_object('status','sent','id',row.id,'idempotency_replay',false);
end $$;

create function public.mm_coaching_read_model(p_payload jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare customer uuid; wp bigint;
begin
 perform mr_coaching.guard();
 if p_payload->>'identity_source' is distinct from 'native_scheduler_authenticated_actor' then raise exception 'trusted_native_identity_required'; end if;
 customer:=(p_payload->>'actor_user_id')::uuid; wp:=(p_payload->>'actor_wp_user_id')::bigint;
 if customer is null or wp is null then raise exception 'exact_actor_pair_required'; end if;
 if exists(select 1 from mr_coaching.orders where wp_customer_id=wp and customer_id is not null and customer_id<>customer)
 then raise exception 'identity_binding_conflict'; end if;
 update mr_coaching.orders set customer_id=customer where wp_customer_id=wp and customer_id is null;
 return jsonb_build_object('packages',coalesce((select jsonb_agg(jsonb_build_object('order_id',o.order_id,'sku',o.sku,
 'services',(select coalesce(jsonb_agg(to_jsonb(s)),'[]') from mr_coaching.services s where s.order_id=o.order_id)))
 from mr_coaching.orders o where o.wp_customer_id=wp and o.customer_id=customer and o.state='paid'),'[]'::jsonb),
 'eligible_services',coalesce((select jsonb_agg(jsonb_build_object('service',a.service,'approval_id',a.id,
  'appointment_type_id',a.appointment_type_id,'donor_appointment_type_id',st.donor_appointment_type_id,
  'availability_rule_id',a.availability_rule_id,'provider_id',a.provider_id,'approved_from',a.approved_from,'approved_until',a.approved_until))
 from mr_coaching.availability_approvals a join mr_coaching.service_types st on st.appointment_type_id=a.appointment_type_id
 where a.revoked_at is null and a.approved_until>clock_timestamp() and exists(
  select 1 from mr_coaching.services cr join mr_coaching.orders owned on owned.order_id=cr.order_id
  where owned.wp_customer_id=wp and owned.customer_id=customer and owned.state='paid' and cr.service=a.service and cr.state in ('available','reserved'))),'[]'::jsonb));
end $$;

-- Composition wrapper, not an alternative booking engine. Core RPCs continue to
-- own provider/resource/blackout checks, native audit and notification placeholder.
create function public.mm_coaching_mutate_appointment(p_payload jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare s mr_coaching.services; o mr_coaching.orders; a mr_coaching.availability_approvals;
 old public.mm_appointments; result jsonb; req jsonb; previous mr_coaching.operations;
action text; v_start timestamptz; v_end timestamptz; week_start timestamptz; used_minutes numeric;
begin
 perform mr_coaching.guard();
 perform public.mm_coaching_read_model(p_payload);
 action:=p_payload->>'action'; req:=p_payload;
 if nullif(p_payload->>'idempotency_key','') is null then raise exception 'idempotency_required'; end if;
 select * into previous from mr_coaching.operations where idempotency_key=p_payload->>'idempotency_key';
 if found then
  if previous.request<>req then raise exception 'booking_replay_mismatch'; end if;
  return previous.result || '{"idempotency_replay":true}'::jsonb;
 end if;
 select * into s from mr_coaching.services where id=(p_payload->>'service_credit_id')::uuid for update;
 select * into o from mr_coaching.orders where order_id=s.order_id;
 if s.id is null or o.state<>'paid' or o.customer_id is distinct from (p_payload->>'actor_user_id')::uuid
 or o.wp_customer_id is distinct from (p_payload->>'actor_wp_user_id')::bigint then raise exception 'paid_owned_credit_required'; end if;
 if action not in ('book','reschedule','cancel') or action is null then raise exception 'invalid_action'; end if;
 if action='book' and s.state<>'available' then raise exception 'credit_unavailable'; end if;
 if action in ('reschedule','cancel') then
  select * into old from public.mm_appointments where id=s.appointment_id and deleted_at is null for update;
  if old.id is null or s.state<>'reserved' or p_payload->>'appointment_id' is distinct from old.id::text
  then raise exception 'reserved_native_appointment_required'; end if;
  if old.start_at<=clock_timestamp() then raise exception 'started_service_requires_review'; end if;
  -- Partial/short-notice/exception semantics require a separate reviewed staff
  -- action; never silently restore credits or invent forfeiture.
  if old.start_at<clock_timestamp()+interval '24 hours' then raise exception 'short_notice_staff_review_required'; end if;
 end if;
 if action<>'cancel' then
  v_start:=(p_payload->>'start_at')::timestamptz; v_end:=(p_payload->>'end_at')::timestamptz;
  if v_start is null or v_end is null or v_start<=clock_timestamp() or v_end-v_start<>s.minutes*interval '1 minute'
  then raise exception 'exact_service_duration_required'; end if;
  -- For this bounded slice do not split service/weekly budget across a local
  -- week boundary. This keeps the 1200-minute limit exact across DST.
  week_start:=date_trunc('week',v_start at time zone 'America/New_York') at time zone 'America/New_York';
  if v_end>(date_trunc('week',v_start at time zone 'America/New_York')+interval '7 days') at time zone 'America/New_York'
  then raise exception 'cross_week_service_requires_review'; end if;
  select * into a from mr_coaching.availability_approvals where id=(p_payload->>'approval_id')::uuid and revoked_at is null
  and service=s.service and provider_id=(p_payload->>'provider_id')::uuid and appointment_type_id=(p_payload->>'appointment_type_id')::uuid
  and approved_from<=v_start and approved_until>=v_end;
  if not found then raise exception 'specific_service_approval_required'; end if;
  -- Validate the real existing rule, including local day and wall-clock times.
  if not mr_coaching.slot_authorized(a.id,v_start,v_end,coalesce((p_payload->>'resource_id')::uuid,old.resource_id),old.id)
  then raise exception 'outside_actual_authorized_rule'; end if;
  select coalesce(sum(extract(epoch from (ap.end_at-ap.start_at))/60),0) into used_minutes
   from mr_coaching.services cr join public.mm_appointments ap on ap.id=cr.appointment_id
   where cr.id<>s.id and ap.deleted_at is null and ap.status in ('held','booked','confirmed','completed','no_show')
   and ap.start_at>=week_start and ap.start_at<(date_trunc('week',v_start at time zone 'America/New_York')+interval '7 days') at time zone 'America/New_York';
  if used_minutes+s.minutes>1200 then raise exception 'weekly_coaching_capacity_exceeded'; end if;
  if s.service='mock' and o.sku in ('three','five') and not exists(
   select 1 from mr_coaching.services st join public.mm_appointments ap on ap.id=st.appointment_id
   where st.order_id=o.order_id and st.service='strategy' and st.state in ('reserved','delivered')
   and ap.status in ('booked','confirmed','completed') and ap.deleted_at is null and ap.end_at<=v_start)
  then raise exception 'strategy_must_precede_mock'; end if;
 end if;
 if s.service='strategy' and exists(select 1 from mr_coaching.services st join public.mm_appointments ap on ap.id=st.appointment_id
  where st.order_id=o.order_id and st.service='mock' and st.state='reserved' and ap.status in ('booked','confirmed')
  and (action='cancel' or ap.start_at<v_end)) then raise exception 'dependent_mock_sequence_requires_review'; end if;
 -- Strip all actor aliases rather than forwarding browser escalation fields.
 req:=p_payload || jsonb_build_object('actor_type','student','actorType','student',
  'student_user_id',o.customer_id,'studentUserId',o.customer_id,'student_wp_user_id',o.wp_customer_id,'studentWpUserId',o.wp_customer_id);
 insert into mr_coaching.mutation_context(transaction_id,backend_pid,credit_id,action,expected)
 values(txid_current(),pg_backend_pid(),s.id,action,jsonb_build_object(
  'appointment_type_id',case when action='cancel' then old.appointment_type_id else (p_payload->>'appointment_type_id')::uuid end,
  'provider_id',case when action='cancel' then old.provider_id else (p_payload->>'provider_id')::uuid end,
  'resource_id',coalesce((p_payload->>'resource_id')::uuid,old.resource_id),
  'schedule_event_id',coalesce((p_payload->>'schedule_event_id')::uuid,old.schedule_event_id),
  'start_at',case when action='cancel' then old.start_at else v_start end,'end_at',case when action='cancel' then old.end_at else v_end end,
  'status',case when action='cancel' then 'canceled' else 'booked' end,'deleted_at',null,
  'buffer_before_minutes',(select buffer_before_minutes from public.mm_appointment_types where id=case when action='cancel' then old.appointment_type_id else (p_payload->>'appointment_type_id')::uuid end),
  'buffer_after_minutes',(select buffer_after_minutes from public.mm_appointment_types where id=case when action='cancel' then old.appointment_type_id else (p_payload->>'appointment_type_id')::uuid end)));
 if action='book' then result:=public.mm_scheduler_book_appointment(req);
 elsif action='reschedule' then result:=public.mm_scheduler_reschedule_appointment(req);
 else result:=public.mm_scheduler_cancel_appointment(req); end if;
 if coalesce((result->>'ok')::boolean,false) is not true then raise exception 'native_booking_failed'; end if;
 delete from mr_coaching.mutation_context where transaction_id=txid_current() and backend_pid=pg_backend_pid();
 update mr_coaching.services set state=case when action='cancel' then 'available' else 'reserved' end,
 appointment_id=case when action='cancel' then null else (result->>'appointment_id')::uuid end where id=s.id;
 insert into mr_coaching.operations(idempotency_key,request,result) values(p_payload->>'idempotency_key',p_payload,result);
 return result;
end $$;

-- No default PUBLIC execution, no authenticated/anonymous ledger API. Each new
-- function is invoker; service_role is the sole server trust boundary.
revoke all on all functions in schema mr_coaching from public,anon,authenticated;
grant execute on all functions in schema mr_coaching to service_role;
revoke all on function public.mm_coaching_claim_activation_outbox(jsonb),public.mm_coaching_ack_activation_outbox(jsonb),public.mm_coaching_release_unpaid_order(jsonb),public.mm_coaching_claim_bridge_nonce(jsonb),public.mm_coaching_admit_order(jsonb),public.mm_coaching_verified_payment(jsonb),
 public.mm_coaching_approve_availability(jsonb),public.mm_coaching_read_model(jsonb),public.mm_coaching_mutate_appointment(jsonb) from public,anon,authenticated;
grant execute on function public.mm_coaching_claim_activation_outbox(jsonb),public.mm_coaching_ack_activation_outbox(jsonb),public.mm_coaching_release_unpaid_order(jsonb),public.mm_coaching_claim_bridge_nonce(jsonb),public.mm_coaching_admit_order(jsonb),public.mm_coaching_verified_payment(jsonb),
 public.mm_coaching_approve_availability(jsonb),public.mm_coaching_read_model(jsonb),public.mm_coaching_mutate_appointment(jsonb) to service_role;
commit;
