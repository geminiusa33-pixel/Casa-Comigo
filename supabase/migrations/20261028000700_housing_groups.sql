update public.profiles
set preferred_housemates = least(20, coalesce(preferred_housemates, 1) + 1);

alter table public.profiles
  drop constraint if exists profiles_preferred_housemates_check;

alter table public.profiles
  add constraint profiles_preferred_housemates_check
  check (preferred_housemates between 2 and 20);

create table public.housing_groups (
  id uuid primary key default extensions.gen_random_uuid(),
  origin_match_id uuid unique references public.matches(id) on delete set null,
  target_occupants smallint not null check (target_occupants between 2 and 20),
  status text not null default 'open' check (status in ('open', 'completed')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index housing_groups_open_idx on public.housing_groups (created_at desc) where status = 'open';

create table public.housing_group_members (
  group_id uuid not null references public.housing_groups(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id, profile_id)
);
create index housing_group_members_profile_idx on public.housing_group_members (profile_id, joined_at desc);

create table public.housing_group_join_requests (
  id uuid primary key default extensions.gen_random_uuid(),
  group_id uuid not null references public.housing_groups(id) on delete cascade,
  requester_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
create unique index housing_group_pending_join_unique
  on public.housing_group_join_requests (group_id, requester_id)
  where status = 'pending';
create index housing_group_requests_requester_idx
  on public.housing_group_join_requests (requester_id, created_at desc);

create table public.housing_group_join_votes (
  request_id uuid not null references public.housing_group_join_requests(id) on delete cascade,
  voter_id uuid not null references public.profiles(id) on delete cascade,
  accepted boolean not null,
  voted_at timestamptz not null default now(),
  primary key (request_id, voter_id)
);

create table public.housing_group_completion_votes (
  group_id uuid not null references public.housing_groups(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  confirmed_at timestamptz not null default now(),
  primary key (group_id, profile_id)
);

create table public.housing_group_messages (
  id uuid primary key default extensions.gen_random_uuid(),
  group_id uuid not null references public.housing_groups(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index housing_group_messages_group_idx
  on public.housing_group_messages (group_id, created_at desc);

alter table public.housing_groups enable row level security;
alter table public.housing_group_members enable row level security;
alter table public.housing_group_join_requests enable row level security;
alter table public.housing_group_join_votes enable row level security;
alter table public.housing_group_completion_votes enable row level security;
alter table public.housing_group_messages enable row level security;

create or replace function public.is_housing_group_member(target_group uuid, candidate uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select candidate is not null and exists (
    select 1 from public.housing_group_members member
    where member.group_id = target_group and member.profile_id = candidate
  );
$$;
revoke all on function public.is_housing_group_member(uuid, uuid) from public, anon, authenticated;

create or replace function public.can_access_housing_group(target_group uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_housing_group_member(target_group, (select auth.uid()));
$$;
revoke all on function public.can_access_housing_group(uuid) from public, anon;
grant execute on function public.can_access_housing_group(uuid) to authenticated;

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
      and not public.is_housing_group_member(group_row.id, (select auth.uid()))
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

create policy "housing group participant or eligible discovery read"
  on public.housing_groups for select to authenticated
  using (
    public.can_access_housing_group(id)
    or public.is_housing_group_discoverable(id)
  );
create policy "housing group members participant or eligible discovery read"
  on public.housing_group_members for select to authenticated
  using (
    profile_id = (select auth.uid())
    or public.can_access_housing_group(group_id)
    or public.is_housing_group_discoverable(group_id)
  );
create policy "housing group request participant read"
  on public.housing_group_join_requests for select to authenticated
  using (
    requester_id = (select auth.uid())
    or public.can_access_housing_group(group_id)
  );
create policy "housing group vote participant read"
  on public.housing_group_join_votes for select to authenticated
  using (
    voter_id = (select auth.uid())
    or exists (
      select 1 from public.housing_group_join_requests request
      where request.id = request_id
        and public.can_access_housing_group(request.group_id)
    )
  );
create policy "housing group completion participant read"
  on public.housing_group_completion_votes for select to authenticated
  using (
    profile_id = (select auth.uid())
    or public.can_access_housing_group(group_id)
  );
create policy "housing group message participant read"
  on public.housing_group_messages for select to authenticated
  using (
    public.can_access_housing_group(group_id)
    and not exists (
      select 1 from public.housing_group_members member
      where member.group_id = housing_group_messages.group_id
        and member.profile_id <> (select auth.uid())
        and public.is_blocked_user((select auth.uid()), member.profile_id)
    )
  );

drop policy if exists "profile photos visible to eligible viewers" on storage.objects;
create policy "profile photos visible to eligible viewers" on storage.objects for select to authenticated
  using (
    bucket_id = 'profile-photos'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or exists (
        select 1
        from public.profiles profile
        where profile.id::text = (storage.foldername(name))[1]
          and (
            public.is_area_compatible((select auth.uid()), profile.id)
            or exists (
              select 1 from public.matches match
              where (
                (match.profile_a_id = (select auth.uid()) and match.profile_b_id = profile.id)
                or (match.profile_b_id = (select auth.uid()) and match.profile_a_id = profile.id)
              )
              and not public.is_blocked_user(match.profile_a_id, match.profile_b_id)
            )
            or exists (
              select 1
              from public.housing_group_members own_member
              join public.housing_group_members other_member
                on other_member.group_id = own_member.group_id
              where own_member.profile_id = (select auth.uid())
                and other_member.profile_id = profile.id
                and public.can_access_housing_group(own_member.group_id)
                and not public.is_blocked_user((select auth.uid()), profile.id)
            )
            or exists (
              select 1
              from public.housing_group_join_requests request
              join public.housing_group_members member on member.group_id = request.group_id
              where request.requester_id = profile.id
                and request.status = 'pending'
                and member.profile_id = (select auth.uid())
                and not public.is_blocked_user((select auth.uid()), profile.id)
            )
          )
      )
    )
  );

grant select on public.housing_groups,
  public.housing_group_members,
  public.housing_group_join_requests,
  public.housing_group_join_votes,
  public.housing_group_completion_votes,
  public.housing_group_messages to authenticated;

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

  insert into public.housing_groups (origin_match_id, target_occupants)
  values (target_match, first_capacity)
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

  return resulting_group;
end;
$$;
revoke all on function public.create_housing_group_for_match(uuid) from public, anon, authenticated;

create or replace function public.create_housing_group_after_match()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.create_housing_group_for_match(new.id);
  return new;
end;
$$;
create trigger matches_create_housing_group
  after insert on public.matches
  for each row execute function public.create_housing_group_after_match();

create or replace function public.refresh_housing_groups_after_capacity_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  matched_profile record;
begin
  if old.preferred_housemates is not distinct from new.preferred_housemates then
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
create trigger profiles_refresh_housing_groups_after_capacity_change
  after update of preferred_housemates on public.profiles
  for each row execute function public.refresh_housing_groups_after_capacity_change();

insert into public.housing_groups (origin_match_id, target_occupants)
select match.id, first_profile.preferred_housemates
from public.matches match
join public.profiles first_profile on first_profile.id = match.profile_a_id
join public.profiles second_profile on second_profile.id = match.profile_b_id
where first_profile.preferred_housemates is not null
  and first_profile.preferred_housemates >= 2
  and first_profile.preferred_housemates = second_profile.preferred_housemates
on conflict (origin_match_id) do nothing;

insert into public.housing_group_members (group_id, profile_id)
select group_row.id, member.profile_id
from public.housing_groups group_row
join public.matches match on match.id = group_row.origin_match_id
cross join lateral (
  values (match.profile_a_id), (match.profile_b_id)
) member(profile_id)
on conflict (group_id, profile_id) do nothing;

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

  select preferred_housemates into actor_capacity
  from public.profiles where id = actor;
  if actor_capacity is distinct from target_capacity then
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
  member_count integer;
  approval_count integer;
begin
  select request.group_id, request.status, group_row.target_occupants
    into target_group, request_status, target_capacity
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
           not public.is_area_compatible(
             (select requester_id from public.housing_group_join_requests where id = target_request),
             member.profile_id
           )
           or not public.is_area_compatible(
             member.profile_id,
             (select requester_id from public.housing_group_join_requests where id = target_request)
           )
         )
     ) then
    update public.housing_group_join_requests
    set status = 'declined', decided_at = now()
    where id = target_request;
    return 'declined';
  end if;

  insert into public.housing_group_members (group_id, profile_id)
  select target_group, requester_id
  from public.housing_group_join_requests
  where id = target_request
  on conflict (group_id, profile_id) do nothing;

  update public.housing_group_join_requests
  set status = 'accepted', decided_at = now()
  where id = target_request;
  return 'accepted';
end;
$$;
revoke all on function public.vote_housing_group_join(uuid, boolean) from public, anon;
grant execute on function public.vote_housing_group_join(uuid, boolean) to authenticated;

create or replace function public.confirm_housing_group_completion(target_group uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  member_count integer;
  confirmation_count integer;
begin
  if actor is null then
    return false;
  end if;

  perform 1 from public.housing_groups
  where id = target_group and status = 'open'
  for update;
  if not found or not exists (
    select 1 from public.housing_group_members
    where group_id = target_group and profile_id = actor
  ) then
    return false;
  end if;

  insert into public.housing_group_completion_votes (group_id, profile_id)
  values (target_group, actor)
  on conflict (group_id, profile_id) do nothing;

  select count(*) into member_count from public.housing_group_members
  where group_id = target_group;
  select count(*) into confirmation_count from public.housing_group_completion_votes
  where group_id = target_group;

  if confirmation_count = member_count then
    update public.housing_groups
    set status = 'completed', completed_at = now()
    where id = target_group and status = 'open';

    update public.housing_group_join_requests
    set status = 'declined', decided_at = now()
    where group_id = target_group and status = 'pending';
  end if;

  return true;
end;
$$;
revoke all on function public.confirm_housing_group_completion(uuid) from public, anon;
grant execute on function public.confirm_housing_group_completion(uuid) to authenticated;

create or replace function public.send_housing_group_message(target_group uuid, message_body text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  message_id uuid;
begin
  if actor is null or char_length(pg_catalog.btrim(message_body)) not between 1 and 4000
     or not public.is_housing_group_member(target_group, actor)
     or exists (
       select 1 from public.housing_group_members member
       where member.group_id = target_group
         and member.profile_id <> actor
         and public.is_blocked_user(actor, member.profile_id)
     ) then
    return null;
  end if;

  insert into public.housing_group_messages (group_id, sender_id, body)
  values (target_group, actor, pg_catalog.btrim(message_body))
  returning id into message_id;

  return message_id;
end;
$$;
revoke all on function public.send_housing_group_message(uuid, text) from public, anon;
grant execute on function public.send_housing_group_message(uuid, text) to authenticated;
