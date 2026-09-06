-- MX-MISSIONACCOUNTS-5301P: real Stripe-hosted invoice workflow.
-- Internal invoice approval remains separate from provider creation. Provider
-- calls are prepared and finalized through idempotent service-role RPCs, and
-- signed Stripe webhooks remain authoritative for later state changes.

alter table missionaccounts.invoice
  drop constraint invoice_state_check,
  add constraint invoice_state_check
    check (state in ('draft','ready','sent','paid','overdue','void','failed')),
  add column provider_status text,
  add column hosted_invoice_url text,
  add column invoice_pdf text,
  add column due_at timestamptz,
  add column last_provider_event_at timestamptz,
  add constraint invoice_provider_ref_format
    check (provider_ref is null or provider_ref ~ '^in_[A-Za-z0-9_]+$'),
  add constraint invoice_hosted_url_format
    check (
      hosted_invoice_url is null
      or hosted_invoice_url ~ '^https://invoice[.]stripe[.]com/'
    ),
  add constraint invoice_pdf_url_format
    check (
      invoice_pdf is null
      or invoice_pdf ~ '^https://(invoice|pay)[.]stripe[.]com/'
    );

insert into missionaccounts.feature_flag(key, enabled)
values ('hosted_invoices', false)
on conflict (key) do nothing;

create unique index invoice_provider_ref_unique
  on missionaccounts.invoice(provider_ref)
  where provider_ref is not null;

-- Any provider-backed invoice is financial finality evidence. The historical
-- adjudication RPCs already block sent/paid invoices; these triggers also block
-- newer provider lifecycle states and close the race at the decision tables.
create function missionaccounts.guard_identity_decision_against_provider_invoice()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, missionaccounts
as $$
begin
  if (new.decision = 'same'
      or exists (
        select 1 from missionaccounts.identity_decision prior
        where prior.id = new.superseded_by_id and prior.decision = 'same'
      ))
     and exists (
       select 1 from missionaccounts.invoice invoice
       where invoice.student_id = any(new.member_student_ids)
         and (invoice.provider_ref is not null
           or invoice.state in ('sent','paid','overdue','void','failed'))
     ) then
    raise exception using errcode = '23514', message = 'identity_transition_requires_provider_invoice_review';
  end if;
  return new;
end;
$$;

create trigger identity_decision_provider_invoice_guard
before insert or update on missionaccounts.identity_decision
for each row execute function missionaccounts.guard_identity_decision_against_provider_invoice();

create function missionaccounts.guard_device_identity_decision_against_provider_invoice()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, missionaccounts
as $$
declare
  affected_student_ids uuid[];
begin
  affected_student_ids := array_remove(array[new.source_student_id, new.target_student_id], null);
  if new.decision <> 'unsure'
     and exists (
       select 1 from missionaccounts.invoice invoice
       where invoice.student_id = any(affected_student_ids)
         and (invoice.provider_ref is not null
           or invoice.state in ('sent','paid','overdue','void','failed'))
     ) then
    raise exception using errcode = '23514', message = 'device_identity_transition_requires_provider_invoice_review';
  end if;
  return new;
end;
$$;

create trigger device_identity_decision_provider_invoice_guard
before insert or update on missionaccounts.device_identity_decision
for each row execute function missionaccounts.guard_device_identity_decision_against_provider_invoice();

revoke execute on function missionaccounts.guard_identity_decision_against_provider_invoice()
from public, anon, authenticated;
revoke execute on function missionaccounts.guard_device_identity_decision_against_provider_invoice()
from public, anon, authenticated;
grant execute on function missionaccounts.guard_identity_decision_against_provider_invoice()
to service_role;
grant execute on function missionaccounts.guard_device_identity_decision_against_provider_invoice()
to service_role;

create table missionaccounts.stripe_invoice_dispatch (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references missionaccounts.invoice(id),
  action text not null check (action in ('send','resend','void')),
  request_id text not null unique,
  request_controls jsonb not null,
  state text not null check (state in ('prepared','submitted','failed')),
  provider_invoice_ref text,
  result_controls jsonb not null default '{}'::jsonb,
  last_error text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  check (provider_invoice_ref is null or provider_invoice_ref ~ '^in_[A-Za-z0-9_]+$')
);

alter table missionaccounts.stripe_invoice_dispatch enable row level security;
alter table missionaccounts.stripe_invoice_dispatch force row level security;
revoke all on table missionaccounts.stripe_invoice_dispatch from public, anon, authenticated;
grant select, insert, update on table missionaccounts.stripe_invoice_dispatch to service_role;

create function missionaccounts.api_prepare_hosted_invoice_dispatch(
  p_invoice_id uuid,
  p_action text,
  p_due_days integer,
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
  invoice_row missionaccounts.invoice%rowtype;
  decision_row missionaccounts.billing_decision%rowtype;
  student_row missionaccounts.student%rowtype;
  customer_row missionaccounts.stripe_customer_private%rowtype;
  dispatch_row missionaccounts.stripe_invoice_dispatch%rowtype;
  controls jsonb;
  rejection_reason text;
begin
  if p_actor_role not in ('missionaccounts_admin','founder') then
    raise exception using errcode = '42501', message = 'hosted_invoice_admin_required';
  end if;
  if p_invoice_id is null
     or p_action not in ('send','resend','void')
     or nullif(btrim(p_actor_id), '') is null
     or nullif(btrim(p_request_id), '') is null
     or (p_action = 'send' and (p_due_days is null or p_due_days not between 1 and 90))
     or (p_action <> 'send' and p_due_days is not null) then
    raise exception using errcode = '22023', message = 'invalid_hosted_invoice_dispatch';
  end if;

  controls := jsonb_build_object(
    'invoice_id', p_invoice_id,
    'action', p_action,
    'due_days', p_due_days,
    'actor_id', p_actor_id,
    'actor_role', p_actor_role
  );
  perform pg_advisory_xact_lock(hashtextextended(
    'missionaccounts:hosted-invoice:request:' || p_request_id,
    0
  ));
  select * into dispatch_row
  from missionaccounts.stripe_invoice_dispatch
  where request_id = p_request_id;
  if found then
    if dispatch_row.request_controls <> controls then
      raise exception using errcode = '23505', message = 'idempotency_key_reuse';
    end if;
    select * into invoice_row from missionaccounts.invoice where id = p_invoice_id;
    return jsonb_build_object(
      'accepted', dispatch_row.state <> 'failed',
      'duplicate', true,
      'dispatch', to_jsonb(dispatch_row) - 'request_controls' - 'last_error',
      'invoice', to_jsonb(invoice_row) - 'lines',
      'provider_invoice_ref', invoice_row.provider_ref,
      'safe_result', case when dispatch_row.state = 'submitted'
        then dispatch_row.result_controls else null end
    );
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    'missionaccounts:hosted-invoice:' || p_invoice_id::text,
    0
  ));
  select * into invoice_row
  from missionaccounts.invoice
  where id = p_invoice_id
  for update;
  if not found then raise exception using errcode = '23503', message = 'invoice_not_found'; end if;
  select * into decision_row from missionaccounts.billing_decision where id = invoice_row.decision_id;
  select * into student_row from missionaccounts.student where id = invoice_row.student_id;
  select * into customer_row from missionaccounts.stripe_customer_private where student_id = invoice_row.student_id;

  if p_action = 'send' and invoice_row.state not in ('ready','failed') then
    rejection_reason := 'invoice_not_ready';
  elsif p_action = 'send' and invoice_row.provider_ref is not null then
    rejection_reason := 'provider_invoice_already_exists';
  elsif p_action = 'send' and (
    decision_row.id is null or decision_row.state <> 'approved'
    or decision_row.superseded_by_id is not null
    or decision_row.student_id <> invoice_row.student_id
    or decision_row.cycle_key <> invoice_row.cycle_key
    or decision_row.amount_cents <> invoice_row.amount_cents
    or invoice_row.amount_cents <= 0
  ) then
    rejection_reason := 'current_approved_decision_required';
  elsif p_action = 'send' and student_row.identity_state <> 'verified' then
    rejection_reason := 'verified_student_identity_required';
  elsif p_action = 'send' and coalesce(student_row.email, '') !~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then
    rejection_reason := 'student_email_required';
  elsif p_action = 'send' and customer_row.provider_customer_ref is null then
    rejection_reason := 'stripe_customer_required';
  elsif p_action in ('resend','void') and (
    invoice_row.provider_ref is null
    or invoice_row.state not in ('sent','overdue','failed')
  ) then
    rejection_reason := 'provider_invoice_not_actionable';
  end if;

  if rejection_reason is not null then
    return jsonb_build_object(
      'accepted', false,
      'duplicate', false,
      'reason', rejection_reason,
      'invoice', to_jsonb(invoice_row) - 'lines'
    );
  end if;

  insert into missionaccounts.stripe_invoice_dispatch(
    invoice_id, action, request_id, request_controls, state, provider_invoice_ref
  ) values (
    p_invoice_id, p_action, p_request_id, controls, 'prepared', invoice_row.provider_ref
  ) returning * into dispatch_row;

  return jsonb_build_object(
    'accepted', true,
    'duplicate', false,
    'dispatch', to_jsonb(dispatch_row) - 'request_controls' - 'last_error',
    'invoice', to_jsonb(invoice_row) - 'lines',
    'customer_ref', customer_row.provider_customer_ref,
    'provider_invoice_ref', invoice_row.provider_ref,
    'description', 'Dr J Drills - ' || invoice_row.cycle_key
  );
end;
$$;

create function missionaccounts.api_finish_hosted_invoice_dispatch(
  p_dispatch_id uuid,
  p_action text,
  p_succeeded boolean,
  p_provider_invoice_ref text,
  p_provider_status text,
  p_hosted_invoice_url text,
  p_invoice_pdf text,
  p_due_at timestamptz,
  p_error text
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, missionaccounts
as $$
declare
  dispatch_row missionaccounts.stripe_invoice_dispatch%rowtype;
  invoice_row missionaccounts.invoice%rowtype;
  result_value jsonb;
  next_state text;
begin
  if p_dispatch_id is null or p_action not in ('send','resend','void') or p_succeeded is null then
    raise exception using errcode = '22023', message = 'invalid_hosted_invoice_completion';
  end if;
  select * into dispatch_row
  from missionaccounts.stripe_invoice_dispatch
  where id = p_dispatch_id
  for update;
  if not found or dispatch_row.action <> p_action then
    raise exception using errcode = '23503', message = 'hosted_invoice_dispatch_not_found';
  end if;
  select * into invoice_row from missionaccounts.invoice where id = dispatch_row.invoice_id for update;
  if dispatch_row.state = 'submitted' then
    return dispatch_row.result_controls || jsonb_build_object('accepted', true, 'duplicate', true);
  end if;
  if dispatch_row.state <> 'prepared' then
    return jsonb_build_object('accepted', false, 'duplicate', true, 'invoice', to_jsonb(invoice_row) - 'lines');
  end if;

  if not p_succeeded then
    update missionaccounts.stripe_invoice_dispatch
    set state = 'failed', last_error = left(coalesce(p_error, 'Stripe hosted invoice request failed'), 2000), finished_at = now()
    where id = p_dispatch_id;
    if p_action = 'send' and invoice_row.provider_ref is null then
      update missionaccounts.invoice set state = 'failed' where id = invoice_row.id returning * into invoice_row;
    end if;
    insert into missionaccounts.integration_exception(provider, kind, student_id, details, state, idempotency_key)
    values (
      'stripe','hosted_invoice_dispatch_failed',invoice_row.student_id,
      jsonb_build_object('invoice_id',invoice_row.id,'action',p_action,'error',left(coalesce(p_error,''),2000)),
      'open','missionaccounts:hosted-invoice-dispatch-failed:' || p_dispatch_id::text
    ) on conflict (idempotency_key) do nothing;
    return jsonb_build_object('accepted', false, 'duplicate', false, 'invoice', to_jsonb(invoice_row) - 'lines');
  end if;

  if p_provider_invoice_ref !~ '^in_[A-Za-z0-9_]+$'
     or p_provider_status not in ('draft','open','paid','void','uncollectible')
     or (invoice_row.provider_ref is not null and invoice_row.provider_ref <> p_provider_invoice_ref)
     or (p_hosted_invoice_url is not null and p_hosted_invoice_url !~ '^https://invoice[.]stripe[.]com/')
     or (p_invoice_pdf is not null and p_invoice_pdf !~ '^https://(invoice|pay)[.]stripe[.]com/') then
    raise exception using errcode = '22023', message = 'hosted_invoice_provider_controls_invalid';
  end if;
  if p_action = 'send' and (p_provider_status not in ('open','paid') or p_hosted_invoice_url is null) then
    raise exception using errcode = '22023', message = 'hosted_invoice_send_incomplete';
  end if;

  next_state := case
    when p_action = 'void' or p_provider_status = 'void' then 'void'
    when p_provider_status = 'paid' then 'paid'
    else 'sent'
  end;
  update missionaccounts.invoice
  set state = next_state,
      provider_ref = p_provider_invoice_ref,
      provider_status = p_provider_status,
      hosted_invoice_url = coalesce(p_hosted_invoice_url, hosted_invoice_url),
      invoice_pdf = coalesce(p_invoice_pdf, invoice_pdf),
      due_at = coalesce(p_due_at, due_at),
      sent_at = case when next_state in ('sent','paid') then coalesce(sent_at, now()) else sent_at end,
      paid_at = case when next_state = 'paid' then coalesce(paid_at, now()) else paid_at end,
      last_provider_event_at = now()
  where id = invoice_row.id
  returning * into invoice_row;

  result_value := jsonb_build_object(
    'accepted', true,
    'duplicate', false,
    'invoice', to_jsonb(invoice_row) - 'lines',
    'dispatch', jsonb_build_object('id',dispatch_row.id,'action',dispatch_row.action,'state','submitted')
  );
  update missionaccounts.stripe_invoice_dispatch
  set state = 'submitted', provider_invoice_ref = p_provider_invoice_ref,
      result_controls = result_value, last_error = null, finished_at = now()
  where id = p_dispatch_id;
  insert into missionaccounts.audit_event(
    actor_id,actor_role,subject_student_id,kind,text,to_val,reason,request_id
  ) values (
    'stripe:' || p_provider_invoice_ref,'provider',invoice_row.student_id,
    'stripe_invoice.dispatched','Stripe hosted invoice action completed',
    jsonb_build_object('invoice_id',invoice_row.id,'action',p_action,'state',invoice_row.state),
    'Provider response passed MissionAccounts binding controls',
    dispatch_row.request_id
  );
  return result_value;
end;
$$;

create function missionaccounts.api_process_stripe_invoice_event(
  p_provider_event_id text,
  p_event_type text,
  p_provider_invoice_ref text,
  p_invoice_id uuid,
  p_provider_status text,
  p_hosted_invoice_url text,
  p_invoice_pdf text,
  p_due_at timestamptz,
  p_amount_due integer,
  p_amount_paid integer
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, missionaccounts
as $$
declare
  event_row missionaccounts.provider_event_inbox%rowtype;
  invoice_row missionaccounts.invoice%rowtype;
  next_state text;
begin
  if p_event_type not in (
    'invoice.finalized','invoice.sent','invoice.paid','invoice.payment_failed',
    'invoice.overdue','invoice.voided','invoice.finalization_failed'
  ) or p_provider_invoice_ref !~ '^in_[A-Za-z0-9_]+$' or p_invoice_id is null
     or p_amount_due is null or p_amount_due < 0 or p_amount_paid is null or p_amount_paid < 0 then
    raise exception using errcode = '22023', message = 'invalid_stripe_invoice_event';
  end if;
  select * into event_row
  from missionaccounts.provider_event_inbox
  where provider = 'stripe' and provider_event_id = p_provider_event_id
  for update;
  if not found or not event_row.signature_verified
     or event_row.event_type <> p_event_type
     or event_row.provider_object_id <> p_provider_invoice_ref
     or event_row.payload#>>'{data,object,id}' <> p_provider_invoice_ref
     or event_row.payload#>>'{data,object,metadata,missionaccounts_invoice_id}' <> p_invoice_id::text then
    raise exception using errcode = '23514', message = 'stripe_invoice_event_binding_invalid';
  end if;
  select * into invoice_row from missionaccounts.invoice where id = p_invoice_id for update;
  if not found or (invoice_row.provider_ref is not null and invoice_row.provider_ref <> p_provider_invoice_ref) then
    raise exception using errcode = '23503', message = 'stripe_invoice_not_found';
  end if;
  if event_row.state = 'processed' then
    return jsonb_build_object('accepted',true,'duplicate',true,'invoice',to_jsonb(invoice_row)-'lines');
  end if;
  if p_event_type <> 'invoice.voided' and p_amount_due <> invoice_row.amount_cents then
    raise exception using errcode = '23514', message = 'stripe_invoice_amount_mismatch';
  end if;
  if (p_hosted_invoice_url is not null and p_hosted_invoice_url !~ '^https://invoice[.]stripe[.]com/')
     or (p_invoice_pdf is not null and p_invoice_pdf !~ '^https://(invoice|pay)[.]stripe[.]com/') then
    raise exception using errcode = '22023', message = 'stripe_invoice_url_invalid';
  end if;

  next_state := case
    when invoice_row.state in ('paid','void') then invoice_row.state
    when p_event_type = 'invoice.paid' then 'paid'
    when p_event_type = 'invoice.voided' then 'void'
    when p_event_type = 'invoice.overdue' then 'overdue'
    when p_event_type in ('invoice.payment_failed','invoice.finalization_failed') then 'failed'
    else 'sent'
  end;
  update missionaccounts.invoice
  set state = next_state,
      provider_ref = p_provider_invoice_ref,
      provider_status = nullif(p_provider_status,''),
      hosted_invoice_url = coalesce(p_hosted_invoice_url,hosted_invoice_url),
      invoice_pdf = coalesce(p_invoice_pdf,invoice_pdf),
      due_at = coalesce(p_due_at,due_at),
      sent_at = case when next_state in ('sent','paid','overdue','failed') then coalesce(sent_at,now()) else sent_at end,
      paid_at = case when next_state = 'paid' then coalesce(paid_at,now()) else paid_at end,
      last_provider_event_at = now()
  where id = invoice_row.id
  returning * into invoice_row;
  update missionaccounts.provider_event_inbox set state='processed',processed_at=now() where id=event_row.id;
  insert into missionaccounts.audit_event(
    actor_id,actor_role,subject_student_id,kind,text,to_val,reason,request_id
  ) values (
    'stripe:' || p_provider_event_id,'provider',invoice_row.student_id,
    'stripe_invoice.webhook','Signed Stripe invoice event reconciled',
    jsonb_build_object('invoice_id',invoice_row.id,'event_type',p_event_type,'state',invoice_row.state,'amount_paid',p_amount_paid),
    'Signed provider webhook passed identity and amount controls',
    'stripe:' || p_provider_event_id || ':invoice'
  );
  return jsonb_build_object('accepted',true,'duplicate',false,'invoice',to_jsonb(invoice_row)-'lines');
end;
$$;

revoke execute on function missionaccounts.api_prepare_hosted_invoice_dispatch(uuid,text,integer,text,text,text)
from public, anon, authenticated;
grant execute on function missionaccounts.api_prepare_hosted_invoice_dispatch(uuid,text,integer,text,text,text)
to service_role;
revoke execute on function missionaccounts.api_finish_hosted_invoice_dispatch(uuid,text,boolean,text,text,text,text,timestamptz,text)
from public, anon, authenticated;
grant execute on function missionaccounts.api_finish_hosted_invoice_dispatch(uuid,text,boolean,text,text,text,text,timestamptz,text)
to service_role;
revoke execute on function missionaccounts.api_process_stripe_invoice_event(text,text,text,uuid,text,text,text,timestamptz,integer,integer)
from public, anon, authenticated;
grant execute on function missionaccounts.api_process_stripe_invoice_event(text,text,text,uuid,text,text,text,timestamptz,integer,integer)
to service_role;

comment on function missionaccounts.api_prepare_hosted_invoice_dispatch(uuid,text,integer,text,text,text) is
  'Prepares one idempotent Stripe-hosted invoice action after revalidating current billing authority, identity, email, and customer binding.';
comment on function missionaccounts.api_process_stripe_invoice_event(text,text,text,uuid,text,text,text,timestamptz,integer,integer) is
  'Reconciles signed Stripe invoice lifecycle events without trusting browser state.';
