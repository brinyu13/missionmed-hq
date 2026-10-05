-- Migration: 20261005013002_partner_cost_sharing_production_review.sql
-- Authority: PARTNER-COST-SHARING-20261004; DR-377/378 direct Founder LIVE steer
-- Date: 2026-10-05 UTC
-- Depends on: 20261005012837_partner_cost_sharing_production_foundation.sql
-- Description: Private immutable accounting draft snapshots and original custody; no neighboring changes.
-- Idempotent: NO
-- Target: independently verified dwwsahpzblgrgducxtzw; rollback gate OFF, retain records.
BEGIN;
CREATE TABLE partner_cost_sharing.review_snapshots (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 source_sha256 text NOT NULL UNIQUE CHECK(source_sha256~'^[a-f0-9]{64}$'),
 input jsonb NOT NULL CHECK(input->>'schema'='pcs-private-accounting-review-v1' AND jsonb_typeof(input->'rows')='array' AND jsonb_array_length(input->'rows')<=2000),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE partner_cost_sharing.review_assets (
 row_id text PRIMARY KEY CHECK(row_id~'^[a-z0-9-]{1,100}$'),
 shared boolean NOT NULL DEFAULT false,
 object_key text NOT NULL UNIQUE CHECK(object_key~'^[a-z0-9-]{1,80}/[a-z0-9._-]{1,160}$'),
 original_sha256 text NOT NULL CHECK(original_sha256~'^[a-f0-9]{64}$'),
 content_type text NOT NULL CHECK(content_type IN ('application/pdf','image/png','image/jpeg')),
 byte_length bigint NOT NULL CHECK(byte_length BETWEEN 1 AND 10485760),
 preview_object_key text UNIQUE CHECK(preview_object_key~'^[a-z0-9-]{1,80}/[a-z0-9._-]{1,160}$'),
 preview_sha256 text CHECK(preview_sha256~'^[a-f0-9]{64}$'),
 preview_byte_length bigint CHECK(preview_byte_length BETWEEN 1 AND 10485760),
 CHECK((preview_object_key IS NULL AND preview_sha256 IS NULL AND preview_byte_length IS NULL) OR (preview_object_key IS NOT NULL AND preview_sha256 IS NOT NULL AND preview_byte_length IS NOT NULL)),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE partner_cost_sharing.review_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_cost_sharing.review_snapshots FORCE ROW LEVEL SECURITY;
ALTER TABLE partner_cost_sharing.review_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_cost_sharing.review_assets FORCE ROW LEVEL SECURITY;
REVOKE ALL ON partner_cost_sharing.review_snapshots,partner_cost_sharing.review_assets FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION partner_cost_sharing.keep_review_immutable() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN RAISE EXCEPTION 'Private accounting review custody is append-only'; END;$$;
REVOKE ALL ON FUNCTION partner_cost_sharing.keep_review_immutable() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER keep_snapshot BEFORE UPDATE OR DELETE ON partner_cost_sharing.review_snapshots FOR EACH ROW EXECUTE FUNCTION partner_cost_sharing.keep_review_immutable();
CREATE TRIGGER keep_asset BEFORE UPDATE OR DELETE ON partner_cost_sharing.review_assets FOR EACH ROW EXECUTE FUNCTION partner_cost_sharing.keep_review_immutable();
CREATE FUNCTION partner_cost_sharing.accounting_review(p_actor uuid,p_wp_user_id bigint) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,partner_cost_sharing AS $$
DECLARE k text; r partner_cost_sharing.review_snapshots;
BEGIN
 k=partner_cost_sharing.require_member(p_actor,p_wp_user_id,false);
 SELECT * INTO r FROM partner_cost_sharing.review_snapshots ORDER BY id DESC LIMIT 1;
 IF NOT FOUND THEN RAISE EXCEPTION 'Private accounting draft unavailable';END IF;
 RETURN jsonb_build_object('input',r.input,'source_sha256',r.source_sha256);
END;$$;
CREATE FUNCTION partner_cost_sharing.review_asset(p_actor uuid,p_wp_user_id bigint,p_row_id text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,partner_cost_sharing AS $$
DECLARE k text;r partner_cost_sharing.review_assets;review jsonb;review_row jsonb;historical jsonb:='{"woo":"063a4e80a7c0ac3b543e60d68adb216cf84bc17933872d51bc5c7aaef55894aa","elementor":"9f6ce2d6bf8e0e103f9c52dbb231ba36460e7b23e07fd8d168898a3386c05bf6","learndash":"6ec90acbe33960ea74ba8669e60c7371a48c685abc7cee38c9660a821c1ebc58","formidable":"b7e6c10d6d2b94e400a5febd369aa713445b4de68aa631ca5e364e2393bbcc57","kinsta-dec":"b8160c09089e043babc491a82edd38c98051802ca4e3c9aa087af26b8d294f82","kinsta-jan":"581e9fc8e9c10dbc31036b5b049a0d3622dcea4253816f55f36bee35112869be","kinsta-feb":"a0807b014e923e069be985d04d6abcd1cbdd1c2f794b6c656669aa461b12bd50"}'::jsonb;
BEGIN
 k=partner_cost_sharing.require_member(p_actor,p_wp_user_id,false);
 SELECT * INTO r FROM partner_cost_sharing.review_assets WHERE row_id=p_row_id AND (k='brian' OR shared);
 IF NOT FOUND THEN RAISE EXCEPTION 'Private original unavailable' USING ERRCODE='42501';END IF;
 SELECT input INTO review FROM partner_cost_sharing.review_snapshots ORDER BY id DESC LIMIT 1;
 IF review IS NULL THEN RAISE EXCEPTION 'Private review unavailable' USING ERRCODE='42501';END IF;
 SELECT value INTO review_row FROM jsonb_array_elements(review->'rows') WHERE value->>'id'=p_row_id;
 IF review_row IS NOT NULL THEN
  IF r.original_sha256 IS DISTINCT FROM review_row->>'originalSha256' OR (k<>'brian' AND (review_row->>'purpose' IS DISTINCT FROM 'SHARED' OR coalesce(review_row->>'status','') NOT IN ('PAID','ACCRUED'))) THEN RAISE EXCEPTION 'Current review original held' USING ERRCODE='42501';END IF;
 ELSIF historical->>p_row_id IS DISTINCT FROM r.original_sha256 THEN RAISE EXCEPTION 'Original absent from authorized review/history' USING ERRCODE='42501';END IF;
 RETURN to_jsonb(r)-'row_id'-'shared'-'created_at';
END;$$;
REVOKE ALL ON FUNCTION partner_cost_sharing.accounting_review(uuid,bigint),partner_cost_sharing.review_asset(uuid,bigint,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION partner_cost_sharing.accounting_review(uuid,bigint),partner_cost_sharing.review_asset(uuid,bigint,text) TO service_role;
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types) VALUES ('partner-cost-sharing-private','partner-cost-sharing-private',false,10485760,ARRAY['application/pdf','image/png','image/jpeg']);
COMMIT;
