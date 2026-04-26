BEGIN;

CREATE OR REPLACE FUNCTION command_center.usce_portal_respond(
  p_portal_token_hash text,
  p_action text,
  p_payment_intent_id text DEFAULT NULL,
  p_caller_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = command_center, public
AS $function$
DECLARE
  v_offer command_center.usce_offers%ROWTYPE;
  v_request command_center.usce_requests%ROWTYPE;
  v_seat command_center.usce_program_seats%ROWTYPE;
  v_action text := upper(btrim(COALESCE(p_action, '')));
  v_confirmation_id uuid;
  v_other_active_count integer := 0;
  v_sibling_id uuid;
BEGIN
  PERFORM set_config('request.portal_token', COALESCE(p_portal_token_hash, ''), true);

  SELECT o.*
  INTO v_offer
  FROM command_center.usce_offers o
  WHERE o.portal_token_hash = p_portal_token_hash;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVALID_TOKEN';
  END IF;

  IF v_offer.portal_token_expires_at IS NULL OR v_offer.portal_token_expires_at <= now() THEN
    RAISE EXCEPTION 'EXPIRED';
  END IF;

  IF p_caller_user_id IS NULL OR p_caller_user_id <> v_offer.applicant_user_id THEN
    RAISE EXCEPTION 'IDENTITY_OFFER_MISMATCH';
  END IF;

  SELECT r.*
  INTO v_request
  FROM command_center.usce_requests r
  WHERE r.id = v_offer.request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVALID_TRANSITION';
  END IF;

  FOR v_sibling_id IN
    SELECT o.id
    FROM command_center.usce_offers o
    WHERE o.request_id = v_offer.request_id
    ORDER BY o.id
    FOR UPDATE
  LOOP
    NULL;
  END LOOP;

  SELECT o.*
  INTO v_offer
  FROM command_center.usce_offers o
  WHERE o.id = v_offer.id;

  IF v_action NOT IN ('ACCEPT', 'DECLINE') THEN
    RAISE EXCEPTION 'INVALID_TRANSITION';
  END IF;

  IF v_action = 'DECLINE' THEN
    IF v_offer.status NOT IN ('SENT', 'REMINDED') THEN
      RAISE EXCEPTION 'INVALID_TRANSITION';
    END IF;

    UPDATE command_center.usce_offers
    SET status = 'DECLINED',
        responded_at = now(),
        response = 'DECLINED',
        updated_at = now()
    WHERE id = v_offer.id;

    UPDATE command_center.usce_program_seats
    SET seats_held_soft = GREATEST(seats_held_soft - 1, 0)
    WHERE id = v_offer.program_seat_id;

    SELECT COUNT(*)
    INTO v_other_active_count
    FROM command_center.usce_offers o
    WHERE o.request_id = v_offer.request_id
      AND o.id <> v_offer.id
      AND o.status IN (
        'DRAFT',
        'PREVIEWED',
        'APPROVED',
        'SENT',
        'REMINDED',
        'ACCEPTED',
        'PENDING_PAYMENT',
        'FAILED_PAYMENT'
      );

    IF v_other_active_count = 0 AND v_request.status = 'OFFERED' THEN
      UPDATE command_center.usce_requests
      SET status = 'IN_REVIEW',
          updated_at = now()
      WHERE id = v_offer.request_id;
    END IF;

    RETURN jsonb_build_object(
      'status', 'DECLINED',
      'offer_id', v_offer.id,
      'request_id', v_offer.request_id
    );
  END IF;

  IF v_offer.status IN ('ACCEPTED', 'PENDING_PAYMENT', 'PAID') THEN
    RAISE EXCEPTION 'ALREADY_ACCEPTED';
  END IF;

  IF v_offer.status NOT IN ('SENT', 'REMINDED') THEN
    RAISE EXCEPTION 'INVALID_TRANSITION';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM command_center.usce_offers s
    WHERE s.request_id = v_offer.request_id
      AND s.id <> v_offer.id
      AND s.status = 'PAID'
  ) THEN
    RAISE EXCEPTION 'ALREADY_ACCEPTED';
  END IF;

  SELECT ps.*
  INTO v_seat
  FROM command_center.usce_program_seats ps
  WHERE ps.id = v_offer.program_seat_id
  FOR UPDATE;

  IF NOT FOUND OR v_seat.active IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'NO_SEATS';
  END IF;

  IF (v_seat.seats_total - v_seat.seats_held_hard - v_seat.seats_filled) <= 0 THEN
    RAISE EXCEPTION 'NO_SEATS';
  END IF;

  UPDATE command_center.usce_offers
  SET status = 'PENDING_PAYMENT',
      responded_at = now(),
      response = 'ACCEPTED',
      payment_intent_id = p_payment_intent_id,
      payment_intent_created_at = now(),
      updated_at = now()
  WHERE id = v_offer.id;

  INSERT INTO command_center.usce_confirmations (
    offer_id,
    request_id,
    applicant_user_id,
    status,
    amount_cents,
    currency,
    stripe_payment_intent_id,
    seat_lock_type,
    seat_lock_expires_at
  )
  VALUES (
    v_offer.id,
    v_offer.request_id,
    v_offer.applicant_user_id,
    'PENDING_PAYMENT',
    v_offer.amount_cents,
    v_offer.currency,
    p_payment_intent_id,
    'hard',
    now() + interval '30 minutes'
  )
  RETURNING id INTO v_confirmation_id;

  INSERT INTO command_center.usce_outbox (
    entity_type,
    entity_id,
    action,
    payload,
    status,
    idempotency_key
  )
  VALUES (
    'confirmation',
    v_confirmation_id,
    'stripe_payment_intent_create',
    jsonb_build_object(
      'offer_id', v_offer.id,
      'confirmation_id', v_confirmation_id,
      'request_id', v_offer.request_id,
      'student_id', v_offer.applicant_user_id,
      'payment_intent_id', p_payment_intent_id
    ),
    'pending',
    v_offer.id::text || ':' || COALESCE(v_offer.retry_count, 0)::text
  );

  UPDATE command_center.usce_program_seats
  SET seats_held_soft = GREATEST(seats_held_soft - 1, 0),
      seats_held_hard = seats_held_hard + 1
  WHERE id = v_offer.program_seat_id;

  RETURN jsonb_build_object(
    'status', 'PENDING_PAYMENT',
    'offer_id', v_offer.id,
    'request_id', v_offer.request_id,
    'confirmation_id', v_confirmation_id,
    'payment_intent_id', p_payment_intent_id
  );
END;
$function$;

REVOKE ALL ON FUNCTION command_center.usce_portal_respond(text, text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION command_center.usce_portal_respond(text, text, text, uuid) TO authenticated;

COMMIT;
