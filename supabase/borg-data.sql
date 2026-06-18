-- Borg stats and per-user activity tables.
-- Run after schema.sql when you're ready to move off localStorage.

create table if not exists public.borg_name_stats (
  name text primary key,
  like_count integer not null default 0 check (like_count >= 0),
  rating_total numeric not null default 0 check (rating_total >= 0),
  rating_count integer not null default 0 check (rating_count >= 0)
);

create table if not exists public.user_saved_likes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  name text not null,
  liked_at timestamptz not null default now(),
  rating smallint check (rating between 1 and 5),
  unique (user_id, name)
);

create table if not exists public.user_rolls (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  name text not null,
  roll_type text not null check (roll_type in ('borg', 'mio', 'ai')),
  rolled_at timestamptz not null default now()
);

create index if not exists user_saved_likes_user_id_idx
  on public.user_saved_likes (user_id, liked_at desc);

create index if not exists user_rolls_user_id_idx
  on public.user_rolls (user_id, rolled_at desc);

alter table public.borg_name_stats enable row level security;
alter table public.user_saved_likes enable row level security;
alter table public.user_rolls enable row level security;

create policy "Anyone can read borg stats"
  on public.borg_name_stats for select
  using (true);

create policy "Authenticated users can insert borg stats"
  on public.borg_name_stats for insert
  with check (auth.role() = 'authenticated');

create policy "Authenticated users can update borg stats"
  on public.borg_name_stats for update
  using (auth.role() = 'authenticated');

create policy "Users can read own saved likes"
  on public.user_saved_likes for select
  using (auth.uid() = user_id);

create policy "Users can insert own saved likes"
  on public.user_saved_likes for insert
  with check (auth.uid() = user_id);

create policy "Users can update own saved likes"
  on public.user_saved_likes for update
  using (auth.uid() = user_id);

create policy "Users can delete own saved likes"
  on public.user_saved_likes for delete
  using (auth.uid() = user_id);

create policy "Users can read own rolls"
  on public.user_rolls for select
  using (auth.uid() = user_id);

create policy "Users can insert own rolls"
  on public.user_rolls for insert
  with check (auth.uid() = user_id);

-- Optional: reset any seeded stats in the database
-- truncate public.borg_name_stats;

-- Admin-managed name catalog (optional; app uses localStorage until wired up).
create table if not exists public.borg_catalog (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null check (kind in ('borg', 'mio', 'ai')),
  tag text not null default 'original',
  source text not null default 'admin' check (source in ('seed', 'admin')),
  created_at timestamptz not null default now(),
  unique (kind, name)
);

alter table public.borg_catalog enable row level security;

create policy "Anyone can read borg catalog"
  on public.borg_catalog for select
  using (true);

create policy "Admins can insert borg catalog"
  on public.borg_catalog for insert
  with check (public.current_user_is_admin());

create policy "Admins can update borg catalog"
  on public.borg_catalog for update
  using (public.current_user_is_admin());

create policy "Admins can delete borg catalog"
  on public.borg_catalog for delete
  using (public.current_user_is_admin());
