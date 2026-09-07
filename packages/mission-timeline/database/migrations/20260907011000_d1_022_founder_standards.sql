-- D1-TIMELINE-STORYFORGE-LIVE-022. Additive, isolated Timeline registry.
-- Existing release rollback retains these append-only records; no student data is seeded.
begin;
do $$ begin
  if timeline.schema_version() <> 'd1-timeline-db-500.1' then
    raise exception 'Founder standards require Timeline schema d1-timeline-db-500.1';
  end if;
end $$;

create table timeline.founder_standard_revisions (
  standard_id text not null check (standard_id ~ '^[a-z][a-z0-9_.:-]{2,119}$'),
  version integer not null check (version > 0),
  kind text not null check (kind in ('GOOD_EXAMPLE','REJECTED_EXAMPLE','PHRASING','CATEGORY_CORRECTION','DENSITY','LAYOUT','KEEP_REMOVE','VISUAL_QUALITY','INTERVIEW_READINESS')),
  title text not null check (length(title) between 1 and 140),
  guidance text not null check (length(guidance) between 1 and 4000),
  applicability_json jsonb not null check (coalesce(jsonb_typeof(applicability_json) = 'object' and jsonb_typeof(applicability_json->'workflows') = 'array' and jsonb_typeof(applicability_json->'categoryIds') = 'array',false)),
  provenance_json jsonb not null check (coalesce(jsonb_typeof(provenance_json) = 'object' and provenance_json->>'dataClass' in ('NONPERSONAL','SYNTHETIC') and provenance_json->>'sourceSha256' ~ '^[a-f0-9]{64}$' and length(provenance_json->>'sourceRef') between 1 and 500,false)),
  content_sha256 text not null check (content_sha256 ~ '^[a-f0-9]{64}$'),
  created_by text not null references timeline.principals(id),
  created_at timestamptz not null default clock_timestamp(),
  primary key (standard_id, version)
);

create table timeline.founder_standard_decisions (
  id text primary key,
  sequence bigint generated always as identity unique,
  standard_id text not null,
  version integer not null,
  decision text not null check (decision in ('APPROVE','REJECT','RETIRE')),
  approval_ref text not null check (length(approval_ref) between 1 and 500),
  reason text not null check (length(reason) between 1 and 1000),
  actor_principal_id text not null references timeline.principals(id),
  created_at timestamptz not null default clock_timestamp(),
  foreign key (standard_id, version) references timeline.founder_standard_revisions(standard_id, version)
);
create index founder_standard_publication_022 on timeline.founder_standard_decisions (standard_id, sequence desc) where decision in ('APPROVE','RETIRE');

create function timeline.founder_standard_reader_022() returns boolean
language sql stable security invoker set search_path = timeline, pg_temp as $$
  select timeline.current_principal_is_active() and (
    (timeline.current_role() = 'STUDENT' and coalesce((timeline.jwt_claims()->>'has_learndash_3893_access')::boolean,false))
    or (timeline.current_role() = 'PROGRAM_ADMIN' and coalesce((timeline.jwt_claims()->>'is_wordpress_administrator')::boolean,false))
  )
$$;
create function timeline.founder_standard_manager_022() returns boolean
language sql stable security invoker set search_path = timeline, pg_temp as $$
  select timeline.current_principal_is_active() and timeline.current_role() = 'PROGRAM_ADMIN'
    and coalesce((timeline.jwt_claims()->>'is_wordpress_administrator')::boolean,false)
    and coalesce((timeline.jwt_claims()->>'founder_standards_manager')::boolean,false)
$$;
create function timeline.reject_founder_standard_mutation_022() returns trigger
language plpgsql security invoker set search_path = timeline, pg_temp as $$
begin raise exception 'Founder standard revisions and decisions are append-only'; end $$;
create trigger founder_standard_revisions_immutable_022 before update or delete on timeline.founder_standard_revisions for each row execute function timeline.reject_founder_standard_mutation_022();
create trigger founder_standard_decisions_immutable_022 before update or delete on timeline.founder_standard_decisions for each row execute function timeline.reject_founder_standard_mutation_022();

alter table timeline.founder_standard_revisions enable row level security;
alter table timeline.founder_standard_revisions force row level security;
alter table timeline.founder_standard_decisions enable row level security;
alter table timeline.founder_standard_decisions force row level security;

-- Publication metadata is nonpersonal. Let eligible identities inspect it inside
-- the policy without a SECURITY DEFINER function or a policy recursion bypass.
-- The application exposes only approved reference metadata to ordinary readers.
create policy founder_standard_decisions_read_022 on timeline.founder_standard_decisions for select to timeline_authenticated
  using (timeline.founder_standard_reader_022());
create policy founder_standard_revisions_read_022 on timeline.founder_standard_revisions for select to timeline_authenticated
  using (timeline.founder_standard_manager_022() or (
    timeline.founder_standard_reader_022() and exists (
      select 1 from timeline.founder_standard_decisions d
      where d.standard_id = founder_standard_revisions.standard_id
        and d.version = founder_standard_revisions.version and d.decision = 'APPROVE'
        and d.sequence = (select max(current_decision.sequence) from timeline.founder_standard_decisions current_decision
          where current_decision.standard_id = d.standard_id and current_decision.decision in ('APPROVE','RETIRE'))
    )
  ));
create policy founder_standard_revisions_create_022 on timeline.founder_standard_revisions for insert to timeline_authenticated
  with check (timeline.founder_standard_manager_022() and created_by = timeline.current_principal_id());
create policy founder_standard_decisions_create_022 on timeline.founder_standard_decisions for insert to timeline_authenticated
  with check (timeline.founder_standard_manager_022() and actor_principal_id = timeline.current_principal_id());

revoke all on timeline.founder_standard_revisions, timeline.founder_standard_decisions from public;
grant select on timeline.founder_standard_revisions, timeline.founder_standard_decisions to timeline_authenticated;
grant insert (standard_id,version,kind,title,guidance,applicability_json,provenance_json,content_sha256,created_by) on timeline.founder_standard_revisions to timeline_authenticated;
grant insert (id,standard_id,version,decision,approval_ref,reason,actor_principal_id) on timeline.founder_standard_decisions to timeline_authenticated;
grant usage on sequence timeline.founder_standard_decisions_sequence_seq to timeline_authenticated;
revoke all on function timeline.founder_standard_reader_022(), timeline.founder_standard_manager_022(), timeline.reject_founder_standard_mutation_022() from public;
grant execute on function timeline.founder_standard_reader_022(), timeline.founder_standard_manager_022(), timeline.reject_founder_standard_mutation_022() to timeline_authenticated;
comment on table timeline.founder_standard_revisions is 'Versioned nonpersonal Founder guidance. No private student example ingestion and no automatic approval.';
comment on table timeline.founder_standard_decisions is 'Append-only explicit Founder decisions; latest APPROVE/RETIRE controls publication, so retirement never resurrects an older version.';
commit;
