drop policy if exists "private photos owner read" on storage.objects;

create policy "private house photos owner read" on storage.objects for select to authenticated
  using (
    bucket_id = 'house-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "profile photos visible to eligible viewers" on storage.objects for select to authenticated
  using (
    bucket_id = 'profile-photos'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or exists (
        select 1
        from public.profiles p
        where p.id::text = (storage.foldername(name))[1]
          and (
            public.is_area_compatible((select auth.uid()), p.id)
            or exists (
              select 1
              from public.matches m
              where (
                (m.profile_a_id = (select auth.uid()) and m.profile_b_id = p.id)
                or (m.profile_b_id = (select auth.uid()) and m.profile_a_id = p.id)
              )
              and not public.is_blocked_user(m.profile_a_id, m.profile_b_id)
            )
          )
      )
    )
  );
