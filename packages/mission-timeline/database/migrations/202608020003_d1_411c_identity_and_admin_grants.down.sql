begin;

do $$
begin
  if timeline.schema_version() <> 'd1-timeline-db-411c.1' then
    raise exception 'D1-411C rollback requires schema version d1-timeline-db-411c.1';
  end if;
  if exists (select 1 from timeline.admin_resource_grants) then
    raise exception 'Refusing D1-411C rollback while administrator resource grants exist';
  end if;
end
$$;

drop policy if exists faculty_grants_admin_grant_delete_411c on timeline.faculty_grants;
drop policy if exists faculty_grants_admin_grant_update_411c on timeline.faculty_grants;
drop policy if exists faculty_grants_admin_grant_insert_411c on timeline.faculty_grants;
drop policy if exists assignments_admin_grant_write_411c on timeline.advisor_assignments;
drop policy if exists checkpoints_admin_all_411c on timeline.checkpoints;
drop policy if exists versions_admin_insert_411c on timeline.versions;
drop policy if exists documents_admin_update_411c on timeline.documents;

create policy assignments_admin_write on timeline.advisor_assignments
  for all using (timeline.current_role() = 'PROGRAM_ADMIN' and program_id = any(timeline.current_program_ids()))
  with check (timeline.current_role() = 'PROGRAM_ADMIN' and program_id = any(timeline.current_program_ids()));
create policy faculty_grants_admin_insert on timeline.faculty_grants
  for insert with check (
    timeline.current_principal_is_active('PROGRAM_ADMIN')
    and exists (select 1 from timeline.documents d where d.id = document_id and d.program_id = any(timeline.current_program_ids()))
  );
create policy faculty_grants_admin_update on timeline.faculty_grants
  for update using (
    timeline.current_principal_is_active('PROGRAM_ADMIN')
    and exists (select 1 from timeline.documents d where d.id = document_id and d.program_id = any(timeline.current_program_ids()))
  ) with check (
    timeline.current_principal_is_active('PROGRAM_ADMIN')
    and exists (select 1 from timeline.documents d where d.id = document_id and d.program_id = any(timeline.current_program_ids()))
  );
create policy faculty_grants_admin_delete on timeline.faculty_grants
  for delete using (
    timeline.current_principal_is_active('PROGRAM_ADMIN')
    and exists (select 1 from timeline.documents d where d.id = document_id and d.program_id = any(timeline.current_program_ids()))
  );

create or replace function timeline.can_read_document(
  target_document_id text,
  target_owner_principal_id text,
  target_program_id text,
  target_deleted_at timestamptz
)
returns boolean
language sql
stable
security definer
set search_path = timeline, pg_temp
as $$
  select target_deleted_at is null
    and timeline.current_principal_is_active()
    and (
      (timeline.current_role() = 'ADVISOR' and exists (
        select 1 from timeline.advisor_assignments a
        where a.document_id = target_document_id
          and a.advisor_principal_id = timeline.current_principal_id()
          and a.program_id = target_program_id
          and target_program_id = any(timeline.current_program_ids())
          and a.starts_at <= now()
          and (a.ends_at is null or a.ends_at > now())
      ))
      or (timeline.current_role() = 'PROGRAM_ADMIN' and target_program_id = any(timeline.current_program_ids()))
      or (timeline.current_role() = 'FACULTY' and exists (
        select 1 from timeline.faculty_grants g
        where g.document_id = target_document_id
          and g.faculty_principal_id = timeline.current_principal_id()
          and g.starts_at <= now()
          and g.expires_at > now()
          and g.revoked_at is null
          and 'document:read' = any(g.actions)
      ))
      or timeline.service_has_scope('document:read')
      or timeline.break_glass_active()
    )
$$;

drop function timeline.has_admin_resource_grant(text, text);
drop table timeline.admin_resource_grants;
drop function timeline.validate_admin_resource_grant_411c();
drop policy if exists principal_programs_identity_service_insert_411c on timeline.principal_programs;
drop policy if exists principals_identity_service_insert_411c on timeline.principals;
drop trigger principals_identity_immutable_411c on timeline.principals;
drop function timeline.reject_principal_identity_change_411c();
alter table timeline.principals drop constraint principals_wp_user_id_key_411c;
alter table timeline.principals drop column wp_user_id;

create or replace function timeline.current_principal_is_active(expected_role text default null)
returns boolean
language sql
stable
security definer
set search_path = timeline, pg_temp
as $$
  select exists (
    select 1
    from timeline.principals p
    where p.id = timeline.current_principal_id()
      and p.status = 'ACTIVE'
      and p.role = timeline.current_role()
      and (expected_role is null or p.role = expected_role)
  )
$$;

create or replace function timeline.schema_version()
returns text
language sql
immutable
as $$
  select 'd1-timeline-db-413.2'::text
$$;

commit;
