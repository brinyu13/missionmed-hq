-- I1Q-1008G import schema only. This file is not a migration and must not be executed by this ticket.
-- Target dialect: PostgreSQL 15 / Supabase-compatible PostgreSQL.
CREATE TABLE question_database (
  schema_version text NOT NULL CHECK (schema_version = 'missionmed.i1q.1008g.question-record.v1'),
  question_id text PRIMARY KEY CHECK (question_id ~ '^question_sha256_[a-f0-9]{64}$'),
  drill_id text NOT NULL CHECK (drill_id ~ '^drill_sha256_[a-f0-9]{64}$'),
  drill_order integer NOT NULL CHECK (drill_order BETWEEN 1 AND 97),
  drill_date date NULL,
  source_transcript text NOT NULL,
  source_nodes text NOT NULL,
  question_order integer NOT NULL CHECK (question_order > 0),
  student_sequence_id text NOT NULL CHECK (student_sequence_id ~ '^sequence_sha256_[a-f0-9]{64}$'),
  student_sequence_order integer NOT NULL CHECK (student_sequence_order > 0),
  question_order_in_sequence integer NOT NULL CHECK (question_order_in_sequence > 0),
  question_role text NOT NULL CHECK (question_role IN ('PRIMARY', 'FOLLOW_UP')),
  verbatim_question text NOT NULL CHECK (length(verbatim_question) > 0),
  minimally_normalized_question text NULL,
  timestamp_start_us bigint NOT NULL CHECK (timestamp_start_us >= 0),
  timestamp_end_us bigint NOT NULL CHECK (timestamp_end_us >= timestamp_start_us),
  specialty text NOT NULL,
  subject text NOT NULL,
  topic text NOT NULL,
  subtopic text NOT NULL,
  organ_system text NOT NULL,
  question_type text NOT NULL CHECK (question_type IN ('DIRECT_INTERROGATIVE', 'IMPERATIVE_MEDICAL_PROMPT')),
  cognitive_level text NOT NULL,
  confidence_ppm integer NOT NULL CHECK (confidence_ppm BETWEEN 0 AND 1000000),
  confidence_basis_codes jsonb NOT NULL CHECK (jsonb_typeof(confidence_basis_codes) = 'array'),
  ambiguity_flag boolean NOT NULL,
  ambiguity_flags jsonb NOT NULL CHECK (jsonb_typeof(ambiguity_flags) = 'array'),
  metadata_status text NOT NULL CHECK (metadata_status = 'SOURCE_METADATA_ABSENT_UNCLASSIFIED'),
  medical_question_status text NOT NULL,
  answer_binding_status text NOT NULL,
  transcript_hash text NOT NULL CHECK (transcript_hash ~ '^[a-f0-9]{64}$'),
  nodes_hash text NOT NULL CHECK (nodes_hash ~ '^[a-f0-9]{64}$'),
  transcript_binding_root text NOT NULL CHECK (transcript_binding_root ~ '^[a-f0-9]{64}$'),
  nodes_binding_root text NULL CHECK (nodes_binding_root IS NULL OR nodes_binding_root ~ '^[a-f0-9]{64}$'),
  question_provenance_hash text NOT NULL CHECK (question_provenance_hash ~ '^[a-f0-9]{64}$'),
  source_question_content_hash text NOT NULL CHECK (source_question_content_hash ~ '^[a-f0-9]{64}$'),
  processing_receipt jsonb NOT NULL,
  source_aliases jsonb NOT NULL,
  release_status text NOT NULL CHECK (release_status = 'RESTRICTED_ONLY'),
  record_hash text NOT NULL CHECK (record_hash ~ '^[a-f0-9]{64}$'),
  UNIQUE (drill_id, question_order)
);

CREATE INDEX question_database_drill_sequence_idx
  ON question_database (drill_order, student_sequence_order, question_order_in_sequence);
CREATE INDEX question_database_topic_idx ON question_database (topic);
CREATE INDEX question_database_specialty_idx ON question_database (specialty);
CREATE INDEX question_database_subject_idx ON question_database (subject);
CREATE INDEX question_database_organ_system_idx ON question_database (organ_system);

-- Deliberately absent: wording uniqueness, semantic uniqueness, deduplication, ontology FKs,
-- upsert conflict suppression, release grants, RLS changes, or production mutations.
