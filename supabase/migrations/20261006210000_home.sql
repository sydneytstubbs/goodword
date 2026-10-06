-- Step 17: Home (PRD F16.3), behind the home_enabled flag (F16.10).
--
-- Home is derived, never stored (F16.11 guardrail 6): title_cards gains a
-- home scope, and two small reads supply the import roll-up lines and each
-- card's latest comment. Your last visit to Home is kept on your profile.

-- Home's own last visit (F16.3), separate from each group's.
alter table public.profiles add column home_viewed_at timestamptz;

-- Marks Home viewed (when you leave it, or after 10 seconds on it, as F5.5).
create function public.mark_home_viewed() returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles set home_viewed_at = now() where user_id = public.require_user();
end $$;

-- title_cards with the home scope. The other scopes are unchanged.
--   home  every title with a good word from someone else you can see: your
--         friends' friends-shared good words and good words in your groups.
--         Imports (source import) never make or move a card on their own,
--         but are listed on cards others made. You're listed when you've
--         vouched. The card shows a group (via_group) only when nothing on
--         it reached you through friendship. New means someone else's good
--         word (not an import) arrived after your last visit; before your
--         first visit, the last 7 days count as new.
drop function public.title_cards(text, uuid, uuid);
create function public.title_cards(p_scope text, p_group uuid default null, p_person uuid default null)
returns table (
  id uuid,
  tmdb_id integer,
  media_type text,
  title text,
  year smallint,
  poster_path text,
  genres jsonb,
  runtime_minutes smallint,
  seasons smallint,
  accent text,
  vouchers jsonb,
  latest_at timestamptz,
  is_new boolean,
  group_ids uuid[],
  friends boolean,
  via_group uuid
)
language sql stable security invoker set search_path = '' as $$
  with me as (
    select (select auth.uid()) as uid,
      coalesce((select p.home_viewed_at from public.profiles p where p.user_id = (select auth.uid())), now() - interval '7 days') as home_seen
  ),
  my_groups as (
    select m.group_id, coalesce(m.last_viewed_at, m.joined_at) as seen_at
    from public.group_members m
    join me on m.user_id = me.uid
  ),
  shares as (
    -- group, groups, and home: every share into your groups in scope
    select gw.title_id, gw.user_id, gw.note, gw.source, gwg.shared_at as at, gwg.group_id as via_group,
      (gw.user_id <> (select uid from me) and gwg.shared_at > case when p_scope = 'home' then (select home_seen from me) else mg.seen_at end) as fresh
    from my_groups mg
    join public.good_word_groups gwg on gwg.group_id = mg.group_id
    join public.good_words gw on gw.id = gwg.good_word_id
    where (p_scope = 'group' and mg.group_id = p_group) or p_scope in ('groups', 'home')
    union all
    -- home: your friends' friends-shared good words
    select gw.title_id, gw.user_id, gw.note, gw.source, gw.friends_shared_at, null::uuid,
      gw.friends_shared_at > (select home_seen from me)
    from public.good_words gw
    where p_scope = 'home' and gw.friends_shared_at is not null and gw.user_id <> (select uid from me) and public.is_friend(gw.user_id)
    union all
    -- mine, and home: your own good word, so you're named on the card
    select gw.title_id, gw.user_id, gw.note, gw.source, gw.created_at, null::uuid, false
    from public.good_words gw
    join me on gw.user_id = me.uid
    where p_scope in ('mine', 'home')
    union all
    select gw.title_id, gw.user_id, gw.note, gw.source, seen.at, null::uuid, false
    from public.good_words gw
    cross join lateral (
      select max(x) as at from (
        select gwg.shared_at
        from public.good_word_groups gwg
        join my_groups mg on mg.group_id = gwg.group_id
        where gwg.good_word_id = gw.id
        union all
        select gw.friends_shared_at where public.is_friend(gw.user_id)
      ) visible (x)
    ) seen
    where p_scope = 'person' and gw.user_id = p_person and seen.at is not null
  ),
  per_person as (
    select s.title_id, s.user_id, (array_agg(s.note order by s.at desc))[1] as note, max(s.at) as at, bool_or(s.fresh) as fresh,
      -- On Home: did this person's good word reach you through friendship, and
      -- which group did their newest group share come through?
      bool_or(s.via_group is null and s.user_id <> (select uid from me)) as via_friends,
      (array_agg(s.via_group order by s.at desc) filter (where s.via_group is not null))[1] as via_group,
      bool_and(s.source = 'import') as imported
    from shares s
    group by s.title_id, s.user_id
  ),
  cards as (
    select pp.title_id,
      jsonb_agg(
        jsonb_build_object('user_id', pp.user_id, 'name', coalesce(pr.display_name, ''), 'note', pp.note, 'at', pp.at)
        order by pp.at desc
      ) as vouchers,
      case when p_scope = 'home'
        then max(pp.at) filter (where pp.user_id <> (select uid from me) and not pp.imported)
        else max(pp.at) end as latest_at,
      bool_or(pp.fresh and (p_scope <> 'home' or not pp.imported)) as is_new,
      case when p_scope = 'home' and not bool_or(pp.via_friends)
        then (array_agg(pp.via_group order by pp.at desc) filter (where pp.via_group is not null and pp.user_id <> (select uid from me)))[1]
      end as via_group
    from per_person pp
    left join public.profiles pr on pr.user_id = pp.user_id
    group by pp.title_id
    -- Home shows a title only when someone else's good word (not an import) is on it.
    having p_scope <> 'home' or bool_or(pp.user_id <> (select uid from me) and not pp.imported)
  )
  select t.id, t.tmdb_id, t.media_type, t.title, t.year, t.poster_path, t.genres, t.runtime_minutes, t.seasons, t.accent,
    c.vouchers, c.latest_at, c.is_new,
    case when p_scope = 'mine' then coalesce((
      select array_agg(gwg.group_id order by gwg.shared_at, gwg.created_at)
      from public.good_words gw
      join public.good_word_groups gwg on gwg.good_word_id = gw.id
      where gw.user_id = (select uid from me) and gw.title_id = t.id
    ), '{}') end,
    case when p_scope = 'mine' then (
      select gw.friends_shared_at is not null from public.good_words gw
      where gw.user_id = (select uid from me) and gw.title_id = t.id
    ) end,
    c.via_group
  from cards c
  join public.titles t on t.id = c.title_id
  order by c.latest_at desc, t.title;
$$;

-- Import roll-up lines on Home (F16.3): one per import by someone else,
-- counting only the good words it added that you can see (F16.6 rule 4).
-- Imports themselves are private to their owner, so this reads them as the
-- database, and returns nothing but the person, the count, and the time.
create function public.home_import_rollups() returns table (user_id uuid, name text, import_id uuid, added_count int, at timestamptz)
language sql stable security definer set search_path = '' as $$
  select i.user_id, coalesce(p.display_name, ''), i.id, count(*)::int, max(c.decided_at)
  from public.imports i
  join public.import_cards c on c.import_id = i.id and c.decision = 'added' and c.created_good_word
  join public.titles t on t.tmdb_id = c.added_tmdb_id and t.media_type = c.added_type
  join public.good_words gw on gw.user_id = i.user_id and gw.title_id = t.id and gw.source = 'import'
  left join public.profiles p on p.user_id = i.user_id
  where (select auth.uid()) is not null
    and i.user_id <> (select auth.uid())
    and public.can_view_good_word((select auth.uid()), gw.id)
  group by i.user_id, p.display_name, i.id
  having count(*) > 0;
$$;

-- The newest comment on each of these titles in your groups, for Home's
-- conversation row (F16.3): who, when, and the text unless it's a spoiler
-- (DS 4.2.12). Only conversations in groups you're in now count, as F13's
-- read rule says (it reads mention names, which only the database may).
create function public.latest_comments(p_titles uuid[])
returns table (title_id uuid, group_id uuid, comment_id uuid, author_name text, body text, mentions jsonb, is_spoiler boolean, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select distinct on (c.title_id) c.title_id, c.group_id, c.id, coalesce(p.display_name, ''),
    case when c.is_spoiler then null else c.body end,
    case when c.is_spoiler then '[]'::jsonb else public.comment_mention_names(c.id) end,
    c.is_spoiler, c.created_at
  from public.comments c
  join public.group_members m on m.group_id = c.group_id and m.user_id = (select auth.uid())
  left join public.profiles p on p.user_id = c.user_id
  where c.title_id = any (coalesce(p_titles, '{}')) and c.deleted_at is null
  order by c.title_id, c.created_at desc;
$$;

revoke execute on function public.mark_home_viewed, public.home_import_rollups, public.latest_comments, public.title_cards from public, anon;
grant execute on function public.mark_home_viewed, public.home_import_rollups, public.latest_comments, public.title_cards to authenticated;
