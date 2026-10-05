-- DR-363 direct Founder policy: only applicable payment setup and billing authorization gate completion.
BEGIN;
create or replace function missionaccounts.onboarding_state_for_student(p_student_id uuid)
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
  optional_missing_steps text[] := array[]::text[];
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
  if not account_ready then
    raise exception using errcode = '42501', message = 'onboarding_canonical_identity_required';
  end if;

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
  if not profile_ready then optional_missing_steps := array_append(optional_missing_steps, 'PROFILE'); end if;
  if not contact_ready then optional_missing_steps := array_append(optional_missing_steps, 'CONTACT'); end if;
  if not exam_plan_ready then optional_missing_steps := array_append(optional_missing_steps, 'EXAM_PLAN'); end if;
  if direct_liability and not payment_ready then missing_steps := array_append(missing_steps, 'PAYMENT_METHOD'); end if;
  if direct_liability and not consent_ready then missing_steps := array_append(missing_steps, 'BILLING_CONSENT'); end if;

  completion_state := case
    when cardinality(missing_steps) = 0 then 'COMPLETE'
    when profile_row.student_id is null and not payment_ready and not consent_ready then 'NOT_STARTED'
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
    'optional_missing_steps', to_jsonb(optional_missing_steps),
    'required_steps', case when direct_liability then '["PAYMENT_METHOD","BILLING_CONSENT"]'::jsonb else '[]'::jsonb end,
    'completion_contract_version', 'examprep-onboarding-payment-readiness-2026-10-02-v1',
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

revoke all on function missionaccounts.onboarding_state_for_student(uuid) from public,anon,authenticated;
grant execute on function missionaccounts.onboarding_state_for_student(uuid) to service_role;
COMMIT;
