create table public.housing_group_member_history (
  group_id uuid not null references public.housing_groups(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id, profile_id)
);

create index housing_group_member_history_profile_idx
  on public.housing_group_member_history (profile_id, group_id);

alter table public.housing_group_member_history enable row level security;
revoke all on public.housing_group_member_history from public, anon, authenticated;

insert into public.housing_group_member_history (group_id, profile_id, joined_at)
select member.group_id, member.profile_id, member.joined_at
from public.housing_group_members member
on conflict do nothing;

insert into public.housing_group_member_history (group_id, profile_id)
select request.group_id, request.requester_id
from public.housing_group_join_requests request
where request.status = 'accepted'
on conflict do nothing;

insert into public.housing_group_member_history (group_id, profile_id)
select group_row.id, match_profile.profile_id
from public.housing_groups group_row
join public.matches match_row on match_row.id = group_row.origin_match_id
cross join lateral (
  values (match_row.profile_a_id), (match_row.profile_b_id)
) match_profile(profile_id)
on conflict do nothing;

create or replace function public.remember_housing_group_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    insert into public.housing_group_member_history (group_id, profile_id, joined_at)
    values (old.group_id, old.profile_id, old.joined_at)
    on conflict do nothing;
    return old;
  end if;

  insert into public.housing_group_member_history (group_id, profile_id, joined_at)
  values (new.group_id, new.profile_id, new.joined_at)
  on conflict do nothing;
  return new;
end;
$$;

create trigger housing_group_members_remember_insert
  after insert on public.housing_group_members
  for each row execute function public.remember_housing_group_member();

create trigger housing_group_members_remember_delete
  before delete on public.housing_group_members
  for each row execute function public.remember_housing_group_member();
