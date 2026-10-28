alter table public.profiles
  add column monthly_budget numeric(10, 2)
    check (monthly_budget is null or monthly_budget between 0 and 100000),
  add column lease_holder_preference text not null default 'any'
    check (lease_holder_preference in ('any', 'own_name', 'joint', 'other')),
  add column bills_preference text not null default 'discuss'
    check (bills_preference in ('discuss', 'split_equally', 'separate')),
  add column furnished_preference text not null default 'any'
    check (furnished_preference in ('any', 'furnished', 'unfurnished', 'partial')),
  add column preferred_bathrooms smallint
    check (preferred_bathrooms is null or preferred_bathrooms between 1 and 20),
  add column preferred_bedrooms smallint
    check (preferred_bedrooms is null or preferred_bedrooms between 1 and 30),
  add column home_type_preference text not null default 'any'
    check (home_type_preference in ('any', 'apartment', 'house', 'room')),
  add column move_in_timing text not null default 'flexible'
    check (move_in_timing in ('flexible', 'immediately', 'one_to_three_months', 'three_plus_months')),
  add column minimum_lease_months smallint
    check (minimum_lease_months is null or minimum_lease_months between 1 and 120);

create or replace function public.cancel_match(target_match uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  first_profile uuid;
  second_profile uuid;
begin
  if actor is null then
    return false;
  end if;

  select profile_a_id, profile_b_id
    into first_profile, second_profile
  from public.matches
  where id = target_match;

  if not found or actor not in (first_profile, second_profile) then
    return false;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(first_profile::text || ':' || second_profile::text, 0)
  );

  delete from public.matches
  where id = target_match
    and actor in (profile_a_id, profile_b_id);

  if not found then
    return false;
  end if;

  delete from public.likes
  where (actor_id = first_profile and recipient_id = second_profile)
     or (actor_id = second_profile and recipient_id = first_profile);

  return true;
end;
$$;

revoke all on function public.cancel_match(uuid) from public, anon;
grant execute on function public.cancel_match(uuid) to authenticated;
