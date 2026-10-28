create table public.profile_passes (
  actor_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  passed_at timestamptz not null default now(),
  constraint profile_passes_not_self check (actor_id <> recipient_id),
  constraint profile_passes_unique_pair primary key (actor_id, recipient_id)
);

alter table public.profile_passes enable row level security;
create policy "profile pass owner read" on public.profile_passes for select to authenticated
  using (actor_id = (select auth.uid()));
grant select on public.profile_passes to authenticated;

create or replace function public.record_pass(recipient uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
begin
  if actor is null or not public.is_area_compatible(actor, recipient) then
    return false;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      least(actor::text, recipient::text) || ':' || greatest(actor::text, recipient::text),
      0
    )
  );

  if exists (
    select 1
    from public.matches m
    where (m.profile_a_id = least(actor, recipient) and m.profile_b_id = greatest(actor, recipient))
  ) then
    return false;
  end if;

  insert into public.profile_passes (actor_id, recipient_id, passed_at)
  values (actor, recipient, now())
  on conflict (actor_id, recipient_id)
  do update set passed_at = excluded.passed_at;

  return true;
end;
$$;

revoke all on function public.record_pass(uuid) from public, anon;
grant execute on function public.record_pass(uuid) to authenticated;

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
  if actor is null or not public.is_area_compatible(actor, recipient) then
    raise exception 'Perfil indisponível para descoberta' using errcode = '42501';
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
