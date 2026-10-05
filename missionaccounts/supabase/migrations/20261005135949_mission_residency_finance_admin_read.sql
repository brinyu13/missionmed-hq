-- DR-384 / MR-FINANCIAL-ACCOUNTS-PHASE2. Private Founder read projection only.
-- Target dwwsahpzblgrgducxtzw; depends on the sealed Phase 1 financial domain.
-- No agreement, payment, application, balance, entitlement or provider mutation.
begin;
create table missionaccounts.financial_read_binding (
 principal_id uuid not null, wp_user_id bigint not null check(wp_user_id>0),
 actor_id text not null references missionaccounts.financial_principal,
 authority_ref text not null, active boolean not null default true,
 primary key(principal_id,wp_user_id), unique(actor_id)
);
create table missionaccounts.financial_display_directory (
 subject_key text primary key references missionaccounts.financial_subject,
 display_name text not null check(length(display_name) between 1 and 200),
 program text not null, source_sha256 text not null check(source_sha256 ~ '^[0-9a-f]{64}$'),
 authority_ref text not null
);
do $$ declare t text; begin
 foreach t in array array['financial_read_binding','financial_display_directory'] loop
  execute format('alter table missionaccounts.%I enable row level security',t);
  execute format('alter table missionaccounts.%I force row level security',t);
  execute format('revoke all on missionaccounts.%I from public,anon,authenticated,service_role',t);
  execute format('grant select on missionaccounts.%I to service_role',t);
  execute format('create trigger %I before update or delete on missionaccounts.%I for each row execute function missionaccounts.reject_immutable_change()',t||'_immutable',t);
 end loop;
end $$;

create function missionaccounts.api_financial_read_access(p_principal uuid,p_wp_user_id bigint)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from missionaccounts.financial_read_binding b
 join missionaccounts.financial_principal p on p.actor_id=b.actor_id
 where b.principal_id=p_principal and b.wp_user_id=p_wp_user_id and b.active
 and 'read'=any(p.capabilities));
$$;

create function missionaccounts.api_read_financial_command(p_principal uuid,p_wp_user_id bigint)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not missionaccounts.api_financial_read_access(p_principal,p_wp_user_id) then
  raise exception 'Explicit Founder financial authorization required' using errcode='42501';
 end if;
 return jsonb_build_object('observed_at',now(),'accounts',(
 select coalesce(jsonb_agg(jsonb_build_object(
  'subject_key',s.subject_key,'name',coalesce(d.display_name,s.subject_key),
  'program',coalesce(g.program,d.program),'tier',g.tier,'state',s.certification_state,
  'binding_state',s.binding_state,'student_visible',s.student_visible,'collections_enabled',s.collections_enabled,
  'created_at',s.created_at,
  'agreement',case when g.id is null then null else jsonb_build_object(
   'id',g.id,'version',g.version,'currency',g.currency,'tuition_cents',g.accepted_tuition_cents,
   'fees_cents',g.accepted_fees_cents,'deposit_cents',g.deposit_cents,'effective_on',g.effective_on,
   'effective_precision',g.effective_precision,'plan',g.plan,'discount_provenance',g.discount_provenance,
   'evidence',g.agreement_evidence,'certification_status',g.certification_status,'certified_at',g.certified_at) end,
  'balance',case when b.agreement_id is null then null else jsonb_build_object(
   'balance_cents',b.balance_cents,'currently_due_cents',b.currently_due_cents,'overdue_cents',b.overdue_cents) end,
  'obligations',coalesce((select jsonb_agg(to_jsonb(o) order by o.obligation_key) from missionaccounts.financial_obligation_state o where o.agreement_id=g.id),'[]'::jsonb),
  'payments',coalesce((select jsonb_agg(jsonb_build_object(
   'id',p.id,'date',p.received_at,'date_precision',p.received_precision,'amount_cents',p.gross_cents,
   'method',p.method,'payer',p.payer,'provider',p.provider,'verification_state',p.verification_state,
   'verified_at',p.verified_at,
   'applied_cents',coalesce((select sum(a.amount_cents) from missionaccounts.financial_payment_application a where a.payment_id=p.id),0),
   'unapplied_cents',(select c.credit_cents from missionaccounts.financial_unapplied_credit c where c.payment_id=p.id),
   'evidence',coalesce((select jsonb_agg(jsonb_build_object('type',e.evidence_type,'provider',e.provider,
    'reference',e.provider_reference,'fingerprint',e.fingerprint,'verified',e.verified)) from missionaccounts.financial_payment_evidence e where e.payment_id=p.id),'[]'::jsonb)
  ) order by p.received_at,p.id) from missionaccounts.financial_payment p where p.subject_key=s.subject_key),'[]'::jsonb),
  'applications',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'payment_id',a.payment_id,
   'obligation_id',a.obligation_id,'obligation',o.obligation_key,'component',o.component,
   'amount_cents',a.amount_cents,'recorded_at',a.created_at) order by a.created_at,a.id)
   from missionaccounts.financial_payment_application a join missionaccounts.financial_obligation o on o.id=a.obligation_id where o.agreement_id=g.id),'[]'::jsonb),
  'adjustments',coalesce((select jsonb_agg(jsonb_build_object('kind',a.kind,'amount_cents',a.amount_cents,'authority_ref',a.authority_ref,'evidence_fingerprint',a.evidence_fingerprint,'created_at',a.created_at))
   from missionaccounts.financial_adjustment a left join missionaccounts.financial_obligation o on o.id=a.obligation_id
   left join missionaccounts.financial_payment p on p.id=a.payment_id where o.agreement_id=g.id or p.subject_key=s.subject_key),'[]'::jsonb),
  'payers',coalesce((select jsonb_agg(jsonb_build_object('payer',p.payer,'relationship',p.relationship,'provenance',p.provenance) order by p.payer) from missionaccounts.financial_payer_alias p where p.subject_key=s.subject_key),'[]'::jsonb),
  'cases',coalesce((select jsonb_agg(jsonb_build_object('type',c.hold_class,'reason',c.reason)) from missionaccounts.financial_reconciliation_case c where c.subject_key=s.subject_key),'[]'::jsonb),
  'source',jsonb_build_object('kind',a.source_kind,'sha256',a.sha256,'observed_at',a.observed_at,
    'display_sha256',d.source_sha256,'display_authority',d.authority_ref)
 ) order by coalesce(d.display_name,s.subject_key)),'[]'::jsonb)
 from missionaccounts.financial_subject s
 left join missionaccounts.financial_display_directory d on d.subject_key=s.subject_key
 left join missionaccounts.financial_agreement g on g.subject_key=s.subject_key
 left join missionaccounts.financial_balance b on b.agreement_id=g.id
 join missionaccounts.source_artifact a on a.id=s.artifact_id));
end $$;
revoke all on function missionaccounts.api_financial_read_access(uuid,bigint),missionaccounts.api_read_financial_command(uuid,bigint) from public,anon,authenticated,service_role;
grant execute on function missionaccounts.api_financial_read_access(uuid,bigint),missionaccounts.api_read_financial_command(uuid,bigint) to service_role;
commit;
