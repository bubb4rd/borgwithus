-- Abuse guards (docs/audit-2026-10-11.md H1, H2, H3, M1, M2, L4).
--   likes / AI dislikes  members can only react to names the site showed them: names on the board,
--                        their own BORG AI rolls, and (likes) names already on the leaderboard
--   ai_generations       one row per BORG AI request: one in flight per member, at most
--                        ai_daily_refunds() failed requests refunded per day, refunds land on the
--                        day the credit was spent, and requests that never finish (the function
--                        was killed) are settled by the next credit read or request
--   borg_submissions     removing a rejected name hides it instead of deleting it, so it keeps
--                        holding its name and can't be sent in again
--   log_borg_roll()      classic rolls must be a name on the board or a known Mio flavour, and
--                        each caller (member, else IP) is held to 60 logged rolls a minute

-- ---------- likes and AI dislikes ----------

create index if not exists borg_rolls_member_ai_idx on public.borg_rolls (user_id, name) where kind = 'ai';

-- Whether the calling member may like (p_liked_ok) or 👎 a name: it's on the board, it's one of
-- their own BORG AI rolls, or (likes only) it already has likes, which is how the leaderboard
-- offers it.
create or replace function public.borg_can_react(p_name text, p_liked_ok boolean)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
      select 1 from public.borgs b
      where public.borg_name_key(b.name) = public.borg_name_key(p_name)
        and b.name = p_name
    )
    or exists (
      select 1 from public.borg_rolls r
      where r.user_id = auth.uid()
        and r.kind = 'ai'
        and r.name = p_name
    )
    or (p_liked_ok and exists (select 1 from public.borg_like_counts c where c.name = p_name));
$$;

drop policy if exists "Users add own likes" on public.borg_likes;
create policy "Users add own likes"
  on public.borg_likes for insert to authenticated
  with check ((select auth.uid()) = user_id and public.borg_can_react(name, true));

drop policy if exists "Users add own AI dislikes" on public.borg_ai_dislikes;
create policy "Users add own AI dislikes"
  on public.borg_ai_dislikes for insert to authenticated
  with check ((select auth.uid()) = user_id and public.borg_can_react(name, false));

-- ---------- BORG AI credits ----------

create or replace function public.ai_daily_refunds()
returns integer
language sql
immutable
as $$
  select 3;
$$;

create table if not exists public.ai_generations (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users on delete cascade,
  day date not null,
  started_at timestamptz not null default now(),
  outcome text not null default 'pending' check (outcome in ('pending', 'named', 'refunded', 'charged')),
  finished_at timestamptz,
  check ((outcome = 'pending') = (finished_at is null))
);

create index if not exists ai_generations_member_day_idx on public.ai_generations (user_id, day);
create unique index if not exists ai_generations_one_pending on public.ai_generations (user_id)
  where outcome = 'pending';

-- No policies: only the security-definer functions below touch this table.
alter table public.ai_generations enable row level security;
revoke all on public.ai_generations from anon, authenticated;

-- Credits a member has left today.
create or replace function public.ai_credits_left(p_user_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select greatest(
    public.ai_daily_credits() - coalesce(
      (
        select u.used from public.ai_credit_usage u
        where u.user_id = p_user_id and u.day = (now() at time zone 'utc')::date
      ),
      0
    ),
    0
  );
$$;

-- Closes a pending request. A named one keeps its credit. A failed one gets its credit back, on
-- the day it was spent, while that day has had fewer than ai_daily_refunds() refunds; after that it
-- stays spent. Returns the outcome, null when the request wasn't pending. Callers hold the
-- member's lock.
create or replace function public.settle_ai_generation(p_id bigint, p_named boolean)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_gen public.ai_generations;
  v_outcome text;
begin
  select * into v_gen from public.ai_generations where id = p_id and outcome = 'pending' for update;
  if not found then
    return null;
  end if;

  if p_named then
    v_outcome := 'named';
  elsif (
    select count(*) from public.ai_generations g
    where g.user_id = v_gen.user_id and g.day = v_gen.day and g.outcome = 'refunded'
  ) < public.ai_daily_refunds() then
    v_outcome := 'refunded';
    update public.ai_credit_usage
    set used = used - 1
    where user_id = v_gen.user_id and day = v_gen.day and used > 0;
  else
    v_outcome := 'charged';
  end if;

  update public.ai_generations set outcome = v_outcome, finished_at = now() where id = p_id;
  return v_outcome;
end;
$$;

-- Settles the member's requests that never finished. The edge function gives up well before
-- three minutes, so a request still pending after that was killed mid-call.
create or replace function public.reclaim_ai_generations(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id bigint;
begin
  for v_id in
    select g.id from public.ai_generations g
    where g.user_id = p_user_id
      and g.outcome = 'pending'
      and g.started_at < now() - interval '3 minutes'
  loop
    perform public.settle_ai_generation(v_id, false);
  end loop;
end;
$$;

create or replace function public.ai_member_lock(p_user_id uuid)
returns void
language sql
set search_path = ''
as $$
  select pg_advisory_xact_lock(hashtextextended('borg-ai:' || p_user_id::text, 0));
$$;

-- Starts a request for the edge function: { status: 'ok', id, remaining } after spending a
-- credit, { status: 'busy' } while another request of theirs is running, { status: 'out',
-- remaining: 0 } with no credits left.
create or replace function public.start_ai_generation(p_user_id uuid)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_day date := (now() at time zone 'utc')::date;
  v_used integer;
  v_id bigint;
begin
  perform public.ai_member_lock(p_user_id);
  perform public.reclaim_ai_generations(p_user_id);

  if exists (select 1 from public.ai_generations g where g.user_id = p_user_id and g.outcome = 'pending') then
    return json_build_object('status', 'busy');
  end if;

  insert into public.ai_credit_usage as u (user_id, day, used)
  values (p_user_id, v_day, 1)
  on conflict (user_id, day) do update
    set used = u.used + 1
    where u.used < public.ai_daily_credits()
  returning u.used into v_used;

  if v_used is null then
    return json_build_object('status', 'out', 'remaining', 0);
  end if;

  insert into public.ai_generations (user_id, day) values (p_user_id, v_day) returning id into v_id;
  return json_build_object('status', 'ok', 'id', v_id, 'remaining', public.ai_daily_credits() - v_used);
end;
$$;

-- Finishes a request for the edge function: { outcome: 'named' | 'refunded' | 'charged' | null
-- (already settled), remaining }.
create or replace function public.finish_ai_generation(p_id bigint, p_named boolean)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_outcome text;
begin
  select g.user_id into v_user_id from public.ai_generations g where g.id = p_id;
  if v_user_id is null then
    return json_build_object('outcome', null, 'remaining', null);
  end if;

  perform public.ai_member_lock(v_user_id);
  v_outcome := public.settle_ai_generation(p_id, p_named);
  return json_build_object('outcome', v_outcome, 'remaining', public.ai_credits_left(v_user_id));
end;
$$;

-- Same result as before; it now also settles the caller's requests that never finished, so a
-- killed request's credit comes back on the next read.
create or replace function public.get_ai_credits()
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    return null;
  end if;

  if exists (
    select 1 from public.ai_generations g
    where g.user_id = v_user_id and g.outcome = 'pending' and g.started_at < now() - interval '3 minutes'
  ) then
    perform public.ai_member_lock(v_user_id);
    perform public.reclaim_ai_generations(v_user_id);
  end if;

  return json_build_object('limit', public.ai_daily_credits(), 'remaining', public.ai_credits_left(v_user_id));
end;
$$;

drop function if exists public.consume_ai_credit(uuid);
drop function if exists public.refund_ai_credit(uuid);

-- ---------- submissions ----------

alter table public.borg_submissions add column if not exists hidden boolean not null default false;

-- Removes one of the caller's own submissions. Pending and approved names are deleted (an
-- approved one leaves the board with it); a rejected one is only hidden from their wall, so it
-- keeps holding its name. Returns submissions left today.
create or replace function public.remove_borg_submission(p_id bigint)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Log in to remove a borg.';
  end if;

  update public.borg_submissions
  set hidden = true
  where id = p_id
    and user_id = v_user_id
    and status = 'rejected';

  delete from public.borg_submissions
  where id = p_id
    and user_id = v_user_id
    and status <> 'rejected';

  return greatest(
    public.borg_daily_submissions() - public.borg_submissions_used_today(v_user_id),
    0
  );
end;
$$;

-- Same as before, minus the caller's hidden rejected names.
create or replace function public.get_borg_wall()
returns table (
  id bigint,
  name text,
  author text,
  account text,
  status text,
  at timestamptz,
  mine boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select w.id, w.name, w.author, w.account, w.status, w.at, w.mine
  from (
    (
      select s.id, s.name, s.author, left(s.user_id::text, 8) as account, s.status,
        s.created_at as at, true as mine, 0 as grp
      from public.borg_submissions s
      where s.user_id = auth.uid()
        and s.status <> 'approved'
        and not s.hidden
    )
    union all
    (
      select s.id, s.name, s.author, left(s.user_id::text, 8), s.status,
        s.reviewed_at, coalesce(s.user_id = auth.uid(), false), 1
      from public.borg_submissions s
      where s.status = 'approved'
      order by s.reviewed_at desc, s.id desc
      limit 12
    )
  ) w
  order by w.grp, w.at desc, w.id desc;
$$;

-- ---------- roll logging ----------

create table if not exists public.borg_roll_throttle (
  caller text primary key,
  window_start timestamptz not null,
  rolls integer not null
);

alter table public.borg_roll_throttle enable row level security;
revoke all on public.borg_roll_throttle from anon, authenticated;

-- Records one classic roll for whoever is calling (guests included). BORG AI rolls are logged by
-- the edge function. A BORG roll must be a name on the board; a MIO roll one of the flavours in
-- src/data.json (`mio`), listed here too. Past 60 logged rolls in a minute from one member (or,
-- for guests, one IP), further rolls that minute aren't logged.
create or replace function public.log_borg_roll(p_kind text, p_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := left(btrim(coalesce(p_name, '')), 80);
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

  insert into public.borg_rolls (user_id, kind, name) values (auth.uid(), p_kind, v_name);

  -- Callers who stopped rolling an hour ago don't need a row.
  if random() < 0.01 then
    delete from public.borg_roll_throttle where window_start < now() - interval '1 hour';
  end if;
end;
$$;

-- ---------- grants ----------

revoke all on function public.borg_can_react(text, boolean) from public, anon;
grant execute on function public.borg_can_react(text, boolean) to authenticated;

revoke all on function public.ai_credits_left(uuid) from public, anon, authenticated;
revoke all on function public.settle_ai_generation(bigint, boolean) from public, anon, authenticated;
revoke all on function public.reclaim_ai_generations(uuid) from public, anon, authenticated;
revoke all on function public.ai_member_lock(uuid) from public, anon, authenticated;
revoke all on function public.start_ai_generation(uuid) from public, anon, authenticated;
revoke all on function public.finish_ai_generation(bigint, boolean) from public, anon, authenticated;
grant execute on function public.start_ai_generation(uuid) to service_role;
grant execute on function public.finish_ai_generation(bigint, boolean) to service_role;

revoke all on function public.get_ai_credits() from public, anon;
grant execute on function public.get_ai_credits() to authenticated;
