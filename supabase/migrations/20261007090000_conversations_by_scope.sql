-- Step 18: conversations by scope (PRD F16.5, F16.6 rule 2, section 8),
-- behind the home_enabled flag (F16.10).
--
-- A conversation sits under one good word, or on one title in one group.
-- Group conversations work exactly as before: their functions are unchanged,
-- and every row they write is linked to its conversation by the triggers
-- below. Conversations under a good word get functions of their own (word_*),
-- and the shared ones (edit, delete, restore, one comment, Activity, mention
-- emails, live updates) learn the second scope.
--
-- Only good words shared with friends have a conversation under them (open
-- question 14). Everyone who can see such a good word can read and join its
-- conversation. If its author stops sharing it with friends, the conversation
-- is hidden, not deleted. Besides comment authors, only the good word's
-- author can delete comments under it (open question 16).
--
-- Additive (F16.10): comments, reads, and participants keep group_id and
-- title_id for group conversations; those columns go in a later slice.

-- 1. Conversations ---------------------------------------------------------

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  title_id uuid not null references public.titles (id),
  scope text not null check (scope in ('good_word', 'group')),
  group_id uuid references public.groups (id) on delete cascade,
  -- Under a good word: the good word, and its author. Taking a good word back
  -- detaches its conversation for the Undo window (orphaned_at) instead of
  -- deleting it, so Undo brings the comments back too; the cleanup job
  -- deletes it after that.
  good_word_id uuid references public.good_words (id) on delete set null,
  author_id uuid references auth.users (id) on delete cascade,
  orphaned_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint conversations_target check (
    (scope = 'group' and group_id is not null and good_word_id is null and author_id is null)
    or (scope = 'good_word' and group_id is null and author_id is not null and (good_word_id is not null or orphaned_at is not null))
  ),
  unique (good_word_id),
  unique (group_id, title_id)
);
create unique index conversations_author_title on public.conversations (author_id, title_id) where scope = 'good_word';

alter table public.conversations enable row level security;
create trigger conversations_touch before update on public.conversations
  for each row execute function public.touch_updated_at();

-- A group's conversation about a title, made the first time anything needs it.
create function public.group_conversation_id(p_group uuid, p_title uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  cid uuid;
begin
  select id into cid from public.conversations where group_id = p_group and title_id = p_title;
  if cid is null then
    insert into public.conversations (title_id, scope, group_id) values (p_title, 'group', p_group)
      on conflict (group_id, title_id) do nothing
      returning id into cid;
    if cid is null then
      select id into cid from public.conversations where group_id = p_group and title_id = p_title;
    end if;
  end if;
  return cid;
end $$;

-- 2. Link every conversation row to its conversation -------------------------

alter table public.comments add column conversation_id uuid references public.conversations (id) on delete cascade;
alter table public.comments alter column group_id drop not null;
alter table public.conversation_reads add column conversation_id uuid references public.conversations (id) on delete cascade;
alter table public.conversation_reads alter column group_id drop not null;
alter table public.conversation_participants add column conversation_id uuid references public.conversations (id) on delete cascade;
alter table public.conversation_participants alter column group_id drop not null;
alter table public.activity_items add column conversation_id uuid references public.conversations (id) on delete cascade;

-- Backfill: one group conversation per (group, title) anything refers to.
insert into public.conversations (title_id, scope, group_id)
  select distinct x.title_id, 'group', x.group_id from (
    select group_id, title_id from public.comments
    union select group_id, title_id from public.conversation_reads
    union select group_id, title_id from public.conversation_participants
  ) x
  on conflict (group_id, title_id) do nothing;

update public.comments c set conversation_id = v.id
  from public.conversations v where v.group_id = c.group_id and v.title_id = c.title_id and c.conversation_id is null;
update public.conversation_reads r set conversation_id = v.id
  from public.conversations v where v.group_id = r.group_id and v.title_id = r.title_id and r.conversation_id is null;
update public.conversation_participants p set conversation_id = v.id
  from public.conversations v where v.group_id = p.group_id and v.title_id = p.title_id and p.conversation_id is null;
update public.activity_items a set conversation_id = c.conversation_id
  from public.comments c where c.id = a.comment_id and a.conversation_id is null;

-- Rows written the old way (group and title) are linked as they're written.
create function public.link_group_conversation() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.conversation_id is null and new.group_id is not null then
    new.conversation_id := public.group_conversation_id(new.group_id, new.title_id);
  end if;
  return new;
end $$;

create trigger comments_link_conversation before insert on public.comments
  for each row execute function public.link_group_conversation();
create trigger conversation_reads_link_conversation before insert on public.conversation_reads
  for each row execute function public.link_group_conversation();
create trigger conversation_participants_link_conversation before insert on public.conversation_participants
  for each row execute function public.link_group_conversation();

create function public.link_activity_conversation() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.conversation_id is null and new.comment_id is not null then
    new.conversation_id := (select c.conversation_id from public.comments c where c.id = new.comment_id);
  end if;
  return new;
end $$;

create trigger activity_items_link_conversation before insert on public.activity_items
  for each row execute function public.link_activity_conversation();

alter table public.comments alter column conversation_id set not null;
alter table public.conversation_reads alter column conversation_id set not null;
alter table public.conversation_participants alter column conversation_id set not null;
alter table public.conversation_reads add constraint conversation_reads_user_conversation unique (user_id, conversation_id);
alter table public.conversation_participants add constraint conversation_participants_user_conversation unique (user_id, conversation_id);
create index comments_by_conversation on public.comments (conversation_id, created_at);
create index activity_items_conversation on public.activity_items (conversation_id);

-- Activity under a good word has no group, but always a conversation.
alter table public.activity_items drop constraint activity_items_group_kind;
alter table public.activity_items add constraint activity_items_group_kind check (
  case when type in ('friend_request', 'friend_accepted') then group_id is null and conversation_id is null
       when type = 'group_join' then group_id is not null
       else group_id is not null or conversation_id is not null end
);

-- 3. Taking a good word back, and Undo ---------------------------------------

create function public.detach_word_conversation() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.conversations set good_word_id = null, orphaned_at = now() where good_word_id = old.id;
  return old;
end $$;

create trigger good_words_detach_conversation before delete on public.good_words
  for each row execute function public.detach_word_conversation();

-- Putting the same good word back within the Undo window brings its conversation back.
create function public.reattach_word_conversation() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.conversations set good_word_id = new.id, orphaned_at = null
    where scope = 'good_word' and author_id = new.user_id and title_id = new.title_id
      and good_word_id is null and orphaned_at > now() - interval '10 minutes';
  return new;
end $$;

create trigger good_words_reattach_conversation after insert on public.good_words
  for each row execute function public.reattach_word_conversation();

-- 4. Who can see a conversation (F16.6 rule 2) -------------------------------

-- Whether a person can see a good word's conversation: they can see the good
-- word (F16.6 rule 1) and it's shared with friends (open question 14).
-- Internal, for deciding about other people (mentions, Activity, email).
create function public.word_visible_to(p_user uuid, p_good_word uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_user is not null and exists (
    select 1 from public.good_words gw
    where gw.id = p_good_word and gw.friends_shared_at is not null
      and (
        gw.user_id = p_user
        or exists (
          select 1 from public.friendships f
          where f.status = 'accepted' and f.user_low = least(p_user, gw.user_id) and f.user_high = greatest(p_user, gw.user_id)
        )
        or exists (
          select 1 from public.good_word_groups gwg
          join public.group_members m on m.group_id = gwg.group_id and m.user_id = p_user
          where gwg.good_word_id = gw.id
        )
      )
  );
$$;

-- The same, for the person asking.
create function public.word_visible(p_good_word uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.word_visible_to((select auth.uid()), p_good_word);
$$;

create function public.can_view_conversation(p_conversation uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.conversations v
    where v.id = p_conversation
      and case when v.scope = 'group' then public.is_member(v.group_id)
               else v.good_word_id is not null and public.word_visible(v.good_word_id) end
  );
$$;

create policy "conversations: can view" on public.conversations
  for select to authenticated using (public.can_view_conversation(id));

create policy "comments: under good words I can see" on public.comments
  for select to authenticated
  using (deleted_at is null and group_id is null and public.can_view_conversation(conversation_id));

-- A comment the person asking can see: in their group, or under a good word they can see.
create or replace function public.comment_visible(c uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.comments cm
    where cm.id = c and cm.deleted_at is null
      and case when cm.group_id is not null then public.is_member(cm.group_id)
               else public.can_view_conversation(cm.conversation_id) end
  );
$$;

-- 5. Conversations under a good word -----------------------------------------

-- The conversation under a good word, made on its first comment.
create function public.word_conversation_id(p_good_word uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  gw public.good_words;
  cid uuid;
begin
  select * into gw from public.good_words where id = p_good_word;
  if not found then return null; end if;
  select id into cid from public.conversations where good_word_id = p_good_word;
  if cid is null then
    -- A conversation left from taking this good word back, past the Undo window, goes now.
    delete from public.conversations
      where scope = 'good_word' and author_id = gw.user_id and title_id = gw.title_id and good_word_id is null;
    insert into public.conversations (title_id, scope, good_word_id, author_id)
      values (gw.title_id, 'good_word', gw.id, gw.user_id)
      on conflict do nothing
      returning id into cid;
    if cid is null then
      select id into cid from public.conversations where good_word_id = p_good_word;
    end if;
    -- The good word's author hears about every comment under it (F16.9).
    if cid is not null then
      insert into public.conversation_participants (user_id, title_id, conversation_id)
        values (gw.user_id, gw.title_id, cid)
        on conflict (user_id, conversation_id) do nothing;
    end if;
  end if;
  return cid;
end $$;

-- Whether the author of a comment already knows someone: a friend, someone in
-- a group with them, or someone who's commented in this conversation. Only
-- those names are ever written out in plain text (DS 4.2.11).
create function public.knows(p_user uuid, p_other uuid, p_conversation uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
      select 1 from public.friendships f
      where f.status = 'accepted' and f.user_low = least(p_user, p_other) and f.user_high = greatest(p_user, p_other)
    )
    or exists (
      select 1 from public.group_members a join public.group_members b on b.group_id = a.group_id
      where a.user_id = p_user and b.user_id = p_other
    )
    or exists (
      select 1 from public.comments c where c.conversation_id = p_conversation and c.user_id = p_other and c.deleted_at is null
    );
$$;

-- Mentions under a good word (F16.5): only people who can see it, not
-- yourself, at most 10. Anything else becomes plain text: the name if you
-- already know them, otherwise just "@", so an id never reveals a name.
create function public.normalize_word_comment_body(p_good_word uuid, p_conversation uuid, p_author uuid, p_body text)
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
    if who <> p_author and public.word_visible_to(who, p_good_word)
      and (who = any (kept) or cardinality(kept) < 10) then
      if not who = any (kept) then kept := kept || who; end if;
      result := result || marker;
    else
      result := result || '@' || coalesce((
        select p.display_name from public.profiles p
        where p.user_id = who and public.knows(p_author, who, p_conversation)
      ), '');
    end if;
    rest := substr(rest, pos + char_length(marker));
  end loop;
  return query select result || rest, kept;
end $$;

-- Mentions in either kind of conversation.
create function public.normalize_conversation_body(p_conversation uuid, p_author uuid, p_body text)
returns table (body text, mentions uuid[])
language plpgsql stable security definer set search_path = '' as $$
declare
  v public.conversations;
begin
  select * into v from public.conversations where id = p_conversation;
  if v.scope = 'group' then
    return query select n.body, n.mentions from public.normalize_comment_body(v.group_id, p_author, p_body) n;
  else
    return query select n.body, n.mentions from public.normalize_word_comment_body(v.good_word_id, p_conversation, p_author, p_body) n;
  end if;
end $$;

-- Post a comment under a good word (F16.5). Like post_comment: the id comes
-- from the client, so a retried send never makes a duplicate. Returns
-- created, exists, not_visible, empty, too_long, rate_limited.
--
-- Activity (F16.9): each mentioned person gets a mention item; everyone else
-- taking part (the good word's author, and people who've commented) who can
-- still see it gets a comment item. Nobody gets two, and never for their own.
create function public.post_word_comment(p_id uuid, p_good_word uuid, p_body text, p_spoiler boolean)
returns text
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.require_user();
  gw public.good_words;
  cid uuid;
  v_body text;
  v_mentions uuid[];
  plain text;
begin
  if not public.word_visible(p_good_word) then return 'not_visible'; end if;
  if exists (select 1 from public.comments where id = p_id) then
    return case when exists (select 1 from public.comments where id = p_id and user_id = uid) then 'exists' else 'not_visible' end;
  end if;
  select * into gw from public.good_words where id = p_good_word;

  perform pg_advisory_xact_lock(hashtext('comments:' || uid::text));
  if (select count(*) from public.comments
      where user_id = uid and created_at > now() - interval '10 minutes') >= public.comment_limit() then
    return 'rate_limited';
  end if;

  perform pg_advisory_xact_lock(hashtext('word:' || p_good_word::text));
  cid := public.word_conversation_id(p_good_word);
  select n.body, n.mentions into v_body, v_mentions from public.normalize_word_comment_body(p_good_word, cid, uid, p_body) n;
  plain := btrim(public.comment_plain_text(v_body));
  if char_length(plain) = 0 then return 'empty'; end if;
  if char_length(plain) > 500 or char_length(v_body) > 1000 then return 'too_long'; end if;

  insert into public.comments (id, group_id, title_id, user_id, body, is_spoiler, conversation_id)
    values (p_id, null, gw.title_id, uid, v_body, coalesce(p_spoiler, false), cid);
  insert into public.comment_mentions (comment_id, mentioned_user_id)
    select p_id, u from unnest(v_mentions) u;
  insert into public.conversation_participants (user_id, title_id, conversation_id)
    values (uid, gw.title_id, cid)
    on conflict (user_id, conversation_id) do nothing;

  insert into public.activity_items (user_id, type, actor_id, title_id, comment_id, conversation_id)
    select u, 'mention', uid, gw.title_id, p_id, cid from unnest(v_mentions) u;
  insert into public.activity_items (user_id, type, actor_id, title_id, comment_id, conversation_id)
    select cp.user_id, 'comment', uid, gw.title_id, p_id, cid
    from public.conversation_participants cp
    where cp.conversation_id = cid and not cp.muted
      and cp.user_id <> uid and not (cp.user_id = any (v_mentions))
      and public.word_visible_to(cp.user_id, p_good_word);
  return 'created';
end $$;

-- Where the person asking is in a good word's conversation: who it's under,
-- the comment count, when they last read it (or when the good word was
-- shared with friends, if never), and the first comment after that from
-- someone else. Empty if they can't see it.
create function public.word_conversation_state(p_good_word uuid)
returns table (
  conversation_id uuid,
  author_id uuid,
  author_name text,
  title_id uuid,
  comment_count int,
  last_read_at timestamptz,
  first_unseen_at timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := public.require_user();
  gw public.good_words;
  cid uuid;
  since timestamptz;
begin
  if not public.word_visible(p_good_word) then return; end if;
  select * into gw from public.good_words where id = p_good_word;
  select id into cid from public.conversations where good_word_id = p_good_word;
  select coalesce((select r.last_read_at from public.conversation_reads r where r.user_id = uid and r.conversation_id = cid), gw.friends_shared_at)
    into since;
  return query
    select cid, gw.user_id, coalesce((select p.display_name from public.profiles p where p.user_id = gw.user_id), ''), gw.title_id,
      (select count(*)::int from public.comments c where c.conversation_id = cid and c.deleted_at is null),
      since,
      (select min(c.created_at) from public.comments c
        where c.conversation_id = cid and c.deleted_at is null and c.user_id <> uid and c.created_at > since);
end $$;

-- A good word's comments, oldest first, as conversation_comments does for a group.
create function public.word_comments(
  p_good_word uuid,
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
  cid uuid;
begin
  if not public.word_visible(p_good_word) then return; end if;
  select v.id into cid from public.conversations v where v.good_word_id = p_good_word;
  if cid is null then return; end if;
  return query
    select c.id, c.user_id, coalesce(p.display_name, ''),
      case when c.is_spoiler and c.user_id <> uid then null else c.body end,
      case when c.is_spoiler and c.user_id <> uid then '[]'::jsonb else public.comment_mention_names(c.id) end,
      c.is_spoiler, c.created_at, c.edited_at
    from (
      select * from public.comments x
      where x.conversation_id = cid and x.deleted_at is null
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

-- Opening a good word's conversation marks what was shown as seen, and its
-- Activity items read (F13, F14).
create function public.mark_word_read(p_good_word uuid, p_up_to timestamptz) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.require_user();
  up_to timestamptz := least(coalesce(p_up_to, now()), now());
  cid uuid;
  v_title uuid;
begin
  if not public.word_visible(p_good_word) then return; end if;
  select v.id, v.title_id into cid, v_title from public.conversations v where v.good_word_id = p_good_word;
  if cid is null then return; end if;
  insert into public.conversation_reads (user_id, title_id, conversation_id, last_read_at)
    values (uid, v_title, cid, up_to)
    on conflict (user_id, conversation_id)
    do update set last_read_at = greatest(public.conversation_reads.last_read_at, excluded.last_read_at);
  update public.activity_items a set read_at = now()
    from public.comments c
    where a.user_id = uid and a.read_at is null and a.conversation_id = cid
      and c.id = a.comment_id and c.created_at <= up_to;
end $$;

-- Who you can mention under a good word (DS 4.2.11): people who can see it
-- and whom you already know, so the list never reveals the author's friends.
create function public.word_mention_people(p_good_word uuid) returns table (id uuid, name text)
language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := public.require_user();
  cid uuid;
begin
  if not public.word_visible(p_good_word) then return; end if;
  select v.id into cid from public.conversations v where v.good_word_id = p_good_word;
  return query
    select k.pid, coalesce(p.display_name, '')
    from (
      select gw.user_id as pid from public.good_words gw where gw.id = p_good_word
      union select case when f.user_low = uid then f.user_high else f.user_low end
        from public.friendships f where f.status = 'accepted' and (f.user_low = uid or f.user_high = uid)
      union select b.user_id from public.group_members a join public.group_members b on b.group_id = a.group_id where a.user_id = uid
      union select c.user_id from public.comments c where cid is not null and c.conversation_id = cid and c.deleted_at is null
    ) k
    left join public.profiles p on p.user_id = k.pid
    where k.pid <> uid and public.word_visible_to(k.pid, p_good_word)
    order by 2;
end $$;

-- 6. Shared by both kinds -----------------------------------------------------

-- One comment, for live updates and for revealing a spoiler: now in either
-- kind of conversation, with which one it's in.
drop function public.conversation_comment(uuid, boolean);
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
  edited_at timestamptz,
  conversation_id uuid,
  good_word_id uuid
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
      c.is_spoiler, c.created_at, c.edited_at, c.conversation_id, v.good_word_id
    from public.comments c
    join public.conversations v on v.id = c.conversation_id
    left join public.profiles p on p.user_id = c.user_id
    where c.id = p_id and c.deleted_at is null and public.comment_visible(c.id);
end $$;

-- Edit your own comment, in either kind of conversation (F13).
create or replace function public.edit_comment(p_id uuid, p_body text, p_spoiler boolean) returns text
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.require_user();
  c public.comments;
  v_body text;
  v_mentions uuid[];
  plain text;
begin
  select * into c from public.comments where id = p_id and user_id = uid and deleted_at is null;
  if not found or not public.comment_visible(p_id) then return 'missing'; end if;
  select n.body, n.mentions into v_body, v_mentions from public.normalize_conversation_body(c.conversation_id, uid, p_body) n;
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

  insert into public.activity_items (user_id, type, actor_id, group_id, title_id, comment_id, conversation_id)
    select u, 'mention', uid, c.group_id, c.title_id, p_id, c.conversation_id
    from unnest(v_mentions) u
    where not exists (select 1 from public.comment_mentions cm where cm.comment_id = p_id and cm.mentioned_user_id = u);
  insert into public.comment_mentions (comment_id, mentioned_user_id)
    select p_id, u from unnest(v_mentions) u
    on conflict (comment_id, mentioned_user_id) do nothing;
  return 'updated';
end $$;

-- Delete (F13, F16.5): the author; in a group, the group's owner; under a
-- good word, the good word's author (open question 16).
create or replace function public.delete_comment(p_id uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.require_user();
begin
  update public.comments c set deleted_at = now(), deleted_by = uid
    from public.conversations v
    where c.id = p_id and c.deleted_at is null and v.id = c.conversation_id
      and public.comment_visible(c.id)
      and (
        c.user_id = uid
        or (v.scope = 'group' and public.is_owner(v.group_id))
        or (v.scope = 'good_word' and v.author_id = uid)
      );
  return found;
end $$;

create or replace function public.restore_comment(p_id uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.require_user();
begin
  update public.comments c set deleted_at = null, deleted_by = null
    from public.conversations v
    where c.id = p_id and c.deleted_by = uid and c.deleted_at > now() - interval '5 minutes'
      and v.id = c.conversation_id
      and case when v.scope = 'group' then public.is_member(v.group_id)
               else v.good_word_id is not null and public.word_visible(v.good_word_id) end;
  return found;
end $$;

-- Activity (F14, F16.9): as before, plus comments and mentions under good
-- words you can still see (with the flag). Adds which good word, and whose.
drop function public.my_activity(int, boolean);
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
  read_at timestamptz,
  good_word_id uuid,
  word_author_id uuid,
  word_author_name text
)
language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := public.require_user();
  flag boolean := coalesce((select pr.home_enabled from public.profiles pr where pr.user_id = uid), false);
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
        or (a.group_id is null and a.conversation_id is null and flag)
        or (a.group_id is null and v.id is not null and flag and v.good_word_id is not null and public.word_visible(v.good_word_id))
      )
      and a.created_at > now() - interval '90 days'
      and (a.comment_id is null or c.deleted_at is null)
      and (not coalesce(p_unread_only, false) or a.read_at is null)
    order by a.created_at desc
    limit least(greatest(coalesce(p_limit, 200), 1), 500);
end $$;

-- Live updates (F16.9): group comments on their conversation topic, as
-- before; comments under a good word on word:<good word>, which only people
-- who can see its conversation can join. Messages carry ids only.
create or replace function public.broadcast_comment() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v public.conversations;
begin
  select * into v from public.conversations where id = new.conversation_id;
  if v.scope = 'good_word' and v.good_word_id is null then return new; end if;
  perform realtime.send(
    jsonb_build_object('id', new.id, 'user_id', new.user_id, 'op',
      case when tg_op = 'INSERT' then 'insert' when new.deleted_at is not null then 'delete' else 'update' end),
    'comment',
    case when v.scope = 'group' then 'conversation:' || new.group_id::text || ':' || new.title_id::text
         else 'word:' || v.good_word_id::text end,
    true
  );
  return new;
end $$;

create or replace function public.can_hear(p_topic text) returns boolean
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
  if parts[1] = 'shelf' and cardinality(parts) = 2 and parts[2] ~ '^[0-9a-f-]{36}$' then
    return public.is_member(parts[2]::uuid);
  end if;
  if parts[1] = 'friends' and cardinality(parts) = 2 and parts[2] ~ '^[0-9a-f-]{36}$' then
    return public.is_friend(parts[2]::uuid);
  end if;
  if parts[1] = 'word' and cardinality(parts) = 2 and parts[2] ~ '^[0-9a-f-]{36}$' then
    return public.word_visible(parts[2]::uuid);
  end if;
  return false;
exception when others then
  return false;
end $$;

-- Mention emails cover both kinds of conversation (F16.9), one email per
-- conversation. Under a good word there's no group: the email names whose
-- good word it is instead.
drop function public.email_mentions_due(interval, uuid[]);
create function public.email_mentions_due(p_window interval default interval '10 minutes', p_only uuid[] default null)
returns table (
  user_id uuid,
  email text,
  group_id uuid,
  group_name text,
  title jsonb,
  item_ids uuid[],
  comments jsonb,
  good_word_id uuid,
  word_author_id uuid,
  word_author_name text
)
language plpgsql security definer set search_path = '' as $$
begin
  update public.activity_items a set email_handled_at = now()
    where a.type = 'mention' and a.email_handled_at is null
      and (p_only is null or a.user_id = any (p_only))
      and (
        a.read_at is not null
        or not exists (select 1 from public.comments c where c.id = a.comment_id and c.deleted_at is null)
        or (a.group_id is not null and not exists (select 1 from public.group_members m where m.group_id = a.group_id and m.user_id = a.user_id))
        or (a.group_id is null and not exists (
          select 1 from public.conversations v
          where v.id = a.conversation_id and v.good_word_id is not null and public.word_visible_to(a.user_id, v.good_word_id)
        ))
        or exists (select 1 from public.notification_prefs np where np.user_id = a.user_id and not np.mention_email)
        or exists (select 1 from public.conversation_reads r
          join public.comments c on c.id = a.comment_id
          where r.user_id = a.user_id and r.conversation_id = a.conversation_id and r.last_read_at >= c.created_at)
      );

  return query
    with pending as (
      select a.id, a.user_id, a.conversation_id, a.group_id, a.title_id, a.created_at, c.id as comment_id, c.created_at as comment_at,
        c.is_spoiler, c.body, c.user_id as author_id
      from public.activity_items a
      join public.comments c on c.id = a.comment_id and c.deleted_at is null
      where a.type = 'mention' and a.email_handled_at is null and a.read_at is null
        and (p_only is null or a.user_id = any (p_only))
    ),
    batches as (
      select p.user_id, p.conversation_id, min(p.created_at) as oldest
      from pending p group by 1, 2
    )
    select r.user_id, r.email, v.group_id, g.name,
      jsonb_build_object('id', t.id, 'tmdb_id', t.tmdb_id, 'type', t.media_type, 'title', t.title, 'year', t.year,
        'poster_path', t.poster_path, 'accent', t.accent),
      array(select p.id from pending p where p.user_id = b.user_id and p.conversation_id = b.conversation_id
        order by p.comment_at),
      -- Spoiler text never leaves the database (DS 4.2.12).
      (select jsonb_agg(jsonb_build_object(
          'id', p.comment_id,
          'author', coalesce(ap.display_name, ''),
          'body', case when p.is_spoiler then null else public.comment_plain_text(p.body) end,
          'is_spoiler', p.is_spoiler,
          'created_at', p.comment_at
        ) order by p.comment_at)
        from pending p
        left join public.profiles ap on ap.user_id = p.author_id
        where p.user_id = b.user_id and p.conversation_id = b.conversation_id),
      v.good_word_id, v.author_id, wa.display_name
    from batches b
    join public.conversations v on v.id = b.conversation_id
    join public.email_recipients(p_only) r on r.user_id = b.user_id
    left join public.groups g on g.id = v.group_id
    left join public.profiles wa on wa.user_id = v.author_id
    join public.titles t on t.id = v.title_id
    where b.oldest <= now() - p_window
      and (v.scope = 'group' or v.good_word_id is not null)
      and not public.email_quiet(r.timezone);
end $$;

-- Home's conversation row (PRD F16.3, F16.5): for each title, the comments
-- you can see in your groups' conversations and under good words you can see,
-- whether any are unseen, and the newest one (spoilers without text), with
-- the conversation it's in.
create function public.home_conversations(p_titles uuid[])
returns table (
  title_id uuid,
  comment_count int,
  unseen boolean,
  latest_comment_id uuid,
  latest_group_id uuid,
  latest_good_word_id uuid,
  latest_author_name text,
  latest_body text,
  latest_mentions jsonb,
  latest_is_spoiler boolean
)
language sql stable security definer set search_path = '' as $$
  with uid as (select (select auth.uid()) as id),
  visible as (
    select v.id, v.title_id, v.group_id, v.good_word_id,
      coalesce(r.last_read_at,
        case when v.scope = 'group' then (select m.joined_at from public.group_members m where m.group_id = v.group_id and m.user_id = (select id from uid))
             else (select gw.friends_shared_at from public.good_words gw where gw.id = v.good_word_id) end) as since
    from public.conversations v
    left join public.conversation_reads r on r.conversation_id = v.id and r.user_id = (select id from uid)
    where v.title_id = any (coalesce(p_titles, '{}'))
      and case when v.scope = 'group' then public.is_member(v.group_id)
               else v.good_word_id is not null and public.word_visible(v.good_word_id) end
  ),
  counted as (
    select vi.title_id, count(c.id)::int as n,
      coalesce(bool_or(c.user_id <> (select id from uid) and c.created_at > vi.since), false) as unseen
    from visible vi
    join public.comments c on c.conversation_id = vi.id and c.deleted_at is null
    group by vi.title_id
  ),
  latest as (
    select distinct on (vi.title_id) vi.title_id, c.id, vi.group_id, vi.good_word_id, c.user_id, c.body, c.is_spoiler
    from visible vi
    join public.comments c on c.conversation_id = vi.id and c.deleted_at is null
    order by vi.title_id, c.created_at desc
  )
  select k.title_id, k.n, k.unseen, l.id, l.group_id, l.good_word_id, coalesce(p.display_name, ''),
    case when l.is_spoiler then null else l.body end,
    case when l.is_spoiler then '[]'::jsonb else public.comment_mention_names(l.id) end,
    l.is_spoiler
  from counted k
  join latest l on l.title_id = k.title_id
  left join public.profiles p on p.user_id = l.user_id
  where (select id from uid) is not null;
$$;

-- Deleted comments, Activity after 90 days, and conversations whose good
-- word was taken back and not put back within the Undo window.
create or replace function public.purge_conversations() returns void
language sql security definer set search_path = '' as $$
  delete from public.comments where deleted_at < now() - interval '10 minutes';
  delete from public.activity_items where created_at < now() - interval '90 days';
  delete from public.conversations where good_word_id is null and orphaned_at < now() - interval '10 minutes';
$$;

-- People call these; the rest are internal.
revoke execute on function public.post_word_comment, public.word_conversation_state, public.word_comments,
  public.mark_word_read, public.word_mention_people, public.conversation_comment, public.my_activity,
  public.home_conversations, public.can_view_conversation, public.word_visible from public, anon;
revoke execute on function public.group_conversation_id, public.link_group_conversation, public.link_activity_conversation,
  public.detach_word_conversation, public.reattach_word_conversation, public.word_visible_to, public.word_conversation_id,
  public.knows, public.normalize_word_comment_body, public.normalize_conversation_body from public, anon, authenticated;
revoke execute on function public.email_mentions_due from public, anon, authenticated;
grant execute on function public.email_mentions_due to service_role;
