-- Every borg on the board in one table, managed from the admin dashboard's Borgs tab.
--   borgs   one row per name, unique by its letters and digits (borg_name_key(): "Sponge Borg" and
--           "SpongeBorg" collide, like nameKey() in the Studio)
--     source     'classic'  the site's own list (seeded from src/data.json) and names admins add
--                'member'   an approved member submission, linked by submission_id
--                'ai'       a BORG AI name rated 👍 or ✏️ fixed in the AI Borg Studio
--     original   what the name riffs on ("Ron Burgundy" for "Ron Borgundy"), when known
--     category   topic tag admins assign (Celebrities, Sports, ...); null while unsorted
--     featured   shown in the home page marquee
-- Everyone reads name, original, source and featured: the generator rolls from the table, the
-- marquee shows the featured names and BORG AI avoids them all. Admins write through
-- admin_save_borg(), admin_delete_borgs(), admin_set_borg_category() and admin_set_borg_featured(),
-- and read everything (likes, rolls, dislikes, who sent it in) through admin_list_borgs().
-- Triggers keep the table in step with where names come from:
--   approving a submission adds it; a member removing their own approved name removes it (cascade)
--   each Studio rating adds or drops the AI names it touches, by the rules get_borg_board_pool()
--   used (dropped here): the name of a 👍 rating or the fixed name of a ✏️ one, unless that
--   name's latest rating is 👎
-- submit_borg_name() now turns away names already on the board.

create or replace function public.borg_name_key(p_name text)
returns text
language sql
immutable
set search_path = ''
as $$
  select lower(regexp_replace(p_name, '[^a-zA-Z0-9]+', '', 'g'));
$$;

create table if not exists public.borgs (
  id bigint generated always as identity primary key,
  name text not null check (
    char_length(name) between 1 and 80
    and name = btrim(name)
    and name ~ '[a-zA-Z0-9]'
  ),
  original text check (
    original is null or (char_length(original) between 1 and 80 and original = btrim(original))
  ),
  source text not null default 'classic' check (source in ('classic', 'member', 'ai')),
  category text check (
    category is null or (char_length(category) between 1 and 40 and category = btrim(category))
  ),
  featured boolean not null default false,
  submission_id bigint unique references public.borg_submissions on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((source = 'member') = (submission_id is not null))
);

create unique index if not exists borgs_name_key on public.borgs (public.borg_name_key(name));

alter table public.borgs enable row level security;

drop policy if exists "Anyone reads borgs" on public.borgs;
create policy "Anyone reads borgs"
  on public.borgs for select to anon, authenticated
  using (true);

-- Supabase's default privileges grant every new public table to anon and authenticated.
revoke all on public.borgs from anon, authenticated;
grant select (id, name, original, source, featured) on public.borgs to anon, authenticated;

-- ---------- seed ----------

-- The classics, in the site's order. "Armed borglary" repeats "Armed Borglary", so it's skipped.
insert into public.borgs (name, featured)
select v.name, v.featured
from (
  values
    ('Ron Borgundy', true),
    ('Borganomics', false),
    ('Pablo Escoborg', true),
    ('Playborg Carti', true),
    ('Brown vs. Borg of Education', false),
    ('Borgilicious', false),
    ('Borghilda', false),
    ('Borger King', true),
    ('Smorgasborg', true),
    ('Ruth Bader-Ginsborg', true),
    ('Borgeioise', false),
    ('Borgan Freeman', true),
    ('Curious Borg', false),
    ('Borg Washington', false),
    ('The Aborgtion Clinic', false),
    ('SpongeBorg', true),
    ('Borgzilla', false),
    ('Borgan Bogdonovich', false),
    ('LeBorg James', true),
    ('Borgonometry', false),
    ('Gettysborg Address', false),
    ('Souljia Borg', false),
    ('Borgingham Palace', false),
    ('CyBorg', false),
    ('BorgerLand', false),
    ('Borganic', false),
    ('Hamborger', false),
    ('Borger Patrol', false),
    ('Heisenborg', true),
    ('Marborglo', false),
    ('Borgasm', false),
    ('Pearl Harborg', false),
    ('Shish keborg', false),
    ('Borgage-backed securities', false),
    ('“The Borg not Taken” - Roborg Frost', false),
    ('Rick and Borgy', true),
    ('All Aborg!', false),
    ('Waterborging', false),
    ('Borgbecue Sauce', false),
    ('Borga the Explorer', true),
    ('Borg F150', false),
    ('Sweet Borgby Rays', false),
    ('Arnold Borginator', false),
    ('Borg and Boujie', false),
    ('Borg in the USA', false),
    ('Armed Borglary', false),
    ('Borg to be Wild', false),
    ('Borgasaurs', false),
    ('Osama Borg Laden', false),
    ('Borgupine', false),
    ('Brown Paper Borg', false),
    ('Kareem Abdul-Jaborg', true),
    ('Borg Hub', false),
    ('Borg Bros', false),
    ('Borgin Trail', false),
    ('fuck it we borg', false),
    ('Captain Borgan', false),
    ('Borgan Donor', false),
    ('Amborg Heard', false),
    ('Mark Zuckerborg', true),
    ('The Borg of Rights', false),
    ('Legalize Aborgtion', false),
    ('Borgatory', false),
    ('Holy shit its Jason Borg', true),
    ('Armed borglary', false),
    ('Borgaler', false),
    ('4 Borgs More Whores', false),
    ('Borganic Chemistry', false)
) as v (name, featured)
on conflict (public.borg_name_key(name)) do nothing;

-- Approved member names, in the order they reached the wall.
insert into public.borgs (name, source, submission_id, created_at)
select s.name, 'member', s.id, s.reviewed_at
from public.borg_submissions s
where s.status = 'approved'
order by s.reviewed_at, s.id
on conflict (public.borg_name_key(name)) do nothing;

-- ---------- AI names from Studio ratings ----------

-- Puts one name key in line with the Studio's ratings: on the board as an AI name when a 👍 or ✏️
-- rating approves a name with that key and the latest rating of a name with that key isn't 👎, off
-- it otherwise. A name already on the board from elsewhere only picks up the original when it has
-- none; only AI rows are ever removed.
create or replace function public.sync_borg_ai_name(p_key text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
  v_original text;
begin
  if coalesce(p_key, '') = '' then
    return;
  end if;

  select x.approved_name, x.original
  into v_name, v_original
  from (
    select
      case when r.verdict = 'fixed' then r.fixed_name else r.name end as approved_name,
      r.original,
      r.created_at,
      r.id
    from public.borg_ai_ratings r
    where r.verdict in ('good', 'fixed')
  ) x
  where public.borg_name_key(x.approved_name) = p_key
  order by x.created_at desc, x.id desc
  limit 1;

  if v_name is not null and (
    select r.verdict
    from public.borg_ai_ratings r
    where public.borg_name_key(r.name) = p_key
    order by r.created_at desc, r.id desc
    limit 1
  ) = 'bad' then
    v_name := null;
  end if;

  if v_name is null then
    delete from public.borgs b
    where b.source = 'ai'
      and public.borg_name_key(b.name) = p_key;
    return;
  end if;

  insert into public.borgs as b (name, original, source)
  values (btrim(v_name), nullif(btrim(v_original), ''), 'ai')
  on conflict (public.borg_name_key(name)) do update
    set original = excluded.original, updated_at = now()
    where b.original is null and excluded.original is not null;
end;
$$;

create or replace function public.sync_borg_ai_rating()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_keys text[] := '{}';
  v_key text;
begin
  if tg_op <> 'DELETE' then
    v_keys := v_keys || array[
      public.borg_name_key(new.name),
      public.borg_name_key(case when new.verdict = 'fixed' then new.fixed_name else new.name end)
    ];
  end if;
  if tg_op <> 'INSERT' then
    v_keys := v_keys || array[
      public.borg_name_key(old.name),
      public.borg_name_key(case when old.verdict = 'fixed' then old.fixed_name else old.name end)
    ];
  end if;

  for v_key in select distinct k from unnest(v_keys) as k loop
    perform public.sync_borg_ai_name(v_key);
  end loop;
  return null;
end;
$$;

drop trigger if exists borg_ai_ratings_sync_borgs on public.borg_ai_ratings;
create trigger borg_ai_ratings_sync_borgs
  after insert or update or delete on public.borg_ai_ratings
  for each row execute function public.sync_borg_ai_rating();

-- Studio-approved AI names rated so far, oldest approval first.
do $$
declare
  v_key text;
begin
  for v_key in
    select k.key
    from (
      select
        public.borg_name_key(case when r.verdict = 'fixed' then r.fixed_name else r.name end) as key,
        min(r.created_at) as first_at
      from public.borg_ai_ratings r
      where r.verdict in ('good', 'fixed')
      group by 1
    ) k
    order by k.first_at
  loop
    perform public.sync_borg_ai_name(v_key);
  end loop;
end;
$$;

-- ---------- member names from submissions ----------

create or replace function public.sync_borg_submission()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'approved' and old.status <> 'approved' then
    insert into public.borgs (name, source, submission_id)
    values (new.name, 'member', new.id)
    on conflict (public.borg_name_key(name)) do nothing;
  elsif old.status = 'approved' and new.status <> 'approved' then
    delete from public.borgs where submission_id = new.id;
  end if;
  return null;
end;
$$;

drop trigger if exists borg_submissions_sync_borgs on public.borg_submissions;
create trigger borg_submissions_sync_borgs
  after update of status on public.borg_submissions
  for each row execute function public.sync_borg_submission();

-- Same as before, plus: a name already on the board (any source) is turned away.
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

  if exists (select 1 from public.borgs b where public.borg_name_key(b.name) = public.borg_name_key(v_name)) then
    raise exception 'That one''s already on the board. Try another.';
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

-- ---------- admin ----------

-- Every borg, oldest first: { id, name, original, source, category, featured, created_at,
-- updated_at, author (member names: their display name, else the first 8 characters of their
-- account id; null otherwise), likes, dislikes, rolls (classic and AI rolls of that exact name) }.
create or replace function public.admin_list_borgs()
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_borg_admin() then
    raise exception 'Admins only.';
  end if;

  return (
    select coalesce(
      json_agg(
        json_build_object(
          'id', b.id,
          'name', b.name,
          'original', b.original,
          'source', b.source,
          'category', b.category,
          'featured', b.featured,
          'created_at', b.created_at,
          'updated_at', b.updated_at,
          'author', case when s.id is not null then coalesce(s.author, left(s.user_id::text, 8)) end,
          'likes', coalesce(c.likes, 0),
          'dislikes', coalesce(d.dislikes, 0),
          'rolls', coalesce(r.rolls, 0)
        )
        order by b.id
      ),
      '[]'
    )
    from public.borgs b
    left join public.borg_submissions s on s.id = b.submission_id
    left join public.borg_like_counts c on c.name = b.name
    left join (
      select x.name, count(*)::integer as dislikes
      from public.borg_ai_dislikes x
      group by x.name
    ) d on d.name = b.name
    left join (
      select x.name, count(*)::integer as rolls
      from public.borg_rolls x
      where x.kind in ('borg', 'ai')
      group by x.name
    ) r on r.name = b.name
  );
end;
$$;

-- Adds a classic (p_id null) or edits a borg. Blank original or category clears it. Returns the id.
-- Renaming carries the name's likes and 👎s over (a member keeps one or the other, never both);
-- roll history stays under the name that was rolled. Renaming a member name renames their
-- submission too, so it has to pass the submission rules. Errors carry copy the dashboard shows as
-- is; a name already on the board surfaces as unique_violation (23505).
create or replace function public.admin_save_borg(
  p_id bigint,
  p_name text,
  p_original text,
  p_category text,
  p_featured boolean
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
  v_original text := nullif(btrim(regexp_replace(coalesce(p_original, ''), '\s+', ' ', 'g')), '');
  v_category text := nullif(btrim(regexp_replace(coalesce(p_category, ''), '\s+', ' ', 'g')), '');
  v_old public.borgs;
  v_id bigint;
begin
  if not public.is_borg_admin() then
    raise exception 'Admins only.';
  end if;

  if char_length(v_name) not between 1 and 80 or v_name !~ '[a-zA-Z0-9]' then
    raise exception 'Names need 1 to 80 characters, with a letter or digit.';
  end if;

  if char_length(v_original) > 80 then
    raise exception 'Originals can be up to 80 characters.';
  end if;

  if char_length(v_category) > 40 then
    raise exception 'Categories can be up to 40 characters.';
  end if;

  if p_id is null then
    insert into public.borgs (name, original, category, featured)
    values (v_name, v_original, v_category, coalesce(p_featured, false))
    returning id into v_id;
    return v_id;
  end if;

  select * into v_old from public.borgs where id = p_id for update;
  if not found then
    raise exception 'That borg is gone. Refresh the list.';
  end if;

  if v_name <> v_old.name and v_old.source = 'member' then
    if char_length(v_name) < 3 or char_length(v_name) > 60 then
      raise exception 'Member names need 3 to 60 characters.';
    end if;
    if v_name !~* '\w+borg|borg\w+' then
      raise exception 'Member names need "borg" worked into a word.';
    end if;
    update public.borg_submissions set name = v_name where id = v_old.submission_id;
  end if;

  update public.borgs
  set name = v_name,
      original = v_original,
      category = v_category,
      featured = coalesce(p_featured, featured),
      updated_at = now()
  where id = p_id;

  if v_name <> v_old.name then
    insert into public.borg_likes (user_id, name, created_at)
    select l.user_id, v_name, l.created_at
    from public.borg_likes l
    where l.name = v_old.name
    on conflict do nothing;
    delete from public.borg_likes where name = v_old.name;

    insert into public.borg_ai_dislikes (user_id, name, created_at)
    select x.user_id, v_name, x.created_at
    from public.borg_ai_dislikes x
    where x.name = v_old.name
      and not exists (select 1 from public.borg_likes l where l.user_id = x.user_id and l.name = v_name)
    on conflict do nothing;
    delete from public.borg_ai_dislikes where name = v_old.name;
  end if;

  return p_id;
end;
$$;

-- Takes borgs off the board. A member name's submission is marked rejected, so it leaves the wall
-- and can't be sent in again; likes stay with the name. Returns how many were removed.
create or replace function public.admin_delete_borgs(p_ids bigint[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if not public.is_borg_admin() then
    raise exception 'Admins only.';
  end if;

  select count(*)::integer into v_count from public.borgs where id = any(p_ids);

  update public.borg_submissions s
  set status = 'rejected',
      reviewed_at = now(),
      reviewed_by = auth.uid()
  from public.borgs b
  where b.id = any(p_ids)
    and b.submission_id = s.id;

  delete from public.borgs where id = any(p_ids);
  return v_count;
end;
$$;

-- Sets (or, when blank, clears) the category of many borgs at once. Returns how many changed.
create or replace function public.admin_set_borg_category(p_ids bigint[], p_category text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_category text := nullif(btrim(regexp_replace(coalesce(p_category, ''), '\s+', ' ', 'g')), '');
  v_count integer;
begin
  if not public.is_borg_admin() then
    raise exception 'Admins only.';
  end if;

  if char_length(v_category) > 40 then
    raise exception 'Categories can be up to 40 characters.';
  end if;

  update public.borgs
  set category = v_category, updated_at = now()
  where id = any(p_ids)
    and category is distinct from v_category;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Features or unfeatures many borgs at once. Returns how many changed.
create or replace function public.admin_set_borg_featured(p_ids bigint[], p_featured boolean)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if not public.is_borg_admin() then
    raise exception 'Admins only.';
  end if;

  update public.borgs
  set featured = coalesce(p_featured, false), updated_at = now()
  where id = any(p_ids)
    and featured is distinct from coalesce(p_featured, false);
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- The Studio's board pool reads public.borgs now.
drop function if exists public.get_borg_board_pool();

revoke all on function public.borg_name_key(text) from public, anon, authenticated;
revoke all on function public.sync_borg_ai_name(text) from public, anon, authenticated;
revoke all on function public.sync_borg_ai_rating() from public, anon, authenticated;
revoke all on function public.sync_borg_submission() from public, anon, authenticated;
revoke all on function public.admin_list_borgs() from public, anon;
revoke all on function public.admin_save_borg(bigint, text, text, text, boolean) from public, anon;
revoke all on function public.admin_delete_borgs(bigint[]) from public, anon;
revoke all on function public.admin_set_borg_category(bigint[], text) from public, anon;
revoke all on function public.admin_set_borg_featured(bigint[], boolean) from public, anon;
grant execute on function public.admin_list_borgs() to authenticated;
grant execute on function public.admin_save_borg(bigint, text, text, text, boolean) to authenticated;
grant execute on function public.admin_delete_borgs(bigint[]) to authenticated;
grant execute on function public.admin_set_borg_category(bigint[], text) to authenticated;
grant execute on function public.admin_set_borg_featured(bigint[], boolean) to authenticated;
