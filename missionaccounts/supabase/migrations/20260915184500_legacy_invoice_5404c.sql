-- Migration: 20260915184500_legacy_invoice_5404c.sql
-- Authority: DR-268 / MX-MISSIONACCOUNTS-5404C SOURCE ONLY
-- Date: 2026-09-15
-- Depends on: 20260914114700_onboarding_queue_visibility_5404a.sql
-- Description: Append-only June–August manual evidence, liability review and exact-row approval snapshots; no provider dispatch.
-- Idempotent: NO

BEGIN;

create table missionaccounts.legacy_manual_item (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references missionaccounts.student(id),
  cycle_key text not null references missionaccounts.cycle(key),
  kind text not null check (kind in ('one_on_one','credit')),
  service_key text not null check (service_key ~ '^[A-Za-z0-9._:-]{1,120}$'),
  revision integer not null check (revision > 0),
  state text not null check (state in ('attested','withdrawn')),
  service_on date not null,
  duration_minutes integer,
  rate_cents integer,
  amount_cents integer not null check (amount_cents >= 0),
  treatment text not null default 'none' check (treatment in
    ('none','ucc','mul','waived','prepaid','already_paid','already_invoiced','guarantee','repeat')),
  source_ref text check (source_ref is null or length(btrim(source_ref)) between 1 and 500),
  source_sha256 text check (source_sha256 is null or source_sha256 ~ '^[0-9a-f]{64}$'),
  reason text not null check (length(btrim(reason)) between 1 and 2000),
  actor_id text not null check (length(btrim(actor_id)) > 0),
  request_id text not null unique check (request_id ~ '^[A-Za-z0-9._:-]{8,200}$'),
  payload_sha256 text not null check (payload_sha256 ~ '^[0-9a-f]{64}$'),
  supersedes_id uuid references missionaccounts.legacy_manual_item(id),
  created_at timestamptz not null default clock_timestamp(),
  unique (student_id,cycle_key,kind,service_key,revision),
  check (
    (kind = 'one_on_one' and duration_minutes between 1 and 1440
      and (rate_cents is null or rate_cents > 0))
    or (kind = 'credit' and duration_minutes is null and rate_cents is null
      and amount_cents > 0)
  )
);

create index legacy_manual_item_student_cycle_latest_idx
  on missionaccounts.legacy_manual_item(student_id,cycle_key,kind,service_key,revision desc);
create index legacy_manual_item_supersedes_idx
  on missionaccounts.legacy_manual_item(supersedes_id);

create table missionaccounts.legacy_liability_review (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references missionaccounts.student(id),
  cycle_key text not null references missionaccounts.cycle(key),
  revision integer not null check (revision > 0),
  classification text not null check (classification in
    ('direct_charge','hold','ucc','mul','guarantee','repeat','waived','prepaid',
     'already_paid','already_invoiced')),
  source_ref text check (source_ref is null or length(btrim(source_ref)) between 1 and 500),
  source_sha256 text check (source_sha256 is null or source_sha256 ~ '^[0-9a-f]{64}$'),
  reason text not null check (length(btrim(reason)) between 1 and 2000),
  actor_id text not null check (length(btrim(actor_id)) > 0),
  request_id text not null unique check (request_id ~ '^[A-Za-z0-9._:-]{8,200}$'),
  payload_sha256 text not null check (payload_sha256 ~ '^[0-9a-f]{64}$'),
  supersedes_id uuid references missionaccounts.legacy_liability_review(id),
  created_at timestamptz not null default clock_timestamp(),
  unique (student_id,cycle_key,revision)
);

create index legacy_liability_review_student_cycle_latest_idx
  on missionaccounts.legacy_liability_review(student_id,cycle_key,revision desc);
create index legacy_liability_review_supersedes_idx
  on missionaccounts.legacy_liability_review(supersedes_id);

create table missionaccounts.legacy_invoice_approval (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references missionaccounts.student(id),
  cycle_key text not null references missionaccounts.cycle(key),
  preview_digest_sha256 text not null check (preview_digest_sha256 ~ '^[0-9a-f]{64}$'),
  source_digest_sha256 text not null check (source_digest_sha256 ~ '^[0-9a-f]{64}$'),
  amount_cents integer not null check (amount_cents > 0),
  lines jsonb not null check (jsonb_typeof(lines) = 'array' and jsonb_array_length(lines) between 1 and 100),
  approved_by text not null check (length(btrim(approved_by)) > 0),
  approved_role text not null check (approved_role = 'missionaccounts_admin'),
  request_id text not null unique check (request_id ~ '^[A-Za-z0-9._:-]{8,200}$'),
  payload_sha256 text not null check (payload_sha256 ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default clock_timestamp()
);

create index legacy_invoice_approval_student_cycle_latest_idx
  on missionaccounts.legacy_invoice_approval(student_id,cycle_key,created_at desc,id desc);

create table missionaccounts.legacy_frozen_source_bundle (
  bundle_key text primary key check (bundle_key='dr268-june-august-2026-v1'),
  group_ledger_artifact_id uuid not null references missionaccounts.source_artifact(id),
  identity_graph_artifact_id uuid not null references missionaccounts.source_artifact(id),
  raw_zoom_manifest_artifact_id uuid not null references missionaccounts.source_artifact(id),
  authority_id text not null check (authority_id='DR-268'),
  provenance_statement_sha256 text not null check (
    provenance_statement_sha256='0b985e373125ab88e3d07a18e7acaa6c367fedbdddd5222bbd281323bdeb1b63'),
  created_at timestamptz not null default clock_timestamp(),
  unique(group_ledger_artifact_id,identity_graph_artifact_id,raw_zoom_manifest_artifact_id)
);

insert into missionaccounts.legacy_frozen_source_bundle(
  bundle_key,group_ledger_artifact_id,identity_graph_artifact_id,
  raw_zoom_manifest_artifact_id,authority_id,provenance_statement_sha256)
select 'dr268-june-august-2026-v1',g.id,i.id,z.id,'DR-268',
  '0b985e373125ab88e3d07a18e7acaa6c367fedbdddd5222bbd281323bdeb1b63'
from missionaccounts.source_artifact g
cross join missionaccounts.source_artifact i
cross join missionaccounts.source_artifact z
where g.sha256='6a38967fcb369ba6b9bb71daee8f66697efee0042ab6ebd421a0edf1aaeba108'
  and i.sha256='c8e89ab0217c5a6df21e4506f133f06d9470c8cd5b51c81eec356de251bce5ee'
  and z.sha256='5209775bceca32b4db848154d54b116a5ff9820d409cda648c9c9698ab6a1b60';

create trigger legacy_manual_item_immutable
before update or delete on missionaccounts.legacy_manual_item
for each row execute function missionaccounts.reject_immutable_change();
create trigger legacy_liability_review_immutable
before update or delete on missionaccounts.legacy_liability_review
for each row execute function missionaccounts.reject_immutable_change();
create trigger legacy_invoice_approval_immutable
before update or delete on missionaccounts.legacy_invoice_approval
for each row execute function missionaccounts.reject_immutable_change();
create trigger legacy_frozen_source_bundle_immutable
before update or delete on missionaccounts.legacy_frozen_source_bundle
for each row execute function missionaccounts.reject_immutable_change();

create function missionaccounts.legacy_source_digest(p_student_id uuid, p_cycle_key text)
returns text
language sql stable security definer
set search_path = pg_catalog, missionaccounts, extensions
as $$
  select encode(digest(jsonb_build_object(
    'student', (select jsonb_build_object(
      'id',s.id,'matrix_user_ref',s.matrix_user_ref,'identity_state',s.identity_state,
      'sponsor_type',s.sponsor_type,'canonical_student_id',r.canonical_student_id,
      'absorbed',r.absorbed,'excluded',r.excluded)
      from missionaccounts.student s
      left join missionaccounts.identity_student_resolution r on r.source_student_id=s.id
      where s.id=p_student_id),
    'identity_provenance', coalesce((select jsonb_agg(jsonb_build_object(
      'alias_id',i.id,'artifact_sha256',a.sha256,'relationship_state',i.relationship_state)
      order by i.id)
      from missionaccounts.identity_alias i
      join missionaccounts.source_artifact a on a.id=i.source_artifact_id
      where i.student_id=p_student_id and i.superseded_by_id is null), '[]'::jsonb),
    'group', coalesce((select jsonb_agg(jsonb_build_object(
      'id',h.id,'student_id',h.student_id,'cycle_key',h.cycle_key,
      'artifact_sha256',a.sha256,'source_events',h.source_events,
      'source_amount_cents',h.source_amount_cents,'source_tier',h.source_tier,
      'source_state',h.source_state) order by h.id)
      from missionaccounts.historical_account_source h
      join missionaccounts.source_artifact a on a.id=h.artifact_id
      where h.student_id=p_student_id and h.cycle_key=p_cycle_key), '[]'::jsonb),
    'days', coalesce((select jsonb_agg(jsonb_build_object(
      'id',d.id,'day',d.day,'kind',d.kind,
      'same_day_multiple_events',d.same_day_multiple_events,
      'engine_version',d.engine_version,
      'source_links',coalesce((select jsonb_agg(jsonb_build_object(
        'event_id',de.attendance_event_id,'source_row_id',es.source_row_id,
        'import_run_id',ir.id,'artifact_sha256',a.sha256,
        'session_artifact_sha256',sa.sha256,
        'manifest_sha256',ir.source_controls->>'manifest_sha256',
        'raw_exports',ir.source_controls->'raw_exports') order by
          de.attendance_event_id,es.source_row_id)
        from missionaccounts.attendance_day_event de
        join missionaccounts.attendance_event_source_row es
          on es.attendance_event_id=de.attendance_event_id
        join missionaccounts.attendance_source_row sr on sr.id=es.source_row_id
        join missionaccounts.session s on s.id=sr.session_id
        join missionaccounts.source_artifact sa on sa.id=s.source_artifact_id
        join missionaccounts.import_run ir on ir.id=sr.import_run_id
        join missionaccounts.source_artifact a on a.id=ir.artifact_id
        where de.attendance_day_id=d.id),'[]'::jsonb)) order by d.day,d.id)
      from missionaccounts.attendance_day d
      where d.student_id=p_student_id and d.cycle_key=p_cycle_key
        and d.superseded_at is null), '[]'::jsonb),
    'manual', coalesce((select jsonb_agg(to_jsonb(i) order by i.kind,i.service_key,i.revision)
      from missionaccounts.legacy_manual_item i
      where i.student_id=p_student_id and i.cycle_key=p_cycle_key), '[]'::jsonb),
    'liability', coalesce((select jsonb_agg(to_jsonb(l) order by l.revision)
      from missionaccounts.legacy_liability_review l
      where l.student_id=p_student_id and l.cycle_key=p_cycle_key), '[]'::jsonb),
    'invoices', coalesce((select jsonb_agg(jsonb_build_object(
      'id',v.id,'state',v.state,'amount_cents',v.amount_cents) order by v.id)
      from missionaccounts.invoice v
      where v.student_id=p_student_id and v.cycle_key=p_cycle_key), '[]'::jsonb),
    'manual_charges', coalesce((select jsonb_agg(jsonb_build_object(
      'id',c.id,'state',c.state,'amount_cents',c.amount_cents) order by c.id)
      from missionaccounts.manual_cycle_charge c
      where c.student_id=p_student_id and c.cycle_key=p_cycle_key), '[]'::jsonb),
    'hosted_invoice_customer_ready', exists(select 1
      from missionaccounts.stripe_customer_private c where c.student_id=p_student_id),
    'payment_method_on_file', exists(select 1
      from missionaccounts.payment_method_private p
      where p.student_id=p_student_id and p.status='on_file'),
    'decisions', coalesce((select jsonb_agg(jsonb_build_object(
      'id',b.id,'treatment',b.treatment,'state',b.state,'amount_cents',b.amount_cents)
      order by b.id)
      from missionaccounts.billing_decision b
      where b.student_id=p_student_id and b.cycle_key=p_cycle_key
        and b.superseded_by_id is null), '[]'::jsonb)
  )::text, 'sha256'),'hex');
$$;

create function missionaccounts.legacy_frozen_sources_valid()
returns boolean
language sql stable security definer
set search_path = pg_catalog, missionaccounts
as $$
  select
    (select count(*) from missionaccounts.legacy_frozen_source_bundle b
      join missionaccounts.source_artifact g on g.id=b.group_ledger_artifact_id
      join missionaccounts.source_artifact i on i.id=b.identity_graph_artifact_id
      join missionaccounts.source_artifact z on z.id=b.raw_zoom_manifest_artifact_id
      where b.bundle_key='dr268-june-august-2026-v1' and b.authority_id='DR-268'
        and b.provenance_statement_sha256='0b985e373125ab88e3d07a18e7acaa6c367fedbdddd5222bbd281323bdeb1b63'
        and g.sha256='6a38967fcb369ba6b9bb71daee8f66697efee0042ab6ebd421a0edf1aaeba108'
        and i.sha256='c8e89ab0217c5a6df21e4506f133f06d9470c8cd5b51c81eec356de251bce5ee'
        and z.sha256='5209775bceca32b4db848154d54b116a5ff9820d409cda648c9c9698ab6a1b60')=1
    and (select count(*) from missionaccounts.historical_account_source)=498
    and (select count(*) from missionaccounts.historical_account_source
      where source_state='READY')=320
    and (select count(*) from missionaccounts.historical_account_source
      where source_state='IDENTITY_HOLD')=107
    and (select count(*) from missionaccounts.historical_account_source
      where source_state='CAP_HOLD')=69
    and (select count(*) from missionaccounts.historical_account_source
      where source_state='SOURCE_LINK_HOLD')=2;
$$;

create function missionaccounts.legacy_identity_and_attendance_provenance_valid(
  p_student_id uuid,p_cycle_key text
) returns boolean
language sql stable security definer
set search_path = pg_catalog, missionaccounts
as $$
  select exists (
      select 1 from missionaccounts.identity_alias i
      join missionaccounts.source_artifact a on a.id=i.source_artifact_id
      where i.student_id=p_student_id and i.relationship_state='verified'
        and i.superseded_by_id is null
        and a.sha256='c8e89ab0217c5a6df21e4506f133f06d9470c8cd5b51c81eec356de251bce5ee'
    ) and not exists (
      select 1 from missionaccounts.attendance_day d
      where d.student_id=p_student_id and d.cycle_key=p_cycle_key
        and d.superseded_at is null and not exists (
          select 1 from missionaccounts.attendance_day_event de
          join missionaccounts.attendance_event e on e.id=de.attendance_event_id
          join missionaccounts.attendance_event_source_row es
            on es.attendance_event_id=de.attendance_event_id
          join missionaccounts.attendance_source_row sr
            on sr.id=es.source_row_id and sr.session_id=e.session_id
          join missionaccounts.session s on s.id=sr.session_id
          join missionaccounts.source_artifact sa on sa.id=s.source_artifact_id
          join missionaccounts.import_run ir on ir.id=sr.import_run_id and ir.state='applied'
          join missionaccounts.source_artifact a on a.id=ir.artifact_id
          where de.attendance_day_id=d.id and e.student_id=p_student_id
            and e.cycle_key=p_cycle_key and e.local_day=d.day
            and e.interpretation_state='effective' and e.superseded_by_id is null
            and a.sha256='6a38967fcb369ba6b9bb71daee8f66697efee0042ab6ebd421a0edf1aaeba108'
            and s.provider='zoom' and s.superseded_by_id is null
            and sa.source_kind='zoom_csv'
            and ir.source_controls->>'ledger_sha256'='6a38967fcb369ba6b9bb71daee8f66697efee0042ab6ebd421a0edf1aaeba108'
            and ir.source_controls->>'graph_sha256'='c8e89ab0217c5a6df21e4506f133f06d9470c8cd5b51c81eec356de251bce5ee'
            and ir.source_controls->>'manifest_sha256'='5209775bceca32b4db848154d54b116a5ff9820d409cda648c9c9698ab6a1b60'
            and jsonb_typeof(ir.source_controls->'raw_exports')='array'
            and (ir.source_controls->'raw_exports') ? sa.sha256
        )
    );
$$;

create function missionaccounts.legacy_expected_invoice_lines(
  p_student_id uuid,p_cycle_key text
) returns jsonb
language sql stable security definer
set search_path = pg_catalog, missionaccounts
as $$
  with group_lines as (
    select 0 as sort_order,null::date as service_on,''::text as service_key,
      jsonb_build_object(
        'kind','frozen_group','student_id',h.student_id,'cycle_key',h.cycle_key,
        'source_id',h.id,'artifact_sha256',a.sha256,
        'source_state',h.source_state,'source_tier',h.source_tier,
        'source_events',h.source_events,
        'attendance_days',coalesce((select jsonb_agg(d.day order by d.day)
          from missionaccounts.attendance_day d
          where d.student_id=h.student_id and d.cycle_key=h.cycle_key
            and d.superseded_at is null),'[]'::jsonb),
        'amount_cents',h.source_amount_cents) as line
    from missionaccounts.historical_account_source h
    join missionaccounts.source_artifact a on a.id=h.artifact_id
    where h.student_id=p_student_id and h.cycle_key=p_cycle_key
  ), latest_manual as (
    select distinct on (i.kind,i.service_key) i.*
    from missionaccounts.legacy_manual_item i
    where i.student_id=p_student_id and i.cycle_key=p_cycle_key
    order by i.kind,i.service_key,i.revision desc,i.id desc
  ), manual_lines as (
    select case when i.kind='one_on_one' then 1 else 2 end as sort_order,
      i.service_on,i.service_key,
      case when i.kind='one_on_one' then jsonb_build_object(
        'kind','manual_1on1','student_id',i.student_id,'cycle_key',i.cycle_key,
        'service_key',i.service_key,'revision',i.revision,'service_on',i.service_on,
        'duration_minutes',i.duration_minutes,'rate_cents',i.rate_cents,
        'amount_cents',i.amount_cents,'source_ref',i.source_ref,
        'source_sha256',i.source_sha256,'treatment',i.treatment,
        'reason',i.reason,'actor_id',i.actor_id)
      else jsonb_build_object(
        'kind','credit','student_id',i.student_id,'cycle_key',i.cycle_key,
        'amount_cents',-i.amount_cents,'reason',i.reason,
        'source_ref',i.source_ref,'source_sha256',i.source_sha256,
        'actor_id',i.actor_id) end as line
    from latest_manual i where i.state='attested'
  ), all_lines as (
    select * from group_lines union all select * from manual_lines
  )
  select coalesce(jsonb_agg(line order by sort_order,service_on nulls first,service_key),'[]'::jsonb)
  from all_lines;
$$;

create function missionaccounts.legacy_invoice_preview_snapshot(
  p_student_id uuid,p_cycle_key text
) returns jsonb
language plpgsql stable security definer
set search_path = pg_catalog, missionaccounts, extensions
as $$
declare
  v_lines jsonb;
  v_total bigint;
  v_source_digest text;
  v_recipient_email text;
  v_preview_digest text;
  v_frozen_sources jsonb;
  v_stripe_customer_ready boolean;
  v_payment_method_on_file boolean;
  v_holds jsonb := '[]'::jsonb;
  v_approval missionaccounts.legacy_invoice_approval%rowtype;
  v_approval_matches boolean := false;
begin
  v_lines:=missionaccounts.legacy_expected_invoice_lines(p_student_id,p_cycle_key);
  select coalesce(sum((line->>'amount_cents')::bigint),0) into v_total
    from jsonb_array_elements(v_lines) line;
  v_source_digest:=missionaccounts.legacy_source_digest(p_student_id,p_cycle_key);
  select lower(btrim(email)) into v_recipient_email
    from missionaccounts.student where id=p_student_id;
  v_frozen_sources:=jsonb_build_object(
    'group_ledger_sha256','6a38967fcb369ba6b9bb71daee8f66697efee0042ab6ebd421a0edf1aaeba108',
    'identity_graph_sha256','c8e89ab0217c5a6df21e4506f133f06d9470c8cd5b51c81eec356de251bce5ee',
    'raw_zoom_source_sha256','5209775bceca32b4db848154d54b116a5ff9820d409cda648c9c9698ab6a1b60',
    'counts',jsonb_build_object('total',498,'ready',320,'identity_hold',107,
      'cap_hold',69,'source_link_hold',2));
  v_stripe_customer_ready:=exists(select 1 from missionaccounts.stripe_customer_private
    where student_id=p_student_id);
  v_payment_method_on_file:=exists(select 1 from missionaccounts.payment_method_private
    where student_id=p_student_id and status='on_file');
  if not missionaccounts.legacy_frozen_sources_valid() then
    v_holds:=v_holds||jsonb_build_array('frozen_source_drift');
  end if;
  if not missionaccounts.legacy_identity_and_attendance_provenance_valid(
      p_student_id,p_cycle_key) then
    v_holds:=v_holds||jsonb_build_array('source_provenance_hold');
  end if;
  if v_recipient_email is null
    or v_recipient_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    v_holds:=v_holds||jsonb_build_array('recipient_email_required');
  end if;
  if not v_stripe_customer_ready then
    v_holds:=v_holds||jsonb_build_array('hosted_invoice_customer_required');
  end if;
  if not exists(
    select 1 from missionaccounts.student s
    join missionaccounts.identity_student_resolution r on r.source_student_id=s.id
    where s.id=p_student_id and s.identity_state='verified'
      and s.matrix_user_ref is not null and coalesce(s.sponsor_type,'')='DIRECT'
      and r.canonical_student_id=p_student_id
      and not coalesce(r.absorbed,true) and not coalesce(r.excluded,true)
  ) then
    v_holds:=v_holds||jsonb_build_array('identity_or_sponsor_hold');
  end if;
  if not exists(
    select 1 from missionaccounts.historical_account_source h
    join missionaccounts.source_artifact a on a.id=h.artifact_id
    join missionaccounts.cycle c on c.key=h.cycle_key
    where h.student_id=p_student_id and h.cycle_key=p_cycle_key
      and h.source_state='READY' and h.source_tier='1-15 / $25 per attendance'
      and a.sha256='6a38967fcb369ba6b9bb71daee8f66697efee0042ab6ebd421a0edf1aaeba108'
      and h.source_amount_cents<=30000
      and h.source_amount_cents=h.source_events*2500
      and (select count(*) from missionaccounts.attendance_day d
        where d.student_id=p_student_id and d.cycle_key=p_cycle_key
          and d.superseded_at is null and d.kind='billable'
          and d.day between c.starts_on and c.ends_on)=h.source_events
      and not exists(select 1 from missionaccounts.attendance_day d
        where d.student_id=p_student_id and d.cycle_key=p_cycle_key
          and d.superseded_at is null
          and (d.kind<>'billable' or d.day not between c.starts_on and c.ends_on))
  ) or (select count(*) from missionaccounts.historical_account_source
      where student_id=p_student_id and cycle_key=p_cycle_key)<>1 then
    v_holds:=v_holds||jsonb_build_array('group_source_hold');
  end if;
  if not exists(
    select 1 from missionaccounts.legacy_liability_review l
    where l.student_id=p_student_id and l.cycle_key=p_cycle_key
      and l.classification='direct_charge'
      and l.source_ref is not null and l.source_sha256 is not null
      and l.revision=(select max(x.revision) from missionaccounts.legacy_liability_review x
        where x.student_id=p_student_id and x.cycle_key=p_cycle_key)
  ) then
    v_holds:=v_holds||jsonb_build_array('liability_review_required');
  end if;
  if exists(select 1 from missionaccounts.invoice
      where student_id=p_student_id and cycle_key=p_cycle_key)
    or missionaccounts.billing_has_financial_custody(p_student_id,p_cycle_key)
    or exists(select 1 from missionaccounts.manual_cycle_charge
      where student_id=p_student_id and cycle_key=p_cycle_key and state in ('pending','succeeded'))
    or exists(select 1 from missionaccounts.billing_decision
      where student_id=p_student_id and cycle_key=p_cycle_key
        and superseded_by_id is null
        and (state='approved' or treatment in ('ucc','mul','waived','prepaid',
          'already_paid','already_invoiced','guarantee','repeat'))) then
    v_holds:=v_holds||jsonb_build_array('financial_custody_or_prior_treatment');
  end if;
  if exists(
    select 1 from (
      select distinct on (kind,service_key) kind,state,source_ref,source_sha256,
        duration_minutes,rate_cents,amount_cents,treatment
      from missionaccounts.legacy_manual_item
      where student_id=p_student_id and cycle_key=p_cycle_key
      order by kind,service_key,revision desc
    ) current_item
    where state='attested' and (
      source_ref is null or source_sha256 is null or treatment<>'none'
      or (kind='one_on_one' and (rate_cents is null
        or amount_cents<>round(rate_cents::numeric*duration_minutes/60)::integer))
    )
  ) then
    v_holds:=v_holds||jsonb_build_array('manual_source_or_rate_hold');
  end if;
  if v_total<=0 or jsonb_array_length(v_lines)=0 then
    v_holds:=v_holds||jsonb_build_array('no_collectible_lines');
  end if;
  v_preview_digest:=encode(digest(jsonb_build_object(
    'student_id',p_student_id,'cycle_key',p_cycle_key,'lines',v_lines,
    'total_cents',v_total,'source_digest_sha256',v_source_digest,
    'recipient_email',v_recipient_email,'frozen_sources',v_frozen_sources,
    'payment_path','hosted_invoice','stripe_customer_ready',v_stripe_customer_ready,
    'payment_method_on_file',v_payment_method_on_file,'holds',v_holds)::text,'sha256'),'hex');
  select * into v_approval from missionaccounts.legacy_invoice_approval
    where student_id=p_student_id and cycle_key=p_cycle_key
    order by created_at desc,id desc limit 1;
  v_approval_matches:=found and jsonb_array_length(v_holds)=0
    and v_approval.lines=v_lines and v_approval.amount_cents=v_total
    and v_approval.source_digest_sha256=v_source_digest
    and v_approval.preview_digest_sha256=v_preview_digest;
  return jsonb_build_object(
    'student_id',p_student_id,'cycle_key',p_cycle_key,'lines',v_lines,
    'total_cents',v_total,'source_digest_sha256',v_source_digest,
    'recipient_email',v_recipient_email,'frozen_sources',v_frozen_sources,
    'payment_path','hosted_invoice','stripe_customer_ready',v_stripe_customer_ready,
    'payment_method_on_file',v_payment_method_on_file,
    'state',case when jsonb_array_length(v_holds)>0 then 'held'
      when v_approval_matches then 'approval-ready' else 'needs-drj-approval' end,
    'holds',v_holds,
    'approval',case when v_approval_matches then jsonb_build_object(
      'id',v_approval.id,'approved_by',v_approval.approved_by,
      'approved_at',v_approval.created_at,
      'preview_digest_sha256',v_approval.preview_digest_sha256) else null end,
    'preview_digest_sha256',v_preview_digest,
    'provider_action_allowed',false);
end;
$$;

create function missionaccounts.api_record_legacy_manual_item(
  p_student_id uuid,p_cycle_key text,p_kind text,p_service_key text,p_revision integer,
  p_state text,p_service_on date,p_duration_minutes integer,p_rate_cents integer,
  p_amount_cents integer,p_treatment text,p_source_ref text,p_source_sha256 text,
  p_reason text,p_actor_id text,p_actor_role text,p_request_id text
) returns jsonb
language plpgsql security definer
set search_path = pg_catalog, missionaccounts, extensions
as $$
declare
  v_student missionaccounts.student%rowtype;
  v_cycle missionaccounts.cycle%rowtype;
  v_prior missionaccounts.legacy_manual_item%rowtype;
  v_duplicate missionaccounts.legacy_manual_item%rowtype;
  v_hash text;
  v_new missionaccounts.legacy_manual_item%rowtype;
begin
  if p_actor_role <> 'missionaccounts_admin' or nullif(btrim(p_actor_id),'') is null
    or p_request_id !~ '^[A-Za-z0-9._:-]{8,200}$' then
    raise exception using errcode='42501', message='legacy_admin_required';
  end if;
  if p_cycle_key not in ('2026-cycle-1','2026-cycle-2','2026-cycle-3')
    or p_kind not in ('one_on_one','credit') or p_state not in ('attested','withdrawn')
    or p_treatment not in ('none','ucc','mul','waived','prepaid','already_paid',
      'already_invoiced','guarantee','repeat')
    or p_service_key !~ '^[A-Za-z0-9._:-]{1,120}$'
    or p_revision < 1 or p_amount_cents < 0
    or nullif(btrim(p_reason),'') is null
    or (p_kind='one_on_one' and (p_duration_minutes not between 1 and 1440
      or (p_rate_cents is not null and p_rate_cents <= 0)))
    or (p_kind='credit' and (p_duration_minutes is not null or p_rate_cents is not null
      or p_amount_cents < 1))
    or (p_source_sha256 is not null and p_source_sha256 !~ '^[0-9a-f]{64}$')
    or (p_source_ref is not null and length(btrim(p_source_ref)) not between 1 and 500) then
    raise exception using errcode='22023', message='legacy_manual_item_invalid';
  end if;
  select * into v_student from missionaccounts.student where id=p_student_id for update;
  if not found then raise exception using errcode='P0002',message='student_not_found'; end if;
  select * into v_cycle from missionaccounts.cycle where key=p_cycle_key;
  if not found or p_service_on not between v_cycle.starts_on and v_cycle.ends_on then
    raise exception using errcode='22023',message='legacy_service_outside_cycle';
  end if;
  v_hash:=encode(digest(jsonb_build_object(
    'student',p_student_id,'cycle',p_cycle_key,'kind',p_kind,'key',p_service_key,
    'revision',p_revision,'state',p_state,'day',p_service_on,
    'duration',p_duration_minutes,'rate',p_rate_cents,'amount',p_amount_cents,
    'treatment',p_treatment,'source_ref',p_source_ref,'source_sha',p_source_sha256,
    'reason',p_reason,'actor',p_actor_id)::text,'sha256'),'hex');
  perform pg_advisory_xact_lock(hashtextextended(
    'missionaccounts:legacy-manual:request:' || p_request_id,0));
  select * into v_duplicate from missionaccounts.legacy_manual_item where request_id=p_request_id;
  if found then
    if v_duplicate.payload_sha256<>v_hash then
      raise exception using errcode='PT409',message='legacy_request_conflict';
    end if;
    return jsonb_build_object('id',v_duplicate.id,'duplicate',true,'revision',v_duplicate.revision);
  end if;
  select * into v_prior from missionaccounts.legacy_manual_item
    where student_id=p_student_id and cycle_key=p_cycle_key and kind=p_kind
      and service_key=p_service_key order by revision desc limit 1;
  if p_revision<>coalesce(v_prior.revision,0)+1 or (p_state='withdrawn' and v_prior.id is null) then
    raise exception using errcode='PT409',message='legacy_revision_conflict';
  end if;
  insert into missionaccounts.legacy_manual_item(
    student_id,cycle_key,kind,service_key,revision,state,service_on,
    duration_minutes,rate_cents,amount_cents,treatment,source_ref,source_sha256,
    reason,actor_id,request_id,payload_sha256,supersedes_id)
  values(p_student_id,p_cycle_key,p_kind,p_service_key,p_revision,p_state,p_service_on,
    p_duration_minutes,p_rate_cents,p_amount_cents,p_treatment,p_source_ref,p_source_sha256,
    p_reason,p_actor_id,p_request_id,v_hash,v_prior.id)
  returning * into v_new;
  return jsonb_build_object('id',v_new.id,'duplicate',false,'revision',v_new.revision);
end;
$$;

create function missionaccounts.api_record_legacy_liability(
  p_student_id uuid,p_cycle_key text,p_revision integer,p_classification text,
  p_source_ref text,p_source_sha256 text,p_reason text,p_actor_id text,
  p_actor_role text,p_request_id text
) returns jsonb
language plpgsql security definer
set search_path = pg_catalog, missionaccounts, extensions
as $$
declare
  v_prior missionaccounts.legacy_liability_review%rowtype;
  v_duplicate missionaccounts.legacy_liability_review%rowtype;
  v_new missionaccounts.legacy_liability_review%rowtype;
  v_hash text;
begin
  if p_actor_role<>'missionaccounts_admin' or nullif(btrim(p_actor_id),'') is null
    or p_request_id !~ '^[A-Za-z0-9._:-]{8,200}$' then
    raise exception using errcode='42501',message='legacy_admin_required';
  end if;
  if p_cycle_key not in ('2026-cycle-1','2026-cycle-2','2026-cycle-3')
    or p_classification not in ('direct_charge','hold','ucc','mul','guarantee',
      'repeat','waived','prepaid','already_paid','already_invoiced')
    or p_revision<1 or nullif(btrim(p_reason),'') is null
    or (p_source_sha256 is not null and p_source_sha256 !~ '^[0-9a-f]{64}$')
    or (p_source_ref is not null and length(btrim(p_source_ref)) not between 1 and 500)
    or (p_classification='direct_charge'
      and (nullif(btrim(p_source_ref),'') is null or p_source_sha256 is null)) then
    raise exception using errcode='22023',message='legacy_liability_invalid';
  end if;
  perform 1 from missionaccounts.student where id=p_student_id for update;
  if not found then raise exception using errcode='P0002',message='student_not_found'; end if;
  v_hash:=encode(digest(jsonb_build_object(
    'student',p_student_id,'cycle',p_cycle_key,'revision',p_revision,
    'classification',p_classification,'source_ref',p_source_ref,
    'source_sha',p_source_sha256,'reason',p_reason,'actor',p_actor_id)::text,
    'sha256'),'hex');
  perform pg_advisory_xact_lock(hashtextextended(
    'missionaccounts:legacy-liability:request:' || p_request_id,0));
  select * into v_duplicate from missionaccounts.legacy_liability_review
    where request_id=p_request_id;
  if found then
    if v_duplicate.payload_sha256<>v_hash then
      raise exception using errcode='PT409',message='legacy_request_conflict';
    end if;
    return jsonb_build_object('id',v_duplicate.id,'duplicate',true,'revision',v_duplicate.revision);
  end if;
  select * into v_prior from missionaccounts.legacy_liability_review
    where student_id=p_student_id and cycle_key=p_cycle_key
    order by revision desc limit 1;
  if p_revision<>coalesce(v_prior.revision,0)+1 then
    raise exception using errcode='PT409',message='legacy_revision_conflict';
  end if;
  insert into missionaccounts.legacy_liability_review(
    student_id,cycle_key,revision,classification,source_ref,source_sha256,
    reason,actor_id,request_id,payload_sha256,supersedes_id)
  values(p_student_id,p_cycle_key,p_revision,p_classification,p_source_ref,p_source_sha256,
    p_reason,p_actor_id,p_request_id,v_hash,v_prior.id)
  returning * into v_new;
  return jsonb_build_object('id',v_new.id,'duplicate',false,'revision',v_new.revision);
end;
$$;

create function missionaccounts.api_approve_legacy_invoice_preview(
  p_student_id uuid,p_cycle_key text,p_lines jsonb,p_amount_cents integer,
  p_preview_digest_sha256 text,p_source_digest_sha256 text,
  p_actor_id text,p_actor_role text,p_request_id text
) returns jsonb
language plpgsql security definer
set search_path = pg_catalog, missionaccounts, extensions
as $$
declare
  v_student missionaccounts.student%rowtype;
  v_resolution record;
  v_group record;
  v_liability missionaccounts.legacy_liability_review%rowtype;
  v_existing missionaccounts.legacy_invoice_approval%rowtype;
  v_new missionaccounts.legacy_invoice_approval%rowtype;
  v_hash text;
  v_preview jsonb;
  v_cycle missionaccounts.cycle%rowtype;
begin
  if p_actor_role<>'missionaccounts_admin' or nullif(btrim(p_actor_id),'') is null
    or p_request_id !~ '^[A-Za-z0-9._:-]{8,200}$' then
    raise exception using errcode='42501',message='legacy_drj_approval_required';
  end if;
  if p_cycle_key not in ('2026-cycle-1','2026-cycle-2','2026-cycle-3')
    or p_preview_digest_sha256 !~ '^[0-9a-f]{64}$'
    or p_source_digest_sha256 !~ '^[0-9a-f]{64}$'
    or p_amount_cents<1 or jsonb_typeof(p_lines)<>'array'
    or jsonb_array_length(p_lines) not between 1 and 100 then
    raise exception using errcode='22023',message='legacy_preview_invalid';
  end if;
  v_hash:=encode(digest(jsonb_build_object(
    'student',p_student_id,'cycle',p_cycle_key,'lines',p_lines,'amount',p_amount_cents,
    'preview_digest',p_preview_digest_sha256,'source_digest',p_source_digest_sha256,
    'actor',p_actor_id)::text,'sha256'),'hex');
  perform pg_advisory_xact_lock(hashtextextended(
    'missionaccounts:legacy-approval:request:' || p_request_id,0));
  select * into v_existing from missionaccounts.legacy_invoice_approval
    where request_id=p_request_id;
  if found then
    if v_existing.payload_sha256<>v_hash then
      raise exception using errcode='PT409',message='legacy_request_conflict';
    end if;
    return jsonb_build_object('id',v_existing.id,'duplicate',true,
      'preview_digest_sha256',v_existing.preview_digest_sha256);
  end if;
  if not missionaccounts.legacy_frozen_sources_valid() then
    raise exception using errcode='PT409',message='legacy_frozen_source_drift';
  end if;
  if not missionaccounts.legacy_identity_and_attendance_provenance_valid(
      p_student_id,p_cycle_key) then
    raise exception using errcode='PT409',message='legacy_source_provenance_hold';
  end if;
  select * into v_student from missionaccounts.student where id=p_student_id for update;
  if not found then raise exception using errcode='P0002',message='student_not_found'; end if;
  if nullif(btrim(v_student.email),'') is null
    or lower(btrim(v_student.email)) !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception using errcode='PT409',message='legacy_recipient_email_required';
  end if;
  if not exists(select 1 from missionaccounts.stripe_customer_private
      where student_id=p_student_id) then
    raise exception using errcode='PT409',message='legacy_hosted_invoice_customer_required';
  end if;
  select * into v_resolution from missionaccounts.identity_student_resolution
    where source_student_id=p_student_id;
  if v_student.identity_state<>'verified' or v_student.matrix_user_ref is null
    or coalesce(v_student.sponsor_type,'')<>'DIRECT'
    or v_resolution.canonical_student_id is distinct from p_student_id
    or coalesce(v_resolution.absorbed,true) or coalesce(v_resolution.excluded,true) then
    raise exception using errcode='42501',message='legacy_identity_or_sponsor_hold';
  end if;
  select * into v_cycle from missionaccounts.cycle where key=p_cycle_key;
  select h.id,h.source_events,h.source_amount_cents,h.source_state,h.source_tier,a.sha256
    into v_group from missionaccounts.historical_account_source h
    join missionaccounts.source_artifact a on a.id=h.artifact_id
    where h.student_id=p_student_id and h.cycle_key=p_cycle_key;
  if not found or (select count(*) from missionaccounts.historical_account_source
      where student_id=p_student_id and cycle_key=p_cycle_key)<>1
    or v_group.source_state<>'READY'
    or v_group.source_tier<>'1-15 / $25 per attendance'
    or v_group.sha256<>'6a38967fcb369ba6b9bb71daee8f66697efee0042ab6ebd421a0edf1aaeba108'
    or v_group.source_amount_cents>30000
    or v_group.source_amount_cents<>v_group.source_events*2500
    or (select count(*) from missionaccounts.attendance_day
      where student_id=p_student_id and cycle_key=p_cycle_key and superseded_at is null
        and kind='billable' and day between v_cycle.starts_on and v_cycle.ends_on)
      <>v_group.source_events
    or exists(select 1 from missionaccounts.attendance_day
      where student_id=p_student_id and cycle_key=p_cycle_key and superseded_at is null
        and (kind<>'billable' or day not between v_cycle.starts_on and v_cycle.ends_on)) then
    raise exception using errcode='PT409',message='legacy_group_source_hold';
  end if;
  select * into v_liability from missionaccounts.legacy_liability_review
    where student_id=p_student_id and cycle_key=p_cycle_key order by revision desc limit 1;
  if not found or v_liability.classification<>'direct_charge'
    or v_liability.source_ref is null or v_liability.source_sha256 is null then
    raise exception using errcode='PT409',message='legacy_liability_hold';
  end if;
  if exists(select 1 from missionaccounts.invoice
      where student_id=p_student_id and cycle_key=p_cycle_key)
    or missionaccounts.billing_has_financial_custody(p_student_id,p_cycle_key)
    or exists(select 1 from missionaccounts.manual_cycle_charge
      where student_id=p_student_id and cycle_key=p_cycle_key and state in ('pending','succeeded'))
    or exists(select 1 from missionaccounts.billing_decision
      where student_id=p_student_id and cycle_key=p_cycle_key
        and superseded_by_id is null
        and (state='approved' or treatment in ('ucc','mul','waived','prepaid',
          'already_paid','already_invoiced','guarantee','repeat'))) then
    raise exception using errcode='PT409',message='legacy_financial_duplicate_hold';
  end if;
  if exists(
    select 1 from (
      select distinct on (kind,service_key) kind,state,source_ref,source_sha256,
        duration_minutes,rate_cents,amount_cents,treatment
      from missionaccounts.legacy_manual_item
      where student_id=p_student_id and cycle_key=p_cycle_key
      order by kind,service_key,revision desc
    ) current_item
    where state='attested' and (
      source_ref is null or source_sha256 is null or treatment<>'none'
      or (kind='one_on_one' and (rate_cents is null
        or amount_cents<>round(rate_cents::numeric*duration_minutes/60)::integer))
    )
  ) then
    raise exception using errcode='PT409',message='legacy_manual_source_hold';
  end if;
  v_preview:=missionaccounts.legacy_invoice_preview_snapshot(p_student_id,p_cycle_key);
  if p_source_digest_sha256<>(v_preview->>'source_digest_sha256') then
    raise exception using errcode='PT409',message='legacy_source_changed';
  end if;
  if p_lines is distinct from (v_preview->'lines') then
    raise exception using errcode='PT409',message='legacy_lines_changed';
  end if;
  if p_amount_cents<>(v_preview->>'total_cents')::integer then
    raise exception using errcode='PT409',message='legacy_total_changed';
  end if;
  if p_preview_digest_sha256<>(v_preview->>'preview_digest_sha256') then
    raise exception using errcode='PT409',message='legacy_preview_changed';
  end if;
  select * into v_existing from missionaccounts.legacy_invoice_approval
    where student_id=p_student_id and cycle_key=p_cycle_key
      and preview_digest_sha256=p_preview_digest_sha256
      and source_digest_sha256=p_source_digest_sha256
      and amount_cents=p_amount_cents and lines=p_lines
    order by created_at desc,id desc limit 1;
  if found then
    return jsonb_build_object('id',v_existing.id,'duplicate',true,
      'preview_digest_sha256',v_existing.preview_digest_sha256);
  end if;
  if exists(select 1 from jsonb_array_elements(p_lines) line
    where jsonb_typeof(line->'amount_cents')<>'number'
      or (line->>'amount_cents') !~ '^-?[0-9]{1,9}$') then
    raise exception using errcode='22023',message='legacy_line_amount_invalid';
  end if;
  insert into missionaccounts.legacy_invoice_approval(
    student_id,cycle_key,preview_digest_sha256,source_digest_sha256,amount_cents,
    lines,approved_by,approved_role,request_id,payload_sha256)
  values(p_student_id,p_cycle_key,p_preview_digest_sha256,p_source_digest_sha256,
    p_amount_cents,p_lines,p_actor_id,p_actor_role,p_request_id,v_hash)
  returning * into v_new;
  return jsonb_build_object('id',v_new.id,'duplicate',false,
    'preview_digest_sha256',v_new.preview_digest_sha256);
end;
$$;

alter table missionaccounts.legacy_manual_item enable row level security;
alter table missionaccounts.legacy_manual_item force row level security;
alter table missionaccounts.legacy_liability_review enable row level security;
alter table missionaccounts.legacy_liability_review force row level security;
alter table missionaccounts.legacy_invoice_approval enable row level security;
alter table missionaccounts.legacy_invoice_approval force row level security;
alter table missionaccounts.legacy_frozen_source_bundle enable row level security;
alter table missionaccounts.legacy_frozen_source_bundle force row level security;

revoke all on missionaccounts.legacy_manual_item,
  missionaccounts.legacy_liability_review, missionaccounts.legacy_invoice_approval,
  missionaccounts.legacy_frozen_source_bundle
  from public,anon,authenticated,service_role;
grant select on missionaccounts.legacy_manual_item,
  missionaccounts.legacy_liability_review, missionaccounts.legacy_invoice_approval,
  missionaccounts.legacy_frozen_source_bundle
  to service_role;

revoke execute on function missionaccounts.legacy_source_digest(uuid,text)
  from public,anon,authenticated;
revoke execute on function missionaccounts.legacy_frozen_sources_valid()
  from public,anon,authenticated;
revoke execute on function missionaccounts.legacy_identity_and_attendance_provenance_valid(uuid,text)
  from public,anon,authenticated;
revoke execute on function missionaccounts.legacy_expected_invoice_lines(uuid,text)
  from public,anon,authenticated;
revoke execute on function missionaccounts.legacy_invoice_preview_snapshot(uuid,text)
  from public,anon,authenticated;
revoke execute on function missionaccounts.api_record_legacy_manual_item(
  uuid,text,text,text,integer,text,date,integer,integer,integer,text,text,text,text,text,text,text)
  from public,anon,authenticated;
revoke execute on function missionaccounts.api_record_legacy_liability(
  uuid,text,integer,text,text,text,text,text,text,text)
  from public,anon,authenticated;
revoke execute on function missionaccounts.api_approve_legacy_invoice_preview(
  uuid,text,jsonb,integer,text,text,text,text,text)
  from public,anon,authenticated;
grant execute on function missionaccounts.legacy_source_digest(uuid,text)
  to service_role;
grant execute on function missionaccounts.legacy_frozen_sources_valid()
  to service_role;
grant execute on function missionaccounts.legacy_identity_and_attendance_provenance_valid(uuid,text)
  to service_role;
grant execute on function missionaccounts.legacy_expected_invoice_lines(uuid,text)
  to service_role;
grant execute on function missionaccounts.legacy_invoice_preview_snapshot(uuid,text)
  to service_role;
grant execute on function missionaccounts.api_record_legacy_manual_item(
  uuid,text,text,text,integer,text,date,integer,integer,integer,text,text,text,text,text,text,text)
  to service_role;
grant execute on function missionaccounts.api_record_legacy_liability(
  uuid,text,integer,text,text,text,text,text,text,text)
  to service_role;
grant execute on function missionaccounts.api_approve_legacy_invoice_preview(
  uuid,text,jsonb,integer,text,text,text,text,text)
  to service_role;

COMMIT;
