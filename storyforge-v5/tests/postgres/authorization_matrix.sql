\set ON_ERROR_STOP on

CREATE OR REPLACE FUNCTION public.sf_test_assert(p_ok boolean, p_message text)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT coalesce(p_ok, false) THEN
    RAISE EXCEPTION 'ASSERTION FAILED: %', p_message;
  END IF;
  RAISE NOTICE 'PASS: %', p_message;
END
$$;

CREATE OR REPLACE FUNCTION public.sf_test_expect_denied(p_operation text, p_story_id uuid DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
AS $$
BEGIN
  BEGIN
    CASE p_operation
      WHEN 'submit' THEN
        PERFORM public.sf_submit_story(p_story_id, 'workspace');
      WHEN 'open' THEN
        PERFORM public.sf_open_story(p_story_id, 'quick');
      WHEN 'review' THEN
        PERFORM public.sf_review_story(
          p_story_id, 'Unauthorized feedback', 'approved', 5::smallint, false, 'growth', 'workspace'
        );
      WHEN 'create' THEN
        PERFORM public.sf_create_story('Denied', 'This must not persist.', 'text', 'quick');
      WHEN 'preference' THEN
        PERFORM public.sf_set_background_preference('aurora');
      ELSE
        RAISE EXCEPTION 'unknown test operation';
    END CASE;
    RETURN false;
  EXCEPTION
    WHEN insufficient_privilege OR no_data_found OR check_violation THEN
      RETURN true;
  END;
END
$$;

\echo 'AUTH MATRIX: student creates a private story'
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
SELECT set_config('request.jwt.claim.app_role', 'student', true);
SELECT set_config('request.jwt.claim.storyforge_eligible', 'true', true);
SELECT set_config('request.jwt.claim.wp_user_id', '1101', true);
SELECT (public.sf_create_story(
  'Advocacy on night shift',
  'I noticed that a patient and family were not being heard, so I slowed the team down and clarified their concern.',
  'text',
  'quick'
)).id AS story_id \gset
SELECT public.sf_test_assert(
  (SELECT count(*) FROM public.sf_stories WHERE id = :'story_id') = 1,
  'student-self can read the private story'
);
SELECT public.sf_test_assert(
  NOT has_table_privilege('authenticated', 'public.sf_stories', 'UPDATE'),
  'authenticated clients cannot bypass state RPCs with direct story updates'
);
SELECT public.sf_test_assert(
  (SELECT original_text = current_text FROM public.sf_stories WHERE id = :'story_id'),
  'original capture begins as an exact immutable snapshot'
);
COMMIT;

\echo 'AUTH MATRIX: student-other is denied'
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
SELECT set_config('request.jwt.claim.app_role', 'student', true);
SELECT set_config('request.jwt.claim.storyforge_eligible', 'true', true);
SELECT set_config('request.jwt.claim.wp_user_id', '1102', true);
SELECT public.sf_test_assert(
  (SELECT count(*) FROM public.sf_stories WHERE id = :'story_id') = 0,
  'student-other sees zero rows by direct story id'
);
SELECT public.sf_test_assert(
  public.sf_test_expect_denied('submit', :'story_id'::uuid),
  'student-other cannot invoke submit on a foreign story'
);
COMMIT;

\echo 'AUTH MATRIX: assigned and unassigned mentors cannot read private'
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true);
SELECT set_config('request.jwt.claim.app_role', 'mentor', true);
SELECT set_config('request.jwt.claim.storyforge_eligible', 'true', true);
SELECT set_config('request.jwt.claim.wp_user_id', '2101', true);
SELECT public.sf_test_assert(
  (SELECT count(*) FROM public.sf_stories WHERE id = :'story_id') = 0,
  'assigned mentor cannot read a private story by id'
);
SELECT public.sf_test_assert(
  public.sf_test_expect_denied('open', :'story_id'::uuid),
  'assigned mentor cannot open a private story'
);
COMMIT;

BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', true);
SELECT set_config('request.jwt.claim.app_role', 'mentor', true);
SELECT set_config('request.jwt.claim.storyforge_eligible', 'true', true);
SELECT set_config('request.jwt.claim.wp_user_id', '2103', true);
SELECT public.sf_test_assert(
  (SELECT count(*) FROM public.sf_stories WHERE id = :'story_id') = 0,
  'unassigned mentor cannot read a private story by id'
);
COMMIT;

\echo 'AUTH MATRIX: admin has no private-story support override'
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', true);
SELECT set_config('request.jwt.claim.app_role', 'admin', true);
SELECT set_config('request.jwt.claim.storyforge_eligible', 'true', true);
SELECT set_config('request.jwt.claim.wp_user_id', '3101', true);
SELECT public.sf_test_assert(
  (SELECT count(*) FROM public.sf_stories WHERE id = :'story_id') = 0,
  'admin cannot read a private story by id'
);
COMMIT;

\echo 'AUTH MATRIX: anonymous and ineligible identities are closed'
SELECT public.sf_test_assert(
  NOT has_table_privilege('anon', 'public.sf_stories', 'SELECT'),
  'anonymous role has no story read privilege'
);

\echo 'AUTH MATRIX: mismatched WordPress identity binding is closed'
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
SELECT set_config('request.jwt.claim.app_role', 'student', true);
SELECT set_config('request.jwt.claim.storyforge_eligible', 'true', true);
SELECT set_config('request.jwt.claim.wp_user_id', '1102', true);
SELECT public.sf_test_assert(
  (SELECT count(*) FROM public.sf_stories WHERE id = :'story_id') = 0,
  'matching subject with mismatched WordPress user ID sees zero story rows'
);
SELECT public.sf_test_assert(
  public.sf_test_expect_denied('create'),
  'matching subject with mismatched WordPress user ID cannot invoke state RPCs'
);
SELECT public.sf_test_assert(
  public.sf_test_expect_denied('preference'),
  'matching subject with mismatched WordPress user ID cannot change preferences'
);
COMMIT;

\echo 'PREFERENCES: authenticated background selection is owner-bound'
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
SELECT set_config('request.jwt.claim.app_role', 'student', true);
SELECT set_config('request.jwt.claim.storyforge_eligible', 'true', true);
SELECT set_config('request.jwt.claim.wp_user_id', '1101', true);
SELECT public.sf_test_assert(
  public.sf_set_background_preference('aurora') = 'aurora',
  'student can persist a canonical background through the own-user RPC'
);
SELECT public.sf_test_assert(
  (
    SELECT background_preference = 'aurora'
    FROM public.sf_users
    WHERE id = '11111111-1111-4111-8111-111111111111'
  ),
  'background preference persists on the authenticated user row'
);
COMMIT;
SELECT public.sf_test_assert(
  (
    SELECT background_preference = 'ember'
    FROM public.sf_users
    WHERE id = '22222222-2222-4222-8222-222222222222'
  ),
  'changing one preference does not change another user row'
);

BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
SELECT set_config('request.jwt.claim.app_role', 'student', true);
SELECT set_config('request.jwt.claim.storyforge_eligible', 'false', true);
SELECT set_config('request.jwt.claim.wp_user_id', '1101', true);
SELECT public.sf_test_assert(
  (SELECT count(*) FROM public.sf_stories WHERE id = :'story_id') = 0,
  'revoked or missing eligibility closes reads'
);
SELECT public.sf_test_assert(
  public.sf_test_expect_denied('create'),
  'ineligible identity cannot create a story'
);
COMMIT;

\echo 'LIFECYCLE: zero-assignment student remains private and editable'
UPDATE public.sf_mentor_assignments
SET active = false
WHERE student_id = '22222222-2222-4222-8222-222222222222';
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
SELECT set_config('request.jwt.claim.app_role', 'student', true);
SELECT set_config('request.jwt.claim.storyforge_eligible', 'true', true);
SELECT set_config('request.jwt.claim.wp_user_id', '1102', true);
SELECT (public.sf_create_story(
  'Private founder workflow',
  'This story must remain editable while mentor review is unavailable.',
  'text',
  'quick'
)).id AS unassigned_story_id \gset
SELECT public.sf_test_assert(
  public.sf_test_expect_denied('submit', :'unassigned_story_id'::uuid),
  'zero-assignment student cannot submit through the state RPC'
);
SELECT public.sf_test_assert(
  (
    SELECT status = 'private' AND submitted_at IS NULL
    FROM public.sf_stories
    WHERE id = :'unassigned_story_id'
  ),
  'denied submission leaves the story private and editable'
);
COMMIT;
UPDATE public.sf_mentor_assignments
SET active = true
WHERE student_id = '22222222-2222-4222-8222-222222222222';

\echo 'LIFECYCLE: student edits without overwriting original and submits'
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
SELECT set_config('request.jwt.claim.app_role', 'student', true);
SELECT set_config('request.jwt.claim.storyforge_eligible', 'true', true);
SELECT set_config('request.jwt.claim.wp_user_id', '1101', true);
SELECT public.sf_update_story(
  :'story_id'::uuid,
  'Advocacy on night shift',
  'I noticed that a patient and family were not being heard. I paused, listened, and helped the team change the plan.',
  4::smallint,
  ARRAY['behavioral', 'personal-statement'],
  'workspace'
);
SELECT public.sf_test_assert(
  (SELECT original_text <> current_text FROM public.sf_stories WHERE id = :'story_id'),
  'student edit changes current text but preserves original capture'
);
SELECT public.sf_test_assert(
  (SELECT count(*) FROM public.sf_story_revisions WHERE story_id = :'story_id') >= 2,
  'student edit creates a durable revision'
);
SELECT public.sf_submit_story(:'story_id'::uuid, 'workspace');
SELECT public.sf_test_assert(
  (SELECT status = 'submitted' FROM public.sf_stories WHERE id = :'story_id'),
  'private story transitions to submitted'
);
COMMIT;

\echo 'AUTH MATRIX: submitted story is assigned-only'
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true);
SELECT set_config('request.jwt.claim.app_role', 'mentor', true);
SELECT set_config('request.jwt.claim.storyforge_eligible', 'true', true);
SELECT set_config('request.jwt.claim.wp_user_id', '2101', true);
SELECT public.sf_test_assert(
  (SELECT count(*) FROM public.sf_stories WHERE id = :'story_id') = 1,
  'assigned mentor can read a submitted story'
);
SELECT public.sf_open_story(:'story_id'::uuid, 'quick');
SELECT public.sf_review_story(
  :'story_id'::uuid,
  'The advocacy is clear. Revise the ending to name what you learned and how it changed your next action.',
  'needs_revision',
  4::smallint,
  true,
  'clinical',
  'workspace'
);
COMMIT;

BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', true);
SELECT set_config('request.jwt.claim.app_role', 'mentor', true);
SELECT set_config('request.jwt.claim.storyforge_eligible', 'true', true);
SELECT set_config('request.jwt.claim.wp_user_id', '2103', true);
SELECT public.sf_test_assert(
  (SELECT count(*) FROM public.sf_stories WHERE id = :'story_id') = 0,
  'unassigned mentor sees zero submitted story rows'
);
SELECT public.sf_test_assert(
  public.sf_test_expect_denied('review', :'story_id'::uuid),
  'unassigned mentor cannot review by crafted RPC'
);
COMMIT;

\echo 'LIFECYCLE: notification, revise, resubmit, second mentor, approve'
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
SELECT set_config('request.jwt.claim.app_role', 'student', true);
SELECT set_config('request.jwt.claim.storyforge_eligible', 'true', true);
SELECT set_config('request.jwt.claim.wp_user_id', '1101', true);
SELECT public.sf_test_assert(
  (SELECT count(*) FROM public.sf_notifications WHERE story_id = :'story_id' AND read_at IS NULL) = 1,
  'mentor review and student notification committed together'
);
SELECT public.sf_update_story(
  :'story_id'::uuid,
  'Advocacy on night shift',
  'I noticed that a patient and family were not being heard. I paused, listened, and helped the team change the plan. I learned to treat silence as a signal to invite the patient back into the decision.',
  5::smallint,
  ARRAY['behavioral', 'personal-statement'],
  'workspace'
);
SELECT public.sf_submit_story(:'story_id'::uuid, 'workspace');
SELECT public.sf_test_assert(
  (SELECT status = 'resubmitted' FROM public.sf_stories WHERE id = :'story_id'),
  'needs-revision story transitions to resubmitted'
);
COMMIT;

BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', true);
SELECT set_config('request.jwt.claim.app_role', 'mentor', true);
SELECT set_config('request.jwt.claim.storyforge_eligible', 'true', true);
SELECT set_config('request.jwt.claim.wp_user_id', '2102', true);
SELECT public.sf_open_story(:'story_id'::uuid, 'quick');
SELECT public.sf_review_story(
  :'story_id'::uuid,
  'Approved. The reflection now shows a concrete change in your clinical behavior.',
  'approved',
  5::smallint,
  false,
  'clinical',
  'workspace'
);
SELECT public.sf_test_assert(
  (SELECT status = 'approved' FROM public.sf_stories WHERE id = :'story_id'),
  'second assigned mentor can approve the resubmission'
);
SELECT public.sf_test_assert(
  (SELECT count(DISTINCT mentor_id) FROM public.sf_feedback WHERE story_id = :'story_id') = 2,
  'two mentor actions retain real, distinct attribution'
);
SELECT public.sf_test_assert(
  (
    SELECT count(*) FROM public.sf_feedback f
    JOIN public.sf_users u ON u.id = f.mentor_id
    WHERE f.story_id = :'story_id'
  ) = 2,
  'co-assigned mentor can see both attributed mentor names'
);
COMMIT;

\echo 'PREP: student workshop fields and mentor fields remain separate'
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
SELECT set_config('request.jwt.claim.app_role', 'student', true);
SELECT set_config('request.jwt.claim.storyforge_eligible', 'true', true);
SELECT set_config('request.jwt.claim.wp_user_id', '1101', true);
SELECT (public.sf_create_workshop(
  '11111111-1111-4111-8111-111111111111',
  '10000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000002'
)).id AS workshop_id \gset
SELECT public.sf_update_workshop(
  :'workshop_id'::uuid, 4::smallint, 3::smallint,
  '10000000-0000-4000-8000-000000000001',
  'The advocacy example has a clearer decision point.',
  NULL, NULL, 'prepared'
);
COMMIT;

BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true);
SELECT set_config('request.jwt.claim.app_role', 'mentor', true);
SELECT set_config('request.jwt.claim.storyforge_eligible', 'true', true);
SELECT set_config('request.jwt.claim.wp_user_id', '2101', true);
SELECT public.sf_update_workshop(
  :'workshop_id'::uuid, 5::smallint, 3::smallint, NULL, NULL,
  'Keep the advocacy question first and prepare one follow-up about disagreement.',
  'The teamwork story needs a more specific result.',
  'reviewed'
);
SELECT public.sf_test_assert(
  (
    SELECT student_strength_a = 4 AND mentor_strength_a = 5
    FROM public.sf_workshops WHERE id = :'workshop_id'
  ),
  'student and mentor workshop strengths are separate columns'
);
COMMIT;

\echo 'IMPORT: draft-first governance, duplicate protection, rollback'
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true);
SELECT set_config('request.jwt.claim.app_role', 'mentor', true);
SELECT set_config('request.jwt.claim.storyforge_eligible', 'true', true);
SELECT set_config('request.jwt.claim.wp_user_id', '2101', true);
SELECT (public.sf_commit_question_import(
  'mentor-questions.csv',
  'csv',
  jsonb_build_array(
    jsonb_build_object('text', 'How did you respond when a plan changed unexpectedly?', 'family', 'adaptability', 'selected', true),
    jsonb_build_object('text', 'Tell me about a time you advocated for someone whose needs were not being heard.', 'family', 'advocacy', 'selected', true)
  )
)).id AS batch_id \gset
SELECT public.sf_test_assert(
  (
    SELECT count(*) = 1 AND bool_and(governance_state = 'draft')
    FROM public.sf_questions WHERE import_batch_id = :'batch_id'
  ),
  'selected non-duplicate import rows create draft questions only'
);
SELECT public.sf_test_assert(
  (
    SELECT count(*) = 1 FROM public.sf_import_rows
    WHERE batch_id = :'batch_id' AND duplicate_question_id IS NOT NULL
  ),
  'exact duplicates are flagged and not silently committed'
);
SELECT public.sf_rollback_question_import(:'batch_id'::uuid);
SELECT public.sf_test_assert(
  (
    SELECT bool_and(governance_state = 'retired')
    FROM public.sf_questions WHERE import_batch_id = :'batch_id'
  ),
  'import rollback retires rather than hard-deletes questions'
);
COMMIT;

\echo 'AUDIT: append-only and actor attribution'
SELECT public.sf_test_assert(
  NOT has_table_privilege('authenticated', 'public.sf_audit_events', 'UPDATE'),
  'authenticated role cannot update audit events'
);
SELECT public.sf_test_assert(
  (
    SELECT count(DISTINCT actor_id) >= 3
    FROM public.sf_audit_events
    WHERE entity_type = 'story' AND entity_id = :'story_id'
  ),
  'story audit history retains student and both mentor actors'
);

DROP FUNCTION public.sf_test_assert(boolean, text);
DROP FUNCTION public.sf_test_expect_denied(text, uuid);

\echo 'STORYFORGE_POSTGRES_SUITE_PASS'
