-- Migration: 20260428053000_mr_stat_human_async_duel_opponent_lookup_500c.sql
-- Prompt: (E8)-STAT+Async-codex-high-500-c
-- Purpose: Human-usable async duel opponent lookup for exact email or UUID.
-- Scope: STAT async duel only.
-- Idempotent: YES

BEGIN;

CREATE OR REPLACE FUNCTION public.resolve_duel_opponent(identifier text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_identifier text := lower(nullif(btrim(coalesce(identifier, '')), ''));
  v_target_user_id uuid;
  v_identifier_type text := 'uuid';
  v_display_name text;
  v_email text;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'auth_required';
  END IF;

  IF v_identifier IS NULL THEN
    RETURN jsonb_build_object('status', 'error', 'code', 'identifier_required');
  END IF;

  IF v_identifier ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
    v_target_user_id := v_identifier::uuid;
    v_identifier_type := 'uuid';
  ELSIF v_identifier ~* '^[^\s@]+@[^\s@]+\.[^\s@]+$' THEN
    v_identifier_type := 'email';

    SELECT p.id,
           lower(nullif(btrim(p.email), '')),
           nullif(btrim(pp.display_name), '')
      INTO v_target_user_id, v_email, v_display_name
      FROM public.profiles p
      LEFT JOIN public.player_profiles pp
        ON pp.player_id = p.id
     WHERE lower(p.email) = v_identifier
     LIMIT 1;

    IF v_target_user_id IS NULL THEN
      SELECT u.id,
             lower(nullif(btrim(u.email), ''))
        INTO v_target_user_id, v_email
        FROM auth.users u
       WHERE lower(u.email) = v_identifier
       LIMIT 1;
    END IF;
  ELSE
    RETURN jsonb_build_object('status', 'error', 'code', 'invalid_identifier_format');
  END IF;

  IF v_target_user_id IS NULL THEN
    RETURN jsonb_build_object('status', 'error', 'code', 'opponent_not_found');
  END IF;

  IF v_target_user_id = v_actor THEN
    RETURN jsonb_build_object('status', 'error', 'code', 'self_not_allowed');
  END IF;

  PERFORM public.ensure_player_profile(v_target_user_id);

  IF v_display_name IS NULL THEN
    SELECT nullif(btrim(pp.display_name), '')
      INTO v_display_name
      FROM public.player_profiles pp
     WHERE pp.player_id = v_target_user_id;
  END IF;

  IF v_email IS NULL THEN
    SELECT lower(nullif(btrim(p.email), ''))
      INTO v_email
      FROM public.profiles p
     WHERE p.id = v_target_user_id
     LIMIT 1;
  END IF;

  RETURN jsonb_build_object(
    'status', 'ok',
    'user_id', v_target_user_id,
    'display_label', coalesce(v_display_name, v_email, v_target_user_id::text),
    'identifier_type', v_identifier_type
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.resolve_duel_opponent(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.resolve_duel_opponent(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.resolve_duel_opponent(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_duel_opponent(text) TO service_role;

COMMENT ON FUNCTION public.resolve_duel_opponent(text)
IS 'Resolves STAT async duel opponent by exact UUID or exact email for authenticated callers. Returns only user_id + display label.';

COMMIT;
