\set ON_ERROR_STOP on

CREATE OR REPLACE FUNCTION public.sf_b1_503_assert(p_ok boolean, p_message text)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT coalesce(p_ok, false) THEN
    RAISE EXCEPTION 'B1-503 ASSERTION FAILED: %', p_message;
  END IF;
  RAISE NOTICE 'PASS: %', p_message;
END
$$;

CREATE OR REPLACE FUNCTION public.sf_b1_503_expect_sqlstate(
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

\echo 'B1-503 DOMAIN: canonical question library and V5 capture'
SELECT public.sf_b1_503_assert(
  (
    SELECT count(*) = 26
      AND count(DISTINCT canonical_key) = 26
      AND bool_and(governance_state = 'approved')
    FROM public.sf_questions
    WHERE canonical_key ~ '^q([1-9]|1[0-9]|2[0-6])$'
  ),
  'canonical interview library contains exactly q1 through q26'
);

\echo 'B1-503 DOMAIN: durable custom-question contract'
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
SELECT set_config('request.jwt.claim.app_role', 'student', true);
SELECT set_config('request.jwt.claim.storyforge_eligible', 'true', true);
SELECT set_config('request.jwt.claim.wp_user_id', '1101', true);
SELECT question.id AS b1_503_custom_question_id
FROM public.sf_create_custom_question(
  '  What did this experience change about how you ask for help?  ',
  'personal',
  'library'
) AS question \gset
SELECT public.sf_b1_503_assert(
  (
    SELECT text = 'What did this experience change about how you ask for help?'
      AND family = 'personal'
      AND provenance = 'student'
      AND owner_student_id = '11111111-1111-4111-8111-111111111111'
      AND governance_state = 'draft'
    FROM public.sf_questions
    WHERE id = :'b1_503_custom_question_id'
  ),
  'custom-question RPC persists normalized owner-private student content'
);
SELECT public.sf_b1_503_assert(
  public.sf_b1_503_expect_sqlstate(
    $$SELECT public.sf_create_custom_question(
      'what did this experience change about how you ask for help?',
      'personal',
      'library'
    )$$,
    ARRAY['23505']
  ),
  'case and whitespace equivalent duplicate is rejected within the visible namespace'
);
SELECT public.sf_b1_503_assert(
  public.sf_b1_503_expect_sqlstate(
    $$SELECT public.sf_create_custom_question('No', 'personal', 'library')$$,
    ARRAY['22023']
  ),
  'custom-question text length is validated'
);
SELECT public.sf_b1_503_assert(
  public.sf_b1_503_expect_sqlstate(
    $$SELECT public.sf_create_custom_question(
      'Which experience best explains that decision?',
      'not-a-family',
      'library'
    )$$,
    ARRAY['22023']
  ),
  'custom-question family is restricted to canonical families'
);
SELECT public.sf_b1_503_assert(
  public.sf_b1_503_expect_sqlstate(
    $$SELECT public.sf_create_custom_question(
      'Which experience best explains that decision?',
      'core',
      'question_library'
    )$$,
    ARRAY['22023']
  ),
  'custom-question audit surface uses the canonical surface vocabulary'
);
SELECT public.sf_b1_503_assert(
  (
    SELECT count(*) = 1
      AND bool_and(actor_id = '11111111-1111-4111-8111-111111111111')
    FROM public.sf_audit_events
    WHERE action = 'question.custom_created'
      AND question_id = :'b1_503_custom_question_id'
  ),
  'custom-question persistence is attributed in append-only audit'
);
SELECT draft.row_version AS b1_503_capture_draft_version
FROM public.sf_save_story_draft(
  jsonb_build_object(
    'title', 'Durable capture draft',
    'text', 'This account-scoped draft must survive a new browser session.',
    'prefixEnabled', true,
    'themes', jsonb_build_array('growth')
  ),
  NULL
) AS draft \gset
SELECT public.sf_b1_503_assert(
  (
    SELECT payload->>'title' = 'Durable capture draft'
      AND payload->>'text' = 'This account-scoped draft must survive a new browser session.'
    FROM public.sf_story_drafts
    WHERE user_id = '11111111-1111-4111-8111-111111111111'
  ),
  'Quick Capture draft persists to the signed student account'
);
COMMIT;

BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
SELECT set_config('request.jwt.claim.app_role', 'student', true);
SELECT set_config('request.jwt.claim.storyforge_eligible', 'true', true);
SELECT set_config('request.jwt.claim.wp_user_id', '1102', true);
SELECT public.sf_b1_503_assert(
  (
    SELECT count(*)
    FROM public.sf_story_drafts
    WHERE user_id = '11111111-1111-4111-8111-111111111111'
  ) = 0,
  'another signed student or device identity cannot read the capture draft'
);
COMMIT;

BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true);
SELECT set_config('request.jwt.claim.app_role', 'mentor', true);
SELECT set_config('request.jwt.claim.storyforge_eligible', 'true', true);
SELECT set_config('request.jwt.claim.wp_user_id', '2101', true);
SELECT question.id AS b1_503_mentor_shared_question_id
FROM public.sf_create_custom_question(
  'What did this experience change about how you ask for help?',
  'personal',
  'library'
) AS question \gset
SELECT public.sf_b1_503_assert(
  (
    SELECT provenance = 'mentor'
      AND owner_student_id IS NULL
      AND governance_state = 'draft'
      AND created_by = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
      AND approved_by IS NULL
      AND approved_at IS NULL
    FROM public.sf_questions
    WHERE id = :'b1_503_mentor_shared_question_id'
  ),
  'mentor single-add becomes an attributed governed draft'
);
SELECT public.sf_b1_503_assert(
  public.sf_b1_503_expect_sqlstate(
    $$SELECT public.sf_create_custom_question(
      '  what did this experience change about how you ask for help? ',
      'personal',
      'library'
    )$$,
    ARRAY['23505']
  ),
  'mentor exact duplicates are rejected across the active global namespace'
);
COMMIT;

BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
SELECT set_config('request.jwt.claim.app_role', 'student', true);
SELECT set_config('request.jwt.claim.storyforge_eligible', 'true', true);
SELECT set_config('request.jwt.claim.wp_user_id', '1101', true);
SELECT public.sf_b1_503_assert(
  (SELECT count(*) FROM public.sf_questions WHERE id = :'b1_503_mentor_shared_question_id') = 0,
  'student library does not expose an unapproved institutional draft'
);
SELECT public.sf_b1_503_assert(
  public.sf_b1_503_expect_sqlstate(
    format(
      'SELECT public.sf_approve_question(%L::uuid, %L)',
      :'b1_503_mentor_shared_question_id',
      'library'
    ),
    ARRAY['42501']
  ),
  'student cannot approve an institutional draft'
);
COMMIT;

BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', true);
SELECT set_config('request.jwt.claim.app_role', 'admin', true);
SELECT set_config('request.jwt.claim.storyforge_eligible', 'true', true);
SELECT set_config('request.jwt.claim.wp_user_id', '3101', true);
SELECT public.sf_b1_503_assert(
  public.sf_b1_503_expect_sqlstate(
    $$SELECT public.sf_create_custom_question(
      'Admin single-add must remain governed.',
      'custom',
      'library'
    )$$,
    ARRAY['42501']
  ),
  'admin cannot bypass the governed import workflow with single-add'
);
SELECT public.sf_b1_503_assert(
  (SELECT count(*) FROM public.sf_questions WHERE id = :'b1_503_custom_question_id') = 0,
  'admin cannot read a student-personal question by direct id'
);
SELECT public.sf_b1_503_assert(
  (SELECT count(*) FROM public.sf_questions WHERE id = :'b1_503_mentor_shared_question_id') = 1,
  'admin governance can read a global mentor draft'
);
SELECT public.sf_b1_503_assert(
  public.sf_b1_503_expect_sqlstate(
    format(
      'SELECT public.sf_approve_question(%L::uuid, %L)',
      :'b1_503_custom_question_id',
      'library'
    ),
    ARRAY['42501']
  ),
  'student personal drafts cannot be converted into institutional authority'
);
SELECT public.sf_approve_question(:'b1_503_mentor_shared_question_id'::uuid, 'library');
SELECT public.sf_b1_503_assert(
  (
    SELECT governance_state = 'approved'
      AND approved_by = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
      AND approved_at IS NOT NULL
    FROM public.sf_questions
    WHERE id = :'b1_503_mentor_shared_question_id'
  ),
  'explicit admin confirmation approves a governed mentor draft'
);
SELECT public.sf_b1_503_assert(
  (
    SELECT count(*) = 1
      AND bool_and(actor_id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc')
      AND bool_and(previous_value->>'governance_state' = 'draft')
      AND bool_and(new_value->>'governance_state' = 'approved')
    FROM public.sf_audit_events
    WHERE action = 'question.approved'
      AND question_id = :'b1_503_mentor_shared_question_id'
  ),
  'question approval is explicit and append-only audited'
);
COMMIT;

BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
SELECT set_config('request.jwt.claim.app_role', 'student', true);
SELECT set_config('request.jwt.claim.storyforge_eligible', 'true', true);
SELECT set_config('request.jwt.claim.wp_user_id', '1101', true);
SELECT public.sf_b1_503_assert(
  (SELECT count(*) FROM public.sf_questions WHERE id = :'b1_503_mentor_shared_question_id') = 1,
  'approved institutional question becomes visible to students'
);
SELECT public.sf_b1_503_assert(
  (
    SELECT payload->>'title' = 'Durable capture draft'
    FROM public.sf_story_drafts
    WHERE user_id = '11111111-1111-4111-8111-111111111111'
  ),
  'capture draft restores in a later authenticated transaction'
);
SELECT draft.row_version AS b1_503_capture_final_version
FROM public.sf_save_story_draft(
  jsonb_build_object(
    'title', 'B1-503 canonical domain proof',
    'text', 'I noticed that the family had not been invited into the decision, paused the team, and made their goal explicit.',
    'captureType', 'text',
    'prefixEnabled', true,
    'lesson', 'Silence is a signal to invite the patient back into the plan.',
    'studentScore', 4,
    'themes', jsonb_build_array('advoc', 'comm'),
    'uses', jsonb_build_array('iv', 'ps')
  ),
  :'b1_503_capture_draft_version'::bigint
) AS draft \gset
SELECT public.sf_b1_503_assert(
  :'b1_503_capture_final_version'::bigint
    = :'b1_503_capture_draft_version'::bigint + 1,
  'the first version-zero draft update advances its concurrency token'
);
SELECT public.sf_b1_503_assert(
  public.sf_b1_503_expect_sqlstate(
    format(
      'SELECT public.sf_save_story_draft(%L::jsonb, %s::bigint)',
      '{"title":"competing stale overwrite"}',
      :'b1_503_capture_draft_version'
    ),
    ARRAY['40001']
  ),
  'a competing update cannot reuse the original version-zero draft token'
);

SELECT story.id AS b1_503_story_id, story.row_version AS b1_503_initial_version
FROM public.sf_create_story_v5(
  jsonb_build_object(
    'title', 'B1-503 canonical domain proof',
    'text', 'I noticed that the family had not been invited into the decision, paused the team, and made their goal explicit.',
    'captureType', 'text',
    'prefixEnabled', true,
    'lesson', 'Silence is a signal to invite the patient back into the plan.',
    'studentScore', 4,
    'themes', jsonb_build_array('advoc', 'comm'),
    'uses', jsonb_build_array('iv', 'ps'),
    'draftVersion', :'b1_503_capture_final_version'::bigint
  ),
  'quick'
) AS story \gset

SELECT public.sf_b1_503_assert(
  (
    SELECT status = 'private'
      AND prefix_enabled
      AND lesson <> ''
      AND themes = ARRAY['advoc', 'comm']::text[]
      AND uses = ARRAY['iv', 'ps']::text[]
      AND student_score = 4
    FROM public.sf_stories
    WHERE id = :'b1_503_story_id'
  ),
  'V5 capture persists canonical student-owned fields'
);
SELECT public.sf_b1_503_assert(
  (
    SELECT original_transcript = (
      SELECT original_text
      FROM public.sf_stories
      WHERE id = :'b1_503_story_id'
    )
    FROM public.sf_story_originals
    WHERE story_id = :'b1_503_story_id'
  ),
  'capture creates a separate exact original artifact'
);
SELECT public.sf_b1_503_assert(
  (
    SELECT payload = '{}'::jsonb
      AND row_version = :'b1_503_capture_final_version'::bigint + 1
    FROM public.sf_story_drafts
    WHERE user_id = '11111111-1111-4111-8111-111111111111'
  )
  AND EXISTS (
    SELECT 1
    FROM public.sf_audit_events
    WHERE action = 'story.draft_consumed'
      AND story_id = :'b1_503_story_id'
      AND actor_id = '11111111-1111-4111-8111-111111111111'
  ),
  'story capture atomically consumes the exact durable draft version'
);

SELECT updated.row_version AS b1_503_current_version
FROM public.sf_update_story_v5(
  :'b1_503_story_id'::uuid,
  jsonb_build_object(
    'text', 'I noticed that the family had not been invited into the decision, paused the team, named the risk, and made their goal explicit.',
    'lesson', 'I now ask whose goal is missing before a plan becomes final.',
    'studentStar', true
  ),
  :'b1_503_initial_version'::bigint,
  'workspace'
) AS updated \gset

SELECT public.sf_b1_503_assert(
  public.sf_b1_503_expect_sqlstate(
    format(
      'SELECT public.sf_update_story_v5(%L::uuid, %L::jsonb, %s::bigint, %L)',
      :'b1_503_story_id',
      '{"lesson":"stale overwrite"}',
      :'b1_503_initial_version',
      'workspace'
    ),
    ARRAY['40001']
  ),
  'stale optimistic-concurrency write is rejected'
);
SELECT public.sf_b1_503_assert(
  public.sf_b1_503_expect_sqlstate(
    format(
      'SELECT public.sf_update_story_evaluation(%L::uuid, %L::jsonb, %L)',
      :'b1_503_story_id',
      '{"mentorScore":5}',
      'workspace'
    ),
    ARRAY['42501']
  ),
  'student cannot mutate mentor-owned evaluation fields'
);
SELECT public.sf_b1_503_assert(
  public.sf_b1_503_expect_sqlstate(
    format(
      'SELECT public.sf_update_story_evaluation(%L::uuid, %L::jsonb, %L)',
      :'b1_503_story_id',
      '{"needsFollowup":true,"classification":"clinical","reviewedBy":"forged"}',
      'workspace'
    ),
    ARRAY['42501']
  ),
  'student evaluation allowlist rejects mentor lifecycle, scalar classification, and review metadata'
);
SELECT public.sf_b1_503_assert(
  (
    SELECT NOT needs_followup
      AND classification IS NULL
      AND reviewed_by IS NULL
    FROM public.sf_stories
    WHERE id = :'b1_503_story_id'
  ),
  'rejected student evaluation metadata leaves the story unchanged'
);

SELECT pair.id AS b1_503_pair_id
FROM public.sf_upsert_story_question(
  :'b1_503_story_id'::uuid,
  '50300000-0000-4000-8000-000000000016'::uuid,
  jsonb_build_object(
    'strength', 4,
    'why', 'The answer shows a clinical decision, escalation, and result.',
    'clinical', true,
    'notes', 'Name the decision point before the result.'
  ),
  'workshop'
) AS pair \gset
SELECT public.sf_b1_503_assert(
  (
    SELECT state = 'suggested'
      AND student_strength = 4
      AND mentor_strength IS NULL
      AND student_proposed
      AND NOT mentor_confirmed
    FROM public.sf_story_questions
    WHERE id = :'b1_503_pair_id'
  ),
  'student suggestion and strength remain student-owned'
);
SELECT public.sf_set_question_preference(
  '11111111-1111-4111-8111-111111111111'::uuid,
  '50300000-0000-4000-8000-000000000016'::uuid,
  :'b1_503_story_id'::uuid,
  'workshop'
);
SELECT followup.id AS b1_503_student_followup_id
FROM public.sf_add_pair_followup(
  :'b1_503_pair_id'::uuid,
  'What changed in the plan because you spoke up?',
  true,
  false,
  '',
  'workshop'
) AS followup \gset
SELECT public.sf_set_story_archived(:'b1_503_story_id'::uuid, true, 'library');
SELECT public.sf_b1_503_assert(
  public.sf_b1_503_expect_sqlstate(
    format(
      'SELECT public.sf_remove_story_question(%L::uuid, %L)',
      :'b1_503_pair_id',
      'workshop'
    ),
    ARRAY['P0002']
  ),
  'an archived story pair cannot be removed by retained direct id'
);
SELECT public.sf_b1_503_assert(
  public.sf_b1_503_expect_sqlstate(
    format(
      'SELECT public.sf_remove_pair_followup(%L::uuid, %L)',
      :'b1_503_student_followup_id',
      'workshop'
    ),
    ARRAY['P0002']
  ),
  'an archived story follow-up cannot be removed by retained direct id'
);
SELECT public.sf_set_story_archived(:'b1_503_story_id'::uuid, false, 'library');
SELECT public.sf_b1_503_assert(
  (
    SELECT archived_at IS NULL AND archived_by IS NULL
    FROM public.sf_stories
    WHERE id = :'b1_503_story_id'
  )
  AND (
    SELECT state = 'suggested'
    FROM public.sf_story_questions
    WHERE id = :'b1_503_pair_id'
  )
  AND (
    SELECT removed_at IS NULL
    FROM public.sf_pair_followups
    WHERE id = :'b1_503_student_followup_id'
  ),
  'restoring the story preserves its active pair and follow-up'
);

SELECT public.sf_submit_story(:'b1_503_story_id'::uuid, 'workspace');
SELECT public.sf_b1_503_assert(
  (
    SELECT status = 'awaiting'
      AND submitted_at IS NOT NULL
      AND last_submitted_at IS NOT NULL
    FROM public.sf_stories
    WHERE id = :'b1_503_story_id'
  ),
  'explicit submit enters canonical awaiting-review state'
);
COMMIT;

\echo 'B1-503 IMMUTABILITY: originals and revisions are append-only'
SELECT public.sf_b1_503_assert(
  public.sf_b1_503_expect_sqlstate(
    format(
      'UPDATE public.sf_story_originals SET original_transcript = %L WHERE story_id = %L::uuid',
      'forbidden rewrite',
      :'b1_503_story_id'
    ),
    ARRAY['42501']
  ),
  'original artifact rejects UPDATE even for a privileged database actor'
);
SELECT public.sf_b1_503_assert(
  public.sf_b1_503_expect_sqlstate(
    format(
      'DELETE FROM public.sf_story_originals WHERE story_id = %L::uuid',
      :'b1_503_story_id'
    ),
    ARRAY['42501']
  ),
  'original artifact rejects DELETE'
);
SELECT public.sf_b1_503_assert(
  public.sf_b1_503_expect_sqlstate(
    format(
      'UPDATE public.sf_story_revisions SET text_snapshot = %L WHERE story_id = %L::uuid',
      'forbidden rewrite',
      :'b1_503_story_id'
    ),
    ARRAY['42501']
  ),
  'revision history rejects UPDATE'
);

UPDATE public.sf_questions
SET governance_state = 'retired',
    updated_at = now()
WHERE id = :'b1_503_custom_question_id';

BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
SELECT set_config('request.jwt.claim.app_role', 'student', true);
SELECT set_config('request.jwt.claim.storyforge_eligible', 'true', true);
SELECT set_config('request.jwt.claim.wp_user_id', '1101', true);
SELECT public.sf_b1_503_assert(
  public.sf_b1_503_expect_sqlstate(
    format(
      'SELECT public.sf_upsert_story_question(%L::uuid, %L::uuid, %L::jsonb, %L)',
      :'b1_503_story_id',
      :'b1_503_custom_question_id',
      '{"strength":3}',
      'workshop'
    ),
    ARRAY['P0002']
  ),
  'a retired owner-custom question cannot be newly mapped to a story'
);
COMMIT;

\echo 'B1-503 MENTOR: review, attribution, workshop, teaching, and 1:1'
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true);
SELECT set_config('request.jwt.claim.app_role', 'mentor', true);
SELECT set_config('request.jwt.claim.storyforge_eligible', 'true', true);
SELECT set_config('request.jwt.claim.wp_user_id', '2101', true);

SELECT public.sf_b1_503_assert(
  public.sf_b1_503_expect_sqlstate(
    format(
      'SELECT public.sf_start_coaching_session(%L::uuid, %L::jsonb)',
      '11111111-1111-4111-8111-111111111111',
      jsonb_build_array(
        jsonb_build_object(
          'label', 'Retired question must not enter the agenda',
          'questionId', :'b1_503_custom_question_id'
        )
      )::text
    ),
    ARRAY['P0002']
  ),
  'a retired owner-custom question cannot be added to a coaching-session agenda'
);
SELECT public.sf_record_story_view(:'b1_503_story_id'::uuid, 'quick');
SELECT public.sf_b1_503_assert(
  (
    SELECT status = 'awaiting' AND opened_at IS NOT NULL
    FROM public.sf_stories
    WHERE id = :'b1_503_story_id'
  ),
  'mentor opening is audited without silently changing lifecycle status'
);
SELECT public.sf_set_story_status(:'b1_503_story_id'::uuid, 'in_review', 'workspace');
SELECT public.sf_upsert_story_question(
  :'b1_503_story_id'::uuid,
  '50300000-0000-4000-8000-000000000016'::uuid,
  jsonb_build_object(
    'strength', 5,
    'notes', 'Preserve the exact decision and what changed.',
    'clinical', true
  ),
  'workshop'
);
SELECT public.sf_b1_503_assert(
  (
    SELECT state = 'confirmed'
      AND mentor_confirmed
      AND mentor_strength = 5
      AND confirmed_by = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
      AND confirmed_at IS NOT NULL
    FROM public.sf_story_questions
    WHERE id = :'b1_503_pair_id'
  ),
  'mentor upsert atomically confirms an existing student-suggested pair'
);
SELECT public.sf_review_story_question(
  :'b1_503_pair_id'::uuid,
  'confirmed',
  NULL,
  'workshop'
);
SELECT public.sf_add_story_feedback(
  :'b1_503_story_id'::uuid,
  'The action is clear. Keep the family’s stated goal in the first two sentences.',
  'feedback',
  'workspace'
);
SELECT public.sf_set_story_status(:'b1_503_story_id'::uuid, 'changes', 'workspace');
SELECT public.sf_add_story_reflection(
  :'b1_503_story_id'::uuid,
  'What did the team do differently after you named the family’s goal?',
  'workspace'
);
SELECT public.sf_update_story_evaluation(
  :'b1_503_story_id'::uuid,
  jsonb_build_object(
    'mentorScore', 5,
    'mentorStar', true,
    'birds', jsonb_build_array('owl', 'eagle'),
    'positions', jsonb_build_array('pd', 'faculty'),
    'needsFollowup', true,
    'classification', 'clinical'
  ),
  'workspace'
);
SELECT public.sf_update_story_craft(
  :'b1_503_story_id'::uuid,
  '{"detail":3,"stakes":3,"turn":3,"honest":3,"lesson":3}'::jsonb,
  'teach'
);
SELECT public.sf_add_question_coaching_note(
  '11111111-1111-4111-8111-111111111111'::uuid,
  '50300000-0000-4000-8000-000000000016'::uuid,
  :'b1_503_story_id'::uuid,
  'Prepare the next question about escalation criteria.',
  'workshop'
);
SELECT followup.id AS b1_503_mentor_followup_id
FROM public.sf_add_pair_followup(
  :'b1_503_pair_id'::uuid,
  'What alternatives did you consider before escalating?',
  true,
  true,
  'Name one alternative and why it was less safe.',
  'workshop'
) AS followup \gset

SELECT session.id AS b1_503_session_id
FROM public.sf_start_coaching_session(
  '11111111-1111-4111-8111-111111111111'::uuid,
  jsonb_build_array(
    jsonb_build_object(
      'label', 'Review the decision point',
      'storyId', :'b1_503_story_id',
      'questionId', '50300000-0000-4000-8000-000000000016',
      'route', '/prep'
    )
  )
) AS session \gset
SELECT item.id AS b1_503_session_item_id
FROM public.sf_coaching_session_items item
WHERE item.session_id = :'b1_503_session_id'
ORDER BY item.sort_order
LIMIT 1 \gset
SELECT public.sf_toggle_coaching_session_item(:'b1_503_session_item_id'::uuid, true);

SELECT public.sf_b1_503_assert(
  public.sf_b1_503_expect_sqlstate(
    format(
      'SELECT public.sf_update_story_evaluation(%L::uuid, %L::jsonb, %L)',
      :'b1_503_story_id',
      '{"studentScore":1}',
      'workspace'
    ),
    ARRAY['42501']
  ),
  'mentor cannot mutate student-owned evaluation fields'
);
COMMIT;

SELECT public.sf_b1_503_assert(
  (
    SELECT status = 'changes'
      AND mentor_score = 5
      AND mentor_star
      AND birds = ARRAY['owl', 'eagle']::text[]
      AND positions = ARRAY['pd', 'faculty']::text[]
    FROM public.sf_stories
    WHERE id = :'b1_503_story_id'
  )
  AND EXISTS (
    SELECT 1
    FROM public.sf_audit_events
    WHERE story_id = :'b1_503_story_id'
      AND action = 'story.evaluation_updated'
      AND actor_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid
  ),
  'mentor lifecycle and classification changes persist with attribution'
);
SELECT public.sf_b1_503_assert(
  (
    SELECT state = 'confirmed'
      AND student_strength = 4
      AND mentor_strength = 5
      AND confirmed_by = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid
    FROM public.sf_story_questions
    WHERE id = :'b1_503_pair_id'
  ),
  'question pair preserves separate student and mentor judgments'
);
SELECT public.sf_b1_503_assert(
  (
    SELECT detail + stakes + turn + honest + lesson = 15
      AND scored_by = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid
    FROM public.sf_story_craft
    WHERE story_id = :'b1_503_story_id'
  ),
  'Teaching Mode craft anatomy is persisted and attributed'
);
SELECT public.sf_b1_503_assert(
  (
    SELECT state = 'active'
      AND ended_at IS NULL
    FROM public.sf_coaching_sessions
    WHERE id = :'b1_503_session_id'
  )
  AND (
    SELECT completed AND completed_at IS NOT NULL
    FROM public.sf_coaching_session_items
    WHERE id = :'b1_503_session_item_id'
  ),
  'active 1:1 agenda remains durable before completion'
);
SELECT public.sf_b1_503_assert(
  (
    SELECT count(*) = 1
      AND bool_and(event_category = 'status')
      AND bool_and(body LIKE '%New feedback is attached.%')
    FROM public.sf_notifications
    WHERE recipient_id = '11111111-1111-4111-8111-111111111111'
      AND story_id = :'b1_503_story_id'
      AND read_at IS NULL
  ),
  'transaction-bound mentor actions coalesce into one truthful unread notification'
);

\echo 'B1-503 AUTH: assignment revocation closes retained active-session and audit IDs'
UPDATE public.sf_mentor_assignments
SET active = false
WHERE student_id = '11111111-1111-4111-8111-111111111111'
  AND mentor_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true);
SELECT set_config('request.jwt.claim.app_role', 'mentor', true);
SELECT set_config('request.jwt.claim.storyforge_eligible', 'true', true);
SELECT set_config('request.jwt.claim.wp_user_id', '2101', true);
SELECT public.sf_b1_503_assert(
  (SELECT count(*) FROM public.sf_coaching_sessions WHERE id = :'b1_503_session_id') = 0
  AND (SELECT count(*) FROM public.sf_coaching_session_items WHERE id = :'b1_503_session_item_id') = 0,
  'revoked mentor reads zero retained coaching-session rows by direct id'
);
SELECT public.sf_b1_503_assert(
  (
    SELECT count(*)
    FROM public.sf_audit_events
    WHERE student_id = '11111111-1111-4111-8111-111111111111'
       OR story_id = :'b1_503_story_id'
  ) = 0,
  'revoked mentor reads zero student or story activity details, including own prior actions'
);
SELECT public.sf_b1_503_assert(
  public.sf_b1_503_expect_sqlstate(
    format(
      'SELECT public.sf_toggle_coaching_session_item(%L::uuid, false)',
      :'b1_503_session_item_id'
    ),
    ARRAY['P0002', '42501']
  ),
  'revoked mentor cannot mutate a retained active-session item id'
);
SELECT public.sf_b1_503_assert(
  public.sf_b1_503_expect_sqlstate(
    format(
      'SELECT public.sf_end_coaching_session(%L::uuid, %L)',
      :'b1_503_session_id',
      'forbidden after revocation'
    ),
    ARRAY['P0002', '42501']
  ),
  'revoked mentor cannot end a retained active-session id'
);
COMMIT;

SELECT public.sf_b1_503_assert(
  (
    SELECT state = 'active' AND ended_at IS NULL
    FROM public.sf_coaching_sessions
    WHERE id = :'b1_503_session_id'
  )
  AND (
    SELECT completed
    FROM public.sf_coaching_session_items
    WHERE id = :'b1_503_session_item_id'
  ),
  'denied retained-id calls leave the active session unchanged'
);

UPDATE public.sf_mentor_assignments
SET active = true
WHERE student_id = '11111111-1111-4111-8111-111111111111'
  AND mentor_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

\echo 'B1-503 STUDENT: editing after requested changes is the canonical resubmission'
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
SELECT set_config('request.jwt.claim.app_role', 'student', true);
SELECT set_config('request.jwt.claim.storyforge_eligible', 'true', true);
SELECT set_config('request.jwt.claim.wp_user_id', '1101', true);
SELECT row_version AS b1_503_pre_resubmit_version
FROM public.sf_stories
WHERE id = :'b1_503_story_id' \gset
SELECT public.sf_update_story_v5(
  :'b1_503_story_id'::uuid,
  jsonb_build_object(
    'text',
    'I noticed that the family had not been invited into the decision, paused the team, named the risk, made their goal explicit, and verified the revised plan with them.'
  ),
  :'b1_503_pre_resubmit_version'::bigint,
  'workspace'
);
SELECT public.sf_b1_503_assert(
  (
    SELECT status = 'awaiting'
      AND revised
      AND student_responded_at IS NOT NULL
      AND last_submitted_at = student_responded_at
      AND status_changed_at = student_responded_at
    FROM public.sf_stories
    WHERE id = :'b1_503_story_id'
  ),
  'editing the Working Version after changes automatically returns it to awaiting review'
);
SELECT public.sf_b1_503_assert(
  EXISTS (
    SELECT 1
    FROM public.sf_audit_events
    WHERE story_id = :'b1_503_story_id'
      AND action = 'story.revised_and_resubmitted'
      AND actor_id = '11111111-1111-4111-8111-111111111111'
      AND previous_value->>'status' = 'changes'
      AND new_value->>'status' = 'awaiting'
  )
  AND EXISTS (
    SELECT 1
    FROM public.sf_story_revisions
    WHERE story_id = :'b1_503_story_id'
      AND reason = 'resubmit'
  ),
  'automatic revision resubmission is attributed in immutable revision and audit history'
);
COMMIT;

BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true);
SELECT set_config('request.jwt.claim.app_role', 'mentor', true);
SELECT set_config('request.jwt.claim.storyforge_eligible', 'true', true);
SELECT set_config('request.jwt.claim.wp_user_id', '2101', true);
SELECT public.sf_end_coaching_session(
  :'b1_503_session_id'::uuid,
  'Prepared the clinical decision and escalation follow-up.'
);
COMMIT;
SELECT public.sf_b1_503_assert(
  (
    SELECT state = 'completed'
      AND ended_at IS NOT NULL
      AND summary <> ''
    FROM public.sf_coaching_sessions
    WHERE id = :'b1_503_session_id'
  ),
  're-authorized assigned mentor can explicitly complete the durable 1:1'
);

\echo 'B1-503 AUTH: unassigned mentor and admin cannot access story derivatives'
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', true);
SELECT set_config('request.jwt.claim.app_role', 'mentor', true);
SELECT set_config('request.jwt.claim.storyforge_eligible', 'true', true);
SELECT set_config('request.jwt.claim.wp_user_id', '2103', true);
SELECT public.sf_b1_503_assert(
  (SELECT count(*) FROM public.sf_stories WHERE id = :'b1_503_story_id') = 0,
  'unassigned mentor cannot read the submitted story'
);
SELECT public.sf_b1_503_assert(
  (SELECT count(*) FROM public.sf_pair_followups WHERE story_question_id = :'b1_503_pair_id') = 0
  AND (SELECT count(*) FROM public.sf_story_craft WHERE story_id = :'b1_503_story_id') = 0
  AND (SELECT count(*) FROM public.sf_question_preferences WHERE story_id = :'b1_503_story_id') = 0,
  'unassigned mentor cannot read pair, craft, or preferred-answer derivatives'
);
SELECT public.sf_b1_503_assert(
  public.sf_b1_503_expect_sqlstate(
    format(
      'SELECT public.sf_review_story_question(%L::uuid, %L, NULL, %L)',
      :'b1_503_pair_id',
      'confirmed',
      'workshop'
    ),
    ARRAY['P0002', '42501']
  ),
  'unassigned mentor cannot confirm a pair by crafted RPC'
);
SELECT public.sf_b1_503_assert(
  public.sf_b1_503_expect_sqlstate(
    format(
      'SELECT public.sf_start_coaching_session(%L::uuid, %L::jsonb)',
      '11111111-1111-4111-8111-111111111111',
      '[]'
    ),
    ARRAY['42501']
  ),
  'unassigned mentor cannot start a student coaching session'
);
COMMIT;

BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', true);
SELECT set_config('request.jwt.claim.app_role', 'admin', true);
SELECT set_config('request.jwt.claim.storyforge_eligible', 'true', true);
SELECT set_config('request.jwt.claim.wp_user_id', '3101', true);
SELECT public.sf_b1_503_assert(
  (SELECT count(*) FROM public.sf_stories WHERE id = :'b1_503_story_id') = 0,
  'admin retains no private or submitted story support override'
);
SELECT public.sf_b1_503_assert(
  (SELECT count(*) FROM public.sf_story_questions WHERE id = :'b1_503_pair_id') = 0
  AND (SELECT count(*) FROM public.sf_pair_followups WHERE story_question_id = :'b1_503_pair_id') = 0
  AND (SELECT count(*) FROM public.sf_story_craft WHERE story_id = :'b1_503_story_id') = 0
  AND (SELECT count(*) FROM public.sf_question_preferences WHERE story_id = :'b1_503_story_id') = 0
  AND (SELECT count(*) FROM public.sf_coaching_sessions WHERE id = :'b1_503_session_id') = 0,
  'admin cannot read student-specific pair, craft, preference, or coaching derivatives'
);
SELECT public.sf_b1_503_assert(
  public.sf_b1_503_expect_sqlstate(
    format(
      'SELECT public.sf_set_question_preference(%L::uuid, %L::uuid, %L::uuid, %L)',
      '11111111-1111-4111-8111-111111111111',
      '50300000-0000-4000-8000-000000000016',
      :'b1_503_story_id',
      'workshop'
    ),
    ARRAY['42501']
  ),
  'admin cannot mutate a student preferred answer'
);
COMMIT;

\echo 'B1-503 STUDENT: mentor work is readable, opening is transactional, and asks are answerable'
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
SELECT set_config('request.jwt.claim.app_role', 'student', true);
SELECT set_config('request.jwt.claim.storyforge_eligible', 'true', true);
SELECT set_config('request.jwt.claim.wp_user_id', '1101', true);
SELECT public.sf_b1_503_assert(
  (SELECT count(*) FROM public.sf_feedback WHERE story_id = :'b1_503_story_id') = 1
  AND (SELECT count(*) FROM public.sf_question_coaching_notes WHERE story_id = :'b1_503_story_id') = 1
  AND (SELECT count(*) FROM public.sf_pair_followups WHERE story_question_id = :'b1_503_pair_id') = 2
  AND (SELECT count(*) FROM public.sf_coaching_sessions WHERE id = :'b1_503_session_id') = 1,
  'student can read attributed mentor feedback, coaching, follow-ups, and 1:1 history'
);
SELECT reflection.id AS b1_503_reflection_id
FROM public.sf_story_reflections reflection
WHERE reflection.story_id = :'b1_503_story_id'
  AND reflection.from_mentor
ORDER BY reflection.created_at DESC
LIMIT 1 \gset
SELECT public.sf_record_story_view(:'b1_503_story_id'::uuid, 'workspace');
SELECT public.sf_b1_503_assert(
  (
    SELECT seen_by_student_at IS NOT NULL
    FROM public.sf_feedback
    WHERE story_id = :'b1_503_story_id'
  )
  AND (
    SELECT seen_by_student_at IS NOT NULL
    FROM public.sf_story_reflections
    WHERE id = :'b1_503_reflection_id'
  )
  AND (
    SELECT count(*) = 0
    FROM public.sf_notifications
    WHERE story_id = :'b1_503_story_id'
      AND read_at IS NULL
  ),
  'opening a story marks feedback, mentor asks, and story notifications together'
);
SELECT public.sf_answer_story_reflection(
  :'b1_503_reflection_id'::uuid,
  'The resident repeated the goal, changed the plan, and invited the family to confirm it.',
  'workspace'
);
SELECT public.sf_b1_503_assert(
  (
    SELECT answer <> '' AND answered_at IS NOT NULL
    FROM public.sf_story_reflections
    WHERE id = :'b1_503_reflection_id'
  )
  AND (
    SELECT revised AND student_responded_at IS NOT NULL
    FROM public.sf_stories
    WHERE id = :'b1_503_story_id'
  ),
  'student answer to a mentor ask is durable and auditable'
);
SELECT public.sf_b1_503_assert(
  public.sf_mark_all_notifications_read() >= 0,
  'mark-all-read remains owner-scoped and callable'
);
COMMIT;

\echo 'B1-503 MENTOR: an existing empty 1:1 receives a durable truthful agenda'
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', true);
SELECT set_config('request.jwt.claim.app_role', 'mentor', true);
SELECT set_config('request.jwt.claim.storyforge_eligible', 'true', true);
SELECT set_config('request.jwt.claim.wp_user_id', '2102', true);
SELECT session.id AS b1_503_backfill_session_id
FROM public.sf_start_coaching_session(
  '22222222-2222-4222-8222-222222222222'::uuid,
  '[]'::jsonb
) AS session \gset
SELECT public.sf_start_coaching_session(
  '22222222-2222-4222-8222-222222222222'::uuid,
  jsonb_build_array(
    jsonb_build_object(
      'label', 'Find a story for “Tell me about yourself.”',
      'questionId', '50300000-0000-4000-8000-000000000001',
      'route', '/prep'
    )
  )
);
SELECT public.sf_b1_503_assert(
  (
    SELECT count(*) = 1
      AND bool_and(question_id = '50300000-0000-4000-8000-000000000001')
      AND bool_and(route = '/prep')
    FROM public.sf_coaching_session_items
    WHERE session_id = :'b1_503_backfill_session_id'
  ),
  'empty active 1:1 is transactionally backfilled with a persisted question agenda item'
);
SELECT public.sf_b1_503_assert(
  (
    SELECT count(*) = 1
    FROM public.sf_audit_events
    WHERE action = 'coaching.session_agenda_initialized'
      AND entity_id = :'b1_503_backfill_session_id'
      AND new_value->>'agenda_count' = '1'
  ),
  '1:1 agenda backfill is separately attributed in append-only audit'
);
SELECT public.sf_end_coaching_session(
  :'b1_503_backfill_session_id'::uuid,
  'Validated durable agenda initialization.'
);
COMMIT;

SELECT public.sf_b1_503_assert(
  (
    SELECT count(*) >= 10
      AND count(*) FILTER (WHERE actor_display IS NULL) = 0
      AND count(DISTINCT actor_id) >= 2
    FROM public.sf_audit_events
    WHERE story_id = :'b1_503_story_id'
  ),
  'expanded story history is append-only, attributed, and cross-workflow'
);

DROP FUNCTION public.sf_b1_503_assert(boolean, text);
DROP FUNCTION public.sf_b1_503_expect_sqlstate(text, text[]);

\echo 'STORYFORGE_B1_503_CONFORMANCE_SUITE_PASS'
