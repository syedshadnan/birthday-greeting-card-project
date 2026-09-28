alter table public.cards
  alter column public_id type text using public_id::text;
