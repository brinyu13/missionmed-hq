-- Migration: 20261115153610_usce_reply_sent_copies.sql
-- Authority: DR-545 and Founder authorization for automatic Clinicals HQ replies
-- Date: 2026-11-15
-- Depends on: 20261115014451_usce_clinicals_sent_copies.sql
-- Description: Limit ongoing Gmail Sent copies to replies from the Clinicals mailbox.
-- Idempotent: YES

BEGIN;
CREATE OR REPLACE FUNCTION public.usce_mail_sent_copy(p_action text, p_data jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  pilot uuid := (p_data->>'pilot_id')::uuid;
  cutoff timestamptz := (p_data->>'since')::timestamptz;
  requested uuid := (p_data->>'dispatch_id')::uuid;
  j record;
  affected integer;
BEGIN
  IF (pilot IS NULL) = (cutoff IS NULL) OR p_action NOT IN ('next','reserve','defer','stored') OR
      (p_action <> 'next' AND requested IS NULL) THEN RETURN jsonb_build_object('ok',false); END IF;
  SELECT o.id AS dispatch_id,c.id AS comm_id,c.intake_request_id AS case_id,o.provider_message_id AS provider_id,
    c.from_email,c.to_email,c.subject,o.payload->>'body_text' AS body_text,c.rfc_message_id,c.in_reply_to,
    c.references_ids, o.completed_at AS sent_at,c.gmail_message_id AS existing_gmail_id,
    par.gmail_message_id AS parent_gmail_id,par.gmail_thread_id AS parent_thread_id,par.subject AS parent_subject,
    s.reserved_at IS NOT NULL AS reserved
    INTO j
  FROM command_center.usce_outbox o
  JOIN command_center.usce_comms c ON c.id=o.entity_id
  JOIN command_center.usce_public_intake_requests i ON i.id=c.intake_request_id
  LEFT JOIN command_center.usce_gmail_sent_copies s ON s.dispatch_id=o.id
  LEFT JOIN LATERAL (
    SELECT min(p.gmail_message_id) AS gmail_message_id,min(p.gmail_thread_id) AS gmail_thread_id,min(p.subject) AS subject
    FROM command_center.usce_comms p WHERE p.rfc_message_id=c.in_reply_to
      AND p.intake_request_id=c.intake_request_id AND p.mailbox=c.mailbox AND p.direction='IN'
      AND p.from_email=c.to_email AND p.to_email=c.from_email AND NOT p.needs_triage
    HAVING count(*)=1
  ) par ON true
  WHERE o.action='usce_v3_correspondence' AND o.entity_type='usce_comms' AND o.dispatch_state='provider_accepted'
    AND o.provider_message_id=c.postmark_message_id AND c.mail_state='sent' AND c.direction='OUT'
    AND c.from_email='clinicals@missionmedinstitute.com' AND c.mailbox=c.from_email AND c.to_email=lower(i.email)
    AND c.rfc_message_id='<usce-mail-'||c.id::text||'@missionmedinstitute.com>'
    AND o.payload->>'message_id'=c.id::text AND o.payload->>'from_email'=c.from_email AND o.payload->>'to_email'=c.to_email
    AND o.payload->>'subject'=c.subject AND o.payload->>'body_text'=c.body_text AND o.payload->>'rfc_message_id'=c.rfc_message_id
    AND (o.payload->>'in_reply_to') IS NOT DISTINCT FROM c.in_reply_to
    AND coalesce(o.payload->>'references','')=array_to_string(c.references_ids,' ')
    AND (o.id=pilot OR (cutoff IS NOT NULL AND c.in_reply_to IS NOT NULL AND o.completed_at>=cutoff))
    AND (requested IS NULL OR o.id=requested) AND s.stored_at IS NULL
    AND (p_action<>'next' OR s.next_check_at IS NULL OR s.next_check_at<=now())
  ORDER BY coalesce(s.next_check_at,o.completed_at),o.id LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',p_action='next'); END IF;
  IF p_action='next' THEN RETURN jsonb_build_object('ok',true,'job',to_jsonb(j)); END IF;
  IF p_action='reserve' THEN
    IF (j.existing_gmail_id IS NOT NULL AND j.existing_gmail_id IS DISTINCT FROM (p_data->>'observed_id')) OR (j.in_reply_to IS NOT NULL AND j.parent_thread_id IS NULL) THEN
      RETURN jsonb_build_object('ok',true,'won',false); END IF;
    INSERT INTO command_center.usce_gmail_sent_copies AS s(dispatch_id,reserved_at,next_check_at,last_result)
      VALUES(requested,now(),now()+interval '90 seconds','reserved')
      ON CONFLICT (dispatch_id) DO UPDATE SET reserved_at=now(),next_check_at=excluded.next_check_at,last_result='reserved'
        WHERE s.reserved_at IS NULL AND s.stored_at IS NULL;
    GET DIAGNOSTICS affected=ROW_COUNT;
    RETURN jsonb_build_object('ok',true,'won',affected=1);
  ELSIF p_action='stored' THEN
    IF coalesce(p_data->>'gmail_id','') !~ '^[a-f0-9]{1,40}$' OR coalesce(p_data->>'thread_id','') !~ '^[a-f0-9]{1,40}$'
        OR (j.in_reply_to IS NOT NULL AND (p_data->>'thread_id') IS DISTINCT FROM j.parent_thread_id)
        OR (j.existing_gmail_id IS NOT NULL AND (p_data->>'gmail_id') IS DISTINCT FROM j.existing_gmail_id)
    THEN RETURN jsonb_build_object('ok',false); END IF;
    UPDATE command_center.usce_gmail_sent_copies SET stored_at=now(),gmail_id=p_data->>'gmail_id',
      thread_id=p_data->>'thread_id',last_result='stored'
      WHERE dispatch_id=requested AND reserved_at IS NOT NULL AND stored_at IS NULL;
    GET DIAGNOSTICS affected=ROW_COUNT;
    RETURN jsonb_build_object('ok',affected=1);
  ELSE
    IF coalesce(p_data->>'reason','') NOT IN ('invalid_dispatch','parent_unverified','readback_required','identity_conflict','authorization_required')
      THEN RETURN jsonb_build_object('ok',false); END IF;
    INSERT INTO command_center.usce_gmail_sent_copies AS s(dispatch_id,next_check_at,last_result)
      VALUES(requested,now()+interval '5 minutes',p_data->>'reason')
      ON CONFLICT (dispatch_id) DO UPDATE SET next_check_at=excluded.next_check_at,last_result=excluded.last_result
        WHERE s.stored_at IS NULL;
  END IF;
  RETURN jsonb_build_object('ok',true);
END $$;
COMMIT;
