\set ON_ERROR_STOP on

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'timeline_runtime_413') then
    create role timeline_runtime_413 nologin nosuperuser nocreatedb nocreaterole noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'timeline_public_413') then
    create role timeline_public_413 nologin nosuperuser nocreatedb nocreaterole noinherit;
  end if;
end
$$;

grant usage on schema timeline to timeline_runtime_413;
grant execute on all functions in schema timeline to timeline_runtime_413;
grant select, insert, update, delete on all tables in schema timeline to timeline_runtime_413;

insert into timeline.principals (id, matrix_wp_user_id, role, status) values
  ('student_a', 410001, 'STUDENT', 'ACTIVE'),
  ('student_b', 410002, 'STUDENT', 'ACTIVE'),
  ('advisor_assigned', 410003, 'ADVISOR', 'ACTIVE'),
  ('advisor_unassigned', 410004, 'ADVISOR', 'ACTIVE'),
  ('advisor_cross_program', 410005, 'ADVISOR', 'ACTIVE'),
  ('program_admin_a', 410006, 'PROGRAM_ADMIN', 'ACTIVE'),
  ('faculty_active', 410007, 'FACULTY', 'ACTIVE'),
  ('faculty_expired', 410008, 'FACULTY', 'ACTIVE'),
  ('service_export', 410009, 'SERVICE', 'ACTIVE'),
  ('platform_breakglass', 410010, 'PLATFORM_ADMIN', 'ACTIVE'),
  ('student_suspended', 410011, 'STUDENT', 'SUSPENDED');

insert into timeline.principal_programs (principal_id, program_id) values
  ('student_a', 'program_a'),
  ('student_b', 'program_b'),
  ('advisor_assigned', 'program_a'),
  ('advisor_unassigned', 'program_a'),
  ('advisor_cross_program', 'program_b'),
  ('program_admin_a', 'program_a'),
  ('faculty_active', 'program_a'),
  ('faculty_expired', 'program_a'),
  ('student_suspended', 'program_a');

insert into timeline.documents (
  id, owner_principal_id, program_id, schema_version, current_revision, status, document_json
) values
  ('document_a', 'student_a', 'program_a', 'd1-timeline-document-409.1', 1, 'IN_REVIEW', '{"schemaVersion":"d1-timeline-document-409.1","id":"document_a"}'),
  ('document_b', 'student_b', 'program_b', 'd1-timeline-document-409.1', 1, 'DRAFT', '{"schemaVersion":"d1-timeline-document-409.1","id":"document_b"}'),
  ('document_suspended', 'student_suspended', 'program_a', 'd1-timeline-document-409.1', 1, 'DRAFT', '{"schemaVersion":"d1-timeline-document-409.1","id":"document_suspended"}');

insert into timeline.versions (
  id, document_id, revision, label, snapshot_json, content_sha256, created_by
) values
  ('version_a1', 'document_a', 1, 'Submitted v1', '{"id":"document_a","events":[]}', repeat('a', 64), 'student_a'),
  ('version_b1', 'document_b', 1, 'Draft v1', '{"id":"document_b","events":[]}', repeat('b', 64), 'student_b'),
  ('version_s1', 'document_suspended', 1, 'Draft v1', '{"id":"document_suspended","events":[]}', repeat('c', 64), 'student_suspended');

update timeline.documents set current_version_id = 'version_a1' where id = 'document_a';
update timeline.documents set current_version_id = 'version_b1' where id = 'document_b';
update timeline.documents set current_version_id = 'version_s1' where id = 'document_suspended';

insert into timeline.advisor_assignments (
  document_id, advisor_principal_id, program_id, starts_at
) values ('document_a', 'advisor_assigned', 'program_a', now() - interval '1 day');

insert into timeline.faculty_grants (
  id, document_id, version_id, faculty_principal_id, actions, starts_at, expires_at, created_by
) values
  ('faculty_grant_active', 'document_a', 'version_a1', 'faculty_active', array['document:read'], now() - interval '1 hour', now() + interval '1 hour', 'program_admin_a'),
  ('faculty_grant_expired', 'document_a', 'version_a1', 'faculty_expired', array['document:read'], now() - interval '2 hours', now() - interval '1 hour', 'program_admin_a');

insert into timeline.review_requests (
  id, document_id, version_id, version_sha256, requested_by, assigned_to, status
) values (
  'review_a1', 'document_a', 'version_a1', repeat('a', 64), 'student_a', 'advisor_assigned', 'IN_REVIEW'
);

insert into timeline.comments (
  id, review_request_id, author_id, author_role, body_ciphertext, visibility, anchor_json
) values
  ('comment_shared', 'review_a1', 'advisor_assigned', 'ADVISOR', 'ciphertext-shared', 'SHARED', '{"eventId":"event_a"}'),
  ('comment_advisor_only', 'review_a1', 'advisor_assigned', 'ADVISOR', 'ciphertext-advisor', 'ADVISOR_ONLY', '{"eventId":"event_a"}');

insert into timeline.approval_events (
  id, review_request_id, document_id, version_id, content_sha256, decision, actor_id, reason
) values (
  'approval_a1', 'review_a1', 'document_a', 'version_a1', repeat('a', 64), 'APPROVED', 'advisor_assigned', 'Disposable test approval'
);

insert into timeline.media_objects (
  id, document_id, owner_principal_id, object_class, storage_key, mime_type, byte_size,
  content_sha256, visibility, status
) values
  ('media_a', 'document_a', 'student_a', 'MEDIA', 'opaque/a/media-a', 'image/png', 8, repeat('d', 64), 'INTERVIEWER_SAFE', 'CONFIRMED'),
  ('media_b', 'document_b', 'student_b', 'MEDIA', 'opaque/b/media-b', 'image/png', 8, repeat('e', 64), 'STUDENT_ONLY', 'CONFIRMED');

insert into timeline.audit_events (
  id, actor_id, action, resource_type, resource_id, outcome, request_id, metadata_json
) values (
  'breakglass_audit_1',
  'platform_breakglass',
  'BREAK_GLASS_ACCESS',
  'DOCUMENT_SET',
  '*',
  'ALLOW',
  'request_breakglass_1',
  jsonb_build_object('reason', 'incident-response', 'expires_at', (now() + interval '30 minutes')::text)
);

analyze;
