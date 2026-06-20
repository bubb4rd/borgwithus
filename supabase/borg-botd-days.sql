-- Per-day BORG of the day stats (shared across browsers).
-- Run after borg-data.sql.

create table if not exists public.borg_botd_days (
  day_key text primary key,
  name text not null,
  like_count integer not null default 0 check (like_count >= 0),
  rating_total numeric not null default 0 check (rating_total >= 0),
  rating_count integer not null default 0 check (rating_count >= 0)
);

alter table public.borg_botd_days enable row level security;

drop policy if exists "Anyone can read borg botd days" on public.borg_botd_days;
create policy "Anyone can read borg botd days"
  on public.borg_botd_days for select
  using (true);

drop policy if exists "Authenticated users can insert borg botd days" on public.borg_botd_days;
create policy "Authenticated users can insert borg botd days"
  on public.borg_botd_days for insert
  with check (auth.role() = 'authenticated');

drop policy if exists "Authenticated users can update borg botd days" on public.borg_botd_days;
create policy "Authenticated users can update borg botd days"
  on public.borg_botd_days for update
  using (auth.role() = 'authenticated');
