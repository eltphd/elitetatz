-- 015 — Approvals: things Erica wants Lacey to sign off on before they go out (2026-11-03).
-- Not yet applied to production. Apply in the Supabase SQL editor, then note the date here.
--
-- One row per thing awaiting her word: an email campaign to the client list,
-- a blog post for rawsunart.com. The operator (or a script) submits the
-- rendered piece; Lacey reads it in /dashboard/approvals and taps Approve or
-- Ask for changes. Approval is a record, not a send: the send script refuses
-- to run until the row says approved, and the row is what it checks.

create table if not exists approvals (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references artists(id) on delete cascade,
  kind text not null check (kind in ('email_campaign', 'blog_post')),
  -- stable handle the submitting script and the send script agree on,
  -- e.g. 'rsa-reconnect-1', 'blog/2026-11-studio-diary'
  key text not null,
  title text not null,
  summary text,
  subject text,
  body_html text,
  body_text text,
  audience text,
  audience_count integer,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'changes_requested', 'withdrawn', 'sent', 'published')),
  artist_notes text,
  decided_at timestamptz,
  submitted_by text not null default 'operator',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (artist_id, key)
);
create index if not exists approvals_artist_status_idx on approvals (artist_id, status, created_at desc);
alter table approvals enable row level security;
revoke all on approvals from anon, authenticated;
