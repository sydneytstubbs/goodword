-- Step 4: good words (PRD F4, section 8). One good word per person per title,
-- with an optional note, shared into any number of the author's groups (or
-- none: "Only you, for now"). Reads go through RLS policies; every write goes
-- through a security-definer function below, so membership, limits, and the
-- one-per-title rule can't be bypassed from the client.

create table public.good_words (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title_id uuid not null references public.titles (id),
  note text check (note is null or char_length(note) between 1 and 140),
  source text not null default 'organic'
    check (source in ('organic', 'digest', 'nudge_email', 'join_prompt', 'share', 'import')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, title_id)
);
create index good_words_title on public.good_words (title_id);
create index good_words_user_created on public.good_words (user_id, created_at desc);

-- Which shelves a good word is on.
create table public.good_word_groups (
  id uuid primary key default gen_random_uuid(),
  good_word_id uuid not null references public.good_words (id) on delete cascade,
  group_id uuid not null references public.groups (id) on delete cascade,
  shared_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (good_word_id, group_id)
);
create index good_word_groups_shelf on public.good_word_groups (group_id, shared_at desc);

alter table public.good_words enable row level security;
alter table public.good_word_groups enable row level security;

create trigger good_words_touch before update on public.good_words
  for each row execute function public.touch_updated_at();
create trigger good_word_groups_touch before update on public.good_word_groups
  for each row execute function public.touch_updated_at();

-- Milestones already shown (DS 4.1.20: first and 10th good word), so each
-- shows once per person, on any device.
alter table public.profiles add column milestones text[] not null default '{}';

-- Visibility helpers. Security definer so the two policies below don't recurse.
create function public.owns_good_word(gw uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.good_words where id = gw and user_id = (select auth.uid()));
$$;

create function public.good_word_in_my_groups(gw uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.good_word_groups gwg
    join public.group_members m on m.group_id = gwg.group_id and m.user_id = (select auth.uid())
    where gwg.good_word_id = gw
  );
$$;

-- A good word is readable if it's yours, or shared into a group you're in (PRD 8).
create policy "good_words: own or shared with me" on public.good_words
  for select to authenticated
  using (user_id = (select auth.uid()) or public.good_word_in_my_groups(id));

-- Someone else's group links show only for your own groups, so no group name
-- or id you're not in ever leaks. Your own links are all yours to see.
create policy "good_word_groups: my groups or my good word" on public.good_word_groups
  for select to authenticated
  using (public.is_member(group_id) or public.owns_good_word(good_word_id));

-- 100 new good words per person per hour, to stop scripts (PRD F4, 10.4).
create function public.good_word_limit() returns int
language sql immutable as $$ select 100 $$;

create function public.clean_note(p_note text) returns text
language sql immutable as $$ select nullif(btrim(coalesce(p_note, '')), '') $$;

-- Every group must be one of yours. Returns false otherwise.
create function public.all_my_groups(p_groups uuid[]) returns boolean
language sql stable security definer set search_path = '' as $$
  select not exists (
    select 1 from unnest(coalesce(p_groups, '{}')) g
    where not exists (select 1 from public.group_members m where m.group_id = g and m.user_id = (select auth.uid()))
  );
$$;

-- Makes a good word's shelves exactly p_groups, keeping shared_at for shelves it stays on.
create function public.sync_good_word_groups(p_good_word uuid, p_groups uuid[]) returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.good_word_groups
    where good_word_id = p_good_word and not (group_id = any (coalesce(p_groups, '{}')));
  insert into public.good_word_groups (good_word_id, group_id)
    select p_good_word, g from unnest(coalesce(p_groups, '{}')) g
    on conflict (good_word_id, group_id) do nothing;
end $$;

-- Put in a good word (DS 5.4). Adding a title you've already vouched for
-- updates that good word instead (one per person per title, F4).
-- Returns status (created, updated, not_member, rate_limited, too_long) and,
-- for a new good word, the milestone to show once: 'first', 'tenth', or null.
create function public.put_good_word(p_title uuid, p_note text, p_groups uuid[], p_source text)
returns table (status text, milestone text)
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.require_user();
  v_note text := public.clean_note(p_note);
  existing uuid;
  created uuid;
  total int;
  reached text;
begin
  if char_length(v_note) > 140 then return query select 'too_long'::text, null::text; return; end if;
  if not public.all_my_groups(p_groups) then return query select 'not_member'::text, null::text; return; end if;
  if p_source is null or p_source not in ('organic', 'digest', 'nudge_email', 'join_prompt', 'share', 'import') then
    p_source := 'organic';
  end if;
  perform pg_advisory_xact_lock(hashtext('good_words:' || uid::text));

  select id into existing from public.good_words where user_id = uid and title_id = p_title;
  if existing is not null then
    update public.good_words set note = v_note where id = existing;
    perform public.sync_good_word_groups(existing, p_groups);
    return query select 'updated'::text, null::text;
    return;
  end if;

  if (select count(*) from public.good_words
      where user_id = uid and created_at > now() - interval '1 hour') >= public.good_word_limit() then
    return query select 'rate_limited'::text, null::text;
    return;
  end if;

  insert into public.good_words (user_id, title_id, note, source)
    values (uid, p_title, v_note, p_source) returning id into created;
  perform public.sync_good_word_groups(created, p_groups);

  select count(*) into total from public.good_words where user_id = uid;
  reached := case total when 1 then 'first' when 10 then 'tenth' else null end;
  if reached is not null then
    update public.profiles set milestones = array_append(milestones, reached)
      where user_id = uid and not (reached = any (milestones));
    if not found then reached := null; end if;
  end if;
  return query select 'created'::text, reached;
end $$;

-- Edit note (silent, no "edited" label: DS 5.4). Returns false if there's no such good word.
create function public.edit_good_word_note(p_title uuid, p_note text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_note text := public.clean_note(p_note);
begin
  if char_length(v_note) > 140 then return false; end if;
  update public.good_words set note = v_note
    where user_id = public.require_user() and title_id = p_title;
  return found;
end $$;

-- Change groups. Zero groups is allowed: it lives only on My shelf.
create function public.set_good_word_groups(p_title uuid, p_groups uuid[]) returns text
language plpgsql security definer set search_path = '' as $$
declare gw uuid;
begin
  if not public.all_my_groups(p_groups) then return 'not_member'; end if;
  select id into gw from public.good_words where user_id = public.require_user() and title_id = p_title;
  if gw is null then return 'missing'; end if;
  perform public.sync_good_word_groups(gw, p_groups);
  return 'updated';
end $$;

-- Take it back: gone from every shelf immediately (F4). Undo is restore_good_word.
create function public.take_back_good_word(p_title uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.good_words where user_id = public.require_user() and title_id = p_title;
  return found;
end $$;

-- Undo a take-back from the client's snapshot, restoring the note, source,
-- dates, and every shelf it was on (F4: "restored exactly"). Shelves you've
-- since left are skipped. Dates can't be in the future.
create function public.restore_good_word(
  p_title uuid,
  p_note text,
  p_source text,
  p_created_at timestamptz,
  p_groups uuid[],
  p_shared_at timestamptz[]
) returns text
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.require_user();
  v_note text := public.clean_note(p_note);
  gw uuid;
begin
  if char_length(v_note) > 140 then return 'too_long'; end if;
  if p_source is null or p_source not in ('organic', 'digest', 'nudge_email', 'join_prompt', 'share', 'import') then
    p_source := 'organic';
  end if;
  perform pg_advisory_xact_lock(hashtext('good_words:' || uid::text));
  if exists (select 1 from public.good_words where user_id = uid and title_id = p_title) then return 'exists'; end if;
  insert into public.good_words (user_id, title_id, note, source, created_at)
    values (uid, p_title, v_note, p_source, least(coalesce(p_created_at, now()), now()))
    returning id into gw;
  insert into public.good_word_groups (good_word_id, group_id, shared_at)
    select gw, g.id, least(coalesce(g.at, now()), now())
    from unnest(coalesce(p_groups, '{}'), coalesce(p_shared_at, '{}')) as g (id, at)
    where g.id is not null
      and exists (select 1 from public.group_members m where m.group_id = g.id and m.user_id = uid)
    on conflict (good_word_id, group_id) do nothing;
  return 'restored';
end $$;

-- The first-good-word prompt doesn't return once dismissed or used (PRD F5.7).
create function public.dismiss_join_prompt(p_group uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.group_members set join_prompt_dismissed_at = coalesce(join_prompt_dismissed_at, now())
    where group_id = p_group and user_id = public.require_user();
end $$;

-- Leaving or being removed takes that person's good words off the group's
-- shelf (F2.6, open question 5). They stay on My shelf and other groups.
create function public.unshare_member_good_words(p_group uuid, p_user uuid) returns void
language sql security definer set search_path = '' as $$
  delete from public.good_word_groups gwg
    using public.good_words gw
    where gwg.good_word_id = gw.id and gw.user_id = p_user and gwg.group_id = p_group;
$$;

create or replace function public.leave_group(p_group uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.require_user();
  me public.group_members;
  heir uuid;
begin
  perform pg_advisory_xact_lock(hashtext('group:' || p_group::text));
  select * into me from public.group_members where group_id = p_group and user_id = uid;
  if not found then return 'not_member'; end if;
  select user_id into heir from public.group_members
    where group_id = p_group and user_id <> uid order by joined_at, id limit 1;
  if heir is null then
    delete from public.groups where id = p_group;
    return 'deleted';
  end if;
  if me.role = 'owner' then
    update public.group_members set role = 'owner' where group_id = p_group and user_id = heir;
    update public.groups set owner_id = heir where id = p_group;
  end if;
  perform public.unshare_member_good_words(p_group, uid);
  delete from public.group_members where id = me.id;
  return 'left';
end $$;

create or replace function public.remove_member(p_group uuid, p_user uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare uid uuid := public.require_user();
begin
  if not public.is_owner(p_group) or p_user = uid then return false; end if;
  perform public.unshare_member_good_words(p_group, p_user);
  delete from public.group_members where group_id = p_group and user_id = p_user;
  return found;
end $$;

-- Only signed-in users call these; nobody calls the helpers directly.
revoke execute on function public.put_good_word, public.edit_good_word_note, public.set_good_word_groups,
  public.take_back_good_word, public.restore_good_word, public.dismiss_join_prompt from public, anon;
revoke execute on function public.good_word_limit, public.clean_note, public.all_my_groups,
  public.sync_good_word_groups, public.unshare_member_good_words from public, anon, authenticated;
