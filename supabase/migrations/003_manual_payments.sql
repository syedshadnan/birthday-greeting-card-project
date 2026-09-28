alter table payments
  add column if not exists payment_method text,
  add column if not exists payer_phone text;

update payments
set payment_method = 'bkash'
where payment_method is null;

update payments
set payer_phone = bkash_number
where payer_phone is null;

alter table payments
  alter column payment_method set default 'bkash',
  alter column payment_method set not null,
  alter column payer_phone set not null;

alter table payments
  add constraint payments_payment_method_check check (payment_method in ('bkash', 'nagad'));

create unique index if not exists payments_one_active_per_card_idx
  on payments(card_id)
  where card_id is not null and status in ('pending', 'verified');
