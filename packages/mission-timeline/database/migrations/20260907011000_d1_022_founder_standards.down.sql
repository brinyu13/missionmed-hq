-- Normal application rollback leaves this additive registry intact.
-- Destructive schema removal is permitted only while there are no custody records.
begin;
do $$ begin
  if exists (select 1 from timeline.founder_standard_revisions) or exists (select 1 from timeline.founder_standard_decisions) then
    raise exception 'Founder standard custody records exist; retain additive schema during release rollback';
  end if;
end $$;
drop table timeline.founder_standard_decisions;
drop table timeline.founder_standard_revisions;
drop function timeline.reject_founder_standard_mutation_022();
drop function timeline.founder_standard_manager_022();
drop function timeline.founder_standard_reader_022();
commit;
