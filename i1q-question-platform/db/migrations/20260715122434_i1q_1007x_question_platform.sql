-- Migration: 20260715122434_i1q_1007x_question_platform.sql
-- Ticket: I1Q-1007X
-- Authority: MissionMed OS DR-006; MR-078A; MR-078B; Architecture 1002.1
-- Target: RANKLISTIQ, additive schema i1q; OFFLINE APP-OWNED CANDIDATE ONLY
-- Date: 2026-07-15 UTC
-- Depends on: none; standalone clean-schema candidate that does not apply or modify 0001_i1q_question_platform.sql
-- Dependencies: PostgreSQL 15+, auth.uid(), pgcrypto, and a future explicitly approved unprivileged I1Q runtime role
-- Description: Creates the deny-by-default Question Platform schema, immutable lineage, scoped review, release, export, and audit boundaries.
-- Idempotent: YES for an exact clean apply and exact re-apply; refuses a pre-existing unversioned i1q table estate.
-- Risk: HIGH; auth/runtime grants, preview execution, staging, and the canonical RANKLISTIQ migration route remain unresolved.
-- Rollback/Compensation: Apply 20260715122435_i1q_1007x_compensating_disable.sql to disable behavior while preserving all data and history.

BEGIN;

DO $migration_guard$
DECLARE
  existing_tables bigint;
BEGIN
  IF pg_catalog.to_regnamespace('i1q') IS NOT NULL THEN
    SELECT count(*)
      INTO existing_tables
      FROM pg_catalog.pg_class c
      JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'i1q'
       AND c.relkind IN ('r', 'p');

    IF existing_tables > 0
       AND pg_catalog.to_regclass('i1q.schema_versions') IS NULL THEN
      RAISE EXCEPTION 'i1q_unversioned_schema_requires_authoritative_reconciliation'
        USING ERRCODE = '55000';
    END IF;
  END IF;
END
$migration_guard$;

CREATE SCHEMA IF NOT EXISTS i1q;
CREATE SCHEMA IF NOT EXISTS i1q_extensions;

DO $auth_dependency$
BEGIN
  IF pg_catalog.to_regprocedure('auth.uid()') IS NULL THEN
    RAISE EXCEPTION 'i1q_auth_uid_dependency_missing'
      USING ERRCODE = '55000';
  END IF;
END
$auth_dependency$;

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA i1q_extensions;

DO $hash_helper$
DECLARE
  extension_schema text;
BEGIN
  SELECT n.nspname
    INTO extension_schema
    FROM pg_catalog.pg_extension e
    JOIN pg_catalog.pg_namespace n ON n.oid = e.extnamespace
   WHERE e.extname = 'pgcrypto';

  IF extension_schema IS NULL THEN
    RAISE EXCEPTION 'i1q_pgcrypto_dependency_missing'
      USING ERRCODE = '55000';
  END IF;

  EXECUTE pg_catalog.format(
    $function$
      CREATE OR REPLACE FUNCTION i1q.sha256_hex(value text)
      RETURNS text
      LANGUAGE sql
      IMMUTABLE
      STRICT
      PARALLEL SAFE
      SET search_path = pg_catalog
      AS $body$
        SELECT pg_catalog.encode(
          %I.digest(pg_catalog.convert_to($1, 'UTF8'), 'sha256'),
          'hex'
        )
      $body$
    $function$,
    extension_schema
  );
END
$hash_helper$;

CREATE OR REPLACE FUNCTION i1q.canonical_json(document jsonb)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
STRICT
SET search_path = pg_catalog, i1q
AS $function$
DECLARE
  canonical text;
BEGIN
  CASE pg_catalog.jsonb_typeof(document)
    WHEN 'object' THEN
      IF EXISTS (
        SELECT 1
          FROM pg_catalog.jsonb_each(document) entry
         GROUP BY pg_catalog.normalize(entry.key, 'NFC')
        HAVING pg_catalog.count(*) > 1
      ) THEN
        RAISE EXCEPTION 'canonical_json_duplicate_normalized_key'
          USING ERRCODE = '22023';
      END IF;
      SELECT '{' || COALESCE(
               pg_catalog.string_agg(
                 pg_catalog.to_jsonb(pg_catalog.normalize(entry.key, 'NFC'))::text
                 || ':' || i1q.canonical_json(entry.value),
                 ',' ORDER BY pg_catalog.normalize(entry.key, 'NFC')
               ),
               ''
             ) || '}'
        INTO canonical
        FROM pg_catalog.jsonb_each(document) entry;
      RETURN canonical;
    WHEN 'array' THEN
      SELECT '[' || COALESCE(
               pg_catalog.string_agg(
                 i1q.canonical_json(entry.value),
                 ',' ORDER BY entry.ordinality
               ),
               ''
             ) || ']'
        INTO canonical
        FROM pg_catalog.jsonb_array_elements(document) WITH ORDINALITY entry(value, ordinality);
      RETURN canonical;
    WHEN 'string' THEN
      RETURN pg_catalog.to_jsonb(
        pg_catalog.normalize(document #>> '{}', 'NFC')
      )::text;
    ELSE
      RETURN document::text;
  END CASE;
END
$function$;

CREATE TABLE IF NOT EXISTS i1q.schema_versions (
  version text PRIMARY KEY,
  migration_filename text NOT NULL UNIQUE,
  authority text NOT NULL,
  target_project text NOT NULL CHECK (target_project = 'RANKLISTIQ'),
  applied_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp()
);

CREATE TABLE IF NOT EXISTS i1q.actor_role_memberships (
  id text PRIMARY KEY,
  actor_id uuid NOT NULL,
  role_name text NOT NULL CHECK (role_name IN (
    'platform_admin',
    'content_operator',
    'author',
    'editorial_reviewer',
    'physician_reviewer',
    'release_manager',
    'privacy_officer',
    'incident_owner',
    'read_only',
    'system'
  )),
  valid_from timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  valid_until timestamptz,
  revoked_at timestamptz,
  granted_by_actor_id uuid,
  grant_evidence_hash text NOT NULL CHECK (grant_evidence_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  CHECK (valid_until IS NULL OR valid_until > valid_from),
  CHECK (revoked_at IS NULL OR revoked_at >= valid_from)
);

CREATE UNIQUE INDEX IF NOT EXISTS actor_role_memberships_active_role
  ON i1q.actor_role_memberships (actor_id, role_name)
  WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS i1q.reviewers (
  id text PRIMARY KEY,
  actor_id uuid NOT NULL UNIQUE,
  display_name text NOT NULL,
  roles text[] NOT NULL,
  credential_class text CHECK (credential_class IS NULL OR credential_class IN ('md', 'do', 'editorial', 'system')),
  credential_status text NOT NULL DEFAULT 'unverified' CHECK (credential_status IN ('unverified', 'verified', 'expired', 'suspended', 'not_applicable')),
  credential_verification_id text,
  credential_expires_at timestamptz,
  specialties text[] NOT NULL DEFAULT '{}',
  delegated_by_actor_id uuid,
  conflict_actor_ids uuid[] NOT NULL DEFAULT '{}',
  active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  created_by_actor_id uuid,
  UNIQUE (id, actor_id),
  CHECK (roles <@ ARRAY['author', 'editorial_reviewer', 'physician_reviewer', 'system']::text[]),
  CHECK (
    credential_status <> 'verified'
    OR credential_verification_id IS NOT NULL
  )
);

CREATE TABLE IF NOT EXISTS i1q.governance_slots (
  slot text PRIMARY KEY CHECK (slot IN (
    'medical_governance_lead',
    'editorial_lead',
    'taxonomy_owner',
    'misconception_vocabulary_owner',
    'release_manager',
    'incident_owner',
    'privacy_owner',
    'assessment_science_owner'
  )),
  reviewer_id text REFERENCES i1q.reviewers(id),
  assigned_by_actor_id uuid,
  assignment_evidence_hash text CHECK (assignment_evidence_hash IS NULL OR assignment_evidence_hash ~ '^[0-9a-f]{64}$'),
  assigned_at timestamptz,
  CHECK ((reviewer_id IS NULL) = (assigned_at IS NULL))
);

CREATE TABLE IF NOT EXISTS i1q.publication_authorities (
  authority_code text PRIMARY KEY CHECK (authority_code = 'brian_publication_ratifier'),
  actor_id uuid,
  assignment_evidence_hash text CHECK (assignment_evidence_hash IS NULL OR assignment_evidence_hash ~ '^[0-9a-f]{64}$'),
  assigned_at timestamptz,
  CHECK ((actor_id IS NULL) = (assigned_at IS NULL))
);

CREATE TABLE IF NOT EXISTS i1q.taxonomy_versions (
  id text PRIMARY KEY,
  version text NOT NULL UNIQUE,
  status text NOT NULL CHECK (status IN ('draft', 'active', 'superseded')),
  content jsonb NOT NULL,
  content_hash text NOT NULL CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  created_by_actor_id uuid
);

CREATE TABLE IF NOT EXISTS i1q.blueprint_versions (
  id text PRIMARY KEY,
  version text NOT NULL UNIQUE,
  taxonomy_version_id text NOT NULL REFERENCES i1q.taxonomy_versions(id),
  status text NOT NULL CHECK (status IN ('draft', 'active', 'superseded')),
  content jsonb NOT NULL,
  content_hash text NOT NULL CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  created_by_actor_id uuid
);

CREATE TABLE IF NOT EXISTS i1q.misconception_vocabulary_versions (
  id text PRIMARY KEY,
  version text NOT NULL UNIQUE,
  status text NOT NULL CHECK (status IN ('draft', 'active', 'superseded')),
  content_hash text NOT NULL CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  created_by_actor_id uuid
);

CREATE TABLE IF NOT EXISTS i1q.misconception_entries (
  id text NOT NULL,
  vocabulary_version_id text NOT NULL REFERENCES i1q.misconception_vocabulary_versions(id),
  label text NOT NULL,
  definition text NOT NULL,
  redirects_to_id text,
  content_hash text NOT NULL CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  PRIMARY KEY (id, vocabulary_version_id)
);

CREATE TABLE IF NOT EXISTS i1q.channel_security_policies (
  id text PRIMARY KEY,
  channel text NOT NULL,
  policy_version integer NOT NULL CHECK (policy_version > 0),
  field_rules jsonb NOT NULL CHECK (pg_catalog.jsonb_typeof(field_rules) = 'array'),
  content_hash text NOT NULL CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  status text NOT NULL CHECK (status IN ('draft', 'active', 'superseded')),
  created_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  created_by_actor_id uuid,
  UNIQUE (channel, policy_version)
);

CREATE TABLE IF NOT EXISTS i1q.concepts (
  id text PRIMARY KEY,
  taxonomy_version_id text NOT NULL REFERENCES i1q.taxonomy_versions(id),
  blueprint_version_id text REFERENCES i1q.blueprint_versions(id),
  concept_version integer NOT NULL DEFAULT 1 CHECK (concept_version > 0),
  canonical_name text NOT NULL,
  learning_objective text NOT NULL,
  lifecycle text NOT NULL CHECK (lifecycle IN ('draft', 'confirmed', 'active', 'retired')),
  replacement_concept_id text REFERENCES i1q.concepts(id),
  content_hash text NOT NULL CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  created_by_actor_id uuid
);

CREATE TABLE IF NOT EXISTS i1q.variant_groups (
  id text PRIMARY KEY,
  concept_id text NOT NULL REFERENCES i1q.concepts(id),
  variant_group_version integer NOT NULL DEFAULT 1 CHECK (variant_group_version > 0),
  assertion text NOT NULL,
  lifecycle text NOT NULL CHECK (lifecycle IN ('draft', 'active', 'retired')),
  content_hash text NOT NULL CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  created_by_actor_id uuid
);

CREATE TABLE IF NOT EXISTS i1q.items (
  id text PRIMARY KEY,
  variant_group_id text NOT NULL REFERENCES i1q.variant_groups(id),
  item_type text NOT NULL CHECK (item_type = 'single_best_answer'),
  variant_form text NOT NULL CHECK (variant_form IN ('drj_short', 'recall', 'vignette')),
  lifecycle text NOT NULL CHECK (lifecycle IN ('active', 'retired')),
  replacement_item_id text REFERENCES i1q.items(id),
  retirement_reason text,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  created_by_actor_id uuid
);

CREATE TABLE IF NOT EXISTS i1q.rights_records (
  id text PRIMARY KEY,
  source_authority text NOT NULL,
  rights_status text NOT NULL CHECK (rights_status IN ('unverified', 'cleared_for', 'restricted', 'expired')),
  allowed_uses text[] NOT NULL DEFAULT '{}',
  evidence_ref text,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  created_by_actor_id uuid
);

CREATE TABLE IF NOT EXISTS i1q.privacy_redaction_records (
  id text PRIMARY KEY,
  status text NOT NULL CHECK (status IN ('pass', 'pass_with_redactions', 'blocked')),
  required_class_metrics jsonb NOT NULL,
  raw_hash text NOT NULL CHECK (raw_hash ~ '^[0-9a-f]{64}$'),
  working_hash text NOT NULL CHECK (working_hash ~ '^[0-9a-f]{64}$'),
  reviewer_id text REFERENCES i1q.reviewers(id),
  created_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  created_by_actor_id uuid
);

CREATE TABLE IF NOT EXISTS i1q.source_records (
  id text PRIMARY KEY,
  source_type text NOT NULL CHECK (source_type IN ('DRJ_TRANSCRIPT', 'DRJ_NOTES', 'REVIEWER_AUTHORED', 'AI_DRAFT', 'LEGACY_V4', 'PUBLIC_BLUEPRINT')),
  canonical_source_id text NOT NULL,
  title text NOT NULL,
  video_id text,
  start_time_seconds numeric,
  end_time_seconds numeric,
  source_hash text NOT NULL CHECK (source_hash ~ '^[0-9a-f]{64}$'),
  rights_record_id text NOT NULL REFERENCES i1q.rights_records(id),
  privacy_redaction_record_id text REFERENCES i1q.privacy_redaction_records(id),
  derivation_parent_ids text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  created_by_actor_id uuid,
  UNIQUE (source_type, canonical_source_id, source_hash),
  CHECK (end_time_seconds IS NULL OR start_time_seconds IS NULL OR end_time_seconds >= start_time_seconds),
  CHECK (source_type <> 'DRJ_TRANSCRIPT' OR privacy_redaction_record_id IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS i1q.inventory_sources (
  id text PRIMARY KEY,
  canonical_video_id text NOT NULL,
  title text NOT NULL,
  collection_name text,
  duration_seconds numeric,
  recording_date date,
  transcript_available boolean NOT NULL DEFAULT false,
  vtt_available boolean NOT NULL DEFAULT false,
  nodes_available boolean NOT NULL DEFAULT false,
  source_hash text CHECK (source_hash IS NULL OR source_hash ~ '^[0-9a-f]{64}$'),
  rights_status text NOT NULL,
  privacy_status text NOT NULL,
  likely_drj_confidence numeric CHECK (likely_drj_confidence IS NULL OR likely_drj_confidence BETWEEN 0 AND 1),
  drj_verification_status text NOT NULL DEFAULT 'unknown' CHECK (drj_verification_status IN ('unknown', 'likely_drj', 'verified_drj')),
  extraction_suitability text NOT NULL,
  duplicate_of_id text REFERENCES i1q.inventory_sources(id),
  source_authority text NOT NULL,
  currentness text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  UNIQUE (source_authority, canonical_video_id)
);

CREATE TABLE IF NOT EXISTS i1q.transcript_artifacts (
  id text PRIMARY KEY,
  inventory_source_id text NOT NULL REFERENCES i1q.inventory_sources(id),
  format text NOT NULL,
  source_hash text NOT NULL CHECK (source_hash ~ '^[0-9a-f]{64}$'),
  segment_count integer NOT NULL CHECK (segment_count >= 0),
  timestamp_coverage numeric CHECK (timestamp_coverage BETWEEN 0 AND 1),
  speaker_labels_available boolean NOT NULL DEFAULT false,
  rights_record_id text NOT NULL REFERENCES i1q.rights_records(id),
  privacy_redaction_record_id text REFERENCES i1q.privacy_redaction_records(id),
  created_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  UNIQUE (inventory_source_id, source_hash)
);

CREATE TABLE IF NOT EXISTS i1q.restricted_source_references (
  id text PRIMARY KEY,
  source_record_id text REFERENCES i1q.source_records(id),
  transcript_artifact_id text REFERENCES i1q.transcript_artifacts(id),
  raw_artifact_hash text NOT NULL CHECK (raw_artifact_hash ~ '^[0-9a-f]{64}$'),
  private_storage_ref text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  created_by_actor_id uuid,
  CHECK ((source_record_id IS NOT NULL)::integer + (transcript_artifact_id IS NOT NULL)::integer = 1)
);

CREATE UNIQUE INDEX IF NOT EXISTS restricted_source_reference_source
  ON i1q.restricted_source_references (source_record_id)
  WHERE source_record_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS restricted_source_reference_transcript
  ON i1q.restricted_source_references (transcript_artifact_id)
  WHERE transcript_artifact_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS i1q.evidence_claims (
  id text PRIMARY KEY,
  statement text NOT NULL,
  claim_type text NOT NULL CHECK (claim_type IN ('diagnosis', 'management', 'mechanism', 'epidemiology', 'pharmacology', 'other')),
  authority_class text NOT NULL CHECK (authority_class IN ('major_guideline', 'standard_reference', 'landmark_evidence', 'physician_attested')),
  authority_refs jsonb NOT NULL DEFAULT '[]',
  status text NOT NULL CHECK (status IN ('draft', 'verified', 'aging', 'expired', 'conflicted', 'superseded', 'retracted')),
  verified_by_reviewer_id text REFERENCES i1q.reviewers(id),
  evidence_review_date date,
  review_by_date date,
  supersedes_claim_id text REFERENCES i1q.evidence_claims(id),
  content_hash text NOT NULL CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  created_by_actor_id uuid,
  CHECK (status <> 'verified' OR verified_by_reviewer_id IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS i1q.item_revisions (
  id text PRIMARY KEY,
  item_id text NOT NULL REFERENCES i1q.items(id),
  revision_number integer NOT NULL CHECK (revision_number > 0),
  author_actor_id uuid NOT NULL,
  workflow_status text NOT NULL CHECK (workflow_status IN (
    'draft', 'candidate', 'editorial_review', 'medical_review',
    'approved', 'rejected', 'superseded', 'retired'
  )),
  medical_validation_status text NOT NULL CHECK (medical_validation_status = 'AI_DRAFT_NOT_MEDICALLY_VALIDATED'),
  taxonomy_version_id text NOT NULL REFERENCES i1q.taxonomy_versions(id),
  misconception_vocabulary_version_id text NOT NULL REFERENCES i1q.misconception_vocabulary_versions(id),
  concept_id text NOT NULL REFERENCES i1q.concepts(id),
  prompt text NOT NULL,
  choice_a text NOT NULL,
  choice_b text NOT NULL,
  choice_c text NOT NULL,
  choice_d text NOT NULL,
  classification jsonb NOT NULL,
  active_flags text[] NOT NULL DEFAULT '{}',
  open_conflict_id text,
  legacy_import boolean NOT NULL DEFAULT false,
  content_hash text NOT NULL CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  UNIQUE (item_id, revision_number),
  UNIQUE (id, item_id, revision_number, content_hash),
  UNIQUE (id, content_hash)
);

CREATE TABLE IF NOT EXISTS i1q.item_revision_answers (
  item_revision_id text PRIMARY KEY REFERENCES i1q.item_revisions(id),
  answer char(1) NOT NULL CHECK (answer IN ('A', 'B', 'C', 'D')),
  explanation text NOT NULL,
  correct_answer_rationale text NOT NULL,
  distractor_rationales jsonb NOT NULL,
  teaching_point text NOT NULL,
  reference_labels jsonb NOT NULL DEFAULT '[]',
  drj_voice_note text,
  answer_content_hash text NOT NULL CHECK (answer_content_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp()
);

CREATE TABLE IF NOT EXISTS i1q.item_revision_sources (
  item_revision_id text NOT NULL REFERENCES i1q.item_revisions(id),
  source_record_id text NOT NULL REFERENCES i1q.source_records(id),
  source_role text NOT NULL CHECK (source_role IN ('primary', 'supporting', 'drills_remediation')),
  PRIMARY KEY (item_revision_id, source_record_id, source_role)
);

CREATE TABLE IF NOT EXISTS i1q.item_revision_claims (
  item_revision_id text NOT NULL REFERENCES i1q.item_revisions(id),
  evidence_claim_id text NOT NULL REFERENCES i1q.evidence_claims(id),
  claim_role text NOT NULL CHECK (claim_role IN ('primary', 'supporting')),
  PRIMARY KEY (item_revision_id, evidence_claim_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS item_revision_claims_one_primary
  ON i1q.item_revision_claims (item_revision_id)
  WHERE claim_role = 'primary';

CREATE TABLE IF NOT EXISTS i1q.item_revision_concepts (
  item_revision_id text NOT NULL REFERENCES i1q.item_revisions(id),
  concept_id text NOT NULL REFERENCES i1q.concepts(id),
  relationship text NOT NULL CHECK (relationship IN ('secondary', 'prerequisite')),
  PRIMARY KEY (item_revision_id, concept_id, relationship)
);

CREATE TABLE IF NOT EXISTS i1q.item_revision_misconceptions (
  item_revision_id text NOT NULL REFERENCES i1q.item_revisions(id),
  choice_key char(1) NOT NULL CHECK (choice_key IN ('A', 'B', 'C', 'D')),
  misconception_id text NOT NULL,
  vocabulary_version_id text NOT NULL,
  trap_type text NOT NULL,
  provenance text NOT NULL CHECK (provenance IN ('transcript_mentioned', 'vocabulary_derived', 'reviewer_authored', 'ai_generated')),
  PRIMARY KEY (item_revision_id, choice_key),
  FOREIGN KEY (misconception_id, vocabulary_version_id)
    REFERENCES i1q.misconception_entries(id, vocabulary_version_id)
);

CREATE TABLE IF NOT EXISTS i1q.model_prompt_versions (
  id text PRIMARY KEY,
  task text NOT NULL,
  model_identifier text NOT NULL,
  prompt_hash text NOT NULL CHECK (prompt_hash ~ '^[0-9a-f]{64}$'),
  parameters jsonb NOT NULL,
  retired_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  created_by_actor_id uuid
);

CREATE TABLE IF NOT EXISTS i1q.extraction_runs (
  id text PRIMARY KEY,
  source_record_id text NOT NULL REFERENCES i1q.source_records(id),
  model_prompt_version_id text REFERENCES i1q.model_prompt_versions(id),
  redaction_record_id text NOT NULL REFERENCES i1q.privacy_redaction_records(id),
  pipeline_version text NOT NULL,
  gate_type text NOT NULL,
  state text NOT NULL CHECK (state IN ('queued', 'running', 'blocked', 'failed', 'completed')),
  input_hash text NOT NULL CHECK (input_hash ~ '^[0-9a-f]{64}$'),
  output_hash text CHECK (output_hash IS NULL OR output_hash ~ '^[0-9a-f]{64}$'),
  metrics jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  completed_at timestamptz
);

CREATE TABLE IF NOT EXISTS i1q.review_assignments (
  id text PRIMARY KEY,
  item_revision_id text NOT NULL,
  reviewer_id text NOT NULL,
  reviewer_actor_id uuid NOT NULL,
  review_type text NOT NULL CHECK (review_type IN ('editorial', 'medical')),
  required_role text NOT NULL CHECK (required_role IN ('editorial_reviewer', 'physician_reviewer')),
  required_specialty text,
  priority text NOT NULL CHECK (priority IN ('P0', 'P1', 'P2', 'P3')),
  exact_revision_hash text NOT NULL CHECK (exact_revision_hash ~ '^[0-9a-f]{64}$'),
  credential_status text NOT NULL,
  credential_verification_id text,
  state text NOT NULL CHECK (state IN ('open', 'accepted', 'completed', 'expired', 'reassigned')),
  assigned_by_actor_id uuid NOT NULL,
  due_at timestamptz,
  accepted_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  FOREIGN KEY (item_revision_id, exact_revision_hash)
    REFERENCES i1q.item_revisions(id, content_hash),
  FOREIGN KEY (reviewer_id, reviewer_actor_id)
    REFERENCES i1q.reviewers(id, actor_id),
  UNIQUE (id, item_revision_id, reviewer_id, reviewer_actor_id, review_type, required_role, exact_revision_hash)
);

CREATE UNIQUE INDEX IF NOT EXISTS review_assignments_one_active_type
  ON i1q.review_assignments (item_revision_id, review_type)
  WHERE state IN ('open', 'accepted');

CREATE TABLE IF NOT EXISTS i1q.review_events (
  id text PRIMARY KEY,
  item_revision_id text NOT NULL,
  assignment_id text NOT NULL UNIQUE,
  reviewer_id text NOT NULL,
  reviewer_actor_id uuid NOT NULL,
  review_type text NOT NULL CHECK (review_type IN ('editorial', 'medical')),
  reviewer_role text NOT NULL CHECK (reviewer_role IN ('editorial_reviewer', 'physician_reviewer')),
  credential_status text NOT NULL,
  credential_verification_id text,
  verdict text NOT NULL CHECK (verdict IN ('pass', 'needs_revision', 'fail')),
  from_status text NOT NULL,
  to_status text NOT NULL CHECK (to_status IN ('candidate', 'editorial_review', 'medical_review', 'approved', 'rejected')),
  exact_revision_hash text NOT NULL CHECK (exact_revision_hash ~ '^[0-9a-f]{64}$'),
  structured_findings jsonb NOT NULL DEFAULT '{}',
  sequence integer NOT NULL CHECK (sequence > 0),
  occurred_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  FOREIGN KEY (assignment_id, item_revision_id, reviewer_id, reviewer_actor_id, review_type, reviewer_role, exact_revision_hash)
    REFERENCES i1q.review_assignments(id, item_revision_id, reviewer_id, reviewer_actor_id, review_type, required_role, exact_revision_hash),
  UNIQUE (item_revision_id, sequence)
);

CREATE TABLE IF NOT EXISTS i1q.reviewer_calibration_records (
  id text PRIMARY KEY,
  reviewer_id text NOT NULL REFERENCES i1q.reviewers(id),
  calibration_set_id text NOT NULL,
  agreement_rate numeric NOT NULL CHECK (agreement_rate BETWEEN 0 AND 1),
  kappa numeric,
  status text NOT NULL CHECK (status IN ('current', 'expired', 'suspended')),
  calibrated_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  content_hash text NOT NULL CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp()
);

CREATE TABLE IF NOT EXISTS i1q.incident_records (
  id text PRIMARY KEY,
  severity text NOT NULL CHECK (severity IN ('S1', 'S2', 'S3', 'S4')),
  state text NOT NULL CHECK (state IN ('open', 'mitigating', 'corrected', 'closed')),
  affected_item_revision_ids text[] NOT NULL DEFAULT '{}',
  affected_release_ids text[] NOT NULL DEFAULT '{}',
  owner_actor_id uuid,
  summary text NOT NULL,
  timeline jsonb NOT NULL DEFAULT '[]',
  corrective_release_id text,
  opened_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  closed_at timestamptz
);

CREATE TABLE IF NOT EXISTS i1q.release_chain_heads (
  chain_name text PRIMARY KEY CHECK (chain_name = 'primary'),
  last_sequence bigint NOT NULL DEFAULT 0,
  last_release_id text,
  last_manifest_hash text CHECK (last_manifest_hash IS NULL OR last_manifest_hash ~ '^[0-9a-f]{64}$')
);

CREATE TABLE IF NOT EXISTS i1q.release_snapshots (
  id text PRIMARY KEY,
  release_label text NOT NULL UNIQUE,
  dataset_version text NOT NULL UNIQUE,
  sequence bigint NOT NULL UNIQUE CHECK (sequence > 0),
  initial_state text NOT NULL DEFAULT 'assembled' CHECK (initial_state = 'assembled'),
  previous_manifest_hash text CHECK (previous_manifest_hash IS NULL OR previous_manifest_hash ~ '^[0-9a-f]{64}$'),
  manifest_hash text NOT NULL UNIQUE CHECK (manifest_hash ~ '^[0-9a-f]{64}$'),
  manifest jsonb NOT NULL,
  claims_currency_checked_at timestamptz NOT NULL,
  assembled_by_actor_id uuid NOT NULL,
  assembled_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  UNIQUE (id, dataset_version)
);

CREATE TABLE IF NOT EXISTS i1q.export_question_identities (
  question_id text PRIMARY KEY,
  item_id text NOT NULL UNIQUE REFERENCES i1q.items(id),
  supersedes_question_id text REFERENCES i1q.export_question_identities(question_id),
  created_by_actor_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  UNIQUE (question_id, item_id)
);

CREATE TABLE IF NOT EXISTS i1q.release_memberships (
  release_id text NOT NULL,
  position integer NOT NULL CHECK (position > 0),
  item_id text NOT NULL,
  item_revision_id text NOT NULL,
  revision_number integer NOT NULL CHECK (revision_number > 0),
  content_hash text NOT NULL CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  dataset_version text NOT NULL,
  question_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  PRIMARY KEY (release_id, item_revision_id),
  UNIQUE (release_id, position),
  UNIQUE (dataset_version, question_id),
  FOREIGN KEY (release_id, dataset_version)
    REFERENCES i1q.release_snapshots(id, dataset_version),
  FOREIGN KEY (item_revision_id, item_id, revision_number, content_hash)
    REFERENCES i1q.item_revisions(id, item_id, revision_number, content_hash),
  FOREIGN KEY (question_id, item_id)
    REFERENCES i1q.export_question_identities(question_id, item_id)
);

CREATE TABLE IF NOT EXISTS i1q.export_validation_results (
  id text PRIMARY KEY,
  release_id text NOT NULL REFERENCES i1q.release_snapshots(id),
  manifest_hash text NOT NULL CHECK (manifest_hash ~ '^[0-9a-f]{64}$'),
  evidence_hash text NOT NULL CHECK (evidence_hash ~ '^[0-9a-f]{64}$'),
  check_ids text[] NOT NULL,
  artifact_results jsonb NOT NULL CHECK (pg_catalog.jsonb_typeof(artifact_results) = 'array'),
  status text NOT NULL CHECK (status IN ('pass', 'fail', 'blocked')),
  validator_actor_id uuid NOT NULL,
  validated_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  UNIQUE (release_id, evidence_hash)
);

CREATE TABLE IF NOT EXISTS i1q.release_promotion_records (
  id text PRIMARY KEY,
  release_id text NOT NULL REFERENCES i1q.release_snapshots(id),
  from_state text NOT NULL,
  to_state text NOT NULL CHECK (to_state IN ('validated', 'ratified', 'published', 'superseded', 'withdrawn')),
  authority_type text NOT NULL CHECK (authority_type IN ('release_manager_validation', 'medical_governance_attestation', 'brian_publication_ratification', 'incident_withdrawal', 'release_supersession')),
  actor_id uuid NOT NULL,
  manifest_hash text NOT NULL CHECK (manifest_hash ~ '^[0-9a-f]{64}$'),
  evidence_hashes jsonb NOT NULL,
  previous_promotion_hash text CHECK (previous_promotion_hash IS NULL OR previous_promotion_hash ~ '^[0-9a-f]{64}$'),
  promotion_hash text NOT NULL UNIQUE CHECK (promotion_hash ~ '^[0-9a-f]{64}$'),
  sequence integer NOT NULL CHECK (sequence > 0),
  occurred_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  UNIQUE (release_id, sequence)
);

CREATE TABLE IF NOT EXISTS i1q.channel_artifacts (
  id text PRIMARY KEY,
  release_id text NOT NULL REFERENCES i1q.release_snapshots(id),
  channel_security_policy_id text NOT NULL REFERENCES i1q.channel_security_policies(id),
  channel text NOT NULL,
  phase text NOT NULL CHECK (phase IN ('pre_answer', 'post_answer', 'server_only', 'internal', 'contract_only')),
  data_class text NOT NULL CHECK (data_class IN ('A', 'B', 'C', 'D', 'server_only', 'internal', 'contract_only')),
  media_type text NOT NULL,
  record_count integer NOT NULL CHECK (record_count >= 0),
  artifact_hash text NOT NULL CHECK (artifact_hash ~ '^[0-9a-f]{64}$'),
  created_by_actor_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  UNIQUE (release_id, channel)
);

CREATE TABLE IF NOT EXISTS i1q.channel_artifact_payloads (
  artifact_id text PRIMARY KEY REFERENCES i1q.channel_artifacts(id),
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp()
);

CREATE TABLE IF NOT EXISTS i1q.psychometric_snapshots (
  id text PRIMARY KEY,
  item_revision_id text NOT NULL REFERENCES i1q.item_revisions(id),
  release_id text NOT NULL REFERENCES i1q.release_snapshots(id),
  channel text NOT NULL,
  sample_window_start timestamptz NOT NULL,
  sample_window_end timestamptz NOT NULL,
  attempt_count integer NOT NULL CHECK (attempt_count >= 0),
  metrics jsonb NOT NULL,
  privacy_floor_applied boolean NOT NULL DEFAULT true,
  report_only boolean NOT NULL DEFAULT true,
  content_hash text NOT NULL CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  CHECK (sample_window_end > sample_window_start),
  UNIQUE (item_revision_id, release_id, channel, sample_window_start, sample_window_end)
);

CREATE TABLE IF NOT EXISTS i1q.normalized_transcript_segments (
  id text PRIMARY KEY,
  transcript_artifact_id text NOT NULL REFERENCES i1q.transcript_artifacts(id),
  privacy_redaction_record_id text NOT NULL REFERENCES i1q.privacy_redaction_records(id),
  video_id text NOT NULL,
  speaker_class text NOT NULL CHECK (speaker_class IN ('verified_drj', 'likely_drj', 'unknown')),
  speaker_confidence numeric NOT NULL CHECK (speaker_confidence BETWEEN 0 AND 1),
  redacted_text text NOT NULL,
  start_time_seconds numeric NOT NULL,
  end_time_seconds numeric NOT NULL,
  source_hash text NOT NULL CHECK (source_hash ~ '^[0-9a-f]{64}$'),
  working_hash text NOT NULL CHECK (working_hash ~ '^[0-9a-f]{64}$'),
  node_links jsonb NOT NULL DEFAULT '[]',
  privacy_flags text[] NOT NULL DEFAULT '{}',
  rights_flags text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  CHECK (end_time_seconds >= start_time_seconds)
);

CREATE TABLE IF NOT EXISTS i1q.extraction_candidates (
  id text PRIMARY KEY,
  extraction_run_id text NOT NULL REFERENCES i1q.extraction_runs(id),
  source_segment_id text NOT NULL REFERENCES i1q.normalized_transcript_segments(id),
  source_wording text NOT NULL,
  cleaned_wording text NOT NULL,
  question_timestamp_seconds numeric NOT NULL,
  answer_timestamp_seconds numeric,
  detected_answer_wording text,
  answer_source_type text NOT NULL,
  confidence numeric NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  lineage text NOT NULL CHECK (lineage = 'AI_DRAFT_NOT_MEDICALLY_VALIDATED'),
  state text NOT NULL CHECK (state IN ('candidate', 'quarantined', 'rejected', 'promoted_to_item')),
  warnings jsonb NOT NULL DEFAULT '[]',
  candidate_hash text NOT NULL CHECK (candidate_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  UNIQUE (extraction_run_id, source_segment_id, candidate_hash)
);

CREATE TABLE IF NOT EXISTS i1q.candidate_quality_flags (
  id text PRIMARY KEY,
  extraction_candidate_id text NOT NULL REFERENCES i1q.extraction_candidates(id),
  code text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('info', 'warning', 'blocking')),
  detail jsonb NOT NULL DEFAULT '{}',
  resolved_at timestamptz,
  resolved_by_actor_id uuid,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp()
);

CREATE TABLE IF NOT EXISTS i1q.batch_jobs (
  id text PRIMARY KEY,
  job_type text NOT NULL,
  state text NOT NULL CHECK (state IN ('queued', 'running', 'retry_wait', 'blocked', 'dead_letter', 'completed')),
  idempotency_key_hash text NOT NULL UNIQUE CHECK (idempotency_key_hash ~ '^[0-9a-f]{64}$'),
  cursor jsonb,
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  max_attempts integer NOT NULL DEFAULT 5 CHECK (max_attempts > 0),
  next_attempt_at timestamptz,
  error_code text,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp()
);

CREATE TABLE IF NOT EXISTS i1q.job_checkpoints (
  id text PRIMARY KEY,
  batch_job_id text NOT NULL REFERENCES i1q.batch_jobs(id),
  sequence integer NOT NULL CHECK (sequence >= 0),
  cursor jsonb NOT NULL,
  state_hash text NOT NULL CHECK (state_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  UNIQUE (batch_job_id, sequence)
);

CREATE TABLE IF NOT EXISTS i1q.import_maps (
  id text PRIMARY KEY,
  import_type text NOT NULL,
  source_key text NOT NULL,
  target_entity_type text NOT NULL,
  target_entity_id text NOT NULL,
  dataset_version text,
  question_id text,
  source_content_hash text NOT NULL CHECK (source_content_hash ~ '^[0-9a-f]{64}$'),
  historical_join_keys jsonb NOT NULL,
  supersedes_import_map_id text REFERENCES i1q.import_maps(id),
  created_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  UNIQUE (import_type, source_key, source_content_hash),
  CHECK (
    dataset_version IS NULL
    OR (question_id IS NOT NULL AND historical_join_keys ?& ARRAY['dataset_version', 'question_id', 'content_hash'])
  )
);

CREATE TABLE IF NOT EXISTS i1q.feature_flags (
  id text PRIMARY KEY,
  key text NOT NULL UNIQUE,
  enabled boolean NOT NULL DEFAULT false,
  scope jsonb NOT NULL DEFAULT '{}',
  changed_by_actor_id uuid,
  changed_by_authority text NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp()
);

CREATE TABLE IF NOT EXISTS i1q.compensation_records (
  compensation_id text PRIMARY KEY,
  reason text NOT NULL,
  flags_disabled integer NOT NULL CHECK (flags_disabled >= 0),
  actor_id uuid,
  applied_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp()
);

CREATE TABLE IF NOT EXISTS i1q.audit_chain_heads (
  chain_name text PRIMARY KEY CHECK (chain_name = 'primary'),
  last_sequence bigint NOT NULL DEFAULT 0,
  last_hash text CHECK (last_hash IS NULL OR last_hash ~ '^[0-9a-f]{64}$')
);

CREATE TABLE IF NOT EXISTS i1q.audit_events (
  id text PRIMARY KEY,
  sequence bigint NOT NULL UNIQUE CHECK (sequence > 0),
  actor_id uuid,
  actor_label text NOT NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  previous_hash text CHECK (previous_hash IS NULL OR previous_hash ~ '^[0-9a-f]{64}$'),
  event_hash text NOT NULL UNIQUE CHECK (event_hash ~ '^[0-9a-f]{64}$'),
  payload jsonb NOT NULL DEFAULT '{}',
  occurred_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS i1q.api_idempotency_keys (
  id text PRIMARY KEY,
  actor_id uuid NOT NULL,
  request_key_hash text NOT NULL CHECK (request_key_hash ~ '^[0-9a-f]{64}$'),
  request_hash text NOT NULL CHECK (request_hash ~ '^[0-9a-f]{64}$'),
  response_hash text CHECK (response_hash IS NULL OR response_hash ~ '^[0-9a-f]{64}$'),
  state text NOT NULL CHECK (state IN ('started', 'completed', 'failed')),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  UNIQUE (actor_id, request_key_hash)
);

INSERT INTO i1q.schema_versions (version, migration_filename, authority, target_project)
VALUES ('20260715122434', '20260715122434_i1q_1007x_question_platform.sql', 'I1Q-1007X / DR-006 / MR-078A', 'RANKLISTIQ')
ON CONFLICT (version) DO NOTHING;

INSERT INTO i1q.governance_slots (slot)
VALUES
  ('medical_governance_lead'),
  ('editorial_lead'),
  ('taxonomy_owner'),
  ('misconception_vocabulary_owner'),
  ('release_manager'),
  ('incident_owner'),
  ('privacy_owner'),
  ('assessment_science_owner')
ON CONFLICT (slot) DO NOTHING;

INSERT INTO i1q.publication_authorities (authority_code)
VALUES ('brian_publication_ratifier')
ON CONFLICT (authority_code) DO NOTHING;

INSERT INTO i1q.release_chain_heads (chain_name)
VALUES ('primary')
ON CONFLICT (chain_name) DO NOTHING;

INSERT INTO i1q.audit_chain_heads (chain_name)
VALUES ('primary')
ON CONFLICT (chain_name) DO NOTHING;

INSERT INTO i1q.feature_flags (id, key, enabled, changed_by_authority)
VALUES
  ('flag_internal_platform', 'internal_platform_enabled', false, 'migration:I1Q-1007X'),
  ('flag_internal_review', 'internal_review_enabled', false, 'migration:I1Q-1007X'),
  ('flag_student_content', 'student_content_enabled', false, 'migration:I1Q-1007X'),
  ('flag_student_release', 'student_release_enabled', false, 'migration:I1Q-1007X'),
  ('flag_stat_adapter', 'stat_adapter_enabled', false, 'migration:I1Q-1007X'),
  ('flag_drills_adapter', 'drills_adapter_enabled', false, 'migration:I1Q-1007X')
ON CONFLICT (key) DO NOTHING;

CREATE INDEX IF NOT EXISTS item_revisions_item_created
  ON i1q.item_revisions (item_id, created_at DESC);
CREATE INDEX IF NOT EXISTS review_assignments_queue
  ON i1q.review_assignments (state, review_type, priority, due_at);
CREATE INDEX IF NOT EXISTS review_events_revision_sequence
  ON i1q.review_events (item_revision_id, sequence);
CREATE INDEX IF NOT EXISTS evidence_claims_status_review_by
  ON i1q.evidence_claims (status, review_by_date);
CREATE INDEX IF NOT EXISTS release_memberships_revision
  ON i1q.release_memberships (item_revision_id, release_id);
CREATE INDEX IF NOT EXISTS release_memberships_composite_identity
  ON i1q.release_memberships (dataset_version, question_id);
CREATE INDEX IF NOT EXISTS inventory_sources_suitability
  ON i1q.inventory_sources (extraction_suitability, rights_status, privacy_status);
CREATE INDEX IF NOT EXISTS transcript_segments_artifact_time
  ON i1q.normalized_transcript_segments (transcript_artifact_id, start_time_seconds);
CREATE INDEX IF NOT EXISTS extraction_candidates_queue
  ON i1q.extraction_candidates (state, confidence DESC);
CREATE INDEX IF NOT EXISTS batch_jobs_queue
  ON i1q.batch_jobs (state, next_attempt_at, created_at);
CREATE INDEX IF NOT EXISTS audit_events_entity
  ON i1q.audit_events (entity_type, entity_id, sequence);

CREATE OR REPLACE FUNCTION i1q.current_actor_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, auth
AS $function$
  SELECT auth.uid()
$function$;

CREATE OR REPLACE FUNCTION i1q.has_active_role(required_role text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, i1q
AS $function$
  SELECT i1q.current_actor_id() IS NOT NULL
     AND EXISTS (
       SELECT 1
         FROM i1q.actor_role_memberships membership
        WHERE membership.actor_id = i1q.current_actor_id()
          AND membership.role_name = required_role
          AND membership.revoked_at IS NULL
          AND membership.valid_from <= pg_catalog.clock_timestamp()
          AND (membership.valid_until IS NULL OR membership.valid_until > pg_catalog.clock_timestamp())
     )
$function$;

CREATE OR REPLACE FUNCTION i1q.has_any_active_role(required_roles text[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, i1q
AS $function$
  SELECT i1q.current_actor_id() IS NOT NULL
     AND EXISTS (
       SELECT 1
         FROM i1q.actor_role_memberships membership
        WHERE membership.actor_id = i1q.current_actor_id()
          AND membership.role_name = ANY(required_roles)
          AND membership.revoked_at IS NULL
          AND membership.valid_from <= pg_catalog.clock_timestamp()
          AND (membership.valid_until IS NULL OR membership.valid_until > pg_catalog.clock_timestamp())
     )
$function$;

CREATE OR REPLACE FUNCTION i1q.holds_governance_slot(required_slot text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, i1q
AS $function$
  SELECT EXISTS (
    SELECT 1
      FROM i1q.governance_slots slot
      JOIN i1q.reviewers reviewer ON reviewer.id = slot.reviewer_id
     WHERE slot.slot = required_slot
       AND reviewer.actor_id = i1q.current_actor_id()
       AND reviewer.active
       AND slot.assigned_at IS NOT NULL
       AND slot.assignment_evidence_hash IS NOT NULL
  )
$function$;

CREATE OR REPLACE FUNCTION i1q.medical_governance_is_credentialed()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, i1q
AS $function$
  SELECT EXISTS (
    SELECT 1
      FROM i1q.governance_slots slot
      JOIN i1q.reviewers lead ON lead.id = slot.reviewer_id
     WHERE slot.slot = 'medical_governance_lead'
       AND slot.assigned_at IS NOT NULL
       AND slot.assignment_evidence_hash IS NOT NULL
       AND lead.active
       AND 'physician_reviewer' = ANY(lead.roles)
       AND lead.credential_class IN ('md', 'do')
       AND lead.credential_status = 'verified'
       AND lead.credential_verification_id IS NOT NULL
       AND (lead.credential_expires_at IS NULL OR lead.credential_expires_at > pg_catalog.clock_timestamp())
  )
$function$;

CREATE OR REPLACE FUNCTION i1q.revision_workflow_state(target_revision_id text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, i1q
AS $function$
  SELECT CASE
    WHEN revision.workflow_status IN ('superseded', 'retired') THEN revision.workflow_status
    WHEN COALESCE(latest_event.to_status, revision.workflow_status) = 'candidate'
         AND EXISTS (
           SELECT 1
             FROM i1q.review_assignments assignment
            WHERE assignment.item_revision_id = revision.id
              AND assignment.review_type = 'editorial'
              AND assignment.state = 'accepted'
              AND assignment.exact_revision_hash = revision.content_hash
         ) THEN 'editorial_review'
    ELSE COALESCE(latest_event.to_status, revision.workflow_status)
  END
    FROM i1q.item_revisions revision
    LEFT JOIN LATERAL (
      SELECT event.to_status
        FROM i1q.review_events event
       WHERE event.item_revision_id = revision.id
       ORDER BY event.sequence DESC
       LIMIT 1
    ) latest_event ON true
   WHERE revision.id = target_revision_id
$function$;

CREATE OR REPLACE FUNCTION i1q.has_revision_assignment(target_revision_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, i1q
AS $function$
  SELECT EXISTS (
    SELECT 1
      FROM i1q.review_assignments assignment
     WHERE assignment.item_revision_id = target_revision_id
       AND assignment.reviewer_actor_id = i1q.current_actor_id()
       AND assignment.state IN ('open', 'accepted', 'completed')
  )
$function$;

CREATE OR REPLACE FUNCTION i1q.can_read_revision(target_revision_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, i1q
AS $function$
  SELECT EXISTS (
    SELECT 1
      FROM i1q.item_revisions revision
     WHERE revision.id = target_revision_id
       AND (
         (revision.author_actor_id = i1q.current_actor_id() AND i1q.has_active_role('author'))
         OR i1q.has_revision_assignment(revision.id)
         OR i1q.has_any_active_role(ARRAY['content_operator', 'release_manager', 'system']::text[])
         OR (
           i1q.has_active_role('read_only')
           AND i1q.revision_workflow_state(revision.id) = 'approved'
         )
       )
  )
$function$;

CREATE OR REPLACE FUNCTION i1q.can_read_source(target_source_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, i1q
AS $function$
  SELECT i1q.has_any_active_role(ARRAY['privacy_officer', 'system']::text[])
      OR EXISTS (
        SELECT 1
          FROM i1q.item_revision_sources link
         WHERE link.source_record_id = target_source_id
           AND i1q.can_read_revision(link.item_revision_id)
      )
$function$;

CREATE OR REPLACE FUNCTION i1q.can_read_claim(target_claim_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, i1q
AS $function$
  SELECT i1q.has_any_active_role(ARRAY['content_operator', 'release_manager', 'system']::text[])
      OR i1q.holds_governance_slot('medical_governance_lead')
      OR EXISTS (
        SELECT 1
          FROM i1q.item_revision_claims link
         WHERE link.evidence_claim_id = target_claim_id
           AND i1q.can_read_revision(link.item_revision_id)
      )
$function$;

CREATE OR REPLACE FUNCTION i1q.can_read_review_record(target_revision_id text, target_reviewer_actor_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, i1q
AS $function$
  SELECT target_reviewer_actor_id = i1q.current_actor_id()
      OR EXISTS (
        SELECT 1
          FROM i1q.item_revisions revision
         WHERE revision.id = target_revision_id
           AND revision.author_actor_id = i1q.current_actor_id()
      )
      OR i1q.has_any_active_role(ARRAY['release_manager', 'system']::text[])
      OR i1q.holds_governance_slot('editorial_lead')
      OR i1q.holds_governance_slot('medical_governance_lead')
$function$;

CREATE OR REPLACE FUNCTION i1q.reject_immutable_change()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  RAISE EXCEPTION 'immutable_record:%', TG_TABLE_NAME
    USING ERRCODE = '55000';
END
$function$;

CREATE OR REPLACE FUNCTION i1q.enforce_item_revision_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, i1q
AS $function$
DECLARE
  current_status text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'immutable_record:item_revisions'
      USING ERRCODE = '55000';
  END IF;

  IF ROW(
    NEW.id,
    NEW.item_id,
    NEW.revision_number,
    NEW.author_actor_id,
    NEW.created_at
  ) IS DISTINCT FROM ROW(
    OLD.id,
    OLD.item_id,
    OLD.revision_number,
    OLD.author_actor_id,
    OLD.created_at
  ) THEN
    RAISE EXCEPTION 'item_revision_identity_immutable'
      USING ERRCODE = '55000';
  END IF;

  IF OLD.workflow_status = 'draft'
     AND NEW.workflow_status = 'draft'
     AND OLD.author_actor_id = i1q.current_actor_id()
     AND i1q.has_active_role('author') THEN
    RETURN NEW;
  END IF;

  IF OLD.workflow_status = 'draft'
     AND NEW.workflow_status = 'candidate'
     AND OLD.author_actor_id = i1q.current_actor_id()
     AND i1q.has_active_role('author')
     AND (pg_catalog.to_jsonb(NEW) - 'workflow_status') = (pg_catalog.to_jsonb(OLD) - 'workflow_status') THEN
    RETURN NEW;
  END IF;

  current_status := i1q.revision_workflow_state(OLD.id);
  IF NEW.workflow_status IN ('superseded', 'retired')
     AND (pg_catalog.to_jsonb(NEW) - 'workflow_status') = (pg_catalog.to_jsonb(OLD) - 'workflow_status')
     AND i1q.has_any_active_role(ARRAY['release_manager', 'incident_owner', 'system']::text[])
     AND (
       (current_status = 'approved' AND NEW.workflow_status IN ('superseded', 'retired'))
       OR (current_status IN ('draft', 'candidate', 'editorial_review', 'medical_review', 'rejected', 'superseded') AND NEW.workflow_status = 'retired')
     ) THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'item_revision_frozen:%', current_status
    USING ERRCODE = '55000';
END
$function$;

CREATE OR REPLACE FUNCTION i1q.enforce_item_revision_answer_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, i1q
AS $function$
DECLARE
  revision i1q.item_revisions%ROWTYPE;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'immutable_record:item_revision_answers'
      USING ERRCODE = '55000';
  END IF;

  SELECT * INTO revision
    FROM i1q.item_revisions
   WHERE id = OLD.item_revision_id;

  IF NEW.item_revision_id = OLD.item_revision_id
     AND revision.workflow_status = 'draft'
     AND revision.author_actor_id = i1q.current_actor_id()
     AND i1q.has_active_role('author') THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'item_revision_answer_frozen'
    USING ERRCODE = '55000';
END
$function$;

CREATE OR REPLACE FUNCTION i1q.enforce_assignment_transition()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF ROW(
    NEW.id,
    NEW.item_revision_id,
    NEW.reviewer_id,
    NEW.reviewer_actor_id,
    NEW.review_type,
    NEW.required_role,
    NEW.exact_revision_hash,
    NEW.assigned_by_actor_id,
    NEW.created_at
  ) IS DISTINCT FROM ROW(
    OLD.id,
    OLD.item_revision_id,
    OLD.reviewer_id,
    OLD.reviewer_actor_id,
    OLD.review_type,
    OLD.required_role,
    OLD.exact_revision_hash,
    OLD.assigned_by_actor_id,
    OLD.created_at
  ) THEN
    RAISE EXCEPTION 'review_assignment_identity_immutable'
      USING ERRCODE = '55000';
  END IF;

  IF NOT (
    (OLD.state = 'open' AND NEW.state IN ('accepted', 'expired', 'reassigned'))
    OR (OLD.state = 'accepted' AND NEW.state IN ('completed', 'expired', 'reassigned'))
  ) THEN
    RAISE EXCEPTION 'review_assignment_transition_invalid:%:%', OLD.state, NEW.state
      USING ERRCODE = '55000';
  END IF;

  RETURN NEW;
END
$function$;

CREATE OR REPLACE FUNCTION i1q.prepare_audit_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, i1q
AS $function$
DECLARE
  prior_sequence bigint;
  prior_hash text;
  event_preimage jsonb;
BEGIN
  SELECT head.last_sequence, head.last_hash
    INTO prior_sequence, prior_hash
    FROM i1q.audit_chain_heads head
   WHERE head.chain_name = 'primary'
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'audit_chain_head_missing'
      USING ERRCODE = '55000';
  END IF;

  NEW.sequence := prior_sequence + 1;
  NEW.id := 'audit_' || pg_catalog.lpad(NEW.sequence::text, 20, '0');
  NEW.actor_id := i1q.current_actor_id();
  NEW.actor_label := COALESCE(NEW.actor_id::text, 'database:' || SESSION_USER);
  NEW.previous_hash := prior_hash;
  NEW.occurred_at := pg_catalog.clock_timestamp();
  NEW.payload := COALESCE(NEW.payload, '{}'::jsonb);

  event_preimage := pg_catalog.jsonb_build_object(
    'sequence', NEW.sequence,
    'actor_id', NEW.actor_id,
    'actor_label', NEW.actor_label,
    'action', NEW.action,
    'entity_type', NEW.entity_type,
    'entity_id', NEW.entity_id,
    'previous_hash', NEW.previous_hash,
    'payload', NEW.payload,
    'occurred_at', NEW.occurred_at
  );
  NEW.event_hash := i1q.sha256_hex(COALESCE(prior_hash, 'ROOT') || '|' || event_preimage::text);

  UPDATE i1q.audit_chain_heads
     SET last_sequence = NEW.sequence,
         last_hash = NEW.event_hash
   WHERE chain_name = 'primary';

  RETURN NEW;
END
$function$;

DO $triggers$
DECLARE
  immutable_table text;
  immutable_tables text[] := ARRAY[
    'schema_versions',
    'item_revision_sources',
    'item_revision_claims',
    'item_revision_concepts',
    'item_revision_misconceptions',
    'review_events',
    'reviewer_calibration_records',
    'source_records',
    'privacy_redaction_records',
    'extraction_runs',
    'restricted_source_references',
    'release_snapshots',
    'export_question_identities',
    'release_memberships',
    'export_validation_results',
    'release_promotion_records',
    'channel_artifacts',
    'channel_artifact_payloads',
    'psychometric_snapshots',
    'compensation_records',
    'audit_events'
  ];
BEGIN
  FOREACH immutable_table IN ARRAY immutable_tables LOOP
    IF NOT EXISTS (
      SELECT 1
        FROM pg_catalog.pg_trigger trigger_record
        JOIN pg_catalog.pg_class table_record ON table_record.oid = trigger_record.tgrelid
        JOIN pg_catalog.pg_namespace namespace_record ON namespace_record.oid = table_record.relnamespace
       WHERE namespace_record.nspname = 'i1q'
         AND table_record.relname = immutable_table
         AND trigger_record.tgname = immutable_table || '_immutable'
         AND NOT trigger_record.tgisinternal
    ) THEN
      EXECUTE pg_catalog.format(
        'CREATE TRIGGER %I BEFORE UPDATE OR DELETE ON i1q.%I FOR EACH ROW EXECUTE FUNCTION i1q.reject_immutable_change()',
        immutable_table || '_immutable',
        immutable_table
      );
    END IF;
  END LOOP;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_trigger
     WHERE tgrelid = 'i1q.item_revisions'::regclass
       AND tgname = 'item_revisions_guarded_mutation'
       AND NOT tgisinternal
  ) THEN
    CREATE TRIGGER item_revisions_guarded_mutation
      BEFORE UPDATE OR DELETE ON i1q.item_revisions
      FOR EACH ROW EXECUTE FUNCTION i1q.enforce_item_revision_mutation();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_trigger
     WHERE tgrelid = 'i1q.item_revision_answers'::regclass
       AND tgname = 'item_revision_answers_guarded_mutation'
       AND NOT tgisinternal
  ) THEN
    CREATE TRIGGER item_revision_answers_guarded_mutation
      BEFORE UPDATE OR DELETE ON i1q.item_revision_answers
      FOR EACH ROW EXECUTE FUNCTION i1q.enforce_item_revision_answer_mutation();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_trigger
     WHERE tgrelid = 'i1q.review_assignments'::regclass
       AND tgname = 'review_assignments_transition'
       AND NOT tgisinternal
  ) THEN
    CREATE TRIGGER review_assignments_transition
      BEFORE UPDATE ON i1q.review_assignments
      FOR EACH ROW EXECUTE FUNCTION i1q.enforce_assignment_transition();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_trigger
     WHERE tgrelid = 'i1q.review_assignments'::regclass
       AND tgname = 'review_assignments_no_delete'
       AND NOT tgisinternal
  ) THEN
    CREATE TRIGGER review_assignments_no_delete
      BEFORE DELETE ON i1q.review_assignments
      FOR EACH ROW EXECUTE FUNCTION i1q.reject_immutable_change();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_trigger
     WHERE tgrelid = 'i1q.audit_events'::regclass
       AND tgname = 'audit_events_prepare'
       AND NOT tgisinternal
  ) THEN
    CREATE TRIGGER audit_events_prepare
      BEFORE INSERT ON i1q.audit_events
      FOR EACH ROW EXECUTE FUNCTION i1q.prepare_audit_event();
  END IF;
END
$triggers$;

CREATE OR REPLACE FUNCTION i1q.append_audit_event(
  event_action text,
  target_entity_type text,
  target_entity_id text,
  event_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS i1q.audit_events
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, i1q
AS $function$
DECLARE
  appended i1q.audit_events;
BEGIN
  IF event_action IS NULL OR pg_catalog.btrim(event_action) = ''
     OR target_entity_type IS NULL OR pg_catalog.btrim(target_entity_type) = ''
     OR target_entity_id IS NULL OR pg_catalog.btrim(target_entity_id) = '' THEN
    RAISE EXCEPTION 'audit_event_fields_required'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO i1q.audit_events (action, entity_type, entity_id, payload)
  VALUES (event_action, target_entity_type, target_entity_id, COALESCE(event_payload, '{}'::jsonb))
  RETURNING * INTO appended;

  RETURN appended;
END
$function$;

CREATE OR REPLACE FUNCTION i1q.edit_item_revision_draft(
  target_revision_id text,
  draft_patch jsonb,
  target_content_hash text,
  answer_patch jsonb DEFAULT '{}'::jsonb,
  target_answer_content_hash text DEFAULT NULL
)
RETURNS i1q.item_revisions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, i1q
AS $function$
DECLARE
  revision i1q.item_revisions%ROWTYPE;
  updated_revision i1q.item_revisions;
BEGIN
  SELECT * INTO revision
    FROM i1q.item_revisions
   WHERE id = target_revision_id
   FOR UPDATE;

  IF revision.id IS NULL
     OR revision.workflow_status <> 'draft'
     OR revision.author_actor_id <> i1q.current_actor_id()
     OR NOT i1q.has_active_role('author') THEN
    RAISE EXCEPTION 'draft_revision_edit_denied'
      USING ERRCODE = '42501';
  END IF;
  IF pg_catalog.jsonb_typeof(draft_patch) <> 'object'
     OR pg_catalog.jsonb_typeof(answer_patch) <> 'object'
     OR target_content_hash !~ '^[0-9a-f]{64}$'
     OR EXISTS (
       SELECT 1 FROM pg_catalog.jsonb_object_keys(draft_patch) key
        WHERE key <> ALL(ARRAY[
          'prompt', 'choice_a', 'choice_b', 'choice_c', 'choice_d',
          'classification', 'active_flags', 'open_conflict_id'
        ]::text[])
     )
     OR EXISTS (
       SELECT 1 FROM pg_catalog.jsonb_object_keys(answer_patch) key
        WHERE key <> ALL(ARRAY[
          'answer', 'explanation', 'correct_answer_rationale', 'distractor_rationales',
          'teaching_point', 'reference_labels', 'drj_voice_note'
        ]::text[])
     ) THEN
    RAISE EXCEPTION 'draft_revision_patch_invalid'
      USING ERRCODE = '22023';
  END IF;
  IF answer_patch <> '{}'::jsonb
     AND (target_answer_content_hash IS NULL OR target_answer_content_hash !~ '^[0-9a-f]{64}$') THEN
    RAISE EXCEPTION 'draft_answer_hash_required'
      USING ERRCODE = '22023';
  END IF;

  UPDATE i1q.item_revisions
     SET prompt = CASE WHEN draft_patch ? 'prompt' THEN draft_patch ->> 'prompt' ELSE prompt END,
         choice_a = CASE WHEN draft_patch ? 'choice_a' THEN draft_patch ->> 'choice_a' ELSE choice_a END,
         choice_b = CASE WHEN draft_patch ? 'choice_b' THEN draft_patch ->> 'choice_b' ELSE choice_b END,
         choice_c = CASE WHEN draft_patch ? 'choice_c' THEN draft_patch ->> 'choice_c' ELSE choice_c END,
         choice_d = CASE WHEN draft_patch ? 'choice_d' THEN draft_patch ->> 'choice_d' ELSE choice_d END,
         classification = CASE WHEN draft_patch ? 'classification' THEN draft_patch -> 'classification' ELSE classification END,
         active_flags = CASE
           WHEN draft_patch ? 'active_flags'
           THEN ARRAY(SELECT pg_catalog.jsonb_array_elements_text(draft_patch -> 'active_flags'))
           ELSE active_flags
         END,
         open_conflict_id = CASE
           WHEN draft_patch ? 'open_conflict_id' THEN NULLIF(draft_patch ->> 'open_conflict_id', '')
           ELSE open_conflict_id
         END,
         content_hash = target_content_hash
   WHERE id = revision.id
  RETURNING * INTO updated_revision;

  IF answer_patch <> '{}'::jsonb THEN
    UPDATE i1q.item_revision_answers
       SET answer = CASE WHEN answer_patch ? 'answer' THEN (answer_patch ->> 'answer')::char(1) ELSE answer END,
           explanation = CASE WHEN answer_patch ? 'explanation' THEN answer_patch ->> 'explanation' ELSE explanation END,
           correct_answer_rationale = CASE WHEN answer_patch ? 'correct_answer_rationale' THEN answer_patch ->> 'correct_answer_rationale' ELSE correct_answer_rationale END,
           distractor_rationales = CASE WHEN answer_patch ? 'distractor_rationales' THEN answer_patch -> 'distractor_rationales' ELSE distractor_rationales END,
           teaching_point = CASE WHEN answer_patch ? 'teaching_point' THEN answer_patch ->> 'teaching_point' ELSE teaching_point END,
           reference_labels = CASE WHEN answer_patch ? 'reference_labels' THEN answer_patch -> 'reference_labels' ELSE reference_labels END,
           drj_voice_note = CASE WHEN answer_patch ? 'drj_voice_note' THEN NULLIF(answer_patch ->> 'drj_voice_note', '') ELSE drj_voice_note END,
           answer_content_hash = target_answer_content_hash
     WHERE item_revision_id = revision.id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'draft_answer_record_missing'
        USING ERRCODE = '55000';
    END IF;
  END IF;

  PERFORM i1q.append_audit_event(
    'item_revision_draft_edited',
    'item_revision',
    revision.id,
    pg_catalog.jsonb_build_object(
      'previous_content_hash', revision.content_hash,
      'content_hash', updated_revision.content_hash,
      'answer_changed', answer_patch <> '{}'::jsonb
    )
  );
  RETURN updated_revision;
END
$function$;

CREATE OR REPLACE FUNCTION i1q.submit_item_revision_candidate(target_revision_id text)
RETURNS i1q.item_revisions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, i1q
AS $function$
DECLARE
  revision i1q.item_revisions%ROWTYPE;
BEGIN
  SELECT * INTO revision
    FROM i1q.item_revisions
   WHERE id = target_revision_id
   FOR UPDATE;

  IF revision.id IS NULL
     OR revision.workflow_status <> 'draft'
     OR revision.author_actor_id <> i1q.current_actor_id()
     OR NOT i1q.has_active_role('author') THEN
    RAISE EXCEPTION 'revision_submission_denied'
      USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM i1q.item_revision_answers answer WHERE answer.item_revision_id = revision.id)
     OR NOT EXISTS (SELECT 1 FROM i1q.item_revision_sources source WHERE source.item_revision_id = revision.id)
     OR NOT EXISTS (SELECT 1 FROM i1q.item_revision_claims claim WHERE claim.item_revision_id = revision.id) THEN
    RAISE EXCEPTION 'revision_submission_incomplete'
      USING ERRCODE = '55000';
  END IF;

  UPDATE i1q.item_revisions
     SET workflow_status = 'candidate'
   WHERE id = revision.id
  RETURNING * INTO revision;

  PERFORM i1q.append_audit_event(
    'item_revision_submitted_candidate',
    'item_revision',
    revision.id,
    pg_catalog.jsonb_build_object('content_hash', revision.content_hash)
  );
  RETURN revision;
END
$function$;

CREATE OR REPLACE FUNCTION i1q.set_item_revision_terminal_state(
  target_revision_id text,
  target_state text,
  reason_code text
)
RETURNS i1q.item_revisions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, i1q
AS $function$
DECLARE
  revision i1q.item_revisions%ROWTYPE;
  prior_state text;
BEGIN
  SELECT * INTO revision
    FROM i1q.item_revisions
   WHERE id = target_revision_id
   FOR UPDATE;
  prior_state := i1q.revision_workflow_state(target_revision_id);

  IF revision.id IS NULL
     OR target_state NOT IN ('superseded', 'retired')
     OR reason_code IS NULL
     OR pg_catalog.btrim(reason_code) = ''
     OR NOT i1q.has_any_active_role(ARRAY['release_manager', 'incident_owner', 'system']::text[]) THEN
    RAISE EXCEPTION 'revision_terminal_transition_denied'
      USING ERRCODE = '42501';
  END IF;

  UPDATE i1q.item_revisions
     SET workflow_status = target_state
   WHERE id = revision.id
  RETURNING * INTO revision;

  PERFORM i1q.append_audit_event(
    'item_revision_' || target_state,
    'item_revision',
    revision.id,
    pg_catalog.jsonb_build_object(
      'from_status', prior_state,
      'to_status', target_state,
      'reason_code', reason_code,
      'content_hash', revision.content_hash
    )
  );
  RETURN revision;
END
$function$;

CREATE OR REPLACE FUNCTION i1q.read_item_revision_answers(
  target_revision_id text,
  access_purpose text
)
RETURNS TABLE (
  item_revision_id text,
  answer char(1),
  explanation text,
  correct_answer_rationale text,
  distractor_rationales jsonb,
  teaching_point text,
  reference_labels jsonb,
  drj_voice_note text,
  answer_content_hash text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, i1q
AS $function$
DECLARE
  revision i1q.item_revisions%ROWTYPE;
  allowed boolean := false;
BEGIN
  IF i1q.current_actor_id() IS NULL THEN
    RAISE EXCEPTION 'answer_access_denied'
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO revision
    FROM i1q.item_revisions
   WHERE id = target_revision_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'answer_access_denied'
      USING ERRCODE = '42501';
  END IF;

  allowed := (
    access_purpose = 'authoring'
    AND revision.author_actor_id = i1q.current_actor_id()
    AND i1q.has_active_role('author')
  ) OR EXISTS (
    SELECT 1
      FROM i1q.review_assignments assignment
      JOIN i1q.reviewers reviewer
        ON reviewer.id = assignment.reviewer_id
       AND reviewer.actor_id = assignment.reviewer_actor_id
       AND reviewer.active
     WHERE assignment.item_revision_id = revision.id
       AND assignment.exact_revision_hash = revision.content_hash
       AND assignment.reviewer_actor_id = i1q.current_actor_id()
       AND assignment.state = 'accepted'
       AND i1q.has_active_role(assignment.required_role)
       AND (
         (assignment.review_type = 'editorial' AND access_purpose = 'editorial_review')
         OR (
           assignment.review_type = 'medical'
           AND access_purpose = 'medical_review'
           AND reviewer.credential_class IN ('md', 'do')
           AND reviewer.credential_status = 'verified'
           AND reviewer.credential_verification_id = assignment.credential_verification_id
           AND (reviewer.credential_expires_at IS NULL OR reviewer.credential_expires_at > pg_catalog.clock_timestamp())
         )
       )
  ) OR (
    access_purpose = 'release_validation'
    AND i1q.has_active_role('release_manager')
    AND i1q.revision_workflow_state(revision.id) = 'approved'
  ) OR (
    access_purpose = 'system_validation'
    AND i1q.has_active_role('system')
  );

  IF NOT allowed THEN
    RAISE EXCEPTION 'answer_access_denied'
      USING ERRCODE = '42501';
  END IF;

  PERFORM i1q.append_audit_event(
    'answer_accessed',
    'item_revision',
    revision.id,
    pg_catalog.jsonb_build_object('purpose', access_purpose, 'content_hash', revision.content_hash)
  );

  RETURN QUERY
  SELECT answer_row.item_revision_id,
         answer_row.answer,
         answer_row.explanation,
         answer_row.correct_answer_rationale,
         answer_row.distractor_rationales,
         answer_row.teaching_point,
         answer_row.reference_labels,
         answer_row.drj_voice_note,
         answer_row.answer_content_hash
    FROM i1q.item_revision_answers answer_row
   WHERE answer_row.item_revision_id = revision.id;
END
$function$;

CREATE OR REPLACE FUNCTION i1q.read_restricted_source_reference(
  target_reference_id text,
  access_purpose text
)
RETURNS TABLE (
  id text,
  source_record_id text,
  transcript_artifact_id text,
  raw_artifact_hash text,
  private_storage_ref text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, i1q
AS $function$
BEGIN
  IF NOT i1q.has_any_active_role(ARRAY['privacy_officer', 'system']::text[])
     OR access_purpose NOT IN ('privacy_review', 'redaction', 'incident_response') THEN
    RAISE EXCEPTION 'restricted_source_access_denied'
      USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM i1q.restricted_source_references reference WHERE reference.id = target_reference_id) THEN
    RAISE EXCEPTION 'restricted_source_access_denied'
      USING ERRCODE = '42501';
  END IF;

  PERFORM i1q.append_audit_event(
    'restricted_source_accessed',
    'restricted_source_reference',
    target_reference_id,
    pg_catalog.jsonb_build_object('purpose', access_purpose)
  );

  RETURN QUERY
  SELECT reference.id,
         reference.source_record_id,
         reference.transcript_artifact_id,
         reference.raw_artifact_hash,
         reference.private_storage_ref
    FROM i1q.restricted_source_references reference
   WHERE reference.id = target_reference_id;
END
$function$;

CREATE OR REPLACE FUNCTION i1q.create_review_assignment(
  assignment_id text,
  target_revision_id text,
  target_reviewer_id text,
  target_review_type text,
  target_priority text,
  target_due_at timestamptz DEFAULT NULL,
  target_required_specialty text DEFAULT NULL
)
RETURNS i1q.review_assignments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, i1q
AS $function$
DECLARE
  revision i1q.item_revisions%ROWTYPE;
  reviewer i1q.reviewers%ROWTYPE;
  required_role text;
  required_slot text;
  created_assignment i1q.review_assignments;
BEGIN
  required_role := CASE target_review_type
    WHEN 'editorial' THEN 'editorial_reviewer'
    WHEN 'medical' THEN 'physician_reviewer'
    ELSE NULL
  END;
  required_slot := CASE target_review_type
    WHEN 'editorial' THEN 'editorial_lead'
    WHEN 'medical' THEN 'medical_governance_lead'
    ELSE NULL
  END;

  IF required_role IS NULL OR NOT i1q.holds_governance_slot(required_slot) THEN
    RAISE EXCEPTION 'review_assignment_authority_denied'
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO revision FROM i1q.item_revisions WHERE id = target_revision_id;
  SELECT * INTO reviewer FROM i1q.reviewers WHERE id = target_reviewer_id AND active;

  IF revision.id IS NULL OR reviewer.id IS NULL THEN
    RAISE EXCEPTION 'review_assignment_target_invalid'
      USING ERRCODE = '22023';
  END IF;
  IF target_review_type = 'editorial'
     AND i1q.revision_workflow_state(revision.id) NOT IN ('candidate', 'editorial_review') THEN
    RAISE EXCEPTION 'editorial_assignment_state_invalid'
      USING ERRCODE = '55000';
  END IF;
  IF target_review_type = 'medical'
     AND i1q.revision_workflow_state(revision.id) <> 'medical_review' THEN
    RAISE EXCEPTION 'medical_assignment_state_invalid'
      USING ERRCODE = '55000';
  END IF;
  IF revision.author_actor_id = reviewer.actor_id
     OR reviewer.delegated_by_actor_id = revision.author_actor_id
     OR revision.author_actor_id = ANY(reviewer.conflict_actor_ids) THEN
    RAISE EXCEPTION 'self_review_forbidden'
      USING ERRCODE = '42501';
  END IF;
  IF NOT required_role = ANY(reviewer.roles) THEN
    RAISE EXCEPTION 'reviewer_role_mismatch'
      USING ERRCODE = '42501';
  END IF;
  IF target_required_specialty IS NOT NULL
     AND NOT (target_required_specialty = ANY(reviewer.specialties)) THEN
    RAISE EXCEPTION 'reviewer_specialty_mismatch'
      USING ERRCODE = '42501';
  END IF;
  IF target_review_type = 'medical' AND NOT (
    reviewer.credential_class IN ('md', 'do')
    AND reviewer.credential_status = 'verified'
    AND reviewer.credential_verification_id IS NOT NULL
    AND (reviewer.credential_expires_at IS NULL OR reviewer.credential_expires_at > pg_catalog.clock_timestamp())
  ) THEN
    RAISE EXCEPTION 'physician_credential_not_verified'
      USING ERRCODE = '42501';
  END IF;
  INSERT INTO i1q.review_assignments (
    id,
    item_revision_id,
    reviewer_id,
    reviewer_actor_id,
    review_type,
    required_role,
    required_specialty,
    priority,
    exact_revision_hash,
    credential_status,
    credential_verification_id,
    state,
    assigned_by_actor_id,
    due_at
  ) VALUES (
    assignment_id,
    revision.id,
    reviewer.id,
    reviewer.actor_id,
    target_review_type,
    required_role,
    target_required_specialty,
    target_priority,
    revision.content_hash,
    reviewer.credential_status,
    reviewer.credential_verification_id,
    'open',
    i1q.current_actor_id(),
    target_due_at
  ) RETURNING * INTO created_assignment;

  PERFORM i1q.append_audit_event(
    'review_assignment_created',
    'review_assignment',
    created_assignment.id,
    pg_catalog.jsonb_build_object(
      'item_revision_id', revision.id,
      'exact_revision_hash', revision.content_hash,
      'review_type', target_review_type
    )
  );

  RETURN created_assignment;
END
$function$;

CREATE OR REPLACE FUNCTION i1q.accept_review_assignment(target_assignment_id text)
RETURNS i1q.review_assignments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, i1q
AS $function$
DECLARE
  assignment i1q.review_assignments%ROWTYPE;
  reviewer i1q.reviewers%ROWTYPE;
BEGIN
  SELECT * INTO assignment
    FROM i1q.review_assignments
   WHERE id = target_assignment_id
   FOR UPDATE;
  SELECT * INTO reviewer
    FROM i1q.reviewers
   WHERE id = assignment.reviewer_id
     AND actor_id = assignment.reviewer_actor_id
     AND active;

  IF assignment.id IS NULL
     OR reviewer.id IS NULL
     OR assignment.reviewer_actor_id <> i1q.current_actor_id()
     OR assignment.state <> 'open'
     OR NOT i1q.has_active_role(assignment.required_role)
     OR (
       assignment.review_type = 'medical'
       AND NOT (
         reviewer.credential_class IN ('md', 'do')
         AND reviewer.credential_status = 'verified'
         AND reviewer.credential_verification_id = assignment.credential_verification_id
         AND (reviewer.credential_expires_at IS NULL OR reviewer.credential_expires_at > pg_catalog.clock_timestamp())
       )
     ) THEN
    RAISE EXCEPTION 'review_assignment_accept_denied'
      USING ERRCODE = '42501';
  END IF;
  IF (assignment.review_type = 'editorial' AND i1q.revision_workflow_state(assignment.item_revision_id) NOT IN ('candidate', 'editorial_review'))
     OR (assignment.review_type = 'medical' AND i1q.revision_workflow_state(assignment.item_revision_id) <> 'medical_review') THEN
    RAISE EXCEPTION 'review_assignment_state_stale'
      USING ERRCODE = '55000';
  END IF;

  UPDATE i1q.review_assignments
     SET state = 'accepted',
         accepted_at = pg_catalog.clock_timestamp()
   WHERE id = assignment.id
  RETURNING * INTO assignment;

  PERFORM i1q.append_audit_event('review_assignment_accepted', 'review_assignment', assignment.id, '{}'::jsonb);
  RETURN assignment;
END
$function$;

CREATE OR REPLACE FUNCTION i1q.record_review_event(
  review_event_id text,
  target_assignment_id text,
  target_verdict text,
  findings jsonb DEFAULT '{}'::jsonb
)
RETURNS i1q.review_events
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, i1q
AS $function$
DECLARE
  assignment i1q.review_assignments%ROWTYPE;
  revision i1q.item_revisions%ROWTYPE;
  reviewer i1q.reviewers%ROWTYPE;
  current_status text;
  next_status text;
  next_sequence integer;
  created_event i1q.review_events;
BEGIN
  SELECT * INTO assignment
    FROM i1q.review_assignments
   WHERE id = target_assignment_id
   FOR UPDATE;
  SELECT * INTO revision FROM i1q.item_revisions WHERE id = assignment.item_revision_id;
  SELECT * INTO reviewer FROM i1q.reviewers WHERE id = assignment.reviewer_id AND active;

  IF assignment.id IS NULL
     OR assignment.state <> 'accepted'
     OR assignment.reviewer_actor_id <> i1q.current_actor_id()
     OR reviewer.actor_id <> i1q.current_actor_id()
     OR assignment.exact_revision_hash <> revision.content_hash
     OR NOT i1q.has_active_role(assignment.required_role) THEN
    RAISE EXCEPTION 'review_event_assignment_denied'
      USING ERRCODE = '42501';
  END IF;
  IF revision.author_actor_id = reviewer.actor_id
     OR reviewer.delegated_by_actor_id = revision.author_actor_id
     OR revision.author_actor_id = ANY(reviewer.conflict_actor_ids) THEN
    RAISE EXCEPTION 'self_review_forbidden'
      USING ERRCODE = '42501';
  END IF;
  IF target_verdict NOT IN ('pass', 'needs_revision', 'fail') THEN
    RAISE EXCEPTION 'review_verdict_invalid'
      USING ERRCODE = '22023';
  END IF;

  current_status := i1q.revision_workflow_state(revision.id);
  IF assignment.review_type = 'editorial' THEN
    IF current_status <> 'editorial_review' THEN
      RAISE EXCEPTION 'editorial_review_state_invalid'
        USING ERRCODE = '55000';
    END IF;
    next_status := CASE target_verdict
      WHEN 'pass' THEN 'medical_review'
      WHEN 'needs_revision' THEN 'candidate'
      ELSE 'rejected'
    END;
  ELSE
    IF current_status <> 'medical_review' THEN
      RAISE EXCEPTION 'medical_review_requires_editorial_pass'
        USING ERRCODE = '55000';
    END IF;
    IF NOT (
      reviewer.credential_class IN ('md', 'do')
      AND reviewer.credential_status = 'verified'
      AND reviewer.credential_verification_id = assignment.credential_verification_id
      AND assignment.credential_status = 'verified'
      AND (reviewer.credential_expires_at IS NULL OR reviewer.credential_expires_at > pg_catalog.clock_timestamp())
    ) THEN
      RAISE EXCEPTION 'physician_credential_not_verified'
        USING ERRCODE = '42501';
    END IF;
    IF NOT EXISTS (
      SELECT 1
        FROM i1q.reviewer_calibration_records calibration
       WHERE calibration.reviewer_id = reviewer.id
         AND calibration.status = 'current'
         AND calibration.expires_at > pg_catalog.clock_timestamp()
    ) THEN
      RAISE EXCEPTION 'reviewer_calibration_not_current'
        USING ERRCODE = '42501';
    END IF;
    IF target_verdict = 'pass' AND NOT i1q.medical_governance_is_credentialed() THEN
      RAISE EXCEPTION 'medical_governance_lead_unassigned'
        USING ERRCODE = '42501';
    END IF;
    IF target_verdict = 'pass' AND EXISTS (
      SELECT 1
        FROM i1q.item_revisions sibling
       WHERE sibling.item_id = revision.item_id
         AND sibling.id <> revision.id
         AND i1q.revision_workflow_state(sibling.id) = 'approved'
    ) THEN
      RAISE EXCEPTION 'item_already_has_approved_revision'
        USING ERRCODE = '55000';
    END IF;
    next_status := CASE target_verdict
      WHEN 'pass' THEN 'approved'
      WHEN 'needs_revision' THEN 'editorial_review'
      ELSE 'rejected'
    END;
  END IF;

  SELECT COALESCE(pg_catalog.max(event.sequence), 0) + 1
    INTO next_sequence
    FROM i1q.review_events event
   WHERE event.item_revision_id = revision.id;

  INSERT INTO i1q.review_events (
    id,
    item_revision_id,
    assignment_id,
    reviewer_id,
    reviewer_actor_id,
    review_type,
    reviewer_role,
    credential_status,
    credential_verification_id,
    verdict,
    from_status,
    to_status,
    exact_revision_hash,
    structured_findings,
    sequence
  ) VALUES (
    review_event_id,
    revision.id,
    assignment.id,
    reviewer.id,
    reviewer.actor_id,
    assignment.review_type,
    assignment.required_role,
    reviewer.credential_status,
    reviewer.credential_verification_id,
    target_verdict,
    current_status,
    next_status,
    revision.content_hash,
    COALESCE(findings, '{}'::jsonb),
    next_sequence
  ) RETURNING * INTO created_event;

  UPDATE i1q.review_assignments
     SET state = 'completed',
         completed_at = pg_catalog.clock_timestamp()
   WHERE id = assignment.id;

  PERFORM i1q.append_audit_event(
    'review_event_recorded',
    'review_event',
    created_event.id,
    pg_catalog.jsonb_build_object(
      'assignment_id', assignment.id,
      'item_revision_id', revision.id,
      'exact_revision_hash', revision.content_hash,
      'from_status', current_status,
      'to_status', next_status,
      'verdict', target_verdict
    )
  );

  RETURN created_event;
END
$function$;

CREATE OR REPLACE FUNCTION i1q.register_export_question_identity(
  stable_question_id text,
  target_item_id text,
  superseded_question_id text DEFAULT NULL
)
RETURNS i1q.export_question_identities
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, i1q
AS $function$
DECLARE
  created_identity i1q.export_question_identities;
BEGIN
  IF NOT i1q.has_active_role('release_manager')
     OR stable_question_id IS NULL
     OR stable_question_id <> pg_catalog.btrim(stable_question_id)
     OR stable_question_id = '' THEN
    RAISE EXCEPTION 'export_question_identity_denied'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO i1q.export_question_identities (
    question_id,
    item_id,
    supersedes_question_id,
    created_by_actor_id
  ) VALUES (
    stable_question_id,
    target_item_id,
    superseded_question_id,
    i1q.current_actor_id()
  ) RETURNING * INTO created_identity;

  PERFORM i1q.append_audit_event(
    'export_question_identity_registered',
    'export_question_identity',
    created_identity.question_id,
    pg_catalog.jsonb_build_object('item_id', created_identity.item_id)
  );
  RETURN created_identity;
END
$function$;

CREATE OR REPLACE FUNCTION i1q.assemble_release(
  target_release_id text,
  target_release_label text,
  target_dataset_version text,
  requested_memberships jsonb
)
RETURNS i1q.release_snapshots
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, i1q
AS $function$
DECLARE
  entry jsonb;
  revision i1q.item_revisions%ROWTYPE;
  stable_question_id text;
  normalized_memberships jsonb := '[]'::jsonb;
  next_position integer := 0;
  prior_sequence bigint;
  prior_manifest_hash text;
  manifest_payload jsonb;
  calculated_manifest_hash text;
  created_release i1q.release_snapshots;
BEGIN
  IF NOT i1q.has_active_role('release_manager') THEN
    RAISE EXCEPTION 'release_assembly_denied'
      USING ERRCODE = '42501';
  END IF;
  IF pg_catalog.jsonb_typeof(requested_memberships) <> 'array'
     OR pg_catalog.jsonb_array_length(requested_memberships) = 0 THEN
    RAISE EXCEPTION 'release_requires_memberships'
      USING ERRCODE = '22023';
  END IF;
  IF NOT i1q.medical_governance_is_credentialed() THEN
    RAISE EXCEPTION 'medical_governance_lead_unassigned'
      USING ERRCODE = '42501';
  END IF;
  IF (SELECT count(*) FROM pg_catalog.jsonb_array_elements(requested_memberships))
     <> (SELECT count(DISTINCT value ->> 'item_revision_id') FROM pg_catalog.jsonb_array_elements(requested_memberships))
     OR (SELECT count(*) FROM pg_catalog.jsonb_array_elements(requested_memberships))
     <> (SELECT count(DISTINCT value ->> 'question_id') FROM pg_catalog.jsonb_array_elements(requested_memberships)) THEN
    RAISE EXCEPTION 'release_membership_duplicate'
      USING ERRCODE = '23505';
  END IF;

  FOR entry IN
    SELECT value
      FROM pg_catalog.jsonb_array_elements(requested_memberships)
     ORDER BY value ->> 'question_id'
  LOOP
    IF (SELECT pg_catalog.array_agg(key ORDER BY key) FROM pg_catalog.jsonb_object_keys(entry) key)
       <> ARRAY['item_revision_id', 'question_id']::text[] THEN
      RAISE EXCEPTION 'release_membership_shape_invalid'
        USING ERRCODE = '22023';
    END IF;

    SELECT * INTO revision
      FROM i1q.item_revisions
     WHERE id = entry ->> 'item_revision_id';
    stable_question_id := entry ->> 'question_id';

    IF revision.id IS NULL
       OR i1q.revision_workflow_state(revision.id) <> 'approved'
       OR pg_catalog.cardinality(revision.active_flags) <> 0
       OR revision.open_conflict_id IS NOT NULL THEN
      RAISE EXCEPTION 'release_revision_not_eligible'
        USING ERRCODE = '55000';
    END IF;
    IF NOT EXISTS (
      SELECT 1
        FROM i1q.review_events event
       WHERE event.item_revision_id = revision.id
         AND event.review_type = 'medical'
         AND event.verdict = 'pass'
         AND event.to_status = 'approved'
         AND event.exact_revision_hash = revision.content_hash
         AND event.credential_status = 'verified'
    ) THEN
      RAISE EXCEPTION 'exact_medical_approval_missing'
        USING ERRCODE = '55000';
    END IF;
    IF NOT EXISTS (
      SELECT 1
        FROM i1q.item_revision_claims link
        JOIN i1q.evidence_claims claim ON claim.id = link.evidence_claim_id
       WHERE link.item_revision_id = revision.id
         AND link.claim_role = 'primary'
         AND claim.status = 'verified'
         AND (claim.review_by_date IS NULL OR claim.review_by_date >= CURRENT_DATE)
    ) OR EXISTS (
      SELECT 1
        FROM i1q.item_revision_claims link
        JOIN i1q.evidence_claims claim ON claim.id = link.evidence_claim_id
       WHERE link.item_revision_id = revision.id
         AND (
           claim.status <> 'verified'
           OR (claim.review_by_date IS NOT NULL AND claim.review_by_date < CURRENT_DATE)
         )
    ) THEN
      RAISE EXCEPTION 'release_claim_not_current'
        USING ERRCODE = '55000';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM i1q.item_revision_sources link WHERE link.item_revision_id = revision.id
    ) OR EXISTS (
      SELECT 1
        FROM i1q.item_revision_sources link
        JOIN i1q.source_records source ON source.id = link.source_record_id
        JOIN i1q.rights_records rights ON rights.id = source.rights_record_id
        LEFT JOIN i1q.privacy_redaction_records privacy ON privacy.id = source.privacy_redaction_record_id
       WHERE link.item_revision_id = revision.id
         AND (
           rights.rights_status <> 'cleared_for'
           OR NOT (rights.allowed_uses @> ARRAY['question_derivation']::text[])
           OR (rights.expires_at IS NOT NULL AND rights.expires_at <= pg_catalog.clock_timestamp())
           OR (source.source_type = 'DRJ_TRANSCRIPT' AND privacy.status NOT IN ('pass', 'pass_with_redactions'))
         )
    ) THEN
      RAISE EXCEPTION 'release_source_not_cleared'
        USING ERRCODE = '55000';
    END IF;
    IF NOT EXISTS (
      SELECT 1
        FROM i1q.export_question_identities identity
       WHERE identity.question_id = stable_question_id
         AND identity.item_id = revision.item_id
    ) THEN
      RAISE EXCEPTION 'release_question_identity_missing'
        USING ERRCODE = '55000';
    END IF;

    next_position := next_position + 1;
    normalized_memberships := normalized_memberships || pg_catalog.jsonb_build_array(
      pg_catalog.jsonb_build_object(
        'item_id', revision.item_id,
        'item_revision_id', revision.id,
        'revision_number', revision.revision_number,
        'content_hash', revision.content_hash,
        'dataset_version', target_dataset_version,
        'question_id', stable_question_id,
        'position', next_position
      )
    );
  END LOOP;

  SELECT head.last_sequence, head.last_manifest_hash
    INTO prior_sequence, prior_manifest_hash
    FROM i1q.release_chain_heads head
   WHERE head.chain_name = 'primary'
   FOR UPDATE;

  manifest_payload := pg_catalog.jsonb_build_object(
    'release_id', target_release_id,
    'release_label', target_release_label,
    'dataset_version', target_dataset_version,
    'sequence', prior_sequence + 1,
    'previous_manifest_hash', prior_manifest_hash,
    'release_membership', normalized_memberships
  );
  calculated_manifest_hash := i1q.sha256_hex(i1q.canonical_json(manifest_payload));

  INSERT INTO i1q.release_snapshots (
    id,
    release_label,
    dataset_version,
    sequence,
    previous_manifest_hash,
    manifest_hash,
    manifest,
    claims_currency_checked_at,
    assembled_by_actor_id
  ) VALUES (
    target_release_id,
    target_release_label,
    target_dataset_version,
    prior_sequence + 1,
    prior_manifest_hash,
    calculated_manifest_hash,
    manifest_payload || pg_catalog.jsonb_build_object('manifest_hash', calculated_manifest_hash),
    pg_catalog.clock_timestamp(),
    i1q.current_actor_id()
  ) RETURNING * INTO created_release;

  INSERT INTO i1q.release_memberships (
    release_id,
    position,
    item_id,
    item_revision_id,
    revision_number,
    content_hash,
    dataset_version,
    question_id
  )
  SELECT target_release_id,
         (membership ->> 'position')::integer,
         membership ->> 'item_id',
         membership ->> 'item_revision_id',
         (membership ->> 'revision_number')::integer,
         membership ->> 'content_hash',
         membership ->> 'dataset_version',
         membership ->> 'question_id'
    FROM pg_catalog.jsonb_array_elements(normalized_memberships) membership;

  UPDATE i1q.release_chain_heads
     SET last_sequence = created_release.sequence,
         last_release_id = created_release.id,
         last_manifest_hash = created_release.manifest_hash
   WHERE chain_name = 'primary';

  PERFORM i1q.append_audit_event(
    'release_assembled',
    'release_snapshot',
    created_release.id,
    pg_catalog.jsonb_build_object(
      'dataset_version', created_release.dataset_version,
      'manifest_hash', created_release.manifest_hash,
      'previous_manifest_hash', created_release.previous_manifest_hash
    )
  );
  RETURN created_release;
END
$function$;

CREATE OR REPLACE FUNCTION i1q.length_prefixed(value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
SET search_path = pg_catalog, i1q
AS $function$
  SELECT pg_catalog.octet_length(value)::text || ':' || value
$function$;

CREATE OR REPLACE FUNCTION i1q.release_validation_evidence_hash(target_release_id text)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, i1q
AS $function$
DECLARE
  release i1q.release_snapshots%ROWTYPE;
  artifact_preimage text;
  check_preimage text := '';
  check_id text;
  preimage text;
BEGIN
  SELECT * INTO release
    FROM i1q.release_snapshots
   WHERE id = target_release_id;
  IF release.id IS NULL THEN
    RAISE EXCEPTION 'release_validation_release_missing'
      USING ERRCODE = '22023';
  END IF;

  SELECT pg_catalog.string_agg(
           '|' || i1q.length_prefixed(artifact.channel)
           || '|' || i1q.length_prefixed(artifact.phase)
           || '|' || i1q.length_prefixed(artifact.data_class)
           || '|' || i1q.length_prefixed(artifact.artifact_hash)
           || '|' || i1q.length_prefixed(artifact.record_count::text),
           '' ORDER BY artifact.channel
         )
    INTO artifact_preimage
    FROM i1q.channel_artifacts artifact
   WHERE artifact.release_id = release.id;
  IF artifact_preimage IS NULL THEN
    RAISE EXCEPTION 'release_validation_artifacts_missing'
      USING ERRCODE = '55000';
  END IF;

  FOREACH check_id IN ARRAY ARRAY['LT-1', 'LT-2', 'LT-3', 'LT-4', 'LT-5', 'LT-6']::text[] LOOP
    check_preimage := check_preimage
      || '|' || i1q.length_prefixed(check_id)
      || '|' || i1q.length_prefixed('pass');
  END LOOP;
  preimage := i1q.length_prefixed('i1q.release-validation.v1')
    || '|' || i1q.length_prefixed(release.id)
    || '|' || i1q.length_prefixed(release.manifest_hash)
    || artifact_preimage
    || check_preimage;
  RETURN i1q.sha256_hex(preimage);
END
$function$;

CREATE OR REPLACE FUNCTION i1q.record_export_validation(
  validation_id text,
  target_release_id text,
  validation_evidence_hash text,
  passed_check_ids text[]
)
RETURNS i1q.export_validation_results
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, i1q
AS $function$
DECLARE
  release i1q.release_snapshots%ROWTYPE;
  result i1q.export_validation_results;
  required_check_ids constant text[] := ARRAY['LT-1', 'LT-2', 'LT-3', 'LT-4', 'LT-5', 'LT-6']::text[];
  normalized_check_ids text[];
  expected_evidence_hash text;
  artifact_results jsonb;
BEGIN
  SELECT * INTO release FROM i1q.release_snapshots WHERE id = target_release_id;
  IF NOT i1q.has_any_active_role(ARRAY['release_manager', 'system']::text[])
     OR release.id IS NULL
     OR release.assembled_by_actor_id = i1q.current_actor_id()
     OR validation_evidence_hash !~ '^[0-9a-f]{64}$'
     OR passed_check_ids IS NULL THEN
    RAISE EXCEPTION 'release_validation_denied'
      USING ERRCODE = '42501';
  END IF;

  SELECT pg_catalog.array_agg(DISTINCT check_id ORDER BY check_id)
    INTO normalized_check_ids
    FROM pg_catalog.unnest(passed_check_ids) check_id;
  expected_evidence_hash := i1q.release_validation_evidence_hash(target_release_id);
  SELECT pg_catalog.jsonb_agg(
           pg_catalog.jsonb_build_object(
             'artifact_id', artifact.id,
             'channel', artifact.channel,
             'phase', artifact.phase,
             'data_class', artifact.data_class,
             'artifact_hash', artifact.artifact_hash,
             'record_count', artifact.record_count,
             'check_ids', pg_catalog.to_jsonb(required_check_ids),
             'status', 'pass'
           ) ORDER BY artifact.channel
         )
    INTO artifact_results
    FROM i1q.channel_artifacts artifact
   WHERE artifact.release_id = target_release_id;
  IF pg_catalog.cardinality(passed_check_ids) <> pg_catalog.cardinality(required_check_ids)
     OR normalized_check_ids <> required_check_ids
     OR validation_evidence_hash <> expected_evidence_hash
     OR artifact_results IS NULL THEN
    RAISE EXCEPTION 'release_validation_denied'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO i1q.export_validation_results (
    id,
    release_id,
    manifest_hash,
    evidence_hash,
    check_ids,
    artifact_results,
    status,
    validator_actor_id
  ) VALUES (
    validation_id,
    release.id,
    release.manifest_hash,
    validation_evidence_hash,
    required_check_ids,
    artifact_results,
    'pass',
    i1q.current_actor_id()
  ) RETURNING * INTO result;

  PERFORM i1q.append_audit_event(
    'release_validation_recorded',
    'export_validation_result',
    result.id,
    pg_catalog.jsonb_build_object('release_id', release.id, 'manifest_hash', release.manifest_hash)
  );
  RETURN result;
END
$function$;

CREATE OR REPLACE FUNCTION i1q.release_current_state(target_release_id text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, i1q
AS $function$
  SELECT COALESCE(
    (
      SELECT promotion.to_state
        FROM i1q.release_promotion_records promotion
       WHERE promotion.release_id = target_release_id
       ORDER BY promotion.sequence DESC
       LIMIT 1
    ),
    (
      SELECT release.initial_state
        FROM i1q.release_snapshots release
       WHERE release.id = target_release_id
    )
  )
$function$;

CREATE OR REPLACE FUNCTION i1q.promote_release(
  promotion_id text,
  target_release_id text,
  target_state text,
  target_authority_type text,
  promotion_evidence_hashes jsonb,
  validation_result_id text DEFAULT NULL
)
RETURNS i1q.release_promotion_records
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, i1q
AS $function$
DECLARE
  release i1q.release_snapshots%ROWTYPE;
  current_state text;
  next_sequence integer;
  prior_promotion_hash text;
  calculated_promotion_hash text;
  created_promotion i1q.release_promotion_records;
BEGIN
  SELECT * INTO release FROM i1q.release_snapshots WHERE id = target_release_id;
  current_state := i1q.release_current_state(target_release_id);

  IF release.id IS NULL
     OR pg_catalog.jsonb_typeof(promotion_evidence_hashes) <> 'array'
     OR pg_catalog.jsonb_array_length(promotion_evidence_hashes) = 0
     OR EXISTS (
       SELECT 1
         FROM pg_catalog.jsonb_array_elements(promotion_evidence_hashes) evidence_hash
        WHERE pg_catalog.jsonb_typeof(evidence_hash) <> 'string'
           OR evidence_hash #>> '{}' !~ '^[0-9a-f]{64}$'
     ) THEN
    RAISE EXCEPTION 'release_promotion_invalid'
      USING ERRCODE = '22023';
  END IF;

  IF target_state = 'validated' THEN
    IF target_authority_type <> 'release_manager_validation'
       OR NOT i1q.has_active_role('release_manager')
       OR release.assembled_by_actor_id = i1q.current_actor_id()
       OR current_state <> 'assembled'
       OR NOT EXISTS (
         SELECT 1
           FROM i1q.export_validation_results validation
          WHERE validation.id = validation_result_id
            AND validation.release_id = release.id
            AND validation.manifest_hash = release.manifest_hash
            AND validation.status = 'pass'
            AND validation.validator_actor_id = i1q.current_actor_id()
       ) THEN
      RAISE EXCEPTION 'release_validation_promotion_denied'
        USING ERRCODE = '42501';
    END IF;
  ELSIF target_state = 'ratified' THEN
    IF target_authority_type <> 'medical_governance_attestation'
       OR current_state <> 'validated'
       OR NOT i1q.holds_governance_slot('medical_governance_lead')
       OR NOT i1q.medical_governance_is_credentialed()
       OR release.assembled_by_actor_id = i1q.current_actor_id()
       OR NOT EXISTS (
         SELECT 1
           FROM i1q.export_validation_results validation
          WHERE validation.release_id = release.id
            AND validation.manifest_hash = release.manifest_hash
            AND validation.status = 'pass'
            AND validation.validator_actor_id <> i1q.current_actor_id()
            AND validation.validator_actor_id <> release.assembled_by_actor_id
       ) THEN
      RAISE EXCEPTION 'medical_release_attestation_denied'
        USING ERRCODE = '42501';
    END IF;
  ELSIF target_state = 'published' THEN
    IF target_authority_type <> 'brian_publication_ratification'
       OR current_state <> 'ratified'
       OR release.assembled_by_actor_id = i1q.current_actor_id()
       OR EXISTS (
         SELECT 1
           FROM i1q.release_promotion_records prior
          WHERE prior.release_id = release.id
            AND prior.actor_id = i1q.current_actor_id()
       )
       OR NOT EXISTS (
         SELECT 1
           FROM i1q.publication_authorities authority
          WHERE authority.authority_code = 'brian_publication_ratifier'
            AND authority.actor_id = i1q.current_actor_id()
            AND authority.assignment_evidence_hash IS NOT NULL
       )
       OR 2 <> (
         SELECT pg_catalog.count(*)
           FROM i1q.feature_flags flag
          WHERE flag.key IN ('student_content_enabled', 'student_release_enabled')
            AND flag.enabled
       ) THEN
      RAISE EXCEPTION 'student_publication_not_authorized'
        USING ERRCODE = '42501';
    END IF;
  ELSIF target_state = 'withdrawn' THEN
    IF target_authority_type <> 'incident_withdrawal'
       OR NOT i1q.has_any_active_role(ARRAY['incident_owner', 'system']::text[]) THEN
      RAISE EXCEPTION 'release_withdrawal_denied'
        USING ERRCODE = '42501';
    END IF;
  ELSIF target_state = 'superseded' THEN
    IF target_authority_type <> 'release_supersession'
       OR NOT i1q.has_active_role('release_manager')
       OR current_state <> 'published' THEN
      RAISE EXCEPTION 'release_supersession_denied'
        USING ERRCODE = '42501';
    END IF;
  ELSE
    RAISE EXCEPTION 'release_promotion_state_invalid'
      USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(pg_catalog.max(promotion.sequence), 0) + 1,
         (pg_catalog.array_agg(promotion.promotion_hash ORDER BY promotion.sequence DESC))[1]
    INTO next_sequence, prior_promotion_hash
    FROM i1q.release_promotion_records promotion
   WHERE promotion.release_id = release.id;

  calculated_promotion_hash := i1q.sha256_hex(
    COALESCE(prior_promotion_hash, 'ROOT') || '|' ||
    pg_catalog.jsonb_build_object(
      'release_id', release.id,
      'from_state', current_state,
      'to_state', target_state,
      'authority_type', target_authority_type,
      'actor_id', i1q.current_actor_id(),
      'manifest_hash', release.manifest_hash,
      'evidence_hashes', promotion_evidence_hashes,
      'sequence', next_sequence
    )::text
  );

  INSERT INTO i1q.release_promotion_records (
    id,
    release_id,
    from_state,
    to_state,
    authority_type,
    actor_id,
    manifest_hash,
    evidence_hashes,
    previous_promotion_hash,
    promotion_hash,
    sequence
  ) VALUES (
    promotion_id,
    release.id,
    current_state,
    target_state,
    target_authority_type,
    i1q.current_actor_id(),
    release.manifest_hash,
    promotion_evidence_hashes,
    prior_promotion_hash,
    calculated_promotion_hash,
    next_sequence
  ) RETURNING * INTO created_promotion;

  PERFORM i1q.append_audit_event(
    'release_promoted',
    'release_promotion_record',
    created_promotion.id,
    pg_catalog.jsonb_build_object(
      'release_id', release.id,
      'from_state', current_state,
      'to_state', target_state,
      'manifest_hash', release.manifest_hash,
      'promotion_hash', created_promotion.promotion_hash
    )
  );
  RETURN created_promotion;
END
$function$;

CREATE OR REPLACE FUNCTION i1q.jsonb_field_paths(document jsonb)
RETURNS TABLE(field_path text)
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, i1q
AS $function$
  WITH RECURSIVE walk(field_path, value) AS (
    SELECT ''::text, document
    UNION ALL
    SELECT CASE
             WHEN child.key IS NULL THEN walk.field_path
             WHEN walk.field_path = '' THEN child.key
             ELSE walk.field_path || '.' || child.key
           END,
           child.value
      FROM walk
      CROSS JOIN LATERAL (
        SELECT object_entry.key, object_entry.value
          FROM pg_catalog.jsonb_each(
            CASE WHEN pg_catalog.jsonb_typeof(walk.value) = 'object' THEN walk.value ELSE '{}'::jsonb END
          ) object_entry
        UNION ALL
        SELECT NULL::text, array_entry.value
          FROM pg_catalog.jsonb_array_elements(
            CASE WHEN pg_catalog.jsonb_typeof(walk.value) = 'array' THEN walk.value ELSE '[]'::jsonb END
          ) array_entry(value)
      ) child
  )
  SELECT DISTINCT walk.field_path
    FROM walk
   WHERE walk.field_path <> ''
$function$;

CREATE OR REPLACE FUNCTION i1q.jsonb_field_names(document jsonb)
RETURNS TABLE(field_name text)
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, i1q
AS $function$
  WITH RECURSIVE walk(value) AS (
    SELECT document
    UNION ALL
    SELECT child.value
      FROM walk
      CROSS JOIN LATERAL (
        SELECT object_entry.value
          FROM pg_catalog.jsonb_each(
            CASE WHEN pg_catalog.jsonb_typeof(walk.value) = 'object' THEN walk.value ELSE '{}'::jsonb END
          ) object_entry
        UNION ALL
        SELECT array_entry.value
          FROM pg_catalog.jsonb_array_elements(
            CASE WHEN pg_catalog.jsonb_typeof(walk.value) = 'array' THEN walk.value ELSE '[]'::jsonb END
          ) array_entry(value)
      ) child
  )
  SELECT DISTINCT object_entry.key
    FROM walk
    CROSS JOIN LATERAL pg_catalog.jsonb_each(
      CASE WHEN pg_catalog.jsonb_typeof(walk.value) = 'object' THEN walk.value ELSE '{}'::jsonb END
    ) object_entry
$function$;

CREATE OR REPLACE FUNCTION i1q.jsonb_string_values(document jsonb)
RETURNS TABLE(string_value text)
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, i1q
AS $function$
  WITH RECURSIVE walk(value) AS (
    SELECT document
    UNION ALL
    SELECT child.value
      FROM walk
      CROSS JOIN LATERAL (
        SELECT object_entry.value
          FROM pg_catalog.jsonb_each(
            CASE WHEN pg_catalog.jsonb_typeof(walk.value) = 'object' THEN walk.value ELSE '{}'::jsonb END
          ) object_entry
        UNION ALL
        SELECT array_entry.value
          FROM pg_catalog.jsonb_array_elements(
            CASE WHEN pg_catalog.jsonb_typeof(walk.value) = 'array' THEN walk.value ELSE '[]'::jsonb END
          ) array_entry(value)
      ) child
  )
  SELECT DISTINCT walk.value #>> '{}' AS string_value
    FROM walk
   WHERE pg_catalog.jsonb_typeof(walk.value) = 'string'
$function$;

CREATE OR REPLACE FUNCTION i1q.normalize_security_marker(candidate text)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
SET search_path = pg_catalog, i1q
AS $function$
  SELECT pg_catalog.regexp_replace(
           pg_catalog.regexp_replace(
             pg_catalog.replace(
               pg_catalog.lower(pg_catalog.normalize(candidate, 'NFC')),
               '%25',
               '%'
             ),
             '%(2e|2d|5f|5b|5d)',
             '',
             'g'
           ),
           '[^a-z0-9]',
           '',
           'g'
         )
$function$;

CREATE OR REPLACE FUNCTION i1q.is_class_d_field_marker(candidate text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
STRICT
SET search_path = pg_catalog, i1q
AS $function$
  SELECT i1q.normalize_security_marker(candidate) = ANY(ARRAY[
    'itemid', 'itemrevisionid', 'itemrevid', 'revisionid', 'revisionnumber',
    'variantgroupid', 'vgid', 'conceptid', 'misconceptionid',
    'reviewerid', 'reviewassignmentid', 'revieweventid',
    'evidenceclaimid', 'claimid', 'psychometricid', 'psychometricsnapshotid',
    'incidentid', 'sourceid', 'sourcerecordid', 'extractionid',
    'rightsrecordid', 'redactionrecordid', 'privacyredactionrecordid'
  ]::text[])
$function$;

CREATE OR REPLACE FUNCTION i1q.release_class_d_identifier_values(target_release_id text)
RETURNS TABLE(identifier_family text, identifier_value text)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, i1q
AS $function$
  WITH target_memberships AS MATERIALIZED (
    SELECT membership.item_id, membership.item_revision_id
      FROM i1q.release_memberships membership
     WHERE membership.release_id = target_release_id
  ), identifiers(identifier_family, identifier_value) AS (
    SELECT 'item', membership.item_id
      FROM target_memberships membership
    UNION ALL
    SELECT 'revision', membership.item_revision_id
      FROM target_memberships membership
    UNION ALL
    SELECT 'source', source_link.source_record_id
      FROM target_memberships membership
      JOIN i1q.item_revision_sources source_link
        ON source_link.item_revision_id = membership.item_revision_id
    UNION ALL
    SELECT 'claim', claim_link.evidence_claim_id
      FROM target_memberships membership
      JOIN i1q.item_revision_claims claim_link
        ON claim_link.item_revision_id = membership.item_revision_id
    UNION ALL
    SELECT 'reviewer', assignment.reviewer_id
      FROM target_memberships membership
      JOIN i1q.review_assignments assignment
        ON assignment.item_revision_id = membership.item_revision_id
    UNION ALL
    SELECT 'reviewer', review_event.reviewer_id
      FROM target_memberships membership
      JOIN i1q.review_events review_event
        ON review_event.item_revision_id = membership.item_revision_id
    UNION ALL
    SELECT 'reviewer', claim.verified_by_reviewer_id
      FROM target_memberships membership
      JOIN i1q.item_revision_claims claim_link
        ON claim_link.item_revision_id = membership.item_revision_id
      JOIN i1q.evidence_claims claim
        ON claim.id = claim_link.evidence_claim_id
    UNION ALL
    SELECT 'reviewer', redaction.reviewer_id
      FROM target_memberships membership
      JOIN i1q.item_revision_sources source_link
        ON source_link.item_revision_id = membership.item_revision_id
      JOIN i1q.source_records source
        ON source.id = source_link.source_record_id
      JOIN i1q.privacy_redaction_records redaction
        ON redaction.id = source.privacy_redaction_record_id
    UNION ALL
    SELECT 'misconception', misconception.misconception_id
      FROM target_memberships membership
      JOIN i1q.item_revision_misconceptions misconception
        ON misconception.item_revision_id = membership.item_revision_id
    UNION ALL
    SELECT 'psychometric', psychometric.id
      FROM target_memberships membership
      JOIN i1q.psychometric_snapshots psychometric
        ON psychometric.release_id = target_release_id
       AND psychometric.item_revision_id = membership.item_revision_id
  )
  SELECT DISTINCT identifiers.identifier_family, identifiers.identifier_value
    FROM identifiers
   WHERE identifiers.identifier_value IS NOT NULL
     AND pg_catalog.btrim(identifiers.identifier_value) <> ''
$function$;

CREATE OR REPLACE FUNCTION i1q.create_channel_artifact(
  artifact_id text,
  target_release_id text,
  policy_id text,
  target_channel text,
  target_phase text,
  target_data_class text,
  target_media_type text,
  artifact_payload jsonb
)
RETURNS i1q.channel_artifacts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, i1q
AS $function$
DECLARE
  created_artifact i1q.channel_artifacts;
  calculated_hash text;
  policy i1q.channel_security_policies%ROWTYPE;
  allowed_classes text[];
  contract_valid boolean := false;
BEGIN
  SELECT * INTO policy
    FROM i1q.channel_security_policies candidate
   WHERE candidate.id = policy_id
     AND candidate.status = 'active';
  contract_valid := (
    (target_channel = 'stat_dataset_questions' AND target_phase = 'server_only' AND target_data_class = 'server_only')
    OR (target_channel = 'stat_pre_answer' AND target_phase = 'pre_answer' AND target_data_class = 'A')
    OR (target_channel = 'stat_post_answer_debrief' AND target_phase = 'post_answer' AND target_data_class = 'C')
    OR (target_channel = 'stat_indexes' AND target_phase = 'pre_answer' AND target_data_class = 'A')
    OR (target_channel = 'stat_lookup' AND target_phase = 'pre_answer' AND target_data_class = 'A')
    OR (target_channel = 'question_metadata' AND target_phase = 'server_only' AND target_data_class = 'D')
    OR (target_channel = 'drills' AND target_phase = 'internal' AND target_data_class = 'internal')
    OR (target_phase = 'contract_only' AND target_data_class = 'contract_only' AND artifact_payload = '[]'::jsonb)
  );
  allowed_classes := CASE target_data_class
    WHEN 'A' THEN ARRAY['A']::text[]
    WHEN 'C' THEN ARRAY['A', 'C']::text[]
    WHEN 'D' THEN ARRAY['A', 'B', 'C', 'D']::text[]
    WHEN 'server_only' THEN ARRAY['A', 'B', 'C']::text[]
    WHEN 'internal' THEN ARRAY['A', 'B', 'C', 'D']::text[]
    WHEN 'contract_only' THEN ARRAY[]::text[]
    ELSE NULL
  END;

  IF NOT i1q.has_any_active_role(ARRAY['release_manager', 'system']::text[])
     OR NOT EXISTS (SELECT 1 FROM i1q.release_snapshots release WHERE release.id = target_release_id)
     OR policy.id IS NULL
     OR policy.channel <> target_channel
     OR NOT contract_valid
     OR allowed_classes IS NULL
     OR target_media_type IS NULL
     OR pg_catalog.btrim(target_media_type) = ''
     OR artifact_payload IS NULL
     OR artifact_payload = 'null'::jsonb
     OR pg_catalog.jsonb_typeof(policy.field_rules) <> 'array' THEN
    RAISE EXCEPTION 'channel_artifact_create_denied'
      USING ERRCODE = '42501';
  END IF;

  IF target_phase <> 'contract_only' AND EXISTS (
    SELECT 1
      FROM i1q.jsonb_field_paths(artifact_payload) path
     WHERE 1 <> (
       SELECT pg_catalog.count(*)
         FROM pg_catalog.jsonb_array_elements(policy.field_rules) rule
        WHERE rule ->> 'field_path' = path.field_path
          AND rule ->> 'class_name' = ANY(allowed_classes)
          AND pg_catalog.jsonb_typeof(rule -> 'channels') = 'array'
          AND rule -> 'channels' @> pg_catalog.jsonb_build_array(target_channel)
          AND pg_catalog.jsonb_typeof(rule -> 'phases') = 'array'
          AND rule -> 'phases' @> pg_catalog.jsonb_build_array(target_phase)
     )
  ) THEN
    RAISE EXCEPTION 'channel_artifact_policy_field_denied'
      USING ERRCODE = '42501';
  END IF;

  IF target_data_class IN ('A', 'C') THEN
    IF NOT EXISTS (
      SELECT 1
        FROM i1q.release_memberships membership
       WHERE membership.release_id = target_release_id
    ) THEN
      RAISE EXCEPTION 'channel_artifact_class_d_scan_unavailable'
        USING ERRCODE = '42501';
    END IF;

    IF EXISTS (
      SELECT 1
        FROM i1q.jsonb_field_names(artifact_payload) field
       WHERE i1q.is_class_d_field_marker(field.field_name)
    ) THEN
      RAISE EXCEPTION 'channel_artifact_class_d_field_marker'
        USING ERRCODE = '42501';
    END IF;

    IF EXISTS (
      SELECT 1
        FROM i1q.jsonb_string_values(artifact_payload) scalar
       WHERE i1q.is_class_d_field_marker(scalar.string_value)
          OR EXISTS (
            SELECT 1
              FROM i1q.release_class_d_identifier_values(target_release_id) identifier
             WHERE identifier.identifier_value = scalar.string_value
          )
    ) THEN
      RAISE EXCEPTION 'channel_artifact_class_d_value_leak'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  IF target_phase = 'pre_answer' AND EXISTS (
    SELECT 1
      FROM i1q.jsonb_field_paths(artifact_payload) path
     WHERE pg_catalog.regexp_replace(pg_catalog.lower(path.field_path), '[^a-z0-9.]', '', 'g')
       ~ '(^|\.)(answer|answers|answerkey|answermap|correct|correctness|correctanswer|correctchoice|correctkey|correctoption|explanation|explanations|iscorrect|rationale|rationales|solution|solutionkey|solutions|whytempting|whywrong|itemid|itemrevid|revisionnumber|vgid|conceptid|misconceptionid|reviewerid|claimid|psychometric|incident|sourceid|extraction|rights|redaction)(\.|$)'
  ) THEN
    RAISE EXCEPTION 'channel_artifact_pre_answer_leak'
      USING ERRCODE = '42501';
  END IF;

  calculated_hash := i1q.sha256_hex(i1q.canonical_json(artifact_payload));
  INSERT INTO i1q.channel_artifacts (
    id,
    release_id,
    channel_security_policy_id,
    channel,
    phase,
    data_class,
    media_type,
    record_count,
    artifact_hash,
    created_by_actor_id
  ) VALUES (
    artifact_id,
    target_release_id,
    policy_id,
    target_channel,
    target_phase,
    target_data_class,
    target_media_type,
    CASE WHEN pg_catalog.jsonb_typeof(artifact_payload) = 'array' THEN pg_catalog.jsonb_array_length(artifact_payload) ELSE 1 END,
    calculated_hash,
    i1q.current_actor_id()
  ) RETURNING * INTO created_artifact;

  INSERT INTO i1q.channel_artifact_payloads (artifact_id, payload)
  VALUES (created_artifact.id, artifact_payload);

  PERFORM i1q.append_audit_event(
    'channel_artifact_created',
    'channel_artifact',
    created_artifact.id,
    pg_catalog.jsonb_build_object(
      'release_id', target_release_id,
      'channel', target_channel,
      'phase', target_phase,
      'data_class', target_data_class,
      'artifact_hash', calculated_hash
    )
  );
  RETURN created_artifact;
END
$function$;

CREATE OR REPLACE FUNCTION i1q.read_channel_artifact_payload(
  target_artifact_id text,
  access_purpose text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, i1q
AS $function$
DECLARE
  artifact i1q.channel_artifacts%ROWTYPE;
  result jsonb;
BEGIN
  SELECT * INTO artifact FROM i1q.channel_artifacts WHERE id = target_artifact_id;
  IF artifact.id IS NULL
     OR access_purpose NOT IN ('release_validation', 'system_validation')
     OR NOT (
       (access_purpose = 'release_validation' AND i1q.has_active_role('release_manager'))
       OR (access_purpose = 'system_validation' AND i1q.has_active_role('system'))
     ) THEN
    RAISE EXCEPTION 'channel_artifact_payload_denied'
      USING ERRCODE = '42501';
  END IF;

  SELECT payload.payload INTO result
    FROM i1q.channel_artifact_payloads payload
   WHERE payload.artifact_id = artifact.id;

  PERFORM i1q.append_audit_event(
    'channel_artifact_payload_accessed',
    'channel_artifact',
    artifact.id,
    pg_catalog.jsonb_build_object('purpose', access_purpose, 'artifact_hash', artifact.artifact_hash)
  );
  RETURN result;
END
$function$;

CREATE OR REPLACE FUNCTION i1q.disable_i1q_behavior(
  compensation_id text,
  compensation_reason text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, i1q
AS $function$
DECLARE
  changed_count integer;
BEGIN
  IF i1q.current_actor_id() IS NOT NULL
     OR compensation_id IS NULL
     OR pg_catalog.btrim(compensation_id) = ''
     OR compensation_reason IS NULL
     OR pg_catalog.btrim(compensation_reason) = '' THEN
    RAISE EXCEPTION 'compensation_operator_context_required'
      USING ERRCODE = '42501';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('i1q:disable:' || compensation_id, 0)
  );
  IF EXISTS (
    SELECT 1
      FROM i1q.compensation_records record
     WHERE record.compensation_id = $1
  ) THEN
    RETURN true;
  END IF;

  UPDATE i1q.feature_flags
     SET enabled = false,
         changed_by_actor_id = i1q.current_actor_id(),
         changed_by_authority = 'compensation:' || compensation_id,
         changed_at = pg_catalog.clock_timestamp()
   WHERE enabled;
  GET DIAGNOSTICS changed_count = ROW_COUNT;

  INSERT INTO i1q.compensation_records (
    compensation_id,
    reason,
    flags_disabled,
    actor_id
  ) VALUES (
    compensation_id,
    compensation_reason,
    changed_count,
    i1q.current_actor_id()
  );

  PERFORM i1q.append_audit_event(
    'i1q_behavior_compensated',
    'migration_compensation',
    compensation_id,
    pg_catalog.jsonb_build_object(
      'reason', compensation_reason,
      'flags_disabled', changed_count,
      'data_preserved', true,
      'history_preserved', true
    )
  );
  RETURN true;
END
$function$;

DO $rls_enable$
DECLARE
  table_name text;
  all_tables text[] := ARRAY[
    'schema_versions', 'actor_role_memberships', 'reviewers', 'governance_slots',
    'publication_authorities', 'taxonomy_versions', 'blueprint_versions',
    'misconception_vocabulary_versions', 'misconception_entries',
    'channel_security_policies', 'concepts', 'variant_groups', 'items',
    'rights_records', 'privacy_redaction_records', 'source_records',
    'inventory_sources', 'transcript_artifacts', 'restricted_source_references',
    'evidence_claims', 'item_revisions', 'item_revision_answers',
    'item_revision_sources', 'item_revision_claims', 'item_revision_concepts',
    'item_revision_misconceptions', 'model_prompt_versions', 'extraction_runs',
    'review_assignments', 'review_events', 'reviewer_calibration_records',
    'incident_records', 'release_chain_heads', 'release_snapshots',
    'export_question_identities', 'release_memberships', 'export_validation_results',
    'release_promotion_records', 'channel_artifacts', 'channel_artifact_payloads',
    'psychometric_snapshots', 'normalized_transcript_segments',
    'extraction_candidates', 'candidate_quality_flags', 'batch_jobs',
    'job_checkpoints', 'import_maps', 'feature_flags', 'audit_chain_heads',
    'audit_events', 'api_idempotency_keys', 'compensation_records'
  ];
BEGIN
  FOREACH table_name IN ARRAY all_tables LOOP
    EXECUTE pg_catalog.format('ALTER TABLE i1q.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE pg_catalog.format('ALTER TABLE i1q.%I FORCE ROW LEVEL SECURITY', table_name);
  END LOOP;
END
$rls_enable$;

DO $read_policies$
DECLARE
  table_name text;
  reference_tables text[] := ARRAY[
    'schema_versions', 'taxonomy_versions', 'blueprint_versions',
    'misconception_vocabulary_versions', 'misconception_entries',
    'channel_security_policies', 'concepts', 'variant_groups', 'items',
    'model_prompt_versions'
  ];
  release_tables text[] := ARRAY[
    'release_snapshots', 'export_question_identities', 'release_memberships',
    'export_validation_results', 'release_promotion_records', 'channel_artifacts'
  ];
  revision_link_tables text[] := ARRAY[
    'item_revision_sources', 'item_revision_claims',
    'item_revision_concepts', 'item_revision_misconceptions'
  ];
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_policies WHERE schemaname = 'i1q' AND tablename = 'actor_role_memberships' AND policyname = 'actor_role_memberships_own_read') THEN
    CREATE POLICY actor_role_memberships_own_read
      ON i1q.actor_role_memberships FOR SELECT
      USING (actor_id = i1q.current_actor_id());
  END IF;

  FOREACH table_name IN ARRAY reference_tables LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_policies WHERE schemaname = 'i1q' AND tablename = table_name AND policyname = table_name || '_operational_read') THEN
      EXECUTE pg_catalog.format(
        'CREATE POLICY %I ON i1q.%I FOR SELECT USING (i1q.has_any_active_role(ARRAY[''platform_admin'', ''content_operator'', ''author'', ''editorial_reviewer'', ''physician_reviewer'', ''release_manager'', ''privacy_officer'', ''incident_owner'', ''system'']::text[]))',
        table_name || '_operational_read',
        table_name
      );
    END IF;
  END LOOP;

  FOREACH table_name IN ARRAY release_tables LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_policies WHERE schemaname = 'i1q' AND tablename = table_name AND policyname = table_name || '_release_read') THEN
      EXECUTE pg_catalog.format(
        'CREATE POLICY %I ON i1q.%I FOR SELECT USING (i1q.has_any_active_role(ARRAY[''platform_admin'', ''content_operator'', ''release_manager'', ''system'']::text[]))',
        table_name || '_release_read',
        table_name
      );
    END IF;
  END LOOP;

  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_policies WHERE schemaname = 'i1q' AND tablename = 'evidence_claims' AND policyname = 'evidence_claims_scoped_read') THEN
    CREATE POLICY evidence_claims_scoped_read
      ON i1q.evidence_claims FOR SELECT
      USING (i1q.can_read_claim(id));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_policies WHERE schemaname = 'i1q' AND tablename = 'incident_records' AND policyname = 'incident_records_owner_read') THEN
    CREATE POLICY incident_records_owner_read
      ON i1q.incident_records FOR SELECT
      USING (i1q.has_any_active_role(ARRAY['incident_owner', 'privacy_officer', 'release_manager', 'system']::text[]));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_policies WHERE schemaname = 'i1q' AND tablename = 'psychometric_snapshots' AND policyname = 'psychometric_snapshots_aggregate_read') THEN
    CREATE POLICY psychometric_snapshots_aggregate_read
      ON i1q.psychometric_snapshots FOR SELECT
      USING (
        report_only
        AND privacy_floor_applied
        AND (
          i1q.has_any_active_role(ARRAY['read_only', 'release_manager', 'system']::text[])
          OR i1q.holds_governance_slot('assessment_science_owner')
        )
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_policies WHERE schemaname = 'i1q' AND tablename = 'import_maps' AND policyname = 'import_maps_operator_read') THEN
    CREATE POLICY import_maps_operator_read
      ON i1q.import_maps FOR SELECT
      USING (i1q.has_any_active_role(ARRAY['content_operator', 'release_manager', 'system']::text[]));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_policies WHERE schemaname = 'i1q' AND tablename = 'item_revisions' AND policyname = 'item_revisions_scoped_read') THEN
    CREATE POLICY item_revisions_scoped_read
      ON i1q.item_revisions FOR SELECT
      USING (i1q.can_read_revision(id));
  END IF;

  FOREACH table_name IN ARRAY revision_link_tables LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_policies WHERE schemaname = 'i1q' AND tablename = table_name AND policyname = table_name || '_scoped_read') THEN
      EXECUTE pg_catalog.format(
        'CREATE POLICY %I ON i1q.%I FOR SELECT USING (i1q.can_read_revision(item_revision_id))',
        table_name || '_scoped_read',
        table_name
      );
    END IF;
  END LOOP;

  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_policies WHERE schemaname = 'i1q' AND tablename = 'source_records' AND policyname = 'source_records_scoped_read') THEN
    CREATE POLICY source_records_scoped_read
      ON i1q.source_records FOR SELECT
      USING (i1q.can_read_source(id));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_policies WHERE schemaname = 'i1q' AND tablename = 'reviewers' AND policyname = 'reviewers_scoped_read') THEN
    CREATE POLICY reviewers_scoped_read
      ON i1q.reviewers FOR SELECT
      USING (
        actor_id = i1q.current_actor_id()
        OR i1q.holds_governance_slot('editorial_lead')
        OR i1q.holds_governance_slot('medical_governance_lead')
        OR i1q.has_any_active_role(ARRAY['release_manager', 'system']::text[])
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_policies WHERE schemaname = 'i1q' AND tablename = 'governance_slots' AND policyname = 'governance_slots_scoped_read') THEN
    CREATE POLICY governance_slots_scoped_read
      ON i1q.governance_slots FOR SELECT
      USING (i1q.has_any_active_role(ARRAY['release_manager', 'privacy_officer', 'incident_owner', 'system']::text[]));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_policies WHERE schemaname = 'i1q' AND tablename = 'review_assignments' AND policyname = 'review_assignments_scoped_read') THEN
    CREATE POLICY review_assignments_scoped_read
      ON i1q.review_assignments FOR SELECT
      USING (i1q.can_read_review_record(item_revision_id, reviewer_actor_id));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_policies WHERE schemaname = 'i1q' AND tablename = 'review_events' AND policyname = 'review_events_scoped_read') THEN
    CREATE POLICY review_events_scoped_read
      ON i1q.review_events FOR SELECT
      USING (i1q.can_read_review_record(item_revision_id, reviewer_actor_id));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_policies WHERE schemaname = 'i1q' AND tablename = 'feature_flags' AND policyname = 'feature_flags_mapped_read') THEN
    CREATE POLICY feature_flags_mapped_read
      ON i1q.feature_flags FOR SELECT
      USING (i1q.has_any_active_role(ARRAY['platform_admin', 'content_operator', 'author', 'editorial_reviewer', 'physician_reviewer', 'release_manager', 'privacy_officer', 'incident_owner', 'read_only', 'system']::text[]));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_policies WHERE schemaname = 'i1q' AND tablename = 'rights_records' AND policyname = 'rights_records_privacy_read') THEN
    CREATE POLICY rights_records_privacy_read
      ON i1q.rights_records FOR SELECT
      USING (i1q.has_any_active_role(ARRAY['privacy_officer', 'release_manager', 'system']::text[]));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_policies WHERE schemaname = 'i1q' AND tablename = 'privacy_redaction_records' AND policyname = 'privacy_redaction_records_privacy_read') THEN
    CREATE POLICY privacy_redaction_records_privacy_read
      ON i1q.privacy_redaction_records FOR SELECT
      USING (i1q.has_any_active_role(ARRAY['privacy_officer', 'release_manager', 'system']::text[]));
  END IF;

  FOREACH table_name IN ARRAY ARRAY['inventory_sources', 'transcript_artifacts', 'normalized_transcript_segments', 'extraction_runs', 'extraction_candidates', 'candidate_quality_flags', 'batch_jobs', 'job_checkpoints', 'api_idempotency_keys']::text[] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_policies WHERE schemaname = 'i1q' AND tablename = table_name AND policyname = table_name || '_bounded_read') THEN
      EXECUTE pg_catalog.format(
        'CREATE POLICY %I ON i1q.%I FOR SELECT USING (i1q.has_any_active_role(ARRAY[''privacy_officer'', ''content_operator'', ''system'']::text[]))',
        table_name || '_bounded_read',
        table_name
      );
    END IF;
  END LOOP;
END
$read_policies$;

REVOKE ALL ON SCHEMA i1q FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA i1q FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA i1q FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA i1q FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA i1q REVOKE ALL ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA i1q REVOKE ALL ON SEQUENCES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA i1q REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

DO $revoke_builtin_roles$
DECLARE
  role_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated']::text[] LOOP
    IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = role_name) THEN
      EXECUTE pg_catalog.format('REVOKE ALL ON SCHEMA i1q FROM %I', role_name);
      EXECUTE pg_catalog.format('REVOKE ALL ON ALL TABLES IN SCHEMA i1q FROM %I', role_name);
      EXECUTE pg_catalog.format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA i1q FROM %I', role_name);
      EXECUTE pg_catalog.format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA i1q FROM %I', role_name);
    END IF;
  END LOOP;
END
$revoke_builtin_roles$;

COMMENT ON SCHEMA i1q IS
  'I1Q-1007X offline app-owned RANKLISTIQ candidate. Runtime grants are intentionally absent pending a canonical unprivileged adapter role and reviewed auth bridge.';
COMMENT ON TABLE i1q.actor_role_memberships IS
  'App-owned role membership derived from auth.uid(). No caller-set role string or role GUC participates in authorization.';
COMMENT ON TABLE i1q.item_revisions IS
  'Answer-free Item Revision content. Drafts use guarded author edits; candidate and later content is frozen. Workflow and terminal state changes are audited.';
COMMENT ON TABLE i1q.item_revision_answers IS
  'Answer-bearing and post-answer content. No direct read policy exists; access is purpose-scoped and audit-appended.';
COMMENT ON TABLE i1q.restricted_source_references IS
  'Raw or restricted object references only. No direct read policy exists.';
COMMENT ON TABLE i1q.compensation_records IS
  'Unique forward compensation claims. One row and one audit event are permitted per compensation ID.';
COMMENT ON TABLE i1q.release_memberships IS
  'Exact immutable release tuple: release, item, itemrev, revision number, content hash, dataset version, and stable projected question ID. The question_id column is the adapter projected_question_id.';
COMMENT ON FUNCTION i1q.has_active_role(text) IS
  'Resolves role membership from auth.uid() and database-owned membership rows. Caller role GUCs are ignored.';
COMMENT ON FUNCTION i1q.medical_governance_is_credentialed() IS
  'Fail-closed medical governance check. Credential and assignment evidence must be provisioned by a future authoritative adapter; this migration exposes no credential-minting path.';
COMMENT ON FUNCTION i1q.disable_i1q_behavior(text, text) IS
  'Trusted compensating mechanism. Disables all I1Q feature flags and appends one authoritative audit event per compensation ID.';

DO $initial_audit$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM i1q.audit_events event
     WHERE event.action = 'schema_candidate_initialized'
       AND event.entity_type = 'schema_version'
       AND event.entity_id = '20260715122434'
  ) THEN
    PERFORM i1q.append_audit_event(
      'schema_candidate_initialized',
      'schema_version',
      '20260715122434',
      pg_catalog.jsonb_build_object(
        'target', 'RANKLISTIQ',
        'schema', 'i1q',
        'offline_candidate', true,
        'runtime_role_dependency_resolved', false
      )
    );
  END IF;
END
$initial_audit$;

COMMIT;
