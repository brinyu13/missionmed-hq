-- (G4)-Avatar-codex-high-603
-- Avatar locker persistence + deterministic identity bridge + STAT snapshot support

create extension if not exists pgcrypto;
create table if not exists public.user_avatars (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  avatar_url text not null,
  thumbnail_url text not null,
  gender text,
  is_active boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_user_avatars_user_id
  on public.user_avatars (user_id, created_at desc);
create unique index if not exists idx_user_avatars_single_active
  on public.user_avatars (user_id)
  where is_active = true;
alter table public.player_profiles
  add column if not exists active_avatar_id uuid;
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'player_profiles_active_avatar_id_fkey'
      and conrelid = 'public.player_profiles'::regclass
  ) then
    alter table public.player_profiles
      add constraint player_profiles_active_avatar_id_fkey
      foreign key (active_avatar_id)
      references public.user_avatars(id)
      on delete set null;
  end if;
end $$;
create table if not exists public.match_players (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null,
  player_id uuid not null references auth.users(id) on delete cascade,
  avatar_thumbnail_url text not null,
  metadata jsonb not null default '{}'::jsonb,
  captured_at timestamptz not null default now(),
  unique (match_id, player_id)
);
create index if not exists idx_match_players_match_id
  on public.match_players (match_id, captured_at desc);
create index if not exists idx_match_players_player_id
  on public.match_players (player_id, captured_at desc);
do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'duel_challenges'
  ) and not exists (
    select 1
    from pg_constraint
    where conname = 'match_players_match_id_fkey'
      and conrelid = 'public.match_players'::regclass
  ) then
    alter table public.match_players
      add constraint match_players_match_id_fkey
      foreign key (match_id)
      references public.duel_challenges(id)
      on delete cascade;
  end if;
end $$;
alter table public.user_avatars enable row level security;
alter table public.match_players enable row level security;
do $$
begin
  if not exists (
    select 1 from pg_policies
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
    select 1 from pg_policies
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
    select 1 from pg_policies
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
    select 1 from pg_policies
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
end $$;
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'match_players'
      and policyname = 'match_players_select_self'
  ) then
    create policy match_players_select_self
      on public.match_players
      for select
      to authenticated
      using (player_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'match_players'
      and policyname = 'match_players_insert_self'
  ) then
    create policy match_players_insert_self
      on public.match_players
      for insert
      to authenticated
      with check (player_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'match_players'
      and policyname = 'match_players_update_self'
  ) then
    create policy match_players_update_self
      on public.match_players
      for update
      to authenticated
      using (player_id = auth.uid())
      with check (player_id = auth.uid());
  end if;
end $$;
grant select, insert, update, delete on public.user_avatars to authenticated;
grant select, insert, update on public.match_players to authenticated;
create or replace function public.resolve_supabase_user_uuid(
  p_wp_user_id text default null,
  p_email text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid;
  v_wp text := nullif(btrim(coalesce(p_wp_user_id, '')), '');
  v_email text := nullif(lower(btrim(coalesce(p_email, ''))), '');
begin
  if v_wp is not null then
    select u.id
      into v_user_id
    from auth.users u
    where coalesce(u.raw_user_meta_data ->> 'wp_user_id', '') = v_wp
       or coalesce(u.raw_user_meta_data ->> 'wordpress_user_id', '') = v_wp
    order by u.created_at desc
    limit 1;

    if v_user_id is not null then
      return v_user_id;
    end if;
  end if;

  if v_email is not null then
    select u.id
      into v_user_id
    from auth.users u
    where lower(coalesce(u.email, '')) = v_email
    order by u.created_at desc
    limit 1;
  end if;

  return v_user_id;
end;
$$;
grant execute on function public.resolve_supabase_user_uuid(text, text) to anon, authenticated;
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
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_avatar_id uuid := coalesce(p_avatar_id, gen_random_uuid());
  v_record public.user_avatars%rowtype;
begin
  if v_actor is null then
    raise exception 'auth_required';
  end if;

  if nullif(btrim(coalesce(p_avatar_url, '')), '') is null then
    raise exception 'avatar_url_required';
  end if;

  if p_make_active then
    update public.user_avatars
       set is_active = false
     where user_id = v_actor
       and id <> v_avatar_id;
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
    p_avatar_url,
    coalesce(nullif(btrim(coalesce(p_thumbnail_url, '')), ''), p_avatar_url),
    p_gender,
    p_make_active
  )
  on conflict (id) do update
    set user_id = excluded.user_id,
        avatar_url = excluded.avatar_url,
        thumbnail_url = excluded.thumbnail_url,
        gender = excluded.gender,
        is_active = excluded.is_active
  returning * into v_record;

  if p_make_active then
    update public.player_profiles
       set active_avatar_id = v_record.id,
           last_active_at = now()
     where player_id = v_actor;

    if not found then
      insert into public.player_profiles (player_id, active_avatar_id, last_active_at)
      values (v_actor, v_record.id, now())
      on conflict (player_id) do update
        set active_avatar_id = excluded.active_avatar_id,
            last_active_at = excluded.last_active_at;
    end if;
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
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_record public.user_avatars%rowtype;
begin
  if v_actor is null then
    raise exception 'auth_required';
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
     and id <> p_avatar_id;

  update public.user_avatars
     set is_active = true
   where id = p_avatar_id
     and user_id = v_actor
  returning * into v_record;

  update public.player_profiles
     set active_avatar_id = p_avatar_id,
         last_active_at = now()
   where player_id = v_actor;

  if not found then
    insert into public.player_profiles (player_id, active_avatar_id, last_active_at)
    values (v_actor, p_avatar_id, now())
    on conflict (player_id) do update
      set active_avatar_id = excluded.active_avatar_id,
          last_active_at = excluded.last_active_at;
  end if;

  return v_record;
end;
$$;
grant execute on function public.set_active_user_avatar(uuid) to authenticated;
create or replace function public.record_match_player_avatar_snapshot(
  p_match_id uuid,
  p_avatar_thumbnail_url text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    raise exception 'auth_required';
  end if;

  if p_match_id is null then
    raise exception 'match_id_required';
  end if;

  insert into public.match_players (
    match_id,
    player_id,
    avatar_thumbnail_url,
    metadata,
    captured_at
  )
  values (
    p_match_id,
    v_actor,
    coalesce(nullif(btrim(coalesce(p_avatar_thumbnail_url, '')), ''), ''),
    jsonb_build_object('source', 'arena_match_start'),
    now()
  )
  on conflict (match_id, player_id) do update
    set avatar_thumbnail_url = excluded.avatar_thumbnail_url,
        metadata = coalesce(public.match_players.metadata, '{}'::jsonb) || excluded.metadata,
        captured_at = now();
end;
$$;
grant execute on function public.record_match_player_avatar_snapshot(uuid, text) to authenticated;
