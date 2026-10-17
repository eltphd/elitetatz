-- 012 — Collectors Club confirmation, rejection log, rsa_contacts grants (RawSunArt Reconnect Build, Oct 16 2026).
-- Applied to production (elitetatz, twyrxtzjictiysxqjmhu) on 2026-10-16 via the Supabase MCP.

-- Only confirmed members are ever emailed after the welcome. Set by /api/community/confirm (one click in the welcome email).
alter table community_members add column if not exists confirmed_at timestamptz;

-- What the sign-up route turned away, so volume is visible. No address, no message: a reason, a keyed hash of the IP, the user agent.
create table if not exists join_rejections (
  id bigserial primary key,
  artist_handle text not null default 'rawsunart',
  reason text not null,
  ip_hash text,
  ua text,
  created_at timestamptz not null default now()
);
create index if not exists join_rejections_time_idx on join_rejections (artist_handle, created_at desc);
alter table join_rejections enable row level security;
revoke all on join_rejections from anon, authenticated;
revoke all on sequence join_rejections_id_seq from anon, authenticated;

-- rsa_contacts was created in production with the default table grants still in place. RLS with no
-- policies already blocked the browser keys; this makes the posture match 006 (no grants either).
revoke all on rsa_contacts from anon, authenticated;
