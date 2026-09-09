-- Normal application rollback retains this restrictive authorization boundary.
-- Reopening current document access for an older version grant would
-- reintroduce the D1-022 privacy defect.
begin;
do $$
begin
  if timeline.schema_version() <> 'd1-timeline-db-500.1'
     or to_regprocedure('timeline.can_read_current_document_022(text,text,text,timestamp with time zone)') is null then
    raise exception 'D1-022 current-document version boundary is not installed';
  end if;
end
$$;
commit;
