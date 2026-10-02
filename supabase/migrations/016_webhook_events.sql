create table if not exists public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  external_event_id text not null,
  source text not null,
  event_type text not null,
  raw_payload jsonb not null,
  raw_message text,
  received_at timestamptz not null default timezone('utc', now()),
  processed_at timestamptz,
  status text not null default 'received'
    check (status in ('received', 'processing', 'processed', 'failed')),
  error_message text,
  created_at timestamptz not null default timezone('utc', now()),
  constraint webhook_events_external_event_id_length
    check (char_length(external_event_id) between 1 and 200),
  constraint webhook_events_source_length
    check (char_length(source) between 1 and 100),
  constraint webhook_events_event_type_length
    check (char_length(event_type) between 1 and 100)
);

create unique index if not exists webhook_events_external_event_id_unique
  on public.webhook_events(external_event_id);

create index if not exists webhook_events_received_at_idx
  on public.webhook_events(received_at desc);

create index if not exists webhook_events_status_idx
  on public.webhook_events(status);

alter table public.webhook_events enable row level security;
