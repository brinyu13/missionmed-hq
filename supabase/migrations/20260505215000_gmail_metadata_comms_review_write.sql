-- CX-OFFER-326: service-only Gmail metadata review write gate.
-- This RPC writes only admin-approved Gmail metadata into USCE comms.
-- It does not read Gmail, write Gmail, store bodies/snippets, or send email.

CREATE OR REPLACE FUNCTION public.review_write_gmail_metadata_comms(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, command_center
AS $$
DECLARE
  v_mailbox text := lower(trim(coalesce(p_payload ->> 'mailbox', '')));
  v_gmail_message_id text := trim(coalesce(p_payload ->> 'gmail_message_id', ''));
  v_gmail_thread_id text := trim(coalesce(p_payload ->> 'gmail_thread_id', ''));
  v_direction text := upper(trim(coalesce(p_payload ->> 'direction', 'IN')));
  v_review_status text := lower(trim(coalesce(p_payload ->> 'review_status', 'approved')));
  v_dry_run boolean := lower(trim(coalesce(p_payload ->> 'dry_run', 'true'))) <> 'false';
  v_intake_request_id uuid;
  v_offer_draft_id uuid;
  v_offer_intake_request_id uuid;
  v_existing_id uuid;
  v_comms_id uuid;
  v_from_email text := lower(nullif(trim(coalesce(p_payload ->> 'from_email', '')), ''));
  v_to_email text := lower(nullif(trim(coalesce(p_payload ->> 'to_email', '')), ''));
  v_subject_hash text := lower(nullif(trim(coalesce(p_payload ->> 'subject_hash', '')), ''));
  v_message_id_hash text := lower(nullif(trim(coalesce(p_payload ->> 'message_id_hash', '')), ''));
  v_in_reply_to_hash text := lower(nullif(trim(coalesce(p_payload ->> 'in_reply_to_hash', '')), ''));
  v_references_hash text := lower(nullif(trim(coalesce(p_payload ->> 'references_hash', '')), ''));
  v_internal_date timestamptz;
  v_header_date text := nullif(left(trim(coalesce(p_payload ->> 'header_date', '')), 120), '');
  v_match_confidence text := lower(trim(coalesce(p_payload ->> 'match_confidence', 'admin_reviewed')));
  v_match_reasons jsonb := '[]'::jsonb;
  v_reviewed_by jsonb := '{}'::jsonb;
  v_raw_json jsonb;
  v_message_status text;
BEGIN
  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_payload', 'message', 'Gmail comms review payload must be a JSON object.');
  END IF;

  IF p_payload ?| ARRAY['body', 'body_text', 'body_html', 'snippet', 'subject', 'payload', 'parts', 'attachment', 'attachments'] THEN
    RETURN jsonb_build_object('ok', false, 'error', 'gmail_private_content_not_allowed', 'message', 'Raw subject, body, snippet, payload, and attachment fields are not accepted.');
  END IF;

  IF v_mailbox NOT IN ('clinicals@missionmedinstitute.com', 'drj@missionmedinstitute.com', 'drbrian@missionmedinstitute.com') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'gmail_mailbox_not_allowed', 'message', 'mailbox must be allowlisted.');
  END IF;

  IF v_gmail_message_id !~ '^[A-Za-z0-9_-]{1,120}$' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'gmail_message_id_required', 'message', 'gmail_message_id is required.');
  END IF;

  IF v_gmail_thread_id !~ '^[A-Za-z0-9_-]{1,120}$' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'gmail_thread_id_required', 'message', 'gmail_thread_id is required.');
  END IF;

  IF v_direction NOT IN ('IN', 'OUT', 'SYS') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_direction', 'message', 'direction must be IN, OUT, or SYS.');
  END IF;

  IF v_review_status NOT IN ('approved', 'needs_review') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_review_status', 'message', 'review_status must be approved or needs_review.');
  END IF;

  IF v_review_status <> 'approved' AND NOT v_dry_run THEN
    RETURN jsonb_build_object('ok', false, 'error', 'review_not_approved', 'message', 'Non-dry-run writes require review_status approved.');
  END IF;

  BEGIN
    IF nullif(trim(coalesce(p_payload ->> 'intake_request_id', '')), '') IS NOT NULL THEN
      v_intake_request_id := (p_payload ->> 'intake_request_id')::uuid;
    END IF;
    IF nullif(trim(coalesce(p_payload ->> 'offer_draft_id', '')), '') IS NOT NULL THEN
      v_offer_draft_id := (p_payload ->> 'offer_draft_id')::uuid;
    END IF;
  EXCEPTION WHEN invalid_text_representation THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_target_id', 'message', 'Target identifiers must be UUID values.');
  END;

  IF v_intake_request_id IS NULL AND v_offer_draft_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'target_required', 'message', 'Admin must supply intake_request_id or offer_draft_id.');
  END IF;

  IF v_offer_draft_id IS NOT NULL THEN
    SELECT intake_request_id
      INTO v_offer_intake_request_id
      FROM command_center.usce_offer_drafts
      WHERE id = v_offer_draft_id;

    IF v_offer_intake_request_id IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'offer_not_found', 'message', 'Offer target was not found.');
    END IF;

    IF v_intake_request_id IS NOT NULL AND v_intake_request_id <> v_offer_intake_request_id THEN
      RETURN jsonb_build_object('ok', false, 'error', 'target_mismatch', 'message', 'intake_request_id does not match offer_draft_id.');
    END IF;

    v_intake_request_id := v_offer_intake_request_id;
  ELSE
    PERFORM 1
      FROM command_center.usce_public_intake_requests
      WHERE id = v_intake_request_id;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'error', 'intake_not_found', 'message', 'Intake target was not found.');
    END IF;
  END IF;

  SELECT id
    INTO v_existing_id
    FROM command_center.usce_comms
    WHERE raw_json ->> 'source' = 'gmail_metadata_review_write'
      AND raw_json ->> 'mailbox' = v_mailbox
      AND raw_json ->> 'gmail_message_id' = v_gmail_message_id
    LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'comms_id', v_existing_id,
      'dry_run', v_dry_run,
      'would_write', false,
      'written', false,
      'supabase_writes', false,
      'target', jsonb_build_object('intake_request_id', v_intake_request_id, 'offer_id', v_offer_draft_id)
    );
  END IF;

  IF v_from_email IS NOT NULL AND v_from_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    v_from_email := NULL;
  END IF;
  IF v_to_email IS NOT NULL AND v_to_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    v_to_email := NULL;
  END IF;

  IF v_subject_hash IS NOT NULL AND v_subject_hash !~ '^[a-f0-9]{16,64}$' THEN
    v_subject_hash := NULL;
  END IF;
  IF v_message_id_hash IS NOT NULL AND v_message_id_hash !~ '^[a-f0-9]{16,64}$' THEN
    v_message_id_hash := NULL;
  END IF;
  IF v_in_reply_to_hash IS NOT NULL AND v_in_reply_to_hash !~ '^[a-f0-9]{16,64}$' THEN
    v_in_reply_to_hash := NULL;
  END IF;
  IF v_references_hash IS NOT NULL AND v_references_hash !~ '^[a-f0-9]{16,64}$' THEN
    v_references_hash := NULL;
  END IF;

  BEGIN
    IF nullif(trim(coalesce(p_payload ->> 'internal_date', '')), '') IS NOT NULL THEN
      v_internal_date := (p_payload ->> 'internal_date')::timestamptz;
    END IF;
  EXCEPTION WHEN others THEN
    v_internal_date := NULL;
  END;

  IF jsonb_typeof(p_payload -> 'match_reasons') = 'array' THEN
    v_match_reasons := p_payload -> 'match_reasons';
  END IF;

  IF jsonb_typeof(p_payload -> 'reviewed_by') = 'object' THEN
    v_reviewed_by := p_payload -> 'reviewed_by';
  END IF;

  v_message_status := CASE WHEN v_direction = 'IN' THEN 'replied' ELSE 'sent' END;

  v_raw_json := jsonb_build_object(
    'source', 'gmail_metadata_review_write',
    'schema_version', 'CX-OFFER-326',
    'mailbox', v_mailbox,
    'gmail_message_id', v_gmail_message_id,
    'gmail_thread_id', v_gmail_thread_id,
    'dedupe_key', coalesce(nullif(p_payload ->> 'dedupe_key', ''), encode(digest(v_mailbox || ':' || v_gmail_message_id, 'sha256'), 'hex')),
    'offer_draft_id', v_offer_draft_id,
    'subject_redacted', true,
    'subject_hash', v_subject_hash,
    'message_id_hash', v_message_id_hash,
    'in_reply_to_hash', v_in_reply_to_hash,
    'references_hash', v_references_hash,
    'internal_date', v_internal_date,
    'header_date', v_header_date,
    'match_confidence', v_match_confidence,
    'match_reasons', v_match_reasons,
    'review_status', v_review_status,
    'reviewed_by', v_reviewed_by,
    'body_stored', false,
    'snippet_stored', false,
    'gmail_writes', false,
    'dry_run', v_dry_run
  );

  IF v_dry_run THEN
    RETURN jsonb_build_object(
      'ok', true,
      'dry_run', true,
      'would_write', true,
      'written', false,
      'supabase_writes', false,
      'target', jsonb_build_object('intake_request_id', v_intake_request_id, 'offer_id', v_offer_draft_id),
      'comms_preview', jsonb_build_object(
        'intake_request_id', v_intake_request_id,
        'offer_id', v_offer_draft_id,
        'direction', v_direction,
        'message_status', v_message_status,
        'from_email_present', v_from_email IS NOT NULL,
        'to_email_present', v_to_email IS NOT NULL,
        'subject_redacted', true,
        'body_text', NULL,
        'needs_triage', v_match_confidence <> 'high'
      )
    );
  END IF;

  INSERT INTO command_center.usce_comms (
    intake_request_id,
    direction,
    is_internal_note,
    message_status,
    from_email,
    to_email,
    subject,
    body_text,
    raw_json,
    needs_triage
  )
  VALUES (
    v_intake_request_id,
    v_direction,
    false,
    v_message_status,
    v_from_email,
    v_to_email,
    'Gmail metadata event (subject redacted)',
    NULL,
    v_raw_json,
    v_match_confidence <> 'high'
  )
  RETURNING id INTO v_comms_id;

  RETURN jsonb_build_object(
    'ok', true,
    'dry_run', false,
    'would_write', false,
    'written', true,
    'comms_id', v_comms_id,
    'supabase_writes', true,
    'target', jsonb_build_object('intake_request_id', v_intake_request_id, 'offer_id', v_offer_draft_id)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.review_write_gmail_metadata_comms(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.review_write_gmail_metadata_comms(jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.review_write_gmail_metadata_comms(jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.review_write_gmail_metadata_comms(jsonb) TO service_role;
