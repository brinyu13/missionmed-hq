BEGIN;

CREATE OR REPLACE FUNCTION public.create_usce_public_intake_request(p_request jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = command_center, public, pg_temp
AS $function$
DECLARE
  v_request jsonb := COALESCE(p_request, '{}'::jsonb);
  v_request_id uuid := gen_random_uuid();
  v_supplied_id text := NULLIF(btrim(COALESCE(p_request->>'id', '')), '');
  v_existing_id uuid;
  v_existing_status text;
  v_status text := 'new';
  v_student_name text := left(btrim(COALESCE(p_request->>'student_name', '')), 200);
  v_email text := lower(left(btrim(COALESCE(p_request->>'email', '')), 254));
  v_phone text := NULLIF(left(btrim(COALESCE(p_request->>'phone', '')), 40), '');
  v_training_level_or_school text := left(btrim(COALESCE(p_request->>'training_level_or_school', '')), 240);
  v_preferred_specialties jsonb := COALESCE(p_request->'preferred_specialties', '[]'::jsonb);
  v_preferred_locations jsonb := COALESCE(p_request->'preferred_locations', '[]'::jsonb);
  v_preferred_months_or_dates jsonb := COALESCE(p_request->'preferred_months_or_dates', '[]'::jsonb);
  v_duration_text text := NULLIF(btrim(COALESCE(p_request->>'duration_weeks', '')), '');
  v_duration_weeks integer;
  v_flexibility text := NULLIF(left(btrim(COALESCE(p_request->>'flexibility', '')), 500), '');
  v_notes text := NULLIF(left(btrim(COALESCE(p_request->>'notes', '')), 2000), '');
  v_consent boolean := lower(btrim(COALESCE(p_request->>'consent', ''))) IN ('true', 't', '1', 'yes', 'on');
  v_source text := COALESCE(NULLIF(left(btrim(COALESCE(p_request->>'source', '')), 120), ''), 'r2_usce_request');
  v_source_url text := NULLIF(left(btrim(COALESCE(p_request->>'source_url', '')), 500), '');
  v_user_agent text := NULLIF(left(btrim(COALESCE(p_request->>'user_agent', '')), 500), '');
  v_ip_hash text := NULLIF(left(btrim(COALESCE(p_request->>'ip_hash', '')), 120), '');
  v_idempotency_key text := NULLIF(left(btrim(COALESCE(p_request->>'idempotency_key', '')), 120), '');
  v_payment_product_url text := NULLIF(left(btrim(COALESCE(p_request->>'payment_product_url', '')), 500), '');
  v_learndash_course_url text := NULLIF(left(btrim(COALESCE(p_request->>'learndash_course_url', '')), 500), '');
  v_metadata jsonb := COALESCE(p_request->'metadata', '{}'::jsonb);
BEGIN
  IF jsonb_typeof(v_request) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'invalid_request_payload' USING ERRCODE = '22023';
  END IF;

  IF v_supplied_id IS NOT NULL THEN
    BEGIN
      v_request_id := v_supplied_id::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'invalid_request_id' USING ERRCODE = '22023';
    END;
  END IF;

  IF char_length(v_student_name) < 2 THEN
    RAISE EXCEPTION 'student_name_required' USING ERRCODE = '22023';
  END IF;

  IF v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'valid_email_required' USING ERRCODE = '22023';
  END IF;

  IF char_length(v_training_level_or_school) < 2 THEN
    RAISE EXCEPTION 'training_level_or_school_required' USING ERRCODE = '22023';
  END IF;

  IF jsonb_typeof(v_preferred_specialties) IS DISTINCT FROM 'array'
     OR jsonb_array_length(v_preferred_specialties) NOT BETWEEN 1 AND 4 THEN
    RAISE EXCEPTION 'preferred_specialties_required' USING ERRCODE = '22023';
  END IF;

  IF jsonb_typeof(v_preferred_locations) IS DISTINCT FROM 'array'
     OR jsonb_array_length(v_preferred_locations) NOT BETWEEN 1 AND 4 THEN
    RAISE EXCEPTION 'preferred_locations_required' USING ERRCODE = '22023';
  END IF;

  IF jsonb_typeof(v_preferred_months_or_dates) IS DISTINCT FROM 'array'
     OR jsonb_array_length(v_preferred_months_or_dates) NOT BETWEEN 1 AND 6 THEN
    RAISE EXCEPTION 'preferred_months_or_dates_required' USING ERRCODE = '22023';
  END IF;

  IF v_duration_text IS NULL THEN
    RAISE EXCEPTION 'duration_weeks_required' USING ERRCODE = '22023';
  END IF;

  BEGIN
    v_duration_weeks := v_duration_text::integer;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'duration_weeks_invalid' USING ERRCODE = '22023';
  END;

  IF v_duration_weeks NOT BETWEEN 1 AND 24 THEN
    RAISE EXCEPTION 'duration_weeks_invalid' USING ERRCODE = '22023';
  END IF;

  IF v_consent IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'consent_required' USING ERRCODE = '22023';
  END IF;

  IF v_source_url IS NULL THEN
    RAISE EXCEPTION 'source_url_required' USING ERRCODE = '22023';
  END IF;

  IF jsonb_typeof(v_metadata) IS DISTINCT FROM 'object' THEN
    v_metadata := '{}'::jsonb;
  END IF;

  IF v_idempotency_key IS NOT NULL THEN
    SELECT id, status
    INTO v_existing_id, v_existing_status
    FROM command_center.usce_public_intake_requests
    WHERE idempotency_key = v_idempotency_key
    LIMIT 1;

    IF FOUND THEN
      RETURN jsonb_build_object(
        'id', v_existing_id,
        'status', v_existing_status,
        'was_existing', true
      );
    END IF;
  END IF;

  BEGIN
    INSERT INTO command_center.usce_public_intake_requests (
      id,
      status,
      student_name,
      email,
      phone,
      training_level_or_school,
      preferred_specialties,
      preferred_locations,
      preferred_months_or_dates,
      duration_weeks,
      flexibility,
      notes,
      consent,
      source,
      source_url,
      user_agent,
      ip_hash,
      idempotency_key,
      payment_product_url,
      learndash_course_url,
      metadata
    )
    VALUES (
      v_request_id,
      v_status,
      v_student_name,
      v_email,
      v_phone,
      v_training_level_or_school,
      v_preferred_specialties,
      v_preferred_locations,
      v_preferred_months_or_dates,
      v_duration_weeks,
      v_flexibility,
      v_notes,
      v_consent,
      v_source,
      v_source_url,
      v_user_agent,
      v_ip_hash,
      v_idempotency_key,
      v_payment_product_url,
      v_learndash_course_url,
      v_metadata
    )
    RETURNING id, status INTO v_request_id, v_status;
  EXCEPTION WHEN unique_violation THEN
    IF v_idempotency_key IS NOT NULL THEN
      SELECT id, status
      INTO v_existing_id, v_existing_status
      FROM command_center.usce_public_intake_requests
      WHERE idempotency_key = v_idempotency_key
      LIMIT 1;

      IF FOUND THEN
        RETURN jsonb_build_object(
          'id', v_existing_id,
          'status', v_existing_status,
          'was_existing', true
        );
      END IF;
    END IF;

    RAISE;
  END;

  RETURN jsonb_build_object(
    'id', v_request_id,
    'status', v_status,
    'was_existing', false
  );
END;
$function$;

COMMENT ON FUNCTION public.create_usce_public_intake_request(jsonb) IS
  'Service-role-only RPC used by the Railway USCE public intake endpoint to create request-first availability rows in command_center.usce_public_intake_requests. This does not send email, create notifications, create WooCommerce orders, or write command_center.usce_requests.';

REVOKE ALL ON FUNCTION public.create_usce_public_intake_request(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_usce_public_intake_request(jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.create_usce_public_intake_request(jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.create_usce_public_intake_request(jsonb) TO service_role;

COMMIT;
