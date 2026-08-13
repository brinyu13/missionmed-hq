-- B1-515R: project the active Arena Lobby avatar into StoryForge identity views.
-- The image remains an Arena-owned R2/CDN asset. StoryForge stores only the
-- active avatar row id, its safe thumbnail URL, and the last reconciliation time.

BEGIN;

SELECT pg_advisory_xact_lock(hashtextextended('b1-515r-arena-avatar-directory-groups', 0));

ALTER TABLE public.sf_users
  ADD COLUMN arena_avatar_id uuid NULL,
  ADD COLUMN arena_avatar_thumbnail_url text NULL CHECK (
    arena_avatar_thumbnail_url IS NULL
    OR (
      length(arena_avatar_thumbnail_url) <= 2048
      AND arena_avatar_thumbnail_url ~ '^https://cdn\.missionmedinstitute\.com/'
    )
  ),
  ADD COLUMN arena_avatar_synced_at timestamptz NULL,
  ADD CONSTRAINT sf_users_arena_avatar_pair_check CHECK (
    (arena_avatar_id IS NULL AND arena_avatar_thumbnail_url IS NULL)
    OR (arena_avatar_id IS NOT NULL AND arena_avatar_thumbnail_url IS NOT NULL)
  );

CREATE OR REPLACE FUNCTION public.sf_admin_arena_avatar_projections(p_student_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_ids uuid[] := coalesce(p_student_ids, '{}'::uuid[]);
  v_result jsonb;
BEGIN
  PERFORM public.sf_admin_assert_enabled();
  IF NOT public.sf_story_feature_enabled('admin_directory', ARRAY['admin']) THEN
    RAISE EXCEPTION 'administrator directory is disabled' USING ERRCODE = '42501';
  END IF;
  IF NOT public.sf_story_feature_enabled('avatar_identity', ARRAY['admin']) THEN
    RAISE EXCEPTION 'Arena avatar projection is disabled' USING ERRCODE = '42501';
  END IF;
  IF cardinality(v_ids) > 100 OR cardinality(v_ids) <> cardinality(ARRAY(SELECT DISTINCT unnest(v_ids))) THEN
    RAISE EXCEPTION 'invalid avatar projection request' USING ERRCODE = '22023';
  END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'studentId', student.id,
    'avatar', CASE
      WHEN student.arena_avatar_id IS NOT NULL AND student.arena_avatar_thumbnail_url IS NOT NULL
      THEN jsonb_build_object(
        'available', true,
        'source', 'arena_lobby',
        'activeAvatarId', student.arena_avatar_id,
        'headshotUrl', student.arena_avatar_thumbnail_url,
        'syncedAt', student.arena_avatar_synced_at
      )
      ELSE jsonb_build_object('available', false, 'source', 'initials')
    END
  ) ORDER BY student.id), '[]'::jsonb)
  INTO v_result
  FROM public.sf_users student
  WHERE student.id = ANY(v_ids)
    AND student.role = 'student'
    AND student.eligible
    AND public.sf_b1_514_admin_feature_enabled('admin_directory', student.id);

  RETURN v_result;
END
$$;

CREATE OR REPLACE FUNCTION public.sf_admin_directory_groups()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_result jsonb;
BEGIN
  PERFORM public.sf_admin_assert_enabled();
  IF NOT public.sf_story_feature_enabled('admin_directory', ARRAY['admin']) THEN
    RAISE EXCEPTION 'administrator directory is disabled' USING ERRCODE = '42501';
  END IF;

  SELECT jsonb_build_object(
    'groups', coalesce(jsonb_agg(jsonb_build_object(
      'id', grouped.cohort,
      'label', grouped.cohort,
      'studentCount', grouped.student_count
    ) ORDER BY lower(grouped.cohort)), '[]'::jsonb)
  ) INTO v_result
  FROM (
    SELECT student.cohort, count(*)::integer AS student_count
    FROM public.sf_users student
    WHERE student.role = 'student'
      AND student.eligible
      AND nullif(btrim(student.cohort), '') IS NOT NULL
      AND public.sf_b1_514_admin_feature_enabled('admin_directory', student.id)
    GROUP BY student.cohort
  ) grouped;

  RETURN v_result;
END
$$;

REVOKE ALL ON FUNCTION public.sf_admin_arena_avatar_projections(uuid[]),
  public.sf_admin_directory_groups() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sf_admin_arena_avatar_projections(uuid[]),
  public.sf_admin_directory_groups() TO authenticated;

COMMIT;
