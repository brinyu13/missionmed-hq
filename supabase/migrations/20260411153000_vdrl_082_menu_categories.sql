-- VDRL-082
-- Phase 4: Dynamic menu categories + drill assignment layer for Arena pregame menu.

create extension if not exists pgcrypto;
create table if not exists public.menu_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  sort_order integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz,
  constraint menu_categories_slug_unique unique (slug)
);
create table if not exists public.menu_category_drills (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.menu_categories(id) on delete cascade,
  video_id text not null,
  created_at timestamptz default now(),
  constraint menu_category_drills_category_video_unique unique (category_id, video_id)
);
create index if not exists idx_menu_categories_sort_order
  on public.menu_categories (sort_order);
create index if not exists idx_menu_category_drills_category_id
  on public.menu_category_drills (category_id);
create index if not exists idx_menu_category_drills_video_id
  on public.menu_category_drills (video_id);
alter table public.menu_categories enable row level security;
alter table public.menu_category_drills enable row level security;
grant select on table public.menu_categories to anon, authenticated;
grant select on table public.menu_category_drills to anon, authenticated;
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'menu_categories'
      and policyname = 'menu_categories_read_all'
  ) then
    create policy menu_categories_read_all
      on public.menu_categories
      for select
      to anon, authenticated
      using (true);
  end if;
end
$$;
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'menu_category_drills'
      and policyname = 'menu_category_drills_read_all'
  ) then
    create policy menu_category_drills_read_all
      on public.menu_category_drills
      for select
      to anon, authenticated
      using (true);
  end if;
end
$$;
insert into public.menu_categories (name, slug, sort_order)
values
  ('Step 1 / Level 1', 'step1', 1),
  ('Step 2 / Level 2', 'step2', 2),
  ('Step 3 / Level 3', 'step3', 3),
  ('Step 4 (Interviews)', 'step4', 4)
on conflict (slug) do update
set
  name = excluded.name,
  sort_order = excluded.sort_order,
  updated_at = now();
