BEGIN;

CREATE TABLE IF NOT EXISTS command_center.usce_public_intake_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'new',
  student_name text NOT NULL,
  email text NOT NULL,
  phone text,
  training_level_or_school text,
  preferred_specialties jsonb NOT NULL DEFAULT '[]'::jsonb,
  preferred_locations jsonb NOT NULL DEFAULT '[]'::jsonb,
  preferred_months_or_dates jsonb NOT NULL DEFAULT '[]'::jsonb,
  duration_weeks integer,
  flexibility text,
  notes text,
  consent boolean NOT NULL DEFAULT false,
  source text NOT NULL DEFAULT 'r2_usce_request',
  source_url text,
  user_agent text,
  ip_hash text,
  idempotency_key text,
  payment_product_url text,
  learndash_course_url text,
  promoted_usce_request_id uuid,
  promoted_at timestamptz,
  admin_notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT usce_public_intake_requests_status_check
    CHECK (status = ANY (ARRAY[
      'new',
      'reviewed',
      'in_progress',
      'offer_ready',
      'promoted',
      'declined',
      'archived'
    ])),
  CONSTRAINT usce_public_intake_requests_student_name_check
    CHECK (char_length(btrim(student_name)) BETWEEN 2 AND 200),
  CONSTRAINT usce_public_intake_requests_email_check
    CHECK (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  CONSTRAINT usce_public_intake_requests_training_check
    CHECK (training_level_or_school IS NULL OR char_length(btrim(training_level_or_school)) BETWEEN 2 AND 240),
  CONSTRAINT usce_public_intake_requests_specialties_json_check
    CHECK (jsonb_typeof(preferred_specialties) = 'array' AND jsonb_array_length(preferred_specialties) BETWEEN 1 AND 4),
  CONSTRAINT usce_public_intake_requests_locations_json_check
    CHECK (jsonb_typeof(preferred_locations) = 'array' AND jsonb_array_length(preferred_locations) BETWEEN 1 AND 4),
  CONSTRAINT usce_public_intake_requests_months_json_check
    CHECK (jsonb_typeof(preferred_months_or_dates) = 'array' AND jsonb_array_length(preferred_months_or_dates) BETWEEN 1 AND 6),
  CONSTRAINT usce_public_intake_requests_duration_weeks_check
    CHECK (duration_weeks IS NULL OR duration_weeks BETWEEN 1 AND 24),
  CONSTRAINT usce_public_intake_requests_consent_check
    CHECK (consent = true),
  CONSTRAINT usce_public_intake_requests_promoted_request_fkey
    FOREIGN KEY (promoted_usce_request_id) REFERENCES command_center.usce_requests(id)
);

COMMENT ON TABLE command_center.usce_public_intake_requests IS
  'Request-first public USCE/Clinicals availability intake. Rows are created by the Railway public intake endpoint before a program seat is assigned.';
COMMENT ON COLUMN command_center.usce_public_intake_requests.promoted_usce_request_id IS
  'Optional link to command_center.usce_requests after coordinator review assigns a seat/program and promotes the intake.';
COMMENT ON COLUMN command_center.usce_public_intake_requests.idempotency_key IS
  'Durable create-only idempotency key supplied or derived by the Railway endpoint.';
COMMENT ON COLUMN command_center.usce_public_intake_requests.metadata IS
  'Sanitized operational metadata such as UTM fields, source version, and public endpoint dry-run/write-mode context. Do not store secrets.';

CREATE UNIQUE INDEX IF NOT EXISTS usce_public_intake_requests_idempotency_key_idx
  ON command_center.usce_public_intake_requests (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS usce_public_intake_requests_created_idx
  ON command_center.usce_public_intake_requests (created_at DESC);

CREATE INDEX IF NOT EXISTS usce_public_intake_requests_status_idx
  ON command_center.usce_public_intake_requests (status);

CREATE INDEX IF NOT EXISTS usce_public_intake_requests_email_idx
  ON command_center.usce_public_intake_requests (lower(email));

CREATE INDEX IF NOT EXISTS usce_public_intake_requests_promoted_idx
  ON command_center.usce_public_intake_requests (promoted_usce_request_id)
  WHERE promoted_usce_request_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS usce_public_intake_requests_metadata_gin_idx
  ON command_center.usce_public_intake_requests USING gin (metadata);

ALTER TABLE command_center.usce_public_intake_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS coord_full ON command_center.usce_public_intake_requests;
CREATE POLICY coord_full ON command_center.usce_public_intake_requests
  FOR ALL
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'mm_role') IN ('coordinator', 'admin'))
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'mm_role') IN ('coordinator', 'admin'));

GRANT SELECT, UPDATE ON command_center.usce_public_intake_requests TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON command_center.usce_public_intake_requests TO service_role;

DROP TRIGGER IF EXISTS usce_public_intake_requests_set_updated_at
  ON command_center.usce_public_intake_requests;
CREATE TRIGGER usce_public_intake_requests_set_updated_at
BEFORE UPDATE ON command_center.usce_public_intake_requests
FOR EACH ROW
EXECUTE FUNCTION command_center.usce_set_updated_at();

DROP TRIGGER IF EXISTS usce_public_intake_requests_audit_trigger
  ON command_center.usce_public_intake_requests;
CREATE TRIGGER usce_public_intake_requests_audit_trigger
AFTER INSERT OR UPDATE OR DELETE ON command_center.usce_public_intake_requests
FOR EACH ROW
EXECUTE FUNCTION command_center.audit_trigger_fn();

ALTER TABLE command_center.usce_comms
  ADD COLUMN IF NOT EXISTS intake_request_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'usce_comms_intake_request_id_fkey'
      AND conrelid = 'command_center.usce_comms'::regclass
  ) THEN
    ALTER TABLE command_center.usce_comms
      ADD CONSTRAINT usce_comms_intake_request_id_fkey
      FOREIGN KEY (intake_request_id)
      REFERENCES command_center.usce_public_intake_requests(id)
      ON DELETE SET NULL
      NOT VALID;
  END IF;
END $$;

ALTER TABLE command_center.usce_comms
  VALIDATE CONSTRAINT usce_comms_intake_request_id_fkey;

CREATE INDEX IF NOT EXISTS usce_comms_intake_request_idx
  ON command_center.usce_comms (intake_request_id);

COMMENT ON COLUMN command_center.usce_comms.intake_request_id IS
  'Optional link to command_center.usce_public_intake_requests for request-first intake communications before formal offer/request promotion.';

COMMIT;
