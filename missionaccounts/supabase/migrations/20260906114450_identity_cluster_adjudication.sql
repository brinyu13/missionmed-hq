-- MissionAccounts identity review remains an interpretation layer. Source
-- aliases and source attendance events are never rewritten by an adjudication.

alter table missionaccounts.identity_decision
  add column member_student_ids uuid[];

update missionaccounts.identity_decision decision
set member_student_ids = snapshot.student_ids
from (
  select member.cluster_ref, array_agg(distinct alias.student_id order by alias.student_id) as student_ids
  from missionaccounts.identity_cluster_member member
  join missionaccounts.identity_alias alias on alias.id = member.identity_alias_id
  where alias.student_id is not null
  group by member.cluster_ref
) snapshot
where snapshot.cluster_ref = decision.cluster_ref;

alter table missionaccounts.identity_decision
  alter column member_student_ids set default '{}'::uuid[],
  alter column member_student_ids set not null;

create table missionaccounts.identity_grace_preservation (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references missionaccounts.student(id),
  source_grace_window_id uuid not null references missionaccounts.grace_window(id),
  identity_decision_id uuid not null references missionaccounts.identity_decision(id),
  from_on date not null,
  to_on date not null,
  created_at timestamptz not null default now(),
  check (to_on >= from_on),
  unique (student_id, source_grace_window_id, identity_decision_id)
);

alter table missionaccounts.identity_grace_preservation enable row level security;
alter table missionaccounts.identity_grace_preservation force row level security;

create view missionaccounts.grace_window_projection
with (security_invoker = true)
as
select
  grace.id,
  grace.student_id,
  grace.exam_plan_id,
  grace.from_on,
  grace.to_on,
  grace.closed_reason,
  grace.created_at
from missionaccounts.grace_window grace
union all
select
  preserved.id,
  preserved.student_id,
  null::uuid as exam_plan_id,
  preserved.from_on,
  preserved.to_on,
  'identity_split_copy'::text as closed_reason,
  preserved.created_at
from missionaccounts.identity_grace_preservation preserved;

create view missionaccounts.identity_student_resolution
with (security_invoker = true)
as
select
  student_row.id as source_student_id,
  coalesce(current_merge.canonical_student_id, student_row.id) as canonical_student_id,
  current_merge.cluster_ref,
  current_merge.decision_id,
  coalesce(current_merge.canonical_student_id <> student_row.id, false) as absorbed
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
) current_merge on true;

create view missionaccounts.identity_alias_projection
with (security_invoker = true)
as
select
  alias.id,
  coalesce(resolution.canonical_student_id, alias.student_id) as student_id,
  alias.student_id as source_student_id,
  alias.source_key,
  alias.display_value,
  alias.relationship_state,
  alias.confidence,
  alias.superseded_by_id,
  alias.created_at
from missionaccounts.identity_alias alias
left join missionaccounts.identity_student_resolution resolution
  on resolution.source_student_id = alias.student_id;

create view missionaccounts.student_identity_projection
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
  resolution.absorbed
from missionaccounts.student student
join missionaccounts.identity_student_resolution resolution
  on resolution.source_student_id = student.id;

create or replace view missionaccounts.attendance_event_projection
with (security_invoker = true)
as
select
  attendance.id,
  resolution.canonical_student_id as student_id,
  attendance.session_id,
  attendance.cycle_key,
  attendance.local_day,
  attendance.step,
  attendance.interpretation_state,
  attendance.superseded_by_id,
  case
    when count(event_source.source_row_id) = 0 then null
    else round(sum(coalesce(source_row.duration_seconds, 0))::numeric / 60)::integer
  end as duration_minutes,
  count(event_source.source_row_id)::integer as source_row_count,
  min(source_row.display_name) as source_display_name,
  attendance.student_id as source_student_id
from missionaccounts.attendance_event attendance
join missionaccounts.identity_student_resolution resolution
  on resolution.source_student_id = attendance.student_id
left join missionaccounts.attendance_event_source_row event_source
  on event_source.attendance_event_id = attendance.id
left join missionaccounts.attendance_source_row source_row
  on source_row.id = event_source.source_row_id
group by attendance.id, resolution.canonical_student_id;

create view missionaccounts.full_cycle_ceiling_projection
with (security_invoker = true)
as
select
  ceiling.id,
  resolution.canonical_student_id as student_id,
  ceiling.student_id as source_student_id,
  ceiling.cycle_key,
  ceiling.status,
  ceiling.ceiling_cents,
  ceiling.basis,
  ceiling.request_id,
  ceiling.decided_by,
  ceiling.decided_at,
  ceiling.superseded_by_id,
  ceiling.created_at
from missionaccounts.full_cycle_ceiling ceiling
join missionaccounts.identity_student_resolution resolution
  on resolution.source_student_id = ceiling.student_id;

create function missionaccounts.guard_adjudicated_identity_evidence()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, missionaccounts
as $$
declare
  affected_cluster_ref text;
  affected_alias_id uuid;
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
    affected_alias_id := old.id;
    if exists (
      select 1
      from missionaccounts.identity_cluster_member member
      join missionaccounts.identity_decision decision
        on decision.cluster_ref = member.cluster_ref
       and decision.superseded_by_id is null
       and decision.decision in ('same','different')
      where member.identity_alias_id = affected_alias_id
    ) then
      raise exception using errcode = '23514', message = 'adjudicated_identity_alias_is_immutable';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger identity_cluster_member_adjudicated_immutable
before insert or update or delete on missionaccounts.identity_cluster_member
for each row execute function missionaccounts.guard_adjudicated_identity_evidence();

create trigger identity_alias_adjudicated_immutable
before update or delete on missionaccounts.identity_alias
for each row execute function missionaccounts.guard_adjudicated_identity_evidence();

revoke execute on function missionaccounts.guard_adjudicated_identity_evidence()
from public, anon, authenticated;
grant execute on function missionaccounts.guard_adjudicated_identity_evidence()
to service_role;

create or replace function missionaccounts.recompute_student_attendance(
  p_student_id uuid,
  p_trigger text
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, extensions, missionaccounts
as $$
declare
  student_row missionaccounts.student%rowtype;
  run_id uuid := gen_random_uuid();
  new_day_id uuid;
  day_record record;
  source_digest text;
  day_kind text;
  day_comp_index integer;
  active_comp_count integer := 0;
  created_days integer := 0;
  review_days integer := 0;
  billable_days integer := 0;
  comped_days integer := 0;
  grace_days integer := 0;
  stale_decisions integer := 0;
  component_size integer := 0;
begin
  if p_student_id is null or nullif(btrim(p_trigger), '') is null then
    raise exception using errcode = '22023', message = 'attendance_recompute_student_and_trigger_required';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('missionaccounts:attendance:' || p_student_id::text, 0));
  select * into student_row from missionaccounts.student where id = p_student_id for update;
  if not found then raise exception using errcode = '23503', message = 'student_not_found'; end if;
  if exists (
    select 1 from missionaccounts.identity_student_resolution
    where source_student_id = p_student_id and canonical_student_id <> p_student_id
  ) then
    raise exception using errcode = '22023', message = 'attendance_recompute_requires_canonical_student';
  end if;

  select count(*)::integer into component_size
  from missionaccounts.identity_student_resolution
  where canonical_student_id = p_student_id;

  select encode(digest(
    p_student_id::text || '|' || p_trigger || '|' || student_row.identity_state || '|' || student_row.comp_days_allowance::text || '|' ||
    coalesce((
      select string_agg(attendance.id::text || ':' || attendance.interpretation_state, ',' order by attendance.id)
      from missionaccounts.attendance_event attendance
      join missionaccounts.identity_student_resolution resolution on resolution.source_student_id = attendance.student_id
      where resolution.canonical_student_id = p_student_id and attendance.superseded_by_id is null
    ), '') || '|' ||
    coalesce((
      select string_agg(correction.id::text || ':' || correction.type || ':' || coalesce(correction.reverts_id::text, '') || ':' || coalesce(correction.reverted_by_id::text, ''), ',' order by correction.created_at, correction.id)
      from missionaccounts.attendance_correction correction
      join missionaccounts.identity_student_resolution resolution on resolution.source_student_id = correction.student_id
      where resolution.canonical_student_id = p_student_id
    ), '') || '|' ||
    coalesce((
      select string_agg(grace.id::text || ':' || grace.from_on::text || ':' || coalesce(grace.to_on::text, ''), ',' order by grace.from_on, grace.id)
      from missionaccounts.grace_window_projection grace
      join missionaccounts.identity_student_resolution resolution on resolution.source_student_id = grace.student_id
      where resolution.canonical_student_id = p_student_id
    ), ''),
    'sha256'
  ), 'hex') into source_digest;

  insert into missionaccounts.engine_run(id, engine_version, source_digest, state, controls)
  values (
    run_id, 'missionaccounts-billing-v2-identity', source_digest, 'running',
    jsonb_build_object('trigger', p_trigger, 'student_id', p_student_id, 'identity_component_size', component_size)
  );

  update missionaccounts.attendance_day day
  set superseded_at = now()
  where day.superseded_at is null
    and day.student_id in (
      select source_student_id from missionaccounts.identity_student_resolution
      where canonical_student_id = p_student_id
    );

  select count(*)::integer into active_comp_count
  from missionaccounts.comp_day_consumption
  where student_id = p_student_id and released_by_change_id is null;

  for day_record in
    with component_students as (
      select source_student_id
      from missionaccounts.identity_student_resolution
      where canonical_student_id = p_student_id
    ), latest_effect as (
      select distinct on (correction.attendance_event_id)
        correction.attendance_event_id,
        correction.type
      from missionaccounts.attendance_correction correction
      where correction.student_id in (select source_student_id from component_students)
        and correction.attendance_event_id is not null
        and correction.type in ('add','remove')
        and correction.reverted_by_id is null
        and not exists (
          select 1 from missionaccounts.attendance_correction reversing
          where reversing.reverts_id = correction.id
        )
      order by correction.attendance_event_id, correction.created_at desc, correction.id desc
    ), interpreted as (
      select
        attendance.id,
        attendance.cycle_key,
        attendance.local_day,
        attendance.interpretation_state
      from missionaccounts.attendance_event attendance
      join missionaccounts.session session on session.id = attendance.session_id
      left join latest_effect effect on effect.attendance_event_id = attendance.id
      where attendance.student_id in (select source_student_id from component_students)
        and attendance.superseded_by_id is null
        and session.superseded_by_id is null
        and session.state = 'confirmed'
        and effect.type is distinct from 'remove'
        and attendance.interpretation_state in ('effective','needs_review')
    )
    select
      local_day as day,
      min(cycle_key) as cycle_key,
      count(distinct cycle_key) as cycle_count,
      bool_or(interpretation_state = 'needs_review') as event_needs_review,
      array_agg(id order by id) as event_ids
    from interpreted
    group by local_day
    order by local_day
  loop
    if day_record.cycle_count <> 1 then
      raise exception using errcode = '22023', message = 'attendance_day_crosses_cycle_boundary';
    end if;
    day_kind := 'billable';
    day_comp_index := null;
    if student_row.identity_state <> 'verified' or day_record.event_needs_review then
      day_kind := 'needs_review';
    else
      select comp_index into day_comp_index
      from missionaccounts.comp_day_consumption
      where student_id = p_student_id and day = day_record.day and released_by_change_id is null;
      if found then
        day_kind := 'comped';
      elsif exists (
        select 1
        from missionaccounts.grace_window_projection grace
        join missionaccounts.identity_student_resolution resolution on resolution.source_student_id = grace.student_id
        where resolution.canonical_student_id = p_student_id
          and day_record.day > grace.from_on
          and (grace.to_on is null or day_record.day <= grace.to_on)
      ) then
        day_kind := 'grace';
      elsif active_comp_count < student_row.comp_days_allowance then
        active_comp_count := active_comp_count + 1;
        day_comp_index := active_comp_count;
        day_kind := 'comped';
        insert into missionaccounts.comp_day_consumption(student_id, day, comp_index, source_change_id)
        values (
          p_student_id,
          day_record.day,
          day_comp_index,
          (select id from missionaccounts.comp_allowance_change where student_id = p_student_id order by created_at desc, id desc limit 1)
        ) on conflict (student_id, day) do update
          set comp_index = excluded.comp_index,
              source_change_id = excluded.source_change_id,
              released_by_change_id = null;
      end if;
    end if;

    insert into missionaccounts.attendance_day(
      engine_run_id, student_id, cycle_key, day, kind, comp_index,
      same_day_multiple_events, engine_version, source_digest
    ) values (
      run_id, p_student_id, day_record.cycle_key, day_record.day, day_kind, day_comp_index,
      cardinality(day_record.event_ids) > 1, 'missionaccounts-billing-v2-identity', source_digest
    ) returning id into new_day_id;
    insert into missionaccounts.attendance_day_event(attendance_day_id, attendance_event_id)
    select new_day_id, event_id from unnest(day_record.event_ids) as event_id;

    created_days := created_days + 1;
    if day_kind = 'needs_review' then review_days := review_days + 1;
    elsif day_kind = 'billable' then billable_days := billable_days + 1;
    elsif day_kind = 'comped' then comped_days := comped_days + 1;
    elsif day_kind = 'grace' then grace_days := grace_days + 1;
    end if;
  end loop;

  update missionaccounts.billing_decision decision
  set state = 'stale'
  where decision.superseded_by_id is null
    and decision.state = 'approved'
    and decision.student_id in (
      select source_student_id from missionaccounts.identity_student_resolution
      where canonical_student_id = p_student_id
    );
  get diagnostics stale_decisions = row_count;
  update missionaccounts.invoice invoice
  set state = 'void'
  where invoice.student_id in (
      select source_student_id from missionaccounts.identity_student_resolution
      where canonical_student_id = p_student_id
    )
    and invoice.state in ('draft','ready')
    and exists (
      select 1 from missionaccounts.billing_decision decision
      where decision.id = invoice.decision_id and decision.state = 'stale'
    );

  update missionaccounts.engine_run
  set state = 'succeeded',
      controls = jsonb_build_object(
        'trigger', p_trigger,
        'student_id', p_student_id,
        'identity_component_size', component_size,
        'days', created_days,
        'billable', billable_days,
        'comped', comped_days,
        'grace', grace_days,
        'needs_review', review_days,
        'stale_decisions', stale_decisions
      ),
      finished_at = now()
  where id = run_id;

  return jsonb_build_object(
    'engine_run_id', run_id,
    'identity_component_size', component_size,
    'days', created_days,
    'billable', billable_days,
    'comped', comped_days,
    'grace', grace_days,
    'needs_review', review_days,
    'stale_decisions', stale_decisions
  );
end;
$$;

create function missionaccounts.api_decide_identity_cluster(
  p_cluster_ref text,
  p_decision text,
  p_canonical_student_id uuid,
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
  cluster_row missionaccounts.identity_cluster%rowtype;
  prior_decision missionaccounts.identity_decision%rowtype;
  existing_decision missionaccounts.identity_decision%rowtype;
  new_decision missionaccounts.identity_decision%rowtype;
  cluster_member_student_ids uuid[];
  new_decision_id uuid := gen_random_uuid();
  audit_id uuid;
  copied_grace_windows integer := 0;
  propagated_cap_holds integer := 0;
  recomputes jsonb := '[]'::jsonb;
  member_student_id uuid;
  recomputed jsonb;
  cap_cycle record;
  current_cap missionaccounts.full_cycle_ceiling%rowtype;
  new_cap_id uuid;
begin
  if p_actor_role not in ('missionaccounts_admin','founder') then
    raise exception using errcode = '42501', message = 'identity_decision_admin_required';
  end if;
  if p_decision not in ('same','different','unsure')
     or nullif(btrim(p_cluster_ref), '') is null
     or p_today is null
     or nullif(btrim(p_note), '') is null
     or nullif(btrim(p_actor_id), '') is null
     or nullif(btrim(p_request_id), '') is null then
    raise exception using errcode = '22023', message = 'identity_decision_fields_invalid';
  end if;

  -- Serialize retries before the first lookup so two concurrent deliveries of
  -- the same idempotency key resolve to one decision plus one duplicate read,
  -- never a unique-constraint race.
  perform pg_advisory_xact_lock(hashtextextended('missionaccounts:identity:request:' || p_request_id, 0));
  select * into existing_decision
  from missionaccounts.identity_decision
  where request_id = p_request_id;
  if found then
    if existing_decision.cluster_ref <> p_cluster_ref
       or existing_decision.decision <> p_decision
       or existing_decision.canonical_student_id is distinct from p_canonical_student_id
       or existing_decision.note is distinct from p_note
       or existing_decision.decided_by <> p_actor_id then
      raise exception using errcode = '23505', message = 'idempotency_key_reuse';
    end if;
    select id into audit_id from missionaccounts.audit_event
    where request_id = p_request_id and kind = 'identity_cluster.decided';
    return jsonb_build_object(
      'accepted', true,
      'decision', to_jsonb(existing_decision),
      'cluster_state', (select state from missionaccounts.identity_cluster where ref = p_cluster_ref),
      'audit_event_id', audit_id,
      'duplicate', true
    );
  end if;

  perform pg_advisory_xact_lock(hashtextextended('missionaccounts:identity:' || p_cluster_ref, 0));
  select * into cluster_row
  from missionaccounts.identity_cluster
  where ref = p_cluster_ref
  for update;
  if not found then raise exception using errcode = '23503', message = 'identity_cluster_not_found'; end if;

  select array_agg(distinct alias.student_id order by alias.student_id)
  into cluster_member_student_ids
  from missionaccounts.identity_cluster_member member
  join missionaccounts.identity_alias alias on alias.id = member.identity_alias_id
  where member.cluster_ref = p_cluster_ref and alias.student_id is not null;
  if coalesce(cardinality(cluster_member_student_ids), 0) < 2 then
    raise exception using errcode = '22023', message = 'identity_cluster_requires_two_linked_students';
  end if;
  if p_decision = 'same' and not (p_canonical_student_id = any(cluster_member_student_ids)) then
    raise exception using errcode = '22023', message = 'identity_canonical_student_must_be_cluster_member';
  end if;
  if p_decision <> 'same' and p_canonical_student_id is not null then
    raise exception using errcode = '22023', message = 'identity_canonical_student_only_for_same';
  end if;

  select * into prior_decision
  from missionaccounts.identity_decision
  where cluster_ref = p_cluster_ref and superseded_by_id is null
  for update;

  if exists (
    select 1
    from missionaccounts.identity_decision decision
    where decision.superseded_by_id is null
      and decision.decision = 'same'
      and decision.cluster_ref <> p_cluster_ref
      and decision.member_student_ids && cluster_member_student_ids
  ) then
    raise exception using errcode = '23505', message = 'identity_student_has_another_active_merge';
  end if;

  if (p_decision = 'same' or prior_decision.decision = 'same') and exists (
    select 1
    from missionaccounts.student student
    where student.id = any(cluster_member_student_ids)
      and (
        exists (select 1 from missionaccounts.charge charge where charge.student_id = student.id)
        or exists (select 1 from missionaccounts.invoice invoice where invoice.student_id = student.id and invoice.state in ('sent','paid'))
      )
  ) then
    raise exception using errcode = '23514', message = 'identity_transition_requires_financial_finality_review';
  end if;

  if (p_decision = 'same' or prior_decision.decision = 'same') and exists (
    select 1
    from missionaccounts.comp_day_consumption consumption
    where consumption.student_id = any(cluster_member_student_ids)
      and consumption.released_by_change_id is null
  ) then
    raise exception using errcode = '23514', message = 'identity_transition_requires_comp_day_review';
  end if;

  if p_decision = 'same' and (
    select count(distinct student.comp_days_allowance)
    from missionaccounts.student student
    where student.id = any(cluster_member_student_ids)
  ) > 1 then
    raise exception using errcode = '23514', message = 'identity_merge_requires_comp_allowance_alignment';
  end if;

  if p_decision = 'same' and exists (
    select 1 from missionaccounts.student student
    where student.id = any(cluster_member_student_ids)
      and student.id <> p_canonical_student_id
      and (
        student.matrix_user_ref is not null
        or exists (select 1 from missionaccounts.stripe_customer_private customer where customer.student_id = student.id)
        or exists (select 1 from missionaccounts.payment_method_private method where method.student_id = student.id)
        or exists (select 1 from missionaccounts.billing_consent consent where consent.student_id = student.id)
        or exists (select 1 from missionaccounts.exam_plan plan where plan.student_id = student.id and plan.superseded_by_id is null and plan.withdrawn_at is null)
      )
  ) then
    raise exception using errcode = '23514', message = 'identity_merge_requires_financial_or_account_review';
  end if;

  if prior_decision.id is null then
    insert into missionaccounts.identity_decision(
      id, cluster_ref, decision, canonical_student_id, member_student_ids, note, decided_by, request_id
    ) values (
      new_decision_id, p_cluster_ref, p_decision,
      case when p_decision = 'same' then p_canonical_student_id else null end,
      cluster_member_student_ids, p_note, p_actor_id, p_request_id
    ) returning * into new_decision;
  else
    insert into missionaccounts.identity_decision(
      id, cluster_ref, decision, canonical_student_id, member_student_ids, note, decided_by, request_id, superseded_by_id
    ) values (
      new_decision_id, p_cluster_ref, p_decision,
      case when p_decision = 'same' then p_canonical_student_id else null end,
      cluster_member_student_ids, p_note, p_actor_id, p_request_id, prior_decision.id
    );
    update missionaccounts.identity_decision
    set superseded_by_id = new_decision_id
    where id = prior_decision.id;
    update missionaccounts.identity_decision
    set superseded_by_id = null
    where id = new_decision_id
    returning * into new_decision;
  end if;

  if prior_decision.id is not null
     and prior_decision.decision = 'same'
     and (p_decision <> 'same' or p_canonical_student_id <> prior_decision.canonical_student_id) then
    update missionaccounts.grace_window
    set to_on = greatest(from_on, p_today),
        closed_reason = 'identity_split',
        closed_at = now()
    where student_id = any(cluster_member_student_ids)
      and to_on is null;

    insert into missionaccounts.identity_grace_preservation(
      student_id, source_grace_window_id, identity_decision_id, from_on, to_on
    )
    select
      target.student_id,
      source_window.source_grace_window_id,
      new_decision_id,
      source_window.from_on,
      source_window.to_on
    from unnest(cluster_member_student_ids) as target(student_id)
    cross join (
      select distinct on (source_grace_window_id, from_on, to_on, source_student_id)
        source_grace_window_id,
        source_student_id,
        from_on,
        to_on
      from (
        select grace.id as source_grace_window_id,
          grace.student_id as source_student_id,
          grace.from_on,
          grace.to_on
        from missionaccounts.grace_window grace
        where grace.student_id = any(cluster_member_student_ids)
        union all
        select preserved.source_grace_window_id,
          preserved.student_id,
          preserved.from_on,
          preserved.to_on
        from missionaccounts.identity_grace_preservation preserved
        where preserved.student_id = any(cluster_member_student_ids)
      ) protected_grace
      where to_on is not null
      order by source_grace_window_id, from_on, to_on, source_student_id
    ) source_window
    where target.student_id <> source_window.source_student_id
    on conflict do nothing;
    get diagnostics copied_grace_windows = row_count;
  end if;

  if p_decision = 'same' then
    for cap_cycle in
      select
        ceiling.cycle_key,
        jsonb_agg(
          jsonb_build_object(
            'id', ceiling.id,
            'student_id', ceiling.student_id,
            'status', ceiling.status,
            'basis', ceiling.basis
          ) order by ceiling.created_at, ceiling.id
        ) as sources
      from missionaccounts.full_cycle_ceiling ceiling
      where ceiling.student_id = any(cluster_member_student_ids)
        and ceiling.student_id <> p_canonical_student_id
        and ceiling.superseded_by_id is null
        and ceiling.status in ('candidate','verified')
      group by ceiling.cycle_key
    loop
      select * into current_cap
      from missionaccounts.full_cycle_ceiling
      where student_id = p_canonical_student_id
        and cycle_key = cap_cycle.cycle_key
        and superseded_by_id is null
      for update;
      if current_cap.id is null then
        insert into missionaccounts.full_cycle_ceiling(
          student_id, cycle_key, status, ceiling_cents, basis, request_id
        ) values (
          p_canonical_student_id,
          cap_cycle.cycle_key,
          'candidate',
          30000,
          jsonb_build_object(
            'kind', 'identity_merge_review_hold',
            'identity_decision_id', new_decision_id,
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
          new_cap_id,
          p_canonical_student_id,
          cap_cycle.cycle_key,
          'candidate',
          30000,
          jsonb_build_object(
            'kind', 'identity_merge_review_hold',
            'identity_decision_id', new_decision_id,
            'source_ceilings', cap_cycle.sources,
            'superseded_ceiling_id', current_cap.id,
            'superseded_ceiling_status', current_cap.status
          ),
          p_request_id || ':cap:' || cap_cycle.cycle_key,
          current_cap.id
        );
        update missionaccounts.full_cycle_ceiling
        set superseded_by_id = new_cap_id
        where id = current_cap.id;
        update missionaccounts.full_cycle_ceiling
        set superseded_by_id = null
        where id = new_cap_id;
        propagated_cap_holds := propagated_cap_holds + 1;
      end if;
    end loop;
  end if;

  update missionaccounts.identity_cluster
  set state = case when p_decision = 'unsure' then 'open' else 'resolved' end,
      updated_at = now()
  where ref = p_cluster_ref;

  update missionaccounts.student student
  set identity_state = case
        when p_decision = 'same' and student.id <> p_canonical_student_id then 'needs_review'
        when exists (
          select 1
          from missionaccounts.identity_cluster_member member
          join missionaccounts.identity_cluster open_cluster
            on open_cluster.ref = member.cluster_ref and open_cluster.state = 'open'
          join missionaccounts.identity_alias alias on alias.id = member.identity_alias_id
          where alias.student_id = student.id
        ) then 'needs_review'
        when exists (
          select 1
          from missionaccounts.identity_alias alias
          where alias.student_id = student.id
            and alias.relationship_state = 'device'
            and alias.superseded_by_id is null
        ) then 'needs_review'
        when exists (
          select 1
          from missionaccounts.identity_alias alias
          where alias.student_id = student.id
            and alias.relationship_state = 'candidate'
            and alias.superseded_by_id is null
            and not exists (
              select 1 from missionaccounts.identity_cluster_member member
              where member.identity_alias_id = alias.id
            )
        ) then 'needs_review'
        else 'verified'
      end,
      updated_at = now()
  where student.id = any(cluster_member_student_ids);

  if p_decision = 'same' then
    recomputed := missionaccounts.recompute_student_attendance(
      p_canonical_student_id,
      p_request_id || ':identity-same'
    );
    recomputes := recomputes || jsonb_build_array(recomputed);
  else
    foreach member_student_id in array cluster_member_student_ids loop
      recomputed := missionaccounts.recompute_student_attendance(
        member_student_id,
        p_request_id || ':identity-' || p_decision
      );
      recomputes := recomputes || jsonb_build_array(recomputed);
    end loop;
  end if;

  insert into missionaccounts.audit_event(
    actor_id, actor_role, subject_student_id, kind, text,
    from_val, to_val, reason, request_id
  ) values (
    p_actor_id, p_actor_role,
    case when p_decision = 'same' then p_canonical_student_id else null end,
    'identity_cluster.decided',
    'Identity cluster adjudicated without changing source evidence',
    case when prior_decision.id is null then null else to_jsonb(prior_decision) end,
    jsonb_build_object(
      'decision', to_jsonb(new_decision),
      'member_student_ids', to_jsonb(cluster_member_student_ids),
      'copied_grace_windows', copied_grace_windows,
      'propagated_cap_holds', propagated_cap_holds,
      'attendance_recomputes', recomputes
    ),
    p_note,
    p_request_id
  ) returning id into audit_id;

  return jsonb_build_object(
    'accepted', true,
    'decision', to_jsonb(new_decision),
    'cluster_state', case when p_decision = 'unsure' then 'open' else 'resolved' end,
    'copied_grace_windows', copied_grace_windows,
    'propagated_cap_holds', propagated_cap_holds,
    'attendance_recomputes', recomputes,
    'audit_event_id', audit_id,
    'duplicate', false
  );
end;
$$;

insert into missionaccounts.feature_flag(key, enabled)
values ('identity_review', false)
on conflict (key) do nothing;

revoke all on missionaccounts.identity_student_resolution,
  missionaccounts.student_identity_projection,
  missionaccounts.identity_alias_projection,
  missionaccounts.full_cycle_ceiling_projection,
  missionaccounts.grace_window_projection
from public, anon, authenticated;
grant select on missionaccounts.identity_student_resolution,
  missionaccounts.student_identity_projection,
  missionaccounts.identity_alias_projection,
  missionaccounts.full_cycle_ceiling_projection,
  missionaccounts.grace_window_projection
to service_role;

revoke all on table missionaccounts.identity_grace_preservation
from public, anon, authenticated;
grant select, insert on table missionaccounts.identity_grace_preservation
to service_role;

revoke execute on function missionaccounts.recompute_student_attendance(uuid, text)
from public, anon, authenticated;
grant execute on function missionaccounts.recompute_student_attendance(uuid, text)
to service_role;
revoke execute on function missionaccounts.api_decide_identity_cluster(text, text, uuid, date, text, text, text, text)
from public, anon, authenticated;
grant execute on function missionaccounts.api_decide_identity_cluster(text, text, uuid, date, text, text, text, text)
to service_role;
