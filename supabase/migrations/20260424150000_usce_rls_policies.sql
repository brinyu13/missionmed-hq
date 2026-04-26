BEGIN;

ALTER TABLE command_center.usce_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE command_center.usce_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE command_center.usce_confirmations ENABLE ROW LEVEL SECURITY;
ALTER TABLE command_center.usce_program_seats ENABLE ROW LEVEL SECURITY;
ALTER TABLE command_center.usce_comms ENABLE ROW LEVEL SECURITY;
ALTER TABLE command_center.usce_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE command_center.usce_retention ENABLE ROW LEVEL SECURITY;
ALTER TABLE command_center.usce_stripe_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS coord_full ON command_center.usce_requests;
CREATE POLICY coord_full ON command_center.usce_requests
  FOR ALL
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'mm_role') IN ('coordinator', 'admin'));

DROP POLICY IF EXISTS applicant_self_via_portal_join ON command_center.usce_requests;
CREATE POLICY applicant_self_via_portal_join ON command_center.usce_requests
  FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1
      FROM command_center.usce_offers o
      WHERE o.request_id = usce_requests.id
        AND o.portal_token_hash = encode(command_center.sha256(current_setting('request.portal_token', true)::bytea), 'hex')
        AND o.portal_token_expires_at > now()
    )
  );

DROP POLICY IF EXISTS coord_full ON command_center.usce_offers;
CREATE POLICY coord_full ON command_center.usce_offers
  FOR ALL
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'mm_role') IN ('coordinator', 'admin'));

DROP POLICY IF EXISTS applicant_view_own_offer ON command_center.usce_offers;
CREATE POLICY applicant_view_own_offer ON command_center.usce_offers
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() IS NOT NULL
    AND auth.uid() = applicant_user_id
    AND portal_token_hash = encode(command_center.sha256(current_setting('request.portal_token', true)::bytea), 'hex')
    AND portal_token_expires_at > now()
  );

DROP POLICY IF EXISTS applicant_mutate_own_offer_response ON command_center.usce_offers;
CREATE POLICY applicant_mutate_own_offer_response ON command_center.usce_offers
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() IS NOT NULL
    AND auth.uid() = applicant_user_id
    AND portal_token_hash = encode(command_center.sha256(current_setting('request.portal_token', true)::bytea), 'hex')
    AND portal_token_expires_at > now()
    AND status IN ('SENT', 'REMINDED', 'FAILED_PAYMENT')
  )
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND auth.uid() = applicant_user_id
    AND status IN ('ACCEPTED', 'DECLINED', 'PENDING_PAYMENT')
  );

DROP POLICY IF EXISTS coord_full ON command_center.usce_confirmations;
CREATE POLICY coord_full ON command_center.usce_confirmations
  FOR ALL
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'mm_role') IN ('coordinator', 'admin'));

DROP POLICY IF EXISTS applicant_view_own ON command_center.usce_confirmations;
CREATE POLICY applicant_view_own ON command_center.usce_confirmations
  FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL AND auth.uid() = applicant_user_id);

DROP POLICY IF EXISTS coord_full ON command_center.usce_comms;
CREATE POLICY coord_full ON command_center.usce_comms
  FOR ALL
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'mm_role') IN ('coordinator', 'admin'));

DROP POLICY IF EXISTS applicant_no_internal_notes ON command_center.usce_comms;
CREATE POLICY applicant_no_internal_notes ON command_center.usce_comms
  FOR SELECT
  TO anon
  USING (
    is_internal_note = false
    AND offer_id IN (
      SELECT id
      FROM command_center.usce_offers
      WHERE portal_token_hash = encode(command_center.sha256(current_setting('request.portal_token', true)::bytea), 'hex')
        AND portal_token_expires_at > now()
    )
  );

COMMIT;
