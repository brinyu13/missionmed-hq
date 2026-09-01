-- Migration: 20260901120000_hb_360a_001_homebase_foundation.sql
-- Ticket: HB-360A-001
-- Target: dedicated HomeBase PostgreSQL service only. Never apply to the StoryForge database.
-- Purpose: PROGRAM -> SESSION -> ENROLLMENT foundation, editable checklist taxonomy,
--          per-student checklist state, tasks/assignments, alerts/priorities,
--          file links, and the HomeBase activity feed.
-- Reversibility: additive objects only; no existing objects are altered or dropped.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- Roles (mirrors the StoryForge runtime convention: request work runs as
-- "authenticated" with signed claims in request.jwt.claim.*; service work runs
-- as "homebase_app").
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'homebase_app') THEN
    CREATE ROLE homebase_app NOLOGIN;
  END IF;
END
$$;

GRANT authenticated TO CURRENT_USER;
GRANT homebase_app TO CURRENT_USER;
GRANT USAGE ON SCHEMA public TO authenticated, homebase_app;

-- ---------------------------------------------------------------------------
-- Signed-claim accessors
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.hb_actor_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

CREATE OR REPLACE FUNCTION public.hb_actor_role()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT nullif(current_setting('request.jwt.claim.app_role', true), '')
$$;

CREATE OR REPLACE FUNCTION public.hb_actor_eligible()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT coalesce(nullif(current_setting('request.jwt.claim.homebase_eligible', true), '')::boolean, false)
$$;

CREATE OR REPLACE FUNCTION public.hb_actor_wp_user_id()
RETURNS bigint
LANGUAGE sql
STABLE
AS $$
  SELECT nullif(current_setting('request.jwt.claim.wp_user_id', true), '')::bigint
$$;

CREATE OR REPLACE FUNCTION public.hb_actor_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT coalesce(nullif(current_setting('request.jwt.claim.wordpress_admin', true), '')::boolean, false)
     AND coalesce(nullif(current_setting('request.jwt.claim.admin_mode', true), '')::boolean, false)
$$;

-- ---------------------------------------------------------------------------
-- PROGRAM -> SESSION -> ENROLLMENT
-- ---------------------------------------------------------------------------
CREATE TABLE public.hb_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE CHECK (key ~ '^[a-z0-9][a-z0-9-]{1,60}$'),
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 120),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.hb_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES public.hb_programs(id) ON DELETE RESTRICT,
  key text NOT NULL UNIQUE CHECK (key ~ '^[a-z0-9][a-z0-9-]{1,60}$'),
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 120),
  starts_on date,
  ends_on date,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.hb_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.hb_sessions(id) ON DELETE RESTRICT,
  wp_user_id bigint,
  subject_id uuid,
  first_name text NOT NULL DEFAULT '' CHECK (length(first_name) <= 80),
  last_name text NOT NULL DEFAULT '' CHECK (length(last_name) <= 80),
  email text CHECK (email IS NULL OR length(email) <= 190),
  username text CHECK (username IS NULL OR length(username) <= 80),
  identity_status text NOT NULL DEFAULT 'pending'
    CHECK (identity_status IN ('pending', 'matched', 'needs_review', 'not_supplied')),
  identity_note text NOT NULL DEFAULT '',
  roster_source text NOT NULL DEFAULT 'hb_360a_001_allowlist',
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'hidden', 'archived', 'removed')),
  photo_url text NOT NULL DEFAULT '',
  photo_state text NOT NULL DEFAULT 'missing'
    CHECK (photo_state IN ('missing', 'uploaded', 'approved')),
  ps_stage smallint NOT NULL DEFAULT 0 CHECK (ps_stage BETWEEN 0 AND 7),
  current_status text NOT NULL DEFAULT 'Getting started',
  ball_owner text NOT NULL DEFAULT 'student'
    CHECK (ball_owner IN ('student', 'drb', 'none')),
  student_next_action text NOT NULL DEFAULT '',
  drb_next_action text NOT NULL DEFAULT '',
  next_milestone text NOT NULL DEFAULT '',
  deadline date,
  admin_note text NOT NULL DEFAULT '',
  last_activity_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX hb_enrollments_session_email
  ON public.hb_enrollments (session_id, lower(email))
  WHERE email IS NOT NULL;
CREATE INDEX hb_enrollments_wp_user ON public.hb_enrollments (wp_user_id) WHERE wp_user_id IS NOT NULL;
CREATE INDEX hb_enrollments_session ON public.hb_enrollments (session_id, status);

-- ---------------------------------------------------------------------------
-- Editable checklist taxonomy
-- ---------------------------------------------------------------------------
CREATE TABLE public.hb_checklist_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL CHECK (key ~ '^[a-z0-9][a-z0-9_-]{1,60}$'),
  title text NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 120),
  description text NOT NULL DEFAULT '',
  scope_type text NOT NULL DEFAULT 'session'
    CHECK (scope_type IN ('global', 'program', 'session', 'student')),
  scope_program uuid REFERENCES public.hb_programs(id) ON DELETE CASCADE,
  scope_session uuid REFERENCES public.hb_sessions(id) ON DELETE CASCADE,
  scope_enrollment uuid REFERENCES public.hb_enrollments(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 100,
  state text NOT NULL DEFAULT 'active' CHECK (state IN ('active', 'hidden', 'archived')),
  builtin boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (scope_type = 'global' AND scope_program IS NULL AND scope_session IS NULL AND scope_enrollment IS NULL)
    OR (scope_type = 'program' AND scope_program IS NOT NULL AND scope_session IS NULL AND scope_enrollment IS NULL)
    OR (scope_type = 'session' AND scope_session IS NOT NULL AND scope_enrollment IS NULL)
    OR (scope_type = 'student' AND scope_enrollment IS NOT NULL)
  )
);
CREATE INDEX hb_checklist_categories_scope
  ON public.hb_checklist_categories (scope_type, scope_session, state, sort_order);

CREATE TABLE public.hb_checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES public.hb_checklist_categories(id) ON DELETE CASCADE,
  key text NOT NULL CHECK (key ~ '^[a-z0-9][a-z0-9_-]{1,80}$'),
  title text NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 200),
  description text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 100,
  state text NOT NULL DEFAULT 'active' CHECK (state IN ('active', 'hidden', 'archived')),
  required boolean NOT NULL DEFAULT true,
  default_owner text NOT NULL DEFAULT 'student' CHECK (default_owner IN ('student', 'drb', 'none')),
  default_status text NOT NULL DEFAULT 'not_started'
    CHECK (default_status IN (
      'not_started', 'waiting_on_student', 'submitted', 'in_review',
      'waiting_on_drb', 'revision_needed', 'approved', 'completed', 'not_applicable'
    )),
  due_behavior text NOT NULL DEFAULT 'none' CHECK (due_behavior IN ('none', 'fixed', 'relative')),
  due_date date,
  due_offset_days integer,
  scope_enrollment uuid REFERENCES public.hb_enrollments(id) ON DELETE CASCADE,
  link_task uuid,
  link_vault_document text NOT NULL DEFAULT '',
  link_calendar text NOT NULL DEFAULT '',
  is_ps_tracker boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX hb_checklist_items_category
  ON public.hb_checklist_items (category_id, state, sort_order);

CREATE TABLE public.hb_item_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.hb_checklist_items(id) ON DELETE CASCADE,
  enrollment_id uuid NOT NULL REFERENCES public.hb_enrollments(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'not_started'
    CHECK (status IN (
      'not_started', 'waiting_on_student', 'submitted', 'in_review',
      'waiting_on_drb', 'revision_needed', 'approved', 'completed', 'not_applicable'
    )),
  owner text NOT NULL DEFAULT 'student' CHECK (owner IN ('student', 'drb', 'none')),
  due_date date,
  note text NOT NULL DEFAULT '',
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (item_id, enrollment_id)
);
CREATE INDEX hb_item_states_enrollment ON public.hb_item_states (enrollment_id, status);

-- ---------------------------------------------------------------------------
-- Tasks / assignments
-- ---------------------------------------------------------------------------
CREATE TABLE public.hb_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.hb_sessions(id) ON DELETE RESTRICT,
  audience text NOT NULL DEFAULT 'session' CHECK (audience IN ('session', 'subset', 'individual')),
  title text NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 200),
  description text NOT NULL DEFAULT '',
  assigned_by_name text NOT NULL DEFAULT 'Dr B',
  assigned_by uuid,
  assigned_on date NOT NULL DEFAULT CURRENT_DATE,
  due_date date,
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'cancelled')),
  required_upload boolean NOT NULL DEFAULT false,
  link_item uuid REFERENCES public.hb_checklist_items(id) ON DELETE SET NULL,
  link_vault_document text NOT NULL DEFAULT '',
  link_calendar text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.hb_task_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.hb_tasks(id) ON DELETE CASCADE,
  enrollment_id uuid NOT NULL REFERENCES public.hb_enrollments(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'assigned'
    CHECK (status IN ('assigned', 'submitted', 'revision_needed', 'approved', 'completed', 'reopened')),
  student_comment text NOT NULL DEFAULT '',
  admin_comment text NOT NULL DEFAULT '',
  submitted_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (task_id, enrollment_id)
);
CREATE INDEX hb_task_assignments_enrollment ON public.hb_task_assignments (enrollment_id, status);

-- ---------------------------------------------------------------------------
-- Alerts and weekly priorities
-- ---------------------------------------------------------------------------
CREATE TABLE public.hb_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL DEFAULT 'alert' CHECK (kind IN ('alert', 'priority')),
  scope_type text NOT NULL DEFAULT 'session'
    CHECK (scope_type IN ('global', 'program', 'session', 'student')),
  scope_program uuid REFERENCES public.hb_programs(id) ON DELETE CASCADE,
  scope_session uuid REFERENCES public.hb_sessions(id) ON DELETE CASCADE,
  scope_enrollment uuid REFERENCES public.hb_enrollments(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 200),
  body text NOT NULL DEFAULT '',
  urgency text NOT NULL DEFAULT 'notice' CHECK (urgency IN ('info', 'notice', 'urgent')),
  starts_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  dismissible boolean NOT NULL DEFAULT true,
  cta_label text NOT NULL DEFAULT '',
  cta_url text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 100,
  state text NOT NULL DEFAULT 'active' CHECK (state IN ('active', 'hidden', 'archived')),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (scope_type = 'global' AND scope_program IS NULL AND scope_session IS NULL AND scope_enrollment IS NULL)
    OR (scope_type = 'program' AND scope_program IS NOT NULL)
    OR (scope_type = 'session' AND scope_session IS NOT NULL)
    OR (scope_type = 'student' AND scope_enrollment IS NOT NULL)
  )
);
CREATE INDEX hb_alerts_scope ON public.hb_alerts (kind, state, scope_type, scope_session, sort_order);

CREATE TABLE public.hb_alert_dismissals (
  alert_id uuid NOT NULL REFERENCES public.hb_alerts(id) ON DELETE CASCADE,
  enrollment_id uuid NOT NULL REFERENCES public.hb_enrollments(id) ON DELETE CASCADE,
  dismissed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (alert_id, enrollment_id)
);

-- ---------------------------------------------------------------------------
-- File Vault links (metadata only; File Vault V2 remains the document system)
-- ---------------------------------------------------------------------------
CREATE TABLE public.hb_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid REFERENCES public.hb_enrollments(id) ON DELETE CASCADE,
  session_id uuid REFERENCES public.hb_sessions(id) ON DELETE CASCADE,
  vault_document_uuid text NOT NULL DEFAULT '',
  title text NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 200),
  kind text NOT NULL DEFAULT 'document'
    CHECK (kind IN ('document', 'ps_draft', 'timeline', 'headshot', 'resource', 'other')),
  external_url text NOT NULL DEFAULT '',
  link_item uuid REFERENCES public.hb_checklist_items(id) ON DELETE SET NULL,
  link_task uuid REFERENCES public.hb_tasks(id) ON DELETE SET NULL,
  student_visible boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX hb_files_enrollment ON public.hb_files (enrollment_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Activity / audit
-- ---------------------------------------------------------------------------
CREATE TABLE public.hb_activity (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  session_id uuid,
  enrollment_id uuid,
  actor_role text NOT NULL DEFAULT 'system',
  actor_name text NOT NULL DEFAULT '',
  actor_sub uuid,
  summary text NOT NULL DEFAULT '',
  student_visible boolean NOT NULL DEFAULT true,
  previous_value jsonb,
  new_value jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX hb_activity_enrollment ON public.hb_activity (enrollment_id, created_at DESC);
CREATE INDEX hb_activity_session ON public.hb_activity (session_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Row-level security
-- Students: read their own world; every write goes through the service role
-- (the HomeBase API enforces per-action authorization before writing).
-- Admin identity work runs with hb_actor_is_admin() true.
-- ---------------------------------------------------------------------------
ALTER TABLE public.hb_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hb_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hb_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hb_checklist_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hb_checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hb_item_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hb_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hb_task_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hb_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hb_alert_dismissals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hb_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hb_activity ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO homebase_app;

CREATE OR REPLACE FUNCTION public.hb_own_enrollment_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT e.id
  FROM public.hb_enrollments e
  WHERE public.hb_actor_eligible()
    AND e.wp_user_id IS NOT NULL
    AND e.wp_user_id = public.hb_actor_wp_user_id()
    AND e.status = 'active'
$$;

CREATE POLICY hb_programs_read ON public.hb_programs
  FOR SELECT TO authenticated
  USING (public.hb_actor_is_admin() OR active);

CREATE POLICY hb_sessions_read ON public.hb_sessions
  FOR SELECT TO authenticated
  USING (public.hb_actor_is_admin() OR active);

CREATE POLICY hb_enrollments_read ON public.hb_enrollments
  FOR SELECT TO authenticated
  USING (
    public.hb_actor_is_admin()
    OR id IN (SELECT public.hb_own_enrollment_ids())
  );

CREATE POLICY hb_checklist_categories_read ON public.hb_checklist_categories
  FOR SELECT TO authenticated
  USING (
    public.hb_actor_is_admin()
    OR (
      state = 'active'
      AND (scope_enrollment IS NULL OR scope_enrollment IN (SELECT public.hb_own_enrollment_ids()))
    )
  );

CREATE POLICY hb_checklist_items_read ON public.hb_checklist_items
  FOR SELECT TO authenticated
  USING (
    public.hb_actor_is_admin()
    OR (
      state = 'active'
      AND (scope_enrollment IS NULL OR scope_enrollment IN (SELECT public.hb_own_enrollment_ids()))
    )
  );

CREATE POLICY hb_item_states_read ON public.hb_item_states
  FOR SELECT TO authenticated
  USING (
    public.hb_actor_is_admin()
    OR enrollment_id IN (SELECT public.hb_own_enrollment_ids())
  );

CREATE POLICY hb_tasks_read ON public.hb_tasks
  FOR SELECT TO authenticated
  USING (
    public.hb_actor_is_admin()
    OR id IN (
      SELECT a.task_id FROM public.hb_task_assignments a
      WHERE a.enrollment_id IN (SELECT public.hb_own_enrollment_ids())
    )
  );

CREATE POLICY hb_task_assignments_read ON public.hb_task_assignments
  FOR SELECT TO authenticated
  USING (
    public.hb_actor_is_admin()
    OR enrollment_id IN (SELECT public.hb_own_enrollment_ids())
  );

CREATE POLICY hb_alerts_read ON public.hb_alerts
  FOR SELECT TO authenticated
  USING (
    public.hb_actor_is_admin()
    OR (
      state = 'active'
      AND starts_at <= now()
      AND (expires_at IS NULL OR expires_at > now())
      AND (
        scope_type = 'global'
        OR (scope_type = 'program' AND scope_program IN (
          SELECT s.program_id FROM public.hb_sessions s
          JOIN public.hb_enrollments e ON e.session_id = s.id
          WHERE e.id IN (SELECT public.hb_own_enrollment_ids())
        ))
        OR (scope_type = 'session' AND scope_session IN (
          SELECT e.session_id FROM public.hb_enrollments e
          WHERE e.id IN (SELECT public.hb_own_enrollment_ids())
        ))
        OR (scope_type = 'student' AND scope_enrollment IN (SELECT public.hb_own_enrollment_ids()))
      )
    )
  );

CREATE POLICY hb_alert_dismissals_read ON public.hb_alert_dismissals
  FOR SELECT TO authenticated
  USING (
    public.hb_actor_is_admin()
    OR enrollment_id IN (SELECT public.hb_own_enrollment_ids())
  );

CREATE POLICY hb_files_read ON public.hb_files
  FOR SELECT TO authenticated
  USING (
    public.hb_actor_is_admin()
    OR (student_visible AND enrollment_id IN (SELECT public.hb_own_enrollment_ids()))
  );

CREATE POLICY hb_activity_read ON public.hb_activity
  FOR SELECT TO authenticated
  USING (
    public.hb_actor_is_admin()
    OR (student_visible AND enrollment_id IN (SELECT public.hb_own_enrollment_ids()))
  );

-- Service role bypasses nothing implicitly: grant explicit ALL policies.
CREATE POLICY hb_programs_service ON public.hb_programs FOR ALL TO homebase_app USING (true) WITH CHECK (true);
CREATE POLICY hb_sessions_service ON public.hb_sessions FOR ALL TO homebase_app USING (true) WITH CHECK (true);
CREATE POLICY hb_enrollments_service ON public.hb_enrollments FOR ALL TO homebase_app USING (true) WITH CHECK (true);
CREATE POLICY hb_checklist_categories_service ON public.hb_checklist_categories FOR ALL TO homebase_app USING (true) WITH CHECK (true);
CREATE POLICY hb_checklist_items_service ON public.hb_checklist_items FOR ALL TO homebase_app USING (true) WITH CHECK (true);
CREATE POLICY hb_item_states_service ON public.hb_item_states FOR ALL TO homebase_app USING (true) WITH CHECK (true);
CREATE POLICY hb_tasks_service ON public.hb_tasks FOR ALL TO homebase_app USING (true) WITH CHECK (true);
CREATE POLICY hb_task_assignments_service ON public.hb_task_assignments FOR ALL TO homebase_app USING (true) WITH CHECK (true);
CREATE POLICY hb_alerts_service ON public.hb_alerts FOR ALL TO homebase_app USING (true) WITH CHECK (true);
CREATE POLICY hb_alert_dismissals_service ON public.hb_alert_dismissals FOR ALL TO homebase_app USING (true) WITH CHECK (true);
CREATE POLICY hb_files_service ON public.hb_files FOR ALL TO homebase_app USING (true) WITH CHECK (true);
CREATE POLICY hb_activity_service ON public.hb_activity FOR ALL TO homebase_app USING (true) WITH CHECK (true);

COMMIT;
