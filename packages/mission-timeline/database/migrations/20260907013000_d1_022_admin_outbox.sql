begin;
do $$ begin
  if timeline.schema_version() <> 'd1-timeline-db-500.1' or not exists (
    select 1 from timeline.principals where id='timeline_admin_authority_022' and role='SERVICE' and status='ACTIVE'
  ) then raise exception 'D1-022 admin workflow requires the verified 500.1 schema and active 022 authority'; end if;
end $$;

-- Complete only the actions advertised by the short, independently audited
-- selected-student grant. These are invoker policies; no RLS bypass is added.
create policy reviews_admin_insert_022 on timeline.review_requests for insert to timeline_authenticated
with check (
  coalesce((timeline.jwt_claims()->>'admin_workspace')::boolean,false)
  and requested_by=timeline.current_principal_id()
  and status='REQUESTED'
  and timeline.has_admin_resource_grant(document_id,'review:request')
  and exists(select 1 from timeline.versions v where v.id=version_id
    and v.document_id=review_requests.document_id and v.content_sha256=version_sha256)
  and exists(select 1 from timeline.advisor_assignments a join timeline.documents d on d.id=a.document_id
    where a.document_id=review_requests.document_id and a.advisor_principal_id=assigned_to
      and a.program_id=d.program_id and a.starts_at<=now() and (a.ends_at is null or a.ends_at>now()))
);
create policy reviews_admin_update_022 on timeline.review_requests for update to timeline_authenticated
using (coalesce((timeline.jwt_claims()->>'admin_workspace')::boolean,false)
  and timeline.has_admin_resource_grant(document_id,'review:decide'))
with check (coalesce((timeline.jwt_claims()->>'admin_workspace')::boolean,false)
  and timeline.has_admin_resource_grant(document_id,'review:decide')
  and status in ('APPROVED','CHANGES_REQUESTED')
  and exists(select 1 from timeline.versions v where v.id=version_id
    and v.document_id=review_requests.document_id and v.content_sha256=version_sha256));

create policy comments_admin_insert_022 on timeline.comments for insert to timeline_authenticated
with check (
  coalesce((timeline.jwt_claims()->>'admin_workspace')::boolean,false)
  and author_id=timeline.current_principal_id() and author_role='PROGRAM_ADMIN'
  and exists(select 1 from timeline.review_requests r where r.id=review_request_id
    and timeline.has_admin_resource_grant(r.document_id,'review:comment'))
);
create policy approvals_admin_insert_022 on timeline.approval_events for insert to timeline_authenticated
with check (
  coalesce((timeline.jwt_claims()->>'admin_workspace')::boolean,false)
  and actor_id=timeline.current_principal_id()
  and exists(select 1 from timeline.review_requests r join timeline.versions v
    on v.id=r.version_id and v.document_id=r.document_id
    where r.id=review_request_id and r.document_id=approval_events.document_id
      and r.version_id=approval_events.version_id and r.version_sha256=approval_events.content_sha256
      and v.content_sha256=approval_events.content_sha256)
  and (
    (decision in ('APPROVED','CHANGES_REQUESTED') and timeline.has_admin_resource_grant(document_id,'review:decide'))
    or (decision='INVALIDATED' and timeline.has_admin_resource_grant(document_id,'version:create')
      and timeline.has_admin_resource_grant(document_id,'document:edit')
      and exists(select 1 from timeline.documents d join timeline.versions v on v.id=d.current_version_id
        and v.document_id=d.id where d.id=approval_events.document_id
          and v.created_by=timeline.current_principal_id() and v.content_sha256<>approval_events.content_sha256))
  )
);
create policy exports_admin_insert_022 on timeline.export_jobs for insert to timeline_authenticated
with check (
  coalesce((timeline.jwt_claims()->>'admin_workspace')::boolean,false)
  and requested_by=timeline.current_principal_id() and status='QUEUED' and artifact_id is null
  and timeline.has_admin_resource_grant(document_id,'artifact:create')
  and exists(select 1 from timeline.versions v where v.id=version_id and v.document_id=export_jobs.document_id)
);

-- A queued notification must correspond to the exact workflow record written by
-- this actor, with matching payload and timestamp. It cannot announce invented
-- facts, target a second granted student, or claim a different actor's work.
create function timeline.admin_outbox_matches_022(
  event_kind text, event_actor text, event_document text, event_aggregate text,
  event_payload jsonb, event_attempts integer, event_available timestamptz, event_published timestamptz
) returns boolean language sql stable security invoker set search_path=timeline,pg_temp as $$
  select timeline.current_principal_is_active('PROGRAM_ADMIN')
    and coalesce((timeline.jwt_claims()->>'admin_workspace')::boolean,false)
    and event_actor=timeline.current_principal_id()
    and event_document=event_aggregate and event_payload->>'documentId'=event_document
    and event_attempts=0 and event_published is null
    and timeline.has_admin_resource_grant(event_document,'document:read')
    and case event_kind
      when 'timeline.document.versioned' then
        timeline.has_admin_resource_grant(event_document,'version:create')
        and timeline.has_admin_resource_grant(event_document,'document:edit')
        and exists(select 1 from timeline.versions v where v.id=event_payload->>'versionId'
          and v.document_id=event_document and v.created_by=event_actor and v.created_at=event_available
          and v.revision::text=event_payload->>'revision' and v.content_sha256=event_payload->>'contentSha256')
      when 'timeline.approval.invalidated' then
        timeline.has_admin_resource_grant(event_document,'version:create')
        and timeline.has_admin_resource_grant(event_document,'document:edit')
        and exists(select 1 from timeline.approval_events a join timeline.versions v
          on v.document_id=a.document_id where a.document_id=event_document
          and a.version_id=event_payload->>'previousVersionId' and a.actor_id=event_actor
          and a.decision='INVALIDATED' and a.created_at=event_available
          and v.id=event_payload->>'newVersionId' and v.created_by=event_actor
          and v.content_sha256<>a.content_sha256)
      when 'timeline.review.requested' then
        timeline.has_admin_resource_grant(event_document,'review:request')
        and exists(select 1 from timeline.review_requests r where r.id=event_payload->>'reviewRequestId'
          and r.document_id=event_document and r.requested_by=event_actor and r.created_at=event_available
          and r.version_id=event_payload->>'versionId' and r.assigned_to=event_payload->>'assignedTo')
      when 'timeline.comment.created' then
        timeline.has_admin_resource_grant(event_document,'review:comment')
        and exists(select 1 from timeline.comments c join timeline.review_requests r on r.id=c.review_request_id
          where c.id=event_payload->>'commentId' and c.author_id=event_actor and c.author_role='PROGRAM_ADMIN'
            and c.created_at=event_available and c.review_request_id=event_payload->>'reviewRequestId'
            and c.visibility=event_payload->>'visibility' and r.document_id=event_document)
      when 'timeline.export.requested' then
        timeline.has_admin_resource_grant(event_document,'artifact:create')
        and exists(select 1 from timeline.export_jobs e where e.id=event_payload->>'exportJobId'
          and e.document_id=event_document and e.requested_by=event_actor and e.created_at=event_available
          and e.version_id=event_payload->>'versionId' and e.artifact_type=event_payload->>'artifactType'
          and e.export_scope=event_payload->>'scope' and e.renderer=event_payload->>'renderer')
      when 'timeline.review.approved' then
        timeline.has_admin_resource_grant(event_document,'review:decide')
        and exists(select 1 from timeline.approval_events a where a.document_id=event_document
          and a.actor_id=event_actor and a.created_at=event_available and a.decision='APPROVED'
          and a.review_request_id=event_payload->>'reviewRequestId' and a.version_id=event_payload->>'versionId')
      when 'timeline.review.changes_requested' then
        timeline.has_admin_resource_grant(event_document,'review:decide')
        and exists(select 1 from timeline.approval_events a where a.document_id=event_document
          and a.actor_id=event_actor and a.created_at=event_available and a.decision='CHANGES_REQUESTED'
          and a.review_request_id=event_payload->>'reviewRequestId' and a.version_id=event_payload->>'versionId')
      else false end
$$;
revoke all on function timeline.admin_outbox_matches_022(text,text,text,text,jsonb,integer,timestamptz,timestamptz) from public;
grant execute on function timeline.admin_outbox_matches_022(text,text,text,text,jsonb,integer,timestamptz,timestamptz) to timeline_authenticated;
create policy outbox_admin_insert_022 on timeline.outbox_events for insert to timeline_authenticated
with check (timeline.admin_outbox_matches_022(event_type,actor_id,document_id,aggregate_id,payload_json,attempts,available_at,published_at));
-- The older administrator review-event policy is retained for rollback compatibility,
-- but cannot bypass these checks for an authenticated 022 workspace request.
create policy outbox_admin_scope_022 on timeline.outbox_events as restrictive for insert to timeline_authenticated
with check (
  not (timeline.current_role()='PROGRAM_ADMIN' and coalesce((timeline.jwt_claims()->>'admin_workspace')::boolean,false))
  or timeline.admin_outbox_matches_022(event_type,actor_id,document_id,aggregate_id,payload_json,attempts,available_at,published_at)
);
commit;
