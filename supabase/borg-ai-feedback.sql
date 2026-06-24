-- Run in the Supabase SQL editor after schema.sql. Safe to re-run (idempotent).
-- Stores BORG AI like/dislike feedback and exposes a community bad list for prompts.

create table if not exists public.borg_ai_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  name text not null,
  prompt text not null default '',
  feedback text not null check (feedback in ('like', 'dislike')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name, prompt)
);

create index if not exists borg_ai_feedback_user_id_idx
  on public.borg_ai_feedback (user_id, updated_at desc);

create index if not exists borg_ai_feedback_dislikes_idx
  on public.borg_ai_feedback (feedback, name)
  where feedback = 'dislike';

alter table public.borg_ai_feedback enable row level security;

drop policy if exists "Users can read own AI feedback" on public.borg_ai_feedback;
drop policy if exists "Users can insert own AI feedback" on public.borg_ai_feedback;
drop policy if exists "Users can update own AI feedback" on public.borg_ai_feedback;
drop policy if exists "Admins can read all AI feedback" on public.borg_ai_feedback;

create policy "Users can read own AI feedback"
  on public.borg_ai_feedback
  for select
  using (auth.uid() = user_id);

create policy "Users can insert own AI feedback"
  on public.borg_ai_feedback
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update own AI feedback"
  on public.borg_ai_feedback
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Admins can read all AI feedback"
  on public.borg_ai_feedback
  for select
  using (public.current_user_is_admin());

create or replace function public.get_borg_ai_bad_names(p_limit integer default 40)
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  names text[] := '{}';
  words text[] := '{}';
begin
  select coalesce(array_agg(name order by dislike_count desc, name), '{}')
  into names
  from (
    select name, count(*) as dislike_count
    from public.borg_ai_feedback
    where feedback = 'dislike'
    group by name
    order by dislike_count desc, name
    limit greatest(p_limit, 0)
  ) disliked;

  select coalesce(array_agg(distinct token order by token), '{}')
  into words
  from (
    select lower(token) as token
    from public.borg_ai_feedback,
    lateral regexp_split_to_table(name, '\s+') as token
    where feedback = 'dislike'
      and length(lower(token)) >= 3
      and lower(token) not in ('the', 'and', 'for', 'not', 'bor', 'borg')
  ) extracted;

  return jsonb_build_object('names', names, 'words', words);
end;
$$;

revoke all on function public.get_borg_ai_bad_names(integer) from public;
grant execute on function public.get_borg_ai_bad_names(integer) to authenticated;

create or replace function public.admin_list_ai_feedback()
returns table (
  id uuid,
  user_id uuid,
  user_name text,
  name text,
  prompt text,
  feedback text,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
security definer
stable
set search_path = public
as $$
  select
    f.id,
    f.user_id,
    coalesce(
      p.name,
      nullif(split_part(u.email, '@', 1), ''),
      'User'
    ) as user_name,
    f.name,
    f.prompt,
    f.feedback,
    f.created_at,
    f.updated_at
  from public.borg_ai_feedback f
  left join public.profiles p on p.id = f.user_id
  left join auth.users u on u.id = f.user_id
  where public.current_user_is_admin()
  order by f.updated_at desc
  limit 500;
$$;

revoke all on function public.admin_list_ai_feedback() from public;
grant execute on function public.admin_list_ai_feedback() to authenticated;

-- All AI generator rolls for the admin lab, with optional like/dislike feedback.
create or replace function public.admin_list_ai_generations()
returns table (
  id uuid,
  user_id uuid,
  user_name text,
  name text,
  prompt text,
  feedback text,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
security definer
stable
set search_path = public
as $$
  select
    r.id,
    r.user_id,
    coalesce(
      p.name,
      nullif(split_part(u.email, '@', 1), ''),
      'User'
    ) as user_name,
    r.name,
    coalesce(f.prompt, '') as prompt,
    f.feedback,
    coalesce(f.created_at, r.rolled_at) as created_at,
    coalesce(f.updated_at, r.rolled_at) as updated_at
  from public.user_rolls r
  left join public.profiles p on p.id = r.user_id
  left join auth.users u on u.id = r.user_id
  left join lateral (
    select
      f2.prompt,
      f2.feedback,
      f2.created_at,
      f2.updated_at
    from public.borg_ai_feedback f2
    where f2.user_id = r.user_id
      and lower(f2.name) = lower(r.name)
    order by f2.updated_at desc
    limit 1
  ) f on true
  where public.current_user_is_admin()
    and r.roll_type = 'ai'
  order by r.rolled_at desc
  limit 500;
$$;

revoke all on function public.admin_list_ai_generations() from public;
grant execute on function public.admin_list_ai_generations() to authenticated;
