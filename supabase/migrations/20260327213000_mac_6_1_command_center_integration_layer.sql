begin;
create or replace function command_center.resolve_anchor(
  p_email text default null,
  p_wordpress_user_id text default null,
  p_source_record_id text default null
)
returns table (
  lead_id uuid,
  student_id uuid,
  assigned_to text,
  aggregate_type text,
  aggregate_id uuid
)
language plpgsql
stable
as $$
declare
  v_student_id uuid;
  v_lead_id uuid;
  v_assigned_to text := 'system';
begin
  if nullif(btrim(coalesce(p_email, '')), '') is not null then
    select s.id, s.originating_lead_id, s.assigned_to
      into v_student_id, v_lead_id, v_assigned_to
    from command_center.students s
    where s.email = p_email::citext
    order by s.updated_at desc
    limit 1;
  end if;

  if v_student_id is null and nullif(btrim(coalesce(p_wordpress_user_id, '')), '') is not null then
    select s.id, s.originating_lead_id, s.assigned_to
      into v_student_id, v_lead_id, v_assigned_to
    from command_center.students s
    where s.source_record_id = p_wordpress_user_id
       or s.metadata ->> 'wp_user_id' = p_wordpress_user_id
       or s.metadata ->> 'wordpress_user_id' = p_wordpress_user_id
    order by s.updated_at desc
    limit 1;
  end if;

  if v_student_id is null and nullif(btrim(coalesce(p_source_record_id, '')), '') is not null then
    select s.id, s.originating_lead_id, s.assigned_to
      into v_student_id, v_lead_id, v_assigned_to
    from command_center.students s
    where s.source_record_id = p_source_record_id
    order by s.updated_at desc
    limit 1;
  end if;

  if v_lead_id is null and nullif(btrim(coalesce(p_email, '')), '') is not null then
    select l.id, l.assigned_to
      into v_lead_id, v_assigned_to
    from command_center.leads l
    where l.email = p_email::citext
    order by l.updated_at desc
    limit 1;
  end if;

  if v_lead_id is null and nullif(btrim(coalesce(p_wordpress_user_id, '')), '') is not null then
    select l.id, l.assigned_to
      into v_lead_id, v_assigned_to
    from command_center.leads l
    where l.source_record_id = p_wordpress_user_id
       or l.metadata ->> 'wp_user_id' = p_wordpress_user_id
       or l.metadata ->> 'wordpress_user_id' = p_wordpress_user_id
    order by l.updated_at desc
    limit 1;
  end if;

  if v_lead_id is null and nullif(btrim(coalesce(p_source_record_id, '')), '') is not null then
    select l.id, l.assigned_to
      into v_lead_id, v_assigned_to
    from command_center.leads l
    where l.source_record_id = p_source_record_id
    order by l.updated_at desc
    limit 1;
  end if;

  if v_student_id is not null then
    return query
    select
      v_lead_id,
      v_student_id,
      coalesce(v_assigned_to, 'system'),
      'student'::text,
      v_student_id;
    return;
  end if;

  if v_lead_id is not null then
    return query
    select
      v_lead_id,
      null::uuid,
      coalesce(v_assigned_to, 'brian'),
      'lead'::text,
      v_lead_id;
    return;
  end if;

  return query
  select
    null::uuid,
    null::uuid,
    'system'::text,
    'system'::text,
    null::uuid;
end;
$$;
create or replace function command_center.project_integration_event()
returns trigger
language plpgsql
as $$
declare
  v_assigned_to text;
  v_amount numeric(12,2);
  v_currency text;
  v_payment_at timestamptz;
  v_payment_source_record text;
  v_draft_source_record text;
  v_activity_at timestamptz;
begin
  if new.event_family <> 'integration' then
    return new;
  end if;

  if new.source_system = 'stripe' or new.event_type like 'stripe.%' then
    v_assigned_to := coalesce(
      nullif(new.payload ->> 'assigned_to', ''),
      (select s.assigned_to from command_center.students s where s.id = new.student_id),
      (select l.assigned_to from command_center.leads l where l.id = coalesce(new.lead_id, (select s.originating_lead_id from command_center.students s where s.id = new.student_id))),
      'phil'
    );
    v_amount := coalesce(nullif(new.payload ->> 'amount', '')::numeric, 0);
    v_currency := lower(coalesce(nullif(new.payload ->> 'currency', ''), 'usd'));
    v_payment_at := coalesce(nullif(new.payload ->> 'payment_at', '')::timestamptz, new.occurred_at);
    v_payment_source_record := coalesce(
      nullif(new.source_record_id, ''),
      nullif(new.payload ->> 'record_key', ''),
      'stripe-event:' || new.id::text
    );

    if new.lead_id is not null or new.student_id is not null then
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
        new.lead_id,
        new.student_id,
        new.id,
        v_assigned_to,
        'stripe',
        nullif(new.payload ->> 'stripe_account', ''),
        coalesce(
          nullif(new.payload ->> 'payment_id', ''),
          nullif(new.payload ->> 'charge_id', ''),
          nullif(new.payload ->> 'refund_id', '')
        ),
        nullif(new.payload ->> 'invoice_id', ''),
        coalesce(nullif(new.payload ->> 'payment_type', ''), 'charge'),
        coalesce(nullif(new.payload ->> 'payment_status', ''), 'pending'),
        v_amount,
        v_currency,
        v_payment_at,
        'stripe',
        v_payment_source_record,
        new.payload
      )
      on conflict (source_system, source_record_id) where source_record_id is not null
      do update set
        lead_id = excluded.lead_id,
        student_id = excluded.student_id,
        source_event_id = excluded.source_event_id,
        assigned_to = excluded.assigned_to,
        stripe_account = excluded.stripe_account,
        processor_payment_id = excluded.processor_payment_id,
        processor_invoice_id = excluded.processor_invoice_id,
        payment_type = excluded.payment_type,
        payment_status = excluded.payment_status,
        amount = excluded.amount,
        currency = excluded.currency,
        payment_at = excluded.payment_at,
        metadata = excluded.metadata,
        updated_at = now(),
        last_synced_at = now();
    end if;

    if new.student_id is not null then
      update command_center.students
      set last_payment_at = greatest(coalesce(last_payment_at, v_payment_at), v_payment_at),
          last_synced_at = now()
      where id = new.student_id;
    end if;
  end if;

  if new.source_system = 'gmail' or new.event_type like 'gmail.%' then
    v_activity_at := coalesce(nullif(new.payload ->> 'occurred_at', '')::timestamptz, new.occurred_at);

    if new.event_type in ('gmail.message.received', 'gmail.message.sent') then
      if new.student_id is not null then
        update command_center.students
        set last_activity_at = greatest(coalesce(last_activity_at, v_activity_at), v_activity_at),
            last_synced_at = now()
        where id = new.student_id;
      end if;

      if new.lead_id is not null then
        update command_center.leads
        set last_contact_at = greatest(coalesce(last_contact_at, v_activity_at), v_activity_at),
            last_engagement_at = greatest(coalesce(last_engagement_at, v_activity_at), v_activity_at),
            last_synced_at = now()
        where id = new.lead_id;
      end if;
    end if;

    if new.event_type like 'gmail.draft.%' and (new.lead_id is not null or new.student_id is not null) then
      v_assigned_to := coalesce(
        nullif(new.payload ->> 'assigned_to', ''),
        (select s.assigned_to from command_center.students s where s.id = new.student_id),
        (select l.assigned_to from command_center.leads l where l.id = coalesce(new.lead_id, (select s.originating_lead_id from command_center.students s where s.id = new.student_id))),
        'brian'
      );
      v_draft_source_record := coalesce(
        nullif(new.source_record_id, ''),
        nullif(new.payload ->> 'record_key', ''),
        'gmail-draft:' || new.id::text
      );

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
        source_system,
        source_record_id,
        metadata
      )
      values (
        new.lead_id,
        new.student_id,
        new.id,
        v_assigned_to,
        nullif(new.payload ->> 'gmail_thread_id', ''),
        nullif(new.payload ->> 'gmail_message_id', ''),
        coalesce(nullif(new.payload ->> 'subject', ''), 'Untitled draft'),
        nullif(new.payload ->> 'preview_text', ''),
        coalesce(nullif(new.payload ->> 'body_draft', ''), ''),
        nullif(new.payload ->> 'ai_confidence', '')::numeric,
        nullif(new.payload ->> 'ai_model', ''),
        coalesce(nullif(new.payload ->> 'draft_status', ''), 'draft'),
        'gmail',
        v_draft_source_record,
        new.payload
      )
      on conflict (source_system, source_record_id) where source_record_id is not null
      do update set
        lead_id = excluded.lead_id,
        student_id = excluded.student_id,
        source_event_id = excluded.source_event_id,
        assigned_to = excluded.assigned_to,
        gmail_thread_id = excluded.gmail_thread_id,
        gmail_message_id = excluded.gmail_message_id,
        subject = excluded.subject,
        preview_text = excluded.preview_text,
        body_draft = excluded.body_draft,
        ai_confidence = excluded.ai_confidence,
        ai_model = excluded.ai_model,
        draft_status = excluded.draft_status,
        metadata = excluded.metadata,
        updated_at = now(),
        last_synced_at = now();
    end if;
  end if;

  if new.source_system = 'learndash' or new.event_type like 'learndash.%' then
    v_activity_at := coalesce(nullif(new.payload ->> 'occurred_at', '')::timestamptz, new.occurred_at);

    if new.student_id is not null then
      update command_center.students
      set last_activity_at = greatest(coalesce(last_activity_at, v_activity_at), v_activity_at),
          last_synced_at = now()
      where id = new.student_id;
    end if;
  end if;

  return new;
end;
$$;
drop trigger if exists trg_command_center_project_integration_event on command_center.events;
create trigger trg_command_center_project_integration_event
after insert or update on command_center.events
for each row execute function command_center.project_integration_event();
create or replace function command_center.ingest_stripe_event(p_payload jsonb)
returns jsonb
language plpgsql
as $$
declare
  v_event_id uuid;
  v_lead_id uuid;
  v_student_id uuid;
  v_assigned_to text;
  v_aggregate_type text;
  v_aggregate_id uuid;
  v_email text;
  v_source_record_id text;
  v_external_event_id text;
  v_dedupe_key text;
begin
  v_email := lower(nullif(btrim(coalesce(p_payload ->> 'customer_email', p_payload ->> 'billing_email', p_payload ->> 'email')), ''));
  v_source_record_id := coalesce(
    nullif(p_payload ->> 'source_record_id', ''),
    nullif(p_payload ->> 'record_key', ''),
    nullif(p_payload ->> 'payment_id', ''),
    nullif(p_payload ->> 'refund_id', ''),
    nullif(p_payload ->> 'invoice_id', ''),
    nullif(p_payload ->> 'event_id', '')
  );
  v_external_event_id := nullif(p_payload ->> 'event_id', '');
  v_dedupe_key := coalesce(
    nullif(p_payload ->> 'dedupe_key', ''),
    case
      when v_external_event_id is not null then 'stripe:' || v_external_event_id
      when v_source_record_id is not null then 'stripe:' || v_source_record_id
      else 'stripe:' || md5(coalesce(p_payload::text, '{}'))
    end
  );

  select lead_id, student_id, assigned_to, aggregate_type, aggregate_id
    into v_lead_id, v_student_id, v_assigned_to, v_aggregate_type, v_aggregate_id
  from command_center.resolve_anchor(v_email, p_payload ->> 'wordpress_user_id', v_source_record_id);

  v_event_id := command_center.append_event(
    coalesce(nullif(p_payload ->> 'event_type', ''), 'stripe.event.received'),
    'stripe',
    coalesce(v_aggregate_type, 'system'),
    v_aggregate_id,
    v_lead_id,
    v_student_id,
    'integration',
    v_external_event_id,
    v_source_record_id,
    v_dedupe_key,
    coalesce(
      nullif(p_payload ->> 'correlation_id', ''),
      nullif(p_payload ->> 'payment_id', ''),
      nullif(p_payload ->> 'invoice_id', ''),
      nullif(p_payload ->> 'customer_id', '')
    ),
    null,
    p_payload,
    coalesce(nullif(p_payload ->> 'occurred_at', '')::timestamptz, now())
  );

  return jsonb_build_object(
    'event_id', v_event_id,
    'lead_id', v_lead_id,
    'student_id', v_student_id,
    'assigned_to', coalesce(v_assigned_to, 'system'),
    'source_record_id', v_source_record_id
  );
end;
$$;
create or replace function command_center.ingest_gmail_message(p_payload jsonb)
returns jsonb
language plpgsql
as $$
declare
  v_event_id uuid;
  v_lead_id uuid;
  v_student_id uuid;
  v_assigned_to text;
  v_aggregate_type text;
  v_aggregate_id uuid;
  v_email text;
  v_source_record_id text;
  v_dedupe_key text;
begin
  v_email := lower(nullif(btrim(coalesce(p_payload ->> 'contact_email', p_payload ->> 'email')), ''));
  v_source_record_id := coalesce(
    nullif(p_payload ->> 'source_record_id', ''),
    nullif(p_payload ->> 'record_key', ''),
    nullif(p_payload ->> 'gmail_message_id', '')
  );
  v_dedupe_key := coalesce(
    nullif(p_payload ->> 'dedupe_key', ''),
    case
      when v_source_record_id is not null then 'gmail-message:' || v_source_record_id
      else 'gmail-message:' || md5(coalesce(p_payload::text, '{}'))
    end
  );

  select lead_id, student_id, assigned_to, aggregate_type, aggregate_id
    into v_lead_id, v_student_id, v_assigned_to, v_aggregate_type, v_aggregate_id
  from command_center.resolve_anchor(v_email, p_payload ->> 'wordpress_user_id', v_source_record_id);

  v_event_id := command_center.append_event(
    coalesce(nullif(p_payload ->> 'event_type', ''), 'gmail.message.received'),
    'gmail',
    coalesce(v_aggregate_type, 'system'),
    v_aggregate_id,
    v_lead_id,
    v_student_id,
    'integration',
    coalesce(
      nullif(p_payload ->> 'external_event_id', ''),
      nullif(p_payload ->> 'gmail_message_id', ''),
      v_source_record_id
    ),
    v_source_record_id,
    v_dedupe_key,
    coalesce(
      nullif(p_payload ->> 'correlation_id', ''),
      nullif(p_payload ->> 'gmail_thread_id', ''),
      nullif(p_payload ->> 'gmail_message_id', '')
    ),
    null,
    p_payload,
    coalesce(nullif(p_payload ->> 'occurred_at', '')::timestamptz, now())
  );

  return jsonb_build_object(
    'event_id', v_event_id,
    'lead_id', v_lead_id,
    'student_id', v_student_id,
    'assigned_to', coalesce(v_assigned_to, 'system'),
    'source_record_id', v_source_record_id
  );
end;
$$;
create or replace function command_center.ingest_gmail_draft(p_payload jsonb)
returns jsonb
language plpgsql
as $$
declare
  v_event_id uuid;
  v_lead_id uuid;
  v_student_id uuid;
  v_assigned_to text;
  v_aggregate_type text;
  v_aggregate_id uuid;
  v_email text;
  v_source_record_id text;
  v_dedupe_key text;
begin
  v_email := lower(nullif(btrim(coalesce(p_payload ->> 'contact_email', p_payload ->> 'email')), ''));
  v_source_record_id := coalesce(
    nullif(p_payload ->> 'source_record_id', ''),
    nullif(p_payload ->> 'record_key', ''),
    nullif(p_payload ->> 'draft_id', ''),
    nullif(p_payload ->> 'gmail_message_id', '')
  );
  v_dedupe_key := coalesce(
    nullif(p_payload ->> 'dedupe_key', ''),
    case
      when v_source_record_id is not null then 'gmail-draft:' || v_source_record_id
      else 'gmail-draft:' || md5(coalesce(p_payload::text, '{}'))
    end
  );

  select lead_id, student_id, assigned_to, aggregate_type, aggregate_id
    into v_lead_id, v_student_id, v_assigned_to, v_aggregate_type, v_aggregate_id
  from command_center.resolve_anchor(v_email, p_payload ->> 'wordpress_user_id', v_source_record_id);

  v_event_id := command_center.append_event(
    coalesce(nullif(p_payload ->> 'event_type', ''), 'gmail.draft.synced'),
    'gmail',
    coalesce(v_aggregate_type, 'system'),
    v_aggregate_id,
    v_lead_id,
    v_student_id,
    'integration',
    coalesce(
      nullif(p_payload ->> 'external_event_id', ''),
      nullif(p_payload ->> 'draft_id', ''),
      nullif(p_payload ->> 'gmail_message_id', ''),
      v_source_record_id
    ),
    v_source_record_id,
    v_dedupe_key,
    coalesce(
      nullif(p_payload ->> 'correlation_id', ''),
      nullif(p_payload ->> 'gmail_thread_id', ''),
      nullif(p_payload ->> 'draft_id', '')
    ),
    null,
    p_payload,
    coalesce(nullif(p_payload ->> 'occurred_at', '')::timestamptz, now())
  );

  return jsonb_build_object(
    'event_id', v_event_id,
    'lead_id', v_lead_id,
    'student_id', v_student_id,
    'assigned_to', coalesce(v_assigned_to, 'system'),
    'source_record_id', v_source_record_id
  );
end;
$$;
create or replace function command_center.ingest_learndash_event(p_payload jsonb)
returns jsonb
language plpgsql
as $$
declare
  v_event_id uuid;
  v_lead_id uuid;
  v_student_id uuid;
  v_assigned_to text;
  v_aggregate_type text;
  v_aggregate_id uuid;
  v_email text;
  v_source_record_id text;
  v_dedupe_key text;
begin
  v_email := lower(nullif(btrim(coalesce(p_payload ->> 'user_email', p_payload ->> 'email')), ''));
  v_source_record_id := coalesce(
    nullif(p_payload ->> 'source_record_id', ''),
    nullif(p_payload ->> 'record_key', ''),
    nullif(p_payload ->> 'event_key', '')
  );
  v_dedupe_key := coalesce(
    nullif(p_payload ->> 'dedupe_key', ''),
    case
      when v_source_record_id is not null then 'learndash:' || v_source_record_id
      else 'learndash:' || md5(coalesce(p_payload::text, '{}'))
    end
  );

  select lead_id, student_id, assigned_to, aggregate_type, aggregate_id
    into v_lead_id, v_student_id, v_assigned_to, v_aggregate_type, v_aggregate_id
  from command_center.resolve_anchor(v_email, p_payload ->> 'wordpress_user_id', v_source_record_id);

  v_event_id := command_center.append_event(
    coalesce(nullif(p_payload ->> 'event_type', ''), 'learndash.progress.completed'),
    'learndash',
    coalesce(v_aggregate_type, 'system'),
    v_aggregate_id,
    v_lead_id,
    v_student_id,
    'integration',
    nullif(p_payload ->> 'external_event_id', ''),
    v_source_record_id,
    v_dedupe_key,
    coalesce(
      nullif(p_payload ->> 'correlation_id', ''),
      nullif(p_payload ->> 'course_id', ''),
      nullif(p_payload ->> 'quiz_id', '')
    ),
    null,
    p_payload,
    coalesce(nullif(p_payload ->> 'occurred_at', '')::timestamptz, now())
  );

  return jsonb_build_object(
    'event_id', v_event_id,
    'lead_id', v_lead_id,
    'student_id', v_student_id,
    'assigned_to', coalesce(v_assigned_to, 'system'),
    'source_record_id', v_source_record_id
  );
end;
$$;
create or replace function public.mmac_command_center_ingest_stripe_event(p_payload jsonb)
returns jsonb
language sql
security definer
set search_path = public, command_center
as $$
  select command_center.ingest_stripe_event(p_payload);
$$;
create or replace function public.mmac_command_center_ingest_gmail_message(p_payload jsonb)
returns jsonb
language sql
security definer
set search_path = public, command_center
as $$
  select command_center.ingest_gmail_message(p_payload);
$$;
create or replace function public.mmac_command_center_ingest_gmail_draft(p_payload jsonb)
returns jsonb
language sql
security definer
set search_path = public, command_center
as $$
  select command_center.ingest_gmail_draft(p_payload);
$$;
create or replace function public.mmac_command_center_ingest_learndash_event(p_payload jsonb)
returns jsonb
language sql
security definer
set search_path = public, command_center
as $$
  select command_center.ingest_learndash_event(p_payload);
$$;
grant execute on function public.mmac_command_center_ingest_stripe_event(jsonb) to service_role;
grant execute on function public.mmac_command_center_ingest_gmail_message(jsonb) to service_role;
grant execute on function public.mmac_command_center_ingest_gmail_draft(jsonb) to service_role;
grant execute on function public.mmac_command_center_ingest_learndash_event(jsonb) to service_role;
comment on function command_center.resolve_anchor(text, text, text)
is 'Resolves incoming integration identifiers to the canonical lead/student anchor before event ingestion.';
comment on function command_center.project_integration_event()
is 'Projects Stripe, Gmail, and LearnDash integration events into read-model tables after append_event writes.';
comment on function public.mmac_command_center_ingest_stripe_event(jsonb)
is 'MAC-6.1 Stripe RPC wrapper. Writes through command_center.append_event before payments projection.';
comment on function public.mmac_command_center_ingest_gmail_message(jsonb)
is 'MAC-6.1 Gmail message RPC wrapper. Writes through command_center.append_event.';
comment on function public.mmac_command_center_ingest_gmail_draft(jsonb)
is 'MAC-6.1 Gmail draft RPC wrapper. Writes through command_center.append_event before email_drafts projection.';
comment on function public.mmac_command_center_ingest_learndash_event(jsonb)
is 'MAC-6.1 LearnDash RPC wrapper. Writes course progress, quiz, and completion updates through command_center.append_event.';
commit;
