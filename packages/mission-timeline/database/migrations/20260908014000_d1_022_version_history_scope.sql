-- D1-TIMELINE-STORYFORGE-LIVE-022.
-- Restrict immutable Timeline history to the exact version scope granted to
-- faculty while preserving owner, assigned advisor, audited administrator,
-- service and break-glass access.
begin;

do $$
begin
  if timeline.schema_version() <> 'd1-timeline-db-500.1' then
    raise exception 'D1-022 version history scope requires Timeline schema d1-timeline-db-500.1';
  end if;
end
$$;

create or replace function timeline.can_read_version_022(
  target_document_id text,
  target_version_id text
)
returns boolean
language sql
stable
security definer
set search_path = timeline, pg_temp
as $$
  select timeline.current_principal_is_active()
    and exists (
      select 1
      from timeline.documents d
      where d.id = target_document_id
        and d.deleted_at is null
        and (
          (timeline.current_role() = 'STUDENT'
            and d.owner_principal_id = timeline.current_principal_id())
          or (timeline.current_role() = 'ADVISOR' and exists (
            select 1
            from timeline.advisor_assignments a
            where a.document_id = d.id
              and a.advisor_principal_id = timeline.current_principal_id()
              and a.program_id = d.program_id
              and d.program_id = any(timeline.current_program_ids())
              and a.starts_at <= now()
              and (a.ends_at is null or a.ends_at > now())
          ))
          or timeline.has_admin_resource_grant(d.id, 'document:read')
          or (timeline.current_role() = 'FACULTY' and exists (
            select 1
            from timeline.faculty_grants g
            where g.document_id = d.id
              and g.faculty_principal_id = timeline.current_principal_id()
              and (g.version_id is null or g.version_id = target_version_id)
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

revoke all on function timeline.can_read_version_022(text,text) from public;
grant execute on function timeline.can_read_version_022(text,text)
  to timeline_authenticated, timeline_identity_sync, timeline_grant_authority;

drop policy versions_read on timeline.versions;
create policy versions_read on timeline.versions
  for select using (timeline.can_read_version_022(document_id, id));

comment on function timeline.can_read_version_022(text,text) is
  'D1-022 exact-version history authorization. A version-scoped faculty grant cannot reveal sibling versions.';

commit;
