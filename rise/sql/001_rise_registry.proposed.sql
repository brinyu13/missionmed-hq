-- P1-RISE-4006 proposed dedicated PostgreSQL schema.
-- Do not apply to the linked RankListIQ Supabase project.
-- Production use requires an approved RISE database owner, roles, backup, and rehearsal.

BEGIN;

CREATE SCHEMA IF NOT EXISTS rise;
REVOKE ALL ON SCHEMA rise FROM PUBLIC;

-- NOLOGIN group roles separate read, immutable-release import, and activation.
-- Login-role membership is provisioned outside this migration by the approved
-- database owner and must never be granted to a browser connection.
DO $roles$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'rise_registry_reader') THEN
    CREATE ROLE rise_registry_reader NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'rise_registry_importer') THEN
    CREATE ROLE rise_registry_importer NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'rise_registry_release_manager') THEN
    CREATE ROLE rise_registry_release_manager NOLOGIN;
  END IF;
END
$roles$;

CREATE TABLE rise.registry_releases (
  release_id text PRIMARY KEY,
  source_snapshot_id text NOT NULL,
  source_sha256 char(64) NOT NULL CHECK (source_sha256 ~ '^[0-9a-f]{64}$'),
  activation_status text NOT NULL CHECK (activation_status IN ('offline_shadow_only', 'staging', 'active', 'retired')),
  immutable boolean NOT NULL DEFAULT true CHECK (immutable),
  counts jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX rise_registry_one_active_release_idx
  ON rise.registry_releases (activation_status)
  WHERE activation_status = 'active';

CREATE TABLE rise.registry_activation_history (
  activation_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  action text NOT NULL CHECK (action IN ('activate', 'rollback')),
  previous_release_id text REFERENCES rise.registry_releases(release_id),
  target_release_id text NOT NULL REFERENCES rise.registry_releases(release_id),
  restores_activation_id bigint,
  actor_subject text NOT NULL CHECK (btrim(actor_subject) <> ''),
  actor_database_role text NOT NULL CHECK (btrim(actor_database_role) <> ''),
  reason text NOT NULL CHECK (btrim(reason) <> ''),
  activated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (activation_id, target_release_id),
  FOREIGN KEY (restores_activation_id, target_release_id)
    REFERENCES rise.registry_activation_history(activation_id, target_release_id),
  CHECK (previous_release_id IS NULL OR previous_release_id <> target_release_id),
  CHECK (action <> 'rollback' OR previous_release_id IS NOT NULL),
  CHECK (
    (action = 'activate' AND restores_activation_id IS NULL)
    OR (action = 'rollback' AND restores_activation_id IS NOT NULL)
  )
);

-- This row always exists, which gives concurrent activations one lock target even
-- before the first release is activated. The paired foreign key guarantees that
-- the pointer and its audit event identify the same release.
CREATE TABLE rise.registry_active_release (
  singleton_key boolean PRIMARY KEY DEFAULT true CHECK (singleton_key),
  active_release_id text REFERENCES rise.registry_releases(release_id),
  last_activation_id bigint,
  CHECK (
    (active_release_id IS NULL AND last_activation_id IS NULL)
    OR (active_release_id IS NOT NULL AND last_activation_id IS NOT NULL)
  ),
  FOREIGN KEY (last_activation_id, active_release_id)
    REFERENCES rise.registry_activation_history(activation_id, target_release_id)
);

INSERT INTO rise.registry_active_release (singleton_key) VALUES (true);

CREATE TABLE rise.import_runs (
  release_id text NOT NULL REFERENCES rise.registry_releases(release_id),
  import_run_id text NOT NULL,
  importer_version text NOT NULL,
  input_sha256 char(64) NOT NULL CHECK (input_sha256 ~ '^[0-9a-f]{64}$'),
  status text NOT NULL CHECK (status IN ('validated', 'failed', 'activated', 'rolled_back')),
  validation_summary jsonb NOT NULL,
  started_at timestamptz NOT NULL,
  finished_at timestamptz,
  actor_subject text,
  PRIMARY KEY (release_id, import_run_id)
);

CREATE TABLE rise.source_documents (
  release_id text NOT NULL REFERENCES rise.registry_releases(release_id),
  source_document_id text NOT NULL,
  authority text NOT NULL,
  assertion_class text NOT NULL CHECK (assertion_class IN ('authoritative', 'program_reported', 'observed', 'missionmed_interpretation')),
  source_urls jsonb NOT NULL CHECK (jsonb_typeof(source_urls) = 'array'),
  retrieved_at date NOT NULL,
  source_updated_at date,
  survey_received_at date,
  source_sha256 char(64) CHECK (source_sha256 IS NULL OR source_sha256 ~ '^[0-9a-f]{64}$'),
  PRIMARY KEY (release_id, source_document_id)
);

CREATE TABLE rise.programs (
  release_id text NOT NULL REFERENCES rise.registry_releases(release_id),
  program_id text NOT NULL,
  canonical_external_id text NOT NULL,
  program_name text NOT NULL,
  institution text,
  hospital text,
  city text,
  jurisdiction text,
  postal_code text,
  source_document_id text NOT NULL,
  PRIMARY KEY (release_id, program_id),
  UNIQUE (release_id, canonical_external_id),
  FOREIGN KEY (release_id, source_document_id)
    REFERENCES rise.source_documents(release_id, source_document_id)
);

CREATE TABLE rise.specialties (
  release_id text NOT NULL REFERENCES rise.registry_releases(release_id),
  specialty_id text NOT NULL,
  canonical_name text NOT NULL,
  taxonomy_version text NOT NULL,
  PRIMARY KEY (release_id, specialty_id),
  UNIQUE (release_id, canonical_name)
);

CREATE TABLE rise.program_specialties (
  release_id text NOT NULL REFERENCES rise.registry_releases(release_id),
  program_specialty_id text NOT NULL,
  program_id text NOT NULL,
  exact_designation text NOT NULL,
  program_kind text NOT NULL CHECK (program_kind IN ('single', 'combined')),
  entry_format text NOT NULL,
  components jsonb NOT NULL CHECK (jsonb_typeof(components) = 'array'),
  PRIMARY KEY (release_id, program_specialty_id),
  UNIQUE (release_id, program_id),
  FOREIGN KEY (release_id, program_id)
    REFERENCES rise.programs(release_id, program_id)
);

CREATE TABLE rise.browse_memberships (
  release_id text NOT NULL REFERENCES rise.registry_releases(release_id),
  browse_membership_id text NOT NULL,
  program_specialty_id text NOT NULL,
  specialty_id text NOT NULL,
  relationship text NOT NULL CHECK (relationship IN ('EXACT_DESIGNATION', 'RELATED_SPECIALTY', 'RELATED_COMBINED')),
  PRIMARY KEY (release_id, browse_membership_id),
  UNIQUE (release_id, program_specialty_id, specialty_id),
  FOREIGN KEY (release_id, program_specialty_id)
    REFERENCES rise.program_specialties(release_id, program_specialty_id),
  FOREIGN KEY (release_id, specialty_id)
    REFERENCES rise.specialties(release_id, specialty_id)
);

CREATE TABLE rise.claims (
  release_id text NOT NULL REFERENCES rise.registry_releases(release_id),
  claim_id text NOT NULL,
  subject_type text NOT NULL CHECK (subject_type IN ('program', 'program_specialty')),
  subject_id text NOT NULL,
  program_id text,
  program_specialty_id text,
  field_name text NOT NULL,
  knowledge_state text NOT NULL CHECK (knowledge_state IN ('known', 'unknown')),
  value_jsonb jsonb,
  explicit boolean NOT NULL,
  evidence_class text NOT NULL,
  publication text NOT NULL CHECK (publication IN ('source_attributed_snapshot', 'quarantined')),
  source_document_id text NOT NULL,
  source_url text,
  source_updated_at date,
  survey_received_at date,
  source_locator jsonb,
  current_cycle boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (release_id, claim_id),
  FOREIGN KEY (release_id, source_document_id)
    REFERENCES rise.source_documents(release_id, source_document_id),
  FOREIGN KEY (release_id, program_id)
    REFERENCES rise.programs(release_id, program_id),
  FOREIGN KEY (release_id, program_specialty_id)
    REFERENCES rise.program_specialties(release_id, program_specialty_id),
  CHECK (
    (subject_type = 'program' AND program_id IS NOT NULL AND program_id = subject_id AND program_specialty_id IS NULL)
    OR
    (subject_type = 'program_specialty' AND program_specialty_id IS NOT NULL AND program_specialty_id = subject_id AND program_id IS NULL)
  ),
  CHECK (
    (knowledge_state = 'known' AND value_jsonb IS NOT NULL)
    OR (knowledge_state = 'unknown' AND value_jsonb IS NULL)
  )
);

CREATE TABLE rise.quarantined_observations (
  release_id text NOT NULL REFERENCES rise.registry_releases(release_id),
  quarantine_id text NOT NULL,
  external_identifier_raw text,
  reason_code text NOT NULL,
  reviewed_resolution text,
  source_row_reference text NOT NULL,
  payload_sha256 char(64) NOT NULL CHECK (payload_sha256 ~ '^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (release_id, quarantine_id)
);

CREATE INDEX rise_programs_location_idx ON rise.programs (release_id, jurisdiction, city);
CREATE INDEX rise_program_specialties_designation_idx ON rise.program_specialties (release_id, exact_designation);
CREATE INDEX rise_browse_memberships_specialty_idx ON rise.browse_memberships (release_id, specialty_id, relationship);
CREATE INDEX rise_claims_subject_idx ON rise.claims (release_id, subject_type, subject_id);
CREATE INDEX rise_claims_field_idx ON rise.claims (release_id, field_name, knowledge_state, publication);
CREATE INDEX rise_source_documents_authority_idx ON rise.source_documents (release_id, authority);
CREATE INDEX rise_activation_history_target_idx ON rise.registry_activation_history (target_release_id, activation_id DESC);

-- Imported snapshot rows are append-only and may be inserted only while their
-- parent release is offline or staging. The shared parent-row lock serializes
-- import writes against activation, so an importer cannot add rows after the
-- immutable release becomes active or retired.
CREATE FUNCTION rise.enforce_registry_release_insert_state()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, rise
AS $$
BEGIN
  IF NEW.activation_status NOT IN ('offline_shadow_only', 'staging') THEN
    RAISE EXCEPTION 'A new RISE registry release must begin offline or staging (found %)', NEW.activation_status
      USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION rise.enforce_open_release_snapshot_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, rise
AS $$
DECLARE
  v_release_status text;
BEGIN
  SELECT activation_status
    INTO v_release_status
    FROM rise.registry_releases
    WHERE release_id = NEW.release_id
    FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unknown RISE release for snapshot insert: %', NEW.release_id
      USING ERRCODE = '23503';
  END IF;
  IF v_release_status NOT IN ('offline_shadow_only', 'staging') THEN
    RAISE EXCEPTION 'RISE release % is % and no longer accepts snapshot inserts', NEW.release_id, v_release_status
      USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION rise.reject_snapshot_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, rise
AS $$
BEGIN
  RAISE EXCEPTION 'RISE immutable snapshot table % does not permit %', TG_TABLE_NAME, TG_OP
    USING ERRCODE = '55000';
END;
$$;

CREATE FUNCTION rise.enforce_registry_release_immutability()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, rise
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'RISE registry releases cannot be deleted'
      USING ERRCODE = '55000';
  END IF;
  IF NEW.release_id IS DISTINCT FROM OLD.release_id
    OR NEW.source_snapshot_id IS DISTINCT FROM OLD.source_snapshot_id
    OR NEW.source_sha256 IS DISTINCT FROM OLD.source_sha256
    OR NEW.immutable IS DISTINCT FROM OLD.immutable
    OR NEW.counts IS DISTINCT FROM OLD.counts
    OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'RISE immutable release identity, source, counts, and creation metadata cannot change'
      USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER rise_registry_releases_immutable
  BEFORE UPDATE OR DELETE ON rise.registry_releases
  FOR EACH ROW EXECUTE FUNCTION rise.enforce_registry_release_immutability();

CREATE TRIGGER rise_registry_releases_valid_initial_state
  BEFORE INSERT ON rise.registry_releases
  FOR EACH ROW EXECUTE FUNCTION rise.enforce_registry_release_insert_state();

CREATE TRIGGER rise_import_runs_open_release_insert
  BEFORE INSERT ON rise.import_runs
  FOR EACH ROW EXECUTE FUNCTION rise.enforce_open_release_snapshot_insert();
CREATE TRIGGER rise_source_documents_open_release_insert
  BEFORE INSERT ON rise.source_documents
  FOR EACH ROW EXECUTE FUNCTION rise.enforce_open_release_snapshot_insert();
CREATE TRIGGER rise_programs_open_release_insert
  BEFORE INSERT ON rise.programs
  FOR EACH ROW EXECUTE FUNCTION rise.enforce_open_release_snapshot_insert();
CREATE TRIGGER rise_specialties_open_release_insert
  BEFORE INSERT ON rise.specialties
  FOR EACH ROW EXECUTE FUNCTION rise.enforce_open_release_snapshot_insert();
CREATE TRIGGER rise_program_specialties_open_release_insert
  BEFORE INSERT ON rise.program_specialties
  FOR EACH ROW EXECUTE FUNCTION rise.enforce_open_release_snapshot_insert();
CREATE TRIGGER rise_browse_memberships_open_release_insert
  BEFORE INSERT ON rise.browse_memberships
  FOR EACH ROW EXECUTE FUNCTION rise.enforce_open_release_snapshot_insert();
CREATE TRIGGER rise_claims_open_release_insert
  BEFORE INSERT ON rise.claims
  FOR EACH ROW EXECUTE FUNCTION rise.enforce_open_release_snapshot_insert();
CREATE TRIGGER rise_quarantined_observations_open_release_insert
  BEFORE INSERT ON rise.quarantined_observations
  FOR EACH ROW EXECUTE FUNCTION rise.enforce_open_release_snapshot_insert();

CREATE TRIGGER rise_import_runs_append_only
  BEFORE UPDATE OR DELETE ON rise.import_runs
  FOR EACH ROW EXECUTE FUNCTION rise.reject_snapshot_mutation();
CREATE TRIGGER rise_source_documents_append_only
  BEFORE UPDATE OR DELETE ON rise.source_documents
  FOR EACH ROW EXECUTE FUNCTION rise.reject_snapshot_mutation();
CREATE TRIGGER rise_programs_append_only
  BEFORE UPDATE OR DELETE ON rise.programs
  FOR EACH ROW EXECUTE FUNCTION rise.reject_snapshot_mutation();
CREATE TRIGGER rise_specialties_append_only
  BEFORE UPDATE OR DELETE ON rise.specialties
  FOR EACH ROW EXECUTE FUNCTION rise.reject_snapshot_mutation();
CREATE TRIGGER rise_program_specialties_append_only
  BEFORE UPDATE OR DELETE ON rise.program_specialties
  FOR EACH ROW EXECUTE FUNCTION rise.reject_snapshot_mutation();
CREATE TRIGGER rise_browse_memberships_append_only
  BEFORE UPDATE OR DELETE ON rise.browse_memberships
  FOR EACH ROW EXECUTE FUNCTION rise.reject_snapshot_mutation();
CREATE TRIGGER rise_claims_append_only
  BEFORE UPDATE OR DELETE ON rise.claims
  FOR EACH ROW EXECUTE FUNCTION rise.reject_snapshot_mutation();
CREATE TRIGGER rise_quarantined_observations_append_only
  BEFORE UPDATE OR DELETE ON rise.quarantined_observations
  FOR EACH ROW EXECUTE FUNCTION rise.reject_snapshot_mutation();
CREATE TRIGGER rise_activation_history_append_only
  BEFORE UPDATE OR DELETE ON rise.registry_activation_history
  FOR EACH ROW EXECUTE FUNCTION rise.reject_snapshot_mutation();

-- One statement performs promotion or rollback. The singleton row lock and the
-- expected-current comparison serialize callers and prevent stale automation
-- from replacing a release selected by another operator.
CREATE FUNCTION rise.set_active_registry_release(
  p_target_release_id text,
  p_action text,
  p_expected_current_release_id text,
  p_actor_subject text,
  p_reason text
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, rise
AS $$
DECLARE
  v_current_release_id text;
  v_current_activation_id bigint;
  v_target_status text;
  v_target_immutable boolean;
  v_restores_activation_id bigint;
  v_activation_id bigint;
BEGIN
  IF p_action IS NULL OR p_action NOT IN ('activate', 'rollback') THEN
    RAISE EXCEPTION 'Unsupported RISE release action: %', p_action
      USING ERRCODE = '22023';
  END IF;
  IF nullif(btrim(p_actor_subject), '') IS NULL THEN
    RAISE EXCEPTION 'RISE release activation requires an actor subject'
      USING ERRCODE = '22023';
  END IF;
  IF nullif(btrim(p_reason), '') IS NULL THEN
    RAISE EXCEPTION 'RISE release activation requires a reason'
      USING ERRCODE = '22023';
  END IF;

  SELECT active_release_id, last_activation_id
    INTO v_current_release_id, v_current_activation_id
    FROM rise.registry_active_release
    WHERE singleton_key = true
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'RISE active-release pointer is missing'
      USING ERRCODE = '55000';
  END IF;
  IF v_current_release_id IS DISTINCT FROM p_expected_current_release_id THEN
    RAISE EXCEPTION 'RISE active release changed (expected %, found %)',
      p_expected_current_release_id, v_current_release_id
      USING ERRCODE = '40001';
  END IF;
  IF v_current_release_id IS NOT DISTINCT FROM p_target_release_id THEN
    RAISE EXCEPTION 'RISE release % is already active', p_target_release_id
      USING ERRCODE = '22023';
  END IF;

  SELECT activation_status, immutable
    INTO v_target_status, v_target_immutable
    FROM rise.registry_releases
    WHERE release_id = p_target_release_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unknown RISE release: %', p_target_release_id
      USING ERRCODE = '22023';
  END IF;
  IF v_target_immutable IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'RISE release % is not immutable', p_target_release_id
      USING ERRCODE = '55000';
  END IF;

  IF v_current_release_id IS NOT NULL THEN
    PERFORM 1
      FROM rise.registry_releases
      WHERE release_id = v_current_release_id
        AND activation_status = 'active'
        AND immutable = true
      FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'RISE active-release pointer and lifecycle state disagree'
        USING ERRCODE = '55000';
    END IF;
  END IF;

  IF p_action = 'activate' THEN
    IF v_target_status <> 'staging' THEN
      RAISE EXCEPTION 'Only a staging RISE release can be activated (found %)', v_target_status
        USING ERRCODE = '55000';
    END IF;
  ELSE
    IF v_current_release_id IS NULL THEN
      RAISE EXCEPTION 'RISE rollback requires a currently active release'
        USING ERRCODE = '55000';
    END IF;
    IF v_target_status <> 'retired' THEN
      RAISE EXCEPTION 'RISE rollback target must be retired (found %)', v_target_status
        USING ERRCODE = '55000';
    END IF;

    SELECT activation_id
      INTO v_restores_activation_id
      FROM rise.registry_activation_history
      WHERE target_release_id = p_target_release_id
        AND activation_id < v_current_activation_id
      ORDER BY activation_id DESC
      LIMIT 1;

    IF v_restores_activation_id IS NULL THEN
      RAISE EXCEPTION 'RISE release % has no prior activation to restore', p_target_release_id
        USING ERRCODE = '55000';
    END IF;
  END IF;

  IF v_current_release_id IS NOT NULL THEN
    UPDATE rise.registry_releases
      SET activation_status = 'retired'
      WHERE release_id = v_current_release_id;
  END IF;

  UPDATE rise.registry_releases
    SET activation_status = 'active'
    WHERE release_id = p_target_release_id;

  INSERT INTO rise.registry_activation_history (
    action,
    previous_release_id,
    target_release_id,
    restores_activation_id,
    actor_subject,
    actor_database_role,
    reason
  ) VALUES (
    p_action,
    v_current_release_id,
    p_target_release_id,
    v_restores_activation_id,
    p_actor_subject,
    session_user,
    p_reason
  )
  RETURNING activation_id INTO v_activation_id;

  UPDATE rise.registry_active_release
    SET active_release_id = p_target_release_id,
        last_activation_id = v_activation_id
    WHERE singleton_key = true;

  RETURN v_activation_id;
END;
$$;

REVOKE ALL ON ALL TABLES IN SCHEMA rise FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA rise FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA rise FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA rise REVOKE ALL ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA rise REVOKE ALL ON SEQUENCES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA rise REVOKE ALL ON FUNCTIONS FROM PUBLIC;

GRANT USAGE ON SCHEMA rise TO rise_registry_reader, rise_registry_importer, rise_registry_release_manager;
GRANT SELECT ON ALL TABLES IN SCHEMA rise TO rise_registry_reader;
GRANT SELECT, INSERT ON
  rise.registry_releases,
  rise.import_runs,
  rise.source_documents,
  rise.programs,
  rise.specialties,
  rise.program_specialties,
  rise.browse_memberships,
  rise.claims,
  rise.quarantined_observations
TO rise_registry_importer;
GRANT EXECUTE ON FUNCTION rise.set_active_registry_release(text, text, text, text, text)
  TO rise_registry_release_manager;

COMMIT;
