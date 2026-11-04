alter table public.profiles
  add column rent_contribution_range text
    check (rent_contribution_range is null or rent_contribution_range in ('200-300', '301-400', '401-500', '501-600'));

alter table public.search_areas
  drop constraint if exists search_areas_radius_km_check;

update public.search_areas
set radius_km = greatest(5, least(50, round(radius_km / 5) * 5));

alter table public.search_areas
  add constraint search_areas_radius_km_check
  check (radius_km between 5 and 50 and mod(radius_km, 5) = 0);

create or replace function public.prevent_incompatible_group_rent_range_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.rent_contribution_range is not distinct from new.rent_contribution_range then
    return new;
  end if;

  if exists (
    select 1
    from public.housing_group_members own_member
    join public.housing_group_members other_member
      on other_member.group_id = own_member.group_id
     and other_member.profile_id <> new.id
    join public.profiles other_profile on other_profile.id = other_member.profile_id
    where own_member.profile_id = new.id
      and other_profile.rent_contribution_range is not null
      and other_profile.rent_contribution_range is distinct from new.rent_contribution_range
  ) then
    raise exception 'Para alterar o escalão de renda, saia primeiro do grupo atual.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create trigger profiles_prevent_incompatible_group_rent_range_change
  before update of rent_contribution_range on public.profiles
  for each row execute function public.prevent_incompatible_group_rent_range_change();

create or replace function public.prevent_incompatible_housing_group_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  member_range text;
begin
  select rent_contribution_range into member_range
  from public.profiles
  where id = new.profile_id;

  if member_range is null or exists (
    select 1
    from public.housing_group_members member
    join public.profiles profile on profile.id = member.profile_id
    where member.group_id = new.group_id
      and profile.rent_contribution_range is distinct from member_range
  ) then
    raise exception 'Todos os membros do grupo têm de escolher o mesmo escalão de renda.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger housing_group_members_require_matching_rent_range
  before insert on public.housing_group_members
  for each row execute function public.prevent_incompatible_housing_group_member();

create trigger housing_group_members_update_matching_rent_range
  before update of group_id, profile_id on public.housing_group_members
  for each row execute function public.prevent_incompatible_housing_group_member();

create or replace function public.is_housing_group_discoverable(target_group uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null and exists (
    select 1
    from public.housing_groups group_row
    join public.profiles candidate_profile on candidate_profile.id = (select auth.uid())
    where group_row.id = target_group
      and group_row.status = 'open'
      and group_row.target_occupants = candidate_profile.preferred_housemates
      and candidate_profile.rent_contribution_range is not null
      and not public.is_housing_group_member(group_row.id, (select auth.uid()))
      and not exists (
        select 1
        from public.housing_group_members member
        join public.profiles member_profile on member_profile.id = member.profile_id
        where member.group_id = group_row.id
          and member_profile.rent_contribution_range is distinct from candidate_profile.rent_contribution_range
      )
      and (select count(*) from public.housing_group_members member
           where member.group_id = group_row.id) < group_row.target_occupants
      and exists (
        select 1 from public.housing_group_members member
        where member.group_id = group_row.id
          and public.is_area_compatible((select auth.uid()), member.profile_id)
          and public.is_area_compatible(member.profile_id, (select auth.uid()))
      )
      and not exists (
        select 1 from public.housing_group_members member
        where member.group_id = group_row.id
          and (not public.is_area_compatible((select auth.uid()), member.profile_id)
               or not public.is_area_compatible(member.profile_id, (select auth.uid())))
      )
  );
$$;
revoke all on function public.is_housing_group_discoverable(uuid) from public, anon;
grant execute on function public.is_housing_group_discoverable(uuid) to authenticated;

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
  first_range text;
  second_range text;
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

  select preferred_housemates, rent_contribution_range
    into first_capacity, first_range
  from public.profiles where id = first_profile;
  select preferred_housemates, rent_contribution_range
    into second_capacity, second_range
  from public.profiles where id = second_profile;

  if first_capacity is null or first_capacity < 2 or first_capacity <> second_capacity
     or first_range is null or first_range <> second_range then
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

create or replace function public.refresh_housing_groups_after_capacity_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  matched_profile record;
begin
  if old.preferred_housemates is not distinct from new.preferred_housemates
     and old.rent_contribution_range is not distinct from new.rent_contribution_range then
    return new;
  end if;

  for matched_profile in
    select match.id
    from public.matches match
    where old.id in (match.profile_a_id, match.profile_b_id)
  loop
    perform public.create_housing_group_for_match(matched_profile.id);
  end loop;

  return new;
end;
$$;

create trigger profiles_refresh_housing_groups_after_rent_range_change
  after update of rent_contribution_range on public.profiles
  for each row execute function public.refresh_housing_groups_after_capacity_change();

create or replace function public.request_housing_group_join(target_group uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  target_capacity smallint;
  actor_capacity smallint;
  actor_range text;
  member_count integer;
  request_id uuid;
begin
  if actor is null then
    return null;
  end if;

  select target_occupants into target_capacity
  from public.housing_groups
  where id = target_group and status = 'open'
  for update;
  if not found then
    return null;
  end if;

  select preferred_housemates, rent_contribution_range
    into actor_capacity, actor_range
  from public.profiles where id = actor;
  if actor_capacity is distinct from target_capacity or actor_range is null then
    return null;
  end if;

  select count(*) into member_count
  from public.housing_group_members
  where group_id = target_group;
  if member_count >= target_capacity
     or exists (
       select 1 from public.housing_group_members
       where group_id = target_group and profile_id = actor
     )
     or exists (
       select 1
       from public.housing_group_members member
       join public.profiles profile on profile.id = member.profile_id
       where member.group_id = target_group
         and profile.rent_contribution_range is distinct from actor_range
     )
     or not exists (
       select 1 from public.housing_group_members member
       where member.group_id = target_group
         and public.is_area_compatible(actor, member.profile_id)
         and public.is_area_compatible(member.profile_id, actor)
     )
     or exists (
       select 1 from public.housing_group_members member
       where member.group_id = target_group
         and (not public.is_area_compatible(actor, member.profile_id)
              or not public.is_area_compatible(member.profile_id, actor))
     ) then
    return null;
  end if;

  insert into public.housing_group_join_requests (group_id, requester_id)
  values (target_group, actor)
  on conflict (group_id, requester_id) where status = 'pending' do nothing
  returning id into request_id;

  if request_id is null then
    select id into request_id
    from public.housing_group_join_requests
    where group_id = target_group and requester_id = actor and status = 'pending';
  end if;

  return request_id;
end;
$$;
revoke all on function public.request_housing_group_join(uuid) from public, anon;
grant execute on function public.request_housing_group_join(uuid) to authenticated;

create or replace function public.vote_housing_group_join(target_request uuid, accept_request boolean)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  target_group uuid;
  request_status text;
  target_capacity smallint;
  requester uuid;
  member_count integer;
  approval_count integer;
begin
  select request.group_id, request.status, group_row.target_occupants, request.requester_id
    into target_group, request_status, target_capacity, requester
  from public.housing_group_join_requests request
  join public.housing_groups group_row on group_row.id = request.group_id
  where request.id = target_request;
  if not found or request_status <> 'pending' then
    return 'unavailable';
  end if;

  perform 1 from public.housing_groups
  where id = target_group and status = 'open'
  for update;
  if not found or not exists (
    select 1 from public.housing_group_members
    where group_id = target_group and profile_id = actor
  ) then
    return 'unavailable';
  end if;

  insert into public.housing_group_join_votes (request_id, voter_id, accepted)
  values (target_request, actor, accept_request)
  on conflict (request_id, voter_id)
  do update set accepted = excluded.accepted, voted_at = now();

  if not accept_request then
    update public.housing_group_join_requests
    set status = 'declined', decided_at = now()
    where id = target_request and status = 'pending';
    return 'declined';
  end if;

  select count(*) into member_count
  from public.housing_group_members
  where group_id = target_group;
  select count(*) into approval_count
  from public.housing_group_join_votes vote
  join public.housing_group_members member
    on member.group_id = target_group and member.profile_id = vote.voter_id
  where vote.request_id = target_request and vote.accepted;

  if approval_count < member_count then
    return 'pending';
  end if;

  if member_count >= target_capacity
     or exists (
       select 1 from public.housing_group_members member
       where member.group_id = target_group
         and (
           not public.is_area_compatible(requester, member.profile_id)
           or not public.is_area_compatible(member.profile_id, requester)
         )
     )
     or not exists (
       select 1 from public.profiles requester_profile
       where requester_profile.id = requester
         and requester_profile.rent_contribution_range is not null
         and not exists (
           select 1
           from public.housing_group_members member
           join public.profiles member_profile on member_profile.id = member.profile_id
           where member.group_id = target_group
             and member_profile.rent_contribution_range is distinct from requester_profile.rent_contribution_range
         )
     ) then
    update public.housing_group_join_requests
    set status = 'declined', decided_at = now()
    where id = target_request;
    return 'declined';
  end if;

  insert into public.housing_group_members (group_id, profile_id)
  values (target_group, requester)
  on conflict (group_id, profile_id) do nothing;

  update public.housing_group_join_requests
  set status = 'accepted', decided_at = now()
  where id = target_request;
  return 'accepted';
end;
$$;
revoke all on function public.vote_housing_group_join(uuid, boolean) from public, anon;
grant execute on function public.vote_housing_group_join(uuid, boolean) to authenticated;

create or replace function public.record_like(recipient uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  first_profile uuid;
  second_profile uuid;
  resulting_match uuid;
begin
  if actor is null
     or not public.is_area_compatible(actor, recipient)
     or not exists (
       select 1
       from public.profiles actor_profile
       join public.profiles recipient_profile on recipient_profile.id = recipient
       where actor_profile.id = actor
         and actor_profile.discovery_visible
         and recipient_profile.discovery_visible
         and actor_profile.rent_contribution_range is not null
         and actor_profile.rent_contribution_range = recipient_profile.rent_contribution_range
     ) then
    raise exception 'Perfil indisponível para descoberta ou escalão de renda incompatível'
      using errcode = '42501';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      least(actor::text, recipient::text) || ':' || greatest(actor::text, recipient::text),
      0
    )
  );

  if exists (
    select 1 from public.profile_passes
    where actor_id = actor
      and recipient_id = recipient
      and passed_at > now() - interval '3 days'
  ) then
    raise exception 'Este perfil foi rejeitado recentemente' using errcode = '42501';
  end if;

  insert into public.likes (actor_id, recipient_id)
  values (actor, recipient)
  on conflict (actor_id, recipient_id) do nothing;

  if exists (
    select 1 from public.likes
    where actor_id = recipient and recipient_id = actor
  ) then
    first_profile := least(actor, recipient);
    second_profile := greatest(actor, recipient);

    insert into public.matches (profile_a_id, profile_b_id)
    values (first_profile, second_profile)
    on conflict (profile_a_id, profile_b_id) do nothing
    returning id into resulting_match;

    if resulting_match is null then
      select id into resulting_match from public.matches
      where profile_a_id = first_profile and profile_b_id = second_profile;
    end if;

    insert into public.conversations (match_id)
    values (resulting_match)
    on conflict (match_id) do nothing;
    return resulting_match;
  end if;

  return null;
end;
$$;
revoke all on function public.record_like(uuid) from public, anon;
grant execute on function public.record_like(uuid) to authenticated;
