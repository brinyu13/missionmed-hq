-- DR-116: extend only the provider dispatch/claim predicates from Test #1 to Tests #1-3.
-- All provider enablement, kill-switch, lifecycle, identity, and ACL controls remain unchanged.
create or replace function public.ivprep_bind_provider_dispatch(
  p_reservation_nonce text,
  p_dispatch_id text,
  p_room_name text,
  p_agent_name text
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform 1
  from public.ivprep_provider_control as control
  where control.singleton
    and control.paid_tests_enabled
    and not control.kill_switch_tripped
  for update;
  if not found then
    return false;
  end if;

  begin
    update public.ivprep_provider_reservations as reservation
    set room_name = p_room_name,
        dispatch_id = p_dispatch_id,
        state = 'DISPATCHED'
    where reservation.reservation_nonce = p_reservation_nonce
      and reservation.state = 'RESERVED'
      and reservation.test_number between 1 and 3
      and reservation.profile = 'PROFILE_B_OPENAI_NATIVE_AUDIO'
      and reservation.agent_name = p_agent_name
      and p_agent_name = 'ivprep-3440-profile-b'
      and p_reservation_nonce ~ '^[a-f0-9]{64}$'
      and p_dispatch_id ~ '^[A-Za-z0-9._:-]{1,120}$'
      and p_room_name ~ '^[A-Za-z0-9._:-]{1,120}$';
  exception
    when unique_violation or check_violation or not_null_violation then
      perform public.ivprep_trip_provider_kill_switch('provider_dispatch_binding_mismatch');
      return false;
  end;
  if found then
    return true;
  end if;
  perform public.ivprep_trip_provider_kill_switch('provider_dispatch_binding_mismatch');
  return false;
end;
$$;

create or replace function public.ivprep_claim_provider_job(
  p_reservation_nonce text,
  p_job_id text,
  p_dispatch_id text,
  p_room_name text,
  p_agent_name text
)
returns table (
  reservation_id text,
  participant_identity text,
  reservation_nonce text,
  dispatch_id text,
  room_name text,
  agent_name text
)
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform 1
  from public.ivprep_provider_control as control
  where control.singleton
    and control.paid_tests_enabled
    and not control.kill_switch_tripped
  for update;
  if not found then
    return;
  end if;

  begin
    return query
    update public.ivprep_provider_reservations as reservation
    set livekit_job_id = p_job_id,
        worker_claimed_at = pg_catalog.now(),
        state = 'WORKER_CLAIMED'
    where reservation.reservation_nonce = p_reservation_nonce
      and reservation.dispatch_id = p_dispatch_id
      and reservation.room_name = p_room_name
      and reservation.agent_name = p_agent_name
      and reservation.state = 'DISPATCHED'
      and reservation.test_number between 1 and 3
      and reservation.profile = 'PROFILE_B_OPENAI_NATIVE_AUDIO'
      and reservation.livekit_job_id is null
      and not reservation.termination_requested
      and p_reservation_nonce ~ '^[a-f0-9]{64}$'
      and p_job_id ~ '^[A-Za-z0-9._:-]{1,120}$'
      and p_dispatch_id ~ '^[A-Za-z0-9._:-]{1,120}$'
      and p_room_name ~ '^[A-Za-z0-9._:-]{1,120}$'
      and p_agent_name = 'ivprep-3440-profile-b'
      and exists (
        select 1
        from public.ivprep_interview_bindings as binding
        join public.ivprep_entitlements as entitlement
          on entitlement.subject = binding.subject
         and entitlement.revision = binding.entitlement_revision
        where binding.interview_id = reservation.interview_id
          and binding.subject = reservation.subject
          and not binding.termination_requested
          and entitlement.video_enabled
          and entitlement.expires_at > pg_catalog.now()
      )
    returning reservation.reservation_id,
              reservation.participant_identity,
              reservation.reservation_nonce,
              reservation.dispatch_id,
              reservation.room_name,
              reservation.agent_name;
  exception
    when unique_violation or check_violation or not_null_violation then
      perform public.ivprep_trip_provider_kill_switch('provider_job_claim_mismatch');
      return;
  end;
  if not found then
    perform public.ivprep_trip_provider_kill_switch('provider_job_claim_mismatch');
  end if;
end;
$$;
