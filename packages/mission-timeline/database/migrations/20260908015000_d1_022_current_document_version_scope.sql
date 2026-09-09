-- D1-TIMELINE-STORYFORGE-LIVE-022.
-- A version-scoped faculty grant may reveal the current document only when it
-- names that exact current version. Document-wide grants retain current access.
begin;

do $$
begin
  if timeline.schema_version() <> 'd1-timeline-db-500.1'
     or to_regprocedure('timeline.can_read_version_022(text,text)') is null then
    raise exception 'D1-022 current-document scope requires exact-version history authorization';
  end if;
end
$$;

create or replace function timeline.can_read_current_document_022(
  target_document_id text,
  target_current_version_id text,
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
          and (g.version_id is null or g.version_id = target_current_version_id)
          and g.starts_at <= now()
          and g.expires_at > now()
          and g.revoked_at is null
          and 'document:read' = any(g.actions)
      ))
      or timeline.service_has_scope('document:read')
      or timeline.break_glass_active()
    )
$$;

revoke all on function timeline.can_read_current_document_022(text,text,text,timestamptz) from public;
grant execute on function timeline.can_read_current_document_022(text,text,text,timestamptz)
  to timeline_authenticated, timeline_identity_sync, timeline_grant_authority;

drop policy documents_read on timeline.documents;
create policy documents_read on timeline.documents
  for select using (
    (
      timeline.current_principal_is_active('STUDENT')
      and owner_principal_id = timeline.current_principal_id()
      and deleted_at is null
    )
    or timeline.can_read_current_document_022(id, current_version_id, program_id, deleted_at)
  );

comment on function timeline.can_read_current_document_022(text,text,text,timestamptz) is
  'D1-022 current-document authorization. An older version-scoped faculty grant cannot reveal the current private payload.';

commit;
