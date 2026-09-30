-- Step 10: the P1 extras (PRD 12, slice 10). Streaming services, share my
-- shelf, live new good words on a shelf, and the weekend prompt email.

-- Streaming services you have (F11, F5.4 "On my services"), per region,
-- since a service's TMDB id can differ by country. Your own row only.
create table public.streaming_services (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  region text not null check (region ~ '^[A-Z]{2}$'),
  provider_ids int[] not null default '{}' check (cardinality(provider_ids) <= 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, region)
);
alter table public.streaming_services enable row level security;
create trigger streaming_services_touch before update on public.streaming_services
  for each row execute function public.touch_updated_at();

create policy "streaming_services: read own" on public.streaming_services
  for select to authenticated using (user_id = (select auth.uid()));

create function public.set_streaming_services(p_region text, p_providers int[]) returns boolean
language plpgsql security definer set search_path = '' as $$
declare uid uuid := public.require_user();
begin
  if p_region !~ '^[A-Z]{2}$' or cardinality(coalesce(p_providers, '{}')) > 100 then return false; end if;
  insert into public.streaming_services (user_id, region, provider_ids)
    values (uid, p_region, (select coalesce(array_agg(distinct p order by p), '{}') from unnest(p_providers) p where p > 0))
    on conflict (user_id, region) do update set provider_ids = excluded.provider_ids;
  return true;
end $$;

-- Share my shelf (F9, DS 5.14): off by default. One row per person; turning
-- it off or resetting it invalidates the old link immediately. Tokens carry
-- 144 random bits (10.4). Read your own row; nobody else reads the table.
create table public.share_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  token text not null unique,
  enabled boolean not null default false,
  revoked_at timestamptz,
  view_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.share_links enable row level security;
create trigger share_links_touch before update on public.share_links
  for each row execute function public.touch_updated_at();

create policy "share_links: read own" on public.share_links
  for select to authenticated using (user_id = (select auth.uid()));

-- Turn your link on or off. Turning it on makes a new link, so a link you
-- turned off never works again.
create function public.set_share_link(p_on boolean) returns text
language plpgsql security definer set search_path = '' as $$
declare uid uuid := public.require_user();
begin
  insert into public.share_links (user_id, token, enabled)
    values (uid, public.new_invite_code(), coalesce(p_on, false))
    on conflict (user_id) do update set
      token = case when coalesce(p_on, false) and not public.share_links.enabled then public.new_invite_code() else public.share_links.token end,
      view_count = case when coalesce(p_on, false) and not public.share_links.enabled then 0 else public.share_links.view_count end,
      enabled = coalesce(p_on, false),
      revoked_at = case when coalesce(p_on, false) then public.share_links.revoked_at else now() end;
  return (select token from public.share_links where user_id = uid);
end $$;

-- A new link; the old one stops working.
create function public.reset_share_link() returns text
language plpgsql security definer set search_path = '' as $$
declare uid uuid := public.require_user();
begin
  update public.share_links set token = public.new_invite_code(), revoked_at = now(), view_count = 0 where user_id = uid;
  return (select token from public.share_links where user_id = uid);
end $$;

-- The shared page (J7), for anyone with the link: the owner's name, and
-- their own good words (poster, title, year, their note), newest first.
-- Never groups, other people, or other people's notes. Counts the view.
create function public.shared_shelf(p_token text)
returns table (owner_name text, title jsonb, note text, created_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare
  link public.share_links;
begin
  select * into link from public.share_links s where s.token = p_token and s.enabled;
  if not found then return; end if;
  update public.share_links set view_count = view_count + 1 where id = link.id;
  return query
    select coalesce(p.display_name, ''),
      jsonb_build_object('tmdb_id', t.tmdb_id, 'media_type', t.media_type, 'title', t.title, 'year', t.year,
        'poster_path', t.poster_path, 'accent', t.accent, 'genres', t.genres,
        'runtime_minutes', t.runtime_minutes, 'seasons', t.seasons),
      gw.note, gw.created_at
    from public.profiles p
    left join public.good_words gw on gw.user_id = p.user_id
    left join public.titles t on t.id = gw.title_id
    where p.user_id = link.user_id and p.deleted_at is null
    order by gw.created_at desc nulls last
    limit 500;
end $$;

-- Live new good words on a shelf (F5.6): each time a good word lands on a
-- group's shelf, members listening to that shelf hear its id and who put it
-- in. The app counts others' into the "2 new good words" pill.
create function public.broadcast_good_word() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform realtime.send(
    jsonb_build_object('good_word_id', new.good_word_id,
      'user_id', (select gw.user_id from public.good_words gw where gw.id = new.good_word_id)),
    'good_word',
    'shelf:' || new.group_id::text,
    true
  );
  return new;
end $$;

create trigger good_word_groups_broadcast after insert on public.good_word_groups
  for each row execute function public.broadcast_good_word();

-- Who can listen: as before, plus members of a group on its shelf topic.
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
  return false;
exception when others then
  return false;
end $$;

-- The weekend prompt (F7.2): Sunday 10am local, to members of at least one
-- group who haven't put in a good word in 14 days, at most once every 14
-- days, with the preference on, outside quiet hours and under the daily cap.
-- The slot is that Sunday; a held prompt goes within 24 hours or not at all.
create function public.weekend_slot(p_tz text, p_at timestamptz default now()) returns date
language plpgsql stable set search_path = '' as $$
declare
  tz text := public.email_tz(p_tz);
  local_now timestamp := p_at at time zone tz;
  sunday date := local_now::date - (extract(isodow from local_now)::int % 7);
begin
  if local_now < sunday + time '10:00' then return null; end if;
  if local_now >= sunday + time '10:00' + interval '24 hours' then return null; end if;
  return sunday;
end $$;

create function public.email_weekend_due(p_only uuid[] default null)
returns table (user_id uuid, email text, display_name text, slot date)
language plpgsql security definer set search_path = '' as $$
begin
  return query
    select r.user_id, r.email, r.display_name, public.weekend_slot(r.timezone)
    from public.email_recipients(p_only) r
    join public.notification_prefs np on np.user_id = r.user_id and np.weekend_prompt
    where public.weekend_slot(r.timezone) is not null
      and exists (select 1 from public.group_members m where m.user_id = r.user_id)
      and not exists (select 1 from public.good_words gw where gw.user_id = r.user_id and gw.created_at > now() - interval '14 days')
      and not exists (select 1 from public.notification_log l
        where l.user_id = r.user_id and l.type = 'weekend_prompt' and l.sent_at > now() - interval '14 days')
      and not public.email_quiet(r.timezone)
      and not public.email_capped(r.user_id, r.timezone);
end $$;

-- The weekend prompt can be turned off from its own unsubscribe link, and in
-- Settings (F7.7), like the others.

revoke execute on function public.set_streaming_services, public.set_share_link, public.reset_share_link from public, anon;
revoke execute on function public.shared_shelf from public, anon, authenticated;
grant execute on function public.shared_shelf to service_role;
revoke execute on function public.broadcast_good_word, public.weekend_slot, public.email_weekend_due from public, anon, authenticated;
grant execute on function public.weekend_slot, public.email_weekend_due to service_role;
