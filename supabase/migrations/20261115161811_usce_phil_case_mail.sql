-- Migration: 20261115161811_usce_phil_case_mail.sql
-- Authority: DR-545 and Founder authorization for bounded Phil Gmail case mail
-- Date: 2026-11-15
-- Depends on: 20261115153840_usce_reply_sent_parent.sql
-- Description: Add a consent-fenced, RFC-parent-verified Phil Gmail case-mail sync.
-- Idempotent: YES

BEGIN;

CREATE TABLE IF NOT EXISTS command_center.usce_phil_mailbox_state (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  account text NOT NULL CHECK (account='philaperri@gmail.com'),
  scope text NOT NULL CHECK (scope='https://www.googleapis.com/auth/gmail.readonly'),
  encrypted_grant text NOT NULL CHECK (length(encrypted_grant) BETWEEN 32 AND 4096),
  generation bigint NOT NULL DEFAULT 1 CHECK (generation>0),
  consent_at timestamptz NOT NULL,
  cutoff_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE command_center.usce_phil_mailbox_state ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON command_center.usce_phil_mailbox_state FROM PUBLIC,anon,authenticated,service_role;

CREATE TABLE IF NOT EXISTS command_center.usce_phil_case_mail_cursor (
  case_id uuid PRIMARY KEY REFERENCES command_center.usce_public_intake_requests(id) ON DELETE CASCADE,
  page_token text,
  last_claimed_at timestamptz,
  last_completed_at timestamptz,
  retry_after timestamptz,
  failures smallint NOT NULL DEFAULT 0 CHECK (failures BETWEEN 0 AND 12),
  lease_id uuid,
  lease_generation bigint,
  lease_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((lease_id IS NULL)=(lease_generation IS NULL)),
  CHECK ((lease_id IS NULL)=(lease_until IS NULL))
);
CREATE INDEX IF NOT EXISTS usce_phil_case_mail_due
  ON command_center.usce_phil_case_mail_cursor(retry_after,last_claimed_at,case_id);
ALTER TABLE command_center.usce_phil_case_mail_cursor ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON command_center.usce_phil_case_mail_cursor FROM PUBLIC,anon,authenticated,service_role;

DO $guard$
BEGIN
  IF md5(pg_get_functiondef('command_center.usce_mail_relevance(command_center.usce_comms)'::regprocedure))
       NOT IN ('071a582ad16ea03bc051d0c9a5f05eee','21a45e0bd1654c8a729177cb7c29f48e') THEN
    RAISE EXCEPTION 'USCE mail relevance changed; review Phil-only extension';
  END IF;
END
$guard$;

CREATE OR REPLACE FUNCTION command_center.usce_mail_relevance(c command_center.usce_comms)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE sender text:=lower(coalesce(c.from_email,'')); subject text:=lower(coalesce(c.subject,''));
 content text:=lower(coalesce(c.subject,'')||' '||left(coalesce(c.body_text,''),4000));
 recipient text:=lower(coalesce(c.to_email,'')); machine boolean; verified boolean;
BEGIN
 IF c.raw_json->>'source'='usce_phil_case_mail' AND c.direction='OUT'
    AND c.mailbox='philaperri@gmail.com' AND sender='philaperri@gmail.com'
    AND c.association_method='verified_reference' AND NOT c.needs_triage
    AND NOT c.is_internal_note AND coalesce(c.raw_json->>'worker_sent_verified','false')='true'
    AND coalesce(c.raw_json->>'authenticated','false')='true'
    AND EXISTS(SELECT 1 FROM command_center.usce_public_intake_requests r
      WHERE r.id=c.intake_request_id AND lower(btrim(r.email))=recipient)
 THEN RETURN 'student'; END IF;
 machine:=coalesce(c.raw_json->>'automatic','false')='true'
  OR coalesce(c.raw_json->>'automation_reason','')<>''
  OR (subject ~ 'report domain:.*submitter:.*report.?id:' AND
      (sender ~ '(^|[._-])(dmarc|postmaster|noreply|no-reply|mailer-daemon)[._@-]' OR CASE WHEN jsonb_typeof(c.raw_json->'attachment_count')='number' THEN (c.raw_json->>'attachment_count')::numeric>0 ELSE false END))
  OR (sender ~ '^(mailer-daemon|postmaster|noreply|no-reply|notifications?|alerts?)@' AND
      content ~ '(delivery status|delivery failure|undeliverable|security alert|verify your|verification code|newsletter|unsubscribe|password reset|dmarc|aggregate report)');
 IF c.direction='IN' AND machine THEN RETURN 'diagnostic'; END IF;
 verified:=c.intake_request_id IS NOT NULL AND (
  (c.direction<>'IN' AND (c.is_internal_note OR sender='clinicals@missionmedinstitute.com' OR c.direction='SYS'))
  OR (c.direction='IN' AND EXISTS(SELECT 1 FROM command_center.usce_public_intake_requests r
      WHERE r.id=c.intake_request_id AND lower(r.email)=sender)
      AND (c.association_method IN ('verified_reference','admin_review') OR
           (c.association_method IS NULL AND coalesce(c.raw_json->>'source','')<>'usce_v3_gmail'))
      AND (coalesce(c.raw_json->>'sender_authentication','legacy') IN ('passed','legacy') OR (c.association_method='admin_review' AND coalesce(c.raw_json->>'sender_authentication','legacy')<>'failed'))));
 IF verified THEN RETURN 'student'; END IF;
 IF c.direction='IN' AND NOT machine AND c.association_method='unverified_reference' AND c.needs_triage AND coalesce(c.raw_json->>'sender_authentication','unknown')='unknown' THEN RETURN 'review'; END IF;
 IF c.direction='IN' AND NOT machine AND recipient='clinicals@missionmedinstitute.com'
  AND sender ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
  AND coalesce(c.raw_json->>'sender_authentication','legacy')<>'failed'
  AND content ~ '(clinical rotation|observership|externship|usce|clinical elective)'
  AND content ~ '(i am|i.m |i would|i want|interested|applying|apply for|request|availability|my rotation|my application)'
 THEN RETURN 'review'; END IF;
 RETURN 'diagnostic';
END $$;
REVOKE ALL ON FUNCTION command_center.usce_mail_relevance(command_center.usce_comms) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION command_center.usce_mail_relevance(command_center.usce_comms) TO service_role;

CREATE OR REPLACE FUNCTION command_center.usce_phil_case_mail_parent_verified(c command_center.usce_comms,p_case uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT c.intake_request_id=p_case AND NOT c.needs_triage AND NOT c.is_internal_note
   AND c.direction IN ('IN','OUT') AND command_center.usce_mail_relevance(c)='student'
   AND (SELECT count(*) FROM command_center.usce_comms x WHERE x.rfc_message_id=c.rfc_message_id)=1
   AND EXISTS(SELECT 1 FROM command_center.usce_public_intake_requests r
     WHERE r.id=p_case AND lower(btrim(r.email))=CASE WHEN c.direction='IN' THEN lower(c.from_email) ELSE lower(c.to_email) END)
   AND CASE
     WHEN c.direction='IN' THEN c.association_method IN ('verified_reference','admin_review')
     WHEN c.raw_json->>'source'='usce_phil_case_mail' THEN c.mailbox='philaperri@gmail.com'
       AND lower(c.from_email)='philaperri@gmail.com' AND c.mail_state='sent'
       AND c.raw_json->>'authenticated'='true' AND c.raw_json->>'worker_sent_verified'='true'
     WHEN c.association_method='admin_review' THEN c.association_reviewed_at IS NOT NULL AND c.mail_state='sent'
     ELSE c.mailbox='clinicals@missionmedinstitute.com' AND c.from_email='clinicals@missionmedinstitute.com'
       AND c.mail_state='sent' AND c.message_status='sent' AND c.postmark_message_id IS NOT NULL
       AND EXISTS(SELECT 1 FROM command_center.usce_outbox o WHERE o.entity_type='usce_comms'
         AND o.entity_id=c.id AND o.action='usce_v3_correspondence'
         AND o.dispatch_state='provider_accepted' AND o.provider_message_id=c.postmark_message_id)
   END
$$;
REVOKE ALL ON FUNCTION command_center.usce_phil_case_mail_parent_verified(command_center.usce_comms,uuid)
  FROM PUBLIC,anon,authenticated,service_role;

DO $ingest_guard$
BEGIN
  IF md5(pg_get_functiondef('public.usce_mail_ingest(uuid,bigint,jsonb,text)'::regprocedure))='97e18d81ef20aff3f003aacc1167ec40'
     AND to_regprocedure('public.usce_mail_ingest_pre_phil(uuid,bigint,jsonb,text)') IS NULL THEN
    ALTER FUNCTION public.usce_mail_ingest(uuid,bigint,jsonb,text) RENAME TO usce_mail_ingest_pre_phil;
  ELSIF md5(pg_get_functiondef('public.usce_mail_ingest(uuid,bigint,jsonb,text)'::regprocedure))='7e47839c460956c1185e82d66dee8341'
     AND to_regprocedure('public.usce_mail_ingest_pre_phil(uuid,bigint,jsonb,text)') IS NOT NULL THEN
    NULL;
  ELSE
    RAISE EXCEPTION 'USCE Clinicals ingest changed; review cross-mailbox identity guard';
  END IF;
END
$ingest_guard$;
REVOKE ALL ON FUNCTION public.usce_mail_ingest_pre_phil(uuid,bigint,jsonb,text) FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.usce_mail_ingest(p_worker_id uuid,p_generation bigint,p_message jsonb,p_phase text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  s command_center.usce_mail_sync_state%ROWTYPE;
  source_rfc text:=btrim(coalesce(p_message->>'rfc_message_id',''));
  source_from text:=lower(btrim(coalesce(p_message->>'from_email','')));
  source_to text:=lower(btrim(coalesce(p_message->>'to_email','')));
  seen_count integer; verified_count integer; seen_id uuid;
BEGIN
  SELECT * INTO s FROM command_center.usce_mail_sync_state
    WHERE mailbox='clinicals@missionmedinstitute.com' FOR UPDATE;
  IF p_worker_id IS NULL OR s.worker_id IS DISTINCT FROM p_worker_id
     OR s.generation IS DISTINCT FROM p_generation OR s.lease_until IS NULL OR s.lease_until<=now()
     OR p_phase NOT IN ('backfill','history')
     OR coalesce(p_message->>'gmail_message_id','') !~ '^[a-fA-F0-9]{1,40}$' THEN
    RETURN jsonb_build_object('ok',false,'error','sync_fence_lost');
  END IF;
  IF source_rfc ~ '^<[^<>[:space:]]{1,250}>$' THEN
    PERFORM pg_advisory_xact_lock(hashtextextended('usce-phil-case-mail:control',0));
    SELECT count(*),count(*) FILTER(WHERE lower(c.from_email)=source_from AND lower(c.to_email)=source_to
        AND command_center.usce_phil_case_mail_parent_verified(c,c.intake_request_id)),
      (min(c.id::text) FILTER(WHERE lower(c.from_email)=source_from AND lower(c.to_email)=source_to
        AND command_center.usce_phil_case_mail_parent_verified(c,c.intake_request_id)))::uuid
      INTO seen_count,verified_count,seen_id
    FROM command_center.usce_comms c
    WHERE c.mailbox='philaperri@gmail.com' AND c.rfc_message_id=source_rfc
      AND c.raw_json->>'source'='usce_phil_case_mail';
    IF seen_count>0 THEN
      UPDATE command_center.usce_mail_sync_state SET lease_until=now()+interval '120 seconds'
        WHERE mailbox=s.mailbox;
      RETURN jsonb_build_object('ok',true,'inserted',false,'skipped',seen_count<>1 OR verified_count<>1 OR seen_id IS NULL,
        'duplicate',seen_count=1 AND verified_count=1 AND seen_id IS NOT NULL,'notification_enqueued',false);
    END IF;
  END IF;
  RETURN public.usce_mail_ingest_pre_phil(p_worker_id,p_generation,p_message,p_phase);
END $$;
REVOKE ALL ON FUNCTION public.usce_mail_ingest(uuid,bigint,jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.usce_mail_ingest(uuid,bigint,jsonb,text) TO service_role;

CREATE OR REPLACE FUNCTION public.usce_phil_case_mail(p_action text,p_data jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  st command_center.usce_phil_mailbox_state%ROWTYPE;
  cur command_center.usce_phil_case_mail_cursor%ROWTYPE;
  req command_center.usce_public_intake_requests%ROWTYPE;
  parent_row command_center.usce_comms%ROWTYPE;
  prior command_center.usce_comms%ROWTYPE;
  v_case uuid; v_lease uuid; v_generation bigint; v_refs text[]; v_ref text;
  v_from text; v_to text; v_dir text; v_received timestamptz; v_rfc text;
  v_parent_count integer; v_parent_ids uuid[]; v_other_case boolean; v_found integer;
  v_anchors jsonb; v_case_ref text; v_connected timestamptz;
  v_ok boolean:=false; v_inserted boolean:=false; v_count integer;
  v_gmail text; v_thread text; v_subject text; v_body text; v_auth boolean;
BEGIN
  IF coalesce(nullif(current_setting('request.jwt.claim.role',true),''),
      nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'role','')<>'service_role' THEN
    RETURN jsonb_build_object('ok',false,'error','service_role_required');
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('usce-phil-case-mail:control',0));

  IF p_action='bind' THEN
    IF p_data->>'account' IS DISTINCT FROM 'philaperri@gmail.com'
       OR p_data->>'scope' IS DISTINCT FROM 'https://www.googleapis.com/auth/gmail.readonly'
       OR coalesce(p_data->>'encrypted_grant','') !~ '^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$'
       OR length(p_data->>'encrypted_grant') NOT BETWEEN 32 AND 4096 THEN
      RETURN jsonb_build_object('ok',false,'error','invalid_consent');
    END IF;
    SELECT * INTO st FROM command_center.usce_phil_mailbox_state WHERE singleton FOR UPDATE;
    IF NOT FOUND THEN
      INSERT INTO command_center.usce_phil_mailbox_state(singleton,account,scope,encrypted_grant,generation,consent_at,cutoff_at)
      VALUES(true,'philaperri@gmail.com','https://www.googleapis.com/auth/gmail.readonly',p_data->>'encrypted_grant',1,now(),now()) RETURNING * INTO st;
    ELSIF st.encrypted_grant IS DISTINCT FROM p_data->>'encrypted_grant' THEN
      UPDATE command_center.usce_phil_mailbox_state SET encrypted_grant=p_data->>'encrypted_grant',generation=generation+1,
        consent_at=now(),cutoff_at=now(),updated_at=now()
      WHERE singleton RETURNING * INTO st;
      UPDATE command_center.usce_phil_case_mail_cursor SET page_token=NULL,retry_after=NULL,
        lease_id=NULL,lease_generation=NULL,lease_until=NULL,updated_at=now();
    END IF;
    RETURN jsonb_build_object('ok',true,'generation',st.generation,'connected_at',st.consent_at);
  END IF;

  SELECT * INTO st FROM command_center.usce_phil_mailbox_state WHERE singleton FOR UPDATE;
  IF NOT FOUND THEN
    IF p_action='claim' THEN RETURN jsonb_build_object('ok',true,'claimed',false,'pending',true); END IF;
    RETURN jsonb_build_object('ok',false,'error','consent_required');
  END IF;

  IF p_action='claim' THEN
    INSERT INTO command_center.usce_phil_case_mail_cursor(case_id)
      SELECT r.id FROM command_center.usce_public_intake_requests r
      WHERE lower(btrim(r.email)) ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
        AND lower(btrim(r.email))<>'philaperri@gmail.com'
      ON CONFLICT(case_id) DO NOTHING;
    SELECT c.* INTO cur FROM command_center.usce_phil_case_mail_cursor c
      JOIN command_center.usce_public_intake_requests r ON r.id=c.case_id
      WHERE (c.lease_until IS NULL OR c.lease_until<=now())
        AND coalesce(c.retry_after,'-infinity'::timestamptz)<=now()
        AND lower(btrim(r.email)) ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
        AND lower(btrim(r.email))<>'philaperri@gmail.com'
      ORDER BY c.last_claimed_at NULLS FIRST,c.case_id
      FOR UPDATE OF c SKIP LOCKED LIMIT 1;
    IF NOT FOUND THEN RETURN jsonb_build_object('ok',true,'claimed',false); END IF;
    v_lease:=gen_random_uuid();
    UPDATE command_center.usce_phil_case_mail_cursor SET lease_id=v_lease,lease_generation=st.generation,
      lease_until=now()+interval '180 seconds',last_claimed_at=now(),updated_at=now()
      WHERE case_id=cur.case_id RETURNING * INTO cur;
    SELECT * INTO req FROM command_center.usce_public_intake_requests WHERE id=cur.case_id;
    SELECT coalesce(jsonb_agg(rfc_message_id ORDER BY received_at DESC), '[]'::jsonb) INTO v_anchors
      FROM (SELECT c.rfc_message_id,max(c.received_at) AS received_at FROM command_center.usce_comms c
        WHERE c.intake_request_id=cur.case_id AND c.rfc_message_id IS NOT NULL
          AND command_center.usce_phil_case_mail_parent_verified(c,cur.case_id)
        GROUP BY c.rfc_message_id ORDER BY max(c.received_at) DESC,c.rfc_message_id LIMIT 12) a;
    v_case_ref:='USCE-'||upper(left(cur.case_id::text,8));
    RETURN jsonb_build_object('ok',true,'claimed',true,'lease_id',v_lease,'case_id',cur.case_id,
      'case_ref',v_case_ref,'student_email',lower(btrim(req.email)),
      'connected_at',st.consent_at,'encrypted_grant',st.encrypted_grant,
      'anchors',v_anchors,'page_token',cur.page_token);
  END IF;

  v_lease:=nullif(p_data->>'lease_id','')::uuid;
  v_case:=nullif(p_data->>'case_id','')::uuid;
  IF v_lease IS NULL OR v_case IS NULL THEN RETURN jsonb_build_object('ok',false,'error','invalid_lease'); END IF;
  SELECT * INTO cur FROM command_center.usce_phil_case_mail_cursor WHERE case_id=v_case FOR UPDATE;
  IF NOT FOUND OR cur.lease_id IS DISTINCT FROM v_lease OR cur.lease_generation IS DISTINCT FROM st.generation
     OR cur.lease_until IS NULL OR cur.lease_until<=now() THEN
    RETURN jsonb_build_object('ok',false,'error','lease_fence_lost');
  END IF;
  SELECT * INTO req FROM command_center.usce_public_intake_requests WHERE id=v_case;
  IF NOT FOUND OR lower(btrim(req.email)) IS NULL OR lower(btrim(req.email)) !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
     OR lower(btrim(req.email))='philaperri@gmail.com' THEN
    RETURN jsonb_build_object('ok',false,'error','invalid_case');
  END IF;

  IF p_action='release' THEN
    UPDATE command_center.usce_phil_case_mail_cursor SET lease_id=NULL,lease_generation=NULL,lease_until=NULL,
      failures=least(failures+1,12),retry_after=now()+least((power(2,least(failures,10))::integer*15),3600)*interval '1 second',updated_at=now()
      WHERE case_id=v_case;
    RETURN jsonb_build_object('ok',true);
  ELSIF p_action='checkpoint' THEN
    IF p_data ? 'page_token' AND p_data->'page_token'<>'null'::jsonb AND
       (jsonb_typeof(p_data->'page_token')<>'string' OR length(p_data->>'page_token')>2048) THEN
      RETURN jsonb_build_object('ok',false,'error','invalid_cursor');
    END IF;
    UPDATE command_center.usce_phil_case_mail_cursor SET
      page_token=CASE WHEN p_data ? 'page_token' THEN nullif(p_data->>'page_token','') ELSE page_token END,
      last_completed_at=now(),failures=0,retry_after=NULL,
      lease_id=NULL,lease_generation=NULL,lease_until=NULL,updated_at=now()
      WHERE case_id=v_case;
    RETURN jsonb_build_object('ok',true);
  ELSIF p_action NOT IN ('preflight','ingest') THEN
    RETURN jsonb_build_object('ok',false,'error','invalid_action');
  END IF;

  v_gmail:=lower(coalesce(p_data->>'gmail_id',''));
  v_thread:=lower(coalesce(p_data->>'thread_id',''));
  v_rfc:=btrim(coalesce(p_data->>'rfc_message_id',''));
  v_from:=lower(btrim(coalesce(p_data->>'from_email','')));
  v_to:=lower(btrim(coalesce(p_data->>'to_email','')));
  v_dir:=p_data->>'direction';
  v_auth:=coalesce(p_data->>'authenticated','false')='true';
  IF v_gmail !~ '^[a-f0-9]{1,40}$' OR v_thread !~ '^[a-f0-9]{1,40}$'
     OR v_rfc !~ '^<[^<>[:space:]]{1,250}>$'
     OR v_dir IS NULL OR v_dir NOT IN ('IN','OUT') OR NOT v_auth
     OR jsonb_typeof(p_data->'authenticated') IS DISTINCT FROM 'boolean'
     OR NOT ((v_dir='IN' AND v_from=lower(btrim(req.email)) AND v_to='philaperri@gmail.com')
          OR (v_dir='OUT' AND v_from='philaperri@gmail.com' AND v_to=lower(btrim(req.email))))
     OR coalesce(p_data->>'received_at','') !~ '^\d{4}-\d{2}-\d{2}T' THEN
    RETURN jsonb_build_object('ok',true,'eligible',false);
  END IF;
  BEGIN
    v_received:=(p_data->>'received_at')::timestamptz;
  EXCEPTION WHEN others THEN
    RETURN jsonb_build_object('ok',true,'eligible',false);
  END;
  IF v_received<st.cutoff_at THEN RETURN jsonb_build_object('ok',true,'eligible',false); END IF;
  v_refs:='{}'::text[];
  IF p_data ? 'references_ids' AND jsonb_typeof(p_data->'references_ids') IS DISTINCT FROM 'array' THEN
    RETURN jsonb_build_object('ok',true,'eligible',false);
  END IF;
  IF jsonb_typeof(p_data->'references_ids')='array' THEN
    IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_data->'references_ids') e
      WHERE jsonb_typeof(e.value)<>'string' OR length(e.value#>>'{}') NOT BETWEEN 3 AND 255
        OR e.value#>>'{}' !~ '^<[^<>[:space:]]{1,250}>$') THEN
      RETURN jsonb_build_object('ok',true,'eligible',false);
    END IF;
    SELECT coalesce(array_agg(value),'{}') INTO v_refs FROM jsonb_array_elements_text(p_data->'references_ids') value;
  END IF;
  IF nullif(p_data->>'in_reply_to','') IS NOT NULL THEN
    v_refs:=array_append(v_refs,btrim(p_data->>'in_reply_to'));
  END IF;
  IF cardinality(v_refs)=0 OR (p_data->>'in_reply_to' IS NOT NULL AND btrim(p_data->>'in_reply_to') !~ '^<[^<>[:space:]]{1,250}>$') THEN
    RETURN jsonb_build_object('ok',true,'eligible',false);
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('usce-phil-case-mail:rfc:'||v_rfc,0));
  SELECT count(*),coalesce(array_agg(DISTINCT c.id) FILTER(WHERE c.id IS NOT NULL),'{}'::uuid[]),
    coalesce(bool_or(c.intake_request_id IS DISTINCT FROM v_case OR c.needs_triage),'false')
    INTO v_parent_count,v_parent_ids,v_other_case
  FROM command_center.usce_comms c
  WHERE c.rfc_message_id=ANY(v_refs);
  IF v_parent_count=0 OR v_other_case OR cardinality(v_parent_ids)=0 THEN
    RETURN jsonb_build_object('ok',true,'eligible',false);
  END IF;
  v_ref:=nullif(btrim(p_data->>'in_reply_to'),'');
  IF v_ref IS NULL THEN
    v_ref:=v_refs[cardinality(v_refs)];
  END IF;
  SELECT count(*) INTO v_count FROM command_center.usce_comms c
    WHERE c.rfc_message_id=v_ref AND command_center.usce_phil_case_mail_parent_verified(c,v_case);
  IF v_count<>1 THEN RETURN jsonb_build_object('ok',true,'eligible',false); END IF;
  SELECT * INTO parent_row FROM command_center.usce_comms c WHERE c.rfc_message_id=v_ref
    AND command_center.usce_phil_case_mail_parent_verified(c,v_case)
    ORDER BY c.created_at DESC LIMIT 1;
  IF parent_row.rfc_message_id IS NULL OR parent_row.intake_request_id<>v_case
     OR parent_row.needs_triage OR parent_row.is_internal_note
     OR command_center.usce_mail_relevance(parent_row)<>'student' THEN
    RETURN jsonb_build_object('ok',true,'eligible',false);
  END IF;
  SELECT count(*) INTO v_count FROM command_center.usce_comms c
    WHERE c.rfc_message_id=v_rfc OR (c.mailbox='philaperri@gmail.com' AND c.gmail_message_id=v_gmail);
  IF v_count>0 THEN
    SELECT * INTO prior FROM command_center.usce_comms c
      WHERE c.rfc_message_id=v_rfc OR (c.mailbox='philaperri@gmail.com' AND c.gmail_message_id=v_gmail)
      ORDER BY c.created_at LIMIT 1;
    IF v_count=1 AND prior.intake_request_id=v_case AND prior.rfc_message_id=v_rfc
       AND prior.direction=v_dir AND lower(prior.from_email)=v_from AND lower(prior.to_email)=v_to
       THEN
      RETURN jsonb_build_object('ok',true,'eligible',false,'duplicate',true);
    END IF;
    RETURN jsonb_build_object('ok',true,'eligible',false);
  END IF;
  IF p_action='preflight' THEN RETURN jsonb_build_object('ok',true,'eligible',true); END IF;

  v_subject:=left(coalesce(p_data->>'subject',''),500);
  v_body:=left(coalesce(p_data->>'body_text',''),100000);
  INSERT INTO command_center.usce_comms(
    intake_request_id,direction,message_status,from_email,to_email,subject,body_text,mailbox,
    gmail_message_id,gmail_thread_id,rfc_message_id,in_reply_to,references_ids,received_at,created_at,
    read_at,mail_state,conversation_id,association_method,needs_triage,raw_json)
  VALUES(v_case,v_dir,CASE WHEN v_dir='IN' THEN 'replied' ELSE 'sent' END,v_from,v_to,v_subject,v_body,
    'philaperri@gmail.com',v_gmail,v_thread,v_rfc,nullif(btrim(p_data->>'in_reply_to'),''),v_refs,v_received,v_received,
    CASE WHEN v_dir='OUT' THEN now() ELSE NULL END,CASE WHEN v_dir='IN' THEN 'received' ELSE 'sent' END,
    coalesce(parent_row.conversation_id,parent_row.id),'verified_reference',false,
    jsonb_build_object('source','usce_phil_case_mail','authenticated',true,'worker_sent_verified',v_dir='OUT',
      'sender_authentication',CASE WHEN v_dir='IN' THEN 'passed' ELSE 'not_applicable' END))
  RETURNING * INTO prior;
  UPDATE command_center.usce_comms SET conversation_id=coalesce(conversation_id,id) WHERE id=prior.id;
  RETURN jsonb_build_object('ok',true,'eligible',true,'inserted',true,'message_id',prior.id);
END $$;

REVOKE ALL ON FUNCTION public.usce_phil_case_mail(text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.usce_phil_case_mail(text,jsonb) TO service_role;

COMMIT;
