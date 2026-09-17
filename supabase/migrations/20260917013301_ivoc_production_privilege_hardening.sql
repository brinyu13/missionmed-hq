begin;

-- New Supabase projects can still inherit broad service_role privileges from
-- platform default privileges. IVOC uses a server-owned adapter, but its SQL
-- capability remains least-privilege and must not include delete, truncate,
-- trigger, or ownership-adjacent operations.
alter default privileges for role postgres in schema public
  revoke all on tables from public, anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke all on sequences from public, anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke all on functions from public, anon, authenticated, service_role;

revoke all on table public.ivprep_entitlements from service_role;
revoke all on table public.ivprep_cookie_revocations from service_role;
revoke all on table public.ivprep_interview_bindings from service_role;
revoke all on table public.ivprep_provider_reservations from service_role;
revoke all on table public.ivprep_provider_control from service_role;
revoke all on table public.ivprep_idempotency from service_role;

grant select, insert, update on table public.ivprep_entitlements to service_role;
grant select, insert, update on table public.ivprep_cookie_revocations to service_role;
grant select, insert, update on table public.ivprep_interview_bindings to service_role;
grant select, insert, update on table public.ivprep_provider_reservations to service_role;
grant select, insert, update on table public.ivprep_provider_control to service_role;
grant select, insert, update on table public.ivprep_idempotency to service_role;

revoke all on table public.ivoc_sessions from service_role;
revoke all on table public.ivoc_recordings from service_role;
revoke all on table public.ivoc_results from service_role;
revoke all on table public.ivoc_reviews from service_role;
revoke all on table public.ivoc_preferences from service_role;
revoke all on table public.ivoc_access_log from service_role;
revoke all on table public.ivoc_session_contracts from service_role;
revoke all on table public.ivoc_timeline_events from service_role;
revoke all on table public.ivoc_conversation_turns from service_role;
revoke all on table public.ivoc_answer_segments from service_role;
revoke all on table public.ivoc_coaching_evidence from service_role;

grant select, insert, update on table public.ivoc_sessions to service_role;
grant select, insert, update on table public.ivoc_recordings to service_role;
grant select, insert, update on table public.ivoc_results to service_role;
grant select, insert, update on table public.ivoc_reviews to service_role;
grant select, insert, update on table public.ivoc_preferences to service_role;
grant select, insert on table public.ivoc_access_log to service_role;
grant select, insert, update on table public.ivoc_session_contracts to service_role;
grant select, insert on table public.ivoc_timeline_events to service_role;
grant select, insert, update on table public.ivoc_conversation_turns to service_role;
grant select, insert, update on table public.ivoc_answer_segments to service_role;
grant select, insert, update on table public.ivoc_coaching_evidence to service_role;

revoke all on sequence public.ivoc_access_log_id_seq from service_role;
grant usage, select on sequence public.ivoc_access_log_id_seq to service_role;

alter table public.ivoc_sessions force row level security;
alter table public.ivoc_recordings force row level security;
alter table public.ivoc_results force row level security;
alter table public.ivoc_reviews force row level security;
alter table public.ivoc_preferences force row level security;
alter table public.ivoc_access_log force row level security;
alter table public.ivoc_session_contracts force row level security;
alter table public.ivoc_timeline_events force row level security;
alter table public.ivoc_conversation_turns force row level security;
alter table public.ivoc_answer_segments force row level security;
alter table public.ivoc_coaching_evidence force row level security;

create index if not exists ivprep_provider_reservations_interview_subject_idx
  on public.ivprep_provider_reservations (interview_id, subject);

commit;
