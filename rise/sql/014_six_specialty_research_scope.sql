BEGIN;

ALTER TABLE rise_runtime.research_router_settings
  DROP CONSTRAINT IF EXISTS research_router_settings_canary_mode_check;

ALTER TABLE rise_runtime.research_router_settings
  ADD CONSTRAINT research_router_settings_canary_mode_check
  CHECK (canary_mode IN ('PROGRAM_ID_ALLOWLIST', 'SPECIALTY_SCOPE'));

COMMIT;
