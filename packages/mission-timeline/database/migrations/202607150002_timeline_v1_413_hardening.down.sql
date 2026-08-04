begin;

do $$
begin
  if timeline.schema_version() <> 'd1-timeline-db-413.2' then
    raise exception 'D1-413 corrective down migration requires schema version d1-timeline-db-413.2';
  end if;
end
$$;

alter table timeline.principals no force row level security;
alter table timeline.principal_programs no force row level security;
alter table timeline.documents no force row level security;
alter table timeline.versions no force row level security;
alter table timeline.checkpoints no force row level security;
alter table timeline.advisor_assignments no force row level security;
alter table timeline.faculty_grants no force row level security;
alter table timeline.review_requests no force row level security;
alter table timeline.comments no force row level security;
alter table timeline.approval_events no force row level security;
alter table timeline.media_objects no force row level security;
alter table timeline.export_jobs no force row level security;
alter table timeline.artifacts no force row level security;
alter table timeline.artifact_files no force row level security;
alter table timeline.filevault_links no force row level security;
alter table timeline.outbox_events no force row level security;
alter table timeline.idempotency_keys no force row level security;
alter table timeline.audit_events no force row level security;
alter table timeline.deletion_requests no force row level security;

drop policy documents_read on timeline.documents;
drop policy versions_read on timeline.versions;
drop policy faculty_grants_subject_read on timeline.faculty_grants;
drop policy faculty_grants_admin_insert on timeline.faculty_grants;
drop policy faculty_grants_admin_update on timeline.faculty_grants;
drop policy faculty_grants_admin_delete on timeline.faculty_grants;
drop policy reviews_read on timeline.review_requests;
drop policy comments_read on timeline.comments;
drop policy approvals_read on timeline.approval_events;
drop policy approvals_participant_insert on timeline.approval_events;
drop policy media_read on timeline.media_objects;
drop policy exports_read on timeline.export_jobs;
drop policy artifacts_read on timeline.artifacts;
drop policy artifact_files_read on timeline.artifact_files;
drop policy filevault_links_read on timeline.filevault_links;
drop policy outbox_actor_read on timeline.outbox_events;
drop policy outbox_actor_insert on timeline.outbox_events;
drop policy outbox_workflow_service_insert on timeline.outbox_events;
drop policy outbox_audit_service_all on timeline.outbox_events;
drop policy audit_service_read on timeline.audit_events;
drop policy audit_actor_read on timeline.audit_events;
drop policy audit_break_glass_grantee_read on timeline.audit_events;
drop policy audit_actor_insert on timeline.audit_events;
drop policy audit_service_insert on timeline.audit_events;
drop policy audit_break_glass_grant_insert on timeline.audit_events;

create or replace function timeline.break_glass_active()
returns boolean
language plpgsql
stable
security definer
set search_path = timeline, pg_temp
as $$
declare
  claims jsonb := timeline.jwt_claims();
  grant_id text := nullif(claims->>'break_glass_audit_id', '');
  reason text := nullif(claims->>'break_glass_reason', '');
  expires_at timestamptz;
begin
  if not timeline.current_principal_is_active('PLATFORM_ADMIN') or grant_id is null or reason is null then
    return false;
  end if;

  expires_at := nullif(claims->>'break_glass_expires_at', '')::timestamptz;
  if expires_at <= now() or expires_at > now() + interval '1 hour' then
    return false;
  end if;

  return exists (
    select 1
    from timeline.audit_events a
    where a.id = grant_id
      and a.actor_id = timeline.current_principal_id()
      and a.action = 'BREAK_GLASS_ACCESS'
      and a.outcome = 'ALLOW'
      and a.metadata_json->>'reason' = reason
      and (a.metadata_json->>'expires_at')::timestamptz = expires_at
  );
exception
  when others then
    return false;
end
$$;

create or replace function timeline.can_read_document(target_document_id text)
returns boolean
language sql
stable
security definer
set search_path = timeline, pg_temp
as $$
  select exists (
    select 1
    from timeline.documents d
    where d.id = target_document_id
      and d.deleted_at is null
      and timeline.current_principal_is_active()
      and (
        d.owner_principal_id = timeline.current_principal_id()
        or (timeline.current_role() = 'ADVISOR' and exists (
          select 1 from timeline.advisor_assignments a
          where a.document_id = d.id
            and a.advisor_principal_id = timeline.current_principal_id()
            and a.program_id = d.program_id
            and d.program_id = any(timeline.current_program_ids())
            and a.starts_at <= now()
            and (a.ends_at is null or a.ends_at > now())
        ))
        or (timeline.current_role() = 'PROGRAM_ADMIN' and d.program_id = any(timeline.current_program_ids()))
        or (timeline.current_role() = 'FACULTY' and exists (
          select 1 from timeline.faculty_grants g
          where g.document_id = d.id
            and g.faculty_principal_id = timeline.current_principal_id()
            and g.starts_at <= now()
            and g.expires_at > now()
            and g.revoked_at is null
            and 'document:read' = any(g.actions)
        ))
        or timeline.service_has_scope('document:read')
        or timeline.break_glass_active()
      )
  )
$$;

create policy documents_read on timeline.documents
  for select using (
    (timeline.current_principal_is_active('STUDENT') and owner_principal_id = timeline.current_principal_id())
    or timeline.can_read_document(id)
  );
create policy versions_read on timeline.versions
  for select using (timeline.can_read_document(document_id));
create policy faculty_grants_subject_read on timeline.faculty_grants
  for select using (faculty_principal_id = timeline.current_principal_id() or timeline.can_read_document(document_id));
create policy faculty_grants_admin_write on timeline.faculty_grants
  for all using (
    timeline.current_role() = 'PROGRAM_ADMIN'
    and exists (select 1 from timeline.documents d where d.id = document_id and d.program_id = any(timeline.current_program_ids()))
  ) with check (
    timeline.current_role() = 'PROGRAM_ADMIN'
    and exists (select 1 from timeline.documents d where d.id = document_id and d.program_id = any(timeline.current_program_ids()))
  );
create policy reviews_read on timeline.review_requests
  for select using (timeline.can_read_document(document_id));
create policy comments_read on timeline.comments
  for select using (
    exists (
      select 1 from timeline.review_requests r
      join timeline.documents d on d.id = r.document_id
      where r.id = review_request_id
        and timeline.can_read_document(d.id)
        and (visibility = 'SHARED' or timeline.current_role() in ('ADVISOR', 'PROGRAM_ADMIN', 'SERVICE'))
    )
  );
create policy approvals_read on timeline.approval_events
  for select using (timeline.can_read_document(document_id));
create policy approvals_advisor_insert on timeline.approval_events
  for insert with check (
    timeline.current_principal_is_active('ADVISOR')
    and actor_id = timeline.current_principal_id()
    and exists (
      select 1
      from timeline.review_requests r
      join timeline.versions v on v.id = r.version_id and v.document_id = r.document_id
      where r.id = review_request_id
        and r.assigned_to = timeline.current_principal_id()
        and r.document_id = approval_events.document_id
        and r.version_id = approval_events.version_id
        and r.version_sha256 = approval_events.content_sha256
        and v.content_sha256 = approval_events.content_sha256
    )
  );
create policy media_read on timeline.media_objects
  for select using (timeline.can_read_document(document_id));
create policy exports_read on timeline.export_jobs
  for select using (timeline.can_read_document(document_id));
create policy artifacts_read on timeline.artifacts
  for select using (timeline.can_read_document(document_id));
create policy artifact_files_read on timeline.artifact_files
  for select using (exists (select 1 from timeline.artifacts a where a.id = artifact_id and timeline.can_read_document(a.document_id)));
create policy filevault_links_read on timeline.filevault_links
  for select using (exists (select 1 from timeline.artifacts a where a.id = artifact_id and timeline.can_read_document(a.document_id)));
create policy outbox_service_only on timeline.outbox_events
  for all using (timeline.service_has_scope('audit:read'))
  with check (timeline.service_has_scope('audit:read'));
create policy audit_service_read on timeline.audit_events
  for select using (timeline.service_has_scope('audit:read'));
create policy audit_service_insert on timeline.audit_events
  for insert with check (timeline.service_has_scope('audit:read') or actor_id = timeline.current_principal_id());

drop function timeline.can_read_document(text, text, text, timestamptz);

alter table timeline.artifact_files
  drop constraint artifact_files_artifact_binding_fkey_413,
  drop constraint artifact_files_object_document_fkey_413,
  add constraint artifact_files_artifact_id_fkey
    foreign key (artifact_id) references timeline.artifacts(id),
  add constraint artifact_files_object_id_fkey
    foreign key (object_id) references timeline.media_objects(id),
  drop column document_id,
  drop column version_id;

alter table timeline.export_jobs
  drop constraint export_jobs_artifact_binding_fkey_413,
  add constraint export_jobs_artifact_id_fkey
    foreign key (artifact_id) references timeline.artifacts(id) deferrable initially deferred;

alter table timeline.media_objects
  drop constraint media_objects_document_owner_fkey_413,
  drop constraint media_objects_id_document_key_413;
alter table timeline.artifacts
  drop constraint artifacts_export_binding_key_413,
  drop constraint artifacts_id_document_version_key_413;
alter table timeline.documents
  drop constraint documents_id_owner_key_413;
alter table timeline.outbox_events
  drop constraint outbox_events_actor_id_fkey_413,
  drop constraint outbox_events_document_id_fkey_413,
  drop column actor_id,
  drop column document_id;

create or replace function timeline.schema_version()
returns text
language sql
immutable
as $$
  select 'd1-timeline-db-413.1'::text
$$;

comment on schema timeline is null;
comment on function timeline.schema_version() is null;

commit;
