-- Unidentified-device decisions remain a derived interpretation layer. The
-- source alias, source attendance event, and provider source rows are never
-- rewritten or deleted.

create table missionaccounts.device_identity_decision (
  id uuid primary key default gen_random_uuid(),
  identity_alias_id uuid not null references missionaccounts.identity_alias(id),
  source_student_id uuid not null references missionaccounts.student(id),
  decision text not null check (decision in ('match','not_student','unsure')),
  target_student_id uuid references missionaccounts.student(id),
  note text not null check (length(btrim(note)) > 0),
  decided_by text not null,
  request_id text not null unique,
  superseded_by_id uuid references missionaccounts.device_identity_decision(id),
  decided_at timestamptz not null default now(),
  check ((decision = 'match') = (target_student_id is not null)),
  check (target_student_id is null or target_student_id <> source_student_id)
);

create unique index device_identity_decision_one_current_alias
  on missionaccounts.device_identity_decision(identity_alias_id)
  where superseded_by_id is null;

create unique index device_identity_decision_one_current_source_student
  on missionaccounts.device_identity_decision(source_student_id)
  where superseded_by_id is null;

alter table missionaccounts.device_identity_decision enable row level security;
alter table missionaccounts.device_identity_decision force row level security;
revoke all on table missionaccounts.device_identity_decision from public, anon, authenticated;
grant select, insert, update on table missionaccounts.device_identity_decision to service_role;

-- A preserved grace interval can be owned by either a cluster decision or a
-- device decision. Keep the two custody chains explicit so a device decision
-- is never written into the cluster-decision foreign key.
alter table missionaccounts.identity_grace_preservation
  alter column identity_decision_id drop not null,
  add column device_identity_decision_id uuid
    references missionaccounts.device_identity_decision(id),
  add constraint identity_grace_preservation_one_decision_owner
    check (num_nonnulls(identity_decision_id, device_identity_decision_id) = 1);

create unique index identity_grace_preservation_device_unique
  on missionaccounts.identity_grace_preservation(
    student_id, source_grace_window_id, device_identity_decision_id
  )
  where device_identity_decision_id is not null;

create or replace view missionaccounts.identity_student_resolution
with (security_invoker = true)
as
select
  student_row.id as source_student_id,
  case
    when current_merge.canonical_student_id is not null then current_merge.canonical_student_id
    when current_device.decision = 'match' then current_device.target_student_id
    when current_device.decision = 'not_student' then null::uuid
    else student_row.id
  end as canonical_student_id,
  current_merge.cluster_ref,
  current_merge.decision_id,
  case
    when current_merge.canonical_student_id is not null then current_merge.canonical_student_id <> student_row.id
    when current_device.decision = 'match' then current_device.target_student_id <> student_row.id
    else false
  end as absorbed,
  current_device.identity_alias_id as device_alias_id,
  current_device.id as device_decision_id,
  coalesce(current_device.decision = 'not_student' and current_merge.canonical_student_id is null, false) as excluded
from missionaccounts.student student_row
left join lateral (
  select
    decision.canonical_student_id,
    decision.cluster_ref,
    decision.id as decision_id
  from missionaccounts.identity_decision decision
  where decision.superseded_by_id is null
    and decision.decision = 'same'
    and student_row.id = any(decision.member_student_ids)
  order by decision.decided_at desc, decision.id desc
  limit 1
) current_merge on true
left join lateral (
  select decision.*
  from missionaccounts.device_identity_decision decision
  where decision.superseded_by_id is null
    and decision.source_student_id = student_row.id
  order by decision.decided_at desc, decision.id desc
  limit 1
) current_device on true;

create or replace view missionaccounts.student_identity_projection
with (security_invoker = true)
as
select
  student.id,
  student.display_name,
  student.email,
  student.phone,
  student.joined_at,
  student.comp_days_allowance,
  student.identity_state,
  resolution.canonical_student_id,
  resolution.absorbed,
  exists (
    select 1 from missionaccounts.identity_alias alias
    where alias.student_id = student.id
      and alias.relationship_state = 'device'
      and alias.superseded_by_id is null
  ) as device_source,
  resolution.excluded,
  resolution.device_decision_id,
  resolution.decision_id as cluster_decision_id
from missionaccounts.student student
join missionaccounts.identity_student_resolution resolution
  on resolution.source_student_id = student.id;

create or replace function missionaccounts.guard_adjudicated_identity_evidence()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, missionaccounts
as $$
declare
  affected_cluster_ref text;
  affected_alias_id uuid;
  affected_student_id uuid;
begin
  if tg_table_name = 'identity_cluster_member' then
    affected_cluster_ref := case when tg_op = 'DELETE' then old.cluster_ref else new.cluster_ref end;
    if exists (
      select 1 from missionaccounts.identity_decision decision
      where decision.cluster_ref = affected_cluster_ref
        and decision.superseded_by_id is null
        and decision.decision in ('same','different')
    ) or (
      tg_op = 'UPDATE' and old.cluster_ref <> new.cluster_ref and exists (
        select 1 from missionaccounts.identity_decision decision
        where decision.cluster_ref = old.cluster_ref
          and decision.superseded_by_id is null
          and decision.decision in ('same','different')
      )
    ) then
      raise exception using errcode = '23514', message = 'adjudicated_identity_membership_is_immutable';
    end if;
  else
    affected_alias_id := case when tg_op = 'INSERT' then new.id else old.id end;
    affected_student_id := case when tg_op = 'DELETE' then old.student_id else new.student_id end;
    if tg_op in ('INSERT','UPDATE')
       and affected_student_id is not null
       and (tg_op = 'INSERT' or new.student_id is distinct from old.student_id)
       and exists (
         select 1
         from missionaccounts.device_identity_decision decision
         where decision.superseded_by_id is null
           and decision.decision in ('match','not_student')
           and (
             decision.source_student_id = affected_student_id
             or (decision.decision = 'match' and decision.target_student_id = affected_student_id)
           )
       ) then
      raise exception using errcode = '23514', message = 'adjudicated_device_identity_alias_topology_is_immutable';
    end if;
    if tg_op <> 'INSERT' and (exists (
        select 1
        from missionaccounts.identity_cluster_member member
        join missionaccounts.identity_decision decision
          on decision.cluster_ref = member.cluster_ref
         and decision.superseded_by_id is null
         and decision.decision in ('same','different')
        where member.identity_alias_id = affected_alias_id
      ) or exists (
        select 1 from missionaccounts.device_identity_decision decision
        where decision.identity_alias_id = affected_alias_id
          and decision.superseded_by_id is null
          and decision.decision in ('match','not_student')
      )) then
      raise exception using errcode = '23514', message = 'adjudicated_identity_alias_is_immutable';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger identity_alias_adjudicated_immutable on missionaccounts.identity_alias;
create trigger identity_alias_adjudicated_immutable
before insert or update or delete on missionaccounts.identity_alias
for each row execute function missionaccounts.guard_adjudicated_identity_evidence();

create function missionaccounts.guard_cluster_decision_against_device_resolution()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, missionaccounts
as $$
declare
  locked_student_id uuid;
begin
  -- Cluster and device decisions share the same sorted per-student locks. This
  -- closes the write-skew window where two concurrent transactions could each
  -- observe no conflicting current decision and then both commit.
  if new.superseded_by_id is null and new.decision = 'same' then
    for locked_student_id in
      select distinct student_id
      from unnest(new.member_student_ids) as student(student_id)
      where student_id is not null
      order by student_id
    loop
      perform pg_advisory_xact_lock(hashtextextended(
        'missionaccounts:identity-student:' || locked_student_id::text,
        0
      ));
    end loop;
  end if;
  if new.superseded_by_id is null
     and new.decision = 'same'
     and exists (
       select 1
       from missionaccounts.device_identity_decision device_decision
       where device_decision.superseded_by_id is null
         and device_decision.decision in ('match','not_student')
         and (
           device_decision.source_student_id = any(new.member_student_ids)
           or device_decision.target_student_id = any(new.member_student_ids)
         )
     ) then
    raise exception using errcode = '23514', message = 'identity_cluster_conflicts_with_device_resolution';
  end if;
  return new;
end;
$$;

create trigger identity_decision_device_resolution_guard
before insert or update on missionaccounts.identity_decision
for each row execute function missionaccounts.guard_cluster_decision_against_device_resolution();

revoke execute on function missionaccounts.guard_cluster_decision_against_device_resolution()
from public, anon, authenticated;
grant execute on function missionaccounts.guard_cluster_decision_against_device_resolution()
to service_role;

create function missionaccounts.guard_device_decision_against_identity_topology()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, missionaccounts
as $$
declare
  related_student_ids uuid[];
  locked_student_id uuid;
begin
  if new.superseded_by_id is not null or new.decision = 'unsure' then
    return new;
  end if;
  select array_agg(distinct student_id order by student_id)
  into related_student_ids
  from unnest(array_remove(
    array[new.source_student_id, new.target_student_id]::uuid[],
    null
  )) as student(student_id);
  foreach locked_student_id in array related_student_ids loop
    perform pg_advisory_xact_lock(hashtextextended(
      'missionaccounts:identity-student:' || locked_student_id::text,
      0
    ));
  end loop;
  if not exists (
    select 1 from missionaccounts.identity_alias alias
    where alias.id = new.identity_alias_id
      and alias.student_id = new.source_student_id
      and alias.relationship_state = 'device'
      and alias.superseded_by_id is null
  ) then
    raise exception using errcode = '23514', message = 'device_identity_decision_source_snapshot_invalid';
  end if;
  if (
    select count(*)
    from missionaccounts.identity_alias alias
    where alias.student_id = new.source_student_id
      and alias.superseded_by_id is null
  ) <> 1 then
    raise exception using errcode = '23514', message = 'device_identity_source_must_be_isolated';
  end if;
  if new.decision = 'match' and (
    not exists (
      select 1 from missionaccounts.student target
      where target.id = new.target_student_id and target.identity_state <> 'excluded'
    ) or exists (
      select 1 from missionaccounts.identity_alias alias
      where alias.student_id = new.target_student_id
        and alias.relationship_state = 'device'
        and alias.superseded_by_id is null
    )
  ) then
    raise exception using errcode = '23514', message = 'device_identity_match_target_must_be_person';
  end if;
  if exists (
    select 1 from missionaccounts.identity_decision cluster_decision
    where cluster_decision.superseded_by_id is null
      and cluster_decision.decision = 'same'
      and cluster_decision.member_student_ids && related_student_ids
  ) then
    raise exception using errcode = '23514', message = 'device_identity_conflicts_with_cluster_resolution';
  end if;
  if exists (
    select 1
    from missionaccounts.identity_cluster cluster_row
    join missionaccounts.identity_cluster_member member on member.cluster_ref = cluster_row.ref
    join missionaccounts.identity_alias alias on alias.id = member.identity_alias_id
    where cluster_row.state = 'open'
      and alias.student_id = any(related_student_ids)
  ) then
    raise exception using errcode = '23514', message = 'device_identity_requires_cluster_review_first';
  end if;
  return new;
end;
$$;

create trigger device_identity_decision_topology_guard
before insert or update on missionaccounts.device_identity_decision
for each row execute function missionaccounts.guard_device_decision_against_identity_topology();

revoke execute on function missionaccounts.guard_device_decision_against_identity_topology()
from public, anon, authenticated;
grant execute on function missionaccounts.guard_device_decision_against_identity_topology()
to service_role;

create function missionaccounts.api_decide_device_identity(
  p_identity_alias_id uuid,
  p_decision text,
  p_target_student_id uuid,
  p_today date,
  p_note text,
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
  device_alias missionaccounts.identity_alias%rowtype;
  source_student missionaccounts.student%rowtype;
  prior_decision missionaccounts.device_identity_decision%rowtype;
  existing_decision missionaccounts.device_identity_decision%rowtype;
  new_decision missionaccounts.device_identity_decision%rowtype;
  new_decision_id uuid := gen_random_uuid();
  audit_id uuid;
  transition_student_ids uuid[];
  locked_student_id uuid;
  split_student_ids uuid[];
  recompute_student_ids uuid[];
  recompute_student_id uuid;
  recomputed jsonb;
  recomputes jsonb := '[]'::jsonb;
  copied_grace_windows integer := 0;
  propagated_cap_holds integer := 0;
  restored_cap_holds integer := 0;
  stale_decisions integer := 0;
  cap_cycle record;
  cap_hold missionaccounts.full_cycle_ceiling%rowtype;
  prior_cap missionaccounts.full_cycle_ceiling%rowtype;
  current_cap missionaccounts.full_cycle_ceiling%rowtype;
  new_cap_id uuid;
begin
  if p_actor_role not in ('missionaccounts_admin','founder') then
    raise exception using errcode = '42501', message = 'device_identity_decision_admin_required';
  end if;
  if p_identity_alias_id is null
     or p_decision not in ('match','not_student','unsure')
     or p_today is null
     or nullif(btrim(p_note), '') is null
     or nullif(btrim(p_actor_id), '') is null
     or nullif(btrim(p_request_id), '') is null then
    raise exception using errcode = '22023', message = 'device_identity_decision_fields_invalid';
  end if;
  if p_decision = 'match' and p_target_student_id is null then
    raise exception using errcode = '22023', message = 'device_identity_match_target_required';
  end if;
  if p_decision <> 'match' and p_target_student_id is not null then
    raise exception using errcode = '22023', message = 'device_identity_target_only_for_match';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('missionaccounts:device-identity:request:' || p_request_id, 0));
  select * into existing_decision
  from missionaccounts.device_identity_decision
  where request_id = p_request_id;
  if found then
    if existing_decision.identity_alias_id <> p_identity_alias_id
       or existing_decision.decision <> p_decision
       or existing_decision.target_student_id is distinct from p_target_student_id
       or existing_decision.note is distinct from p_note
       or existing_decision.decided_by <> p_actor_id then
      raise exception using errcode = '23505', message = 'idempotency_key_reuse';
    end if;
    select id into audit_id from missionaccounts.audit_event
    where request_id = p_request_id and kind = 'device_identity.decided';
    return jsonb_build_object(
      'accepted', true,
      'decision', to_jsonb(existing_decision),
      'audit_event_id', audit_id,
      'duplicate', true
    );
  end if;

  perform pg_advisory_xact_lock(hashtextextended('missionaccounts:device-identity:' || p_identity_alias_id::text, 0));
  select * into device_alias
  from missionaccounts.identity_alias
  where id = p_identity_alias_id
  for update;
  if not found or device_alias.relationship_state <> 'device' or device_alias.student_id is null then
    raise exception using errcode = '23503', message = 'device_identity_alias_not_found';
  end if;

  select * into prior_decision
  from missionaccounts.device_identity_decision
  where source_student_id = device_alias.student_id
    and superseded_by_id is null;

  -- Cluster and device adjudications share one sorted per-student lock order.
  -- Take those advisory locks before any student row lock so cross-RPC
  -- interleavings cannot deadlock or commit conflicting topology.
  select array_agg(distinct candidate_id order by candidate_id)
  into transition_student_ids
  from unnest(array[
    device_alias.student_id,
    prior_decision.target_student_id,
    p_target_student_id
  ]::uuid[]) candidate(candidate_id)
  where candidate_id is not null;

  foreach locked_student_id in array transition_student_ids loop
    perform pg_advisory_xact_lock(hashtextextended(
      'missionaccounts:identity-student:' || locked_student_id::text,
      0
    ));
  end loop;

  select * into source_student
  from missionaccounts.student
  where id = device_alias.student_id
  for update;

  -- Re-read the current decision after the shared locks are held. The
  -- alias-specific lock prevents a same-source writer from changing it while
  -- we establish the common student-lock order.
  select * into prior_decision
  from missionaccounts.device_identity_decision
  where source_student_id = device_alias.student_id
    and superseded_by_id is null
  for update;

  if p_decision = 'match' then
    if p_target_student_id = device_alias.student_id
       or not exists (
         select 1 from missionaccounts.student target
         where target.id = p_target_student_id and target.identity_state <> 'excluded'
       ) then
      raise exception using errcode = '23503', message = 'device_identity_match_target_invalid';
    end if;
    if exists (
      select 1 from missionaccounts.identity_alias alias
      where alias.student_id = p_target_student_id
        and alias.relationship_state = 'device'
        and alias.superseded_by_id is null
    ) then
      raise exception using errcode = '23514', message = 'device_identity_match_target_must_be_person';
    end if;
  end if;

  if exists (
    select 1 from missionaccounts.identity_decision cluster_decision
    where cluster_decision.superseded_by_id is null
      and cluster_decision.decision = 'same'
      and cluster_decision.member_student_ids && transition_student_ids
  ) then
    raise exception using errcode = '23514', message = 'device_identity_conflicts_with_cluster_resolution';
  end if;

  if p_decision in ('match','not_student') and exists (
    select 1
    from missionaccounts.identity_cluster cluster_row
    join missionaccounts.identity_cluster_member member on member.cluster_ref = cluster_row.ref
    join missionaccounts.identity_alias alias on alias.id = member.identity_alias_id
    where cluster_row.state = 'open'
      and alias.student_id = any(transition_student_ids)
  ) then
    raise exception using errcode = '23514', message = 'device_identity_requires_cluster_review_first';
  end if;

  if (p_decision <> 'unsure' or prior_decision.decision in ('match','not_student')) and exists (
    select 1 from missionaccounts.student student
    where student.id = any(transition_student_ids)
      and (
        exists (select 1 from missionaccounts.charge charge where charge.student_id = student.id)
        or exists (select 1 from missionaccounts.invoice invoice where invoice.student_id = student.id and invoice.state in ('sent','paid'))
      )
  ) then
    raise exception using errcode = '23514', message = 'device_identity_transition_requires_financial_finality_review';
  end if;

  if (p_decision <> 'unsure' or prior_decision.decision in ('match','not_student')) and exists (
    select 1 from missionaccounts.comp_day_consumption consumption
    where consumption.student_id = any(transition_student_ids)
      and consumption.released_by_change_id is null
  ) then
    raise exception using errcode = '23514', message = 'device_identity_transition_requires_comp_day_review';
  end if;

  if p_decision in ('match','not_student') and (
    source_student.matrix_user_ref is not null
    or exists (select 1 from missionaccounts.stripe_customer_private customer where customer.student_id = source_student.id)
    or exists (select 1 from missionaccounts.payment_method_private method where method.student_id = source_student.id)
    or exists (select 1 from missionaccounts.billing_consent consent where consent.student_id = source_student.id)
    or exists (select 1 from missionaccounts.exam_plan plan where plan.student_id = source_student.id and plan.superseded_by_id is null and plan.withdrawn_at is null)
  ) then
    raise exception using errcode = '23514', message = 'device_identity_source_requires_account_review';
  end if;

  if prior_decision.id is null then
    insert into missionaccounts.device_identity_decision(
      id, identity_alias_id, source_student_id, decision, target_student_id,
      note, decided_by, request_id
    ) values (
      new_decision_id, p_identity_alias_id, device_alias.student_id, p_decision,
      case when p_decision = 'match' then p_target_student_id else null end,
      p_note, p_actor_id, p_request_id
    ) returning * into new_decision;
  else
    insert into missionaccounts.device_identity_decision(
      id, identity_alias_id, source_student_id, decision, target_student_id,
      note, decided_by, request_id, superseded_by_id
    ) values (
      new_decision_id, p_identity_alias_id, device_alias.student_id, p_decision,
      case when p_decision = 'match' then p_target_student_id else null end,
      p_note, p_actor_id, p_request_id, prior_decision.id
    );
    update missionaccounts.device_identity_decision
    set superseded_by_id = new_decision_id
    where id = prior_decision.id;
    update missionaccounts.device_identity_decision
    set superseded_by_id = null
    where id = new_decision_id
    returning * into new_decision;
  end if;

  if prior_decision.decision = 'match'
     and (p_decision <> 'match' or p_target_student_id <> prior_decision.target_student_id) then
    split_student_ids := array[device_alias.student_id, prior_decision.target_student_id]::uuid[];
    -- Never close either student's native grace window just because a device
    -- match is undone. Copy only the shared historical interval, clamped to the
    -- split date, so pre-split attendance remains protected while each native
    -- grace lifecycle continues independently.
    insert into missionaccounts.identity_grace_preservation(
      student_id, source_grace_window_id, device_identity_decision_id, from_on, to_on
    )
    select
      target.student_id,
      source_window.source_grace_window_id,
      new_decision_id,
      source_window.from_on,
      least(coalesce(source_window.to_on, p_today), p_today)
    from unnest(split_student_ids) as target(student_id)
    cross join (
      select distinct on (source_grace_window_id, from_on, to_on, source_student_id)
        source_grace_window_id, source_student_id, from_on, to_on
      from (
        select grace.id as source_grace_window_id,
          grace.student_id as source_student_id,
          grace.from_on,
          grace.to_on
        from missionaccounts.grace_window grace
        where grace.student_id = any(split_student_ids)
        union all
        select preserved.source_grace_window_id,
          preserved.student_id,
          preserved.from_on,
          preserved.to_on
        from missionaccounts.identity_grace_preservation preserved
        where preserved.student_id = any(split_student_ids)
      ) protected_grace
      where from_on <= p_today
      order by source_grace_window_id, from_on, to_on, source_student_id
    ) source_window
    where target.student_id <> source_window.source_student_id
    on conflict do nothing;
    get diagnostics copied_grace_windows = row_count;

    -- A match can place a review-only cap hold over the target's prior cap.
    -- Undo/retarget restores a copy of that exact prior row, or appends a
    -- rejected successor when no prior cap existed. Unrelated caps are left
    -- untouched and the evidence chain remains append-only.
    for cap_hold in
      select ceiling.*
      from missionaccounts.full_cycle_ceiling ceiling
      where ceiling.student_id = prior_decision.target_student_id
        and ceiling.superseded_by_id is null
        and ceiling.basis->>'kind' = 'device_identity_match_review_hold'
        and ceiling.basis->>'device_identity_decision_id' = prior_decision.id::text
      order by ceiling.cycle_key
      for update
    loop
      perform pg_advisory_xact_lock(hashtextextended(
        'missionaccounts:identity-cap:' || prior_decision.target_student_id::text || ':' || cap_hold.cycle_key,
        0
      ));
      prior_cap := null;
      if nullif(cap_hold.basis->>'superseded_ceiling_id', '') is not null then
        select * into prior_cap
        from missionaccounts.full_cycle_ceiling
        where id = (cap_hold.basis->>'superseded_ceiling_id')::uuid;
      end if;
      new_cap_id := gen_random_uuid();
      insert into missionaccounts.full_cycle_ceiling(
        id, student_id, cycle_key, status, ceiling_cents, basis,
        request_id, decided_by, decided_at, superseded_by_id
      ) values (
        new_cap_id,
        prior_decision.target_student_id,
        cap_hold.cycle_key,
        case when prior_cap.id is null then 'rejected' else prior_cap.status end,
        case when prior_cap.id is null then cap_hold.ceiling_cents else prior_cap.ceiling_cents end,
        case when prior_cap.id is null then
          jsonb_build_object(
            'kind', 'device_identity_match_review_hold_released',
            'device_identity_decision_id', prior_decision.id,
            'released_by_device_identity_decision_id', new_decision_id,
            'released_hold_id', cap_hold.id,
            'prior_cap_existed', false
          )
        else
          prior_cap.basis || jsonb_build_object(
            'device_identity_restoration', jsonb_build_object(
              'released_by_device_identity_decision_id', new_decision_id,
              'released_hold_id', cap_hold.id,
              'restored_from_ceiling_id', prior_cap.id
            )
          )
        end,
        p_request_id || ':cap-restore:' || cap_hold.cycle_key,
        case when prior_cap.id is null then p_actor_id else prior_cap.decided_by end,
        case when prior_cap.id is null then now() else prior_cap.decided_at end,
        cap_hold.id
      );
      update missionaccounts.full_cycle_ceiling
      set superseded_by_id = new_cap_id
      where id = cap_hold.id;
      update missionaccounts.full_cycle_ceiling
      set superseded_by_id = null
      where id = new_cap_id;
      restored_cap_holds := restored_cap_holds + 1;
    end loop;
  end if;

  if p_decision = 'match' then
    for cap_cycle in
      select ceiling.cycle_key,
        jsonb_agg(jsonb_build_object(
          'id', ceiling.id,
          'status', ceiling.status,
          'basis', ceiling.basis
        ) order by ceiling.created_at, ceiling.id) as sources
      from missionaccounts.full_cycle_ceiling ceiling
      where ceiling.student_id = device_alias.student_id
        and ceiling.superseded_by_id is null
        and ceiling.status in ('candidate','verified')
      group by ceiling.cycle_key
    loop
      perform pg_advisory_xact_lock(hashtextextended(
        'missionaccounts:identity-cap:' || p_target_student_id::text || ':' || cap_cycle.cycle_key,
        0
      ));
      select * into current_cap
      from missionaccounts.full_cycle_ceiling
      where student_id = p_target_student_id
        and cycle_key = cap_cycle.cycle_key
        and superseded_by_id is null
      for update;
      if current_cap.id is null then
        insert into missionaccounts.full_cycle_ceiling(
          student_id, cycle_key, status, ceiling_cents, basis, request_id
        ) values (
          p_target_student_id, cap_cycle.cycle_key, 'candidate', 30000,
          jsonb_build_object(
            'kind', 'device_identity_match_review_hold',
            'device_identity_decision_id', new_decision_id,
            'source_ceilings', cap_cycle.sources
          ),
          p_request_id || ':cap:' || cap_cycle.cycle_key
        );
        propagated_cap_holds := propagated_cap_holds + 1;
      elsif current_cap.status in ('rejected','verified') then
        new_cap_id := gen_random_uuid();
        insert into missionaccounts.full_cycle_ceiling(
          id, student_id, cycle_key, status, ceiling_cents, basis, request_id, superseded_by_id
        ) values (
          new_cap_id, p_target_student_id, cap_cycle.cycle_key, 'candidate', 30000,
          jsonb_build_object(
            'kind', 'device_identity_match_review_hold',
            'device_identity_decision_id', new_decision_id,
            'source_ceilings', cap_cycle.sources,
            'superseded_ceiling_id', current_cap.id,
            'superseded_ceiling_status', current_cap.status
          ),
          p_request_id || ':cap:' || cap_cycle.cycle_key,
          current_cap.id
        );
        update missionaccounts.full_cycle_ceiling set superseded_by_id = new_cap_id where id = current_cap.id;
        update missionaccounts.full_cycle_ceiling set superseded_by_id = null where id = new_cap_id;
        propagated_cap_holds := propagated_cap_holds + 1;
      elsif current_cap.status = 'candidate' then
        -- A candidate is already a quarantine with its own unresolved custody.
        -- Do not silently absorb device cap evidence into it: resolving that
        -- unrelated candidate could otherwise release the matched device's
        -- only target-side hold. The existing candidate must be adjudicated
        -- before this match can create its explicit owned successor.
        raise exception using errcode = '23514', message = 'device_identity_target_cap_hold_conflict';
      end if;
    end loop;
  end if;

  update missionaccounts.student
  set identity_state = case
        when p_decision = 'not_student' then 'excluded'
        else 'needs_review'
      end,
      updated_at = now()
  where id = device_alias.student_id;

  if p_decision = 'not_student' then
    update missionaccounts.attendance_day
    set superseded_at = now()
    where student_id = device_alias.student_id and superseded_at is null;
    update missionaccounts.billing_decision
    set state = 'stale'
    where student_id = device_alias.student_id
      and superseded_by_id is null
      and state = 'approved';
    get diagnostics stale_decisions = row_count;
    update missionaccounts.invoice invoice
    set state = 'void'
    where invoice.student_id = device_alias.student_id
      and invoice.state in ('draft','ready')
      and exists (
        select 1 from missionaccounts.billing_decision decision
        where decision.id = invoice.decision_id and decision.state = 'stale'
      );
  end if;

  select array_agg(distinct candidate_id order by candidate_id)
  into recompute_student_ids
  from unnest(array[
    case when prior_decision.decision = 'match' then prior_decision.target_student_id else null end,
    case when p_decision = 'match' then p_target_student_id else null end,
    case when p_decision = 'unsure' then device_alias.student_id else null end
  ]::uuid[]) candidate(candidate_id)
  where candidate_id is not null;

  if recompute_student_ids is not null then
    foreach recompute_student_id in array recompute_student_ids loop
      recomputed := missionaccounts.recompute_student_attendance(
        recompute_student_id,
        p_request_id || ':device-identity'
      );
      recomputes := recomputes || jsonb_build_array(recomputed);
    end loop;
  end if;

  insert into missionaccounts.audit_event(
    actor_id, actor_role, subject_student_id, kind, text,
    from_val, to_val, reason, request_id
  ) values (
    p_actor_id, p_actor_role, device_alias.student_id,
    'device_identity.decided',
    'Unidentified attendee adjudicated without changing source evidence',
    case when prior_decision.id is null then null else to_jsonb(prior_decision) end,
    jsonb_build_object(
      'decision', to_jsonb(new_decision),
      'copied_grace_windows', copied_grace_windows,
      'propagated_cap_holds', propagated_cap_holds,
      'restored_cap_holds', restored_cap_holds,
      'stale_decisions', stale_decisions,
      'attendance_recomputes', recomputes
    ),
    p_note,
    p_request_id
  ) returning id into audit_id;

  return jsonb_build_object(
    'accepted', true,
    'decision', to_jsonb(new_decision),
    'copied_grace_windows', copied_grace_windows,
    'propagated_cap_holds', propagated_cap_holds,
    'restored_cap_holds', restored_cap_holds,
    'stale_decisions', stale_decisions,
    'attendance_recomputes', recomputes,
    'audit_event_id', audit_id,
    'duplicate', false
  );
end;
$$;

revoke all on missionaccounts.identity_student_resolution,
  missionaccounts.student_identity_projection
from public, anon, authenticated;
grant select on missionaccounts.identity_student_resolution,
  missionaccounts.student_identity_projection
to service_role;

revoke execute on function missionaccounts.api_decide_device_identity(uuid, text, uuid, date, text, text, text, text)
from public, anon, authenticated;
grant execute on function missionaccounts.api_decide_device_identity(uuid, text, uuid, date, text, text, text, text)
to service_role;

-- Corrections retain physical custody with the immutable source student while
-- reads and authorization use the current canonical identity. This lets an
-- administrator correct a device-sourced event while it is matched to a person
-- and ensures the correction follows the source evidence if the match is later
-- reopened.
create view missionaccounts.attendance_correction_projection
with (security_invoker = true)
as
select
  correction.id,
  resolution.canonical_student_id as student_id,
  correction.student_id as source_student_id,
  correction.attendance_event_id,
  correction.session_id,
  correction.type,
  correction.from_val,
  correction.to_val,
  correction.reason,
  correction.actor_id,
  correction.request_id,
  correction.reverts_id,
  correction.reverted_by_id,
  correction.created_at
from missionaccounts.attendance_correction correction
join missionaccounts.identity_student_resolution resolution
  on resolution.source_student_id = correction.student_id;

revoke all on missionaccounts.attendance_correction_projection
from public, anon, authenticated;
grant select on missionaccounts.attendance_correction_projection to service_role;

create or replace function missionaccounts.api_append_attendance_correction(
  p_student_id uuid,
  p_session_id uuid,
  p_attendance_event_id uuid,
  p_type text,
  p_from_val jsonb,
  p_to_val jsonb,
  p_reason text,
  p_reverts_id uuid,
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
  existing_correction missionaccounts.attendance_correction%rowtype;
  existing_audit missionaccounts.audit_event%rowtype;
  reversed_correction missionaccounts.attendance_correction%rowtype;
  session_row missionaccounts.session%rowtype;
  event_row missionaccounts.attendance_event%rowtype;
  correction_row missionaccounts.attendance_correction%rowtype;
  physical_student_id uuid;
  latest_effect text;
  audit_id uuid;
  stale_decisions integer := 0;
  recomputed jsonb;
  projected_correction jsonb;
begin
  if p_type is null or p_type not in ('add','remove','step_relabel','name','note')
     or nullif(btrim(p_reason), '') is null
     or nullif(btrim(p_actor_id), '') is null
     or nullif(btrim(p_actor_role), '') is null
     or nullif(btrim(p_request_id), '') is null then
    raise exception using errcode = '22023', message = 'invalid_attendance_correction_request';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    'missionaccounts:attendance-correction:request:' || p_request_id,
    0
  ));
  select * into existing_correction
  from missionaccounts.attendance_correction
  where request_id = p_request_id;
  if found then
    select * into existing_audit
    from missionaccounts.audit_event
    where request_id = p_request_id and kind = 'attendance_correction.appended';
    if existing_audit.subject_student_id is distinct from p_student_id
       or existing_correction.session_id is distinct from p_session_id
       or (p_attendance_event_id is not null and existing_correction.attendance_event_id is distinct from p_attendance_event_id)
       or existing_correction.type <> p_type
       or existing_correction.from_val is distinct from p_from_val
       or existing_correction.to_val is distinct from p_to_val
       or existing_correction.reason <> p_reason
       or existing_correction.reverts_id is distinct from p_reverts_id
       or existing_correction.actor_id <> p_actor_id then
      raise exception using errcode = '23505', message = 'idempotency_key_reuse';
    end if;
    projected_correction := to_jsonb(existing_correction) || jsonb_build_object(
      'student_id', p_student_id,
      'source_student_id', existing_correction.student_id
    );
    return jsonb_build_object(
      'accepted', true,
      'correction', projected_correction,
      'attendance_event_id', existing_correction.attendance_event_id,
      'audit_event_id', existing_audit.id,
      'duplicate', true
    );
  end if;

  perform 1
  from missionaccounts.student student
  join missionaccounts.identity_student_resolution resolution
    on resolution.source_student_id = student.id
  where student.id = p_student_id
    and resolution.canonical_student_id = p_student_id
    and not resolution.excluded
  for update of student;
  if not found then
    raise exception using errcode = '23503', message = 'canonical_student_not_found';
  end if;

  if p_session_id is not null then
    select * into session_row
    from missionaccounts.session
    where id = p_session_id;
    if not found then raise exception using errcode = '23503', message = 'session_not_found'; end if;
  end if;

  if p_attendance_event_id is not null then
    select attendance.* into event_row
    from missionaccounts.attendance_event attendance
    join missionaccounts.identity_student_resolution resolution
      on resolution.source_student_id = attendance.student_id
    where attendance.id = p_attendance_event_id
      and resolution.canonical_student_id = p_student_id
      and not resolution.excluded
      and attendance.superseded_by_id is null
    for update of attendance;
    if not found then raise exception using errcode = '23503', message = 'attendance_event_not_found'; end if;
    if p_session_id is not null and event_row.session_id <> p_session_id then
      raise exception using errcode = '22023', message = 'attendance_event_session_mismatch';
    end if;
    if p_session_id is null then
      p_session_id := event_row.session_id;
      select * into session_row from missionaccounts.session where id = p_session_id;
    end if;
  elsif p_session_id is not null then
    select attendance.* into event_row
    from missionaccounts.attendance_event attendance
    join missionaccounts.identity_student_resolution resolution
      on resolution.source_student_id = attendance.student_id
    where resolution.canonical_student_id = p_student_id
      and not resolution.excluded
      and attendance.session_id = p_session_id
      and attendance.superseded_by_id is null
    order by attendance.id
    limit 1
    for update of attendance;
  end if;

  if p_reverts_id is not null then
    select correction.* into reversed_correction
    from missionaccounts.attendance_correction correction
    join missionaccounts.identity_student_resolution resolution
      on resolution.source_student_id = correction.student_id
    where correction.id = p_reverts_id
      and resolution.canonical_student_id = p_student_id
      and not resolution.excluded
    for update of correction;
    if not found then
      raise exception using errcode = '23503', message = 'reverted_correction_not_found';
    end if;
    if reversed_correction.reverted_by_id is not null or exists (
      select 1 from missionaccounts.attendance_correction
      where reverts_id = p_reverts_id
    ) then
      raise exception using errcode = '23505', message = 'correction_already_reverted';
    end if;
    if p_attendance_event_id is not null
       and reversed_correction.attendance_event_id is distinct from p_attendance_event_id then
      raise exception using errcode = '22023', message = 'reverted_correction_event_mismatch';
    end if;
    physical_student_id := reversed_correction.student_id;
  elsif event_row.id is not null then
    physical_student_id := event_row.student_id;
  else
    physical_student_id := p_student_id;
  end if;

  if p_type = 'add' then
    if p_session_id is null then raise exception using errcode = '22023', message = 'session_required_for_add'; end if;
    if event_row.id is null then
      insert into missionaccounts.attendance_event(
        student_id, session_id, cycle_key, local_day, step, interpretation_state, provenance
      ) values (
        p_student_id, session_row.id, session_row.cycle_key, session_row.held_on,
        session_row.step, 'effective',
        jsonb_build_object('source', 'manual_correction', 'request_id', p_request_id)
      ) returning * into event_row;
      physical_student_id := event_row.student_id;
    else
      select correction.type into latest_effect
      from missionaccounts.attendance_correction correction
      where correction.attendance_event_id = event_row.id
        and correction.type in ('add','remove')
        and correction.reverted_by_id is null
        and not exists (
          select 1 from missionaccounts.attendance_correction reversing
          where reversing.reverts_id = correction.id
        )
      order by correction.created_at desc, correction.id desc limit 1;
      if latest_effect is distinct from 'remove' and p_reverts_id is null then
        raise exception using errcode = '23505', message = 'attendance_already_effective';
      end if;
    end if;
  elsif p_type in ('remove','step_relabel') and event_row.id is null then
    raise exception using errcode = '23503', message = 'attendance_event_required';
  end if;

  if p_type = 'remove' then
    select correction.type into latest_effect
    from missionaccounts.attendance_correction correction
    where correction.attendance_event_id = event_row.id
      and correction.type in ('add','remove')
      and correction.reverted_by_id is null
      and not exists (
        select 1 from missionaccounts.attendance_correction reversing
        where reversing.reverts_id = correction.id
      )
    order by correction.created_at desc, correction.id desc limit 1;
    if latest_effect = 'remove' and p_reverts_id is null then
      raise exception using errcode = '23505', message = 'attendance_already_removed';
    end if;
  end if;
  if p_type = 'step_relabel'
     and coalesce(p_to_val->>'step', '') not in ('s1','s23','unknown') then
    raise exception using errcode = '22023', message = 'invalid_step_relabel';
  end if;

  insert into missionaccounts.attendance_correction(
    student_id, attendance_event_id, session_id, type, from_val, to_val,
    reason, actor_id, request_id, reverts_id
  ) values (
    physical_student_id, event_row.id, p_session_id, p_type, p_from_val, p_to_val,
    p_reason, p_actor_id, p_request_id, p_reverts_id
  ) returning * into correction_row;

  if p_type in ('add','remove','step_relabel') then
    recomputed := missionaccounts.recompute_student_attendance(
      p_student_id,
      p_request_id || ':attendance-correction'
    );
    stale_decisions := coalesce((recomputed->>'stale_decisions')::integer, 0);
  end if;

  projected_correction := to_jsonb(correction_row) || jsonb_build_object(
    'student_id', p_student_id,
    'source_student_id', physical_student_id
  );
  insert into missionaccounts.audit_event(
    actor_id, actor_role, subject_student_id, kind, text, from_val, to_val, reason, request_id
  ) values (
    p_actor_id, p_actor_role, p_student_id, 'attendance_correction.appended',
    'Attendance correction appended without changing source evidence',
    p_from_val,
    jsonb_build_object(
      'correction', projected_correction,
      'source_student_id', physical_student_id,
      'stale_decisions', stale_decisions,
      'attendance_recompute', recomputed
    ),
    p_reason,
    p_request_id
  ) returning id into audit_id;

  return jsonb_build_object(
    'accepted', true,
    'correction', projected_correction,
    'attendance_event_id', event_row.id,
    'stale_decisions', stale_decisions,
    'attendance_recompute', recomputed,
    'audit_event_id', audit_id,
    'duplicate', false
  );
end;
$$;

revoke execute on function missionaccounts.api_append_attendance_correction(uuid, uuid, uuid, text, jsonb, jsonb, text, uuid, text, text, text)
from public, anon, authenticated;
grant execute on function missionaccounts.api_append_attendance_correction(uuid, uuid, uuid, text, jsonb, jsonb, text, uuid, text, text, text)
to service_role;

-- A historical cap candidate is a quarantine record, not permission to create
-- a final balance. Enforce that invariant below every API so direct database
-- writes, invoice promotion, and charge preparation all fail closed until Dr J
-- appends a verified or rejected cap decision.
create function missionaccounts.guard_candidate_cap_financial_finality()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, missionaccounts
as $$
declare
  guarded_student_id uuid;
  guarded_cycle_key text;
begin
  if tg_table_name = 'billing_decision' then
    if new.state <> 'approved' then return new; end if;
    guarded_student_id := new.student_id;
    guarded_cycle_key := new.cycle_key;
  elsif tg_table_name = 'invoice' then
    if new.state not in ('ready','sent','paid') then return new; end if;
    guarded_student_id := new.student_id;
    guarded_cycle_key := new.cycle_key;
  else
    if new.state not in ('eligible','pending','succeeded') then return new; end if;
    select day.student_id, day.cycle_key
    into guarded_student_id, guarded_cycle_key
    from missionaccounts.attendance_day day
    where day.id = new.attendance_day_id;

    if guarded_student_id is distinct from new.student_id then
      raise exception using errcode = '23514', message = 'charge_attendance_owner_mismatch';
    end if;

    -- The charge owner is the protected financial identity. The equality check
    -- above makes the attendance-day cycle safe to pair with that identity.
    guarded_student_id := new.student_id;
  end if;

  if guarded_student_id is null or guarded_cycle_key is null then return new; end if;
  perform pg_advisory_xact_lock(hashtextextended(
    'missionaccounts:financial-finality:' || guarded_student_id::text || ':' || guarded_cycle_key,
    0
  ));

  if exists (
    select 1
    from missionaccounts.full_cycle_ceiling ceiling
    where ceiling.student_id = guarded_student_id
      and ceiling.cycle_key = guarded_cycle_key
      and ceiling.status = 'candidate'
      and ceiling.superseded_by_id is null
  ) then
    raise exception using errcode = '23514', message = 'cap_candidate_requires_review';
  end if;
  return new;
end;
$$;

create trigger billing_decision_candidate_cap_guard
before insert or update on missionaccounts.billing_decision
for each row execute function missionaccounts.guard_candidate_cap_financial_finality();

create trigger invoice_candidate_cap_guard
before insert or update on missionaccounts.invoice
for each row execute function missionaccounts.guard_candidate_cap_financial_finality();

create trigger charge_candidate_cap_guard
before insert or update on missionaccounts.charge
for each row execute function missionaccounts.guard_candidate_cap_financial_finality();

revoke execute on function missionaccounts.guard_candidate_cap_financial_finality()
from public, anon, authenticated;
grant execute on function missionaccounts.guard_candidate_cap_financial_finality()
to service_role;

-- Take the same student/cycle lock when cap custody changes, and reject a new
-- current candidate if final financial state already exists. Together with the
-- three guards above this closes both insertion orders and concurrent races.
create function missionaccounts.guard_candidate_cap_against_financial_finality()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, missionaccounts
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(
    'missionaccounts:financial-finality:' || new.student_id::text || ':' || new.cycle_key,
    0
  ));
  if new.status = 'candidate'
     and new.superseded_by_id is null
     and (
       exists (
         select 1 from missionaccounts.billing_decision decision
         where decision.student_id = new.student_id
           and decision.cycle_key = new.cycle_key
           and decision.state = 'approved'
           and decision.superseded_by_id is null
       )
       or exists (
         select 1 from missionaccounts.invoice invoice
         where invoice.student_id = new.student_id
           and invoice.cycle_key = new.cycle_key
           and invoice.state in ('ready','sent','paid')
       )
       or exists (
         select 1
         from missionaccounts.charge charge
         join missionaccounts.attendance_day day on day.id = charge.attendance_day_id
         where charge.student_id = new.student_id
           and day.cycle_key = new.cycle_key
           and charge.state in ('eligible','pending','succeeded')
       )
     ) then
    raise exception using errcode = '23514', message = 'candidate_cap_conflicts_with_final_financial_state';
  end if;
  return new;
end;
$$;

create trigger full_cycle_ceiling_financial_finality_guard
before insert or update on missionaccounts.full_cycle_ceiling
for each row execute function missionaccounts.guard_candidate_cap_against_financial_finality();

revoke execute on function missionaccounts.guard_candidate_cap_against_financial_finality()
from public, anon, authenticated;
grant execute on function missionaccounts.guard_candidate_cap_against_financial_finality()
to service_role;
