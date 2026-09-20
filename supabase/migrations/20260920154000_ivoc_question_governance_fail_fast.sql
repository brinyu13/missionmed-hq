begin;

-- SQLSTATE 40001 tells database clients that the transaction should be
-- retried. An expected-version mismatch is a durable application conflict,
-- not a transient serialization failure, so retrying it can hold an HTTP
-- request open until the client times out. Raise a normal application
-- exception instead; the IVOC HTTP adapter maps the stable message to 409.
create or replace function public.ivoc_write_question_version(
  p_question_id text,
  p_expected_version integer,
  p_status text,
  p_canonical_text text,
  p_category text,
  p_tags jsonb,
  p_source text,
  p_change_reason text,
  p_actor text
) returns table (
  question_id text,
  status text,
  current_version integer,
  canonical_text text,
  category text,
  tags jsonb,
  source text,
  change_reason text,
  changed_by text,
  updated_at timestamptz
) language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare
  existing public.ivoc_question_registry%rowtype;
  next_version integer;
begin
  if p_question_id is null or p_question_id !~ '^[A-Z0-9][A-Z0-9._:-]{1,119}$'
     or p_expected_version is null or p_expected_version < 0
     or p_status not in ('active', 'hidden', 'retired')
     or p_canonical_text is null or char_length(btrim(p_canonical_text)) not between 3 and 1000
     or p_category is null or char_length(btrim(p_category)) not between 1 and 120
     or p_tags is null or jsonb_typeof(p_tags) <> 'array' or jsonb_array_length(p_tags) > 24
     or p_source is null or p_source !~ '^[a-z0-9][a-z0-9_-]{0,79}$'
     or p_change_reason is null or char_length(btrim(p_change_reason)) not between 3 and 400
     or p_actor is null or p_actor !~ '^wp:[1-9][0-9]{0,19}$' then
    raise exception 'ivoc_question_input_invalid' using errcode = '22023';
  end if;

  select * into existing
  from public.ivoc_question_registry registry
  where registry.question_id = p_question_id
  for update;

  if found then
    if existing.current_version <> p_expected_version then
      raise exception 'ivoc_question_version_conflict' using errcode = 'P0001';
    end if;
    if existing.status = 'retired' and p_status <> 'retired' then
      raise exception 'ivoc_question_retired' using errcode = '22023';
    end if;
    next_version := existing.current_version + 1;
    update public.ivoc_question_registry registry
    set status = p_status, current_version = next_version,
        updated_by = p_actor, updated_at = clock_timestamp()
    where registry.question_id = p_question_id;
  else
    if p_expected_version <> 0 then
      raise exception 'ivoc_question_version_conflict' using errcode = 'P0001';
    end if;
    next_version := 1;
    insert into public.ivoc_question_registry (
      question_id, status, current_version, created_by, updated_by
    ) values (
      p_question_id, p_status, next_version, p_actor, p_actor
    );
  end if;

  insert into public.ivoc_question_versions (
    question_id, version, canonical_text, category, tags, source,
    change_reason, changed_by
  ) values (
    p_question_id, next_version, btrim(p_canonical_text), btrim(p_category),
    p_tags, p_source, btrim(p_change_reason), p_actor
  );

  return query
  select catalog.question_id, catalog.status, catalog.current_version,
    catalog.canonical_text, catalog.category, catalog.tags, catalog.source,
    catalog.change_reason, catalog.changed_by, catalog.updated_at
  from public.ivoc_question_catalog catalog
  where catalog.question_id = p_question_id;
end;
$$;

revoke all on function public.ivoc_write_question_version(
  text, integer, text, text, text, jsonb, text, text, text
) from public, anon, authenticated;
grant execute on function public.ivoc_write_question_version(
  text, integer, text, text, text, jsonb, text, text, text
) to service_role;

commit;
