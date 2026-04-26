-- ============================================================================
-- NMCC-2E-DATA-SYNC — Backfill anchor support
-- Provides the anchor resolver required by NMCC-2E backfill RPCs on projects
-- where the earlier integration-layer migration has not been applied.
-- ============================================================================

begin;
create or replace function command_center.resolve_anchor(
  p_email text default null,
  p_wordpress_user_id text default null,
  p_source_record_id text default null
)
returns table (
  lead_id uuid,
  student_id uuid,
  assigned_to text,
  aggregate_type text,
  aggregate_id uuid
)
language plpgsql
stable
as $$
declare
  v_student_id uuid;
  v_lead_id uuid;
  v_assigned_to text := 'system';
begin
  if nullif(btrim(coalesce(p_email, '')), '') is not null then
    select s.id, s.originating_lead_id, s.assigned_to
      into v_student_id, v_lead_id, v_assigned_to
    from command_center.students s
    where s.email = p_email::citext
    order by s.updated_at desc
    limit 1;
  end if;

  if v_student_id is null and nullif(btrim(coalesce(p_wordpress_user_id, '')), '') is not null then
    select s.id, s.originating_lead_id, s.assigned_to
      into v_student_id, v_lead_id, v_assigned_to
    from command_center.students s
    where s.source_record_id = p_wordpress_user_id
       or s.metadata ->> 'wp_user_id' = p_wordpress_user_id
       or s.metadata ->> 'wordpress_user_id' = p_wordpress_user_id
    order by s.updated_at desc
    limit 1;
  end if;

  if v_student_id is null and nullif(btrim(coalesce(p_source_record_id, '')), '') is not null then
    select s.id, s.originating_lead_id, s.assigned_to
      into v_student_id, v_lead_id, v_assigned_to
    from command_center.students s
    where s.source_record_id = p_source_record_id
    order by s.updated_at desc
    limit 1;
  end if;

  if v_lead_id is null and nullif(btrim(coalesce(p_email, '')), '') is not null then
    select l.id, l.assigned_to
      into v_lead_id, v_assigned_to
    from command_center.leads l
    where l.email = p_email::citext
    order by l.updated_at desc
    limit 1;
  end if;

  if v_lead_id is null and nullif(btrim(coalesce(p_wordpress_user_id, '')), '') is not null then
    select l.id, l.assigned_to
      into v_lead_id, v_assigned_to
    from command_center.leads l
    where l.source_record_id = p_wordpress_user_id
       or l.metadata ->> 'wp_user_id' = p_wordpress_user_id
       or l.metadata ->> 'wordpress_user_id' = p_wordpress_user_id
    order by l.updated_at desc
    limit 1;
  end if;

  if v_lead_id is null and nullif(btrim(coalesce(p_source_record_id, '')), '') is not null then
    select l.id, l.assigned_to
      into v_lead_id, v_assigned_to
    from command_center.leads l
    where l.source_record_id = p_source_record_id
    order by l.updated_at desc
    limit 1;
  end if;

  if v_student_id is not null then
    return query
    select
      v_lead_id,
      v_student_id,
      coalesce(v_assigned_to, 'system'),
      'student'::text,
      v_student_id;
    return;
  end if;

  if v_lead_id is not null then
    return query
    select
      v_lead_id,
      null::uuid,
      coalesce(v_assigned_to, 'brian'),
      'lead'::text,
      v_lead_id;
    return;
  end if;

  return query
  select
    null::uuid,
    null::uuid,
    'system'::text,
    'system'::text,
    null::uuid;
end;
$$;
comment on function command_center.resolve_anchor(text, text, text)
  is 'Anchor resolver used by integration and backfill RPCs to map email / WordPress IDs to canonical lead or student rows.';
commit;
