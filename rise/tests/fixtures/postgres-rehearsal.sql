\set ON_ERROR_STOP on

CREATE TEMP TABLE rehearsal_checks (
  check_name text PRIMARY KEY,
  passed boolean NOT NULL
);

INSERT INTO rise.registry_releases (
  release_id, source_snapshot_id, source_sha256, activation_status, counts,
  data_classification, source_authorization_set_sha256
) VALUES
  ('rise_registry_blocked', 'snapshot-blocked', repeat('1', 64), 'staging', '{}',
   'source_controlled_registry', repeat('a', 64)),
  ('rise_registry_a', 'snapshot-a', repeat('2', 64), 'staging', '{"programs":1}',
   'source_controlled_registry', repeat('b', 64)),
  ('rise_registry_b', 'snapshot-b', repeat('3', 64), 'staging', '{"programs":1}',
   'source_controlled_registry', repeat('c', 64)),
  ('rise_registry_revoked', 'snapshot-revoked', repeat('4', 64), 'staging', '{"programs":1}',
   'source_controlled_registry', repeat('d', 64));

DO $$
BEGIN
  PERFORM rise.set_active_registry_release(
    'rise_registry_blocked', 'activate', NULL, 'rehearsal-operator', 'must fail without evidence'
  );
  RAISE EXCEPTION 'missing-evidence activation unexpectedly succeeded';
EXCEPTION
  WHEN SQLSTATE '55000' THEN
    INSERT INTO rehearsal_checks VALUES ('missing_evidence_activation_rejected', true);
END
$$;

INSERT INTO rise.source_documents (
  release_id, source_document_id, authority, assertion_class, source_urls, retrieved_at
) VALUES
  ('rise_registry_a', 'source-a', 'OFFICIAL_REHEARSAL', 'authoritative', '[]', current_date),
  ('rise_registry_b', 'source-b', 'OFFICIAL_REHEARSAL', 'authoritative', '[]', current_date),
  ('rise_registry_revoked', 'source-revoked', 'OFFICIAL_REHEARSAL', 'authoritative', '[]', current_date);

INSERT INTO rise.programs (
  release_id, program_id, canonical_external_id, program_name, source_document_id
) VALUES
  ('rise_registry_a', 'program-a', 'external-a', 'Rehearsal Program A', 'source-a'),
  ('rise_registry_b', 'program-b', 'external-b', 'Rehearsal Program B', 'source-b'),
  ('rise_registry_revoked', 'program-revoked', 'external-revoked', 'Revoked Rehearsal Program', 'source-revoked');

INSERT INTO rise.source_authorization_receipts (
  release_id, source_authority, authorization_basis, authorization_sha256,
  decision_record_id, verified_by_subject, verified_at, valid_through
) VALUES
  ('rise_registry_a', 'OFFICIAL_REHEARSAL', 'public_official_source_approval', repeat('4', 64),
   'decision-a', 'governance-rehearsal', now(), current_date + 1),
  ('rise_registry_b', 'OFFICIAL_REHEARSAL', 'public_official_source_approval', repeat('5', 64),
   'decision-b', 'governance-rehearsal', now(), current_date + 1),
  ('rise_registry_revoked', 'OFFICIAL_REHEARSAL', 'public_official_source_approval', repeat('c', 64),
   'decision-revoked', 'governance-rehearsal', now(), current_date + 1);

INSERT INTO rise.release_validation_receipts (
  release_id, validation_status, release_manifest_sha256, api_index_sha256,
  index_manifest_sha256, source_authorization_set_sha256, validator_version,
  validation_summary, validated_by_subject, validated_at
) VALUES
  ('rise_registry_a', 'passed', repeat('6', 64), repeat('7', 64), repeat('8', 64),
   repeat('b', 64), 'rehearsal-v1', '{"passed":true}', 'validator-rehearsal', now()),
  ('rise_registry_b', 'passed', repeat('9', 64), repeat('a', 64), repeat('b', 64),
   repeat('c', 64), 'rehearsal-v1', '{"passed":true}', 'validator-rehearsal', now()),
  ('rise_registry_revoked', 'passed', repeat('c', 64), repeat('d', 64), repeat('e', 64),
   repeat('d', 64), 'rehearsal-v1', '{"passed":true}', 'validator-rehearsal', now());

INSERT INTO rise.source_authorization_revocations (
  release_id, source_authority, authorization_sha256, decision_record_id,
  recorded_by_subject, revoked_at, reason
) VALUES (
  'rise_registry_revoked', 'OFFICIAL_REHEARSAL', repeat('c', 64), 'revocation-before-activation',
  'governance-rehearsal', now(), 'exercise pre-activation rejection'
);

SELECT rise.set_active_registry_release(
  'rise_registry_a', 'activate', NULL, 'rehearsal-operator', 'activate A'
);
SELECT rise.set_active_registry_release(
  'rise_registry_b', 'activate', 'rise_registry_a', 'rehearsal-operator', 'activate B'
);
SELECT rise.set_active_registry_release(
  'rise_registry_a', 'rollback', 'rise_registry_b', 'rehearsal-operator', 'restore A'
);

DO $$
BEGIN
  PERFORM rise.set_active_registry_release(
    'rise_registry_revoked', 'activate', 'rise_registry_a', 'rehearsal-operator',
    'must fail because source rights were revoked before activation'
  );
  RAISE EXCEPTION 'revoked-evidence activation unexpectedly succeeded';
EXCEPTION
  WHEN SQLSTATE '55000' THEN
    INSERT INTO rehearsal_checks VALUES ('revoked_evidence_activation_rejected', true);
END
$$;

INSERT INTO rise_app.authorization_code_redemptions (
  jti_sha256, subject_id, issuer, audience, role, capabilities,
  code_issued_at, code_expires_at, redeemed_at, request_id
) VALUES (
  repeat('d', 64), 'subject-a', 'https://auth.rehearsal.test', 'rise', 'student',
  '["rise:read"]', now() - interval '10 seconds', now() + interval '20 seconds',
  now(), 'request-auth-a'
);

DO $$
BEGIN
  INSERT INTO rise_app.sessions (
    session_id, session_token_sha256, csrf_token_sha256, jti_sha256,
    subject_id, issuer, audience, role, capabilities,
    created_at, expires_at, last_seen_at
  ) VALUES (
    'session-wrong', repeat('e', 64), repeat('f', 64), repeat('d', 64),
    'subject-b', 'https://auth.rehearsal.test', 'rise', 'student', '["rise:read"]',
    now(), now() + interval '1 hour', now()
  );
  RAISE EXCEPTION 'wrong-subject session unexpectedly succeeded';
EXCEPTION
  WHEN foreign_key_violation THEN
    INSERT INTO rehearsal_checks VALUES ('cross_subject_session_rejected', true);
END
$$;

INSERT INTO rise_app.sessions (
  session_id, session_token_sha256, csrf_token_sha256, jti_sha256,
  subject_id, issuer, audience, role, capabilities,
  created_at, expires_at, last_seen_at
) VALUES (
  'session-correct', repeat('e', 64), repeat('f', 64), repeat('d', 64),
  'subject-a', 'https://auth.rehearsal.test', 'rise', 'student', '["rise:read"]',
  now(), now() + interval '1 hour', now()
);

INSERT INTO rise_audit.audit_events (
  audit_event_id, occurred_at, actor_subject, action, target_type, target_id,
  metadata, previous_event_sha256, event_sha256, hash_algorithm, hash_key_id
) VALUES (
  'event-1', now(), 'opaque-subject-a', 'rehearsal', 'release', 'rise_registry_a',
  '{}', NULL, repeat('1', 64), 'hmac-sha256', 'rehearsal-key-v1'
);

DO $$
BEGIN
  INSERT INTO rise_audit.audit_events (
    audit_event_id, occurred_at, actor_subject, action, target_type, target_id,
    metadata, previous_event_sha256, event_sha256, hash_algorithm, hash_key_id
  ) VALUES (
    'event-wrong', now(), 'opaque-subject-a', 'rehearsal', 'release', 'rise_registry_a',
    '{}', NULL, repeat('2', 64), 'hmac-sha256', 'rehearsal-key-v1'
  );
  RAISE EXCEPTION 'wrong-predecessor audit event unexpectedly succeeded';
EXCEPTION
  WHEN SQLSTATE '40001' THEN
    INSERT INTO rehearsal_checks VALUES ('wrong_audit_predecessor_rejected', true);
END
$$;

INSERT INTO rise_audit.audit_events (
  audit_event_id, occurred_at, actor_subject, action, target_type, target_id,
  metadata, previous_event_sha256, event_sha256, hash_algorithm, hash_key_id
) VALUES (
  'event-2', now(), 'opaque-subject-a', 'rehearsal', 'release', 'rise_registry_a',
  '{}', repeat('1', 64), repeat('2', 64), 'hmac-sha256', 'rehearsal-key-v1'
);

INSERT INTO rehearsal_checks VALUES
  ('active_view_contains_restored_release_before_revocation',
    (SELECT count(*) = 1 AND min(release_id) = 'rise_registry_a' FROM rise.active_programs));

INSERT INTO rise.source_authorization_revocations (
  release_id, source_authority, authorization_sha256, decision_record_id,
  recorded_by_subject, revoked_at, reason
) VALUES (
  'rise_registry_a', 'OFFICIAL_REHEARSAL', repeat('4', 64), 'revocation-a',
  'governance-rehearsal', now(), 'exercise post-activation fail-closed behavior'
);

DO $$
BEGIN
  UPDATE rise.source_authorization_revocations
    SET reason = 'must remain immutable'
    WHERE release_id = 'rise_registry_a' AND source_authority = 'OFFICIAL_REHEARSAL';
  RAISE EXCEPTION 'source revocation update unexpectedly succeeded';
EXCEPTION
  WHEN SQLSTATE '55000' THEN
    INSERT INTO rehearsal_checks VALUES ('source_revocation_update_rejected', true);
END
$$;

DO $$
BEGIN
  DELETE FROM rise.source_authorization_revocations
    WHERE release_id = 'rise_registry_a' AND source_authority = 'OFFICIAL_REHEARSAL';
  RAISE EXCEPTION 'source revocation delete unexpectedly succeeded';
EXCEPTION
  WHEN SQLSTATE '55000' THEN
    INSERT INTO rehearsal_checks VALUES ('source_revocation_delete_rejected', true);
END
$$;

INSERT INTO rehearsal_checks VALUES
  ('active_view_hides_revoked_release',
    (SELECT count(*) = 0 FROM rise.active_programs)),
  ('reader_cannot_read_base_programs',
    NOT has_table_privilege('rise_registry_reader', 'rise.programs', 'SELECT')),
  ('reader_can_read_active_programs',
    has_table_privilege('rise_registry_reader', 'rise.active_programs', 'SELECT')),
  ('governance_can_record_source_revocations',
    has_table_privilege('rise_registry_governance_manager', 'rise.source_authorization_revocations', 'INSERT')),
  ('reader_cannot_read_quarantine',
    NOT has_table_privilege('rise_registry_reader', 'rise.quarantined_observations', 'SELECT'));

SELECT jsonb_pretty(jsonb_build_object(
  'postgres_version', current_setting('server_version'),
  'migrations_applied', jsonb_build_array('001', '002', '003'),
  'tables', (
    SELECT count(*) FROM information_schema.tables
    WHERE table_schema IN ('rise', 'rise_app', 'rise_audit') AND table_type = 'BASE TABLE'
  ),
  'active_views', (
    SELECT count(*) FROM information_schema.views
    WHERE table_schema = 'rise' AND table_name LIKE 'active_%'
  ),
  'checks', (
    SELECT jsonb_object_agg(check_name, passed ORDER BY check_name) FROM rehearsal_checks
  ),
  'active_release', (
    SELECT active_release_id FROM rise.registry_active_release WHERE singleton_key
  ),
  'activation_history_rows', (SELECT count(*) FROM rise.registry_activation_history),
  'audit_chain_rows', (SELECT count(*) FROM rise_audit.audit_events),
  'sessions', (SELECT count(*) FROM rise_app.sessions)
));
