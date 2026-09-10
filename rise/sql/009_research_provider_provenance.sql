-- P1-RISE-5012B preserves the actual provider/model provenance of the completed
-- zero-spend Sonnet substitute campaign. No evidence is promoted by this change.

BEGIN;

ALTER TABLE rise_runtime.canonical_evidence_sources
  DROP CONSTRAINT canonical_evidence_sources_provider_check;
ALTER TABLE rise_runtime.canonical_evidence_sources
  ADD CONSTRAINT canonical_evidence_sources_provider_check
  CHECK (provider IN ('PARALLEL', 'CLAUDE_OPUS', 'CLAUDE_SONNET', 'NRMP_SOAP_CLOSURE', 'STUDENT_INTEL'));

ALTER TABLE rise_runtime.provider_ingest_runs
  DROP CONSTRAINT provider_ingest_runs_provider_check;
ALTER TABLE rise_runtime.provider_ingest_runs
  ADD CONSTRAINT provider_ingest_runs_provider_check
  CHECK (provider IN ('PARALLEL', 'CLAUDE_OPUS', 'CLAUDE_SONNET', 'NRMP_SOAP_CLOSURE'));

COMMIT;
