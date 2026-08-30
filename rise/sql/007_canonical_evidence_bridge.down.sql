-- P1-RISE-5008 recoverable application rollback.
-- Preserve all canonical identities, evidence, provenance, rights, and ingest
-- receipts. Disable access for an older application; never drop data.

BEGIN;

REVOKE ALL ON rise_runtime.release_source_rights FROM rise_app_runtime;
REVOKE ALL ON rise_runtime.canonical_evidence_sources FROM rise_app_runtime;
REVOKE ALL ON rise_runtime.canonical_evidence_claims FROM rise_app_runtime;
REVOKE ALL ON rise_runtime.canonical_program_identities FROM rise_app_runtime;
REVOKE ALL ON rise_runtime.provider_ingest_runs FROM rise_app_runtime;
REVOKE ALL ON rise_runtime.canonical_current_facts FROM rise_app_runtime;

COMMIT;
