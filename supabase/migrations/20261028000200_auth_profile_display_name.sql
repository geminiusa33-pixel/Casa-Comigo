-- Keep the profile row created with the auth account and initialize its public
-- display name from the signup form's user-provided metadata.
create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_name text := nullif(pg_catalog.btrim(new.raw_user_meta_data ->> 'display_name'), '');
  email_name text := nullif(pg_catalog.split_part(coalesce(new.email, ''), '@', 1), '');
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    pg_catalog.left(coalesce(requested_name, email_name, 'Utilizador'), 80)
  );
  return new;
end;
$$;

revoke all on function public.create_profile_for_new_user() from public, anon, authenticated;
