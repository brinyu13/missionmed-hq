-- Normal application rollback retains this restrictive authorization boundary.
-- Reopening sibling-version access would reintroduce the D1-022 privacy defect.
begin;
do $$
begin
  if timeline.schema_version() <> 'd1-timeline-db-500.1'
     or to_regprocedure('timeline.can_read_version_022(text,text)') is null then
    raise exception 'D1-022 exact-version history boundary is not installed';
  end if;
end
$$;
commit;
