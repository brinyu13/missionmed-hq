-- ============================================================================
-- NMCC-2E-DATA-SYNC — Command Center backfill RPC surface
-- Adds idempotent server-side upsert functions for leads, students, payments,
-- lead scores, and MedMail queue hydration.
-- ============================================================================

begin;
create or replace function command_center.normalize_assigned_to(
  p_value text,
  p_default text default null
)
returns text
language sql
immutable
as $$
  select case lower(coalesce(btrim(p_value), ''))
    when 'brian' then 'brian'
    when 'phil' then 'phil'
    when 'dr_j' then 'dr_j'
    when 'dr j' then 'dr_j'
    when 'dr. j' then 'dr_j'
    when 'system' then 'system'
    when 'unassigned' then 'unassigned'
    else p_default
  end;
$$;
create or replace function command_center.normalize_program_tier(
  p_value text,
  p_default text default 'mission_residency'
)
returns text
language sql
immutable
as $$
  select case lower(coalesce(btrim(p_value), ''))
    when 'mission_residency' then 'mission_residency'
    when 'mission residency' then 'mission_residency'
    when 'match' then 'mission_residency'
    when 'mission roster' then 'mission_residency'
    when 'usmle_drills' then 'usmle_drills'
    when 'usmle drills' then 'usmle_drills'
    when 'usce' then 'usce'
    when 'membership' then 'membership'
    when 'other' then 'other'
    else p_default
  end;
$$;
create or replace function command_center.normalize_student_status(
  p_value text,
  p_default text default 'active'
)
returns text
language sql
immutable
as $$
  select case lower(coalesce(btrim(p_value), ''))
    when 'onboarding' then 'onboarding'
    when 'active' then 'active'
    when 'at_risk' then 'at_risk'
    when 'payment_hold' then 'payment_hold'
    when 'matched' then 'matched'
    when 'alumni' then 'alumni'
    when 'paused' then 'paused'
    when 'archived' then 'archived'
    else p_default
  end;
$$;
create or replace function command_center.normalize_student_funnel_stage(
  p_value text,
  p_default text default 'active_training'
)
returns text
language sql
immutable
as $$
  select case lower(coalesce(btrim(p_value), ''))
    when 'enrollment_pending' then 'enrollment_pending'
    when 'onboarding' then 'onboarding'
    when 'active_training' then 'active_training'
    when 'active training' then 'active_training'
    when 'interview_season' then 'interview_season'
    when 'interview season' then 'interview_season'
    when 'rank_list' then 'rank_list'
    when 'rank list' then 'rank_list'
    when 'matched' then 'matched'
    when 'alumni' then 'alumni'
    when 'cancelled' then 'cancelled'
    else p_default
  end;
$$;
create or replace function command_center.normalize_risk_level(
  p_value text,
  p_default text default 'info'
)
returns text
language sql
immutable
as $$
  select case lower(coalesce(btrim(p_value), ''))
    when 'critical' then 'critical'
    when 'warning' then 'warning'
    when 'info' then 'info'
    when 'none' then 'none'
    else p_default
  end;
$$;
create or replace function command_center.normalize_lead_status(
  p_value text,
  p_default text default 'new'
)
returns text
language sql
immutable
as $$
  select case lower(coalesce(btrim(p_value), ''))
    when 'new' then 'new'
    when 'new_inquiry' then 'new'
    when 'engaged' then 'engaged'
    when 'qualified' then 'qualified'
    when 'call_booked' then 'call_booked'
    when 'offer_sent' then 'offer_sent'
    when 'payment_pending' then 'payment_pending'
    when 'converted' then 'converted'
    when 'enrolled' then 'converted'
    when 'lost' then 'lost'
    when 'disqualified' then 'disqualified'
    else p_default
  end;
$$;
create or replace function command_center.normalize_lead_funnel_stage(
  p_value text,
  p_default text default 'lead_captured'
)
returns text
language sql
immutable
as $$
  select case lower(coalesce(btrim(p_value), ''))
    when 'lead_captured' then 'lead_captured'
    when 'new_inquiry' then 'lead_captured'
    when 'strategy_call_booked' then 'strategy_call_booked'
    when 'strategy_call_completed' then 'strategy_call_completed'
    when 'offer_sent' then 'offer_sent'
    when 'payment_pending' then 'payment_pending'
    when 'converted' then 'converted'
    when 'enrolled' then 'converted'
    when 'lost' then 'lost'
    when 'disqualified' then 'disqualified'
    else p_default
  end;
$$;
create or replace function command_center.normalize_payment_status(
  p_value text,
  p_default text default 'pending'
)
returns text
language sql
immutable
as $$
  select case lower(coalesce(btrim(p_value), ''))
    when 'pending' then 'pending'
    when 'processing' then 'succeeded'
    when 'completed' then 'succeeded'
    when 'paid' then 'succeeded'
    when 'succeeded' then 'succeeded'
    when 'failed' then 'failed'
    when 'refunded' then 'refunded'
    when 'disputed' then 'disputed'
    when 'cancelled' then 'cancelled'
    when 'canceled' then 'cancelled'
    when 'on-hold' then 'pending'
    else p_default
  end;
$$;
create or replace function command_center.normalize_payment_type(
  p_value text,
  p_default text default 'charge'
)
returns text
language sql
immutable
as $$
  select case lower(coalesce(btrim(p_value), ''))
    when 'charge' then 'charge'
    when 'refund' then 'refund'
    when 'subscription' then 'subscription'
    when 'installment' then 'installment'
    when 'retry' then 'retry'
    when 'adjustment' then 'adjustment'
    else p_default
  end;
$$;
create or replace function command_center.normalize_draft_status(
  p_value text,
  p_default text default 'draft'
)
returns text
language sql
immutable
as $$
  select case lower(coalesce(btrim(p_value), ''))
    when 'draft' then 'draft'
    when 'review' then 'review'
    when 'edited' then 'edited'
    when 'approved' then 'approved'
    when 'sent' then 'sent'
    when 'rejected' then 'rejected'
    else p_default
  end;
$$;
create or replace function command_center.backfill_lead(p_payload jsonb)
returns jsonb
language plpgsql
as $$
declare
  v_source_system text := coalesce(nullif(btrim(coalesce(p_payload ->> 'source_system', '')), ''), 'manual_backfill');
  v_source_record_id text := nullif(btrim(coalesce(p_payload ->> 'source_record_id', '')), '');
  v_email citext := nullif(lower(btrim(coalesce(p_payload ->> 'email', ''))), '')::citext;
  v_first_name text := nullif(btrim(coalesce(p_payload ->> 'first_name', '')), '');
  v_last_name text := nullif(btrim(coalesce(p_payload ->> 'last_name', '')), '');
  v_full_name text := coalesce(
    nullif(btrim(coalesce(p_payload ->> 'full_name', '')), ''),
    nullif(btrim(concat_ws(' ', v_first_name, v_last_name)), ''),
    case when v_email is not null then split_part(v_email::text, '@', 1) else null end
  );
  v_phone text := nullif(btrim(coalesce(p_payload ->> 'phone', '')), '');
  v_country text := nullif(btrim(coalesce(p_payload ->> 'country', '')), '');
  v_timezone_name text := nullif(btrim(coalesce(p_payload ->> 'timezone_name', '')), '');
  v_lead_source text := nullif(btrim(coalesce(p_payload ->> 'lead_source', '')), '');
  v_lead_source_detail text := nullif(btrim(coalesce(p_payload ->> 'lead_source_detail', '')), '');
  v_campaign_name text := nullif(btrim(coalesce(p_payload ->> 'campaign_name', '')), '');
  v_intake_summary text := nullif(btrim(coalesce(p_payload ->> 'intake_summary', p_payload ->> 'summary', '')), '');
  v_assigned_to text := command_center.normalize_assigned_to(p_payload ->> 'assigned_to', null);
  v_lead_status text := case
    when nullif(btrim(coalesce(p_payload ->> 'lead_status', '')), '') is null then null
    else command_center.normalize_lead_status(p_payload ->> 'lead_status', 'new')
  end;
  v_funnel_stage text := case
    when nullif(btrim(coalesce(p_payload ->> 'funnel_stage', '')), '') is null then null
    else command_center.normalize_lead_funnel_stage(p_payload ->> 'funnel_stage', 'lead_captured')
  end;
  v_last_contact_at timestamptz := nullif(btrim(coalesce(p_payload ->> 'last_contact_at', '')), '')::timestamptz;
  v_last_engagement_at timestamptz := coalesce(
    nullif(btrim(coalesce(p_payload ->> 'last_engagement_at', '')), '')::timestamptz,
    v_last_contact_at
  );
  v_metadata jsonb := coalesce(p_payload -> 'metadata', '{}'::jsonb);
  v_lead_id uuid;
  v_event_id uuid;
  v_status text;
begin
  if v_email is null and v_source_record_id is null then
    return jsonb_build_object(
      'status', 'skipped',
      'reason', 'missing_anchor',
      'source_system', v_source_system
    );
  end if;

  select l.id
    into v_lead_id
  from command_center.leads l
  where (
      v_source_record_id is not null
      and l.source_system = v_source_system
      and l.source_record_id = v_source_record_id
    )
    or (v_email is not null and l.email = v_email)
  order by case
    when v_source_record_id is not null
      and l.source_system = v_source_system
      and l.source_record_id = v_source_record_id then 0
    else 1
  end,
  l.updated_at desc
  limit 1;

  if v_lead_id is null then
    insert into command_center.leads (
      assigned_to,
      full_name,
      first_name,
      last_name,
      email,
      phone,
      country,
      timezone_name,
      lead_source,
      lead_source_detail,
      campaign_name,
      lead_status,
      funnel_stage,
      intake_summary,
      last_contact_at,
      last_engagement_at,
      source_system,
      source_record_id,
      metadata
    )
    values (
      coalesce(v_assigned_to, 'brian'),
      v_full_name,
      v_first_name,
      v_last_name,
      v_email,
      v_phone,
      v_country,
      v_timezone_name,
      v_lead_source,
      v_lead_source_detail,
      v_campaign_name,
      coalesce(v_lead_status, 'new'),
      coalesce(v_funnel_stage, 'lead_captured'),
      v_intake_summary,
      v_last_contact_at,
      v_last_engagement_at,
      v_source_system,
      v_source_record_id,
      v_metadata
    )
    returning id into v_lead_id;

    v_status := 'inserted';
  else
    update command_center.leads
    set
      assigned_to = coalesce(v_assigned_to, assigned_to),
      full_name = coalesce(v_full_name, full_name),
      first_name = coalesce(v_first_name, first_name),
      last_name = coalesce(v_last_name, last_name),
      email = coalesce(v_email, email),
      phone = coalesce(v_phone, phone),
      country = coalesce(v_country, country),
      timezone_name = coalesce(v_timezone_name, timezone_name),
      lead_source = coalesce(v_lead_source, lead_source),
      lead_source_detail = coalesce(v_lead_source_detail, lead_source_detail),
      campaign_name = coalesce(v_campaign_name, campaign_name),
      lead_status = coalesce(v_lead_status, lead_status),
      funnel_stage = coalesce(v_funnel_stage, funnel_stage),
      intake_summary = coalesce(v_intake_summary, intake_summary),
      last_contact_at = case
        when v_last_contact_at is null then last_contact_at
        else greatest(coalesce(last_contact_at, v_last_contact_at), v_last_contact_at)
      end,
      last_engagement_at = case
        when v_last_engagement_at is null then last_engagement_at
        else greatest(coalesce(last_engagement_at, v_last_engagement_at), v_last_engagement_at)
      end,
      metadata = coalesce(metadata, '{}'::jsonb) || v_metadata,
      last_synced_at = now(),
      updated_at = now()
    where id = v_lead_id;

    v_status := 'updated';
  end if;

  v_event_id := command_center.append_event(
    'lead.backfilled',
    v_source_system,
    'lead',
    v_lead_id,
    v_lead_id,
    null::uuid,
    'integration',
    null,
    v_source_record_id,
    'backfill:lead:' || v_source_system || ':' || coalesce(v_source_record_id, v_email::text, v_lead_id::text),
    null,
    null,
    jsonb_strip_nulls(jsonb_build_object(
      'lead_id', v_lead_id,
      'full_name', v_full_name,
      'email', v_email,
      'lead_source', v_lead_source,
      'lead_status', coalesce(v_lead_status, 'new'),
      'funnel_stage', coalesce(v_funnel_stage, 'lead_captured'),
      'metadata', v_metadata
    )),
    coalesce(v_last_engagement_at, v_last_contact_at, now())
  );

  return jsonb_build_object(
    'status', v_status,
    'lead_id', v_lead_id,
    'event_id', v_event_id,
    'email', coalesce(v_email::text, ''),
    'source_system', v_source_system,
    'source_record_id', coalesce(v_source_record_id, '')
  );
end;
$$;
create or replace function command_center.backfill_student(p_payload jsonb)
returns jsonb
language plpgsql
as $$
declare
  v_source_system text := coalesce(nullif(btrim(coalesce(p_payload ->> 'source_system', '')), ''), 'manual_backfill');
  v_source_record_id text := nullif(btrim(coalesce(p_payload ->> 'source_record_id', '')), '');
  v_wordpress_user_id text := nullif(btrim(coalesce(p_payload ->> 'wordpress_user_id', '')), '');
  v_email citext := nullif(lower(btrim(coalesce(p_payload ->> 'email', ''))), '')::citext;
  v_full_name text := coalesce(
    nullif(btrim(coalesce(p_payload ->> 'full_name', '')), ''),
    case when v_email is not null then split_part(v_email::text, '@', 1) else null end
  );
  v_preferred_name text := nullif(btrim(coalesce(p_payload ->> 'preferred_name', '')), '');
  v_phone text := nullif(btrim(coalesce(p_payload ->> 'phone', '')), '');
  v_country text := nullif(btrim(coalesce(p_payload ->> 'country', '')), '');
  v_timezone_name text := nullif(btrim(coalesce(p_payload ->> 'timezone_name', '')), '');
  v_visa_status text := nullif(btrim(coalesce(p_payload ->> 'visa_status', '')), '');
  v_yog integer := nullif(btrim(coalesce(p_payload ->> 'yog', '')), '')::integer;
  v_medical_school text := nullif(btrim(coalesce(p_payload ->> 'medical_school', '')), '');
  v_match_cycle_year integer := nullif(btrim(coalesce(p_payload ->> 'match_cycle_year', '')), '')::integer;
  v_enrollment_date date := nullif(btrim(coalesce(p_payload ->> 'enrollment_date', '')), '')::date;
  v_last_activity_at timestamptz := nullif(btrim(coalesce(p_payload ->> 'last_activity_at', '')), '')::timestamptz;
  v_last_payment_at timestamptz := nullif(btrim(coalesce(p_payload ->> 'last_payment_at', '')), '')::timestamptz;
  v_program_tier text := case
    when nullif(btrim(coalesce(p_payload ->> 'program_tier', '')), '') is null then null
    else command_center.normalize_program_tier(p_payload ->> 'program_tier', 'mission_residency')
  end;
  v_student_status text := case
    when nullif(btrim(coalesce(p_payload ->> 'student_status', '')), '') is null then null
    else command_center.normalize_student_status(p_payload ->> 'student_status', 'active')
  end;
  v_funnel_stage text := case
    when nullif(btrim(coalesce(p_payload ->> 'funnel_stage', '')), '') is null then null
    else command_center.normalize_student_funnel_stage(p_payload ->> 'funnel_stage', 'active_training')
  end;
  v_risk_level text := case
    when nullif(btrim(coalesce(p_payload ->> 'risk_level', '')), '') is null then null
    else command_center.normalize_risk_level(p_payload ->> 'risk_level', 'info')
  end;
  v_assigned_to text := command_center.normalize_assigned_to(p_payload ->> 'assigned_to', null);
  v_metadata jsonb := coalesce(p_payload -> 'metadata', '{}'::jsonb);
  v_student_id uuid;
  v_originating_lead_id uuid;
  v_resolved_student_id uuid;
  v_event_id uuid;
  v_status text;
begin
  if v_full_name is null then
    return jsonb_build_object(
      'status', 'skipped',
      'reason', 'missing_full_name',
      'source_system', v_source_system,
      'source_record_id', coalesce(v_source_record_id, '')
    );
  end if;

  select lead_id, student_id
    into v_originating_lead_id, v_resolved_student_id
  from command_center.resolve_anchor(
    v_email::text,
    coalesce(v_wordpress_user_id, v_source_record_id),
    v_source_record_id
  );

  select s.id
    into v_student_id
  from command_center.students s
  where (
      v_source_record_id is not null
      and s.source_system = v_source_system
      and s.source_record_id = v_source_record_id
    )
    or (v_email is not null and s.email = v_email)
  order by case
    when v_source_record_id is not null
      and s.source_system = v_source_system
      and s.source_record_id = v_source_record_id then 0
    else 1
  end,
  s.updated_at desc
  limit 1;

  if v_student_id is null then
    insert into command_center.students (
      originating_lead_id,
      assigned_to,
      full_name,
      preferred_name,
      email,
      phone,
      country,
      timezone_name,
      visa_status,
      yog,
      medical_school,
      match_cycle_year,
      program_tier,
      student_status,
      funnel_stage,
      enrollment_date,
      last_activity_at,
      last_payment_at,
      risk_level,
      source_system,
      source_record_id,
      metadata
    )
    values (
      v_originating_lead_id,
      coalesce(v_assigned_to, 'brian'),
      v_full_name,
      v_preferred_name,
      v_email,
      v_phone,
      v_country,
      v_timezone_name,
      v_visa_status,
      v_yog,
      v_medical_school,
      v_match_cycle_year,
      coalesce(v_program_tier, 'mission_residency'),
      coalesce(v_student_status, 'active'),
      coalesce(v_funnel_stage, 'active_training'),
      v_enrollment_date,
      v_last_activity_at,
      v_last_payment_at,
      coalesce(v_risk_level, 'info'),
      v_source_system,
      v_source_record_id,
      v_metadata || jsonb_strip_nulls(jsonb_build_object(
        'wp_user_id', coalesce(v_wordpress_user_id, v_source_record_id),
        'wordpress_user_id', coalesce(v_wordpress_user_id, v_source_record_id)
      ))
    )
    returning id into v_student_id;

    v_status := 'inserted';
  else
    update command_center.students
    set
      originating_lead_id = coalesce(v_originating_lead_id, originating_lead_id),
      assigned_to = coalesce(v_assigned_to, assigned_to),
      full_name = coalesce(v_full_name, full_name),
      preferred_name = coalesce(v_preferred_name, preferred_name),
      email = coalesce(v_email, email),
      phone = coalesce(v_phone, phone),
      country = coalesce(v_country, country),
      timezone_name = coalesce(v_timezone_name, timezone_name),
      visa_status = coalesce(v_visa_status, visa_status),
      yog = coalesce(v_yog, yog),
      medical_school = coalesce(v_medical_school, medical_school),
      match_cycle_year = coalesce(v_match_cycle_year, match_cycle_year),
      program_tier = coalesce(v_program_tier, program_tier),
      student_status = coalesce(v_student_status, student_status),
      funnel_stage = coalesce(v_funnel_stage, funnel_stage),
      enrollment_date = coalesce(v_enrollment_date, enrollment_date),
      last_activity_at = case
        when v_last_activity_at is null then last_activity_at
        else greatest(coalesce(last_activity_at, v_last_activity_at), v_last_activity_at)
      end,
      last_payment_at = case
        when v_last_payment_at is null then last_payment_at
        else greatest(coalesce(last_payment_at, v_last_payment_at), v_last_payment_at)
      end,
      risk_level = coalesce(v_risk_level, risk_level),
      metadata = coalesce(metadata, '{}'::jsonb)
        || v_metadata
        || jsonb_strip_nulls(jsonb_build_object(
          'wp_user_id', coalesce(v_wordpress_user_id, v_source_record_id),
          'wordpress_user_id', coalesce(v_wordpress_user_id, v_source_record_id)
        )),
      last_synced_at = now(),
      updated_at = now()
    where id = v_student_id;

    v_status := 'updated';
  end if;

  if v_originating_lead_id is not null then
    update command_center.leads
    set
      lead_status = 'converted',
      funnel_stage = 'converted',
      last_synced_at = now(),
      updated_at = now()
    where id = v_originating_lead_id;
  end if;

  v_event_id := command_center.append_event(
    'student.backfilled',
    v_source_system,
    'student',
    v_student_id,
    v_originating_lead_id,
    v_student_id,
    'integration',
    null,
    v_source_record_id,
    'backfill:student:' || v_source_system || ':' || coalesce(v_source_record_id, v_email::text, v_student_id::text),
    null,
    null,
    jsonb_strip_nulls(jsonb_build_object(
      'student_id', v_student_id,
      'full_name', v_full_name,
      'email', v_email,
      'program_tier', coalesce(v_program_tier, 'mission_residency'),
      'student_status', coalesce(v_student_status, 'active'),
      'funnel_stage', coalesce(v_funnel_stage, 'active_training'),
      'metadata', v_metadata
    )),
    coalesce(v_last_activity_at, v_last_payment_at, now())
  );

  return jsonb_build_object(
    'status', v_status,
    'student_id', v_student_id,
    'lead_id', v_originating_lead_id,
    'event_id', v_event_id,
    'email', coalesce(v_email::text, ''),
    'source_system', v_source_system,
    'source_record_id', coalesce(v_source_record_id, '')
  );
end;
$$;
create or replace function command_center.backfill_lead_score(p_payload jsonb)
returns jsonb
language plpgsql
as $$
declare
  v_source_system text := coalesce(nullif(btrim(coalesce(p_payload ->> 'source_system', '')), ''), 'manual_backfill');
  v_source_record_id text := coalesce(
    nullif(btrim(coalesce(p_payload ->> 'source_record_id', '')), ''),
    'lead-score:' || coalesce(nullif(btrim(coalesce(p_payload ->> 'lead_id', '')), ''), nullif(btrim(coalesce(p_payload ->> 'email', '')), ''), md5(coalesce(p_payload::text, '{}')))
  );
  v_email citext := nullif(lower(btrim(coalesce(p_payload ->> 'email', ''))), '')::citext;
  v_lead_id uuid := nullif(btrim(coalesce(p_payload ->> 'lead_id', '')), '')::uuid;
  v_score integer := greatest(0, least(100, coalesce(nullif(btrim(coalesce(p_payload ->> 'score', '')), '')::integer, 0)));
  v_confidence numeric(4,3) := nullif(btrim(coalesce(p_payload ->> 'confidence', '')), '')::numeric;
  v_summary text := nullif(btrim(coalesce(p_payload ->> 'summary', '')), '');
  v_model_name text := nullif(btrim(coalesce(p_payload ->> 'model_name', '')), '');
  v_signals jsonb := coalesce(p_payload -> 'signals', '{}'::jsonb);
  v_metadata jsonb := coalesce(p_payload -> 'metadata', '{}'::jsonb);
  v_computed_at timestamptz := coalesce(nullif(btrim(coalesce(p_payload ->> 'computed_at', '')), '')::timestamptz, now());
  v_score_id uuid;
  v_event_id uuid;
  v_status text;
begin
  if v_lead_id is null and v_email is not null then
    select l.id
      into v_lead_id
    from command_center.leads l
    where l.email = v_email
    order by l.updated_at desc
    limit 1;
  end if;

  if v_lead_id is null then
    return jsonb_build_object(
      'status', 'skipped',
      'reason', 'lead_not_found',
      'source_system', v_source_system,
      'source_record_id', v_source_record_id
    );
  end if;

  select ls.id
    into v_score_id
  from command_center.lead_scores ls
  where ls.source_system = v_source_system
    and ls.source_record_id = v_source_record_id
  limit 1;

  if v_score_id is null then
    insert into command_center.lead_scores (
      lead_id,
      score,
      confidence,
      summary,
      model_name,
      signals,
      computed_at,
      source_system,
      source_record_id,
      metadata
    )
    values (
      v_lead_id,
      v_score,
      v_confidence,
      v_summary,
      v_model_name,
      v_signals,
      v_computed_at,
      v_source_system,
      v_source_record_id,
      v_metadata
    )
    returning id into v_score_id;

    v_status := 'inserted';
  else
    update command_center.lead_scores
    set
      lead_id = v_lead_id,
      score = v_score,
      confidence = coalesce(v_confidence, confidence),
      summary = coalesce(v_summary, summary),
      model_name = coalesce(v_model_name, model_name),
      signals = coalesce(signals, '{}'::jsonb) || v_signals,
      computed_at = v_computed_at,
      metadata = coalesce(metadata, '{}'::jsonb) || v_metadata,
      last_synced_at = now(),
      updated_at = now()
    where id = v_score_id;

    v_status := 'updated';
  end if;

  v_event_id := command_center.append_event(
    'lead_score.backfilled',
    v_source_system,
    'lead',
    v_lead_id,
    v_lead_id,
    null::uuid,
    'integration',
    null,
    v_source_record_id,
    'backfill:lead-score:' || v_source_system || ':' || v_source_record_id,
    null,
    null,
    jsonb_strip_nulls(jsonb_build_object(
      'lead_score_id', v_score_id,
      'score', v_score,
      'confidence', v_confidence,
      'summary', v_summary,
      'signals', v_signals
    )),
    v_computed_at
  );

  return jsonb_build_object(
    'status', v_status,
    'lead_score_id', v_score_id,
    'lead_id', v_lead_id,
    'event_id', v_event_id,
    'source_system', v_source_system,
    'source_record_id', v_source_record_id
  );
end;
$$;
create or replace function command_center.backfill_payment(p_payload jsonb)
returns jsonb
language plpgsql
as $$
declare
  v_source_system text := coalesce(nullif(btrim(coalesce(p_payload ->> 'source_system', '')), ''), 'woocommerce');
  v_source_record_id text := coalesce(
    nullif(btrim(coalesce(p_payload ->> 'source_record_id', '')), ''),
    nullif(btrim(coalesce(p_payload ->> 'order_id', '')), ''),
    nullif(btrim(coalesce(p_payload ->> 'processor_payment_id', '')), '')
  );
  v_wordpress_user_id text := nullif(btrim(coalesce(p_payload ->> 'wordpress_user_id', '')), '');
  v_email citext := nullif(lower(btrim(coalesce(p_payload ->> 'email', ''))), '')::citext;
  v_full_name text := nullif(btrim(coalesce(p_payload ->> 'full_name', '')), '');
  v_assigned_to text := command_center.normalize_assigned_to(p_payload ->> 'assigned_to', null);
  v_processor_name text := case lower(coalesce(btrim(p_payload ->> 'processor_name'), ''))
    when 'stripe' then 'stripe'
    when 'woocommerce' then 'woocommerce'
    when 'manual' then 'manual'
    when 'other' then 'other'
    else 'stripe'
  end;
  v_stripe_account text := nullif(btrim(coalesce(p_payload ->> 'stripe_account', '')), '');
  v_processor_payment_id text := nullif(btrim(coalesce(p_payload ->> 'processor_payment_id', '')), '');
  v_processor_invoice_id text := nullif(btrim(coalesce(p_payload ->> 'processor_invoice_id', '')), '');
  v_payment_type text := command_center.normalize_payment_type(p_payload ->> 'payment_type', 'charge');
  v_payment_status text := command_center.normalize_payment_status(p_payload ->> 'payment_status', 'pending');
  v_amount numeric(12,2) := coalesce(nullif(btrim(coalesce(p_payload ->> 'amount', '')), '')::numeric, 0);
  v_currency text := lower(coalesce(nullif(btrim(coalesce(p_payload ->> 'currency', '')), ''), 'usd'));
  v_payment_at timestamptz := coalesce(nullif(btrim(coalesce(p_payload ->> 'payment_at', '')), '')::timestamptz, now());
  v_metadata jsonb := coalesce(p_payload -> 'metadata', '{}'::jsonb);
  v_allow_auto_lead boolean := coalesce(nullif(btrim(coalesce(p_payload ->> 'auto_create_lead', '')), '')::boolean, true);
  v_lead_id uuid;
  v_student_id uuid;
  v_aggregate_type text;
  v_aggregate_id uuid;
  v_anchor_assigned_to text;
  v_payment_id uuid;
  v_event_id uuid;
  v_status text;
  v_lead_result jsonb;
begin
  if v_source_record_id is null and v_processor_payment_id is null then
    return jsonb_build_object(
      'status', 'skipped',
      'reason', 'missing_source_record_id',
      'source_system', v_source_system
    );
  end if;

  select lead_id, student_id, assigned_to, aggregate_type, aggregate_id
    into v_lead_id, v_student_id, v_anchor_assigned_to, v_aggregate_type, v_aggregate_id
  from command_center.resolve_anchor(v_email::text, v_wordpress_user_id, v_source_record_id);

  if v_lead_id is null and v_student_id is null and v_allow_auto_lead and (v_email is not null or v_source_record_id is not null) then
    v_lead_result := command_center.backfill_lead(jsonb_strip_nulls(jsonb_build_object(
      'source_system', v_source_system,
      'source_record_id', case when v_source_record_id is not null then 'lead:' || v_source_record_id else null end,
      'email', v_email,
      'full_name', v_full_name,
      'lead_source', 'woocommerce_order',
      'lead_status', case when v_payment_status = 'succeeded' then 'converted' else 'payment_pending' end,
      'funnel_stage', case when v_payment_status = 'succeeded' then 'converted' else 'payment_pending' end,
      'assigned_to', coalesce(v_assigned_to, 'phil'),
      'metadata', jsonb_build_object('created_from_payment_backfill', true)
    )));

    v_lead_id := nullif(v_lead_result ->> 'lead_id', '')::uuid;
    v_aggregate_type := case when v_lead_id is not null then 'lead' else 'system' end;
    v_aggregate_id := v_lead_id;
  end if;

  if v_lead_id is null and v_student_id is null then
    return jsonb_build_object(
      'status', 'skipped',
      'reason', 'anchor_not_found',
      'email', coalesce(v_email::text, ''),
      'source_system', v_source_system,
      'source_record_id', coalesce(v_source_record_id, v_processor_payment_id, '')
    );
  end if;

  if v_aggregate_type is null then
    v_aggregate_type := case when v_student_id is not null then 'student' else 'lead' end;
  end if;

  if v_aggregate_id is null then
    v_aggregate_id := coalesce(v_student_id, v_lead_id);
  end if;

  v_event_id := command_center.append_event(
    'payment.backfilled',
    v_source_system,
    v_aggregate_type,
    v_aggregate_id,
    v_lead_id,
    v_student_id,
    'integration',
    v_processor_payment_id,
    coalesce(v_source_record_id, v_processor_payment_id),
    'backfill:payment:' || v_source_system || ':' || coalesce(v_source_record_id, v_processor_payment_id, md5(coalesce(p_payload::text, '{}'))),
    coalesce(v_processor_invoice_id, v_processor_payment_id),
    null,
    jsonb_strip_nulls(jsonb_build_object(
      'payment_status', v_payment_status,
      'payment_type', v_payment_type,
      'amount', v_amount,
      'currency', v_currency,
      'stripe_account', v_stripe_account,
      'processor_payment_id', v_processor_payment_id,
      'processor_invoice_id', v_processor_invoice_id,
      'metadata', v_metadata
    )),
    v_payment_at
  );

  select p.id
    into v_payment_id
  from command_center.payments p
  where (
      v_source_record_id is not null
      and p.source_system = v_source_system
      and p.source_record_id = v_source_record_id
    )
    or (
      v_processor_payment_id is not null
      and p.processor_name = v_processor_name
      and p.processor_payment_id = v_processor_payment_id
    )
  order by case
    when v_source_record_id is not null
      and p.source_system = v_source_system
      and p.source_record_id = v_source_record_id then 0
    else 1
  end,
  p.updated_at desc
  limit 1;

  if v_payment_id is null then
    insert into command_center.payments (
      lead_id,
      student_id,
      source_event_id,
      assigned_to,
      processor_name,
      stripe_account,
      processor_payment_id,
      processor_invoice_id,
      payment_type,
      payment_status,
      amount,
      currency,
      payment_at,
      source_system,
      source_record_id,
      metadata
    )
    values (
      v_lead_id,
      v_student_id,
      v_event_id,
      coalesce(v_assigned_to, v_anchor_assigned_to, 'phil'),
      v_processor_name,
      v_stripe_account,
      v_processor_payment_id,
      v_processor_invoice_id,
      v_payment_type,
      v_payment_status,
      v_amount,
      v_currency,
      v_payment_at,
      v_source_system,
      v_source_record_id,
      v_metadata
    )
    returning id into v_payment_id;

    v_status := 'inserted';
  else
    update command_center.payments
    set
      lead_id = coalesce(v_lead_id, lead_id),
      student_id = coalesce(v_student_id, student_id),
      source_event_id = v_event_id,
      assigned_to = coalesce(v_assigned_to, assigned_to),
      processor_name = v_processor_name,
      stripe_account = coalesce(v_stripe_account, stripe_account),
      processor_payment_id = coalesce(v_processor_payment_id, processor_payment_id),
      processor_invoice_id = coalesce(v_processor_invoice_id, processor_invoice_id),
      payment_type = v_payment_type,
      payment_status = v_payment_status,
      amount = v_amount,
      currency = v_currency,
      payment_at = v_payment_at,
      metadata = coalesce(metadata, '{}'::jsonb) || v_metadata,
      last_synced_at = now(),
      updated_at = now()
    where id = v_payment_id;

    v_status := 'updated';
  end if;

  if v_student_id is not null then
    update command_center.students
    set
      last_payment_at = greatest(coalesce(last_payment_at, v_payment_at), v_payment_at),
      last_synced_at = now(),
      updated_at = now()
    where id = v_student_id;
  end if;

  return jsonb_build_object(
    'status', v_status,
    'payment_id', v_payment_id,
    'student_id', v_student_id,
    'lead_id', v_lead_id,
    'event_id', v_event_id,
    'source_system', v_source_system,
    'source_record_id', coalesce(v_source_record_id, ''),
    'processor_payment_id', coalesce(v_processor_payment_id, '')
  );
end;
$$;
create or replace function command_center.backfill_email_record(p_payload jsonb)
returns jsonb
language plpgsql
as $$
declare
  v_source_system text := coalesce(nullif(btrim(coalesce(p_payload ->> 'source_system', '')), ''), 'email_log');
  v_source_record_id text := coalesce(
    nullif(btrim(coalesce(p_payload ->> 'source_record_id', '')), ''),
    nullif(btrim(coalesce(p_payload ->> 'gmail_message_id', '')), '')
  );
  v_wordpress_user_id text := nullif(btrim(coalesce(p_payload ->> 'wordpress_user_id', '')), '');
  v_email citext := nullif(lower(btrim(coalesce(p_payload ->> 'email', p_payload ->> 'contact_email', ''))), '')::citext;
  v_subject text := coalesce(nullif(btrim(coalesce(p_payload ->> 'subject', '')), ''), 'Untitled message');
  v_preview_text text := nullif(btrim(coalesce(p_payload ->> 'preview_text', '')), '');
  v_body_draft text := coalesce(p_payload ->> 'body_draft', p_payload ->> 'body_plain', '');
  v_ai_confidence numeric(4,3) := nullif(btrim(coalesce(p_payload ->> 'ai_confidence', '')), '')::numeric;
  v_ai_model text := nullif(btrim(coalesce(p_payload ->> 'ai_model', '')), '');
  v_draft_status text := command_center.normalize_draft_status(p_payload ->> 'draft_status', 'draft');
  v_gmail_thread_id text := nullif(btrim(coalesce(p_payload ->> 'gmail_thread_id', '')), '');
  v_gmail_message_id text := nullif(btrim(coalesce(p_payload ->> 'gmail_message_id', '')), '');
  v_sent_at timestamptz := nullif(btrim(coalesce(p_payload ->> 'sent_at', '')), '')::timestamptz;
  v_created_at timestamptz := coalesce(nullif(btrim(coalesce(p_payload ->> 'created_at', '')), '')::timestamptz, v_sent_at, now());
  v_assigned_to text := command_center.normalize_assigned_to(p_payload ->> 'assigned_to', null);
  v_metadata jsonb := coalesce(p_payload -> 'metadata', '{}'::jsonb);
  v_allow_auto_lead boolean := coalesce(nullif(btrim(coalesce(p_payload ->> 'auto_create_lead', '')), '')::boolean, false);
  v_lead_id uuid;
  v_student_id uuid;
  v_aggregate_type text;
  v_aggregate_id uuid;
  v_anchor_assigned_to text;
  v_event_id uuid;
  v_email_id uuid;
  v_status text;
  v_lead_result jsonb;
begin
  if v_source_record_id is null then
    return jsonb_build_object(
      'status', 'skipped',
      'reason', 'missing_source_record_id',
      'source_system', v_source_system
    );
  end if;

  select lead_id, student_id, assigned_to, aggregate_type, aggregate_id
    into v_lead_id, v_student_id, v_anchor_assigned_to, v_aggregate_type, v_aggregate_id
  from command_center.resolve_anchor(v_email::text, v_wordpress_user_id, v_source_record_id);

  if v_lead_id is null and v_student_id is null and v_allow_auto_lead and v_email is not null then
    v_lead_result := command_center.backfill_lead(jsonb_strip_nulls(jsonb_build_object(
      'source_system', v_source_system,
      'source_record_id', 'email:' || v_source_record_id,
      'email', v_email,
      'full_name', nullif(btrim(coalesce(p_payload ->> 'contact_name', p_payload ->> 'full_name', '')), ''),
      'lead_source', 'email_log',
      'lead_status', 'engaged',
      'funnel_stage', 'lead_captured',
      'assigned_to', coalesce(v_assigned_to, 'brian'),
      'metadata', jsonb_build_object('created_from_email_backfill', true)
    )));

    v_lead_id := nullif(v_lead_result ->> 'lead_id', '')::uuid;
    v_aggregate_type := case when v_lead_id is not null then 'lead' else 'system' end;
    v_aggregate_id := v_lead_id;
  end if;

  if v_lead_id is null and v_student_id is null then
    return jsonb_build_object(
      'status', 'skipped',
      'reason', 'anchor_not_found',
      'email', coalesce(v_email::text, ''),
      'source_system', v_source_system,
      'source_record_id', v_source_record_id
    );
  end if;

  if v_aggregate_type is null then
    v_aggregate_type := case when v_student_id is not null then 'student' else 'lead' end;
  end if;

  if v_aggregate_id is null then
    v_aggregate_id := coalesce(v_student_id, v_lead_id);
  end if;

  v_event_id := command_center.append_event(
    'email.backfilled',
    v_source_system,
    v_aggregate_type,
    v_aggregate_id,
    v_lead_id,
    v_student_id,
    'integration',
    v_gmail_message_id,
    v_source_record_id,
    'backfill:email:' || v_source_system || ':' || v_source_record_id,
    coalesce(v_gmail_thread_id, v_gmail_message_id),
    null,
    jsonb_strip_nulls(jsonb_build_object(
      'subject', v_subject,
      'preview_text', v_preview_text,
      'body_draft', v_body_draft,
      'draft_status', v_draft_status,
      'gmail_thread_id', v_gmail_thread_id,
      'gmail_message_id', v_gmail_message_id,
      'metadata', v_metadata
    )),
    coalesce(v_sent_at, v_created_at, now())
  );

  select e.id
    into v_email_id
  from command_center.email_drafts e
  where e.source_system = v_source_system
    and e.source_record_id = v_source_record_id
  limit 1;

  if v_email_id is null then
    insert into command_center.email_drafts (
      lead_id,
      student_id,
      source_event_id,
      assigned_to,
      gmail_thread_id,
      gmail_message_id,
      subject,
      preview_text,
      body_draft,
      ai_confidence,
      ai_model,
      draft_status,
      sent_at,
      source_system,
      source_record_id,
      metadata
    )
    values (
      v_lead_id,
      v_student_id,
      v_event_id,
      coalesce(v_assigned_to, v_anchor_assigned_to, 'brian'),
      v_gmail_thread_id,
      v_gmail_message_id,
      v_subject,
      v_preview_text,
      v_body_draft,
      v_ai_confidence,
      v_ai_model,
      v_draft_status,
      v_sent_at,
      v_source_system,
      v_source_record_id,
      v_metadata
    )
    returning id into v_email_id;

    v_status := 'inserted';
  else
    update command_center.email_drafts
    set
      lead_id = coalesce(v_lead_id, lead_id),
      student_id = coalesce(v_student_id, student_id),
      source_event_id = v_event_id,
      assigned_to = coalesce(v_assigned_to, assigned_to),
      gmail_thread_id = coalesce(v_gmail_thread_id, gmail_thread_id),
      gmail_message_id = coalesce(v_gmail_message_id, gmail_message_id),
      subject = v_subject,
      preview_text = coalesce(v_preview_text, preview_text),
      body_draft = v_body_draft,
      ai_confidence = coalesce(v_ai_confidence, ai_confidence),
      ai_model = coalesce(v_ai_model, ai_model),
      draft_status = v_draft_status,
      sent_at = coalesce(v_sent_at, sent_at),
      metadata = coalesce(metadata, '{}'::jsonb) || v_metadata,
      last_synced_at = now(),
      updated_at = now()
    where id = v_email_id;

    v_status := 'updated';
  end if;

  return jsonb_build_object(
    'status', v_status,
    'email_draft_id', v_email_id,
    'student_id', v_student_id,
    'lead_id', v_lead_id,
    'event_id', v_event_id,
    'source_system', v_source_system,
    'source_record_id', v_source_record_id
  );
end;
$$;
create or replace function public.mmac_command_center_backfill_leads(p_payloads jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, command_center
as $$
declare
  v_payload jsonb;
  v_results jsonb := '[]'::jsonb;
  v_items jsonb := case
    when p_payloads is null then '[]'::jsonb
    when jsonb_typeof(p_payloads) = 'array' then p_payloads
    else jsonb_build_array(p_payloads)
  end;
begin
  for v_payload in select value from jsonb_array_elements(v_items)
  loop
    v_results := v_results || jsonb_build_array(command_center.backfill_lead(v_payload));
  end loop;

  return v_results;
end;
$$;
create or replace function public.mmac_command_center_backfill_students(p_payloads jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, command_center
as $$
declare
  v_payload jsonb;
  v_results jsonb := '[]'::jsonb;
  v_items jsonb := case
    when p_payloads is null then '[]'::jsonb
    when jsonb_typeof(p_payloads) = 'array' then p_payloads
    else jsonb_build_array(p_payloads)
  end;
begin
  for v_payload in select value from jsonb_array_elements(v_items)
  loop
    v_results := v_results || jsonb_build_array(command_center.backfill_student(v_payload));
  end loop;

  return v_results;
end;
$$;
create or replace function public.mmac_command_center_backfill_lead_scores(p_payloads jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, command_center
as $$
declare
  v_payload jsonb;
  v_results jsonb := '[]'::jsonb;
  v_items jsonb := case
    when p_payloads is null then '[]'::jsonb
    when jsonb_typeof(p_payloads) = 'array' then p_payloads
    else jsonb_build_array(p_payloads)
  end;
begin
  for v_payload in select value from jsonb_array_elements(v_items)
  loop
    v_results := v_results || jsonb_build_array(command_center.backfill_lead_score(v_payload));
  end loop;

  return v_results;
end;
$$;
create or replace function public.mmac_command_center_backfill_payments(p_payloads jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, command_center
as $$
declare
  v_payload jsonb;
  v_results jsonb := '[]'::jsonb;
  v_items jsonb := case
    when p_payloads is null then '[]'::jsonb
    when jsonb_typeof(p_payloads) = 'array' then p_payloads
    else jsonb_build_array(p_payloads)
  end;
begin
  for v_payload in select value from jsonb_array_elements(v_items)
  loop
    v_results := v_results || jsonb_build_array(command_center.backfill_payment(v_payload));
  end loop;

  return v_results;
end;
$$;
create or replace function public.mmac_command_center_backfill_email_queue(p_payloads jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, command_center
as $$
declare
  v_payload jsonb;
  v_results jsonb := '[]'::jsonb;
  v_items jsonb := case
    when p_payloads is null then '[]'::jsonb
    when jsonb_typeof(p_payloads) = 'array' then p_payloads
    else jsonb_build_array(p_payloads)
  end;
begin
  for v_payload in select value from jsonb_array_elements(v_items)
  loop
    v_results := v_results || jsonb_build_array(command_center.backfill_email_record(v_payload));
  end loop;

  return v_results;
end;
$$;
grant execute on function public.mmac_command_center_backfill_leads(jsonb) to service_role;
grant execute on function public.mmac_command_center_backfill_students(jsonb) to service_role;
grant execute on function public.mmac_command_center_backfill_lead_scores(jsonb) to service_role;
grant execute on function public.mmac_command_center_backfill_payments(jsonb) to service_role;
grant execute on function public.mmac_command_center_backfill_email_queue(jsonb) to service_role;
grant select, insert, update on command_center.leads to service_role;
grant select, insert, update on command_center.students to service_role;
grant select, insert, update on command_center.lead_scores to service_role;
grant select, insert, update on command_center.payments to service_role;
grant select, insert, update on command_center.email_drafts to service_role;
grant select, insert, update on command_center.events to service_role;
comment on function public.mmac_command_center_backfill_leads(jsonb)
  is 'NMCC-2E: Batch backfill RPC for command_center.leads. Idempotent by source record or email.';
comment on function public.mmac_command_center_backfill_students(jsonb)
  is 'NMCC-2E: Batch backfill RPC for command_center.students. Idempotent by source record or email.';
comment on function public.mmac_command_center_backfill_lead_scores(jsonb)
  is 'NMCC-2E: Batch backfill RPC for command_center.lead_scores. Idempotent by source record.';
comment on function public.mmac_command_center_backfill_payments(jsonb)
  is 'NMCC-2E: Batch backfill RPC for command_center.payments. Anchors rows to lead/student records server-side.';
comment on function public.mmac_command_center_backfill_email_queue(jsonb)
  is 'NMCC-2E: Batch backfill RPC for command_center.email_drafts. Anchors rows to lead/student records server-side.';
commit;
