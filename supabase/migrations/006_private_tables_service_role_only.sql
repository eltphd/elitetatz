-- 006 — Private tables are reachable only through the server.
--
-- Written 2026-10-01 to match production. The live project had already
-- dropped the browser-facing policies that schema.sql and migrations 001-005
-- create (artists_public_read exposed Lacey's phone and Stripe account ids;
-- artists_own_write let any signed-up user create an artist row;
-- matches_artist_update let an artist set status = 'paid'). This migration
-- makes the repo say what production does, so a rebuild cannot reopen them.
--
-- Posture (same as MALLY): every private table is deny-all under RLS. Server
-- routes prove identity with the session, then read and write with the
-- service role, filtered to the caller's own rows (src/lib/artist-session.ts,
-- signed links in src/lib/tokens.ts). Only the public catalog stays readable.

drop policy if exists "artists_public_read" on artists;
drop policy if exists "artists_own_write" on artists;
drop policy if exists "clients_own" on clients;
drop policy if exists "conversations_own" on conversations;
drop policy if exists "matches_client_read" on matches;
drop policy if exists "matches_client_insert" on matches;
drop policy if exists "matches_artist_update" on matches;
drop policy if exists match_messages_artist on match_messages;
drop policy if exists "notifs_artist_own" on artist_notifications;
drop policy if exists "community_artist_read" on community_members;
drop policy if exists "claims_artist_read" on drop_claims;

-- Deny-all is enforced twice: no policies, and no table grants either.
revoke all on artists, clients, conversations, matches, match_messages,
  artist_notifications, community_members, artist_leads, drop_claims, reviews
  from anon, authenticated;

-- The public catalog: drops on sale and upcoming guest spots. Read-only.
revoke all on drops, artist_events from anon, authenticated;
grant select on drops, artist_events to anon, authenticated;
