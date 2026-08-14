-- Community engine: fan/collector list, event funnels, artist waitlist leads.
-- Writes go through server API routes using the service role key; no public
-- policies are defined, so RLS blocks all direct client access by default.

-- Fans / collectors who joined an artist's community (email list)
create table community_members (
  id uuid primary key default uuid_generate_v4(),
  artist_id uuid references artists(id) on delete set null,
  artist_handle text not null default 'rawsunart',
  email text not null,
  name text,
  source text not null default 'web',          -- e.g. 'homepage', 'hellcity-phoenix-2026'
  event_slug text,                             -- funnel event this signup came from, if any
  giveaway_entry boolean not null default false,
  welcome_sent_at timestamptz,
  unsubscribed_at timestamptz,
  created_at timestamptz default now(),
  unique (artist_handle, email)
);

create index on community_members (artist_handle, created_at desc);
create index on community_members (event_slug);

-- Per-artist convention/event funnels (config can graduate here from code)
create table artist_events (
  id uuid primary key default uuid_generate_v4(),
  artist_id uuid references artists(id) on delete cascade,
  artist_handle text not null,
  slug text not null unique,                   -- e.g. 'hellcity-phoenix-2026'
  title text not null,
  city text,
  venue text,
  starts_on date,
  ends_on date,
  headline text,
  subline text,
  incentives jsonb not null default '[]',
  active boolean not null default true,
  created_at timestamptz default now()
);

-- Artists / shop owners asking for their own hub (the platform waitlist)
create table artist_leads (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  email text not null,
  instagram text,
  role text not null default 'artist'
    check (role in ('artist', 'shop_owner', 'other')),
  city text,
  message text,
  source text not null default 'web',          -- e.g. 'hellcity-phoenix-2026', 'rawsunart-footer'
  contacted_at timestamptz,
  created_at timestamptz default now(),
  unique (email)
);

create index on artist_leads (created_at desc);

-- RLS on, no public policies: service-role API routes only
alter table community_members enable row level security;
alter table artist_events enable row level security;
alter table artist_leads enable row level security;

-- Artists may read their own community list from the dashboard
create policy "community_artist_read" on community_members
  for select using (
    artist_id in (select id from artists where user_id = auth.uid())
  );

create policy "events_public_read" on artist_events
  for select using (active = true);
