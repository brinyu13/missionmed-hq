-- DR-373/370: additive origin evidence. Historical NULL is deliberately unknown.
BEGIN;
ALTER TABLE rise_runtime.iiq_research_job_links ADD COLUMN created_job boolean;
ALTER TABLE rise_runtime.iiq_research_job_links ADD CONSTRAINT iiq_research_origin_shape
  CHECK (created_job IS NOT TRUE OR (disposition='JOB' AND job_id IS NOT NULL));
CREATE UNIQUE INDEX iiq_research_single_origin_idx
  ON rise_runtime.iiq_research_job_links(job_id) WHERE created_job IS TRUE;

-- A private classification capability, not access to another student's links.
CREATE FUNCTION rise_runtime.iiq_research_origin_class(wanted_job uuid)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $origin$
DECLARE cursor_id uuid := wanted_job; visited uuid[] := ARRAY[]::uuid[];
  original record; current_job record; expected_root uuid;
  found_origin boolean := false; found_unknown boolean := false;
  own_origin boolean; unknown_origin boolean; invalid_origin boolean;
BEGIN
  IF wanted_job IS NULL OR NOT pg_has_role(session_user,'rise_app_runtime','MEMBER') THEN RETURN 'UNKNOWN'; END IF;
  SELECT * INTO original FROM rise_runtime.research_jobs WHERE job_id=wanted_job;
  IF NOT FOUND THEN RETURN 'UNKNOWN'; END IF;
  expected_root := original.root_job_id;
  FOR depth IN 1..16 LOOP
    IF cursor_id=ANY(visited) THEN RETURN 'UNKNOWN'; END IF;
    visited := array_append(visited,cursor_id);
    SELECT * INTO current_job FROM rise_runtime.research_jobs WHERE job_id=cursor_id;
    IF NOT FOUND OR current_job.release_id IS DISTINCT FROM original.release_id
      OR current_job.program_specialty_id IS DISTINCT FROM original.program_specialty_id
      OR current_job.requester_subject_key IS DISTINCT FROM original.requester_subject_key THEN RETURN 'UNKNOWN'; END IF;
    SELECT coalesce(bool_or(created_job IS TRUE),false),coalesce(bool_or(created_job IS NULL),false),
      coalesce(bool_or(created_job IS TRUE AND (subject_key IS DISTINCT FROM current_job.requester_subject_key
        OR program_id IS DISTINCT FROM current_job.program_specialty_id OR release_id IS DISTINCT FROM current_job.release_id)),false)
      INTO own_origin,unknown_origin,invalid_origin
      FROM rise_runtime.iiq_research_job_links WHERE job_id=cursor_id;
    IF invalid_origin THEN RETURN 'UNKNOWN'; END IF;
    found_origin := found_origin OR own_origin; found_unknown := found_unknown OR unknown_origin;
    IF current_job.parent_job_id IS NULL THEN
      IF (current_job.root_job_id IS NOT NULL AND current_job.root_job_id<>current_job.job_id)
        OR (expected_root IS NOT NULL AND expected_root<>current_job.job_id)
        OR (cardinality(visited)>1 AND current_job.root_job_id IS DISTINCT FROM expected_root) THEN RETURN 'UNKNOWN'; END IF;
      RETURN CASE WHEN found_origin THEN 'INTERVIEWIQ' WHEN found_unknown THEN 'UNKNOWN' ELSE 'GENERIC' END;
    END IF;
    IF expected_root IS NULL OR current_job.root_job_id IS DISTINCT FROM expected_root THEN RETURN 'UNKNOWN'; END IF;
    cursor_id := current_job.parent_job_id;
  END LOOP;
  RETURN 'UNKNOWN';
END
$origin$;
ALTER FUNCTION rise_runtime.iiq_research_origin_class(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION rise_runtime.iiq_research_origin_class(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION rise_runtime.iiq_research_origin_class(uuid) TO rise_app_runtime;
DO $acl_guard$
BEGIN
  IF EXISTS(SELECT 1 FROM pg_proc p CROSS JOIN LATERAL aclexplode(p.proacl) a
    WHERE p.oid='rise_runtime.iiq_research_origin_class(uuid)'::regprocedure AND a.grantee<>p.proowner
      AND NOT(a.grantee='rise_app_runtime'::regrole AND a.privilege_type='EXECUTE' AND NOT a.is_grantable))
  THEN RAISE EXCEPTION 'iiq_research_origin_acl_unavailable'; END IF;
END
$acl_guard$;
COMMIT;
