-- Validation: 20260715_mmc_cam_v2_rls_validation.sql
-- Authority: A1-MMC-006 / MR-078A
-- Purpose: Transaction-rollback validation of CAM v2 forced-RLS, immutable-table,
--          exact-queue, active-authority, subject-binding, and cutover contracts.
-- Execution: Authorized LOCAL/STAGING/CI database only, after the matching migration is applied.
-- Safety: Synthetic rows only; the final unconditional ROLLBACK preserves the pre-run database state.

BEGIN;

DO $$
DECLARE
  v_target text := lower(coalesce(current_setting('mmc.schema_build_target', true), ''));
BEGIN
  IF v_target NOT IN ('local', 'staging', 'ci') THEN
    RAISE EXCEPTION
      'CAM v2 RLS validation is local/staging/ci only. Set mmc.schema_build_target explicitly.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_roles
    WHERE rolname = current_user AND (rolsuper OR rolbypassrls)
  ) THEN
    RAISE EXCEPTION 'CAM v2 validation bootstrap requires the authorized database owner/bypass role';
  END IF;
END $$;

SET LOCAL statement_timeout = '30s';
SET LOCAL lock_timeout = '3s';

-- OWNER_BOOTSTRAP_CONTEXT. Fixture construction is intentionally completed
-- before SET ROLE authenticated; runtime never receives table DML privileges.
RESET ROLE;
SET LOCAL row_security = off;

-- STRICT_TIMESTAMP_AND_UUID_PARITY. Calendar validity, the ISO offset ceiling,
-- nanosecond wire precision, and RFC 9562 UUID version/variant boundaries are
-- executable contracts rather than regex-presence claims.
DO $$
DECLARE
  v_invalid_timestamp text;
BEGIN
  IF NOT mmc.cam_v2_is_valid_rfc3339('2024-02-29T23:59:59.123456789Z')
     OR NOT mmc.cam_v2_is_valid_rfc3339('2024-02-29T23:59:59+14:00') THEN
    RAISE EXCEPTION 'strict RFC3339 parser rejected intended precision or offset boundary';
  END IF;
  FOREACH v_invalid_timestamp IN ARRAY ARRAY[
    '2023-02-29T12:00:00Z',
    '2024-02-30T12:00:00Z',
    '0000-01-01T00:00:00Z',
    '2024-01-01T00:00:00+14:01',
    '2024-01-01T00:00:00+15:00',
    '2024-01-01T00:00:60Z'
  ] LOOP
    IF mmc.cam_v2_is_valid_rfc3339(v_invalid_timestamp) THEN
      RAISE EXCEPTION 'strict RFC3339 parser accepted invalid timestamp %', v_invalid_timestamp;
    END IF;
  END LOOP;
  IF NOT mmc.cam_v2_is_valid_wire_uuid('01890F30-0000-7ABC-8ABC-000000000001')
     OR NOT mmc.cam_v2_is_valid_wire_uuid('01890f30-0000-8abc-8abc-000000000001')
     OR mmc.cam_v2_is_valid_wire_uuid('01890f30-0000-9abc-8abc-000000000001')
     OR mmc.cam_v2_is_valid_wire_uuid('01890f30-0000-7abc-7abc-000000000001') THEN
    RAISE EXCEPTION 'RFC 9562 UUID v1-v8/variant boundary drifted';
  END IF;
END $$;

-- ROLE_CAPABILITY_MATRIX
-- ADMIN    mmc.admin.trust_manage
-- OPERATOR mmc.operator.trust_read | mmc.operator.trust_write
-- MENTOR   mmc.mentor.read | mmc.mentor.command | mmc.mentor.review |
--          mmc.mentor.publish | mmc.mentor.audit_read | mmc.command.execute
-- STUDENT  mmc.student.publication_read | mmc.student.self_author |
--          mmc.student.respond | mmc.command.execute
-- WORKLOAD mmc.worker.claim | mmc.worker.lease | mmc.worker.asset_process |
--          mmc.worker.analysis | mmc.worker.heartbeat | mmc.worker.complete |
--          mmc.worker.outbox_dispatch | mmc.worker.inbox

INSERT INTO mmc.cam_v2_tenants (id, environment, tenant_key, display_name, status) VALUES
  ('00000000-0000-4000-8000-0000000000a1', 'LOCAL', 'rls-a-local', 'RLS A Local', 'ACTIVE'),
  ('00000000-0000-4000-8000-0000000000c1', 'LOCAL', 'rls-b-local', 'RLS B Local', 'ACTIVE'),
  ('00000000-0000-4000-8000-0000000000d1', 'STAGING', 'rls-a-staging', 'RLS A Staging', 'ACTIVE'),
  ('00000000-0000-4000-8000-0000000000e1', 'LOCAL', 'rls-suspended', 'RLS Suspended', 'SUSPENDED');

INSERT INTO mmc.cam_v2_principals (
  id, tenant_id, environment, principal_kind, auth_subject_digest, status
) VALUES
  ('00000000-0000-4000-8000-0000000000a2', '00000000-0000-4000-8000-0000000000a1', 'LOCAL', 'ADMIN', repeat('1', 64), 'ACTIVE'),
  ('00000000-0000-4000-8000-0000000000a3', '00000000-0000-4000-8000-0000000000a1', 'LOCAL', 'MENTOR', repeat('2', 64), 'ACTIVE'),
  ('00000000-0000-4000-8000-0000000000a4', '00000000-0000-4000-8000-0000000000a1', 'LOCAL', 'MENTOR', repeat('3', 64), 'ACTIVE'),
  ('00000000-0000-4000-8000-0000000000a5', '00000000-0000-4000-8000-0000000000a1', 'LOCAL', 'STUDENT', repeat('4', 64), 'ACTIVE'),
  ('00000000-0000-4000-8000-0000000000a6', '00000000-0000-4000-8000-0000000000a1', 'LOCAL', 'STUDENT', repeat('5', 64), 'ACTIVE'),
  ('00000000-0000-4000-8000-0000000000a7', '00000000-0000-4000-8000-0000000000a1', 'LOCAL', 'WORKLOAD', repeat('6', 64), 'ACTIVE'),
  ('00000000-0000-4000-8000-0000000000bd', '00000000-0000-4000-8000-0000000000a1', 'LOCAL', 'MENTOR', repeat('7', 64), 'ACTIVE'),
  ('00000000-0000-4000-8000-0000000000c2', '00000000-0000-4000-8000-0000000000c1', 'LOCAL', 'ADMIN', repeat('8', 64), 'ACTIVE'),
  ('00000000-0000-4000-8000-0000000000c3', '00000000-0000-4000-8000-0000000000c1', 'LOCAL', 'MENTOR', repeat('9', 64), 'ACTIVE'),
  ('00000000-0000-4000-8000-0000000000c4', '00000000-0000-4000-8000-0000000000c1', 'LOCAL', 'STUDENT', repeat('a', 64), 'ACTIVE'),
  ('00000000-0000-4000-8000-0000000000d2', '00000000-0000-4000-8000-0000000000d1', 'STAGING', 'ADMIN', repeat('b', 64), 'ACTIVE'),
  ('00000000-0000-4000-8000-0000000000d3', '00000000-0000-4000-8000-0000000000d1', 'STAGING', 'MENTOR', repeat('c', 64), 'ACTIVE'),
  ('00000000-0000-4000-8000-0000000000d4', '00000000-0000-4000-8000-0000000000d1', 'STAGING', 'STUDENT', repeat('d', 64), 'ACTIVE'),
  ('00000000-0000-4000-8000-0000000000e2', '00000000-0000-4000-8000-0000000000e1', 'LOCAL', 'ADMIN', repeat('e', 64), 'ACTIVE');

INSERT INTO mmc.cam_v2_subject_links (
  id, tenant_id, environment, student_principal_id, external_subject_digest,
  identity_state, independent_authority_count, verified_by_principal_id, verified_at
) VALUES
  ('00000000-0000-4000-8000-0000000000a8', '00000000-0000-4000-8000-0000000000a1', 'LOCAL',
   '00000000-0000-4000-8000-0000000000a5', repeat('f', 64), 'VERIFIED_LOCAL_LINK', 2,
   '00000000-0000-4000-8000-0000000000a2', now()),
  ('00000000-0000-4000-8000-0000000000a9', '00000000-0000-4000-8000-0000000000a1', 'LOCAL',
   '00000000-0000-4000-8000-0000000000a6', repeat('0', 64), 'VERIFIED_LOCAL_LINK', 2,
   '00000000-0000-4000-8000-0000000000a2', now()),
  ('00000000-0000-4000-8000-0000000000c5', '00000000-0000-4000-8000-0000000000c1', 'LOCAL',
   '00000000-0000-4000-8000-0000000000c4', repeat('1', 64), 'VERIFIED_LOCAL_LINK', 2,
   '00000000-0000-4000-8000-0000000000c2', now()),
  ('00000000-0000-4000-8000-0000000000d5', '00000000-0000-4000-8000-0000000000d1', 'STAGING',
   '00000000-0000-4000-8000-0000000000d4', repeat('2', 64), 'VERIFIED_LOCAL_LINK', 2,
   '00000000-0000-4000-8000-0000000000d2', now());

INSERT INTO mmc.cam_v2_assignments (
  id, tenant_id, environment, mentor_principal_id, subject_link_id, status,
  effective_at, revoked_at, granted_by_principal_id
) VALUES
  ('00000000-0000-4000-8000-0000000000aa', '00000000-0000-4000-8000-0000000000a1', 'LOCAL',
   '00000000-0000-4000-8000-0000000000a3', '00000000-0000-4000-8000-0000000000a8', 'ACTIVE',
   now() - interval '1 day', NULL, '00000000-0000-4000-8000-0000000000a2'),
  ('00000000-0000-4000-8000-0000000000ab', '00000000-0000-4000-8000-0000000000a1', 'LOCAL',
   '00000000-0000-4000-8000-0000000000a4', '00000000-0000-4000-8000-0000000000a8', 'ACTIVE',
   now() - interval '1 day', NULL, '00000000-0000-4000-8000-0000000000a2'),
  ('00000000-0000-4000-8000-0000000000bc', '00000000-0000-4000-8000-0000000000a1', 'LOCAL',
   '00000000-0000-4000-8000-0000000000a3', '00000000-0000-4000-8000-0000000000a9', 'ACTIVE',
   now() - interval '1 day', NULL, '00000000-0000-4000-8000-0000000000a2'),
  ('00000000-0000-4000-8000-0000000000be', '00000000-0000-4000-8000-0000000000a1', 'LOCAL',
   '00000000-0000-4000-8000-0000000000bd', '00000000-0000-4000-8000-0000000000a8', 'REVOKED',
   now() - interval '2 days', now() - interval '1 hour', '00000000-0000-4000-8000-0000000000a2'),
  ('00000000-0000-4000-8000-0000000000c6', '00000000-0000-4000-8000-0000000000c1', 'LOCAL',
   '00000000-0000-4000-8000-0000000000c3', '00000000-0000-4000-8000-0000000000c5', 'ACTIVE',
   now() - interval '1 day', NULL, '00000000-0000-4000-8000-0000000000c2'),
  ('00000000-0000-4000-8000-0000000000d6', '00000000-0000-4000-8000-0000000000d1', 'STAGING',
   '00000000-0000-4000-8000-0000000000d3', '00000000-0000-4000-8000-0000000000d5', 'ACTIVE',
   now() - interval '1 day', NULL, '00000000-0000-4000-8000-0000000000d2');

-- The revoked-principal fixture is created through its real lifecycle so an
-- ACTIVE assignment can never be born already bound to a revoked mentor.
UPDATE mmc.cam_v2_principals
SET status = 'REVOKED', object_version = object_version + 1
WHERE id = '00000000-0000-4000-8000-0000000000a4';

INSERT INTO mmc.cam_v2_policy_versions (
  id, tenant_id, environment, policy_kind, policy_version, policy_digest, status,
  effective_at, approved_by_principal_id
) VALUES
  ('00000000-0000-4000-8000-0000000000ac', '00000000-0000-4000-8000-0000000000a1', 'LOCAL',
   'PUBLICATION', 1, repeat('a', 64), 'ACTIVE', now() - interval '1 day', '00000000-0000-4000-8000-0000000000a2'),
  ('00000000-0000-4000-8000-0000000000b4', '00000000-0000-4000-8000-0000000000a1', 'LOCAL',
   'AI_TRANSFER', 1, repeat('c', 64), 'ACTIVE', now() - interval '1 day', '00000000-0000-4000-8000-0000000000a2'),
  ('00000000-0000-4000-8000-0000000000f0', '00000000-0000-4000-8000-0000000000a1', 'LOCAL',
   'ACQUISITION', 1, repeat('7', 64), 'ACTIVE', now() - interval '1 day', '00000000-0000-4000-8000-0000000000a2'),
  ('00000000-0000-4000-8000-0000000000f1', '00000000-0000-4000-8000-0000000000a1', 'LOCAL',
   'TRANSCRIPT_PROCESSING', 1, repeat('8', 64), 'ACTIVE', now() - interval '1 day', '00000000-0000-4000-8000-0000000000a2'),
  ('00000000-0000-4000-8000-0000000000f9', '00000000-0000-4000-8000-0000000000a1', 'LOCAL',
   'RETENTION', 1, repeat('9', 64), 'ACTIVE', now() - interval '1 day', '00000000-0000-4000-8000-0000000000a2');

INSERT INTO mmc.cam_v2_authority_grants (
  id, tenant_id, environment, subject_link_id, assignment_id, policy_version_id,
  grant_kind, basis_digest, status, effective_at, revoked_at, granted_by_principal_id
) VALUES
  ('00000000-0000-4000-8000-0000000000b6', '00000000-0000-4000-8000-0000000000a1', 'LOCAL',
   '00000000-0000-4000-8000-0000000000a8', '00000000-0000-4000-8000-0000000000aa',
   '00000000-0000-4000-8000-0000000000b4', 'AI_TRANSFER', repeat('d', 64), 'ACTIVE',
   now() - interval '1 day', NULL, '00000000-0000-4000-8000-0000000000a2'),
  ('00000000-0000-4000-8000-0000000000b7', '00000000-0000-4000-8000-0000000000a1', 'LOCAL',
   '00000000-0000-4000-8000-0000000000a8', '00000000-0000-4000-8000-0000000000aa',
   '00000000-0000-4000-8000-0000000000b4', 'AI_TRANSFER', repeat('e', 64), 'REVOKED',
   now() - interval '2 days', now() - interval '1 hour', '00000000-0000-4000-8000-0000000000a2'),
  ('00000000-0000-4000-8000-0000000000bb', '00000000-0000-4000-8000-0000000000a1', 'LOCAL',
   '00000000-0000-4000-8000-0000000000a8', '00000000-0000-4000-8000-0000000000aa',
   '00000000-0000-4000-8000-0000000000ac', 'PUBLICATION', repeat('f', 64), 'ACTIVE',
   now() - interval '1 day', NULL, '00000000-0000-4000-8000-0000000000a2'),
  ('00000000-0000-4000-8000-0000000000bf', '00000000-0000-4000-8000-0000000000a1', 'LOCAL',
   '00000000-0000-4000-8000-0000000000a9', '00000000-0000-4000-8000-0000000000bc',
   '00000000-0000-4000-8000-0000000000ac', 'PUBLICATION', repeat('6', 64), 'ACTIVE',
   now() - interval '1 day', NULL, '00000000-0000-4000-8000-0000000000a2'),
  ('00000000-0000-4000-8000-0000000000f2', '00000000-0000-4000-8000-0000000000a1', 'LOCAL',
   '00000000-0000-4000-8000-0000000000a8', '00000000-0000-4000-8000-0000000000aa',
   '00000000-0000-4000-8000-0000000000f0', 'ACQUISITION', repeat('a', 64), 'ACTIVE',
   now() - interval '1 day', NULL, '00000000-0000-4000-8000-0000000000a2'),
  ('00000000-0000-4000-8000-0000000000f3', '00000000-0000-4000-8000-0000000000a1', 'LOCAL',
   '00000000-0000-4000-8000-0000000000a8', '00000000-0000-4000-8000-0000000000aa',
   '00000000-0000-4000-8000-0000000000f1', 'TRANSCRIPT_PROCESSING', repeat('b', 64), 'ACTIVE',
   now() - interval '1 day', NULL, '00000000-0000-4000-8000-0000000000a2');

INSERT INTO mmc.cam_v2_cutover_states (
  id, tenant_id, environment, component_name
) VALUES (
  '00000000-0000-4000-8000-0000000000b9', '00000000-0000-4000-8000-0000000000a1', 'LOCAL',
  'MMC_CANONICAL'
);
UPDATE mmc.cam_v2_cutover_states
SET writer_state = 'SHADOW_READS', reads_enabled = true,
    v1_inventory_digest = repeat('1', 64),
    v2_inventory_digest = repeat('2', 64),
    reconciliation_digest = repeat('3', 64),
    object_version = object_version + 1
WHERE id = '00000000-0000-4000-8000-0000000000b9';
UPDATE mmc.cam_v2_cutover_states
SET writer_state = 'V1_FROZEN', object_version = object_version + 1
WHERE id = '00000000-0000-4000-8000-0000000000b9';
UPDATE mmc.cam_v2_cutover_states
SET writer_state = 'V2_ACTIVE', commands_enabled = true, ingest_enabled = true,
    ai_proposal_enabled = true, operational_promotion_enabled = true,
    student_publication_enabled = true, first_v2_acknowledged_at = clock_timestamp(),
    object_version = object_version + 1
WHERE id = '00000000-0000-4000-8000-0000000000b9';

INSERT INTO mmc.cam_v2_tasks (
  id, tenant_id, environment, assignment_id, subject_link_id, owner_principal_id,
  task_state, title, origin, sensitivity, review_state
) VALUES
  ('00000000-0000-4000-8000-0000000000ad', '00000000-0000-4000-8000-0000000000a1', 'LOCAL',
   '00000000-0000-4000-8000-0000000000aa', '00000000-0000-4000-8000-0000000000a8',
   '00000000-0000-4000-8000-0000000000a5', 'ACCEPTED', 'Synthetic exact-assignment task', 'HUMAN_JUDGMENT', 'NORMAL', 'APPROVED'),
  ('00000000-0000-4000-8000-0000000000c7', '00000000-0000-4000-8000-0000000000c1', 'LOCAL',
   '00000000-0000-4000-8000-0000000000c6', '00000000-0000-4000-8000-0000000000c5',
   '00000000-0000-4000-8000-0000000000c4', 'ACCEPTED', 'Cross-tenant sentinel', 'HUMAN_JUDGMENT', 'NORMAL', 'APPROVED'),
  ('00000000-0000-4000-8000-0000000000d7', '00000000-0000-4000-8000-0000000000d1', 'STAGING',
   '00000000-0000-4000-8000-0000000000d6', '00000000-0000-4000-8000-0000000000d5',
   '00000000-0000-4000-8000-0000000000d4', 'ACCEPTED', 'Cross-environment sentinel', 'HUMAN_JUDGMENT', 'NORMAL', 'APPROVED');

INSERT INTO mmc.cam_v2_goals (
  id, tenant_id, environment, assignment_id, subject_link_id, owner_principal_id, goal_state, title
) VALUES (
  '00000000-0000-4000-8000-0000000000fd', '00000000-0000-4000-8000-0000000000a1', 'LOCAL',
  '00000000-0000-4000-8000-0000000000aa', '00000000-0000-4000-8000-0000000000a8',
  '00000000-0000-4000-8000-0000000000a5', 'ACTIVE', 'Synthetic bound goal'
);

INSERT INTO mmc.cam_v2_publications (
  id, tenant_id, environment, subject_link_id, authoring_assignment_id,
  authority_grant_id, policy_version_id,
  approved_by_principal_id, publication_version, publication_state, projection_digest, published_at
) VALUES (
  '00000000-0000-4000-8000-0000000000ae', '00000000-0000-4000-8000-0000000000a1', 'LOCAL',
  '00000000-0000-4000-8000-0000000000a8', '00000000-0000-4000-8000-0000000000aa',
  '00000000-0000-4000-8000-0000000000bb', '00000000-0000-4000-8000-0000000000ac',
  '00000000-0000-4000-8000-0000000000a3',
  1, 'APPROVED', repeat('b', 64), NULL
);

INSERT INTO mmc.cam_v2_publication_items (
  id, tenant_id, environment, publication_id, subject_link_id, item_kind,
  source_object_kind, source_object_id, source_object_version,
  item_payload, item_payload_digest, source_version_hash, safe_plain_text, item_state
)
SELECT
  '00000000-0000-4000-8000-0000000000af', '00000000-0000-4000-8000-0000000000a1', 'LOCAL',
  '00000000-0000-4000-8000-0000000000ae', '00000000-0000-4000-8000-0000000000a8', 'TASK',
  'TASK', source.id, source.object_version, payload.value,
  encode(public.digest(payload.value::text, 'sha256'), 'hex'),
  mmc.cam_v2_sha256_jsonb(jsonb_build_object(
    'sourceKind', 'TASK', 'id', source.id, 'objectVersion', source.object_version,
    'assignmentId', source.assignment_id, 'subjectLinkId', source.subject_link_id,
    'sessionId', source.session_id, 'ownerPrincipalId', source.owner_principal_id,
    'taskState', source.task_state, 'title', source.title,
    'dueAtEpochMicroseconds', mmc.cam_v2_epoch_microseconds(source.due_at),
    'origin', source.origin, 'sensitivity', source.sensitivity,
    'reviewState', source.review_state
  )),
  'Complete the synthetic task.', 'APPROVED'
FROM mmc.cam_v2_tasks AS source
CROSS JOIN LATERAL (
  SELECT jsonb_build_object(
    'title', source.title, 'description', 'Complete the synthetic task.',
    'owner', 'STUDENT', 'dueAt', NULL
  ) AS value
) AS payload
WHERE source.id = '00000000-0000-4000-8000-0000000000ad';

-- CANONICAL_BINDING_MISMATCH_DENY, PUBLICATION_SUBJECT_BINDING_DENY, and
-- PUBLICATION_SOURCE_ELIGIBILITY_DENY. Every failed nested block rolls back
-- its own synthetic insert before the outer validation transaction continues.
DO $$
DECLARE
  v_constraint text;
BEGIN
  BEGIN
    INSERT INTO mmc.cam_v2_principals (
      id, tenant_id, environment, principal_kind, auth_subject_digest, status
    ) VALUES (
      '10000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-0000000000a1',
      'LOCAL', 'STUDENT', 'not-a-sha256', 'ACTIVE'
    );
    RAISE EXCEPTION 'principal accepted a malformed durable digest';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  BEGIN
    INSERT INTO mmc.cam_v2_subject_links (
      id, tenant_id, environment, student_principal_id, external_subject_digest,
      identity_state, independent_authority_count, verified_by_principal_id, verified_at
    ) VALUES (
      '10000000-0000-4000-8000-00000000000b', '00000000-0000-4000-8000-0000000000a1',
      'LOCAL', '00000000-0000-4000-8000-0000000000a3', repeat('3', 64),
      'VERIFIED_LOCAL_LINK', 2, '00000000-0000-4000-8000-0000000000a2', now()
    );
    RAISE EXCEPTION 'subject link accepted a non-student principal';
  EXCEPTION WHEN foreign_key_violation OR check_violation THEN NULL;
  END;

  BEGIN
    INSERT INTO mmc.cam_v2_assignments (
      id, tenant_id, environment, mentor_principal_id, subject_link_id, status,
      granted_by_principal_id
    ) VALUES (
      '10000000-0000-4000-8000-00000000000c', '00000000-0000-4000-8000-0000000000a1',
      'LOCAL', '00000000-0000-4000-8000-0000000000a5',
      '00000000-0000-4000-8000-0000000000a8', 'ACTIVE',
      '00000000-0000-4000-8000-0000000000a2'
    );
    RAISE EXCEPTION 'assignment accepted a non-mentor principal';
  EXCEPTION WHEN foreign_key_violation OR check_violation THEN NULL;
  END;

  BEGIN
    INSERT INTO mmc.cam_v2_publications (
      id, tenant_id, environment, subject_link_id, authoring_assignment_id,
      authority_grant_id, policy_version_id, approved_by_principal_id, publication_version,
      publication_state, projection_digest, published_at
    ) VALUES (
      '10000000-0000-4000-8000-00000000000d', '00000000-0000-4000-8000-0000000000a1',
      'LOCAL', '00000000-0000-4000-8000-0000000000a8',
      '00000000-0000-4000-8000-0000000000aa', '00000000-0000-4000-8000-0000000000bb',
      '00000000-0000-4000-8000-0000000000ac',
      '00000000-0000-4000-8000-0000000000a3', 2, 'PUBLISHED', repeat('4', 64), now()
    );
    RAISE EXCEPTION 'publication bypassed assembly/projection sealing';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  BEGIN
    INSERT INTO mmc.cam_v2_sessions (
      id, tenant_id, environment, assignment_id, subject_link_id, mentor_principal_id, purpose
    ) VALUES (
      '10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000a1', 'LOCAL',
      '00000000-0000-4000-8000-0000000000aa', '00000000-0000-4000-8000-0000000000a9',
      '00000000-0000-4000-8000-0000000000a3', 'Wrong-subject session sentinel'
    );
    RAISE EXCEPTION 'session accepted an assignment/subject mismatch';
  EXCEPTION WHEN foreign_key_violation THEN
    GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
    IF v_constraint <> 'cam_v2_sessions_assignment_subject_mentor_fk' THEN RAISE; END IF;
  END;

  BEGIN
    INSERT INTO mmc.cam_v2_sessions (
      id, tenant_id, environment, assignment_id, subject_link_id, mentor_principal_id, purpose
    ) VALUES (
      '10000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-0000000000a1', 'LOCAL',
      '00000000-0000-4000-8000-0000000000aa', '00000000-0000-4000-8000-0000000000a8',
      '00000000-0000-4000-8000-0000000000a4', 'Wrong-mentor session sentinel'
    );
    RAISE EXCEPTION 'session accepted an assignment/mentor mismatch';
  EXCEPTION WHEN foreign_key_violation THEN
    GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
    IF v_constraint <> 'cam_v2_sessions_assignment_subject_mentor_fk' THEN RAISE; END IF;
  END;

  BEGIN
    INSERT INTO mmc.cam_v2_tasks (
      id, tenant_id, environment, assignment_id, subject_link_id, owner_principal_id,
      task_state, title, origin
    ) VALUES (
      '10000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-0000000000a1', 'LOCAL',
      '00000000-0000-4000-8000-0000000000aa', '00000000-0000-4000-8000-0000000000a9',
      '00000000-0000-4000-8000-0000000000a5', 'ACCEPTED', 'Wrong-subject task sentinel', 'HUMAN_JUDGMENT'
    );
    RAISE EXCEPTION 'task accepted an assignment/subject mismatch';
  EXCEPTION WHEN foreign_key_violation THEN
    GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
    IF v_constraint <> 'cam_v2_tasks_assignment_subject_fk' THEN RAISE; END IF;
  END;

  BEGIN
    INSERT INTO mmc.cam_v2_commitments (
      id, tenant_id, environment, assignment_id, subject_link_id, owner_principal_id, statement
    ) VALUES (
      '10000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-0000000000a1', 'LOCAL',
      '00000000-0000-4000-8000-0000000000aa', '00000000-0000-4000-8000-0000000000a9',
      '00000000-0000-4000-8000-0000000000a5', 'Wrong-subject commitment sentinel'
    );
    RAISE EXCEPTION 'commitment accepted an assignment/subject mismatch';
  EXCEPTION WHEN foreign_key_violation THEN
    GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
    IF v_constraint <> 'cam_v2_commitments_assignment_subject_fk' THEN RAISE; END IF;
  END;

  BEGIN
    INSERT INTO mmc.cam_v2_goals (
      id, tenant_id, environment, assignment_id, subject_link_id, owner_principal_id, title
    ) VALUES (
      '10000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-0000000000a1', 'LOCAL',
      '00000000-0000-4000-8000-0000000000aa', '00000000-0000-4000-8000-0000000000a9',
      '00000000-0000-4000-8000-0000000000a5', 'Wrong-subject goal sentinel'
    );
    RAISE EXCEPTION 'goal accepted an assignment/subject mismatch';
  EXCEPTION WHEN foreign_key_violation THEN
    GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
    IF v_constraint <> 'cam_v2_goals_assignment_subject_fk' THEN RAISE; END IF;
  END;

  BEGIN
    INSERT INTO mmc.cam_v2_milestones (
      id, tenant_id, environment, assignment_id, subject_link_id, goal_id, title, criteria_digest
    ) VALUES (
      '10000000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-0000000000a1', 'LOCAL',
      '00000000-0000-4000-8000-0000000000aa', '00000000-0000-4000-8000-0000000000a9',
      '00000000-0000-4000-8000-0000000000fd', 'Wrong-subject milestone sentinel', repeat('1', 64)
    );
    RAISE EXCEPTION 'milestone accepted an assignment/subject mismatch';
  EXCEPTION WHEN foreign_key_violation THEN
    GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
    IF v_constraint <> 'cam_v2_milestones_assignment_subject_fk' THEN RAISE; END IF;
  END;

  BEGIN
    INSERT INTO mmc.cam_v2_publications (
      id, tenant_id, environment, subject_link_id, authoring_assignment_id,
      authority_grant_id, policy_version_id, publication_version, projection_digest
    ) VALUES (
      '10000000-0000-4000-8000-000000000007', '00000000-0000-4000-8000-0000000000a1', 'LOCAL',
      '00000000-0000-4000-8000-0000000000a9', '00000000-0000-4000-8000-0000000000aa',
      '00000000-0000-4000-8000-0000000000bb',
      '00000000-0000-4000-8000-0000000000ac', 1, repeat('2', 64)
    );
    RAISE EXCEPTION 'publication accepted an assignment/subject mismatch';
  EXCEPTION WHEN foreign_key_violation OR insufficient_privilege THEN
    GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
    IF v_constraint NOT IN (
      'cam_v2_publications_assignment_subject_fk',
      'cam_v2_publication_active_authority'
    ) THEN RAISE; END IF;
  END;

  BEGIN
    INSERT INTO mmc.cam_v2_publication_items (
      id, tenant_id, environment, publication_id, subject_link_id, item_kind,
      source_object_kind, source_object_id, source_object_version,
      item_payload, item_payload_digest, source_version_hash, safe_plain_text
    ) VALUES (
      '10000000-0000-4000-8000-000000000008', '00000000-0000-4000-8000-0000000000a1', 'LOCAL',
      '00000000-0000-4000-8000-0000000000ae', '00000000-0000-4000-8000-0000000000a9', 'TASK',
      'TASK', '00000000-0000-4000-8000-0000000000ad', 1,
      jsonb_build_object('title', 'Wrong publication subject sentinel', 'description', 'Wrong subject', 'owner', 'STUDENT', 'dueAt', NULL),
      encode(public.digest(jsonb_build_object('title', 'Wrong publication subject sentinel', 'description', 'Wrong subject', 'owner', 'STUDENT', 'dueAt', NULL)::text, 'sha256'), 'hex'),
      repeat('0', 64), 'Wrong publication subject sentinel'
    );
    RAISE EXCEPTION 'publication item accepted a publication/subject mismatch';
  EXCEPTION WHEN foreign_key_violation OR insufficient_privilege THEN
    GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
    IF v_constraint NOT IN (
      'cam_v2_publication_items_publication_subject_fk',
      'cam_v2_publication_item_active_authority'
    ) THEN RAISE; END IF;
  END;

  BEGIN
    INSERT INTO mmc.cam_v2_tasks (
      id, tenant_id, environment, assignment_id, subject_link_id, owner_principal_id,
      task_state, title, origin, sensitivity, review_state
    ) VALUES (
      '00000000-0000-4000-8000-0000000000fe', '00000000-0000-4000-8000-0000000000a1', 'LOCAL',
      '00000000-0000-4000-8000-0000000000aa', '00000000-0000-4000-8000-0000000000a8',
      '00000000-0000-4000-8000-0000000000a5', 'ACCEPTED', 'Ineligible source sentinel',
      'AI_PROPOSAL', 'RESTRICTED', 'REVIEW_REQUIRED'
    );
    INSERT INTO mmc.cam_v2_publication_items (
      id, tenant_id, environment, publication_id, subject_link_id, item_kind,
      source_object_kind, source_object_id, source_object_version,
      item_payload, item_payload_digest, source_version_hash, safe_plain_text
    ) VALUES (
      '10000000-0000-4000-8000-000000000009', '00000000-0000-4000-8000-0000000000a1', 'LOCAL',
      '00000000-0000-4000-8000-0000000000ae', '00000000-0000-4000-8000-0000000000a8', 'TASK',
      'TASK', '00000000-0000-4000-8000-0000000000fe', 1,
      jsonb_build_object('title', 'Ineligible source sentinel', 'description', 'Ineligible source', 'owner', 'STUDENT', 'dueAt', NULL),
      encode(public.digest(jsonb_build_object('title', 'Ineligible source sentinel', 'description', 'Ineligible source', 'owner', 'STUDENT', 'dueAt', NULL)::text, 'sha256'), 'hex'),
      repeat('0', 64), 'Ineligible source sentinel'
    );
    RAISE EXCEPTION 'publication item accepted an ineligible source';
  EXCEPTION WHEN check_violation THEN
    GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
    IF v_constraint <> 'cam_v2_publication_items_source_eligible' THEN RAISE; END IF;
  END;

  -- PUBLICATION_JWT_SECRET_DENY. JWT-shaped credential material must be
  -- rejected before exact-student RLS can ever expose a persisted payload.
  BEGIN
    INSERT INTO mmc.cam_v2_publication_items (
      id, tenant_id, environment, publication_id, subject_link_id, item_kind,
      source_object_kind, source_object_id, source_object_version,
      item_payload, item_payload_digest, source_version_hash, safe_plain_text
    ) VALUES (
      '10000000-0000-4000-8000-000000000010', '00000000-0000-4000-8000-0000000000a1', 'LOCAL',
      '00000000-0000-4000-8000-0000000000ae', '00000000-0000-4000-8000-0000000000a8', 'TASK',
      'TASK', '00000000-0000-4000-8000-0000000000ad', 1,
      jsonb_build_object(
        'title', 'Credential sentinel',
        'description', 'eyJabcdef.eyJghijkl.signature1',
        'owner', 'STUDENT', 'dueAt', NULL
      ),
      encode(public.digest(jsonb_build_object(
        'title', 'Credential sentinel',
        'description', 'eyJabcdef.eyJghijkl.signature1',
        'owner', 'STUDENT', 'dueAt', NULL
      )::text, 'sha256'), 'hex'),
      repeat('0', 64), 'eyJabcdef.eyJghijkl.signature1'
    );
    RAISE EXCEPTION 'publication item accepted JWT-shaped credential material';
  EXCEPTION WHEN check_violation THEN
    GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
    IF v_constraint <> 'cam_v2_publication_items_payload_plain_text' THEN RAISE; END IF;
  END;
END $$;

-- SESSION_SUMMARY_BODY_CAP_PARITY. The JS authority permits a 4,096-byte
-- session-summary body (while plan updates remain capped at 2,048). Prove a
-- 3,000-byte safe summary survives canonical SQL validation, then roll the
-- isolated fixture subtransaction back deliberately.
DO $$
DECLARE
  v_message text;
BEGIN
  BEGIN
    INSERT INTO mmc.cam_v2_sessions (
      id, tenant_id, environment, assignment_id, subject_link_id,
      mentor_principal_id, session_state, purpose, started_at, ended_at, sensitivity
    ) VALUES (
      '50000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000a1', 'LOCAL',
      '00000000-0000-4000-8000-0000000000bc', '00000000-0000-4000-8000-0000000000a9',
      '00000000-0000-4000-8000-0000000000a3', 'CLOSED', 'Long summary parity fixture',
      '2026-07-15 12:00:00+00', '2026-07-15 12:30:00+00', 'NORMAL'
    );
    INSERT INTO mmc.cam_v2_publications (
      id, tenant_id, environment, subject_link_id, authoring_assignment_id,
      authority_grant_id, policy_version_id, approved_by_principal_id, publication_version,
      publication_state, projection_digest
    ) VALUES (
      '50000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-0000000000a1', 'LOCAL',
      '00000000-0000-4000-8000-0000000000a9', '00000000-0000-4000-8000-0000000000bc',
      '00000000-0000-4000-8000-0000000000bf', '00000000-0000-4000-8000-0000000000ac',
      '00000000-0000-4000-8000-0000000000a3',
      1, 'APPROVED', repeat('5', 64)
    );
    INSERT INTO mmc.cam_v2_publication_items (
      id, tenant_id, environment, publication_id, subject_link_id, item_kind,
      source_object_kind, source_object_id, source_object_version,
      item_payload, item_payload_digest, source_version_hash, safe_plain_text
    )
    SELECT
      '50000000-0000-4000-8000-000000000003', source.tenant_id, source.environment,
      '50000000-0000-4000-8000-000000000002', source.subject_link_id, 'SESSION_SUMMARY',
      'SESSION_SUMMARY', source.id, source.object_version, payload.value,
      encode(public.digest(payload.value::text, 'sha256'), 'hex'),
      mmc.cam_v2_sha256_jsonb(jsonb_build_object(
        'sourceKind', 'SESSION_SUMMARY', 'id', source.id,
        'objectVersion', source.object_version,
        'assignmentId', source.assignment_id, 'subjectLinkId', source.subject_link_id,
        'mentorPrincipalId', source.mentor_principal_id,
        'sessionState', source.session_state, 'purpose', source.purpose,
        'startedAtEpochMicroseconds', mmc.cam_v2_epoch_microseconds(source.started_at),
        'endedAtEpochMicroseconds', mmc.cam_v2_epoch_microseconds(source.ended_at),
        'sensitivity', source.sensitivity
      )),
      repeat('s', 3000)
    FROM mmc.cam_v2_sessions AS source
    CROSS JOIN LATERAL (
      SELECT jsonb_build_object(
        'title', 'Long session summary', 'summary', repeat('s', 3000),
        'sessionAt', '2026-07-15T12:00:00Z'
      ) AS value
    ) AS payload
    WHERE source.id = '50000000-0000-4000-8000-000000000001';
    IF (SELECT octet_length(safe_plain_text)
        FROM mmc.cam_v2_publication_items
        WHERE id = '50000000-0000-4000-8000-000000000003') <> 3000 THEN
      RAISE EXCEPTION 'session-summary body cap diverged from the JS contract'
        USING ERRCODE = '23514';
    END IF;
    RAISE EXCEPTION 'SESSION_SUMMARY_BODY_CAP_PARITY_ROLLBACK';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_message = MESSAGE_TEXT;
    IF v_message <> 'SESSION_SUMMARY_BODY_CAP_PARITY_ROLLBACK' THEN RAISE; END IF;
  END;
END $$;

-- PUBLICATION_ITEM_COUNT_BOUNDARY. Assemble 101 individually valid child
-- attestations and prove the parent cannot enter a readable state beyond the
-- JS authority's hard maximum of 100.
DO $$
DECLARE
  v_constraint text;
BEGIN
  BEGIN
    INSERT INTO mmc.cam_v2_publications (
      id, tenant_id, environment, subject_link_id, authoring_assignment_id,
      authority_grant_id, policy_version_id, approved_by_principal_id, publication_version,
      publication_state, projection_digest
    ) VALUES (
      '50000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-0000000000a1', 'LOCAL',
      '00000000-0000-4000-8000-0000000000a9', '00000000-0000-4000-8000-0000000000bc',
      '00000000-0000-4000-8000-0000000000bf', '00000000-0000-4000-8000-0000000000ac',
      '00000000-0000-4000-8000-0000000000a3',
      1, 'APPROVED', repeat('6', 64)
    );
    INSERT INTO mmc.cam_v2_tasks (
      id, tenant_id, environment, assignment_id, subject_link_id,
      owner_principal_id, task_state, title, origin, sensitivity, review_state
    )
    SELECT gen_random_uuid(), '00000000-0000-4000-8000-0000000000a1', 'LOCAL',
      '00000000-0000-4000-8000-0000000000bc', '00000000-0000-4000-8000-0000000000a9',
      '00000000-0000-4000-8000-0000000000a6', 'ACCEPTED',
      'MMC count boundary ' || ordinal::text, 'HUMAN_JUDGMENT', 'NORMAL', 'APPROVED'
    FROM generate_series(1, 101) AS ordinal;
    INSERT INTO mmc.cam_v2_publication_items (
      id, tenant_id, environment, publication_id, subject_link_id, item_kind,
      source_object_kind, source_object_id, source_object_version,
      item_payload, item_payload_digest, source_version_hash, safe_plain_text
    )
    SELECT gen_random_uuid(), source.tenant_id, source.environment,
      '50000000-0000-4000-8000-000000000011', source.subject_link_id, 'TASK',
      'TASK', source.id, source.object_version, payload.value,
      encode(public.digest(payload.value::text, 'sha256'), 'hex'),
      mmc.cam_v2_sha256_jsonb(jsonb_build_object(
        'sourceKind', 'TASK', 'id', source.id, 'objectVersion', source.object_version,
        'assignmentId', source.assignment_id, 'subjectLinkId', source.subject_link_id,
        'sessionId', source.session_id, 'ownerPrincipalId', source.owner_principal_id,
        'taskState', source.task_state, 'title', source.title,
        'dueAtEpochMicroseconds', mmc.cam_v2_epoch_microseconds(source.due_at),
        'origin', source.origin, 'sensitivity', source.sensitivity,
        'reviewState', source.review_state
      )),
      'Bounded publication item'
    FROM mmc.cam_v2_tasks AS source
    CROSS JOIN LATERAL (
      SELECT jsonb_build_object(
        'title', source.title, 'description', 'Bounded publication item',
        'owner', 'STUDENT', 'dueAt', NULL
      ) AS value
    ) AS payload
    WHERE source.title LIKE 'MMC count boundary %';
    UPDATE mmc.cam_v2_publication_items
    SET item_state = 'PUBLISHED', object_version = object_version + 1,
        updated_at = clock_timestamp()
    WHERE publication_id = '50000000-0000-4000-8000-000000000011';
    UPDATE mmc.cam_v2_publications AS publication
    SET item_set_digest = projection.value, publication_state = 'PUBLISHED',
        published_at = clock_timestamp(), object_version = publication.object_version + 1
    FROM LATERAL (
      SELECT mmc.cam_v2_sha256_jsonb(jsonb_agg(jsonb_build_object(
        'id', item.id, 'objectVersion', item.object_version,
        'itemKind', item.item_kind, 'itemPayloadDigest', item.item_payload_digest,
        'sourceVersionHash', item.source_version_hash,
        'replacesPublicationId', item.replaces_publication_id,
        'replacesPublicationItemId', item.replaces_publication_item_id,
        'replacesSourceVersionHash', item.replaces_source_version_hash,
        'itemState', item.item_state
      ) ORDER BY item.id)) AS value
      FROM mmc.cam_v2_publication_items AS item
      WHERE item.publication_id = '50000000-0000-4000-8000-000000000011'
    ) AS projection
    WHERE publication.id = '50000000-0000-4000-8000-000000000011';
    RAISE EXCEPTION 'publication seal accepted more than 100 items';
  EXCEPTION WHEN check_violation THEN
    GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
    IF v_constraint <> 'cam_v2_publications_projection_seal' THEN RAISE; END IF;
  END;

  -- PUBLICATION_ITEM_VERSION_FENCE. Child attestations cannot mutate without
  -- preserving creation time and advancing exactly one durable version.
  BEGIN
    UPDATE mmc.cam_v2_publication_items
    SET item_state = 'PUBLISHED'
    WHERE id = '00000000-0000-4000-8000-0000000000af';
    RAISE EXCEPTION 'publication item changed without one exact version advance';
  EXCEPTION WHEN check_violation THEN
    GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
    IF v_constraint <> 'cam_v2_publication_items_version_fence' THEN RAISE; END IF;
  END;

  -- PUBLICATION_ITEM_ACTIVE_LINEAGE_VERSION_DENY. An active exact-version
  -- lineage edge freezes its publication-item endpoint just like every other
  -- governed source family.
  BEGIN
    INSERT INTO mmc.cam_v2_lineage_edges (
      id, tenant_id, environment, from_kind, from_id, from_version,
      to_kind, to_id, to_version, relation_kind, transform_digest
    ) VALUES (
      '50000000-0000-4000-8000-000000000012',
      '00000000-0000-4000-8000-0000000000a1', 'LOCAL',
      'TASK', '00000000-0000-4000-8000-0000000000ad', 1,
      'PUBLICATION_ITEM', '00000000-0000-4000-8000-0000000000af', 1,
      'CANONICAL_TO_PUBLICATION', repeat('7', 64)
    );
    UPDATE mmc.cam_v2_publication_items
    SET item_state = 'PUBLISHED', object_version = object_version + 1
    WHERE id = '00000000-0000-4000-8000-0000000000af';
    RAISE EXCEPTION 'active publication-item lineage survived a version advance';
  EXCEPTION WHEN check_violation THEN
    GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
    IF v_constraint <> 'cam_v2_lineage_active_endpoint_version' THEN RAISE; END IF;
  END;
END $$;

-- PUBLICATION_PROJECTION_SEAL. Items are assembled while the parent remains
-- APPROVED; only the exact ordered item digest can transition it to readable
-- truth, after which both projection bindings and child content are immutable.
UPDATE mmc.cam_v2_publication_items
SET item_state = 'PUBLISHED', object_version = object_version + 1, updated_at = clock_timestamp()
WHERE id = '00000000-0000-4000-8000-0000000000af';
UPDATE mmc.cam_v2_publications AS publication
SET item_set_digest = projection.value,
    publication_state = 'PUBLISHED',
    published_at = clock_timestamp(),
    object_version = publication.object_version + 1,
    updated_at = clock_timestamp()
FROM LATERAL (
  SELECT mmc.cam_v2_sha256_jsonb(jsonb_agg(jsonb_build_object(
    'id', item.id, 'objectVersion', item.object_version,
    'itemKind', item.item_kind, 'itemPayloadDigest', item.item_payload_digest,
    'sourceVersionHash', item.source_version_hash,
    'replacesPublicationId', item.replaces_publication_id,
    'replacesPublicationItemId', item.replaces_publication_item_id,
    'replacesSourceVersionHash', item.replaces_source_version_hash,
    'itemState', item.item_state
  ) ORDER BY item.id)) AS value
  FROM mmc.cam_v2_publication_items AS item
  WHERE item.tenant_id = '00000000-0000-4000-8000-0000000000a1'
    AND item.environment = 'LOCAL'
    AND item.publication_id = '00000000-0000-4000-8000-0000000000ae'
) AS projection
WHERE publication.id = '00000000-0000-4000-8000-0000000000ae';
DO $$
BEGIN
  BEGIN
    UPDATE mmc.cam_v2_publication_items
    SET safe_plain_text = 'post-publication mutation sentinel'
    WHERE id = '00000000-0000-4000-8000-0000000000af';
    RAISE EXCEPTION 'sealed publication item accepted owner mutation';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    UPDATE mmc.cam_v2_publications
    SET projection_digest = repeat('0', 64)
    WHERE id = '00000000-0000-4000-8000-0000000000ae';
    RAISE EXCEPTION 'sealed publication projection accepted digest mutation';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
END $$;

-- PUBLICATION_SINGLE_READABLE_HEAD. A successor may be assembled and sealed
-- against an exact locked predecessor only if that predecessor is superseded
-- in the same transaction. Forcing deferred checks here proves that leaving
-- both rows readable cannot commit.
DO $$
DECLARE
  v_constraint text;
BEGIN
  BEGIN
    INSERT INTO mmc.cam_v2_publications (
      id, tenant_id, environment, subject_link_id, authoring_assignment_id,
      authority_grant_id, policy_version_id, approved_by_principal_id, publication_version,
      publication_state, projection_digest,
      supersedes_id, supersedes_version, supersedes_projection_digest
    ) VALUES (
      '60000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000a1', 'LOCAL',
      '00000000-0000-4000-8000-0000000000a8', '00000000-0000-4000-8000-0000000000aa',
      '00000000-0000-4000-8000-0000000000bb', '00000000-0000-4000-8000-0000000000ac',
      '00000000-0000-4000-8000-0000000000a3',
      2, 'APPROVED', repeat('6', 64),
      '00000000-0000-4000-8000-0000000000ae', 1, repeat('b', 64)
    );
    INSERT INTO mmc.cam_v2_publication_items (
      id, tenant_id, environment, publication_id, subject_link_id, item_kind,
      source_object_kind, source_object_id, source_object_version,
      item_payload, item_payload_digest, source_version_hash, safe_plain_text
    )
    SELECT
      '60000000-0000-4000-8000-000000000002', source.tenant_id, source.environment,
      '60000000-0000-4000-8000-000000000001', source.subject_link_id, 'TASK',
      'TASK', source.id, source.object_version, payload.value,
      encode(public.digest(payload.value::text, 'sha256'), 'hex'),
      mmc.cam_v2_sha256_jsonb(jsonb_build_object(
        'sourceKind', 'TASK', 'id', source.id, 'objectVersion', source.object_version,
        'assignmentId', source.assignment_id, 'subjectLinkId', source.subject_link_id,
        'sessionId', source.session_id, 'ownerPrincipalId', source.owner_principal_id,
        'taskState', source.task_state, 'title', source.title,
        'dueAtEpochMicroseconds', mmc.cam_v2_epoch_microseconds(source.due_at),
        'origin', source.origin, 'sensitivity', source.sensitivity,
        'reviewState', source.review_state
      )), 'Dual-head sentinel'
    FROM mmc.cam_v2_tasks AS source
    CROSS JOIN LATERAL (
      SELECT jsonb_build_object(
        'title', source.title, 'description', 'Dual-head sentinel',
        'owner', 'STUDENT', 'dueAt', NULL
      ) AS value
    ) AS payload
    WHERE source.id = '00000000-0000-4000-8000-0000000000ad';
    UPDATE mmc.cam_v2_publication_items
    SET item_state = 'PUBLISHED', object_version = object_version + 1
    WHERE id = '60000000-0000-4000-8000-000000000002';
    UPDATE mmc.cam_v2_publications AS publication
    SET item_set_digest = projection.value, publication_state = 'PUBLISHED',
        published_at = clock_timestamp(), object_version = publication.object_version + 1
    FROM LATERAL (
      SELECT mmc.cam_v2_sha256_jsonb(jsonb_agg(jsonb_build_object(
        'id', item.id, 'objectVersion', item.object_version,
        'itemKind', item.item_kind, 'itemPayloadDigest', item.item_payload_digest,
        'sourceVersionHash', item.source_version_hash,
        'replacesPublicationId', item.replaces_publication_id,
        'replacesPublicationItemId', item.replaces_publication_item_id,
        'replacesSourceVersionHash', item.replaces_source_version_hash,
        'itemState', item.item_state
      ) ORDER BY item.id)) AS value
      FROM mmc.cam_v2_publication_items AS item
      WHERE item.publication_id = '60000000-0000-4000-8000-000000000001'
    ) AS projection
    WHERE publication.id = '60000000-0000-4000-8000-000000000001';
    SET CONSTRAINTS mmc.cam_v2_publications_final_coherence IMMEDIATE;
    RAISE EXCEPTION 'two readable publication heads committed for one subject';
  EXCEPTION WHEN check_violation THEN
    GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
    IF v_constraint <> 'cam_v2_publications_single_readable_head' THEN RAISE; END IF;
  END;
  SET CONSTRAINTS mmc.cam_v2_publications_final_coherence DEFERRED;
END $$;

-- PUBLICATION_CORRECTION_FINAL_COHERENCE. The transaction-final constraint
-- rejects a CORRECTED state that has no exact CORRECTION child, even though
-- the immediate predecessor transition itself is structurally allowed.
DO $$
BEGIN
  BEGIN
    UPDATE mmc.cam_v2_publications
    SET publication_state = 'CORRECTED', object_version = object_version + 1
    WHERE id = '00000000-0000-4000-8000-0000000000ae';
    SET CONSTRAINTS mmc.cam_v2_publications_final_coherence IMMEDIATE;
    RAISE EXCEPTION 'publication committed CORRECTED without a correction item';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  SET CONSTRAINTS mmc.cam_v2_publications_final_coherence DEFERRED;
END $$;

INSERT INTO mmc.cam_v2_student_statements (
  id, tenant_id, environment, subject_link_id, author_principal_id,
  statement_kind, statement_text, statement_state
) VALUES (
  '00000000-0000-4000-8000-0000000000b3', '00000000-0000-4000-8000-0000000000a1', 'LOCAL',
  '00000000-0000-4000-8000-0000000000a8', '00000000-0000-4000-8000-0000000000a5',
  'REFLECTION', 'Synthetic self-authored statement.', 'SUBMITTED'
);
DO $$
BEGIN
  BEGIN
    INSERT INTO mmc.cam_v2_student_statements (
      id, tenant_id, environment, subject_link_id, author_principal_id,
      statement_kind, statement_text, statement_state
    ) VALUES (
      '10000000-0000-4000-8000-00000000000e', '00000000-0000-4000-8000-0000000000a1',
      'LOCAL', '00000000-0000-4000-8000-0000000000a8',
      '00000000-0000-4000-8000-0000000000a6', 'REFLECTION',
      'Wrong-subject author sentinel', 'SUBMITTED'
    );
    RAISE EXCEPTION 'student statement accepted a different subject owner';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO mmc.cam_v2_student_responses (
      id, tenant_id, environment, subject_link_id, author_principal_id,
      target_kind, target_id, response_kind, response_text
    ) VALUES (
      '10000000-0000-4000-8000-00000000000f', '00000000-0000-4000-8000-0000000000a1',
      'LOCAL', '00000000-0000-4000-8000-0000000000a8',
      '00000000-0000-4000-8000-0000000000a5', 'TASK',
      '00000000-0000-4000-8000-0000000000c7', 'DISPUTE', 'Wrong-target sentinel'
    );
    RAISE EXCEPTION 'student response accepted a cross-scope target';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
END $$;

INSERT INTO mmc.cam_v2_jobs (
  id, tenant_id, environment, authority_grant_id, assignment_id, subject_link_id,
  queue_name, job_kind, operation_ref, payload_digest, status, attempt_count,
  lease_owner_principal_id, lease_generation, lease_expires_at
) VALUES
  ('00000000-0000-4000-8000-0000000000b0', '00000000-0000-4000-8000-0000000000a1', 'LOCAL',
   '00000000-0000-4000-8000-0000000000b6', '00000000-0000-4000-8000-0000000000aa',
   '00000000-0000-4000-8000-0000000000a8', 'analysis', 'AI_ANALYSIS', 'leased-analysis-a', repeat('1', 64),
   'LEASED', 1, '00000000-0000-4000-8000-0000000000a7', 3, now() + interval '5 minutes'),
  ('00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-0000000000a1', 'LOCAL',
   '00000000-0000-4000-8000-0000000000f2', '00000000-0000-4000-8000-0000000000aa',
   '00000000-0000-4000-8000-0000000000a8', 'analysis-claim', 'ASSET_ACQUISITION', 'queued-analysis-a', repeat('2', 64),
   'QUEUED', 0, NULL, 0, NULL),
  ('00000000-0000-4000-8000-0000000000b2', '00000000-0000-4000-8000-0000000000a1', 'LOCAL',
   '00000000-0000-4000-8000-0000000000b7', '00000000-0000-4000-8000-0000000000aa',
   '00000000-0000-4000-8000-0000000000a8', 'revoked-analysis', 'AI_ANALYSIS', 'revoked-analysis-a', repeat('3', 64),
   'QUEUED', 0, NULL, 0, NULL),
  ('00000000-0000-4000-8000-0000000000b8', '00000000-0000-4000-8000-0000000000a1', 'LOCAL',
   '00000000-0000-4000-8000-0000000000b7', '00000000-0000-4000-8000-0000000000aa',
   '00000000-0000-4000-8000-0000000000a8', 'revoked-leased', 'AI_ANALYSIS', 'revoked-leased-a', repeat('5', 64),
   'LEASED', 1, '00000000-0000-4000-8000-0000000000a7', 1, now() + interval '5 minutes'),
  ('00000000-0000-4000-8000-0000000000ba', '00000000-0000-4000-8000-0000000000a1', 'LOCAL',
   '00000000-0000-4000-8000-0000000000bb', '00000000-0000-4000-8000-0000000000aa',
   '00000000-0000-4000-8000-0000000000a8', 'publication-disabled', 'PUBLICATION_RENDER', 'disabled-publication-a', repeat('4', 64),
   'QUEUED', 0, NULL, 0, NULL),
  ('00000000-0000-4000-8000-0000000000f4', '00000000-0000-4000-8000-0000000000a1', 'LOCAL',
   '00000000-0000-4000-8000-0000000000f2', '00000000-0000-4000-8000-0000000000aa',
   '00000000-0000-4000-8000-0000000000a8', 'acquisition-handoff', 'ASSET_ACQUISITION', 'handoff-acquisition', repeat('c', 64),
   'LEASED', 1, '00000000-0000-4000-8000-0000000000a7', 1, now() + interval '5 minutes'),
  ('00000000-0000-4000-8000-0000000000f5', '00000000-0000-4000-8000-0000000000a1', 'LOCAL',
   '00000000-0000-4000-8000-0000000000f3', '00000000-0000-4000-8000-0000000000aa',
   '00000000-0000-4000-8000-0000000000a8', 'transcript-handoff', 'TRANSCRIPT_PROCESSING', 'handoff-transcript', repeat('d', 64),
   'QUEUED', 0, NULL, 0, NULL),
  ('00000000-0000-4000-8000-0000000000f6', '00000000-0000-4000-8000-0000000000a1', 'LOCAL',
   '00000000-0000-4000-8000-0000000000b6', '00000000-0000-4000-8000-0000000000aa',
   '00000000-0000-4000-8000-0000000000a8', 'analysis-handoff', 'AI_ANALYSIS', 'handoff-analysis', repeat('e', 64),
   'QUEUED', 0, NULL, 0, NULL),
  ('00000000-0000-4000-8000-0000000000f7', '00000000-0000-4000-8000-0000000000a1', 'LOCAL',
   '00000000-0000-4000-8000-0000000000b6', '00000000-0000-4000-8000-0000000000aa',
   '00000000-0000-4000-8000-0000000000a8', 'wrong-handoff', 'AI_ANALYSIS', 'handoff-wrong-job', repeat('f', 64),
   'LEASED', 1, '00000000-0000-4000-8000-0000000000a7', 1, now() + interval '5 minutes'),
  ('00000000-0000-4000-8000-0000000000c9', '00000000-0000-4000-8000-0000000000a1', 'LOCAL',
   '00000000-0000-4000-8000-0000000000b6', '00000000-0000-4000-8000-0000000000aa',
   '00000000-0000-4000-8000-0000000000a8', 'recovery-not-sent', 'AI_ANALYSIS', 'recovery-not-sent-a', repeat('7', 64),
   'RUNNING', 1, '00000000-0000-4000-8000-0000000000a7', 1, now() - interval '5 minutes'),
  ('00000000-0000-4000-8000-0000000000ca', '00000000-0000-4000-8000-0000000000a1', 'LOCAL',
   '00000000-0000-4000-8000-0000000000b6', '00000000-0000-4000-8000-0000000000aa',
   '00000000-0000-4000-8000-0000000000a8', 'recovery-unknown', 'AI_ANALYSIS', 'recovery-unknown-a', repeat('8', 64),
   'RUNNING', 1, '00000000-0000-4000-8000-0000000000a7', 1, now() - interval '5 minutes'),
  ('00000000-0000-4000-8000-0000000000cc', '00000000-0000-4000-8000-0000000000a1', 'LOCAL',
   '00000000-0000-4000-8000-0000000000f2', '00000000-0000-4000-8000-0000000000aa',
   '00000000-0000-4000-8000-0000000000a8', 'expired-running-reclaim', 'ASSET_ACQUISITION', 'expired-running-reclaim-a', repeat('4', 64),
   'RUNNING', 1, '00000000-0000-4000-8000-0000000000a7', 1, now() - interval '5 minutes'),
  ('00000000-0000-4000-8000-0000000000d3', '00000000-0000-4000-8000-0000000000a1', 'LOCAL',
   '00000000-0000-4000-8000-0000000000b6', '00000000-0000-4000-8000-0000000000aa',
   '00000000-0000-4000-8000-0000000000a8', 'worker-retry', 'AI_ANALYSIS', 'worker-retry-a', repeat('a', 64),
   'RUNNING', 1, '00000000-0000-4000-8000-0000000000a7', 1, now() + interval '5 minutes'),
  ('00000000-0000-4000-8000-0000000000cb', '00000000-0000-4000-8000-0000000000a1', 'LOCAL',
   '00000000-0000-4000-8000-0000000000f3', '00000000-0000-4000-8000-0000000000aa',
   '00000000-0000-4000-8000-0000000000a8', 'starvation-consumer', 'TRANSCRIPT_PROCESSING', 'starvation-consumer-a', repeat('9', 64),
   'QUEUED', 0, NULL, 0, NULL);

-- TYPED_AI_SUCCESS_ATTESTATION setup: a fully durable acquisition→transcript
-- lineage feeds one leased analysis job whose successful completion must bind
-- an exact PROPOSED analysis row and its transcript input.
INSERT INTO mmc.cam_v2_jobs (
  id, tenant_id, environment, authority_grant_id, assignment_id, subject_link_id,
  queue_name, job_kind, operation_ref, payload_digest,
  provider_idempotency_key_digest, status, attempt_count, lease_generation,
  result_digest, external_dispatch_generation, external_dispatch_intent_digest,
  external_dispatch_idempotency_key_digest, external_dispatch_recorded_at,
  external_result_generation, external_outcome, external_result_digest,
  external_provider_idempotency_proven, external_result_recorded_at,
  completed_at, completed_by_principal_id, completed_lease_generation,
  completion_disposition, completion_result_digest
) VALUES (
  '00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-0000000000a1', 'LOCAL',
  '00000000-0000-4000-8000-0000000000f2', '00000000-0000-4000-8000-0000000000aa',
  '00000000-0000-4000-8000-0000000000a8', 'typed-ai-upstream', 'ASSET_ACQUISITION',
  'typed-ai-acquisition', repeat('1', 64), repeat('9', 64), 'SUCCEEDED', 1, 1,
  repeat('a', 64), 1, repeat('1', 64), repeat('9', 64), now() - interval '3 minutes',
  1, 'SUCCEEDED', repeat('a', 64), false, now() - interval '2 minutes',
  now() - interval '1 minute', '00000000-0000-4000-8000-0000000000a7', 1,
  'SUCCEEDED', repeat('a', 64)
);
INSERT INTO mmc.cam_v2_jobs (
  id, tenant_id, environment, authority_grant_id, assignment_id, subject_link_id,
  queue_name, job_kind, operation_ref, payload_digest, status
) VALUES
  ('00000000-0000-4000-8000-0000000000e0', '00000000-0000-4000-8000-0000000000a1', 'LOCAL',
   '00000000-0000-4000-8000-0000000000f3', '00000000-0000-4000-8000-0000000000aa',
   '00000000-0000-4000-8000-0000000000a8', 'typed-ai-upstream', 'TRANSCRIPT_PROCESSING',
   'typed-ai-transcript', repeat('2', 64), 'QUEUED'),
  ('00000000-0000-4000-8000-0000000000e4', '00000000-0000-4000-8000-0000000000a1', 'LOCAL',
   '00000000-0000-4000-8000-0000000000b6', '00000000-0000-4000-8000-0000000000aa',
   '00000000-0000-4000-8000-0000000000a8', 'typed-ai-analysis', 'AI_ANALYSIS',
   'typed-ai-analysis', repeat('3', 64), 'QUEUED');

-- STALE_PREFIX_NO_STARVATION: more than the historical 32-row claim window
-- are older but dependency-unready AI jobs. Readiness is filtered before the
-- bounded window, so the later ready acquisition below must still be claimed.
INSERT INTO mmc.cam_v2_jobs (
  tenant_id, environment, authority_grant_id, assignment_id, subject_link_id,
  queue_name, job_kind, operation_ref, payload_digest, status, attempt_count,
  available_at
)
SELECT
  '00000000-0000-4000-8000-0000000000a1', 'LOCAL',
  '00000000-0000-4000-8000-0000000000b6', '00000000-0000-4000-8000-0000000000aa',
  '00000000-0000-4000-8000-0000000000a8', 'analysis-claim', 'AI_ANALYSIS',
  'starvation-unready-' || ordinal::text,
  lpad(to_hex(ordinal), 64, '0'), 'QUEUED', 0, now() - interval '2 days'
FROM generate_series(1, 40) AS ordinal;

UPDATE mmc.cam_v2_jobs
SET lease_expires_at = CASE WHEN id IN (
        '00000000-0000-4000-8000-0000000000b8',
        '00000000-0000-4000-8000-0000000000f4'
      )
      THEN now() - interval '5 minutes' ELSE lease_expires_at END,
    external_dispatch_generation = 1,
    external_dispatch_intent_digest = repeat('6', 64),
    external_dispatch_idempotency_key_digest = provider_idempotency_key_digest,
    external_dispatch_recorded_at = now() - interval '10 minutes',
    object_version = object_version + 1,
    updated_at = clock_timestamp()
WHERE id IN (
  '00000000-0000-4000-8000-0000000000b8',
  '00000000-0000-4000-8000-0000000000c9',
  '00000000-0000-4000-8000-0000000000ca',
  '00000000-0000-4000-8000-0000000000d3',
  '00000000-0000-4000-8000-0000000000f4'
);

INSERT INTO mmc.cam_v2_source_assets (
  id, tenant_id, environment, job_id, authority_grant_id, assignment_id, subject_link_id,
  opaque_asset_handle, source_system, source_record_digest, content_digest,
  declared_media_type, byte_size, asset_state, retention_policy_version_id
) VALUES (
  '00000000-0000-4000-8000-0000000000f8', '00000000-0000-4000-8000-0000000000a1', 'LOCAL',
  '00000000-0000-4000-8000-0000000000f4', '00000000-0000-4000-8000-0000000000f2',
  '00000000-0000-4000-8000-0000000000aa', '00000000-0000-4000-8000-0000000000a8',
  'opaque://synthetic-handoff-asset', 'SYNTHETIC', repeat('1', 64), repeat('2', 64),
  'text/plain', 128, 'PAIR_VERIFIED', '00000000-0000-4000-8000-0000000000f9'
);

-- A second exact acquisition artifact/handoff makes b1 the only ready row
-- behind more than 32 older dependency-unready queue rows. Its content digest
-- also seals the later successful completion to a typed durable artifact.
INSERT INTO mmc.cam_v2_source_assets (
  id, tenant_id, environment, job_id, authority_grant_id, assignment_id, subject_link_id,
  opaque_asset_handle, source_system, source_record_digest, content_digest,
  declared_media_type, byte_size, asset_state, retention_policy_version_id
) VALUES (
  '00000000-0000-4000-8000-0000000000d0', '00000000-0000-4000-8000-0000000000a1', 'LOCAL',
  '00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-0000000000f2',
  '00000000-0000-4000-8000-0000000000aa', '00000000-0000-4000-8000-0000000000a8',
  'synthetic-acquisition-b1', 'SYNTHETIC', repeat('5', 64), repeat('2', 64),
  'text/plain', 64, 'PAIR_VERIFIED', '00000000-0000-4000-8000-0000000000f9'
);

-- SOURCE_ASSET_PREHANDOFF_ENRICHMENT. Discovery may be enriched exactly once
-- from null content metadata to an attested pair before any typed handoff;
-- provenance and subsequent content remain immutable.
INSERT INTO mmc.cam_v2_source_assets (
  id, tenant_id, environment, job_id, authority_grant_id, assignment_id, subject_link_id,
  opaque_asset_handle, source_system, source_record_digest,
  asset_state, retention_policy_version_id
) VALUES (
  '00000000-0000-4000-8000-0000000000d4', '00000000-0000-4000-8000-0000000000a1', 'LOCAL',
  '00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-0000000000f2',
  '00000000-0000-4000-8000-0000000000aa', '00000000-0000-4000-8000-0000000000a8',
  'synthetic-discovery-enrichment', 'SYNTHETIC', repeat('6', 64),
  'DISCOVERED', '00000000-0000-4000-8000-0000000000f9'
);
UPDATE mmc.cam_v2_source_assets
SET content_digest = repeat('7', 64), declared_media_type = 'text/plain', byte_size = 32,
    asset_state = 'PAIR_VERIFIED', object_version = object_version + 1,
    updated_at = clock_timestamp()
WHERE id = '00000000-0000-4000-8000-0000000000d4';
DO $$
BEGIN
  BEGIN
    UPDATE mmc.cam_v2_source_assets
    SET content_digest = repeat('8', 64), object_version = object_version + 1
    WHERE id = '00000000-0000-4000-8000-0000000000d4';
    RAISE EXCEPTION 'attested source content accepted a second enrichment';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
END $$;

-- Build the exact typed acquisition -> transcript -> analysis lineage used by
-- the runtime success-attestation proof below. Every edge is inserted while
-- its consumer is still unfrozen; the terminal transcript producer is then
-- sealed to the canonical digest of its exact source-asset input.
INSERT INTO mmc.cam_v2_source_assets (
  id, tenant_id, environment, job_id, authority_grant_id, assignment_id, subject_link_id,
  opaque_asset_handle, source_system, source_record_digest, content_digest,
  declared_media_type, byte_size, asset_state, retention_policy_version_id
) VALUES (
  '00000000-0000-4000-8000-0000000000e2', '00000000-0000-4000-8000-0000000000a1', 'LOCAL',
  '00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-0000000000f2',
  '00000000-0000-4000-8000-0000000000aa', '00000000-0000-4000-8000-0000000000a8',
  'synthetic-typed-ai-source', 'SYNTHETIC', repeat('8', 64), repeat('a', 64),
  'text/plain', 256, 'PAIR_VERIFIED', '00000000-0000-4000-8000-0000000000f9'
);

INSERT INTO mmc.cam_v2_job_inputs (
  id, tenant_id, environment, consumer_job_id, producer_job_id,
  consumer_authority_grant_id, producer_authority_grant_id,
  assignment_id, subject_link_id, input_kind, source_asset_id, transcript_version_id
) VALUES (
  '00000000-0000-4000-8000-0000000000e6', '00000000-0000-4000-8000-0000000000a1', 'LOCAL',
  '00000000-0000-4000-8000-0000000000e0', '00000000-0000-4000-8000-0000000000e1',
  '00000000-0000-4000-8000-0000000000f3', '00000000-0000-4000-8000-0000000000f2',
  '00000000-0000-4000-8000-0000000000aa', '00000000-0000-4000-8000-0000000000a8',
  'SOURCE_ASSET', '00000000-0000-4000-8000-0000000000e2', NULL
);

INSERT INTO mmc.cam_v2_transcript_versions (
  id, tenant_id, environment, job_id, source_asset_id, authority_grant_id,
  assignment_id, subject_link_id, transcript_version, transcript_digest,
  normalized_digest, language_code, transcript_state
) VALUES (
  '00000000-0000-4000-8000-0000000000e3', '00000000-0000-4000-8000-0000000000a1', 'LOCAL',
  '00000000-0000-4000-8000-0000000000e0', '00000000-0000-4000-8000-0000000000e2',
  '00000000-0000-4000-8000-0000000000f3', '00000000-0000-4000-8000-0000000000aa',
  '00000000-0000-4000-8000-0000000000a8', 1, repeat('e', 64), repeat('b', 64),
  'en', 'VERIFIED'
);

INSERT INTO mmc.cam_v2_job_inputs (
  id, tenant_id, environment, consumer_job_id, producer_job_id,
  consumer_authority_grant_id, producer_authority_grant_id,
  assignment_id, subject_link_id, input_kind, source_asset_id, transcript_version_id
) VALUES (
  '00000000-0000-4000-8000-0000000000e7', '00000000-0000-4000-8000-0000000000a1', 'LOCAL',
  '00000000-0000-4000-8000-0000000000e4', '00000000-0000-4000-8000-0000000000e0',
  '00000000-0000-4000-8000-0000000000b6', '00000000-0000-4000-8000-0000000000f3',
  '00000000-0000-4000-8000-0000000000aa', '00000000-0000-4000-8000-0000000000a8',
  'TRANSCRIPT_VERSION', NULL, '00000000-0000-4000-8000-0000000000e3'
);

INSERT INTO mmc.cam_v2_analysis_runs (
  id, tenant_id, environment, job_id, authority_grant_id, assignment_id,
  subject_link_id, transcript_version_id, policy_version_id,
  provider_digest, model_digest, prompt_digest, analysis_state,
  started_at, completed_at, result_digest
) VALUES (
  '00000000-0000-4000-8000-0000000000e5', '00000000-0000-4000-8000-0000000000a1', 'LOCAL',
  '00000000-0000-4000-8000-0000000000e4', '00000000-0000-4000-8000-0000000000b6',
  '00000000-0000-4000-8000-0000000000aa', '00000000-0000-4000-8000-0000000000a8',
  '00000000-0000-4000-8000-0000000000e3', '00000000-0000-4000-8000-0000000000b4',
  repeat('1', 64), repeat('2', 64), repeat('3', 64), 'PROPOSED',
  now() - interval '2 minutes', now() - interval '1 minute', repeat('c', 64)
);

-- Move the typed transcript job through a legal leased state before sealing
-- its successful handoff. Owner fixture setup must obey the same forward-only
-- state machine as runtime mutations.
UPDATE mmc.cam_v2_jobs
SET status = 'LEASED', attempt_count = 1,
    lease_owner_principal_id = '00000000-0000-4000-8000-0000000000a7',
    lease_generation = 1, lease_expires_at = now() + interval '5 minutes',
    object_version = object_version + 1, updated_at = clock_timestamp()
WHERE id = '00000000-0000-4000-8000-0000000000e0';

-- Deferred job-success coherence verifies that every successful fixture has
-- immutable, generation-bound provider evidence in addition to its typed
-- artifact/handoff materialized below.
INSERT INTO mmc.cam_v2_outbox_events (
  id, tenant_id, environment, job_id, aggregate_kind, aggregate_id,
  aggregate_version, event_kind, payload_digest, external_lease_generation,
  external_outcome, external_result_digest,
  external_provider_idempotency_proven,
  external_provider_idempotency_key_digest, external_result_recorded_at,
  delivery_state
) VALUES
  ('70000000-0000-4000-8000-000000000030',
   '00000000-0000-4000-8000-0000000000a1', 'LOCAL',
   '00000000-0000-4000-8000-0000000000e1', 'JOB_EXTERNAL_RESULT',
   '00000000-0000-4000-8000-0000000000e1', 1,
   'SYNTHETIC_TYPED_ACQUISITION_SUCCESS', repeat('a', 64), 1,
   'SUCCEEDED', repeat('a', 64), false, repeat('9', 64),
   now() - interval '2 minutes', 'QUARANTINED'),
  ('70000000-0000-4000-8000-000000000031',
   '00000000-0000-4000-8000-0000000000a1', 'LOCAL',
   '00000000-0000-4000-8000-0000000000e0', 'JOB_EXTERNAL_RESULT',
   '00000000-0000-4000-8000-0000000000e0', 1,
   'SYNTHETIC_TYPED_TRANSCRIPT_SUCCESS', repeat('b', 64), 1,
   'SUCCEEDED', repeat('b', 64), false,
   (SELECT provider_idempotency_key_digest
    FROM mmc.cam_v2_jobs
    WHERE id = '00000000-0000-4000-8000-0000000000e0'),
   now() - interval '2 minutes', 'QUARANTINED');

UPDATE mmc.cam_v2_jobs
SET status = 'SUCCEEDED', attempt_count = 1, lease_generation = 1,
    input_set_digest = mmc.cam_v2_sha256_jsonb(jsonb_build_array(jsonb_build_object(
      'edgeId', '00000000-0000-4000-8000-0000000000e6'::uuid,
      'inputKind', 'SOURCE_ASSET',
      'producerJobId', '00000000-0000-4000-8000-0000000000e1'::uuid,
      'producerGeneration', 1,
      'producerResultDigest', repeat('a', 64),
      'producerAuthorityGrantId', '00000000-0000-4000-8000-0000000000f2'::uuid,
      'consumerAuthorityGrantId', '00000000-0000-4000-8000-0000000000f3'::uuid,
      'assignmentId', '00000000-0000-4000-8000-0000000000aa'::uuid,
      'subjectLinkId', '00000000-0000-4000-8000-0000000000a8'::uuid,
      'sourceAssetId', '00000000-0000-4000-8000-0000000000e2'::uuid,
      'transcriptVersionId', NULL,
      'artifactVersion', 1,
      'artifactDigest', repeat('a', 64),
      'artifactSecondaryDigest', NULL
    ))),
    input_set_frozen_at = now(), result_digest = repeat('b', 64),
    external_dispatch_generation = 1,
    external_dispatch_intent_digest = repeat('2', 64),
    external_dispatch_idempotency_key_digest = provider_idempotency_key_digest,
    external_dispatch_recorded_at = now() - interval '3 minutes',
    external_result_generation = 1, external_outcome = 'SUCCEEDED',
    external_result_digest = repeat('b', 64),
    external_provider_idempotency_proven = false,
    external_result_recorded_at = now() - interval '2 minutes',
    completed_at = now() - interval '1 minute',
    completed_by_principal_id = '00000000-0000-4000-8000-0000000000a7',
    completed_lease_generation = 1, completion_disposition = 'SUCCEEDED',
    completion_result_digest = repeat('b', 64),
    lease_owner_principal_id = NULL, lease_expires_at = NULL,
    object_version = object_version + 1, updated_at = clock_timestamp()
WHERE id = '00000000-0000-4000-8000-0000000000e0';

INSERT INTO mmc.cam_v2_job_inputs (
  id, tenant_id, environment, consumer_job_id, producer_job_id,
  consumer_authority_grant_id, producer_authority_grant_id,
  assignment_id, subject_link_id, input_kind, source_asset_id, transcript_version_id
) VALUES (
  '00000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-0000000000a1', 'LOCAL',
  '00000000-0000-4000-8000-0000000000cb', '00000000-0000-4000-8000-0000000000b1',
  '00000000-0000-4000-8000-0000000000f3', '00000000-0000-4000-8000-0000000000f2',
  '00000000-0000-4000-8000-0000000000aa', '00000000-0000-4000-8000-0000000000a8',
  'SOURCE_ASSET', '00000000-0000-4000-8000-0000000000d0', NULL
);

-- The typed edge must exist while its consumer is still unfrozen, before the
-- consumer-owned transcript can be materialized from that exact input.
INSERT INTO mmc.cam_v2_job_inputs (
  id, tenant_id, environment, consumer_job_id, producer_job_id,
  consumer_authority_grant_id, producer_authority_grant_id,
  assignment_id, subject_link_id, input_kind, source_asset_id, transcript_version_id
) VALUES (
  '00000000-0000-4000-8000-0000000000fb', '00000000-0000-4000-8000-0000000000a1', 'LOCAL',
  '00000000-0000-4000-8000-0000000000f5', '00000000-0000-4000-8000-0000000000f4',
  '00000000-0000-4000-8000-0000000000f3', '00000000-0000-4000-8000-0000000000f2',
  '00000000-0000-4000-8000-0000000000aa', '00000000-0000-4000-8000-0000000000a8',
  'SOURCE_ASSET', '00000000-0000-4000-8000-0000000000f8', NULL
);

INSERT INTO mmc.cam_v2_transcript_versions (
  id, tenant_id, environment, job_id, source_asset_id, authority_grant_id,
  assignment_id, subject_link_id, transcript_version, transcript_digest,
  normalized_digest, language_code, transcript_state
) VALUES (
  '00000000-0000-4000-8000-0000000000fa', '00000000-0000-4000-8000-0000000000a1', 'LOCAL',
  '00000000-0000-4000-8000-0000000000f5', '00000000-0000-4000-8000-0000000000f8',
  '00000000-0000-4000-8000-0000000000f3', '00000000-0000-4000-8000-0000000000aa',
  '00000000-0000-4000-8000-0000000000a8', 1, repeat('3', 64), repeat('4', 64), 'en', 'VERIFIED'
);

INSERT INTO mmc.cam_v2_job_inputs (
  id, tenant_id, environment, consumer_job_id, producer_job_id,
  consumer_authority_grant_id, producer_authority_grant_id,
  assignment_id, subject_link_id, input_kind, source_asset_id, transcript_version_id
) VALUES (
  '00000000-0000-4000-8000-0000000000fc', '00000000-0000-4000-8000-0000000000a1', 'LOCAL',
   '00000000-0000-4000-8000-0000000000f6', '00000000-0000-4000-8000-0000000000f5',
   '00000000-0000-4000-8000-0000000000b6', '00000000-0000-4000-8000-0000000000f3',
   '00000000-0000-4000-8000-0000000000aa', '00000000-0000-4000-8000-0000000000a8',
  'TRANSCRIPT_VERSION', NULL, '00000000-0000-4000-8000-0000000000fa'
);

INSERT INTO mmc.cam_v2_outbox_events (
  id, tenant_id, environment, job_id, aggregate_kind, aggregate_id,
  aggregate_version, event_kind, payload_digest, delivery_queue_name
) VALUES (
  '00000000-0000-4000-8000-0000000000c8', '00000000-0000-4000-8000-0000000000a1', 'LOCAL',
  '00000000-0000-4000-8000-0000000000b8', 'JOB', '00000000-0000-4000-8000-0000000000b8',
  1, 'SYNTHETIC_REVOKED_AUTHORITY', repeat('6', 64), 'revoked-consumer'
);

INSERT INTO mmc.cam_v2_outbox_events (
  id, tenant_id, environment, aggregate_kind, aggregate_id,
  aggregate_version, event_kind, payload_digest, delivery_queue_name
) VALUES (
  '00000000-0000-4000-8000-0000000000d2', '00000000-0000-4000-8000-0000000000a1', 'LOCAL',
  'SUBJECT', '00000000-0000-4000-8000-0000000000a8',
  1, 'SYNTHETIC_CONTROL_COMPLETION', repeat('7', 64), 'outbox-control'
);

-- STRUCTURAL_ROLE_STATE_AND_IMMUTABILITY_DENY. These owner/bootstrap probes
-- prove that RLS-independent constraints reject forged roles, malformed state,
-- and in-place rebinding of durable identity, authority, work, and evidence.
DO $$
DECLARE
  v_message text;
  v_constraint text;
BEGIN
  BEGIN
    INSERT INTO mmc.cam_v2_subject_links (
      id, tenant_id, environment, student_principal_id, external_subject_digest,
      identity_state, independent_authority_count, verified_by_principal_id, verified_at
    ) VALUES (
      '70000000-0000-4000-8000-000000000001',
      '00000000-0000-4000-8000-0000000000a1', 'LOCAL',
      '00000000-0000-4000-8000-0000000000a6', repeat('1', 64),
      'VERIFIED_LOCAL_LINK', 0, '00000000-0000-4000-8000-0000000000a2', now()
    );
    RAISE EXCEPTION 'verified subject accepted zero independent authorities';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  BEGIN
    INSERT INTO mmc.cam_v2_subject_links (
      id, tenant_id, environment, student_principal_id, external_subject_digest,
      identity_state, independent_authority_count, verified_by_principal_id, verified_at
    ) VALUES (
      '70000000-0000-4000-8000-000000000002',
      '00000000-0000-4000-8000-0000000000a1', 'LOCAL',
      '00000000-0000-4000-8000-0000000000a6', repeat('2', 64),
      'VERIFIED_LOCAL_LINK', 2, '00000000-0000-4000-8000-0000000000a5', now()
    );
    RAISE EXCEPTION 'student principal was accepted as an identity verifier';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  BEGIN
    INSERT INTO mmc.cam_v2_policy_versions (
      id, tenant_id, environment, policy_kind, policy_version,
      policy_digest, status, effective_at
    ) VALUES (
      '70000000-0000-4000-8000-000000000003',
      '00000000-0000-4000-8000-0000000000a1', 'LOCAL',
      'AI_TRANSFER', 99, repeat('3', 64), 'ACTIVE', now()
    );
    RAISE EXCEPTION 'active policy accepted no approver';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  BEGIN
    INSERT INTO mmc.cam_v2_command_receipts (
      id, tenant_id, environment, principal_id, command_id, command_kind,
      target_kind, target_id, expected_version, schema_version,
      semantic_command_digest, status, correlation_id
    ) VALUES (
      '70000000-0000-4000-8000-000000000004',
      '00000000-0000-4000-8000-0000000000a1', 'LOCAL',
      '00000000-0000-4000-8000-0000000000a5',
      '70000000-0000-4000-8000-000000000005', 'task.upsert', 'TASK',
      '00000000-0000-4000-8000-0000000000ad', 1, 1, repeat('4', 64),
      'RECEIVED', 'mmc006-wrong-command-role'
    );
    RAISE EXCEPTION 'student principal was accepted for mentor task command';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  BEGIN
    UPDATE mmc.cam_v2_principals
    SET auth_subject_digest = repeat('0', 64), object_version = object_version + 1
    WHERE id = '00000000-0000-4000-8000-0000000000a5';
    RAISE EXCEPTION 'principal durable identity was mutable';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    UPDATE mmc.cam_v2_subject_links
    SET student_principal_id = '00000000-0000-4000-8000-0000000000a6',
        object_version = object_version + 1
    WHERE id = '00000000-0000-4000-8000-0000000000a8';
    RAISE EXCEPTION 'verified subject binding was mutable';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    UPDATE mmc.cam_v2_assignments
    SET mentor_principal_id = '00000000-0000-4000-8000-0000000000bd',
        object_version = object_version + 1
    WHERE id = '00000000-0000-4000-8000-0000000000aa';
    RAISE EXCEPTION 'active assignment mentor binding was mutable';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    UPDATE mmc.cam_v2_policy_versions
    SET policy_digest = repeat('1', 64), object_version = object_version + 1
    WHERE id = '00000000-0000-4000-8000-0000000000b4';
    RAISE EXCEPTION 'active policy content was mutable';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    UPDATE mmc.cam_v2_authority_grants
    SET basis_digest = repeat('2', 64), object_version = object_version + 1
    WHERE id = '00000000-0000-4000-8000-0000000000b6';
    RAISE EXCEPTION 'active authority provenance was mutable';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  -- ACTIVE_EXPIRY_IMMUTABILITY_DENY. An active authority window cannot be
  -- prolonged or erased in place after approval.
  BEGIN
    UPDATE mmc.cam_v2_assignments
    SET expires_at = now() + interval '30 days', object_version = object_version + 1
    WHERE id = '00000000-0000-4000-8000-0000000000aa';
    RAISE EXCEPTION 'active assignment expiry was mutable';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    UPDATE mmc.cam_v2_policy_versions
    SET expires_at = now() + interval '30 days', object_version = object_version + 1
    WHERE id = '00000000-0000-4000-8000-0000000000b4';
    RAISE EXCEPTION 'active policy expiry was mutable';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    UPDATE mmc.cam_v2_authority_grants
    SET expires_at = now() + interval '30 days', object_version = object_version + 1
    WHERE id = '00000000-0000-4000-8000-0000000000b6';
    RAISE EXCEPTION 'active authority-grant expiry was mutable';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO mmc.cam_v2_assignments (
      id, tenant_id, environment, mentor_principal_id, subject_link_id,
      status, effective_at, granted_by_principal_id
    ) VALUES (
      '70000000-0000-4000-8000-000000000013',
      '00000000-0000-4000-8000-0000000000a1', 'LOCAL',
      '00000000-0000-4000-8000-0000000000a4',
      '00000000-0000-4000-8000-0000000000a8', 'ACTIVE',
      now() - interval '1 minute', '00000000-0000-4000-8000-0000000000a2'
    );
    RAISE EXCEPTION 'active assignment accepted a revoked mentor';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  -- POLICY_RETIREMENT_AFTER_APPROVER_REVOCATION. Historical approval remains
  -- immutable evidence, but it cannot prevent a safe ACTIVE→RETIRED closure.
  BEGIN
    UPDATE mmc.cam_v2_principals
    SET status = 'REVOKED', object_version = object_version + 1
    WHERE id = '00000000-0000-4000-8000-0000000000a2';
    UPDATE mmc.cam_v2_policy_versions
    SET status = 'RETIRED', object_version = object_version + 1
    WHERE id = '00000000-0000-4000-8000-0000000000b4';
    IF NOT EXISTS (
      SELECT 1 FROM mmc.cam_v2_policy_versions
      WHERE id = '00000000-0000-4000-8000-0000000000b4' AND status = 'RETIRED'
    ) THEN
      RAISE EXCEPTION 'policy did not retire after historical approver revocation';
    END IF;
    RAISE EXCEPTION 'POLICY_RETIREMENT_FIXTURE_ROLLBACK';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_message = MESSAGE_TEXT;
    IF v_message <> 'POLICY_RETIREMENT_FIXTURE_ROLLBACK' THEN RAISE; END IF;
  END;

  -- JOB_RECLAIM_SHAPE_DENY. A still-current RUNNING lease cannot be relabeled
  -- as a new lease even if an owner supplies otherwise plausible counters.
  BEGIN
    INSERT INTO mmc.cam_v2_jobs (
      id, tenant_id, environment, authority_grant_id, assignment_id,
      subject_link_id, queue_name, job_kind, operation_ref, payload_digest,
      status, attempt_count, lease_owner_principal_id, lease_generation,
      lease_expires_at
    ) VALUES (
      '70000000-0000-4000-8000-000000000014',
      '00000000-0000-4000-8000-0000000000a1', 'LOCAL',
      '00000000-0000-4000-8000-0000000000f2',
      '00000000-0000-4000-8000-0000000000aa',
      '00000000-0000-4000-8000-0000000000a8', 'forged-reclaim',
      'ASSET_ACQUISITION', 'forged-reclaim', repeat('d', 64),
      'RUNNING', 1, '00000000-0000-4000-8000-0000000000a7', 1,
      now() + interval '5 minutes'
    );
    UPDATE mmc.cam_v2_jobs
    SET status = 'LEASED', attempt_count = 2, lease_generation = 2,
        lease_owner_principal_id = '00000000-0000-4000-8000-0000000000a7',
        lease_expires_at = now() + interval '10 minutes',
        object_version = object_version + 1
    WHERE id = '70000000-0000-4000-8000-000000000014';
    RAISE EXCEPTION 'unexpired RUNNING lease was reclaimed';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  -- JOB_TERMINAL_EVIDENCE_IMMUTABILITY_DENY. Once terminal, neither provider
  -- evidence nor completion identity can be rewritten in place.
  BEGIN
    UPDATE mmc.cam_v2_jobs
    SET external_provider_receipt_digest = repeat('9', 64),
        object_version = object_version + 1
    WHERE id = '00000000-0000-4000-8000-0000000000e1';
    RAISE EXCEPTION 'terminal job provider evidence was mutable';
  EXCEPTION WHEN check_violation THEN
    GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
    IF v_constraint <> 'cam_v2_job_terminal_evidence_immutable' THEN RAISE; END IF;
  END;

  -- JOB_SUCCESS_EVIDENCE_DENY. A legal-shaped terminal row cannot fabricate
  -- provider success without its exact durable result event and typed handoff.
  BEGIN
    INSERT INTO mmc.cam_v2_jobs (
      id, tenant_id, environment, authority_grant_id, assignment_id,
      subject_link_id, queue_name, job_kind, operation_ref, payload_digest,
      status, attempt_count, lease_owner_principal_id, lease_generation,
      lease_expires_at
    ) VALUES (
      '70000000-0000-4000-8000-000000000015',
      '00000000-0000-4000-8000-0000000000a1', 'LOCAL',
      '00000000-0000-4000-8000-0000000000b6',
      '00000000-0000-4000-8000-0000000000aa',
      '00000000-0000-4000-8000-0000000000a8', 'forged-success',
      'AI_ANALYSIS', 'forged-success', repeat('e', 64),
      'LEASED', 1, '00000000-0000-4000-8000-0000000000a7', 1,
      now() + interval '5 minutes'
    );
    UPDATE mmc.cam_v2_jobs
    SET status = 'SUCCEEDED', result_digest = repeat('f', 64),
        external_dispatch_generation = 1,
        external_dispatch_intent_digest = repeat('1', 64),
        external_dispatch_idempotency_key_digest = provider_idempotency_key_digest,
        external_dispatch_recorded_at = now(), external_result_generation = 1,
        external_outcome = 'SUCCEEDED', external_result_digest = repeat('f', 64),
        external_provider_idempotency_proven = false,
        external_result_recorded_at = now(), completed_at = now(),
        completed_by_principal_id = '00000000-0000-4000-8000-0000000000a7',
        completed_lease_generation = 1, completion_disposition = 'SUCCEEDED',
        completion_result_digest = repeat('f', 64),
        lease_owner_principal_id = NULL, lease_expires_at = NULL,
        object_version = object_version + 1
    WHERE id = '70000000-0000-4000-8000-000000000015';
    SET CONSTRAINTS mmc.cam_v2_jobs_success_evidence IMMEDIATE;
    RAISE EXCEPTION 'successful job accepted fabricated provider evidence';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  SET CONSTRAINTS mmc.cam_v2_jobs_success_evidence DEFERRED;

  -- OUTBOX_DELIVERY_EFFECT_DENY. A delivered label cannot replace the exact
  -- consumer effect and inbox receipt pair.
  BEGIN
    INSERT INTO mmc.cam_v2_outbox_events (
      id, tenant_id, environment, aggregate_kind, aggregate_id,
      aggregate_version, event_kind, payload_digest, delivery_queue_name,
      delivery_state, attempt_count, delivery_lease_owner_principal_id,
      delivery_lease_generation, delivery_lease_expires_at
    ) VALUES (
      '70000000-0000-4000-8000-000000000016',
      '00000000-0000-4000-8000-0000000000a1', 'LOCAL', 'SUBJECT',
      '00000000-0000-4000-8000-0000000000a8', 1,
      'FORGED_DELIVERY', repeat('1', 64), 'forged-delivery', 'LEASED', 1,
      '00000000-0000-4000-8000-0000000000a7', 1,
      now() + interval '5 minutes'
    );
    UPDATE mmc.cam_v2_outbox_events
    SET delivery_state = 'DELIVERED', delivered_at = now(),
        delivery_lease_owner_principal_id = NULL,
        delivery_lease_expires_at = NULL,
        object_version = object_version + 1
    WHERE id = '70000000-0000-4000-8000-000000000016';
    RAISE EXCEPTION 'outbox delivered without an effect/receipt pair';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    UPDATE mmc.cam_v2_jobs
    SET queue_name = 'rebound', object_version = object_version + 1
    WHERE id = '00000000-0000-4000-8000-0000000000e4';
    RAISE EXCEPTION 'job work identity was mutable';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    UPDATE mmc.cam_v2_outbox_events
    SET aggregate_kind = 'PUBLICATION', object_version = object_version + 1
    WHERE id = '00000000-0000-4000-8000-0000000000c8';
    RAISE EXCEPTION 'outbox event identity was mutable';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  BEGIN
    INSERT INTO mmc.cam_v2_jobs (
      id, tenant_id, environment, authority_grant_id, assignment_id,
      subject_link_id, queue_name, job_kind, operation_ref, payload_digest,
      status, lease_generation
    ) VALUES (
      '70000000-0000-4000-8000-000000000006',
      '00000000-0000-4000-8000-0000000000a1', 'LOCAL',
      '00000000-0000-4000-8000-0000000000b6',
      '00000000-0000-4000-8000-0000000000aa',
      '00000000-0000-4000-8000-0000000000a8', 'bad-lease', 'AI_ANALYSIS',
      'bad-lease-shape', repeat('6', 64), 'LEASED', 1
    );
    RAISE EXCEPTION 'leased job accepted no owner or expiry';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO mmc.cam_v2_outbox_events (
      id, tenant_id, environment, aggregate_kind, aggregate_id,
      aggregate_version, event_kind, payload_digest, delivery_queue_name,
      delivery_state, delivery_lease_generation
    ) VALUES (
      '70000000-0000-4000-8000-000000000007',
      '00000000-0000-4000-8000-0000000000a1', 'LOCAL', 'SUBJECT',
      '00000000-0000-4000-8000-0000000000a8', 1,
      'BAD_LEASE_SHAPE', repeat('7', 64), 'bad-lease', 'LEASED', 1
    );
    RAISE EXCEPTION 'leased outbox event accepted no owner or expiry';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  BEGIN
    BEGIN
      INSERT INTO mmc.cam_v2_lineage_edges (
        id, tenant_id, environment, from_kind, from_id, from_version,
        to_kind, to_id, to_version, relation_kind, transform_digest
      ) VALUES (
        '70000000-0000-4000-8000-000000000008',
        '00000000-0000-4000-8000-0000000000a1', 'LOCAL', 'SOURCE_ASSET',
        '00000000-0000-4000-8000-0000000000f8', 1, 'EVIDENCE_SPAN',
        '70000000-0000-4000-8000-000000000009', 1, 'SOURCE_TO_SPAN', repeat('8', 64)
      );
      RAISE EXCEPTION 'lineage accepted a nonexistent endpoint';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    INSERT INTO mmc.cam_v2_lineage_edges (
      id, tenant_id, environment, from_kind, from_id, from_version,
      to_kind, to_id, to_version, relation_kind, transform_digest
    ) VALUES (
      '70000000-0000-4000-8000-000000000008',
      '00000000-0000-4000-8000-0000000000a1', 'LOCAL', 'SOURCE_ASSET',
      '00000000-0000-4000-8000-0000000000f8', 1, 'TASK',
      '00000000-0000-4000-8000-0000000000ad', 1,
      'SOURCE_TO_CANONICAL', repeat('8', 64)
    );
    BEGIN
      UPDATE mmc.cam_v2_tasks
      SET object_version = object_version + 1
      WHERE id = '00000000-0000-4000-8000-0000000000ad';
      RAISE EXCEPTION 'active lineage endpoint version advanced without invalidation';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
      UPDATE mmc.cam_v2_lineage_edges
      SET relation_kind = 'CANONICAL_TO_PUBLICATION', object_version = object_version + 1
      WHERE id = '70000000-0000-4000-8000-000000000008';
      RAISE EXCEPTION 'lineage core was mutable';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    RAISE EXCEPTION 'IMMUTABLE_LINEAGE_FIXTURE_ROLLBACK';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_message = MESSAGE_TEXT;
    IF v_message <> 'IMMUTABLE_LINEAGE_FIXTURE_ROLLBACK' THEN RAISE; END IF;
  END;

  -- CONSUMER_DIRECT_INSERT_DENY. Only the exact leased inbox RPC may append
  -- an effect/receipt pair; an owner/bootstrap insert is not trusted runtime.
  BEGIN
    INSERT INTO mmc.cam_v2_consumer_effects (
      id, tenant_id, environment, outbox_event_id, source_job_id,
      dispatcher_principal_id, dispatcher_queue_name, dispatcher_lease_generation,
      effect_kind, target_kind, target_id, effect_digest, applied_at
    ) VALUES (
      '70000000-0000-4000-8000-000000000010',
      '00000000-0000-4000-8000-0000000000a1', 'LOCAL',
      '00000000-0000-4000-8000-0000000000d2', NULL,
      '00000000-0000-4000-8000-0000000000a7', 'outbox-control', 1,
      'CACHE_INVALIDATION', 'SUBJECT', '00000000-0000-4000-8000-0000000000a8',
      repeat('9', 64), now()
    );
    RAISE EXCEPTION 'consumer effect accepted direct owner insertion';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  BEGIN
    INSERT INTO mmc.cam_v2_audit_events (
      id, tenant_id, environment, principal_id, effective_principal_kind,
      action, purpose, object_kind, outcome, correlation_id, chain_key_version
    ) VALUES (
      '70000000-0000-4000-8000-000000000012',
      '00000000-0000-4000-8000-0000000000a1', 'LOCAL',
      '00000000-0000-4000-8000-0000000000a2', 'MENTOR',
      'FORGED_ROLE', 'Reject forged audit actor role', 'AUDIT', 'DENIED',
      'mmc006-forged-audit-role', 1
    );
    RAISE EXCEPTION 'audit event accepted a forged effective principal role';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;
END $$;

-- PUBLICATION_ACK_EXACT_STUDENT. Acknowledgement may outlive the mentor's
-- authoring grant, but only the currently verified exact student can perform it.
DO $$
DECLARE
  v_message text;
BEGIN
  BEGIN
    PERFORM set_config(
      'request.jwt.claims',
      jsonb_build_object('role', 'authenticated', 'app_metadata', jsonb_build_object(
        'mmc_tenant_id', '00000000-0000-4000-8000-0000000000a1',
        'mmc_environment', 'LOCAL',
        'mmc_principal_id', '00000000-0000-4000-8000-0000000000a2',
        'mmc_principal_kind', 'ADMIN',
        'mmc_capabilities', jsonb_build_array('mmc.admin.trust_manage')
      ))::text, true
    );
    BEGIN
      UPDATE mmc.cam_v2_publications
      SET publication_state = 'ACKNOWLEDGED', object_version = object_version + 1
      WHERE id = '00000000-0000-4000-8000-0000000000ae';
      RAISE EXCEPTION 'nonstudent acknowledged a publication';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
    PERFORM set_config(
      'request.jwt.claims',
      jsonb_build_object('role', 'authenticated', 'app_metadata', jsonb_build_object(
        'mmc_tenant_id', '00000000-0000-4000-8000-0000000000a1',
        'mmc_environment', 'LOCAL',
        'mmc_principal_id', '00000000-0000-4000-8000-0000000000a5',
        'mmc_principal_kind', 'STUDENT',
        'mmc_subject_link_id', '00000000-0000-4000-8000-0000000000a8',
        'mmc_capabilities', jsonb_build_array('mmc.student.respond')
      ))::text, true
    );
    UPDATE mmc.cam_v2_publications
    SET publication_state = 'ACKNOWLEDGED', object_version = object_version + 1
    WHERE id = '00000000-0000-4000-8000-0000000000ae';
    IF NOT EXISTS (
      SELECT 1 FROM mmc.cam_v2_publications
      WHERE id = '00000000-0000-4000-8000-0000000000ae'
        AND publication_state = 'ACKNOWLEDGED'
    ) THEN
      RAISE EXCEPTION 'exact student acknowledgement did not persist';
    END IF;
    RAISE EXCEPTION 'PUBLICATION_ACK_FIXTURE_ROLLBACK';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_message = MESSAGE_TEXT;
    IF v_message <> 'PUBLICATION_ACK_FIXTURE_ROLLBACK' THEN RAISE; END IF;
  END;
END $$;

-- SUBJECT_REVOCATION_FENCES_RUNTIME. Revocation retains historical identity
-- evidence while immediately denying mentor reads, job promotion, publication
-- mutation, and job-linked outbox delivery. The fixture subtransaction rolls
-- back the revocation after proving every downstream boundary.
DO $$
DECLARE
  v_message text;
  v_claims integer;
BEGIN
  BEGIN
    INSERT INTO mmc.cam_v2_outbox_events (
      id, tenant_id, environment, job_id, aggregate_kind, aggregate_id,
      aggregate_version, event_kind, payload_digest, delivery_queue_name
    ) VALUES (
      '70000000-0000-4000-8000-000000000013',
      '00000000-0000-4000-8000-0000000000a1', 'LOCAL',
      '00000000-0000-4000-8000-0000000000e4', 'JOB',
      '00000000-0000-4000-8000-0000000000e4', 1,
      'REVOCATION_FENCE_SENTINEL', repeat('b', 64), 'revocation-fence'
    );
    UPDATE mmc.cam_v2_subject_links
    SET identity_state = 'REVOKED', revoked_at = clock_timestamp(),
        object_version = object_version + 1
    WHERE id = '00000000-0000-4000-8000-0000000000a8';

    PERFORM set_config(
      'request.jwt.claims',
      jsonb_build_object('role', 'authenticated', 'app_metadata', jsonb_build_object(
        'mmc_tenant_id', '00000000-0000-4000-8000-0000000000a1',
        'mmc_environment', 'LOCAL',
        'mmc_principal_id', '00000000-0000-4000-8000-0000000000a3',
        'mmc_principal_kind', 'MENTOR',
        'mmc_capabilities', jsonb_build_array('mmc.mentor.read')
      ))::text, true
    );
    IF mmc.cam_v2_mentor_can_access(
      '00000000-0000-4000-8000-0000000000aa',
      '00000000-0000-4000-8000-0000000000a8', 'mmc.mentor.read'
    ) THEN
      RAISE EXCEPTION 'subject revocation retained mentor access';
    END IF;

    BEGIN
      UPDATE mmc.cam_v2_publications
      SET projection_digest = repeat('c', 64), object_version = object_version + 1
      WHERE id = '00000000-0000-4000-8000-0000000000ae';
      RAISE EXCEPTION 'subject revocation permitted publication mutation';
    EXCEPTION
      WHEN insufficient_privilege OR check_violation THEN NULL;
    END;

    PERFORM set_config(
      'request.jwt.claims',
      jsonb_build_object('role', 'authenticated', 'app_metadata', jsonb_build_object(
        'mmc_tenant_id', '00000000-0000-4000-8000-0000000000a1',
        'mmc_environment', 'LOCAL',
        'mmc_principal_id', '00000000-0000-4000-8000-0000000000a7',
        'mmc_principal_kind', 'WORKLOAD', 'mmc_queue_name', 'revocation-fence',
        'mmc_capabilities', jsonb_build_array('mmc.worker.outbox_dispatch')
      ))::text, true
    );
    IF mmc.cam_v2_job_durable_authority_is_active(
      '00000000-0000-4000-8000-0000000000e4'
    ) THEN
      RAISE EXCEPTION 'subject revocation retained durable job authority';
    END IF;
    SELECT count(*) INTO v_claims
    FROM mmc.cam_v2_claim_outbox('revocation-fence', 60);
    IF v_claims <> 0 THEN
      RAISE EXCEPTION 'subject revocation permitted job-linked outbox delivery';
    END IF;
    RAISE EXCEPTION 'SUBJECT_REVOCATION_FENCE_ROLLBACK';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_message = MESSAGE_TEXT;
    IF v_message <> 'SUBJECT_REVOCATION_FENCE_ROLLBACK' THEN RAISE; END IF;
  END;
END $$;

-- STUDENT_REVOCATION_FENCES_SCOPED_OUTBOX. Assignment and session effects
-- apply to the student's subject, so a suspended student must fence them just
-- as strictly as direct subject and publication effects.
DO $$
DECLARE
  v_message text;
  v_claims integer;
BEGIN
  BEGIN
    INSERT INTO mmc.cam_v2_sessions (
      id, tenant_id, environment, assignment_id, subject_link_id,
      mentor_principal_id, purpose
    ) VALUES (
      '70000000-0000-4000-8000-000000000017',
      '00000000-0000-4000-8000-0000000000a1', 'LOCAL',
      '00000000-0000-4000-8000-0000000000aa',
      '00000000-0000-4000-8000-0000000000a8',
      '00000000-0000-4000-8000-0000000000a3',
      'Student-origin outbox revocation sentinel'
    );
    INSERT INTO mmc.cam_v2_outbox_events (
      id, tenant_id, environment, aggregate_kind, aggregate_id,
      aggregate_version, event_kind, payload_digest, delivery_queue_name
    ) VALUES
      ('70000000-0000-4000-8000-000000000018',
       '00000000-0000-4000-8000-0000000000a1', 'LOCAL', 'ASSIGNMENT',
       '00000000-0000-4000-8000-0000000000aa', 1,
       'STUDENT_ASSIGNMENT_FENCE', repeat('2', 64), 'student-origin-fence'),
      ('70000000-0000-4000-8000-000000000019',
       '00000000-0000-4000-8000-0000000000a1', 'LOCAL', 'SESSION',
       '70000000-0000-4000-8000-000000000017', 1,
       'STUDENT_SESSION_FENCE', repeat('3', 64), 'student-origin-fence');
    UPDATE mmc.cam_v2_principals
    SET status = 'SUSPENDED', object_version = object_version + 1
    WHERE id = '00000000-0000-4000-8000-0000000000a5';
    PERFORM set_config(
      'request.jwt.claims',
      jsonb_build_object('role', 'authenticated', 'app_metadata', jsonb_build_object(
        'mmc_tenant_id', '00000000-0000-4000-8000-0000000000a1',
        'mmc_environment', 'LOCAL',
        'mmc_principal_id', '00000000-0000-4000-8000-0000000000a7',
        'mmc_principal_kind', 'WORKLOAD', 'mmc_queue_name', 'student-origin-fence',
        'mmc_capabilities', jsonb_build_array('mmc.worker.outbox_dispatch')
      ))::text, true
    );
    SELECT count(*) INTO v_claims
    FROM mmc.cam_v2_claim_outbox('student-origin-fence', 60);
    IF v_claims <> 0 THEN
      RAISE EXCEPTION 'suspended student retained assignment/session outbox delivery';
    END IF;
    RAISE EXCEPTION 'STUDENT_ORIGIN_FENCE_ROLLBACK';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_message = MESSAGE_TEXT;
    IF v_message <> 'STUDENT_ORIGIN_FENCE_ROLLBACK' THEN RAISE; END IF;
  END;
END $$;

-- AUDIT_CHAIN_SERIALIZED_APPEND_ONLY. The seal trigger, rather than the
-- caller, assigns sequence/predecessor/timestamp/event digest.
INSERT INTO mmc.cam_v2_audit_events (
  id, tenant_id, environment, principal_id, effective_principal_kind,
  subject_link_id, assignment_id, action, purpose, object_kind, object_id,
  after_digest, outcome, correlation_id, chain_key_version
) VALUES
  ('20000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000a1', 'LOCAL',
   '00000000-0000-4000-8000-0000000000a2', 'ADMIN',
   '00000000-0000-4000-8000-0000000000a8', '00000000-0000-4000-8000-0000000000aa',
   'TRUST_FIXTURE', 'Validate serialized audit append one', 'JOB',
   '00000000-0000-4000-8000-0000000000b0', repeat('a', 64), 'COMMITTED', 'mmc006-audit-001', 1),
  ('20000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-0000000000a1', 'LOCAL',
   '00000000-0000-4000-8000-0000000000a2', 'ADMIN',
   '00000000-0000-4000-8000-0000000000a8', '00000000-0000-4000-8000-0000000000aa',
   'TRUST_FIXTURE', 'Validate serialized audit append two', 'JOB',
   '00000000-0000-4000-8000-0000000000b1', repeat('b', 64), 'COMMITTED', 'mmc006-audit-002', 1);
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM mmc.cam_v2_audit_events AS first_event
    JOIN mmc.cam_v2_audit_events AS second_event
      ON second_event.tenant_id = first_event.tenant_id
     AND second_event.environment = first_event.environment
     AND second_event.chain_sequence = first_event.chain_sequence + 1
     AND second_event.previous_event_digest = first_event.event_digest
    WHERE first_event.id = '20000000-0000-4000-8000-000000000001'
      AND second_event.id = '20000000-0000-4000-8000-000000000002'
      AND first_event.chain_sequence = 1
      AND first_event.previous_event_digest IS NULL
      AND first_event.event_digest ~ '^[a-f0-9]{64}$'
  ) THEN
    RAISE EXCEPTION 'audit chain was not serialized and hash-linked';
  END IF;
  BEGIN
    UPDATE mmc.cam_v2_audit_events SET purpose = 'tampered'
    WHERE id = '20000000-0000-4000-8000-000000000001';
    RAISE EXCEPTION 'audit chain accepted post-append mutation';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
END $$;

-- Runtime assertions start only after all owner-controlled fixture writes.
SET LOCAL row_security = on;
SET LOCAL ROLE authenticated;

-- NO_DIRECT_DML_DENY and immutable canonical/publication truth.
SELECT set_config(
  'request.jwt.claims',
  jsonb_build_object('role', 'authenticated', 'app_metadata', jsonb_build_object(
    'mmc_tenant_id', '00000000-0000-4000-8000-0000000000a1', 'mmc_environment', 'LOCAL',
    'mmc_principal_id', '00000000-0000-4000-8000-0000000000a2', 'mmc_principal_kind', 'ADMIN',
    'mmc_capabilities', jsonb_build_array('mmc.admin.trust_manage')
  ))::text,
  true
);
DO $$
BEGIN
  IF has_table_privilege(current_user, 'mmc.cam_v2_tasks', 'INSERT')
     OR has_table_privilege(current_user, 'mmc.cam_v2_tasks', 'UPDATE')
     OR has_table_privilege(current_user, 'mmc.cam_v2_publications', 'UPDATE')
     OR has_table_privilege(current_user, 'mmc.cam_v2_ai_proposals', 'UPDATE')
     OR has_table_privilege(current_user, 'mmc.cam_v2_command_receipts', 'INSERT')
     OR has_table_privilege(current_user, 'mmc.cam_v2_jobs', 'UPDATE') THEN
    RAISE EXCEPTION 'authenticated unexpectedly has direct CAM v2 DML';
  END IF;
  BEGIN
    UPDATE mmc.cam_v2_publication_items
    SET safe_plain_text = 'mutated after publication'
    WHERE id = '00000000-0000-4000-8000-0000000000af';
    RAISE EXCEPTION 'published truth accepted a direct authenticated mutation';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END $$;

-- MENTOR_ALLOW plus CROSS_TENANT_DENY and CROSS_ENVIRONMENT_DENY. Runtime
-- colon capabilities are accepted through the explicit SQL alias mapping.
SELECT set_config(
  'request.jwt.claims',
  jsonb_build_object('role', 'authenticated', 'app_metadata', jsonb_build_object(
    'mmc_tenant_id', '00000000-0000-4000-8000-0000000000a1', 'mmc_environment', 'LOCAL',
    'mmc_principal_id', '00000000-0000-4000-8000-0000000000a3', 'mmc_principal_kind', 'MENTOR',
    'mmc_capabilities', jsonb_build_array('mmc:query', 'mmc:command', 'mmc:review')
  ))::text,
  true
);
DO $$
BEGIN
  IF (SELECT count(*) FROM mmc.cam_v2_tasks) <> 1
     OR NOT mmc.cam_v2_mentor_can_access(
       '00000000-0000-4000-8000-0000000000aa', '00000000-0000-4000-8000-0000000000a8', 'mmc.mentor.read'
     ) THEN
    RAISE EXCEPTION 'mentor tenant/environment/exact-assignment isolation failed';
  END IF;
END $$;

-- REVOKED_PRINCIPAL_DENY even when assignment remains active.
SELECT set_config(
  'request.jwt.claims',
  jsonb_build_object('role', 'authenticated', 'app_metadata', jsonb_build_object(
    'mmc_tenant_id', '00000000-0000-4000-8000-0000000000a1', 'mmc_environment', 'LOCAL',
    'mmc_principal_id', '00000000-0000-4000-8000-0000000000a4', 'mmc_principal_kind', 'MENTOR',
    'mmc_capabilities', jsonb_build_array('mmc.mentor.read')
  ))::text,
  true
);
DO $$
BEGIN
  IF mmc.cam_v2_actor_is_active('MENTOR') OR (SELECT count(*) FROM mmc.cam_v2_tasks) <> 0 THEN
    RAISE EXCEPTION 'revoked principal retained access';
  END IF;
END $$;

-- REVOKED_ASSIGNMENT_DENY for an otherwise active mentor.
SELECT set_config(
  'request.jwt.claims',
  jsonb_build_object('role', 'authenticated', 'app_metadata', jsonb_build_object(
    'mmc_tenant_id', '00000000-0000-4000-8000-0000000000a1', 'mmc_environment', 'LOCAL',
    'mmc_principal_id', '00000000-0000-4000-8000-0000000000bd', 'mmc_principal_kind', 'MENTOR',
    'mmc_capabilities', jsonb_build_array('mmc.mentor.read')
  ))::text,
  true
);
DO $$
BEGIN
  IF mmc.cam_v2_mentor_can_access(
    '00000000-0000-4000-8000-0000000000be', '00000000-0000-4000-8000-0000000000a8', 'mmc.mentor.read'
  ) OR (SELECT count(*) FROM mmc.cam_v2_tasks) <> 0 THEN
    RAISE EXCEPTION 'revoked assignment was not denied';
  END IF;
END $$;

-- REVOKED_TENANT_DENY (suspended is operationally inactive).
SELECT set_config(
  'request.jwt.claims',
  jsonb_build_object('role', 'authenticated', 'app_metadata', jsonb_build_object(
    'mmc_tenant_id', '00000000-0000-4000-8000-0000000000e1', 'mmc_environment', 'LOCAL',
    'mmc_principal_id', '00000000-0000-4000-8000-0000000000e2', 'mmc_principal_kind', 'ADMIN',
    'mmc_capabilities', jsonb_build_array('mmc.admin.trust_manage')
  ))::text,
  true
);
DO $$
BEGIN
  IF mmc.cam_v2_actor_is_active('ADMIN') OR (SELECT count(*) FROM mmc.cam_v2_tenants) <> 0 THEN
    RAISE EXCEPTION 'suspended tenant retained runtime access';
  END IF;
END $$;

-- EXACT_STUDENT_PUBLICATION_ALLOW plus WRONG_SUBJECT_DENY.
SELECT set_config(
  'request.jwt.claims',
  jsonb_build_object('role', 'authenticated', 'app_metadata', jsonb_build_object(
    'mmc_tenant_id', '00000000-0000-4000-8000-0000000000a1', 'mmc_environment', 'LOCAL',
    'mmc_principal_id', '00000000-0000-4000-8000-0000000000a5', 'mmc_principal_kind', 'STUDENT',
    'mmc_subject_link_id', '00000000-0000-4000-8000-0000000000a8',
    'mmc_capabilities', jsonb_build_array('mmc:publication:read')
  ))::text,
  true
);
DO $$
BEGIN
  IF (SELECT count(*) FROM mmc.cam_v2_publications) <> 1
     OR (SELECT count(*) FROM mmc.cam_v2_publication_items) <> 1 THEN
    RAISE EXCEPTION 'exact student publication allow failed';
  END IF;
END $$;

SELECT set_config(
  'request.jwt.claims',
  jsonb_build_object('role', 'authenticated', 'app_metadata', jsonb_build_object(
    'mmc_tenant_id', '00000000-0000-4000-8000-0000000000a1', 'mmc_environment', 'LOCAL',
    'mmc_principal_id', '00000000-0000-4000-8000-0000000000a6', 'mmc_principal_kind', 'STUDENT',
    'mmc_subject_link_id', '00000000-0000-4000-8000-0000000000a9',
    'mmc_capabilities', jsonb_build_array('mmc.student.publication_read')
  ))::text,
  true
);
DO $$
BEGIN
  IF (SELECT count(*) FROM mmc.cam_v2_publications) <> 0
     OR (SELECT count(*) FROM mmc.cam_v2_publication_items) <> 0 THEN
    RAISE EXCEPTION 'wrong-subject publication leaked';
  END IF;
END $$;

-- EXACT_WORKER_QUEUE_ALLOW, active authority, exact assignment/subject, and
-- current lease generation.
SELECT set_config(
  'request.jwt.claims',
  jsonb_build_object('role', 'authenticated', 'app_metadata', jsonb_build_object(
    'mmc_tenant_id', '00000000-0000-4000-8000-0000000000a1', 'mmc_environment', 'LOCAL',
    'mmc_principal_id', '00000000-0000-4000-8000-0000000000a7', 'mmc_principal_kind', 'WORKLOAD',
    'mmc_job_id', '00000000-0000-4000-8000-0000000000b0', 'mmc_lease_generation', 3,
    'mmc_queue_name', 'analysis',
    'mmc_capabilities', jsonb_build_array('mmc:worker:claim', 'mmc:worker:complete', 'mmc.worker.analysis')
  ))::text,
  true
);
DO $$
BEGIN
  IF NOT mmc.cam_v2_worker_lease_matches(
    '00000000-0000-4000-8000-0000000000b0', 'mmc.worker.analysis'
  ) OR NOT mmc.cam_v2_job_authority_is_active('00000000-0000-4000-8000-0000000000b0')
     OR mmc.cam_v2_worker_row_matches_job(
       '00000000-0000-4000-8000-0000000000b0',
       '00000000-0000-4000-8000-0000000000bc',
       '00000000-0000-4000-8000-0000000000a9'
     ) THEN
    RAISE EXCEPTION 'exact worker lease/authority/cross-subject binding failed';
  END IF;
END $$;

-- STALE_WORKER_GENERATION_DENY.
SELECT set_config(
  'request.jwt.claims',
  replace(current_setting('request.jwt.claims'), '"mmc_lease_generation": 3', '"mmc_lease_generation": 2'),
  true
);
DO $$
BEGIN
  IF mmc.cam_v2_worker_lease_matches(
    '00000000-0000-4000-8000-0000000000b0', 'mmc.worker.analysis'
  ) THEN
    RAISE EXCEPTION 'stale worker generation was accepted';
  END IF;
END $$;

-- EXACT_SIGNED_QUEUE_CLAIM_ALLOW and QUEUE_MISMATCH_DENY.
SELECT set_config(
  'request.jwt.claims',
  jsonb_build_object('role', 'authenticated', 'app_metadata', jsonb_build_object(
    'mmc_tenant_id', '00000000-0000-4000-8000-0000000000a1', 'mmc_environment', 'LOCAL',
    'mmc_principal_id', '00000000-0000-4000-8000-0000000000a7', 'mmc_principal_kind', 'WORKLOAD',
    'mmc_queue_name', 'analysis-claim',
    'mmc_capabilities', jsonb_build_array(
      'mmc:worker:claim', 'mmc.worker.complete', 'mmc.worker.asset_process'
    )
  ))::text,
  true
);
DO $$
DECLARE
  v_claim record;
  v_completed text;
BEGIN
  SELECT * INTO v_claim FROM mmc.cam_v2_claim_job('analysis-claim', 60);
  IF v_claim.job_id IS DISTINCT FROM '00000000-0000-4000-8000-0000000000b1'::uuid
     OR v_claim.lease_generation IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'exact signed queue did not claim one authorized job';
  END IF;
  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object('role', 'authenticated', 'app_metadata', jsonb_build_object(
      'mmc_tenant_id', '00000000-0000-4000-8000-0000000000a1', 'mmc_environment', 'LOCAL',
      'mmc_principal_id', '00000000-0000-4000-8000-0000000000a7', 'mmc_principal_kind', 'WORKLOAD',
      'mmc_queue_name', 'analysis-claim', 'mmc_job_id', v_claim.job_id,
      'mmc_lease_generation', v_claim.lease_generation,
      'mmc_capabilities', jsonb_build_array('mmc.worker.complete', 'mmc.worker.asset_process')
    ))::text,
    true
  );
  IF NOT mmc.cam_v2_record_external_dispatch_intent(v_claim.job_id, v_claim.lease_generation, repeat('1', 64))
     OR NOT mmc.cam_v2_record_external_result(v_claim.job_id, v_claim.lease_generation, 'SUCCEEDED', repeat('2', 64), NULL) THEN
    RAISE EXCEPTION 'generation-bound dispatch/result proof did not persist';
  END IF;
  v_completed := mmc.cam_v2_complete_job(
    v_claim.job_id, v_claim.lease_generation, repeat('2', 64), 'SUCCEEDED', NULL, 0
  );
  IF v_completed <> 'SUCCEEDED'
     OR mmc.cam_v2_complete_job(
       v_claim.job_id, v_claim.lease_generation, repeat('2', 64), 'SUCCEEDED', NULL, 0
     ) <> 'SUCCEEDED' THEN
    RAISE EXCEPTION 'terminal completion or exact replay proof failed';
  END IF;
  BEGIN
    PERFORM * FROM mmc.cam_v2_claim_job('other-queue', 60);
    RAISE EXCEPTION 'worker claimed outside its signed queue';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END $$;

-- EXPIRED_RUNNING_RECLAIM. A RUNNING lease with no dispatch or provider
-- evidence may be reclaimed after expiry and advances to a fresh LEASED
-- generation rather than becoming permanently stranded.
SELECT set_config(
  'request.jwt.claims',
  jsonb_build_object('role', 'authenticated', 'app_metadata', jsonb_build_object(
    'mmc_tenant_id', '00000000-0000-4000-8000-0000000000a1', 'mmc_environment', 'LOCAL',
    'mmc_principal_id', '00000000-0000-4000-8000-0000000000a7', 'mmc_principal_kind', 'WORKLOAD',
    'mmc_queue_name', 'expired-running-reclaim',
    'mmc_capabilities', jsonb_build_array('mmc.worker.claim', 'mmc.worker.asset_process')
  ))::text,
  true
);
DO $$
DECLARE
  v_claim record;
BEGIN
  SELECT * INTO v_claim
  FROM mmc.cam_v2_claim_job('expired-running-reclaim', 60);
  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object('role', 'authenticated', 'app_metadata', jsonb_build_object(
      'mmc_tenant_id', '00000000-0000-4000-8000-0000000000a1',
      'mmc_environment', 'LOCAL',
      'mmc_principal_id', '00000000-0000-4000-8000-0000000000a7',
      'mmc_principal_kind', 'WORKLOAD',
      'mmc_queue_name', 'expired-running-reclaim',
      'mmc_job_id', v_claim.job_id,
      'mmc_lease_generation', v_claim.lease_generation,
      'mmc_capabilities', jsonb_build_array('mmc.worker.claim', 'mmc.worker.asset_process')
    ))::text, true
  );
  IF v_claim.job_id IS DISTINCT FROM '00000000-0000-4000-8000-0000000000cc'::uuid
     OR v_claim.lease_generation IS DISTINCT FROM 2
     OR NOT EXISTS (
       SELECT 1 FROM mmc.cam_v2_jobs
       WHERE id = '00000000-0000-4000-8000-0000000000cc'
         AND status = 'LEASED' AND attempt_count = 2
         AND lease_generation = 2
         AND lease_owner_principal_id = '00000000-0000-4000-8000-0000000000a7'
     ) THEN
    RAISE EXCEPTION 'expired RUNNING job was not reclaimed into one fresh lease';
  END IF;
END $$;

-- OUTBOX_BOUND_EFFECT_ALLOW, ATOMIC_INBOX_EFFECT, EXACT_RECEIPT_REPLAY, and
-- QUARANTINED_RESULT_NOT_CLAIMABLE. The claim itself returns every canonical
-- effect field the dispatcher needs; no side-channel table read is required.
DO $$
DECLARE
  v_claim record;
  v_iteration integer;
  v_applied boolean;
  v_remaining integer;
BEGIN
  FOR v_iteration IN 1..2 LOOP
    PERFORM set_config(
      'request.jwt.claims',
      jsonb_build_object('role', 'authenticated', 'app_metadata', jsonb_build_object(
        'mmc_tenant_id', '00000000-0000-4000-8000-0000000000a1', 'mmc_environment', 'LOCAL',
        'mmc_principal_id', '00000000-0000-4000-8000-0000000000a7', 'mmc_principal_kind', 'WORKLOAD',
        'mmc_queue_name', 'mmc.outbox',
        'mmc_capabilities', jsonb_build_array('mmc.worker.outbox_dispatch', 'mmc.worker.inbox')
      ))::text,
      true
    );
    SELECT * INTO v_claim FROM mmc.cam_v2_claim_outbox('mmc.outbox', 60);
    IF v_claim.outbox_event_id IS NULL
       OR v_claim.effect_kind <> 'PROJECTION_REFRESH'
       OR v_claim.target_kind <> 'JOB'
       OR v_claim.target_id IS DISTINCT FROM '00000000-0000-4000-8000-0000000000b1'::uuid THEN
      RAISE EXCEPTION 'outbox claim omitted or changed its canonical effect binding';
    END IF;
    PERFORM set_config(
      'request.jwt.claims',
      jsonb_build_object('role', 'authenticated', 'app_metadata', jsonb_build_object(
        'mmc_tenant_id', '00000000-0000-4000-8000-0000000000a1', 'mmc_environment', 'LOCAL',
        'mmc_principal_id', '00000000-0000-4000-8000-0000000000a7', 'mmc_principal_kind', 'WORKLOAD',
        'mmc_queue_name', 'mmc.outbox', 'mmc_outbox_event_id', v_claim.outbox_event_id,
        'mmc_outbox_lease_generation', v_claim.delivery_lease_generation,
        'mmc_capabilities', jsonb_build_array('mmc.worker.outbox_dispatch', 'mmc.worker.inbox')
      ))::text,
      true
    );
    v_applied := mmc.cam_v2_record_inbox_effect(
      v_claim.outbox_event_id, v_claim.effect_kind, v_claim.target_kind,
      v_claim.target_id, repeat(v_iteration::text, 64)
    );
    IF v_applied IS NOT TRUE OR mmc.cam_v2_record_inbox_effect(
      v_claim.outbox_event_id, v_claim.effect_kind, v_claim.target_kind,
      v_claim.target_id, repeat(v_iteration::text, 64)
    ) IS NOT FALSE THEN
      RAISE EXCEPTION 'atomic consumer effect or exact lost-response replay failed';
    END IF;
  END LOOP;
  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object('role', 'authenticated', 'app_metadata', jsonb_build_object(
      'mmc_tenant_id', '00000000-0000-4000-8000-0000000000a1', 'mmc_environment', 'LOCAL',
      'mmc_principal_id', '00000000-0000-4000-8000-0000000000a7', 'mmc_principal_kind', 'WORKLOAD',
      'mmc_queue_name', 'mmc.outbox',
      'mmc_capabilities', jsonb_build_array('mmc.worker.outbox_dispatch', 'mmc.worker.inbox')
    ))::text,
    true
  );
  SELECT count(*) INTO v_remaining FROM mmc.cam_v2_claim_outbox('mmc.outbox', 60);
  IF v_remaining <> 0 THEN
    RAISE EXCEPTION 'quarantined provider-result evidence entered the delivery queue';
  END IF;
END $$;

-- TYPED_AI_SUCCESS_ATTESTATION. A claimed analysis may become SUCCEEDED only
-- after its exact provider result is already materialized as a PROPOSED,
-- completed analysis row bound to the frozen transcript edge. The terminal
-- receipt is exactly replayable and changed-result replay is rejected.
SELECT set_config(
  'request.jwt.claims',
  jsonb_build_object('role', 'authenticated', 'app_metadata', jsonb_build_object(
    'mmc_tenant_id', '00000000-0000-4000-8000-0000000000a1', 'mmc_environment', 'LOCAL',
    'mmc_principal_id', '00000000-0000-4000-8000-0000000000a7', 'mmc_principal_kind', 'WORKLOAD',
    'mmc_queue_name', 'typed-ai-analysis',
    'mmc_capabilities', jsonb_build_array('mmc.worker.claim', 'mmc.worker.complete', 'mmc.worker.analysis')
  ))::text, true
);
DO $$
DECLARE
  v_claim record;
BEGIN
  SELECT * INTO v_claim FROM mmc.cam_v2_claim_job('typed-ai-analysis', 60);
  IF v_claim.job_id IS DISTINCT FROM '00000000-0000-4000-8000-0000000000e4'::uuid
     OR v_claim.lease_generation IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'typed AI analysis job was not claimed with its exact frozen input';
  END IF;
  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object('role', 'authenticated', 'app_metadata', jsonb_build_object(
      'mmc_tenant_id', '00000000-0000-4000-8000-0000000000a1', 'mmc_environment', 'LOCAL',
      'mmc_principal_id', '00000000-0000-4000-8000-0000000000a7', 'mmc_principal_kind', 'WORKLOAD',
      'mmc_queue_name', 'typed-ai-analysis', 'mmc_job_id', v_claim.job_id,
      'mmc_lease_generation', v_claim.lease_generation,
      'mmc_capabilities', jsonb_build_array('mmc.worker.complete', 'mmc.worker.analysis')
    ))::text, true
  );
  IF NOT mmc.cam_v2_record_external_dispatch_intent(
       v_claim.job_id, v_claim.lease_generation, repeat('3', 64)
     )
     OR NOT mmc.cam_v2_record_external_result(
       v_claim.job_id, v_claim.lease_generation, 'SUCCEEDED', repeat('c', 64), NULL
     ) THEN
    RAISE EXCEPTION 'typed AI provider dispatch/result attestation did not persist';
  END IF;
  IF mmc.cam_v2_complete_job(
       v_claim.job_id, v_claim.lease_generation, repeat('c', 64), 'SUCCEEDED', NULL, 0
     ) <> 'SUCCEEDED'
     OR mmc.cam_v2_complete_job(
       v_claim.job_id, v_claim.lease_generation, repeat('c', 64), 'SUCCEEDED', NULL, 0
     ) <> 'SUCCEEDED' THEN
    RAISE EXCEPTION 'typed AI success completion or exact replay failed';
  END IF;
  BEGIN
    PERFORM mmc.cam_v2_complete_job(
      v_claim.job_id, v_claim.lease_generation, repeat('d', 64), 'SUCCEEDED', NULL, 0
    );
    RAISE EXCEPTION 'typed AI terminal replay accepted a changed result digest';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
END $$;

-- OUTBOX_CONTROL_COMPLETION_REPLAY. RETRY and DEAD_LETTER controls persist an
-- exact dispatcher/generation/semantic receipt, tolerate a lost response, and
-- a retry receipt is cleared atomically when the next generation is claimed.
DO $$
DECLARE
  v_claim record;
BEGIN
  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object('role', 'authenticated', 'app_metadata', jsonb_build_object(
      'mmc_tenant_id', '00000000-0000-4000-8000-0000000000a1', 'mmc_environment', 'LOCAL',
      'mmc_principal_id', '00000000-0000-4000-8000-0000000000a7', 'mmc_principal_kind', 'WORKLOAD',
      'mmc_queue_name', 'outbox-control',
      'mmc_capabilities', jsonb_build_array('mmc.worker.outbox_dispatch')
    ))::text, true
  );
  SELECT * INTO v_claim FROM mmc.cam_v2_claim_outbox('outbox-control', 60);
  IF v_claim.outbox_event_id IS DISTINCT FROM '00000000-0000-4000-8000-0000000000d2'::uuid
     OR v_claim.delivery_lease_generation <> 1 THEN
    RAISE EXCEPTION 'control outbox generation one was not claimed';
  END IF;
  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object('role', 'authenticated', 'app_metadata', jsonb_build_object(
      'mmc_tenant_id', '00000000-0000-4000-8000-0000000000a1', 'mmc_environment', 'LOCAL',
      'mmc_principal_id', '00000000-0000-4000-8000-0000000000a7', 'mmc_principal_kind', 'WORKLOAD',
      'mmc_queue_name', 'outbox-control', 'mmc_outbox_event_id', v_claim.outbox_event_id,
      'mmc_outbox_lease_generation', v_claim.delivery_lease_generation,
      'mmc_capabilities', jsonb_build_array('mmc.worker.outbox_dispatch')
    ))::text, true
  );
  IF mmc.cam_v2_complete_outbox(v_claim.outbox_event_id, 1, 'RETRY', 'TRANSIENT_TEST', 0) <> 'RETRY'
     OR mmc.cam_v2_complete_outbox(v_claim.outbox_event_id, 1, 'RETRY', 'TRANSIENT_TEST', 0) <> 'RETRY' THEN
    RAISE EXCEPTION 'outbox retry completion or exact replay failed';
  END IF;

  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object('role', 'authenticated', 'app_metadata', jsonb_build_object(
      'mmc_tenant_id', '00000000-0000-4000-8000-0000000000a1', 'mmc_environment', 'LOCAL',
      'mmc_principal_id', '00000000-0000-4000-8000-0000000000a7', 'mmc_principal_kind', 'WORKLOAD',
      'mmc_queue_name', 'outbox-control',
      'mmc_capabilities', jsonb_build_array('mmc.worker.outbox_dispatch')
    ))::text, true
  );
  SELECT * INTO v_claim FROM mmc.cam_v2_claim_outbox('outbox-control', 60);
  IF v_claim.outbox_event_id IS DISTINCT FROM '00000000-0000-4000-8000-0000000000d2'::uuid
     OR v_claim.delivery_lease_generation <> 2 THEN
    RAISE EXCEPTION 'retry receipt blocked the next outbox generation';
  END IF;
  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object('role', 'authenticated', 'app_metadata', jsonb_build_object(
      'mmc_tenant_id', '00000000-0000-4000-8000-0000000000a1', 'mmc_environment', 'LOCAL',
      'mmc_principal_id', '00000000-0000-4000-8000-0000000000a7', 'mmc_principal_kind', 'WORKLOAD',
      'mmc_queue_name', 'outbox-control', 'mmc_outbox_event_id', v_claim.outbox_event_id,
      'mmc_outbox_lease_generation', v_claim.delivery_lease_generation,
      'mmc_capabilities', jsonb_build_array('mmc.worker.outbox_dispatch')
    ))::text, true
  );
  IF mmc.cam_v2_complete_outbox(v_claim.outbox_event_id, 2, 'DEAD_LETTER', 'PERMANENT_TEST', 0) <> 'DEAD_LETTER'
     OR mmc.cam_v2_complete_outbox(v_claim.outbox_event_id, 2, 'DEAD_LETTER', 'PERMANENT_TEST', 0) <> 'DEAD_LETTER' THEN
    RAISE EXCEPTION 'outbox dead-letter completion or exact replay failed';
  END IF;
END $$;

-- WORKER_RETRY_COMPLETION_REPLAY. A failed, safely retryable provider attempt
-- persists the exact worker/generation/result/error/delay receipt even though
-- provider lease evidence is cleared for the next attempt.
SELECT set_config(
  'request.jwt.claims',
  jsonb_build_object('role', 'authenticated', 'app_metadata', jsonb_build_object(
    'mmc_tenant_id', '00000000-0000-4000-8000-0000000000a1', 'mmc_environment', 'LOCAL',
    'mmc_principal_id', '00000000-0000-4000-8000-0000000000a7', 'mmc_principal_kind', 'WORKLOAD',
    'mmc_job_id', '00000000-0000-4000-8000-0000000000d3', 'mmc_lease_generation', 1,
    'mmc_queue_name', 'worker-retry',
    'mmc_capabilities', jsonb_build_array('mmc.worker.complete', 'mmc.worker.analysis')
  ))::text, true
);
DO $$
BEGIN
  IF NOT mmc.cam_v2_record_external_result(
    '00000000-0000-4000-8000-0000000000d3', 1, 'FAILED', repeat('e', 64), NULL
  ) THEN
    RAISE EXCEPTION 'worker retry fixture did not preserve provider failure';
  END IF;
  IF mmc.cam_v2_complete_job(
       '00000000-0000-4000-8000-0000000000d3', 1, repeat('e', 64),
       'RETRY', 'TRANSIENT_PROVIDER', 17
     ) <> 'RETRY_SCHEDULED'
     OR mmc.cam_v2_complete_job(
       '00000000-0000-4000-8000-0000000000d3', 1, repeat('e', 64),
       'RETRY', 'TRANSIENT_PROVIDER', 17
     ) <> 'RETRY_SCHEDULED' THEN
    RAISE EXCEPTION 'worker retry completion or exact lost-response replay failed';
  END IF;
  BEGIN
    PERFORM mmc.cam_v2_complete_job(
      '00000000-0000-4000-8000-0000000000d3', 1, repeat('e', 64),
      'RETRY', 'TRANSIENT_PROVIDER', 18
    );
    RAISE EXCEPTION 'worker retry replay accepted changed scheduling semantics';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
END $$;

-- REVOKED_AUTHORITY_DENY. A provider callback may arrive after the durable
-- grant or lease expires. Preserve that immutable evidence in quarantine, but
-- never let the stale worker promote it into canonical completion.
SELECT set_config(
  'request.jwt.claims',
  jsonb_build_object('role', 'authenticated', 'app_metadata', jsonb_build_object(
    'mmc_tenant_id', '00000000-0000-4000-8000-0000000000a1', 'mmc_environment', 'LOCAL',
    'mmc_principal_id', '00000000-0000-4000-8000-0000000000a7', 'mmc_principal_kind', 'WORKLOAD',
    'mmc_queue_name', 'revoked-analysis', 'mmc_capabilities', jsonb_build_array('mmc.worker.claim')
  ))::text,
  true
);
DO $$
DECLARE
  v_claims integer;
BEGIN
  SELECT count(*) INTO v_claims FROM mmc.cam_v2_claim_job('revoked-analysis', 60);
  IF v_claims <> 0 THEN
    RAISE EXCEPTION 'revoked authority grant admitted a job claim';
  END IF;
END $$;

SELECT set_config(
  'request.jwt.claims',
  jsonb_build_object('role', 'authenticated', 'app_metadata', jsonb_build_object(
    'mmc_tenant_id', '00000000-0000-4000-8000-0000000000a1', 'mmc_environment', 'LOCAL',
    'mmc_principal_id', '00000000-0000-4000-8000-0000000000a7', 'mmc_principal_kind', 'WORKLOAD',
    'mmc_job_id', '00000000-0000-4000-8000-0000000000b8', 'mmc_lease_generation', 1,
    'mmc_queue_name', 'revoked-leased',
    'mmc_capabilities', jsonb_build_array(
      'mmc:worker:claim', 'mmc:worker:complete', 'mmc.worker.analysis'
    )
  ))::text,
  true
);
DO $$
BEGIN
  IF NOT mmc.cam_v2_record_external_result(
    '00000000-0000-4000-8000-0000000000b8', 1, 'SUCCEEDED', repeat('9', 64), NULL
  ) OR mmc.cam_v2_record_external_result(
    '00000000-0000-4000-8000-0000000000b8', 1, 'SUCCEEDED', repeat('9', 64), NULL
  ) THEN
    RAISE EXCEPTION 'late revoked-authority result was not preserved exactly once';
  END IF;
  IF mmc.cam_v2_worker_lease_matches(
    '00000000-0000-4000-8000-0000000000b8', 'mmc.worker.complete'
  ) THEN
    RAISE EXCEPTION 'revoked authority retained a current worker lease';
  END IF;
  BEGIN
    PERFORM mmc.cam_v2_heartbeat_job('00000000-0000-4000-8000-0000000000b8', 1, 60);
    RAISE EXCEPTION 'revoked authority admitted heartbeat';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM mmc.cam_v2_complete_job('00000000-0000-4000-8000-0000000000b8', 1, repeat('9', 64));
    RAISE EXCEPTION 'revoked authority admitted completion';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM mmc.cam_v2_record_inbox_effect(
      '00000000-0000-4000-8000-0000000000c8',
      'PROJECTION_REFRESH', 'JOB', '00000000-0000-4000-8000-0000000000b8', repeat('8', 64)
    );
    RAISE EXCEPTION 'revoked authority admitted inbox mutation';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;

-- EVIDENCE_BACKED_OPERATOR_RECOVERY. A current trust operator may retry only
-- a confirmed-not-sent dispatch, dead-letter an unprovable unknown outcome,
-- and may not promote quarantined success whose durable authority was revoked.
-- First preserve an expired but actively-authorized acquisition result so the
-- operator path must prove the same typed handoff invariant as worker success.
SELECT set_config(
  'request.jwt.claims',
  jsonb_build_object('role', 'authenticated', 'app_metadata', jsonb_build_object(
    'mmc_tenant_id', '00000000-0000-4000-8000-0000000000a1', 'mmc_environment', 'LOCAL',
    'mmc_principal_id', '00000000-0000-4000-8000-0000000000a7', 'mmc_principal_kind', 'WORKLOAD',
    'mmc_job_id', '00000000-0000-4000-8000-0000000000f4', 'mmc_lease_generation', 1,
    'mmc_queue_name', 'acquisition-handoff',
    'mmc_capabilities', jsonb_build_array('mmc.worker.complete', 'mmc.worker.asset_process')
  ))::text,
  true
);
DO $$
BEGIN
  IF NOT mmc.cam_v2_record_external_result(
    '00000000-0000-4000-8000-0000000000f4', 1, 'SUCCEEDED', repeat('2', 64), NULL
  ) THEN
    RAISE EXCEPTION 'operator handoff fixture did not preserve provider result evidence';
  END IF;
END $$;

SELECT set_config(
  'request.jwt.claims',
  jsonb_build_object('role', 'authenticated', 'app_metadata', jsonb_build_object(
    'mmc_tenant_id', '00000000-0000-4000-8000-0000000000a1', 'mmc_environment', 'LOCAL',
    'mmc_principal_id', '00000000-0000-4000-8000-0000000000a7', 'mmc_principal_kind', 'WORKLOAD',
    'mmc_job_id', '00000000-0000-4000-8000-0000000000ca', 'mmc_lease_generation', 1,
    'mmc_queue_name', 'recovery-unknown',
    'mmc_capabilities', jsonb_build_array('mmc.worker.complete', 'mmc.worker.analysis')
  ))::text,
  true
);
DO $$
BEGIN
  IF NOT mmc.cam_v2_record_external_result(
    '00000000-0000-4000-8000-0000000000ca', 1,
    'OUTCOME_UNKNOWN', repeat('c', 64), NULL
  ) THEN
    RAISE EXCEPTION 'persisted unknown-result recovery fixture was not recorded';
  END IF;
END $$;

SELECT set_config(
  'request.jwt.claims',
  jsonb_build_object('role', 'authenticated', 'app_metadata', jsonb_build_object(
    'mmc_tenant_id', '00000000-0000-4000-8000-0000000000a1', 'mmc_environment', 'LOCAL',
    'mmc_principal_id', '00000000-0000-4000-8000-0000000000a2', 'mmc_principal_kind', 'ADMIN',
    'mmc_capabilities', jsonb_build_array('mmc.admin.trust_manage')
  ))::text,
  true
);
DO $$
BEGIN
  IF mmc.cam_v2_reconcile_expired_external_result(
    '00000000-0000-4000-8000-0000000000f4', 1,
    'CONFIRMED_SENT_SUCCEEDED', 'SUCCEEDED', 0, repeat('d', 64)
  ) <> 'SUCCEEDED'
     OR mmc.cam_v2_reconcile_expired_external_result(
       '00000000-0000-4000-8000-0000000000f4', 1,
       'CONFIRMED_SENT_SUCCEEDED', 'SUCCEEDED', 0, repeat('d', 64)
     ) <> 'SUCCEEDED' THEN
    RAISE EXCEPTION 'operator exact handoff completion or lost-response replay failed';
  END IF;
  BEGIN
    PERFORM mmc.cam_v2_reconcile_expired_external_result(
      '00000000-0000-4000-8000-0000000000b8', 1,
      'CONFIRMED_SENT_SUCCEEDED', 'SUCCEEDED', 0, repeat('a', 64)
    );
    RAISE EXCEPTION 'revoked provider success entered canonical state';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
  IF mmc.cam_v2_reconcile_expired_external_result(
    '00000000-0000-4000-8000-0000000000c9', 1,
    'CONFIRMED_NOT_SENT', 'RETRY', 0, repeat('b', 64)
  ) <> 'RETRY_SCHEDULED'
     OR mmc.cam_v2_reconcile_expired_external_result(
       '00000000-0000-4000-8000-0000000000c9', 1,
       'CONFIRMED_NOT_SENT', 'RETRY', 0, repeat('b', 64)
     ) <> 'RETRY_SCHEDULED' THEN
    RAISE EXCEPTION 'confirmed-not-sent recovery or exact replay failed';
  END IF;
  BEGIN
    PERFORM mmc.cam_v2_reconcile_expired_external_result(
      '00000000-0000-4000-8000-0000000000c9', 1,
      'CONFIRMED_NOT_SENT', 'RETRY', 1, repeat('b', 64)
    );
    RAISE EXCEPTION 'operator retry replay accepted changed delay semantics';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
  IF mmc.cam_v2_reconcile_expired_external_result(
    '00000000-0000-4000-8000-0000000000ca', 1,
    'OUTCOME_UNKNOWN', 'DEAD_LETTER', 0, repeat('c', 64)
  ) <> 'DEAD_LETTER' THEN
    RAISE EXCEPTION 'unproven unknown outcome was not dead-lettered';
  END IF;
END $$;

RESET ROLE;
SET LOCAL row_security = off;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM mmc.cam_v2_jobs AS producer
    JOIN mmc.cam_v2_jobs AS consumer
      ON consumer.id = '00000000-0000-4000-8000-0000000000f5'
     AND consumer.tenant_id = producer.tenant_id
     AND consumer.environment = producer.environment
    JOIN mmc.cam_v2_outbox_events AS evidence
      ON evidence.tenant_id = producer.tenant_id
     AND evidence.environment = producer.environment
     AND evidence.job_id = producer.id
     AND evidence.delivery_state = 'QUARANTINED'
     AND evidence.external_result_digest = producer.external_result_digest
     AND evidence.external_result_recorded_at = producer.external_result_recorded_at
     AND evidence.external_resolution = 'CONFIRMED_SENT_SUCCEEDED:SUCCEEDED'
     AND evidence.external_resolved_at IS NOT NULL
    WHERE producer.id = '00000000-0000-4000-8000-0000000000f4'
      AND producer.status = 'SUCCEEDED'
      AND producer.result_digest = repeat('2', 64)
      AND producer.completed_by_principal_id = '00000000-0000-4000-8000-0000000000a2'
      AND producer.completed_lease_generation = 1
      AND consumer.status = 'QUEUED'
      AND consumer.attempt_count = 0
      AND consumer.input_set_digest IS NULL
  ) THEN
    RAISE EXCEPTION 'operator success lost its exact handoff, evidence timestamp, or quarantine resolution';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM mmc.cam_v2_outbox_events
    WHERE job_id = '00000000-0000-4000-8000-0000000000b8'
      AND external_lease_generation = 1
      AND external_outcome = 'SUCCEEDED'
      AND external_result_digest = repeat('9', 64)
      AND delivery_state = 'QUARANTINED'
  ) OR EXISTS (
    SELECT 1 FROM mmc.cam_v2_outbox_events
    WHERE job_id = '00000000-0000-4000-8000-0000000000b8'
      AND external_result_digest = repeat('9', 64)
      AND delivery_state <> 'QUARANTINED'
  ) THEN
    RAISE EXCEPTION 'late revoked result escaped or lost quarantine';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM mmc.cam_v2_jobs
    WHERE id = '00000000-0000-4000-8000-0000000000c9'
      AND status = 'RETRY_SCHEDULED'
      AND lease_owner_principal_id IS NULL
      AND external_dispatch_generation IS NULL
      AND external_result_generation IS NULL
      AND completed_at IS NOT NULL
      AND completed_by_principal_id = '00000000-0000-4000-8000-0000000000a2'
      AND completed_lease_generation = 1
      AND completion_disposition = 'RETRY'
      AND completion_result_digest = repeat('b', 64)
      AND completion_retry_delay_seconds = 0
  ) THEN
    RAISE EXCEPTION 'confirmed-not-sent retry did not clear the old dispatch generation';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM mmc.cam_v2_jobs
    WHERE id = '00000000-0000-4000-8000-0000000000ca'
      AND status = 'DEAD_LETTER'
      AND external_outcome = 'OUTCOME_UNKNOWN'
      AND completion_disposition = 'DEAD_LETTER'
      AND completed_by_principal_id = '00000000-0000-4000-8000-0000000000a2'
      AND completed_lease_generation = 1
      AND EXISTS (
        SELECT 1 FROM mmc.cam_v2_outbox_events AS evidence
        WHERE evidence.job_id = cam_v2_jobs.id
          AND evidence.external_lease_generation = cam_v2_jobs.external_result_generation
          AND evidence.external_outcome = 'OUTCOME_UNKNOWN'
          AND evidence.external_result_digest = cam_v2_jobs.external_result_digest
          AND evidence.external_result_recorded_at = cam_v2_jobs.external_result_recorded_at
          AND evidence.delivery_state = 'QUARANTINED'
          AND evidence.external_resolution = 'OUTCOME_UNKNOWN:DEAD_LETTER'
          AND evidence.external_resolved_at IS NOT NULL
      )
  ) THEN
    RAISE EXCEPTION 'unknown-outcome terminal recovery lost its operator receipt';
  END IF;
END $$;
SET LOCAL row_security = on;
SET LOCAL ROLE authenticated;

-- INACTIVE_WORK_TERMINAL_CLEANUP. Revoked queued work and its unclaimed
-- outbox event remain immutable evidence but no longer strand a live queue.
SELECT set_config(
  'request.jwt.claims',
  jsonb_build_object('role', 'authenticated', 'app_metadata', jsonb_build_object(
    'mmc_tenant_id', '00000000-0000-4000-8000-0000000000a1', 'mmc_environment', 'LOCAL',
    'mmc_principal_id', '00000000-0000-4000-8000-0000000000a2', 'mmc_principal_kind', 'ADMIN',
    'mmc_capabilities', jsonb_build_array('mmc.admin.trust_manage')
  ))::text,
  true
);
DO $$
BEGIN
  IF NOT mmc.cam_v2_cancel_inactive_job(
    '00000000-0000-4000-8000-0000000000b2', 1
  ) OR NOT mmc.cam_v2_dead_letter_inactive_outbox(
    '00000000-0000-4000-8000-0000000000c8', 1, 'AUTHORITY_WITHDRAWN'
  ) THEN
    RAISE EXCEPTION 'inactive work cleanup did not complete';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM mmc.cam_v2_jobs
    WHERE id = '00000000-0000-4000-8000-0000000000b2'
      AND status = 'CANCELLED' AND lease_owner_principal_id IS NULL
  ) OR NOT EXISTS (
    SELECT 1 FROM mmc.cam_v2_outbox_events
    WHERE id = '00000000-0000-4000-8000-0000000000c8'
      AND delivery_state = 'DEAD_LETTER'
      AND delivery_completed_by_principal_id = '00000000-0000-4000-8000-0000000000a2'
      AND delivery_completion_error_class = 'AUTHORITY_WITHDRAWN'
  ) THEN
    RAISE EXCEPTION 'inactive work cleanup lost its terminal evidence';
  END IF;
END $$;

-- CUTOVER_PLANE_DENY: a governed incident shutdown moves the writer to
-- FORWARD_REPAIR and disables every mutation plane. Active-plane toggling is
-- deliberately forbidden because it could bypass new reconciliation evidence.
RESET ROLE;
SET LOCAL row_security = off;
INSERT INTO mmc.cam_v2_jobs (
  id, tenant_id, environment, authority_grant_id, assignment_id, subject_link_id,
  queue_name, job_kind, operation_ref, payload_digest, status
) VALUES (
  '70000000-0000-4000-8000-000000000020',
  '00000000-0000-4000-8000-0000000000a1', 'LOCAL',
  '00000000-0000-4000-8000-0000000000b6',
  '00000000-0000-4000-8000-0000000000aa',
  '00000000-0000-4000-8000-0000000000a8',
  'incident-cleanup', 'AI_ANALYSIS', 'incident-cleanup-job', repeat('a', 64), 'QUEUED'
);
INSERT INTO mmc.cam_v2_outbox_events (
  id, tenant_id, environment, job_id, aggregate_kind, aggregate_id,
  aggregate_version, event_kind, payload_digest, delivery_queue_name
) VALUES (
  '70000000-0000-4000-8000-000000000021',
  '00000000-0000-4000-8000-0000000000a1', 'LOCAL',
  '70000000-0000-4000-8000-000000000020', 'JOB',
  '70000000-0000-4000-8000-000000000020', 1,
  'SYNTHETIC_INCIDENT_CLEANUP', repeat('b', 64), 'incident-cleanup'
);
UPDATE mmc.cam_v2_cutover_states
SET writer_state = 'FORWARD_REPAIR', commands_enabled = false,
    ingest_enabled = false, ai_proposal_enabled = false,
    operational_promotion_enabled = false, student_publication_enabled = false,
    object_version = object_version + 1,
    updated_at = clock_timestamp()
WHERE id = '00000000-0000-4000-8000-0000000000b9';
SET LOCAL row_security = on;
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  jsonb_build_object('role', 'authenticated', 'app_metadata', jsonb_build_object(
    'mmc_tenant_id', '00000000-0000-4000-8000-0000000000a1', 'mmc_environment', 'LOCAL',
    'mmc_principal_id', '00000000-0000-4000-8000-0000000000a2', 'mmc_principal_kind', 'ADMIN',
    'mmc_capabilities', jsonb_build_array('mmc.admin.trust_manage')
  ))::text,
  true
);
DO $$
BEGIN
  IF NOT mmc.cam_v2_cancel_inactive_job(
    '70000000-0000-4000-8000-000000000020', 1
  ) OR NOT mmc.cam_v2_dead_letter_inactive_outbox(
    '70000000-0000-4000-8000-000000000021', 1, 'WRITER_DISABLED'
  ) THEN
    RAISE EXCEPTION 'incident-disabled work cleanup did not complete';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM mmc.cam_v2_jobs
    WHERE id = '70000000-0000-4000-8000-000000000020'
      AND status = 'CANCELLED' AND error_class = 'WRITER_DISABLED'
  ) OR NOT EXISTS (
    SELECT 1 FROM mmc.cam_v2_outbox_events
    WHERE id = '70000000-0000-4000-8000-000000000021'
      AND delivery_state = 'DEAD_LETTER'
      AND delivery_completion_error_class = 'WRITER_DISABLED'
  ) THEN
    RAISE EXCEPTION 'incident cleanup lost its exact terminal evidence';
  END IF;
END $$;
SELECT set_config(
  'request.jwt.claims',
  jsonb_build_object('role', 'authenticated', 'app_metadata', jsonb_build_object(
    'mmc_tenant_id', '00000000-0000-4000-8000-0000000000a1', 'mmc_environment', 'LOCAL',
    'mmc_principal_id', '00000000-0000-4000-8000-0000000000a7', 'mmc_principal_kind', 'WORKLOAD',
    'mmc_queue_name', 'publication-disabled', 'mmc_capabilities', jsonb_build_array('mmc.worker.claim')
  ))::text,
  true
);
DO $$
DECLARE
  v_claims integer;
BEGIN
  IF mmc.cam_v2_plane_is_enabled('student_publication') THEN
    RAISE EXCEPTION 'student publication plane unexpectedly enabled';
  END IF;
  SELECT count(*) INTO v_claims FROM mmc.cam_v2_claim_job('publication-disabled', 60);
  IF v_claims <> 0 THEN
    RAISE EXCEPTION 'disabled cutover plane admitted a worker mutation';
  END IF;
END $$;

-- Unscoped claims fail closed.
SELECT set_config('request.jwt.claims', '{"role":"authenticated","app_metadata":{}}', true);
DO $$
BEGIN
  IF mmc.cam_v2_current_tenant_id() IS NOT NULL
     OR mmc.cam_v2_actor_is_active()
     OR (SELECT count(*) FROM mmc.cam_v2_tasks) <> 0 THEN
    RAISE EXCEPTION 'unscoped principal did not fail closed';
  END IF;
END $$;

-- Force every deferred successful-job evidence check before the validation
-- transaction rolls back; rollback alone would not execute deferred triggers.
SET CONSTRAINTS mmc.cam_v2_jobs_success_evidence IMMEDIATE;

-- CROSS_TENANT_DENY, CROSS_ENVIRONMENT_DENY, WRONG_SUBJECT_DENY,
-- REVOKED_ASSIGNMENT_DENY, REVOKED_PRINCIPAL_DENY, REVOKED_TENANT_DENY,
-- STALE_WORKER_GENERATION_DENY, QUEUE_MISMATCH_DENY, REVOKED_AUTHORITY_DENY,
-- NO_DIRECT_DML_DENY, and CUTOVER_PLANE_DENY were exercised above.

ROLLBACK;
