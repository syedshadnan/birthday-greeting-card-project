-- Phase 7 payment accounts. Legacy payments and existing orders are preserved.
create table if not exists public.payment_accounts (
  id uuid primary key default gen_random_uuid(),
  method text not null check (method in ('bkash', 'nagad')),
  account_number text not null check (account_number ~ '^01[3-9][0-9]{8}$'),
  label text,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create or replace function public.prevent_payment_account_identity_change()
returns trigger
language plpgsql
as $$
begin
  if new.account_number is distinct from old.account_number
     or new.method is distinct from old.method
     or new.created_by is distinct from old.created_by then
    raise exception 'Payment account identity is immutable; create a new account instead';
  end if;
  return new;
end;
$$;

drop trigger if exists payment_accounts_identity_protection on public.payment_accounts;
create trigger payment_accounts_identity_protection
  before update on public.payment_accounts
  for each row execute procedure public.prevent_payment_account_identity_change();

create unique index if not exists payment_accounts_one_active_method_idx
  on public.payment_accounts(method)
  where is_active = true;

alter table public.payment_accounts enable row level security;

create policy "Anyone can view active payment accounts"
on public.payment_accounts
for select
using (is_active = true);

create policy "Admins can manage payment accounts"
on public.payment_accounts
for all
using (public.is_admin())
with check (public.is_admin());

alter table public.orders
  add column if not exists payment_account_id uuid references public.payment_accounts(id) on delete restrict,
  add column if not exists payment_submitted_at timestamptz;

create index if not exists orders_payment_account_id_idx
  on public.orders(payment_account_id);

drop policy if exists "Users can create own pending orders" on public.orders;
create policy "Users can create own pending orders"
on public.orders
for insert
with check (
  auth.uid() = user_id
  and exists (
    select 1 from public.cards
    where public.cards.id = card_id
      and public.cards.user_id = auth.uid()
  )
  and exists (
    select 1 from public.payment_accounts
    where public.payment_accounts.id = payment_account_id
      and public.payment_accounts.method = payment_method
      and public.payment_accounts.is_active = true
  )
  and amount_bdt = 99
  and currency = 'BDT'
  and status = 'pending'
  and payment_method in ('bkash', 'nagad')
  and paid_at is null
);

revoke update, delete on public.orders from authenticated;
