-- 019 — Daily synthetic probe results (2026-11-09, brief item 8).
--
-- Once a day /api/cron/probe submits a signed test inquiry tagged
-- `test-probe` through the real form route and checks that the route reached
-- the artist-email step (logged 'skipped': a probe mails nobody), the portal
-- row exists and the source was counted. One row here per run: `ok` is the
-- verdict, `checks` says which held
-- ({"posted":true,"logged":true,"match":true,"source":true}), `error` is
-- what went wrong, `ref` is the inquiry id the run minted. The 7 PM digest
-- reads the latest row of the day for its system line; whether that line may
-- say "System checked OK" also depends on a delivery receipt (migration 020).
-- No person in any row: the probe is not a client.

create table if not exists probe_runs (
  id bigserial primary key,
  ran_at timestamptz not null default now(),
  ok boolean not null,
  checks jsonb not null default '{}'::jsonb,
  error text,
  ref text
);
create index if not exists probe_runs_ran_at_idx on probe_runs (ran_at desc);

alter table probe_runs enable row level security;
revoke all on probe_runs from anon, authenticated;
revoke all on sequence probe_runs_id_seq from anon, authenticated;
