-- MX-MISSIONACCOUNTS-5301P: signed provider events without an implemented
-- MissionAccounts transition must become an explicit private exception rather
-- than remaining indefinitely in the received state.

create function missionaccounts.api_mark_provider_event_unhandled(
  p_provider text,
  p_provider_event_id text,
  p_reason text
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, missionaccounts
as $$
declare
  event_row missionaccounts.provider_event_inbox%rowtype;
  audit_id uuid;
  exception_key text;
begin
  if p_provider not in ('stripe','zoom','notification')
     or nullif(btrim(p_provider_event_id), '') is null
     or length(p_provider_event_id) > 255
     or nullif(btrim(p_reason), '') is null
     or length(p_reason) > 2000 then
    raise exception using errcode = '22023', message = 'invalid_unhandled_provider_event';
  end if;

  select * into event_row
  from missionaccounts.provider_event_inbox
  where provider = p_provider and provider_event_id = p_provider_event_id
  for update;
  if not found then
    raise exception using errcode = '23503', message = 'provider_event_not_found';
  end if;

  exception_key := p_provider || ':' || p_provider_event_id || ':unhandled';
  if event_row.state = 'ignored' then
    return jsonb_build_object('accepted', true, 'duplicate', true, 'state', 'ignored', 'exception_key', exception_key);
  end if;
  if event_row.state <> 'received' then
    return jsonb_build_object('accepted', false, 'duplicate', true, 'state', event_row.state);
  end if;

  update missionaccounts.provider_event_inbox
  set state = 'ignored', processed_at = now()
  where id = event_row.id;

  insert into missionaccounts.integration_exception(
    provider, kind, details, state, idempotency_key
  ) values (
    p_provider,
    'unhandled_webhook_event',
    jsonb_build_object(
      'provider_event_id', p_provider_event_id,
      'event_type', event_row.event_type,
      'provider_object_id', event_row.provider_object_id,
      'reason', left(btrim(p_reason), 2000)
    ),
    'open',
    exception_key
  ) on conflict (idempotency_key) do nothing;

  insert into missionaccounts.audit_event(
    actor_id, actor_role, kind, text, to_val, reason, request_id
  ) values (
    p_provider || ':' || p_provider_event_id,
    'provider',
    'provider_event.unhandled',
    'Signed provider event requires an explicit MissionAccounts transition',
    jsonb_build_object(
      'provider', p_provider,
      'provider_event_id', p_provider_event_id,
      'event_type', event_row.event_type,
      'state', 'ignored'
    ),
    left(btrim(p_reason), 2000),
    exception_key
  ) returning id into audit_id;

  return jsonb_build_object(
    'accepted', true,
    'duplicate', false,
    'state', 'ignored',
    'exception_key', exception_key,
    'audit_event_id', audit_id
  );
end;
$$;

revoke execute on function missionaccounts.api_mark_provider_event_unhandled(text, text, text)
from public, anon, authenticated;
grant execute on function missionaccounts.api_mark_provider_event_unhandled(text, text, text)
to service_role;
