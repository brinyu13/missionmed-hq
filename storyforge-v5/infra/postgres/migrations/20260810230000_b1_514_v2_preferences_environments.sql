\set ON_ERROR_STOP on

-- Migration: B1-514 V2 theme and approved environment preferences.
-- Authority: DR-042 / accepted B1-513R2 presentation contract.
-- Depends on: 20260810220000_b1_514_v2_ra_requests_guest.sql

BEGIN;
SELECT pg_advisory_xact_lock(hashtextextended('b1-514-v2-preferences-environments', 0));

ALTER TABLE public.sf_users
  ADD COLUMN theme_preference text NOT NULL DEFAULT 'dark'
  CHECK (theme_preference IN ('dark', 'light', 'auto'));

ALTER TABLE public.sf_users
  DROP CONSTRAINT IF EXISTS sf_users_background_preference_check;
ALTER TABLE public.sf_users
  ADD CONSTRAINT sf_users_background_preference_check
  CHECK (background_preference IN (
    'ember','aurora','constellation','tide','meridian','emberstorm','lumen','static'
  ));

CREATE OR REPLACE FUNCTION public.sf_set_background_preference(p_background text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_background text := lower(trim(coalesce(p_background, '')));
BEGIN
  IF NOT public.sf_has_live_identity() THEN
    RAISE EXCEPTION 'eligible StoryForge identity required' USING ERRCODE = '42501';
  END IF;
  IF v_background NOT IN (
    'ember','aurora','constellation','tide','meridian','emberstorm','lumen','static'
  ) THEN
    RAISE EXCEPTION 'unsupported StoryForge background preference' USING ERRCODE = '22023';
  END IF;
  UPDATE public.sf_users SET background_preference=v_background,updated_at=now()
  WHERE id=public.sf_actor_id() RETURNING background_preference INTO v_background;
  IF NOT FOUND THEN RAISE EXCEPTION 'StoryForge profile is unavailable' USING ERRCODE = '42501'; END IF;
  RETURN v_background;
END
$$;

CREATE OR REPLACE FUNCTION public.sf_set_theme_preference(p_theme text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_theme text := lower(trim(coalesce(p_theme, '')));
BEGIN
  IF NOT public.sf_has_live_identity() THEN
    RAISE EXCEPTION 'eligible StoryForge identity required' USING ERRCODE = '42501';
  END IF;
  IF v_theme NOT IN ('dark','light','auto') THEN
    RAISE EXCEPTION 'unsupported StoryForge theme preference' USING ERRCODE = '22023';
  END IF;
  UPDATE public.sf_users SET theme_preference=v_theme,updated_at=now()
  WHERE id=public.sf_actor_id() RETURNING theme_preference INTO v_theme;
  IF NOT FOUND THEN RAISE EXCEPTION 'StoryForge profile is unavailable' USING ERRCODE = '42501'; END IF;
  RETURN v_theme;
END
$$;

REVOKE ALL ON FUNCTION public.sf_set_background_preference(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sf_set_theme_preference(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sf_set_background_preference(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sf_set_theme_preference(text) TO authenticated;

COMMIT;
