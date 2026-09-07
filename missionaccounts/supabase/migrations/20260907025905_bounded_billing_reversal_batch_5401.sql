-- MX-MISSIONACCOUNTS-5401R
-- Internal approval/reversal only. No provider invocation or feature activation.

alter table missionaccounts.billing_decision
  drop constraint billing_decision_state_check,
  add constraint billing_decision_state_check
    check (state in (
      'estimate','needs_review','approved','stale','superseded','cleared'
    )),
  add column reverts_id uuid
    references missionaccounts.billing_decision(id),
  add constraint billing_decision_reverts_not_self
    check (reverts_id is null or reverts_id <> id),
  add constraint billing_decision_cleared_marker_check
    check (
      state <> 'cleared'
      or (amount_cents = 0 and reverts_id is not null)
    );

create unique index billing_decision_reverts_once
  on missionaccounts.billing_decision(reverts_id)
  where reverts_id is not null;

-- Keep billing_decision_one_current unchanged. A cleared marker occupies the
-- current slot until a later approval supersedes it through the existing RPC.

create table missionaccounts.billing_batch (
  id uuid primary key default gen_random_uuid(),
  operation text not null check (operation in ('approve','reverse')),
  cycle_key text not null references missionaccounts.cycle(key),
  parent_batch_id uuid references missionaccounts.billing_batch(id),
  request_id text not null unique
    check (request_id ~ '^[A-Za-z0-9._:-]{8,200}$'),
  actor_id text not null check (length(btrim(actor_id)) > 0),
  actor_role text not null
    check (actor_role in ('missionaccounts_admin','founder')),
  reason text not null check (length(btrim(reason)) between 1 and 2000),
  request_controls jsonb not null
    check (jsonb_typeof(request_controls) = 'object'),
  result_controls jsonb not null default '{}'::jsonb
    check (jsonb_typeof(result_controls) = 'object'),
  created_at timestamptz not null default now(),
  check (
    (operation = 'approve' and parent_batch_id is null)
    or (operation = 'reverse' and parent_batch_id is not null)
  )
);

alter table missionaccounts.billing_batch enable row level security;
alter table missionaccounts.billing_batch force row level security;
revoke all on missionaccounts.billing_batch from public, anon, authenticated;
grant select, insert, update on missionaccounts.billing_batch to service_role;

-- Opaque optimistic controls. They contain identifiers/state, not contact data.
-- VOLATILE ensures each invocation observes its current SPI statement snapshot.
create function missionaccounts.billing_batch_snapshot(
  p_student_id uuid,
  p_cycle_key text
)
returns jsonb
language sql
volatile
security invoker
set search_path = pg_catalog, missionaccounts
as $$
  select jsonb_build_object(
    'identity_state', (
      select s.identity_state
      from missionaccounts.student s where s.id = p_student_id
    ),
    'decision', (
      select jsonb_build_object('id', d.id, 'state', d.state)
      from missionaccounts.billing_decision d
      where d.student_id = p_student_id and d.cycle_key = p_cycle_key
        and d.superseded_by_id is null
    ),
    'day_ids', coalesce((
      select jsonb_agg(d.id::text order by d.id::text)
      from missionaccounts.attendance_day d
      where d.student_id = p_student_id and d.cycle_key = p_cycle_key
        and d.superseded_at is null
    ), '[]'::jsonb),
    'policy_id', (
      select p.id
      from missionaccounts.cycle_policy p
      where p.cycle_key = p_cycle_key and p.key = 'cap_13_15'
        and p.superseded_by_id is null
    ),
    'ceiling_ids', coalesce((
      select jsonb_agg(c.id::text order by c.id::text)
      from missionaccounts.full_cycle_ceiling c
      where c.student_id = p_student_id and c.cycle_key = p_cycle_key
        and c.superseded_by_id is null
    ), '[]'::jsonb),
    'rule_ids', coalesce((
      select jsonb_agg(r.id::text order by r.id::text)
      from missionaccounts.rule_decision r
      where r.rule = 'one_charge_per_calendar_day'
        and r.superseded_by_id is null
    ), '[]'::jsonb)
  );
$$;

-- This is deliberately conservative about provider attempts: a prepared/failed
-- receipt can represent an uncertain provider outcome. It requires review.
-- Internal provider-free void invoices do not count as financial custody.
create function missionaccounts.billing_has_financial_custody(
  p_student_id uuid,
  p_cycle_key text
)
returns boolean
language sql
volatile
security invoker
set search_path = pg_catalog, missionaccounts
as $$
  select
    exists (
      select 1 from missionaccounts.invoice i
      where i.student_id = p_student_id and i.cycle_key = p_cycle_key
        and (
          i.provider_ref is not null
          or i.state in ('sent','paid','overdue')
          or exists (
            select 1 from missionaccounts.stripe_invoice_dispatch d
            where d.invoice_id = i.id
          )
        )
    )
    or exists (
      select 1
      from missionaccounts.charge c
      join missionaccounts.attendance_day d on d.id = c.attendance_day_id
      where c.student_id = p_student_id and d.cycle_key = p_cycle_key
    )
    or exists (
      select 1
      from missionaccounts.auto_charge_dispatch a
      join missionaccounts.attendance_day d on d.id = a.attendance_day_id
      where d.student_id = p_student_id and d.cycle_key = p_cycle_key
    );
$$;

create function missionaccounts.api_billing_batch_controls(
  p_cycle_key text,
  p_student_ids uuid[],
  p_actor_role text
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, missionaccounts
as $$
declare
  result jsonb;
begin
  if p_actor_role is null
     or p_actor_role not in ('missionaccounts_admin','founder') then
    raise exception using errcode = '42501',
      message = 'billing_admin_required';
  end if;
  if p_student_ids is null
     or cardinality(p_student_ids) not between 1 and 100
     or array_position(p_student_ids, null) is not null
     or cardinality(p_student_ids) <> (
       select count(distinct x) from unnest(p_student_ids) x
     ) then
    raise exception using errcode = '22023',
      message = 'invalid_billing_batch_students';
  end if;
  perform 1 from missionaccounts.cycle where key = p_cycle_key;
  if not found then
    raise exception using errcode = '23503', message = 'cycle_not_found';
  end if;
  if (select count(*) from missionaccounts.student
      where id = any(p_student_ids)) <> cardinality(p_student_ids) then
    raise exception using errcode = '23503', message = 'student_not_found';
  end if;

  select jsonb_agg(
    jsonb_build_object(
      'student_id', s.id,
      'expected', missionaccounts.billing_batch_snapshot(s.id, p_cycle_key)
    ) order by s.id::text
  ) into result
  from missionaccounts.student s where s.id = any(p_student_ids);

  return jsonb_build_object('cycle_key', p_cycle_key, 'items', result);
end;
$$;

create function missionaccounts.api_reverse_billing_decision(
  p_decision_id uuid,
  p_reason text,
  p_actor_id text,
  p_actor_role text,
  p_request_id text
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, extensions, missionaccounts
as $$
declare
  prior_audit missionaccounts.audit_event%rowtype;
  target missionaccounts.billing_decision%rowtype;
  marker missionaccounts.billing_decision%rowtype;
  v_student_id uuid;
  v_cycle_key text;
  marker_id uuid := gen_random_uuid();
  audit_id uuid := gen_random_uuid();
  controls jsonb;
  receipt jsonb;
  marker_basis jsonb;
  voided_ids jsonb := '[]'::jsonb;
  rejection text;
begin
  if p_actor_role is null
     or p_actor_role not in ('missionaccounts_admin','founder') then
    raise exception using errcode = '42501',
      message = 'billing_admin_required';
  end if;
  if p_decision_id is null
     or nullif(btrim(p_actor_id), '') is null
     or p_request_id is null
     or p_request_id !~ '^[A-Za-z0-9._:-]{8,200}$'
     or p_reason is null
     or length(btrim(p_reason)) not between 1 and 2000 then
    raise exception using errcode = '22023',
      message = 'invalid_billing_reversal_request';
  end if;

  controls := jsonb_build_object(
    'decision_id', p_decision_id,
    'reason', btrim(p_reason),
    'actor_id', p_actor_id,
    'actor_role', p_actor_role
  );
  perform pg_advisory_xact_lock(hashtextextended(
    'missionaccounts:billing-request:' || p_request_id, 0
  ));

  select * into prior_audit
  from missionaccounts.audit_event a
  where a.request_id = p_request_id
    and a.kind = 'billing_decision.reversal';
  if found then
    if prior_audit.to_val->'request' is distinct from controls then
      raise exception using errcode = '23505',
        message = 'idempotency_key_reuse';
    end if;
    return (prior_audit.to_val->'result')
      || jsonb_build_object('duplicate', true);
  end if;

  -- Prevent this endpoint from reusing an approval/marker request key.
  if exists (
    select 1 from missionaccounts.billing_decision d
    where d.request_id = p_request_id
  ) then
    raise exception using errcode = '23505',
      message = 'idempotency_key_reuse';
  end if;

  select * into target
  from missionaccounts.billing_decision d where d.id = p_decision_id;
  if not found then
    rejection := 'billing_decision_not_found';
  else
    v_student_id := target.student_id;
    v_cycle_key := target.cycle_key;

    perform 1 from missionaccounts.cycle c
    where c.key = v_cycle_key for update;
    perform 1 from missionaccounts.student s
    where s.id = v_student_id for update;

    perform pg_advisory_xact_lock(hashtextextended(
      'missionaccounts:financial-finality:'
        || v_student_id::text || ':' || v_cycle_key, 0
    ));

    select * into target
    from missionaccounts.billing_decision d
    where d.id = p_decision_id
    for update;

    if target.superseded_by_id is not null
       or target.state not in ('approved','stale') then
      rejection := 'current_billing_decision_required';
    else
      -- Provider preparation also locks the invoice. A preparation winning
      -- first leaves a receipt which the following custody check detects.
      perform 1 from missionaccounts.invoice i
      where i.student_id = v_student_id and i.cycle_key = v_cycle_key
      order by i.id for update;

      if missionaccounts.billing_has_financial_custody(
        v_student_id, v_cycle_key
      ) then
        rejection := 'billing_reversal_requires_financial_review';
      end if;
    end if;
  end if;

  if rejection is null then
    marker_basis := jsonb_build_object(
      'operation', 'clear',
      'reverts_id', target.id,
      'prior_basis_sha256', target.basis_sha256,
      'prior_amount_cents', target.amount_cents
    );

    insert into missionaccounts.billing_decision(
      id, student_id, cycle_key, treatment, amount_cents, note,
      basis, basis_sha256, state, decided_by, decided_at, request_id,
      superseded_by_id, reverts_id
    ) values (
      marker_id, v_student_id, v_cycle_key, target.treatment, 0,
      btrim(p_reason), marker_basis,
      encode(extensions.digest(marker_basis::text, 'sha256'), 'hex'),
      'cleared', p_actor_id, now(), p_request_id, target.id, target.id
    );

    update missionaccounts.billing_decision d
    set superseded_by_id = marker_id, state = 'superseded'
    where d.id = target.id;

    update missionaccounts.billing_decision d
    set superseded_by_id = null
    where d.id = marker_id
    returning * into marker;

    with changed as (
      update missionaccounts.invoice i
      set state = 'void'
      where i.student_id = v_student_id and i.cycle_key = v_cycle_key
        and i.state in ('draft','ready')
        and i.provider_ref is null
        and not exists (
          select 1 from missionaccounts.stripe_invoice_dispatch d
          where d.invoice_id = i.id
        )
      returning i.id
    )
    select coalesce(jsonb_agg(id::text order by id::text), '[]'::jsonb)
    into voided_ids from changed;

    receipt := jsonb_build_object(
      'accepted', true,
      'student_id', v_student_id,
      'cycle_key', v_cycle_key,
      'prior_decision_id', target.id,
      'cleared_decision_id', marker.id,
      'voided_invoice_ids', voided_ids,
      'audit_event_id', audit_id
    );
  else
    receipt := jsonb_build_object(
      'accepted', false,
      'student_id', v_student_id,
      'cycle_key', v_cycle_key,
      'prior_decision_id', p_decision_id,
      'reason', rejection,
      'audit_event_id', audit_id
    );
  end if;

  insert into missionaccounts.audit_event(
    id, actor_id, actor_role, subject_student_id, kind, text,
    from_val, to_val, reason, request_id
  ) values (
    audit_id, p_actor_id, p_actor_role, v_student_id,
    'billing_decision.reversal',
    case when rejection is null
      then 'Billing decision cleared without changing source evidence'
      else 'Billing decision reversal rejected' end,
    case when target.id is null then null else to_jsonb(target) end,
    jsonb_build_object('request', controls, 'result', receipt),
    coalesce(rejection, btrim(p_reason)), p_request_id
  );

  return receipt || jsonb_build_object('duplicate', false);
end;
$$;

create function missionaccounts.api_approve_billing_batch(
  p_cycle_key text,
  p_items jsonb,
  p_reason text,
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
  prior missionaccounts.billing_batch%rowtype;
  item jsonb;
  normalized jsonb := '[]'::jsonb;
  controls jsonb;
  snapshot jsonb;
  child jsonb;
  outcomes jsonb := '[]'::jsonb;
  receipt jsonb;
  batch_id uuid := gen_random_uuid();
  audit_id uuid := gen_random_uuid();
  item_audit_id uuid;
  v_student_id uuid;
  child_key text;
  failure_message text;
  approved_count integer := 0;
  rejected_count integer := 0;
begin
  if p_actor_role is null
     or p_actor_role not in ('missionaccounts_admin','founder') then
    raise exception using errcode = '42501',
      message = 'billing_admin_required';
  end if;
  if nullif(btrim(p_actor_id), '') is null
     or p_request_id is null
     or p_request_id !~ '^[A-Za-z0-9._:-]{8,200}$'
     or p_reason is null
     or length(btrim(p_reason)) not between 1 and 2000
     or jsonb_typeof(p_items) is distinct from 'array' then
    raise exception using errcode = '22023',
      message = 'invalid_billing_batch_request';
  end if;
  if jsonb_array_length(p_items) not between 1 and 100 then
    raise exception using errcode = '22023',
      message = 'billing_batch_size_out_of_range';
  end if;

  for item in select value from jsonb_array_elements(p_items)
  loop
    if jsonb_typeof(item) is distinct from 'object'
       or (item - array[
         'student_id','expected','expected_amount_cents'
       ]::text[]) <> '{}'::jsonb
       or coalesce(item->>'student_id','') !~*
         '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
       or jsonb_typeof(item->'expected') is distinct from 'object'
       or jsonb_typeof(item->'expected_amount_cents')
         is distinct from 'number'
       or coalesce(item->>'expected_amount_cents','') !~ '^[0-9]{1,7}$'
    then
      raise exception using errcode = '22023',
        message = 'invalid_billing_batch_item';
    end if;
    if (item->>'expected_amount_cents')::integer > 1000000 then
      raise exception using errcode = '22023',
        message = 'invalid_billing_batch_expected_amount';
    end if;
    normalized := normalized || jsonb_build_array(jsonb_build_object(
      'student_id', (item->>'student_id')::uuid,
      'expected', item->'expected',
      'expected_amount_cents', (item->>'expected_amount_cents')::integer
    ));
  end loop;

  if jsonb_array_length(normalized) <> (
    select count(distinct value->>'student_id')
    from jsonb_array_elements(normalized)
  ) then
    raise exception using errcode = '22023',
      message = 'duplicate_billing_batch_student';
  end if;

  select jsonb_agg(value order by value->>'student_id')
  into normalized from jsonb_array_elements(normalized);

  controls := jsonb_build_object(
    'operation', 'approve', 'cycle_key', p_cycle_key,
    'items', normalized, 'reason', btrim(p_reason),
    'actor_id', p_actor_id, 'actor_role', p_actor_role
  );
  perform pg_advisory_xact_lock(hashtextextended(
    'missionaccounts:billing-batch-request:' || p_request_id, 0
  ));
  select * into prior from missionaccounts.billing_batch b
  where b.request_id = p_request_id;
  if found then
    if prior.request_controls is distinct from controls then
      raise exception using errcode = '23505',
        message = 'idempotency_key_reuse';
    end if;
    return prior.result_controls || jsonb_build_object('duplicate', true);
  end if;

  perform 1 from missionaccounts.cycle c
  where c.key = p_cycle_key for update;
  if not found then
    raise exception using errcode = '23503', message = 'cycle_not_found';
  end if;

  -- All student locks are acquired in the same order across batches.
  perform 1 from missionaccounts.student s
  where s.id in (
    select (value->>'student_id')::uuid
    from jsonb_array_elements(normalized)
  )
  order by s.id for update;

  insert into missionaccounts.billing_batch(
    id, operation, cycle_key, request_id, actor_id, actor_role,
    reason, request_controls
  ) values (
    batch_id, 'approve', p_cycle_key, p_request_id, p_actor_id,
    p_actor_role, btrim(p_reason), controls
  );

  for item in
    select value from jsonb_array_elements(normalized)
    order by value->>'student_id'
  loop
    v_student_id := (item->>'student_id')::uuid;
    child_key := 'mma-batch:' || batch_id::text || ':' || v_student_id::text;
    child := null;

    -- A failed item rolls back only its own attempted approval/invoice.
    begin
      perform 1 from missionaccounts.student s where s.id = v_student_id;
      if not found then
        raise exception using errcode = 'P5401',
          message = 'student_not_found';
      end if;

      perform pg_advisory_xact_lock(hashtextextended(
        'missionaccounts:financial-finality:'
          || v_student_id::text || ':' || p_cycle_key, 0
      ));
      perform 1 from missionaccounts.invoice i
      where i.student_id = v_student_id and i.cycle_key = p_cycle_key
      order by i.id for update;

      snapshot := missionaccounts.billing_batch_snapshot(
        v_student_id, p_cycle_key
      );
      if snapshot is distinct from item->'expected' then
        raise exception using errcode = 'P5401',
          message = 'billing_snapshot_changed';
      end if;
      if snapshot->'decision' <> 'null'::jsonb
         and snapshot #>> '{decision,state}' <> 'cleared' then
        raise exception using errcode = 'P5401',
          message = 'billing_batch_requires_unapproved_record';
      end if;
      if missionaccounts.billing_has_financial_custody(
        v_student_id, p_cycle_key
      ) then
        raise exception using errcode = 'P5401',
          message = 'billing_batch_requires_financial_review';
      end if;

      child := missionaccounts.api_approve_billing_decision(
        v_student_id, p_cycle_key, 'confirm', null, btrim(p_reason),
        p_actor_id, p_actor_role, child_key
      );

      if coalesce((child->>'accepted')::boolean, false)
         and (child #>> '{decision,amount_cents}')::integer
           is distinct from (item->>'expected_amount_cents')::integer then
        raise exception using errcode = 'P5401',
          message = 'billing_expected_amount_changed';
      end if;

    exception
      when sqlstate 'P5401' or check_violation then
        get stacked diagnostics failure_message = MESSAGE_TEXT;
        -- Only the known lower-layer cap hold is converted to an item result.
        -- Unexpected constraints and infrastructure failures abort the batch.
        if SQLSTATE = '23514'
           and failure_message not in ('cap_candidate_requires_review','student_is_retired_technical_projection') then
          raise;
        end if;
        item_audit_id := gen_random_uuid();
        child := jsonb_build_object(
          'accepted', false, 'reason', failure_message,
          'audit_event_id', item_audit_id
        );
        insert into missionaccounts.audit_event(
          id, actor_id, actor_role, subject_student_id, kind, text,
          to_val, reason, request_id
        ) values (
          item_audit_id, p_actor_id, p_actor_role,
          case when exists (
            select 1 from missionaccounts.student s where s.id = v_student_id
          ) then v_student_id else null end,
          'billing_batch.item_rejected',
          'Batch item rejected without approving an amount',
          jsonb_build_object(
            'batch_id', batch_id, 'student_id', v_student_id,
            'cycle_key', p_cycle_key, 'reason', failure_message
          ),
          failure_message, child_key
        );
    end;

    if coalesce((child->>'accepted')::boolean, false) then
      approved_count := approved_count + 1;
      outcomes := outcomes || jsonb_build_array(jsonb_build_object(
        'student_id', v_student_id, 'accepted', true,
        'decision_id', child #>> '{decision,id}',
        'amount_cents', (child #>> '{decision,amount_cents}')::integer,
        'audit_event_id', child->>'audit_event_id'
      ));
    else
      rejected_count := rejected_count + 1;
      outcomes := outcomes || jsonb_build_array(jsonb_build_object(
        'student_id', v_student_id, 'accepted', false,
        'reason', child->>'reason',
        'audit_event_id', child->>'audit_event_id'
      ));
    end if;
  end loop;

  receipt := jsonb_build_object(
    'processed', true, 'accepted', rejected_count = 0,
    'partial', approved_count > 0 and rejected_count > 0,
    'batch_id', batch_id, 'cycle_key', p_cycle_key,
    'approved_count', approved_count, 'rejected_count', rejected_count,
    'results', outcomes, 'audit_event_id', audit_id
  );
  update missionaccounts.billing_batch b
  set result_controls = receipt where b.id = batch_id;
  insert into missionaccounts.audit_event(
    id, actor_id, actor_role, kind, text, to_val, reason, request_id
  ) values (
    audit_id, p_actor_id, p_actor_role, 'billing_batch.approved',
    'Bounded billing batch processed with per-record outcomes',
    receipt, btrim(p_reason), p_request_id
  );
  return receipt || jsonb_build_object('duplicate', false);
end;
$$;

create function missionaccounts.api_reverse_billing_batch(
  p_batch_id uuid,
  p_reason text,
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
  parent missionaccounts.billing_batch%rowtype;
  prior missionaccounts.billing_batch%rowtype;
  item jsonb;
  child jsonb;
  controls jsonb;
  receipt jsonb;
  outcomes jsonb := '[]'::jsonb;
  batch_id uuid := gen_random_uuid();
  audit_id uuid := gen_random_uuid();
  reversed_count integer := 0;
  rejected_count integer := 0;
begin
  if p_actor_role is null
     or p_actor_role not in ('missionaccounts_admin','founder') then
    raise exception using errcode = '42501',
      message = 'billing_admin_required';
  end if;
  if p_batch_id is null
     or nullif(btrim(p_actor_id), '') is null
     or p_request_id is null
     or p_request_id !~ '^[A-Za-z0-9._:-]{8,200}$'
     or p_reason is null
     or length(btrim(p_reason)) not between 1 and 2000 then
    raise exception using errcode = '22023',
      message = 'invalid_billing_batch_reversal';
  end if;

  controls := jsonb_build_object(
    'operation', 'reverse', 'parent_batch_id', p_batch_id,
    'reason', btrim(p_reason),
    'actor_id', p_actor_id, 'actor_role', p_actor_role
  );
  perform pg_advisory_xact_lock(hashtextextended(
    'missionaccounts:billing-batch-request:' || p_request_id, 0
  ));
  select * into prior from missionaccounts.billing_batch b
  where b.request_id = p_request_id;
  if found then
    if prior.request_controls is distinct from controls then
      raise exception using errcode = '23505',
        message = 'idempotency_key_reuse';
    end if;
    return prior.result_controls || jsonb_build_object('duplicate', true);
  end if;

  select * into parent from missionaccounts.billing_batch b
  where b.id = p_batch_id and b.operation = 'approve';
  if not found then
    raise exception using errcode = '23503',
      message = 'approval_batch_not_found';
  end if;

  perform 1 from missionaccounts.cycle c
  where c.key = parent.cycle_key for update;
  perform 1 from missionaccounts.student s
  where s.id in (
    select (value->>'student_id')::uuid
    from jsonb_array_elements(parent.result_controls->'results')
    where value->>'accepted' = 'true'
  )
  order by s.id for update;

  insert into missionaccounts.billing_batch(
    id, operation, cycle_key, parent_batch_id, request_id,
    actor_id, actor_role, reason, request_controls
  ) values (
    batch_id, 'reverse', parent.cycle_key, parent.id, p_request_id,
    p_actor_id, p_actor_role, btrim(p_reason), controls
  );

  -- IDs come exclusively from the immutable original operation receipt.
  for item in
    select value
    from jsonb_array_elements(parent.result_controls->'results')
    where value->>'accepted' = 'true'
    order by value->>'student_id'
  loop
    child := missionaccounts.api_reverse_billing_decision(
      (item->>'decision_id')::uuid, btrim(p_reason),
      p_actor_id, p_actor_role,
      'mma-batch-undo:' || batch_id::text || ':' || (item->>'student_id')
    );
    outcomes := outcomes || jsonb_build_array(child);

    if coalesce((child->>'accepted')::boolean, false) then
      reversed_count := reversed_count + 1;
    else
      rejected_count := rejected_count + 1;
    end if;
  end loop;

  receipt := jsonb_build_object(
    'processed', true, 'accepted', rejected_count = 0,
    'partial', reversed_count > 0 and rejected_count > 0,
    'batch_id', batch_id, 'parent_batch_id', parent.id,
    'cycle_key', parent.cycle_key,
    'reversed_count', reversed_count, 'rejected_count', rejected_count,
    'results', outcomes, 'audit_event_id', audit_id
  );
  update missionaccounts.billing_batch b
  set result_controls = receipt where b.id = batch_id;
  insert into missionaccounts.audit_event(
    id, actor_id, actor_role, kind, text, to_val, reason, request_id
  ) values (
    audit_id, p_actor_id, p_actor_role, 'billing_batch.reversed',
    'Bounded billing batch reversal processed with per-record outcomes',
    receipt, btrim(p_reason), p_request_id
  );
  return receipt || jsonb_build_object('duplicate', false);
end;
$$;

revoke execute on function
  missionaccounts.billing_batch_snapshot(uuid,text),
  missionaccounts.billing_has_financial_custody(uuid,text),
  missionaccounts.api_billing_batch_controls(text,uuid[],text),
  missionaccounts.api_reverse_billing_decision(uuid,text,text,text,text),
  missionaccounts.api_approve_billing_batch(text,jsonb,text,text,text,text),
  missionaccounts.api_reverse_billing_batch(uuid,text,text,text,text)
from public, anon, authenticated;

grant execute on function
  missionaccounts.billing_batch_snapshot(uuid,text),
  missionaccounts.billing_has_financial_custody(uuid,text),
  missionaccounts.api_billing_batch_controls(text,uuid[],text),
  missionaccounts.api_reverse_billing_decision(uuid,text,text,text,text),
  missionaccounts.api_approve_billing_batch(text,jsonb,text,text,text,text),
  missionaccounts.api_reverse_billing_batch(uuid,text,text,text,text)
to service_role;

create or replace function missionaccounts.api_approve_billing_decision(
  p_student_id uuid,
  p_cycle_key text,
  p_treatment text,
  p_requested_amount_cents integer,
  p_note text,
  p_actor_id text,
  p_actor_role text,
  p_request_id text
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, extensions, missionaccounts
as $$
declare
  student_row missionaccounts.student%rowtype;
  cycle_row missionaccounts.cycle%rowtype;
  cap_row missionaccounts.full_cycle_ceiling%rowtype;
  prior_decision missionaccounts.billing_decision%rowtype;
  existing_decision missionaccounts.billing_decision%rowtype;
  new_decision missionaccounts.billing_decision%rowtype;
  invoice_row missionaccounts.invoice%rowtype;
  decision_id uuid := gen_random_uuid();
  audit_id uuid;
  billable_count integer := 0;
  comped_count integer := 0;
  grace_count integer := 0;
  review_count integer := 0;
  day_count integer := 0;
  event_count integer := 0;
  candidate_cap_count integer := 0;
  cycle_cap_decision text;
  amount_cents integer := 0;
  raw_amount_cents integer := 0;
  basis jsonb;
  basis_sha256 text;
  rejection_reason text;
  request_fingerprint jsonb;
  existing_rejection jsonb;
begin
  if p_actor_role is null or p_actor_role not in ('missionaccounts_admin','founder') then
    raise exception using errcode = '42501', message = 'billing_admin_required';
  end if;
  if p_request_id is null or p_request_id !~ '^[A-Za-z0-9._:-]{8,200}$' then
    raise exception using errcode = '22023', message = 'invalid_billing_request_id';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('missionaccounts:billing-request:' || p_request_id, 0));
  if p_treatment is null
     or p_treatment not in ('confirm','fullcycle','other','special','ucc','mul','waived','prepaid','already_paid','already_invoiced')
     or nullif(btrim(p_actor_id), '') is null
     or nullif(btrim(p_actor_role), '') is null
     or nullif(btrim(p_request_id), '') is null then
    raise exception using errcode = '22023', message = 'invalid_billing_decision_request';
  end if;
  if p_treatment in ('other','special')
     and (p_requested_amount_cents is null or p_requested_amount_cents < 0 or nullif(btrim(p_note), '') is null) then
    raise exception using errcode = '22023', message = 'custom_billing_amount_and_note_required';
  end if;

  request_fingerprint := jsonb_build_object(
    'student_id', p_student_id,
    'cycle_key', p_cycle_key,
    'treatment', p_treatment,
    'requested_amount_cents', p_requested_amount_cents,
    'note', p_note,
    'actor_id', p_actor_id
  );

  select * into existing_decision
  from missionaccounts.billing_decision
  where request_id = p_request_id;
  if found then
    if existing_decision.reverts_id is not null then
      raise exception using errcode = '23505', message = 'idempotency_key_reuse';
    end if;
    if existing_decision.student_id <> p_student_id
       or existing_decision.cycle_key <> p_cycle_key
       or existing_decision.treatment <> p_treatment
       or (existing_decision.basis->>'requested_amount_cents')::integer is distinct from p_requested_amount_cents
       or existing_decision.note is distinct from p_note
       or existing_decision.decided_by <> p_actor_id then
      raise exception using errcode = '23505', message = 'idempotency_key_reuse';
    end if;
    select * into invoice_row
    from missionaccounts.invoice inv where inv.decision_id = existing_decision.id
    order by inv.created_at desc limit 1;
    select id into audit_id from missionaccounts.audit_event
    where request_id = p_request_id and kind = 'billing_decision.approved';
    return jsonb_build_object(
      'accepted', true,
      'decision', to_jsonb(existing_decision),
      'invoice', case when invoice_row.id is null then null else to_jsonb(invoice_row) end,
      'audit_event_id', audit_id,
      'duplicate', true
    );
  end if;

  select to_val into existing_rejection
  from missionaccounts.audit_event
  where request_id = p_request_id and kind = 'billing_decision.rejected';
  if found then
    if existing_rejection->'request' <> request_fingerprint then
      raise exception using errcode = '23505', message = 'idempotency_key_reuse';
    end if;
    return jsonb_build_object(
      'accepted', false,
      'reason', existing_rejection->>'reason',
      'audit_event_id', (select id from missionaccounts.audit_event where request_id = p_request_id and kind = 'billing_decision.rejected'),
      'duplicate', true
    );
  end if;

  select * into cycle_row from missionaccounts.cycle where key = p_cycle_key for update;
  if not found then raise exception using errcode = '23503', message = 'cycle_not_found'; end if;
  select * into student_row from missionaccounts.student where id = p_student_id for update;
  if not found then raise exception using errcode = '23503', message = 'student_not_found'; end if;

  -- Hosted preparation locks these same rows before recording provider custody.
  -- Inspect only after taking the lock, so an in-flight prepare cannot be voided.
  perform 1 from missionaccounts.invoice i
  where i.student_id = p_student_id and i.cycle_key = p_cycle_key
  order by i.id for update;

  select
    count(*)::integer,
    count(*) filter (where ad.kind = 'billable')::integer,
    count(*) filter (where ad.kind = 'comped')::integer,
    count(*) filter (where ad.kind = 'grace')::integer,
    count(*) filter (where ad.kind = 'needs_review')::integer,
    coalesce(sum(ev.events), 0)::integer
  into day_count, billable_count, comped_count, grace_count, review_count, event_count
  from missionaccounts.attendance_day ad
  left join lateral (
    select count(*)::integer as events
    from missionaccounts.attendance_day_event ade
    where ade.attendance_day_id = ad.id
  ) ev on true
  where ad.student_id = p_student_id
    and ad.cycle_key = p_cycle_key
    and ad.superseded_at is null;

  raw_amount_cents := billable_count * 2500;
  select value->>'decision' into cycle_cap_decision
  from missionaccounts.cycle_policy
  where cycle_key = p_cycle_key and key = 'cap_13_15' and superseded_by_id is null;
  select count(*)::integer into candidate_cap_count
  from missionaccounts.full_cycle_ceiling
  where student_id = p_student_id and cycle_key = p_cycle_key
    and status = 'candidate' and superseded_by_id is null;
  select * into cap_row
  from missionaccounts.full_cycle_ceiling
  where student_id = p_student_id and cycle_key = p_cycle_key
    and status = 'verified' and superseded_by_id is null
  order by decided_at desc nulls last limit 1;

  if missionaccounts.billing_has_financial_custody(p_student_id,p_cycle_key) then rejection_reason := 'billing_change_requires_financial_review';
  elsif student_row.identity_state <> 'verified' then rejection_reason := 'student_identity_requires_review';
  elsif review_count > 0 then rejection_reason := 'attendance_requires_review';
  elsif not exists (
    select 1 from missionaccounts.rule_decision
    where rule = 'one_charge_per_calendar_day' and mode = 'retroactive'
      and effective_from <= cycle_row.starts_on and superseded_by_id is null
  ) then rejection_reason := 'authoritative_rule_decision_missing';
  elsif p_treatment = 'fullcycle' and cap_row.id is null then rejection_reason := 'verified_full_cycle_ceiling_required';
  elsif p_treatment = 'confirm'
        and billable_count between 13 and 15
        and coalesce(cycle_cap_decision, 'pending') = 'pending'
    then rejection_reason := 'cycle_cap_policy_requires_review';
  elsif candidate_cap_count > 0
        and cap_row.id is null
        and raw_amount_cents > 30000
        and not (billable_count between 13 and 15 and cycle_cap_decision = 'cap')
    then rejection_reason := 'cap_candidate_requires_review';
  end if;

  if rejection_reason is not null then
    insert into missionaccounts.audit_event(
      actor_id, actor_role, subject_student_id, kind, text, to_val, reason, request_id
    ) values (
      p_actor_id, p_actor_role, p_student_id, 'billing_decision.rejected',
      'Billing approval rejected by server authority',
      jsonb_build_object('request', request_fingerprint, 'reason', rejection_reason),
      rejection_reason, p_request_id
    ) returning id into audit_id;
    return jsonb_build_object('accepted', false, 'reason', rejection_reason, 'audit_event_id', audit_id, 'duplicate', false);
  end if;

  amount_cents := case
    when p_treatment in ('ucc','mul','waived','prepaid','already_paid','already_invoiced') then 0
    when p_treatment in ('other','special') then p_requested_amount_cents
    when p_treatment = 'confirm' and billable_count between 13 and 15 and cycle_cap_decision = 'cap' then 30000
    else raw_amount_cents
  end;
  if cap_row.id is not null then amount_cents := least(amount_cents, cap_row.ceiling_cents); end if;

  basis := jsonb_build_object(
    'rule', 'one_charge_per_calendar_day',
    'units', 'calendar_days',
    'dayCount', day_count,
    'att', event_count,
    'billable', billable_count,
    'comped', comped_count,
    'grace', grace_count,
    'treatment', p_treatment,
    'requested_amount_cents', p_requested_amount_cents,
    'amount_cents', amount_cents,
    'rate_cents', 2500,
    'cycle_cap_13_15', cycle_cap_decision,
    'cap', case when cap_row.id is null then null else jsonb_build_object('id', cap_row.id, 'status', cap_row.status, 'ceiling_cents', cap_row.ceiling_cents) end,
    'days', coalesce((
      select jsonb_agg(jsonb_build_object('id', id, 'day', day, 'kind', kind) order by day, id)
      from missionaccounts.attendance_day
      where student_id = p_student_id and cycle_key = p_cycle_key and superseded_at is null
    ), '[]'::jsonb)
  );
  basis_sha256 := encode(digest(basis::text, 'sha256'), 'hex');

  select * into prior_decision
  from missionaccounts.billing_decision
  where student_id = p_student_id and cycle_key = p_cycle_key and superseded_by_id is null
  for update;
  if found then
    insert into missionaccounts.billing_decision(
      id, student_id, cycle_key, treatment, amount_cents, note, basis, basis_sha256,
      state, decided_by, decided_at, request_id, superseded_by_id
    ) values (
      decision_id, p_student_id, p_cycle_key, p_treatment, amount_cents, p_note, basis, basis_sha256,
      'approved', p_actor_id, now(), p_request_id, prior_decision.id
    );
    update missionaccounts.billing_decision set superseded_by_id = decision_id, state = 'superseded' where id = prior_decision.id;
    update missionaccounts.billing_decision set superseded_by_id = null where id = decision_id returning * into new_decision;
  else
    insert into missionaccounts.billing_decision(
      id, student_id, cycle_key, treatment, amount_cents, note, basis, basis_sha256,
      state, decided_by, decided_at, request_id
    ) values (
      decision_id, p_student_id, p_cycle_key, p_treatment, amount_cents, p_note, basis, basis_sha256,
      'approved', p_actor_id, now(), p_request_id
    ) returning * into new_decision;
  end if;

  update missionaccounts.invoice set state = 'void'
  where student_id = p_student_id and cycle_key = p_cycle_key and state in ('draft','ready');
  if amount_cents > 0 then
    insert into missionaccounts.invoice(student_id, cycle_key, decision_id, state, amount_cents, lines)
    values (
      p_student_id, p_cycle_key, new_decision.id, 'draft', amount_cents,
      jsonb_build_object(
        'description', 'Dr J Live Drills attendance',
        'billable_days', billable_count,
        'rate_cents', 2500,
        'subtotal_cents', raw_amount_cents,
        'verified_cap_cents', case when cap_row.id is null then null else cap_row.ceiling_cents end,
        'total_cents', amount_cents
      )
    ) returning * into invoice_row;
  end if;

  insert into missionaccounts.audit_event(
    actor_id, actor_role, subject_student_id, kind, text, from_val, to_val, reason, request_id
  ) values (
    p_actor_id, p_actor_role, p_student_id, 'billing_decision.approved',
    'Billing decision approved from server-derived attendance days',
    case when prior_decision.id is null then null else to_jsonb(prior_decision) end,
    to_jsonb(new_decision), p_note, p_request_id
  ) returning id into audit_id;

  return jsonb_build_object(
    'accepted', true,
    'decision', to_jsonb(new_decision),
    'invoice', case when invoice_row.id is null then null else to_jsonb(invoice_row) end,
    'audit_event_id', audit_id,
    'duplicate', false
  );
end;
$$;

create or replace function missionaccounts.api_set_cycle_policy(
  p_cycle_key text,
  p_decision text,
  p_reason text,
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
  existing_policy missionaccounts.cycle_policy%rowtype;
  current_policy missionaccounts.cycle_policy%rowtype;
  new_policy missionaccounts.cycle_policy%rowtype;
  new_policy_id uuid := gen_random_uuid();
  audit_id uuid;
  stale_decisions integer := 0;
begin
  if p_actor_role is null or p_actor_role not in ('missionaccounts_admin','founder') then
    raise exception using errcode = '42501', message = 'billing_admin_required';
  end if;
  if p_request_id is null or p_request_id !~ '^[A-Za-z0-9._:-]{8,200}$' then
    raise exception using errcode = '22023', message = 'invalid_billing_request_id';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('missionaccounts:policy-request:' || p_request_id, 0));
  if p_decision is null or p_decision not in ('cap','per','pending')
     or nullif(btrim(p_cycle_key), '') is null
     or nullif(btrim(p_reason), '') is null
     or nullif(btrim(p_actor_id), '') is null
     or nullif(btrim(p_actor_role), '') is null
     or nullif(btrim(p_request_id), '') is null then
    raise exception using errcode = '22023', message = 'invalid_cycle_policy_request';
  end if;

  select * into existing_policy
  from missionaccounts.cycle_policy
  where request_id = p_request_id;
  if found then
    if existing_policy.cycle_key <> p_cycle_key
       or existing_policy.key <> 'cap_13_15'
       or existing_policy.value->>'decision' <> p_decision
       or existing_policy.reason <> p_reason
       or existing_policy.set_by <> p_actor_id then
      raise exception using errcode = '23505', message = 'idempotency_key_reuse';
    end if;
    select id into audit_id from missionaccounts.audit_event
    where request_id = p_request_id and kind = 'cycle_policy.changed';
    return jsonb_build_object(
      'accepted', true,
      'policy', to_jsonb(existing_policy),
      'audit_event_id', audit_id,
      'duplicate', true
    );
  end if;

  perform 1 from missionaccounts.cycle where key = p_cycle_key for update;
  if not found then raise exception using errcode = '23503', message = 'cycle_not_found'; end if;

  perform 1 from missionaccounts.student s where exists (select 1 from missionaccounts.billing_decision b where b.student_id=s.id and b.cycle_key=p_cycle_key and b.superseded_by_id is null)
    or exists (select 1 from missionaccounts.attendance_day d where d.student_id=s.id and d.cycle_key=p_cycle_key and d.superseded_at is null)
  order by s.id for update;
  perform 1 from missionaccounts.invoice i
  where i.cycle_key = p_cycle_key order by i.id for update;
  if exists (select 1 from missionaccounts.student s
    where missionaccounts.billing_has_financial_custody(s.id,p_cycle_key)) then
    raise exception using errcode = '23514', message = 'billing_policy_requires_financial_review';
  end if;

  select * into current_policy
  from missionaccounts.cycle_policy
  where cycle_key = p_cycle_key and key = 'cap_13_15' and superseded_by_id is null
  for update;

  if current_policy.id is null then
    insert into missionaccounts.cycle_policy(
      id, cycle_key, key, value, set_by, reason, request_id
    ) values (
      new_policy_id, p_cycle_key, 'cap_13_15', jsonb_build_object('decision', p_decision),
      p_actor_id, p_reason, p_request_id
    ) returning * into new_policy;
  else
    insert into missionaccounts.cycle_policy(
      id, cycle_key, key, value, set_by, reason, request_id, superseded_by_id
    ) values (
      new_policy_id, p_cycle_key, 'cap_13_15', jsonb_build_object('decision', p_decision),
      p_actor_id, p_reason, p_request_id, current_policy.id
    );
    update missionaccounts.cycle_policy
    set superseded_by_id = new_policy_id
    where id = current_policy.id;
    update missionaccounts.cycle_policy
    set superseded_by_id = null
    where id = new_policy_id
    returning * into new_policy;
  end if;

  update missionaccounts.billing_decision
  set state = 'stale'
  where cycle_key = p_cycle_key and superseded_by_id is null and state = 'approved';
  get diagnostics stale_decisions = row_count;
  update missionaccounts.invoice inv
  set state = 'void'
  where inv.cycle_key = p_cycle_key
    and inv.state in ('draft','ready')
    and exists (
      select 1 from missionaccounts.billing_decision bd
      where bd.id = inv.decision_id and bd.state = 'stale'
    );

  insert into missionaccounts.audit_event(
    actor_id, actor_role, kind, text, from_val, to_val, reason, request_id
  ) values (
    p_actor_id, p_actor_role, 'cycle_policy.changed',
    'Cycle 13–15-day billing policy changed',
    case when current_policy.id is null then null else to_jsonb(current_policy) end,
    jsonb_build_object('policy', to_jsonb(new_policy), 'stale_decisions', stale_decisions),
    p_reason, p_request_id
  ) returning id into audit_id;

  return jsonb_build_object(
    'accepted', true,
    'policy', to_jsonb(new_policy),
    'stale_decisions', stale_decisions,
    'audit_event_id', audit_id,
    'duplicate', false
  );
end;
$$;

-- A completed batch receipt is immutable; reversal may only use its recorded IDs.
create function missionaccounts.guard_completed_billing_batch()
returns trigger language plpgsql security invoker set search_path = pg_catalog as $$
begin
  if old.result_controls <> '{}'::jsonb or
     (to_jsonb(new) - 'result_controls') is distinct from (to_jsonb(old) - 'result_controls') then
    raise exception using errcode = '23514', message = 'completed_billing_batch_is_immutable';
  end if;
  return new;
end;
$$;
create trigger billing_batch_receipt_immutable before update on missionaccounts.billing_batch
for each row execute function missionaccounts.guard_completed_billing_batch();
revoke execute on function missionaccounts.guard_completed_billing_batch() from public, anon, authenticated;
grant execute on function missionaccounts.guard_completed_billing_batch() to service_role;

-- Safe local Undo does not create provider custody; uncertain provider attempts do.
create or replace function missionaccounts.guard_identity_decision_against_provider_invoice()
returns trigger language plpgsql security invoker set search_path=pg_catalog,missionaccounts as $$
begin
  if new.decision='same' or exists(select 1 from missionaccounts.identity_decision prior where prior.id=new.superseded_by_id and prior.decision='same') then
    perform 1 from missionaccounts.invoice i where i.student_id=any(new.member_student_ids) order by i.id for update;
    if exists(select 1 from missionaccounts.invoice i where i.student_id=any(new.member_student_ids)
      and (i.provider_ref is not null or i.state in ('sent','paid','overdue') or exists(select 1 from missionaccounts.stripe_invoice_dispatch d where d.invoice_id=i.id))) then
      raise exception using errcode='23514',message='identity_transition_requires_provider_invoice_review';
    end if;
  end if;
  return new;
end $$;
create or replace function missionaccounts.guard_device_identity_decision_against_provider_invoice()
returns trigger language plpgsql security invoker set search_path=pg_catalog,missionaccounts as $$
declare affected uuid[]; prior missionaccounts.device_identity_decision%rowtype;
begin
  select * into prior from missionaccounts.device_identity_decision p where p.id=new.superseded_by_id;
  affected:=array_remove(array[new.source_student_id,new.target_student_id,prior.target_student_id],null);
  if new.decision<>'unsure' or prior.decision='match' then
    perform 1 from missionaccounts.invoice i where i.student_id=any(affected) order by i.id for update;
    if exists(select 1 from missionaccounts.invoice i where i.student_id=any(affected)
      and (i.provider_ref is not null or i.state in ('sent','paid','overdue') or exists(select 1 from missionaccounts.stripe_invoice_dispatch d where d.invoice_id=i.id))) then
      raise exception using errcode='23514',message='device_identity_transition_requires_provider_invoice_review';
    end if;
  end if;
  return new;
end $$;
