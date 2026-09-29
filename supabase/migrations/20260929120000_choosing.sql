-- Step 5: choosing (PRD F5.4, F5.5, F6, 9.2).
--
-- Where to watch, cached per title per region (PRD 8, 9.1): TMDB's watch
-- provider data (from JustWatch), refreshed when older than 24 hours.
-- Readable by any signed-in user; writable only by the server (service role):
-- there are no insert, update, or delete policies.

create table public.watch_providers (
  id uuid primary key default gen_random_uuid(),
  title_id uuid not null references public.titles (id) on delete cascade,
  region text not null check (region ~ '^[A-Z]{2}$'),
  -- { "stream": [{ "id": 8, "name": "Netflix", "logo": "/abc.png" }], "rent": [...], "buy": [...] }
  -- Empty lists when nothing is available, so the title isn't fetched again for a day.
  providers jsonb not null default '{"stream": [], "rent": [], "buy": []}'::jsonb
    check (jsonb_typeof(providers) = 'object'),
  -- TMDB's where-to-watch page for this title and region. Null when there's nothing.
  link text,
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (title_id, region)
);

alter table public.watch_providers enable row level security;

create policy "watch_providers: read when signed in" on public.watch_providers
  for select to authenticated using (true);

create trigger watch_providers_touch before update on public.watch_providers
  for each row execute function public.touch_updated_at();

-- New since your last visit (F5.5). Before your first visit, "last viewed"
-- is when you joined, so good words from before you joined aren't New.
-- Counts good words from other people shared into each of your groups since
-- then. Runs as the caller, under row-level security.
create function public.new_good_word_counts() returns table (group_id uuid, new_count int)
language sql stable security invoker set search_path = '' as $$
  select m.group_id, count(gwg.id)::int
  from public.group_members m
  join public.good_word_groups gwg
    on gwg.group_id = m.group_id and gwg.shared_at > coalesce(m.last_viewed_at, m.joined_at)
  join public.good_words gw on gw.id = gwg.good_word_id and gw.user_id <> m.user_id
  where m.user_id = (select auth.uid())
  group by m.group_id;
$$;

-- "Last viewed" updates when you leave a shelf or after 10 seconds on it,
-- never on arrival (F5.5). Viewing All groups counts as viewing each group
-- in it. Groups you're not in are ignored.
create function public.mark_shelves_viewed(p_groups uuid[]) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.group_members set last_viewed_at = now()
    where user_id = public.require_user() and group_id = any (coalesce(p_groups, '{}'));
end $$;

revoke execute on function public.new_good_word_counts, public.mark_shelves_viewed from public, anon;
