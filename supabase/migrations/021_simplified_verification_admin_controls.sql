-- Simplified payment rule and admin card controls. Apply after 020.
--
-- Automatic PAID requires only (webhook secret is enforced by the route):
--   supported SMS format + provider = order method + amount = 99
--   + sender phone = order customer wallet + transaction ID not already credited
-- Receiving-account / webhook-source trust mapping no longer blocks automatic payment.
-- One paid order per card (020 trigger and index) still applies.

-- 1. Card admin lock and soft delete ------------------------------------------

alter table public.cards
  add column if not exists admin_locked_at timestamptz,
  add column if not exists deleted_at timestamptz;

-- 2. Automatic verification ---------------------------------------------------

create or replace function public.process_sms_payment_verification(p_verification_id uuid)
returns table (out_status text, out_reason_code text, out_reason text, out_order_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.payment_verifications;
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
    result_reason := 'SMS format is not a supported bKash or Nagad received-money message.';
  elsif v.transaction_id is null or btrim(v.transaction_id) = '' then
    result_status := 'needs_review';
    result_code := 'TRANSACTION_ID_MISSING';
    result_reason := 'The SMS did not contain a transaction ID.';
  else
    -- Serialises all processing of the same provider transaction ID.
    perform pg_advisory_xact_lock(hashtextextended('sms_txn:' || v.provider || ':' || v.transaction_id, 0));

    -- Only an already-credited transaction is a duplicate; earlier uncredited records do not block a retry.
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
    else
      select count(*) into candidate_count
      from (
        select 1 from public.orders o
        where o.status = 'pending'
          and o.payment_method = v.provider
          and o.customer_phone = v.sender_phone
        for update
      ) locked;

      if candidate_count = 0 then
        result_status := 'needs_review';
        result_code := 'NO_MATCHING_ORDER';
        result_reason := 'No pending order has this payment method and customer wallet number.';
      elsif candidate_count > 1 then
        result_status := 'needs_review';
        result_code := 'MULTIPLE_MATCHING_ORDERS';
        result_reason := 'More than one pending order uses this payment method and wallet number; an admin must choose.';
      else
        select * into candidate
        from public.orders o
        where o.status = 'pending'
          and o.payment_method = v.provider
          and o.customer_phone = v.sender_phone;
        result_order := candidate.id;

        perform pg_advisory_xact_lock(hashtextextended('orders_card:' || candidate.card_id::text, 0));

        if v.amount_bdt <> 99 then
          result_status := 'needs_review';
          result_code := 'AMOUNT_MISMATCH';
          result_reason := format('SMS amount is %s BDT; the payment amount is exactly 99 BDT.', v.amount_bdt);
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
            result_reason := 'The matching order was no longer pending.';
          else
            result_status := 'verified';
            result_code := 'AUTO_VERIFIED';
            result_reason := 'Supported SMS, 99 BDT, provider and customer wallet matched one pending order.';
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

-- 3. Admin manual approval ----------------------------------------------------
-- The admin decides. Evidence is optional; when attached, its transaction ID can
-- still only ever be credited once. A card can still only be paid once.

create or replace function public.admin_approve_payment(
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
  approved_order_id uuid;
begin
  if p_reason is null or char_length(btrim(p_reason)) < 10 then
    raise exception 'APPROVAL_REJECTED: an approval reason of at least 10 characters is required';
  end if;

  if p_verification_id is not null then
    select * into v
    from public.payment_verifications pv
    where pv.id = p_verification_id
    for update;
    if v.id is null then raise exception 'APPROVAL_REJECTED: payment evidence was not found'; end if;
    if v.verification_status = 'verified' then raise exception 'APPROVAL_REJECTED: this evidence has already been credited'; end if;
    if v.transaction_id is not null then
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
    end if;
  end if;

  select * into order_row
  from public.orders o
  where o.id = p_order_id
  for update;
  if order_row.id is null then raise exception 'APPROVAL_REJECTED: order was not found'; end if;
  if order_row.status <> 'pending' then raise exception 'APPROVAL_REJECTED: order is already paid or no longer pending'; end if;

  perform pg_advisory_xact_lock(hashtextextended('orders_card:' || order_row.card_id::text, 0));
  if exists (select 1 from public.orders o where o.card_id = order_row.card_id and o.status = 'paid') then
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

  if v.id is not null then
    update public.payment_verifications pv
    set verification_status = 'verified',
        reason_code = 'MANUAL_APPROVAL',
        reason = btrim(p_reason),
        order_id = approved_order_id
    where pv.id = v.id;

    update public.webhook_events we
    set verification_status = 'verified',
        verification_reason_code = 'MANUAL_APPROVAL',
        verification_reason = btrim(p_reason),
        matched_order_id = approved_order_id,
        processed_at = coalesce(we.processed_at, timezone('utc', now())),
        status = 'processed'
    where we.id = v.webhook_event_id;
  end if;

  insert into public.payment_verification_audit
    (verification_id, webhook_event_id, admin_user_id, order_id, transaction_id,
     previous_status, new_status, reason, verification_status, reason_code,
     payment_evidence_available, payment_verification_source)
  values
    (v.id, v.webhook_event_id, p_admin_user_id, approved_order_id, v.transaction_id,
     'pending', 'paid', btrim(p_reason), coalesce(v.verification_status, 'NO_PAYMENT_EVIDENCE'),
     case when v.id is null then 'MANUAL_APPROVAL_NO_EVIDENCE' else 'MANUAL_APPROVAL' end,
     v.id is not null, 'MANUAL_ADMIN');

  return approved_order_id;
end;
$$;

revoke all on function public.admin_approve_payment(uuid, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.admin_approve_payment(uuid, uuid, uuid, text) to service_role;

drop function if exists public.approve_payment_with_evidence(uuid, uuid, uuid, text);

-- 4. Admin card delete --------------------------------------------------------
-- Cards with payment history are archived (hidden from customers, pending orders
-- cancelled, photo rows removed) so orders, webhook events, verifications, audit
-- rows, and legacy payments stay intact. Cards without payment history are deleted.

create or replace function public.admin_delete_card(p_card_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  card_row public.cards;
begin
  select * into card_row from public.cards where id = p_card_id for update;
  if card_row.id is null then raise exception 'CARD_NOT_FOUND'; end if;

  perform pg_advisory_xact_lock(hashtextextended('orders_card:' || p_card_id::text, 0));
  delete from public.card_photos where card_id = p_card_id;

  if exists (select 1 from public.orders where card_id = p_card_id)
     or exists (select 1 from public.payments where card_id = p_card_id) then
    update public.orders
    set status = 'cancelled', updated_at = timezone('utc', now())
    where card_id = p_card_id and status = 'pending';

    update public.cards
    set deleted_at = coalesce(deleted_at, timezone('utc', now())),
        status = 'expired',
        share_enabled_at = null,
        claim_token_hash = null
    where id = p_card_id;
    return 'archived';
  end if;

  delete from public.cards where id = p_card_id;
  return 'deleted';
end;
$$;

revoke all on function public.admin_delete_card(uuid) from public, anon, authenticated;
grant execute on function public.admin_delete_card(uuid) to service_role;
