begin;

create schema if not exists i1q;

create or replace function i1q.session_actor_id()
returns text
language sql
stable
as $$
  select nullif(current_setting('app.actor_id', true), '')
$$;

create or replace function i1q.session_has_role(required_role text)
returns boolean
language sql
stable
as $$
  select coalesce(
    required_role = any(string_to_array(nullif(current_setting('app.actor_roles', true), ''), ',')),
    false
  )
$$;

create or replace function i1q.reject_immutable_change()
returns trigger
language plpgsql
as $$
begin
  raise exception 'immutable_record:%', tg_table_name using errcode = '55000';
end
$$;

create table if not exists i1q.governance_slots (
  slot text primary key,
  reviewer_id text,
  assigned_by text,
  assigned_at timestamptz,
  check (slot in (
    'medical_governance_lead',
    'editorial_lead',
    'taxonomy_owner',
    'misconception_vocabulary_owner',
    'release_manager',
    'incident_owner',
    'privacy_owner',
    'assessment_science_owner'
  ))
);

insert into i1q.governance_slots (slot)
values
  ('medical_governance_lead'),
  ('editorial_lead'),
  ('taxonomy_owner'),
  ('misconception_vocabulary_owner'),
  ('release_manager'),
  ('incident_owner'),
  ('privacy_owner'),
  ('assessment_science_owner')
on conflict (slot) do nothing;

create table if not exists i1q.taxonomy_versions (
  id text primary key,
  version text not null unique,
  status text not null check (status in ('draft', 'ratified', 'retired')),
  content jsonb not null,
  content_hash text not null check (content_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  created_by text not null
);

create table if not exists i1q.blueprint_versions (
  id text primary key,
  version text not null unique,
  taxonomy_version_id text not null references i1q.taxonomy_versions(id),
  status text not null check (status in ('draft', 'ratified', 'retired')),
  content jsonb not null,
  content_hash text not null check (content_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  created_by text not null
);

create table if not exists i1q.misconception_vocabulary_versions (
  id text primary key,
  version text not null unique,
  status text not null check (status in ('draft', 'ratified', 'retired')),
  entries jsonb not null,
  content_hash text not null check (content_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  created_by text not null
);

create table if not exists i1q.channel_security_policies (
  id text primary key,
  channel text not null unique,
  phase text not null check (phase in ('pre_answer', 'post_answer', 'server_only', 'internal')),
  allowed_fields jsonb not null,
  forbidden_fields jsonb not null,
  content_hash text not null check (content_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  created_by text not null
);

create table if not exists i1q.concepts (
  id text primary key,
  taxonomy_version_id text not null references i1q.taxonomy_versions(id),
  canonical_name text not null,
  subject_tags text[] not null default '{}',
  topic_tags text[] not null default '{}',
  system_tags text[] not null default '{}',
  lifecycle text not null check (lifecycle in ('active', 'retired')),
  replacement_concept_id text references i1q.concepts(id),
  content_hash text not null check (content_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  created_by text not null
);

create table if not exists i1q.variant_groups (
  id text primary key,
  concept_id text not null references i1q.concepts(id),
  variant_form text not null check (variant_form in ('drj_short', 'recall', 'vignette')),
  invariant_teaching_point text not null,
  lifecycle text not null check (lifecycle in ('active', 'retired')),
  content_hash text not null check (content_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  created_by text not null
);

create table if not exists i1q.items (
  id text primary key,
  variant_group_id text not null references i1q.variant_groups(id),
  item_type text not null check (item_type = 'single_best_answer'),
  lifecycle text not null check (lifecycle in ('active', 'retired')),
  retired_at timestamptz,
  retirement_reason text,
  replacement_item_id text references i1q.items(id),
  created_at timestamptz not null default now(),
  created_by text not null
);

create table if not exists i1q.rights_records (
  id text primary key,
  source_authority text not null,
  rights_status text not null check (rights_status in ('unverified', 'cleared_for', 'restricted', 'expired')),
  allowed_uses text[] not null default '{}',
  expires_at timestamptz,
  evidence_ref text,
  created_at timestamptz not null default now(),
  created_by text not null
);

create table if not exists i1q.privacy_redaction_records (
  id text primary key,
  status text not null check (status in ('pass', 'pass_with_redactions', 'blocked')),
  required_class_metrics jsonb not null,
  raw_hash text not null check (raw_hash ~ '^[0-9a-f]{64}$'),
  working_hash text not null check (working_hash ~ '^[0-9a-f]{64}$'),
  reviewer_id text,
  created_at timestamptz not null default now(),
  created_by text not null
);

create table if not exists i1q.source_records (
  id text primary key,
  source_type text not null check (source_type in ('DRJ_TRANSCRIPT', 'DRJ_NOTES', 'REVIEWER_AUTHORED', 'AI_DRAFT', 'LEGACY_V4', 'PUBLIC_BLUEPRINT')),
  canonical_source_id text not null,
  title text not null,
  video_id text,
  start_time_seconds numeric,
  end_time_seconds numeric,
  source_hash text not null check (source_hash ~ '^[0-9a-f]{64}$'),
  rights_record_id text not null references i1q.rights_records(id),
  privacy_redaction_record_id text references i1q.privacy_redaction_records(id),
  private_storage_ref text,
  created_at timestamptz not null default now(),
  created_by text not null,
  unique (source_type, canonical_source_id, source_hash)
);

create table if not exists i1q.evidence_claims (
  id text primary key,
  claim_text text not null,
  authority_class text not null check (authority_class in ('major_guideline', 'standard_reference', 'landmark_evidence', 'physician_attested')),
  status text not null check (status in ('draft', 'verified', 'aging', 'expired', 'conflicted', 'superseded', 'retracted')),
  source_record_ids text[] not null,
  reviewed_at timestamptz,
  expires_at timestamptz,
  supersedes_claim_id text references i1q.evidence_claims(id),
  content_hash text not null check (content_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  created_by text not null
);

create table if not exists i1q.item_revisions (
  id text primary key,
  item_id text not null references i1q.items(id),
  revision_number integer not null check (revision_number > 0),
  author_actor_id text not null,
  workflow_status text not null default 'draft' check (workflow_status = 'draft'),
  medical_validation_status text not null check (medical_validation_status = 'AI_DRAFT_NOT_MEDICALLY_VALIDATED'),
  concept_id text not null references i1q.concepts(id),
  source_record_ids text[] not null,
  evidence_claim_ids text[] not null default '{}',
  prompt text not null,
  choice_a jsonb not null,
  choice_b jsonb not null,
  choice_c jsonb not null,
  choice_d jsonb not null,
  answer char(1) not null check (answer in ('A', 'B', 'C', 'D')),
  explanation text not null,
  correct_answer_rationale text not null,
  classification jsonb not null,
  content_hash text not null check (content_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  unique (item_id, revision_number),
  unique (item_id, content_hash)
);

create table if not exists i1q.model_prompt_versions (
  id text primary key,
  task text not null,
  model_identifier text not null,
  prompt_hash text not null check (prompt_hash ~ '^[0-9a-f]{64}$'),
  parameters jsonb not null,
  retired_at timestamptz,
  created_at timestamptz not null default now(),
  created_by text not null
);

create table if not exists i1q.extraction_runs (
  id text primary key,
  source_record_id text not null references i1q.source_records(id),
  model_prompt_version_id text references i1q.model_prompt_versions(id),
  pipeline_version text not null,
  current_stage text not null,
  state text not null check (state in ('queued', 'running', 'blocked', 'failed', 'completed')),
  input_hash text not null check (input_hash ~ '^[0-9a-f]{64}$'),
  output_hash text check (output_hash is null or output_hash ~ '^[0-9a-f]{64}$'),
  metrics jsonb not null default '{}',
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists i1q.reviewers (
  id text primary key,
  actor_id text not null unique,
  display_name text not null,
  roles text[] not null,
  credential_type text,
  credential_status text,
  credential_expires_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by text not null
);

alter table i1q.governance_slots
  add constraint governance_slots_reviewer_fk
  foreign key (reviewer_id) references i1q.reviewers(id) not valid;

create table if not exists i1q.review_assignments (
  id text primary key,
  item_revision_id text not null references i1q.item_revisions(id),
  reviewer_id text not null references i1q.reviewers(id),
  review_type text not null check (review_type in ('editorial', 'medical')),
  state text not null check (state in ('open', 'accepted', 'completed', 'expired', 'reassigned')),
  assigned_by text not null,
  due_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists i1q.review_events (
  id text primary key,
  item_revision_id text not null references i1q.item_revisions(id),
  assignment_id text not null references i1q.review_assignments(id),
  reviewer_id text not null references i1q.reviewers(id),
  review_type text not null check (review_type in ('editorial', 'medical')),
  verdict text not null check (verdict in ('pass', 'needs_revision', 'fail')),
  from_status text not null,
  to_status text not null,
  exact_revision_hash text not null check (exact_revision_hash ~ '^[0-9a-f]{64}$'),
  structured_findings jsonb not null default '{}',
  sequence integer not null check (sequence > 0),
  occurred_at timestamptz not null default now(),
  unique (item_revision_id, sequence)
);

create table if not exists i1q.reviewer_calibration_records (
  id text primary key,
  reviewer_id text not null references i1q.reviewers(id),
  calibration_set_id text not null,
  score numeric not null check (score between 0 and 1),
  status text not null check (status in ('current', 'expired', 'suspended')),
  calibrated_at timestamptz not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists i1q.incident_records (
  id text primary key,
  severity text not null check (severity in ('S1', 'S2', 'S3', 'S4')),
  state text not null check (state in ('open', 'contained', 'correcting', 'resolved')),
  affected_item_revision_ids text[] not null default '{}',
  affected_release_ids text[] not null default '{}',
  owner_id text,
  summary text not null,
  corrective_release_id text,
  opened_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists i1q.release_snapshots (
  id text primary key,
  dataset_version text not null unique,
  state text not null check (state = 'assembled'),
  item_revision_ids text[] not null,
  previous_manifest_hash text check (previous_manifest_hash is null or previous_manifest_hash ~ '^[0-9a-f]{64}$'),
  manifest_hash text not null unique check (manifest_hash ~ '^[0-9a-f]{64}$'),
  manifest jsonb not null,
  created_at timestamptz not null default now(),
  created_by text not null
);

create table if not exists i1q.release_promotion_records (
  id text primary key,
  release_id text not null references i1q.release_snapshots(id),
  from_state text not null,
  to_state text not null,
  actor_id text not null,
  manifest_hash text not null check (manifest_hash ~ '^[0-9a-f]{64}$'),
  sequence integer not null check (sequence > 0),
  occurred_at timestamptz not null default now(),
  unique (release_id, sequence)
);

create table if not exists i1q.channel_artifacts (
  id text primary key,
  release_id text not null references i1q.release_snapshots(id),
  channel text not null,
  phase text not null check (phase in ('pre_answer', 'post_answer', 'server_only', 'internal', 'contract_only')),
  object_ref text,
  media_type text not null,
  record_count integer not null check (record_count >= 0),
  artifact_hash text not null check (artifact_hash ~ '^[0-9a-f]{64}$'),
  payload jsonb,
  created_at timestamptz not null default now(),
  unique (release_id, channel)
);

create table if not exists i1q.psychometric_snapshots (
  id text primary key,
  item_revision_id text not null references i1q.item_revisions(id),
  sample_window_start timestamptz not null,
  sample_window_end timestamptz not null,
  attempt_count integer not null check (attempt_count >= 0),
  difficulty numeric,
  discrimination numeric,
  distractor_metrics jsonb not null default '{}',
  privacy_floor_applied boolean not null default true,
  content_hash text not null check (content_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now()
);

create table if not exists i1q.inventory_sources (
  id text primary key,
  canonical_video_id text not null,
  title text not null,
  collection_name text,
  duration_seconds numeric,
  recording_date date,
  transcript_available boolean not null default false,
  vtt_available boolean not null default false,
  nodes_available boolean not null default false,
  source_hash text check (source_hash is null or source_hash ~ '^[0-9a-f]{64}$'),
  rights_status text not null,
  privacy_status text not null,
  likely_drj_confidence numeric check (likely_drj_confidence is null or likely_drj_confidence between 0 and 1),
  drj_verification_status text not null default 'unknown',
  extraction_suitability text not null,
  duplicate_of_id text references i1q.inventory_sources(id),
  source_authority text not null,
  currentness text not null,
  created_at timestamptz not null default now(),
  unique (source_authority, canonical_video_id)
);

create table if not exists i1q.transcript_artifacts (
  id text primary key,
  inventory_source_id text not null references i1q.inventory_sources(id),
  format text not null,
  source_hash text not null check (source_hash ~ '^[0-9a-f]{64}$'),
  private_storage_ref text not null,
  segment_count integer not null check (segment_count >= 0),
  timestamp_coverage numeric check (timestamp_coverage between 0 and 1),
  speaker_labels_available boolean not null default false,
  rights_status text not null,
  privacy_status text not null,
  created_at timestamptz not null default now(),
  unique (inventory_source_id, source_hash)
);

create table if not exists i1q.normalized_transcript_segments (
  id text primary key,
  transcript_artifact_id text not null references i1q.transcript_artifacts(id),
  video_id text not null,
  speaker text not null,
  speaker_confidence numeric not null check (speaker_confidence between 0 and 1),
  redacted_text text not null,
  start_time_seconds numeric not null,
  end_time_seconds numeric not null,
  source_hash text not null check (source_hash ~ '^[0-9a-f]{64}$'),
  working_hash text not null check (working_hash ~ '^[0-9a-f]{64}$'),
  node_links jsonb not null default '[]',
  privacy_flags text[] not null default '{}',
  rights_flags text[] not null default '{}',
  created_at timestamptz not null default now(),
  check (end_time_seconds >= start_time_seconds)
);

create table if not exists i1q.extraction_candidates (
  id text primary key,
  extraction_run_id text not null references i1q.extraction_runs(id),
  source_segment_id text not null references i1q.normalized_transcript_segments(id),
  source_wording text not null,
  cleaned_wording text not null,
  question_timestamp_seconds numeric not null,
  answer_timestamp_seconds numeric,
  detected_answer_wording text,
  answer_source_type text not null,
  confidence numeric not null check (confidence between 0 and 1),
  lineage text not null check (lineage = 'AI_DRAFT_NOT_MEDICALLY_VALIDATED'),
  state text not null check (state in ('candidate', 'quarantined', 'rejected', 'promoted_to_item')),
  warnings jsonb not null default '[]',
  candidate_hash text not null check (candidate_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  unique (extraction_run_id, source_segment_id, candidate_hash)
);

create table if not exists i1q.candidate_quality_flags (
  id text primary key,
  extraction_candidate_id text not null references i1q.extraction_candidates(id),
  code text not null,
  severity text not null check (severity in ('info', 'warning', 'blocking')),
  detail jsonb not null default '{}',
  resolved_at timestamptz,
  resolved_by text,
  created_at timestamptz not null default now()
);

create table if not exists i1q.batch_jobs (
  id text primary key,
  job_type text not null,
  state text not null check (state in ('queued', 'running', 'retry_wait', 'blocked', 'dead_letter', 'completed')),
  idempotency_key_hash text not null unique check (idempotency_key_hash ~ '^[0-9a-f]{64}$'),
  cursor jsonb,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  max_attempts integer not null default 5 check (max_attempts > 0),
  next_attempt_at timestamptz,
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists i1q.job_checkpoints (
  id text primary key,
  batch_job_id text not null references i1q.batch_jobs(id),
  sequence integer not null check (sequence >= 0),
  cursor jsonb not null,
  state_hash text not null check (state_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  unique (batch_job_id, sequence)
);

create table if not exists i1q.import_maps (
  id text primary key,
  import_type text not null,
  source_key text not null,
  target_entity_type text not null,
  target_entity_id text not null,
  source_content_hash text not null check (source_content_hash ~ '^[0-9a-f]{64}$'),
  historical_join_keys jsonb not null,
  created_at timestamptz not null default now(),
  unique (import_type, source_key)
);

create table if not exists i1q.export_validation_results (
  id text primary key,
  release_id text not null references i1q.release_snapshots(id),
  validator_id text not null,
  status text not null check (status in ('pass', 'fail', 'blocked')),
  findings jsonb not null,
  artifact_hash text not null check (artifact_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  unique (release_id, validator_id, artifact_hash)
);

create table if not exists i1q.feature_flags (
  id text primary key,
  key text not null unique,
  enabled boolean not null default false,
  scope jsonb not null default '{}',
  changed_by text not null,
  changed_at timestamptz not null default now()
);

insert into i1q.feature_flags (id, key, enabled, changed_by)
values
  ('flag_internal_platform', 'internal_platform_enabled', false, 'migration'),
  ('flag_stat_adapter', 'stat_adapter_enabled', false, 'migration'),
  ('flag_drills_adapter', 'drills_adapter_enabled', false, 'migration'),
  ('flag_student_release', 'student_release_enabled', false, 'migration')
on conflict (key) do nothing;

create table if not exists i1q.audit_events (
  id text primary key,
  actor_id text not null,
  action text not null,
  entity_type text not null,
  entity_id text not null,
  previous_hash text check (previous_hash is null or previous_hash ~ '^[0-9a-f]{64}$'),
  event_hash text not null unique check (event_hash ~ '^[0-9a-f]{64}$'),
  payload jsonb not null default '{}',
  occurred_at timestamptz not null default now()
);

create table if not exists i1q.api_idempotency_keys (
  id text primary key,
  actor_id text not null,
  request_key_hash text not null check (request_key_hash ~ '^[0-9a-f]{64}$'),
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  response_hash text check (response_hash is null or response_hash ~ '^[0-9a-f]{64}$'),
  state text not null check (state in ('started', 'completed', 'failed')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (actor_id, request_key_hash)
);

create index if not exists concepts_subject_tags_gin on i1q.concepts using gin(subject_tags);
create index if not exists concepts_topic_tags_gin on i1q.concepts using gin(topic_tags);
create index if not exists concepts_system_tags_gin on i1q.concepts using gin(system_tags);
create index if not exists item_revisions_item_created on i1q.item_revisions(item_id, created_at desc);
create index if not exists evidence_claims_status_expiry on i1q.evidence_claims(status, expires_at);
create index if not exists review_assignments_queue on i1q.review_assignments(state, review_type, due_at);
create index if not exists review_events_revision_sequence on i1q.review_events(item_revision_id, sequence);
create index if not exists inventory_sources_suitability on i1q.inventory_sources(extraction_suitability, rights_status, privacy_status);
create index if not exists transcript_segments_artifact_time on i1q.normalized_transcript_segments(transcript_artifact_id, start_time_seconds);
create index if not exists extraction_candidates_queue on i1q.extraction_candidates(state, confidence desc);
create index if not exists batch_jobs_queue on i1q.batch_jobs(state, next_attempt_at, created_at);
create index if not exists incidents_state_severity on i1q.incident_records(state, severity, opened_at);
create index if not exists audit_events_entity on i1q.audit_events(entity_type, entity_id, occurred_at);

create trigger item_revisions_immutable
before update or delete on i1q.item_revisions
for each row execute function i1q.reject_immutable_change();

create trigger review_events_immutable
before update or delete on i1q.review_events
for each row execute function i1q.reject_immutable_change();

create trigger release_snapshots_immutable
before update or delete on i1q.release_snapshots
for each row execute function i1q.reject_immutable_change();

create trigger release_promotions_immutable
before update or delete on i1q.release_promotion_records
for each row execute function i1q.reject_immutable_change();

create trigger channel_artifacts_immutable
before update or delete on i1q.channel_artifacts
for each row execute function i1q.reject_immutable_change();

create trigger audit_events_immutable
before update or delete on i1q.audit_events
for each row execute function i1q.reject_immutable_change();

do $$
declare
  table_name text;
  protected_tables text[] := array['source_records', 'transcript_artifacts'];
  all_tables text[] := array[
    'governance_slots', 'taxonomy_versions', 'blueprint_versions',
    'misconception_vocabulary_versions', 'channel_security_policies',
    'concepts', 'variant_groups', 'items', 'item_revisions', 'rights_records',
    'privacy_redaction_records', 'source_records', 'evidence_claims',
    'model_prompt_versions', 'extraction_runs', 'reviewers', 'review_assignments',
    'review_events', 'reviewer_calibration_records', 'incident_records',
    'release_snapshots', 'release_promotion_records', 'channel_artifacts',
    'psychometric_snapshots', 'inventory_sources', 'transcript_artifacts',
    'normalized_transcript_segments', 'extraction_candidates',
    'candidate_quality_flags', 'batch_jobs', 'job_checkpoints', 'import_maps',
    'export_validation_results', 'feature_flags', 'audit_events',
    'api_idempotency_keys'
  ];
begin
  foreach table_name in array all_tables loop
    execute format('alter table i1q.%I enable row level security', table_name);
    execute format('alter table i1q.%I force row level security', table_name);
    if table_name = any(protected_tables) then
      execute format(
        'create policy %I on i1q.%I for select using (i1q.session_has_role(''privacy_officer'') or i1q.session_has_role(''platform_admin'') or i1q.session_has_role(''system''))',
        table_name || '_protected_read', table_name
      );
    else
      execute format(
        'create policy %I on i1q.%I for select using (i1q.session_actor_id() is not null)',
        table_name || '_internal_read', table_name
      );
    end if;
    execute format(
      'create policy %I on i1q.%I for insert with check (i1q.session_has_role(''platform_admin'') or i1q.session_has_role(''system''))',
      table_name || '_admin_insert', table_name
    );
    execute format(
      'create policy %I on i1q.%I for update using (i1q.session_has_role(''platform_admin'') or i1q.session_has_role(''system'')) with check (i1q.session_has_role(''platform_admin'') or i1q.session_has_role(''system''))',
      table_name || '_admin_update', table_name
    );
  end loop;
end
$$;

comment on schema i1q is 'MissionMed I1Q Question Platform candidate schema. No client grants are made by this migration.';
comment on table i1q.item_revisions is 'Immutable exact question revision. Answer-bearing data is internal only.';
comment on table i1q.release_snapshots is 'Immutable single-manifest release snapshot from which all channel artifacts derive.';
comment on table i1q.normalized_transcript_segments is 'Redacted working transcript only. Raw transcript content is never stored here.';

commit;
