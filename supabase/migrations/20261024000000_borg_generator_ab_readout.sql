-- Generator A/B readout, ready for launch (…_borg_generator_ab.sql).
--   borg_generator_events  also 'signup_click' (a Sign up link in the generator) and 'signup'
--                          (an account made in that browser)
--   get_generator_ab()     reads a fixed date range instead of the last N days: from the first
--                          real view (or p_from) to today (or p_to), so the whole test stays in
--                          view. Admins' browsers are left out: any visitor id that ever logged
--                          an event or roll while signed in as an admin. Adds the main measure,
--                          namers (visitors who named a borg: a BORG or BORG AI roll), and
--                          signup clickers and signups. Saves and shares only count viewers too.
-- QA visits (?gen=classic / ?gen=jug) never log anything (src/lib/generatorExperiment.js).

alter table public.borg_generator_events drop constraint if exists borg_generator_events_event_check;
alter table public.borg_generator_events add constraint borg_generator_events_event_check
  check (event in ('view', 'save', 'share', 'signup_click', 'signup'));

-- Same as before, with the two signup events.
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
  if coalesce(p_event, '') not in ('view', 'save', 'share', 'signup_click', 'signup')
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

drop function if exists public.get_generator_ab(integer);

-- Both groups over UTC days p_from..p_to (defaults: the first real view, and today). A group's
-- visitors are the distinct non-admin visitor ids that logged a view in the range; every other
-- count is limited to them.
-- { from, to, days, first_view, variants: { classic: {...}, jug: {...} } }, each group:
-- { visitors, namers, rollers, rolls: { borg, mio, ai }, savers, sharers, signup_clickers,
--   signups }
create or replace function public.get_generator_ab(p_from date default null, p_to date default null)
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'utc')::date;
  v_first date;
  v_from date;
  v_to date;
  v_start timestamptz;
  v_end timestamptz;
  v_variants json;
begin
  if not public.is_borg_admin() then
    raise exception 'Admins only.';
  end if;

  select min((e.created_at at time zone 'utc')::date) into v_first
  from public.borg_generator_events e
  where e.event = 'view'
    and e.visitor not in (select x.visitor from public.borg_ab_admin_visitors() x);

  v_from := coalesce(p_from, v_first, v_today);
  v_to := greatest(coalesce(p_to, v_today), v_from);
  v_start := v_from::timestamp at time zone 'utc';
  v_end := (v_to + 1)::timestamp at time zone 'utc';

  with arms (variant) as (
    values ('classic'::text), ('jug'::text)
  ),
  viewers as (
    select distinct e.variant, e.visitor
    from public.borg_generator_events e
    where e.event = 'view'
      and e.created_at >= v_start and e.created_at < v_end
      and e.visitor not in (select x.visitor from public.borg_ab_admin_visitors() x)
  ),
  rolls as (
    select r.variant, r.visitor, r.kind
    from public.borg_rolls r
    join viewers v on v.variant = r.variant and v.visitor = r.visitor
    where r.rolled_at >= v_start and r.rolled_at < v_end
  ),
  events as (
    select e.variant, e.visitor, e.event
    from public.borg_generator_events e
    join viewers v on v.variant = e.variant and v.visitor = e.visitor
    where e.event <> 'view' and e.created_at >= v_start and e.created_at < v_end
  ),
  stats as (
    select g.variant,
      (select count(*) from viewers v where v.variant = g.variant) as visitors,
      (select count(distinct r.visitor) from rolls r where r.variant = g.variant and r.kind in ('borg', 'ai')) as namers,
      (select count(distinct r.visitor) from rolls r where r.variant = g.variant) as rollers,
      (select count(*) from rolls r where r.variant = g.variant and r.kind = 'borg') as borg,
      (select count(*) from rolls r where r.variant = g.variant and r.kind = 'mio') as mio,
      (select count(*) from rolls r where r.variant = g.variant and r.kind = 'ai') as ai,
      (select count(distinct e.visitor) from events e where e.variant = g.variant and e.event = 'save') as savers,
      (select count(distinct e.visitor) from events e where e.variant = g.variant and e.event = 'share') as sharers,
      (select count(distinct e.visitor) from events e where e.variant = g.variant and e.event = 'signup_click') as signup_clickers,
      (select count(distinct e.visitor) from events e where e.variant = g.variant and e.event = 'signup') as signups
    from arms g
  )
  select json_object_agg(
    s.variant,
    json_build_object(
      'visitors', s.visitors,
      'namers', s.namers,
      'rollers', s.rollers,
      'rolls', json_build_object('borg', s.borg, 'mio', s.mio, 'ai', s.ai),
      'savers', s.savers,
      'sharers', s.sharers,
      'signup_clickers', s.signup_clickers,
      'signups', s.signups
    )
  )
  into v_variants
  from stats s;

  return json_build_object(
    'from', v_from,
    'to', v_to,
    'days', v_to - v_from + 1,
    'first_view', v_first,
    'variants', v_variants
  );
end;
$$;

-- Visitor ids seen signed in as an admin, in events or rolls: an admin's own browser, testing.
create or replace function public.borg_ab_admin_visitors()
returns table (visitor text)
language sql
stable
security definer
set search_path = ''
as $$
  select e.visitor from public.borg_generator_events e
  join public.borg_admins a on a.user_id = e.user_id
  union
  select r.visitor from public.borg_rolls r
  join public.borg_admins a on a.user_id = r.user_id
  where r.visitor is not null;
$$;

revoke all on function public.borg_ab_admin_visitors() from public, anon, authenticated;

revoke all on function public.get_generator_ab(date, date) from public, anon;
grant execute on function public.get_generator_ab(date, date) to authenticated;
