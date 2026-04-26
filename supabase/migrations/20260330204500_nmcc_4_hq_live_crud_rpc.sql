begin;
create or replace function public.mmac_cc_create_lead(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, command_center
as $$
declare
  v_now timestamptz := now();
  v_source_system text := coalesce(nullif(btrim(coalesce(p_payload ->> 'source_system', '')), ''), 'hq_manual');
  v_source_record_id text := coalesce(nullif(btrim(coalesce(p_payload ->> 'source_record_id', '')), ''), 'lead:' || gen_random_uuid()::text);
  v_first_name text := nullif(btrim(coalesce(p_payload ->> 'first_name', '')), '');
  v_last_name text := nullif(btrim(coalesce(p_payload ->> 'last_name', '')), '');
  v_email citext := nullif(lower(btrim(coalesce(p_payload ->> 'email', ''))), '')::citext;
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
  v_assigned_to text := command_center.normalize_assigned_to(p_payload ->> 'assigned_to', 'brian');
  v_lead_status text := command_center.normalize_lead_status(p_payload ->> 'lead_status', 'new');
  v_funnel_stage text := command_center.normalize_lead_funnel_stage(p_payload ->> 'funnel_stage', 'lead_captured');
  v_last_contact_at timestamptz := nullif(btrim(coalesce(p_payload ->> 'last_contact_at', '')), '')::timestamptz;
  v_last_engagement_at timestamptz := coalesce(
    nullif(btrim(coalesce(p_payload ->> 'last_engagement_at', '')), '')::timestamptz,
    v_last_contact_at
  );
  v_metadata jsonb := coalesce(p_payload -> 'metadata', '{}'::jsonb);
  v_record command_center.leads;
begin
  if v_full_name is null and v_email is null then
    return jsonb_build_object('error', 'missing_identity');
  end if;

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
    metadata,
    last_synced_at
  )
  values (
    v_assigned_to,
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
    v_lead_status,
    v_funnel_stage,
    v_intake_summary,
    v_last_contact_at,
    v_last_engagement_at,
    v_source_system,
    v_source_record_id,
    v_metadata,
    v_now
  )
  returning * into v_record;

  perform command_center.append_event(
    'lead.created',
    v_source_system,
    'lead',
    v_record.id,
    v_record.id,
    null::uuid,
    'user_action',
    null,
    v_source_record_id,
    null,
    null,
    null,
    jsonb_build_object('lead', to_jsonb(v_record)),
    v_now
  );

  return jsonb_build_object('lead', to_jsonb(v_record));
end;
$$;
create or replace function public.mmac_cc_update_lead(p_lead_id uuid, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, command_center
as $$
declare
  v_now timestamptz := now();
  v_existing command_center.leads;
  v_record command_center.leads;
  v_source_system text;
  v_source_record_id text;
begin
  select *
    into v_existing
  from command_center.leads
  where id = p_lead_id;

  if not found then
    return jsonb_build_object('error', 'lead_not_found');
  end if;

  update command_center.leads
  set
    assigned_to = coalesce(command_center.normalize_assigned_to(p_payload ->> 'assigned_to', null), assigned_to),
    full_name = coalesce(nullif(btrim(coalesce(p_payload ->> 'full_name', '')), ''), full_name),
    first_name = coalesce(nullif(btrim(coalesce(p_payload ->> 'first_name', '')), ''), first_name),
    last_name = coalesce(nullif(btrim(coalesce(p_payload ->> 'last_name', '')), ''), last_name),
    email = coalesce(nullif(lower(btrim(coalesce(p_payload ->> 'email', ''))), '')::citext, email),
    phone = coalesce(nullif(btrim(coalesce(p_payload ->> 'phone', '')), ''), phone),
    country = coalesce(nullif(btrim(coalesce(p_payload ->> 'country', '')), ''), country),
    timezone_name = coalesce(nullif(btrim(coalesce(p_payload ->> 'timezone_name', '')), ''), timezone_name),
    lead_source = coalesce(nullif(btrim(coalesce(p_payload ->> 'lead_source', '')), ''), lead_source),
    lead_source_detail = coalesce(nullif(btrim(coalesce(p_payload ->> 'lead_source_detail', '')), ''), lead_source_detail),
    campaign_name = coalesce(nullif(btrim(coalesce(p_payload ->> 'campaign_name', '')), ''), campaign_name),
    lead_status = coalesce(
      case when nullif(btrim(coalesce(p_payload ->> 'lead_status', '')), '') is null then null
      else command_center.normalize_lead_status(p_payload ->> 'lead_status', lead_status) end,
      lead_status
    ),
    funnel_stage = coalesce(
      case when nullif(btrim(coalesce(p_payload ->> 'funnel_stage', '')), '') is null then null
      else command_center.normalize_lead_funnel_stage(p_payload ->> 'funnel_stage', funnel_stage) end,
      funnel_stage
    ),
    intake_summary = coalesce(nullif(btrim(coalesce(p_payload ->> 'intake_summary', p_payload ->> 'summary', '')), ''), intake_summary),
    last_contact_at = coalesce(nullif(btrim(coalesce(p_payload ->> 'last_contact_at', '')), '')::timestamptz, last_contact_at),
    last_engagement_at = coalesce(nullif(btrim(coalesce(p_payload ->> 'last_engagement_at', '')), '')::timestamptz, last_engagement_at),
    source_system = coalesce(nullif(btrim(coalesce(p_payload ->> 'source_system', '')), ''), source_system),
    source_record_id = coalesce(nullif(btrim(coalesce(p_payload ->> 'source_record_id', '')), ''), source_record_id),
    metadata = case
      when p_payload ? 'metadata' then coalesce(metadata, '{}'::jsonb) || coalesce(p_payload -> 'metadata', '{}'::jsonb)
      else metadata
    end,
    last_synced_at = v_now,
    updated_at = v_now
  where id = p_lead_id
  returning * into v_record;

  v_source_system := coalesce(v_record.source_system, v_existing.source_system, 'hq_manual');
  v_source_record_id := coalesce(v_record.source_record_id, v_existing.source_record_id, 'lead:' || p_lead_id::text);

  perform command_center.append_event(
    'lead.updated',
    v_source_system,
    'lead',
    v_record.id,
    v_record.id,
    null::uuid,
    'user_action',
    null,
    v_source_record_id,
    null,
    null,
    null,
    jsonb_build_object(
      'before', to_jsonb(v_existing),
      'after', to_jsonb(v_record)
    ),
    v_now
  );

  return jsonb_build_object('lead', to_jsonb(v_record));
end;
$$;
create or replace function public.mmac_cc_delete_lead(p_lead_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, command_center
as $$
declare
  v_record command_center.leads;
  v_now timestamptz := now();
begin
  select *
    into v_record
  from command_center.leads
  where id = p_lead_id;

  if not found then
    return jsonb_build_object('error', 'lead_not_found');
  end if;

  perform command_center.append_event(
    'lead.deleted',
    coalesce(v_record.source_system, 'hq_manual'),
    'lead',
    v_record.id,
    null::uuid,
    null::uuid,
    'user_action',
    null,
    coalesce(v_record.source_record_id, 'lead:' || v_record.id::text),
    null,
    null,
    null,
    jsonb_build_object('lead', to_jsonb(v_record)),
    v_now
  );

  delete from command_center.leads
  where id = p_lead_id;

  return jsonb_build_object(
    'deleted', true,
    'lead_id', p_lead_id
  );
end;
$$;
create or replace function public.mmac_cc_create_student(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, command_center
as $$
declare
  v_now timestamptz := now();
  v_source_system text := coalesce(nullif(btrim(coalesce(p_payload ->> 'source_system', '')), ''), 'hq_manual');
  v_source_record_id text := coalesce(nullif(btrim(coalesce(p_payload ->> 'source_record_id', '')), ''), 'student:' || gen_random_uuid()::text);
  v_record command_center.students;
  v_full_name text := nullif(btrim(coalesce(p_payload ->> 'full_name', '')), '');
begin
  if v_full_name is null then
    return jsonb_build_object('error', 'missing_full_name');
  end if;

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
    metadata,
    last_synced_at
  )
  values (
    nullif(btrim(coalesce(p_payload ->> 'originating_lead_id', '')), '')::uuid,
    command_center.normalize_assigned_to(p_payload ->> 'assigned_to', 'brian'),
    v_full_name,
    nullif(btrim(coalesce(p_payload ->> 'preferred_name', '')), ''),
    nullif(lower(btrim(coalesce(p_payload ->> 'email', ''))), '')::citext,
    nullif(btrim(coalesce(p_payload ->> 'phone', '')), ''),
    nullif(btrim(coalesce(p_payload ->> 'country', '')), ''),
    nullif(btrim(coalesce(p_payload ->> 'timezone_name', '')), ''),
    nullif(btrim(coalesce(p_payload ->> 'visa_status', '')), ''),
    nullif(btrim(coalesce(p_payload ->> 'yog', '')), '')::integer,
    nullif(btrim(coalesce(p_payload ->> 'medical_school', '')), ''),
    nullif(btrim(coalesce(p_payload ->> 'match_cycle_year', '')), '')::integer,
    command_center.normalize_program_tier(p_payload ->> 'program_tier', 'mission_residency'),
    command_center.normalize_student_status(p_payload ->> 'student_status', 'active'),
    command_center.normalize_student_funnel_stage(p_payload ->> 'funnel_stage', 'active_training'),
    nullif(btrim(coalesce(p_payload ->> 'enrollment_date', '')), '')::date,
    nullif(btrim(coalesce(p_payload ->> 'last_activity_at', '')), '')::timestamptz,
    nullif(btrim(coalesce(p_payload ->> 'last_payment_at', '')), '')::timestamptz,
    command_center.normalize_risk_level(p_payload ->> 'risk_level', 'info'),
    v_source_system,
    v_source_record_id,
    coalesce(p_payload -> 'metadata', '{}'::jsonb),
    v_now
  )
  returning * into v_record;

  perform command_center.append_event(
    'student.created',
    v_source_system,
    'student',
    v_record.id,
    v_record.originating_lead_id,
    v_record.id,
    'user_action',
    null,
    v_source_record_id,
    null,
    null,
    null,
    jsonb_build_object('student', to_jsonb(v_record)),
    v_now
  );

  return jsonb_build_object('student', to_jsonb(v_record));
end;
$$;
create or replace function public.mmac_cc_update_student(p_student_id uuid, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, command_center
as $$
declare
  v_now timestamptz := now();
  v_existing command_center.students;
  v_record command_center.students;
  v_source_system text;
  v_source_record_id text;
begin
  select *
    into v_existing
  from command_center.students
  where id = p_student_id;

  if not found then
    return jsonb_build_object('error', 'student_not_found');
  end if;

  update command_center.students
  set
    originating_lead_id = coalesce(nullif(btrim(coalesce(p_payload ->> 'originating_lead_id', '')), '')::uuid, originating_lead_id),
    assigned_to = coalesce(command_center.normalize_assigned_to(p_payload ->> 'assigned_to', null), assigned_to),
    full_name = coalesce(nullif(btrim(coalesce(p_payload ->> 'full_name', '')), ''), full_name),
    preferred_name = coalesce(nullif(btrim(coalesce(p_payload ->> 'preferred_name', '')), ''), preferred_name),
    email = coalesce(nullif(lower(btrim(coalesce(p_payload ->> 'email', ''))), '')::citext, email),
    phone = coalesce(nullif(btrim(coalesce(p_payload ->> 'phone', '')), ''), phone),
    country = coalesce(nullif(btrim(coalesce(p_payload ->> 'country', '')), ''), country),
    timezone_name = coalesce(nullif(btrim(coalesce(p_payload ->> 'timezone_name', '')), ''), timezone_name),
    visa_status = coalesce(nullif(btrim(coalesce(p_payload ->> 'visa_status', '')), ''), visa_status),
    yog = coalesce(nullif(btrim(coalesce(p_payload ->> 'yog', '')), '')::integer, yog),
    medical_school = coalesce(nullif(btrim(coalesce(p_payload ->> 'medical_school', '')), ''), medical_school),
    match_cycle_year = coalesce(nullif(btrim(coalesce(p_payload ->> 'match_cycle_year', '')), '')::integer, match_cycle_year),
    program_tier = coalesce(
      case when nullif(btrim(coalesce(p_payload ->> 'program_tier', '')), '') is null then null
      else command_center.normalize_program_tier(p_payload ->> 'program_tier', program_tier) end,
      program_tier
    ),
    student_status = coalesce(
      case when nullif(btrim(coalesce(p_payload ->> 'student_status', '')), '') is null then null
      else command_center.normalize_student_status(p_payload ->> 'student_status', student_status) end,
      student_status
    ),
    funnel_stage = coalesce(
      case when nullif(btrim(coalesce(p_payload ->> 'funnel_stage', '')), '') is null then null
      else command_center.normalize_student_funnel_stage(p_payload ->> 'funnel_stage', funnel_stage) end,
      funnel_stage
    ),
    enrollment_date = coalesce(nullif(btrim(coalesce(p_payload ->> 'enrollment_date', '')), '')::date, enrollment_date),
    last_activity_at = coalesce(nullif(btrim(coalesce(p_payload ->> 'last_activity_at', '')), '')::timestamptz, last_activity_at),
    last_payment_at = coalesce(nullif(btrim(coalesce(p_payload ->> 'last_payment_at', '')), '')::timestamptz, last_payment_at),
    risk_level = coalesce(
      case when nullif(btrim(coalesce(p_payload ->> 'risk_level', '')), '') is null then null
      else command_center.normalize_risk_level(p_payload ->> 'risk_level', risk_level) end,
      risk_level
    ),
    source_system = coalesce(nullif(btrim(coalesce(p_payload ->> 'source_system', '')), ''), source_system),
    source_record_id = coalesce(nullif(btrim(coalesce(p_payload ->> 'source_record_id', '')), ''), source_record_id),
    metadata = case
      when p_payload ? 'metadata' then coalesce(metadata, '{}'::jsonb) || coalesce(p_payload -> 'metadata', '{}'::jsonb)
      else metadata
    end,
    last_synced_at = v_now,
    updated_at = v_now
  where id = p_student_id
  returning * into v_record;

  v_source_system := coalesce(v_record.source_system, v_existing.source_system, 'hq_manual');
  v_source_record_id := coalesce(v_record.source_record_id, v_existing.source_record_id, 'student:' || p_student_id::text);

  perform command_center.append_event(
    'student.updated',
    v_source_system,
    'student',
    v_record.id,
    v_record.originating_lead_id,
    v_record.id,
    'user_action',
    null,
    v_source_record_id,
    null,
    null,
    null,
    jsonb_build_object(
      'before', to_jsonb(v_existing),
      'after', to_jsonb(v_record)
    ),
    v_now
  );

  return jsonb_build_object('student', to_jsonb(v_record));
end;
$$;
create or replace function public.mmac_cc_delete_student(p_student_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, command_center
as $$
declare
  v_record command_center.students;
  v_now timestamptz := now();
begin
  select *
    into v_record
  from command_center.students
  where id = p_student_id;

  if not found then
    return jsonb_build_object('error', 'student_not_found');
  end if;

  perform command_center.append_event(
    'student.deleted',
    coalesce(v_record.source_system, 'hq_manual'),
    'student',
    v_record.id,
    null::uuid,
    null::uuid,
    'user_action',
    null,
    coalesce(v_record.source_record_id, 'student:' || v_record.id::text),
    null,
    null,
    null,
    jsonb_build_object('student', to_jsonb(v_record)),
    v_now
  );

  delete from command_center.students
  where id = p_student_id;

  return jsonb_build_object(
    'deleted', true,
    'student_id', p_student_id
  );
end;
$$;
create or replace function public.mmac_cc_create_payment(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, command_center
as $$
declare
  v_now timestamptz := now();
  v_source_system text := coalesce(nullif(btrim(coalesce(p_payload ->> 'source_system', '')), ''), 'hq_manual');
  v_source_record_id text := coalesce(nullif(btrim(coalesce(p_payload ->> 'source_record_id', '')), ''), 'payment:' || gen_random_uuid()::text);
  v_record command_center.payments;
  v_event_id uuid;
  v_lead_id uuid := nullif(btrim(coalesce(p_payload ->> 'lead_id', '')), '')::uuid;
  v_student_id uuid := nullif(btrim(coalesce(p_payload ->> 'student_id', '')), '')::uuid;
  v_amount numeric(12,2) := nullif(btrim(coalesce(p_payload ->> 'amount', '')), '')::numeric;
begin
  if v_lead_id is null and v_student_id is null then
    return jsonb_build_object('error', 'missing_anchor');
  end if;

  if v_amount is null then
    return jsonb_build_object('error', 'missing_amount');
  end if;

  insert into command_center.payments (
    lead_id,
    student_id,
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
    metadata,
    last_synced_at
  )
  values (
    v_lead_id,
    v_student_id,
    command_center.normalize_assigned_to(p_payload ->> 'assigned_to', 'phil'),
    case lower(coalesce(nullif(btrim(coalesce(p_payload ->> 'processor_name', '')), ''), 'stripe'))
      when 'stripe' then 'stripe'
      when 'woocommerce' then 'woocommerce'
      when 'manual' then 'manual'
      when 'other' then 'other'
      else 'stripe'
    end,
    nullif(btrim(coalesce(p_payload ->> 'stripe_account', '')), ''),
    nullif(btrim(coalesce(p_payload ->> 'processor_payment_id', '')), ''),
    nullif(btrim(coalesce(p_payload ->> 'processor_invoice_id', '')), ''),
    command_center.normalize_payment_type(p_payload ->> 'payment_type', 'charge'),
    command_center.normalize_payment_status(p_payload ->> 'payment_status', 'pending'),
    v_amount,
    lower(coalesce(nullif(btrim(coalesce(p_payload ->> 'currency', '')), ''), 'usd')),
    coalesce(nullif(btrim(coalesce(p_payload ->> 'payment_at', '')), '')::timestamptz, v_now),
    v_source_system,
    v_source_record_id,
    coalesce(p_payload -> 'metadata', '{}'::jsonb),
    v_now
  )
  returning * into v_record;

  v_event_id := command_center.append_event(
    'payment.created',
    v_source_system,
    'payment',
    v_record.id,
    v_record.lead_id,
    v_record.student_id,
    'user_action',
    null,
    v_source_record_id,
    null,
    null,
    null,
    jsonb_build_object('payment', to_jsonb(v_record)),
    v_now
  );

  update command_center.payments
  set source_event_id = v_event_id
  where id = v_record.id
  returning * into v_record;

  return jsonb_build_object('payment', to_jsonb(v_record));
end;
$$;
create or replace function public.mmac_cc_update_payment(p_payment_id uuid, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, command_center
as $$
declare
  v_now timestamptz := now();
  v_existing command_center.payments;
  v_record command_center.payments;
  v_event_id uuid;
  v_source_system text;
  v_source_record_id text;
begin
  select *
    into v_existing
  from command_center.payments
  where id = p_payment_id;

  if not found then
    return jsonb_build_object('error', 'payment_not_found');
  end if;

  update command_center.payments
  set
    lead_id = coalesce(nullif(btrim(coalesce(p_payload ->> 'lead_id', '')), '')::uuid, lead_id),
    student_id = coalesce(nullif(btrim(coalesce(p_payload ->> 'student_id', '')), '')::uuid, student_id),
    assigned_to = coalesce(command_center.normalize_assigned_to(p_payload ->> 'assigned_to', null), assigned_to),
    processor_name = coalesce(
      case when nullif(btrim(coalesce(p_payload ->> 'processor_name', '')), '') is null then null
      else case lower(p_payload ->> 'processor_name')
        when 'stripe' then 'stripe'
        when 'woocommerce' then 'woocommerce'
        when 'manual' then 'manual'
        when 'other' then 'other'
        else processor_name
      end end,
      processor_name
    ),
    stripe_account = coalesce(nullif(btrim(coalesce(p_payload ->> 'stripe_account', '')), ''), stripe_account),
    processor_payment_id = coalesce(nullif(btrim(coalesce(p_payload ->> 'processor_payment_id', '')), ''), processor_payment_id),
    processor_invoice_id = coalesce(nullif(btrim(coalesce(p_payload ->> 'processor_invoice_id', '')), ''), processor_invoice_id),
    payment_type = coalesce(
      case when nullif(btrim(coalesce(p_payload ->> 'payment_type', '')), '') is null then null
      else command_center.normalize_payment_type(p_payload ->> 'payment_type', payment_type) end,
      payment_type
    ),
    payment_status = coalesce(
      case when nullif(btrim(coalesce(p_payload ->> 'payment_status', '')), '') is null then null
      else command_center.normalize_payment_status(p_payload ->> 'payment_status', payment_status) end,
      payment_status
    ),
    amount = coalesce(nullif(btrim(coalesce(p_payload ->> 'amount', '')), '')::numeric, amount),
    currency = coalesce(lower(nullif(btrim(coalesce(p_payload ->> 'currency', '')), '')), currency),
    payment_at = coalesce(nullif(btrim(coalesce(p_payload ->> 'payment_at', '')), '')::timestamptz, payment_at),
    source_system = coalesce(nullif(btrim(coalesce(p_payload ->> 'source_system', '')), ''), source_system),
    source_record_id = coalesce(nullif(btrim(coalesce(p_payload ->> 'source_record_id', '')), ''), source_record_id),
    metadata = case
      when p_payload ? 'metadata' then coalesce(metadata, '{}'::jsonb) || coalesce(p_payload -> 'metadata', '{}'::jsonb)
      else metadata
    end,
    last_synced_at = v_now,
    updated_at = v_now
  where id = p_payment_id
  returning * into v_record;

  v_source_system := coalesce(v_record.source_system, v_existing.source_system, 'hq_manual');
  v_source_record_id := coalesce(v_record.source_record_id, v_existing.source_record_id, 'payment:' || p_payment_id::text);
  v_event_id := command_center.append_event(
    'payment.updated',
    v_source_system,
    'payment',
    v_record.id,
    v_record.lead_id,
    v_record.student_id,
    'user_action',
    null,
    v_source_record_id,
    null,
    null,
    null,
    jsonb_build_object(
      'before', to_jsonb(v_existing),
      'after', to_jsonb(v_record)
    ),
    v_now
  );

  update command_center.payments
  set source_event_id = v_event_id
  where id = v_record.id
  returning * into v_record;

  return jsonb_build_object('payment', to_jsonb(v_record));
end;
$$;
create or replace function public.mmac_cc_delete_payment(p_payment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, command_center
as $$
declare
  v_record command_center.payments;
  v_now timestamptz := now();
begin
  select *
    into v_record
  from command_center.payments
  where id = p_payment_id;

  if not found then
    return jsonb_build_object('error', 'payment_not_found');
  end if;

  perform command_center.append_event(
    'payment.deleted',
    coalesce(v_record.source_system, 'hq_manual'),
    'payment',
    v_record.id,
    v_record.lead_id,
    v_record.student_id,
    'user_action',
    null,
    coalesce(v_record.source_record_id, 'payment:' || v_record.id::text),
    null,
    null,
    null,
    jsonb_build_object('payment', to_jsonb(v_record)),
    v_now
  );

  delete from command_center.payments
  where id = p_payment_id;

  return jsonb_build_object(
    'deleted', true,
    'payment_id', p_payment_id
  );
end;
$$;
create or replace function public.mmac_cc_create_email_draft(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, command_center
as $$
declare
  v_now timestamptz := now();
  v_source_system text := coalesce(nullif(btrim(coalesce(p_payload ->> 'source_system', '')), ''), 'hq_manual');
  v_source_record_id text := coalesce(nullif(btrim(coalesce(p_payload ->> 'source_record_id', '')), ''), 'email:' || gen_random_uuid()::text);
  v_record command_center.email_drafts;
  v_event_id uuid;
  v_lead_id uuid := nullif(btrim(coalesce(p_payload ->> 'lead_id', '')), '')::uuid;
  v_student_id uuid := nullif(btrim(coalesce(p_payload ->> 'student_id', '')), '')::uuid;
  v_subject text := nullif(btrim(coalesce(p_payload ->> 'subject', '')), '');
begin
  if v_lead_id is null and v_student_id is null then
    return jsonb_build_object('error', 'missing_anchor');
  end if;

  if v_subject is null then
    return jsonb_build_object('error', 'missing_subject');
  end if;

  insert into command_center.email_drafts (
    lead_id,
    student_id,
    assigned_to,
    gmail_thread_id,
    gmail_message_id,
    subject,
    preview_text,
    body_draft,
    ai_confidence,
    ai_model,
    draft_status,
    edited_by,
    sent_at,
    source_system,
    source_record_id,
    metadata,
    last_synced_at
  )
  values (
    v_lead_id,
    v_student_id,
    command_center.normalize_assigned_to(p_payload ->> 'assigned_to', 'brian'),
    nullif(btrim(coalesce(p_payload ->> 'gmail_thread_id', '')), ''),
    nullif(btrim(coalesce(p_payload ->> 'gmail_message_id', '')), ''),
    v_subject,
    nullif(btrim(coalesce(p_payload ->> 'preview_text', '')), ''),
    coalesce(p_payload ->> 'body_draft', p_payload ->> 'body_plain', ''),
    nullif(btrim(coalesce(p_payload ->> 'ai_confidence', '')), '')::numeric,
    nullif(btrim(coalesce(p_payload ->> 'ai_model', '')), ''),
    command_center.normalize_draft_status(p_payload ->> 'draft_status', 'draft'),
    nullif(btrim(coalesce(p_payload ->> 'edited_by', '')), ''),
    nullif(btrim(coalesce(p_payload ->> 'sent_at', '')), '')::timestamptz,
    v_source_system,
    v_source_record_id,
    coalesce(p_payload -> 'metadata', '{}'::jsonb),
    v_now
  )
  returning * into v_record;

  v_event_id := command_center.append_event(
    'email_draft.created',
    v_source_system,
    'email_draft',
    v_record.id,
    v_record.lead_id,
    v_record.student_id,
    'user_action',
    null,
    v_source_record_id,
    null,
    null,
    null,
    jsonb_build_object('email_draft', to_jsonb(v_record)),
    v_now
  );

  update command_center.email_drafts
  set source_event_id = v_event_id
  where id = v_record.id
  returning * into v_record;

  return jsonb_build_object('email_draft', to_jsonb(v_record));
end;
$$;
create or replace function public.mmac_cc_update_email_draft(p_email_draft_id uuid, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, command_center
as $$
declare
  v_now timestamptz := now();
  v_existing command_center.email_drafts;
  v_record command_center.email_drafts;
  v_event_id uuid;
  v_source_system text;
  v_source_record_id text;
begin
  select *
    into v_existing
  from command_center.email_drafts
  where id = p_email_draft_id;

  if not found then
    return jsonb_build_object('error', 'email_draft_not_found');
  end if;

  update command_center.email_drafts
  set
    lead_id = coalesce(nullif(btrim(coalesce(p_payload ->> 'lead_id', '')), '')::uuid, lead_id),
    student_id = coalesce(nullif(btrim(coalesce(p_payload ->> 'student_id', '')), '')::uuid, student_id),
    assigned_to = coalesce(command_center.normalize_assigned_to(p_payload ->> 'assigned_to', null), assigned_to),
    gmail_thread_id = coalesce(nullif(btrim(coalesce(p_payload ->> 'gmail_thread_id', '')), ''), gmail_thread_id),
    gmail_message_id = coalesce(nullif(btrim(coalesce(p_payload ->> 'gmail_message_id', '')), ''), gmail_message_id),
    subject = coalesce(nullif(btrim(coalesce(p_payload ->> 'subject', '')), ''), subject),
    preview_text = coalesce(nullif(btrim(coalesce(p_payload ->> 'preview_text', '')), ''), preview_text),
    body_draft = coalesce(p_payload ->> 'body_draft', p_payload ->> 'body_plain', body_draft),
    ai_confidence = coalesce(nullif(btrim(coalesce(p_payload ->> 'ai_confidence', '')), '')::numeric, ai_confidence),
    ai_model = coalesce(nullif(btrim(coalesce(p_payload ->> 'ai_model', '')), ''), ai_model),
    draft_status = coalesce(
      case when nullif(btrim(coalesce(p_payload ->> 'draft_status', '')), '') is null then null
      else command_center.normalize_draft_status(p_payload ->> 'draft_status', draft_status) end,
      draft_status
    ),
    edited_by = coalesce(nullif(btrim(coalesce(p_payload ->> 'edited_by', '')), ''), edited_by),
    sent_at = coalesce(nullif(btrim(coalesce(p_payload ->> 'sent_at', '')), '')::timestamptz, sent_at),
    source_system = coalesce(nullif(btrim(coalesce(p_payload ->> 'source_system', '')), ''), source_system),
    source_record_id = coalesce(nullif(btrim(coalesce(p_payload ->> 'source_record_id', '')), ''), source_record_id),
    metadata = case
      when p_payload ? 'metadata' then coalesce(metadata, '{}'::jsonb) || coalesce(p_payload -> 'metadata', '{}'::jsonb)
      else metadata
    end,
    last_synced_at = v_now,
    updated_at = v_now
  where id = p_email_draft_id
  returning * into v_record;

  v_source_system := coalesce(v_record.source_system, v_existing.source_system, 'hq_manual');
  v_source_record_id := coalesce(v_record.source_record_id, v_existing.source_record_id, 'email:' || p_email_draft_id::text);
  v_event_id := command_center.append_event(
    'email_draft.updated',
    v_source_system,
    'email_draft',
    v_record.id,
    v_record.lead_id,
    v_record.student_id,
    'user_action',
    null,
    v_source_record_id,
    null,
    null,
    null,
    jsonb_build_object(
      'before', to_jsonb(v_existing),
      'after', to_jsonb(v_record)
    ),
    v_now
  );

  update command_center.email_drafts
  set source_event_id = v_event_id
  where id = v_record.id
  returning * into v_record;

  return jsonb_build_object('email_draft', to_jsonb(v_record));
end;
$$;
create or replace function public.mmac_cc_delete_email_draft(p_email_draft_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, command_center
as $$
declare
  v_record command_center.email_drafts;
  v_now timestamptz := now();
begin
  select *
    into v_record
  from command_center.email_drafts
  where id = p_email_draft_id;

  if not found then
    return jsonb_build_object('error', 'email_draft_not_found');
  end if;

  perform command_center.append_event(
    'email_draft.deleted',
    coalesce(v_record.source_system, 'hq_manual'),
    'email_draft',
    v_record.id,
    v_record.lead_id,
    v_record.student_id,
    'user_action',
    null,
    coalesce(v_record.source_record_id, 'email:' || v_record.id::text),
    null,
    null,
    null,
    jsonb_build_object('email_draft', to_jsonb(v_record)),
    v_now
  );

  delete from command_center.email_drafts
  where id = p_email_draft_id;

  return jsonb_build_object(
    'deleted', true,
    'email_draft_id', p_email_draft_id
  );
end;
$$;
grant execute on function public.mmac_cc_create_lead(jsonb) to service_role;
grant execute on function public.mmac_cc_update_lead(uuid, jsonb) to service_role;
grant execute on function public.mmac_cc_delete_lead(uuid) to service_role;
grant execute on function public.mmac_cc_create_student(jsonb) to service_role;
grant execute on function public.mmac_cc_update_student(uuid, jsonb) to service_role;
grant execute on function public.mmac_cc_delete_student(uuid) to service_role;
grant execute on function public.mmac_cc_create_payment(jsonb) to service_role;
grant execute on function public.mmac_cc_update_payment(uuid, jsonb) to service_role;
grant execute on function public.mmac_cc_delete_payment(uuid) to service_role;
grant execute on function public.mmac_cc_create_email_draft(jsonb) to service_role;
grant execute on function public.mmac_cc_update_email_draft(uuid, jsonb) to service_role;
grant execute on function public.mmac_cc_delete_email_draft(uuid) to service_role;
comment on function public.mmac_cc_create_lead(jsonb)
  is 'Create a live command_center.leads row for MissionMed HQ.';
comment on function public.mmac_cc_update_lead(uuid, jsonb)
  is 'Update a live command_center.leads row for MissionMed HQ.';
comment on function public.mmac_cc_delete_lead(uuid)
  is 'Delete a live command_center.leads row for MissionMed HQ.';
comment on function public.mmac_cc_create_student(jsonb)
  is 'Create a live command_center.students row for MissionMed HQ.';
comment on function public.mmac_cc_update_student(uuid, jsonb)
  is 'Update a live command_center.students row for MissionMed HQ.';
comment on function public.mmac_cc_delete_student(uuid)
  is 'Delete a live command_center.students row for MissionMed HQ.';
comment on function public.mmac_cc_create_payment(jsonb)
  is 'Create a live command_center.payments row for MissionMed HQ.';
comment on function public.mmac_cc_update_payment(uuid, jsonb)
  is 'Update a live command_center.payments row for MissionMed HQ.';
comment on function public.mmac_cc_delete_payment(uuid)
  is 'Delete a live command_center.payments row for MissionMed HQ.';
comment on function public.mmac_cc_create_email_draft(jsonb)
  is 'Create a live command_center.email_drafts row for MissionMed HQ.';
comment on function public.mmac_cc_update_email_draft(uuid, jsonb)
  is 'Update a live command_center.email_drafts row for MissionMed HQ.';
comment on function public.mmac_cc_delete_email_draft(uuid)
  is 'Delete a live command_center.email_drafts row for MissionMed HQ.';
commit;
