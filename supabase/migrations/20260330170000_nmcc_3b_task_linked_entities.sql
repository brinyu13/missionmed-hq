create or replace view command_center.task_queue_v1 as
select
  t.id as task_id,
  t.student_id,
  t.lead_id,
  coalesce(s.full_name, l.full_name, 'Unassigned record') as person_name,
  s.program_tier,
  t.assigned_to,
  t.created_by,
  t.title,
  t.description,
  t.priority,
  t.task_status,
  t.auto_generated,
  t.due_at,
  t.completed_at,
  t.source_system,
  t.source_record_id,
  t.metadata,
  t.created_at,
  t.updated_at
from command_center.tasks t
left join command_center.students s
  on s.id = t.student_id
left join command_center.leads l
  on l.id = t.lead_id;
create or replace function public.mmac_cc_create_task_linked(
  p_student_id uuid default null,
  p_lead_id uuid default null,
  p_title text,
  p_description text default null,
  p_assigned_to text default 'brian',
  p_created_by text default 'brian',
  p_priority integer default 3,
  p_due_at timestamptz default null,
  p_source_system text default 'hq',
  p_source_record_id text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, command_center
as $$
declare
  v_task_id uuid;
  v_event_id uuid;
  v_student command_center.students;
  v_lead command_center.leads;
  v_student_id uuid := p_student_id;
  v_lead_id uuid := p_lead_id;
  v_source_system text := coalesce(nullif(trim(p_source_system), ''), 'hq');
  v_metadata jsonb := coalesce(p_metadata, '{}'::jsonb);
begin
  if v_student_id is not null then
    select * into v_student
    from command_center.students
    where id = v_student_id;

    if not found then
      return jsonb_build_object('error', 'student_not_found');
    end if;

    if v_lead_id is null then
      v_lead_id := v_student.originating_lead_id;
    end if;
  end if;

  if v_lead_id is not null then
    select * into v_lead
    from command_center.leads
    where id = v_lead_id;

    if not found then
      return jsonb_build_object('error', 'lead_not_found');
    end if;
  end if;

  if v_student_id is null and v_lead_id is null then
    return jsonb_build_object('error', 'missing_task_anchor');
  end if;

  insert into command_center.tasks (
    student_id,
    lead_id,
    assigned_to,
    created_by,
    title,
    description,
    priority,
    task_status,
    auto_generated,
    due_at,
    source_system,
    source_record_id,
    metadata
  ) values (
    v_student_id,
    v_lead_id,
    p_assigned_to,
    p_created_by,
    p_title,
    p_description,
    p_priority,
    'open',
    false,
    p_due_at,
    v_source_system,
    nullif(trim(p_source_record_id), ''),
    v_metadata
  )
  returning id into v_task_id;

  v_event_id := command_center.append_event(
    'operator.task.created',
    v_source_system,
    'task',
    v_task_id,
    v_lead_id,
    v_student_id,
    'user_action',
    null, null, null, null, null,
    jsonb_build_object(
      'task_id', v_task_id,
      'title', p_title,
      'assigned_to', p_assigned_to,
      'created_by', p_created_by,
      'priority', p_priority,
      'source_record_id', nullif(trim(p_source_record_id), ''),
      'metadata', v_metadata
    ),
    now()
  );

  return (
    select jsonb_build_object(
      'task', row_to_json(tq)::jsonb,
      'event_id', v_event_id
    )
    from command_center.task_queue_v1 tq
    where tq.task_id = v_task_id
  );
end;
$$;
grant execute on function public.mmac_cc_create_task_linked(
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  integer,
  timestamptz,
  text,
  text,
  jsonb
) to service_role;
comment on function public.mmac_cc_create_task_linked(
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  integer,
  timestamptz,
  text,
  text,
  jsonb
)
is 'Create a task anchored to an existing student and/or lead while preserving linked entity metadata for MissionMed HQ.';
