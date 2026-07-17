begin;

create schema if not exists cie;
revoke all on schema cie from public, anon, authenticated;

create table if not exists cie.sessions (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  external_session_ref text not null,
  mode_ref text not null,
  media_revision_ref text,
  clock jsonb not null,
  contract_version text not null default 'cie.c0.v1',
  created_at timestamptz not null default now(),
  unique (owner_user_id, external_session_ref),
  check (jsonb_typeof(clock) = 'object')
);

create table if not exists cie.consent_receipts (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references cie.sessions(id) on delete restrict,
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  purpose text not null check (purpose in ('evidence_storage','mentor_sharing','showcase_sharing','physiology_storage')),
  granted boolean not null,
  authority_ref text not null,
  policy_version text not null,
  policy_text_hash text not null check (policy_text_hash ~ '^[a-f0-9]{64}$'),
  locale text not null,
  retention_policy_ref text not null,
  scope jsonb not null,
  recorded_at timestamptz not null,
  expires_at timestamptz,
  supersedes_receipt_id uuid references cie.consent_receipts(id) on delete restrict,
  contract_version text not null default 'cie.c0.v1',
  created_at timestamptz not null default now()
);

create table if not exists cie.skill_snapshots (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  skill_id text not null,
  skill_version text not null,
  publication_seq bigint not null check (publication_seq > 0),
  full_card jsonb not null,
  render_subset jsonb not null,
  evidence_tier text not null check (evidence_tier in ('T1','T2','T3','T4')),
  source_authority jsonb not null,
  content_hash text not null check (content_hash ~ '^[a-f0-9]{64}$'),
  contract_version text not null default 'cie.c0.v1',
  created_at timestamptz not null default now(),
  unique (owner_user_id, skill_id, skill_version),
  unique (owner_user_id, skill_id, publication_seq),
  unique (owner_user_id, content_hash)
);

create table if not exists cie.track_items (
  track_item_id uuid not null,
  item_revision integer not null check (item_revision > 0),
  supersedes_item_revision integer,
  session_id uuid not null references cie.sessions(id) on delete restrict,
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  segment_id text not null,
  media_revision_ref text not null,
  kind text not null check (kind in ('media_ref','derived_signal','event','text','physio','moment','opportunity','priority','snapshot_ref')),
  range_kind text not null check (range_kind in ('POINT','SPAN')),
  t0_ms bigint not null check (t0_ms >= 0),
  t1_ms bigint not null check (t1_ms >= t0_ms),
  payload_schema_version text not null,
  payload jsonb not null,
  provenance jsonb not null,
  author jsonb not null,
  visibility text not null check (visibility in ('private','mentor','showcase')),
  consent_receipt_ids uuid[] not null default '{}',
  content_hash text not null check (content_hash ~ '^[a-f0-9]{64}$'),
  contract_version text not null default 'cie.c0.v1',
  created_at timestamptz not null default now(),
  primary key (track_item_id, item_revision),
  check ((range_kind = 'POINT' and t0_ms = t1_ms) or (range_kind = 'SPAN' and t1_ms > t0_ms)),
  check ((item_revision = 1 and supersedes_item_revision is null) or (item_revision > 1 and supersedes_item_revision = item_revision - 1))
);

create table if not exists cie.moments (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references cie.sessions(id) on delete restrict,
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  track_item_id uuid not null,
  track_item_revision integer not null,
  segment_id text not null,
  media_revision_ref text not null,
  t0_ms bigint not null check (t0_ms >= 0),
  t1_ms bigint not null check (t1_ms > t0_ms),
  source text not null check (source in ('student','mentor')),
  type text not null,
  label text not null,
  note text,
  skill_snapshot_ids uuid[] not null default '{}',
  visibility text not null check (visibility in ('private','mentor','showcase')),
  consent_receipt_ids uuid[] not null default '{}',
  provenance jsonb not null,
  author jsonb not null,
  contract_version text not null default 'cie.c0.v1',
  created_at timestamptz not null default now(),
  foreign key (track_item_id, track_item_revision) references cie.track_items(track_item_id, item_revision) on delete restrict
);

create table if not exists cie.session_priorities (
  session_id uuid primary key references cie.sessions(id) on delete restrict,
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  spotlight_snapshot_id uuid references cie.skill_snapshots(id) on delete restrict,
  supporting_snapshot_id uuid references cie.skill_snapshots(id) on delete restrict,
  row_version bigint not null default 1 check (row_version > 0),
  contract_version text not null default 'cie.c0.v1',
  updated_at timestamptz not null default now(),
  check (spotlight_snapshot_id is not null or supporting_snapshot_id is not null),
  check (spotlight_snapshot_id is null or supporting_snapshot_id is null or spotlight_snapshot_id <> supporting_snapshot_id)
);

create table if not exists cie.opportunities (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references cie.sessions(id) on delete restrict,
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  track_item_id uuid not null,
  track_item_revision integer not null,
  segment_id text not null,
  media_revision_ref text not null,
  skill_snapshot_id uuid not null references cie.skill_snapshots(id) on delete restrict,
  t0_ms bigint not null check (t0_ms >= 0),
  t1_ms bigint not null check (t1_ms > t0_ms),
  source text not null check (source = 'mentor-manual'),
  type text not null,
  evidence_note text not null,
  context jsonb not null,
  uncertainty text not null check (uncertainty in ('low','medium','high')),
  status text not null check (status = 'approved'),
  visibility text not null check (visibility = 'mentor'),
  consent_receipt_ids uuid[] not null default '{}',
  evidence_claim jsonb not null,
  coaching_claim jsonb not null,
  status_history jsonb not null,
  expires_at timestamptz,
  author jsonb not null,
  contract_version text not null default 'cie.c0.v1',
  created_at timestamptz not null default now(),
  foreign key (track_item_id, track_item_revision) references cie.track_items(track_item_id, item_revision) on delete restrict
);

create table if not exists cie.visibility_grants (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references cie.sessions(id) on delete restrict,
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  grantee_user_id uuid not null references auth.users(id) on delete restrict,
  scope text not null check (scope in ('mentor','showcase')),
  authority_ref text not null,
  granted_at timestamptz not null,
  revoked_at timestamptz,
  contract_version text not null default 'cie.c0.v1',
  check (grantee_user_id <> owner_user_id),
  check (revoked_at is null or revoked_at >= granted_at)
);

create table if not exists cie.audit_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references cie.sessions(id) on delete restrict,
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  event_type text not null,
  resource_type text not null,
  resource_id text not null,
  request_id text not null,
  correlation_id text not null,
  payload jsonb not null default '{}',
  occurred_at timestamptz not null default now(),
  contract_version text not null default 'cie.c0.v1'
);

create table if not exists cie.mutation_receipts (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  operation text not null,
  idempotency_key text not null,
  request_hash text not null check (request_hash ~ '^[a-f0-9]{64}$'),
  request_id text not null,
  correlation_id text not null,
  causation_id text,
  state text not null check (state in ('accepted','completed','failed_retryable','failed_terminal')),
  response jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_user_id, operation, idempotency_key)
);

create index if not exists cie_track_items_session_range_idx on cie.track_items (session_id, t0_ms, t1_ms, track_item_id, item_revision desc);
create index if not exists cie_moments_session_range_idx on cie.moments (session_id, t0_ms, t1_ms, id);
create index if not exists cie_opportunities_session_range_idx on cie.opportunities (session_id, t0_ms, t1_ms, id);
create index if not exists cie_consent_latest_idx on cie.consent_receipts (session_id, purpose, recorded_at desc, id desc);
create index if not exists cie_visibility_active_idx on cie.visibility_grants (session_id, grantee_user_id, scope) where revoked_at is null;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'sessions','consent_receipts','skill_snapshots','track_items','moments',
    'session_priorities','opportunities','visibility_grants','audit_events','mutation_receipts'
  ] loop
    execute format('alter table cie.%I enable row level security', table_name);
    execute format('alter table cie.%I force row level security', table_name);
    execute format('revoke all on cie.%I from public, anon, authenticated', table_name);
  end loop;
end $$;

-- C0 intentionally grants no direct authenticated table DML. Narrow SECURITY
-- DEFINER command/query functions are introduced by the follow-up API migration.
-- Applying this migration requires a target-specific release ticket.

commit;
