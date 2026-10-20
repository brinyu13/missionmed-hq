-- Migration: 20261020141151_mr_ir_commerce_0001_woo_hybrid.sql
-- Authority: MR-IR-COMMERCE-0001 / DR-516, continuing DR-511
-- Date: 2026-10-20
-- Generated: Supabase CLI 2.75.0 migration new, 2026-10-20T14:11:51Z
-- Depends on: 20261019171856_mr_ir_commerce_0001_booking_refund_safety.sql
-- Description: Woo-owned immutable allowances; native atomic usage only.
-- Idempotent: NO. Forward only; prior committed migrations remain unchanged.
-- Rollback: disable new coaching admission/reads, preserve paid evidence and appointments.
-- No runtime enablement, products, payment, identity or existing native RPC rewrite.
-- Woo alone owns money, admission/cap and purchased allowance. Scheduler owns
-- immutable allowance projection + the existing service usage lifecycle only.
-- Trusted boundary: the existing authenticated HQ Woo reader, invoked afresh
-- by server code. No JSON source flag authenticates a caller. Only service_role
-- may submit receipts; never forward browser-supplied receipt/binding/digest.
-- Freshness <=15 seconds is NOT cross-system refund/booking atomicity.
begin;

create table mr_coaching.woo_allowances (
 id uuid primary key default gen_random_uuid(), order_id bigint not null unique,
 order_item_id bigint not null unique, product_id bigint not null, sku text not null,
 customer_id uuid not null, wp_customer_id bigint not null check(wp_customer_id>0),
 snapshot_digest text not null check(snapshot_digest ~ '^[a-f0-9]{64}$'),
 immutable_projection jsonb not null, created_at timestamptz not null default clock_timestamp()
);
create index woo_allowances_owner on mr_coaching.woo_allowances(customer_id,wp_customer_id);
create table mr_coaching.woo_receipts (
 request_id text primary key check(request_id ~ '^[a-f0-9]{48}$'),
 customer_id uuid not null, wp_customer_id bigint not null,
 request_digest text not null check(request_digest ~ '^[a-f0-9]{64}$'),
 checked_at timestamptz not null, valid_until timestamptz not null,
 payload jsonb not null, transaction_id bigint not null, backend_pid integer not null,
 received_at timestamptz not null default clock_timestamp()
);
create index woo_receipts_owner_time on mr_coaching.woo_receipts(customer_id,wp_customer_id,checked_at);
create table mr_coaching.woo_receipt_packages (
 request_id text not null references mr_coaching.woo_receipts(request_id),
 allowance_id uuid not null references mr_coaching.woo_allowances(id),
 eligibility_revision bigint not null check(eligibility_revision>0),
 primary key(request_id,allowance_id)
);
create index woo_receipt_revision on mr_coaching.woo_receipt_packages(allowance_id,eligibility_revision);
alter table mr_coaching.services alter column order_id drop not null;
alter table mr_coaching.services add column woo_allowance_id uuid references mr_coaching.woo_allowances(id);
alter table mr_coaching.services add column woo_unit_id text unique;
alter table mr_coaching.services add constraint services_woo_projection_pair check(
 (woo_allowance_id is null and woo_unit_id is null) or
 (woo_allowance_id is not null and woo_unit_id is not null and order_id is null));
alter table mr_coaching.mutation_context add column woo_request_id text references mr_coaching.woo_receipts(request_id);
do $$ declare t text; begin
 foreach t in array array['woo_allowances','woo_receipts','woo_receipt_packages'] loop
  execute format('alter table mr_coaching.%I enable row level security',t);
  execute format('revoke all on mr_coaching.%I from public,anon,authenticated',t);
  execute format('grant select,insert on mr_coaching.%I to service_role',t);
 end loop;
end $$;

-- Append-only receipt import. This is deliberately not a public grant/sync API.
-- The only caller is a server-owned native read/mutation transaction below.
create function mr_coaching.import_woo_receipt(p jsonb) returns text
language plpgsql security invoker set search_path='' as $$
declare r jsonb; pack jsonb; unit jsonb; allowance mr_coaching.woo_allowances;
 customer uuid; wp bigint; checked bigint; until_at bigint; expected integer; revision bigint;
 prior_revision bigint; service_count integer; ordinal integer; duration integer;
begin
 perform mr_coaching.guard();
 if p->>'identity_source' is distinct from 'native_scheduler_authenticated_actor'
 or p->>'allowance_source' is distinct from 'authenticated_server_woo_read'
 or coalesce(p->>'request_digest','') !~ '^[a-f0-9]{64}$' then raise exception 'trusted_woo_reader_required'; end if;
 customer:=(p->>'actor_user_id')::uuid; wp:=(p->>'actor_wp_user_id')::bigint; r:=p->'allowance_receipt';
 if customer is null or wp is null or wp<=0 or jsonb_typeof(r) is distinct from 'object'
 or (select count(*) from jsonb_object_keys(r))<>8
 or r->>'schema' is distinct from 'missionmed.coaching.allowances.v1'
 or coalesce(r->>'request_id','') !~ '^[a-f0-9]{48}$'
 or r->>'subject_user_id' is distinct from customer::text
 or r->'subject_wp_user_id' is distinct from to_jsonb(wp)
 or r->'complete' is distinct from 'true'::jsonb
 or jsonb_typeof(r->'packages') is distinct from 'array' or jsonb_array_length(r->'packages')>100
 or jsonb_typeof(r->'checked_at') is distinct from 'number' or coalesce(r->>'checked_at','') !~ '^[0-9]+$'
 or jsonb_typeof(r->'valid_until') is distinct from 'number' or coalesce(r->>'valid_until','') !~ '^[0-9]+$'
 then raise exception 'exact_owned_complete_woo_receipt_required'; end if;
 checked:=(r->>'checked_at')::bigint; until_at:=(r->>'valid_until')::bigint;
 if until_at<>checked+15 or checked>extract(epoch from clock_timestamp())+1
 or extract(epoch from clock_timestamp())-checked>15 or clock_timestamp()>=to_timestamp(until_at)
 then raise exception 'woo_receipt_expired'; end if;
 if exists(select 1 from mr_coaching.woo_receipts where customer_id=customer and wp_customer_id=wp and checked_at>to_timestamp(checked))
 then raise exception 'woo_receipt_time_rollback'; end if;
 insert into mr_coaching.woo_receipts(request_id,customer_id,wp_customer_id,request_digest,checked_at,valid_until,payload,transaction_id,backend_pid)
 values(r->>'request_id',customer,wp,p->>'request_digest',to_timestamp(checked),to_timestamp(until_at),r,txid_current(),pg_backend_pid());
 for pack in select value from jsonb_array_elements(r->'packages') loop
  if jsonb_typeof(pack) is distinct from 'object' or (select count(*) from jsonb_object_keys(pack))<>7
  or jsonb_typeof(pack->'order_id') is distinct from 'number' or coalesce(pack->>'order_id','') !~ '^[1-9][0-9]*$'
  or jsonb_typeof(pack->'order_item_id') is distinct from 'number' or coalesce(pack->>'order_item_id','') !~ '^[1-9][0-9]*$'
  or jsonb_typeof(pack->'product_id') is distinct from 'number' or coalesce(pack->>'product_id','') !~ '^[1-9][0-9]*$'
  or jsonb_typeof(pack->'eligibility_revision') is distinct from 'number' or coalesce(pack->>'eligibility_revision','') !~ '^[1-9][0-9]*$'
  or coalesce(pack->>'snapshot_digest','') !~ '^[a-f0-9]{64}$'
  or jsonb_typeof(pack->'units') is distinct from 'array' then raise exception 'immutable_woo_package_required'; end if;
  if (pack->>'order_id')::numeric>9007199254740991 or (pack->>'order_item_id')::numeric>9007199254740991
  or (pack->>'product_id')::numeric>9007199254740991 or (pack->>'eligibility_revision')::numeric>9007199254740991
  then raise exception 'safe_integer_woo_identity_required'; end if;
  expected:=case pack->>'sku' when 'single' then 1 when 'three' then 6 when 'five' then 9 end;
  if expected is null or jsonb_array_length(pack->'units')<>expected then raise exception 'approved_woo_units_required'; end if;
  revision:=(pack->>'eligibility_revision')::bigint;
  select * into allowance from mr_coaching.woo_allowances where order_id=(pack->>'order_id')::bigint or order_item_id=(pack->>'order_item_id')::bigint;
  if found then
   if allowance.customer_id<>customer or allowance.wp_customer_id<>wp or allowance.immutable_projection<>pack-'eligibility_revision'
   then raise exception 'immutable_woo_owner_snapshot_mismatch'; end if;
   select max(eligibility_revision) into prior_revision from mr_coaching.woo_receipt_packages where allowance_id=allowance.id;
   if revision<prior_revision then raise exception 'woo_revision_rollback'; end if;
  else
   insert into mr_coaching.woo_allowances(order_id,order_item_id,product_id,sku,customer_id,wp_customer_id,snapshot_digest,immutable_projection)
   values((pack->>'order_id')::bigint,(pack->>'order_item_id')::bigint,(pack->>'product_id')::bigint,pack->>'sku',customer,wp,pack->>'snapshot_digest',pack-'eligibility_revision') returning * into allowance;
  end if;
  insert into mr_coaching.woo_receipt_packages(request_id,allowance_id,eligibility_revision) values(r->>'request_id',allowance.id,revision);
  for unit in select value from jsonb_array_elements(pack->'units') loop
   if jsonb_typeof(unit) is distinct from 'object' or (select count(*) from jsonb_object_keys(unit))<>10
   or unit->'order_id' is distinct from pack->'order_id' or unit->'order_item_id' is distinct from pack->'order_item_id'
   or unit->'product_id' is distinct from pack->'product_id' or unit->'owner_wp_user_id' is distinct from to_jsonb(wp)
   or unit->>'sku' is distinct from pack->>'sku' or unit->>'snapshot_digest' is distinct from pack->>'snapshot_digest'
   or jsonb_typeof(unit->'ordinal') is distinct from 'number' or coalesce(unit->>'ordinal','') !~ '^[1-9][0-9]*$'
   then raise exception 'snapshot_owned_woo_unit_required'; end if;
   ordinal:=(unit->>'ordinal')::integer;
   service_count:=case unit->>'service' when 'strategy' then case when pack->>'sku'='single' then 0 else 1 end
    when 'mock' then case pack->>'sku' when 'single' then 1 when 'three' then 3 when 'five' then 5 end
    when 'debrief' then case pack->>'sku' when 'single' then 0 when 'three' then 2 when 'five' then 3 end end;
   duration:=case unit->>'service' when 'strategy' then 120 when 'mock' then 105 when 'debrief' then 45 end;
   if service_count is null or ordinal>service_count or unit->'duration_minutes' is distinct from to_jsonb(duration)
   or unit->>'unit_id' is distinct from 'coaching-unit:v1:'||allowance.order_id||':'||allowance.order_item_id||':'||(unit->>'service')||':'||ordinal
   then raise exception 'approved_woo_unit_binding_required'; end if;
   if exists(select 1 from mr_coaching.services where woo_unit_id=unit->>'unit_id') then
    if not exists(select 1 from mr_coaching.services s where s.woo_unit_id=unit->>'unit_id' and s.woo_allowance_id=allowance.id and s.service=unit->>'service' and s.ordinal=(unit->>'ordinal')::integer and s.minutes=duration)
    then raise exception 'immutable_woo_unit_conflict'; end if;
   else
    insert into mr_coaching.services(order_id,woo_allowance_id,woo_unit_id,service,ordinal,minutes)
    values(null,allowance.id,unit->>'unit_id',unit->>'service',ordinal,duration);
   end if;
  end loop;
  if (select count(*) from mr_coaching.services where woo_allowance_id=allowance.id)<>expected then raise exception 'duplicate_or_missing_woo_units'; end if;
 end loop;
 return r->>'request_id';
end $$;

create function mr_coaching.assert_woo_context(request_id text, allowance_id uuid, digest text) returns void
language plpgsql security invoker set search_path='' as $$
begin
 if not exists(select 1 from mr_coaching.woo_receipts r join mr_coaching.woo_receipt_packages p on p.request_id=r.request_id
 where r.request_id=assert_woo_context.request_id and p.allowance_id=assert_woo_context.allowance_id and r.request_digest=digest
 and r.transaction_id=txid_current() and r.backend_pid=pg_backend_pid() and clock_timestamp()<r.valid_until
 and not exists(select 1 from mr_coaching.woo_receipt_packages newer where newer.allowance_id=p.allowance_id and newer.eligibility_revision>p.eligibility_revision))
 then raise exception 'current_transaction_woo_eligibility_required'; end if;
end $$;

-- This replaces only the additive coaching guard, never the original three
-- Scheduler RPC bodies. Ordinary legacy 360/Complete appointments are untouched.
create or replace function mr_coaching.police_appointment() returns trigger
language plpgsql security definer set search_path='' as $$
declare type_id uuid; ap_id uuid; ctx mr_coaching.mutation_context; credit mr_coaching.services; owner mr_coaching.woo_allowances; actual jsonb;
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
 if credit.woo_allowance_id is not null then
  select * into owner from mr_coaching.woo_allowances where id=credit.woo_allowance_id;
  if NEW.student_user_id is distinct from owner.customer_id or NEW.student_wp_user_id is distinct from owner.wp_customer_id then raise exception 'coaching_context_owner_mismatch'; end if;
  if ctx.action<>'cancel' then perform mr_coaching.assert_woo_context(ctx.woo_request_id,owner.id,ctx.expected->>'woo_request_digest'); end if;
 elsif ctx.action<>'cancel' or TG_OP<>'UPDATE' or NEW.student_user_id is distinct from OLD.student_user_id or NEW.student_wp_user_id is distinct from OLD.student_wp_user_id
 then raise exception 'legacy_coaching_usage_cancellation_only'; end if;
 actual:=jsonb_build_object('appointment_type_id',NEW.appointment_type_id,'provider_id',NEW.provider_id,'resource_id',NEW.resource_id,
 'schedule_event_id',NEW.schedule_event_id,'start_at',NEW.start_at,'end_at',NEW.end_at,'status',NEW.status,'deleted_at',NEW.deleted_at,
 'buffer_before_minutes',NEW.buffer_before_minutes,'buffer_after_minutes',NEW.buffer_after_minutes);
 if actual<>(ctx.expected-'woo_request_digest') then raise exception 'coaching_context_mutation_mismatch'; end if;
 if TG_OP='INSERT' then
  if ctx.action<>'book' or credit.state<>'available' then raise exception 'coaching_context_credit_unavailable'; end if;
 elsif ctx.action not in ('reschedule','cancel') or credit.state<>'reserved' or credit.appointment_id<>OLD.id then raise exception 'coaching_context_appointment_mismatch'; end if;
 return NEW;
end $$;

create function public.mm_coaching_hybrid_read_model(p_payload jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare receipt text;
begin
 receipt:=mr_coaching.import_woo_receipt(p_payload);
 -- Owned immutable projections remain visible for usage/cancellation history.
 -- Only membership in this fresh complete receipt grants booking rights.
 return jsonb_build_object('packages',coalesce((select jsonb_agg(jsonb_build_object('order_id',a.order_id,'order_item_id',a.order_item_id,'sku',a.sku,'snapshot_digest',a.snapshot_digest,
 'booking_allowed',p.allowance_id is not null,'services',(select jsonb_agg(to_jsonb(s)||jsonb_build_object('unit_id',s.woo_unit_id)) from mr_coaching.services s where s.woo_allowance_id=a.id)))
 from mr_coaching.woo_allowances a left join mr_coaching.woo_receipt_packages p on p.allowance_id=a.id and p.request_id=receipt
 where a.customer_id=(p_payload->>'actor_user_id')::uuid and a.wp_customer_id=(p_payload->>'actor_wp_user_id')::bigint),'[]'::jsonb),
 'eligible_services',coalesce((select jsonb_agg(jsonb_build_object('service',a.service,'approval_id',a.id,'appointment_type_id',a.appointment_type_id,'donor_appointment_type_id',t.donor_appointment_type_id,
 'availability_rule_id',a.availability_rule_id,'provider_id',a.provider_id,'approved_from',a.approved_from,'approved_until',a.approved_until))
 from mr_coaching.availability_approvals a join mr_coaching.service_types t on t.appointment_type_id=a.appointment_type_id
 where a.revoked_at is null and a.approved_until>clock_timestamp() and exists(select 1 from mr_coaching.services s join mr_coaching.woo_receipt_packages p on p.allowance_id=s.woo_allowance_id
 where p.request_id=receipt and s.service=a.service and s.state in ('available','reserved'))),'[]'::jsonb),
 'weekly_usage',coalesce((select jsonb_agg(jsonb_build_object('week_start_utc',w.local_week at time zone 'America/New_York','week_end_utc',(w.local_week+interval '7 days') at time zone 'America/New_York','used_minutes',w.minutes))
 from (select date_trunc('week',ap.start_at at time zone 'America/New_York') local_week,sum(extract(epoch from(ap.end_at-ap.start_at))/60) minutes
 from mr_coaching.services s join public.mm_appointments ap on ap.id=s.appointment_id where ap.deleted_at is null and ap.status in ('held','booked','confirmed','completed','no_show')
 group by date_trunc('week',ap.start_at at time zone 'America/New_York')) w),'[]'::jsonb));
end $$;

create function public.mm_coaching_hybrid_lookup_operation(p_payload jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare prior mr_coaching.operations;
begin
 perform mr_coaching.guard();
 if p_payload->>'identity_source' is distinct from 'native_scheduler_authenticated_actor'
 or (p_payload->>'actor_user_id')::uuid is null or (p_payload->>'actor_wp_user_id')::bigint is null
 or coalesce(p_payload->>'client_request_digest','') !~ '^[a-f0-9]{64}$' then raise exception 'trusted_operation_lookup_required'; end if;
 select * into prior from mr_coaching.operations where idempotency_key=p_payload->>'idempotency_key';
 if not found then return null; end if;
 if prior.request->'hybrid_usage' is distinct from 'true'::jsonb or prior.request->>'actor_user_id' is distinct from p_payload->>'actor_user_id'
 or prior.request->>'actor_wp_user_id' is distinct from p_payload->>'actor_wp_user_id' or prior.request->>'action' is distinct from p_payload->>'action'
 or prior.client_request_digest is distinct from p_payload->>'client_request_digest' then raise exception 'booking_replay_mismatch'; end if;
 return jsonb_build_object('result',prior.result||'{"idempotency_replay":true}'::jsonb,'appointment_type',prior.appointment_type,
 'payload',(prior.request-'allowance_receipt'-'request_binding')||jsonb_build_object('student_user_id',p_payload->'actor_user_id','student_wp_user_id',p_payload->'actor_wp_user_id'));
end $$;

create function public.mm_coaching_hybrid_mutate_appointment(p_payload jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare s mr_coaching.services; o mr_coaching.woo_allowances; a mr_coaching.availability_approvals;
 old public.mm_appointments; result jsonb; req jsonb; replay jsonb; binding jsonb; binding_key text; receipt text;
 action text; v_start timestamptz; v_end timestamptz; week_start timestamptz; used_minutes numeric;
begin
 perform mr_coaching.guard();
 if p_payload->>'identity_source' is distinct from 'native_scheduler_authenticated_actor'
 or (p_payload->>'actor_user_id')::uuid is null or (p_payload->>'actor_wp_user_id')::bigint<=0
 or coalesce(p_payload->>'client_request_digest','') !~ '^[a-f0-9]{64}$'
 or nullif(p_payload->>'idempotency_key','') is null then raise exception 'trusted_native_usage_actor_required'; end if;
 action:=p_payload->>'action';
 if action not in ('book','reschedule','cancel') or action is null then raise exception 'invalid_action'; end if;
 replay:=public.mm_coaching_hybrid_lookup_operation(p_payload);
 if replay is not null then return replay->'result'; end if;
 binding:='{}'::jsonb;
 foreach binding_key in array array['actor_user_id','actor_wp_user_id','action','idempotency_key','client_request_digest','unit_id','appointment_id','appointment_type_id','provider_id','resource_id','approval_id','start_at','end_at','timezone'] loop
  binding:=binding||jsonb_build_object(binding_key,p_payload->binding_key);
 end loop;
 if jsonb_typeof(p_payload->'request_binding') is distinct from 'string'
 or (p_payload->>'request_binding')::jsonb<>binding or coalesce(p_payload->>'request_digest','') !~ '^[a-f0-9]{64}$'
 or encode(sha256(convert_to(p_payload->>'request_binding','UTF8')),'hex')<>p_payload->>'request_digest'
 then raise exception 'server_resolved_request_binding_required'; end if;
 if action<>'cancel' then receipt:=mr_coaching.import_woo_receipt(p_payload); end if;
 if action='book' then
  select * into s from mr_coaching.services where woo_unit_id=p_payload->>'unit_id' for update;
 else
  select * into s from mr_coaching.services where appointment_id=(p_payload->>'appointment_id')::uuid for update;
 end if;
 if s.id is null or s.woo_unit_id is distinct from p_payload->>'unit_id' then raise exception 'owned_woo_usage_unit_required'; end if;
 if p_payload ? 'service_credit_id' and s.id is distinct from (p_payload->>'service_credit_id')::uuid then raise exception 'usage_unit_binding_mismatch'; end if;
 select * into o from mr_coaching.woo_allowances where id=s.woo_allowance_id;
 if action<>'cancel' then
  if o.id is null or o.customer_id is distinct from (p_payload->>'actor_user_id')::uuid or o.wp_customer_id is distinct from (p_payload->>'actor_wp_user_id')::bigint
  then raise exception 'owned_woo_allowance_required'; end if;
  perform mr_coaching.assert_woo_context(receipt,o.id,p_payload->>'request_digest');
 end if;
 if action='book' and s.state<>'available' then raise exception 'credit_unavailable'; end if;
 if action in ('reschedule','cancel') then
  select * into old from public.mm_appointments where id=s.appointment_id and deleted_at is null for update;
  if old.id is null or s.state<>'reserved' or p_payload->>'appointment_id' is distinct from old.id::text
  then raise exception 'reserved_native_appointment_required'; end if;
  if old.student_user_id is distinct from (p_payload->>'actor_user_id')::uuid or old.student_wp_user_id is distinct from (p_payload->>'actor_wp_user_id')::bigint then raise exception 'owned_usage_required'; end if;
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
   where (st.woo_allowance_id=o.id or (o.id is null and st.order_id=s.order_id)) and st.service='strategy' and st.state in ('reserved','delivered')
   and ap.status in ('booked','confirmed','completed') and ap.deleted_at is null and ap.end_at<=v_start)
  then raise exception 'strategy_must_precede_mock'; end if;
 end if;
 if s.service='strategy' and exists(select 1 from mr_coaching.services st join public.mm_appointments ap on ap.id=st.appointment_id
  where (st.woo_allowance_id=o.id or (o.id is null and st.order_id=s.order_id)) and st.service='mock' and st.state='reserved' and ap.status in ('booked','confirmed')
  and (action='cancel' or ap.start_at<v_end)) then raise exception 'dependent_mock_sequence_requires_review'; end if;
 -- Strip all actor aliases rather than forwarding browser escalation fields.
 req:=p_payload || jsonb_build_object('actor_type','student','actorType','student',
  'student_user_id',(p_payload->>'actor_user_id')::uuid,'studentUserId',(p_payload->>'actor_user_id')::uuid,'student_wp_user_id',(p_payload->>'actor_wp_user_id')::bigint,'studentWpUserId',(p_payload->>'actor_wp_user_id')::bigint);
 insert into mr_coaching.mutation_context(transaction_id,backend_pid,credit_id,action,woo_request_id,expected)
 values(txid_current(),pg_backend_pid(),s.id,action,receipt,jsonb_build_object(
  'woo_request_digest',p_payload->>'request_digest',
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
 if action<>'cancel' then perform mr_coaching.assert_woo_context(receipt,o.id,p_payload->>'request_digest'); end if;
 delete from mr_coaching.mutation_context where transaction_id=txid_current() and backend_pid=pg_backend_pid();
 update mr_coaching.services set state=case when action='cancel' then 'available' else 'reserved' end,
 appointment_id=case when action='cancel' then null else (result->>'appointment_id')::uuid end where id=s.id;
 if p_payload ? 'client_request_digest' and coalesce(p_payload->>'client_request_digest','') !~ '^[a-f0-9]{64}$' then raise exception 'client_request_digest_required'; end if;
 insert into mr_coaching.operations(idempotency_key,request,result,client_request_digest,appointment_type)
 values(p_payload->>'idempotency_key',p_payload||'{"hybrid_usage":true}'::jsonb,result,p_payload->>'client_request_digest',
 (select to_jsonb(t) from public.mm_appointment_types t where id=case when action='cancel' then old.appointment_type_id else (p_payload->>'appointment_type_id')::uuid end));
 return result;
end $$;

-- Retire runtime execution, not evidence. Existing orders/payment/refund/outbox
-- records remain unchanged, but no old bridge RPC can create purchased rights.
revoke execute on function public.mm_coaching_admit_order(jsonb),public.mm_coaching_verified_payment(jsonb),public.mm_coaching_observe_refund(jsonb),
 public.mm_coaching_release_unpaid_order(jsonb),public.mm_coaching_claim_activation_outbox(jsonb),public.mm_coaching_ack_activation_outbox(jsonb),
 public.mm_coaching_claim_bridge_nonce(jsonb),public.mm_coaching_read_model(jsonb),public.mm_coaching_lookup_operation(jsonb),public.mm_coaching_mutate_appointment(jsonb)
 from public,anon,authenticated,service_role;
revoke insert,update,delete on mr_coaching.campaign,mr_coaching.offers,mr_coaching.orders,mr_coaching.financial_evidence,
 mr_coaching.financial_observations,mr_coaching.terminal_unpaid_evidence,mr_coaching.activation_outbox from service_role;
revoke execute on function mr_coaching.expire_unpaid() from service_role;
revoke all on function mr_coaching.import_woo_receipt(jsonb),mr_coaching.assert_woo_context(text,uuid,text),
 public.mm_coaching_hybrid_read_model(jsonb),public.mm_coaching_hybrid_lookup_operation(jsonb),public.mm_coaching_hybrid_mutate_appointment(jsonb) from public,anon,authenticated;
grant execute on function mr_coaching.import_woo_receipt(jsonb),mr_coaching.assert_woo_context(text,uuid,text),
 public.mm_coaching_hybrid_read_model(jsonb),public.mm_coaching_hybrid_lookup_operation(jsonb),public.mm_coaching_hybrid_mutate_appointment(jsonb) to service_role;
commit;
