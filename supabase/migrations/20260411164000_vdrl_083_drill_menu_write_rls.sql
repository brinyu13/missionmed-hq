-- VDRL-083
-- Enable frontend admin write access for drill menu control tables.
-- Scope: menu_categories, menu_category_drills, drill_registry_control.

alter table if exists public.menu_categories enable row level security;
alter table if exists public.menu_category_drills enable row level security;
alter table if exists public.drill_registry_control enable row level security;
grant insert, update, delete on table public.menu_categories to anon;
grant insert, update, delete on table public.menu_category_drills to anon;
grant insert, update, delete on table public.drill_registry_control to anon;
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'menu_categories'
      and policyname = 'menu_categories_insert_anon'
  ) then
    create policy menu_categories_insert_anon
      on public.menu_categories
      for insert
      to anon
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'menu_categories'
      and policyname = 'menu_categories_update_anon'
  ) then
    create policy menu_categories_update_anon
      on public.menu_categories
      for update
      to anon
      using (true)
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'menu_categories'
      and policyname = 'menu_categories_delete_anon'
  ) then
    create policy menu_categories_delete_anon
      on public.menu_categories
      for delete
      to anon
      using (true);
  end if;
end
$$;
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'menu_category_drills'
      and policyname = 'menu_category_drills_insert_anon'
  ) then
    create policy menu_category_drills_insert_anon
      on public.menu_category_drills
      for insert
      to anon
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'menu_category_drills'
      and policyname = 'menu_category_drills_update_anon'
  ) then
    create policy menu_category_drills_update_anon
      on public.menu_category_drills
      for update
      to anon
      using (true)
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'menu_category_drills'
      and policyname = 'menu_category_drills_delete_anon'
  ) then
    create policy menu_category_drills_delete_anon
      on public.menu_category_drills
      for delete
      to anon
      using (true);
  end if;
end
$$;
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'drill_registry_control'
      and policyname = 'drill_registry_control_insert_anon'
  ) then
    create policy drill_registry_control_insert_anon
      on public.drill_registry_control
      for insert
      to anon
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'drill_registry_control'
      and policyname = 'drill_registry_control_update_anon'
  ) then
    create policy drill_registry_control_update_anon
      on public.drill_registry_control
      for update
      to anon
      using (true)
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'drill_registry_control'
      and policyname = 'drill_registry_control_delete_anon'
  ) then
    create policy drill_registry_control_delete_anon
      on public.drill_registry_control
      for delete
      to anon
      using (true);
  end if;
end
$$;
