-- 016 — Hold timers: one row per hold message the system has sent (2026-11-03).
--
-- An hourly cron (/api/cron/holds) looks for leads sitting in a silent state
-- (nobody has written for 36 h, 72 h, 14 d…) and sends one message per state:
-- the client hears when they will hear next, Lacey gets a nudge. This table is
-- what makes each of those messages happen once. The primary key is the
-- guard: a second tick that finds the row sends nothing.
--
-- Holds: A1 (36 h, client waiting on Lacey), A2 (72 h), B (72 h, client owes
-- Lacey an answer), B14 (14 d), C (72 h, quoted, no deposit), C14 (14 d),
-- D (72 h, deposit in, no date), E (48 h, date asked, unconfirmed).

create table if not exists hold_events (
  match_id uuid not null references matches(id) on delete cascade,
  hold text not null,
  sent_at timestamptz not null default now(),
  primary key (match_id, hold)
);
create index if not exists hold_events_sent_idx on hold_events (sent_at desc);
alter table hold_events enable row level security;
revoke all on hold_events from anon, authenticated;
