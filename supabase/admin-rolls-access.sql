-- Run after borg-data.sql so admins can see all generator rolls on the dashboard.

drop policy if exists "Admins can read all rolls" on public.user_rolls;

create policy "Admins can read all rolls"
  on public.user_rolls for select
  using (public.current_user_is_admin());

create or replace function public.admin_list_rolls()
returns table (
  id uuid,
  name text,
  roll_type text,
  rolled_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select r.id, r.name, r.roll_type, r.rolled_at
  from public.user_rolls r
  where public.current_user_is_admin()
  order by r.rolled_at desc;
$$;

revoke all on function public.admin_list_rolls() from public;
grant execute on function public.admin_list_rolls() to authenticated;
