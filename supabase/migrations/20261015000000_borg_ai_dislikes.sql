-- 👎 on BORG AI names.
--   borg_ai_dislikes         one row per (member, name) a member disliked on the BORG AI result. A
--                            name is liked or disliked, not both: the site drops the other on toggle.
--   get_borg_ai_feedback()   admins only: AI names rolled in the last p_days days that members
--                            liked or disliked, for the AI Borg Studio.
--   get_borg_ai_context()    `examples` skips names with at least as many dislikes as likes, so
--                            disliked names never become prompt examples.

create table if not exists public.borg_ai_dislikes (
  user_id uuid not null references auth.users on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  created_at timestamptz not null default now(),
  primary key (user_id, name)
);

create index if not exists borg_ai_dislikes_name_idx on public.borg_ai_dislikes (name);

alter table public.borg_ai_dislikes enable row level security;

drop policy if exists "Users read own AI dislikes" on public.borg_ai_dislikes;
create policy "Users read own AI dislikes"
  on public.borg_ai_dislikes for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users add own AI dislikes" on public.borg_ai_dislikes;
create policy "Users add own AI dislikes"
  on public.borg_ai_dislikes for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users remove own AI dislikes" on public.borg_ai_dislikes;
create policy "Users remove own AI dislikes"
  on public.borg_ai_dislikes for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Supabase's default privileges grant every new public table to anon and authenticated.
revoke all on public.borg_ai_dislikes from anon, authenticated;
grant select, insert, delete on public.borg_ai_dislikes to authenticated;

-- ---------- AI Borg Studio (admins only) ----------

-- One row per AI name rolled in the last p_days days (1 to 365) with at least one like or dislike,
-- most reactions first: its latest original (null when only older rolls were logged), the source of
-- its latest roll ('model' or 'code', null when unknown), rolls in the window, last roll, and
-- all-time likes and dislikes.
create or replace function public.get_borg_ai_feedback(p_days integer default 30)
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_from timestamptz := now() - make_interval(days => least(greatest(coalesce(p_days, 30), 1), 365));
begin
  if not public.is_borg_admin() then
    raise exception 'Admins only.';
  end if;

  return (
    select coalesce(json_agg(f order by f.likes + f.dislikes desc, f.last_rolled_at desc), '[]')
    from (
      select
        r.name,
        (array_agg(r.original order by r.rolled_at desc, r.id desc) filter (where r.original is not null))[1]
          as original,
        (array_agg(r.source order by r.rolled_at desc, r.id desc))[1] as source,
        count(*)::integer as rolls,
        max(r.rolled_at) as last_rolled_at,
        coalesce(c.likes, 0) as likes,
        coalesce(d.dislikes, 0) as dislikes
      from public.borg_rolls r
      left join public.borg_like_counts c on c.name = r.name
      left join (
        select x.name, count(*)::integer as dislikes
        from public.borg_ai_dislikes x
        group by x.name
      ) d on d.name = r.name
      where r.kind = 'ai'
        and r.rolled_at >= v_from
      group by r.name, c.likes, d.dislikes
      having coalesce(c.likes, 0) + coalesce(d.dislikes, 0) > 0
      order by coalesce(c.likes, 0) + coalesce(d.dislikes, 0) desc, max(r.rolled_at) desc
      limit 200
    ) f
  );
end;
$$;

revoke all on function public.get_borg_ai_feedback(integer) from public, anon;
grant execute on function public.get_borg_ai_feedback(integer) to authenticated;

-- ---------- edge function (service role) ----------

create or replace function public.get_borg_ai_context(p_recent integer default 300)
returns json
language sql
stable
security definer
set search_path = ''
as $$
  with liked as (
    select c.name
    from public.borg_like_counts c
    order by c.likes desc, c.name
    limit 500
  ),
  approved as (
    select s.name
    from public.borg_submissions s
    where s.status = 'approved'
    order by s.reviewed_at desc, s.id desc
    limit 500
  ),
  submitted as (
    select s.name
    from public.borg_submissions s
    order by s.created_at desc, s.id desc
    limit 1000
  ),
  recent_ai as (
    select r.name, r.original, r.rolled_at, r.id
    from public.borg_rolls r
    where r.kind = 'ai'
    order by r.rolled_at desc, r.id desc
    limit least(greatest(coalesce(p_recent, 300), 0), 1000)
  ),
  disliked as (
    select d.name
    from public.borg_ai_dislikes d
    left join public.borg_like_counts c on c.name = d.name
    group by d.name, c.likes
    having count(*) >= coalesce(c.likes, 0)
  )
  select json_build_object(
    'examples', (
      select coalesce(json_agg(distinct e.name), '[]')
      from (select name from liked union select name from approved) e
      where e.name ~* '\w+borg|borg\w+'
        and not exists (select 1 from disliked x where x.name = e.name)
    ),
    'avoid', (
      select coalesce(json_agg(distinct a.name), '[]')
      from (
        select name from liked
        union select name from submitted
        union select name from recent_ai
      ) a
    ),
    'recent', (
      select coalesce(json_agg(x.name order by x.rolled_at desc, x.id desc), '[]')
      from (select * from recent_ai order by rolled_at desc, id desc limit 20) x
    ),
    'originals', (
      select coalesce(json_agg(o.original order by o.last_at desc), '[]')
      from (
        select original, max(rolled_at) as last_at
        from recent_ai
        where original is not null
        group by original
      ) o
    )
  );
$$;

revoke all on function public.get_borg_ai_context(integer) from public, anon, authenticated;
grant execute on function public.get_borg_ai_context(integer) to service_role;
