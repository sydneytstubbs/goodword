-- Step 17: live new good words on Home (PRD F16.3, F16.9). Groups already
-- broadcast on shelf:<group> (F5.6). A good word shared with friends now
-- broadcasts on friends:<author>, and only that person's friends can listen.
-- Imports stay quiet (F16.3), so they don't broadcast here. Messages carry
-- ids, never text.

create function public.broadcast_friends_good_word() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.friends_shared_at is not null
    and (tg_op = 'INSERT' or old.friends_shared_at is null)
    and new.source <> 'import' then
    perform realtime.send(
      jsonb_build_object('good_word_id', new.id, 'user_id', new.user_id),
      'good_word',
      'friends:' || new.user_id::text,
      true
    );
  end if;
  return new;
end $$;

create trigger good_words_friends_broadcast after insert or update of friends_shared_at on public.good_words
  for each row execute function public.broadcast_friends_good_word();

-- Who can listen: as before, plus a person's friends on their friends topic.
create or replace function public.can_hear(p_topic text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare
  parts text[] := string_to_array(coalesce(p_topic, ''), ':');
begin
  if parts[1] = 'activity' and cardinality(parts) = 2 then
    return parts[2] = (select auth.uid())::text;
  end if;
  if parts[1] = 'conversation' and cardinality(parts) = 3
    and parts[2] ~ '^[0-9a-f-]{36}$' and parts[3] ~ '^[0-9a-f-]{36}$' then
    return public.is_member(parts[2]::uuid);
  end if;
  if parts[1] = 'shelf' and cardinality(parts) = 2 and parts[2] ~ '^[0-9a-f-]{36}$' then
    return public.is_member(parts[2]::uuid);
  end if;
  if parts[1] = 'friends' and cardinality(parts) = 2 and parts[2] ~ '^[0-9a-f-]{36}$' then
    return public.is_friend(parts[2]::uuid);
  end if;
  return false;
exception when others then
  return false;
end $$;

revoke execute on function public.broadcast_friends_good_word from public, anon, authenticated;
