-- CX-OFFER-312-WIRING
-- Service-only admin write RPCs for command_center.usce_public_intake_requests.
-- Browser code must never call these directly; Railway performs the privileged WordPress authority gate first.

CREATE OR REPLACE FUNCTION public.update_usce_public_intake_request_status(
  p_request_id uuid,
  p_status text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = command_center, public, pg_temp
AS $$
DECLARE
  v_status text := lower(trim(coalesce(p_status, '')));
  v_row command_center.usce_public_intake_requests%ROWTYPE;
BEGIN
  IF v_status NOT IN ('new', 'reviewed', 'in_progress', 'offer_ready', 'archived') THEN
    RAISE EXCEPTION 'invalid_usce_public_intake_status' USING ERRCODE = '22023';
  END IF;

  UPDATE command_center.usce_public_intake_requests
  SET status = v_status
  WHERE id = p_request_id
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'item', jsonb_build_object(
      'id', v_row.id,
      'status', v_row.status,
      'admin_notes', v_row.admin_notes,
      'updated_at', v_row.updated_at
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.update_usce_public_intake_request_admin_note(
  p_request_id uuid,
  p_admin_note text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = command_center, public, pg_temp
AS $$
DECLARE
  v_note text := left(regexp_replace(coalesce(p_admin_note, ''), '[[:cntrl:]]+', ' ', 'g'), 4000);
  v_row command_center.usce_public_intake_requests%ROWTYPE;
BEGIN
  v_note := btrim(v_note);
  IF v_note = '' THEN
    RAISE EXCEPTION 'invalid_usce_public_intake_admin_note' USING ERRCODE = '22023';
  END IF;

  UPDATE command_center.usce_public_intake_requests
  SET admin_notes = v_note
  WHERE id = p_request_id
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'item', jsonb_build_object(
      'id', v_row.id,
      'status', v_row.status,
      'admin_notes', v_row.admin_notes,
      'updated_at', v_row.updated_at
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.update_usce_public_intake_request_status(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_usce_public_intake_request_status(uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.update_usce_public_intake_request_status(uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.update_usce_public_intake_request_status(uuid, text) TO service_role;

REVOKE ALL ON FUNCTION public.update_usce_public_intake_request_admin_note(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_usce_public_intake_request_admin_note(uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.update_usce_public_intake_request_admin_note(uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.update_usce_public_intake_request_admin_note(uuid, text) TO service_role;
