-- IIQ-1204 A9: expand-only. Never adopt an existing role or backfill guessed grants.
-- Production requires the separate target-bound preservation/SQL approval gate.
BEGIN;
CREATE ROLE iiq_research_proof NOLOGIN NOINHERIT NOBYPASSRLS NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
SET LOCAL ROLE iiq_owner;
SET LOCAL search_path = pg_catalog;

CREATE TABLE iiq.research_job_grants (
 request_id uuid PRIMARY KEY,
 owner_id uuid NOT NULL, demand_id uuid NOT NULL, interview_id uuid NOT NULL,
 program_id text NOT NULL CHECK(program_id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,179}$'),
 registry_release_id text NOT NULL CHECK(registry_release_id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,179}$'),
 request_sha256 text NOT NULL CHECK(request_sha256 ~ '^[a-f0-9]{64}$'),
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(demand_id,owner_id) REFERENCES iiq.research_demands(id,owner_id),
 FOREIGN KEY(interview_id,owner_id) REFERENCES iiq.interviews(id,owner_id)
);
CREATE INDEX research_job_grants_owner_idx ON iiq.research_job_grants(owner_id);
ALTER TABLE iiq.research_job_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE iiq.research_job_grants FORCE ROW LEVEL SECURITY;
REVOKE ALL ON iiq.research_job_grants FROM PUBLIC,iiq_authenticated,iiq_worker,iiq_research_proof;
GRANT SELECT,INSERT ON iiq.research_job_grants TO iiq_authenticated;
CREATE POLICY grant_owner_read ON iiq.research_job_grants FOR SELECT TO iiq_authenticated
 USING(iiq.is_owner(owner_id));
CREATE POLICY grant_current_insert ON iiq.research_job_grants FOR INSERT TO iiq_authenticated
 WITH CHECK(iiq.is_owner(owner_id) AND EXISTS(
  SELECT 1 FROM iiq.research_demands d JOIN iiq.interviews i ON i.id=d.interview_id AND i.owner_id=d.owner_id
  WHERE d.id=research_job_grants.demand_id AND d.owner_id=research_job_grants.owner_id
   AND d.interview_id=research_job_grants.interview_id AND d.program_id=research_job_grants.program_id
   AND d.external_request_id=research_job_grants.request_id::text AND i.program_id=d.program_id));

CREATE TABLE iiq.research_proof_nonces (
 issuer text NOT NULL CHECK(issuer='rise-research-proof'), nonce uuid NOT NULL,
 request_sha256 text NOT NULL CHECK(request_sha256 ~ '^[a-f0-9]{64}$'),
 created_at timestamptz NOT NULL, expires_at timestamptz NOT NULL,
 PRIMARY KEY(issuer,nonce), CHECK(expires_at>=created_at+interval '90 seconds')
);
ALTER TABLE iiq.research_proof_nonces ENABLE ROW LEVEL SECURITY;
ALTER TABLE iiq.research_proof_nonces FORCE ROW LEVEL SECURITY;
REVOKE ALL ON iiq.research_proof_nonces FROM PUBLIC,iiq_authenticated,iiq_worker,iiq_research_proof;
GRANT USAGE ON SCHEMA iiq TO iiq_research_proof;
GRANT SELECT(id,wp_user_id) ON iiq.actors TO iiq_research_proof;
GRANT SELECT(id,owner_id,program_id,status) ON iiq.interviews TO iiq_research_proof;
GRANT SELECT(id,owner_id,interview_id,program_id,external_request_id) ON iiq.research_demands TO iiq_research_proof;
GRANT SELECT(request_id,owner_id,demand_id,interview_id,program_id,registry_release_id,request_sha256)
 ON iiq.research_job_grants TO iiq_research_proof;
GRANT INSERT(issuer,nonce,request_sha256,created_at,expires_at),SELECT(nonce)
 ON iiq.research_proof_nonces TO iiq_research_proof;
CREATE POLICY proof_identity_read ON iiq.actors FOR SELECT TO iiq_research_proof USING(true);
CREATE POLICY proof_interview_read ON iiq.interviews FOR SELECT TO iiq_research_proof USING(true);
CREATE POLICY proof_demand_read ON iiq.research_demands FOR SELECT TO iiq_research_proof USING(true);
CREATE POLICY proof_grant_read ON iiq.research_job_grants FOR SELECT TO iiq_research_proof USING(true);
CREATE POLICY proof_nonce_insert ON iiq.research_proof_nonces FOR INSERT TO iiq_research_proof
 WITH CHECK(issuer='rise-research-proof');
CREATE POLICY proof_nonce_read ON iiq.research_proof_nonces FOR SELECT TO iiq_research_proof USING(true);
COMMIT;
