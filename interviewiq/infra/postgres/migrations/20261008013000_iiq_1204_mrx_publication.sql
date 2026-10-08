-- SOURCE CANDIDATE ONLY. Append-only MRX decisions/intents/owner receipts.
BEGIN;
SET LOCAL ROLE iiq_owner;
CREATE TABLE iiq.mrx_decisions (
 id uuid PRIMARY KEY, owner_id uuid NOT NULL REFERENCES iiq.actors(id), submission_id uuid NOT NULL REFERENCES iiq.research_submissions(id),
 review_id uuid NOT NULL REFERENCES iiq.review_items(id), review_version bigint NOT NULL CHECK(review_version>0),
 consent_id uuid NOT NULL REFERENCES iiq.consents(id), admin_id uuid NOT NULL REFERENCES iiq.actors(id),
 submission_sha256 text NOT NULL CHECK(submission_sha256 ~ '^[a-f0-9]{64}$'), program_id text NOT NULL, registry_release_id text NOT NULL,
 public_payload jsonb NOT NULL CHECK(jsonb_typeof(public_payload)='object' AND octet_length(public_payload::text)<=160000),
 payload_sha256 text NOT NULL CHECK(payload_sha256 ~ '^[a-f0-9]{64}$'), created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(review_id,review_version), UNIQUE(id,owner_id)
);
CREATE TABLE iiq.mrx_intents (
 id uuid PRIMARY KEY, owner_id uuid NOT NULL REFERENCES iiq.actors(id), decision_id uuid NOT NULL REFERENCES iiq.mrx_decisions(id),
 publication_id uuid NOT NULL REFERENCES iiq.mrx_decisions(id), operation text NOT NULL CHECK(operation IN('publish','retract')),
 binding jsonb NOT NULL CHECK(jsonb_typeof(binding)='object'), idempotency_key text NOT NULL UNIQUE CHECK(idempotency_key ~ '^[a-f0-9]{64}$'),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(), UNIQUE(decision_id,operation)
);
CREATE TABLE iiq.mrx_receipts (
 intent_id uuid PRIMARY KEY REFERENCES iiq.mrx_intents(id), owner_id uuid NOT NULL REFERENCES iiq.actors(id),
 receipt jsonb NOT NULL CHECK(jsonb_typeof(receipt)='object' AND octet_length(receipt::text)<=160000),
 sha256 text NOT NULL CHECK(sha256 ~ '^[a-f0-9]{64}$'), created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
DO $$ DECLARE n text; BEGIN FOREACH n IN ARRAY ARRAY['mrx_decisions','mrx_intents','mrx_receipts'] LOOP
 EXECUTE format('ALTER TABLE iiq.%I ENABLE ROW LEVEL SECURITY',n);EXECUTE format('ALTER TABLE iiq.%I FORCE ROW LEVEL SECURITY',n);
 EXECUTE format('REVOKE ALL ON iiq.%I FROM PUBLIC',n);EXECUTE format('GRANT SELECT,INSERT ON iiq.%I TO iiq_authenticated',n);
 EXECUTE format('CREATE POLICY mrx_read ON iiq.%I FOR SELECT TO iiq_authenticated USING(iiq.is_owner(owner_id) OR iiq.is_admin())',n);
 EXECUTE format('CREATE POLICY mrx_internal ON iiq.%I FOR ALL TO iiq_owner USING(iiq.authenticated()) WITH CHECK(iiq.authenticated())',n);
 EXECUTE format('CREATE TRIGGER mrx_immutable BEFORE UPDATE OR DELETE ON iiq.%I FOR EACH ROW EXECUTE FUNCTION iiq.reject_change()',n);
 END LOOP; END $$;
CREATE POLICY mrx_decision_admin ON iiq.mrx_decisions FOR INSERT TO iiq_authenticated WITH CHECK(iiq.is_admin() AND admin_id=iiq.actor_id());
CREATE POLICY mrx_intent_admin ON iiq.mrx_intents FOR INSERT TO iiq_authenticated WITH CHECK(iiq.is_admin() AND operation='publish');
CREATE POLICY mrx_receipt_write ON iiq.mrx_receipts FOR INSERT TO iiq_authenticated WITH CHECK(iiq.is_admin() OR (iiq.is_owner(owner_id) AND EXISTS(SELECT 1 FROM iiq.mrx_intents i WHERE i.id=intent_id AND i.operation='retract')));
CREATE POLICY mrx_source_internal ON iiq.research_submissions FOR SELECT TO iiq_owner USING(iiq.authenticated());
CREATE POLICY mrx_mission_internal ON iiq.research_missions FOR SELECT TO iiq_owner USING(iiq.authenticated());
CREATE POLICY mrx_outbox_internal ON iiq.outbox_events FOR ALL TO iiq_owner USING(iiq.authenticated() AND topic='rise.mrx_publication') WITH CHECK(iiq.authenticated() AND topic='rise.mrx_publication');
CREATE FUNCTION iiq.mrx_decision_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r iiq.review_items; s iiq.research_submissions; m iiq.research_missions;
BEGIN
 SELECT * INTO r FROM iiq.review_items WHERE id=NEW.review_id FOR SHARE;
 SELECT * INTO s FROM iiq.research_submissions WHERE id=NEW.submission_id;
 SELECT * INTO m FROM iiq.research_missions WHERE id=s.mission_id;
 IF NOT iiq.is_admin() OR NEW.admin_id<>iiq.actor_id() OR NEW.admin_id=NEW.owner_id OR r.owner_id IS DISTINCT FROM NEW.owner_id OR r.submission_id IS DISTINCT FROM s.id
 OR r.consent_id IS DISTINCT FROM NEW.consent_id OR r.version IS DISTINCT FROM NEW.review_version OR r.status<>'approved' OR r.quality_status<>'approved'
 OR s.owner_id IS DISTINCT FROM NEW.owner_id OR s.sha256 IS DISTINCT FROM NEW.submission_sha256 OR m.program_id IS DISTINCT FROM NEW.program_id
 OR m.standard_version<>'PROVISIONAL_MRX_V1' OR m.public_payload#>>'{program,registryReleaseId}' IS DISTINCT FROM NEW.registry_release_id
 OR NOT EXISTS(SELECT 1 FROM iiq.consents WHERE id=r.consent_id AND owner_id=r.owner_id AND status='active' AND scope='research_contribution')
 THEN RAISE EXCEPTION 'Current independent MRX review required' USING ERRCODE='42501'; END IF; RETURN NEW;
END $$;
CREATE TRIGGER mrx_decision_guard BEFORE INSERT ON iiq.mrx_decisions FOR EACH ROW EXECUTE FUNCTION iiq.mrx_decision_guard();
CREATE FUNCTION iiq.mrx_intent_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE d iiq.mrx_decisions; BEGIN SELECT * INTO d FROM iiq.mrx_decisions WHERE id=NEW.decision_id;
 IF d.id IS NULL OR d.owner_id<>NEW.owner_id OR NEW.publication_id<>d.id OR NEW.binding IS DISTINCT FROM jsonb_build_object(
 'intentId',NEW.id::text,'publicationId',d.id::text,'submissionId',d.submission_id::text,'submissionSha256',d.submission_sha256,
 'reviewId',d.review_id::text,'reviewVersion',d.review_version,'programId',d.program_id,'registryReleaseId',d.registry_release_id,
 'consentId',d.consent_id::text,'adminId',d.admin_id::text,'operation',NEW.operation,'idempotencyKey',NEW.idempotency_key,
 'payloadSha256',d.payload_sha256,'priorReceiptSha256',CASE NEW.operation WHEN 'publish' THEN repeat('0',64) ELSE d.payload_sha256 END)
 OR (NEW.operation='publish' AND (NOT iiq.is_admin() OR d.admin_id<>iiq.actor_id() OR NOT EXISTS(SELECT 1 FROM iiq.review_items r JOIN iiq.consents c ON c.id=r.consent_id WHERE r.id=d.review_id AND r.version=d.review_version AND r.status='approved' AND r.quality_status='approved' AND c.status='active')))
 OR (NEW.operation='retract' AND current_user<>'iiq_owner') THEN RAISE EXCEPTION 'Bound MRX intent required' USING ERRCODE='42501'; END IF;
 RETURN NEW; END $$;
CREATE TRIGGER mrx_intent_guard BEFORE INSERT ON iiq.mrx_intents FOR EACH ROW EXECUTE FUNCTION iiq.mrx_intent_guard();
-- A local revocation blocks the proof immediately. It also commits a durable
-- removal intent even if publication's HTTP response was lost. No network in SQL.
CREATE FUNCTION iiq.mrx_queue_retractions() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE p iiq.mrx_intents; newid uuid; key text; b jsonb; BEGIN
 IF NEW.version<>OLD.version OR NEW.status IN('withdrawn','retracted','rejected','repair_requested') OR NEW.quality_status<>'approved' THEN
 FOR p IN SELECT i.* FROM iiq.mrx_intents i JOIN iiq.mrx_decisions d ON d.id=i.decision_id WHERE d.review_id=NEW.id AND i.operation='publish' LOOP
  newid:=gen_random_uuid();key:=encode(pg_catalog.sha256(pg_catalog.convert_to('iiq-mrx-v1:retract:'||p.idempotency_key,'UTF8')),'hex');
  b:=p.binding||jsonb_build_object('intentId',newid::text,'operation','retract','idempotencyKey',key,'priorReceiptSha256',p.binding->>'payloadSha256');
  INSERT INTO iiq.mrx_intents(id,owner_id,decision_id,publication_id,operation,binding,idempotency_key) VALUES(newid,p.owner_id,p.decision_id,p.publication_id,'retract',b,key) ON CONFLICT(decision_id,operation) DO NOTHING;
 END LOOP; END IF; RETURN NEW; END $$;
CREATE TRIGGER mrx_review_retraction AFTER UPDATE ON iiq.review_items FOR EACH ROW EXECUTE FUNCTION iiq.mrx_queue_retractions();
CREATE FUNCTION iiq.mrx_enqueue_intent() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN INSERT INTO iiq.outbox_events(owner_id,topic,dedupe_key,payload) VALUES(NEW.owner_id,'rise.mrx_publication','mrx:'||NEW.idempotency_key,jsonb_build_object('intentId',NEW.id::text)) ON CONFLICT(dedupe_key) DO NOTHING; RETURN NEW; END $$;
CREATE TRIGGER mrx_enqueue AFTER INSERT ON iiq.mrx_intents FOR EACH ROW EXECUTE FUNCTION iiq.mrx_enqueue_intent();
CREATE FUNCTION iiq.mrx_receipt_queue() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN UPDATE iiq.outbox_events SET status='sent' WHERE topic='rise.mrx_publication' AND payload->>'intentId'=NEW.intent_id::text; RETURN NEW; END $$;
CREATE TRIGGER mrx_receipt_queue AFTER INSERT ON iiq.mrx_receipts FOR EACH ROW EXECUTE FUNCTION iiq.mrx_receipt_queue();
REVOKE ALL ON FUNCTION iiq.mrx_enqueue_intent(),iiq.mrx_receipt_queue() FROM PUBLIC;
-- Proof role sees only frozen binding/public digest and current decision state,
-- never original student text or the reviewed public payload.
GRANT SELECT(id,owner_id,submission_id,review_id,review_version,consent_id,admin_id,submission_sha256,program_id,registry_release_id,payload_sha256) ON iiq.mrx_decisions TO iiq_research_proof;
GRANT SELECT(id,decision_id,publication_id,operation,binding) ON iiq.mrx_intents TO iiq_research_proof;
GRANT SELECT(id,status,quality_status,version) ON iiq.review_items TO iiq_research_proof;
GRANT SELECT(id,status) ON iiq.consents TO iiq_research_proof;
CREATE POLICY mrx_proof_decisions ON iiq.mrx_decisions FOR SELECT TO iiq_research_proof USING(true);
CREATE POLICY mrx_proof_intents ON iiq.mrx_intents FOR SELECT TO iiq_research_proof USING(true);
CREATE POLICY mrx_proof_review ON iiq.review_items FOR SELECT TO iiq_research_proof USING(true);
CREATE POLICY mrx_proof_consent ON iiq.consents FOR SELECT TO iiq_research_proof USING(true);
ALTER TABLE iiq.research_proof_nonces DROP CONSTRAINT research_proof_nonces_issuer_check;
ALTER TABLE iiq.research_proof_nonces ADD CONSTRAINT research_proof_nonces_issuer_check CHECK(issuer IN('rise-research-proof','rise-mrx-proof'));
DROP POLICY proof_nonce_insert ON iiq.research_proof_nonces;
CREATE POLICY proof_nonce_insert ON iiq.research_proof_nonces FOR INSERT TO iiq_research_proof WITH CHECK(issuer IN('rise-research-proof','rise-mrx-proof'));
REVOKE ALL ON FUNCTION iiq.mrx_decision_guard(),iiq.mrx_intent_guard(),iiq.mrx_queue_retractions() FROM PUBLIC;
COMMIT;
