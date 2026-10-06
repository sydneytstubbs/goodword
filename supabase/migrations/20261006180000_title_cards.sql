-- Step 16: one card query (PRD F16.11 guardrail 3, section 8). title_cards
-- builds the cards for a group's list, all your groups, My list, and a
-- person view: one row per title, with the people who vouched for it (each
-- once, at their newest share in scope, newest first) and their notes, the
-- newest share, and whether anything is new since you last looked. Home
-- (slice 17) and one title (slice 19) add scopes here, not new queries.
--
-- It runs as the person asking (security invoker), so row-level security
-- decides what's visible: good words through can_view_good_word, and group
-- links only for your own groups. No visibility logic of its own.
--
-- Scopes:
--   group  (p_group)  every good word shared into that group, at its share time
--   groups            the same across all your groups (All groups)
--   mine              your own good words, at when you put them in, with
--                     their groups and whether friends can see them
--   person (p_person) their good words you can see, at the newest share you
--                     can see: into one of your groups, or with friends if
--                     you're their friend

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
  friends boolean
)
language sql stable security invoker set search_path = '' as $$
  with me as (
    select (select auth.uid()) as uid
  ),
  -- Your groups, and when you last looked at each list (F5.5: joining counts).
  my_groups as (
    select m.group_id, coalesce(m.last_viewed_at, m.joined_at) as seen_at
    from public.group_members m
    join me on m.user_id = me.uid
  ),
  shares as (
    select gw.title_id, gw.user_id, gw.note, gwg.shared_at as at,
      (gw.user_id <> (select uid from me) and gwg.shared_at > mg.seen_at) as fresh
    from my_groups mg
    join public.good_word_groups gwg on gwg.group_id = mg.group_id
    join public.good_words gw on gw.id = gwg.good_word_id
    where (p_scope = 'group' and mg.group_id = p_group) or p_scope = 'groups'
    union all
    select gw.title_id, gw.user_id, gw.note, gw.created_at, false
    from public.good_words gw
    join me on gw.user_id = me.uid
    where p_scope = 'mine'
    union all
    select gw.title_id, gw.user_id, gw.note, seen.at, false
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
  -- Each person once per title, at their newest share in scope.
  per_person as (
    select s.title_id, s.user_id, (array_agg(s.note order by s.at desc))[1] as note, max(s.at) as at, bool_or(s.fresh) as fresh
    from shares s
    group by s.title_id, s.user_id
  ),
  cards as (
    select pp.title_id,
      jsonb_agg(
        jsonb_build_object('user_id', pp.user_id, 'name', coalesce(pr.display_name, ''), 'note', pp.note, 'at', pp.at)
        order by pp.at desc
      ) as vouchers,
      max(pp.at) as latest_at,
      bool_or(pp.fresh) as is_new
    from per_person pp
    left join public.profiles pr on pr.user_id = pp.user_id
    group by pp.title_id
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
    ) end
  from cards c
  join public.titles t on t.id = c.title_id
  order by c.latest_at desc, t.title;
$$;

revoke execute on function public.title_cards from public, anon;
grant execute on function public.title_cards to authenticated;
