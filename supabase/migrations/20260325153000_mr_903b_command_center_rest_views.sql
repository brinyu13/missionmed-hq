-- ============================================================================
-- MR-903B - MissionMed Command Center REST Views
-- Public PostgREST layer for the internal CRM command view
-- ============================================================================

begin;
DO $$
BEGIN
  RAISE NOTICE 'Skipping this migration locally';
  RETURN;
END $$;
-- EVERYTHING BELOW THIS LINE IS DISABLED
/*
create or replace function public.crm_command_center_display_name(
  full_name text,
  first_name text,
  last_name text,
  email text
)
returns text
language sql
immutable
as $$
  select coalesce(
    nullif(btrim(full_name), ''),
    nullif(btrim(concat_ws(' ', nullif(btrim(first_name), ''), nullif(btrim(last_name), ''))), ''),
    nullif(split_part(coalesce(email, ''), '@', 1), ''),
    'Unknown'
  );
$$;

create or replace function public.crm_command_center_division(
  program_name text,
  program_category text,
  person_metadata jsonb,
  enrollment_metadata jsonb
)
returns text
language sql
immutable
as $$
  select coalesce(
    nullif(btrim(enrollment_metadata ->> 'division'), ''),
    nullif(btrim(person_metadata ->> 'division'), ''),
    nullif(btrim(enrollment_metadata ->> 'program_division'), ''),
    case
      when program_name ilike '%usmle%' then 'USMLE'
      when program_name ilike '%rotation%' or program_name ilike '%usce%' then 'Clinicals'
      when program_name ilike '%residency%' or program_name ilike '%match%' or program_name ilike '%interview%' then 'Mission Residency'
      when program_category = 'rotation' then 'Clinicals'
      when program_category in ('course', 'membership', 'coaching') then 'Education'
      when nullif(btrim(program_name), '') is not null then program_name
      else 'Unassigned'
    end
  );
$$;

create or replace view public.crm_command_center_list as
with ranked_enrollments as (
  select
    e.*,
    row_number() over (
      partition by e.person_id
      order by
        case e.enrollment_status
          when 'active' then 0
          when 'enrolled' then 1
          when 'open' then 2
          when 'completed' then 3
          when 'lost' then 4
          when 'cancelled' then 5
          when 'refunded' then 6
          else 7
        end,
        coalesce(
          e.closed_at,
          e.booked_call_at,
          e.enrollment_date::timestamptz,
          e.expected_start_date::timestamptz,
          e.updated_at,
          e.created_at
        ) desc
    ) as row_priority
  from crm.enrollments e
),
latest_enrollment as (
  select *
  from ranked_enrollments
  where row_priority = 1
),
thread_rollup as (
  select
    t.person_id,
    max(t.last_message_at) as last_message_at,
    count(*)::integer as thread_count,
    coalesce(sum(t.message_count), 0)::integer as total_messages
  from comms.email_threads t
  group by t.person_id
),
note_rollup as (
  select
    n.person_id,
    max(n.noted_at) as last_note_at
  from ops.notes n
  group by n.person_id
)
select
  p.id as person_id,
  le.id as enrollment_id,
  public.crm_command_center_display_name(
    p.full_name,
    p.first_name,
    p.last_name,
    p.email::text
  ) as name,
  p.email::text as email,
  public.crm_command_center_division(
    le.program_name,
    le.program_category,
    p.metadata,
    le.metadata
  ) as division,
  le.pipeline_stage as stage,
  greatest(
    coalesce(tr.last_message_at, '-infinity'::timestamptz),
    coalesce(nr.last_note_at, '-infinity'::timestamptz),
    coalesce(le.updated_at, p.updated_at, p.created_at)
  ) as last_contact,
  coalesce(le.enrollment_status, p.record_status) as status,
  p.person_type,
  p.record_status,
  p.lead_source,
  le.program_name,
  le.program_category,
  coalesce(tr.thread_count, 0) as thread_count,
  coalesce(tr.total_messages, 0) as total_messages,
  p.created_at,
  p.updated_at
from crm.people p
left join latest_enrollment le
  on le.person_id = p.id
left join thread_rollup tr
  on tr.person_id = p.id
left join note_rollup nr
  on nr.person_id = p.id
where p.record_status <> 'archived';

create or replace view public.crm_command_center_notes as
select
  n.id as note_id,
  n.person_id,
  n.enrollment_id,
  n.thread_id,
  n.note_type,
  n.visibility,
  n.body,
  n.noted_at,
  n.source_system,
  public.crm_command_center_display_name(
    author.full_name,
    author.first_name,
    author.last_name,
    author.email::text
  ) as author_name,
  author.email::text as author_email
from ops.notes n
left join crm.people author
  on author.id = n.author_person_id;

create or replace view public.crm_command_center_messages as
select
  m.id as message_id,
  m.person_id,
  m.thread_id,
  m.direction,
  m.message_status,
  m.from_email::text as from_email,
  m.to_emails,
  m.cc_emails,
  coalesce(m.subject, t.subject) as subject,
  m.snippet,
  m.body_text,
  m.sent_at,
  t.thread_status,
  public.crm_command_center_display_name(
    owner.full_name,
    owner.first_name,
    owner.last_name,
    owner.email::text
  ) as owner_name
from comms.email_messages m
left join comms.email_threads t
  on t.id = m.thread_id
left join crm.people owner
  on owner.id = m.owner_person_id;

create or replace view public.crm_command_center_threads as
with latest_message as (
  select distinct on (m.thread_id)
    m.thread_id,
    m.direction as last_direction,
    m.snippet as last_snippet,
    m.sent_at as last_message_sent_at
  from comms.email_messages m
  order by m.thread_id, m.sent_at desc
)
select
  t.id as thread_id,
  t.person_id,
  public.crm_command_center_display_name(
    owner.full_name,
    owner.first_name,
    owner.last_name,
    owner.email::text
  ) as owner_name,
  t.subject,
  t.thread_status,
  t.last_message_at,
  t.last_inbound_at,
  t.last_outbound_at,
  t.message_count,
  lm.last_direction,
  lm.last_snippet
from comms.email_threads t
left join latest_message lm
  on lm.thread_id = t.id
left join crm.people owner
  on owner.id = t.owner_person_id;

create or replace view public.crm_command_center_stage_history as
select
  h.id as stage_event_id,
  h.person_id,
  h.enrollment_id,
  h.from_stage,
  h.to_stage,
  h.change_reason,
  h.changed_at,
  public.crm_command_center_display_name(
    changer.full_name,
    changer.first_name,
    changer.last_name,
    changer.email::text
  ) as changed_by_name
from crm.pipeline_stage_history h
left join crm.people changer
  on changer.id = h.changed_by_person_id;

create or replace view public.crm_command_center_enrollments as
select
  e.id as enrollment_id,
  e.person_id,
  public.crm_command_center_display_name(
    owner.full_name,
    owner.first_name,
    owner.last_name,
    owner.email::text
  ) as owner_name,
  e.program_name,
  e.program_category,
  public.crm_command_center_division(
    e.program_name,
    e.program_category,
    p.metadata,
    e.metadata
  ) as division,
  e.pipeline_stage,
  e.enrollment_status,
  e.booked_call_at,
  e.enrollment_date,
  e.expected_start_date,
  e.expected_end_date,
  e.closed_at,
  e.amount_quoted,
  e.amount_collected,
  e.notes as enrollment_notes,
  sp.match_cycle_year,
  sp.medical_school,
  sp.graduation_year,
  sp.candidate_track,
  sp.visa_status,
  sp.ecfmg_status,
  sp.specialty_interest,
  e.created_at,
  e.updated_at
from crm.enrollments e
join crm.people p
  on p.id = e.person_id
left join crm.student_profiles sp
  on sp.person_id = e.person_id
left join crm.people owner
  on owner.id = e.owner_person_id;

grant execute on function public.crm_command_center_display_name(text, text, text, text)
to anon, authenticated, service_role;

grant execute on function public.crm_command_center_division(text, text, jsonb, jsonb)
to anon, authenticated, service_role;

grant select on table
  public.crm_command_center_list,
  public.crm_command_center_notes,
  public.crm_command_center_messages,
  public.crm_command_center_threads,
  public.crm_command_center_stage_history,
  public.crm_command_center_enrollments
to anon, authenticated, service_role;

commit;
*/;
