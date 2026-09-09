-- MX-MISSIONACCOUNTS-5401R: explicit, one-cycle-at-a-time Stripe charges.
-- This path is separate from the $25 automatic attendance-day workflow. The
-- database derives the amount from the current approved billing decision and
-- signed Stripe webhooks provide payment finality.

create table missionaccounts.manual_cycle_charge (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references missionaccounts.student(id),
  cycle_key text not null references missionaccounts.cycle(key),
  decision_id uuid not null unique references missionaccounts.billing_decision(id),
  invoice_id uuid not null unique references missionaccounts.invoice(id),
  amount_cents integer not null check (amount_cents > 0),
  provider_customer_ref text not null check (provider_customer_ref ~ '^cus_[A-Za-z0-9_]+$'),
  provider_payment_method_ref text not null check (provider_payment_method_ref ~ '^pm_[A-Za-z0-9_]+$'),
  provider_ref text unique check (provider_ref is null or provider_ref ~ '^pi_[A-Za-z0-9_]+$'),
  state text not null check (state in ('pending','succeeded','failed')),
  idempotency_key text not null unique,
  request_id text not null unique,
  prepared_by text not null,
  prepared_role text not null check (prepared_role in ('missionaccounts_admin','founder')),
  failure_code text,
  failure_message text,
  succeeded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index manual_cycle_charge_active_cycle_unique
  on missionaccounts.manual_cycle_charge(student_id, cycle_key)
  where state in ('pending','succeeded');

alter table missionaccounts.manual_cycle_charge enable row level security;
alter table missionaccounts.manual_cycle_charge force row level security;
revoke all on table missionaccounts.manual_cycle_charge from public, anon, authenticated;
grant select, insert, update on table missionaccounts.manual_cycle_charge to service_role;

insert into missionaccounts.feature_flag(key, enabled)
values ('manual_charges', false)
on conflict (key) do nothing;

create function missionaccounts.guard_billing_decision_against_manual_charge()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, missionaccounts
as $$
begin
  if (new.state is distinct from old.state or new.superseded_by_id is distinct from old.superseded_by_id)
     and exists (
       select 1 from missionaccounts.manual_cycle_charge charge
       where charge.decision_id = old.id and charge.state in ('pending','succeeded')
     ) then
    raise exception using errcode = '23514', message = 'manual_cycle_charge_requires_financial_review';
  end if;
  return new;
end;
$$;

create trigger billing_decision_manual_cycle_charge_guard
before update on missionaccounts.billing_decision
for each row execute function missionaccounts.guard_billing_decision_against_manual_charge();

revoke execute on function missionaccounts.guard_billing_decision_against_manual_charge()
from public, anon, authenticated;
grant execute on function missionaccounts.guard_billing_decision_against_manual_charge()
to service_role;

create function missionaccounts.api_prepare_manual_cycle_charge(
  p_student_id uuid,
  p_cycle_key text,
  p_expected_decision_id uuid,
  p_expected_amount_cents integer,
  p_expected_last4 text,
  p_actor_id text,
  p_actor_role text,
  p_request_id text
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, missionaccounts
as $$
declare
  student_row missionaccounts.student%rowtype;
  decision_row missionaccounts.billing_decision%rowtype;
  invoice_row missionaccounts.invoice%rowtype;
  customer_row missionaccounts.stripe_customer_private%rowtype;
  method_row missionaccounts.payment_method_private%rowtype;
  charge_row missionaccounts.manual_cycle_charge%rowtype;
  existing_request missionaccounts.manual_cycle_charge%rowtype;
  audit_id uuid;
  rejection_reason text;
  request_fingerprint jsonb;
  existing_rejection jsonb;
begin
  if p_student_id is null
     or p_cycle_key is null or p_cycle_key !~ '^2026-cycle-[123]$'
     or p_expected_decision_id is null
     or p_expected_amount_cents is null or p_expected_amount_cents <= 0
     or p_expected_last4 is null or p_expected_last4 !~ '^\d{4}$'
     or nullif(btrim(p_actor_id), '') is null
     or p_actor_role not in ('missionaccounts_admin','founder')
     or nullif(btrim(p_request_id), '') is null then
    raise exception using errcode = '22023', message = 'invalid_manual_cycle_charge_request';
  end if;

  request_fingerprint := jsonb_build_object(
    'student_id', p_student_id,
    'cycle_key', p_cycle_key,
    'expected_decision_id', p_expected_decision_id,
    'expected_amount_cents', p_expected_amount_cents,
    'expected_last4', p_expected_last4,
    'actor_id', p_actor_id,
    'actor_role', p_actor_role
  );

  select * into existing_request
  from missionaccounts.manual_cycle_charge
  where request_id = p_request_id;
  if found then
    if existing_request.student_id <> p_student_id
       or existing_request.cycle_key <> p_cycle_key
       or existing_request.decision_id <> p_expected_decision_id
       or existing_request.amount_cents <> p_expected_amount_cents
       or existing_request.prepared_by <> p_actor_id
       or existing_request.prepared_role <> p_actor_role then
      raise exception using errcode = '23505', message = 'idempotency_key_reuse';
    end if;
    return jsonb_build_object(
      'accepted', true,
      'duplicate', true,
      'charge', jsonb_build_object(
        'id', existing_request.id,
        'student_id', existing_request.student_id,
        'cycle_key', existing_request.cycle_key,
        'decision_id', existing_request.decision_id,
        'amount_cents', existing_request.amount_cents,
        'state', existing_request.state,
        'idempotency_key', existing_request.idempotency_key
      ),
      'customer_ref', existing_request.provider_customer_ref,
      'payment_method_ref', existing_request.provider_payment_method_ref,
      'receipt_email', lower(btrim((select email from missionaccounts.student where id = existing_request.student_id)))
    );
  end if;

  select to_val into existing_rejection
  from missionaccounts.audit_event
  where request_id = p_request_id and kind = 'manual_cycle_charge.rejected';
  if found then
    if existing_rejection->'request' <> request_fingerprint then
      raise exception using errcode = '23505', message = 'idempotency_key_reuse';
    end if;
    return jsonb_build_object(
      'accepted', false,
      'duplicate', true,
      'reason', existing_rejection->>'reason',
      'audit_event_id', (select id from missionaccounts.audit_event where request_id = p_request_id and kind = 'manual_cycle_charge.rejected')
    );
  end if;

  perform pg_advisory_xact_lock(hashtextextended('missionaccounts:manual-cycle-charge:' || p_student_id::text || ':' || p_cycle_key, 0));

  select * into student_row from missionaccounts.student where id = p_student_id for update;
  if not found then rejection_reason := 'student_not_found';
  elsif student_row.identity_state <> 'verified' or student_row.matrix_user_ref is null then rejection_reason := 'verified_linked_student_required';
  end if;

  if rejection_reason is null then
    select * into decision_row
    from missionaccounts.billing_decision
    where id = p_expected_decision_id
      and student_id = p_student_id
      and cycle_key = p_cycle_key
      and superseded_by_id is null
      and state = 'approved'
    for update;
    if not found then rejection_reason := 'current_approved_decision_required';
    elsif decision_row.amount_cents <> p_expected_amount_cents then rejection_reason := 'approved_amount_changed';
    elsif decision_row.amount_cents <= 0
       or decision_row.treatment in ('ucc','mul','waived','prepaid','already_paid','already_invoiced') then
      rejection_reason := 'collectible_balance_required';
    end if;
  end if;

  if rejection_reason is null then
    select * into charge_row
    from missionaccounts.manual_cycle_charge
    where student_id = p_student_id and cycle_key = p_cycle_key and state in ('pending','succeeded')
    for update;
    if found then rejection_reason := case when charge_row.state = 'succeeded' then 'charge_already_succeeded' else 'charge_already_pending' end; end if;
  end if;

  if rejection_reason is null then
    select * into invoice_row
    from missionaccounts.invoice
    where decision_id = decision_row.id and student_id = p_student_id and cycle_key = p_cycle_key
    order by created_at desc limit 1
    for update;
    if not found or invoice_row.amount_cents <> decision_row.amount_cents
       or invoice_row.state not in ('draft','ready') or invoice_row.provider_ref is not null then
      rejection_reason := 'collectible_invoice_mismatch';
    end if;
  end if;

  if rejection_reason is null then
    select * into customer_row
    from missionaccounts.stripe_customer_private
    where student_id = p_student_id
    for update;
    if not found then rejection_reason := 'stripe_customer_required'; end if;
  end if;

  if rejection_reason is null then
    select * into method_row
    from missionaccounts.payment_method_private
    where student_id = p_student_id
    for update;
    if not found or method_row.status <> 'on_file' then rejection_reason := 'payment_method_required';
    elsif method_row.provider_customer_ref <> customer_row.provider_customer_ref then rejection_reason := 'stripe_customer_payment_method_mismatch';
    elsif method_row.last4 is distinct from p_expected_last4 then rejection_reason := 'payment_method_changed';
    end if;
  end if;

  if rejection_reason is null and (
    nullif(btrim(student_row.email), '') is null
    or lower(btrim(student_row.email)) !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  ) then rejection_reason := 'student_receipt_email_required'; end if;

  if rejection_reason is not null then
    insert into missionaccounts.audit_event(
      actor_id, actor_role, subject_student_id, kind, text, to_val, reason, request_id
    ) values (
      p_actor_id, p_actor_role, p_student_id, 'manual_cycle_charge.rejected',
      'Manual cycle charge rejected by server authority',
      jsonb_build_object('request', request_fingerprint, 'reason', rejection_reason),
      rejection_reason, p_request_id
    ) returning id into audit_id;
    return jsonb_build_object('accepted', false, 'duplicate', false, 'reason', rejection_reason, 'audit_event_id', audit_id);
  end if;

  insert into missionaccounts.manual_cycle_charge(
    student_id, cycle_key, decision_id, invoice_id, amount_cents,
    provider_customer_ref, provider_payment_method_ref, state,
    idempotency_key, request_id, prepared_by, prepared_role
  ) values (
    p_student_id, p_cycle_key, decision_row.id, invoice_row.id, decision_row.amount_cents,
    customer_row.provider_customer_ref, method_row.provider_pm_ref, 'pending',
    'missionaccounts:manual-cycle:' || decision_row.id::text || ':v1',
    p_request_id, p_actor_id, p_actor_role
  ) returning * into charge_row;

  insert into missionaccounts.audit_event(
    actor_id, actor_role, subject_student_id, kind, text, to_val, reason, request_id
  ) values (
    p_actor_id, p_actor_role, p_student_id, 'manual_cycle_charge.started',
    'Authorized one explicit Stripe charge for the current approved cycle balance',
    jsonb_build_object(
      'charge_id', charge_row.id,
      'cycle_key', charge_row.cycle_key,
      'decision_id', charge_row.decision_id,
      'invoice_id', charge_row.invoice_id,
      'amount_cents', charge_row.amount_cents,
      'state', charge_row.state,
      'card_last4', method_row.last4
    ),
    'explicit_admin_confirmation', p_request_id
  ) returning id into audit_id;

  return jsonb_build_object(
    'accepted', true,
    'duplicate', false,
    'audit_event_id', audit_id,
    'charge', jsonb_build_object(
      'id', charge_row.id,
      'student_id', charge_row.student_id,
      'cycle_key', charge_row.cycle_key,
      'decision_id', charge_row.decision_id,
      'amount_cents', charge_row.amount_cents,
      'state', charge_row.state,
      'idempotency_key', charge_row.idempotency_key
    ),
    'customer_ref', charge_row.provider_customer_ref,
    'payment_method_ref', charge_row.provider_payment_method_ref,
    'receipt_email', lower(btrim(student_row.email))
  );
end;
$$;

revoke execute on function missionaccounts.api_prepare_manual_cycle_charge(uuid,text,uuid,integer,text,text,text,text)
from public, anon, authenticated;
grant execute on function missionaccounts.api_prepare_manual_cycle_charge(uuid,text,uuid,integer,text,text,text,text)
to service_role;

create function missionaccounts.api_process_stripe_manual_cycle_payment_intent(
  p_provider_event_id text,
  p_event_type text,
  p_payment_intent_ref text,
  p_manual_cycle_charge_id uuid,
  p_student_id uuid,
  p_cycle_key text,
  p_decision_id uuid,
  p_amount_cents integer,
  p_failure_code text default null,
  p_failure_message text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, missionaccounts
as $$
declare
  event_row missionaccounts.provider_event_inbox%rowtype;
  charge_row missionaccounts.manual_cycle_charge%rowtype;
  invoice_row missionaccounts.invoice%rowtype;
  audit_id uuid;
  next_state text;
begin
  if p_event_type not in ('payment_intent.succeeded','payment_intent.payment_failed')
     or p_payment_intent_ref !~ '^pi_[A-Za-z0-9_]+$'
     or p_manual_cycle_charge_id is null or p_student_id is null or p_decision_id is null
     or p_cycle_key is null or p_cycle_key !~ '^2026-cycle-[123]$'
     or p_amount_cents is null or p_amount_cents <= 0 then
    raise exception using errcode = '22023', message = 'invalid_manual_cycle_payment_intent_event';
  end if;

  select * into event_row
  from missionaccounts.provider_event_inbox
  where provider = 'stripe' and provider_event_id = p_provider_event_id
  for update;
  if not found then raise exception using errcode = '23503', message = 'stripe_event_not_found'; end if;

  select * into charge_row
  from missionaccounts.manual_cycle_charge
  where id = p_manual_cycle_charge_id
  for update;
  if not found then raise exception using errcode = '23503', message = 'manual_cycle_charge_not_found'; end if;

  if event_row.state = 'processed' then
    return jsonb_build_object('accepted', true, 'duplicate', true, 'charge', to_jsonb(charge_row) - 'provider_customer_ref' - 'provider_payment_method_ref');
  end if;

  if event_row.signature_verified is not true
     or event_row.event_type <> p_event_type
     or event_row.provider_object_id is distinct from p_payment_intent_ref
     or event_row.payload #>> '{data,object,id}' is distinct from p_payment_intent_ref
     or event_row.payload #>> '{data,object,metadata,kind}' is distinct from 'manual_cycle_charge'
     or event_row.payload #>> '{data,object,metadata,manual_cycle_charge_id}' is distinct from p_manual_cycle_charge_id::text
     or event_row.payload #>> '{data,object,metadata,student_id}' is distinct from p_student_id::text
     or event_row.payload #>> '{data,object,metadata,cycle_key}' is distinct from p_cycle_key
     or event_row.payload #>> '{data,object,metadata,billing_decision_id}' is distinct from p_decision_id::text
     or event_row.payload #>> '{data,object,metadata,amount_cents}' is distinct from p_amount_cents::text
     or event_row.payload #>> '{data,object,currency}' is distinct from 'usd'
     or (event_row.payload #>> '{data,object,amount}')::integer <> p_amount_cents
     or charge_row.student_id <> p_student_id
     or charge_row.cycle_key <> p_cycle_key
     or charge_row.decision_id <> p_decision_id
     or charge_row.amount_cents <> p_amount_cents
     or event_row.payload #>> '{data,object,customer}' is distinct from charge_row.provider_customer_ref
     or event_row.payload #>> '{data,object,payment_method}' is distinct from charge_row.provider_payment_method_ref
     or (charge_row.provider_ref is not null and charge_row.provider_ref <> p_payment_intent_ref) then
    raise exception using errcode = '22023', message = 'stripe_manual_cycle_charge_event_binding_mismatch';
  end if;

  if p_event_type = 'payment_intent.succeeded'
     and ((event_row.payload #>> '{data,object,amount_received}')::integer <> p_amount_cents
       or event_row.payload #>> '{data,object,status}' is distinct from 'succeeded') then
    raise exception using errcode = '22023', message = 'stripe_manual_cycle_charge_amount_mismatch';
  end if;

  next_state := case when p_event_type = 'payment_intent.succeeded' then 'succeeded' else 'failed' end;
  update missionaccounts.manual_cycle_charge
  set provider_ref = p_payment_intent_ref,
      state = next_state,
      failure_code = case when next_state = 'failed' then nullif(p_failure_code, '') else null end,
      failure_message = case when next_state = 'failed' then left(nullif(p_failure_message, ''), 2000) else null end,
      succeeded_at = case when next_state = 'succeeded' then coalesce(succeeded_at, now()) else null end,
      updated_at = now()
  where id = charge_row.id
  returning * into charge_row;

  select * into invoice_row from missionaccounts.invoice where id = charge_row.invoice_id for update;
  if not found or invoice_row.student_id <> charge_row.student_id
     or invoice_row.cycle_key <> charge_row.cycle_key
     or invoice_row.decision_id <> charge_row.decision_id
     or invoice_row.amount_cents <> charge_row.amount_cents then
    raise exception using errcode = '22023', message = 'manual_cycle_charge_invoice_binding_mismatch';
  end if;
  if next_state = 'succeeded' then
    if invoice_row.state not in ('draft','ready','paid') then
      raise exception using errcode = '22023', message = 'manual_cycle_charge_invoice_state_mismatch';
    end if;
    update missionaccounts.invoice
    set state = 'paid', provider_status = 'paid', paid_at = coalesce(paid_at, now()), last_provider_event_at = now()
    where id = invoice_row.id;
  end if;

  insert into missionaccounts.audit_event(
    actor_id, actor_role, subject_student_id, kind, text, to_val, reason, request_id
  ) values (
    'stripe:' || p_provider_event_id, 'provider', p_student_id,
    case when next_state = 'succeeded' then 'manual_cycle_charge.succeeded' else 'manual_cycle_charge.failed' end,
    case when next_state = 'succeeded' then 'Stripe confirmed the explicit approved cycle charge' else 'Stripe reported an explicit cycle charge failure' end,
    jsonb_build_object(
      'charge_id', charge_row.id,
      'cycle_key', charge_row.cycle_key,
      'decision_id', charge_row.decision_id,
      'invoice_id', charge_row.invoice_id,
      'amount_cents', charge_row.amount_cents,
      'state', charge_row.state,
      'payment_intent_id', p_payment_intent_ref
    ),
    case when next_state = 'succeeded' then 'payment_intent.succeeded' else coalesce(nullif(p_failure_code, ''), 'payment_intent.payment_failed') end,
    'stripe:' || p_provider_event_id || ':manual-cycle-charge'
  ) returning id into audit_id;

  update missionaccounts.provider_event_inbox
  set state = 'processed', processed_at = now()
  where id = event_row.id;

  return jsonb_build_object(
    'accepted', true,
    'duplicate', false,
    'audit_event_id', audit_id,
    'charge', to_jsonb(charge_row) - 'provider_customer_ref' - 'provider_payment_method_ref'
  );
end;
$$;

revoke execute on function missionaccounts.api_process_stripe_manual_cycle_payment_intent(text,text,text,uuid,uuid,text,uuid,integer,text,text)
from public, anon, authenticated;
grant execute on function missionaccounts.api_process_stripe_manual_cycle_payment_intent(text,text,text,uuid,uuid,text,uuid,integer,text,text)
to service_role;

comment on table missionaccounts.manual_cycle_charge is
  'Private server-owned records for explicit per-cycle Stripe charges. Automatic attendance-day charging remains separate.';
