BEGIN;

CREATE TABLE public.sf_feature_flags (
  key text PRIMARY KEY,
  scope text NOT NULL DEFAULT 'off'
    CHECK (scope IN ('off','allowlist','cohort','eligible_all')),
  allowlist uuid[] NOT NULL DEFAULT '{}',
  cohorts text[] NOT NULL DEFAULT '{}',
  updated_by uuid NOT NULL REFERENCES public.sf_users(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.sf_feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sf_feature_flags FORCE ROW LEVEL SECURITY;

CREATE POLICY sf_feature_flags_admin_read ON public.sf_feature_flags
FOR SELECT TO authenticated
USING (public.sf_has_live_identity() AND public.sf_actor_role() = 'admin');

CREATE POLICY sf_feature_flags_admin_write ON public.sf_feature_flags
FOR UPDATE TO authenticated
USING (public.sf_has_live_identity() AND public.sf_actor_role() = 'admin')
WITH CHECK (public.sf_has_live_identity() AND public.sf_actor_role() = 'admin');

REVOKE ALL ON public.sf_feature_flags FROM PUBLIC, anon;
GRANT SELECT, UPDATE ON public.sf_feature_flags TO authenticated;
GRANT SELECT ON public.sf_feature_flags TO storyforge_app;
CREATE POLICY sf_feature_flags_service_read ON public.sf_feature_flags
FOR SELECT TO storyforge_app USING (true);
-- capability computation (E10) for non-admin callers reads through the service path.

SELECT set_config('storyforge.founder_user_id', :'founder_user_id', true);

INSERT INTO public.sf_feature_flags (key, scope, updated_by)
SELECT 'voice_capture', 'off', u.id
FROM public.sf_users u
WHERE u.id = current_setting('storyforge.founder_user_id')::uuid;

DO $$
BEGIN
  IF (SELECT count(*) FROM public.sf_feature_flags WHERE key = 'voice_capture') <> 1 THEN
    RAISE EXCEPTION 'voice_capture flag row was not seeded for the pinned founder';
  END IF;
  IF (
    SELECT updated_by <> current_setting('storyforge.founder_user_id')::uuid
    FROM public.sf_feature_flags
    WHERE key = 'voice_capture'
  ) THEN
    RAISE EXCEPTION 'voice_capture flag row was not attributed to the pinned founder';
  END IF;
END $$;

COMMIT;
