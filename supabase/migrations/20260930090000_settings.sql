-- Step 8: settings and trust (PRD F1, F11, 8, 10.4). Feedback, and deleting
-- your account. RLS on every table; writes go through the functions below.

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  message text not null check (char_length(btrim(message)) between 1 and 2000),
  may_contact boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index feedback_user_created on public.feedback (user_id, created_at desc);

alter table public.feedback enable row level security;
-- No policies: people send feedback through send_feedback and never read it
-- back. Sydney reads it in the dashboard (and by email).

create trigger feedback_touch before update on public.feedback
  for each row execute function public.touch_updated_at();

-- Send feedback (F11): 10 per person per day (PRD 10.4).
-- Returns: sent, empty, too_long, rate_limited.
create function public.send_feedback(p_id uuid, p_message text, p_may_contact boolean) returns text
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.require_user();
  msg text := btrim(coalesce(p_message, ''));
begin
  if char_length(msg) = 0 then return 'empty'; end if;
  if char_length(msg) > 2000 then return 'too_long'; end if;
  if exists (select 1 from public.feedback where id = p_id) then return 'sent'; end if;
  perform pg_advisory_xact_lock(hashtext('feedback:' || uid::text));
  if (select count(*) from public.feedback where user_id = uid and created_at > now() - interval '1 day') >= 10 then
    return 'rate_limited';
  end if;
  insert into public.feedback (id, user_id, message, may_contact) values (p_id, uid, msg, coalesce(p_may_contact, false));
  return 'sent';
end $$;

-- Delete my account, part one (F1): leave every group the way leaving works
-- (F2.6), so each group you own passes to the member who joined earliest and
-- a group you're alone in is deleted, and your good words leave its shelf.
-- The profile is marked deleted so nothing emails you in between. The app
-- then deletes the auth user, which removes the profile, good words,
-- comments, Activity, preferences, feedback, and the rest by cascade.
create function public.prepare_account_deletion() returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.require_user();
  g uuid;
begin
  update public.profiles set deleted_at = now() where user_id = uid;
  for g in select group_id from public.group_members where user_id = uid order by joined_at loop
    perform public.leave_group(g);
  end loop;
  -- Groups that name you as owner without you as a member (shouldn't happen)
  -- still pass to their earliest member, or go if nobody's left, so deleting
  -- the auth user never trips over groups.owner_id.
  update public.groups g set owner_id = (
      select m.user_id from public.group_members m where m.group_id = g.id order by m.joined_at, m.id limit 1)
    where g.owner_id = uid and exists (select 1 from public.group_members m where m.group_id = g.id);
  update public.group_members m set role = 'owner'
    from public.groups g where g.id = m.group_id and g.owner_id = m.user_id and m.role <> 'owner';
  delete from public.groups where owner_id = uid;
end $$;

revoke execute on function public.send_feedback, public.prepare_account_deletion from public, anon;
