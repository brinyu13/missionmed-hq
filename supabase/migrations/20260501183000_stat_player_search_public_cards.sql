-- E9 909A STAT approved-account player search cards
-- Purpose: RLS-safe opponent search for STAT friend challenges.
-- Scope: public.stat_player_search(text, integer) only. No table RLS changes.

begin;

create or replace function public.stat_player_search(
  p_query text default '',
  p_limit integer default 30
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_actor uuid := auth.uid();
  v_query text := lower(trim(coalesce(p_query, '')));
  v_limit integer := greatest(1, least(coalesce(p_limit, 30), 60));
  v_items jsonb := '[]'::jsonb;
begin
  if v_actor is null then
    raise exception 'auth_required';
  end if;

  perform public.ensure_player_profile(v_actor);

  with candidates as (
    select
      pp.player_id,
      nullif(trim(pp.display_name), '') as profile_display_name,
      pp.rating,
      pp.wins,
      pp.losses,
      pp.last_active_at,
      nullif(trim(p.first_name), '') as first_name,
      nullif(trim(p.last_name), '') as last_name,
      lower(nullif(trim(p.email), '')) as email,
      coalesce(ua.avatar_url, p.avatar_url) as avatar_url,
      coalesce(ua.thumbnail_url, ua.avatar_url, p.avatar_url) as avatar_thumbnail_url
    from public.player_profiles pp
    left join public.profiles p
      on p.auth_user_id = pp.player_id
      or p.id = pp.player_id
    left join lateral (
      select av.avatar_url, av.thumbnail_url
      from public.user_avatars av
      where av.user_id = pp.player_id
        and av.is_active = true
      order by av.created_at desc
      limit 1
    ) ua on true
    where pp.player_id <> v_actor
  ),
  shaped as (
    select
      c.*,
      split_part(c.email, '@', 1) as email_local,
      case
        when c.first_name is not null and c.last_name is not null
          then initcap(c.first_name) || ' ' || upper(left(c.last_name, 1)) || '.'
        when c.first_name is not null
          then initcap(c.first_name)
        when c.profile_display_name is not null
          then c.profile_display_name
        when c.email is not null
          then split_part(c.email, '@', 1)
        else 'Student ' || left(c.player_id::text, 8)
      end as public_display_name
    from candidates c
  ),
  filtered as (
    select
      s.*,
      case
        when v_query = '' then 50
        when s.player_id::text = v_query then 0
        when lower(coalesce(s.email_local, '')) = v_query then 1
        when lower(coalesce(s.email, '')) = v_query then 2
        when lower(coalesce(s.public_display_name, '')) = v_query then 3
        when lower(coalesce(s.first_name, '')) = v_query then 4
        when lower(coalesce(s.last_name, '')) = v_query then 5
        when lower(coalesce(s.email_local, '')) like v_query || '%' then 10
        when lower(coalesce(s.public_display_name, '')) like v_query || '%' then 11
        when lower(coalesce(s.first_name, '')) like v_query || '%' then 12
        when lower(coalesce(s.last_name, '')) like v_query || '%' then 13
        else 40
      end as rank_score
    from shaped s
    where v_query = ''
      or s.player_id::text ilike '%' || v_query || '%'
      or coalesce(s.profile_display_name, '') ilike '%' || v_query || '%'
      or coalesce(s.first_name, '') ilike '%' || v_query || '%'
      or coalesce(s.last_name, '') ilike '%' || v_query || '%'
      or coalesce(s.email, '') ilike '%' || v_query || '%'
      or coalesce(s.email_local, '') ilike '%' || v_query || '%'
      or coalesce(s.public_display_name, '') ilike '%' || v_query || '%'
  ),
  limited as (
    select *
    from filtered
    order by rank_score asc, last_active_at desc nulls last, public_display_name asc
    limit v_limit
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'user_id', player_id,
    'player_id', player_id,
    'display_name', public_display_name,
    'public_display_name', public_display_name,
    'first_name', first_name,
    'last_name', last_name,
    'username', email_local,
    'safe_identifier', coalesce(email_local, 'Student ' || left(player_id::text, 8)),
    'rating', rating,
    'wins', wins,
    'losses', losses,
    'last_active_at', last_active_at,
    'status_label', case
      when last_active_at >= now() - interval '10 minutes' then 'Online now'
      when last_active_at >= now() - interval '24 hours' then 'Active today'
      when last_active_at >= now() - interval '7 days' then 'Active this week'
      else 'Recent'
    end,
    'avatar_url', avatar_url,
    'avatar_thumbnail_url', avatar_thumbnail_url,
    'source', case when v_query = '' then 'active' else 'search' end
  ) order by rank_score asc, last_active_at desc nulls last, public_display_name asc), '[]'::jsonb)
  into v_items
  from limited;

  return jsonb_build_object(
    'status', 'ok',
    'query', p_query,
    'items', v_items
  );
end;
$$;

comment on function public.stat_player_search(text, integer) is
  'STAT friend challenge search. SECURITY DEFINER; returns minimal public challenge-card fields for authenticated users.';

revoke all on function public.stat_player_search(text, integer) from public;
revoke all on function public.stat_player_search(text, integer) from anon;
grant execute on function public.stat_player_search(text, integer) to authenticated;

commit;
