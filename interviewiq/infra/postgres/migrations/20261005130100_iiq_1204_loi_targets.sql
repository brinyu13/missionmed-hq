-- IIQ-1204 consolidated Founder authority; SOURCE CANDIDATE ONLY.
-- Apply only after fresh target-bound backup, isolated restore and SQL approval.
BEGIN;
SET LOCAL ROLE iiq_owner;
SET LOCAL search_path = pg_catalog;

CREATE TABLE iiq.loi_targets (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 owner_id uuid NOT NULL REFERENCES iiq.actors(id),
 program_id text CHECK(program_id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,179}$'),
 program_name text NOT NULL DEFAULT '' CHECK(length(program_name)<=500),
 program_track text NOT NULL DEFAULT '' CHECK(length(program_track)<=300),
 registry_release_id text CHECK(length(registry_release_id)<=180),
 resolution_state text NOT NULL DEFAULT 'NOT_FOUND' CHECK(resolution_state IN ('MATCHED','NEEDS_CONFIRMATION','NOT_FOUND')),
 target_choice text NOT NULL DEFAULT 'MAYBE_LATER' CHECK(target_choice IN ('CREATE_LETTER','MAYBE_LATER','SKIP')),
 source_fingerprint text CHECK(source_fingerprint ~ '^[0-9a-f]{64}$'),
 sources jsonb NOT NULL DEFAULT '[]' CHECK(jsonb_typeof(sources)='array'),
 anchors jsonb NOT NULL DEFAULT '[]' CHECK(jsonb_typeof(anchors)='array'),
 merged_into_id uuid,
 version bigint NOT NULL DEFAULT 1 CHECK(version>0),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id,owner_id),
 UNIQUE(owner_id,source_fingerprint),
 FOREIGN KEY(merged_into_id,owner_id) REFERENCES iiq.loi_targets(id,owner_id),
 CHECK(merged_into_id IS NULL OR merged_into_id<>id),
 CHECK(updated_at>=created_at),
 CHECK((resolution_state='MATCHED' AND program_id IS NOT NULL AND registry_release_id IS NOT NULL AND length(program_name)>0)
   OR (resolution_state<>'MATCHED' AND program_id IS NULL AND registry_release_id IS NULL))
);
CREATE UNIQUE INDEX loi_targets_owner_program ON iiq.loi_targets(owner_id,program_id)
 WHERE program_id IS NOT NULL AND merged_into_id IS NULL;

CREATE TABLE iiq.loi_preferences (
 owner_id uuid PRIMARY KEY REFERENCES iiq.actors(id),
 default_approach text NOT NULL DEFAULT 'DIRECT_CONCISE' CHECK(default_approach IN
  ('WARM_PERSONAL','DIRECT_CONCISE','ACADEMIC_PROGRAM','POST_INTERVIEW','UPDATE_LED','STRONG_INTEREST')),
 version bigint NOT NULL DEFAULT 1 CHECK(version>0),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(updated_at>=created_at)
);

CREATE FUNCTION iiq.loi_target_preservation_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE prefix jsonb; n integer;
BEGIN
 IF TG_OP='UPDATE' THEN
  IF ROW(NEW.id,NEW.owner_id,NEW.created_at,NEW.source_fingerprint)
    IS DISTINCT FROM ROW(OLD.id,OLD.owner_id,OLD.created_at,OLD.source_fingerprint) THEN
   RAISE EXCEPTION 'LOI target identity and original source are immutable' USING ERRCODE='23514';
  END IF;
  n:=jsonb_array_length(OLD.anchors);
  SELECT coalesce(jsonb_agg(value ORDER BY ord),'[]'::jsonb) INTO prefix
   FROM jsonb_array_elements(NEW.anchors) WITH ORDINALITY AS e(value,ord) WHERE ord<=n;
  IF jsonb_array_length(NEW.anchors)<n OR prefix IS DISTINCT FROM OLD.anchors THEN
   RAISE EXCEPTION 'LOI history must preserve the exact prefix' USING ERRCODE='23514';
  END IF;
  n:=jsonb_array_length(OLD.sources);
  SELECT coalesce(jsonb_agg(value ORDER BY ord),'[]'::jsonb) INTO prefix
   FROM jsonb_array_elements(NEW.sources) WITH ORDINALITY AS e(value,ord) WHERE ord<=n;
  IF jsonb_array_length(NEW.sources)<n OR prefix IS DISTINCT FROM OLD.sources THEN
   RAISE EXCEPTION 'Original program sources must remain intact' USING ERRCODE='23514';
  END IF;
 END IF;
 IF NEW.merged_into_id IS NOT NULL AND NOT EXISTS(
  SELECT 1 FROM iiq.loi_targets t WHERE t.id=NEW.merged_into_id AND t.owner_id=NEW.owner_id
   AND t.merged_into_id IS NULL AND t.program_id=NEW.program_id AND t.resolution_state='MATCHED'
 ) THEN
  RAISE EXCEPTION 'Program merge requires the same owned canonical target' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER loi_target_preservation BEFORE INSERT OR UPDATE ON iiq.loi_targets
 FOR EACH ROW EXECUTE FUNCTION iiq.loi_target_preservation_guard();

ALTER TABLE iiq.loi_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE iiq.loi_targets FORCE ROW LEVEL SECURITY;
ALTER TABLE iiq.loi_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE iiq.loi_preferences FORCE ROW LEVEL SECURITY;
CREATE POLICY loi_targets_own ON iiq.loi_targets TO iiq_authenticated
 USING(iiq.is_owner(owner_id)) WITH CHECK(iiq.is_owner(owner_id));
CREATE POLICY loi_preferences_own ON iiq.loi_preferences TO iiq_authenticated
 USING(iiq.is_owner(owner_id)) WITH CHECK(iiq.is_owner(owner_id));
REVOKE ALL ON iiq.loi_targets,iiq.loi_preferences FROM PUBLIC;
GRANT SELECT,INSERT,UPDATE ON iiq.loi_targets,iiq.loi_preferences TO iiq_authenticated;
REVOKE ALL ON FUNCTION iiq.loi_target_preservation_guard() FROM PUBLIC;
COMMIT;
