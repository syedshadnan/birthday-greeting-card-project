-- Run after 006_all_cards_free.sql in the Supabase SQL editor.
-- Give existing active cards up to seven more days, without extending cards
-- that are already due to expire sooner.
update public.cards
set expires_at = least(expires_at, now() + interval '7 days')
where status in ('draft', 'published')
  and expires_at > now();
