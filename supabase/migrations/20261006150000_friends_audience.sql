-- Step 15: friends as an audience (PRD F16.2, F16.6 rule 1, section 8),
-- behind the home_enabled flag (F16.10).
--
-- A good word can be shared with your friends as well as your groups. Sharing
-- with friends is a time, like sharing into a group. Existing good words stay
-- exactly as visible as they are: friends_shared_at starts empty, and nothing
-- sets it unless its author chooses to (F16.10).
--
-- Every write function keeps working for the running app: the new friends
-- argument is optional, and leaving it out changes nothing about friends.

alter table public.good_words add column friends_shared_at timestamptz;
create index good_words_friends on public.good_words (user_id, friends_shared_at desc)
  where friends_shared_at is not null;

-- One audience for a whole import (F15.1, F16.2).
alter table public.imports add column share_with_friends boolean not null default false;

-- F16.6 rule 1, the one place good word visibility is decided (F16.11): yours,
-- or a friend's they shared with friends, or shared into a group you're in.
-- Answers only for the person asking (the service role may ask for anyone),
-- so nobody can probe what someone else can see.
create function public.can_view_good_word(p_viewer uuid, p_good_word uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_viewer is not null
    and p_viewer = coalesce((select auth.uid()), p_viewer)
    and exists (
      select 1 from public.good_words gw
      where gw.id = p_good_word
        and (
          gw.user_id = p_viewer
          or (gw.friends_shared_at is not null and exists (
            select 1 from public.friendships f
            where f.status = 'accepted'
              and f.user_low = least(p_viewer, gw.user_id)
              and f.user_high = greatest(p_viewer, gw.user_id)
          ))
          or exists (
            select 1 from public.good_word_groups gwg
            join public.group_members m on m.group_id = gwg.group_id and m.user_id = p_viewer
            where gwg.good_word_id = gw.id
          )
        )
    );
$$;

drop policy "good_words: own or shared with me" on public.good_words;
create policy "good_words: can view" on public.good_words
  for select to authenticated
  using (public.can_view_good_word((select auth.uid()), id));

-- Friends on (true), off (false), or unchanged (null). Turning it on keeps
-- the first time it was shared, as group shares keep theirs.
create function public.set_good_word_friends(p_good_word uuid, p_friends boolean) returns void
language sql security definer set search_path = '' as $$
  update public.good_words
    set friends_shared_at = case when p_friends then coalesce(friends_shared_at, now()) else null end
    where id = p_good_word and p_friends is not null;
$$;

-- Put in a good word (DS 5.4), now with friends (F16.2).
drop function public.put_good_word(uuid, text, uuid[], text);
create function public.put_good_word(p_title uuid, p_note text, p_groups uuid[], p_source text, p_friends boolean default null)
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
    perform public.set_good_word_friends(existing, p_friends);
    return query select 'updated'::text, null::text;
    return;
  end if;

  if (select count(*) from public.good_words
      where user_id = uid and created_at > now() - interval '1 hour') >= public.good_word_limit() then
    return query select 'rate_limited'::text, null::text;
    return;
  end if;

  insert into public.good_words (user_id, title_id, note, source, friends_shared_at)
    values (uid, p_title, v_note, p_source, case when p_friends then now() end) returning id into created;
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

-- Change who sees it (F16.2): friends and groups in one save.
create function public.set_good_word_audience(p_title uuid, p_groups uuid[], p_friends boolean) returns text
language plpgsql security definer set search_path = '' as $$
declare gw uuid;
begin
  if not public.all_my_groups(p_groups) then return 'not_member'; end if;
  select id into gw from public.good_words where user_id = public.require_user() and title_id = p_title;
  if gw is null then return 'missing'; end if;
  perform public.sync_good_word_groups(gw, p_groups);
  perform public.set_good_word_friends(gw, p_friends);
  return 'updated';
end $$;

-- Undo a take-back exactly (F4), including when it was shared with friends.
drop function public.restore_good_word(uuid, text, text, timestamptz, uuid[], timestamptz[]);
create function public.restore_good_word(
  p_title uuid,
  p_note text,
  p_source text,
  p_created_at timestamptz,
  p_groups uuid[],
  p_shared_at timestamptz[],
  p_friends_shared_at timestamptz default null
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
  insert into public.good_words (user_id, title_id, note, source, created_at, friends_shared_at)
    values (uid, p_title, v_note, p_source, least(coalesce(p_created_at, now()), now()), least(p_friends_shared_at, now()))
    returning id into gw;
  insert into public.good_word_groups (good_word_id, group_id, shared_at)
    select gw, g.id, least(coalesce(g.at, now()), now())
    from unnest(coalesce(p_groups, '{}'), coalesce(p_shared_at, '{}')) as g (id, at)
    where g.id is not null
      and exists (select 1 from public.group_members m where m.group_id = g.id and m.user_id = uid)
    on conflict (good_word_id, group_id) do nothing;
  return 'restored';
end $$;

-- Starting an import records its audience, friends included (F15.1, F16.2).
drop function public.start_import(text, text, uuid[]);
create function public.start_import(p_method text, p_hash text, p_groups uuid[], p_friends boolean default false)
returns table (status text, import_id uuid, reuse jsonb)
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.require_user();
  new_id uuid;
  prior jsonb;
begin
  if p_method not in ('text', 'screenshots', 'both') or p_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'bad import' using errcode = '22023';
  end if;
  select i.extracted into prior from public.imports i
    where i.user_id = uid and i.input_hash = p_hash and i.extracted is not null
    order by i.created_at desc limit 1;
  insert into public.imports (user_id, method, input_hash, group_ids, share_with_friends)
    values (uid, p_method, p_hash, coalesce((
      select array_agg(distinct g) from unnest(coalesce(p_groups, '{}')) g where public.is_member(g)
    ), '{}'), coalesce(p_friends, false))
    returning id into new_id;
  return query select 'started'::text, new_id, prior;
end $$;

revoke execute on function public.set_good_word_friends from public, anon, authenticated;
revoke execute on function
  public.can_view_good_word, public.put_good_word, public.set_good_word_audience, public.restore_good_word, public.start_import
from public, anon;
grant execute on function
  public.can_view_good_word, public.put_good_word, public.set_good_word_audience, public.restore_good_word, public.start_import
to authenticated;
