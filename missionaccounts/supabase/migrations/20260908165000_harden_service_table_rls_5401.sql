begin;

-- These service-only tables were created after the initial schema-wide RLS
-- pass. Keep them inaccessible if a future grant is added accidentally.
alter table missionaccounts.cycle enable row level security;
alter table missionaccounts.cycle force row level security;
alter table missionaccounts.engine_run enable row level security;
alter table missionaccounts.engine_run force row level security;
alter table missionaccounts.feature_flag enable row level security;
alter table missionaccounts.feature_flag force row level security;
alter table missionaccounts.provider_event_inbox enable row level security;
alter table missionaccounts.provider_event_inbox force row level security;

revoke all on table
  missionaccounts.cycle,
  missionaccounts.engine_run,
  missionaccounts.feature_flag,
  missionaccounts.provider_event_inbox
from public, anon, authenticated;

commit;
