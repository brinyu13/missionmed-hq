-- Only a verified WordPress account/case binding can unlock an existing intake.
-- This migration does not grant any account a case or change the case itself.
CREATE TABLE command_center.usce_tracker_account_cases (
  intake_request_id uuid PRIMARY KEY REFERENCES command_center.usce_public_intake_requests(id),
  wp_user_id bigint NOT NULL CHECK (wp_user_id > 0),
  confirmed_email text NOT NULL CHECK (confirmed_email <> '' AND confirmed_email = lower(btrim(confirmed_email))),
  linked_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE command_center.usce_tracker_account_cases ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE command_center.usce_tracker_account_cases FROM PUBLIC, anon, authenticated, service_role;
CREATE INDEX usce_tracker_account_cases_owner_idx ON command_center.usce_tracker_account_cases (wp_user_id);
CREATE FUNCTION command_center.usce_student_tracker_account_v1(p_wp_user_id bigint, p_email text, p_ref uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $fn$
  SELECT jsonb_build_object('items',coalesce(jsonb_agg(row_data ORDER BY submitted DESC, id), '[]'::jsonb))
  FROM (
    SELECT r.id, r.created_at submitted, jsonb_build_object(
      'reference',r.id, 'submitted_at',r.created_at, 'status',r.status,
      'specialties',r.preferred_specialties, 'locations',r.preferred_locations,
      'months',r.preferred_months_or_dates, 'weeks',r.duration_weeks,
      'offer',o.details, 'response',e.details) row_data
    FROM command_center.usce_tracker_account_cases b
    JOIN command_center.usce_public_intake_requests r ON r.id=b.intake_request_id
      AND lower(btrim(r.email))=b.confirmed_email
    LEFT JOIN LATERAL (
      SELECT d.id, d.status, d.alternate_requested_at, d.declined_at, d.accepted_at, d.student_response_note, jsonb_build_object(
        'sent_at', d.message_sent_at, 'specialty',d.specialty,'location',d.location,
        'timing',d.timing,'weeks',d.duration_weeks,'format',d.format,'expires_at',d.expires_at,
        'options',coalesce((SELECT jsonb_agg(jsonb_build_object('specialty',v->>'specialty',
          'location',v->>'location','timing',v->>'month_label','weeks',v->>'duration_weeks',
          'format',v->>'program_type') ORDER BY n) FROM jsonb_array_elements(d.options) WITH ORDINALITY AS x(v,n)), '[]'::jsonb)
      ) details
      FROM command_center.usce_offer_drafts d
      WHERE d.intake_request_id=r.id AND d.status NOT IN ('draft','ready','archived')
        AND d.message_sent_at IS NOT NULL AND d.postmark_status='sent' AND d.postmark_message_id IS NOT NULL
        AND EXISTS (SELECT 1 FROM command_center.usce_send_claims sc WHERE sc.offer_id=d.id
          AND sc.revision=d.revision AND sc.mode='live' AND sc.state='provider_accepted'
          AND sc.postmark_message_id=d.postmark_message_id AND lower(btrim(sc.payload->>'to_email'))=b.confirmed_email)
      ORDER BY d.message_sent_at DESC,d.id LIMIT 1
    ) o ON true
    LEFT JOIN LATERAL (
      SELECT jsonb_build_object('kind',o.status,'recorded_at',c.created_at,
        'note',CASE WHEN o.status='alternate_requested' AND c.body_text=o.student_response_note THEN o.student_response_note END) details
      FROM command_center.usce_comms c
      WHERE c.intake_request_id=r.id AND c.raw_json->>'offer_draft_id'=o.id::text
        AND c.direction='SYS' AND NOT c.is_internal_note AND c.raw_json->>'source'='CX-OFFER-320'
        AND c.raw_json->>'event_type'=CASE o.status WHEN 'alternate_requested' THEN 'student_requested_alternate'
          WHEN 'accepted' THEN 'student_accepted_offer' WHEN 'declined' THEN 'student_declined_offer'
          WHEN 'declined_notify_future' THEN 'student_declined_offer_notify_future'
          WHEN 'declined_no_notify' THEN 'student_declined_offer_no_notify' END
        AND c.created_at=CASE o.status WHEN 'alternate_requested' THEN o.alternate_requested_at
          WHEN 'accepted' THEN o.accepted_at ELSE o.declined_at END
      ORDER BY c.id LIMIT 1
    ) e ON true
    WHERE b.wp_user_id=p_wp_user_id AND b.confirmed_email=lower(btrim(p_email))
      AND (p_ref IS NULL OR b.intake_request_id=p_ref)
    ORDER BY r.created_at DESC,r.id LIMIT 25
  ) matches;
$fn$;
REVOKE ALL ON FUNCTION command_center.usce_student_tracker_account_v1(bigint,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION command_center.usce_student_tracker_account_v1(bigint,text,uuid) TO service_role;
-- Bind by OID at creation. No private-schema USAGE or table access for the API role.
CREATE FUNCTION public.usce_student_tracker_account_v1(p_wp_user_id bigint,p_email text,p_ref uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = ''
RETURN command_center.usce_student_tracker_account_v1(p_wp_user_id,p_email,p_ref);
REVOKE ALL ON FUNCTION public.usce_student_tracker_account_v1(bigint,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.usce_student_tracker_account_v1(bigint,text,uuid) TO service_role;
