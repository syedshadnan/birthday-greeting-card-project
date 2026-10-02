-- Atomically replace the active receiving account for one payment method.
create or replace function public.activate_payment_account(p_account_id uuid)
returns public.payment_accounts
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_account public.payment_accounts%rowtype;
begin
  select *
  into selected_account
  from public.payment_accounts
  where id = p_account_id
  for update;

  if not found then
    raise exception 'Payment account not found';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(selected_account.method, 0));

  update public.payment_accounts
  set is_active = false,
      updated_at = now()
  where method = selected_account.method
    and is_active = true
    and id <> p_account_id;

  update public.payment_accounts
  set is_active = true,
      updated_at = now()
  where id = p_account_id;

  select *
  into selected_account
  from public.payment_accounts
  where id = p_account_id;

  return selected_account;
end;
$$;

revoke all on function public.activate_payment_account(uuid) from public, anon, authenticated;
grant execute on function public.activate_payment_account(uuid) to service_role;
