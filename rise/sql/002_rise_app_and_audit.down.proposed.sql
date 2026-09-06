-- Production-safe rollback posture for 002_rise_app_and_audit.proposed.sql.
-- Preserve sessions, consent receipts, audit history, and recovery evidence.

BEGIN;
DO $$
BEGIN
  RAISE EXCEPTION 'RISE app/audit rollback is intentionally fail-closed; revoke access and restore an approved prior service release instead';
END
$$;
ROLLBACK;
