\set ON_ERROR_STOP on

INSERT INTO public.sf_users (id, wp_user_id, display_name, role, eligible, cohort) VALUES
  ('11111111-1111-4111-8111-111111111111', 1101, 'Maya Student', 'student', true, '2027'),
  ('22222222-2222-4222-8222-222222222222', 1102, 'Noah Student', 'student', true, '2028'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 2101, 'Dr. Chen', 'mentor', true, NULL),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 2102, 'Dr. Rivera', 'mentor', true, NULL),
  ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 2103, 'Dr. Unassigned', 'mentor', true, NULL),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 3101, 'Program Admin', 'admin', true, NULL);

INSERT INTO public.sf_mentor_assignments (student_id, mentor_id, active, assigned_by) VALUES
  ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true, 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'),
  ('11111111-1111-4111-8111-111111111111', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', true, 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'),
  ('22222222-2222-4222-8222-222222222222', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', true, 'cccccccc-cccc-4ccc-8ccc-cccccccccccc');

INSERT INTO public.sf_questions
  (id, text, family, provenance, governance_state, created_by, approved_by, approved_at)
VALUES
  (
    '10000000-0000-4000-8000-000000000001',
    'Tell me about a time you advocated for someone whose needs were not being heard.',
    'advocacy',
    'missionmed',
    'approved',
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    now()
  ),
  (
    '10000000-0000-4000-8000-000000000002',
    'Describe a difficult team decision and how you helped the group move forward.',
    'teamwork',
    'missionmed',
    'approved',
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    now()
  ),
  (
    '10000000-0000-4000-8000-000000000003',
    'What experience changed how you think about responsibility in medicine?',
    'growth',
    'missionmed',
    'approved',
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    now()
  );
