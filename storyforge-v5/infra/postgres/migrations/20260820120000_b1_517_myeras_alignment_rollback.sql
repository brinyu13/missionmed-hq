\set ON_ERROR_STOP on

-- B1-517 rollback intentionally preserves the widened CHECK constraints and all
-- additive tables. Existing MyERAS rows and authored versions must never be
-- destroyed to make an older runtime deployable. Disable all six flags, deploy
-- the prior runtime, and retain the additive data for forward recovery.
--
-- The two version functions may be restored to their pre-B1-517 key guards only
-- after flags are off; existing four-key rows remain readable by list/history.
-- This file performs no automatic destructive or narrowing operation.

BEGIN;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.sf_feature_flags WHERE key=ANY(ARRAY[
    'eras_taxonomy','myeras_workspace','clinical_case_metadata','use_ranking','myeras_versions','ai_condensation'
  ]) AND scope<>'off') THEN
    RAISE EXCEPTION 'turn every B1-517 flag off before runtime rollback' USING ERRCODE='55000';
  END IF;
END $$;
COMMIT;
