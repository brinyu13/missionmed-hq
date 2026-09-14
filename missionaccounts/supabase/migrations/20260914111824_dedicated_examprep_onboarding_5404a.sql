-- Migration: 20260914111824_dedicated_examprep_onboarding_5404a.sql
-- Authority: DR-252 / MX-MISSIONACCOUNTS-5404A
-- Date: 2026-09-14
-- Depends on: 20260911224524_autobilling_contract_closeout_5403b.sql
-- Description: Add a private, canonical-student ExamPrep onboarding profile, server-derived completion, and least-privilege self/admin RPCs.
-- Idempotent: NO

BEGIN;

-- Source-only foundation. This migration sends no message, grants no access,
-- changes no enrollment, consent, billing or dispatch state, and moves no money.

create table missionaccounts.student_onboarding_profile (
  student_id uuid primary key references missionaccounts.student(id),
  preferred_name text,
  school_name text,
  best_contact_method text not null check (best_contact_method in ('email','phone')),
  mailing_line1 text not null,
  mailing_line2 text,
  mailing_city text not null,
  mailing_region text not null,
  mailing_postal_code text not null,
  mailing_country_code text not null default 'US'
    check (mailing_country_code ~ '^[A-Z]{2}$'),
  revision integer not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (preferred_name is null or length(preferred_name) between 1 and 80),
  check (length(school_name) between 2 and 160),
  check (length(mailing_line1) between 3 and 160),
  check (mailing_line2 is null or length(mailing_line2) between 1 and 160),
  check (length(mailing_city) between 2 and 100),
  check (length(mailing_region) between 2 and 100),
  check (length(mailing_postal_code) between 2 and 24)
);

create table missionaccounts.student_onboarding_submission (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references missionaccounts.student(id),
  request_id text not null unique check (request_id ~ '^[A-Za-z0-9._:-]{8,200}$'),
  request_sha256 text not null check (request_sha256 ~ '^[0-9a-f]{64}$'),
  changed_fields text[] not null,
  from_revision integer not null check (from_revision >= 0),
  to_revision integer not null check (to_revision > 0),
  actor_id text not null,
  actor_role text not null check (actor_role = 'student'),
  created_at timestamptz not null default now(),
  check (cardinality(changed_fields) between 1 and 9),
  check (to_revision = from_revision + 1)
);

create index student_onboarding_submission_student_created_idx
  on missionaccounts.student_onboarding_submission(student_id, created_at desc);

create function missionaccounts.onboarding_state_for_student(p_student_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, missionaccounts
as $$
declare
  student_row missionaccounts.student%rowtype;
  resolution_row record;
  profile_row missionaccounts.student_onboarding_profile%rowtype;
  payment_ready boolean;
  consent_ready boolean;
  exam_plan_ready boolean;
  direct_liability boolean;
  account_ready boolean;
  profile_ready boolean;
  contact_ready boolean;
  missing_steps text[] := array[]::text[];
  completion_state text;
begin
  select * into student_row
  from missionaccounts.student
  where id = p_student_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'student_not_found';
  end if;

  select * into resolution_row
  from missionaccounts.identity_student_resolution
  where source_student_id = p_student_id;

  account_ready := student_row.identity_state = 'verified'
    and resolution_row.canonical_student_id = p_student_id
    and coalesce(resolution_row.absorbed, false) = false
    and coalesce(resolution_row.excluded, false) = false;

  select * into profile_row
  from missionaccounts.student_onboarding_profile
  where student_id = p_student_id;

  profile_ready := profile_row.student_id is not null
    and nullif(btrim(profile_row.school_name), '') is not null
    and nullif(btrim(profile_row.best_contact_method), '') is not null
    and nullif(btrim(profile_row.mailing_line1), '') is not null
    and nullif(btrim(profile_row.mailing_city), '') is not null
    and nullif(btrim(profile_row.mailing_region), '') is not null
    and nullif(btrim(profile_row.mailing_postal_code), '') is not null
    and profile_row.mailing_country_code ~ '^[A-Z]{2}$';

  contact_ready := nullif(btrim(student_row.email), '') is not null
    and nullif(btrim(student_row.phone), '') is not null;

  select exists (
    select 1 from missionaccounts.payment_method_private method
    where method.student_id = p_student_id and method.status = 'on_file'
  ) into payment_ready;

  select exists (
    select 1 from missionaccounts.billing_consent consent
    join missionaccounts.billing_terms terms on terms.version = consent.terms_version
    where consent.student_id = p_student_id
      and consent.superseded_by_id is null
      and consent.state = 'authorized'
      and consent.revoked_at is null
      and terms.status = 'approved'
  ) into consent_ready;

  select exists (
    select 1 from missionaccounts.exam_plan plan
    where plan.student_id = p_student_id
      and plan.superseded_by_id is null
      and plan.withdrawn_at is null
  ) into exam_plan_ready;

  direct_liability := coalesce(student_row.sponsor_type, 'DIRECT') = 'DIRECT';

  if not account_ready then missing_steps := array_append(missing_steps, 'ACCOUNT'); end if;
  if not profile_ready then missing_steps := array_append(missing_steps, 'PROFILE'); end if;
  if not contact_ready then missing_steps := array_append(missing_steps, 'CONTACT'); end if;
  if not exam_plan_ready then missing_steps := array_append(missing_steps, 'EXAM_PLAN'); end if;
  if direct_liability and not payment_ready then missing_steps := array_append(missing_steps, 'PAYMENT_METHOD'); end if;
  if direct_liability and not consent_ready then missing_steps := array_append(missing_steps, 'BILLING_CONSENT'); end if;

  completion_state := case
    when cardinality(missing_steps) = 0 then 'COMPLETE'
    when profile_row.student_id is null then 'NOT_STARTED'
    else 'IN_PROGRESS'
  end;

  return jsonb_build_object(
    'student', jsonb_build_object(
      'display_name', student_row.display_name,
      'email', student_row.email,
      'phone', student_row.phone,
      'sponsor_type', student_row.sponsor_type
    ),
    'profile', case when profile_row.student_id is null then null else jsonb_build_object(
      'preferred_name', profile_row.preferred_name,
      'school_name', profile_row.school_name,
      'best_contact_method', profile_row.best_contact_method,
      'mailing_line1', profile_row.mailing_line1,
      'mailing_line2', profile_row.mailing_line2,
      'mailing_city', profile_row.mailing_city,
      'mailing_region', profile_row.mailing_region,
      'mailing_postal_code', profile_row.mailing_postal_code,
      'mailing_country_code', profile_row.mailing_country_code,
      'revision', profile_row.revision
    ) end,
    'status', completion_state,
    'missing_steps', to_jsonb(missing_steps),
    'progress', jsonb_build_object(
      'account', account_ready,
      'profile', profile_ready,
      'contact', contact_ready,
      'exam_plan', exam_plan_ready,
      'payment_method', case when direct_liability then payment_ready else null end,
      'billing_consent', case when direct_liability then consent_ready else null end,
      'recovery_available', true
    ),
    'payment_requirement', case when direct_liability then 'REQUIRED' else 'NOT_APPLICABLE' end,
    'revision', coalesce(profile_row.revision, 0),
    'last_updated_at', profile_row.updated_at,
    'recovery_url', '/my-account/lost-password/'
  );
end;
$$;

create function missionaccounts.api_get_student_onboarding(
  p_student_id uuid,
  p_actor_id text,
  p_actor_role text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, missionaccounts
as $$
begin
  if p_actor_role <> 'student' or p_actor_id <> p_student_id::text then
    raise exception using errcode = '42501', message = 'onboarding_student_subject_mismatch';
  end if;
  return missionaccounts.onboarding_state_for_student(p_student_id);
end;
$$;

create function missionaccounts.api_save_student_onboarding(
  p_student_id uuid,
  p_preferred_name text,
  p_school_name text,
  p_best_contact_method text,
  p_mailing_line1 text,
  p_mailing_line2 text,
  p_mailing_city text,
  p_mailing_region text,
  p_mailing_postal_code text,
  p_mailing_country_code text,
  p_expected_revision integer,
  p_actor_id text,
  p_actor_role text,
  p_request_id text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, missionaccounts, extensions
as $$
declare
  student_row missionaccounts.student%rowtype;
  resolution_row record;
  existing_submission missionaccounts.student_onboarding_submission%rowtype;
  profile_row missionaccounts.student_onboarding_profile%rowtype;
  request_hash text;
  current_revision integer;
  next_revision integer;
  clean_preferred text := nullif(btrim(p_preferred_name), '');
  clean_school text := nullif(btrim(p_school_name), '');
  clean_contact text := lower(btrim(p_best_contact_method));
  clean_line1 text := nullif(btrim(p_mailing_line1), '');
  clean_line2 text := nullif(btrim(p_mailing_line2), '');
  clean_city text := nullif(btrim(p_mailing_city), '');
  clean_region text := nullif(btrim(p_mailing_region), '');
  clean_postal text := nullif(btrim(p_mailing_postal_code), '');
  clean_country text := upper(btrim(p_mailing_country_code));
  changed text[];
begin
  if p_actor_role <> 'student' or p_actor_id <> p_student_id::text then
    raise exception using errcode = '42501', message = 'onboarding_student_subject_mismatch';
  end if;
  if p_request_id is null or p_request_id !~ '^[A-Za-z0-9._:-]{8,200}$' then
    raise exception using errcode = '22023', message = 'onboarding_request_id_invalid';
  end if;
  if p_expected_revision is null or p_expected_revision < 0 then
    raise exception using errcode = '22023', message = 'onboarding_revision_invalid';
  end if;
  if clean_school is null or length(clean_school) not between 2 and 160
     or clean_contact not in ('email','phone')
     or clean_line1 is null or length(clean_line1) not between 3 and 160
     or clean_city is null or length(clean_city) not between 2 and 100
     or clean_region is null or length(clean_region) not between 2 and 100
     or clean_postal is null or length(clean_postal) not between 2 and 24
     or clean_country !~ '^[A-Z]{2}$'
     or (clean_preferred is not null and length(clean_preferred) > 80)
     or (clean_line2 is not null and length(clean_line2) > 160) then
    raise exception using errcode = '22023', message = 'onboarding_profile_invalid';
  end if;

  request_hash := encode(extensions.digest(convert_to(jsonb_build_object(
    'student_id', p_student_id,
    'preferred_name', clean_preferred,
    'school_name', clean_school,
    'best_contact_method', clean_contact,
    'mailing_line1', clean_line1,
    'mailing_line2', clean_line2,
    'mailing_city', clean_city,
    'mailing_region', clean_region,
    'mailing_postal_code', clean_postal,
    'mailing_country_code', clean_country,
    'expected_revision', p_expected_revision
  )::text, 'UTF8'), 'sha256'), 'hex');

  select * into existing_submission
  from missionaccounts.student_onboarding_submission
  where request_id = p_request_id;
  if found then
    if existing_submission.student_id <> p_student_id
       or existing_submission.request_sha256 <> request_hash then
      raise exception using errcode = '23505', message = 'onboarding_idempotency_conflict';
    end if;
    return jsonb_build_object(
      'accepted', true,
      'duplicate', true,
      'onboarding', missionaccounts.onboarding_state_for_student(p_student_id)
    );
  end if;

  select * into student_row
  from missionaccounts.student
  where id = p_student_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'student_not_found';
  end if;
  select * into resolution_row
  from missionaccounts.identity_student_resolution
  where source_student_id = p_student_id;
  if student_row.identity_state <> 'verified'
     or resolution_row.canonical_student_id is distinct from p_student_id
     or coalesce(resolution_row.absorbed, false)
     or coalesce(resolution_row.excluded, false) then
    raise exception using errcode = '42501', message = 'onboarding_canonical_identity_required';
  end if;

  select * into profile_row
  from missionaccounts.student_onboarding_profile
  where student_id = p_student_id
  for update;
  current_revision := coalesce(profile_row.revision, 0);
  if current_revision <> p_expected_revision then
    raise exception using errcode = '40001', message = 'onboarding_revision_conflict';
  end if;
  next_revision := current_revision + 1;

  changed := array_remove(array[
    case when profile_row.student_id is null or profile_row.preferred_name is distinct from clean_preferred then 'preferred_name' end,
    case when profile_row.student_id is null or profile_row.school_name is distinct from clean_school then 'school_name' end,
    case when profile_row.student_id is null or profile_row.best_contact_method is distinct from clean_contact then 'best_contact_method' end,
    case when profile_row.student_id is null or profile_row.mailing_line1 is distinct from clean_line1 then 'mailing_line1' end,
    case when profile_row.student_id is null or profile_row.mailing_line2 is distinct from clean_line2 then 'mailing_line2' end,
    case when profile_row.student_id is null or profile_row.mailing_city is distinct from clean_city then 'mailing_city' end,
    case when profile_row.student_id is null or profile_row.mailing_region is distinct from clean_region then 'mailing_region' end,
    case when profile_row.student_id is null or profile_row.mailing_postal_code is distinct from clean_postal then 'mailing_postal_code' end,
    case when profile_row.student_id is null or profile_row.mailing_country_code is distinct from clean_country then 'mailing_country_code' end
  ], null);
  if cardinality(changed) = 0 then
    changed := array['profile_confirmed']::text[];
  end if;

  insert into missionaccounts.student_onboarding_profile(
    student_id, preferred_name, school_name, best_contact_method,
    mailing_line1, mailing_line2, mailing_city, mailing_region,
    mailing_postal_code, mailing_country_code, revision, updated_at
  ) values (
    p_student_id, clean_preferred, clean_school, clean_contact,
    clean_line1, clean_line2, clean_city, clean_region,
    clean_postal, clean_country, next_revision, clock_timestamp()
  ) on conflict (student_id) do update set
    preferred_name = excluded.preferred_name,
    school_name = excluded.school_name,
    best_contact_method = excluded.best_contact_method,
    mailing_line1 = excluded.mailing_line1,
    mailing_line2 = excluded.mailing_line2,
    mailing_city = excluded.mailing_city,
    mailing_region = excluded.mailing_region,
    mailing_postal_code = excluded.mailing_postal_code,
    mailing_country_code = excluded.mailing_country_code,
    revision = excluded.revision,
    updated_at = excluded.updated_at;

  insert into missionaccounts.student_onboarding_submission(
    student_id, request_id, request_sha256, changed_fields,
    from_revision, to_revision, actor_id, actor_role
  ) values (
    p_student_id, p_request_id, request_hash, changed,
    current_revision, next_revision, p_actor_id, p_actor_role
  );

  insert into missionaccounts.audit_event(
    actor_id, actor_role, subject_student_id, kind, text,
    from_val, to_val, reason, request_id
  ) values (
    p_actor_id, p_actor_role, p_student_id, 'onboarding.profile_saved',
    'Student saved ExamPrep onboarding profile fields',
    jsonb_build_object('revision', current_revision),
    jsonb_build_object('revision', next_revision, 'changed_fields', changed),
    'Student incremental onboarding save', p_request_id
  );

  return jsonb_build_object(
    'accepted', true,
    'duplicate', false,
    'onboarding', missionaccounts.onboarding_state_for_student(p_student_id)
  );
end;
$$;

create function missionaccounts.api_admin_onboarding_queue(
  p_actor_id text,
  p_actor_role text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, missionaccounts
as $$
begin
  if p_actor_role not in ('missionaccounts_admin','founder')
     or nullif(btrim(p_actor_id), '') is null then
    raise exception using errcode = '42501', message = 'onboarding_admin_required';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'student_id', student.id,
      'display_name', student.display_name,
      'preferred_name', derived.value->'profile'->>'preferred_name',
      'status', derived.value->>'status',
      'missing_steps', derived.value->'missing_steps',
      'progress', derived.value->'progress',
      'payment_requirement', derived.value->>'payment_requirement',
      'last_updated_at', derived.value->>'last_updated_at'
    ) order by
      case derived.value->>'status' when 'IN_PROGRESS' then 0 when 'NOT_STARTED' then 1 else 2 end,
      student.display_name,
      student.id)
    from missionaccounts.student student
    join missionaccounts.identity_student_resolution resolution
      on resolution.source_student_id = student.id
    cross join lateral (
      select missionaccounts.onboarding_state_for_student(student.id) as value
    ) derived
    where student.identity_state = 'verified'
      and resolution.canonical_student_id = student.id
      and not resolution.absorbed
      and not resolution.excluded
  ), '[]'::jsonb);
end;
$$;

alter table missionaccounts.student_onboarding_profile enable row level security;
alter table missionaccounts.student_onboarding_profile force row level security;
alter table missionaccounts.student_onboarding_submission enable row level security;
alter table missionaccounts.student_onboarding_submission force row level security;

revoke all on missionaccounts.student_onboarding_profile,
  missionaccounts.student_onboarding_submission
from public, anon, authenticated;
grant all on missionaccounts.student_onboarding_profile,
  missionaccounts.student_onboarding_submission
to service_role;

revoke execute on function missionaccounts.onboarding_state_for_student(uuid)
from public, anon, authenticated;
revoke execute on function missionaccounts.api_get_student_onboarding(uuid, text, text)
from public, anon, authenticated;
revoke execute on function missionaccounts.api_save_student_onboarding(uuid, text, text, text, text, text, text, text, text, text, integer, text, text, text)
from public, anon, authenticated;
revoke execute on function missionaccounts.api_admin_onboarding_queue(text, text)
from public, anon, authenticated;

grant execute on function missionaccounts.api_get_student_onboarding(uuid, text, text)
to service_role;
grant execute on function missionaccounts.api_save_student_onboarding(uuid, text, text, text, text, text, text, text, text, text, integer, text, text, text)
to service_role;
grant execute on function missionaccounts.api_admin_onboarding_queue(text, text)
to service_role;

comment on table missionaccounts.student_onboarding_profile is
  'Private, one-to-one ExamPrep onboarding profile keyed only by canonical MissionAccounts student UUID.';
comment on table missionaccounts.student_onboarding_submission is
  'PII-minimized onboarding save provenance. Field values remain only in the canonical profile; audit records store revisions and field names.';
comment on function missionaccounts.onboarding_state_for_student(uuid) is
  'Server-derived informational onboarding completion. It grants or blocks no access and changes no payment, consent, exam or sponsor state.';

COMMIT;
