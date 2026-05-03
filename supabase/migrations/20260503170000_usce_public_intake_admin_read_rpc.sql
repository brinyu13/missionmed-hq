-- CX-OFFER-310K: service-only admin read adapter for USCE request-first intake rows.
-- This function is intentionally callable only by server-side service credentials.

CREATE OR REPLACE FUNCTION public.list_usce_public_intake_requests(
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0,
  p_status text DEFAULT NULL,
  p_search text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = command_center, public, pg_temp
AS $$
DECLARE
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100);
  v_offset integer := GREATEST(COALESCE(p_offset, 0), 0);
  v_status text := NULLIF(LOWER(TRIM(COALESCE(p_status, ''))), '');
  v_search text := NULLIF(LOWER(TRIM(COALESCE(p_search, ''))), '');
BEGIN
  RETURN (
    WITH filtered AS (
      SELECT r.*
      FROM command_center.usce_public_intake_requests r
      WHERE (v_status IS NULL OR r.status = v_status)
        AND (
          v_search IS NULL
          OR LOWER(r.student_name) LIKE '%' || v_search || '%'
          OR LOWER(r.email) LIKE '%' || v_search || '%'
          OR LOWER(COALESCE(r.phone, '')) LIKE '%' || v_search || '%'
        )
    ),
    page AS (
      SELECT *
      FROM filtered
      ORDER BY created_at DESC
      LIMIT v_limit
      OFFSET v_offset
    )
    SELECT jsonb_build_object(
      'items', COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', page.id,
            'created_at', page.created_at,
            'updated_at', page.updated_at,
            'status', page.status,
            'student_name', page.student_name,
            'email', page.email,
            'phone', page.phone,
            'training_level_or_school', page.training_level_or_school,
            'preferred_specialties', page.preferred_specialties,
            'preferred_locations', page.preferred_locations,
            'preferred_months_or_dates', page.preferred_months_or_dates,
            'duration_weeks', page.duration_weeks,
            'flexibility', page.flexibility,
            'notes', page.notes,
            'source', page.source,
            'source_url', page.source_url,
            'promoted_usce_request_id', page.promoted_usce_request_id,
            'promoted_at', page.promoted_at,
            'admin_notes', page.admin_notes,
            'metadata', page.metadata
          )
          ORDER BY page.created_at DESC
        )
        FROM page
      ), '[]'::jsonb),
      'count', (SELECT COUNT(*) FROM filtered),
      'limit', v_limit,
      'offset', v_offset
    )
  );
END;
$$;

COMMENT ON FUNCTION public.list_usce_public_intake_requests(integer, integer, text, text) IS
  'Service-role-only RPC used by the Railway authenticated admin endpoint to list request-first USCE public intake rows. It does not grant public browser access, send email, create notifications, create WooCommerce orders, or write command_center.usce_requests.';

REVOKE ALL ON FUNCTION public.list_usce_public_intake_requests(integer, integer, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_usce_public_intake_requests(integer, integer, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.list_usce_public_intake_requests(integer, integer, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.list_usce_public_intake_requests(integer, integer, text, text) TO service_role;
