\set ON_ERROR_STOP on
DO $$ BEGIN CREATE ROLE anon; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE authenticated; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE service_role; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE SCHEMA command_center;
CREATE TABLE command_center.usce_public_intake_requests(id uuid PRIMARY KEY,student_name text,email text);
CREATE TABLE command_center.usce_comms(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),offer_id uuid,thread_id uuid,intake_request_id uuid REFERENCES command_center.usce_public_intake_requests(id),direction text NOT NULL,is_internal_note boolean NOT NULL DEFAULT false,message_status text NOT NULL DEFAULT 'sent',from_email text,to_email text,subject text,body_text text,body_html text,postmark_message_id text,in_reply_to_postmark_message_id text,raw_json jsonb NOT NULL DEFAULT '{}',needs_triage boolean NOT NULL DEFAULT false,delivered_at timestamptz,opened_at timestamptz,replied_at timestamptz,failed_at timestamptz,created_by uuid,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE command_center.usce_outbox(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),entity_type text NOT NULL,entity_id uuid NOT NULL,action text NOT NULL,payload jsonb NOT NULL,status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','completed','failed','compensated')),idempotency_key text UNIQUE NOT NULL,retry_count int NOT NULL DEFAULT 0,last_error text,created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now(),completed_at timestamptz);

CREATE TABLE command_center.usce_send_claims(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),state text,mode text,postmark_message_id text,payload jsonb);
