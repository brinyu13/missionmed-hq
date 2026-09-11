-- MX-MISSIONACCOUNTS-5401R / DR-226 / DR-227
-- Durable sponsor classification and fail-closed direct-liability guards.
-- This migration does not assign sponsors, rewrite history, or invoke a provider.

alter table missionaccounts.student
  add column sponsor_type text not null default 'DIRECT',
  add column sponsor_name text,
  add column sponsor_updated_at timestamptz,
  add column sponsor_updated_by text,
  add column sponsor_request_id text,
  add constraint student_sponsor_type_check
    check (sponsor_type in ('DIRECT','UCC','MUL')),
  add constraint student_sponsor_name_check
    check (
      (sponsor_type = 'DIRECT' and sponsor_name is null)
      or (sponsor_type in ('UCC','MUL') and sponsor_name = sponsor_type)
    ),
  add constraint student_sponsor_metadata_check
    check (
      (sponsor_type = 'DIRECT' and sponsor_updated_at is null
        and sponsor_updated_by is null and sponsor_request_id is null)
      or (sponsor_type in ('UCC','MUL') and sponsor_updated_at is not null
        and nullif(btrim(sponsor_updated_by), '') is not null
        and sponsor_request_id ~ '^[A-Za-z0-9._:-]{8,200}$')
    );

create unique index student_sponsor_request_once
  on missionaccounts.student(sponsor_request_id)
  where sponsor_request_id is not null;

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
  resolution.decision_id as cluster_decision_id,
  student.sponsor_type,
  student.sponsor_name,
  student.sponsor_updated_at
from missionaccounts.student student
join missionaccounts.identity_student_resolution resolution
  on resolution.source_student_id = student.id
where not exists (
  select 1
  from missionaccounts.zoom_shadow_retirement retirement
  where retirement.student_id = student.id
    and retirement.superseded_by_id is null and retirement.reversed_at is null
);

create function missionaccounts.api_set_student_sponsor(
  p_student_id uuid,
  p_sponsor_type text,
  p_expected_current_sponsor text,
  p_actor_id text,
  p_actor_role text,
  p_reason text,
  p_request_id text
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, missionaccounts
as $$
declare
  student_row missionaccounts.student%rowtype;
  prior_audit missionaccounts.audit_event%rowtype;
  audit_id uuid := gen_random_uuid();
  normalized_sponsor text := upper(btrim(p_sponsor_type));
  normalized_expected text := upper(btrim(p_expected_current_sponsor));
  request_value jsonb;
begin
  if p_student_id is null
     or normalized_sponsor is null or normalized_sponsor not in ('DIRECT','UCC','MUL')
     or normalized_expected is null or normalized_expected not in ('DIRECT','UCC','MUL')
     or p_actor_role not in ('missionaccounts_admin','founder')
     or nullif(btrim(p_actor_id), '') is null
     or p_reason is null or length(btrim(p_reason)) not between 1 and 2000
     or p_request_id is null
     or p_request_id !~ '^[A-Za-z0-9._:-]{8,200}$' then
    raise exception using errcode = '22023', message = 'invalid_sponsor_assignment';
  end if;

  request_value := jsonb_build_object(
    'student_id', p_student_id,
    'from', normalized_expected,
    'to', normalized_sponsor
  );
  perform pg_advisory_xact_lock(hashtextextended(
    'missionaccounts:sponsor-request:' || p_request_id, 0
  ));

  select * into prior_audit
  from missionaccounts.audit_event
  where request_id = p_request_id and kind = 'student.sponsor_assigned';
  if found then
    if prior_audit.to_val is distinct from request_value then
      raise exception using errcode = '23505', message = 'idempotency_key_reuse';
    end if;
    return jsonb_build_object(
      'accepted', true, 'duplicate', true, 'student_id', p_student_id,
      'sponsor_type', normalized_sponsor, 'audit_event_id', prior_audit.id
    );
  end if;

  select * into student_row
  from missionaccounts.student where id = p_student_id for update;
  if not found then
    raise exception using errcode = '23503', message = 'student_not_found';
  end if;
  if student_row.identity_state <> 'verified' then
    raise exception using errcode = '23514', message = 'verified_student_required';
  end if;
  if student_row.sponsor_type <> normalized_expected then
    raise exception using errcode = '40001', message = 'sponsor_state_changed';
  end if;
  if exists (
    select 1
    from missionaccounts.auto_charge_dispatch dispatch
    join missionaccounts.attendance_day day on day.id = dispatch.attendance_day_id
    where day.student_id = p_student_id
      and dispatch.state in ('eligible','claimed','submitted')
  ) or exists (
    select 1 from missionaccounts.manual_cycle_charge charge
    where charge.student_id = p_student_id and charge.state = 'pending'
  ) or exists (
    select 1 from missionaccounts.charge charge
    where charge.student_id = p_student_id and charge.state = 'pending'
  ) then
    raise exception using errcode = '55000', message = 'sponsor_assignment_financial_dispatch_pending';
  end if;

  update missionaccounts.student
  set sponsor_type = normalized_sponsor,
      sponsor_name = case when normalized_sponsor = 'DIRECT' then null else normalized_sponsor end,
      sponsor_updated_at = case when normalized_sponsor = 'DIRECT' then null else now() end,
      sponsor_updated_by = case when normalized_sponsor = 'DIRECT' then null else btrim(p_actor_id) end,
      sponsor_request_id = case when normalized_sponsor = 'DIRECT' then null else p_request_id end,
      updated_at = now()
  where id = p_student_id;

  insert into missionaccounts.audit_event(
    id, actor_id, actor_role, subject_student_id, kind, text,
    from_val, to_val, reason, request_id
  ) values (
    audit_id, btrim(p_actor_id), p_actor_role, p_student_id,
    'student.sponsor_assigned', 'Assigned durable student sponsor',
    jsonb_build_object('sponsor_type', normalized_expected),
    request_value, btrim(p_reason), p_request_id
  );

  return jsonb_build_object(
    'accepted', true, 'duplicate', false, 'student_id', p_student_id,
    'sponsor_type', normalized_sponsor, 'audit_event_id', audit_id
  );
end;
$$;

revoke execute on function missionaccounts.api_set_student_sponsor(uuid,text,text,text,text,text,text)
from public, anon, authenticated;
grant execute on function missionaccounts.api_set_student_sponsor(uuid,text,text,text,text,text,text)
to service_role;

create function missionaccounts.sponsored_direct_liability_guard()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, missionaccounts
as $$
declare
  sponsor text;
begin
  select sponsor_type into sponsor
  from missionaccounts.student where id = new.student_id;
  if sponsor in ('UCC','MUL') then
    if tg_table_name = 'billing_decision' then
      if new.amount_cents <> 0 or lower(new.treatment) <> lower(sponsor) then
        raise exception using errcode = '23514', message = 'sponsored_direct_liability_blocked';
      end if;
    elsif new.amount_cents > 0 then
      raise exception using errcode = '23514', message = 'sponsored_direct_liability_blocked';
    end if;
  end if;
  return new;
end;
$$;

create trigger billing_decision_sponsor_guard
before insert or update of student_id, treatment, amount_cents
on missionaccounts.billing_decision
for each row execute function missionaccounts.sponsored_direct_liability_guard();

create trigger invoice_sponsor_guard
before insert or update of student_id, amount_cents
on missionaccounts.invoice
for each row execute function missionaccounts.sponsored_direct_liability_guard();

create trigger charge_sponsor_guard
before insert or update of student_id, amount_cents
on missionaccounts.charge
for each row execute function missionaccounts.sponsored_direct_liability_guard();

create trigger manual_cycle_charge_sponsor_guard
before insert or update of student_id, amount_cents
on missionaccounts.manual_cycle_charge
for each row execute function missionaccounts.sponsored_direct_liability_guard();

create function missionaccounts.sponsored_auto_dispatch_exclusion()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, missionaccounts
as $$
begin
  if exists (
    select 1
    from missionaccounts.attendance_day day
    join missionaccounts.student student on student.id = day.student_id
    where day.id = new.attendance_day_id
      and student.sponsor_type in ('UCC','MUL')
  ) then
    return null;
  end if;
  return new;
end;
$$;

create trigger auto_charge_dispatch_sponsor_exclusion
before insert on missionaccounts.auto_charge_dispatch
for each row execute function missionaccounts.sponsored_auto_dispatch_exclusion();

comment on column missionaccounts.student.sponsor_type is
  'Durable direct-liability authority. DIRECT remains collectible; UCC and MUL preserve history while student direct liability is zero.';
comment on function missionaccounts.api_set_student_sponsor(uuid,text,text,text,text,text,text) is
  'Service-role-only audited sponsor assignment. Provider-ready population is supplied separately under DR-226/DR-227.';
