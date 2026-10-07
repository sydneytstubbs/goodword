-- Step 19: the title page (PRD F16.4), behind the home_enabled flag.
--
-- Each good word you can see that's shared with friends has a conversation
-- under it (F16.5, open question 14), collapsed on the title page to its count
-- and latest comment, and opening in place to its 3 most recent (DS 5.17).
-- This reads all of them for one title at once, for the person asking, with
-- other people's spoiler text withheld (DS 4.2.12). Good words you can't see
-- aren't in it at all, not even as a count (F16.6 rule 4).
create function public.title_word_conversations(p_title uuid)
returns table (good_word_id uuid, comment_count int, unseen boolean, recent jsonb)
language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := public.require_user();
begin
  return query
    select gw.id,
      (select count(*)::int from public.comments c where c.conversation_id = v.id and c.deleted_at is null),
      coalesce((
        select bool_or(c.user_id <> uid and c.created_at > coalesce(r.last_read_at, gw.friends_shared_at))
        from public.comments c
        left join public.conversation_reads r on r.conversation_id = v.id and r.user_id = uid
        where c.conversation_id = v.id and c.deleted_at is null
      ), false),
      coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', x.id, 'user_id', x.user_id, 'author_name', x.author_name, 'body', x.body,
          'mentions', x.mentions, 'is_spoiler', x.is_spoiler, 'created_at', x.created_at, 'edited_at', x.edited_at
        ) order by x.created_at)
        from (
          select c.id, c.user_id, coalesce(p.display_name, '') as author_name,
            case when c.is_spoiler and c.user_id <> uid then null else c.body end as body,
            case when c.is_spoiler and c.user_id <> uid then '[]'::jsonb else public.comment_mention_names(c.id) end as mentions,
            c.is_spoiler, c.created_at, c.edited_at
          from public.comments c
          left join public.profiles p on p.user_id = c.user_id
          where c.conversation_id = v.id and c.deleted_at is null
          order by c.created_at desc
          limit 3
        ) x
      ), '[]'::jsonb)
    from public.good_words gw
    left join public.conversations v on v.good_word_id = gw.id
    where gw.title_id = p_title and gw.friends_shared_at is not null and public.word_visible(gw.id);
end $$;

revoke execute on function public.title_word_conversations from public, anon;
