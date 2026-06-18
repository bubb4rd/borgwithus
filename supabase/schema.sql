-- Run in the Supabase SQL editor after creating a project.
-- Enables email/password auth with per-user profile rows.

create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  name text not null,
  member_since timestamptz not null default now(),
  is_admin boolean not null default false,
  settings jsonb not null default '{"emailNotifications": false, "aiTone": "funny"}'::jsonb
);

alter table public.profiles enable row level security;

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

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Admins can view all profiles"
  on public.profiles for select
  using (public.current_user_is_admin());

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and is_admin is not distinct from public.current_user_is_admin()
  );

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, member_since)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    now()
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

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
