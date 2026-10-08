-- IIQ-1204 System6: additive append-only canonical media custody; no old rows changed.
BEGIN;
CREATE TABLE rise_runtime.program_media_candidates (
 id uuid PRIMARY KEY,program_id text NOT NULL,registry_release_id text NOT NULL,
 payload jsonb NOT NULL,content_sha256 text NOT NULL CHECK(content_sha256 ~ '^[a-f0-9]{64}$'),
 institution_snapshot jsonb NOT NULL,created_by text NOT NULL CHECK(created_by ~ '^[a-f0-9]{64}$'),
 request_id uuid NOT NULL UNIQUE,request_sha256 text NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(program_id,content_sha256),CHECK(payload#>>'{candidate,approvalState}'='CANDIDATE'),CHECK(payload#>>'{candidate,schema}'='iiq-program-media-candidate-v1')
);
CREATE TABLE rise_runtime.program_media_decisions (
 id uuid PRIMARY KEY,candidate_id uuid NOT NULL REFERENCES rise_runtime.program_media_candidates(id),version bigint NOT NULL CHECK(version>0),
 state text NOT NULL CHECK(state IN('UNDER_REVIEW','APPROVED','REJECTED','WITHDRAWN')),reason text NOT NULL,review jsonb,
 decided_by text NOT NULL CHECK(decided_by ~ '^[a-f0-9]{64}$'),request_id uuid NOT NULL UNIQUE,request_sha256 text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),UNIQUE(candidate_id,version),
 CHECK(state<>'APPROVED' OR review @> '{"explicitHumanApproval":true,"institutionVerified":true,"rightsVerified":true,"checksumVerified":true}')
);
CREATE TABLE rise_runtime.program_media_revisions (
 program_id text NOT NULL,version bigint NOT NULL CHECK(version>0),candidate_id uuid NOT NULL REFERENCES rise_runtime.program_media_candidates(id),
 decision_id uuid NOT NULL UNIQUE REFERENCES rise_runtime.program_media_decisions(id),state text NOT NULL CHECK(state IN('APPROVED','WITHDRAWN','REJECTED')),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),PRIMARY KEY(program_id,version)
);
CREATE INDEX media_revisions_candidate ON rise_runtime.program_media_revisions(candidate_id);
DO $$ DECLARE n text;BEGIN FOREACH n IN ARRAY ARRAY['program_media_candidates','program_media_decisions','program_media_revisions'] LOOP
 EXECUTE format('ALTER TABLE rise_runtime.%I ENABLE ROW LEVEL SECURITY',n);EXECUTE format('ALTER TABLE rise_runtime.%I FORCE ROW LEVEL SECURITY',n);
 EXECUTE format('REVOKE ALL ON rise_runtime.%I FROM PUBLIC',n);EXECUTE format('GRANT SELECT,INSERT ON rise_runtime.%I TO rise_app_runtime',n);
 EXECUTE format('CREATE POLICY media_admin ON rise_runtime.%I FOR ALL TO rise_app_runtime USING(current_setting(''rise.is_admin'',true)=''true'') WITH CHECK(current_setting(''rise.is_admin'',true)=''true'')',n);
 END LOOP;END $$;
CREATE FUNCTION rise_runtime.program_media_immutable() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$ BEGIN RAISE EXCEPTION 'Canonical media custody is append-only' USING ERRCODE='42501';END $$;
REVOKE ALL ON FUNCTION rise_runtime.program_media_immutable() FROM PUBLIC;
CREATE TRIGGER media_candidate_immutable BEFORE UPDATE OR DELETE ON rise_runtime.program_media_candidates FOR EACH ROW EXECUTE FUNCTION rise_runtime.program_media_immutable();
CREATE TRIGGER media_decision_immutable BEFORE UPDATE OR DELETE ON rise_runtime.program_media_decisions FOR EACH ROW EXECUTE FUNCTION rise_runtime.program_media_immutable();
CREATE TRIGGER media_revision_immutable BEFORE UPDATE OR DELETE ON rise_runtime.program_media_revisions FOR EACH ROW EXECUTE FUNCTION rise_runtime.program_media_immutable();
COMMIT;
