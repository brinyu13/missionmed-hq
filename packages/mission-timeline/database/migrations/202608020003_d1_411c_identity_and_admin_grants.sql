begin;

do $$
begin
  if timeline.schema_version() <> 'd1-timeline-db-413.2' then
    raise exception 'D1-411C migration requires schema version d1-timeline-db-413.2';
  end if;
end
$$;

alter table timeline.principals add column wp_user_id bigint;
update timeline.principals set wp_user_id = matrix_wp_user_id;
alter table timeline.principals alter column wp_user_id set not null;
alter table timeline.principals add constraint principals_wp_user_id_key_411c unique (wp_user_id);

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
      and (
        p.role = 'SERVICE'
        or p.wp_user_id = nullif(timeline.jwt_claims()->>'wp_user_id', '')::bigint
      )
      and p.status = 'ACTIVE'
      and p.role = timeline.current_role()
      and (expected_role is null or p.role = expected_role)
      and (
        (p.role = 'STUDENT' and coalesce((timeline.jwt_claims()->>'has_learndash_3893_access')::boolean, false))
        or (p.role = 'PROGRAM_ADMIN' and coalesce((timeline.jwt_claims()->>'is_wordpress_administrator')::boolean, false))
        or p.role in ('ADVISOR', 'PLATFORM_ADMIN', 'FACULTY', 'SERVICE')
      )
  )
$$;

create or replace function timeline.reject_principal_identity_change_411c()
returns trigger
language plpgsql
as $$
begin
  if new.id is distinct from old.id
     or new.wp_user_id is distinct from old.wp_user_id
     or new.matrix_wp_user_id is distinct from old.matrix_wp_user_id then
    raise exception 'Timeline principal identity is immutable';
  end if;
  return new;
end
$$;

create trigger principals_identity_immutable_411c
before update on timeline.principals
for each row execute function timeline.reject_principal_identity_change_411c();

create policy principals_identity_service_insert_411c on timeline.principals
  for insert with check (
    timeline.current_principal_is_active('SERVICE')
    and timeline.service_has_scope('audit:read')
  );
create policy principal_programs_identity_service_insert_411c on timeline.principal_programs
  for insert with check (
    timeline.current_principal_is_active('SERVICE')
    and timeline.service_has_scope('audit:read')
  );

create table timeline.admin_resource_grants (
  id text primary key,
  administrator_principal_id text not null references timeline.principals(id),
  student_principal_id text not null references timeline.principals(id),
  document_id text not null,
  actions text[] not null,
  created_by_principal_id text not null references timeline.principals(id),
  authorization_audit_id text not null references timeline.audit_events(id),
  reason text not null check (length(btrim(reason)) between 8 and 1000),
  starts_at timestamptz not null,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (document_id, student_principal_id)
    references timeline.documents(id, owner_principal_id)
    deferrable initially deferred,
  check (administrator_principal_id <> student_principal_id),
  check (administrator_principal_id <> created_by_principal_id),
  check (expires_at > starts_at),
  check (expires_at <= starts_at + interval '30 days'),
  check (revoked_at is null or revoked_at >= starts_at),
  check (cardinality(actions) between 1 and 10),
  check (actions <@ array[
    'document:read', 'document:edit', 'version:create', 'review:request',
    'review:read', 'review:comment', 'review:decide',
    'artifact:create', 'artifact:read', 'audit:read'
  ]::text[])
);

create index admin_resource_grants_subject_idx_411c
  on timeline.admin_resource_grants(administrator_principal_id, document_id, expires_at)
  where revoked_at is null;

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

create trigger admin_resource_grant_validate_411c
before insert or update on timeline.admin_resource_grants
for each row execute function timeline.validate_admin_resource_grant_411c();

alter table timeline.admin_resource_grants enable row level security;
alter table timeline.admin_resource_grants force row level security;

create policy admin_resource_grants_subject_read_411c on timeline.admin_resource_grants
  for select using (
    administrator_principal_id = timeline.current_principal_id()
    or student_principal_id = timeline.current_principal_id()
    or timeline.service_has_scope('audit:read')
    or timeline.break_glass_active()
  );

create policy admin_resource_grants_authority_insert_411c on timeline.admin_resource_grants
  for insert with check (
    created_by_principal_id = timeline.current_principal_id()
    and (timeline.service_has_scope('audit:read') or timeline.break_glass_active())
  );

create policy admin_resource_grants_authority_update_411c on timeline.admin_resource_grants
  for update using (
    timeline.service_has_scope('audit:read') or timeline.break_glass_active()
  ) with check (
    timeline.service_has_scope('audit:read') or timeline.break_glass_active()
  );

create or replace function timeline.has_admin_resource_grant(target_document_id text, required_action text)
returns boolean
language sql
stable
security definer
set search_path = timeline, pg_temp
as $$
  select timeline.current_principal_is_active('PROGRAM_ADMIN')
    and exists (
      select 1
      from timeline.admin_resource_grants g
      where g.administrator_principal_id = timeline.current_principal_id()
        and g.document_id = target_document_id
        and g.starts_at <= now()
        and g.expires_at > now()
        and g.revoked_at is null
        and required_action = any(g.actions)
    )
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
      or timeline.has_admin_resource_grant(target_document_id, 'document:read')
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

create policy documents_admin_update_411c on timeline.documents
  for update using (timeline.has_admin_resource_grant(id, 'document:edit'))
  with check (timeline.has_admin_resource_grant(id, 'document:edit'));

create policy versions_admin_insert_411c on timeline.versions
  for insert with check (timeline.has_admin_resource_grant(document_id, 'version:create'));

create policy checkpoints_admin_all_411c on timeline.checkpoints
  for all using (timeline.has_admin_resource_grant(document_id, 'document:edit'))
  with check (timeline.has_admin_resource_grant(document_id, 'document:edit'));

drop policy assignments_admin_write on timeline.advisor_assignments;
create policy assignments_admin_grant_write_411c on timeline.advisor_assignments
  for all using (timeline.has_admin_resource_grant(document_id, 'review:request'))
  with check (timeline.has_admin_resource_grant(document_id, 'review:request'));

drop policy faculty_grants_admin_insert on timeline.faculty_grants;
drop policy faculty_grants_admin_update on timeline.faculty_grants;
drop policy faculty_grants_admin_delete on timeline.faculty_grants;
create policy faculty_grants_admin_grant_insert_411c on timeline.faculty_grants
  for insert with check (timeline.has_admin_resource_grant(document_id, 'review:request'));
create policy faculty_grants_admin_grant_update_411c on timeline.faculty_grants
  for update using (timeline.has_admin_resource_grant(document_id, 'review:request'))
  with check (timeline.has_admin_resource_grant(document_id, 'review:request'));
create policy faculty_grants_admin_grant_delete_411c on timeline.faculty_grants
  for delete using (timeline.has_admin_resource_grant(document_id, 'review:request'));

create or replace function timeline.schema_version()
returns text
language sql
immutable
as $$
  select 'd1-timeline-db-411c.1'::text
$$;

comment on table timeline.admin_resource_grants is
  'Explicit, bounded, revocable and independently audited administrator-to-student-resource access. WordPress administrator status alone grants no document access.';
comment on column timeline.principals.wp_user_id is
  'Canonical immutable WordPress identity for Timeline. matrix_wp_user_id is retained only as a compatibility alias during D1-411C.';

commit;
