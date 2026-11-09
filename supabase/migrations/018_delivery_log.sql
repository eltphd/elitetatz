-- 018 — Delivery log: every attempt to email the artist, with its outcome (2026-11-09).
--
-- The Nov 9 audit found artist_notifications empty: nothing could show that an
-- inquiry had ever reached Lacey's email. notifyArtist (src/lib/notify.ts) now
-- writes one row per attempt. `status` is 'sent' or 'failed'; a failed row has
-- the provider's error and also raised an alert to the operator. `recipient`
-- is masked (l***@rawsunart.com). `ref` is the caller's reference, so an email
-- sent before its match existed is still traceable; `match_id` is attached
-- once the match is written. Older rows (her own actions, deposit_paid) keep
-- a null status.

alter table artist_notifications
  add column if not exists channel text not null default 'email',
  add column if not exists status text,
  add column if not exists error text,
  add column if not exists provider_id text,
  add column if not exists recipient text,
  add column if not exists kind text,
  add column if not exists ref text;

create index if not exists artist_notifications_status_time_idx
  on artist_notifications (status, created_at desc);
