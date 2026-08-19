-- B1-515R4: repair the administrator population scope regression.
--
-- Defect: sf_admin_subject_in_scope() required the entitlement population
-- snapshot to be less than 24 hours old. The snapshot is produced by a manual
-- operator WP-CLI sync, so 24 hours after any sync every administrator surface
-- that resolves a student through this predicate (Students directory, Review
-- Queue, Admin Home, subject masterkey) silently returned zero rows, while
-- sf_admin_population_context() kept reporting the stale member_count with no
-- freshness condition at all. That produced the observed split brain: a header
-- claiming 437 students over a directory, queue and home showing none.
--
-- The snapshot is a durable projection of canonical enrollment truth, not a
-- cache with a time to live. Snapshot freshness is already enforced where it
-- belongs -- at ingest, in sf_sync_admin_population_snapshot(), which refuses
-- any snapshot observed more than 24 hours ago. Age is therefore disclosed to
-- the operator here instead of silently emptying the console.
--
-- Administrator scope only. sf_admin_subject_in_scope() is reachable from
-- student-facing paths solely inside sf_story_observable_to_actor(), and only
-- behind sf_admin_console_enabled(), which requires a live administrator
-- identity on the admin_console allowlist. Student and mentor visibility is
-- unchanged, and the private-visibility exclusion is untouched.

BEGIN;

CREATE OR REPLACE FUNCTION public.sf_admin_subject_in_scope(p_student_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT public.sf_admin_console_enabled()
    AND EXISTS (
      SELECT 1
      FROM public.sf_users student
      JOIN public.sf_entitlement_population_projection projection
        ON projection.student_id = student.id
      JOIN public.sf_entitlement_population_sync_state state
        ON state.population_key = projection.population_key
       AND state.generation_id = projection.generation_id
      CROSS JOIN public.sf_admin_population_settings settings
      JOIN public.sf_feature_flags directory_flag ON directory_flag.key = 'admin_directory'
      WHERE student.id = p_student_id
        AND student.role = 'student'
        AND student.eligible
        AND projection.population_key = ANY(settings.selected_population_keys)
        AND projection.authority = 'mmhq_cam_build_entitlement'
        AND projection.course_id = 3893
        AND (
          directory_flag.scope = 'eligible_all'
          OR (directory_flag.scope = 'allowlist' AND student.id = ANY(directory_flag.allowlist))
          OR (
            directory_flag.scope = 'cohort'
            AND student.cohort IS NOT NULL
            AND student.cohort = ANY(directory_flag.cohorts)
          )
        )
    )
$$;

-- memberCount now derives from the same resolved population the directory,
-- review queue and admin home resolve through, so the summary can no longer
-- disagree with them. The raw snapshot count and its age stay available as
-- additive keys so a stale snapshot is visible rather than silent.
CREATE OR REPLACE FUNCTION public.sf_admin_population_context()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_result jsonb;
  v_selected_keys text[] := ARRAY['match_mentorship_360']::text[];
  v_updated_at timestamptz;
  v_member_count integer := 0;
BEGIN
  PERFORM public.sf_admin_assert_enabled();
  SELECT settings.selected_population_keys,settings.updated_at
  INTO v_selected_keys,v_updated_at
  FROM public.sf_admin_population_settings settings WHERE settings.singleton;

  SELECT count(*)::integer INTO v_member_count
  FROM public.sf_users student
  WHERE student.role = 'student'
    AND public.sf_admin_subject_in_scope(student.id);

  SELECT jsonb_build_object(
    'selectedKeys', to_jsonb(v_selected_keys),
    'defaultKey', 'match_mentorship_360',
    'authority', 'mmhq_cam_build_entitlement',
    'observedAt', state.observed_at,
    'syncedAt', state.synced_at,
    'memberCount', v_member_count,
    'snapshotMemberCount', coalesce(state.member_count, 0),
    'snapshotAgeHours', CASE
      WHEN state.synced_at IS NULL THEN NULL
      ELSE round(extract(epoch FROM (now() - state.synced_at)) / 3600.0, 1)
    END,
    'stale', state.synced_at IS NULL OR state.synced_at < now() - interval '24 hours',
    'options', jsonb_build_array(
      jsonb_build_object(
        'key','match_mentorship_360','label','360 Match Mentorship',
        'available',true,'selected','match_mentorship_360'=ANY(v_selected_keys)
      ),
      jsonb_build_object(
        'key','personal_statement','label','Personal Statement students',
        'available',false,'selected',false,'reason','canonical_identifier_unverified'
      ),
      jsonb_build_object(
        'key','interview_prep_masterclass','label','Interview Prep Masterclass',
        'available',false,'selected',false,'reason','not_authorized_for_storyforge'
      ),
      jsonb_build_object(
        'key','interview_prep_essentials','label','Interview Prep Essentials',
        'available',false,'selected',false,'reason','canonical_identifier_unverified'
      ),
      jsonb_build_object(
        'key','registered_users','label','Registered users without qualifying enrollment',
        'available',false,'selected',false,'reason','not_entitled'
      )
    ),
    'updatedAt', v_updated_at
  ) INTO v_result
  FROM (SELECT 1) singleton
  LEFT JOIN public.sf_entitlement_population_sync_state state
    ON state.population_key = 'match_mentorship_360';
  RETURN v_result;
END
$$;

COMMIT;
