begin;

create schema if not exists timeline;

create or replace function timeline.jwt_claims()
returns jsonb
language sql
stable
as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$$;

create or replace function timeline.schema_version()
returns text
language sql
immutable
as $$
  select 'd1-timeline-db-413.1'::text
$$;

create or replace function timeline.current_principal_id()
returns text
language sql
stable
as $$
  select nullif(timeline.jwt_claims()->>'sub', '')
$$;

create or replace function timeline.current_role()
returns text
language sql
stable
as $$
  select nullif(timeline.jwt_claims()->>'timeline_role', '')
$$;

create or replace function timeline.current_program_ids()
returns text[]
language sql
stable
as $$
  select coalesce(array(select jsonb_array_elements_text(timeline.jwt_claims()->'program_ids')), array[]::text[])
$$;

create or replace function timeline.service_has_scope(required_scope text)
returns boolean
language sql
stable
as $$
  select timeline.current_role() = 'SERVICE'
    and required_scope in (select jsonb_array_elements_text(timeline.jwt_claims()->'service_scopes'))
$$;

create table if not exists timeline.principals (
  id text primary key,
  matrix_wp_user_id bigint unique not null,
  role text not null check (role in ('STUDENT', 'ADVISOR', 'PROGRAM_ADMIN', 'PLATFORM_ADMIN', 'FACULTY', 'SERVICE')),
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'SUSPENDED', 'DELETED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists timeline.principal_programs (
  principal_id text not null references timeline.principals(id),
  program_id text not null,
  created_at timestamptz not null default now(),
  primary key (principal_id, program_id)
);

create table if not exists timeline.documents (
  id text primary key,
  owner_principal_id text not null references timeline.principals(id),
  program_id text not null,
  schema_version text not null check (schema_version = 'd1-timeline-document-409.1'),
  current_revision integer not null default 0 check (current_revision >= 0),
  current_version_id text,
  status text not null default 'DRAFT' check (status in ('DRAFT', 'IN_REVIEW', 'APPROVED', 'ARCHIVED', 'DELETED')),
  document_json jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists timeline.versions (
  id text primary key,
  document_id text not null references timeline.documents(id),
  revision integer not null check (revision > 0),
  parent_version_id text,
  label text not null,
  snapshot_json jsonb not null,
  content_sha256 text not null check (content_sha256 ~ '^[a-f0-9]{64}$'),
  created_by text not null references timeline.principals(id),
  created_at timestamptz not null default now(),
  unique (id, document_id),
  unique (document_id, revision)
);

alter table timeline.versions
  drop constraint if exists versions_parent_document_fkey;
alter table timeline.versions
  add constraint versions_parent_document_fkey
  foreign key (parent_version_id, document_id) references timeline.versions(id, document_id) deferrable initially deferred;

alter table timeline.documents
  drop constraint if exists documents_current_version_id_fkey;
alter table timeline.documents
  add constraint documents_current_version_id_fkey
  foreign key (current_version_id, id) references timeline.versions(id, document_id) deferrable initially deferred;

create table if not exists timeline.checkpoints (
  id text primary key,
  document_id text not null references timeline.documents(id),
  device_id text not null,
  base_revision integer not null,
  snapshot_json jsonb not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  unique (document_id, device_id)
);

create table if not exists timeline.advisor_assignments (
  document_id text not null references timeline.documents(id),
  advisor_principal_id text not null references timeline.principals(id),
  program_id text not null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (document_id, advisor_principal_id, starts_at)
);

create table if not exists timeline.faculty_grants (
  id text primary key,
  document_id text not null references timeline.documents(id),
  version_id text,
  faculty_principal_id text not null references timeline.principals(id),
  actions text[] not null,
  starts_at timestamptz not null,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_by text not null references timeline.principals(id),
  created_at timestamptz not null default now(),
  foreign key (version_id, document_id) references timeline.versions(id, document_id) deferrable initially deferred
);

create table if not exists timeline.review_requests (
  id text primary key,
  document_id text not null references timeline.documents(id),
  version_id text not null,
  version_sha256 text not null check (version_sha256 ~ '^[a-f0-9]{64}$'),
  requested_by text not null references timeline.principals(id),
  assigned_to text not null references timeline.principals(id),
  status text not null check (status in ('REQUESTED', 'IN_REVIEW', 'CHANGES_REQUESTED', 'APPROVED', 'CLOSED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (version_id, document_id) references timeline.versions(id, document_id) deferrable initially deferred
);

create table if not exists timeline.comments (
  id text primary key,
  review_request_id text not null references timeline.review_requests(id),
  author_id text not null references timeline.principals(id),
  author_role text not null,
  body_ciphertext text not null,
  visibility text not null check (visibility in ('SHARED', 'ADVISOR_ONLY')),
  anchor_json jsonb not null default '{}',
  status text not null default 'OPEN' check (status in ('OPEN', 'RESOLVED')),
  created_at timestamptz not null default now()
);

create table if not exists timeline.approval_events (
  id text primary key,
  review_request_id text not null references timeline.review_requests(id),
  document_id text not null references timeline.documents(id),
  version_id text not null,
  content_sha256 text not null check (content_sha256 ~ '^[a-f0-9]{64}$'),
  decision text not null check (decision in ('APPROVED', 'CHANGES_REQUESTED', 'INVALIDATED')),
  actor_id text not null references timeline.principals(id),
  reason text not null,
  created_at timestamptz not null default now(),
  foreign key (version_id, document_id) references timeline.versions(id, document_id) deferrable initially deferred
);

create table if not exists timeline.media_objects (
  id text primary key,
  document_id text not null references timeline.documents(id),
  owner_principal_id text not null references timeline.principals(id),
  object_class text not null check (object_class in ('SOURCE', 'MEDIA', 'EXPORT', 'PREVIEW', 'TEMP')),
  storage_key text not null unique,
  mime_type text not null,
  byte_size bigint not null check (byte_size >= 0),
  content_sha256 text not null check (content_sha256 ~ '^[a-f0-9]{64}$'),
  visibility text not null,
  status text not null check (status in ('PENDING', 'CONFIRMED', 'QUARANTINED', 'DELETED')),
  crop_json jsonb,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  deleted_at timestamptz
);

create table if not exists timeline.export_jobs (
  id text primary key,
  document_id text not null references timeline.documents(id),
  version_id text not null,
  artifact_type text not null,
  export_scope text not null,
  renderer text not null check (renderer in ('MAC_PRO_AUTHORITY', 'WEB_CANDIDATE', 'FIXTURE')),
  status text not null check (status in ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED')),
  requested_by text not null references timeline.principals(id),
  idempotency_key text not null unique,
  artifact_id text,
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (version_id, document_id) references timeline.versions(id, document_id) deferrable initially deferred
);

create table if not exists timeline.artifacts (
  id text primary key,
  document_id text not null references timeline.documents(id),
  version_id text not null,
  artifact_type text not null,
  export_scope text not null,
  manifest_json jsonb not null,
  content_sha256 text not null check (content_sha256 ~ '^[a-f0-9]{64}$'),
  status text not null default 'READY',
  created_at timestamptz not null default now(),
  unique (document_id, version_id, artifact_type, export_scope, content_sha256),
  foreign key (version_id, document_id) references timeline.versions(id, document_id) deferrable initially deferred
);

alter table timeline.export_jobs
  drop constraint if exists export_jobs_artifact_id_fkey;
alter table timeline.export_jobs
  add constraint export_jobs_artifact_id_fkey
  foreign key (artifact_id) references timeline.artifacts(id) deferrable initially deferred;

create table if not exists timeline.artifact_files (
  artifact_id text not null references timeline.artifacts(id),
  role text not null,
  object_id text not null references timeline.media_objects(id),
  filename text not null,
  mime_type text not null,
  byte_size bigint not null check (byte_size >= 0),
  content_sha256 text not null check (content_sha256 ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  primary key (artifact_id, role, object_id)
);

create table if not exists timeline.filevault_links (
  id text primary key,
  artifact_id text not null references timeline.artifacts(id),
  adapter text not null check (adapter in ('LEGACY', 'V2')),
  external_file_id text not null,
  external_version_id text not null,
  status text not null check (status in ('PENDING', 'LINKED', 'FAILED', 'WITHDRAWN')),
  artifact_sha256 text not null check (artifact_sha256 ~ '^[a-f0-9]{64}$'),
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (artifact_id, adapter)
);

create table if not exists timeline.outbox_events (
  id text primary key,
  aggregate_id text not null,
  event_type text not null,
  payload_json jsonb not null,
  attempts integer not null default 0,
  available_at timestamptz not null default now(),
  published_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists timeline.idempotency_keys (
  principal_id text not null references timeline.principals(id),
  operation text not null,
  idempotency_key text not null,
  response_sha256 text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (principal_id, operation, idempotency_key)
);

create table if not exists timeline.audit_events (
  id text primary key,
  actor_id text not null,
  action text not null,
  resource_type text not null,
  resource_id text not null,
  outcome text not null check (outcome in ('ALLOW', 'DENY', 'SUCCESS', 'FAILURE')),
  request_id text not null,
  metadata_json jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists timeline.deletion_requests (
  id text primary key,
  principal_id text not null references timeline.principals(id),
  document_id text not null references timeline.documents(id),
  status text not null check (status in ('REQUESTED', 'LEGAL_HOLD', 'IN_PROGRESS', 'COMPLETED', 'DENIED')),
  legal_hold boolean not null default false,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists timeline_documents_owner_idx on timeline.documents(owner_principal_id, updated_at desc);
create index if not exists timeline_documents_program_idx on timeline.documents(program_id, updated_at desc);
create index if not exists timeline_versions_document_idx on timeline.versions(document_id, revision desc);
create index if not exists timeline_versions_content_idx on timeline.versions(document_id, content_sha256);
create index if not exists timeline_reviews_assignee_idx on timeline.review_requests(assigned_to, status, updated_at desc);
create index if not exists timeline_approval_version_idx on timeline.approval_events(document_id, version_id, created_at desc);
create index if not exists timeline_export_queue_idx on timeline.export_jobs(status, created_at);
create index if not exists timeline_outbox_pending_idx on timeline.outbox_events(available_at) where published_at is null;
create index if not exists timeline_audit_resource_idx on timeline.audit_events(resource_type, resource_id, created_at desc);

alter table timeline.principals enable row level security;
alter table timeline.principal_programs enable row level security;
alter table timeline.documents enable row level security;
alter table timeline.versions enable row level security;
alter table timeline.checkpoints enable row level security;
alter table timeline.advisor_assignments enable row level security;
alter table timeline.faculty_grants enable row level security;
alter table timeline.review_requests enable row level security;
alter table timeline.comments enable row level security;
alter table timeline.approval_events enable row level security;
alter table timeline.media_objects enable row level security;
alter table timeline.export_jobs enable row level security;
alter table timeline.artifacts enable row level security;
alter table timeline.artifact_files enable row level security;
alter table timeline.filevault_links enable row level security;
alter table timeline.outbox_events enable row level security;
alter table timeline.idempotency_keys enable row level security;
alter table timeline.audit_events enable row level security;
alter table timeline.deletion_requests enable row level security;

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

create or replace function timeline.current_program_ids()
returns text[]
language sql
stable
security definer
set search_path = timeline, pg_temp
as $$
  select coalesce(array_agg(pp.program_id order by pp.program_id), array[]::text[])
  from timeline.principal_programs pp
  join timeline.principals p on p.id = pp.principal_id
  where pp.principal_id = timeline.current_principal_id()
    and p.status = 'ACTIVE'
    and p.role = timeline.current_role()
    and pp.program_id in (
      select jsonb_array_elements_text(coalesce(timeline.jwt_claims()->'program_ids', '[]'::jsonb))
    )
$$;

create or replace function timeline.service_has_scope(required_scope text)
returns boolean
language sql
stable
security definer
set search_path = timeline, pg_temp
as $$
  select timeline.current_principal_is_active('SERVICE')
    and required_scope in (
      select jsonb_array_elements_text(coalesce(timeline.jwt_claims()->'service_scopes', '[]'::jsonb))
    )
$$;

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

create policy principals_self_read on timeline.principals
  for select using (id = timeline.current_principal_id() or timeline.service_has_scope('audit:read'));
create policy principal_programs_self_read on timeline.principal_programs
  for select using (principal_id = timeline.current_principal_id() or timeline.service_has_scope('audit:read'));

create policy documents_read on timeline.documents
  for select using (
    (timeline.current_principal_is_active('STUDENT') and owner_principal_id = timeline.current_principal_id())
    or timeline.can_read_document(id)
  );
create policy documents_student_insert on timeline.documents
  for insert with check (
    timeline.current_principal_is_active('STUDENT')
    and owner_principal_id = timeline.current_principal_id()
    and program_id = any(timeline.current_program_ids())
  );
create policy documents_student_update on timeline.documents
  for update using (timeline.current_principal_is_active('STUDENT') and owner_principal_id = timeline.current_principal_id())
  with check (timeline.current_principal_is_active('STUDENT') and owner_principal_id = timeline.current_principal_id() and program_id = any(timeline.current_program_ids()));

create policy versions_read on timeline.versions
  for select using (timeline.can_read_document(document_id));
create policy versions_owner_insert on timeline.versions
  for insert with check (
    timeline.current_principal_is_active('STUDENT')
    and
    exists (select 1 from timeline.documents d where d.id = document_id and d.owner_principal_id = timeline.current_principal_id())
  );

create policy checkpoints_owner_all on timeline.checkpoints
  for all using (
    timeline.current_principal_is_active('STUDENT') and
    exists (select 1 from timeline.documents d where d.id = document_id and d.owner_principal_id = timeline.current_principal_id())
  ) with check (
    timeline.current_principal_is_active('STUDENT') and
    exists (select 1 from timeline.documents d where d.id = document_id and d.owner_principal_id = timeline.current_principal_id())
  );

create policy assignments_scoped_read on timeline.advisor_assignments
  for select using (
    advisor_principal_id = timeline.current_principal_id()
    or program_id = any(timeline.current_program_ids())
    or timeline.service_has_scope('audit:read')
  );
create policy assignments_admin_write on timeline.advisor_assignments
  for all using (timeline.current_role() = 'PROGRAM_ADMIN' and program_id = any(timeline.current_program_ids()))
  with check (timeline.current_role() = 'PROGRAM_ADMIN' and program_id = any(timeline.current_program_ids()));

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
create policy reviews_owner_insert on timeline.review_requests
  for insert with check (
    timeline.current_principal_is_active('STUDENT')
    and requested_by = timeline.current_principal_id()
    and exists (select 1 from timeline.documents d where d.id = document_id and d.owner_principal_id = timeline.current_principal_id())
    and exists (
      select 1 from timeline.advisor_assignments a
      where a.document_id = document_id
        and a.advisor_principal_id = assigned_to
        and a.program_id = (select d.program_id from timeline.documents d where d.id = document_id)
        and a.starts_at <= now()
        and (a.ends_at is null or a.ends_at > now())
    )
  );
create policy reviews_assignee_update on timeline.review_requests
  for update using (timeline.current_principal_is_active('ADVISOR') and assigned_to = timeline.current_principal_id())
  with check (timeline.current_principal_is_active('ADVISOR') and assigned_to = timeline.current_principal_id());

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
create policy comments_participant_insert on timeline.comments
  for insert with check (
    timeline.current_principal_is_active()
    and author_id = timeline.current_principal_id()
    and author_role = timeline.current_role()
    and exists (
      select 1 from timeline.review_requests r
      join timeline.documents d on d.id = r.document_id
      where r.id = review_request_id
        and (d.owner_principal_id = timeline.current_principal_id() or r.assigned_to = timeline.current_principal_id())
    )
    and not (timeline.current_role() = 'STUDENT' and visibility = 'ADVISOR_ONLY')
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
create policy media_owner_write on timeline.media_objects
  for all using (timeline.current_principal_is_active('STUDENT') and owner_principal_id = timeline.current_principal_id())
  with check (
    timeline.current_principal_is_active('STUDENT')
    and owner_principal_id = timeline.current_principal_id()
    and exists (select 1 from timeline.documents d where d.id = document_id and d.owner_principal_id = timeline.current_principal_id())
  );
create policy media_service_write on timeline.media_objects
  for all using (timeline.service_has_scope('artifact:create'))
  with check (timeline.service_has_scope('artifact:create'));

create policy exports_read on timeline.export_jobs
  for select using (timeline.can_read_document(document_id));
create policy exports_owner_insert on timeline.export_jobs
  for insert with check (
    timeline.current_principal_is_active('STUDENT')
    and requested_by = timeline.current_principal_id()
    and exists (select 1 from timeline.documents d where d.id = document_id and d.owner_principal_id = timeline.current_principal_id())
  );
create policy exports_service_update on timeline.export_jobs
  for update using (timeline.service_has_scope('artifact:create'))
  with check (timeline.service_has_scope('artifact:create'));

create policy artifacts_read on timeline.artifacts
  for select using (timeline.can_read_document(document_id));
create policy artifacts_service_write on timeline.artifacts
  for all using (timeline.service_has_scope('artifact:create'))
  with check (timeline.service_has_scope('artifact:create'));

create policy artifact_files_read on timeline.artifact_files
  for select using (exists (select 1 from timeline.artifacts a where a.id = artifact_id and timeline.can_read_document(a.document_id)));
create policy artifact_files_service_write on timeline.artifact_files
  for all using (timeline.service_has_scope('artifact:create'))
  with check (timeline.service_has_scope('artifact:create'));

create policy filevault_links_read on timeline.filevault_links
  for select using (exists (select 1 from timeline.artifacts a where a.id = artifact_id and timeline.can_read_document(a.document_id)));
create policy filevault_links_service_write on timeline.filevault_links
  for all using (timeline.service_has_scope('filevault:publish'))
  with check (timeline.service_has_scope('filevault:publish'));

create policy outbox_service_only on timeline.outbox_events
  for all using (timeline.service_has_scope('audit:read'))
  with check (timeline.service_has_scope('audit:read'));
create policy idempotency_self on timeline.idempotency_keys
  for all using (timeline.current_principal_is_active() and principal_id = timeline.current_principal_id())
  with check (timeline.current_principal_is_active() and principal_id = timeline.current_principal_id());
create policy audit_service_read on timeline.audit_events
  for select using (timeline.service_has_scope('audit:read'));
create policy audit_service_insert on timeline.audit_events
  for insert with check (timeline.service_has_scope('audit:read') or actor_id = timeline.current_principal_id());
create policy deletion_owner on timeline.deletion_requests
  for all using (timeline.current_principal_is_active('STUDENT') and principal_id = timeline.current_principal_id())
  with check (
    timeline.current_principal_is_active('STUDENT')
    and principal_id = timeline.current_principal_id()
    and exists (select 1 from timeline.documents d where d.id = document_id and d.owner_principal_id = timeline.current_principal_id())
  );

revoke all on schema timeline from public;
revoke all on all tables in schema timeline from public;
revoke all on all sequences in schema timeline from public;

commit;
