drop policy if exists "profiles owner or discoverable read" on public.profiles;

create policy "profiles owner or area-compatible read"
on public.profiles
for select
to authenticated
using (
  (
    id = (select auth.uid())
    or (
      discovery_visible = true
      and public.is_area_compatible((select auth.uid()), id)
    )
  )
  and not public.is_blocked_user(id, (select auth.uid()))
);
