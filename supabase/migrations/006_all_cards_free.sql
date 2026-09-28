update public.templates
set price = 0,
    is_free = true;

update public.cards
set paid = false;

update public.cards
set status = 'published',
    expires_at = now() + interval '365 days'
where status in ('draft', 'published');
