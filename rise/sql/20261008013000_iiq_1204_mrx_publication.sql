-- SOURCE CANDIDATE ONLY. Dedicated public research, never STUDENT_INTEL.
BEGIN;
ALTER TABLE rise_runtime.canonical_evidence_sources DROP CONSTRAINT canonical_evidence_sources_provider_check;
ALTER TABLE rise_runtime.canonical_evidence_sources ADD CONSTRAINT canonical_evidence_sources_provider_check CHECK(provider IN('PARALLEL','CLAUDE_OPUS','CLAUDE_SONNET','OPENAI','NRMP_SOAP_CLOSURE','STUDENT_INTEL','MISSIONMED_REVIEW','MRX_PUBLIC_RESEARCH'));
ALTER TABLE rise_runtime.provider_ingest_runs DROP CONSTRAINT provider_ingest_runs_provider_check;
ALTER TABLE rise_runtime.provider_ingest_runs ADD CONSTRAINT provider_ingest_runs_provider_check CHECK(provider IN('PARALLEL','CLAUDE_OPUS','CLAUDE_SONNET','OPENAI','NRMP_SOAP_CLOSURE','MRX_PUBLIC_RESEARCH'));
ALTER TABLE rise_runtime.provider_ingest_runs ADD CONSTRAINT mrx_zero_spend CHECK(provider<>'MRX_PUBLIC_RESEARCH' OR new_spend_usd=0);
CREATE TABLE rise_runtime.iiq_mrx_publications (
 publication_id uuid PRIMARY KEY, submission_sha256 text NOT NULL CHECK(submission_sha256 ~ '^[a-f0-9]{64}$'),
 payload_sha256 text NOT NULL CHECK(payload_sha256 ~ '^[a-f0-9]{64}$'), program_id text NOT NULL, registry_release_id text NOT NULL,
 binding jsonb NOT NULL CHECK(jsonb_typeof(binding)='object'), created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE rise_runtime.iiq_mrx_operations (
 idempotency_key text PRIMARY KEY CHECK(idempotency_key ~ '^[a-f0-9]{64}$'), publication_id uuid NOT NULL,
 operation text NOT NULL CHECK(operation IN('publish','retract')), request_sha256 text NOT NULL CHECK(request_sha256 ~ '^[a-f0-9]{64}$'),
 status text NOT NULL CHECK(status IN('published','conflicted','retracted')), claims jsonb NOT NULL CHECK(jsonb_typeof(claims)='array'),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(), UNIQUE(publication_id,operation)
);
-- A removal tombstone may precede an uncertain publication response. It never
-- creates canonical facts; subsequent publication cannot resurrect that lineage.
CREATE TABLE rise_runtime.iiq_mrx_claim_links (
 publication_id uuid NOT NULL REFERENCES rise_runtime.iiq_mrx_publications(publication_id),
 claim_id text NOT NULL REFERENCES rise_runtime.canonical_evidence_claims(claim_id),
 source_claim_id text NOT NULL REFERENCES rise_runtime.canonical_evidence_claims(claim_id),
 PRIMARY KEY(publication_id,claim_id,source_claim_id)
);
DO $$ DECLARE n text; BEGIN FOREACH n IN ARRAY ARRAY['iiq_mrx_publications','iiq_mrx_operations','iiq_mrx_claim_links'] LOOP
 EXECUTE format('ALTER TABLE rise_runtime.%I ENABLE ROW LEVEL SECURITY',n);EXECUTE format('ALTER TABLE rise_runtime.%I FORCE ROW LEVEL SECURITY',n);
 EXECUTE format('REVOKE ALL ON rise_runtime.%I FROM PUBLIC',n);EXECUTE format('GRANT SELECT,INSERT ON rise_runtime.%I TO rise_app_runtime',n);
 EXECUTE format('CREATE POLICY mrx_admin ON rise_runtime.%I FOR ALL TO rise_app_runtime USING(current_setting(''rise.is_admin'',true)=''true'') WITH CHECK(current_setting(''rise.is_admin'',true)=''true'')',n);
 EXECUTE format('CREATE TRIGGER mrx_immutable BEFORE UPDATE OR DELETE ON rise_runtime.%I FOR EACH ROW EXECUTE FUNCTION rise_runtime.reject_canonical_evidence_mutation()',n);
 END LOOP; END $$;
-- Only canonical claim links/removal IDs are readable by ordinary public-fact
-- readers; service bindings, contributor identities and review packets stay admin.
CREATE POLICY mrx_links_public ON rise_runtime.iiq_mrx_claim_links FOR SELECT TO rise_app_runtime USING(true);
CREATE POLICY mrx_removals_public ON rise_runtime.iiq_mrx_operations FOR SELECT TO rise_app_runtime USING(operation='retract');
CREATE OR REPLACE VIEW rise_runtime.canonical_current_facts WITH(security_invoker=true,security_barrier=true) AS
 SELECT DISTINCT ON(c.subject_id,c.field) c.claim_id,c.subject_id,c.field,c.knowledge,c.canonical_value,c.assertion_class,c.publication_state,c.source_id,c.observed_period,c.retrieved_at,c.content_sha256
 FROM rise_runtime.canonical_evidence_claims c
 WHERE c.review_state='APPROVED' AND c.conflict_state<>'CONFLICTING' AND c.publication_state IN('STUDENT_VISIBLE','PRIVATE_BETA')
 AND NOT EXISTS(SELECT 1 FROM rise_runtime.iiq_mrx_claim_links l JOIN rise_runtime.iiq_mrx_operations o ON o.publication_id=l.publication_id AND o.operation='retract' WHERE l.claim_id=c.claim_id)
 ORDER BY c.subject_id,c.field,c.retrieved_at DESC,c.created_at DESC,c.claim_id;
DROP POLICY rise_canonical_claims_projection ON rise_runtime.canonical_evidence_claims;
CREATE POLICY rise_canonical_claims_projection ON rise_runtime.canonical_evidence_claims FOR SELECT TO rise_app_runtime USING(
 current_setting('rise.is_admin',true)='true' OR (publication_state IN('STUDENT_VISIBLE','PRIVATE_BETA') AND NOT EXISTS(
 SELECT 1 FROM rise_runtime.iiq_mrx_claim_links l JOIN rise_runtime.iiq_mrx_operations o ON o.publication_id=l.publication_id AND o.operation='retract' WHERE l.claim_id=canonical_evidence_claims.claim_id)));
COMMIT;
