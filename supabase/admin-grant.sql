-- Run after schema.sql on an existing project.
-- Adds admin role support and grants admin to the site owner account.

alter table public.profiles
  add column if not exists is_admin boolean not null default false;

create or replace function public.current_user_is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (select is_admin from public.profiles where id = auth.uid()),
    false
  )
  or coalesce(
    lower((select email from auth.users where id = auth.uid())),
    ''
  ) in ('bohubbard8@gmail.com', 'bohubbard8@gmal.com');
$$;

drop policy if exists "Admins can view all profiles" on public.profiles;

create policy "Admins can view all profiles"
  on public.profiles for select
  using (public.current_user_is_admin());

drop policy if exists "Users can update own profile" on public.profiles;

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and is_admin is not distinct from public.current_user_is_admin()
  );

-- Grant admin to bohubbard8@gmail.com (and common typo variant).
update public.profiles
set is_admin = true
where id in (
  select id
  from auth.users
  where lower(email) in ('bohubbard8@gmail.com', 'bohubbard8@gmal.com')
);
