\set ON_ERROR_STOP on

-- Migration: 20260727190000_b1_502_storyforge_background_preference.sql
-- Authority: B1-502M canonical StoryForge V5 visual reconciliation
-- Depends on: 20260727170000_b1_502_storyforge_submit_assignment_gate.sql
-- Purpose: Persist one authenticated user's canonical dark background preference.
-- Reversibility: additive column and replacement RPC; existing StoryForge data is preserved.

BEGIN;

ALTER TABLE public.sf_users
ADD COLUMN IF NOT EXISTS background_preference text NOT NULL DEFAULT 'ember'
CHECK (
  background_preference IN (
    'ember',
    'aurora',
    'constellation',
    'tide',
    'meridian',
    'static'
  )
);

CREATE OR REPLACE FUNCTION public.sf_set_background_preference(p_background text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_background text := lower(trim(coalesce(p_background, '')));
BEGIN
  IF NOT public.sf_has_live_identity() THEN
    RAISE EXCEPTION 'eligible StoryForge identity required' USING ERRCODE = '42501';
  END IF;

  IF v_background NOT IN (
    'ember',
    'aurora',
    'constellation',
    'tide',
    'meridian',
    'static'
  ) THEN
    RAISE EXCEPTION 'unsupported StoryForge background preference'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.sf_users
  SET background_preference = v_background,
      updated_at = now()
  WHERE id = public.sf_actor_id()
  RETURNING background_preference INTO v_background;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'StoryForge profile is unavailable' USING ERRCODE = '42501';
  END IF;

  RETURN v_background;
END
$$;

REVOKE ALL ON FUNCTION public.sf_set_background_preference(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sf_set_background_preference(text) TO authenticated;

COMMIT;
