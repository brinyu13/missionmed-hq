begin;

update i1q.feature_flags
set enabled = false,
    changed_by = coalesce(i1q.session_actor_id(), 'rollback_operator'),
    changed_at = now()
where key in (
  'internal_platform_enabled',
  'stat_adapter_enabled',
  'drills_adapter_enabled',
  'student_release_enabled'
);

insert into i1q.audit_events (
  id,
  actor_id,
  action,
  entity_type,
  entity_id,
  previous_hash,
  event_hash,
  payload
)
values (
  'audit_compensating_disable_' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS'),
  coalesce(i1q.session_actor_id(), 'rollback_operator'),
  'all_i1q_feature_flags_disabled',
  'feature_flags',
  'all',
  null,
  encode(digest(clock_timestamp()::text || ':i1q:disable', 'sha256'), 'hex'),
  jsonb_build_object('reason', 'compensating rollback')
);

commit;
