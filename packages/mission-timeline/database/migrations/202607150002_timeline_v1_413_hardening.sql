begin;

do $$
begin
  if timeline.schema_version() <> 'd1-timeline-db-413.1' then
    raise exception 'D1-413 corrective migration requires schema version d1-timeline-db-413.1';
  end if;
end
$$;

alter table timeline.outbox_events
  add column actor_id text,
  add column document_id text;

update timeline.outbox_events o
set document_id = coalesce(nullif(o.payload_json->>'documentId', ''), o.aggregate_id)
where exists (
  select 1
  from timeline.documents d
  where d.id = coalesce(nullif(o.payload_json->>'documentId', ''), o.aggregate_id)
);

alter table timeline.outbox_events
  add constraint outbox_events_actor_id_fkey_413
  foreign key (actor_id) references timeline.principals(id),
  add constraint outbox_events_document_id_fkey_413
  foreign key (document_id) references timeline.documents(id);

alter table timeline.documents
  add constraint documents_id_owner_key_413 unique (id, owner_principal_id);

alter table timeline.media_objects
  add constraint media_objects_id_document_key_413 unique (id, document_id),
  add constraint media_objects_document_owner_fkey_413
  foreign key (document_id, owner_principal_id)
  references timeline.documents(id, owner_principal_id)
  deferrable initially deferred;

alter table timeline.artifacts
  add constraint artifacts_id_document_version_key_413
  unique (id, document_id, version_id),
  add constraint artifacts_export_binding_key_413
  unique (id, document_id, version_id, artifact_type, export_scope);

alter table timeline.export_jobs
  drop constraint export_jobs_artifact_id_fkey;
alter table timeline.export_jobs
  add constraint export_jobs_artifact_binding_fkey_413
  foreign key (artifact_id, document_id, version_id, artifact_type, export_scope)
  references timeline.artifacts(id, document_id, version_id, artifact_type, export_scope)
  deferrable initially deferred;

alter table timeline.artifact_files
  add column document_id text,
  add column version_id text;

update timeline.artifact_files af
set document_id = a.document_id,
    version_id = a.version_id
from timeline.artifacts a
where a.id = af.artifact_id;

alter table timeline.artifact_files
  alter column document_id set not null,
  alter column version_id set not null,
  drop constraint artifact_files_artifact_id_fkey,
  drop constraint artifact_files_object_id_fkey,
  add constraint artifact_files_artifact_binding_fkey_413
    foreign key (artifact_id, document_id, version_id)
    references timeline.artifacts(id, document_id, version_id)
    deferrable initially deferred,
  add constraint artifact_files_object_document_fkey_413
    foreign key (object_id, document_id)
    references timeline.media_objects(id, document_id)
    deferrable initially deferred;

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
  grantor_id text := nullif(claims->>'break_glass_granted_by', '');
  reason text := nullif(claims->>'break_glass_reason', '');
  expires_at timestamptz;
begin
  if not timeline.current_principal_is_active('PLATFORM_ADMIN')
     or grant_id is null
     or grantor_id is null
     or grantor_id = timeline.current_principal_id()
     or reason is null then
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
      and a.actor_id = grantor_id
      and a.actor_id <> timeline.current_principal_id()
      and a.action = 'BREAK_GLASS_GRANT'
      and a.resource_type = 'PRINCIPAL'
      and a.resource_id = timeline.current_principal_id()
      and a.outcome = 'ALLOW'
      and a.metadata_json->>'subject_id' = timeline.current_principal_id()
      and a.metadata_json->>'reason' = reason
      and (a.metadata_json->>'expires_at')::timestamptz = expires_at
  );
exception
  when others then
    return false;
end
$$;

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
        select 1
        from timeline.advisor_assignments a
        where a.document_id = target_document_id
          and a.advisor_principal_id = timeline.current_principal_id()
          and a.program_id = target_program_id
          and target_program_id = any(timeline.current_program_ids())
          and a.starts_at <= now()
          and (a.ends_at is null or a.ends_at > now())
      ))
      or (timeline.current_role() = 'PROGRAM_ADMIN' and target_program_id = any(timeline.current_program_ids()))
      or (timeline.current_role() = 'FACULTY' and exists (
        select 1
        from timeline.faculty_grants g
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

drop policy documents_read on timeline.documents;
create policy documents_read on timeline.documents
  for select using (
    (
      timeline.current_principal_is_active('STUDENT')
      and owner_principal_id = timeline.current_principal_id()
      and deleted_at is null
    )
    or timeline.can_read_document(id, owner_principal_id, program_id, deleted_at)
  );

drop policy versions_read on timeline.versions;
create policy versions_read on timeline.versions
  for select using (exists (select 1 from timeline.documents d where d.id = document_id));

drop policy faculty_grants_subject_read on timeline.faculty_grants;
drop policy faculty_grants_admin_write on timeline.faculty_grants;
create policy faculty_grants_subject_read on timeline.faculty_grants
  for select using (
    faculty_principal_id = timeline.current_principal_id()
    or timeline.service_has_scope('audit:read')
  );
create policy faculty_grants_admin_insert on timeline.faculty_grants
  for insert with check (
    timeline.current_principal_is_active('PROGRAM_ADMIN')
    and exists (
      select 1
      from timeline.documents d
      where d.id = document_id
        and d.program_id = any(timeline.current_program_ids())
    )
  );
create policy faculty_grants_admin_update on timeline.faculty_grants
  for update using (
    timeline.current_principal_is_active('PROGRAM_ADMIN')
    and exists (
      select 1
      from timeline.documents d
      where d.id = document_id
        and d.program_id = any(timeline.current_program_ids())
    )
  ) with check (
    timeline.current_principal_is_active('PROGRAM_ADMIN')
    and exists (
      select 1
      from timeline.documents d
      where d.id = document_id
        and d.program_id = any(timeline.current_program_ids())
    )
  );
create policy faculty_grants_admin_delete on timeline.faculty_grants
  for delete using (
    timeline.current_principal_is_active('PROGRAM_ADMIN')
    and exists (
      select 1
      from timeline.documents d
      where d.id = document_id
        and d.program_id = any(timeline.current_program_ids())
    )
  );

drop policy reviews_read on timeline.review_requests;
create policy reviews_read on timeline.review_requests
  for select using (exists (select 1 from timeline.documents d where d.id = document_id));

drop policy comments_read on timeline.comments;
create policy comments_read on timeline.comments
  for select using (
    exists (
      select 1
      from timeline.review_requests r
      join timeline.documents d on d.id = r.document_id
      where r.id = review_request_id
        and (visibility = 'SHARED' or timeline.current_role() in ('ADVISOR', 'PROGRAM_ADMIN', 'SERVICE'))
    )
  );

drop policy approvals_read on timeline.approval_events;
drop policy approvals_advisor_insert on timeline.approval_events;
create policy approvals_read on timeline.approval_events
  for select using (exists (select 1 from timeline.documents d where d.id = document_id));
create policy approvals_participant_insert on timeline.approval_events
  for insert with check (
    actor_id = timeline.current_principal_id()
    and exists (
      select 1
      from timeline.review_requests r
      join timeline.versions v on v.id = r.version_id and v.document_id = r.document_id
      join timeline.documents d on d.id = r.document_id
      where r.id = review_request_id
        and r.document_id = approval_events.document_id
        and r.version_id = approval_events.version_id
        and r.version_sha256 = approval_events.content_sha256
        and v.content_sha256 = approval_events.content_sha256
        and (
          (
            timeline.current_principal_is_active('ADVISOR')
            and r.assigned_to = timeline.current_principal_id()
            and approval_events.decision in ('APPROVED', 'CHANGES_REQUESTED')
          )
          or (
            timeline.current_principal_is_active('STUDENT')
            and d.owner_principal_id = timeline.current_principal_id()
            and approval_events.decision = 'INVALIDATED'
          )
        )
    )
  );

drop policy media_read on timeline.media_objects;
create policy media_read on timeline.media_objects
  for select using (exists (select 1 from timeline.documents d where d.id = document_id));

drop policy exports_read on timeline.export_jobs;
create policy exports_read on timeline.export_jobs
  for select using (exists (select 1 from timeline.documents d where d.id = document_id));

drop policy artifacts_read on timeline.artifacts;
create policy artifacts_read on timeline.artifacts
  for select using (exists (select 1 from timeline.documents d where d.id = document_id));

drop policy artifact_files_read on timeline.artifact_files;
create policy artifact_files_read on timeline.artifact_files
  for select using (
    exists (
      select 1
      from timeline.artifacts a
      where a.id = artifact_id
        and a.document_id = artifact_files.document_id
        and a.version_id = artifact_files.version_id
    )
  );

drop policy filevault_links_read on timeline.filevault_links;
create policy filevault_links_read on timeline.filevault_links
  for select using (exists (select 1 from timeline.artifacts a where a.id = artifact_id));

drop policy outbox_service_only on timeline.outbox_events;
create policy outbox_actor_read on timeline.outbox_events
  for select using (
    timeline.current_principal_is_active()
    and actor_id = timeline.current_principal_id()
  );
create policy outbox_actor_insert on timeline.outbox_events
  for insert with check (
    timeline.current_principal_is_active()
    and timeline.current_role() in ('STUDENT', 'ADVISOR', 'PROGRAM_ADMIN')
    and actor_id = timeline.current_principal_id()
    and document_id = aggregate_id
    and payload_json->>'documentId' = document_id
    and exists (select 1 from timeline.documents d where d.id = document_id)
    and (
      (timeline.current_role() = 'STUDENT' and event_type in (
        'timeline.document.created',
        'timeline.document.versioned',
        'timeline.review.requested',
        'timeline.comment.created',
        'timeline.export.requested',
        'timeline.approval.invalidated',
        'timeline.document.deleted'
      ))
      or (timeline.current_role() = 'ADVISOR' and event_type in (
        'timeline.comment.created',
        'timeline.review.approved',
        'timeline.review.changes_requested'
      ))
      or (timeline.current_role() = 'PROGRAM_ADMIN' and event_type in (
        'timeline.review.approved',
        'timeline.review.changes_requested'
      ))
    )
  );
create policy outbox_workflow_service_insert on timeline.outbox_events
  for insert with check (
    timeline.current_principal_is_active('SERVICE')
    and actor_id = timeline.current_principal_id()
    and document_id = aggregate_id
    and (
      payload_json->>'documentId' = document_id
      or event_type = 'timeline.filevault.published'
    )
    and (
      (timeline.service_has_scope('artifact:create') and event_type in (
        'timeline.artifact.ready',
        'timeline.export.requested'
      ))
      or (timeline.service_has_scope('filevault:publish') and event_type = 'timeline.filevault.published')
    )
  );
create policy outbox_audit_service_all on timeline.outbox_events
  for all using (timeline.service_has_scope('audit:read'))
  with check (timeline.service_has_scope('audit:read'));

drop policy audit_service_read on timeline.audit_events;
drop policy audit_service_insert on timeline.audit_events;
create policy audit_service_read on timeline.audit_events
  for select using (timeline.service_has_scope('audit:read'));
create policy audit_actor_read on timeline.audit_events
  for select using (
    timeline.current_principal_is_active()
    and actor_id = timeline.current_principal_id()
  );
create policy audit_break_glass_grantee_read on timeline.audit_events
  for select using (
    timeline.current_principal_is_active('PLATFORM_ADMIN')
    and action = 'BREAK_GLASS_GRANT'
    and outcome = 'ALLOW'
    and resource_type = 'PRINCIPAL'
    and resource_id = timeline.current_principal_id()
    and metadata_json->>'subject_id' = timeline.current_principal_id()
  );
create policy audit_actor_insert on timeline.audit_events
  for insert with check (
    timeline.current_principal_is_active()
    and actor_id = timeline.current_principal_id()
    and action not in ('BREAK_GLASS_GRANT', 'BREAK_GLASS_ACCESS')
  );
create policy audit_service_insert on timeline.audit_events
  for insert with check (timeline.service_has_scope('audit:read'));
create policy audit_break_glass_grant_insert on timeline.audit_events
  for insert with check (
    timeline.current_principal_is_active('PLATFORM_ADMIN')
    and actor_id = timeline.current_principal_id()
    and action = 'BREAK_GLASS_GRANT'
    and resource_type = 'PRINCIPAL'
    and resource_id = metadata_json->>'subject_id'
    and resource_id <> timeline.current_principal_id()
    and outcome = 'ALLOW'
    and nullif(metadata_json->>'reason', '') is not null
    and (metadata_json->>'expires_at')::timestamptz > now()
    and (metadata_json->>'expires_at')::timestamptz <= now() + interval '1 hour'
  );

drop function timeline.can_read_document(text);

alter table timeline.principals force row level security;
alter table timeline.principal_programs force row level security;
alter table timeline.documents force row level security;
alter table timeline.versions force row level security;
alter table timeline.checkpoints force row level security;
alter table timeline.advisor_assignments force row level security;
alter table timeline.faculty_grants force row level security;
alter table timeline.review_requests force row level security;
alter table timeline.comments force row level security;
alter table timeline.approval_events force row level security;
alter table timeline.media_objects force row level security;
alter table timeline.export_jobs force row level security;
alter table timeline.artifacts force row level security;
alter table timeline.artifact_files force row level security;
alter table timeline.filevault_links force row level security;
alter table timeline.outbox_events force row level security;
alter table timeline.idempotency_keys force row level security;
alter table timeline.audit_events force row level security;
alter table timeline.deletion_requests force row level security;

create or replace function timeline.schema_version()
returns text
language sql
immutable
as $$
  select 'd1-timeline-db-413.2'::text
$$;

comment on schema timeline is
  'All protected tables use ENABLE and FORCE ROW LEVEL SECURITY. Runtime assertions must execute as a non-owner, non-BYPASSRLS role; deployment owners are reserved for migrations and fixture maintenance.';
comment on function timeline.schema_version() is
  'Forward-corrected D1-413 PostgreSQL contract: owner-read, workflow RLS, independent break-glass grants, and relationship binding hardening.';

commit;
