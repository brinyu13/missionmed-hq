BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS usce_requests_status_idx
  ON command_center.usce_requests USING btree (status);

CREATE INDEX IF NOT EXISTS usce_requests_created_idx
  ON command_center.usce_requests USING btree (created_at DESC);

CREATE INDEX IF NOT EXISTS usce_offers_request_idx
  ON command_center.usce_offers USING btree (request_id);

CREATE INDEX IF NOT EXISTS usce_offers_status_idx
  ON command_center.usce_offers USING btree (status);

-- W-028 program seat identifier is command_center.usce_program_seats.id.
CREATE INDEX IF NOT EXISTS usce_program_seats_program_id_idx
  ON command_center.usce_program_seats USING btree (id);

CREATE INDEX IF NOT EXISTS usce_requests_search_trgm_idx
  ON command_center.usce_requests
  USING gin (((((applicant_name || ' ') || applicant_email::text) || ' ') || program_name) public.gin_trgm_ops);

COMMIT;
