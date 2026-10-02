-- Phase 6 order foundation. The legacy payments table is preserved for historical records.
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  card_id uuid not null references public.cards(id) on delete restrict,
  amount_bdt integer not null default 99 check (amount_bdt = 99),
  currency text not null default 'BDT' check (currency = 'BDT'),
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'cancelled', 'expired')),
  payment_method text not null
    check (payment_method in ('bkash', 'nagad')),
  customer_phone text not null
    check (customer_phone ~ '^01[3-9][0-9]{8}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  paid_at timestamptz,
  expires_at timestamptz
);

create index if not exists orders_user_id_idx on public.orders(user_id);
create index if not exists orders_card_id_idx on public.orders(card_id);
create index if not exists orders_status_idx on public.orders(status);

create unique index if not exists orders_one_pending_per_card_method_idx
  on public.orders(user_id, card_id, payment_method)
  where status = 'pending';

alter table public.orders enable row level security;

drop policy if exists "Users can view own orders" on public.orders;
create policy "Users can view own orders"
on public.orders
for select
using (auth.uid() = user_id);

drop policy if exists "Users can create own pending orders" on public.orders;
create policy "Users can create own pending orders"
on public.orders
for insert
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.cards
    where public.cards.id = card_id
      and public.cards.user_id = auth.uid()
  )
  and amount_bdt = 99
  and currency = 'BDT'
  and status = 'pending'
  and paid_at is null
);

revoke update, delete on public.orders from authenticated;
