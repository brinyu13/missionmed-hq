-- C219 UNAPPLIED SOURCE DRAFT. Requires accepted C202 draft separately.
-- No primary migration assignment/backfill/production execution is authorized.
BEGIN;
SET LOCAL ROLE iiq_owner;
SET LOCAL search_path=pg_catalog;
CREATE FUNCTION iiq.calendar_requester() RETURNS boolean LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT iiq.authenticated() AND current_setting('iiq.calendar_admitted',true)=iiq.actor_id()::text
 AND (iiq.is_admin() OR (iiq.actor_role()='student' AND current_setting('iiq.tier',true) IN ('360','ivprep_complete'))) $$;
CREATE FUNCTION iiq.calendar_target(subject uuid) RETURNS boolean LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT iiq.is_admin() AND iiq.calendar_requester() AND current_setting('iiq.admin_target_id',true)=subject::text $$;
REVOKE ALL ON FUNCTION iiq.calendar_requester(),iiq.calendar_target(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION iiq.calendar_requester(),iiq.calendar_target(uuid) TO iiq_authenticated;
-- Narrow admin writes to admitted logistics only; old private/LOI policies unchanged.
DO $$ DECLARE n text; BEGIN
 FOREACH n IN ARRAY ARRAY['interviews','related_events','interview_history','revisions'] LOOP
 EXECUTE format('CREATE POLICY calendar_admin_read ON iiq.%I FOR SELECT TO iiq_authenticated USING(iiq.calendar_target(owner_id))',n);
 EXECUTE format('CREATE POLICY calendar_admin_insert ON iiq.%I FOR INSERT TO iiq_authenticated WITH CHECK(iiq.calendar_target(owner_id))',n);
 IF n IN ('interviews','related_events') THEN
 EXECUTE format('CREATE POLICY calendar_admin_update ON iiq.%I FOR UPDATE TO iiq_authenticated USING(iiq.calendar_target(owner_id)) WITH CHECK(iiq.calendar_target(owner_id))',n);
 END IF;
 END LOOP;
END $$;
CREATE TABLE iiq.calendar_projection (
 event_ref uuid PRIMARY KEY DEFAULT gen_random_uuid(),owner_id uuid NOT NULL,wp_user_id bigint NOT NULL CHECK(wp_user_id>0),
 interview_id uuid NOT NULL,source_event_id uuid,event_type text NOT NULL CHECK(event_type IN ('INTERVIEW','SOCIAL','DEADLINE','OTHER')),
 program_id text NOT NULL CHECK(length(program_id) BETWEEN 1 AND 180),program_name text NOT NULL CHECK(length(program_name) BETWEEN 1 AND 500),
 specialty text NOT NULL DEFAULT '' CHECK(length(specialty)<=180),track text NOT NULL DEFAULT '' CHECK(length(track)<=300),
 local_date date NOT NULL,local_time time,timezone text NOT NULL,start_at timestamptz,fold smallint,all_day boolean NOT NULL,
 format text NOT NULL CHECK(format IN ('unknown','virtual','in_person','hybrid','phone')),lifecycle text NOT NULL CHECK(lifecycle IN ('offered','scheduled','awaiting_confirmation','completed','cancelled','postponed','declined','no_show','waitlisted')),
 visible boolean NOT NULL DEFAULT true,
 FOREIGN KEY(interview_id,owner_id) REFERENCES iiq.interviews(id,owner_id),
 FOREIGN KEY(source_event_id,interview_id,owner_id) REFERENCES iiq.related_events(id,interview_id,owner_id),
 CHECK(iiq.schedule_valid(local_date,local_time,timezone,start_at,fold,all_day)),CHECK((event_type='INTERVIEW')=(source_event_id IS NULL)),
 UNIQUE NULLS NOT DISTINCT(owner_id,interview_id,source_event_id)
);
CREATE INDEX calendar_projection_page ON iiq.calendar_projection(local_date,event_ref) WHERE visible;
ALTER TABLE iiq.calendar_projection ENABLE ROW LEVEL SECURITY;ALTER TABLE iiq.calendar_projection FORCE ROW LEVEL SECURITY;
REVOKE ALL ON iiq.calendar_projection FROM PUBLIC;
GRANT SELECT,INSERT,UPDATE ON iiq.calendar_projection TO iiq_authenticated;
CREATE POLICY projection_owner ON iiq.calendar_projection FOR ALL TO iiq_authenticated USING(iiq.is_owner(owner_id) OR iiq.calendar_target(owner_id)) WITH CHECK(iiq.is_owner(owner_id) OR iiq.calendar_target(owner_id));
-- Owner role can read ONLY this new typed projection. No legacy RLS bypass.
CREATE POLICY projection_reader ON iiq.calendar_projection FOR SELECT TO iiq_owner USING(iiq.calendar_requester());
CREATE FUNCTION iiq.calendar_candidates(first_day date,last_day date,after_day date,after_ref uuid,selected_ref uuid DEFAULT NULL)
RETURNS TABLE(event_ref uuid,owner_id uuid,wp_user_id bigint,interview_id uuid,source_event_id uuid,local_date date)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$ BEGIN
 IF NOT coalesce(iiq.calendar_requester(),false) OR first_day IS NULL OR last_day IS NULL OR last_day<first_day OR last_day-first_day>=90
 OR (after_day IS NULL)<>(after_ref IS NULL) OR (after_day IS NOT NULL AND (after_day<first_day OR after_day>last_day))
 OR (selected_ref IS NOT NULL AND NOT iiq.is_admin()) THEN RAISE EXCEPTION 'calendar bounds denied' USING ERRCODE='42501'; END IF;
 RETURN QUERY SELECT p.event_ref,p.owner_id,p.wp_user_id,p.interview_id,p.source_event_id,p.local_date
 FROM iiq.calendar_projection p WHERE (selected_ref IS NOT NULL AND p.event_ref=selected_ref OR selected_ref IS NULL AND p.visible AND p.local_date BETWEEN first_day AND last_day AND p.owner_id<>iiq.actor_id())
 AND (after_day IS NULL OR (p.local_date,p.event_ref)>(after_day,after_ref)) ORDER BY p.local_date,p.event_ref LIMIT 200;
 END $$;
CREATE FUNCTION iiq.calendar_public(first_day date,last_day date,after_day date,after_ref uuid,admitted jsonb)
RETURNS TABLE(event_ref uuid,program_id text,program_name text,specialty text,track text,local_date date,local_time time,timezone text,start_at timestamptz,fold smallint,all_day boolean,format text,event_type text,lifecycle text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$ BEGIN
 IF NOT coalesce(iiq.calendar_requester(),false) OR first_day IS NULL OR last_day IS NULL OR last_day<first_day OR last_day-first_day>=90 OR jsonb_typeof(admitted)<>'array' OR jsonb_array_length(admitted)>200
 OR (after_day IS NULL)<>(after_ref IS NULL) OR (after_day IS NOT NULL AND (after_day<first_day OR after_day>last_day)) THEN RAISE EXCEPTION 'calendar bounds denied' USING ERRCODE='42501'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(admitted) e WHERE jsonb_typeof(e)<>'object' OR (SELECT count(*) FROM jsonb_object_keys(e))<>2 OR NOT e?'subject' OR NOT e?'wp_user_id' OR jsonb_typeof(e->'subject')<>'string' OR jsonb_typeof(e->'wp_user_id')<>'number' OR e->>'wp_user_id'!~'^[1-9][0-9]*$' OR e->>'subject'!~'^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$')
 OR (SELECT count(DISTINCT e->>'subject') FROM jsonb_array_elements(admitted) e)<>jsonb_array_length(admitted) THEN RAISE EXCEPTION 'calendar pairs denied' USING ERRCODE='42501'; END IF;
 RETURN QUERY SELECT p.event_ref,p.program_id,p.program_name,p.specialty,p.track,p.local_date,p.local_time,p.timezone,p.start_at,p.fold,p.all_day,p.format,p.event_type,p.lifecycle
 FROM iiq.calendar_projection p WHERE p.visible AND p.owner_id<>iiq.actor_id() AND p.local_date BETWEEN first_day AND last_day
 AND (after_day IS NULL OR (p.local_date,p.event_ref)>(after_day,after_ref)) AND EXISTS(SELECT 1 FROM jsonb_array_elements(admitted) e WHERE e->>'subject'=p.owner_id::text AND (e->>'wp_user_id')::bigint=p.wp_user_id)
 ORDER BY p.local_date,p.event_ref LIMIT 200;
 END $$;
REVOKE ALL ON FUNCTION iiq.calendar_candidates(date,date,date,uuid,uuid),iiq.calendar_public(date,date,date,uuid,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION iiq.calendar_candidates(date,date,date,uuid,uuid),iiq.calendar_public(date,date,date,uuid,jsonb) TO iiq_authenticated;
CREATE TABLE iiq.itinerary_files (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),owner_id uuid NOT NULL,interview_id uuid NOT NULL,file_version integer NOT NULL CHECK(file_version BETWEEN 1 AND 10),
 previous_id uuid,request_id uuid NOT NULL,request_digest text NOT NULL CHECK(request_digest~'^[a-f0-9]{64}$'),uploader_id uuid NOT NULL REFERENCES iiq.actors(id),
 sha256 text NOT NULL CHECK(sha256~'^[a-f0-9]{64}$'),format text NOT NULL CHECK(format IN ('PDF','PNG','JPEG')),byte_size integer NOT NULL CHECK(byte_size BETWEEN 1 AND 5242880),bytes bytea NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(id,interview_id,owner_id),UNIQUE(owner_id,interview_id,file_version),UNIQUE(uploader_id,owner_id,request_id),
 FOREIGN KEY(interview_id,owner_id) REFERENCES iiq.interviews(id,owner_id),FOREIGN KEY(previous_id,interview_id,owner_id) REFERENCES iiq.itinerary_files(id,interview_id,owner_id),CHECK(octet_length(bytes)=byte_size),CHECK(encode(sha256(bytes),'hex')=sha256)
);
CREATE TABLE iiq.itinerary_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),owner_id uuid NOT NULL,interview_id uuid NOT NULL,file_id uuid NOT NULL,actor_id uuid NOT NULL REFERENCES iiq.actors(id),
 action text NOT NULL CHECK(action='WITHDRAW'),request_id uuid NOT NULL,request_digest text NOT NULL CHECK(request_digest~'^[a-f0-9]{64}$'),created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(actor_id,owner_id,request_id),FOREIGN KEY(file_id,interview_id,owner_id) REFERENCES iiq.itinerary_files(id,interview_id,owner_id)
);
CREATE TABLE iiq.calendar_admin_receipts (
 actor_id uuid NOT NULL REFERENCES iiq.actors(id),owner_id uuid NOT NULL REFERENCES iiq.actors(id),request_id uuid NOT NULL,digest text NOT NULL CHECK(digest~'^[a-f0-9]{64}$'),result_id uuid NOT NULL,
 before_revision bigint NOT NULL,after_revision bigint NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(actor_id,owner_id,request_id)
);
DO $$ DECLARE n text; BEGIN
 FOREACH n IN ARRAY ARRAY['itinerary_files','itinerary_events','calendar_admin_receipts'] LOOP
 EXECUTE format('ALTER TABLE iiq.%I ENABLE ROW LEVEL SECURITY',n);EXECUTE format('ALTER TABLE iiq.%I FORCE ROW LEVEL SECURITY',n);
 EXECUTE format('REVOKE ALL ON iiq.%I FROM PUBLIC',n);EXECUTE format('GRANT SELECT,INSERT ON iiq.%I TO iiq_authenticated',n);
 IF n='calendar_admin_receipts' THEN
 EXECUTE format('CREATE POLICY admitted_admin ON iiq.%I FOR ALL TO iiq_authenticated USING(iiq.calendar_target(owner_id) AND actor_id=iiq.actor_id()) WITH CHECK(iiq.calendar_target(owner_id) AND actor_id=iiq.actor_id())',n);
 ELSE EXECUTE format('CREATE POLICY owner_or_target ON iiq.%I FOR ALL TO iiq_authenticated USING((iiq.actor_role()=''student'' AND iiq.is_owner(owner_id)) OR iiq.calendar_target(owner_id)) WITH CHECK((iiq.actor_role()=''student'' AND iiq.is_owner(owner_id)) OR iiq.calendar_target(owner_id))',n); END IF;
 EXECUTE format('CREATE TRIGGER immutable BEFORE UPDATE OR DELETE ON iiq.%I FOR EACH ROW EXECUTE FUNCTION iiq.reject_change()',n);
 END LOOP;
END $$;
-- Quotas are also enforced at DB write boundary under the same per-owner lock.
CREATE FUNCTION iiq.itinerary_quota() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$ DECLARE n bigint;total bigint; BEGIN
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(NEW.owner_id::text,0));
 SELECT count(*),coalesce(sum(byte_size),0) INTO n,total FROM iiq.itinerary_files WHERE owner_id=NEW.owner_id AND interview_id=NEW.interview_id;
 IF n>=10 OR total+NEW.byte_size>52428800 THEN RAISE EXCEPTION 'itinerary interview quota' USING ERRCODE='23514'; END IF;
 SELECT coalesce(sum(byte_size),0) INTO total FROM iiq.itinerary_files WHERE owner_id=NEW.owner_id;
 IF total+NEW.byte_size>104857600 OR NEW.file_version<>n+1 OR NEW.uploader_id<>iiq.actor_id() THEN RAISE EXCEPTION 'itinerary owner quota or identity' USING ERRCODE='23514'; END IF; RETURN NEW; END $$;
CREATE TRIGGER quota BEFORE INSERT ON iiq.itinerary_files FOR EACH ROW EXECUTE FUNCTION iiq.itinerary_quota();
ALTER TABLE iiq.interview_intake_details ADD COLUMN invitation_received_date date,ADD COLUMN status_detail text CHECK(status_detail IN ('WAITLISTED','PROGRAM_CANCELLED','STUDENT_CANCELLED','DECLINED'));
ALTER TABLE iiq.interview_intake_details DROP CONSTRAINT interview_intake_details_invitation_source_check;
ALTER TABLE iiq.interview_intake_details ADD CONSTRAINT interview_intake_details_invitation_source_check CHECK(invitation_source IN ('ERAS','THALAMUS','INTERVIEW_BROKER','EMAIL','PHONE','OTHER','UNKNOWN'));
ALTER TABLE iiq.interview_intake_details DROP CONSTRAINT interview_intake_details_structure_check;
ALTER TABLE iiq.interview_intake_details ADD CONSTRAINT interview_intake_details_structure_check CHECK(structure IN ('ONE_TO_ONE','PANEL','GROUP','MMI','OTHER','UNKNOWN'));
REVOKE ALL ON FUNCTION iiq.itinerary_quota() FROM PUBLIC;
COMMIT;
