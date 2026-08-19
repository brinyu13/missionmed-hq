-- B1-515R4 rollback: restore the exact pre-repair production definitions
-- of sf_admin_subject_in_scope() and sf_admin_population_context(), as
-- captured from production before the repair was applied.
--
-- WARNING: this reinstates the 24-hour read-time snapshot expiry, which
-- empties the administrator console 24 hours after the last identity sync.

BEGIN;

CREATE OR REPLACE FUNCTION public.sf_admin_subject_in_scope(p_student_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
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
        AND state.observed_at >= now() - interval '24 hours'
        AND state.synced_at >= now() - interval '24 hours'
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
$function$
;

CREATE OR REPLACE FUNCTION public.sf_admin_population_context()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
  v_result jsonb;
  v_selected_keys text[] := ARRAY['match_mentorship_360']::text[];
  v_updated_at timestamptz;
BEGIN
  PERFORM public.sf_admin_assert_enabled();
  SELECT settings.selected_population_keys,settings.updated_at
  INTO v_selected_keys,v_updated_at
  FROM public.sf_admin_population_settings settings WHERE settings.singleton;
  SELECT jsonb_build_object(
    'selectedKeys', to_jsonb(v_selected_keys),
    'defaultKey', 'match_mentorship_360',
    'authority', 'mmhq_cam_build_entitlement',
    'observedAt', state.observed_at,
    'syncedAt', state.synced_at,
    'memberCount', coalesce(state.member_count, 0),
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
$function$
;

COMMIT;
