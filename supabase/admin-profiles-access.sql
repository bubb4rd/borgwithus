-- Run in the Supabase SQL editor if the admin dashboard only shows 1 profile.
-- Grants admin profile reads via is_admin OR the owner email allowlist.

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

create or replace function public.admin_list_profiles()
returns table (id uuid, member_since timestamptz)
language sql
security definer
set search_path = public
stable
as $$
  select p.id, p.member_since
  from public.profiles p
  where public.current_user_is_admin()
  order by p.member_since desc;
$$;

revoke all on function public.admin_list_profiles() from public;
grant execute on function public.admin_list_profiles() to authenticated;

update public.profiles
set is_admin = true
where id in (
  select id
  from auth.users
  where lower(email) in ('bohubbard8@gmail.com', 'bohubbard8@gmal.com')
);
