-- Step 11: no daily import limit (PRD F15.4, v1.3.2). Sydney removed it after
-- failed tries used up her day; spend is capped in the Anthropic console.
-- start_import keeps its shape, so 'limited' is simply never returned.
create or replace function public.start_import(p_method text, p_hash text, p_groups uuid[])
returns table (status text, import_id uuid, reuse jsonb)
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.require_user();
  new_id uuid;
  prior jsonb;
begin
  if p_method not in ('text', 'screenshots', 'both') or p_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'bad import' using errcode = '22023';
  end if;
  select i.extracted into prior from public.imports i
    where i.user_id = uid and i.input_hash = p_hash and i.extracted is not null
    order by i.created_at desc limit 1;
  insert into public.imports (user_id, method, input_hash, group_ids)
    values (uid, p_method, p_hash, coalesce((
      select array_agg(distinct g) from unnest(coalesce(p_groups, '{}')) g where public.is_member(g)
    ), '{}'))
    returning id into new_id;
  return query select 'started'::text, new_id, prior;
end $$;
