-- 014 — Lead inbox: every channel lands in one place (2026-11-03).
-- Applied to production (elitetatz, twyrxtzjictiysxqjmhu) on 2026-11-03 via the Supabase MCP.
--
-- A lead is still a row in `matches`. What changes: it now says which channel it
-- came through, can be matched back to an outside thread (an Instagram
-- conversation, an email sender, a phone number), carries the artist's private
-- notes, and owns reference files and assistant notes in two new tables. Inbound
-- webhooks record every event they see so a retried delivery never duplicates a
-- message.

-- ---- matches: channel, outside thread, private notes ----------------------
alter table matches
  add column if not exists channel text not null default 'web',
  add column if not exists external_thread_id text,
  add column if not exists artist_notes text,
  add column if not exists last_client_message_at timestamptz;

alter table matches drop constraint if exists matches_channel_check;
alter table matches add constraint matches_channel_check
  check (channel in ('web', 'concierge', 'email', 'instagram', 'facebook', 'sms', 'manual'));

-- Existing rows: a conversation means the concierge opened it.
update matches set channel = 'concierge' where conversation_id is not null and channel = 'web';

create index if not exists matches_artist_email_idx on matches (artist_id, lower(client_email));
create index if not exists matches_artist_phone_idx on matches (artist_id, client_phone);
create index if not exists matches_artist_thread_idx on matches (artist_id, external_thread_id);

-- ---- match_messages: which channel carried it, outside id for dedupe --------
alter table match_messages
  add column if not exists channel text,
  add column if not exists external_id text,
  add column if not exists meta jsonb;

create unique index if not exists match_messages_external_id_idx
  on match_messages (external_id) where external_id is not null;

-- ---- lead_attachments: reference files, private bucket ---------------------
create table if not exists lead_attachments (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches(id) on delete cascade,
  message_id uuid references match_messages(id) on delete set null,
  storage_path text not null,
  filename text not null,
  mime text,
  size_bytes integer,
  -- where the file came in: email, instagram, facebook, sms, client_page, artist
  source text not null default 'client',
  created_at timestamptz not null default now()
);
create index if not exists lead_attachments_match_idx on lead_attachments (match_id, created_at);
alter table lead_attachments enable row level security;
revoke all on lead_attachments from anon, authenticated;

-- ---- lead_notes: the artist's notes and the assistant's answers ------------
-- Never shown to the client. match_messages is the client-visible thread.
create table if not exists lead_notes (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches(id) on delete cascade,
  author text not null check (author in ('artist', 'assistant')),
  kind text not null default 'note' check (kind in ('note', 'question', 'answer', 'draft')),
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists lead_notes_match_idx on lead_notes (match_id, created_at);
alter table lead_notes enable row level security;
revoke all on lead_notes from anon, authenticated;

-- ---- inbound_events: one row per webhook delivery, unique per channel -------
create table if not exists inbound_events (
  id bigserial primary key,
  channel text not null,
  external_id text not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  match_id uuid references matches(id) on delete set null,
  outcome text,
  error text,
  unique (channel, external_id)
);
alter table inbound_events enable row level security;
revoke all on inbound_events from anon, authenticated;
revoke all on sequence inbound_events_id_seq from anon, authenticated;

-- ---- storage: private bucket for reference files ----------------------------
-- 25 MB per file. Read only through signed URLs minted by the server.
insert into storage.buckets (id, name, public, file_size_limit)
values ('lead-files', 'lead-files', false, 26214400)
on conflict (id) do nothing;

-- ---- Collectors Club: the in-person sign-ups ---------------------------------
-- Eight people handed over their email at the Hell City Phoenix 2026 booth,
-- before the one-click confirm existed. They confirmed in person; record it so
-- the first club email can reach them. Sends nothing.
update community_members
set confirmed_at = created_at
where source = 'hellcity-phoenix-2026' and confirmed_at is null;
