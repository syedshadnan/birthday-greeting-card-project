alter table cards
  add column if not exists card_config jsonb not null default '{}'::jsonb,
  add column if not exists paid boolean not null default false,
  add column if not exists language text not null default 'en',
  add column if not exists theme text not null default 'pastel-cute';

create index if not exists cards_public_expiry_idx on cards(public_id, expires_at);
create index if not exists cards_pending_expiry_idx on cards(expires_at) where status in ('draft', 'published');

create table if not exists public_rate_limits (
  rate_key text primary key,
  window_started_at timestamptz not null,
  request_count integer not null check (request_count >= 0)
);

alter table public_rate_limits enable row level security;
revoke all on public.public_rate_limits from public, anon, authenticated;

create or replace function public.consume_public_rate_limit(
  p_key text,
  p_max_requests integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_row public.public_rate_limits%rowtype;
  now_at timestamptz := pg_catalog.clock_timestamp();
begin
  if p_key is null or length(p_key) <> 64 or p_max_requests < 1 or p_window_seconds < 1 then
    raise exception 'Invalid rate-limit parameters';
  end if;

  insert into public.public_rate_limits(rate_key, window_started_at, request_count)
  values (p_key, now_at, 1)
  on conflict (rate_key) do nothing;

  select * into current_row
  from public.public_rate_limits
  where rate_key = p_key
  for update;

  if current_row.window_started_at <= now_at - pg_catalog.make_interval(secs => p_window_seconds) then
    update public.public_rate_limits
    set window_started_at = now_at, request_count = 1
    where rate_key = p_key;
    return true;
  end if;

  if current_row.request_count >= p_max_requests then
    return false;
  end if;

  update public.public_rate_limits
  set request_count = request_count + 1
  where rate_key = p_key;
  return true;
end;
$$;

revoke all on function public.consume_public_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_public_rate_limit(text, integer, integer) to service_role;
