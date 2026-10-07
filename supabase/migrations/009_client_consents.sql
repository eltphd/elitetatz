-- 009: What a client agreed to, beyond their own inquiry.
--
-- The client belongs to the artist. Sending an inquiry lets the artist answer
-- it and nothing more; anything else (the artist's own updates, hearing about
-- other EliteTatz artists) is a separate, explicit choice that starts unticked.
--
-- Append-only: every change is a new row, and the latest row per
-- (match_id, scope) is the client's current answer. `wording` keeps the exact
-- sentence the client saw, so the record proves what was agreed.
--
-- Deny-all like every private table (006): written and read only by the
-- service role after the signed inquiry link is verified.

create table if not exists client_consents (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches(id) on delete cascade,
  scope text not null check (scope in ('artist_updates','elitetatz_network')),
  granted boolean not null,
  wording text not null,
  wording_version text not null,
  source text not null check (source in ('concierge','inquiry_page')),
  created_at timestamptz not null default now()
);

create index if not exists client_consents_match_scope_idx
  on client_consents (match_id, scope, created_at desc);

alter table client_consents enable row level security;
revoke all on client_consents from anon, authenticated;
