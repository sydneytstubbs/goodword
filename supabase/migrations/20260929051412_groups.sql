-- Step 2: groups, members, invites (PRD F2, section 8). RLS on every table.
-- Reads go through RLS policies. Every write goes through a security-definer
-- function below, so the owner rules and limits (F2.1) can't be bypassed from
-- the client: there are no insert, update, or delete policies.

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 40),
  owner_id uuid not null references auth.users (id),
  color smallint not null check (color between 1 and 4),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  last_viewed_at timestamptz,
  welcome_seen_at timestamptz,
  join_prompt_dismissed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (group_id, user_id)
);
create index group_members_user on public.group_members (user_id);

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  code text not null unique,
  created_by uuid references auth.users (id) on delete set null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- One active (non-revoked) invite per group.
create unique index invites_one_active on public.invites (group_id) where revoked_at is null;

-- Join rate limiting (F2.4), per IP and per code. Service role only.
create table public.join_attempts (
  id bigint generated always as identity primary key,
  ip_hash text not null,
  code text not null,
  created_at timestamptz not null default now()
);
create index join_attempts_ip on public.join_attempts (ip_hash, created_at desc);
create index join_attempts_code on public.join_attempts (code, created_at desc);

alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.invites enable row level security;
alter table public.join_attempts enable row level security;

create trigger groups_touch before update on public.groups
  for each row execute function public.touch_updated_at();
create trigger group_members_touch before update on public.group_members
  for each row execute function public.touch_updated_at();
create trigger invites_touch before update on public.invites
  for each row execute function public.touch_updated_at();

-- Membership checks. Security definer so policies on group_members don't recurse.
create function public.is_member(gid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.group_members where group_id = gid and user_id = (select auth.uid()));
$$;

create function public.is_owner(gid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.group_members where group_id = gid and user_id = (select auth.uid()) and role = 'owner');
$$;

create function public.shares_group(other uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.group_members mine
    join public.group_members theirs on theirs.group_id = mine.group_id
    where mine.user_id = (select auth.uid()) and theirs.user_id = other
  );
$$;

create policy "groups: members read" on public.groups
  for select to authenticated using (public.is_member(id));

create policy "group_members: members read" on public.group_members
  for select to authenticated using (public.is_member(group_id));

create policy "invites: members read the active link" on public.invites
  for select to authenticated using (revoked_at is null and public.is_member(group_id));

-- Membership is visible to members (DS 5.14): co-members can read each other's profile.
create policy "profiles: co-members read" on public.profiles
  for select to authenticated using (public.shares_group(user_id));

-- 144 random bits, URL-safe (F2.3 asks for at least 128).
create function public.new_invite_code() returns text
language sql volatile set search_path = '' as $$
  select translate(encode(extensions.gen_random_bytes(18), 'base64'), '+/', '-_');
$$;

create function public.require_user() returns uuid
language plpgsql stable set search_path = '' as $$
declare uid uuid := (select auth.uid());
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  return uid;
end $$;

-- Limits (F2.1): 50 members per group, 20 groups per person.
create function public.group_limits() returns table (max_members int, max_groups int)
language sql immutable as $$ select 50, 20 $$;

create function public.create_group(p_id uuid, p_name text, p_color smallint)
returns text
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.require_user();
  lim record;
begin
  select * into lim from public.group_limits();
  perform pg_advisory_xact_lock(hashtext('groups:' || uid::text));
  if (select count(*) from public.group_members where user_id = uid) >= lim.max_groups then
    return 'too_many_groups';
  end if;
  insert into public.groups (id, name, owner_id, color) values (p_id, btrim(p_name), uid, p_color);
  insert into public.group_members (group_id, user_id, role, welcome_seen_at) values (p_id, uid, 'owner', now());
  insert into public.invites (group_id, code, created_by) values (p_id, public.new_invite_code(), uid);
  return 'created';
end $$;

create function public.rename_group(p_group uuid, p_name text) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  perform public.require_user();
  if not public.is_owner(p_group) then return false; end if;
  update public.groups set name = btrim(p_name) where id = p_group;
  return true;
end $$;

create function public.reset_invite(p_group uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.require_user();
  new_code text := public.new_invite_code();
begin
  if not public.is_owner(p_group) then return null; end if;
  update public.invites set revoked_at = now() where group_id = p_group and revoked_at is null;
  insert into public.invites (group_id, code, created_by) values (p_group, new_code, uid);
  return new_code;
end $$;

-- Returns: joined, already_member, invalid, expired, group_full, too_many_groups.
create function public.join_group(p_code text)
returns table (status text, group_id uuid)
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.require_user();
  inv public.invites;
  lim record;
begin
  select * into lim from public.group_limits();
  select * into inv from public.invites where code = p_code;
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

-- The owner leaving hands the group to the longest-standing member (F2.6);
-- the last member leaving deletes it. Returns: left, deleted, not_member.
-- Step 4 adds removing the leaver's good words from this shelf.
create function public.leave_group(p_group uuid) returns text
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
  delete from public.group_members where id = me.id;
  return 'left';
end $$;

create function public.remove_member(p_group uuid, p_user uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare uid uuid := public.require_user();
begin
  if not public.is_owner(p_group) or p_user = uid then return false; end if;
  delete from public.group_members where group_id = p_group and user_id = p_user;
  return found;
end $$;

create function public.delete_group(p_group uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  perform public.require_user();
  if not public.is_owner(p_group) then return false; end if;
  delete from public.groups where id = p_group;
  return true;
end $$;

create function public.mark_welcome_seen(p_group uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.group_members set welcome_seen_at = coalesce(welcome_seen_at, now())
    where group_id = p_group and user_id = public.require_user();
end $$;

-- Only signed-in users call these; nobody calls the helpers directly.
revoke execute on function public.create_group, public.rename_group, public.reset_invite, public.join_group,
  public.leave_group, public.remove_member, public.delete_group, public.mark_welcome_seen from public, anon;
revoke execute on function public.new_invite_code, public.group_limits from public, anon, authenticated;
