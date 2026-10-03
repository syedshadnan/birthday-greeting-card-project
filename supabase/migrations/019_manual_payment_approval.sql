alter table public.orders
  add column if not exists payment_verification_source text;

alter table public.orders
  drop constraint if exists orders_payment_verification_source_check;
alter table public.orders
  add constraint orders_payment_verification_source_check
  check (payment_verification_source is null or payment_verification_source in ('AUTOMATIC', 'MANUAL_ADMIN'));

alter table public.payment_verification_audit
  alter column verification_id drop not null,
  alter column transaction_id drop not null;

alter table public.payment_verification_audit
  add column if not exists webhook_event_id uuid references public.webhook_events(id) on delete set null,
  add column if not exists verification_status text,
  add column if not exists reason_code text,
  add column if not exists payment_evidence_available boolean not null default true,
  add column if not exists payment_verification_source text not null default 'AUTOMATIC';

alter table public.payment_verification_audit
  drop constraint if exists payment_verification_audit_source_check;
alter table public.payment_verification_audit
  add constraint payment_verification_audit_source_check
  check (payment_verification_source in ('AUTOMATIC', 'MANUAL_ADMIN'));

create or replace function public.approve_manual_payment_order(
  p_order_id uuid,
  p_admin_user_id uuid,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  order_row public.orders;
  verification_row public.payment_verifications;
  event_id uuid;
  approved_order_id uuid;
  evidence_available boolean := false;
begin
  if p_reason is null or char_length(btrim(p_reason)) < 10 then
    raise exception 'A manual approval reason of at least 10 characters is required';
  end if;

  select * into order_row
  from public.orders
  where id = p_order_id
  for update;

  if order_row.id is null then raise exception 'Order was not found'; end if;
  if order_row.status <> 'pending' then raise exception 'Order is already paid or no longer pending'; end if;

  select pv.*
    into verification_row
  from public.payment_verifications pv
  where pv.order_id = order_row.id
  order by pv.created_at desc
  limit 1;

  if verification_row.id is not null then
    evidence_available := true;
    event_id := verification_row.webhook_event_id;
  else
    select id into event_id
    from public.webhook_events
    where matched_order_id = order_row.id
    order by received_at desc
    limit 1;
    evidence_available := event_id is not null;
  end if;

  update public.orders
  set status = 'paid',
      paid_at = timezone('utc', now()),
      payment_verification_source = 'MANUAL_ADMIN',
      updated_at = timezone('utc', now())
  where id = order_row.id and status = 'pending'
  returning id into approved_order_id;

  if approved_order_id is null then raise exception 'Order is no longer pending'; end if;

  insert into public.payment_verification_audit
    (verification_id, webhook_event_id, admin_user_id, order_id, transaction_id,
     previous_status, new_status, reason, verification_status, reason_code,
     payment_evidence_available, payment_verification_source)
  values
    (verification_row.id, event_id, p_admin_user_id, approved_order_id,
     verification_row.transaction_id, 'pending', 'paid', btrim(p_reason),
     coalesce(verification_row.verification_status, 'NO_PAYMENT_EVIDENCE'),
     coalesce(verification_row.reason_code, 'NO_PAYMENT_EVIDENCE'),
     evidence_available, 'MANUAL_ADMIN');

  return approved_order_id;
end;
$$;

revoke all on function public.approve_manual_payment_order(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.approve_manual_payment_order(uuid, uuid, text) to service_role;
