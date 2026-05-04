-- CX-OFFER-315-WIRING
-- Request-first USCE offer draft/token portal foundation.
-- Browser code never receives service-role credentials and never calls these RPCs directly.

BEGIN;

CREATE TABLE IF NOT EXISTS command_center.usce_offer_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  intake_request_id uuid NOT NULL REFERENCES command_center.usce_public_intake_requests(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by text,
  updated_by text,
  status text NOT NULL DEFAULT 'draft',
  specialty text,
  location text,
  timing text,
  duration_weeks integer,
  format text NOT NULL DEFAULT 'In-person clinical exposure',
  expires_at timestamptz,
  admin_message text,
  payment_url text NOT NULL DEFAULT 'https://missionmedinstitute.com/product/usce-clinical-rotations/',
  offer_token_hash text,
  offer_token_expires_at timestamptz,
  accepted_at timestamptz,
  declined_at timestamptz,
  alternate_requested_at timestamptz,
  student_response_note text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT usce_offer_drafts_status_check
    CHECK (status = ANY (ARRAY[
      'draft',
      'ready',
      'sent',
      'viewed',
      'accepted',
      'declined',
      'alternate_requested',
      'expired',
      'archived'
    ])),
  CONSTRAINT usce_offer_drafts_duration_check
    CHECK (duration_weeks IS NULL OR duration_weeks BETWEEN 1 AND 24),
  CONSTRAINT usce_offer_drafts_token_hash_check
    CHECK (offer_token_hash IS NULL OR length(offer_token_hash) = 64),
  CONSTRAINT usce_offer_drafts_payment_url_check
    CHECK (payment_url = 'https://missionmedinstitute.com/product/usce-clinical-rotations/')
);

COMMENT ON TABLE command_center.usce_offer_drafts IS
  'Request-first student-safe USCE offer draft and token state linked to public intake rows. This table does not create payments, emails, notifications, WooCommerce orders, or LearnDash enrollments.';
COMMENT ON COLUMN command_center.usce_offer_drafts.offer_token_hash IS
  'SHA-256 hash of the raw one-time portal token. The raw token is returned once by Railway and is not stored.';
COMMENT ON COLUMN command_center.usce_offer_drafts.payment_url IS
  'Canonical WooCommerce handoff URL returned only after tokenized student acceptance. No order is created here.';

CREATE UNIQUE INDEX IF NOT EXISTS usce_offer_drafts_intake_request_key
  ON command_center.usce_offer_drafts (intake_request_id);

CREATE UNIQUE INDEX IF NOT EXISTS usce_offer_drafts_token_hash_key
  ON command_center.usce_offer_drafts (offer_token_hash)
  WHERE offer_token_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS usce_offer_drafts_status_idx
  ON command_center.usce_offer_drafts (status);

CREATE INDEX IF NOT EXISTS usce_offer_drafts_created_idx
  ON command_center.usce_offer_drafts (created_at DESC);

ALTER TABLE command_center.usce_offer_drafts ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE command_center.usce_offer_drafts FROM PUBLIC;
REVOKE ALL ON TABLE command_center.usce_offer_drafts FROM anon;
REVOKE ALL ON TABLE command_center.usce_offer_drafts FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON command_center.usce_offer_drafts TO service_role;

DROP TRIGGER IF EXISTS usce_offer_drafts_set_updated_at
  ON command_center.usce_offer_drafts;
CREATE TRIGGER usce_offer_drafts_set_updated_at
BEFORE UPDATE ON command_center.usce_offer_drafts
FOR EACH ROW
EXECUTE FUNCTION command_center.usce_set_updated_at();

DROP TRIGGER IF EXISTS usce_offer_drafts_audit_trigger
  ON command_center.usce_offer_drafts;
CREATE TRIGGER usce_offer_drafts_audit_trigger
AFTER INSERT OR UPDATE OR DELETE ON command_center.usce_offer_drafts
FOR EACH ROW
EXECUTE FUNCTION command_center.audit_trigger_fn();

CREATE OR REPLACE FUNCTION public.save_usce_offer_draft(
  p_intake_request_id uuid,
  p_offer jsonb,
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
  v_duration integer;
  v_expires_at timestamptz;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM command_center.usce_public_intake_requests
    WHERE id = p_intake_request_id
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'intake_not_found');
  END IF;

  IF coalesce(p_offer->>'duration_weeks', '') ~ '^[0-9]+$' THEN
    v_duration := (p_offer->>'duration_weeks')::integer;
  END IF;

  IF nullif(p_offer->>'expires_at', '') IS NOT NULL THEN
    v_expires_at := (p_offer->>'expires_at')::timestamptz;
  ELSE
    v_expires_at := now() + interval '14 days';
  END IF;

  INSERT INTO command_center.usce_offer_drafts (
    intake_request_id,
    created_by,
    updated_by,
    status,
    specialty,
    location,
    timing,
    duration_weeks,
    format,
    expires_at,
    admin_message,
    payment_url,
    metadata
  )
  VALUES (
    p_intake_request_id,
    v_admin,
    v_admin,
    coalesce(nullif(p_offer->>'status', ''), 'draft'),
    nullif(p_offer->>'specialty', ''),
    nullif(p_offer->>'location', ''),
    nullif(p_offer->>'timing', ''),
    v_duration,
    coalesce(nullif(p_offer->>'format', ''), 'In-person clinical exposure'),
    v_expires_at,
    nullif(p_offer->>'admin_message', ''),
    'https://missionmedinstitute.com/product/usce-clinical-rotations/',
    jsonb_build_object(
      'source', 'CX-OFFER-315',
      'admin_identity', p_admin_identity,
      'draft_metadata', coalesce(p_offer->'metadata', '{}'::jsonb)
    )
  )
  ON CONFLICT (intake_request_id)
  DO UPDATE SET
    updated_by = excluded.updated_by,
    status = CASE
      WHEN command_center.usce_offer_drafts.status IN ('accepted', 'declined', 'alternate_requested', 'expired')
        THEN command_center.usce_offer_drafts.status
      ELSE excluded.status
    END,
    specialty = excluded.specialty,
    location = excluded.location,
    timing = excluded.timing,
    duration_weeks = excluded.duration_weeks,
    format = excluded.format,
    expires_at = excluded.expires_at,
    admin_message = excluded.admin_message,
    payment_url = excluded.payment_url,
    metadata = command_center.usce_offer_drafts.metadata || excluded.metadata
  RETURNING * INTO v_offer;

  RETURN jsonb_build_object('ok', true, 'item', public.usce_offer_draft_admin_json(v_offer.id));
END;
$$;

CREATE OR REPLACE FUNCTION public.update_usce_offer_draft(
  p_offer_id uuid,
  p_offer jsonb,
  p_admin_identity jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = command_center, public, pg_temp
AS $$
DECLARE
  v_offer command_center.usce_offer_drafts%ROWTYPE;
  v_existing command_center.usce_offer_drafts%ROWTYPE;
  v_admin text := left(coalesce(p_admin_identity->>'login', p_admin_identity->>'wp_id', 'unknown'), 160);
  v_duration integer;
  v_expires_at timestamptz;
  v_status text := nullif(p_offer->>'status', '');
BEGIN
  SELECT * INTO v_existing
  FROM command_center.usce_offer_drafts
  WHERE id = p_offer_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  IF v_existing.status IN ('accepted', 'declined', 'alternate_requested', 'expired') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_state');
  END IF;

  IF coalesce(p_offer->>'duration_weeks', '') ~ '^[0-9]+$' THEN
    v_duration := (p_offer->>'duration_weeks')::integer;
  ELSE
    v_duration := v_existing.duration_weeks;
  END IF;

  IF nullif(p_offer->>'expires_at', '') IS NOT NULL THEN
    v_expires_at := (p_offer->>'expires_at')::timestamptz;
  ELSE
    v_expires_at := v_existing.expires_at;
  END IF;

  UPDATE command_center.usce_offer_drafts
  SET updated_by = v_admin,
      status = coalesce(v_status, status),
      specialty = coalesce(nullif(p_offer->>'specialty', ''), specialty),
      location = coalesce(nullif(p_offer->>'location', ''), location),
      timing = coalesce(nullif(p_offer->>'timing', ''), timing),
      duration_weeks = v_duration,
      format = coalesce(nullif(p_offer->>'format', ''), format),
      expires_at = v_expires_at,
      admin_message = coalesce(nullif(p_offer->>'admin_message', ''), admin_message),
      metadata = metadata || jsonb_build_object(
        'last_admin_update', p_admin_identity,
        'draft_metadata', coalesce(p_offer->'metadata', '{}'::jsonb)
      )
  WHERE id = p_offer_id
  RETURNING * INTO v_offer;

  RETURN jsonb_build_object('ok', true, 'item', public.usce_offer_draft_admin_json(v_offer.id));
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

  RETURN jsonb_build_object(
    'ok', true,
    'item', public.usce_offer_draft_admin_json(v_offer.id),
    'token_expires_at', v_offer.offer_token_expires_at,
    'stored_token_material', 'sha256_hash_only'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_usce_offer_draft_admin(p_offer_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = command_center, public, pg_temp
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM command_center.usce_offer_drafts WHERE id = p_offer_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  RETURN jsonb_build_object('ok', true, 'item', public.usce_offer_draft_admin_json(p_offer_id));
END;
$$;

CREATE OR REPLACE FUNCTION public.get_usce_offer_by_token_hash(p_token_hash text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = command_center, public, pg_temp
AS $$
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

  RETURN jsonb_build_object('ok', true, 'offer', public.usce_offer_student_json(v_offer.id, false));
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

  RETURN jsonb_build_object('ok', true, 'offer', public.usce_offer_student_json(v_offer.id, v_target_status = 'accepted'));
END;
$$;

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
    'message', coalesce(o.admin_message, 'Thank you for your USCE rotation request. Please review the option above and choose accept, decline, or request an alternate.'),
    'expiresAt', o.expires_at,
    'payment_url', CASE WHEN p_include_payment THEN o.payment_url ELSE NULL END
  )
  FROM command_center.usce_offer_drafts o
  WHERE o.id = p_offer_id;
$$;

REVOKE ALL ON FUNCTION public.save_usce_offer_draft(uuid, jsonb, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.save_usce_offer_draft(uuid, jsonb, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.save_usce_offer_draft(uuid, jsonb, jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.save_usce_offer_draft(uuid, jsonb, jsonb) TO service_role;

REVOKE ALL ON FUNCTION public.update_usce_offer_draft(uuid, jsonb, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_usce_offer_draft(uuid, jsonb, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.update_usce_offer_draft(uuid, jsonb, jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.update_usce_offer_draft(uuid, jsonb, jsonb) TO service_role;

REVOKE ALL ON FUNCTION public.mint_usce_offer_token(uuid, text, timestamptz, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mint_usce_offer_token(uuid, text, timestamptz, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.mint_usce_offer_token(uuid, text, timestamptz, jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.mint_usce_offer_token(uuid, text, timestamptz, jsonb) TO service_role;

REVOKE ALL ON FUNCTION public.get_usce_offer_draft_admin(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_usce_offer_draft_admin(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.get_usce_offer_draft_admin(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_usce_offer_draft_admin(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.get_usce_offer_by_token_hash(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_usce_offer_by_token_hash(text) FROM anon;
REVOKE ALL ON FUNCTION public.get_usce_offer_by_token_hash(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_usce_offer_by_token_hash(text) TO service_role;

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

