alter table public.cards
  add column if not exists user_id uuid references auth.users(id) on delete set null,
  add column if not exists claim_token_hash text;

create index if not exists cards_user_id_idx on public.cards(user_id);

create unique index if not exists cards_claim_token_hash_idx
  on public.cards(claim_token_hash)
  where claim_token_hash is not null;

alter table public.cards enable row level security;

drop policy if exists "Users can view owned cards" on public.cards;
create policy "Users can view owned cards"
on public.cards
for select
using (auth.uid() = user_id);

drop policy if exists "Users can update owned cards" on public.cards;
create policy "Users can update owned cards"
on public.cards
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
