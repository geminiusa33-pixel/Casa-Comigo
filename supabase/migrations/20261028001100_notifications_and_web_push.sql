create table public.notifications (
  id uuid primary key default extensions.gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  notification_type text not null check (notification_type in (
    'new_message', 'new_match', 'group_join_request', 'group_join_decision'
  )),
  title text not null check (char_length(title) between 1 and 120),
  body text not null check (char_length(body) between 1 and 500),
  resource_type text not null check (resource_type in ('match', 'group')),
  resource_id uuid not null,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  push_sent_at timestamptz
);
create index notifications_profile_created_idx
  on public.notifications (profile_id, created_at desc);
create index notifications_pending_push_idx
  on public.notifications (created_at)
  where push_sent_at is null;
alter table public.notifications enable row level security;
revoke all on public.notifications from public, anon, authenticated;

create table public.notification_push_subscriptions (
  id uuid primary key default extensions.gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique check (char_length(endpoint) between 1 and 2048),
  p256dh text not null check (char_length(p256dh) between 1 and 256),
  auth text not null check (char_length(auth) between 1 and 256),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index notification_push_subscriptions_profile_idx
  on public.notification_push_subscriptions (profile_id);
alter table public.notification_push_subscriptions enable row level security;
revoke all on public.notification_push_subscriptions from public, anon, authenticated;

create or replace function public.notify_match_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  first_name text;
  second_name text;
begin
  select display_name into first_name from public.profiles where id = new.profile_a_id;
  select display_name into second_name from public.profiles where id = new.profile_b_id;

  insert into public.notifications (
    profile_id, notification_type, title, body, resource_type, resource_id
  )
  values
    (new.profile_a_id, 'new_match', 'Novo match!', 'Tem um novo match com ' || coalesce(second_name, 'alguém') || '.', 'match', new.id),
    (new.profile_b_id, 'new_match', 'Novo match!', 'Tem um novo match com ' || coalesce(first_name, 'alguém') || '.', 'match', new.id);
  return new;
end;
$$;
create trigger matches_create_notifications
  after insert on public.matches
  for each row execute function public.notify_match_created();

create or replace function public.notify_individual_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_match uuid;
  recipient uuid;
  sender_name text;
begin
  select match.id,
         case when match.profile_a_id = new.sender_id then match.profile_b_id else match.profile_a_id end
    into target_match, recipient
  from public.conversations conversation
  join public.matches match on match.id = conversation.match_id
  where conversation.id = new.conversation_id
    and new.sender_id in (match.profile_a_id, match.profile_b_id)
    and not exists (
      select 1 from public.housing_groups group_row where group_row.origin_match_id = match.id
    )
    and not public.is_blocked_user(match.profile_a_id, match.profile_b_id);

  if recipient is null then
    return new;
  end if;

  select display_name into sender_name from public.profiles where id = new.sender_id;
  insert into public.notifications (
    profile_id, notification_type, title, body, resource_type, resource_id
  )
  values (
    recipient,
    'new_message',
    coalesce(sender_name, 'Nova mensagem'),
    left(new.body, 180),
    'match',
    target_match
  );
  return new;
end;
$$;
create trigger messages_create_notifications
  after insert on public.messages
  for each row execute function public.notify_individual_message();

create or replace function public.notify_group_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  sender_name text;
  group_title text;
begin
  if new.source_message_id is not null then
    return new;
  end if;

  select display_name into sender_name from public.profiles where id = new.sender_id;
  select group_name into group_title from public.housing_groups where id = new.group_id;

  insert into public.notifications (
    profile_id, notification_type, title, body, resource_type, resource_id
  )
  select member.profile_id,
         'new_message',
         coalesce(group_title, 'Mensagem no grupo'),
         coalesce(sender_name, 'Uma pessoa do grupo') || ': ' || left(new.body, 150),
         'group',
         new.group_id
  from public.housing_group_members member
  where member.group_id = new.group_id
    and member.profile_id <> new.sender_id
    and not public.is_blocked_user(new.sender_id, member.profile_id);
  return new;
end;
$$;
create trigger housing_group_messages_create_notifications
  after insert on public.housing_group_messages
  for each row execute function public.notify_group_message();

create or replace function public.notify_group_join_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requester_name text;
  group_title text;
begin
  select display_name into requester_name from public.profiles where id = new.requester_id;
  select group_name into group_title from public.housing_groups where id = new.group_id;

  insert into public.notifications (
    profile_id, notification_type, title, body, resource_type, resource_id
  )
  select member.profile_id,
         'group_join_request',
         'Pedido para entrar no grupo',
         coalesce(requester_name, 'Uma pessoa') || ' pediu para entrar em ' || coalesce(group_title, 'no grupo') || '.',
         'group',
         new.group_id
  from public.housing_group_members member
  where member.group_id = new.group_id
    and member.profile_id <> new.requester_id;
  return new;
end;
$$;
create trigger housing_group_join_requests_create_notifications
  after insert on public.housing_group_join_requests
  for each row execute function public.notify_group_join_request();

create or replace function public.notify_group_join_decision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  group_title text;
begin
  if old.status is not distinct from new.status
     or new.status not in ('accepted', 'declined') then
    return new;
  end if;

  select group_name into group_title from public.housing_groups where id = new.group_id;
  insert into public.notifications (
    profile_id, notification_type, title, body, resource_type, resource_id
  )
  values (
    new.requester_id,
    'group_join_decision',
    case when new.status = 'accepted' then 'Pedido aceite' else 'Pedido recusado' end,
    case when new.status = 'accepted'
      then 'O grupo ' || coalesce(group_title, 'de coabitação') || ' aceitou o seu pedido.'
      else 'O grupo ' || coalesce(group_title, 'de coabitação') || ' recusou o seu pedido.'
    end,
    'group',
    new.group_id
  );
  return new;
end;
$$;
create trigger housing_group_join_requests_decision_notifications
  after update of status on public.housing_group_join_requests
  for each row execute function public.notify_group_join_decision();
