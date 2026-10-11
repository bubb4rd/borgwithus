-- Studio ratings remember the random topic of the batch they came from, so topics can be compared
-- on real ratings (a blank-theme batch draws one of TOPICS in supabase/functions/_shared/borg-ai.ts).
--   borg_ai_ratings.topic   the batch's random topic; null with a theme and for older ratings
--   rate_borg_name()        takes p_topic (default null, so older Studio builds keep working); it
--                           is only stored when the theme is blank
--   get_borg_studio()       ratings carry topic

alter table public.borg_ai_ratings
  add column if not exists topic text check (topic is null or char_length(topic) between 1 and 120);

drop function if exists public.rate_borg_name(bigint, bigint, text, text, text, text, text, text, text);

-- Rates a Studio test name. p_id null records a new rating; otherwise re-rates that one (verdict,
-- reason and fixed name; the name, who made it, the version and the topic stay). Returns the
-- rating.
create or replace function public.rate_borg_name(
  p_id bigint,
  p_prompt_id bigint,
  p_theme text,
  p_original text,
  p_name text,
  p_source text,
  p_verdict text,
  p_reason text,
  p_fixed_name text,
  p_topic text default null
)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rating public.borg_ai_ratings;
  v_theme text := coalesce(btrim(p_theme), '');
  v_reason text := nullif(btrim(p_reason), '');
  v_fixed text := case when p_verdict = 'fixed' then nullif(btrim(p_fixed_name), '') end;
begin
  if not public.is_borg_admin() then
    raise exception 'Admins only.';
  end if;

  if p_verdict = 'bad' and v_reason is null then
    raise exception 'Say why the name is bad.';
  end if;
  if p_verdict = 'fixed' and v_fixed is null then
    raise exception 'Type the fixed name.';
  end if;

  if p_id is null then
    insert into public.borg_ai_ratings (prompt_id, theme, topic, original, name, source, verdict, reason, fixed_name, rated_by)
    values (
      p_prompt_id,
      v_theme,
      case when v_theme = '' then nullif(btrim(p_topic), '') end,
      btrim(p_original),
      btrim(p_name),
      p_source,
      p_verdict,
      v_reason,
      v_fixed,
      auth.uid()
    )
    returning * into v_rating;
  else
    update public.borg_ai_ratings
    set verdict = p_verdict,
        reason = v_reason,
        fixed_name = v_fixed,
        rated_by = auth.uid()
    where id = p_id
    returning * into v_rating;

    if not found then
      raise exception 'That rating doesn''t exist.';
    end if;
  end if;

  return json_build_object(
    'id', v_rating.id,
    'prompt_id', v_rating.prompt_id,
    'theme', v_rating.theme,
    'topic', v_rating.topic,
    'original', v_rating.original,
    'name', v_rating.name,
    'source', v_rating.source,
    'verdict', v_rating.verdict,
    'reason', v_rating.reason,
    'fixed_name', v_rating.fixed_name,
    'created_at', v_rating.created_at
  );
end;
$$;

revoke all on function public.rate_borg_name(bigint, bigint, text, text, text, text, text, text, text, text) from public, anon;
grant execute on function public.rate_borg_name(bigint, bigint, text, text, text, text, text, text, text, text) to authenticated;

create or replace function public.get_borg_studio(p_ratings integer default 200)
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
    'prompts', (
      select coalesce(
        json_agg(
          json_build_object(
            'id', p.id,
            'version', p.version,
            'label', p.label,
            'system_prompt', p.system_prompt,
            'temperature', p.temperature,
            'example_count', p.example_count,
            'is_live', p.is_live,
            'created_at', p.created_at,
            'ratings', json_build_object(
              'good', coalesce(c.good, 0),
              'bad', coalesce(c.bad, 0),
              'fixed', coalesce(c.fixed, 0),
              'model_good', coalesce(c.model_good, 0),
              'model_rated', coalesce(c.model_rated, 0)
            )
          )
          order by p.version
        ),
        '[]'
      )
      from public.borg_ai_prompts p
      left join (
        select
          r.prompt_id,
          count(*) filter (where r.verdict = 'good') as good,
          count(*) filter (where r.verdict = 'bad') as bad,
          count(*) filter (where r.verdict = 'fixed') as fixed,
          count(*) filter (where r.source = 'model' and r.verdict = 'good') as model_good,
          count(*) filter (where r.source = 'model') as model_rated
        from public.borg_ai_ratings r
        group by r.prompt_id
      ) c on c.prompt_id = p.id
    ),
    'examples', (
      select coalesce(
        json_agg(
          json_build_object(
            'id', e.id,
            'original', e.original,
            'name', e.name,
            'enabled', e.enabled,
            'source', e.source,
            'created_at', e.created_at
          )
          order by e.created_at desc, e.id desc
        ),
        '[]'
      )
      from public.borg_ai_examples e
    ),
    'ratings', (
      select coalesce(json_agg(x order by x.created_at desc, x.id desc), '[]')
      from (
        select r.id, r.prompt_id, r.theme, r.topic, r.original, r.name, r.source, r.verdict, r.reason,
          r.fixed_name, r.created_at
        from public.borg_ai_ratings r
        order by r.created_at desc, r.id desc
        limit least(greatest(coalesce(p_ratings, 200), 0), 1000)
      ) x
    )
  );
end;
$$;
