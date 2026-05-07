-- STAT V3 diagnostic snapshot/job layer
-- Scope: additive dashboard artifacts for Arena Career HUD.
-- Reads qstat_answers_v1 only; does not modify STAT gameplay, auth,
-- Railway, WordPress, Daily/Drills, USCE, or legacy /stat.

begin;

create extension if not exists pgcrypto;

do $$
begin
  if to_regclass('public.qstat_answers_v1') is null then
    raise exception 'qstat_answers_v1_missing';
  end if;

  if to_regclass('public.diagnostic_reports') is not null
     and not exists (
       select 1
       from information_schema.columns
       where table_schema = 'public'
         and table_name = 'diagnostic_reports'
         and column_name = 'user_id'
     ) then
    raise exception 'diagnostic_reports schema conflict: table exists but user_id column is missing';
  end if;

  if to_regclass('public.study_plans') is not null
     and not exists (
       select 1
       from information_schema.columns
       where table_schema = 'public'
         and table_name = 'study_plans'
         and column_name = 'source_diagnostic_report_id'
     ) then
    raise exception 'study_plans schema conflict: table exists but source_diagnostic_report_id column is missing';
  end if;

  if to_regclass('public.study_tasks') is not null
     and not exists (
       select 1
       from information_schema.columns
       where table_schema = 'public'
         and table_name = 'study_tasks'
         and column_name = 'plan_id'
     ) then
    raise exception 'study_tasks schema conflict: table exists but plan_id column is missing';
  end if;
end
$$;

create table if not exists public.diagnostic_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  snapshot_version bigint not null default 0 check (snapshot_version >= 0),
  confidence text not null default 'insufficient'
    check (confidence in ('high', 'moderate', 'low', 'insufficient')),
  focus_topic text,
  focus_reason text,
  top_topics jsonb not null default '[]'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  is_current boolean not null default true,
  source text not null default 'qstat_answers_v1.duel_attempt',
  source_version text not null default 'stat-diagnostic-v1',
  source_hash text,
  narrative text,
  accuracy_pct integer check (accuracy_pct is null or (accuracy_pct >= 0 and accuracy_pct <= 100)),
  trend text,
  graph_ready boolean not null default false,
  graph_artifact jsonb not null default '{}'::jsonb,
  metrics jsonb not null default '{}'::jsonb,
  source_window jsonb not null default '{}'::jsonb,
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.diagnostic_reports
  add column if not exists source text not null default 'qstat_answers_v1.duel_attempt';
alter table public.diagnostic_reports
  add column if not exists source_version text not null default 'stat-diagnostic-v1';
alter table public.diagnostic_reports
  add column if not exists source_hash text;
alter table public.diagnostic_reports
  add column if not exists narrative text;
alter table public.diagnostic_reports
  add column if not exists accuracy_pct integer;
alter table public.diagnostic_reports
  add column if not exists trend text;
alter table public.diagnostic_reports
  add column if not exists graph_ready boolean not null default false;
alter table public.diagnostic_reports
  add column if not exists graph_artifact jsonb not null default '{}'::jsonb;
alter table public.diagnostic_reports
  add column if not exists metrics jsonb not null default '{}'::jsonb;
alter table public.diagnostic_reports
  add column if not exists source_window jsonb not null default '{}'::jsonb;
alter table public.diagnostic_reports
  add column if not exists generated_at timestamptz not null default now();
alter table public.diagnostic_reports
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'diagnostic_reports_accuracy_pct_ck'
      and conrelid = 'public.diagnostic_reports'::regclass
  ) then
    alter table public.diagnostic_reports
      add constraint diagnostic_reports_accuracy_pct_ck
      check (accuracy_pct is null or (accuracy_pct >= 0 and accuracy_pct <= 100));
  end if;
end
$$;

create index if not exists idx_diagnostic_reports_user_created
  on public.diagnostic_reports (user_id, created_at desc);

create unique index if not exists diagnostic_reports_one_current_per_user_uk
  on public.diagnostic_reports (user_id)
  where is_current;

create table if not exists public.study_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_diagnostic_report_id uuid not null references public.diagnostic_reports(id) on delete restrict,
  plan_version bigint not null check (plan_version >= 1),
  profile_hash text not null,
  status text not null default 'active' check (status = any (array['active'::text, 'archived'::text])),
  is_current boolean not null default true,
  plan_window_days integer not null default 7 check (plan_window_days >= 1 and plan_window_days <= 30),
  created_at timestamptz not null default now(),
  unique (user_id, source_diagnostic_report_id, profile_hash),
  unique (user_id, plan_version)
);

create table if not exists public.study_tasks (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.study_plans(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  task_date date not null,
  block_order integer not null check (block_order >= 1),
  task_type text not null check (task_type in ('focus', 'reinforce', 'stat_session', 'break')),
  topic text,
  duration_minutes integer not null check (duration_minutes > 0),
  priority integer not null default 3 check (priority between 1 and 5),
  status text not null default 'pending' check (status in ('pending', 'done', 'skipped')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  diagnostic_report_id uuid references public.diagnostic_reports(id) on delete set null,
  dedupe_key text,
  source text not null default 'stat-diagnostic-v1',
  focus_topic text,
  title text,
  task_title text,
  scheduled_for timestamptz,
  planned_for_date date,
  updated_at timestamptz not null default now(),
  unique (plan_id, task_date, block_order)
);

alter table public.study_tasks
  add column if not exists diagnostic_report_id uuid references public.diagnostic_reports(id) on delete set null;
alter table public.study_tasks
  add column if not exists dedupe_key text;
alter table public.study_tasks
  add column if not exists source text not null default 'stat-diagnostic-v1';
alter table public.study_tasks
  add column if not exists focus_topic text;
alter table public.study_tasks
  add column if not exists title text;
alter table public.study_tasks
  add column if not exists task_title text;
alter table public.study_tasks
  add column if not exists scheduled_for timestamptz;
alter table public.study_tasks
  add column if not exists planned_for_date date;
alter table public.study_tasks
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists study_tasks_dedupe_key_uk
  on public.study_tasks (dedupe_key)
  where dedupe_key is not null;

create index if not exists idx_study_tasks_user_scheduled
  on public.study_tasks (user_id, task_date, block_order, status);

create index if not exists idx_study_tasks_user_created
  on public.study_tasks (user_id, created_at desc);

create or replace function public.stat_intel_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'trg_diagnostic_reports_set_updated_at'
      and tgrelid = 'public.diagnostic_reports'::regclass
  ) then
    create trigger trg_diagnostic_reports_set_updated_at
      before update on public.diagnostic_reports
      for each row
      execute function public.stat_intel_set_updated_at();
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgname = 'trg_study_tasks_set_updated_at'
      and tgrelid = 'public.study_tasks'::regclass
  ) then
    create trigger trg_study_tasks_set_updated_at
      before update on public.study_tasks
      for each row
      execute function public.stat_intel_set_updated_at();
  end if;
end
$$;

create or replace function public.private_stat_intel_assert_user_scope(p_target_user_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_role text := coalesce(current_setting('request.jwt.claim.role', true), '');
begin
  if p_target_user_id is null then
    raise exception 'user_id_required';
  end if;

  if v_role = 'service_role' then
    return;
  end if;

  if v_role = '' then
    return;
  end if;

  if v_actor is null then
    raise exception 'auth_required';
  end if;

  if v_actor is distinct from p_target_user_id then
    raise exception 'not_allowed';
  end if;
end;
$$;

create or replace function public.refresh_stat_diagnostic_snapshot(
  p_user_id uuid default null,
  p_limit integer default 500
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_target uuid := coalesce(p_user_id, v_actor);
  v_limit integer := greatest(10, least(coalesce(p_limit, 500), 2000));
  v_total integer := 0;
  v_correct integer := 0;
  v_timed_count integer := 0;
  v_total_ms bigint := 0;
  v_avg_ms integer := null;
  v_accuracy integer := null;
  v_last_answered_at timestamptz := null;
  v_first_answered_at timestamptz := null;
  v_graph_series jsonb := '[]'::jsonb;
  v_confidence text := 'insufficient';
  v_trend text := 'baseline';
  v_focus_topic text := 'Build STAT sample size';
  v_focus_reason text := 'Complete more STAT V3 duels to make the diagnostic signal reliable.';
  v_narrative text;
  v_metrics jsonb;
  v_graph jsonb;
  v_source_window jsonb;
  v_source_hash text;
  v_report_id uuid;
  v_plan_id uuid;
  v_plan_version bigint;
  v_profile_hash text;
  v_task_id uuid;
  v_task_dedupe text;
  v_task_title text := 'Complete one STAT V3 duel';
  v_task_topic text := 'Build STAT sample size';
  v_duration integer := 25;
  v_scheduled_for timestamptz := date_trunc('hour', now()) + interval '1 hour';
begin
  if v_target is null then
    raise exception 'auth_required';
  end if;

  perform public.private_stat_intel_assert_user_scope(v_target);
  perform pg_advisory_xact_lock(hashtextextended(v_target::text, 314));

  with scoped_rows as (
    select
      question_id,
      is_correct,
      response_ms,
      answered_at,
      source_event_id,
      split_part(source_event_id, ':', 2) as attempt_key
    from public.qstat_answers_v1
    where user_id = v_target
      and source_type = 'duel_attempt'
    order by answered_at desc nulls last, source_event_id desc
    limit v_limit
  ),
  aggregate_rows as (
    select
      count(*)::integer as total,
      count(*) filter (where is_correct is true)::integer as correct,
      count(*) filter (where response_ms is not null and response_ms > 0)::integer as timed_count,
      coalesce(sum(response_ms) filter (where response_ms is not null and response_ms > 0), 0)::bigint as total_ms,
      max(answered_at) as last_answered_at,
      min(answered_at) as first_answered_at
    from scoped_rows
  ),
  attempt_groups as (
    select
      coalesce(nullif(attempt_key, ''), source_event_id) as attempt_key,
      count(*)::integer as total,
      count(*) filter (where is_correct is true)::integer as correct,
      round((count(*) filter (where is_correct is true)::numeric / greatest(count(*), 1)) * 100)::integer as accuracy_pct,
      round(avg(response_ms) filter (where response_ms is not null and response_ms > 0))::integer as avg_ms,
      max(answered_at) as answered_at
    from scoped_rows
    group by coalesce(nullif(attempt_key, ''), source_event_id)
  ),
  latest_groups as (
    select *
    from attempt_groups
    order by answered_at desc nulls last, attempt_key desc
    limit 10
  )
  select
    coalesce(a.total, 0),
    coalesce(a.correct, 0),
    coalesce(a.timed_count, 0),
    coalesce(a.total_ms, 0),
    a.last_answered_at,
    a.first_answered_at,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'key', lg.attempt_key,
            'total', lg.total,
            'correct', lg.correct,
            'accuracyPct', lg.accuracy_pct,
            'avgMs', lg.avg_ms,
            'answeredAt', lg.answered_at
          )
          order by lg.answered_at asc nulls first, lg.attempt_key asc
        )
        from latest_groups lg
      ),
      '[]'::jsonb
    )
  into
    v_total,
    v_correct,
    v_timed_count,
    v_total_ms,
    v_last_answered_at,
    v_first_answered_at,
    v_graph_series
  from aggregate_rows a;

  if v_total > 0 then
    v_accuracy := round((v_correct::numeric / v_total::numeric) * 100)::integer;
  end if;

  if v_timed_count > 0 then
    v_avg_ms := round(v_total_ms::numeric / v_timed_count::numeric)::integer;
  end if;

  if v_total >= 50 then
    v_confidence := 'high';
  elsif v_total >= 20 then
    v_confidence := 'moderate';
  elsif v_total > 0 then
    v_confidence := 'low';
  end if;

  with series as (
    select
      row_number() over (order by (value->>'answeredAt')::timestamptz nulls first) as rn,
      (value->>'accuracyPct')::numeric as acc
    from jsonb_array_elements(v_graph_series) as series_item(value)
    where series_item.value ? 'accuracyPct'
  ),
  numbered as (
    select *, count(*) over () as total_count
    from series
  ),
  buckets as (
    select
      avg(acc) filter (where rn > greatest(total_count - 3, 0)) as recent_acc,
      avg(acc) filter (where rn <= greatest(total_count - 3, 0) and rn > greatest(total_count - 6, 0)) as prior_acc
    from numbered
  )
  select case
    when recent_acc is null or prior_acc is null then 'baseline'
    when recent_acc >= prior_acc + 5 then 'improving'
    when recent_acc <= prior_acc - 5 then 'slipping'
    else 'stable'
  end
  into v_trend
  from buckets;

  v_trend := coalesce(v_trend, 'baseline');

  if v_total >= 20 then
    if v_accuracy is not null and v_accuracy < 60 then
      v_focus_topic := 'STAT remediation';
      v_focus_reason := 'Accuracy is below 60%. Review missed duel items before increasing speed.';
      v_task_title := 'Review missed STAT duel items';
      v_task_topic := 'STAT remediation';
      v_duration := 35;
    elsif v_avg_ms is not null and v_avg_ms > 80000 then
      v_focus_topic := 'STAT pacing';
      v_focus_reason := 'Accuracy signal is usable, but average answer time is slow enough to deserve pacing work.';
      v_task_title := 'Run a timed STAT pacing block';
      v_task_topic := 'STAT pacing';
      v_duration := 20;
    else
      v_focus_topic := 'Maintain STAT accuracy';
      v_focus_reason := 'STAT V3 duel answers are sufficient for dashboard trend tracking.';
      v_task_title := 'Complete one maintenance STAT duel';
      v_task_topic := 'Maintain STAT accuracy';
      v_duration := 25;
    end if;
  end if;

  if v_total > 0 then
    v_narrative := format(
      'STAT V3 has %s dashboard-readable duel answers at %s%% accuracy. Trend: %s.',
      v_total,
      coalesce(v_accuracy, 0),
      v_trend
    );
  else
    v_narrative := 'No STAT V3 duel answers are available for diagnostic synthesis yet.';
  end if;

  v_graph := jsonb_build_object(
    'kind', 'stat_duel_accuracy_speed_v1',
    'source', 'qstat_answers_v1.duel_attempt',
    'generatedAt', now(),
    'series', coalesce(v_graph_series, '[]'::jsonb)
  );

  v_metrics := jsonb_build_object(
    'total', v_total,
    'correct', v_correct,
    'accuracyPct', v_accuracy,
    'avgMs', v_avg_ms,
    'timedCount', v_timed_count,
    'lastAnsweredAt', v_last_answered_at,
    'firstAnsweredAt', v_first_answered_at
  );

  v_source_window := jsonb_build_object(
    'limit', v_limit,
    'firstAnsweredAt', v_first_answered_at,
    'lastAnsweredAt', v_last_answered_at,
    'sourceType', 'duel_attempt'
  );

  v_source_hash := encode(digest((v_metrics || v_graph || v_source_window)::text, 'sha256'), 'hex');

  update public.diagnostic_reports
  set is_current = false
  where user_id = v_target
    and is_current = true;

  insert into public.diagnostic_reports (
    user_id,
    snapshot_version,
    source,
    source_version,
    source_hash,
    is_current,
    confidence,
    focus_topic,
    focus_reason,
    top_topics,
    warnings,
    narrative,
    accuracy_pct,
    trend,
    graph_ready,
    graph_artifact,
    metrics,
    source_window,
    generated_at
  )
  values (
    v_target,
    coalesce((select max(snapshot_version) + 1 from public.diagnostic_reports where user_id = v_target), 1),
    'qstat_answers_v1.duel_attempt',
    'stat-diagnostic-v1',
    v_source_hash,
    true,
    v_confidence,
    v_focus_topic,
    v_focus_reason,
    '[]'::jsonb,
    case when v_total = 0 then jsonb_build_array('No STAT V3 duel answers were available.') else '[]'::jsonb end,
    v_narrative,
    v_accuracy,
    v_trend,
    jsonb_array_length(coalesce(v_graph_series, '[]'::jsonb)) > 0,
    v_graph,
    v_metrics,
    v_source_window,
    now()
  )
  returning id into v_report_id;

  select coalesce(max(plan_version), 0) + 1
  into v_plan_version
  from public.study_plans
  where user_id = v_target;

  v_profile_hash := encode(digest((v_target::text || ':' || v_report_id::text || ':' || v_source_hash), 'sha256'), 'hex');

  update public.study_plans
  set is_current = false,
      status = 'archived'
  where user_id = v_target
    and is_current = true;

  insert into public.study_plans (
    user_id,
    source_diagnostic_report_id,
    plan_version,
    profile_hash,
    status,
    is_current,
    plan_window_days
  )
  values (
    v_target,
    v_report_id,
    v_plan_version,
    v_profile_hash,
    'active',
    true,
    7
  )
  returning id into v_plan_id;

  if v_total > 0 then
    v_task_dedupe := format('stat:%s:%s:diagnostic', v_target, current_date);

    select id into v_task_id
    from public.study_tasks
    where user_id = v_target
      and dedupe_key = v_task_dedupe
    order by created_at desc
    limit 1
    for update;

    if v_task_id is null then
      insert into public.study_tasks (
        plan_id,
        user_id,
        task_date,
        block_order,
        task_type,
        topic,
        duration_minutes,
        priority,
        status,
        metadata,
        diagnostic_report_id,
        dedupe_key,
        source,
        focus_topic,
        title,
        task_title,
        scheduled_for,
        planned_for_date
      )
      values (
        v_plan_id,
        v_target,
        current_date,
        1,
        'stat_session',
        v_task_topic,
        v_duration,
        3,
        'pending',
        jsonb_build_object(
          'diagnostic_report_id', v_report_id,
          'confidence', v_confidence,
          'accuracyPct', v_accuracy,
          'trend', v_trend,
          'sourceHash', v_source_hash
        ),
        v_report_id,
        v_task_dedupe,
        'stat-diagnostic-v1',
        v_focus_topic,
        v_task_title,
        v_task_title,
        v_scheduled_for,
        current_date
      )
      returning id into v_task_id;
    else
      update public.study_tasks
      set
        plan_id = case when status = 'pending' then v_plan_id else plan_id end,
        diagnostic_report_id = case when status = 'pending' then v_report_id else diagnostic_report_id end,
        topic = case when status = 'pending' then v_task_topic else topic end,
        duration_minutes = case when status = 'pending' then v_duration else duration_minutes end,
        metadata = case
          when status = 'pending' then jsonb_build_object(
            'diagnostic_report_id', v_report_id,
            'confidence', v_confidence,
            'accuracyPct', v_accuracy,
            'trend', v_trend,
            'sourceHash', v_source_hash
          )
          else metadata
        end,
        focus_topic = case when status = 'pending' then v_focus_topic else focus_topic end,
        title = case when status = 'pending' then v_task_title else title end,
        task_title = case when status = 'pending' then v_task_title else task_title end,
        scheduled_for = case when status = 'pending' then v_scheduled_for else scheduled_for end,
        planned_for_date = coalesce(planned_for_date, current_date),
        updated_at = now()
      where id = v_task_id;
    end if;
  end if;

  return jsonb_build_object(
    'status', 'ok',
    'report_id', v_report_id,
    'plan_id', v_plan_id,
    'task_id', v_task_id,
    'user_id', v_target,
    'diagnostic', jsonb_build_object(
      'confidence', v_confidence,
      'focus_topic', v_focus_topic,
      'focus_reason', v_focus_reason,
      'narrative', v_narrative,
      'accuracyPct', v_accuracy,
      'trend', v_trend
    ),
    'metrics', v_metrics,
    'graph_artifact', v_graph,
    'source_hash', v_source_hash
  );
end;
$$;

create or replace function public.enqueue_stat_diagnostic_job(
  p_user_id uuid default null,
  p_reason text default 'manual'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_target uuid := coalesce(p_user_id, v_actor);
  v_job_id uuid;
  v_dedupe text;
begin
  if v_target is null then
    raise exception 'auth_required';
  end if;

  perform public.private_stat_intel_assert_user_scope(v_target);

  if to_regclass('public.intel_jobs') is null then
    raise exception 'intel_jobs_missing';
  end if;

  v_dedupe := format('stat_diagnostic_snapshot:%s:%s', v_target, current_date);

  insert into public.intel_jobs (
    job_type,
    dedupe_key,
    status,
    run_after,
    payload
  )
  values (
    'stat_diagnostic_snapshot',
    v_dedupe,
    'pending',
    now(),
    jsonb_build_object(
      'user_id', v_target,
      'reason', coalesce(nullif(btrim(p_reason), ''), 'manual'),
      'requested_at', now()
    )
  )
  on conflict (dedupe_key) do update
    set
      status = case
        when public.intel_jobs.status = 'running' then public.intel_jobs.status
        else 'pending'
      end,
      run_after = least(public.intel_jobs.run_after, now()),
      payload = public.intel_jobs.payload || excluded.payload,
      updated_at = now()
  returning id into v_job_id;

  return v_job_id;
end;
$$;

create or replace function public.process_stat_diagnostic_job(p_job_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := coalesce(current_setting('request.jwt.claim.role', true), '');
  v_job public.intel_jobs%rowtype;
  v_target uuid;
  v_result jsonb;
begin
  if v_role not in ('', 'service_role') then
    raise exception 'service_role_required';
  end if;

  if p_job_id is null then
    raise exception 'job_id_required';
  end if;

  select * into v_job
  from public.intel_jobs
  where id = p_job_id
  for update;

  if not found then
    raise exception 'job_not_found';
  end if;

  if v_job.job_type <> 'stat_diagnostic_snapshot' then
    raise exception 'wrong_job_type';
  end if;

  v_target := nullif(v_job.payload->>'user_id', '')::uuid;
  if v_target is null then
    raise exception 'job_user_id_missing';
  end if;

  update public.intel_jobs
  set status = 'running',
      attempts = attempts + case when status = 'running' then 0 else 1 end,
      updated_at = now()
  where id = p_job_id;

  v_result := public.refresh_stat_diagnostic_snapshot(v_target, 500);

  update public.intel_jobs
  set status = 'succeeded',
      last_error = null,
      payload = payload || jsonb_build_object('last_result', v_result, 'processed_at', now()),
      updated_at = now()
  where id = p_job_id;

  return v_result || jsonb_build_object('job_id', p_job_id);
exception
  when others then
    if p_job_id is not null and to_regclass('public.intel_jobs') is not null then
      update public.intel_jobs
      set
        status = case when attempts + 1 >= max_attempts then 'dead' else 'failed' end,
        last_error = left(sqlerrm, 4000),
        run_after = now() + interval '5 minutes',
        updated_at = now()
      where id = p_job_id;
    end if;
    raise;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'complete_study_task'
      and pg_get_function_identity_arguments(p.oid) = 'task_id uuid'
  ) then
    execute $fn$
      create function public.complete_study_task(task_id uuid)
      returns table(id uuid, status text, completed_at timestamp with time zone)
      language plpgsql
      security definer
      set search_path = public
      as $body$
      declare
        v_actor uuid := auth.uid();
      begin
        if v_actor is null then
          raise exception 'auth_required';
        end if;

        return query
        update public.study_tasks t
        set status = 'done',
            completed_at = coalesce(t.completed_at, now()),
            updated_at = now()
        where t.id = task_id
          and t.user_id = v_actor
        returning t.id, t.status, t.completed_at;
      end;
      $body$;
    $fn$;
  end if;
end
$$;

alter table public.diagnostic_reports enable row level security;
alter table public.study_plans enable row level security;
alter table public.study_tasks enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'diagnostic_reports'
      and policyname = 'diagnostic_reports_select_own'
  ) then
    create policy diagnostic_reports_select_own
      on public.diagnostic_reports
      for select
      to authenticated
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'diagnostic_reports'
      and policyname = 'diagnostic_reports_service_role_all'
  ) then
    create policy diagnostic_reports_service_role_all
      on public.diagnostic_reports
      for all
      to service_role
      using (true)
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'study_plans'
      and policyname = 'study_plans_select_own'
  ) then
    create policy study_plans_select_own
      on public.study_plans
      for select
      to authenticated
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'study_plans'
      and policyname = 'study_plans_service_role_all'
  ) then
    create policy study_plans_service_role_all
      on public.study_plans
      for all
      to service_role
      using (true)
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'study_tasks'
      and policyname = 'study_tasks_select_own'
  ) then
    create policy study_tasks_select_own
      on public.study_tasks
      for select
      to authenticated
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'study_tasks'
      and policyname = 'study_tasks_service_role_all'
  ) then
    create policy study_tasks_service_role_all
      on public.study_tasks
      for all
      to service_role
      using (true)
      with check (true);
  end if;
end
$$;

revoke all on public.diagnostic_reports from anon, authenticated;
revoke all on public.study_plans from anon, authenticated;
revoke all on public.study_tasks from anon, authenticated;

grant select on public.diagnostic_reports to authenticated;
grant select on public.study_plans to authenticated;
grant select on public.study_tasks to authenticated;

grant select, insert, update, delete on public.diagnostic_reports to service_role;
grant select, insert, update, delete on public.study_plans to service_role;
grant select, insert, update, delete on public.study_tasks to service_role;

grant execute on function public.refresh_stat_diagnostic_snapshot(uuid, integer) to authenticated, service_role;
grant execute on function public.enqueue_stat_diagnostic_job(uuid, text) to authenticated, service_role;
grant execute on function public.complete_study_task(uuid) to authenticated;
grant execute on function public.process_stat_diagnostic_job(uuid) to service_role;

revoke all on function public.stat_intel_set_updated_at() from anon, authenticated;
revoke all on function public.private_stat_intel_assert_user_scope(uuid) from anon, authenticated;
revoke all on function public.refresh_stat_diagnostic_snapshot(uuid, integer) from anon;
revoke all on function public.enqueue_stat_diagnostic_job(uuid, text) from anon;
revoke all on function public.complete_study_task(uuid) from anon;
revoke all on function public.process_stat_diagnostic_job(uuid) from anon, authenticated;

comment on table public.diagnostic_reports is
  'Durable STAT diagnostic snapshots derived from qstat_answers_v1 duel_attempt rows for Arena Career HUD.';
comment on table public.study_plans is
  'Study-plan container used by Arena Career HUD; STAT diagnostics create compatible active plans without changing legacy STAT.';
comment on table public.study_tasks is
  'RLS-scoped study tasks generated from diagnostic snapshots for Arena Career HUD.';
comment on function public.refresh_stat_diagnostic_snapshot(uuid, integer) is
  'Generates a durable STAT diagnostic report, graph artifact, compatible study plan, and study task from the authenticated user''s qstat duel stream.';
comment on function public.enqueue_stat_diagnostic_job(uuid, text) is
  'Enqueues a stat_diagnostic_snapshot job on the existing intel_jobs queue for the authenticated user or service role.';
comment on function public.process_stat_diagnostic_job(uuid) is
  'Service-role job processor for stat_diagnostic_snapshot jobs; refreshes diagnostic_reports, study_plans, and study_tasks.';
comment on function public.complete_study_task(uuid) is
  'Marks an authenticated user''s own study task done for Arena Career HUD.';

commit;
