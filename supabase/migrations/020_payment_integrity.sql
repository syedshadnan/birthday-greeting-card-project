-- Payment integrity hardening:
--   * one verified (paid) order per card, enforced in the database
--   * atomic automatic SMS verification
--   * evidence-bound manual admin approval (replaces the unrestricted override)
--   * card security fields are no longer client-writable
-- Historical orders, verifications, webhook events, and audit rows are not modified.

-- 1. One paid order per card -------------------------------------------------

create or replace function public.enforce_single_paid_order_per_card()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' and new.status not in ('pending', 'paid') then
    return new;
  end if;
  if tg_op = 'UPDATE' and (new.status <> 'paid' or old.status = 'paid') then
    return new;
  end if;

  -- Serialises order creation and payment for the same card.
  perform pg_advisory_xact_lock(hashtextextended('orders_card:' || new.card_id::text, 0));

  if exists (
    select 1 from public.orders
    where card_id = new.card_id
      and status = 'paid'
      and id <> new.id
  ) then
    raise exception 'CARD_ALREADY_PAID: this card already has a verified payment';
  end if;

  return new;
end;
$$;

drop trigger if exists orders_single_paid_per_card on public.orders;
create trigger orders_single_paid_per_card
  before insert or update of status on public.orders
  for each row execute procedure public.enforce_single_paid_order_per_card();

-- Add a hard unique index too, unless historical data already contains a card
-- with more than one paid order (the trigger still blocks new violations).
do $$
begin
  if exists (
    select 1 from public.orders
    where status = 'paid'
    group by card_id
    having count(*) > 1
  ) then
    raise warning 'orders_one_paid_per_card_idx was not created: historical cards with multiple paid orders exist. The trigger still prevents new ones.';
  else
    create unique index if not exists orders_one_paid_per_card_idx
      on public.orders(card_id)
      where status = 'paid';
  end if;
end;
$$;

-- 2. Atomic automatic verification -------------------------------------------

create or replace function public.process_sms_payment_verification(p_verification_id uuid)
returns table (out_status text, out_reason_code text, out_reason text, out_order_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.payment_verifications;
  account_count integer;
  matched_account_id uuid;
  candidate_count integer;
  candidate public.orders;
  paid_order_id uuid;
  result_status text;
  result_code text;
  result_reason text;
  result_order uuid;
begin
  select * into v
  from public.payment_verifications pv
  where pv.id = p_verification_id
  for update;
  if v.id is null then raise exception 'Verification evidence was not found'; end if;

  if v.verification_status = 'verified' then
    return query select v.verification_status, v.reason_code, v.reason, v.order_id;
    return;
  end if;

  if v.provider is null or v.provider not in ('bkash', 'nagad') or v.amount_bdt is null or v.sender_phone is null then
    result_status := 'invalid';
    result_code := 'INVALID_SMS_FORMAT';
    result_reason := 'SMS format could not be safely parsed.';
  elsif v.transaction_id is null or btrim(v.transaction_id) = '' then
    result_status := 'needs_review';
    result_code := 'TRANSACTION_ID_MISSING';
    result_reason := 'Auto verification failed: the supported SMS did not contain a transaction ID.';
  else
    -- Serialises all processing of the same provider transaction ID.
    perform pg_advisory_xact_lock(hashtextextended('sms_txn:' || v.provider || ':' || v.transaction_id, 0));

    -- Only a credited transaction blocks a retry. Earlier needs_review/unprocessed records for the
    -- same transaction stay as evidence and do not stop a later retry from verifying.
    if exists (
      select 1 from public.payment_verifications other
      where other.provider = v.provider
        and other.transaction_id = v.transaction_id
        and other.id <> v.id
        and other.verification_status = 'verified'
    ) then
      result_status := 'duplicate';
      result_code := 'TRANSACTION_ID_DUPLICATE';
      result_reason := 'This transaction ID has already been credited.';
    elsif v.trusted_source is null or v.trusted_receiving_account is null then
      result_status := 'needs_review';
      result_code := 'RECEIVING_ACCOUNT_UNKNOWN';
      result_reason := 'Auto verification stopped because the receiving account could not be established from trusted metadata.';
    else
      select count(*), (array_agg(pa.id))[1]
        into account_count, matched_account_id
      from public.payment_accounts pa
      where pa.method = v.provider
        and pa.webhook_source = v.trusted_source
        and pa.provider_account_number = v.trusted_receiving_account;

      if account_count <> 1 then
        result_status := 'needs_review';
        result_code := 'RECEIVING_ACCOUNT_UNKNOWN';
        result_reason := 'The trusted receiving account metadata did not match exactly one configured payment account.';
      else
        select count(*) into candidate_count
        from (
          select 1 from public.orders o
          where o.status = 'pending'
            and o.payment_method = v.provider
            and o.payment_account_id = matched_account_id
            and o.customer_phone = v.sender_phone
          for update
        ) locked;

        if candidate_count = 0 then
          result_status := 'needs_review';
          if exists (
            select 1 from public.orders o
            where o.status in ('cancelled', 'expired')
              and o.payment_method = v.provider
              and o.payment_account_id = matched_account_id
              and o.customer_phone = v.sender_phone
          ) then
            result_code := 'ORDER_NOT_PENDING';
            result_reason := 'The only matching order is cancelled or expired, so automatic payment was not approved.';
          else
            result_code := 'NO_MATCHING_ORDER';
            result_reason := 'No pending order matched this provider, receiving account, and sender phone.';
          end if;
        elsif candidate_count > 1 then
          result_status := 'needs_review';
          result_code := 'MULTIPLE_MATCHING_ORDERS';
          result_reason := 'Multiple pending orders matched the SMS, so automatic payment was intentionally not approved.';
        else
          select * into candidate
          from public.orders o
          where o.status = 'pending'
            and o.payment_method = v.provider
            and o.payment_account_id = matched_account_id
            and o.customer_phone = v.sender_phone;
          result_order := candidate.id;

          perform pg_advisory_xact_lock(hashtextextended('orders_card:' || candidate.card_id::text, 0));

          if v.amount_bdt <> 99 or candidate.amount_bdt <> 99 then
            result_status := 'needs_review';
            result_code := 'AMOUNT_MISMATCH';
            result_reason := format('Auto verification failed: SMS amount is %s BDT, but the required payment amount is 99 BDT.', v.amount_bdt);
          elsif exists (
            select 1 from public.orders o
            where o.card_id = candidate.card_id and o.status = 'paid'
          ) then
            result_status := 'needs_review';
            result_code := 'CARD_ALREADY_PAID';
            result_reason := 'The matching order belongs to a card that already has a verified payment.';
          else
            update public.orders
            set status = 'paid',
                paid_at = timezone('utc', now()),
                payment_verification_source = 'AUTOMATIC',
                updated_at = timezone('utc', now())
            where id = candidate.id and status = 'pending'
            returning id into paid_order_id;

            if paid_order_id is null then
              result_status := 'needs_review';
              result_code := 'ORDER_NOT_PENDING';
              result_reason := 'The matching order was no longer pending when automatic approval was attempted.';
            else
              result_status := 'verified';
              result_code := 'AUTO_VERIFIED';
              result_reason := 'Payment matched one eligible pending order with trusted provider and receiving-account metadata.';
            end if;
          end if;
        end if;
      end if;
    end if;
  end if;

  update public.payment_verifications pv
  set verification_status = result_status,
      reason_code = result_code,
      reason = result_reason,
      order_id = coalesce(result_order, pv.order_id)
  where pv.id = v.id;

  update public.webhook_events we
  set verification_status = result_status,
      verification_reason_code = result_code,
      verification_reason = result_reason,
      matched_order_id = coalesce(result_order, we.matched_order_id),
      processed_at = timezone('utc', now()),
      status = 'processed'
  where we.id = v.webhook_event_id;

  if result_status = 'verified' then
    insert into public.payment_verification_audit
      (verification_id, webhook_event_id, admin_user_id, order_id, transaction_id,
       previous_status, new_status, reason, verification_status, reason_code,
       payment_evidence_available, payment_verification_source)
    values
      (v.id, v.webhook_event_id, null, result_order, v.transaction_id,
       'pending', 'paid', result_reason, result_status, result_code,
       true, 'AUTOMATIC');
  end if;

  return query select result_status, result_code, result_reason, result_order;
end;
$$;

revoke all on function public.process_sms_payment_verification(uuid) from public, anon, authenticated;
grant execute on function public.process_sms_payment_verification(uuid) to service_role;

-- 3. Evidence-bound manual approval ------------------------------------------

create or replace function public.approve_payment_with_evidence(
  p_order_id uuid,
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
  v public.payment_verifications;
  order_row public.orders;
  raw_sms text;
  approved_order_id uuid;
  approval_code text;
begin
  if p_reason is null or char_length(btrim(p_reason)) < 10 then
    raise exception 'APPROVAL_REJECTED: a manual approval reason of at least 10 characters is required';
  end if;

  select * into v
  from public.payment_verifications pv
  where pv.id = p_verification_id
  for update;
  if v.id is null then raise exception 'APPROVAL_REJECTED: payment evidence was not found'; end if;
  if v.verification_status = 'verified' then raise exception 'APPROVAL_REJECTED: this evidence has already been credited'; end if;
  if v.verification_status in ('invalid', 'duplicate') then
    raise exception 'APPROVAL_REJECTED: % evidence cannot be approved', v.verification_status;
  end if;
  if v.provider is null or v.amount_bdt is null or v.sender_phone is null
     or v.transaction_id is null or btrim(v.transaction_id) = '' then
    raise exception 'APPROVAL_REJECTED: evidence is missing provider, amount, sender phone, or transaction ID';
  end if;
  if v.trusted_source is null or v.trusted_receiving_account is null then
    raise exception 'APPROVAL_REJECTED: evidence is missing trusted source or receiving account';
  end if;
  if v.order_id is not null and v.order_id <> p_order_id then
    raise exception 'APPROVAL_REJECTED: this evidence is linked to a different order';
  end if;

  select we.raw_message into raw_sms
  from public.webhook_events we
  where we.id = v.webhook_event_id;
  if raw_sms is null or btrim(raw_sms) = '' then
    raise exception 'APPROVAL_REJECTED: raw SMS evidence is unavailable';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('sms_txn:' || v.provider || ':' || v.transaction_id, 0));

  if exists (
    select 1 from public.payment_verifications other
    where other.provider = v.provider
      and other.transaction_id = v.transaction_id
      and other.id <> v.id
      and other.verification_status = 'verified'
  ) then
    raise exception 'APPROVAL_REJECTED: this transaction ID has already been credited';
  end if;

  select * into order_row
  from public.orders o
  where o.id = p_order_id
  for update;
  if order_row.id is null then raise exception 'APPROVAL_REJECTED: order was not found'; end if;
  if order_row.status <> 'pending' then raise exception 'APPROVAL_REJECTED: order is already paid or no longer pending'; end if;
  if v.amount_bdt <> 99 or order_row.amount_bdt <> 99 then
    raise exception 'APPROVAL_REJECTED: evidence amount is not 99 BDT';
  end if;
  if v.provider <> order_row.payment_method then
    raise exception 'APPROVAL_REJECTED: evidence provider does not match the order payment method';
  end if;
  if not exists (
    select 1 from public.payment_accounts pa
    where pa.id = order_row.payment_account_id
      and pa.method = v.provider
      and pa.webhook_source = v.trusted_source
      and pa.provider_account_number = v.trusted_receiving_account
  ) then
    raise exception 'APPROVAL_REJECTED: evidence receiving account does not match the order receiving account';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('orders_card:' || order_row.card_id::text, 0));
  if exists (
    select 1 from public.orders o
    where o.card_id = order_row.card_id and o.status = 'paid'
  ) then
    raise exception 'APPROVAL_REJECTED: this card already has a verified payment';
  end if;

  update public.orders
  set status = 'paid',
      paid_at = timezone('utc', now()),
      payment_verification_source = 'MANUAL_ADMIN',
      updated_at = timezone('utc', now())
  where id = order_row.id and status = 'pending'
  returning id into approved_order_id;
  if approved_order_id is null then raise exception 'APPROVAL_REJECTED: order is no longer pending'; end if;

  approval_code := case when v.sender_phone = order_row.customer_phone
    then 'MANUAL_APPROVAL' else 'MANUAL_APPROVAL_SENDER_MISMATCH' end;

  update public.payment_verifications pv
  set verification_status = 'verified',
      reason_code = approval_code,
      reason = btrim(p_reason),
      order_id = approved_order_id
  where pv.id = v.id;

  update public.webhook_events we
  set verification_status = 'verified',
      verification_reason_code = approval_code,
      verification_reason = btrim(p_reason),
      matched_order_id = approved_order_id,
      processed_at = coalesce(we.processed_at, timezone('utc', now())),
      status = 'processed'
  where we.id = v.webhook_event_id;

  insert into public.payment_verification_audit
    (verification_id, webhook_event_id, admin_user_id, order_id, transaction_id,
     previous_status, new_status, reason, verification_status, reason_code,
     payment_evidence_available, payment_verification_source)
  values
    (v.id, v.webhook_event_id, p_admin_user_id, approved_order_id, v.transaction_id,
     'pending', 'paid', btrim(p_reason), v.verification_status, approval_code,
     true, 'MANUAL_ADMIN');

  return approved_order_id;
end;
$$;

revoke all on function public.approve_payment_with_evidence(uuid, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.approve_payment_with_evidence(uuid, uuid, uuid, text) to service_role;

-- The previous approval functions could mark an order paid without verified
-- evidence or transaction-ID protection. Existing audit rows are kept.
drop function if exists public.approve_manual_payment_order(uuid, uuid, text);
drop function if exists public.approve_payment_verification(uuid, uuid, text);

-- 4. Card security fields are server-managed ---------------------------------
-- All card writes go through service-role route handlers. Direct client updates
-- could otherwise set share_enabled_at, expires_at, paid, or status.
revoke update on public.cards from anon, authenticated;
