alter table cards
  add column if not exists template_slug text not null default 'cute';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'birthday-cards',
  'birthday-cards',
  true,
  10000000,
  array['image/jpeg', 'image/png', 'image/webp', 'audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/mp4', 'audio/x-m4a']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
