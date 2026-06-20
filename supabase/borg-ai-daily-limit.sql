-- Run in the Supabase SQL editor. Safe to re-run (idempotent).
-- Limits BORG AI to 5 generations per user per UTC day.

create table if not exists public.user_ai_daily_usage (
  user_id uuid not null references auth.users on delete cascade,
  day_key text not null,
  generation_count integer not null default 0 check (generation_count >= 0),
  primary key (user_id, day_key)
);

alter table public.user_ai_daily_usage enable row level security;

drop policy if exists "Users can view own BORG AI usage" on public.user_ai_daily_usage;

create policy "Users can view own BORG AI usage"
  on public.user_ai_daily_usage
  for select
  using (auth.uid() = user_id);

create or replace function public.borg_ai_day_key()
returns text
language sql
stable
as $$
  select to_char((timezone('utc', now())), 'YYYY-MM-DD');
$$;

create or replace function public.get_borg_ai_usage(p_daily_limit integer default 5)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  today text := public.borg_ai_day_key();
  used integer := 0;
begin
  if uid is null then
    return jsonb_build_object(
      'allowed', false,
      'used', 0,
      'limit', p_daily_limit,
      'remaining', 0,
      'error', 'Unauthorized'
    );
  end if;

  select generation_count
  into used
  from public.user_ai_daily_usage
  where user_id = uid
    and day_key = today;

  used := coalesce(used, 0);

  return jsonb_build_object(
    'allowed', used < p_daily_limit,
    'used', used,
    'limit', p_daily_limit,
    'remaining', greatest(p_daily_limit - used, 0)
  );
end;
$$;

create or replace function public.consume_borg_ai_generation(p_daily_limit integer default 5)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  today text := public.borg_ai_day_key();
  used integer := 0;
begin
  if uid is null then
    return jsonb_build_object(
      'allowed', false,
      'used', 0,
      'limit', p_daily_limit,
      'remaining', 0,
      'error', 'Unauthorized'
    );
  end if;

  insert into public.user_ai_daily_usage (user_id, day_key, generation_count)
  values (uid, today, 0)
  on conflict (user_id, day_key) do nothing;

  select generation_count
  into used
  from public.user_ai_daily_usage
  where user_id = uid
    and day_key = today
  for update;

  used := coalesce(used, 0);

  if used >= p_daily_limit then
    return jsonb_build_object(
      'allowed', false,
      'used', used,
      'limit', p_daily_limit,
      'remaining', 0,
      'error', 'Daily BORG AI limit reached.'
    );
  end if;

  update public.user_ai_daily_usage
  set generation_count = generation_count + 1
  where user_id = uid
    and day_key = today
  returning generation_count into used;

  return jsonb_build_object(
    'allowed', true,
    'used', used,
    'limit', p_daily_limit,
    'remaining', greatest(p_daily_limit - used, 0)
  );
end;
$$;

create or replace function public.refund_borg_ai_generation(p_daily_limit integer default 5)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  today text := public.borg_ai_day_key();
  used integer := 0;
begin
  if uid is null then
    return jsonb_build_object(
      'allowed', false,
      'used', 0,
      'limit', p_daily_limit,
      'remaining', 0,
      'error', 'Unauthorized'
    );
  end if;

  update public.user_ai_daily_usage
  set generation_count = greatest(generation_count - 1, 0)
  where user_id = uid
    and day_key = today
  returning generation_count into used;

  used := coalesce(used, 0);

  return jsonb_build_object(
    'allowed', used < p_daily_limit,
    'used', used,
    'limit', p_daily_limit,
    'remaining', greatest(p_daily_limit - used, 0)
  );
end;
$$;

revoke all on function public.get_borg_ai_usage(integer) from public;
revoke all on function public.consume_borg_ai_generation(integer) from public;
revoke all on function public.refund_borg_ai_generation(integer) from public;
grant execute on function public.get_borg_ai_usage(integer) to authenticated;
grant execute on function public.consume_borg_ai_generation(integer) to authenticated;
grant execute on function public.refund_borg_ai_generation(integer) to authenticated;
