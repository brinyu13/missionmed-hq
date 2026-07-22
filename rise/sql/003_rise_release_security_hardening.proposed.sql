-- P1-RISE-4006 proposed release-evidence and audit-chain hardening.
-- Apply only after 001 and 002 in a dedicated, disposable RISE rehearsal.
-- This file is not approved for any shared or production database.

BEGIN;

DO $roles$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'rise_registry_governance_manager') THEN
    CREATE ROLE rise_registry_governance_manager NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'rise_registry_validator') THEN
    CREATE ROLE rise_registry_validator NOLOGIN;
  END IF;
END
$roles$;

ALTER TABLE rise.registry_releases
  ADD COLUMN data_classification text,
  ADD COLUMN source_authorization_set_sha256 char(64),
  ADD CONSTRAINT rise_registry_release_data_classification_check
    CHECK (data_classification IN ('source_controlled_registry', 'synthetic_test_fixture')),
  ADD CONSTRAINT rise_registry_release_authorization_set_check
    CHECK (
      source_authorization_set_sha256 IS NULL
      OR source_authorization_set_sha256 ~ '^[0-9a-f]{64}$'
    ),
  ADD CONSTRAINT rise_registry_release_authorization_identity_unique
    UNIQUE (release_id, source_authorization_set_sha256);

CREATE TABLE rise.source_authorization_receipts (
  release_id text NOT NULL,
  source_authority text NOT NULL CHECK (btrim(source_authority) <> ''),
  source_authorization_set_sha256 char(64) NOT NULL CHECK (source_authorization_set_sha256 ~ '^[0-9a-f]{64}$'),
  authorization_basis text NOT NULL CHECK (authorization_basis IN (
    'written_source_owner_grant', 'public_official_source_approval', 'missionmed_owned'
  )),
  authorization_sha256 char(64) NOT NULL CHECK (authorization_sha256 ~ '^[0-9a-f]{64}$'),
  source_owner_grant_sha256 char(64),
  decision_record_id text NOT NULL CHECK (btrim(decision_record_id) <> ''),
  verified_by_subject text NOT NULL CHECK (btrim(verified_by_subject) <> ''),
  verified_at timestamptz NOT NULL,
  valid_through date NOT NULL,
  revoked_at timestamptz,
  PRIMARY KEY (release_id, source_authority),
  FOREIGN KEY (release_id, source_authorization_set_sha256)
    REFERENCES rise.registry_releases (release_id, source_authorization_set_sha256),
  CHECK (
    (authorization_basis = 'written_source_owner_grant'
      AND source_owner_grant_sha256 IS NOT NULL
      AND source_owner_grant_sha256 ~ '^[0-9a-f]{64}$')
    OR (authorization_basis <> 'written_source_owner_grant' AND source_owner_grant_sha256 IS NULL)
  ),
  CHECK (revoked_at IS NULL OR revoked_at >= verified_at)
);

ALTER TABLE rise.source_authorization_receipts
  ADD CONSTRAINT rise_source_authorization_receipt_identity_unique
  UNIQUE (release_id, source_authority, authorization_sha256);

CREATE TABLE rise.source_authorization_revocations (
  release_id text NOT NULL,
  source_authority text NOT NULL,
  authorization_sha256 char(64) NOT NULL CHECK (authorization_sha256 ~ '^[0-9a-f]{64}$'),
  decision_record_id text NOT NULL CHECK (btrim(decision_record_id) <> ''),
  recorded_by_subject text NOT NULL CHECK (btrim(recorded_by_subject) <> ''),
  revoked_at timestamptz NOT NULL,
  reason text NOT NULL CHECK (btrim(reason) <> ''),
  PRIMARY KEY (release_id, source_authority),
  FOREIGN KEY (release_id, source_authority, authorization_sha256)
    REFERENCES rise.source_authorization_receipts (
      release_id, source_authority, authorization_sha256
    )
);

CREATE TABLE rise.release_validation_receipts (
  release_id text PRIMARY KEY,
  validation_status text NOT NULL CHECK (validation_status = 'passed'),
  release_manifest_sha256 char(64) NOT NULL CHECK (release_manifest_sha256 ~ '^[0-9a-f]{64}$'),
  api_index_sha256 char(64) NOT NULL CHECK (api_index_sha256 ~ '^[0-9a-f]{64}$'),
  index_manifest_sha256 char(64) NOT NULL CHECK (index_manifest_sha256 ~ '^[0-9a-f]{64}$'),
  source_authorization_set_sha256 char(64) NOT NULL CHECK (source_authorization_set_sha256 ~ '^[0-9a-f]{64}$'),
  validator_version text NOT NULL CHECK (btrim(validator_version) <> ''),
  validation_summary jsonb NOT NULL CHECK (jsonb_typeof(validation_summary) = 'object'),
  validated_by_subject text NOT NULL CHECK (btrim(validated_by_subject) <> ''),
  validated_at timestamptz NOT NULL,
  FOREIGN KEY (release_id, source_authorization_set_sha256)
    REFERENCES rise.registry_releases (release_id, source_authorization_set_sha256)
);

CREATE OR REPLACE FUNCTION rise.enforce_registry_release_immutability()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, rise
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'RISE registry releases cannot be deleted'
      USING ERRCODE = '55000';
  END IF;
  IF NEW.release_id IS DISTINCT FROM OLD.release_id
    OR NEW.source_snapshot_id IS DISTINCT FROM OLD.source_snapshot_id
    OR NEW.source_sha256 IS DISTINCT FROM OLD.source_sha256
    OR NEW.immutable IS DISTINCT FROM OLD.immutable
    OR NEW.counts IS DISTINCT FROM OLD.counts
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
    OR NEW.data_classification IS DISTINCT FROM OLD.data_classification
    OR NEW.source_authorization_set_sha256 IS DISTINCT FROM OLD.source_authorization_set_sha256 THEN
    RAISE EXCEPTION 'RISE immutable release identity, source, authorization, counts, and creation metadata cannot change'
      USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION rise.enforce_release_activation_evidence()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, rise
AS $$
DECLARE
  v_validation rise.release_validation_receipts%ROWTYPE;
BEGIN
  IF NEW.activation_status <> 'active' OR OLD.activation_status = 'active' THEN
    RETURN NEW;
  END IF;
  IF NEW.data_classification IS DISTINCT FROM 'source_controlled_registry' THEN
    RAISE EXCEPTION 'RISE production activation requires a source-controlled registry release'
      USING ERRCODE = '55000';
  END IF;
  IF NEW.source_authorization_set_sha256 IS NULL THEN
    RAISE EXCEPTION 'RISE production activation requires a source-authorization set hash'
      USING ERRCODE = '55000';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM rise.source_documents WHERE release_id = NEW.release_id
  ) THEN
    RAISE EXCEPTION 'RISE production activation requires at least one source document'
      USING ERRCODE = '55000';
  END IF;

  SELECT * INTO v_validation
    FROM rise.release_validation_receipts
    WHERE release_id = NEW.release_id;
  IF NOT FOUND
    OR v_validation.validation_status <> 'passed'
    OR v_validation.source_authorization_set_sha256 IS DISTINCT FROM NEW.source_authorization_set_sha256
    OR v_validation.validated_at > now() THEN
    RAISE EXCEPTION 'RISE release validation evidence is missing or does not match authorization lineage'
      USING ERRCODE = '55000';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM (
        SELECT DISTINCT source_authority.authority
          FROM rise.source_documents AS source_authority
          WHERE source_authority.release_id = NEW.release_id
      ) AS required_source
      LEFT JOIN rise.source_authorization_receipts AS auth_receipt
        ON auth_receipt.release_id = NEW.release_id
       AND auth_receipt.source_authority = required_source.authority
      LEFT JOIN rise.source_authorization_revocations AS auth_revocation
        ON auth_revocation.release_id = auth_receipt.release_id
       AND auth_revocation.source_authority = auth_receipt.source_authority
       AND auth_revocation.authorization_sha256 = auth_receipt.authorization_sha256
      WHERE auth_receipt.release_id IS NULL
         OR auth_receipt.source_authorization_set_sha256 IS DISTINCT FROM NEW.source_authorization_set_sha256
         OR auth_receipt.verified_at > now()
         OR auth_receipt.revoked_at IS NOT NULL
         OR auth_receipt.valid_through < current_date
         OR auth_revocation.release_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'RISE release has a missing, expired, or revoked source authorization receipt'
      USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER rise_registry_release_activation_evidence
  BEFORE UPDATE OF activation_status ON rise.registry_releases
  FOR EACH ROW EXECUTE FUNCTION rise.enforce_release_activation_evidence();

CREATE TRIGGER rise_source_authorization_receipts_open_release_insert
  BEFORE INSERT ON rise.source_authorization_receipts
  FOR EACH ROW EXECUTE FUNCTION rise.enforce_open_release_snapshot_insert();
CREATE TRIGGER rise_release_validation_receipts_open_release_insert
  BEFORE INSERT ON rise.release_validation_receipts
  FOR EACH ROW EXECUTE FUNCTION rise.enforce_open_release_snapshot_insert();
CREATE TRIGGER rise_source_authorization_receipts_append_only
  BEFORE UPDATE OR DELETE ON rise.source_authorization_receipts
  FOR EACH ROW EXECUTE FUNCTION rise.reject_snapshot_mutation();
CREATE TRIGGER rise_release_validation_receipts_append_only
  BEFORE UPDATE OR DELETE ON rise.release_validation_receipts
  FOR EACH ROW EXECUTE FUNCTION rise.reject_snapshot_mutation();
CREATE TRIGGER rise_source_authorization_revocations_append_only
  BEFORE UPDATE OR DELETE ON rise.source_authorization_revocations
  FOR EACH ROW EXECUTE FUNCTION rise.reject_snapshot_mutation();

ALTER TABLE rise_app.authorization_code_redemptions
  ADD CONSTRAINT rise_authorization_code_identity_unique
  UNIQUE (jti_sha256, subject_id, issuer, audience, role, capabilities);

ALTER TABLE rise_app.sessions
  DROP CONSTRAINT sessions_jti_sha256_fkey,
  ADD CONSTRAINT rise_sessions_authorization_identity_fkey
  FOREIGN KEY (jti_sha256, subject_id, issuer, audience, role, capabilities)
  REFERENCES rise_app.authorization_code_redemptions (
    jti_sha256, subject_id, issuer, audience, role, capabilities
  );

CREATE FUNCTION rise_app.reject_authorization_code_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, rise_app
AS $$
BEGIN
  RAISE EXCEPTION 'RISE authorization-code redemptions are immutable'
    USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER rise_authorization_code_redemptions_immutable
  BEFORE UPDATE OR DELETE ON rise_app.authorization_code_redemptions
  FOR EACH ROW EXECUTE FUNCTION rise_app.reject_authorization_code_mutation();

DO $audit_precondition$
BEGIN
  IF EXISTS (SELECT 1 FROM rise_audit.audit_events) THEN
    RAISE EXCEPTION 'RISE audit-chain hardening requires an empty audit table or a separately reviewed backfill'
      USING ERRCODE = '55000';
  END IF;
END
$audit_precondition$;

ALTER TABLE rise_audit.audit_events
  ADD COLUMN hash_algorithm text NOT NULL CHECK (hash_algorithm = 'hmac-sha256'),
  ADD COLUMN hash_key_id text NOT NULL CHECK (btrim(hash_key_id) <> ''),
  ADD CONSTRAINT rise_audit_event_sha256_unique UNIQUE (event_sha256),
  ADD CONSTRAINT rise_audit_previous_event_fkey
    FOREIGN KEY (previous_event_sha256) REFERENCES rise_audit.audit_events(event_sha256);

CREATE FUNCTION rise_audit.enforce_event_chain()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, rise_audit
AS $$
DECLARE
  v_previous_sha256 char(64);
  v_previous_occurred_at timestamptz;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('rise_audit_event_chain_v1'));
  SELECT event_sha256, occurred_at
    INTO v_previous_sha256, v_previous_occurred_at
    FROM rise_audit.audit_events
    ORDER BY occurred_at DESC, audit_event_id DESC
    LIMIT 1;
  IF NOT FOUND THEN
    IF NEW.previous_event_sha256 IS NOT NULL THEN
      RAISE EXCEPTION 'The first RISE audit event cannot name a predecessor'
        USING ERRCODE = '55000';
    END IF;
  ELSE
    IF NEW.previous_event_sha256 IS DISTINCT FROM v_previous_sha256 THEN
      RAISE EXCEPTION 'RISE audit predecessor is not the current chain head'
        USING ERRCODE = '40001';
    END IF;
    IF NEW.occurred_at < v_previous_occurred_at THEN
      RAISE EXCEPTION 'RISE audit timestamps must be monotonic'
        USING ERRCODE = '22007';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER rise_audit_events_chain_guard
  BEFORE INSERT ON rise_audit.audit_events
  FOR EACH ROW EXECUTE FUNCTION rise_audit.enforce_event_chain();

CREATE VIEW rise.current_authorized_release
WITH (security_barrier = true)
AS
SELECT active.active_release_id
  FROM rise.registry_active_release AS active
  JOIN rise.registry_releases AS release
    ON release.release_id = active.active_release_id
  WHERE active.singleton_key = true
    AND NOT EXISTS (
      SELECT 1
        FROM (
          SELECT DISTINCT source.authority
            FROM rise.source_documents AS source
            WHERE source.release_id = active.active_release_id
        ) AS required_source
        LEFT JOIN rise.source_authorization_receipts AS receipt
          ON receipt.release_id = active.active_release_id
         AND receipt.source_authority = required_source.authority
        LEFT JOIN rise.source_authorization_revocations AS revocation
          ON revocation.release_id = receipt.release_id
         AND revocation.source_authority = receipt.source_authority
         AND revocation.authorization_sha256 = receipt.authorization_sha256
        WHERE receipt.release_id IS NULL
           OR receipt.source_authorization_set_sha256 IS DISTINCT FROM release.source_authorization_set_sha256
           OR receipt.verified_at > now()
           OR receipt.revoked_at IS NOT NULL
           OR receipt.valid_through < current_date
           OR revocation.release_id IS NOT NULL
    );

CREATE VIEW rise.active_registry_release
WITH (security_barrier = true)
AS
SELECT release.*
  FROM rise.registry_releases AS release
  JOIN rise.current_authorized_release AS active
    ON active.active_release_id = release.release_id
  WHERE release.activation_status = 'active';

CREATE VIEW rise.active_programs WITH (security_barrier = true) AS
SELECT program.* FROM rise.programs AS program
JOIN rise.current_authorized_release AS active ON active.active_release_id = program.release_id;
CREATE VIEW rise.active_specialties WITH (security_barrier = true) AS
SELECT specialty.* FROM rise.specialties AS specialty
JOIN rise.current_authorized_release AS active ON active.active_release_id = specialty.release_id;
CREATE VIEW rise.active_program_specialties WITH (security_barrier = true) AS
SELECT offering.* FROM rise.program_specialties AS offering
JOIN rise.current_authorized_release AS active ON active.active_release_id = offering.release_id;
CREATE VIEW rise.active_browse_memberships WITH (security_barrier = true) AS
SELECT membership.* FROM rise.browse_memberships AS membership
JOIN rise.current_authorized_release AS active ON active.active_release_id = membership.release_id;
CREATE VIEW rise.active_claims WITH (security_barrier = true) AS
SELECT claim.* FROM rise.claims AS claim
JOIN rise.current_authorized_release AS active ON active.active_release_id = claim.release_id
WHERE claim.publication = 'source_attributed_snapshot';
CREATE VIEW rise.active_source_documents WITH (security_barrier = true) AS
SELECT source.* FROM rise.source_documents AS source
JOIN rise.current_authorized_release AS active ON active.active_release_id = source.release_id;

REVOKE SELECT ON ALL TABLES IN SCHEMA rise FROM rise_registry_reader;
REVOKE ALL ON rise.source_authorization_receipts, rise.source_authorization_revocations, rise.release_validation_receipts FROM PUBLIC;
GRANT USAGE ON SCHEMA rise TO rise_registry_governance_manager, rise_registry_validator;
GRANT SELECT, INSERT ON rise.source_authorization_receipts, rise.source_authorization_revocations TO rise_registry_governance_manager;
GRANT SELECT, INSERT ON rise.release_validation_receipts TO rise_registry_validator;
GRANT SELECT ON
  rise.active_registry_release,
  rise.active_programs,
  rise.active_specialties,
  rise.active_program_specialties,
  rise.active_browse_memberships,
  rise.active_claims,
  rise.active_source_documents
TO rise_registry_reader;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA rise FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA rise_app FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA rise_audit FROM PUBLIC;

COMMIT;
