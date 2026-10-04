-- IIQ-1204 / DR-374 bounded paid execution custody; additive protected state.
BEGIN;
CREATE TABLE rise_runtime.iiq_research_executions (
 job_id uuid PRIMARY KEY REFERENCES rise_runtime.research_jobs(job_id) ON DELETE RESTRICT,
 owner_id uuid NOT NULL, request_id uuid NOT NULL,
 subject_key text NOT NULL CHECK(subject_key ~ '^[a-f0-9]{64}$'),
 binding jsonb NOT NULL CHECK(jsonb_typeof(binding)='object'),
 request_sha256 text NOT NULL CHECK(request_sha256 ~ '^[a-f0-9]{64}$'),
 provider_key text NOT NULL CHECK(provider_key IN ('OPENAI_TERRA','OPENAI_SOL')),
 model_key text NOT NULL CHECK((provider_key='OPENAI_TERRA' AND model_key='gpt-5.6-terra') OR (provider_key='OPENAI_SOL' AND model_key='gpt-5.6-sol')),
 job_snapshot jsonb NOT NULL CHECK(jsonb_typeof(job_snapshot)='object'),
 snapshot_sha256 text NOT NULL CHECK(snapshot_sha256=encode(sha256(convert_to(job_snapshot::text,'UTF8')),'hex')),
 dispatch_id uuid NOT NULL UNIQUE,
 dispatch_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 worker_id text NOT NULL CHECK(length(worker_id) BETWEEN 1 AND 128),
 lease_token uuid NOT NULL,
 lease_fence bigint NOT NULL DEFAULT 1 CHECK(lease_fence>0),
 lease_until timestamptz NOT NULL,
 state text NOT NULL CHECK(state IN ('DISPATCHED','RAW_CAPTURED','QUARANTINED','COMPLETED')),
 raw_body bytea, raw_sha256 text, http_status integer, received_at timestamptz,
 completion_receipt jsonb, error_code text CHECK(error_code IS NULL OR error_code ~ '^[A-Z0-9_]{1,64}$'),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(owner_id,request_id),
 FOREIGN KEY(owner_id,request_id) REFERENCES rise_runtime.iiq_research_job_links(owner_id,request_id) ON DELETE RESTRICT,
 CHECK((raw_body IS NULL AND raw_sha256 IS NULL AND http_status IS NULL AND received_at IS NULL) OR
   (raw_body IS NOT NULL AND raw_sha256 IS NOT NULL AND http_status IS NOT NULL AND http_status BETWEEN 100 AND 599 AND received_at IS NOT NULL
    AND octet_length(raw_body) BETWEEN 1 AND 8388608 AND raw_sha256=encode(sha256(raw_body),'hex'))),
 CHECK((state='COMPLETED' AND raw_body IS NOT NULL AND completion_receipt IS NOT NULL AND jsonb_typeof(completion_receipt)='object') OR
   (state<>'COMPLETED' AND completion_receipt IS NULL)),
 CHECK(state<>'RAW_CAPTURED' OR raw_body IS NOT NULL)
);
ALTER TABLE rise_runtime.iiq_research_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE rise_runtime.iiq_research_executions FORCE ROW LEVEL SECURITY;
REVOKE ALL ON rise_runtime.iiq_research_executions FROM PUBLIC;
CREATE POLICY iiq_execution_read ON rise_runtime.iiq_research_executions FOR SELECT TO rise_app_runtime USING (
 subject_key=current_setting('rise.subject_key',true) AND owner_id::text=current_setting('rise.iiq_owner_id',true) AND job_id::text=current_setting('rise.iiq_job_id',true));
CREATE POLICY iiq_execution_insert ON rise_runtime.iiq_research_executions FOR INSERT TO rise_app_runtime WITH CHECK (
 subject_key=current_setting('rise.subject_key',true) AND owner_id::text=current_setting('rise.iiq_owner_id',true) AND job_id::text=current_setting('rise.iiq_job_id',true));
CREATE POLICY iiq_execution_update ON rise_runtime.iiq_research_executions FOR UPDATE TO rise_app_runtime USING (
 subject_key=current_setting('rise.subject_key',true) AND owner_id::text=current_setting('rise.iiq_owner_id',true) AND job_id::text=current_setting('rise.iiq_job_id',true)) WITH CHECK (
 subject_key=current_setting('rise.subject_key',true) AND owner_id::text=current_setting('rise.iiq_owner_id',true) AND job_id::text=current_setting('rise.iiq_job_id',true));
GRANT SELECT,INSERT ON rise_runtime.iiq_research_executions TO rise_app_runtime;
GRANT UPDATE(worker_id,lease_token,lease_fence,lease_until,state,raw_body,raw_sha256,http_status,received_at,completion_receipt,error_code,updated_at) ON rise_runtime.iiq_research_executions TO rise_app_runtime;
CREATE FUNCTION rise_runtime.iiq_execution_preserve() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $preserve$
DECLARE link record; job record;
BEGIN
 IF TG_OP='INSERT' THEN
  SELECT * INTO link FROM rise_runtime.iiq_research_job_links WHERE owner_id=NEW.owner_id AND request_id=NEW.request_id;
  SELECT * INTO job FROM rise_runtime.research_jobs WHERE job_id=NEW.job_id;
  IF link.created_job IS DISTINCT FROM true OR link.job_id IS DISTINCT FROM NEW.job_id OR link.subject_key IS DISTINCT FROM NEW.subject_key
   OR link.request_sha256 IS DISTINCT FROM NEW.request_sha256 OR job.requester_subject_key IS DISTINCT FROM NEW.subject_key
   OR job.provider_key IS DISTINCT FROM NEW.provider_key OR job.model_key IS DISTINCT FROM NEW.model_key
   OR job.program_specialty_id IS DISTINCT FROM link.program_id OR job.release_id IS DISTINCT FROM link.release_id
   OR NEW.binding IS DISTINCT FROM jsonb_build_object('ownerId',link.owner_id,'requestId',link.request_id,'demandId',link.demand_id,'interviewId',link.interview_id,'programId',link.program_id,'registryReleaseId',link.release_id)
   OR NEW.job_snapshot IS DISTINCT FROM jsonb_build_object('jobId',job.job_id,'programSpecialtyId',job.program_specialty_id,'acgmeId',job.acgme_id,'specialty',job.specialty,'state',job.state_code,'taskClass',job.task_class,'providerKey',job.provider_key,'modelKey',job.model_key,'taskPayload',coalesce(job.task_payload,'{}'::jsonb))
   OR NEW.state<>'DISPATCHED' OR NEW.lease_fence<>1 OR NEW.raw_body IS NOT NULL OR NEW.completion_receipt IS NOT NULL
   THEN RAISE EXCEPTION 'iiq_execution_binding_invalid'; END IF;
 ELSE
  IF (to_jsonb(NEW)-ARRAY['worker_id','lease_token','lease_fence','lease_until','state','raw_body','raw_sha256','http_status','received_at','completion_receipt','error_code','updated_at'])
     IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['worker_id','lease_token','lease_fence','lease_until','state','raw_body','raw_sha256','http_status','received_at','completion_receipt','error_code','updated_at'])
   THEN RAISE EXCEPTION 'iiq_execution_original_immutable'; END IF;
  IF OLD.state='COMPLETED' AND NEW IS DISTINCT FROM OLD THEN RAISE EXCEPTION 'iiq_execution_completed_immutable'; END IF;
  IF OLD.raw_body IS NOT NULL AND (NEW.raw_body,NEW.raw_sha256,NEW.http_status,NEW.received_at) IS DISTINCT FROM (OLD.raw_body,OLD.raw_sha256,OLD.http_status,OLD.received_at)
   THEN RAISE EXCEPTION 'iiq_execution_raw_immutable'; END IF;
  IF NEW.lease_fence NOT IN (OLD.lease_fence,OLD.lease_fence+1) OR (NEW.lease_fence=OLD.lease_fence+1 AND (OLD.raw_body IS NULL OR OLD.lease_until>clock_timestamp()))
   OR (NEW.lease_fence=OLD.lease_fence AND (NEW.worker_id,NEW.lease_token) IS DISTINCT FROM (OLD.worker_id,OLD.lease_token))
   OR (NEW.lease_fence=OLD.lease_fence+1 AND NEW.lease_token=OLD.lease_token)
   THEN RAISE EXCEPTION 'iiq_execution_fence_invalid'; END IF;
  IF NEW.state='COMPLETED' AND OLD.state<>'RAW_CAPTURED' THEN RAISE EXCEPTION 'iiq_execution_completion_invalid'; END IF;
  IF NEW.state='DISPATCHED' AND OLD.state<>'DISPATCHED' THEN RAISE EXCEPTION 'iiq_execution_redispatch_forbidden'; END IF;
 END IF;
 RETURN NEW;
END
$preserve$;
ALTER FUNCTION rise_runtime.iiq_execution_preserve() OWNER TO postgres;
REVOKE ALL ON FUNCTION rise_runtime.iiq_execution_preserve() FROM PUBLIC;
CREATE TRIGGER iiq_execution_preserve BEFORE INSERT OR UPDATE ON rise_runtime.iiq_research_executions FOR EACH ROW EXECUTE FUNCTION rise_runtime.iiq_execution_preserve();
DO $acl$
BEGIN
 IF EXISTS(SELECT 1 FROM pg_class c CROSS JOIN LATERAL aclexplode(c.relacl) a WHERE c.oid='rise_runtime.iiq_research_executions'::regclass AND a.grantee<>c.relowner AND NOT(a.grantee='rise_app_runtime'::regrole AND a.privilege_type IN ('SELECT','INSERT') AND NOT a.is_grantable))
 THEN RAISE EXCEPTION 'iiq_execution_acl_unavailable'; END IF;
END
$acl$;
COMMIT;
