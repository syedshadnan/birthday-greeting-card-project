-- Run in the Supabase SQL editor. Service-role keys remain server-only.
create table if not exists templates (
  id uuid primary key default gen_random_uuid(), slug text unique not null, name text not null,
  description text not null, category text not null, price integer not null default 0,
  is_free boolean not null default true, is_active boolean not null default true,
  preview_image text, animation_preset text not null default 'fade', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists cards (
  id uuid primary key default gen_random_uuid(), public_id text unique not null, template_id uuid references templates(id),
  recipient_name text not null, sender_name text not null, message text not null, music_url text,
  status text not null default 'draft' check (status in ('draft','published','expired')),
  created_at timestamptz not null default now(), expires_at timestamptz not null
);
create table if not exists card_photos (
  id uuid primary key default gen_random_uuid(), card_id uuid not null references cards(id) on delete cascade,
  image_url text not null, sort_order smallint not null default 0
);
create table if not exists payments (
  id uuid primary key default gen_random_uuid(), card_id uuid references cards(id), template_id uuid references templates(id),
  customer_name text not null, bkash_number text not null, transaction_id text unique not null,
  amount integer not null, status text not null default 'pending' check (status in ('pending','verified','rejected')),
  created_at timestamptz not null default now(), verified_at timestamptz, verified_by uuid
);
create index if not exists cards_public_id_idx on cards(public_id);
create index if not exists cards_expires_at_idx on cards(expires_at);
create index if not exists templates_slug_idx on templates(slug);
create index if not exists templates_active_idx on templates(is_active);
create index if not exists payments_status_idx on payments(status);
alter table templates enable row level security; alter table cards enable row level security; alter table card_photos enable row level security; alter table payments enable row level security;
-- Public reads should be restricted to a card lookup RPC that checks expiry; writes use authenticated server actions.
