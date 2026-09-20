begin;

create table public.ivoc_admin_config_versions (
  version integer primary key check (version > 0),
  schema_name text not null default 'ivoc.admin_config.v1'
    check (schema_name = 'ivoc.admin_config.v1'),
  analytics_config_version text not null
    check (analytics_config_version ~ '^[A-Za-z0-9._:-]{1,80}$'),
  brain_pack_version text not null
    check (brain_pack_version ~ '^[A-Za-z0-9._:-]{1,80}$'),
  ais_rules_version text not null
    check (ais_rules_version ~ '^[A-Za-z0-9._:-]{1,80}$'),
  pressure_defaults jsonb not null check (jsonb_typeof(pressure_defaults) = 'object'),
  proactive_budget_overrides jsonb not null check (jsonb_typeof(proactive_budget_overrides) = 'object'),
  credits jsonb not null check (jsonb_typeof(credits) = 'object'),
  change_reason text not null check (char_length(change_reason) between 3 and 400),
  changed_by text not null check (changed_by ~ '^wp:[1-9][0-9]{0,19}$'),
  created_at timestamptz not null default clock_timestamp()
);

insert into public.ivoc_admin_config_versions (
  version, analytics_config_version, brain_pack_version, ais_rules_version,
  pressure_defaults, proactive_budget_overrides, credits,
  change_reason, changed_by
) values (
  1,
  'ivoc.analytics.v1',
  'gpt-live-1:marin',
  '2026-09-18.1',
  '{"default_follow_up_intensity":1,"default_pressure_enabled":false,"max_follow_ups_per_answer":2}'::jsonb,
  '{"max_proactive_per_session":3,"max_reactive_per_answer":1,"max_application_probes_per_answer":1}'::jsonb,
  '{"default_allowance_seconds":0,"max_override_seconds":36000,"reset_period_days":30}'::jsonb,
  'Production baseline matching the active IVOC runtime',
  'wp:1'
);

create or replace function public.ivoc_write_admin_config(
  p_expected_version integer,
  p_analytics_config_version text,
  p_brain_pack_version text,
  p_ais_rules_version text,
  p_pressure_defaults jsonb,
  p_proactive_budget_overrides jsonb,
  p_credits jsonb,
  p_change_reason text,
  p_actor text
) returns table (
  version integer,
  schema_name text,
  analytics_config_version text,
  brain_pack_version text,
  ais_rules_version text,
  pressure_defaults jsonb,
  proactive_budget_overrides jsonb,
  credits jsonb,
  change_reason text,
  changed_by text,
  created_at timestamptz
) language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare
  current_version integer;
  next_version integer;
begin
  if p_expected_version is null or p_expected_version < 1
     or p_analytics_config_version is null
     or p_analytics_config_version !~ '^[A-Za-z0-9._:-]{1,80}$'
     or p_brain_pack_version is null
     or p_brain_pack_version !~ '^[A-Za-z0-9._:-]{1,80}$'
     or p_ais_rules_version is null
     or p_ais_rules_version !~ '^[A-Za-z0-9._:-]{1,80}$'
     or p_pressure_defaults is null or jsonb_typeof(p_pressure_defaults) <> 'object'
     or p_proactive_budget_overrides is null or jsonb_typeof(p_proactive_budget_overrides) <> 'object'
     or p_credits is null or jsonb_typeof(p_credits) <> 'object'
     or p_change_reason is null or char_length(btrim(p_change_reason)) not between 3 and 400
     or p_actor is null or p_actor !~ '^wp:[1-9][0-9]{0,19}$' then
    raise exception 'ivoc_admin_config_input_invalid' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(49564);
  select max(config.version) into current_version
  from public.ivoc_admin_config_versions config;
  if current_version <> p_expected_version then
    raise exception 'ivoc_admin_config_version_conflict' using errcode = 'P0001';
  end if;

  next_version := current_version + 1;
  insert into public.ivoc_admin_config_versions (
    version, analytics_config_version, brain_pack_version, ais_rules_version,
    pressure_defaults, proactive_budget_overrides, credits,
    change_reason, changed_by
  ) values (
    next_version, p_analytics_config_version, p_brain_pack_version,
    p_ais_rules_version, p_pressure_defaults, p_proactive_budget_overrides,
    p_credits, btrim(p_change_reason), p_actor
  );

  return query
  select config.version, config.schema_name, config.analytics_config_version,
    config.brain_pack_version, config.ais_rules_version,
    config.pressure_defaults, config.proactive_budget_overrides, config.credits,
    config.change_reason, config.changed_by, config.created_at
  from public.ivoc_admin_config_versions config
  where config.version = next_version;
end;
$$;

alter table public.ivoc_session_contracts
  add column admin_config_version integer not null default 1,
  add column brain_pack_version text not null default 'gpt-live-1:marin'
    check (brain_pack_version ~ '^[A-Za-z0-9._:-]{1,80}$'),
  add column ais_rules_version text not null default '2026-09-18.1'
    check (ais_rules_version ~ '^[A-Za-z0-9._:-]{1,80}$'),
  add constraint ivoc_session_contracts_admin_config_fk
    foreign key (admin_config_version)
    references public.ivoc_admin_config_versions(version)
    on update restrict on delete restrict;

alter table public.ivoc_admin_config_versions enable row level security;
alter table public.ivoc_admin_config_versions force row level security;

revoke all on table public.ivoc_admin_config_versions from public, anon, authenticated, service_role;
grant select, insert on table public.ivoc_admin_config_versions to service_role;

revoke all on function public.ivoc_write_admin_config(
  integer, text, text, text, jsonb, jsonb, jsonb, text, text
) from public, anon, authenticated;
grant execute on function public.ivoc_write_admin_config(
  integer, text, text, text, jsonb, jsonb, jsonb, text, text
) to service_role;

comment on table public.ivoc_admin_config_versions is
  'Append-only IVOC Analytics, InterviewBrain, attention-policy and credit-default configuration.';

commit;
