-- CX-OFFER-331
-- Service-only student status tracker summaries for offer/comms state.
-- Additive only: no public grants, no RLS weakening, no browser Supabase access,
-- no emails, no payments, no WooCommerce orders, and no LearnDash enrollment.

BEGIN;

CREATE OR REPLACE FUNCTION public.list_usce_student_status_offer_summaries(
  p_request_ids uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = command_center, public, pg_temp
AS $$
BEGIN
  IF p_request_ids IS NULL OR array_length(p_request_ids, 1) IS NULL THEN
    RETURN jsonb_build_object('items', '[]'::jsonb);
  END IF;

  RETURN jsonb_build_object(
    'items',
    COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', o.id,
          'intake_request_id', o.intake_request_id,
          'created_at', o.created_at,
          'updated_at', o.updated_at,
          'status', o.status,
          'specialty', o.specialty,
          'location', o.location,
          'timing', o.timing,
          'duration_weeks', o.duration_weeks,
          'format', o.format,
          'expires_at', o.expires_at,
          'payment_url', o.payment_url,
          'offer_token_expires_at', o.offer_token_expires_at,
          'accepted_at', o.accepted_at,
          'declined_at', o.declined_at,
          'alternate_requested_at', o.alternate_requested_at,
          'postmark_status', o.postmark_status,
          'message_previewed_at', o.message_previewed_at,
          'message_sent_at', o.message_sent_at,
          'payment_status', o.payment_status,
          'payment_checked_at', o.payment_checked_at,
          'paperwork_status', o.paperwork_status,
          'paperwork_updated_at', o.paperwork_updated_at,
          'learndash_status', o.learndash_status,
          'learndash_updated_at', o.learndash_updated_at
        )
        ORDER BY o.updated_at DESC
      )
      FROM command_center.usce_offer_drafts o
      WHERE o.intake_request_id = ANY(p_request_ids)
    ), '[]'::jsonb)
  );
END;
$$;

COMMENT ON FUNCTION public.list_usce_student_status_offer_summaries(uuid[]) IS
  'Service-role-only RPC for Railway student status tracker to read student-safe offer state by already-authenticated student request IDs. It never exposes token hashes or admin notes.';

REVOKE ALL ON FUNCTION public.list_usce_student_status_offer_summaries(uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_usce_student_status_offer_summaries(uuid[]) FROM anon;
REVOKE ALL ON FUNCTION public.list_usce_student_status_offer_summaries(uuid[]) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.list_usce_student_status_offer_summaries(uuid[]) TO service_role;

CREATE OR REPLACE FUNCTION public.list_usce_student_status_comms_summaries(
  p_request_ids uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = command_center, public, pg_temp
AS $$
BEGIN
  IF p_request_ids IS NULL OR array_length(p_request_ids, 1) IS NULL THEN
    RETURN jsonb_build_object('items', '[]'::jsonb);
  END IF;

  RETURN jsonb_build_object(
    'items',
    COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', c.id,
          'created_at', c.created_at,
          'intake_request_id', c.intake_request_id,
          'direction', c.direction,
          'message_status', c.message_status,
          'postmark_message_id', c.postmark_message_id,
          'raw_json', jsonb_build_object(
            'event_type', c.raw_json ->> 'event_type'
          )
        )
        ORDER BY c.created_at DESC
      )
      FROM command_center.usce_comms c
      WHERE c.intake_request_id = ANY(p_request_ids)
    ), '[]'::jsonb)
  );
END;
$$;

COMMENT ON FUNCTION public.list_usce_student_status_comms_summaries(uuid[]) IS
  'Service-role-only RPC for Railway student status tracker communication milestones. It returns metadata only and never Gmail bodies or private message content.';

REVOKE ALL ON FUNCTION public.list_usce_student_status_comms_summaries(uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_usce_student_status_comms_summaries(uuid[]) FROM anon;
REVOKE ALL ON FUNCTION public.list_usce_student_status_comms_summaries(uuid[]) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.list_usce_student_status_comms_summaries(uuid[]) TO service_role;

COMMIT;
