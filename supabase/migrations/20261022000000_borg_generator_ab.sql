-- Generator A/B test on the home page (src/lib/generatorExperiment.js). Each browser gets a random
-- visitor id and is put in one group for good: "classic" (the BORG/MIO card next to the BORG AI
-- card) or "jug" (the full-width jug configurator).
--   borg_rolls              rolls now carry the group and visitor id when the browser sent them;
--                           older rows and other callers leave both null
--   borg_generator_events   'view' (at most one per visitor, group and UTC day), 'save' and 'share'
--                           of the jug image; written only through log_generator_event()
-- get_generator_ab() is the only reader, for admins only.

-- ---------- rolls ----------

alter table public.borg_rolls
  add column if not exists variant text check (variant in ('classic', 'jug')),
  add column if not exists visitor text check (char_length(visitor) <= 64);

create index if not exists borg_rolls_ab_idx on public.borg_rolls (variant, visitor, rolled_at)
  where variant is not null;

-- Same rules as before (a BORG roll must be a name on the board, a MIO roll one of the flavours in
-- src/data.json, 60 logged rolls a minute per member or guest IP); it now also stores the A/B group
-- (null unless 'classic' or 'jug') and the visitor id (trimmed to 64 characters, null if empty).
drop function if exists public.log_borg_roll(text, text);

create or replace function public.log_borg_roll(
  p_kind text,
  p_name text,
  p_variant text default null,
  p_visitor text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := left(btrim(coalesce(p_name, '')), 80);
  v_variant text := case when p_variant in ('classic', 'jug') then p_variant end;
  v_visitor text := nullif(left(btrim(coalesce(p_visitor, '')), 64), '');
  v_headers json := nullif(current_setting('request.headers', true), '')::json;
  v_caller text;
  v_rolls integer;
begin
  if p_kind = 'borg' then
    if not exists (
      select 1 from public.borgs b
      where public.borg_name_key(b.name) = public.borg_name_key(v_name) and b.name = v_name
    ) then
      return;
    end if;
  elsif p_kind = 'mio' then
    if v_name not in (
      'Lemonade', 'Fruit Punch', 'Strawberry Watermelon', 'Berry Grape', 'Black Cherry',
      'Green Thunder', 'Lemon Lime'
    ) then
      return;
    end if;
  else
    return;
  end if;

  v_caller := coalesce(
    'member:' || auth.uid()::text,
    'ip:' || nullif(btrim(split_part(coalesce(
      v_headers ->> 'cf-connecting-ip',
      v_headers ->> 'x-real-ip',
      v_headers ->> 'x-forwarded-for',
      ''
    ), ',', 1)), ''),
    'guest'
  );

  insert into public.borg_roll_throttle as t (caller, window_start, rolls)
  values (v_caller, date_trunc('minute', now()), 1)
  on conflict (caller) do update
    set rolls = case when t.window_start = excluded.window_start then t.rolls + 1 else 1 end,
        window_start = excluded.window_start
  returning rolls into v_rolls;

  if v_rolls > 60 then
    return;
  end if;

  insert into public.borg_rolls (user_id, kind, name, variant, visitor)
  values (auth.uid(), p_kind, v_name, v_variant, v_visitor);

  -- Callers who stopped rolling an hour ago don't need a row.
  if random() < 0.01 then
    delete from public.borg_roll_throttle where window_start < now() - interval '1 hour';
  end if;
end;
$$;

-- ---------- generator events ----------

create table if not exists public.borg_generator_events (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  user_id uuid references auth.users on delete set null default auth.uid(),
  visitor text not null check (char_length(visitor) between 1 and 64),
  variant text not null check (variant in ('classic', 'jug')),
  event text not null check (event in ('view', 'save', 'share'))
);

create index if not exists borg_generator_events_recent_idx
  on public.borg_generator_events (variant, event, created_at);

-- One view per visitor, group and UTC day: views are only ever counted as distinct visitors.
create unique index if not exists borg_generator_events_one_view_a_day
  on public.borg_generator_events (visitor, variant, ((created_at at time zone 'utc')::date))
  where event = 'view';

-- No policies: written through log_generator_event(), read through get_generator_ab().
alter table public.borg_generator_events enable row level security;
revoke all on public.borg_generator_events from anon, authenticated;

-- Records a generator view, save or share for whoever is calling (guests included). Bad input is
-- dropped quietly, a second view from the same visitor and group on one UTC day is ignored, and
-- past 30 events in a minute from one member (or, for guests, one IP) the rest aren't logged. The
-- caller is worked out like log_borg_roll()'s and shares its throttle table under an 'event:' key.
create or replace function public.log_generator_event(p_event text, p_variant text, p_visitor text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_visitor text := left(btrim(coalesce(p_visitor, '')), 64);
  v_headers json := nullif(current_setting('request.headers', true), '')::json;
  v_caller text;
  v_events integer;
begin
  if coalesce(p_event, '') not in ('view', 'save', 'share')
    or coalesce(p_variant, '') not in ('classic', 'jug')
    or v_visitor = '' then
    return;
  end if;

  v_caller := 'event:' || coalesce(
    'member:' || auth.uid()::text,
    'ip:' || nullif(btrim(split_part(coalesce(
      v_headers ->> 'cf-connecting-ip',
      v_headers ->> 'x-real-ip',
      v_headers ->> 'x-forwarded-for',
      ''
    ), ',', 1)), ''),
    'guest'
  );

  insert into public.borg_roll_throttle as t (caller, window_start, rolls)
  values (v_caller, date_trunc('minute', now()), 1)
  on conflict (caller) do update
    set rolls = case when t.window_start = excluded.window_start then t.rolls + 1 else 1 end,
        window_start = excluded.window_start
  returning rolls into v_events;

  if v_events > 30 then
    return;
  end if;

  insert into public.borg_generator_events (visitor, variant, event)
  values (v_visitor, p_variant, p_event)
  on conflict do nothing;
end;
$$;

-- ---------- admin readout ----------

-- Both groups over the last p_days UTC days, today included. A group's visitors are the distinct
-- visitor ids that logged a view; only their rolls (any kind, BORG AI included) count, so the
-- ratios share one base. Savers and sharers are distinct visitors.
-- { days, since, variants: { classic: {...}, jug: {...} } }, each group:
-- { visitors, rollers, roll_rate, rolls: { borg, mio, ai }, rolls_per_visitor, savers, sharers }
-- (roll_rate and rolls_per_visitor null without visitors).
create or replace function public.get_generator_ab(p_days integer default 14)
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_days integer := least(greatest(coalesce(p_days, 14), 1), 90);
  v_since date := (now() at time zone 'utc')::date - (v_days - 1);
  v_from timestamptz := v_since::timestamp at time zone 'utc';
  v_variants json;
begin
  if not public.is_borg_admin() then
    raise exception 'Admins only.';
  end if;

  with arms (variant) as (
    values ('classic'::text), ('jug'::text)
  ),
  viewers as (
    select distinct e.variant, e.visitor
    from public.borg_generator_events e
    where e.event = 'view' and e.created_at >= v_from
  ),
  rolls as (
    select r.variant, r.visitor, r.kind
    from public.borg_rolls r
    join viewers v on v.variant = r.variant and v.visitor = r.visitor
    where r.rolled_at >= v_from
  ),
  events as (
    select e.variant,
      count(distinct e.visitor) filter (where e.event = 'save') as savers,
      count(distinct e.visitor) filter (where e.event = 'share') as sharers
    from public.borg_generator_events e
    where e.event in ('save', 'share') and e.created_at >= v_from
    group by e.variant
  ),
  stats as (
    select g.variant,
      (select count(*) from viewers v where v.variant = g.variant) as visitors,
      (select count(distinct r.visitor) from rolls r where r.variant = g.variant) as rollers,
      (select count(*) from rolls r where r.variant = g.variant and r.kind = 'borg') as borg,
      (select count(*) from rolls r where r.variant = g.variant and r.kind = 'mio') as mio,
      (select count(*) from rolls r where r.variant = g.variant and r.kind = 'ai') as ai,
      coalesce(ev.savers, 0) as savers,
      coalesce(ev.sharers, 0) as sharers
    from arms g
    left join events ev on ev.variant = g.variant
  )
  select json_object_agg(
    s.variant,
    json_build_object(
      'visitors', s.visitors,
      'rollers', s.rollers,
      'roll_rate', case when s.visitors > 0 then round(s.rollers::numeric / s.visitors, 4) end,
      'rolls', json_build_object('borg', s.borg, 'mio', s.mio, 'ai', s.ai),
      'rolls_per_visitor',
        case when s.visitors > 0 then round((s.borg + s.mio + s.ai)::numeric / s.visitors, 2) end,
      'savers', s.savers,
      'sharers', s.sharers
    )
  )
  into v_variants
  from stats s;

  return json_build_object('days', v_days, 'since', v_since, 'variants', v_variants);
end;
$$;

-- ---------- grants ----------

revoke all on function public.log_borg_roll(text, text, text, text) from public;
grant execute on function public.log_borg_roll(text, text, text, text) to anon, authenticated;

revoke all on function public.log_generator_event(text, text, text) from public;
grant execute on function public.log_generator_event(text, text, text) to anon, authenticated;

revoke all on function public.get_generator_ab(integer) from public, anon;
grant execute on function public.get_generator_ab(integer) to authenticated;
