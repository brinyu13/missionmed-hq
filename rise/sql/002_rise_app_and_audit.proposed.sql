-- P1-RISE-4006 proposed private application and append-only audit planes.
-- Apply only after dedicated RISE database roles, encryption keys, policy
-- owners, backup, and restore rehearsal are approved.

BEGIN;

CREATE SCHEMA IF NOT EXISTS rise_app;
CREATE SCHEMA IF NOT EXISTS rise_audit;
REVOKE ALL ON SCHEMA rise_app FROM PUBLIC;
REVOKE ALL ON SCHEMA rise_audit FROM PUBLIC;

CREATE TABLE rise_app.authorization_code_redemptions (
  jti_sha256 char(64) PRIMARY KEY CHECK (jti_sha256 ~ '^[0-9a-f]{64}$'),
  subject_id text NOT NULL,
  issuer text NOT NULL,
  audience text NOT NULL CHECK (audience = 'rise'),
  role text NOT NULL CHECK (role IN ('student', 'mentor', 'operator', 'admin')),
  capabilities jsonb NOT NULL CHECK (jsonb_typeof(capabilities) = 'array'),
  code_issued_at timestamptz NOT NULL,
  code_expires_at timestamptz NOT NULL,
  redeemed_at timestamptz NOT NULL,
  request_id text NOT NULL,
  CHECK (code_expires_at > code_issued_at),
  CHECK (code_expires_at <= code_issued_at + interval '60 seconds'),
  CHECK (redeemed_at <= code_expires_at)
);

CREATE TABLE rise_app.sessions (
  session_id text PRIMARY KEY,
  session_token_sha256 char(64) NOT NULL UNIQUE CHECK (session_token_sha256 ~ '^[0-9a-f]{64}$'),
  csrf_token_sha256 char(64) NOT NULL CHECK (csrf_token_sha256 ~ '^[0-9a-f]{64}$'),
  jti_sha256 char(64) NOT NULL UNIQUE REFERENCES rise_app.authorization_code_redemptions(jti_sha256),
  subject_id text NOT NULL,
  issuer text NOT NULL,
  audience text NOT NULL CHECK (audience = 'rise'),
  role text NOT NULL CHECK (role IN ('student', 'mentor', 'operator', 'admin')),
  capabilities jsonb NOT NULL CHECK (jsonb_typeof(capabilities) = 'array'),
  created_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL,
  revoked_at timestamptz,
  revoke_reason text,
  CHECK (expires_at > created_at),
  CHECK (expires_at <= created_at + interval '12 hours'),
  CHECK ((revoked_at IS NULL AND revoke_reason IS NULL) OR (revoked_at IS NOT NULL AND revoke_reason IS NOT NULL))
);

CREATE TABLE rise_app.profile_consents (
  consent_id text PRIMARY KEY,
  subject_id text NOT NULL,
  matrix_projection_version text NOT NULL,
  allowed_fields jsonb NOT NULL CHECK (jsonb_typeof(allowed_fields) = 'array'),
  purpose text NOT NULL CHECK (purpose = 'rise_program_compatibility'),
  receipt_sha256 char(64) NOT NULL CHECK (receipt_sha256 ~ '^[0-9a-f]{64}$'),
  granted_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  CHECK (expires_at > granted_at),
  UNIQUE (subject_id, receipt_sha256),
  UNIQUE (consent_id, subject_id)
);

CREATE TABLE rise_app.profile_projections (
  projection_id text PRIMARY KEY,
  subject_id text NOT NULL,
  consent_id text NOT NULL,
  projection_version text NOT NULL,
  projection_sha256 char(64) NOT NULL CHECK (projection_sha256 ~ '^[0-9a-f]{64}$'),
  encrypted_projection bytea NOT NULL,
  encryption_key_id text NOT NULL,
  source_updated_at timestamptz NOT NULL,
  retrieved_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  CHECK (expires_at > retrieved_at),
  FOREIGN KEY (consent_id, subject_id) REFERENCES rise_app.profile_consents(consent_id, subject_id),
  UNIQUE (subject_id, projection_sha256)
);

CREATE TABLE rise_app.saved_programs (
  subject_id text NOT NULL,
  release_id text NOT NULL,
  program_id text NOT NULL,
  saved_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (subject_id, release_id, program_id),
  FOREIGN KEY (release_id, program_id) REFERENCES rise.programs(release_id, program_id)
);

CREATE TABLE rise_app.comparison_sets (
  comparison_set_id text PRIMARY KEY,
  subject_id text NOT NULL,
  title text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE rise_app.comparison_set_members (
  comparison_set_id text NOT NULL REFERENCES rise_app.comparison_sets(comparison_set_id) ON DELETE CASCADE,
  release_id text NOT NULL,
  program_specialty_id text NOT NULL,
  display_order smallint NOT NULL CHECK (display_order BETWEEN 1 AND 10),
  PRIMARY KEY (comparison_set_id, program_specialty_id),
  FOREIGN KEY (release_id, program_specialty_id)
    REFERENCES rise.program_specialties(release_id, program_specialty_id),
  UNIQUE (comparison_set_id, display_order)
);

CREATE TABLE rise_app.match_assessments (
  assessment_id text PRIMARY KEY,
  subject_id text NOT NULL,
  release_id text NOT NULL,
  program_specialty_id text NOT NULL,
  projection_sha256 char(64) NOT NULL CHECK (projection_sha256 ~ '^[0-9a-f]{64}$'),
  ruleset_version text NOT NULL,
  selected_criteria_sha256 char(64) NOT NULL CHECK (selected_criteria_sha256 ~ '^[0-9a-f]{64}$'),
  aggregate_outcome text NOT NULL CHECK (aggregate_outcome IN (
    'ALL_SELECTED_HARD_CRITERIA_CONFIRMED', 'PUBLISHED_REQUIREMENT_CONFLICT',
    'CONDITIONAL_REVIEW', 'REQUIREMENTS_INCOMPLETE', 'NOT_EVALUATED'
  )),
  explanation_claim_ids jsonb NOT NULL CHECK (jsonb_typeof(explanation_claim_ids) = 'array'),
  evaluated_at timestamptz NOT NULL,
  FOREIGN KEY (release_id, program_specialty_id)
    REFERENCES rise.program_specialties(release_id, program_specialty_id)
);

CREATE TABLE rise_app.handoff_grants (
  handoff_grant_id text PRIMARY KEY,
  subject_id text NOT NULL,
  target text NOT NULL CHECK (target IN ('cam', 'actn', 'storyforge')),
  audience text NOT NULL,
  jti_sha256 char(64) NOT NULL UNIQUE CHECK (jti_sha256 ~ '^[0-9a-f]{64}$'),
  payload_sha256 char(64) NOT NULL CHECK (payload_sha256 ~ '^[0-9a-f]{64}$'),
  issued_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  redeemed_at timestamptz,
  CHECK (expires_at > issued_at),
  CHECK (expires_at <= issued_at + interval '5 minutes'),
  CHECK (redeemed_at IS NULL OR redeemed_at <= expires_at)
);

CREATE TABLE rise_app.intelligence_queue_items (
  queue_item_id text PRIMARY KEY,
  release_id text NOT NULL REFERENCES rise.registry_releases(release_id),
  program_specialty_id text,
  claim_id text,
  reason_code text NOT NULL,
  status text NOT NULL CHECK (status IN ('open', 'in_review', 'resolved', 'dismissed')),
  assigned_subject text,
  resolution_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (program_specialty_id IS NOT NULL OR claim_id IS NOT NULL),
  FOREIGN KEY (release_id, program_specialty_id)
    REFERENCES rise.program_specialties(release_id, program_specialty_id),
  FOREIGN KEY (release_id, claim_id) REFERENCES rise.claims(release_id, claim_id)
);

CREATE TABLE rise_audit.audit_events (
  audit_event_id text PRIMARY KEY,
  occurred_at timestamptz NOT NULL,
  actor_subject text NOT NULL,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id text NOT NULL,
  request_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  previous_event_sha256 char(64),
  event_sha256 char(64) NOT NULL CHECK (event_sha256 ~ '^[0-9a-f]{64}$'),
  CHECK (previous_event_sha256 IS NULL OR previous_event_sha256 ~ '^[0-9a-f]{64}$')
);

CREATE TABLE rise_audit.recovery_checkpoints (
  recovery_checkpoint_id text PRIMARY KEY,
  release_id text NOT NULL REFERENCES rise.registry_releases(release_id),
  backup_reference text NOT NULL,
  backup_sha256 char(64) NOT NULL CHECK (backup_sha256 ~ '^[0-9a-f]{64}$'),
  backup_completed_at timestamptz NOT NULL,
  restore_rehearsal_status text NOT NULL CHECK (restore_rehearsal_status IN ('not_run', 'passed', 'failed')),
  restore_rehearsed_at timestamptz,
  recovery_point_seconds integer NOT NULL CHECK (recovery_point_seconds >= 0),
  recovery_time_seconds integer CHECK (recovery_time_seconds >= 0),
  evidence_uri text NOT NULL,
  recorded_by_subject text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (restore_rehearsal_status = 'not_run' AND restore_rehearsed_at IS NULL AND recovery_time_seconds IS NULL)
    OR (restore_rehearsal_status IN ('passed', 'failed') AND restore_rehearsed_at IS NOT NULL)
  )
);

CREATE FUNCTION rise_audit.reject_immutable_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, rise_audit
AS $$
BEGIN
  RAISE EXCEPTION 'RISE audit rows cannot be updated or deleted'
    USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER rise_audit_events_immutable
BEFORE UPDATE OR DELETE ON rise_audit.audit_events
FOR EACH ROW EXECUTE FUNCTION rise_audit.reject_immutable_mutation();

CREATE TRIGGER rise_recovery_checkpoints_immutable
BEFORE UPDATE OR DELETE ON rise_audit.recovery_checkpoints
FOR EACH ROW EXECUTE FUNCTION rise_audit.reject_immutable_mutation();

ALTER TABLE rise_app.authorization_code_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE rise_app.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE rise_app.profile_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE rise_app.profile_projections ENABLE ROW LEVEL SECURITY;
ALTER TABLE rise_app.saved_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE rise_app.comparison_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE rise_app.comparison_set_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE rise_app.match_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE rise_app.handoff_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE rise_app.intelligence_queue_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE rise_app.authorization_code_redemptions FORCE ROW LEVEL SECURITY;
ALTER TABLE rise_app.sessions FORCE ROW LEVEL SECURITY;
ALTER TABLE rise_app.profile_consents FORCE ROW LEVEL SECURITY;
ALTER TABLE rise_app.profile_projections FORCE ROW LEVEL SECURITY;
ALTER TABLE rise_app.saved_programs FORCE ROW LEVEL SECURITY;
ALTER TABLE rise_app.comparison_sets FORCE ROW LEVEL SECURITY;
ALTER TABLE rise_app.comparison_set_members FORCE ROW LEVEL SECURITY;
ALTER TABLE rise_app.match_assessments FORCE ROW LEVEL SECURITY;
ALTER TABLE rise_app.handoff_grants FORCE ROW LEVEL SECURITY;
ALTER TABLE rise_app.intelligence_queue_items FORCE ROW LEVEL SECURITY;

CREATE INDEX rise_sessions_subject_idx ON rise_app.sessions (subject_id, expires_at);
CREATE INDEX rise_profile_consents_subject_idx ON rise_app.profile_consents (subject_id, expires_at);
CREATE INDEX rise_profile_projections_subject_idx ON rise_app.profile_projections (subject_id, expires_at);
CREATE INDEX rise_match_assessments_subject_idx ON rise_app.match_assessments (subject_id, evaluated_at);
CREATE INDEX rise_queue_status_idx ON rise_app.intelligence_queue_items (status, created_at);
CREATE INDEX rise_audit_events_target_idx ON rise_audit.audit_events (target_type, target_id, occurred_at);
CREATE INDEX rise_recovery_checkpoints_release_idx ON rise_audit.recovery_checkpoints (release_id, backup_completed_at);

REVOKE ALL ON ALL TABLES IN SCHEMA rise_app FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA rise_app FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA rise_app FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA rise_audit FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA rise_audit FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA rise_audit FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA rise_app REVOKE ALL ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA rise_app REVOKE ALL ON SEQUENCES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA rise_app REVOKE ALL ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA rise_audit REVOKE ALL ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA rise_audit REVOKE ALL ON SEQUENCES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA rise_audit REVOKE ALL ON FUNCTIONS FROM PUBLIC;

COMMIT;
