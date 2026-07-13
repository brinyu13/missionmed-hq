-- =============================================================================
-- MMC-020 RLS validation script for staging/local only
-- =============================================================================
-- Requirements covered:
--   * admin allowed
--   * assigned mentor allowed
--   * unassigned mentor denied
--   * student denied
--   * logged-out denied
--   * no production persistence: the script ROLLBACKs all test rows
-- =============================================================================

BEGIN;

SET LOCAL row_security = on;
SET LOCAL ROLE authenticated;
SELECT set_config('mmc.schema_build_target', 'ci', true);

CREATE OR REPLACE FUNCTION pg_temp.mmc020_claims(p_sub uuid, p_mmc_role text)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'sub', p_sub::text,
      'role', 'authenticated',
      'app_metadata', jsonb_build_object('mmc_role', p_mmc_role, 'mm_role', p_mmc_role)
    )::text,
    true
  );
END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.mmc020_assert_eq(p_name text, p_expected bigint, p_actual bigint)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_expected IS DISTINCT FROM p_actual THEN
    RAISE EXCEPTION 'MMC-020 assertion failed: %, expected %, got %', p_name, p_expected, p_actual;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.mmc020_expect_error(p_name text, p_sql text)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  EXECUTE p_sql;
  RAISE EXCEPTION 'MMC-020 expected denial did not occur: %', p_name;
EXCEPTION
  WHEN insufficient_privilege OR check_violation OR with_check_option_violation OR invalid_text_representation THEN
    RETURN;
END;
$$;

DO $$
DECLARE
  v_admin uuid := '00000000-0000-4000-8000-000000000001';
  v_mentor_a_principal uuid := '00000000-0000-4000-8000-000000000002';
  v_mentor_b_principal uuid := '00000000-0000-4000-8000-000000000003';
  v_student_principal uuid := '00000000-0000-4000-8000-000000000004';
  v_subject_a uuid;
  v_subject_b uuid;
  v_mentor_a uuid;
  v_mentor_b uuid;
  v_assignment_a uuid;
  v_assignment_b uuid;
  v_session_a uuid;
  v_memory_a uuid;
BEGIN
  PERFORM pg_temp.mmc020_claims(v_admin, 'admin');

  INSERT INTO mmc.identity_references (
    reference_status,
    primary_anchor_type,
    primary_anchor_hash,
    verification_method,
    verified_by_principal_id,
    verified_at,
    confidence,
    review_status,
    provenance,
    created_by_principal_id
  )
  VALUES
    ('verified', 'staging_subject', 'mmc020-subject-a', 'staging_rls_test', v_admin, now(), 1, 'verified', '{"source":"MMC-020 RLS validation"}', v_admin)
  RETURNING id INTO v_subject_a;

  INSERT INTO mmc.identity_references (
    reference_status,
    primary_anchor_type,
    primary_anchor_hash,
    verification_method,
    verified_by_principal_id,
    verified_at,
    confidence,
    review_status,
    provenance,
    created_by_principal_id
  )
  VALUES
    ('verified', 'staging_subject', 'mmc020-subject-b', 'staging_rls_test', v_admin, now(), 1, 'verified', '{"source":"MMC-020 RLS validation"}', v_admin)
  RETURNING id INTO v_subject_b;

  INSERT INTO mmc.mentors (
    auth_source,
    auth_subject_id,
    display_name,
    role,
    status,
    last_verified_at,
    created_by_principal_id
  )
  VALUES
    ('supabase_auth', v_mentor_a_principal::text, 'MMC-020 Mentor A', 'mentor', 'active', now(), v_admin)
  RETURNING id INTO v_mentor_a;

  INSERT INTO mmc.mentors (
    auth_source,
    auth_subject_id,
    display_name,
    role,
    status,
    last_verified_at,
    created_by_principal_id
  )
  VALUES
    ('supabase_auth', v_mentor_b_principal::text, 'MMC-020 Mentor B', 'mentor', 'active', now(), v_admin)
  RETURNING id INTO v_mentor_b;

  INSERT INTO mmc.mentor_assignments (
    mentor_id,
    subject_ref_id,
    assignment_scope,
    status,
    granted_by_principal_id,
    grant_reason,
    created_by_principal_id
  )
  VALUES
    (v_mentor_a, v_subject_a, 'coaching', 'active', v_admin, 'MMC-020 RLS validation', v_admin)
  RETURNING id INTO v_assignment_a;

  INSERT INTO mmc.mentor_assignments (
    mentor_id,
    subject_ref_id,
    assignment_scope,
    status,
    granted_by_principal_id,
    grant_reason,
    created_by_principal_id
  )
  VALUES
    (v_mentor_b, v_subject_b, 'coaching', 'active', v_admin, 'MMC-020 RLS validation', v_admin)
  RETURNING id INTO v_assignment_b;

  INSERT INTO mmc.coaching_sessions (
    mentor_id,
    assignment_id,
    subject_ref_id,
    session_status,
    session_focus,
    created_by_principal_id
  )
  VALUES (v_mentor_a, v_assignment_a, v_subject_a, 'planned', 'MMC-020 RLS validation', v_admin)
  RETURNING id INTO v_session_a;

  INSERT INTO mmc.mentor_memory (
    mentor_id,
    assignment_id,
    subject_ref_id,
    memory_type,
    memory_text,
    confidence,
    created_by_principal_id
  )
  VALUES (v_mentor_a, v_assignment_a, v_subject_a, 'relationship_context', 'Staging validation memory.', 1, v_admin)
  RETURNING id INTO v_memory_a;

  INSERT INTO mmc.private_notes (
    mentor_id,
    assignment_id,
    subject_ref_id,
    note_body,
    created_by_principal_id
  )
  VALUES (v_mentor_a, v_assignment_a, v_subject_a, 'Staging validation private note.', v_admin);

  INSERT INTO mmc.action_items (
    mentor_id,
    assignment_id,
    subject_ref_id,
    owner_type,
    action_type,
    title,
    created_by_principal_id
  )
  VALUES (v_mentor_a, v_assignment_a, v_subject_a, 'mentor', 'task', 'MMC-020 validation action', v_admin);

  INSERT INTO mmc.goals (
    mentor_id,
    assignment_id,
    subject_ref_id,
    title,
    created_by_principal_id
  )
  VALUES (v_mentor_a, v_assignment_a, v_subject_a, 'MMC-020 validation goal', v_admin);

  INSERT INTO mmc.open_loops (
    mentor_id,
    assignment_id,
    subject_ref_id,
    summary,
    created_by_principal_id
  )
  VALUES (v_mentor_a, v_assignment_a, v_subject_a, 'MMC-020 validation loop', v_admin);

  INSERT INTO mmc.intelligence_snapshots (
    mentor_id,
    assignment_id,
    subject_ref_id,
    snapshot_type,
    summary_json,
    confidence,
    created_by_principal_id
  )
  VALUES (v_mentor_a, v_assignment_a, v_subject_a, 'student_briefing', '{"summary":"MMC-020 validation"}', 1, v_admin);

  INSERT INTO mmc.session_artifacts (
    session_id,
    mentor_id,
    assignment_id,
    subject_ref_id,
    artifact_type,
    title,
    content_body,
    created_by_principal_id
  )
  VALUES (v_session_a, v_mentor_a, v_assignment_a, v_subject_a, 'post_session_summary', 'MMC-020 validation artifact', 'Validation content.', v_admin);

  INSERT INTO mmc.audit_events (
    actor_principal_id,
    actor_role,
    action,
    object_table,
    object_id,
    subject_ref_id,
    assignment_id,
    reason
  )
  VALUES (v_admin, 'admin', 'mmc020_validation_seed', 'coaching_sessions', v_session_a, v_subject_a, v_assignment_a, 'RLS validation');

  PERFORM pg_temp.mmc020_assert_eq('admin sees seeded sessions', 1, (SELECT count(*) FROM mmc.coaching_sessions WHERE id = v_session_a));
  PERFORM pg_temp.mmc020_assert_eq('admin sees seeded private notes', 1, (SELECT count(*) FROM mmc.private_notes WHERE subject_ref_id = v_subject_a));

  PERFORM pg_temp.mmc020_claims(v_mentor_a_principal, 'mentor');

  PERFORM pg_temp.mmc020_assert_eq('assigned mentor sees own assignment', 1, (SELECT count(*) FROM mmc.mentor_assignments WHERE id = v_assignment_a));
  PERFORM pg_temp.mmc020_assert_eq('assigned mentor sees subject reference', 1, (SELECT count(*) FROM mmc.identity_references WHERE id = v_subject_a));
  PERFORM pg_temp.mmc020_assert_eq('assigned mentor sees session', 1, (SELECT count(*) FROM mmc.coaching_sessions WHERE id = v_session_a));
  PERFORM pg_temp.mmc020_assert_eq('assigned mentor sees memory', 1, (SELECT count(*) FROM mmc.mentor_memory WHERE id = v_memory_a));
  PERFORM pg_temp.mmc020_assert_eq('assigned mentor sees private note', 1, (SELECT count(*) FROM mmc.private_notes WHERE subject_ref_id = v_subject_a));

  INSERT INTO mmc.action_items (
    mentor_id,
    assignment_id,
    subject_ref_id,
    owner_type,
    action_type,
    title,
    created_by_principal_id
  )
  VALUES (v_mentor_a, v_assignment_a, v_subject_a, 'mentor', 'follow_up', 'Assigned mentor allowed insert', v_mentor_a_principal);

  PERFORM pg_temp.mmc020_claims(v_mentor_b_principal, 'mentor');

  PERFORM pg_temp.mmc020_assert_eq('unassigned mentor cannot see subject A session', 0, (SELECT count(*) FROM mmc.coaching_sessions WHERE id = v_session_a));
  PERFORM pg_temp.mmc020_assert_eq('unassigned mentor cannot see subject A private note', 0, (SELECT count(*) FROM mmc.private_notes WHERE subject_ref_id = v_subject_a));
  PERFORM pg_temp.mmc020_expect_error(
    'unassigned mentor insert against subject A',
    format(
      'INSERT INTO mmc.action_items (mentor_id, assignment_id, subject_ref_id, owner_type, action_type, title, created_by_principal_id) VALUES (%L, %L, %L, ''mentor'', ''task'', ''forbidden'', %L)',
      v_mentor_b, v_assignment_a, v_subject_a, v_mentor_b_principal
    )
  );

  PERFORM pg_temp.mmc020_claims(v_student_principal, 'student');

  PERFORM pg_temp.mmc020_assert_eq('student cannot see sessions', 0, (SELECT count(*) FROM mmc.coaching_sessions));
  PERFORM pg_temp.mmc020_assert_eq('student cannot see private notes', 0, (SELECT count(*) FROM mmc.private_notes));
  PERFORM pg_temp.mmc020_expect_error(
    'student insert',
    format(
      'INSERT INTO mmc.action_items (mentor_id, assignment_id, subject_ref_id, owner_type, action_type, title, created_by_principal_id) VALUES (%L, %L, %L, ''student'', ''task'', ''forbidden'', %L)',
      v_mentor_a, v_assignment_a, v_subject_a, v_student_principal
    )
  );

  PERFORM set_config('request.jwt.claims', '{}'::text, true);

  PERFORM pg_temp.mmc020_assert_eq('logged-out claims cannot see sessions', 0, (SELECT count(*) FROM mmc.coaching_sessions));
  PERFORM pg_temp.mmc020_expect_error(
    'logged-out insert',
    format(
      'INSERT INTO mmc.action_items (mentor_id, assignment_id, subject_ref_id, owner_type, action_type, title) VALUES (%L, %L, %L, ''mentor'', ''task'', ''forbidden'')',
      v_mentor_a, v_assignment_a, v_subject_a
    )
  );
END $$;

RESET ROLE;
SET LOCAL ROLE anon;

SELECT pg_temp.mmc020_expect_error(
  'anon/logged-out select denied',
  'SELECT count(*) FROM mmc.coaching_sessions'
);

SELECT pg_temp.mmc020_expect_error(
  'anon/logged-out insert denied',
  'INSERT INTO mmc.audit_events (actor_role, action, object_table, reason) VALUES (''anon'', ''forbidden'', ''audit_events'', ''anonymous write should fail'')'
);

ROLLBACK;
