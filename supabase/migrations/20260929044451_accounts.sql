-- Step 1: accounts. One profile per auth user, created by a trigger on first
-- sign-in. RLS is on for every table (PRD 8). Co-member visibility of profiles
-- arrives with groups in step 2.

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  display_name text check (display_name is null or char_length(display_name) between 1 and 30),
  region text not null default 'US' check (region ~ '^[A-Z]{2}$'),
  timezone text,
  onboarded_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles: read own" on public.profiles
  for select to authenticated using (user_id = (select auth.uid()));

create policy "profiles: update own" on public.profiles
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- No insert or delete policy: profiles are created by the trigger below and
-- removed with the auth user.

create function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill anyone who signed in before this migration.
insert into public.profiles (user_id) select id from auth.users on conflict (user_id) do nothing;

-- Sign-in email rate limit: 5 per address per hour (PRD F1). Service role only;
-- addresses are stored as hashes.
create table public.sign_in_requests (
  id bigint generated always as identity primary key,
  email_hash text not null,
  created_at timestamptz not null default now()
);
create index sign_in_requests_lookup on public.sign_in_requests (email_hash, created_at desc);
alter table public.sign_in_requests enable row level security;
