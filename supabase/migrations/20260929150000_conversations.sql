-- Step 6: conversations, mentions, and Activity (PRD F13, F14, section 8).
--
-- A conversation is one title in one group. Any title can have one, whether
-- or not it's on that group's shelf (open question 11). Comments are flat and
-- oldest first. Reads that reach the app go through security-definer
-- functions below, which check membership, keep other people's spoiler text
-- back until it's revealed, and name authors who have since left the group
-- (open question 10). Every write goes through a function too: there are no
-- insert, update, or delete policies.
--
-- Mentions are stored in the body as <@user-id>, so renamed people resolve
-- correctly (DS 4.2.11). Only members of the group at the time of writing can
-- be mentioned; anything else becomes plain text.

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  title_id uuid not null references public.titles (id),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Up to 500 characters as people read it; the stored form is longer when it
  -- holds mentions, so the display length is checked in the write functions.
  body text not null check (char_length(body) between 1 and 1000),
  is_spoiler boolean not null default false,
  edited_at timestamptz,
  -- Soft delete for the 8-second Undo, then purged (see the cleanup job).
  deleted_at timestamptz,
  deleted_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index comments_conversation on public.comments (group_id, title_id, created_at);
create index comments_user_created on public.comments (user_id, created_at desc);

create table public.comment_mentions (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.comments (id) on delete cascade,
  mentioned_user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (comment_id, mentioned_user_id)
);

-- Drives the New divider and the unseen-comment dot on cards.
create table public.conversation_reads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  group_id uuid not null references public.groups (id) on delete cascade,
  title_id uuid not null references public.titles (id),
  last_read_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, group_id, title_id)
);

-- Who hears about new comments: people who commented, or vouched for the
-- title into that group (F13). `muted` is reserved for later.
create table public.conversation_participants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  group_id uuid not null references public.groups (id) on delete cascade,
  title_id uuid not null references public.titles (id),
  muted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, group_id, title_id)
);
create index conversation_participants_conversation on public.conversation_participants (group_id, title_id);

create table public.activity_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null check (type in ('mention', 'comment', 'conversation_started', 'group_join')),
  actor_id uuid references auth.users (id) on delete cascade,
  group_id uuid not null references public.groups (id) on delete cascade,
  title_id uuid references public.titles (id),
  comment_id uuid references public.comments (id) on delete cascade,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index activity_items_recipient on public.activity_items (user_id, created_at desc);
create index activity_items_comment on public.activity_items (comment_id);

alter table public.comments enable row level security;
alter table public.comment_mentions enable row level security;
alter table public.conversation_reads enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.activity_items enable row level security;

create trigger comments_touch before update on public.comments
  for each row execute function public.touch_updated_at();
create trigger comment_mentions_touch before update on public.comment_mentions
  for each row execute function public.touch_updated_at();
create trigger conversation_reads_touch before update on public.conversation_reads
  for each row execute function public.touch_updated_at();
create trigger conversation_participants_touch before update on public.conversation_participants
  for each row execute function public.touch_updated_at();
create trigger activity_items_touch before update on public.activity_items
  for each row execute function public.touch_updated_at();

-- The one-time spoiler hint (DS 5.17), shown once per person on any device.
alter table public.profiles add column spoiler_hint_seen_at timestamptz;

-- Read policies (PRD 8). Members of the group, and only while they're members.
create function public.comment_visible(c uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.comments cm
    join public.group_members m on m.group_id = cm.group_id and m.user_id = (select auth.uid())
    where cm.id = c and cm.deleted_at is null
  );
$$;

create policy "comments: members read" on public.comments
  for select to authenticated using (deleted_at is null and public.is_member(group_id));

create policy "comment_mentions: members read" on public.comment_mentions
  for select to authenticated using (public.comment_visible(comment_id));

create policy "conversation_reads: own" on public.conversation_reads
  for select to authenticated using (user_id = (select auth.uid()));

create policy "conversation_participants: own" on public.conversation_participants
  for select to authenticated using (user_id = (select auth.uid()));

create policy "activity_items: own, in my groups" on public.activity_items
  for select to authenticated using (user_id = (select auth.uid()) and public.is_member(group_id));

-- 30 comments per person per 10 minutes (PRD 10.4).
create function public.comment_limit() returns int
language sql immutable as $$ select 30 $$;

create function public.mention_pattern() returns text
language sql immutable as $$ select '<@([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})>' $$;

-- A comment as people read it: each <@id> becomes @Name.
create function public.comment_plain_text(p_body text) returns text
language plpgsql stable security definer set search_path = '' as $$
declare
  rest text := coalesce(p_body, '');
  result text := '';
  m text[];
  marker text;
  pos int;
begin
  loop
    m := regexp_match(rest, public.mention_pattern());
    exit when m is null;
    marker := '<@' || m[1] || '>';
    pos := strpos(rest, marker);
    result := result || substr(rest, 1, pos - 1) || '@'
      || coalesce((select display_name from public.profiles where user_id = m[1]::uuid), '');
    rest := substr(rest, pos + char_length(marker));
  end loop;
  return result || rest;
end $$;

-- Keeps mentions of current members of the group (not yourself, at most 10
-- people). Anything else becomes plain text: the name, if the author shares a
-- group with that person, otherwise just "@", so an id never reveals a name.
create function public.normalize_comment_body(p_group uuid, p_author uuid, p_body text)
returns table (body text, mentions uuid[])
language plpgsql stable security definer set search_path = '' as $$
declare
  rest text := btrim(coalesce(p_body, ''));
  result text := '';
  kept uuid[] := '{}';
  m text[];
  marker text;
  pos int;
  who uuid;
begin
  loop
    m := regexp_match(rest, public.mention_pattern());
    exit when m is null;
    marker := '<@' || m[1] || '>';
    pos := strpos(rest, marker);
    result := result || substr(rest, 1, pos - 1);
    who := m[1]::uuid;
    if who <> p_author
      and exists (select 1 from public.group_members where group_id = p_group and user_id = who)
      and (who = any (kept) or cardinality(kept) < 10) then
      if not who = any (kept) then kept := kept || who; end if;
      result := result || marker;
    else
      result := result || '@' || coalesce((
        select p.display_name from public.profiles p
        where p.user_id = who and exists (
          select 1 from public.group_members a
          join public.group_members b on b.group_id = a.group_id
          where a.user_id = p_author and b.user_id = who
        )
      ), '');
    end if;
    rest := substr(rest, pos + char_length(marker));
  end loop;
  return query select result || rest, kept;
end $$;

create function public.touch_participant(p_user uuid, p_group uuid, p_title uuid) returns void
language sql security definer set search_path = '' as $$
  insert into public.conversation_participants (user_id, group_id, title_id)
    values (p_user, p_group, p_title)
    on conflict (user_id, group_id, title_id) do nothing;
$$;

-- Post a comment (F13). The id comes from the client, so a retried send never
-- makes a duplicate. Returns: created, exists, not_member, empty, too_long,
-- rate_limited.
--
-- Activity (F14): each mentioned member gets a mention item. The first
-- comment in a conversation gives every other member a conversation_started
-- item (open question 11); later comments give participants a comment item.
-- Nobody gets two items for one comment, and never for their own.
create function public.post_comment(p_id uuid, p_group uuid, p_title uuid, p_body text, p_spoiler boolean)
returns text
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.require_user();
  v_body text;
  v_mentions uuid[];
  plain text;
  started boolean;
begin
  if not public.is_member(p_group) then return 'not_member'; end if;
  if exists (select 1 from public.comments where id = p_id) then
    return case when exists (select 1 from public.comments where id = p_id and user_id = uid) then 'exists' else 'not_member' end;
  end if;
  select n.body, n.mentions into v_body, v_mentions from public.normalize_comment_body(p_group, uid, p_body) n;
  plain := btrim(public.comment_plain_text(v_body));
  if char_length(plain) = 0 then return 'empty'; end if;
  if char_length(plain) > 500 or char_length(v_body) > 1000 then return 'too_long'; end if;

  perform pg_advisory_xact_lock(hashtext('comments:' || uid::text));
  if (select count(*) from public.comments
      where user_id = uid and created_at > now() - interval '10 minutes') >= public.comment_limit() then
    return 'rate_limited';
  end if;

  perform pg_advisory_xact_lock(hashtext('conversation:' || p_group::text || ':' || p_title::text));
  started := not exists (
    select 1 from public.comments where group_id = p_group and title_id = p_title and deleted_at is null
  );

  insert into public.comments (id, group_id, title_id, user_id, body, is_spoiler)
    values (p_id, p_group, p_title, uid, v_body, coalesce(p_spoiler, false));
  insert into public.comment_mentions (comment_id, mentioned_user_id)
    select p_id, u from unnest(v_mentions) u;
  perform public.touch_participant(uid, p_group, p_title);

  insert into public.activity_items (user_id, type, actor_id, group_id, title_id, comment_id)
    select u, 'mention', uid, p_group, p_title, p_id from unnest(v_mentions) u;

  if started then
    insert into public.activity_items (user_id, type, actor_id, group_id, title_id, comment_id)
      select m.user_id, 'conversation_started', uid, p_group, p_title, p_id
      from public.group_members m
      where m.group_id = p_group and m.user_id <> uid and not (m.user_id = any (v_mentions));
  else
    insert into public.activity_items (user_id, type, actor_id, group_id, title_id, comment_id)
      select cp.user_id, 'comment', uid, p_group, p_title, p_id
      from public.conversation_participants cp
      join public.group_members m on m.group_id = cp.group_id and m.user_id = cp.user_id
      where cp.group_id = p_group and cp.title_id = p_title and not cp.muted
        and cp.user_id <> uid and not (cp.user_id = any (v_mentions));
  end if;
  return 'created';
end $$;

-- Edit your own comment (F13): the text and whether it's a spoiler. Newly
-- mentioned members are notified; people already mentioned aren't again, and
-- anyone no longer mentioned loses their unread mention item.
-- Returns: updated, missing, empty, too_long.
create function public.edit_comment(p_id uuid, p_body text, p_spoiler boolean) returns text
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.require_user();
  c public.comments;
  v_body text;
  v_mentions uuid[];
  plain text;
begin
  select * into c from public.comments where id = p_id and user_id = uid and deleted_at is null;
  if not found or not public.is_member(c.group_id) then return 'missing'; end if;
  select n.body, n.mentions into v_body, v_mentions from public.normalize_comment_body(c.group_id, uid, p_body) n;
  plain := btrim(public.comment_plain_text(v_body));
  if char_length(plain) = 0 then return 'empty'; end if;
  if char_length(plain) > 500 or char_length(v_body) > 1000 then return 'too_long'; end if;
  if v_body = c.body and coalesce(p_spoiler, false) = c.is_spoiler then return 'updated'; end if;

  update public.comments set body = v_body, is_spoiler = coalesce(p_spoiler, false), edited_at = now()
    where id = p_id;

  delete from public.activity_items a
    where a.comment_id = p_id and a.type = 'mention' and a.read_at is null
      and not (a.user_id = any (v_mentions));
  delete from public.comment_mentions cm where cm.comment_id = p_id and not (cm.mentioned_user_id = any (v_mentions));

  insert into public.activity_items (user_id, type, actor_id, group_id, title_id, comment_id)
    select u, 'mention', uid, c.group_id, c.title_id, p_id
    from unnest(v_mentions) u
    where not exists (select 1 from public.comment_mentions cm where cm.comment_id = p_id and cm.mentioned_user_id = u);
  insert into public.comment_mentions (comment_id, mentioned_user_id)
    select p_id, u from unnest(v_mentions) u
    on conflict (comment_id, mentioned_user_id) do nothing;
  return 'updated';
end $$;

-- Delete (F13): the author, or the group's owner. Immediate for everyone; its
-- Activity items disappear with it. Undo is restore_comment.
create function public.delete_comment(p_id uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.require_user();
begin
  update public.comments c set deleted_at = now(), deleted_by = uid
    where c.id = p_id and c.deleted_at is null
      and public.is_member(c.group_id)
      and (c.user_id = uid or public.is_owner(c.group_id));
  return found;
end $$;

-- Undo a delete, by whoever deleted it, within a few minutes (the toast gives
-- 8 seconds; the margin covers a slow connection).
create function public.restore_comment(p_id uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.require_user();
begin
  update public.comments c set deleted_at = null, deleted_by = null
    where c.id = p_id and c.deleted_by = uid and c.deleted_at > now() - interval '5 minutes'
      and public.is_member(c.group_id);
  return found;
end $$;

-- The mentions in a comment, with names, for turning <@id> back into @Name.
-- Names of people who've since left stay readable here (open question 10).
create function public.comment_mention_names(p_comment uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', cm.mentioned_user_id, 'name', coalesce(p.display_name, ''))), '[]'::jsonb)
  from public.comment_mentions cm
  left join public.profiles p on p.user_id = cm.mentioned_user_id
  where cm.comment_id = p_comment;
$$;

-- A conversation's comments, oldest first, for members only (F13). Other
-- people's spoilers come back without their text (DS 4.2.12: never in the page
-- until revealed); reveal_comment returns it on request.
--   p_before: the page of comments before this time (older ones, when scrolling up)
--   p_from: every comment from this time on (up to p_limit), for opening at the New divider
--   neither: the latest p_limit
create function public.conversation_comments(
  p_group uuid,
  p_title uuid,
  p_before timestamptz default null,
  p_from timestamptz default null,
  p_limit int default 30
) returns table (
  id uuid,
  user_id uuid,
  author_name text,
  body text,
  mentions jsonb,
  is_spoiler boolean,
  created_at timestamptz,
  edited_at timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := public.require_user();
  n int := least(greatest(coalesce(p_limit, 30), 1), 200);
begin
  if not public.is_member(p_group) then return; end if;
  return query
    select c.id, c.user_id, coalesce(p.display_name, ''),
      case when c.is_spoiler and c.user_id <> uid then null else c.body end,
      case when c.is_spoiler and c.user_id <> uid then '[]'::jsonb else public.comment_mention_names(c.id) end,
      c.is_spoiler, c.created_at, c.edited_at
    from (
      select * from public.comments x
      where x.group_id = p_group and x.title_id = p_title and x.deleted_at is null
        and (p_before is null or x.created_at < p_before)
        and (p_from is null or x.created_at >= p_from)
      order by
        case when p_from is null then x.created_at end desc,
        case when p_from is not null then x.created_at end asc
      limit n
    ) c
    left join public.profiles p on p.user_id = c.user_id
    order by c.created_at, c.id;
end $$;

-- One comment, for live updates and for revealing a spoiler. A spoiler's text
-- comes back only when p_reveal is true.
create function public.conversation_comment(p_id uuid, p_reveal boolean default false)
returns table (
  id uuid,
  group_id uuid,
  title_id uuid,
  user_id uuid,
  author_name text,
  body text,
  mentions jsonb,
  is_spoiler boolean,
  created_at timestamptz,
  edited_at timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := public.require_user();
begin
  return query
    select c.id, c.group_id, c.title_id, c.user_id, coalesce(p.display_name, ''),
      case when c.is_spoiler and c.user_id <> uid and not coalesce(p_reveal, false) then null else c.body end,
      case when c.is_spoiler and c.user_id <> uid and not coalesce(p_reveal, false) then '[]'::jsonb
        else public.comment_mention_names(c.id) end,
      c.is_spoiler, c.created_at, c.edited_at
    from public.comments c
    left join public.profiles p on p.user_id = c.user_id
    where c.id = p_id and c.deleted_at is null and public.is_member(c.group_id);
end $$;

-- Where the viewer is in a conversation: the comment count, when they last
-- read it (or joined the group, if never), and the first comment after that
-- from someone else. Empty for non-members.
create function public.conversation_state(p_group uuid, p_title uuid)
returns table (comment_count int, last_read_at timestamptz, first_unseen_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := public.require_user();
  since timestamptz;
begin
  if not public.is_member(p_group) then return; end if;
  select coalesce(r.last_read_at, m.joined_at) into since
    from public.group_members m
    left join public.conversation_reads r on r.user_id = m.user_id and r.group_id = m.group_id and r.title_id = p_title
    where m.group_id = p_group and m.user_id = uid;
  return query
    select
      (select count(*)::int from public.comments c
        where c.group_id = p_group and c.title_id = p_title and c.deleted_at is null),
      since,
      (select min(c.created_at) from public.comments c
        where c.group_id = p_group and c.title_id = p_title and c.deleted_at is null
          and c.user_id <> uid and c.created_at > since);
end $$;

-- Title detail (F6, DS 5.17): for each of your groups, its comment count, the
-- latest comment's time, and its 3 most recent comments (spoiler text
-- withheld), plus whether the title is on that group's shelf.
create function public.conversation_previews(p_title uuid)
returns table (group_id uuid, comment_count int, latest_at timestamptz, on_shelf boolean, recent jsonb)
language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := public.require_user();
begin
  return query
    select m.group_id,
      (select count(*)::int from public.comments c
        where c.group_id = m.group_id and c.title_id = p_title and c.deleted_at is null),
      (select max(c.created_at) from public.comments c
        where c.group_id = m.group_id and c.title_id = p_title and c.deleted_at is null),
      exists (
        select 1 from public.good_word_groups gwg
        join public.good_words gw on gw.id = gwg.good_word_id
        where gwg.group_id = m.group_id and gw.title_id = p_title
      ),
      coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', r.id, 'user_id', r.user_id, 'author_name', r.author_name, 'body', r.body,
          'mentions', r.mentions, 'is_spoiler', r.is_spoiler, 'created_at', r.created_at, 'edited_at', r.edited_at
        ) order by r.created_at)
        from (
          select c.id, c.user_id, coalesce(p.display_name, '') as author_name,
            case when c.is_spoiler and c.user_id <> uid then null else c.body end as body,
            case when c.is_spoiler and c.user_id <> uid then '[]'::jsonb else public.comment_mention_names(c.id) end as mentions,
            c.is_spoiler, c.created_at, c.edited_at
          from public.comments c
          left join public.profiles p on p.user_id = c.user_id
          where c.group_id = m.group_id and c.title_id = p_title and c.deleted_at is null
          order by c.created_at desc
          limit 3
        ) r
      ), '[]'::jsonb)
    from public.group_members m
    where m.user_id = uid;
end $$;

-- Comment counts for shelf cards (DS 4.2.2), per group and title, and whether
-- someone else has commented since you last read that conversation (or since
-- you joined, if never). Your groups only.
create function public.comment_counts(p_groups uuid[])
returns table (group_id uuid, title_id uuid, comment_count int, unseen boolean)
language sql stable security definer set search_path = '' as $$
  select c.group_id, c.title_id, count(*)::int,
    bool_or(c.user_id <> m.user_id and c.created_at > coalesce(r.last_read_at, m.joined_at))
  from public.group_members m
  join public.comments c on c.group_id = m.group_id and c.deleted_at is null
  left join public.conversation_reads r on r.user_id = m.user_id and r.group_id = c.group_id and r.title_id = c.title_id
  where m.user_id = (select auth.uid()) and m.group_id = any (coalesce(p_groups, '{}'))
  group by c.group_id, c.title_id;
$$;

-- Opening a conversation marks what was shown as seen (F13), and the Activity
-- items for those comments as read (F14).
create function public.mark_conversation_read(p_group uuid, p_title uuid, p_up_to timestamptz) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.require_user();
  up_to timestamptz := least(coalesce(p_up_to, now()), now());
begin
  if not public.is_member(p_group) then return; end if;
  insert into public.conversation_reads (user_id, group_id, title_id, last_read_at)
    values (uid, p_group, p_title, up_to)
    on conflict (user_id, group_id, title_id)
    do update set last_read_at = greatest(public.conversation_reads.last_read_at, excluded.last_read_at);
  update public.activity_items a set read_at = now()
    from public.comments c
    where a.user_id = uid and a.read_at is null and a.group_id = p_group and a.title_id = p_title
      and c.id = a.comment_id and c.created_at <= up_to;
end $$;

-- Activity (F14): your items from the last 90 days in groups you're still in,
-- newest first, without items for deleted comments. Actor names stay readable
-- after they leave the group. Comment text is included unless it's a spoiler.
create function public.my_activity(p_limit int default 200, p_unread_only boolean default false)
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
  read_at timestamptz
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
      coalesce(c.is_spoiler, false), a.created_at, a.read_at
    from public.activity_items a
    join public.groups g on g.id = a.group_id
    join public.group_members m on m.group_id = a.group_id and m.user_id = uid
    left join public.comments c on c.id = a.comment_id
    left join public.profiles p on p.user_id = a.actor_id
    where a.user_id = uid
      and a.created_at > now() - interval '90 days'
      and (a.comment_id is null or c.deleted_at is null)
      and (not coalesce(p_unread_only, false) or a.read_at is null)
    order by a.created_at desc
    limit least(greatest(coalesce(p_limit, 200), 1), 500);
end $$;

create function public.mark_activity_read(p_ids uuid[]) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.activity_items set read_at = now()
    where user_id = public.require_user() and read_at is null and id = any (coalesce(p_ids, '{}'));
end $$;

create function public.mark_all_activity_read() returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.activity_items set read_at = now() where user_id = public.require_user() and read_at is null;
end $$;

-- Opening a group's details marks its join items read (F14).
create function public.mark_group_joins_read(p_group uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.activity_items set read_at = now()
    where user_id = public.require_user() and group_id = p_group and type = 'group_join' and read_at is null;
end $$;

create function public.mark_spoiler_hint_seen() returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles set spoiler_hint_seen_at = coalesce(spoiler_hint_seen_at, now())
    where user_id = public.require_user();
end $$;

-- Putting in a good word for a title in a group makes you a participant in
-- that group's conversation about it (F13).
create function public.good_word_participant() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.conversation_participants (user_id, group_id, title_id)
    select gw.user_id, new.group_id, gw.title_id from public.good_words gw where gw.id = new.good_word_id
    on conflict (user_id, group_id, title_id) do nothing;
  return new;
end $$;

create trigger good_word_groups_participant after insert on public.good_word_groups
  for each row execute function public.good_word_participant();

insert into public.conversation_participants (user_id, group_id, title_id)
  select gw.user_id, gwg.group_id, gw.title_id
  from public.good_word_groups gwg join public.good_words gw on gw.id = gwg.good_word_id
  on conflict (user_id, group_id, title_id) do nothing;

-- Someone joined your group: an Activity item for the owner (F14).
create function public.group_join_activity() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.role = 'member' then
    insert into public.activity_items (user_id, type, actor_id, group_id)
      select m.user_id, 'group_join', new.user_id, new.group_id
      from public.group_members m
      where m.group_id = new.group_id and m.role = 'owner' and m.user_id <> new.user_id;
  end if;
  return new;
end $$;

create trigger group_members_join_activity after insert on public.group_members
  for each row execute function public.group_join_activity();

-- Leaving or being removed ends your part in that group's conversations and
-- removes its Activity items (F13, F14). Your comments stay, attributed.
create function public.forget_member_conversations() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.activity_items where user_id = old.user_id and group_id = old.group_id;
  delete from public.conversation_participants where user_id = old.user_id and group_id = old.group_id;
  delete from public.conversation_reads where user_id = old.user_id and group_id = old.group_id;
  return old;
end $$;

create trigger group_members_forget_conversations after delete on public.group_members
  for each row execute function public.forget_member_conversations();

-- Live updates (F13, F14) through Realtime Broadcast on private channels.
-- Messages carry only ids: the app fetches the comment through
-- conversation_comment, so spoiler text never travels until revealed.
create function public.broadcast_comment() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform realtime.send(
    jsonb_build_object('id', new.id, 'user_id', new.user_id, 'op',
      case when tg_op = 'INSERT' then 'insert' when new.deleted_at is not null then 'delete' else 'update' end),
    'comment',
    'conversation:' || new.group_id::text || ':' || new.title_id::text,
    true
  );
  return new;
end $$;

create trigger comments_broadcast after insert or update on public.comments
  for each row execute function public.broadcast_comment();

create function public.broadcast_activity() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform realtime.send(jsonb_build_object('type', new.type), 'activity', 'activity:' || new.user_id::text, true);
  return new;
end $$;

create trigger activity_items_broadcast after insert on public.activity_items
  for each row execute function public.broadcast_activity();

-- Who can listen: members of the conversation's group, and each person on
-- their own Activity channel. Nobody can send from the client.
create function public.can_hear(p_topic text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare
  parts text[] := string_to_array(coalesce(p_topic, ''), ':');
begin
  if parts[1] = 'activity' and cardinality(parts) = 2 then
    return parts[2] = (select auth.uid())::text;
  end if;
  if parts[1] = 'conversation' and cardinality(parts) = 3
    and parts[2] ~ '^[0-9a-f-]{36}$' and parts[3] ~ '^[0-9a-f-]{36}$' then
    return public.is_member(parts[2]::uuid);
  end if;
  return false;
exception when others then
  return false;
end $$;

create policy "realtime: my conversations and my activity" on realtime.messages
  for select to authenticated using (realtime.messages.extension = 'broadcast' and public.can_hear((select realtime.topic())));

-- Cleanup: deleted comments are purged once the Undo window has passed, and
-- Activity is kept for 90 days (F13, F14). pg_cron is Supabase's scheduler.
create extension if not exists pg_cron with schema pg_catalog;

create function public.purge_conversations() returns void
language sql security definer set search_path = '' as $$
  delete from public.comments where deleted_at < now() - interval '10 minutes';
  delete from public.activity_items where created_at < now() - interval '90 days';
$$;

select cron.schedule('purge-conversations', '*/10 * * * *', 'select public.purge_conversations()');

-- Only signed-in users call these; nobody calls the helpers directly.
revoke execute on function public.post_comment, public.edit_comment, public.delete_comment, public.restore_comment,
  public.conversation_comments, public.conversation_comment, public.conversation_state, public.conversation_previews,
  public.comment_counts, public.mark_conversation_read, public.my_activity, public.mark_activity_read,
  public.mark_all_activity_read, public.mark_group_joins_read, public.mark_spoiler_hint_seen from public, anon;
revoke execute on function public.comment_limit, public.mention_pattern, public.comment_plain_text,
  public.normalize_comment_body, public.touch_participant, public.comment_mention_names,
  public.good_word_participant, public.group_join_activity, public.forget_member_conversations,
  public.broadcast_comment, public.broadcast_activity, public.purge_conversations from public, anon, authenticated;
