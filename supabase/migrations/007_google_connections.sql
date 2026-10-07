-- 007 — Artist Google connections (Gmail + Calendar, read-only).
--
-- Same posture as 006: private tables are deny-all under RLS and reachable
-- only through server routes using the service role, filtered to the
-- signed-in artist's own row (src/lib/artist-session.ts).
--
-- Rules these tables encode (Tattoo Client Data Map, Oct 6 2026):
--   R1  The artist owns the connection. One row per artist; deleting the
--       artist deletes it. Disconnect deletes the token immediately.
--   R3  Consent is explicit, dated and revocable. Every grant and every
--       revoke is written to the consent log, which outlives the token.

-- Google OAuth refresh tokens, encrypted at rest with AES-256-GCM. The key
-- (GOOGLE_TOKEN_KEY) lives only in the server environment, never in the
-- database, so a database dump alone cannot open anyone's inbox.
create table if not exists artist_google_connections (
  artist_id uuid primary key references artists(id) on delete cascade,
  google_email text not null,
  scopes text[] not null,
  refresh_token_enc text not null,
  consent_version text not null,
  consented_at timestamptz not null default now(),
  last_used_at timestamptz,
  needs_reconnect boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists artist_google_consent_log (
  id bigserial primary key,
  artist_id uuid not null references artists(id) on delete cascade,
  action text not null check (action in ('granted', 'revoked', 'expired')),
  scopes text[] not null default '{}',
  google_email text,
  consent_version text,
  at timestamptz not null default now()
);
create index if not exists artist_google_consent_log_artist_idx
  on artist_google_consent_log (artist_id, at desc);

alter table artist_google_connections enable row level security;
alter table artist_google_consent_log enable row level security;

revoke all on artist_google_connections, artist_google_consent_log
  from anon, authenticated;
revoke all on sequence artist_google_consent_log_id_seq
  from anon, authenticated;
