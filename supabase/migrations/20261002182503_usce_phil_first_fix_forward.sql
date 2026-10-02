-- USCE-PHIL-FIRST-RENOVATION-20261002; DR359/360; reviewed fix-forward only.
-- Five private USCE operational tables RLS, explicit saved instruction clearing.
-- No cron/payment/business row changes. Original safety migration immutable.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

ALTER TABLE command_center.usce_cron_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE command_center.usce_dead_letter ENABLE ROW LEVEL SECURITY;
ALTER TABLE command_center.usce_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE command_center.usce_postmark_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE command_center.usce_webhook_nonces ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.update_usce_offer_draft(p_offer_id uuid, p_offer jsonb, p_admin_identity jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'command_center', 'public', 'pg_temp'
AS $function$
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

  IF v_existing.status IN ('accepted', 'declined', 'alternate_requested', 'expired', 'archived', 'decline_pending', 'declined_notify_future', 'declined_no_notify') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_state');
  END IF;

  IF (p_offer->>'expected_revision')::bigint IS DISTINCT FROM v_existing.revision THEN
    RETURN jsonb_build_object('ok', false, 'error', 'stale_revision');
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
      admin_message = CASE WHEN p_offer ? 'admin_message' THEN nullif(p_offer->>'admin_message','') ELSE admin_message END,
      metadata = metadata || jsonb_build_object(
        'last_admin_update', p_admin_identity,
        'draft_metadata', coalesce(p_offer->'metadata', '{}'::jsonb)
      )
  WHERE id = p_offer_id
  RETURNING * INTO v_offer;

  RETURN jsonb_build_object('ok', true, 'item', public.usce_offer_draft_admin_json(v_offer.id));
END;
$function$;

COMMIT;
