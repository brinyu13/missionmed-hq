BEGIN;
DROP FUNCTION IF EXISTS public.sf_reconciliation_sweep_old_runs();
DROP FUNCTION IF EXISTS public.sf_reconciliation_report(integer);
DROP POLICY IF EXISTS sf_reconciliation_state_service ON public.sf_reconciliation_state;
DROP TABLE IF EXISTS public.sf_reconciliation_state;
DROP POLICY IF EXISTS sf_reconciliation_runs_service ON public.sf_reconciliation_runs;
DROP TABLE IF EXISTS public.sf_reconciliation_runs;
DROP POLICY IF EXISTS sf_deletion_intents_service ON public.sf_audio_deletion_intents;
DROP TABLE IF EXISTS public.sf_audio_deletion_intents;
-- sf_append_voice_audit_service and sf_voice_audit_payload_ok are replaced
-- (not dropped): if rollback of the action-list expansion is needed, re-apply
-- the M3 version of those functions from B1-506A_EXECUTABLE_SQL_AND_CONTRACTS.md.
-- Audit rows already written are append-only history and are retained.
COMMIT;
