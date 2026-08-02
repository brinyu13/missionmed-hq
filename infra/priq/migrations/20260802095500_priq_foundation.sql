BEGIN;

CREATE SCHEMA IF NOT EXISTS priq;

CREATE TABLE IF NOT EXISTS priq.subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  display_name text NOT NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS priq.subject_members (
  tenant_id uuid NOT NULL,
  subject_id uuid NOT NULL REFERENCES priq.subjects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  relationship text NOT NULL CHECK (relationship IN ('student','founder','admin','coach')),
  PRIMARY KEY (subject_id, user_id)
);

CREATE TABLE IF NOT EXISTS priq.sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  subject_id uuid NOT NULL REFERENCES priq.subjects(id) ON DELETE CASCADE,
  evidence_class text NOT NULL,
  source_type text NOT NULL,
  title text NOT NULL,
  uri text NOT NULL,
  sha256 text,
  consent_basis text,
  status text NOT NULL CHECK (status IN ('available','pending_upload','quarantined','adapter_unavailable')),
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (sha256 IS NULL OR sha256 ~ '^[a-f0-9]{64}$')
);

CREATE TABLE IF NOT EXISTS priq.claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  subject_id uuid NOT NULL REFERENCES priq.subjects(id) ON DELETE CASCADE,
  kind text NOT NULL,
  claim_text text NOT NULL,
  confidence text NOT NULL CHECK (confidence IN ('low','medium','high')),
  evidence jsonb NOT NULL CHECK (jsonb_typeof(evidence) = 'array' AND jsonb_array_length(evidence) > 0),
  status text NOT NULL CHECK (status IN ('draft','in_review','approved','rejected','superseded')),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_by uuid NOT NULL REFERENCES auth.users(id),
  reviewed_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz
);

CREATE TABLE IF NOT EXISTS priq.feature_flags (
  tenant_id uuid NOT NULL,
  scope_type text NOT NULL CHECK (scope_type IN ('global','cohort','subject','feature')),
  scope_id text NOT NULL,
  flag_key text NOT NULL,
  enabled boolean NOT NULL,
  updated_by uuid NOT NULL REFERENCES auth.users(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, scope_type, scope_id, flag_key)
);

CREATE TABLE IF NOT EXISTS priq.model_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  subject_id uuid REFERENCES priq.subjects(id) ON DELETE SET NULL,
  request_id text NOT NULL UNIQUE,
  capability text NOT NULL,
  provider text NOT NULL,
  model text NOT NULL,
  prompt_version text NOT NULL,
  input_hash text NOT NULL CHECK (input_hash ~ '^[a-f0-9]{64}$'),
  output_hash text CHECK (output_hash IS NULL OR output_hash ~ '^[a-f0-9]{64}$'),
  input_tokens integer NOT NULL DEFAULT 0 CHECK (input_tokens >= 0),
  output_tokens integer NOT NULL DEFAULT 0 CHECK (output_tokens >= 0),
  cost_usd numeric(12,6) NOT NULL DEFAULT 0 CHECK (cost_usd >= 0),
  latency_ms integer NOT NULL DEFAULT 0 CHECK (latency_ms >= 0),
  status text NOT NULL CHECK (status IN ('succeeded','failed','blocked')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS priq.audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  actor_id uuid NOT NULL REFERENCES auth.users(id),
  action text NOT NULL,
  target_type text NOT NULL,
  target_id text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE priq.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE priq.subject_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE priq.sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE priq.claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE priq.feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE priq.model_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE priq.audit_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY subjects_tenant_staff ON priq.subjects
  FOR ALL TO authenticated
  USING (tenant_id = nullif(auth.jwt()->>'tenant_id','')::uuid AND auth.jwt()->'app_metadata'->>'priq_role' IN ('founder','admin','coach'))
  WITH CHECK (tenant_id = nullif(auth.jwt()->>'tenant_id','')::uuid AND auth.jwt()->'app_metadata'->>'priq_role' IN ('founder','admin'));

CREATE POLICY subject_members_self_or_staff ON priq.subject_members
  FOR SELECT TO authenticated
  USING (tenant_id = nullif(auth.jwt()->>'tenant_id','')::uuid AND (user_id = auth.uid() OR auth.jwt()->'app_metadata'->>'priq_role' IN ('founder','admin','coach')));

CREATE POLICY sources_tenant_staff ON priq.sources
  FOR ALL TO authenticated
  USING (tenant_id = nullif(auth.jwt()->>'tenant_id','')::uuid AND auth.jwt()->'app_metadata'->>'priq_role' IN ('founder','admin','coach'))
  WITH CHECK (tenant_id = nullif(auth.jwt()->>'tenant_id','')::uuid AND auth.jwt()->'app_metadata'->>'priq_role' IN ('founder','admin','coach'));

CREATE POLICY claims_tenant_staff ON priq.claims
  FOR ALL TO authenticated
  USING (tenant_id = nullif(auth.jwt()->>'tenant_id','')::uuid AND auth.jwt()->'app_metadata'->>'priq_role' IN ('founder','admin','coach'))
  WITH CHECK (tenant_id = nullif(auth.jwt()->>'tenant_id','')::uuid AND auth.jwt()->'app_metadata'->>'priq_role' IN ('founder','admin','coach'));

CREATE POLICY flags_founder_admin ON priq.feature_flags
  FOR ALL TO authenticated
  USING (tenant_id = nullif(auth.jwt()->>'tenant_id','')::uuid AND auth.jwt()->'app_metadata'->>'priq_role' IN ('founder','admin'))
  WITH CHECK (tenant_id = nullif(auth.jwt()->>'tenant_id','')::uuid AND auth.jwt()->'app_metadata'->>'priq_role' IN ('founder','admin'));

CREATE POLICY model_runs_founder_admin ON priq.model_runs
  FOR SELECT TO authenticated
  USING (tenant_id = nullif(auth.jwt()->>'tenant_id','')::uuid AND auth.jwt()->'app_metadata'->>'priq_role' IN ('founder','admin'));

CREATE POLICY audit_founder_admin_read ON priq.audit_events
  FOR SELECT TO authenticated
  USING (tenant_id = nullif(auth.jwt()->>'tenant_id','')::uuid AND auth.jwt()->'app_metadata'->>'priq_role' IN ('founder','admin'));

CREATE POLICY audit_staff_append ON priq.audit_events
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = nullif(auth.jwt()->>'tenant_id','')::uuid AND actor_id = auth.uid() AND auth.jwt()->'app_metadata'->>'priq_role' IN ('founder','admin','coach'));

REVOKE UPDATE, DELETE ON priq.audit_events FROM authenticated;

COMMIT;
