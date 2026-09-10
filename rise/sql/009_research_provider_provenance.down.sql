-- Rehearsal-only rollback. It refuses to erase or relabel Sonnet evidence.

BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM rise_runtime.canonical_evidence_sources WHERE provider = 'CLAUDE_SONNET'
    UNION ALL
    SELECT 1 FROM rise_runtime.provider_ingest_runs WHERE provider = 'CLAUDE_SONNET'
  ) THEN
    RAISE EXCEPTION 'Cannot remove CLAUDE_SONNET provider while preserved evidence exists';
  END IF;
END
$$;

ALTER TABLE rise_runtime.canonical_evidence_sources
  DROP CONSTRAINT canonical_evidence_sources_provider_check;
ALTER TABLE rise_runtime.canonical_evidence_sources
  ADD CONSTRAINT canonical_evidence_sources_provider_check
  CHECK (provider IN ('PARALLEL', 'CLAUDE_OPUS', 'NRMP_SOAP_CLOSURE', 'STUDENT_INTEL'));

ALTER TABLE rise_runtime.provider_ingest_runs
  DROP CONSTRAINT provider_ingest_runs_provider_check;
ALTER TABLE rise_runtime.provider_ingest_runs
  ADD CONSTRAINT provider_ingest_runs_provider_check
  CHECK (provider IN ('PARALLEL', 'CLAUDE_OPUS', 'NRMP_SOAP_CLOSURE'));

COMMIT;
