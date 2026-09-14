-- Migration: 20260914114700_onboarding_queue_visibility_5404a.sql
-- Authority: DR-254 / MX-MISSIONACCOUNTS-5404A
-- Date: 2026-09-14
-- Depends on: 20260914111824_dedicated_examprep_onboarding_5404a.sql
-- Description: Keep enrolled canonical students visible in the read-only onboarding queue after enrollment freshness expires.
-- Idempotent: YES

BEGIN;

-- This changes onboarding visibility only. Billing eligibility keeps every
-- existing enrollment-freshness check in its separate functions.
create or replace function missionaccounts.api_admin_onboarding_queue(
  p_actor_id text,
  p_actor_role text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, missionaccounts, extensions
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
      'last_seen_at', enrollment.source_observed_at,
      'last_updated_at', derived.value->>'last_updated_at'
    ) order by
      case derived.value->>'status' when 'IN_PROGRESS' then 0 when 'NOT_STARTED' then 1 else 2 end,
      student.display_name,
      student.id)
    from missionaccounts.student student
    join missionaccounts.identity_student_resolution resolution
      on resolution.source_student_id = student.id
    join missionaccounts.program_enrollment_projection enrollment
      on enrollment.student_id = student.id
     and enrollment.program_key = 'examprep'
     and enrollment.provider = 'learndash'
     and enrollment.course_id = 6357
     and enrollment.enrolled
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

revoke all on function missionaccounts.api_admin_onboarding_queue(text,text)
from public, anon, authenticated;
grant execute on function missionaccounts.api_admin_onboarding_queue(text,text)
to service_role;

comment on function missionaccounts.api_admin_onboarding_queue(text,text) is
  'Minimum-necessary admin onboarding queue over enrolled canonical ExamPrep projections. Projection freshness remains a billing concern and does not remove a student from this read-only queue.';

COMMIT;
