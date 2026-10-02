-- Filename generated with `supabase migration new ivoc_candidate_audio_capture`.
begin;
set local lock_timeout = '3s';
set local statement_timeout = '20s';

-- Legacy recordings remain the replay artifact, never a candidate-only claim.
alter table public.ivoc_recordings
  add column recording_role text not null default 'conversation',
  add column parent_recording_id uuid,
  add column capture_receipt jsonb,
  add constraint ivoc_recordings_identity unique (id, session_id, owner_subject),
  add constraint ivoc_recordings_candidate_parent foreign key (parent_recording_id, session_id, owner_subject)
    references public.ivoc_recordings (id, session_id, owner_subject),
  add constraint ivoc_recordings_capture_role check ((
    (recording_role = 'conversation' and parent_recording_id is null and capture_receipt is null)
    or (recording_role = 'candidate_audio' and parent_recording_id is not null and parent_recording_id <> id
      and capture_receipt is not null and jsonb_typeof(capture_receipt) = 'object'
      and capture_receipt->>'schema' = 'ivoc.candidate-audio.v1'
      and capture_receipt->>'recordingId' = id::text
      and capture_receipt->>'parentRecordingId' = parent_recording_id::text
      and capture_receipt->>'sessionId' = session_id::text
      and capture_receipt->>'analysisEligibility' = 'UNVERIFIED')
  ) is true);
create unique index ivoc_recordings_candidate_parent_once
  on public.ivoc_recordings (parent_recording_id) where recording_role = 'candidate_audio';
create function public.ivoc_candidate_audio_custody_guard()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if tg_op = 'UPDATE' and (
    new.recording_role is distinct from old.recording_role
    or new.parent_recording_id is distinct from old.parent_recording_id
    or new.session_id is distinct from old.session_id
    or new.owner_subject is distinct from old.owner_subject
    or new.storage_object_key is distinct from old.storage_object_key
  ) then raise exception 'ivoc_recording_custody_immutable'; end if;
  if new.recording_role = 'candidate_audio' then
    if not exists (select 1 from public.ivoc_recordings p
      where p.id = new.parent_recording_id and p.recording_role = 'conversation'
      and p.session_id = new.session_id and p.owner_subject = new.owner_subject)
    then raise exception 'ivoc_candidate_parent_invalid'; end if;
    if tg_op = 'UPDATE' and old.status = 'saved' and new is distinct from old
    then raise exception 'ivoc_candidate_seal_immutable'; end if;
    if (new.capture_receipt->>'status' = case when new.status = 'saved' then 'SEALED' else 'ALLOCATED' end) is not true
    then raise exception 'ivoc_candidate_receipt_state_invalid'; end if;
  end if;
  return new;
end;
$$;
revoke all on function public.ivoc_candidate_audio_custody_guard() from public, anon, authenticated, service_role;
create trigger ivoc_candidate_audio_custody_guard before insert or update on public.ivoc_recordings
  for each row execute function public.ivoc_candidate_audio_custody_guard();
comment on column public.ivoc_recordings.capture_receipt is
  'Server-issued private-upload custody receipt. Browser microphone source/timing remain client-attested; this is NOT verified speaker attribution or analysis authorization.';

-- Existing FORCE RLS, browser-role revocations and limited service-role grants
-- are unchanged. Runtime rollback leaves these additive columns and source
-- artifacts intact; do not drop data as rollback.
commit;
