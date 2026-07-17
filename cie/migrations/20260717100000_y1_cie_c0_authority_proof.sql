begin;

-- Forward-only authority and erasure amendment. This migration is still an
-- isolated C0 candidate and has not been applied to a shared environment.

alter table cie.consent_receipts
  add column authority_session_ref text not null default 'legacy-unbound';
alter table cie.consent_receipts alter column authority_session_ref drop default;
alter table cie.consent_receipts
  add constraint cie_consent_authority_session_check check (length(authority_session_ref) between 1 and 180);

alter table cie.sessions
  alter column external_session_ref drop not null,
  alter column mode_ref drop not null,
  alter column clock drop not null,
  add column external_session_ref_hash text,
  add column clock_hash text,
  add column deleted_at timestamptz,
  add constraint cie_session_deletion_redaction_check check (
    (state <> 'DELETED' and external_session_ref is not null and mode_ref is not null and clock is not null and deleted_at is null)
    or
    (state = 'DELETED' and external_session_ref is null and mode_ref is null and media_revision_ref is null and clock is null
      and external_session_ref_hash ~ '^[a-f0-9]{64}$' and clock_hash ~ '^[a-f0-9]{64}$' and deleted_at is not null)
  );

alter table cie.visibility_grants rename column granted_at to issued_at;
alter table cie.visibility_grants
  add column authority_session_ref text not null default 'legacy-unbound';
alter table cie.visibility_grants alter column authority_session_ref drop default;
alter table cie.visibility_grants drop constraint if exists cie_visibility_artifact_check;
alter table cie.visibility_grants
  add constraint cie_visibility_artifact_check check (artifact_type in ('moment','track_item')),
  add constraint cie_visibility_authority_session_check check (length(authority_session_ref) between 1 and 180);

alter table cie.mutation_receipts
  add column session_id uuid references cie.sessions(id) on delete restrict,
  add column response_hash text,
  add column redacted_at timestamptz,
  add constraint cie_mutation_response_binding_check check (response is null or session_id is not null),
  add constraint cie_mutation_redaction_check check (
    (redacted_at is null and (response_hash is null or response_hash ~ '^[a-f0-9]{64}$'))
    or
    (redacted_at is not null and response is null and response_hash ~ '^[a-f0-9]{64}$')
  );
create index cie_mutation_receipts_session_idx on cie.mutation_receipts (session_id) where session_id is not null;

alter table cie.track_items
  add constraint cie_track_binding_unique unique (track_item_id, item_revision, session_id, owner_user_id, segment_id, media_revision_ref, t0_ms, t1_ms),
  add constraint cie_track_owner_binding_unique unique (track_item_id, item_revision, session_id, owner_user_id);

alter table cie.moments
  add column review_source_moment_id uuid,
  drop constraint if exists moments_track_item_id_track_item_revision_fkey,
  add constraint cie_moment_track_binding_fk
    foreign key (track_item_id, track_item_revision, session_id, owner_user_id, segment_id, media_revision_ref, t0_ms, t1_ms)
    references cie.track_items(track_item_id, item_revision, session_id, owner_user_id, segment_id, media_revision_ref, t0_ms, t1_ms) on delete restrict,
  add constraint cie_moment_review_source_fk
    foreign key (review_source_moment_id, session_id, owner_user_id)
    references cie.moments(id, session_id, owner_user_id) on delete restrict,
  add constraint cie_moment_source_binding_check check (
    (source = 'student' and review_source_moment_id is null)
    or (source = 'mentor' and review_source_moment_id is not null)
  );

alter table cie.opportunities
  drop constraint if exists opportunities_track_item_id_track_item_revision_fkey,
  add constraint cie_opportunity_track_binding_fk
    foreign key (track_item_id, track_item_revision, session_id, owner_user_id, segment_id, media_revision_ref, t0_ms, t1_ms)
    references cie.track_items(track_item_id, item_revision, session_id, owner_user_id, segment_id, media_revision_ref, t0_ms, t1_ms) on delete restrict;

alter table cie.session_priorities
  add column review_moment_id uuid,
  drop constraint if exists cie_priority_track_fk,
  add constraint cie_priority_track_owner_fk
    foreign key (track_item_id, track_item_revision, session_id, owner_user_id)
    references cie.track_items(track_item_id, item_revision, session_id, owner_user_id) on delete restrict,
  add constraint cie_priority_review_moment_fk
    foreign key (review_moment_id, session_id, owner_user_id)
    references cie.moments(id, session_id, owner_user_id) on delete restrict,
  add constraint cie_priority_exact_one_plus_one_check check (
    spotlight_snapshot_id is not null and supporting_snapshot_id is not null
    and spotlight_snapshot_id <> supporting_snapshot_id
    and spotlight_lifecycle = 'ACTIVE_SPOTLIGHT'
    and supporting_lifecycle = 'CONSOLIDATING'
  ),
  add constraint cie_priority_spotlight_owner_fk
    foreign key (spotlight_snapshot_id, owner_user_id)
    references cie.skill_snapshots(id, owner_user_id) on delete restrict,
  add constraint cie_priority_supporting_owner_fk
    foreign key (supporting_snapshot_id, owner_user_id)
    references cie.skill_snapshots(id, owner_user_id) on delete restrict;

create or replace function cie.enforce_moment_review_source_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, cie
as $$
declare
  source_moment cie.moments%rowtype;
begin
  if new.source = 'mentor' then
    select * into source_moment from cie.moments where id = new.review_source_moment_id for key share;
    if not found or source_moment.source <> 'student' or source_moment.session_id <> new.session_id
       or source_moment.owner_user_id <> new.owner_user_id or source_moment.t0_ms > new.t0_ms
       or source_moment.t1_ms < new.t1_ms then
      raise exception using errcode = '23514', message = 'CIE mentor Moment requires a covering student Moment';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function cie.enforce_moment_review_source_v1() from public, anon, authenticated;
create trigger cie_moment_review_source before insert on cie.moments
  for each row execute function cie.enforce_moment_review_source_v1();

create or replace function cie.reject_raw_session_audit_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, cie
as $$
begin
  if new.event_type = 'cie.session.created' and new.payload ? 'external_session_ref' then
    raise exception using errcode = '23514', message = 'CIE audit payload cannot retain a raw external session reference';
  end if;
  return new;
end;
$$;
revoke all on function cie.reject_raw_session_audit_v1() from public, anon, authenticated;
create trigger cie_audit_session_reference_guard before insert on cie.audit_events
  for each row execute function cie.reject_raw_session_audit_v1();

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'cie_deletion_verifier') then
    create role cie_deletion_verifier nologin nobypassrls;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'cie_deletion_executor') then
    create role cie_deletion_executor nologin nobypassrls;
  end if;
end $$;

create table cie.deletion_attestations (
  id uuid primary key,
  job_id uuid not null references cie.deletion_jobs(id) on delete restrict,
  resource_class text not null check (resource_class in ('cam_media_revision','audit_finalization')),
  proof_hash text not null check (proof_hash ~ '^[a-f0-9]{64}$'),
  provider_receipt_hash text not null check (provider_receipt_hash ~ '^[a-f0-9]{64}$'),
  authority_ref text not null check (length(authority_ref) between 1 and 180),
  authority_session_ref text not null check (length(authority_session_ref) between 1 and 180),
  worker_actor_user_id uuid not null references auth.users(id) on delete restrict,
  issued_at timestamptz not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  contract_version text not null default 'cie.deletion-attestation.v1',
  unique (job_id, resource_class, provider_receipt_hash),
  check (expires_at > issued_at),
  check (consumed_at is null or consumed_at >= issued_at)
);
alter table cie.deletion_attestations enable row level security;
alter table cie.deletion_attestations force row level security;
revoke all on cie.deletion_attestations from public, anon, authenticated, cie_deletion_verifier, cie_deletion_executor;

create or replace function cie.register_deletion_attestation_v1(
  p_attestation_id uuid,
  p_job_id uuid,
  p_resource_class text,
  p_proof_hash text,
  p_provider_receipt_hash text,
  p_authority_ref text,
  p_authority_session_ref text,
  p_worker_actor_user_id uuid,
  p_expires_at timestamptz
)
returns cie.deletion_attestations
language plpgsql
security definer
set search_path = pg_catalog, cie
as $$
declare
  attestation cie.deletion_attestations%rowtype;
begin
  if p_resource_class not in ('cam_media_revision','audit_finalization')
     or p_proof_hash !~ '^[a-f0-9]{64}$' or p_provider_receipt_hash !~ '^[a-f0-9]{64}$'
     or length(p_authority_ref) not between 1 and 180 or length(p_authority_session_ref) not between 1 and 180
     or p_expires_at <= now() then
    raise exception using errcode = '23514', message = 'CIE deletion attestation is invalid';
  end if;
  if not exists (select 1 from cie.deletion_jobs where id = p_job_id)
     or not exists (select 1 from auth.users where id = p_worker_actor_user_id) then
    raise exception using errcode = '23503', message = 'CIE deletion attestation authority binding is invalid';
  end if;
  insert into cie.deletion_attestations (
    id, job_id, resource_class, proof_hash, provider_receipt_hash, authority_ref,
    authority_session_ref, worker_actor_user_id, issued_at, expires_at
  ) values (
    p_attestation_id, p_job_id, p_resource_class, p_proof_hash, p_provider_receipt_hash,
    p_authority_ref, p_authority_session_ref, p_worker_actor_user_id, now(), p_expires_at
  ) returning * into attestation;
  return attestation;
end;
$$;
revoke all on function cie.register_deletion_attestation_v1(uuid,uuid,text,text,text,text,text,uuid,timestamptz) from public, anon, authenticated, cie_deletion_executor;

do $$
declare
  constraint_record record;
begin
  for constraint_record in
    select conname
    from pg_constraint
    where conrelid = 'cie.deletion_steps'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%VERIFIED_ABSENT%'
  loop
    execute format('alter table cie.deletion_steps drop constraint %I', constraint_record.conname);
  end loop;
end $$;

alter table cie.deletion_steps
  add constraint cie_deletion_step_state_check
    check (state in ('PENDING','IN_PROGRESS','VERIFIED_ABSENT','VERIFIED_PRESERVED','VERIFIED_REDACTED','FAILED_RETRYABLE','PARKED')),
  add constraint cie_deletion_step_proof_check
    check (((state in ('VERIFIED_ABSENT','VERIFIED_PRESERVED','VERIFIED_REDACTED')) and proof_hash ~ '^[a-f0-9]{64}$' and verified_at is not null)
      or ((state not in ('VERIFIED_ABSENT','VERIFIED_PRESERVED','VERIFIED_REDACTED')) and proof_hash is null and verified_at is null)),
  add constraint cie_deletion_step_semantics_check check (
    (resource_class = 'audit_finalization' and state not in ('VERIFIED_ABSENT','VERIFIED_REDACTED'))
    or (resource_class = 'mutation_receipts' and state not in ('VERIFIED_ABSENT','VERIFIED_PRESERVED'))
    or (resource_class not in ('audit_finalization','mutation_receipts') and state not in ('VERIFIED_PRESERVED','VERIFIED_REDACTED'))
  );

create or replace function cie.reject_immutable_change_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, cie
as $$
begin
  if tg_op = 'DELETE'
     and tg_table_name in ('consent_receipts','track_items','moments','opportunities')
     and current_setting('cie.deletion_session_id', true) = (to_jsonb(old)->>'session_id') then
    return old;
  end if;
  raise exception using errcode = '55000', message = 'CIE append-only evidence cannot be updated or deleted';
end;
$$;
revoke all on function cie.reject_immutable_change_v1() from public, anon, authenticated;

create or replace function cie.purge_session_artifacts_v1(p_job_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, cie
as $$
declare
  target cie.deletion_jobs%rowtype;
  removed_grants integer := 0;
  removed_opportunities integer := 0;
  removed_moments integer := 0;
  removed_priorities integer := 0;
  removed_tracks integer := 0;
  removed_consents integer := 0;
  redacted_receipts integer := 0;
  local_proof jsonb;
  absence_proof_hash text;
  redaction_proof_hash text;
begin
  select * into target from cie.deletion_jobs where id = p_job_id for update;
  if not found or target.state not in ('TOMBSTONED','CLEANUP_PENDING','FAILED_RETRYABLE') then
    raise exception using errcode = '23514', message = 'CIE deletion job is unavailable for local cleanup';
  end if;
  perform set_config('cie.deletion_session_id', target.session_id::text, true);

  delete from cie.visibility_grants where session_id = target.session_id;
  get diagnostics removed_grants = row_count;
  delete from cie.opportunities where session_id = target.session_id;
  get diagnostics removed_opportunities = row_count;
  delete from cie.session_priorities where session_id = target.session_id;
  get diagnostics removed_priorities = row_count;
  delete from cie.moments where session_id = target.session_id;
  get diagnostics removed_moments = row_count;
  delete from cie.track_items where session_id = target.session_id;
  get diagnostics removed_tracks = row_count;
  delete from cie.consent_receipts where session_id = target.session_id;
  get diagnostics removed_consents = row_count;
  update cie.mutation_receipts
    set response = null,
        response_hash = coalesce(response_hash, encode(sha256(convert_to(response::text, 'UTF8')), 'hex')),
        redacted_at = coalesce(redacted_at, now()),
        updated_at = now()
    where session_id = target.session_id and response is not null;
  get diagnostics redacted_receipts = row_count;

  if exists (select 1 from cie.visibility_grants where session_id = target.session_id)
     or exists (select 1 from cie.opportunities where session_id = target.session_id)
     or exists (select 1 from cie.moments where session_id = target.session_id)
     or exists (select 1 from cie.session_priorities where session_id = target.session_id)
     or exists (select 1 from cie.track_items where session_id = target.session_id)
     or exists (select 1 from cie.consent_receipts where session_id = target.session_id) then
    raise exception using errcode = '23514', message = 'CIE local deletion absence verification failed';
  end if;
  if exists (select 1 from cie.mutation_receipts where session_id = target.session_id and response is not null) then
    raise exception using errcode = '23514', message = 'CIE mutation receipt redaction verification failed';
  end if;
  local_proof := jsonb_build_object(
    'job_id', target.id,
    'session_id_hash', encode(sha256(convert_to(target.session_id::text, 'UTF8')), 'hex'),
    'visibility_grants', removed_grants,
    'opportunities', removed_opportunities,
    'moments', removed_moments,
    'session_priorities', removed_priorities,
    'track_items', removed_tracks,
    'consent_receipts', removed_consents,
    'future_derived_artifacts', 0
  );
  absence_proof_hash := encode(sha256(convert_to(local_proof::text, 'UTF8')), 'hex');
  redaction_proof_hash := encode(sha256(convert_to(jsonb_build_object(
    'job_id', target.id, 'mutation_receipts_redacted', redacted_receipts, 'responses_remaining', 0
  )::text, 'UTF8')), 'hex');

  update cie.deletion_steps
    set state = case when resource_class = 'mutation_receipts' then 'VERIFIED_REDACTED' else 'VERIFIED_ABSENT' end,
        attempt = attempt + 1,
        proof_hash = case when resource_class = 'mutation_receipts' then redaction_proof_hash else absence_proof_hash end,
        verified_at = now(),
        normalized_error = null
    where job_id = target.id
      and resource_class in ('visibility_grants','opportunities','moments','track_items','session_priorities','consent_receipts','mutation_receipts','future_derived_artifacts');
  update cie.deletion_jobs set state = 'CLEANUP_PENDING', row_version = row_version + 1 where id = target.id;

  return local_proof || jsonb_build_object('mutation_receipts', redacted_receipts);
end;
$$;

create or replace function cie.finalize_session_deletion_v1(
  p_job_id uuid,
  p_provider_attestation_id uuid,
  p_audit_attestation_id uuid,
  p_audit_event_id uuid,
  p_request_id text,
  p_correlation_id text
)
returns cie.deletion_jobs
language plpgsql
security definer
set search_path = pg_catalog, cie
as $$
declare
  target cie.deletion_jobs%rowtype;
  subject cie.sessions%rowtype;
  provider_attestation cie.deletion_attestations%rowtype;
  audit_attestation cie.deletion_attestations%rowtype;
begin
  select * into target from cie.deletion_jobs where id = p_job_id for update;
  if not found then
    raise exception using errcode = '23514', message = 'CIE deletion job cannot be finalized';
  end if;
  select * into subject from cie.sessions where id = target.session_id for update;
  if not found or target.state <> 'CLEANUP_PENDING' or subject.state <> 'DELETING' then
    raise exception using errcode = '23514', message = 'CIE deletion job cannot be finalized';
  end if;
  if exists (
    select 1 from cie.deletion_steps
    where job_id = target.id and resource_class not in ('cam_media_revision','audit_finalization')
      and not ((resource_class = 'mutation_receipts' and state = 'VERIFIED_REDACTED') or (resource_class <> 'mutation_receipts' and state = 'VERIFIED_ABSENT'))
  ) then
    raise exception using errcode = '23514', message = 'CIE local deletion closure is incomplete';
  end if;
  if (select count(*) from cie.deletion_steps where job_id = target.id) <> 10
     or exists (
       select 1
       from unnest(array[
         'visibility_grants','opportunities','moments','track_items','session_priorities',
         'consent_receipts','mutation_receipts','future_derived_artifacts','cam_media_revision','audit_finalization'
       ]) as required(resource_class)
       where not exists (
         select 1 from cie.deletion_steps step
         where step.job_id = target.id and step.resource_class = required.resource_class
       )
     ) then
    raise exception using errcode = '23514', message = 'CIE deletion resource inventory is incomplete';
  end if;
  if exists (select 1 from cie.mutation_receipts where session_id = target.session_id and response is not null) then
    raise exception using errcode = '23514', message = 'CIE mutation response redaction is incomplete';
  end if;

  select * into provider_attestation
    from cie.deletion_attestations
    where id = p_provider_attestation_id
      and job_id = target.id
      and resource_class = 'cam_media_revision'
      and consumed_at is null
      and expires_at > now()
    for update;
  if not found then
    raise exception using errcode = '23514', message = 'CIE provider deletion attestation is unavailable';
  end if;
  select * into audit_attestation
    from cie.deletion_attestations
    where id = p_audit_attestation_id
      and job_id = target.id
      and resource_class = 'audit_finalization'
      and consumed_at is null
      and expires_at > now()
    for update;
  if not found then
    raise exception using errcode = '23514', message = 'CIE audit deletion attestation is unavailable';
  end if;
  if provider_attestation.authority_ref <> audit_attestation.authority_ref
     or provider_attestation.authority_session_ref <> audit_attestation.authority_session_ref then
    raise exception using errcode = '23514', message = 'CIE deletion attestations do not share one authority';
  end if;

  update cie.deletion_steps
    set state = 'VERIFIED_ABSENT', attempt = attempt + 1, proof_hash = provider_attestation.proof_hash, verified_at = now(), normalized_error = null
    where job_id = target.id and resource_class = 'cam_media_revision';
  insert into cie.audit_events (
    id, session_id, owner_user_id, actor_user_id, event_type, resource_type, resource_id,
    request_id, correlation_id, payload, occurred_at, contract_version
  ) values (
    p_audit_event_id, target.session_id, target.owner_user_id, audit_attestation.worker_actor_user_id,
    'cie.deletion.completed', 'deletion_job', target.id::text,
    p_request_id, p_correlation_id, jsonb_build_object(
      'provider_attestation_id', provider_attestation.id,
      'provider_receipt_hash', provider_attestation.provider_receipt_hash,
      'audit_attestation_id', audit_attestation.id,
      'audit_receipt_hash', audit_attestation.provider_receipt_hash,
      'authority_session_ref_hash', encode(sha256(convert_to(audit_attestation.authority_session_ref, 'UTF8')), 'hex')
    ), now(), 'cie.audit-event.v1'
  );
  update cie.deletion_steps
    set state = 'VERIFIED_PRESERVED', attempt = attempt + 1, proof_hash = audit_attestation.proof_hash, verified_at = now(), normalized_error = null
    where job_id = target.id and resource_class = 'audit_finalization';
  if exists (
    select 1 from cie.deletion_steps where job_id = target.id
      and not ((resource_class = 'audit_finalization' and state = 'VERIFIED_PRESERVED')
        or (resource_class = 'mutation_receipts' and state = 'VERIFIED_REDACTED')
        or (resource_class not in ('audit_finalization','mutation_receipts') and state = 'VERIFIED_ABSENT'))
  ) then
    raise exception using errcode = '23514', message = 'CIE terminal deletion closure is incomplete';
  end if;

  update cie.sessions
    set external_session_ref_hash = encode(sha256(convert_to(external_session_ref, 'UTF8')), 'hex'),
        clock_hash = coalesce(clock->>'content_hash', encode(sha256(convert_to(clock::text, 'UTF8')), 'hex')),
        external_session_ref = null,
        mode_ref = null,
        media_revision_ref = null,
        clock = null,
        state = 'DELETED',
        deleted_at = now(),
        row_version = row_version + 1
    where id = target.session_id;
  update cie.deletion_attestations
    set consumed_at = now()
    where id in (provider_attestation.id, audit_attestation.id);
  update cie.deletion_jobs set state = 'COMPLETE', completed_at = now(), row_version = row_version + 1 where id = target.id returning * into target;
  return target;
end;
$$;

revoke all on function cie.purge_session_artifacts_v1(uuid) from public, anon, authenticated, cie_deletion_verifier;
revoke all on function cie.finalize_session_deletion_v1(uuid,uuid,uuid,uuid,text,text) from public, anon, authenticated, cie_deletion_verifier;
revoke all on all tables in schema cie from public, anon, authenticated, cie_deletion_verifier, cie_deletion_executor;
revoke all on all functions in schema cie from public, anon, authenticated, cie_deletion_verifier, cie_deletion_executor;
grant usage on schema cie to cie_deletion_verifier, cie_deletion_executor;
grant execute on function cie.register_deletion_attestation_v1(uuid,uuid,text,text,text,text,text,uuid,timestamptz) to cie_deletion_verifier;
grant execute on function cie.purge_session_artifacts_v1(uuid) to cie_deletion_executor;
grant execute on function cie.finalize_session_deletion_v1(uuid,uuid,uuid,uuid,text,text) to cie_deletion_executor;

commit;
