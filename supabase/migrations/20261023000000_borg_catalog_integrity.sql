-- Catalog integrity (docs/audit-2026-10-11.md H7, H8).
--   borg_submissions  unique by borg_name_key(), like the board, so "Sponge Borg" and
--                     "SpongeBorg" can't both be sent in
--   review_borg_submission()  won't approve a name the board already has (a Studio AI name or
--                     an admin's classic can take it while the submission waits); the admin
--                     rejects it instead. The approval trigger raises rather than skipping, so an
--                     approved submission always has its row on the board.
--   admin_save_borg() takes the updated_at the admin's form was opened with and refuses the
--                     save when the borg changed since, so two admins can't overwrite each other.

-- ---------- submissions keyed like the board ----------

drop index if exists public.borg_submissions_name_key;
create unique index if not exists borg_submissions_board_key
  on public.borg_submissions (public.borg_name_key(name));

create or replace function public.sync_borg_submission()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'approved' and old.status <> 'approved' then
    -- No `on conflict`: approving a name the board already has must fail, not skip the row.
    insert into public.borgs (name, source, submission_id)
    values (new.name, 'member', new.id);
  elsif old.status = 'approved' and new.status <> 'approved' then
    delete from public.borgs where submission_id = new.id;
  end if;
  return null;
end;
$$;

-- Admins only: approves or rejects a pending name. Returns the new status, or null when the name
-- is gone or another admin already reviewed it. Approving a name the board already has raises
-- with copy the review page shows as is.
create or replace function public.review_borg_submission(p_id bigint, p_approve boolean)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
  v_status text;
begin
  if not public.is_borg_admin() then
    raise exception 'Admins only.';
  end if;

  select s.name into v_name from public.borg_submissions s where s.id = p_id and s.status = 'pending' for update;
  if not found then
    return null;
  end if;

  if p_approve and exists (
    select 1 from public.borgs b where public.borg_name_key(b.name) = public.borg_name_key(v_name)
  ) then
    raise exception '"%" is already on the board. Reject it instead.', v_name;
  end if;

  update public.borg_submissions
  set status = case when p_approve then 'approved' else 'rejected' end,
      reviewed_at = now(),
      reviewed_by = auth.uid()
  where id = p_id
  returning status into v_status;

  return v_status;
end;
$$;

-- ---------- catalog edits ----------

drop function if exists public.admin_save_borg(bigint, text, text, text, boolean);

-- Adds a classic (p_id null) or edits a borg. Blank original or category clears it. Returns the
-- id. An edit passes the updated_at its form was opened with (p_updated_at); when the borg has
-- changed since, the save is refused with serialization_failure (40001). Renaming carries the
-- name's likes and 👎s over (a member keeps one or the other, never both); roll history stays
-- under the name that was rolled. Renaming a member name renames their submission too, so it has
-- to pass the submission rules. Errors carry copy the dashboard shows as is; a name already on
-- the board surfaces as unique_violation (23505).
create or replace function public.admin_save_borg(
  p_id bigint,
  p_name text,
  p_original text,
  p_category text,
  p_featured boolean,
  p_updated_at timestamptz
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

  if p_updated_at is null or v_old.updated_at <> p_updated_at then
    raise exception using
      errcode = '40001',
      message = format('%s changed since you opened it. Refresh to see the latest, then edit again.', v_old.name);
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

revoke all on function public.admin_save_borg(bigint, text, text, text, boolean, timestamptz) from public, anon;
grant execute on function public.admin_save_borg(bigint, text, text, text, boolean, timestamptz) to authenticated;
