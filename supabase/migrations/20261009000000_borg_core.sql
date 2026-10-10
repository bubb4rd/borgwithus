-- BORG core schema.
--   borg_likes        one row per (user, name); the source of truth for likes.
--   borg_like_counts  per-name totals kept in step with borg_likes by trigger; the leaderboard reads this.
--   ai_credit_usage   BORG AI generations per user per UTC day. Only the generate-borg-name edge
--                     function (service role) can spend or refund credits.

-- ---------- likes ----------

create table if not exists public.borg_likes (
  user_id uuid not null references auth.users on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  created_at timestamptz not null default now(),
  primary key (user_id, name)
);

create table if not exists public.borg_like_counts (
  name text primary key,
  likes integer not null check (likes > 0)
);

create index if not exists borg_like_counts_rank_idx
  on public.borg_like_counts (likes desc, name);

alter table public.borg_likes enable row level security;
alter table public.borg_like_counts enable row level security;

drop policy if exists "Users read own likes" on public.borg_likes;
create policy "Users read own likes"
  on public.borg_likes for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users add own likes" on public.borg_likes;
create policy "Users add own likes"
  on public.borg_likes for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users remove own likes" on public.borg_likes;
create policy "Users remove own likes"
  on public.borg_likes for delete to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Anyone reads like counts" on public.borg_like_counts;
create policy "Anyone reads like counts"
  on public.borg_like_counts for select to anon, authenticated
  using (true);

grant select, insert, delete on public.borg_likes to authenticated;
grant select on public.borg_like_counts to anon, authenticated;

create or replace function public.sync_borg_like_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.borg_like_counts as c (name, likes)
    values (new.name, 1)
    on conflict (name) do update set likes = c.likes + 1;
    return new;
  end if;

  delete from public.borg_like_counts where name = old.name and likes = 1;
  update public.borg_like_counts set likes = likes - 1 where name = old.name;
  return old;
end;
$$;

revoke all on function public.sync_borg_like_count() from public, anon, authenticated;

drop trigger if exists borg_likes_sync_count on public.borg_likes;
create trigger borg_likes_sync_count
  after insert or delete on public.borg_likes
  for each row execute function public.sync_borg_like_count();

-- Carry likes over from the previous schema when it exists. The trigger rebuilds the counts.
do $$
begin
  if to_regclass('public.user_saved_likes') is not null then
    insert into public.borg_likes (user_id, name, created_at)
    select user_id, btrim(name), min(liked_at)
    from public.user_saved_likes
    where char_length(btrim(name)) between 1 and 80
    group by user_id, btrim(name)
    on conflict do nothing;
  end if;
end;
$$;

-- ---------- BORG AI credits ----------

create table if not exists public.ai_credit_usage (
  user_id uuid not null references auth.users on delete cascade,
  day date not null,
  used integer not null check (used >= 0),
  primary key (user_id, day)
);

-- No policies: only the security-definer functions below touch this table.
alter table public.ai_credit_usage enable row level security;

create or replace function public.ai_daily_credits()
returns integer
language sql
immutable
as $$
  select 5;
$$;

create or replace function public.get_ai_credits()
returns json
language sql
stable
security definer
set search_path = ''
as $$
  select json_build_object(
    'limit', public.ai_daily_credits(),
    'remaining', greatest(
      public.ai_daily_credits() - coalesce(
        (
          select u.used
          from public.ai_credit_usage u
          where u.user_id = auth.uid()
            and u.day = (now() at time zone 'utc')::date
        ),
        0
      ),
      0
    )
  )
  where auth.uid() is not null;
$$;

-- Spends one credit atomically. Returns credits left after spending, or null when none were left.
create or replace function public.consume_ai_credit(p_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_used integer;
begin
  insert into public.ai_credit_usage as u (user_id, day, used)
  values (p_user_id, (now() at time zone 'utc')::date, 1)
  on conflict (user_id, day) do update
    set used = u.used + 1
    where u.used < public.ai_daily_credits()
  returning u.used into v_used;

  if v_used is null then
    return null;
  end if;

  return public.ai_daily_credits() - v_used;
end;
$$;

-- Gives back a credit spent on a failed generation. Returns credits left.
create or replace function public.refund_ai_credit(p_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_used integer;
begin
  update public.ai_credit_usage
  set used = used - 1
  where user_id = p_user_id
    and day = (now() at time zone 'utc')::date
    and used > 0
  returning used into v_used;

  return public.ai_daily_credits() - coalesce(v_used, 0);
end;
$$;

revoke all on function public.get_ai_credits() from public, anon;
grant execute on function public.get_ai_credits() to authenticated;

revoke all on function public.consume_ai_credit(uuid) from public, anon, authenticated;
revoke all on function public.refund_ai_credit(uuid) from public, anon, authenticated;
grant execute on function public.consume_ai_credit(uuid) to service_role;
grant execute on function public.refund_ai_credit(uuid) to service_role;
