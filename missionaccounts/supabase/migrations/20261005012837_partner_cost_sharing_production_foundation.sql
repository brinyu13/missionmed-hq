-- Migration: 20261005012837_partner_cost_sharing_production_foundation.sql
-- Authority: PARTNER-COST-SHARING-20261004; DR-377/378 direct Founder LIVE steer
-- Date: 2026-10-05 UTC
-- Depends on: none (new isolated partner_cost_sharing schema)
-- Description: Exact previously reviewed private ledger SQL with MR-078A-complete release header.
-- Idempotent: NO
-- Source custody: immutable 20261004213308 candidate SHA dcfbc01b6c4cd475299f28bb9c2c9c9104576edc37324ab08f37e94ffeb6683d.
-- That source-only candidate is retired/unapplied; apply this NEW forward migration only.
-- PARTNER-COST-SHARING-20261004; DR-377/378 + Founder continuation.
-- Target: independently verified missionaccounts-production dwwsahpzblgrgducxtzw.
-- NEW private schema only. UNAPPLIED production candidate. No neighboring schema changes.
-- Rollback: gates OFF, retain financial/evidence history. No destructive down migration.
BEGIN;
CREATE SCHEMA partner_cost_sharing;
REVOKE ALL ON SCHEMA partner_cost_sharing FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA partner_cost_sharing REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA partner_cost_sharing REVOKE ALL ON FUNCTIONS FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE partner_cost_sharing.partners (
 key text PRIMARY KEY CHECK (key IN ('brian','drj','phil')),
 principal_id uuid UNIQUE, wp_user_id bigint UNIQUE CHECK (wp_user_id>0),
 active boolean NOT NULL DEFAULT false, name text NOT NULL,
 CHECK (NOT active OR (principal_id IS NOT NULL AND wp_user_id IS NOT NULL))
);
INSERT INTO partner_cost_sharing.partners(key,name) VALUES ('brian','Brian'),('drj','Dr J'),('phil','Phil');
-- Seed identities are intentionally unbound/inactive. No guessed principal or role inheritance.
CREATE TABLE partner_cost_sharing.ledger_control(id boolean PRIMARY KEY DEFAULT true CHECK(id),revision bigint NOT NULL DEFAULT 0, audit_head text NOT NULL DEFAULT repeat('0',64));
INSERT INTO partner_cost_sharing.ledger_control DEFAULT VALUES;
CREATE TABLE partner_cost_sharing.expenses (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), vendor text NOT NULL, invoice_number text NOT NULL,
 period_start date NOT NULL,period_end date NOT NULL CHECK(period_end>=period_start),
 amount_cents bigint NOT NULL CHECK(amount_cents BETWEEN 0 AND 9007199254740991),
 currency text NOT NULL CHECK(currency='USD'),category text NOT NULL,description text NOT NULL,
 evidence_sha256 text NOT NULL UNIQUE CHECK(evidence_sha256~'^[0-9a-f]{64}$'),asset_id text NOT NULL,
 source text NOT NULL,state text NOT NULL DEFAULT 'NEEDS_VERIFICATION' CHECK(state IN ('NEEDS_VERIFICATION','APPROVED','EXCLUDED')),
 reviewed_by text REFERENCES partner_cost_sharing.partners(key),review_reason text,
 tax_cents bigint NOT NULL DEFAULT 0 CHECK(tax_cents BETWEEN 0 AND 9007199254740991),discount_cents bigint NOT NULL DEFAULT 0 CHECK(discount_cents BETWEEN 0 AND 9007199254740991),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(), UNIQUE(vendor,invoice_number)
);
CREATE UNIQUE INDEX expense_vendor_invoice_normalized ON partner_cost_sharing.expenses(lower(vendor),invoice_number);
CREATE TABLE partner_cost_sharing.periods (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),period_start date NOT NULL,period_end date NOT NULL CHECK(period_end>=period_start),
 coverage_cutoff date NOT NULL CHECK(coverage_cutoff<=period_end),revision bigint NOT NULL UNIQUE,
 opening_balances jsonb NOT NULL,allocation_rule_version text NOT NULL CHECK(allocation_rule_version='equal-third-brian-residual-v1'),
 certification_evidence_sha256 text NOT NULL CHECK(certification_evidence_sha256~'^[0-9a-f]{64}$'),
 snapshot_hash text NOT NULL CHECK(snapshot_hash~'^[0-9a-f]{64}$'),certified_by text NOT NULL CHECK(certified_by='brian'),
 certified_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE partner_cost_sharing.period_expenses (
 period_id uuid NOT NULL REFERENCES partner_cost_sharing.periods(id),expense_id uuid NOT NULL UNIQUE REFERENCES partner_cost_sharing.expenses(id),PRIMARY KEY(period_id,expense_id)
);
CREATE TABLE partner_cost_sharing.obligations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),partner text NOT NULL REFERENCES partner_cost_sharing.partners(key),
 period_id uuid NOT NULL REFERENCES partner_cost_sharing.periods(id),revision bigint NOT NULL,snapshot_hash text NOT NULL,
 amount_cents bigint NOT NULL CHECK(amount_cents BETWEEN 0 AND 9007199254740991),opening_credit_cents bigint NOT NULL DEFAULT 0 CHECK(opening_credit_cents>=0),
 applied_cents bigint NOT NULL DEFAULT 0 CHECK(applied_cents>=0),
 status text NOT NULL CHECK(status IN ('OPEN','PARTIAL','PAID','VOID')),currency text NOT NULL CHECK(currency='USD'),
 credit_applied_cents bigint NOT NULL DEFAULT 0 CHECK(credit_applied_cents>=0),adjustment_applied_cents bigint NOT NULL DEFAULT 0 CHECK(adjustment_applied_cents>=0),settlement_revision bigint NOT NULL DEFAULT 0,
 CHECK(amount_cents+adjustment_applied_cents BETWEEN 0 AND 9007199254740991),
 CHECK(amount_cents+adjustment_applied_cents-credit_applied_cents-applied_cents>=0),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),UNIQUE(partner,period_id)
);
CREATE TABLE partner_cost_sharing.allocation_lines (
 obligation_id uuid NOT NULL REFERENCES partner_cost_sharing.obligations(id),expense_id uuid NOT NULL REFERENCES partner_cost_sharing.expenses(id),
 amount_cents bigint NOT NULL CHECK(amount_cents>=0),PRIMARY KEY(obligation_id,expense_id)
);
CREATE TABLE partner_cost_sharing.claims (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),partner text NOT NULL REFERENCES partner_cost_sharing.partners(key),
 obligation_id uuid NOT NULL REFERENCES partner_cost_sharing.obligations(id),amount_cents bigint NOT NULL CHECK(amount_cents>0 AND amount_cents<=9007199254740991),
 state text NOT NULL DEFAULT 'PENDING_VERIFICATION' CHECK(state IN ('PENDING_VERIFICATION','RECONCILED','NEEDS_REVIEW')),
 reported_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE partner_cost_sharing.payments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),partner text NOT NULL REFERENCES partner_cost_sharing.partners(key),
 obligation_id uuid NOT NULL REFERENCES partner_cost_sharing.obligations(id),amount_cents bigint NOT NULL CHECK(amount_cents>0 AND amount_cents<=9007199254740991),
 amount_applied_cents bigint NOT NULL CHECK(amount_applied_cents>0 AND amount_applied_cents<=amount_cents),
 fingerprint text NOT NULL UNIQUE CHECK(fingerprint~'^[0-9a-f]{64}$'),
 message_fingerprint text UNIQUE CHECK(message_fingerprint~'^[0-9a-f]{64}$'),
 method text NOT NULL CHECK(method IN ('authenticated_chase_gmail','authorized_admin','stripe_webhook')),
 evidence_sha256 text NOT NULL CHECK(evidence_sha256~'^[0-9a-f]{64}$'),
 received_at timestamptz NOT NULL,verified_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 historical_assignment jsonb,excess_credit_cents bigint NOT NULL DEFAULT 0 CHECK(excess_credit_cents>=0),
 receipt_state text NOT NULL DEFAULT 'READY' CHECK(receipt_state='READY'),statement_state text NOT NULL DEFAULT 'POSTED' CHECK(statement_state='POSTED')
);
CREATE TABLE partner_cost_sharing.adjustments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),partner text NOT NULL REFERENCES partner_cost_sharing.partners(key),
 amount_cents bigint NOT NULL CHECK(amount_cents<>0 AND amount_cents BETWEEN -9007199254740991 AND 9007199254740991),
 evidence_sha256 text NOT NULL CHECK(evidence_sha256~'^[0-9a-f]{64}$'),reason text NOT NULL,posted_by text NOT NULL CHECK(posted_by='brian'),
 posted_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE partner_cost_sharing.settlement_applications(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),partner text NOT NULL REFERENCES partner_cost_sharing.partners(key),
 obligation_id uuid NOT NULL REFERENCES partner_cost_sharing.obligations(id),
 source_kind text NOT NULL CHECK(source_kind IN ('opening_credit','adjustment')),source_id uuid NOT NULL,
 amount_cents bigint NOT NULL CHECK(amount_cents>0 AND amount_cents<=9007199254740991),direction text NOT NULL CHECK(direction IN ('CREDIT','DEBIT')),
 evidence_sha256 text NOT NULL CHECK(evidence_sha256~'^[0-9a-f]{64}$'),reason text NOT NULL,revision bigint NOT NULL,
 posted_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE partner_cost_sharing.methods (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),partner text NOT NULL REFERENCES partner_cost_sharing.partners(key),provider_reference text NOT NULL,customer_reference text NOT NULL,
 brand text NOT NULL,last4 text CHECK(last4~'^[0-9]{4}$'),state text NOT NULL CHECK(state IN ('ACTIVE','REMOVED','REPLACED')),created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE UNIQUE INDEX one_active_partner_method ON partner_cost_sharing.methods(partner) WHERE state='ACTIVE';
CREATE TABLE partner_cost_sharing.consents (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),partner text NOT NULL REFERENCES partner_cost_sharing.partners(key),period_id uuid NOT NULL REFERENCES partner_cost_sharing.periods(id),
 terms_version text NOT NULL,terms_sha256 text NOT NULL CHECK(terms_sha256~'^[0-9a-f]{64}$'),max_amount_cents bigint NOT NULL CHECK(max_amount_cents>0),
 accepted_at timestamptz NOT NULL DEFAULT clock_timestamp(),revoked_at timestamptz
);
CREATE UNIQUE INDEX one_active_partner_consent ON partner_cost_sharing.consents(partner) WHERE revoked_at IS NULL;
CREATE TABLE partner_cost_sharing.proposals (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),source_sha256 text NOT NULL CHECK(source_sha256~'^[0-9a-f]{64}$'),
 source_id text NOT NULL,proposal jsonb NOT NULL,state text NOT NULL DEFAULT 'NEEDS_REVIEW' CHECK(state IN ('NEEDS_REVIEW','ACCEPTED','REJECTED')),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),UNIQUE(source_sha256,source_id)
);

CREATE TABLE partner_cost_sharing.evidence_assets(
 asset_id text PRIMARY KEY,object_key text NOT NULL UNIQUE CHECK(object_key~'^[a-z0-9-]{1,80}/[a-z0-9._-]{1,160}$'),
 original_sha256 text NOT NULL CHECK(original_sha256~'^[0-9a-f]{64}$'),
 content_type text NOT NULL CHECK(content_type IN ('application/pdf','image/png','image/jpeg')),
 byte_length bigint NOT NULL CHECK(byte_length BETWEEN 1 AND 10485760),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE partner_cost_sharing.collection_control(id boolean PRIMARY KEY DEFAULT true CHECK(id),mode text NOT NULL DEFAULT 'disabled' CHECK(mode IN ('disabled','shadow','test','live')));
INSERT INTO partner_cost_sharing.collection_control DEFAULT VALUES;
CREATE TABLE partner_cost_sharing.dispatches(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),partner text NOT NULL REFERENCES partner_cost_sharing.partners(key),
 obligation_id uuid NOT NULL REFERENCES partner_cost_sharing.obligations(id),revision bigint NOT NULL,settlement_revision bigint NOT NULL,
 snapshot_hash text NOT NULL,consent_id uuid NOT NULL REFERENCES partner_cost_sharing.consents(id),method_id uuid NOT NULL REFERENCES partner_cost_sharing.methods(id),
 amount_cents bigint NOT NULL CHECK(amount_cents>0 AND amount_cents<=9007199254740991),payload_hash text NOT NULL,authority_sha256 text NOT NULL CHECK(authority_sha256~'^[0-9a-f]{64}$'),
 idempotency_key text NOT NULL UNIQUE,state text NOT NULL DEFAULT 'DISPATCHING' CHECK(state IN ('DISPATCHING','SUCCEEDED','NEEDS_REVIEW','FAILED','CANCELLED')),
 provider_payment_id text UNIQUE,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),UNIQUE(obligation_id,revision,settlement_revision)
);

CREATE TABLE partner_cost_sharing.requests (
 actor text NOT NULL REFERENCES partner_cost_sharing.partners(key),request_id text NOT NULL,command text NOT NULL,payload_hash text NOT NULL,
 result jsonb,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),PRIMARY KEY(actor,request_id)
);
CREATE TABLE partner_cost_sharing.audit (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,actor text NOT NULL,command text NOT NULL,request_id text NOT NULL,
 result_hash text NOT NULL,previous_hash text NOT NULL,event_hash text NOT NULL UNIQUE,created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE FUNCTION partner_cost_sharing.immutable_record() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN RAISE EXCEPTION 'Immutable Partner Cost Sharing record; use an authorized append-only correction'; END;$$;
CREATE TRIGGER asset_immutable BEFORE UPDATE OR DELETE ON partner_cost_sharing.evidence_assets FOR EACH ROW EXECUTE FUNCTION partner_cost_sharing.immutable_record();
CREATE TRIGGER payment_immutable BEFORE UPDATE OR DELETE ON partner_cost_sharing.payments FOR EACH ROW EXECUTE FUNCTION partner_cost_sharing.immutable_record();
CREATE TRIGGER audit_immutable BEFORE UPDATE OR DELETE ON partner_cost_sharing.audit FOR EACH ROW EXECUTE FUNCTION partner_cost_sharing.immutable_record();
CREATE TRIGGER periods_immutable BEFORE UPDATE OR DELETE ON partner_cost_sharing.periods FOR EACH ROW EXECUTE FUNCTION partner_cost_sharing.immutable_record();
CREATE TRIGGER allocations_immutable BEFORE UPDATE OR DELETE ON partner_cost_sharing.allocation_lines FOR EACH ROW EXECUTE FUNCTION partner_cost_sharing.immutable_record();
CREATE TRIGGER settlement_immutable BEFORE UPDATE OR DELETE ON partner_cost_sharing.settlement_applications FOR EACH ROW EXECUTE FUNCTION partner_cost_sharing.immutable_record();
CREATE TRIGGER adjustments_immutable BEFORE UPDATE OR DELETE ON partner_cost_sharing.adjustments FOR EACH ROW EXECUTE FUNCTION partner_cost_sharing.immutable_record();

CREATE FUNCTION partner_cost_sharing.member_for_principal(p_actor uuid,p_wp_user_id bigint) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,partner_cost_sharing AS $$
 SELECT jsonb_build_object('key',key,'active',active) FROM partner_cost_sharing.partners
 WHERE principal_id=p_actor AND wp_user_id=p_wp_user_id AND active;
$$;
CREATE FUNCTION partner_cost_sharing.require_member(p_actor uuid,p_wp_user_id bigint,p_admin boolean DEFAULT false) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,partner_cost_sharing AS $$
DECLARE k text;BEGIN
 SELECT key INTO k FROM partner_cost_sharing.partners WHERE principal_id=p_actor AND wp_user_id=p_wp_user_id AND active FOR UPDATE;
 IF k IS NULL OR (p_admin AND k<>'brian') THEN RAISE EXCEPTION 'Explicit active partner authority required' USING ERRCODE='42501'; END IF;
 RETURN k;END;$$;
CREATE FUNCTION partner_cost_sharing.begin_request(p_actor text,p_request text,p_command text,p_payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SET search_path=pg_catalog,partner_cost_sharing AS $$
DECLARE r partner_cost_sharing.requests;h text;
BEGIN
 IF p_request IS NULL OR p_request!~'^[A-Za-z0-9._:-]{8,160}$' THEN RAISE EXCEPTION 'Idempotency key required';END IF;
 h=encode(sha256(convert_to(p_command||p_payload::text,'UTF8')),'hex');
 SELECT * INTO r FROM partner_cost_sharing.requests WHERE actor=p_actor AND request_id=p_request FOR UPDATE;
 IF FOUND THEN IF r.command<>p_command OR r.payload_hash<>h THEN RAISE EXCEPTION 'Idempotency request conflict';END IF;RETURN r.result||jsonb_build_object('duplicate',true);END IF;
 INSERT INTO partner_cost_sharing.requests(actor,request_id,command,payload_hash) VALUES(p_actor,p_request,p_command,h);
 RETURN NULL;END;$$;
CREATE FUNCTION partner_cost_sharing.finish_request(p_actor text,p_request text,p_command text,p_result jsonb) RETURNS jsonb
LANGUAGE plpgsql SET search_path=pg_catalog,partner_cost_sharing AS $$
DECLARE prev text;result_hash text;event_hash text;
BEGIN
 SELECT audit_head INTO prev FROM partner_cost_sharing.ledger_control WHERE id FOR UPDATE;
 result_hash=encode(sha256(convert_to(p_result::text,'UTF8')),'hex');
 event_hash=encode(sha256(convert_to(prev||p_actor||p_request||p_command||result_hash,'UTF8')),'hex');
 INSERT INTO partner_cost_sharing.audit(actor,command,request_id,result_hash,previous_hash,event_hash) VALUES(p_actor,p_command,p_request,result_hash,prev,event_hash);
 UPDATE partner_cost_sharing.ledger_control SET audit_head=event_hash WHERE id;
 UPDATE partner_cost_sharing.requests SET result=p_result WHERE actor=p_actor AND request_id=p_request;
 RETURN p_result;END;$$;

CREATE FUNCTION partner_cost_sharing.ingest_expense(p_actor uuid,p_wp_user_id bigint,p_request text,p_payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,partner_cost_sharing AS $$
DECLARE k text;old jsonb;r partner_cost_sharing.expenses;e partner_cost_sharing.expenses;
BEGIN
 k=partner_cost_sharing.require_member(p_actor,p_wp_user_id,true);old=partner_cost_sharing.begin_request(k,p_request,'ingest',p_payload);IF old IS NOT NULL THEN RETURN old;END IF;
 IF p_payload->>'vendor' IS NULL OR length(p_payload->>'vendor') NOT BETWEEN 1 AND 200 OR p_payload->>'invoiceNumber' IS NULL
 OR length(p_payload->>'invoiceNumber') NOT BETWEEN 1 AND 200 OR p_payload->>'assetId' IS NULL OR p_payload->>'source' IS NULL THEN RAISE EXCEPTION 'Required invoice provenance absent';END IF;
 SELECT * INTO e FROM partner_cost_sharing.expenses WHERE lower(vendor)=lower(p_payload->>'vendor') AND invoice_number=p_payload->>'invoiceNumber';
 IF FOUND THEN
  IF e.amount_cents IS DISTINCT FROM (p_payload->>'amountCents')::bigint OR e.evidence_sha256 IS DISTINCT FROM p_payload->>'evidenceSha256' THEN RAISE EXCEPTION 'Conflicting invoice evidence';END IF;
  RETURN partner_cost_sharing.finish_request(k,p_request,'ingest',jsonb_build_object('expense',to_jsonb(e),'duplicate',true));
 END IF;
 INSERT INTO partner_cost_sharing.expenses(vendor,invoice_number,period_start,period_end,amount_cents,currency,category,description,evidence_sha256,asset_id,source,tax_cents,discount_cents)
 VALUES(p_payload->>'vendor',p_payload->>'invoiceNumber',(p_payload->>'periodStart')::date,(p_payload->>'periodEnd')::date,(p_payload->>'amountCents')::bigint,p_payload->>'currency',p_payload->>'category',p_payload->>'description',p_payload->>'evidenceSha256',p_payload->>'assetId',p_payload->>'source',coalesce((p_payload->>'taxCents')::bigint,0),coalesce((p_payload->>'discountCents')::bigint,0)) RETURNING * INTO r;
 RETURN partner_cost_sharing.finish_request(k,p_request,'ingest',jsonb_build_object('expense',to_jsonb(r)));END;$$;

CREATE FUNCTION partner_cost_sharing.review_expense(p_actor uuid,p_wp_user_id bigint,p_request text,p_payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,partner_cost_sharing AS $$
DECLARE k text;old jsonb;rev bigint;r partner_cost_sharing.expenses;
BEGIN
 k=partner_cost_sharing.require_member(p_actor,p_wp_user_id,true);old=partner_cost_sharing.begin_request(k,p_request,'expense-review',p_payload);IF old IS NOT NULL THEN RETURN old;END IF;
 SELECT revision INTO rev FROM partner_cost_sharing.ledger_control WHERE id FOR UPDATE;
 IF rev IS DISTINCT FROM (p_payload->>'expectedRevision')::bigint OR p_payload->>'decision' IS NULL OR p_payload->>'decision' NOT IN ('approve','exclude') OR length(coalesce(p_payload->>'reason','')) NOT BETWEEN 1 AND 1000 THEN RAISE EXCEPTION 'Review revision/decision/rationale invalid';END IF;
 SELECT * INTO r FROM partner_cost_sharing.expenses WHERE id=(p_payload->>'expenseId')::uuid FOR UPDATE;
 IF NOT FOUND OR r.state<>'NEEDS_VERIFICATION' OR r.evidence_sha256 IS DISTINCT FROM p_payload->>'evidenceSha256' THEN RAISE EXCEPTION 'Invoice is missing/reviewed or custody differs';END IF;
 IF p_payload->>'decision'='approve' AND NOT EXISTS(SELECT 1 FROM partner_cost_sharing.evidence_assets WHERE asset_id=r.asset_id AND original_sha256=r.evidence_sha256) THEN RAISE EXCEPTION 'Verified private original custody metadata required';END IF;
 UPDATE partner_cost_sharing.expenses SET state=CASE WHEN p_payload->>'decision'='approve' THEN 'APPROVED' ELSE 'EXCLUDED' END,reviewed_by=k,review_reason=p_payload->>'reason' WHERE id=r.id RETURNING * INTO r;
 UPDATE partner_cost_sharing.ledger_control SET revision=revision+1 WHERE id;
 RETURN partner_cost_sharing.finish_request(k,p_request,'expense-review',jsonb_build_object('expense',to_jsonb(r),'revision',rev+1));END;$$;

CREATE FUNCTION partner_cost_sharing.certify_period(p_actor uuid,p_wp_user_id bigint,p_request text,p_payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,partner_cost_sharing AS $$
DECLARE k text;old jsonb;rev bigint;total bigint;payor bigint;target bigint;pid uuid;oid uuid;pk text;start_date date;end_date date;cutoff date;ids uuid[];snap text;opening bigint;base bigint;remaining bigint;
shares bigint[]:=ARRAY[0,0,0]::bigint[];targets bigint[];deficits bigint[];line_shares bigint[];ord integer;idx integer;row_exp partner_cost_sharing.expenses;
BEGIN
 k=partner_cost_sharing.require_member(p_actor,p_wp_user_id,true);old=partner_cost_sharing.begin_request(k,p_request,'certify-period',p_payload);IF old IS NOT NULL THEN RETURN old;END IF;
 SELECT revision INTO rev FROM partner_cost_sharing.ledger_control WHERE id FOR UPDATE;
 IF (p_payload->>'expectedRevision')::bigint IS DISTINCT FROM rev OR p_payload->>'allocationRuleVersion' IS DISTINCT FROM 'equal-third-brian-residual-v1' THEN RAISE EXCEPTION 'Revision or allocation contract differs';END IF;
 start_date=(p_payload->>'periodStart')::date;end_date=(p_payload->>'periodEnd')::date;cutoff=(p_payload->>'coverageCutoff')::date;
 IF start_date IS NULL OR end_date IS NULL OR start_date>end_date OR cutoff IS NULL OR cutoff>end_date THEN RAISE EXCEPTION 'Coverage contract invalid';END IF;
 IF (SELECT count(*) FROM jsonb_object_keys(p_payload->'openingBalances'))<>3 OR NOT (p_payload->'openingBalances' ?& ARRAY['brian','drj','phil']) THEN RAISE EXCEPTION 'All certified opening balances required';END IF;
 IF EXISTS(SELECT 1 FROM partner_cost_sharing.periods WHERE period_start<=end_date AND period_end>=start_date) THEN RAISE EXCEPTION 'Period coverage overlaps';END IF;
 IF EXISTS(SELECT 1 FROM partner_cost_sharing.periods) AND EXISTS(SELECT 1 FROM jsonb_each_text(p_payload->'openingBalances') WHERE value::bigint<>0) THEN RAISE EXCEPTION 'Subsequent periods carry existing ledger, not repeated opening balances';END IF;
 SELECT array_agg(value::uuid ORDER BY ordinality) INTO ids FROM jsonb_array_elements_text(p_payload->'expenseIds') WITH ORDINALITY;
 IF coalesce(cardinality(ids),0)=0 OR cardinality(ids)<>(SELECT count(DISTINCT x) FROM unnest(ids) x) THEN RAISE EXCEPTION 'Explicit unique census required';END IF;
 IF (SELECT count(*) FROM partner_cost_sharing.expenses WHERE id=ANY(ids) AND state='APPROVED')<>cardinality(ids) OR EXISTS(SELECT 1 FROM partner_cost_sharing.period_expenses WHERE expense_id=ANY(ids)) THEN RAISE EXCEPTION 'Unsupported/already allocated expense';END IF;
 SELECT sum(amount_cents),sum(amount_cents/3) INTO total,base FROM partner_cost_sharing.expenses WHERE id=ANY(ids);
 IF total>9007199254740991 THEN RAISE EXCEPTION 'Batch total exceeds integer range';END IF;
 payor=(total+1)/3;targets=ARRAY[total-2*payor,payor,payor];IF total=1 THEN targets=ARRAY[0,1,0];END IF;
 deficits=ARRAY[targets[1]-base,targets[2]-base,targets[3]-base];
 snap=encode(sha256(convert_to(p_payload::text||':'||(rev+1)::text||':'||(SELECT jsonb_agg(to_jsonb(e) ORDER BY e.id)::text FROM partner_cost_sharing.expenses e WHERE id=ANY(ids)),'UTF8')),'hex');
 INSERT INTO partner_cost_sharing.periods(period_start,period_end,coverage_cutoff,revision,opening_balances,allocation_rule_version,certification_evidence_sha256,snapshot_hash,certified_by)
 VALUES(start_date,end_date,cutoff,rev+1,p_payload->'openingBalances','equal-third-brian-residual-v1',p_payload->>'certificationEvidenceSha256',snap,k) RETURNING id INTO pid;
 FOREACH pk IN ARRAY ARRAY['brian','drj','phil'] LOOP
  idx=array_position(ARRAY['brian','drj','phil'],pk);opening=(p_payload->'openingBalances'->>pk)::bigint;
  IF abs(opening)>9007199254740991 THEN RAISE EXCEPTION 'Opening balance outside integer range';END IF;
  target=opening+targets[idx];
  INSERT INTO partner_cost_sharing.obligations(partner,period_id,revision,snapshot_hash,amount_cents,opening_credit_cents,status,currency)
  VALUES(pk,pid,rev+1,snap,greatest(target,0),greatest(-target,0),CASE WHEN target<=0 THEN 'PAID' ELSE 'OPEN' END,'USD');
 END LOOP;
 -- Allocate each source row exactly, while meeting the approved batch targets.
 FOREACH oid IN ARRAY ids LOOP
  SELECT * INTO row_exp FROM partner_cost_sharing.expenses WHERE id=oid;
  line_shares=ARRAY[row_exp.amount_cents/3,row_exp.amount_cents/3,row_exp.amount_cents/3];remaining=row_exp.amount_cents%3;
  FOR ord IN 1..3 LOOP
   SELECT i INTO idx FROM generate_series(1,3) i WHERE deficits[i]>0 AND line_shares[i]=row_exp.amount_cents/3 ORDER BY deficits[i] DESC,CASE i WHEN 2 THEN 0 WHEN 3 THEN 1 ELSE 2 END LIMIT 1;
   IF remaining>0 AND idx IS NOT NULL THEN line_shares[idx]=line_shares[idx]+1;deficits[idx]=deficits[idx]-1;remaining=remaining-1;END IF;
  END LOOP;
  IF remaining<>0 THEN RAISE EXCEPTION 'Allocation row invariant failed';END IF;
  INSERT INTO partner_cost_sharing.period_expenses VALUES(pid,oid);
  FOR idx IN 1..3 LOOP
   INSERT INTO partner_cost_sharing.allocation_lines(obligation_id,expense_id,amount_cents) SELECT id,oid,line_shares[idx] FROM partner_cost_sharing.obligations WHERE period_id=pid AND partner=(ARRAY['brian','drj','phil'])[idx];
  END LOOP;
 END LOOP;
 IF deficits<>ARRAY[0,0,0]::bigint[] THEN RAISE EXCEPTION 'Allocation batch invariant failed';END IF;
 UPDATE partner_cost_sharing.ledger_control SET revision=revision+1 WHERE id;
 RETURN partner_cost_sharing.finish_request(k,p_request,'certify-period',jsonb_build_object('periodId',pid,'revision',rev+1,'snapshotHash',snap));END;$$;

CREATE FUNCTION partner_cost_sharing.report_sent(p_actor uuid,p_wp_user_id bigint,p_request text,p_payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,partner_cost_sharing AS $$
DECLARE k text;old jsonb;o partner_cost_sharing.obligations;c partner_cost_sharing.claims;a bigint;
BEGIN
 k=partner_cost_sharing.require_member(p_actor,p_wp_user_id,false);old=partner_cost_sharing.begin_request(k,p_request,'report-sent',p_payload);IF old IS NOT NULL THEN RETURN old;END IF;
 a=(p_payload->>'amountCents')::bigint;
 SELECT * INTO o FROM partner_cost_sharing.obligations WHERE id=(p_payload->>'obligationId')::uuid AND partner=k FOR UPDATE;
 IF NOT FOUND OR o.status NOT IN ('OPEN','PARTIAL') OR a IS NULL OR a<=0 OR a>o.amount_cents+o.adjustment_applied_cents-o.credit_applied_cents-o.applied_cents THEN RAISE EXCEPTION 'Own eligible claim required';END IF;
 INSERT INTO partner_cost_sharing.claims(partner,obligation_id,amount_cents) VALUES(k,o.id,a) RETURNING * INTO c;
 RETURN partner_cost_sharing.finish_request(k,p_request,'report-sent',jsonb_build_object('claim',to_jsonb(c),'moneyMoved',false));END;$$;

CREATE FUNCTION partner_cost_sharing.mark_partner_payment_verified_and_complete(p_actor uuid,p_wp_user_id bigint,p_request text,p_payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,partner_cost_sharing AS $$
DECLARE k text;old jsonb;o partner_cost_sharing.obligations;receipt partner_cost_sharing.payments;prior partner_cost_sharing.payments;a bigint;method_name text;received timestamptz;applied bigint;excess bigint;hist jsonb;period_row partner_cost_sharing.periods;d partner_cost_sharing.dispatches;next_revision bigint;
BEGIN
 k=partner_cost_sharing.require_member(p_actor,p_wp_user_id,true);old=partner_cost_sharing.begin_request(k,p_request,'verify-and-complete',p_payload);IF old IS NOT NULL THEN RETURN old;END IF;
 a=(p_payload->>'amountCents')::bigint;method_name=p_payload->>'method';received=(p_payload->>'receivedAt')::timestamptz;
 IF a IS NULL OR a<=0 OR method_name IS NULL OR method_name NOT IN ('authenticated_chase_gmail','authorized_admin','stripe_webhook') THEN RAISE EXCEPTION 'Verified receipt method/amount required';END IF;
 IF method_name='authenticated_chase_gmail' AND (p_payload->>'transportVerified')::boolean IS DISTINCT FROM true THEN RAISE EXCEPTION 'Authenticated receipt transport required';END IF;
 IF method_name='stripe_webhook' AND (p_payload->>'signatureVerified')::boolean IS DISTINCT FROM true THEN RAISE EXCEPTION 'Authenticated provider signature required';END IF;
 IF method_name='authorized_admin' AND length(coalesce(p_payload->>'attestation','')) NOT BETWEEN 1 AND 1000 THEN RAISE EXCEPTION 'Exact manual evidence attestation required';END IF;
 SELECT * INTO prior FROM partner_cost_sharing.payments WHERE fingerprint=p_payload->>'fingerprint' OR message_fingerprint=p_payload->>'messageFingerprint';
 IF FOUND THEN
  IF prior.obligation_id IS DISTINCT FROM (p_payload->>'obligationId')::uuid OR prior.partner IS DISTINCT FROM p_payload->>'partner' OR prior.amount_cents IS DISTINCT FROM a OR prior.evidence_sha256 IS DISTINCT FROM p_payload->>'evidenceSha256' THEN RAISE EXCEPTION 'Consumed receipt conflict';END IF;
  RETURN partner_cost_sharing.finish_request(k,p_request,'verify-and-complete',jsonb_build_object('payment',to_jsonb(prior),'duplicate',true));
 END IF;
 SELECT revision INTO next_revision FROM partner_cost_sharing.ledger_control WHERE id FOR UPDATE;
 SELECT * INTO o FROM partner_cost_sharing.obligations WHERE id=(p_payload->>'obligationId')::uuid FOR UPDATE;
 IF NOT FOUND OR o.partner IS DISTINCT FROM p_payload->>'partner' OR o.status NOT IN ('OPEN','PARTIAL')
 OR o.revision IS DISTINCT FROM (p_payload->>'expectedRevision')::bigint OR o.snapshot_hash IS DISTINCT FROM p_payload->>'snapshotHash'
 OR o.settlement_revision IS DISTINCT FROM coalesce((p_payload->>'expectedSettlementRevision')::bigint,0) OR received IS NULL THEN RAISE EXCEPTION 'Immutable eligible obligation/receipt differs';END IF;
 SELECT * INTO d FROM partner_cost_sharing.dispatches WHERE obligation_id=o.id AND state IN ('DISPATCHING','NEEDS_REVIEW') FOR UPDATE;
 IF method_name='stripe_webhook' THEN
 IF d.id IS NULL OR d.provider_payment_id IS DISTINCT FROM p_payload->>'providerPaymentId' OR d.partner IS DISTINCT FROM o.partner OR d.revision IS DISTINCT FROM o.revision OR d.settlement_revision IS DISTINCT FROM o.settlement_revision OR d.snapshot_hash IS DISTINCT FROM o.snapshot_hash OR d.amount_cents IS DISTINCT FROM a THEN RAISE EXCEPTION 'Canonical provider receipt requires matching unresolved durable dispatch';END IF;
 ELSIF d.id IS NOT NULL THEN RAISE EXCEPTION 'Unresolved provider attempt holds competing receipt settlement';END IF;
 hist=p_payload->'historicalAssignment';
 IF received<o.created_at THEN
 SELECT * INTO period_row FROM partner_cost_sharing.periods WHERE id=o.period_id;
 IF method_name<>'authorized_admin' OR hist IS NULL OR hist->>'certificationEvidenceSha256' IS DISTINCT FROM period_row.certification_evidence_sha256 OR length(coalesce(hist->>'reason','')) NOT BETWEEN 1 AND 1000 THEN RAISE EXCEPTION 'Certified historical assignment required';END IF;
 END IF;
 applied=least(a,o.amount_cents+o.adjustment_applied_cents-o.credit_applied_cents-o.applied_cents);excess=a-applied;
 IF excess>0 AND (method_name<>'authorized_admin' OR p_payload->'excessTreatment'->>'action' IS DISTINCT FROM 'certified_credit' OR length(coalesce(p_payload->'excessTreatment'->>'reason','')) NOT BETWEEN 1 AND 1000 OR coalesce(p_payload->'excessTreatment'->>'evidenceSha256','')!~'^[0-9a-f]{64}$') THEN RAISE EXCEPTION 'Excess needs separately certified credit treatment';END IF;
 INSERT INTO partner_cost_sharing.payments(partner,obligation_id,amount_cents,amount_applied_cents,fingerprint,message_fingerprint,method,evidence_sha256,received_at,historical_assignment,excess_credit_cents)
 VALUES(o.partner,o.id,a,applied,p_payload->>'fingerprint',nullif(p_payload->>'messageFingerprint',''),method_name,p_payload->>'evidenceSha256',received,hist,excess) RETURNING * INTO receipt;
 IF excess>0 THEN
 INSERT INTO partner_cost_sharing.adjustments(partner,amount_cents,evidence_sha256,reason,posted_by) VALUES(o.partner,-excess,p_payload->'excessTreatment'->>'evidenceSha256',p_payload->'excessTreatment'->>'reason',k);
 UPDATE partner_cost_sharing.ledger_control SET revision=revision+1 WHERE id;
 END IF;
 UPDATE partner_cost_sharing.ledger_control SET revision=revision+1 WHERE id RETURNING revision INTO next_revision;
 UPDATE partner_cost_sharing.obligations SET applied_cents=applied_cents+applied,settlement_revision=next_revision,status=CASE WHEN applied_cents+applied=amount_cents+adjustment_applied_cents-credit_applied_cents THEN 'PAID' ELSE 'PARTIAL' END WHERE id=o.id RETURNING * INTO o;
 IF d.id IS NOT NULL THEN UPDATE partner_cost_sharing.dispatches SET state='SUCCEEDED' WHERE id=d.id;END IF;
 UPDATE partner_cost_sharing.claims SET state='RECONCILED' WHERE id=(SELECT id FROM partner_cost_sharing.claims WHERE obligation_id=o.id AND state='PENDING_VERIFICATION' AND amount_cents=a ORDER BY reported_at,id LIMIT 1);
 RETURN partner_cost_sharing.finish_request(k,p_request,'verify-and-complete',jsonb_build_object('payment',to_jsonb(receipt),'obligation',to_jsonb(o),'remainingCents',o.amount_cents+o.adjustment_applied_cents-o.credit_applied_cents-o.applied_cents,'receiptState','READY','statementState','POSTED'));END;$$;

CREATE FUNCTION partner_cost_sharing.record_adjustment(p_actor uuid,p_wp_user_id bigint,p_request text,p_payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,partner_cost_sharing AS $$
DECLARE k text;old jsonb;rev bigint;r partner_cost_sharing.adjustments;
BEGIN
 k=partner_cost_sharing.require_member(p_actor,p_wp_user_id,true);old=partner_cost_sharing.begin_request(k,p_request,'adjustment',p_payload);IF old IS NOT NULL THEN RETURN old;END IF;
 SELECT revision INTO rev FROM partner_cost_sharing.ledger_control WHERE id FOR UPDATE;
 IF rev IS DISTINCT FROM (p_payload->>'expectedRevision')::bigint OR length(coalesce(p_payload->>'reason','')) NOT BETWEEN 1 AND 1000 THEN RAISE EXCEPTION 'Adjustment revision/rationale invalid';END IF;
 INSERT INTO partner_cost_sharing.adjustments(partner,amount_cents,evidence_sha256,reason,posted_by) VALUES(p_payload->>'partner',(p_payload->>'amountCents')::bigint,p_payload->>'evidenceSha256',p_payload->>'reason',k) RETURNING * INTO r;
 UPDATE partner_cost_sharing.ledger_control SET revision=revision+1 WHERE id;
 RETURN partner_cost_sharing.finish_request(k,p_request,'adjustment',jsonb_build_object('adjustment',to_jsonb(r),'revision',rev+1));END;$$;

CREATE FUNCTION partner_cost_sharing.partner_method(p_actor uuid,p_wp_user_id bigint,p_request text,p_payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,partner_cost_sharing AS $$
DECLARE k text;old jsonb;r partner_cost_sharing.methods;
BEGIN
 k=partner_cost_sharing.require_member(p_actor,p_wp_user_id);old=partner_cost_sharing.begin_request(k,p_request,'method',p_payload);IF old IS NOT NULL THEN RETURN old;END IF;
 IF p_payload->>'action'='remove' THEN
  UPDATE partner_cost_sharing.methods SET state='REMOVED' WHERE partner=k AND state='ACTIVE';
  UPDATE partner_cost_sharing.consents SET revoked_at=clock_timestamp() WHERE partner=k AND revoked_at IS NULL;
  RETURN partner_cost_sharing.finish_request(k,p_request,'method',jsonb_build_object('removed',true,'autoCollectionConsent',false));
 END IF;
 IF p_payload->>'domain' IS DISTINCT FROM 'partner_cost_sharing' OR p_payload->>'partner' IS DISTINCT FROM k OR (p_payload->>'providerVerified')::boolean IS DISTINCT FROM true OR p_payload->>'reference'!~'^pm_[A-Za-z0-9]+$' OR p_payload->>'customerReference'!~'^cus_[A-Za-z0-9]+$' THEN RAISE EXCEPTION 'Own provider-bound partner method required';END IF;
 UPDATE partner_cost_sharing.methods SET state='REPLACED' WHERE partner=k AND state='ACTIVE';
 UPDATE partner_cost_sharing.consents SET revoked_at=clock_timestamp() WHERE partner=k AND revoked_at IS NULL;
 INSERT INTO partner_cost_sharing.methods(partner,provider_reference,customer_reference,brand,last4,state)
 VALUES(k,p_payload->>'reference',p_payload->>'customerReference',coalesce(p_payload->>'brand','card'),p_payload->>'last4','ACTIVE') RETURNING * INTO r;
 RETURN partner_cost_sharing.finish_request(k,p_request,'method',jsonb_build_object('method',to_jsonb(r)-'provider_reference'-'customer_reference','autoCollectionConsent',false));END;$$;

CREATE FUNCTION partner_cost_sharing.partner_consent(p_actor uuid,p_wp_user_id bigint,p_request text,p_payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,partner_cost_sharing AS $$
DECLARE k text;old jsonb;r partner_cost_sharing.consents;
BEGIN
 k=partner_cost_sharing.require_member(p_actor,p_wp_user_id);old=partner_cost_sharing.begin_request(k,p_request,'consent',p_payload);IF old IS NOT NULL THEN RETURN old;END IF;
 IF p_payload->>'action' NOT IN ('authorize','revoke') OR p_payload->>'action' IS NULL THEN RAISE EXCEPTION 'Consent action invalid';END IF;
 UPDATE partner_cost_sharing.consents SET revoked_at=clock_timestamp() WHERE partner=k AND revoked_at IS NULL;
 IF p_payload->>'action'='revoke' THEN RETURN partner_cost_sharing.finish_request(k,p_request,'consent',jsonb_build_object('autoCollectionConsent',false));END IF;
 IF NOT EXISTS(SELECT 1 FROM partner_cost_sharing.methods WHERE partner=k AND state='ACTIVE')
 OR NOT EXISTS(SELECT 1 FROM partner_cost_sharing.obligations WHERE partner=k AND period_id=(p_payload->>'periodId')::uuid AND status IN ('OPEN','PARTIAL')) THEN RAISE EXCEPTION 'Own active method and certified eligible period required';END IF;
 INSERT INTO partner_cost_sharing.consents(partner,period_id,terms_version,terms_sha256,max_amount_cents)
 VALUES(k,(p_payload->>'periodId')::uuid,p_payload->>'termsVersion',p_payload->>'termsSha256',(p_payload->>'maxAmountCents')::bigint) RETURNING * INTO r;
 RETURN partner_cost_sharing.finish_request(k,p_request,'consent',jsonb_build_object('consent',to_jsonb(r),'collectionEnabled',false));END;$$;

CREATE FUNCTION partner_cost_sharing.partner_view(p_actor uuid,p_wp_user_id bigint) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,partner_cost_sharing AS $$
DECLARE k text;view_data jsonb;balance bigint;certified boolean;
BEGIN
 k=partner_cost_sharing.require_member(p_actor,p_wp_user_id);
 certified=EXISTS(SELECT 1 FROM partner_cost_sharing.periods);
 IF certified THEN
  SELECT coalesce(sum(amount_cents-applied_cents-opening_credit_cents),0) INTO balance FROM partner_cost_sharing.obligations WHERE partner=k;
  SELECT balance+coalesce(sum(amount_cents),0) INTO balance FROM partner_cost_sharing.adjustments WHERE partner=k;
 END IF;
 view_data=jsonb_build_object('partner',jsonb_build_object('key',k,'name',(SELECT name FROM partner_cost_sharing.partners WHERE key=k),'admin',k='brian'),
 'revision',(SELECT revision FROM partner_cost_sharing.ledger_control WHERE id),'certified',certified,'currentBalanceCents',balance,
 'periods',coalesce((SELECT jsonb_agg((to_jsonb(p)-'opening_balances')||jsonb_build_object('openingBalanceCents',p.opening_balances->k)) FROM partner_cost_sharing.periods p),'[]'),
 'obligations',coalesce((SELECT jsonb_agg(to_jsonb(o)||jsonb_build_object('lines',coalesce((SELECT jsonb_agg(jsonb_build_object('expenseId',e.id,'amountCents',l.amount_cents,'vendor',e.vendor,'invoiceNumber',e.invoice_number,'category',e.category,'periodStart',e.period_start,'periodEnd',e.period_end,'evidenceSha256',e.evidence_sha256)) FROM partner_cost_sharing.allocation_lines l JOIN partner_cost_sharing.expenses e ON e.id=l.expense_id WHERE l.obligation_id=o.id),'[]'))) FROM partner_cost_sharing.obligations o WHERE partner=k),'[]'),
 'payments',coalesce((SELECT jsonb_agg(to_jsonb(p)) FROM partner_cost_sharing.payments p WHERE partner=k),'[]'),
 'claims',coalesce((SELECT jsonb_agg(to_jsonb(c)) FROM partner_cost_sharing.claims c WHERE partner=k),'[]'),
 'adjustments',coalesce((SELECT jsonb_agg(to_jsonb(a)) FROM partner_cost_sharing.adjustments a WHERE partner=k),'[]'),
 'applications',coalesce((SELECT jsonb_agg(to_jsonb(a)) FROM partner_cost_sharing.settlement_applications a WHERE partner=k),'[]'),
 'methods',coalesce((SELECT jsonb_agg(to_jsonb(m)-'provider_reference'-'customer_reference') FROM partner_cost_sharing.methods m WHERE partner=k),'[]'),
 'consents',coalesce((SELECT jsonb_agg(to_jsonb(c)) FROM partner_cost_sharing.consents c WHERE partner=k),'[]'));
 IF k='brian' THEN view_data=view_data||jsonb_build_object('admin',jsonb_build_object(
 'expenses',coalesce((SELECT jsonb_agg(to_jsonb(e)) FROM partner_cost_sharing.expenses e),'[]'),
 'obligations',coalesce((SELECT jsonb_agg(to_jsonb(o)) FROM partner_cost_sharing.obligations o),'[]'),
 'periods',coalesce((SELECT jsonb_agg(to_jsonb(p)) FROM partner_cost_sharing.periods p),'[]'),
 'payments',coalesce((SELECT jsonb_agg(to_jsonb(p)) FROM partner_cost_sharing.payments p),'[]'),
 'adjustments',coalesce((SELECT jsonb_agg(to_jsonb(a)) FROM partner_cost_sharing.adjustments a),'[]'),
 'applications',coalesce((SELECT jsonb_agg(to_jsonb(a)) FROM partner_cost_sharing.settlement_applications a),'[]'),
 'claims',coalesce((SELECT jsonb_agg(to_jsonb(a)) FROM partner_cost_sharing.claims a),'[]'),
 'proposals',coalesce((SELECT jsonb_agg(to_jsonb(p)) FROM partner_cost_sharing.proposals p),'[]'),
 'audit',coalesce((SELECT jsonb_agg(to_jsonb(a)) FROM partner_cost_sharing.audit a),'[]')));END IF;
 RETURN view_data;END;$$;


CREATE FUNCTION partner_cost_sharing.apply_settlement(p_actor uuid,p_wp_user_id bigint,p_request text,p_payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,partner_cost_sharing AS $$
DECLARE k text;old jsonb;rev bigint;o partner_cost_sharing.obligations;src_o partner_cost_sharing.obligations;src_a partner_cost_sharing.adjustments;r partner_cost_sharing.settlement_applications;src_kind text;src_id uuid;src_amount bigint;used_amount bigint;src_partner text;proof text;a bigint;
BEGIN
 k=partner_cost_sharing.require_member(p_actor,p_wp_user_id,true);old=partner_cost_sharing.begin_request(k,p_request,'apply-settlement',p_payload);IF old IS NOT NULL THEN RETURN old;END IF;
 SELECT revision INTO rev FROM partner_cost_sharing.ledger_control WHERE id FOR UPDATE;
 IF rev IS DISTINCT FROM (p_payload->>'expectedRevision')::bigint OR length(coalesce(p_payload->>'reason','')) NOT BETWEEN 1 AND 1000 THEN RAISE EXCEPTION 'Settlement revision/rationale invalid';END IF;
 src_kind=p_payload->>'sourceKind';src_id=(p_payload->>'sourceId')::uuid;a=(p_payload->>'amountCents')::bigint;
 IF src_kind IS NULL OR src_kind NOT IN ('opening_credit','adjustment') OR a IS NULL OR a<=0 THEN RAISE EXCEPTION 'Certified settlement source required';END IF;
 IF src_kind='opening_credit' THEN
  SELECT * INTO src_o FROM partner_cost_sharing.obligations WHERE id=src_id AND opening_credit_cents>0 FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Opening credit absent';END IF;
  src_amount=-src_o.opening_credit_cents;src_partner=src_o.partner;
  SELECT certification_evidence_sha256 INTO proof FROM partner_cost_sharing.periods WHERE id=src_o.period_id;
 ELSE
  SELECT * INTO src_a FROM partner_cost_sharing.adjustments WHERE id=src_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Adjustment source absent';END IF;
  src_amount=src_a.amount_cents;src_partner=src_a.partner;proof=src_a.evidence_sha256;
 END IF;
 SELECT * INTO o FROM partner_cost_sharing.obligations WHERE id=(p_payload->>'obligationId')::uuid FOR UPDATE;
 IF NOT FOUND OR o.partner IS DISTINCT FROM src_partner OR o.status='VOID' OR proof IS DISTINCT FROM p_payload->>'evidenceSha256' THEN RAISE EXCEPTION 'Own settlement source/custody differs';END IF;
 IF EXISTS(SELECT 1 FROM partner_cost_sharing.dispatches WHERE obligation_id=o.id AND state IN ('DISPATCHING','NEEDS_REVIEW')) THEN RAISE EXCEPTION 'Unresolved provider attempt holds settlement application';END IF;
 SELECT coalesce(sum(amount_cents),0) INTO used_amount FROM partner_cost_sharing.settlement_applications WHERE source_kind=src_kind AND source_id=src_id;
 IF a>abs(src_amount)-used_amount OR (src_amount<0 AND a>o.amount_cents+o.adjustment_applied_cents-o.credit_applied_cents-o.applied_cents) THEN RAISE EXCEPTION 'Settlement exceeds available source or obligation';END IF;
 UPDATE partner_cost_sharing.obligations SET
 credit_applied_cents=credit_applied_cents+CASE WHEN src_amount<0 THEN a ELSE 0 END,
 adjustment_applied_cents=adjustment_applied_cents+CASE WHEN src_amount>0 THEN a ELSE 0 END,
 settlement_revision=rev+1,
 status=CASE WHEN amount_cents+adjustment_applied_cents-credit_applied_cents-applied_cents+CASE WHEN src_amount>0 THEN a ELSE -a END=0 THEN 'PAID' WHEN applied_cents+credit_applied_cents>0 OR src_amount<0 THEN 'PARTIAL' ELSE 'OPEN' END
 WHERE id=o.id RETURNING * INTO o;
 INSERT INTO partner_cost_sharing.settlement_applications(partner,obligation_id,source_kind,source_id,amount_cents,direction,evidence_sha256,reason,revision)
 VALUES(o.partner,o.id,src_kind,src_id,a,CASE WHEN src_amount<0 THEN 'CREDIT' ELSE 'DEBIT' END,proof,p_payload->>'reason',rev+1) RETURNING * INTO r;
 UPDATE partner_cost_sharing.ledger_control SET revision=revision+1 WHERE id;
 RETURN partner_cost_sharing.finish_request(k,p_request,'apply-settlement',jsonb_build_object('application',to_jsonb(r),'obligation',to_jsonb(o),'remainingCents',o.amount_cents+o.adjustment_applied_cents-o.credit_applied_cents-o.applied_cents,'revision',rev+1));
END;$$;


CREATE FUNCTION partner_cost_sharing.stage_proposal(p_actor uuid,p_wp_user_id bigint,p_request text,p_payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,partner_cost_sharing AS $$
DECLARE k text;old jsonb;r partner_cost_sharing.proposals;
BEGIN
 k=partner_cost_sharing.require_member(p_actor,p_wp_user_id,true);old=partner_cost_sharing.begin_request(k,p_request,'stage-proposal',p_payload);IF old IS NOT NULL THEN RETURN old;END IF;
 IF p_payload->>'kind' IS NULL OR p_payload->>'kind' NOT IN ('ai_expense','receipt_review','anomaly','collection_shadow') OR jsonb_typeof(p_payload->'fields') IS DISTINCT FROM 'object'
 OR octet_length(p_payload::text)>20000 OR length(coalesce(p_payload->>'summary','')) NOT BETWEEN 1 AND 1000 OR length(coalesce(p_payload->>'sourceId','')) NOT BETWEEN 1 AND 160
 OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_payload) x WHERE x NOT IN ('kind','sourceSha256','sourceId','summary','fields','insights'))
 OR jsonb_typeof(p_payload->'insights') IS DISTINCT FROM 'array' OR jsonb_array_length(p_payload->'insights')>8 THEN RAISE EXCEPTION 'Bounded review-only proposal required';END IF;
 SELECT * INTO r FROM partner_cost_sharing.proposals WHERE source_sha256=p_payload->>'sourceSha256' AND source_id=p_payload->>'sourceId';
 IF FOUND THEN
 IF r.proposal IS DISTINCT FROM p_payload THEN RAISE EXCEPTION 'Conflicting proposal interpretation';END IF;
 ELSE INSERT INTO partner_cost_sharing.proposals(source_sha256,source_id,proposal) VALUES(p_payload->>'sourceSha256',p_payload->>'sourceId',p_payload) RETURNING * INTO r;
 END IF;
 RETURN partner_cost_sharing.finish_request(k,p_request,'stage-proposal',jsonb_build_object('proposal',to_jsonb(r),'posted',false,'moneyMoved',false));
END;$$;
CREATE FUNCTION partner_cost_sharing.asset_metadata(p_actor uuid,p_wp_user_id bigint,p_expense_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,partner_cost_sharing AS $$
DECLARE k text;r jsonb;
BEGIN
 k=partner_cost_sharing.require_member(p_actor,p_wp_user_id);
 SELECT to_jsonb(a) INTO r FROM partner_cost_sharing.evidence_assets a JOIN partner_cost_sharing.expenses e ON e.asset_id=a.asset_id AND e.evidence_sha256=a.original_sha256
 WHERE e.id=p_expense_id AND (k='brian' OR EXISTS(SELECT 1 FROM partner_cost_sharing.allocation_lines l JOIN partner_cost_sharing.obligations o ON o.id=l.obligation_id WHERE l.expense_id=e.id AND o.partner=k));
 IF r IS NULL THEN RAISE EXCEPTION 'Own allocated private original is unavailable';END IF;
 RETURN r;
END;$$;
CREATE FUNCTION partner_cost_sharing.reserve_dispatch(p_actor uuid,p_wp_user_id bigint,p_request text,p_payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,partner_cost_sharing AS $$
DECLARE k text;old jsonb;p jsonb;g jsonb;o partner_cost_sharing.obligations;m partner_cost_sharing.methods;c partner_cost_sharing.consents;d partner_cost_sharing.dispatches;mode_name text;field text;h text;a bigint;
BEGIN
 k=partner_cost_sharing.require_member(p_actor,p_wp_user_id,true);old=partner_cost_sharing.begin_request(k,p_request,'reserve-dispatch',p_payload);
 SELECT mode INTO mode_name FROM partner_cost_sharing.collection_control WHERE id FOR UPDATE;
 IF mode_name NOT IN ('test','live') THEN RAISE EXCEPTION 'Partner collection remains disabled';END IF;
 p=p_payload->'proposal';g=p_payload->'moneyAuthorization';
 IF g IS NULL OR g->>'expiresAt' IS NULL OR (g->>'expiresAt')::timestamptz<=clock_timestamp() OR coalesce(g->>'authoritySha256','')!~'^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'Exact acceptance authority absent';END IF;
 FOREACH field IN ARRAY ARRAY['partner','obligationId','periodId','revision','settlementRevision','snapshotHash','amountCents','currency','consentId','methodReference','customerReference','idempotencyKey'] LOOP
 IF p->field IS NULL OR p->field IS DISTINCT FROM g->field THEN RAISE EXCEPTION 'Acceptance contract differs';END IF;END LOOP;
 SELECT key INTO field FROM partner_cost_sharing.partners WHERE key=p->>'partner' AND active FOR UPDATE;
 IF field IS NULL THEN RAISE EXCEPTION 'Explicit partner inactive';END IF;
 SELECT * INTO o FROM partner_cost_sharing.obligations WHERE id=(p->>'obligationId')::uuid AND partner=p->>'partner' FOR UPDATE;
 IF NOT FOUND OR o.status NOT IN ('OPEN','PARTIAL') OR o.period_id IS DISTINCT FROM (p->>'periodId')::uuid OR o.revision IS DISTINCT FROM (p->>'revision')::bigint OR o.settlement_revision IS DISTINCT FROM (p->>'settlementRevision')::bigint OR o.snapshot_hash IS DISTINCT FROM p->>'snapshotHash' THEN RAISE EXCEPTION 'Obligation contract changed';END IF;
 a=o.amount_cents+o.adjustment_applied_cents-o.credit_applied_cents-o.applied_cents;
 IF a IS DISTINCT FROM (p->>'amountCents')::bigint OR p->>'currency' IS DISTINCT FROM 'USD' OR p->>'domain' IS DISTINCT FROM 'partner_cost_sharing'
 OR p->>'idempotencyKey' IS DISTINCT FROM 'partner-cost-sharing:collect:'||o.id::text||':r'||o.revision::text||':s'||o.settlement_revision::text THEN RAISE EXCEPTION 'Collection amount/key differs';END IF;
 SELECT * INTO m FROM partner_cost_sharing.methods WHERE partner=o.partner AND state='ACTIVE' AND provider_reference=p->>'methodReference' AND customer_reference=p->>'customerReference' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Current own method changed';END IF;
 SELECT * INTO c FROM partner_cost_sharing.consents WHERE id=(p->>'consentId')::uuid AND partner=o.partner AND period_id=o.period_id AND revoked_at IS NULL AND max_amount_cents>=a FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Current bounded consent absent';END IF;
 IF EXISTS(SELECT 1 FROM partner_cost_sharing.adjustments x WHERE x.partner=o.partner AND abs(x.amount_cents)<>(SELECT coalesce(sum(z.amount_cents),0) FROM partner_cost_sharing.settlement_applications z WHERE z.source_kind='adjustment' AND z.source_id=x.id))
 OR EXISTS(SELECT 1 FROM partner_cost_sharing.obligations x WHERE x.partner=o.partner AND x.opening_credit_cents>(SELECT coalesce(sum(z.amount_cents),0) FROM partner_cost_sharing.settlement_applications z WHERE z.source_kind='opening_credit' AND z.source_id=x.id)) THEN RAISE EXCEPTION 'Credit/debit allocation pending';END IF;
 IF EXISTS(SELECT 1 FROM partner_cost_sharing.dispatches WHERE obligation_id=o.id AND state IN ('DISPATCHING','NEEDS_REVIEW') AND (revision<>o.revision OR settlement_revision<>o.settlement_revision)) THEN RAISE EXCEPTION 'Prior provider attempt unresolved';END IF;
 h=encode(sha256(convert_to(p::text,'UTF8')),'hex');
 SELECT * INTO d FROM partner_cost_sharing.dispatches WHERE obligation_id=o.id AND revision=o.revision AND settlement_revision=o.settlement_revision;
 IF FOUND THEN IF d.payload_hash IS DISTINCT FROM h THEN RAISE EXCEPTION 'Existing dispatch contract differs';END IF;
 ELSE INSERT INTO partner_cost_sharing.dispatches(partner,obligation_id,revision,settlement_revision,snapshot_hash,consent_id,method_id,amount_cents,payload_hash,authority_sha256,idempotency_key)
 VALUES(o.partner,o.id,o.revision,o.settlement_revision,o.snapshot_hash,c.id,m.id,a,h,g->>'authoritySha256',p->>'idempotencyKey') RETURNING * INTO d;
 END IF;
 RETURN partner_cost_sharing.finish_request(k,p_request,'reserve-dispatch',p||jsonb_build_object('dispatchId',d.id,'state',d.state,'moneyMoved',false));
END;$$;


CREATE FUNCTION partner_cost_sharing.collection_proposal(p_actor uuid,p_wp_user_id bigint,p_partner text,p_obligation_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,partner_cost_sharing AS $$
DECLARE k text;o partner_cost_sharing.obligations;m partner_cost_sharing.methods;c partner_cost_sharing.consents;a bigint;
BEGIN
 k=partner_cost_sharing.require_member(p_actor,p_wp_user_id,true);
 SELECT * INTO o FROM partner_cost_sharing.obligations WHERE id=p_obligation_id AND partner=p_partner AND status IN ('OPEN','PARTIAL');
 IF NOT FOUND THEN RAISE EXCEPTION 'Eligible partner obligation required';END IF;
 SELECT * INTO m FROM partner_cost_sharing.methods WHERE partner=p_partner AND state='ACTIVE';
 IF NOT FOUND THEN RAISE EXCEPTION 'Own active method absent';END IF;
 a=o.amount_cents+o.adjustment_applied_cents-o.credit_applied_cents-o.applied_cents;
 SELECT * INTO c FROM partner_cost_sharing.consents WHERE partner=p_partner AND period_id=o.period_id AND revoked_at IS NULL AND max_amount_cents>=a;
 IF NOT FOUND THEN RAISE EXCEPTION 'Current bounded consent absent';END IF;
 IF EXISTS(SELECT 1 FROM partner_cost_sharing.adjustments x WHERE x.partner=o.partner AND abs(x.amount_cents)<>(SELECT coalesce(sum(z.amount_cents),0) FROM partner_cost_sharing.settlement_applications z WHERE z.source_kind='adjustment' AND z.source_id=x.id))
 OR EXISTS(SELECT 1 FROM partner_cost_sharing.obligations x WHERE x.partner=o.partner AND x.opening_credit_cents>(SELECT coalesce(sum(z.amount_cents),0) FROM partner_cost_sharing.settlement_applications z WHERE z.source_kind='opening_credit' AND z.source_id=x.id)) THEN RAISE EXCEPTION 'Credit/debit allocation pending';END IF;
 RETURN jsonb_build_object('domain','partner_cost_sharing','partner',o.partner,'obligationId',o.id,'periodId',o.period_id,'revision',o.revision,'settlementRevision',o.settlement_revision,'snapshotHash',o.snapshot_hash,'amountCents',a,'currency','USD',
 'methodReference',m.provider_reference,'customerReference',m.customer_reference,'consentId',c.id,'idempotencyKey','partner-cost-sharing:collect:'||o.id::text||':r'||o.revision::text||':s'||o.settlement_revision::text,'shadow',true,'moneyMoved',false);
END;$$;
CREATE FUNCTION partner_cost_sharing.record_dispatch(p_actor uuid,p_wp_user_id bigint,p_request text,p_payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,partner_cost_sharing AS $$
DECLARE k text;old jsonb;d partner_cost_sharing.dispatches;pid text;
BEGIN
 k=partner_cost_sharing.require_member(p_actor,p_wp_user_id,true);old=partner_cost_sharing.begin_request(k,p_request,'record-dispatch',p_payload);IF old IS NOT NULL THEN RETURN old;END IF;
 pid=p_payload->>'providerPaymentId';
 IF pid IS NULL OR pid!~'^pi_[A-Za-z0-9]+$' OR p_payload->>'state' IS NULL OR p_payload->>'state' NOT IN ('DISPATCHING','NEEDS_REVIEW') THEN RAISE EXCEPTION 'Bounded provider result required';END IF;
 SELECT * INTO d FROM partner_cost_sharing.dispatches WHERE id=(p_payload->>'dispatchId')::uuid FOR UPDATE;
 IF NOT FOUND OR d.state<>'DISPATCHING' OR (d.provider_payment_id IS NOT NULL AND d.provider_payment_id<>pid) THEN RAISE EXCEPTION 'Dispatch binding differs';END IF;
 UPDATE partner_cost_sharing.dispatches SET provider_payment_id=pid,state=p_payload->>'state' WHERE id=d.id RETURNING * INTO d;
 RETURN partner_cost_sharing.finish_request(k,p_request,'record-dispatch',jsonb_build_object('dispatchId',d.id,'providerPaymentId',pid,'state',d.state));
END;$$;
CREATE FUNCTION partner_cost_sharing.dispatch_for_provider(p_actor uuid,p_wp_user_id bigint,p_provider_payment_id text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,partner_cost_sharing AS $$
DECLARE k text;r jsonb;
BEGIN
 k=partner_cost_sharing.require_member(p_actor,p_wp_user_id,true);
 SELECT (to_jsonb(d)-'payload_hash'-'authority_sha256')||jsonb_build_object('methodReference',m.provider_reference,'customerReference',m.customer_reference)
 INTO r FROM partner_cost_sharing.dispatches d JOIN partner_cost_sharing.methods m ON m.id=d.method_id
 WHERE d.provider_payment_id=p_provider_payment_id;
 IF r IS NULL THEN RAISE EXCEPTION 'Durable authorized dispatch absent';END IF;
 RETURN r;
END;$$;


CREATE FUNCTION partner_cost_sharing.resolve_dispatch(p_actor uuid,p_wp_user_id bigint,p_request text,p_payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,partner_cost_sharing AS $$
DECLARE k text;old jsonb;d partner_cost_sharing.dispatches;rev bigint;
BEGIN
 k=partner_cost_sharing.require_member(p_actor,p_wp_user_id,true);old=partner_cost_sharing.begin_request(k,p_request,'resolve-dispatch',p_payload);IF old IS NOT NULL THEN RETURN old;END IF;
 IF (p_payload->>'signatureVerified')::boolean IS DISTINCT FROM true OR coalesce(p_payload->>'evidenceSha256','')!~'^[0-9a-f]{64}$' OR p_payload->>'providerStatus' IS NULL OR p_payload->>'providerStatus'<>'canceled' THEN RAISE EXCEPTION 'Verified terminal provider outcome required';END IF;
 SELECT revision INTO rev FROM partner_cost_sharing.ledger_control WHERE id FOR UPDATE;
 PERFORM 1 FROM partner_cost_sharing.obligations WHERE id=(SELECT obligation_id FROM partner_cost_sharing.dispatches WHERE provider_payment_id=p_payload->>'providerPaymentId') FOR UPDATE;
 SELECT * INTO d FROM partner_cost_sharing.dispatches WHERE provider_payment_id=p_payload->>'providerPaymentId' FOR UPDATE;
 IF NOT FOUND OR d.state NOT IN ('DISPATCHING','NEEDS_REVIEW') THEN RAISE EXCEPTION 'Unresolved durable provider attempt required';END IF;
 UPDATE partner_cost_sharing.dispatches SET state='CANCELLED' WHERE id=d.id RETURNING * INTO d;
 UPDATE partner_cost_sharing.ledger_control SET revision=revision+1 WHERE id RETURNING revision INTO rev;
 UPDATE partner_cost_sharing.obligations SET settlement_revision=rev WHERE id=d.obligation_id;
 RETURN partner_cost_sharing.finish_request(k,p_request,'resolve-dispatch',jsonb_build_object('dispatchId',d.id,'state',d.state,'moneyMoved',false,'settlementRevision',rev));
END;$$;

CREATE FUNCTION partner_cost_sharing.register_asset(p_actor uuid,p_wp_user_id bigint,p_request text,p_payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,partner_cost_sharing AS $$
DECLARE k text;old jsonb;a partner_cost_sharing.evidence_assets;
BEGIN
 k=partner_cost_sharing.require_member(p_actor,p_wp_user_id,true);old=partner_cost_sharing.begin_request(k,p_request,'register-asset',p_payload);IF old IS NOT NULL THEN RETURN old;END IF;
 SELECT * INTO a FROM partner_cost_sharing.evidence_assets WHERE asset_id=p_payload->>'assetId';
 IF FOUND THEN IF a.original_sha256 IS DISTINCT FROM p_payload->>'originalSha256' OR a.object_key IS DISTINCT FROM p_payload->>'objectKey' OR a.byte_length IS DISTINCT FROM (p_payload->>'byteLength')::bigint THEN RAISE EXCEPTION 'Private custody conflict';END IF;
 ELSE INSERT INTO partner_cost_sharing.evidence_assets(asset_id,object_key,original_sha256,content_type,byte_length)
 VALUES(p_payload->>'assetId',p_payload->>'objectKey',p_payload->>'originalSha256',p_payload->>'contentType',(p_payload->>'byteLength')::bigint) RETURNING * INTO a;
 END IF;
 RETURN partner_cost_sharing.finish_request(k,p_request,'register-asset',jsonb_build_object('assetId',a.asset_id,'sha256',a.original_sha256,'byteLength',a.byte_length));
END;$$;

DO $$
DECLARE tbl text;fn record;
BEGIN
 FOR tbl IN SELECT tablename FROM pg_tables WHERE schemaname='partner_cost_sharing' LOOP
  EXECUTE format('ALTER TABLE partner_cost_sharing.%I ENABLE ROW LEVEL SECURITY',tbl);
  EXECUTE format('ALTER TABLE partner_cost_sharing.%I FORCE ROW LEVEL SECURITY',tbl);
  EXECUTE format('REVOKE ALL ON partner_cost_sharing.%I FROM PUBLIC,anon,authenticated,service_role',tbl);
 END LOOP;
 FOR fn IN SELECT oid::regprocedure AS signature FROM pg_proc WHERE pronamespace='partner_cost_sharing'::regnamespace LOOP
  EXECUTE 'REVOKE ALL ON FUNCTION '||fn.signature||' FROM PUBLIC,anon,authenticated,service_role';
 END LOOP;
END;$$;
GRANT USAGE ON SCHEMA partner_cost_sharing TO service_role;
-- Only backend RPCs are callable; direct table access and generic app roles grant nothing.
GRANT EXECUTE ON FUNCTION partner_cost_sharing.member_for_principal(uuid,bigint),
 partner_cost_sharing.partner_view(uuid,bigint),
 partner_cost_sharing.ingest_expense(uuid,bigint,text,jsonb),
 partner_cost_sharing.review_expense(uuid,bigint,text,jsonb),
 partner_cost_sharing.certify_period(uuid,bigint,text,jsonb),
 partner_cost_sharing.report_sent(uuid,bigint,text,jsonb),
 partner_cost_sharing.mark_partner_payment_verified_and_complete(uuid,bigint,text,jsonb),
 partner_cost_sharing.record_adjustment(uuid,bigint,text,jsonb),
 partner_cost_sharing.apply_settlement(uuid,bigint,text,jsonb),
 partner_cost_sharing.stage_proposal(uuid,bigint,text,jsonb),
 partner_cost_sharing.reserve_dispatch(uuid,bigint,text,jsonb),
 partner_cost_sharing.collection_proposal(uuid,bigint,text,uuid),
 partner_cost_sharing.record_dispatch(uuid,bigint,text,jsonb),
 partner_cost_sharing.resolve_dispatch(uuid,bigint,text,jsonb),
 partner_cost_sharing.dispatch_for_provider(uuid,bigint,text),
 partner_cost_sharing.asset_metadata(uuid,bigint,uuid),
 partner_cost_sharing.register_asset(uuid,bigint,text,jsonb),
 partner_cost_sharing.partner_method(uuid,bigint,text,jsonb),
 partner_cost_sharing.partner_consent(uuid,bigint,text,jsonb) TO service_role;
COMMIT;
