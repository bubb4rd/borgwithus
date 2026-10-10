-- Admin dashboard.
--   borg_rolls  one row per name rolled: classic BORG and MIO rolls from the generator (members
--               and guests alike, user_id null for guests), and BORG AI names logged by the
--               generate-borg-name edge function.
-- get_admin_dashboard() is the only reader; it returns members, roll counts, daily series, recent
-- activity and likes in one call, for admins only.

create table if not exists public.borg_rolls (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users on delete set null,
  kind text not null check (kind in ('borg', 'mio', 'ai')),
  name text not null check (char_length(name) between 1 and 80),
  rolled_at timestamptz not null default now()
);

create index if not exists borg_rolls_recent_idx on public.borg_rolls (rolled_at desc);

-- No policies: guests and members write through log_borg_roll(), the edge function writes as
-- service role, admins read through get_admin_dashboard().
alter table public.borg_rolls enable row level security;

-- Supabase's default privileges grant every new public table to anon and authenticated. RLS
-- already blocks them; revoke anyway so these tables are reachable only through their functions.
revoke all on public.borg_rolls from anon, authenticated;
revoke all on public.borg_submissions from anon, authenticated;
revoke all on public.borg_admins from anon, authenticated;
grant insert on public.borg_rolls to service_role;

-- Carry roll history over from the previous schema when it exists.
do $$
begin
  if to_regclass('public.user_rolls') is not null
    and not exists (select 1 from public.borg_rolls) then
    insert into public.borg_rolls (user_id, kind, name, rolled_at)
    select user_id, roll_type, left(btrim(name), 80), rolled_at
    from public.user_rolls
    where roll_type in ('borg', 'mio', 'ai')
      and char_length(btrim(name)) > 0
    order by rolled_at;
  end if;
end;
$$;

-- Records one classic roll for whoever is calling (guests included). BORG AI rolls are logged by
-- the edge function instead, so they can't be faked from the browser.
create or replace function public.log_borg_roll(p_kind text, p_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := left(btrim(coalesce(p_name, '')), 80);
begin
  if p_kind not in ('borg', 'mio') or v_name = '' then
    return;
  end if;

  insert into public.borg_rolls (user_id, kind, name)
  values (auth.uid(), p_kind, v_name);
end;
$$;

-- Everything the admin dashboard shows. Days are bucketed in p_tz (the admin's own time zone,
-- falling back to UTC) over the last p_days days, today included.
create or replace function public.get_admin_dashboard(p_tz text default 'UTC', p_days integer default 14)
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_days integer := least(greatest(coalesce(p_days, 14), 1), 90);
  v_tz text := 'UTC';
  v_today date;
  v_from timestamptz;
  v_series json;
begin
  if not public.is_borg_admin() then
    raise exception 'Admins only.';
  end if;

  if exists (select 1 from pg_catalog.pg_timezone_names t where t.name = p_tz) then
    v_tz := p_tz;
  end if;
  v_today := (now() at time zone v_tz)::date;
  v_from := (v_today - (v_days - 1))::timestamp at time zone v_tz;

  with days as (
    select (v_today - offs) as day
    from generate_series(0, v_days - 1) as offs
  ),
  signups as (
    select (u.created_at at time zone v_tz)::date as day, count(*) as n
    from auth.users u
    where u.created_at >= v_from
    group by 1
  ),
  rolls as (
    select (r.rolled_at at time zone v_tz)::date as day,
      count(*) filter (where r.kind = 'borg') as borg,
      count(*) filter (where r.kind = 'mio') as mio,
      count(*) filter (where r.kind = 'ai') as ai
    from public.borg_rolls r
    where r.rolled_at >= v_from
    group by 1
  )
  select json_agg(
    json_build_object(
      'day', d.day,
      'members', coalesce(s.n, 0),
      'borg', coalesce(r.borg, 0),
      'mio', coalesce(r.mio, 0),
      'ai', coalesce(r.ai, 0)
    )
    order by d.day
  )
  into v_series
  from days d
  left join signups s on s.day = d.day
  left join rolls r on r.day = d.day;

  return json_build_object(
    'timezone', v_tz,
    'series', v_series,
    'totals', (
      select json_build_object(
        'members', (select count(*) from auth.users),
        'confirmed', (select count(*) from auth.users u where u.email_confirmed_at is not null),
        'borg', count(*) filter (where r.kind = 'borg'),
        'mio', count(*) filter (where r.kind = 'mio'),
        'ai', count(*) filter (where r.kind = 'ai'),
        'guest_rolls', count(*) filter (where r.user_id is null),
        'likes', (select coalesce(sum(c.likes), 0) from public.borg_like_counts c),
        'liked_names', (select count(*) from public.borg_like_counts),
        'ai_credits_today', (
          select coalesce(sum(a.used), 0)
          from public.ai_credit_usage a
          where a.day = (now() at time zone 'utc')::date
        ),
        'pending', (select count(*) from public.borg_submissions s where s.status = 'pending'),
        'approved', (select count(*) from public.borg_submissions s where s.status = 'approved'),
        'rejected', (select count(*) from public.borg_submissions s where s.status = 'rejected')
      )
      from public.borg_rolls r
    ),
    'recent_members', (
      select coalesce(json_agg(m order by m.created_at desc), '[]')
      from (
        select u.id, nullif(btrim(u.raw_user_meta_data ->> 'name'), '') as name, u.email,
          u.created_at, u.last_sign_in_at, u.email_confirmed_at is not null as confirmed
        from auth.users u
        order by u.created_at desc
        limit 8
      ) m
    ),
    'recent_rolls', (
      select coalesce(json_agg(x order by x.rolled_at desc, x.id desc), '[]')
      from (
        select r.id, r.kind, r.name, r.rolled_at,
          case when u.id is not null then coalesce(
            nullif(btrim(u.raw_user_meta_data ->> 'name'), ''),
            split_part(u.email, '@', 1)
          ) end as member
        from public.borg_rolls r
        left join auth.users u on u.id = r.user_id
        order by r.rolled_at desc, r.id desc
        limit 12
      ) x
    ),
    'top_liked', (
      select coalesce(json_agg(t order by t.likes desc, t.name), '[]')
      from (
        select c.name, c.likes
        from public.borg_like_counts c
        order by c.likes desc, c.name
        limit 10
      ) t
    )
  );
end;
$$;

revoke all on function public.log_borg_roll(text, text) from public;
grant execute on function public.log_borg_roll(text, text) to anon, authenticated;

revoke all on function public.get_admin_dashboard(text, integer) from public, anon;
grant execute on function public.get_admin_dashboard(text, integer) to authenticated;
