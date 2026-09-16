begin;

create table public.ivoc_session_contracts (
  session_id uuid primary key references public.ivoc_sessions(id),
  schema_version integer not null default 1 check (schema_version = 1),
  actor_subject text not null check (actor_subject ~ '^wp:[1-9][0-9]{0,19}$'),
  role_context text not null check (role_context in ('student', 'admin', 'mentor')),
  practice_goal text not null check (practice_goal in ('full_simulation', 'guided_mock', 'individual_question')),
  pressure_modifier boolean not null default false,
  transport_profile text not null default 'none' check (transport_profile in ('none', 'A', 'B', 'C')),
  environment text not null default 'missionmed' check (
    environment in ('missionmed', 'webex_sim', 'zoom_sim', 'teams_sim', 'live_mock_studio')
  ),
  selection_policy text not null default 'system' check (
    selection_policy in ('system', 'randomized', 'preference_order', 'balanced')
  ),
  follow_up_intensity integer not null default 1 check (follow_up_intensity between 0 and 3),
  target_asked_count integer check (target_asked_count is null or target_asked_count > 0),
  target_duration_s integer check (target_duration_s is null or target_duration_s > 0),
  interviewer_config_ref text not null check (char_length(interviewer_config_ref) between 1 and 200),
  question_pool_ref text not null check (char_length(question_pool_ref) between 1 and 200),
  analytics_config_version text not null check (char_length(analytics_config_version) between 1 and 80),
  contract_state text not null default 'draft' check (
    contract_state in (
      'draft', 'ready_check', 'armed', 'live', 'ending', 'sealing',
      'processing', 'complete', 'abandoned', 'failed_processing', 'expired'
    )
  ),
  state_version integer not null default 0 check (state_version >= 0),
  clock jsonb not null default '{"origin":"capture_owner"}'::jsonb check (
    jsonb_typeof(clock) = 'object' and clock ->> 'origin' = 'capture_owner'
  ),
  context_receipts jsonb not null default '[]'::jsonb check (jsonb_typeof(context_receipts) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (practice_goal <> 'individual_question' or pressure_modifier = false)
);

create table public.ivoc_timeline_events (
  event_id text primary key check (char_length(event_id) between 1 and 160),
  session_id uuid not null references public.ivoc_sessions(id),
  seq bigint not null check (seq >= 0),
  schema_version integer not null default 1 check (schema_version = 1),
  source text not null check (source in (
    'client.orchestrator', 'client.analytics', 'client.recorder', 'client.ui',
    'server.brain', 'server.transport', 'server.transcription', 'server.projector',
    'admin.studio', 'fabric'
  )),
  event_type text not null check (char_length(event_type) between 1 and 120),
  t_wall timestamptz not null,
  t_media_ms bigint not null check (t_media_ms >= -1),
  reliability text not null check (reliability in ('measured', 'derived', 'provisional', 'canonical', 'synthetic')),
  availability text not null check (availability in ('ok', 'degraded', 'unavailable')),
  idempotency_key text check (idempotency_key is null or char_length(idempotency_key) between 1 and 200),
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  created_at timestamptz not null default now(),
  unique (session_id, seq)
);

create table public.ivoc_conversation_turns (
  turn_id text primary key check (char_length(turn_id) between 1 and 160),
  session_id uuid not null references public.ivoc_sessions(id),
  parent_turn_id text references public.ivoc_conversation_turns(turn_id),
  schema_version integer not null default 1 check (schema_version = 1),
  speaker text not null check (speaker in ('interviewer', 'student', 'admin_interviewer')),
  relation text not null check (relation in ('question', 'answer', 'follow_up', 'probe', 'interruption', 'aside', 'opening', 'closing')),
  t_start_ms bigint not null check (t_start_ms >= 0),
  t_end_ms bigint,
  transcript jsonb not null default '{}'::jsonb check (jsonb_typeof(transcript) = 'object'),
  question jsonb not null default '{}'::jsonb check (jsonb_typeof(question) = 'object'),
  semantic jsonb not null default '{}'::jsonb check (jsonb_typeof(semantic) = 'object'),
  interrupted jsonb check (interrupted is null or jsonb_typeof(interrupted) = 'object'),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (t_end_ms is null or t_end_ms >= t_start_ms)
);

create table public.ivoc_answer_segments (
  segment_id text primary key check (char_length(segment_id) between 1 and 160),
  session_id uuid not null references public.ivoc_sessions(id),
  subject_id text not null check (subject_id ~ '^wp:[1-9][0-9]{0,19}$'),
  schema_version integer not null default 1 check (schema_version = 1),
  transcript_ref text not null check (char_length(transcript_ref) between 1 and 240),
  media_ref text not null check (char_length(media_ref) between 1 and 240),
  question jsonb not null check (jsonb_typeof(question) = 'object'),
  answer jsonb not null check (jsonb_typeof(answer) = 'object'),
  coaching_notes_refs jsonb not null default '[]'::jsonb check (jsonb_typeof(coaching_notes_refs) = 'array'),
  scoring jsonb check (scoring is null or jsonb_typeof(scoring) = 'object'),
  strongest_marker jsonb check (strongest_marker is null or jsonb_typeof(strongest_marker) = 'object'),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ivoc_coaching_evidence (
  evidence_id text primary key check (char_length(evidence_id) between 1 and 160),
  session_id uuid not null references public.ivoc_sessions(id),
  subject_id text not null check (subject_id ~ '^wp:[1-9][0-9]{0,19}$'),
  schema_version integer not null default 1 check (schema_version = 1),
  dimension text not null check (char_length(dimension) between 1 and 120),
  refs jsonb not null check (jsonb_typeof(refs) = 'array' and jsonb_array_length(refs) > 0),
  interpretation jsonb not null check (jsonb_typeof(interpretation) = 'object'),
  score jsonb check (score is null or jsonb_typeof(score) = 'object'),
  confidence double precision check (confidence is null or confidence between 0 and 1),
  limitations jsonb not null default '[]'::jsonb check (jsonb_typeof(limitations) = 'array'),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index ivoc_session_contracts_actor_created_idx
  on public.ivoc_session_contracts (actor_subject, created_at desc);
create index ivoc_timeline_events_session_media_idx
  on public.ivoc_timeline_events (session_id, t_media_ms, seq);
create unique index ivoc_timeline_events_session_idempotency_idx
  on public.ivoc_timeline_events (session_id, idempotency_key)
  where idempotency_key is not null;
create index ivoc_conversation_turns_session_time_idx
  on public.ivoc_conversation_turns (session_id, t_start_ms, created_at);
create index ivoc_conversation_turns_parent_idx
  on public.ivoc_conversation_turns (parent_turn_id)
  where parent_turn_id is not null;
create index ivoc_answer_segments_session_created_idx
  on public.ivoc_answer_segments (session_id, created_at);
create index ivoc_coaching_evidence_session_dimension_idx
  on public.ivoc_coaching_evidence (session_id, dimension, created_at);

create trigger ivoc_session_contracts_touch_updated_at before update on public.ivoc_session_contracts
for each row execute function public.ivoc_3528c_touch_updated_at();
create trigger ivoc_conversation_turns_touch_updated_at before update on public.ivoc_conversation_turns
for each row execute function public.ivoc_3528c_touch_updated_at();
create trigger ivoc_answer_segments_touch_updated_at before update on public.ivoc_answer_segments
for each row execute function public.ivoc_3528c_touch_updated_at();
create trigger ivoc_coaching_evidence_touch_updated_at before update on public.ivoc_coaching_evidence
for each row execute function public.ivoc_3528c_touch_updated_at();

alter table public.ivoc_session_contracts enable row level security;
alter table public.ivoc_timeline_events enable row level security;
alter table public.ivoc_conversation_turns enable row level security;
alter table public.ivoc_answer_segments enable row level security;
alter table public.ivoc_coaching_evidence enable row level security;

revoke all on table public.ivoc_session_contracts from public, anon, authenticated;
revoke all on table public.ivoc_timeline_events from public, anon, authenticated;
revoke all on table public.ivoc_conversation_turns from public, anon, authenticated;
revoke all on table public.ivoc_answer_segments from public, anon, authenticated;
revoke all on table public.ivoc_coaching_evidence from public, anon, authenticated;

grant select, insert, update on table public.ivoc_session_contracts to service_role;
grant select, insert on table public.ivoc_timeline_events to service_role;
grant select, insert, update on table public.ivoc_conversation_turns to service_role;
grant select, insert, update on table public.ivoc_answer_segments to service_role;
grant select, insert, update on table public.ivoc_coaching_evidence to service_role;

comment on table public.ivoc_session_contracts is
  'IVOC session.v1 control-plane fields separated from the legacy session summary for additive rollout.';
comment on table public.ivoc_timeline_events is
  'Append-only IVOC event spine ordered by the capture-owner media clock.';
comment on table public.ivoc_conversation_turns is
  'Versioned semantic conversation turns with provisional and canonical transcript references.';
comment on table public.ivoc_answer_segments is
  'Question-and-answer segments linked to canonical transcript and private media references.';
comment on table public.ivoc_coaching_evidence is
  'Evidence-grounded coaching records; no biometric identity templates or unsupported inference.';

commit;
