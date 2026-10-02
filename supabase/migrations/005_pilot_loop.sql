-- 005: Lacey pilot loop — contact capture, three-button artist surface,
-- two-way thread, appointment date, dual payout target.

alter table matches
  add column if not exists client_name text,
  add column if not exists client_email text,
  add column if not exists client_phone text,
  add column if not exists proposed_dates text,
  add column if not exists appointment_at timestamptz,
  add column if not exists payout_target text check (payout_target in ('artist','shop')) default 'artist';

alter table matches drop constraint if exists matches_status_check;
alter table matches add constraint matches_status_check
  check (status in ('pending','info_requested','accepted','rejected','paid','booked','completed','cancelled'));

alter table artist_notifications add column if not exists message text;

alter table artists
  add column if not exists phone text,
  add column if not exists payout_preference text check (payout_preference in ('artist','shop')) default 'artist',
  add column if not exists shop_name text,
  add column if not exists shop_stripe_account_id text,
  add column if not exists stripe_onboarding_complete boolean default false;

create table if not exists match_messages (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches(id) on delete cascade,
  sender text not null check (sender in ('artist','client','system')),
  body text not null,
  created_at timestamptz default now()
);
create index if not exists match_messages_match_idx on match_messages (match_id, created_at);
alter table match_messages enable row level security;
-- Artists read and write threads on their own matches; clients go through
-- signed-link API routes that use the service role.
drop policy if exists match_messages_artist on match_messages;
create policy match_messages_artist on match_messages for all
  using (match_id in (select m.id from matches m join artists a on a.id = m.artist_id where a.user_id = auth.uid()))
  with check (match_id in (select m.id from matches m join artists a on a.id = m.artist_id where a.user_id = auth.uid()));
