-- P1-RISE-5007 private-beta Student Intel.
-- Additive, RLS-forced, and provenance-preserving. Student submissions never
-- overwrite canonical program facts in this migration.

BEGIN;

CREATE TABLE rise_runtime.beta_notice_acknowledgments (
  subject_key char(64) PRIMARY KEY CHECK (subject_key ~ '^[0-9a-f]{64}$'),
  notice_version text NOT NULL CHECK (btrim(notice_version) <> ''),
  acknowledged_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE rise_runtime.student_intel_submitter_identities (
  subject_key char(64) PRIMARY KEY CHECK (subject_key ~ '^[0-9a-f]{64}$'),
  subject_ref text NOT NULL CHECK (btrim(subject_ref) <> '' AND length(subject_ref) <= 256),
  display_name text NOT NULL CHECK (btrim(display_name) <> '' AND length(display_name) <= 120),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (updated_at >= created_at)
);

CREATE TABLE rise_runtime.student_intel_submissions (
  submission_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  release_id text NOT NULL,
  program_specialty_id text NOT NULL,
  submitter_subject_key char(64) NOT NULL REFERENCES rise_runtime.student_intel_submitter_identities(subject_key),
  public_contributor_name text CHECK (public_contributor_name IS NULL OR length(public_contributor_name) <= 120),
  anonymous_to_students boolean NOT NULL DEFAULT true,
  category text NOT NULL CHECK (category IN (
    'Application Requirements', 'Visa', 'USMLE', 'COMLEX', 'YOG', 'USCE', 'Interview',
    'Residents', 'Faculty / Leadership', 'Fellowships', 'Rotations', 'Curriculum', 'Research',
    'Culture', 'Salary / Benefits', 'Facilities', 'Program Update', 'Other'
  )),
  original_claim text NOT NULL CHECK (btrim(original_claim) <> '' AND length(original_claim) <= 8000),
  display_claim text NOT NULL CHECK (btrim(display_claim) <> '' AND length(display_claim) <= 8000),
  context_notes text NOT NULL DEFAULT '' CHECK (length(context_notes) <= 4000),
  observed_on date NOT NULL CHECK (observed_on <= current_date),
  status text NOT NULL DEFAULT 'VERIFICATION_PENDING' CHECK (status IN (
    'STUDENT_REPORT', 'VERIFICATION_PENDING', 'VERIFIED_BY_MISSIONMED', 'PARTIALLY_VERIFIED',
    'COULD_NOT_VERIFY', 'CONFLICTING', 'OUTDATED', 'REJECTED_HIDDEN'
  )),
  public_admin_notation text NOT NULL DEFAULT '' CHECK (length(public_admin_notation) <= 4000),
  high_priority boolean NOT NULL DEFAULT false,
  featured boolean NOT NULL DEFAULT false,
  corroboration_count integer NOT NULL DEFAULT 0 CHECK (corroboration_count >= 0),
  visible boolean NOT NULL DEFAULT true,
  moderation_locked boolean NOT NULL DEFAULT false,
  last_verification_attempt_at timestamptz,
  next_eligible_verification_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (release_id, program_specialty_id)
    REFERENCES rise_runtime.registry_programs(release_id, program_specialty_id),
  CHECK ((anonymous_to_students AND public_contributor_name IS NULL) OR
         (NOT anonymous_to_students AND btrim(public_contributor_name) <> '')),
  CHECK (updated_at >= created_at),
  CHECK (next_eligible_verification_at IS NULL OR last_verification_attempt_at IS NOT NULL)
);

CREATE INDEX rise_runtime_student_intel_program_idx
  ON rise_runtime.student_intel_submissions (program_specialty_id, featured DESC, created_at DESC)
  WHERE deleted_at IS NULL;
CREATE INDEX rise_runtime_student_intel_verification_queue_idx
  ON rise_runtime.student_intel_submissions (high_priority DESC, next_eligible_verification_at, created_at)
  WHERE status IN ('VERIFICATION_PENDING', 'CONFLICTING') AND deleted_at IS NULL;
CREATE INDEX rise_runtime_student_intel_subject_idx
  ON rise_runtime.student_intel_submissions (submitter_subject_key, created_at DESC);

CREATE TABLE rise_runtime.student_intel_sources (
  source_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES rise_runtime.student_intel_submissions(submission_id),
  source_kind text NOT NULL CHECK (source_kind IN ('ONLINE', 'FIRSTHAND', 'DIRECT_COMMUNICATION', 'OTHER')),
  source_url text CHECK (source_url IS NULL OR (source_url ~ '^https://' AND length(source_url) <= 2048)),
  source_label text NOT NULL DEFAULT '' CHECK (length(source_label) <= 240),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (source_kind <> 'ONLINE' OR source_url IS NOT NULL)
);

CREATE TABLE rise_runtime.student_intel_moderation_events (
  event_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  submission_id uuid NOT NULL REFERENCES rise_runtime.student_intel_submissions(submission_id),
  actor_subject_ref text NOT NULL CHECK (btrim(actor_subject_ref) <> '' AND length(actor_subject_ref) <= 256),
  action text NOT NULL CHECK (action IN (
    'EDIT_DISPLAY', 'ANNOTATE', 'REQUEST_CLARIFICATION', 'FEATURE', 'HIDE', 'UNHIDE', 'REJECT',
    'DELETE', 'MARK_OUTDATED', 'MARK_CONFLICTING', 'MARK_VERIFIED', 'MARK_PARTIAL',
    'COULD_NOT_VERIFY', 'SEND_TO_VERIFICATION', 'PROMOTE_CANONICAL'
  )),
  reason text NOT NULL DEFAULT '' CHECK (length(reason) <= 4000),
  before_state jsonb NOT NULL CHECK (jsonb_typeof(before_state) = 'object'),
  after_state jsonb NOT NULL CHECK (jsonb_typeof(after_state) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE rise_runtime.student_intel_verification_runs (
  verification_run_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES rise_runtime.student_intel_submissions(submission_id),
  dedupe_key char(64) NOT NULL CHECK (dedupe_key ~ '^[0-9a-f]{64}$'),
  queue_class text NOT NULL CHECK (queue_class IN ('HIGH_PRIORITY', 'TWICE_MONTHLY')),
  status text NOT NULL CHECK (status IN ('PREVIEWED', 'QUEUED', 'RUNNING', 'RETURNED', 'NORMALIZING', 'QA', 'INGESTED', 'NEEDS_REVIEW', 'PARTIAL', 'FAILED', 'PAUSED_BUDGET')),
  task_class text NOT NULL CHECK (btrim(task_class) <> ''),
  selected_product text NOT NULL CHECK (btrim(selected_product) <> ''),
  selected_processor text,
  selection_reason text NOT NULL CHECK (btrim(selection_reason) <> ''),
  supplied_url_first boolean NOT NULL DEFAULT true,
  estimated_cost numeric(10,4) NOT NULL CHECK (estimated_cost >= 0),
  actual_cost numeric(10,4) CHECK (actual_cost IS NULL OR actual_cost >= 0),
  factory_campaign_id text,
  factory_task_group_id text,
  factory_run_id text,
  attempt_number integer NOT NULL DEFAULT 1 CHECK (attempt_number >= 1),
  result_summary jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (dedupe_key, attempt_number),
  CHECK (updated_at >= created_at),
  CHECK (factory_campaign_id IS NULL OR factory_campaign_id <> 'RISE-BOOTSTRAP-001')
);

CREATE TABLE rise_runtime.student_intel_corroborations (
  submission_id uuid NOT NULL REFERENCES rise_runtime.student_intel_submissions(submission_id),
  corroborator_subject_key char(64) NOT NULL CHECK (corroborator_subject_key ~ '^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (submission_id, corroborator_subject_key)
);

CREATE FUNCTION rise_runtime.record_student_intel_corroboration()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, rise_runtime
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM rise_runtime.student_intel_submissions
    WHERE submission_id = NEW.submission_id
      AND submitter_subject_key = NEW.corroborator_subject_key
  ) THEN
    RAISE EXCEPTION 'A contributor cannot corroborate their own Student Intel';
  END IF;
  UPDATE rise_runtime.student_intel_submissions
  SET corroboration_count = corroboration_count + 1, updated_at = now()
  WHERE submission_id = NEW.submission_id;
  RETURN NEW;
END
$$;

CREATE TRIGGER rise_student_intel_corroboration_count
  AFTER INSERT ON rise_runtime.student_intel_corroborations
  FOR EACH ROW EXECUTE FUNCTION rise_runtime.record_student_intel_corroboration();

CREATE TABLE rise_runtime.student_intel_canonical_promotions (
  promotion_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES rise_runtime.student_intel_submissions(submission_id),
  canonical_field text NOT NULL CHECK (btrim(canonical_field) <> '' AND length(canonical_field) <= 128),
  canonical_value jsonb NOT NULL,
  source_url text CHECK (source_url IS NULL OR source_url ~ '^https://'),
  verified_at timestamptz NOT NULL,
  verification_method text NOT NULL CHECK (btrim(verification_method) <> ''),
  provenance jsonb NOT NULL CHECK (jsonb_typeof(provenance) = 'object'),
  actor_subject_ref text NOT NULL CHECK (btrim(actor_subject_ref) <> '' AND length(actor_subject_ref) <= 256),
  conflict_state text NOT NULL DEFAULT 'NONE' CHECK (conflict_state IN ('NONE', 'CONFLICTING', 'RESOLVED')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE FUNCTION rise_runtime.reject_student_intel_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, rise_runtime
AS $$
BEGIN
  RAISE EXCEPTION 'RISE Student Intel audit and promotion records are immutable';
END
$$;

CREATE TRIGGER rise_student_intel_moderation_immutable
  BEFORE UPDATE OR DELETE ON rise_runtime.student_intel_moderation_events
  FOR EACH ROW EXECUTE FUNCTION rise_runtime.reject_student_intel_audit_mutation();
CREATE TRIGGER rise_student_intel_promotions_immutable
  BEFORE UPDATE OR DELETE ON rise_runtime.student_intel_canonical_promotions
  FOR EACH ROW EXECUTE FUNCTION rise_runtime.reject_student_intel_audit_mutation();

ALTER TABLE rise_runtime.beta_notice_acknowledgments ENABLE ROW LEVEL SECURITY;
ALTER TABLE rise_runtime.beta_notice_acknowledgments FORCE ROW LEVEL SECURITY;
ALTER TABLE rise_runtime.student_intel_submitter_identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE rise_runtime.student_intel_submitter_identities FORCE ROW LEVEL SECURITY;
ALTER TABLE rise_runtime.student_intel_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE rise_runtime.student_intel_submissions FORCE ROW LEVEL SECURITY;
ALTER TABLE rise_runtime.student_intel_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE rise_runtime.student_intel_sources FORCE ROW LEVEL SECURITY;
ALTER TABLE rise_runtime.student_intel_moderation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE rise_runtime.student_intel_moderation_events FORCE ROW LEVEL SECURITY;
ALTER TABLE rise_runtime.student_intel_verification_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE rise_runtime.student_intel_verification_runs FORCE ROW LEVEL SECURITY;
ALTER TABLE rise_runtime.student_intel_corroborations ENABLE ROW LEVEL SECURITY;
ALTER TABLE rise_runtime.student_intel_corroborations FORCE ROW LEVEL SECURITY;
ALTER TABLE rise_runtime.student_intel_canonical_promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE rise_runtime.student_intel_canonical_promotions FORCE ROW LEVEL SECURITY;

CREATE POLICY rise_beta_notice_subject_isolation ON rise_runtime.beta_notice_acknowledgments
  FOR ALL TO rise_app_runtime
  USING (subject_key = current_setting('rise.subject_key', true) OR current_setting('rise.is_admin', true) = 'true')
  WITH CHECK (subject_key = current_setting('rise.subject_key', true) OR current_setting('rise.is_admin', true) = 'true');

CREATE POLICY rise_student_intel_identity_isolation ON rise_runtime.student_intel_submitter_identities
  FOR ALL TO rise_app_runtime
  USING (subject_key = current_setting('rise.subject_key', true) OR current_setting('rise.is_admin', true) = 'true')
  WITH CHECK (subject_key = current_setting('rise.subject_key', true) OR current_setting('rise.is_admin', true) = 'true');

CREATE POLICY rise_student_intel_visible_or_owner ON rise_runtime.student_intel_submissions
  FOR SELECT TO rise_app_runtime
  USING (
    current_setting('rise.is_admin', true) = 'true' OR
    (visible = true AND deleted_at IS NULL AND status <> 'REJECTED_HIDDEN')
  );
CREATE POLICY rise_student_intel_owner_insert ON rise_runtime.student_intel_submissions
  FOR INSERT TO rise_app_runtime
  WITH CHECK (submitter_subject_key = current_setting('rise.subject_key', true));
CREATE POLICY rise_student_intel_admin_update ON rise_runtime.student_intel_submissions
  FOR UPDATE TO rise_app_runtime
  USING (current_setting('rise.is_admin', true) = 'true')
  WITH CHECK (current_setting('rise.is_admin', true) = 'true');

CREATE POLICY rise_student_intel_source_visibility ON rise_runtime.student_intel_sources
  FOR SELECT TO rise_app_runtime
  USING (EXISTS (
    SELECT 1 FROM rise_runtime.student_intel_submissions s WHERE s.submission_id = student_intel_sources.submission_id
  ));
CREATE POLICY rise_student_intel_source_owner_insert ON rise_runtime.student_intel_sources
  FOR INSERT TO rise_app_runtime
  WITH CHECK (EXISTS (
    SELECT 1 FROM rise_runtime.student_intel_submissions s
    WHERE s.submission_id = student_intel_sources.submission_id
      AND (s.submitter_subject_key = current_setting('rise.subject_key', true) OR current_setting('rise.is_admin', true) = 'true')
  ));

CREATE POLICY rise_student_intel_admin_audit ON rise_runtime.student_intel_moderation_events
  FOR ALL TO rise_app_runtime
  USING (current_setting('rise.is_admin', true) = 'true')
  WITH CHECK (current_setting('rise.is_admin', true) = 'true');
CREATE POLICY rise_student_intel_admin_verification ON rise_runtime.student_intel_verification_runs
  FOR ALL TO rise_app_runtime
  USING (current_setting('rise.is_admin', true) = 'true')
  WITH CHECK (current_setting('rise.is_admin', true) = 'true');
CREATE POLICY rise_student_intel_corroboration_read ON rise_runtime.student_intel_corroborations
  FOR SELECT TO rise_app_runtime
  USING (corroborator_subject_key = current_setting('rise.subject_key', true) OR current_setting('rise.is_admin', true) = 'true');
CREATE POLICY rise_student_intel_corroboration_owner_insert ON rise_runtime.student_intel_corroborations
  FOR INSERT TO rise_app_runtime
  WITH CHECK (corroborator_subject_key = current_setting('rise.subject_key', true));
CREATE POLICY rise_student_intel_admin_promotions ON rise_runtime.student_intel_canonical_promotions
  FOR ALL TO rise_app_runtime
  USING (current_setting('rise.is_admin', true) = 'true')
  WITH CHECK (current_setting('rise.is_admin', true) = 'true');

REVOKE ALL ON ALL TABLES IN SCHEMA rise_runtime FROM PUBLIC;
REVOKE ALL ON FUNCTION rise_runtime.reject_student_intel_audit_mutation() FROM PUBLIC;
REVOKE ALL ON FUNCTION rise_runtime.record_student_intel_corroboration() FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE ON rise_runtime.beta_notice_acknowledgments TO rise_app_runtime;
GRANT SELECT, INSERT, UPDATE ON rise_runtime.student_intel_submitter_identities TO rise_app_runtime;
GRANT SELECT, INSERT, UPDATE ON rise_runtime.student_intel_submissions TO rise_app_runtime;
GRANT SELECT, INSERT ON rise_runtime.student_intel_sources TO rise_app_runtime;
GRANT SELECT, INSERT ON rise_runtime.student_intel_moderation_events TO rise_app_runtime;
GRANT SELECT, INSERT, UPDATE ON rise_runtime.student_intel_verification_runs TO rise_app_runtime;
GRANT SELECT, INSERT ON rise_runtime.student_intel_corroborations TO rise_app_runtime;
GRANT SELECT, INSERT ON rise_runtime.student_intel_canonical_promotions TO rise_app_runtime;
GRANT USAGE, SELECT ON SEQUENCE rise_runtime.student_intel_moderation_events_event_id_seq TO rise_app_runtime;

COMMIT;
