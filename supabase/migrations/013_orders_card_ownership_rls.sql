-- Enforce card ownership independently of the order API.
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
  and payment_method in ('bkash', 'nagad')
  and paid_at is null
);
