-- Migration: 20260901121000_hb_360a_001_session_a_seed.sql
-- Ticket: HB-360A-001
-- Target: dedicated HomeBase PostgreSQL service only.
-- Purpose: authoritative initial Session A hydration (hard allowlist from ticket
--          HB-360A-001 section 5) plus the default Session A checklist taxonomy
--          translated from the legacy Master Roster tracking sheet.
-- Rules honored:
--   * ONLY the twelve supplied people are hydrated. No other source may add rows.
--   * Missing fields are never guessed. They are stored as NULL and flagged.
--   * wp_user_id starts NULL everywhere; identity binding happens at runtime from
--     signed WordPress claims (email first, then username), or by admin review.
-- Reversibility: additive seed rows keyed by stable natural keys; ON CONFLICT DO NOTHING.

BEGIN;

INSERT INTO public.hb_programs (key, name)
VALUES ('360-match-mentorship', '360 Match Mentorship')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.hb_sessions (program_id, key, name, active)
SELECT p.id, '360-session-a', '360 Match Mentorship — Session A', true
FROM public.hb_programs p
WHERE p.key = '360-match-mentorship'
ON CONFLICT (key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- HARD ALLOWLIST — HB-360A-001 section 5. Do not extend without + ADD STUDENT.
-- ---------------------------------------------------------------------------
WITH session_a AS (
  SELECT id FROM public.hb_sessions WHERE key = '360-session-a'
),
roster (first_name, last_name, email, username, identity_status, identity_note) AS (
  VALUES
    ('Afthab', 'Salam', 'afthab.fabu@gmail.com', 'afthabs', 'pending', ''),
    ('Alejandra', 'Baez Rivera', '121abrivera@uccaribe.edu', 'alejandrab', 'pending', ''),
    ('Ezekiel', 'F Enelon', 'eze@gwmail.gwu.edu', 'ezekielf', 'pending', ''),
    ('Ignacio', 'Anzola De Goiricelaya', 'ianzola@outlook.com', 'ignacioa', 'pending', ''),
    ('Ismat', 'Huq', 'ihuq321@gmail.com', 'ismath', 'pending', ''),
    ('Ruth', 'Matos', 'gjorenangela@gmail.com', 'joreng', 'pending', 'Supplied email/username differ from student name — confirm at first sign-in.'),
    ('Keertana', 'Jonnalagadda', 'keertanaj18@gmail.com', 'keertanaj', 'pending', ''),
    ('Maheswari', 'Bommepalli', 'bommepallimaheswari@gmail.com', 'maheswarib', 'pending', ''),
    ('Raghav', 'Gupta', 'guptar36@rowan.edu', 'raghavg', 'pending', ''),
    ('Silma', 'Raisa', 'silmaquadery@gmail.com', 'silmar', 'pending', ''),
    ('Rugayyah', 'Jukaku', 'rugayyah.jukaku@gmail.com', NULL, 'pending', 'Username NOT SUPPLIED on the authoritative roster.'),
    ('Dhwani', 'Maheshwari', NULL, NULL, 'not_supplied', 'Email and username NOT SUPPLIED — name-only identity requires admin review before matching.')
)
INSERT INTO public.hb_enrollments
  (session_id, first_name, last_name, email, username, identity_status, identity_note,
   ball_owner, current_status, student_next_action, drb_next_action, next_milestone)
SELECT
  session_a.id,
  roster.first_name,
  roster.last_name,
  roster.email,
  roster.username,
  roster.identity_status,
  roster.identity_note,
  'student',
  'Getting started',
  'Upload your profile photo and confirm your contact details',
  'Preparing your Session A kickoff plan',
  'Story selection'
FROM roster, session_a
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- Default Session A checklist taxonomy (from the legacy Master Roster sheet).
-- Admin owns this taxonomy; everything below is editable/hideable/archivable.
-- ---------------------------------------------------------------------------
WITH session_a AS (
  SELECT id FROM public.hb_sessions WHERE key = '360-session-a'
),
categories (key, title, description, sort_order) AS (
  VALUES
    ('getting-set-up', 'Getting Set Up', 'Everything needed before coaching starts: photo, equipment, and contact details.', 10),
    ('residency-timeline', 'Residency Timeline', 'Your timeline document — from first submission to interview-ready approval.', 20),
    ('advising', 'Advising', 'Advising sessions with Dr B and the MissionMed team.', 30),
    ('mock-interviews', 'Mock Interviews', 'Mock interview exams and readiness checks.', 40),
    ('personal-statement', 'Personal Statement', 'The full PS journey: stories, drafts, expert review, and final approval.', 50),
    ('alumni-network', 'Alumni & Network', 'Alumni relationships and application push connections.', 60)
)
INSERT INTO public.hb_checklist_categories
  (key, title, description, scope_type, scope_session, sort_order, builtin)
SELECT c.key, c.title, c.description, 'session', session_a.id, c.sort_order, true
FROM categories c, session_a
ON CONFLICT DO NOTHING;

WITH session_a AS (
  SELECT id FROM public.hb_sessions WHERE key = '360-session-a'
),
items (category_key, key, title, description, sort_order, required, default_owner, is_ps_tracker) AS (
  VALUES
    ('getting-set-up', 'profile-photo', 'Real headshot uploaded', 'A real professional headshot for your roster profile. Your Matrix avatar stays separate.', 10, true, 'student', false),
    ('getting-set-up', 'av-check', 'Video, microphone & lighting check', 'Proper camera, microphone, and lighting verified for live sessions and mock interviews.', 20, true, 'student', false),
    ('getting-set-up', 'contact-confirmed', 'Contact details confirmed', 'Email and preferred contact confirmed with the MissionMed team.', 30, true, 'student', false),
    ('residency-timeline', 'timeline-received', 'Timeline (TL) received', 'Your residency timeline document has been received by Dr B.', 10, true, 'student', false),
    ('residency-timeline', 'timeline-final-approved', 'Final timeline for interviews approved', 'Dr B approved the final interview-ready version of your timeline.', 20, true, 'drb', false),
    ('advising', 'advising-scheduled', 'Advising scheduled', 'Your first advising session is on the calendar.', 10, true, 'student', false),
    ('advising', 'advisory-1-completed', 'Advisory 1 completed', 'First advisory session completed.', 20, true, 'drb', false),
    ('mock-interviews', 'mock-iv-exam-1', 'Passed Mock Interview Exam 1', 'First mock interview exam passed.', 10, true, 'student', false),
    ('personal-statement', 'ps-stories-received', '5+ PS stories received', 'At least five personal statement stories submitted for story selection.', 10, true, 'student', false),
    ('personal-statement', 'ps-story-approved', 'PS story approved', 'Dr B approved the story your personal statement will be built on.', 20, true, 'drb', false),
    ('personal-statement', 'ps-stage', 'Personal Statement progression', 'The full PS state machine from Getting Started through Finalized.', 30, true, 'student', true),
    ('personal-statement', 'ps-advanced-review', 'Advanced draft reviewed with student', 'Advanced draft walked through together on a live call.', 40, true, 'drb', false),
    ('personal-statement', 'ps-faculty-review', 'PD/APD/Faculty review clear', 'Expert review by alumni, PD, APD, or faculty completed and clear.', 50, true, 'drb', false),
    ('personal-statement', 'ps-on-time', 'Timeline & PS submitted before deadline', 'Both documents submitted on or before the session deadline.', 60, true, 'student', false),
    ('alumni-network', 'alumni-connection', 'Alumni relationship connection', 'Connected with a MissionMed alumni mentor in your target specialty.', 10, false, 'drb', false),
    ('alumni-network', 'alumni-app-push', 'Alumni contact / application push', 'Alumni contact activated for an application push where available.', 20, false, 'drb', false)
)
INSERT INTO public.hb_checklist_items
  (category_id, key, title, description, sort_order, required, default_owner, is_ps_tracker)
SELECT cat.id, i.key, i.title, i.description, i.sort_order, i.required, i.default_owner, i.is_ps_tracker
FROM items i
JOIN session_a ON true
JOIN public.hb_checklist_categories cat
  ON cat.key = i.category_key AND cat.scope_session = session_a.id
ON CONFLICT DO NOTHING;

-- Hydrate a default per-student state row for every active item x enrollment.
INSERT INTO public.hb_item_states (item_id, enrollment_id, status, owner)
SELECT i.id, e.id, i.default_status, i.default_owner
FROM public.hb_checklist_items i
JOIN public.hb_checklist_categories c ON c.id = i.category_id
JOIN public.hb_sessions s ON s.id = c.scope_session AND s.key = '360-session-a'
JOIN public.hb_enrollments e ON e.session_id = s.id
ON CONFLICT (item_id, enrollment_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Opening weekly priority + alert
-- ---------------------------------------------------------------------------
WITH session_a AS (
  SELECT id FROM public.hb_sessions WHERE key = '360-session-a'
)
INSERT INTO public.hb_alerts (kind, scope_type, scope_session, title, body, urgency, sort_order, dismissible)
SELECT 'priority', 'session', session_a.id,
       'Welcome to your Session A HomeBase',
       'This is your one place to see where you are, who has the ball, and what happens next. Start with your checklist under My Progress.',
       'notice', 10, false
FROM session_a
ON CONFLICT DO NOTHING;

WITH session_a AS (
  SELECT id FROM public.hb_sessions WHERE key = '360-session-a'
)
INSERT INTO public.hb_alerts (kind, scope_type, scope_session, title, body, urgency, sort_order, dismissible, cta_label, cta_url)
SELECT 'alert', 'session', session_a.id,
       'Upload your profile photo',
       'Every Session A student needs a real professional headshot on file. It takes two minutes.',
       'notice', 20, true, 'Go to My Progress', '#progress'
FROM session_a
ON CONFLICT DO NOTHING;

-- Roster hydration activity records
INSERT INTO public.hb_activity
  (action, entity_type, entity_id, session_id, enrollment_id, actor_role, actor_name, summary, student_visible)
SELECT 'roster_hydrated', 'enrollment', e.id::text, e.session_id, e.id,
       'system', 'HomeBase',
       'Added to 360 Match Mentorship — Session A from the authoritative HB-360A-001 roster.',
       true
FROM public.hb_enrollments e
JOIN public.hb_sessions s ON s.id = e.session_id AND s.key = '360-session-a'
WHERE NOT EXISTS (
  SELECT 1 FROM public.hb_activity a
  WHERE a.action = 'roster_hydrated' AND a.enrollment_id = e.id
);

COMMIT;
