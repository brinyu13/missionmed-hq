-- ============================================================================
-- MCC-402 — Supabase Read + Write RPC Functions
-- WordPress REST ↔ Supabase integration surface for MissionMed Command Center.
-- All reads query locked MAC-6 views. All writes follow event-sourcing model.
-- ============================================================================

begin;
-- --------------------------------------------------
-- READ: List students from student_directory_v1
-- Supports search, status filter, and assignee filter.
-- --------------------------------------------------
create or replace function public.mmac_cc_list_students(
  p_search text default null,
  p_status text default null,
  p_assigned_to text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, command_center
as $$
begin
  return coalesce((
    select jsonb_agg(row_to_json(r)::jsonb order by
      case r.risk_level
        when 'critical' then 1
        when 'warning'  then 2
        when 'info'     then 3
        else 4
      end,
      r.last_activity_at desc nulls last
    )
    from (
      select *
      from command_center.student_directory_v1 sd
      where (p_status is null or sd.student_status = p_status)
        and (p_assigned_to is null or sd.assigned_to = p_assigned_to)
        and (p_search is null or (
          sd.full_name ilike '%' || p_search || '%'
          or sd.email::text ilike '%' || p_search || '%'
          or sd.program_tier ilike '%' || p_search || '%'
          or sd.assigned_to ilike '%' || p_search || '%'
        ))
    ) r
  ), '[]'::jsonb);
end;
$$;
-- --------------------------------------------------
-- READ: Full student detail composite.
-- Returns student, profile, tasks, payments, emails,
-- alerts, notes, and timeline in one call.
-- --------------------------------------------------
create or replace function public.mmac_cc_get_student_detail(p_student_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, command_center
as $$
declare
  v_student  jsonb;
  v_profile  jsonb;
  v_tasks    jsonb;
  v_payments jsonb;
  v_emails   jsonb;
  v_alerts   jsonb;
  v_notes    jsonb;
  v_timeline jsonb;
begin
  -- Student directory row (list-level rollups).
  select row_to_json(sd)::jsonb into v_student
  from command_center.student_directory_v1 sd
  where sd.student_id = p_student_id;

  if v_student is null then
    return jsonb_build_object('error', 'student_not_found');
  end if;

  -- Profile row (detail-level: lead source, intake, scoring).
  select row_to_json(sp)::jsonb into v_profile
  from command_center.student_profile_v1 sp
  where sp.student_id = p_student_id;

  -- Tasks (ordered by priority then due date).
  select coalesce(jsonb_agg(
    row_to_json(tq)::jsonb order by tq.priority, tq.due_at nulls last
  ), '[]'::jsonb)
  into v_tasks
  from command_center.task_queue_v1 tq
  where tq.student_id = p_student_id;

  -- Payments (newest first).
  select coalesce(jsonb_agg(
    row_to_json(pf)::jsonb order by pf.payment_at desc
  ), '[]'::jsonb)
  into v_payments
  from command_center.payment_feed_v1 pf
  where pf.student_id = p_student_id;

  -- Email drafts (newest first).
  select coalesce(jsonb_agg(
    row_to_json(eq)::jsonb order by eq.created_at desc
  ), '[]'::jsonb)
  into v_emails
  from command_center.email_queue_v1 eq
  where eq.student_id = p_student_id;

  -- Open / acknowledged alerts (severity-ranked).
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',           a.id,
    'severity',     a.severity,
    'alert_type',   a.alert_type,
    'message',      a.message,
    'alert_status', a.alert_status,
    'created_at',   a.created_at
  ) order by
    case a.severity when 'critical' then 1 when 'warning' then 2 else 3 end,
    a.created_at desc
  ), '[]'::jsonb)
  into v_alerts
  from command_center.alerts a
  where a.student_id = p_student_id
    and a.alert_status in ('open', 'acknowledged');

  -- Notes (pinned first, then newest).
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',         n.id,
    'author',     n.author,
    'note_kind',  n.note_kind,
    'content',    n.content,
    'pinned',     n.pinned,
    'created_at', n.created_at
  ) order by n.pinned desc, n.created_at desc), '[]'::jsonb)
  into v_notes
  from command_center.notes n
  where n.student_id = p_student_id;

  -- Timeline: last 50 events (newest first).
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',            sub.id,
    'event_type',    sub.event_type,
    'source_system', sub.source_system,
    'occurred_at',   sub.occurred_at,
    'payload',       sub.payload
  ) order by sub.occurred_at desc), '[]'::jsonb)
  into v_timeline
  from (
    select id, event_type, source_system, occurred_at, payload
    from command_center.events
    where student_id = p_student_id
    order by occurred_at desc
    limit 50
  ) sub;

  return jsonb_build_object(
    'student',  v_student,
    'profile',  coalesce(v_profile, '{}'::jsonb),
    'tasks',    v_tasks,
    'payments', v_payments,
    'emails',   v_emails,
    'alerts',   v_alerts,
    'notes',    v_notes,
    'timeline', v_timeline
  );
end;
$$;
-- --------------------------------------------------
-- READ: List tasks from task_queue_v1
-- --------------------------------------------------
create or replace function public.mmac_cc_list_tasks(
  p_student_id  uuid default null,
  p_status      text default null,
  p_assigned_to text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, command_center
as $$
begin
  return coalesce((
    select jsonb_agg(
      row_to_json(tq)::jsonb order by tq.priority, tq.due_at nulls last
    )
    from command_center.task_queue_v1 tq
    where (p_student_id is null  or tq.student_id  = p_student_id)
      and (p_status is null      or tq.task_status  = p_status)
      and (p_assigned_to is null or tq.assigned_to  = p_assigned_to)
  ), '[]'::jsonb);
end;
$$;
-- --------------------------------------------------
-- READ: List payments from payment_feed_v1
-- --------------------------------------------------
create or replace function public.mmac_cc_list_payments(
  p_student_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, command_center
as $$
begin
  return coalesce((
    select jsonb_agg(
      row_to_json(pf)::jsonb order by pf.payment_at desc
    )
    from command_center.payment_feed_v1 pf
    where p_student_id is null or pf.student_id = p_student_id
  ), '[]'::jsonb);
end;
$$;
-- --------------------------------------------------
-- READ: List email drafts from email_queue_v1
-- --------------------------------------------------
create or replace function public.mmac_cc_list_emails(
  p_student_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, command_center
as $$
begin
  return coalesce((
    select jsonb_agg(
      row_to_json(eq)::jsonb order by eq.created_at desc
    )
    from command_center.email_queue_v1 eq
    where p_student_id is null or eq.student_id = p_student_id
  ), '[]'::jsonb);
end;
$$;
-- --------------------------------------------------
-- WRITE: Update an existing task.
-- Validates task exists, applies changes, appends
-- an operator event, returns updated view row.
-- --------------------------------------------------
create or replace function public.mmac_cc_update_task(
  p_task_id     uuid,
  p_task_status text    default null,
  p_assigned_to text    default null,
  p_priority    integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, command_center
as $$
declare
  v_task     command_center.tasks;
  v_event_id uuid;
  v_changes  jsonb := '{}'::jsonb;
begin
  select * into v_task from command_center.tasks where id = p_task_id;
  if not found then
    return jsonb_build_object('error', 'task_not_found');
  end if;

  -- Build diff payload for the event log.
  if p_task_status is not null and p_task_status <> v_task.task_status then
    v_changes := v_changes || jsonb_build_object(
      'task_status', jsonb_build_object('from', v_task.task_status, 'to', p_task_status)
    );
  end if;
  if p_assigned_to is not null and p_assigned_to <> v_task.assigned_to then
    v_changes := v_changes || jsonb_build_object(
      'assigned_to', jsonb_build_object('from', v_task.assigned_to, 'to', p_assigned_to)
    );
  end if;
  if p_priority is not null and p_priority <> v_task.priority then
    v_changes := v_changes || jsonb_build_object(
      'priority', jsonb_build_object('from', v_task.priority, 'to', p_priority)
    );
  end if;

  -- Apply mutation.
  update command_center.tasks
  set
    task_status  = coalesce(p_task_status, task_status),
    assigned_to  = coalesce(p_assigned_to, assigned_to),
    priority     = coalesce(p_priority, priority),
    completed_at = case
      when coalesce(p_task_status, task_status) in ('complete', 'verified', 'cancelled')
           and completed_at is null
      then now()
      else completed_at
    end,
    updated_at = now()
  where id = p_task_id
  returning * into v_task;

  -- Append event (event-sourcing write path).
  v_event_id := command_center.append_event(
    'operator.task.updated',
    'wordpress',
    'task',
    p_task_id,
    v_task.lead_id,
    v_task.student_id,
    'user_action',
    null, null, null, null, null,
    jsonb_build_object('task_id', p_task_id, 'changes', v_changes),
    now()
  );

  -- Return the refreshed view row.
  return (
    select jsonb_build_object(
      'task',     row_to_json(tq)::jsonb,
      'event_id', v_event_id
    )
    from command_center.task_queue_v1 tq
    where tq.task_id = p_task_id
  );
end;
$$;
-- --------------------------------------------------
-- WRITE: Create a new operator task.
-- Inserts row + appends event. Returns view row.
-- --------------------------------------------------
create or replace function public.mmac_cc_create_task(
  p_student_id  uuid,
  p_title       text,
  p_description text        default null,
  p_assigned_to text        default 'brian',
  p_created_by  text        default 'brian',
  p_priority    integer     default 3,
  p_due_at      timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, command_center
as $$
declare
  v_task_id  uuid;
  v_event_id uuid;
  v_lead_id  uuid;
begin
  -- Verify student exists and look up lead.
  select originating_lead_id into v_lead_id
  from command_center.students
  where id = p_student_id;

  if not found then
    return jsonb_build_object('error', 'student_not_found');
  end if;

  -- Insert task.
  insert into command_center.tasks (
    student_id, lead_id, assigned_to, created_by,
    title, description, priority, task_status,
    auto_generated, due_at, source_system
  ) values (
    p_student_id, v_lead_id, p_assigned_to, p_created_by,
    p_title, p_description, p_priority, 'open',
    false, p_due_at, 'wordpress'
  )
  returning id into v_task_id;

  -- Append event.
  v_event_id := command_center.append_event(
    'operator.task.created',
    'wordpress',
    'task',
    v_task_id,
    v_lead_id,
    p_student_id,
    'user_action',
    null, null, null, null, null,
    jsonb_build_object(
      'task_id',     v_task_id,
      'title',       p_title,
      'assigned_to', p_assigned_to,
      'created_by',  p_created_by,
      'priority',    p_priority
    ),
    now()
  );

  -- Return the view row.
  return (
    select jsonb_build_object(
      'task',     row_to_json(tq)::jsonb,
      'event_id', v_event_id
    )
    from command_center.task_queue_v1 tq
    where tq.task_id = v_task_id
  );
end;
$$;
-- --------------------------------------------------
-- WRITE: Create an operator note.
-- Inserts row + appends event. Returns note data.
-- --------------------------------------------------
create or replace function public.mmac_cc_create_note(
  p_student_id uuid,
  p_content    text,
  p_author     text    default 'brian',
  p_note_kind  text    default 'internal',
  p_pinned     boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, command_center
as $$
declare
  v_note_id  uuid;
  v_event_id uuid;
  v_lead_id  uuid;
begin
  select originating_lead_id into v_lead_id
  from command_center.students
  where id = p_student_id;

  if not found then
    return jsonb_build_object('error', 'student_not_found');
  end if;

  insert into command_center.notes (
    student_id, lead_id, author, note_kind,
    content, pinned, source_system
  ) values (
    p_student_id, v_lead_id, p_author, p_note_kind,
    p_content, p_pinned, 'wordpress'
  )
  returning id into v_note_id;

  v_event_id := command_center.append_event(
    'operator.note.created',
    'wordpress',
    'note',
    v_note_id,
    v_lead_id,
    p_student_id,
    'user_action',
    null, null, null, null, null,
    jsonb_build_object(
      'note_id',   v_note_id,
      'author',    p_author,
      'note_kind', p_note_kind,
      'pinned',    p_pinned
    ),
    now()
  );

  return jsonb_build_object(
    'note', jsonb_build_object(
      'id',         v_note_id,
      'author',     p_author,
      'note_kind',  p_note_kind,
      'content',    p_content,
      'pinned',     p_pinned,
      'created_at', now()
    ),
    'event_id', v_event_id
  );
end;
$$;
-- --------------------------------------------------
-- GRANTS
-- --------------------------------------------------
-- RPC execution for the WordPress service-role client.
grant execute on function public.mmac_cc_list_students(text, text, text)                          to service_role;
grant execute on function public.mmac_cc_get_student_detail(uuid)                                 to service_role;
grant execute on function public.mmac_cc_list_tasks(uuid, text, text)                             to service_role;
grant execute on function public.mmac_cc_list_payments(uuid)                                      to service_role;
grant execute on function public.mmac_cc_list_emails(uuid)                                        to service_role;
grant execute on function public.mmac_cc_update_task(uuid, text, text, integer)                   to service_role;
grant execute on function public.mmac_cc_create_task(uuid, text, text, text, text, integer, timestamptz) to service_role;
grant execute on function public.mmac_cc_create_note(uuid, text, text, text, boolean)             to service_role;
-- Table-level grants (belt-and-suspenders for security definer functions).
grant select, insert, update on command_center.tasks  to service_role;
grant select, insert         on command_center.notes  to service_role;
grant select, insert, update on command_center.events to service_role;
grant select                 on command_center.students to service_role;
grant select                 on command_center.leads    to service_role;
grant select                 on command_center.alerts   to service_role;
-- Comments.
comment on function public.mmac_cc_list_students(text, text, text)
  is 'MCC-402: Returns student directory with optional search/filter. Used by GET /students.';
comment on function public.mmac_cc_get_student_detail(uuid)
  is 'MCC-402: Returns full student composite (profile, tasks, payments, emails, alerts, notes, timeline). Used by GET /students/{id}.';
comment on function public.mmac_cc_list_tasks(uuid, text, text)
  is 'MCC-402: Returns task queue with optional filters. Used by GET /tasks.';
comment on function public.mmac_cc_list_payments(uuid)
  is 'MCC-402: Returns payment feed. Used by GET /payments.';
comment on function public.mmac_cc_list_emails(uuid)
  is 'MCC-402: Returns email draft queue. Used by GET /emails.';
comment on function public.mmac_cc_update_task(uuid, text, text, integer)
  is 'MCC-402: Updates task fields + appends operator event. Used by PATCH /tasks/{id}.';
comment on function public.mmac_cc_create_task(uuid, text, text, text, text, integer, timestamptz)
  is 'MCC-402: Creates operator task + appends event. Used by POST /tasks.';
comment on function public.mmac_cc_create_note(uuid, text, text, text, boolean)
  is 'MCC-402: Creates operator note + appends event. Used by POST /notes.';
commit;
