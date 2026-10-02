drop index if exists public.payment_accounts_webhook_source_unique;

create unique index if not exists payment_accounts_trust_mapping_unique
  on public.payment_accounts(method, webhook_source, provider_account_number)
  where webhook_source is not null
    and provider_account_number is not null;
