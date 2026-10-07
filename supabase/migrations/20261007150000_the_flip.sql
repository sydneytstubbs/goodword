-- Step 20: the flip (PRD F16.10). Home, friends, and everything behind the
-- home_enabled flag are on for everyone.
--
-- Nothing becomes more visible without its author: existing good words keep
-- friends_shared_at empty until their author shares them (the prompt below).
-- Every step here can run twice safely (F16.11 guardrail 7).

-- 1. Everyone has the flag, and new accounts start with it. The app no longer
-- reads it; the column is dropped in a later cleanup, so the running app
-- keeps working between this migration and its deploy.
alter table public.profiles alter column home_enabled set default true;
update public.profiles set home_enabled = true where not home_enabled;

-- 2. People who share a group become friends, once (decision 4). Pending
-- requests between them are answered; a friendship that already exists is
-- left alone. Seeded friendships are marked, so they can be told apart.
insert into public.friendships as f (user_low, user_high, status, requested_by, accepted_at, seeded)
  select distinct least(a.user_id, b.user_id), greatest(a.user_id, b.user_id), 'accepted', least(a.user_id, b.user_id), now(), true
  from public.group_members a
  join public.group_members b on b.group_id = a.group_id and b.user_id > a.user_id
  on conflict (user_low, user_high) do update
    set status = 'accepted', accepted_at = coalesce(f.accepted_at, now())
    where f.status = 'pending';
delete from public.activity_items a
  where a.type = 'friend_request'
    and exists (
      select 1 from public.friendships f
      where f.status = 'accepted' and f.user_low = least(a.user_id, a.actor_id) and f.user_high = greatest(a.user_id, a.actor_id)
    );

-- 3. "Share your list with friends?", once, for people who had an account
-- before the flip (F16.10). Due is set here and never again; answering
-- records when.
alter table public.profiles add column if not exists share_prompt_due boolean not null default false;
alter table public.profiles add column if not exists share_prompt_answered_at timestamptz;
update public.profiles set share_prompt_due = true where share_prompt_answered_at is null and not share_prompt_due;

-- Whether to show the prompt now: due, unanswered, with a friend, and with
-- good words not shared with friends yet.
create or replace function public.share_prompt_wanted() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.user_id = (select auth.uid()) and p.share_prompt_due and p.share_prompt_answered_at is null
      and exists (
        select 1 from public.friendships f
        where f.status = 'accepted' and p.user_id in (f.user_low, f.user_high)
      )
      and exists (
        select 1 from public.good_words gw where gw.user_id = p.user_id and gw.friends_shared_at is null
      )
  );
$$;

-- Answering the prompt: share_all shares every good word of yours not yet
-- shared with friends; choose shares just these; not_now shares nothing.
-- Returns how many good words friends can see now, or null if the answer
-- isn't one of those.
create or replace function public.answer_share_prompt(p_action text, p_good_words uuid[] default null) returns int
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.require_user();
begin
  if p_action not in ('share_all', 'choose', 'not_now') then return null; end if;
  if p_action = 'share_all' then
    update public.good_words set friends_shared_at = now() where user_id = uid and friends_shared_at is null;
  elsif p_action = 'choose' then
    update public.good_words set friends_shared_at = now()
      where user_id = uid and friends_shared_at is null and id = any (coalesce(p_good_words, '{}'));
  end if;
  update public.profiles set share_prompt_answered_at = coalesce(share_prompt_answered_at, now()) where user_id = uid;
  return (select count(*)::int from public.good_words where user_id = uid and friends_shared_at is not null);
end $$;

-- 4. Activity no longer checks the flag.
create or replace function public.my_activity(p_limit int default 200, p_unread_only boolean default false)
returns table (
  id uuid,
  type text,
  actor_id uuid,
  actor_name text,
  group_id uuid,
  group_name text,
  title_id uuid,
  comment_id uuid,
  comment_created_at timestamptz,
  body text,
  mentions jsonb,
  is_spoiler boolean,
  created_at timestamptz,
  read_at timestamptz,
  good_word_id uuid,
  word_author_id uuid,
  word_author_name text
)
language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := public.require_user();
begin
  return query
    select a.id, a.type, a.actor_id, coalesce(p.display_name, ''), a.group_id, g.name, a.title_id, a.comment_id,
      c.created_at,
      case when c.is_spoiler then null else c.body end,
      case when c.id is null or c.is_spoiler then '[]'::jsonb else public.comment_mention_names(c.id) end,
      coalesce(c.is_spoiler, false), a.created_at, a.read_at,
      v.good_word_id, v.author_id, wa.display_name
    from public.activity_items a
    left join public.groups g on g.id = a.group_id
    left join public.comments c on c.id = a.comment_id
    left join public.profiles p on p.user_id = a.actor_id
    left join public.conversations v on v.id = a.conversation_id and v.scope = 'good_word'
    left join public.profiles wa on wa.user_id = v.author_id
    where a.user_id = uid
      and (
        (a.group_id is not null and exists (select 1 from public.group_members m where m.group_id = a.group_id and m.user_id = uid))
        or (a.group_id is null and a.conversation_id is null)
        or (a.group_id is null and v.id is not null and v.good_word_id is not null and public.word_visible(v.good_word_id))
      )
      and a.created_at > now() - interval '90 days'
      and (a.comment_id is null or c.deleted_at is null)
      and (not coalesce(p_unread_only, false) or a.read_at is null)
    order by a.created_at desc
    limit least(greatest(coalesce(p_limit, 200), 1), 500);
end $$;

-- 5. The weekly digest covers what Home shows (F7.1, F16.9): up to 8 titles
-- from friends and groups, newest first, each once, with who vouched, the
-- newest note, and the group only when nothing on it came through
-- friendship; import roll-ups as one line each; then each group's
-- conversation summary (F7.5). Null when there's nothing new from anyone else.
create or replace function public.digest_content(p_user uuid, p_since timestamptz default now() - interval '7 days')
returns jsonb
language sql stable security definer set search_path = '' as $$
  with my_groups as (
    select g.id, g.name, g.color, m.joined_at
    from public.group_members m join public.groups g on g.id = m.group_id
    where m.user_id = p_user
  ),
  my_friends as (
    select case when f.user_low = p_user then f.user_high else f.user_low end as id
    from public.friendships f
    where f.status = 'accepted' and p_user in (f.user_low, f.user_high)
  ),
  shared as (
    -- Into your groups.
    select gw.id as good_word_id, gw.title_id, gw.user_id, gw.note, gwg.shared_at as at, gwg.group_id
    from public.good_word_groups gwg
    join public.good_words gw on gw.id = gwg.good_word_id
    join my_groups mg on mg.id = gwg.group_id
    where gw.user_id <> p_user and gw.source <> 'import' and gwg.shared_at >= p_since
    union all
    -- With you, as a friend.
    select gw.id, gw.title_id, gw.user_id, gw.note, gw.friends_shared_at, null::uuid
    from public.good_words gw
    join my_friends fr on fr.id = gw.user_id
    where gw.source <> 'import' and gw.friends_shared_at >= p_since
  ),
  per_person as (
    select s.title_id, s.user_id, max(s.at) as at,
      (array_agg(s.note order by s.at desc) filter (where s.note is not null and s.note <> ''))[1] as note,
      bool_or(s.group_id is null) as via_friends,
      (array_agg(s.group_id order by s.at desc) filter (where s.group_id is not null))[1] as group_id
    from shared s group by 1, 2
  ),
  per_title as (
    select pp.title_id, max(pp.at) as latest,
      jsonb_agg(coalesce(p.display_name, '') order by pp.at desc) as vouchers,
      (array_agg(pp.note order by pp.at desc) filter (where pp.note is not null))[1] as note,
      case when not bool_or(pp.via_friends) then (array_agg(pp.group_id order by pp.at desc) filter (where pp.group_id is not null))[1] end as group_id
    from per_person pp left join public.profiles p on p.user_id = pp.user_id
    group by 1
  ),
  -- Imports by people you can see, counting only good words you can see (F16.3).
  rollups as (
    select i.user_id, coalesce(p.display_name, '') as name, i.id, count(distinct gw.id)::int as n, max(c.decided_at) as at
    from public.imports i
    join public.import_cards c on c.import_id = i.id and c.decision = 'added' and c.created_good_word and c.decided_at >= p_since
    join public.titles t on t.tmdb_id = c.added_tmdb_id and t.media_type = c.added_type
    join public.good_words gw on gw.user_id = i.user_id and gw.title_id = t.id and gw.source = 'import'
    left join public.profiles p on p.user_id = i.user_id
    where i.user_id <> p_user
      and (
        (gw.friends_shared_at is not null and exists (select 1 from my_friends fr where fr.id = gw.user_id))
        or exists (select 1 from public.good_word_groups gwg join my_groups mg on mg.id = gwg.group_id where gwg.good_word_id = gw.id)
      )
    group by i.user_id, p.display_name, i.id
  ),
  talk as (
    select c.group_id, c.title_id, count(*) as n, max(c.created_at) as latest
    from public.comments c join my_groups mg on mg.id = c.group_id
    where c.deleted_at is null and c.user_id <> p_user and c.created_at >= p_since
    group by 1, 2
  ),
  title_json as (
    select t.id, jsonb_build_object('id', t.id, 'tmdb_id', t.tmdb_id, 'type', t.media_type, 'title', t.title,
      'year', t.year, 'poster_path', t.poster_path, 'accent', t.accent) as j
    from public.titles t
    where t.id in (select title_id from per_title union select title_id from talk)
  ),
  groups_json as (
    select mg.id, mg.name, jsonb_build_object(
        'id', mg.id,
        'name', mg.name,
        'comments', coalesce((select sum(tk.n) from talk tk where tk.group_id = mg.id), 0),
        'conversations', (select count(*) from talk tk where tk.group_id = mg.id),
        'top_conversations', coalesce((
          select jsonb_agg(x.j order by x.n desc, x.latest desc) from (
            select tk.n, tk.latest, tj.j || jsonb_build_object('comments', tk.n) as j
            from talk tk join title_json tj on tj.id = tk.title_id
            where tk.group_id = mg.id
            order by tk.n desc, tk.latest desc limit 3
          ) x), '[]'::jsonb)
      ) as j,
      (select coalesce(sum(tk.n), 0) from talk tk where tk.group_id = mg.id) as n
    from my_groups mg
  )
  select case when (select count(*) from shared) = 0 and (select count(*) from rollups) = 0 then null else jsonb_build_object(
    'good_words', (select count(distinct good_word_id) from shared),
    'group_names', coalesce((select jsonb_agg(mg.name order by mg.joined_at) from my_groups mg), '[]'::jsonb),
    'total_titles', (select count(*) from per_title),
    'titles', coalesce((
      select jsonb_agg(x.j order by x.latest desc) from (
        select pt.latest, tj.j || jsonb_build_object(
            'vouchers', pt.vouchers,
            'note', pt.note,
            'group', case when g.id is null then null else jsonb_build_object('id', g.id, 'name', g.name) end
          ) as j
        from per_title pt
        join title_json tj on tj.id = pt.title_id
        left join public.groups g on g.id = pt.group_id
        order by pt.latest desc limit 8
      ) x), '[]'::jsonb),
    'rollups', coalesce((select jsonb_agg(jsonb_build_object('name', r.name, 'count', r.n) order by r.at desc) from rollups r), '[]'::jsonb),
    'groups', coalesce((select jsonb_agg(gj.j order by gj.n desc, gj.name) from groups_json gj where gj.n > 0), '[]'::jsonb)
  ) end;
$$;

-- 6. Stored events were renamed at slice 13; nothing sends the old names now.
drop trigger if exists events_list_rename on public.events;
drop function if exists public.rename_list_events();

revoke execute on function public.share_prompt_wanted, public.answer_share_prompt from public, anon;
