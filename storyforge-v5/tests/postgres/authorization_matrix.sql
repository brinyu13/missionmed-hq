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
      WHEN 'custom_question' THEN
        PERFORM public.sf_create_custom_question(
          'This custom question must not persist.',
          'custom',
          'library'
        );
      WHEN 'preference' THEN
        PERFORM public.sf_set_background_preference('aurora');
      WHEN 'coaching_foreign_question' THEN
        PERFORM public.sf_add_question_coaching_note(
          '11111111-1111-4111-8111-111111111111',
          p_story_id,
          NULL,
          'This cross-student question link must not persist.',
          'workshop'
        );
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

CREATE OR REPLACE FUNCTION public.sf_test_expect_sqlstate(
  p_sql text,
  p_expected text[]
)
RETURNS boolean
LANGUAGE plpgsql
AS $$
BEGIN
  EXECUTE p_sql;
  RETURN false;
EXCEPTION
  WHEN OTHERS THEN
    RETURN SQLSTATE = ANY (p_expected);
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
SELECT public.sf_test_assert(
  public.sf_test_expect_denied('custom_question'),
  'matching subject with mismatched WordPress user ID cannot create a custom question'
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
SELECT public.sf_test_assert(
  public.sf_test_expect_denied('custom_question'),
  'ineligible identity cannot create a custom question'
);
COMMIT;

\echo 'QUESTIONS: custom persistence is owner-bound and governed'
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
SELECT set_config('request.jwt.claim.app_role', 'student', true);
SELECT set_config('request.jwt.claim.storyforge_eligible', 'true', true);
SELECT set_config('request.jwt.claim.wp_user_id', '1101', true);
SELECT (public.sf_create_custom_question(
  'How did that experience change the next decision you made?',
  'personal',
  'library'
)).id AS student_custom_question_id \gset
SELECT public.sf_test_assert(
  (
    SELECT provenance = 'student'
      AND owner_student_id = '11111111-1111-4111-8111-111111111111'
      AND governance_state = 'draft'
      AND created_by = '11111111-1111-4111-8111-111111111111'
    FROM public.sf_questions
    WHERE id = :'student_custom_question_id'
  ),
  'student custom question persists as an owner-bound draft'
);
SELECT public.sf_test_assert(
  NOT has_table_privilege('authenticated', 'public.sf_questions', 'INSERT'),
  'authenticated clients cannot bypass the custom-question RPC with direct inserts'
);
SELECT public.sf_test_assert(
  (
    SELECT count(*) = 1
    FROM public.sf_audit_events
    WHERE action = 'question.custom_created'
      AND entity_type = 'question'
      AND entity_id = :'student_custom_question_id'
      AND question_id = :'student_custom_question_id'
      AND actor_id = '11111111-1111-4111-8111-111111111111'
  ),
  'student custom-question creation is append-only audited'
);
COMMIT;

BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
SELECT set_config('request.jwt.claim.app_role', 'student', true);
SELECT set_config('request.jwt.claim.storyforge_eligible', 'true', true);
SELECT set_config('request.jwt.claim.wp_user_id', '1102', true);
SELECT public.sf_test_assert(
  (SELECT count(*) FROM public.sf_questions WHERE id = :'student_custom_question_id') = 0,
  'another student cannot read a private custom question by direct id'
);
SELECT public.sf_test_assert(
  (
    SELECT count(*)
    FROM public.sf_questions
    WHERE owner_student_id = '11111111-1111-4111-8111-111111111111'
      AND governance_state = 'draft'
  ) = 0,
  'another student list does not leak owner-private custom questions'
);
SELECT (public.sf_create_custom_question(
  'How did that experience change the next decision you made?',
  'personal',
  'library'
)).id AS student_other_custom_question_id \gset
SELECT public.sf_test_assert(
  (
    SELECT id <> :'student_custom_question_id'
      AND owner_student_id = '22222222-2222-4222-8222-222222222222'
      AND governance_state = 'draft'
    FROM public.sf_questions
    WHERE id = :'student_other_custom_question_id'
  ),
  'hidden student namespaces may retain the same wording without exposing one another'
);
COMMIT;

BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', true);
SELECT set_config('request.jwt.claim.app_role', 'mentor', true);
SELECT set_config('request.jwt.claim.storyforge_eligible', 'true', true);
SELECT set_config('request.jwt.claim.wp_user_id', '2103', true);
SELECT public.sf_test_assert(
  (SELECT count(*) FROM public.sf_questions WHERE id = :'student_custom_question_id') = 0,
  'unassigned mentor cannot read a student custom question by direct id'
);
COMMIT;

BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true);
SELECT set_config('request.jwt.claim.app_role', 'mentor', true);
SELECT set_config('request.jwt.claim.storyforge_eligible', 'true', true);
SELECT set_config('request.jwt.claim.wp_user_id', '2101', true);
SELECT public.sf_test_assert(
  (SELECT count(*) FROM public.sf_questions WHERE id = :'student_custom_question_id') = 1,
  'assigned mentor retains existing RLS access to the assigned student custom question'
);
SELECT public.sf_test_assert(
  public.sf_test_expect_denied(
    'coaching_foreign_question',
    :'student_other_custom_question_id'::uuid
  ),
  'assigned mentor cannot link coaching notes to another student private question id'
);
SELECT (public.sf_create_custom_question(
  'What detail would make the turning point clearer?',
  'behavioral',
  'library'
)).id AS mentor_shared_question_id \gset
SELECT public.sf_test_assert(
  (
    SELECT provenance = 'mentor'
      AND owner_student_id IS NULL
      AND governance_state = 'draft'
      AND created_by = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
      AND approved_by IS NULL
      AND approved_at IS NULL
    FROM public.sf_questions
    WHERE id = :'mentor_shared_question_id'
  ),
  'mentor single-add persists as an attributed governed draft'
);
COMMIT;

BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', true);
SELECT set_config('request.jwt.claim.app_role', 'mentor', true);
SELECT set_config('request.jwt.claim.storyforge_eligible', 'true', true);
SELECT set_config('request.jwt.claim.wp_user_id', '2102', true);
SELECT public.sf_test_assert(
  (SELECT count(*) FROM public.sf_questions WHERE id = :'mentor_shared_question_id') = 0,
  'another mentor cannot read a mentor-authored institutional draft before approval'
);
COMMIT;

BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', true);
SELECT set_config('request.jwt.claim.app_role', 'admin', true);
SELECT set_config('request.jwt.claim.storyforge_eligible', 'true', true);
SELECT set_config('request.jwt.claim.wp_user_id', '3101', true);
SELECT public.sf_test_assert(
  (SELECT count(*) FROM public.sf_questions WHERE id = :'student_custom_question_id') = 0,
  'admin cannot read a student-personal question by direct id'
);
SELECT public.sf_test_assert(
  (
    SELECT count(*)
    FROM public.sf_questions
    WHERE owner_student_id = '11111111-1111-4111-8111-111111111111'
  ) = 0,
  'admin question list excludes all student-personal rows'
);
SELECT public.sf_test_assert(
  (SELECT count(*) FROM public.sf_questions WHERE id = :'mentor_shared_question_id') = 1,
  'admin governance can read a global mentor draft'
);
SELECT public.sf_approve_question(:'mentor_shared_question_id'::uuid, 'library');
SELECT public.sf_test_assert(
  (
    SELECT governance_state = 'approved'
      AND approved_by = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
      AND approved_at IS NOT NULL
    FROM public.sf_questions
    WHERE id = :'mentor_shared_question_id'
  ),
  'explicit admin confirmation approves a mentor-authored institutional draft'
);
SELECT public.sf_test_assert(
  public.sf_test_expect_denied('custom_question'),
  'admin single-add is denied so admin remains on the governed import workflow'
);
COMMIT;

BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
SELECT set_config('request.jwt.claim.app_role', 'student', true);
SELECT set_config('request.jwt.claim.storyforge_eligible', 'true', true);
SELECT set_config('request.jwt.claim.wp_user_id', '1101', true);
SELECT public.sf_test_assert(
  (SELECT count(*) FROM public.sf_questions WHERE id = :'mentor_shared_question_id') = 1,
  'student can read a mentor single-add only after explicit approval'
);
SELECT pair.id AS mentor_shared_pair_id
FROM public.sf_upsert_story_question(
  :'story_id'::uuid,
  :'mentor_shared_question_id'::uuid,
  jsonb_build_object(
    'strength', 3,
    'why', 'The mentor question is shared and relevant to this story.'
  ),
  'workshop'
) AS pair \gset
SELECT public.sf_test_assert(
  (
    SELECT question_id = :'mentor_shared_question_id'
      AND story_id = :'story_id'
    FROM public.sf_story_questions
    WHERE id = :'mentor_shared_pair_id'
  ),
  'student can assign the mentor-shared question to an owned story'
);
COMMIT;

BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', true);
SELECT set_config('request.jwt.claim.app_role', 'mentor', true);
SELECT set_config('request.jwt.claim.storyforge_eligible', 'true', true);
SELECT set_config('request.jwt.claim.wp_user_id', '2102', true);
SELECT public.sf_test_assert(
  (SELECT count(*) FROM public.sf_questions WHERE id = :'mentor_shared_question_id') = 1,
  'another mentor can read the explicitly approved global mentor question'
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
  ARRAY['iv', 'ps'],
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
  (SELECT status = 'awaiting' FROM public.sf_stories WHERE id = :'story_id'),
  'private story transitions to canonical awaiting-review state'
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
  ARRAY['iv', 'ps'],
  'workspace'
);
SELECT public.sf_test_assert(
  (
    SELECT status = 'awaiting' AND revised
    FROM public.sf_stories
    WHERE id = :'story_id'
  ),
  'editing after requested changes automatically transitions to the canonical awaiting-review revision'
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
SELECT set_config('request.jwt.claim.sub', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', true);
SELECT set_config('request.jwt.claim.app_role', 'admin', true);
SELECT set_config('request.jwt.claim.storyforge_eligible', 'true', true);
SELECT set_config('request.jwt.claim.wp_user_id', '3101', true);
SELECT (public.sf_commit_question_import(
  'admin-governance-questions.csv',
  'csv',
  jsonb_build_array(
    jsonb_build_object('text', 'How did you respond when a plan changed unexpectedly?', 'family', 'behavioral', 'selected', true),
    jsonb_build_object('text', 'Tell me about a time you advocated for someone whose needs were not being heard.', 'family', 'behavioral', 'selected', true),
    jsonb_build_object('text', 'What surprised you about your own growth?', 'family', 'growth', 'selected', true)
  )
)).id AS batch_id \gset
SELECT public.sf_test_assert(
  (
    SELECT count(*) = 1 AND bool_and(governance_state = 'draft')
    FROM public.sf_questions WHERE import_batch_id = :'batch_id'
  ),
  'admin governed import creates selected non-duplicate rows as drafts only'
);
SELECT id AS imported_question_id
FROM public.sf_questions
WHERE import_batch_id = :'batch_id'
ORDER BY created_at, id
LIMIT 1 \gset
SELECT public.sf_approve_question(:'imported_question_id'::uuid, 'import');
SELECT public.sf_test_assert(
  (
    SELECT governance_state = 'approved'
      AND provenance = 'imported'
      AND approved_by = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
    FROM public.sf_questions
    WHERE id = :'imported_question_id'
  ),
  'an imported draft becomes institutional authority only after explicit governance approval'
);
SELECT public.sf_test_assert(
  (
    SELECT count(*) = 1 FROM public.sf_import_rows
    WHERE batch_id = :'batch_id' AND duplicate_question_id IS NOT NULL
  ),
  'exact duplicates are flagged and not silently committed'
);
SELECT public.sf_test_assert(
  (
    SELECT count(*) = 1
    FROM public.sf_import_rows
    WHERE batch_id = :'batch_id' AND error = 'Invalid question family'
  ),
  'direct import RPC calls cannot persist noncanonical family values'
);
SELECT public.sf_test_assert(
  (
    SELECT bool_and(family = 'behavioral')
    FROM public.sf_import_rows
    WHERE batch_id = :'batch_id'
  ),
  'reviewed canonical family values persist with every import row'
);
SELECT public.sf_test_assert(
  public.sf_test_expect_sqlstate(
    format(
      'SELECT public.sf_rollback_question_import(%L::uuid)',
      :'batch_id'
    ),
    ARRAY['23514']
  ),
  'an approved imported question makes its source batch non-rollbackable'
);
SELECT public.sf_test_assert(
  (
    SELECT state = 'committed' AND rolled_back_at IS NULL
    FROM public.sf_import_batches
    WHERE id = :'batch_id'
  )
  AND (
    SELECT governance_state = 'approved'
    FROM public.sf_questions
    WHERE id = :'imported_question_id'
  ),
  'a denied rollback leaves the approved question and batch unchanged'
);

SELECT (public.sf_commit_question_import(
  'unused-draft-rollback.csv',
  'csv',
  jsonb_build_array(
    jsonb_build_object(
      'text', 'When did a handoff reveal a hidden assumption in your plan?',
      'family', 'behavioral',
      'selected', true,
      'nearDuplicateReviewed', true
    )
  )
)).id AS rollback_batch_id \gset
SELECT id AS rollback_question_id
FROM public.sf_questions
WHERE import_batch_id = :'rollback_batch_id'
LIMIT 1 \gset
SELECT public.sf_rollback_question_import(:'rollback_batch_id'::uuid);
SELECT public.sf_test_assert(
  (
    SELECT state = 'rolled_back' AND rolled_back_at IS NOT NULL
    FROM public.sf_import_batches
    WHERE id = :'rollback_batch_id'
  )
  AND (
    SELECT count(*) = 0
    FROM public.sf_questions
    WHERE id = :'rollback_question_id'
  )
  AND EXISTS (
    SELECT 1
    FROM public.sf_audit_events
    WHERE action = 'question_import.rolled_back'
      AND entity_id = :'rollback_batch_id'
      AND actor_id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
      AND previous_value->>'state' = 'committed'
      AND new_value->>'state' = 'rolled_back'
      AND new_value->>'retired_question_count' = '1'
  ),
  'an unused draft-only import rollback leaves no active question visible and is append-only audited'
);

SELECT (public.sf_commit_question_import(
  'downstream-use-rollback-block.csv',
  'csv',
  jsonb_build_array(
    jsonb_build_object(
      'text', 'What did you do when an escalation pathway failed during a handoff?',
      'family', 'clinical',
      'selected', true,
      'nearDuplicateReviewed', true
    )
  )
)).id AS downstream_batch_id \gset
SELECT id AS downstream_question_id
FROM public.sf_questions
WHERE import_batch_id = :'downstream_batch_id'
LIMIT 1 \gset
COMMIT;

SELECT public.sf_test_assert(
  (
    SELECT governance_state = 'retired'
    FROM public.sf_questions
    WHERE id = :'rollback_question_id'
  ),
  'successful rollback retires the imported question in place rather than deleting it'
);

INSERT INTO public.sf_story_questions (
  story_id, question_id, student_proposed, proposed_by, proposed_role, why
)
VALUES (
  :'story_id'::uuid,
  :'downstream_question_id'::uuid,
  true,
  '11111111-1111-4111-8111-111111111111'::uuid,
  'student',
  'Legacy downstream-use fixture for rollback safety.'
);

BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', true);
SELECT set_config('request.jwt.claim.app_role', 'admin', true);
SELECT set_config('request.jwt.claim.storyforge_eligible', 'true', true);
SELECT set_config('request.jwt.claim.wp_user_id', '3101', true);
SELECT public.sf_test_assert(
  public.sf_test_expect_sqlstate(
    format(
      'SELECT public.sf_rollback_question_import(%L::uuid)',
      :'downstream_batch_id'
    ),
    ARRAY['23514']
  ),
  'a downstream story-question reference makes a draft import non-rollbackable'
);
SELECT public.sf_test_assert(
  (
    SELECT state = 'committed'
    FROM public.sf_import_batches
    WHERE id = :'downstream_batch_id'
  )
  AND (
    SELECT governance_state = 'draft'
    FROM public.sf_questions
    WHERE id = :'downstream_question_id'
  ),
  'a denied downstream-use rollback leaves the referenced draft and batch unchanged'
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
DROP FUNCTION public.sf_test_expect_sqlstate(text, text[]);

\echo 'STORYFORGE_POSTGRES_SUITE_PASS'
