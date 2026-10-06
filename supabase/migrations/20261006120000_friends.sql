-- Step 14: friends (PRD F16.1, section 8), behind the home_enabled flag
-- (F16.10). Friends are mutual: a request becomes a friendship when the other
-- person accepts, or at once when someone accepts your friend link. Declining
-- or cancelling is silent and removes the request, so either person can ask
-- again (open question 13). No limits on friends or requests (question 15).
--
-- Additive only: with the flag off, nothing anyone sees changes.

-- The launch flag (F16.10), off by default. Slice 20 drops it.
alter table public.profiles add column home_enabled boolean not null default false;

-- The one-time "Add the people here you're not friends with yet" prompt.
alter table public.group_members add column friend_prompt_dismissed_at timestamptz;

-- Friend links live with group invites, so one landing validates both.
alter table public.invites add column kind text not null default 'group' check (kind in ('group', 'friend'));
alter table public.invites alter column group_id drop not null;
-- A group invite has a group; a friend link has none. `created_by` can become
-- null when its person deletes their account, which leaves the link dead.
alter table public.invites add constraint invites_kind_target
  check ((kind = 'group' and group_id is not null) or (kind = 'friend' and group_id is null));
-- One active friend link per person.
create unique index invites_one_friend_link on public.invites (created_by)
  where kind = 'friend' and revoked_at is null;

create policy "invites: my friend link" on public.invites
  for select to authenticated
  using (kind = 'friend' and revoked_at is null and created_by = (select auth.uid()));

-- One row per pair, ids in order, so a friendship can't disagree with itself.
create table public.friendships (
  id uuid primary key default gen_random_uuid(),
  user_low uuid not null references auth.users (id) on delete cascade,
  user_high uuid not null references auth.users (id) on delete cascade,
  status text not null check (status in ('pending', 'accepted')),
  requested_by uuid not null references auth.users (id) on delete cascade,
  accepted_at timestamptz,
  -- Made by the flip from shared groups (decision 4, slice 20).
  seeded boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_low, user_high),
  check (user_low < user_high),
  check (requested_by in (user_low, user_high)),
  check ((status = 'accepted') = (accepted_at is not null))
);
create index friendships_high on public.friendships (user_high);

alter table public.friendships enable row level security;

create trigger friendships_touch before update on public.friendships
  for each row execute function public.touch_updated_at();

-- Only its two people can read a friendship row. Writes go through the
-- functions below.
create policy "friendships: its two people read" on public.friendships
  for select to authenticated
  using ((select auth.uid()) in (user_low, user_high));

-- Accepted friends of a person. Internal: callable by the functions and
-- policies below, never by people, so nobody can list someone's friends.
create function public.friend_ids(p_user uuid) returns setof uuid
language sql stable security definer set search_path = '' as $$
  select case when f.user_low = p_user then f.user_high else f.user_low end
  from public.friendships f
  where f.status = 'accepted' and p_user in (f.user_low, f.user_high);
$$;

-- Is this person my friend (accepted)?
create function public.is_friend(other uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and f.user_low = least((select auth.uid()), other)
      and f.user_high = greatest((select auth.uid()), other)
  );
$$;

-- Am I in any friendship row with this person, accepted or pending?
create function public.has_friendship_row(other uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.friendships f
    where f.user_low = least((select auth.uid()), other)
      and f.user_high = greatest((select auth.uid()), other)
  );
$$;

-- Friends, and the other person in a pending request, can read each other's
-- profile (PRD 8): only the name is ever shown.
create policy "profiles: friends and requests read" on public.profiles
  for select to authenticated using (public.has_friendship_row(user_id));

-- Activity: friend requests and accepted requests have no group.
alter table public.activity_items alter column group_id drop not null;
alter table public.activity_items drop constraint activity_items_type_check;
alter table public.activity_items add constraint activity_items_type_check
  check (type in ('mention', 'comment', 'conversation_started', 'group_join', 'friend_request', 'friend_accepted'));
alter table public.activity_items add constraint activity_items_group_kind
  check ((type in ('friend_request', 'friend_accepted')) = (group_id is null));

drop policy "activity_items: own, in my groups" on public.activity_items;
create policy "activity_items: own, in my groups" on public.activity_items
  for select to authenticated
  using (user_id = (select auth.uid()) and (group_id is null or public.is_member(group_id)));

-- Group invites only: a friend link never joins a group.
create or replace function public.join_group(p_code text)
returns table (status text, group_id uuid)
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.require_user();
  inv public.invites;
  lim record;
begin
  select * into lim from public.group_limits();
  select * into inv from public.invites where code = p_code and kind = 'group';
  if not found then return query select 'invalid'::text, null::uuid; return; end if;
  if inv.revoked_at is not null then return query select 'expired'::text, null::uuid; return; end if;
  if exists (select 1 from public.group_members m where m.group_id = inv.group_id and m.user_id = uid) then
    return query select 'already_member'::text, inv.group_id; return;
  end if;
  perform pg_advisory_xact_lock(hashtext('group:' || inv.group_id::text));
  perform pg_advisory_xact_lock(hashtext('groups:' || uid::text));
  if (select count(*) from public.group_members m where m.group_id = inv.group_id) >= lim.max_members then
    return query select 'group_full'::text, inv.group_id; return;
  end if;
  if (select count(*) from public.group_members m where m.user_id = uid) >= lim.max_groups then
    return query select 'too_many_groups'::text, inv.group_id; return;
  end if;
  insert into public.group_members (group_id, user_id, role) values (inv.group_id, uid, 'member');
  return query select 'joined'::text, inv.group_id;
end $$;

-- Your friend link, made the first time you ask for it.
create function public.my_friend_link() returns text
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.require_user();
  found_code text;
begin
  perform pg_advisory_xact_lock(hashtext('friend_link:' || uid::text));
  select code into found_code from public.invites
    where kind = 'friend' and created_by = uid and revoked_at is null;
  if found_code is null then
    found_code := public.new_invite_code();
    insert into public.invites (kind, code, created_by) values ('friend', found_code, uid);
  end if;
  return found_code;
end $$;

-- Reset: the old link stops working at once (F16.1).
create function public.reset_friend_link() returns text
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.require_user();
  new_code text := public.new_invite_code();
begin
  perform pg_advisory_xact_lock(hashtext('friend_link:' || uid::text));
  update public.invites set revoked_at = now() where kind = 'friend' and created_by = uid and revoked_at is null;
  insert into public.invites (kind, code, created_by) values ('friend', new_code, uid);
  return new_code;
end $$;

-- Makes the pair friends, from a pending request or from nothing. The person
-- who didn't act gets a friend_accepted Activity item.
create function public.make_friends(p_me uuid, p_other uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.friendships as f (user_low, user_high, status, requested_by, accepted_at)
    values (least(p_me, p_other), greatest(p_me, p_other), 'accepted', p_other, now())
  on conflict (user_low, user_high) do update
    set status = 'accepted', accepted_at = coalesce(f.accepted_at, now());
  -- A request between them is answered.
  delete from public.activity_items
    where type = 'friend_request' and user_id in (p_me, p_other) and actor_id in (p_me, p_other);
  insert into public.activity_items (user_id, type, actor_id) values (p_other, 'friend_accepted', p_me);
end $$;

-- Accepting a friend link. Returns: friends, already_friends, self, invalid,
-- expired, and the link's person.
create function public.accept_friend_link(p_code text)
returns table (status text, friend_id uuid)
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.require_user();
  inv public.invites;
begin
  select * into inv from public.invites where code = p_code and kind = 'friend';
  if not found or inv.created_by is null then return query select 'invalid'::text, null::uuid; return; end if;
  if inv.revoked_at is not null then return query select 'expired'::text, inv.created_by; return; end if;
  if inv.created_by = uid then return query select 'self'::text, uid; return; end if;
  perform pg_advisory_xact_lock(hashtext('friends:' || least(uid, inv.created_by)::text || greatest(uid, inv.created_by)::text));
  if exists (
    select 1 from public.friendships f
    where f.user_low = least(uid, inv.created_by) and f.user_high = greatest(uid, inv.created_by) and f.status = 'accepted'
  ) then
    return query select 'already_friends'::text, inv.created_by; return;
  end if;
  perform public.make_friends(uid, inv.created_by);
  return query select 'friends'::text, inv.created_by;
end $$;

-- Asking someone from your groups (F16.1: no discovery beyond your groups).
-- Returns: requested, already_requested, friends (they'd already asked you, so
-- this accepts), already_friends, not_allowed, self.
create function public.request_friend(p_user uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.require_user();
  existing public.friendships;
begin
  if p_user = uid then return 'self'; end if;
  if not public.shares_group(p_user) then return 'not_allowed'; end if;
  perform pg_advisory_xact_lock(hashtext('friends:' || least(uid, p_user)::text || greatest(uid, p_user)::text));
  select * into existing from public.friendships where user_low = least(uid, p_user) and user_high = greatest(uid, p_user);
  if found then
    if existing.status = 'accepted' then return 'already_friends'; end if;
    if existing.requested_by = uid then return 'already_requested'; end if;
    perform public.make_friends(uid, p_user);
    return 'friends';
  end if;
  insert into public.friendships (user_low, user_high, status, requested_by)
    values (least(uid, p_user), greatest(uid, p_user), 'pending', uid);
  insert into public.activity_items (user_id, type, actor_id) values (p_user, 'friend_request', uid);
  return 'requested';
end $$;

-- Answering a request to you. Declining is silent: the request and its
-- Activity item are removed, and nobody is told (open question 13).
-- Returns: friends, declined, not_found.
create function public.respond_friend_request(p_user uuid, p_accept boolean) returns text
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.require_user();
begin
  perform pg_advisory_xact_lock(hashtext('friends:' || least(uid, p_user)::text || greatest(uid, p_user)::text));
  if not exists (
    select 1 from public.friendships
    where user_low = least(uid, p_user) and user_high = greatest(uid, p_user) and status = 'pending' and requested_by = p_user
  ) then
    return 'not_found';
  end if;
  if p_accept then
    perform public.make_friends(uid, p_user);
    return 'friends';
  end if;
  delete from public.friendships
    where user_low = least(uid, p_user) and user_high = greatest(uid, p_user) and status = 'pending';
  delete from public.activity_items where type = 'friend_request' and user_id = uid and actor_id = p_user;
  return 'declined';
end $$;

-- Cancelling a request you sent, silently, the same way.
create function public.cancel_friend_request(p_user uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.require_user();
begin
  delete from public.friendships
    where user_low = least(uid, p_user) and user_high = greatest(uid, p_user) and status = 'pending' and requested_by = uid;
  if not found then return false; end if;
  delete from public.activity_items where type = 'friend_request' and user_id = p_user and actor_id = uid;
  return true;
end $$;

-- Removing a friend: neither person is notified (F16.1).
create function public.remove_friend(p_user uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.require_user();
begin
  delete from public.friendships
    where user_low = least(uid, p_user) and user_high = greatest(uid, p_user) and status = 'accepted';
  return found;
end $$;

create function public.dismiss_friend_prompt(p_group uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.group_members set friend_prompt_dismissed_at = coalesce(friend_prompt_dismissed_at, now())
    where group_id = p_group and user_id = public.require_user();
end $$;

-- Opening Friends marks friend Activity items read, the way opening a group's
-- details marks its joins read.
create function public.mark_friend_activity_read() returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.activity_items set read_at = now()
    where user_id = public.require_user() and type in ('friend_request', 'friend_accepted') and read_at is null;
end $$;

-- Activity now includes friend items, which have no group. They show only to
-- people with the flag on, so the app is unchanged for everyone else.
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
  read_at timestamptz
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
      coalesce(c.is_spoiler, false), a.created_at, a.read_at
    from public.activity_items a
    left join public.groups g on g.id = a.group_id
    left join public.comments c on c.id = a.comment_id
    left join public.profiles p on p.user_id = a.actor_id
    where a.user_id = uid
      and (
        (a.group_id is not null and exists (select 1 from public.group_members m where m.group_id = a.group_id and m.user_id = uid))
        or (a.group_id is null and flag)
      )
      and a.created_at > now() - interval '90 days'
      and (a.comment_id is null or c.deleted_at is null)
      and (not coalesce(p_unread_only, false) or a.read_at is null)
    order by a.created_at desc
    limit least(greatest(coalesce(p_limit, 200), 1), 500);
end $$;

-- Internal helpers stay internal; people call the actions.
revoke execute on function public.friend_ids, public.make_friends from public, anon, authenticated;
revoke execute on function
  public.is_friend, public.has_friendship_row, public.my_friend_link, public.reset_friend_link,
  public.accept_friend_link, public.request_friend, public.respond_friend_request,
  public.cancel_friend_request, public.remove_friend, public.dismiss_friend_prompt,
  public.mark_friend_activity_read
from public, anon;
