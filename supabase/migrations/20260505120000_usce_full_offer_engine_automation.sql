-- CX-OFFER-320-FULL-ENGINE-MEGA
-- Full USCE offer-engine automation foundation.
-- Additive only: no auth changes, no public policies, no browser Supabase access,
-- no WooCommerce order creation, no LearnDash enrollment, and no live email send by SQL.

BEGIN;

ALTER TABLE command_center.usce_offer_drafts
  ADD COLUMN IF NOT EXISTS message_category text,
  ADD COLUMN IF NOT EXISTS message_variant text,
  ADD COLUMN IF NOT EXISTS message_subject text,
  ADD COLUMN IF NOT EXISTS message_body text,
  ADD COLUMN IF NOT EXISTS message_previewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS message_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS message_last_idempotency_key text,
  ADD COLUMN IF NOT EXISTS postmark_message_id text,
  ADD COLUMN IF NOT EXISTS postmark_status text NOT NULL DEFAULT 'not_sent',
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS payment_reference text,
  ADD COLUMN IF NOT EXISTS payment_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS paperwork_status text NOT NULL DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS paperwork_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS learndash_status text NOT NULL DEFAULT 'locked',
  ADD COLUMN IF NOT EXISTS learndash_updated_at timestamptz;

COMMENT ON COLUMN command_center.usce_offer_drafts.postmark_status IS
  'USCE offer email state. Dry-run means no live Postmark email was sent.';
COMMENT ON COLUMN command_center.usce_offer_drafts.payment_status IS
  'WooCommerce payment sync state for accepted USCE offers. This table never creates orders or processes payments.';
COMMENT ON COLUMN command_center.usce_offer_drafts.paperwork_status IS
  'Operational paperwork workflow state. No document upload/storage is created by this migration.';
COMMENT ON COLUMN command_center.usce_offer_drafts.learndash_status IS
  'LearnDash access readiness state. This migration does not enroll students.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'usce_offer_drafts_postmark_status_check'
      AND conrelid = 'command_center.usce_offer_drafts'::regclass
  ) THEN
    ALTER TABLE command_center.usce_offer_drafts
      ADD CONSTRAINT usce_offer_drafts_postmark_status_check
      CHECK (postmark_status = ANY (ARRAY['not_sent','dry_run','queued','sent','failed'])) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'usce_offer_drafts_payment_status_check'
      AND conrelid = 'command_center.usce_offer_drafts'::regclass
  ) THEN
    ALTER TABLE command_center.usce_offer_drafts
      ADD CONSTRAINT usce_offer_drafts_payment_status_check
      CHECK (payment_status = ANY (ARRAY['pending','handoff_shown','paid','failed','refunded','manual_review'])) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'usce_offer_drafts_paperwork_status_check'
      AND conrelid = 'command_center.usce_offer_drafts'::regclass
  ) THEN
    ALTER TABLE command_center.usce_offer_drafts
      ADD CONSTRAINT usce_offer_drafts_paperwork_status_check
      CHECK (paperwork_status = ANY (ARRAY['not_started','requested','received','approved','blocked'])) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'usce_offer_drafts_learndash_status_check'
      AND conrelid = 'command_center.usce_offer_drafts'::regclass
  ) THEN
    ALTER TABLE command_center.usce_offer_drafts
      ADD CONSTRAINT usce_offer_drafts_learndash_status_check
      CHECK (learndash_status = ANY (ARRAY['locked','ready','enabled','blocked'])) NOT VALID;
  END IF;
END $$;

ALTER TABLE command_center.usce_offer_drafts VALIDATE CONSTRAINT usce_offer_drafts_postmark_status_check;
ALTER TABLE command_center.usce_offer_drafts VALIDATE CONSTRAINT usce_offer_drafts_payment_status_check;
ALTER TABLE command_center.usce_offer_drafts VALIDATE CONSTRAINT usce_offer_drafts_paperwork_status_check;
ALTER TABLE command_center.usce_offer_drafts VALIDATE CONSTRAINT usce_offer_drafts_learndash_status_check;

CREATE INDEX IF NOT EXISTS usce_offer_drafts_payment_status_idx
  ON command_center.usce_offer_drafts (payment_status);
CREATE INDEX IF NOT EXISTS usce_offer_drafts_paperwork_status_idx
  ON command_center.usce_offer_drafts (paperwork_status);
CREATE INDEX IF NOT EXISTS usce_offer_drafts_learndash_status_idx
  ON command_center.usce_offer_drafts (learndash_status);

ALTER TABLE command_center.usce_comms
  ADD COLUMN IF NOT EXISTS intake_request_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'usce_comms_intake_request_id_fkey'
      AND conrelid = 'command_center.usce_comms'::regclass
  ) THEN
    ALTER TABLE command_center.usce_comms
      ADD CONSTRAINT usce_comms_intake_request_id_fkey
      FOREIGN KEY (intake_request_id)
      REFERENCES command_center.usce_public_intake_requests(id)
      ON DELETE SET NULL
      NOT VALID;
  END IF;
END $$;

ALTER TABLE command_center.usce_comms VALIDATE CONSTRAINT usce_comms_intake_request_id_fkey;

CREATE INDEX IF NOT EXISTS usce_comms_intake_request_idx
  ON command_center.usce_comms (intake_request_id);
CREATE INDEX IF NOT EXISTS usce_comms_offer_draft_raw_idx
  ON command_center.usce_comms ((raw_json ->> 'offer_draft_id'))
  WHERE raw_json ? 'offer_draft_id';

CREATE OR REPLACE FUNCTION command_center.usce_log_offer_engine_comm(
  p_offer_id uuid,
  p_intake_request_id uuid,
  p_event_type text,
  p_direction text DEFAULT 'SYS',
  p_subject text DEFAULT NULL,
  p_body_text text DEFAULT NULL,
  p_raw_json jsonb DEFAULT '{}'::jsonb,
  p_postmark_message_id text DEFAULT NULL,
  p_is_internal_note boolean DEFAULT false,
  p_to_email text DEFAULT NULL,
  p_from_email text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = command_center, public, pg_temp
AS $$
DECLARE
  v_comm_id uuid;
  v_direction text := CASE WHEN upper(coalesce(p_direction, 'SYS')) IN ('OUT','IN','SYS') THEN upper(coalesce(p_direction, 'SYS')) ELSE 'SYS' END;
  v_event_type text := left(regexp_replace(coalesce(p_event_type, 'system_event'), '[^a-zA-Z0-9_.:-]+', '_', 'g'), 80);
  v_subject text := nullif(left(regexp_replace(coalesce(p_subject, ''), '[[:cntrl:]]+', ' ', 'g'), 240), '');
  v_body text := nullif(left(regexp_replace(coalesce(p_body_text, ''), '[[:cntrl:]]+', ' ', 'g'), 6000), '');
  v_to_email text := nullif(left(lower(regexp_replace(coalesce(p_to_email, ''), '[[:cntrl:]<>]+', '', 'g')), 320), '');
  v_from_email text := nullif(left(lower(regexp_replace(coalesce(p_from_email, ''), '[[:cntrl:]<>]+', '', 'g')), 320), '');
BEGIN
  INSERT INTO command_center.usce_comms (
    intake_request_id,
    direction,
    is_internal_note,
    message_status,
    from_email,
    to_email,
    subject,
    body_text,
    postmark_message_id,
    raw_json,
    needs_triage
  ) VALUES (
    p_intake_request_id,
    v_direction,
    CASE WHEN v_direction = 'SYS' THEN coalesce(p_is_internal_note, false) ELSE false END,
    'sent',
    v_from_email,
    v_to_email,
    v_subject,
    v_body,
    nullif(left(coalesce(p_postmark_message_id, ''), 180), ''),
    jsonb_build_object(
      'source', 'CX-OFFER-320',
      'event_type', v_event_type,
      'offer_draft_id', p_offer_id,
      'recorded_at', now()
    ) || coalesce(p_raw_json, '{}'::jsonb),
    false
  ) RETURNING id INTO v_comm_id;

  RETURN v_comm_id;
END;
$$;

REVOKE ALL ON FUNCTION command_center.usce_log_offer_engine_comm(uuid, uuid, text, text, text, text, jsonb, text, boolean, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION command_center.usce_log_offer_engine_comm(uuid, uuid, text, text, text, text, jsonb, text, boolean, text, text) FROM anon;
REVOKE ALL ON FUNCTION command_center.usce_log_offer_engine_comm(uuid, uuid, text, text, text, text, jsonb, text, boolean, text, text) FROM authenticated;

CREATE OR REPLACE FUNCTION public.usce_offer_draft_admin_json(p_offer_id uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = command_center, public, pg_temp
AS $$
  SELECT jsonb_build_object(
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
    'admin_message', o.admin_message,
    'payment_url', o.payment_url,
    'has_token', o.offer_token_hash IS NOT NULL,
    'offer_token_expires_at', o.offer_token_expires_at,
    'accepted_at', o.accepted_at,
    'declined_at', o.declined_at,
    'alternate_requested_at', o.alternate_requested_at,
    'student_response_note', o.student_response_note,
    'message_category', o.message_category,
    'message_variant', o.message_variant,
    'message_subject', o.message_subject,
    'message_body', o.message_body,
    'message_previewed_at', o.message_previewed_at,
    'message_sent_at', o.message_sent_at,
    'postmark_status', o.postmark_status,
    'payment_status', o.payment_status,
    'payment_reference', o.payment_reference,
    'payment_checked_at', o.payment_checked_at,
    'paperwork_status', o.paperwork_status,
    'paperwork_updated_at', o.paperwork_updated_at,
    'learndash_status', o.learndash_status,
    'learndash_updated_at', o.learndash_updated_at,
    'metadata', o.metadata,
    'intake', jsonb_build_object(
      'student_name', r.student_name,
      'email', r.email,
      'status', r.status,
      'preferred_specialties', r.preferred_specialties,
      'preferred_locations', r.preferred_locations,
      'preferred_months_or_dates', r.preferred_months_or_dates,
      'duration_weeks', r.duration_weeks
    )
  )
  FROM command_center.usce_offer_drafts o
  JOIN command_center.usce_public_intake_requests r ON r.id = o.intake_request_id
  WHERE o.id = p_offer_id;
$$;

CREATE OR REPLACE FUNCTION public.usce_offer_student_json(p_offer_id uuid, p_include_payment boolean DEFAULT false)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = command_center, public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'status', o.status,
    'specialty', coalesce(o.specialty, 'To be confirmed'),
    'location', coalesce(o.location, 'To be confirmed'),
    'timing', coalesce(o.timing, 'To be confirmed'),
    'duration', CASE WHEN o.duration_weeks IS NULL THEN 'To be confirmed' ELSE o.duration_weeks::text || ' weeks' END,
    'format', coalesce(o.format, 'In-person clinical exposure'),
    'reference', 'USCE-' || upper(left(replace(o.id::text, '-', ''), 8)),
    'deadlineLabel', CASE
      WHEN o.expires_at IS NULL THEN 'Response deadline will be confirmed by your coordinator.'
      ELSE 'Please respond before ' || to_char(o.expires_at AT TIME ZONE 'America/New_York', 'Mon DD, YYYY HH12:MI AM') || ' ET.'
    END,
    'deadlineDetail', 'After the deadline this offer expires automatically and a new option may be prepared.',
    'message', coalesce(o.admin_message, o.message_body, 'Thank you for your USCE rotation request. Please review the option above and choose accept, decline, or request an alternate.'),
    'expiresAt', o.expires_at,
    'payment_url', CASE WHEN p_include_payment THEN o.payment_url ELSE NULL END,
    'payment_status', o.payment_status,
    'paperwork_status', o.paperwork_status,
    'learndash_status', o.learndash_status,
    'next_steps', jsonb_build_object(
      'payment', CASE WHEN p_include_payment THEN 'Payment handoff is available after acceptance.' ELSE 'Payment is only shown after acceptance.' END,
      'paperwork', 'Onboarding paperwork follows coordinator confirmation and payment readiness.',
      'course_access', 'Course access is enabled only after downstream MissionMed approval gates.'
    )
  )
  FROM command_center.usce_offer_drafts o
  WHERE o.id = p_offer_id;
$$;

CREATE OR REPLACE FUNCTION public.update_usce_offer_message_preview(
  p_offer_id uuid,
  p_message jsonb,
  p_admin_identity jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = command_center, public, pg_temp
AS $$
DECLARE
  v_offer command_center.usce_offer_drafts%ROWTYPE;
  v_admin text := left(coalesce(p_admin_identity->>'login', p_admin_identity->>'wp_id', 'unknown'), 160);
  v_category text := nullif(left(regexp_replace(coalesce(p_message->>'category', 'offer_ready'), '[^a-zA-Z0-9_.:-]+', '_', 'g'), 80), '');
  v_variant text := nullif(left(regexp_replace(coalesce(p_message->>'variant', 'coordinator_clear'), '[^a-zA-Z0-9_.:-]+', '_', 'g'), 80), '');
  v_subject text := nullif(left(regexp_replace(coalesce(p_message->>'subject', ''), '[[:cntrl:]]+', ' ', 'g'), 240), '');
  v_body text := nullif(left(regexp_replace(coalesce(p_message->>'body', p_message->>'body_text', ''), '[[:cntrl:]]+', ' ', 'g'), 6000), '');
  v_comm_id uuid;
BEGIN
  SELECT * INTO v_offer
  FROM command_center.usce_offer_drafts
  WHERE id = p_offer_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  IF v_offer.status = 'archived' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_state');
  END IF;

  UPDATE command_center.usce_offer_drafts
  SET message_category = v_category,
      message_variant = v_variant,
      message_subject = v_subject,
      message_body = v_body,
      message_previewed_at = now(),
      updated_by = v_admin,
      metadata = metadata || jsonb_build_object(
        'last_message_preview', jsonb_build_object(
          'category', v_category,
          'variant', v_variant,
          'admin_identity', p_admin_identity,
          'previewed_at', now()
        )
      )
  WHERE id = p_offer_id
  RETURNING * INTO v_offer;

  v_comm_id := command_center.usce_log_offer_engine_comm(
    v_offer.id,
    v_offer.intake_request_id,
    'message_preview_created',
    'SYS',
    coalesce(v_subject, 'USCE message preview created'),
    coalesce(v_body, 'Message preview created.'),
    jsonb_build_object(
      'category', v_category,
      'variant', v_variant,
      'admin_identity', p_admin_identity,
      'dry_run', true
    ),
    NULL,
    false,
    NULL,
    NULL
  );

  RETURN jsonb_build_object('ok', true, 'item', public.usce_offer_draft_admin_json(v_offer.id), 'comms_id', v_comm_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.record_usce_offer_postmark_send(
  p_offer_id uuid,
  p_message jsonb,
  p_mode text DEFAULT 'dry_run',
  p_idempotency_key text DEFAULT NULL,
  p_postmark_message_id text DEFAULT NULL,
  p_admin_identity jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = command_center, public, pg_temp
AS $$
DECLARE
  v_offer command_center.usce_offer_drafts%ROWTYPE;
  v_admin text := left(coalesce(p_admin_identity->>'login', p_admin_identity->>'wp_id', 'unknown'), 160);
  v_mode text := CASE WHEN lower(coalesce(p_mode, 'dry_run')) = 'live' THEN 'live' ELSE 'dry_run' END;
  v_key text := nullif(left(regexp_replace(coalesce(p_idempotency_key, ''), '[^a-zA-Z0-9_.:-]+', '_', 'g'), 160), '');
  v_subject text := nullif(left(regexp_replace(coalesce(p_message->>'subject', ''), '[[:cntrl:]]+', ' ', 'g'), 240), '');
  v_body text := nullif(left(regexp_replace(coalesce(p_message->>'body', p_message->>'body_text', ''), '[[:cntrl:]]+', ' ', 'g'), 6000), '');
  v_category text := nullif(left(regexp_replace(coalesce(p_message->>'category', 'offer_ready'), '[^a-zA-Z0-9_.:-]+', '_', 'g'), 80), '');
  v_variant text := nullif(left(regexp_replace(coalesce(p_message->>'variant', 'coordinator_clear'), '[^a-zA-Z0-9_.:-]+', '_', 'g'), 80), '');
  v_existing_comm uuid;
  v_comm_id uuid;
  v_to_email text;
  v_postmark_status text;
BEGIN
  SELECT * INTO v_offer
  FROM command_center.usce_offer_drafts
  WHERE id = p_offer_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  IF v_offer.status IN ('archived', 'expired') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_state');
  END IF;

  IF v_key IS NOT NULL THEN
    SELECT id INTO v_existing_comm
    FROM command_center.usce_comms
    WHERE intake_request_id = v_offer.intake_request_id
      AND raw_json ->> 'offer_draft_id' = v_offer.id::text
      AND raw_json ->> 'idempotency_key' = v_key
    ORDER BY created_at DESC
    LIMIT 1;

    IF FOUND THEN
      RETURN jsonb_build_object(
        'ok', true,
        'idempotent', true,
        'dry_run', v_mode <> 'live',
        'mode', v_mode,
        'comms_id', v_existing_comm,
        'item', public.usce_offer_draft_admin_json(v_offer.id)
      );
    END IF;
  END IF;

  SELECT email INTO v_to_email
  FROM command_center.usce_public_intake_requests
  WHERE id = v_offer.intake_request_id;

  v_postmark_status := CASE WHEN v_mode = 'live' THEN 'sent' ELSE 'dry_run' END;

  UPDATE command_center.usce_offer_drafts
  SET status = CASE WHEN status IN ('draft', 'ready', 'viewed') THEN 'sent' ELSE status END,
      message_category = coalesce(v_category, message_category),
      message_variant = coalesce(v_variant, message_variant),
      message_subject = coalesce(v_subject, message_subject),
      message_body = coalesce(v_body, message_body),
      message_last_idempotency_key = v_key,
      postmark_status = v_postmark_status,
      postmark_message_id = nullif(left(coalesce(p_postmark_message_id, ''), 180), ''),
      message_sent_at = CASE WHEN v_mode = 'live' THEN now() ELSE message_sent_at END,
      updated_by = v_admin,
      metadata = metadata || jsonb_build_object(
        'last_postmark_gate', jsonb_build_object(
          'mode', v_mode,
          'dry_run', v_mode <> 'live',
          'category', v_category,
          'variant', v_variant,
          'idempotency_key', v_key,
          'admin_identity', p_admin_identity,
          'recorded_at', now()
        )
      )
  WHERE id = v_offer.id
  RETURNING * INTO v_offer;

  v_comm_id := command_center.usce_log_offer_engine_comm(
    v_offer.id,
    v_offer.intake_request_id,
    CASE WHEN v_mode = 'live' THEN 'offer_email_sent' ELSE 'offer_email_dry_run' END,
    CASE WHEN v_mode = 'live' THEN 'OUT' ELSE 'SYS' END,
    coalesce(v_subject, 'MissionMed Clinicals offer update'),
    coalesce(v_body, 'USCE offer message recorded.'),
    jsonb_build_object(
      'mode', v_mode,
      'dry_run', v_mode <> 'live',
      'category', v_category,
      'variant', v_variant,
      'idempotency_key', v_key,
      'admin_identity', p_admin_identity
    ),
    p_postmark_message_id,
    false,
    v_to_email,
    nullif(left(lower(coalesce(p_message->>'from_email', '')), 320), '')
  );

  RETURN jsonb_build_object(
    'ok', true,
    'dry_run', v_mode <> 'live',
    'mode', v_mode,
    'comms_id', v_comm_id,
    'item', public.usce_offer_draft_admin_json(v_offer.id)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.list_usce_offer_comms(
  p_offer_id uuid,
  p_limit integer DEFAULT 50
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = command_center, public, pg_temp
AS $$
DECLARE
  v_offer command_center.usce_offer_drafts%ROWTYPE;
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
  v_items jsonb;
BEGIN
  SELECT * INTO v_offer
  FROM command_center.usce_offer_drafts
  WHERE id = p_offer_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  SELECT coalesce(jsonb_agg(item ORDER BY created_at DESC), '[]'::jsonb)
  INTO v_items
  FROM (
    SELECT
      c.created_at,
      jsonb_build_object(
        'id', c.id,
        'created_at', c.created_at,
        'direction', c.direction,
        'is_internal_note', c.is_internal_note,
        'message_status', c.message_status,
        'subject', c.subject,
        'body_text', c.body_text,
        'postmark_message_id', c.postmark_message_id,
        'event_type', c.raw_json ->> 'event_type',
        'raw_json', c.raw_json
      ) AS item
    FROM command_center.usce_comms c
    WHERE c.intake_request_id = v_offer.intake_request_id
      AND c.raw_json ->> 'offer_draft_id' = v_offer.id::text
    ORDER BY c.created_at DESC
    LIMIT v_limit
  ) q;

  RETURN jsonb_build_object('ok', true, 'items', v_items, 'offer_id', p_offer_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.update_usce_offer_operations_state(
  p_offer_id uuid,
  p_patch jsonb,
  p_admin_identity jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = command_center, public, pg_temp
AS $$
DECLARE
  v_offer command_center.usce_offer_drafts%ROWTYPE;
  v_admin text := left(coalesce(p_admin_identity->>'login', p_admin_identity->>'wp_id', 'unknown'), 160);
  v_payment_status text := nullif(lower(coalesce(p_patch->>'payment_status', '')), '');
  v_paperwork_status text := nullif(lower(coalesce(p_patch->>'paperwork_status', '')), '');
  v_learndash_status text := nullif(lower(coalesce(p_patch->>'learndash_status', '')), '');
  v_payment_reference text := nullif(left(regexp_replace(coalesce(p_patch->>'payment_reference', ''), '[[:cntrl:]<>]+', '', 'g'), 240), '');
  v_note text := nullif(left(regexp_replace(coalesce(p_patch->>'note', ''), '[[:cntrl:]]+', ' ', 'g'), 1000), '');
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
  SET payment_status = coalesce(v_payment_status, payment_status),
      payment_reference = coalesce(v_payment_reference, payment_reference),
      payment_checked_at = CASE WHEN v_payment_status IS NOT NULL OR v_payment_reference IS NOT NULL THEN now() ELSE payment_checked_at END,
      paperwork_status = coalesce(v_paperwork_status, paperwork_status),
      paperwork_updated_at = CASE WHEN v_paperwork_status IS NOT NULL THEN now() ELSE paperwork_updated_at END,
      learndash_status = coalesce(v_learndash_status, learndash_status),
      learndash_updated_at = CASE WHEN v_learndash_status IS NOT NULL THEN now() ELSE learndash_updated_at END,
      updated_by = v_admin,
      metadata = metadata || jsonb_build_object(
        'last_operations_update', jsonb_build_object(
          'payment_status', v_payment_status,
          'paperwork_status', v_paperwork_status,
          'learndash_status', v_learndash_status,
          'payment_reference', v_payment_reference,
          'note', v_note,
          'admin_identity', p_admin_identity,
          'recorded_at', now()
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
    coalesce(v_note, v_subject || '. No WooCommerce order, payment, document upload, or LearnDash enrollment was triggered by this state update.'),
    jsonb_build_object(
      'payment_status', v_payment_status,
      'paperwork_status', v_paperwork_status,
      'learndash_status', v_learndash_status,
      'payment_reference', v_payment_reference,
      'admin_identity', p_admin_identity
    ),
    NULL,
    false,
    NULL,
    NULL
  );

  RETURN jsonb_build_object('ok', true, 'item', public.usce_offer_draft_admin_json(v_offer.id), 'comms_id', v_comm_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.mint_usce_offer_token(
  p_offer_id uuid,
  p_token_hash text,
  p_expires_at timestamptz,
  p_admin_identity jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = command_center, public, pg_temp
AS $$
DECLARE
  v_offer command_center.usce_offer_drafts%ROWTYPE;
  v_admin text := left(coalesce(p_admin_identity->>'login', p_admin_identity->>'wp_id', 'unknown'), 160);
  v_comm_id uuid;
BEGIN
  IF p_token_hash IS NULL OR length(p_token_hash) <> 64 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_token_hash');
  END IF;

  SELECT * INTO v_offer
  FROM command_center.usce_offer_drafts
  WHERE id = p_offer_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  IF v_offer.status IN ('accepted', 'declined', 'alternate_requested', 'expired', 'archived') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_state');
  END IF;

  UPDATE command_center.usce_offer_drafts
  SET offer_token_hash = p_token_hash,
      offer_token_expires_at = p_expires_at,
      expires_at = coalesce(expires_at, p_expires_at),
      status = CASE WHEN status = 'draft' THEN 'ready' ELSE status END,
      updated_by = v_admin,
      metadata = metadata || jsonb_build_object('token_minted_by', p_admin_identity, 'token_minted_at', now())
  WHERE id = p_offer_id
  RETURNING * INTO v_offer;

  v_comm_id := command_center.usce_log_offer_engine_comm(
    v_offer.id,
    v_offer.intake_request_id,
    'offer_link_generated',
    'SYS',
    'USCE offer portal link generated',
    'A tokenized offer portal link was generated by a privileged admin. Only the SHA-256 token hash is stored.',
    jsonb_build_object(
      'stored_token_material', 'sha256_hash_only',
      'token_expires_at', p_expires_at,
      'admin_identity', p_admin_identity
    ),
    NULL,
    false,
    NULL,
    NULL
  );

  RETURN jsonb_build_object(
    'ok', true,
    'item', public.usce_offer_draft_admin_json(v_offer.id),
    'token_expires_at', v_offer.offer_token_expires_at,
    'stored_token_material', 'sha256_hash_only',
    'comms_id', v_comm_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.respond_usce_offer_by_token_hash(
  p_token_hash text,
  p_action text,
  p_note text DEFAULT NULL,
  p_consent boolean DEFAULT false,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = command_center, public, pg_temp
AS $$
DECLARE
  v_offer command_center.usce_offer_drafts%ROWTYPE;
  v_action text := lower(trim(coalesce(p_action, '')));
  v_target_status text;
  v_event_type text;
  v_comm_id uuid;
BEGIN
  IF v_action NOT IN ('accept', 'decline', 'request_alternate') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_action');
  END IF;

  SELECT * INTO v_offer
  FROM command_center.usce_offer_drafts
  WHERE offer_token_hash = p_token_hash
  FOR UPDATE;

  IF NOT FOUND OR v_offer.status IN ('draft', 'archived') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_token');
  END IF;

  IF v_offer.offer_token_expires_at IS NULL OR v_offer.offer_token_expires_at <= now() THEN
    UPDATE command_center.usce_offer_drafts
    SET status = 'expired'
    WHERE id = v_offer.id
      AND status NOT IN ('accepted', 'declined', 'alternate_requested', 'archived');
    RETURN jsonb_build_object('ok', false, 'error', 'expired');
  END IF;

  v_target_status := CASE v_action
    WHEN 'accept' THEN 'accepted'
    WHEN 'decline' THEN 'declined'
    ELSE 'alternate_requested'
  END;

  IF v_offer.status IN ('accepted', 'declined', 'alternate_requested') THEN
    IF v_offer.status = v_target_status THEN
      RETURN jsonb_build_object('ok', true, 'idempotent', true, 'offer', public.usce_offer_student_json(v_offer.id, v_target_status = 'accepted'));
    END IF;

    RETURN jsonb_build_object('ok', false, 'error', 'already_responded');
  END IF;

  IF v_offer.status NOT IN ('ready', 'sent', 'viewed') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_state');
  END IF;

  UPDATE command_center.usce_offer_drafts
  SET status = v_target_status,
      accepted_at = CASE WHEN v_action = 'accept' THEN now() ELSE accepted_at END,
      declined_at = CASE WHEN v_action = 'decline' THEN now() ELSE declined_at END,
      alternate_requested_at = CASE WHEN v_action = 'request_alternate' THEN now() ELSE alternate_requested_at END,
      payment_status = CASE WHEN v_action = 'accept' THEN 'handoff_shown' ELSE payment_status END,
      payment_checked_at = CASE WHEN v_action = 'accept' THEN now() ELSE payment_checked_at END,
      student_response_note = left(regexp_replace(coalesce(p_note, ''), '[[:cntrl:]]+', ' ', 'g'), 1000),
      metadata = metadata || jsonb_build_object(
        'last_student_response', jsonb_build_object(
          'action', v_action,
          'consent', coalesce(p_consent, false),
          'metadata', coalesce(p_metadata, '{}'::jsonb),
          'recorded_at', now()
        )
      )
  WHERE id = v_offer.id
  RETURNING * INTO v_offer;

  v_event_type := CASE v_action
    WHEN 'accept' THEN 'student_accepted_offer'
    WHEN 'decline' THEN 'student_declined_offer'
    ELSE 'student_requested_alternate'
  END;

  v_comm_id := command_center.usce_log_offer_engine_comm(
    v_offer.id,
    v_offer.intake_request_id,
    v_event_type,
    'SYS',
    CASE v_action
      WHEN 'accept' THEN 'Student accepted USCE offer'
      WHEN 'decline' THEN 'Student declined USCE offer'
      ELSE 'Student requested alternate USCE option'
    END,
    coalesce(nullif(left(regexp_replace(coalesce(p_note, ''), '[[:cntrl:]]+', ' ', 'g'), 1000), ''), 'Student response recorded through tokenized offer portal.'),
    jsonb_build_object(
      'action', v_action,
      'target_status', v_target_status,
      'metadata', coalesce(p_metadata, '{}'::jsonb)
    ),
    NULL,
    false,
    NULL,
    NULL
  );

  IF v_action = 'accept' THEN
    PERFORM command_center.usce_log_offer_engine_comm(
      v_offer.id,
      v_offer.intake_request_id,
      'payment_handoff_shown',
      'SYS',
      'WooCommerce payment handoff shown',
      'Canonical MissionMed USCE Clinical Rotations payment handoff was returned after acceptance. No order or payment was created by MissionMed HQ.',
      jsonb_build_object(
        'payment_url', v_offer.payment_url,
        'payment_status', v_offer.payment_status,
        'student_response_comms_id', v_comm_id
      ),
      NULL,
      false,
      NULL,
      NULL
    );
  END IF;

  RETURN jsonb_build_object('ok', true, 'offer', public.usce_offer_student_json(v_offer.id, v_target_status = 'accepted'), 'comms_id', v_comm_id);
END;
$$;

REVOKE ALL ON FUNCTION public.update_usce_offer_message_preview(uuid, jsonb, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_usce_offer_message_preview(uuid, jsonb, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.update_usce_offer_message_preview(uuid, jsonb, jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.update_usce_offer_message_preview(uuid, jsonb, jsonb) TO service_role;

REVOKE ALL ON FUNCTION public.record_usce_offer_postmark_send(uuid, jsonb, text, text, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_usce_offer_postmark_send(uuid, jsonb, text, text, text, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.record_usce_offer_postmark_send(uuid, jsonb, text, text, text, jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.record_usce_offer_postmark_send(uuid, jsonb, text, text, text, jsonb) TO service_role;

REVOKE ALL ON FUNCTION public.list_usce_offer_comms(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_usce_offer_comms(uuid, integer) FROM anon;
REVOKE ALL ON FUNCTION public.list_usce_offer_comms(uuid, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.list_usce_offer_comms(uuid, integer) TO service_role;

REVOKE ALL ON FUNCTION public.update_usce_offer_operations_state(uuid, jsonb, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_usce_offer_operations_state(uuid, jsonb, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.update_usce_offer_operations_state(uuid, jsonb, jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.update_usce_offer_operations_state(uuid, jsonb, jsonb) TO service_role;

REVOKE ALL ON FUNCTION public.mint_usce_offer_token(uuid, text, timestamptz, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mint_usce_offer_token(uuid, text, timestamptz, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.mint_usce_offer_token(uuid, text, timestamptz, jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.mint_usce_offer_token(uuid, text, timestamptz, jsonb) TO service_role;

REVOKE ALL ON FUNCTION public.respond_usce_offer_by_token_hash(text, text, text, boolean, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.respond_usce_offer_by_token_hash(text, text, text, boolean, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.respond_usce_offer_by_token_hash(text, text, text, boolean, jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.respond_usce_offer_by_token_hash(text, text, text, boolean, jsonb) TO service_role;

REVOKE ALL ON FUNCTION public.usce_offer_draft_admin_json(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.usce_offer_draft_admin_json(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.usce_offer_draft_admin_json(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.usce_offer_draft_admin_json(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.usce_offer_student_json(uuid, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.usce_offer_student_json(uuid, boolean) FROM anon;
REVOKE ALL ON FUNCTION public.usce_offer_student_json(uuid, boolean) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.usce_offer_student_json(uuid, boolean) TO service_role;

COMMIT;
