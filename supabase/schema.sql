-- TatzAI Database Schema

-- Enable extensions
create extension if not exists "uuid-ossp";
create extension if not exists "postgis";

-- Artists
create table artists (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  bio text,
  location_city text not null,
  location_state text not null,
  location_lat double precision,
  location_lng double precision,
  styles text[] not null default '{}',
  hourly_rate_cents integer not null default 0,
  min_piece_cents integer not null default 0,
  portfolio_images text[] not null default '{}',
  avatar_url text,
  instagram_handle text,
  years_experience integer default 0,
  rating numeric(3,2) default 5.0,
  review_count integer default 0,
  available boolean default true,
  verified boolean default false,
  stripe_account_id text,
  created_at timestamptz default now()
);

-- Clients
create table clients (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade unique,
  name text,
  email text,
  avatar_url text,
  budget_cents integer,
  preferred_styles text[] default '{}',
  location_city text,
  location_state text,
  ai_context_summary text,
  created_at timestamptz default now()
);

-- Conversations (AI agent sessions)
create table conversations (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid references clients(id) on delete cascade,
  messages jsonb not null default '[]',
  brief_extracted jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Matches (client <-> artist requests)
create table matches (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid references clients(id) on delete cascade,
  artist_id uuid references artists(id) on delete cascade,
  conversation_id uuid references conversations(id),
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'rejected', 'completed', 'paid', 'cancelled')),
  client_brief text not null,
  ai_summary text,
  offered_price_cents integer not null,
  final_price_cents integer,
  reference_images text[] default '{}',
  placement text,
  size_inches numeric(5,2),
  artist_response text,
  artist_responded_at timestamptz,
  stripe_payment_intent_id text,
  stripe_transfer_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Artist notifications
create table artist_notifications (
  id uuid primary key default uuid_generate_v4(),
  artist_id uuid references artists(id) on delete cascade,
  match_id uuid references matches(id) on delete cascade,
  type text not null,
  read boolean default false,
  created_at timestamptz default now()
);

-- Reviews
create table reviews (
  id uuid primary key default uuid_generate_v4(),
  match_id uuid references matches(id),
  client_id uuid references clients(id),
  artist_id uuid references artists(id),
  rating integer not null check (rating between 1 and 5),
  body text,
  created_at timestamptz default now()
);

-- Indexes
create index on artists (location_city, location_state);
create index on artists using gin (styles);
create index on matches (client_id, status);
create index on matches (artist_id, status);
create index on artist_notifications (artist_id, read);

-- RLS
alter table artists enable row level security;
alter table clients enable row level security;
alter table conversations enable row level security;
alter table matches enable row level security;
alter table artist_notifications enable row level security;
alter table reviews enable row level security;

-- Artists: public read, own write
create policy "artists_public_read" on artists for select using (true);
create policy "artists_own_write" on artists for all using (auth.uid() = user_id);

-- Clients: own only
create policy "clients_own" on clients for all using (auth.uid() = user_id);

-- Conversations: own only
create policy "conversations_own" on conversations
  for all using (
    client_id in (select id from clients where user_id = auth.uid())
  );

-- Matches: client or artist can read their own
create policy "matches_client_read" on matches
  for select using (
    client_id in (select id from clients where user_id = auth.uid())
    or artist_id in (select id from artists where user_id = auth.uid())
  );

create policy "matches_client_insert" on matches
  for insert with check (
    client_id in (select id from clients where user_id = auth.uid())
  );

create policy "matches_artist_update" on matches
  for update using (
    artist_id in (select id from artists where user_id = auth.uid())
  );

-- Artist notifications: artist only
create policy "notifs_artist_own" on artist_notifications
  for all using (
    artist_id in (select id from artists where user_id = auth.uid())
  );

-- Function: update match updated_at
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger matches_updated_at before update on matches
  for each row execute function update_updated_at();

create trigger conversations_updated_at before update on conversations
  for each row execute function update_updated_at();

-- Function: notify artist when match created
create or replace function notify_artist_on_match()
returns trigger language plpgsql as $$
begin
  insert into artist_notifications (artist_id, match_id, type)
  values (new.artist_id, new.id, 'new_match');
  return new;
end;
$$;

create trigger match_artist_notify after insert on matches
  for each row execute function notify_artist_on_match();

-- Function: update artist rating after review
create or replace function update_artist_rating()
returns trigger language plpgsql as $$
begin
  update artists
  set
    rating = (select avg(rating) from reviews where artist_id = new.artist_id),
    review_count = (select count(*) from reviews where artist_id = new.artist_id)
  where id = new.artist_id;
  return new;
end;
$$;

create trigger review_update_rating after insert on reviews
  for each row execute function update_artist_rating();
