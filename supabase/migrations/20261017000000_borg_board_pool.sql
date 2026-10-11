-- Names already on the board, for quick-adding to the AI Borg Studio's example pool.
--   get_borg_board_pool()   admins only: [{ name, original, source }], one row per name (letters
--                           and digits, like nameKey() in the Studio), source order then newest first
--     'ai'       Studio-approved BORG AI names with their original: the name of a 👍 rating or the
--                fixed name of a ✏️ one, left out when that name's latest rating is 👎 (like the
--                fine-tuning export)
--     'member'   approved member submissions; original is null (members only send the name)
-- The site's classic names live in src/data.json, so the Studio adds those itself.

create or replace function public.get_borg_board_pool()
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_borg_admin() then
    raise exception 'Admins only.';
  end if;

  return (
    with rated as (
      select
        r.id,
        r.created_at,
        r.verdict,
        r.original,
        case when r.verdict = 'fixed' then r.fixed_name else r.name end as approved_name,
        lower(regexp_replace(case when r.verdict = 'fixed' then r.fixed_name else r.name end, '[^a-zA-Z0-9]+', '', 'g'))
          as approved_key,
        lower(regexp_replace(r.name, '[^a-zA-Z0-9]+', '', 'g')) as rated_key
      from public.borg_ai_ratings r
    ),
    latest as (
      select distinct on (x.rated_key) x.rated_key, x.verdict
      from rated x
      order by x.rated_key, x.created_at desc, x.id desc
    ),
    ai as (
      select distinct on (x.approved_key)
        x.approved_name as name,
        x.original,
        x.created_at as at,
        x.id
      from rated x
      where x.verdict in ('good', 'fixed')
        and not exists (
          select 1 from latest l where l.rated_key = x.approved_key and l.verdict = 'bad'
        )
      order by x.approved_key, x.created_at desc, x.id desc
    ),
    pool as (
      select a.name, a.original, 'ai' as source, 1 as rank, a.at, a.id
      from ai a
      union all
      select s.name, null, 'member', 2, s.reviewed_at, s.id
      from public.borg_submissions s
      where s.status = 'approved'
        and not exists (
          select 1 from ai a
          where lower(regexp_replace(a.name, '[^a-zA-Z0-9]+', '', 'g'))
            = lower(regexp_replace(s.name, '[^a-zA-Z0-9]+', '', 'g'))
        )
    )
    select coalesce(
      json_agg(
        json_build_object('name', p.name, 'original', p.original, 'source', p.source)
        order by p.rank, p.at desc, p.id desc
      ),
      '[]'
    )
    from pool p
  );
end;
$$;

revoke all on function public.get_borg_board_pool() from public, anon;
grant execute on function public.get_borg_board_pool() to authenticated;
