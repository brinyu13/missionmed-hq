begin;

create table public.ivoc_context_packs (
  id uuid primary key default extensions.gen_random_uuid(),
  session_id uuid not null references public.ivoc_sessions(id),
  pack_id uuid not null,
  owner_subject text not null check (owner_subject ~ '^wp:[1-9][0-9]{0,19}$'),
  schema_name text not null default 'ivoc.interview_context_pack.v1'
    check (schema_name = 'ivoc.interview_context_pack.v1'),
  schema_version integer not null default 1 check (schema_version = 1),
  pack_version text not null check (pack_version ~ '^[0-9a-f]{64}$'),
  rules_version text not null check (char_length(rules_version) between 1 and 120),
  practice_goal text not null check (practice_goal in ('full_simulation', 'guided_mock', 'individual_question')),
  program_ref text check (program_ref is null or char_length(program_ref) between 1 and 200),
  pool_snapshot_ref text not null check (char_length(pool_snapshot_ref) between 1 and 200),
  source_receipts jsonb not null default '[]'::jsonb check (jsonb_typeof(source_receipts) = 'array'),
  pack jsonb not null check (jsonb_typeof(pack) = 'object'),
  actor_block text not null check (octet_length(actor_block) <= 6144),
  built_at timestamptz not null,
  invalidated_at timestamptz,
  invalidation_reason text check (invalidation_reason is null or char_length(invalidation_reason) between 1 and 240),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (pack ->> 'schema_version' = '1'),
  check (pack ->> 'pack_id' = pack_id::text),
  check (pack ->> 'pack_version' = pack_version),
  check (pack ->> 'subject_id' = owner_subject),
  check (pack ->> 'actor_block' = actor_block),
  check (pack -> 'inputs' = source_receipts),
  unique (session_id, pack_version)
);

create unique index ivoc_context_packs_one_active_per_session_idx
  on public.ivoc_context_packs (session_id)
  where invalidated_at is null;
create index ivoc_context_packs_owner_built_idx
  on public.ivoc_context_packs (owner_subject, built_at desc);

create trigger ivoc_context_packs_touch_updated_at before update on public.ivoc_context_packs
for each row execute function public.ivoc_3528c_touch_updated_at();

alter table public.ivoc_context_packs enable row level security;
alter table public.ivoc_context_packs force row level security;

revoke all on table public.ivoc_context_packs from public, anon, authenticated, service_role;
grant select, insert, update on table public.ivoc_context_packs to service_role;

comment on table public.ivoc_context_packs is
  'Server-only IVOC Interview Context Packs and bounded actor blocks. Browser roles have no grants or policies.';

commit;
