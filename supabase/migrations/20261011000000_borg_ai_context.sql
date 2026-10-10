-- What BORG AI needs to know before it asks the model, in one call from the generate-borg-name
-- edge function (service role only):
--   examples  names people liked or admins approved, sampled into the prompt as style examples
--   avoid     every name a new one must not repeat or respell: liked names, all submissions
--             (rejected ones included) and the latest AI names
--   recent    the latest AI names, newest first, shown to the model as already used

create index if not exists borg_rolls_ai_recent_idx
  on public.borg_rolls (rolled_at desc)
  where kind = 'ai';

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
    select r.name, r.rolled_at, r.id
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
    )
  );
$$;

revoke all on function public.get_borg_ai_context(integer) from public, anon, authenticated;
grant execute on function public.get_borg_ai_context(integer) to service_role;
