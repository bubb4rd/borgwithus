-- The generator A/B test starts when an admin says so (…_borg_generator_ab_readout.sql).
--   borg_generator_ab_starts  one row each time an admin starts (or restarts) the count; the latest
--                             is the test's start. Pre-launch testing logged on the same UTC day
--                             falls before it, so it stays out without deleting anything.
--   start_generator_ab()      admins only: starts the count now, returns the start time
--   get_generator_ab()        without p_from, counts from that exact start (falling back to the
--                             first real view's day); also returns `started_at`

create table if not exists public.borg_generator_ab_starts (
  id bigint generated always as identity primary key,
  started_at timestamptz not null default now(),
  started_by uuid references auth.users on delete set null default auth.uid()
);

-- No policies: written through start_generator_ab(), read through get_generator_ab().
alter table public.borg_generator_ab_starts enable row level security;
revoke all on public.borg_generator_ab_starts from anon, authenticated;

create or replace function public.start_generator_ab()
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_started timestamptz;
begin
  if not public.is_borg_admin() then
    raise exception 'Admins only.';
  end if;

  insert into public.borg_generator_ab_starts default values returning started_at into v_started;
  return v_started;
end;
$$;

-- Both groups from p_from (a UTC day) or, without it, from the test's start (the latest
-- start_generator_ab(), else the first real view's day), to the end of UTC day p_to (default
-- today). A group's visitors are the distinct non-admin visitor ids that logged a view in the
-- range; every other count is limited to them.
-- { from, to, days, started_at, first_view, variants: { classic: {...}, jug: {...} } }, each group:
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
  v_started timestamptz;
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

  select max(s.started_at) into v_started from public.borg_generator_ab_starts s;

  select min((e.created_at at time zone 'utc')::date) into v_first
  from public.borg_generator_events e
  where e.event = 'view'
    and e.visitor not in (select x.visitor from public.borg_ab_admin_visitors() x);

  if p_from is not null then
    v_from := p_from;
    v_start := p_from::timestamp at time zone 'utc';
  elsif v_started is not null then
    v_from := (v_started at time zone 'utc')::date;
    v_start := v_started;
  else
    v_from := coalesce(v_first, v_today);
    v_start := v_from::timestamp at time zone 'utc';
  end if;
  v_to := greatest(coalesce(p_to, v_today), v_from);
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
    'started_at', v_started,
    'first_view', v_first,
    'variants', v_variants
  );
end;
$$;

revoke all on function public.start_generator_ab() from public, anon;
grant execute on function public.start_generator_ab() to authenticated;
