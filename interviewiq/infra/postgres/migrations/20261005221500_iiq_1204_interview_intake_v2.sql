-- C202 SOURCE DRAFT ONLY. No primary or production apply authorization.
-- New optional intake snapshots are normalized, append-only, own-private.
BEGIN;
SET LOCAL ROLE iiq_owner;
SET LOCAL search_path=pg_catalog;
CREATE TABLE iiq.interview_intake_details (
 owner_id uuid NOT NULL, interview_id uuid NOT NULL, intake_version bigint NOT NULL CHECK(intake_version>0),
 registry_release_id text CHECK(length(registry_release_id)<=180), specialty text CHECK(length(specialty)<=180), acgme_id text CHECK(acgme_id ~ '^[0-9]{10}$'),
 position_type text NOT NULL DEFAULT 'UNKNOWN' CHECK(position_type IN ('CATEGORICAL','PRELIMINARY','TRANSITIONAL_YEAR','ADVANCED','RESERVED','OTHER','UNKNOWN')),
 student_track text NOT NULL DEFAULT '' CHECK(length(student_track)<=200),
 invitation_source text CHECK(invitation_source IN ('ERAS','THALAMUS','INTERVIEW_BROKER','EMAIL','OTHER','UNKNOWN')),
 platform text CHECK(platform IN ('ZOOM','WEBEX','TEAMS','THALAMUS','OTHER','UNKNOWN')),
 itinerary_state text CHECK(itinerary_state IN ('RECEIVED','NOT_YET','UNKNOWN')),
 pgy1_applied text CHECK(pgy1_applied IN ('YES','NO','UNSURE')),
 relationship_state text CHECK(relationship_state IN ('YES','NO','UNKNOWN')),
 application_state text CHECK(application_state IN ('APPLIED','NOT_APPLIED','UNSURE')),
 signal_state text CHECK(signal_state IN ('YES','NO','NA','UNSURE')),
 loi_temporal text CHECK(loi_temporal IN ('AFTER_LOI','NO','NOT_SENT','UNSURE')),
 priority text CHECK(priority IN ('HIGH','INTERESTED','EXPLORING','PREFER_NOT')),
 structure text CHECK(structure IN ('ONE_TO_ONE','PANEL','GROUP','OTHER','UNKNOWN')),
 location text CHECK(length(location)<=1000), coordinator_name text CHECK(length(coordinator_name)<=200),coordinator_contact text CHECK(length(coordinator_contact)<=500),
 structure_notes text CHECK(length(structure_notes)<=2000), private_notes text CHECK(length(private_notes)<=2000),
 match_cycle integer CHECK(match_cycle BETWEEN 2000 AND 2100), interview_count integer CHECK(interview_count BETWEEN 1 AND 30),
 prelim_target_id uuid, advanced_fact_confirmed boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(interview_id,owner_id,intake_version),
 FOREIGN KEY(interview_id,owner_id) REFERENCES iiq.interviews(id,owner_id),
 FOREIGN KEY(prelim_target_id,owner_id) REFERENCES iiq.loi_targets(id,owner_id),
 CHECK(NOT advanced_fact_confirmed OR (position_type='ADVANCED' AND pgy1_applied='YES' AND prelim_target_id IS NOT NULL))
);
CREATE TABLE iiq.interview_experiences (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL,interview_id uuid NOT NULL,intake_version bigint NOT NULL,
 ordinal integer NOT NULL CHECK(ordinal BETWEEN 0 AND 19),
 kind text NOT NULL CHECK(kind IN ('CLERKSHIP','SUB_INTERNSHIP','ELECTIVE','EXTERNSHIP','OBSERVERSHIP','RESEARCH','EMPLOYMENT','VOLUNTEER','AWAY_ROTATION','OTHER')),
 department text CHECK(length(department)<=300),start_date date,end_date date,
 description text NOT NULL CHECK(length(description) BETWEEN 1 AND 2000),contact text CHECK(length(contact)<=500),confirmed boolean NOT NULL CHECK(confirmed),
 created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(owner_id,interview_id,intake_version,ordinal),
 FOREIGN KEY(interview_id,owner_id,intake_version) REFERENCES iiq.interview_intake_details(interview_id,owner_id,intake_version),
 CHECK(start_date IS NULL OR end_date IS NULL OR start_date<=end_date)
);
-- Composite event-parent key is additive; no old IDs/content/schedule is changed.
ALTER TABLE iiq.related_events ADD CONSTRAINT related_events_intake_parent_key UNIQUE(id,interview_id,owner_id);
CREATE TABLE iiq.interview_event_details (
 owner_id uuid NOT NULL,interview_id uuid NOT NULL,event_id uuid NOT NULL,client_key uuid NOT NULL,
 event_kind text NOT NULL CHECK(event_kind IN ('MEET_GREET','DINNER','SOCIAL','OVERVIEW','SECOND_LOOK','OTHER')),
 format text NOT NULL CHECK(format IN ('unknown','virtual','in_person','hybrid','phone')),
 joining text NOT NULL DEFAULT '' CHECK(length(joining)<=4000),location text CHECK(length(location)<=1000),requirement text CHECK(requirement IN ('REQUIRED','OPTIONAL','UNKNOWN')),
 created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(event_id,owner_id),UNIQUE(owner_id,interview_id,client_key),
 FOREIGN KEY(event_id,interview_id,owner_id) REFERENCES iiq.related_events(id,interview_id,owner_id)
);
DO $$ DECLARE n text; BEGIN
 FOREACH n IN ARRAY ARRAY['interview_intake_details','interview_experiences','interview_event_details'] LOOP
 EXECUTE format('ALTER TABLE iiq.%I ENABLE ROW LEVEL SECURITY',n);
 EXECUTE format('ALTER TABLE iiq.%I FORCE ROW LEVEL SECURITY',n);
 EXECUTE format('REVOKE ALL ON TABLE iiq.%I FROM PUBLIC',n);
 EXECUTE format('GRANT SELECT,INSERT ON TABLE iiq.%I TO iiq_authenticated',n);
 EXECUTE format('CREATE POLICY owner_private ON iiq.%I FOR ALL TO iiq_authenticated USING(iiq.is_owner(owner_id)) WITH CHECK(iiq.is_owner(owner_id))',n);
 EXECUTE format('CREATE TRIGGER immutable BEFORE UPDATE OR DELETE ON iiq.%I FOR EACH ROW EXECUTE FUNCTION iiq.reject_change()',n);
 EXECUTE format('CREATE INDEX %I ON iiq.%I(owner_id,interview_id)',n||'_owner_parent_idx',n);
 END LOOP;
END $$;
COMMIT;
