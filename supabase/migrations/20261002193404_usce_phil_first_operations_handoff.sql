-- USCE-PHIL-FIRST-RENOVATION-20261002; DR-359/DR-360
-- Forward correction only: existing USCE RPCs, no business row or ACL changes.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

CREATE OR REPLACE FUNCTION public.update_usce_offer_operations_state(p_offer_id uuid, p_patch jsonb, p_admin_identity jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'command_center', 'public', 'pg_temp'
AS $function$
DECLARE
  v_offer command_center.usce_offer_drafts%ROWTYPE;
  v_admin text := left(coalesce(nullif(btrim(p_admin_identity->>'login'), ''), nullif(btrim(p_admin_identity->>'wp_id'), ''), 'unknown'), 160);
  v_payment_status text := nullif(lower(coalesce(p_patch->>'payment_status', '')), '');
  v_paperwork_status text := nullif(lower(coalesce(p_patch->>'paperwork_status', '')), '');
  v_learndash_status text := nullif(lower(coalesce(p_patch->>'learndash_status', '')), '');
  v_payment_reference text := nullif(left(regexp_replace(coalesce(p_patch->>'payment_reference', ''), '[[:cntrl:]<>]+', '', 'g'), 240), '');
  v_note text := nullif(left(regexp_replace(coalesce(p_patch->>'note', ''), '[[:cntrl:]]+', ' ', 'g'), 1000), '');
  v_evidence_source text := nullif(btrim(left(regexp_replace(coalesce(p_patch->>'evidence_source', ''), '[[:cntrl:]<>]+', ' ', 'g'), 240)), '');
  v_reason text := nullif(btrim(left(regexp_replace(coalesce(p_patch->>'reason', ''), '[[:cntrl:]<>]+', ' ', 'g'), 1000)), '');
  v_recorded_at timestamptz := now();
  v_previous_status jsonb;
  v_event_type text := 'operations_state_updated';
  v_subject text := 'USCE operations state updated';
  v_comm_id uuid;
BEGIN
  SELECT * INTO v_offer
  FROM command_center.usce_offer_drafts
  WHERE id = p_offer_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  IF NOT coalesce(
    (jsonb_typeof(p_admin_identity->'login') = 'string' AND lower(btrim(p_admin_identity->>'login')) NOT IN ('', 'unknown'))
    OR (jsonb_typeof(p_admin_identity->'wp_id') IN ('number', 'string') AND coalesce(p_admin_identity->>'wp_id', '') ~ '^[1-9][0-9]*$'),
    false
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'admin_identity_required');
  END IF;
  IF jsonb_typeof(p_patch->'evidence_source') IS DISTINCT FROM 'string'
     OR jsonb_typeof(p_patch->'reason') IS DISTINCT FROM 'string'
     OR v_evidence_source IS NULL OR v_reason IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'operations_evidence_required');
  END IF;
  IF jsonb_typeof(p_patch->'expected_revision') IS DISTINCT FROM 'number'
     OR coalesce(p_patch->>'expected_revision', '') !~ '^[1-9][0-9]*$' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'stale_revision');
  END IF;
  IF (p_patch->>'expected_revision')::numeric > 9007199254740991 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'stale_revision');
  END IF;
  IF (p_patch->>'expected_revision')::bigint IS DISTINCT FROM v_offer.revision THEN
    RETURN jsonb_build_object('ok', false, 'error', 'stale_revision');
  END IF;
  IF EXISTS (
    SELECT 1 FROM command_center.usce_send_claims
    WHERE offer_id = v_offer.id AND state IN ('claimed', 'ambiguous')
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'send_requires_reconciliation');
  END IF;
  v_previous_status := jsonb_build_object(
    'payment_status', v_offer.payment_status,
    'paperwork_status', v_offer.paperwork_status,
    'learndash_status', v_offer.learndash_status
  );

  IF v_payment_status IS NOT NULL AND v_payment_status NOT IN ('pending','handoff_shown','paid','failed','refunded','manual_review') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_payment_status');
  END IF;
  IF v_paperwork_status IS NOT NULL AND v_paperwork_status NOT IN ('not_started','requested','received','approved','blocked') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_paperwork_status');
  END IF;
  IF v_learndash_status IS NOT NULL AND v_learndash_status NOT IN ('locked','ready','enabled','blocked') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_learndash_status');
  END IF;

  IF v_payment_status IS NULL AND v_paperwork_status IS NULL AND v_learndash_status IS NULL AND v_payment_reference IS NULL AND v_note IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_patch');
  END IF;

  IF v_payment_status IS NOT NULL THEN
    v_event_type := 'payment_status_updated';
    v_subject := 'USCE payment status updated';
  ELSIF v_paperwork_status IS NOT NULL THEN
    v_event_type := 'paperwork_status_updated';
    v_subject := 'USCE paperwork status updated';
  ELSIF v_learndash_status IS NOT NULL THEN
    v_event_type := 'learndash_status_updated';
    v_subject := 'USCE LearnDash readiness updated';
  END IF;

  UPDATE command_center.usce_offer_drafts
  SET revision = revision + 1,
      preview_hash = NULL,
      preview_revision = NULL,
      preview_payload = NULL,
      message_previewed_at = NULL,
      payment_status = coalesce(v_payment_status, payment_status),
      payment_reference = coalesce(v_payment_reference, payment_reference),
      payment_checked_at = CASE WHEN v_payment_status IS NOT NULL OR v_payment_reference IS NOT NULL THEN now() ELSE payment_checked_at END,
      paperwork_status = coalesce(v_paperwork_status, paperwork_status),
      paperwork_updated_at = CASE WHEN v_paperwork_status IS NOT NULL THEN now() ELSE paperwork_updated_at END,
      learndash_status = coalesce(v_learndash_status, learndash_status),
      learndash_updated_at = CASE WHEN v_learndash_status IS NOT NULL THEN now() ELSE learndash_updated_at END,
      updated_by = v_admin,
      metadata = metadata || jsonb_build_object(
        'last_operations_update', jsonb_build_object(
          'evidence_kind', 'manual_coordinator_record',
          'evidence_source', v_evidence_source,
          'reason', v_reason,
          'previous_status', v_previous_status,
          'payment_status', v_payment_status,
          'paperwork_status', v_paperwork_status,
          'learndash_status', v_learndash_status,
          'payment_reference', v_payment_reference,
          'note', v_note,
          'admin_identity', p_admin_identity,
          'recorded_at', v_recorded_at
        )
      )
  WHERE id = p_offer_id
  RETURNING * INTO v_offer;

  v_comm_id := command_center.usce_log_offer_engine_comm(
    v_offer.id,
    v_offer.intake_request_id,
    v_event_type,
    'SYS',
    v_subject,
    'Manual coordinator record. Source: ' || v_evidence_source || '. Reason: ' || v_reason
      || CASE WHEN v_note IS NULL THEN '' ELSE '. Note: ' || v_note END
      || '. No WooCommerce order, payment, document upload, reservation, or LearnDash enrollment was triggered.',
    jsonb_build_object(
      'evidence_kind', 'manual_coordinator_record',
      'evidence_source', v_evidence_source,
      'reason', v_reason,
      'recorded_at', v_recorded_at,
      'previous_status', v_previous_status,
      'selected_status', jsonb_build_object('payment_status', v_offer.payment_status, 'paperwork_status', v_offer.paperwork_status, 'learndash_status', v_offer.learndash_status),
      'payment_status', v_payment_status,
      'paperwork_status', v_paperwork_status,
      'learndash_status', v_learndash_status,
      'payment_reference', v_payment_reference,
      'admin_identity', p_admin_identity
    ),
    NULL,
    true,
    NULL,
    NULL
  );

  RETURN jsonb_build_object('ok', true, 'item', public.usce_offer_draft_admin_json(v_offer.id), 'comms_id', v_comm_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_usce_offer_by_token_hash(p_token_hash text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'command_center', 'public', 'pg_temp'
AS $function$
DECLARE
  v_offer command_center.usce_offer_drafts%ROWTYPE;
BEGIN
  SELECT * INTO v_offer
  FROM command_center.usce_offer_drafts
  WHERE offer_token_hash = p_token_hash;

  IF NOT FOUND OR v_offer.status IN ('draft', 'archived') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_token');
  END IF;

  IF v_offer.offer_token_expires_at IS NULL OR v_offer.offer_token_expires_at <= now() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'expired');
  END IF;

  RETURN jsonb_build_object('ok', true, 'offer', public.usce_offer_student_json(v_offer.id, v_offer.status = 'accepted'));
END;
$function$;

COMMIT;
