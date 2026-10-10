-- BORG AI names come with the original they riff on ("Morgan Freeman" for "Borgan Freeman").
--   borg_rolls.original     set for AI rolls, null for classic rolls and older AI rolls
--   get_borg_ai_context()   adds `originals`: originals of the latest AI rolls, newest first, so
--                           new names pick other references

alter table public.borg_rolls
  add column if not exists original text check (original is null or char_length(original) between 1 and 80);

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
  )
  select json_build_object(
    'examples', (
      select coalesce(json_agg(distinct e.name), '[]')
      from (select name from liked union select name from approved) e
      where e.name ~* '\w+borg|borg\w+'
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
