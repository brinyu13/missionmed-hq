begin;

create index if not exists ivoc_access_log_recording_idx
  on public.ivoc_access_log (recording_id);

commit;
