SET LOCAL lock_timeout = '5s';
DO $check$ BEGIN
  IF md5(pg_get_functiondef('public.create_usce_public_intake_request(jsonb)'::regprocedure)) <> '11320baceedb95e263f318edc7269be7'
    OR EXISTS(SELECT FROM command_center.usce_public_intake_requests WHERE left(idempotency_key,6)='mmwp1-') THEN
    RAISE EXCEPTION 'Intake contract changed'; END IF;
END $check$;
CREATE TABLE command_center.usce_tracker_pending_intakes (
  receipt_key text PRIMARY KEY CHECK (receipt_key ~ '^mmwp1-[0-9a-f]{64}$'),
  wp_user_id bigint NOT NULL CHECK (wp_user_id>0), email text NOT NULL,
  expires_at timestamptz NOT NULL
);
CREATE INDEX usce_tracker_pending_expiry ON command_center.usce_tracker_pending_intakes(expires_at);
CREATE TABLE command_center.usce_tracker_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), wp_user_id bigint NOT NULL CHECK(wp_user_id>0),
  intake_id uuid NOT NULL REFERENCES command_center.usce_public_intake_requests(id),
  email text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL,
  issued_at timestamptz, proof_hash text, failures smallint NOT NULL DEFAULT 0 CHECK(failures BETWEEN 0 AND 5),
  delivery_outcome text CHECK(delivery_outcome IN ('provider_accepted','failed','ambiguous')), provider_message_id uuid,
  consumed_at timestamptz
);
CREATE INDEX usce_tracker_claims_owner_time ON command_center.usce_tracker_claims(wp_user_id,created_at DESC);
CREATE INDEX usce_tracker_claims_case_time ON command_center.usce_tracker_claims(intake_id,created_at DESC);
CREATE INDEX usce_tracker_claims_queue ON command_center.usce_tracker_claims(created_at) WHERE issued_at IS NULL;
ALTER TABLE command_center.usce_tracker_pending_intakes ENABLE ROW LEVEL SECURITY;
ALTER TABLE command_center.usce_tracker_claims ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON command_center.usce_tracker_pending_intakes,command_center.usce_tracker_claims FROM PUBLIC,anon,authenticated,service_role;

-- A previously completed retry keeps its owner. A prepared key can bind only an original INSERT.
CREATE FUNCTION command_center.usce_tracker_attach_new_intake() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE owner_row command_center.usce_tracker_pending_intakes%ROWTYPE;
BEGIN
  IF left(NEW.idempotency_key,6) IS DISTINCT FROM 'mmwp1-' THEN RETURN NEW; END IF;
  DELETE FROM command_center.usce_tracker_pending_intakes WHERE receipt_key=NEW.idempotency_key
    AND expires_at>now() AND email=lower(btrim(NEW.email)) RETURNING * INTO owner_row;
  IF NOT FOUND THEN RAISE EXCEPTION 'Signed-in intake preparation expired'; END IF;
  INSERT INTO command_center.usce_tracker_account_cases(intake_request_id,wp_user_id,confirmed_email)
    VALUES (NEW.id,owner_row.wp_user_id,owner_row.email);
  RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION command_center.usce_tracker_attach_new_intake() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER usce_tracker_attach_new_intake AFTER INSERT ON command_center.usce_public_intake_requests
FOR EACH ROW WHEN (left(NEW.idempotency_key,6)='mmwp1-') EXECUTE FUNCTION command_center.usce_tracker_attach_new_intake();

CREATE FUNCTION command_center.usce_tracker_prepare(p_uid bigint,p_email text,p_key text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE normalized text:=lower(btrim(p_email));
BEGIN
  IF p_uid IS NULL OR p_uid<=0 OR normalized IS NULL OR length(normalized) NOT BETWEEN 3 AND 254
     OR p_key IS NULL OR p_key !~ '^mmwp1-[0-9a-f]{64}$' THEN RETURN false; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('usce-prepare:'||p_uid,0));
  IF EXISTS(SELECT FROM command_center.usce_public_intake_requests r WHERE r.idempotency_key=p_key) THEN
    RETURN EXISTS(SELECT FROM command_center.usce_public_intake_requests r JOIN command_center.usce_tracker_account_cases b
        ON b.intake_request_id=r.id WHERE r.idempotency_key=p_key AND b.wp_user_id=p_uid AND b.confirmed_email=normalized AND lower(btrim(r.email))=normalized);
  END IF;
  DELETE FROM command_center.usce_tracker_pending_intakes WHERE expires_at<=now();
  IF NOT EXISTS(SELECT FROM command_center.usce_tracker_pending_intakes WHERE receipt_key=p_key)
    AND (SELECT count(*) FROM command_center.usce_tracker_pending_intakes WHERE wp_user_id=p_uid)>=12 THEN RETURN false; END IF;
  INSERT INTO command_center.usce_tracker_pending_intakes AS pending VALUES(p_key,p_uid,normalized,now()+interval '35 minutes')
    ON CONFLICT(receipt_key) DO UPDATE SET expires_at=excluded.expires_at
    WHERE pending.wp_user_id=excluded.wp_user_id AND pending.email=excluded.email;
  RETURN FOUND;
END $fn$;

CREATE FUNCTION command_center.usce_tracker_request_claim(p_uid bigint,p_email text,p_ref uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE normalized text:=lower(btrim(p_email));
BEGIN
  IF p_uid IS NULL OR p_uid<=0 OR p_ref IS NULL OR normalized IS NULL THEN RETURN false; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('usce-claim-user:'||p_uid,0));
  -- Lock the intake before inspecting case-wide limits and the case owner.
  PERFORM 1 FROM command_center.usce_public_intake_requests WHERE id=p_ref AND lower(btrim(email))=normalized FOR UPDATE;
  IF NOT FOUND THEN RETURN true; END IF;
  IF EXISTS(SELECT FROM command_center.usce_tracker_account_cases WHERE intake_request_id=p_ref) THEN RETURN true; END IF;
  IF EXISTS(SELECT FROM command_center.usce_tracker_claims WHERE intake_id=p_ref AND created_at>now()-interval '2 minutes')
    OR (SELECT count(*) FROM command_center.usce_tracker_claims WHERE wp_user_id=p_uid AND created_at>now()-interval '1 hour')>=4
    OR (SELECT count(*) FROM command_center.usce_tracker_claims WHERE intake_id=p_ref AND created_at>now()-interval '24 hours')>=6 THEN RETURN true; END IF;
  UPDATE command_center.usce_tracker_claims SET expires_at=now(),proof_hash=NULL WHERE wp_user_id=p_uid AND intake_id=p_ref AND expires_at>now();
  INSERT INTO command_center.usce_tracker_claims(wp_user_id,intake_id,email,expires_at) VALUES(p_uid,p_ref,normalized,now()+interval '15 minutes');
  RETURN true;
END $fn$;

-- The worker generates a random code in memory. Only its digest is retained, and a job
-- can be taken once even if the provider response is lost. A new challenge invalidates the old one.
CREATE FUNCTION command_center.usce_tracker_issue(p_hash text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE job command_center.usce_tracker_claims%ROWTYPE;
BEGIN
  IF p_hash IS NULL OR p_hash !~ '^[0-9a-f]{64}$' THEN RETURN '{}'::jsonb; END IF;
  DELETE FROM command_center.usce_tracker_claims WHERE expires_at<now()-interval '48 hours';
  SELECT c.* INTO job FROM command_center.usce_tracker_claims c
    JOIN command_center.usce_public_intake_requests r ON r.id=c.intake_id AND lower(btrim(r.email))=c.email
    WHERE c.issued_at IS NULL AND c.expires_at>now()+interval '1 minute'
      AND NOT EXISTS(SELECT FROM command_center.usce_tracker_account_cases b WHERE b.intake_request_id=c.intake_id)
    ORDER BY c.created_at,c.id LIMIT 1 FOR UPDATE OF c SKIP LOCKED;
  IF NOT FOUND THEN RETURN '{}'::jsonb; END IF;
  UPDATE command_center.usce_tracker_claims SET issued_at=now(),proof_hash=p_hash WHERE id=job.id;
  RETURN jsonb_build_object('id',job.id,'email',job.email,'reference',job.intake_id);
END $fn$;

CREATE FUNCTION command_center.usce_tracker_record_delivery(p_job uuid,p_outcome text,p_mid uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
BEGIN
  IF p_outcome IS NULL OR p_outcome NOT IN ('provider_accepted','failed','ambiguous') OR (p_outcome='provider_accepted')<>(p_mid IS NOT NULL) THEN RETURN false; END IF;
  UPDATE command_center.usce_tracker_claims SET delivery_outcome=p_outcome,provider_message_id=p_mid
    WHERE id=p_job AND issued_at IS NOT NULL AND delivery_outcome IS NULL;
  RETURN FOUND;
END $fn$;

CREATE FUNCTION command_center.usce_tracker_finish_claim(p_uid bigint,p_email text,p_ref uuid,p_hash text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE job command_center.usce_tracker_claims%ROWTYPE; normalized text:=lower(btrim(p_email));
BEGIN
  PERFORM 1 FROM command_center.usce_public_intake_requests WHERE id=p_ref AND lower(btrim(email))=normalized FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  SELECT * INTO job FROM command_center.usce_tracker_claims WHERE wp_user_id=p_uid AND email=normalized AND intake_id=p_ref
    AND consumed_at IS NULL AND expires_at>now() AND issued_at IS NOT NULL AND failures<5 ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  IF p_hash IS NULL OR p_hash IS DISTINCT FROM job.proof_hash OR job.proof_hash IS NULL THEN
    UPDATE command_center.usce_tracker_claims SET failures=failures+1 WHERE id=job.id;
    RETURN false;
  END IF;
  INSERT INTO command_center.usce_tracker_account_cases(intake_request_id,wp_user_id,confirmed_email)
    VALUES(p_ref,p_uid,normalized) ON CONFLICT(intake_request_id) DO NOTHING;
  IF NOT FOUND THEN RETURN false; END IF;
  UPDATE command_center.usce_tracker_claims SET consumed_at=now(),proof_hash=NULL WHERE id=job.id;
  RETURN true;
END $fn$;
REVOKE ALL ON FUNCTION command_center.usce_tracker_prepare(bigint,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION command_center.usce_tracker_prepare(bigint,text,text) TO service_role;
CREATE FUNCTION public.usce_tracker_prepare(p_uid bigint,p_email text,p_key text) RETURNS boolean LANGUAGE sql SECURITY INVOKER SET search_path=''
RETURN command_center.usce_tracker_prepare(p_uid,p_email,p_key);
REVOKE ALL ON FUNCTION public.usce_tracker_prepare(bigint,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.usce_tracker_prepare(bigint,text,text) TO service_role;
REVOKE ALL ON FUNCTION command_center.usce_tracker_request_claim(bigint,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION command_center.usce_tracker_request_claim(bigint,text,uuid) TO service_role;
CREATE FUNCTION public.usce_tracker_request_claim(p_uid bigint,p_email text,p_ref uuid) RETURNS boolean LANGUAGE sql SECURITY INVOKER SET search_path=''
RETURN command_center.usce_tracker_request_claim(p_uid,p_email,p_ref);
REVOKE ALL ON FUNCTION public.usce_tracker_request_claim(bigint,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.usce_tracker_request_claim(bigint,text,uuid) TO service_role;
REVOKE ALL ON FUNCTION command_center.usce_tracker_issue(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION command_center.usce_tracker_issue(text) TO service_role;
CREATE FUNCTION public.usce_tracker_issue(p_hash text) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path=''
RETURN command_center.usce_tracker_issue(p_hash);
REVOKE ALL ON FUNCTION public.usce_tracker_issue(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.usce_tracker_issue(text) TO service_role;
REVOKE ALL ON FUNCTION command_center.usce_tracker_finish_claim(bigint,text,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION command_center.usce_tracker_finish_claim(bigint,text,uuid,text) TO service_role;
CREATE FUNCTION public.usce_tracker_finish_claim(p_uid bigint,p_email text,p_ref uuid,p_hash text) RETURNS boolean LANGUAGE sql SECURITY INVOKER SET search_path=''
RETURN command_center.usce_tracker_finish_claim(p_uid,p_email,p_ref,p_hash);
REVOKE ALL ON FUNCTION public.usce_tracker_finish_claim(bigint,text,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.usce_tracker_finish_claim(bigint,text,uuid,text) TO service_role;
REVOKE ALL ON FUNCTION command_center.usce_tracker_record_delivery(uuid,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION command_center.usce_tracker_record_delivery(uuid,text,uuid) TO service_role;
CREATE FUNCTION public.usce_tracker_record_delivery(p_job uuid,p_outcome text,p_mid uuid) RETURNS boolean LANGUAGE sql SECURITY INVOKER SET search_path=''
RETURN command_center.usce_tracker_record_delivery(p_job,p_outcome,p_mid);
REVOKE ALL ON FUNCTION public.usce_tracker_record_delivery(uuid,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.usce_tracker_record_delivery(uuid,text,uuid) TO service_role;
