-- =============================================================================
-- MMC-020 rollback/down script for staging/local only
-- =============================================================================
-- Supabase migrations in this repo are up-only. This script is intentionally
-- separate from the applied migration and must never be run against production.
-- It removes only the mmc schema created by MMC-020.
-- =============================================================================

BEGIN;

DO $$
DECLARE
  v_target text := lower(coalesce(current_setting('mmc.schema_build_target', true), ''));
BEGIN
  IF v_target NOT IN ('local', 'staging', 'ci') THEN
    RAISE EXCEPTION
      'MMC-020 rollback is staging/local only. Set mmc.schema_build_target to local, staging, or ci in this session before applying.';
  END IF;
END $$;

DROP SCHEMA IF EXISTS mmc CASCADE;

COMMIT;
