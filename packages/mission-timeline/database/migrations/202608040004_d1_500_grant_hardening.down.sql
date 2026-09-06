begin;

do $$
begin
  if timeline.schema_version() <> 'd1-timeline-db-500.1' then
    raise exception 'D1-500 grant hardening rollback requires schema version d1-timeline-db-500.1';
  end if;
  if exists (select 1 from timeline.admin_resource_grants) then
    raise exception 'Refusing D1-500 grant hardening rollback while administrator resource grants exist';
  end if;
end
$$;

drop trigger admin_resource_grant_scope_immutable_500 on timeline.admin_resource_grants;
drop function timeline.reject_admin_resource_grant_scope_change_500();
alter table timeline.admin_resource_grants
  drop constraint admin_resource_grants_authorization_audit_unique_500;

create or replace function timeline.validate_admin_resource_grant_411c()
returns trigger
language plpgsql
security definer
set search_path = timeline, pg_temp
as $$
declare
  administrator_role text;
  student_role text;
  creator_role text;
begin
  select role into administrator_role from timeline.principals where id = new.administrator_principal_id and status = 'ACTIVE';
  select role into student_role from timeline.principals where id = new.student_principal_id and status = 'ACTIVE';
  select role into creator_role from timeline.principals where id = new.created_by_principal_id and status = 'ACTIVE';
  if administrator_role <> 'PROGRAM_ADMIN' or student_role <> 'STUDENT' or creator_role not in ('PLATFORM_ADMIN', 'SERVICE') then
    raise exception 'Timeline administrator grant principal roles are invalid';
  end if;
  if not exists (
    select 1
    from timeline.audit_events a
    where a.id = new.authorization_audit_id
      and a.actor_id = new.created_by_principal_id
      and a.action = 'ADMIN_RESOURCE_GRANT'
      and a.resource_type = 'DOCUMENT'
      and a.resource_id = new.document_id
      and a.outcome = 'ALLOW'
      and a.metadata_json->>'administrator_principal_id' = new.administrator_principal_id
      and a.metadata_json->>'student_principal_id' = new.student_principal_id
  ) then
    raise exception 'Timeline administrator grant requires a matching independent audit event';
  end if;
  return new;
end
$$;

drop policy audit_actor_insert on timeline.audit_events;
create policy audit_actor_insert on timeline.audit_events
  for insert with check (
    timeline.current_principal_is_active()
    and actor_id = timeline.current_principal_id()
    and action not in ('BREAK_GLASS_GRANT', 'BREAK_GLASS_ACCESS')
  );

create or replace function timeline.schema_version()
returns text
language sql
immutable
as $$
  select 'd1-timeline-db-411c.1'::text
$$;

commit;
