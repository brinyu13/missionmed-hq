-- Authority: DR-363. Add self-only canonical phone save; preserve all completion and sponsor predicates.
BEGIN;
alter table missionaccounts.student_onboarding_submission drop constraint student_onboarding_submission_changed_fields_check;
alter table missionaccounts.student_onboarding_submission add constraint student_onboarding_submission_changed_fields_check check(cardinality(changed_fields) between 1 and 10);
create function missionaccounts.api_save_student_onboarding_v2(
  p_student_id uuid,
  p_phone text,
  p_preferred_name text,
  p_school_name text,
  p_best_contact_method text,
  p_mailing_line1 text,
  p_mailing_line2 text,
  p_mailing_city text,
  p_mailing_region text,
  p_mailing_postal_code text,
  p_mailing_country_code text,
  p_changed_fields text[],
  p_expected_revision integer,
  p_actor_id text,
  p_actor_role text,
  p_request_id text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, missionaccounts, extensions
as $$
declare
  student_row missionaccounts.student%rowtype;
  resolution_row record;
  existing_submission missionaccounts.student_onboarding_submission%rowtype;
  profile_row missionaccounts.student_onboarding_profile%rowtype;
  request_hash text;
  current_revision integer;
  next_revision integer;
  clean_phone text := nullif(btrim(p_phone), '');
  clean_preferred text := nullif(btrim(p_preferred_name), '');
  clean_school text := nullif(btrim(p_school_name), '');
  clean_contact text := lower(btrim(p_best_contact_method));
  clean_line1 text := nullif(btrim(p_mailing_line1), '');
  clean_line2 text := nullif(btrim(p_mailing_line2), '');
  clean_city text := nullif(btrim(p_mailing_city), '');
  clean_region text := nullif(btrim(p_mailing_region), '');
  clean_postal text := nullif(btrim(p_mailing_postal_code), '');
  clean_country text := upper(btrim(p_mailing_country_code));
  canonical_fields text[];
  next_preferred text;
  next_school text;
  next_contact text;
  next_line1 text;
  next_line2 text;
  next_city text;
  next_region text;
  next_postal text;
  next_country text;
  changed text[];
begin
  if p_actor_role <> 'student' or p_actor_id <> p_student_id::text then
    raise exception using errcode = '42501', message = 'onboarding_student_subject_mismatch';
  end if;
  if p_request_id is null or p_request_id !~ '^[A-Za-z0-9._:-]{8,200}$' then
    raise exception using errcode = '22023', message = 'onboarding_request_id_invalid';
  end if;
  if p_expected_revision is null or p_expected_revision < 0 then
    raise exception using errcode = '22023', message = 'onboarding_revision_invalid';
  end if;
  select array_agg(field order by field) into canonical_fields
  from unnest(p_changed_fields) field;
  if p_changed_fields is null
     or cardinality(p_changed_fields) not between 1 and 10
     or cardinality(canonical_fields) <> (select count(distinct field) from unnest(p_changed_fields) field)
     or exists (
       select 1 from unnest(p_changed_fields) field
       where field not in (
         'phone','preferred_name','school_name','best_contact_method','mailing_line1','mailing_line2',
         'mailing_city','mailing_region','mailing_postal_code','mailing_country_code'
       )
     )
     or ('phone' = any(p_changed_fields) and (clean_phone is null or length(clean_phone) > 100 or clean_phone !~ '^[+0-9(). -]+$' or regexp_replace(clean_phone, '[^0-9]', '', 'g') !~ '^[0-9]{7,15}$'))
     or ('school_name' = any(p_changed_fields) and (clean_school is null or length(clean_school) not between 2 and 160))
     or ('best_contact_method' = any(p_changed_fields) and clean_contact not in ('email','phone'))
     or ('mailing_line1' = any(p_changed_fields) and (clean_line1 is null or length(clean_line1) not between 3 and 160))
     or ('mailing_city' = any(p_changed_fields) and (clean_city is null or length(clean_city) not between 2 and 100))
     or ('mailing_region' = any(p_changed_fields) and (clean_region is null or length(clean_region) not between 2 and 100))
     or ('mailing_postal_code' = any(p_changed_fields) and (clean_postal is null or length(clean_postal) not between 2 and 24))
     or ('mailing_country_code' = any(p_changed_fields) and clean_country !~ '^[A-Z]{2}$')
     or ('preferred_name' = any(p_changed_fields) and clean_preferred is not null and length(clean_preferred) > 80)
     or ('mailing_line2' = any(p_changed_fields) and clean_line2 is not null and length(clean_line2) > 160) then
    raise exception using errcode = '22023', message = 'onboarding_profile_invalid';
  end if;

  request_hash := encode(extensions.digest(convert_to(jsonb_build_object(
    'student_id', p_student_id,
    'phone', clean_phone,
    'preferred_name', clean_preferred,
    'school_name', clean_school,
    'best_contact_method', clean_contact,
    'mailing_line1', clean_line1,
    'mailing_line2', clean_line2,
    'mailing_city', clean_city,
    'mailing_region', clean_region,
    'mailing_postal_code', clean_postal,
    'mailing_country_code', clean_country,
    'changed_fields', canonical_fields,
    'expected_revision', p_expected_revision
  )::text, 'UTF8'), 'sha256'), 'hex');

  select * into student_row
  from missionaccounts.student
  where id = p_student_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'student_not_found';
  end if;
  select * into resolution_row
  from missionaccounts.identity_student_resolution
  where source_student_id = p_student_id;
  if student_row.identity_state <> 'verified'
     or resolution_row.canonical_student_id is distinct from p_student_id
     or coalesce(resolution_row.absorbed, false)
     or coalesce(resolution_row.excluded, false) then
    raise exception using errcode = '42501', message = 'onboarding_canonical_identity_required';
  end if;

  -- The canonical student row is the per-subject serialization point. Recheck
  -- the request only after acquiring it so simultaneous identical retries see
  -- the committed submission instead of racing into a revision conflict.
  select * into existing_submission
  from missionaccounts.student_onboarding_submission
  where request_id = p_request_id;
  if found then
    if existing_submission.student_id <> p_student_id
       or existing_submission.request_sha256 <> request_hash then
      raise exception using errcode = '23505', message = 'onboarding_idempotency_conflict';
    end if;
    return jsonb_build_object(
      'accepted', true,
      'duplicate', true,
      'onboarding', missionaccounts.onboarding_state_for_student(p_student_id)
    );
  end if;

  select * into profile_row
  from missionaccounts.student_onboarding_profile
  where student_id = p_student_id
  for update;
  current_revision := coalesce(profile_row.revision, 0);
  if current_revision <> p_expected_revision then
    raise exception using errcode = 'PT409', message = 'onboarding_revision_conflict';
  end if;
  next_revision := current_revision + 1;

  next_preferred := case when 'preferred_name' = any(p_changed_fields) then clean_preferred else profile_row.preferred_name end;
  next_school := case when 'school_name' = any(p_changed_fields) then clean_school else profile_row.school_name end;
  next_contact := case when 'best_contact_method' = any(p_changed_fields) then clean_contact else profile_row.best_contact_method end;
  next_line1 := case when 'mailing_line1' = any(p_changed_fields) then clean_line1 else profile_row.mailing_line1 end;
  next_line2 := case when 'mailing_line2' = any(p_changed_fields) then clean_line2 else profile_row.mailing_line2 end;
  next_city := case when 'mailing_city' = any(p_changed_fields) then clean_city else profile_row.mailing_city end;
  next_region := case when 'mailing_region' = any(p_changed_fields) then clean_region else profile_row.mailing_region end;
  next_postal := case when 'mailing_postal_code' = any(p_changed_fields) then clean_postal else profile_row.mailing_postal_code end;
  next_country := case when 'mailing_country_code' = any(p_changed_fields) then clean_country else profile_row.mailing_country_code end;

  changed := array_remove(array[
    case when 'phone' = any(p_changed_fields) and student_row.phone is distinct from clean_phone then 'phone' end,
    case when 'preferred_name' = any(p_changed_fields) and profile_row.preferred_name is distinct from next_preferred then 'preferred_name' end,
    case when 'school_name' = any(p_changed_fields) and profile_row.school_name is distinct from next_school then 'school_name' end,
    case when 'best_contact_method' = any(p_changed_fields) and profile_row.best_contact_method is distinct from next_contact then 'best_contact_method' end,
    case when 'mailing_line1' = any(p_changed_fields) and profile_row.mailing_line1 is distinct from next_line1 then 'mailing_line1' end,
    case when 'mailing_line2' = any(p_changed_fields) and profile_row.mailing_line2 is distinct from next_line2 then 'mailing_line2' end,
    case when 'mailing_city' = any(p_changed_fields) and profile_row.mailing_city is distinct from next_city then 'mailing_city' end,
    case when 'mailing_region' = any(p_changed_fields) and profile_row.mailing_region is distinct from next_region then 'mailing_region' end,
    case when 'mailing_postal_code' = any(p_changed_fields) and profile_row.mailing_postal_code is distinct from next_postal then 'mailing_postal_code' end,
    case when 'mailing_country_code' = any(p_changed_fields) and profile_row.mailing_country_code is distinct from next_country then 'mailing_country_code' end
  ], null);
  if cardinality(changed) = 0 then
    changed := array['profile_confirmed']::text[];
  end if;

  if 'phone' = any(p_changed_fields) then
    update missionaccounts.student set phone = clean_phone where id = p_student_id;
  end if;

  insert into missionaccounts.student_onboarding_profile(
    student_id, preferred_name, school_name, best_contact_method,
    mailing_line1, mailing_line2, mailing_city, mailing_region,
    mailing_postal_code, mailing_country_code, revision, updated_at
  ) values (
    p_student_id, next_preferred, next_school, next_contact,
    next_line1, next_line2, next_city, next_region,
    next_postal, next_country, next_revision, clock_timestamp()
  ) on conflict (student_id) do update set
    preferred_name = excluded.preferred_name,
    school_name = excluded.school_name,
    best_contact_method = excluded.best_contact_method,
    mailing_line1 = excluded.mailing_line1,
    mailing_line2 = excluded.mailing_line2,
    mailing_city = excluded.mailing_city,
    mailing_region = excluded.mailing_region,
    mailing_postal_code = excluded.mailing_postal_code,
    mailing_country_code = excluded.mailing_country_code,
    revision = excluded.revision,
    updated_at = excluded.updated_at;

  insert into missionaccounts.student_onboarding_submission(
    student_id, request_id, request_sha256, changed_fields,
    from_revision, to_revision, actor_id, actor_role
  ) values (
    p_student_id, p_request_id, request_hash, changed,
    current_revision, next_revision, p_actor_id, p_actor_role
  );

  insert into missionaccounts.audit_event(
    actor_id, actor_role, subject_student_id, kind, text,
    from_val, to_val, reason, request_id
  ) values (
    p_actor_id, p_actor_role, p_student_id, 'onboarding.profile_saved',
    'Student saved ExamPrep onboarding profile fields',
    jsonb_build_object('revision', current_revision),
    jsonb_build_object('revision', next_revision, 'changed_fields', changed),
    'Student incremental onboarding save', p_request_id
  );

  return jsonb_build_object(
    'accepted', true,
    'duplicate', false,
    'onboarding', missionaccounts.onboarding_state_for_student(p_student_id)
  );
end;
$$;


revoke all on function missionaccounts.api_save_student_onboarding_v2(uuid, text, text, text, text, text, text, text, text, text, text, text[], integer, text, text, text) from public, anon, authenticated;
grant execute on function missionaccounts.api_save_student_onboarding_v2(uuid, text, text, text, text, text, text, text, text, text, text, text[], integer, text, text, text) to service_role;
COMMIT;
