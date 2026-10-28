-- Seed-free local schema foundation. Exact search coordinates are owner-readable only.
create extension if not exists pgcrypto with schema extensions;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 80),
  bio text not null default '' check (char_length(bio) <= 2000),
  preferred_housemates smallint check (preferred_housemates between 1 and 20),
  gender_preference text not null default 'any' check (gender_preference in ('any', 'women', 'men', 'other')),
  has_pets boolean not null default false,
  interests text[] not null default '{}',
  opinions text not null default '' check (char_length(opinions) <= 2000),
  work_schedule text not null default '' check (char_length(work_schedule) <= 500),
  cooking_habits text not null default '' check (char_length(cooking_habits) <= 500),
  discovery_visible boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();

create table public.search_areas (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  latitude numeric(8, 5) not null check (latitude between -90 and 90),
  longitude numeric(8, 5) not null check (longitude between -180 and 180),
  radius_km numeric(6, 2) not null check (radius_km > 0 and radius_km <= 250),
  area_label text not null default '' check (char_length(area_label) <= 160),
  location_source text not null check (location_source in ('gps', 'manual')),
  location_consent_at timestamptz,
  updated_at timestamptz not null default timezone('utc', now()),
  constraint gps_location_requires_consent
    check (location_source <> 'gps' or location_consent_at is not null)
);
create trigger search_areas_set_updated_at before update on public.search_areas
for each row execute function public.set_updated_at();

create table public.profile_photos (
  id uuid primary key default extensions.gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  storage_object_path text not null unique,
  display_order smallint not null default 0 check (display_order between 0 and 20),
  created_at timestamptz not null default timezone('utc', now())
);

create table public.likes (
  id uuid primary key default extensions.gen_random_uuid(),
  actor_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  constraint likes_not_self check (actor_id <> recipient_id),
  constraint likes_unique_pair unique (actor_id, recipient_id)
);
create index likes_recipient_idx on public.likes (recipient_id, created_at desc);

create table public.matches (
  id uuid primary key default extensions.gen_random_uuid(),
  profile_a_id uuid not null references public.profiles(id) on delete cascade,
  profile_b_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  constraint matches_canonical_pair check (profile_a_id < profile_b_id),
  constraint matches_unique_pair unique (profile_a_id, profile_b_id)
);
create index matches_b_idx on public.matches (profile_b_id, created_at desc);

create table public.conversations (
  id uuid primary key default extensions.gen_random_uuid(),
  match_id uuid not null unique references public.matches(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.messages (
  id uuid primary key default extensions.gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default timezone('utc', now())
);
create index messages_conversation_idx on public.messages (conversation_id, created_at);

create table public.visit_requests (
  id uuid primary key default extensions.gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  listing_id uuid,
  proposed_at timestamptz,
  note text not null default '' check (char_length(note) <= 1000),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint visit_request_not_self check (requester_id <> recipient_id)
);
create trigger visit_requests_set_updated_at before update on public.visit_requests
for each row execute function public.set_updated_at();

create table public.house_listings (
  id uuid primary key default extensions.gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  description text not null default '' check (char_length(description) <= 4000),
  approximate_area text not null check (char_length(approximate_area) between 1 and 160),
  monthly_rent numeric(10, 2) check (monthly_rent is null or monthly_rent >= 0),
  details jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);
create index house_listings_active_created_idx on public.house_listings (active, created_at desc);
create index house_listings_owner_idx on public.house_listings (owner_id, created_at desc);
create trigger house_listings_set_updated_at before update on public.house_listings
for each row execute function public.set_updated_at();

alter table public.visit_requests
  add constraint visit_requests_listing_fk
  foreign key (listing_id) references public.house_listings(id) on delete set null;

create table public.house_favorites (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  listing_id uuid not null references public.house_listings(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (profile_id, listing_id)
);
create index house_favorites_listing_idx on public.house_favorites (listing_id);

create table public.profile_blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (blocker_id, blocked_id),
  constraint blocks_not_self check (blocker_id <> blocked_id)
);

create table public.profile_reports (
  id uuid primary key default extensions.gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reported_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null check (char_length(reason) between 1 and 1000),
  created_at timestamptz not null default timezone('utc', now()),
  constraint reports_not_self check (reporter_id <> reported_id)
);

-- Helpers used by policies and the transactional like operation. The definer
-- functions expose only a boolean / match identifier, never private coordinates.
create or replace function public.is_blocked_user(profile_one uuid, profile_two uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profile_blocks b
    where (b.blocker_id = profile_one and b.blocked_id = profile_two)
       or (b.blocker_id = profile_two and b.blocked_id = profile_one)
  );
$$;
revoke all on function public.is_blocked_user(uuid, uuid) from public, anon;
grant execute on function public.is_blocked_user(uuid, uuid) to authenticated;

create or replace function public.distance_km(lat_one double precision, lon_one double precision, lat_two double precision, lon_two double precision)
returns double precision
language sql
immutable
strict
as $$
  select 6371.0 * acos(least(1.0, greatest(-1.0,
    sin(radians(lat_one)) * sin(radians(lat_two))
    + cos(radians(lat_one)) * cos(radians(lat_two)) * cos(radians(lon_two - lon_one))
  )));
$$;
revoke all on function public.distance_km(double precision, double precision, double precision, double precision) from public, anon;
grant execute on function public.distance_km(double precision, double precision, double precision, double precision) to authenticated;

create or replace function public.is_area_compatible(actor uuid, recipient uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select actor is not null and recipient is not null and actor <> recipient
    and not public.is_blocked_user(actor, recipient)
    and exists (
      select 1
      from public.profiles pa
      join public.profiles pb on pb.id = recipient and pb.discovery_visible
      join public.search_areas sa on sa.profile_id = actor
      join public.search_areas sb on sb.profile_id = recipient
      where pa.id = actor and pa.discovery_visible
        and public.distance_km(
          sa.latitude::double precision, sa.longitude::double precision,
          sb.latitude::double precision, sb.longitude::double precision
        ) <= sa.radius_km
        and public.distance_km(
          sa.latitude::double precision, sa.longitude::double precision,
          sb.latitude::double precision, sb.longitude::double precision
        ) <= sb.radius_km
    );
$$;
revoke all on function public.is_area_compatible(uuid, uuid) from public, anon;
grant execute on function public.is_area_compatible(uuid, uuid) to authenticated;

-- A single RPC records a like and, only for a reciprocal eligible pair, creates
-- one canonical match and conversation within the same database transaction.
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

  -- Serialize operations for this pair so two simultaneous reciprocal likes cannot
  -- both miss the other's uncommitted insert and leave a match uncreated.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      least(actor::text, recipient::text) || ':' || greatest(actor::text, recipient::text),
      0
    )
  );

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

-- A profile row is provisioned when Supabase Auth creates an account.
create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.create_profile_for_new_user();

alter table public.profiles enable row level security;
alter table public.search_areas enable row level security;
alter table public.profile_photos enable row level security;
alter table public.likes enable row level security;
alter table public.matches enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.visit_requests enable row level security;
alter table public.house_listings enable row level security;
alter table public.house_favorites enable row level security;
alter table public.profile_blocks enable row level security;
alter table public.profile_reports enable row level security;

create policy "profiles owner or discoverable read" on public.profiles for select to authenticated
  using (
    (id = (select auth.uid()) or discovery_visible = true)
    and not public.is_blocked_user(id, (select auth.uid()))
  );
create policy "profiles owner insert" on public.profiles for insert to authenticated with check (id = (select auth.uid()));
create policy "profiles owner update" on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "search area owner read" on public.search_areas for select to authenticated using (profile_id = (select auth.uid()));
create policy "search area owner insert" on public.search_areas for insert to authenticated with check (profile_id = (select auth.uid()));
create policy "search area owner update" on public.search_areas for update to authenticated using (profile_id = (select auth.uid())) with check (profile_id = (select auth.uid()));
create policy "search area owner delete" on public.search_areas for delete to authenticated using (profile_id = (select auth.uid()));

create policy "photos owner read" on public.profile_photos for select to authenticated using (profile_id = (select auth.uid()));
create policy "photos owner insert" on public.profile_photos for insert to authenticated with check (profile_id = (select auth.uid()));
create policy "photos owner delete" on public.profile_photos for delete to authenticated using (profile_id = (select auth.uid()));

create policy "likes actor read" on public.likes for select to authenticated using (actor_id = (select auth.uid()));
create policy "likes actor delete" on public.likes for delete to authenticated using (actor_id = (select auth.uid()));

create policy "matches participant read" on public.matches for select to authenticated
  using ((select auth.uid()) in (profile_a_id, profile_b_id));
create policy "conversations participant read" on public.conversations for select to authenticated
  using (exists (
    select 1 from public.matches m where m.id = match_id
      and (select auth.uid()) in (m.profile_a_id, m.profile_b_id)
      and not public.is_blocked_user(m.profile_a_id, m.profile_b_id)
  ));

create policy "messages participants read" on public.messages for select to authenticated
  using (exists (
    select 1 from public.conversations c join public.matches m on m.id = c.match_id
    where c.id = conversation_id and (select auth.uid()) in (m.profile_a_id, m.profile_b_id)
      and not public.is_blocked_user(m.profile_a_id, m.profile_b_id)
  ));
create policy "messages participant send" on public.messages for insert to authenticated
  with check (
    sender_id = (select auth.uid()) and exists (
      select 1 from public.conversations c join public.matches m on m.id = c.match_id
      where c.id = conversation_id and (select auth.uid()) in (m.profile_a_id, m.profile_b_id)
        and not public.is_blocked_user(m.profile_a_id, m.profile_b_id)
    )
  );

create policy "visit request participants read" on public.visit_requests for select to authenticated
  using ((select auth.uid()) in (requester_id, recipient_id));
create policy "visit request requester insert" on public.visit_requests for insert to authenticated
  with check (requester_id = (select auth.uid()));
create policy "active houses read" on public.house_listings for select to authenticated using (active or owner_id = (select auth.uid()));
create policy "house owner insert" on public.house_listings for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "house owner update" on public.house_listings for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "house owner delete" on public.house_listings for delete to authenticated using (owner_id = (select auth.uid()));

create policy "favorites owner read" on public.house_favorites for select to authenticated using (profile_id = (select auth.uid()));
create policy "favorites owner insert" on public.house_favorites for insert to authenticated
  with check (
    profile_id = (select auth.uid())
    and exists (select 1 from public.house_listings h where h.id = listing_id and h.active)
  );
create policy "favorites owner delete" on public.house_favorites for delete to authenticated using (profile_id = (select auth.uid()));

create policy "blocker manages blocks" on public.profile_blocks for all to authenticated
  using (blocker_id = (select auth.uid())) with check (blocker_id = (select auth.uid()));
create policy "reporter inserts report" on public.profile_reports for insert to authenticated
  with check (reporter_id = (select auth.uid()));
create policy "reporter reads own reports" on public.profile_reports for select to authenticated
  using (reporter_id = (select auth.uid()));

-- Explicit table grants; RLS policies above remain the row-level boundary.
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.search_areas to authenticated;
grant select, insert, delete on public.profile_photos to authenticated;
grant select, delete on public.likes to authenticated;
grant select on public.matches, public.conversations to authenticated;
grant select, insert on public.messages to authenticated;
grant select, insert on public.visit_requests to authenticated;
grant select, insert, update, delete on public.house_listings to authenticated;
grant select, insert, delete on public.house_favorites to authenticated;
grant select, insert, update, delete on public.profile_blocks to authenticated;
grant select, insert on public.profile_reports to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-photos', 'profile-photos', false, 10485760, array['image/jpeg', 'image/png', 'image/webp']),
       ('house-photos', 'house-photos', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "private photos owner read" on storage.objects for select to authenticated
  using (bucket_id in ('profile-photos', 'house-photos') and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "private photos owner upload" on storage.objects for insert to authenticated
  with check (bucket_id in ('profile-photos', 'house-photos') and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "private photos owner update" on storage.objects for update to authenticated
  using (bucket_id in ('profile-photos', 'house-photos') and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id in ('profile-photos', 'house-photos') and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "private photos owner delete" on storage.objects for delete to authenticated
  using (bucket_id in ('profile-photos', 'house-photos') and (storage.foldername(name))[1] = (select auth.uid())::text);
