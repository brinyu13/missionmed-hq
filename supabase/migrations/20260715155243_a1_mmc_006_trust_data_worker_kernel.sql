-- Migration: 20260715155243_a1_mmc_006_trust_data_worker_kernel.sql
-- Authority: A1-MMC-006 / MR-078A
-- Date: 2026-07-15
-- Depends on: 20260626040000_mmc_coaching_intelligence_pipeline.sql
-- Description: Add the local/staging CAM v2 trust, canonical-data, publication, and fenced-worker kernel.
-- Idempotent: YES
-- =============================================================================
-- LOCAL/STAGING/CI ONLY. This migration is intentionally unapplied by MegaRun 006.
-- It is additive: historical MMC tables remain untouched, and both v1 and v2
-- mutation planes remain sealed until a separately authorized, rehearsed
-- single-writer cutover activates exactly one v2 writer.
-- Runtime identities are signed, short-lived, role-specific principals. Tenant,
-- environment, subject, assignment, and workload lease claims are never accepted
-- from command payloads. No runtime identity receives unrestricted schema access.
-- =============================================================================

BEGIN;

DO $$
DECLARE
  v_target text := lower(coalesce(current_setting('mmc.schema_build_target', true), ''));
BEGIN
  IF v_target NOT IN ('local', 'staging', 'ci') THEN
    RAISE EXCEPTION
      'A1-MMC-006 is local/staging/ci only. Set mmc.schema_build_target explicitly before applying.';
  END IF;
END $$;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA IF NOT EXISTS mmc;

-- Canonical digest primitives. jsonb::text is deterministic because object
-- keys are normalized; timestamps enter attestation material only as UTC epoch
-- microseconds so session TimeZone and delimiter-bearing text cannot change or
-- ambiguously reframe the bytes being hashed.
CREATE OR REPLACE FUNCTION mmc.cam_v2_epoch_microseconds(p_value timestamptz)
RETURNS bigint
LANGUAGE sql
IMMUTABLE
STRICT
SET search_path = pg_catalog, mmc
AS $$
  SELECT round(extract(epoch FROM p_value) * 1000000)::bigint;
$$;

CREATE OR REPLACE FUNCTION mmc.cam_v2_sha256_jsonb(p_value jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
SET search_path = pg_catalog, mmc
AS $$
  SELECT encode(public.digest(p_value::text, 'sha256'), 'hex');
$$;

CREATE OR REPLACE FUNCTION mmc.cam_v2_is_valid_rfc3339(p_value text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
STRICT
SET search_path = pg_catalog, mmc
AS $$
DECLARE
  v_parsed timestamptz;
BEGIN
  IF left(p_value, 4) = '0000'
     OR p_value !~ '^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])T([01]\d|2[0-3]):[0-5]\d:[0-5]\d([.]\d{1,9})?(Z|[+-]((0\d|1[0-3]):[0-5]\d|14:00))$' THEN
    RETURN false;
  END IF;
  v_parsed := p_value::timestamptz;
  RETURN v_parsed IS NOT NULL;
EXCEPTION
  WHEN datetime_field_overflow OR invalid_datetime_format THEN
    RETURN false;
END;
$$;

-- ---------------------------------------------------------------------------
-- Signed-principal claim helpers. All helpers have fixed search paths.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION mmc.cam_v2_claims()
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = pg_catalog, mmc
AS $$
  SELECT coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb);
$$;

CREATE OR REPLACE FUNCTION mmc.cam_v2_is_valid_wire_uuid(p_value text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
STRICT
SET search_path = pg_catalog, mmc
AS $$
  SELECT p_value ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';
$$;

CREATE OR REPLACE FUNCTION mmc.cam_v2_claim_uuid(p_name text)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SET search_path = pg_catalog, mmc
AS $$
DECLARE
  v_value text;
BEGIN
  v_value := nullif(mmc.cam_v2_claims() -> 'app_metadata' ->> p_name, '');
  IF v_value IS NULL THEN
    RETURN NULL;
  END IF;
  IF NOT mmc.cam_v2_is_valid_wire_uuid(v_value) THEN
    RETURN NULL;
  END IF;
  RETURN v_value::uuid;
EXCEPTION
  WHEN invalid_text_representation THEN
    RETURN NULL;
END;
$$;

-- WIRE_UUID_CONTRACT: tenant, principal, subject, assignment, job, command,
-- target, and publication identifiers crossing into this SQL kernel are
-- canonical RFC 9562 variant UUID strings (versions 1 through 8). Gateways
-- must reject opaque IDs; they must
-- never hash or silently map them because that would alter command and
-- idempotency identity semantics.

CREATE OR REPLACE FUNCTION mmc.cam_v2_current_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
SET search_path = pg_catalog, mmc
AS $$
  SELECT mmc.cam_v2_claim_uuid('mmc_tenant_id');
$$;

CREATE OR REPLACE FUNCTION mmc.cam_v2_current_environment()
RETURNS text
LANGUAGE sql
STABLE
SET search_path = pg_catalog, mmc
AS $$
  SELECT upper(coalesce(mmc.cam_v2_claims() -> 'app_metadata' ->> 'mmc_environment', ''));
$$;

CREATE OR REPLACE FUNCTION mmc.cam_v2_current_principal_id()
RETURNS uuid
LANGUAGE sql
STABLE
SET search_path = pg_catalog, mmc
AS $$
  SELECT mmc.cam_v2_claim_uuid('mmc_principal_id');
$$;

CREATE OR REPLACE FUNCTION mmc.cam_v2_current_principal_kind()
RETURNS text
LANGUAGE sql
STABLE
SET search_path = pg_catalog, mmc
AS $$
  SELECT upper(coalesce(mmc.cam_v2_claims() -> 'app_metadata' ->> 'mmc_principal_kind', ''));
$$;

CREATE OR REPLACE FUNCTION mmc.cam_v2_current_subject_link_id()
RETURNS uuid
LANGUAGE sql
STABLE
SET search_path = pg_catalog, mmc
AS $$
  SELECT mmc.cam_v2_claim_uuid('mmc_subject_link_id');
$$;

CREATE OR REPLACE FUNCTION mmc.cam_v2_current_job_id()
RETURNS uuid
LANGUAGE sql
STABLE
SET search_path = pg_catalog, mmc
AS $$
  SELECT mmc.cam_v2_claim_uuid('mmc_job_id');
$$;

CREATE OR REPLACE FUNCTION mmc.cam_v2_current_lease_generation()
RETURNS bigint
LANGUAGE plpgsql
STABLE
SET search_path = pg_catalog, mmc
AS $$
DECLARE
  v_value text;
BEGIN
  v_value := nullif(mmc.cam_v2_claims() -> 'app_metadata' ->> 'mmc_lease_generation', '');
  IF v_value IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN v_value::bigint;
EXCEPTION
  WHEN invalid_text_representation OR numeric_value_out_of_range THEN
    RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION mmc.cam_v2_current_queue_name()
RETURNS text
LANGUAGE sql
STABLE
SET search_path = pg_catalog, mmc
AS $$
  SELECT lower(coalesce(mmc.cam_v2_claims() -> 'app_metadata' ->> 'mmc_queue_name', ''));
$$;

CREATE OR REPLACE FUNCTION mmc.cam_v2_current_outbox_event_id()
RETURNS uuid
LANGUAGE sql
STABLE
SET search_path = pg_catalog, mmc
AS $$
  SELECT mmc.cam_v2_claim_uuid('mmc_outbox_event_id');
$$;

CREATE OR REPLACE FUNCTION mmc.cam_v2_current_outbox_lease_generation()
RETURNS bigint
LANGUAGE plpgsql
STABLE
SET search_path = pg_catalog, mmc
AS $$
DECLARE
  v_value text;
BEGIN
  v_value := nullif(mmc.cam_v2_claims() -> 'app_metadata' ->> 'mmc_outbox_lease_generation', '');
  IF v_value IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN v_value::bigint;
EXCEPTION
  WHEN invalid_text_representation OR numeric_value_out_of_range THEN
    RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION mmc.cam_v2_has_capability(p_capability text)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = pg_catalog, mmc
AS $$
  WITH requested AS (
    SELECT replace(lower(coalesce(p_capability, '')), ':', '.') AS value
  )
  SELECT EXISTS (
    SELECT 1
    FROM jsonb_array_elements_text(
      CASE
        WHEN jsonb_typeof(mmc.cam_v2_claims() -> 'app_metadata' -> 'mmc_capabilities') = 'array'
          THEN mmc.cam_v2_claims() -> 'app_metadata' -> 'mmc_capabilities'
        ELSE '[]'::jsonb
      END
    ) AS capability(value)
    CROSS JOIN requested
    WHERE replace(lower(capability.value), ':', '.') = requested.value
       OR (requested.value = 'mmc.mentor.read' AND replace(lower(capability.value), ':', '.') = 'mmc.query')
       OR (requested.value = 'mmc.mentor.command' AND replace(lower(capability.value), ':', '.') = 'mmc.command')
       OR (requested.value = 'mmc.mentor.review' AND replace(lower(capability.value), ':', '.') = 'mmc.review')
       OR (requested.value = 'mmc.mentor.publish' AND replace(lower(capability.value), ':', '.') = 'mmc.publication.approve')
       OR (requested.value = 'mmc.mentor.audit_read' AND replace(lower(capability.value), ':', '.') = 'mmc.query')
       OR (requested.value = 'mmc.command.execute' AND replace(lower(capability.value), ':', '.') = 'mmc.command')
       OR (requested.value = 'mmc.student.publication_read' AND replace(lower(capability.value), ':', '.') = 'mmc.publication.read')
       OR (requested.value = 'mmc.student.self_author' AND replace(lower(capability.value), ':', '.') = 'mmc.student.self-author')
       OR (requested.value = 'mmc.admin.trust_manage' AND replace(lower(capability.value), ':', '.') IN ('mmc.operations', 'mmc.policy.manage'))
       OR (requested.value IN ('mmc.operator.trust_read', 'mmc.operator.trust_write')
           AND replace(lower(capability.value), ':', '.') = 'mmc.operations')
       OR (requested.value IN ('mmc.worker.lease', 'mmc.worker.heartbeat')
           AND replace(lower(capability.value), ':', '.') = 'mmc.worker.claim')
  );
$$;

-- ---------------------------------------------------------------------------
-- Trust and identity plane.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS mmc.cam_v2_tenants (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  environment text NOT NULL,
  tenant_key text NOT NULL,
  display_name text NOT NULL,
  status text NOT NULL DEFAULT 'ACTIVE',
  object_version bigint NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id),
  UNIQUE (id, environment),
  UNIQUE (tenant_key, environment),
  CHECK (environment IN ('FIXTURE', 'LOCAL', 'STAGING', 'LIVE')),
  CHECK (status IN ('ACTIVE', 'SUSPENDED', 'RETIRED')),
  CHECK (object_version > 0)
);

CREATE TABLE IF NOT EXISTS mmc.cam_v2_principals (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  environment text NOT NULL,
  principal_kind text NOT NULL,
  auth_subject_digest text NOT NULL,
  status text NOT NULL DEFAULT 'ACTIVE',
  object_version bigint NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id),
  UNIQUE (tenant_id, environment, id),
  UNIQUE (tenant_id, environment, id, principal_kind),
  UNIQUE (tenant_id, environment, auth_subject_digest),
  FOREIGN KEY (tenant_id, environment)
    REFERENCES mmc.cam_v2_tenants(id, environment) ON DELETE RESTRICT,
  CHECK (principal_kind IN ('MENTOR', 'STUDENT', 'OPERATOR', 'WORKLOAD', 'ADMIN')),
  CHECK (status IN ('ACTIVE', 'SUSPENDED', 'REVOKED', 'RETIRED')),
  CHECK (auth_subject_digest ~ '^[a-f0-9]{64}$'),
  CHECK (object_version > 0)
);

CREATE TABLE IF NOT EXISTS mmc.cam_v2_subject_links (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  environment text NOT NULL,
  student_principal_id uuid,
  student_principal_kind text NOT NULL DEFAULT 'STUDENT',
  external_subject_digest text NOT NULL,
  identity_state text NOT NULL DEFAULT 'UNVERIFIED',
  independent_authority_count integer NOT NULL DEFAULT 0,
  verified_by_principal_id uuid,
  verified_at timestamptz,
  revoked_at timestamptz,
  object_version bigint NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id),
  UNIQUE (tenant_id, environment, id),
  UNIQUE (tenant_id, environment, external_subject_digest),
  FOREIGN KEY (tenant_id, environment)
    REFERENCES mmc.cam_v2_tenants(id, environment) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, environment, student_principal_id)
    REFERENCES mmc.cam_v2_principals(tenant_id, environment, id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, environment, student_principal_id, student_principal_kind)
    REFERENCES mmc.cam_v2_principals(tenant_id, environment, id, principal_kind) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, environment, verified_by_principal_id)
    REFERENCES mmc.cam_v2_principals(tenant_id, environment, id) ON DELETE RESTRICT,
  CHECK (identity_state IN ('UNVERIFIED', 'PROBABLE', 'MANUAL_REVIEW', 'CONFLICT', 'VERIFIED_LOCAL_LINK', 'REVOKED')),
  CHECK (student_principal_kind = 'STUDENT'),
  CHECK (identity_state <> 'VERIFIED_LOCAL_LINK' OR student_principal_id IS NOT NULL),
  CHECK (external_subject_digest ~ '^[a-f0-9]{64}$'),
  CHECK (independent_authority_count >= 0),
  CHECK (
    (identity_state = 'VERIFIED_LOCAL_LINK'
      AND student_principal_id IS NOT NULL
      AND verified_by_principal_id IS NOT NULL
      AND verified_at IS NOT NULL
      AND independent_authority_count >= 2
      AND revoked_at IS NULL)
    OR (identity_state = 'REVOKED'
      AND student_principal_id IS NOT NULL
      AND verified_by_principal_id IS NOT NULL
      AND verified_at IS NOT NULL
      AND independent_authority_count >= 2
      AND revoked_at IS NOT NULL
      AND revoked_at >= verified_at)
    OR (identity_state NOT IN ('VERIFIED_LOCAL_LINK', 'REVOKED')
      AND student_principal_id IS NULL
      AND verified_by_principal_id IS NULL
      AND verified_at IS NULL
      AND revoked_at IS NULL)
  ),
  CHECK (object_version > 0)
);

CREATE TABLE IF NOT EXISTS mmc.cam_v2_assignments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  environment text NOT NULL,
  mentor_principal_id uuid NOT NULL,
  mentor_principal_kind text NOT NULL DEFAULT 'MENTOR',
  subject_link_id uuid NOT NULL,
  assignment_scope text NOT NULL DEFAULT 'COACHING',
  status text NOT NULL DEFAULT 'PROPOSED',
  effective_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  granted_by_principal_id uuid NOT NULL,
  object_version bigint NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id),
  UNIQUE (tenant_id, environment, id),
  UNIQUE (tenant_id, environment, id, subject_link_id),
  UNIQUE (tenant_id, environment, id, subject_link_id, mentor_principal_id),
  FOREIGN KEY (tenant_id, environment)
    REFERENCES mmc.cam_v2_tenants(id, environment) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, environment, mentor_principal_id)
    REFERENCES mmc.cam_v2_principals(tenant_id, environment, id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, environment, mentor_principal_id, mentor_principal_kind)
    REFERENCES mmc.cam_v2_principals(tenant_id, environment, id, principal_kind) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, environment, subject_link_id)
    REFERENCES mmc.cam_v2_subject_links(tenant_id, environment, id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, environment, granted_by_principal_id)
    REFERENCES mmc.cam_v2_principals(tenant_id, environment, id) ON DELETE RESTRICT,
  CHECK (status IN ('PROPOSED', 'ACTIVE', 'EXPIRED', 'REVOKED', 'REASSIGNED')),
  CHECK (mentor_principal_kind = 'MENTOR'),
  CHECK (assignment_scope = 'COACHING'),
  CHECK ((status = 'REVOKED') = (revoked_at IS NOT NULL)),
  CHECK (expires_at IS NULL OR expires_at > effective_at),
  CHECK (object_version > 0)
);

CREATE TABLE IF NOT EXISTS mmc.cam_v2_policy_versions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  environment text NOT NULL,
  policy_kind text NOT NULL,
  policy_version integer NOT NULL,
  policy_digest text NOT NULL,
  status text NOT NULL DEFAULT 'DRAFT',
  effective_at timestamptz,
  expires_at timestamptz,
  approved_by_principal_id uuid,
  object_version bigint NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id),
  UNIQUE (tenant_id, environment, id),
  UNIQUE (tenant_id, environment, id, policy_kind),
  UNIQUE (tenant_id, environment, policy_kind, policy_version),
  FOREIGN KEY (tenant_id, environment)
    REFERENCES mmc.cam_v2_tenants(id, environment) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, environment, approved_by_principal_id)
    REFERENCES mmc.cam_v2_principals(tenant_id, environment, id) ON DELETE RESTRICT,
  CHECK (policy_kind IN ('ADVISING', 'EVIDENCE', 'IDENTITY', 'ACQUISITION', 'TRANSCRIPT_PROCESSING', 'AI_TRANSFER', 'PUBLICATION', 'RETENTION')),
  CHECK (policy_version > 0),
  CHECK (policy_digest ~ '^[a-f0-9]{64}$'),
  CHECK (status IN ('DRAFT', 'REVIEWED', 'ACTIVE', 'RETIRED')),
  CHECK (
    (status = 'DRAFT' AND approved_by_principal_id IS NULL AND effective_at IS NULL)
    OR (status = 'REVIEWED' AND approved_by_principal_id IS NOT NULL AND effective_at IS NULL)
    OR (status IN ('ACTIVE', 'RETIRED')
      AND approved_by_principal_id IS NOT NULL AND effective_at IS NOT NULL)
  ),
  CHECK (expires_at IS NULL OR effective_at IS NULL OR expires_at > effective_at),
  CHECK (object_version > 0)
);

CREATE TABLE IF NOT EXISTS mmc.cam_v2_authority_grants (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  environment text NOT NULL,
  subject_link_id uuid,
  assignment_id uuid,
  policy_version_id uuid NOT NULL,
  grant_kind text NOT NULL,
  basis_digest text NOT NULL,
  status text NOT NULL DEFAULT 'PROPOSED',
  effective_at timestamptz NOT NULL,
  expires_at timestamptz,
  revoked_at timestamptz,
  granted_by_principal_id uuid NOT NULL,
  object_version bigint NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id),
  UNIQUE (tenant_id, environment, id),
  UNIQUE NULLS NOT DISTINCT (tenant_id, environment, id, assignment_id, subject_link_id),
  FOREIGN KEY (tenant_id, environment)
    REFERENCES mmc.cam_v2_tenants(id, environment) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, environment, subject_link_id)
    REFERENCES mmc.cam_v2_subject_links(tenant_id, environment, id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, environment, assignment_id)
    REFERENCES mmc.cam_v2_assignments(tenant_id, environment, id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, environment, assignment_id, subject_link_id)
    REFERENCES mmc.cam_v2_assignments(tenant_id, environment, id, subject_link_id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, environment, policy_version_id)
    REFERENCES mmc.cam_v2_policy_versions(tenant_id, environment, id) ON DELETE RESTRICT,
  CONSTRAINT cam_v2_authority_grant_policy_kind_fk
    FOREIGN KEY (tenant_id, environment, policy_version_id, grant_kind)
    REFERENCES mmc.cam_v2_policy_versions(tenant_id, environment, id, policy_kind) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, environment, granted_by_principal_id)
    REFERENCES mmc.cam_v2_principals(tenant_id, environment, id) ON DELETE RESTRICT,
  CHECK (grant_kind IN ('ACQUISITION', 'TRANSCRIPT_PROCESSING', 'AI_TRANSFER', 'PUBLICATION')),
  CHECK (basis_digest ~ '^[a-f0-9]{64}$'),
  CHECK (status IN ('PROPOSED', 'ACTIVE', 'EXPIRED', 'REVOKED')),
  CHECK ((status = 'REVOKED') = (revoked_at IS NOT NULL)),
  CHECK ((assignment_id IS NULL) = (subject_link_id IS NULL)),
  CHECK (expires_at IS NULL OR expires_at > effective_at),
  CHECK (object_version > 0)
);

-- ---------------------------------------------------------------------------
-- Command, idempotency, and fenced job plane.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS mmc.cam_v2_command_receipts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  environment text NOT NULL,
  principal_id uuid NOT NULL,
  command_id uuid NOT NULL,
  command_kind text NOT NULL,
  target_kind text NOT NULL,
  target_id uuid NOT NULL,
  expected_version bigint NOT NULL,
  schema_version integer NOT NULL,
  semantic_command_digest text NOT NULL,
  result_digest text,
  status text NOT NULL DEFAULT 'RECEIVED',
  correlation_id text NOT NULL,
  object_version bigint NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id),
  UNIQUE (tenant_id, environment, id),
  UNIQUE (tenant_id, environment, command_id),
  UNIQUE (tenant_id, environment, correlation_id),
  UNIQUE NULLS NOT DISTINCT (
    tenant_id, environment, id, principal_id, command_id, command_kind,
    target_kind, target_id, schema_version, semantic_command_digest
  ),
  FOREIGN KEY (tenant_id, environment)
    REFERENCES mmc.cam_v2_tenants(id, environment) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, environment, principal_id)
    REFERENCES mmc.cam_v2_principals(tenant_id, environment, id) ON DELETE RESTRICT,
  CHECK (schema_version = 1),
  CHECK (expected_version >= 0),
  CHECK (command_kind IN (
    'task.upsert', 'session.close', 'review.decide', 'identity.decide',
    'publication.approve', 'job.enqueue', 'student.respond'
  )),
  CHECK (
    (command_kind = 'task.upsert' AND target_kind = 'TASK')
    OR (command_kind = 'session.close' AND target_kind = 'SESSION')
    OR (command_kind = 'review.decide' AND target_kind = 'PROPOSAL')
    OR (command_kind = 'identity.decide' AND target_kind = 'IDENTITY_CANDIDATE')
    OR (command_kind = 'publication.approve' AND target_kind = 'PUBLICATION')
    OR (command_kind = 'job.enqueue' AND target_kind = 'JOB')
    OR (command_kind = 'student.respond' AND target_kind = 'STUDENT_RESPONSE_STREAM')
  ),
  CHECK (semantic_command_digest ~ '^[a-f0-9]{64}$'),
  CHECK (result_digest IS NULL OR result_digest ~ '^[a-f0-9]{64}$'),
  CHECK (correlation_id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{2,199}$'),
  CHECK (status IN ('RECEIVED', 'COMMITTED', 'CONFLICT', 'REJECTED', 'FAILED')),
  CHECK (
    (status = 'RECEIVED' AND result_digest IS NULL)
    OR (status IN ('COMMITTED', 'CONFLICT', 'REJECTED', 'FAILED')
      AND result_digest IS NOT NULL)
  ),
  CHECK (object_version > 0)
);

CREATE TABLE IF NOT EXISTS mmc.cam_v2_idempotency_records (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  environment text NOT NULL,
  principal_id uuid NOT NULL,
  command_receipt_id uuid NOT NULL,
  command_id uuid NOT NULL,
  command_kind text NOT NULL,
  target_kind text NOT NULL,
  target_id uuid NOT NULL,
  schema_version integer NOT NULL,
  idempotency_key_digest text NOT NULL,
  semantic_command_digest text NOT NULL,
  result_digest text,
  expires_at timestamptz NOT NULL,
  object_version bigint NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id),
  UNIQUE (tenant_id, environment, id),
  CONSTRAINT cam_v2_idempotency_principal_key_unique
    UNIQUE (tenant_id, environment, principal_id, idempotency_key_digest),
  FOREIGN KEY (tenant_id, environment)
    REFERENCES mmc.cam_v2_tenants(id, environment) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, environment, principal_id)
    REFERENCES mmc.cam_v2_principals(tenant_id, environment, id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, environment, command_receipt_id)
    REFERENCES mmc.cam_v2_command_receipts(tenant_id, environment, id) ON DELETE RESTRICT,
  CONSTRAINT cam_v2_idempotency_receipt_semantics_fk
    FOREIGN KEY (
      tenant_id, environment, command_receipt_id, principal_id, command_id,
      command_kind, target_kind, target_id, schema_version, semantic_command_digest
    ) REFERENCES mmc.cam_v2_command_receipts(
      tenant_id, environment, id, principal_id, command_id,
      command_kind, target_kind, target_id, schema_version, semantic_command_digest
    ) ON DELETE RESTRICT,
  CHECK (schema_version = 1),
  CHECK (command_kind IN (
    'task.upsert', 'session.close', 'review.decide', 'identity.decide',
    'publication.approve', 'job.enqueue', 'student.respond'
  )),
  CHECK (
    (command_kind = 'task.upsert' AND target_kind = 'TASK')
    OR (command_kind = 'session.close' AND target_kind = 'SESSION')
    OR (command_kind = 'review.decide' AND target_kind = 'PROPOSAL')
    OR (command_kind = 'identity.decide' AND target_kind = 'IDENTITY_CANDIDATE')
    OR (command_kind = 'publication.approve' AND target_kind = 'PUBLICATION')
    OR (command_kind = 'job.enqueue' AND target_kind = 'JOB')
    OR (command_kind = 'student.respond' AND target_kind = 'STUDENT_RESPONSE_STREAM')
  ),
  CHECK (idempotency_key_digest ~ '^[a-f0-9]{64}$'),
  CHECK (semantic_command_digest ~ '^[a-f0-9]{64}$'),
  CHECK (result_digest IS NULL OR result_digest ~ '^[a-f0-9]{64}$'),
  CHECK (expires_at > created_at),
  CHECK (object_version > 0)
);

CREATE OR REPLACE FUNCTION mmc.cam_v2_enforce_idempotency_receipt_semantics()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, mmc
SET row_security = off
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM mmc.cam_v2_command_receipts AS receipt
    WHERE receipt.tenant_id = NEW.tenant_id
      AND receipt.environment = NEW.environment
      AND receipt.id = NEW.command_receipt_id
      AND receipt.principal_id = NEW.principal_id
      AND receipt.command_id = NEW.command_id
      AND receipt.command_kind = NEW.command_kind
      AND receipt.target_kind = NEW.target_kind
      AND receipt.target_id IS NOT DISTINCT FROM NEW.target_id
      AND receipt.schema_version = NEW.schema_version
      AND receipt.semantic_command_digest = NEW.semantic_command_digest
      AND receipt.result_digest IS NOT DISTINCT FROM NEW.result_digest
  ) THEN
    RAISE EXCEPTION 'idempotency record does not match its exact command receipt semantics'
      USING ERRCODE = '23503', CONSTRAINT = 'cam_v2_idempotency_receipt_semantics_fk';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS cam_v2_idempotency_receipt_semantics ON mmc.cam_v2_idempotency_records;
CREATE TRIGGER cam_v2_idempotency_receipt_semantics
BEFORE INSERT OR UPDATE ON mmc.cam_v2_idempotency_records
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_enforce_idempotency_receipt_semantics();

CREATE TABLE IF NOT EXISTS mmc.cam_v2_jobs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  environment text NOT NULL,
  authority_grant_id uuid NOT NULL,
  assignment_id uuid,
  subject_link_id uuid,
  command_receipt_id uuid,
  queue_name text NOT NULL,
  job_kind text NOT NULL,
  operation_ref text NOT NULL,
  payload_digest text NOT NULL,
  -- Provider replay safety is fixed when the job is created by the trusted
  -- scheduler. A workload can report an outcome, but cannot self-attest that
  -- an unsafe provider operation is idempotent.
  provider_execution_mode text NOT NULL DEFAULT 'EXTERNAL',
  provider_idempotency_mode text NOT NULL DEFAULT 'UNPROVEN',
  provider_idempotency_policy_digest text,
  -- Every provider call has a stable persisted key, including calls whose
  -- provider has not proven idempotent handling. UNPROVEN controls retry
  -- policy; it never means that the caller may omit the key.
  provider_idempotency_key_digest text NOT NULL
    DEFAULT encode(public.digest(gen_random_uuid()::text, 'sha256'), 'hex'),
  status text NOT NULL DEFAULT 'QUEUED',
  attempt_count integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 5,
  available_at timestamptz NOT NULL DEFAULT now(),
  input_set_digest text,
  input_set_frozen_at timestamptz,
  lease_owner_principal_id uuid,
  lease_generation bigint NOT NULL DEFAULT 0,
  lease_expires_at timestamptz,
  result_digest text,
  external_dispatch_generation bigint,
  external_dispatch_intent_digest text,
  external_dispatch_idempotency_key_digest text,
  external_dispatch_recorded_at timestamptz,
  external_result_generation bigint,
  external_outcome text,
  external_result_digest text,
  external_provider_receipt_digest text,
  external_provider_idempotency_proven boolean,
  external_result_recorded_at timestamptz,
  error_class text,
  completed_at timestamptz,
  completed_by_principal_id uuid,
  completed_lease_generation bigint,
  completion_disposition text,
  completion_result_digest text,
  completion_retry_delay_seconds integer,
  object_version bigint NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id),
  UNIQUE (tenant_id, environment, id),
  UNIQUE NULLS NOT DISTINCT (tenant_id, environment, id, assignment_id, subject_link_id),
  UNIQUE NULLS NOT DISTINCT (tenant_id, environment, id, authority_grant_id, assignment_id, subject_link_id),
  UNIQUE (tenant_id, environment, job_kind, operation_ref),
  FOREIGN KEY (tenant_id, environment)
    REFERENCES mmc.cam_v2_tenants(id, environment) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, environment, authority_grant_id)
    REFERENCES mmc.cam_v2_authority_grants(tenant_id, environment, id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, environment, authority_grant_id, assignment_id, subject_link_id)
    REFERENCES mmc.cam_v2_authority_grants(tenant_id, environment, id, assignment_id, subject_link_id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, environment, assignment_id)
    REFERENCES mmc.cam_v2_assignments(tenant_id, environment, id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, environment, assignment_id, subject_link_id)
    REFERENCES mmc.cam_v2_assignments(tenant_id, environment, id, subject_link_id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, environment, subject_link_id)
    REFERENCES mmc.cam_v2_subject_links(tenant_id, environment, id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, environment, command_receipt_id)
    REFERENCES mmc.cam_v2_command_receipts(tenant_id, environment, id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, environment, lease_owner_principal_id)
    REFERENCES mmc.cam_v2_principals(tenant_id, environment, id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, environment, completed_by_principal_id)
    REFERENCES mmc.cam_v2_principals(tenant_id, environment, id) ON DELETE RESTRICT,
  CHECK (job_kind IN ('SOURCE_DISCOVERY', 'ASSET_ACQUISITION', 'TRANSCRIPT_PROCESSING', 'AI_ANALYSIS', 'PUBLICATION_RENDER', 'RECONCILIATION')),
  -- INTERNAL completion is deliberately sealed in this kernel. Admitting it
  -- would require a separately reviewed non-provider completion RPC.
  CHECK (provider_execution_mode = 'EXTERNAL'),
  CHECK (provider_idempotency_mode IN ('UNPROVEN', 'PROVEN')),
  CHECK (
    (provider_idempotency_mode = 'UNPROVEN'
      AND provider_idempotency_policy_digest IS NULL
      AND provider_idempotency_key_digest ~ '^[a-f0-9]{64}$')
    OR (provider_idempotency_mode = 'PROVEN'
      AND provider_idempotency_policy_digest ~ '^[a-f0-9]{64}$'
      AND provider_idempotency_key_digest ~ '^[a-f0-9]{64}$')
  ),
  CHECK (status IN ('QUEUED', 'LEASED', 'RUNNING', 'RETRY_SCHEDULED', 'SUCCEEDED', 'FAILED', 'DEAD_LETTER', 'CANCELLED')),
  CHECK (queue_name ~ '^[a-z0-9][a-z0-9._-]{0,63}$'),
  CHECK (payload_digest ~ '^[a-f0-9]{64}$'),
  CHECK (result_digest IS NULL OR result_digest ~ '^[a-f0-9]{64}$'),
  CHECK (attempt_count >= 0 AND max_attempts > 0 AND attempt_count <= max_attempts),
  CHECK (input_set_digest IS NULL OR input_set_digest ~ '^[a-f0-9]{64}$'),
  CHECK ((input_set_digest IS NULL) = (input_set_frozen_at IS NULL)),
  CHECK (lease_generation >= 0),
  CHECK (external_dispatch_generation IS NULL OR external_dispatch_generation > 0),
  CHECK (external_dispatch_generation IS NULL OR external_dispatch_generation <= lease_generation),
  CHECK (external_dispatch_intent_digest IS NULL OR external_dispatch_intent_digest ~ '^[a-f0-9]{64}$'),
  CHECK (external_dispatch_idempotency_key_digest IS NULL
    OR external_dispatch_idempotency_key_digest ~ '^[a-f0-9]{64}$'),
  CHECK (
    (external_dispatch_generation IS NULL AND external_dispatch_intent_digest IS NULL
      AND external_dispatch_idempotency_key_digest IS NULL
      AND external_dispatch_recorded_at IS NULL)
    OR (external_dispatch_generation IS NOT NULL AND external_dispatch_intent_digest IS NOT NULL
      AND external_dispatch_idempotency_key_digest IS NOT DISTINCT FROM provider_idempotency_key_digest
      AND external_dispatch_recorded_at IS NOT NULL)
  ),
  CHECK (external_result_generation IS NULL OR external_result_generation > 0),
  CHECK (external_result_generation IS NULL OR external_result_generation <= lease_generation),
  CHECK (external_outcome IS NULL OR external_outcome IN ('SUCCEEDED', 'FAILED', 'OUTCOME_UNKNOWN')),
  CHECK (external_result_digest IS NULL OR external_result_digest ~ '^[a-f0-9]{64}$'),
  CHECK (external_provider_receipt_digest IS NULL OR external_provider_receipt_digest ~ '^[a-f0-9]{64}$'),
  CHECK (
    (external_result_generation IS NULL AND external_outcome IS NULL
      AND external_result_digest IS NULL AND external_provider_receipt_digest IS NULL
      AND external_provider_idempotency_proven IS NULL AND external_result_recorded_at IS NULL)
    OR (external_result_generation IS NOT NULL AND external_outcome IS NOT NULL
      AND external_result_digest IS NOT NULL AND external_provider_idempotency_proven IS NOT NULL
      AND external_result_recorded_at IS NOT NULL)
  ),
  CHECK (external_result_generation IS NULL
    OR external_dispatch_generation = external_result_generation),
  CHECK ((assignment_id IS NULL) = (subject_link_id IS NULL)),
  CHECK ((lease_owner_principal_id IS NULL) = (lease_expires_at IS NULL)),
  CHECK (
    (status IN ('LEASED', 'RUNNING')
      AND lease_owner_principal_id IS NOT NULL
      AND lease_expires_at IS NOT NULL
      AND lease_generation > 0)
    OR (status NOT IN ('LEASED', 'RUNNING')
      AND lease_owner_principal_id IS NULL
      AND lease_expires_at IS NULL)
  ),
  CHECK (completed_lease_generation IS NULL OR completed_lease_generation > 0),
  CHECK (completion_disposition IS NULL OR completion_disposition IN ('SUCCEEDED', 'FAILED', 'DEAD_LETTER', 'RETRY')),
  CHECK (completion_result_digest IS NULL OR completion_result_digest ~ '^[a-f0-9]{64}$'),
  CHECK (
    (status NOT IN ('RETRY_SCHEDULED', 'SUCCEEDED', 'FAILED', 'DEAD_LETTER')
      AND completed_at IS NULL AND completed_by_principal_id IS NULL
      AND completed_lease_generation IS NULL AND completion_disposition IS NULL
      AND completion_result_digest IS NULL AND completion_retry_delay_seconds IS NULL)
    OR (status = 'RETRY_SCHEDULED'
      AND completed_at IS NOT NULL AND completed_by_principal_id IS NOT NULL
      AND completed_lease_generation IS NOT NULL AND completion_disposition = 'RETRY'
      AND completion_result_digest IS NOT NULL
      AND completion_retry_delay_seconds BETWEEN 0 AND 86400
      AND result_digest IS NULL)
    OR (status IN ('SUCCEEDED', 'FAILED', 'DEAD_LETTER')
      AND completed_at IS NOT NULL AND completed_by_principal_id IS NOT NULL
      AND completed_lease_generation IS NOT NULL AND completion_disposition IS NOT NULL
      AND status = completion_disposition
      AND completion_result_digest = result_digest
      AND completion_retry_delay_seconds IS NULL)
  ),
  CHECK (object_version > 0)
);

CREATE OR REPLACE FUNCTION mmc.cam_v2_enforce_job_provider_config_immutable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, mmc
AS $$
BEGIN
  IF NEW.provider_execution_mode IS DISTINCT FROM OLD.provider_execution_mode
     OR NEW.provider_idempotency_mode IS DISTINCT FROM OLD.provider_idempotency_mode
     OR NEW.provider_idempotency_policy_digest IS DISTINCT FROM OLD.provider_idempotency_policy_digest
     OR NEW.provider_idempotency_key_digest IS DISTINCT FROM OLD.provider_idempotency_key_digest THEN
    RAISE EXCEPTION 'job provider execution/idempotency policy is immutable after creation'
      USING ERRCODE = '23514', CONSTRAINT = 'cam_v2_jobs_provider_config_immutable';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS cam_v2_jobs_provider_config_immutable ON mmc.cam_v2_jobs;
CREATE TRIGGER cam_v2_jobs_provider_config_immutable
BEFORE UPDATE ON mmc.cam_v2_jobs
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_enforce_job_provider_config_immutable();

-- ---------------------------------------------------------------------------
-- Canonical mentor/student object plane.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS mmc.cam_v2_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  environment text NOT NULL,
  assignment_id uuid NOT NULL,
  subject_link_id uuid NOT NULL,
  mentor_principal_id uuid NOT NULL,
  session_state text NOT NULL DEFAULT 'DRAFT',
  purpose text NOT NULL,
  started_at timestamptz,
  ended_at timestamptz,
  sensitivity text NOT NULL DEFAULT 'RESTRICTED',
  object_version bigint NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id),
  UNIQUE (tenant_id, environment, id),
  UNIQUE (tenant_id, environment, id, assignment_id, subject_link_id),
  FOREIGN KEY (tenant_id, environment)
    REFERENCES mmc.cam_v2_tenants(id, environment) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, environment, assignment_id)
    REFERENCES mmc.cam_v2_assignments(tenant_id, environment, id) ON DELETE RESTRICT,
  CONSTRAINT cam_v2_sessions_assignment_subject_mentor_fk
    FOREIGN KEY (tenant_id, environment, assignment_id, subject_link_id, mentor_principal_id)
    REFERENCES mmc.cam_v2_assignments(tenant_id, environment, id, subject_link_id, mentor_principal_id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, environment, subject_link_id)
    REFERENCES mmc.cam_v2_subject_links(tenant_id, environment, id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, environment, mentor_principal_id)
    REFERENCES mmc.cam_v2_principals(tenant_id, environment, id) ON DELETE RESTRICT,
  CHECK (session_state IN ('DRAFT', 'ACTIVE', 'PAUSED', 'REVIEW', 'CLOSED', 'CANCELLED')),
  CHECK (sensitivity IN ('NORMAL', 'RESTRICTED', 'SENSITIVE')),
  CHECK (ended_at IS NULL OR started_at IS NULL OR ended_at >= started_at),
  CHECK (object_version > 0)
);

CREATE TABLE IF NOT EXISTS mmc.cam_v2_tasks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  environment text NOT NULL,
  assignment_id uuid NOT NULL,
  subject_link_id uuid NOT NULL,
  session_id uuid,
  owner_principal_id uuid NOT NULL,
  task_state text NOT NULL DEFAULT 'DRAFT',
  title text NOT NULL,
  due_at timestamptz,
  origin text NOT NULL,
  sensitivity text NOT NULL DEFAULT 'RESTRICTED',
  review_state text NOT NULL DEFAULT 'NOT_REQUIRED',
  object_version bigint NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id),
  UNIQUE (tenant_id, environment, id),
  FOREIGN KEY (tenant_id, environment) REFERENCES mmc.cam_v2_tenants(id, environment) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, environment, assignment_id) REFERENCES mmc.cam_v2_assignments(tenant_id, environment, id) ON DELETE RESTRICT,
  CONSTRAINT cam_v2_tasks_assignment_subject_fk
    FOREIGN KEY (tenant_id, environment, assignment_id, subject_link_id)
    REFERENCES mmc.cam_v2_assignments(tenant_id, environment, id, subject_link_id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, environment, subject_link_id) REFERENCES mmc.cam_v2_subject_links(tenant_id, environment, id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, environment, session_id) REFERENCES mmc.cam_v2_sessions(tenant_id, environment, id) ON DELETE RESTRICT,
  CONSTRAINT cam_v2_tasks_session_assignment_subject_fk
    FOREIGN KEY (tenant_id, environment, session_id, assignment_id, subject_link_id)
    REFERENCES mmc.cam_v2_sessions(tenant_id, environment, id, assignment_id, subject_link_id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, environment, owner_principal_id) REFERENCES mmc.cam_v2_principals(tenant_id, environment, id) ON DELETE RESTRICT,
  CHECK (task_state IN ('DRAFT', 'ACCEPTED', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED', 'CANCELLED', 'SUPERSEDED')),
  CHECK (origin IN ('OBSERVED', 'IMPORTED', 'USER_REPORTED', 'DETERMINISTIC', 'AI_PROPOSAL', 'HUMAN_JUDGMENT')),
  CHECK (sensitivity IN ('NORMAL', 'RESTRICTED', 'SENSITIVE')),
  CHECK (review_state IN ('NOT_REQUIRED', 'REVIEW_REQUIRED', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'SUPERSEDED', 'REVOKED')),
  CHECK (object_version > 0)
);

CREATE TABLE IF NOT EXISTS mmc.cam_v2_commitments (
  id uuid NOT NULL DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, environment text NOT NULL,
  assignment_id uuid NOT NULL, subject_link_id uuid NOT NULL, session_id uuid,
  owner_principal_id uuid NOT NULL, recipient_principal_id uuid, commitment_state text NOT NULL DEFAULT 'PROPOSED',
  statement text NOT NULL, due_at timestamptz, sensitivity text NOT NULL DEFAULT 'RESTRICTED',
  object_version bigint NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id), UNIQUE (tenant_id, environment, id),
  FOREIGN KEY (tenant_id, environment) REFERENCES mmc.cam_v2_tenants(id, environment) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, environment, assignment_id) REFERENCES mmc.cam_v2_assignments(tenant_id, environment, id) ON DELETE RESTRICT,
  CONSTRAINT cam_v2_commitments_assignment_subject_fk
    FOREIGN KEY (tenant_id, environment, assignment_id, subject_link_id)
    REFERENCES mmc.cam_v2_assignments(tenant_id, environment, id, subject_link_id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, environment, subject_link_id) REFERENCES mmc.cam_v2_subject_links(tenant_id, environment, id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, environment, session_id) REFERENCES mmc.cam_v2_sessions(tenant_id, environment, id) ON DELETE RESTRICT,
  CONSTRAINT cam_v2_commitments_session_assignment_subject_fk
    FOREIGN KEY (tenant_id, environment, session_id, assignment_id, subject_link_id)
    REFERENCES mmc.cam_v2_sessions(tenant_id, environment, id, assignment_id, subject_link_id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, environment, owner_principal_id) REFERENCES mmc.cam_v2_principals(tenant_id, environment, id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, environment, recipient_principal_id) REFERENCES mmc.cam_v2_principals(tenant_id, environment, id) ON DELETE RESTRICT,
  CHECK (commitment_state IN ('PROPOSED', 'ACKNOWLEDGED', 'DUE', 'COMPLETED', 'RENEGOTIATED', 'WITHDRAWN', 'SUPERSEDED')),
  CHECK (sensitivity IN ('NORMAL', 'RESTRICTED', 'SENSITIVE')), CHECK (object_version > 0)
);

CREATE TABLE IF NOT EXISTS mmc.cam_v2_goals (
  id uuid NOT NULL DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, environment text NOT NULL,
  assignment_id uuid NOT NULL, subject_link_id uuid NOT NULL, owner_principal_id uuid NOT NULL,
  goal_state text NOT NULL DEFAULT 'PROPOSED', title text NOT NULL, review_at timestamptz,
  object_version bigint NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id), UNIQUE (tenant_id, environment, id),
  UNIQUE (tenant_id, environment, id, assignment_id, subject_link_id),
  FOREIGN KEY (tenant_id, environment) REFERENCES mmc.cam_v2_tenants(id, environment) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, environment, assignment_id) REFERENCES mmc.cam_v2_assignments(tenant_id, environment, id) ON DELETE RESTRICT,
  CONSTRAINT cam_v2_goals_assignment_subject_fk
    FOREIGN KEY (tenant_id, environment, assignment_id, subject_link_id)
    REFERENCES mmc.cam_v2_assignments(tenant_id, environment, id, subject_link_id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, environment, subject_link_id) REFERENCES mmc.cam_v2_subject_links(tenant_id, environment, id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, environment, owner_principal_id) REFERENCES mmc.cam_v2_principals(tenant_id, environment, id) ON DELETE RESTRICT,
  CHECK (goal_state IN ('PROPOSED', 'AGREED', 'ACTIVE', 'PAUSED', 'ACHIEVED', 'WITHDRAWN', 'SUPERSEDED')), CHECK (object_version > 0)
);

CREATE TABLE IF NOT EXISTS mmc.cam_v2_milestones (
  id uuid NOT NULL DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, environment text NOT NULL,
  assignment_id uuid NOT NULL, subject_link_id uuid NOT NULL, goal_id uuid NOT NULL,
  milestone_state text NOT NULL DEFAULT 'PLANNED', title text NOT NULL, criteria_digest text NOT NULL,
  due_at timestamptz, object_version bigint NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id), UNIQUE (tenant_id, environment, id),
  FOREIGN KEY (tenant_id, environment) REFERENCES mmc.cam_v2_tenants(id, environment) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, environment, assignment_id) REFERENCES mmc.cam_v2_assignments(tenant_id, environment, id) ON DELETE RESTRICT,
  CONSTRAINT cam_v2_milestones_assignment_subject_fk
    FOREIGN KEY (tenant_id, environment, assignment_id, subject_link_id)
    REFERENCES mmc.cam_v2_assignments(tenant_id, environment, id, subject_link_id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, environment, subject_link_id) REFERENCES mmc.cam_v2_subject_links(tenant_id, environment, id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, environment, goal_id) REFERENCES mmc.cam_v2_goals(tenant_id, environment, id) ON DELETE RESTRICT,
  CONSTRAINT cam_v2_milestones_goal_assignment_subject_fk
    FOREIGN KEY (tenant_id, environment, goal_id, assignment_id, subject_link_id)
    REFERENCES mmc.cam_v2_goals(tenant_id, environment, id, assignment_id, subject_link_id) ON DELETE RESTRICT,
  CHECK (milestone_state IN ('PLANNED', 'EVIDENCE_PENDING', 'MET', 'NOT_MET', 'BLOCKED', 'SUPERSEDED')), CHECK (object_version > 0)
  , CHECK (criteria_digest ~ '^[a-f0-9]{64}$')
);

CREATE TABLE IF NOT EXISTS mmc.cam_v2_student_statements (
  id uuid NOT NULL DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, environment text NOT NULL,
  subject_link_id uuid NOT NULL, author_principal_id uuid NOT NULL, statement_kind text NOT NULL,
  statement_text text NOT NULL, statement_state text NOT NULL DEFAULT 'DRAFT', supersedes_id uuid,
  object_version bigint NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id), UNIQUE (tenant_id, environment, id),
  UNIQUE (tenant_id, environment, id, subject_link_id),
  FOREIGN KEY (tenant_id, environment) REFERENCES mmc.cam_v2_tenants(id, environment) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, environment, subject_link_id) REFERENCES mmc.cam_v2_subject_links(tenant_id, environment, id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, environment, author_principal_id) REFERENCES mmc.cam_v2_principals(tenant_id, environment, id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, environment, supersedes_id, subject_link_id)
    REFERENCES mmc.cam_v2_student_statements(tenant_id, environment, id, subject_link_id) ON DELETE RESTRICT,
  CHECK (statement_kind IN ('GOAL', 'PREFERENCE', 'CONSTRAINT', 'REFLECTION', 'BLOCKER')),
  CHECK (statement_state IN ('DRAFT', 'SUBMITTED', 'ACTIVE', 'CORRECTED', 'WITHDRAWN', 'SUPERSEDED')), CHECK (object_version > 0)
);

CREATE TABLE IF NOT EXISTS mmc.cam_v2_student_responses (
  id uuid NOT NULL DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, environment text NOT NULL,
  subject_link_id uuid NOT NULL, author_principal_id uuid NOT NULL, target_kind text NOT NULL, target_id uuid NOT NULL,
  response_kind text NOT NULL, response_text text, response_state text NOT NULL DEFAULT 'SUBMITTED', supersedes_id uuid,
  object_version bigint NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id), UNIQUE (tenant_id, environment, id),
  UNIQUE (tenant_id, environment, id, subject_link_id),
  FOREIGN KEY (tenant_id, environment) REFERENCES mmc.cam_v2_tenants(id, environment) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, environment, subject_link_id) REFERENCES mmc.cam_v2_subject_links(tenant_id, environment, id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, environment, author_principal_id) REFERENCES mmc.cam_v2_principals(tenant_id, environment, id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, environment, supersedes_id, subject_link_id)
    REFERENCES mmc.cam_v2_student_responses(tenant_id, environment, id, subject_link_id) ON DELETE RESTRICT,
  CHECK (target_kind IN ('PUBLICATION', 'PUBLICATION_ITEM', 'TASK', 'COMMITMENT', 'GOAL')),
  CHECK (response_kind IN ('ACKNOWLEDGEMENT', 'AGREEMENT', 'CLARIFICATION_REQUEST', 'DISPUTE', 'SELF_REPORTED_COMPLETE', 'BLOCKER_REPORT')),
  CHECK (response_state IN ('SUBMITTED', 'ACTIVE', 'CORRECTED', 'WITHDRAWN', 'SUPERSEDED')), CHECK (object_version > 0)
);

-- Opaque asset, evidence, analysis, and human-review plane.

CREATE TABLE IF NOT EXISTS mmc.cam_v2_source_assets (
  id uuid NOT NULL DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, environment text NOT NULL,
  job_id uuid NOT NULL, authority_grant_id uuid NOT NULL, assignment_id uuid, subject_link_id uuid,
  opaque_asset_handle text NOT NULL, source_system text NOT NULL, source_record_digest text NOT NULL,
  content_digest text, declared_media_type text, byte_size bigint,
  asset_state text NOT NULL DEFAULT 'DISCOVERED', retention_policy_version_id uuid NOT NULL,
  retention_policy_kind text NOT NULL DEFAULT 'RETENTION',
  object_version bigint NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id), UNIQUE (tenant_id, environment, id), UNIQUE (tenant_id, environment, opaque_asset_handle),
  UNIQUE (tenant_id, environment, source_system, source_record_digest),
  UNIQUE NULLS NOT DISTINCT (
    tenant_id, environment, id, job_id, authority_grant_id, assignment_id, subject_link_id
  ),
  UNIQUE NULLS NOT DISTINCT (tenant_id, environment, id, assignment_id, subject_link_id),
  FOREIGN KEY (tenant_id, environment) REFERENCES mmc.cam_v2_tenants(id, environment) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, environment, job_id) REFERENCES mmc.cam_v2_jobs(tenant_id, environment, id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, environment, job_id, assignment_id, subject_link_id)
    REFERENCES mmc.cam_v2_jobs(tenant_id, environment, id, assignment_id, subject_link_id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, environment, job_id, authority_grant_id, assignment_id, subject_link_id)
    REFERENCES mmc.cam_v2_jobs(tenant_id, environment, id, authority_grant_id, assignment_id, subject_link_id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, environment, authority_grant_id) REFERENCES mmc.cam_v2_authority_grants(tenant_id, environment, id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, environment, assignment_id) REFERENCES mmc.cam_v2_assignments(tenant_id, environment, id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, environment, subject_link_id) REFERENCES mmc.cam_v2_subject_links(tenant_id, environment, id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, environment, retention_policy_version_id) REFERENCES mmc.cam_v2_policy_versions(tenant_id, environment, id) ON DELETE RESTRICT,
  CONSTRAINT cam_v2_source_assets_retention_policy_kind_fk
    FOREIGN KEY (tenant_id, environment, retention_policy_version_id, retention_policy_kind)
    REFERENCES mmc.cam_v2_policy_versions(tenant_id, environment, id, policy_kind) ON DELETE RESTRICT,
  CHECK ((assignment_id IS NULL) = (subject_link_id IS NULL)), CHECK (byte_size IS NULL OR byte_size >= 0),
  CHECK (asset_state IN ('DISCOVERED', 'QUARANTINED', 'PAIR_VERIFIED', 'ATTACHED', 'RETAINED', 'EXPIRED', 'REJECTED')),
  CHECK (asset_state NOT IN ('PAIR_VERIFIED', 'ATTACHED', 'RETAINED')
    OR (content_digest IS NOT NULL AND declared_media_type IS NOT NULL AND byte_size IS NOT NULL)),
  CHECK (source_record_digest ~ '^[a-f0-9]{64}$'),
  CHECK (content_digest IS NULL OR content_digest ~ '^[a-f0-9]{64}$'),
  CHECK (retention_policy_kind = 'RETENTION'),
  CHECK (object_version > 0)
);

CREATE TABLE IF NOT EXISTS mmc.cam_v2_transcript_versions (
  id uuid NOT NULL DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, environment text NOT NULL,
  job_id uuid NOT NULL, source_asset_id uuid NOT NULL, authority_grant_id uuid NOT NULL,
  assignment_id uuid, subject_link_id uuid, transcript_version integer NOT NULL,
  transcript_digest text NOT NULL, normalized_digest text NOT NULL, language_code text,
  transcript_state text NOT NULL DEFAULT 'IMPORTED', supersedes_id uuid,
  object_version bigint NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id), UNIQUE (tenant_id, environment, id), UNIQUE (tenant_id, environment, source_asset_id, transcript_version),
  UNIQUE NULLS NOT DISTINCT (
    tenant_id, environment, id, job_id, authority_grant_id, assignment_id, subject_link_id
  ),
  UNIQUE NULLS NOT DISTINCT (tenant_id, environment, id, assignment_id, subject_link_id),
  FOREIGN KEY (tenant_id, environment) REFERENCES mmc.cam_v2_tenants(id, environment) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, environment, job_id) REFERENCES mmc.cam_v2_jobs(tenant_id, environment, id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, environment, job_id, assignment_id, subject_link_id)
    REFERENCES mmc.cam_v2_jobs(tenant_id, environment, id, assignment_id, subject_link_id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, environment, job_id, authority_grant_id, assignment_id, subject_link_id)
    REFERENCES mmc.cam_v2_jobs(tenant_id, environment, id, authority_grant_id, assignment_id, subject_link_id) ON DELETE RESTRICT,
  CONSTRAINT cam_v2_transcripts_source_asset_assignment_subject_fk
    FOREIGN KEY (tenant_id, environment, source_asset_id, assignment_id, subject_link_id)
    REFERENCES mmc.cam_v2_source_assets(tenant_id, environment, id, assignment_id, subject_link_id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, environment, authority_grant_id) REFERENCES mmc.cam_v2_authority_grants(tenant_id, environment, id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, environment, assignment_id) REFERENCES mmc.cam_v2_assignments(tenant_id, environment, id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, environment, subject_link_id) REFERENCES mmc.cam_v2_subject_links(tenant_id, environment, id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, environment, supersedes_id, assignment_id, subject_link_id)
    REFERENCES mmc.cam_v2_transcript_versions(tenant_id, environment, id, assignment_id, subject_link_id) ON DELETE RESTRICT,
  CHECK ((assignment_id IS NULL) = (subject_link_id IS NULL)), CHECK (transcript_version > 0),
  CHECK (transcript_digest ~ '^[a-f0-9]{64}$'),
  CHECK (normalized_digest ~ '^[a-f0-9]{64}$'),
  CHECK (transcript_state IN ('IMPORTED', 'CHUNKED', 'VERIFIED', 'SUPERSEDED', 'WITHDRAWN')), CHECK (object_version > 0)
);

-- Immutable, typed handoff edges let a downstream signed job read only the
-- exact producer-owned input explicitly authorized for that consumer job.
CREATE TABLE IF NOT EXISTS mmc.cam_v2_job_inputs (
  id uuid NOT NULL DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, environment text NOT NULL,
  consumer_job_id uuid NOT NULL, producer_job_id uuid NOT NULL,
  consumer_authority_grant_id uuid NOT NULL, producer_authority_grant_id uuid NOT NULL,
  assignment_id uuid NOT NULL, subject_link_id uuid NOT NULL, input_kind text NOT NULL,
  source_asset_id uuid, transcript_version_id uuid,
  object_version bigint NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id), UNIQUE (tenant_id, environment, id),
  UNIQUE NULLS NOT DISTINCT (
    tenant_id, environment, consumer_job_id, input_kind, source_asset_id, transcript_version_id
  ),
  FOREIGN KEY (tenant_id, environment) REFERENCES mmc.cam_v2_tenants(id, environment) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, environment, assignment_id, subject_link_id)
    REFERENCES mmc.cam_v2_assignments(tenant_id, environment, id, subject_link_id) ON DELETE RESTRICT,
  FOREIGN KEY (
    tenant_id, environment, consumer_job_id, consumer_authority_grant_id, assignment_id, subject_link_id
  ) REFERENCES mmc.cam_v2_jobs(
    tenant_id, environment, id, authority_grant_id, assignment_id, subject_link_id
  ) ON DELETE RESTRICT,
  FOREIGN KEY (
    tenant_id, environment, producer_job_id, producer_authority_grant_id, assignment_id, subject_link_id
  ) REFERENCES mmc.cam_v2_jobs(
    tenant_id, environment, id, authority_grant_id, assignment_id, subject_link_id
  ) ON DELETE RESTRICT,
  FOREIGN KEY (
    tenant_id, environment, source_asset_id, producer_job_id,
    producer_authority_grant_id, assignment_id, subject_link_id
  ) REFERENCES mmc.cam_v2_source_assets(
    tenant_id, environment, id, job_id, authority_grant_id, assignment_id, subject_link_id
  ) ON DELETE RESTRICT,
  FOREIGN KEY (
    tenant_id, environment, transcript_version_id, producer_job_id,
    producer_authority_grant_id, assignment_id, subject_link_id
  ) REFERENCES mmc.cam_v2_transcript_versions(
    tenant_id, environment, id, job_id, authority_grant_id, assignment_id, subject_link_id
  ) ON DELETE RESTRICT,
  CHECK (
    (input_kind = 'SOURCE_ASSET' AND source_asset_id IS NOT NULL AND transcript_version_id IS NULL)
    OR (input_kind = 'TRANSCRIPT_VERSION' AND source_asset_id IS NULL AND transcript_version_id IS NOT NULL)
  ),
  CHECK (consumer_job_id <> producer_job_id),
  CHECK (object_version > 0)
);

CREATE OR REPLACE FUNCTION mmc.cam_v2_enforce_unfrozen_job_input()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, mmc
SET row_security = off
AS $$
DECLARE
  v_consumer_kind text;
  v_producer_kind text;
BEGIN
  SELECT consumer.job_kind INTO v_consumer_kind
  FROM mmc.cam_v2_jobs AS consumer
  WHERE consumer.tenant_id = NEW.tenant_id
    AND consumer.environment = NEW.environment
    AND consumer.id = NEW.consumer_job_id
    AND consumer.status IN ('QUEUED', 'RETRY_SCHEDULED')
    AND consumer.attempt_count = 0
    AND consumer.input_set_digest IS NULL
    AND consumer.input_set_frozen_at IS NULL
  FOR KEY SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'consumer job input set is already frozen'
      USING ERRCODE = '23514', CONSTRAINT = 'cam_v2_job_inputs_consumer_unfrozen';
  END IF;

  SELECT producer.job_kind INTO v_producer_kind
  FROM mmc.cam_v2_jobs AS producer
  WHERE producer.tenant_id = NEW.tenant_id
    AND producer.environment = NEW.environment
    AND producer.id = NEW.producer_job_id
  FOR KEY SHARE;
  IF (NEW.input_kind = 'SOURCE_ASSET' AND (
       v_producer_kind <> 'ASSET_ACQUISITION' OR v_consumer_kind <> 'TRANSCRIPT_PROCESSING'
     )) OR (NEW.input_kind = 'TRANSCRIPT_VERSION' AND (
       v_producer_kind <> 'TRANSCRIPT_PROCESSING' OR v_consumer_kind <> 'AI_ANALYSIS'
     )) THEN
    RAISE EXCEPTION 'job input stage transition is not authorized'
      USING ERRCODE = '23514', CONSTRAINT = 'cam_v2_job_inputs_stage_transition';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS cam_v2_job_inputs_unfrozen ON mmc.cam_v2_job_inputs;
CREATE TRIGGER cam_v2_job_inputs_unfrozen
BEFORE INSERT OR UPDATE ON mmc.cam_v2_job_inputs
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_enforce_unfrozen_job_input();

CREATE OR REPLACE FUNCTION mmc.cam_v2_reject_job_input_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, mmc
AS $$
BEGIN
  RAISE EXCEPTION 'typed job input edges are immutable'
    USING ERRCODE = '23514', CONSTRAINT = 'cam_v2_job_inputs_immutable';
END;
$$;

DROP TRIGGER IF EXISTS cam_v2_job_inputs_immutable ON mmc.cam_v2_job_inputs;
CREATE TRIGGER cam_v2_job_inputs_immutable
BEFORE UPDATE OR DELETE ON mmc.cam_v2_job_inputs
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_reject_job_input_mutation();

CREATE OR REPLACE FUNCTION mmc.cam_v2_enforce_handoff_artifact_immutable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, mmc
SET row_security = off
AS $$
DECLARE
  v_frozen boolean := false;
BEGIN
  IF TG_TABLE_NAME = 'cam_v2_source_assets' THEN
    IF NEW.job_id IS DISTINCT FROM OLD.job_id
       OR NEW.authority_grant_id IS DISTINCT FROM OLD.authority_grant_id
       OR NEW.assignment_id IS DISTINCT FROM OLD.assignment_id
       OR NEW.subject_link_id IS DISTINCT FROM OLD.subject_link_id
       OR NEW.opaque_asset_handle IS DISTINCT FROM OLD.opaque_asset_handle
       OR NEW.source_system IS DISTINCT FROM OLD.source_system
       OR NEW.source_record_digest IS DISTINCT FROM OLD.source_record_digest
       OR NEW.retention_policy_version_id IS DISTINCT FROM OLD.retention_policy_version_id
       OR NEW.retention_policy_kind IS DISTINCT FROM OLD.retention_policy_kind THEN
      RAISE EXCEPTION 'source asset provenance is immutable'
        USING ERRCODE = '23514', CONSTRAINT = 'cam_v2_source_assets_content_immutable';
    END IF;
    IF NEW.content_digest IS DISTINCT FROM OLD.content_digest
       OR NEW.declared_media_type IS DISTINCT FROM OLD.declared_media_type
       OR NEW.byte_size IS DISTINCT FROM OLD.byte_size THEN
      IF NOT (
        OLD.asset_state IN ('DISCOVERED', 'QUARANTINED')
        AND OLD.content_digest IS NULL AND OLD.declared_media_type IS NULL AND OLD.byte_size IS NULL
        AND NEW.asset_state = 'PAIR_VERIFIED'
        AND NEW.content_digest IS NOT NULL AND NEW.declared_media_type IS NOT NULL AND NEW.byte_size IS NOT NULL
        AND NEW.object_version = OLD.object_version + 1
        AND NOT EXISTS (
          SELECT 1 FROM mmc.cam_v2_job_inputs AS input
          WHERE input.tenant_id = OLD.tenant_id
            AND input.environment = OLD.environment
            AND input.source_asset_id = OLD.id
        )
      ) THEN
        RAISE EXCEPTION 'source asset content permits one pre-handoff null-to-attested enrichment only'
          USING ERRCODE = '23514', CONSTRAINT = 'cam_v2_source_assets_content_immutable';
      END IF;
    END IF;
    SELECT EXISTS (
      SELECT 1 FROM mmc.cam_v2_job_inputs AS input
      JOIN mmc.cam_v2_jobs AS consumer
        ON consumer.tenant_id = input.tenant_id
       AND consumer.environment = input.environment
       AND consumer.id = input.consumer_job_id
      WHERE input.tenant_id = OLD.tenant_id
        AND input.environment = OLD.environment
        AND input.source_asset_id = OLD.id
        AND consumer.input_set_frozen_at IS NOT NULL
    ) INTO v_frozen;
    IF v_frozen AND NOT (
      OLD.asset_state IN ('PAIR_VERIFIED', 'ATTACHED', 'RETAINED')
      AND NEW.asset_state IN ('QUARANTINED', 'EXPIRED', 'REJECTED')
      AND NEW.object_version = OLD.object_version + 1
    ) THEN
      RAISE EXCEPTION 'a frozen source asset permits only one-way withdrawal'
        USING ERRCODE = '23514', CONSTRAINT = 'cam_v2_source_assets_frozen_withdrawal_only';
    END IF;
  ELSIF TG_TABLE_NAME = 'cam_v2_transcript_versions' THEN
    IF NEW.job_id IS DISTINCT FROM OLD.job_id
       OR NEW.source_asset_id IS DISTINCT FROM OLD.source_asset_id
       OR NEW.authority_grant_id IS DISTINCT FROM OLD.authority_grant_id
       OR NEW.assignment_id IS DISTINCT FROM OLD.assignment_id
       OR NEW.subject_link_id IS DISTINCT FROM OLD.subject_link_id
       OR NEW.transcript_version IS DISTINCT FROM OLD.transcript_version
       OR NEW.transcript_digest IS DISTINCT FROM OLD.transcript_digest
       OR NEW.normalized_digest IS DISTINCT FROM OLD.normalized_digest
       OR NEW.language_code IS DISTINCT FROM OLD.language_code
       OR NEW.supersedes_id IS DISTINCT FROM OLD.supersedes_id THEN
      RAISE EXCEPTION 'handed-off transcript provenance and content are immutable'
        USING ERRCODE = '23514', CONSTRAINT = 'cam_v2_transcripts_content_immutable';
    END IF;
    SELECT EXISTS (
      SELECT 1 FROM mmc.cam_v2_job_inputs AS input
      JOIN mmc.cam_v2_jobs AS consumer
        ON consumer.tenant_id = input.tenant_id
       AND consumer.environment = input.environment
       AND consumer.id = input.consumer_job_id
      WHERE input.tenant_id = OLD.tenant_id
        AND input.environment = OLD.environment
        AND input.transcript_version_id = OLD.id
        AND consumer.input_set_frozen_at IS NOT NULL
    ) INTO v_frozen;
    IF v_frozen AND NOT (
      OLD.transcript_state = 'VERIFIED'
      AND NEW.transcript_state IN ('SUPERSEDED', 'WITHDRAWN')
      AND NEW.object_version = OLD.object_version + 1
    ) THEN
      RAISE EXCEPTION 'a frozen transcript permits only one-way withdrawal'
        USING ERRCODE = '23514', CONSTRAINT = 'cam_v2_transcripts_frozen_withdrawal_only';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS cam_v2_source_assets_handoff_immutable ON mmc.cam_v2_source_assets;
CREATE TRIGGER cam_v2_source_assets_handoff_immutable
BEFORE UPDATE ON mmc.cam_v2_source_assets
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_enforce_handoff_artifact_immutable();
DROP TRIGGER IF EXISTS cam_v2_transcripts_handoff_immutable ON mmc.cam_v2_transcript_versions;
CREATE TRIGGER cam_v2_transcripts_handoff_immutable
BEFORE UPDATE ON mmc.cam_v2_transcript_versions
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_enforce_handoff_artifact_immutable();

CREATE TABLE IF NOT EXISTS mmc.cam_v2_evidence_spans (
  id uuid NOT NULL DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, environment text NOT NULL,
  job_id uuid NOT NULL, transcript_version_id uuid NOT NULL, assignment_id uuid, subject_link_id uuid,
  chunk_ordinal integer NOT NULL, normalized_char_start integer NOT NULL, normalized_char_end integer NOT NULL,
  start_milliseconds bigint, end_milliseconds bigint, speaker_digest text, exact_quote_digest text NOT NULL,
  verifier_version text NOT NULL, evidence_state text NOT NULL DEFAULT 'VALID',
  object_version bigint NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id), UNIQUE (tenant_id, environment, id),
  UNIQUE (tenant_id, environment, transcript_version_id, chunk_ordinal, normalized_char_start, normalized_char_end),
  FOREIGN KEY (tenant_id, environment) REFERENCES mmc.cam_v2_tenants(id, environment) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, environment, job_id) REFERENCES mmc.cam_v2_jobs(tenant_id, environment, id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, environment, job_id, assignment_id, subject_link_id)
    REFERENCES mmc.cam_v2_jobs(tenant_id, environment, id, assignment_id, subject_link_id) ON DELETE RESTRICT,
  CONSTRAINT cam_v2_evidence_transcript_assignment_subject_fk
    FOREIGN KEY (tenant_id, environment, transcript_version_id, assignment_id, subject_link_id)
    REFERENCES mmc.cam_v2_transcript_versions(tenant_id, environment, id, assignment_id, subject_link_id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, environment, assignment_id) REFERENCES mmc.cam_v2_assignments(tenant_id, environment, id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, environment, subject_link_id) REFERENCES mmc.cam_v2_subject_links(tenant_id, environment, id) ON DELETE RESTRICT,
  CHECK ((assignment_id IS NULL) = (subject_link_id IS NULL)), CHECK (chunk_ordinal >= 0),
  CHECK (normalized_char_start >= 0 AND normalized_char_end > normalized_char_start),
  CHECK ((start_milliseconds IS NULL) = (end_milliseconds IS NULL)),
  CHECK (speaker_digest IS NULL OR speaker_digest ~ '^[a-f0-9]{64}$'),
  CHECK (exact_quote_digest ~ '^[a-f0-9]{64}$'),
  CHECK (start_milliseconds IS NULL OR (start_milliseconds >= 0 AND end_milliseconds >= start_milliseconds)),
  CHECK (evidence_state IN ('VALID', 'INVALID', 'SUPERSEDED')), CHECK (object_version > 0)
);

CREATE TABLE IF NOT EXISTS mmc.cam_v2_analysis_runs (
  id uuid NOT NULL DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, environment text NOT NULL,
  job_id uuid NOT NULL, authority_grant_id uuid NOT NULL, assignment_id uuid NOT NULL, subject_link_id uuid NOT NULL,
  transcript_version_id uuid NOT NULL, policy_version_id uuid NOT NULL,
  policy_kind text NOT NULL DEFAULT 'AI_TRANSFER',
  provider_digest text NOT NULL, model_digest text NOT NULL, prompt_digest text NOT NULL,
  analysis_state text NOT NULL DEFAULT 'QUEUED', started_at timestamptz, completed_at timestamptz,
  result_digest text, object_version bigint NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id), UNIQUE (tenant_id, environment, id), UNIQUE (tenant_id, environment, job_id),
  UNIQUE (tenant_id, environment, id, job_id, assignment_id, subject_link_id),
  FOREIGN KEY (tenant_id, environment) REFERENCES mmc.cam_v2_tenants(id, environment) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, environment, job_id) REFERENCES mmc.cam_v2_jobs(tenant_id, environment, id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, environment, job_id, assignment_id, subject_link_id)
    REFERENCES mmc.cam_v2_jobs(tenant_id, environment, id, assignment_id, subject_link_id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, environment, job_id, authority_grant_id, assignment_id, subject_link_id)
    REFERENCES mmc.cam_v2_jobs(tenant_id, environment, id, authority_grant_id, assignment_id, subject_link_id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, environment, authority_grant_id) REFERENCES mmc.cam_v2_authority_grants(tenant_id, environment, id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, environment, assignment_id) REFERENCES mmc.cam_v2_assignments(tenant_id, environment, id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, environment, subject_link_id) REFERENCES mmc.cam_v2_subject_links(tenant_id, environment, id) ON DELETE RESTRICT,
  CONSTRAINT cam_v2_analysis_transcript_assignment_subject_fk
    FOREIGN KEY (tenant_id, environment, transcript_version_id, assignment_id, subject_link_id)
    REFERENCES mmc.cam_v2_transcript_versions(tenant_id, environment, id, assignment_id, subject_link_id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, environment, policy_version_id) REFERENCES mmc.cam_v2_policy_versions(tenant_id, environment, id) ON DELETE RESTRICT,
  CONSTRAINT cam_v2_analysis_policy_kind_fk
    FOREIGN KEY (tenant_id, environment, policy_version_id, policy_kind)
    REFERENCES mmc.cam_v2_policy_versions(tenant_id, environment, id, policy_kind) ON DELETE RESTRICT,
  CHECK (analysis_state IN ('QUEUED', 'RUNNING', 'PROPOSED', 'PARTIAL', 'FAILED', 'CANCELLED')),
  CHECK (provider_digest ~ '^[a-f0-9]{64}$'),
  CHECK (model_digest ~ '^[a-f0-9]{64}$'),
  CHECK (prompt_digest ~ '^[a-f0-9]{64}$'),
  CHECK (result_digest IS NULL OR result_digest ~ '^[a-f0-9]{64}$'),
  CHECK (policy_kind = 'AI_TRANSFER'),
  CHECK (completed_at IS NULL OR started_at IS NULL OR completed_at >= started_at), CHECK (object_version > 0)
);

CREATE TABLE IF NOT EXISTS mmc.cam_v2_ai_proposals (
  id uuid NOT NULL DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, environment text NOT NULL,
  job_id uuid NOT NULL, analysis_run_id uuid NOT NULL, assignment_id uuid NOT NULL, subject_link_id uuid NOT NULL,
  proposal_kind text NOT NULL, ordinal integer NOT NULL, stable_proposal_digest text NOT NULL,
  proposed_text text NOT NULL, confidence_method text NOT NULL, confidence_value numeric(5,4),
  evidence_state text NOT NULL DEFAULT 'UNCHECKED', review_state text NOT NULL DEFAULT 'REVIEW_REQUIRED',
  object_version bigint NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id), UNIQUE (tenant_id, environment, id),
  UNIQUE (tenant_id, environment, id, assignment_id, subject_link_id),
  UNIQUE (tenant_id, environment, analysis_run_id, proposal_kind, ordinal, stable_proposal_digest),
  FOREIGN KEY (tenant_id, environment) REFERENCES mmc.cam_v2_tenants(id, environment) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, environment, job_id) REFERENCES mmc.cam_v2_jobs(tenant_id, environment, id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, environment, job_id, assignment_id, subject_link_id)
    REFERENCES mmc.cam_v2_jobs(tenant_id, environment, id, assignment_id, subject_link_id) ON DELETE RESTRICT,
  CONSTRAINT cam_v2_proposals_analysis_job_assignment_subject_fk
    FOREIGN KEY (tenant_id, environment, analysis_run_id, job_id, assignment_id, subject_link_id)
    REFERENCES mmc.cam_v2_analysis_runs(tenant_id, environment, id, job_id, assignment_id, subject_link_id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, environment, assignment_id) REFERENCES mmc.cam_v2_assignments(tenant_id, environment, id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, environment, subject_link_id) REFERENCES mmc.cam_v2_subject_links(tenant_id, environment, id) ON DELETE RESTRICT,
  CHECK (proposal_kind IN ('FACT', 'RECOMMENDATION', 'OPEN_LOOP', 'TASK_CANDIDATE')),
  CHECK (stable_proposal_digest ~ '^[a-f0-9]{64}$'),
  CHECK (ordinal >= 0), CHECK (confidence_value IS NULL OR (confidence_value >= 0 AND confidence_value <= 1)),
  CHECK (evidence_state IN ('UNCHECKED', 'SUPPORTED', 'CONTRADICTED', 'INSUFFICIENT', 'INVALID')),
  CHECK (review_state IN ('REVIEW_REQUIRED', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'SUPERSEDED', 'REVOKED')),
  CHECK (object_version > 0)
);

CREATE TABLE IF NOT EXISTS mmc.cam_v2_review_decisions (
  id uuid NOT NULL DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, environment text NOT NULL,
  assignment_id uuid NOT NULL, subject_link_id uuid NOT NULL, proposal_id uuid NOT NULL,
  reviewer_principal_id uuid NOT NULL, decision text NOT NULL, decision_reason text NOT NULL,
  exact_input_digest text NOT NULL, exact_output_digest text, policy_version_id uuid NOT NULL,
  policy_kind text NOT NULL DEFAULT 'EVIDENCE',
  supersedes_id uuid, object_version bigint NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id), UNIQUE (tenant_id, environment, id),
  UNIQUE (tenant_id, environment, id, proposal_id, assignment_id, subject_link_id),
  UNIQUE (tenant_id, environment, proposal_id, reviewer_principal_id, exact_input_digest),
  FOREIGN KEY (tenant_id, environment) REFERENCES mmc.cam_v2_tenants(id, environment) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, environment, assignment_id) REFERENCES mmc.cam_v2_assignments(tenant_id, environment, id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, environment, subject_link_id) REFERENCES mmc.cam_v2_subject_links(tenant_id, environment, id) ON DELETE RESTRICT,
  CONSTRAINT cam_v2_reviews_proposal_assignment_subject_fk
    FOREIGN KEY (tenant_id, environment, proposal_id, assignment_id, subject_link_id)
    REFERENCES mmc.cam_v2_ai_proposals(tenant_id, environment, id, assignment_id, subject_link_id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, environment, reviewer_principal_id) REFERENCES mmc.cam_v2_principals(tenant_id, environment, id) ON DELETE RESTRICT,
  CONSTRAINT cam_v2_reviews_exact_assignment_mentor_fk
    FOREIGN KEY (tenant_id, environment, assignment_id, subject_link_id, reviewer_principal_id)
    REFERENCES mmc.cam_v2_assignments(
      tenant_id, environment, id, subject_link_id, mentor_principal_id
    ) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, environment, policy_version_id) REFERENCES mmc.cam_v2_policy_versions(tenant_id, environment, id) ON DELETE RESTRICT,
  CONSTRAINT cam_v2_reviews_policy_kind_fk
    FOREIGN KEY (tenant_id, environment, policy_version_id, policy_kind)
    REFERENCES mmc.cam_v2_policy_versions(tenant_id, environment, id, policy_kind) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, environment, supersedes_id, proposal_id, assignment_id, subject_link_id)
    REFERENCES mmc.cam_v2_review_decisions(tenant_id, environment, id, proposal_id, assignment_id, subject_link_id) ON DELETE RESTRICT,
  CHECK (decision IN ('ACCEPT', 'REJECT', 'DEFER', 'REQUEST_EVIDENCE')),
  CHECK (exact_input_digest ~ '^[a-f0-9]{64}$'),
  CHECK (exact_output_digest IS NULL OR exact_output_digest ~ '^[a-f0-9]{64}$'),
  CHECK (policy_kind = 'EVIDENCE'),
  CHECK (object_version > 0)
);

-- MATCH SIMPLE intentionally supports optional global scope, so these
-- null-safe provenance triggers prevent a global child from pointing at a
-- scoped parent (or vice versa) when any composite FK column is NULL.
CREATE OR REPLACE FUNCTION mmc.cam_v2_enforce_optional_provenance_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, mmc
SET row_security = off
AS $$
BEGIN
  IF TG_TABLE_NAME = 'cam_v2_jobs' THEN
    IF NOT EXISTS (
      SELECT 1 FROM mmc.cam_v2_authority_grants AS authority
      WHERE authority.tenant_id = NEW.tenant_id
        AND authority.environment = NEW.environment
        AND authority.id = NEW.authority_grant_id
        AND authority.assignment_id IS NOT DISTINCT FROM NEW.assignment_id
        AND authority.subject_link_id IS NOT DISTINCT FROM NEW.subject_link_id
    ) THEN
      RAISE EXCEPTION 'job scope does not match its authority grant'
        USING ERRCODE = '23503', CONSTRAINT = 'cam_v2_jobs_authority_scope_exact';
    END IF;
  ELSIF TG_TABLE_NAME = 'cam_v2_source_assets' THEN
    IF NOT EXISTS (
      SELECT 1 FROM mmc.cam_v2_jobs AS job
      WHERE job.tenant_id = NEW.tenant_id
        AND job.environment = NEW.environment
        AND job.id = NEW.job_id
        AND job.authority_grant_id = NEW.authority_grant_id
        AND job.assignment_id IS NOT DISTINCT FROM NEW.assignment_id
        AND job.subject_link_id IS NOT DISTINCT FROM NEW.subject_link_id
    ) THEN
      RAISE EXCEPTION 'source asset scope does not match its creator job'
        USING ERRCODE = '23503', CONSTRAINT = 'cam_v2_source_assets_job_scope_exact';
    END IF;
  ELSIF TG_TABLE_NAME = 'cam_v2_transcript_versions' THEN
    IF NOT EXISTS (
      SELECT 1 FROM mmc.cam_v2_jobs AS job
      WHERE job.tenant_id = NEW.tenant_id
        AND job.environment = NEW.environment
        AND job.id = NEW.job_id
        AND job.job_kind = 'TRANSCRIPT_PROCESSING'
        AND job.authority_grant_id = NEW.authority_grant_id
        AND job.assignment_id IS NOT DISTINCT FROM NEW.assignment_id
        AND job.subject_link_id IS NOT DISTINCT FROM NEW.subject_link_id
    ) OR NOT EXISTS (
      SELECT 1 FROM mmc.cam_v2_source_assets AS source
      WHERE source.tenant_id = NEW.tenant_id
        AND source.environment = NEW.environment
        AND source.id = NEW.source_asset_id
        AND source.assignment_id IS NOT DISTINCT FROM NEW.assignment_id
        AND source.subject_link_id IS NOT DISTINCT FROM NEW.subject_link_id
    ) OR (
      NEW.supersedes_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM mmc.cam_v2_transcript_versions AS prior
        WHERE prior.tenant_id = NEW.tenant_id
          AND prior.environment = NEW.environment
          AND prior.id = NEW.supersedes_id
          AND prior.assignment_id IS NOT DISTINCT FROM NEW.assignment_id
          AND prior.subject_link_id IS NOT DISTINCT FROM NEW.subject_link_id
      )
    ) OR NOT EXISTS (
      SELECT 1 FROM mmc.cam_v2_job_inputs AS input
      WHERE input.tenant_id = NEW.tenant_id
        AND input.environment = NEW.environment
        AND input.consumer_job_id = NEW.job_id
        AND input.assignment_id = NEW.assignment_id
        AND input.subject_link_id = NEW.subject_link_id
        AND input.input_kind = 'SOURCE_ASSET'
        AND input.source_asset_id = NEW.source_asset_id
    ) THEN
      RAISE EXCEPTION 'transcript provenance scope is inconsistent'
        USING ERRCODE = '23503', CONSTRAINT = 'cam_v2_transcripts_provenance_scope_exact';
    END IF;
  ELSIF TG_TABLE_NAME = 'cam_v2_evidence_spans' THEN
    IF NOT EXISTS (
      SELECT 1 FROM mmc.cam_v2_jobs AS job
      WHERE job.tenant_id = NEW.tenant_id
        AND job.environment = NEW.environment
        AND job.id = NEW.job_id
        AND job.job_kind = 'AI_ANALYSIS'
        AND job.assignment_id IS NOT DISTINCT FROM NEW.assignment_id
        AND job.subject_link_id IS NOT DISTINCT FROM NEW.subject_link_id
    ) OR NOT EXISTS (
      SELECT 1 FROM mmc.cam_v2_transcript_versions AS transcript
      WHERE transcript.tenant_id = NEW.tenant_id
        AND transcript.environment = NEW.environment
        AND transcript.id = NEW.transcript_version_id
        AND transcript.assignment_id IS NOT DISTINCT FROM NEW.assignment_id
        AND transcript.subject_link_id IS NOT DISTINCT FROM NEW.subject_link_id
    ) OR NOT EXISTS (
      SELECT 1 FROM mmc.cam_v2_job_inputs AS input
      WHERE input.tenant_id = NEW.tenant_id
        AND input.environment = NEW.environment
        AND input.consumer_job_id = NEW.job_id
        AND input.assignment_id = NEW.assignment_id
        AND input.subject_link_id = NEW.subject_link_id
        AND input.input_kind = 'TRANSCRIPT_VERSION'
        AND input.transcript_version_id = NEW.transcript_version_id
    ) THEN
      RAISE EXCEPTION 'evidence provenance scope is inconsistent'
        USING ERRCODE = '23503', CONSTRAINT = 'cam_v2_evidence_provenance_scope_exact';
    END IF;
  ELSIF TG_TABLE_NAME = 'cam_v2_analysis_runs' THEN
    IF NOT EXISTS (
      SELECT 1 FROM mmc.cam_v2_jobs AS job
      WHERE job.tenant_id = NEW.tenant_id
        AND job.environment = NEW.environment
        AND job.id = NEW.job_id
        AND job.job_kind = 'AI_ANALYSIS'
        AND job.authority_grant_id = NEW.authority_grant_id
        AND job.assignment_id = NEW.assignment_id
        AND job.subject_link_id = NEW.subject_link_id
    ) OR NOT EXISTS (
      SELECT 1 FROM mmc.cam_v2_job_inputs AS input
      WHERE input.tenant_id = NEW.tenant_id
        AND input.environment = NEW.environment
        AND input.consumer_job_id = NEW.job_id
        AND input.assignment_id = NEW.assignment_id
        AND input.subject_link_id = NEW.subject_link_id
        AND input.input_kind = 'TRANSCRIPT_VERSION'
        AND input.transcript_version_id = NEW.transcript_version_id
    ) THEN
      RAISE EXCEPTION 'analysis provenance scope is inconsistent'
        USING ERRCODE = '23503', CONSTRAINT = 'cam_v2_analysis_provenance_scope_exact';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS cam_v2_jobs_optional_scope_exact ON mmc.cam_v2_jobs;
CREATE TRIGGER cam_v2_jobs_optional_scope_exact
BEFORE INSERT OR UPDATE ON mmc.cam_v2_jobs
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_enforce_optional_provenance_scope();
DROP TRIGGER IF EXISTS cam_v2_source_assets_optional_scope_exact ON mmc.cam_v2_source_assets;
CREATE TRIGGER cam_v2_source_assets_optional_scope_exact
BEFORE INSERT OR UPDATE ON mmc.cam_v2_source_assets
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_enforce_optional_provenance_scope();
DROP TRIGGER IF EXISTS cam_v2_transcripts_optional_scope_exact ON mmc.cam_v2_transcript_versions;
CREATE TRIGGER cam_v2_transcripts_optional_scope_exact
BEFORE INSERT OR UPDATE ON mmc.cam_v2_transcript_versions
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_enforce_optional_provenance_scope();
DROP TRIGGER IF EXISTS cam_v2_evidence_optional_scope_exact ON mmc.cam_v2_evidence_spans;
CREATE TRIGGER cam_v2_evidence_optional_scope_exact
BEFORE INSERT OR UPDATE ON mmc.cam_v2_evidence_spans
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_enforce_optional_provenance_scope();
DROP TRIGGER IF EXISTS cam_v2_analysis_optional_scope_exact ON mmc.cam_v2_analysis_runs;
CREATE TRIGGER cam_v2_analysis_optional_scope_exact
BEFORE INSERT OR UPDATE ON mmc.cam_v2_analysis_runs
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_enforce_optional_provenance_scope();

-- Separately governed exact-student publication plane.
CREATE TABLE IF NOT EXISTS mmc.cam_v2_publications (
  id uuid NOT NULL DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, environment text NOT NULL,
  subject_link_id uuid NOT NULL, authoring_assignment_id uuid NOT NULL,
  authority_grant_id uuid NOT NULL, policy_version_id uuid NOT NULL,
  policy_kind text NOT NULL DEFAULT 'PUBLICATION',
  approved_by_principal_id uuid, publication_version integer NOT NULL, publication_state text NOT NULL DEFAULT 'DRAFT',
  -- A deferred unique key, rather than only a count in a deferred trigger,
  -- makes the one-readable-head invariant safe across concurrent transactions
  -- while still allowing predecessor/successor changes in either statement order.
  readable_head_subject_link_id uuid GENERATED ALWAYS AS (
    CASE WHEN publication_state IN ('PUBLISHED', 'ACKNOWLEDGED', 'CORRECTED')
      THEN subject_link_id ELSE NULL END
  ) STORED,
  -- projection_digest is the JS authority digest over the exact student wire
  -- payload. item_set_digest is the independent SQL seal over persisted child
  -- attestations; they are intentionally different algorithms/materials.
  projection_digest text NOT NULL, item_set_digest text,
  published_at timestamptz, expires_at timestamptz, withdrawn_at timestamptz,
  supersedes_id uuid, supersedes_version integer, supersedes_projection_digest text,
  object_version bigint NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id), UNIQUE (tenant_id, environment, id),
  UNIQUE (tenant_id, environment, id, subject_link_id),
  UNIQUE (tenant_id, environment, id, subject_link_id, publication_version, projection_digest),
  UNIQUE (tenant_id, environment, subject_link_id, publication_version),
  UNIQUE (tenant_id, environment, supersedes_id),
  CONSTRAINT cam_v2_publications_one_readable_head
    UNIQUE (tenant_id, environment, readable_head_subject_link_id)
    DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY (tenant_id, environment) REFERENCES mmc.cam_v2_tenants(id, environment) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, environment, subject_link_id) REFERENCES mmc.cam_v2_subject_links(tenant_id, environment, id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, environment, authoring_assignment_id) REFERENCES mmc.cam_v2_assignments(tenant_id, environment, id) ON DELETE RESTRICT,
  CONSTRAINT cam_v2_publications_assignment_subject_fk
    FOREIGN KEY (tenant_id, environment, authoring_assignment_id, subject_link_id)
    REFERENCES mmc.cam_v2_assignments(tenant_id, environment, id, subject_link_id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, environment, authority_grant_id)
    REFERENCES mmc.cam_v2_authority_grants(tenant_id, environment, id) ON DELETE RESTRICT,
  CONSTRAINT cam_v2_publications_authority_scope_fk
    FOREIGN KEY (tenant_id, environment, authority_grant_id, authoring_assignment_id, subject_link_id)
    REFERENCES mmc.cam_v2_authority_grants(
      tenant_id, environment, id, assignment_id, subject_link_id
    ) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, environment, policy_version_id) REFERENCES mmc.cam_v2_policy_versions(tenant_id, environment, id) ON DELETE RESTRICT,
  CONSTRAINT cam_v2_publications_policy_kind_fk
    FOREIGN KEY (tenant_id, environment, policy_version_id, policy_kind)
    REFERENCES mmc.cam_v2_policy_versions(tenant_id, environment, id, policy_kind) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, environment, approved_by_principal_id) REFERENCES mmc.cam_v2_principals(tenant_id, environment, id) ON DELETE RESTRICT,
  FOREIGN KEY (
    tenant_id, environment, supersedes_id, subject_link_id,
    supersedes_version, supersedes_projection_digest
  ) REFERENCES mmc.cam_v2_publications(
    tenant_id, environment, id, subject_link_id, publication_version, projection_digest
  ) ON DELETE RESTRICT,
  CHECK (publication_version > 0),
  CHECK (projection_digest ~ '^[a-f0-9]{64}$'),
  CHECK (item_set_digest IS NULL OR item_set_digest ~ '^[a-f0-9]{64}$'),
  CHECK (supersedes_id IS NULL OR supersedes_id <> id),
  CHECK (
    (publication_version = 1 AND supersedes_id IS NULL
      AND supersedes_version IS NULL AND supersedes_projection_digest IS NULL
      AND publication_state <> 'CORRECTED')
    OR (publication_version > 1 AND supersedes_id IS NOT NULL
      AND supersedes_version = publication_version - 1
      AND supersedes_projection_digest ~ '^[a-f0-9]{64}$')
  ),
  CHECK (policy_kind = 'PUBLICATION'),
  CHECK (publication_state IN ('DRAFT', 'APPROVED', 'PUBLISHED', 'ACKNOWLEDGED', 'CORRECTED', 'SUPERSEDED', 'WITHDRAWN', 'EXPIRED')),
  CHECK ((publication_state IN ('DRAFT', 'APPROVED')) = (item_set_digest IS NULL)),
  CHECK (
    (publication_state = 'DRAFT' AND approved_by_principal_id IS NULL
      AND published_at IS NULL AND withdrawn_at IS NULL)
    OR (publication_state = 'APPROVED' AND approved_by_principal_id IS NOT NULL
      AND published_at IS NULL AND withdrawn_at IS NULL)
    OR (publication_state IN ('PUBLISHED', 'ACKNOWLEDGED', 'CORRECTED', 'SUPERSEDED')
      AND approved_by_principal_id IS NOT NULL AND published_at IS NOT NULL
      AND withdrawn_at IS NULL)
    OR (publication_state = 'WITHDRAWN' AND approved_by_principal_id IS NOT NULL
      AND published_at IS NOT NULL AND withdrawn_at IS NOT NULL
      AND withdrawn_at >= published_at)
    OR (publication_state = 'EXPIRED' AND approved_by_principal_id IS NOT NULL
      AND published_at IS NOT NULL AND expires_at IS NOT NULL
      AND withdrawn_at IS NULL)
  ),
  CHECK (expires_at IS NULL OR published_at IS NULL OR expires_at > published_at), CHECK (object_version > 0)
);

CREATE TABLE IF NOT EXISTS mmc.cam_v2_publication_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, environment text NOT NULL,
  publication_id uuid NOT NULL, subject_link_id uuid NOT NULL, item_kind text NOT NULL,
  source_object_kind text NOT NULL, source_object_id uuid NOT NULL, source_object_version bigint NOT NULL,
  -- Canonical JSONB is a bounded discriminated payload, not an arbitrary
  -- extension bag. The trigger below enforces exact keys and field types for
  -- every JS publication item kind and recomputes its durable byte digest.
  item_payload jsonb NOT NULL,
  item_payload_digest text NOT NULL,
  source_version_hash text NOT NULL,
  replaces_publication_id uuid,
  replaces_publication_item_id uuid,
  replaces_source_version_hash text,
  safe_plain_text text NOT NULL, due_at timestamptz, item_state text NOT NULL DEFAULT 'APPROVED',
  object_version bigint NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id), UNIQUE (tenant_id, environment, id),
  UNIQUE (tenant_id, environment, id, publication_id, subject_link_id, source_version_hash),
  UNIQUE (tenant_id, environment, publication_id, source_object_kind, source_object_id),
  FOREIGN KEY (tenant_id, environment) REFERENCES mmc.cam_v2_tenants(id, environment) ON DELETE RESTRICT,
  CONSTRAINT cam_v2_publication_items_publication_subject_fk
    FOREIGN KEY (tenant_id, environment, publication_id, subject_link_id)
    REFERENCES mmc.cam_v2_publications(tenant_id, environment, id, subject_link_id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, environment, subject_link_id) REFERENCES mmc.cam_v2_subject_links(tenant_id, environment, id) ON DELETE RESTRICT,
  FOREIGN KEY (
    tenant_id, environment, replaces_publication_item_id,
    replaces_publication_id, subject_link_id, replaces_source_version_hash
  ) REFERENCES mmc.cam_v2_publication_items(
    tenant_id, environment, id, publication_id, subject_link_id, source_version_hash
  ) ON DELETE RESTRICT,
  CHECK (item_kind IN ('TASK', 'MILESTONE', 'PLAN_UPDATE', 'SESSION_SUMMARY', 'FEEDBACK', 'CORRECTION', 'WITHDRAWAL_NOTICE')),
  CHECK (source_object_kind IN ('TASK', 'MILESTONE', 'PLAN_UPDATE', 'GOAL', 'SESSION_SUMMARY', 'FEEDBACK', 'CORRECTION', 'WITHDRAWAL_DECISION')),
  CHECK (source_object_version > 0), CHECK (item_state IN ('APPROVED', 'PUBLISHED', 'WITHDRAWN', 'SUPERSEDED')),
  CHECK (jsonb_typeof(item_payload) = 'object'),
  CHECK (item_payload_digest ~ '^[a-f0-9]{64}$'),
  CHECK (source_version_hash ~ '^[a-f0-9]{64}$'),
  CHECK (replaces_publication_item_id IS NULL OR replaces_publication_item_id <> id),
  CHECK (
    (item_kind = 'CORRECTION' AND replaces_publication_id IS NOT NULL
      AND replaces_publication_item_id IS NOT NULL
      AND replaces_source_version_hash ~ '^[a-f0-9]{64}$')
    OR (item_kind <> 'CORRECTION' AND replaces_publication_id IS NULL
      AND replaces_publication_item_id IS NULL AND replaces_source_version_hash IS NULL)
  ),
  CHECK (safe_plain_text !~* '<[[:space:]]*/?[[:alpha:]]' AND safe_plain_text !~* '(https?|file)://'),
  CHECK (object_version > 0)
);

CREATE OR REPLACE FUNCTION mmc.cam_v2_enforce_publication_item_source()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, mmc
SET row_security = off
AS $$
DECLARE
  v_eligible boolean := false;
  v_expected_source_hash text;
  v_expected_payload_digest text;
  v_payload_keys text[];
  v_expected_keys text[];
  v_text_value text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM mmc.cam_v2_publications AS publication
    WHERE publication.tenant_id = NEW.tenant_id
      AND publication.environment = NEW.environment
      AND publication.id = NEW.publication_id
      AND publication.subject_link_id = NEW.subject_link_id
  ) THEN
    RAISE EXCEPTION 'publication item subject does not match its publication'
      USING ERRCODE = '23503', CONSTRAINT = 'cam_v2_publication_items_publication_subject_fk';
  END IF;

  -- jsonb::text is PostgreSQL's deterministic canonical serialization for the
  -- exact bounded payload. It is persisted so readback can detect any byte-
  -- semantic drift before reconstructing the JS contract.
  v_expected_payload_digest := encode(public.digest(NEW.item_payload::text, 'sha256'), 'hex');
  IF NEW.item_payload_digest IS DISTINCT FROM v_expected_payload_digest THEN
    RAISE EXCEPTION 'publication item payload digest mismatch'
      USING ERRCODE = '23514', CONSTRAINT = 'cam_v2_publication_items_payload_digest_exact';
  END IF;

  SELECT array_agg(key ORDER BY key) INTO v_payload_keys
  FROM jsonb_object_keys(NEW.item_payload) AS key;
  v_expected_keys := CASE NEW.item_kind
    WHEN 'TASK' THEN ARRAY['description', 'dueAt', 'owner', 'title']
    WHEN 'MILESTONE' THEN ARRAY['criteria', 'milestoneState', 'targetAt', 'title']
    WHEN 'PLAN_UPDATE' THEN ARRAY['effectiveAt', 'summary', 'title']
    WHEN 'SESSION_SUMMARY' THEN ARRAY['sessionAt', 'summary', 'title']
    WHEN 'FEEDBACK' THEN ARRAY['body', 'nextStep', 'title']
    WHEN 'CORRECTION' THEN ARRAY['changeSummary', 'correctedText', 'replacesPublicationItemId', 'title']
    WHEN 'WITHDRAWAL_NOTICE' THEN ARRAY['withdrawnAt']
    ELSE ARRAY[]::text[]
  END;
  IF v_payload_keys IS DISTINCT FROM v_expected_keys THEN
    RAISE EXCEPTION 'publication item payload keys do not match its discriminated kind'
      USING ERRCODE = '23514', CONSTRAINT = 'cam_v2_publication_items_payload_shape_exact';
  END IF;

  -- Every non-null scalar is a plain string. dueAt/targetAt are the only
  -- nullable fields. Text is bounded exactly to the JS contract's byte caps
  -- and rejects active content, URI/path material, controls, and bidi marks.
  IF EXISTS (
    SELECT 1 FROM jsonb_each(NEW.item_payload) AS field(key, value)
    WHERE jsonb_typeof(value) NOT IN ('string', 'null')
       OR (jsonb_typeof(value) = 'null' AND key NOT IN ('dueAt', 'targetAt'))
  ) THEN
    RAISE EXCEPTION 'publication item payload contains a non-string or unexpected null'
      USING ERRCODE = '23514', CONSTRAINT = 'cam_v2_publication_items_payload_types_exact';
  END IF;
  FOR v_text_value IN
    SELECT value #>> '{}' FROM jsonb_each(NEW.item_payload)
    WHERE jsonb_typeof(value) = 'string'
  LOOP
    IF v_text_value = '' OR octet_length(v_text_value) > 4096
       OR v_text_value IS DISTINCT FROM btrim(normalize(
         replace(replace(v_text_value, E'\r\n', E'\n'), E'\r', E'\n'), NFC
       ))
       OR v_text_value ~ '[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]'
       OR v_text_value ~ '[\u202A-\u202E\u2066-\u2069]'
       OR v_text_value ~* '<[[:space:]]*/?[[:alpha:]]'
       OR v_text_value ~* '(^|[^[:alnum:]])[[:alpha:]][[:alnum:]+.-]{1,31}:[^[:space:]]'
       OR v_text_value ~* '(^|[^[:alnum:]])([[:alnum:]-]+[.])+[[:alpha:]]{2,}(/[[:graph:]]*)?'
       OR v_text_value ~* '(^|[^[:alnum:]])Bearer[[:space:]]+[A-Za-z0-9._~+/=-]{8,}'
       OR v_text_value ~ '(^|[^[:alnum:]])sk-(proj-|svcacct-)?[A-Za-z0-9_-]{12,}'
       OR v_text_value ~ '(^|[^[:alnum:]])(gh[pousr]_[A-Za-z0-9_]{16,}|github_pat_[A-Za-z0-9_]{16,})'
       OR v_text_value ~* '(^|[^[:alnum:]])xox[baprs]-[A-Za-z0-9-]{10,}'
       OR v_text_value ~ '(^|[^[:alnum:]])AKIA[0-9A-Z]{16}([^[:alnum:]]|$)'
       OR v_text_value ~ '(^|[^[:alnum:]_])eyJ[A-Za-z0-9_-]{6,}[.]eyJ[A-Za-z0-9_-]{6,}[.][A-Za-z0-9_-]{8,}([^[:alnum:]_]|$)'
       OR v_text_value ~ '-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----'
       OR v_text_value ~* '(api[_ -]?key|access[_ -]?token|refresh[_ -]?token|secret|password|authorization)[[:space:]]*[:=][[:space:]]*["'']?[^[:space:]"'']{6,}'
       OR v_text_value ~ '(^|[[:space:]"''(:=])(\/|\.\.[\\/]|[A-Za-z]:\\)' THEN
      RAISE EXCEPTION 'publication item payload contains unsafe or overlong text'
        USING ERRCODE = '23514', CONSTRAINT = 'cam_v2_publication_items_payload_plain_text';
    END IF;
  END LOOP;
  IF octet_length(coalesce(NEW.item_payload ->> 'title', 'x')) > 160
     OR (NEW.item_kind = 'PLAN_UPDATE'
       AND octet_length(NEW.item_payload ->> 'summary') > 2048)
     OR (NEW.item_kind = 'SESSION_SUMMARY'
       AND octet_length(NEW.item_payload ->> 'summary') > 4096)
     OR octet_length(coalesce(NEW.item_payload ->> 'nextStep', 'x')) > 2048
     OR octet_length(coalesce(NEW.item_payload ->> 'changeSummary', 'x')) > 2048
     OR coalesce(NEW.item_payload ->> 'owner', 'STUDENT') NOT IN ('STUDENT', 'MENTOR', 'SHARED')
     OR coalesce(NEW.item_payload ->> 'milestoneState', 'PLANNED') NOT IN ('PLANNED', 'EVIDENCE_PENDING', 'MET', 'NOT_MET', 'BLOCKED')
     OR EXISTS (
       SELECT 1 FROM jsonb_each_text(NEW.item_payload) AS field(key, value)
      WHERE key IN ('dueAt', 'targetAt', 'effectiveAt', 'sessionAt', 'withdrawnAt')
         AND NOT mmc.cam_v2_is_valid_rfc3339(value)
     ) THEN
    RAISE EXCEPTION 'publication item payload violates its bounded field contract'
      USING ERRCODE = '23514', CONSTRAINT = 'cam_v2_publication_items_payload_fields_exact';
  END IF;
  IF NEW.item_kind = 'CORRECTION' AND (
    (NEW.item_payload ->> 'replacesPublicationItemId')
      !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89aAbB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
    OR (NEW.item_payload ->> 'replacesPublicationItemId')::uuid
      IS DISTINCT FROM NEW.replaces_publication_item_id
    OR NOT EXISTS (
      SELECT 1
      FROM mmc.cam_v2_publications AS publication
      JOIN mmc.cam_v2_publication_items AS prior
        ON prior.tenant_id = publication.tenant_id
       AND prior.environment = publication.environment
       AND prior.publication_id = publication.supersedes_id
       AND prior.subject_link_id = publication.subject_link_id
      WHERE publication.tenant_id = NEW.tenant_id
        AND publication.environment = NEW.environment
        AND publication.id = NEW.publication_id
        AND publication.supersedes_id = NEW.replaces_publication_id
        AND prior.id = NEW.replaces_publication_item_id
        AND prior.source_version_hash = NEW.replaces_source_version_hash
    )
  ) THEN
    RAISE EXCEPTION 'correction must replace an exact item from the attested predecessor publication'
      USING ERRCODE = '23514', CONSTRAINT = 'cam_v2_publication_items_correction_predecessor_exact';
  END IF;

  -- These legacy read-optimized columns are deterministic projections only;
  -- callers cannot create a second authority that contradicts item_payload.
  NEW.safe_plain_text := CASE NEW.item_kind
    WHEN 'TASK' THEN NEW.item_payload ->> 'description'
    WHEN 'MILESTONE' THEN NEW.item_payload ->> 'criteria'
    WHEN 'PLAN_UPDATE' THEN NEW.item_payload ->> 'summary'
    WHEN 'SESSION_SUMMARY' THEN NEW.item_payload ->> 'summary'
    WHEN 'FEEDBACK' THEN NEW.item_payload ->> 'body'
    WHEN 'CORRECTION' THEN NEW.item_payload ->> 'correctedText'
    WHEN 'WITHDRAWAL_NOTICE' THEN NEW.item_payload ->> 'withdrawnAt'
  END;
  NEW.due_at := CASE
    WHEN NEW.item_kind = 'TASK' AND NEW.item_payload ->> 'dueAt' IS NOT NULL
      THEN (NEW.item_payload ->> 'dueAt')::timestamptz
    WHEN NEW.item_kind = 'MILESTONE' AND NEW.item_payload ->> 'targetAt' IS NOT NULL
      THEN (NEW.item_payload ->> 'targetAt')::timestamptz
    ELSE NULL
  END;

  CASE NEW.source_object_kind
    WHEN 'SESSION_SUMMARY' THEN
      SELECT NEW.item_kind = 'SESSION_SUMMARY' AND EXISTS (
        SELECT 1
        FROM mmc.cam_v2_sessions AS source
        JOIN mmc.cam_v2_publications AS publication
          ON publication.tenant_id = NEW.tenant_id
         AND publication.environment = NEW.environment
         AND publication.id = NEW.publication_id
         AND publication.subject_link_id = NEW.subject_link_id
        WHERE source.tenant_id = NEW.tenant_id
          AND source.environment = NEW.environment
          AND source.id = NEW.source_object_id
          AND source.object_version = NEW.source_object_version
          AND source.assignment_id = publication.authoring_assignment_id
          AND source.subject_link_id = NEW.subject_link_id
          AND source.session_state = 'CLOSED'
          AND source.sensitivity = 'NORMAL'
      ) INTO v_eligible;
      SELECT mmc.cam_v2_sha256_jsonb(jsonb_build_object(
        'sourceKind', 'SESSION_SUMMARY', 'id', source.id,
        'objectVersion', source.object_version,
        'assignmentId', source.assignment_id, 'subjectLinkId', source.subject_link_id,
        'mentorPrincipalId', source.mentor_principal_id,
        'sessionState', source.session_state, 'purpose', source.purpose,
        'startedAtEpochMicroseconds', mmc.cam_v2_epoch_microseconds(source.started_at),
        'endedAtEpochMicroseconds', mmc.cam_v2_epoch_microseconds(source.ended_at),
        'sensitivity', source.sensitivity
      ))
      INTO v_expected_source_hash FROM mmc.cam_v2_sessions AS source
      WHERE source.tenant_id = NEW.tenant_id AND source.environment = NEW.environment
        AND source.id = NEW.source_object_id AND source.object_version = NEW.source_object_version;
    WHEN 'TASK' THEN
      SELECT NEW.item_kind = 'TASK' AND EXISTS (
        SELECT 1
        FROM mmc.cam_v2_tasks AS source
        JOIN mmc.cam_v2_publications AS publication
          ON publication.tenant_id = NEW.tenant_id
         AND publication.environment = NEW.environment
         AND publication.id = NEW.publication_id
         AND publication.subject_link_id = NEW.subject_link_id
        WHERE source.tenant_id = NEW.tenant_id
          AND source.environment = NEW.environment
          AND source.id = NEW.source_object_id
          AND source.object_version = NEW.source_object_version
          AND source.assignment_id = publication.authoring_assignment_id
          AND source.subject_link_id = NEW.subject_link_id
          AND source.review_state = 'APPROVED'
          AND source.sensitivity = 'NORMAL'
          AND source.origin IN ('OBSERVED', 'IMPORTED', 'USER_REPORTED', 'DETERMINISTIC', 'HUMAN_JUDGMENT')
          AND source.task_state NOT IN ('DRAFT', 'CANCELLED', 'SUPERSEDED')
      ) INTO v_eligible;
      SELECT mmc.cam_v2_sha256_jsonb(jsonb_build_object(
        'sourceKind', 'TASK', 'id', source.id, 'objectVersion', source.object_version,
        'assignmentId', source.assignment_id, 'subjectLinkId', source.subject_link_id,
        'sessionId', source.session_id, 'ownerPrincipalId', source.owner_principal_id,
        'taskState', source.task_state, 'title', source.title,
        'dueAtEpochMicroseconds', mmc.cam_v2_epoch_microseconds(source.due_at),
        'origin', source.origin, 'sensitivity', source.sensitivity,
        'reviewState', source.review_state
      ))
      INTO v_expected_source_hash FROM mmc.cam_v2_tasks AS source
      WHERE source.tenant_id = NEW.tenant_id AND source.environment = NEW.environment
        AND source.id = NEW.source_object_id AND source.object_version = NEW.source_object_version;
    WHEN 'GOAL' THEN
      SELECT NEW.item_kind = 'PLAN_UPDATE' AND EXISTS (
        SELECT 1
        FROM mmc.cam_v2_goals AS source
        JOIN mmc.cam_v2_publications AS publication
          ON publication.tenant_id = NEW.tenant_id
         AND publication.environment = NEW.environment
         AND publication.id = NEW.publication_id
         AND publication.subject_link_id = NEW.subject_link_id
        WHERE source.tenant_id = NEW.tenant_id
          AND source.environment = NEW.environment
          AND source.id = NEW.source_object_id
          AND source.object_version = NEW.source_object_version
          AND source.assignment_id = publication.authoring_assignment_id
          AND source.subject_link_id = NEW.subject_link_id
          AND source.goal_state IN ('AGREED', 'ACTIVE', 'PAUSED', 'ACHIEVED')
      ) INTO v_eligible;
      SELECT mmc.cam_v2_sha256_jsonb(jsonb_build_object(
        'sourceKind', 'GOAL', 'id', source.id, 'objectVersion', source.object_version,
        'assignmentId', source.assignment_id, 'subjectLinkId', source.subject_link_id,
        'ownerPrincipalId', source.owner_principal_id, 'goalState', source.goal_state,
        'title', source.title,
        'reviewAtEpochMicroseconds', mmc.cam_v2_epoch_microseconds(source.review_at)
      ))
      INTO v_expected_source_hash FROM mmc.cam_v2_goals AS source
      WHERE source.tenant_id = NEW.tenant_id AND source.environment = NEW.environment
        AND source.id = NEW.source_object_id AND source.object_version = NEW.source_object_version;
    WHEN 'PLAN_UPDATE' THEN
      SELECT NEW.item_kind = 'PLAN_UPDATE' AND EXISTS (
        SELECT 1
        FROM mmc.cam_v2_goals AS source
        JOIN mmc.cam_v2_publications AS publication
          ON publication.tenant_id = NEW.tenant_id
         AND publication.environment = NEW.environment
         AND publication.id = NEW.publication_id
         AND publication.subject_link_id = NEW.subject_link_id
        WHERE source.tenant_id = NEW.tenant_id
          AND source.environment = NEW.environment
          AND source.id = NEW.source_object_id
          AND source.object_version = NEW.source_object_version
          AND source.assignment_id = publication.authoring_assignment_id
          AND source.subject_link_id = NEW.subject_link_id
          AND source.goal_state IN ('AGREED', 'ACTIVE', 'PAUSED', 'ACHIEVED')
      ) INTO v_eligible;
      SELECT mmc.cam_v2_sha256_jsonb(jsonb_build_object(
        'sourceKind', 'PLAN_UPDATE', 'id', source.id, 'objectVersion', source.object_version,
        'assignmentId', source.assignment_id, 'subjectLinkId', source.subject_link_id,
        'ownerPrincipalId', source.owner_principal_id, 'goalState', source.goal_state,
        'title', source.title,
        'reviewAtEpochMicroseconds', mmc.cam_v2_epoch_microseconds(source.review_at)
      ))
      INTO v_expected_source_hash FROM mmc.cam_v2_goals AS source
      WHERE source.tenant_id = NEW.tenant_id AND source.environment = NEW.environment
        AND source.id = NEW.source_object_id AND source.object_version = NEW.source_object_version;
    WHEN 'MILESTONE' THEN
      SELECT NEW.item_kind = 'MILESTONE' AND EXISTS (
        SELECT 1
        FROM mmc.cam_v2_milestones AS source
        JOIN mmc.cam_v2_publications AS publication
          ON publication.tenant_id = NEW.tenant_id
         AND publication.environment = NEW.environment
         AND publication.id = NEW.publication_id
         AND publication.subject_link_id = NEW.subject_link_id
        WHERE source.tenant_id = NEW.tenant_id
          AND source.environment = NEW.environment
          AND source.id = NEW.source_object_id
          AND source.object_version = NEW.source_object_version
          AND source.assignment_id = publication.authoring_assignment_id
          AND source.subject_link_id = NEW.subject_link_id
          AND source.milestone_state IN ('PLANNED', 'EVIDENCE_PENDING', 'MET', 'NOT_MET', 'BLOCKED')
      ) INTO v_eligible;
      SELECT mmc.cam_v2_sha256_jsonb(jsonb_build_object(
        'sourceKind', 'MILESTONE', 'id', source.id, 'objectVersion', source.object_version,
        'assignmentId', source.assignment_id, 'subjectLinkId', source.subject_link_id,
        'goalId', source.goal_id, 'milestoneState', source.milestone_state,
        'title', source.title, 'criteriaDigest', source.criteria_digest,
        'dueAtEpochMicroseconds', mmc.cam_v2_epoch_microseconds(source.due_at)
      ))
      INTO v_expected_source_hash FROM mmc.cam_v2_milestones AS source
      WHERE source.tenant_id = NEW.tenant_id AND source.environment = NEW.environment
        AND source.id = NEW.source_object_id AND source.object_version = NEW.source_object_version;
    WHEN 'FEEDBACK' THEN
      SELECT NEW.item_kind = 'FEEDBACK' AND EXISTS (
        SELECT 1
        FROM mmc.cam_v2_review_decisions AS source
        JOIN mmc.cam_v2_publications AS publication
          ON publication.tenant_id = NEW.tenant_id
         AND publication.environment = NEW.environment
         AND publication.id = NEW.publication_id
         AND publication.subject_link_id = NEW.subject_link_id
        WHERE source.tenant_id = NEW.tenant_id
          AND source.environment = NEW.environment
          AND source.id = NEW.source_object_id
          AND source.object_version = NEW.source_object_version
          AND source.assignment_id = publication.authoring_assignment_id
          AND source.subject_link_id = NEW.subject_link_id
          AND source.decision IN ('DEFER', 'REQUEST_EVIDENCE')
      ) INTO v_eligible;
      SELECT mmc.cam_v2_sha256_jsonb(jsonb_build_object(
        'sourceKind', 'FEEDBACK', 'id', source.id, 'objectVersion', source.object_version,
        'assignmentId', source.assignment_id, 'subjectLinkId', source.subject_link_id,
        'proposalId', source.proposal_id, 'reviewerPrincipalId', source.reviewer_principal_id,
        'decision', source.decision, 'decisionReason', source.decision_reason,
        'exactInputDigest', source.exact_input_digest,
        'exactOutputDigest', source.exact_output_digest,
        'policyVersionId', source.policy_version_id, 'policyKind', source.policy_kind,
        'supersedesId', source.supersedes_id
      ))
      INTO v_expected_source_hash FROM mmc.cam_v2_review_decisions AS source
      WHERE source.tenant_id = NEW.tenant_id AND source.environment = NEW.environment
        AND source.id = NEW.source_object_id AND source.object_version = NEW.source_object_version;
    WHEN 'CORRECTION' THEN
      SELECT NEW.item_kind = 'CORRECTION' AND EXISTS (
        SELECT 1
        FROM mmc.cam_v2_review_decisions AS source
        JOIN mmc.cam_v2_publications AS publication
          ON publication.tenant_id = NEW.tenant_id
         AND publication.environment = NEW.environment
         AND publication.id = NEW.publication_id
         AND publication.subject_link_id = NEW.subject_link_id
        WHERE source.tenant_id = NEW.tenant_id
          AND source.environment = NEW.environment
          AND source.id = NEW.source_object_id
          AND source.object_version = NEW.source_object_version
          AND source.assignment_id = publication.authoring_assignment_id
          AND source.subject_link_id = NEW.subject_link_id
          AND source.decision = 'ACCEPT'
          AND source.exact_output_digest IS NOT NULL
      ) INTO v_eligible;
      SELECT mmc.cam_v2_sha256_jsonb(jsonb_build_object(
        'sourceKind', 'CORRECTION', 'id', source.id, 'objectVersion', source.object_version,
        'assignmentId', source.assignment_id, 'subjectLinkId', source.subject_link_id,
        'proposalId', source.proposal_id, 'reviewerPrincipalId', source.reviewer_principal_id,
        'decision', source.decision, 'decisionReason', source.decision_reason,
        'exactInputDigest', source.exact_input_digest,
        'exactOutputDigest', source.exact_output_digest,
        'policyVersionId', source.policy_version_id, 'policyKind', source.policy_kind,
        'supersedesId', source.supersedes_id
      ))
      INTO v_expected_source_hash FROM mmc.cam_v2_review_decisions AS source
      WHERE source.tenant_id = NEW.tenant_id AND source.environment = NEW.environment
        AND source.id = NEW.source_object_id AND source.object_version = NEW.source_object_version;
    WHEN 'WITHDRAWAL_DECISION' THEN
      SELECT NEW.item_kind = 'WITHDRAWAL_NOTICE' AND EXISTS (
        SELECT 1
        FROM mmc.cam_v2_review_decisions AS source
        JOIN mmc.cam_v2_publications AS publication
          ON publication.tenant_id = NEW.tenant_id
         AND publication.environment = NEW.environment
         AND publication.id = NEW.publication_id
         AND publication.subject_link_id = NEW.subject_link_id
        WHERE source.tenant_id = NEW.tenant_id
          AND source.environment = NEW.environment
          AND source.id = NEW.source_object_id
          AND source.object_version = NEW.source_object_version
          AND source.assignment_id = publication.authoring_assignment_id
          AND source.subject_link_id = NEW.subject_link_id
          AND source.decision = 'REJECT'
      ) INTO v_eligible;
      SELECT mmc.cam_v2_sha256_jsonb(jsonb_build_object(
        'sourceKind', 'WITHDRAWAL_DECISION', 'id', source.id,
        'objectVersion', source.object_version,
        'assignmentId', source.assignment_id, 'subjectLinkId', source.subject_link_id,
        'proposalId', source.proposal_id, 'reviewerPrincipalId', source.reviewer_principal_id,
        'decision', source.decision, 'decisionReason', source.decision_reason,
        'exactInputDigest', source.exact_input_digest,
        'exactOutputDigest', source.exact_output_digest,
        'policyVersionId', source.policy_version_id, 'policyKind', source.policy_kind,
        'supersedesId', source.supersedes_id
      ))
      INTO v_expected_source_hash FROM mmc.cam_v2_review_decisions AS source
      WHERE source.tenant_id = NEW.tenant_id AND source.environment = NEW.environment
        AND source.id = NEW.source_object_id AND source.object_version = NEW.source_object_version;
    ELSE
      v_eligible := false;
  END CASE;

  IF v_eligible IS NOT TRUE THEN
    RAISE EXCEPTION 'publication item source is absent, stale, cross-boundary, or ineligible'
      USING ERRCODE = '23514', CONSTRAINT = 'cam_v2_publication_items_source_eligible';
  END IF;
  IF NEW.source_version_hash IS DISTINCT FROM v_expected_source_hash THEN
    RAISE EXCEPTION 'publication source version hash does not attest the exact durable source row'
      USING ERRCODE = '23514', CONSTRAINT = 'cam_v2_publication_items_source_hash_exact';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS cam_v2_publication_items_source_eligible ON mmc.cam_v2_publication_items;
CREATE TRIGGER cam_v2_publication_items_source_eligible
BEFORE INSERT OR UPDATE ON mmc.cam_v2_publication_items
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_enforce_publication_item_source();

-- Published truth is a sealed, digest-attested ordered item set. A publication
-- must begin DRAFT/APPROVED, collect its typed items, and can enter a readable
-- state only when item_set_digest exactly matches the complete canonical set.
-- Once readable, content/binding fields and every child item are immutable;
-- only state/timestamp lifecycle fields may advance under a future reviewed RPC.
-- CORRECTED is deliberately terminal here: the current JS contract requires
-- correction items iff the current state is CORRECTED while also listing
-- outgoing CORRECTED predecessors. Until that authority contradiction is
-- resolved, the SQL boundary admits the safe subset and cannot commit a state
-- the JS authority would reject.
CREATE OR REPLACE FUNCTION mmc.cam_v2_enforce_publication_seal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, mmc
SET row_security = off
AS $$
DECLARE
  v_publication_state text;
  v_tenant_id uuid;
  v_environment text;
  v_publication_id uuid;
  v_item_count bigint;
  v_all_items_published boolean;
  v_item_set_digest text;
  v_predecessor_state text;
  v_sealed_states constant text[] := ARRAY[
    'PUBLISHED', 'ACKNOWLEDGED', 'CORRECTED', 'SUPERSEDED', 'WITHDRAWN', 'EXPIRED'
  ];
BEGIN
  IF TG_TABLE_NAME = 'cam_v2_publications' THEN
    IF TG_OP = 'INSERT' AND NEW.publication_state NOT IN ('DRAFT', 'APPROVED') THEN
      RAISE EXCEPTION 'publication must be assembled before entering a readable state'
        USING ERRCODE = '23514', CONSTRAINT = 'cam_v2_publications_projection_seal';
    ELSIF TG_OP = 'DELETE' THEN
      IF OLD.publication_state = ANY(v_sealed_states) THEN
        RAISE EXCEPTION 'published truth is append-only'
          USING ERRCODE = '23514', CONSTRAINT = 'cam_v2_publications_projection_seal';
      END IF;
      RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
      IF NEW.publication_state IS DISTINCT FROM OLD.publication_state AND NOT (
        (OLD.publication_state = 'DRAFT' AND NEW.publication_state = 'APPROVED')
        OR (OLD.publication_state = 'APPROVED' AND NEW.publication_state IN (
          'PUBLISHED', 'SUPERSEDED', 'WITHDRAWN'
        ))
        OR (OLD.publication_state = 'PUBLISHED' AND NEW.publication_state IN (
          'ACKNOWLEDGED', 'CORRECTED', 'SUPERSEDED', 'WITHDRAWN', 'EXPIRED'
        ))
        OR (OLD.publication_state = 'ACKNOWLEDGED' AND NEW.publication_state IN (
          'CORRECTED', 'SUPERSEDED', 'WITHDRAWN', 'EXPIRED'
        ))
      ) THEN
        RAISE EXCEPTION 'publication lifecycle transition is not forward-only'
          USING ERRCODE = '23514', CONSTRAINT = 'cam_v2_publications_projection_seal';
      END IF;
      IF OLD.publication_state = ANY(v_sealed_states)
         AND NEW.publication_state <> ALL(v_sealed_states) THEN
        RAISE EXCEPTION 'a readable publication cannot return to assembly state'
          USING ERRCODE = '23514', CONSTRAINT = 'cam_v2_publications_projection_seal';
      END IF;
      IF NEW.created_at IS DISTINCT FROM OLD.created_at
         OR NEW.object_version IS DISTINCT FROM OLD.object_version + 1 THEN
        RAISE EXCEPTION 'publication mutations require immutable creation time and one exact version advance'
          USING ERRCODE = '23514', CONSTRAINT = 'cam_v2_publications_projection_seal';
      END IF;
      NEW.updated_at := clock_timestamp();
      IF NEW.published_at IS DISTINCT FROM OLD.published_at AND NOT (
        OLD.publication_state = 'APPROVED'
        AND NEW.publication_state = ANY(v_sealed_states)
        AND OLD.published_at IS NULL AND NEW.published_at IS NOT NULL
      ) THEN
        RAISE EXCEPTION 'publication seal time is immutable after its first forward transition'
          USING ERRCODE = '23514', CONSTRAINT = 'cam_v2_publications_projection_seal';
      END IF;
      IF OLD.publication_state = ANY(v_sealed_states)
         AND NEW.expires_at IS DISTINCT FROM OLD.expires_at THEN
        RAISE EXCEPTION 'publication expiry binding is immutable after sealing'
          USING ERRCODE = '23514', CONSTRAINT = 'cam_v2_publications_projection_seal';
      END IF;
      IF NEW.withdrawn_at IS DISTINCT FROM OLD.withdrawn_at AND NOT (
        OLD.publication_state IN ('APPROVED', 'PUBLISHED', 'ACKNOWLEDGED', 'CORRECTED')
        AND NEW.publication_state = 'WITHDRAWN'
        AND OLD.withdrawn_at IS NULL AND NEW.withdrawn_at IS NOT NULL
      ) THEN
        RAISE EXCEPTION 'withdrawal time may be fixed only by its exact forward transition'
          USING ERRCODE = '23514', CONSTRAINT = 'cam_v2_publications_projection_seal';
      END IF;
      IF OLD.publication_state = ANY(v_sealed_states) AND (
        NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
        OR NEW.environment IS DISTINCT FROM OLD.environment
        OR NEW.subject_link_id IS DISTINCT FROM OLD.subject_link_id
        OR NEW.authoring_assignment_id IS DISTINCT FROM OLD.authoring_assignment_id
        OR NEW.authority_grant_id IS DISTINCT FROM OLD.authority_grant_id
        OR NEW.policy_version_id IS DISTINCT FROM OLD.policy_version_id
        OR NEW.policy_kind IS DISTINCT FROM OLD.policy_kind
        OR NEW.approved_by_principal_id IS DISTINCT FROM OLD.approved_by_principal_id
        OR NEW.publication_version IS DISTINCT FROM OLD.publication_version
        OR NEW.projection_digest IS DISTINCT FROM OLD.projection_digest
        OR NEW.item_set_digest IS DISTINCT FROM OLD.item_set_digest
        OR NEW.supersedes_id IS DISTINCT FROM OLD.supersedes_id
        OR NEW.supersedes_version IS DISTINCT FROM OLD.supersedes_version
        OR NEW.supersedes_projection_digest IS DISTINCT FROM OLD.supersedes_projection_digest
      ) THEN
        RAISE EXCEPTION 'published projection and authority bindings are immutable'
          USING ERRCODE = '23514', CONSTRAINT = 'cam_v2_publications_projection_seal';
      END IF;
      IF NEW.publication_state = ANY(v_sealed_states)
         AND OLD.publication_state <> ALL(v_sealed_states) THEN
        IF NEW.publication_version > 1 THEN
          SELECT predecessor.publication_state INTO v_predecessor_state
          FROM mmc.cam_v2_publications AS predecessor
          WHERE predecessor.tenant_id = NEW.tenant_id
            AND predecessor.environment = NEW.environment
            AND predecessor.id = NEW.supersedes_id
            AND predecessor.subject_link_id = NEW.subject_link_id
            AND predecessor.publication_version = NEW.supersedes_version
            AND predecessor.projection_digest = NEW.supersedes_projection_digest
            AND predecessor.publication_state IN ('PUBLISHED', 'ACKNOWLEDGED')
          FOR UPDATE;
          IF NOT FOUND THEN
            RAISE EXCEPTION 'successor publication requires an exact readable current predecessor'
              USING ERRCODE = '23514', CONSTRAINT = 'cam_v2_publications_projection_seal';
          END IF;
        END IF;
        SELECT count(*), bool_and(item.item_state = 'PUBLISHED'),
          mmc.cam_v2_sha256_jsonb(coalesce(
          jsonb_agg(jsonb_build_object(
            'id', item.id, 'objectVersion', item.object_version,
            'itemKind', item.item_kind, 'itemPayloadDigest', item.item_payload_digest,
            'sourceVersionHash', item.source_version_hash,
            'replacesPublicationId', item.replaces_publication_id,
            'replacesPublicationItemId', item.replaces_publication_item_id,
            'replacesSourceVersionHash', item.replaces_source_version_hash,
            'itemState', item.item_state
          ) ORDER BY item.id), '[]'::jsonb
        ))
        INTO v_item_count, v_all_items_published, v_item_set_digest
        FROM mmc.cam_v2_publication_items AS item
        WHERE item.tenant_id = NEW.tenant_id
          AND item.environment = NEW.environment
          AND item.publication_id = NEW.id
          AND item.subject_link_id = NEW.subject_link_id;
        IF v_item_count NOT BETWEEN 1 AND 100 OR v_all_items_published IS NOT TRUE
           OR NEW.item_set_digest IS DISTINCT FROM v_item_set_digest THEN
          RAISE EXCEPTION 'publication item-set digest does not match its complete ordered child attestations'
            USING ERRCODE = '23514', CONSTRAINT = 'cam_v2_publications_projection_seal';
        END IF;
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND (
    NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
    OR NEW.environment IS DISTINCT FROM OLD.environment
    OR NEW.publication_id IS DISTINCT FROM OLD.publication_id
    OR NEW.subject_link_id IS DISTINCT FROM OLD.subject_link_id
  ) THEN
    RAISE EXCEPTION 'publication item parent and subject bindings are immutable'
      USING ERRCODE = '23514', CONSTRAINT = 'cam_v2_publication_items_projection_seal';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF NEW.created_at IS DISTINCT FROM OLD.created_at
       OR NEW.object_version IS DISTINCT FROM OLD.object_version + 1 THEN
      RAISE EXCEPTION 'publication item mutations require immutable creation time and one exact version advance'
        USING ERRCODE = '23514', CONSTRAINT = 'cam_v2_publication_items_version_fence';
    END IF;
    NEW.updated_at := clock_timestamp();
  END IF;
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    v_tenant_id := OLD.tenant_id;
    v_environment := OLD.environment;
    v_publication_id := OLD.publication_id;
  ELSE
    v_tenant_id := NEW.tenant_id;
    v_environment := NEW.environment;
    v_publication_id := NEW.publication_id;
  END IF;
  SELECT publication.publication_state INTO v_publication_state
  FROM mmc.cam_v2_publications AS publication
  WHERE publication.tenant_id = v_tenant_id
    AND publication.environment = v_environment
    AND publication.id = v_publication_id
  FOR UPDATE;
  IF NOT FOUND OR v_publication_state NOT IN ('DRAFT', 'APPROVED') THEN
    RAISE EXCEPTION 'items of a readable publication are immutable'
      USING ERRCODE = '23514', CONSTRAINT = 'cam_v2_publication_items_projection_seal';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS cam_v2_publications_projection_seal ON mmc.cam_v2_publications;
CREATE TRIGGER cam_v2_publications_projection_seal
BEFORE INSERT OR UPDATE OR DELETE ON mmc.cam_v2_publications
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_enforce_publication_seal();
DROP TRIGGER IF EXISTS cam_v2_publication_items_projection_seal ON mmc.cam_v2_publication_items;
CREATE TRIGGER cam_v2_publication_items_projection_seal
BEFORE INSERT OR UPDATE OR DELETE ON mmc.cam_v2_publication_items
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_enforce_publication_seal();

-- Correction-state parity is a transaction-final invariant. A correction
-- item is assembled under APPROVED, the exact set is sealed through the
-- PUBLISHED predecessor, and the same transaction must advance to CORRECTED.
-- Deferral prevents either the required two-step transition or a committed
-- JS-invalid intermediate state from weakening the authority boundary.
CREATE OR REPLACE FUNCTION mmc.cam_v2_enforce_publication_final_coherence()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, mmc
SET row_security = off
AS $$
DECLARE
  v_state text;
  v_subject_link_id uuid;
  v_correction_count bigint;
  v_readable_head_count bigint;
BEGIN
  SELECT publication.publication_state, publication.subject_link_id,
         count(item.id) FILTER (WHERE item.item_kind = 'CORRECTION')
  INTO v_state, v_subject_link_id, v_correction_count
  FROM mmc.cam_v2_publications AS publication
  LEFT JOIN mmc.cam_v2_publication_items AS item
    ON item.tenant_id = publication.tenant_id
   AND item.environment = publication.environment
   AND item.publication_id = publication.id
   AND item.subject_link_id = publication.subject_link_id
  WHERE publication.tenant_id = NEW.tenant_id
    AND publication.environment = NEW.environment
    AND publication.id = NEW.id
  GROUP BY publication.publication_state, publication.subject_link_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT count(*) INTO v_readable_head_count
  FROM mmc.cam_v2_publications AS head
  WHERE head.tenant_id = NEW.tenant_id
    AND head.environment = NEW.environment
    AND head.subject_link_id = v_subject_link_id
    AND head.publication_state IN ('PUBLISHED', 'ACKNOWLEDGED', 'CORRECTED');
  IF v_readable_head_count > 1 THEN
    RAISE EXCEPTION 'a subject may have at most one readable publication head'
      USING ERRCODE = '23514', CONSTRAINT = 'cam_v2_publications_single_readable_head';
  END IF;
  IF v_state IN ('DRAFT', 'APPROVED') THEN RETURN NULL; END IF;
  IF (v_state = 'CORRECTED') IS DISTINCT FROM (v_correction_count > 0) THEN
    RAISE EXCEPTION 'publication correction items and final state are incoherent'
      USING ERRCODE = '23514', CONSTRAINT = 'cam_v2_publications_correction_coherence';
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS cam_v2_publications_final_coherence ON mmc.cam_v2_publications;
CREATE CONSTRAINT TRIGGER cam_v2_publications_final_coherence
AFTER INSERT OR UPDATE ON mmc.cam_v2_publications
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_enforce_publication_final_coherence();

-- Student-authored durable rows are bound to the verified student identity for
-- their exact subject. Polymorphic responses additionally resolve the target
-- through a fixed same-scope/same-subject allowlist.
CREATE OR REPLACE FUNCTION mmc.cam_v2_enforce_student_authorship_and_target()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, mmc
SET row_security = off
AS $$
DECLARE
  v_target_exists boolean := false;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM mmc.cam_v2_subject_links AS subject_link
    JOIN mmc.cam_v2_principals AS principal
      ON principal.tenant_id = subject_link.tenant_id
     AND principal.environment = subject_link.environment
     AND principal.id = subject_link.student_principal_id
     AND principal.principal_kind = 'STUDENT'
     AND principal.status = 'ACTIVE'
    WHERE subject_link.tenant_id = NEW.tenant_id
      AND subject_link.environment = NEW.environment
      AND subject_link.id = NEW.subject_link_id
      AND subject_link.student_principal_id = NEW.author_principal_id
      AND subject_link.identity_state = 'VERIFIED_LOCAL_LINK'
      AND subject_link.revoked_at IS NULL
  ) THEN
    RAISE EXCEPTION 'student author is not the verified active owner of the exact subject'
      USING ERRCODE = '23514', CONSTRAINT = 'cam_v2_student_author_subject_exact';
  END IF;

  IF TG_TABLE_NAME = 'cam_v2_student_responses' THEN
    CASE NEW.target_kind
      WHEN 'PUBLICATION' THEN
        SELECT EXISTS (
          SELECT 1 FROM mmc.cam_v2_publications AS target
          WHERE target.tenant_id = NEW.tenant_id
            AND target.environment = NEW.environment
            AND target.id = NEW.target_id
            AND target.subject_link_id = NEW.subject_link_id
        ) INTO v_target_exists;
      WHEN 'PUBLICATION_ITEM' THEN
        SELECT EXISTS (
          SELECT 1
          FROM mmc.cam_v2_publication_items AS target
          JOIN mmc.cam_v2_publications AS publication
            ON publication.tenant_id = target.tenant_id
           AND publication.environment = target.environment
           AND publication.id = target.publication_id
           AND publication.subject_link_id = target.subject_link_id
          WHERE target.tenant_id = NEW.tenant_id
            AND target.environment = NEW.environment
            AND target.id = NEW.target_id
            AND target.subject_link_id = NEW.subject_link_id
        ) INTO v_target_exists;
      WHEN 'TASK' THEN
        SELECT EXISTS (
          SELECT 1 FROM mmc.cam_v2_tasks AS target
          WHERE target.tenant_id = NEW.tenant_id
            AND target.environment = NEW.environment
            AND target.id = NEW.target_id
            AND target.subject_link_id = NEW.subject_link_id
        ) INTO v_target_exists;
      WHEN 'COMMITMENT' THEN
        SELECT EXISTS (
          SELECT 1 FROM mmc.cam_v2_commitments AS target
          WHERE target.tenant_id = NEW.tenant_id
            AND target.environment = NEW.environment
            AND target.id = NEW.target_id
            AND target.subject_link_id = NEW.subject_link_id
        ) INTO v_target_exists;
      WHEN 'GOAL' THEN
        SELECT EXISTS (
          SELECT 1 FROM mmc.cam_v2_goals AS target
          WHERE target.tenant_id = NEW.tenant_id
            AND target.environment = NEW.environment
            AND target.id = NEW.target_id
            AND target.subject_link_id = NEW.subject_link_id
        ) INTO v_target_exists;
      ELSE
        v_target_exists := false;
    END CASE;
    IF NOT v_target_exists THEN
      RAISE EXCEPTION 'student response target is absent or outside the exact subject'
        USING ERRCODE = '23514', CONSTRAINT = 'cam_v2_student_response_target_exact';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS cam_v2_student_statements_author_exact ON mmc.cam_v2_student_statements;
CREATE TRIGGER cam_v2_student_statements_author_exact
BEFORE INSERT OR UPDATE ON mmc.cam_v2_student_statements
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_enforce_student_authorship_and_target();
DROP TRIGGER IF EXISTS cam_v2_student_responses_author_target_exact ON mmc.cam_v2_student_responses;
CREATE TRIGGER cam_v2_student_responses_author_target_exact
BEFORE INSERT OR UPDATE ON mmc.cam_v2_student_responses
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_enforce_student_authorship_and_target();

-- Transactional delivery, lineage, audit, and single-writer cutover evidence.
CREATE TABLE IF NOT EXISTS mmc.cam_v2_outbox_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, environment text NOT NULL,
  job_id uuid, command_receipt_id uuid, aggregate_kind text NOT NULL, aggregate_id uuid NOT NULL,
  aggregate_version bigint NOT NULL, event_kind text NOT NULL, payload_digest text NOT NULL,
  external_lease_generation bigint, external_outcome text, external_result_digest text,
  external_provider_receipt_digest text, external_provider_idempotency_proven boolean,
  external_provider_idempotency_key_digest text,
  external_result_recorded_at timestamptz, external_resolution text, external_resolved_at timestamptz,
  delivery_queue_name text NOT NULL DEFAULT 'mmc.outbox',
  delivery_state text NOT NULL DEFAULT 'PENDING', attempt_count integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 10, available_at timestamptz NOT NULL DEFAULT now(),
  delivery_lease_owner_principal_id uuid, delivery_lease_generation bigint NOT NULL DEFAULT 0,
  delivery_lease_expires_at timestamptz, delivery_error_class text, delivered_at timestamptz,
  delivery_completed_by_principal_id uuid, delivery_completed_queue_name text,
  delivery_completed_lease_generation bigint, delivery_completion_disposition text,
  delivery_completion_error_class text, delivery_completion_retry_delay_seconds integer,
  delivery_completed_at timestamptz,
  object_version bigint NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id), UNIQUE (tenant_id, environment, id),
  UNIQUE (tenant_id, environment, aggregate_kind, aggregate_id, aggregate_version, event_kind),
  FOREIGN KEY (tenant_id, environment) REFERENCES mmc.cam_v2_tenants(id, environment) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, environment, job_id) REFERENCES mmc.cam_v2_jobs(tenant_id, environment, id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, environment, command_receipt_id) REFERENCES mmc.cam_v2_command_receipts(tenant_id, environment, id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, environment, delivery_lease_owner_principal_id)
    REFERENCES mmc.cam_v2_principals(tenant_id, environment, id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, environment, delivery_completed_by_principal_id)
    REFERENCES mmc.cam_v2_principals(tenant_id, environment, id) ON DELETE RESTRICT,
  CHECK (aggregate_version > 0),
  CHECK (delivery_queue_name ~ '^[a-z0-9][a-z0-9._-]{0,63}$'),
  CHECK (payload_digest ~ '^[a-f0-9]{64}$'),
  CHECK (attempt_count >= 0 AND max_attempts > 0 AND attempt_count <= max_attempts),
  CHECK (delivery_lease_generation >= 0),
  CHECK ((delivery_lease_owner_principal_id IS NULL) = (delivery_lease_expires_at IS NULL)),
  CHECK (
    (delivery_state = 'LEASED'
      AND delivery_lease_owner_principal_id IS NOT NULL
      AND delivery_lease_expires_at IS NOT NULL
      AND delivery_lease_generation > 0)
    OR (delivery_state <> 'LEASED'
      AND delivery_lease_owner_principal_id IS NULL
      AND delivery_lease_expires_at IS NULL)
  ),
  CHECK (external_lease_generation IS NULL OR external_lease_generation > 0),
  CHECK (external_outcome IS NULL OR external_outcome IN ('SUCCEEDED', 'FAILED', 'OUTCOME_UNKNOWN')),
  CHECK (external_result_digest IS NULL OR external_result_digest ~ '^[a-f0-9]{64}$'),
  CHECK (external_provider_receipt_digest IS NULL OR external_provider_receipt_digest ~ '^[a-f0-9]{64}$'),
  CHECK (external_provider_idempotency_key_digest IS NULL
    OR external_provider_idempotency_key_digest ~ '^[a-f0-9]{64}$'),
  CHECK (
    external_lease_generation IS NULL
    OR (external_outcome IS NOT NULL AND external_result_digest IS NOT NULL
      AND external_provider_idempotency_proven IS NOT NULL AND external_result_recorded_at IS NOT NULL)
  ),
  CHECK (external_provider_idempotency_proven IS DISTINCT FROM true
    OR external_provider_idempotency_key_digest IS NOT NULL),
  CHECK ((external_resolution IS NULL) = (external_resolved_at IS NULL)),
  CHECK (
    (delivery_completed_by_principal_id IS NULL
      AND delivery_completed_queue_name IS NULL
      AND delivery_completed_lease_generation IS NULL
      AND delivery_completion_disposition IS NULL
      AND delivery_completion_error_class IS NULL
      AND delivery_completion_retry_delay_seconds IS NULL
      AND delivery_completed_at IS NULL)
    OR (delivery_completed_by_principal_id IS NOT NULL
      AND delivery_completed_queue_name ~ '^[a-z0-9][a-z0-9._-]{0,63}$'
      AND delivery_completed_lease_generation > 0
      AND delivery_completion_disposition IN ('RETRY', 'DEAD_LETTER')
      AND delivery_completion_error_class ~ '^[A-Z0-9_]{3,64}$'
      AND delivery_completion_retry_delay_seconds BETWEEN 0 AND 86400
      AND delivery_completed_at IS NOT NULL
      AND delivery_state = delivery_completion_disposition)
  ),
  CHECK (
    (delivery_state = 'DELIVERED'
      AND delivered_at IS NOT NULL
      AND delivery_completed_by_principal_id IS NULL)
    OR (delivery_state IN ('RETRY', 'DEAD_LETTER')
      AND delivered_at IS NULL
      AND delivery_completed_by_principal_id IS NOT NULL)
    OR (delivery_state IN ('PENDING', 'QUARANTINED', 'LEASED')
      AND delivered_at IS NULL
      AND delivery_completed_by_principal_id IS NULL)
  ),
  CHECK (delivery_state IN ('PENDING', 'QUARANTINED', 'LEASED', 'DELIVERED', 'RETRY', 'DEAD_LETTER')), CHECK (object_version > 0)
);

-- A bounded canonical consumer effect is persisted before its inbox receipt.
-- The RPC below derives dispatcher identity from signed claims and inserts both
-- rows in one transaction; arbitrary effect payloads and consumer names are not
-- accepted at this trust boundary.
CREATE TABLE IF NOT EXISTS mmc.cam_v2_consumer_effects (
  id uuid NOT NULL DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, environment text NOT NULL,
  outbox_event_id uuid NOT NULL, source_job_id uuid,
  dispatcher_principal_id uuid NOT NULL, dispatcher_queue_name text NOT NULL,
  dispatcher_lease_generation bigint NOT NULL,
  effect_kind text NOT NULL, target_kind text NOT NULL, target_id uuid NOT NULL,
  effect_digest text NOT NULL, effect_state text NOT NULL DEFAULT 'APPLIED', applied_at timestamptz NOT NULL,
  object_version bigint NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id), UNIQUE (tenant_id, environment, id),
  UNIQUE (tenant_id, environment, outbox_event_id),
  UNIQUE (tenant_id, environment, id, outbox_event_id),
  UNIQUE NULLS NOT DISTINCT (
    tenant_id, environment, id, outbox_event_id, source_job_id,
    dispatcher_principal_id, dispatcher_queue_name, dispatcher_lease_generation,
    effect_digest
  ),
  FOREIGN KEY (tenant_id, environment) REFERENCES mmc.cam_v2_tenants(id, environment) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, environment, outbox_event_id) REFERENCES mmc.cam_v2_outbox_events(tenant_id, environment, id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, environment, source_job_id) REFERENCES mmc.cam_v2_jobs(tenant_id, environment, id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, environment, dispatcher_principal_id) REFERENCES mmc.cam_v2_principals(tenant_id, environment, id) ON DELETE RESTRICT,
  CHECK (dispatcher_queue_name ~ '^[a-z0-9][a-z0-9._-]{0,63}$'),
  CHECK (dispatcher_lease_generation > 0),
  CHECK (effect_kind IN ('PROJECTION_REFRESH', 'INDEX_REFRESH', 'CACHE_INVALIDATION', 'NOTIFICATION_ENQUEUE')),
  CHECK (target_kind IN ('SUBJECT', 'ASSIGNMENT', 'SESSION', 'JOB', 'PUBLICATION')),
  CHECK (effect_digest ~ '^[a-f0-9]{64}$'), CHECK (effect_state = 'APPLIED'), CHECK (object_version > 0)
);

CREATE TABLE IF NOT EXISTS mmc.cam_v2_consumer_inbox (
  id uuid NOT NULL DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, environment text NOT NULL,
  job_id uuid, outbox_event_id uuid NOT NULL, consumer_effect_id uuid NOT NULL,
  consumer_principal_id uuid NOT NULL, consumer_queue_name text NOT NULL,
  consumer_lease_generation bigint NOT NULL, effect_digest text NOT NULL,
  object_version bigint NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id), UNIQUE (tenant_id, environment, id), UNIQUE (tenant_id, environment, outbox_event_id),
  FOREIGN KEY (tenant_id, environment) REFERENCES mmc.cam_v2_tenants(id, environment) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, environment, job_id) REFERENCES mmc.cam_v2_jobs(tenant_id, environment, id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, environment, outbox_event_id) REFERENCES mmc.cam_v2_outbox_events(tenant_id, environment, id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, environment, consumer_effect_id, outbox_event_id)
    REFERENCES mmc.cam_v2_consumer_effects(tenant_id, environment, id, outbox_event_id) ON DELETE RESTRICT,
  CONSTRAINT cam_v2_consumer_inbox_effect_semantics_fk
    FOREIGN KEY (
      tenant_id, environment, consumer_effect_id, outbox_event_id, job_id,
      consumer_principal_id, consumer_queue_name, consumer_lease_generation,
      effect_digest
    ) REFERENCES mmc.cam_v2_consumer_effects(
      tenant_id, environment, id, outbox_event_id, source_job_id,
      dispatcher_principal_id, dispatcher_queue_name, dispatcher_lease_generation,
      effect_digest
    ) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, environment, consumer_principal_id) REFERENCES mmc.cam_v2_principals(tenant_id, environment, id) ON DELETE RESTRICT,
  CHECK (consumer_queue_name ~ '^[a-z0-9][a-z0-9._-]{0,63}$'),
  CHECK (consumer_lease_generation > 0), CHECK (effect_digest ~ '^[a-f0-9]{64}$'), CHECK (object_version > 0)
);

CREATE TABLE IF NOT EXISTS mmc.cam_v2_lineage_edges (
  id uuid NOT NULL DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, environment text NOT NULL,
  from_kind text NOT NULL, from_id uuid NOT NULL, from_version bigint NOT NULL,
  to_kind text NOT NULL, to_id uuid NOT NULL, to_version bigint NOT NULL,
  relation_kind text NOT NULL, transform_digest text NOT NULL, invalidated_at timestamptz,
  object_version bigint NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id), UNIQUE (tenant_id, environment, id),
  UNIQUE (tenant_id, environment, from_kind, from_id, from_version, to_kind, to_id, to_version, relation_kind),
  FOREIGN KEY (tenant_id, environment) REFERENCES mmc.cam_v2_tenants(id, environment) ON DELETE RESTRICT,
  CHECK (from_version > 0 AND to_version > 0),
  CHECK (transform_digest ~ '^[a-f0-9]{64}$'),
  CHECK (relation_kind IN ('SOURCE_TO_SPAN', 'SPAN_TO_PROPOSAL', 'SOURCE_TO_PROPOSAL', 'PROPOSAL_TO_CANONICAL', 'SOURCE_TO_CANONICAL', 'CANONICAL_TO_PUBLICATION', 'CANONICAL_TO_JUDGMENT')),
  CHECK (object_version > 0)
);

CREATE TABLE IF NOT EXISTS mmc.cam_v2_audit_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, environment text NOT NULL,
  principal_id uuid NOT NULL, effective_principal_kind text NOT NULL, subject_link_id uuid, assignment_id uuid,
  action text NOT NULL, purpose text NOT NULL, object_kind text NOT NULL, object_id uuid,
  before_digest text, after_digest text, outcome text NOT NULL, correlation_id text NOT NULL,
  chain_sequence bigint NOT NULL DEFAULT 0,
  previous_event_digest text, event_digest text NOT NULL DEFAULT repeat('0', 64), chain_key_version integer NOT NULL,
  object_version bigint NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id), UNIQUE (tenant_id, environment, id),
  UNIQUE (tenant_id, environment, chain_sequence),
  UNIQUE (tenant_id, environment, event_digest),
  UNIQUE (tenant_id, environment, correlation_id, event_digest),
  FOREIGN KEY (tenant_id, environment) REFERENCES mmc.cam_v2_tenants(id, environment) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, environment, principal_id) REFERENCES mmc.cam_v2_principals(tenant_id, environment, id) ON DELETE RESTRICT,
  CONSTRAINT cam_v2_audit_effective_role_fk
    FOREIGN KEY (tenant_id, environment, principal_id, effective_principal_kind)
    REFERENCES mmc.cam_v2_principals(
      tenant_id, environment, id, principal_kind
    ) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, environment, subject_link_id) REFERENCES mmc.cam_v2_subject_links(tenant_id, environment, id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, environment, assignment_id) REFERENCES mmc.cam_v2_assignments(tenant_id, environment, id) ON DELETE RESTRICT,
  CHECK (effective_principal_kind IN ('MENTOR', 'STUDENT', 'OPERATOR', 'WORKLOAD', 'ADMIN')),
  CHECK (outcome IN ('ALLOWED', 'DENIED', 'COMMITTED', 'CONFLICT', 'FAILED')), CHECK (chain_key_version > 0),
  CHECK (chain_sequence > 0),
  CHECK (before_digest IS NULL OR before_digest ~ '^[a-f0-9]{64}$'),
  CHECK (after_digest IS NULL OR after_digest ~ '^[a-f0-9]{64}$'),
  CHECK (previous_event_digest IS NULL OR previous_event_digest ~ '^[a-f0-9]{64}$'),
  CHECK (event_digest ~ '^[a-f0-9]{64}$'),
  CHECK (correlation_id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{2,199}$'),
  CHECK (object_version > 0)
);

CREATE OR REPLACE FUNCTION mmc.cam_v2_lock_audit_chain(
  p_tenant_id uuid, p_environment text
)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, mmc
SET row_security = off
AS $$
BEGIN
  IF p_tenant_id IS NULL OR p_environment NOT IN ('FIXTURE', 'LOCAL', 'STAGING', 'LIVE') THEN
    RAISE EXCEPTION 'exact tenant/environment is required for audit serialization'
      USING ERRCODE = '42501';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_tenant_id::text || ':' || p_environment, 0)
  );
END;
$$;

-- One serialized, trigger-computed hash chain per tenant/environment. Runtime
-- callers cannot choose sequence, predecessor, timestamp, or digest, and no
-- update/delete path can rewrite history after append.
CREATE OR REPLACE FUNCTION mmc.cam_v2_seal_audit_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, mmc
SET row_security = off
AS $$
DECLARE
  v_previous mmc.cam_v2_audit_events%ROWTYPE;
  v_material jsonb;
BEGIN
  PERFORM mmc.cam_v2_lock_audit_chain(NEW.tenant_id, NEW.environment);
  SELECT event.* INTO v_previous
  FROM mmc.cam_v2_audit_events AS event
  WHERE event.tenant_id = NEW.tenant_id AND event.environment = NEW.environment
  ORDER BY event.chain_sequence DESC
  LIMIT 1
  FOR UPDATE;

  NEW.chain_sequence := coalesce(v_previous.chain_sequence, 0) + 1;
  NEW.previous_event_digest := v_previous.event_digest;
  NEW.created_at := clock_timestamp();
  NEW.updated_at := NEW.created_at;
  NEW.object_version := 1;
  v_material := jsonb_build_object(
    'schemaVersion', 1,
    'tenantId', NEW.tenant_id,
    'environment', NEW.environment,
    'chainSequence', NEW.chain_sequence,
    'previousEventDigest', NEW.previous_event_digest,
    'eventId', NEW.id,
    'principalId', NEW.principal_id,
    'effectivePrincipalKind', NEW.effective_principal_kind,
    'subjectLinkId', NEW.subject_link_id,
    'assignmentId', NEW.assignment_id,
    'action', NEW.action,
    'purpose', NEW.purpose,
    'objectKind', NEW.object_kind,
    'objectId', NEW.object_id,
    'beforeDigest', NEW.before_digest,
    'afterDigest', NEW.after_digest,
    'outcome', NEW.outcome,
    'correlationId', NEW.correlation_id,
    'chainKeyVersion', NEW.chain_key_version,
    'createdAtEpochMicroseconds', mmc.cam_v2_epoch_microseconds(NEW.created_at)
  );
  NEW.event_digest := mmc.cam_v2_sha256_jsonb(v_material);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION mmc.cam_v2_reject_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, mmc
AS $$
BEGIN
  RAISE EXCEPTION 'CAM v2 audit events are append-only'
    USING ERRCODE = '23514', CONSTRAINT = 'cam_v2_audit_events_append_only';
END;
$$;

DROP TRIGGER IF EXISTS cam_v2_audit_events_seal ON mmc.cam_v2_audit_events;
CREATE TRIGGER cam_v2_audit_events_seal
BEFORE INSERT ON mmc.cam_v2_audit_events
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_seal_audit_event();
DROP TRIGGER IF EXISTS cam_v2_audit_events_append_only ON mmc.cam_v2_audit_events;
CREATE TRIGGER cam_v2_audit_events_append_only
BEFORE UPDATE OR DELETE ON mmc.cam_v2_audit_events
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_reject_audit_mutation();

CREATE TABLE IF NOT EXISTS mmc.cam_v2_cutover_states (
  id uuid NOT NULL DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, environment text NOT NULL,
  -- V2_ACTIVE is the durable SQL name for runtime V2_WRITER. Before that point
  -- all mutation planes are sealed; SHADOW_READS is read-only.
  component_name text NOT NULL, writer_state text NOT NULL DEFAULT 'SEALED_NO_WRITER',
  v1_inventory_digest text, v2_inventory_digest text, reconciliation_digest text,
  lock_owner_principal_id uuid, lock_expires_at timestamptz, first_v2_acknowledged_at timestamptz,
  reads_enabled boolean NOT NULL DEFAULT false,
  commands_enabled boolean NOT NULL DEFAULT false,
  ingest_enabled boolean NOT NULL DEFAULT false,
  ai_proposal_enabled boolean NOT NULL DEFAULT false,
  operational_promotion_enabled boolean NOT NULL DEFAULT false,
  student_publication_enabled boolean NOT NULL DEFAULT false,
  object_version bigint NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id), UNIQUE (tenant_id, environment, id), UNIQUE (tenant_id, environment, component_name),
  FOREIGN KEY (tenant_id, environment) REFERENCES mmc.cam_v2_tenants(id, environment) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, environment, lock_owner_principal_id) REFERENCES mmc.cam_v2_principals(tenant_id, environment, id) ON DELETE RESTRICT,
  CHECK (writer_state IN ('SEALED_NO_WRITER', 'SHADOW_READS', 'V1_FROZEN', 'V2_ACTIVE', 'FORWARD_REPAIR')),
  CHECK (writer_state = 'V2_ACTIVE' OR NOT (
    commands_enabled OR ingest_enabled OR ai_proposal_enabled OR operational_promotion_enabled OR student_publication_enabled
  )),
  CHECK (v1_inventory_digest IS NULL OR v1_inventory_digest ~ '^[a-f0-9]{64}$'),
  CHECK (v2_inventory_digest IS NULL OR v2_inventory_digest ~ '^[a-f0-9]{64}$'),
  CHECK (reconciliation_digest IS NULL OR reconciliation_digest ~ '^[a-f0-9]{64}$'),
  CHECK ((lock_owner_principal_id IS NULL) = (lock_expires_at IS NULL)), CHECK (object_version > 0)
);

-- ---------------------------------------------------------------------------
-- Structural actor, lifecycle, and immutable-authority invariants.
-- These triggers are deliberately independent of RLS: durable identity,
-- policy, assignment, work, and evidence rows cannot be re-bound by an owner
-- session, a future SECURITY DEFINER function, or a maintenance mistake.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION mmc.cam_v2_enforce_principal_roles()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, mmc
SET row_security = off
AS $$
DECLARE
  v_spec text;
  v_column text;
  v_actor_text text;
  v_allowed text[];
  v_actual text;
BEGIN
  FOREACH v_spec IN ARRAY TG_ARGV LOOP
    IF strpos(v_spec, '=') = 0 THEN
      RAISE EXCEPTION 'invalid principal-role trigger specification'
        USING ERRCODE = '22023';
    END IF;
    v_column := split_part(v_spec, '=', 1);
    IF NOT (to_jsonb(NEW) ? v_column) THEN
      RAISE EXCEPTION 'principal-role trigger references an absent column'
        USING ERRCODE = '42703';
    END IF;
    v_actor_text := to_jsonb(NEW) ->> v_column;
    IF v_actor_text IS NULL THEN CONTINUE; END IF;
    v_allowed := string_to_array(split_part(v_spec, '=', 2), ',');
    SELECT principal.principal_kind INTO v_actual
    FROM mmc.cam_v2_principals AS principal
    WHERE principal.tenant_id = NEW.tenant_id
      AND principal.environment = NEW.environment
      AND principal.id = v_actor_text::uuid;
    IF NOT FOUND OR NOT (v_actual = ANY(v_allowed)) THEN
      RAISE EXCEPTION 'principal role is invalid for %.%', TG_TABLE_NAME, v_column
        USING ERRCODE = '23514', CONSTRAINT = 'cam_v2_principal_role_exact';
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION mmc.cam_v2_enforce_immutable_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, mmc
AS $$
DECLARE
  v_column text;
BEGIN
  FOREACH v_column IN ARRAY TG_ARGV LOOP
    IF NOT (to_jsonb(NEW) ? v_column) THEN
      RAISE EXCEPTION 'immutable-column trigger references an absent column'
        USING ERRCODE = '42703';
    END IF;
    IF (to_jsonb(NEW) -> v_column) IS DISTINCT FROM (to_jsonb(OLD) -> v_column) THEN
      RAISE EXCEPTION 'immutable durable binding %.% cannot be rewritten', TG_TABLE_NAME, v_column
        USING ERRCODE = '23514', CONSTRAINT = 'cam_v2_durable_binding_immutable';
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION mmc.cam_v2_reject_durable_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, mmc
AS $$
BEGIN
  RAISE EXCEPTION 'durable evidence row %.% is append-only', TG_TABLE_NAME, TG_OP
    USING ERRCODE = '23514', CONSTRAINT = 'cam_v2_durable_evidence_append_only';
END;
$$;

CREATE OR REPLACE FUNCTION mmc.cam_v2_enforce_principal_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, mmc
AS $$
BEGIN
  IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
     OR NEW.environment IS DISTINCT FROM OLD.environment
     OR NEW.id IS DISTINCT FROM OLD.id
     OR NEW.principal_kind IS DISTINCT FROM OLD.principal_kind
     OR NEW.auth_subject_digest IS DISTINCT FROM OLD.auth_subject_digest
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'principal durable identity is immutable'
      USING ERRCODE = '23514', CONSTRAINT = 'cam_v2_principal_identity_immutable';
  END IF;
  IF NEW.object_version IS DISTINCT FROM OLD.object_version + 1 THEN
    RAISE EXCEPTION 'principal mutation requires one exact version advance'
      USING ERRCODE = '23514', CONSTRAINT = 'cam_v2_principal_version_fence';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status AND NOT (
    (OLD.status = 'ACTIVE' AND NEW.status IN ('SUSPENDED', 'REVOKED', 'RETIRED'))
    OR (OLD.status = 'SUSPENDED' AND NEW.status IN ('ACTIVE', 'REVOKED', 'RETIRED'))
  ) THEN
    RAISE EXCEPTION 'principal lifecycle transition is not forward-safe'
      USING ERRCODE = '23514', CONSTRAINT = 'cam_v2_principal_lifecycle_forward';
  END IF;
  NEW.updated_at := clock_timestamp();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION mmc.cam_v2_enforce_subject_link_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, mmc
SET row_security = off
AS $$
DECLARE
  v_student_kind text;
  v_student_status text;
  v_verifier_kind text;
  v_verifier_status text;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
       OR NEW.environment IS DISTINCT FROM OLD.environment
       OR NEW.id IS DISTINCT FROM OLD.id
       OR NEW.external_subject_digest IS DISTINCT FROM OLD.external_subject_digest
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'subject-link durable identity is immutable'
        USING ERRCODE = '23514', CONSTRAINT = 'cam_v2_subject_link_identity_immutable';
    END IF;
    IF NEW.object_version IS DISTINCT FROM OLD.object_version + 1 THEN
      RAISE EXCEPTION 'subject-link mutation requires one exact version advance'
        USING ERRCODE = '23514', CONSTRAINT = 'cam_v2_subject_link_version_fence';
    END IF;
    IF OLD.identity_state IN ('VERIFIED_LOCAL_LINK', 'REVOKED') AND (
      NEW.student_principal_id IS DISTINCT FROM OLD.student_principal_id
      OR NEW.student_principal_kind IS DISTINCT FROM OLD.student_principal_kind
      OR NEW.independent_authority_count IS DISTINCT FROM OLD.independent_authority_count
      OR NEW.verified_by_principal_id IS DISTINCT FROM OLD.verified_by_principal_id
      OR NEW.verified_at IS DISTINCT FROM OLD.verified_at
    ) THEN
      RAISE EXCEPTION 'verified subject identity binding is immutable; corrections require a new link'
        USING ERRCODE = '23514', CONSTRAINT = 'cam_v2_subject_link_verified_binding_immutable';
    END IF;
    IF OLD.identity_state = 'VERIFIED_LOCAL_LINK'
       AND NEW.identity_state NOT IN ('VERIFIED_LOCAL_LINK', 'REVOKED') THEN
      RAISE EXCEPTION 'verified subject identity may only remain verified or be revoked'
        USING ERRCODE = '23514', CONSTRAINT = 'cam_v2_subject_link_lifecycle_forward';
    END IF;
    IF OLD.identity_state = 'REVOKED' AND (
      NEW.identity_state <> 'REVOKED'
      OR NEW.revoked_at IS DISTINCT FROM OLD.revoked_at
    ) THEN
      RAISE EXCEPTION 'revoked subject identity is terminal and retains its evidence'
        USING ERRCODE = '23514', CONSTRAINT = 'cam_v2_subject_link_lifecycle_forward';
    END IF;
    IF NEW.revoked_at IS DISTINCT FROM OLD.revoked_at AND NOT (
      OLD.identity_state = 'VERIFIED_LOCAL_LINK'
      AND NEW.identity_state = 'REVOKED'
      AND OLD.revoked_at IS NULL
      AND NEW.revoked_at IS NOT NULL
      AND NEW.revoked_at >= OLD.verified_at
    ) THEN
      RAISE EXCEPTION 'subject revocation time requires its exact forward transition'
        USING ERRCODE = '23514', CONSTRAINT = 'cam_v2_subject_link_revocation_exact';
    END IF;
    NEW.updated_at := clock_timestamp();
  END IF;

  IF NEW.identity_state = 'VERIFIED_LOCAL_LINK' THEN
    SELECT principal.principal_kind, principal.status
    INTO v_student_kind, v_student_status
    FROM mmc.cam_v2_principals AS principal
    WHERE principal.tenant_id = NEW.tenant_id
      AND principal.environment = NEW.environment
      AND principal.id = NEW.student_principal_id
    FOR SHARE;
    IF NOT FOUND OR v_student_kind <> 'STUDENT' OR v_student_status <> 'ACTIVE' THEN
      RAISE EXCEPTION 'verified subject requires an active exact student principal'
        USING ERRCODE = '23514', CONSTRAINT = 'cam_v2_subject_link_active_student';
    END IF;
    SELECT principal.principal_kind, principal.status
    INTO v_verifier_kind, v_verifier_status
    FROM mmc.cam_v2_principals AS principal
    WHERE principal.tenant_id = NEW.tenant_id
      AND principal.environment = NEW.environment
      AND principal.id = NEW.verified_by_principal_id
    FOR SHARE;
    IF NOT FOUND OR v_verifier_kind NOT IN ('MENTOR', 'ADMIN') OR v_verifier_status <> 'ACTIVE' THEN
      RAISE EXCEPTION 'verified subject requires an active mentor or administrator verifier'
        USING ERRCODE = '23514', CONSTRAINT = 'cam_v2_subject_link_active_verifier';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION mmc.cam_v2_enforce_assignment_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, mmc
SET row_security = off
AS $$
DECLARE
  v_tenant_status text;
  v_mentor_status text;
  v_subject_state text;
  v_subject_revoked_at timestamptz;
  v_student_status text;
  v_grantor_status text;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
       OR NEW.environment IS DISTINCT FROM OLD.environment
       OR NEW.id IS DISTINCT FROM OLD.id
       OR NEW.mentor_principal_id IS DISTINCT FROM OLD.mentor_principal_id
       OR NEW.mentor_principal_kind IS DISTINCT FROM OLD.mentor_principal_kind
       OR NEW.subject_link_id IS DISTINCT FROM OLD.subject_link_id
       OR NEW.assignment_scope IS DISTINCT FROM OLD.assignment_scope
       OR NEW.effective_at IS DISTINCT FROM OLD.effective_at
       OR NEW.expires_at IS DISTINCT FROM OLD.expires_at
       OR NEW.granted_by_principal_id IS DISTINCT FROM OLD.granted_by_principal_id
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'assignment identity and authority binding are immutable; reassignment requires a new row'
        USING ERRCODE = '23514', CONSTRAINT = 'cam_v2_assignment_binding_immutable';
    END IF;
    IF NEW.object_version IS DISTINCT FROM OLD.object_version + 1 THEN
      RAISE EXCEPTION 'assignment mutation requires one exact version advance'
        USING ERRCODE = '23514', CONSTRAINT = 'cam_v2_assignment_version_fence';
    END IF;
    IF OLD.status IN ('EXPIRED', 'REVOKED', 'REASSIGNED') THEN
      RAISE EXCEPTION 'terminal assignment evidence is immutable'
        USING ERRCODE = '23514', CONSTRAINT = 'cam_v2_assignment_lifecycle_forward';
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status AND NOT (
      (OLD.status = 'PROPOSED' AND NEW.status IN ('ACTIVE', 'REVOKED'))
      OR (OLD.status = 'ACTIVE' AND NEW.status IN ('EXPIRED', 'REVOKED', 'REASSIGNED'))
    ) THEN
      RAISE EXCEPTION 'assignment lifecycle transition is not forward-only'
        USING ERRCODE = '23514', CONSTRAINT = 'cam_v2_assignment_lifecycle_forward';
    END IF;
    IF NEW.revoked_at IS DISTINCT FROM OLD.revoked_at AND NOT (
      OLD.status IN ('PROPOSED', 'ACTIVE') AND NEW.status = 'REVOKED'
      AND OLD.revoked_at IS NULL AND NEW.revoked_at IS NOT NULL
    ) THEN
      RAISE EXCEPTION 'assignment revocation time requires its exact forward transition'
        USING ERRCODE = '23514', CONSTRAINT = 'cam_v2_assignment_revocation_exact';
    END IF;
    IF NEW.status = 'EXPIRED'
       AND (NEW.expires_at IS NULL OR NEW.expires_at > statement_timestamp()) THEN
      RAISE EXCEPTION 'assignment may be marked expired only after its fixed expiry'
        USING ERRCODE = '23514', CONSTRAINT = 'cam_v2_assignment_expiry_exact';
    END IF;
    NEW.updated_at := clock_timestamp();
  ELSE
    SELECT principal.status INTO v_grantor_status
    FROM mmc.cam_v2_principals AS principal
    WHERE principal.tenant_id = NEW.tenant_id
      AND principal.environment = NEW.environment
      AND principal.id = NEW.granted_by_principal_id
    FOR SHARE;
    IF NOT FOUND OR v_grantor_status <> 'ACTIVE' THEN
      RAISE EXCEPTION 'assignment creation requires an active granting principal'
        USING ERRCODE = '23514', CONSTRAINT = 'cam_v2_assignment_active_grantor';
    END IF;
    IF NEW.status = 'EXPIRED'
       AND (NEW.expires_at IS NULL OR NEW.expires_at > statement_timestamp()) THEN
      RAISE EXCEPTION 'historical expired assignment requires a fixed elapsed expiry'
        USING ERRCODE = '23514', CONSTRAINT = 'cam_v2_assignment_expiry_exact';
    END IF;
    IF NEW.status = 'REASSIGNED' THEN
      RAISE EXCEPTION 'an assignment cannot be born reassigned'
        USING ERRCODE = '23514', CONSTRAINT = 'cam_v2_assignment_initial_state';
    END IF;
  END IF;

  IF NEW.status = 'ACTIVE' THEN
    SELECT tenant.status, mentor.status, subject_link.identity_state,
           subject_link.revoked_at, student.status, grantor.status
    INTO v_tenant_status, v_mentor_status, v_subject_state,
         v_subject_revoked_at, v_student_status, v_grantor_status
    FROM mmc.cam_v2_tenants AS tenant
    JOIN mmc.cam_v2_principals AS mentor
      ON mentor.tenant_id = tenant.id
     AND mentor.environment = tenant.environment
    JOIN mmc.cam_v2_subject_links AS subject_link
      ON subject_link.tenant_id = NEW.tenant_id
     AND subject_link.environment = NEW.environment
     AND subject_link.id = NEW.subject_link_id
    JOIN mmc.cam_v2_principals AS student
      ON student.tenant_id = subject_link.tenant_id
     AND student.environment = subject_link.environment
     AND student.id = subject_link.student_principal_id
    JOIN mmc.cam_v2_principals AS grantor
      ON grantor.tenant_id = NEW.tenant_id
     AND grantor.environment = NEW.environment
     AND grantor.id = NEW.granted_by_principal_id
    WHERE tenant.id = NEW.tenant_id
      AND tenant.environment = NEW.environment
      AND mentor.id = NEW.mentor_principal_id
    FOR SHARE OF tenant, mentor, subject_link, student, grantor;
    IF NOT FOUND OR v_tenant_status <> 'ACTIVE'
       OR v_mentor_status <> 'ACTIVE'
       OR v_subject_state <> 'VERIFIED_LOCAL_LINK'
       OR v_subject_revoked_at IS NOT NULL
       OR v_student_status <> 'ACTIVE'
       OR v_grantor_status <> 'ACTIVE'
       OR NEW.effective_at > statement_timestamp()
       OR (NEW.expires_at IS NOT NULL AND NEW.expires_at <= statement_timestamp()) THEN
      RAISE EXCEPTION 'active assignment requires a current active tenant, grantor, mentor, and verified student scope'
        USING ERRCODE = '23514', CONSTRAINT = 'cam_v2_assignment_active_scope';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION mmc.cam_v2_enforce_policy_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, mmc
SET row_security = off
AS $$
DECLARE
  v_approver_kind text;
  v_approver_status text;
  v_tenant_status text;
BEGIN
  IF NEW.approved_by_principal_id IS NOT NULL
     AND NEW.status IN ('REVIEWED', 'ACTIVE')
     AND (TG_OP = 'INSERT'
       OR OLD.approved_by_principal_id IS NULL
       OR NEW.status IS DISTINCT FROM OLD.status) THEN
    SELECT principal.principal_kind, principal.status, tenant.status
    INTO v_approver_kind, v_approver_status, v_tenant_status
    FROM mmc.cam_v2_tenants AS tenant
    JOIN mmc.cam_v2_principals AS principal
      ON principal.tenant_id = tenant.id
     AND principal.environment = tenant.environment
    WHERE tenant.id = NEW.tenant_id
      AND tenant.environment = NEW.environment
      AND principal.id = NEW.approved_by_principal_id
    FOR SHARE OF tenant, principal;
    IF NOT FOUND OR v_tenant_status <> 'ACTIVE' OR v_approver_status <> 'ACTIVE'
       OR (NEW.policy_kind IN ('IDENTITY', 'ACQUISITION', 'TRANSCRIPT_PROCESSING', 'AI_TRANSFER', 'RETENTION')
         AND v_approver_kind <> 'ADMIN')
       OR (NEW.policy_kind IN ('ADVISING', 'EVIDENCE', 'PUBLICATION')
         AND v_approver_kind NOT IN ('MENTOR', 'ADMIN')) THEN
      RAISE EXCEPTION 'policy approver role or active status is invalid for its policy kind'
        USING ERRCODE = '23514', CONSTRAINT = 'cam_v2_policy_approver_exact';
    END IF;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
       OR NEW.environment IS DISTINCT FROM OLD.environment
       OR NEW.id IS DISTINCT FROM OLD.id
       OR NEW.policy_kind IS DISTINCT FROM OLD.policy_kind
       OR NEW.policy_version IS DISTINCT FROM OLD.policy_version
       OR NEW.policy_digest IS DISTINCT FROM OLD.policy_digest
       OR NEW.expires_at IS DISTINCT FROM OLD.expires_at
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'policy version identity and content are immutable'
        USING ERRCODE = '23514', CONSTRAINT = 'cam_v2_policy_version_immutable';
    END IF;
    IF NEW.object_version IS DISTINCT FROM OLD.object_version + 1 THEN
      RAISE EXCEPTION 'policy mutation requires one exact version advance'
        USING ERRCODE = '23514', CONSTRAINT = 'cam_v2_policy_version_fence';
    END IF;
    IF OLD.approved_by_principal_id IS NOT NULL
       AND NEW.approved_by_principal_id IS DISTINCT FROM OLD.approved_by_principal_id THEN
      RAISE EXCEPTION 'reviewed policy approval evidence is immutable'
        USING ERRCODE = '23514', CONSTRAINT = 'cam_v2_policy_approval_immutable';
    END IF;
    IF NEW.effective_at IS DISTINCT FROM OLD.effective_at AND NOT (
      OLD.status = 'REVIEWED' AND NEW.status = 'ACTIVE'
      AND OLD.effective_at IS NULL AND NEW.effective_at IS NOT NULL
    ) THEN
      RAISE EXCEPTION 'policy effective time may be fixed only on activation'
        USING ERRCODE = '23514', CONSTRAINT = 'cam_v2_policy_effective_at_exact';
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status AND NOT (
      (OLD.status = 'DRAFT' AND NEW.status = 'REVIEWED')
      OR (OLD.status = 'REVIEWED' AND NEW.status = 'ACTIVE')
      OR (OLD.status = 'ACTIVE' AND NEW.status = 'RETIRED')
    ) THEN
      RAISE EXCEPTION 'policy lifecycle transition is not forward-only'
        USING ERRCODE = '23514', CONSTRAINT = 'cam_v2_policy_lifecycle_forward';
    END IF;
    NEW.updated_at := clock_timestamp();
  END IF;
  IF NEW.status = 'ACTIVE' AND (
       NEW.effective_at IS NULL
       OR NEW.effective_at > statement_timestamp()
       OR (NEW.expires_at IS NOT NULL AND NEW.expires_at <= statement_timestamp())
     ) THEN
    RAISE EXCEPTION 'active policy requires a current fixed effectiveness window'
      USING ERRCODE = '23514', CONSTRAINT = 'cam_v2_policy_active_window';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION mmc.cam_v2_enforce_authority_grant_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, mmc
SET row_security = off
AS $$
DECLARE
  v_tenant_status text;
  v_policy_status text;
  v_assignment_status text;
  v_subject_state text;
  v_subject_revoked_at timestamptz;
  v_mentor_status text;
  v_student_status text;
  v_grantor_status text;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
       OR NEW.environment IS DISTINCT FROM OLD.environment
       OR NEW.id IS DISTINCT FROM OLD.id
       OR NEW.subject_link_id IS DISTINCT FROM OLD.subject_link_id
       OR NEW.assignment_id IS DISTINCT FROM OLD.assignment_id
       OR NEW.policy_version_id IS DISTINCT FROM OLD.policy_version_id
       OR NEW.grant_kind IS DISTINCT FROM OLD.grant_kind
       OR NEW.basis_digest IS DISTINCT FROM OLD.basis_digest
       OR NEW.effective_at IS DISTINCT FROM OLD.effective_at
       OR NEW.expires_at IS DISTINCT FROM OLD.expires_at
       OR NEW.granted_by_principal_id IS DISTINCT FROM OLD.granted_by_principal_id
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'authority grant provenance and scope are immutable'
        USING ERRCODE = '23514', CONSTRAINT = 'cam_v2_authority_grant_immutable';
    END IF;
    IF NEW.object_version IS DISTINCT FROM OLD.object_version + 1 THEN
      RAISE EXCEPTION 'authority-grant mutation requires one exact version advance'
        USING ERRCODE = '23514', CONSTRAINT = 'cam_v2_authority_grant_version_fence';
    END IF;
    IF OLD.status IN ('EXPIRED', 'REVOKED') THEN
      RAISE EXCEPTION 'terminal authority-grant evidence is immutable'
        USING ERRCODE = '23514', CONSTRAINT = 'cam_v2_authority_grant_lifecycle_forward';
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status AND NOT (
      (OLD.status = 'PROPOSED' AND NEW.status IN ('ACTIVE', 'REVOKED'))
      OR (OLD.status = 'ACTIVE' AND NEW.status IN ('EXPIRED', 'REVOKED'))
    ) THEN
      RAISE EXCEPTION 'authority-grant lifecycle transition is not forward-only'
        USING ERRCODE = '23514', CONSTRAINT = 'cam_v2_authority_grant_lifecycle_forward';
    END IF;
    IF NEW.revoked_at IS DISTINCT FROM OLD.revoked_at AND NOT (
      OLD.status IN ('PROPOSED', 'ACTIVE') AND NEW.status = 'REVOKED'
      AND OLD.revoked_at IS NULL AND NEW.revoked_at IS NOT NULL
    ) THEN
      RAISE EXCEPTION 'authority-grant revocation time requires its exact forward transition'
        USING ERRCODE = '23514', CONSTRAINT = 'cam_v2_authority_grant_revocation_exact';
    END IF;
    IF NEW.status = 'EXPIRED'
       AND (NEW.expires_at IS NULL OR NEW.expires_at > statement_timestamp()) THEN
      RAISE EXCEPTION 'authority grant may be marked expired only after its fixed expiry'
        USING ERRCODE = '23514', CONSTRAINT = 'cam_v2_authority_expiry_exact';
    END IF;
    NEW.updated_at := clock_timestamp();
  ELSE
    SELECT principal.status INTO v_grantor_status
    FROM mmc.cam_v2_principals AS principal
    WHERE principal.tenant_id = NEW.tenant_id
      AND principal.environment = NEW.environment
      AND principal.id = NEW.granted_by_principal_id
    FOR SHARE;
    IF NOT FOUND OR v_grantor_status <> 'ACTIVE' THEN
      RAISE EXCEPTION 'authority-grant creation requires an active granting principal'
        USING ERRCODE = '23514', CONSTRAINT = 'cam_v2_authority_active_grantor';
    END IF;
    IF NEW.status = 'EXPIRED'
       AND (NEW.expires_at IS NULL OR NEW.expires_at > statement_timestamp()) THEN
      RAISE EXCEPTION 'historical expired authority requires a fixed elapsed expiry'
        USING ERRCODE = '23514', CONSTRAINT = 'cam_v2_authority_expiry_exact';
    END IF;
  END IF;

  IF NEW.status = 'ACTIVE' THEN
    SELECT policy.status INTO v_policy_status
    FROM mmc.cam_v2_policy_versions AS policy
    WHERE policy.tenant_id = NEW.tenant_id
      AND policy.environment = NEW.environment
      AND policy.id = NEW.policy_version_id
      AND policy.policy_kind = NEW.grant_kind
      AND policy.effective_at <= statement_timestamp()
      AND (policy.expires_at IS NULL OR policy.expires_at > statement_timestamp())
    FOR SHARE;
    IF NOT FOUND OR v_policy_status <> 'ACTIVE' THEN
      RAISE EXCEPTION 'active authority grant requires an active exact policy'
        USING ERRCODE = '23514', CONSTRAINT = 'cam_v2_authority_active_policy';
    END IF;
    SELECT tenant.status, grantor.status
    INTO v_tenant_status, v_grantor_status
    FROM mmc.cam_v2_tenants AS tenant
    JOIN mmc.cam_v2_principals AS grantor
      ON grantor.tenant_id = tenant.id
     AND grantor.environment = tenant.environment
     AND grantor.id = NEW.granted_by_principal_id
    WHERE tenant.id = NEW.tenant_id
      AND tenant.environment = NEW.environment
    FOR SHARE OF tenant, grantor;
    IF NOT FOUND OR v_tenant_status <> 'ACTIVE' OR v_grantor_status <> 'ACTIVE'
       OR NEW.effective_at > statement_timestamp()
       OR (NEW.expires_at IS NOT NULL AND NEW.expires_at <= statement_timestamp()) THEN
      RAISE EXCEPTION 'active authority requires a current tenant, grantor, and fixed effectiveness window'
        USING ERRCODE = '23514', CONSTRAINT = 'cam_v2_authority_active_window';
    END IF;
    IF NEW.assignment_id IS NOT NULL THEN
      SELECT assignment.status, subject_link.identity_state, subject_link.revoked_at,
             mentor.status, student.status
      INTO v_assignment_status, v_subject_state, v_subject_revoked_at,
           v_mentor_status, v_student_status
      FROM mmc.cam_v2_assignments AS assignment
      JOIN mmc.cam_v2_subject_links AS subject_link
        ON subject_link.tenant_id = assignment.tenant_id
       AND subject_link.environment = assignment.environment
       AND subject_link.id = assignment.subject_link_id
      JOIN mmc.cam_v2_principals AS mentor
        ON mentor.tenant_id = assignment.tenant_id
       AND mentor.environment = assignment.environment
       AND mentor.id = assignment.mentor_principal_id
      JOIN mmc.cam_v2_principals AS student
        ON student.tenant_id = subject_link.tenant_id
       AND student.environment = subject_link.environment
       AND student.id = subject_link.student_principal_id
      WHERE assignment.tenant_id = NEW.tenant_id
        AND assignment.environment = NEW.environment
        AND assignment.id = NEW.assignment_id
        AND assignment.subject_link_id = NEW.subject_link_id
        AND assignment.effective_at <= statement_timestamp()
        AND (assignment.expires_at IS NULL OR assignment.expires_at > statement_timestamp())
      FOR SHARE OF assignment, subject_link, mentor, student;
      IF NOT FOUND OR v_assignment_status <> 'ACTIVE'
         OR v_subject_state <> 'VERIFIED_LOCAL_LINK'
         OR v_subject_revoked_at IS NOT NULL
         OR v_mentor_status <> 'ACTIVE'
         OR v_student_status <> 'ACTIVE' THEN
        RAISE EXCEPTION 'active scoped authority requires an active exact assignment and verified subject'
          USING ERRCODE = '23514', CONSTRAINT = 'cam_v2_authority_active_scope';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION mmc.cam_v2_enforce_versioned_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, mmc
AS $$
BEGIN
  IF NEW.created_at IS DISTINCT FROM OLD.created_at
     OR NEW.object_version IS DISTINCT FROM OLD.object_version + 1 THEN
    RAISE EXCEPTION '%.% requires immutable creation time and one exact version advance',
      TG_TABLE_NAME, TG_OP
      USING ERRCODE = '23514', CONSTRAINT = 'cam_v2_object_version_fence';
  END IF;
  NEW.updated_at := clock_timestamp();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION mmc.cam_v2_enforce_forward_state()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, mmc
AS $$
DECLARE
  v_column text := TG_ARGV[0];
  v_old text;
  v_new text;
  v_edge text;
  v_allowed boolean := false;
  v_index integer;
BEGIN
  IF NOT (to_jsonb(NEW) ? v_column) THEN
    RAISE EXCEPTION 'forward-state trigger references an absent column'
      USING ERRCODE = '42703';
  END IF;
  v_old := to_jsonb(OLD) ->> v_column;
  v_new := to_jsonb(NEW) ->> v_column;
  IF v_new IS NOT DISTINCT FROM v_old THEN RETURN NEW; END IF;
  v_edge := v_old || '>' || v_new;
  IF TG_NARGS > 1 THEN
    FOR v_index IN 1..TG_NARGS - 1 LOOP
      IF TG_ARGV[v_index] = v_edge THEN v_allowed := true; EXIT; END IF;
    END LOOP;
  END IF;
  IF NOT v_allowed THEN
    RAISE EXCEPTION '%.% lifecycle transition % is not forward-only',
      TG_TABLE_NAME, v_column, v_edge
      USING ERRCODE = '23514', CONSTRAINT = 'cam_v2_state_transition_forward';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION mmc.cam_v2_enforce_job_lease_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, mmc
SET row_security = off
AS $$
BEGIN
  IF OLD.status IN ('SUCCEEDED', 'FAILED', 'DEAD_LETTER', 'CANCELLED') THEN
    RAISE EXCEPTION 'terminal job evidence and completion identity are immutable'
      USING ERRCODE = '23514', CONSTRAINT = 'cam_v2_job_terminal_evidence_immutable';
  END IF;
  IF NEW.status = 'LEASED'
     AND (
       NEW.status IS DISTINCT FROM OLD.status
       OR NEW.lease_generation IS DISTINCT FROM OLD.lease_generation
     ) THEN
    IF NEW.attempt_count IS DISTINCT FROM OLD.attempt_count + 1
       OR NEW.lease_generation IS DISTINCT FROM OLD.lease_generation + 1
       OR NEW.lease_owner_principal_id IS NULL
       OR NEW.lease_expires_at IS NULL
       OR NEW.lease_expires_at <= statement_timestamp() THEN
      RAISE EXCEPTION 'new job lease requires one exact attempt/generation advance and a current owner window'
        USING ERRCODE = '23514', CONSTRAINT = 'cam_v2_job_lease_transition_exact';
    END IF;
    IF OLD.status IN ('LEASED', 'RUNNING') AND (
      OLD.lease_expires_at IS NULL
      OR OLD.lease_expires_at > statement_timestamp()
      OR OLD.external_dispatch_generation IS NOT NULL
      OR OLD.external_result_generation IS NOT NULL
    ) THEN
      RAISE EXCEPTION 'job reclaim requires an expired lease with no provider dispatch or result evidence'
        USING ERRCODE = '23514', CONSTRAINT = 'cam_v2_job_reclaim_exact';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Provider success is a durable relationship, not a status label. This
-- deferred constraint supports reconciliation RPCs that append their evidence
-- after the job update while still making the whole transaction fail closed.
CREATE OR REPLACE FUNCTION mmc.cam_v2_enforce_job_success_evidence()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, mmc
SET row_security = off
AS $$
DECLARE
  v_typed_handoff boolean := false;
BEGIN
  IF NEW.status <> 'SUCCEEDED' THEN RETURN NULL; END IF;
  IF NEW.external_outcome <> 'SUCCEEDED'
     OR NEW.external_dispatch_generation IS DISTINCT FROM NEW.lease_generation
     OR NEW.external_result_generation IS DISTINCT FROM NEW.lease_generation
     OR NEW.completed_lease_generation IS DISTINCT FROM NEW.lease_generation
     OR NEW.result_digest IS NULL
     OR NEW.external_result_digest IS DISTINCT FROM NEW.result_digest
     OR NEW.completion_result_digest IS DISTINCT FROM NEW.result_digest
     OR NOT EXISTS (
       SELECT 1 FROM mmc.cam_v2_outbox_events AS evidence
       WHERE evidence.tenant_id = NEW.tenant_id
         AND evidence.environment = NEW.environment
         AND evidence.job_id = NEW.id
         AND evidence.aggregate_kind = 'JOB_EXTERNAL_RESULT'
         AND evidence.aggregate_id = NEW.id
         AND evidence.aggregate_version = NEW.lease_generation
         AND evidence.external_lease_generation = NEW.lease_generation
         AND evidence.external_outcome = 'SUCCEEDED'
         AND evidence.external_result_digest = NEW.result_digest
         AND evidence.external_result_recorded_at = NEW.external_result_recorded_at
         AND evidence.external_provider_receipt_digest
           IS NOT DISTINCT FROM NEW.external_provider_receipt_digest
         AND evidence.external_provider_idempotency_proven
           IS NOT DISTINCT FROM NEW.external_provider_idempotency_proven
         AND evidence.external_provider_idempotency_key_digest
           IS NOT DISTINCT FROM NEW.provider_idempotency_key_digest
     ) THEN
    RAISE EXCEPTION 'successful job lacks exact generation-bound provider evidence'
      USING ERRCODE = '23514', CONSTRAINT = 'cam_v2_job_success_provider_evidence';
  END IF;

  IF NEW.job_kind = 'ASSET_ACQUISITION' THEN
    SELECT EXISTS (
      SELECT 1
      FROM mmc.cam_v2_job_inputs AS input
      JOIN mmc.cam_v2_source_assets AS source
        ON source.tenant_id = input.tenant_id
       AND source.environment = input.environment
       AND source.id = input.source_asset_id
       AND source.job_id = input.producer_job_id
       AND source.authority_grant_id = input.producer_authority_grant_id
       AND source.assignment_id = input.assignment_id
       AND source.subject_link_id = input.subject_link_id
      JOIN mmc.cam_v2_jobs AS consumer
        ON consumer.tenant_id = input.tenant_id
       AND consumer.environment = input.environment
       AND consumer.id = input.consumer_job_id
       AND consumer.authority_grant_id = input.consumer_authority_grant_id
       AND consumer.assignment_id = input.assignment_id
       AND consumer.subject_link_id = input.subject_link_id
       AND consumer.job_kind = 'TRANSCRIPT_PROCESSING'
      WHERE input.tenant_id = NEW.tenant_id
        AND input.environment = NEW.environment
        AND input.producer_job_id = NEW.id
        AND input.input_kind = 'SOURCE_ASSET'
        AND source.content_digest = NEW.result_digest
        AND source.asset_state IN ('PAIR_VERIFIED', 'ATTACHED', 'RETAINED')
    ) INTO v_typed_handoff;
  ELSIF NEW.job_kind = 'TRANSCRIPT_PROCESSING' THEN
    SELECT EXISTS (
      SELECT 1
      FROM mmc.cam_v2_job_inputs AS input
      JOIN mmc.cam_v2_transcript_versions AS transcript
        ON transcript.tenant_id = input.tenant_id
       AND transcript.environment = input.environment
       AND transcript.id = input.transcript_version_id
       AND transcript.job_id = input.producer_job_id
       AND transcript.authority_grant_id = input.producer_authority_grant_id
       AND transcript.assignment_id = input.assignment_id
       AND transcript.subject_link_id = input.subject_link_id
      JOIN mmc.cam_v2_jobs AS consumer
        ON consumer.tenant_id = input.tenant_id
       AND consumer.environment = input.environment
       AND consumer.id = input.consumer_job_id
       AND consumer.authority_grant_id = input.consumer_authority_grant_id
       AND consumer.assignment_id = input.assignment_id
       AND consumer.subject_link_id = input.subject_link_id
       AND consumer.job_kind = 'AI_ANALYSIS'
      WHERE input.tenant_id = NEW.tenant_id
        AND input.environment = NEW.environment
        AND input.producer_job_id = NEW.id
        AND input.input_kind = 'TRANSCRIPT_VERSION'
        AND transcript.normalized_digest = NEW.result_digest
        AND transcript.transcript_state = 'VERIFIED'
    ) INTO v_typed_handoff;
  ELSIF NEW.job_kind = 'AI_ANALYSIS' THEN
    SELECT EXISTS (
      SELECT 1
      FROM mmc.cam_v2_analysis_runs AS analysis
      JOIN mmc.cam_v2_job_inputs AS input
        ON input.tenant_id = analysis.tenant_id
       AND input.environment = analysis.environment
       AND input.consumer_job_id = analysis.job_id
       AND input.input_kind = 'TRANSCRIPT_VERSION'
       AND input.transcript_version_id = analysis.transcript_version_id
      WHERE analysis.tenant_id = NEW.tenant_id
        AND analysis.environment = NEW.environment
        AND analysis.job_id = NEW.id
        AND analysis.authority_grant_id = NEW.authority_grant_id
        AND analysis.assignment_id = NEW.assignment_id
        AND analysis.subject_link_id = NEW.subject_link_id
        AND analysis.analysis_state = 'PROPOSED'
        AND analysis.completed_at IS NOT NULL
        AND analysis.result_digest = NEW.result_digest
    ) INTO v_typed_handoff;
  END IF;
  IF NOT v_typed_handoff THEN
    RAISE EXCEPTION 'successful job lacks its immutable typed result handoff'
      USING ERRCODE = '23514', CONSTRAINT = 'cam_v2_job_success_typed_handoff';
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION mmc.cam_v2_enforce_outbox_delivered_effect()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, mmc
SET row_security = off
AS $$
BEGIN
  IF NEW.delivery_state <> 'DELIVERED' THEN RETURN NEW; END IF;
  IF TG_OP <> 'UPDATE' OR OLD.delivery_state <> 'LEASED'
     OR NOT EXISTS (
       SELECT 1
       FROM mmc.cam_v2_consumer_effects AS effect
       JOIN mmc.cam_v2_consumer_inbox AS inbox
         ON inbox.tenant_id = effect.tenant_id
        AND inbox.environment = effect.environment
        AND inbox.outbox_event_id = effect.outbox_event_id
        AND inbox.consumer_effect_id = effect.id
        AND inbox.job_id IS NOT DISTINCT FROM effect.source_job_id
        AND inbox.consumer_principal_id = effect.dispatcher_principal_id
        AND inbox.consumer_queue_name = effect.dispatcher_queue_name
        AND inbox.consumer_lease_generation = effect.dispatcher_lease_generation
        AND inbox.effect_digest = effect.effect_digest
       WHERE effect.tenant_id = NEW.tenant_id
         AND effect.environment = NEW.environment
         AND effect.outbox_event_id = NEW.id
         AND effect.source_job_id IS NOT DISTINCT FROM NEW.job_id
         AND effect.dispatcher_principal_id = OLD.delivery_lease_owner_principal_id
         AND effect.dispatcher_queue_name = NEW.delivery_queue_name
         AND effect.dispatcher_lease_generation = OLD.delivery_lease_generation
     ) THEN
    RAISE EXCEPTION 'delivered outbox event requires its exact lease-bound effect and inbox receipt'
      USING ERRCODE = '23514', CONSTRAINT = 'cam_v2_outbox_delivered_effect_exact';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION mmc.cam_v2_enforce_tenant_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, mmc
AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.environment IS DISTINCT FROM OLD.environment
     OR NEW.tenant_key IS DISTINCT FROM OLD.tenant_key
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'tenant durable scope identity is immutable'
      USING ERRCODE = '23514', CONSTRAINT = 'cam_v2_tenant_identity_immutable';
  END IF;
  IF NEW.object_version IS DISTINCT FROM OLD.object_version + 1 THEN
    RAISE EXCEPTION 'tenant mutation requires one exact version advance'
      USING ERRCODE = '23514', CONSTRAINT = 'cam_v2_tenant_version_fence';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status AND NOT (
    (OLD.status = 'ACTIVE' AND NEW.status IN ('SUSPENDED', 'RETIRED'))
    OR (OLD.status = 'SUSPENDED' AND NEW.status IN ('ACTIVE', 'RETIRED'))
  ) THEN
    RAISE EXCEPTION 'tenant lifecycle transition is not forward-safe'
      USING ERRCODE = '23514', CONSTRAINT = 'cam_v2_tenant_lifecycle_forward';
  END IF;
  NEW.updated_at := clock_timestamp();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION mmc.cam_v2_enforce_command_receipt_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, mmc
AS $$
BEGIN
  IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
     OR NEW.environment IS DISTINCT FROM OLD.environment
     OR NEW.id IS DISTINCT FROM OLD.id
     OR NEW.principal_id IS DISTINCT FROM OLD.principal_id
     OR NEW.command_id IS DISTINCT FROM OLD.command_id
     OR NEW.command_kind IS DISTINCT FROM OLD.command_kind
     OR NEW.target_kind IS DISTINCT FROM OLD.target_kind
     OR NEW.target_id IS DISTINCT FROM OLD.target_id
     OR NEW.expected_version IS DISTINCT FROM OLD.expected_version
     OR NEW.schema_version IS DISTINCT FROM OLD.schema_version
     OR NEW.semantic_command_digest IS DISTINCT FROM OLD.semantic_command_digest
     OR NEW.correlation_id IS DISTINCT FROM OLD.correlation_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'command receipt semantics are immutable'
      USING ERRCODE = '23514', CONSTRAINT = 'cam_v2_command_receipt_immutable';
  END IF;
  IF OLD.status <> 'RECEIVED' OR NEW.status NOT IN ('COMMITTED', 'CONFLICT', 'REJECTED', 'FAILED')
     OR NEW.status = OLD.status OR NEW.result_digest IS NULL THEN
    RAISE EXCEPTION 'command receipt permits exactly one received-to-terminal transition'
      USING ERRCODE = '23514', CONSTRAINT = 'cam_v2_command_receipt_terminal_once';
  END IF;
  IF NEW.object_version IS DISTINCT FROM OLD.object_version + 1 THEN
    RAISE EXCEPTION 'command receipt mutation requires one exact version advance'
      USING ERRCODE = '23514', CONSTRAINT = 'cam_v2_command_receipt_version_fence';
  END IF;
  NEW.updated_at := clock_timestamp();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION mmc.cam_v2_enforce_lineage_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, mmc
AS $$
BEGIN
  IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
     OR NEW.environment IS DISTINCT FROM OLD.environment
     OR NEW.id IS DISTINCT FROM OLD.id
     OR NEW.from_kind IS DISTINCT FROM OLD.from_kind
     OR NEW.from_id IS DISTINCT FROM OLD.from_id
     OR NEW.from_version IS DISTINCT FROM OLD.from_version
     OR NEW.to_kind IS DISTINCT FROM OLD.to_kind
     OR NEW.to_id IS DISTINCT FROM OLD.to_id
     OR NEW.to_version IS DISTINCT FROM OLD.to_version
     OR NEW.relation_kind IS DISTINCT FROM OLD.relation_kind
     OR NEW.transform_digest IS DISTINCT FROM OLD.transform_digest
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'lineage provenance is immutable'
      USING ERRCODE = '23514', CONSTRAINT = 'cam_v2_lineage_core_immutable';
  END IF;
  IF OLD.invalidated_at IS NOT NULL
     OR NEW.invalidated_at IS NULL
     OR NEW.invalidated_at < OLD.created_at
     OR NEW.object_version IS DISTINCT FROM OLD.object_version + 1 THEN
    RAISE EXCEPTION 'lineage permits one exact null-to-invalidated transition'
      USING ERRCODE = '23514', CONSTRAINT = 'cam_v2_lineage_invalidation_once';
  END IF;
  NEW.updated_at := clock_timestamp();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION mmc.cam_v2_resolve_lineage_endpoint(
  p_tenant_id uuid, p_environment text, p_kind text, p_id uuid, p_version bigint
)
RETURNS TABLE (subject_link_id uuid, assignment_id uuid)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, mmc
SET row_security = off
AS $$
BEGIN
  CASE p_kind
    WHEN 'SOURCE_ASSET' THEN
      RETURN QUERY SELECT source.subject_link_id, source.assignment_id
      FROM mmc.cam_v2_source_assets AS source
      WHERE source.tenant_id = p_tenant_id AND source.environment = p_environment
        AND source.id = p_id AND source.object_version = p_version FOR SHARE;
    WHEN 'TRANSCRIPT_VERSION' THEN
      RETURN QUERY SELECT transcript.subject_link_id, transcript.assignment_id
      FROM mmc.cam_v2_transcript_versions AS transcript
      WHERE transcript.tenant_id = p_tenant_id AND transcript.environment = p_environment
        AND transcript.id = p_id AND transcript.object_version = p_version FOR SHARE;
    WHEN 'EVIDENCE_SPAN' THEN
      RETURN QUERY SELECT span.subject_link_id, span.assignment_id
      FROM mmc.cam_v2_evidence_spans AS span
      WHERE span.tenant_id = p_tenant_id AND span.environment = p_environment
        AND span.id = p_id AND span.object_version = p_version FOR SHARE;
    WHEN 'AI_PROPOSAL' THEN
      RETURN QUERY SELECT proposal.subject_link_id, proposal.assignment_id
      FROM mmc.cam_v2_ai_proposals AS proposal
      WHERE proposal.tenant_id = p_tenant_id AND proposal.environment = p_environment
        AND proposal.id = p_id AND proposal.object_version = p_version FOR SHARE;
    WHEN 'REVIEW_DECISION' THEN
      RETURN QUERY SELECT decision.subject_link_id, decision.assignment_id
      FROM mmc.cam_v2_review_decisions AS decision
      WHERE decision.tenant_id = p_tenant_id AND decision.environment = p_environment
        AND decision.id = p_id AND decision.object_version = p_version FOR SHARE;
    WHEN 'SESSION' THEN
      RETURN QUERY SELECT session.subject_link_id, session.assignment_id
      FROM mmc.cam_v2_sessions AS session
      WHERE session.tenant_id = p_tenant_id AND session.environment = p_environment
        AND session.id = p_id AND session.object_version = p_version FOR SHARE;
    WHEN 'TASK' THEN
      RETURN QUERY SELECT task.subject_link_id, task.assignment_id
      FROM mmc.cam_v2_tasks AS task
      WHERE task.tenant_id = p_tenant_id AND task.environment = p_environment
        AND task.id = p_id AND task.object_version = p_version FOR SHARE;
    WHEN 'COMMITMENT' THEN
      RETURN QUERY SELECT commitment.subject_link_id, commitment.assignment_id
      FROM mmc.cam_v2_commitments AS commitment
      WHERE commitment.tenant_id = p_tenant_id AND commitment.environment = p_environment
        AND commitment.id = p_id AND commitment.object_version = p_version FOR SHARE;
    WHEN 'GOAL' THEN
      RETURN QUERY SELECT goal.subject_link_id, goal.assignment_id
      FROM mmc.cam_v2_goals AS goal
      WHERE goal.tenant_id = p_tenant_id AND goal.environment = p_environment
        AND goal.id = p_id AND goal.object_version = p_version FOR SHARE;
    WHEN 'MILESTONE' THEN
      RETURN QUERY SELECT milestone.subject_link_id, milestone.assignment_id
      FROM mmc.cam_v2_milestones AS milestone
      WHERE milestone.tenant_id = p_tenant_id AND milestone.environment = p_environment
        AND milestone.id = p_id AND milestone.object_version = p_version FOR SHARE;
    WHEN 'STUDENT_STATEMENT' THEN
      RETURN QUERY SELECT statement.subject_link_id, NULL::uuid
      FROM mmc.cam_v2_student_statements AS statement
      WHERE statement.tenant_id = p_tenant_id AND statement.environment = p_environment
        AND statement.id = p_id AND statement.object_version = p_version FOR SHARE;
    WHEN 'PUBLICATION' THEN
      RETURN QUERY SELECT publication.subject_link_id, publication.authoring_assignment_id
      FROM mmc.cam_v2_publications AS publication
      WHERE publication.tenant_id = p_tenant_id AND publication.environment = p_environment
        AND publication.id = p_id AND publication.object_version = p_version FOR SHARE;
    WHEN 'PUBLICATION_ITEM' THEN
      RETURN QUERY SELECT item.subject_link_id, publication.authoring_assignment_id
      FROM mmc.cam_v2_publication_items AS item
      JOIN mmc.cam_v2_publications AS publication
        ON publication.tenant_id = item.tenant_id
       AND publication.environment = item.environment
       AND publication.id = item.publication_id
       AND publication.subject_link_id = item.subject_link_id
      WHERE item.tenant_id = p_tenant_id AND item.environment = p_environment
        AND item.id = p_id AND item.object_version = p_version
      FOR SHARE OF item, publication;
    ELSE
      RAISE EXCEPTION 'lineage endpoint kind is not a governed CAM v2 object'
        USING ERRCODE = '23514', CONSTRAINT = 'cam_v2_lineage_endpoint_kind';
  END CASE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'lineage endpoint exact version does not exist'
      USING ERRCODE = '23514', CONSTRAINT = 'cam_v2_lineage_endpoint_exists';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION mmc.cam_v2_enforce_lineage_endpoints()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, mmc
SET row_security = off
AS $$
DECLARE
  v_from_subject uuid;
  v_from_assignment uuid;
  v_to_subject uuid;
  v_to_assignment uuid;
BEGIN
  IF NOT (
    (NEW.relation_kind = 'SOURCE_TO_SPAN'
      AND NEW.from_kind IN ('SOURCE_ASSET', 'TRANSCRIPT_VERSION')
      AND NEW.to_kind = 'EVIDENCE_SPAN')
    OR (NEW.relation_kind = 'SPAN_TO_PROPOSAL'
      AND NEW.from_kind = 'EVIDENCE_SPAN' AND NEW.to_kind = 'AI_PROPOSAL')
    OR (NEW.relation_kind = 'SOURCE_TO_PROPOSAL'
      AND NEW.from_kind IN ('SOURCE_ASSET', 'TRANSCRIPT_VERSION')
      AND NEW.to_kind = 'AI_PROPOSAL')
    OR (NEW.relation_kind = 'PROPOSAL_TO_CANONICAL'
      AND NEW.from_kind = 'AI_PROPOSAL'
      AND NEW.to_kind IN ('SESSION', 'TASK', 'COMMITMENT', 'GOAL', 'MILESTONE', 'STUDENT_STATEMENT', 'REVIEW_DECISION'))
    OR (NEW.relation_kind = 'SOURCE_TO_CANONICAL'
      AND NEW.from_kind IN ('SOURCE_ASSET', 'TRANSCRIPT_VERSION', 'EVIDENCE_SPAN')
      AND NEW.to_kind IN ('SESSION', 'TASK', 'COMMITMENT', 'GOAL', 'MILESTONE', 'STUDENT_STATEMENT', 'REVIEW_DECISION'))
    OR (NEW.relation_kind = 'CANONICAL_TO_PUBLICATION'
      AND NEW.from_kind IN ('SESSION', 'TASK', 'COMMITMENT', 'GOAL', 'MILESTONE', 'STUDENT_STATEMENT', 'REVIEW_DECISION')
      AND NEW.to_kind IN ('PUBLICATION', 'PUBLICATION_ITEM'))
    OR (NEW.relation_kind = 'CANONICAL_TO_JUDGMENT'
      AND NEW.from_kind IN ('SESSION', 'TASK', 'COMMITMENT', 'GOAL', 'MILESTONE', 'STUDENT_STATEMENT')
      AND NEW.to_kind = 'REVIEW_DECISION')
  ) THEN
    RAISE EXCEPTION 'lineage relation and endpoint kinds are incompatible'
      USING ERRCODE = '23514', CONSTRAINT = 'cam_v2_lineage_relation_compatible';
  END IF;
  SELECT endpoint.subject_link_id, endpoint.assignment_id
  INTO v_from_subject, v_from_assignment
  FROM mmc.cam_v2_resolve_lineage_endpoint(
    NEW.tenant_id, NEW.environment, NEW.from_kind, NEW.from_id, NEW.from_version
  ) AS endpoint;
  SELECT endpoint.subject_link_id, endpoint.assignment_id
  INTO v_to_subject, v_to_assignment
  FROM mmc.cam_v2_resolve_lineage_endpoint(
    NEW.tenant_id, NEW.environment, NEW.to_kind, NEW.to_id, NEW.to_version
  ) AS endpoint;
  IF v_from_subject IS DISTINCT FROM v_to_subject
     OR (v_from_assignment IS NOT NULL AND v_to_assignment IS NOT NULL
       AND v_from_assignment IS DISTINCT FROM v_to_assignment) THEN
    RAISE EXCEPTION 'lineage endpoints do not share one exact subject and assignment scope'
      USING ERRCODE = '23514', CONSTRAINT = 'cam_v2_lineage_scope_exact';
  END IF;
  RETURN NEW;
END;
$$;

-- An active edge names one exact endpoint version. Endpoint rows are updated
-- in place, so advancing that version without first invalidating the edge
-- would silently leave authoritative lineage pointing at a version that can
-- no longer be resolved. Callers must invalidate/supersede active edges in the
-- same governed workflow before advancing a referenced endpoint.
CREATE OR REPLACE FUNCTION mmc.cam_v2_guard_active_lineage_endpoint_version()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, mmc
SET row_security = off
AS $$
DECLARE
  v_kind text := upper(coalesce(TG_ARGV[0], ''));
BEGIN
  IF NEW.object_version IS DISTINCT FROM OLD.object_version
     AND EXISTS (
       SELECT 1
       FROM mmc.cam_v2_lineage_edges AS edge
       WHERE edge.tenant_id = OLD.tenant_id
         AND edge.environment = OLD.environment
         AND edge.invalidated_at IS NULL
         AND (
           (edge.from_kind = v_kind AND edge.from_id = OLD.id
             AND edge.from_version = OLD.object_version)
           OR (edge.to_kind = v_kind AND edge.to_id = OLD.id
             AND edge.to_version = OLD.object_version)
         )
     ) THEN
    RAISE EXCEPTION 'active lineage must be invalidated before advancing endpoint %.%',
      v_kind, OLD.id
      USING ERRCODE = '23514', CONSTRAINT = 'cam_v2_lineage_active_endpoint_version';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION mmc.cam_v2_enforce_cutover_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, mmc
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.writer_state <> 'SEALED_NO_WRITER'
       OR NEW.reads_enabled OR NEW.commands_enabled OR NEW.ingest_enabled
       OR NEW.ai_proposal_enabled OR NEW.operational_promotion_enabled
       OR NEW.student_publication_enabled
       OR NEW.v1_inventory_digest IS NOT NULL
       OR NEW.v2_inventory_digest IS NOT NULL
       OR NEW.reconciliation_digest IS NOT NULL
       OR NEW.first_v2_acknowledged_at IS NOT NULL THEN
      RAISE EXCEPTION 'cutover must be born sealed with no enabled plane or preclaimed evidence'
        USING ERRCODE = '23514', CONSTRAINT = 'cam_v2_cutover_initially_sealed';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
     OR NEW.environment IS DISTINCT FROM OLD.environment
     OR NEW.id IS DISTINCT FROM OLD.id
     OR NEW.component_name IS DISTINCT FROM OLD.component_name
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'cutover scope identity is immutable'
      USING ERRCODE = '23514', CONSTRAINT = 'cam_v2_cutover_identity_immutable';
  END IF;
  IF (OLD.v1_inventory_digest IS NOT NULL
      AND NEW.v1_inventory_digest IS DISTINCT FROM OLD.v1_inventory_digest)
     OR (OLD.v2_inventory_digest IS NOT NULL
      AND NEW.v2_inventory_digest IS DISTINCT FROM OLD.v2_inventory_digest)
     OR (OLD.reconciliation_digest IS NOT NULL
      AND NEW.reconciliation_digest IS DISTINCT FROM OLD.reconciliation_digest)
     OR (OLD.first_v2_acknowledged_at IS NOT NULL
      AND NEW.first_v2_acknowledged_at IS DISTINCT FROM OLD.first_v2_acknowledged_at) THEN
    RAISE EXCEPTION 'fixed cutover evidence is immutable'
      USING ERRCODE = '23514', CONSTRAINT = 'cam_v2_cutover_evidence_immutable';
  END IF;
  IF NEW.object_version IS DISTINCT FROM OLD.object_version + 1 THEN
    RAISE EXCEPTION 'cutover mutation requires one exact version advance'
      USING ERRCODE = '23514', CONSTRAINT = 'cam_v2_cutover_version_fence';
  END IF;
  IF NEW.writer_state IS DISTINCT FROM OLD.writer_state AND NOT (
    (OLD.writer_state = 'SEALED_NO_WRITER' AND NEW.writer_state IN ('SHADOW_READS', 'V1_FROZEN'))
    OR (OLD.writer_state = 'SHADOW_READS' AND NEW.writer_state = 'V1_FROZEN')
    OR (OLD.writer_state = 'V1_FROZEN' AND NEW.writer_state = 'V2_ACTIVE')
    OR (OLD.writer_state = 'V2_ACTIVE' AND NEW.writer_state = 'FORWARD_REPAIR')
  ) THEN
    RAISE EXCEPTION 'cutover writer transition is not forward-only'
      USING ERRCODE = '23514', CONSTRAINT = 'cam_v2_cutover_lifecycle_forward';
  END IF;
  IF NEW.writer_state = 'V2_ACTIVE' AND (
       NEW.v1_inventory_digest IS NULL
       OR NEW.v2_inventory_digest IS NULL
       OR NEW.reconciliation_digest IS NULL
       OR NEW.first_v2_acknowledged_at IS NULL
     ) THEN
    RAISE EXCEPTION 'v2 activation requires complete fixed reconciliation evidence'
      USING ERRCODE = '23514', CONSTRAINT = 'cam_v2_cutover_activation_evidence';
  END IF;
  IF OLD.writer_state = 'V2_ACTIVE' AND NEW.writer_state = 'V2_ACTIVE' AND (
       NEW.reads_enabled IS DISTINCT FROM OLD.reads_enabled
       OR NEW.commands_enabled IS DISTINCT FROM OLD.commands_enabled
       OR NEW.ingest_enabled IS DISTINCT FROM OLD.ingest_enabled
       OR NEW.ai_proposal_enabled IS DISTINCT FROM OLD.ai_proposal_enabled
       OR NEW.operational_promotion_enabled IS DISTINCT FROM OLD.operational_promotion_enabled
       OR NEW.student_publication_enabled IS DISTINCT FROM OLD.student_publication_enabled
     ) THEN
    RAISE EXCEPTION 'active cutover planes are frozen; incident shutdown requires FORWARD_REPAIR'
      USING ERRCODE = '23514', CONSTRAINT = 'cam_v2_cutover_active_planes_frozen';
  END IF;
  IF NEW.student_publication_enabled AND NOT (
       NEW.reads_enabled AND NEW.commands_enabled
       AND NEW.ingest_enabled AND NEW.ai_proposal_enabled
       AND NEW.operational_promotion_enabled
     ) THEN
    RAISE EXCEPTION 'student publication requires every upstream v2 plane'
      USING ERRCODE = '23514', CONSTRAINT = 'cam_v2_cutover_plane_dependency';
  END IF;
  IF NEW.operational_promotion_enabled AND NOT (
       NEW.reads_enabled AND NEW.commands_enabled
       AND NEW.ingest_enabled AND NEW.ai_proposal_enabled
     ) THEN
    RAISE EXCEPTION 'operational promotion requires read, command, ingest, and proposal planes'
      USING ERRCODE = '23514', CONSTRAINT = 'cam_v2_cutover_plane_dependency';
  END IF;
  IF NEW.ai_proposal_enabled AND NOT (
       NEW.reads_enabled AND NEW.commands_enabled AND NEW.ingest_enabled
     ) THEN
    RAISE EXCEPTION 'AI proposal requires read, command, and ingest planes'
      USING ERRCODE = '23514', CONSTRAINT = 'cam_v2_cutover_plane_dependency';
  END IF;
  IF NEW.ingest_enabled AND NOT (NEW.reads_enabled AND NEW.commands_enabled) THEN
    RAISE EXCEPTION 'ingest requires read and command planes'
      USING ERRCODE = '23514', CONSTRAINT = 'cam_v2_cutover_plane_dependency';
  END IF;
  NEW.updated_at := clock_timestamp();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION mmc.cam_v2_lock_active_publication_authority(
  p_tenant_id uuid,
  p_environment text,
  p_subject_link_id uuid,
  p_assignment_id uuid,
  p_authority_grant_id uuid,
  p_policy_version_id uuid,
  p_approved_by_principal_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, mmc
SET row_security = off
AS $$
DECLARE
  v_now timestamptz := clock_timestamp();
  v_assignment_mentor_id uuid;
  v_approver_kind text;
  v_approver_status text;
BEGIN
  SELECT assignment.mentor_principal_id INTO v_assignment_mentor_id
  FROM mmc.cam_v2_tenants AS tenant
  JOIN mmc.cam_v2_subject_links AS subject_link
    ON subject_link.tenant_id = tenant.id
   AND subject_link.environment = tenant.environment
   AND subject_link.id = p_subject_link_id
  JOIN mmc.cam_v2_principals AS student
    ON student.tenant_id = subject_link.tenant_id
   AND student.environment = subject_link.environment
   AND student.id = subject_link.student_principal_id
   AND student.principal_kind = 'STUDENT'
  JOIN mmc.cam_v2_assignments AS assignment
    ON assignment.tenant_id = subject_link.tenant_id
   AND assignment.environment = subject_link.environment
   AND assignment.id = p_assignment_id
   AND assignment.subject_link_id = subject_link.id
  JOIN mmc.cam_v2_principals AS mentor
    ON mentor.tenant_id = assignment.tenant_id
   AND mentor.environment = assignment.environment
   AND mentor.id = assignment.mentor_principal_id
   AND mentor.principal_kind = 'MENTOR'
  JOIN mmc.cam_v2_authority_grants AS authority
    ON authority.tenant_id = assignment.tenant_id
   AND authority.environment = assignment.environment
   AND authority.id = p_authority_grant_id
   AND authority.assignment_id = assignment.id
   AND authority.subject_link_id = subject_link.id
   AND authority.grant_kind = 'PUBLICATION'
  JOIN mmc.cam_v2_policy_versions AS policy
    ON policy.tenant_id = authority.tenant_id
   AND policy.environment = authority.environment
   AND policy.id = p_policy_version_id
   AND policy.id = authority.policy_version_id
   AND policy.policy_kind = 'PUBLICATION'
  JOIN mmc.cam_v2_cutover_states AS cutover
    ON cutover.tenant_id = tenant.id
   AND cutover.environment = tenant.environment
   AND cutover.component_name = 'MMC_CANONICAL'
  WHERE tenant.id = p_tenant_id
    AND tenant.environment = p_environment
    AND tenant.status = 'ACTIVE'
    AND subject_link.identity_state = 'VERIFIED_LOCAL_LINK'
    AND subject_link.revoked_at IS NULL
    AND student.status = 'ACTIVE'
    AND assignment.assignment_scope = 'COACHING'
    AND assignment.status = 'ACTIVE'
    AND assignment.effective_at <= v_now
    AND (assignment.expires_at IS NULL OR assignment.expires_at > v_now)
    AND assignment.revoked_at IS NULL
    AND mentor.status = 'ACTIVE'
    AND authority.status = 'ACTIVE'
    AND authority.effective_at <= v_now
    AND (authority.expires_at IS NULL OR authority.expires_at > v_now)
    AND authority.revoked_at IS NULL
    AND policy.status = 'ACTIVE'
    AND policy.effective_at <= v_now
    AND (policy.expires_at IS NULL OR policy.expires_at > v_now)
    AND cutover.writer_state = 'V2_ACTIVE'
    AND cutover.student_publication_enabled
  FOR SHARE OF tenant, subject_link, student, assignment, mentor,
    authority, policy, cutover;
  IF NOT FOUND THEN RETURN false; END IF;
  IF p_approved_by_principal_id IS NOT NULL THEN
    SELECT principal.principal_kind, principal.status
    INTO v_approver_kind, v_approver_status
    FROM mmc.cam_v2_principals AS principal
    WHERE principal.tenant_id = p_tenant_id
      AND principal.environment = p_environment
      AND principal.id = p_approved_by_principal_id
    FOR SHARE;
    IF NOT FOUND OR v_approver_status <> 'ACTIVE'
       OR NOT (
         (v_approver_kind = 'MENTOR'
           AND p_approved_by_principal_id = v_assignment_mentor_id)
         OR v_approver_kind = 'ADMIN'
       ) THEN
      RETURN false;
    END IF;
  END IF;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION mmc.cam_v2_lock_active_publication_student(
  p_tenant_id uuid, p_environment text, p_subject_link_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, mmc
SET row_security = off
AS $$
BEGIN
  IF mmc.cam_v2_current_tenant_id() IS DISTINCT FROM p_tenant_id
     OR mmc.cam_v2_current_environment() IS DISTINCT FROM p_environment
     OR mmc.cam_v2_current_subject_link_id() IS DISTINCT FROM p_subject_link_id
     OR mmc.cam_v2_current_principal_kind() <> 'STUDENT'
     OR NOT mmc.cam_v2_has_capability('mmc.student.respond') THEN
    RETURN false;
  END IF;
  PERFORM 1
  FROM mmc.cam_v2_tenants AS tenant
  JOIN mmc.cam_v2_subject_links AS subject_link
    ON subject_link.tenant_id = tenant.id
   AND subject_link.environment = tenant.environment
   AND subject_link.id = p_subject_link_id
  JOIN mmc.cam_v2_principals AS student
    ON student.tenant_id = subject_link.tenant_id
   AND student.environment = subject_link.environment
   AND student.id = subject_link.student_principal_id
   AND student.principal_kind = 'STUDENT'
  JOIN mmc.cam_v2_cutover_states AS cutover
    ON cutover.tenant_id = tenant.id
   AND cutover.environment = tenant.environment
   AND cutover.component_name = 'MMC_CANONICAL'
  WHERE tenant.id = p_tenant_id
    AND tenant.environment = p_environment
    AND tenant.status = 'ACTIVE'
    AND subject_link.identity_state = 'VERIFIED_LOCAL_LINK'
    AND subject_link.revoked_at IS NULL
    AND student.id = mmc.cam_v2_current_principal_id()
    AND student.status = 'ACTIVE'
    AND cutover.writer_state = 'V2_ACTIVE'
    AND cutover.student_publication_enabled
  FOR SHARE OF tenant, subject_link, student, cutover;
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION mmc.cam_v2_enforce_publication_authority()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, mmc
SET row_security = off
AS $$
DECLARE
  v_requires_active boolean := true;
  v_publication mmc.cam_v2_publications%ROWTYPE;
BEGIN
  IF TG_TABLE_NAME = 'cam_v2_publications' THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    IF TG_OP = 'UPDATE' AND NEW.publication_state IS DISTINCT FROM OLD.publication_state
       AND NEW.publication_state = 'ACKNOWLEDGED' THEN
      IF NOT mmc.cam_v2_lock_active_publication_student(
        NEW.tenant_id, NEW.environment, NEW.subject_link_id
      ) THEN
        RAISE EXCEPTION 'publication acknowledgement requires the exact active student identity'
          USING ERRCODE = '42501', CONSTRAINT = 'cam_v2_publication_ack_student_exact';
      END IF;
      v_requires_active := false;
    ELSIF TG_OP = 'UPDATE' AND NEW.publication_state IS DISTINCT FROM OLD.publication_state
       AND NEW.publication_state IN ('SUPERSEDED', 'WITHDRAWN', 'EXPIRED') THEN
      v_requires_active := false;
    ELSIF TG_OP = 'UPDATE' AND OLD.publication_state IN (
      'PUBLISHED', 'ACKNOWLEDGED', 'CORRECTED', 'SUPERSEDED', 'WITHDRAWN', 'EXPIRED'
    ) THEN
      v_requires_active := false;
    END IF;
    IF v_requires_active AND NOT mmc.cam_v2_lock_active_publication_authority(
      NEW.tenant_id, NEW.environment, NEW.subject_link_id,
      NEW.authoring_assignment_id, NEW.authority_grant_id,
      NEW.policy_version_id, NEW.approved_by_principal_id
    ) THEN
      RAISE EXCEPTION 'publication creation or promotion lacks current exact authority'
        USING ERRCODE = '42501', CONSTRAINT = 'cam_v2_publication_active_authority';
    END IF;
    IF TG_OP = 'UPDATE' AND OLD.approved_by_principal_id IS NOT NULL
       AND NEW.approved_by_principal_id IS DISTINCT FROM OLD.approved_by_principal_id THEN
      RAISE EXCEPTION 'publication approver is immutable after approval'
        USING ERRCODE = '23514', CONSTRAINT = 'cam_v2_publication_approver_immutable';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  SELECT publication.* INTO v_publication
  FROM mmc.cam_v2_publications AS publication
  WHERE publication.tenant_id = NEW.tenant_id
    AND publication.environment = NEW.environment
    AND publication.id = NEW.publication_id
    AND publication.subject_link_id = NEW.subject_link_id
  FOR UPDATE;
  IF NOT FOUND OR NOT mmc.cam_v2_lock_active_publication_authority(
    v_publication.tenant_id, v_publication.environment,
    v_publication.subject_link_id, v_publication.authoring_assignment_id,
    v_publication.authority_grant_id, v_publication.policy_version_id,
    v_publication.approved_by_principal_id
  ) THEN
    RAISE EXCEPTION 'publication item mutation lacks current exact authority'
      USING ERRCODE = '42501', CONSTRAINT = 'cam_v2_publication_item_active_authority';
  END IF;

  CASE NEW.source_object_kind
    WHEN 'SESSION_SUMMARY' THEN
      PERFORM 1 FROM mmc.cam_v2_sessions AS source
      WHERE source.tenant_id = NEW.tenant_id AND source.environment = NEW.environment
        AND source.id = NEW.source_object_id AND source.object_version = NEW.source_object_version
      FOR SHARE;
    WHEN 'TASK' THEN
      PERFORM 1 FROM mmc.cam_v2_tasks AS source
      WHERE source.tenant_id = NEW.tenant_id AND source.environment = NEW.environment
        AND source.id = NEW.source_object_id AND source.object_version = NEW.source_object_version
      FOR SHARE;
    WHEN 'GOAL', 'PLAN_UPDATE' THEN
      PERFORM 1 FROM mmc.cam_v2_goals AS source
      WHERE source.tenant_id = NEW.tenant_id AND source.environment = NEW.environment
        AND source.id = NEW.source_object_id AND source.object_version = NEW.source_object_version
      FOR SHARE;
    WHEN 'MILESTONE' THEN
      PERFORM 1 FROM mmc.cam_v2_milestones AS source
      WHERE source.tenant_id = NEW.tenant_id AND source.environment = NEW.environment
        AND source.id = NEW.source_object_id AND source.object_version = NEW.source_object_version
      FOR SHARE;
    WHEN 'FEEDBACK', 'CORRECTION', 'WITHDRAWAL_DECISION' THEN
      PERFORM 1 FROM mmc.cam_v2_review_decisions AS source
      WHERE source.tenant_id = NEW.tenant_id AND source.environment = NEW.environment
        AND source.id = NEW.source_object_id AND source.object_version = NEW.source_object_version
      FOR SHARE;
    ELSE
      RAISE EXCEPTION 'publication item source kind is not lockable'
        USING ERRCODE = '23514', CONSTRAINT = 'cam_v2_publication_item_source_lock';
  END CASE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'publication item exact source version is absent'
      USING ERRCODE = '23514', CONSTRAINT = 'cam_v2_publication_item_source_lock';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION mmc.cam_v2_enforce_review_decision_authority()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, mmc
SET row_security = off
AS $$
DECLARE
  v_now timestamptz := clock_timestamp();
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'review decisions are append-only; a later decision must supersede'
      USING ERRCODE = '23514', CONSTRAINT = 'cam_v2_review_decision_append_only';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM mmc.cam_v2_assignments AS assignment
    JOIN mmc.cam_v2_subject_links AS subject_link
      ON subject_link.tenant_id = assignment.tenant_id
     AND subject_link.environment = assignment.environment
     AND subject_link.id = assignment.subject_link_id
    JOIN mmc.cam_v2_principals AS reviewer
      ON reviewer.tenant_id = assignment.tenant_id
     AND reviewer.environment = assignment.environment
     AND reviewer.id = assignment.mentor_principal_id
     AND reviewer.id = NEW.reviewer_principal_id
     AND reviewer.principal_kind = 'MENTOR'
    JOIN mmc.cam_v2_policy_versions AS policy
      ON policy.tenant_id = assignment.tenant_id
     AND policy.environment = assignment.environment
     AND policy.id = NEW.policy_version_id
     AND policy.policy_kind = 'EVIDENCE'
    WHERE assignment.tenant_id = NEW.tenant_id
      AND assignment.environment = NEW.environment
      AND assignment.id = NEW.assignment_id
      AND assignment.subject_link_id = NEW.subject_link_id
      AND assignment.status = 'ACTIVE'
      AND assignment.effective_at <= v_now
      AND (assignment.expires_at IS NULL OR assignment.expires_at > v_now)
      AND assignment.revoked_at IS NULL
      AND subject_link.identity_state = 'VERIFIED_LOCAL_LINK'
      AND subject_link.revoked_at IS NULL
      AND reviewer.status = 'ACTIVE'
      AND policy.status = 'ACTIVE'
      AND policy.effective_at <= v_now
      AND (policy.expires_at IS NULL OR policy.expires_at > v_now)
  ) THEN
    RAISE EXCEPTION 'review decision lacks an active exact-assignment mentor and evidence policy'
      USING ERRCODE = '42501', CONSTRAINT = 'cam_v2_review_decision_active_authority';
  END IF;
  IF NEW.decision = 'ACCEPT' AND (
    NEW.exact_output_digest IS NULL OR NOT EXISTS (
      SELECT 1 FROM mmc.cam_v2_ai_proposals AS proposal
      WHERE proposal.tenant_id = NEW.tenant_id
        AND proposal.environment = NEW.environment
        AND proposal.id = NEW.proposal_id
        AND proposal.assignment_id = NEW.assignment_id
        AND proposal.subject_link_id = NEW.subject_link_id
        AND proposal.evidence_state = 'SUPPORTED'
    )
  ) THEN
    RAISE EXCEPTION 'accepted proposal requires supported evidence and an exact output digest'
      USING ERRCODE = '23514', CONSTRAINT = 'cam_v2_review_accept_supported';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION mmc.cam_v2_enforce_ai_approved_decision()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, mmc
SET row_security = off
AS $$
DECLARE
  v_tenant_id uuid;
  v_environment text;
  v_proposal_id uuid;
BEGIN
  IF TG_TABLE_NAME = 'cam_v2_ai_proposals' THEN
    IF TG_OP = 'DELETE' THEN
      v_tenant_id := OLD.tenant_id; v_environment := OLD.environment; v_proposal_id := OLD.id;
    ELSE
      v_tenant_id := NEW.tenant_id; v_environment := NEW.environment; v_proposal_id := NEW.id;
    END IF;
  ELSE
    IF TG_OP = 'DELETE' THEN
      v_tenant_id := OLD.tenant_id; v_environment := OLD.environment; v_proposal_id := OLD.proposal_id;
    ELSE
      v_tenant_id := NEW.tenant_id; v_environment := NEW.environment; v_proposal_id := NEW.proposal_id;
    END IF;
  END IF;
  IF EXISTS (
    SELECT 1 FROM mmc.cam_v2_ai_proposals AS proposal
    WHERE proposal.tenant_id = v_tenant_id
      AND proposal.environment = v_environment
      AND proposal.id = v_proposal_id
      AND proposal.review_state = 'APPROVED'
      AND NOT EXISTS (
        SELECT 1 FROM mmc.cam_v2_review_decisions AS decision
        WHERE decision.tenant_id = proposal.tenant_id
          AND decision.environment = proposal.environment
          AND decision.proposal_id = proposal.id
          AND decision.assignment_id = proposal.assignment_id
          AND decision.subject_link_id = proposal.subject_link_id
          AND decision.decision = 'ACCEPT'
          AND decision.exact_output_digest IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM mmc.cam_v2_review_decisions AS successor
            WHERE successor.tenant_id = decision.tenant_id
              AND successor.environment = decision.environment
              AND successor.supersedes_id = decision.id
          )
      )
  ) THEN
    RAISE EXCEPTION 'approved AI proposal lacks a current exact ACCEPT decision'
      USING ERRCODE = '23514', CONSTRAINT = 'cam_v2_ai_approved_requires_accept';
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION mmc.cam_v2_enforce_command_actor_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, mmc
SET row_security = off
AS $$
DECLARE
  v_kind text;
  v_allowed text[];
BEGIN
  v_allowed := CASE NEW.command_kind
    WHEN 'task.upsert' THEN ARRAY['MENTOR']
    WHEN 'session.close' THEN ARRAY['MENTOR']
    WHEN 'review.decide' THEN ARRAY['MENTOR']
    WHEN 'identity.decide' THEN ARRAY['MENTOR', 'ADMIN']
    WHEN 'publication.approve' THEN ARRAY['MENTOR', 'ADMIN']
    WHEN 'job.enqueue' THEN ARRAY['OPERATOR', 'ADMIN']
    WHEN 'student.respond' THEN ARRAY['STUDENT']
    ELSE ARRAY[]::text[]
  END;
  SELECT principal.principal_kind INTO v_kind
  FROM mmc.cam_v2_principals AS principal
  WHERE principal.tenant_id = NEW.tenant_id
    AND principal.environment = NEW.environment
    AND principal.id = NEW.principal_id;
  IF NOT FOUND OR NOT (v_kind = ANY(v_allowed)) THEN
    RAISE EXCEPTION 'command actor role is invalid for %', NEW.command_kind
      USING ERRCODE = '23514', CONSTRAINT = 'cam_v2_command_actor_role_exact';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION mmc.cam_v2_enforce_consumer_effect_binding()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, mmc
SET row_security = off
AS $$
DECLARE
  v_event mmc.cam_v2_outbox_events%ROWTYPE;
  v_effect mmc.cam_v2_consumer_effects%ROWTYPE;
  v_expected_effect_kind text;
  v_expected_target_kind text;
  v_expected_target_id uuid;
BEGIN
  IF TG_TABLE_NAME = 'cam_v2_consumer_effects' THEN
    SELECT event.* INTO v_event
    FROM mmc.cam_v2_outbox_events AS event
    WHERE event.tenant_id = NEW.tenant_id
      AND event.environment = NEW.environment
      AND event.id = NEW.outbox_event_id
    FOR SHARE;
    v_expected_effect_kind := CASE
      WHEN v_event.job_id IS NOT NULL THEN 'PROJECTION_REFRESH'
      WHEN v_event.aggregate_kind = 'PUBLICATION' THEN 'NOTIFICATION_ENQUEUE'
      WHEN v_event.aggregate_kind = 'SESSION' THEN 'INDEX_REFRESH'
      ELSE 'CACHE_INVALIDATION'
    END;
    v_expected_target_kind := CASE
      WHEN v_event.job_id IS NOT NULL THEN 'JOB'
      WHEN v_event.aggregate_kind IN ('SUBJECT', 'ASSIGNMENT', 'SESSION', 'PUBLICATION')
        THEN v_event.aggregate_kind
      ELSE NULL
    END;
    v_expected_target_id := CASE WHEN v_event.job_id IS NOT NULL
      THEN v_event.job_id ELSE v_event.aggregate_id END;
    IF NOT FOUND OR NOT mmc.cam_v2_actor_is_active('WORKLOAD')
       OR NOT mmc.cam_v2_has_capability('mmc.worker.inbox')
       OR NEW.dispatcher_principal_id IS DISTINCT FROM mmc.cam_v2_current_principal_id()
       OR NEW.dispatcher_queue_name IS DISTINCT FROM mmc.cam_v2_current_queue_name()
       OR NEW.dispatcher_lease_generation IS DISTINCT FROM mmc.cam_v2_current_outbox_lease_generation()
       OR NEW.source_job_id IS DISTINCT FROM v_event.job_id
       OR NEW.effect_kind IS DISTINCT FROM v_expected_effect_kind
       OR NEW.target_kind IS DISTINCT FROM v_expected_target_kind
       OR NEW.target_id IS DISTINCT FROM v_expected_target_id
       OR v_event.delivery_state <> 'LEASED'
       OR v_event.delivery_lease_owner_principal_id IS DISTINCT FROM NEW.dispatcher_principal_id
       OR v_event.delivery_queue_name IS DISTINCT FROM NEW.dispatcher_queue_name
       OR v_event.delivery_lease_generation IS DISTINCT FROM NEW.dispatcher_lease_generation
       OR v_event.delivery_lease_expires_at <= statement_timestamp() THEN
      RAISE EXCEPTION 'consumer effect requires the exact current outbox lease and canonical event semantics'
        USING ERRCODE = '23514', CONSTRAINT = 'cam_v2_consumer_effect_exact_lease';
    END IF;
    NEW.applied_at := clock_timestamp();
    RETURN NEW;
  END IF;

  SELECT effect.* INTO v_effect
  FROM mmc.cam_v2_consumer_effects AS effect
  WHERE effect.tenant_id = NEW.tenant_id
    AND effect.environment = NEW.environment
    AND effect.id = NEW.consumer_effect_id
    AND effect.outbox_event_id = NEW.outbox_event_id
  FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'consumer receipt requires an existing exact effect'
      USING ERRCODE = '23514', CONSTRAINT = 'cam_v2_consumer_inbox_exact_effect';
  END IF;
  SELECT event.* INTO v_event
  FROM mmc.cam_v2_outbox_events AS event
  WHERE event.tenant_id = v_effect.tenant_id
    AND event.environment = v_effect.environment
    AND event.id = v_effect.outbox_event_id
  FOR SHARE;
  IF NOT FOUND OR NOT mmc.cam_v2_actor_is_active('WORKLOAD')
     OR NOT mmc.cam_v2_has_capability('mmc.worker.inbox')
     OR NEW.job_id IS DISTINCT FROM v_effect.source_job_id
     OR NEW.consumer_principal_id IS DISTINCT FROM v_effect.dispatcher_principal_id
     OR NEW.consumer_queue_name IS DISTINCT FROM v_effect.dispatcher_queue_name
     OR NEW.consumer_lease_generation IS DISTINCT FROM v_effect.dispatcher_lease_generation
     OR NEW.effect_digest IS DISTINCT FROM v_effect.effect_digest
     OR NEW.consumer_principal_id IS DISTINCT FROM mmc.cam_v2_current_principal_id()
     OR NEW.consumer_queue_name IS DISTINCT FROM mmc.cam_v2_current_queue_name()
     OR NEW.consumer_lease_generation IS DISTINCT FROM mmc.cam_v2_current_outbox_lease_generation()
     OR v_event.delivery_state <> 'LEASED'
     OR v_event.delivery_lease_owner_principal_id IS DISTINCT FROM NEW.consumer_principal_id
     OR v_event.delivery_queue_name IS DISTINCT FROM NEW.consumer_queue_name
     OR v_event.delivery_lease_generation IS DISTINCT FROM NEW.consumer_lease_generation
     OR v_event.delivery_lease_expires_at <= statement_timestamp() THEN
    RAISE EXCEPTION 'consumer receipt requires the exact effect and current outbox lease'
      USING ERRCODE = '23514', CONSTRAINT = 'cam_v2_consumer_inbox_exact_effect';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS cam_v2_01_tenant_lifecycle ON mmc.cam_v2_tenants;
CREATE TRIGGER cam_v2_01_tenant_lifecycle
BEFORE UPDATE ON mmc.cam_v2_tenants
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_enforce_tenant_lifecycle();
DROP TRIGGER IF EXISTS cam_v2_99_tenant_no_delete ON mmc.cam_v2_tenants;
CREATE TRIGGER cam_v2_99_tenant_no_delete
BEFORE DELETE ON mmc.cam_v2_tenants
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_reject_durable_mutation();

DROP TRIGGER IF EXISTS cam_v2_01_principal_lifecycle ON mmc.cam_v2_principals;
CREATE TRIGGER cam_v2_01_principal_lifecycle
BEFORE UPDATE ON mmc.cam_v2_principals
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_enforce_principal_lifecycle();
DROP TRIGGER IF EXISTS cam_v2_99_principal_no_delete ON mmc.cam_v2_principals;
CREATE TRIGGER cam_v2_99_principal_no_delete
BEFORE DELETE ON mmc.cam_v2_principals
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_reject_durable_mutation();

DROP TRIGGER IF EXISTS cam_v2_00_roles_subject_links ON mmc.cam_v2_subject_links;
CREATE TRIGGER cam_v2_00_roles_subject_links
BEFORE INSERT OR UPDATE ON mmc.cam_v2_subject_links
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_enforce_principal_roles(
  'student_principal_id=STUDENT', 'verified_by_principal_id=MENTOR,ADMIN'
);
DROP TRIGGER IF EXISTS cam_v2_01_subject_link_lifecycle ON mmc.cam_v2_subject_links;
CREATE TRIGGER cam_v2_01_subject_link_lifecycle
BEFORE INSERT OR UPDATE ON mmc.cam_v2_subject_links
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_enforce_subject_link_lifecycle();
DROP TRIGGER IF EXISTS cam_v2_99_subject_link_no_delete ON mmc.cam_v2_subject_links;
CREATE TRIGGER cam_v2_99_subject_link_no_delete
BEFORE DELETE ON mmc.cam_v2_subject_links
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_reject_durable_mutation();

DROP TRIGGER IF EXISTS cam_v2_00_roles_assignments ON mmc.cam_v2_assignments;
CREATE TRIGGER cam_v2_00_roles_assignments
BEFORE INSERT OR UPDATE ON mmc.cam_v2_assignments
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_enforce_principal_roles(
  'mentor_principal_id=MENTOR', 'granted_by_principal_id=OPERATOR,ADMIN'
);
DROP TRIGGER IF EXISTS cam_v2_01_assignment_lifecycle ON mmc.cam_v2_assignments;
CREATE TRIGGER cam_v2_01_assignment_lifecycle
BEFORE INSERT OR UPDATE ON mmc.cam_v2_assignments
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_enforce_assignment_lifecycle();
DROP TRIGGER IF EXISTS cam_v2_99_assignment_no_delete ON mmc.cam_v2_assignments;
CREATE TRIGGER cam_v2_99_assignment_no_delete
BEFORE DELETE ON mmc.cam_v2_assignments
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_reject_durable_mutation();

DROP TRIGGER IF EXISTS cam_v2_00_roles_policy_versions ON mmc.cam_v2_policy_versions;
CREATE TRIGGER cam_v2_00_roles_policy_versions
BEFORE INSERT OR UPDATE ON mmc.cam_v2_policy_versions
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_enforce_principal_roles(
  'approved_by_principal_id=MENTOR,ADMIN'
);
DROP TRIGGER IF EXISTS cam_v2_01_policy_lifecycle ON mmc.cam_v2_policy_versions;
CREATE TRIGGER cam_v2_01_policy_lifecycle
BEFORE INSERT OR UPDATE ON mmc.cam_v2_policy_versions
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_enforce_policy_lifecycle();
DROP TRIGGER IF EXISTS cam_v2_99_policy_no_delete ON mmc.cam_v2_policy_versions;
CREATE TRIGGER cam_v2_99_policy_no_delete
BEFORE DELETE ON mmc.cam_v2_policy_versions
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_reject_durable_mutation();

DROP TRIGGER IF EXISTS cam_v2_00_roles_authority_grants ON mmc.cam_v2_authority_grants;
CREATE TRIGGER cam_v2_00_roles_authority_grants
BEFORE INSERT OR UPDATE ON mmc.cam_v2_authority_grants
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_enforce_principal_roles(
  'granted_by_principal_id=OPERATOR,ADMIN'
);
DROP TRIGGER IF EXISTS cam_v2_01_authority_grant_lifecycle ON mmc.cam_v2_authority_grants;
CREATE TRIGGER cam_v2_01_authority_grant_lifecycle
BEFORE INSERT OR UPDATE ON mmc.cam_v2_authority_grants
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_enforce_authority_grant_lifecycle();
DROP TRIGGER IF EXISTS cam_v2_99_authority_grant_no_delete ON mmc.cam_v2_authority_grants;
CREATE TRIGGER cam_v2_99_authority_grant_no_delete
BEFORE DELETE ON mmc.cam_v2_authority_grants
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_reject_durable_mutation();

DROP TRIGGER IF EXISTS cam_v2_00_command_actor_role ON mmc.cam_v2_command_receipts;
CREATE TRIGGER cam_v2_00_command_actor_role
BEFORE INSERT OR UPDATE ON mmc.cam_v2_command_receipts
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_enforce_command_actor_role();
DROP TRIGGER IF EXISTS cam_v2_01_command_receipt_lifecycle ON mmc.cam_v2_command_receipts;
CREATE TRIGGER cam_v2_01_command_receipt_lifecycle
BEFORE UPDATE ON mmc.cam_v2_command_receipts
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_enforce_command_receipt_lifecycle();
DROP TRIGGER IF EXISTS cam_v2_99_command_receipt_no_delete ON mmc.cam_v2_command_receipts;
CREATE TRIGGER cam_v2_99_command_receipt_no_delete
BEFORE DELETE ON mmc.cam_v2_command_receipts
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_reject_durable_mutation();

DROP TRIGGER IF EXISTS cam_v2_99_idempotency_append_only ON mmc.cam_v2_idempotency_records;
CREATE TRIGGER cam_v2_99_idempotency_append_only
BEFORE UPDATE OR DELETE ON mmc.cam_v2_idempotency_records
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_reject_durable_mutation();

DROP TRIGGER IF EXISTS cam_v2_00_roles_jobs ON mmc.cam_v2_jobs;
CREATE TRIGGER cam_v2_00_roles_jobs
BEFORE INSERT OR UPDATE ON mmc.cam_v2_jobs
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_enforce_principal_roles(
  'lease_owner_principal_id=WORKLOAD',
  'completed_by_principal_id=WORKLOAD,OPERATOR,ADMIN'
);
DROP TRIGGER IF EXISTS cam_v2_01_jobs_core_immutable ON mmc.cam_v2_jobs;
CREATE TRIGGER cam_v2_01_jobs_core_immutable
BEFORE UPDATE ON mmc.cam_v2_jobs
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_enforce_immutable_columns(
  'tenant_id', 'environment', 'id', 'authority_grant_id', 'assignment_id',
  'subject_link_id', 'command_receipt_id', 'queue_name', 'job_kind',
  'operation_ref', 'payload_digest', 'provider_execution_mode',
  'provider_idempotency_mode', 'provider_idempotency_policy_digest',
  'provider_idempotency_key_digest', 'max_attempts', 'created_at'
);
DROP TRIGGER IF EXISTS cam_v2_02_jobs_state ON mmc.cam_v2_jobs;
CREATE TRIGGER cam_v2_02_jobs_state
BEFORE UPDATE ON mmc.cam_v2_jobs
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_enforce_forward_state(
  'status', 'QUEUED>LEASED', 'QUEUED>CANCELLED',
  'RETRY_SCHEDULED>LEASED', 'RETRY_SCHEDULED>CANCELLED',
  'LEASED>RUNNING', 'LEASED>RETRY_SCHEDULED', 'LEASED>SUCCEEDED',
  'LEASED>FAILED', 'LEASED>DEAD_LETTER', 'LEASED>CANCELLED',
  'RUNNING>LEASED', 'RUNNING>RETRY_SCHEDULED', 'RUNNING>SUCCEEDED', 'RUNNING>FAILED',
  'RUNNING>DEAD_LETTER', 'RUNNING>CANCELLED'
);
DROP TRIGGER IF EXISTS cam_v2_02_jobs_lease_coherence ON mmc.cam_v2_jobs;
CREATE TRIGGER cam_v2_02_jobs_lease_coherence
BEFORE UPDATE ON mmc.cam_v2_jobs
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_enforce_job_lease_transition();
DROP TRIGGER IF EXISTS cam_v2_03_jobs_versioned ON mmc.cam_v2_jobs;
CREATE TRIGGER cam_v2_03_jobs_versioned
BEFORE UPDATE ON mmc.cam_v2_jobs
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_enforce_versioned_update();
DROP TRIGGER IF EXISTS cam_v2_99_jobs_no_delete ON mmc.cam_v2_jobs;
CREATE TRIGGER cam_v2_99_jobs_no_delete
BEFORE DELETE ON mmc.cam_v2_jobs
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_reject_durable_mutation();
DROP TRIGGER IF EXISTS cam_v2_jobs_success_evidence ON mmc.cam_v2_jobs;
CREATE CONSTRAINT TRIGGER cam_v2_jobs_success_evidence
AFTER INSERT OR UPDATE ON mmc.cam_v2_jobs
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW WHEN (NEW.status = 'SUCCEEDED')
EXECUTE FUNCTION mmc.cam_v2_enforce_job_success_evidence();

DROP TRIGGER IF EXISTS cam_v2_00_roles_sessions ON mmc.cam_v2_sessions;
CREATE TRIGGER cam_v2_00_roles_sessions
BEFORE INSERT OR UPDATE ON mmc.cam_v2_sessions
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_enforce_principal_roles('mentor_principal_id=MENTOR');
DROP TRIGGER IF EXISTS cam_v2_01_sessions_core ON mmc.cam_v2_sessions;
CREATE TRIGGER cam_v2_01_sessions_core
BEFORE UPDATE ON mmc.cam_v2_sessions
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_enforce_immutable_columns(
  'tenant_id', 'environment', 'id', 'assignment_id', 'subject_link_id',
  'mentor_principal_id', 'created_at'
);
DROP TRIGGER IF EXISTS cam_v2_02_sessions_state ON mmc.cam_v2_sessions;
CREATE TRIGGER cam_v2_02_sessions_state
BEFORE UPDATE ON mmc.cam_v2_sessions
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_enforce_forward_state(
  'session_state', 'DRAFT>ACTIVE', 'DRAFT>CANCELLED', 'ACTIVE>PAUSED',
  'ACTIVE>REVIEW', 'ACTIVE>CLOSED', 'ACTIVE>CANCELLED', 'PAUSED>ACTIVE',
  'PAUSED>REVIEW', 'PAUSED>CANCELLED', 'REVIEW>ACTIVE', 'REVIEW>CLOSED',
  'REVIEW>CANCELLED'
);
DROP TRIGGER IF EXISTS cam_v2_03_sessions_versioned ON mmc.cam_v2_sessions;
CREATE TRIGGER cam_v2_03_sessions_versioned
BEFORE UPDATE ON mmc.cam_v2_sessions
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_enforce_versioned_update();
DROP TRIGGER IF EXISTS cam_v2_99_sessions_no_delete ON mmc.cam_v2_sessions;
CREATE TRIGGER cam_v2_99_sessions_no_delete
BEFORE DELETE ON mmc.cam_v2_sessions
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_reject_durable_mutation();

DROP TRIGGER IF EXISTS cam_v2_00_roles_tasks ON mmc.cam_v2_tasks;
CREATE TRIGGER cam_v2_00_roles_tasks
BEFORE INSERT OR UPDATE ON mmc.cam_v2_tasks
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_enforce_principal_roles('owner_principal_id=MENTOR,STUDENT');
DROP TRIGGER IF EXISTS cam_v2_01_tasks_core ON mmc.cam_v2_tasks;
CREATE TRIGGER cam_v2_01_tasks_core
BEFORE UPDATE ON mmc.cam_v2_tasks
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_enforce_immutable_columns(
  'tenant_id', 'environment', 'id', 'assignment_id', 'subject_link_id',
  'session_id', 'origin', 'created_at'
);
DROP TRIGGER IF EXISTS cam_v2_02_tasks_state ON mmc.cam_v2_tasks;
CREATE TRIGGER cam_v2_02_tasks_state
BEFORE UPDATE ON mmc.cam_v2_tasks
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_enforce_forward_state(
  'task_state', 'DRAFT>ACCEPTED', 'DRAFT>CANCELLED', 'DRAFT>SUPERSEDED',
  'ACCEPTED>IN_PROGRESS', 'ACCEPTED>BLOCKED', 'ACCEPTED>COMPLETED',
  'ACCEPTED>CANCELLED', 'ACCEPTED>SUPERSEDED', 'IN_PROGRESS>BLOCKED',
  'IN_PROGRESS>COMPLETED', 'IN_PROGRESS>CANCELLED', 'IN_PROGRESS>SUPERSEDED',
  'BLOCKED>IN_PROGRESS', 'BLOCKED>COMPLETED', 'BLOCKED>CANCELLED',
  'BLOCKED>SUPERSEDED'
);
DROP TRIGGER IF EXISTS cam_v2_03_tasks_versioned ON mmc.cam_v2_tasks;
CREATE TRIGGER cam_v2_03_tasks_versioned
BEFORE UPDATE ON mmc.cam_v2_tasks
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_enforce_versioned_update();
DROP TRIGGER IF EXISTS cam_v2_99_tasks_no_delete ON mmc.cam_v2_tasks;
CREATE TRIGGER cam_v2_99_tasks_no_delete
BEFORE DELETE ON mmc.cam_v2_tasks
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_reject_durable_mutation();

DROP TRIGGER IF EXISTS cam_v2_00_roles_commitments ON mmc.cam_v2_commitments;
CREATE TRIGGER cam_v2_00_roles_commitments
BEFORE INSERT OR UPDATE ON mmc.cam_v2_commitments
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_enforce_principal_roles(
  'owner_principal_id=MENTOR,STUDENT', 'recipient_principal_id=MENTOR,STUDENT'
);
DROP TRIGGER IF EXISTS cam_v2_01_commitments_core ON mmc.cam_v2_commitments;
CREATE TRIGGER cam_v2_01_commitments_core
BEFORE UPDATE ON mmc.cam_v2_commitments
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_enforce_immutable_columns(
  'tenant_id', 'environment', 'id', 'assignment_id', 'subject_link_id',
  'session_id', 'created_at'
);
DROP TRIGGER IF EXISTS cam_v2_02_commitments_state ON mmc.cam_v2_commitments;
CREATE TRIGGER cam_v2_02_commitments_state
BEFORE UPDATE ON mmc.cam_v2_commitments
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_enforce_forward_state(
  'commitment_state', 'PROPOSED>ACKNOWLEDGED', 'PROPOSED>WITHDRAWN',
  'PROPOSED>SUPERSEDED', 'ACKNOWLEDGED>DUE', 'ACKNOWLEDGED>COMPLETED',
  'ACKNOWLEDGED>RENEGOTIATED', 'ACKNOWLEDGED>WITHDRAWN',
  'ACKNOWLEDGED>SUPERSEDED', 'DUE>COMPLETED', 'DUE>RENEGOTIATED',
  'DUE>WITHDRAWN', 'DUE>SUPERSEDED'
);
DROP TRIGGER IF EXISTS cam_v2_03_commitments_versioned ON mmc.cam_v2_commitments;
CREATE TRIGGER cam_v2_03_commitments_versioned
BEFORE UPDATE ON mmc.cam_v2_commitments
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_enforce_versioned_update();
DROP TRIGGER IF EXISTS cam_v2_99_commitments_no_delete ON mmc.cam_v2_commitments;
CREATE TRIGGER cam_v2_99_commitments_no_delete
BEFORE DELETE ON mmc.cam_v2_commitments
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_reject_durable_mutation();

DROP TRIGGER IF EXISTS cam_v2_00_roles_goals ON mmc.cam_v2_goals;
CREATE TRIGGER cam_v2_00_roles_goals
BEFORE INSERT OR UPDATE ON mmc.cam_v2_goals
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_enforce_principal_roles('owner_principal_id=MENTOR,STUDENT');
DROP TRIGGER IF EXISTS cam_v2_01_goals_core ON mmc.cam_v2_goals;
CREATE TRIGGER cam_v2_01_goals_core
BEFORE UPDATE ON mmc.cam_v2_goals
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_enforce_immutable_columns(
  'tenant_id', 'environment', 'id', 'assignment_id', 'subject_link_id', 'created_at'
);
DROP TRIGGER IF EXISTS cam_v2_02_goals_state ON mmc.cam_v2_goals;
CREATE TRIGGER cam_v2_02_goals_state
BEFORE UPDATE ON mmc.cam_v2_goals
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_enforce_forward_state(
  'goal_state', 'PROPOSED>AGREED', 'PROPOSED>WITHDRAWN', 'PROPOSED>SUPERSEDED',
  'AGREED>ACTIVE', 'AGREED>WITHDRAWN', 'AGREED>SUPERSEDED',
  'ACTIVE>PAUSED', 'ACTIVE>ACHIEVED', 'ACTIVE>WITHDRAWN', 'ACTIVE>SUPERSEDED',
  'PAUSED>ACTIVE', 'PAUSED>ACHIEVED', 'PAUSED>WITHDRAWN', 'PAUSED>SUPERSEDED'
);
DROP TRIGGER IF EXISTS cam_v2_03_goals_versioned ON mmc.cam_v2_goals;
CREATE TRIGGER cam_v2_03_goals_versioned
BEFORE UPDATE ON mmc.cam_v2_goals
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_enforce_versioned_update();
DROP TRIGGER IF EXISTS cam_v2_99_goals_no_delete ON mmc.cam_v2_goals;
CREATE TRIGGER cam_v2_99_goals_no_delete
BEFORE DELETE ON mmc.cam_v2_goals
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_reject_durable_mutation();

DROP TRIGGER IF EXISTS cam_v2_01_milestones_core ON mmc.cam_v2_milestones;
CREATE TRIGGER cam_v2_01_milestones_core
BEFORE UPDATE ON mmc.cam_v2_milestones
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_enforce_immutable_columns(
  'tenant_id', 'environment', 'id', 'assignment_id', 'subject_link_id',
  'goal_id', 'criteria_digest', 'created_at'
);
DROP TRIGGER IF EXISTS cam_v2_02_milestones_state ON mmc.cam_v2_milestones;
CREATE TRIGGER cam_v2_02_milestones_state
BEFORE UPDATE ON mmc.cam_v2_milestones
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_enforce_forward_state(
  'milestone_state', 'PLANNED>EVIDENCE_PENDING', 'PLANNED>MET',
  'PLANNED>NOT_MET', 'PLANNED>BLOCKED', 'PLANNED>SUPERSEDED',
  'EVIDENCE_PENDING>MET', 'EVIDENCE_PENDING>NOT_MET',
  'EVIDENCE_PENDING>BLOCKED', 'EVIDENCE_PENDING>SUPERSEDED',
  'BLOCKED>EVIDENCE_PENDING', 'BLOCKED>MET', 'BLOCKED>NOT_MET',
  'BLOCKED>SUPERSEDED'
);
DROP TRIGGER IF EXISTS cam_v2_03_milestones_versioned ON mmc.cam_v2_milestones;
CREATE TRIGGER cam_v2_03_milestones_versioned
BEFORE UPDATE ON mmc.cam_v2_milestones
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_enforce_versioned_update();
DROP TRIGGER IF EXISTS cam_v2_99_milestones_no_delete ON mmc.cam_v2_milestones;
CREATE TRIGGER cam_v2_99_milestones_no_delete
BEFORE DELETE ON mmc.cam_v2_milestones
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_reject_durable_mutation();

DROP TRIGGER IF EXISTS cam_v2_00_roles_student_statements ON mmc.cam_v2_student_statements;
CREATE TRIGGER cam_v2_00_roles_student_statements
BEFORE INSERT OR UPDATE ON mmc.cam_v2_student_statements
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_enforce_principal_roles('author_principal_id=STUDENT');
DROP TRIGGER IF EXISTS cam_v2_01_student_statements_core ON mmc.cam_v2_student_statements;
CREATE TRIGGER cam_v2_01_student_statements_core
BEFORE UPDATE ON mmc.cam_v2_student_statements
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_enforce_immutable_columns(
  'tenant_id', 'environment', 'id', 'subject_link_id', 'author_principal_id',
  'statement_kind', 'statement_text', 'supersedes_id', 'created_at'
);
DROP TRIGGER IF EXISTS cam_v2_02_student_statements_state ON mmc.cam_v2_student_statements;
CREATE TRIGGER cam_v2_02_student_statements_state
BEFORE UPDATE ON mmc.cam_v2_student_statements
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_enforce_forward_state(
  'statement_state', 'DRAFT>SUBMITTED', 'DRAFT>WITHDRAWN',
  'SUBMITTED>ACTIVE', 'SUBMITTED>CORRECTED', 'SUBMITTED>WITHDRAWN',
  'SUBMITTED>SUPERSEDED', 'ACTIVE>CORRECTED', 'ACTIVE>WITHDRAWN',
  'ACTIVE>SUPERSEDED'
);
DROP TRIGGER IF EXISTS cam_v2_03_student_statements_versioned ON mmc.cam_v2_student_statements;
CREATE TRIGGER cam_v2_03_student_statements_versioned
BEFORE UPDATE ON mmc.cam_v2_student_statements
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_enforce_versioned_update();
DROP TRIGGER IF EXISTS cam_v2_99_student_statements_no_delete ON mmc.cam_v2_student_statements;
CREATE TRIGGER cam_v2_99_student_statements_no_delete
BEFORE DELETE ON mmc.cam_v2_student_statements
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_reject_durable_mutation();

DROP TRIGGER IF EXISTS cam_v2_00_roles_student_responses ON mmc.cam_v2_student_responses;
CREATE TRIGGER cam_v2_00_roles_student_responses
BEFORE INSERT OR UPDATE ON mmc.cam_v2_student_responses
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_enforce_principal_roles('author_principal_id=STUDENT');
DROP TRIGGER IF EXISTS cam_v2_01_student_responses_core ON mmc.cam_v2_student_responses;
CREATE TRIGGER cam_v2_01_student_responses_core
BEFORE UPDATE ON mmc.cam_v2_student_responses
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_enforce_immutable_columns(
  'tenant_id', 'environment', 'id', 'subject_link_id', 'author_principal_id',
  'target_kind', 'target_id', 'response_kind', 'response_text',
  'supersedes_id', 'created_at'
);
DROP TRIGGER IF EXISTS cam_v2_02_student_responses_state ON mmc.cam_v2_student_responses;
CREATE TRIGGER cam_v2_02_student_responses_state
BEFORE UPDATE ON mmc.cam_v2_student_responses
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_enforce_forward_state(
  'response_state', 'SUBMITTED>ACTIVE', 'SUBMITTED>CORRECTED',
  'SUBMITTED>WITHDRAWN', 'SUBMITTED>SUPERSEDED', 'ACTIVE>CORRECTED',
  'ACTIVE>WITHDRAWN', 'ACTIVE>SUPERSEDED'
);
DROP TRIGGER IF EXISTS cam_v2_03_student_responses_versioned ON mmc.cam_v2_student_responses;
CREATE TRIGGER cam_v2_03_student_responses_versioned
BEFORE UPDATE ON mmc.cam_v2_student_responses
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_enforce_versioned_update();
DROP TRIGGER IF EXISTS cam_v2_99_student_responses_no_delete ON mmc.cam_v2_student_responses;
CREATE TRIGGER cam_v2_99_student_responses_no_delete
BEFORE DELETE ON mmc.cam_v2_student_responses
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_reject_durable_mutation();

DROP TRIGGER IF EXISTS cam_v2_01_source_assets_core ON mmc.cam_v2_source_assets;
CREATE TRIGGER cam_v2_01_source_assets_core
BEFORE UPDATE ON mmc.cam_v2_source_assets
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_enforce_immutable_columns(
  'tenant_id', 'environment', 'id', 'job_id', 'authority_grant_id',
  'assignment_id', 'subject_link_id', 'opaque_asset_handle', 'source_system',
  'source_record_digest', 'retention_policy_version_id',
  'retention_policy_kind', 'created_at'
);
DROP TRIGGER IF EXISTS cam_v2_02_source_assets_state ON mmc.cam_v2_source_assets;
CREATE TRIGGER cam_v2_02_source_assets_state
BEFORE UPDATE ON mmc.cam_v2_source_assets
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_enforce_forward_state(
  'asset_state', 'DISCOVERED>QUARANTINED', 'DISCOVERED>PAIR_VERIFIED',
  'DISCOVERED>REJECTED', 'QUARANTINED>PAIR_VERIFIED', 'QUARANTINED>EXPIRED',
  'QUARANTINED>REJECTED', 'PAIR_VERIFIED>ATTACHED', 'PAIR_VERIFIED>RETAINED',
  'PAIR_VERIFIED>QUARANTINED', 'PAIR_VERIFIED>EXPIRED', 'PAIR_VERIFIED>REJECTED',
  'ATTACHED>RETAINED', 'ATTACHED>QUARANTINED', 'ATTACHED>EXPIRED',
  'ATTACHED>REJECTED', 'RETAINED>QUARANTINED', 'RETAINED>EXPIRED',
  'RETAINED>REJECTED'
);
DROP TRIGGER IF EXISTS cam_v2_03_source_assets_versioned ON mmc.cam_v2_source_assets;
CREATE TRIGGER cam_v2_03_source_assets_versioned
BEFORE UPDATE ON mmc.cam_v2_source_assets
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_enforce_versioned_update();
DROP TRIGGER IF EXISTS cam_v2_99_source_assets_no_delete ON mmc.cam_v2_source_assets;
CREATE TRIGGER cam_v2_99_source_assets_no_delete
BEFORE DELETE ON mmc.cam_v2_source_assets
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_reject_durable_mutation();

DROP TRIGGER IF EXISTS cam_v2_01_transcripts_core ON mmc.cam_v2_transcript_versions;
CREATE TRIGGER cam_v2_01_transcripts_core
BEFORE UPDATE ON mmc.cam_v2_transcript_versions
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_enforce_immutable_columns(
  'tenant_id', 'environment', 'id', 'job_id', 'source_asset_id',
  'authority_grant_id', 'assignment_id', 'subject_link_id',
  'transcript_version', 'transcript_digest', 'normalized_digest',
  'language_code', 'supersedes_id', 'created_at'
);
DROP TRIGGER IF EXISTS cam_v2_02_transcripts_state ON mmc.cam_v2_transcript_versions;
CREATE TRIGGER cam_v2_02_transcripts_state
BEFORE UPDATE ON mmc.cam_v2_transcript_versions
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_enforce_forward_state(
  'transcript_state', 'IMPORTED>CHUNKED', 'IMPORTED>VERIFIED',
  'IMPORTED>WITHDRAWN', 'CHUNKED>VERIFIED', 'CHUNKED>WITHDRAWN',
  'VERIFIED>SUPERSEDED', 'VERIFIED>WITHDRAWN'
);
DROP TRIGGER IF EXISTS cam_v2_03_transcripts_versioned ON mmc.cam_v2_transcript_versions;
CREATE TRIGGER cam_v2_03_transcripts_versioned
BEFORE UPDATE ON mmc.cam_v2_transcript_versions
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_enforce_versioned_update();
DROP TRIGGER IF EXISTS cam_v2_99_transcripts_no_delete ON mmc.cam_v2_transcript_versions;
CREATE TRIGGER cam_v2_99_transcripts_no_delete
BEFORE DELETE ON mmc.cam_v2_transcript_versions
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_reject_durable_mutation();

DROP TRIGGER IF EXISTS cam_v2_01_evidence_core ON mmc.cam_v2_evidence_spans;
CREATE TRIGGER cam_v2_01_evidence_core
BEFORE UPDATE ON mmc.cam_v2_evidence_spans
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_enforce_immutable_columns(
  'tenant_id', 'environment', 'id', 'job_id', 'transcript_version_id',
  'assignment_id', 'subject_link_id', 'chunk_ordinal',
  'normalized_char_start', 'normalized_char_end', 'start_milliseconds',
  'end_milliseconds', 'speaker_digest', 'exact_quote_digest',
  'verifier_version', 'created_at'
);
DROP TRIGGER IF EXISTS cam_v2_02_evidence_state ON mmc.cam_v2_evidence_spans;
CREATE TRIGGER cam_v2_02_evidence_state
BEFORE UPDATE ON mmc.cam_v2_evidence_spans
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_enforce_forward_state(
  'evidence_state', 'VALID>INVALID', 'VALID>SUPERSEDED'
);
DROP TRIGGER IF EXISTS cam_v2_03_evidence_versioned ON mmc.cam_v2_evidence_spans;
CREATE TRIGGER cam_v2_03_evidence_versioned
BEFORE UPDATE ON mmc.cam_v2_evidence_spans
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_enforce_versioned_update();
DROP TRIGGER IF EXISTS cam_v2_99_evidence_no_delete ON mmc.cam_v2_evidence_spans;
CREATE TRIGGER cam_v2_99_evidence_no_delete
BEFORE DELETE ON mmc.cam_v2_evidence_spans
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_reject_durable_mutation();

DROP TRIGGER IF EXISTS cam_v2_01_analysis_core ON mmc.cam_v2_analysis_runs;
CREATE TRIGGER cam_v2_01_analysis_core
BEFORE UPDATE ON mmc.cam_v2_analysis_runs
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_enforce_immutable_columns(
  'tenant_id', 'environment', 'id', 'job_id', 'authority_grant_id',
  'assignment_id', 'subject_link_id', 'transcript_version_id',
  'policy_version_id', 'policy_kind', 'provider_digest', 'model_digest',
  'prompt_digest', 'created_at'
);
DROP TRIGGER IF EXISTS cam_v2_02_analysis_state ON mmc.cam_v2_analysis_runs;
CREATE TRIGGER cam_v2_02_analysis_state
BEFORE UPDATE ON mmc.cam_v2_analysis_runs
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_enforce_forward_state(
  'analysis_state', 'QUEUED>RUNNING', 'QUEUED>CANCELLED',
  'RUNNING>PROPOSED', 'RUNNING>PARTIAL', 'RUNNING>FAILED',
  'RUNNING>CANCELLED', 'PARTIAL>PROPOSED', 'PARTIAL>FAILED',
  'PARTIAL>CANCELLED'
);
DROP TRIGGER IF EXISTS cam_v2_03_analysis_versioned ON mmc.cam_v2_analysis_runs;
CREATE TRIGGER cam_v2_03_analysis_versioned
BEFORE UPDATE ON mmc.cam_v2_analysis_runs
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_enforce_versioned_update();
DROP TRIGGER IF EXISTS cam_v2_99_analysis_no_delete ON mmc.cam_v2_analysis_runs;
CREATE TRIGGER cam_v2_99_analysis_no_delete
BEFORE DELETE ON mmc.cam_v2_analysis_runs
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_reject_durable_mutation();

DROP TRIGGER IF EXISTS cam_v2_01_proposals_core ON mmc.cam_v2_ai_proposals;
CREATE TRIGGER cam_v2_01_proposals_core
BEFORE UPDATE ON mmc.cam_v2_ai_proposals
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_enforce_immutable_columns(
  'tenant_id', 'environment', 'id', 'job_id', 'analysis_run_id',
  'assignment_id', 'subject_link_id', 'proposal_kind', 'ordinal',
  'stable_proposal_digest', 'proposed_text', 'confidence_method',
  'confidence_value', 'created_at'
);
DROP TRIGGER IF EXISTS cam_v2_02_proposals_evidence_state ON mmc.cam_v2_ai_proposals;
CREATE TRIGGER cam_v2_02_proposals_evidence_state
BEFORE UPDATE ON mmc.cam_v2_ai_proposals
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_enforce_forward_state(
  'evidence_state', 'UNCHECKED>SUPPORTED', 'UNCHECKED>CONTRADICTED',
  'UNCHECKED>INSUFFICIENT', 'UNCHECKED>INVALID',
  'SUPPORTED>CONTRADICTED', 'SUPPORTED>INVALID',
  'INSUFFICIENT>SUPPORTED', 'INSUFFICIENT>CONTRADICTED',
  'INSUFFICIENT>INVALID', 'CONTRADICTED>INVALID'
);
DROP TRIGGER IF EXISTS cam_v2_03_proposals_review_state ON mmc.cam_v2_ai_proposals;
CREATE TRIGGER cam_v2_03_proposals_review_state
BEFORE UPDATE ON mmc.cam_v2_ai_proposals
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_enforce_forward_state(
  'review_state', 'REVIEW_REQUIRED>IN_REVIEW', 'REVIEW_REQUIRED>APPROVED',
  'REVIEW_REQUIRED>REJECTED', 'REVIEW_REQUIRED>SUPERSEDED',
  'REVIEW_REQUIRED>REVOKED', 'IN_REVIEW>APPROVED', 'IN_REVIEW>REJECTED',
  'IN_REVIEW>REVIEW_REQUIRED', 'IN_REVIEW>SUPERSEDED', 'IN_REVIEW>REVOKED',
  'APPROVED>SUPERSEDED', 'APPROVED>REVOKED', 'REJECTED>SUPERSEDED'
);
DROP TRIGGER IF EXISTS cam_v2_04_proposals_versioned ON mmc.cam_v2_ai_proposals;
CREATE TRIGGER cam_v2_04_proposals_versioned
BEFORE UPDATE ON mmc.cam_v2_ai_proposals
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_enforce_versioned_update();
DROP TRIGGER IF EXISTS cam_v2_99_proposals_no_delete ON mmc.cam_v2_ai_proposals;
CREATE TRIGGER cam_v2_99_proposals_no_delete
BEFORE DELETE ON mmc.cam_v2_ai_proposals
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_reject_durable_mutation();

DROP TRIGGER IF EXISTS cam_v2_00_roles_reviews ON mmc.cam_v2_review_decisions;
CREATE TRIGGER cam_v2_00_roles_reviews
BEFORE INSERT OR UPDATE ON mmc.cam_v2_review_decisions
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_enforce_principal_roles('reviewer_principal_id=MENTOR');
DROP TRIGGER IF EXISTS cam_v2_01_review_authority ON mmc.cam_v2_review_decisions;
CREATE TRIGGER cam_v2_01_review_authority
BEFORE INSERT OR UPDATE OR DELETE ON mmc.cam_v2_review_decisions
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_enforce_review_decision_authority();

DROP TRIGGER IF EXISTS cam_v2_ai_approved_decision_final ON mmc.cam_v2_ai_proposals;
CREATE CONSTRAINT TRIGGER cam_v2_ai_approved_decision_final
AFTER INSERT OR UPDATE ON mmc.cam_v2_ai_proposals
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_enforce_ai_approved_decision();
DROP TRIGGER IF EXISTS cam_v2_review_decision_ai_final ON mmc.cam_v2_review_decisions;
CREATE CONSTRAINT TRIGGER cam_v2_review_decision_ai_final
AFTER INSERT OR UPDATE OR DELETE ON mmc.cam_v2_review_decisions
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_enforce_ai_approved_decision();

DROP TRIGGER IF EXISTS cam_v2_00_roles_publications ON mmc.cam_v2_publications;
CREATE TRIGGER cam_v2_00_roles_publications
BEFORE INSERT OR UPDATE ON mmc.cam_v2_publications
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_enforce_principal_roles(
  'approved_by_principal_id=MENTOR,ADMIN'
);
DROP TRIGGER IF EXISTS cam_v2_01_publication_authority ON mmc.cam_v2_publications;
CREATE TRIGGER cam_v2_01_publication_authority
BEFORE INSERT OR UPDATE OR DELETE ON mmc.cam_v2_publications
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_enforce_publication_authority();
DROP TRIGGER IF EXISTS cam_v2_01_publication_item_authority ON mmc.cam_v2_publication_items;
CREATE TRIGGER cam_v2_01_publication_item_authority
BEFORE INSERT OR UPDATE OR DELETE ON mmc.cam_v2_publication_items
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_enforce_publication_authority();

DROP TRIGGER IF EXISTS cam_v2_00_roles_outbox ON mmc.cam_v2_outbox_events;
CREATE TRIGGER cam_v2_00_roles_outbox
BEFORE INSERT OR UPDATE ON mmc.cam_v2_outbox_events
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_enforce_principal_roles(
  'delivery_lease_owner_principal_id=WORKLOAD',
  'delivery_completed_by_principal_id=WORKLOAD,OPERATOR,ADMIN'
);
DROP TRIGGER IF EXISTS cam_v2_01_outbox_core ON mmc.cam_v2_outbox_events;
CREATE TRIGGER cam_v2_01_outbox_core
BEFORE UPDATE ON mmc.cam_v2_outbox_events
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_enforce_immutable_columns(
  'tenant_id', 'environment', 'id', 'job_id', 'command_receipt_id',
  'aggregate_kind', 'aggregate_id', 'aggregate_version', 'event_kind',
  'payload_digest', 'external_lease_generation', 'external_outcome',
  'external_result_digest', 'external_provider_receipt_digest',
  'external_provider_idempotency_proven',
  'external_provider_idempotency_key_digest', 'external_result_recorded_at',
  'delivery_queue_name', 'max_attempts', 'created_at'
);
DROP TRIGGER IF EXISTS cam_v2_02_outbox_state ON mmc.cam_v2_outbox_events;
CREATE TRIGGER cam_v2_02_outbox_state
BEFORE UPDATE ON mmc.cam_v2_outbox_events
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_enforce_forward_state(
  'delivery_state', 'PENDING>LEASED', 'PENDING>DEAD_LETTER',
  'RETRY>LEASED', 'RETRY>DEAD_LETTER',
  'LEASED>DELIVERED', 'LEASED>RETRY', 'LEASED>DEAD_LETTER'
);
DROP TRIGGER IF EXISTS cam_v2_03_outbox_versioned ON mmc.cam_v2_outbox_events;
CREATE TRIGGER cam_v2_03_outbox_versioned
BEFORE UPDATE ON mmc.cam_v2_outbox_events
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_enforce_versioned_update();
DROP TRIGGER IF EXISTS cam_v2_04_outbox_delivered_effect ON mmc.cam_v2_outbox_events;
CREATE TRIGGER cam_v2_04_outbox_delivered_effect
AFTER INSERT OR UPDATE ON mmc.cam_v2_outbox_events
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_enforce_outbox_delivered_effect();
DROP TRIGGER IF EXISTS cam_v2_99_outbox_no_delete ON mmc.cam_v2_outbox_events;
CREATE TRIGGER cam_v2_99_outbox_no_delete
BEFORE DELETE ON mmc.cam_v2_outbox_events
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_reject_durable_mutation();

DROP TRIGGER IF EXISTS cam_v2_00_roles_consumer_effects ON mmc.cam_v2_consumer_effects;
CREATE TRIGGER cam_v2_00_roles_consumer_effects
BEFORE INSERT ON mmc.cam_v2_consumer_effects
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_enforce_principal_roles(
  'dispatcher_principal_id=WORKLOAD'
);
DROP TRIGGER IF EXISTS cam_v2_01_consumer_effect_binding ON mmc.cam_v2_consumer_effects;
CREATE TRIGGER cam_v2_01_consumer_effect_binding
BEFORE INSERT ON mmc.cam_v2_consumer_effects
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_enforce_consumer_effect_binding();
DROP TRIGGER IF EXISTS cam_v2_99_consumer_effects_append_only ON mmc.cam_v2_consumer_effects;
CREATE TRIGGER cam_v2_99_consumer_effects_append_only
BEFORE UPDATE OR DELETE ON mmc.cam_v2_consumer_effects
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_reject_durable_mutation();

DROP TRIGGER IF EXISTS cam_v2_00_roles_consumer_inbox ON mmc.cam_v2_consumer_inbox;
CREATE TRIGGER cam_v2_00_roles_consumer_inbox
BEFORE INSERT ON mmc.cam_v2_consumer_inbox
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_enforce_principal_roles(
  'consumer_principal_id=WORKLOAD'
);
DROP TRIGGER IF EXISTS cam_v2_01_consumer_inbox_binding ON mmc.cam_v2_consumer_inbox;
CREATE TRIGGER cam_v2_01_consumer_inbox_binding
BEFORE INSERT ON mmc.cam_v2_consumer_inbox
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_enforce_consumer_effect_binding();
DROP TRIGGER IF EXISTS cam_v2_99_consumer_inbox_append_only ON mmc.cam_v2_consumer_inbox;
CREATE TRIGGER cam_v2_99_consumer_inbox_append_only
BEFORE UPDATE OR DELETE ON mmc.cam_v2_consumer_inbox
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_reject_durable_mutation();

DROP TRIGGER IF EXISTS cam_v2_00_lineage_endpoints ON mmc.cam_v2_lineage_edges;
CREATE TRIGGER cam_v2_00_lineage_endpoints
BEFORE INSERT ON mmc.cam_v2_lineage_edges
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_enforce_lineage_endpoints();
DROP TRIGGER IF EXISTS cam_v2_01_lineage_lifecycle ON mmc.cam_v2_lineage_edges;
CREATE TRIGGER cam_v2_01_lineage_lifecycle
BEFORE UPDATE ON mmc.cam_v2_lineage_edges
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_enforce_lineage_lifecycle();
DROP TRIGGER IF EXISTS cam_v2_99_lineage_no_delete ON mmc.cam_v2_lineage_edges;
CREATE TRIGGER cam_v2_99_lineage_no_delete
BEFORE DELETE ON mmc.cam_v2_lineage_edges
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_reject_durable_mutation();

DROP TRIGGER IF EXISTS cam_v2_04_active_lineage_guard ON mmc.cam_v2_source_assets;
CREATE TRIGGER cam_v2_04_active_lineage_guard BEFORE UPDATE ON mmc.cam_v2_source_assets
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_guard_active_lineage_endpoint_version('SOURCE_ASSET');
DROP TRIGGER IF EXISTS cam_v2_04_active_lineage_guard ON mmc.cam_v2_transcript_versions;
CREATE TRIGGER cam_v2_04_active_lineage_guard BEFORE UPDATE ON mmc.cam_v2_transcript_versions
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_guard_active_lineage_endpoint_version('TRANSCRIPT_VERSION');
DROP TRIGGER IF EXISTS cam_v2_04_active_lineage_guard ON mmc.cam_v2_evidence_spans;
CREATE TRIGGER cam_v2_04_active_lineage_guard BEFORE UPDATE ON mmc.cam_v2_evidence_spans
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_guard_active_lineage_endpoint_version('EVIDENCE_SPAN');
DROP TRIGGER IF EXISTS cam_v2_04_active_lineage_guard ON mmc.cam_v2_ai_proposals;
CREATE TRIGGER cam_v2_04_active_lineage_guard BEFORE UPDATE ON mmc.cam_v2_ai_proposals
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_guard_active_lineage_endpoint_version('AI_PROPOSAL');
DROP TRIGGER IF EXISTS cam_v2_04_active_lineage_guard ON mmc.cam_v2_review_decisions;
CREATE TRIGGER cam_v2_04_active_lineage_guard BEFORE UPDATE ON mmc.cam_v2_review_decisions
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_guard_active_lineage_endpoint_version('REVIEW_DECISION');
DROP TRIGGER IF EXISTS cam_v2_04_active_lineage_guard ON mmc.cam_v2_sessions;
CREATE TRIGGER cam_v2_04_active_lineage_guard BEFORE UPDATE ON mmc.cam_v2_sessions
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_guard_active_lineage_endpoint_version('SESSION');
DROP TRIGGER IF EXISTS cam_v2_04_active_lineage_guard ON mmc.cam_v2_tasks;
CREATE TRIGGER cam_v2_04_active_lineage_guard BEFORE UPDATE ON mmc.cam_v2_tasks
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_guard_active_lineage_endpoint_version('TASK');
DROP TRIGGER IF EXISTS cam_v2_04_active_lineage_guard ON mmc.cam_v2_commitments;
CREATE TRIGGER cam_v2_04_active_lineage_guard BEFORE UPDATE ON mmc.cam_v2_commitments
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_guard_active_lineage_endpoint_version('COMMITMENT');
DROP TRIGGER IF EXISTS cam_v2_04_active_lineage_guard ON mmc.cam_v2_goals;
CREATE TRIGGER cam_v2_04_active_lineage_guard BEFORE UPDATE ON mmc.cam_v2_goals
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_guard_active_lineage_endpoint_version('GOAL');
DROP TRIGGER IF EXISTS cam_v2_04_active_lineage_guard ON mmc.cam_v2_milestones;
CREATE TRIGGER cam_v2_04_active_lineage_guard BEFORE UPDATE ON mmc.cam_v2_milestones
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_guard_active_lineage_endpoint_version('MILESTONE');
DROP TRIGGER IF EXISTS cam_v2_04_active_lineage_guard ON mmc.cam_v2_student_statements;
CREATE TRIGGER cam_v2_04_active_lineage_guard BEFORE UPDATE ON mmc.cam_v2_student_statements
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_guard_active_lineage_endpoint_version('STUDENT_STATEMENT');
DROP TRIGGER IF EXISTS cam_v2_04_active_lineage_guard ON mmc.cam_v2_publications;
CREATE TRIGGER cam_v2_04_active_lineage_guard BEFORE UPDATE ON mmc.cam_v2_publications
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_guard_active_lineage_endpoint_version('PUBLICATION');
DROP TRIGGER IF EXISTS cam_v2_04_active_lineage_guard ON mmc.cam_v2_publication_items;
CREATE TRIGGER cam_v2_04_active_lineage_guard BEFORE UPDATE ON mmc.cam_v2_publication_items
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_guard_active_lineage_endpoint_version('PUBLICATION_ITEM');

DROP TRIGGER IF EXISTS cam_v2_00_roles_cutover ON mmc.cam_v2_cutover_states;
CREATE TRIGGER cam_v2_00_roles_cutover
BEFORE INSERT OR UPDATE ON mmc.cam_v2_cutover_states
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_enforce_principal_roles(
  'lock_owner_principal_id=OPERATOR,ADMIN'
);
DROP TRIGGER IF EXISTS cam_v2_01_cutover_lifecycle ON mmc.cam_v2_cutover_states;
CREATE TRIGGER cam_v2_01_cutover_lifecycle
BEFORE INSERT OR UPDATE ON mmc.cam_v2_cutover_states
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_enforce_cutover_lifecycle();
DROP TRIGGER IF EXISTS cam_v2_99_cutover_no_delete ON mmc.cam_v2_cutover_states;
CREATE TRIGGER cam_v2_99_cutover_no_delete
BEFORE DELETE ON mmc.cam_v2_cutover_states
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_reject_durable_mutation();

CREATE INDEX IF NOT EXISTS cam_v2_assignments_access_idx
  ON mmc.cam_v2_assignments (tenant_id, environment, mentor_principal_id, subject_link_id, status, expires_at);
CREATE INDEX IF NOT EXISTS cam_v2_jobs_claim_idx
  ON mmc.cam_v2_jobs (tenant_id, environment, queue_name, status, available_at, created_at);
CREATE INDEX IF NOT EXISTS cam_v2_jobs_lease_idx
  ON mmc.cam_v2_jobs (tenant_id, environment, lease_owner_principal_id, lease_generation, lease_expires_at);
CREATE INDEX IF NOT EXISTS cam_v2_job_inputs_consumer_idx
  ON mmc.cam_v2_job_inputs (tenant_id, environment, consumer_job_id, input_kind);
CREATE INDEX IF NOT EXISTS cam_v2_publications_student_idx
  ON mmc.cam_v2_publications (tenant_id, environment, subject_link_id, publication_state, publication_version DESC);
CREATE INDEX IF NOT EXISTS cam_v2_outbox_delivery_idx
  ON mmc.cam_v2_outbox_events (tenant_id, environment, delivery_queue_name, delivery_state, available_at, created_at);
CREATE INDEX IF NOT EXISTS cam_v2_lineage_descendant_idx
  ON mmc.cam_v2_lineage_edges (tenant_id, environment, from_kind, from_id, from_version);

-- Exact active actor, assignment, publication, cutover-plane, authority, and
-- current-lease predicates. Security-definer predicates expose only booleans,
-- use fixed paths, and are required because the referenced tables FORCE RLS.
CREATE OR REPLACE FUNCTION mmc.cam_v2_actor_is_active(p_required_kind text DEFAULT NULL)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, mmc
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM mmc.cam_v2_tenants AS tenant
    JOIN mmc.cam_v2_principals AS principal
      ON principal.tenant_id = tenant.id
     AND principal.environment = tenant.environment
    WHERE tenant.id = mmc.cam_v2_current_tenant_id()
      AND tenant.environment = mmc.cam_v2_current_environment()
      AND tenant.status = 'ACTIVE'
      AND principal.id = mmc.cam_v2_current_principal_id()
      AND principal.status = 'ACTIVE'
      AND principal.principal_kind = mmc.cam_v2_current_principal_kind()
      AND (p_required_kind IS NULL OR principal.principal_kind = upper(p_required_kind))
  );
$$;

CREATE OR REPLACE FUNCTION mmc.cam_v2_is_trust_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = pg_catalog, mmc
AS $$
  SELECT mmc.cam_v2_actor_is_active('ADMIN')
     AND mmc.cam_v2_current_principal_kind() = 'ADMIN'
     AND mmc.cam_v2_has_capability('mmc.admin.trust_manage');
$$;

CREATE OR REPLACE FUNCTION mmc.cam_v2_is_trust_operator(p_write boolean DEFAULT false)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = pg_catalog, mmc
AS $$
  SELECT mmc.cam_v2_is_trust_admin()
      OR (
        mmc.cam_v2_actor_is_active('OPERATOR')
        AND CASE
          WHEN p_write THEN mmc.cam_v2_has_capability('mmc.operator.trust_write')
          ELSE mmc.cam_v2_has_capability('mmc.operator.trust_read')
        END
      );
$$;

CREATE OR REPLACE FUNCTION mmc.cam_v2_job_plane(p_job_kind text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, mmc
AS $$
  SELECT CASE upper(coalesce(p_job_kind, ''))
    WHEN 'SOURCE_DISCOVERY' THEN 'ingest'
    WHEN 'ASSET_ACQUISITION' THEN 'ingest'
    WHEN 'TRANSCRIPT_PROCESSING' THEN 'ingest'
    WHEN 'AI_ANALYSIS' THEN 'ai_proposal'
    WHEN 'PUBLICATION_RENDER' THEN 'student_publication'
    WHEN 'RECONCILIATION' THEN 'commands'
    ELSE ''
  END;
$$;

CREATE OR REPLACE FUNCTION mmc.cam_v2_job_execution_capability(p_job_kind text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, mmc
AS $$
  SELECT CASE upper(coalesce(p_job_kind, ''))
    WHEN 'SOURCE_DISCOVERY' THEN 'mmc.worker.asset_process'
    WHEN 'ASSET_ACQUISITION' THEN 'mmc.worker.asset_process'
    WHEN 'TRANSCRIPT_PROCESSING' THEN 'mmc.worker.asset_process'
    WHEN 'AI_ANALYSIS' THEN 'mmc.worker.analysis'
    WHEN 'PUBLICATION_RENDER' THEN 'mmc.worker.complete'
    WHEN 'RECONCILIATION' THEN 'mmc.worker.complete'
    ELSE ''
  END;
$$;

CREATE OR REPLACE FUNCTION mmc.cam_v2_plane_is_enabled(p_plane text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, mmc
SET row_security = off
AS $$
  SELECT mmc.cam_v2_actor_is_active()
     AND EXISTS (
       SELECT 1
       FROM mmc.cam_v2_cutover_states AS cutover
       WHERE cutover.tenant_id = mmc.cam_v2_current_tenant_id()
         AND cutover.environment = mmc.cam_v2_current_environment()
         AND cutover.component_name = 'MMC_CANONICAL'
         AND (
           (lower(coalesce(p_plane, '')) = 'reads'
             AND cutover.writer_state IN ('SHADOW_READS', 'V2_ACTIVE'))
           OR (lower(coalesce(p_plane, '')) <> 'reads'
             AND cutover.writer_state = 'V2_ACTIVE')
         )
         AND CASE lower(coalesce(p_plane, ''))
           WHEN 'reads' THEN cutover.reads_enabled
           WHEN 'commands' THEN cutover.commands_enabled
           WHEN 'ingest' THEN cutover.ingest_enabled
           WHEN 'ai_proposal' THEN cutover.ai_proposal_enabled
           WHEN 'operational_promotion' THEN cutover.operational_promotion_enabled
           WHEN 'student_publication' THEN cutover.student_publication_enabled
           ELSE false
         END
     );
$$;

-- Every non-trust runtime SELECT is sealed unless the durable reads plane is
-- enabled. Trust administrators/operators retain explicit inspection access.
CREATE OR REPLACE FUNCTION mmc.cam_v2_same_scope(p_tenant_id uuid, p_environment text)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = pg_catalog, mmc
AS $$
  SELECT p_tenant_id = mmc.cam_v2_current_tenant_id()
     AND p_environment = mmc.cam_v2_current_environment()
     AND mmc.cam_v2_actor_is_active()
     AND (
       mmc.cam_v2_is_trust_operator(false)
       OR mmc.cam_v2_plane_is_enabled('reads')
     );
$$;

-- Durable grant validity is actor-agnostic so a trust operator can reconcile
-- an expired external dispatch without pretending to be the original worker.
-- Runtime worker predicates layer their own active-WORKLOAD check on top.
CREATE OR REPLACE FUNCTION mmc.cam_v2_job_durable_authority_is_active(p_job_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, mmc
SET row_security = off
AS $$
  SELECT EXISTS (
       SELECT 1
       FROM mmc.cam_v2_jobs AS job
       JOIN mmc.cam_v2_tenants AS tenant
         ON tenant.id = job.tenant_id
        AND tenant.environment = job.environment
       JOIN mmc.cam_v2_authority_grants AS authority
         ON authority.tenant_id = job.tenant_id
        AND authority.environment = job.environment
        AND authority.id = job.authority_grant_id
        AND authority.assignment_id IS NOT DISTINCT FROM job.assignment_id
        AND authority.subject_link_id IS NOT DISTINCT FROM job.subject_link_id
       JOIN mmc.cam_v2_policy_versions AS policy
         ON policy.tenant_id = authority.tenant_id
        AND policy.environment = authority.environment
        AND policy.id = authority.policy_version_id
       LEFT JOIN mmc.cam_v2_assignments AS assignment
         ON assignment.tenant_id = job.tenant_id
        AND assignment.environment = job.environment
        AND assignment.id = job.assignment_id
        AND assignment.subject_link_id = job.subject_link_id
       LEFT JOIN mmc.cam_v2_principals AS assignment_mentor
         ON assignment_mentor.tenant_id = assignment.tenant_id
        AND assignment_mentor.environment = assignment.environment
        AND assignment_mentor.id = assignment.mentor_principal_id
        AND assignment_mentor.principal_kind = 'MENTOR'
       LEFT JOIN mmc.cam_v2_subject_links AS subject_link
         ON subject_link.tenant_id = job.tenant_id
        AND subject_link.environment = job.environment
        AND subject_link.id = job.subject_link_id
       LEFT JOIN mmc.cam_v2_principals AS student_principal
         ON student_principal.tenant_id = subject_link.tenant_id
        AND student_principal.environment = subject_link.environment
        AND student_principal.id = subject_link.student_principal_id
        AND student_principal.principal_kind = 'STUDENT'
       WHERE job.tenant_id = mmc.cam_v2_current_tenant_id()
         AND job.environment = mmc.cam_v2_current_environment()
         AND job.id = p_job_id
         AND tenant.status = 'ACTIVE'
         AND authority.status = 'ACTIVE'
         AND authority.effective_at <= statement_timestamp()
         AND (authority.expires_at IS NULL OR authority.expires_at > statement_timestamp())
         AND authority.revoked_at IS NULL
         AND authority.grant_kind = CASE job.job_kind
           WHEN 'SOURCE_DISCOVERY' THEN 'ACQUISITION'
           WHEN 'ASSET_ACQUISITION' THEN 'ACQUISITION'
           WHEN 'TRANSCRIPT_PROCESSING' THEN 'TRANSCRIPT_PROCESSING'
           WHEN 'AI_ANALYSIS' THEN 'AI_TRANSFER'
           WHEN 'PUBLICATION_RENDER' THEN 'PUBLICATION'
           WHEN 'RECONCILIATION' THEN 'AI_TRANSFER'
           ELSE ''
         END
         AND policy.status = 'ACTIVE'
         AND policy.effective_at <= statement_timestamp()
         AND (policy.expires_at IS NULL OR policy.expires_at > statement_timestamp())
         AND (
           job.subject_link_id IS NULL
           OR (
             subject_link.id IS NOT NULL
             AND subject_link.identity_state = 'VERIFIED_LOCAL_LINK'
             AND subject_link.revoked_at IS NULL
             AND subject_link.student_principal_id IS NOT NULL
             AND student_principal.id IS NOT NULL
             AND student_principal.status = 'ACTIVE'
           )
         )
         AND (
           job.assignment_id IS NULL
           OR (
             assignment.assignment_scope = 'COACHING'
             AND assignment.status = 'ACTIVE'
             AND assignment.effective_at <= statement_timestamp()
             AND (assignment.expires_at IS NULL OR assignment.expires_at > statement_timestamp())
             AND assignment.revoked_at IS NULL
             AND assignment_mentor.id IS NOT NULL
             AND assignment_mentor.status = 'ACTIVE'
           )
         )
     );
$$;

CREATE OR REPLACE FUNCTION mmc.cam_v2_job_authority_is_active(p_job_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, mmc
SET row_security = off
AS $$
  SELECT mmc.cam_v2_actor_is_active('WORKLOAD')
     AND mmc.cam_v2_job_durable_authority_is_active(p_job_id);
$$;

-- Lock-free readiness prefilter used before the bounded claim window. It is a
-- conservative mirror of the lock-taking digest gate: every input must be an
-- exact, completed, currently-authorized producer artifact. The final claim
-- still locks and recomputes the canonical digest, so readiness races fail the
-- CAS rather than admitting stale work.
CREATE OR REPLACE FUNCTION mmc.cam_v2_job_inputs_potentially_ready(p_job_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, mmc
SET row_security = off
AS $$
DECLARE
  v_job mmc.cam_v2_jobs%ROWTYPE;
  v_count integer;
  v_invalid integer;
BEGIN
  SELECT job.* INTO v_job
  FROM mmc.cam_v2_jobs AS job
  WHERE job.tenant_id = mmc.cam_v2_current_tenant_id()
    AND job.environment = mmc.cam_v2_current_environment()
    AND job.id = p_job_id;
  IF NOT FOUND THEN RETURN false; END IF;

  IF v_job.job_kind = 'ASSET_ACQUISITION' THEN
    RETURN NOT EXISTS (
      SELECT 1 FROM mmc.cam_v2_job_inputs AS input
      WHERE input.tenant_id = v_job.tenant_id
        AND input.environment = v_job.environment
        AND input.consumer_job_id = v_job.id
    );
  ELSIF v_job.job_kind = 'TRANSCRIPT_PROCESSING' THEN
    SELECT count(*), count(*) FILTER (WHERE
      input.input_kind IS DISTINCT FROM 'SOURCE_ASSET'
      OR producer.id IS NULL
      OR producer.job_kind IS DISTINCT FROM 'ASSET_ACQUISITION'
      OR producer.status IS DISTINCT FROM 'SUCCEEDED'
      OR producer.external_dispatch_generation IS DISTINCT FROM producer.lease_generation
      OR producer.external_result_generation IS DISTINCT FROM producer.lease_generation
      OR producer.external_outcome IS DISTINCT FROM 'SUCCEEDED'
      OR producer.result_digest IS NULL
      OR producer.external_result_digest IS DISTINCT FROM producer.result_digest
      OR source.id IS NULL
      OR source.asset_state NOT IN ('PAIR_VERIFIED', 'ATTACHED', 'RETAINED')
      OR source.content_digest IS DISTINCT FROM producer.result_digest
      OR NOT mmc.cam_v2_job_durable_authority_is_active(input.producer_job_id)
    ) INTO v_count, v_invalid
    FROM mmc.cam_v2_job_inputs AS input
    LEFT JOIN mmc.cam_v2_jobs AS producer
      ON producer.tenant_id = input.tenant_id
     AND producer.environment = input.environment
     AND producer.id = input.producer_job_id
    LEFT JOIN mmc.cam_v2_source_assets AS source
      ON source.tenant_id = input.tenant_id
     AND source.environment = input.environment
     AND source.id = input.source_asset_id
     AND source.job_id = input.producer_job_id
     AND source.authority_grant_id = input.producer_authority_grant_id
     AND source.assignment_id = input.assignment_id
     AND source.subject_link_id = input.subject_link_id
    WHERE input.tenant_id = v_job.tenant_id
      AND input.environment = v_job.environment
      AND input.consumer_job_id = v_job.id;
    RETURN v_count > 0 AND v_invalid = 0;
  ELSIF v_job.job_kind = 'AI_ANALYSIS' THEN
    SELECT count(*), count(*) FILTER (WHERE
      input.input_kind IS DISTINCT FROM 'TRANSCRIPT_VERSION'
      OR producer.id IS NULL
      OR producer.job_kind IS DISTINCT FROM 'TRANSCRIPT_PROCESSING'
      OR producer.status IS DISTINCT FROM 'SUCCEEDED'
      OR producer.external_dispatch_generation IS DISTINCT FROM producer.lease_generation
      OR producer.external_result_generation IS DISTINCT FROM producer.lease_generation
      OR producer.external_outcome IS DISTINCT FROM 'SUCCEEDED'
      OR producer.result_digest IS NULL
      OR producer.external_result_digest IS DISTINCT FROM producer.result_digest
      OR transcript.id IS NULL
      OR transcript.transcript_state IS DISTINCT FROM 'VERIFIED'
      OR transcript.normalized_digest IS DISTINCT FROM producer.result_digest
      OR NOT mmc.cam_v2_job_durable_authority_is_active(input.producer_job_id)
    ) INTO v_count, v_invalid
    FROM mmc.cam_v2_job_inputs AS input
    LEFT JOIN mmc.cam_v2_jobs AS producer
      ON producer.tenant_id = input.tenant_id
     AND producer.environment = input.environment
     AND producer.id = input.producer_job_id
    LEFT JOIN mmc.cam_v2_transcript_versions AS transcript
      ON transcript.tenant_id = input.tenant_id
     AND transcript.environment = input.environment
     AND transcript.id = input.transcript_version_id
     AND transcript.job_id = input.producer_job_id
     AND transcript.authority_grant_id = input.producer_authority_grant_id
     AND transcript.assignment_id = input.assignment_id
     AND transcript.subject_link_id = input.subject_link_id
    WHERE input.tenant_id = v_job.tenant_id
      AND input.environment = v_job.environment
      AND input.consumer_job_id = v_job.id;
    RETURN v_count > 0 AND v_invalid = 0;
  END IF;
  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION mmc.cam_v2_worker_row_matches_job(
  p_job_id uuid, p_assignment_id uuid, p_subject_link_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, mmc
SET row_security = off
AS $$
  SELECT mmc.cam_v2_actor_is_active('WORKLOAD')
     AND mmc.cam_v2_job_authority_is_active(p_job_id)
     AND EXISTS (
       SELECT 1
       FROM mmc.cam_v2_jobs AS job
       WHERE job.tenant_id = mmc.cam_v2_current_tenant_id()
         AND job.environment = mmc.cam_v2_current_environment()
         AND job.id = p_job_id
         AND job.assignment_id IS NOT DISTINCT FROM p_assignment_id
         AND job.subject_link_id IS NOT DISTINCT FROM p_subject_link_id
     );
$$;

-- Exact assignment, student, and current-lease predicates.
CREATE OR REPLACE FUNCTION mmc.cam_v2_mentor_can_access(
  p_assignment_id uuid, p_subject_link_id uuid, p_required_capability text DEFAULT 'mmc.mentor.read'
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, mmc
SET row_security = off
AS $$
  SELECT mmc.cam_v2_actor_is_active('MENTOR')
     AND mmc.cam_v2_current_principal_kind() = 'MENTOR'
     AND mmc.cam_v2_has_capability(p_required_capability)
     AND EXISTS (
       SELECT 1
       FROM mmc.cam_v2_assignments AS assignment
       JOIN mmc.cam_v2_subject_links AS subject_link
         ON subject_link.tenant_id = assignment.tenant_id
        AND subject_link.environment = assignment.environment
        AND subject_link.id = assignment.subject_link_id
       JOIN mmc.cam_v2_principals AS student_principal
         ON student_principal.tenant_id = subject_link.tenant_id
        AND student_principal.environment = subject_link.environment
        AND student_principal.id = subject_link.student_principal_id
        AND student_principal.principal_kind = 'STUDENT'
        AND student_principal.status = 'ACTIVE'
       WHERE assignment.tenant_id = mmc.cam_v2_current_tenant_id()
         AND assignment.environment = mmc.cam_v2_current_environment()
         AND assignment.id = p_assignment_id
         AND assignment.subject_link_id = p_subject_link_id
         AND assignment.mentor_principal_id = mmc.cam_v2_current_principal_id()
         AND assignment.assignment_scope = 'COACHING'
         AND assignment.status = 'ACTIVE' AND assignment.effective_at <= statement_timestamp()
         AND (assignment.expires_at IS NULL OR assignment.expires_at > statement_timestamp())
         AND assignment.revoked_at IS NULL
         AND subject_link.identity_state = 'VERIFIED_LOCAL_LINK'
         AND subject_link.revoked_at IS NULL
     );
$$;

CREATE OR REPLACE FUNCTION mmc.cam_v2_student_owns_subject(p_subject_link_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, mmc
SET row_security = off
AS $$
  SELECT mmc.cam_v2_actor_is_active('STUDENT')
     AND mmc.cam_v2_current_principal_kind() = 'STUDENT'
     AND p_subject_link_id = mmc.cam_v2_current_subject_link_id()
     AND EXISTS (
       SELECT 1 FROM mmc.cam_v2_subject_links AS subject_link
       WHERE subject_link.tenant_id = mmc.cam_v2_current_tenant_id()
         AND subject_link.environment = mmc.cam_v2_current_environment()
         AND subject_link.id = p_subject_link_id
         AND subject_link.student_principal_id = mmc.cam_v2_current_principal_id()
         AND subject_link.identity_state = 'VERIFIED_LOCAL_LINK'
         AND subject_link.revoked_at IS NULL
     );
$$;

CREATE OR REPLACE FUNCTION mmc.cam_v2_worker_lease_matches(p_job_id uuid, p_required_capability text)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = pg_catalog, mmc
AS $$
  SELECT mmc.cam_v2_actor_is_active('WORKLOAD')
     AND mmc.cam_v2_current_principal_kind() = 'WORKLOAD'
     AND mmc.cam_v2_has_capability(p_required_capability)
     AND p_job_id = mmc.cam_v2_current_job_id()
     AND mmc.cam_v2_job_authority_is_active(p_job_id)
     AND EXISTS (
       SELECT 1 FROM mmc.cam_v2_jobs AS job
       WHERE job.tenant_id = mmc.cam_v2_current_tenant_id()
         AND job.environment = mmc.cam_v2_current_environment()
         AND job.id = p_job_id
         AND job.queue_name = mmc.cam_v2_current_queue_name()
         AND job.lease_owner_principal_id = mmc.cam_v2_current_principal_id()
         AND job.lease_generation = mmc.cam_v2_current_lease_generation()
         AND job.lease_expires_at > statement_timestamp()
         AND job.status IN ('LEASED', 'RUNNING')
         AND mmc.cam_v2_plane_is_enabled(mmc.cam_v2_job_plane(job.job_kind))
     );
$$;

CREATE OR REPLACE FUNCTION mmc.cam_v2_worker_can_read_input(
  p_producer_job_id uuid,
  p_input_kind text,
  p_input_id uuid,
  p_producer_authority_grant_id uuid,
  p_assignment_id uuid,
  p_subject_link_id uuid,
  p_required_capability text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, mmc
SET row_security = off
AS $$
  SELECT mmc.cam_v2_worker_lease_matches(mmc.cam_v2_current_job_id(), p_required_capability)
     AND (
       (
         p_producer_job_id = mmc.cam_v2_current_job_id()
         AND mmc.cam_v2_worker_row_matches_job(
           p_producer_job_id, p_assignment_id, p_subject_link_id
         )
       )
       OR EXISTS (
         SELECT 1
         FROM mmc.cam_v2_job_inputs AS input
         JOIN mmc.cam_v2_jobs AS producer
           ON producer.tenant_id = input.tenant_id
          AND producer.environment = input.environment
          AND producer.id = input.producer_job_id
         WHERE input.tenant_id = mmc.cam_v2_current_tenant_id()
           AND input.environment = mmc.cam_v2_current_environment()
           AND input.consumer_job_id = mmc.cam_v2_current_job_id()
           AND input.producer_job_id = p_producer_job_id
           AND input.producer_authority_grant_id = p_producer_authority_grant_id
           AND input.assignment_id = p_assignment_id
           AND input.subject_link_id = p_subject_link_id
           AND input.input_kind = upper(coalesce(p_input_kind, ''))
           AND (
             (input.input_kind = 'SOURCE_ASSET' AND input.source_asset_id = p_input_id AND EXISTS (
               SELECT 1 FROM mmc.cam_v2_source_assets AS source
               WHERE source.tenant_id = input.tenant_id
                 AND source.environment = input.environment
                 AND source.id = input.source_asset_id
                 AND source.asset_state IN ('PAIR_VERIFIED', 'ATTACHED', 'RETAINED')
             ))
             OR (input.input_kind = 'TRANSCRIPT_VERSION' AND input.transcript_version_id = p_input_id AND EXISTS (
               SELECT 1 FROM mmc.cam_v2_transcript_versions AS transcript
               WHERE transcript.tenant_id = input.tenant_id
                 AND transcript.environment = input.environment
                 AND transcript.id = input.transcript_version_id
                 AND transcript.transcript_state = 'VERIFIED'
             ))
           )
           AND producer.status = 'SUCCEEDED'
           AND producer.external_dispatch_generation = producer.lease_generation
           AND producer.external_result_generation = producer.lease_generation
           AND producer.external_outcome = 'SUCCEEDED'
           AND producer.result_digest IS NOT NULL
           AND producer.external_result_digest = producer.result_digest
           AND mmc.cam_v2_job_authority_is_active(input.producer_job_id)
       )
     );
$$;

-- Mutation RPCs call this volatile lock/CAS gate inside their transaction.
-- It locks and revalidates every durable authority row that can revoke a job
-- between an initial read and its mutation under READ COMMITTED.
CREATE OR REPLACE FUNCTION mmc.cam_v2_lock_job_mutation_authority(
  p_job_id uuid, p_required_capability text, p_lease_mode text
)
RETURNS bigint
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, mmc
SET row_security = off
AS $$
DECLARE
  v_job mmc.cam_v2_jobs%ROWTYPE;
  v_authority mmc.cam_v2_authority_grants%ROWTYPE;
  v_policy mmc.cam_v2_policy_versions%ROWTYPE;
  v_subject_link mmc.cam_v2_subject_links%ROWTYPE;
  v_assignment mmc.cam_v2_assignments%ROWTYPE;
  v_cutover mmc.cam_v2_cutover_states%ROWTYPE;
  v_tenant_status text;
  v_principal_kind text;
  v_principal_status text;
  v_student_principal_kind text;
  v_student_principal_status text;
  v_assignment_mentor_kind text;
  v_assignment_mentor_status text;
  v_mode text := upper(coalesce(p_lease_mode, ''));
  v_required_grant_kind text;
  v_plane text;
  v_plane_enabled boolean := false;
  v_is_reconciler boolean := false;
  v_skip_active_authority boolean := false;
BEGIN
  v_is_reconciler := v_mode IN ('RECONCILE_RESULT', 'RECONCILE_HANDOFF_TARGET', 'INACTIVE_CLEANUP')
    AND mmc.cam_v2_current_principal_kind() IN ('OPERATOR', 'ADMIN')
    AND mmc.cam_v2_is_trust_operator(true);
  v_skip_active_authority := v_mode IN ('RESULT_EVIDENCE', 'RECONCILE_RESULT', 'INACTIVE_CLEANUP');

  IF p_job_id IS NULL
     OR v_mode NOT IN (
       'CLAIM', 'CURRENT_LEASE', 'RESULT_EVIDENCE', 'EXPIRED_LEASE',
       'HANDOFF_TARGET', 'RECONCILE_RESULT', 'RECONCILE_HANDOFF_TARGET',
       'INACTIVE_CLEANUP'
     )
     OR mmc.cam_v2_current_tenant_id() IS NULL
     OR mmc.cam_v2_current_principal_id() IS NULL
     OR mmc.cam_v2_current_environment() NOT IN ('FIXTURE', 'LOCAL', 'STAGING', 'LIVE')
     OR (
       NOT v_is_reconciler
       AND (
         mmc.cam_v2_current_principal_kind() <> 'WORKLOAD'
         OR NOT mmc.cam_v2_has_capability(p_required_capability)
       )
     ) THEN
    RETURN NULL;
  END IF;

  SELECT job.* INTO v_job
  FROM mmc.cam_v2_jobs AS job
  WHERE job.tenant_id = mmc.cam_v2_current_tenant_id()
    AND job.environment = mmc.cam_v2_current_environment()
    AND job.id = p_job_id
  FOR UPDATE;
  IF NOT FOUND OR (
    v_mode NOT IN ('HANDOFF_TARGET', 'RECONCILE_RESULT', 'RECONCILE_HANDOFF_TARGET', 'INACTIVE_CLEANUP')
    AND v_job.queue_name IS DISTINCT FROM mmc.cam_v2_current_queue_name()
  ) THEN
    RETURN NULL;
  END IF;

  SELECT tenant.status INTO v_tenant_status
  FROM mmc.cam_v2_tenants AS tenant
  WHERE tenant.id = v_job.tenant_id AND tenant.environment = v_job.environment
  FOR UPDATE;
  IF NOT FOUND OR v_tenant_status <> 'ACTIVE' THEN RETURN NULL; END IF;

  SELECT principal.principal_kind, principal.status
  INTO v_principal_kind, v_principal_status
  FROM mmc.cam_v2_principals AS principal
  WHERE principal.tenant_id = v_job.tenant_id
    AND principal.environment = v_job.environment
    AND principal.id = mmc.cam_v2_current_principal_id()
  FOR UPDATE;
  IF NOT FOUND OR v_principal_status <> 'ACTIVE'
     OR (v_is_reconciler AND v_principal_kind NOT IN ('OPERATOR', 'ADMIN'))
     OR (NOT v_is_reconciler AND v_principal_kind <> 'WORKLOAD') THEN
    RETURN NULL;
  END IF;

  SELECT authority.* INTO v_authority
  FROM mmc.cam_v2_authority_grants AS authority
  WHERE authority.tenant_id = v_job.tenant_id
    AND authority.environment = v_job.environment
    AND authority.id = v_job.authority_grant_id
  FOR UPDATE;
  IF NOT FOUND
     OR v_authority.assignment_id IS DISTINCT FROM v_job.assignment_id
     OR v_authority.subject_link_id IS DISTINCT FROM v_job.subject_link_id
     OR (
       NOT v_skip_active_authority AND (
         v_authority.status <> 'ACTIVE'
         OR v_authority.effective_at > clock_timestamp()
         OR (v_authority.expires_at IS NOT NULL AND v_authority.expires_at <= clock_timestamp())
         OR v_authority.revoked_at IS NOT NULL
       )
     ) THEN
    RETURN NULL;
  END IF;

  SELECT policy.* INTO v_policy
  FROM mmc.cam_v2_policy_versions AS policy
  WHERE policy.tenant_id = v_authority.tenant_id
    AND policy.environment = v_authority.environment
    AND policy.id = v_authority.policy_version_id
    AND policy.policy_kind = v_authority.grant_kind
  FOR UPDATE;
  IF NOT FOUND OR (
    NOT v_skip_active_authority AND (
      v_policy.status <> 'ACTIVE'
      OR v_policy.effective_at IS NULL
      OR v_policy.effective_at > clock_timestamp()
      OR (v_policy.expires_at IS NOT NULL AND v_policy.expires_at <= clock_timestamp())
    )
  ) THEN
    RETURN NULL;
  END IF;

  IF v_job.subject_link_id IS NOT NULL THEN
    SELECT subject_link.* INTO v_subject_link
    FROM mmc.cam_v2_subject_links AS subject_link
    WHERE subject_link.tenant_id = v_job.tenant_id
      AND subject_link.environment = v_job.environment
      AND subject_link.id = v_job.subject_link_id
    FOR UPDATE;
    IF NOT FOUND THEN RETURN NULL; END IF;

    IF NOT v_skip_active_authority THEN
      IF v_subject_link.identity_state <> 'VERIFIED_LOCAL_LINK'
         OR v_subject_link.revoked_at IS NOT NULL
         OR v_subject_link.student_principal_id IS NULL THEN
        RETURN NULL;
      END IF;

      SELECT principal.principal_kind, principal.status
      INTO v_student_principal_kind, v_student_principal_status
      FROM mmc.cam_v2_principals AS principal
      WHERE principal.tenant_id = v_job.tenant_id
        AND principal.environment = v_job.environment
        AND principal.id = v_subject_link.student_principal_id
      FOR UPDATE;
      IF NOT FOUND OR v_student_principal_kind <> 'STUDENT'
         OR v_student_principal_status <> 'ACTIVE' THEN
        RETURN NULL;
      END IF;
    END IF;
  END IF;

  IF v_job.assignment_id IS NOT NULL THEN
    SELECT assignment.* INTO v_assignment
    FROM mmc.cam_v2_assignments AS assignment
    WHERE assignment.tenant_id = v_job.tenant_id
      AND assignment.environment = v_job.environment
      AND assignment.id = v_job.assignment_id
      AND assignment.subject_link_id = v_job.subject_link_id
    FOR UPDATE;
    IF NOT FOUND OR (
      NOT v_skip_active_authority AND (
        v_assignment.status <> 'ACTIVE'
        OR v_assignment.assignment_scope <> 'COACHING'
        OR v_assignment.effective_at > clock_timestamp()
        OR (v_assignment.expires_at IS NOT NULL AND v_assignment.expires_at <= clock_timestamp())
        OR v_assignment.revoked_at IS NOT NULL
      )
    ) THEN
      RETURN NULL;
    END IF;
    IF NOT v_skip_active_authority THEN
      SELECT principal.principal_kind, principal.status
      INTO v_assignment_mentor_kind, v_assignment_mentor_status
      FROM mmc.cam_v2_principals AS principal
      WHERE principal.tenant_id = v_job.tenant_id
        AND principal.environment = v_job.environment
        AND principal.id = v_assignment.mentor_principal_id
      FOR UPDATE;
      IF NOT FOUND OR v_assignment_mentor_kind <> 'MENTOR'
         OR v_assignment_mentor_status <> 'ACTIVE' THEN
        RETURN NULL;
      END IF;
    END IF;
  ELSIF v_job.subject_link_id IS NOT NULL THEN
    RETURN NULL;
  END IF;

  SELECT cutover.* INTO v_cutover
  FROM mmc.cam_v2_cutover_states AS cutover
  WHERE cutover.tenant_id = v_job.tenant_id
    AND cutover.environment = v_job.environment
    AND cutover.component_name = 'MMC_CANONICAL'
  FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  v_plane := mmc.cam_v2_job_plane(v_job.job_kind);
  v_plane_enabled := CASE v_plane
    WHEN 'commands' THEN v_cutover.commands_enabled
    WHEN 'ingest' THEN v_cutover.ingest_enabled
    WHEN 'ai_proposal' THEN v_cutover.ai_proposal_enabled
    WHEN 'operational_promotion' THEN v_cutover.operational_promotion_enabled
    WHEN 'student_publication' THEN v_cutover.student_publication_enabled
    ELSE false
  END;
  IF NOT v_skip_active_authority THEN
    IF v_cutover.writer_state <> 'V2_ACTIVE'
       OR NOT v_plane_enabled THEN
      RETURN NULL;
    END IF;
  END IF;

  v_required_grant_kind := CASE v_job.job_kind
    WHEN 'SOURCE_DISCOVERY' THEN 'ACQUISITION'
    WHEN 'ASSET_ACQUISITION' THEN 'ACQUISITION'
    WHEN 'TRANSCRIPT_PROCESSING' THEN 'TRANSCRIPT_PROCESSING'
    WHEN 'AI_ANALYSIS' THEN 'AI_TRANSFER'
    WHEN 'PUBLICATION_RENDER' THEN 'PUBLICATION'
    WHEN 'RECONCILIATION' THEN 'AI_TRANSFER'
    ELSE ''
  END;
  IF v_authority.grant_kind <> v_required_grant_kind THEN RETURN NULL; END IF;

  IF NOT v_is_reconciler
     AND v_mode NOT IN ('HANDOFF_TARGET', 'RECONCILE_HANDOFF_TARGET')
     AND NOT mmc.cam_v2_has_capability(mmc.cam_v2_job_execution_capability(v_job.job_kind)) THEN
    RETURN NULL;
  END IF;

  IF v_mode = 'CURRENT_LEASE' AND (
    v_job.id IS DISTINCT FROM mmc.cam_v2_current_job_id()
    OR v_job.lease_owner_principal_id IS DISTINCT FROM mmc.cam_v2_current_principal_id()
    OR v_job.lease_generation IS DISTINCT FROM mmc.cam_v2_current_lease_generation()
    OR v_job.lease_expires_at IS NULL OR v_job.lease_expires_at <= clock_timestamp()
    OR v_job.status NOT IN ('LEASED', 'RUNNING')
  ) THEN
    RETURN NULL;
  END IF;
  IF v_mode = 'RESULT_EVIDENCE' AND (
    v_job.id IS DISTINCT FROM mmc.cam_v2_current_job_id()
    OR v_job.lease_owner_principal_id IS DISTINCT FROM mmc.cam_v2_current_principal_id()
    OR v_job.lease_generation IS DISTINCT FROM mmc.cam_v2_current_lease_generation()
    OR v_job.status NOT IN ('LEASED', 'RUNNING')
  ) THEN
    RETURN NULL;
  END IF;
  IF v_mode = 'EXPIRED_LEASE' AND (
    v_job.id IS DISTINCT FROM mmc.cam_v2_current_job_id()
    OR v_job.lease_owner_principal_id IS DISTINCT FROM mmc.cam_v2_current_principal_id()
    OR v_job.lease_generation IS DISTINCT FROM mmc.cam_v2_current_lease_generation()
    OR v_job.lease_expires_at IS NULL OR v_job.lease_expires_at > clock_timestamp()
    OR v_job.status NOT IN ('LEASED', 'RUNNING')
  ) THEN
    RETURN NULL;
  END IF;
  IF v_mode IN ('HANDOFF_TARGET', 'RECONCILE_HANDOFF_TARGET') AND (
    v_job.status NOT IN ('QUEUED', 'RETRY_SCHEDULED')
    OR v_job.attempt_count <> 0
    OR v_job.input_set_digest IS NOT NULL
    OR v_job.input_set_frozen_at IS NOT NULL
  ) THEN
    RETURN NULL;
  END IF;
  IF v_mode = 'CLAIM' AND NOT (
    (v_job.status IN ('QUEUED', 'RETRY_SCHEDULED') AND v_job.available_at <= clock_timestamp())
    OR (
      v_job.status IN ('LEASED', 'RUNNING')
      AND v_job.lease_expires_at <= clock_timestamp()
      AND v_job.external_dispatch_generation IS NULL
      AND v_job.external_result_generation IS NULL
    )
  ) THEN
    RETURN NULL;
  END IF;
  IF v_mode = 'RECONCILE_RESULT' AND (
    v_job.status NOT IN ('LEASED', 'RUNNING')
    OR v_job.lease_expires_at IS NULL
    OR v_job.lease_expires_at > clock_timestamp()
  ) THEN
    RETURN NULL;
  END IF;
  IF v_mode = 'INACTIVE_CLEANUP' AND (
    (
      mmc.cam_v2_job_durable_authority_is_active(v_job.id)
      AND v_cutover.writer_state = 'V2_ACTIVE'
      AND v_plane_enabled
    )
    OR NOT (
      v_job.status IN ('QUEUED', 'RETRY_SCHEDULED')
      OR (v_job.status IN ('LEASED', 'RUNNING')
        AND v_job.lease_expires_at IS NOT NULL
        AND v_job.lease_expires_at <= clock_timestamp())
    )
  ) THEN
    RETURN NULL;
  END IF;

  RETURN v_job.object_version;
END;
$$;

-- Lock every typed handoff edge and producer generation before a consumer is
-- leased. The returned digest is canonical, generation-bound, and immutable
-- once frozen on the consumer job.
CREATE OR REPLACE FUNCTION mmc.cam_v2_lock_ready_job_input_digest(p_job_id uuid)
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, mmc
SET row_security = off
AS $$
DECLARE
  v_consumer mmc.cam_v2_jobs%ROWTYPE;
  v_edge record;
  v_input_count integer := 0;
  v_material jsonb := '[]'::jsonb;
  v_digest text;
  v_state text;
  v_artifact_version bigint;
  v_artifact_digest text;
  v_artifact_secondary_digest text;
BEGIN
  SELECT job.* INTO v_consumer
  FROM mmc.cam_v2_jobs AS job
  WHERE job.tenant_id = mmc.cam_v2_current_tenant_id()
    AND job.environment = mmc.cam_v2_current_environment()
    AND job.id = p_job_id
  FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;

  FOR v_edge IN
    SELECT input.*, producer.job_kind AS producer_kind,
           producer.status AS producer_status,
           producer.lease_generation AS producer_generation,
           producer.external_dispatch_generation AS producer_dispatch_generation,
           producer.external_result_generation AS producer_result_generation,
           producer.external_outcome AS producer_outcome,
           producer.external_result_digest AS producer_external_result_digest,
           producer.result_digest AS producer_result_digest
    FROM mmc.cam_v2_job_inputs AS input
    JOIN mmc.cam_v2_jobs AS producer
      ON producer.tenant_id = input.tenant_id
     AND producer.environment = input.environment
     AND producer.id = input.producer_job_id
    WHERE input.tenant_id = v_consumer.tenant_id
      AND input.environment = v_consumer.environment
      AND input.consumer_job_id = v_consumer.id
    ORDER BY input.id
    FOR UPDATE OF input, producer
  LOOP
    v_input_count := v_input_count + 1;
    v_artifact_secondary_digest := '';
    IF v_edge.producer_status <> 'SUCCEEDED'
       OR v_edge.producer_dispatch_generation IS DISTINCT FROM v_edge.producer_generation
       OR v_edge.producer_result_generation IS DISTINCT FROM v_edge.producer_generation
       OR v_edge.producer_outcome <> 'SUCCEEDED'
       OR v_edge.producer_result_digest IS NULL
       OR v_edge.producer_external_result_digest IS DISTINCT FROM v_edge.producer_result_digest THEN
      RETURN NULL;
    END IF;

    IF v_consumer.job_kind = 'TRANSCRIPT_PROCESSING'
       AND v_edge.input_kind = 'SOURCE_ASSET'
       AND v_edge.producer_kind = 'ASSET_ACQUISITION' THEN
      SELECT source.asset_state, source.object_version, source.content_digest
      INTO v_state, v_artifact_version, v_artifact_digest
      FROM mmc.cam_v2_source_assets AS source
      WHERE source.tenant_id = v_edge.tenant_id
        AND source.environment = v_edge.environment
        AND source.id = v_edge.source_asset_id
        AND source.job_id = v_edge.producer_job_id
        AND source.authority_grant_id = v_edge.producer_authority_grant_id
        AND source.assignment_id = v_edge.assignment_id
        AND source.subject_link_id = v_edge.subject_link_id
      FOR UPDATE;
      IF NOT FOUND OR v_state NOT IN ('PAIR_VERIFIED', 'ATTACHED', 'RETAINED')
         OR v_artifact_digest IS NULL
         OR v_artifact_digest IS DISTINCT FROM v_edge.producer_result_digest THEN RETURN NULL; END IF;
    ELSIF v_consumer.job_kind = 'AI_ANALYSIS'
       AND v_edge.input_kind = 'TRANSCRIPT_VERSION'
       AND v_edge.producer_kind = 'TRANSCRIPT_PROCESSING' THEN
      SELECT transcript.transcript_state, transcript.object_version,
             transcript.transcript_digest, transcript.normalized_digest
      INTO v_state, v_artifact_version, v_artifact_secondary_digest, v_artifact_digest
      FROM mmc.cam_v2_transcript_versions AS transcript
      WHERE transcript.tenant_id = v_edge.tenant_id
        AND transcript.environment = v_edge.environment
        AND transcript.id = v_edge.transcript_version_id
        AND transcript.job_id = v_edge.producer_job_id
        AND transcript.authority_grant_id = v_edge.producer_authority_grant_id
        AND transcript.assignment_id = v_edge.assignment_id
        AND transcript.subject_link_id = v_edge.subject_link_id
      FOR UPDATE;
      IF NOT FOUND OR v_state <> 'VERIFIED'
         OR v_artifact_digest IS DISTINCT FROM v_edge.producer_result_digest THEN RETURN NULL; END IF;
    ELSE
      RETURN NULL;
    END IF;

    v_material := v_material || jsonb_build_array(jsonb_build_object(
      'edgeId', v_edge.id, 'inputKind', v_edge.input_kind,
      'producerJobId', v_edge.producer_job_id,
      'producerGeneration', v_edge.producer_generation,
      'producerResultDigest', v_edge.producer_result_digest,
      'producerAuthorityGrantId', v_edge.producer_authority_grant_id,
      'consumerAuthorityGrantId', v_edge.consumer_authority_grant_id,
      'assignmentId', v_edge.assignment_id, 'subjectLinkId', v_edge.subject_link_id,
      'sourceAssetId', v_edge.source_asset_id,
      'transcriptVersionId', v_edge.transcript_version_id,
      'artifactVersion', v_artifact_version,
      'artifactDigest', v_artifact_digest,
      'artifactSecondaryDigest', nullif(v_artifact_secondary_digest, '')
    ));
  END LOOP;

  IF v_consumer.job_kind IN ('TRANSCRIPT_PROCESSING', 'AI_ANALYSIS') AND v_input_count = 0 THEN
    RETURN NULL;
  END IF;
  IF v_consumer.job_kind NOT IN ('TRANSCRIPT_PROCESSING', 'AI_ANALYSIS') AND v_input_count <> 0 THEN
    RETURN NULL;
  END IF;
  v_digest := mmc.cam_v2_sha256_jsonb(v_material);
  IF v_consumer.input_set_digest IS NOT NULL
     AND v_consumer.input_set_digest IS DISTINCT FROM v_digest THEN
    RETURN NULL;
  END IF;
  RETURN v_digest;
END;
$$;

-- A producer may become SUCCEEDED only when its exact result digest is already
-- materialized in an immutable typed artifact and handed to a still-unfrozen,
-- currently-authorized next-stage consumer. Both the active completion RPC and
-- operator adjudication call this one lock-taking invariant.
CREATE OR REPLACE FUNCTION mmc.cam_v2_assert_exact_success_handoff(
  p_job_id uuid, p_result_digest text
)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, mmc
SET row_security = off
AS $$
DECLARE
  v_producer mmc.cam_v2_jobs%ROWTYPE;
BEGIN
  SELECT job.* INTO v_producer
  FROM mmc.cam_v2_jobs AS job
  WHERE job.tenant_id = mmc.cam_v2_current_tenant_id()
    AND job.environment = mmc.cam_v2_current_environment()
    AND job.id = p_job_id
  FOR UPDATE;
  IF NOT FOUND OR p_result_digest IS NULL OR p_result_digest !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'exact producer result is required for handoff validation'
      USING ERRCODE = '23514';
  END IF;

  IF v_producer.job_kind = 'ASSET_ACQUISITION' THEN
    PERFORM input.id
    FROM mmc.cam_v2_job_inputs AS input
    JOIN mmc.cam_v2_source_assets AS source
      ON source.tenant_id = input.tenant_id
     AND source.environment = input.environment
     AND source.id = input.source_asset_id
     AND source.job_id = input.producer_job_id
     AND source.authority_grant_id = input.producer_authority_grant_id
     AND source.assignment_id = input.assignment_id
     AND source.subject_link_id = input.subject_link_id
    JOIN mmc.cam_v2_jobs AS consumer
      ON consumer.tenant_id = input.tenant_id
     AND consumer.environment = input.environment
     AND consumer.id = input.consumer_job_id
     AND consumer.authority_grant_id = input.consumer_authority_grant_id
     AND consumer.assignment_id = input.assignment_id
     AND consumer.subject_link_id = input.subject_link_id
    WHERE input.tenant_id = v_producer.tenant_id
      AND input.environment = v_producer.environment
      AND input.producer_job_id = v_producer.id
      AND input.producer_authority_grant_id = v_producer.authority_grant_id
      AND input.input_kind = 'SOURCE_ASSET'
      AND source.content_digest = p_result_digest
      AND source.asset_state IN ('PAIR_VERIFIED', 'ATTACHED', 'RETAINED')
      AND consumer.job_kind = 'TRANSCRIPT_PROCESSING'
      AND consumer.status IN ('QUEUED', 'RETRY_SCHEDULED')
      AND consumer.attempt_count = 0
      AND consumer.input_set_digest IS NULL
      AND consumer.input_set_frozen_at IS NULL
      AND mmc.cam_v2_job_durable_authority_is_active(consumer.id)
      AND mmc.cam_v2_plane_is_enabled(mmc.cam_v2_job_plane(consumer.job_kind))
    ORDER BY input.id
    LIMIT 1
    FOR UPDATE OF input, source, consumer;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'successful acquisition requires an exact digest-bound active transcript handoff'
        USING ERRCODE = '23514', CONSTRAINT = 'cam_v2_jobs_exact_success_handoff';
    END IF;
  ELSIF v_producer.job_kind = 'TRANSCRIPT_PROCESSING' THEN
    PERFORM input.id
    FROM mmc.cam_v2_job_inputs AS input
    JOIN mmc.cam_v2_transcript_versions AS transcript
      ON transcript.tenant_id = input.tenant_id
     AND transcript.environment = input.environment
     AND transcript.id = input.transcript_version_id
     AND transcript.job_id = input.producer_job_id
     AND transcript.authority_grant_id = input.producer_authority_grant_id
     AND transcript.assignment_id = input.assignment_id
     AND transcript.subject_link_id = input.subject_link_id
    JOIN mmc.cam_v2_jobs AS consumer
      ON consumer.tenant_id = input.tenant_id
     AND consumer.environment = input.environment
     AND consumer.id = input.consumer_job_id
     AND consumer.authority_grant_id = input.consumer_authority_grant_id
     AND consumer.assignment_id = input.assignment_id
     AND consumer.subject_link_id = input.subject_link_id
    WHERE input.tenant_id = v_producer.tenant_id
      AND input.environment = v_producer.environment
      AND input.producer_job_id = v_producer.id
      AND input.producer_authority_grant_id = v_producer.authority_grant_id
      AND input.input_kind = 'TRANSCRIPT_VERSION'
      AND transcript.normalized_digest = p_result_digest
      AND transcript.transcript_state = 'VERIFIED'
      AND consumer.job_kind = 'AI_ANALYSIS'
      AND consumer.status IN ('QUEUED', 'RETRY_SCHEDULED')
      AND consumer.attempt_count = 0
      AND consumer.input_set_digest IS NULL
      AND consumer.input_set_frozen_at IS NULL
      AND mmc.cam_v2_job_durable_authority_is_active(consumer.id)
      AND mmc.cam_v2_plane_is_enabled(mmc.cam_v2_job_plane(consumer.job_kind))
    ORDER BY input.id
    LIMIT 1
    FOR UPDATE OF input, transcript, consumer;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'successful transcript processing requires an exact digest-bound active analysis handoff'
        USING ERRCODE = '23514', CONSTRAINT = 'cam_v2_jobs_exact_success_handoff';
    END IF;
  ELSIF v_producer.job_kind = 'AI_ANALYSIS' THEN
    PERFORM analysis.id
    FROM mmc.cam_v2_analysis_runs AS analysis
    JOIN mmc.cam_v2_job_inputs AS input
      ON input.tenant_id = analysis.tenant_id
     AND input.environment = analysis.environment
     AND input.consumer_job_id = analysis.job_id
     AND input.input_kind = 'TRANSCRIPT_VERSION'
     AND input.transcript_version_id = analysis.transcript_version_id
     AND input.consumer_authority_grant_id = analysis.authority_grant_id
     AND input.assignment_id = analysis.assignment_id
     AND input.subject_link_id = analysis.subject_link_id
    WHERE analysis.tenant_id = v_producer.tenant_id
      AND analysis.environment = v_producer.environment
      AND analysis.job_id = v_producer.id
      AND analysis.authority_grant_id = v_producer.authority_grant_id
      AND analysis.assignment_id = v_producer.assignment_id
      AND analysis.subject_link_id = v_producer.subject_link_id
      AND analysis.analysis_state = 'PROPOSED'
      AND analysis.completed_at IS NOT NULL
      AND analysis.result_digest = p_result_digest
    ORDER BY analysis.id
    LIMIT 1
    FOR UPDATE OF analysis, input;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'successful analysis requires an exact typed analysis result bound to its frozen transcript input'
        USING ERRCODE = '23514', CONSTRAINT = 'cam_v2_jobs_exact_analysis_result';
    END IF;
  ELSE
    RAISE EXCEPTION 'job kind is sealed until a reviewed typed success attestation exists'
      USING ERRCODE = '23514', CONSTRAINT = 'cam_v2_jobs_unsupported_success_sealed';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION mmc.cam_v2_outbox_lease_matches(
  p_outbox_event_id uuid, p_required_capability text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, mmc
SET row_security = off
AS $$
  SELECT mmc.cam_v2_actor_is_active('WORKLOAD')
     AND mmc.cam_v2_has_capability(p_required_capability)
     AND p_outbox_event_id = mmc.cam_v2_current_outbox_event_id()
     AND EXISTS (
       SELECT 1 FROM mmc.cam_v2_outbox_events AS event
       WHERE event.tenant_id = mmc.cam_v2_current_tenant_id()
         AND event.environment = mmc.cam_v2_current_environment()
         AND event.id = p_outbox_event_id
         AND event.delivery_queue_name = mmc.cam_v2_current_queue_name()
         AND event.delivery_lease_owner_principal_id = mmc.cam_v2_current_principal_id()
         AND event.delivery_lease_generation = mmc.cam_v2_current_outbox_lease_generation()
         AND event.delivery_lease_expires_at > statement_timestamp()
         AND event.delivery_state = 'LEASED'
     );
$$;

CREATE OR REPLACE FUNCTION mmc.cam_v2_outbox_origin_is_active(p_outbox_event_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, mmc
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM mmc.cam_v2_outbox_events AS event
    WHERE event.tenant_id = mmc.cam_v2_current_tenant_id()
      AND event.environment = mmc.cam_v2_current_environment()
      AND event.id = p_outbox_event_id
      AND (
        (event.job_id IS NOT NULL
          AND mmc.cam_v2_job_durable_authority_is_active(event.job_id))
        OR (event.job_id IS NULL AND event.aggregate_kind = 'SUBJECT' AND EXISTS (
          SELECT 1
          FROM mmc.cam_v2_subject_links AS subject_link
          JOIN mmc.cam_v2_principals AS student
            ON student.tenant_id = subject_link.tenant_id
           AND student.environment = subject_link.environment
           AND student.id = subject_link.student_principal_id
           AND student.principal_kind = 'STUDENT'
          WHERE subject_link.tenant_id = event.tenant_id
            AND subject_link.environment = event.environment
            AND subject_link.id = event.aggregate_id
            AND subject_link.identity_state = 'VERIFIED_LOCAL_LINK'
            AND subject_link.revoked_at IS NULL
            AND student.status = 'ACTIVE'
        ))
        OR (event.job_id IS NULL AND event.aggregate_kind = 'ASSIGNMENT' AND EXISTS (
          SELECT 1
          FROM mmc.cam_v2_assignments AS assignment
          JOIN mmc.cam_v2_subject_links AS subject_link
            ON subject_link.tenant_id = assignment.tenant_id
           AND subject_link.environment = assignment.environment
           AND subject_link.id = assignment.subject_link_id
          JOIN mmc.cam_v2_principals AS mentor
            ON mentor.tenant_id = assignment.tenant_id
           AND mentor.environment = assignment.environment
           AND mentor.id = assignment.mentor_principal_id
           AND mentor.principal_kind = 'MENTOR'
          JOIN mmc.cam_v2_principals AS student
            ON student.tenant_id = subject_link.tenant_id
           AND student.environment = subject_link.environment
           AND student.id = subject_link.student_principal_id
           AND student.principal_kind = 'STUDENT'
          WHERE assignment.tenant_id = event.tenant_id
            AND assignment.environment = event.environment
            AND assignment.id = event.aggregate_id
            AND assignment.assignment_scope = 'COACHING'
            AND assignment.status = 'ACTIVE'
            AND assignment.effective_at <= statement_timestamp()
            AND (assignment.expires_at IS NULL OR assignment.expires_at > statement_timestamp())
            AND assignment.revoked_at IS NULL
            AND subject_link.identity_state = 'VERIFIED_LOCAL_LINK'
            AND subject_link.revoked_at IS NULL
            AND mentor.status = 'ACTIVE'
            AND student.status = 'ACTIVE'
        ))
        OR (event.job_id IS NULL AND event.aggregate_kind = 'SESSION' AND EXISTS (
          SELECT 1
          FROM mmc.cam_v2_sessions AS session
          JOIN mmc.cam_v2_assignments AS assignment
            ON assignment.tenant_id = session.tenant_id
           AND assignment.environment = session.environment
           AND assignment.id = session.assignment_id
           AND assignment.subject_link_id = session.subject_link_id
          JOIN mmc.cam_v2_subject_links AS subject_link
            ON subject_link.tenant_id = assignment.tenant_id
           AND subject_link.environment = assignment.environment
           AND subject_link.id = assignment.subject_link_id
          JOIN mmc.cam_v2_principals AS mentor
            ON mentor.tenant_id = assignment.tenant_id
           AND mentor.environment = assignment.environment
           AND mentor.id = assignment.mentor_principal_id
           AND mentor.principal_kind = 'MENTOR'
          JOIN mmc.cam_v2_principals AS student
            ON student.tenant_id = subject_link.tenant_id
           AND student.environment = subject_link.environment
           AND student.id = subject_link.student_principal_id
           AND student.principal_kind = 'STUDENT'
          WHERE session.tenant_id = event.tenant_id
            AND session.environment = event.environment
            AND session.id = event.aggregate_id
            AND assignment.assignment_scope = 'COACHING'
            AND assignment.status = 'ACTIVE'
            AND assignment.effective_at <= statement_timestamp()
            AND (assignment.expires_at IS NULL OR assignment.expires_at > statement_timestamp())
            AND assignment.revoked_at IS NULL
            AND subject_link.identity_state = 'VERIFIED_LOCAL_LINK'
            AND subject_link.revoked_at IS NULL
            AND mentor.status = 'ACTIVE'
            AND student.status = 'ACTIVE'
        ))
        OR (event.job_id IS NULL AND event.aggregate_kind = 'PUBLICATION' AND EXISTS (
          SELECT 1
          FROM mmc.cam_v2_publications AS publication
          JOIN mmc.cam_v2_subject_links AS subject_link
            ON subject_link.tenant_id = publication.tenant_id
           AND subject_link.environment = publication.environment
           AND subject_link.id = publication.subject_link_id
          JOIN mmc.cam_v2_principals AS student
            ON student.tenant_id = subject_link.tenant_id
           AND student.environment = subject_link.environment
           AND student.id = subject_link.student_principal_id
           AND student.principal_kind = 'STUDENT'
          WHERE publication.tenant_id = event.tenant_id
            AND publication.environment = event.environment
            AND publication.id = event.aggregate_id
            AND publication.publication_state IN ('PUBLISHED', 'ACKNOWLEDGED', 'CORRECTED')
            AND subject_link.identity_state = 'VERIFIED_LOCAL_LINK'
            AND subject_link.revoked_at IS NULL
            AND student.status = 'ACTIVE'
        ))
      )
  );
$$;

CREATE OR REPLACE FUNCTION mmc.cam_v2_lock_outbox_origin_active(p_outbox_event_id uuid)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, mmc
SET row_security = off
AS $$
DECLARE
  v_event mmc.cam_v2_outbox_events%ROWTYPE;
  v_job mmc.cam_v2_jobs%ROWTYPE;
BEGIN
  -- Caller owns the outbox row first. All revocable origin rows are then held
  -- with shared locks until the delivery mutation commits.
  SELECT event.* INTO v_event
  FROM mmc.cam_v2_outbox_events AS event
  WHERE event.tenant_id = mmc.cam_v2_current_tenant_id()
    AND event.environment = mmc.cam_v2_current_environment()
    AND event.id = p_outbox_event_id;
  IF NOT FOUND THEN RETURN false; END IF;

  IF v_event.job_id IS NOT NULL THEN
    SELECT job.* INTO v_job
    FROM mmc.cam_v2_jobs AS job
    WHERE job.tenant_id = v_event.tenant_id
      AND job.environment = v_event.environment
      AND job.id = v_event.job_id
    FOR SHARE;
    IF NOT FOUND THEN RETURN false; END IF;
    PERFORM 1
    FROM mmc.cam_v2_authority_grants AS authority
    JOIN mmc.cam_v2_policy_versions AS policy
      ON policy.tenant_id = authority.tenant_id
     AND policy.environment = authority.environment
     AND policy.id = authority.policy_version_id
     AND policy.policy_kind = authority.grant_kind
    WHERE authority.tenant_id = v_event.tenant_id
      AND authority.environment = v_event.environment
      AND authority.id = v_job.authority_grant_id
    FOR SHARE OF authority, policy;
    IF NOT FOUND THEN RETURN false; END IF;
    IF v_job.assignment_id IS NOT NULL THEN
      PERFORM 1
      FROM mmc.cam_v2_assignments AS assignment
      JOIN mmc.cam_v2_subject_links AS subject_link
        ON subject_link.tenant_id = assignment.tenant_id
       AND subject_link.environment = assignment.environment
       AND subject_link.id = assignment.subject_link_id
      JOIN mmc.cam_v2_principals AS mentor
        ON mentor.tenant_id = assignment.tenant_id
       AND mentor.environment = assignment.environment
       AND mentor.id = assignment.mentor_principal_id
      JOIN mmc.cam_v2_principals AS student
        ON student.tenant_id = subject_link.tenant_id
       AND student.environment = subject_link.environment
       AND student.id = subject_link.student_principal_id
      WHERE assignment.tenant_id = v_event.tenant_id
        AND assignment.environment = v_event.environment
        AND assignment.id = v_job.assignment_id
        AND assignment.subject_link_id = v_job.subject_link_id
      FOR SHARE OF assignment, subject_link, mentor, student;
      IF NOT FOUND THEN RETURN false; END IF;
    END IF;
  ELSIF v_event.aggregate_kind = 'SUBJECT' THEN
    PERFORM 1
    FROM mmc.cam_v2_subject_links AS subject_link
    JOIN mmc.cam_v2_principals AS student
      ON student.tenant_id = subject_link.tenant_id
     AND student.environment = subject_link.environment
     AND student.id = subject_link.student_principal_id
    WHERE subject_link.tenant_id = v_event.tenant_id
      AND subject_link.environment = v_event.environment
      AND subject_link.id = v_event.aggregate_id
    FOR SHARE OF subject_link, student;
    IF NOT FOUND THEN RETURN false; END IF;
  ELSIF v_event.aggregate_kind = 'ASSIGNMENT' THEN
    PERFORM 1
    FROM mmc.cam_v2_assignments AS assignment
    JOIN mmc.cam_v2_subject_links AS subject_link
      ON subject_link.tenant_id = assignment.tenant_id
     AND subject_link.environment = assignment.environment
     AND subject_link.id = assignment.subject_link_id
    JOIN mmc.cam_v2_principals AS mentor
      ON mentor.tenant_id = assignment.tenant_id
     AND mentor.environment = assignment.environment
     AND mentor.id = assignment.mentor_principal_id
    JOIN mmc.cam_v2_principals AS student
      ON student.tenant_id = subject_link.tenant_id
     AND student.environment = subject_link.environment
     AND student.id = subject_link.student_principal_id
    WHERE assignment.tenant_id = v_event.tenant_id
      AND assignment.environment = v_event.environment
      AND assignment.id = v_event.aggregate_id
    FOR SHARE OF assignment, subject_link, mentor, student;
    IF NOT FOUND THEN RETURN false; END IF;
  ELSIF v_event.aggregate_kind = 'SESSION' THEN
    PERFORM 1
    FROM mmc.cam_v2_sessions AS session
    JOIN mmc.cam_v2_assignments AS assignment
      ON assignment.tenant_id = session.tenant_id
     AND assignment.environment = session.environment
     AND assignment.id = session.assignment_id
     AND assignment.subject_link_id = session.subject_link_id
    JOIN mmc.cam_v2_subject_links AS subject_link
      ON subject_link.tenant_id = assignment.tenant_id
     AND subject_link.environment = assignment.environment
     AND subject_link.id = assignment.subject_link_id
    JOIN mmc.cam_v2_principals AS mentor
      ON mentor.tenant_id = assignment.tenant_id
     AND mentor.environment = assignment.environment
     AND mentor.id = assignment.mentor_principal_id
    JOIN mmc.cam_v2_principals AS student
      ON student.tenant_id = subject_link.tenant_id
     AND student.environment = subject_link.environment
     AND student.id = subject_link.student_principal_id
    WHERE session.tenant_id = v_event.tenant_id
      AND session.environment = v_event.environment
      AND session.id = v_event.aggregate_id
    FOR SHARE OF session, assignment, subject_link, mentor, student;
    IF NOT FOUND THEN RETURN false; END IF;
  ELSIF v_event.aggregate_kind = 'PUBLICATION' THEN
    PERFORM 1
    FROM mmc.cam_v2_publications AS publication
    JOIN mmc.cam_v2_subject_links AS subject_link
      ON subject_link.tenant_id = publication.tenant_id
     AND subject_link.environment = publication.environment
     AND subject_link.id = publication.subject_link_id
    JOIN mmc.cam_v2_principals AS student
      ON student.tenant_id = subject_link.tenant_id
     AND student.environment = subject_link.environment
     AND student.id = subject_link.student_principal_id
    WHERE publication.tenant_id = v_event.tenant_id
      AND publication.environment = v_event.environment
      AND publication.id = v_event.aggregate_id
    FOR SHARE OF publication, subject_link, student;
    IF NOT FOUND THEN RETURN false; END IF;
  ELSE
    RETURN false;
  END IF;
  RETURN mmc.cam_v2_outbox_origin_is_active(p_outbox_event_id);
END;
$$;

CREATE OR REPLACE FUNCTION mmc.cam_v2_lock_outbox_delivery(
  p_outbox_event_id uuid, p_lease_mode text
)
RETURNS bigint
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, mmc
SET row_security = off
AS $$
DECLARE
  v_event mmc.cam_v2_outbox_events%ROWTYPE;
  v_mode text := upper(coalesce(p_lease_mode, ''));
  v_status text;
  v_kind text;
  v_cutover mmc.cam_v2_cutover_states%ROWTYPE;
  v_is_operator_cleanup boolean := false;
BEGIN
  v_is_operator_cleanup := v_mode = 'INACTIVE_CLEANUP'
    AND mmc.cam_v2_current_principal_kind() IN ('OPERATOR', 'ADMIN')
    AND mmc.cam_v2_is_trust_operator(true);
  IF p_outbox_event_id IS NULL
     OR v_mode NOT IN ('CLAIM', 'CURRENT_LEASE', 'TERMINAL_CLEANUP', 'INACTIVE_CLEANUP')
     OR (NOT v_is_operator_cleanup AND (
       mmc.cam_v2_current_principal_kind() <> 'WORKLOAD'
       OR NOT mmc.cam_v2_has_capability('mmc.worker.outbox_dispatch')
     ))
     OR mmc.cam_v2_current_tenant_id() IS NULL
     OR mmc.cam_v2_current_principal_id() IS NULL THEN
    RETURN NULL;
  END IF;
  SELECT event.* INTO v_event
  FROM mmc.cam_v2_outbox_events AS event
  WHERE event.tenant_id = mmc.cam_v2_current_tenant_id()
    AND event.environment = mmc.cam_v2_current_environment()
    AND event.id = p_outbox_event_id
  FOR UPDATE;
  IF NOT FOUND OR (
    NOT v_is_operator_cleanup
    AND v_event.delivery_queue_name IS DISTINCT FROM mmc.cam_v2_current_queue_name()
  ) THEN RETURN NULL; END IF;

  SELECT tenant.status INTO v_status
  FROM mmc.cam_v2_tenants AS tenant
  WHERE tenant.id = v_event.tenant_id AND tenant.environment = v_event.environment
  FOR UPDATE;
  IF NOT FOUND OR v_status <> 'ACTIVE' THEN RETURN NULL; END IF;
  SELECT principal.principal_kind, principal.status INTO v_kind, v_status
  FROM mmc.cam_v2_principals AS principal
  WHERE principal.tenant_id = v_event.tenant_id
    AND principal.environment = v_event.environment
    AND principal.id = mmc.cam_v2_current_principal_id()
  FOR UPDATE;
  IF NOT FOUND OR v_status <> 'ACTIVE'
     OR (v_is_operator_cleanup AND v_kind NOT IN ('OPERATOR', 'ADMIN'))
     OR (NOT v_is_operator_cleanup AND v_kind <> 'WORKLOAD') THEN RETURN NULL; END IF;
  SELECT cutover.* INTO v_cutover
  FROM mmc.cam_v2_cutover_states AS cutover
  WHERE cutover.tenant_id = v_event.tenant_id
    AND cutover.environment = v_event.environment
    AND cutover.component_name = 'MMC_CANONICAL'
  FOR UPDATE;
  IF NOT FOUND OR (
    v_mode NOT IN ('TERMINAL_CLEANUP', 'INACTIVE_CLEANUP')
    AND (v_cutover.writer_state <> 'V2_ACTIVE' OR NOT v_cutover.commands_enabled)
  ) THEN RETURN NULL; END IF;

  IF v_mode = 'INACTIVE_CLEANUP'
     AND mmc.cam_v2_lock_outbox_origin_active(v_event.id)
     AND v_cutover.writer_state = 'V2_ACTIVE'
     AND v_cutover.commands_enabled THEN
    RETURN NULL;
  ELSIF v_mode NOT IN ('TERMINAL_CLEANUP', 'INACTIVE_CLEANUP')
     AND NOT mmc.cam_v2_lock_outbox_origin_active(v_event.id) THEN
    RETURN NULL;
  END IF;

  IF v_mode = 'CLAIM' AND NOT (
    v_event.attempt_count < v_event.max_attempts
    AND v_event.available_at <= clock_timestamp()
    AND (
      v_event.delivery_state IN ('PENDING', 'RETRY')
      OR (v_event.delivery_state = 'LEASED' AND v_event.delivery_lease_expires_at <= clock_timestamp())
    )
  ) THEN RETURN NULL; END IF;
  IF v_mode IN ('CURRENT_LEASE', 'TERMINAL_CLEANUP') AND (
    v_event.id IS DISTINCT FROM mmc.cam_v2_current_outbox_event_id()
    OR v_event.delivery_lease_owner_principal_id IS DISTINCT FROM mmc.cam_v2_current_principal_id()
    OR v_event.delivery_lease_generation IS DISTINCT FROM mmc.cam_v2_current_outbox_lease_generation()
    OR v_event.delivery_lease_expires_at IS NULL
    OR v_event.delivery_lease_expires_at <= clock_timestamp()
    OR v_event.delivery_state <> 'LEASED'
  ) THEN RETURN NULL; END IF;
  IF v_mode = 'INACTIVE_CLEANUP' AND NOT (
    v_event.delivery_state IN ('PENDING', 'RETRY')
    OR (v_event.delivery_state = 'LEASED'
      AND v_event.delivery_lease_expires_at IS NOT NULL
      AND v_event.delivery_lease_expires_at <= clock_timestamp())
  ) THEN RETURN NULL; END IF;
  RETURN v_event.object_version;
END;
$$;

-- All security-relevant runtime state changes append to the same serialized,
-- tamper-evident chain in the transaction that mutates the protected object.
CREATE OR REPLACE FUNCTION mmc.cam_v2_append_runtime_audit(
  p_action text, p_purpose text, p_object_kind text, p_object_id uuid,
  p_subject_link_id uuid, p_assignment_id uuid,
  p_before_digest text, p_after_digest text, p_correlation_id text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, mmc
SET row_security = off
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF NOT mmc.cam_v2_actor_is_active()
     OR p_action IS NULL OR p_action !~ '^[A-Z][A-Z0-9_]{2,63}$'
     OR p_purpose IS NULL OR octet_length(p_purpose) NOT BETWEEN 1 AND 500
     OR p_object_kind IS NULL OR p_object_kind !~ '^[A-Z][A-Z0-9_]{1,63}$'
     OR p_object_id IS NULL
     OR (p_before_digest IS NOT NULL AND p_before_digest !~ '^[a-f0-9]{64}$')
     OR p_after_digest IS NULL OR p_after_digest !~ '^[a-f0-9]{64}$'
     OR p_correlation_id IS NULL
     OR p_correlation_id !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{2,199}$' THEN
    RAISE EXCEPTION 'runtime audit append input or actor denied' USING ERRCODE = '42501';
  END IF;
  INSERT INTO mmc.cam_v2_audit_events (
    tenant_id, environment, principal_id, effective_principal_kind,
    subject_link_id, assignment_id, action, purpose, object_kind, object_id,
    before_digest, after_digest, outcome, correlation_id, chain_key_version
  ) VALUES (
    mmc.cam_v2_current_tenant_id(), mmc.cam_v2_current_environment(),
    mmc.cam_v2_current_principal_id(), mmc.cam_v2_current_principal_kind(),
    p_subject_link_id, p_assignment_id, p_action, p_purpose, p_object_kind,
    p_object_id, p_before_digest, p_after_digest, 'COMMITTED',
    p_correlation_id, 1
  ) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION mmc.cam_v2_audit_runtime_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, mmc
SET row_security = off
AS $$
DECLARE
  v_action text;
  v_purpose text;
  v_object_kind text;
  v_object_id uuid;
  v_subject_link_id uuid;
  v_assignment_id uuid;
  v_before_digest text;
  v_after_digest text;
  v_correlation_id text;
BEGIN
  -- Owner bootstrap/maintenance is outside the signed runtime path. Every
  -- authenticated RPC mutation has an active durable actor and is mandatory.
  IF NOT mmc.cam_v2_actor_is_active() THEN RETURN NEW; END IF;

  IF TG_TABLE_NAME = 'cam_v2_jobs' THEN
    v_action := CASE
      WHEN NEW.external_result_generation IS NOT NULL
        AND NEW.external_result_generation IS DISTINCT FROM OLD.external_result_generation
        THEN 'JOB_EXTERNAL_RESULT_RECORDED'
      WHEN NEW.external_dispatch_generation IS NOT NULL
        AND NEW.external_dispatch_generation IS DISTINCT FROM OLD.external_dispatch_generation
        THEN 'JOB_EXTERNAL_DISPATCH_RECORDED'
      WHEN NEW.status IS DISTINCT FROM OLD.status
        AND mmc.cam_v2_current_principal_kind() IN ('ADMIN', 'OPERATOR')
        THEN 'JOB_EXTERNAL_RECONCILED'
      WHEN NEW.status IS DISTINCT FROM OLD.status OR NEW.lease_generation IS DISTINCT FROM OLD.lease_generation
        THEN 'JOB_STATE_TRANSITION'
      WHEN NEW.lease_expires_at IS DISTINCT FROM OLD.lease_expires_at
        THEN 'JOB_LEASE_HEARTBEAT'
      ELSE 'JOB_MUTATED'
    END;
    v_purpose := 'Persist the exact signed worker or operator job state transition.';
    v_object_kind := 'JOB'; v_object_id := NEW.id;
    v_subject_link_id := NEW.subject_link_id; v_assignment_id := NEW.assignment_id;
    -- Hash the complete durable row image. Timestamps are replaced by signed
    -- epoch-microsecond integers so the digest is independent of session
    -- timezone and DateStyle while retaining every immutable binding and every
    -- mutable provider, retry, lease, completion, and version field.
    v_before_digest := mmc.cam_v2_sha256_jsonb(
      (to_jsonb(OLD) - ARRAY[
        'available_at', 'input_set_frozen_at', 'lease_expires_at',
        'external_dispatch_recorded_at', 'external_result_recorded_at',
        'completed_at', 'created_at', 'updated_at'
      ]) || jsonb_build_object(
        'availableAtEpochMicroseconds', mmc.cam_v2_epoch_microseconds(OLD.available_at),
        'inputSetFrozenAtEpochMicroseconds', mmc.cam_v2_epoch_microseconds(OLD.input_set_frozen_at),
        'leaseExpiresAtEpochMicroseconds', mmc.cam_v2_epoch_microseconds(OLD.lease_expires_at),
        'externalDispatchRecordedAtEpochMicroseconds', mmc.cam_v2_epoch_microseconds(OLD.external_dispatch_recorded_at),
        'externalResultRecordedAtEpochMicroseconds', mmc.cam_v2_epoch_microseconds(OLD.external_result_recorded_at),
        'completedAtEpochMicroseconds', mmc.cam_v2_epoch_microseconds(OLD.completed_at),
        'createdAtEpochMicroseconds', mmc.cam_v2_epoch_microseconds(OLD.created_at),
        'updatedAtEpochMicroseconds', mmc.cam_v2_epoch_microseconds(OLD.updated_at)
      )
    );
    v_after_digest := mmc.cam_v2_sha256_jsonb(
      (to_jsonb(NEW) - ARRAY[
        'available_at', 'input_set_frozen_at', 'lease_expires_at',
        'external_dispatch_recorded_at', 'external_result_recorded_at',
        'completed_at', 'created_at', 'updated_at'
      ]) || jsonb_build_object(
        'availableAtEpochMicroseconds', mmc.cam_v2_epoch_microseconds(NEW.available_at),
        'inputSetFrozenAtEpochMicroseconds', mmc.cam_v2_epoch_microseconds(NEW.input_set_frozen_at),
        'leaseExpiresAtEpochMicroseconds', mmc.cam_v2_epoch_microseconds(NEW.lease_expires_at),
        'externalDispatchRecordedAtEpochMicroseconds', mmc.cam_v2_epoch_microseconds(NEW.external_dispatch_recorded_at),
        'externalResultRecordedAtEpochMicroseconds', mmc.cam_v2_epoch_microseconds(NEW.external_result_recorded_at),
        'completedAtEpochMicroseconds', mmc.cam_v2_epoch_microseconds(NEW.completed_at),
        'createdAtEpochMicroseconds', mmc.cam_v2_epoch_microseconds(NEW.created_at),
        'updatedAtEpochMicroseconds', mmc.cam_v2_epoch_microseconds(NEW.updated_at)
      )
    );
    v_correlation_id := 'job.' || NEW.id::text || '.' || NEW.object_version::text || '.' || lower(v_action);
  ELSIF TG_TABLE_NAME = 'cam_v2_outbox_events' THEN
    v_action := CASE
      WHEN TG_OP = 'INSERT' THEN 'OUTBOX_EVENT_APPENDED'
      WHEN NEW.external_resolution IS DISTINCT FROM OLD.external_resolution
        THEN 'OUTBOX_EVIDENCE_RESOLVED'
      WHEN NEW.delivery_state IS DISTINCT FROM OLD.delivery_state
        THEN 'OUTBOX_DELIVERY_TRANSITION'
      WHEN NEW.delivery_lease_expires_at IS DISTINCT FROM OLD.delivery_lease_expires_at
        THEN 'OUTBOX_LEASE_HEARTBEAT'
      ELSE 'OUTBOX_MUTATED'
    END;
    v_purpose := CASE WHEN TG_OP = 'INSERT'
      THEN 'Append the exact signed provider, reconciliation, or completion outbox event.'
      ELSE 'Persist the exact signed outbox delivery or evidence-resolution transition.' END;
    v_object_kind := 'OUTBOX_EVENT'; v_object_id := NEW.id;
    IF NEW.job_id IS NOT NULL THEN
      SELECT job.subject_link_id, job.assignment_id
      INTO v_subject_link_id, v_assignment_id
      FROM mmc.cam_v2_jobs AS job
      WHERE job.tenant_id = NEW.tenant_id AND job.environment = NEW.environment
        AND job.id = NEW.job_id;
    END IF;
    v_before_digest := CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE mmc.cam_v2_sha256_jsonb(
      (to_jsonb(OLD) - ARRAY[
        'external_result_recorded_at', 'external_resolved_at', 'available_at',
        'delivery_lease_expires_at', 'delivered_at', 'delivery_completed_at',
        'created_at', 'updated_at'
      ]) || jsonb_build_object(
        'externalResultRecordedAtEpochMicroseconds', mmc.cam_v2_epoch_microseconds(OLD.external_result_recorded_at),
        'externalResolvedAtEpochMicroseconds', mmc.cam_v2_epoch_microseconds(OLD.external_resolved_at),
        'availableAtEpochMicroseconds', mmc.cam_v2_epoch_microseconds(OLD.available_at),
        'deliveryLeaseExpiresAtEpochMicroseconds', mmc.cam_v2_epoch_microseconds(OLD.delivery_lease_expires_at),
        'deliveredAtEpochMicroseconds', mmc.cam_v2_epoch_microseconds(OLD.delivered_at),
        'deliveryCompletedAtEpochMicroseconds', mmc.cam_v2_epoch_microseconds(OLD.delivery_completed_at),
        'createdAtEpochMicroseconds', mmc.cam_v2_epoch_microseconds(OLD.created_at),
        'updatedAtEpochMicroseconds', mmc.cam_v2_epoch_microseconds(OLD.updated_at)
      )
    ) END;
    v_after_digest := mmc.cam_v2_sha256_jsonb(
      (to_jsonb(NEW) - ARRAY[
        'external_result_recorded_at', 'external_resolved_at', 'available_at',
        'delivery_lease_expires_at', 'delivered_at', 'delivery_completed_at',
        'created_at', 'updated_at'
      ]) || jsonb_build_object(
        'externalResultRecordedAtEpochMicroseconds', mmc.cam_v2_epoch_microseconds(NEW.external_result_recorded_at),
        'externalResolvedAtEpochMicroseconds', mmc.cam_v2_epoch_microseconds(NEW.external_resolved_at),
        'availableAtEpochMicroseconds', mmc.cam_v2_epoch_microseconds(NEW.available_at),
        'deliveryLeaseExpiresAtEpochMicroseconds', mmc.cam_v2_epoch_microseconds(NEW.delivery_lease_expires_at),
        'deliveredAtEpochMicroseconds', mmc.cam_v2_epoch_microseconds(NEW.delivered_at),
        'deliveryCompletedAtEpochMicroseconds', mmc.cam_v2_epoch_microseconds(NEW.delivery_completed_at),
        'createdAtEpochMicroseconds', mmc.cam_v2_epoch_microseconds(NEW.created_at),
        'updatedAtEpochMicroseconds', mmc.cam_v2_epoch_microseconds(NEW.updated_at)
      )
    );
    v_correlation_id := 'outbox.' || NEW.id::text || '.' || NEW.object_version::text || '.' || lower(v_action);
  ELSIF TG_TABLE_NAME = 'cam_v2_consumer_effects' THEN
    v_action := 'OUTBOX_EFFECT_COMMITTED';
    v_purpose := 'Persist one exact consumer effect before its atomic inbox receipt.';
    v_object_kind := 'CONSUMER_EFFECT'; v_object_id := NEW.id;
    IF NEW.source_job_id IS NOT NULL THEN
      SELECT job.subject_link_id, job.assignment_id
      INTO v_subject_link_id, v_assignment_id
      FROM mmc.cam_v2_jobs AS job
      WHERE job.tenant_id = NEW.tenant_id AND job.environment = NEW.environment
        AND job.id = NEW.source_job_id;
    END IF;
    v_before_digest := NULL;
    v_after_digest := mmc.cam_v2_sha256_jsonb(
      (to_jsonb(NEW) - ARRAY['applied_at', 'created_at', 'updated_at'])
      || jsonb_build_object(
        'appliedAtEpochMicroseconds', mmc.cam_v2_epoch_microseconds(NEW.applied_at),
        'createdAtEpochMicroseconds', mmc.cam_v2_epoch_microseconds(NEW.created_at),
        'updatedAtEpochMicroseconds', mmc.cam_v2_epoch_microseconds(NEW.updated_at)
      )
    );
    v_correlation_id := 'effect.' || NEW.id::text || '.' || NEW.object_version::text;
  ELSIF TG_TABLE_NAME = 'cam_v2_consumer_inbox' THEN
    v_action := 'INBOX_RECEIPT_COMMITTED';
    v_purpose := 'Persist the exact atomic receipt for one committed consumer effect.';
    v_object_kind := 'INBOX_RECEIPT'; v_object_id := NEW.id;
    IF NEW.job_id IS NOT NULL THEN
      SELECT job.subject_link_id, job.assignment_id
      INTO v_subject_link_id, v_assignment_id
      FROM mmc.cam_v2_jobs AS job
      WHERE job.tenant_id = NEW.tenant_id AND job.environment = NEW.environment
        AND job.id = NEW.job_id;
    END IF;
    v_before_digest := NULL;
    v_after_digest := mmc.cam_v2_sha256_jsonb(
      (to_jsonb(NEW) - ARRAY['created_at', 'updated_at'])
      || jsonb_build_object(
        'createdAtEpochMicroseconds', mmc.cam_v2_epoch_microseconds(NEW.created_at),
        'updatedAtEpochMicroseconds', mmc.cam_v2_epoch_microseconds(NEW.updated_at)
      )
    );
    v_correlation_id := 'inbox.' || NEW.id::text || '.' || NEW.object_version::text;
  ELSIF TG_TABLE_NAME = 'cam_v2_job_inputs' THEN
    v_action := 'JOB_INPUT_REGISTERED';
    v_purpose := 'Persist one exact typed producer-to-consumer handoff edge.';
    v_object_kind := 'JOB_INPUT'; v_object_id := NEW.id;
    v_subject_link_id := NEW.subject_link_id; v_assignment_id := NEW.assignment_id;
    v_before_digest := NULL;
    v_after_digest := mmc.cam_v2_sha256_jsonb(
      (to_jsonb(NEW) - ARRAY['created_at', 'updated_at'])
      || jsonb_build_object(
        'createdAtEpochMicroseconds', mmc.cam_v2_epoch_microseconds(NEW.created_at),
        'updatedAtEpochMicroseconds', mmc.cam_v2_epoch_microseconds(NEW.updated_at)
      )
    );
    v_correlation_id := 'input.' || NEW.id::text || '.' || NEW.object_version::text;
  ELSE
    RETURN NEW;
  END IF;

  PERFORM mmc.cam_v2_append_runtime_audit(
    v_action, v_purpose, v_object_kind, v_object_id,
    v_subject_link_id, v_assignment_id,
    v_before_digest, v_after_digest, v_correlation_id
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS cam_v2_jobs_runtime_audit ON mmc.cam_v2_jobs;
CREATE TRIGGER cam_v2_jobs_runtime_audit
AFTER UPDATE ON mmc.cam_v2_jobs
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_audit_runtime_mutation();
DROP TRIGGER IF EXISTS cam_v2_outbox_runtime_audit ON mmc.cam_v2_outbox_events;
CREATE TRIGGER cam_v2_outbox_runtime_audit
AFTER INSERT OR UPDATE ON mmc.cam_v2_outbox_events
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_audit_runtime_mutation();
DROP TRIGGER IF EXISTS cam_v2_consumer_effects_runtime_audit ON mmc.cam_v2_consumer_effects;
CREATE TRIGGER cam_v2_consumer_effects_runtime_audit
AFTER INSERT ON mmc.cam_v2_consumer_effects
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_audit_runtime_mutation();
DROP TRIGGER IF EXISTS cam_v2_consumer_inbox_runtime_audit ON mmc.cam_v2_consumer_inbox;
CREATE TRIGGER cam_v2_consumer_inbox_runtime_audit
AFTER INSERT ON mmc.cam_v2_consumer_inbox
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_audit_runtime_mutation();
DROP TRIGGER IF EXISTS cam_v2_job_inputs_runtime_audit ON mmc.cam_v2_job_inputs;
CREATE TRIGGER cam_v2_job_inputs_runtime_audit
AFTER INSERT ON mmc.cam_v2_job_inputs
FOR EACH ROW EXECUTE FUNCTION mmc.cam_v2_audit_runtime_mutation();

-- ---------------------------------------------------------------------------
-- Deny-first table boundary. FORCE follows ENABLE for every v2 table and all
-- policy installation precedes every runtime grant.
-- ---------------------------------------------------------------------------

ALTER TABLE mmc.cam_v2_tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE mmc.cam_v2_tenants FORCE ROW LEVEL SECURITY;
ALTER TABLE mmc.cam_v2_principals ENABLE ROW LEVEL SECURITY;
ALTER TABLE mmc.cam_v2_principals FORCE ROW LEVEL SECURITY;
ALTER TABLE mmc.cam_v2_subject_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE mmc.cam_v2_subject_links FORCE ROW LEVEL SECURITY;
ALTER TABLE mmc.cam_v2_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE mmc.cam_v2_assignments FORCE ROW LEVEL SECURITY;
ALTER TABLE mmc.cam_v2_policy_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE mmc.cam_v2_policy_versions FORCE ROW LEVEL SECURITY;
ALTER TABLE mmc.cam_v2_authority_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE mmc.cam_v2_authority_grants FORCE ROW LEVEL SECURITY;
ALTER TABLE mmc.cam_v2_command_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE mmc.cam_v2_command_receipts FORCE ROW LEVEL SECURITY;
ALTER TABLE mmc.cam_v2_idempotency_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE mmc.cam_v2_idempotency_records FORCE ROW LEVEL SECURITY;
ALTER TABLE mmc.cam_v2_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE mmc.cam_v2_jobs FORCE ROW LEVEL SECURITY;
ALTER TABLE mmc.cam_v2_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE mmc.cam_v2_sessions FORCE ROW LEVEL SECURITY;
ALTER TABLE mmc.cam_v2_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE mmc.cam_v2_tasks FORCE ROW LEVEL SECURITY;
ALTER TABLE mmc.cam_v2_commitments ENABLE ROW LEVEL SECURITY;
ALTER TABLE mmc.cam_v2_commitments FORCE ROW LEVEL SECURITY;
ALTER TABLE mmc.cam_v2_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE mmc.cam_v2_goals FORCE ROW LEVEL SECURITY;
ALTER TABLE mmc.cam_v2_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE mmc.cam_v2_milestones FORCE ROW LEVEL SECURITY;
ALTER TABLE mmc.cam_v2_student_statements ENABLE ROW LEVEL SECURITY;
ALTER TABLE mmc.cam_v2_student_statements FORCE ROW LEVEL SECURITY;
ALTER TABLE mmc.cam_v2_student_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE mmc.cam_v2_student_responses FORCE ROW LEVEL SECURITY;
ALTER TABLE mmc.cam_v2_source_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE mmc.cam_v2_source_assets FORCE ROW LEVEL SECURITY;
ALTER TABLE mmc.cam_v2_transcript_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE mmc.cam_v2_transcript_versions FORCE ROW LEVEL SECURITY;
ALTER TABLE mmc.cam_v2_job_inputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE mmc.cam_v2_job_inputs FORCE ROW LEVEL SECURITY;
ALTER TABLE mmc.cam_v2_evidence_spans ENABLE ROW LEVEL SECURITY;
ALTER TABLE mmc.cam_v2_evidence_spans FORCE ROW LEVEL SECURITY;
ALTER TABLE mmc.cam_v2_analysis_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE mmc.cam_v2_analysis_runs FORCE ROW LEVEL SECURITY;
ALTER TABLE mmc.cam_v2_ai_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE mmc.cam_v2_ai_proposals FORCE ROW LEVEL SECURITY;
ALTER TABLE mmc.cam_v2_review_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE mmc.cam_v2_review_decisions FORCE ROW LEVEL SECURITY;
ALTER TABLE mmc.cam_v2_publications ENABLE ROW LEVEL SECURITY;
ALTER TABLE mmc.cam_v2_publications FORCE ROW LEVEL SECURITY;
ALTER TABLE mmc.cam_v2_publication_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE mmc.cam_v2_publication_items FORCE ROW LEVEL SECURITY;
ALTER TABLE mmc.cam_v2_outbox_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE mmc.cam_v2_outbox_events FORCE ROW LEVEL SECURITY;
ALTER TABLE mmc.cam_v2_consumer_effects ENABLE ROW LEVEL SECURITY;
ALTER TABLE mmc.cam_v2_consumer_effects FORCE ROW LEVEL SECURITY;
ALTER TABLE mmc.cam_v2_consumer_inbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE mmc.cam_v2_consumer_inbox FORCE ROW LEVEL SECURITY;
ALTER TABLE mmc.cam_v2_lineage_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE mmc.cam_v2_lineage_edges FORCE ROW LEVEL SECURITY;
ALTER TABLE mmc.cam_v2_audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE mmc.cam_v2_audit_events FORCE ROW LEVEL SECURITY;
ALTER TABLE mmc.cam_v2_cutover_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE mmc.cam_v2_cutover_states FORCE ROW LEVEL SECURITY;

-- Runtime trust/operator access is read-only. Bootstrap and maintenance writes
-- require an explicit owner-controlled path outside the authenticated role.
DROP POLICY IF EXISTS cam_v2_tenants_trust_admin ON mmc.cam_v2_tenants;
CREATE POLICY cam_v2_tenants_trust_admin ON mmc.cam_v2_tenants FOR SELECT TO authenticated
  USING (id = mmc.cam_v2_current_tenant_id() AND environment = mmc.cam_v2_current_environment() AND mmc.cam_v2_is_trust_admin());

DROP POLICY IF EXISTS cam_v2_principals_trust_admin ON mmc.cam_v2_principals;
CREATE POLICY cam_v2_principals_trust_admin ON mmc.cam_v2_principals FOR SELECT TO authenticated
  USING (mmc.cam_v2_same_scope(tenant_id, environment) AND mmc.cam_v2_is_trust_operator(false));
DROP POLICY IF EXISTS cam_v2_subject_links_trust_admin ON mmc.cam_v2_subject_links;
CREATE POLICY cam_v2_subject_links_trust_admin ON mmc.cam_v2_subject_links FOR SELECT TO authenticated
  USING (mmc.cam_v2_same_scope(tenant_id, environment) AND mmc.cam_v2_is_trust_operator(false));
DROP POLICY IF EXISTS cam_v2_assignments_trust_admin ON mmc.cam_v2_assignments;
CREATE POLICY cam_v2_assignments_trust_admin ON mmc.cam_v2_assignments FOR SELECT TO authenticated
  USING (mmc.cam_v2_same_scope(tenant_id, environment) AND mmc.cam_v2_is_trust_operator(false));
DROP POLICY IF EXISTS cam_v2_policy_versions_trust_admin ON mmc.cam_v2_policy_versions;
CREATE POLICY cam_v2_policy_versions_trust_admin ON mmc.cam_v2_policy_versions FOR SELECT TO authenticated
  USING (mmc.cam_v2_same_scope(tenant_id, environment) AND mmc.cam_v2_is_trust_operator(false));
DROP POLICY IF EXISTS cam_v2_authority_grants_trust_admin ON mmc.cam_v2_authority_grants;
CREATE POLICY cam_v2_authority_grants_trust_admin ON mmc.cam_v2_authority_grants FOR SELECT TO authenticated
  USING (mmc.cam_v2_same_scope(tenant_id, environment) AND mmc.cam_v2_is_trust_operator(false));
DROP POLICY IF EXISTS cam_v2_command_receipts_trust_admin ON mmc.cam_v2_command_receipts;
CREATE POLICY cam_v2_command_receipts_trust_admin ON mmc.cam_v2_command_receipts FOR SELECT TO authenticated
  USING (mmc.cam_v2_same_scope(tenant_id, environment) AND mmc.cam_v2_is_trust_operator(false));
DROP POLICY IF EXISTS cam_v2_idempotency_trust_admin ON mmc.cam_v2_idempotency_records;
CREATE POLICY cam_v2_idempotency_trust_admin ON mmc.cam_v2_idempotency_records FOR SELECT TO authenticated
  USING (mmc.cam_v2_same_scope(tenant_id, environment) AND mmc.cam_v2_is_trust_operator(false));
DROP POLICY IF EXISTS cam_v2_jobs_trust_admin ON mmc.cam_v2_jobs;
CREATE POLICY cam_v2_jobs_trust_admin ON mmc.cam_v2_jobs FOR SELECT TO authenticated
  USING (mmc.cam_v2_same_scope(tenant_id, environment) AND mmc.cam_v2_is_trust_operator(false));

DROP POLICY IF EXISTS cam_v2_sessions_trust_admin ON mmc.cam_v2_sessions;
CREATE POLICY cam_v2_sessions_trust_admin ON mmc.cam_v2_sessions FOR SELECT TO authenticated
  USING (mmc.cam_v2_same_scope(tenant_id, environment) AND mmc.cam_v2_is_trust_operator(false));
DROP POLICY IF EXISTS cam_v2_tasks_trust_admin ON mmc.cam_v2_tasks;
CREATE POLICY cam_v2_tasks_trust_admin ON mmc.cam_v2_tasks FOR SELECT TO authenticated
  USING (mmc.cam_v2_same_scope(tenant_id, environment) AND mmc.cam_v2_is_trust_operator(false));
DROP POLICY IF EXISTS cam_v2_commitments_trust_admin ON mmc.cam_v2_commitments;
CREATE POLICY cam_v2_commitments_trust_admin ON mmc.cam_v2_commitments FOR SELECT TO authenticated
  USING (mmc.cam_v2_same_scope(tenant_id, environment) AND mmc.cam_v2_is_trust_operator(false));
DROP POLICY IF EXISTS cam_v2_goals_trust_admin ON mmc.cam_v2_goals;
CREATE POLICY cam_v2_goals_trust_admin ON mmc.cam_v2_goals FOR SELECT TO authenticated
  USING (mmc.cam_v2_same_scope(tenant_id, environment) AND mmc.cam_v2_is_trust_operator(false));
DROP POLICY IF EXISTS cam_v2_milestones_trust_admin ON mmc.cam_v2_milestones;
CREATE POLICY cam_v2_milestones_trust_admin ON mmc.cam_v2_milestones FOR SELECT TO authenticated
  USING (mmc.cam_v2_same_scope(tenant_id, environment) AND mmc.cam_v2_is_trust_operator(false));
DROP POLICY IF EXISTS cam_v2_student_statements_trust_admin ON mmc.cam_v2_student_statements;
CREATE POLICY cam_v2_student_statements_trust_admin ON mmc.cam_v2_student_statements FOR SELECT TO authenticated
  USING (mmc.cam_v2_same_scope(tenant_id, environment) AND mmc.cam_v2_is_trust_operator(false));
DROP POLICY IF EXISTS cam_v2_student_responses_trust_admin ON mmc.cam_v2_student_responses;
CREATE POLICY cam_v2_student_responses_trust_admin ON mmc.cam_v2_student_responses FOR SELECT TO authenticated
  USING (mmc.cam_v2_same_scope(tenant_id, environment) AND mmc.cam_v2_is_trust_operator(false));
DROP POLICY IF EXISTS cam_v2_source_assets_trust_admin ON mmc.cam_v2_source_assets;
CREATE POLICY cam_v2_source_assets_trust_admin ON mmc.cam_v2_source_assets FOR SELECT TO authenticated
  USING (mmc.cam_v2_same_scope(tenant_id, environment) AND mmc.cam_v2_is_trust_operator(false));
DROP POLICY IF EXISTS cam_v2_transcripts_trust_admin ON mmc.cam_v2_transcript_versions;
CREATE POLICY cam_v2_transcripts_trust_admin ON mmc.cam_v2_transcript_versions FOR SELECT TO authenticated
  USING (mmc.cam_v2_same_scope(tenant_id, environment) AND mmc.cam_v2_is_trust_operator(false));
DROP POLICY IF EXISTS cam_v2_job_inputs_trust_admin ON mmc.cam_v2_job_inputs;
CREATE POLICY cam_v2_job_inputs_trust_admin ON mmc.cam_v2_job_inputs FOR SELECT TO authenticated
  USING (mmc.cam_v2_same_scope(tenant_id, environment) AND mmc.cam_v2_is_trust_operator(false));
DROP POLICY IF EXISTS cam_v2_evidence_trust_admin ON mmc.cam_v2_evidence_spans;
CREATE POLICY cam_v2_evidence_trust_admin ON mmc.cam_v2_evidence_spans FOR SELECT TO authenticated
  USING (mmc.cam_v2_same_scope(tenant_id, environment) AND mmc.cam_v2_is_trust_operator(false));
DROP POLICY IF EXISTS cam_v2_analysis_trust_admin ON mmc.cam_v2_analysis_runs;
CREATE POLICY cam_v2_analysis_trust_admin ON mmc.cam_v2_analysis_runs FOR SELECT TO authenticated
  USING (mmc.cam_v2_same_scope(tenant_id, environment) AND mmc.cam_v2_is_trust_operator(false));
DROP POLICY IF EXISTS cam_v2_proposals_trust_admin ON mmc.cam_v2_ai_proposals;
CREATE POLICY cam_v2_proposals_trust_admin ON mmc.cam_v2_ai_proposals FOR SELECT TO authenticated
  USING (mmc.cam_v2_same_scope(tenant_id, environment) AND mmc.cam_v2_is_trust_operator(false));
DROP POLICY IF EXISTS cam_v2_reviews_trust_admin ON mmc.cam_v2_review_decisions;
CREATE POLICY cam_v2_reviews_trust_admin ON mmc.cam_v2_review_decisions FOR SELECT TO authenticated
  USING (mmc.cam_v2_same_scope(tenant_id, environment) AND mmc.cam_v2_is_trust_operator(false));
DROP POLICY IF EXISTS cam_v2_publications_trust_admin ON mmc.cam_v2_publications;
CREATE POLICY cam_v2_publications_trust_admin ON mmc.cam_v2_publications FOR SELECT TO authenticated
  USING (mmc.cam_v2_same_scope(tenant_id, environment) AND mmc.cam_v2_is_trust_operator(false));
DROP POLICY IF EXISTS cam_v2_publication_items_trust_admin ON mmc.cam_v2_publication_items;
CREATE POLICY cam_v2_publication_items_trust_admin ON mmc.cam_v2_publication_items FOR SELECT TO authenticated
  USING (mmc.cam_v2_same_scope(tenant_id, environment) AND mmc.cam_v2_is_trust_operator(false));
DROP POLICY IF EXISTS cam_v2_outbox_trust_admin ON mmc.cam_v2_outbox_events;
CREATE POLICY cam_v2_outbox_trust_admin ON mmc.cam_v2_outbox_events FOR SELECT TO authenticated
  USING (mmc.cam_v2_same_scope(tenant_id, environment) AND mmc.cam_v2_is_trust_operator(false));
DROP POLICY IF EXISTS cam_v2_consumer_effects_trust_admin ON mmc.cam_v2_consumer_effects;
CREATE POLICY cam_v2_consumer_effects_trust_admin ON mmc.cam_v2_consumer_effects FOR SELECT TO authenticated
  USING (mmc.cam_v2_same_scope(tenant_id, environment) AND mmc.cam_v2_is_trust_operator(false));
DROP POLICY IF EXISTS cam_v2_inbox_trust_admin ON mmc.cam_v2_consumer_inbox;
CREATE POLICY cam_v2_inbox_trust_admin ON mmc.cam_v2_consumer_inbox FOR SELECT TO authenticated
  USING (mmc.cam_v2_same_scope(tenant_id, environment) AND mmc.cam_v2_is_trust_operator(false));
DROP POLICY IF EXISTS cam_v2_lineage_trust_admin ON mmc.cam_v2_lineage_edges;
CREATE POLICY cam_v2_lineage_trust_admin ON mmc.cam_v2_lineage_edges FOR SELECT TO authenticated
  USING (mmc.cam_v2_same_scope(tenant_id, environment) AND mmc.cam_v2_is_trust_operator(false));
DROP POLICY IF EXISTS cam_v2_audit_trust_admin ON mmc.cam_v2_audit_events;
CREATE POLICY cam_v2_audit_trust_admin ON mmc.cam_v2_audit_events FOR SELECT TO authenticated
  USING (mmc.cam_v2_same_scope(tenant_id, environment) AND mmc.cam_v2_is_trust_operator(false));
DROP POLICY IF EXISTS cam_v2_cutover_trust_admin ON mmc.cam_v2_cutover_states;
CREATE POLICY cam_v2_cutover_trust_admin ON mmc.cam_v2_cutover_states FOR SELECT TO authenticated
  USING (mmc.cam_v2_same_scope(tenant_id, environment) AND mmc.cam_v2_is_trust_admin());

-- Principal, subject, and assignment discovery is exact and non-transitive.
DROP POLICY IF EXISTS cam_v2_principals_self_read ON mmc.cam_v2_principals;
CREATE POLICY cam_v2_principals_self_read ON mmc.cam_v2_principals FOR SELECT TO authenticated
  USING (mmc.cam_v2_same_scope(tenant_id, environment) AND id = mmc.cam_v2_current_principal_id() AND status = 'ACTIVE');

DROP POLICY IF EXISTS cam_v2_subject_links_exact_student_read ON mmc.cam_v2_subject_links;
CREATE POLICY cam_v2_subject_links_exact_student_read ON mmc.cam_v2_subject_links FOR SELECT TO authenticated
  USING (
    mmc.cam_v2_same_scope(tenant_id, environment)
    AND mmc.cam_v2_current_principal_kind() = 'STUDENT'
    AND id = mmc.cam_v2_current_subject_link_id()
    AND student_principal_id = mmc.cam_v2_current_principal_id()
    AND identity_state = 'VERIFIED_LOCAL_LINK' AND revoked_at IS NULL
  );
DROP POLICY IF EXISTS cam_v2_subject_links_assigned_mentor_read ON mmc.cam_v2_subject_links;
CREATE POLICY cam_v2_subject_links_assigned_mentor_read ON mmc.cam_v2_subject_links FOR SELECT TO authenticated
  USING (
    mmc.cam_v2_same_scope(tenant_id, environment)
    AND mmc.cam_v2_current_principal_kind() = 'MENTOR'
    AND mmc.cam_v2_has_capability('mmc.mentor.read')
    AND identity_state = 'VERIFIED_LOCAL_LINK'
    AND revoked_at IS NULL
    AND EXISTS (
      SELECT 1 FROM mmc.cam_v2_assignments AS assignment
      WHERE assignment.tenant_id = cam_v2_subject_links.tenant_id
        AND assignment.environment = cam_v2_subject_links.environment
        AND assignment.subject_link_id = cam_v2_subject_links.id
        AND mmc.cam_v2_mentor_can_access(
          assignment.id, assignment.subject_link_id, 'mmc.mentor.read'
        )
    )
  );

DROP POLICY IF EXISTS cam_v2_assignments_exact_mentor_read ON mmc.cam_v2_assignments;
CREATE POLICY cam_v2_assignments_exact_mentor_read ON mmc.cam_v2_assignments FOR SELECT TO authenticated
  USING (
    mmc.cam_v2_same_scope(tenant_id, environment)
    AND mmc.cam_v2_mentor_can_access(id, subject_link_id, 'mmc.mentor.read')
  );

-- A workload can see claimable rows or its exact currently fenced lease. Direct
-- job UPDATE privilege is not granted; transitions are only through RPCs below.
DROP POLICY IF EXISTS cam_v2_jobs_worker_read ON mmc.cam_v2_jobs;
CREATE POLICY cam_v2_jobs_worker_read ON mmc.cam_v2_jobs FOR SELECT TO authenticated
  USING (
    mmc.cam_v2_same_scope(tenant_id, environment)
    AND mmc.cam_v2_actor_is_active('WORKLOAD')
    AND queue_name = mmc.cam_v2_current_queue_name()
    AND mmc.cam_v2_job_authority_is_active(id)
    AND mmc.cam_v2_plane_is_enabled(mmc.cam_v2_job_plane(job_kind))
    AND mmc.cam_v2_has_capability(mmc.cam_v2_job_execution_capability(job_kind))
    AND (
      (
        mmc.cam_v2_has_capability('mmc.worker.claim')
        AND available_at <= statement_timestamp() AND attempt_count < max_attempts
        AND (
          status IN ('QUEUED', 'RETRY_SCHEDULED')
          OR (
            status IN ('LEASED', 'RUNNING') AND lease_expires_at <= statement_timestamp()
            AND external_dispatch_generation IS NULL AND external_result_generation IS NULL
          )
        )
      )
      OR (
        id = mmc.cam_v2_current_job_id()
        AND lease_owner_principal_id = mmc.cam_v2_current_principal_id()
        AND lease_generation = mmc.cam_v2_current_lease_generation()
        AND lease_expires_at > statement_timestamp()
        AND status IN ('LEASED', 'RUNNING', 'SUCCEEDED', 'FAILED')
        AND (
          mmc.cam_v2_has_capability('mmc.worker.lease')
          OR mmc.cam_v2_has_capability('mmc.worker.heartbeat')
          OR mmc.cam_v2_has_capability('mmc.worker.complete')
        )
      )
    )
  );

DROP POLICY IF EXISTS cam_v2_jobs_worker_transition ON mmc.cam_v2_jobs;
-- No authenticated principal receives a direct job-transition policy. All job
-- mutations are fenced inside the narrow SECURITY DEFINER RPCs below.

-- Canonical mentor objects require the exact current assignment for both old
-- and new rows. No student policy exposes mentor-owned canonical tables.
DROP POLICY IF EXISTS cam_v2_sessions_mentor_read ON mmc.cam_v2_sessions;
CREATE POLICY cam_v2_sessions_mentor_read ON mmc.cam_v2_sessions FOR SELECT TO authenticated
  USING (mmc.cam_v2_same_scope(tenant_id, environment) AND mmc.cam_v2_mentor_can_access(assignment_id, subject_link_id, 'mmc.mentor.read'));
DROP POLICY IF EXISTS cam_v2_sessions_mentor_write ON mmc.cam_v2_sessions;

DROP POLICY IF EXISTS cam_v2_tasks_mentor_read ON mmc.cam_v2_tasks;
CREATE POLICY cam_v2_tasks_mentor_read ON mmc.cam_v2_tasks FOR SELECT TO authenticated
  USING (mmc.cam_v2_same_scope(tenant_id, environment) AND mmc.cam_v2_mentor_can_access(assignment_id, subject_link_id, 'mmc.mentor.read'));
DROP POLICY IF EXISTS cam_v2_tasks_mentor_write ON mmc.cam_v2_tasks;

DROP POLICY IF EXISTS cam_v2_commitments_mentor_read ON mmc.cam_v2_commitments;
CREATE POLICY cam_v2_commitments_mentor_read ON mmc.cam_v2_commitments FOR SELECT TO authenticated
  USING (mmc.cam_v2_same_scope(tenant_id, environment) AND mmc.cam_v2_mentor_can_access(assignment_id, subject_link_id, 'mmc.mentor.read'));
DROP POLICY IF EXISTS cam_v2_commitments_mentor_write ON mmc.cam_v2_commitments;

DROP POLICY IF EXISTS cam_v2_goals_mentor_read ON mmc.cam_v2_goals;
CREATE POLICY cam_v2_goals_mentor_read ON mmc.cam_v2_goals FOR SELECT TO authenticated
  USING (mmc.cam_v2_same_scope(tenant_id, environment) AND mmc.cam_v2_mentor_can_access(assignment_id, subject_link_id, 'mmc.mentor.read'));
DROP POLICY IF EXISTS cam_v2_goals_mentor_write ON mmc.cam_v2_goals;

DROP POLICY IF EXISTS cam_v2_milestones_mentor_read ON mmc.cam_v2_milestones;
CREATE POLICY cam_v2_milestones_mentor_read ON mmc.cam_v2_milestones FOR SELECT TO authenticated
  USING (mmc.cam_v2_same_scope(tenant_id, environment) AND mmc.cam_v2_mentor_can_access(assignment_id, subject_link_id, 'mmc.mentor.read'));
DROP POLICY IF EXISTS cam_v2_milestones_mentor_write ON mmc.cam_v2_milestones;

-- Student-authored objects are exact-subject and use distinct capabilities.
DROP POLICY IF EXISTS cam_v2_student_statements_exact_read ON mmc.cam_v2_student_statements;
CREATE POLICY cam_v2_student_statements_exact_read ON mmc.cam_v2_student_statements FOR SELECT TO authenticated
  USING (mmc.cam_v2_same_scope(tenant_id, environment) AND mmc.cam_v2_student_owns_subject(subject_link_id)
    AND author_principal_id = mmc.cam_v2_current_principal_id() AND mmc.cam_v2_has_capability('mmc.student.self_author'));
DROP POLICY IF EXISTS cam_v2_student_statements_exact_insert ON mmc.cam_v2_student_statements;
DROP POLICY IF EXISTS cam_v2_student_statements_exact_update ON mmc.cam_v2_student_statements;

DROP POLICY IF EXISTS cam_v2_student_responses_exact_read ON mmc.cam_v2_student_responses;
CREATE POLICY cam_v2_student_responses_exact_read ON mmc.cam_v2_student_responses FOR SELECT TO authenticated
  USING (mmc.cam_v2_same_scope(tenant_id, environment) AND mmc.cam_v2_student_owns_subject(subject_link_id)
    AND author_principal_id = mmc.cam_v2_current_principal_id() AND mmc.cam_v2_has_capability('mmc.student.respond'));
DROP POLICY IF EXISTS cam_v2_student_responses_exact_insert ON mmc.cam_v2_student_responses;
DROP POLICY IF EXISTS cam_v2_student_responses_exact_update ON mmc.cam_v2_student_responses;

-- Assigned mentors may read, but never rewrite, student-authored records.
DROP POLICY IF EXISTS cam_v2_student_statements_mentor_read ON mmc.cam_v2_student_statements;
CREATE POLICY cam_v2_student_statements_mentor_read ON mmc.cam_v2_student_statements FOR SELECT TO authenticated
  USING (mmc.cam_v2_same_scope(tenant_id, environment) AND EXISTS (
    SELECT 1 FROM mmc.cam_v2_assignments AS assignment
    WHERE assignment.tenant_id = cam_v2_student_statements.tenant_id
      AND assignment.environment = cam_v2_student_statements.environment
      AND assignment.subject_link_id = cam_v2_student_statements.subject_link_id
      AND mmc.cam_v2_mentor_can_access(assignment.id, assignment.subject_link_id, 'mmc.mentor.read')
  ));
DROP POLICY IF EXISTS cam_v2_student_responses_mentor_read ON mmc.cam_v2_student_responses;
CREATE POLICY cam_v2_student_responses_mentor_read ON mmc.cam_v2_student_responses FOR SELECT TO authenticated
  USING (mmc.cam_v2_same_scope(tenant_id, environment) AND EXISTS (
    SELECT 1 FROM mmc.cam_v2_assignments AS assignment
    WHERE assignment.tenant_id = cam_v2_student_responses.tenant_id
      AND assignment.environment = cam_v2_student_responses.environment
      AND assignment.subject_link_id = cam_v2_student_responses.subject_link_id
      AND mmc.cam_v2_mentor_can_access(assignment.id, assignment.subject_link_id, 'mmc.mentor.read')
  ));

-- Workload data access is tied to the exact signed job and current database
-- lease generation; stale tokens fail both USING and WITH CHECK.
DROP POLICY IF EXISTS cam_v2_source_assets_worker ON mmc.cam_v2_source_assets;
CREATE POLICY cam_v2_source_assets_worker ON mmc.cam_v2_source_assets FOR SELECT TO authenticated
  USING (mmc.cam_v2_same_scope(tenant_id, environment)
    AND asset_state IN ('PAIR_VERIFIED', 'ATTACHED', 'RETAINED')
    AND mmc.cam_v2_worker_can_read_input(
      job_id, 'SOURCE_ASSET', id, authority_grant_id, assignment_id, subject_link_id,
      'mmc.worker.asset_process'
    ));
DROP POLICY IF EXISTS cam_v2_transcripts_worker ON mmc.cam_v2_transcript_versions;
CREATE POLICY cam_v2_transcripts_worker ON mmc.cam_v2_transcript_versions FOR SELECT TO authenticated
  USING (mmc.cam_v2_same_scope(tenant_id, environment)
    AND transcript_state = 'VERIFIED'
    AND (
      mmc.cam_v2_worker_can_read_input(
        job_id, 'TRANSCRIPT_VERSION', id, authority_grant_id, assignment_id, subject_link_id,
        'mmc.worker.asset_process'
      )
      OR mmc.cam_v2_worker_can_read_input(
        job_id, 'TRANSCRIPT_VERSION', id, authority_grant_id, assignment_id, subject_link_id,
        'mmc.worker.analysis'
      )
    ));
DROP POLICY IF EXISTS cam_v2_job_inputs_exact_worker_read ON mmc.cam_v2_job_inputs;
CREATE POLICY cam_v2_job_inputs_exact_worker_read ON mmc.cam_v2_job_inputs FOR SELECT TO authenticated
  USING (mmc.cam_v2_same_scope(tenant_id, environment)
    AND consumer_job_id = mmc.cam_v2_current_job_id()
    AND EXISTS (
      SELECT 1 FROM mmc.cam_v2_jobs AS producer
      WHERE producer.tenant_id = cam_v2_job_inputs.tenant_id
        AND producer.environment = cam_v2_job_inputs.environment
        AND producer.id = cam_v2_job_inputs.producer_job_id
        AND producer.status = 'SUCCEEDED'
        AND producer.external_dispatch_generation = producer.lease_generation
        AND producer.external_result_generation = producer.lease_generation
        AND producer.external_outcome = 'SUCCEEDED'
        AND producer.external_result_digest = producer.result_digest
    )
    AND (
      mmc.cam_v2_worker_lease_matches(consumer_job_id, 'mmc.worker.asset_process')
      OR mmc.cam_v2_worker_lease_matches(consumer_job_id, 'mmc.worker.analysis')
    ));
DROP POLICY IF EXISTS cam_v2_evidence_worker ON mmc.cam_v2_evidence_spans;
CREATE POLICY cam_v2_evidence_worker ON mmc.cam_v2_evidence_spans FOR SELECT TO authenticated
  USING (mmc.cam_v2_same_scope(tenant_id, environment)
    AND mmc.cam_v2_worker_lease_matches(job_id, 'mmc.worker.analysis')
    AND mmc.cam_v2_worker_row_matches_job(job_id, assignment_id, subject_link_id));
DROP POLICY IF EXISTS cam_v2_analysis_worker ON mmc.cam_v2_analysis_runs;
CREATE POLICY cam_v2_analysis_worker ON mmc.cam_v2_analysis_runs FOR SELECT TO authenticated
  USING (mmc.cam_v2_same_scope(tenant_id, environment)
    AND mmc.cam_v2_worker_lease_matches(job_id, 'mmc.worker.analysis')
    AND mmc.cam_v2_worker_row_matches_job(job_id, assignment_id, subject_link_id));
DROP POLICY IF EXISTS cam_v2_proposals_worker ON mmc.cam_v2_ai_proposals;
CREATE POLICY cam_v2_proposals_worker ON mmc.cam_v2_ai_proposals FOR SELECT TO authenticated
  USING (mmc.cam_v2_same_scope(tenant_id, environment)
    AND mmc.cam_v2_worker_lease_matches(job_id, 'mmc.worker.analysis')
    AND mmc.cam_v2_worker_row_matches_job(job_id, assignment_id, subject_link_id));

-- Assigned mentors can inspect evidence/proposals and append immutable item-level
-- review decisions. AI/workload principals receive no canonical promotion policy.
DROP POLICY IF EXISTS cam_v2_evidence_mentor_read ON mmc.cam_v2_evidence_spans;
CREATE POLICY cam_v2_evidence_mentor_read ON mmc.cam_v2_evidence_spans FOR SELECT TO authenticated
  USING (assignment_id IS NOT NULL AND mmc.cam_v2_same_scope(tenant_id, environment)
    AND mmc.cam_v2_mentor_can_access(assignment_id, subject_link_id, 'mmc.mentor.read'));
DROP POLICY IF EXISTS cam_v2_analysis_mentor_read ON mmc.cam_v2_analysis_runs;
CREATE POLICY cam_v2_analysis_mentor_read ON mmc.cam_v2_analysis_runs FOR SELECT TO authenticated
  USING (mmc.cam_v2_same_scope(tenant_id, environment)
    AND mmc.cam_v2_mentor_can_access(assignment_id, subject_link_id, 'mmc.mentor.read'));
DROP POLICY IF EXISTS cam_v2_proposals_mentor_read ON mmc.cam_v2_ai_proposals;
CREATE POLICY cam_v2_proposals_mentor_read ON mmc.cam_v2_ai_proposals FOR SELECT TO authenticated
  USING (mmc.cam_v2_same_scope(tenant_id, environment)
    AND mmc.cam_v2_mentor_can_access(assignment_id, subject_link_id, 'mmc.mentor.review'));
DROP POLICY IF EXISTS cam_v2_reviews_mentor_read ON mmc.cam_v2_review_decisions;
CREATE POLICY cam_v2_reviews_mentor_read ON mmc.cam_v2_review_decisions FOR SELECT TO authenticated
  USING (mmc.cam_v2_same_scope(tenant_id, environment)
    AND mmc.cam_v2_mentor_can_access(assignment_id, subject_link_id, 'mmc.mentor.review'));
DROP POLICY IF EXISTS cam_v2_reviews_mentor_insert ON mmc.cam_v2_review_decisions;

-- Command replay records remain principal-bound. Result bodies are represented
-- only by digests; gateways must reauthorize and refetch policy-filtered data.
DROP POLICY IF EXISTS cam_v2_command_receipts_principal ON mmc.cam_v2_command_receipts;
CREATE POLICY cam_v2_command_receipts_principal ON mmc.cam_v2_command_receipts FOR SELECT TO authenticated
  USING (mmc.cam_v2_same_scope(tenant_id, environment) AND principal_id = mmc.cam_v2_current_principal_id()
    AND mmc.cam_v2_has_capability('mmc.command.execute'));
DROP POLICY IF EXISTS cam_v2_idempotency_principal ON mmc.cam_v2_idempotency_records;
CREATE POLICY cam_v2_idempotency_principal ON mmc.cam_v2_idempotency_records FOR SELECT TO authenticated
  USING (mmc.cam_v2_same_scope(tenant_id, environment) AND principal_id = mmc.cam_v2_current_principal_id()
    AND mmc.cam_v2_has_capability('mmc.command.execute'));

-- Publication authoring still requires the exact current mentor assignment.
-- Exact-student reads deliberately do not borrow that assignment after publish.
DROP POLICY IF EXISTS cam_v2_publications_mentor_read ON mmc.cam_v2_publications;
CREATE POLICY cam_v2_publications_mentor_read ON mmc.cam_v2_publications FOR SELECT TO authenticated
  USING (mmc.cam_v2_same_scope(tenant_id, environment)
    AND mmc.cam_v2_mentor_can_access(authoring_assignment_id, subject_link_id, 'mmc.mentor.read'));
DROP POLICY IF EXISTS cam_v2_publications_mentor_write ON mmc.cam_v2_publications;
DROP POLICY IF EXISTS cam_v2_publication_items_mentor_read ON mmc.cam_v2_publication_items;
CREATE POLICY cam_v2_publication_items_mentor_read ON mmc.cam_v2_publication_items FOR SELECT TO authenticated
  USING (mmc.cam_v2_same_scope(tenant_id, environment) AND EXISTS (
    SELECT 1 FROM mmc.cam_v2_publications AS publication
    WHERE publication.tenant_id = cam_v2_publication_items.tenant_id
      AND publication.environment = cam_v2_publication_items.environment
      AND publication.id = cam_v2_publication_items.publication_id
      AND mmc.cam_v2_mentor_can_access(publication.authoring_assignment_id, publication.subject_link_id, 'mmc.mentor.read')
  ));
DROP POLICY IF EXISTS cam_v2_publication_items_mentor_write ON mmc.cam_v2_publication_items;

DROP POLICY IF EXISTS cam_v2_publications_exact_student_read ON mmc.cam_v2_publications;
CREATE POLICY cam_v2_publications_exact_student_read ON mmc.cam_v2_publications FOR SELECT TO authenticated
  USING (
    mmc.cam_v2_same_scope(tenant_id, environment)
    AND mmc.cam_v2_plane_is_enabled('student_publication')
    AND mmc.cam_v2_has_capability('mmc.student.publication_read')
    AND mmc.cam_v2_student_owns_subject(subject_link_id)
    AND publication_state IN ('PUBLISHED', 'ACKNOWLEDGED', 'CORRECTED')
    AND published_at IS NOT NULL AND (expires_at IS NULL OR expires_at > statement_timestamp()) AND withdrawn_at IS NULL
  );
DROP POLICY IF EXISTS cam_v2_publication_items_exact_student_read ON mmc.cam_v2_publication_items;
CREATE POLICY cam_v2_publication_items_exact_student_read ON mmc.cam_v2_publication_items FOR SELECT TO authenticated
  USING (
    mmc.cam_v2_same_scope(tenant_id, environment)
    AND mmc.cam_v2_plane_is_enabled('student_publication')
    AND mmc.cam_v2_has_capability('mmc.student.publication_read')
    AND mmc.cam_v2_student_owns_subject(subject_link_id)
    AND item_state = 'PUBLISHED'
    AND EXISTS (
      SELECT 1 FROM mmc.cam_v2_publications AS publication
      WHERE publication.tenant_id = cam_v2_publication_items.tenant_id
        AND publication.environment = cam_v2_publication_items.environment
        AND publication.id = cam_v2_publication_items.publication_id
        AND publication.subject_link_id = cam_v2_publication_items.subject_link_id
        AND publication.publication_state IN ('PUBLISHED', 'ACKNOWLEDGED', 'CORRECTED')
        AND publication.published_at IS NOT NULL
        AND (publication.expires_at IS NULL OR publication.expires_at > statement_timestamp())
        AND publication.withdrawn_at IS NULL
    )
  );

-- Outbox delivery remains restart-safe after producer completion. Visibility is
-- bound to the independently fenced dispatcher lease, not the producer lease.
DROP POLICY IF EXISTS cam_v2_outbox_exact_worker_read ON mmc.cam_v2_outbox_events;
CREATE POLICY cam_v2_outbox_exact_worker_read ON mmc.cam_v2_outbox_events FOR SELECT TO authenticated
  USING (mmc.cam_v2_same_scope(tenant_id, environment)
    AND mmc.cam_v2_outbox_lease_matches(id, 'mmc.worker.outbox_dispatch'));
DROP POLICY IF EXISTS cam_v2_consumer_effects_exact_worker ON mmc.cam_v2_consumer_effects;
CREATE POLICY cam_v2_consumer_effects_exact_worker ON mmc.cam_v2_consumer_effects FOR SELECT TO authenticated
  USING (mmc.cam_v2_same_scope(tenant_id, environment)
    AND mmc.cam_v2_outbox_lease_matches(outbox_event_id, 'mmc.worker.inbox'));
DROP POLICY IF EXISTS cam_v2_inbox_exact_worker ON mmc.cam_v2_consumer_inbox;
CREATE POLICY cam_v2_inbox_exact_worker ON mmc.cam_v2_consumer_inbox FOR SELECT TO authenticated
  USING (mmc.cam_v2_same_scope(tenant_id, environment)
    AND mmc.cam_v2_outbox_lease_matches(outbox_event_id, 'mmc.worker.inbox'));

DROP POLICY IF EXISTS cam_v2_audit_exact_mentor_read ON mmc.cam_v2_audit_events;
CREATE POLICY cam_v2_audit_exact_mentor_read ON mmc.cam_v2_audit_events FOR SELECT TO authenticated
  USING (assignment_id IS NOT NULL AND subject_link_id IS NOT NULL
    AND mmc.cam_v2_same_scope(tenant_id, environment)
    AND mmc.cam_v2_mentor_can_access(assignment_id, subject_link_id, 'mmc.mentor.audit_read'));

-- ---------------------------------------------------------------------------
-- Narrow fenced-worker RPCs. Each derives scope/worker from signed claims,
-- validates bounded arguments, uses a fixed path, and contains no dynamic SQL.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION mmc.cam_v2_claim_job(p_queue_name text, p_lease_seconds integer)
RETURNS TABLE (
  job_id uuid,
  lease_generation bigint,
  lease_expires_at timestamptz,
  job_kind text,
  operation_ref text,
  payload_digest text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, mmc
SET row_security = on
AS $$
BEGIN
  IF mmc.cam_v2_current_principal_kind() <> 'WORKLOAD'
     OR NOT mmc.cam_v2_actor_is_active('WORKLOAD')
     OR NOT mmc.cam_v2_has_capability('mmc.worker.claim')
     OR mmc.cam_v2_current_tenant_id() IS NULL
     OR mmc.cam_v2_current_principal_id() IS NULL
     OR mmc.cam_v2_current_environment() NOT IN ('FIXTURE', 'LOCAL', 'STAGING', 'LIVE')
     OR NOT EXISTS (
       SELECT 1 FROM mmc.cam_v2_principals AS principal
       WHERE principal.tenant_id = mmc.cam_v2_current_tenant_id()
         AND principal.environment = mmc.cam_v2_current_environment()
         AND principal.id = mmc.cam_v2_current_principal_id()
         AND principal.principal_kind = 'WORKLOAD' AND principal.status = 'ACTIVE'
     ) THEN
    RAISE EXCEPTION 'worker claim authority denied' USING ERRCODE = '42501';
  END IF;
  IF p_queue_name IS NULL OR p_queue_name !~ '^[a-z0-9][a-z0-9._-]{0,63}$' THEN
    RAISE EXCEPTION 'invalid queue name' USING ERRCODE = '22023';
  END IF;
  IF p_queue_name IS DISTINCT FROM mmc.cam_v2_current_queue_name() THEN
    RAISE EXCEPTION 'worker queue claim mismatch' USING ERRCODE = '42501';
  END IF;
  IF p_lease_seconds IS NULL OR p_lease_seconds < 15 OR p_lease_seconds > 300 THEN
    RAISE EXCEPTION 'lease duration outside 15..300 seconds' USING ERRCODE = '22023';
  END IF;

  -- Lock the tenant audit chain before taking any durable object lock. Every
  -- RPC that can fire a runtime-audit trigger follows this global order so a
  -- concurrent job/outbox transition cannot deadlock on the audit serializer.
  PERFORM mmc.cam_v2_lock_audit_chain(
    mmc.cam_v2_current_tenant_id(), mmc.cam_v2_current_environment()
  );

  RETURN QUERY
  WITH candidate_pool AS MATERIALIZED (
    SELECT queued.tenant_id, queued.environment, queued.id, queued.object_version,
           queued.available_at, queued.created_at
    FROM mmc.cam_v2_jobs AS queued
    WHERE queued.tenant_id = mmc.cam_v2_current_tenant_id()
      AND queued.environment = mmc.cam_v2_current_environment()
      AND queued.queue_name = p_queue_name
      AND queued.available_at <= clock_timestamp()
      AND queued.attempt_count < queued.max_attempts
      -- Only stages with a reviewed typed success attestation are claimable.
      AND queued.job_kind IN ('ASSET_ACQUISITION', 'TRANSCRIPT_PROCESSING', 'AI_ANALYSIS')
      AND mmc.cam_v2_job_authority_is_active(queued.id)
      AND mmc.cam_v2_plane_is_enabled(mmc.cam_v2_job_plane(queued.job_kind))
      AND mmc.cam_v2_job_inputs_potentially_ready(queued.id)
      AND (
        queued.status IN ('QUEUED', 'RETRY_SCHEDULED')
        OR (
          queued.status IN ('LEASED', 'RUNNING')
          AND queued.lease_expires_at <= clock_timestamp()
          AND queued.external_dispatch_generation IS NULL
          AND queued.external_result_generation IS NULL
        )
      )
    ORDER BY queued.available_at, queued.created_at, queued.id
    FOR UPDATE OF queued SKIP LOCKED
    LIMIT 32
  ), authority_ready AS MATERIALIZED (
    SELECT pool.*
    FROM candidate_pool AS pool
    WHERE mmc.cam_v2_lock_job_mutation_authority(
      pool.id, 'mmc.worker.lease', 'CLAIM'
    ) = pool.object_version
  ), digest_ready AS MATERIALIZED (
    SELECT ready.*, mmc.cam_v2_lock_ready_job_input_digest(ready.id) AS frozen_input_digest
    FROM authority_ready AS ready
  ), candidate AS MATERIALIZED (
    SELECT ready.*
    FROM digest_ready AS ready
    WHERE ready.frozen_input_digest IS NOT NULL
    ORDER BY ready.available_at, ready.created_at, ready.id
    LIMIT 1
  )
  UPDATE mmc.cam_v2_jobs AS claimed
  SET status = 'LEASED',
      attempt_count = claimed.attempt_count + 1,
      lease_owner_principal_id = mmc.cam_v2_current_principal_id(),
      lease_generation = claimed.lease_generation + 1,
      lease_expires_at = clock_timestamp() + make_interval(secs => p_lease_seconds),
      input_set_digest = candidate.frozen_input_digest,
      input_set_frozen_at = coalesce(claimed.input_set_frozen_at, clock_timestamp()),
      error_class = NULL,
      completed_at = NULL,
      completed_by_principal_id = NULL,
      completed_lease_generation = NULL,
      completion_disposition = NULL,
      completion_result_digest = NULL,
      completion_retry_delay_seconds = NULL,
      object_version = claimed.object_version + 1,
      updated_at = clock_timestamp()
  FROM candidate
  WHERE claimed.tenant_id = candidate.tenant_id
    AND claimed.environment = candidate.environment
    AND claimed.id = candidate.id
    AND candidate.frozen_input_digest IS NOT NULL
    AND (claimed.input_set_digest IS NULL OR claimed.input_set_digest = candidate.frozen_input_digest)
    AND claimed.object_version = candidate.object_version
    AND mmc.cam_v2_lock_job_mutation_authority(
      claimed.id, 'mmc.worker.lease', 'CLAIM'
    ) = candidate.object_version
  RETURNING claimed.id, claimed.lease_generation, claimed.lease_expires_at,
            claimed.job_kind, claimed.operation_ref, claimed.payload_digest;
END;
$$;

CREATE OR REPLACE FUNCTION mmc.cam_v2_heartbeat_job(
  p_job_id uuid, p_lease_generation bigint, p_extend_seconds integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, mmc
SET row_security = on
AS $$
DECLARE
  v_updated integer;
  v_expected_version bigint;
BEGIN
  IF p_job_id IS DISTINCT FROM mmc.cam_v2_current_job_id()
     OR p_lease_generation IS DISTINCT FROM mmc.cam_v2_current_lease_generation()
     OR NOT mmc.cam_v2_has_capability('mmc.worker.heartbeat')
     THEN
    RAISE EXCEPTION 'worker heartbeat authority denied' USING ERRCODE = '42501';
  END IF;
  IF p_extend_seconds IS NULL OR p_extend_seconds < 15 OR p_extend_seconds > 300 THEN
    RAISE EXCEPTION 'heartbeat duration outside 15..300 seconds' USING ERRCODE = '22023';
  END IF;

  PERFORM mmc.cam_v2_lock_audit_chain(
    mmc.cam_v2_current_tenant_id(), mmc.cam_v2_current_environment()
  );

  v_expected_version := mmc.cam_v2_lock_job_mutation_authority(
    p_job_id, 'mmc.worker.heartbeat', 'CURRENT_LEASE'
  );
  IF v_expected_version IS NULL THEN
    RAISE EXCEPTION 'worker heartbeat authority denied' USING ERRCODE = '42501';
  END IF;

  UPDATE mmc.cam_v2_jobs AS job
  SET status = 'RUNNING',
      lease_expires_at = greatest(
        job.lease_expires_at,
        clock_timestamp() + make_interval(secs => p_extend_seconds)
      ),
      object_version = job.object_version + 1,
      updated_at = clock_timestamp()
  WHERE job.tenant_id = mmc.cam_v2_current_tenant_id()
    AND job.environment = mmc.cam_v2_current_environment()
    AND job.id = p_job_id
    AND job.lease_owner_principal_id = mmc.cam_v2_current_principal_id()
    AND job.lease_generation = p_lease_generation
    AND job.lease_expires_at > clock_timestamp()
    AND job.status IN ('LEASED', 'RUNNING')
    AND job.object_version = v_expected_version
    AND mmc.cam_v2_lock_job_mutation_authority(
      job.id, 'mmc.worker.heartbeat', 'CURRENT_LEASE'
    ) = v_expected_version;
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated = 1;
END;
$$;

CREATE OR REPLACE FUNCTION mmc.cam_v2_record_external_dispatch_intent(
  p_job_id uuid,
  p_lease_generation bigint,
  p_dispatch_intent_digest text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, mmc
SET row_security = on
AS $$
DECLARE
  v_expected_version bigint;
  v_existing mmc.cam_v2_jobs%ROWTYPE;
  v_updated integer;
BEGIN
  IF p_job_id IS DISTINCT FROM mmc.cam_v2_current_job_id()
     OR p_lease_generation IS DISTINCT FROM mmc.cam_v2_current_lease_generation()
     OR p_dispatch_intent_digest IS NULL
     OR p_dispatch_intent_digest !~ '^[a-f0-9]{64}$'
     OR NOT mmc.cam_v2_has_capability('mmc.worker.complete') THEN
    RAISE EXCEPTION 'external dispatch intent input or authority denied' USING ERRCODE = '42501';
  END IF;
  PERFORM mmc.cam_v2_lock_audit_chain(
    mmc.cam_v2_current_tenant_id(), mmc.cam_v2_current_environment()
  );
  v_expected_version := mmc.cam_v2_lock_job_mutation_authority(
    p_job_id, 'mmc.worker.complete', 'CURRENT_LEASE'
  );
  IF v_expected_version IS NULL THEN
    RAISE EXCEPTION 'external dispatch intent lease authority denied' USING ERRCODE = '42501';
  END IF;
  SELECT job.* INTO v_existing
  FROM mmc.cam_v2_jobs AS job
  WHERE job.tenant_id = mmc.cam_v2_current_tenant_id()
    AND job.environment = mmc.cam_v2_current_environment()
    AND job.id = p_job_id
  FOR UPDATE;
  IF v_existing.external_dispatch_generation IS NOT NULL THEN
    IF v_existing.external_dispatch_generation = p_lease_generation
       AND v_existing.external_dispatch_intent_digest = p_dispatch_intent_digest
       AND v_existing.external_dispatch_idempotency_key_digest
         IS NOT DISTINCT FROM v_existing.provider_idempotency_key_digest THEN
      RETURN false;
    END IF;
    RAISE EXCEPTION 'external dispatch intent is immutable for this generation' USING ERRCODE = '23505';
  END IF;
  UPDATE mmc.cam_v2_jobs AS job
  SET external_dispatch_generation = p_lease_generation,
      external_dispatch_intent_digest = p_dispatch_intent_digest,
      external_dispatch_idempotency_key_digest = job.provider_idempotency_key_digest,
      external_dispatch_recorded_at = clock_timestamp(),
      object_version = job.object_version + 1,
      updated_at = clock_timestamp()
  WHERE job.tenant_id = mmc.cam_v2_current_tenant_id()
    AND job.environment = mmc.cam_v2_current_environment()
    AND job.id = p_job_id
    AND job.lease_generation = p_lease_generation
    AND job.object_version = v_expected_version
    AND mmc.cam_v2_lock_job_mutation_authority(
      job.id, 'mmc.worker.complete', 'CURRENT_LEASE'
    ) = v_expected_version;
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated <> 1 THEN
    RAISE EXCEPTION 'external dispatch intent lost its version fence' USING ERRCODE = '40001';
  END IF;
  INSERT INTO mmc.cam_v2_outbox_events (
    tenant_id, environment, job_id, aggregate_kind, aggregate_id,
    aggregate_version, event_kind, payload_digest,
    external_provider_idempotency_key_digest
  ) VALUES (
    mmc.cam_v2_current_tenant_id(), mmc.cam_v2_current_environment(), p_job_id,
    'JOB_EXTERNAL_DISPATCH', p_job_id, p_lease_generation,
    'EXTERNAL_PROVIDER_DISPATCH_INTENT', p_dispatch_intent_digest,
    v_existing.provider_idempotency_key_digest
  );
  RETURN true;
END;
$$;

DROP FUNCTION IF EXISTS mmc.cam_v2_record_external_result(uuid, bigint, text, text, text, boolean);
CREATE OR REPLACE FUNCTION mmc.cam_v2_record_external_result(
  p_job_id uuid,
  p_lease_generation bigint,
  p_outcome text,
  p_result_digest text,
  p_provider_receipt_digest text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, mmc
SET row_security = on
AS $$
DECLARE
  v_expected_version bigint;
  v_existing mmc.cam_v2_jobs%ROWTYPE;
  v_updated integer;
  v_outcome text := upper(coalesce(p_outcome, ''));
  v_recorded_at timestamptz;
BEGIN
  IF p_job_id IS DISTINCT FROM mmc.cam_v2_current_job_id()
     OR p_lease_generation IS DISTINCT FROM mmc.cam_v2_current_lease_generation()
     OR v_outcome NOT IN ('SUCCEEDED', 'FAILED', 'OUTCOME_UNKNOWN')
     OR p_result_digest IS NULL OR p_result_digest !~ '^[a-f0-9]{64}$'
     OR (p_provider_receipt_digest IS NOT NULL
       AND p_provider_receipt_digest !~ '^[a-f0-9]{64}$')
     OR NOT mmc.cam_v2_has_capability('mmc.worker.complete') THEN
    RAISE EXCEPTION 'external result input or authority denied' USING ERRCODE = '42501';
  END IF;

  PERFORM mmc.cam_v2_lock_audit_chain(
    mmc.cam_v2_current_tenant_id(), mmc.cam_v2_current_environment()
  );

  v_expected_version := mmc.cam_v2_lock_job_mutation_authority(
    p_job_id, 'mmc.worker.complete', 'RESULT_EVIDENCE'
  );
  IF v_expected_version IS NULL THEN
    RAISE EXCEPTION 'external result lease authority denied' USING ERRCODE = '42501';
  END IF;

  SELECT job.* INTO v_existing
  FROM mmc.cam_v2_jobs AS job
  WHERE job.tenant_id = mmc.cam_v2_current_tenant_id()
    AND job.environment = mmc.cam_v2_current_environment()
    AND job.id = p_job_id
  FOR UPDATE;
  IF v_existing.external_dispatch_generation IS DISTINCT FROM p_lease_generation
     OR v_existing.external_dispatch_intent_digest IS NULL
     OR v_existing.external_dispatch_idempotency_key_digest
       IS DISTINCT FROM v_existing.provider_idempotency_key_digest THEN
    RAISE EXCEPTION 'generation-bound provider dispatch intent is required' USING ERRCODE = '23514';
  END IF;
  IF v_existing.external_result_generation IS NOT NULL THEN
    IF v_existing.external_result_generation = p_lease_generation
       AND v_existing.external_outcome = v_outcome
       AND v_existing.external_result_digest = p_result_digest
       AND v_existing.external_provider_receipt_digest IS NOT DISTINCT FROM p_provider_receipt_digest
       AND v_existing.external_provider_idempotency_proven
         IS NOT DISTINCT FROM (v_existing.provider_idempotency_mode = 'PROVEN') THEN
      RETURN false;
    END IF;
    RAISE EXCEPTION 'external result for this lease is immutable' USING ERRCODE = '23505';
  END IF;

  v_recorded_at := clock_timestamp();
  UPDATE mmc.cam_v2_jobs AS job
  SET external_result_generation = p_lease_generation,
      external_outcome = v_outcome,
      external_result_digest = p_result_digest,
      external_provider_receipt_digest = p_provider_receipt_digest,
      external_provider_idempotency_proven = (job.provider_idempotency_mode = 'PROVEN'),
      external_result_recorded_at = v_recorded_at,
      object_version = job.object_version + 1,
      updated_at = clock_timestamp()
  WHERE job.tenant_id = mmc.cam_v2_current_tenant_id()
    AND job.environment = mmc.cam_v2_current_environment()
    AND job.id = p_job_id
    AND job.lease_generation = p_lease_generation
    AND job.external_dispatch_generation = p_lease_generation
    AND job.object_version = v_expected_version
    AND mmc.cam_v2_lock_job_mutation_authority(
      job.id, 'mmc.worker.complete', 'RESULT_EVIDENCE'
    ) = v_expected_version;
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated <> 1 THEN
    RAISE EXCEPTION 'external result lease changed before persistence' USING ERRCODE = '40001';
  END IF;

  INSERT INTO mmc.cam_v2_outbox_events (
    tenant_id, environment, job_id, aggregate_kind, aggregate_id,
    aggregate_version, event_kind, payload_digest,
    external_lease_generation, external_outcome, external_result_digest,
    external_provider_receipt_digest, external_provider_idempotency_proven,
    external_provider_idempotency_key_digest, external_result_recorded_at,
    delivery_state
  ) VALUES (
    mmc.cam_v2_current_tenant_id(), mmc.cam_v2_current_environment(), p_job_id,
    'JOB_EXTERNAL_RESULT', p_job_id, p_lease_generation,
    'EXTERNAL_PROVIDER_' || v_outcome, p_result_digest,
    p_lease_generation, v_outcome, p_result_digest, p_provider_receipt_digest,
    (v_existing.provider_idempotency_mode = 'PROVEN'),
    v_existing.provider_idempotency_key_digest, v_recorded_at,
    'QUARANTINED'
  );
  RETURN true;
END;
$$;

DROP FUNCTION IF EXISTS mmc.cam_v2_terminal_reconciliation_replay(uuid, bigint, text, text, text);
CREATE OR REPLACE FUNCTION mmc.cam_v2_terminal_reconciliation_replay(
  p_job_id uuid, p_lease_generation bigint, p_operator_finding text,
  p_disposition text, p_retry_delay_seconds integer, p_resolution_digest text
)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, mmc
SET row_security = off
AS $$
DECLARE
  v_job mmc.cam_v2_jobs%ROWTYPE;
  v_finding text := upper(coalesce(p_operator_finding, ''));
  v_disposition text := upper(coalesce(p_disposition, ''));
  v_event_kind text := 'EXTERNAL_RECONCILED_' || v_finding || '_' || v_disposition;
  v_has_any boolean;
  v_has_exact boolean;
BEGIN
  IF mmc.cam_v2_current_principal_kind() NOT IN ('OPERATOR', 'ADMIN')
     OR NOT mmc.cam_v2_is_trust_operator(true) THEN
    RETURN NULL;
  END IF;
  SELECT job.* INTO v_job
  FROM mmc.cam_v2_jobs AS job
  WHERE job.tenant_id = mmc.cam_v2_current_tenant_id()
    AND job.environment = mmc.cam_v2_current_environment()
    AND job.id = p_job_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT EXISTS (
    SELECT 1 FROM mmc.cam_v2_outbox_events AS event
    WHERE event.tenant_id = v_job.tenant_id
      AND event.environment = v_job.environment
      AND event.job_id = v_job.id
      AND event.aggregate_kind = 'JOB_EXTERNAL_RESULT'
      AND event.aggregate_id = v_job.id
      AND event.aggregate_version = p_lease_generation
      AND left(event.event_kind, 20) = 'EXTERNAL_RECONCILED_'
  ), EXISTS (
    SELECT 1 FROM mmc.cam_v2_outbox_events AS event
    WHERE event.tenant_id = v_job.tenant_id
      AND event.environment = v_job.environment
      AND event.job_id = v_job.id
      AND event.aggregate_kind = 'JOB_EXTERNAL_RESULT'
      AND event.aggregate_id = v_job.id
      AND event.aggregate_version = p_lease_generation
      AND event.event_kind = v_event_kind
      AND event.payload_digest = p_resolution_digest
      AND event.external_lease_generation = p_lease_generation
      AND event.external_resolution = v_finding || ':' || v_disposition
      AND event.external_resolved_at IS NOT NULL
  ) INTO v_has_any, v_has_exact;
  IF NOT v_has_any THEN RETURN NULL; END IF;
  IF NOT v_has_exact THEN
    RAISE EXCEPTION 'terminal reconciliation replay changed immutable semantics'
      USING ERRCODE = '23505';
  END IF;
  IF v_job.completed_by_principal_id IS DISTINCT FROM mmc.cam_v2_current_principal_id()
     OR v_job.completed_lease_generation IS DISTINCT FROM p_lease_generation
     OR v_job.completion_disposition IS DISTINCT FROM v_disposition
     OR v_job.completion_retry_delay_seconds IS DISTINCT FROM
       (CASE WHEN v_disposition = 'RETRY' THEN p_retry_delay_seconds ELSE NULL END) THEN
    RAISE EXCEPTION 'terminal reconciliation replay changed operator or scheduling semantics'
      USING ERRCODE = '23505';
  END IF;
  IF v_disposition = 'RETRY'
     AND v_job.status = 'RETRY_SCHEDULED'
     AND v_job.lease_owner_principal_id IS NULL
     AND v_job.external_dispatch_generation IS NULL
     AND v_job.external_result_generation IS NULL THEN
    RETURN v_job.status;
  END IF;
  IF v_disposition IN ('SUCCEEDED', 'FAILED', 'DEAD_LETTER')
     AND v_job.status = v_disposition
     AND v_job.completed_by_principal_id = mmc.cam_v2_current_principal_id()
     AND v_job.completed_lease_generation = p_lease_generation
     AND v_job.completion_disposition = v_disposition THEN
    RETURN v_job.status;
  END IF;
  RAISE EXCEPTION 'reconciliation receipt exists without its exact durable job state'
    USING ERRCODE = '23505';
END;
$$;

CREATE OR REPLACE FUNCTION mmc.cam_v2_reconcile_expired_external_result(
  p_job_id uuid,
  p_lease_generation bigint,
  p_operator_finding text,
  p_disposition text,
  p_retry_delay_seconds integer,
  p_resolution_digest text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, mmc
SET row_security = on
AS $$
DECLARE
  v_expected_version bigint;
  v_job mmc.cam_v2_jobs%ROWTYPE;
  v_updated integer;
  v_disposition text := upper(coalesce(p_disposition, ''));
  v_finding text := upper(coalesce(p_operator_finding, ''));
  v_next_status text;
  v_lock_mode text;
  v_is_operator boolean := false;
  v_outcome text;
  v_result_digest text;
  v_receipt_digest text;
  v_idempotency_proven boolean;
  v_recorded_at timestamptz;
  v_resolved_at timestamptz;
  v_quarantine_updated integer;
BEGIN
  v_is_operator := mmc.cam_v2_current_principal_kind() IN ('OPERATOR', 'ADMIN')
    AND mmc.cam_v2_is_trust_operator(true);
  IF NOT v_is_operator
     OR v_finding NOT IN ('CONFIRMED_SENT_SUCCEEDED', 'CONFIRMED_SENT_FAILED', 'CONFIRMED_NOT_SENT', 'OUTCOME_UNKNOWN')
     OR v_disposition NOT IN ('SUCCEEDED', 'RETRY', 'FAILED', 'DEAD_LETTER')
     OR p_retry_delay_seconds IS NULL OR p_retry_delay_seconds < 0 OR p_retry_delay_seconds > 86400
     OR (v_disposition <> 'RETRY' AND p_retry_delay_seconds <> 0)
     OR p_resolution_digest IS NULL OR p_resolution_digest !~ '^[a-f0-9]{64}$'
     THEN
    RAISE EXCEPTION 'expired external result reconciliation input denied' USING ERRCODE = '42501';
  END IF;

  v_next_status := mmc.cam_v2_terminal_reconciliation_replay(
    p_job_id, p_lease_generation, v_finding, v_disposition,
    p_retry_delay_seconds, p_resolution_digest
  );
  IF v_next_status IS NOT NULL THEN RETURN v_next_status; END IF;

  PERFORM mmc.cam_v2_lock_audit_chain(
    mmc.cam_v2_current_tenant_id(), mmc.cam_v2_current_environment()
  );

  v_lock_mode := 'RECONCILE_RESULT';
  v_expected_version := mmc.cam_v2_lock_job_mutation_authority(
    p_job_id,
    'mmc.operator.trust_write',
    v_lock_mode
  );
  IF v_expected_version IS NULL THEN
    v_next_status := mmc.cam_v2_terminal_reconciliation_replay(
      p_job_id, p_lease_generation, v_finding, v_disposition,
      p_retry_delay_seconds, p_resolution_digest
    );
    IF v_next_status IS NOT NULL THEN RETURN v_next_status; END IF;
    RAISE EXCEPTION 'exact expired lease authority is required' USING ERRCODE = '42501';
  END IF;
  SELECT job.* INTO v_job
  FROM mmc.cam_v2_jobs AS job
  WHERE job.tenant_id = mmc.cam_v2_current_tenant_id()
    AND job.environment = mmc.cam_v2_current_environment()
    AND job.id = p_job_id
  FOR UPDATE;
  IF v_job.lease_generation IS DISTINCT FROM p_lease_generation
     OR v_job.external_dispatch_generation IS DISTINCT FROM p_lease_generation
     OR v_job.external_dispatch_intent_digest IS NULL THEN
    RAISE EXCEPTION 'exact generation-bound provider dispatch is required' USING ERRCODE = '23514';
  END IF;
  IF v_job.external_result_generation IS NULL THEN
    v_outcome := 'OUTCOME_UNKNOWN';
    v_result_digest := p_resolution_digest;
    v_receipt_digest := NULL;
    v_idempotency_proven := v_job.provider_idempotency_mode = 'PROVEN';
    v_recorded_at := clock_timestamp();
  ELSIF v_job.external_result_generation = p_lease_generation AND v_job.external_outcome IS NOT NULL THEN
    v_outcome := v_job.external_outcome;
    v_result_digest := v_job.external_result_digest;
    v_receipt_digest := v_job.external_provider_receipt_digest;
    v_idempotency_proven := v_job.external_provider_idempotency_proven;
    v_recorded_at := v_job.external_result_recorded_at;
  ELSE
    RAISE EXCEPTION 'provider result belongs to another generation' USING ERRCODE = '23514';
  END IF;
  IF (v_finding = 'CONFIRMED_SENT_SUCCEEDED' AND v_outcome <> 'SUCCEEDED')
     OR (v_finding = 'CONFIRMED_SENT_FAILED' AND v_outcome <> 'FAILED')
     OR (v_finding = 'CONFIRMED_NOT_SENT' AND v_job.external_result_generation IS NOT NULL)
     OR (v_finding = 'OUTCOME_UNKNOWN' AND v_job.external_result_generation IS NOT NULL
       AND v_job.external_outcome <> 'OUTCOME_UNKNOWN') THEN
    RAISE EXCEPTION 'operator finding contradicts immutable provider evidence'
      USING ERRCODE = '23514';
  END IF;
  IF (v_finding = 'CONFIRMED_SENT_SUCCEEDED' AND v_disposition <> 'SUCCEEDED')
     OR (v_finding = 'CONFIRMED_SENT_FAILED' AND v_disposition NOT IN ('FAILED', 'DEAD_LETTER'))
     OR (v_finding = 'CONFIRMED_NOT_SENT' AND v_disposition <> 'RETRY')
     OR (v_finding = 'OUTCOME_UNKNOWN' AND v_disposition NOT IN ('RETRY', 'DEAD_LETTER')) THEN
    RAISE EXCEPTION 'operator disposition does not match its evidence-backed finding'
      USING ERRCODE = '23514';
  END IF;
  IF v_outcome = 'SUCCEEDED' AND v_disposition <> 'SUCCEEDED' THEN
    RAISE EXCEPTION 'confirmed provider success must commit as succeeded' USING ERRCODE = '23514';
  END IF;
  IF v_disposition = 'SUCCEEDED' AND v_outcome <> 'SUCCEEDED' THEN
    RAISE EXCEPTION 'provider success is required for succeeded disposition' USING ERRCODE = '23514';
  END IF;
  IF v_outcome = 'OUTCOME_UNKNOWN'
     AND v_disposition IN ('SUCCEEDED', 'FAILED') THEN
    RAISE EXCEPTION 'unknown provider outcome requires retry or dead letter' USING ERRCODE = '23514';
  END IF;
  IF v_finding = 'OUTCOME_UNKNOWN' AND v_disposition = 'RETRY'
     AND v_idempotency_proven IS NOT TRUE THEN
    RAISE EXCEPTION 'unknown provider outcome cannot retry without provider idempotency proof'
      USING ERRCODE = '23514';
  END IF;
  IF v_disposition = 'RETRY' AND v_job.attempt_count >= v_job.max_attempts THEN
    RAISE EXCEPTION 'job exhausted its bounded attempts' USING ERRCODE = '23514';
  END IF;
  IF v_disposition IN ('SUCCEEDED', 'RETRY') AND (
    NOT mmc.cam_v2_job_durable_authority_is_active(v_job.id)
    OR NOT mmc.cam_v2_plane_is_enabled(mmc.cam_v2_job_plane(v_job.job_kind))
  ) THEN
    RAISE EXCEPTION 'current durable authority is required to promote or retry quarantined evidence'
      USING ERRCODE = '42501';
  END IF;
  IF v_disposition = 'SUCCEEDED' THEN
    PERFORM mmc.cam_v2_assert_exact_success_handoff(v_job.id, v_result_digest);
  END IF;

  v_next_status := CASE WHEN v_disposition = 'RETRY' THEN 'RETRY_SCHEDULED' ELSE v_disposition END;
  UPDATE mmc.cam_v2_jobs AS job
  SET status = v_next_status,
      available_at = CASE WHEN v_disposition = 'RETRY'
        THEN clock_timestamp() + make_interval(secs => p_retry_delay_seconds) ELSE job.available_at END,
      result_digest = CASE WHEN v_disposition = 'RETRY' THEN NULL ELSE v_result_digest END,
      error_class = CASE WHEN v_disposition = 'SUCCEEDED' THEN NULL
        WHEN v_disposition = 'RETRY' THEN 'EXTERNAL_RETRY'
        WHEN v_outcome = 'OUTCOME_UNKNOWN' THEN 'EXTERNAL_OUTCOME_UNKNOWN'
        ELSE 'EXTERNAL_FAILED' END,
      completed_at = clock_timestamp(),
      completed_by_principal_id = mmc.cam_v2_current_principal_id(),
      completed_lease_generation = p_lease_generation,
      completion_disposition = v_disposition,
      completion_result_digest = v_result_digest,
      completion_retry_delay_seconds = CASE WHEN v_disposition = 'RETRY'
        THEN p_retry_delay_seconds ELSE NULL END,
      lease_owner_principal_id = NULL,
      lease_expires_at = NULL,
      external_dispatch_generation = CASE WHEN v_disposition = 'RETRY' THEN NULL ELSE job.external_dispatch_generation END,
      external_dispatch_intent_digest = CASE WHEN v_disposition = 'RETRY' THEN NULL ELSE job.external_dispatch_intent_digest END,
      external_dispatch_idempotency_key_digest = CASE WHEN v_disposition = 'RETRY' THEN NULL ELSE job.external_dispatch_idempotency_key_digest END,
      external_dispatch_recorded_at = CASE WHEN v_disposition = 'RETRY' THEN NULL ELSE job.external_dispatch_recorded_at END,
      external_result_generation = CASE WHEN v_disposition = 'RETRY' THEN NULL ELSE p_lease_generation END,
      external_outcome = CASE WHEN v_disposition = 'RETRY' THEN NULL ELSE v_outcome END,
      external_result_digest = CASE WHEN v_disposition = 'RETRY' THEN NULL ELSE v_result_digest END,
      external_provider_receipt_digest = CASE WHEN v_disposition = 'RETRY' THEN NULL ELSE v_receipt_digest END,
      external_provider_idempotency_proven = CASE WHEN v_disposition = 'RETRY' THEN NULL ELSE v_idempotency_proven END,
      external_result_recorded_at = CASE WHEN v_disposition = 'RETRY' THEN NULL ELSE v_recorded_at END,
      object_version = job.object_version + 1,
      updated_at = clock_timestamp()
  WHERE job.tenant_id = mmc.cam_v2_current_tenant_id()
    AND job.environment = mmc.cam_v2_current_environment()
    AND job.id = p_job_id
    AND job.lease_generation = p_lease_generation
    AND job.object_version = v_expected_version
    AND mmc.cam_v2_lock_job_mutation_authority(
      job.id,
      'mmc.operator.trust_write',
      v_lock_mode
    ) = v_expected_version;
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated <> 1 THEN
    RAISE EXCEPTION 'expired result reconciliation lost its version fence' USING ERRCODE = '40001';
  END IF;

  v_resolved_at := clock_timestamp();
  IF v_job.external_result_generation IS NOT NULL THEN
    UPDATE mmc.cam_v2_outbox_events AS evidence
    SET external_resolution = v_finding || ':' || v_disposition,
        external_resolved_at = v_resolved_at,
        object_version = evidence.object_version + 1,
        updated_at = v_resolved_at
    WHERE evidence.tenant_id = v_job.tenant_id
      AND evidence.environment = v_job.environment
      AND evidence.job_id = v_job.id
      AND evidence.aggregate_kind = 'JOB_EXTERNAL_RESULT'
      AND evidence.aggregate_id = v_job.id
      AND evidence.aggregate_version = p_lease_generation
      AND evidence.external_lease_generation = p_lease_generation
      AND evidence.external_outcome = v_outcome
      AND evidence.external_result_digest = v_result_digest
      AND evidence.external_result_recorded_at = v_recorded_at
      AND evidence.delivery_state = 'QUARANTINED'
      AND evidence.external_resolution IS NULL
      AND evidence.external_resolved_at IS NULL;
    GET DIAGNOSTICS v_quarantine_updated = ROW_COUNT;
    IF v_quarantine_updated <> 1 THEN
      RAISE EXCEPTION 'exact quarantined provider evidence was not uniquely resolved'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  INSERT INTO mmc.cam_v2_outbox_events (
    tenant_id, environment, job_id, aggregate_kind, aggregate_id,
    aggregate_version, event_kind, payload_digest,
    external_lease_generation, external_outcome, external_result_digest,
    external_provider_receipt_digest, external_provider_idempotency_proven,
    external_provider_idempotency_key_digest, external_result_recorded_at,
    external_resolution, external_resolved_at
  ) VALUES (
    mmc.cam_v2_current_tenant_id(), mmc.cam_v2_current_environment(), p_job_id,
    'JOB_EXTERNAL_RESULT', p_job_id, p_lease_generation,
    'EXTERNAL_RECONCILED_' || v_finding || '_' || v_disposition, p_resolution_digest,
    p_lease_generation, v_outcome, v_result_digest, v_receipt_digest,
    v_idempotency_proven, v_job.provider_idempotency_key_digest,
    v_recorded_at, v_finding || ':' || v_disposition, v_resolved_at
  );
  RETURN v_next_status;
END;
$$;

-- A worker that lost the terminal response can replay the exact completion
-- after its lease has been cleared. The durable completion principal,
-- generation, result, disposition, and error must all match; any semantic
-- drift is an explicit conflict and never a second mutation.
DROP FUNCTION IF EXISTS mmc.cam_v2_terminal_completion_replay(uuid, bigint, text, text, text);
CREATE OR REPLACE FUNCTION mmc.cam_v2_terminal_completion_replay(
  p_job_id uuid, p_lease_generation bigint, p_result_digest text,
  p_disposition text, p_error_class text, p_retry_delay_seconds integer
)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, mmc
SET row_security = off
AS $$
DECLARE
  v_job mmc.cam_v2_jobs%ROWTYPE;
BEGIN
  IF p_job_id IS DISTINCT FROM mmc.cam_v2_current_job_id()
     OR p_lease_generation IS DISTINCT FROM mmc.cam_v2_current_lease_generation()
     OR NOT mmc.cam_v2_actor_is_active('WORKLOAD')
     OR NOT mmc.cam_v2_has_capability('mmc.worker.complete') THEN
    RETURN NULL;
  END IF;
  SELECT job.* INTO v_job
  FROM mmc.cam_v2_jobs AS job
  WHERE job.tenant_id = mmc.cam_v2_current_tenant_id()
    AND job.environment = mmc.cam_v2_current_environment()
    AND job.id = p_job_id
    AND job.queue_name = mmc.cam_v2_current_queue_name();
  IF NOT FOUND OR v_job.status NOT IN ('RETRY_SCHEDULED', 'SUCCEEDED', 'FAILED', 'DEAD_LETTER') THEN
    RETURN NULL;
  END IF;
  IF v_job.completed_by_principal_id = mmc.cam_v2_current_principal_id()
     AND v_job.completed_lease_generation = p_lease_generation
     AND v_job.completion_disposition = p_disposition
     AND v_job.completion_result_digest = p_result_digest
     AND v_job.error_class IS NOT DISTINCT FROM p_error_class
     AND v_job.completion_retry_delay_seconds IS NOT DISTINCT FROM
       (CASE WHEN p_disposition = 'RETRY' THEN p_retry_delay_seconds ELSE NULL END) THEN
    RETURN v_job.status;
  END IF;
  RAISE EXCEPTION 'terminal completion replay changed immutable semantics'
    USING ERRCODE = '23505';
END;
$$;

DROP FUNCTION IF EXISTS mmc.cam_v2_complete_job(uuid, bigint, text);
CREATE OR REPLACE FUNCTION mmc.cam_v2_complete_job(
  p_job_id uuid,
  p_lease_generation bigint,
  p_result_digest text,
  p_disposition text DEFAULT 'SUCCEEDED',
  p_error_class text DEFAULT NULL,
  p_retry_delay_seconds integer DEFAULT 0
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, mmc
SET row_security = on
AS $$
DECLARE
  v_updated integer;
  v_expected_version bigint;
  v_job mmc.cam_v2_jobs%ROWTYPE;
  v_disposition text := upper(coalesce(p_disposition, ''));
  v_next_status text;
  v_resolved_at timestamptz;
  v_quarantine_updated integer;
BEGIN
  IF p_job_id IS DISTINCT FROM mmc.cam_v2_current_job_id()
     OR p_lease_generation IS DISTINCT FROM mmc.cam_v2_current_lease_generation()
     OR NOT mmc.cam_v2_has_capability('mmc.worker.complete')
     THEN
    RAISE EXCEPTION 'worker completion authority denied' USING ERRCODE = '42501';
  END IF;
  IF p_result_digest IS NULL OR p_result_digest !~ '^[a-f0-9]{64}$'
     OR v_disposition NOT IN ('SUCCEEDED', 'FAILED', 'RETRY', 'DEAD_LETTER')
     OR p_retry_delay_seconds IS NULL OR p_retry_delay_seconds < 0 OR p_retry_delay_seconds > 86400
     OR (v_disposition = 'SUCCEEDED' AND p_error_class IS NOT NULL)
     OR (v_disposition <> 'RETRY' AND p_retry_delay_seconds <> 0)
     OR (v_disposition <> 'SUCCEEDED' AND (
       p_error_class IS NULL OR p_error_class !~ '^[A-Z0-9_]{3,64}$'
     )) THEN
    RAISE EXCEPTION 'result digest must be lowercase SHA-256' USING ERRCODE = '22023';
  END IF;

  v_next_status := mmc.cam_v2_terminal_completion_replay(
    p_job_id, p_lease_generation, p_result_digest, v_disposition, p_error_class,
    p_retry_delay_seconds
  );
  IF v_next_status IS NOT NULL THEN RETURN v_next_status; END IF;

  PERFORM mmc.cam_v2_lock_audit_chain(
    mmc.cam_v2_current_tenant_id(), mmc.cam_v2_current_environment()
  );

  v_expected_version := mmc.cam_v2_lock_job_mutation_authority(
    p_job_id, 'mmc.worker.complete', 'CURRENT_LEASE'
  );
  IF v_expected_version IS NULL THEN
    v_next_status := mmc.cam_v2_terminal_completion_replay(
      p_job_id, p_lease_generation, p_result_digest, v_disposition, p_error_class,
      p_retry_delay_seconds
    );
    IF v_next_status IS NOT NULL THEN RETURN v_next_status; END IF;
    RAISE EXCEPTION 'worker completion authority denied' USING ERRCODE = '42501';
  END IF;

  SELECT job.* INTO v_job
  FROM mmc.cam_v2_jobs AS job
  WHERE job.tenant_id = mmc.cam_v2_current_tenant_id()
    AND job.environment = mmc.cam_v2_current_environment()
    AND job.id = p_job_id
  FOR UPDATE;
  IF v_job.external_dispatch_generation IS DISTINCT FROM p_lease_generation
     OR v_job.external_result_generation IS DISTINCT FROM p_lease_generation
     OR v_job.external_result_digest IS DISTINCT FROM p_result_digest THEN
    RAISE EXCEPTION 'exact generation-bound provider result is required' USING ERRCODE = '23514';
  END IF;
  IF v_disposition = 'SUCCEEDED' THEN
    PERFORM mmc.cam_v2_assert_exact_success_handoff(v_job.id, p_result_digest);
  END IF;
  IF v_job.external_outcome = 'SUCCEEDED' AND v_disposition <> 'SUCCEEDED' THEN
    RAISE EXCEPTION 'confirmed provider success must complete as succeeded' USING ERRCODE = '23514';
  END IF;
  IF v_disposition = 'SUCCEEDED' AND v_job.external_outcome <> 'SUCCEEDED' THEN
    RAISE EXCEPTION 'succeeded completion requires provider success' USING ERRCODE = '23514';
  END IF;
  IF v_job.external_outcome = 'OUTCOME_UNKNOWN'
     AND v_disposition IN ('SUCCEEDED', 'FAILED') THEN
    RAISE EXCEPTION 'unknown provider outcome requires safe retry or dead letter' USING ERRCODE = '23514';
  END IF;
  IF v_disposition = 'RETRY'
     AND (v_job.external_outcome = 'SUCCEEDED'
       OR (v_job.external_outcome = 'OUTCOME_UNKNOWN'
         AND v_job.external_provider_idempotency_proven IS NOT TRUE)
       OR v_job.attempt_count >= v_job.max_attempts) THEN
    RAISE EXCEPTION 'provider outcome is not safely retryable' USING ERRCODE = '23514';
  END IF;

  v_next_status := CASE WHEN v_disposition = 'RETRY' THEN 'RETRY_SCHEDULED' ELSE v_disposition END;

  UPDATE mmc.cam_v2_jobs AS job
  SET status = v_next_status,
      result_digest = CASE WHEN v_disposition = 'RETRY' THEN NULL ELSE p_result_digest END,
      error_class = p_error_class,
      available_at = CASE WHEN v_disposition = 'RETRY'
        THEN clock_timestamp() + make_interval(secs => p_retry_delay_seconds)
        ELSE job.available_at END,
      completed_at = clock_timestamp(),
      completed_by_principal_id = mmc.cam_v2_current_principal_id(),
      completed_lease_generation = p_lease_generation,
      completion_disposition = v_disposition,
      completion_result_digest = p_result_digest,
      completion_retry_delay_seconds = CASE WHEN v_disposition = 'RETRY'
        THEN p_retry_delay_seconds ELSE NULL END,
      lease_owner_principal_id = NULL,
      lease_expires_at = NULL,
      external_dispatch_generation = CASE WHEN v_disposition = 'RETRY' THEN NULL ELSE job.external_dispatch_generation END,
      external_dispatch_intent_digest = CASE WHEN v_disposition = 'RETRY' THEN NULL ELSE job.external_dispatch_intent_digest END,
      external_dispatch_idempotency_key_digest = CASE WHEN v_disposition = 'RETRY' THEN NULL ELSE job.external_dispatch_idempotency_key_digest END,
      external_dispatch_recorded_at = CASE WHEN v_disposition = 'RETRY' THEN NULL ELSE job.external_dispatch_recorded_at END,
      external_result_generation = CASE WHEN v_disposition = 'RETRY' THEN NULL ELSE job.external_result_generation END,
      external_outcome = CASE WHEN v_disposition = 'RETRY' THEN NULL ELSE job.external_outcome END,
      external_result_digest = CASE WHEN v_disposition = 'RETRY' THEN NULL ELSE job.external_result_digest END,
      external_provider_receipt_digest = CASE WHEN v_disposition = 'RETRY' THEN NULL ELSE job.external_provider_receipt_digest END,
      external_provider_idempotency_proven = CASE WHEN v_disposition = 'RETRY' THEN NULL ELSE job.external_provider_idempotency_proven END,
      external_result_recorded_at = CASE WHEN v_disposition = 'RETRY' THEN NULL ELSE job.external_result_recorded_at END,
      object_version = job.object_version + 1, updated_at = clock_timestamp()
  WHERE job.tenant_id = mmc.cam_v2_current_tenant_id()
    AND job.environment = mmc.cam_v2_current_environment()
    AND job.id = p_job_id
    AND job.lease_owner_principal_id = mmc.cam_v2_current_principal_id()
    AND job.lease_generation = p_lease_generation
    AND job.lease_expires_at > clock_timestamp()
    AND job.status IN ('LEASED', 'RUNNING')
    AND job.external_result_generation = p_lease_generation
    AND job.external_outcome = v_job.external_outcome
    AND job.external_result_digest = p_result_digest
    AND job.object_version = v_expected_version
    AND mmc.cam_v2_lock_job_mutation_authority(
      job.id, 'mmc.worker.complete', 'CURRENT_LEASE'
    ) = v_expected_version;
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated <> 1 THEN
    RAISE EXCEPTION 'completion lost its version fence' USING ERRCODE = '40001';
  END IF;
  v_resolved_at := clock_timestamp();
  UPDATE mmc.cam_v2_outbox_events AS evidence
  SET external_resolution = 'ACTIVE:' || v_disposition,
      external_resolved_at = v_resolved_at,
      object_version = evidence.object_version + 1,
      updated_at = v_resolved_at
  WHERE evidence.tenant_id = v_job.tenant_id
    AND evidence.environment = v_job.environment
    AND evidence.job_id = v_job.id
    AND evidence.aggregate_kind = 'JOB_EXTERNAL_RESULT'
    AND evidence.aggregate_id = v_job.id
    AND evidence.aggregate_version = p_lease_generation
    AND evidence.external_lease_generation = p_lease_generation
    AND evidence.external_outcome = v_job.external_outcome
    AND evidence.external_result_digest = v_job.external_result_digest
    AND evidence.external_result_recorded_at = v_job.external_result_recorded_at
    AND evidence.delivery_state = 'QUARANTINED'
    AND evidence.external_resolution IS NULL
    AND evidence.external_resolved_at IS NULL;
  GET DIAGNOSTICS v_quarantine_updated = ROW_COUNT;
  IF v_quarantine_updated <> 1 THEN
    RAISE EXCEPTION 'exact active provider evidence was not uniquely resolved'
      USING ERRCODE = '23514';
  END IF;
  INSERT INTO mmc.cam_v2_outbox_events (
    tenant_id, environment, job_id, aggregate_kind, aggregate_id,
    aggregate_version, event_kind, payload_digest,
    external_lease_generation, external_outcome, external_result_digest,
    external_provider_receipt_digest, external_provider_idempotency_proven,
    external_provider_idempotency_key_digest, external_result_recorded_at,
    external_resolution, external_resolved_at
  ) VALUES (
    mmc.cam_v2_current_tenant_id(), mmc.cam_v2_current_environment(), p_job_id,
    'JOB_EXTERNAL_RESULT', p_job_id, p_lease_generation,
    'EXTERNAL_ACTIVE_COMPLETED_' || v_disposition, p_result_digest,
    p_lease_generation, v_job.external_outcome, v_job.external_result_digest,
    v_job.external_provider_receipt_digest, v_job.external_provider_idempotency_proven,
    v_job.provider_idempotency_key_digest, v_job.external_result_recorded_at,
    'ACTIVE:' || v_disposition, v_resolved_at
  );
  RETURN v_next_status;
END;
$$;

CREATE OR REPLACE FUNCTION mmc.cam_v2_cancel_inactive_job(
  p_job_id uuid, p_expected_version bigint
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, mmc
SET row_security = on
AS $$
DECLARE
  v_locked_version bigint;
  v_updated integer;
  v_error_class text;
BEGIN
  IF p_job_id IS NULL OR p_expected_version IS NULL OR p_expected_version < 1
     OR mmc.cam_v2_current_principal_kind() NOT IN ('OPERATOR', 'ADMIN')
     OR NOT mmc.cam_v2_is_trust_operator(true) THEN
    RAISE EXCEPTION 'inactive-job cleanup authority or input denied' USING ERRCODE = '42501';
  END IF;
  PERFORM mmc.cam_v2_lock_audit_chain(
    mmc.cam_v2_current_tenant_id(), mmc.cam_v2_current_environment()
  );
  v_locked_version := mmc.cam_v2_lock_job_mutation_authority(
    p_job_id, 'mmc.operator.trust_write', 'INACTIVE_CLEANUP'
  );
  IF v_locked_version IS NULL OR v_locked_version IS DISTINCT FROM p_expected_version THEN
    RAISE EXCEPTION 'job is active, ineligible, or stale for terminal cleanup'
      USING ERRCODE = '40001';
  END IF;
  v_error_class := CASE
    WHEN mmc.cam_v2_job_durable_authority_is_active(p_job_id)
      THEN 'WRITER_DISABLED'
    ELSE 'AUTHORITY_WITHDRAWN'
  END;
  UPDATE mmc.cam_v2_jobs AS job
  SET status = 'CANCELLED',
      lease_owner_principal_id = NULL,
      lease_expires_at = NULL,
      result_digest = NULL,
      error_class = v_error_class,
      completed_at = NULL,
      completed_by_principal_id = NULL,
      completed_lease_generation = NULL,
      completion_disposition = NULL,
      completion_result_digest = NULL,
      completion_retry_delay_seconds = NULL,
      object_version = job.object_version + 1,
      updated_at = clock_timestamp()
  WHERE job.tenant_id = mmc.cam_v2_current_tenant_id()
    AND job.environment = mmc.cam_v2_current_environment()
    AND job.id = p_job_id
    AND job.object_version = v_locked_version
    AND mmc.cam_v2_lock_job_mutation_authority(
      job.id, 'mmc.operator.trust_write', 'INACTIVE_CLEANUP'
    ) = v_locked_version;
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated <> 1 THEN
    RAISE EXCEPTION 'inactive-job cleanup lost its version fence' USING ERRCODE = '40001';
  END IF;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION mmc.cam_v2_claim_outbox(
  p_queue_name text, p_lease_seconds integer
)
RETURNS TABLE (
  outbox_event_id uuid, delivery_lease_generation bigint,
  delivery_lease_expires_at timestamptz, event_kind text, payload_digest text,
  effect_kind text, target_kind text, target_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, mmc
SET row_security = on
AS $$
BEGIN
  IF p_queue_name IS NULL OR p_queue_name !~ '^[a-z0-9][a-z0-9._-]{0,63}$'
     OR p_queue_name IS DISTINCT FROM mmc.cam_v2_current_queue_name()
     OR p_lease_seconds IS NULL OR p_lease_seconds < 15 OR p_lease_seconds > 300
     OR NOT mmc.cam_v2_actor_is_active('WORKLOAD')
     OR NOT mmc.cam_v2_has_capability('mmc.worker.outbox_dispatch') THEN
    RAISE EXCEPTION 'outbox claim authority or input denied' USING ERRCODE = '42501';
  END IF;
  PERFORM mmc.cam_v2_lock_audit_chain(
    mmc.cam_v2_current_tenant_id(), mmc.cam_v2_current_environment()
  );
  RETURN QUERY
  WITH candidate_pool AS MATERIALIZED (
    SELECT event.tenant_id, event.environment, event.id, event.object_version,
           event.available_at, event.created_at
    FROM mmc.cam_v2_outbox_events AS event
    WHERE event.tenant_id = mmc.cam_v2_current_tenant_id()
      AND event.environment = mmc.cam_v2_current_environment()
      AND event.delivery_queue_name = p_queue_name
      AND event.available_at <= clock_timestamp()
      AND event.attempt_count < event.max_attempts
      AND mmc.cam_v2_outbox_origin_is_active(event.id)
      AND (
        event.delivery_state IN ('PENDING', 'RETRY')
        OR (event.delivery_state = 'LEASED' AND event.delivery_lease_expires_at <= clock_timestamp())
      )
    ORDER BY event.available_at, event.created_at, event.id
    FOR UPDATE OF event SKIP LOCKED
    LIMIT 32
  ), candidate AS MATERIALIZED (
    SELECT pool.* FROM candidate_pool AS pool
    WHERE mmc.cam_v2_lock_outbox_delivery(pool.id, 'CLAIM') = pool.object_version
    ORDER BY pool.available_at, pool.created_at, pool.id
    LIMIT 1
  )
  UPDATE mmc.cam_v2_outbox_events AS claimed
  SET delivery_state = 'LEASED',
      attempt_count = claimed.attempt_count + 1,
      delivery_lease_owner_principal_id = mmc.cam_v2_current_principal_id(),
      delivery_lease_generation = claimed.delivery_lease_generation + 1,
      delivery_lease_expires_at = clock_timestamp() + make_interval(secs => p_lease_seconds),
      delivery_error_class = NULL,
      delivery_completed_by_principal_id = NULL,
      delivery_completed_queue_name = NULL,
      delivery_completed_lease_generation = NULL,
      delivery_completion_disposition = NULL,
      delivery_completion_error_class = NULL,
      delivery_completion_retry_delay_seconds = NULL,
      delivery_completed_at = NULL,
      object_version = claimed.object_version + 1,
      updated_at = clock_timestamp()
  FROM candidate
  WHERE claimed.tenant_id = candidate.tenant_id
    AND claimed.environment = candidate.environment
    AND claimed.id = candidate.id
    AND claimed.object_version = candidate.object_version
    AND mmc.cam_v2_lock_outbox_delivery(claimed.id, 'CLAIM') = candidate.object_version
  RETURNING claimed.id, claimed.delivery_lease_generation,
            claimed.delivery_lease_expires_at, claimed.event_kind, claimed.payload_digest,
            CASE
              WHEN claimed.job_id IS NOT NULL THEN 'PROJECTION_REFRESH'
              WHEN claimed.aggregate_kind = 'PUBLICATION' THEN 'NOTIFICATION_ENQUEUE'
              WHEN claimed.aggregate_kind = 'SESSION' THEN 'INDEX_REFRESH'
              ELSE 'CACHE_INVALIDATION'
            END,
            CASE
              WHEN claimed.job_id IS NOT NULL THEN 'JOB'
              WHEN claimed.aggregate_kind IN ('SUBJECT', 'ASSIGNMENT', 'SESSION', 'PUBLICATION')
                THEN claimed.aggregate_kind
              ELSE NULL
            END,
            CASE WHEN claimed.job_id IS NOT NULL THEN claimed.job_id ELSE claimed.aggregate_id END;
END;
$$;

CREATE OR REPLACE FUNCTION mmc.cam_v2_heartbeat_outbox(
  p_outbox_event_id uuid, p_delivery_lease_generation bigint, p_extend_seconds integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, mmc
SET row_security = on
AS $$
DECLARE
  v_expected_version bigint;
  v_updated integer;
BEGIN
  IF p_outbox_event_id IS DISTINCT FROM mmc.cam_v2_current_outbox_event_id()
     OR p_delivery_lease_generation IS DISTINCT FROM mmc.cam_v2_current_outbox_lease_generation()
     OR p_extend_seconds IS NULL OR p_extend_seconds < 15 OR p_extend_seconds > 300 THEN
    RAISE EXCEPTION 'outbox heartbeat authority or input denied' USING ERRCODE = '42501';
  END IF;
  PERFORM mmc.cam_v2_lock_audit_chain(
    mmc.cam_v2_current_tenant_id(), mmc.cam_v2_current_environment()
  );
  v_expected_version := mmc.cam_v2_lock_outbox_delivery(p_outbox_event_id, 'CURRENT_LEASE');
  IF v_expected_version IS NULL THEN RAISE EXCEPTION 'outbox lease is not current' USING ERRCODE = '42501'; END IF;
  UPDATE mmc.cam_v2_outbox_events AS event
  SET delivery_lease_expires_at = greatest(
        event.delivery_lease_expires_at,
        clock_timestamp() + make_interval(secs => p_extend_seconds)
      ),
      object_version = event.object_version + 1, updated_at = clock_timestamp()
  WHERE event.tenant_id = mmc.cam_v2_current_tenant_id()
    AND event.environment = mmc.cam_v2_current_environment()
    AND event.id = p_outbox_event_id
    AND event.delivery_lease_generation = p_delivery_lease_generation
    AND event.object_version = v_expected_version
    AND mmc.cam_v2_lock_outbox_delivery(event.id, 'CURRENT_LEASE') = v_expected_version;
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated = 1;
END;
$$;

DROP FUNCTION IF EXISTS mmc.cam_v2_record_inbox_effect(uuid, text, text);
CREATE OR REPLACE FUNCTION mmc.cam_v2_record_inbox_effect(
  p_outbox_event_id uuid, p_effect_kind text, p_target_kind text,
  p_target_id uuid, p_effect_digest text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, mmc
SET row_security = off
AS $$
DECLARE
  v_expected_version bigint;
  v_event mmc.cam_v2_outbox_events%ROWTYPE;
  v_existing mmc.cam_v2_consumer_effects%ROWTYPE;
  v_effect_id uuid;
  v_kind text := upper(coalesce(p_effect_kind, ''));
  v_target_kind text := upper(coalesce(p_target_kind, ''));
  v_expected_effect_kind text;
  v_expected_target_kind text;
  v_expected_target_id uuid;
  v_updated integer;
BEGIN
  IF p_outbox_event_id IS DISTINCT FROM mmc.cam_v2_current_outbox_event_id()
     OR NOT mmc.cam_v2_has_capability('mmc.worker.inbox')
     OR NOT mmc.cam_v2_actor_is_active('WORKLOAD')
     OR mmc.cam_v2_current_principal_id() IS NULL
     OR mmc.cam_v2_current_queue_name() IS NULL
     OR v_kind NOT IN ('PROJECTION_REFRESH', 'INDEX_REFRESH', 'CACHE_INVALIDATION', 'NOTIFICATION_ENQUEUE')
     OR v_target_kind NOT IN ('SUBJECT', 'ASSIGNMENT', 'SESSION', 'JOB', 'PUBLICATION')
     OR p_target_id IS NULL OR p_effect_digest IS NULL
     OR p_effect_digest !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'bounded consumer effect input or authority denied' USING ERRCODE = '42501';
  END IF;

  -- Lost-response replay is checked against the durable receipt before a
  -- current lease is required. Exact replay is a read-only false return;
  -- semantic mismatch remains a conflict. New effects still require the
  -- generation-bound lease below.
  SELECT event.* INTO v_event
  FROM mmc.cam_v2_outbox_events AS event
  WHERE event.tenant_id = mmc.cam_v2_current_tenant_id()
    AND event.environment = mmc.cam_v2_current_environment()
    AND event.id = p_outbox_event_id;
  IF FOUND THEN
    v_expected_effect_kind := CASE
      WHEN v_event.job_id IS NOT NULL THEN 'PROJECTION_REFRESH'
      WHEN v_event.aggregate_kind = 'PUBLICATION' THEN 'NOTIFICATION_ENQUEUE'
      WHEN v_event.aggregate_kind = 'SESSION' THEN 'INDEX_REFRESH'
      ELSE 'CACHE_INVALIDATION'
    END;
    v_expected_target_kind := CASE
      WHEN v_event.job_id IS NOT NULL THEN 'JOB'
      WHEN v_event.aggregate_kind IN ('SUBJECT', 'ASSIGNMENT', 'SESSION', 'PUBLICATION')
        THEN v_event.aggregate_kind
      ELSE NULL
    END;
    v_expected_target_id := CASE WHEN v_event.job_id IS NOT NULL
      THEN v_event.job_id ELSE v_event.aggregate_id END;
    IF v_expected_target_kind IS NULL
       OR v_kind IS DISTINCT FROM v_expected_effect_kind
       OR v_target_kind IS DISTINCT FROM v_expected_target_kind
       OR p_target_id IS DISTINCT FROM v_expected_target_id THEN
      RAISE EXCEPTION 'consumer effect does not match the canonical outbox event semantics'
        USING ERRCODE = '23514';
    END IF;
    SELECT effect.* INTO v_existing
    FROM mmc.cam_v2_consumer_effects AS effect
    WHERE effect.tenant_id = v_event.tenant_id
      AND effect.environment = v_event.environment
      AND effect.outbox_event_id = v_event.id;
    IF FOUND THEN
      IF v_existing.dispatcher_principal_id = mmc.cam_v2_current_principal_id()
         AND v_existing.dispatcher_queue_name = mmc.cam_v2_current_queue_name()
         AND v_existing.dispatcher_lease_generation = mmc.cam_v2_current_outbox_lease_generation()
         AND v_existing.effect_kind = v_kind
         AND v_existing.target_kind = v_target_kind
         AND v_existing.target_id = p_target_id
         AND v_existing.effect_digest = p_effect_digest
         AND EXISTS (
           SELECT 1 FROM mmc.cam_v2_consumer_inbox AS receipt
           WHERE receipt.tenant_id = v_existing.tenant_id
             AND receipt.environment = v_existing.environment
             AND receipt.outbox_event_id = v_existing.outbox_event_id
             AND receipt.consumer_effect_id = v_existing.id
             AND receipt.consumer_principal_id = v_existing.dispatcher_principal_id
             AND receipt.consumer_queue_name = v_existing.dispatcher_queue_name
             AND receipt.consumer_lease_generation = v_existing.dispatcher_lease_generation
             AND receipt.effect_digest = v_existing.effect_digest
         ) THEN
        RETURN false;
      END IF;
      RAISE EXCEPTION 'outbox event effect semantics are immutable' USING ERRCODE = '23505';
    END IF;
  END IF;
  PERFORM mmc.cam_v2_lock_audit_chain(
    mmc.cam_v2_current_tenant_id(), mmc.cam_v2_current_environment()
  );
  v_expected_version := mmc.cam_v2_lock_outbox_delivery(p_outbox_event_id, 'CURRENT_LEASE');
  IF v_expected_version IS NULL THEN RAISE EXCEPTION 'outbox delivery lease is not current' USING ERRCODE = '42501'; END IF;
  SELECT event.* INTO v_event
  FROM mmc.cam_v2_outbox_events AS event
  WHERE event.tenant_id = mmc.cam_v2_current_tenant_id()
    AND event.environment = mmc.cam_v2_current_environment()
    AND event.id = p_outbox_event_id
  FOR UPDATE;
  v_expected_effect_kind := CASE
    WHEN v_event.job_id IS NOT NULL THEN 'PROJECTION_REFRESH'
    WHEN v_event.aggregate_kind = 'PUBLICATION' THEN 'NOTIFICATION_ENQUEUE'
    WHEN v_event.aggregate_kind = 'SESSION' THEN 'INDEX_REFRESH'
    ELSE 'CACHE_INVALIDATION'
  END;
  v_expected_target_kind := CASE
    WHEN v_event.job_id IS NOT NULL THEN 'JOB'
    WHEN v_event.aggregate_kind IN ('SUBJECT', 'ASSIGNMENT', 'SESSION', 'PUBLICATION')
      THEN v_event.aggregate_kind
    ELSE NULL
  END;
  v_expected_target_id := CASE WHEN v_event.job_id IS NOT NULL
    THEN v_event.job_id ELSE v_event.aggregate_id END;
  IF v_expected_target_kind IS NULL
     OR v_kind IS DISTINCT FROM v_expected_effect_kind
     OR v_target_kind IS DISTINCT FROM v_expected_target_kind
     OR p_target_id IS DISTINCT FROM v_expected_target_id THEN
    RAISE EXCEPTION 'consumer effect does not match the canonical outbox event semantics'
      USING ERRCODE = '23514';
  END IF;

  SELECT effect.* INTO v_existing
  FROM mmc.cam_v2_consumer_effects AS effect
  WHERE effect.tenant_id = v_event.tenant_id
    AND effect.environment = v_event.environment
    AND effect.outbox_event_id = v_event.id;
  IF FOUND THEN
    IF v_existing.dispatcher_principal_id = mmc.cam_v2_current_principal_id()
       AND v_existing.dispatcher_queue_name = mmc.cam_v2_current_queue_name()
       AND v_existing.dispatcher_lease_generation = mmc.cam_v2_current_outbox_lease_generation()
       AND v_existing.effect_kind = v_kind
       AND v_existing.target_kind = v_target_kind
       AND v_existing.target_id = p_target_id
       AND v_existing.effect_digest = p_effect_digest THEN
      RETURN false;
    END IF;
    RAISE EXCEPTION 'outbox event effect semantics are immutable' USING ERRCODE = '23505';
  END IF;

  INSERT INTO mmc.cam_v2_consumer_effects (
    tenant_id, environment, outbox_event_id, source_job_id,
    dispatcher_principal_id, dispatcher_queue_name, dispatcher_lease_generation,
    effect_kind, target_kind, target_id, effect_digest, applied_at
  ) VALUES (
    v_event.tenant_id, v_event.environment, v_event.id, v_event.job_id,
    mmc.cam_v2_current_principal_id(), mmc.cam_v2_current_queue_name(),
    mmc.cam_v2_current_outbox_lease_generation(), v_kind, v_target_kind,
    p_target_id, p_effect_digest, clock_timestamp()
  ) RETURNING id INTO v_effect_id;
  INSERT INTO mmc.cam_v2_consumer_inbox (
    tenant_id, environment, job_id, outbox_event_id, consumer_effect_id,
    consumer_principal_id, consumer_queue_name, consumer_lease_generation, effect_digest
  ) VALUES (
    v_event.tenant_id, v_event.environment, v_event.job_id, v_event.id, v_effect_id,
    mmc.cam_v2_current_principal_id(), mmc.cam_v2_current_queue_name(),
    mmc.cam_v2_current_outbox_lease_generation(), p_effect_digest
  );
  IF mmc.cam_v2_lock_outbox_delivery(p_outbox_event_id, 'CURRENT_LEASE')
     IS DISTINCT FROM v_expected_version THEN
    RAISE EXCEPTION 'outbox delivery authority changed before effect receipt' USING ERRCODE = '40001';
  END IF;
  UPDATE mmc.cam_v2_outbox_events AS event
  SET delivery_state = 'DELIVERED',
      delivered_at = clock_timestamp(),
      delivery_error_class = NULL,
      delivery_lease_owner_principal_id = NULL,
      delivery_lease_expires_at = NULL,
      delivery_completed_by_principal_id = NULL,
      delivery_completed_queue_name = NULL,
      delivery_completed_lease_generation = NULL,
      delivery_completion_disposition = NULL,
      delivery_completion_error_class = NULL,
      delivery_completion_retry_delay_seconds = NULL,
      delivery_completed_at = NULL,
      object_version = event.object_version + 1,
      updated_at = clock_timestamp()
  WHERE event.tenant_id = mmc.cam_v2_current_tenant_id()
    AND event.environment = mmc.cam_v2_current_environment()
    AND event.id = p_outbox_event_id
    AND event.object_version = v_expected_version
    AND mmc.cam_v2_lock_outbox_delivery(event.id, 'CURRENT_LEASE') = v_expected_version;
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated <> 1 THEN
    RAISE EXCEPTION 'atomic effect delivery lost its version fence' USING ERRCODE = '40001';
  END IF;
  RETURN true;
END;
$$;

-- RETRY/DEAD_LETTER control completion is also safe to replay after its lease
-- has been cleared. The durable receipt binds dispatcher, queue, generation,
-- disposition, error class, and requested delay; changed semantics conflict.
CREATE OR REPLACE FUNCTION mmc.cam_v2_terminal_outbox_completion_replay(
  p_outbox_event_id uuid, p_delivery_lease_generation bigint,
  p_disposition text, p_error_class text, p_retry_delay_seconds integer
)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, mmc
SET row_security = off
AS $$
DECLARE
  v_event mmc.cam_v2_outbox_events%ROWTYPE;
BEGIN
  IF p_outbox_event_id IS DISTINCT FROM mmc.cam_v2_current_outbox_event_id()
     OR p_delivery_lease_generation IS DISTINCT FROM mmc.cam_v2_current_outbox_lease_generation()
     OR NOT mmc.cam_v2_actor_is_active('WORKLOAD')
     OR NOT mmc.cam_v2_has_capability('mmc.worker.outbox_dispatch') THEN
    RETURN NULL;
  END IF;
  SELECT event.* INTO v_event
  FROM mmc.cam_v2_outbox_events AS event
  WHERE event.tenant_id = mmc.cam_v2_current_tenant_id()
    AND event.environment = mmc.cam_v2_current_environment()
    AND event.id = p_outbox_event_id
    AND event.delivery_queue_name = mmc.cam_v2_current_queue_name();
  IF NOT FOUND OR v_event.delivery_completed_lease_generation IS NULL THEN
    RETURN NULL;
  END IF;
  IF v_event.delivery_state = p_disposition
     AND v_event.delivery_completed_by_principal_id = mmc.cam_v2_current_principal_id()
     AND v_event.delivery_completed_queue_name = mmc.cam_v2_current_queue_name()
     AND v_event.delivery_completed_lease_generation = p_delivery_lease_generation
     AND v_event.delivery_completion_disposition = p_disposition
     AND v_event.delivery_completion_error_class = p_error_class
     AND v_event.delivery_completion_retry_delay_seconds = p_retry_delay_seconds THEN
    RETURN v_event.delivery_state;
  END IF;
  RAISE EXCEPTION 'terminal outbox completion replay changed immutable semantics'
    USING ERRCODE = '23505';
END;
$$;

CREATE OR REPLACE FUNCTION mmc.cam_v2_complete_outbox(
  p_outbox_event_id uuid, p_delivery_lease_generation bigint,
  p_disposition text, p_error_class text DEFAULT NULL,
  p_retry_delay_seconds integer DEFAULT 0
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, mmc
SET row_security = on
AS $$
DECLARE
  v_expected_version bigint;
  v_updated integer;
  v_disposition text := upper(coalesce(p_disposition, ''));
  v_lock_mode text;
  v_replayed text;
BEGIN
  IF p_outbox_event_id IS DISTINCT FROM mmc.cam_v2_current_outbox_event_id()
     OR p_delivery_lease_generation IS DISTINCT FROM mmc.cam_v2_current_outbox_lease_generation()
     OR v_disposition NOT IN ('RETRY', 'DEAD_LETTER')
     OR p_retry_delay_seconds IS NULL OR p_retry_delay_seconds < 0 OR p_retry_delay_seconds > 86400
     OR p_error_class IS NULL OR p_error_class !~ '^[A-Z0-9_]{3,64}$' THEN
    RAISE EXCEPTION 'outbox completion authority or input denied' USING ERRCODE = '42501';
  END IF;
  v_replayed := mmc.cam_v2_terminal_outbox_completion_replay(
    p_outbox_event_id, p_delivery_lease_generation, v_disposition,
    p_error_class, p_retry_delay_seconds
  );
  IF v_replayed IS NOT NULL THEN RETURN v_replayed; END IF;
  v_lock_mode := CASE WHEN v_disposition = 'DEAD_LETTER'
    THEN 'TERMINAL_CLEANUP' ELSE 'CURRENT_LEASE' END;
  PERFORM mmc.cam_v2_lock_audit_chain(
    mmc.cam_v2_current_tenant_id(), mmc.cam_v2_current_environment()
  );
  v_expected_version := mmc.cam_v2_lock_outbox_delivery(p_outbox_event_id, v_lock_mode);
  IF v_expected_version IS NULL THEN
    v_replayed := mmc.cam_v2_terminal_outbox_completion_replay(
      p_outbox_event_id, p_delivery_lease_generation, v_disposition,
      p_error_class, p_retry_delay_seconds
    );
    IF v_replayed IS NOT NULL THEN RETURN v_replayed; END IF;
    RAISE EXCEPTION 'outbox delivery lease is not current' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (
    SELECT 1 FROM mmc.cam_v2_consumer_inbox AS inbox
    WHERE inbox.tenant_id = mmc.cam_v2_current_tenant_id()
      AND inbox.environment = mmc.cam_v2_current_environment()
      AND inbox.outbox_event_id = p_outbox_event_id
      AND inbox.consumer_principal_id = mmc.cam_v2_current_principal_id()
      AND inbox.consumer_queue_name = mmc.cam_v2_current_queue_name()
  ) THEN
    RAISE EXCEPTION 'an applied consumer effect cannot be retried or dead-lettered' USING ERRCODE = '23514';
  END IF;
  UPDATE mmc.cam_v2_outbox_events AS event
  SET delivery_state = v_disposition,
      available_at = CASE WHEN v_disposition = 'RETRY'
        THEN clock_timestamp() + make_interval(secs => p_retry_delay_seconds)
        ELSE event.available_at END,
      delivery_error_class = p_error_class,
      delivered_at = NULL,
      delivery_lease_owner_principal_id = NULL,
      delivery_lease_expires_at = NULL,
      delivery_completed_by_principal_id = mmc.cam_v2_current_principal_id(),
      delivery_completed_queue_name = mmc.cam_v2_current_queue_name(),
      delivery_completed_lease_generation = p_delivery_lease_generation,
      delivery_completion_disposition = v_disposition,
      delivery_completion_error_class = p_error_class,
      delivery_completion_retry_delay_seconds = p_retry_delay_seconds,
      delivery_completed_at = clock_timestamp(),
      object_version = event.object_version + 1, updated_at = clock_timestamp()
  WHERE event.tenant_id = mmc.cam_v2_current_tenant_id()
    AND event.environment = mmc.cam_v2_current_environment()
    AND event.id = p_outbox_event_id
    AND event.delivery_lease_generation = p_delivery_lease_generation
    AND event.object_version = v_expected_version
    AND (v_disposition <> 'RETRY' OR event.attempt_count < event.max_attempts)
    AND mmc.cam_v2_lock_outbox_delivery(event.id, v_lock_mode) = v_expected_version;
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated <> 1 THEN RAISE EXCEPTION 'outbox completion lost its version fence' USING ERRCODE = '40001'; END IF;
  RETURN v_disposition;
END;
$$;

CREATE OR REPLACE FUNCTION mmc.cam_v2_dead_letter_inactive_outbox(
  p_outbox_event_id uuid, p_expected_version bigint, p_error_class text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, mmc
SET row_security = on
AS $$
DECLARE
  v_locked_version bigint;
  v_updated integer;
BEGIN
  IF p_outbox_event_id IS NULL OR p_expected_version IS NULL OR p_expected_version < 1
     OR p_error_class IS NULL OR p_error_class !~ '^[A-Z0-9_]{3,64}$'
     OR mmc.cam_v2_current_principal_kind() NOT IN ('OPERATOR', 'ADMIN')
     OR NOT mmc.cam_v2_is_trust_operator(true) THEN
    RAISE EXCEPTION 'inactive-outbox cleanup authority or input denied' USING ERRCODE = '42501';
  END IF;
  PERFORM mmc.cam_v2_lock_audit_chain(
    mmc.cam_v2_current_tenant_id(), mmc.cam_v2_current_environment()
  );
  v_locked_version := mmc.cam_v2_lock_outbox_delivery(
    p_outbox_event_id, 'INACTIVE_CLEANUP'
  );
  IF v_locked_version IS NULL OR v_locked_version IS DISTINCT FROM p_expected_version THEN
    RAISE EXCEPTION 'outbox origin is active, ineligible, or stale for terminal cleanup'
      USING ERRCODE = '40001';
  END IF;
  UPDATE mmc.cam_v2_outbox_events AS event
  SET delivery_state = 'DEAD_LETTER',
      attempt_count = greatest(event.attempt_count, 1),
      delivery_lease_generation = greatest(event.delivery_lease_generation, 1),
      delivery_error_class = p_error_class,
      delivered_at = NULL,
      delivery_lease_owner_principal_id = NULL,
      delivery_lease_expires_at = NULL,
      delivery_completed_by_principal_id = mmc.cam_v2_current_principal_id(),
      delivery_completed_queue_name = event.delivery_queue_name,
      delivery_completed_lease_generation = greatest(event.delivery_lease_generation, 1),
      delivery_completion_disposition = 'DEAD_LETTER',
      delivery_completion_error_class = p_error_class,
      delivery_completion_retry_delay_seconds = 0,
      delivery_completed_at = clock_timestamp(),
      object_version = event.object_version + 1,
      updated_at = clock_timestamp()
  WHERE event.tenant_id = mmc.cam_v2_current_tenant_id()
    AND event.environment = mmc.cam_v2_current_environment()
    AND event.id = p_outbox_event_id
    AND event.object_version = v_locked_version
    AND mmc.cam_v2_lock_outbox_delivery(
      event.id, 'INACTIVE_CLEANUP'
    ) = v_locked_version;
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated <> 1 THEN
    RAISE EXCEPTION 'inactive-outbox cleanup lost its version fence' USING ERRCODE = '40001';
  END IF;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION mmc.cam_v2_register_job_input(
  p_consumer_job_id uuid, p_input_kind text, p_input_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, mmc
SET row_security = on
AS $$
DECLARE
  v_producer mmc.cam_v2_jobs%ROWTYPE;
  v_consumer mmc.cam_v2_jobs%ROWTYPE;
  v_input_authority_grant_id uuid;
  v_edge_id uuid;
  v_expected_version bigint;
  v_consumer_expected_version bigint;
  v_kind text := upper(coalesce(p_input_kind, ''));
BEGIN
  IF p_consumer_job_id IS NULL OR p_input_id IS NULL
     OR v_kind NOT IN ('SOURCE_ASSET', 'TRANSCRIPT_VERSION')
     OR mmc.cam_v2_current_job_id() IS NULL
     OR p_consumer_job_id = mmc.cam_v2_current_job_id()
     OR NOT mmc.cam_v2_has_capability('mmc.worker.complete') THEN
    RAISE EXCEPTION 'job input registration authority denied' USING ERRCODE = '42501';
  END IF;

  PERFORM mmc.cam_v2_lock_audit_chain(
    mmc.cam_v2_current_tenant_id(), mmc.cam_v2_current_environment()
  );

  v_expected_version := mmc.cam_v2_lock_job_mutation_authority(
    mmc.cam_v2_current_job_id(), 'mmc.worker.complete', 'CURRENT_LEASE'
  );
  IF v_expected_version IS NULL THEN
    RAISE EXCEPTION 'job input registration authority denied' USING ERRCODE = '42501';
  END IF;

  SELECT job.* INTO v_producer
  FROM mmc.cam_v2_jobs AS job
  WHERE job.tenant_id = mmc.cam_v2_current_tenant_id()
    AND job.environment = mmc.cam_v2_current_environment()
    AND job.id = mmc.cam_v2_current_job_id();

  SELECT job.* INTO v_consumer
  FROM mmc.cam_v2_jobs AS job
  WHERE job.tenant_id = v_producer.tenant_id
    AND job.environment = v_producer.environment
    AND job.id = p_consumer_job_id
    AND job.assignment_id IS NOT DISTINCT FROM v_producer.assignment_id
    AND job.subject_link_id IS NOT DISTINCT FROM v_producer.subject_link_id
    AND job.status IN ('QUEUED', 'RETRY_SCHEDULED')
    AND job.attempt_count = 0
    AND job.input_set_digest IS NULL
    AND job.input_set_frozen_at IS NULL
    AND mmc.cam_v2_job_authority_is_active(job.id)
  FOR UPDATE;
  IF NOT FOUND OR v_consumer.assignment_id IS NULL OR v_consumer.subject_link_id IS NULL THEN
    RAISE EXCEPTION 'consumer job is not an active exact-scope handoff target' USING ERRCODE = '42501';
  END IF;
  v_consumer_expected_version := mmc.cam_v2_lock_job_mutation_authority(
    v_consumer.id, 'mmc.worker.complete', 'HANDOFF_TARGET'
  );
  IF v_consumer_expected_version IS NULL THEN
    RAISE EXCEPTION 'consumer job durable authority changed before handoff' USING ERRCODE = '42501';
  END IF;

  IF (v_kind = 'SOURCE_ASSET' AND (
       v_producer.job_kind <> 'ASSET_ACQUISITION'
       OR v_consumer.job_kind <> 'TRANSCRIPT_PROCESSING'
     )) OR (v_kind = 'TRANSCRIPT_VERSION' AND (
       v_producer.job_kind <> 'TRANSCRIPT_PROCESSING'
       OR v_consumer.job_kind <> 'AI_ANALYSIS'
     )) THEN
    RAISE EXCEPTION 'job input stage transition is not authorized' USING ERRCODE = '23514';
  END IF;

  IF v_kind = 'SOURCE_ASSET' THEN
    SELECT source.authority_grant_id INTO v_input_authority_grant_id
    FROM mmc.cam_v2_source_assets AS source
    WHERE source.tenant_id = v_producer.tenant_id
      AND source.environment = v_producer.environment
      AND source.id = p_input_id
      AND source.job_id = v_producer.id
      AND source.assignment_id = v_producer.assignment_id
      AND source.subject_link_id = v_producer.subject_link_id
      AND source.asset_state IN ('PAIR_VERIFIED', 'ATTACHED', 'RETAINED')
    FOR UPDATE;
  ELSE
    SELECT transcript.authority_grant_id INTO v_input_authority_grant_id
    FROM mmc.cam_v2_transcript_versions AS transcript
    WHERE transcript.tenant_id = v_producer.tenant_id
      AND transcript.environment = v_producer.environment
      AND transcript.id = p_input_id
      AND transcript.job_id = v_producer.id
      AND transcript.assignment_id = v_producer.assignment_id
      AND transcript.subject_link_id = v_producer.subject_link_id
      AND transcript.transcript_state = 'VERIFIED'
    FOR UPDATE;
  END IF;
  IF v_input_authority_grant_id IS NULL
     OR v_input_authority_grant_id IS DISTINCT FROM v_producer.authority_grant_id THEN
    RAISE EXCEPTION 'input was not created by the exact signed producer job' USING ERRCODE = '42501';
  END IF;

  IF mmc.cam_v2_lock_job_mutation_authority(
       v_producer.id, 'mmc.worker.complete', 'CURRENT_LEASE'
     ) IS DISTINCT FROM v_expected_version
     OR mmc.cam_v2_lock_job_mutation_authority(
       v_consumer.id, 'mmc.worker.complete', 'HANDOFF_TARGET'
     ) IS DISTINCT FROM v_consumer_expected_version THEN
    RAISE EXCEPTION 'producer or consumer authority changed before edge insertion' USING ERRCODE = '40001';
  END IF;

  INSERT INTO mmc.cam_v2_job_inputs (
    tenant_id, environment, consumer_job_id, producer_job_id,
    consumer_authority_grant_id, producer_authority_grant_id,
    assignment_id, subject_link_id, input_kind, source_asset_id, transcript_version_id
  ) VALUES (
    v_producer.tenant_id, v_producer.environment, v_consumer.id, v_producer.id,
    v_consumer.authority_grant_id, v_input_authority_grant_id,
    v_producer.assignment_id, v_producer.subject_link_id, v_kind,
    CASE WHEN v_kind = 'SOURCE_ASSET' THEN p_input_id ELSE NULL END,
    CASE WHEN v_kind = 'TRANSCRIPT_VERSION' THEN p_input_id ELSE NULL END
  )
  ON CONFLICT (
    tenant_id, environment, consumer_job_id, input_kind, source_asset_id, transcript_version_id
  ) DO NOTHING
  RETURNING id INTO v_edge_id;

  IF v_edge_id IS NULL THEN
    SELECT input.id INTO v_edge_id
    FROM mmc.cam_v2_job_inputs AS input
    WHERE input.tenant_id = v_producer.tenant_id
      AND input.environment = v_producer.environment
      AND input.consumer_job_id = v_consumer.id
      AND input.input_kind = v_kind
      AND input.source_asset_id IS NOT DISTINCT FROM
        CASE WHEN v_kind = 'SOURCE_ASSET' THEN p_input_id ELSE NULL END
      AND input.transcript_version_id IS NOT DISTINCT FROM
        CASE WHEN v_kind = 'TRANSCRIPT_VERSION' THEN p_input_id ELSE NULL END;
  END IF;
  RETURN v_edge_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Least-privilege runtime grants. Authenticated principals receive SELECT only;
-- every mutation is reserved for a separately reviewed SECURITY DEFINER RPC.
-- ---------------------------------------------------------------------------

REVOKE ALL PRIVILEGES ON TABLE
  mmc.cam_v2_tenants, mmc.cam_v2_principals, mmc.cam_v2_subject_links,
  mmc.cam_v2_assignments, mmc.cam_v2_policy_versions, mmc.cam_v2_authority_grants,
  mmc.cam_v2_command_receipts, mmc.cam_v2_idempotency_records, mmc.cam_v2_jobs,
  mmc.cam_v2_sessions, mmc.cam_v2_tasks, mmc.cam_v2_commitments, mmc.cam_v2_goals,
  mmc.cam_v2_milestones, mmc.cam_v2_student_statements, mmc.cam_v2_student_responses,
  mmc.cam_v2_source_assets, mmc.cam_v2_transcript_versions, mmc.cam_v2_job_inputs, mmc.cam_v2_evidence_spans,
  mmc.cam_v2_analysis_runs, mmc.cam_v2_ai_proposals, mmc.cam_v2_review_decisions,
  mmc.cam_v2_publications, mmc.cam_v2_publication_items, mmc.cam_v2_outbox_events,
  mmc.cam_v2_consumer_effects, mmc.cam_v2_consumer_inbox,
  mmc.cam_v2_lineage_edges, mmc.cam_v2_audit_events,
  mmc.cam_v2_cutover_states
FROM PUBLIC, anon, authenticated;

GRANT USAGE ON SCHEMA mmc TO authenticated;

GRANT SELECT ON TABLE
  mmc.cam_v2_tenants, mmc.cam_v2_principals, mmc.cam_v2_subject_links,
  mmc.cam_v2_assignments, mmc.cam_v2_policy_versions, mmc.cam_v2_authority_grants,
  mmc.cam_v2_command_receipts, mmc.cam_v2_idempotency_records, mmc.cam_v2_jobs,
  mmc.cam_v2_sessions, mmc.cam_v2_tasks, mmc.cam_v2_commitments, mmc.cam_v2_goals,
  mmc.cam_v2_milestones, mmc.cam_v2_student_statements, mmc.cam_v2_student_responses,
  mmc.cam_v2_source_assets, mmc.cam_v2_transcript_versions, mmc.cam_v2_job_inputs, mmc.cam_v2_evidence_spans,
  mmc.cam_v2_analysis_runs, mmc.cam_v2_ai_proposals, mmc.cam_v2_review_decisions,
  mmc.cam_v2_publications, mmc.cam_v2_publication_items, mmc.cam_v2_outbox_events,
  mmc.cam_v2_consumer_effects, mmc.cam_v2_consumer_inbox,
  mmc.cam_v2_lineage_edges, mmc.cam_v2_audit_events,
  mmc.cam_v2_cutover_states
TO authenticated;

REVOKE ALL ON FUNCTION mmc.cam_v2_claim_job(text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION mmc.cam_v2_heartbeat_job(uuid, bigint, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION mmc.cam_v2_record_external_dispatch_intent(uuid, bigint, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION mmc.cam_v2_record_external_result(uuid, bigint, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION mmc.cam_v2_reconcile_expired_external_result(uuid, bigint, text, text, integer, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION mmc.cam_v2_complete_job(uuid, bigint, text, text, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION mmc.cam_v2_cancel_inactive_job(uuid, bigint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION mmc.cam_v2_claim_outbox(text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION mmc.cam_v2_heartbeat_outbox(uuid, bigint, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION mmc.cam_v2_record_inbox_effect(uuid, text, text, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION mmc.cam_v2_complete_outbox(uuid, bigint, text, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION mmc.cam_v2_dead_letter_inactive_outbox(uuid, bigint, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION mmc.cam_v2_register_job_input(uuid, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION mmc.cam_v2_claim_job(text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION mmc.cam_v2_heartbeat_job(uuid, bigint, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION mmc.cam_v2_record_external_dispatch_intent(uuid, bigint, text) TO authenticated;
GRANT EXECUTE ON FUNCTION mmc.cam_v2_record_external_result(uuid, bigint, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION mmc.cam_v2_reconcile_expired_external_result(uuid, bigint, text, text, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION mmc.cam_v2_complete_job(uuid, bigint, text, text, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION mmc.cam_v2_cancel_inactive_job(uuid, bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION mmc.cam_v2_claim_outbox(text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION mmc.cam_v2_heartbeat_outbox(uuid, bigint, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION mmc.cam_v2_record_inbox_effect(uuid, text, text, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION mmc.cam_v2_complete_outbox(uuid, bigint, text, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION mmc.cam_v2_dead_letter_inactive_outbox(uuid, bigint, text) TO authenticated;
GRANT EXECUTE ON FUNCTION mmc.cam_v2_register_job_input(uuid, text, uuid) TO authenticated;

-- Internal SECURITY DEFINER mutation gates and trigger bodies are never a
-- callable runtime API. Only the audited outer RPCs above may execute them.
REVOKE ALL ON FUNCTION mmc.cam_v2_lock_job_mutation_authority(uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION mmc.cam_v2_job_durable_authority_is_active(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION mmc.cam_v2_job_inputs_potentially_ready(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION mmc.cam_v2_lock_ready_job_input_digest(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION mmc.cam_v2_assert_exact_success_handoff(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION mmc.cam_v2_terminal_reconciliation_replay(uuid, bigint, text, text, integer, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION mmc.cam_v2_terminal_outbox_completion_replay(uuid, bigint, text, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION mmc.cam_v2_lock_outbox_delivery(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION mmc.cam_v2_terminal_completion_replay(uuid, bigint, text, text, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION mmc.cam_v2_enforce_job_provider_config_immutable() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION mmc.cam_v2_enforce_idempotency_receipt_semantics() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION mmc.cam_v2_enforce_unfrozen_job_input() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION mmc.cam_v2_reject_job_input_mutation() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION mmc.cam_v2_enforce_handoff_artifact_immutable() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION mmc.cam_v2_enforce_optional_provenance_scope() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION mmc.cam_v2_enforce_publication_item_source() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION mmc.cam_v2_enforce_publication_seal() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION mmc.cam_v2_enforce_publication_final_coherence() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION mmc.cam_v2_enforce_student_authorship_and_target() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION mmc.cam_v2_lock_audit_chain(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION mmc.cam_v2_seal_audit_event() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION mmc.cam_v2_reject_audit_mutation() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION mmc.cam_v2_append_runtime_audit(text, text, text, uuid, uuid, uuid, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION mmc.cam_v2_audit_runtime_mutation() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION mmc.cam_v2_enforce_principal_roles() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION mmc.cam_v2_enforce_immutable_columns() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION mmc.cam_v2_reject_durable_mutation() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION mmc.cam_v2_enforce_principal_lifecycle() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION mmc.cam_v2_enforce_subject_link_lifecycle() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION mmc.cam_v2_enforce_assignment_lifecycle() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION mmc.cam_v2_enforce_policy_lifecycle() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION mmc.cam_v2_enforce_authority_grant_lifecycle() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION mmc.cam_v2_enforce_versioned_update() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION mmc.cam_v2_enforce_forward_state() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION mmc.cam_v2_enforce_job_lease_transition() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION mmc.cam_v2_enforce_job_success_evidence() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION mmc.cam_v2_enforce_outbox_delivered_effect() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION mmc.cam_v2_enforce_tenant_lifecycle() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION mmc.cam_v2_enforce_command_receipt_lifecycle() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION mmc.cam_v2_enforce_lineage_lifecycle() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION mmc.cam_v2_resolve_lineage_endpoint(uuid, text, text, uuid, bigint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION mmc.cam_v2_enforce_lineage_endpoints() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION mmc.cam_v2_guard_active_lineage_endpoint_version() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION mmc.cam_v2_enforce_cutover_lifecycle() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION mmc.cam_v2_lock_active_publication_authority(uuid, text, uuid, uuid, uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION mmc.cam_v2_lock_active_publication_student(uuid, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION mmc.cam_v2_enforce_publication_authority() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION mmc.cam_v2_enforce_review_decision_authority() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION mmc.cam_v2_enforce_ai_approved_decision() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION mmc.cam_v2_enforce_command_actor_role() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION mmc.cam_v2_enforce_consumer_effect_binding() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION mmc.cam_v2_outbox_origin_is_active(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION mmc.cam_v2_lock_outbox_origin_active(uuid) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION mmc.cam_v2_actor_is_active(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION mmc.cam_v2_mentor_can_access(uuid, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION mmc.cam_v2_student_owns_subject(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION mmc.cam_v2_plane_is_enabled(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION mmc.cam_v2_job_authority_is_active(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION mmc.cam_v2_worker_row_matches_job(uuid, uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION mmc.cam_v2_worker_can_read_input(uuid, text, uuid, uuid, uuid, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION mmc.cam_v2_outbox_lease_matches(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION mmc.cam_v2_actor_is_active(text) TO authenticated;
GRANT EXECUTE ON FUNCTION mmc.cam_v2_mentor_can_access(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION mmc.cam_v2_student_owns_subject(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION mmc.cam_v2_plane_is_enabled(text) TO authenticated;
GRANT EXECUTE ON FUNCTION mmc.cam_v2_job_authority_is_active(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION mmc.cam_v2_worker_row_matches_job(uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION mmc.cam_v2_worker_can_read_input(uuid, text, uuid, uuid, uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION mmc.cam_v2_outbox_lease_matches(uuid, text) TO authenticated;

COMMIT;
