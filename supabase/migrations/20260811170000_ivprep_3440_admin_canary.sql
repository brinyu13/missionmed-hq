-- Y1-Y2-CAM-V6-3440 offline-only schema candidate.
-- DR-052 prohibits applying this migration until a later exact database decision.

create table if not exists public.ivprep_entitlements (
  subject text primary key check (subject ~ '^wp:[1-9][0-9]{0,19}$'),
  revision text not null check (revision ~ '^[A-Za-z0-9._:-]{1,80}$'),
  founder boolean not null default false,
  voice_enabled boolean not null default false,
  video_enabled boolean not null default false,
  granted_video_seconds bigint not null default 0 check (granted_video_seconds >= 0),
  consumed_video_seconds bigint not null default 0 check (consumed_video_seconds >= 0),
  reserved_video_seconds bigint not null default 0 check (reserved_video_seconds >= 0),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (consumed_video_seconds + reserved_video_seconds <= granted_video_seconds)
);

create table if not exists public.ivprep_cookie_revocations (
  cookie_fingerprint text primary key check (cookie_fingerprint ~ '^[a-f0-9]{64}$'),
  reason text not null check (char_length(reason) between 1 and 40),
  revoked_at timestamptz not null default now(),
  expires_at timestamptz not null,
  check (expires_at > revoked_at)
);

create table if not exists public.ivprep_interview_bindings (
  interview_id text primary key check (interview_id ~ '^[A-Za-z0-9._:-]{1,120}$'),
  subject text not null references public.ivprep_entitlements(subject) on update restrict on delete restrict,
  cookie_fingerprint text not null check (cookie_fingerprint ~ '^[a-f0-9]{64}$'),
  entitlement_revision text not null check (entitlement_revision ~ '^[A-Za-z0-9._:-]{1,80}$'),
  termination_requested boolean not null default false,
  termination_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (termination_reason is null or char_length(termination_reason) between 1 and 40)
);

create table if not exists public.ivprep_provider_reservations (
  reservation_id text primary key check (reservation_id ~ '^[A-Za-z0-9._:-]{1,120}$'),
  interview_id text not null unique references public.ivprep_interview_bindings(interview_id) on update restrict on delete restrict,
  subject text not null references public.ivprep_entitlements(subject) on update restrict on delete restrict,
  test_number smallint check (test_number between 1 and 3),
  reserved_seconds integer not null check (reserved_seconds between 1 and 59),
  consumed_seconds integer not null default 0 check (consumed_seconds between 0 and 59),
  refunded_seconds integer not null default 0 check (refunded_seconds between 0 and 59),
  state text not null check (state in ('RESERVED', 'PROVIDER_BOUND', 'CLOSED', 'TERMINATION_UNCONFIRMED')),
  dispatch_id text,
  provider_session_hash text check (provider_session_hash is null or provider_session_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  terminal_at timestamptz,
  check (consumed_seconds + refunded_seconds <= reserved_seconds),
  check ((dispatch_id is null) = (provider_session_hash is null))
);

create unique index if not exists ivprep_provider_reservations_dispatch_unique
  on public.ivprep_provider_reservations (dispatch_id) where dispatch_id is not null;
create unique index if not exists ivprep_provider_reservations_session_unique
  on public.ivprep_provider_reservations (provider_session_hash) where provider_session_hash is not null;

create table if not exists public.ivprep_idempotency (
  idempotency_hash text primary key check (idempotency_hash ~ '^[a-f0-9]{64}$'),
  subject text not null references public.ivprep_entitlements(subject) on update restrict on delete restrict,
  operation text not null check (operation in ('interview_start', 'interview_end', 'provider_reserve', 'provider_reconcile')),
  request_hash text not null check (request_hash ~ '^[a-f0-9]{64}$'),
  response_reference text check (response_reference is null or response_reference ~ '^[A-Za-z0-9._:-]{1,120}$'),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  check (expires_at > created_at)
);

alter table public.ivprep_entitlements enable row level security;
alter table public.ivprep_entitlements force row level security;
alter table public.ivprep_cookie_revocations enable row level security;
alter table public.ivprep_cookie_revocations force row level security;
alter table public.ivprep_interview_bindings enable row level security;
alter table public.ivprep_interview_bindings force row level security;
alter table public.ivprep_provider_reservations enable row level security;
alter table public.ivprep_provider_reservations force row level security;
alter table public.ivprep_idempotency enable row level security;
alter table public.ivprep_idempotency force row level security;

revoke all on table public.ivprep_entitlements from public, anon, authenticated;
revoke all on table public.ivprep_cookie_revocations from public, anon, authenticated;
revoke all on table public.ivprep_interview_bindings from public, anon, authenticated;
revoke all on table public.ivprep_provider_reservations from public, anon, authenticated;
revoke all on table public.ivprep_idempotency from public, anon, authenticated;

grant select, insert, update, delete on table public.ivprep_entitlements to service_role;
grant select, insert, update, delete on table public.ivprep_cookie_revocations to service_role;
grant select, insert, update, delete on table public.ivprep_interview_bindings to service_role;
grant select, insert, update, delete on table public.ivprep_provider_reservations to service_role;
grant select, insert, update, delete on table public.ivprep_idempotency to service_role;

comment on table public.ivprep_entitlements is 'IV Prep server-side entitlement ledger; no browser access.';
comment on table public.ivprep_cookie_revocations is 'Domain-separated HQ cookie fingerprints only; never raw cookies.';
comment on table public.ivprep_interview_bindings is 'WP subject, cookie fingerprint, and entitlement revision ownership binding.';
comment on table public.ivprep_provider_reservations is 'Single-dispatch paid-provider reservation and terminal reconciliation ledger.';
comment on table public.ivprep_idempotency is 'Hashed server-side idempotency records; never raw authorization material.';
