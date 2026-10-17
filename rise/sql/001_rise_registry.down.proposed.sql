-- Production-safe rollback posture for 001_rise_registry.proposed.sql.
-- RISE releases are rolled back by reactivating a previously verified immutable
-- release. Schema deletion is intentionally not automated because it would
-- destroy provenance and audit history.

BEGIN;
DO $$
BEGIN
  RAISE EXCEPTION 'RISE schema rollback is intentionally fail-closed; reactivate a verified release instead';
END
$$;
ROLLBACK;
