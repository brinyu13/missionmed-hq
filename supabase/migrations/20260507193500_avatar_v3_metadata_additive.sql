-- AV3-002: additive Avatar Studio metadata.
-- Preserves existing Avatar v2 records and RLS/RPC behavior.

alter table public.user_avatars
  add column if not exists avatar_version text not null default 'v2',
  add column if not exists body_type text,
  add column if not exists style text,
  add column if not exists prompt_set_id text,
  add column if not exists generation_source text,
  add column if not exists source_photo_id text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'user_avatars_avatar_version_check'
      and conrelid = 'public.user_avatars'::regclass
  ) then
    alter table public.user_avatars
      add constraint user_avatars_avatar_version_check
      check (avatar_version in ('v2', 'v3'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'user_avatars_avatar_v3_body_type_check'
      and conrelid = 'public.user_avatars'::regclass
  ) then
    alter table public.user_avatars
      add constraint user_avatars_avatar_v3_body_type_check
      check (body_type is null or body_type in ('slim', 'athletic', 'strong'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'user_avatars_avatar_v3_style_check'
      and conrelid = 'public.user_avatars'::regclass
  ) then
    alter table public.user_avatars
      add constraint user_avatars_avatar_v3_style_check
      check (style is null or style in ('doctor', 'superhero', 'anime'));
  end if;
end $$;
