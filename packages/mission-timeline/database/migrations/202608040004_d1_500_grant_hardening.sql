begin;

do $$
begin
  if timeline.schema_version() <> 'd1-timeline-db-411c.1' then
    raise exception 'D1-500 grant hardening requires schema version d1-timeline-db-411c.1';
  end if;
end
$$;

alter table timeline.admin_resource_grants
  add constraint admin_resource_grants_authorization_audit_unique_500
  unique (authorization_audit_id);

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
      and a.metadata_json->>'grant_id' = new.id
      and a.metadata_json->>'administrator_principal_id' = new.administrator_principal_id
      and a.metadata_json->>'student_principal_id' = new.student_principal_id
      and a.metadata_json->'actions' = to_jsonb(new.actions)
      and a.metadata_json->>'reason' = new.reason
      and (a.metadata_json->>'starts_at')::timestamptz = new.starts_at
      and (a.metadata_json->>'expires_at')::timestamptz = new.expires_at
  ) then
    raise exception 'Timeline administrator grant requires an exact independently audited authorization';
  end if;
  return new;
end
$$;

create or replace function timeline.reject_admin_resource_grant_scope_change_500()
returns trigger
language plpgsql
as $$
begin
  if new.id is distinct from old.id
     or new.administrator_principal_id is distinct from old.administrator_principal_id
     or new.student_principal_id is distinct from old.student_principal_id
     or new.document_id is distinct from old.document_id
     or new.actions is distinct from old.actions
     or new.created_by_principal_id is distinct from old.created_by_principal_id
     or new.authorization_audit_id is distinct from old.authorization_audit_id
     or new.reason is distinct from old.reason
     or new.starts_at is distinct from old.starts_at
     or new.expires_at is distinct from old.expires_at
     or new.created_at is distinct from old.created_at
     or (old.revoked_at is not null and new.revoked_at is distinct from old.revoked_at)
     or new.updated_at < old.updated_at then
    raise exception 'Timeline administrator grant scope is immutable';
  end if;
  return new;
end
$$;

create trigger admin_resource_grant_scope_immutable_500
before update on timeline.admin_resource_grants
for each row execute function timeline.reject_admin_resource_grant_scope_change_500();

revoke all on function timeline.reject_admin_resource_grant_scope_change_500() from public;

drop policy audit_actor_insert on timeline.audit_events;
create policy audit_actor_insert on timeline.audit_events
  for insert with check (
    timeline.current_principal_is_active()
    and actor_id = timeline.current_principal_id()
    and action not in ('BREAK_GLASS_GRANT', 'BREAK_GLASS_ACCESS', 'ADMIN_RESOURCE_GRANT')
  );

create or replace function timeline.schema_version()
returns text
language sql
immutable
as $$
  select 'd1-timeline-db-500.1'::text
$$;

comment on constraint admin_resource_grants_authorization_audit_unique_500 on timeline.admin_resource_grants is
  'Each independently authorized audit event may issue exactly one immutable administrator resource grant.';

commit;
