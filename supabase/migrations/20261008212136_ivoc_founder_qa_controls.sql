-- Migration: 20261008212136_ivoc_founder_qa_controls.sql
-- Authority: IVOC-CONVERGE-8001 / DR-393 persistent Founder QA successor
-- Date: 2026-10-08
-- Depends on: none (independent service-only control row)
-- Description: Durable fail-closed QA budget and single-session reservation.
-- Idempotent: NO
BEGIN;
CREATE TABLE public.ivoc_founder_qa (
  id integer PRIMARY KEY CHECK (id = 1),
  revision bigint NOT NULL DEFAULT 0 CHECK (revision >= 0),
  state jsonb NOT NULL CHECK (jsonb_typeof(state) = 'object')
);
ALTER TABLE public.ivoc_founder_qa ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ivoc_founder_qa FROM PUBLIC, anon, authenticated;
GRANT SELECT, UPDATE ON public.ivoc_founder_qa TO service_role;
INSERT INTO public.ivoc_founder_qa(id,state) VALUES(1,
  '{"enabled":false,"reason":"budget_not_authorized","reservedSeconds":0,"sessionCount":0,"attempts":[],"active":null}'::jsonb);
COMMENT ON TABLE public.ivoc_founder_qa IS 'IVOC service-only Founder QA control. No browser grants. Revision CAS prevents concurrent reservations. Never reset budget or attempts on restart/deploy.';
COMMIT;
