create or replace function public.prevent_liking_housemate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.housing_group_members actor_member
    join public.housing_group_members recipient_member
      on recipient_member.group_id = actor_member.group_id
    join public.housing_groups group_row on group_row.id = actor_member.group_id
    where actor_member.profile_id = new.actor_id
      and recipient_member.profile_id = new.recipient_id
  ) then
    raise exception 'Este perfil já pertence ao seu grupo atual'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists likes_prevent_current_housemates on public.likes;
create trigger likes_prevent_current_housemates
  before insert on public.likes
  for each row execute function public.prevent_liking_housemate();
