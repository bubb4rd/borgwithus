-- Fine-tuning data for BORG AI, exported from the AI Borg Studio.
--   get_borg_ai_training_data()   admins only: everything a training set is built from, uncapped
--     ratings   every Studio rating (all verdicts), oldest first: the 👍 and ✏️ ones are training
--               targets, ✏️ ones also preference pairs (fixed name over the model's), 👎 names are
--               kept out
--     liked     live AI names with an original that members liked more than they disliked
--     examples  the switched-on example pool

create or replace function public.get_borg_ai_training_data()
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

  return json_build_object(
    'ratings', (
      select coalesce(json_agg(x order by x.created_at, x.id), '[]')
      from (
        select r.id, r.prompt_id, r.theme, r.original, r.name, r.source, r.verdict, r.reason, r.fixed_name,
          r.created_at
        from public.borg_ai_ratings r
      ) x
    ),
    'liked', (
      select coalesce(json_agg(l order by l.likes desc, l.name), '[]')
      from (
        select
          r.name,
          (array_agg(r.original order by r.rolled_at desc, r.id desc) filter (where r.original is not null))[1]
            as original,
          (array_agg(r.source order by r.rolled_at desc, r.id desc))[1] as source,
          coalesce(c.likes, 0) as likes,
          coalesce(d.dislikes, 0) as dislikes
        from public.borg_rolls r
        join public.borg_like_counts c on c.name = r.name
        left join (
          select x.name, count(*)::integer as dislikes
          from public.borg_ai_dislikes x
          group by x.name
        ) d on d.name = r.name
        where r.kind = 'ai'
        group by r.name, c.likes, d.dislikes
        having coalesce(c.likes, 0) > coalesce(d.dislikes, 0)
          and bool_or(r.original is not null)
      ) l
    ),
    'examples', (
      select coalesce(json_agg(json_build_object('original', e.original, 'name', e.name) order by e.id), '[]')
      from public.borg_ai_examples e
      where e.enabled
    )
  );
end;
$$;

revoke all on function public.get_borg_ai_training_data() from public, anon;
grant execute on function public.get_borg_ai_training_data() to authenticated;
