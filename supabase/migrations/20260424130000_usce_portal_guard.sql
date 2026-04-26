BEGIN;
CREATE OR REPLACE FUNCTION command_center.enforce_portal_mutation_surface()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_portal_token text := current_setting('request.portal_token', true);
  v_old_disallowed jsonb;
  v_new_disallowed jsonb;
BEGIN
  IF v_portal_token IS NULL OR btrim(v_portal_token) = '' THEN
    RETURN NEW;
  END IF;

  v_old_disallowed := to_jsonb(OLD) - ARRAY[
    'status',
    'responded_at',
    'response',
    'payment_intent_id',
    'payment_intent_created_at',
    'retry_count',
    'failed_at'
  ];

  v_new_disallowed := to_jsonb(NEW) - ARRAY[
    'status',
    'responded_at',
    'response',
    'payment_intent_id',
    'payment_intent_created_at',
    'retry_count',
    'failed_at'
  ];

  IF v_new_disallowed IS DISTINCT FROM v_old_disallowed THEN
    RAISE EXCEPTION 'PORTAL_MUTATION_FORBIDDEN';
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS usce_offers_enforce_portal_mutation_surface
ON command_center.usce_offers;
CREATE TRIGGER usce_offers_enforce_portal_mutation_surface
BEFORE UPDATE ON command_center.usce_offers
FOR EACH ROW
EXECUTE FUNCTION command_center.enforce_portal_mutation_surface();
COMMIT;
