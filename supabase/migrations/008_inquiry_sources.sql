-- 008 — Anonymous inquiry-source counts for rawsunart.com.
--
-- One row per inquiry Formspree accepted: a source label and a timestamp.
-- No name, email, IP or message text, ever (Data Map R5: counts with no
-- person in them). Written by /api/community/inquiry-source with the service
-- role; read by the monthly scorecard. Deny-all to browser keys, as in 006.

create table if not exists inquiry_sources (
  id bigserial primary key,
  artist_handle text not null default 'rawsunart',
  source text not null,
  created_at timestamptz not null default now()
);
create index if not exists inquiry_sources_handle_time_idx
  on inquiry_sources (artist_handle, created_at desc);

alter table inquiry_sources enable row level security;
revoke all on inquiry_sources from anon, authenticated;
revoke all on sequence inquiry_sources_id_seq from anon, authenticated;
