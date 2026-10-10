-- AI Borg Studio: the admin tab where BORG AI's prompt is tuned.
--   borg_ai_prompts   prompt versions. Never edited once saved, so every rating points at the exact
--                     prompt that made the name; at most one is live. "{count}" in system_prompt
--                     stands for the number of lines asked for. With none live, BORG AI falls back
--                     to the prompt built into the edge function.
--   borg_ai_examples  "Original -> name" pairs the prompt samples as format examples, switched on
--                     and off from the Studio; ⭐ on a test name adds one.
--   borg_ai_ratings   admin verdicts on Studio test names: good, bad (with a reason) or fixed
--                     (with the corrected name), tied to the version that made the name.
-- No policies or grants: admins go through the functions below, the generate-borg-name edge
-- function reads the live version through get_borg_ai_prompt() as service role.

create table if not exists public.borg_ai_prompts (
  id bigint generated always as identity primary key,
  version integer not null unique check (version > 0),
  label text check (label is null or char_length(label) between 1 and 60),
  system_prompt text not null check (char_length(system_prompt) between 1 and 8000),
  temperature numeric(3, 2) not null check (temperature between 0 and 2),
  example_count integer not null check (example_count between 0 and 30),
  is_live boolean not null default false,
  created_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now()
);

create unique index if not exists borg_ai_prompts_one_live_idx
  on public.borg_ai_prompts (is_live)
  where is_live;

create table if not exists public.borg_ai_examples (
  id bigint generated always as identity primary key,
  original text not null check (char_length(original) between 1 and 80),
  name text not null check (char_length(name) between 1 and 80),
  -- Letters and digits only, like nameKey() in the Studio: "Sponge Borg" and "SpongeBorg" collide.
  name_key text generated always as (lower(regexp_replace(name, '[^a-zA-Z0-9]+', '', 'g'))) stored
    constraint borg_ai_examples_name_key_key unique,
  enabled boolean not null default true,
  source text not null default 'studio' check (source in ('style', 'studio')),
  created_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.borg_ai_ratings (
  id bigint generated always as identity primary key,
  prompt_id bigint not null references public.borg_ai_prompts on delete cascade,
  theme text not null default '' check (char_length(theme) <= 120),
  original text not null check (char_length(original) between 1 and 80),
  name text not null check (char_length(name) between 1 and 80),
  verdict text not null check (verdict in ('good', 'bad', 'fixed')),
  reason text check (reason is null or char_length(reason) between 1 and 300),
  fixed_name text check (fixed_name is null or char_length(fixed_name) between 1 and 80),
  rated_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now(),
  check (verdict <> 'bad' or reason is not null),
  check ((verdict = 'fixed') = (fixed_name is not null))
);

create index if not exists borg_ai_ratings_recent_idx on public.borg_ai_ratings (created_at desc, id desc);
create index if not exists borg_ai_ratings_prompt_idx on public.borg_ai_ratings (prompt_id);

alter table public.borg_ai_prompts enable row level security;
alter table public.borg_ai_examples enable row level security;
alter table public.borg_ai_ratings enable row level security;

-- Supabase's default privileges grant every new public table to anon and authenticated.
revoke all on public.borg_ai_prompts from anon, authenticated;
revoke all on public.borg_ai_examples from anon, authenticated;
revoke all on public.borg_ai_ratings from anon, authenticated;

-- v1 is the prompt built into generate-borg-name when this migration was written, live from the
-- start so switching the edge function over changes nothing until a new version goes live.
insert into public.borg_ai_prompts (version, label, system_prompt, temperature, example_count, is_live)
select
  1,
  'Built-in prompt',
  $prompt$You make BORG names: a famous person, place, brand, title or phrase with one sound swapped for "borg" so it still sounds like the original out loud.
- Swap a sound like bor, bur, bar, ber, burg or bro. Never tack borg on: "Taylor Swift -> Taylorborg" is wrong.
- Left of the arrow: the real original, never containing borg. Right: the same words with one sound swapped.
- Instantly recognisable originals: sports, rap, memes, movies, internet culture. Crude, chaotic humour is fine.
- Every line a different original. Skip originals and names you were told are used.
Reply with {count} lines in the form: Original -> BORG name
Nothing else: no numbering, no quotes, no explanation.$prompt$,
  1,
  4,
  true
where not exists (select 1 from public.borg_ai_prompts);

-- The edge function's STYLE_PAIRS.
insert into public.borg_ai_examples (original, name, source)
values
  ('Ron Burgundy', 'Ron Borgundy', 'style'),
  ('LeBron James', 'LeBorg James', 'style'),
  ('Pablo Escobar', 'Pablo Escoborg', 'style'),
  ('Playboi Carti', 'Playborg Carti', 'style'),
  ('SpongeBob', 'SpongeBorg', 'style'),
  ('Heisenberg', 'Heisenborg', 'style'),
  ('Morgan Freeman', 'Borgan Freeman', 'style'),
  ('Mark Zuckerberg', 'Mark Zuckerborg', 'style'),
  ('Pearl Harbor', 'Pearl Harborg', 'style'),
  ('Kareem Abdul-Jabbar', 'Kareem Abdul-Jaborg', 'style')
on conflict (name_key) do nothing;

-- ---------- Studio (admins only) ----------

-- Everything the Studio tab shows: every version with its rating counts (oldest first), the whole
-- example pool and the latest p_ratings ratings (newest first).
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
              'fixed', coalesce(c.fixed, 0)
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
          count(*) filter (where r.verdict = 'fixed') as fixed
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
        select r.id, r.prompt_id, r.theme, r.original, r.name, r.verdict, r.reason, r.fixed_name, r.created_at
        from public.borg_ai_ratings r
        order by r.created_at desc, r.id desc
        limit least(greatest(coalesce(p_ratings, 200), 0), 1000)
      ) x
    )
  );
end;
$$;

-- Saves the next version (not live). Returns it.
create or replace function public.save_borg_prompt(
  p_label text,
  p_system_prompt text,
  p_temperature numeric,
  p_example_count integer
)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_prompt public.borg_ai_prompts;
begin
  if not public.is_borg_admin() then
    raise exception 'Admins only.';
  end if;

  -- Two admins saving at once must not both take the same version number.
  lock table public.borg_ai_prompts in share row exclusive mode;

  insert into public.borg_ai_prompts (version, label, system_prompt, temperature, example_count, created_by)
  values (
    (select coalesce(max(p.version), 0) + 1 from public.borg_ai_prompts p),
    nullif(btrim(p_label), ''),
    btrim(p_system_prompt),
    p_temperature,
    p_example_count,
    auth.uid()
  )
  returning * into v_prompt;

  return json_build_object(
    'id', v_prompt.id,
    'version', v_prompt.version,
    'label', v_prompt.label,
    'system_prompt', v_prompt.system_prompt,
    'temperature', v_prompt.temperature,
    'example_count', v_prompt.example_count,
    'is_live', v_prompt.is_live,
    'created_at', v_prompt.created_at,
    'ratings', json_build_object('good', 0, 'bad', 0, 'fixed', 0)
  );
end;
$$;

-- Makes p_id the only live version.
create or replace function public.set_live_borg_prompt(p_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_borg_admin() then
    raise exception 'Admins only.';
  end if;

  lock table public.borg_ai_prompts in share row exclusive mode;

  if not exists (select 1 from public.borg_ai_prompts p where p.id = p_id) then
    raise exception 'That prompt version doesn''t exist.';
  end if;

  -- Two statements: the one-live index is checked row by row, so a single update could trip it.
  update public.borg_ai_prompts set is_live = false where is_live and id <> p_id;
  update public.borg_ai_prompts set is_live = true where id = p_id;
end;
$$;

-- Adds a pair to the example pool, switched on. A name already in the pool (same letters and
-- digits) is switched back on instead. Returns the pool entry.
create or replace function public.add_borg_example(p_original text, p_name text)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_example public.borg_ai_examples;
begin
  if not public.is_borg_admin() then
    raise exception 'Admins only.';
  end if;

  insert into public.borg_ai_examples (original, name, created_by)
  values (btrim(p_original), btrim(p_name), auth.uid())
  on conflict (name_key) do update set enabled = true
  returning * into v_example;

  return json_build_object(
    'id', v_example.id,
    'original', v_example.original,
    'name', v_example.name,
    'enabled', v_example.enabled,
    'source', v_example.source,
    'created_at', v_example.created_at
  );
end;
$$;

create or replace function public.set_borg_example_enabled(p_id bigint, p_enabled boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_borg_admin() then
    raise exception 'Admins only.';
  end if;

  update public.borg_ai_examples set enabled = p_enabled where id = p_id;
  if not found then
    raise exception 'That example doesn''t exist.';
  end if;
end;
$$;

-- Rates a Studio test name. p_id null records a new rating; otherwise re-rates that one (verdict,
-- reason and fixed name; the name and the version that made it stay). Returns the rating.
create or replace function public.rate_borg_name(
  p_id bigint,
  p_prompt_id bigint,
  p_theme text,
  p_original text,
  p_name text,
  p_verdict text,
  p_reason text,
  p_fixed_name text
)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rating public.borg_ai_ratings;
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
    insert into public.borg_ai_ratings (prompt_id, theme, original, name, verdict, reason, fixed_name, rated_by)
    values (
      p_prompt_id,
      coalesce(btrim(p_theme), ''),
      btrim(p_original),
      btrim(p_name),
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
    'original', v_rating.original,
    'name', v_rating.name,
    'verdict', v_rating.verdict,
    'reason', v_rating.reason,
    'fixed_name', v_rating.fixed_name,
    'created_at', v_rating.created_at
  );
end;
$$;

-- ---------- edge function (service role) ----------

-- The prompt BORG AI should use: the live version, or p_prompt_id for a Studio test batch, and the
-- switched-on example pairs. `prompt` is null when there is no such version (or none is live).
create or replace function public.get_borg_ai_prompt(p_prompt_id bigint default null)
returns json
language sql
stable
security definer
set search_path = ''
as $$
  select json_build_object(
    'prompt', (
      select json_build_object(
        'id', p.id,
        'version', p.version,
        'system_prompt', p.system_prompt,
        'temperature', p.temperature,
        'example_count', p.example_count
      )
      from public.borg_ai_prompts p
      where case when p_prompt_id is null then p.is_live else p.id = p_prompt_id end
    ),
    'examples', (
      select coalesce(json_agg(json_build_object('original', e.original, 'name', e.name)), '[]')
      from public.borg_ai_examples e
      where e.enabled
    )
  );
$$;

revoke all on function public.get_borg_studio(integer) from public, anon;
revoke all on function public.save_borg_prompt(text, text, numeric, integer) from public, anon;
revoke all on function public.set_live_borg_prompt(bigint) from public, anon;
revoke all on function public.add_borg_example(text, text) from public, anon;
revoke all on function public.set_borg_example_enabled(bigint, boolean) from public, anon;
revoke all on function public.rate_borg_name(bigint, bigint, text, text, text, text, text, text) from public, anon;
grant execute on function public.get_borg_studio(integer) to authenticated;
grant execute on function public.save_borg_prompt(text, text, numeric, integer) to authenticated;
grant execute on function public.set_live_borg_prompt(bigint) to authenticated;
grant execute on function public.add_borg_example(text, text) to authenticated;
grant execute on function public.set_borg_example_enabled(bigint, boolean) to authenticated;
grant execute on function public.rate_borg_name(bigint, bigint, text, text, text, text, text, text) to authenticated;

revoke all on function public.get_borg_ai_prompt(bigint) from public, anon, authenticated;
grant execute on function public.get_borg_ai_prompt(bigint) to service_role;
