-- Step 13: "shelf" becomes "list" (PRD v1.4.0, slice 13).
--
-- Events: shelf_viewed is now list_viewed with a `list` property, and
-- title_viewed and email_clicked say `list` where they said `shelf`. Stored
-- rows are renamed so the metrics read one name. Until this step's app is
-- deployed, the running app still records the old names, so a trigger renames
-- them on the way in. Slice 20 drops the trigger.
--
-- Database names that still say shelf (mark_shelves_viewed, shared_shelf,
-- conversation_previews.on_shelf, the shelf:<group> Realtime topic, and
-- admin_metrics.title_views_from_shelf) stay for now: renaming them would
-- break the running app between this migration and the deploy. Slices 16 to
-- 20 rebuild that code and rename them then.

create function public.list_event_names(p_name text, p_props jsonb)
returns table (name text, properties jsonb)
language sql immutable set search_path = '' as $$
  select
    case when p_name = 'shelf_viewed' then 'list_viewed' else p_name end,
    case
      when p_name = 'shelf_viewed' and p_props ? 'shelf'
        then (p_props - 'shelf') || jsonb_build_object('list', p_props -> 'shelf')
      when p_name = 'title_viewed' and p_props ->> 'from' = 'shelf'
        then p_props || '{"from": "list"}'::jsonb
      when p_name = 'email_clicked' and p_props ->> 'target' = 'shelf'
        then p_props || '{"target": "list"}'::jsonb
      else p_props
    end;
$$;

update public.events e
set name = (select r.name from public.list_event_names(e.name, e.properties) r),
    properties = (select r.properties from public.list_event_names(e.name, e.properties) r)
where e.name = 'shelf_viewed'
   or (e.name = 'title_viewed' and e.properties ->> 'from' = 'shelf')
   or (e.name = 'email_clicked' and e.properties ->> 'target' = 'shelf');

create function public.rename_list_events() returns trigger
language plpgsql set search_path = '' as $$
begin
  select r.name, r.properties into new.name, new.properties
  from public.list_event_names(new.name, new.properties) r;
  return new;
end $$;

create trigger events_list_rename before insert on public.events
  for each row execute function public.rename_list_events();

revoke execute on function public.list_event_names, public.rename_list_events from public, anon, authenticated;

-- H5 counts title views from lists under the new name.
create or replace function public.admin_metrics(p_weeks int default 8)
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
      (select count(*)::int from ev where ev.ws = w.ws and ev.name = 'title_viewed' and ev.properties ->> 'from' = 'list'),
      (select count(distinct j.user_id)::int from joined j where j.ws = w.ws - 28),
      (select count(distinct j.user_id)::int from joined j where j.ws = w.ws - 28
        and exists (select 1 from public.events e2 where e2.user_id = j.user_id
          and e2.occurred_at >= w.ws::timestamp at time zone 'UTC' and e2.occurred_at < (w.ws + 7)::timestamp at time zone 'UTC')),
      (select count(*)::int from ev where ev.ws = w.ws and ev.name = 'comment_created'),
      (select count(distinct ev.user_id)::int from ev where ev.ws = w.ws and ev.name = 'comment_created')
    from weeks w
    order by w.ws desc;
end $$;
