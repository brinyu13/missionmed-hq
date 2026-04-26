-- (D4)-Avatar-System-Validation-Production-Hardening
-- Prompt #77: RLS + RPC hardening for avatar identity surfaces.

create extension if not exists pgcrypto;
alter table if exists public.player_profiles enable row level security;
alter table if exists public.user_avatars enable row level security;
-- Enforce self-only read on player_profiles (replace broad authenticated-read policy).
do $$
begin
  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'player_profiles'
      and policyname = 'player_profiles_select_authenticated'
  ) then
    drop policy player_profiles_select_authenticated on public.player_profiles;
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'player_profiles'
      and policyname = 'player_profiles_select_self'
  ) then
    create policy player_profiles_select_self
      on public.player_profiles
      for select
      to authenticated
      using (player_id = auth.uid());
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'player_profiles'
      and policyname = 'player_profiles_insert_self'
  ) then
    create policy player_profiles_insert_self
      on public.player_profiles
      for insert
      to authenticated
      with check (player_id = auth.uid());
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'player_profiles'
      and policyname = 'player_profiles_update_self'
  ) then
    create policy player_profiles_update_self
      on public.player_profiles
      for update
      to authenticated
      using (player_id = auth.uid())
      with check (player_id = auth.uid());
  end if;
end
$$;
-- Ensure user_avatars self policies exist.
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'user_avatars'
      and policyname = 'user_avatars_select_self'
  ) then
    create policy user_avatars_select_self
      on public.user_avatars
      for select
      to authenticated
      using (user_id = auth.uid());
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'user_avatars'
      and policyname = 'user_avatars_insert_self'
  ) then
    create policy user_avatars_insert_self
      on public.user_avatars
      for insert
      to authenticated
      with check (user_id = auth.uid());
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'user_avatars'
      and policyname = 'user_avatars_update_self'
  ) then
    create policy user_avatars_update_self
      on public.user_avatars
      for update
      to authenticated
      using (user_id = auth.uid())
      with check (user_id = auth.uid());
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'user_avatars'
      and policyname = 'user_avatars_delete_self'
  ) then
    create policy user_avatars_delete_self
      on public.user_avatars
      for delete
      to authenticated
      using (user_id = auth.uid());
  end if;
end
$$;
-- Explicitly prevent public / anon table access.
revoke all on table public.player_profiles from anon;
revoke all on table public.player_profiles from public;
revoke all on table public.user_avatars from anon;
revoke all on table public.user_avatars from public;
grant select, insert, update on table public.player_profiles to authenticated;
grant select, insert, update, delete on table public.user_avatars to authenticated;
create or replace function public.upsert_user_avatar_record(
  p_avatar_id uuid,
  p_avatar_url text,
  p_thumbnail_url text,
  p_gender text default null,
  p_make_active boolean default true
)
returns public.user_avatars
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_actor uuid := auth.uid();
  v_make_active boolean := coalesce(p_make_active, true);
  v_avatar_id uuid := coalesce(p_avatar_id, gen_random_uuid());
  v_existing_owner uuid;
  v_avatar_url text := nullif(btrim(coalesce(p_avatar_url, '')), '');
  v_thumb_url text := nullif(btrim(coalesce(p_thumbnail_url, '')), '');
  v_record public.user_avatars%rowtype;
begin
  if v_actor is null then
    raise exception 'auth_required';
  end if;

  if v_avatar_url is null then
    raise exception 'avatar_url_required';
  end if;

  if v_thumb_url is null then
    v_thumb_url := v_avatar_url;
  end if;

  if v_avatar_url !~* '^https?://' then
    raise exception 'avatar_url_invalid';
  end if;

  if v_thumb_url !~* '^https?://' then
    raise exception 'thumbnail_url_invalid';
  end if;

  if p_avatar_id is not null then
    select ua.user_id
      into v_existing_owner
    from public.user_avatars ua
    where ua.id = p_avatar_id
    for update;

    if found and v_existing_owner <> v_actor then
      raise exception 'avatar_not_owned_by_actor';
    end if;
  end if;

  if v_make_active then
    update public.user_avatars
       set is_active = false
     where user_id = v_actor
       and id <> v_avatar_id
       and is_active = true;
  end if;

  insert into public.user_avatars (
    id,
    user_id,
    avatar_url,
    thumbnail_url,
    gender,
    is_active
  )
  values (
    v_avatar_id,
    v_actor,
    v_avatar_url,
    v_thumb_url,
    p_gender,
    v_make_active
  )
  on conflict (id) do update
    set avatar_url = excluded.avatar_url,
        thumbnail_url = excluded.thumbnail_url,
        gender = excluded.gender,
        is_active = excluded.is_active
  where public.user_avatars.user_id = v_actor
  returning * into v_record;

  if not found then
    raise exception 'avatar_upsert_denied';
  end if;

  if v_make_active then
    insert into public.player_profiles (player_id, active_avatar_id, last_active_at)
    values (v_actor, v_record.id, now())
    on conflict (player_id) do update
      set active_avatar_id = excluded.active_avatar_id,
          last_active_at = excluded.last_active_at;
  end if;

  return v_record;
end;
$$;
grant execute on function public.upsert_user_avatar_record(uuid, text, text, text, boolean) to authenticated;
create or replace function public.set_active_user_avatar(
  p_avatar_id uuid
)
returns public.user_avatars
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_actor uuid := auth.uid();
  v_record public.user_avatars%rowtype;
begin
  if v_actor is null then
    raise exception 'auth_required';
  end if;

  if p_avatar_id is null then
    raise exception 'avatar_id_required';
  end if;

  select *
    into v_record
  from public.user_avatars
  where id = p_avatar_id
    and user_id = v_actor
  limit 1;

  if not found then
    raise exception 'avatar_not_found_for_actor';
  end if;

  update public.user_avatars
     set is_active = false
   where user_id = v_actor
     and id <> p_avatar_id
     and is_active = true;

  update public.user_avatars
     set is_active = true
   where id = p_avatar_id
     and user_id = v_actor
  returning * into v_record;

  if not found then
    raise exception 'avatar_not_found_for_actor';
  end if;

  insert into public.player_profiles (player_id, active_avatar_id, last_active_at)
  values (v_actor, p_avatar_id, now())
  on conflict (player_id) do update
    set active_avatar_id = excluded.active_avatar_id,
        last_active_at = excluded.last_active_at;

  return v_record;
end;
$$;
grant execute on function public.set_active_user_avatar(uuid) to authenticated;
