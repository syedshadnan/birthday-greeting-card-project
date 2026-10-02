alter table public.cards
  add column if not exists share_enabled_at timestamptz;

update public.cards
set share_enabled_at = coalesce(share_enabled_at, created_at)
where share_enabled_at is null;

create index if not exists cards_share_enabled_idx
  on public.cards(share_enabled_at)
  where share_enabled_at is not null;
