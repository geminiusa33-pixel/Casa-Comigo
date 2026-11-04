do $$
declare
  selected_group uuid;
  selected_sender uuid;
  selected_requester uuid;
  created_message uuid;
  created_request uuid;
  started_at timestamptz := transaction_timestamp();
begin
 begin
  select member.group_id, member.profile_id
    into selected_group, selected_sender
  from public.housing_group_members member
  join public.housing_group_members other_member
    on other_member.group_id = member.group_id
   and other_member.profile_id <> member.profile_id
  limit 1;

  if selected_group is not null then
    insert into public.housing_group_messages (group_id, sender_id, body)
    values (selected_group, selected_sender, 'notification-trigger-smoke-test')
    returning id into created_message;

    if not exists (
      select 1
      from public.notifications
      where resource_id = selected_group
        and notification_type = 'new_message'
        and body like '%notification-trigger-smoke-test%'
    ) then
      raise exception 'Group message notification trigger did not create notifications';
    end if;
  end if;

  select group_row.id, profile.id
    into selected_group, selected_requester
  from public.housing_groups group_row
  cross join public.profiles profile
  where group_row.status = 'open'
    and not exists (
      select 1 from public.housing_group_members member
      where member.group_id = group_row.id and member.profile_id = profile.id
    )
    and not exists (
      select 1 from public.housing_group_join_requests request
      where request.group_id = group_row.id
        and request.requester_id = profile.id
        and request.status = 'pending'
    )
  limit 1;

  if selected_group is not null then
    insert into public.housing_group_join_requests (group_id, requester_id)
    values (selected_group, selected_requester)
    returning id into created_request;

    update public.housing_group_join_requests
    set status = 'declined', decided_at = now()
    where id = created_request;

    if not exists (
      select 1
      from public.notifications
      where resource_id = selected_group
        and notification_type = 'group_join_request'
        and created_at >= started_at
    ) then
      raise exception 'Group join request notification trigger did not run';
    end if;

    if not exists (
      select 1
      from public.notifications
      where profile_id = selected_requester
        and resource_id = selected_group
        and notification_type = 'group_join_decision'
        and created_at >= started_at
    ) then
      raise exception 'Group join decision notification trigger did not run';
    end if;
  end if;
  raise exception 'Rollback notification smoke-test writes'
    using errcode = 'ZX001';
 exception
  when sqlstate 'ZX001' then
    raise notice 'Notification triggers created the expected records; test data was rolled back.';
 end;
end
$$;
