-- Migration: 20260806130000_b1_511a_wordpress_admin_authority.sql
-- Authority: Founder correction, 2026-08-06
-- Depends on: 20260805190000_b1_511_workflow_taxonomy_mentor_notes.sql
-- Purpose: Preserve a WordPress administrator's StoryForge ownership role while
--          permitting bounded server-selected administrator operations.
-- Idempotent: YES (CREATE OR REPLACE only)

BEGIN;

CREATE OR REPLACE FUNCTION public.sf_actor_base_role()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT nullif(current_setting('request.jwt.claim.app_role', true), '')
$$;

CREATE OR REPLACE FUNCTION public.sf_actor_wordpress_admin()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT coalesce(
    nullif(current_setting('request.jwt.claim.wordpress_admin', true), '')::boolean,
    false
  )
$$;

CREATE OR REPLACE FUNCTION public.sf_actor_admin_mode()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT coalesce(
    nullif(current_setting('request.jwt.claim.admin_mode', true), '')::boolean,
    false
  )
$$;

CREATE OR REPLACE FUNCTION public.sf_actor_role()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT CASE
    WHEN public.sf_actor_wordpress_admin() AND public.sf_actor_admin_mode()
      THEN 'admin'
    ELSE public.sf_actor_base_role()
  END
$$;

CREATE OR REPLACE FUNCTION public.sf_has_live_identity(p_roles text[] DEFAULT NULL)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.sf_users u
    WHERE u.id = public.sf_actor_id()
      AND u.wp_user_id = public.sf_actor_wp_user_id()
      AND u.eligible
      AND public.sf_actor_eligible()
      AND u.role = public.sf_actor_base_role()
      AND (p_roles IS NULL OR public.sf_actor_role() = ANY(p_roles))
  )
$$;

REVOKE ALL ON FUNCTION public.sf_actor_base_role() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sf_actor_wordpress_admin() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sf_actor_admin_mode() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sf_actor_role() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sf_has_live_identity(text[]) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.sf_actor_base_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.sf_actor_wordpress_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.sf_actor_admin_mode() TO authenticated;
GRANT EXECUTE ON FUNCTION public.sf_actor_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.sf_has_live_identity(text[]) TO authenticated;

COMMIT;
