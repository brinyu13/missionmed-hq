begin;

-- Forward-only integrity amendment. The foundation migration remains historical
-- evidence; this migration must be applied in the same gated release before CIE
-- accepts any writes.

alter table cie.sessions
  add column state text not null default 'DRAFT',
  add column row_version bigint not null default 1,
  add column next_event_seq bigint not null default 0;
alter table cie.sessions
  add constraint cie_sessions_state_check check (state in ('DRAFT','CAPTURING','SEALED','DELETING','DELETED')),
  add constraint cie_sessions_row_version_check check (row_version > 0),
  add constraint cie_sessions_event_seq_check check (next_event_seq >= 0),
  add constraint cie_sessions_id_owner_unique unique (id, owner_user_id);

alter table cie.consent_receipts add column receipt_revision bigint;
with ranked as (
  select id, row_number() over (partition by session_id, purpose order by recorded_at, id) as revision
  from cie.consent_receipts
)
update cie.consent_receipts receipt
set receipt_revision = ranked.revision
from ranked
where ranked.id = receipt.id;
alter table cie.consent_receipts alter column receipt_revision set not null;
alter table cie.consent_receipts
  add constraint cie_consent_revision_check check (receipt_revision > 0),
  add constraint cie_consent_revision_unique unique (session_id, purpose, receipt_revision),
  add constraint cie_consent_id_session_owner_unique unique (id, session_id, owner_user_id),
  add constraint cie_consent_session_owner_fk foreign key (session_id, owner_user_id) references cie.sessions(id, owner_user_id) on delete restrict;

alter table cie.skill_snapshots
  add constraint cie_skill_snapshot_id_owner_unique unique (id, owner_user_id);

alter table cie.track_items add column event_seq bigint;
with ranked as (
  select track_item_id, item_revision,
         row_number() over (partition by session_id order by created_at, track_item_id, item_revision) as event_seq
  from cie.track_items
)
update cie.track_items item
set event_seq = ranked.event_seq
from ranked
where ranked.track_item_id = item.track_item_id and ranked.item_revision = item.item_revision;
alter table cie.track_items alter column event_seq set not null;
alter table cie.track_items
  add constraint cie_track_event_seq_check check (event_seq > 0),
  add constraint cie_track_event_seq_unique unique (session_id, event_seq),
  add constraint cie_track_session_owner_fk foreign key (session_id, owner_user_id) references cie.sessions(id, owner_user_id) on delete restrict;

alter table cie.moments
  add column content_hash text not null,
  add constraint cie_moment_hash_check check (content_hash ~ '^[a-f0-9]{64}$'),
  add constraint cie_moment_id_session_owner_unique unique (id, session_id, owner_user_id),
  add constraint cie_moment_session_owner_fk foreign key (session_id, owner_user_id) references cie.sessions(id, owner_user_id) on delete restrict;

alter table cie.session_priorities
  add column spotlight_lifecycle text not null default 'ACTIVE_SPOTLIGHT',
  add column supporting_lifecycle text,
  add column track_item_id uuid not null,
  add column track_item_revision integer not null,
  add column consent_receipt_id uuid not null,
  add constraint cie_priority_spotlight_lifecycle_check check (spotlight_lifecycle = 'ACTIVE_SPOTLIGHT'),
  add constraint cie_priority_supporting_lifecycle_check check (supporting_lifecycle is null or supporting_lifecycle = 'CONSOLIDATING'),
  add constraint cie_priority_session_owner_fk foreign key (session_id, owner_user_id) references cie.sessions(id, owner_user_id) on delete restrict,
  add constraint cie_priority_track_fk foreign key (track_item_id, track_item_revision) references cie.track_items(track_item_id, item_revision) on delete restrict,
  add constraint cie_priority_consent_fk foreign key (consent_receipt_id, session_id, owner_user_id) references cie.consent_receipts(id, session_id, owner_user_id) on delete restrict;

alter table cie.opportunities
  add column source_moment_id uuid not null,
  add column reviewer jsonb not null,
  add column student_visible boolean not null default false,
  add column content_hash text not null,
  add constraint cie_opportunity_student_hidden_check check (student_visible = false),
  add constraint cie_opportunity_hash_check check (content_hash ~ '^[a-f0-9]{64}$'),
  add constraint cie_opportunity_session_owner_fk foreign key (session_id, owner_user_id) references cie.sessions(id, owner_user_id) on delete restrict,
  add constraint cie_opportunity_snapshot_owner_fk foreign key (skill_snapshot_id, owner_user_id) references cie.skill_snapshots(id, owner_user_id) on delete restrict,
  add constraint cie_opportunity_source_moment_fk foreign key (source_moment_id, session_id, owner_user_id) references cie.moments(id, session_id, owner_user_id) on delete restrict;

alter table cie.visibility_grants drop constraint if exists visibility_grants_scope_check;
alter table cie.visibility_grants
  add column artifact_type text not null,
  add column artifact_id text not null,
  add column consent_receipt_id uuid not null,
  add column expires_at timestamptz,
  add column row_version bigint not null default 1,
  add column content_hash text not null,
  add constraint cie_visibility_scope_check check (scope in ('review','showcase','physiology')),
  add constraint cie_visibility_artifact_check check (artifact_type in ('session','moment','track_item')),
  add constraint cie_visibility_row_version_check check (row_version > 0),
  add constraint cie_visibility_hash_check check (content_hash ~ '^[a-f0-9]{64}$'),
  add constraint cie_visibility_session_owner_fk foreign key (session_id, owner_user_id) references cie.sessions(id, owner_user_id) on delete restrict,
  add constraint cie_visibility_consent_fk foreign key (consent_receipt_id, session_id, owner_user_id) references cie.consent_receipts(id, session_id, owner_user_id) on delete restrict;
create unique index cie_visibility_one_live_grant_idx
  on cie.visibility_grants (session_id, grantee_user_id, scope, artifact_type, artifact_id)
  where revoked_at is null;

create table cie.capability_registry (
  capability_key text primary key,
  contract_version text not null,
  phase text not null,
  activation_state text not null check (activation_state in ('ACTIVE','INACTIVE')),
  accepted_writes boolean not null,
  input_schema_ref text,
  output_schema_ref text,
  consent_purpose text,
  deletion_class text not null,
  unlock_evidence text,
  implementation_ref text,
  provider_ref text,
  created_at timestamptz not null default now(),
  check ((activation_state = 'ACTIVE' and accepted_writes and implementation_ref is not null)
      or (activation_state = 'INACTIVE' and not accepted_writes and implementation_ref is null and provider_ref is null))
);

insert into cie.capability_registry (
  capability_key, contract_version, phase, activation_state, accepted_writes,
  deletion_class, unlock_evidence, implementation_ref, provider_ref
) values
  ('mentor_manual_opportunity','cie.capability-registry-entry.v1','C0','ACTIVE',true,'BLOCK_COMPLETE_WHEN_NONEMPTY','Y1-CIE-C0-0001','cie.service.createOpportunity',null),
  ('transcript_generation','cie.capability-registry-entry.v1','FUTURE','INACTIVE',false,'BLOCK_COMPLETE_WHEN_NONEMPTY',null,null,null),
  ('storyforge_linkage','cie.capability-registry-entry.v1','FUTURE','INACTIVE',false,'BLOCK_COMPLETE_WHEN_NONEMPTY',null,null,null),
  ('polar_ingestion','cie.capability-registry-entry.v1','FUTURE','INACTIVE',false,'BLOCK_COMPLETE_WHEN_NONEMPTY',null,null,null),
  ('mode_pack_registry','cie.capability-registry-entry.v1','FUTURE','INACTIVE',false,'BLOCK_COMPLETE_WHEN_NONEMPTY',null,null,null),
  ('wordpress_skill_sync','cie.capability-registry-entry.v1','C1','INACTIVE',false,'BLOCK_COMPLETE_WHEN_NONEMPTY',null,null,null),
  ('ai_opportunity_source','cie.capability-registry-entry.v1','RESEARCH','INACTIVE',false,'BLOCK_COMPLETE_WHEN_NONEMPTY',null,null,null),
  ('voice_persona_provider','cie.capability-registry-entry.v1','RESEARCH','INACTIVE',false,'BLOCK_COMPLETE_WHEN_NONEMPTY',null,null,null);

create table cie.deletion_jobs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  owner_user_id uuid not null,
  state text not null check (state in ('REQUESTED','TOMBSTONED','CLEANUP_PENDING','VERIFYING','COMPLETE','FAILED_RETRYABLE','PARKED')),
  request_hash text not null check (request_hash ~ '^[a-f0-9]{64}$'),
  idempotency_key text not null,
  row_version bigint not null default 1 check (row_version > 0),
  requested_at timestamptz not null,
  completed_at timestamptz,
  contract_version text not null default 'cie.deletion-job.v1',
  unique (owner_user_id, idempotency_key),
  unique (session_id),
  foreign key (session_id, owner_user_id) references cie.sessions(id, owner_user_id) on delete restrict,
  check ((state = 'COMPLETE' and completed_at is not null) or (state <> 'COMPLETE' and completed_at is null))
);

create table cie.deletion_steps (
  job_id uuid not null references cie.deletion_jobs(id) on delete restrict,
  resource_class text not null,
  required boolean not null default true,
  state text not null check (state in ('PENDING','IN_PROGRESS','VERIFIED_ABSENT','FAILED_RETRYABLE','PARKED')),
  attempt integer not null default 0 check (attempt >= 0),
  proof_hash text,
  verified_at timestamptz,
  normalized_error jsonb,
  primary key (job_id, resource_class),
  check ((state = 'VERIFIED_ABSENT' and proof_hash ~ '^[a-f0-9]{64}$' and verified_at is not null)
      or (state <> 'VERIFIED_ABSENT' and proof_hash is null and verified_at is null))
);

create or replace function cie.reject_immutable_change_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, cie
as $$
begin
  raise exception using errcode = '55000', message = 'CIE append-only evidence cannot be updated or deleted';
end;
$$;
revoke all on function cie.reject_immutable_change_v1() from public, anon, authenticated;

create trigger cie_consent_append_only before update or delete on cie.consent_receipts
  for each row execute function cie.reject_immutable_change_v1();
create trigger cie_skill_snapshots_immutable before update or delete on cie.skill_snapshots
  for each row execute function cie.reject_immutable_change_v1();
create trigger cie_track_items_append_only before update or delete on cie.track_items
  for each row execute function cie.reject_immutable_change_v1();
create trigger cie_moments_immutable before update or delete on cie.moments
  for each row execute function cie.reject_immutable_change_v1();
create trigger cie_opportunities_immutable before update or delete on cie.opportunities
  for each row execute function cie.reject_immutable_change_v1();
create trigger cie_audit_append_only before update or delete on cie.audit_events
  for each row execute function cie.reject_immutable_change_v1();
create trigger cie_capability_registry_immutable before update or delete on cie.capability_registry
  for each row execute function cie.reject_immutable_change_v1();

create or replace function cie.enforce_track_revision_identity_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, cie
as $$
declare
  prior cie.track_items%rowtype;
begin
  if new.item_revision = 1 then
    if exists (select 1 from cie.track_items where track_item_id = new.track_item_id) then
      raise exception using errcode = '23505', message = 'CIE track identity already exists';
    end if;
  else
    select * into prior
      from cie.track_items
      where track_item_id = new.track_item_id and item_revision = new.item_revision - 1
      for key share;
    if not found then
      raise exception using errcode = '23503', message = 'CIE prior track revision does not exist';
    end if;
    if prior.session_id <> new.session_id or prior.owner_user_id <> new.owner_user_id or prior.kind <> new.kind then
      raise exception using errcode = '23514', message = 'CIE track revision identity cannot drift';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function cie.enforce_track_revision_identity_v1() from public, anon, authenticated;
create trigger cie_track_revision_identity before insert on cie.track_items
  for each row execute function cie.enforce_track_revision_identity_v1();

create or replace function cie.enforce_visibility_revoke_only_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, cie
as $$
begin
  if old.revoked_at is not null or new.revoked_at is null or new.row_version <> old.row_version + 1
     or (to_jsonb(new) - 'revoked_at' - 'row_version') <> (to_jsonb(old) - 'revoked_at' - 'row_version') then
    raise exception using errcode = '23514', message = 'CIE visibility grants may only transition once to revoked';
  end if;
  return new;
end;
$$;
revoke all on function cie.enforce_visibility_revoke_only_v1() from public, anon, authenticated;
create trigger cie_visibility_revoke_only before update on cie.visibility_grants
  for each row execute function cie.enforce_visibility_revoke_only_v1();

do $$
declare
  table_name text;
begin
  foreach table_name in array array['capability_registry','deletion_jobs','deletion_steps'] loop
    execute format('alter table cie.%I enable row level security', table_name);
    execute format('alter table cie.%I force row level security', table_name);
    execute format('revoke all on cie.%I from public, anon, authenticated', table_name);
  end loop;
end $$;

revoke all on all tables in schema cie from public, anon, authenticated;
revoke all on all functions in schema cie from public, anon, authenticated;

-- No public/authenticated RPC is granted here. The adopted MissionMed API auth
-- boundary must call a separately reviewed command adapter in its release ticket.

commit;
