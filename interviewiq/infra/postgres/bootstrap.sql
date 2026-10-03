-- IIQ-1200. Run only against the independently approved isolated IIQ database.
-- No credentials, live data, existing product schemas or Supabase history.
BEGIN;
DO $$
DECLARE name text;
BEGIN
  FOREACH name IN ARRAY ARRAY['iiq_owner','iiq_authenticated','iiq_worker'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname=name) THEN
      EXECUTE format('CREATE ROLE %I NOLOGIN NOINHERIT NOBYPASSRLS NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION',name);
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname=name AND
      (rolcanlogin OR rolinherit OR rolbypassrls OR rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication)) THEN
      RAISE EXCEPTION 'IIQ role attributes do not match approved least privilege: %',name;
    END IF;
  END LOOP;
END $$;
-- Only the migration connection receives owner membership. Runtime login
-- membership must be provisioned separately as iiq_authenticated WITH INHERIT FALSE.
GRANT iiq_owner TO CURRENT_USER WITH INHERIT FALSE, SET TRUE;
CREATE SCHEMA IF NOT EXISTS iiq AUTHORIZATION iiq_owner;
DO $$ BEGIN
  IF (SELECT nspowner::regrole::text FROM pg_namespace WHERE nspname='iiq') <> 'iiq_owner' THEN
    RAISE EXCEPTION 'Unexpected pre-existing IIQ schema owner';
  END IF;
END $$;
REVOKE ALL ON SCHEMA iiq FROM PUBLIC;
GRANT USAGE ON SCHEMA iiq TO iiq_authenticated, iiq_worker;
COMMIT;
