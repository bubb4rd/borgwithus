-- How many borgs reached the board in the last 7 days, for the home page hero's announcement pill.
--   get_borgs_added_this_week()   anyone; counts public.borgs rows by created_at, which the public
--                                 can't read directly
-- …_borg_catalog.sql stamped the names it seeded with the time it ran, so they'd all count as new.
-- Their created_at moves back to when they really reached the board: the classics to the site's
-- launch (src/data.json's first commit), Studio-approved AI names to their first 👍 or ✏️ rating.
-- Member names were seeded with their approval time already.

do $$
declare
  v_seeded timestamptz;
begin
  -- The seed was the first classic insert, in a single statement.
  select min(b.created_at) into v_seeded from public.borgs b where b.source = 'classic';
  if v_seeded is null then
    return;
  end if;

  update public.borgs b
  set created_at = timestamptz '2023-10-20 18:51:40-07'
  where b.source = 'classic'
    and b.created_at = v_seeded;

  -- The AI seed ran right after, in the same migration.
  update public.borgs b
  set created_at = r.first_at
  from (
    select
      public.borg_name_key(case when x.verdict = 'fixed' then x.fixed_name else x.name end) as key,
      min(x.created_at) as first_at
    from public.borg_ai_ratings x
    where x.verdict in ('good', 'fixed')
    group by 1
  ) r
  where b.source = 'ai'
    and b.created_at between v_seeded and v_seeded + interval '5 minutes'
    and r.key = public.borg_name_key(b.name)
    and r.first_at < b.created_at;
end;
$$;

create or replace function public.get_borgs_added_this_week()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from public.borgs b
  where b.created_at > now() - interval '7 days';
$$;

revoke all on function public.get_borgs_added_this_week() from public;
grant execute on function public.get_borgs_added_this_week() to anon, authenticated;
