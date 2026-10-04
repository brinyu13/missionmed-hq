-- Migration: 20261004045129_iiq_1204_rise_owner_nonce.sql
-- Authority: IIQ-1204 / DR-373 / DR-367 / DR-370
-- Date: 2026-10-04
-- Depends on: verified existing rise_runtime schema and rise_app_runtime role
-- Description: Private durable InterviewIQ replay admission and dedicated seam ledger
-- Idempotent: NO (reviewed runner verifies exact ledger and catalog on replay)

BEGIN;

CREATE TABLE rise_runtime.iiq_owner_request_nonces (
  issuer text NOT NULL CHECK (issuer = 'interviewiq'),
  nonce uuid NOT NULL,
  request_sha256 text NOT NULL CHECK (request_sha256 ~ '^[a-f0-9]{64}$'),
  created_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  PRIMARY KEY (issuer, nonce),
  CHECK (expires_at >= created_at + interval '90 seconds')
);

CREATE TABLE rise_runtime.iiq_owner_migrations (
  name text PRIMARY KEY CHECK (name ~ '^[0-9]{14}_[a-z0-9_]+\.sql$'),
  sql_sha256 text NOT NULL CHECK (sql_sha256 ~ '^[a-f0-9]{64}$'),
  schema_sha256 text NOT NULL CHECK (schema_sha256 ~ '^[a-f0-9]{64}$'),
  applied_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

ALTER TABLE rise_runtime.iiq_owner_request_nonces ENABLE ROW LEVEL SECURITY;
ALTER TABLE rise_runtime.iiq_owner_request_nonces FORCE ROW LEVEL SECURITY;
ALTER TABLE rise_runtime.iiq_owner_migrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE rise_runtime.iiq_owner_migrations FORCE ROW LEVEL SECURITY;

-- Clear possible default ACL exposure on ONLY these newly created tables.
-- Existing roles, tables, schema permissions and default privileges are unchanged.
DO $acl$
DECLARE entry record;
BEGIN
  FOR entry IN
    SELECT DISTINCT c.relname, r.rolname
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    CROSS JOIN LATERAL aclexplode(c.relacl) a
    JOIN pg_roles r ON r.oid=a.grantee
    WHERE n.nspname='rise_runtime'
      AND c.relname IN ('iiq_owner_request_nonces','iiq_owner_migrations')
      AND a.grantee<>c.relowner
  LOOP
    EXECUTE format('REVOKE ALL ON TABLE rise_runtime.%I FROM %I',entry.relname,entry.rolname);
  END LOOP;
END
$acl$;
REVOKE ALL ON rise_runtime.iiq_owner_request_nonces, rise_runtime.iiq_owner_migrations FROM PUBLIC;

CREATE POLICY iiq_owner_nonce_insert ON rise_runtime.iiq_owner_request_nonces
  FOR INSERT TO rise_app_runtime WITH CHECK (issuer = 'interviewiq');
CREATE POLICY iiq_owner_nonce_read ON rise_runtime.iiq_owner_request_nonces
  FOR SELECT TO rise_app_runtime USING (issuer = 'interviewiq');
GRANT SELECT, INSERT ON rise_runtime.iiq_owner_request_nonces TO rise_app_runtime;

COMMIT;
