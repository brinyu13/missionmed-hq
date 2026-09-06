\set ON_ERROR_STOP on

-- D1-411C group roles intentionally contain no credentials. Provider-managed
-- login roles must be created separately and granted exactly one of these roles.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'timeline_authenticated') then
    create role timeline_authenticated nologin nosuperuser nocreatedb nocreaterole noinherit nobypassrls;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'timeline_identity_sync') then
    create role timeline_identity_sync nologin nosuperuser nocreatedb nocreaterole noinherit nobypassrls;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'timeline_grant_authority') then
    create role timeline_grant_authority nologin nosuperuser nocreatedb nocreaterole noinherit nobypassrls;
  end if;
end
$$;

revoke all on schema timeline from public;
revoke all on all tables in schema timeline from public;
revoke all on all sequences in schema timeline from public;
revoke all on all functions in schema timeline from public;

grant usage on schema timeline to timeline_authenticated, timeline_identity_sync, timeline_grant_authority;
grant execute on all functions in schema timeline to timeline_authenticated, timeline_identity_sync, timeline_grant_authority;
grant usage, select on all sequences in schema timeline to timeline_authenticated, timeline_identity_sync, timeline_grant_authority;

-- Application requests remain constrained by FORCE ROW LEVEL SECURITY.
grant select, insert, update, delete on
  timeline.documents,
  timeline.versions,
  timeline.checkpoints,
  timeline.advisor_assignments,
  timeline.faculty_grants,
  timeline.review_requests,
  timeline.comments,
  timeline.approval_events,
  timeline.media_objects,
  timeline.export_jobs,
  timeline.artifacts,
  timeline.artifact_files,
  timeline.filevault_links,
  timeline.outbox_events,
  timeline.idempotency_keys,
  timeline.deletion_requests,
  timeline.audit_events
to timeline_authenticated;
grant select on timeline.principals, timeline.principal_programs, timeline.admin_resource_grants
to timeline_authenticated;

-- Identity synchronization may create immutable principal bindings but cannot
-- read or mutate student timeline resources.
grant select, insert on timeline.principals, timeline.principal_programs, timeline.audit_events
to timeline_identity_sync;

-- Administrator resource grants are issued only by the independent authority
-- workflow; ordinary authenticated application sessions cannot insert them.
grant select, insert, update on timeline.admin_resource_grants, timeline.audit_events
to timeline_grant_authority;
grant select on timeline.principals, timeline.documents
to timeline_grant_authority;

alter default privileges in schema timeline revoke all on tables from public;
alter default privileges in schema timeline revoke all on sequences from public;
alter default privileges in schema timeline revoke all on functions from public;
