-- Migration: 20261004063954_iiq_1204_rise_current_rights.sql
-- Authority: IIQ-1204 / DR-373 / DR-370
-- Date: 2026-10-04
-- Depends on: 005_rights_safe_runtime.sql, 007_canonical_evidence_bridge.sql
-- Description: Expand release metadata for the existing approved commercial grant.
-- Idempotent: NO; exact replay is handled by the guarded registration runner.
-- No rows, columns, tables, IDs, grants or historical migrations are removed.
BEGIN;

ALTER TABLE rise_runtime.registry_releases
  DROP CONSTRAINT registry_releases_projection_check,
  ADD CONSTRAINT registry_releases_projection_check
    CHECK (projection IN ('STUDENT_RIGHTS_SAFE_RISE','SOURCE_CONTROLLED_REGISTRY')),
  DROP CONSTRAINT registry_releases_projection_check1,
  ADD CONSTRAINT registry_releases_projection_check1
    CHECK (projection IN ('STUDENT_RIGHTS_SAFE_RISE','SOURCE_CONTROLLED_REGISTRY'));

ALTER TABLE rise_runtime.release_source_rights
  DROP CONSTRAINT release_source_rights_authorization_basis_check,
  ADD CONSTRAINT release_source_rights_authorization_basis_check
    CHECK (authorization_basis IN ('government_public_domain_factual_projection',
      'bounded_historical_cycle_projection','written_commercial_data_grant'));

CREATE TABLE rise_runtime.iiq_registry_registration_history (
  name text PRIMARY KEY,
  sql_sha256 text NOT NULL CHECK (sql_sha256 ~ '^[a-f0-9]{64}$'),
  bundle_sha256 text NOT NULL CHECK (bundle_sha256 ~ '^[a-f0-9]{64}$'),
  before_sha256 text NOT NULL CHECK (before_sha256 ~ '^[a-f0-9]{64}$'),
  after_sha256 text NOT NULL CHECK (after_sha256 ~ '^[a-f0-9]{64}$'),
  applied_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE rise_runtime.iiq_registry_registration_history OWNER TO postgres;
ALTER TABLE rise_runtime.iiq_registry_registration_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE rise_runtime.iiq_registry_registration_history FORCE ROW LEVEL SECURITY;
REVOKE ALL ON rise_runtime.iiq_registry_registration_history FROM PUBLIC, rise_app_runtime, rise_app_login;

COMMIT;
