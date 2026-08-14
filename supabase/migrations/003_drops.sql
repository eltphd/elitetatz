-- Booth Drops: per-artist prints/originals marketplace v1.
-- Items start life in the code config (lib/community/drops.ts) and graduate
-- here once the Telegram/SMS ingestion agent posts directly to the DB.

create table drops (
  id uuid primary key default uuid_generate_v4(),
  artist_id uuid references artists(id) on delete cascade,
  artist_handle text not null,
  slug text not null,                          -- stable id, e.g. 'birdy-blue-print'
  title text not null,
  description text,
  kind text not null default 'print'
    check (kind in ('print', 'original', 'pottery', 'flash', 'merch')),
  price_cents integer not null default 0,
  image_url text,
  status text not null default 'available'
    check (status in ('available', 'reserved', 'sold', 'hidden')),
  created_at timestamptz default now(),
  unique (artist_handle, slug)
);

create index on drops (artist_handle, status);

-- "I want this" claims from fans — the sale conversation starts in email
-- (artist replies directly via Reply-To), payment link follows via Stripe.
create table drop_claims (
  id uuid primary key default uuid_generate_v4(),
  drop_id uuid references drops(id) on delete set null,
  drop_slug text not null,                     -- survives config-only items
  artist_handle text not null,
  email text not null,
  name text,
  note text,
  status text not null default 'new'
    check (status in ('new', 'contacted', 'paid', 'closed')),
  created_at timestamptz default now()
);

create index on drop_claims (artist_handle, status, created_at desc);

alter table drops enable row level security;
alter table drop_claims enable row level security;

create policy "drops_public_read" on drops
  for select using (status in ('available', 'reserved', 'sold'));

create policy "claims_artist_read" on drop_claims
  for select using (
    artist_handle in (select instagram_handle from artists where user_id = auth.uid())
  );
