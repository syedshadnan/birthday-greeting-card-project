alter table public.payment_accounts
  add column if not exists webhook_source text,
  add column if not exists provider_account_number text;

create unique index if not exists payment_accounts_webhook_source_unique
  on public.payment_accounts(webhook_source)
  where webhook_source is not null;

alter table public.webhook_events
  add column if not exists verification_status text,
  add column if not exists verification_reason_code text,
  add column if not exists verification_reason text,
  add column if not exists parsed_provider text,
  add column if not exists parsed_amount_bdt numeric(12,2),
  add column if not exists parsed_sender_phone text,
  add column if not exists parsed_transaction_id text,
  add column if not exists parsed_provider_timestamp timestamptz,
  add column if not exists trusted_source text,
  add column if not exists trusted_receiving_account text,
  add column if not exists matched_order_id uuid references public.orders(id) on delete set null;

alter table public.webhook_events
  drop constraint if exists webhook_events_verification_status_check;
alter table public.webhook_events
  add constraint webhook_events_verification_status_check
  check (verification_status is null or verification_status in ('verified', 'needs_review', 'unmatched', 'invalid', 'duplicate'));

create index if not exists webhook_events_verification_status_idx
  on public.webhook_events(verification_status);

create table if not exists public.payment_verifications (
  id uuid primary key default gen_random_uuid(),
  webhook_event_id uuid not null unique references public.webhook_events(id) on delete restrict,
  order_id uuid references public.orders(id) on delete set null,
  provider text,
  amount_bdt numeric(12,2),
  sender_phone text,
  transaction_id text,
  provider_timestamp timestamptz,
  trusted_source text,
  trusted_receiving_account text,
  verification_status text not null check (verification_status in ('verified', 'needs_review', 'unmatched', 'invalid', 'duplicate')),
  reason_code text not null,
  reason text not null,
  raw_evidence jsonb not null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists payment_verifications_order_idx on public.payment_verifications(order_id);
create index if not exists payment_verifications_status_idx on public.payment_verifications(verification_status);
create unique index if not exists payment_verifications_verified_transaction_unique
  on public.payment_verifications(provider, transaction_id)
  where verification_status = 'verified' and transaction_id is not null;

alter table public.payment_verifications enable row level security;

create table if not exists public.payment_verification_audit (
  id uuid primary key default gen_random_uuid(),
  verification_id uuid not null references public.payment_verifications(id) on delete restrict,
  admin_user_id uuid references auth.users(id) on delete set null,
  order_id uuid not null references public.orders(id) on delete restrict,
  transaction_id text not null,
  previous_status text not null,
  new_status text not null,
  reason text not null,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.payment_verification_audit enable row level security;

create or replace function public.approve_payment_verification(
  p_verification_id uuid,
  p_admin_user_id uuid,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  verification_row public.payment_verifications;
  order_row public.orders;
  approved_order_id uuid;
begin
  select * into verification_row
  from public.payment_verifications
  where id = p_verification_id
  for update;
  if verification_row.id is null then raise exception 'Verification evidence was not found'; end if;

  select * into order_row
  from public.orders
  where id = verification_row.order_id
  for update;
  if order_row.id is null then raise exception 'Matched order was not found'; end if;
  if order_row.status <> 'pending' then raise exception 'Order is not eligible for approval'; end if;
  if verification_row.amount_bdt <> 99
     or verification_row.provider <> order_row.payment_method
     or verification_row.sender_phone <> order_row.customer_phone
     or verification_row.trusted_receiving_account is null
     or not exists (
       select 1 from public.payment_accounts account
       where account.id = order_row.payment_account_id
         and account.method = verification_row.provider
         and account.provider_account_number = verification_row.trusted_receiving_account
         and account.webhook_source = verification_row.trusted_source
     ) then
    raise exception 'Verification evidence does not satisfy payment requirements';
  end if;
  if exists (
    select 1 from public.payment_verifications other
    where other.transaction_id = verification_row.transaction_id
      and other.provider = verification_row.provider
      and other.id <> verification_row.id
      and other.verification_status = 'verified'
  ) then raise exception 'Transaction ID has already been approved'; end if;

  update public.orders
  set status = 'paid', paid_at = timezone('utc', now()), updated_at = timezone('utc', now())
  where id = order_row.id and status = 'pending'
  returning id into approved_order_id;
  if approved_order_id is null then raise exception 'Order is no longer pending'; end if;

  update public.payment_verifications
  set verification_status = 'verified', reason_code = 'MANUAL_APPROVAL', reason = p_reason, order_id = approved_order_id
  where id = verification_row.id;

  insert into public.payment_verification_audit
    (verification_id, admin_user_id, order_id, transaction_id, previous_status, new_status, reason)
  values
    (verification_row.id, p_admin_user_id, approved_order_id, verification_row.transaction_id, 'pending', 'paid', p_reason);
  return approved_order_id;
end;
$$;

revoke all on function public.approve_payment_verification(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.approve_payment_verification(uuid, uuid, text) to service_role;
