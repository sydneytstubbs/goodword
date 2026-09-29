-- Step 7: email (PRD F7, section 8, 9.4, 9.5). Preferences, a log of what was
-- sent (for caps and dedupe), and the service-only functions the scheduled
-- job uses to find what's due. The app renders and sends through Resend.
--
-- Rules (F7, DS 5.13):
--   - Digest: Thursday 5pm local (open question 4), only if someone else put
--     in a good word in your groups in the past 7 days.
--   - Mentions: one email per conversation, once the first unsent mention is
--     10 minutes old, so a burst or an edit becomes one email and it still
--     arrives within 15 minutes of a 5-minute job (PRD 12, slice 7). Never if
--     you've opened it in the app or the comment was deleted.
--   - Someone joined your group: at most one email a day per owner.
--   - Quiet hours 9pm to 9am local hold everything. At most one non-mention
--     email per local day. Mentions are exempt from that cap.
--   - The sign-in link is transactional and goes through Supabase Auth, not here.

create table public.notification_prefs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  digest boolean not null default true,
  mention_email boolean not null default true,
  group_joins boolean not null default true,
  weekend_prompt boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.notification_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null check (type in ('digest', 'mention', 'group_join', 'weekend_prompt')),
  -- What this email was for: the digest's Thursday, or the first Activity item
  -- in a mention or join batch. Unique per person, so a send is never repeated.
  payload_ref text not null,
  sent_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, type, payload_ref)
);
create index notification_log_recent on public.notification_log (user_id, sent_at desc);

alter table public.notification_prefs enable row level security;
alter table public.notification_log enable row level security;

create trigger notification_prefs_touch before update on public.notification_prefs
  for each row execute function public.touch_updated_at();
create trigger notification_log_touch before update on public.notification_log
  for each row execute function public.touch_updated_at();

-- You read your own preferences (PRD 8). Writes go through set_notification_pref,
-- or the unsubscribe link (service role). The log is service-only: no policies.
create policy "notification_prefs: read own" on public.notification_prefs
  for select to authenticated using (user_id = (select auth.uid()));

-- Everyone gets preferences with everything on, including people who signed in
-- before this migration.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (user_id) values (new.id) on conflict (user_id) do nothing;
  insert into public.notification_prefs (user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end $$;

insert into public.notification_prefs (user_id) select id from auth.users on conflict (user_id) do nothing;

-- Settings › Notifications (F7.7). Takes effect immediately.
create function public.set_notification_pref(p_key text, p_on boolean) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.require_user();
begin
  if p_key not in ('digest', 'mention_email', 'group_joins', 'weekend_prompt') or p_on is null then
    return false;
  end if;
  insert into public.notification_prefs (user_id) values (uid) on conflict (user_id) do nothing;
  execute format('update public.notification_prefs set %I = $1 where user_id = $2', p_key) using p_on, uid;
  return true;
end $$;

-- An Activity item's email: set once it's been sent, or deliberately not sent
-- (read in the app first, comment deleted, emails of that kind turned off).
alter table public.activity_items add column email_handled_at timestamptz;
create index activity_items_email_pending on public.activity_items (type, created_at)
  where email_handled_at is null and type in ('mention', 'group_join');

-- Items from before email existed are never emailed.
update public.activity_items set email_handled_at = now()
  where email_handled_at is null and type in ('mention', 'group_join');

-- Time helpers. A missing or unknown timezone counts as UTC.
create function public.email_tz(p_tz text) returns text
language sql stable set search_path = '' as $$
  select coalesce((select name from pg_catalog.pg_timezone_names where name = p_tz), 'UTC');
$$;

create function public.email_quiet(p_tz text, p_at timestamptz default now()) returns boolean
language sql stable set search_path = '' as $$
  select extract(hour from p_at at time zone public.email_tz(p_tz)) not between 9 and 20;
$$;

-- Whether a capped email (anything but mentions) already went out today, local time.
create function public.email_capped(p_user uuid, p_tz text, p_at timestamptz default now()) returns boolean
language sql stable set search_path = '' as $$
  select exists (
    select 1 from public.notification_log l
    where l.user_id = p_user and l.type <> 'mention'
      and (l.sent_at at time zone public.email_tz(p_tz))::date = (p_at at time zone public.email_tz(p_tz))::date
  );
$$;

-- The digest slot this moment belongs to: the most recent Thursday at 5pm
-- local, as a date. Null once 24 hours have passed without it going out
-- (quiet hours and the cap can hold it until Friday morning, not longer).
create function public.digest_slot(p_tz text, p_at timestamptz default now()) returns date
language plpgsql stable set search_path = '' as $$
declare
  tz text := public.email_tz(p_tz);
  local_now timestamp := p_at at time zone tz;
  thursday date := local_now::date - ((extract(isodow from local_now)::int - 4 + 7) % 7);
begin
  if local_now < thursday + time '17:00' then thursday := thursday - 7; end if;
  if local_now >= thursday + time '17:00' + interval '24 hours' then return null; end if;
  return thursday;
end $$;

-- Email only goes to people who've finished signing in and haven't been deleted.
create function public.email_recipients(p_only uuid[] default null)
returns table (user_id uuid, email text, display_name text, timezone text)
language sql stable security definer set search_path = '' as $$
  select u.id, u.email::text, p.display_name, public.email_tz(p.timezone)
  from auth.users u
  join public.profiles p on p.user_id = u.id
  where u.email is not null and p.onboarded_at is not null and p.display_name is not null and p.deleted_at is null
    and (p_only is null or u.id = any (p_only));
$$;

-- Mention emails due now (F7.4): one row per person and conversation. Settles
-- items that should never be emailed first. p_window is how old the first
-- unsent mention must be; p_only limits it to some people (tests).
create function public.email_mentions_due(p_window interval default interval '10 minutes', p_only uuid[] default null)
returns table (
  user_id uuid,
  email text,
  group_id uuid,
  group_name text,
  title jsonb,
  item_ids uuid[],
  comments jsonb
)
language plpgsql security definer set search_path = '' as $$
begin
  update public.activity_items a set email_handled_at = now()
    where a.type = 'mention' and a.email_handled_at is null
      and (p_only is null or a.user_id = any (p_only))
      and (
        a.read_at is not null
        or not exists (select 1 from public.comments c where c.id = a.comment_id and c.deleted_at is null)
        or not exists (select 1 from public.group_members m where m.group_id = a.group_id and m.user_id = a.user_id)
        or exists (select 1 from public.notification_prefs np where np.user_id = a.user_id and not np.mention_email)
        or exists (select 1 from public.conversation_reads r
          join public.comments c on c.id = a.comment_id
          where r.user_id = a.user_id and r.group_id = a.group_id and r.title_id = a.title_id and r.last_read_at >= c.created_at)
      );

  return query
    with pending as (
      select a.id, a.user_id, a.group_id, a.title_id, a.created_at, c.id as comment_id, c.created_at as comment_at,
        c.is_spoiler, c.body, c.user_id as author_id
      from public.activity_items a
      join public.comments c on c.id = a.comment_id and c.deleted_at is null
      where a.type = 'mention' and a.email_handled_at is null and a.read_at is null
        and (p_only is null or a.user_id = any (p_only))
    ),
    batches as (
      select p.user_id, p.group_id, p.title_id, min(p.created_at) as oldest
      from pending p group by 1, 2, 3
    )
    select r.user_id, r.email, g.name,
      jsonb_build_object('id', t.id, 'tmdb_id', t.tmdb_id, 'type', t.media_type, 'title', t.title, 'year', t.year,
        'poster_path', t.poster_path, 'accent', t.accent),
      array(select p.id from pending p where p.user_id = b.user_id and p.group_id = b.group_id and p.title_id = b.title_id
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
        where p.user_id = b.user_id and p.group_id = b.group_id and p.title_id = b.title_id)
    from batches b
    join public.email_recipients(p_only) r on r.user_id = b.user_id
    join public.groups g on g.id = b.group_id
    join public.titles t on t.id = b.title_id
    where b.oldest <= now() - p_window
      and not public.email_quiet(r.timezone);
end $$;

-- Someone joined your group (F7.3): one row per owner with joins waiting,
-- at most one a day, outside quiet hours and under the daily cap.
create function public.email_joins_due(p_only uuid[] default null)
returns table (user_id uuid, email text, item_ids uuid[], joins jsonb)
language plpgsql security definer set search_path = '' as $$
begin
  update public.activity_items a set email_handled_at = now()
    where a.type = 'group_join' and a.email_handled_at is null
      and (p_only is null or a.user_id = any (p_only))
      and (
        a.read_at is not null
        or not exists (select 1 from public.group_members m where m.group_id = a.group_id and m.user_id = a.actor_id)
        or not exists (select 1 from public.group_members m where m.group_id = a.group_id and m.user_id = a.user_id and m.role = 'owner')
        or exists (select 1 from public.notification_prefs np where np.user_id = a.user_id and not np.group_joins)
      );

  return query
    select r.user_id, r.email,
      array_agg(a.id order by a.created_at),
      jsonb_agg(jsonb_build_object('group_id', a.group_id, 'group_name', g.name, 'name', coalesce(p.display_name, ''),
        'at', a.created_at) order by a.created_at)
    from public.activity_items a
    join public.email_recipients(p_only) r on r.user_id = a.user_id
    join public.groups g on g.id = a.group_id
    left join public.profiles p on p.user_id = a.actor_id
    where a.type = 'group_join' and a.email_handled_at is null
      and not public.email_quiet(r.timezone)
      and not public.email_capped(r.user_id, r.timezone)
      and not exists (select 1 from public.notification_log l
        where l.user_id = r.user_id and l.type = 'group_join' and l.sent_at > now() - interval '24 hours')
    group by r.user_id, r.email;
end $$;

-- The weekly digest's content for one person (F7.1, F7.5), or null when
-- nobody else put in a good word in their groups in the past 7 days. Per
-- group: up to 8 titles (newest first) with who vouched and the latest note,
-- the total, and a conversation summary with no comment text at all.
create function public.digest_content(p_user uuid, p_since timestamptz default now() - interval '7 days')
returns jsonb
language sql stable security definer set search_path = '' as $$
  with my_groups as (
    select g.id, g.name, g.color, m.joined_at
    from public.group_members m join public.groups g on g.id = m.group_id
    where m.user_id = p_user
  ),
  shared as (
    select gwg.group_id, gw.id as good_word_id, gw.title_id, gw.user_id, gw.note, gwg.shared_at
    from public.good_word_groups gwg
    join public.good_words gw on gw.id = gwg.good_word_id
    join my_groups mg on mg.id = gwg.group_id
    where gw.user_id <> p_user and gwg.shared_at >= p_since
  ),
  per_title as (
    select s.group_id, s.title_id, max(s.shared_at) as latest,
      jsonb_agg(coalesce(p.display_name, '') order by s.shared_at desc) as vouchers,
      (array_agg(s.note order by s.shared_at desc) filter (where s.note is not null and s.note <> ''))[1] as note
    from shared s left join public.profiles p on p.user_id = s.user_id
    group by 1, 2
  ),
  talk as (
    select c.group_id, c.title_id, count(*) as n, max(c.created_at) as latest
    from public.comments c join my_groups mg on mg.id = c.group_id
    where c.deleted_at is null and c.user_id <> p_user and c.created_at >= p_since
    group by 1, 2
  ),
  title_json as (
    select t.id, jsonb_build_object('id', t.id, 'tmdb_id', t.tmdb_id, 'type', t.media_type, 'title', t.title,
      'year', t.year, 'poster_path', t.poster_path, 'accent', t.accent) as j
    from public.titles t
    where t.id in (select title_id from per_title union select title_id from talk)
  ),
  groups_json as (
    select mg.id, mg.name,
      (select count(*) from shared s where s.group_id = mg.id) as good_words,
      jsonb_build_object(
        'id', mg.id,
        'name', mg.name,
        'total', (select count(*) from per_title pt where pt.group_id = mg.id),
        'titles', coalesce((
          select jsonb_agg(x.j order by x.latest desc) from (
            select pt.latest, tj.j || jsonb_build_object('vouchers', pt.vouchers, 'note', pt.note) as j
            from per_title pt join title_json tj on tj.id = pt.title_id
            where pt.group_id = mg.id
            order by pt.latest desc limit 8
          ) x), '[]'::jsonb),
        'comments', coalesce((select sum(tk.n) from talk tk where tk.group_id = mg.id), 0),
        'conversations', (select count(*) from talk tk where tk.group_id = mg.id),
        'top_conversations', coalesce((
          select jsonb_agg(x.j order by x.n desc, x.latest desc) from (
            select tk.n, tk.latest, tj.j || jsonb_build_object('comments', tk.n) as j
            from talk tk join title_json tj on tj.id = tk.title_id
            where tk.group_id = mg.id
            order by tk.n desc, tk.latest desc limit 3
          ) x), '[]'::jsonb)
      ) as j
    from my_groups mg
  )
  select case when (select count(distinct good_word_id) from shared) = 0 then null else jsonb_build_object(
    'good_words', (select count(distinct good_word_id) from shared),
    'group_names', (select jsonb_agg(mg.name order by mg.joined_at) from my_groups mg),
    'groups', (select jsonb_agg(gj.j order by gj.good_words desc, gj.name)
      from groups_json gj where (gj.j ->> 'total')::int > 0 or (gj.j ->> 'comments')::int > 0)
  ) end;
$$;

-- Digests due now: people whose Thursday 5pm has come in the last 24 hours
-- and who haven't had this week's, with their content. p_force sends the
-- given people theirs now whatever the day (for testing a digest on a phone).
create function public.email_digests_due(p_only uuid[] default null, p_force boolean default false)
returns table (user_id uuid, email text, slot date, content jsonb)
language plpgsql security definer set search_path = '' as $$
begin
  if p_force and p_only is null then return; end if;
  return query
    with candidates as (
      select r.user_id, r.email, r.timezone,
        case when p_force then (now() at time zone r.timezone)::date else public.digest_slot(r.timezone) end as slot
      from public.email_recipients(p_only) r
      join public.notification_prefs np on np.user_id = r.user_id
      where np.digest or p_force
    ),
    ready as (
      select c.* from candidates c
      where c.slot is not null
        and (p_force or (
          not public.email_quiet(c.timezone)
          and not public.email_capped(c.user_id, c.timezone)
          and not exists (select 1 from public.notification_log l
            where l.user_id = c.user_id and l.type = 'digest' and l.payload_ref = c.slot::text)
        ))
    )
    select x.user_id, x.email, x.slot, x.content
    from (select rd.user_id, rd.email, rd.slot, public.digest_content(rd.user_id) as content from ready rd) x
    where x.content is not null;
end $$;

-- Claim items before sending, so two overlapping runs never send twice.
-- Returns false if any were already taken. release_email_items undoes it
-- when sending fails, so the next run tries again.
create function public.claim_email_items(p_ids uuid[]) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.activity_items where id = any (coalesce(p_ids, '{}')) for update;
  if exists (select 1 from public.activity_items where id = any (coalesce(p_ids, '{}')) and email_handled_at is not null) then
    return false;
  end if;
  update public.activity_items set email_handled_at = now() where id = any (coalesce(p_ids, '{}'));
  return found;
end $$;

create function public.release_email_items(p_ids uuid[]) returns void
language sql security definer set search_path = '' as $$
  update public.activity_items set email_handled_at = null where id = any (coalesce(p_ids, '{}'));
$$;

-- The scheduled job (PRD 9.5): pg_cron calls the app every 5 minutes through
-- pg_net. The app's address and a random secret live in Vault. The secret is
-- made here and never written down: the app reads it through
-- email_job_secret() to check each call. To point the job somewhere else:
--   select vault.update_secret(id, '<https://.../api/email/run>') from vault.secrets where name = 'email_job_url';
create extension if not exists pg_net with schema extensions;

select vault.create_secret('https://www.goodwordfriends.com/api/email/run', 'email_job_url')
  where not exists (select 1 from vault.secrets where name = 'email_job_url');
select vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'email_job_secret')
  where not exists (select 1 from vault.secrets where name = 'email_job_secret');

create function public.email_job_secret() returns text
language sql stable security definer set search_path = '' as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'email_job_secret';
$$;

create function public.run_email_job(p_body jsonb default '{}'::jsonb) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  job_url text := (select decrypted_secret from vault.decrypted_secrets where name = 'email_job_url');
  job_secret text := (select decrypted_secret from vault.decrypted_secrets where name = 'email_job_secret');
begin
  if job_url is null or job_secret is null then return null; end if;
  return net.http_post(
    url := job_url,
    body := coalesce(p_body, '{}'::jsonb),
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || job_secret),
    timeout_milliseconds := 60000
  );
end $$;

-- Send one person their digest now, whatever the day. For reviewing the
-- digest on a phone: `select public.send_test_digest('<user id>')` in the SQL editor.
create function public.send_test_digest(p_user uuid) returns bigint
language sql security definer set search_path = '' as $$
  select public.run_email_job(jsonb_build_object('digestNow', p_user));
$$;

select cron.schedule('send-email', '*/5 * * * *', 'select public.run_email_job()');

-- Everyone signed in can set their own preferences; everything else is for
-- the service role only.
revoke execute on function public.set_notification_pref from public, anon;
revoke execute on function public.email_tz, public.email_quiet, public.email_capped, public.digest_slot,
  public.email_recipients, public.email_mentions_due, public.email_joins_due, public.digest_content,
  public.email_digests_due, public.claim_email_items, public.release_email_items, public.run_email_job,
  public.send_test_digest, public.email_job_secret from public, anon, authenticated;
grant execute on function public.email_tz, public.email_quiet, public.email_capped, public.digest_slot,
  public.email_recipients, public.email_mentions_due, public.email_joins_due, public.digest_content,
  public.email_digests_due, public.claim_email_items, public.release_email_items, public.email_job_secret to service_role;
