alter table public.housing_groups
  add column group_name text not null default 'Casa partilhada'
    check (char_length(group_name) between 1 and 80);

alter table public.housing_group_messages
  add column source_message_id uuid references public.messages(id) on delete set null;

create unique index housing_group_messages_source_unique
  on public.housing_group_messages (source_message_id)
  where source_message_id is not null;

update public.housing_groups group_row
set group_name = coalesce(
  nullif('Casa em ' || area.area_label, 'Casa em '),
  'Casa partilhada'
)
from public.housing_group_members member
join public.search_areas area on area.profile_id = member.profile_id
where member.group_id = group_row.id
  and member.joined_at = (
    select min(first_member.joined_at)
    from public.housing_group_members first_member
    where first_member.group_id = group_row.id
  );

create or replace function public.create_housing_group_for_match(target_match uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  first_profile uuid;
  second_profile uuid;
  first_capacity smallint;
  second_capacity smallint;
  area_name text;
  resulting_group uuid;
begin
  select profile_a_id, profile_b_id
    into first_profile, second_profile
  from public.matches
  where id = target_match;

  if not found then
    return null;
  end if;

  select preferred_housemates into first_capacity
  from public.profiles where id = first_profile;
  select preferred_housemates into second_capacity
  from public.profiles where id = second_profile;

  if first_capacity is null or first_capacity < 2 or first_capacity <> second_capacity then
    return null;
  end if;

  select area_label into area_name
  from public.search_areas
  where profile_id = first_profile;

  insert into public.housing_groups (origin_match_id, target_occupants, group_name)
  values (
    target_match,
    first_capacity,
    coalesce(nullif('Casa em ' || area_name, 'Casa em '), 'Casa partilhada')
  )
  on conflict (origin_match_id) do nothing
  returning id into resulting_group;

  if resulting_group is null then
    select id into resulting_group
    from public.housing_groups
    where origin_match_id = target_match;
  else
    insert into public.housing_group_members (group_id, profile_id)
    values (resulting_group, first_profile), (resulting_group, second_profile);
  end if;

  perform public.copy_match_messages_to_housing_group(target_match);
  return resulting_group;
end;
$$;
revoke all on function public.create_housing_group_for_match(uuid) from public, anon, authenticated;

create or replace function public.copy_match_messages_to_housing_group(target_match uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.housing_group_messages (
    group_id, sender_id, body, created_at, source_message_id
  )
  select group_row.id, message.sender_id, message.body, message.created_at, message.id
  from public.housing_groups group_row
  join public.conversations conversation on conversation.match_id = group_row.origin_match_id
  join public.messages message on message.conversation_id = conversation.id
  where group_row.origin_match_id = target_match
  on conflict (source_message_id) where source_message_id is not null do nothing;
$$;
revoke all on function public.copy_match_messages_to_housing_group(uuid) from public, anon, authenticated;

create or replace function public.copy_match_messages_after_conversation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.copy_match_messages_to_housing_group(new.match_id);
  return new;
end;
$$;
create trigger conversations_copy_messages_to_housing_group
  after insert on public.conversations
  for each row execute function public.copy_match_messages_after_conversation();

create or replace function public.copy_message_to_housing_group()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_match uuid;
begin
  select match_id into target_match
  from public.conversations
  where id = new.conversation_id;
  insert into public.housing_group_messages (
    group_id, sender_id, body, created_at, source_message_id
  )
  select group_row.id, new.sender_id, new.body, new.created_at, new.id
  from public.housing_groups group_row
  where group_row.origin_match_id = target_match
  on conflict (source_message_id) where source_message_id is not null do nothing;
  return new;
end;
$$;
create trigger messages_copy_to_housing_group
  after insert on public.messages
  for each row execute function public.copy_message_to_housing_group();

do $$
declare
  existing_match record;
begin
  for existing_match in
    select origin_match_id
    from public.housing_groups
    where origin_match_id is not null
  loop
    perform public.copy_match_messages_to_housing_group(existing_match.origin_match_id);
  end loop;
end;
$$;
