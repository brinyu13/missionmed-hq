begin;
do $$ begin
  if timeline.schema_version() <> 'd1-timeline-db-500.1' then raise exception 'D1-022 requires verified500.1 schema'; end if;
  if exists(select 1 from timeline.principals where id='timeline_admin_authority_022' or wp_user_id=-22022) then
    raise exception 'D1-022 authority identity already exists; verify the migration ledger instead of replaying';
  end if;
end $$;

-- A nonperson authority identity. The negative namespace cannot represent a WordPress
-- account or student and is never admitted by the browser JWT verifier.
insert into timeline.principals(id,matrix_wp_user_id,wp_user_id,role,status)
values('timeline_admin_authority_022',-22022,-22022,'SERVICE','ACTIVE');
insert into timeline.audit_events(id,actor_id,action,resource_type,resource_id,outcome,request_id,metadata_json)
values('audit_d1_022_admin_authority_installed','timeline_admin_authority_022','SYSTEM_AUTHORITY_INSTALLED','PRINCIPAL',
 'timeline_admin_authority_022','ALLOW','D1-TIMELINE-STORYFORGE-LIVE-022',
 '{"authority":"D1-TIMELINE-STORYFORGE-LIVE-022","source_sha256":"e27016edef2f722f1424a16d7246e5e1851d266b7825d832f7bbf62e84ec147c","purpose":"Short document grants for the current allowlisted Founder administrator and freshly eligible Timeline student"}'::jsonb);

create or replace function timeline.has_admin_resource_grant(target_document_id text, required_action text)
returns boolean language sql stable security definer set search_path=timeline,pg_temp as $$
  select timeline.current_principal_is_active('PROGRAM_ADMIN') and exists(
    select 1 from timeline.admin_resource_grants g
    join timeline.principals s on s.id=g.student_principal_id and s.role='STUDENT' and s.status='ACTIVE'
    where g.administrator_principal_id=timeline.current_principal_id()
      and g.document_id=target_document_id and g.starts_at<=now() and g.expires_at>now()
      and g.revoked_at is null and required_action=any(g.actions)
      and (not coalesce((timeline.jwt_claims()->>'admin_workspace')::boolean,false)
        or (g.student_principal_id=timeline.jwt_claims()->>'admin_subject_principal_id'
          and s.wp_user_id=nullif(timeline.jwt_claims()->>'admin_subject_wp_user_id','')::bigint))
  )
$$;
revoke all on function timeline.has_admin_resource_grant(text,text) from public;
grant execute on function timeline.has_admin_resource_grant(text,text) to timeline_authenticated,timeline_identity_sync,timeline_grant_authority;
comment on function timeline.has_admin_resource_grant(text,text) is '022 workspace additionally binds every grant to the current server-verified student subject. Existing bounded grant expiry, revocation and independent audit remain mandatory.';
commit;
