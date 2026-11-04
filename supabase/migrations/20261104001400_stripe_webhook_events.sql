create table public.stripe_webhook_events (
  stripe_event_id text primary key check (char_length(stripe_event_id) between 1 and 255),
  status text not null check (status in ('processing', 'processed', 'failed')),
  processing_started_at timestamptz not null default now(),
  processed_at timestamptz
);

alter table public.stripe_webhook_events enable row level security;
revoke all on public.stripe_webhook_events from public, anon, authenticated;
