-- DBOC Phase 1.2 RLS Policies
-- Source: (IV) DBOC_IV_OPERATOR_PLAYBOOK.html (Task 1.2)
-- Idempotent: policy creation guarded by pg_policies existence checks.

-- Enable RLS on all 12 dboc_iv_* tables
alter table if exists public.dboc_iv_questions enable row level security;
alter table if exists public.dboc_iv_sessions enable row level security;
alter table if exists public.dboc_iv_responses enable row level security;
alter table if exists public.dboc_iv_response_metrics enable row level security;
alter table if exists public.dboc_iv_saf_analysis enable row level security;
alter table if exists public.dboc_iv_answer_vault enable row level security;
alter table if exists public.dboc_iv_user_progress enable row level security;
alter table if exists public.dboc_iv_review_queue enable row level security;
alter table if exists public.dboc_iv_teaching_videos enable row level security;
alter table if exists public.dboc_iv_programs enable row level security;
alter table if exists public.dboc_iv_stories enable row level security;
alter table if exists public.dboc_iv_teaching_videos_meta enable row level security;

-- Helper pattern: create policy iff missing

-- dboc_iv_sessions: strict user isolation via user_id
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='dboc_iv_sessions' and policyname='dboc_iv_sessions_select_own') then
    create policy dboc_iv_sessions_select_own on public.dboc_iv_sessions for select to authenticated using (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='dboc_iv_sessions' and policyname='dboc_iv_sessions_insert_own') then
    create policy dboc_iv_sessions_insert_own on public.dboc_iv_sessions for insert to authenticated with check (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='dboc_iv_sessions' and policyname='dboc_iv_sessions_update_own') then
    create policy dboc_iv_sessions_update_own on public.dboc_iv_sessions for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='dboc_iv_sessions' and policyname='dboc_iv_sessions_delete_own') then
    create policy dboc_iv_sessions_delete_own on public.dboc_iv_sessions for delete to authenticated using (user_id = auth.uid());
  end if;
end $$;

-- dboc_iv_responses: strict user isolation via user_id
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='dboc_iv_responses' and policyname='dboc_iv_responses_select_own') then
    create policy dboc_iv_responses_select_own on public.dboc_iv_responses for select to authenticated using (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='dboc_iv_responses' and policyname='dboc_iv_responses_insert_own') then
    create policy dboc_iv_responses_insert_own on public.dboc_iv_responses for insert to authenticated with check (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='dboc_iv_responses' and policyname='dboc_iv_responses_update_own') then
    create policy dboc_iv_responses_update_own on public.dboc_iv_responses for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='dboc_iv_responses' and policyname='dboc_iv_responses_delete_own') then
    create policy dboc_iv_responses_delete_own on public.dboc_iv_responses for delete to authenticated using (user_id = auth.uid());
  end if;
end $$;

-- dboc_iv_answer_vault: strict user isolation via user_id
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='dboc_iv_answer_vault' and policyname='dboc_iv_answer_vault_select_own') then
    create policy dboc_iv_answer_vault_select_own on public.dboc_iv_answer_vault for select to authenticated using (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='dboc_iv_answer_vault' and policyname='dboc_iv_answer_vault_insert_own') then
    create policy dboc_iv_answer_vault_insert_own on public.dboc_iv_answer_vault for insert to authenticated with check (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='dboc_iv_answer_vault' and policyname='dboc_iv_answer_vault_update_own') then
    create policy dboc_iv_answer_vault_update_own on public.dboc_iv_answer_vault for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='dboc_iv_answer_vault' and policyname='dboc_iv_answer_vault_delete_own') then
    create policy dboc_iv_answer_vault_delete_own on public.dboc_iv_answer_vault for delete to authenticated using (user_id = auth.uid());
  end if;
end $$;

-- dboc_iv_user_progress: strict user isolation via user_id
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='dboc_iv_user_progress' and policyname='dboc_iv_user_progress_select_own') then
    create policy dboc_iv_user_progress_select_own on public.dboc_iv_user_progress for select to authenticated using (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='dboc_iv_user_progress' and policyname='dboc_iv_user_progress_insert_own') then
    create policy dboc_iv_user_progress_insert_own on public.dboc_iv_user_progress for insert to authenticated with check (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='dboc_iv_user_progress' and policyname='dboc_iv_user_progress_update_own') then
    create policy dboc_iv_user_progress_update_own on public.dboc_iv_user_progress for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='dboc_iv_user_progress' and policyname='dboc_iv_user_progress_delete_own') then
    create policy dboc_iv_user_progress_delete_own on public.dboc_iv_user_progress for delete to authenticated using (user_id = auth.uid());
  end if;
end $$;

-- dboc_iv_review_queue: user + reviewer + admin override from playbook
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='dboc_iv_review_queue' and policyname='dboc_iv_review_queue_select_user_or_reviewer') then
    create policy dboc_iv_review_queue_select_user_or_reviewer on public.dboc_iv_review_queue
      for select to authenticated
      using (user_id = auth.uid() or reviewer_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='dboc_iv_review_queue' and policyname='dboc_iv_review_queue_select_admin') then
    create policy dboc_iv_review_queue_select_admin on public.dboc_iv_review_queue
      for select to authenticated
      using ((auth.jwt() ->> 'role') = 'admin');
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='dboc_iv_review_queue' and policyname='dboc_iv_review_queue_insert_own') then
    create policy dboc_iv_review_queue_insert_own on public.dboc_iv_review_queue
      for insert to authenticated
      with check (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='dboc_iv_review_queue' and policyname='dboc_iv_review_queue_update_reviewer_or_admin') then
    create policy dboc_iv_review_queue_update_reviewer_or_admin on public.dboc_iv_review_queue
      for update to authenticated
      using (reviewer_id = auth.uid() or (auth.jwt() ->> 'role') = 'admin')
      with check (reviewer_id = auth.uid() or (auth.jwt() ->> 'role') = 'admin');
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='dboc_iv_review_queue' and policyname='dboc_iv_review_queue_delete_admin_or_owner') then
    create policy dboc_iv_review_queue_delete_admin_or_owner on public.dboc_iv_review_queue
      for delete to authenticated
      using (user_id = auth.uid() or (auth.jwt() ->> 'role') = 'admin');
  end if;
end $$;

-- session-derived ownership tables per playbook guidance
-- dboc_iv_response_metrics owned through parent response.user_id
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='dboc_iv_response_metrics' and policyname='dboc_iv_response_metrics_select_own') then
    create policy dboc_iv_response_metrics_select_own on public.dboc_iv_response_metrics
      for select to authenticated
      using (exists (
        select 1 from public.dboc_iv_responses r
        where r.id = dboc_iv_response_metrics.response_id and r.user_id = auth.uid()
      ));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='dboc_iv_response_metrics' and policyname='dboc_iv_response_metrics_insert_own') then
    create policy dboc_iv_response_metrics_insert_own on public.dboc_iv_response_metrics
      for insert to authenticated
      with check (exists (
        select 1 from public.dboc_iv_responses r
        where r.id = dboc_iv_response_metrics.response_id and r.user_id = auth.uid()
      ));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='dboc_iv_response_metrics' and policyname='dboc_iv_response_metrics_update_own') then
    create policy dboc_iv_response_metrics_update_own on public.dboc_iv_response_metrics
      for update to authenticated
      using (exists (
        select 1 from public.dboc_iv_responses r
        where r.id = dboc_iv_response_metrics.response_id and r.user_id = auth.uid()
      ))
      with check (exists (
        select 1 from public.dboc_iv_responses r
        where r.id = dboc_iv_response_metrics.response_id and r.user_id = auth.uid()
      ));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='dboc_iv_response_metrics' and policyname='dboc_iv_response_metrics_delete_own') then
    create policy dboc_iv_response_metrics_delete_own on public.dboc_iv_response_metrics
      for delete to authenticated
      using (exists (
        select 1 from public.dboc_iv_responses r
        where r.id = dboc_iv_response_metrics.response_id and r.user_id = auth.uid()
      ));
  end if;
end $$;

-- dboc_iv_saf_analysis owned through parent response.user_id
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='dboc_iv_saf_analysis' and policyname='dboc_iv_saf_analysis_select_own') then
    create policy dboc_iv_saf_analysis_select_own on public.dboc_iv_saf_analysis
      for select to authenticated
      using (exists (
        select 1 from public.dboc_iv_responses r
        where r.id = dboc_iv_saf_analysis.response_id and r.user_id = auth.uid()
      ));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='dboc_iv_saf_analysis' and policyname='dboc_iv_saf_analysis_insert_own') then
    create policy dboc_iv_saf_analysis_insert_own on public.dboc_iv_saf_analysis
      for insert to authenticated
      with check (exists (
        select 1 from public.dboc_iv_responses r
        where r.id = dboc_iv_saf_analysis.response_id and r.user_id = auth.uid()
      ));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='dboc_iv_saf_analysis' and policyname='dboc_iv_saf_analysis_update_own') then
    create policy dboc_iv_saf_analysis_update_own on public.dboc_iv_saf_analysis
      for update to authenticated
      using (exists (
        select 1 from public.dboc_iv_responses r
        where r.id = dboc_iv_saf_analysis.response_id and r.user_id = auth.uid()
      ))
      with check (exists (
        select 1 from public.dboc_iv_responses r
        where r.id = dboc_iv_saf_analysis.response_id and r.user_id = auth.uid()
      ));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='dboc_iv_saf_analysis' and policyname='dboc_iv_saf_analysis_delete_own') then
    create policy dboc_iv_saf_analysis_delete_own on public.dboc_iv_saf_analysis
      for delete to authenticated
      using (exists (
        select 1 from public.dboc_iv_responses r
        where r.id = dboc_iv_saf_analysis.response_id and r.user_id = auth.uid()
      ));
  end if;
end $$;

-- DERIVED shared-reference policies for tables without user_id in playbook schema.
-- These remain authenticated-read and backend/service managed for writes.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='dboc_iv_questions' and policyname='dboc_iv_questions_read_authenticated') then
    create policy dboc_iv_questions_read_authenticated on public.dboc_iv_questions
      for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='dboc_iv_teaching_videos' and policyname='dboc_iv_teaching_videos_read_authenticated') then
    create policy dboc_iv_teaching_videos_read_authenticated on public.dboc_iv_teaching_videos
      for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='dboc_iv_programs' and policyname='dboc_iv_programs_read_authenticated') then
    create policy dboc_iv_programs_read_authenticated on public.dboc_iv_programs
      for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='dboc_iv_stories' and policyname='dboc_iv_stories_read_authenticated') then
    create policy dboc_iv_stories_read_authenticated on public.dboc_iv_stories
      for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='dboc_iv_teaching_videos_meta' and policyname='dboc_iv_teaching_videos_meta_read_authenticated') then
    create policy dboc_iv_teaching_videos_meta_read_authenticated on public.dboc_iv_teaching_videos_meta
      for select to authenticated using (true);
  end if;
end $$;
