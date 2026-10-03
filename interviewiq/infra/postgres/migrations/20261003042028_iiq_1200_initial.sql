-- IIQ-1200 / DR-364/365. Additive isolated interview-domain schema.
-- Reviewed source candidate: NOT a production apply receipt.
-- Requires bootstrap.sql and a dedicated privileged migration connection.
BEGIN;
SET LOCAL ROLE iiq_owner;
SET LOCAL search_path = pg_catalog;

CREATE FUNCTION iiq.actor_id() RETURNS uuid LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT nullif(current_setting('iiq.actor_id',true),'')::uuid $$;
CREATE FUNCTION iiq.actor_role() RETURNS text LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT nullif(current_setting('iiq.role',true),'') $$;
CREATE FUNCTION iiq.authenticated() RETURNS boolean LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT coalesce(iiq.actor_id() IS NOT NULL AND nullif(current_setting('iiq.wp_user_id',true),'')::bigint>0
   AND iiq.actor_role() IN ('student','mentor','admin'),false) $$;
CREATE FUNCTION iiq.is_owner(subject uuid) RETURNS boolean LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT iiq.authenticated() AND subject=iiq.actor_id() $$;
CREATE FUNCTION iiq.is_admin() RETURNS boolean LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT iiq.authenticated() AND iiq.actor_role()='admin' $$;
CREATE FUNCTION iiq.is_assigned(subject uuid) RETURNS boolean LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT iiq.authenticated() AND iiq.actor_role()='mentor'
  AND coalesce(nullif(current_setting('iiq.assignments',true),'')::jsonb,'[]'::jsonb) @> jsonb_build_array(subject::text) $$;

CREATE FUNCTION iiq.schedule_valid(d date,t time without time zone,z text,instant timestamptz,f smallint,whole_day boolean)
RETURNS boolean LANGUAGE plpgsql STABLE SET search_path='' AS $$
DECLARE candidates timestamptz[];
BEGIN
  IF d IS NULL THEN RETURN t IS NULL AND instant IS NULL AND f IS NULL AND NOT whole_day; END IF;
  IF z IS NULL OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_timezone_names WHERE name=z) THEN RETURN false; END IF;
  IF whole_day THEN RETURN t IS NULL AND instant IS NULL AND f IS NULL; END IF;
  IF t IS NULL OR instant IS NULL THEN RETURN false; END IF;
  -- Current/future civil schedules use quarter-hour offsets. Enumerating UTC
  -- candidates catches gaps and forces explicit selection of ambiguous folds.
  SELECT array_agg(x ORDER BY x) INTO candidates FROM (
    SELECT ((d+t) AT TIME ZONE 'UTC')+(g*interval '15 minutes') AS x
    FROM pg_catalog.generate_series(-56,56) g
  ) q WHERE x AT TIME ZONE z=d+t;
  IF cardinality(candidates)=1 THEN RETURN instant=candidates[1] AND (f IS NULL OR f=0); END IF;
  IF cardinality(candidates)=2 THEN RETURN f IS NOT NULL AND f IN (0,1) AND instant=candidates[f+1]; END IF;
  RETURN false;
END $$;

CREATE TABLE iiq.actors (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), wp_user_id bigint NOT NULL UNIQUE CHECK(wp_user_id>0),
 display_name text NOT NULL DEFAULT '' CHECK(length(display_name)<=200),
 version bigint NOT NULL DEFAULT 1 CHECK(version>0), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE iiq.interviews (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL REFERENCES iiq.actors(id),
 program_id text CHECK(length(program_id)<=200), program_name text NOT NULL DEFAULT '' CHECK(length(program_name)<=500),
 program_track text NOT NULL DEFAULT '' CHECK(length(program_track)<=300), unresolved_input text NOT NULL DEFAULT '' CHECK(length(unresolved_input)<=1000),
 status text NOT NULL DEFAULT 'offered' CHECK(status IN ('offered','scheduled','awaiting_confirmation','completed','cancelled','postponed','declined','no_show','waitlisted')),
 received_at timestamptz NOT NULL DEFAULT now(), deadline_at timestamptz, deadline_date date,
 local_date date, local_time time, timezone text, start_at timestamptz, fold smallint CHECK(fold IN (0,1)), all_day boolean NOT NULL DEFAULT false,
 duration_minutes integer CHECK(duration_minutes BETWEEN 1 AND 1440), duration_precision text NOT NULL DEFAULT 'unknown' CHECK(duration_precision IN ('unknown','estimated','exact')),
 travel_minutes integer CHECK(travel_minutes BETWEEN 0 AND 10080), format text NOT NULL DEFAULT 'unknown' CHECK(format IN ('unknown','virtual','in_person','hybrid','phone')),
 joining text NOT NULL DEFAULT '' CHECK(length(joining)<=4000), joining_verified boolean NOT NULL DEFAULT false, confirmed_occurred boolean,
 previous_schedule jsonb CHECK(previous_schedule IS NULL OR jsonb_typeof(previous_schedule)='object'),
 version bigint NOT NULL DEFAULT 1 CHECK(version>0), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id,owner_id), CHECK(iiq.schedule_valid(local_date,local_time,timezone,start_at,fold,all_day)),
 CHECK((duration_minutes IS NULL)=(duration_precision='unknown')),
 CHECK(status<>'completed' OR confirmed_occurred IS TRUE)
);
CREATE INDEX interviews_owner_start_idx ON iiq.interviews(owner_id,start_at);
CREATE INDEX interviews_owner_status_idx ON iiq.interviews(owner_id,status);
CREATE TABLE iiq.related_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL, interview_id uuid NOT NULL,
 kind text NOT NULL CHECK(kind IN ('social','deadline','other')), title text NOT NULL CHECK(length(title) BETWEEN 1 AND 500), note text NOT NULL DEFAULT '' CHECK(length(note)<=4000),
 local_date date NOT NULL, local_time time, timezone text NOT NULL, start_at timestamptz, fold smallint CHECK(fold IN (0,1)), all_day boolean NOT NULL DEFAULT false,
 duration_minutes integer CHECK(duration_minutes BETWEEN 1 AND 1440), status text NOT NULL DEFAULT 'scheduled' CHECK(status IN ('scheduled','cancelled')),
 version bigint NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id,owner_id), FOREIGN KEY(interview_id,owner_id) REFERENCES iiq.interviews(id,owner_id),
 CHECK(iiq.schedule_valid(local_date,local_time,timezone,start_at,fold,all_day))
);
CREATE TABLE iiq.interview_history (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL, interview_id uuid NOT NULL,
 event_type text NOT NULL CHECK(length(event_type) BETWEEN 1 AND 80), details jsonb NOT NULL DEFAULT '{}' CHECK(jsonb_typeof(details)='object'), created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(interview_id,owner_id) REFERENCES iiq.interviews(id,owner_id)
);
CREATE TABLE iiq.research_demands (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL, interview_id uuid NOT NULL UNIQUE, program_id text,
 status text NOT NULL DEFAULT 'waiting_identity' CHECK(status IN ('waiting_identity','queued','researching','review','partial','available','outage','failed')),
 external_request_id text, requested_at timestamptz NOT NULL DEFAULT now(), refreshed_at timestamptz, last_error_code text CHECK(length(last_error_code)<=100),
 version bigint NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id,owner_id), FOREIGN KEY(interview_id,owner_id) REFERENCES iiq.interviews(id,owner_id)
);
CREATE TABLE iiq.preparation (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL, interview_id uuid NOT NULL UNIQUE,
 why_program text NOT NULL DEFAULT '' CHECK(length(why_program)<=30000), anchors jsonb NOT NULL DEFAULT '[]' CHECK(jsonb_typeof(anchors)='array'),
 questions jsonb NOT NULL DEFAULT '[]' CHECK(jsonb_typeof(questions)='array'), basis jsonb NOT NULL DEFAULT '{}' CHECK(jsonb_typeof(basis)='object'), context_revision bigint NOT NULL DEFAULT 0 CHECK(context_revision>=0),
 version bigint NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id,owner_id), FOREIGN KEY(interview_id,owner_id) REFERENCES iiq.interviews(id,owner_id)
);
CREATE TABLE iiq.practice_attempts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL, interview_id uuid NOT NULL,
 external_session_id text UNIQUE, program_id text, question text NOT NULL DEFAULT '', confirmed_goal text NOT NULL DEFAULT '',
 answer text NOT NULL DEFAULT '', diagnosis text NOT NULL DEFAULT '', specific_change text NOT NULL DEFAULT '', retry_answer text NOT NULL DEFAULT '', reflection text NOT NULL DEFAULT '',
 summary jsonb NOT NULL DEFAULT '{}' CHECK(jsonb_typeof(summary)='object'), context_basis jsonb NOT NULL DEFAULT '{}' CHECK(jsonb_typeof(context_basis)='object'),
 status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','launched','completed','revoked')),
 version bigint NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id,owner_id), FOREIGN KEY(interview_id,owner_id) REFERENCES iiq.interviews(id,owner_id)
);
CREATE TABLE iiq.learning_signals (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL REFERENCES iiq.actors(id), interview_id uuid,
 source_kind text NOT NULL CHECK(source_kind IN ('debrief','practice','student')), source_id uuid,
 statement text NOT NULL CHECK(length(statement) BETWEEN 1 AND 4000), next_change text NOT NULL DEFAULT '' CHECK(length(next_change)<=4000),
 status text NOT NULL DEFAULT 'proposed' CHECK(status IN ('proposed','confirmed','revoked')), mentor_visible boolean NOT NULL DEFAULT false,
 confirmed_at timestamptz, revoked_at timestamptz,
 version bigint NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id,owner_id), FOREIGN KEY(interview_id,owner_id) REFERENCES iiq.interviews(id,owner_id),
 CHECK(status<>'confirmed' OR confirmed_at IS NOT NULL), CHECK(status<>'revoked' OR revoked_at IS NOT NULL)
);
CREATE TABLE iiq.mentor_gaps (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL, interview_id uuid NOT NULL UNIQUE,
 research_state text NOT NULL DEFAULT 'waiting_identity', preparation_saved boolean NOT NULL DEFAULT false,
 question_count integer NOT NULL DEFAULT 0 CHECK(question_count>=0), practice_count integer NOT NULL DEFAULT 0 CHECK(practice_count>=0),
 debrief_state text NOT NULL DEFAULT 'not_started' CHECK(debrief_state IN ('not_started','in_progress','complete','not_applicable')),
 followup_state text NOT NULL DEFAULT 'none' CHECK(followup_state IN ('none','open','complete')),
 version bigint NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id,owner_id), FOREIGN KEY(interview_id,owner_id) REFERENCES iiq.interviews(id,owner_id)
);
CREATE TABLE iiq.recording_sessions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL, interview_id uuid NOT NULL,
 status text NOT NULL DEFAULT 'created' CHECK(status IN ('created','listening','paused','completed','failed','abandoned')),
 mime_type text NOT NULL, provider text, client_session_key text NOT NULL CHECK(length(client_session_key) BETWEEN 1 AND 150),
 next_sequence integer NOT NULL DEFAULT 0 CHECK(next_sequence>=0), last_error_code text CHECK(length(last_error_code)<=100),
 version bigint NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id,owner_id), UNIQUE(id,interview_id,owner_id), UNIQUE(owner_id,client_session_key),
 FOREIGN KEY(interview_id,owner_id) REFERENCES iiq.interviews(id,owner_id)
);
CREATE TABLE iiq.recording_chunks (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL, interview_id uuid NOT NULL, recording_session_id uuid NOT NULL,
 sequence integer NOT NULL CHECK(sequence>=0), client_segment_key text NOT NULL CHECK(length(client_segment_key) BETWEEN 1 AND 150),
 sha256 text NOT NULL CHECK(sha256 ~ '^[0-9a-f]{64}$'), mime_type text NOT NULL, byte_count integer NOT NULL CHECK(byte_count BETWEEN 1 AND 26214400),
 duration_ms integer NOT NULL CHECK(duration_ms BETWEEN 1 AND 600000), object_key text NOT NULL CHECK(length(object_key) BETWEEN 1 AND 1000 AND object_key !~ '^[a-z]+://'),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','transcribing','complete','failed')), provider_attempts integer NOT NULL DEFAULT 0 CHECK(provider_attempts>=0), last_error_code text CHECK(length(last_error_code)<=100),
 version bigint NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id,owner_id), UNIQUE(id,recording_session_id,interview_id,owner_id), UNIQUE(recording_session_id,sequence), UNIQUE(owner_id,client_segment_key),
 FOREIGN KEY(recording_session_id,interview_id,owner_id) REFERENCES iiq.recording_sessions(id,interview_id,owner_id)
);
CREATE TABLE iiq.speech_segments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL, interview_id uuid NOT NULL, recording_session_id uuid NOT NULL,
 chunk_id uuid NOT NULL UNIQUE, sequence integer NOT NULL CHECK(sequence>=0), client_segment_key text NOT NULL,
 transcript text NOT NULL CHECK(length(transcript)<=100000), audio_object_key text, sha256 text NOT NULL CHECK(sha256 ~ '^[0-9a-f]{64}$'),
 provider text NOT NULL, model text NOT NULL, started_at timestamptz, ended_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(recording_session_id,sequence), UNIQUE(owner_id,client_segment_key),
 FOREIGN KEY(chunk_id,recording_session_id,interview_id,owner_id) REFERENCES iiq.recording_chunks(id,recording_session_id,interview_id,owner_id),
 CHECK(ended_at IS NULL OR started_at IS NULL OR ended_at>=started_at)
);
CREATE TABLE iiq.debriefs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL, interview_id uuid NOT NULL UNIQUE,
 occurrence text NOT NULL DEFAULT 'unconfirmed' CHECK(occurrence IN ('unconfirmed','happened','not_happened','postponed','prefer_not_to_say','later')),
 edited_text text NOT NULL DEFAULT '' CHECK(length(edited_text)<=200000), proposed_structure jsonb CHECK(proposed_structure IS NULL OR jsonb_typeof(proposed_structure)='object'),
 structured_data jsonb NOT NULL DEFAULT '{}' CHECK(jsonb_typeof(structured_data)='object'), questions jsonb NOT NULL DEFAULT '[]' CHECK(jsonb_typeof(questions)='array'),
 structure_confirmed_at timestamptz, last_client_revision bigint NOT NULL DEFAULT 0 CHECK(last_client_revision>=0),
 version bigint NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id,owner_id), FOREIGN KEY(interview_id,owner_id) REFERENCES iiq.interviews(id,owner_id)
);
CREATE TABLE iiq.followups (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL, interview_id uuid NOT NULL,
 kind text NOT NULL CHECK(kind IN ('thank_you','action','reminder')), title text NOT NULL CHECK(length(title) BETWEEN 1 AND 500), body text NOT NULL DEFAULT '' CHECK(length(body)<=30000),
 due_at timestamptz, status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','done','dismissed')),
 version bigint NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id,owner_id), FOREIGN KEY(interview_id,owner_id) REFERENCES iiq.interviews(id,owner_id)
);
CREATE TABLE iiq.consents (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL REFERENCES iiq.actors(id), scope text NOT NULL CHECK(length(scope) BETWEEN 1 AND 100),
 subject_ref text NOT NULL CHECK(length(subject_ref) BETWEEN 1 AND 300), status text NOT NULL CHECK(status IN ('active','revoked')), policy_version text NOT NULL,
 granted_at timestamptz NOT NULL DEFAULT now(), revoked_at timestamptz,
 version bigint NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id,owner_id), UNIQUE(owner_id,scope,subject_ref), CHECK(status<>'revoked' OR revoked_at IS NOT NULL)
);
CREATE TABLE iiq.research_missions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL REFERENCES iiq.actors(id), program_id text NOT NULL, standard_version text NOT NULL,
 public_payload jsonb NOT NULL CHECK(jsonb_typeof(public_payload)='object'), status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','submitted','closed')), expires_at timestamptz,
 version bigint NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(id,owner_id)
);
CREATE TABLE iiq.research_submissions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL, mission_id uuid NOT NULL, repair_parent_id uuid,
 original_object_key text NOT NULL CHECK(length(original_object_key) BETWEEN 1 AND 1000 AND original_object_key !~ '^[a-z]+://'), sha256 text NOT NULL CHECK(sha256 ~ '^[0-9a-f]{64}$'),
 parsed_package jsonb NOT NULL DEFAULT '{}' CHECK(jsonb_typeof(parsed_package)='object'), created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id,owner_id), UNIQUE(id,owner_id,mission_id), UNIQUE(owner_id,mission_id,sha256),
 FOREIGN KEY(mission_id,owner_id) REFERENCES iiq.research_missions(id,owner_id), FOREIGN KEY(repair_parent_id,owner_id,mission_id) REFERENCES iiq.research_submissions(id,owner_id,mission_id)
);
CREATE TABLE iiq.review_items (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL REFERENCES iiq.actors(id), interview_id uuid, submission_id uuid,
 source_kind text NOT NULL CHECK(source_kind IN ('debrief','research')), program_id text NOT NULL, excerpt text NOT NULL CHECK(length(excerpt) BETWEEN 1 AND 30000),
 permitted_use boolean NOT NULL CHECK(permitted_use), consent_id uuid NOT NULL,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','repair_requested','withdrawn','retracted')),
 execution_status text NOT NULL DEFAULT 'unverified' CHECK(execution_status IN ('unverified','verified','rejected')),
 quality_status text NOT NULL DEFAULT 'pending' CHECK(quality_status IN ('pending','approved','rejected','repair_requested')),
 publication_status text NOT NULL DEFAULT 'unpublished' CHECK(publication_status IN ('unpublished','published','retracted')),
 credit_status text NOT NULL DEFAULT 'none' CHECK(credit_status IN ('none','granted','suspended','revoked')), admin_note text NOT NULL DEFAULT '' CHECK(length(admin_note)<=4000),
 request_key text NOT NULL CHECK(length(request_key) BETWEEN 1 AND 150),
 version bigint NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id,owner_id), UNIQUE(owner_id,request_key),
 FOREIGN KEY(interview_id,owner_id) REFERENCES iiq.interviews(id,owner_id), FOREIGN KEY(submission_id,owner_id) REFERENCES iiq.research_submissions(id,owner_id),
 FOREIGN KEY(consent_id,owner_id) REFERENCES iiq.consents(id,owner_id),
 CHECK((source_kind='debrief' AND interview_id IS NOT NULL AND submission_id IS NULL) OR (source_kind='research' AND submission_id IS NOT NULL))
);
CREATE TABLE iiq.shared_reports (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), review_id uuid NOT NULL UNIQUE REFERENCES iiq.review_items(id), program_id text NOT NULL,
 public_text text NOT NULL CHECK(length(public_text) BETWEEN 1 AND 30000), report_kind text NOT NULL CHECK(report_kind IN ('applicant_report','research')),
 status text NOT NULL DEFAULT 'published' CHECK(status IN ('published','retracted')), source_refs jsonb NOT NULL DEFAULT '[]' CHECK(jsonb_typeof(source_refs)='array'), as_of timestamptz NOT NULL DEFAULT now(),
 version bigint NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE iiq.contribution_credits (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL, review_id uuid NOT NULL, mission_id uuid NOT NULL, kind text NOT NULL CHECK(kind IN ('grant','revoke')),
 units integer NOT NULL CHECK(units>0), policy_version text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(review_id,kind), UNIQUE(owner_id,mission_id,kind), FOREIGN KEY(mission_id,owner_id) REFERENCES iiq.research_missions(id,owner_id), FOREIGN KEY(review_id,owner_id) REFERENCES iiq.review_items(id,owner_id)
);
CREATE TABLE iiq.access_grants (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL, program_id text NOT NULL, review_id uuid NOT NULL, mission_id uuid NOT NULL,
 policy_version text NOT NULL, starts_at timestamptz NOT NULL, expires_at timestamptz NOT NULL, revoked_at timestamptz, suspended_at timestamptz, qualifying_review_id uuid NOT NULL,
 version bigint NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id,owner_id), UNIQUE(owner_id,program_id,review_id), UNIQUE(owner_id,mission_id), FOREIGN KEY(mission_id,owner_id) REFERENCES iiq.research_missions(id,owner_id), FOREIGN KEY(review_id,owner_id) REFERENCES iiq.review_items(id,owner_id), FOREIGN KEY(qualifying_review_id,owner_id) REFERENCES iiq.review_items(id,owner_id), CHECK(expires_at>starts_at)
);
CREATE TABLE iiq.revisions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL REFERENCES iiq.actors(id), revision bigint NOT NULL CHECK(revision>0),
 reason text NOT NULL CHECK(length(reason) BETWEEN 1 AND 100), request_key text NOT NULL CHECK(length(request_key) BETWEEN 1 AND 150), created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(owner_id,revision)
);
CREATE TABLE iiq.request_idempotency (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL REFERENCES iiq.actors(id), request_key text NOT NULL CHECK(length(request_key) BETWEEN 1 AND 150),
 request_digest text NOT NULL CHECK(request_digest ~ '^[0-9a-f]{64}$'), result_type text NOT NULL, result_id uuid, result_revision bigint NOT NULL CHECK(result_revision>0),
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(owner_id,request_key)
);
CREATE TABLE iiq.audit_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL REFERENCES iiq.actors(id), actor_id uuid NOT NULL REFERENCES iiq.actors(id),
 event_type text NOT NULL CHECK(length(event_type) BETWEEN 1 AND 100), object_type text NOT NULL CHECK(length(object_type) BETWEEN 1 AND 100), object_id uuid,
 metadata jsonb NOT NULL DEFAULT '{}' CHECK(jsonb_typeof(metadata)='object'), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE iiq.outbox_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL REFERENCES iiq.actors(id), topic text NOT NULL CHECK(length(topic) BETWEEN 1 AND 150), dedupe_key text NOT NULL UNIQUE CHECK(length(dedupe_key) BETWEEN 1 AND 250),
 payload jsonb NOT NULL DEFAULT '{}' CHECK(jsonb_typeof(payload)='object'), status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','processing','sent','failed')),
 attempts integer NOT NULL DEFAULT 0 CHECK(attempts>=0), available_at timestamptz NOT NULL DEFAULT now(), last_error_code text CHECK(length(last_error_code)<=100),
 version bigint NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(id,owner_id)
);
CREATE INDEX outbox_pending_idx ON iiq.outbox_events(available_at,id) WHERE status IN ('pending','failed');
CREATE TABLE iiq.policies (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), policy_key text NOT NULL UNIQUE CHECK(length(policy_key) BETWEEN 1 AND 100), value jsonb NOT NULL CHECK(jsonb_typeof(value)='object'), policy_version text NOT NULL,
 version bigint NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
-- Deliberately empty on install. Filing actual policy custody requires a separately
-- reviewed migration; runtime/admin cannot mint an approval from an arbitrary ref.
CREATE TABLE iiq.policy_authorities (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), authority_ref text NOT NULL UNIQUE CHECK(length(authority_ref) BETWEEN 1 AND 1000),
 policy_version text NOT NULL UNIQUE, approved_policy jsonb NOT NULL CHECK(jsonb_typeof(approved_policy)='object'),
 source_sha256 text NOT NULL CHECK(source_sha256 ~ '^[0-9a-f]{64}$'), approved_by text NOT NULL CHECK(length(approved_by)>0),
 approved_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE iiq.mentor_notes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL REFERENCES iiq.actors(id), target_student_id uuid NOT NULL REFERENCES iiq.actors(id),
 kind text NOT NULL CHECK(kind IN ('priority','nudge')), text text NOT NULL CHECK(length(text) BETWEEN 1 AND 4000),
 version bigint NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(id,owner_id)
);
CREATE INDEX mentor_notes_target_idx ON iiq.mentor_notes(target_student_id,kind);

CREATE FUNCTION iiq.deep_research_allowed(program text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT iiq.authenticated() AND (iiq.is_admin() OR current_setting('iiq.tier',true) IN ('360','ivprep_complete')
  OR EXISTS(SELECT 1 FROM iiq.access_grants g WHERE g.owner_id=iiq.actor_id() AND g.program_id=program AND g.revoked_at IS NULL AND g.suspended_at IS NULL AND g.starts_at<=now() AND g.expires_at>now()
   AND EXISTS(SELECT 1 FROM iiq.review_items r JOIN iiq.consents c ON c.id=r.consent_id AND c.owner_id=r.owner_id
    WHERE r.id=g.qualifying_review_id AND r.owner_id=g.owner_id AND r.status='approved' AND r.quality_status='approved' AND r.execution_status='verified' AND c.status='active')
   AND EXISTS(SELECT 1 FROM iiq.contribution_credits c WHERE c.review_id=g.review_id AND c.owner_id=g.owner_id AND c.kind='grant')
   AND NOT EXISTS(SELECT 1 FROM iiq.contribution_credits c WHERE c.review_id=g.review_id AND c.kind='revoke')
   AND EXISTS(SELECT 1 FROM iiq.policies p JOIN iiq.policy_authorities a ON a.policy_version=p.policy_version AND a.approved_policy=p.value
    WHERE p.policy_key='research' AND p.policy_version=g.policy_version AND p.value->'contributions'='true'::jsonb
    AND a.authority_ref=p.value#>>'{contributionPolicy,authorityRef}'))) $$;
CREATE FUNCTION iiq.touch_version() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF NEW.id<>OLD.id OR (to_jsonb(NEW)->'owner_id') IS DISTINCT FROM (to_jsonb(OLD)->'owner_id') OR NEW.created_at<>OLD.created_at THEN
   RAISE EXCEPTION 'Immutable record identity' USING ERRCODE='23514';
 END IF;
 NEW.version:=OLD.version+1; NEW.updated_at:=clock_timestamp(); RETURN NEW;
END $$;
CREATE FUNCTION iiq.reject_change() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN RAISE EXCEPTION 'Append-only record cannot be changed' USING ERRCODE='23514'; END $$;
CREATE FUNCTION iiq.chunk_identity_guard() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF ROW(NEW.recording_session_id,NEW.interview_id,NEW.sequence,NEW.client_segment_key,NEW.sha256,NEW.mime_type,NEW.byte_count,NEW.duration_ms,NEW.object_key)
  IS DISTINCT FROM ROW(OLD.recording_session_id,OLD.interview_id,OLD.sequence,OLD.client_segment_key,OLD.sha256,OLD.mime_type,OLD.byte_count,OLD.duration_ms,OLD.object_key) THEN
   RAISE EXCEPTION 'Immutable recording chunk identity' USING ERRCODE='23514';
 END IF; RETURN NEW;
END $$;
CREATE FUNCTION iiq.segment_chunk_guard() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM iiq.recording_chunks c WHERE c.id=NEW.chunk_id AND c.owner_id=NEW.owner_id AND c.interview_id=NEW.interview_id
  AND c.recording_session_id=NEW.recording_session_id AND c.sequence=NEW.sequence AND c.client_segment_key=NEW.client_segment_key
  AND c.sha256=NEW.sha256 AND (NEW.audio_object_key IS NULL OR NEW.audio_object_key=c.object_key)) THEN
  RAISE EXCEPTION 'Speech segment does not match immutable chunk' USING ERRCODE='23514';
 END IF; RETURN NEW;
END $$;
CREATE FUNCTION iiq.consent_identity_guard() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF ROW(NEW.scope,NEW.subject_ref) IS DISTINCT FROM ROW(OLD.scope,OLD.subject_ref) THEN
  RAISE EXCEPTION 'Consent purpose identity is immutable' USING ERRCODE='23514';
 END IF; RETURN NEW;
END $$;
CREATE FUNCTION iiq.review_source_guard() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM iiq.consents c WHERE c.id=NEW.consent_id AND c.owner_id=NEW.owner_id AND c.status='active'
  AND c.subject_ref=NEW.request_key AND c.scope=CASE NEW.source_kind WHEN 'debrief' THEN 'program_intelligence' ELSE 'research_contribution' END) THEN
  RAISE EXCEPTION 'Current purpose-specific consent required for this submission' USING ERRCODE='23514';
 END IF;
 IF NEW.source_kind='research' AND NOT EXISTS(SELECT 1 FROM iiq.research_submissions s JOIN iiq.research_missions m ON m.id=s.mission_id AND m.owner_id=s.owner_id
  WHERE s.id=NEW.submission_id AND s.owner_id=NEW.owner_id AND m.program_id=NEW.program_id) THEN
  RAISE EXCEPTION 'Research program must match its original mission' USING ERRCODE='23514';
 END IF;
 IF NEW.source_kind='debrief' AND NOT EXISTS(SELECT 1 FROM iiq.interviews i JOIN iiq.debriefs d ON d.interview_id=i.id AND d.owner_id=i.owner_id
  WHERE i.id=NEW.interview_id AND i.owner_id=NEW.owner_id AND i.program_id=NEW.program_id AND d.occurrence='happened') THEN
  RAISE EXCEPTION 'Confirmed occurrence and same program required for experience report' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE FUNCTION iiq.review_guard() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF TG_OP='INSERT' THEN
   IF NEW.status<>'pending' OR NEW.execution_status<>'unverified' OR NEW.quality_status<>'pending' OR NEW.publication_status<>'unpublished' OR NEW.credit_status<>'none' OR NEW.admin_note<>'' THEN
     RAISE EXCEPTION 'New review requires independent pending decisions' USING ERRCODE='23514';
   END IF;
 ELSIF ROW(NEW.owner_id,NEW.interview_id,NEW.submission_id,NEW.source_kind,NEW.program_id,NEW.excerpt,NEW.permitted_use,NEW.consent_id,NEW.request_key)
   IS DISTINCT FROM ROW(OLD.owner_id,OLD.interview_id,OLD.submission_id,OLD.source_kind,OLD.program_id,OLD.excerpt,OLD.permitted_use,OLD.consent_id,OLD.request_key) THEN
   RAISE EXCEPTION 'Original submitted review is immutable; submit a repair version' USING ERRCODE='23514';
 ELSIF NOT iiq.is_admin() AND current_user<>'iiq_owner' THEN
   IF NOT iiq.is_owner(OLD.owner_id) OR NEW.status<>'withdrawn' OR OLD.status IN ('withdrawn','retracted')
    OR ROW(NEW.execution_status,NEW.quality_status,NEW.publication_status,NEW.credit_status,NEW.admin_note)
     IS DISTINCT FROM ROW(OLD.execution_status,OLD.quality_status,OLD.publication_status,OLD.credit_status,OLD.admin_note) THEN
     RAISE EXCEPTION 'Only administrator may change review decisions' USING ERRCODE='42501';
   END IF;
 END IF;
 RETURN NEW;
END $$;

-- Explicit table groups avoid a blanket policy accidentally exposing a new table.
DO $$ DECLARE n text; BEGIN
 FOREACH n IN ARRAY ARRAY['actors','interviews','related_events','interview_history','research_demands','preparation','practice_attempts','learning_signals','mentor_gaps','recording_sessions','recording_chunks','speech_segments','debriefs','followups','consents','research_missions','research_submissions','review_items','shared_reports','contribution_credits','access_grants','revisions','request_idempotency','audit_events','outbox_events','policies','mentor_notes','policy_authorities'] LOOP
   EXECUTE format('ALTER TABLE iiq.%I ENABLE ROW LEVEL SECURITY',n);
   EXECUTE format('ALTER TABLE iiq.%I FORCE ROW LEVEL SECURITY',n);
   EXECUTE format('REVOKE ALL ON TABLE iiq.%I FROM PUBLIC',n);
   IF n NOT IN ('actors','shared_reports','policies','policy_authorities') THEN EXECUTE format('CREATE INDEX %I ON iiq.%I(owner_id)',n||'_owner_idx',n); END IF;
 END LOOP;
 FOREACH n IN ARRAY ARRAY['interviews','related_events','research_demands','preparation','practice_attempts','learning_signals','mentor_gaps','recording_sessions','recording_chunks','debriefs','followups','consents','research_missions','review_items','access_grants','outbox_events','mentor_notes'] LOOP
   EXECUTE format('GRANT SELECT,INSERT,UPDATE ON TABLE iiq.%I TO iiq_authenticated',n);
   EXECUTE format('CREATE TRIGGER touch_version BEFORE UPDATE ON iiq.%I FOR EACH ROW EXECUTE FUNCTION iiq.touch_version()',n);
 END LOOP;
 FOREACH n IN ARRAY ARRAY['actors','policies','shared_reports'] LOOP
   EXECUTE format('CREATE TRIGGER touch_version BEFORE UPDATE ON iiq.%I FOR EACH ROW EXECUTE FUNCTION iiq.touch_version()',n);
 END LOOP;
 FOREACH n IN ARRAY ARRAY['interview_history','speech_segments','research_submissions','contribution_credits','revisions','request_idempotency','audit_events'] LOOP
   EXECUTE format('GRANT SELECT,INSERT ON TABLE iiq.%I TO iiq_authenticated',n);
   EXECUTE format('CREATE TRIGGER immutable BEFORE UPDATE OR DELETE ON iiq.%I FOR EACH ROW EXECUTE FUNCTION iiq.reject_change()',n);
 END LOOP;
 FOREACH n IN ARRAY ARRAY['preparation','practice_attempts','recording_sessions','recording_chunks','debriefs','followups','consents'] LOOP
   EXECUTE format('CREATE POLICY owner_private ON iiq.%I FOR ALL TO iiq_authenticated USING (iiq.is_owner(owner_id)) WITH CHECK (iiq.is_owner(owner_id))',n);
 END LOOP;
 FOREACH n IN ARRAY ARRAY['speech_segments','revisions','request_idempotency'] LOOP
   EXECUTE format('CREATE POLICY owner_private ON iiq.%I FOR ALL TO iiq_authenticated USING (iiq.is_owner(owner_id)) WITH CHECK (iiq.is_owner(owner_id))',n);
 END LOOP;
 FOREACH n IN ARRAY ARRAY['interviews','related_events','interview_history','research_demands','mentor_gaps'] LOOP
   EXECUTE format('CREATE POLICY logistics_read ON iiq.%I FOR SELECT TO iiq_authenticated USING (iiq.is_owner(owner_id) OR iiq.is_admin() OR iiq.is_assigned(owner_id))',n);
   EXECUTE format('CREATE POLICY owner_insert ON iiq.%I FOR INSERT TO iiq_authenticated WITH CHECK (iiq.is_owner(owner_id))',n);
   IF n<>'interview_history' THEN EXECUTE format('CREATE POLICY owner_update ON iiq.%I FOR UPDATE TO iiq_authenticated USING (iiq.is_owner(owner_id)) WITH CHECK (iiq.is_owner(owner_id))',n); END IF;
 END LOOP;
 FOREACH n IN ARRAY ARRAY['related_events','interview_history','practice_attempts','learning_signals','recording_sessions','recording_chunks','speech_segments','followups','review_items'] LOOP
   EXECUTE format('CREATE INDEX %I ON iiq.%I(interview_id,owner_id)',n||'_interview_owner_idx',n);
 END LOOP;
END $$;
CREATE INDEX research_submissions_mission_owner_idx ON iiq.research_submissions(mission_id,owner_id);
CREATE INDEX research_submissions_parent_idx ON iiq.research_submissions(repair_parent_id,owner_id,mission_id);
CREATE INDEX review_items_consent_idx ON iiq.review_items(consent_id,owner_id);
CREATE INDEX review_items_submission_idx ON iiq.review_items(submission_id,owner_id);
CREATE INDEX review_items_queue_idx ON iiq.review_items(status,created_at);
CREATE INDEX speech_segments_chunk_owner_idx ON iiq.speech_segments(chunk_id,recording_session_id,interview_id,owner_id);
CREATE INDEX recording_chunks_session_owner_idx ON iiq.recording_chunks(recording_session_id,interview_id,owner_id);
CREATE INDEX contribution_credits_review_owner_idx ON iiq.contribution_credits(review_id,owner_id);
CREATE INDEX access_grants_review_owner_idx ON iiq.access_grants(review_id,owner_id);
CREATE INDEX contribution_credits_mission_idx ON iiq.contribution_credits(mission_id,owner_id);
CREATE INDEX access_grants_mission_idx ON iiq.access_grants(mission_id,owner_id);
CREATE INDEX audit_events_actor_idx ON iiq.audit_events(actor_id,created_at);
GRANT SELECT,INSERT,UPDATE ON iiq.actors,iiq.policies TO iiq_authenticated;
CREATE POLICY own_actor ON iiq.actors FOR ALL TO iiq_authenticated
 USING (iiq.is_owner(id) AND wp_user_id=nullif(current_setting('iiq.wp_user_id',true),'')::bigint)
 WITH CHECK (iiq.is_owner(id) AND wp_user_id=nullif(current_setting('iiq.wp_user_id',true),'')::bigint);
CREATE POLICY own_learning ON iiq.learning_signals FOR ALL TO iiq_authenticated USING(iiq.is_owner(owner_id)) WITH CHECK(iiq.is_owner(owner_id));
CREATE POLICY allowed_mentor_learning ON iiq.learning_signals FOR SELECT TO iiq_authenticated USING(iiq.is_assigned(owner_id) AND mentor_visible AND status='confirmed');
CREATE POLICY mission_owner_admin ON iiq.research_missions FOR SELECT TO iiq_authenticated USING(iiq.is_owner(owner_id) OR iiq.is_admin());
CREATE POLICY mission_owner_write ON iiq.research_missions FOR ALL TO iiq_authenticated USING(iiq.is_owner(owner_id)) WITH CHECK(iiq.is_owner(owner_id));
CREATE POLICY submission_read ON iiq.research_submissions FOR SELECT TO iiq_authenticated USING(iiq.is_owner(owner_id) OR iiq.is_admin());
CREATE POLICY submission_insert ON iiq.research_submissions FOR INSERT TO iiq_authenticated WITH CHECK(iiq.is_owner(owner_id));
CREATE POLICY review_read ON iiq.review_items FOR SELECT TO iiq_authenticated USING(iiq.is_owner(owner_id) OR iiq.is_admin());
CREATE POLICY review_insert ON iiq.review_items FOR INSERT TO iiq_authenticated WITH CHECK(iiq.is_owner(owner_id) AND EXISTS(
 SELECT 1 FROM iiq.consents c WHERE c.id=consent_id AND c.owner_id=iiq.actor_id() AND c.status='active' AND c.scope IN ('program_intelligence','research_contribution')));
CREATE POLICY review_update ON iiq.review_items FOR UPDATE TO iiq_authenticated USING(iiq.is_owner(owner_id) OR iiq.is_admin()) WITH CHECK(iiq.is_owner(owner_id) OR iiq.is_admin());
CREATE TRIGGER review_source_guard BEFORE INSERT ON iiq.review_items FOR EACH ROW EXECUTE FUNCTION iiq.review_source_guard();
CREATE TRIGGER review_guard BEFORE INSERT OR UPDATE ON iiq.review_items FOR EACH ROW EXECUTE FUNCTION iiq.review_guard();
CREATE TRIGGER chunk_identity_guard BEFORE UPDATE ON iiq.recording_chunks FOR EACH ROW EXECUTE FUNCTION iiq.chunk_identity_guard();
CREATE TRIGGER segment_chunk_guard BEFORE INSERT ON iiq.speech_segments FOR EACH ROW EXECUTE FUNCTION iiq.segment_chunk_guard();
CREATE TRIGGER consent_identity_guard BEFORE UPDATE ON iiq.consents FOR EACH ROW EXECUTE FUNCTION iiq.consent_identity_guard();
CREATE POLICY assigned_mentor_notes ON iiq.mentor_notes FOR ALL TO iiq_authenticated USING(iiq.is_owner(owner_id) AND iiq.is_assigned(target_student_id)) WITH CHECK(iiq.is_owner(owner_id) AND iiq.is_assigned(target_student_id));
CREATE POLICY student_notes ON iiq.mentor_notes FOR SELECT TO iiq_authenticated USING(kind IN ('priority','nudge') AND iiq.is_owner(target_student_id));
CREATE POLICY grants_read ON iiq.access_grants FOR SELECT TO iiq_authenticated USING(iiq.is_owner(owner_id) OR iiq.is_admin());
CREATE POLICY grants_admin ON iiq.access_grants FOR ALL TO iiq_authenticated USING(iiq.is_admin()) WITH CHECK(iiq.is_admin());
CREATE POLICY credits_read ON iiq.contribution_credits FOR SELECT TO iiq_authenticated USING(iiq.is_owner(owner_id) OR iiq.is_admin());
CREATE POLICY credits_insert ON iiq.contribution_credits FOR INSERT TO iiq_authenticated WITH CHECK(iiq.is_admin());
CREATE POLICY audit_read ON iiq.audit_events FOR SELECT TO iiq_authenticated USING(iiq.is_owner(owner_id) OR iiq.is_admin());
CREATE POLICY audit_append ON iiq.audit_events FOR INSERT TO iiq_authenticated WITH CHECK(iiq.authenticated() AND actor_id=iiq.actor_id() AND (iiq.is_owner(owner_id) OR iiq.is_admin()));
CREATE POLICY outbox_read ON iiq.outbox_events FOR SELECT TO iiq_authenticated USING(iiq.is_owner(owner_id));
CREATE POLICY outbox_append ON iiq.outbox_events FOR INSERT TO iiq_authenticated WITH CHECK(iiq.is_owner(owner_id) AND status='pending' AND attempts=0);
GRANT SELECT,UPDATE ON iiq.outbox_events TO iiq_worker;
CREATE POLICY worker_queue ON iiq.outbox_events FOR ALL TO iiq_worker USING(current_user='iiq_worker') WITH CHECK(current_user='iiq_worker');
CREATE POLICY policies_admin ON iiq.policies FOR ALL TO iiq_authenticated USING(iiq.is_admin()) WITH CHECK(iiq.is_admin());

-- Runtime may read only de-identified public columns, never the private review link.
GRANT SELECT(id,program_id,public_text,report_kind,status,source_refs,as_of,version,created_at,updated_at) ON iiq.shared_reports TO iiq_authenticated;
CREATE FUNCTION iiq.publication_eligible(review uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT iiq.authenticated() AND EXISTS(SELECT 1 FROM iiq.review_items r JOIN iiq.consents c ON c.id=r.consent_id AND c.owner_id=r.owner_id
  WHERE r.id=review AND r.status='approved' AND r.quality_status='approved' AND r.publication_status='published' AND r.permitted_use AND c.status='active') $$;
CREATE POLICY published_read ON iiq.shared_reports FOR SELECT TO iiq_authenticated USING(status='published' AND iiq.deep_research_allowed(program_id) AND iiq.publication_eligible(review_id));
CREATE VIEW iiq.published_reports WITH (security_invoker=true,security_barrier=true) AS
 SELECT id,program_id,public_text,report_kind,source_refs,as_of,version,created_at,updated_at FROM iiq.shared_reports WHERE status='published';
GRANT SELECT ON iiq.published_reports TO iiq_authenticated;

-- Only narrow SECURITY DEFINER functions below use these owner-role policies.
-- Runtime has no owner-role membership. No policy grants owner access to raw or
-- private preparation/debrief tables, even inside a privileged function.
CREATE POLICY publication_internal_review ON iiq.review_items FOR ALL TO iiq_owner USING(iiq.authenticated()) WITH CHECK(iiq.authenticated());
CREATE POLICY publication_internal_consent ON iiq.consents FOR SELECT TO iiq_owner USING(iiq.authenticated());
-- SELECT FOR SHARE also needs an UPDATE visibility policy under RLS; no value
-- mutation is permitted through this policy (WITH CHECK false).
CREATE POLICY publication_internal_consent_lock ON iiq.consents FOR UPDATE TO iiq_owner USING(iiq.authenticated()) WITH CHECK(false);
CREATE POLICY publication_internal_report ON iiq.shared_reports FOR ALL TO iiq_owner USING(iiq.authenticated()) WITH CHECK(iiq.authenticated());
CREATE POLICY retraction_internal_grants ON iiq.access_grants FOR ALL TO iiq_owner USING(iiq.authenticated()) WITH CHECK(iiq.authenticated());
CREATE POLICY retraction_internal_credits ON iiq.contribution_credits FOR ALL TO iiq_owner USING(iiq.authenticated()) WITH CHECK(iiq.authenticated());
CREATE POLICY permitted_profiles_internal ON iiq.actors FOR SELECT TO iiq_owner USING(iiq.is_owner(id) OR iiq.is_assigned(id) OR iiq.is_admin());
CREATE POLICY policy_custody_read ON iiq.policy_authorities FOR SELECT TO iiq_authenticated USING(iiq.is_admin());
GRANT SELECT ON iiq.policy_authorities TO iiq_authenticated;
CREATE POLICY policy_custody_migrations ON iiq.policy_authorities FOR ALL TO iiq_owner USING(true) WITH CHECK(true);
CREATE TRIGGER immutable BEFORE UPDATE OR DELETE ON iiq.policy_authorities FOR EACH ROW EXECUTE FUNCTION iiq.reject_change();
CREATE POLICY credit_internal_policy ON iiq.policies FOR SELECT TO iiq_owner USING(iiq.authenticated());
CREATE POLICY credit_internal_submission ON iiq.research_submissions FOR SELECT TO iiq_owner USING(iiq.is_admin());
CREATE FUNCTION iiq.contribution_policy(requested_version text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE policy iiq.policies;
BEGIN
 IF NOT iiq.is_admin() THEN RAISE EXCEPTION 'Admin credit decision required' USING ERRCODE='42501'; END IF;
 SELECT * INTO policy FROM iiq.policies WHERE policy_key='research' AND policy_version=requested_version;
 IF NOT FOUND OR policy.value->'contributions' IS DISTINCT FROM 'true'::jsonb OR NOT EXISTS(
   SELECT 1 FROM iiq.policy_authorities a WHERE a.policy_version=policy.policy_version AND a.approved_policy=policy.value
   AND a.authority_ref=policy.value#>>'{contributionPolicy,authorityRef}') THEN
   RAISE EXCEPTION 'Filed actual contribution policy required' USING ERRCODE='23514';
 END IF;
 RETURN policy.value->'contributionPolicy';
END $$;
CREATE FUNCTION iiq.credit_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE item iiq.review_items; prior iiq.contribution_credits; policy jsonb; mission uuid;
BEGIN
 IF NEW.kind='revoke' THEN
  SELECT * INTO prior FROM iiq.contribution_credits WHERE review_id=NEW.review_id AND kind='grant';
  IF NOT FOUND OR ROW(NEW.owner_id,NEW.units,NEW.policy_version) IS DISTINCT FROM ROW(prior.owner_id,prior.units,prior.policy_version) THEN
   RAISE EXCEPTION 'Revocation must match original credit' USING ERRCODE='23514';
  END IF;
  NEW.mission_id:=prior.mission_id; RETURN NEW;
 END IF;
 policy:=iiq.contribution_policy(NEW.policy_version);
 SELECT * INTO item FROM iiq.review_items WHERE id=NEW.review_id AND owner_id=NEW.owner_id FOR UPDATE;
 IF NOT FOUND OR item.source_kind<>'research' OR item.status<>'approved' OR item.quality_status<>'approved' OR item.execution_status<>'verified' THEN
  RAISE EXCEPTION 'Verified execution and accepted research quality required' USING ERRCODE='23514';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM iiq.consents c WHERE c.id=item.consent_id AND c.owner_id=item.owner_id AND c.status='active' FOR SHARE) THEN
  RAISE EXCEPTION 'Active contribution consent required' USING ERRCODE='23514';
 END IF;
 IF jsonb_typeof(policy->'executionCreditUnits') IS DISTINCT FROM 'number' OR (policy->>'executionCreditUnits') !~ '^[1-9][0-9]*$'
   OR NEW.units::text<>policy->>'executionCreditUnits' THEN
  RAISE EXCEPTION 'Credit units must equal actual approved policy' USING ERRCODE='23514';
 END IF;
 SELECT mission_id INTO mission FROM iiq.research_submissions WHERE id=item.submission_id AND owner_id=NEW.owner_id;
 IF mission IS NULL OR (NEW.mission_id IS NOT NULL AND NEW.mission_id<>mission) THEN RAISE EXCEPTION 'Credit mission mismatch' USING ERRCODE='23514'; END IF;
 NEW.mission_id:=mission; RETURN NEW;
END $$;
CREATE FUNCTION iiq.access_grant_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE item iiq.review_items; credit iiq.contribution_credits; policy jsonb; seconds numeric; qualifying_mission uuid;
BEGIN
 IF TG_OP='INSERT' THEN NEW.qualifying_review_id:=coalesce(NEW.qualifying_review_id,NEW.review_id); END IF;
 IF TG_OP='UPDATE' AND ROW(NEW.program_id,NEW.review_id,NEW.mission_id,NEW.policy_version,NEW.starts_at,NEW.expires_at)
   IS DISTINCT FROM ROW(OLD.program_id,OLD.review_id,OLD.mission_id,OLD.policy_version,OLD.starts_at,OLD.expires_at) THEN
  RAISE EXCEPTION 'Grant identity and approved duration are immutable' USING ERRCODE='23514';
 END IF;
 IF TG_OP='UPDATE' AND NEW.qualifying_review_id IS DISTINCT FROM OLD.qualifying_review_id
  AND (OLD.suspended_at IS NULL AND OLD.revoked_at IS NULL OR NEW.suspended_at IS NOT NULL OR NEW.revoked_at IS NOT NULL) THEN
  RAISE EXCEPTION 'A repair may qualify only an explicitly restored inactive grant' USING ERRCODE='23514';
 END IF;
 IF TG_OP='UPDATE' AND (NEW.revoked_at IS NOT NULL OR NEW.suspended_at IS NOT NULL) THEN RETURN NEW; END IF;
 policy:=iiq.contribution_policy(NEW.policy_version);
 SELECT * INTO item FROM iiq.review_items WHERE id=NEW.qualifying_review_id AND owner_id=NEW.owner_id FOR UPDATE;
 SELECT * INTO credit FROM iiq.contribution_credits WHERE review_id=NEW.review_id AND owner_id=NEW.owner_id AND kind='grant';
 IF item.id IS NULL OR credit.id IS NULL OR item.program_id<>NEW.program_id OR item.status<>'approved' OR item.quality_status<>'approved' OR item.execution_status<>'verified'
   OR EXISTS(SELECT 1 FROM iiq.contribution_credits WHERE review_id=NEW.review_id AND kind='revoke')
   OR NOT EXISTS(SELECT 1 FROM iiq.consents WHERE id=item.consent_id AND owner_id=item.owner_id AND status='active' FOR SHARE) THEN
  RAISE EXCEPTION 'Qualifying active credit and current review consent required for same program' USING ERRCODE='23514';
 END IF;
 SELECT mission_id INTO qualifying_mission FROM iiq.research_submissions WHERE id=item.submission_id AND owner_id=item.owner_id;
 IF qualifying_mission IS DISTINCT FROM credit.mission_id OR credit.policy_version<>NEW.policy_version THEN
  RAISE EXCEPTION 'Repair must qualify the original logical mission and policy' USING ERRCODE='23514';
 END IF;
 IF TG_OP='UPDATE' AND NEW.expires_at<=clock_timestamp() THEN RAISE EXCEPTION 'Expired grant cannot be restored' USING ERRCODE='23514'; END IF;
 IF jsonb_typeof(policy->'programAccessSeconds') IS DISTINCT FROM 'number' OR (policy->>'programAccessSeconds') !~ '^[1-9][0-9]*$' THEN
  RAISE EXCEPTION 'Actual approved access duration required' USING ERRCODE='23514';
 END IF;
 seconds:=(policy->>'programAccessSeconds')::numeric;
 IF extract(epoch FROM NEW.expires_at-NEW.starts_at)<>seconds OR (NEW.mission_id IS NOT NULL AND NEW.mission_id<>credit.mission_id) THEN
  RAISE EXCEPTION 'Grant duration or mission differs from approved policy' USING ERRCODE='23514';
 END IF;
 NEW.mission_id:=credit.mission_id; RETURN NEW;
END $$;
CREATE TRIGGER credit_guard BEFORE INSERT ON iiq.contribution_credits FOR EACH ROW EXECUTE FUNCTION iiq.credit_guard();
CREATE TRIGGER access_grant_guard BEFORE INSERT OR UPDATE ON iiq.access_grants FOR EACH ROW EXECUTE FUNCTION iiq.access_grant_guard();
CREATE FUNCTION iiq.effective_research_policy() RETURNS TABLE(contributions boolean,standard_version text,allowed_review_modes jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 WITH authorized AS (
  SELECT p.value,p.policy_version FROM iiq.policies p JOIN iiq.policy_authorities a
   ON a.policy_version=p.policy_version AND a.approved_policy=p.value
  WHERE iiq.authenticated() AND p.policy_key='research'
   AND a.authority_ref=p.value#>>'{contributionPolicy,authorityRef}'
 )
 SELECT coalesce((SELECT value->'contributions'='true'::jsonb FROM authorized),false),
  (SELECT policy_version FROM authorized),
  coalesce((SELECT jsonb_agg(mode) FROM authorized,
   LATERAL jsonb_array_elements_text(CASE WHEN jsonb_typeof(value->'allowedReviewModes')='array' THEN value->'allowedReviewModes' ELSE '[]'::jsonb END) mode
   WHERE mode IN ('execution','quality','publication','credit')),'[]'::jsonb) $$;
CREATE FUNCTION iiq.logistics_profiles() RETURNS TABLE(id uuid, display_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT a.id,a.display_name FROM iiq.actors a WHERE iiq.is_owner(a.id) OR iiq.is_assigned(a.id) OR iiq.is_admin() $$;
CREATE FUNCTION iiq.publish_report(review uuid, body text, refs jsonb DEFAULT '[]') RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE item iiq.review_items; report uuid; consent_ok boolean;
BEGIN
 IF NOT iiq.is_admin() THEN RAISE EXCEPTION 'Admin review required' USING ERRCODE='42501'; END IF;
 SELECT * INTO item FROM iiq.review_items WHERE id=review FOR UPDATE;
 IF NOT FOUND OR item.status<>'approved' OR item.quality_status<>'approved' OR NOT item.permitted_use THEN
   RAISE EXCEPTION 'Approved permitted quality review required' USING ERRCODE='23514';
 END IF;
 SELECT status='active' AND scope IN ('program_intelligence','research_contribution') INTO consent_ok FROM iiq.consents WHERE id=item.consent_id AND owner_id=item.owner_id FOR SHARE;
 IF consent_ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'Current publication consent required' USING ERRCODE='42501'; END IF;
 SELECT id INTO report FROM iiq.shared_reports WHERE review_id=review;
 IF FOUND THEN
  UPDATE iiq.shared_reports SET status='published',public_text=body,source_refs=refs,as_of=clock_timestamp() WHERE id=report;
  UPDATE iiq.review_items SET publication_status='published' WHERE id=review;
  RETURN report;
 END IF;
 INSERT INTO iiq.shared_reports(review_id,program_id,public_text,report_kind,source_refs)
  VALUES(review,item.program_id,body,CASE item.source_kind WHEN 'debrief' THEN 'applicant_report' ELSE 'research' END,refs) RETURNING id INTO report;
 UPDATE iiq.review_items SET publication_status='published' WHERE id=review;
 RETURN report;
END $$;
-- Normalize decisions only after review_guard has rejected unauthorized changes.
-- Repair is reversible suspension, never a new commercial forfeiture rule.
CREATE FUNCTION iiq.review_eligibility_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE terminal boolean; credit_exists boolean;
BEGIN
 IF NEW.status='approved' AND NEW.quality_status<>'approved' THEN NEW.status:=NEW.quality_status;
 ELSIF NEW.status IN ('pending','repair_requested','rejected') THEN NEW.quality_status:=NEW.status; END IF;
 IF NEW.status<>'approved' OR NEW.quality_status<>'approved' THEN
  IF NEW.publication_status='published' OR OLD.publication_status='published' THEN NEW.publication_status:='retracted'; END IF;
 END IF;
 terminal:=NEW.status IN ('withdrawn','retracted','rejected') OR NEW.quality_status='rejected' OR NEW.execution_status='rejected';
 SELECT EXISTS(SELECT 1 FROM iiq.contribution_credits c WHERE c.owner_id=NEW.owner_id AND c.kind='grant'
  AND (c.review_id=NEW.id OR EXISTS(SELECT 1 FROM iiq.access_grants g WHERE g.review_id=c.review_id AND g.qualifying_review_id=NEW.id))) INTO credit_exists;
 IF EXISTS(SELECT 1 FROM iiq.contribution_credits c WHERE c.review_id=NEW.id AND c.kind='revoke') THEN NEW.credit_status:='revoked';
 ELSIF credit_exists AND terminal THEN NEW.credit_status:='revoked';
 ELSIF credit_exists AND (NEW.status<>'approved' OR NEW.quality_status<>'approved' OR NEW.execution_status<>'verified') THEN NEW.credit_status:='suspended'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER review_state_guard BEFORE UPDATE ON iiq.review_items FOR EACH ROW EXECUTE FUNCTION iiq.review_eligibility_guard();
CREATE FUNCTION iiq.retract_review_projection() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.status<>'approved' OR NEW.quality_status<>'approved' OR NEW.publication_status='retracted' THEN
  UPDATE iiq.shared_reports SET status='retracted' WHERE review_id=NEW.id AND status='published';
 END IF;
 IF NEW.status IN ('withdrawn','retracted','rejected') OR NEW.quality_status='rejected' OR NEW.execution_status='rejected' THEN
  -- Credit history remains attached to its original approval, even if a repair
  -- became the current qualifying review. Never grant the same mission twice.
  INSERT INTO iiq.contribution_credits(owner_id,review_id,kind,units,policy_version)
   SELECT c.owner_id,c.review_id,'revoke',c.units,c.policy_version FROM iiq.contribution_credits c
   WHERE c.kind='grant' AND (EXISTS(SELECT 1 FROM iiq.access_grants g WHERE g.review_id=c.review_id AND g.qualifying_review_id=NEW.id)
    OR (c.review_id=NEW.id AND NOT EXISTS(SELECT 1 FROM iiq.access_grants g WHERE g.review_id=c.review_id)))
    AND NOT EXISTS (SELECT 1 FROM iiq.contribution_credits r WHERE r.review_id=c.review_id AND r.kind='revoke');
  UPDATE iiq.access_grants SET revoked_at=coalesce(revoked_at,clock_timestamp()) WHERE qualifying_review_id=NEW.id AND revoked_at IS NULL;
 ELSIF NEW.status<>'approved' OR NEW.quality_status<>'approved' OR NEW.execution_status<>'verified' THEN
  UPDATE iiq.access_grants SET suspended_at=coalesce(suspended_at,clock_timestamp()) WHERE qualifying_review_id=NEW.id AND suspended_at IS NULL;
 END IF; RETURN NEW;
END $$;
CREATE TRIGGER retract_review AFTER UPDATE ON iiq.review_items FOR EACH ROW EXECUTE FUNCTION iiq.retract_review_projection();
-- A terminal reversal names the original immutable credit. Keep every decision
-- associated with that credit truthful, including a later qualifying repair.
CREATE FUNCTION iiq.credit_revocation_projection() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.kind='revoke' THEN
  UPDATE iiq.access_grants SET revoked_at=coalesce(revoked_at,clock_timestamp()) WHERE review_id=NEW.review_id AND revoked_at IS NULL;
  UPDATE iiq.review_items SET credit_status='revoked' WHERE credit_status<>'revoked'
   AND (id=NEW.review_id OR id IN (SELECT qualifying_review_id FROM iiq.access_grants WHERE review_id=NEW.review_id));
 END IF; RETURN NEW;
END $$;
CREATE TRIGGER credit_revocation AFTER INSERT ON iiq.contribution_credits FOR EACH ROW EXECUTE FUNCTION iiq.credit_revocation_projection();
CREATE FUNCTION iiq.retract_consent_projection() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.status='revoked' AND OLD.status<>'revoked' THEN
  UPDATE iiq.review_items SET status='withdrawn',publication_status='retracted'
   WHERE consent_id=NEW.id AND owner_id=NEW.owner_id AND status NOT IN ('withdrawn','retracted');
 END IF; RETURN NEW;
END $$;
CREATE TRIGGER retract_consent AFTER UPDATE ON iiq.consents FOR EACH ROW EXECUTE FUNCTION iiq.retract_consent_projection();

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA iiq FROM PUBLIC;
GRANT EXECUTE ON FUNCTION iiq.actor_id(),iiq.actor_role(),iiq.authenticated(),iiq.is_owner(uuid),iiq.is_admin(),iiq.is_assigned(uuid),iiq.deep_research_allowed(text),iiq.schedule_valid(date,time,text,timestamptz,smallint,boolean),iiq.publish_report(uuid,text,jsonb),iiq.logistics_profiles(),iiq.effective_research_policy(),iiq.publication_eligible(uuid) TO iiq_authenticated;
COMMIT;
