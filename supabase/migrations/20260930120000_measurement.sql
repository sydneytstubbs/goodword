-- Step 9: measurement (PRD 11, section 8). First-party events, and the
-- weekly numbers for /admin/metrics. No search text, notes, or email
-- addresses ever go in an event (11.1).

create table public.events (
  id uuid primary key default gen_random_uuid(),
  -- Null for signed-out visitors (an invite link opened before signing in).
  -- Deleting an account deletes its events.
  user_id uuid references auth.users (id) on delete cascade,
  name text not null check (name ~ '^[a-z_]{3,40}$'),
  properties jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index events_name_time on public.events (name, occurred_at);
create index events_user_time on public.events (user_id, occurred_at);

alter table public.events enable row level security;
-- No policies: the app writes events with the service role, after checking
-- each one against its schema, and only the metrics function reads them.

create trigger events_touch before update on public.events
  for each row execute function public.touch_updated_at();

-- Who can see /admin/metrics: Sydney's account only (11.4). Add someone with
--   insert into public.app_admins (user_id) select id from auth.users where email = '...';
create table public.app_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.app_admins enable row level security;

insert into public.app_admins (user_id)
  select id from auth.users where email = 'sydneytstubbs@gmail.com'
  on conflict (user_id) do nothing;

create function public.is_app_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.app_admins where user_id = (select auth.uid()));
$$;

-- The weekly numbers (11.4, H1 to H6), newest week first. Weeks start Monday,
-- UTC. Admins only; anyone else gets nothing.
--   H1 invite_opens, joins, join_rate: joins per invite link opened
--   H2 new_members, contributed_7d: members who joined that week, and how many
--      put in a good word within 7 days of joining
--   H3 median_log_seconds, adds_opened, good_words_created: time from Add to
--      confirmation, and how many Adds ended in a good word
--   H4 source_*: where that week's good words came from
--   H5 where_to_watch_clicks, title_views_from_shelf
--   H6 cohort_4w, active_4w: members who joined 4 weeks earlier, and how many
--      did anything that week
create function public.admin_metrics(p_weeks int default 8)
returns table (
  week_start date,
  invite_opens int,
  joins int,
  new_members int,
  contributed_7d int,
  median_log_seconds numeric,
  adds_opened int,
  good_words_created int,
  source_organic int,
  source_digest int,
  source_nudge_email int,
  source_join_prompt int,
  source_other int,
  where_to_watch_clicks int,
  title_views_from_shelf int,
  cohort_4w int,
  active_4w int,
  comments int,
  commenters int
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_app_admin() then return; end if;
  return query
    with weeks as (
      select (date_trunc('week', now() at time zone 'UTC') - make_interval(weeks => n))::date as ws
      from generate_series(0, least(greatest(coalesce(p_weeks, 8), 1), 52) - 1) n
    ),
    ev as (
      select e.name, e.user_id, e.properties, (date_trunc('week', e.occurred_at at time zone 'UTC'))::date as ws
      from public.events e
      where e.occurred_at >= (select min(ws) from weeks)
    ),
    joined as (
      select m.user_id, m.joined_at, (date_trunc('week', m.joined_at at time zone 'UTC'))::date as ws
      from public.group_members m
      where m.role = 'member'
    )
    select w.ws,
      (select count(*)::int from ev where ev.ws = w.ws and ev.name = 'invite_link_opened'),
      (select count(*)::int from ev where ev.ws = w.ws and ev.name = 'group_joined'),
      (select count(*)::int from joined j where j.ws = w.ws),
      (select count(*)::int from joined j where j.ws = w.ws and exists (
        select 1 from public.good_words gw
        where gw.user_id = j.user_id and gw.created_at >= j.joined_at and gw.created_at < j.joined_at + interval '7 days')),
      (select round((percentile_cont(0.5) within group (order by (ev.properties ->> 'ms_from_add_opened')::numeric) / 1000)::numeric, 1)
        from ev where ev.ws = w.ws and ev.name = 'good_word_created' and ev.properties ? 'ms_from_add_opened'),
      (select count(*)::int from ev where ev.ws = w.ws and ev.name = 'add_opened'),
      (select count(*)::int from ev where ev.ws = w.ws and ev.name = 'good_word_created'),
      (select count(*)::int from ev where ev.ws = w.ws and ev.name = 'good_word_created' and ev.properties ->> 'source' = 'organic'),
      (select count(*)::int from ev where ev.ws = w.ws and ev.name = 'good_word_created' and ev.properties ->> 'source' = 'digest'),
      (select count(*)::int from ev where ev.ws = w.ws and ev.name = 'good_word_created' and ev.properties ->> 'source' = 'nudge_email'),
      (select count(*)::int from ev where ev.ws = w.ws and ev.name = 'good_word_created' and ev.properties ->> 'source' = 'join_prompt'),
      (select count(*)::int from ev where ev.ws = w.ws and ev.name = 'good_word_created'
        and coalesce(ev.properties ->> 'source', '') not in ('organic', 'digest', 'nudge_email', 'join_prompt')),
      (select count(*)::int from ev where ev.ws = w.ws and ev.name = 'where_to_watch_clicked'),
      (select count(*)::int from ev where ev.ws = w.ws and ev.name = 'title_viewed' and ev.properties ->> 'from' = 'shelf'),
      (select count(distinct j.user_id)::int from joined j where j.ws = w.ws - 28),
      (select count(distinct j.user_id)::int from joined j where j.ws = w.ws - 28
        and exists (select 1 from public.events e2 where e2.user_id = j.user_id
          and e2.occurred_at >= w.ws::timestamp at time zone 'UTC' and e2.occurred_at < (w.ws + 7)::timestamp at time zone 'UTC')),
      (select count(*)::int from ev where ev.ws = w.ws and ev.name = 'comment_created'),
      (select count(distinct ev.user_id)::int from ev where ev.ws = w.ws and ev.name = 'comment_created')
    from weeks w
    order by w.ws desc;
end $$;

revoke execute on function public.admin_metrics from public, anon;
revoke execute on function public.is_app_admin from public, anon;
