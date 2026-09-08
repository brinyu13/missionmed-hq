-- Migration: 20260908193000_sf_access_5014_canonical_admin_identity.sql
-- Authority: SF-ACCESS-5014
-- Date: 2026-09-08
-- Depends on: 20260820120000_b1_517_myeras_alignment.sql
-- Description: Compose eligible profile identity with signed canonical WordPress administrator authority.
-- Idempotent: YES

\set ON_ERROR_STOP on

-- The application sets these transaction-local claims only after verifying the
-- signed, unexpired token. This replacement does not grant table access, alter
-- RLS policies, create a profile, or permit admin_mode to be selected by the
-- client.

BEGIN;

CREATE OR REPLACE FUNCTION public.sf_has_live_identity(p_roles text[] DEFAULT NULL)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.sf_actor_eligible()
    AND (p_roles IS NULL OR public.sf_actor_role() = ANY(p_roles))
    AND (
      EXISTS (
        SELECT 1
        FROM public.sf_users u
        WHERE u.id = public.sf_actor_id()
          AND u.wp_user_id = public.sf_actor_wp_user_id()
          AND u.eligible
          AND u.role = public.sf_actor_base_role()
      )
      OR (
        public.sf_actor_wordpress_admin()
        AND public.sf_actor_base_role() = 'admin'
        AND public.sf_actor_role() = 'admin'
        AND public.sf_actor_id() IS NOT NULL
        AND public.sf_actor_wp_user_id() > 0
      )
    )
$$;

REVOKE ALL ON FUNCTION public.sf_has_live_identity(text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sf_has_live_identity(text[]) TO authenticated;

COMMIT;
