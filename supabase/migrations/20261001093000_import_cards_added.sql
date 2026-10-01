-- Step 11: what Add actually put in (PRD F15.3), so Undo takes back only a
-- good word the import created, never one that was already on your list.
-- Written by the server after it checks the card is yours.
alter table public.import_cards
  add column added_type text check (added_type in ('movie', 'tv')),
  add column added_tmdb_id int check (added_tmdb_id > 0),
  add column created_good_word boolean not null default false;
