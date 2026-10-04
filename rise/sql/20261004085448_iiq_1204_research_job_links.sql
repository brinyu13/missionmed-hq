-- IIQ-1204 / DR-373 / DR-370. Expand only; existing user state is untouched.
-- Replay is verified through the private ledger; never reset existing tables.
BEGIN;

CREATE TABLE rise_runtime.iiq_research_job_links (
  owner_id uuid NOT NULL,
  request_id uuid NOT NULL,
  demand_id uuid NOT NULL,
  interview_id uuid NOT NULL,
  program_id text NOT NULL CHECK (length(program_id) BETWEEN 1 AND 180),
  release_id text NOT NULL REFERENCES rise_runtime.registry_releases(release_id),
  request_sha256 text NOT NULL CHECK (request_sha256 ~ '^[a-f0-9]{64}$'),
  subject_key text NOT NULL CHECK (subject_key ~ '^[a-f0-9]{64}$'),
  job_id uuid REFERENCES rise_runtime.research_jobs(job_id),
  disposition text NOT NULL CHECK (disposition IN ('JOB','NO_OP')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (owner_id,request_id),
  CHECK ((disposition='NO_OP' AND job_id IS NULL) OR (disposition='JOB' AND job_id IS NOT NULL))
);
CREATE INDEX iiq_research_links_job_idx ON rise_runtime.iiq_research_job_links(job_id);
CREATE TABLE rise_runtime.iiq_research_link_migrations (
  name text PRIMARY KEY,
  sql_sha256 text NOT NULL CHECK (sql_sha256 ~ '^[a-f0-9]{64}$'),
  schema_sha256 text NOT NULL CHECK (schema_sha256 ~ '^[a-f0-9]{64}$'),
  applied_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE rise_runtime.iiq_research_job_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE rise_runtime.iiq_research_job_links FORCE ROW LEVEL SECURITY;
ALTER TABLE rise_runtime.iiq_research_link_migrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE rise_runtime.iiq_research_link_migrations FORCE ROW LEVEL SECURITY;
REVOKE ALL ON rise_runtime.iiq_research_job_links,rise_runtime.iiq_research_link_migrations FROM PUBLIC;
CREATE POLICY iiq_research_link_read ON rise_runtime.iiq_research_job_links
  FOR SELECT TO rise_app_runtime USING (
    subject_key=current_setting('rise.subject_key',true) AND owner_id::text=current_setting('rise.iiq_owner_id',true));
CREATE POLICY iiq_research_link_insert ON rise_runtime.iiq_research_job_links
  FOR INSERT TO rise_app_runtime WITH CHECK (
    subject_key=current_setting('rise.subject_key',true) AND owner_id::text=current_setting('rise.iiq_owner_id',true));
GRANT SELECT,INSERT ON rise_runtime.iiq_research_job_links TO rise_app_runtime;

-- Runtime deliberately lacks UPDATE on registry/source_authorizations. This
-- private, read-and-lock-only capability fences rights without granting writes.
CREATE FUNCTION rise_runtime.iiq_lock_research_rights(wanted_release text, wanted_index text, wanted_rights text[])
RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $rights$
DECLARE release_row record; actual text[]; invalid boolean;
BEGIN
  IF wanted_release IS NULL OR length(wanted_release) NOT BETWEEN 1 AND 180
    OR wanted_index IS NULL OR wanted_index !~ '^[a-f0-9]{64}$'
    OR wanted_rights IS NULL OR cardinality(wanted_rights) NOT BETWEEN 1 AND 32
    OR EXISTS(SELECT 1 FROM unnest(wanted_rights) h WHERE h IS NULL OR h !~ '^[a-f0-9]{64}$')
    OR cardinality(wanted_rights)<>(SELECT count(DISTINCT h) FROM unnest(wanted_rights) h)
    OR NOT pg_has_role(session_user,'rise_app_runtime','MEMBER') THEN RETURN false; END IF;
  SELECT active,api_index_sha256 INTO release_row FROM rise_runtime.registry_releases
    WHERE release_id=wanted_release FOR UPDATE;
  IF NOT FOUND OR release_row.active IS DISTINCT FROM true OR release_row.api_index_sha256<>wanted_index THEN RETURN false; END IF;
  PERFORM 1 FROM rise_runtime.source_authorizations WHERE release_id=wanted_release ORDER BY source FOR SHARE;
  PERFORM 1 FROM rise_runtime.release_source_rights WHERE release_id=wanted_release ORDER BY source FOR SHARE;
  SELECT array_agg(DISTINCT authorization_sha256::text ORDER BY authorization_sha256::text),
    bool_or(revoked_at IS NOT NULL OR valid_through<current_date) INTO actual,invalid
    FROM (
      SELECT authorization_sha256,revoked_at,valid_through FROM rise_runtime.source_authorizations WHERE release_id=wanted_release
      UNION ALL
      SELECT authorization_sha256,revoked_at,valid_through FROM rise_runtime.release_source_rights WHERE release_id=wanted_release
    ) a;
  RETURN invalid IS FALSE AND actual=(SELECT array_agg(h ORDER BY h) FROM unnest(wanted_rights) h);
END
$rights$;
ALTER FUNCTION rise_runtime.iiq_lock_research_rights(text,text,text[]) OWNER TO postgres;
REVOKE ALL ON FUNCTION rise_runtime.iiq_lock_research_rights(text,text,text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION rise_runtime.iiq_lock_research_rights(text,text,text[]) TO rise_app_runtime;
-- Fail the whole additive transaction if inherited default grants would expose
-- either new table or the privileged lookup. Never change global defaults.
DO $acl_guard$
BEGIN
  IF EXISTS(
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a
    WHERE n.nspname='rise_runtime' AND c.relname IN ('iiq_research_job_links','iiq_research_link_migrations') AND a.grantee<>c.relowner
      AND NOT(c.relname='iiq_research_job_links' AND a.grantee='rise_app_runtime'::regrole AND a.privilege_type IN ('SELECT','INSERT') AND NOT a.is_grantable)
  ) OR EXISTS(
    SELECT 1 FROM pg_proc p CROSS JOIN LATERAL aclexplode(p.proacl) a
    WHERE p.oid='rise_runtime.iiq_lock_research_rights(text,text,text[])'::regprocedure AND a.grantee<>p.proowner
      AND NOT(a.grantee='rise_app_runtime'::regrole AND a.privilege_type='EXECUTE' AND NOT a.is_grantable)
  ) THEN RAISE EXCEPTION 'iiq_research_acl_unavailable'; END IF;
END
$acl_guard$;
COMMIT;
