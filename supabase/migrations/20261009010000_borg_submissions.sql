-- Member-submitted borg names, reviewed by an admin before they reach the wall.
--   borg_submissions  one row per submitted name, unique by its letters and digits ("Ron Borgundy"
--                     and "ron-borgundy!" collide) across every status. Members get three a day
--                     (UTC); removing one gives that day's slot back.
--   borg_admins       members who can approve or reject submissions. Add rows by hand in the
--                     SQL editor; nothing in the site can grant admin.
-- No policies or grants on either table: everything goes through the functions below, so full
-- member ids only ever reach admins.

create table if not exists public.borg_submissions (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users on delete cascade,
  name text not null check (
    char_length(name) between 3 and 60
    and name = btrim(name)
    -- "borg" has to be fused into a word (LeBorg, Heisenborg), not just mentioned.
    and name ~* '\w+borg|borg\w+'
  ),
  author text check (char_length(author) <= 40),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users on delete set null,
  check ((status = 'pending') = (reviewed_at is null))
);

create unique index if not exists borg_submissions_name_key
  on public.borg_submissions ((btrim(regexp_replace(lower(name), '[^a-z0-9]+', ' ', 'g'))));

create index if not exists borg_submissions_wall_idx
  on public.borg_submissions (reviewed_at desc, id desc)
  where status = 'approved';

create index if not exists borg_submissions_queue_idx
  on public.borg_submissions (created_at, id)
  where status = 'pending';

create index if not exists borg_submissions_user_day_idx
  on public.borg_submissions (user_id, created_at);

create table if not exists public.borg_admins (
  user_id uuid primary key references auth.users on delete cascade,
  added_at timestamptz not null default now()
);

alter table public.borg_submissions enable row level security;
alter table public.borg_admins enable row level security;

create or replace function public.borg_daily_submissions()
returns integer
language sql
immutable
as $$
  select 3;
$$;

create or replace function public.is_borg_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.borg_admins a where a.user_id = auth.uid());
$$;

create or replace function public.borg_submissions_used_today(p_user_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from public.borg_submissions s
  where s.user_id = p_user_id
    and s.created_at >= date_trunc('day', now() at time zone 'utc') at time zone 'utc';
$$;

create or replace function public.get_borg_submission_quota()
returns json
language sql
stable
security definer
set search_path = ''
as $$
  select json_build_object(
    'limit', public.borg_daily_submissions(),
    'remaining', greatest(
      public.borg_daily_submissions() - public.borg_submissions_used_today(auth.uid()),
      0
    )
  )
  where auth.uid() is not null;
$$;

-- The caller's own pending and rejected names first, then the 12 most recently approved.
-- `account` is the first 8 characters of the member's id, shown when they have no name set.
-- `at` is when the name reached the wall (approved) or was sent in (everything else).
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

-- Validates and stores a name for the calling member, pending review. Errors carry copy the
-- site shows as is; a duplicate name surfaces as unique_violation (23505).
create or replace function public.submit_borg_name(p_name text)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_name text := btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
  v_author text;
  v_row public.borg_submissions;
begin
  if v_user_id is null then
    raise exception 'Log in to submit a borg.';
  end if;

  if char_length(v_name) < 3 or char_length(v_name) > 60 then
    raise exception 'Names need 3 to 60 characters.';
  end if;

  if v_name !~* '\w+borg|borg\w+' then
    raise exception 'Work "borg" into a word, like LeBorg James or Heisenborg.';
  end if;

  -- One submission at a time per member, so the daily count can't be raced past.
  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));

  if public.borg_submissions_used_today(v_user_id) >= public.borg_daily_submissions() then
    raise exception 'That''s your three for today. More at midnight UTC.';
  end if;

  select left(nullif(btrim(u.raw_user_meta_data ->> 'name'), ''), 40)
  into v_author
  from auth.users u
  where u.id = v_user_id;

  insert into public.borg_submissions (user_id, name, author)
  values (v_user_id, v_name, v_author)
  returning * into v_row;

  return json_build_object(
    'id', v_row.id,
    'name', v_row.name,
    'author', v_row.author,
    'account', left(v_user_id::text, 8),
    'status', v_row.status,
    'at', v_row.created_at,
    'mine', true,
    'remaining', public.borg_daily_submissions() - public.borg_submissions_used_today(v_user_id)
  );
end;
$$;

-- Deletes one of the caller's own submissions, whatever its status. Returns submissions left today.
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

  delete from public.borg_submissions
  where id = p_id
    and user_id = v_user_id;

  return greatest(
    public.borg_daily_submissions() - public.borg_submissions_used_today(v_user_id),
    0
  );
end;
$$;

-- Admins only: pending names, oldest first, with the full member id.
create or replace function public.get_borg_review_queue()
returns table (id bigint, name text, author text, user_id uuid, created_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_borg_admin() then
    raise exception 'Admins only.';
  end if;

  return query
  select s.id, s.name, s.author, s.user_id, s.created_at
  from public.borg_submissions s
  where s.status = 'pending'
  order by s.created_at, s.id;
end;
$$;

-- Admins only: approves or rejects a pending name. Returns the new status, or null when the
-- name is gone or another admin already reviewed it.
create or replace function public.review_borg_submission(p_id bigint, p_approve boolean)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
begin
  if not public.is_borg_admin() then
    raise exception 'Admins only.';
  end if;

  update public.borg_submissions
  set status = case when p_approve then 'approved' else 'rejected' end,
      reviewed_at = now(),
      reviewed_by = auth.uid()
  where id = p_id
    and status = 'pending'
  returning status into v_status;

  return v_status;
end;
$$;

revoke all on function public.borg_submissions_used_today(uuid) from public, anon, authenticated;

revoke all on function public.get_borg_wall() from public;
grant execute on function public.get_borg_wall() to anon, authenticated;

revoke all on function public.is_borg_admin() from public, anon;
revoke all on function public.get_borg_submission_quota() from public, anon;
revoke all on function public.submit_borg_name(text) from public, anon;
revoke all on function public.remove_borg_submission(bigint) from public, anon;
revoke all on function public.get_borg_review_queue() from public, anon;
revoke all on function public.review_borg_submission(bigint, boolean) from public, anon;
grant execute on function public.is_borg_admin() to authenticated;
grant execute on function public.get_borg_submission_quota() to authenticated;
grant execute on function public.submit_borg_name(text) to authenticated;
grant execute on function public.remove_borg_submission(bigint) to authenticated;
grant execute on function public.get_borg_review_queue() to authenticated;
grant execute on function public.review_borg_submission(bigint, boolean) to authenticated;
