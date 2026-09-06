-- MX-MISSIONACCOUNTS-5301P: bounded, fail-closed automatic charge dispatch.
-- The application worker invokes these service-role-only RPCs after asserting
-- that Stripe Test Mode is configured. Nothing in this migration schedules or
-- enables the worker in production.

create table missionaccounts.integration_exception (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('stripe','zoom','notification')),
  kind text not null,
  student_id uuid references missionaccounts.student(id),
  attendance_day_id uuid references missionaccounts.attendance_day(id),
  state text not null default 'open' check (state in ('open','resolved','ignored')),
  details jsonb not null default '{}'::jsonb,
  idempotency_key text not null unique,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index integration_exception_open_idx
  on missionaccounts.integration_exception(provider, kind, created_at)
  where state = 'open';

create table missionaccounts.auto_charge_dispatch (
  id uuid primary key default gen_random_uuid(),
  attendance_day_id uuid not null unique references missionaccounts.attendance_day(id),
  state text not null default 'eligible' check (state in ('eligible','claimed','submitted','failed','expired')),
  idempotency_key text not null unique,
  worker_id text,
  locked_at timestamptz,
  submitted_at timestamptz,
  provider_ref text unique,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index auto_charge_dispatch_state_idx
  on missionaccounts.auto_charge_dispatch(state, locked_at, created_at);

create function missionaccounts.api_claim_due_day_charges(
  p_now timestamptz,
  p_worker_id text,
  p_limit integer default 10
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, missionaccounts
as $$
declare
  candidate record;
  prepared jsonb;
  claimed_items jsonb := '[]'::jsonb;
  expired_count integer := 0;
begin
  if p_now is null
     or nullif(btrim(p_worker_id), '') is null
     or p_limit < 1 or p_limit > 25 then
    raise exception using errcode = '22023', message = 'invalid_auto_charge_claim';
  end if;

  -- A day outside the contractual 24-48 hour window is never silently charged.
  with expired as (
    select d.id
    from missionaccounts.auto_charge_dispatch d
    join missionaccounts.attendance_day ad on ad.id = d.attendance_day_id
    where d.state in ('eligible','claimed')
      and ad.computed_at < p_now - interval '48 hours'
    for update of d skip locked
  )
  update missionaccounts.auto_charge_dispatch d
  set state = 'expired', worker_id = null, locked_at = null,
      last_error = 'automatic_charge_window_missed', updated_at = p_now
  from expired e where d.id = e.id;

  insert into missionaccounts.integration_exception(
    provider, kind, student_id, attendance_day_id, details, idempotency_key
  )
  select
    'stripe', 'automatic_charge_window_missed', ad.student_id, ad.id,
    jsonb_build_object(
      'cycle_key', ad.cycle_key,
      'day', ad.day,
      'computed_at', ad.computed_at,
      'window_ended_at', ad.computed_at + interval '48 hours'
    ),
    'missionaccounts:auto-charge-window:' || ad.id::text || ':v1'
  from missionaccounts.attendance_day ad
  join missionaccounts.student s on s.id = ad.student_id and s.identity_state = 'verified'
  join missionaccounts.billing_decision bd
    on bd.student_id = ad.student_id and bd.cycle_key = ad.cycle_key
   and bd.superseded_by_id is null and bd.state = 'approved' and bd.treatment = 'confirm'
  join missionaccounts.payment_method_private pm
    on pm.student_id = ad.student_id and pm.status = 'on_file'
  join missionaccounts.billing_consent bc
    on bc.student_id = ad.student_id and bc.superseded_by_id is null and bc.state = 'authorized'
  where ad.superseded_at is null
    and ad.kind = 'billable'
    and ad.computed_at < p_now - interval '48 hours'
    and exists (
      select 1 from missionaccounts.rule_decision rd
      where rd.rule = 'one_charge_per_calendar_day'
        and rd.superseded_by_id is null and rd.effective_from <= ad.day
    )
    and exists (
      select 1
      from jsonb_array_elements(coalesce(bd.basis->'days', '[]'::jsonb)) approved_day
      where approved_day->>'id' = ad.id::text and approved_day->>'kind' = 'billable'
    )
    and not exists (
      select 1 from missionaccounts.charge c
      where c.attendance_day_id = ad.id and c.state in ('succeeded','failed','refunded')
    )
    and not exists (
      select 1 from missionaccounts.auto_charge_dispatch d
      where d.attendance_day_id = ad.id and d.state = 'submitted'
    )
  on conflict (idempotency_key) do nothing;
  get diagnostics expired_count = row_count;

  insert into missionaccounts.auto_charge_dispatch(attendance_day_id, idempotency_key)
  select ad.id, 'missionaccounts:auto-charge:' || ad.id::text || ':v1'
  from missionaccounts.attendance_day ad
  join missionaccounts.student s on s.id = ad.student_id and s.identity_state = 'verified'
  join missionaccounts.billing_decision bd
    on bd.student_id = ad.student_id and bd.cycle_key = ad.cycle_key
   and bd.superseded_by_id is null and bd.state = 'approved' and bd.treatment = 'confirm'
  join missionaccounts.payment_method_private pm
    on pm.student_id = ad.student_id and pm.status = 'on_file'
  join missionaccounts.billing_consent bc
    on bc.student_id = ad.student_id and bc.superseded_by_id is null and bc.state = 'authorized'
  where ad.superseded_at is null
    and ad.kind = 'billable'
    and ad.computed_at <= p_now - interval '24 hours'
    and ad.computed_at >= p_now - interval '48 hours'
    and exists (
      select 1 from missionaccounts.rule_decision rd
      where rd.rule = 'one_charge_per_calendar_day'
        and rd.superseded_by_id is null and rd.effective_from <= ad.day
    )
    and exists (
      select 1
      from jsonb_array_elements(coalesce(bd.basis->'days', '[]'::jsonb)) approved_day
      where approved_day->>'id' = ad.id::text and approved_day->>'kind' = 'billable'
    )
    and not exists (
      select 1 from missionaccounts.charge c
      where c.attendance_day_id = ad.id and c.state <> 'failed'
    )
  on conflict (attendance_day_id) do nothing;

  for candidate in
    select d.id, d.attendance_day_id, d.idempotency_key
    from missionaccounts.auto_charge_dispatch d
    join missionaccounts.attendance_day ad on ad.id = d.attendance_day_id
    where (
      d.state = 'eligible'
      or (d.state = 'claimed' and d.locked_at < p_now - interval '10 minutes')
    )
      and ad.superseded_at is null
      and ad.computed_at <= p_now - interval '24 hours'
      and ad.computed_at >= p_now - interval '48 hours'
    order by ad.computed_at, d.created_at, d.id
    for update of d skip locked
    limit p_limit
  loop
    update missionaccounts.auto_charge_dispatch
    set state = 'claimed', worker_id = p_worker_id, locked_at = p_now,
        attempt_count = attempt_count + 1, last_error = null, updated_at = p_now
    where id = candidate.id;

    prepared := missionaccounts.api_prepare_day_charge(
      candidate.attendance_day_id,
      'missionaccounts:auto-charge',
      'service',
      candidate.idempotency_key,
      false
    );

    if coalesce((prepared->>'accepted')::boolean, false) then
      claimed_items := claimed_items || jsonb_build_array(jsonb_build_object(
        'dispatch_id', candidate.id,
        'attendance_day_id', candidate.attendance_day_id,
        'customer_ref', prepared->>'customer_ref',
        'payment_method_ref', prepared->>'payment_method_ref',
        'charge', prepared->'charge'
      ));
    else
      update missionaccounts.auto_charge_dispatch
      set state = 'failed', worker_id = null, locked_at = null,
          last_error = coalesce(prepared->>'reason', 'charge_preparation_rejected'), updated_at = p_now
      where id = candidate.id;
    end if;
  end loop;

  return jsonb_build_object('claimed', claimed_items, 'expired', expired_count, 'now', p_now);
end;
$$;

revoke execute on function missionaccounts.api_claim_due_day_charges(timestamptz, text, integer)
from public, anon, authenticated;
grant execute on function missionaccounts.api_claim_due_day_charges(timestamptz, text, integer)
to service_role;

create function missionaccounts.api_finish_auto_charge_dispatch(
  p_dispatch_id uuid,
  p_worker_id text,
  p_succeeded boolean,
  p_provider_ref text default null,
  p_error text default null,
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, missionaccounts
as $$
declare
  dispatch_row missionaccounts.auto_charge_dispatch%rowtype;
  charge_row missionaccounts.charge%rowtype;
  day_row missionaccounts.attendance_day%rowtype;
  audit_id uuid;
begin
  if p_dispatch_id is null or nullif(btrim(p_worker_id), '') is null or p_now is null then
    raise exception using errcode = '22023', message = 'invalid_auto_charge_finish';
  end if;

  select * into dispatch_row
  from missionaccounts.auto_charge_dispatch
  where id = p_dispatch_id
  for update;
  if not found then raise exception using errcode = '23503', message = 'auto_charge_dispatch_not_found'; end if;

  if dispatch_row.state = 'submitted' and p_succeeded
     and dispatch_row.provider_ref is not distinct from p_provider_ref then
    return jsonb_build_object('accepted', true, 'duplicate', true, 'dispatch', to_jsonb(dispatch_row));
  end if;
  if dispatch_row.state <> 'claimed' or dispatch_row.worker_id is distinct from p_worker_id then
    raise exception using errcode = '22023', message = 'auto_charge_claim_mismatch';
  end if;
  if p_succeeded and coalesce(p_provider_ref, '') !~ '^pi_[A-Za-z0-9_]+$' then
    raise exception using errcode = '22023', message = 'auto_charge_provider_ref_required';
  end if;
  if not p_succeeded and nullif(btrim(p_error), '') is null then
    raise exception using errcode = '22023', message = 'auto_charge_error_required';
  end if;

  select * into charge_row
  from missionaccounts.charge
  where attendance_day_id = dispatch_row.attendance_day_id
  for update;
  if not found then raise exception using errcode = '23503', message = 'auto_charge_not_found'; end if;
  select * into day_row from missionaccounts.attendance_day where id = dispatch_row.attendance_day_id;

  if p_succeeded then
    update missionaccounts.auto_charge_dispatch
    set state = 'submitted', provider_ref = p_provider_ref, submitted_at = p_now,
        worker_id = null, locked_at = null, last_error = null, updated_at = p_now
    where id = dispatch_row.id returning * into dispatch_row;
    update missionaccounts.charge
    set provider_ref = p_provider_ref, updated_at = p_now
    where id = charge_row.id returning * into charge_row;
  else
    update missionaccounts.auto_charge_dispatch
    set state = 'failed', worker_id = null, locked_at = null,
        last_error = left(p_error, 2000), updated_at = p_now
    where id = dispatch_row.id returning * into dispatch_row;
    update missionaccounts.charge
    set state = 'failed', updated_at = p_now
    where id = charge_row.id returning * into charge_row;
    update missionaccounts.charge_attempt
    set state = 'failed', error_code = 'stripe_submission_failed', error_message = left(p_error, 2000)
    where id = (
      select id from missionaccounts.charge_attempt
      where charge_id = charge_row.id and state = 'started'
      order by attempted_at desc limit 1
    );
    insert into missionaccounts.integration_exception(
      provider, kind, student_id, attendance_day_id, details, idempotency_key
    ) values (
      'stripe', 'automatic_charge_submission_failed', charge_row.student_id,
      charge_row.attendance_day_id,
      jsonb_build_object('charge_id', charge_row.id, 'error', left(p_error, 2000)),
      dispatch_row.idempotency_key || ':submission-failed'
    ) on conflict (idempotency_key) do nothing;
    insert into missionaccounts.notification_outbox(
      student_id, channel, audience, event_kind, payload, state, idempotency_key
    ) values (
      charge_row.student_id, 'matrix', 'student', 'charge.failed',
      jsonb_build_object('attendance_day_id', charge_row.attendance_day_id, 'amount_cents', charge_row.amount_cents, 'state', 'failed'),
      'pending', dispatch_row.idempotency_key || ':charge-failed-student'
    ) on conflict (idempotency_key) do nothing;
    insert into missionaccounts.notification_outbox(
      student_id, channel, audience, event_kind, payload, state, idempotency_key
    ) values (
      charge_row.student_id, 'matrix', 'missionaccounts_admin', 'charge.failed',
      jsonb_build_object('attendance_day_id', charge_row.attendance_day_id, 'amount_cents', charge_row.amount_cents, 'state', 'failed'),
      'pending', dispatch_row.idempotency_key || ':charge-failed-admin'
    ) on conflict (idempotency_key) do nothing;
  end if;

  insert into missionaccounts.audit_event(
    actor_id, actor_role, subject_student_id, kind, text, to_val, reason, request_id
  ) values (
    p_worker_id, 'system', charge_row.student_id,
    case when p_succeeded then 'auto_charge.submitted' else 'auto_charge.failed' end,
    case when p_succeeded then 'Automatic attendance-day charge submitted to Stripe' else 'Automatic attendance-day charge submission failed' end,
    jsonb_build_object(
      'dispatch_id', dispatch_row.id, 'charge_id', charge_row.id,
      'attendance_day_id', charge_row.attendance_day_id, 'day', day_row.day,
      'amount_cents', charge_row.amount_cents, 'state', dispatch_row.state,
      'provider_ref', dispatch_row.provider_ref
    ),
    case when p_succeeded then 'stripe_payment_intent_submitted' else left(p_error, 2000) end,
    dispatch_row.idempotency_key || ':finish'
  ) returning id into audit_id;

  return jsonb_build_object(
    'accepted', true, 'duplicate', false, 'audit_event_id', audit_id,
    'dispatch', to_jsonb(dispatch_row), 'charge', to_jsonb(charge_row)
  );
end;
$$;

revoke execute on function missionaccounts.api_finish_auto_charge_dispatch(uuid, text, boolean, text, text, timestamptz)
from public, anon, authenticated;
grant execute on function missionaccounts.api_finish_auto_charge_dispatch(uuid, text, boolean, text, text, timestamptz)
to service_role;

alter table missionaccounts.integration_exception enable row level security;
alter table missionaccounts.integration_exception force row level security;
alter table missionaccounts.auto_charge_dispatch enable row level security;
alter table missionaccounts.auto_charge_dispatch force row level security;
revoke all on missionaccounts.integration_exception, missionaccounts.auto_charge_dispatch from public, anon, authenticated;
grant all on missionaccounts.integration_exception, missionaccounts.auto_charge_dispatch to service_role;

comment on table missionaccounts.auto_charge_dispatch is
  'Service-only 24-48 hour attendance-day charge dispatcher; failed or expired rows require explicit human action.';
comment on table missionaccounts.integration_exception is
  'Durable provider exception queue. It is not exposed to student or anonymous clients.';
