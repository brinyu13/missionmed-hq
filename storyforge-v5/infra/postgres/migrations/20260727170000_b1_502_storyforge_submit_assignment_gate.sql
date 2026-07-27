\set ON_ERROR_STOP on

-- Migration: 20260727170000_b1_502_storyforge_submit_assignment_gate.sql
-- Authority: B1-502M / DR-011
-- Target project: Railway 875e7c17-d06f-4301-a4bb-e61016f153cf
-- Target database service: a4a66362-c3ba-475a-ae21-2aa46624bafe
-- Depends on: 20260726150000_b1_500_storyforge_v5_foundation.sql
-- Purpose: Bind database identity to the WordPress user and deny submission without a live mentor assignment.
-- Reversibility: additive/replacement objects; production rollback preserves founder data and disables the feature.

BEGIN;

CREATE OR REPLACE FUNCTION public.sf_actor_wp_user_id()
RETURNS bigint
LANGUAGE sql
STABLE
AS $$
  SELECT nullif(current_setting('request.jwt.claim.wp_user_id', true), '')::bigint
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
      AND u.role = public.sf_actor_role()
      AND (p_roles IS NULL OR u.role = ANY(p_roles))
  )
$$;

CREATE OR REPLACE FUNCTION public.sf_submit_story(
  p_story_id uuid,
  p_surface text DEFAULT 'workspace'
)
RETURNS public.sf_stories
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_before public.sf_stories;
  v_story public.sf_stories;
  v_status text;
BEGIN
  IF NOT public.sf_has_live_identity(ARRAY['student']) THEN
    RAISE EXCEPTION 'eligible student identity required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_before FROM public.sf_stories
  WHERE id = p_story_id AND student_id = public.sf_actor_id()
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'story not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_before.status NOT IN ('private', 'needs_revision') THEN
    RAISE EXCEPTION 'cannot submit from status %', v_before.status USING ERRCODE = '23514';
  END IF;
  IF length(trim(v_before.current_text)) < 3 THEN
    RAISE EXCEPTION 'story text is required' USING ERRCODE = '23514';
  END IF;

  PERFORM 1
  FROM public.sf_mentor_assignments assignment
  WHERE assignment.student_id = v_before.student_id
    AND assignment.active
  FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'An active mentor assignment is required before submission.'
      USING ERRCODE = '42501';
  END IF;

  v_status := CASE WHEN v_before.status = 'needs_revision' THEN 'resubmitted' ELSE 'submitted' END;

  UPDATE public.sf_stories
  SET status = v_status,
      submitted_at = now(),
      updated_at = now()
  WHERE id = p_story_id
  RETURNING * INTO v_story;

  INSERT INTO public.sf_story_revisions
    (story_id, revision_no, text_snapshot, title_snapshot, actor_id, reason)
  VALUES (
    v_story.id, v_story.revision_no, v_story.current_text, v_story.title,
    public.sf_actor_id(), CASE WHEN v_status = 'resubmitted' THEN 'resubmit' ELSE 'submit' END
  );

  INSERT INTO public.sf_audit_events
    (actor_id, actor_role, action, entity_type, entity_id, surface, previous_value, new_value)
  VALUES (
    public.sf_actor_id(), public.sf_actor_role(), 'story.submitted', 'story', v_story.id, p_surface,
    jsonb_build_object('status', v_before.status),
    jsonb_build_object('status', v_story.status)
  );
  RETURN v_story;
END
$$;

REVOKE ALL ON FUNCTION public.sf_submit_story(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sf_actor_wp_user_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sf_has_live_identity(text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sf_submit_story(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sf_actor_wp_user_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.sf_has_live_identity(text[]) TO authenticated;

COMMIT;
