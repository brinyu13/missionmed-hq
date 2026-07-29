BEGIN;
DROP FUNCTION IF EXISTS public.sf_attach_recording(uuid, uuid, text);
DROP FUNCTION IF EXISTS public.sf_retire_story_audio(uuid);
DROP FUNCTION IF EXISTS public.sf_voice_audio_reference_check(text[]);
DROP FUNCTION IF EXISTS public.sf_voice_asset_mark_failed(uuid);
DROP FUNCTION IF EXISTS public.sf_voice_asset_mark_verified(uuid, bigint, text);
DROP FUNCTION IF EXISTS public.sf_voice_asset_pending_candidates(integer);
DROP FUNCTION IF EXISTS public.sf_voice_sweep_purge(uuid, text);
DROP FUNCTION IF EXISTS public.sf_voice_sweep_candidates(integer);
DROP INDEX IF EXISTS public.sf_audit_error_category_idx;
DROP FUNCTION IF EXISTS public.sf_voice_error_summary();
DROP FUNCTION IF EXISTS public.sf_feature_audit_tail(integer);
DROP FUNCTION IF EXISTS public.sf_append_voice_audit_service(text, text, uuid, uuid, uuid, jsonb, jsonb);
DROP FUNCTION IF EXISTS public.sf_append_voice_audit(text, text, uuid, text, uuid, uuid, jsonb, jsonb);
DROP FUNCTION IF EXISTS public.sf_voice_audit_payload_ok(jsonb);
COMMIT;
-- Audit rows already written are append-only history and are retained.
