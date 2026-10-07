-- 011: when a lead became a booking (deposit in). Drives the per-booked-lead
-- fee: $25 per booked lead, capped at 10 a month, invoiced to the artist.
alter table matches add column if not exists booked_at timestamptz;
create index if not exists matches_artist_booked_idx on matches (artist_id, booked_at desc);
-- Backfill anything already settled before this column existed.
update matches set booked_at = coalesce(booked_at, updated_at)
 where status in ('paid','booked','completed') and booked_at is null;
