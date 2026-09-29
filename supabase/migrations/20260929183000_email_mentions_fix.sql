-- Step 7 fix: email_mentions_due left out the group id, so its rows didn't
-- match its declared columns and every mention email failed. Same function,
-- with b.group_id in its output. Permissions carry over with create or replace.

create or replace function public.email_mentions_due(p_window interval default interval '10 minutes', p_only uuid[] default null)
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
    select r.user_id, r.email, b.group_id, g.name,
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
