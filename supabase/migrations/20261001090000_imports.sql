-- Step 11: Build your list (PRD F15, slice 11). An import turns pasted,
-- dictated, or screenshot lists into cards the owner confirms one at a time.
-- Cards are private to their owner and never appear on a shelf; only Add puts
-- in a good word (through put_good_word, with its own checks and limits).
-- Screenshots are never stored: only the titles read from them.

create table public.imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'parsing'
    check (status in ('parsing', 'reviewing', 'done', 'cancelled', 'failed')),
  method text not null check (method in ('text', 'screenshots', 'both')),
  -- sha-256 of the input, so sending the same thing again reuses `extracted`.
  input_hash text not null check (input_hash ~ '^[0-9a-f]{64}$'),
  group_ids uuid[] not null default '{}' check (cardinality(group_ids) <= 20),
  found_count int not null default 0 check (found_count between 0 and 100),
  duplicate_count int not null default 0 check (duplicate_count >= 0),
  -- The candidates the parser found, before TMDB matching (for reuse only).
  extracted jsonb,
  ai_input_tokens int not null default 0,
  ai_output_tokens int not null default 0,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index imports_user_created on public.imports (user_id, created_at desc);
create index imports_user_hash on public.imports (user_id, input_hash);
alter table public.imports enable row level security;
create trigger imports_touch before update on public.imports
  for each row execute function public.touch_updated_at();

create policy "imports: read own" on public.imports
  for select to authenticated using (user_id = (select auth.uid()));

create table public.import_cards (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references public.imports (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  position int not null check (position between 1 and 100),
  -- What the person wrote, as the parser read it.
  query text not null check (char_length(query) between 1 and 200),
  note text not null default '' check (char_length(note) <= 140),
  confidence text not null check (confidence in ('high', 'low')),
  -- Up to 4 TMDB matches: [{type, tmdbId, name, year, posterPath}], best first.
  candidates jsonb not null check (jsonb_typeof(candidates) = 'array' and jsonb_array_length(candidates) between 1 and 4),
  chosen int not null default 0 check (chosen between 0 and 3),
  decision text not null default 'pending' check (decision in ('pending', 'added', 'skipped')),
  decided_at timestamptz,
  opened_alternatives boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (import_id, position)
);
create index import_cards_user on public.import_cards (user_id, decision);
alter table public.import_cards enable row level security;
create trigger import_cards_touch before update on public.import_cards
  for each row execute function public.touch_updated_at();

create policy "import_cards: read own" on public.import_cards
  for select to authenticated using (user_id = (select auth.uid()));

-- Shared match cache (F15.2): a normalized "title|year|type" to its TMDB id.
-- Server only: no policies, written with the service role.
create table public.title_matches (
  query_key text primary key check (char_length(query_key) <= 240),
  media_type text not null check (media_type in ('movie', 'tv')),
  tmdb_id int not null check (tmdb_id > 0),
  created_at timestamptz not null default now()
);
alter table public.title_matches enable row level security;

-- Limits (F15.4).
create function public.import_limits() returns table (per_day int, max_titles int)
language sql immutable as $$ select 10, 100 $$;

-- Starts an import, enforcing 10 a day. Groups are narrowed to ones you're in.
-- Returns `limited`, or `started` with the new id and, when the same input was
-- parsed before, what it found (so no second AI call).
create function public.start_import(p_method text, p_hash text, p_groups uuid[])
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
  if (select count(*) from public.imports i where i.user_id = uid and i.created_at > now() - interval '1 day')
       >= (select per_day from public.import_limits()) then
    return query select 'limited'::text, null::uuid, null::jsonb;
    return;
  end if;
  select i.extracted into prior from public.imports i
    where i.user_id = uid and i.input_hash = p_hash and i.extracted is not null
    order by i.created_at desc limit 1;
  insert into public.imports (user_id, method, input_hash, group_ids)
    values (uid, p_method, p_hash, coalesce((
      select array_agg(distinct g) from unnest(coalesce(p_groups, '{}')) g where public.is_member(g)
    ), '{}'))
    returning id into new_id;
  return query select 'started'::text, new_id, prior;
end $$;

-- Cancel while finding titles (F15.2). Your own import only.
create function public.cancel_import(p_import uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare uid uuid := public.require_user();
begin
  update public.imports set status = 'cancelled'
    where id = p_import and user_id = uid and status = 'parsing';
  return found;
end $$;

-- Records a decision on one card, or undoes one (p_decision 'pending').
-- Keeps the import's status in step: 'done' once nothing is pending.
-- Returns how many cards are still pending, or -1 if it isn't your card.
create function public.decide_import_card(
  p_card uuid, p_decision text, p_chosen int, p_note text, p_opened boolean
) returns int
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.require_user();
  imp uuid;
  left_count int;
begin
  if p_decision not in ('pending', 'added', 'skipped') then
    raise exception 'bad decision' using errcode = '22023';
  end if;
  update public.import_cards c set
      decision = p_decision,
      decided_at = case when p_decision = 'pending' then null else now() end,
      chosen = case when p_chosen between 0 and jsonb_array_length(c.candidates) - 1 then p_chosen else c.chosen end,
      note = left(trim(coalesce(p_note, c.note)), 140),
      opened_alternatives = c.opened_alternatives or coalesce(p_opened, false)
    where c.id = p_card and c.user_id = uid
      and exists (select 1 from public.imports i where i.id = c.import_id and i.status in ('reviewing', 'done'))
    returning c.import_id into imp;
  if imp is null then return -1; end if;
  select count(*) into left_count from public.import_cards where import_id = imp and decision = 'pending';
  update public.imports set
      status = case when left_count = 0 then 'done' else 'reviewing' end,
      completed_at = case when left_count = 0 then coalesce(completed_at, now()) else null end
    where id = imp;
  return left_count;
end $$;

revoke execute on function public.start_import(text, text, uuid[]) from public, anon;
revoke execute on function public.cancel_import(uuid) from public, anon;
revoke execute on function public.decide_import_card(uuid, text, int, text, boolean) from public, anon;
grant execute on function public.start_import(text, text, uuid[]) to authenticated;
grant execute on function public.cancel_import(uuid) to authenticated;
grant execute on function public.decide_import_card(uuid, text, int, text, boolean) to authenticated;

-- Imports are working state, not a record: gone after 30 days. An import left
-- 'parsing' for an hour (the request died) is marked failed.
create function public.purge_imports() returns void
language sql security definer set search_path = '' as $$
  update public.imports set status = 'failed' where status = 'parsing' and created_at < now() - interval '1 hour';
  delete from public.imports where created_at < now() - interval '30 days';
$$;
revoke execute on function public.purge_imports(), public.import_limits() from public, anon, authenticated;
select cron.schedule('purge-imports', '23 * * * *', 'select public.purge_imports()');
