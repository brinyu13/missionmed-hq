-- ============================================================================
-- NMCC-2D-DATA — HQ RPC-only Supabase read wrappers
-- Removes the remaining HQ dependency on direct command_center REST reads by
-- exposing Leads and MedMail through dedicated RPC functions.
-- ============================================================================

begin;
-- --------------------------------------------------
-- READ: List MedMail queue rows for HQ through RPC
-- --------------------------------------------------
create or replace function public.mmac_cc_list_email_queue(
  p_assigned_to text default null,
  p_limit integer default 80
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, command_center
as $$
declare
  v_limit integer := greatest(coalesce(p_limit, 80), 1);
begin
  return coalesce((
    select jsonb_agg(row_to_json(eq)::jsonb order by eq.created_at desc)
    from (
      select *
      from command_center.email_queue_v1 eq
      where (p_assigned_to is null or eq.assigned_to = p_assigned_to)
      order by eq.created_at desc
      limit v_limit
    ) eq
  ), '[]'::jsonb);
end;
$$;
-- --------------------------------------------------
-- READ: List leads with latest score rollups for HQ
-- --------------------------------------------------
create or replace function public.mmac_cc_list_leads(
  p_assigned_to text default null,
  p_limit integer default 60
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, command_center
as $$
declare
  v_limit integer := greatest(coalesce(p_limit, 60), 1);
begin
  return coalesce((
    select jsonb_agg(row_to_json(r)::jsonb order by r.updated_at desc nulls last, r.created_at desc nulls last)
    from (
      select
        l.id,
        l.id as lead_id,
        l.assigned_to,
        l.full_name,
        l.email,
        l.lead_source,
        l.lead_status,
        l.funnel_stage,
        l.intake_summary,
        l.created_at,
        l.updated_at,
        ls.score as latest_lead_score,
        ls.confidence as latest_lead_score_confidence,
        ls.summary as latest_lead_score_summary,
        ls.computed_at as latest_lead_score_computed_at
      from command_center.leads l
      left join command_center.latest_lead_scores_v1 ls
        on ls.lead_id = l.id
      where (p_assigned_to is null or l.assigned_to = p_assigned_to)
      order by l.updated_at desc nulls last, l.created_at desc nulls last
      limit v_limit
    ) r
  ), '[]'::jsonb);
end;
$$;
grant execute on function public.mmac_cc_list_email_queue(text, integer) to service_role;
grant execute on function public.mmac_cc_list_leads(text, integer) to service_role;
comment on function public.mmac_cc_list_email_queue(text, integer)
  is 'NMCC-2D-DATA: Returns the HQ MedMail queue through RPC so MissionMed HQ does not read command_center views directly.';
comment on function public.mmac_cc_list_leads(text, integer)
  is 'NMCC-2D-DATA: Returns the HQ Leads queue plus latest score rollups through RPC so MissionMed HQ does not read command_center tables/views directly.';
commit;
