-- Production-safe rollback posture for 003_rise_release_security_hardening.
-- Removing release-evidence, session-binding, or audit-chain guards would weaken
-- security and provenance, so rollback is intentionally service-level only.

DO $$
BEGIN
  RAISE EXCEPTION 'RISE security-hardening rollback is intentionally fail-closed; restore a verified prior service and database backup instead';
END;
$$;
