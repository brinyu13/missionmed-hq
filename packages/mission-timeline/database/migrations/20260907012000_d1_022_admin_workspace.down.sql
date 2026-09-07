-- Operational rollback retains immutable identity/audit custody and the subject
-- restriction. It only revokes grants issued by this022 service and disables it.
-- Run through the approved release runner; previous application restore does not
-- require deleting additive schema or weakening authorization functions.
begin;
lock table timeline.admin_resource_grants in share row exclusive mode;
do $$ begin
  if not exists(select 1 from timeline.principals where id='timeline_admin_authority_022' and wp_user_id=-22022 and role='SERVICE') then
    raise exception 'D1-022 authority identity mismatch; rollback refused';
  end if;
end $$;
insert into timeline.audit_events(id,actor_id,action,resource_type,resource_id,outcome,request_id,metadata_json)
select 'audit_d1_022_rollback_' || md5(id),'timeline_admin_authority_022','ADMIN_RESOURCE_GRANT_REVOKED','DOCUMENT',document_id,
 'ALLOW','D1-TIMELINE-STORYFORGE-LIVE-022:ROLLBACK',
 jsonb_build_object('grant_id',id,'reason','D1-022 operational rollback','authority','D1-TIMELINE-STORYFORGE-LIVE-022')
from timeline.admin_resource_grants where created_by_principal_id='timeline_admin_authority_022' and revoked_at is null
on conflict(id) do nothing;
update timeline.admin_resource_grants set revoked_at=greatest(clock_timestamp(),starts_at),updated_at=clock_timestamp()
where created_by_principal_id='timeline_admin_authority_022' and revoked_at is null;
insert into timeline.audit_events(id,actor_id,action,resource_type,resource_id,outcome,request_id,metadata_json)
values('audit_d1_022_authority_rollback','timeline_admin_authority_022','SYSTEM_AUTHORITY_DISABLED','PRINCIPAL','timeline_admin_authority_022','ALLOW',
 'D1-TIMELINE-STORYFORGE-LIVE-022:ROLLBACK','{"reason":"D1-022 operational rollback; immutable custody and subject restrictions retained"}'::jsonb)
on conflict(id) do nothing;
update timeline.principals set status='SUSPENDED' where id='timeline_admin_authority_022' and wp_user_id=-22022 and role='SERVICE';
commit;
