-- USCE-PHIL-FIRST-RENOVATION-20261002; DR-359/DR-360
-- Additive request-first safety. No business rows, payment or placement mutations.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

ALTER TABLE command_center.usce_offer_drafts
 ADD COLUMN revision bigint NOT NULL DEFAULT 1,
 ADD COLUMN preview_hash text,
 ADD COLUMN preview_revision bigint,
 ADD COLUMN preview_payload jsonb;

CREATE TABLE command_center.usce_case_activity (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 intake_request_id uuid NOT NULL REFERENCES command_center.usce_public_intake_requests(id),
 kind text NOT NULL CHECK (kind IN ('internal_note','site_call','availability_confirmed')),
 body text NOT NULL CHECK (length(body) BETWEEN 1 AND 2400),
 idempotency_key text NOT NULL CHECK (length(idempotency_key) BETWEEN 1 AND 160),
 actor jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(intake_request_id,idempotency_key)
);
CREATE INDEX usce_case_activity_request_time ON command_center.usce_case_activity(intake_request_id,created_at DESC);
ALTER TABLE command_center.usce_case_activity ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON command_center.usce_case_activity FROM PUBLIC,anon,authenticated;

CREATE TABLE command_center.usce_send_claims (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 offer_id uuid NOT NULL REFERENCES command_center.usce_offer_drafts(id),
 revision bigint NOT NULL,
 preview_hash text NOT NULL,
 idempotency_key text NOT NULL CHECK (length(idempotency_key) BETWEEN 1 AND 160),
 mode text NOT NULL CHECK (mode IN ('live','dry_run')),
 state text NOT NULL DEFAULT 'claimed' CHECK (state IN ('claimed','provider_accepted','failed','ambiguous','dry_run')),
 postmark_message_id text,
 reason text,
 actor jsonb NOT NULL,
 payload jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(offer_id,idempotency_key),
 UNIQUE(offer_id,revision,preview_hash,mode)
);
ALTER TABLE command_center.usce_send_claims ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON command_center.usce_send_claims FROM PUBLIC,anon,authenticated;

CREATE FUNCTION command_center.usce_revision_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 IF ROW(NEW.specialty,NEW.location,NEW.timing,NEW.duration_weeks,NEW.format,NEW.expires_at,NEW.admin_message,NEW.payment_url,NEW.offer_token_hash,NEW.offer_token_expires_at)
    IS DISTINCT FROM ROW(OLD.specialty,OLD.location,OLD.timing,OLD.duration_weeks,OLD.format,OLD.expires_at,OLD.admin_message,OLD.payment_url,OLD.offer_token_hash,OLD.offer_token_expires_at) THEN
  IF OLD.status IN ('accepted','declined','alternate_requested','decline_pending','declined_notify_future','declined_no_notify','expired','archived') THEN
   RAISE EXCEPTION 'Responded or closed USCE terms cannot be revised' USING ERRCODE='40001';
  END IF;
  IF EXISTS (SELECT 1 FROM command_center.usce_send_claims c WHERE c.offer_id=OLD.id AND c.state IN ('claimed','ambiguous')) THEN
   RAISE EXCEPTION 'USCE send requires reconciliation before revision' USING ERRCODE='40001';
  END IF;
  NEW.revision := OLD.revision+1;
  NEW.preview_hash := NULL; NEW.preview_revision := NULL; NEW.preview_payload := NULL;
  NEW.message_previewed_at := NULL;
  -- Rotating the token is intentional; changing terms revokes the prior token.
  IF NEW.offer_token_hash IS NOT DISTINCT FROM OLD.offer_token_hash THEN
   NEW.offer_token_hash := NULL; NEW.offer_token_expires_at := NULL;
  END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION command_center.usce_revision_guard() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER usce_revision_guard BEFORE UPDATE ON command_center.usce_offer_drafts
 FOR EACH ROW EXECUTE FUNCTION command_center.usce_revision_guard();

CREATE FUNCTION public.usce_case_activity(p_intake_request_id uuid,p_event jsonb DEFAULT NULL,p_admin_identity jsonb DEFAULT '{}')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_event command_center.usce_case_activity%ROWTYPE; v_activity jsonb;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM command_center.usce_public_intake_requests WHERE id=p_intake_request_id) THEN
  RETURN jsonb_build_object('ok',false,'error','not_found');
 END IF;
 IF p_event IS NOT NULL THEN
  IF p_event->>'kind' NOT IN ('internal_note','site_call','availability_confirmed')
     OR length(coalesce(trim(p_event->>'body'),'')) NOT BETWEEN 1 AND 2400
     OR length(coalesce(p_event->>'idempotency_key','')) NOT BETWEEN 1 AND 160 THEN
   RETURN jsonb_build_object('ok',false,'error','invalid_activity');
  END IF;
  INSERT INTO command_center.usce_case_activity(intake_request_id,kind,body,idempotency_key,actor)
  VALUES(p_intake_request_id,p_event->>'kind',trim(p_event->>'body'),p_event->>'idempotency_key',p_admin_identity)
  ON CONFLICT(intake_request_id,idempotency_key) DO NOTHING RETURNING * INTO v_event;
  IF NOT FOUND THEN
   SELECT * INTO v_event FROM command_center.usce_case_activity WHERE intake_request_id=p_intake_request_id AND idempotency_key=p_event->>'idempotency_key';
   IF v_event.kind IS DISTINCT FROM p_event->>'kind' OR v_event.body IS DISTINCT FROM trim(p_event->>'body') THEN
    RETURN jsonb_build_object('ok',false,'error','idempotency_conflict');
   END IF;
  END IF;
 END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(a) ORDER BY a.created_at DESC),'[]') INTO v_activity
 FROM (SELECT id,intake_request_id,kind,body,actor,created_at FROM command_center.usce_case_activity WHERE intake_request_id=p_intake_request_id ORDER BY created_at DESC LIMIT 200) a;
 RETURN jsonb_build_object('ok',true,'data',jsonb_build_object('event',CASE WHEN v_event.id IS NULL THEN NULL ELSE to_jsonb(v_event)-'idempotency_key' END,'activity',v_activity));
END $$;
REVOKE ALL ON FUNCTION public.usce_case_activity(uuid,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.usce_case_activity(uuid,jsonb,jsonb) TO service_role;

CREATE FUNCTION public.usce_bind_message_preview(p_offer_id uuid,p_message jsonb,p_admin_identity jsonb DEFAULT '{}')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE o command_center.usce_offer_drafts%ROWTYPE; recipient text;
BEGIN
 SELECT * INTO o FROM command_center.usce_offer_drafts WHERE id=p_offer_id FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','not_found'); END IF;
 IF EXISTS(SELECT 1 FROM command_center.usce_send_claims WHERE offer_id=o.id AND state IN ('claimed','ambiguous')) THEN RETURN jsonb_build_object('ok',false,'error','send_requires_reconciliation'); END IF;
 IF o.status IN ('archived','expired') THEN RETURN jsonb_build_object('ok',false,'error','invalid_state'); END IF;
 IF (p_message->>'revision')::bigint IS DISTINCT FROM o.revision THEN RETURN jsonb_build_object('ok',false,'error','stale_revision'); END IF;
 SELECT lower(email) INTO recipient FROM command_center.usce_public_intake_requests WHERE id=o.intake_request_id;
 IF recipient IS DISTINCT FROM lower(p_message->>'to_email') THEN RETURN jsonb_build_object('ok',false,'error','recipient_mismatch'); END IF;
 IF p_message->>'category' IS NULL OR p_message->>'category' NOT IN ('request_received','availability_confirmed','alternate_option_recommended','offer_ready','offer_reminder','accepted_offer_next_steps','declined_response','alternate_requested_response','payment_reminder') THEN
  RETURN jsonb_build_object('ok',false,'error','invalid_message_category');
 END IF;
 IF coalesce(p_message->>'preview_hash','') !~ '^[a-f0-9]{64}$' THEN RETURN jsonb_build_object('ok',false,'error','invalid_preview'); END IF;
 IF p_message->>'category' IN ('offer_ready','offer_reminder','alternate_option_recommended','availability_confirmed') THEN
  IF o.status IN ('accepted','declined','alternate_requested','decline_pending','declined_notify_future','declined_no_notify')
   OR o.offer_token_hash IS NULL OR o.offer_token_hash IS DISTINCT FROM p_message->>'link_token_hash'
   OR o.offer_token_expires_at IS NULL OR o.expires_at IS NULL OR o.offer_token_expires_at<=now() OR o.expires_at<=now() THEN
   RETURN jsonb_build_object('ok',false,'error','current_offer_link_required');
  END IF;
 END IF;
 UPDATE command_center.usce_offer_drafts SET preview_hash=p_message->>'preview_hash',preview_revision=o.revision,
 preview_payload=p_message-'link_token_hash',message_previewed_at=now(),
 message_category=p_message->>'category',message_variant=p_message->>'variant',
 message_subject=p_message->>'subject',message_body=p_message->>'body',
 updated_by=left(coalesce(p_admin_identity->>'login','unknown'),160)
 WHERE id=o.id;
 RETURN jsonb_build_object('ok',true,'item',public.usce_offer_draft_admin_json(o.id),
 'data',jsonb_build_object('preview_hash',p_message->>'preview_hash','revision',o.revision,'rendered_email',p_message->'rendered_email'));
END $$;
REVOKE ALL ON FUNCTION public.usce_bind_message_preview(uuid,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.usce_bind_message_preview(uuid,jsonb,jsonb) TO service_role;

CREATE FUNCTION public.usce_claim_send(p_offer_id uuid,p_preview_hash text,p_revision bigint,p_idempotency_key text,p_mode text,p_admin_identity jsonb DEFAULT '{}')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE o command_center.usce_offer_drafts%ROWTYPE; c command_center.usce_send_claims%ROWTYPE; recipient text;
BEGIN
 SELECT * INTO o FROM command_center.usce_offer_drafts WHERE id=p_offer_id FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','not_found'); END IF;
 SELECT * INTO c FROM command_center.usce_send_claims WHERE offer_id=o.id AND idempotency_key=p_idempotency_key;
 IF FOUND THEN
  IF c.preview_hash IS DISTINCT FROM p_preview_hash OR c.revision IS DISTINCT FROM p_revision OR c.mode IS DISTINCT FROM p_mode THEN
   RETURN jsonb_build_object('ok',false,'error','idempotency_conflict');
  END IF;
  RETURN jsonb_build_object('ok',true,'data',jsonb_build_object('claimed',false,'claim',to_jsonb(c)-'payload','item',public.usce_offer_draft_admin_json(o.id)));
 END IF;
 IF p_mode NOT IN ('live','dry_run') OR length(coalesce(p_idempotency_key,'')) NOT BETWEEN 1 AND 160 THEN RETURN jsonb_build_object('ok',false,'error','invalid_claim'); END IF;
 IF o.status IN ('archived','expired') OR o.revision IS DISTINCT FROM p_revision OR o.preview_revision IS DISTINCT FROM p_revision OR o.preview_hash IS DISTINCT FROM p_preview_hash OR o.preview_payload IS NULL THEN
  RETURN jsonb_build_object('ok',false,'error','stale_preview');
 END IF;
 SELECT lower(email) INTO recipient FROM command_center.usce_public_intake_requests WHERE id=o.intake_request_id;
 IF recipient IS DISTINCT FROM lower(o.preview_payload->>'to_email') THEN RETURN jsonb_build_object('ok',false,'error','recipient_mismatch'); END IF;
 IF o.preview_payload->>'category' IN ('offer_ready','offer_reminder','alternate_option_recommended','availability_confirmed') AND
 (o.status IN ('accepted','declined','alternate_requested','decline_pending','declined_notify_future','declined_no_notify') OR o.offer_token_hash IS NULL OR o.offer_token_expires_at IS NULL OR o.expires_at IS NULL OR o.offer_token_expires_at<=now() OR o.expires_at<=now()) THEN
  RETURN jsonb_build_object('ok',false,'error','current_offer_link_required');
 END IF;
 IF EXISTS(SELECT 1 FROM command_center.usce_send_claims WHERE offer_id=o.id AND state IN ('claimed','ambiguous')) THEN
  RETURN jsonb_build_object('ok',false,'error','send_requires_reconciliation');
 END IF;
 INSERT INTO command_center.usce_send_claims(offer_id,revision,preview_hash,idempotency_key,mode,actor,payload)
 VALUES(o.id,o.revision,p_preview_hash,p_idempotency_key,p_mode,p_admin_identity,o.preview_payload)
 ON CONFLICT(offer_id,revision,preview_hash,mode) DO NOTHING RETURNING * INTO c;
 IF NOT FOUND THEN
  SELECT * INTO c FROM command_center.usce_send_claims WHERE offer_id=o.id AND revision=p_revision AND preview_hash=p_preview_hash AND mode=p_mode;
  RETURN jsonb_build_object('ok',true,'data',jsonb_build_object('claimed',false,'claim',to_jsonb(c)-'payload','item',public.usce_offer_draft_admin_json(o.id)));
 END IF;
 RETURN jsonb_build_object('ok',true,'data',jsonb_build_object('claimed',true,'claim',to_jsonb(c)-'payload','preview',c.payload));
END $$;
REVOKE ALL ON FUNCTION public.usce_claim_send(uuid,text,bigint,text,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.usce_claim_send(uuid,text,bigint,text,text,jsonb) TO service_role;

CREATE FUNCTION public.usce_finish_send(p_claim_id uuid,p_state text,p_message_id text DEFAULT NULL,p_reason text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE c command_center.usce_send_claims%ROWTYPE; o command_center.usce_offer_drafts%ROWTYPE; comm uuid;
BEGIN
 -- Same lock order as the claim and revision paths.
 SELECT o1.* INTO o FROM command_center.usce_offer_drafts o1 JOIN command_center.usce_send_claims c1 ON c1.offer_id=o1.id WHERE c1.id=p_claim_id FOR UPDATE OF o1;
 SELECT * INTO c FROM command_center.usce_send_claims WHERE id=p_claim_id FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','not_found'); END IF;
 IF c.state <> 'claimed' THEN RETURN jsonb_build_object('ok',true,'idempotent',true,'item',public.usce_offer_draft_admin_json(o.id),'data',jsonb_build_object('claim',to_jsonb(c)-'payload')); END IF;
 IF p_state NOT IN ('provider_accepted','failed','ambiguous','dry_run') OR (c.mode='dry_run' AND p_state<>'dry_run') OR (c.mode='live' AND p_state='dry_run')
 OR (p_state='provider_accepted' AND nullif(p_message_id,'') IS NULL) THEN RETURN jsonb_build_object('ok',false,'error','invalid_outcome'); END IF;
 UPDATE command_center.usce_send_claims SET state=p_state,postmark_message_id=p_message_id,reason=left(p_reason,240),updated_at=now() WHERE id=c.id RETURNING * INTO c;
 IF p_state='provider_accepted' THEN
  UPDATE command_center.usce_offer_drafts SET status=CASE WHEN status IN ('draft','ready','viewed') THEN 'sent' ELSE status END,
   message_sent_at=now(),postmark_status='sent',postmark_message_id=p_message_id,message_last_idempotency_key=c.idempotency_key
  WHERE id=o.id;
 ELSE
  -- Dry runs and unresolved provider attempts leave business stages untouched.
  UPDATE command_center.usce_offer_drafts SET postmark_status=CASE WHEN p_state='failed' THEN 'failed' ELSE postmark_status END WHERE id=o.id;
 END IF;
 IF p_state='provider_accepted' THEN
  comm := command_center.usce_log_offer_engine_comm(o.id,o.intake_request_id,'offer_email_provider_accepted','OUT',
   c.payload->>'subject',c.payload->>'body',jsonb_build_object('source','usce-renovation','claim_id',c.id,'mode',c.mode,'provider_outcome',p_state,'idempotency_key',c.idempotency_key),p_message_id,false,c.payload->>'to_email',NULL);
 END IF;
 RETURN jsonb_build_object('ok',true,'dry_run',p_state='dry_run','mode',c.mode,'item',public.usce_offer_draft_admin_json(o.id),
 'data',jsonb_build_object('claim',to_jsonb(c)-'payload','provider_outcome',p_state),'comms_id',comm);
END $$;
REVOKE ALL ON FUNCTION public.usce_finish_send(uuid,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.usce_finish_send(uuid,text,text,text) TO service_role;

CREATE FUNCTION public.usce_send_state(p_offer_id uuid)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
 SELECT jsonb_build_object('ok',true,'items',coalesce(jsonb_agg(jsonb_build_object(
 'id',c.id,'created_at',c.created_at,'updated_at',c.updated_at,'revision',c.revision,
 'state',c.state,'mode',c.mode,'postmark_message_id',c.postmark_message_id,'reason',c.reason) ORDER BY c.created_at DESC),'[]'))
 FROM (SELECT * FROM command_center.usce_send_claims WHERE offer_id=p_offer_id ORDER BY created_at DESC LIMIT 50) c;
$$;
REVOKE ALL ON FUNCTION public.usce_send_state(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.usce_send_state(uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.update_usce_offer_draft(p_offer_id uuid, p_offer jsonb, p_admin_identity jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'command_center', 'public', 'pg_temp'
AS $function$
DECLARE
  v_offer command_center.usce_offer_drafts%ROWTYPE;
  v_existing command_center.usce_offer_drafts%ROWTYPE;
  v_admin text := left(coalesce(p_admin_identity->>'login', p_admin_identity->>'wp_id', 'unknown'), 160);
  v_duration integer;
  v_expires_at timestamptz;
  v_status text := nullif(p_offer->>'status', '');
BEGIN
  SELECT * INTO v_existing
  FROM command_center.usce_offer_drafts
  WHERE id = p_offer_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  IF v_existing.status IN ('accepted', 'declined', 'alternate_requested', 'expired', 'archived', 'decline_pending', 'declined_notify_future', 'declined_no_notify') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_state');
  END IF;

  IF (p_offer->>'expected_revision')::bigint IS DISTINCT FROM v_existing.revision THEN
    RETURN jsonb_build_object('ok', false, 'error', 'stale_revision');
  END IF;
  IF coalesce(p_offer->>'duration_weeks', '') ~ '^[0-9]+$' THEN
    v_duration := (p_offer->>'duration_weeks')::integer;
  ELSE
    v_duration := v_existing.duration_weeks;
  END IF;

  IF nullif(p_offer->>'expires_at', '') IS NOT NULL THEN
    v_expires_at := (p_offer->>'expires_at')::timestamptz;
  ELSE
    v_expires_at := v_existing.expires_at;
  END IF;

  UPDATE command_center.usce_offer_drafts
  SET updated_by = v_admin,
      status = coalesce(v_status, status),
      specialty = coalesce(nullif(p_offer->>'specialty', ''), specialty),
      location = coalesce(nullif(p_offer->>'location', ''), location),
      timing = coalesce(nullif(p_offer->>'timing', ''), timing),
      duration_weeks = v_duration,
      format = coalesce(nullif(p_offer->>'format', ''), format),
      expires_at = v_expires_at,
      admin_message = coalesce(nullif(p_offer->>'admin_message', ''), admin_message),
      metadata = metadata || jsonb_build_object(
        'last_admin_update', p_admin_identity,
        'draft_metadata', coalesce(p_offer->'metadata', '{}'::jsonb)
      )
  WHERE id = p_offer_id
  RETURNING * INTO v_offer;

  RETURN jsonb_build_object('ok', true, 'item', public.usce_offer_draft_admin_json(v_offer.id));
END;
$function$;
CREATE OR REPLACE FUNCTION public.usce_offer_draft_admin_json(p_offer_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'command_center', 'public', 'pg_temp'
AS $function$
  SELECT jsonb_build_object(
    'id', o.id,
    'revision', o.revision,
    'intake_request_id', o.intake_request_id,
    'created_at', o.created_at,
    'updated_at', o.updated_at,
    'status', o.status,
    'specialty', o.specialty,
    'location', o.location,
    'timing', o.timing,
    'duration_weeks', o.duration_weeks,
    'format', o.format,
    'expires_at', o.expires_at,
    'admin_message', o.admin_message,
    'payment_url', o.payment_url,
    'has_token', o.offer_token_hash IS NOT NULL,
    'offer_token_expires_at', o.offer_token_expires_at,
    'accepted_at', o.accepted_at,
    'declined_at', o.declined_at,
    'alternate_requested_at', o.alternate_requested_at,
    'student_response_note', o.student_response_note,
    'message_category', o.message_category,
    'message_variant', o.message_variant,
    'message_subject', o.message_subject,
    'message_body', o.message_body,
    'message_previewed_at', o.message_previewed_at,
    'message_sent_at', o.message_sent_at,
    'postmark_status', o.postmark_status,
    'payment_status', o.payment_status,
    'payment_reference', o.payment_reference,
    'payment_checked_at', o.payment_checked_at,
    'paperwork_status', o.paperwork_status,
    'paperwork_updated_at', o.paperwork_updated_at,
    'learndash_status', o.learndash_status,
    'learndash_updated_at', o.learndash_updated_at,
    'metadata', o.metadata,
    'intake', jsonb_build_object(
      'student_name', r.student_name,
      'email', r.email,
      'status', r.status,
      'preferred_specialties', r.preferred_specialties,
      'preferred_locations', r.preferred_locations,
      'preferred_months_or_dates', r.preferred_months_or_dates,
      'duration_weeks', r.duration_weeks
    )
  )
  FROM command_center.usce_offer_drafts o
  JOIN command_center.usce_public_intake_requests r ON r.id = o.intake_request_id
  WHERE o.id = p_offer_id;
$function$;
CREATE OR REPLACE FUNCTION public.mint_usce_offer_token(p_offer_id uuid, p_token_hash text, p_expires_at timestamp with time zone, p_admin_identity jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'command_center', 'public', 'pg_temp'
AS $function$
DECLARE
  v_offer command_center.usce_offer_drafts%ROWTYPE;
  v_admin text := left(coalesce(p_admin_identity->>'login', p_admin_identity->>'wp_id', 'unknown'), 160);
  v_comm_id uuid;
BEGIN
  IF p_token_hash IS NULL OR p_token_hash !~ '^[a-f0-9]{64}$' OR p_expires_at IS NULL OR p_expires_at<=now() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_token_hash');
  END IF;

  SELECT * INTO v_offer
  FROM command_center.usce_offer_drafts
  WHERE id = p_offer_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  IF v_offer.status IN ('accepted', 'declined', 'alternate_requested', 'expired', 'archived', 'decline_pending', 'declined_notify_future', 'declined_no_notify') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_state');
  END IF;

  UPDATE command_center.usce_offer_drafts
  SET offer_token_hash = p_token_hash,
      offer_token_expires_at = p_expires_at,
      expires_at = coalesce(expires_at, p_expires_at),
      status = CASE WHEN status = 'draft' THEN 'ready' ELSE status END,
      updated_by = v_admin,
      metadata = metadata || jsonb_build_object('token_minted_by', p_admin_identity, 'token_minted_at', now())
  WHERE id = p_offer_id
  RETURNING * INTO v_offer;

  v_comm_id := command_center.usce_log_offer_engine_comm(
    v_offer.id,
    v_offer.intake_request_id,
    'offer_link_generated',
    'SYS',
    'USCE offer portal link generated',
    'A tokenized offer portal link was generated by a privileged admin. Only the SHA-256 token hash is stored.',
    jsonb_build_object(
      'stored_token_material', 'sha256_hash_only',
      'token_expires_at', p_expires_at,
      'admin_identity', p_admin_identity
    ),
    NULL,
    false,
    NULL,
    NULL
  );

  RETURN jsonb_build_object(
    'ok', true,
    'item', public.usce_offer_draft_admin_json(v_offer.id),
    'token_expires_at', v_offer.offer_token_expires_at,
    'stored_token_material', 'sha256_hash_only',
    'comms_id', v_comm_id
  );
END;
$function$;
CREATE OR REPLACE FUNCTION public.update_usce_offer_message_preview(p_offer_id uuid, p_message jsonb, p_admin_identity jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'command_center', 'public', 'pg_temp'
AS $function$
BEGIN
 RETURN jsonb_build_object('ok',false,'error','legacy_send_path_retired');
END;
$function$;

CREATE OR REPLACE FUNCTION public.record_usce_offer_postmark_send(p_offer_id uuid, p_message jsonb, p_mode text DEFAULT 'dry_run'::text, p_idempotency_key text DEFAULT NULL::text, p_postmark_message_id text DEFAULT NULL::text, p_admin_identity jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'command_center', 'public', 'pg_temp'
AS $function$
BEGIN
 RETURN jsonb_build_object('ok',false,'error','legacy_send_path_retired');
END;
$function$;


CREATE FUNCTION public.usce_reconcile_send(p_claim_id uuid,p_message_id text,p_evidence jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE c command_center.usce_send_claims%ROWTYPE; o command_center.usce_offer_drafts%ROWTYPE; comm uuid;
BEGIN
 SELECT o1.* INTO o FROM command_center.usce_offer_drafts o1 JOIN command_center.usce_send_claims c1 ON c1.offer_id=o1.id WHERE c1.id=p_claim_id FOR UPDATE OF o1;
 SELECT * INTO c FROM command_center.usce_send_claims WHERE id=p_claim_id FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','not_found'); END IF;
 IF c.state='provider_accepted' THEN RETURN jsonb_build_object('ok',true,'idempotent',true,'item',public.usce_offer_draft_admin_json(o.id)); END IF;
 IF c.mode<>'live' OR c.state NOT IN ('claimed','ambiguous') OR nullif(p_message_id,'') IS NULL
 OR p_evidence->>'claim_id' IS DISTINCT FROM c.id::text OR p_evidence->>'recipient' IS DISTINCT FROM c.payload->>'to_email'
 OR p_evidence->>'subject' IS DISTINCT FROM c.payload->>'subject' OR p_evidence->>'provider_message_id' IS DISTINCT FROM p_message_id
 OR p_evidence->>'text_sha256' IS DISTINCT FROM c.payload->'rendered_email'->>'text_sha256'
 OR p_evidence->>'html_sha256' IS DISTINCT FROM c.payload->'rendered_email'->>'html_sha256'
 OR p_evidence->>'text_sha256' IS NULL OR p_evidence->>'html_sha256' IS NULL THEN
 RETURN jsonb_build_object('ok',false,'error','provider_evidence_mismatch'); END IF;
 UPDATE command_center.usce_send_claims SET state='provider_accepted',postmark_message_id=p_message_id,reason='verified_provider_readback',updated_at=now() WHERE id=c.id;
 UPDATE command_center.usce_offer_drafts SET status=CASE WHEN status IN ('draft','ready','viewed') THEN 'sent' ELSE status END,
 message_sent_at=coalesce(message_sent_at,now()),postmark_status='sent',postmark_message_id=p_message_id,message_last_idempotency_key=c.idempotency_key WHERE id=o.id;
 comm := command_center.usce_log_offer_engine_comm(o.id,o.intake_request_id,'offer_email_provider_reconciled','OUT',c.payload->>'subject',c.payload->>'body',
 jsonb_build_object('claim_id',c.id,'provider_outcome','provider_accepted','provider_readback',p_evidence,'preview_hash',c.preview_hash),p_message_id,false,c.payload->>'to_email',NULL);
 RETURN jsonb_build_object('ok',true,'item',public.usce_offer_draft_admin_json(o.id),'comms_id',comm);
END $$;
REVOKE ALL ON FUNCTION public.usce_reconcile_send(uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.usce_reconcile_send(uuid,text,jsonb) TO service_role;

-- Preserve existing decline preference contract; close pending-decline and deadline bypasses.
CREATE OR REPLACE FUNCTION public.respond_usce_offer_by_token_hash(p_token_hash text, p_action text, p_note text DEFAULT NULL::text, p_consent boolean DEFAULT false, p_metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'command_center', 'public', 'pg_temp'
AS $function$
DECLARE
  v_offer command_center.usce_offer_drafts%ROWTYPE;
  v_action text := lower(trim(coalesce(p_action, '')));
  v_target_status text;
  v_event_type text;
  v_event_subject text;
  v_default_body text;
  v_response_note text := left(regexp_replace(coalesce(p_note, ''), '[[:cntrl:]]+', ' ', 'g'), 1000);
  v_metadata jsonb := coalesce(p_metadata, '{}'::jsonb);
  v_notify_future_rotations boolean;
  v_comm_id uuid;
BEGIN
  IF v_action NOT IN (
    'accept',
    'decline',
    'request_alternate',
    'decline_pending',
    'decline_notify_future',
    'decline_no_notify'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_action');
  END IF;

  SELECT * INTO v_offer
  FROM command_center.usce_offer_drafts
  WHERE offer_token_hash = p_token_hash
  FOR UPDATE;

  IF NOT FOUND OR v_offer.status IN ('draft', 'archived') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_token');
  END IF;

  -- A pending decline cannot become acceptance or alternate selection.
  IF v_offer.status = 'decline_pending' AND v_action NOT IN ('decline_pending','decline_notify_future','decline_no_notify') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_responded');
  END IF;
  -- Response deadline and token lifetime are independent. Completed responses remain canonical.
  IF v_offer.status IN ('ready','sent','viewed') AND (v_offer.expires_at IS NULL OR v_offer.expires_at <= now()) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'expired');
  END IF;

  IF v_offer.offer_token_expires_at IS NULL OR v_offer.offer_token_expires_at <= now() THEN
    UPDATE command_center.usce_offer_drafts
    SET status = 'expired'
    WHERE id = v_offer.id
      AND status NOT IN (
        'accepted',
        'declined',
        'alternate_requested',
        'declined_notify_future',
        'declined_no_notify',
        'archived'
      );
    RETURN jsonb_build_object('ok', false, 'error', 'expired');
  END IF;

  v_target_status := CASE v_action
    WHEN 'accept' THEN 'accepted'
    WHEN 'decline' THEN 'declined'
    WHEN 'request_alternate' THEN 'alternate_requested'
    WHEN 'decline_pending' THEN 'decline_pending'
    WHEN 'decline_notify_future' THEN 'declined_notify_future'
    ELSE 'declined_no_notify'
  END;

  v_notify_future_rotations := CASE v_action
    WHEN 'decline_notify_future' THEN true
    WHEN 'decline_no_notify' THEN false
    ELSE NULL
  END;

  IF v_offer.status = v_target_status THEN
    RETURN jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'offer', public.usce_offer_student_json(v_offer.id, v_target_status = 'accepted')
    );
  END IF;

  IF v_offer.status IN (
    'accepted',
    'declined',
    'alternate_requested',
    'declined_notify_future',
    'declined_no_notify'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_responded');
  END IF;

  IF v_action IN ('decline_notify_future', 'decline_no_notify')
     AND v_offer.status <> 'decline_pending' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_state');
  END IF;

  IF v_offer.status NOT IN ('ready', 'sent', 'viewed', 'decline_pending') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_state');
  END IF;

  UPDATE command_center.usce_offer_drafts
  SET status = v_target_status,
      accepted_at = CASE WHEN v_action = 'accept' THEN now() ELSE accepted_at END,
      declined_at = CASE WHEN v_action IN ('decline', 'decline_notify_future', 'decline_no_notify') THEN now() ELSE declined_at END,
      alternate_requested_at = CASE WHEN v_action = 'request_alternate' THEN now() ELSE alternate_requested_at END,
      payment_status = CASE WHEN v_action = 'accept' THEN 'handoff_shown' ELSE payment_status END,
      payment_checked_at = CASE WHEN v_action = 'accept' THEN now() ELSE payment_checked_at END,
      student_response_note = v_response_note,
      metadata = metadata
        || jsonb_build_object(
          'last_student_response', jsonb_build_object(
            'action', v_action,
            'target_status', v_target_status,
            'consent', coalesce(p_consent, false),
            'metadata', v_metadata,
            'notify_future_rotations', v_notify_future_rotations,
            'recorded_at', now()
          )
        )
        || CASE
          WHEN v_action IN ('decline_notify_future', 'decline_no_notify') THEN
            jsonb_build_object(
              'decline_confirmation', jsonb_build_object(
                'notify_future_rotations', v_notify_future_rotations,
                'recorded_at', now()
              )
            )
          ELSE '{}'::jsonb
        END
  WHERE id = v_offer.id
  RETURNING * INTO v_offer;

  v_event_type := CASE v_action
    WHEN 'accept' THEN 'student_accepted_offer'
    WHEN 'decline' THEN 'student_declined_offer'
    WHEN 'request_alternate' THEN 'student_requested_alternate'
    WHEN 'decline_pending' THEN 'student_decline_pending'
    WHEN 'decline_notify_future' THEN 'student_declined_offer_notify_future'
    ELSE 'student_declined_offer_no_notify'
  END;

  v_event_subject := CASE v_action
    WHEN 'accept' THEN 'Student accepted USCE offer'
    WHEN 'decline' THEN 'Student declined USCE offer'
    WHEN 'request_alternate' THEN 'Student requested alternate USCE option'
    WHEN 'decline_pending' THEN 'Student opened decline confirmation'
    WHEN 'decline_notify_future' THEN 'Student declined USCE offer and wants future rotation notifications'
    ELSE 'Student declined USCE offer and does not want future rotation notifications'
  END;

  v_default_body := CASE v_action
    WHEN 'decline_pending' THEN 'Student opened the decline confirmation page. Final notify preference is still required.'
    WHEN 'decline_notify_future' THEN 'Student declined and asked to be notified about future rotations.'
    WHEN 'decline_no_notify' THEN 'Student declined and does not want future rotation notifications.'
    ELSE 'Student response recorded through tokenized offer portal.'
  END;

  v_comm_id := command_center.usce_log_offer_engine_comm(
    v_offer.id,
    v_offer.intake_request_id,
    v_event_type,
    'SYS',
    v_event_subject,
    coalesce(nullif(v_response_note, ''), v_default_body),
    jsonb_build_object(
      'action', v_action,
      'target_status', v_target_status,
      'notify_future_rotations', v_notify_future_rotations,
      'metadata', v_metadata
    ),
    NULL,
    false,
    NULL,
    NULL
  );

  IF v_action = 'accept' THEN
    PERFORM command_center.usce_log_offer_engine_comm(
      v_offer.id,
      v_offer.intake_request_id,
      'payment_handoff_shown',
      'SYS',
      'WooCommerce payment handoff shown',
      'Canonical MissionMed USCE Clinical Rotations payment handoff was returned after acceptance. No order or payment was created by MissionMed HQ.',
      jsonb_build_object(
        'payment_url', v_offer.payment_url,
        'payment_status', v_offer.payment_status,
        'student_response_comms_id', v_comm_id
      ),
      NULL,
      false,
      NULL,
      NULL
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'offer', public.usce_offer_student_json(v_offer.id, v_target_status = 'accepted'),
    'comms_id', v_comm_id
  );
END;
$function$;

COMMIT;
