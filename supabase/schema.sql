-- EliteTatz — production schema snapshot (public schema).
--
-- Generated 2026-11-03 from the live catalog of project twyrxtzjictiysxqjmhu
-- after migration 016 (hold_events). This is a reference, not the source of truth: change the
-- database only through a new file in supabase/migrations/, then regenerate
-- this snapshot. Tables are ordered so every foreign key target exists first.
--
-- Posture (migration 006): every table is deny-all to the browser keys, with
-- RLS on, no policies and no grants. Server routes use the service role. The
-- only exceptions are the public catalog, drops and artist_events, which anon
-- and authenticated may read.
--
-- Production has no functions or triggers in public. Extensions live in the
-- extensions schema (uuid-ossp, pgcrypto) and Supabase's own schemas.

create extension if not exists "uuid-ossp" with schema extensions;
create extension if not exists pgcrypto with schema extensions;

-- artists
create table artists (
  id uuid default uuid_generate_v4() not null,
  user_id uuid,
  name text not null,
  bio text,
  location_city text not null,
  location_state text not null,
  location_lat double precision,
  location_lng double precision,
  styles text[] default '{}'::text[] not null,
  hourly_rate_cents integer default 0 not null,
  min_piece_cents integer default 0 not null,
  portfolio_images text[] default '{}'::text[] not null,
  avatar_url text,
  instagram_handle text,
  years_experience integer default 0,
  rating numeric(3,2) default 5.0,
  review_count integer default 0,
  available boolean default true,
  verified boolean default false,
  stripe_account_id text,
  created_at timestamp with time zone default now(),
  phone text,
  payout_preference text default 'artist'::text,
  shop_name text,
  shop_stripe_account_id text,
  stripe_onboarding_complete boolean default false,
  constraint artists_pkey PRIMARY KEY (id),
  constraint artists_payout_preference_check CHECK ((payout_preference = ANY (ARRAY['artist'::text, 'shop'::text]))),
  constraint artists_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);
alter table artists enable row level security;

-- clients
create table clients (
  id uuid default uuid_generate_v4() not null,
  user_id uuid,
  name text,
  email text,
  avatar_url text,
  budget_cents integer,
  preferred_styles text[] default '{}'::text[],
  location_city text,
  location_state text,
  ai_context_summary text,
  created_at timestamp with time zone default now(),
  constraint clients_pkey PRIMARY KEY (id),
  constraint clients_user_id_key UNIQUE (user_id),
  constraint clients_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);
alter table clients enable row level security;

-- conversations
create table conversations (
  id uuid default uuid_generate_v4() not null,
  client_id uuid,
  messages jsonb default '[]'::jsonb not null,
  brief_extracted jsonb,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  session_id text,
  mode text default 'marketplace'::text,
  constraint conversations_pkey PRIMARY KEY (id),
  constraint conversations_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);
alter table conversations enable row level security;

-- matches
create table matches (
  id uuid default uuid_generate_v4() not null,
  client_id uuid,
  artist_id uuid,
  conversation_id uuid,
  status text default 'pending'::text not null,
  client_brief text not null,
  ai_summary text,
  offered_price_cents integer not null,
  final_price_cents integer,
  reference_images text[] default '{}'::text[],
  placement text,
  size_inches numeric(5,2),
  artist_response text,
  artist_responded_at timestamp with time zone,
  stripe_payment_intent_id text,
  stripe_transfer_id text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  client_name text,
  client_email text,
  client_phone text,
  proposed_dates text,
  appointment_at timestamp with time zone,
  payout_target text default 'artist'::text,
  design_fee_cents integer,
  date_request text,
  booked_at timestamp with time zone,
  channel text default 'web'::text not null,
  external_thread_id text,
  artist_notes text,
  last_client_message_at timestamp with time zone,
  constraint matches_pkey PRIMARY KEY (id),
  constraint matches_channel_check CHECK ((channel = ANY (ARRAY['web'::text, 'concierge'::text, 'email'::text, 'instagram'::text, 'facebook'::text, 'sms'::text, 'manual'::text]))),
  constraint matches_payout_target_check CHECK ((payout_target = ANY (ARRAY['artist'::text, 'shop'::text]))),
  constraint matches_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'info_requested'::text, 'accepted'::text, 'rejected'::text, 'paid'::text, 'booked'::text, 'completed'::text, 'cancelled'::text]))),
  constraint matches_artist_id_fkey FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE CASCADE,
  constraint matches_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  constraint matches_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES conversations(id)
);
CREATE INDEX matches_artist_booked_idx ON public.matches USING btree (artist_id, booked_at DESC);
CREATE INDEX matches_artist_email_idx ON public.matches USING btree (artist_id, lower(client_email));
CREATE INDEX matches_artist_phone_idx ON public.matches USING btree (artist_id, client_phone);
CREATE INDEX matches_artist_thread_idx ON public.matches USING btree (artist_id, external_thread_id);
alter table matches enable row level security;

-- drops
create table drops (
  id uuid default uuid_generate_v4() not null,
  artist_id uuid,
  artist_handle text not null,
  slug text not null,
  title text not null,
  description text,
  kind text default 'print'::text not null,
  price_cents integer default 0 not null,
  image_url text,
  status text default 'available'::text not null,
  created_at timestamp with time zone default now(),
  constraint drops_pkey PRIMARY KEY (id),
  constraint drops_artist_handle_slug_key UNIQUE (artist_handle, slug),
  constraint drops_kind_check CHECK ((kind = ANY (ARRAY['print'::text, 'original'::text, 'pottery'::text, 'flash'::text, 'merch'::text]))),
  constraint drops_status_check CHECK ((status = ANY (ARRAY['available'::text, 'reserved'::text, 'sold'::text, 'hidden'::text]))),
  constraint drops_artist_id_fkey FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE CASCADE
);
CREATE INDEX drops_handle_idx ON public.drops USING btree (artist_handle, status);
alter table drops enable row level security;
create policy drops_public_read on drops as permissive for select to public using ((status = ANY (ARRAY['available'::text, 'reserved'::text, 'sold'::text])));

-- artist_events
create table artist_events (
  id uuid default uuid_generate_v4() not null,
  artist_id uuid,
  artist_handle text not null,
  slug text not null,
  title text not null,
  city text,
  venue text,
  starts_on date,
  ends_on date,
  headline text,
  subline text,
  incentives jsonb default '[]'::jsonb not null,
  active boolean default true not null,
  created_at timestamp with time zone default now(),
  constraint artist_events_pkey PRIMARY KEY (id),
  constraint artist_events_slug_key UNIQUE (slug),
  constraint artist_events_artist_id_fkey FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE CASCADE
);
alter table artist_events enable row level security;
create policy events_public_read on artist_events as permissive for select to public using ((active = true));

-- artist_google_connections
create table artist_google_connections (
  artist_id uuid not null,
  google_email text not null,
  scopes text[] not null,
  refresh_token_enc text not null,
  consent_version text not null,
  consented_at timestamp with time zone default now() not null,
  last_used_at timestamp with time zone,
  needs_reconnect boolean default false not null,
  updated_at timestamp with time zone default now() not null,
  constraint artist_google_connections_pkey PRIMARY KEY (artist_id),
  constraint artist_google_connections_artist_id_fkey FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE CASCADE
);
alter table artist_google_connections enable row level security;

-- artist_google_consent_log
create table artist_google_consent_log (
  id bigserial not null,
  artist_id uuid not null,
  action text not null,
  scopes text[] default '{}'::text[] not null,
  google_email text,
  consent_version text,
  at timestamp with time zone default now() not null,
  constraint artist_google_consent_log_pkey PRIMARY KEY (id),
  constraint artist_google_consent_log_action_check CHECK ((action = ANY (ARRAY['granted'::text, 'revoked'::text, 'expired'::text]))),
  constraint artist_google_consent_log_artist_id_fkey FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE CASCADE
);
CREATE INDEX artist_google_consent_log_artist_idx ON public.artist_google_consent_log USING btree (artist_id, at DESC);
alter table artist_google_consent_log enable row level security;

-- artist_leads
create table artist_leads (
  id uuid default uuid_generate_v4() not null,
  name text not null,
  email text not null,
  instagram text,
  role text default 'artist'::text not null,
  city text,
  message text,
  source text default 'web'::text not null,
  contacted_at timestamp with time zone,
  created_at timestamp with time zone default now(),
  constraint artist_leads_pkey PRIMARY KEY (id),
  constraint artist_leads_email_key UNIQUE (email),
  constraint artist_leads_role_check CHECK ((role = ANY (ARRAY['artist'::text, 'shop_owner'::text, 'other'::text])))
);
CREATE INDEX artist_leads_created_idx ON public.artist_leads USING btree (created_at DESC);
alter table artist_leads enable row level security;

-- artist_notifications
create table artist_notifications (
  id uuid default uuid_generate_v4() not null,
  artist_id uuid,
  match_id uuid,
  type text not null,
  read boolean default false,
  created_at timestamp with time zone default now(),
  message text,
  constraint artist_notifications_pkey PRIMARY KEY (id),
  constraint artist_notifications_artist_id_fkey FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE CASCADE,
  constraint artist_notifications_match_id_fkey FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE
);
alter table artist_notifications enable row level security;

-- client_consents
create table client_consents (
  id uuid default gen_random_uuid() not null,
  match_id uuid not null,
  scope text not null,
  granted boolean not null,
  wording text not null,
  wording_version text not null,
  source text not null,
  created_at timestamp with time zone default now() not null,
  constraint client_consents_pkey PRIMARY KEY (id),
  constraint client_consents_scope_check CHECK ((scope = ANY (ARRAY['artist_updates'::text, 'elitetatz_network'::text]))),
  constraint client_consents_source_check CHECK ((source = ANY (ARRAY['concierge'::text, 'inquiry_page'::text]))),
  constraint client_consents_match_id_fkey FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE
);
CREATE INDEX client_consents_match_scope_idx ON public.client_consents USING btree (match_id, scope, created_at DESC);
alter table client_consents enable row level security;

-- community_members
create table community_members (
  id uuid default uuid_generate_v4() not null,
  artist_id uuid,
  artist_handle text default 'rawsunart'::text not null,
  email text not null,
  name text,
  source text default 'web'::text not null,
  event_slug text,
  giveaway_entry boolean default false not null,
  welcome_sent_at timestamp with time zone,
  unsubscribed_at timestamp with time zone,
  created_at timestamp with time zone default now(),
  confirmed_at timestamp with time zone,
  constraint community_members_pkey PRIMARY KEY (id),
  constraint community_members_artist_handle_email_key UNIQUE (artist_handle, email),
  constraint community_members_artist_id_fkey FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE SET NULL
);
CREATE INDEX community_members_event_idx ON public.community_members USING btree (event_slug);
CREATE INDEX community_members_handle_idx ON public.community_members USING btree (artist_handle, created_at DESC);
alter table community_members enable row level security;

-- drop_claims
create table drop_claims (
  id uuid default uuid_generate_v4() not null,
  drop_id uuid,
  drop_slug text not null,
  artist_handle text not null,
  email text not null,
  name text,
  note text,
  status text default 'new'::text not null,
  code text,
  reserved_at timestamp with time zone,
  expires_at timestamp with time zone,
  booth_index integer,
  created_at timestamp with time zone default now(),
  constraint drop_claims_pkey PRIMARY KEY (id),
  constraint drop_claims_status_check CHECK ((status = ANY (ARRAY['new'::text, 'reserved'::text, 'expired'::text, 'picked_up'::text, 'contacted'::text, 'paid'::text, 'closed'::text]))),
  constraint drop_claims_drop_id_fkey FOREIGN KEY (drop_id) REFERENCES drops(id) ON DELETE SET NULL
);
CREATE INDEX drop_claims_reserve_idx ON public.drop_claims USING btree (artist_handle, drop_slug, status);
CREATE INDEX drop_claims_handle_idx ON public.drop_claims USING btree (artist_handle, status, created_at DESC);
alter table drop_claims enable row level security;

-- inquiry_sources
create table inquiry_sources (
  id bigserial not null,
  artist_handle text default 'rawsunart'::text not null,
  source text not null,
  created_at timestamp with time zone default now() not null,
  constraint inquiry_sources_pkey PRIMARY KEY (id)
);
CREATE INDEX inquiry_sources_handle_time_idx ON public.inquiry_sources USING btree (artist_handle, created_at DESC);
alter table inquiry_sources enable row level security;

-- join_rejections
create table join_rejections (
  id bigserial not null,
  artist_handle text default 'rawsunart'::text not null,
  reason text not null,
  ip_hash text,
  ua text,
  created_at timestamp with time zone default now() not null,
  constraint join_rejections_pkey PRIMARY KEY (id)
);
CREATE INDEX join_rejections_time_idx ON public.join_rejections USING btree (artist_handle, created_at DESC);
alter table join_rejections enable row level security;

-- match_messages
create table match_messages (
  id uuid default gen_random_uuid() not null,
  match_id uuid not null,
  sender text not null,
  body text not null,
  created_at timestamp with time zone default now(),
  channel text,
  external_id text,
  meta jsonb,
  constraint match_messages_pkey PRIMARY KEY (id),
  constraint match_messages_sender_check CHECK ((sender = ANY (ARRAY['artist'::text, 'client'::text, 'system'::text]))),
  constraint match_messages_match_id_fkey FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE
);
CREATE INDEX match_messages_match_idx ON public.match_messages USING btree (match_id, created_at);
CREATE UNIQUE INDEX match_messages_external_id_idx ON public.match_messages USING btree (external_id) WHERE (external_id IS NOT NULL);
alter table match_messages enable row level security;

-- lead_attachments (migration 014): reference files in the private bucket lead-files
create table lead_attachments (
  id uuid default gen_random_uuid() not null,
  match_id uuid not null,
  message_id uuid,
  storage_path text not null,
  filename text not null,
  mime text,
  size_bytes integer,
  source text default 'client'::text not null,
  created_at timestamp with time zone default now() not null,
  constraint lead_attachments_pkey PRIMARY KEY (id),
  constraint lead_attachments_match_id_fkey FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE,
  constraint lead_attachments_message_id_fkey FOREIGN KEY (message_id) REFERENCES match_messages(id) ON DELETE SET NULL
);
CREATE INDEX lead_attachments_match_idx ON public.lead_attachments USING btree (match_id, created_at);
alter table lead_attachments enable row level security;

-- lead_notes (migration 014): the artist's private notes and the assistant's answers; never client-visible
create table lead_notes (
  id uuid default gen_random_uuid() not null,
  match_id uuid not null,
  author text not null,
  kind text default 'note'::text not null,
  body text not null,
  created_at timestamp with time zone default now() not null,
  constraint lead_notes_pkey PRIMARY KEY (id),
  constraint lead_notes_author_check CHECK ((author = ANY (ARRAY['artist'::text, 'assistant'::text]))),
  constraint lead_notes_kind_check CHECK ((kind = ANY (ARRAY['note'::text, 'question'::text, 'answer'::text, 'draft'::text]))),
  constraint lead_notes_match_id_fkey FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE
);
CREATE INDEX lead_notes_match_idx ON public.lead_notes USING btree (match_id, created_at);
alter table lead_notes enable row level security;

-- inbound_events (migration 014): one row per webhook delivery, unique per channel
create table inbound_events (
  id bigint generated by default as identity not null,
  channel text not null,
  external_id text not null,
  received_at timestamp with time zone default now() not null,
  processed_at timestamp with time zone,
  match_id uuid,
  outcome text,
  error text,
  constraint inbound_events_pkey PRIMARY KEY (id),
  constraint inbound_events_channel_external_id_key UNIQUE (channel, external_id),
  constraint inbound_events_match_id_fkey FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE SET NULL
);
alter table inbound_events enable row level security;

-- Storage (migration 014): bucket lead-files, private, 25 MB per file, read through signed URLs only.

-- approvals (migration 015): her okay before an email campaign or blog post goes out
create table approvals (
  id uuid default gen_random_uuid() not null,
  artist_id uuid not null,
  kind text not null,
  key text not null,
  title text not null,
  summary text,
  subject text,
  body_html text,
  body_text text,
  audience text,
  audience_count integer,
  status text default 'pending'::text not null,
  artist_notes text,
  decided_at timestamp with time zone,
  submitted_by text default 'operator'::text not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  constraint approvals_pkey PRIMARY KEY (id),
  constraint approvals_artist_id_key_key UNIQUE (artist_id, key),
  constraint approvals_kind_check CHECK ((kind = ANY (ARRAY['email_campaign'::text, 'blog_post'::text]))),
  constraint approvals_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'changes_requested'::text, 'withdrawn'::text, 'sent'::text, 'published'::text]))),
  constraint approvals_artist_id_fkey FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE CASCADE
);
CREATE INDEX approvals_artist_status_idx ON public.approvals USING btree (artist_id, status, created_at DESC);
alter table approvals enable row level security;

-- hold_events (migration 016): one row per hold message the cron has sent; the primary key makes it once
create table hold_events (
  match_id uuid not null,
  hold text not null,
  sent_at timestamp with time zone default now() not null,
  constraint hold_events_pkey PRIMARY KEY (match_id, hold),
  constraint hold_events_match_id_fkey FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE
);
CREATE INDEX hold_events_sent_idx ON public.hold_events USING btree (sent_at DESC);
alter table hold_events enable row level security;

-- reviews
create table reviews (
  id uuid default uuid_generate_v4() not null,
  match_id uuid,
  client_id uuid,
  artist_id uuid,
  rating integer not null,
  body text,
  created_at timestamp with time zone default now(),
  constraint reviews_pkey PRIMARY KEY (id),
  constraint reviews_rating_check CHECK (((rating >= 1) AND (rating <= 5))),
  constraint reviews_artist_id_fkey FOREIGN KEY (artist_id) REFERENCES artists(id),
  constraint reviews_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id),
  constraint reviews_match_id_fkey FOREIGN KEY (match_id) REFERENCES matches(id)
);
alter table reviews enable row level security;

-- rsa_contacts
create table rsa_contacts (
  id uuid default gen_random_uuid() not null,
  artist_handle text default 'rawsunart'::text not null,
  first_name text,
  last_name text,
  email text not null,
  phone text,
  source text,
  source_year text,
  last_service_date text,
  sms_permission text,
  consent_status text default 'legacy-customer'::text not null,
  lacey_exclude boolean default false not null,
  notes text,
  reconnect_sent_at timestamp with time zone,
  keep_clicked_at timestamp with time zone,
  unsubscribed_at timestamp with time zone,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  first_seen_year integer,
  last_seen_year integer,
  mailbox_mentions integer,
  lacey_decision text,
  lacey_reviewed_at timestamp with time zone,
  send_token text,
  booking_system_msgs integer,
  booking_subject_msgs integer,
  review_run text,
  constraint rsa_contacts_pkey PRIMARY KEY (id),
  constraint rsa_contacts_artist_handle_email_key UNIQUE (artist_handle, email),
  constraint rsa_contacts_send_token_key UNIQUE (send_token)
);
alter table rsa_contacts enable row level security;

-- Grants. Supabase's default privileges hand new public tables to anon and
-- authenticated; take them all back, then reopen the read-only catalog.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
grant select on drops, artist_events to anon, authenticated;
