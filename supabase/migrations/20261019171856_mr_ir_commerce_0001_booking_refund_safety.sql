-- Migration: 20261019171856_mr_ir_commerce_0001_booking_refund_safety.sql
-- Authority: MR-IR-COMMERCE-0001 / DR-511
-- Date: 2026-10-19
-- Depends on: 20261019162700_mr_coaching_native_contract.sql
-- Description: Add native refund quarantine, owned replay lookup, and NY-week usage.
-- Idempotent: NO
-- Forward only; committed 20261019162700 remains immutable. Disabled defaults unchanged.
-- Rollback: disable coaching at the application/campaign gate; preserve financial evidence.
-- No production execution, provider configuration, or existing Scheduler RPC rewrite.
begin;
alter table mr_coaching.orders add column refund_review_required boolean not null default false;
alter table mr_coaching.operations add column client_request_digest text check(client_request_digest ~ '^[a-f0-9]{64}$');
alter table mr_coaching.operations add column appointment_type jsonb;
create table mr_coaching.refund_evidence (
 event_id text primary key, refund_id text not null, order_id text not null references mr_coaching.orders(order_id),
 cumulative_refund_cents bigint not null check(cumulative_refund_cents>0), payload jsonb not null,
 received_at timestamptz not null default clock_timestamp()
);
create index refund_evidence_refund on mr_coaching.refund_evidence(refund_id);
alter table mr_coaching.refund_evidence enable row level security;
revoke all on mr_coaching.refund_evidence from public,anon,authenticated;
grant select,insert on mr_coaching.refund_evidence to service_role;

create function public.mm_coaching_observe_refund(p_payload jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare o mr_coaching.orders; prior mr_coaching.refund_evidence; cumulative bigint;
begin
 perform mr_coaching.guard();
 select * into o from mr_coaching.orders where order_id=p_payload->>'order_id' for update;
 if not found then raise exception 'admitted_order_required'; end if;
 if o.snapshot<>mr_coaching.snapshot(p_payload) or o.snapshot_digest is distinct from p_payload->>'snapshot_digest'
 or p_payload->>'source' is distinct from 'canonical_woo_verified' or p_payload->>'event_type' is distinct from 'refund_observed'
 or p_payload->'refund_record_verified' is distinct from 'true'::jsonb or nullif(p_payload->>'event_id','') is null
 or nullif(p_payload->>'refund_id','') is null or jsonb_typeof(p_payload->'cumulative_refund_cents') is distinct from 'number'
 or coalesce(p_payload->>'cumulative_refund_cents','') !~ '^[1-9][0-9]*$'
 then raise exception 'canonical_refund_snapshot_required'; end if;
 cumulative:=(p_payload->>'cumulative_refund_cents')::bigint;
 if cumulative>(o.snapshot->>'total_cents')::bigint then raise exception 'refund_exceeds_original_total'; end if;
 if exists(select 1 from mr_coaching.refund_evidence where refund_id=p_payload->>'refund_id' and order_id<>o.order_id)
 then raise exception 'refund_owner_conflict'; end if;
 select * into prior from mr_coaching.refund_evidence where event_id=p_payload->>'event_id';
 if found then
  if prior.order_id<>o.order_id or prior.payload<>p_payload then raise exception 'refund_replay_mismatch'; end if;
 else
  insert into mr_coaching.refund_evidence(event_id,refund_id,order_id,cumulative_refund_cents,payload)
  values(p_payload->>'event_id',p_payload->>'refund_id',o.order_id,cumulative,p_payload);
 end if;
 -- A refund may arrive before the payment bridge has activated this order.
 -- Quarantine the admission without inventing payment/settlement evidence or
 -- calling captured money an unused unpaid release. Preserve other history.
 update mr_coaching.orders set refund_review_required=true,
 state=case when state='reserved' then 'review' else state end
 where order_id=o.order_id returning * into o;
 -- Do not send a still-pending activation after a recorded refund. Already-sent
 -- history and uncertain claimed delivery are preserved for explicit review.
 update mr_coaching.activation_outbox set status='review' where order_id=o.order_id and status='pending';
 return jsonb_build_object('state',o.state,'order_id',o.order_id,'activation_allowed',false,'refund_review_required',true,
 'cumulative_refund_cents',(select max(cumulative_refund_cents) from mr_coaching.refund_evidence where order_id=o.order_id),
 'idempotency_replay',prior.event_id is not null);
end $$;

create function public.mm_coaching_lookup_operation(p_payload jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare prior mr_coaching.operations; o mr_coaching.orders; owned_type jsonb;
begin
 perform mr_coaching.guard();
 if p_payload->>'identity_source' is distinct from 'native_scheduler_authenticated_actor'
 or (p_payload->>'actor_user_id')::uuid is null or (p_payload->>'actor_wp_user_id')::bigint is null
 or nullif(p_payload->>'idempotency_key','') is null or coalesce(p_payload->>'client_request_digest','') !~ '^[a-f0-9]{64}$'
 then raise exception 'trusted_operation_lookup_required'; end if;
 select * into prior from mr_coaching.operations where idempotency_key=p_payload->>'idempotency_key';
 if not found then return null; end if;
 if prior.request->>'actor_user_id' is distinct from p_payload->>'actor_user_id'
 or prior.request->>'actor_wp_user_id' is distinct from p_payload->>'actor_wp_user_id'
 or prior.request->>'action' is distinct from p_payload->>'action'
 or prior.client_request_digest is distinct from p_payload->>'client_request_digest'
 then raise exception 'booking_replay_mismatch'; end if;
 select package.* into o from mr_coaching.services s join mr_coaching.orders package on package.order_id=s.order_id
 where s.id=(prior.request->>'service_credit_id')::uuid;
 if o.customer_id is distinct from (p_payload->>'actor_user_id')::uuid or o.wp_customer_id is distinct from (p_payload->>'actor_wp_user_id')::bigint
 then raise exception 'paid_owned_credit_required'; end if;
 owned_type:=prior.appointment_type;
 if owned_type is null then raise exception 'historical_operation_requires_review'; end if;
 return jsonb_build_object('result',prior.result||jsonb_build_object('idempotency_replay',true,'refund_review_required',o.refund_review_required),
 'appointment_type',owned_type,'payload',prior.request||jsonb_build_object('student_user_id',o.customer_id,'student_wp_user_id',o.wp_customer_id));
end $$;

create or replace function public.mm_coaching_read_model(p_payload jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare customer uuid; wp bigint;
begin
 perform mr_coaching.guard();
 if p_payload->>'identity_source' is distinct from 'native_scheduler_authenticated_actor' then raise exception 'trusted_native_identity_required'; end if;
 customer:=(p_payload->>'actor_user_id')::uuid; wp:=(p_payload->>'actor_wp_user_id')::bigint;
 if customer is null or wp is null or wp<=0 then raise exception 'exact_actor_pair_required'; end if;
 if exists(select 1 from mr_coaching.orders where wp_customer_id=wp and customer_id is not null and customer_id<>customer)
 then raise exception 'identity_binding_conflict'; end if;
 update mr_coaching.orders set customer_id=customer where wp_customer_id=wp and customer_id is null;
 return jsonb_build_object('packages',coalesce((select jsonb_agg(jsonb_build_object('order_id',o.order_id,'sku',o.sku,
 'snapshot_digest',o.snapshot_digest,'booking_allowed',not o.refund_review_required,'refund_review_required',o.refund_review_required,
 'services',(select coalesce(jsonb_agg(to_jsonb(s)),'[]') from mr_coaching.services s where s.order_id=o.order_id)))
 from mr_coaching.orders o where o.wp_customer_id=wp and o.customer_id=customer and o.state='paid'),'[]'::jsonb),
 'eligible_services',coalesce((select jsonb_agg(jsonb_build_object('service',a.service,'approval_id',a.id,
 'appointment_type_id',a.appointment_type_id,'donor_appointment_type_id',st.donor_appointment_type_id,
 'availability_rule_id',a.availability_rule_id,'provider_id',a.provider_id,'approved_from',a.approved_from,'approved_until',a.approved_until))
 from mr_coaching.availability_approvals a join mr_coaching.service_types st on st.appointment_type_id=a.appointment_type_id
 where a.revoked_at is null and a.approved_until>clock_timestamp() and exists(
 select 1 from mr_coaching.services cr join mr_coaching.orders owned on owned.order_id=cr.order_id
 where owned.wp_customer_id=wp and owned.customer_id=customer and owned.state='paid' and not owned.refund_review_required
 and cr.service=a.service and cr.state in ('available','reserved'))),'[]'::jsonb),
 'weekly_usage',coalesce((select jsonb_agg(jsonb_build_object('week_start_utc',w.local_week at time zone 'America/New_York',
 'week_end_utc',(w.local_week+interval '7 days') at time zone 'America/New_York','used_minutes',w.minutes))
 from (select date_trunc('week',ap.start_at at time zone 'America/New_York') local_week,
 sum(extract(epoch from(ap.end_at-ap.start_at))/60) minutes
 from mr_coaching.services cr join public.mm_appointments ap on ap.id=cr.appointment_id
 where ap.deleted_at is null and ap.status in ('held','booked','confirmed','completed','no_show')
 group by date_trunc('week',ap.start_at at time zone 'America/New_York')) w),'[]'::jsonb));
end $$;

create or replace function mr_coaching.police_appointment() returns trigger language plpgsql security definer set search_path='' as $$
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
 if package.refund_review_required and ctx.action<>'cancel' then raise exception 'coaching_refund_review_required'; end if;
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

create or replace function public.mm_coaching_verified_payment(p_payload jsonb) returns jsonb
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
  return jsonb_build_object('state',o.state,'order_id',o.order_id,'activation_allowed',o.state='paid' and not o.refund_review_required,'idempotency_replay',true,
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

create or replace function public.mm_coaching_mutate_appointment(p_payload jsonb) returns jsonb
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
 if o.refund_review_required and action<>'cancel' then raise exception 'coaching_refund_review_required'; end if;
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
 if p_payload ? 'client_request_digest' and coalesce(p_payload->>'client_request_digest','') !~ '^[a-f0-9]{64}$' then raise exception 'client_request_digest_required'; end if;
 insert into mr_coaching.operations(idempotency_key,request,result,client_request_digest,appointment_type)
 values(p_payload->>'idempotency_key',p_payload,result,coalesce(p_payload->>'client_request_digest',encode(sha256(convert_to(p_payload::text,'UTF8')),'hex')),
 (select to_jsonb(t) from public.mm_appointment_types t where id=case when action='cancel' then old.appointment_type_id else (p_payload->>'appointment_type_id')::uuid end));
 return result;
end $$;

create or replace function public.mm_coaching_admit_order(p_payload jsonb) returns jsonb
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
  return jsonb_build_object('state',o.state,'order_id',o.order_id,'activation_allowed',o.state='paid' and not o.refund_review_required,'idempotency_replay',true);
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

revoke all on function public.mm_coaching_observe_refund(jsonb),public.mm_coaching_lookup_operation(jsonb) from public,anon,authenticated;
grant execute on function public.mm_coaching_observe_refund(jsonb),public.mm_coaching_lookup_operation(jsonb) to service_role;
commit;
