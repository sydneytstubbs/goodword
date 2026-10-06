-- Step 17: Home's live pill ignores imports (PRD F16.3), so the group
-- broadcast (F5.6) now says where a good word came from. Still ids only,
-- plus the source, never text. Lists keep counting every good word.
create or replace function public.broadcast_good_word() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform realtime.send(
    (select jsonb_build_object('good_word_id', gw.id, 'user_id', gw.user_id, 'source', gw.source)
       from public.good_words gw where gw.id = new.good_word_id),
    'good_word',
    'shelf:' || new.group_id::text,
    true
  );
  return new;
end $$;
