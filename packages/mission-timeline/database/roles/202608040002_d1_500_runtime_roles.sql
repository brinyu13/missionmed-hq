\set ON_ERROR_STOP on

-- Reassert the required safety attributes even when a provider pre-created a
-- role with unsafe defaults. These are group roles and never hold credentials.
alter role timeline_authenticated nologin nosuperuser nocreatedb nocreaterole noinherit nobypassrls;
alter role timeline_identity_sync nologin nosuperuser nocreatedb nocreaterole noinherit nobypassrls;
alter role timeline_grant_authority nologin nosuperuser nocreatedb nocreaterole noinherit nobypassrls;

-- Authority audits are append-only. The grant authority may insert the exact
-- authorization receipt and revoke its grant, but never mutate an audit event.
revoke update on timeline.audit_events from timeline_grant_authority;
