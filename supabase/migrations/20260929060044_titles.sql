-- Step 3: the title cache (PRD 8, 9.1). One row per TMDB movie or show, filled
-- by the server from TMDB details and refreshed when older than 7 days.
-- Readable by any signed-in user; writable only by the server (service role):
-- there are no insert, update, or delete policies.

create table public.titles (
  id uuid primary key default gen_random_uuid(),
  tmdb_id integer not null check (tmdb_id > 0),
  media_type text not null check (media_type in ('movie', 'tv')),
  title text not null,
  original_title text,
  year smallint,
  poster_path text,
  -- TMDB genres in TMDB's order: [{ "id": 18, "name": "Drama" }, ...]
  genres jsonb not null default '[]'::jsonb check (jsonb_typeof(genres) = 'array'),
  -- Film runtime, or typical episode runtime for shows (F5.4). Null when unknown.
  runtime_minutes smallint,
  seasons smallint,
  overview text,
  -- Fallback poster tone (DS 4.2.1). Set once on insert and never changed.
  accent text not null check (accent in ('clay', 'ochre', 'moss', 'plum')),
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tmdb_id, media_type)
);

alter table public.titles enable row level security;

create policy "titles: read when signed in" on public.titles
  for select to authenticated using (true);

create trigger titles_touch before update on public.titles
  for each row execute function public.touch_updated_at();

-- The accent is resolved once, when the title is first saved (DS 4.2.1).
create function public.keep_title_accent() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.accent = old.accent;
  return new;
end $$;

create trigger titles_keep_accent before update on public.titles
  for each row execute function public.keep_title_accent();
